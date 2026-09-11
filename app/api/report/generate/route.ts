import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calcSaju, calcLuckData } from "@/lib/saju-engine";
import {
  REPORT_OUTLINE,
  REPORT_TOTAL_SECTIONS,
  REPORT_VERSION,
  type ReportSectionSpec,
} from "@/lib/report-spec";
import {
  buildPersonNarrativePrompt,
  buildRewritePrompt,
  buildSectionPrompt,
} from "@/lib/report-prompts";
import { validateGeneratedSection, type QualityCandidate } from "@/lib/report-quality";

export const runtime = "nodejs";
export const maxDuration = 300;

const PARALLEL_WORKERS = 6;
const WAVE_SIZE = 18;
const PROMPT_VERSION = REPORT_VERSION;
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

function normalizeInput(raw: any) {
  const calendar = raw.calendar_type || raw.calendar || raw.cal || "solar";
  const genderRaw = raw.gender || raw.g || "";
  const gender = genderRaw === "male" || genderRaw === "남" ? "남" : genderRaw === "female" || genderRaw === "여" ? "여" : "";
  const regionName = raw.region_name || raw.regionName || raw.region_text || null;
  const longitude = toNumber(raw.longitude ?? raw.region, null);
  const timeUnknown = raw.unknown_time === true || raw.time_unknown === true || raw.unknown_time === "true";
  return {
    year: toNumber(raw.y ?? raw.year),
    month: toNumber(raw.m ?? raw.month),
    day: toNumber(raw.d ?? raw.day),
    hour: timeUnknown ? null : toNumber(raw.h ?? raw.hour),
    minute: timeUnknown ? 0 : (toNumber(raw.mi ?? raw.minute, 0) || 0),
    calendar_type: calendar,
    gender,
    time_unknown: timeUnknown,
    longitude,
    region_name: regionName,
    question: String(raw.question || "").trim(),
    category: String(raw.qcat || raw.category || "").trim(),
  };
}

function currentDaeun(calc: any) {
  const currentAge = new Date().getFullYear() - Number(calc?.birth_solar?.year || 0);
  return (calc?.daeun || []).find((x: any) => currentAge >= x.age_start && currentAge <= x.age_end) || null;
}

function pillarText(p: any) {
  return p ? `${p.gan}${p.ji}` : "미확정";
}

function calcContext(calc: any, input: any) {
  const p = calc?.saju || {};
  const luck = calcLuckData(calc, CURRENT_FLOW_YEAR);
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

  const resp = await fetch("https://api.openai.com/v1/responses", {
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
      max_output_tokens: args.maxTokens || 18000,
    }),
  });

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

async function generateNarrative(calcCtx: any, question: string, category: string) {
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
    user: buildPersonNarrativePrompt(calcCtx, question, category),
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
    maxTokens: 18000,
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
    maxTokens: 9000,
  });
}

async function ensureInitialized(sb: any, order: any, input: any) {
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
    .select("id,calculation_json")
    .eq("birth_profile_id", birthProfileId)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
    }).select("id,calculation_json").single();
    if (error) {
      // Another request may have inserted the same deterministic calculation first.
      const { data: existing } = await sb.from("saju_calculations")
        .select("id,calculation_json")
        .eq("birth_profile_id", birthProfileId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!existing) throw new Error("CALC_CREATE_FAILED:" + error.message);
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
      title: "종합 인생 리포트",
      status: "generating",
      summary: input.question ? `질문: ${input.question}` : null,
      report_json: { total_sections: REPORT_TOTAL_SECTIONS, completed_sections: 0, progress: 12, phase: "calculation_done", pdf_ready: false },
      generation_model: DEFAULT_MODEL,
      prompt_version: PROMPT_VERSION,
    }).select("*").single();
    if (error) throw new Error("REPORT_CREATE_FAILED:" + error.message);
    report = r;
  }

  return { birthProfileId, questionId, calcRow, report };
}

async function resetLegacyReportIfNeeded(sb: any, report: any) {
  if (report.prompt_version === PROMPT_VERSION) return report;
  const oldJson: any = report.report_json || {};
  if (oldJson.pdf_storage_path) {
    await sb.storage.from("report-pdfs").remove([oldJson.pdf_storage_path]).catch(() => null);
  }
  await sb.from("report_sections").delete().eq("report_id", report.id);
  const resetJson = {
    total_sections: REPORT_TOTAL_SECTIONS,
    completed_sections: 0,
    progress: 12,
    phase: "calculation_done",
    pdf_ready: false,
    migrated_from: report.prompt_version || "legacy",
  };
  const { data: updated, error } = await sb.from("reports").update({
    status: "generating",
    generated_at: null,
    report_json: resetJson,
    generation_model: DEFAULT_MODEL,
    prompt_version: PROMPT_VERSION,
    error_message: null,
  }).eq("id", report.id).select("*").single();
  if (error) throw new Error("REPORT_VERSION_RESET_FAILED:" + error.message);
  return updated;
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

export async function POST(req: Request) {
  const sb = admin();
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(token)) return J({ ok:false, error:"INVALID_TOKEN" }, 400);

    const { data: order, error: orderError } = await sb
      .from("orders")
      .select("id,user_id,product_id,birth_profile_id,question_id,status,payment_payload,guest_access_token,products(slug,name,report_type)")
      .eq("guest_access_token", token)
      .maybeSingle();
    if (orderError || !order) return J({ ok:false, error:"ORDER_NOT_FOUND" }, 404);
    if (order.status !== "paid") return J({ ok:false, error:"ORDER_NOT_PAID" }, 409);

    const rawInput = (order.payment_payload as any)?.guest_input || {};
    const input = normalizeInput(rawInput);
    const init = await ensureInitialized(sb, order, input);
    let report = await resetLegacyReportIfNeeded(sb, init.report);
    let currentJson: any = report.report_json || {};

    if (report.status === "completed" && currentJson.pdf_storage_path && currentJson.pdf_ready !== false) {
      return J({ ok:true, status:"completed", progress:100, completed_sections:REPORT_TOTAL_SECTIONS, total_sections:REPORT_TOTAL_SECTIONS, report_id:report.id, pdf_ready:true });
    }

    const calcCtx = calcContext(init.calcRow.calculation_json, input);

    let narrative = currentJson.narrative;
    if (!narrative) {
      await sb.from("reports").update({ report_json: { ...currentJson, phase:"core_analysis", progress:18, total_sections:REPORT_TOTAL_SECTIONS, completed_sections:0, pdf_ready:false } }).eq("id", report.id);
      narrative = await generateNarrative(calcCtx, input.question, input.category);
      currentJson = { ...currentJson, narrative, phase:"writing", progress:22 };
      await sb.from("reports").update({ report_json: currentJson, generation_model:DEFAULT_MODEL, prompt_version:PROMPT_VERSION }).eq("id", report.id);
    }

    const { data: existingRows, error: existingError } = await sb
      .from("report_sections")
      .select("section_no,content_html,content_json")
      .eq("report_id", report.id)
      .order("section_no", { ascending:true });
    if (existingError) throw new Error("SECTION_LIST_FAILED:" + existingError.message);

    const existingNos = new Set((existingRows || []).map((x:any) => Number(x.section_no)));
    const allMissing = REPORT_OUTLINE.filter((x) => !existingNos.has(x.section_no));
    const completedBefore = REPORT_TOTAL_SECTIONS - allMissing.length;

    if (!allMissing.length) {
      await sb.from("reports").update({
        status:"generating",
        report_json:{ ...currentJson, narrative, total_sections:REPORT_TOTAL_SECTIONS, completed_sections:REPORT_TOTAL_SECTIONS, progress:97, phase:"pdf_queued", pdf_ready:false },
        generation_model:DEFAULT_MODEL,
        prompt_version:PROMPT_VERSION,
        error_message:null,
      }).eq("id", report.id);
      return J({ ok:true, status:"generating", progress:97, completed_sections:REPORT_TOTAL_SECTIONS, total_sections:REPORT_TOTAL_SECTIONS, report_id:report.id, pdf_ready:false, phase:"pdf_queued" });
    }

    const wave = allMissing.slice(0, WAVE_SIZE);
    const workerCount = Math.min(PARALLEL_WORKERS, Math.ceil(wave.length / 3));
    const chunks: ReportSectionSpec[][] = Array.from({ length: workerCount }, () => []);
    wave.forEach((item, index) => chunks[index % workerCount].push(item));

    await sb.from("reports").update({
      status:"generating",
      generated_at:null,
      report_json:{
        ...currentJson,
        narrative,
        total_sections:REPORT_TOTAL_SECTIONS,
        completed_sections:completedBefore,
        progress:Math.max(22, Math.round(24 + (completedBefore / REPORT_TOTAL_SECTIONS) * 70)),
        phase:"writing",
        pdf_ready:false,
      },
      generation_model:DEFAULT_MODEL,
      prompt_version:PROMPT_VERSION,
      error_message:null,
    }).eq("id", report.id);

    const previousCandidates = (existingRows || []).map(qualityCandidateFromRow);
    const recentSummary = (existingRows || []).slice(-12).map((r:any) => ({
      section_no: r.section_no,
      opening_sentence: r.content_json?.opening_sentence || "",
      key_basis: r.content_json?.key_basis || [],
      action_point: r.content_json?.action_point || "",
    }));

    const workerResults = await Promise.allSettled(chunks.map(async (chunk) => {
      const subset = evidenceSubset(calcCtx, chunk, {
        question: input.question,
        chapter1_summary: narrative?.chapter_theses?.["1"] || "",
        chapter2_summary: narrative?.chapter_theses?.["2"] || "",
        chapter2_material: narrative,
      });
      return generateSectionBatch({ specs:chunk, calcSubset:subset, narrative, question:input.question, category:input.category, recent:recentSummary });
    }));

    const generatedMap = new Map<number, any>();
    const failures: string[] = [];
    workerResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        for (const g of result.value || []) generatedMap.set(Number(g.section_no), g);
      } else failures.push(`W${index + 1}:${result.reason?.message || String(result.reason)}`);
    });

    const accepted: Array<{ spec: ReportSectionSpec; content: any; rewriteCount: number; qualityIssues: string[] }> = [];
    const runningPrevious = [...previousCandidates];

    for (const spec of wave) {
      let candidate = generatedMap.get(spec.section_no);
      if (!candidate?.content_html) {
        failures.push(`MISSING_SECTION_${spec.section_no}`);
        continue;
      }
      const minimum = Math.floor(spec.target_chars[0] * 0.72);
      let validation = validateGeneratedSection({ candidate, minChars:minimum, previous:runningPrevious });
      let rewriteCount = 0;

      if (!validation.ok) {
        try {
          const subset = evidenceSubset(calcCtx, [spec], {
            question: input.question,
            chapter1_summary: narrative?.chapter_theses?.["1"] || "",
            chapter2_summary: narrative?.chapter_theses?.["2"] || "",
            chapter2_material: narrative,
          });
          const rewritten = await rewriteSection({ spec, calcSubset:subset, narrative, question:input.question, candidate, issues:validation.issues, recent:recentSummary });
          if (rewritten?.content_html) {
            candidate = rewritten;
            rewriteCount = 1;
            validation = validateGeneratedSection({ candidate, minChars:minimum, previous:runningPrevious });
          }
        } catch (e:any) {
          failures.push(`REWRITE_${spec.section_no}:${e?.message || String(e)}`);
        }
      }

      accepted.push({ spec, content:candidate, rewriteCount, qualityIssues:validation.issues });
      runningPrevious.push(candidate);
    }

    if (accepted.length) {
      const rows = accepted.map(({ spec, content, rewriteCount, qualityIssues }) => ({
        report_id: report.id,
        section_no: spec.section_no,
        part_no: spec.part_no,
        part_title: spec.part_title,
        section_title: spec.section_title,
        content_html: content.content_html,
        content_json: {
          opening_sentence: content.opening_sentence || "",
          key_basis: Array.isArray(content.key_basis) ? content.key_basis : [],
          life_scenes: Array.isArray(content.life_scenes) ? content.life_scenes : [],
          risk: content.risk || "",
          action_point: content.action_point || "",
          emphasis: content.emphasis || "",
          layout_type: content.layout_type || spec.layout_type,
          checklist: Array.isArray(content.checklist) ? content.checklist : [],
          table_rows: Array.isArray(content.table_rows) ? content.table_rows : [],
          quality_score: qualityIssues.length ? 0.78 : 0.96,
          quality_issues: qualityIssues,
          rewrite_count: rewriteCount,
          prompt_version: PROMPT_VERSION,
        },
      }));
      const { error: saveError } = await sb.from("report_sections").upsert(rows, { onConflict:"report_id,section_no" });
      if (saveError) {
        for (const row of rows) {
          await sb.from("report_sections").delete().eq("report_id", report.id).eq("section_no", row.section_no);
          const { error } = await sb.from("report_sections").insert(row);
          if (error) throw new Error(`SECTION_${row.section_no}_SAVE_FAILED:${error.message}`);
        }
      }
    }

    const { count: finalCount, error: countError } = await sb.from("report_sections")
      .select("id", { count:"exact", head:true }).eq("report_id", report.id);
    if (countError) throw new Error("FINAL_SECTION_COUNT_FAILED:" + countError.message);
    const completed = finalCount || 0;
    const done = completed >= REPORT_TOTAL_SECTIONS;
    const progress = done ? 97 : Math.min(95, Math.round(24 + (completed / REPORT_TOTAL_SECTIONS) * 70));

    await sb.from("reports").update({
      status:"generating",
      report_json:{
        ...currentJson,
        narrative,
        total_sections:REPORT_TOTAL_SECTIONS,
        completed_sections:completed,
        progress,
        phase:done ? "pdf_queued" : "writing",
        pdf_ready:false,
        last_wave_size:accepted.length,
        quality_failures:failures.slice(-10),
      },
      generation_model:DEFAULT_MODEL,
      prompt_version:PROMPT_VERSION,
      error_message:failures.length ? failures.join(" | ").slice(0,3000) : null,
    }).eq("id", report.id);

    if (!accepted.length && failures.length) throw new Error("WAVE_GENERATION_FAILED:" + failures.join(" | ").slice(0,2500));

    return J({
      ok:true,
      status:"generating",
      progress,
      completed_sections:completed,
      total_sections:REPORT_TOTAL_SECTIONS,
      report_id:report.id,
      pdf_ready:false,
      phase:done ? "pdf_queued" : "writing",
      generated_this_wave:accepted.length,
      failed_items:failures.length,
    });
  } catch (e:any) {
    console.error("REPORT_GENERATE_ERROR", e);
    return J({ ok:false, error:"REPORT_GENERATION_FAILED", detail:e?.message || String(e) }, 500);
  }
}

export async function GET() {
  return J({ ok:true, route:"report/generate", mode:"aqua-50-wave", wave_size:WAVE_SIZE, parallel_workers:PARALLEL_WORKERS, total_sections:REPORT_TOTAL_SECTIONS, prompt_version:PROMPT_VERSION, model:DEFAULT_MODEL });
}
