import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/portone";

export const runtime = "nodejs";
export const maxDuration = 30;



function J(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function maskEmail(email: string | null) {
  if (!email) return "";

  const [id, domain] = email.split("@");

  if (!domain) return email;

  const safeId =
    id.length <= 2
      ? id[0] + "*"
      : id.slice(0, 2) + "*".repeat(Math.max(2, id.length - 2));

  return `${safeId}@${domain}`;
}

/*
 * =========================================================
 * 0원 비회원 테스트 주문 생성
 * =========================================================
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return J(
        {
          ok: false,
          error: "INVALID_JSON",
        },
        400
      );
    }

    const guestEmail = String(body.guest_email || "")
      .trim()
      .toLowerCase();

    /*
     * 현재 내부 테스트 계정만 무료 주문 허용
     * 테스트 종료 후 이 기능은 제거하는 것을 권장
     */
    if (guestEmail !== "lovemk0618@naver.com") {
      return J(
        {
          ok: false,
          error: "TEST_EMAIL_NOT_ALLOWED",
        },
        403
      );
    }

    const productSlug = String(body.product_slug || "").trim();

    if (!productSlug) {
      return J(
        {
          ok: false,
          error: "PRODUCT_SLUG_REQUIRED",
        },
        400
      );
    }

    const supabase = getAdminSupabase();

    /*
     * 상품 조회
     */
    const { data: product, error: productError } = await supabase
      .from("products")
      .select(
        "id,slug,name,price_krw,report_type,is_active"
      )
      .eq("slug", productSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (productError) {
      return J(
        {
          ok: false,
          error: "PRODUCT_LOOKUP_FAILED",
          detail: productError.message,
        },
        500
      );
    }

    if (!product) {
      return J(
        {
          ok: false,
          error: "PRODUCT_NOT_FOUND",
        },
        404
      );
    }

    /*
     * 입력값
     */
    const input =
      body.input && typeof body.input === "object"
        ? { ...body.input }
        : {};

    /*
     * 현재 판매 중인 신년운세는 2027년판
     */
    if (
      productSlug === "new-year" ||
      product.report_type === "new_year"
    ) {
      input.target_year = 2027;
    }

    const partnerInput =
      body.partner_input &&
      typeof body.partner_input === "object"
        ? body.partner_input
        : null;

    /*
     * PortOne merchant_uid와 충돌하지 않는 테스트 주문번호
     */
    const merchantUid =
      "test" +
      crypto.randomUUID().replace(/-/g, "");

    const now = new Date().toISOString();

    /*
     * 중요:
     * amount_krw에는 정상 판매가를 보존하고
     * 실제 결제금액 0원은 payment_payload에 별도 기록한다.
     */
    const listedAmount = Number(product.price_krw || 0);

    const { data: order, error: orderError } =
      await supabase
        .from("orders")
        .insert({
          user_id: null,
          product_id: product.id,

          birth_profile_id: null,
          question_id: null,

          merchant_uid: merchantUid,

          pg_provider: "TEST_FREE",
          pg_payment_id: null,

          amount_krw: listedAmount,

          status: "paid",
          paid_at: now,

          guest_email: guestEmail,

          payment_payload: {
            test_mode: true,

            merchant_uid: merchantUid,

            listed_amount_krw: listedAmount,
            charged_amount_krw: 0,
            discount_krw: listedAmount,

            guest_input: input,

            partner_profile_id: null,
            partner_input: partnerInput,

            prepared_at: now,
            paid_at: now,
          },
        })
        .select(
          "id,merchant_uid,amount_krw,status,guest_access_token,created_at"
        )
        .single();

    if (orderError || !order) {
      console.error(
        "TEST_ORDER_CREATE_ERROR",
        orderError
      );

      return J(
        {
          ok: false,
          error: "ORDER_CREATE_FAILED",
          detail:
            orderError?.message || "NO_ORDER",
        },
        500
      );
    }

    if (!order.guest_access_token) {
      return J(
        {
          ok: false,
          error: "GUEST_TOKEN_NOT_CREATED",
        },
        500
      );
    }

    /*
     * 프론트에서 이 guest_token으로
     * /guest-report.html로 바로 이동
     */
    return J({
      ok: true,

      order_id: order.id,

      merchant_uid:
        order.merchant_uid,

      status:
        order.status,

      listed_amount_krw:
        order.amount_krw,

      charged_amount_krw: 0,

      guest_token:
        order.guest_access_token,

      product: {
        slug: product.slug,
        name: product.name,
        report_type: product.report_type,
      },

      is_test: true,
    });
  } catch (e: any) {
    console.error(
      "TEST_GUEST_ORDER_ERROR",
      e
    );

    return J(
      {
        ok: false,
        error: "SERVER_ERROR",
        detail: e?.message || String(e),
      },
      500
    );
  }
}

/*
 * =========================================================
 * 기존 테스트/비회원 주문 조회
 * 기존 기능은 그대로 유지
 * =========================================================
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const token = (
      url.searchParams.get("token") || ""
    ).trim();

    if (!/^[0-9a-fA-F-]{36}$/.test(token)) {
      return J(
        {
          ok: false,
          error: "INVALID_TOKEN",
        },
        400
      );
    }

    const supabase = getAdminSupabase();

    const { data: order, error: orderError } =
      await supabase
        .from("orders")
        .select(`
          id,
          merchant_uid,
          amount_krw,
          status,
          paid_at,
          created_at,
          pg_provider,
          payment_payload,
          guest_email,
          product_id,
          products (
            slug,
            name,
            report_type
          )
        `)
        .eq("guest_access_token", token)
        .maybeSingle();

    if (orderError) {
      console.error(orderError);

      return J(
        {
          ok: false,
          error: "ORDER_LOOKUP_FAILED",
        },
        500
      );
    }

    if (!order) {
      return J(
        {
          ok: false,
          error: "ORDER_NOT_FOUND",
        },
        404
      );
    }

    const { data: report } =
      await supabase
        .from("reports")
        .select(
          "id,title,status,summary,generated_at,created_at"
        )
        .eq("order_id", order.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    const payload: any =
      order.payment_payload || {};

    const input: any =
      payload.guest_input || {};

    const productRaw: any =
      order.products;

    const product =
      Array.isArray(productRaw)
        ? productRaw[0]
        : productRaw;

    return J({
      ok: true,

      order: {
        id: order.id,

        merchant_uid:
          order.merchant_uid,

        status:
          order.status,

        listed_amount_krw:
          order.amount_krw,

        charged_amount_krw:
          payload.charged_amount_krw ??
          order.amount_krw,

        is_test:
          payload.test_mode === true ||
          order.pg_provider === "TEST_FREE",

        paid_at:
          order.paid_at,

        created_at:
          order.created_at,

        guest_email_masked:
          maskEmail(order.guest_email),

        product:
          product || null,

        input: {
          y: input.y ?? "",
          m: input.m ?? "",
          d: input.d ?? "",

          h: input.h ?? "",
          mi: input.mi ?? "",

          unknown_time:
            !!input.unknown_time,

          region:
            input.region ?? "",

          qcat:
            input.qcat ?? "",

          question:
            input.question ?? "",
        },
      },

      report:
        report || null,
    });
  } catch (e) {
    console.error(e);

    return J(
      {
        ok: false,
        error: "SERVER_ERROR",
      },
      500
    );
  }
}

