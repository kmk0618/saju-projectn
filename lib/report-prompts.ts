import type { ReportSectionSpec } from "@/lib/report-spec";

export function buildPersonNarrativePrompt(calc: any, question: string, category: string) {
  return `
당신은 유료 개인 명리 리포트의 편집장입니다.
계산은 절대 하지 말고 제공된 deterministic 계산값만 사실로 사용하세요.

50개 섹션을 쓰기 전에 이 사람의 전체 서사를 먼저 고정합니다.

반드시 다음 JSON 구조로만 답하세요.
{
  "core_thesis":"...",
  "life_tensions":["..."],
  "strengths":["..."],
  "risks":["..."],
  "leverage_points":["..."],
  "chapter_theses":{"1":"...","2":"...","3":"..."},
  "current_question_thesis":"..."
}

규칙:
- 다른 사람에게 이름만 바꿔 붙여도 되는 문장 금지.
- 일간·오행·대운을 나열하지 말고 실제 삶의 반복 패턴으로 번역.
- 강점과 그림자를 동시에 잡되 같은 표현 반복 금지.
- 질문은 마지막 챕터에서 직접 회수할 수 있도록 핵심을 잡기.
- 건강·투자 관련 내용은 단정하지 말기.

[고정 계산값]
${JSON.stringify(calc)}

[질문 분야]
${category || "미지정"}

[사용자 질문]
${question || "별도 질문 없음"}
`.trim();
}

export function buildSectionPrompt(args: {
  specs: ReportSectionSpec[];
  calcSubset: any;
  narrative: any;
  question: string;
  category: string;
  recent: Array<{ section_no: number; opening_sentence?: string; key_basis?: string[]; action_point?: string }>;
}) {
  const requested = args.specs.map((s) => ({
    section_no: s.section_no,
    chapter: s.part_no,
    title: s.section_title,
    purpose: s.purpose,
    depth: s.depth,
    layout_type: s.layout_type,
    target_chars: s.target_chars,
    evidence_allowed: s.evidence,
  }));

  return `
아래 섹션들만 작성하세요. 계산은 절대 하지 않습니다.
제공된 deterministic 사실과 PERSON NARRATIVE만 사용합니다.

[AQUA 편집 원칙]
- 결론부터 주고 그 다음 근거를 설명합니다.
- 한 섹션이 짧은 답변 카드처럼 끝나면 안 됩니다.
- 필요한 경우 여러 생활장면, 장점과 리스크, 실제 적용, 실행기준을 충분히 전개합니다.
- 모든 섹션을 똑같은 소제목 순서로 쓰지 마세요.
- 표가 맞는 섹션은 표에 들어갈 구조 데이터를 table_rows로 반환하고, 전략은 checklist를 활용합니다.
- "이 구조를 현실에서 어떻게 써야 할까", "김민경 님은 기본적으로", "일간은", "현재 대운은" 같은 상투 도입을 반복하지 마세요.
- 섹션마다 허용된 근거 중 실제 필요한 1~4개만 사용하세요.
- 실제 명식 근거 없는 일반론 금지.
- calc 내부 필드명이나 개발 용어를 고객에게 노출하지 마세요.
- 한자 명리용어는 처음 한 번만 쉬운 한국어 설명을 붙이세요.
- 미래를 확정적으로 예언하지 말고 경향·기회·주의·행동기준으로 표현하세요.
- 건강은 생활 참고 수준, 투자는 실제 재무 검토 우선임을 지키세요.

[PERSON NARRATIVE]
${JSON.stringify(args.narrative)}

[이 섹션들에 허용된 계산 subset]
${JSON.stringify(args.calcSubset)}

[사용자 질문]
분야: ${args.category || "미지정"}
질문: ${args.question || "별도 질문 없음"}

[최근 생성 섹션 - 반복 회피용]
${JSON.stringify(args.recent)}

[이번 요청]
${JSON.stringify(requested)}

반드시 각 section_no를 정확히 한 번씩 반환하세요.
content_html에는 <p>, <p class="lead">, <strong>, <h3>, <div class="subhead">, <div class="emph">, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <ul>, <ul class="check">, <li>, <blockquote>를 사용할 수 있습니다. layout_type이 table이면 실제 <table>을 본문에 반드시 넣고, checklist이면 실제 <ul class="check">를 넣으세요. strategy/timeline/comparison은 내용상 필요한 경우 표나 체크리스트를 사용하세요. prose에는 억지 표를 만들지 마세요.
본문 분량은 각 섹션 target_chars의 최소값 이상을 우선 맞추되 같은 말 반복으로 채우지 마세요.

각 섹션은 아래 필드를 모두 반환합니다.
- section_no
- opening_sentence: 첫 문장
- content_html: 충분히 깊은 본문
- key_basis: 실제 사용한 명식 근거 배열
- life_scenes: 구체적인 생활 장면 2~4개
- risk: 이 구조가 그림자로 작동할 때
- action_point: 이 섹션에서 가장 구체적인 실행 기준
- emphasis: 강조박스에 넣을 한 문장
- layout_type: 요청된 layout_type 유지
- checklist: 필요한 경우 3~7개, 아니면 []
- table_rows: 필요한 경우 [{"label":"...","value":"..."}], 아니면 []

편집 레이아웃 강제 규칙:
- SECTION 01 기본 인적 정보: 입력값/계산 기준을 실제 HTML 표로 보여주세요.
- SECTION 02 사주 원국 전체표: 년주·월주·일주·시주, 천간/지지/십성/지장간 등 전달된 근거를 실제 HTML 표로 보여주세요.
- SECTION 04 오행 분포, SECTION 16 십성 분포, SECTION 22·23·27 등 layout_type=table 섹션은 표가 핵심 시각자료이므로 실제 <table>을 반드시 포함하세요.
- 같은 표/체크리스트 틀을 모든 섹션에 반복하지 마세요. layout_type 계약에 맞는 섹션에서만 사용하세요.
`.trim();
}

export function buildRewritePrompt(args: {
  spec: ReportSectionSpec;
  calcSubset: any;
  narrative: any;
  question: string;
  previousCandidate: any;
  issues: string[];
  recent: any[];
}) {
  return `
아래 섹션은 품질검사를 통과하지 못했습니다. 사실값은 바꾸지 말고 전면 재작성하세요.

[실패 이유]
${args.issues.join(", ")}

[섹션]
${JSON.stringify(args.spec)}

[허용 계산 근거]
${JSON.stringify(args.calcSubset)}

[PERSON NARRATIVE]
${JSON.stringify(args.narrative)}

[사용자 질문]
${args.question || "별도 질문 없음"}

[이전 실패 초안]
${JSON.stringify(args.previousCandidate)}

[최근 섹션]
${JSON.stringify(args.recent)}

재작성 규칙:
- 첫 문장, 생활 장면, 근거 조합, 문단 순서를 이전 초안과 다르게 만드세요.
- target_chars 최소 분량 이상.
- 동일한 조언과 상투문구 금지.
- 실제 명식 근거 최소 1개 이상.
- content_html에는 <p>, <p class="lead">, <strong>, <h3>, <div class="subhead">, <div class="emph">, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <ul>, <ul class="check">, <li>, <blockquote>를 사용할 수 있습니다. layout_type이 table이면 실제 표를 반드시 포함하세요. checklist이면 실제 체크리스트를 반드시 포함하세요. prose에는 억지 표를 넣지 마세요.
- JSON 필드는 section_no, opening_sentence, content_html, key_basis, life_scenes, risk, action_point, emphasis, layout_type, checklist, table_rows를 모두 반환.
`.trim();
}
