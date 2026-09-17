import { getReportCategoryConfig } from "./report-categories";

export function reportState(report: any, product: any) {
  const j = report?.report_json || {};
  const completed = Math.max(0, Number(j.completed_sections) || 0);
  // Keep the purchased edition's section count, including historical 132-section reports.
  const total = Math.max(completed, Number(j.total_sections) || getReportCategoryConfig(product).outline.length);
  const ready = !!j.pdf_storage_path && j.pdf_ready !== false;
  const failed = !ready && (!!report?.error_message || report?.status === "failed" || Number(j.background_no_progress_count) >= 6);
  return { ready, completed, total, status: ready ? "completed" : failed ? "failed" : report?.status || "queued" };
}
