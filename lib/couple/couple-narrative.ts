import type { CoupleMeaningContext } from "@/lib/couple/couple-meaning-map";

export const COUPLE_NARRATIVE_SCHEMA = {
  type:"object", additionalProperties:false,
  properties:{
    core_thesis:{type:"string"},
    attraction_axis:{type:"string"},
    core_tension:{type:"string"},
    relationship_strengths:{type:"array",items:{type:"string"}},
    friction_points:{type:"array",items:{type:"string"}},
    personA_needs:{type:"array",items:{type:"string"}},
    personB_needs:{type:"array",items:{type:"string"}},
    repair_levers:{type:"array",items:{type:"string"}},
    conflict_loop:{
      type:"object",additionalProperties:false,
      properties:{trigger:{type:"string"},a_interpretation:{type:"string"},a_reaction:{type:"string"},b_interpretation:{type:"string"},b_reaction:{type:"string"},escalation:{type:"string"},repair_protocol:{type:"array",items:{type:"string"}}},
      required:["trigger","a_interpretation","a_reaction","b_interpretation","b_reaction","escalation","repair_protocol"]
    },
    love_translation:{
      type:"object",additionalProperties:false,
      properties:{a_wants:{type:"array",items:{type:"string"}},a_gives:{type:"array",items:{type:"string"}},b_wants:{type:"array",items:{type:"string"}},b_gives:{type:"array",items:{type:"string"}},missed_signals:{type:"array",items:{type:"string"}}},
      required:["a_wants","a_gives","b_wants","b_gives","missed_signals"]
    },
    life_axes:{
      type:"object",additionalProperties:false,
      properties:{money:{type:"string"},home:{type:"string"},work:{type:"string"},family:{type:"string"},intimacy:{type:"string"},future:{type:"string"},rest:{type:"string"}},
      required:["money","home","work","family","intimacy","future","rest"]
    },
    chapter_theses:{type:"object",additionalProperties:false,properties:{"1":{type:"string"},"2":{type:"string"},"3":{type:"string"}},required:["1","2","3"]},
    current_question_thesis:{type:"string"},
    basis:{type:"array",items:{type:"string"}},
  },
  required:["core_thesis","attraction_axis","core_tension","relationship_strengths","friction_points","personA_needs","personB_needs","repair_levers","conflict_loop","love_translation","life_axes","chapter_theses","current_question_thesis","basis"]
};

export function buildCoupleNarrativePrompt(args:{a:any;b:any;couple:any;meaning:CoupleMeaningContext;question:string}){
  return `
당신은 유료 커플·부부 궁합 심층 리포트의 관계 서사 설계자입니다.
아직 SECTION 본문을 쓰지 마세요. 두 사람을 각각 이해한 뒤, 두 사람이 만날 때 새로 생기는 상호작용 패턴을 하나의 일관된 서사로 설계합니다.

[핵심 원칙]
- A와 B의 개인 성향을 따로 설명하는 데서 끝내지 않는다.
- 반드시 A 행동 → B가 받아들이는 방식 → B 반응 → A가 다시 느끼는 방식까지 관계 루프로 본다.
- 합은 끌림과 결합, 충·형·파·해·원진은 자극과 마찰의 가능성으로 읽되 좋다/나쁘다 판정 금지.
- 같은 사주 근거가 강점과 갈등의 양면으로 어떻게 작동하는지 함께 잡는다.
- 돈·가사·일·가족·친밀감·미래계획·휴식의 실제 생활 축을 만든다.
- 대운·세운은 각각의 실제 계산값을 바탕으로 관계의 압력이 어떻게 엇갈리거나 겹치는지 설명한다. 사건을 예언하지 않는다.
- 고객이 읽을 문장에는 내부 규칙·계산 과정·엔진·필드명을 절대 노출하지 않는다.

[A 실제 계산 컨텍스트]
${JSON.stringify(args.a)}

[B 실제 계산 컨텍스트]
${JSON.stringify(args.b)}

[두 사람 교차 계산]
${JSON.stringify(args.couple)}

[관계 의미 변환 컨텍스트 — 내부 참고]
${JSON.stringify(args.meaning)}

[두 사람의 질문]
${args.question || "우리는 왜 끌리고 왜 부딪히며, 어떻게 하면 오래 잘 지낼 수 있을까요?"}

[출력 목표]
- core_thesis: 관계를 한 문장으로 정의.
- attraction_axis: 왜 서로에게 끌리는지.
- core_tension: 같은 차이가 갈등으로 바뀌는 핵심 지점.
- conflict_loop: 반복 싸움의 시작→누적→증폭→복구 구조.
- love_translation: 각자가 원하는 사랑/주는 사랑/상대가 놓치기 쉬운 신호.
- life_axes: 돈·가사·일·가족·친밀감·미래·휴식에서의 핵심 패턴.
- chapter_theses: 세 챕터가 서로 다른 역할을 하도록 설계.
- current_question_thesis: 마지막 SECTION 50에서 회수할 질문 답의 방향.
- basis: 내부 검증용 실제 근거 6~14개.

반드시 JSON 스키마에 맞춰 답하세요.`.trim();
}
