function stripHtml(s: string) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ngrams(s: string, n = 3) {
  const t = stripHtml(s).replace(/[\s.,!?“”'"()\[\]{}:;·—–-]/g, "");
  const set = new Set<string>();
  for (let i = 0; i <= t.length - n; i++) set.add(t.slice(i, i + n));
  return set;
}

export function similarity(a: string, b: string) {
  const A = ngrams(a);
  const B = ngrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

const GENERIC_OPENINGS = [
  /^일간은/,
  /^현재 대운은/,
  /기운이 (?:강|약)/,
  /^이 구조를 현실에서/,
  /^기본적으로/,
  /^김민경 님은 기본적으로/,
  /^사주를 보면/,
];

export type QualityCandidate = {
  opening_sentence?: string;
  content_html?: string;
  key_basis?: string[];
  life_scenes?: string[];
  action_point?: string;
};

export function validateGeneratedSection(args: {
  candidate: QualityCandidate;
  minChars: number;
  previous: QualityCandidate[];
}) {
  const { candidate, minChars, previous } = args;
  const issues: string[] = [];
  const opening = stripHtml(candidate.opening_sentence || "");
  const content = stripHtml(candidate.content_html || "");

  if (content.length < minChars) issues.push(`TOO_SHORT_${content.length}`);
  if (!Array.isArray(candidate.key_basis) || candidate.key_basis.length < 1) issues.push("NO_FACT_BASIS");
  if (GENERIC_OPENINGS.some((re) => re.test(opening))) issues.push("GENERIC_OPENING");

  for (const p of previous) {
    if (opening && p.opening_sentence && similarity(opening, p.opening_sentence) > 0.46) {
      issues.push("OPENING_TOO_SIMILAR");
      break;
    }
  }

  for (const p of previous) {
    if (content && p.content_html && similarity(content, p.content_html) > 0.58) {
      issues.push("BODY_TOO_SIMILAR");
      break;
    }
  }

  const sig = [...new Set(candidate.key_basis || [])].sort().join("|");
  if (sig) {
    for (const p of previous.slice(-10)) {
      const ps = [...new Set(p.key_basis || [])].sort().join("|");
      if (ps && ps === sig) {
        issues.push("EVIDENCE_COMBO_REPEATED");
        break;
      }
    }
  }

  if ((candidate.life_scenes || []).length > 0) {
    const joined = (candidate.life_scenes || []).join(" ");
    for (const p of previous.slice(-10)) {
      if (p.life_scenes?.length && similarity(joined, p.life_scenes.join(" ")) > 0.55) {
        issues.push("LIFE_SCENE_REPEATED");
        break;
      }
    }
  }

  if (candidate.action_point) {
    for (const p of previous.slice(-10)) {
      if (p.action_point && similarity(candidate.action_point, p.action_point) > 0.62) {
        issues.push("ACTION_REPEATED");
        break;
      }
    }
  }

  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

export type CustomerFacingCandidate = QualityCandidate & {
  risk?: string;
  emphasis?: string;
  checklist?: string[];
  table_rows?: Array<{ label?: string; value?: string }>;
};

// Customer-visible child reports must never expose prompt/rule/engine/editorial process language.
// This is intentionally strict: false positives are safer than shipping internal instructions to customers.
const CHILD_INTERNAL_LANGUAGE: Array<{ code: string; re: RegExp }> = [
  { code: "META_GUIDELINE", re: /(지침|작성\s*규칙|생성\s*규칙|편집\s*규칙|프롬프트|스키마|schema|prompt)/i },
  { code: "META_TRANSLATION_RULE", re: /(자녀판|번역\s*규칙|번역맵|발달\s*언어\s*번역|성인식\s*(?:의미|언어)|돈[·ㆍ\s]*직업\s*언어)/i },
  { code: "META_ENGINE", re: /(만세력\s*엔진|사이트\s*만세력|엔진\s*(?:결과|값)|deterministic|calc\b|subset\b|JSON\b|필드명|내부\s*(?:데이터|값|필드|용어))/i },
  { code: "META_DATA_LIMIT", re: /(제공된\s*(?:데이터|계산값|사실값|범위)|허용(?:된)?\s*(?:근거|계산)|새로\s*계산(?:하지|할\s*수)|계산(?:하지\s*않|할\s*수\s*없)|계산\s*결과(?:에는|에).*제공되지)/i },
  { code: "META_WRITING_PROCESS", re: /(이\s*섹션(?:은|에서는)|SECTION\s*\d+\s*(?:은|에서는|을)|본문(?:에서는|에)|리포트의\s*독자|해석의\s*재료|근거로\s*(?:정리|적용|사용)|번역(?:합니다|됩니다|해석합니다))/i },
];

function collectCustomerVisibleText(candidate: CustomerFacingCandidate) {
  const rows = Array.isArray(candidate.table_rows)
    ? candidate.table_rows.flatMap((r) => [r?.label || "", r?.value || ""])
    : [];
  return [
    candidate.opening_sentence || "",
    candidate.content_html || "",
    ...(candidate.life_scenes || []),
    candidate.risk || "",
    candidate.action_point || "",
    candidate.emphasis || "",
    ...(candidate.checklist || []),
    ...rows,
  ].join("\n");
}

export function validateCustomerFacingChildSection(candidate: CustomerFacingCandidate) {
  const visible = stripHtml(collectCustomerVisibleText(candidate));
  const issues: string[] = [];
  for (const rule of CHILD_INTERNAL_LANGUAGE) {
    if (rule.re.test(visible)) issues.push(rule.code);
  }
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

export function auditCustomerFacingChildReport(sections: Array<{ section_no?: number; content_html?: string | null; content_json?: any }>, narrative?: any) {
  const failures: Array<{ section_no: number; issues: string[] }> = [];
  for (const row of sections || []) {
    const j = row?.content_json || {};
    const result = validateCustomerFacingChildSection({
      opening_sentence: j.opening_sentence || "",
      content_html: row?.content_html || j.content_html || "",
      key_basis: Array.isArray(j.key_basis) ? j.key_basis : [],
      life_scenes: Array.isArray(j.life_scenes) ? j.life_scenes : [],
      risk: j.risk || "",
      action_point: j.action_point || "",
      emphasis: j.emphasis || "",
      checklist: Array.isArray(j.checklist) ? j.checklist : [],
      table_rows: Array.isArray(j.table_rows) ? j.table_rows : [],
    });
    if (!result.ok) failures.push({ section_no: Number(row?.section_no || 0), issues: result.issues });
  }

  // Narrative is also rendered on customer-facing prologue/chapter pages.
  const narrativeText = stripHtml([
    narrative?.core_thesis || "",
    narrative?.current_question_thesis || "",
    ...Object.values(narrative?.chapter_theses || {}).map(String),
  ].join("\n"));
  const narrativeIssues = CHILD_INTERNAL_LANGUAGE.filter((x) => x.re.test(narrativeText)).map((x) => x.code);
  if (narrativeIssues.length) failures.push({ section_no: 0, issues: [...new Set(narrativeIssues)] });

  return { ok: failures.length === 0, failures };
}

