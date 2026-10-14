export type LifeCustomerCandidate = {
  opening_sentence?: string;
  content_html?: string;
  key_basis?: string[];
  life_scenes?: string[];
  risk?: string;
  action_point?: string;
  emphasis?: string;
  checklist?: string[];
  table_rows?: Array<{ label?: string; value?: string }>;
};

function visibleText(input: string) {
  return String(input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function collectCandidateText(candidate: LifeCustomerCandidate) {
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

// 종합 인생 리포트는 계산 자료를 '받아 읽어주는 문체'가 아니라,
// 확정된 만세력 사실을 바탕으로 고객에게 직접 해석을 전달해야 한다.
const LIFE_CUSTOMER_LANGUAGE: Array<{ code: string; re: RegExp }> = [
  // 가장 많이 발생했던 증거 낭독형 말투.
  { code: "EVIDENCE_PRESENTED", re: /(?:제시되어\s*있|제시됩니다|제시됐|제시된\s*(?:값|자료|결과))/i },
  { code: "EVIDENCE_SOURCE_READING", re: /(관계\s*자료|자료(?:에는|에서|에\s*따르면)|계산\s*결과(?:에는|에서|에\s*따르면)|산출값(?:에는|에서|에\s*따르면)|입력값(?:에는|에서|에\s*따르면)|계산값(?:은|이|을|에서|으로)|제공된\s*(?:정보|자료|데이터|계산값|사실값)|데이터(?:상|에서는|에\s*따르면)|엔진(?:상|에서는|에\s*따르면))/i },
  { code: "EVIDENCE_CONFIRMED", re: /(?:자료|계산|산출|입력|데이터|엔진)[^.!?]{0,90}(?:확인됩니다|확인할\s*수\s*있습니다)/i },

  // 작성자/개발자 지시문 노출.
  { code: "META_WRITING", re: /(지침|작성\s*(?:지시|규칙|원칙)|생성\s*(?:지시|규칙|원칙|과정)|편집\s*(?:지시|규칙|원칙)|프롬프트|스키마|schema|prompt|이\s*섹션(?:은|에서는)|해당\s*섹션(?:은|에서는)|본문(?:에서는|에)|다음\s*(?:형식|구조)으로)/i },
  { code: "META_ENGINE", re: /(만세력\s*엔진|사이트\s*만세력|엔진\s*(?:결과|값|버전)|deterministic|calc\b|subset\b|JSON\b|필드명|내부\s*(?:데이터|값|필드|용어)|life-report-aqua|REPORT\s*ENGINE)/i },
  { code: "META_AI", re: /(?:^|[\s(])(AI가|AI는|모델이|모델은)(?:[\s,.)]|$)/i },

  // 본인이 읽는 상품에서 제3자화 금지.
  { code: "THIRD_PERSON_THIS_PERSON", re: /이\s*사람(?:은|이|에게|의|을|과|도|만|처럼)?/ },

  // 내부 계산 정밀도 그대로 노출 금지. 퍼센트 표시는 정수 반올림만 허용.
  { code: "RAW_DECIMAL_PERCENT", re: /\b\d+\.\d+\s*%/ },
];

export function validateCustomerFacingLifeSection(candidate: LifeCustomerCandidate) {
  const text = visibleText(collectCandidateText(candidate));
  const issues = LIFE_CUSTOMER_LANGUAGE.filter((rule) => rule.re.test(text)).map((rule) => rule.code);
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

export function auditCustomerFacingLifeReport(
  sections: Array<{ section_no?: number; content_html?: string | null; content_json?: any }>,
  narrative?: any,
) {
  const failures: Array<{ section_no: number; issues: string[] }> = [];

  for (const row of sections || []) {
    const j = row?.content_json || {};
    const result = validateCustomerFacingLifeSection({
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

  // narrative는 프롤로그/챕터 도입에 그대로 노출될 수 있으므로 동일한 고객 언어 규칙을 적용한다.
  if (narrative) {
    const narrativeText = [
      narrative?.core_thesis || "",
      ...(Array.isArray(narrative?.life_tensions) ? narrative.life_tensions : []),
      ...(Array.isArray(narrative?.strengths) ? narrative.strengths : []),
      ...(Array.isArray(narrative?.risks) ? narrative.risks : []),
      ...(Array.isArray(narrative?.leverage_points) ? narrative.leverage_points : []),
      ...Object.values(narrative?.chapter_theses || {}).map(String),
      narrative?.current_question_thesis || "",
    ].join("\n");
    const result = validateCustomerFacingLifeSection({ content_html: narrativeText });
    if (!result.ok) failures.push({ section_no: 0, issues: result.issues });
  }

  return { ok: failures.length === 0, failures };
}

export function auditLifeRenderedHtml(html: string) {
  const text = visibleText(html);
  const issues: string[] = [];
  // 렌더링 최종 단계에서는 사용자가 직접 쓴 질문까지 포함되므로,
  // 고객 문체 검사는 section/narrative 단계에서 끝내고 여기서는 표지/정적 템플릿의
  // 엔진명·버전 노출만 별도로 차단한다.
  if (/life-report-aqua|manse-v\d|REPORT\s*ENGINE|ENGINE\s*VERSION|PROMPT\s*VERSION/i.test(text)) {
    issues.push("ENGINE_VERSION_VISIBLE");
  }
  return { ok: issues.length === 0, issues };
}
