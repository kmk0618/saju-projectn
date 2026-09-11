(function () {
  const token = new URLSearchParams(location.search).get("token") || "";
  if (!/^[0-9a-fA-F-]{36}$/.test(token)) return;

  let busy = false;
  let stopped = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function jsonFetch(url, options) {
    const r = await fetch(url, { cache: "no-store", ...(options || {}) });
    const raw = await r.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (!r.ok || !data?.ok) {
      const msg =
        (data?.error || ("HTTP_" + r.status)) +
        (data?.detail ? " : " + data.detail : "");
      throw new Error(msg);
    }
    return data;
  }

  async function state() {
    return jsonFetch("/api/guest-order?token=" + encodeURIComponent(token));
  }

  async function generateBatch() {
    return jsonFetch("/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  }

  async function ensurePdf() {
    const r = await fetch(
      "/api/report/pdf?token=" + encodeURIComponent(token),
      { cache: "no-store" }
    );

    if (r.ok && (r.headers.get("content-type") || "").includes("application/pdf")) {
      return true;
    }

    const raw = await r.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    throw new Error(
      (data?.error || ("PDF_HTTP_" + r.status)) +
      (data?.detail ? " : " + data.detail : "")
    );
  }

  async function loop() {
    if (busy || stopped) return;
    busy = true;

    try {
      const d = await state();
      const report = d.report || null;
      const j = report?.report_json || {};
      const currentEngine = String(report?.prompt_version || "").startsWith("life-report-aqua-50");
      const completed = currentEngine ? Number(
        j.completed_sections ??
        d.sections?.length ??
        0
      ) : 0;
      const pdfReady =
        currentEngine &&
        report?.status === "completed" &&
        !!j.pdf_storage_path &&
        j.pdf_ready !== false;

      if (pdfReady) {
        stopped = true;
        window.dispatchEvent(new CustomEvent("saju-report-completed"));
        return;
      }

      if (completed >= 50) {
        await ensurePdf();
        await sleep(700);
        window.dispatchEvent(new CustomEvent("saju-report-progress"));
        location.reload();
        return;
      }

      const result = await generateBatch();

      window.dispatchEvent(
        new CustomEvent("saju-report-progress", { detail: result })
      );

      if (result.status === "completed" && result.pdf_ready) {
        stopped = true;
        location.reload();
        return;
      }

      await sleep(900);
    } catch (e) {
      console.error("[REPORT AUTOSTART]", e);
      await sleep(8000);
    } finally {
      busy = false;
      if (!stopped) setTimeout(loop, 100);
    }
  }

  loop();
})();
