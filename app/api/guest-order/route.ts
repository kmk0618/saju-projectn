import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function maskEmail(email: string | null) {
  if (!email) return "";
  const [id, domain] = email.split("@");
  if (!domain) return email;
  const safeId =
    id.length <= 2
      ? id.slice(0, 1) + "*"
      : id.slice(0, 2) + "*".repeat(Math.max(2, id.length - 2));
  return `${safeId}@${domain}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("token") || "").trim();

    if (!/^[0-9a-fA-F-]{36}$/.test(token)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    const supabase = getAdmin();

    const { data: order, error: orderError } = await supabase
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
      return NextResponse.json(
        { ok: false, error: "ORDER_LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select(`
        id,
        title,
        status,
        summary,
        report_json,
        generation_model,
        prompt_version,
        generated_at,
        created_at
      `)
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportError) {
      console.error(reportError);
    }

    let sections: any[] = [];

    if (report?.id) {
      const { data: sectionRows, error: sectionError } = await supabase
        .from("report_sections")
        .select(`
          id,
          section_no,
          part_no,
          part_title,
          section_title,
          content_html,
          content_json
        `)
        .eq("report_id", report.id)
        .order("section_no", { ascending: true });

      if (sectionError) {
        console.error(sectionError);
      } else {
        sections = sectionRows || [];
      }
    }

    const payload: any = order.payment_payload || {};
    const input: any = payload.guest_input || {};
    const productRaw: any = order.products;
    const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        merchant_uid: order.merchant_uid,
        status: order.status,
        listed_amount_krw: order.amount_krw,
        charged_amount_krw:
          payload.charged_amount_krw ?? order.amount_krw,
        is_test:
          payload.test_mode === true || order.pg_provider === "TEST_FREE",
        paid_at: order.paid_at,
        created_at: order.created_at,
        guest_email_masked: maskEmail(order.guest_email),
        product: product || null,
        input: {
          y: input.y ?? "",
          m: input.m ?? "",
          d: input.d ?? "",
          h: input.h ?? "",
          mi: input.mi ?? "",
          unknown_time: !!input.unknown_time,
          region: input.region ?? "",
          qcat: input.qcat ?? "",
          question: input.question ?? "",
        },
      },
      report: report || null,
      sections,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
