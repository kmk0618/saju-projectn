let appliedCheckoutCoupon = null;
let couponRequestVersion = 0;
function checkoutProductSlug() {
  return ({'종합 인생 리포트':'life-report','자녀 사주 리포트':'child-report','자녀 사주':'child-report','커플·부부 궁합':'couple-compatibility','신년 리포트':'new-year','신년 운세':'new-year','신년운세':'new-year'})[checkoutProduct?.name];
}
function resetCheckoutCoupon(clearInput = true) {
  couponRequestVersion++;
  appliedCheckoutCoupon = null;
  if(clearInput) document.getElementById('checkoutCoupon').value = '';
  document.getElementById('couponStatus').textContent = '';
  document.getElementById('checkoutTotal').textContent = checkoutProduct?.price || '';
}
async function applyCheckoutCoupon() {
  resetCheckoutCoupon(false);
  const code = document.getElementById('checkoutCoupon').value.trim().toUpperCase();
  const status = document.getElementById('couponStatus');
  if(!code) { status.textContent = '쿠폰 코드를 입력해 주세요.'; return; }
  const version = couponRequestVersion;
  const slug = checkoutProductSlug();
  status.textContent = '쿠폰을 확인하고 있습니다.';
  try {
    const r = await fetch('/api/payment/quote', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_slug:slug,coupon_code:code})});
    const data = await r.json();
    if(version !== couponRequestVersion) return;
    if(!r.ok || !data.ok) throw new Error(({INVALID_COUPON:'사용할 수 없는 쿠폰입니다.',COUPON_EXPIRED:'유효기간이 지난 쿠폰입니다.',COUPON_NOT_APPLICABLE:'이 상품에 적용할 수 없는 쿠폰입니다.'})[data.error] || '쿠폰 확인에 실패했습니다. 다시 시도해 주세요.');
    if(!data.coupon_id) throw new Error('쿠폰을 다시 확인해 주세요.');
    appliedCheckoutCoupon = {code,slug,amount:data.amount_krw};
    document.getElementById('checkoutTotal').textContent = Number(data.amount_krw).toLocaleString('ko-KR')+'원';
    status.textContent = Number(data.discount_krw).toLocaleString('ko-KR')+'원 할인 적용 · 실제 결제금액 '+Number(data.amount_krw).toLocaleString('ko-KR')+'원';
  } catch(e) {
    if(version === couponRequestVersion) status.textContent = e.message;
  }
}
function checkoutCouponCode() {
  const code = document.getElementById('checkoutCoupon').value.trim().toUpperCase();
  if(!code) return '';
  if(!appliedCheckoutCoupon || appliedCheckoutCoupon.code !== code || appliedCheckoutCoupon.slug !== checkoutProductSlug()) throw new Error('쿠폰 적용 버튼을 누른 뒤 할인 금액을 확인해 주세요.');
  return code;
}
