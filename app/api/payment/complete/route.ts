import { NextResponse } from "next/server";
import { getAdminSupabase, getPortOneV1Payment, markOrderPaidFromPortOneV1 } from "@/lib/portone";

export const runtime = "nodejs";
export const maxDuration = 30;

function J(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return J({ ok: false, error: "INVALID_JSON" }, 400);

    const orderId = String(body.order_id || "").trim();
    const merchantUid = String(body.merchant_uid || "").trim();
    const impUid = String(body.imp_uid || "").trim();
    const guestToken = String(body.guest_token || "").trim();
    if (!orderId || !merchantUid || !impUid) {
      return J({ ok: false, error: "ORDER_MERCHANT_IMP_REQUIRED" }, 400);
    }

    const sb = getAdminSupabase();
    const { data: order, error: orderError } = await sb
      .from("orders")
      .select("id,user_id,guest_access_token,guest_email,merchant_uid,amount_krw,status,payment_payload")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) return J({ ok: false, error: "ORDER_LOOKUP_FAILED", detail: orderError.message }, 500);
    if (!order) return J({ ok: false, error: "ORDER_NOT_FOUND" }, 404);
    if (String(order.merchant_uid) !== merchantUid) return J({ ok: false, error: "MERCHANT_UID_MISMATCH" }, 409);

    if (order.user_id) {
      const authHeader = req.headers.get("authorization") || "";
      const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!accessToken) return J({ ok: false, error: "LOGIN_REQUIRED" }, 401);
      const { data, error } = await sb.auth.getUser(accessToken);
      if (error || !data?.user || data.user.id !== order.user_id) {
        return J({ ok: false, error: "ORDER_ACCESS_DENIED" }, 403);
      }
    } else if (!guestToken || guestToken !== order.guest_access_token) {
      return J({ ok: false, error: "ORDER_ACCESS_DENIED" }, 403);
    }

    if (order.status === "paid") {
      return J({ ok: true, already_paid: true, guest_token: order.guest_access_token });
    }

    const payment = await getPortOneV1Payment(impUid);
    const updated = await markOrderPaidFromPortOneV1(sb, order, payment);

    return J({
      ok: true,
      status: updated.status,
      order_id: updated.id,
      guest_token: updated.guest_access_token,
    });
  } catch (e: any) {
    console.error("PAYMENT_COMPLETE_ERROR", e);
    const msg = e?.message || String(e);
    const status = msg.startsWith("PAYMENT_NOT_PAID") || msg.startsWith("PAYMENT_AMOUNT_MISMATCH") || msg.startsWith("MERCHANT_UID_MISMATCH") ? 409 : 500;
    return J({ ok: false, error: "PAYMENT_VERIFY_FAILED", detail: msg }, status);
  }
}
