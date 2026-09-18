import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const require=createRequire(import.meta.url), root=process.cwd();
function loader(overrides={}) {
  const cache=new Map();
  function load(file) {
    const full=path.resolve(root,file);
    if(cache.has(full))return cache.get(full).exports;
    const mod={exports:{}};cache.set(full,mod);
    const code=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const customRequire=id=>{
      if(Object.hasOwn(overrides,id))return overrides[id];
      if(id==='next/server')return {NextResponse:{json:(data,options)=>Response.json(data,options)},after:()=>{throw new Error('Unexpected background generation');}};
      if(id==='@sparticuz/chromium'||id==='puppeteer-core')return {};
      if(id.startsWith('@/'))return load(id.slice(2)+'.ts');
      if(id.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(full),id+'.ts')));
      return require(id);
    };
    vm.runInNewContext(code,{exports:mod.exports,module:mod,require:customRequire,process,console,Buffer,Date,URL,Request,Response,crypto:webcrypto,setTimeout,clearTimeout},{filename:full});
    return mod.exports;
  }
  return load;
}
let count=0;
const test=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
const load=loader();
const {validateBirthInput,sameBirthInput,assertOwnedReference}=load('lib/birth-input.ts');
const base={y:'2000',m:'2',d:'29',h:'12',mi:'30',gender:'여',calendar_type:'solar',region:'126.98',unknown_time:false};
await test('valid leap day and explicit unknown time',()=>{
  assert.equal(validateBirthInput(base).calculation.birth_solar.day,29);
  assert.equal(validateBirthInput({...base,unknown_time:true,h:'',mi:''}).calculation.saju.hour,null);
});
await test('reject impossible dates, times, fractions, missing fields and future births',()=>{
  for(const patch of [{d:31},{y:2001},{h:25},{mi:99},{h:''},{m:1.5},{y:''},{gender:'other'},{calendar_type:'bad'},{y:2100,m:1,d:1},{region:0},{y:true}])assert.throws(()=>validateBirthInput({...base,...patch}),JSON.stringify(patch));
});
await test('reject non-existent lunar leap month and out-of-range lunar day',()=>{
  assert.throws(()=>validateBirthInput({...base,calendar_type:'lunarLeap',m:1}));
  assert.throws(()=>validateBirthInput({...base,calendar_type:'lunar',d:31}));
});
await test('calculation reuse distinguishes edited date and time',()=>{
  assert.equal(sameBirthInput(base,{...base,h:13}),false);
  assert.equal(sameBirthInput(base,{...base,d:28}),false);
  assert.equal(sameBirthInput(base,validateBirthInput(base).input),true);
});
const {reportState}=load('lib/report-state.ts');
await test('all categories complete without a life-only version check',()=>{
  for(const slug of ['life-report','child-report','couple-compatibility','parent-child-compatibility','new-year']){
    const state=reportState({status:'completed',prompt_version:'historical',report_json:{pdf_storage_path:'old.pdf',pdf_ready:true}}, {slug});
    assert.equal(state.ready,true);assert.equal(state.total,slug==='new-year'?24:slug==='parent-child-compatibility'?30:50);
  }
  assert.equal(reportState({report_json:{completed_sections:132,total_sections:50}},{}).total,132);
  assert.equal(reportState({error_message:'failed'},{}).status,'failed');
});
const {cleanContentHtml,buildReportHtml}=load('lib/report-pdf.ts');
await test('PDF strips executable markup and external resources while keeping tables',()=>{
  const clean=cleanContentHtml('<p class="lead" onclick=alert(1)>안내</p><img src="https://attacker.test" onerror=alert(1)><svg onload=alert(1)></svg><script>alert(1)</script><iframe src="file:///secret"></iframe><a href="javascript:alert(1)">링크</a><table><tr><td colspan="2">유지</td></tr></table>');
  assert.ok(!/onclick|onerror|onload|<script|<svg|<img|<iframe|https:|file:|javascript:/.test(clean));
  assert.ok(clean.includes('<table>') && clean.includes('colspan="2"'));
  const html=buildReportHtml({title:'신년',subtitle:'테스트',question:'',generatedAt:'2026-09-17',sections:[{section_no:1,part_no:1,part_title:'요약',section_title:'첫 장',content_html:'<p>본문</p>'}],input:base,narrative:null,reportCategory:'new_year'});
  assert.ok(html.includes('1개 CHAPTER · 1개 SECTION'));
  assert.ok(!html.includes('${chapters.length}'));
  assert.ok(html.includes('2000.02.29 양력'));
  const lunarHtml=buildReportHtml({title:'윤달 표기 검사',sections:[],input:{...base,calendar_type:'lunarLeap'}});
  assert.ok(lunarHtml.includes('음력(윤달)'));
});

function fakeDb(handler) {
  return {from(table){const query={table,op:'select',filters:[],value:null,select(){return this;},insert(value){this.op='insert';this.value=value;return this;},update(value){this.op='update';this.value=value;return this;},eq(k,v){this.filters.push([k,v]);return this;},is(k,v){return this.eq(k,v);},order(){return this;},limit(){return this;},maybeSingle(){return Promise.resolve(handler(this));},single(){return this.maybeSingle();},then(resolve,reject){return this.maybeSingle().then(resolve,reject);}};return query;}};
}
await test('foreign profile reference is denied using both id and owner',async()=>{
  const db=fakeDb(q=>{assert.deepEqual(q.filters,[['id','foreign'],['user_id','owner']]);return {data:null};});
  await assert.rejects(assertOwnedReference(db,'birth_profiles','foreign','owner'),/REFERENCE_NOT_OWNED/);
  await assert.rejects(assertOwnedReference(db,'birth_profiles','foreign',null),/REFERENCE_NOT_OWNED/);
});
await test('two simultaneous generation claims produce one owner, with safe release',async()=>{
  let payload={guest_input:base};
  const db=fakeDb(q=>{
    if(q.op==='select')return {data:{payment_payload:structuredClone(payload)}};
    const expected=q.filters.find(([k])=>k==='payment_payload')?.[1];
    if(expected!==JSON.stringify(payload))return {data:null};
    payload=structuredClone(q.value.payment_payload);return {data:{id:'order'}};
  });
  const {claimGeneration,releaseGeneration}=load('lib/generation-lock.ts');
  const order={id:'order',payment_payload:structuredClone(payload)};
  const claims=await Promise.all([claimGeneration(db,order),claimGeneration(db,order)]);
  assert.equal(claims.filter(Boolean).length,1);
  await releaseGeneration(db,'order','wrong');assert.ok(payload.generation_lease);
  await releaseGeneration(db,'order',claims.find(Boolean).id);assert.equal(payload.generation_lease,undefined);
  assert.deepEqual(payload.guest_input,base);
});
await test('worker header alone is rejected; signed and fresh request accepted',()=>{
  process.env.REPORT_WORKER_SECRET='isolated-test-key';
  const {workerHeaders,validWorker}=load('lib/generation-lock.ts');
  assert.equal(validWorker(new Request('http://localhost',{headers:{'x-report-worker':'1'}}),'token'),false);
  const headers=workerHeaders('token');
  assert.equal(validWorker(new Request('http://localhost',{headers}),'token'),true);
  assert.equal(validWorker(new Request('http://localhost',{headers}),'different'),false);
  assert.equal(validWorker(new Request('http://localhost',{headers:{...headers,'x-report-worker-time':'1'}}),'token'),false);
  delete process.env.REPORT_WORKER_SECRET;
});
await test('unauthenticated paid-test endpoint is disabled without database access',async()=>{
  const {POST}=load('app/api/test-guest-order-v2/route.ts');
  assert.equal((await POST()).status,404);
});
await test('guest purchase lookup requires a verified matching login email',async()=>{
  let verified=false, queried=false;
  const db=fakeDb(q=>{
    queried=true;
    assert.equal(q.table,'orders');
    assert.ok(q.filters.some(([k,v])=>k==='guest_email'&&v==='buyer@example.com'));
    assert.ok(q.filters.some(([k,v])=>k==='user_id'&&v===null));
    return {data:[]};
  });
  const originalFrom=db.from;
  db.from=table=>{const q=originalFrom(table);q.range=()=>q;return q;};
  db.auth={getUser:async()=>({data:{user:{id:'owner',email:'buyer@example.com',email_confirmed_at:verified?'2026-01-01':null}}})};
  const local=loader({'@/lib/portone':{getAdminSupabase:()=>db}});
  const request=()=>new Request('http://localhost/api/my-reports?guest=1',{headers:{authorization:'Bearer fake-session'}});
  assert.equal((await local('app/api/my-reports/route.ts').GET(request())).status,403);
  assert.equal(queried,false);
  verified=true;
  assert.equal((await local('app/api/my-reports/route.ts').GET(request())).status,200);
  assert.equal(queried,true);
});
await test('checkout rejects invalid birth input before creating a pending order',async()=>{
  let inserts=0;
  const db=fakeDb(q=>{if(q.op==='insert')inserts++;return {data:{id:'product',slug:'life-report',price_krw:19000}};});
  const local=loader({'@/lib/portone':{getAdminSupabase:()=>db,getPortOneV1PublicConfig:()=>({})}});
  const result=await local('app/api/payment/prepare/route.ts').POST(new Request('http://localhost/api/payment/prepare',{method:'POST',body:JSON.stringify({product_slug:'life-report',guest_email:'buyer@example.com',input:{...base,d:31}})}));
  assert.equal(result.status,400);assert.equal(inserts,0);
});
await test('couple checkout rejects invalid second person; new-year target is fixed in snapshot',async()=>{
  let inserted;
  const db=fakeDb(q=>{
    if(q.table==='products')return {data:{id:'product',slug:q.filters.find(([k])=>k==='slug')[1],price_krw:9900}};
    if(q.op==='insert'){inserted=q.value;return {data:{id:'order',amount_krw:9900}};}
    return {data:null};
  });
  const local=loader({'@/lib/portone':{getAdminSupabase:()=>db,getPortOneV1PublicConfig:()=>({})}});
  const request=body=>new Request('http://localhost/api/payment/prepare',{method:'POST',body:JSON.stringify({guest_email:'buyer@example.com',input:base,...body})});
  const {POST}=local('app/api/payment/prepare/route.ts');
  assert.equal((await POST(request({product_slug:'couple-compatibility',partner_input:{...base,h:25}}))).status,400);
  assert.equal(inserted,undefined);
  assert.equal((await POST(request({product_slug:'new-year',input:{...base,target_year:2099}}))).status,200);
  assert.equal(inserted.payment_payload.guest_input.target_year,2027);
});
await test('coupon pricing is server-controlled, expires, and preserves ordinary prices',async()=>{
  const code='ISOLATED-TEST-CODE';
  const policy={id:'isolated',codeHash:require('node:crypto').createHash('sha256').update(code).digest('hex'),expiresAt:'2100-01-01T00:00:00Z',amount:1000,slugs:['life-report','child-report','couple-compatibility','new-year']};
  const local=loader({'@/lib/test-coupon-policy':{TEST_COUPON:policy}});
  const {couponPricing}=local('lib/coupon-pricing.ts');
  for(const slug of policy.slugs){
    const product={slug,price_krw:19000};
    assert.equal(couponPricing(product,'').amount_krw,19000);
    assert.equal(couponPricing(product,'  isolated-test-code ').amount_krw,1000);
    assert.equal(couponPricing(product,code).discount_krw,18000);
    assert.throws(()=>couponPricing(product,'WRONG'),/INVALID_COUPON/);
    assert.throws(()=>couponPricing(product,code,Date.parse(policy.expiresAt)),/COUPON_EXPIRED/);
  }
  assert.throws(()=>couponPricing({slug:'other',price_krw:19000},code),/NOT_APPLICABLE/);
  let inserted;
  const db=fakeDb(q=>{
    if(q.table==='products') return {data:{id:'product',slug:'life-report',price_krw:19000}};
    if(q.op==='insert'){inserted=q.value;return {data:{id:'order',amount_krw:q.value.amount_krw}};}
    return {data:null};
  });
  const routes=loader({'@/lib/test-coupon-policy':{TEST_COUPON:policy},'@/lib/portone':{getAdminSupabase:()=>db,getPortOneV1PublicConfig:()=>({})}});
  const request=(coupon,amount)=>new Request('http://localhost',{method:'POST',body:JSON.stringify({product_slug:'life-report',guest_email:'buyer@example.com',input:base,coupon_code:coupon,amount_krw:amount})});
  const prepare=routes('app/api/payment/prepare/route.ts').POST;
  assert.equal((await prepare(request('WRONG',1000))).status,400);assert.equal(inserted,undefined);
  assert.equal((await prepare(request('',1))).status,200);assert.equal(inserted.amount_krw,19000);
  assert.equal((await prepare(request(code,1))).status,200);assert.equal(inserted.amount_krw,1000);
  assert.equal(inserted.status,'pending');assert.equal(inserted.payment_payload.test_mode,false);
  assert.equal(inserted.payment_payload.listed_amount_krw,19000);assert.equal(inserted.payment_payload.discount_krw,18000);
  assert.equal(JSON.stringify(inserted).includes(code),false);
  inserted=undefined;
  const quote=await routes('app/api/payment/quote/route.ts').POST(request(code,1));
  assert.equal((await quote.json()).amount_krw,1000);assert.equal(inserted,undefined);
});
await test('discounted payments still reject the wrong paid amount and retain the list price',async()=>{
  let saved;
  const db=fakeDb(q=>{saved=q.value;return {data:{id:'order'}};});
  const {markOrderPaidFromPortOneV1}=load('lib/portone.ts');
  const order={id:'order',merchant_uid:'merchant',amount_krw:1000,payment_payload:{listed_amount_krw:19000,discount_krw:18000,coupon_id:'isolated'}};
  await assert.rejects(()=>markOrderPaidFromPortOneV1(db,order,{status:'paid',amount:1,merchant_uid:'merchant'}),/AMOUNT_MISMATCH/);
  assert.equal(saved,undefined);
  await markOrderPaidFromPortOneV1(db,order,{status:'paid',amount:1000,merchant_uid:'merchant'});
  assert.equal(saved.payment_payload.listed_amount_krw,19000);assert.equal(saved.payment_payload.charged_amount_krw,1000);
});
await test('completed historical PDF is downloaded without regenerating or modifying records',async()=>{
  const db=fakeDb(q=>{
    assert.equal(q.op,'select');
    if(q.table==='orders')return {data:{id:'order',status:'paid'}};
    if(q.table==='reports')return {data:{id:'report',title:'기존 리포트',status:'completed',prompt_version:'old',report_json:{pdf_storage_path:'old.pdf',pdf_ready:true,pdf_renderer_version:'old'}}};
    throw new Error('Unexpected table '+q.table);
  });
  db.storage={from:()=>({download:async p=>{assert.equal(p,'old.pdf');return {data:new Blob(['%PDF-preserved'])};}})};
  const local=loader({'@supabase/supabase-js':{createClient:()=>db}});
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
  const result=await local('app/api/report/pdf/route.ts').GET(new Request('http://localhost/api/report/pdf?token=11111111-1111-1111-1111-111111111111'));
  assert.equal(result.status,200);assert.equal(await result.text(),'%PDF-preserved');
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.NEXT_PUBLIC_SUPABASE_URL;
});
await test('free answer responds to calculation and question topic',()=>{
  const html=fs.readFileSync('public/saju.html','utf8');
  const fn=html.slice(html.indexOf('function makeDemoAnswer('),html.indexOf('\nfunction strengthSentence'));
  const ctx={};vm.runInNewContext(fn,ctx);
  const s={ohaeng_strongest:'목',ohaeng_weakest:'수',ilgan:'갑',ilgan_strength:'신강'};
  assert.notEqual(ctx.makeDemoAnswer(s,'기타','이직할까요'),ctx.makeDemoAnswer(s,'기타','결혼할까요'));
  assert.notEqual(ctx.makeDemoAnswer(s,'기타','이직'),ctx.makeDemoAnswer({...s,ohaeng_weakest:'금',ilgan:'을'},'기타','이직'));
});
await test('guest screen completes every product and uses 24/24 for new year',async()=>{
  const html=fs.readFileSync('public/guest-report.html','utf8');
  const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)][0][1].replace(/\npoll\(\);\s*$/,'');
  for(const total of [24,30,50,132]){
    const app={innerHTML:''},box={innerHTML:''},button={};let pdfCalls=0;
    const ctx={URLSearchParams,location:{search:'?token=test'},console,Date,setTimeout:()=>{},document:{hidden:false,getElementById:id=>id==='app'?app:id==='runtimeError'?box:button},fetch:async url=>{
      if(url.startsWith('/api/guest-order'))return Response.json({ok:true,order:{product:{name:'테스트'}},report:{report_json:{}},state:{ready:true,completed:total,total}});
      pdfCalls++;throw new Error('Completed purchase must not regenerate');
    }};
    vm.createContext(ctx);vm.runInContext(script,ctx);await ctx.poll();
    assert.ok(app.innerHTML.includes('리포트 완성'));assert.equal(pdfCalls,0);
  }
  const app={innerHTML:''},box={innerHTML:''},button={};let pdfCalls=0;
  const ctx={URLSearchParams,location:{search:'?token=test'},console,Date,setTimeout:()=>{},document:{hidden:false,getElementById:id=>id==='app'?app:id==='runtimeError'?box:button},fetch:async url=>{
    if(url.startsWith('/api/guest-order'))return Response.json({ok:true,order:{},report:{report_json:{}},state:{ready:false,completed:24,total:24}});
    pdfCalls++;return new Response('%PDF-test',{headers:{'content-type':'application/pdf'}});
  }};
  vm.createContext(ctx);vm.runInContext(script,ctx);await ctx.poll();
  assert.ok(app.innerHTML.includes('24 / 24개'));assert.equal(pdfCalls,1);
});
await test('retry limit does not stop an active third attempt; stalled third attempt stops safely',async()=>{
  const html=fs.readFileSync('public/guest-report.html','utf8');
  const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)][0][1].replace(/\npoll\(\);\s*$/,'');
  const app={innerHTML:''},box={innerHTML:''},button={};let stale=false;
  const ctx={URLSearchParams,location:{search:'?token=test'},console,Date,setTimeout:()=>{},document:{hidden:false,getElementById:id=>id==='app'?app:id==='runtimeError'?box:button},fetch:async()=>Response.json({ok:true,order:{},report:{report_json:{background_heartbeat_at:Date.now()-(stale?7*60*1000:0)}},state:{ready:false,completed:12,total:50,status:'generating'}})};
  vm.createContext(ctx);vm.runInContext(script+'\nstartAttempts=3;generationStartRequested=true;',ctx);
  await ctx.poll();assert.equal(box.innerHTML,'');
  stale=true;await ctx.poll();assert.ok(box.innerHTML.includes('생성 다시 시도'));
});
await test('every public JS and inline HTML script parses',()=>{
  for(const file of fs.readdirSync('public')){
    const full=path.join('public',file),source=fs.statSync(full).isFile()?fs.readFileSync(full,'utf8'):'';
    if(file.endsWith('.js'))new vm.Script(source,{filename:file});
    if(file.endsWith('.html'))for(const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1],{filename:file});
  }
});
console.log(`AUDIT REGRESSION: ${count} checks passed; no real orders, PG payments, AI requests or production writes.`);
