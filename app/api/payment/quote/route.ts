import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/portone";
import { couponPricing } from "@/lib/coupon-pricing";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.product_slug !== "string") return json({ ok: false, error: "PRODUCT_SLUG_REQUIRED" }, 400);
    const { data: product, error } = await getAdminSupabase().from("products").select("slug,price_krw").eq("slug", body.product_slug).eq("is_active", true).maybeSingle();
    if (error) return json({ ok: false, error: "PRODUCT_LOOKUP_FAILED" }, 500);
    if (!product) return json({ ok: false, error: "PRODUCT_NOT_FOUND" }, 404);
    return json({ ok: true, ...couponPricing(product, body.coupon_code) });
  } catch (e: any) {
    const message = String(e?.message || "");
    const known = ["INVALID_COUPON", "COUPON_EXPIRED", "COUPON_NOT_APPLICABLE"].includes(message);
    return json({ ok: false, error: known ? message : "QUOTE_FAILED" }, known ? 400 : 500);
  }
}
