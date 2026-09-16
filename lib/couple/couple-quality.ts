import type { ReportSectionSpec } from "@/lib/report-spec";

export type CoupleCandidate={section_no?:number;subtitle?:string;opening_sentence?:string;content_html?:string;key_basis?:string[];life_scenes?:string[];a_perspective?:string[];b_perspective?:string[];repair_actions?:string[];scripts?:string[];reframe?:string;risk?:string;action_point?:string;emphasis?:string;layout_type?:string;checklist?:string[];table_rows?:Array<{label?:string;value?:string}>};
const INTERNAL:Array<{code:string;re:RegExp}>=[
  {code:"META_GUIDELINE",re:/(지침|작성\s*규칙|생성\s*규칙|프롬프트|스키마|schema|prompt)/i},
  {code:"META_ENGINE",re:/(만세력\s*엔진|사이트\s*엔진|deterministic|calc(?:ulation)?|subset|JSON|필드명|내부\s*(?:데이터|계산|검증))/i},
  {code:"META_MISSING",re:/(제공된\s*(?:값|계산값|데이터)|계산값이\s*(?:없|제시되지)|새로\s*계산하지|확정하시기\s*바랍니다)/i},
  {code:"AUTHOR_VOICE",re:/(이\s*섹션에서는|이번\s*섹션에서는|아래\s*데이터를\s*바탕으로)/i},
  {code:"RAW_AUDIT_TABLE",re:/(구조\s*확인|참고\s*방법|관계\s*종류\s*[|·/]\s*사주\s*구조)/i},
  {code:"ARBITRARY_REPEAT_BOX",re:/(관계\s*점검\s*질문|이\s*SECTION의\s*판단\s*기준|유지\s*[·/|]\s*조정\s*[·/|]\s*경고|실제\s*생활에서\s*더\s*깊게\s*보면|관계\s*구조를\s*생활로\s*번역하면)/i},
];
function text(x:any){return String(x??"").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();}
function all(c:CoupleCandidate){return text([c.subtitle,c.opening_sentence,c.content_html,c.risk,c.action_point,c.emphasis,c.reframe,...(c.life_scenes||[]),...(c.a_perspective||[]),...(c.b_perspective||[]),...(c.repair_actions||[]),...(c.scripts||[]),...(c.checklist||[]),...(c.table_rows||[]).flatMap(x=>[x.label,x.value])].join("\n"));}

export function validateCoupleSectionDepth(args:{spec:ReportSectionSpec;candidate:CoupleCandidate;plan?:any}){
  const {spec,candidate:c}=args; const issues:string[]=[]; const visible=all(c);
  for(const r of INTERNAL) if(r.re.test(visible)) issues.push(r.code);
  const deep=spec.depth==="deep"||spec.depth==="critical";
  const critical=spec.depth==="critical";
  const minScenes=critical?3:deep?2:1;
  const minRepairs=critical?3:deep?2:1;
  if((c.life_scenes?.length||0)<minScenes) issues.push(`NEEDS_${minScenes}_LIFE_SCENES`);
  if(deep && (c.a_perspective?.length||0)<1) issues.push("NEEDS_A_PERSPECTIVE");
  if(deep && (c.b_perspective?.length||0)<1) issues.push("NEEDS_B_PERSPECTIVE");
  if((c.repair_actions?.length||0)<minRepairs) issues.push(`NEEDS_${minRepairs}_REPAIR_ACTIONS`);
  if(deep && (c.scripts?.length||0)<1) issues.push("NEEDS_SCRIPT");
  if(args.plan && (args.plan?.new_information?.length||0)<3) issues.push("PLAN_NEEDS_3_NEW_INFORMATION");
  if(args.plan && (args.plan?.scene_domains_used?.length||0)<2) issues.push("PLAN_NEEDS_2_SCENE_DOMAINS");
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


function ngrams(s:string,n=5){
  const t=text(s).replace(/[\s.,!?“”"'()\[\]{}:;·—–-]/g,"");
  const out=new Set<string>();
  for(let i=0;i<=t.length-n;i++) out.add(t.slice(i,i+n));
  return out;
}
function sim(a:string,b:string,n=5){
  const A=ngrams(a,n),B=ngrams(b,n);
  if(!A.size||!B.size)return 0;
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  return inter/(A.size+B.size-inter);
}
function sentences(s:string){
  const plain=text(s).replace(/([.!?]|다\.|요\.|니다\.)/g,"$1\n");
  return plain.split(/\n+/).map(x=>x.trim()).filter(x=>x.length>=28);
}
function canonicalSentence(s:string){
  return text(s).replace(/[“”"'‘’()[\]{}<>]/g,"").replace(/\s+/g," ").trim();
}
function newInfoRatio(body:string,seen:Set<string>){
  const G=ngrams(body,5); if(!G.size)return 1;
  let fresh=0; for(const x of G) if(!seen.has(x)) fresh++;
  return fresh/G.size;
}
function addNgrams(body:string,seen:Set<string>){ for(const x of ngrams(body,5)) seen.add(x); }

const SUMMARY_SECTIONS=new Set([15,35,50]);

export function auditCoupleReportUniqueness(rows:any[],outline:ReportSectionSpec[]){
  const failures:Array<{section_no:number;issues:string[]}>=[]; 
  const sorted=[...(rows||[])].sort((a,b)=>Number(a?.section_no||0)-Number(b?.section_no||0));
  const seenSentence=new Map<string,number>();
  const seenNgrams=new Set<string>();
  const priorBodies:Array<{no:number;body:string}>=[];

  const fail=(no:number,issue:string)=>{
    const found=failures.find(x=>x.section_no===no);
    if(found){ if(!found.issues.includes(issue)) found.issues.push(issue); }
    else failures.push({section_no:no,issues:[issue]});
  };

  for(const row of sorted){
    const no=Number(row?.section_no||0); if(no<1||no>outline.length) continue;
    const j=row?.content_json||{};
    const body=text(row?.content_html||"");

    for(const prev of priorBodies){
      const score=sim(body,prev.body,5);
      if(score>0.46) fail(no,`BODY_SEMANTIC_DUPLICATE_WITH_S${prev.no}`);
    }

    for(const raw of sentences(row?.content_html||"")){
      const c=canonicalSentence(raw);
      if(c.length<28) continue;
      const prev=seenSentence.get(c);
      if(prev && prev!==no) fail(no,`EXACT_SENTENCE_REPEATED_FROM_S${prev}`);
      else seenSentence.set(c,no);
    }

    const groups:Array<[string,string[]]>= [
      ["SCENE",Array.isArray(j.life_scenes)?j.life_scenes:[]],
      ["SCRIPT",Array.isArray(j.scripts)?j.scripts:[]],
      ["REPAIR",Array.isArray(j.repair_actions)?j.repair_actions:[]],
    ];
    for(const [kind,list] of groups){
      for(const item of list){
        for(const prevRow of sorted){
          const pno=Number(prevRow?.section_no||0);
          if(pno>=no||pno<1) continue;
          const pj=prevRow?.content_json||{};
          const pList=kind==="SCENE"?(pj.life_scenes||[]):kind==="SCRIPT"?(pj.scripts||[]):(pj.repair_actions||[]);
          if((pList||[]).some((x:any)=>sim(String(item),String(x),3)>0.80)){
            fail(no,`${kind}_MEANING_REPEATED_FROM_S${pno}`); break;
          }
        }
      }
    }

    if(!SUMMARY_SECTIONS.has(no) && priorBodies.length>=3){
      const ratio=newInfoRatio(body,seenNgrams);
      if(ratio<0.38) fail(no,`NEW_INFORMATION_RATIO_LOW_${ratio.toFixed(2)}`);
    }
    addNgrams(body,seenNgrams);
    priorBodies.push({no,body});
  }

  return {ok:failures.length===0,failures};
}
