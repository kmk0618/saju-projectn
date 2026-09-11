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
import { validateGeneratedSection, type QualityCandidate } from "@/lib/report-quality";

export const runtime = "nodejs";
export const maxDuration = 300;

const PARALLEL_WORKERS = 12;
const OPENAI_TIMEOUT_MS = 75_000;
// 새 작업을 시작하는 시간 한도. 한 SECTION이 생성+재작성까지 최악의 경우 약 150초 걸릴 수 있어
// Vercel 300초 제한 안에 안전하게 끝나도록 110초까지만 새 작업을 투입한다.
const WORK_START_CUTOFF_MS = 110_000;
const BACKGROUND_STALE_MS = 4 * 60 * 1000;
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

async function resetLegacyReportIfNeeded(sb: any, report: any, config: ReportCategoryConfig) {
  if (report.prompt_version === config.version) return report;
  const oldJson: any = report.report_json || {};
  if (oldJson.pdf_storage_path) {
    await sb.storage.from("report-pdfs").remove([oldJson.pdf_storage_path]).catch(() => null);
  }
  await sb.from("report_sections").delete().eq("report_id", report.id);
  const resetJson = {
    total_sections: config.outline.length,
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
    prompt_version: config.version,
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

async function kickWorker(generateUrl: string, token: string) {
  try {
    const resp = await fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-report-worker": "1" },
      body: JSON.stringify({ token, internal: true }),
      cache: "no-store",
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("REPORT_WORKER_KICK_HTTP_ERROR", resp.status, t.slice(0, 500));
    }
  } catch (e) {
    console.error("REPORT_WORKER_KICK_FAILED", e);
  }
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
      prompt_version: promptVersion,
    },
  };

  const { error: upsertError } = await sb.from("report_sections").upsert(row, { onConflict: "report_id,section_no" });
  if (!upsertError) return;

  await sb.from("report_sections").delete().eq("report_id", reportId).eq("section_no", spec.section_no);
  const { error: insertError } = await sb.from("report_sections").insert(row);
  if (insertError) throw new Error(`SECTION_${spec.section_no}_SAVE_FAILED:${insertError.message}`);
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
  }).eq("id", reportId);
  return { completed, done, progress };
}

async function runGenerationSlice(token: string, requestUrl: string) {
  const sb = admin();
  const generateUrl = new URL("/api/report/generate", requestUrl).toString();
  const pdfUrl = new URL(`/api/report/pdf?token=${encodeURIComponent(token)}`, requestUrl).toString();
  const startedAt = Date.now();
  const failures: string[] = [];
  let acceptedCount = 0;

  try {
    const order = await loadOrderForToken(sb, token);
    const config = getReportCategoryConfig(order.products);
    const rawInput = (order.payment_payload as any)?.guest_input || {};
    const input = normalizeInput(rawInput);
    const init = await ensureInitialized(sb, order, input, config);
    let report = await resetLegacyReportIfNeeded(sb, init.report, config);
    let currentJson: any = report.report_json || {};

    if (report.status === "completed" && currentJson.pdf_storage_path && currentJson.pdf_ready !== false) {
      return;
    }

    const calcCtx = calcContext(init.calcRow.calculation_json, input);
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
      narrative = await generateNarrative(calcCtx, input.question, input.category, config);
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
    let progressSerial: Promise<any> = Promise.resolve();

    const queueProgress = (extra: any = {}) => {
      progressSerial = progressSerial.then(() => updateProgressNow(sb, report.id, narrative, config, extra));
      return progressSerial;
    };

    const runOne = async (spec: ReportSectionSpec) => {
      const subset = evidenceSubset(calcCtx, [spec], {
        question: input.question,
        chapter1_summary: narrative?.chapter_theses?.["1"] || "",
        chapter2_summary: narrative?.chapter_theses?.["2"] || "",
        chapter2_material: narrative,
      });

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
      let candidate = (generated || []).find((g: any) => Number(g.section_no) === spec.section_no) || generated?.[0];
      if (!candidate?.content_html) throw new Error(`MISSING_SECTION_${spec.section_no}`);

      const minimum = spec.target_chars[0];
      let validation = validateGeneratedSection({ candidate, minChars: minimum, previous: previousCandidates });
      let rewriteCount = 0;

      if (!validation.ok) {
        const rewritten = await rewriteSection({
          spec,
          calcSubset: subset,
          narrative,
          question: input.question,
          candidate,
          issues: validation.issues,
          recent: recentSummary,
          reportTitle: config.title,
          reportFocus: config.focus,
        });
        if (rewritten?.content_html) {
          candidate = rewritten;
          rewriteCount = 1;
          validation = validateGeneratedSection({ candidate, minChars: minimum, previous: previousCandidates });
        }
      }

      const fatalIssues = validation.issues.filter((issue) => issue.startsWith("TOO_SHORT_") || issue === "NO_FACT_BASIS");
      if (fatalIssues.length) throw new Error(`QUALITY_${spec.section_no}:${fatalIssues.join(",")}`);

      await saveAcceptedSection(sb, report.id, spec, candidate, rewriteCount, validation.issues, config.version);
      acceptedCount += 1;
      // 다음 SECTION들의 중복 검사에도 방금 완성된 결과를 바로 반영한다.
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

    if (state.done) {
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

    if (noProgressCount < 6) {
      // 다음 invocation은 즉시 202를 반환하고 자체 after()에서 다음 slice를 실행한다.
      // 따라서 현재 invocation이 자식 작업 완료까지 기다리면서 300초를 초과하지 않는다.
      await kickWorker(generateUrl, token);
    }
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
  }
}

export async function POST(req: Request) {
  const sb = admin();
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const internal = body?.internal === true;
    const background = body?.background === true;
    if (!/^[0-9a-fA-F-]{36}$/.test(token)) return J({ ok: false, error: "INVALID_TOKEN" }, 400);

    if (internal) {
      if (req.headers.get("x-report-worker") !== "1") return J({ ok: false, error: "WORKER_ONLY" }, 403);
      // 중요: 내부 체인 호출은 오래 일하지 않고 즉시 202를 반환한다.
      // 실제 12병렬 작업은 이 invocation의 after()에서 실행되므로 부모 self-fetch가 자식 완료를 기다리지 않는다.
      after(async () => {
        await runGenerationSlice(token, req.url);
      });
      return J({ ok: true, status: "worker_accepted" }, 202);
    }

    const order = await loadOrderForToken(sb, token);
    const config = getReportCategoryConfig(order.products);
    const rawInput = (order.payment_payload as any)?.guest_input || {};
    const input = normalizeInput(rawInput);
    const init = await ensureInitialized(sb, order, input, config);
    const report = await resetLegacyReportIfNeeded(sb, init.report, config);
    const currentJson: any = report.report_json || {};

    if (report.status === "completed" && currentJson.pdf_storage_path && currentJson.pdf_ready !== false) {
      return J({
        ok: true,
        status: "completed",
        progress: 100,
        completed_sections: config.outline.length,
        total_sections: config.outline.length,
        report_id: report.id,
        pdf_ready: true,
      });
    }

    const totalSections = config.outline.length;
    const completed = await sectionCount(sb, report.id, totalSections);
    const progress = Math.min(95, Math.max(Number(currentJson.progress || 12), Math.round(24 + (completed / totalSections) * 70)));

    if (background) {
      const heartbeatAt = Number(currentJson.background_heartbeat_at || currentJson.background_started_at || 0);
      const stillRunning = currentJson.background_running === true && (Date.now() - heartbeatAt) < BACKGROUND_STALE_MS;

      if (!stillRunning) {
        const nextJson = {
          ...currentJson,
          total_sections: config.outline.length,
          completed_sections: completed,
          progress,
          background_running: true,
          background_started_at: Date.now(),
          background_heartbeat_at: Date.now(),
          background_last_error: null,
          background_no_progress_count: 0,
        };
        await sb.from("reports").update({ report_json: nextJson, error_message: null }).eq("id", report.id);
        const generateUrl = new URL("/api/report/generate", req.url).toString();
        after(async () => {
          await kickWorker(generateUrl, token);
        });
      }

      return J({
        ok: true,
        status: stillRunning ? "background_running" : "background_started",
        progress,
        completed_sections: completed,
        total_sections: config.outline.length,
        report_id: report.id,
        pdf_ready: currentJson.pdf_ready === true,
      }, 202);
    }

    // 상태 조회 성격으로 POST가 들어와도 생성 자체는 브라우저가 담당하지 않는다.
    return J({
      ok: true,
      status: currentJson.pdf_ready === true ? "completed" : "generating",
      progress,
      completed_sections: completed,
      total_sections: config.outline.length,
      report_id: report.id,
      pdf_ready: currentJson.pdf_ready === true,
      phase: currentJson.phase || "writing",
    });
  } catch (e: any) {
    console.error("REPORT_GENERATE_ERROR", e);
    const code = e?.message === "ORDER_NOT_FOUND" ? 404 : e?.message === "ORDER_NOT_PAID" ? 409 : 500;
    return J({ ok: false, error: "REPORT_GENERATION_FAILED", detail: e?.message || String(e) }, code);
  }
}

export async function GET() {
  return J({
    ok: true,
    route: "report/generate",
    mode: "aqua-multi-category-continuous-pool-background",
    parallel_workers: PARALLEL_WORKERS,
    supported_categories: ["life-report", "child-report", "couple-compatibility", "parent-child-compatibility", "new-year"],
    model: DEFAULT_MODEL,
  });
}
