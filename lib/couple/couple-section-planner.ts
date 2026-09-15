import type { ReportSectionSpec } from "@/lib/report-spec";

export const COUPLE_SECTION_PLAN_SCHEMA = {
  type:"object",additionalProperties:false,
  properties:{
    section_no:{type:"integer"}, subtitle:{type:"string"}, main_thesis:{type:"string"},
    interaction_blocks:{type:"array",minItems:2,maxItems:5,items:{type:"object",additionalProperties:false,properties:{
      basis:{type:"array",items:{type:"string"}},
      a_inner:{type:"string"}, a_behavior:{type:"string"},
      b_inner:{type:"string"}, b_behavior:{type:"string"},
      interaction_meaning:{type:"string"}, daily_scene:{type:"string"},
      common_misread:{type:"string"}, repair_action:{type:"string"}, script:{type:"string"}, strength_reframe:{type:"string"}
    },required:["basis","a_inner","a_behavior","b_inner","b_behavior","interaction_meaning","daily_scene","common_misread","repair_action","script","strength_reframe"]}},
    table_plan:{type:"object",additionalProperties:false,properties:{required:{type:"boolean"},headers:{type:"array",items:{type:"string"}},row_purposes:{type:"array",items:{type:"string"}}},required:["required","headers","row_purposes"]},
    must_include:{type:"array",items:{type:"string"}}, must_avoid:{type:"array",items:{type:"string"}}, closing_takeaway:{type:"string"}
  },required:["section_no","subtitle","main_thesis","interaction_blocks","table_plan","must_include","must_avoid","closing_takeaway"]
};

function special(no:number){
  const x:Record<number,string>={
    1:"두 사람 출생 정보와 시간 미상 여부를 정확히 보여준다. 시간 미상인 사람의 시주를 만들지 않는다.",
    4:"일간 관계를 좋다/나쁘다 판정으로 끝내지 말고 끌림→기대→과해질 때 통제/의존 같은 양면을 설계한다.",
    8:"용신 교차는 실제 두 사람의 용신 후보와 오행 분포가 있을 때만 근거로 사용한다. '서로의 약'이라는 비유를 쓰더라도 실제 생활 행동으로 연결한다.",
    11:"지지 합은 관계값 나열 금지. 함께 잘되는 생활 장면과 과해질 때의 리스크를 만든다.",
    12:"충·형·파·해·원진은 검산표 금지. 각각 실제 갈등 장면/서로의 해석/복구 행동으로 만든다.",
    20:"갈등 패턴은 반드시 trigger→A 해석/반응→B 해석/반응→증폭→복구 순서로 만든다.",
    21:"화해 방식은 '시간을 주세요' 같은 추상 조언이 아니라 언제/어떻게 다시 대화할지 프로토콜과 실제 문장을 설계한다.",
    22:"돈은 투자 조언이 아니라 공동생활의 의사결정·지출·저축·자유비·큰돈 합의 장면으로 다룬다.",
    29:"친밀감은 성적 행위를 단정하지 말고 정서적 거리·스킨십·혼자 있는 시간·가까워지는 리듬 수준으로 다룬다.",
    36:"현재 관계 흐름은 두 사람 각자의 실제 대운·세운 계산값을 교차해서 본다. 계산값이 있으면 '엔진에서 확정' 같은 메타문구 금지.",
    41:"갈등 상황별 대화 스크립트는 최소 8개 상황을 설계한다.",
    42:"서로에게 해주면 좋은 말은 A에게 8개 이상, B에게 8개 이상 설계한다.",
    43:"하면 안 되는 말→상대가 받는 메시지→바꾼 표현을 최소 10행 설계한다.",
    44:"좋아지는 시기는 A/B의 실제 연·월 흐름 교차값을 사용해 활용 행동까지 연결한다.",
    45:"조심해야 할 시기는 운이 나쁘다고 단정하지 말고 두 사람 모두의 스트레스가 겹치는 구간과 방어 규칙을 설계한다.",
    49:"1개월/3개월/1년 각각 목표·실행·완료기준이 있는 관계 로드맵을 설계한다.",
    50:"처음 질문에 직접 답한다. 관계 한 문장 정의/살릴 것/멈출 것/갈등 프로토콜/1년 실천을 모두 포함한다."
  }; return x[no]||"";
}

export function buildCoupleSectionPlanPrompt(args:{spec:ReportSectionSpec;calcSubset:any;narrative:any;meaning:any;question:string;recentPlans:any[]}){
return `
당신은 부부궁합 SECTION의 해석 설계자입니다. 아직 고객용 완성문장을 쓰지 말고 설계도만 JSON으로 만드세요.

[SECTION]
${JSON.stringify({section_no:args.spec.section_no,title:args.spec.section_title,purpose:args.spec.purpose,depth:args.spec.depth,layout_type:args.spec.layout_type,evidence_allowed:args.spec.evidence})}

[허용된 실제 계산 근거]
${JSON.stringify(args.calcSubset)}

[관계 전체 서사]
${JSON.stringify(args.narrative)}

[관계 의미 컨텍스트]
${JSON.stringify(args.meaning)}

[질문]
${args.question || "우리는 왜 끌리고 왜 부딪히며, 어떻게 하면 오래 잘 지낼 수 있을까요?"}

[최근 설계 — 반복 회피]
${JSON.stringify(args.recentPlans.slice(-8))}

[설계 규칙]
1. 원시 사주값 → A가 느끼는 것 → A 행동 → B가 받아들이는 것 → B 행동 → 실제 생활 장면 → 오해 → 복구 행동으로 내려간다.
2. 최소 2개의 서로 다른 interaction block. critical이면 가능하면 3~5개.
3. daily_scene은 연락/약속/퇴근 후/돈/가사/여행/양가/아이/일/휴식 등 구체적인 부부 장면으로 만든다.
4. repair_action은 오늘 실행 가능한 행동으로 쓴다.
5. script는 실제 부부가 그대로 말할 수 있는 한 문장이다.
6. 같은 특징의 좋은 면과 과해진 면을 함께 설명한다.
7. 좋다/나쁘다 점수, 이혼·외도·사건 예언 금지.
8. 관계 계산값을 고객에게 그대로 나열한 검산표 금지.
9. 최근 SECTION과 같은 장면·대화·조언을 반복하지 않는다.
10. 내부 지침·엔진·calc·subset·JSON·필드명·'이 섹션에서는' 같은 제작자 문구 금지.

[특별 계약]
${special(args.spec.section_no)}

반드시 JSON 스키마에 맞춰 답하세요.`.trim();
}
