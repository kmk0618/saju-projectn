import type { ReportSectionSpec } from "@/lib/report-spec";

export type CoupleCandidate={section_no?:number;subtitle?:string;opening_sentence?:string;content_html?:string;key_basis?:string[];life_scenes?:string[];a_perspective?:string[];b_perspective?:string[];repair_actions?:string[];scripts?:string[];reframe?:string;risk?:string;action_point?:string;emphasis?:string;layout_type?:string;checklist?:string[];table_rows?:Array<{label?:string;value?:string}>};
const INTERNAL:Array<{code:string;re:RegExp}>=[
  {code:"META_GUIDELINE",re:/(지침|작성\s*규칙|생성\s*규칙|프롬프트|스키마|schema|prompt)/i},
  {code:"META_ENGINE",re:/(만세력\s*엔진|사이트\s*엔진|deterministic|calc(?:ulation)?|subset|JSON|필드명|내부\s*(?:데이터|계산|검증))/i},
  {code:"META_MISSING",re:/(제공된\s*(?:값|계산값|데이터)|계산값이\s*(?:없|제시되지)|새로\s*계산하지|확정하시기\s*바랍니다)/i},
  {code:"AUTHOR_VOICE",re:/(이\s*섹션에서는|이번\s*섹션에서는|아래\s*데이터를\s*바탕으로)/i},
  {code:"RAW_AUDIT_TABLE",re:/(구조\s*확인|참고\s*방법|관계\s*종류\s*[|·/]\s*사주\s*구조)/i},
];
function text(x:any){return String(x??"").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();}
function all(c:CoupleCandidate){return text([c.subtitle,c.opening_sentence,c.content_html,c.risk,c.action_point,c.emphasis,c.reframe,...(c.life_scenes||[]),...(c.a_perspective||[]),...(c.b_perspective||[]),...(c.repair_actions||[]),...(c.scripts||[]),...(c.checklist||[]),...(c.table_rows||[]).flatMap(x=>[x.label,x.value])].join("\n"));}

export function validateCoupleSectionDepth(args:{spec:ReportSectionSpec;candidate:CoupleCandidate;plan?:any}){
  const {spec,candidate:c}=args; const issues:string[]=[]; const visible=all(c);
  for(const r of INTERNAL) if(r.re.test(visible)) issues.push(r.code);
  const deep=spec.depth==="deep"||spec.depth==="critical";
  if(deep && (c.life_scenes?.length||0)<2) issues.push("NEEDS_2_LIFE_SCENES");
  if(deep && (c.a_perspective?.length||0)<1) issues.push("NEEDS_A_PERSPECTIVE");
  if(deep && (c.b_perspective?.length||0)<1) issues.push("NEEDS_B_PERSPECTIVE");
  if(deep && (c.repair_actions?.length||0)<2) issues.push("NEEDS_2_REPAIR_ACTIONS");
  if(deep && (c.scripts?.length||0)<1) issues.push("NEEDS_SCRIPT");
  if(!text(c.reframe)) issues.push("NEEDS_RELATION_REFRAME");
  if(spec.section_no===12 && /(합|충|형|파|해|원진).{0,15}(구조 확인|참고)/.test(visible)) issues.push("RAW_RELATION_AUDIT_TABLE");
  if(spec.section_no===20 && !/(시작|누적|반응|악순환|패턴|다시|회복)/.test(visible)) issues.push("CONFLICT_LOOP_TOO_SHALLOW");
  if(spec.section_no===41 && (c.scripts?.length||0)<8) issues.push("S41_NEEDS_8_SCRIPTS");
  if(spec.section_no===42 && (c.scripts?.length||0)<12) issues.push("S42_NEEDS_MANY_GOOD_WORDS");
  if(spec.section_no===43 && (c.table_rows?.length||0)<10) issues.push("S43_NEEDS_10_REPLACEMENTS");
  if(spec.section_no===49 && !/(1개월|3개월|1년)/.test(visible)) issues.push("S49_ROADMAP_MISSING");
  if(spec.section_no===50 && !/(한 문장|살릴|멈|실천|질문)/.test(visible)) issues.push("S50_FINAL_ANSWER_INCOMPLETE");
  return {ok:issues.length===0,issues:[...new Set(issues)]};
}

export function auditCoupleReportDepth(rows:any[],outline:ReportSectionSpec[],narrative:any){
  const failures:Array<{section_no:number;issues:string[]}>=[]; const map=new Map(outline.map(s=>[s.section_no,s]));
  for(const row of rows||[]){const no=Number(row?.section_no||0),spec=map.get(no); if(!spec)continue; const j=row?.content_json||{}; const r=validateCoupleSectionDepth({spec,candidate:{section_no:no,subtitle:j.subtitle||"",opening_sentence:j.opening_sentence||"",content_html:row?.content_html||"",key_basis:j.key_basis||[],life_scenes:j.life_scenes||[],a_perspective:j.a_perspective||[],b_perspective:j.b_perspective||[],repair_actions:j.repair_actions||[],scripts:j.scripts||[],reframe:j.reframe||"",risk:j.risk||"",action_point:j.action_point||"",emphasis:j.emphasis||"",layout_type:j.layout_type||spec.layout_type,checklist:j.checklist||[],table_rows:j.table_rows||[]}}); if(!r.ok)failures.push({section_no:no,issues:r.issues});}
  const nt=text([narrative?.core_thesis,narrative?.attraction_axis,narrative?.core_tension,narrative?.current_question_thesis,...Object.values(narrative?.chapter_theses||{})].join(" ")); const ni:string[]=[]; for(const r of INTERNAL) if(r.re.test(nt)) ni.push(r.code); if(ni.length)failures.push({section_no:0,issues:[...new Set(ni)]});
  return {ok:failures.length===0,failures};
}
