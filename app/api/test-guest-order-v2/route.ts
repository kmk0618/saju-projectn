import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "lovemk0618@naver.com";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("MISSING_SUPABASE_URL");
  if (!key) throw new Error("MISSING_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    let body: any;

    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "INVALID_REQUEST_JSON" }, 400);
    }

    const guestEmail = String(body?.guest_email || "").trim().toLowerCase();
    const productSlug = String(body?.product_slug || "").trim();
    const guestInput = body?.input ?? {};

    if (guestEmail !== TEST_EMAIL) {
      return json({ ok: false, error: "TEST_EMAIL_NOT_ALLOWED" }, 403);
    }

    if (!productSlug) {
      return json({ ok: false, error: "PRODUCT_SLUG_REQUIRED" }, 400);
    }

    const supabase = getAdmin();

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, slug, name, price_krw, report_type, is_active")
      .eq("slug", productSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (productError) {
      console.error("PRODUCT_LOOKUP_ERROR", productError);
      return json({
        ok: false,
        error: "PRODUCT_LOOKUP_FAILED",
        detail: productError.message,
      }, 500);
    }

    if (!product) {
      return json({ ok: false, error: "PRODUCT_NOT_FOUND" }, 404);
    }

    const merchantUid =
      "TEST_" +
      Date.now() +
      "_" +
      Math.random().toString(16).slice(2, 10);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: null,
        product_id: product.id,
        birth_profile_id: null,
        question_id: null,
        merchant_uid: merchantUid,
        pg_provider: "TEST_FREE",
        pg_payment_id: null,
        amount_krw: product.price_krw,
        status: "paid",
        paid_at: new Date().toISOString(),
        guest_email: guestEmail,
        payment_payload: {
          test_mode: true,
          charged_amount_krw: 0,
          listed_amount_krw: product.price_krw,
          guest_input: guestInput,
          note: "Owner guest free test v2. No PG payment requested.",
        },
      })
      .select(`
        id,
        merchant_uid,
        amount_krw,
        status,
        guest_access_token,
        guest_email,
        created_at
      `)
      .single();

    if (orderError || !order) {
      console.error("ORDER_INSERT_ERROR", orderError);
      return json({
        ok: false,
        error: "ORDER_CREATE_FAILED",
        detail: orderError?.message || "No order returned",
      }, 500);
    }

    return json({
      ok: true,
      test_mode: true,
      charged_amount_krw: 0,
      listed_amount_krw: order.amount_krw,
      order_id: order.id,
      merchant_uid: order.merchant_uid,
      status: order.status,
      guest_email: order.guest_email,
      guest_token: order.guest_access_token,
      created_at: order.created_at,
      product: {
        slug: product.slug,
        name: product.name,
        report_type: product.report_type,
      },
    });
  } catch (error: any) {
    console.error("TEST_GUEST_ORDER_V2_FATAL", error);
    return json({
      ok: false,
      error: "SERVER_ERROR",
      detail: error?.message || String(error),
    }, 500);
  }
}

export async function GET() {
  return json({
    ok: true,
    route: "test-guest-order-v2",
    message: "POST only for order creation",
  });
}
