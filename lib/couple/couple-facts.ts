export type CoupleFacts = {
  partner: any;
  cross_relations: Record<string, string[]>;
  day_master_pair: { a: string; b: string; relation: string | null };
  day_branch_pair: { a: string; b: string; relations: string[] };
  element_exchange: Array<{ element: string; a: number; b: number; relation_hint: string }>;
  timing_matrix: {
    year: number | null;
    a_current_daeun: any;
    b_current_daeun: any;
    a_annual_flow: any;
    b_annual_flow: any;
    monthly_pairs: Array<{ month: number; a: any; b: any }>;
  };
};

const GAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const JI = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const fs = (a:number,b:number) => [a,b].sort((x,y)=>x-y).join(",");
const GANHAP = new Set([fs(0,5),fs(1,6),fs(2,7),fs(3,8),fs(4,9)]);
const YUKHAP = new Set([fs(0,1),fs(2,11),fs(3,10),fs(4,9),fs(5,8),fs(6,7)]);
const CHUNG = new Set([fs(0,6),fs(1,7),fs(2,8),fs(3,9),fs(4,10),fs(5,11)]);
const PA = new Set([fs(0,9),fs(3,6),fs(4,1),fs(7,10),fs(2,11),fs(5,8)]);
const HAE = new Set([fs(0,7),fs(1,6),fs(2,5),fs(3,4),fs(8,11),fs(9,10)]);
const HYEONG = new Set([fs(2,5),fs(5,8),fs(2,8),fs(1,10),fs(10,7),fs(1,7),fs(0,3)]);
const WONJIN = new Set([fs(0,7),fs(1,6),fs(2,9),fs(3,8),fs(4,11),fs(5,10)]);
const SAMHAP: Record<string, number[]> = {"수국":[8,0,4],"화국":[2,6,10],"금국":[5,9,1],"목국":[11,3,7]};
const WANGJI: Record<string, number> = {"수국":0,"화국":6,"금국":9,"목국":3};
const POSITIONS = ["year","month","day","hour"] as const;
const LABEL: Record<string,string> = {year:"연",month:"월",day:"일",hour:"시"};

function num(v:any): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    for (const k of ["count","value","pct","percent","total"]) if (Number.isFinite(Number(v[k]))) return Number(v[k]);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function elementRows(a:any,b:any) {
  const keys = ["목","화","토","금","수"];
  const aliases: Record<string,string[]> = {목:["목","木"],화:["화","火"],토:["토","土"],금:["금","金"],수:["수","水"]};
  const value=(obj:any,k:string)=>{
    if (!obj || typeof obj !== "object") return 0;
    for (const key of aliases[k]) if (key in obj) return num(obj[key]);
    return 0;
  };
  return keys.map((element)=>{
    const av=value(a,element), bv=value(b,element);
    let relation_hint="두 사람이 함께 채워야 할 영역";
    if (av > bv*1.35 && av>0) relation_hint="A가 상대적으로 더 많이 가진 자원";
    else if (bv > av*1.35 && bv>0) relation_hint="B가 상대적으로 더 많이 가진 자원";
    else if (av>0 || bv>0) relation_hint="두 사람의 온도가 비교적 비슷한 영역";
    return {element,a:av,b:bv,relation_hint};
  });
}

export function buildCrossRelations(a:any,b:any) {
  const pa = a?.pillars?.raw || {};
  const pb = b?.pillars?.raw || {};
  const out: Record<string,string[]> = {천간합:[],육합:[],삼합:[],반합:[],충:[],형:[],파:[],해:[],원진:[]};
  for (const ka of POSITIONS) {
    const A=pa?.[ka]; if(!A) continue;
    for (const kb of POSITIONS) {
      const B=pb?.[kb]; if(!B) continue;
      const ga=GAN.indexOf(A.gan), gb=GAN.indexOf(B.gan), ja=JI.indexOf(A.ji), jb=JI.indexOf(B.ji);
      const glab=`A${LABEL[ka]}간·B${LABEL[kb]}간 ${A.gan}${B.gan}`;
      const jlab=`A${LABEL[ka]}지·B${LABEL[kb]}지 ${A.ji}${B.ji}`;
      if (ga>=0 && gb>=0 && GANHAP.has(fs(ga,gb))) out.천간합.push(glab+"합");
      if (ja>=0 && jb>=0) {
        if (YUKHAP.has(fs(ja,jb))) out.육합.push(jlab+"합");
        if (CHUNG.has(fs(ja,jb))) out.충.push(jlab+"충");
        if (HYEONG.has(fs(ja,jb))) out.형.push(jlab+"형");
        if (PA.has(fs(ja,jb))) out.파.push(jlab+"파");
        if (HAE.has(fs(ja,jb))) out.해.push(jlab+"해");
        if (WONJIN.has(fs(ja,jb))) out.원진.push(jlab+"원진");
      }
    }
  }
  const branches: Array<{who:string,pos:string,idx:number}> = [];
  for (const [who,p] of [["A",pa],["B",pb]] as any[]) for (const k of POSITIONS) if (p?.[k]) branches.push({who,pos:k,idx:JI.indexOf(p[k].ji)});
  for (const [name,group] of Object.entries(SAMHAP)) {
    const present = new Set(branches.filter(x=>group.includes(x.idx)).map(x=>x.idx));
    const hasA = branches.some(x=>x.who==="A" && group.includes(x.idx));
    const hasB = branches.some(x=>x.who==="B" && group.includes(x.idx));
    if (!hasA || !hasB) continue;
    if (present.size===3) out.삼합.push(`두 명식 교차 ${name} 삼합`);
    else if (present.size===2 && present.has(WANGJI[name])) out.반합.push(`두 명식 교차 ${name} 반합`);
  }
  return Object.fromEntries(Object.entries(out).filter(([,v])=>v.length));
}

export function buildCoupleFacts(a:any,b:any): CoupleFacts {
  const cross_relations = buildCrossRelations(a,b);
  const aDayGan = a?.pillars?.raw?.day?.gan || String(a?.day_master||"").slice(0,1);
  const bDayGan = b?.pillars?.raw?.day?.gan || String(b?.day_master||"").slice(0,1);
  const ag=GAN.indexOf(aDayGan), bg=GAN.indexOf(bDayGan);
  const aDayJi = a?.pillars?.raw?.day?.ji || "";
  const bDayJi = b?.pillars?.raw?.day?.ji || "";
  const aj=JI.indexOf(aDayJi), bj=JI.indexOf(bDayJi);
  const dayRels:string[]=[];
  if (aj>=0 && bj>=0) {
    if (YUKHAP.has(fs(aj,bj))) dayRels.push("육합");
    if (CHUNG.has(fs(aj,bj))) dayRels.push("충");
    if (HYEONG.has(fs(aj,bj))) dayRels.push("형");
    if (PA.has(fs(aj,bj))) dayRels.push("파");
    if (HAE.has(fs(aj,bj))) dayRels.push("해");
    if (WONJIN.has(fs(aj,bj))) dayRels.push("원진");
  }
  const monthsA = Array.isArray(a?.monthly_flow) ? a.monthly_flow : [];
  const monthsB = Array.isArray(b?.monthly_flow) ? b.monthly_flow : [];
  const monthly_pairs = Array.from({length:12},(_,i)=>({month:i+1,a:monthsA[i]||null,b:monthsB[i]||null}));
  return {
    partner: b,
    cross_relations,
    day_master_pair: {a:aDayGan,b:bDayGan,relation:ag>=0&&bg>=0&&GANHAP.has(fs(ag,bg))?`${aDayGan}${bDayGan}합`:null},
    day_branch_pair: {a:aDayJi,b:bDayJi,relations:dayRels},
    element_exchange: elementRows(a?.five_elements,b?.five_elements),
    timing_matrix: {
      year: a?.annual_flow?.year || b?.annual_flow?.year || null,
      a_current_daeun:a?.current_daeun||null,
      b_current_daeun:b?.current_daeun||null,
      a_annual_flow:a?.annual_flow||null,
      b_annual_flow:b?.annual_flow||null,
      monthly_pairs,
    },
  };
}

export function combineCoupleContext(a:any,b:any,facts:CoupleFacts) {
  return {
    ...a,
    partner_identity:b?.identity,
    partner_pillars:b?.pillars,
    partner_day_master:b?.day_master,
    partner_strength:b?.strength,
    partner_strength_pct:b?.strength_pct,
    partner_useful_god_candidates:b?.useful_god_candidates,
    partner_five_elements:b?.five_elements,
    partner_strongest:b?.strongest,
    partner_weakest:b?.weakest,
    partner_lacking:b?.lacking,
    partner_ten_gods:b?.ten_gods,
    partner_hidden_stems:b?.hidden_stems,
    partner_twelve_stages:b?.twelve_stages,
    partner_relations:b?.relations,
    partner_sinsal:b?.sinsal,
    partner_twelve_sinsal:b?.twelve_sinsal,
    partner_daeun:b?.daeun,
    partner_current_daeun:b?.current_daeun,
    partner_annual_flow:b?.annual_flow,
    partner_monthly_flow:b?.monthly_flow,
    partner_time_status:b?.time_status,
    cross_relations:facts.cross_relations,
    day_master_pair:facts.day_master_pair,
    day_branch_pair:facts.day_branch_pair,
    element_exchange:facts.element_exchange,
    couple_timing_matrix:facts.timing_matrix,
  };
}
