(function(){
  const SB_URL="https://scmskjvhejnchhyufyfa.supabase.co";
  const SB_KEY="sb_publishable__aKUm_yLUXA1cS18gFuumA_J9lArQcD";
  const OWNER_EMAIL="lovemk0618@naver.com";

  if(!window.supabase?.createClient){
    console.error("[MEMBER TEST] Supabase SDK not found");
    return;
  }

  const sb=window.supabase.createClient(SB_URL,SB_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  const originalConfirmCheckout=
    typeof window.confirmCheckout==="function"
      ? window.confirmCheckout
      : (typeof confirmCheckout==="function" ? confirmCheckout : null);

  async function getSession(){
    const {data:{session},error}=await sb.auth.getSession();
    if(error) throw error;
    return session;
  }

  async function ownerKakaoSession(){
    const session=await getSession();
    if(!session?.user) return null;
    const email=String(session.user.email||"").toLowerCase();
    const provider=String(session.user.app_metadata?.provider||"");
    if(email===OWNER_EMAIL && provider==="kakao") return session;
    return null;
  }

  async function updateTestUi(){
    try{
      const session=await ownerKakaoSession();
      if(!session) return;

      const btn=document.getElementById("modalBuyBtn");
      if(btn && document.getElementById("modalBack")?.style.display!=="none"){
        btn.textContent="0원 회원 테스트";
      }
    }catch(e){
      console.error("[MEMBER TEST] UI",e);
    }
  }

  async function memberTestCheckout(){
    const session=await ownerKakaoSession();

    // 대표 카카오 계정이 아니면 기존 결제 흐름 그대로
    if(!session){
      if(originalConfirmCheckout) return originalConfirmCheckout();
      throw new Error("기존 결제 함수를 찾지 못했습니다.");
    }

    if(typeof checkoutProduct==="undefined" || !checkoutProduct){
      if(typeof showToast==="function") showToast("선택된 상품이 없습니다.");
      return;
    }

    const btn=document.getElementById("modalBuyBtn");
    if(btn){
      btn.disabled=true;
      btn.textContent="테스트 주문 생성 중...";
    }

    try{
      const input=(typeof collectGuestCheckoutPayload==="function")
        ? collectGuestCheckoutPayload()
        : {};

      const r=await fetch("/api/test-member-order",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer "+session.access_token
        },
        body:JSON.stringify({
          product_name:checkoutProduct.name,
          birth_profile_id:checkoutProduct.birth_profile_id||null,
          question_id:checkoutProduct.question_id||null,
          calculation_id:checkoutProduct.calculation_id||null,
          input
        })
      });

      const raw=await r.text();
      let data=null;
      try{data=raw?JSON.parse(raw):null}catch{
        throw new Error("서버 응답 형식 오류 ("+r.status+")");
      }

      if(!r.ok||!data?.ok){
        throw new Error(
          (data?.error||"TEST_MEMBER_ORDER_FAILED")+
          (data?.detail?" : "+data.detail:"")
        );
      }

      try{
        localStorage.setItem("saju_last_member_test_order",JSON.stringify(data));
      }catch(e){}

      if(typeof closeModal==="function") closeModal();

      // 기존 guest-report 생성 파이프라인을 그대로 재사용.
      // 주문은 user_id가 연결된 진짜 회원 주문이므로 후기에서 구매주문으로 조회 가능.
      location.href="/guest-report.html?token="+encodeURIComponent(data.guest_token);

    }catch(e){
      console.error("[MEMBER TEST]",e);
      if(typeof showToast==="function"){
        showToast("회원 테스트 주문 실패: "+(e?.message||String(e)));
      }else{
        alert("회원 테스트 주문 실패: "+(e?.message||String(e)));
      }
      if(btn){
        btn.disabled=false;
        btn.textContent="0원 회원 테스트";
      }
    }
  }

  // 기존 confirmCheckout을 대표 카카오 계정에 한해서만 0원 테스트로 우회
  window.confirmCheckout=memberTestCheckout;
  try{confirmCheckout=memberTestCheckout}catch(e){}

  // 상품 모달이 열린 뒤 버튼 문구 자동 변경
  document.addEventListener("click",()=>setTimeout(updateTestUi,50));
  window.addEventListener("focus",updateTestUi);
  setTimeout(updateTestUi,400);
})();
