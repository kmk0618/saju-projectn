import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildReportHtml, htmlToPdfBuffer, PDF_RENDERER_VERSION } from "@/lib/report-pdf";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_ENV");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadOrderReport(sb: any, token: string) {
  const { data: order, error: orderError } = await sb
    .from("orders")
    .select("id,status,guest_access_token,product_id,payment_payload,created_at")
    .eq("guest_access_token", token)
    .maybeSingle();
  if (orderError || !order) throw new Error("ORDER_NOT_FOUND");
  if (order.status !== "paid") throw new Error("ORDER_NOT_PAID");

  const { data: report, error: reportError } = await sb
    .from("reports")
    .select("id,title,status,report_json,prompt_version,created_at,generated_at")
    .eq("order_id", order.id)
    .order("created_at", { ascending:false })
    .limit(1)
    .maybeSingle();
  if (reportError || !report) throw new Error("REPORT_NOT_FOUND");
  return { order, report };
}

async function ensurePdf(sb: any, order: any, report: any) {
  const rj: any = report.report_json || {};
  const totalSections = Number(rj.total_sections || 0);
  if (!totalSections) throw new Error("PDF_REPORT_SPEC_MISSING");
  if (rj.pdf_storage_path && rj.pdf_ready !== false && rj.pdf_renderer_version === PDF_RENDERER_VERSION) return { path:rj.pdf_storage_path, size:rj.pdf_size || null };

  const { data: sections, error: sectionsError } = await sb
    .from("report_sections")
    .select("section_no,part_no,part_title,section_title,content_html,content_json")
    .eq("report_id", report.id)
    .order("section_no", { ascending:true });
  if (sectionsError) throw new Error("SECTION_LOAD_FAILED:" + sectionsError.message);
  if (!sections || sections.filter((x:any) => Number(x.section_no) >= 1 && Number(x.section_no) <= totalSections).length < totalSections) throw new Error(`PDF_NOT_READY:${sections?.length || 0}/${totalSections}`);

  await sb.from("reports").update({
    status:"generating",
    report_json:{ ...rj, total_sections:totalSections, completed_sections:totalSections, progress:97, phase:"pdf_generating", pdf_ready:false },
    error_message:null,
  }).eq("id", report.id);

  const input = order.payment_payload?.guest_input || {};
  const html = buildReportHtml({
    title: report.title || "종합 인생 리포트",
    subtitle: rj.report_subtitle || "개인맞춤 사주 리포트",
    question: input.question || "",
    generatedAt: new Date().toLocaleDateString("ko-KR", { timeZone:"Asia/Seoul" }),
    sections,
    input,
    narrative:rj.narrative || null,
  });
  const pdf = await htmlToPdfBuffer(html);
  const safeVersion = String(report.prompt_version || rj.report_category || "report").replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `guest/${order.id}/${report.id}-${safeVersion}-${PDF_RENDERER_VERSION}.pdf`;
  const { error: uploadError } = await sb.storage.from("report-pdfs").upload(path, pdf, { contentType:"application/pdf", cacheControl:"0", upsert:true });
  if (uploadError) throw new Error("PDF_UPLOAD_FAILED:" + uploadError.message);

  const nextJson = {
    ...rj,
    total_sections:totalSections,
    completed_sections:totalSections,
    progress:100,
    phase:"completed",
    pdf_ready:true,
    pdf_storage_path:path,
    pdf_size:pdf.length,
    pdf_generated_at:new Date().toISOString(),
    pdf_renderer_version:PDF_RENDERER_VERSION,
  };
  const { error: updateError } = await sb.from("reports").update({
    status:"completed",
    generated_at:report.generated_at || new Date().toISOString(),
    report_json:nextJson,
    prompt_version:report.prompt_version,
    error_message:null,
  }).eq("id", report.id);
  if (updateError) throw new Error("PDF_STATUS_SAVE_FAILED:" + updateError.message);
  return { path, size:pdf.length };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = String(url.searchParams.get("token") || "").trim();
    const download = url.searchParams.get("download") === "1";
    if (!/^[0-9a-fA-F-]{36}$/.test(token)) return NextResponse.json({ ok:false, error:"INVALID_TOKEN" }, { status:400 });

    const sb = admin();
    const { order, report } = await loadOrderReport(sb, token);
    const pdfInfo = await ensurePdf(sb, order, report);
    const { data: blob, error: fileError } = await sb.storage.from("report-pdfs").download(pdfInfo.path);
    if (fileError || !blob) throw new Error("PDF_STORAGE_READ_FAILED");
    const bytes = Buffer.from(await blob.arrayBuffer());
    const safeTitle = String(report.title || "나의사주_리포트").replace(/[\\/:*?"<>|]/g, "_");
    const encoded = encodeURIComponent(`${safeTitle}.pdf`);
    return new Response(bytes, { status:200, headers:{
      "Content-Type":"application/pdf",
      "Content-Length":String(bytes.length),
      "Content-Disposition":`${download ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
      "Cache-Control":"private, no-store, max-age=0",
      "X-Content-Type-Options":"nosniff",
    }});
  } catch (e:any) {
    console.error("REPORT_PDF_ERROR", e);
    const msg = e?.message || String(e);
    let status = 500;
    if (msg === "ORDER_NOT_FOUND" || msg === "REPORT_NOT_FOUND") status = 404;
    else if (msg === "ORDER_NOT_PAID" || msg.startsWith("PDF_NOT_READY:")) status = 409;
    return NextResponse.json({ ok:false, error:msg.split(":")[0], detail:msg }, { status });
  }
}
