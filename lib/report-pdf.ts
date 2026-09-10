import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

type SectionRow = {
  section_no: number;
  part_no: number | null;
  part_title: string | null;
  section_title: string;
  content_html: string | null;
};

function esc(s: any) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanContentHtml(html: string | null) {
  if (!html) return "";
  // OpenAI output is constrained, but strip script/style/event handlers defensively.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");
}

function partBlocks(sections: SectionRow[]) {
  const grouped = new Map<string, { partNo: number; partTitle: string; sections: SectionRow[] }>();

  for (const s of sections) {
    const partNo = Number(s.part_no || 0);
    const partTitle = s.part_title || `PART ${partNo}`;
    const key = `${partNo}::${partTitle}`;
    if (!grouped.has(key)) grouped.set(key, { partNo, partTitle, sections: [] });
    grouped.get(key)!.sections.push(s);
  }

  return [...grouped.values()]
    .sort((a, b) => a.partNo - b.partNo)
    .map((part) => `
      <section class="part">
        <div class="partTitle">PART ${part.partNo}. ${esc(part.partTitle)}</div>
        ${part.sections
          .sort((a, b) => a.section_no - b.section_no)
          .map((s) => `
            <article class="section" id="section-${s.section_no}">
              <div class="sectionNo">SECTION ${String(s.section_no).padStart(3, "0")}</div>
              <h2>${esc(s.section_title)}</h2>
              <div class="content">${cleanContentHtml(s.content_html)}</div>
            </article>
          `).join("")}
      </section>
    `).join("");
}


function buildToc(sections: SectionRow[]) {
  const grouped = new Map<number, { title: string; sections: SectionRow[] }>();

  for (const s of sections) {
    const partNo = Number(s.part_no || 0);
    if (!grouped.has(partNo)) {
      grouped.set(partNo, {
        title: s.part_title || `PART ${partNo}`,
        sections: [],
      });
    }
    grouped.get(partNo)!.sections.push(s);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([partNo, part]) => `
      <div class="tocPart">
        <div class="tocPartTitle">PART ${partNo}. ${esc(part.title)}</div>
        ${part.sections
          .sort((a, b) => a.section_no - b.section_no)
          .map((s) => `
            <a class="tocRow" href="#section-${s.section_no}">
              <span class="tocNo">${String(s.section_no).padStart(3, "0")}</span>
              <span class="tocTitle">${esc(s.section_title)}</span>
            </a>
          `).join("")}
      </div>
    `).join("");
}

export function buildReportHtml(args: {
  title: string;
  subtitle?: string;
  question?: string;
  generatedAt?: string;
  sections: SectionRow[];
}) {
  const { title, subtitle, question, generatedAt, sections } = args;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
@page { size:A4; margin:13mm 13mm 15mm 13mm; }
* { box-sizing:border-box; }
html, body { margin:0; padding:0; }
body {
  font-family:"Noto Sans KR", sans-serif;
  color:#1c1c1c;
  font-size:10pt;
  line-height:1.78;
  word-break:keep-all;
  overflow-wrap:anywhere;
}
.cover {
  min-height:255mm;
  display:flex;
  flex-direction:column;
  justify-content:center;
  padding:18mm 12mm;
  background:#111;
  color:#fff;
  page-break-after:always;
}
.brand { color:#e8b914; font-size:12pt; font-weight:900; letter-spacing:.12em; margin-bottom:25mm; }
.cover h1 { font-size:30pt; line-height:1.25; margin:0 0 8mm; letter-spacing:-.04em; }
.cover .sub { font-size:13pt; color:#e7e7e7; margin-bottom:12mm; }
.cover .meta { margin-top:auto; color:#bdbdbd; font-size:9pt; line-height:1.9; }
.questionBox {
  margin-top:8mm;
  border:1px solid #4b4b4b;
  background:#191919;
  border-radius:4mm;
  padding:5mm 6mm;
  color:#f1f1f1;
}

.toc {
  page-break-after:always;
  padding:3mm 1mm 0;
}
.tocHeader {
  margin-bottom:8mm;
}
.tocEyebrow {
  color:#b18719;
  font-size:9pt;
  font-weight:900;
  letter-spacing:.14em;
  margin-bottom:2mm;
}
.toc h1 {
  margin:0;
  font-size:24pt;
  line-height:1.25;
  letter-spacing:-.04em;
}
.tocDesc {
  margin-top:3mm;
  color:#777;
  font-size:9.5pt;
  line-height:1.65;
}
.tocPart {
  margin:0 0 5mm;
  break-inside:avoid;
}
.tocPartTitle {
  background:#f4ecd0;
  border-left:1.5mm solid #e8b914;
  padding:2.6mm 3mm;
  font-size:11pt;
  font-weight:900;
  margin-bottom:1.5mm;
}
.tocRow {
  display:grid;
  grid-template-columns:13mm 1fr;
  gap:2mm;
  align-items:start;
  padding:1.6mm 2mm;
  color:#222;
  text-decoration:none;
  border-bottom:0.2mm solid #eee8dc;
}
.tocNo {
  color:#b18719;
  font-weight:900;
  font-size:8.5pt;
}
.tocTitle {
  font-size:9.2pt;
  line-height:1.45;
}

.part { margin:0; }
.partTitle {
  background:#e8b914;
  color:#111;
  font-size:16pt;
  line-height:1.3;
  font-weight:900;
  padding:5mm 6mm;
  margin:0 0 5mm;
  border-radius:3mm;
  page-break-after:avoid;
}
.section {
  margin:0 0 6mm;
  padding:6mm 6.5mm;
  border:0.25mm solid #e5dfd1;
  border-radius:3.5mm;
  background:#fff;
  break-inside:avoid;
  page-break-inside:avoid;
}
.sectionNo {
  font-size:8.6pt;
  color:#b18719;
  font-weight:900;
  letter-spacing:.08em;
  margin-bottom:1.7mm;
}
h2 {
  font-size:15pt;
  line-height:1.4;
  letter-spacing:-.035em;
  margin:0 0 4mm;
  page-break-after:avoid;
}
.content p { margin:0 0 3.5mm; }
.content p:last-child { margin-bottom:0; }
.content ul { margin:2mm 0 2mm 5mm; padding-left:4mm; }
.content li { margin:0 0 1.5mm; }
.content strong { font-weight:800; }
.footerNote {
  margin-top:6mm;
  padding-top:4mm;
  border-top:0.25mm solid #ddd5c7;
  color:#8a8377;
  font-size:8pt;
}
</style>
</head>
<body>
  <section class="cover">
    <div class="brand">나의사주 · PERSONAL REPORT</div>
    <h1>${esc(title)}</h1>
    <div class="sub">${esc(subtitle || "132개 질문으로 구성한 개인맞춤 종합 사주 리포트")}</div>
    ${question ? `<div class="questionBox"><strong>내 질문</strong><br>${esc(question)}</div>` : ""}
    <div class="meta">
      주문 후 자동 생성된 개인맞춤 리포트<br>
      ${generatedAt ? `생성일 ${esc(generatedAt)}` : ""}
    </div>
  </section>

  <section class="toc">
    <div class="tocHeader">
      <div class="tocEyebrow">CONTENTS</div>
      <h1>목차</h1>
      <div class="tocDesc">PART와 132개 질문을 한눈에 확인할 수 있습니다. 항목을 누르면 해당 내용으로 이동합니다.</div>
    </div>
    ${buildToc(sections)}
  </section>

  ${partBlocks(sections)}

  <div class="footerNote">
    본 리포트는 명리학적 해석을 바탕으로 한 참고 자료이며 의료·법률·투자 등의 전문적 판단을 대신하지 않습니다.
  </div>
</body>
</html>`;
}

export async function htmlToPdfBuffer(html: string) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 90000 });

    // Make sure Korean webfont is fully ready before printing.
    await page.evaluate(async () => {
      // @ts-ignore
      if (document.fonts?.ready) await document.fonts.ready;
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
