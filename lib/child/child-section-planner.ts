import type { ReportSectionSpec } from "@/lib/report-spec";
import type { ChildMeaningContext } from "@/lib/child/child-meaning-map";

export const CHILD_SECTION_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    section_no: { type: "integer" },
    subtitle: { type: "string" },
    main_thesis: { type: "string" },
    evidence_blocks: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          basis: { type: "array", items: { type: "string" } },
          meaning: { type: "string" },
          child_inner: { type: "string" },
          observable_behavior: { type: "string" },
          daily_scene: { type: "string" },
          parent_misread: { type: "string" },
          parent_action: { type: "string" },
          script: { type: "string" },
          strength_reframe: { type: "string" },
        },
        required: ["basis","meaning","child_inner","observable_behavior","daily_scene","parent_misread","parent_action","script","strength_reframe"],
      },
    },
    table_plan: {
      type: "object",
      additionalProperties: false,
      properties: {
        required: { type: "boolean" },
        headers: { type: "array", items: { type: "string" } },
        row_purposes: { type: "array", items: { type: "string" } },
      },
      required: ["required","headers","row_purposes"],
    },
    must_include: { type: "array", items: { type: "string" } },
    must_avoid: { type: "array", items: { type: "string" } },
    closing_parent_takeaway: { type: "string" },
  },
  required: ["section_no","subtitle","main_thesis","evidence_blocks","table_plan","must_include","must_avoid","closing_parent_takeaway"],
};

function specialContract(sectionNo: number) {
  if (sectionNo === 20) return `
SECTION 20 특별 계약:
- "천간합/육합/형/파/해 → 구조 확인" 같은 검산표를 만들지 않는다.
- 표를 쓴다면 헤더는 반드시 아이가 이해되는 방향이어야 한다. 예: 관계/아이에게 보이는 반응/생활 장면/부모 대응.
- 각 관계값을 실제 생활의 긴장·끌림·회복 순서로 번역한다.
- raw 관계값 자체보다 "그래서 아이에게 어떻게 보이는가"가 더 길어야 한다.`;
  if (sectionNo === 43) return `SECTION 43 특별 계약: 좋은 말 스크립트 8개 이상을 최종 본문에 넣을 수 있도록 상황을 충분히 설계한다.`;
  if (sectionNo === 44) return `SECTION 44 특별 계약: 피해야 할 말 → 아이가 받는 메시지 → 바꾼 표현을 8행 이상 만들 수 있게 설계한다.`;
  if (sectionNo === 49) return `SECTION 49 특별 계약: 1개월/3개월/1년 각각 완료기준이 있는 성장 로드맵을 설계한다.`;
  if (sectionNo === 50) return `SECTION 50 특별 계약: 부모 질문에 직접 답하고, 강점 기반 한 문장 정의/지금 할 일/절대 하지 말 것/1년 뒤 그림을 모두 설계한다.`;
  return "";
}

export function buildChildSectionPlanPrompt(args: {
  spec: ReportSectionSpec;
  calcSubset: any;
  meaningContext: ChildMeaningContext;
  narrative: any;
  question: string;
  recentPlans: any[];
}) {
  return `
당신은 자녀사주 SECTION의 해석 설계자입니다.
아직 고객용 완성 문장을 쓰지 말고, 이 SECTION을 깊게 쓰기 위한 설계도만 JSON으로 만드세요.

[SECTION]
${JSON.stringify({
  section_no: args.spec.section_no,
  title: args.spec.section_title,
  purpose: args.spec.purpose,
  depth: args.spec.depth,
  layout_type: args.spec.layout_type,
  evidence_allowed: args.spec.evidence,
})}

[허용된 실제 계산 근거]
${JSON.stringify(args.calcSubset)}

[아이 전체 서사]
${JSON.stringify(args.narrative)}

[아동 발달 의미 컨텍스트 — 내부 참고용]
${JSON.stringify(args.meaningContext)}

[부모 질문]
${args.question || "우리 아이를 어떻게 이해하고 키워야 할까요?"}

[최근 SECTION 설계 — 중복 회피]
${JSON.stringify(args.recentPlans.slice(-8))}

[설계 원칙]
1. 사주 근거를 곧바로 고객에게 나열하지 말고 "아이 마음 → 겉행동 → 실제 생활 장면 → 부모 오해 → 부모 행동"으로 끝까지 내려간다.
2. 최소 2개의 서로 다른 evidence block을 만든다. critical이면 가능하면 3~5개.
3. daily_scene은 집/학교/학원/놀이/친구/숙제/귀가/잠들기 전 등 실제 장면으로 구체화한다.
4. parent_action은 당장 실행 가능한 행동이어야 한다. "관심을 가져주세요" 같은 추상 문장 금지.
5. script는 부모가 그대로 말할 수 있는 한 문장으로 쓴다.
6. strength_reframe은 예민함·고집·산만함처럼 보일 수 있는 특성을 살릴 방향으로 바꾼다.
7. subtitle은 부모가 "아 맞아" 하고 알아볼 수 있는 공감 문장으로 쓴다.
8. 원시 계산표를 고객 해석으로 착각하지 않는다.
9. 최근 SECTION과 같은 생활 장면·조언·스크립트를 반복하지 않는다.
10. 내부 제작과정·지침·엔진·필드명은 절대 고객용 문장에 넣지 않는다.

${specialContract(args.spec.section_no)}

반드시 JSON 스키마에 맞춰 답하세요.
`.trim();
}
