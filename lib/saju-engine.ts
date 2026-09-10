// @ts-nocheck
// Deterministic manse engine v3 extracted from the validated browser engine.
const BASE=1900, BASE_NY=2415051;
const PACKED=[67949,2396,5294,43597,6732,6954,36181,2772,4954,18781,2396,54427,5274,6730,47913,5802,2772,21210,4794,59739,2358,5270,46667,3410,5544,38581,1388,4790,18743,2350,52374,7316,7498,44457,2922,1388,29358,4700,63789,6442,6804,56138,5842,2778,34139,1210,4698,22827,5418,64149,5780,5802,43733,2486,1206,29271,2646,70955,3370,3412,54698,5482,2412,38062,5294,2638,27942,6954,60757,2772,4954,43357,2396,5276,39501,6730,72361,5800,6868,53978,4790,2358,38043,5270,87627,3402,3496,54965,1388,4790,43319,2350,3222,27978,7498,69033,2906,1388,45678,4700,6444,40085,6804,6986,19285,2776,62811,1210,4698,47403,5418,5780,30538,5802,76469,2420,5302,43607,2646,5418,38549,3412,5546,19125,2412,54446,5294,2638,44326,6950,2900,30058,4826,92509,2396,5274,55885,6730,6820,47956,5844,4826,18779,2358,62615,5270,5706,46757,3496,5556];
function mod(a,n){return ((a%n)+n)%n;}
function lunarYearDays(p){const leap=p>>13,mask=p&0x1FFF,n=leap?13:12;let s=0;for(let i=0;i<n;i++)s+=((mask>>(12-i))&1)?30:29;return s;}
function lunarToJDN(Y,m,d,isLeap){
  if(Y<1900||Y>=1900+PACKED.length) throw new Error(`음력 변환 지원 범위는 1900~${1899+PACKED.length}년입니다.`);
  let ny=BASE_NY; for(let yy=BASE;yy<Y;yy++)ny+=lunarYearDays(PACKED[yy-BASE]);
  const p=PACKED[Y-BASE], leap=p>>13, mask=p&0x1FFF;
  if(isLeap && leap!==m) throw new Error(`${Y}년 음력 ${m}월은 윤달이 아닙니다.`);
  const order=[]; for(let mm=1;mm<=12;mm++){order.push([mm,false]);if(leap===mm)order.push([mm,true]);}
  let off=0;
  for(let i=0;i<order.length;i++){const L=((mask>>(12-i))&1)?30:29;if(order[i][0]===m&&order[i][1]===isLeap){if(d<1||d>L)throw new Error(`해당 음력 달은 ${L}일까지입니다.`);return ny+off+(d-1);}off+=L;}
  throw new Error('음력 변환 실패');
}
function jdnToSolar(j){let a=j+32044,b=Math.floor((4*a+3)/146097),c=a-Math.floor(146097*b/4);let d=Math.floor((4*c+3)/1461),e=c-Math.floor(1461*d/4),m=Math.floor((5*e+2)/153);return [100*b+d-4800+Math.floor(m/10),m+3-12*Math.floor(m/10),e-Math.floor((153*m+2)/5)+1];}

const CHEONGAN=['갑','을','병','정','무','기','경','신','임','계'];
const JIJI=['자','축','인','묘','진','사','오','미','신','유','술','해'];
const OHAENG=['목','화','토','금','수'];
const JIJI_OHAENG=[4,2,0,0,2,1,1,2,3,3,2,4];
const JIJI_BONGI=[9,5,0,1,4,2,3,5,6,7,4,8];
const SIP=['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'];
const DDI=['쥐','소','호랑이','토끼','용','뱀','말','양','원숭이','닭','개','돼지'];
const HIDDEN=[['계'],['기','계','신'],['갑','병','무'],['을'],['무','을','계'],['병','무','경'],['정','기'],['기','정','을'],['경','임','무'],['신'],['무','신','정'],['임','갑']];

function jdn(Y,m,d){const a=Math.floor((14-m)/12),y=Y+4800-a,mm=m+12*a-3;return d+Math.floor((153*mm+2)/5)+365*y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)-32045;}
const ANCHOR=jdn(2000,1,1),ANCHOR_IDX=54;
function ilju(Y,m,d){const idx=mod(ANCHOR_IDX+(jdn(Y,m,d)-ANCHOR),60);return {gan:CHEONGAN[idx%10],ji:JIJI[idx%12]};}
function ganji60(g,j){for(let i=0;i<60;i++)if(i%10===g&&i%12===j)return i;return -1;}
function sipseong(il,t){const same=(il%2)===(t%2),rel=mod(Math.floor(t/2)-Math.floor(il/2),5);if(rel===0)return same?'비견':'겁재';if(rel===1)return same?'식신':'상관';if(rel===2)return same?'편재':'정재';if(rel===3)return same?'편관':'정관';return same?'편인':'정인';}

/* ===== 태양 황경 기반 절입 시각 (Meeus 계열 저정밀 태양식, KST) ===== */
const KST=9*60;
function dateToJD(dt){return dt.getTime()/86400000+2440587.5;}
function jdToDate(jd){return new Date((jd-2440587.5)*86400000);}
function sunLongitude(jd){
  const T=(jd-2451545.0)/36525;
  const L0=mod(280.46646+36000.76983*T+0.0003032*T*T,360);
  const M=(357.52911+35999.05029*T-0.0001537*T*T)*Math.PI/180;
  const C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(M)+(0.019993-0.000101*T)*Math.sin(2*M)+0.000289*Math.sin(3*M);
  const omega=(125.04-1934.136*T)*Math.PI/180;
  return mod(L0+C-0.00569-0.00478*Math.sin(omega),360);
}
function angDiff(a,b){return mod(a-b+180,360)-180;}
const JIE_DEFS=[
  ['소한',285,1,6,1],['입춘',315,2,4,2],['경칩',345,3,6,3],['청명',15,4,5,4],['입하',45,5,6,5],['망종',75,6,6,6],['소서',105,7,7,7],['입추',135,8,8,8],['백로',165,9,8,9],['한로',195,10,8,10],['입동',225,11,7,11],['대설',255,12,7,0]
];
const termCache={};
function kstDateUTC(y,m,d,h=12,min=0){return new Date(Date.UTC(y,m-1,d,h-9,min,0));}
function findSolarTerm(year,name,target,m,d){
  const key=`${year}-${name}`; if(termCache[key])return new Date(termCache[key]);
  const center=kstDateUTC(year,m,d,12), span=4*86400000;
  let lo=dateToJD(new Date(center.getTime()-span)),hi=dateToJD(new Date(center.getTime()+span));
  let prevJ=lo,prev=angDiff(sunLongitude(lo),target),a=null,b=null;
  for(let i=1;i<=240;i++){const x=lo+(hi-lo)*i/240,v=angDiff(sunLongitude(x),target);if(prev===0||v===0||prev*v<0){a=prevJ;b=x;break;}prevJ=x;prev=v;}
  if(a===null)throw new Error('절기 계산 실패: '+name);
  for(let i=0;i<55;i++){const mid=(a+b)/2,fa=angDiff(sunLongitude(a),target),fm=angDiff(sunLongitude(mid),target);if(fa*fm<=0)b=mid;else a=mid;}
  const dt=jdToDate((a+b)/2);termCache[key]=dt.toISOString();return dt;
}
function getJieListAround(year){
  const out=[];for(const yy of [year-1,year,year+1])for(const [name,target,m,d,branch] of JIE_DEFS)out.push({name,branch,dt:findSolarTerm(yy,name,target,m,d)});
  out.sort((a,b)=>a.dt-b.dt);return out;
}
function fmtKST(dt){const z=new Date(dt.getTime()+KST*60000);return `${z.getUTCFullYear()}-${String(z.getUTCMonth()+1).padStart(2,'0')}-${String(z.getUTCDate()).padStart(2,'0')} ${String(z.getUTCHours()).padStart(2,'0')}:${String(z.getUTCMinutes()).padStart(2,'0')}`;}
function birthUTC(Y,m,d,h=12,mi=0){return new Date(Date.UTC(Y,m-1,d,h-9,mi,0));}
function jieAt(dt){const list=getJieListAround(dt.getUTCFullYear()+((dt.getUTCMonth()===11)?1:0));let cur=list[0];for(const x of list){if(x.dt<=dt)cur=x;else break;}return cur;}
function prevNextJie(dt){const list=getJieListAround(dt.getUTCFullYear());let prev=null,next=null;for(const x of list){if(x.dt<=dt)prev=x;else{next=x;break;}}return {prev,next};}
function yearPillarExact(Y,m,d,h=12,mi=0){const dt=birthUTC(Y,m,d,h,mi),lc=findSolarTerm(Y,'입춘',315,2,4);let yy=Y;if(dt<lc)yy--;const idx=mod(yy-1984,60);return {gan:CHEONGAN[idx%10],ji:JIJI[idx%12]};}
function monthPillarExact(yGan,Y,m,d,h=12,mi=0){const dt=birthUTC(Y,m,d,h,mi),cur=jieAt(dt);const ji=cur.branch;const inwol=(yGan%5)*2+2,gan=mod(inwol+mod(ji-2,12),10);return {gan:CHEONGAN[gan],ji:JIJI[ji],jie:cur.name,jie_time:fmtKST(cur.dt)};}

function hourBranch(h){const t=[[23,24,0],[0,1,0],[1,3,1],[3,5,2],[5,7,3],[7,9,4],[9,11,5],[11,13,6],[13,15,7],[15,17,8],[17,19,9],[19,21,10],[21,23,11]];for(const [lo,hi,ji] of t)if(h>=lo&&h<hi)return ji;return 0;}
function eotMinutes(Y,m,d){const N=Math.floor((Date.UTC(Y,m-1,d)-Date.UTC(Y,0,0))/86400000),B=2*Math.PI*(N-81)/364;return 9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);}
function effectiveInfo(Y,m,d,hour,minute,lon,eot){let corr=0;if(lon!=null)corr+=(lon-135)*4;if(eot)corr+=eotMinutes(Y,m,d);const raw=hour*60+minute+corr,dayShift=Math.floor(raw/1440);return {minutes:mod(Math.round(raw),1440),correction:Math.round(corr),dayShift};}
function effectiveMinutes(Y,m,d,hour,minute,lon,eot){return effectiveInfo(Y,m,d,hour,minute,lon,eot).minutes;}
function hourPillar(ilgan,totalMinutes){if(totalMinutes===null)return null;const h=Math.floor(totalMinutes/60),ji=hourBranch(h),gan=mod((ilgan%5)*2+ji,10);return {gan:CHEONGAN[gan],ji:JIJI[ji]};}

/* ===== 대운 ===== */
function daeunExact(yGan,gender,mp,ilgan,birthDt){
  const yang=(yGan%2===0),forward=(yang&&gender==='남')||(!yang&&gender==='여');
  const pn=prevNextJie(birthDt),anchor=forward?pn.next:pn.prev;
  if(!anchor)throw new Error('대운 절기 기준 계산 실패');
  const diffDays=Math.abs(anchor.dt-birthDt)/86400000;
  const startYears=diffDays/3; // 전통 환산: 3일 = 1년
  const wholeDays=Math.floor(diffDays); const q=Math.floor(wholeDays/3), r=wholeDays%3; const startAge=Math.max(1,q+(r===2?1:0)); // 1사2입
  const totalMonths=Math.round(startYears*12),sy=Math.floor(totalMonths/12),sm=totalMonths%12;
  const start=ganji60(CHEONGAN.indexOf(mp.gan),JIJI.indexOf(mp.ji)),out=[];
  for(let k=0;k<8;k++){const step=k+1,idx=forward?mod(start+step,60):mod(start-step,60),gi=idx%10,ji=idx%12,a=startAge+k*10;out.push({age_start:a,age_end:a+9,gan:CHEONGAN[gi],ji:JIJI[ji],gan_sipseong:sipseong(ilgan,gi),ji_sipseong:sipseong(ilgan,JIJI_BONGI[ji])});}
  return {list:out,forward,startAge,startYears,startDetail:`${sy}년 ${sm}개월`,anchorName:anchor.name,anchorTime:fmtKST(anchor.dt),diffDays};
}

/* ===== 신살/관계 ===== */
const CHEONEUL={0:[1,7],1:[0,8],2:[11,9],3:[11,9],4:[1,7],5:[0,8],6:[1,7],7:[2,6],8:[3,5],9:[3,5]};
const MUNCHANG={0:5,1:6,2:8,3:9,4:8,5:9,6:11,7:0,8:2,9:3},YANGIN={0:3,2:6,4:6,6:9,8:0};
const BAEKHO=new Set(['0,4','1,7','2,10','3,1','4,4','8,10','9,1']),GOEGANG=new Set(['6,4','6,10','8,4','8,10','4,4','4,10']);
function samhapGroup(ji){if([2,6,10].includes(ji))return'fire';if([8,0,4].includes(ji))return'water';if([5,9,1].includes(ji))return'metal';return'wood';}
const DOHWA={fire:3,water:9,metal:6,wood:0},YEOKMA={fire:8,water:2,metal:11,wood:5},HWAGAE={fire:10,water:4,metal:1,wood:7};
function sinsal(P){const names=['연','월','일','시'].filter(k=>P[k]),g={},j={};names.forEach(k=>{g[k]=CHEONGAN.indexOf(P[k].gan);j[k]=JIJI.indexOf(P[k].ji);});const ilg=g['일'],ilj=j['일'],res={},add=(nm,pred)=>{const h=names.filter(pred);if(h.length)res[nm]=h;};add('천을귀인',k=>CHEONEUL[ilg].includes(j[k]));add('문창귀인',k=>j[k]===MUNCHANG[ilg]);if(ilg in YANGIN)add('양인살',k=>j[k]===YANGIN[ilg]);const grps=new Set([samhapGroup(j['연']),samhapGroup(ilj)]),dh=new Set([...grps].map(x=>DOHWA[x])),ym=new Set([...grps].map(x=>YEOKMA[x])),hg=new Set([...grps].map(x=>HWAGAE[x]));add('도화살',k=>dh.has(j[k]));add('역마살',k=>ym.has(j[k]));add('화개살',k=>hg.has(j[k]));add('백호살',k=>BAEKHO.has(g[k]+','+j[k]));add('괴강살',k=>GOEGANG.has(g[k]+','+j[k]));const st=mod(ilj-ilg,12),gm=[mod(st+10,12),mod(st+11,12)];add('공망',k=>k!=='일'&&gm.includes(j[k]));return res;}
const SIBI_ORDER=['지살','연살','월살','망신살','장성살','반안살','역마살','육해살','화개살','겁살','재살','천살'];
const SAENGJI={fire:2,water:8,metal:5,wood:11};
function sibisinsal(refJi,P){const base=SAENGJI[samhapGroup(refJi)],out={};for(const k of ['연','월','일','시'])if(P[k]){const j=JIJI.indexOf(P[k].ji);out[k]=SIBI_ORDER[mod(j-base,12)];}return out;}
const fs=(a,b)=>[a,b].sort((x,y)=>x-y).join(','),GANHAP=new Set([fs(0,5),fs(1,6),fs(2,7),fs(3,8),fs(4,9)]),YUKHAP=new Set([fs(0,1),fs(2,11),fs(3,10),fs(4,9),fs(5,8),fs(6,7)]),CHUNG=new Set([fs(0,6),fs(1,7),fs(2,8),fs(3,9),fs(4,10),fs(5,11)]),PA=new Set([fs(0,9),fs(3,6),fs(4,1),fs(7,10),fs(2,11),fs(5,8)]),HAE=new Set([fs(0,7),fs(1,6),fs(2,5),fs(3,4),fs(8,11),fs(9,10)]),HYEONG=new Set([fs(2,5),fs(5,8),fs(2,8),fs(1,10),fs(10,7),fs(1,7),fs(0,3)]);
const SAMHAP={'수국':[8,0,4],'화국':[2,6,10],'금국':[5,9,1],'목국':[11,3,7]},WANGJI={'수국':0,'화국':6,'금국':9,'목국':3};
function relations(P){const names=['연','월','일','시'].filter(k=>P[k]),G={},J={};names.forEach(k=>{G[k]=CHEONGAN.indexOf(P[k].gan);J[k]=JIJI.indexOf(P[k].ji);});const res={'천간합':[],'육합':[],'삼합':[],'반합':[],'충':[],'형':[],'파':[],'해':[]};for(let a=0;a<names.length;a++)for(let b=a+1;b<names.length;b++){const ka=names[a],kb=names[b];if(GANHAP.has(fs(G[ka],G[kb])))res['천간합'].push(`${ka}간·${kb}간 ${P[ka].gan}${P[kb].gan}합`);const ja=J[ka],jb=J[kb],lab=`${ka}지·${kb}지 ${JIJI[ja]}${JIJI[jb]}`;if(YUKHAP.has(fs(ja,jb)))res['육합'].push(lab+'합');if(CHUNG.has(fs(ja,jb)))res['충'].push(lab+'충');if(HYEONG.has(fs(ja,jb)))res['형'].push(lab+'형');if(PA.has(fs(ja,jb)))res['파'].push(lab+'파');if(HAE.has(fs(ja,jb)))res['해'].push(lab+'해');if(ja===jb&&[4,6,9,11].includes(ja))res['형'].push(`${ka}지·${kb}지 ${JIJI[ja]}${JIJI[jb]} 자형`);}for(const nm in SAMHAP){const [g1,g2,g3]=SAMHAP[nm],pres=names.filter(k=>[g1,g2,g3].includes(J[k])),uniq=new Set(pres.map(k=>J[k]));if(uniq.size===3)res['삼합'].push(`${pres.join('·')} ${nm} 삼합`);else if(uniq.size===2&&uniq.has(WANGJI[nm]))res['반합'].push(`${pres.join('·')} ${nm} 반합`);}const o={};for(const k in res)if(res[k].length)o[k]=res[k];return o;}

/* ===== v3 7단계 세력지표 + 용신 후보 ===== */
function elementOfGan(g){return Math.floor(g/2);}
function strengthIndex(P,ilgan){
  const dm=elementOfGan(ilgan),resource=mod(dm-1,5);let support=0,total=0;
  for(const k of ['연','월','일','시'])if(P[k]){
    const gi=CHEONGAN.indexOf(P[k].gan),ji=JIJI.indexOf(P[k].ji);
    support += ([dm,resource].includes(elementOfGan(gi))?1:0); total+=1;
    const w=k==='월'?2:1; support += ([dm,resource].includes(JIJI_OHAENG[ji])?w:0); total+=w;
  }
  const pct=support/total*100; let label='중화';
  if(pct>=75) label='태강';
  else if(pct>=65) label='신강';
  else if(pct>=55) label='중화신강';
  else if(pct>=45) label='중화';
  else if(pct>=35) label='중화신약';
  else if(pct>=25) label='신약';
  else label='태약';
  return {pct,label,method:'천간 1 + 지지 1(월지 2), 비겁·인성 생조 비율 / v3 7단계'};
}
function usefulGodCandidates(P,ilgan,strength){
  const dm=elementOfGan(ilgan),resource=mod(dm-1,5),controller=mod(dm+3,5);
  const monthJi=JIJI.indexOf(P['월'].ji);
  let eokbu;
  if(['태약','신약','중화신약'].includes(strength.label)) eokbu=OHAENG[resource];
  else if(['태강','신강','중화신강'].includes(strength.label)) eokbu=OHAENG[controller];
  else eokbu='균형 확인';
  let johu='중립';
  if([5,6,7].includes(monthJi)) johu='수';          // 사·오·미: 열기 완화 후보
  else if([11,0,1].includes(monthJi)) johu='화';    // 해·자·축: 한기 완화 후보
  const priority=['태약','신약','중화신약'].includes(strength.label)?eokbu:(johu!=='중립'?`${eokbu}·${johu}`:eokbu);
  return {eokbu,johu,priority,note:'억부/조후를 분리한 v3 후보값. 최종 용신 확정이 아님'};
}

/* ===== 12운성 ===== */
const TWELVE_STAGES=['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];
const CHANGSHENG_BRANCH=[11,6,2,9,2,9,5,0,8,3]; // 갑亥 을午 병寅 정酉 무寅 기酉 경巳 신子 임申 계卯
function twelveStage(ilgan,ji){
  const start=CHANGSHENG_BRANCH[ilgan],forward=(ilgan%2===0);
  const step=forward?mod(ji-start,12):mod(start-ji,12);
  return TWELVE_STAGES[step];
}
function twelveStagesFor(P,ilgan){const out={};for(const k of ['연','월','일','시'])if(P[k])out[k]=twelveStage(ilgan,JIJI.indexOf(P[k].ji));return out;}

/* ===== 운 ===== */
function annotateLuck(il,p){const g=CHEONGAN.indexOf(p.gan),j=JIJI.indexOf(p.ji);return {gan:p.gan,ji:p.ji,gan_sipseong:sipseong(il,g),ji_sipseong:sipseong(il,JIJI_BONGI[j])};}
function saeun(y){const idx=mod(y-1984,60);return {gan:CHEONGAN[idx%10],ji:JIJI[idx%12]};}
function luckMonthAt(dt){const y=dt.getUTCFullYear(),cur=jieAt(dt),yp=yearPillarExact(y,dt.getUTCMonth()+1,dt.getUTCDate(),dt.getUTCHours()+9,dt.getUTCMinutes());const ji=cur.branch,inwol=(CHEONGAN.indexOf(yp.gan)%5)*2+2,gan=mod(inwol+mod(ji-2,12),10);return {gan:CHEONGAN[gan],ji:JIJI[ji],jie:cur};}
function monthLuckPeriods(year,ilgan){const list=getJieListAround(year).filter(x=>x.dt>=birthUTC(year,1,1,0,0)&&x.dt<birthUTC(year+1,1,1,0,0));const out=[];for(let i=0;i<list.length;i++){const a=list[i],b=list[i+1]||getJieListAround(year+1).find(x=>x.dt>a.dt),mid=new Date((a.dt.getTime()+b.dt.getTime())/2),p=luckMonthAt(mid);out.push({name:a.name,start:fmtKST(a.dt),end:fmtKST(b.dt),...annotateLuck(ilgan,p)});}return out;}
function saeunTimeline(S,years){const il=CHEONGAN.indexOf(S.ilgan),by=S.birth_solar.year,sy=new Date().getUTCFullYear(),out=[];for(let y=sy;y<sy+years;y++)out.push(Object.assign({year:y,age:y-by},annotateLuck(il,saeun(y))));return out;}
function luckSnapshot(S){const now=new Date(),il=CHEONGAN.indexOf(S.ilgan),by=S.birth_solar.year,age=now.getUTCFullYear()-by;let ad=null;for(const du of S.daeun)if(du.age_start<=age&&age<=du.age_end){ad=du;break;}return {as_of:now.toISOString().slice(0,10),age,daeun:ad,saeun:annotateLuck(il,saeun(now.getUTCFullYear())),wolun:annotateLuck(il,luckMonthAt(now)),ilun:annotateLuck(il,ilju(now.getUTCFullYear(),now.getUTCMonth()+1,now.getUTCDate()))};}

function calcSaju(by,bm,bd,bh,gender,calMode,bmin,lon,eot,regionName){
  let Y=by,m=bm,d=bd;const isLunar=calMode!=='solar',isLeap=calMode==='lunarLeap';
  if(isLunar){const [sy,sm,sd]=jdnToSolar(lunarToJDN(by,bm,bd,isLeap));Y=sy;m=sm;d=sd;}
  let birthTime=null,effMin=null,calcH=bh===null?12:bh,calcMi=bh===null?0:(bmin||0);
  if(bh!==null){const ei=effectiveInfo(Y,m,d,bh,calcMi,lon,eot);effMin=ei.minutes;birthTime={hour:bh,minute:calcMi,true_solar:(lon!=null||!!eot),effective_minutes:effMin,effective_hm:`${String(Math.floor(effMin/60)).padStart(2,'0')}:${String(effMin%60).padStart(2,'0')}`,correction_minutes:ei.correction,region:regionName||null,longitude:lon};calcH=Math.floor(effMin/60);calcMi=effMin%60;}
  const year=yearPillarExact(Y,m,d,calcH,calcMi),month=monthPillarExact(CHEONGAN.indexOf(year.gan),Y,m,d,calcH,calcMi),day=ilju(Y,m,d),hour=hourPillar(CHEONGAN.indexOf(day.gan),effMin);
  const ilgan=day.gan,il=CHEONGAN.indexOf(ilgan),P={'연':year,'월':month,'일':day,'시':hour};
  const rawHour=bh===null?null:hourPillar(il,bh*60+(bmin||0));
  const Praw={'연':year,'월':month,'일':day,'시':rawHour};
  const rawStrength=strengthIndex(Praw,il);
  let s8=[year.gan,year.ji,month.gan,month.ji,day.gan,day.ji];if(hour)s8=s8.concat([hour.gan,hour.ji]);
  const oh={};OHAENG.forEach(n=>oh[n]=0);s8.forEach(ch=>{if(CHEONGAN.includes(ch))oh[OHAENG[elementOfGan(CHEONGAN.indexOf(ch))]]++;else oh[OHAENG[JIJI_OHAENG[JIJI.indexOf(ch)]]]++;});
  const weakest=OHAENG.reduce((a,b)=>oh[b]<oh[a]?b:a),strongest=OHAENG.reduce((a,b)=>oh[b]>oh[a]?b:a),lacking=OHAENG.filter(n=>oh[n]===0);
  const sd={};SIP.forEach(k=>sd[k]=0);let tg=[year.gan,month.gan];if(hour)tg.push(hour.gan);[year.ji,month.ji,day.ji].concat(hour?[hour.ji]:[]).forEach(ji=>tg.push(CHEONGAN[JIJI_BONGI[JIJI.indexOf(ji)]]));tg.forEach(t=>sd[sipseong(il,CHEONGAN.indexOf(t))]++);
  const bdt=birthUTC(Y,m,d,calcH,calcMi),du=daeunExact(CHEONGAN.indexOf(year.gan),gender,month,il,bdt),st=strengthIndex(P,il),ug=usefulGodCandidates(P,il,st),ts12=twelveStagesFor(P,il);
  return {saju:{year,month,day,hour},raw_time_candidate:{hour:rawHour,strength:rawStrength},saju_8:s8,ilgan,ilgan_strength:st.label,strength_index:st,useful_god_candidates:ug,twelve_stages:ts12,gender,ddi:DDI[JIJI.indexOf(year.ji)],ohaeng_distribution:oh,ohaeng_weakest:weakest,ohaeng_strongest:strongest,ohaeng_lacking:lacking,sipseong_distribution:sd,hidden_stems:Object.fromEntries(Object.entries(P).filter(([,v])=>v).map(([k,v])=>[k,HIDDEN[JIJI.indexOf(v.ji)]])),daeun:du.list,daeun_meta:du,daeun_direction:du.forward?'순행':'역행',sinsal:sinsal(P),sibisinsal:sibisinsal(JIJI.indexOf(year.ji),P),relations:relations(P),birth_time:birthTime,birth_solar:{year:Y,month:m,day:d},calendar_input:calMode};
}


export { calcSaju };
