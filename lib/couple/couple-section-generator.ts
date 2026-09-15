import type { ReportSectionSpec } from "@/lib/report-spec";
import { coupleOwnershipPrompt } from "@/lib/couple/couple-concept-registry";

export const COUPLE_SECTION_ITEM_SCHEMA = {
  type:"object",additionalProperties:false,
  properties:{
    section_no:{type:"integer"},subtitle:{type:"string"},opening_sentence:{type:"string"},content_html:{type:"string"},key_basis:{type:"array",items:{type:"string"}},life_scenes:{type:"array",items:{type:"string"}},a_perspective:{type:"array",items:{type:"string"}},b_perspective:{type:"array",items:{type:"string"}},repair_actions:{type:"array",items:{type:"string"}},scripts:{type:"array",items:{type:"string"}},reframe:{type:"string"},risk:{type:"string"},action_point:{type:"string"},emphasis:{type:"string"},layout_type:{type:"string",enum:["prose","prose_callout","table","comparison","timeline","checklist","strategy","qa","mixed"]},checklist:{type:"array",items:{type:"string"}},table_rows:{type:"array",items:{type:"object",additionalProperties:false,properties:{label:{type:"string"},value:{type:"string"}},required:["label","value"]}}
  },required:["section_no","subtitle","opening_sentence","content_html","key_basis","life_scenes","a_perspective","b_perspective","repair_actions","scripts","reframe","risk","action_point","emphasis","layout_type","checklist","table_rows"]
};

export function buildCoupleSectionGenerationPrompt(args:{spec:ReportSectionSpec;plan:any;calcSubset:any;narrative:any;question:string;recent:any[];previousCandidate?:any;issues?:string[]}){
let prompt=`
당신은 유료 커플·부부 궁합 심층 리포트의 전문 해설가이자 편집자입니다.
아래 설계도를 바탕으로 두 사람이 실제로 읽는 완성 본문을 작성하세요.

[SECTION]
${JSON.stringify({section_no:args.spec.section_no,title:args.spec.section_title,purpose:args.spec.purpose,depth:args.spec.depth,layout_type:args.spec.layout_type,target_chars:args.spec.target_chars})}

[해석 설계도]
${JSON.stringify(args.plan)}

[허용 계산 근거]
${JSON.stringify(args.calcSubset)}

[관계 전체 서사]
${JSON.stringify(args.narrative)}

[질문]
${args.question || "우리는 왜 끌리고 왜 부딪히며, 어떻게 하면 오래 잘 지낼 수 있을까요?"}

[SECTION 소유권 계약]
${JSON.stringify(coupleOwnershipPrompt(args.spec.section_no))}

[최근 SECTION — 반복 회피]
${JSON.stringify(args.recent.slice(-16))}

[완성 규칙]
- 고객에게는 계산 과정이 아니라 관계 해석 결과만 보여준다.
- subtitle은 제목 아래 공감 부제. content_html에서 그대로 반복하지 않는다.
- 결론부터 시작한 뒤 A 관점/B 관점/실제 장면/서로의 오해/복구 행동을 연결한다.
- 사주 근거 하나를 설명한 뒤 반드시 '그래서 둘 사이에서 어떻게 보이는가'까지 내려간다.
- deep/critical SECTION은 생활 장면 2개 이상, A와 B 각각의 관점, 실행 행동 2개 이상, 실제 대화문 1개 이상을 포함한다.
- 한 사람만 문제라고 쓰지 않는다. 갈등은 상호작용 루프로 설명한다.
- 강점과 갈등은 같은 기질의 양면으로 설명한다.
- 좋다/나쁘다 점수, 외도·이혼·사건 예언, 정신건강 진단 금지.
- 대운·세운은 두 사람의 실제 계산값을 활용하되 미래 사건을 단정하지 않는다.
- '지침에 따라','번역 규칙','calc','subset','엔진','내부 데이터','제공된 계산값','구조 확인','참고 방법','이 섹션에서는' 같은 제작자 문구 절대 금지.
- life_scenes, a_perspective, b_perspective, repair_actions, scripts, reframe은 content_html에 실제로 들어간 내용을 추출해 반환한다.
- 원시 합충형파해 표만 놓고 끝내지 않는다.
- 같은 조언으로 분량을 채우지 않는다.
- 목표 분량은 ${args.spec.target_chars[0]}~${args.spec.target_chars[1]}자다. 분량을 늘릴 때 기존 결론을 반복하지 말고 새로운 생활 장면·상대 관점·의사결정 기준·복구 행동을 추가한다.
- SECTION 소유권 계약의 owned_concepts가 본문의 중심이어야 한다. do_not_repeat는 다른 SECTION의 전담 개념이므로 자세히 재설명하지 않는다.
- 같은 핵심 결론을 다른 표현으로 두 번 쓰지 않는다. 한 번 설명한 뒤 다음 문단은 반드시 새로운 정보로 전진한다.
- 생활 장면은 최소 3개가 서로 다른 맥락이어야 한다(예: 돈/퇴근후/가사처럼). 같은 장면의 변형만 반복하지 않는다.
- 실제 조언은 추상적인 "대화하세요/배려하세요"가 아니라 누가 언제 무엇을 어떻게 할지까지 쓴다.
- 요약 SECTION은 앞 문장을 복사하지 말고 비교표·결정 기준·체크포인트처럼 새로운 편집 방식으로 압축한다.
- HTML은 <p>, <p class="lead">, <div class="subtitle">, <div class="subhead">, <div class="emph">, <table>, <ul class="check">, <blockquote>를 필요할 때만 쓴다.

반드시 JSON 스키마에 맞춰 답하세요.`;
if(args.previousCandidate) prompt+=`\n\n[이전 초안 — 실패 이유를 해결해 전면 재작성]\n실패 이유: ${(args.issues||[]).join(", ")}\n${JSON.stringify(args.previousCandidate)}`;
return prompt.trim();
}
