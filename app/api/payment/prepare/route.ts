import { NextResponse } from "next/server";
import { getAdminSupabase, getPortOneV1PublicConfig } from "@/lib/portone";

export const runtime = "nodejs";
export const maxDuration = 30;

function J(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

function validEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return J({ ok: false, error: "INVALID_JSON" }, 400);

    const productSlug = String(body.product_slug || "").trim();
    if (!productSlug) return J({ ok: false, error: "PRODUCT_SLUG_REQUIRED" }, 400);

    const sb = getAdminSupabase();
    const authHeader = req.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    let user: any = null;
    if (accessToken) {
      const { data, error } = await sb.auth.getUser(accessToken);
      if (error || !data?.user) return J({ ok: false, error: "INVALID_SESSION" }, 401);
      user = data.user;
    }

    const guestEmail = String(body.guest_email || "").trim().toLowerCase();
    if (!user && !validEmail(guestEmail)) {
      return J({ ok: false, error: "VALID_GUEST_EMAIL_REQUIRED" }, 400);
    }

    const { data: product, error: productError } = await sb
      .from("products")
      .select("id,slug,name,price_krw,report_type,is_active")
      .eq("slug", productSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (productError) return J({ ok: false, error: "PRODUCT_LOOKUP_FAILED", detail: productError.message }, 500);
    if (!product) return J({ ok: false, error: "PRODUCT_NOT_FOUND" }, 404);

    const amount = Number(product.price_krw);
    if (!Number.isInteger(amount) || amount <= 0) {
      return J({ ok: false, error: "INVALID_PRODUCT_PRICE" }, 500);
    }

    const merchantUid = `saju-${crypto.randomUUID()}`;
    const input = body.input && typeof body.input === "object" ? body.input : {};

    const { data: order, error: orderError } = await sb
      .from("orders")
      .insert({
        user_id: user?.id || null,
        product_id: product.id,
        birth_profile_id: user ? (body.birth_profile_id || null) : null,
        question_id: user ? (body.question_id || null) : null,
        merchant_uid: merchantUid,
        pg_provider: "PORTONE_V1",
        pg_payment_id: null,
        amount_krw: amount,
        status: "pending",
        paid_at: null,
        guest_email: user ? null : guestEmail,
        payment_payload: {
          test_mode: false,
          merchant_uid: merchantUid,
          listed_amount_krw: amount,
          guest_input: input,
          prepared_at: new Date().toISOString(),
          member_email: user?.email || null,
        },
      })
      .select("id,merchant_uid,amount_krw,status,guest_access_token,created_at")
      .single();

    if (orderError || !order) {
      return J({ ok: false, error: "ORDER_CREATE_FAILED", detail: orderError?.message || "NO_ORDER" }, 500);
    }

    const { impCode, channelKey } = getPortOneV1PublicConfig();

    return J({
      ok: true,
      order_id: order.id,
      merchant_uid: order.merchant_uid,
      amount_krw: order.amount_krw,
      guest_token: order.guest_access_token,
      product: { slug: product.slug, name: product.name, report_type: product.report_type },
      portone: { imp_code: impCode, channel_key: channelKey },
    });
  } catch (e: any) {
    console.error("PAYMENT_PREPARE_ERROR", e);
    return J({ ok: false, error: "SERVER_ERROR", detail: e?.message || String(e) }, 500);
  }
}
