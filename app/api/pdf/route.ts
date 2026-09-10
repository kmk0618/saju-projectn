import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_ENV");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = String(url.searchParams.get("token") || "").trim();
    const download = url.searchParams.get("download") === "1";

    if (!/^[0-9a-fA-F-]{36}$/.test(token)) {
      return NextResponse.json({ ok:false, error:"INVALID_TOKEN" }, { status:400 });
    }

    const sb = admin();

    const { data: order, error: orderError } = await sb
      .from("orders")
      .select("id,status,guest_access_token,product_id")
      .eq("guest_access_token", token)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ ok:false, error:"ORDER_NOT_FOUND" }, { status:404 });
    }
    if (order.status !== "paid") {
      return NextResponse.json({ ok:false, error:"ORDER_NOT_PAID" }, { status:409 });
    }

    const { data: report, error: reportError } = await sb
      .from("reports")
      .select("id,title,status,report_json")
      .eq("order_id", order.id)
      .order("created_at", { ascending:false })
      .limit(1)
      .maybeSingle();

    if (reportError || !report) {
      return NextResponse.json({ ok:false, error:"REPORT_NOT_FOUND" }, { status:404 });
    }

    const reportJson: any = report.report_json || {};
    const path = reportJson.pdf_storage_path;

    if (report.status !== "completed" || !path) {
      return NextResponse.json({
        ok:false,
        error:"PDF_NOT_READY",
        status:report.status,
        progress:reportJson.progress || 0
      }, { status:409 });
    }

    const { data: blob, error: downloadError } = await sb.storage
      .from("report-pdfs")
      .download(path);

    if (downloadError || !blob) {
      return NextResponse.json({ ok:false, error:"PDF_STORAGE_READ_FAILED" }, { status:500 });
    }

    const bytes = Buffer.from(await blob.arrayBuffer());
    const filename = `${String(report.title || "나의사주_리포트").replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
    const disposition = download ? "attachment" : "inline";
    const encoded = encodeURIComponent(filename);

    return new Response(bytes, {
      status:200,
      headers:{
        "Content-Type":"application/pdf",
        "Content-Length":String(bytes.length),
        "Content-Disposition":`${disposition}; filename*=UTF-8''${encoded}`,
        "Cache-Control":"private, no-store, max-age=0",
        "X-Content-Type-Options":"nosniff"
      }
    });
  } catch (e:any) {
    console.error("REPORT_PDF_ROUTE_ERROR", e);
    return NextResponse.json({
      ok:false,
      error:"SERVER_ERROR",
      detail:e?.message || String(e)
    }, { status:500 });
  }
}
