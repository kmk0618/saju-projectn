import { NextResponse } from "next/server";
import { getAdminSupabase, getPortOneV1Payment, markOrderPaidFromPortOneV1 } from "@/lib/portone";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => null);
    const impUid = String(body?.imp_uid || "").trim();
    const merchantUid = String(body?.merchant_uid || "").trim();
    if (!impUid || !merchantUid) {
      return NextResponse.json({ ok: false, error: "IMP_UID_AND_MERCHANT_UID_REQUIRED" }, { status: 400 });
    }

    const sb = getAdminSupabase();
    const { data: order, error } = await sb
      .from("orders")
      .select("id,user_id,guest_access_token,guest_email,merchant_uid,amount_krw,status,payment_payload")
      .eq("merchant_uid", merchantUid)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: "ORDER_LOOKUP_FAILED" }, { status: 500 });
    if (!order) return NextResponse.json({ ok: true, ignored: "ORDER_NOT_FOUND" });
    if (order.status === "paid") return NextResponse.json({ ok: true, already_paid: true });

    const payment = await getPortOneV1Payment(impUid);
    if (String(payment.status || "").toLowerCase() !== "paid") {
      return NextResponse.json({ ok: true, ignored: `STATUS_${payment.status || "UNKNOWN"}` });
    }

    await markOrderPaidFromPortOneV1(sb, order, payment);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("PORTONE_V1_WEBHOOK_ERROR", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
