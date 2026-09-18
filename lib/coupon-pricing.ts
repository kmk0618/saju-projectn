import { createHash, timingSafeEqual } from "node:crypto";
import { TEST_COUPON } from "@/lib/test-coupon-policy";

export function couponPricing(product: { slug: string; price_krw: number }, raw: unknown, now = Date.now()) {
  const listed = Number(product.price_krw);
  if (!Number.isSafeInteger(listed) || listed <= 0) throw new Error("INVALID_PRODUCT_PRICE");
  if (raw != null && typeof raw !== "string") throw new Error("INVALID_COUPON");
  const code = String(raw || "").trim().toUpperCase();
  if (!code) return { amount_krw: listed, listed_amount_krw: listed, discount_krw: 0, coupon_id: null, coupon_expires_at: null };
  if (code.length > 128 || !timingSafeEqual(createHash("sha256").update(code).digest(), Buffer.from(TEST_COUPON.codeHash, "hex"))) throw new Error("INVALID_COUPON");
  if (now >= Date.parse(TEST_COUPON.expiresAt)) throw new Error("COUPON_EXPIRED");
  if (!TEST_COUPON.slugs.includes(product.slug) || listed < TEST_COUPON.amount) throw new Error("COUPON_NOT_APPLICABLE");
  return { amount_krw: TEST_COUPON.amount, listed_amount_krw: listed, discount_krw: listed - TEST_COUPON.amount, coupon_id: TEST_COUPON.id, coupon_expires_at: TEST_COUPON.expiresAt };
}
