import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const TEST_EMAIL = "lovemk0618@naver.com";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const guestEmail = String(body.guest_email || "").trim().toLowerCase();
    const productSlug = String(body.product_slug || "").trim();
    const guestInput = body.input ?? null;

    // 무료 테스트는 소유자 이메일 1개만 허용
    if (guestEmail !== TEST_EMAIL) {
      return NextResponse.json(
        { ok: false, error: "TEST_EMAIL_NOT_ALLOWED" },
        { status: 403 }
      );
    }

    if (!productSlug) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_SLUG_REQUIRED" },
        { status: 400 }
      );
    }

    const supabase = getAdmin();

    // 프론트에서 넘어온 가격은 절대 사용하지 않음
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, slug, name, price_krw, report_type, is_active")
      .eq("slug", productSlug)
      .eq("is_active", true)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const merchantUid = `TEST_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // orders.status 제약조건 때문에 테스트도 paid로 저장하고
    // payment_payload.test_mode=true + pg_provider='TEST_FREE' 로 구분
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
          note: "Owner guest free-flow test. No PG payment was requested.",
        },
      })
      .select("id, merchant_uid, amount_krw, status, guest_access_token, guest_email")
      .single();

    if (orderError || !order) {
      console.error(orderError);
      return NextResponse.json(
        { ok: false, error: "ORDER_CREATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      test_mode: true,
      charged_amount_krw: 0,
      listed_amount_krw: order.amount_krw,
      order_id: order.id,
      merchant_uid: order.merchant_uid,
      status: order.status,
      guest_email: order.guest_email,
      guest_token: order.guest_access_token,
      product: {
        slug: product.slug,
        name: product.name,
        report_type: product.report_type,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
