import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { REPORT_CHAPTERS, REPORT_VERSION } from "@/lib/report-spec";

export const PDF_RENDERER_VERSION = "aqua50-editorial-v4";

type SectionRow = {
  section_no: number;
  part_no: number | null;
  part_title: string | null;
  section_title: string;
  content_html: string | null;
  content_json?: any;
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
  // body_html is generated from a constrained schema. Keep the editorial tags
  // (tables, lead/subhead/emph/check) intact and strip only executable content.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function editorialSupplement(row: SectionRow) {
  const j = row.content_json || {};
  const layout = String(j.layout_type || "prose");
  const html = String(row.content_html || "");
  const hasTable = /<table\b/i.test(html);
  const hasCheck = /<ul[^>]*class=["'][^"']*check/i.test(html);
  const tableRows = Array.isArray(j.table_rows) ? j.table_rows.filter((x:any) => x?.label || x?.value) : [];
  const checklist = Array.isArray(j.checklist) ? j.checklist.filter(Boolean) : [];

  // Fallback only for layouts whose editorial contract explicitly calls for a table/checklist.
  // Do not append generic cards to prose sections.
  let out = "";
  if (!hasTable && ["table", "strategy", "timeline", "comparison"].includes(layout) && tableRows.length) {
    out += `<div class="dataTableWrap"><table class="dataTable"><tbody>${tableRows.map((r:any) => `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  if (!hasCheck && ["checklist", "strategy"].includes(layout) && checklist.length) {
    out += `<ul class="check supplementCheck">${checklist.map((x:string) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  }
  return out;
}

function chapterBlocks(sections: SectionRow[], narrative: any) {
  return REPORT_CHAPTERS.map((chapter) => {
    const rows = sections.filter((s) => Number(s.part_no) === chapter.part_no).sort((a,b) => a.section_no - b.section_no);
    if (!rows.length) return "";
    const thesis = narrative?.chapter_theses?.[String(chapter.part_no)] || chapter.subtitle;
    return `
      <section class="chapterCover">
        <div class="chapterEyebrow">CHAPTER ${chapter.part_no}</div>
        <h1>${esc(chapter.part_title)}</h1>
        <p>${esc(chapter.subtitle)}</p>
      </section>
      <section class="chapterMessage">
        <div class="eyebrow">CHAPTER ${chapter.part_no} 핵심 메시지</div>
        <h2>${esc(thesis)}</h2>
        <p>앞에서 확인한 계산값을 필요한 곳에서만 사용해, 같은 사주 용어를 반복하지 않고 실제 생활과 선택의 언어로 이어갑니다.</p>
      </section>
      <section class="chapterBody">
        ${rows.map((s) => `
          <article class="section layout-${esc(s.content_json?.layout_type || "prose")}" id="section-${s.section_no}">
            <div class="sectionNo">SECTION ${String(s.section_no).padStart(2, "0")}</div>
            <h2>${esc(s.section_title)}</h2>
            <div class="content">${cleanContentHtml(s.content_html)}</div>
            ${editorialSupplement(s)}
          </article>
        `).join("")}
      </section>`;
  }).join("");
}

function buildToc(sections: SectionRow[]) {
  return REPORT_CHAPTERS.map((ch) => {
    const rows = sections.filter((s) => Number(s.part_no) === ch.part_no).sort((a,b) => a.section_no - b.section_no);
    return `
      <div class="tocPart">
        <div class="tocPartTitle">CHAPTER ${ch.part_no}. ${esc(ch.part_title)}</div>
        <div class="tocGrid">
          ${rows.map((s) => `<a class="tocRow" href="#section-${s.section_no}"><span>${String(s.section_no).padStart(2,"0")}</span><b>${esc(s.section_title)}</b></a>`).join("")}
        </div>
      </div>`;
  }).join("");
}

export function buildReportHtml(args: {
  title: string;
  subtitle?: string;
  question?: string;
  generatedAt?: string;
  sections: SectionRow[];
  input?: any;
  narrative?: any;
}) {
  const { title, subtitle, question, generatedAt, sections, input, narrative } = args;
  const birthLine = input ? [
    input.year && input.month && input.day ? `${input.year}.${String(input.month).padStart(2,"0")}.${String(input.day).padStart(2,"0")} ${input.calendar_type === "solar" ? "양력" : "음력"}` : "",
    input.gender === "남" || input.gender === "male" ? "남성" : input.gender === "여" || input.gender === "female" ? "여성" : "",
    input.region_name || "",
    input.time_unknown ? "출생시간 미상" : input.hour != null ? `${String(input.hour).padStart(2,"0")}:${String(input.minute || 0).padStart(2,"0")}` : "",
  ].filter(Boolean).join(" · ") : "";

  const prologueTitle = narrative?.core_thesis || "타고난 구조를 이해하면, 지금의 선택이 훨씬 선명해집니다";
  const prologueBody = narrative?.current_question_thesis || "이 리포트는 사주 원국을 먼저 구조적으로 읽고, 그 구조가 일·돈·관계·현재 흐름에서 어떻게 나타나는지 연결한 뒤 마지막에 지금의 질문에 직접 답합니다.";

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&family=Noto+Serif+KR:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
@page { size:A4; margin:14mm 15mm 16mm; }
*{box-sizing:border-box} html,body{margin:0;padding:0}
body{font-family:"Noto Serif CJK KR","Noto Serif KR","Batang",serif;color:#171717;background:#fff;font-size:10.2pt;line-height:1.82;word-break:keep-all;overflow-wrap:anywhere}
.cover{min-height:255mm;display:flex;flex-direction:column;justify-content:center;padding:20mm 14mm;background:#111;color:#fff;page-break-after:always}
.brand{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;color:#e9d78b;font-size:11pt;font-weight:900;letter-spacing:.14em;margin-bottom:28mm}.cover h1{font-size:31pt;line-height:1.23;margin:0 0 7mm;letter-spacing:-.04em}.cover .sub{font-size:12.5pt;color:#e8e8e8}.coverInfo{margin-top:22mm;border:1px solid #555;padding:7mm;border-radius:4mm;color:#efefef}.coverInfo b{color:#e9d78b}.coverMeta{margin-top:auto;color:#bdbdbd;font-size:8.5pt}
.prologue,.questionPage{page-break-after:always;padding:6mm 2mm 0}.eyebrow{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;font-size:7.8pt;font-weight:900;color:#8d6a10;letter-spacing:.22em;margin-bottom:2mm}.pageTitle{font-size:12pt;font-weight:800;margin:0 0 3mm}.prologue h1{font-size:14.2pt;line-height:1.58;letter-spacing:-.02em;margin:0 0 4.5mm;font-weight:700}.questionPage h1{font-size:17pt;line-height:1.42;letter-spacing:-.03em;margin:0 0 6mm}.prologue p,.questionPage p{font-size:9.4pt;line-height:1.86;margin:0 0 3mm}.questionCard{margin:6mm 0 4mm;padding:5mm 6mm;background:#fbf4d6;border:1px solid #dccb8e;border-radius:3mm;font-size:10.5pt;font-weight:800;line-height:1.65}
.toc{page-break-after:always;padding-top:4mm}.toc h1{font-size:25pt;margin:0 0 7mm}.tocDesc{color:#716b60;margin-bottom:7mm}.tocPart{margin:0 0 5mm;break-inside:avoid}.tocPartTitle{padding:3mm 4mm;background:#fbf4d6;border-left:1.4mm solid #d0ad39;font-weight:900;font-size:11pt}.tocGrid{display:grid;grid-template-columns:1fr 1fr;gap:0 5mm}.tocRow{display:grid;grid-template-columns:10mm 1fr;padding:1.5mm 1mm;border-bottom:.2mm solid #eee8dc;text-decoration:none;color:#222;font-size:8.5pt}.tocRow span{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;color:#8d6a10;font-weight:900}.tocRow b{font-weight:600}
.chapterCover{height:252mm;margin:0;padding:48mm 17mm 22mm;background:#f4e5a5;color:#111;break-before:page;page-break-before:always;break-after:page;page-break-after:always;overflow:hidden}.chapterEyebrow{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;font-size:9pt;font-weight:900;letter-spacing:.18em;margin-bottom:9mm}.chapterCover h1{font-size:24pt;line-height:1.34;margin:0 0 8mm;letter-spacing:-.035em}.chapterCover p{font-size:10.5pt;line-height:1.8;color:#5e584b;max-width:145mm}
.chapterMessage{padding:8mm 2mm 7mm;background:#fbf4d6;margin:0 0 7mm;break-inside:avoid}.chapterMessage h2{font-size:15.5pt;line-height:1.48;margin:0 0 4mm}.chapterMessage p{font-size:9.7pt;line-height:1.82;color:#4d4942;margin:0}
.chapterBody{margin:0}.section{margin:0 0 7mm;padding:0 0 5mm;border-bottom:.25mm solid #e3dccf;break-inside:auto;page-break-inside:auto}.sectionNo{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;font-size:7.8pt;color:#8d6a10;font-weight:900;letter-spacing:.12em;margin:0 0 1.8mm}.section h2{font-size:14pt;line-height:1.42;letter-spacing:-.03em;margin:0 0 3.5mm;break-after:avoid;page-break-after:avoid}.content{font-size:9.6pt;line-height:1.82}.content p{margin:0 0 3.2mm}.content p.lead{font-size:10.2pt;line-height:1.78;font-weight:600;margin:0 0 4mm}.content .subhead{font-size:10.6pt;font-weight:800;margin:5mm 0 2mm;break-after:avoid}.content .emph{margin:4mm 0;padding:4mm 5mm;background:#fff7cf;border:1px solid #e4d28c;border-radius:3mm;font-weight:700;line-height:1.72;break-inside:avoid}.content h3{font-size:10.8pt;margin:5mm 0 2mm}.content ul{margin:2mm 0 4mm 4mm;padding-left:4mm}.content ul.check{list-style:none;margin-left:0;padding-left:0}.content ul.check li{position:relative;padding-left:5mm}.content ul.check li:before{content:"✓";position:absolute;left:0;color:#9a7617;font-weight:900}.supplementCheck{list-style:none;margin:4mm 0 5mm;padding:4mm 5mm;background:#fffaf0;border:1px solid #eadca9;border-radius:3mm;break-inside:avoid}.supplementCheck li{position:relative;padding-left:5mm;margin-bottom:1.5mm}.supplementCheck li:before{content:"✓";position:absolute;left:0;color:#9a7617;font-weight:900}.content li{margin:0 0 1.4mm}.content blockquote{margin:4mm 0;padding:4mm 5mm;background:#faf7ee;border-left:1.2mm solid #d4bd6a}.content table{width:100%;border-collapse:separate;border-spacing:0;margin:4mm 0 5mm;font-size:8.7pt;line-height:1.55;break-inside:avoid;overflow:hidden;border:1px solid #ddd3bd;border-radius:2.5mm}.content thead{display:table-header-group}.content tr{break-inside:avoid}.content th,.content td{padding:2.2mm 2.6mm;border-right:.2mm solid #e4ddcf;border-bottom:.2mm solid #e4ddcf;text-align:left;vertical-align:top}.content th:last-child,.content td:last-child{border-right:0}.content tr:last-child td{border-bottom:0}.content th{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;background:#5a4309;color:#fff;font-weight:800}.content tbody tr:nth-child(even) td{background:#fffdf7}.emphasis{margin:5mm 0;padding:5mm 6mm;background:#fbf4d6;border:1px solid #dfcf98;border-radius:3mm;font-weight:800;line-height:1.7;break-inside:avoid}.dataTableWrap{margin:5mm 0;break-inside:avoid}.dataTable{width:100%;border-collapse:collapse;font-size:9pt}.dataTable th,.dataTable td{border:.25mm solid #ded7c8;padding:2.7mm 3mm;text-align:left;vertical-align:top}.dataTable th{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;width:32%;background:#f4e5a5;font-weight:800}.dataTable td{background:#fffdf8}.miniBlock{margin:5mm 0;padding:4.5mm 5mm;background:#faf8f2;border-radius:3mm;break-inside:avoid}.miniTitle{font-weight:900;margin-bottom:2mm}.miniBlock ul{margin:0;padding-left:5mm}.miniBlock li{margin:0 0 1.5mm}.twoCol{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:5mm 0;break-inside:avoid}.sideBox{padding:4.5mm;background:#f8f5ed;border:1px solid #e2dbcc;border-radius:3mm}.sideBox.action{background:#fbf4d6;border-color:#dfcf98}.sideBox span{display:block;font-size:8.2pt;color:#756d5d;font-weight:900;margin-bottom:2mm}.sideBox p{margin:0;font-size:9.4pt;line-height:1.65}.basis{display:flex;gap:2mm;flex-wrap:wrap;margin-top:5mm;padding-top:3mm;border-top:.2mm solid #e7e0d4;font-size:7.8pt;color:#746d61}.basis b{margin-right:1mm}.basis span{padding:1mm 2mm;background:#f5f1e7;border-radius:99px}.layout-timeline .emphasis,.layout-strategy .emphasis{font-size:10.5pt}.footerNote{margin-top:8mm;padding-top:4mm;border-top:.25mm solid #ddd5c7;color:#8a8377;font-size:8pt}
</style>
</head>
<body>
<section class="cover">
  <div class="brand">나의사주 · PERSONAL REPORT</div>
  <h1>${esc(title)}</h1>
  <div class="sub">${esc(subtitle || "원국 구조부터 현재 흐름과 실행 전략까지 연결한 개인맞춤 종합 인생 리포트")}</div>
  <div class="coverInfo"><b>REPORT FOR</b><br>${birthLine ? esc(birthLine) : "개인 맞춤 분석"}${question ? `<br><br><b>CURRENT QUESTION</b><br>${esc(question)}` : ""}</div>
  <div class="coverMeta">${generatedAt ? `생성일 ${esc(generatedAt)} · ` : ""}REPORT ENGINE ${esc(REPORT_VERSION)}</div>
</section>
<section class="prologue"><div class="eyebrow">PROLOGUE</div><div class="pageTitle">프롤로그</div><h1>${esc(prologueTitle)}</h1><p>${esc(prologueBody)}</p><p>좋은 시기를 기다리는 데서 끝나지 않고, 그 흐름이 실제 선택과 결과로 남도록 무엇을 준비해야 하는지까지 이어서 봅니다.</p></section>
<section class="questionPage"><div class="eyebrow">CURRENT LIFE QUESTION</div><h1>현재 고민 요약</h1><div class="questionCard">${esc(question || "지금의 인생 흐름과 앞으로의 방향이 궁금합니다.")}</div><p>${esc(narrative?.current_question_thesis || "이 질문은 마지막 챕터에서 현재 대운과 세운, 실제 실행 기준을 연결해 다시 직접 답합니다.")}</p></section>
<section class="toc"><div class="eyebrow">CONTENTS</div><h1>목차</h1><div class="tocDesc">3개 CHAPTER · 50개 SECTION으로 원국의 구조부터 현재 질문의 답까지 순서대로 이어집니다.</div>${buildToc(sections)}</section>
${chapterBlocks(sections, narrative)}
<div class="footerNote">본 리포트는 전통 명리학적 해석을 바탕으로 한 자기이해 참고 자료입니다. 건강·투자·법률·세무 등 중요한 결정은 실제 상황과 관련 전문가의 검토를 함께 고려하시기 바랍니다.</div>
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
