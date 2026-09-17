(() => {
  document.querySelectorAll('.product[onclick],.brand[onclick]').forEach(el=>{
    el.tabIndex=0;el.setAttribute('role','button');
    el.addEventListener('keydown',event=>{if(event.target===el && ['Enter',' '].includes(event.key)){event.preventDefault();el.click();}});
  });
  let previous=null, active=null;
  const selector='button,a[href],input,select,textarea,[tabindex="0"]';
  const observer=new MutationObserver(()=>{
    const next=[...document.querySelectorAll('[role="dialog"]')].find(d=>d.getClientRects().length);
    if(next && next!==active){previous=document.activeElement;active=next;next.querySelector(selector)?.focus();}
    else if(!next && active){active=null;previous?.focus();}
  });
  document.querySelectorAll('.modalBack,.previewModalBack').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['style']}));
  document.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){
      event.preventDefault();
      if(active.closest('#modalBack'))window.closeModal?.();else window.closePreviewModal?.();
    }
    if(event.key==='Tab'){
      const items=[...active.querySelectorAll(selector)].filter(e=>!e.disabled&&e.getClientRects().length);
      if(!items.length)return;
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  // Editing form fields invalidates references to the previous free calculation.
  document.getElementById('birth-form')?.addEventListener('input',()=>{
    lastSaju=null; currentQuestionId=null; currentCalculationId=null; window.__sajuPayload=null;
    document.getElementById('preview').style.display='none';
  });
})();
