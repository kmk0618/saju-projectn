import type { ReportSectionSpec } from "@/lib/report-spec";

export const CHILD_SECTION_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    section_no: { type: "integer" },
    subtitle: { type: "string" },
    opening_sentence: { type: "string" },
    content_html: { type: "string" },
    key_basis: { type: "array", items: { type: "string" } },
    life_scenes: { type: "array", items: { type: "string" } },
    parent_misreads: { type: "array", items: { type: "string" } },
    parent_actions: { type: "array", items: { type: "string" } },
    scripts: { type: "array", items: { type: "string" } },
    reframe: { type: "string" },
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
  required: [
    "section_no","subtitle","opening_sentence","content_html","key_basis","life_scenes","parent_misreads",
    "parent_actions","scripts","reframe","risk","action_point","emphasis","layout_type","checklist","table_rows",
  ],
};

function sectionSpecials(sectionNo: number) {
  const rules: Record<number, string> = {
    1: "출생 정보와 핵심 계산 기준을 읽기 쉬운 표로 보여주되, 개발자 필드명은 노출하지 않는다.",
    2: "원국 전체표는 실제 사주 구조를 정확히 보여주고, 표 아래에서 이 아이의 전체 구조를 생활 언어로 해석한다.",
    4: "오행표는 비율/상태에서 끝내지 말고 각 오행이 생활에서 어떻게 보이고 부모가 무엇을 해야 하는지 연결한다.",
    17: "십성표는 성인식 돈·직업 언어를 쓰지 말고 표현·학습·규칙·자존감·현실감의 아동 발달 언어로 쓴다.",
    18: "12운성은 사건예언이 아니라 성장 리듬과 회복 속도로 해석한다.",
    19: "신살은 낙인이나 불안 조장이 아니라 생활 성향을 이해하는 보조 자료로만 쓴다.",
    20: "관계 계산값을 그대로 나열하는 검산표 금지. 표는 관계/아이에게 보이는 반응/생활 장면/부모 대응 구조를 우선한다. '구조 확인', '참고 방법' 문구 금지.",
    33: "칭찬 상황별 실제 말 스크립트를 충분히 넣고, 비교 칭찬은 피한다.",
    34: "혼낼 때 말투·공개지적·낙인 문제와 대체 문장을 실제 장면으로 제시한다.",
    43: "상황/좋은 말/아이가 배우는 것 표 + 자존감 문장 8개 이상 + 책임감 문장 8개 이상을 포함한다.",
    44: "피해야 할 말/아이가 받는 메시지/바꾼 표현 표를 8행 이상 포함한다.",
    49: "1개월/3개월/1년 성장 로드맵을 표로 만들고 각각 완료 기준을 포함한다.",
    50: "부모 질문에 직접 답한다. 강점 기반 한 문장 정의, 지금 할 일, 절대 하지 말 것, 1년 뒤 그림을 모두 포함한다.",
  };
  return rules[sectionNo] || "";
}

export function buildChildSectionGenerationPrompt(args: {
  spec: ReportSectionSpec;
  plan: any;
  calcSubset: any;
  narrative: any;
  question: string;
  recent: any[];
}) {
  return `
당신은 유료 자녀사주 심층 리포트의 전문 해설가이자 편집자입니다.
아래 SECTION 설계도를 바탕으로 부모가 실제로 읽는 완성 본문을 작성하세요.

[SECTION]
${JSON.stringify({
  section_no: args.spec.section_no,
  title: args.spec.section_title,
  purpose: args.spec.purpose,
  depth: args.spec.depth,
  layout_type: args.spec.layout_type,
  target_chars: args.spec.target_chars,
})}

[SECTION 해석 설계도]
${JSON.stringify(args.plan)}

[허용 계산 근거 — 사실 검증용]
${JSON.stringify(args.calcSubset)}

[아이 전체 서사]
${JSON.stringify(args.narrative)}

[부모 질문]
${args.question || "우리 아이를 어떻게 이해하고 키워야 할까요?"}

[최근 SECTION — 반복 회피]
${JSON.stringify(args.recent.slice(-10))}

[완성 본문 규칙]
- 고객은 계산 과정이나 작성 규칙을 알 필요가 없다. 결과 해석만 보여준다.
- subtitle은 제목 바로 아래 들어갈 공감 부제다. 렌더러가 별도 출력하므로 content_html에서 같은 문장을 반복하지 않는다.
- 첫 단락은 결론부터 시작하고, 이후 실제 생활 장면과 이유를 풀어낸다.
- 계산 근거 → 아이 마음 → 겉행동 → 생활 장면 → 부모가 오해하기 쉬운 지점 → 부모 행동 → 실제 말 순서를 자연스럽게 연결한다.
- 설계도에 있는 생활 장면을 그대로 복사만 하지 말고 문맥 속에서 구체적으로 전개한다.
- 강점과 예민점은 같은 기질의 양면으로 설명한다.
- 아이를 "산만한 아이", "고집 센 아이"처럼 규정하지 않는다.
- 또래 비교·진단·사건 예언 금지.
- "지침에 따라", "번역 규칙", "자녀판", "calc", "subset", "엔진", "내부 데이터", "제공된 계산값", "이 섹션에서는" 같은 제작자 문구 절대 금지.
- deep/critical SECTION은 최소 생활 장면 2개, 부모 행동 2개, 부모가 그대로 쓸 말 1개 이상을 포함한다.
- life_scenes, parent_actions, scripts, reframe 필드는 content_html에 실제로 들어간 문장이나 문구를 그대로 추출해 반환한다. 검수용 배열에만 따로 적고 본문에서 빠뜨리면 실패다.
- 모든 SECTION에 strength reframe을 하나 둔다.
- 같은 조언을 반복해서 분량을 채우지 않는다.
- content_html은 읽는 흐름 안에서 <p>, <p class="lead">, <div class="subtitle">, <div class="subhead">, <div class="emph">, <table>, <ul class="check">, <blockquote> 등을 필요할 때만 사용한다.
- 표가 필요한 SECTION은 표가 고객의 이해를 돕는 구조여야 한다. 원시 사주값만 나열한 검산표는 허용하지 않는다.

[특별 규칙]
${sectionSpecials(args.spec.section_no)}

반드시 JSON 스키마에 맞춰 답하세요.
`.trim();
}
