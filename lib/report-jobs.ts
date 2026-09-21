// Durable jobs are dispatched by the database clock, never by a worker calling itself.
export type ReportJob = { order_id: string; dispatch_id: string; failure_count: number; dispatch_count: number; manual_retries: number };

export function jobDecision(job: ReportJob, result: { ready?: boolean; error?: string; permanent?: boolean; busy?: boolean }, now = Date.now()) {
  const failures = result.error ? job.failure_count + 1 : 0;
  const failed = !!result.permanent || failures >= 6 || job.dispatch_count >= 60;
  const status = result.ready ? "completed" : failed ? "failed" : "queued";
  const delay = result.busy ? 7 * 60_000 : result.error ? Math.min(15 * 60_000, 60_000 * 2 ** Math.min(failures - 1, 4)) : 0;
  return { status, failure_count: failures, next_attempt_at: new Date(now + delay).toISOString(),
    last_error: result.ready ? null : result.error?.slice(0, 2000) || (failed ? "GENERATION_RETRY_LIMIT" : null), updated_at: new Date(now).toISOString() };
}

export async function enqueueReportJob(sb: any, orderId: string, retry = false) {
  const { error } = await sb.from("report_jobs").upsert({ order_id: orderId }, { onConflict: "order_id", ignoreDuplicates: true });
  if (error) throw new Error("REPORT_QUEUE_UNAVAILABLE");
  const { data: job, error: readError } = await sb.from("report_jobs").select("status,manual_retries").eq("order_id", orderId).single();
  if (readError) throw new Error("REPORT_QUEUE_UNAVAILABLE");
  if (retry && job.status === "failed" && job.manual_retries < 3) {
    const { data, error: retryError } = await sb.from("report_jobs").update({ status: "queued", failure_count: 0, dispatch_count: 0,
      manual_retries: job.manual_retries + 1, last_error: null, next_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("order_id", orderId).eq("status", "failed").eq("manual_retries", job.manual_retries).select("order_id").maybeSingle();
    if (retryError || !data) throw new Error("REPORT_RETRY_UNAVAILABLE");
    return { status:"queued", retried:true };
  }
  return { status:job.status, retried:false };
}

export async function claimDispatchedJob(sb: any, orderId: string, dispatchId: string) {
  const { data, error } = await sb.from("report_jobs").update({ status: "running", updated_at: new Date().toISOString() })
    .eq("order_id", orderId).eq("dispatch_id", dispatchId).eq("status", "dispatched")
    .gt("next_attempt_at", new Date().toISOString()).select("order_id,dispatch_id,failure_count,dispatch_count,manual_retries").maybeSingle();
  if (error) throw new Error("REPORT_QUEUE_CLAIM_FAILED");
  return data as ReportJob | null;
}

export async function settleReportJob(sb: any, job: ReportJob, result: Parameters<typeof jobDecision>[1]) {
  const decision = jobDecision(job, result);
  const { error } = await sb.from("report_jobs").update(decision).eq("order_id", job.order_id)
    .eq("dispatch_id", job.dispatch_id).eq("status", "running");
  if (error) throw new Error("REPORT_QUEUE_SETTLE_FAILED");
  return decision;
}
