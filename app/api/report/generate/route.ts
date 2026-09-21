import { normalizeBirthInput, validateBirthInput, sameBirthInput, assertOwnedReference } from "@/lib/birth-input";
import { claimGeneration, releaseGeneration, validWorker } from "@/lib/generation-lock";
import { enqueueReportJob, claimDispatchedJob, settleReportJob, type ReportJob } from "@/lib/report-jobs";
import { reportState } from "@/lib/report-state";
import { isDeepStrictEqual } from "node:util";
import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calcSaju, calcLuckData } from "@/lib/saju-engine";
import { type ReportSectionSpec } from "@/lib/report-spec";
import { getReportCategoryConfig, type ReportCategoryConfig } from "@/lib/report-categories";
import {
  buildPersonNarrativePrompt,
  buildRewritePrompt,
  buildSectionPrompt,
} from "@/lib/report-prompts";
import { validateGeneratedSection, validateCustomerFacingChildSection, auditCustomerFacingChildReport, type QualityCandidate } from "@/lib/report-quality";
import { buildChildMeaningContext } from "@/lib/child/child-meaning-map";
import { CHILD_NARRATIVE_SCHEMA, buildChildNarrativePrompt } from "@/lib/child/child-narrative";
import { CHILD_SECTION_PLAN_SCHEMA, buildChildSectionPlanPrompt } from "@/lib/child/child-section-planner";
import { CHILD_SECTION_ITEM_SCHEMA, buildChildSectionGenerationPrompt } from "@/lib/child/child-section-generator";
import { validateChildSectionDepth, auditChildReportDepth } from "@/lib/child/child-quality";
import { buildCoupleFacts, combineCoupleContext } from "@/lib/couple/couple-facts";
import { buildCoupleMeaningContext } from "@/lib/couple/couple-meaning-map";
import { COUPLE_NARRATIVE_SCHEMA, buildCoupleNarrativePrompt } from "@/lib/couple/couple-narrative";
import { COUPLE_SECTION_PLAN_SCHEMA, buildCoupleSectionPlanPrompt } from "@/lib/couple/couple-section-planner";
import { coupleSectionSchema, buildCoupleSectionGenerationPrompt } from "@/lib/couple/couple-section-generator";
import { validateCoupleSectionDepth, auditCoupleReportDepth, auditCoupleReportUniqueness } from "@/lib/couple/couple-quality";

export const runtime = "nodejs";
export const maxDuration = 300;

const PARALLEL_WORKERS = 12;
const OPENAI_TIMEOUT_MS = 75_000;
// Planning + generation + rewrite may each take 75 seconds. Leave time to save state.
const WORK_START_CUTOFF_MS = 45_000;
const DEFAULT_MODEL = process.env.OPENAI_REPORT_MODEL || "gpt-5.6-luna";
const CURRENT_FLOW_YEAR = Number(process.env.REPORT_FLOW_YEAR || new Date().getFullYear());

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_ENV");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function J(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function toNumber(v: any, fallback: number | null = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const normalizeInput = normalizeBirthInput;

function currentDaeun(calc: any) {
  const currentAge = new Date().getFullYear() - Number(calc?.birth_solar?.year || 0);
  return (calc?.daeun || []).find((x: any) => currentAge >= x.age_start && currentAge <= x.age_end) || null;
}

function pillarText(p: any) {
  return p ? `${p.gan}${p.ji}` : "미확정";
}

function calcContext(calc: any, input: any) {
  const p = calc?.saju || {};
  const luck = calcLuckData(calc, input.target_year || CURRENT_FLOW_YEAR);
  return {
    identity: {
      birth_input: {
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.time_unknown ? null : input.hour,
        minute: input.time_unknown ? null : input.minute,
        calendar_type: input.calendar_type,
        gender: input.gender,
        region_name: input.region_name,
        time_unknown: input.time_unknown,
      },
      zodiac: calc.ddi,
    },
    pillars: {
      year: pillarText(p.year),
      month: pillarText(p.month),
      day: pillarText(p.day),
      hour: pillarText(p.hour),
      raw: p,
    },
    day_master: calc.ilgan,
    strength: calc.ilgan_strength,
    strength_pct: calc.strength_index?.pct,
    useful_god_candidates: calc.useful_god_candidates,
    five_elements: calc.ohaeng_distribution,
    strongest: calc.ohaeng_strongest,
    weakest: calc.ohaeng_weakest,
    lacking: calc.ohaeng_lacking,
    ten_gods: calc.sipseong_distribution,
    hidden_stems: calc.hidden_stems,
    twelve_stages: calc.twelve_stages,
    relations: calc.relations,
    sinsal: calc.sinsal,
    twelve_sinsal: calc.sibisinsal,
    daeun_direction: calc.daeun_direction,
    daeun: calc.daeun,
    current_daeun: currentDaeun(calc),
    annual_flow: luck.annual,
    monthly_flow: luck.monthly,
    current_flow: luck.current,
    birth_solar: calc.birth_solar,
    time_status: {
      time_unknown: input.time_unknown,
      birth_time: calc.birth_time,
    },
  };
}

function evidenceSubset(context: any, specs: ReportSectionSpec[], extras: any = {}) {
  const keys = new Set<string>();
  for (const spec of specs) for (const k of spec.evidence) keys.add(k);
  const out: any = {};
  for (const k of keys) {
    if (k in context) out[k] = context[k];
    else if (k in extras) out[k] = extras[k];
  }
  return out;
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks: string[] = [];
  for (const item of data?.output || []) {
    for (const c of item?.content || []) if (typeof c?.text === "string") chunks.push(c.text);
  }
  return chunks.join("\n").trim();
}

async function openAIJson(args: { system: string; user: string; schema: any; schemaName: string; maxTokens?: number }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("MISSING_OPENAI_API_KEY");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: args.system }] },
        { role: "user", content: [{ type: "input_text", text: args.user }] },
      ],
      text: { format: { type: "json_schema", name: args.schemaName, strict: true, schema: args.schema } },
      max_output_tokens: args.maxTokens || 12000,
    }),
    signal: controller.signal,
  });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("OPENAI_TIMEOUT");
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const raw = await resp.text();
  if (!resp.ok) throw new Error(`OPENAI_${resp.status}:${raw.slice(0, 1200)}`);
  let data: any;
  try { data = JSON.parse(raw); } catch { throw new Error("OPENAI_RESPONSE_NOT_JSON"); }
  const out = extractOutputText(data);
  if (!out) throw new Error("OPENAI_EMPTY_OUTPUT");
  try { return JSON.parse(out); } catch { throw new Error("OPENAI_OUTPUT_PARSE_FAILED:" + out.slice(0, 500)); }
}

const sectionItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    section_no: { type: "integer" },
    opening_sentence: { type: "string" },
    content_html: { type: "string" },
    key_basis: { type: "array", items: { type: "string" } },
    life_scenes: { type: "array", items: { type: "string" } },
    risk: { type: "string" },
    action_point: { type: "string" },
    emphasis: { type: "string" },
    layout_type: { type: "string", enum: ["prose","prose_callout","table","comparison","timeline","checklist","strategy","qa","mixed"] },
    checklist: { type: "array", items: { type: "string" } },
    table_rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" }, value: { type: "string" } },
        required: ["label", "value"],
      },
    },
  },
  required: ["section_no","opening_sentence","content_html","key_basis","life_scenes","risk","action_point","emphasis","layout_type","checklist","table_rows"],
};

async function generateChildNarrative(calcCtx: any, meaningContext: any, question: string) {
  return openAIJson({
    system: "당신은 부모가 읽는 유료 자녀사주 심층 리포트의 서사 설계자입니다. 계산하지 말고 제공된 사실을 아이의 생활·감정·학습·관계 언어로 연결합니다.",
    user: buildChildNarrativePrompt({ calcContext: calcCtx, meaningContext, question }),
    schema: CHILD_NARRATIVE_SCHEMA,
    schemaName: "child_narrative_v2",
    maxTokens: 6500,
  });
}

async function planChildSection(args: {
  spec: ReportSectionSpec;
  calcSubset: any;
  meaningContext: any;
  narrative: any;
  question: string;
  recentPlans: any[];
}) {
  return openAIJson({
    system: "당신은 자녀사주 해석 설계자입니다. 원시 사주값을 생활 장면과 부모 행동으로 변환하는 설계도만 만듭니다.",
    user: buildChildSectionPlanPrompt(args),
    schema: CHILD_SECTION_PLAN_SCHEMA,
    schemaName: `child_section_${args.spec.section_no}_plan`,
    maxTokens: 5000,
  });
}

async function generateChildSection(args: {
  spec: ReportSectionSpec;
  plan: any;
  calcSubset: any;
  narrative: any;
  question: string;
  recent: any[];
  previousCandidate?: any;
  issues?: string[];
}) {
  let prompt = buildChildSectionGenerationPrompt(args);
  if (args.previousCandidate) {
    prompt += `\n\n[이전 초안 — 아래 문제를 해결해 전면 재작성]\n실패 이유: ${(args.issues || []).join(", ")}\n${JSON.stringify(args.previousCandidate)}`;
  }
  return openAIJson({
    system: "당신은 부모가 읽는 유료 자녀사주 심층 리포트의 전문 해설가입니다. 내부 제작과정은 숨기고, 실제 생활 장면과 부모 행동까지 깊게 연결합니다.",
    user: prompt,
    schema: CHILD_SECTION_ITEM_SCHEMA,
    schemaName: `child_section_${args.spec.section_no}_content`,
    maxTokens: 12000,
  });
}


async function generateCoupleNarrative(aCtx: any, bCtx: any, coupleFacts: any, meaningContext: any, question: string) {
  return openAIJson({
    system: "당신은 두 사람의 실제 만세력 계산값을 바탕으로 상호작용을 설계하는 유료 부부궁합 리포트 편집장입니다. 좋다/나쁘다 판정이 아니라 실제 관계 루프와 생활 전략을 만듭니다.",
    user: buildCoupleNarrativePrompt({ a: aCtx, b: bCtx, couple: coupleFacts, meaning: meaningContext, question }),
    schema: COUPLE_NARRATIVE_SCHEMA,
    schemaName: "couple_narrative_v2",
    maxTokens: 7500,
  });
}

async function planCoupleSection(args: {
  spec: ReportSectionSpec;
  calcSubset: any;
  narrative: any;
  meaning: any;
  question: string;
  recentPlans: any[];
}) {
  return openAIJson({
    system: "당신은 커플·부부 궁합 SECTION의 관계 해석 설계자입니다. A와 B의 상호작용을 생활 장면과 복구 행동까지 내려 설계합니다.",
    user: buildCoupleSectionPlanPrompt(args),
    schema: COUPLE_SECTION_PLAN_SCHEMA,
    schemaName: `couple_section_${args.spec.section_no}_plan`,
    maxTokens: 6000,
  });
}

async function generateCoupleSection(args: {
  spec: ReportSectionSpec;
  plan: any;
  calcSubset: any;
  narrative: any;
  question: string;
  recent: any[];
  previousCandidate?: any;
  issues?: string[];
}) {
  return openAIJson({
    system: "당신은 두 사람이 함께 읽는 유료 부부궁합 심층 리포트의 전문 해설가입니다. 한 사람 탓으로 몰지 않고 관계 상호작용, 실제 생활 장면, 복구 행동과 대화문까지 구체적으로 씁니다.",
    user: buildCoupleSectionGenerationPrompt(args),
    schema: coupleSectionSchema(args.spec.section_no),
    schemaName: `couple_section_${args.spec.section_no}_content`,
    maxTokens: 13000,
  });
}

async function generateNarrative(calcCtx: any, question: string, category: string, config: ReportCategoryConfig) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      core_thesis: { type: "string" },
      life_tensions: { type: "array", items: { type: "string" } },
      strengths: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      leverage_points: { type: "array", items: { type: "string" } },
      chapter_theses: {
        type: "object",
        additionalProperties: false,
        properties: { "1": { type: "string" }, "2": { type: "string" }, "3": { type: "string" } },
        required: ["1", "2", "3"],
      },
      current_question_thesis: { type: "string" },
    },
    required: ["core_thesis","life_tensions","strengths","risks","leverage_points","chapter_theses","current_question_thesis"],
  };
  return openAIJson({
    system: "당신은 계산하지 않는 명리 리포트 편집장입니다. 제공된 사실값만 해석하고 개인화 서사를 설계합니다.",
    user: buildPersonNarrativePrompt(calcCtx, question, category, config.title, config.focus),
    schema,
    schemaName: "person_narrative",
    maxTokens: 5000,
  });
}

async function generateSectionBatch(args: {
  specs: ReportSectionSpec[];
  calcSubset: any;
  narrative: any;
  question: string;
  category: string;
  recent: any[];
  reportTitle?: string;
  reportFocus?: string;
}) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: { sections: { type: "array", items: sectionItemSchema } },
    required: ["sections"],
  };
  const parsed = await openAIJson({
    system: "당신은 대한민국 유료 개인 사주책의 전문 해설가이자 편집자입니다. 계산하지 말고 제공된 deterministic 사실만 사용합니다. AQUA 수준의 정보 밀도와 편집 흐름을 따르되 문장을 복제하지 않습니다.",
    user: buildSectionPrompt(args),
    schema,
    schemaName: "saju_report_sections",
    maxTokens: 12000,
  });
  return Array.isArray(parsed?.sections) ? parsed.sections : [];
}

async function rewriteSection(args: {
  spec: ReportSectionSpec;
  calcSubset: any;
  narrative: any;
  question: string;
  candidate: any;
  issues: string[];
  recent: any[];
  reportTitle?: string;
  reportFocus?: string;
}) {
  const schema = { type: "object", additionalProperties: false, properties: sectionItemSchema.properties, required: sectionItemSchema.required };
  return openAIJson({
    system: "당신은 개인 사주 리포트 품질 편집자입니다. 사실값은 유지하고 반복과 얕은 일반론만 제거해 전면 재작성합니다.",
    user: buildRewritePrompt({
      spec: args.spec,
      calcSubset: args.calcSubset,
      narrative: args.narrative,
      question: args.question,
      previousCandidate: args.candidate,
      issues: args.issues,
      recent: args.recent,
    }),
    schema,
    schemaName: "saju_report_rewrite",
    maxTokens: 7000,
  });
}

async function ensureInitialized(sb: any, order: any, input: any, config: ReportCategoryConfig) {
  const validatedCalculation = validateBirthInput(input).calculation;
  if (order.user_id) {
    await assertOwnedReference(sb, "birth_profiles", order.birth_profile_id, order.user_id);
    await assertOwnedReference(sb, "questions", order.question_id, order.user_id);
  }
  let birthProfileId = order.birth_profile_id;
  let questionId = order.question_id;

  if (!input.year || !input.month || !input.day) throw new Error("BIRTH_DATE_MISSING");
  if (!input.gender) throw new Error("GENDER_MISSING");

  if (!birthProfileId) {
    const birthDate = `${String(input.year).padStart(4,"0")}-${String(input.month).padStart(2,"0")}-${String(input.day).padStart(2,"0")}`;
    const birthTime = input.time_unknown || input.hour === null ? null : `${String(input.hour).padStart(2,"0")}:${String(input.minute).padStart(2,"0")}:00`;
    const { data: bp, error } = await sb.from("birth_profiles").insert({
      user_id: order.user_id || null,
      label: order.user_id ? "본인" : "비회원 본인",
      relationship: "self",
      gender: input.gender === "남" ? "male" : "female",
      calendar_type: input.calendar_type === "solar" ? "solar" : "lunar",
      is_leap_month: input.calendar_type === "lunarLeap",
      birth_date: birthDate,
      birth_time: birthTime,
      time_unknown: input.time_unknown,
      birth_region: input.region_name,
      longitude: input.longitude,
      timezone: "Asia/Seoul",
      is_primary: false,
    }).select("id").single();
    if (error) throw new Error("BIRTH_PROFILE_CREATE_FAILED:" + error.message);
    birthProfileId = bp.id;
  }

  if (!questionId && input.question) {
    const { data: q, error } = await sb.from("questions").insert({
      user_id: order.user_id || null,
      birth_profile_id: birthProfileId,
      category: input.category || null,
      question_text: input.question,
      status: "submitted",
    }).select("id").single();
    if (error) throw new Error("QUESTION_CREATE_FAILED:" + error.message);
    questionId = q.id;
  }

  let { data: calcRow } = await sb.from("saju_calculations")
    .select("id,calculation_json,input_json,engine_version")
    .eq("birth_profile_id", birthProfileId)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (calcRow && (calcRow.engine_version !== "manse-v3-deterministic" || !sameBirthInput(calcRow.input_json, input) || !isDeepStrictEqual(calcRow.calculation_json, validatedCalculation))) calcRow = null;
  if (!calcRow) {
    const calculation = calcSaju(
      input.year,
      input.month,
      input.day,
      input.time_unknown ? null : input.hour,
      input.gender,
      input.calendar_type,
      input.minute,
      input.time_unknown ? null : input.longitude,
      !input.time_unknown,
      input.region_name,
    );
    const { data: c, error } = await sb.from("saju_calculations").insert({
      user_id: order.user_id || null,
      birth_profile_id: birthProfileId,
      engine_version: "manse-v3-deterministic",
      input_json: input,
      calculation_json: calculation,
      raw_time_candidate_json: calculation.raw_time_candidate || null,
      correction_policy: input.time_unknown ? "none" : "longitude+equation_of_time",
    }).select("id,calculation_json,input_json,engine_version").single();
    if (error) {
      // Another request may have inserted the same deterministic calculation first.
      const { data: existing } = await sb.from("saju_calculations")
        .select("id,calculation_json,input_json,engine_version")
        .eq("birth_profile_id", birthProfileId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!existing || !sameBirthInput(existing.input_json, input) || !isDeepStrictEqual(existing.calculation_json, validatedCalculation)) throw new Error("CALC_CREATE_FAILED:" + error.message);
      calcRow = existing;
    } else calcRow = c;
  }

  await sb.from("orders").update({ birth_profile_id: birthProfileId, question_id: questionId || null }).eq("id", order.id);

  let { data: report } = await sb.from("reports")
    .select("*").eq("order_id", order.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!report) {
    const { data: r, error } = await sb.from("reports").insert({
      user_id: order.user_id || null,
      order_id: order.id,
      product_id: order.product_id,
      birth_profile_id: birthProfileId,
      calculation_id: calcRow.id,
      question_id: questionId || null,
      title: config.title,
      status: "generating",
      summary: input.question ? `질문: ${input.question}` : null,
      report_json: { report_category: config.key, report_slug: config.slug, report_subtitle: config.subtitle, total_sections: config.outline.length, completed_sections: 0, progress: 12, phase: "calculation_done", pdf_ready: false },
      generation_model: DEFAULT_MODEL,
      prompt_version: config.version,
    }).select("*").single();
    if (error) throw new Error("REPORT_CREATE_FAILED:" + error.message);
    report = r;
  }

  return { birthProfileId, questionId, calcRow, report };
}


function inputFromBirthProfile(profile: any) {
  const [year, month, day] = String(profile?.birth_date || "").split("-").map(Number);
  const time = profile?.birth_time ? String(profile.birth_time).slice(0,5).split(":").map(Number) : [];
  const gender = profile?.gender === "male" ? "남" : profile?.gender === "female" ? "여" : "";
  return {
    year, month, day,
    hour: profile?.time_unknown ? null : (Number.isFinite(time[0]) ? time[0] : null),
    minute: profile?.time_unknown ? 0 : (Number.isFinite(time[1]) ? time[1] : 0),
    calendar_type: profile?.calendar_type === "lunar" ? (profile?.is_leap_month ? "lunarLeap" : "lunar") : "solar",
    gender,
    time_unknown: !!profile?.time_unknown,
    longitude: toNumber(profile?.longitude, null),
    region_name: profile?.birth_region || null,
    question: "",
    category: "",
  };
}

async function ensurePartnerInitialized(sb: any, order: any, primaryProfileId: string, existingPartnerProfileId?: string | null) {
  const payload: any = order.payment_payload || {};
  let partnerProfileId = String(payload.partner_profile_id || existingPartnerProfileId || "").trim() || null;
  let partnerInput: any = null;

  if (partnerProfileId) {
    let q = sb.from("birth_profiles").select("*").eq("id", partnerProfileId);
    if (order.user_id) q = q.eq("user_id", order.user_id);
    const { data: profile, error } = await q.maybeSingle();
    if (error || !profile) throw new Error("PARTNER_PROFILE_NOT_FOUND");
    if (String(profile.id) === String(primaryProfileId)) throw new Error("PARTNER_PROFILE_MUST_DIFFER");
    partnerInput = payload.partner_input ? normalizeInput(payload.partner_input) : inputFromBirthProfile(profile);
    validateBirthInput(partnerInput);
    if (!partnerInput.year || !partnerInput.month || !partnerInput.day) throw new Error("PARTNER_BIRTH_DATE_MISSING");
    if (!partnerInput.gender) throw new Error("PARTNER_GENDER_MISSING");
  } else {
    const rawPartner = payload.partner_input || payload.guest_input?.partner_input || payload.guest_input?.partner || null;
    partnerInput = normalizeInput(rawPartner || {});
    validateBirthInput(partnerInput);
    if (!partnerInput.year || !partnerInput.month || !partnerInput.day) throw new Error("PARTNER_BIRTH_DATE_MISSING");
    if (!partnerInput.gender) throw new Error("PARTNER_GENDER_MISSING");
    const birthDate = `${String(partnerInput.year).padStart(4,"0")}-${String(partnerInput.month).padStart(2,"0")}-${String(partnerInput.day).padStart(2,"0")}`;
    const birthTime = partnerInput.time_unknown || partnerInput.hour === null ? null : `${String(partnerInput.hour).padStart(2,"0")}:${String(partnerInput.minute).padStart(2,"0")}:00`;
    const { data: created, error } = await sb.from("birth_profiles").insert({
      user_id: order.user_id || null,
      label: "궁합 상대",
      relationship: "spouse",
      gender: partnerInput.gender === "남" ? "male" : "female",
      calendar_type: partnerInput.calendar_type === "solar" ? "solar" : "lunar",
      is_leap_month: partnerInput.calendar_type === "lunarLeap",
      birth_date: birthDate,
      birth_time: birthTime,
      time_unknown: partnerInput.time_unknown,
      birth_region: partnerInput.region_name,
      longitude: partnerInput.longitude,
      timezone: "Asia/Seoul",
      is_primary: false,
    }).select("id").single();
    if (error || !created) throw new Error("PARTNER_PROFILE_CREATE_FAILED:" + (error?.message || "NO_PROFILE"));
    partnerProfileId = created.id;
  }

  let { data: calcRow } = await sb.from("saju_calculations")
    .select("id,calculation_json,input_json,engine_version")
    .eq("birth_profile_id", partnerProfileId)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (calcRow && (calcRow.engine_version !== "manse-v3-deterministic" || !sameBirthInput(calcRow.input_json, partnerInput) || !isDeepStrictEqual(calcRow.calculation_json, validateBirthInput(partnerInput).calculation))) calcRow = null;
  if (!calcRow) {
    const calculation = calcSaju(
      partnerInput.year, partnerInput.month, partnerInput.day,
      partnerInput.time_unknown ? null : partnerInput.hour,
      partnerInput.gender, partnerInput.calendar_type, partnerInput.minute,
      partnerInput.time_unknown ? null : partnerInput.longitude,
      !partnerInput.time_unknown,
      partnerInput.region_name,
    );
    const { data: c, error } = await sb.from("saju_calculations").insert({
      user_id: order.user_id || null,
      birth_profile_id: partnerProfileId,
      engine_version: "manse-v3-deterministic",
      input_json: partnerInput,
      calculation_json: calculation,
      raw_time_candidate_json: calculation.raw_time_candidate || null,
      correction_policy: partnerInput.time_unknown ? "none" : "longitude+equation_of_time",
    }).select("id,calculation_json,input_json,engine_version").single();
    if (error || !c) throw new Error("PARTNER_CALC_CREATE_FAILED:" + (error?.message || "NO_CALC"));
    calcRow = c;
  }
  return { partnerProfileId, partnerInput, calcRow };
}

async function resetLegacyReportIfNeeded(sb: any, report: any, config: ReportCategoryConfig) {
  // Viewing an existing purchase must never destroy its PDF or text.
  if (reportState(report, null).ready || report.prompt_version === config.version) return report;
  // Preserve interrupted older editions too. A migration needs a separate reviewed revision.
  throw new Error("LEGACY_REPORT_REVIEW_REQUIRED");
}

function qualityCandidateFromRow(row: any): QualityCandidate {
  const j = row?.content_json || {};
  return {
    opening_sentence: j.opening_sentence || "",
    content_html: row?.content_html || j.content_html || "",
    key_basis: Array.isArray(j.key_basis) ? j.key_basis : [],
    life_scenes: Array.isArray(j.life_scenes) ? j.life_scenes : [],
    action_point: j.action_point || "",
  };
}


async function loadOrderForToken(sb: any, token: string) {
  const { data: order, error } = await sb
    .from("orders")
    .select("id,user_id,product_id,birth_profile_id,question_id,status,payment_payload,guest_access_token,products(slug,name,report_type)")
    .eq("guest_access_token", token)
    .maybeSingle();
  if (error || !order) throw new Error("ORDER_NOT_FOUND");
  if (order.status !== "paid") throw new Error("ORDER_NOT_PAID");
  return order;
}

async function saveAcceptedSection(sb: any, reportId: string, spec: ReportSectionSpec, content: any, rewriteCount: number, qualityIssues: string[], promptVersion: string) {
  const row = {
    report_id: reportId,
    section_no: spec.section_no,
    part_no: spec.part_no,
    part_title: spec.part_title,
    section_title: spec.section_title,
    content_html: content.content_html,
    content_json: {
      subtitle: content.subtitle || "",
      opening_sentence: content.opening_sentence || "",
      key_basis: Array.isArray(content.key_basis) ? content.key_basis : [],
      life_scenes: Array.isArray(content.life_scenes) ? content.life_scenes : [],
      parent_misreads: Array.isArray(content.parent_misreads) ? content.parent_misreads : [],
      parent_actions: Array.isArray(content.parent_actions) ? content.parent_actions : [],
      a_perspective: Array.isArray(content.a_perspective) ? content.a_perspective : [],
      b_perspective: Array.isArray(content.b_perspective) ? content.b_perspective : [],
      repair_actions: Array.isArray(content.repair_actions) ? content.repair_actions : [],
      scripts: Array.isArray(content.scripts) ? content.scripts : [],
      reframe: content.reframe || "",
      risk: content.risk || "",
      action_point: content.action_point || "",
      emphasis: content.emphasis || "",
      layout_type: content.layout_type || spec.layout_type,
      checklist: Array.isArray(content.checklist) ? content.checklist : [],
      table_rows: Array.isArray(content.table_rows) ? content.table_rows : [],
      quality_score: qualityIssues.length ? 0.78 : 0.96,
      quality_issues: qualityIssues,
      rewrite_count: rewriteCount,
      prompt_version: promptVersion,
    },
  };

  const { error: upsertError } = await sb.from("report_sections").upsert(row, { onConflict: "report_id,section_no" });
  if (!upsertError) return;

  await sb.from("report_sections").delete().eq("report_id", reportId).eq("section_no", spec.section_no);
  const { error: insertError } = await sb.from("report_sections").insert(row);
  if (insertError) throw new Error(`SECTION_${spec.section_no}_SAVE_FAILED:${insertError.message}`);
}


async function repairCoupleFinalAuditIfNeeded(
  sb:any,
  report:any,
  config:ReportCategoryConfig,
  narrative:any,
  currentJson:any,
) {
  if (config.key !== "couple") return { repaired:false, sections:[] as number[] };
  const { data: rows, error } = await sb
    .from("report_sections")
    .select("section_no,part_no,part_title,section_title,content_html,content_json")
    .eq("report_id", report.id)
    .gte("section_no", 1)
    .lte("section_no", config.outline.length)
    .order("section_no", { ascending:true });
  if (error) throw new Error("COUPLE_FINAL_AUDIT_LOAD_FAILED:" + error.message);
  if (!rows || rows.length < config.outline.length) return { repaired:false, sections:[] as number[] };

  const depth = auditCoupleReportDepth(rows as any[], config.outline, narrative);
  const uniq = auditCoupleReportUniqueness(rows as any[], config.outline);
  const failures = [...depth.failures, ...uniq.failures];
  if (!failures.length) return { repaired:false, sections:[] as number[] };

  const sectionNos = [...new Set(failures.map((x:any)=>Number(x.section_no||0)).filter((x:number)=>x>=1 && x<=config.outline.length))].sort((a,b)=>a-b);
  if (!sectionNos.length) {
    const detail=failures.map((x:any)=>`S${x.section_no}:${x.issues.join("+")}`).join("|").slice(0,2400);
    throw new Error(`COUPLE_FINAL_AUDIT_FAILED:${detail}`);
  }

  const { data: latestState } = await sb.from("reports").select("report_json").eq("id", report.id).maybeSingle();
  const baseJson = latestState?.report_json || currentJson || {};
  const round = Number(baseJson?.couple_final_repair_round || 0);
  if (round >= 3) {
    const detail=failures.map((x:any)=>`S${x.section_no}:${x.issues.join("+")}`).join("|").slice(0,2400);
    throw new Error(`COUPLE_FINAL_AUDIT_REPAIR_EXHAUSTED:${detail}`);
  }

  const { error: delError } = await sb.from("report_sections").delete().eq("report_id", report.id).in("section_no", sectionNos);
  if (delError) throw new Error("COUPLE_FINAL_AUDIT_DELETE_FAILED:" + delError.message);

  const issueMap = failures
    .filter((x:any)=>sectionNos.includes(Number(x.section_no)))
    .map((x:any)=>`S${x.section_no}:${x.issues.join("+")}`)
    .join("|")
    .slice(0,1800);

  const nextJson = {
    ...(baseJson || {}),
    phase:"writing",
    completed_sections:config.outline.length-sectionNos.length,
    progress:Math.min(95, Math.round(24 + ((config.outline.length-sectionNos.length)/config.outline.length)*70)),
    pdf_ready:false,
    background_running:true,
    background_heartbeat_at:Date.now(),
    background_last_error:`COUPLE_FINAL_REPAIR_ROUND_${round+1}:${issueMap}`,
    couple_final_repair_round:round+1,
    couple_last_repaired_sections:sectionNos,
  };
  await sb.from("reports").update({ report_json:nextJson, error_message:null }).eq("id", report.id);
  return { repaired:true, sections:sectionNos };
}

async function sectionCount(sb: any, reportId: string, totalSections: number) {
  // 예전 레거시 섹션 데이터가 남아 있어도 현재 상품의 섹션 수만 진행률에 포함한다.
  const { count, error } = await sb.from("report_sections")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId)
    .gte("section_no", 1)
    .lte("section_no", totalSections);
  if (error) throw new Error("SECTION_COUNT_FAILED:" + error.message);
  return Math.min(totalSections, count || 0);
}

async function updateProgressNow(sb: any, reportId: string, narrative: any, config: ReportCategoryConfig, extra: any = {}) {
  const totalSections = config.outline.length;
  const completed = await sectionCount(sb, reportId, totalSections);
  const { data: latest } = await sb.from("reports").select("report_json").eq("id", reportId).maybeSingle();
  const latestJson: any = latest?.report_json || {};
  const done = completed >= totalSections;
  const progress = done ? 97 : Math.min(95, Math.round(24 + (completed / totalSections) * 70));
  await sb.from("reports").update({
    status: "generating",
    report_json: {
      ...latestJson,
      ...extra,
      narrative,
      total_sections: totalSections,
      completed_sections: completed,
      progress,
      phase: done ? "pdf_queued" : "writing",
      pdf_ready: false,
      background_running: true,
      background_heartbeat_at: Date.now(),
    },
    generation_model: DEFAULT_MODEL,
    prompt_version: config.version,
    error_message: null,
  }).eq("id", reportId);
  return { completed, done, progress };
}

async function runGenerationSlice(token: string, requestUrl: string) {
  const sb = admin();
  const pdfUrl = new URL(`/api/report/pdf?token=${encodeURIComponent(token)}`, requestUrl).toString();
  const startedAt = Date.now();
  const failures: string[] = [];
  let acceptedCount = 0;
  let heldOrder: any = null;
  let lease: any = null;

  try {
    const order = await loadOrderForToken(sb, token);
    lease = await claimGeneration(sb, order);
    if (!lease) return { busy:true };
    heldOrder = order;
    const { data: purchased } = await sb.from("reports").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (reportState(purchased, order.products).ready) return;
    if (purchased && purchased.prompt_version !== getReportCategoryConfig(order.products).version) throw new Error("LEGACY_REPORT_REVIEW_REQUIRED");
    let config = getReportCategoryConfig(order.products);
    const rawInput = { ...((order.payment_payload as any)?.guest_input || {}), target_year: (order.payment_payload as any)?.guest_input?.target_year || (config.key === "new_year" ? 2027 : CURRENT_FLOW_YEAR) };
    const input = normalizeInput(rawInput);
    if (config.key === "new_year") config = {
      ...config,
      title: `${input.target_year}년 신년 운세 리포트`,
      subtitle: `${input.target_year}년의 전체 흐름과 12개월 변화, 실행 기준을 연결한 개인맞춤 신년 리포트`,
      focus: `${config.focus} 이 주문의 분석 대상은 ${input.target_year}년이다. 본문의 올해는 모두 이 대상 연도를 뜻하며 생성 시점의 연도와 혼동하지 않는다.`,
    };
    const init = await ensureInitialized(sb, order, input, config);
    let report = await resetLegacyReportIfNeeded(sb, init.report, config);
    let currentJson: any = report.report_json || {};

    if (report.status === "completed" && currentJson.pdf_storage_path && currentJson.pdf_ready !== false) {
      return;
    }

    currentJson = { ...currentJson, background_running: true, background_heartbeat_at: Date.now(), background_last_error: null };
    await sb.from("reports").update({ report_json: currentJson, error_message: null }).eq("id", report.id);

    const primaryCtx = calcContext(init.calcRow.calculation_json, input);
    let partnerInit: any = null;
    let partnerCtx: any = null;
    let coupleFacts: any = null;
    let generationCtx: any = primaryCtx;
    if (config.key === "couple") {
      partnerInit = await ensurePartnerInitialized(sb, order, init.birthProfileId, currentJson.partner_birth_profile_id || null);
      partnerCtx = calcContext(partnerInit.calcRow.calculation_json, partnerInit.partnerInput);
      coupleFacts = buildCoupleFacts(primaryCtx, partnerCtx);
      generationCtx = combineCoupleContext(primaryCtx, partnerCtx, coupleFacts);
      currentJson = {
        ...currentJson,
        partner_birth_profile_id: partnerInit.partnerProfileId,
        partner_calculation_id: partnerInit.calcRow.id,
        partner_input_snapshot: partnerInit.partnerInput,
      };
      await sb.from("reports").update({ report_json: currentJson }).eq("id", report.id);
    }
    const childMeaningContext = config.key === "child" ? buildChildMeaningContext(primaryCtx) : null;
    const coupleMeaningContext = config.key === "couple" ? buildCoupleMeaningContext(primaryCtx, partnerCtx, coupleFacts) : null;
    let narrative = currentJson.narrative;
    if (!narrative) {
      await sb.from("reports").update({
        report_json: {
          ...currentJson,
          phase: "core_analysis",
          progress: 18,
          total_sections: config.outline.length,
          completed_sections: 0,
          pdf_ready: false,
          background_running: true,
          background_heartbeat_at: Date.now(),
        },
      }).eq("id", report.id);
      let narrativeAttempt = 0;
      while (true) {
        if (Date.now() - startedAt + OPENAI_TIMEOUT_MS > 280_000) throw new Error("NARRATIVE_SLICE_TIME_BUDGET");
        if (config.key === "child") narrative = await generateChildNarrative(primaryCtx, childMeaningContext, input.question);
        else if (config.key === "couple") narrative = await generateCoupleNarrative(primaryCtx, partnerCtx, coupleFacts, coupleMeaningContext, input.question);
        else narrative = await generateNarrative(primaryCtx, input.question, input.category, config);

        if (config.key === "child") {
          const narrativeAudit = auditCustomerFacingChildReport([], narrative);
          const depthAudit = auditChildReportDepth([], config.outline, narrative);
          if (narrativeAudit.ok && depthAudit.ok) break;
          narrativeAttempt += 1;
          if (narrativeAttempt >= 4) {
            const detail = [...narrativeAudit.failures, ...depthAudit.failures].map((x) => x.issues.join("+")).join("|");
            throw new Error(`NARRATIVE_CUSTOMER_AUDIT_FAILED:${detail}`);
          }
          continue;
        }
        if (config.key === "couple") {
          const depthAudit = auditCoupleReportDepth([], config.outline, narrative);
          if (depthAudit.ok) break;
          narrativeAttempt += 1;
          if (narrativeAttempt >= 4) {
            const detail = depthAudit.failures.map((x) => x.issues.join("+")).join("|");
            throw new Error(`COUPLE_NARRATIVE_AUDIT_FAILED:${detail}`);
          }
          continue;
        }
        break;
      }
      const { data: latestAfterNarrative } = await sb.from("reports").select("report_json").eq("id", report.id).maybeSingle();
      currentJson = {
        ...(latestAfterNarrative?.report_json || currentJson),
        narrative,
        phase: "writing",
        progress: 22,
        background_running: true,
        background_heartbeat_at: Date.now(),
      };
      await sb.from("reports").update({ report_json: currentJson, generation_model: DEFAULT_MODEL, prompt_version: config.version }).eq("id", report.id);
    }

    const { data: existingRows, error: existingError } = await sb
      .from("report_sections")
      .select("section_no,content_html,content_json")
      .eq("report_id", report.id)
      .gte("section_no", 1)
      .lte("section_no", config.outline.length)
      .order("section_no", { ascending: true });
    if (existingError) throw new Error("SECTION_LIST_FAILED:" + existingError.message);

    const existingNos = new Set((existingRows || []).map((x: any) => Number(x.section_no)));
    const missing = config.outline.filter((x) => !existingNos.has(x.section_no));

    if (!missing.length) {
      const finalRepair = await repairCoupleFinalAuditIfNeeded(sb, report, config, narrative, currentJson);
      if (finalRepair.repaired) {
        return;
      }
      await updateProgressNow(sb, report.id, narrative, config, { background_last_error: null });
      const pdfResp = await fetch(pdfUrl, { cache: "no-store" });
      if (!pdfResp.ok) {
        const t = await pdfResp.text().catch(() => "");
        throw new Error(`PDF_${pdfResp.status}:${t.slice(0, 500)}`);
      }
      const { data: latest } = await sb.from("reports").select("report_json").eq("id", report.id).maybeSingle();
      await sb.from("reports").update({
        report_json: {
          ...(latest?.report_json || {}),
          background_running: false,
          background_finished_at: Date.now(),
          background_last_error: null,
        },
        error_message: null,
      }).eq("id", report.id);
      return;
    }

    const previousCandidates = (existingRows || []).map(qualityCandidateFromRow);
    const recentSummary = (existingRows || []).slice(-12).map((r: any) => ({
      section_no: r.section_no,
      opening_sentence: r.content_json?.opening_sentence || "",
      key_basis: r.content_json?.key_basis || [],
      action_point: r.content_json?.action_point || "",
    }));

    // 동시에 12개 슬롯을 유지한다. 하나가 끝나는 즉시 같은 worker가 다음 SECTION을 잡는다.
    // 가장 느린 SECTION 때문에 나머지 슬롯이 쉬는 기존 wave barrier를 제거한다.
    let cursor = 0;
    const recentChildPlans: any[] = [];
    const recentCouplePlans: any[] = config.key === "couple"
      ? (existingRows || []).slice(-20).map((r:any) => ({
          section_no:Number(r?.section_no||0),
          main_thesis:r?.content_json?.opening_sentence || "",
          daily_scenes:Array.isArray(r?.content_json?.life_scenes)?r.content_json.life_scenes:[],
          repair_actions:Array.isArray(r?.content_json?.repair_actions)?r.content_json.repair_actions:[],
          new_information:[],
          scene_domains_used:[],
        }))
      : [];
    let progressSerial: Promise<any> = Promise.resolve();

    const queueProgress = (extra: any = {}) => {
      progressSerial = progressSerial.then(() => updateProgressNow(sb, report.id, narrative, config, extra));
      return progressSerial;
    };

    const runOne = async (spec: ReportSectionSpec) => {
      const subset = evidenceSubset(generationCtx, [spec], {
        question: input.question,
        chapter1_summary: narrative?.chapter_theses?.["1"] || "",
        chapter2_summary: narrative?.chapter_theses?.["2"] || "",
        chapter2_material: narrative,
      });

      let candidate: any;
      let childPlan: any = null;
      let couplePlan: any = null;
      if (config.key === "child") {
        childPlan = await planChildSection({
          spec,
          calcSubset: subset,
          meaningContext: childMeaningContext,
          narrative,
          question: input.question,
          recentPlans: recentChildPlans,
        });
        recentChildPlans.push({
          section_no: spec.section_no,
          main_thesis: childPlan?.main_thesis || "",
          daily_scenes: (childPlan?.evidence_blocks || []).map((x:any) => x?.daily_scene).filter(Boolean),
          parent_actions: (childPlan?.evidence_blocks || []).map((x:any) => x?.parent_action).filter(Boolean),
        });
        if (recentChildPlans.length > 10) recentChildPlans.shift();
        candidate = await generateChildSection({
          spec,
          plan: childPlan,
          calcSubset: subset,
          narrative,
          question: input.question,
          recent: recentSummary,
        });
      } else if (config.key === "couple") {
        couplePlan = await planCoupleSection({
          spec,
          calcSubset: subset,
          narrative,
          meaning: coupleMeaningContext,
          question: input.question,
          recentPlans: recentCouplePlans,
        });
        recentCouplePlans.push({
          section_no: spec.section_no,
          main_thesis: couplePlan?.main_thesis || "",
          daily_scenes: (couplePlan?.interaction_blocks || []).map((x:any) => x?.daily_scene).filter(Boolean),
          repair_actions: (couplePlan?.interaction_blocks || []).map((x:any) => x?.repair_action).filter(Boolean),
          new_information: couplePlan?.new_information || [],
          scene_domains_used: couplePlan?.scene_domains_used || [],
        });
        if (recentCouplePlans.length > 20) recentCouplePlans.shift();
        candidate = await generateCoupleSection({
          spec,
          plan: couplePlan,
          calcSubset: subset,
          narrative,
          question: input.question,
          recent: recentSummary,
        });
      } else {
        const generated = await generateSectionBatch({
          specs: [spec],
          calcSubset: subset,
          narrative,
          question: input.question,
          category: input.category,
          recent: recentSummary,
          reportTitle: config.title,
          reportFocus: config.focus,
        });
        candidate = (generated || []).find((g: any) => Number(g.section_no) === spec.section_no) || generated?.[0];
      }
      if (!candidate?.content_html) throw new Error(`MISSING_SECTION_${spec.section_no}`);

      const minimum = spec.target_chars[0];
      let validation = validateGeneratedSection({ candidate, minChars: minimum, previous: previousCandidates });
      let customerValidation = config.key === "child"
        ? validateCustomerFacingChildSection(candidate)
        : { ok: true, issues: [] as string[] };
      let depthValidation = config.key === "child"
        ? validateChildSectionDepth({ spec, candidate, plan: childPlan })
        : config.key === "couple"
          ? validateCoupleSectionDepth({ spec, candidate, plan: couplePlan })
          : { ok: true, issues: [] as string[] };
      let rewriteCount = 0;

      const MAX_REWRITES = (config.key === "child" || config.key === "couple") ? 4 : 1;
      while ((!validation.ok || !customerValidation.ok || !depthValidation.ok) && rewriteCount < MAX_REWRITES) {
        const callsNeeded = rewriteCount === 2 && (config.key === "child" || config.key === "couple") ? 2 : 1;
        if (Date.now() - startedAt + callsNeeded * OPENAI_TIMEOUT_MS > 280_000) break;
        const allIssues = [...validation.issues, ...customerValidation.issues, ...depthValidation.issues];
        if (config.key === "child") {
          // If the plan itself caused shallow output, rebuild it once before the final rewrite attempts.
          if (rewriteCount === 2) {
            childPlan = await planChildSection({
              spec,
              calcSubset: subset,
              meaningContext: childMeaningContext,
              narrative,
              question: input.question,
              recentPlans: recentChildPlans,
            });
          }
          candidate = await generateChildSection({
            spec,
            plan: childPlan,
            calcSubset: subset,
            narrative,
            question: input.question,
            recent: recentSummary,
            previousCandidate: candidate,
            issues: allIssues,
          });
        } else if (config.key === "couple") {
          if (rewriteCount === 2) {
            couplePlan = await planCoupleSection({
              spec,
              calcSubset: subset,
              narrative,
              meaning: coupleMeaningContext,
              question: input.question,
              recentPlans: recentCouplePlans,
            });
          }
          candidate = await generateCoupleSection({
            spec,
            plan: couplePlan,
            calcSubset: subset,
            narrative,
            question: input.question,
            recent: recentSummary,
            previousCandidate: candidate,
            issues: allIssues,
          });
        } else {
          const rewritten = await rewriteSection({
            spec,
            calcSubset: subset,
            narrative,
            question: input.question,
            candidate,
            issues: allIssues,
            recent: recentSummary,
            reportTitle: config.title,
            reportFocus: config.focus,
          });
          if (!rewritten?.content_html) break;
          candidate = rewritten;
        }
        rewriteCount += 1;
        validation = validateGeneratedSection({ candidate, minChars: minimum, previous: previousCandidates });
        customerValidation = config.key === "child"
          ? validateCustomerFacingChildSection(candidate)
          : { ok: true, issues: [] as string[] };
        depthValidation = config.key === "child"
          ? validateChildSectionDepth({ spec, candidate, plan: childPlan })
          : config.key === "couple"
            ? validateCoupleSectionDepth({ spec, candidate, plan: couplePlan })
            : { ok: true, issues: [] as string[] };
      }

      const fatalIssues = [
        ...validation.issues.filter((issue) => issue.startsWith("TOO_SHORT_") || issue === "NO_FACT_BASIS"),
        ...customerValidation.issues,
        ...depthValidation.issues,
      ];
      if (fatalIssues.length) throw new Error(`QUALITY_${spec.section_no}:${[...new Set(fatalIssues)].join(",")}`);

      await saveAcceptedSection(sb, report.id, spec, candidate, rewriteCount, [...validation.issues, ...depthValidation.issues], config.version);
      acceptedCount += 1;
      previousCandidates.push({
        opening_sentence: candidate.opening_sentence || "",
        content_html: candidate.content_html || "",
        key_basis: Array.isArray(candidate.key_basis) ? candidate.key_basis : [],
        life_scenes: Array.isArray(candidate.life_scenes) ? candidate.life_scenes : [],
        action_point: candidate.action_point || "",
      });
      recentSummary.push({
        section_no: spec.section_no,
        opening_sentence: candidate.opening_sentence || "",
        key_basis: Array.isArray(candidate.key_basis) ? candidate.key_basis : [],
        action_point: candidate.action_point || "",
      });
      if (recentSummary.length > 12) recentSummary.shift();

      await queueProgress({ background_last_error: null, last_completed_section: spec.section_no });
    };
    const worker = async (workerNo: number) => {
      while (true) {
        // Vercel 300초 제한에 걸리지 않도록 늦은 시점에는 새 SECTION을 시작하지 않는다.
        if (Date.now() - startedAt >= WORK_START_CUTOFF_MS) return;
        const index = cursor++;
        if (index >= missing.length) return;
        const spec = missing[index];
        try {
          await runOne(spec);
        } catch (e: any) {
          failures.push(`S${spec.section_no}/W${workerNo}:${e?.message || String(e)}`);
          // 실패 SECTION 하나 때문에 worker 전체를 멈추지 않고 바로 다음 SECTION을 진행한다.
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(PARALLEL_WORKERS, missing.length) }, (_, i) => worker(i + 1)));
    await progressSerial;

    const state = await updateProgressNow(sb, report.id, narrative, config, {
      last_slice_saved: acceptedCount,
      quality_failures: failures.slice(-10),
      background_last_error: failures.length ? failures.join(" | ").slice(0, 1200) : null,
    });

    // Give PDF rendering its own fresh invocation and full time budget.
    if (state.done) return;

    const noProgressCount = acceptedCount ? 0 : Number(currentJson.background_no_progress_count || 0) + 1;
    const { data: latest } = await sb.from("reports").select("report_json").eq("id", report.id).maybeSingle();
    await sb.from("reports").update({
      report_json: {
        ...(latest?.report_json || {}),
        background_running: noProgressCount < 6,
        background_heartbeat_at: Date.now(),
        background_no_progress_count: noProgressCount,
        background_last_error: failures.length ? failures.join(" | ").slice(0, 1200) : null,
      },
      error_message: noProgressCount >= 6 ? "연속 생성 실패로 자동 생성이 중단되었습니다. 다시 시작해 주세요." : null,
    }).eq("id", report.id);

  } catch (e: any) {
    console.error("REPORT_BACKGROUND_SLICE_ERROR", e);
    try {
      const order = await loadOrderForToken(sb, token);
      const { data: report } = await sb.from("reports").select("id,report_json").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (report) {
        const j: any = report.report_json || {};
        await sb.from("reports").update({
          report_json: {
            ...j,
            background_running: false,
            background_heartbeat_at: Date.now(),
            background_last_error: e?.message || String(e),
          },
          error_message: (e?.message || String(e)).slice(0, 3000),
        }).eq("id", report.id);
      }
    } catch (inner) {
      console.error("REPORT_BACKGROUND_ERROR_SAVE_FAILED", inner);
    }
    throw e;
  }
  finally {
    if (heldOrder && lease) await releaseGeneration(sb, heldOrder.id, lease.id);
  }
}

async function runQueuedGeneration(job: ReportJob, token: string, requestUrl: string) {
  const sb = admin();
  let failure: string | undefined;
  let busy = false;
  try {
    const result = await runGenerationSlice(token, requestUrl);
    busy = result?.busy === true;
  } catch (e: any) {
    failure = e?.message || String(e);
  }
  const order = await loadOrderForToken(sb, token);
  const { data: report, error } = await sb.from("reports").select("*").eq("order_id", order.id)
    .order("created_at", { ascending:false }).limit(1).maybeSingle();
  if (error) throw new Error("REPORT_QUEUE_RESULT_LOOKUP_FAILED"); // Expired dispatch is recovered by the clock.
  const state = reportState(report, order.products);
  const permanent = /LEGACY_REPORT_REVIEW_REQUIRED|FINAL_AUDIT_REPAIR_EXHAUSTED|PDF_.*CONTENT_AUDIT_FAILED/.test(failure || "")
    || Number(report?.report_json?.background_no_progress_count) >= 6;
  const decision = await settleReportJob(sb, job, { ready:state.ready, error:failure, permanent, busy });
  if (report && !state.ready && !busy) {
    const j = report.report_json || {};
    const { error: saveError } = await sb.from("reports").update({
      error_message: decision.status === "failed" ? "자동 복구 횟수를 초과했습니다. 기존 내용은 보존되어 있습니다. 다시 시도하거나 고객센터로 문의해 주세요." : null,
      report_json:{ ...j, background_running:decision.status === "queued", background_heartbeat_at:Date.now(),
        background_last_error:failure || j.background_last_error || null },
    }).eq("id", report.id);
    if (saveError) console.error("REPORT_QUEUE_STATUS_SAVE_FAILED", saveError.message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(token)) return J({ ok: false, error: "INVALID_TOKEN" }, 400);
    if (body.internal === true && !validWorker(req, token)) return J({ ok: false, error: "WORKER_ONLY" }, 403);
    const sb = admin();
    const order = await loadOrderForToken(sb, token);
    const { data: report, error } = await sb.from("reports").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error("REPORT_LOOKUP_FAILED");
    const state = reportState(report, order.products);
    if (body.dispatch_id) {
      const dispatchId = String(body.dispatch_id);
      if (!/^[0-9a-fA-F-]{36}$/.test(dispatchId)) return J({ ok:false, error:"INVALID_DISPATCH" }, 403);
      const job = await claimDispatchedJob(sb, order.id, dispatchId);
      if (!job) return J({ ok:false, error:"INVALID_DISPATCH" }, 403);
      after(() => runQueuedGeneration(job, token, req.url));
      return J({ ok:true, status:"dispatched" }, 202);
    }
    if (state.ready) return J({ ok: true, status: "completed", progress: 100, completed_sections: state.completed, total_sections: state.total, pdf_ready: true });
    if (report && report.prompt_version !== getReportCategoryConfig(order.products).version) return J({ ok: false, error: "LEGACY_REPORT_REVIEW_REQUIRED", detail: "기존 리포트는 보존되어 있습니다. 이전 버전의 생성 복구는 고객센터로 문의해 주세요." }, 409);
    if (body.background === true || body.internal === true) {
      const queued = await enqueueReportJob(sb, order.id, body.retry === true);
      if (queued.status === "failed") return J({ ok:false, error:"REPORT_RETRY_REQUIRED", detail:"자동 복구가 중단되었습니다. 다시 시도하거나 고객센터로 문의해 주세요." }, 409);
      if (queued.retried && report) {
        await sb.from("reports").update({ error_message:null, report_json:{ ...report.report_json, background_no_progress_count:0 } }).eq("id", report.id);
      }
    }
    return J({ ok: true, status: "generating", completed_sections: state.completed, total_sections: state.total, pdf_ready: false }, 202);
  } catch (e: any) {
    const status = e.message === "ORDER_NOT_FOUND" ? 404 : e.message === "ORDER_NOT_PAID" ? 409 : 500;
    console.error("REPORT_GENERATE_ERROR", e.message);
    return J({ ok: false, error: "REPORT_GENERATION_FAILED", detail: e.message }, status);
  }
}

export async function GET() {
  return J({
    ok: true,
    route: "report/generate",
    mode: "durable-database-queue-v1",
    parallel_workers: PARALLEL_WORKERS,
    supported_categories: ["life-report", "child-report", "couple-compatibility", "parent-child-compatibility", "new-year"],
    model: DEFAULT_MODEL,
  });
}
