
(function(){
  const URL="https://scmskjvhejnchhyufyfa.supabase.co";
  const KEY="sb_publishable__aKUm_yLUXA1cS18gFuumA_J9lArQcD";

  if(!window.supabase?.createClient) return;
  const sb=window.supabase.createClient(URL,KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  function addBackButton(){
    const section=document.querySelector('#my');
    if(!section || document.getElementById('myReportBackBtn')) return;
    const head=section.querySelector('.sectionHead')||section;
    const btn=document.createElement('button');
    btn.id='myReportBackBtn';
    btn.textContent='← 뒤로가기';
    btn.style.cssText='border:0;background:#111;color:#fff;border-radius:12px;padding:11px 16px;font-weight:900;cursor:pointer;margin-bottom:16px';
    btn.onclick=()=>history.length>1?history.back():location.href='/';
    head.prepend(btn);
  }

  function findPurchasedPanel(){
    const h3=[...document.querySelectorAll('#my h3')].find(x=>x.textContent.includes('구매한 리포트'));
    return h3?.closest('.panel')||null;
  }

  function badge(status,ready){
    if(ready) return '완료';
    if(status==='generating') return '생성 중';
    if(status==='queued') return '대기';
    return '구매완료';
  }

  async function renderOrders(){
    addBackButton();
    const panel=findPurchasedPanel();
    if(!panel) return;

    const {data:{session}}=await sb.auth.getSession();
    if(!session?.user){
      const list=panel.querySelector('.reportList');
      if(list) list.innerHTML='<div style="padding:18px;color:#777">로그인 후 구매한 리포트를 확인할 수 있습니다.</div>';
      return;
    }

    const {data:orders,error}=await sb
      .from('orders')
      .select('id,product_id,guest_access_token,status,created_at,merchant_uid')
      .eq('user_id',session.user.id)
      .eq('status','paid')
      .order('created_at',{ascending:false});

    if(error){console.error('[MY REPORT orders]',error);return;}

    const ids=(orders||[]).map(o=>o.id);
    const productIds=[...new Set((orders||[]).map(o=>o.product_id).filter(Boolean))];

    let products=[];
    if(productIds.length){
      const pr=await sb.from('products').select('id,name,slug').in('id',productIds);
      products=pr.data||[];
    }
    const pm=Object.fromEntries(products.map(p=>[p.id,p]));

    let reports=[];
    if(ids.length){
      const rr=await sb.from('reports')
        .select('id,order_id,status,report_json,title,prompt_version,created_at')
        .in('order_id',ids);
      reports=rr.data||[];
    }
    const rm={};
    for(const r of reports){
      if(!rm[r.order_id] || new Date(r.created_at)>new Date(rm[r.order_id].created_at)) rm[r.order_id]=r;
    }

    const list=panel.querySelector('.reportList');
    if(!list) return;

    if(!orders?.length){
      list.innerHTML='<div style="padding:18px;color:#777">아직 구매한 리포트가 없습니다.</div>';
      return;
    }

    list.innerHTML=orders.map((o,i)=>{
      const p=pm[o.product_id]||{};
      const r=rm[o.id]||null;
      const j=r?.report_json||{};
      const ready=r?.status==='completed' && String(r?.prompt_version||'').startsWith('life-report-aqua-50') && !!j.pdf_storage_path && j.pdf_ready!==false;
      const st=badge(r?.status,ready);
      const mark=i===0?'A':String(i+1).padStart(2,'0');
      const click=ready
        ? `location.href='/api/report/pdf?token=${encodeURIComponent(o.guest_access_token)}'`
        : `location.href='/guest-report.html?token=${encodeURIComponent(o.guest_access_token)}'`;
      return `<div class="report" style="cursor:pointer" onclick="${click}">
        <div class="rmark">${mark}</div>
        <div><b>${p.name||r?.title||'구매 리포트'}</b><small>${ready?'리포트 완성 · 클릭하여 열람':(j.completed_sections||0)+' / 50 생성 중'}</small></div>
        <span class="status">${st}</span>
      </div>`;
    }).join('');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',renderOrders);
  else renderOrders();

  window.addEventListener('focus',renderOrders);
  setInterval(renderOrders,5000);
})();
