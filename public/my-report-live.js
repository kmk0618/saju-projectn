(function(){
  let busy=false, page=0, timer=null, guest=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function renderOrders(){
    if(busy || document.hidden) return;
    const panel=[...document.querySelectorAll('#my h3')].find(x=>x.textContent.includes('구매한 리포트'))?.closest('.panel');
    const list=panel?.querySelector('.reportList');
    if(!list || !window.sajuSupabase) return;
    if(!panel.querySelector('.purchaseModes')){
      const modes=document.createElement('div');modes.className='purchaseModes';
      for(const [label,value] of [['회원 구매',false],['비회원 구매 찾기',true]]){
        const button=document.createElement('button');button.textContent=label;
        button.onclick=()=>{guest=value;page=0;renderOrders();};modes.append(button);
      }
      const note=document.createElement('p');note.style.cssText='font-size:12px;line-height:1.6;color:#746f62';
      note.textContent='비회원 구매는 결제할 때 입력한 이메일과 같은 이메일로 로그인·인증한 뒤 찾을 수 있습니다.';
      modes.append(note);list.before(modes);
    }
    busy=true; clearTimeout(timer);
    try{
      const {data:{session}}=await window.sajuSupabase.auth.getSession();
      if(!session){list.innerHTML='<p>로그인 후 구매한 리포트를 확인할 수 있습니다.</p>';return;}
      const response=await fetch('/api/my-reports?page='+page+'&guest='+(guest?'1':'0'),{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
      const data=await response.json();
      if(!response.ok || !data.ok) throw new Error(data.error==='VERIFIED_EMAIL_REQUIRED'?'가입 이메일 인증을 완료한 뒤 다시 찾아 주세요.':'구매 목록을 불러오지 못했습니다.');
      list.innerHTML=data.orders.map((o,i)=>{
        const label=o.ready?'완료':o.status==='failed'?'확인 필요':o.status==='queued'?'대기':'생성 중';
        const detail=o.ready?'리포트 완성 · 열람 및 다운로드':o.status==='failed'?'생성이 중단되었습니다 · 눌러서 확인':`${o.completed} / ${o.total} 작성 중`;
        return `<a class="report" href="/guest-report.html?token=${encodeURIComponent(o.token)}"><div class="rmark">${page*30+i+1}</div><div><b>${esc(o.name)}</b><small>${esc(detail)}</small><small>${esc(new Date(o.created_at).toLocaleDateString('ko-KR'))} 구매</small></div><span class="status">${label}</span></a>`;
      }).join('') || '<p>아직 구매한 리포트가 없습니다.</p>';
      if(page>0 || data.has_more){
        const nav=document.createElement('div');
        for(const [label,delta,enabled] of [['이전',-1,page>0],['다음',1,data.has_more]]){
          const button=document.createElement('button');button.textContent=label;button.disabled=!enabled;
          button.onclick=()=>{page+=delta;renderOrders();};nav.append(button);
        }
        list.append(nav);
      }
      if(data.orders.some(o=>!o.ready && o.status!=='failed'))timer=setTimeout(renderOrders,15000);
    }catch(e){list.textContent=e.message;timer=setTimeout(renderOrders,30000);}
    finally{busy=false;}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderOrders();});
  window.addEventListener('focus',renderOrders);
  window.sajuSupabase?.auth.onAuthStateChange(()=>setTimeout(()=>{page=0;renderOrders();},0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderOrders);else renderOrders();
})();
