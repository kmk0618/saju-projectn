import { createHmac, timingSafeEqual } from "node:crypto";

const LEASE_MS = 6 * 60 * 1000; // Longer than the 300-second function deadline.
export async function claimGeneration(sb: any, order: any) {
  const previous = order.payment_payload || {};
  if (Number(previous.generation_lease?.expires_at) > Date.now()) return null;
  const lease = { id: crypto.randomUUID(), expires_at: Date.now() + LEASE_MS };
  let query = sb.from("orders").update({ payment_payload: { ...previous, generation_lease: lease } }).eq("id", order.id).eq("status", "paid");
  query = order.payment_payload == null ? query.is("payment_payload", null) : query.eq("payment_payload", JSON.stringify(previous));
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error("GENERATION_LOCK_FAILED");
  return data ? lease : null;
}

export async function releaseGeneration(sb: any, orderId: string, leaseId: string) {
  const { data } = await sb.from("orders").select("payment_payload").eq("id", orderId).maybeSingle();
  const previous = data?.payment_payload;
  if (previous?.generation_lease?.id !== leaseId) return;
  const next = { ...previous };
  delete next.generation_lease;
  const { error } = await sb.from("orders").update({ payment_payload: next }).eq("id", orderId).eq("payment_payload", JSON.stringify(previous));
  if (error) throw new Error("GENERATION_UNLOCK_FAILED");
}

function signature(token: string, timestamp: string) {
  const secret = process.env.REPORT_WORKER_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("MISSING_WORKER_SECRET");
  return createHmac("sha256", secret).update(`${timestamp}:${token}`).digest("hex");
}
export function workerHeaders(token: string) {
  const timestamp = String(Date.now());
  return { "x-report-worker-time": timestamp, "x-report-worker-signature": signature(token, timestamp) };
}
export function validWorker(req: Request, token: string) {
  const timestamp = req.headers.get("x-report-worker-time") || "";
  const supplied = req.headers.get("x-report-worker-signature") || "";
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 60_000 || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(signature(token, timestamp), "hex"));
}
