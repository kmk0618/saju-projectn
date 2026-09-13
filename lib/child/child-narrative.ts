import type { ChildMeaningContext } from "@/lib/child/child-meaning-map";

export const CHILD_NARRATIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    core_thesis: { type: "string" },
    coreTemperament: { type: "string" },
    coreTension: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    sensitivities: { type: "array", items: { type: "string" } },
    regulationNeeds: { type: "array", items: { type: "string" } },
    learningPattern: { type: "array", items: { type: "string" } },
    relationshipPattern: { type: "array", items: { type: "string" } },
    parentingLevers: { type: "array", items: { type: "string" } },
    avoidPatterns: { type: "array", items: { type: "string" } },
    chapter_theses: {
      type: "object",
      additionalProperties: false,
      properties: { "1": { type: "string" }, "2": { type: "string" }, "3": { type: "string" } },
      required: ["1", "2", "3"],
    },
    current_question_thesis: { type: "string" },
    basis: { type: "array", items: { type: "string" } },
  },
  required: [
    "core_thesis","coreTemperament","coreTension","strengths","sensitivities","regulationNeeds",
    "learningPattern","relationshipPattern","parentingLevers","avoidPatterns","chapter_theses",
    "current_question_thesis","basis",
  ],
};

export function buildChildNarrativePrompt(args: {
  calcContext: any;
  meaningContext: ChildMeaningContext;
  question: string;
}) {
  return `
당신은 부모가 읽는 개인맞춤 자녀사주 심층 리포트의 서사 설계자입니다.
아직 SECTION 본문을 쓰지 마세요. 먼저 이 아이의 전체 해석축을 하나로 고정합니다.

[목표]
- 50개 SECTION이 제각각 다른 아이처럼 보이지 않도록 하나의 중심 서사를 만든다.
- 계산값을 나열하지 말고, 계산값 사이의 결합이 실제 생활에서 어떤 패턴으로 보이는지 정리한다.
- 강점과 예민점은 반드시 같은 뿌리에서 나온 양면으로 설계한다.
- 부모가 실제로 관찰할 수 있는 표현만 쓴다.
- 아이를 규정·낙인·진단하지 않는다.

[출력 필드의 역할]
- core_thesis: 고객에게 보여도 되는 한 문장 핵심. 내부 규칙/계산과정 언급 금지.
- coreTemperament: 이 아이가 힘을 쓰는 기본 방식.
- coreTension: 겉으로 보이는 힘과 안쪽에서 필요한 조건 사이의 핵심 긴장.
- strengths: 4~7개.
- sensitivities: 과부하·평가·변화 등에서 민감하게 반응할 수 있는 조건 4~7개.
- regulationNeeds: 회복과 정서 안정에 필요한 조건 4~7개.
- learningPattern: 학습이 살아나는 순서 3~6개.
- relationshipPattern: 부모·교사·또래 관계에서 반복될 수 있는 패턴 3~6개.
- parentingLevers: 부모가 바꾸면 효과가 큰 행동 5~8개.
- avoidPatterns: 부모가 반복하지 말아야 할 방식 4~7개.
- chapter_theses: CHAPTER 1/2/3의 서로 다른 중심 논지.
- current_question_thesis: 부모 질문에 대한 방향성 있는 답변. 고객에게 그대로 보여도 자연스러워야 함.
- basis: 내부 검증용 실제 근거 4~10개. 고객 본문에 직접 노출되지 않음.

[절대 금지]
- "지침에 따라", "번역 규칙", "자녀판", "calc", "subset", "엔진", "내부 데이터", "제공된 계산값" 등 제작과정 언급
- "이 섹션에서는" 같은 작성자 시점
- 미래 사건 단정
- ADHD, 발달장애 등 진단성 표현
- 다른 아이와 비교

[만세력 계산 컨텍스트]
${JSON.stringify(args.calcContext)}

[아동 발달 의미 변환 컨텍스트 — 내부 참고용]
${JSON.stringify(args.meaningContext)}

[부모 질문]
${args.question || "우리 아이를 어떻게 이해하고 키워야 할까요?"}

반드시 JSON 스키마에 맞춰 답하세요.
`.trim();
}
