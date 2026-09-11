import { createClient } from "@supabase/supabase-js";

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_SERVER_ENV");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getPortOnePublicConfig() {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim();
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim();
  if (!storeId) throw new Error("MISSING_PORTONE_STORE_ID");
  if (!channelKey) throw new Error("MISSING_PORTONE_CHANNEL_KEY");
  return { storeId, channelKey };
}

export async function getPortOnePayment(paymentId: string) {
  const secret = process.env.PORTONE_API_SECRET?.trim();
  if (!secret) throw new Error("MISSING_PORTONE_API_SECRET");

  const response = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `PortOne ${secret}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`PORTONE_NON_JSON_${response.status}`);
  }

  if (!response.ok) {
    const message = data?.message || data?.type || raw || `HTTP_${response.status}`;
    throw new Error(`PORTONE_LOOKUP_FAILED:${message}`);
  }
  return data;
}

export function portOnePaidAmount(payment: any): number | null {
  const candidates = [
    payment?.amount?.total,
    payment?.totalAmount,
    payment?.amount,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export async function markOrderPaidFromPortOne(
  sb: ReturnType<typeof getAdminSupabase>,
  order: any,
  payment: any
) {
  if (!payment || String(payment.status || "").toUpperCase() !== "PAID") {
    throw new Error(`PAYMENT_NOT_PAID:${payment?.status || "UNKNOWN"}`);
  }

  const expected = Number(order.amount_krw);
  const actual = portOnePaidAmount(payment);
  if (!Number.isFinite(expected) || actual === null || actual !== expected) {
    throw new Error(`PAYMENT_AMOUNT_MISMATCH:${actual}:${expected}`);
  }

  if (payment.id && String(payment.id) !== String(order.merchant_uid)) {
    throw new Error("PAYMENT_ID_MISMATCH");
  }

  const existingPayload = order.payment_payload && typeof order.payment_payload === "object"
    ? order.payment_payload
    : {};

  const payload = {
    ...existingPayload,
    test_mode: false,
    charged_amount_krw: actual,
    listed_amount_krw: expected,
    portone: payment,
  };

  const paidAt = payment.paidAt || payment.statusChangedAt || new Date().toISOString();
  const pgPaymentId = payment.transactionId || payment.id || order.merchant_uid;

  const { data: updated, error } = await sb
    .from("orders")
    .update({
      status: "paid",
      paid_at: paidAt,
      pg_provider: "PORTONE_V2",
      pg_payment_id: pgPaymentId,
      payment_payload: payload,
    })
    .eq("id", order.id)
    .select("id,status,guest_access_token,merchant_uid,amount_krw,paid_at,user_id,guest_email")
    .single();

  if (error || !updated) {
    throw new Error(`ORDER_PAID_UPDATE_FAILED:${error?.message || "NO_ROW"}`);
  }
  return updated;
}
