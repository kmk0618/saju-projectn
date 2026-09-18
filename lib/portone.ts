import { createClient } from "@supabase/supabase-js";

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_SERVER_ENV");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getPortOneV1PublicConfig() {
  const impCode = process.env.NEXT_PUBLIC_PORTONE_IMP_CODE?.trim();
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim();
  if (!impCode) throw new Error("MISSING_PORTONE_IMP_CODE");
  if (!channelKey) throw new Error("MISSING_PORTONE_CHANNEL_KEY");
  return { impCode, channelKey };
}

async function getPortOneV1AccessToken() {
  const impKey = process.env.PORTONE_V1_API_KEY?.trim();
  const impSecret = process.env.PORTONE_V1_API_SECRET?.trim();
  if (!impKey) throw new Error("MISSING_PORTONE_V1_API_KEY");
  if (!impSecret) throw new Error("MISSING_PORTONE_V1_API_SECRET");

  const response = await fetch("https://api.iamport.kr/users/getToken", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ imp_key: impKey, imp_secret: impSecret }),
    cache: "no-store",
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || data?.code !== 0 || !data?.response?.access_token) {
    throw new Error(`PORTONE_V1_TOKEN_FAILED:${data?.message || response.status}`);
  }
  return String(data.response.access_token);
}

export async function getPortOneV1Payment(impUid: string) {
  if (!impUid) throw new Error("IMP_UID_REQUIRED");
  const accessToken = await getPortOneV1AccessToken();
  const response = await fetch(
    `https://api.iamport.kr/payments/${encodeURIComponent(impUid)}`,
    {
      method: "GET",
      headers: {
        Authorization: accessToken,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );
  const data: any = await response.json().catch(() => null);
  if (!response.ok || data?.code !== 0 || !data?.response) {
    throw new Error(`PORTONE_V1_LOOKUP_FAILED:${data?.message || response.status}`);
  }
  return data.response;
}

function isoFromUnixSeconds(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

export function legacyTruncatedMerchantUid(value: string) {
  return /^saju-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) ? value.slice(0, 40) : null;
}

export async function getPortOneV1PaymentForOrder(merchantUid: string) {
  const accessToken = await getPortOneV1AccessToken();
  const candidates = [merchantUid, legacyTruncatedMerchantUid(merchantUid)].filter(Boolean);
  for (const candidate of candidates) {
    const response = await fetch(`https://api.iamport.kr/payments/find/${encodeURIComponent(candidate!)}/paid`, {
      headers: { Authorization: accessToken, Accept: "application/json" }, cache: "no-store",
    });
    const data: any = await response.json().catch(() => null);
    if (response.ok && data?.code === 0 && data?.response) return data.response;
    if (response.status !== 404 && (!response.ok || data?.code !== -1)) throw new Error("PORTONE_V1_LOOKUP_FAILED");
  }
  throw new Error("PAYMENT_NOT_PAID:NOT_FOUND");
}

export async function markOrderPaidFromPortOneV1(
  sb: ReturnType<typeof getAdminSupabase>,
  order: any,
  payment: any
) {
  if (!payment || String(payment.status || "").toLowerCase() !== "paid") {
    throw new Error(`PAYMENT_NOT_PAID:${payment?.status || "UNKNOWN"}`);
  }

  const expected = Number(order.amount_krw);
  const actual = Number(payment.amount);
  if (!Number.isFinite(expected) || !Number.isFinite(actual) || actual !== expected) {
    throw new Error(`PAYMENT_AMOUNT_MISMATCH:${actual}:${expected}`);
  }

  const expectedMerchant = String(order.merchant_uid || "");
  const actualMerchant = String(payment.merchant_uid || "");
  if (actualMerchant !== expectedMerchant) {
    // Compatibility is limited to our exact historical 41-character UUID
    // format, and only when the stored prefix identifies exactly this order.
    if (!actualMerchant || actualMerchant !== legacyTruncatedMerchantUid(expectedMerchant)) throw new Error("MERCHANT_UID_MISMATCH");
    const { data: matches, error: matchError } = await sb.from("orders").select("id").like("merchant_uid", `${actualMerchant}%`).limit(2);
    if (matchError || matches?.length !== 1 || matches[0].id !== order.id) throw new Error("MERCHANT_UID_AMBIGUOUS");
  }

  const existingPayload = order.payment_payload && typeof order.payment_payload === "object"
    ? order.payment_payload
    : {};

  const payload = {
    ...existingPayload,
    test_mode: false,
    charged_amount_krw: actual,
    verified_merchant_uid: actualMerchant,
    listed_amount_krw: existingPayload.listed_amount_krw ?? expected,
    portone_v1: payment,
  };

  const { data: updated, error } = await sb
    .from("orders")
    .update({
      status: "paid",
      paid_at: isoFromUnixSeconds(payment.paid_at),
      pg_provider: "PORTONE_V1",
      pg_payment_id: String(payment.imp_uid || payment.pg_tid || ""),
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
