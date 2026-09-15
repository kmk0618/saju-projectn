import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { REPORT_VERSION } from "@/lib/report-spec";

export const PDF_RENDERER_VERSION = "aqua50-editorial-v7-couple-midlayer";

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

type ChapterMeta = { part_no:number; part_title:string; subtitle:string };

const CATEGORY_CHAPTER_SUBTITLES: Record<string, Record<number,string>> = {
  life: {
    1: "삶의 흐름을 구조적으로 읽고, 뒤의 모든 해석이 어디에서 출발하는지 기준점을 세웁니다.",
    2: "결과가 들어오는 길과 빠져나가는 구멍을 실제 생활 수준에서 확인합니다.",
    3: "좋은 시기를 기다리기보다, 좋은 시기가 왔을 때 받을 준비를 만듭니다.",
  },
  child: {
    1: "아이의 원국을 부모가 이해할 수 있는 생활 언어로 바꾸어, 뒤의 모든 양육 해석이 어디에서 출발하는지 살펴봅니다.",
    2: "감정·학습·자존감·관계·표현과 규칙 반응을 아이를 규정하지 않는 언어로 읽습니다.",
    3: "아이를 바꾸는 대신 부모가 오늘 바꿀 수 있는 말과 환경, 학습과 성장 루틴으로 연결합니다.",
  },
  couple: {
    1: "두 사람을 각각 이해한 뒤, 서로에게 끌리는 지점과 가까이서 부딪히는 지점을 관계의 뼈대로 읽습니다.",
    2: "소통·감정·돈·가정·일·친밀감에서 반복되는 상호작용을 실제 부부 생활 장면으로 풀어냅니다.",
    3: "갈등을 이기는 법이 아니라 함께 회복하는 법, 역할 분담, 시기와 대화 습관을 구체적인 실행 전략으로 연결합니다.",
  },
};

function reportChapters(sections: SectionRow[], reportCategory = "life"): ChapterMeta[] {
  const by = new Map<number,string>();
  for (const s of sections) {
    const no = Number(s.part_no || 0);
    if (!no) continue;
    if (!by.has(no)) by.set(no, String(s.part_title || `CHAPTER ${no}`));
  }
  const subtitles = CATEGORY_CHAPTER_SUBTITLES[reportCategory] || CATEGORY_CHAPTER_SUBTITLES.life;
  return [...by.entries()].sort((a,b)=>a[0]-b[0]).map(([part_no,part_title]) => ({ part_no, part_title, subtitle: subtitles?.[part_no] || "" }));
}

function chapterBlocks(sections: SectionRow[], narrative: any, chapters: ChapterMeta[], reportCategory = "life") {
  return chapters.map((chapter) => {
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
        <p>${esc(reportCategory === "child" ? "겉으로 보이는 행동만 보지 않고, 아이가 어떤 자극에서 힘을 쓰고 어디에서 회복이 필요한지 살펴봅니다. 부모가 바로 적용할 수 있는 말과 환경까지 함께 정리합니다." : reportCategory === "couple" ? "누가 맞고 틀린지를 가리기보다, 같은 차이가 언제 매력이 되고 언제 갈등이 되는지 실제 생활 장면과 대화 방식으로 이어서 살펴봅니다." : "사주 구조를 필요한 곳에서만 사용해, 같은 용어를 반복하지 않고 실제 생활과 선택의 언어로 이어갑니다.")}</p>
      </section>
      <section class="chapterBody">
        ${rows.map((s) => `
          <article class="section layout-${esc(s.content_json?.layout_type || "prose")}" id="section-${s.section_no}">
            <div class="sectionNo">SECTION ${String(s.section_no).padStart(2, "0")}</div>
            <h2>${esc(s.section_title)}</h2>
            ${s.content_json?.subtitle ? `<div class="sectionSubtitle">${esc(s.content_json.subtitle)}</div>` : ""}
            <div class="content">${cleanContentHtml(s.content_html)}</div>
            ${editorialSupplement(s)}
          </article>
        `).join("")}
      </section>`;
  }).join("");
}

function buildToc(sections: SectionRow[], chapters: ChapterMeta[]) {
  return chapters.map((ch) => {
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
  reportCategory?: string;
}) {
  const { title, subtitle, question, generatedAt, sections, input, narrative, reportCategory = "life" } = args;
  const chapters = reportChapters(sections, reportCategory);
  const formatBirthLine = (v:any) => v ? [
    (v.year || v.y) && (v.month || v.m) && (v.day || v.d) ? `${v.year || v.y}.${String(v.month || v.m).padStart(2,"0")}.${String(v.day || v.d).padStart(2,"0")} ${(v.calendar_type || v.calendar) === "solar" ? "양력" : "음력"}` : "",
    v.gender === "남" || v.gender === "male" ? "남성" : v.gender === "여" || v.gender === "female" ? "여성" : "",
    v.region_name || "",
    v.time_unknown || v.unknown_time ? "출생시간 미상" : (v.hour ?? v.h) != null && String(v.hour ?? v.h) !== "" ? `${String(v.hour ?? v.h).padStart(2,"0")}:${String(v.minute ?? v.mi ?? 0).padStart(2,"0")}` : "",
  ].filter(Boolean).join(" · ") : "";
  const birthLine = formatBirthLine(input);
  const partnerBirthLine = formatBirthLine(input?.partner_input);

  const isChild = reportCategory === "child";
  const isCouple = reportCategory === "couple";
  const prologueTitle = narrative?.core_thesis || (isChild ? "아이를 이해하는 언어부터 바꿉니다" : isCouple ? "두 사람이 다른 이유를 알면, 싸움의 의미도 달라집니다" : "타고난 구조를 이해하면, 지금의 선택이 훨씬 선명해집니다");
  const prologueBody = narrative?.current_question_thesis || (isChild ? "이 리포트는 아이를 한 문장으로 규정하지 않습니다. 아이가 어떤 자극을 세밀하게 느끼고, 어떤 조건에서 회복하며, 표현과 학습이 어떻게 살아나는지를 살펴보고 부모가 오늘 할 수 있는 행동으로 연결합니다." : isCouple ? "이 리포트는 두 사람 중 누가 더 맞는 사람인지 판정하지 않습니다. 서로에게 왜 끌리는지, 같은 차이가 언제 갈등이 되는지, 그 갈등이 어떤 순서로 커지고 어떤 말과 행동으로 다시 회복되는지를 두 사람의 실제 구조와 생활 장면을 연결해 살펴봅니다." : "이 리포트는 사주 원국을 먼저 구조적으로 읽고, 그 구조가 일·돈·관계·현재 흐름에서 어떻게 나타나는지 연결한 뒤 마지막에 지금의 질문에 직접 답합니다.");

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
.chapterBody{margin:0}.section{margin:0 0 7mm;padding:0 0 5mm;border-bottom:.25mm solid #e3dccf;break-inside:auto;page-break-inside:auto}.sectionNo{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;font-size:7.8pt;color:#8d6a10;font-weight:900;letter-spacing:.12em;margin:0 0 1.8mm}.section h2{font-size:14pt;line-height:1.42;letter-spacing:-.03em;margin:0 0 3.5mm;break-after:avoid;page-break-after:avoid}.sectionSubtitle{margin:-1mm 0 4mm;padding:2.5mm 3.2mm;background:#fbf4d6;border-left:1mm solid #d0ad39;border-radius:1.8mm;font-size:9.6pt;font-weight:700;line-height:1.65;color:#5f542f;break-inside:avoid}.content{font-size:9.6pt;line-height:1.82}.content p{margin:0 0 3.2mm}.content p.lead{font-size:10.2pt;line-height:1.78;font-weight:600;margin:0 0 4mm}.content .subtitle{font-size:9.8pt;font-weight:700;color:#75631b;margin:0 0 4mm}.content .subhead{font-size:10.6pt;font-weight:800;margin:5mm 0 2mm;break-after:avoid}.content .emph{margin:4mm 0;padding:4mm 5mm;background:#fff7cf;border:1px solid #e4d28c;border-radius:3mm;font-weight:700;line-height:1.72;break-inside:avoid}.content h3{font-size:10.8pt;margin:5mm 0 2mm}.content ul{margin:2mm 0 4mm 4mm;padding-left:4mm}.content ul.check{list-style:none;margin-left:0;padding-left:0}.content ul.check li{position:relative;padding-left:5mm}.content ul.check li:before{content:"✓";position:absolute;left:0;color:#9a7617;font-weight:900}.supplementCheck{list-style:none;margin:4mm 0 5mm;padding:4mm 5mm;background:#fffaf0;border:1px solid #eadca9;border-radius:3mm;break-inside:avoid}.supplementCheck li{position:relative;padding-left:5mm;margin-bottom:1.5mm}.supplementCheck li:before{content:"✓";position:absolute;left:0;color:#9a7617;font-weight:900}.content li{margin:0 0 1.4mm}.content blockquote{margin:4mm 0;padding:4mm 5mm;background:#faf7ee;border-left:1.2mm solid #d4bd6a}.content table{width:100%;border-collapse:separate;border-spacing:0;margin:4mm 0 5mm;font-size:8.7pt;line-height:1.55;break-inside:avoid;overflow:hidden;border:1px solid #ddd3bd;border-radius:2.5mm}.content thead{display:table-header-group}.content tr{break-inside:avoid}.content th,.content td{padding:2.2mm 2.6mm;border-right:.2mm solid #e4ddcf;border-bottom:.2mm solid #e4ddcf;text-align:left;vertical-align:top}.content th:last-child,.content td:last-child{border-right:0}.content tr:last-child td{border-bottom:0}.content th{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;background:#5a4309;color:#fff;font-weight:800}.content tbody tr:nth-child(even) td{background:#fffdf7}.emphasis{margin:5mm 0;padding:5mm 6mm;background:#fbf4d6;border:1px solid #dfcf98;border-radius:3mm;font-weight:800;line-height:1.7;break-inside:avoid}.dataTableWrap{margin:5mm 0;break-inside:avoid}.dataTable{width:100%;border-collapse:collapse;font-size:9pt}.dataTable th,.dataTable td{border:.25mm solid #ded7c8;padding:2.7mm 3mm;text-align:left;vertical-align:top}.dataTable th{font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;width:32%;background:#f4e5a5;font-weight:800}.dataTable td{background:#fffdf8}.miniBlock{margin:5mm 0;padding:4.5mm 5mm;background:#faf8f2;border-radius:3mm;break-inside:avoid}.miniTitle{font-weight:900;margin-bottom:2mm}.miniBlock ul{margin:0;padding-left:5mm}.miniBlock li{margin:0 0 1.5mm}.twoCol{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:5mm 0;break-inside:avoid}.sideBox{padding:4.5mm;background:#f8f5ed;border:1px solid #e2dbcc;border-radius:3mm}.sideBox.action{background:#fbf4d6;border-color:#dfcf98}.sideBox span{display:block;font-size:8.2pt;color:#756d5d;font-weight:900;margin-bottom:2mm}.sideBox p{margin:0;font-size:9.4pt;line-height:1.65}.basis{display:flex;gap:2mm;flex-wrap:wrap;margin-top:5mm;padding-top:3mm;border-top:.2mm solid #e7e0d4;font-size:7.8pt;color:#746d61}.basis b{margin-right:1mm}.basis span{padding:1mm 2mm;background:#f5f1e7;border-radius:99px}.layout-timeline .emphasis,.layout-strategy .emphasis{font-size:10.5pt}.footerNote{margin-top:8mm;padding-top:4mm;border-top:.25mm solid #ddd5c7;color:#8a8377;font-size:8pt}
</style>
</head>
<body>
<section class="cover">
  <div class="brand">나의사주 · PERSONAL REPORT</div>
  <h1>${esc(title)}</h1>
  <div class="sub">${esc(subtitle || "원국 구조부터 현재 흐름과 실행 전략까지 연결한 개인맞춤 종합 인생 리포트")}</div>
  <div class="coverInfo"><b>REPORT FOR</b><br>${isCouple ? `${birthLine ? `A · ${esc(birthLine)}` : "A · 첫 번째 사람"}${partnerBirthLine ? `<br>B · ${esc(partnerBirthLine)}` : "<br>B · 두 번째 사람"}` : (birthLine ? esc(birthLine) : "개인 맞춤 분석")}${question ? `<br><br><b>CURRENT QUESTION</b><br>${esc(question)}` : ""}</div>
  <div class="coverMeta">${generatedAt ? `생성일 ${esc(generatedAt)} · ` : ""}나의사주 PERSONAL REPORT</div>
</section>
<section class="prologue"><div class="eyebrow">PROLOGUE</div><div class="pageTitle">프롤로그</div><h1>${esc(prologueTitle)}</h1><p>${esc(prologueBody)}</p><p>${esc(isChild ? "아이를 한 문장으로 규정하지 않고, 실제 생활에서 부모가 관찰하고 바꿀 수 있는 말·환경·루틴으로 이어서 봅니다." : isCouple ? "관계의 차이를 결함으로 고치는 대신, 서로 다른 방식이 한 팀의 역할이 되도록 실제 대화와 생활 규칙까지 이어서 봅니다." : "좋은 시기를 기다리는 데서 끝나지 않고, 그 흐름이 실제 선택과 결과로 남도록 무엇을 준비해야 하는지까지 이어서 봅니다.")}</p></section>
<section class="questionPage"><div class="eyebrow">${isChild ? "PARENT QUESTION" : isCouple ? "COUPLE QUESTION" : "CURRENT LIFE QUESTION"}</div><h1>${isChild ? "부모의 질문" : isCouple ? "두 사람의 질문" : "현재 고민 요약"}</h1><div class="questionCard">${esc(question || (isChild ? "우리 아이를 어떻게 이해하고 키워야 할까요?" : isCouple ? "우리는 왜 끌리고 왜 부딪히며, 어떻게 하면 오래 잘 지낼 수 있을까요?" : "지금의 인생 흐름과 앞으로의 방향이 궁금합니다."))}</div><p>${esc(narrative?.current_question_thesis || (isChild ? "이 질문은 마지막 챕터에서 아이의 기질·회복·표현·학습 구조를 부모의 실제 행동과 연결해 직접 답합니다." : isCouple ? "이 질문은 마지막 챕터에서 두 사람의 반복 갈등, 사랑의 번역 방식, 현재 흐름과 실제 관계 규칙을 연결해 직접 답합니다." : "이 질문은 마지막 챕터에서 현재 대운과 세운, 실제 실행 기준을 연결해 다시 직접 답합니다."))}</p></section>
<section class="toc"><div class="eyebrow">CONTENTS</div><h1>목차</h1><div class="tocDesc">${isChild ? "3개 CHAPTER · 50개 SECTION으로 아이의 사주 구조부터 실제 양육 전략까지 이어집니다." : isCouple ? "3개 CHAPTER · 50개 SECTION으로 두 사람의 구조, 반복되는 관계 패턴, 실제 대화와 장기 관계 전략까지 이어집니다." : "3개 CHAPTER · 50개 SECTION으로 원국의 구조부터 현재 질문의 답까지 순서대로 이어집니다."}</div>${buildToc(sections, chapters)}</section>
${chapterBlocks(sections, narrative, chapters, reportCategory)}
<div class="footerNote">${esc(isChild ? "본 리포트는 전통 명리학적 해석을 바탕으로 한 부모용 참고 자료입니다. 아이를 규정하거나 진단하기 위한 자료가 아니며, 실제 발달·교육·건강과 관련된 중요한 판단은 아이의 현재 상태와 관련 전문가의 검토를 함께 고려하시기 바랍니다." : isCouple ? "본 리포트는 전통 명리학적 해석을 바탕으로 두 사람의 관계를 이해하기 위한 참고 자료입니다. 관계의 중요한 결정은 실제 대화와 생활 조건을 함께 고려하시고, 갈등이나 어려움이 깊다면 관계·심리 전문 상담의 도움을 함께 검토하시기 바랍니다." : "본 리포트는 전통 명리학적 해석을 바탕으로 한 자기이해 참고 자료입니다. 건강·투자·법률·세무 등 중요한 결정은 실제 상황과 관련 전문가의 검토를 함께 고려하시기 바랍니다.")}</div>
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
