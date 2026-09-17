import assert from 'node:assert/strict';
const base=process.env.SAJU_TEST_URL||'http://127.0.0.1:3018';
const cases=[
  ['/saju.html',200],
  ...['life','child','compatibility','new-year'].map(x=>['/sample-'+x+'.html',200]),
  ...['life','child','couple','new-year'].map(x=>['/samples/'+x+'/preview.pdf',200]),
  ['/customer-reports/life-report-75/page-06.png',404],
  ['/api/test-guest-order-v2',404,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}],
  ['/api/test-member-order',404,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}],
  ['/api/my-reports',401],
  ['/api/guest-order?token=invalid',400],
  ['/api/report/pdf?token=invalid',400],
  ['/api/report/generate',403,{method:'POST',headers:{'Content-Type':'application/json','x-report-worker':'1'},body:JSON.stringify({token:'11111111-1111-1111-1111-111111111111',internal:true})}],
];
for(const [url,status,options] of cases){
  const r=await fetch(base+url,options);
  assert.equal(r.status,status,url);
  if(url.endsWith('.pdf'))assert.match(r.headers.get('content-type')||'',/application\/pdf/);
  if(url.startsWith('/api/'))assert.match(r.headers.get('cache-control')||'',/no-store/);
  console.log('PASS '+r.status+' '+url);
}
for(const url of ['/guest-report.html','/report-viewer.html','/payment-return.html']){
  const r=await fetch(base+url);
  assert.equal(r.status,200);assert.equal(r.headers.get('referrer-policy'),'no-referrer');
  assert.match(r.headers.get('x-robots-tag')||'',/noindex/);
  console.log('PASS private page headers '+url);
}
console.log('HTTP smoke checks passed without DB writes, AI calls, payment or refund.');
