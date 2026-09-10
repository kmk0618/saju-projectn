import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calcSaju } from "@/lib/saju-engine";
import { REPORT_OUTLINE, REPORT_TOTAL_SECTIONS } from "@/lib/report-outline";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 12;
const PROMPT_VERSION = "life-report-132-v1";
const DEFAULT_MODEL = process.env.OPENAI_REPORT_MODEL || "gpt-5.6-luna";

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
  const age = new Date().getFullYear() - Number(calc?.birth_solar?.year || 0);
  return (calc?.daeun || []).find((x: any) => age >= x.age_start && age <= x.age_end) || null;
}

function calcContext(calc: any) {
  const p = calc.saju || {};
  const pil = (x: any) => x ? `${x.gan}${x.ji}` : "미확정";
  const du = currentDaeun(calc);
  return {
    pillars: { year: pil(p.year), month: pil(p.month), day: pil(p.day), hour: pil(p.hour) },
    day_master: calc.ilgan,
    strength: calc.ilgan_strength,
    strength_pct: calc.strength_index?.pct,
    useful_god_candidates: calc.useful_god_candidates,
    five_elements: calc.ohaeng_distribution,
    weakest: calc.ohaeng_weakest,
    strongest: calc.ohaeng_strongest,
    lacking: calc.ohaeng_lacking,
    ten_gods: calc.sipseong_distribution,
    hidden_stems: calc.hidden_stems,
    twelve_stages: calc.twelve_stages,
    relations: calc.relations,
    sinsal: calc.sinsal,
    twelve_sinsal: calc.sibisinsal,
    daeun_direction: calc.daeun_direction,
    daeun: calc.daeun,
    current_daeun: du,
    birth_solar: calc.birth_solar,
    gender: calc.gender,
    zodiac: calc.ddi,
  };
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks: string[] = [];
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (typeof c?.text === "string") chunks.push(c.text);
    }
  }
  return chunks.join("\n").trim();
}

async function generateSectionsWithOpenAI(args: {
  outline: any[];
  calc: any;
  question: string;
  category: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("MISSING_OPENAI_API_KEY");

  const compactCalc = calcContext(args.calc);
  const requested = args.outline.map(x => ({
    section_no: x.section_no,
    part_no: x.part_no,
    part_title: x.part_title,
    section_title: x.section_title,
  }));

  const system = `당신은 대한민국 명리학 개인 리포트 전문 해설가입니다. 계산은 절대 하지 않습니다. 제공된 deterministic 계산 JSON만 사실값으로 사용합니다.\n\n규칙:\n1. 사주 원국, 대운, 오행, 십성, 신살을 임의로 만들거나 수정하지 마세요.\n2. 섹션마다 서로 다른 근거와 생활 장면을 사용하세요. 반복 템플릿 금지.\n3. 한자 용어는 처음 등장할 때 한국어 설명을 바로 붙이세요. 예: 己土(기토).\n4. 건강 내용은 생활 리듬과 전통적 참고 수준으로만 쓰고 진단하지 마세요.\n5. 운세는 단정적 예언이 아니라 경향, 기회, 주의 시점, 행동 기준으로 표현하세요.\n6. 각 섹션은 실제 유료 리포트 품질로 4~6개 문단, 약 550~850자 분량으로 작성하세요.\n7. 사용자의 질문이 관련되는 섹션에서는 질문을 구체적으로 연결하세요.\n8. content_html에는 <p>, <strong>, <ul>, <li> 정도만 사용하고 제목 태그는 넣지 마세요.`;

  const user = `아래 계산값과 사용자 질문을 기준으로 지정된 섹션만 작성하세요.\n\n[고정 계산값]\n${JSON.stringify(compactCalc)}\n\n[사용자 질문]\n분야: ${args.category || "미지정"}\n질문: ${args.question || "별도 질문 없음"}\n\n[이번에 작성할 섹션]\n${JSON.stringify(requested)}\n\n반드시 요청된 section_no 각각을 정확히 한 번씩 반환하세요.`;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            section_no: { type: "integer" },
            content_html: { type: "string" },
            key_basis: { type: "string" },
            action_point: { type: "string" }
          },
          required: ["section_no", "content_html", "key_basis", "action_point"]
        }
      }
    },
    required: ["sections"]
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "saju_report_batch",
          strict: true,
          schema
        }
      },
      max_output_tokens: 18000
    })
  });

  const raw = await resp.text();
  if (!resp.ok) throw new Error(`OPENAI_${resp.status}:${raw.slice(0,800)}`);
  let data: any;
  try { data = JSON.parse(raw); } catch { throw new Error("OPENAI_RESPONSE_NOT_JSON"); }
  const out = extractOutputText(data);
  if (!out) throw new Error("OPENAI_EMPTY_OUTPUT");
  let parsed: any;
  try { parsed = JSON.parse(out); } catch { throw new Error("OPENAI_OUTPUT_PARSE_FAILED:" + out.slice(0,300)); }
  return parsed.sections || [];
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
      user_id: null,
      label: "비회원 본인",
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
      user_id: null,
      birth_profile_id: birthProfileId,
      category: input.category || null,
      question_text: input.question,
      status: "submitted"
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
      input.region_name
    );
    const { data: c, error } = await sb.from("saju_calculations").insert({
      user_id: null,
      birth_profile_id: birthProfileId,
      engine_version: "manse-v3-deterministic",
      input_json: input,
      calculation_json: calculation,
      raw_time_candidate_json: calculation.raw_time_candidate || null,
      correction_policy: input.time_unknown ? "none" : "longitude+equation_of_time"
    }).select("id,calculation_json").single();
    if (error) throw new Error("CALC_CREATE_FAILED:" + error.message);
    calcRow = c;
  }

  await sb.from("orders").update({ birth_profile_id: birthProfileId, question_id: questionId || null }).eq("id", order.id);

  let { data: report } = await sb.from("reports")
    .select("*").eq("order_id", order.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!report) {
    const { data: r, error } = await sb.from("reports").insert({
      user_id: null,
      order_id: order.id,
      product_id: order.product_id,
      birth_profile_id: birthProfileId,
      calculation_id: calcRow.id,
      question_id: questionId || null,
      title: "종합 인생 리포트",
      status: "generating",
      summary: input.question ? `질문: ${input.question}` : null,
      report_json: { total_sections: REPORT_TOTAL_SECTIONS, completed_sections: 0, progress: 12, phase: "calculation_done" },
      generation_model: DEFAULT_MODEL,
      prompt_version: PROMPT_VERSION
    }).select("*").single();
    if (error) throw new Error("REPORT_CREATE_FAILED:" + error.message);
    report = r;
  }

  return { birthProfileId, questionId, calcRow, report };
}

export async function POST(req: Request) {
  const sb = admin();
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(token)) return J({ ok:false, error:"INVALID_TOKEN" },400);

    const { data: order, error: orderError } = await sb.from("orders")
      .select("id,product_id,birth_profile_id,question_id,status,payment_payload,guest_access_token,products(slug,name,report_type)")
      .eq("guest_access_token", token).maybeSingle();
    if (orderError || !order) return J({ ok:false, error:"ORDER_NOT_FOUND" },404);
    if (order.status !== "paid") return J({ ok:false, error:"ORDER_NOT_PAID" },409);

    const rawInput = (order.payment_payload as any)?.guest_input || {};
    const input = normalizeInput(rawInput);
    const init = await ensureInitialized(sb, order, input);
    const report = init.report;

    if (report.status === "completed") {
      return J({ ok:true, status:"completed", progress:100, completed_sections:REPORT_TOTAL_SECTIONS, total_sections:REPORT_TOTAL_SECTIONS, report_id:report.id });
    }

    const { count, error: countError } = await sb.from("report_sections")
      .select("id", { count:"exact", head:true }).eq("report_id", report.id);
    if (countError) throw new Error("SECTION_COUNT_FAILED:" + countError.message);
    const completed = count || 0;

    if (completed >= REPORT_TOTAL_SECTIONS) {
      await sb.from("reports").update({
        status:"completed", generated_at:new Date().toISOString(),
        report_json:{ total_sections:REPORT_TOTAL_SECTIONS, completed_sections:REPORT_TOTAL_SECTIONS, progress:100, phase:"completed" }
      }).eq("id", report.id);
      return J({ ok:true,status:"completed",progress:100,completed_sections:REPORT_TOTAL_SECTIONS,total_sections:REPORT_TOTAL_SECTIONS,report_id:report.id });
    }

    const batch = REPORT_OUTLINE.slice(completed, completed + BATCH_SIZE);
    const generated = await generateSectionsWithOpenAI({
      outline: batch as any,
      calc: init.calcRow.calculation_json,
      question: input.question,
      category: input.category
    });

    const byNo = new Map(generated.map((x:any)=>[Number(x.section_no),x]));
    const rows = batch.map((o:any) => {
      const g:any = byNo.get(o.section_no);
      if (!g?.content_html) throw new Error(`MISSING_GENERATED_SECTION_${o.section_no}`);
      return {
        report_id: report.id,
        section_no: o.section_no,
        part_no: o.part_no,
        part_title: o.part_title,
        section_title: o.section_title,
        content_html: g.content_html,
        content_json: { key_basis:g.key_basis || "", action_point:g.action_point || "" }
      };
    });

    const { error: insertError } = await sb.from("report_sections").upsert(rows, { onConflict:"report_id,section_no" });
    if (insertError) {
      // If DB has no unique(report_id,section_no), fallback to plain insert after deleting this batch.
      await sb.from("report_sections").delete().eq("report_id", report.id).gte("section_no", batch[0].section_no).lte("section_no", batch[batch.length-1].section_no);
      const { error: insert2 } = await sb.from("report_sections").insert(rows);
      if (insert2) throw new Error("SECTION_INSERT_FAILED:" + insert2.message);
    }

    const newCompleted = completed + rows.length;
    const done = newCompleted >= REPORT_TOTAL_SECTIONS;
    const progress = done ? 100 : Math.min(94, Math.round(28 + (newCompleted / REPORT_TOTAL_SECTIONS) * 64));
    const phase = done ? "completed" : newCompleted < 24 ? "core_analysis" : newCompleted < 108 ? "writing" : "finalizing";

    await sb.from("reports").update({
      status: done ? "completed" : "generating",
      generated_at: done ? new Date().toISOString() : null,
      report_json: { total_sections:REPORT_TOTAL_SECTIONS, completed_sections:newCompleted, progress, phase },
      generation_model: DEFAULT_MODEL,
      prompt_version: PROMPT_VERSION,
      error_message: null
    }).eq("id", report.id);

    return J({
      ok:true,
      status: done ? "completed" : "generating",
      progress,
      completed_sections:newCompleted,
      total_sections:REPORT_TOTAL_SECTIONS,
      next_section: done ? null : newCompleted + 1,
      report_id:report.id
    });
  } catch (e:any) {
    console.error("REPORT_GENERATE_ERROR", e);
    return J({ ok:false, error:"REPORT_GENERATION_FAILED", detail:e?.message || String(e) },500);
  }
}

export async function GET() {
  return J({ ok:true, route:"report/generate", batch_size:BATCH_SIZE, total_sections:REPORT_TOTAL_SECTIONS, model:DEFAULT_MODEL });
}
