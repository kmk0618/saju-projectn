// Local renderer check with synthetic content; no order/database/AI calls.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
const require=createRequire(import.meta.url);
const source=fs.readFileSync('lib/report-pdf.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{exports:mod.exports,module:mod,Buffer,console,process,require:id=>{
  if(id==='puppeteer-core')return puppeteer;
  if(id==='@sparticuz/chromium')return chromium;
  if(id==='@/lib/report-spec')return {REPORT_VERSION:'synthetic-test'};
  return require(id);
}});
if(process.platform==='win32' && !process.env.PDF_CHROME_PATH)process.env.PDF_CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe';
const html=mod.exports.buildReportHtml({title:'신년 리포트 렌더링 검사',subtitle:'실제 고객정보 없는 테스트',question:'올해의 계획을 어떻게 정리할까요?',generatedAt:'2026-09-17',input:{gender:'여',y:2000,m:2,d:29,unknown_time:true},reportCategory:'new_year',narrative:null,
  sections:[{section_no:1,part_no:1,part_title:'한 해의 계획',section_title:'실행 계획',content_html:'<p class="lead">문단·표·한글 글꼴을 점검하는 예시입니다.</p><table><tr><th>구분</th><th>계획</th></tr><tr><td>첫 번째</td><td>일정을 기록하고 주간 계획을 점검합니다.</td></tr></table><ul class="check"><li>이번 주에 할 일 한 가지를 정합니다.</li></ul><img src="http://127.0.0.1:1/blocked"><script>throw new Error("must not run")</script>'}]});
const pdf=await mod.exports.htmlToPdfBuffer(html);
fs.mkdirSync('.private',{recursive:true});fs.writeFileSync('.private/renderer-smoke.pdf',pdf);
console.log('Local synthetic PDF rendered: '+pdf.length+' bytes');
