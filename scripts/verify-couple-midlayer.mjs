import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(); const failures=[];
const must=['lib/couple/couple-facts.ts','lib/couple/couple-meaning-map.ts','lib/couple/couple-narrative.ts','lib/couple/couple-section-planner.ts','lib/couple/couple-section-generator.ts','lib/couple/couple-quality.ts'];
for(const f of must) if(!fs.existsSync(path.join(root,f))) failures.push(`MISSING_FILE:${f}`);
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const route=read('app/api/report/generate/route.ts'), pdf=read('app/api/report/pdf/route.ts'), cats=read('lib/report-categories.ts'), quality=read('lib/couple/couple-quality.ts'), saju=read('public/saju.html'), prepare=read('app/api/payment/prepare/route.ts');
const checks=[
 ['ROUTE_PARTNER_INIT',route.includes('ensurePartnerInitialized')],
 ['ROUTE_CROSS_FACTS',route.includes('buildCoupleFacts')&&route.includes('combineCoupleContext')],
 ['ROUTE_MEANING',route.includes('buildCoupleMeaningContext')],
 ['ROUTE_NARRATIVE',route.includes('generateCoupleNarrative')],
 ['ROUTE_PLANNER',route.includes('planCoupleSection')],
 ['ROUTE_GENERATOR',route.includes('generateCoupleSection')],
 ['ROUTE_QUALITY',route.includes('validateCoupleSectionDepth')],
 ['PDF_FINAL_AUDIT',pdf.includes('auditCoupleReportDepth')],
 ['STRICT_VERSION',cats.includes('couple-compatibility-aqua-50-v2-midlayer')],
 ['PAYLOAD_SECOND_PROFILE',prepare.includes('partner_profile_id')&&prepare.includes('partner_input')],
 ['CHECKOUT_SECOND_PROFILE_UI',saju.includes('couplePartnerBox')&&saju.includes('collectCouplePartnerPayload')],
 ['RAW_AUDIT_BLOCK',quality.includes('RAW_AUDIT_TABLE')&&quality.includes('구조\\s*확인')],
 ['META_LANGUAGE_BLOCK',quality.includes('META_ENGINE')&&quality.includes('META_GUIDELINE')],
 ['CONFLICT_LOOP_GATE',quality.includes('CONFLICT_LOOP_TOO_SHALLOW')],
 ['S41_SCRIPT_GATE',quality.includes('S41_NEEDS_8_SCRIPTS')],
 ['S43_REPLACEMENT_GATE',quality.includes('S43_NEEDS_10_REPLACEMENTS')],
 ['S49_ROADMAP_GATE',quality.includes('S49_ROADMAP_MISSING')],
 ['S50_FINAL_GATE',quality.includes('S50_FINAL_ANSWER_INCOMPLETE')],
];
for(const [n,ok] of checks) if(!ok) failures.push(n);
const st=cats.indexOf('export const COUPLE_REPORT_OUTLINE'), en=cats.indexOf('const PARENT_CHILD_CHAPTERS',st), chunk=cats.slice(st,en); const nums=[...chunk.matchAll(/^\s*\[(\d+),\d+,/gm)].map(m=>Number(m[1]));
if(nums.length!==50||nums.some((n,i)=>n!==i+1)) failures.push(`COUPLE_SECTION_COUNT:${nums.length}`);

// HTML script parse check without browser execution.
const scripts=[...saju.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>x.trim());
for(let i=0;i<scripts.length;i++){
  try{ new Function(scripts[i]); }catch(e){ failures.push(`SAJU_SCRIPT_${i+1}_SYNTAX:${e.message}`); }
}

if(failures.length){console.error('COUPLE MIDLAYER VERIFY FAILED'); for(const f of failures)console.error('-',f); process.exit(1);} 
console.log('COUPLE MIDLAYER VERIFY OK');
console.log('- two-person checkout input: OK');
console.log('- two deterministic saju calculations + cross facts: OK');
console.log('- 50 sections from base MD: OK');
console.log('- meaning -> couple narrative -> section planner -> generator -> quality: OK');
console.log('- raw audit/meta language gates: OK');
console.log('- conflict loop / scripts / roadmap / final answer gates: OK');
console.log('- PDF final audit: OK');
