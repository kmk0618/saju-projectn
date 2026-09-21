import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/portone";
import { reportState } from "@/lib/report-state";

export async function GET(req: Request) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  const respond = (data: any, status = 200) => NextResponse.json(data, { status, headers });
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (!token) return respond({ ok: false, error: "LOGIN_REQUIRED" }, 401);
    const sb = getAdminSupabase();
    const { data: auth, error: authError } = await sb.auth.getUser(token);
    if (authError || !auth.user) return respond({ ok: false, error: "INVALID_SESSION" }, 401);
    const params = new URL(req.url).searchParams;
    const page = Math.max(0, Math.floor(Number(params.get("page")) || 0));
    const guest = params.get("guest") === "1";
    if (guest && (!auth.user.email || !auth.user.email_confirmed_at)) return respond({ ok: false, error: "VERIFIED_EMAIL_REQUIRED" }, 403);
    let orderQuery = sb.from("orders").select("id,guest_access_token,created_at,products(name,slug,report_type)").eq("status", "paid");
    orderQuery = guest
      ? orderQuery.is("user_id", null).eq("guest_email", auth.user.email!.toLowerCase())
      : orderQuery.eq("user_id", auth.user.id);
    const { data: orders, error } = await orderQuery.order("created_at", { ascending: false }).range(page * 30, page * 30 + 29);
    if (error) throw error;
    if (!orders?.length) return respond({ ok: true, orders: [], has_more: false });
    const { data: reports, error: reportError } = await sb.from("reports")
      .select("order_id,title,status,report_json,error_message,created_at").in("order_id", orders.map(o => o.id)).order("created_at", { ascending: false });
    if (reportError) throw reportError;
    const { data: jobs, error: jobsError } = await sb.from("report_jobs").select("order_id,status").in("order_id", orders.map(o => o.id));
    if (jobsError) throw jobsError;
    return respond({ ok: true, has_more: orders.length === 30, orders: orders.map(o => {
      const product = Array.isArray(o.products) ? o.products[0] : o.products;
      const report = reports?.find(r => r.order_id === o.id);
      const state = reportState(report, product);
      const job = jobs?.find(j => j.order_id === o.id);
      if (!state.ready && job) state.status = job.status === "failed" ? "failed" : "generating";
      return { id: o.id, token: o.guest_access_token, name: product?.name || report?.title || "구매 리포트", created_at: o.created_at, ...state };
    }) });
  } catch {
    return respond({ ok: false, error: "ORDER_LOOKUP_FAILED" }, 500);
  }
}
