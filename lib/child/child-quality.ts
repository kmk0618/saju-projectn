import type { ReportSectionSpec } from "@/lib/report-spec";

export type ChildSectionCandidate = {
  section_no?: number;
  subtitle?: string;
  opening_sentence?: string;
  content_html?: string;
  key_basis?: string[];
  life_scenes?: string[];
  parent_misreads?: string[];
  parent_actions?: string[];
  scripts?: string[];
  reframe?: string;
  risk?: string;
  action_point?: string;
  emphasis?: string;
  layout_type?: string;
  checklist?: string[];
  table_rows?: Array<{ label?: string; value?: string }>;
};

const INTERNAL_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: "META_GUIDELINE", re: /(지침|작성\s*규칙|생성\s*규칙|편집\s*규칙|프롬프트|스키마|schema|prompt)/i },
  { code: "META_TRANSLATION", re: /(자녀판|번역\s*규칙|번역맵|발달\s*언어\s*번역|성인식\s*(?:의미|언어))/i },
  { code: "META_ENGINE", re: /(만세력\s*엔진|사이트\s*만세력|엔진\s*(?:결과|값)|deterministic|calc\b|subset\b|JSON\b|필드명|내부\s*(?:데이터|값|필드|용어))/i },
  { code: "META_DATA_LIMIT", re: /(제공된\s*(?:데이터|계산값|사실값|범위)|허용(?:된)?\s*(?:근거|계산)|새로\s*계산(?:하지|할\s*수)|계산(?:하지\s*않|할\s*수\s*없))/i },
  { code: "META_WRITER", re: /(이\s*섹션(?:은|에서는)|SECTION\s*\d+\s*(?:은|에서는|을)|본문(?:에서는|에)|해석의\s*재료|근거로\s*(?:정리|적용|사용))/i },
];

const EMPTY_EDITORIAL = /(구조\s*확인|참고\s*방법|참고용|단순\s*참고)/i;
const DIAGNOSIS = /(ADHD|주의력결핍|발달장애|자폐|우울증|불안장애|질환|정신질환)/i;
const LABELING = /(산만한\s*아이|고집\s*센\s*아이|문제\s*아이|예민한\s*아이다|게으른\s*아이)/i;

function stripHtml(s: string) {
  return String(s || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleText(c: ChildSectionCandidate) {
  return stripHtml([
    c.subtitle || "",
    c.opening_sentence || "",
    c.content_html || "",
    ...(c.life_scenes || []),
    ...(c.parent_misreads || []),
    ...(c.parent_actions || []),
    ...(c.scripts || []),
    c.reframe || "",
    c.risk || "",
    c.action_point || "",
    c.emphasis || "",
    ...(c.checklist || []),
    ...(c.table_rows || []).flatMap((r) => [r?.label || "", r?.value || ""]),
  ].join("\n"));
}

function sentenceCount(text: string) {
  return text.split(/[.!?。]|다\.|요\./).map((x) => x.trim()).filter((x) => x.length > 12).length;
}

function repeatedAdvice(c: ChildSectionCandidate) {
  const items = [...(c.parent_actions || []), ...(c.scripts || []), ...(c.life_scenes || [])]
    .map((x) => stripHtml(String(x)).toLowerCase())
    .filter(Boolean);
  const set = new Set(items);
  return items.length - set.size;
}

function normalizeForContainment(s: string) {
  return stripHtml(s).replace(/[\s.,!?“”'"()\[\]{}:;·—–-]/g, "").toLowerCase();
}

function appearsInHtml(html: string, item: string) {
  const h = normalizeForContainment(html);
  const i = normalizeForContainment(item);
  if (!i) return true;
  return h.includes(i);
}

export function validateChildSectionDepth(args: { spec: ReportSectionSpec; candidate: ChildSectionCandidate; plan?: any }) {
  const { spec, candidate } = args;
  const issues: string[] = [];
  const visible = visibleText(candidate);
  const html = String(candidate.content_html || "");
  const critical = spec.depth === "critical";
  const deep = critical || spec.depth === "deep";

  if (!String(candidate.subtitle || "").trim()) issues.push("NO_EMPATHY_SUBTITLE");
  if (!String(candidate.reframe || "").trim()) issues.push("NO_STRENGTH_REFRAME");
  if ((candidate.key_basis || []).length < 1) issues.push("NO_FACT_BASIS");
  if (deep && (candidate.life_scenes || []).length < 2) issues.push("LIFE_SCENES_LT_2");
  if (critical && (candidate.life_scenes || []).length < 3) issues.push("LIFE_SCENES_LT_3");
  if (deep && (candidate.parent_actions || []).length < 2) issues.push("PARENT_ACTIONS_LT_2");
  if (deep && (candidate.scripts || []).length < 1) issues.push("NO_PARENT_SCRIPT");
  if (deep && sentenceCount(visible) < 10) issues.push("TOO_SHALLOW");

  const htmlOnly = String(candidate.content_html || "");
  const structuredToVerify = [
    ...(candidate.life_scenes || []).slice(0, deep ? 2 : 1),
    ...(candidate.parent_actions || []).slice(0, deep ? 2 : 1),
    ...(candidate.scripts || []).slice(0, 1),
    ...(candidate.reframe ? [candidate.reframe] : []),
  ].filter(Boolean);
  if (structuredToVerify.some((x) => !appearsInHtml(htmlOnly, String(x)))) issues.push("STRUCTURED_TEXT_NOT_IN_BODY");
  if (repeatedAdvice(candidate) > 1) issues.push("STRUCTURED_REPETITION");

  for (const rule of INTERNAL_PATTERNS) if (rule.re.test(visible)) issues.push(rule.code);
  if (EMPTY_EDITORIAL.test(visible)) issues.push("EMPTY_EDITORIAL_LANGUAGE");
  if (DIAGNOSIS.test(visible)) issues.push("DIAGNOSTIC_LANGUAGE");
  if (LABELING.test(visible)) issues.push("LABELING_LANGUAGE");

  if (spec.layout_type === "table" && !/<table\b/i.test(html)) issues.push("TABLE_REQUIRED");
  if (spec.layout_type === "checklist" && !/<ul[^>]*class=["'][^"']*check/i.test(html)) issues.push("CHECKLIST_REQUIRED");

  if (spec.section_no === 20) {
    if (!/<table\b/i.test(html)) issues.push("S20_TABLE_REQUIRED");
    if (!/(부모\s*대응|부모가\s*할|부모\s*행동)/.test(visible)) issues.push("S20_NO_PARENT_RESPONSE");
    if (!/(생활\s*장면|집|학교|학원|활동|일정|수면|친구|숙제|귀가)/.test(visible)) issues.push("S20_NO_DAILY_SCENE");
    if (/(관계\s*종류)[\s\S]*(사주\s*구조)[\s\S]*(참고\s*방법)/.test(visible)) issues.push("S20_RAW_AUDIT_TABLE");
  }

  if (spec.section_no === 43 && (candidate.scripts || []).length < 16) issues.push("S43_SCRIPTS_LT_16");
  if (spec.section_no === 44 && (candidate.scripts || []).length < 8 && (candidate.table_rows || []).length < 8) issues.push("S44_ROWS_LT_8");
  if (spec.section_no === 49) {
    if ((candidate.table_rows || []).length < 3) issues.push("S49_ROADMAP_ROWS_LT_3");
    if ((candidate.checklist || []).length < 3) issues.push("S49_CHECKLIST_LT_3");
  }
  if (spec.section_no === 50 && (candidate.parent_actions || []).length < 3) issues.push("S50_DIRECT_ACTIONS_LT_3");

  const plan = args.plan;
  if (plan) {
    const expectedScenes = Array.isArray(plan.evidence_blocks) ? plan.evidence_blocks.map((x:any) => String(x?.daily_scene || "")).filter(Boolean) : [];
    if (deep && expectedScenes.length >= 2 && (candidate.life_scenes || []).length < Math.min(2, expectedScenes.length)) issues.push("PLAN_SCENE_LOSS");
  }

  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

export function auditChildReportDepth(sections: Array<{ section_no?: number; content_html?: string | null; content_json?: any }>, outline: ReportSectionSpec[], narrative?: any) {
  const failures: Array<{ section_no: number; issues: string[] }> = [];
  const byNo = new Map(outline.map((s) => [s.section_no, s]));
  for (const row of sections || []) {
    const no = Number(row?.section_no || 0);
    const spec = byNo.get(no);
    if (!spec) continue;
    const j = row?.content_json || {};
    const result = validateChildSectionDepth({
      spec,
      candidate: {
        section_no: no,
        subtitle: j.subtitle || "",
        opening_sentence: j.opening_sentence || "",
        content_html: row?.content_html || j.content_html || "",
        key_basis: Array.isArray(j.key_basis) ? j.key_basis : [],
        life_scenes: Array.isArray(j.life_scenes) ? j.life_scenes : [],
        parent_misreads: Array.isArray(j.parent_misreads) ? j.parent_misreads : [],
        parent_actions: Array.isArray(j.parent_actions) ? j.parent_actions : [],
        scripts: Array.isArray(j.scripts) ? j.scripts : [],
        reframe: j.reframe || "",
        risk: j.risk || "",
        action_point: j.action_point || "",
        emphasis: j.emphasis || "",
        layout_type: j.layout_type || spec.layout_type,
        checklist: Array.isArray(j.checklist) ? j.checklist : [],
        table_rows: Array.isArray(j.table_rows) ? j.table_rows : [],
      },
    });
    if (!result.ok) failures.push({ section_no: no, issues: result.issues });
  }

  const narrativeVisible = stripHtml([
    narrative?.core_thesis || "",
    narrative?.current_question_thesis || "",
    ...Object.values(narrative?.chapter_theses || {}).map(String),
  ].join("\n"));
  const narrativeIssues: string[] = [];
  for (const rule of INTERNAL_PATTERNS) if (rule.re.test(narrativeVisible)) narrativeIssues.push(rule.code);
  if (narrativeIssues.length) failures.push({ section_no: 0, issues: [...new Set(narrativeIssues)] });

  return { ok: failures.length === 0, failures };
}
