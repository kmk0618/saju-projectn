export type ReportLayoutType =
  | "prose"
  | "prose_callout"
  | "table"
  | "comparison"
  | "timeline"
  | "checklist"
  | "strategy"
  | "qa"
  | "mixed";

export type ReportDepth = "normal" | "deep" | "critical";

export type ReportSectionSpec = {
  section_no: number;
  part_no: number;
  part_title: string;
  section_title: string;
  purpose: string;
  evidence: string[];
  depth: ReportDepth;
  layout_type: ReportLayoutType;
  target_chars: [number, number];
};

export const REPORT_VERSION = "life-report-aqua-50-v1";

export const REPORT_CHAPTERS = [
  {
    part_no: 1,
    part_title: "나의 인생 그릇과 사주 구조",
    subtitle: "삶의 흐름을 구조적으로 읽고, 뒤의 모든 해석이 어디에서 출발하는지 기준점을 세웁니다.",
  },
  {
    part_no: 2,
    part_title: "삶이 풀리는 방식과 새는 패턴",
    subtitle: "결과가 들어오는 길과 빠져나가는 구멍을 실제 생활 수준에서 확인합니다.",
  },
  {
    part_no: 3,
    part_title: "현재 인생 흐름과 실행 전략",
    subtitle: "좋은 시기를 기다리기보다, 좋은 시기가 왔을 때 받을 준비를 만듭니다.",
  },
] as const;

const normal: [number, number] = [1200, 1900];
const deep: [number, number] = [1900, 3000];
const critical: [number, number] = [2600, 4200];

const S = (
  section_no: number,
  part_no: number,
  section_title: string,
  purpose: string,
  evidence: string[],
  depth: ReportDepth = "normal",
  layout_type: ReportLayoutType = "prose",
): ReportSectionSpec => ({
  section_no,
  part_no,
  part_title: REPORT_CHAPTERS[part_no - 1].part_title,
  section_title,
  purpose,
  evidence,
  depth,
  layout_type,
  target_chars: depth === "critical" ? critical : depth === "deep" ? deep : normal,
});

export const REPORT_OUTLINE: ReportSectionSpec[] = [
  S(1,1,"기본 인적 정보","고객이 입력한 출생 정보와 이번 해석의 계산 기준을 정확히 보여준다.",["identity","birth_solar","pillars","day_master","current_daeun","annual_flow"],"normal","table"),
  S(2,1,"사주 원국 전체표","년·월·일·시 네 기둥과 숨은 기운을 한눈에 정리하고 전체 명식의 첫 결론을 제시한다.",["pillars","hidden_stems","ten_gods","relations"],"critical","table"),
  S(3,1,"음양 구조 - 삶을 대하는 속도와 온도","생각과 행동의 속도, 신중함과 실행의 균형을 생활 언어로 해석한다.",["pillars","day_master","strength"],"normal","comparison"),
  S(4,1,"오행 분포 - 내 삶을 움직이는 다섯 가지 힘","오행 분포를 책임·배움·현실성·표현·돈의 다섯 힘으로 번역한다.",["five_elements","strongest","weakest","lacking","hidden_stems"],"critical","table"),
  S(5,1,"천간 구조 - 겉으로 드러나는 판단","겉으로 드러나는 판단 기준, 책임감, 공개된 사회적 태도를 분석한다.",["pillars","ten_gods","day_master"],"deep","prose_callout"),
  S(6,1,"지지 구조 - 생활 속 반복되는 습관","생활 속 반복 습관, 역할 분배, 관계의 실제 장면을 본다.",["pillars","relations","hidden_stems"],"deep","prose"),
  S(7,1,"지장간 구조 - 숨어 있는 가능성","겉으로 보이지 않는 잠재 능력과 뒤늦게 살아나는 기능을 분석한다.",["hidden_stems","ten_gods","day_master"],"deep","mixed"),
  S(8,1,"일간 분석 - 삶을 대하는 중심 기질","일간의 중심 기질을 고정관념이 아닌 실제 선택과 일하는 방식으로 번역한다.",["day_master","strength","five_elements"],"deep","prose_callout"),
  S(9,1,"일지 분석 - 생활 습관과 기반","감정과 생활 기반, 가까운 관계에서 반복되는 생활 패턴을 본다.",["pillars","hidden_stems","relations"],"deep","prose"),
  S(10,1,"일주 성향 - 중요한 순간 드러나는 진짜 모습","일간과 일지의 결합이 중요한 선택과 관계에서 어떻게 드러나는지 설명한다.",["pillars","day_master","hidden_stems","relations"],"deep","comparison"),
  S(11,1,"월령·계절 구조 - 세상과 만나는 환경","태어난 계절과 월령이 사회적 압력, 요구 수준, 성장 방식에 주는 영향을 본다.",["pillars","strength","useful_god_candidates"],"deep","prose"),
  S(12,1,"월주와 직업·사회 환경","직업·사회생활에서 반복되는 역할, 평가, 신뢰의 형성 방식을 분석한다.",["pillars","ten_gods","relations"],"deep","mixed"),
  S(13,1,"시주와 장기 인생 방향","후반 인생에 남길 자산과 장기 방향을 본다. 출생시각 미상일 경우 단정하지 않는다.",["pillars","hidden_stems","time_status"],"deep","timeline"),
  S(14,1,"신강·신약 분석 - 버티고 운용하는 힘","신강·신약을 강약 판정으로 끝내지 않고 힘을 안정적으로 운용하는 조건으로 해석한다.",["strength","strength_pct","five_elements","useful_god_candidates"],"critical","comparison"),
  S(15,1,"용신·희신 방향 - 흐름을 살리는 선택","균형을 살리는 선택을 환경·일·관계·생활 운영의 언어로 번역한다.",["useful_god_candidates","five_elements","strength"],"deep","checklist"),
  S(16,1,"십성 분포 - 일·돈·관계·책임의 균형","십성 역할 분포를 실제 일·돈·관계·책임의 배치로 깊게 해석한다.",["ten_gods","hidden_stems","pillars"],"critical","table"),
  S(17,1,"재성 구조 - 돈과 현실을 다루는 방식","재성 구조를 돈·고객·가격·시장·현금흐름을 다루는 방식으로 분석한다.",["ten_gods","hidden_stems","five_elements","current_daeun"],"critical","mixed"),
  S(18,1,"식상생재 구조 - 재능을 결과로 바꾸는 길","표현·콘텐츠·기술·상품이 돈과 현실 성과로 이어지는 연결 고리를 본다.",["ten_gods","hidden_stems","five_elements","current_daeun"],"critical","strategy"),
  S(19,1,"관성·인성의 기반 - 신뢰, 문서, 시스템","책임·신뢰·학습·문서·시스템이 전문성으로 쌓이는 방식을 분석한다.",["ten_gods","pillars","hidden_stems"],"deep","mixed"),
  S(20,1,"합충형파해 구조 - 삶이 흔들리는 방식","변화·충돌·재정리가 어떤 영역에서 동시에 나타나기 쉬운지 순서와 대응 기준을 본다.",["relations","pillars","hidden_stems"],"deep","comparison"),

  S(21,2,"나의 기본 인생 성향","신뢰를 먼저 만들고 결과를 받는 기본 성향을 종합한다.",["chapter1_summary","day_master","ten_gods"],"deep","prose_callout"),
  S(22,2,"기회와 성과가 들어오는 경로","전문성·장기 고객·문서·브랜드 등 실제 기회가 들어오는 경로를 우선순위로 보여준다.",["ten_gods","hidden_stems","current_daeun","chapter1_summary"],"critical","table"),
  S(23,2,"에너지·돈·관계가 새는 경로","과잉 책임·무료 노동·범위 확대 등 성과 누수의 실제 장면과 차단 기준을 보여준다.",["ten_gods","relations","chapter1_summary"],"critical","table"),
  S(24,2,"생활·수입 안정성","반복 고객·정기 구조·고정비를 통해 안정감을 만드는 방식을 본다.",["ten_gods","five_elements","current_daeun"],"deep","prose"),
  S(25,2,"소비 패턴","돈뿐 아니라 시간과 책임까지 비용으로 보는 소비·지출 패턴을 분석한다.",["ten_gods","five_elements"],"normal","comparison"),
  S(26,2,"저축·축적 능력","비상자금, 선택권, 성장 투자를 어떻게 배분하면 맞는지 본다.",["ten_gods","five_elements","strength"],"normal","checklist"),
  S(27,2,"현금흐름 감각","매출보다 실제 남는 돈을 보이게 만드는 숫자와 관리 기준을 제시한다.",["ten_gods","current_daeun","chapter1_summary"],"deep","table"),
  S(28,2,"가격 감각","고객 부담과 자기 책임 범위 사이에서 가격을 정하는 패턴과 개선 기준을 본다.",["ten_gods","relations","chapter1_summary"],"critical","comparison"),
  S(29,2,"사람·고객·시장 감각","상대의 불편과 시장 반응을 읽는 능력, 고객 요구를 상품에 반영하는 기준을 본다.",["ten_gods","relations","current_daeun"],"deep","mixed"),
  S(30,2,"판매·설득 성향","강매가 아닌 진단·설명형 설득 방식과 무료/유료 경계를 분석한다.",["ten_gods","hidden_stems","current_daeun"],"deep","comparison"),
  S(31,2,"콘텐츠·결과물 수익화","한 번 설명한 지식과 경험을 반복 가능한 콘텐츠·문서·디지털 결과물로 만드는 방식을 본다.",["hidden_stems","ten_gods","current_daeun"],"critical","strategy"),
  S(32,2,"사업·자영업 적합성","대표가 해야 할 일과 시스템으로 넘길 일을 구분하고 맞는 사업 운영 방식을 제시한다.",["ten_gods","strength","current_daeun","relations"],"critical","strategy"),
  S(33,2,"직장·조직 적합성","조직에서 강점이 살아나는 권한·책임·평가 구조와 피해야 할 환경을 본다.",["ten_gods","relations","strength"],"deep","comparison"),
  S(34,2,"프리랜서·전문직 적합성","전문성을 패키지와 기준으로 판매하는 방식, 맞춤 과다를 줄이는 방법을 본다.",["ten_gods","hidden_stems","current_daeun"],"deep","strategy"),
  S(35,2,"인생 패턴 종합 요약","CHAPTER 1~2에서 드러난 반복 패턴을 몇 개의 핵심 문장과 전환 기준으로 종합한다.",["chapter1_summary","chapter2_material","current_daeun"],"critical","mixed"),

  S(36,3,"현재 상태 진단","현재가 막힌 시기인지 선택과 구조화가 필요한 시기인지 진단한다.",["current_daeun","annual_flow","question","chapter2_summary"],"critical","prose_callout"),
  S(37,3,"현재 고민의 핵심 질문","사용자가 입력한 질문의 표면과 실제 핵심을 분리해 현재 운과 연결한다.",["question","current_daeun","annual_flow","chapter2_summary"],"deep","qa"),
  S(38,3,"동업·파트너 리스크","동업에서 역할·정산·책임 불균형이 생기기 쉬운 지점과 계약 기준을 본다.",["relations","ten_gods","current_daeun"],"deep","checklist"),
  S(39,3,"투자·대출·부동산 성향","투자·대출·부동산에 대한 성향을 보되 실제 재무 판단과 명리 참고를 명확히 구분한다.",["ten_gods","strength","current_daeun","annual_flow"],"deep","comparison"),
  S(40,3,"온라인 수익·디지털 자산 성향","지식·경험을 디지털 결과물로 반복 활용하는 적합성과 과제를 본다.",["hidden_stems","ten_gods","current_daeun"],"deep","strategy"),
  S(41,3,"인생 흐름이 좋아지는 시기","현재 대운·세운·월운을 바탕으로 흐름이 열리는 구간과 활용법을 구체적으로 제시한다.",["current_daeun","annual_flow","monthly_flow","question"],"critical","timeline"),
  S(42,3,"조심해야 할 시기","좋은 흐름 속에서도 과로·저수익·관계 충돌이 커질 수 있는 시기와 대응법을 제시한다.",["current_daeun","annual_flow","monthly_flow","relations"],"critical","timeline"),
  S(43,3,"흐름을 살리는 생활패턴","생활 리듬·수면·업무 종료·숫자 점검 등 운을 현실에서 살리는 습관을 제안한다.",["strength","five_elements","current_daeun"],"deep","checklist"),
  S(44,3,"흐름을 살리는 위치·환경","일과 휴식 경계, 업무 공간, 이동성과 환경 선택을 사주 구조와 연결한다.",["five_elements","useful_god_candidates","current_daeun"],"normal","mixed"),
  S(45,3,"흐름을 살리는 사람","약속·역할·실행 기준이 맞는 사람과 소모가 큰 사람의 차이를 보여준다.",["relations","ten_gods","current_daeun"],"deep","comparison"),
  S(46,3,"신뢰를 높이는 외적 이미지","프로필·문서·브랜드에서 신뢰를 높이는 일관된 외적 이미지와 메시지를 제안한다.",["ten_gods","current_daeun","chapter2_summary"],"normal","checklist"),
  S(47,3,"성과와 수입을 늘리는 전략","신규 고객보다 다음 단계, 반복 거래, 장기 관리, 디지털 결과물로 수입을 확장하는 전략을 제시한다.",["current_daeun","annual_flow","chapter2_summary","question"],"critical","strategy"),
  S(48,3,"수(水)의 시대 전략","흐름·연결·정보·데이터를 빠르게 순환시키는 방식으로 현재 시대 전략을 현실적으로 번역한다.",["five_elements","ten_gods","current_daeun"],"deep","strategy"),
  S(49,3,"1개월·3개월·1년 실행 전략","1개월·3개월·1년을 나누어 목표·실행·완료기준·숫자 점검을 표와 체크리스트로 제시한다.",["current_daeun","annual_flow","monthly_flow","question","chapter2_summary"],"critical","strategy"),
  S(50,3,"최종 인생 리포트 결론","사용자의 원래 질문을 그대로 다시 보여주고 시기·일·돈·관계·주의점·지금 할 일을 직접 답한다.",["question","current_daeun","annual_flow","monthly_flow","chapter1_summary","chapter2_summary"],"critical","qa"),
];

export const REPORT_TOTAL_SECTIONS = REPORT_OUTLINE.length;

export function sectionSpec(no: number) {
  return REPORT_OUTLINE.find((x) => x.section_no === no) || null;
}
