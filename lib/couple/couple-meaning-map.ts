export type CoupleMeaningContext = {
  personA: RelationshipMeaning;
  personB: RelationshipMeaning;
  cross: any;
  guardrails: string[];
};

type RelationshipMeaning = {
  day_master: any;
  strength: any;
  strength_pct: any;
  useful_god_candidates: any;
  five_elements: any;
  ten_gods: any;
  relationship_tendencies: Array<{source:string; strengths:string[]; stress:string[]; needs:string[]}>;
  energy_notes: string[];
};

const MAP: Record<string,{strengths:string[];stress:string[];needs:string[]}> = {
  식신:{strengths:["편안하게 챙기고 일상을 함께 만드는 힘","감정을 행동과 생활로 표현하는 경향"],stress:["반복되는 의무가 많으면 애정 표현이 줄 수 있음"],needs:["편안한 일상","함께 즐기는 시간"]},
  상관:{strengths:["솔직한 표현과 대화의 힘","관계의 문제를 빠르게 감지하는 감각"],stress:["답답하면 말이 강해지거나 비판적으로 들릴 수 있음"],needs:["말할 자유","납득 가능한 설명"]},
  정재:{strengths:["약속과 생활을 안정적으로 관리하는 힘","관계를 현실적으로 지키는 태도"],stress:["변화와 불확실성을 부담스러워할 수 있음"],needs:["예측 가능한 계획","합의된 기준"]},
  편재:{strengths:["관계를 활기 있게 만들고 경험을 넓히는 힘","현실 기회를 함께 만들려는 성향"],stress:["일·돈·사람에 에너지가 분산될 수 있음"],needs:["자율성","큰 방향에 대한 신뢰"]},
  정관:{strengths:["책임과 신의를 중요하게 여김","관계를 가볍게 다루지 않는 태도"],stress:["옳고 그름이 강해지면 상대를 평가할 수 있음"],needs:["신뢰","약속 준수"]},
  편관:{strengths:["위기에서 책임지고 버티는 힘","관계를 지키려는 강한 책임감"],stress:["압박이 커지면 통제·긴장·직설로 나타날 수 있음"],needs:["존중받는 경계","역할의 명확성"]},
  정인:{strengths:["상대 마음을 이해하고 받아주는 힘","대화를 통해 안정되는 경향"],stress:["생각과 감정을 오래 품고 결론이 늦어질 수 있음"],needs:["충분한 대화","정서적 안전"]},
  편인:{strengths:["상대의 미묘한 변화와 맥락을 읽는 힘","관계를 깊게 생각하는 성향"],stress:["혼자 해석이 길어지면 오해가 커질 수 있음"],needs:["혼자 정리할 시간","명확한 확인"]},
  비견:{strengths:["자기 의견과 영역을 지키는 힘","동등한 파트너십을 중시"],stress:["상대가 대신 결정하면 반발할 수 있음"],needs:["존중","선택권"]},
  겁재:{strengths:["함께 도전하고 움직이는 에너지","관계에 활력을 주는 힘"],stress:["경쟁·비교·주도권 싸움으로 번질 수 있음"],needs:["공정함","각자의 영역"]},
};

function count(v:any){
  if(typeof v==="number") return v;
  if(v&&typeof v==="object") for(const k of ["count","value","total"]) if(Number.isFinite(Number(v[k]))) return Number(v[k]);
  const n=Number(v); return Number.isFinite(n)?n:0;
}
function entries(t:any):Array<[string,number]>{
  if(!t) return [];
  if(Array.isArray(t)) return t.map((x:any)=>[String(x?.name||x?.label||x?.god||""),count(x?.count??x?.value??1)] as [string,number]).filter(x=>x[0]&&x[1]>0);
  return Object.entries(t).map(([k,v])=>[k,count(v)] as [string,number]).filter(x=>x[1]>0);
}
function person(ctx:any):RelationshipMeaning{
  const relationship_tendencies=entries(ctx?.ten_gods).flatMap(([name,n])=>MAP[name]?[{source:`${name}:${n}`,...MAP[name]}]:[]);
  const energy_notes:string[]=[];
  const s=String(ctx?.strength||""); const p=Number(ctx?.strength_pct);
  if(/태약|신약/.test(s)||(Number.isFinite(p)&&p<40)) energy_notes.push("관계에서 버티는 힘과 회복력을 따로 관리해야 함","둘 다 지친 시기에는 상대에게만 기대지 말고 외부의 쉼과 도움도 필요함");
  else if(/신강|태강/.test(s)||(Number.isFinite(p)&&p>60)) energy_notes.push("의견과 추진력이 강해질 때 상대의 속도와 경계를 의식해야 함");
  else energy_notes.push("관계 에너지의 균형을 일정하게 유지하는 것이 중요함");
  return {day_master:ctx?.day_master,strength:ctx?.strength,strength_pct:ctx?.strength_pct,useful_god_candidates:ctx?.useful_god_candidates,five_elements:ctx?.five_elements,ten_gods:ctx?.ten_gods,relationship_tendencies,energy_notes};
}

export function buildCoupleMeaningContext(a:any,b:any,cross:any):CoupleMeaningContext{
  return {
    personA:person(a), personB:person(b), cross,
    guardrails:[
      "누가 더 좋은 사람인지 판정하지 않는다",
      "합이 있다고 무조건 좋다, 충이 있다고 무조건 나쁘다고 단정하지 않는다",
      "사주 관계값은 실제 생활 장면과 상호작용을 이해하는 근거로만 사용한다",
      "상대의 성격을 결함·낙인으로 규정하지 않는다",
      "갈등은 A의 행동→B의 해석→B의 반응→A의 재해석처럼 상호작용 루프로 설명한다",
      "대운·세운은 두 사람 각각의 실제 계산값을 함께 보고 시기를 단정 대신 대응 전략으로 제시한다",
      "내부 제작과정·프롬프트·엔진·필드명을 고객 본문에 노출하지 않는다",
    ],
  };
}
