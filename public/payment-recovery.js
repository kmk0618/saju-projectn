function pendingPortOnePayment() {
  try { return JSON.parse(localStorage.getItem('saju_pending_portone_payment') || 'null'); } catch { return null; }
}
function showPendingPaymentRecovery() {
  const pending = pendingPortOnePayment();
  if(!pending?.order_id) return;
  let panel = document.getElementById('paymentRecovery');
  if(!panel) {
    panel = document.createElement('section'); panel.id = 'paymentRecovery';
    panel.style.cssText = 'margin:16px auto;padding:18px;max-width:1100px;border:1px solid #dfbd49;border-radius:16px;background:#fff8de;line-height:1.7';
    panel.innerHTML = '<b>이전 결제 확인</b><p id="paymentRecoveryStatus" role="status">카드 승인이 되었다면 다시 결제하지 마세요. 기존 승인 내역을 확인해 리포트로 이어갈 수 있습니다.</p><button id="paymentRecoveryButton" type="button" onclick="recoverPendingPayment()" style="padding:10px 16px;background:#29271f;color:white;border:0;border-radius:10px">이미 결제한 주문 확인하기</button>';
    document.getElementById('free').before(panel);
  }
  panel.hidden = false;
}
async function recoverPendingPayment() {
  const pending = pendingPortOnePayment();
  if(!pending?.order_id) return;
  const button = document.getElementById('paymentRecoveryButton');
  const status = document.getElementById('paymentRecoveryStatus');
  button.disabled = true; status.textContent = '기존 결제 승인 내역을 확인하고 있습니다. 추가 결제는 발생하지 않습니다.';
  try {
    const headers = {'Content-Type':'application/json'};
    const sb = window.sajuSupabase;
    if(sb) { const {data} = await sb.auth.getSession(); if(data?.session?.access_token) headers.Authorization = 'Bearer '+data.session.access_token; }
    const response = await fetch('/api/payment/complete',{method:'POST',headers,body:JSON.stringify(pending)});
    const data = await response.json();
    if(!response.ok || !data.ok) throw new Error(data.detail || data.error || 'PAYMENT_VERIFY_FAILED');
    localStorage.removeItem('saju_pending_portone_payment');
    location.href = '/guest-report.html?token='+encodeURIComponent(data.guest_token || pending.guest_token);
  } catch(e) {
    status.textContent = '승인 확인을 완료하지 못했습니다. 다시 결제하지 말고 문의해 주세요. '+e.message;
    button.disabled = false;
  }
}
showPendingPaymentRecovery();
