import { NextResponse } from "next/server";
import { getAdminSupabase, getPortOnePayment, markOrderPaidFromPortOne } from "@/lib/portone";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => null);
    const paymentId = String(body?.data?.paymentId || body?.paymentId || "").trim();
    if (!paymentId) return NextResponse.json({ ok: false, error: "PAYMENT_ID_REQUIRED" }, { status: 400 });

    const sb = getAdminSupabase();
    const { data: order, error } = await sb
      .from("orders")
      .select("id,user_id,guest_access_token,guest_email,merchant_uid,amount_krw,status,payment_payload")
      .eq("merchant_uid", paymentId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: "ORDER_LOOKUP_FAILED" }, { status: 500 });
    if (!order) return NextResponse.json({ ok: true, ignored: "ORDER_NOT_FOUND" });
    if (order.status === "paid") return NextResponse.json({ ok: true, already_paid: true });

    const payment = await getPortOnePayment(paymentId);
    if (String(payment.status || "").toUpperCase() !== "PAID") {
      return NextResponse.json({ ok: true, ignored: `STATUS_${payment.status || "UNKNOWN"}` });
    }

    await markOrderPaidFromPortOne(sb, order, payment);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("PORTONE_WEBHOOK_ERROR", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
