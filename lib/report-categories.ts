import { REPORT_OUTLINE, REPORT_VERSION, type ReportDepth, type ReportLayoutType, type ReportSectionSpec } from "@/lib/report-spec";

export type ReportCategoryKey = "life" | "child" | "couple" | "parent_child" | "new_year";

export type ReportCategoryConfig = {
  key: ReportCategoryKey;
  slug: string;
  title: string;
  subtitle: string;
  version: string;
  focus: string;
  outline: ReportSectionSpec[];
  requiresSecondProfile?: boolean;
};

const normal: [number, number] = [1200, 1900];
const deep: [number, number] = [1900, 3000];
const critical: [number, number] = [2600, 4200];

const makeOutline = (
  chapters: Record<number, string>,
  rows: Array<[number, number, string, string, string[], ReportDepth?, ReportLayoutType?]>,
): ReportSectionSpec[] => rows.map(([section_no, part_no, section_title, purpose, evidence, depth = "normal", layout_type = "prose"]) => ({
  section_no,
  part_no,
  part_title: chapters[part_no],
  section_title,
  purpose,
  evidence,
  depth,
  layout_type,
  target_chars: depth === "critical" ? critical : depth === "deep" ? deep : normal,
}));

const CHILD_CHAPTERS = {
  1: "우리 아이의 타고난 기질과 사주 구조",
  2: "배우고 관계 맺고 성장하는 방식",
  3: "부모를 위한 시기별 성장 가이드",
};

export const CHILD_REPORT_OUTLINE = makeOutline(CHILD_CHAPTERS, [
  [1,1,"기본 인적 정보","아이의 출생 정보와 해석 기준을 정확히 보여준다.",["identity","birth_solar","pillars","day_master","current_daeun","annual_flow"],"normal","table"],
  [2,1,"사주 원국 전체표","네 기둥과 숨은 기운을 표로 정리하고 아이 기질 해석의 출발점을 세운다.",["pillars","hidden_stems","ten_gods","relations"],"critical","table"],
  [3,1,"음양 구조 - 반응 속도와 표현 방식","낯선 상황에서의 반응 속도, 표현 방식, 행동 전환의 리듬을 본다.",["pillars","day_master","strength"],"deep","comparison"],
  [4,1,"오행 분포 - 아이 안의 다섯 가지 힘","관찰·표현·실행·안정·유연성의 균형을 아이 생활 언어로 번역한다.",["five_elements","strongest","weakest","lacking","hidden_stems"],"critical","table"],
  [5,1,"일간 분석 - 타고난 중심 기질","아이의 기본 기질과 스스로를 지키는 방식을 분석한다.",["day_master","strength","five_elements"],"deep","prose_callout"],
  [6,1,"일지 분석 - 편안함을 느끼는 환경","집과 가까운 관계에서 편안함을 느끼는 조건과 예민해지는 지점을 본다.",["pillars","hidden_stems","relations"],"deep","prose"],
  [7,1,"월령·계절 구조 - 세상에 적응하는 방식","주어진 환경과 요구에 적응하는 방식, 계절 기운이 기질에 주는 영향을 본다.",["pillars","strength","useful_god_candidates"],"deep","prose"],
  [8,1,"신강·신약 - 버티는 힘과 회복 속도","압박과 피로 속에서 버티는 힘, 도움을 받아야 하는 순간을 해석한다.",["strength","strength_pct","five_elements","useful_god_candidates"],"critical","comparison"],
  [9,1,"용신·희신 방향 - 균형을 살리는 환경","공부·휴식·관계·공간에서 아이의 균형을 살리는 조건을 제시한다.",["useful_god_candidates","five_elements","strength"],"deep","checklist"],
  [10,1,"십성 분포 - 배우고 표현하고 책임지는 방식","배움·표현·규칙·관계·현실감각의 균형을 아이의 성장 언어로 해석한다.",["ten_gods","hidden_stems","pillars"],"critical","table"],
  [11,2,"감정 표현 방식","기쁨·서운함·분노를 밖으로 드러내는 방식과 마음속에 남기는 방식을 본다.",["day_master","ten_gods","relations"],"deep","mixed"],
  [12,2,"상처받았을 때 회복 순서","속상한 상황에서 안정되기까지 필요한 시간·거리·말의 방식을 분석한다.",["relations","strength","five_elements"],"deep","strategy"],
  [13,2,"칭찬이 잘 먹히는 방식","결과·과정·구체적 행동 중 어떤 칭찬 방식이 동기를 살리는지 본다.",["ten_gods","day_master","strength"],"deep","comparison"],
  [14,2,"혼낼 때 피해야 할 방식","아이의 자존감과 행동 수정이 동시에 가능한 훈육 기준을 제시한다.",["relations","ten_gods","strength"],"critical","checklist"],
  [15,2,"공부 시작 방식","시작 장벽, 준비시간, 목표 크기와 관련된 학습 진입 패턴을 본다.",["ten_gods","five_elements","strength"],"deep","strategy"],
  [16,2,"집중력과 공부 리듬","짧고 강한 집중인지 오래 지속하는 집중인지, 적합한 공부 단위를 분석한다.",["ten_gods","strength","five_elements"],"critical","table"],
  [17,2,"틀렸을 때 반응과 피드백","실수·오답·경쟁에서 위축되거나 도전하는 패턴과 피드백 방법을 본다.",["relations","ten_gods","day_master"],"deep","comparison"],
  [18,2,"친구 관계와 또래 속 역할","또래 관계에서 주도·조율·관찰·양보가 어떻게 나타나는지 본다.",["relations","ten_gods","pillars"],"deep","mixed"],
  [19,2,"낯선 환경과 새학기 적응","새학기·새친구·새학원처럼 환경이 바뀔 때 필요한 적응 단계를 제시한다.",["relations","strength","current_daeun"],"deep","timeline"],
  [20,2,"부모와 부딪히는 지점","부모 기대와 아이 기질이 충돌하기 쉬운 장면을 구체적으로 분석한다.",["relations","ten_gods","day_master"],"critical","comparison"],
  [21,2,"스스로 움직이게 하는 말","명령보다 선택·예고·역할부여 등 아이에게 맞는 대화법을 제안한다.",["ten_gods","strength","chapter1_summary"],"deep","strategy"],
  [22,2,"강점과 재능의 씨앗","현재 반복적으로 잘하는 행동에서 앞으로 키울 수 있는 강점의 방향을 찾는다.",["hidden_stems","ten_gods","five_elements"],"critical","table"],
  [23,2,"표현력·창의성·결과물","말·글·그림·손기술·발표 등 표현 에너지가 살아나는 방식을 본다.",["hidden_stems","ten_gods","five_elements"],"deep","mixed"],
  [24,2,"규칙과 책임감","약속·숙제·정리·시간관리에서 책임감이 자라는 조건을 분석한다.",["ten_gods","relations","strength"],"deep","checklist"],
  [25,2,"진로 씨앗과 탐색 방향","직업을 단정하지 않고 오래 몰입할 수 있는 능력과 활동의 방향을 제안한다.",["ten_gods","hidden_stems","current_daeun"],"critical","strategy"],
  [26,3,"현재 성장 흐름","현재 대운과 세운에서 아이에게 크게 작용하는 성장 주제를 정리한다.",["current_daeun","annual_flow","chapter2_summary"],"critical","prose_callout"],
  [27,3,"좋아지는 시기와 활용법","도전·관계·학습에서 흐름이 좋아지는 구간과 활용법을 본다.",["current_daeun","annual_flow","monthly_flow"],"critical","timeline"],
  [28,3,"조심할 시기와 부모 대응","예민함·피로·갈등이 커질 수 있는 시기와 부모의 대응 기준을 제시한다.",["current_daeun","annual_flow","monthly_flow","relations"],"critical","timeline"],
  [29,3,"1개월·3개월·1년 성장 가이드","집에서 바로 적용할 수 있는 단기·중기·연간 성장 계획을 정리한다.",["current_daeun","annual_flow","monthly_flow","chapter2_summary"],"critical","strategy"],
  [30,3,"부모에게 드리는 최종 가이드","아이를 바꾸려 하기보다 강점을 살리고 갈등을 줄이는 핵심 원칙을 종합한다.",["chapter1_summary","chapter2_summary","current_daeun","annual_flow"],"critical","qa"],
]);

const COUPLE_CHAPTERS = {
  1: "두 사람의 기본 구조와 끌림",
  2: "사랑·갈등·생활에서 반복되는 패턴",
  3: "장기 관계를 위한 시기와 실행 전략",
};

export const COUPLE_REPORT_OUTLINE = makeOutline(COUPLE_CHAPTERS, [
  [1,1,"두 사람의 기본 정보","두 사람의 출생 정보와 궁합 해석 기준을 정확히 보여준다.",["identity","partner_identity","pillars","partner_pillars"],"normal","table"],
  [2,1,"두 사람의 원국 비교표","각자의 네 기둥·오행·십성 핵심을 나란히 비교한다.",["pillars","partner_pillars","five_elements","partner_five_elements","ten_gods","partner_ten_gods"],"critical","table"],
  [3,1,"관계의 기본 온도","함께 있을 때 빨라지는 것과 느려지는 것, 관계의 기본 분위기를 본다.",["day_master","partner_day_master","strength","partner_strength"],"deep","comparison"],
  [4,1,"처음 끌리는 이유","서로에게 매력으로 느껴지기 쉬운 기질과 보완점을 분석한다.",["ten_gods","partner_ten_gods","relations","partner_relations"],"deep","prose_callout"],
  [5,1,"서로에게 없는 것을 채우는 방식","오행과 역할 차이를 통해 보완 관계가 어떻게 만들어지는지 본다.",["five_elements","partner_five_elements","hidden_stems","partner_hidden_stems"],"critical","table"],
  [6,1,"속도 차이와 결정 방식","문제를 결정하고 행동하는 속도가 어떻게 다른지 분석한다.",["day_master","partner_day_master","strength","partner_strength"],"deep","comparison"],
  [7,1,"감정 표현의 차이","좋아함·서운함·화남을 표현하는 방식과 해석 차이를 본다.",["relations","partner_relations","ten_gods","partner_ten_gods"],"deep","mixed"],
  [8,1,"애정 확인 방식","연락·말·행동·시간·선물 등 애정을 확인하는 방식의 차이를 해석한다.",["ten_gods","partner_ten_gods","five_elements","partner_five_elements"],"deep","comparison"],
  [9,1,"갈등을 키우는 구조","합충형파해와 기질 차이에서 반복되는 갈등의 출발점을 본다.",["relations","partner_relations","cross_relations"],"critical","mixed"],
  [10,1,"이 관계의 핵심 강점","두 사람이 함께할 때 혼자보다 잘되는 영역과 공동 강점을 정리한다.",["five_elements","partner_five_elements","cross_relations"],"critical","prose_callout"],
  [11,2,"싸움이 시작되는 장면","연락·약속·집안일·돈·가족 등 현실 장면에서 갈등 시작점을 분석한다.",["relations","partner_relations","cross_relations"],"deep","table"],
  [12,2,"싸울 때 각자의 반응","밀어붙임·침묵·거리두기·설명 과다 등 갈등 반응을 비교한다.",["strength","partner_strength","ten_gods","partner_ten_gods"],"deep","comparison"],
  [13,2,"화해가 잘 되는 방식","각자 감정이 가라앉는 순서와 다시 대화하기 좋은 방식을 제안한다.",["relations","partner_relations","five_elements","partner_five_elements"],"deep","strategy"],
  [14,2,"연락과 거리감","연락 빈도·혼자 있는 시간·확인 욕구에서 생기는 차이를 본다.",["ten_gods","partner_ten_gods","strength","partner_strength"],"deep","comparison"],
  [15,2,"돈을 쓰고 모으는 방식","소비·저축·투자 성향의 차이를 관계 갈등과 연결해 본다.",["ten_gods","partner_ten_gods","five_elements","partner_five_elements"],"critical","table"],
  [16,2,"생활 리듬과 집안일","정리·수면·시간·집안일의 역할 분담에서 부딪힐 지점을 분석한다.",["day_master","partner_day_master","strength","partner_strength"],"deep","checklist"],
  [17,2,"일과 커리어를 대하는 태도","각자의 일 욕심·안정 욕구·변화 욕구가 관계에 미치는 영향을 본다.",["ten_gods","partner_ten_gods","current_daeun","partner_current_daeun"],"deep","comparison"],
  [18,2,"가족·시댁·처가 경계","원가족과 부부 경계에서 갈등이 생길 수 있는 패턴과 원칙을 제시한다.",["relations","partner_relations","cross_relations"],"deep","checklist"],
  [19,2,"질투·소유·신뢰의 기준","불안이 생겼을 때 확인하고 안심하는 방식의 차이를 본다.",["relations","partner_relations","ten_gods","partner_ten_gods"],"deep","mixed"],
  [20,2,"스킨십과 친밀감의 리듬","정서적 친밀감과 거리감의 리듬을 단정 없이 생활 수준에서 해석한다.",["five_elements","partner_five_elements","relations","partner_relations"],"deep","prose"],
  [21,2,"역할 분담과 공평감","누가 무엇을 맡을 때 불공평감이 줄어드는지 현실적인 기준을 만든다.",["ten_gods","partner_ten_gods","strength","partner_strength"],"critical","strategy"],
  [22,2,"함께 목표를 만들 때","집·돈·여행·자녀·사업 같은 공동 목표를 추진하는 방식을 본다.",["current_daeun","partner_current_daeun","annual_flow","partner_annual_flow"],"deep","strategy"],
  [23,2,"관계를 망가뜨리는 반복 패턴","이 관계에서 특히 누적되기 쉬운 오해와 금지 행동을 정리한다.",["cross_relations","relations","partner_relations"],"critical","table"],
  [24,2,"관계를 살리는 반복 패턴","두 사람에게 효과적인 대화·약속·회복 루틴을 구체화한다.",["cross_relations","five_elements","partner_five_elements"],"critical","checklist"],
  [25,2,"결혼·장기 관계 적합성","좋다/나쁘다 점수가 아니라 장기적으로 필요한 조건과 과제를 정리한다.",["cross_relations","current_daeun","partner_current_daeun"],"critical","mixed"],
  [26,3,"현재 두 사람의 관계 흐름","각자의 현재 대운·세운이 관계에 만드는 압력을 함께 본다.",["current_daeun","partner_current_daeun","annual_flow","partner_annual_flow"],"critical","prose_callout"],
  [27,3,"관계가 좋아지기 쉬운 시기","대화·약속·결정이 잘 풀리기 쉬운 시기를 활용법과 함께 제시한다.",["annual_flow","partner_annual_flow","monthly_flow","partner_monthly_flow"],"critical","timeline"],
  [28,3,"갈등이 커지기 쉬운 시기","스트레스가 관계로 전가되기 쉬운 시기와 방어 규칙을 제시한다.",["annual_flow","partner_annual_flow","monthly_flow","partner_monthly_flow","cross_relations"],"critical","timeline"],
  [29,3,"두 사람의 관계 운영 규칙","돈·연락·가족·집안일·감정 대화의 실전 규칙을 제안한다.",["cross_relations","chapter2_summary"],"critical","strategy"],
  [30,3,"최종 궁합 결론","두 사람이 왜 끌리고 왜 부딪히며 오래 가기 위해 무엇이 필요한지 직접 답한다.",["chapter1_summary","chapter2_summary","current_daeun","partner_current_daeun"],"critical","qa"],
]);

const PARENT_CHILD_CHAPTERS = {
  1: "부모와 아이의 기본 기질 차이",
  2: "갈등·공부·생활에서 부딪히는 이유",
  3: "관계를 살리는 시기별 양육 전략",
};

export const PARENT_CHILD_REPORT_OUTLINE = makeOutline(PARENT_CHILD_CHAPTERS, [
  [1,1,"부모와 아이의 기본 정보","두 사람의 출생 정보와 해석 기준을 정확히 보여준다.",["identity","partner_identity","pillars","partner_pillars"],"normal","table"],
  [2,1,"부모·아이 원국 비교표","두 사람의 핵심 기질과 오행·십성을 나란히 비교한다.",["pillars","partner_pillars","five_elements","partner_five_elements","ten_gods","partner_ten_gods"],"critical","table"],
  [3,1,"기질의 속도 차이","부모가 기대하는 속도와 아이가 실제 움직이는 속도를 비교한다.",["day_master","partner_day_master","strength","partner_strength"],"deep","comparison"],
  [4,1,"부모가 아이를 오해하기 쉬운 부분","겉행동만 보고 잘못 해석하기 쉬운 기질을 짚는다.",["relations","partner_relations","cross_relations"],"deep","prose_callout"],
  [5,1,"아이가 부모를 어렵게 느끼는 부분","부모의 좋은 의도가 압박으로 느껴지는 장면을 분석한다.",["relations","partner_relations","cross_relations"],"deep","prose"],
  [6,1,"감정 표현의 차이","서운함·화남·불안을 표현하는 방식의 차이를 본다.",["ten_gods","partner_ten_gods","relations","partner_relations"],"deep","comparison"],
  [7,1,"칭찬이 엇갈리는 이유","부모가 하는 칭찬과 아이가 듣고 싶은 칭찬 사이의 차이를 분석한다.",["ten_gods","partner_ten_gods","cross_relations"],"deep","mixed"],
  [8,1,"훈육이 먹히는 방식","지시·설명·선택·예고 중 어떤 방식이 관계를 덜 해치면서 효과적인지 본다.",["strength","partner_strength","cross_relations"],"critical","strategy"],
  [9,1,"부모의 불안과 아이의 독립성","보호와 간섭의 경계가 어디에서 흔들리는지 분석한다.",["relations","partner_relations","ten_gods","partner_ten_gods"],"deep","comparison"],
  [10,1,"이 관계의 핵심 강점","부모와 아이가 서로에게 줄 수 있는 긍정적 자원을 정리한다.",["five_elements","partner_five_elements","cross_relations"],"critical","prose_callout"],
  [11,2,"아침 준비와 시간 약속","재촉·지각·준비 순서에서 반복되는 갈등과 해결법을 본다.",["strength","partner_strength","cross_relations"],"deep","strategy"],
  [12,2,"숙제와 공부 갈등","부모의 기대와 아이의 공부 시작 방식이 부딪히는 지점을 분석한다.",["ten_gods","partner_ten_gods","cross_relations"],"critical","comparison"],
  [13,2,"오답·실수에 대한 반응","틀렸을 때 부모와 아이가 각각 어떻게 반응하는지 보고 피드백 방식을 제시한다.",["relations","partner_relations","strength","partner_strength"],"deep","strategy"],
  [14,2,"스마트폰·게임·미디어 규칙","통제와 자율 사이에서 지킬 수 있는 규칙을 만드는 방식을 본다.",["ten_gods","partner_ten_gods","cross_relations"],"deep","checklist"],
  [15,2,"친구 문제를 대하는 방식","부모가 개입할 때와 기다릴 때를 구분하는 기준을 제시한다.",["relations","partner_relations","cross_relations"],"deep","comparison"],
  [16,2,"형제·가족 안의 역할","가족 내 역할 고정과 비교가 관계에 미치는 영향을 분석한다.",["relations","partner_relations","cross_relations"],"deep","table"],
  [17,2,"말대꾸·반항처럼 보이는 순간","독립성의 신호와 실제 규칙 위반을 구분하는 기준을 만든다.",["strength","partner_strength","ten_gods","partner_ten_gods"],"deep","mixed"],
  [18,2,"부모가 먼저 멈춰야 하는 말","아이 기질에 특히 상처가 되기 쉬운 표현을 구체적으로 정리한다.",["cross_relations","relations","partner_relations"],"critical","checklist"],
  [19,2,"아이에게 힘이 되는 말","같은 요구라도 아이가 받아들이기 쉬운 말의 구조를 제안한다.",["cross_relations","ten_gods","partner_ten_gods"],"critical","strategy"],
  [20,2,"독립심을 키우는 역할 분담","연령과 기질에 맞게 아이가 책임질 영역을 넓히는 방식을 본다.",["strength","partner_strength","five_elements","partner_five_elements"],"deep","strategy"],
  [21,2,"학원·진로 선택에서 부딪히는 이유","부모의 현실 기준과 아이의 흥미 기준을 조율하는 방법을 본다.",["ten_gods","partner_ten_gods","current_daeun","partner_current_daeun"],"critical","comparison"],
  [22,2,"아이의 강점을 부모가 키우는 방식","부모의 기질이 아이의 재능을 돕는 방식과 방해하는 방식을 함께 본다.",["hidden_stems","partner_hidden_stems","cross_relations"],"critical","table"],
  [23,2,"갈등 후 회복 루틴","사과·거리두기·재대화의 순서를 가족에 맞게 제안한다.",["relations","partner_relations","cross_relations"],"deep","strategy"],
  [24,2,"우리 집 규칙 만드는 법","지킬 수 있는 규칙·예외·결과를 함께 설계하는 원칙을 제시한다.",["ten_gods","partner_ten_gods","cross_relations"],"deep","checklist"],
  [25,2,"부모·자녀 관계 핵심 요약","지금까지 반복된 갈등의 원인과 가장 효과적인 전환 포인트를 종합한다.",["chapter1_summary","chapter2_material","cross_relations"],"critical","mixed"],
  [26,3,"현재 부모와 아이의 흐름","각자의 현재 대운·세운이 관계에 주는 영향을 함께 본다.",["current_daeun","partner_current_daeun","annual_flow","partner_annual_flow"],"critical","prose_callout"],
  [27,3,"관계가 부드러워지기 쉬운 시기","대화·변화·새로운 시도를 하기 좋은 구간을 제시한다.",["annual_flow","partner_annual_flow","monthly_flow","partner_monthly_flow"],"critical","timeline"],
  [28,3,"갈등이 커지기 쉬운 시기","부모와 아이 모두 예민해질 수 있는 구간과 대응법을 제시한다.",["annual_flow","partner_annual_flow","monthly_flow","partner_monthly_flow","cross_relations"],"critical","timeline"],
  [29,3,"1개월·3개월·1년 양육 전략","가정에서 실행할 수 있는 단기·중기·연간 관계 개선 계획을 정리한다.",["chapter2_summary","current_daeun","partner_current_daeun"],"critical","strategy"],
  [30,3,"부모에게 드리는 최종 답변","아이를 이해하고 관계를 바꾸기 위해 지금 가장 먼저 할 일을 직접 답한다.",["chapter1_summary","chapter2_summary","cross_relations"],"critical","qa"],
]);

const NEW_YEAR_CHAPTERS = {
  1: "올해의 전체 흐름",
  2: "일·돈·관계의 월별 변화",
  3: "좋은 시기와 조심할 시기 실행 가이드",
};

export const NEW_YEAR_REPORT_OUTLINE = makeOutline(NEW_YEAR_CHAPTERS, [
  [1,1,"기본 인적 정보","출생 정보와 올해 운세를 읽는 계산 기준을 보여준다.",["identity","birth_solar","pillars","current_daeun","annual_flow"],"normal","table"],
  [2,1,"사주 원국 핵심표","올해 해석에 필요한 원국·오행·십성 핵심을 압축해 보여준다.",["pillars","five_elements","ten_gods","hidden_stems"],"critical","table"],
  [3,1,"올해 한 문장 총평","현재 대운과 세운을 연결해 올해의 핵심 주제를 한 문장으로 잡는다.",["current_daeun","annual_flow","day_master"],"critical","prose_callout"],
  [4,1,"올해 들어오는 기회","성과·관계·배움·변화 중 무엇이 들어오기 쉬운지 본다.",["current_daeun","annual_flow","ten_gods"],"deep","table"],
  [5,1,"올해 새기 쉬운 에너지","과로·지출·관계 소모·결정 지연처럼 주의할 누수 패턴을 본다.",["annual_flow","relations","strength"],"deep","table"],
  [6,1,"일과 커리어 흐름","직장·사업·프로젝트에서 올해의 변화와 선택 기준을 본다.",["current_daeun","annual_flow","ten_gods"],"critical","strategy"],
  [7,1,"돈과 소비 흐름","수입·지출·저축·큰돈 결정에서 올해의 경향과 주의점을 본다.",["current_daeun","annual_flow","ten_gods","five_elements"],"critical","comparison"],
  [8,1,"관계와 인간관계 흐름","새 인연·기존 관계·거리 조절에서 올해의 특징을 본다.",["annual_flow","relations","ten_gods"],"deep","mixed"],
  [9,2,"1월 흐름","1월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [10,2,"2월 흐름","2월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [11,2,"3월 흐름","3월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [12,2,"4월 흐름","4월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [13,2,"5월 흐름","5월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [14,2,"6월 흐름","6월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [15,2,"7월 흐름","7월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [16,2,"8월 흐름","8월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [17,2,"9월 흐름","9월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [18,2,"10월 흐름","10월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [19,2,"11월 흐름","11월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [20,2,"12월 흐름","12월의 핵심 기운과 일·돈·관계 행동 기준을 제시한다.",["monthly_flow","annual_flow","current_daeun"],"normal","timeline"],
  [21,3,"올해 가장 좋은 시기","기회를 적극 활용하기 좋은 월과 그때 할 일을 정리한다.",["monthly_flow","annual_flow","question"],"critical","table"],
  [22,3,"올해 가장 조심할 시기","무리·충돌·큰결정을 조심해야 할 월과 방어 규칙을 정리한다.",["monthly_flow","annual_flow","relations"],"critical","table"],
  [23,3,"올해 해야 할 일과 하지 말아야 할 일","올해의 흐름을 현실에서 살리기 위한 실행 기준을 체크리스트로 정리한다.",["current_daeun","annual_flow","monthly_flow"],"critical","checklist"],
  [24,3,"올해 최종 운세 결론","사용자의 질문을 포함해 올해의 우선순위와 행동 기준을 직접 답한다.",["question","current_daeun","annual_flow","monthly_flow"],"critical","qa"],
]);

export const REPORT_CATEGORY_CONFIGS: Record<ReportCategoryKey, ReportCategoryConfig> = {
  life: {
    key: "life",
    slug: "life-report",
    title: "종합 인생 리포트",
    subtitle: "원국 구조부터 현재 흐름과 실행 전략까지 연결한 개인맞춤 종합 인생 리포트",
    version: REPORT_VERSION,
    focus: "성향·일·돈·관계·현재 흐름과 실행 전략을 종합적으로 연결한다.",
    outline: REPORT_OUTLINE,
  },
  child: {
    key: "child",
    slug: "child-report",
    title: "자녀 사주 리포트",
    subtitle: "기질·감정·학습·친구·부모 소통·재능과 성장 시기를 연결한 개인맞춤 자녀 사주 리포트",
    version: "child-report-aqua-30-v1",
    focus: "아이를 성인처럼 해석하지 말고, 성장·학습·감정·관계·양육 장면을 중심으로 쓴다.",
    outline: CHILD_REPORT_OUTLINE,
  },
  couple: {
    key: "couple",
    slug: "couple-compatibility",
    title: "커플·부부 궁합 리포트",
    subtitle: "두 사람의 끌림·갈등·감정·돈·생활·장기 관계 전략을 연결한 개인맞춤 궁합 리포트",
    version: "couple-compatibility-aqua-30-v1",
    focus: "좋다/나쁘다 점수 대신 두 사람의 차이·보완·갈등 순서·관계 운영 규칙을 중심으로 쓴다.",
    outline: COUPLE_REPORT_OUTLINE,
    requiresSecondProfile: true,
  },
  parent_child: {
    key: "parent_child",
    slug: "parent-child-compatibility",
    title: "부모·자녀 궁합 리포트",
    subtitle: "부모와 아이의 기질 차이·갈등·공부·생활·소통과 양육 전략을 연결한 개인맞춤 관계 리포트",
    version: "parent-child-compatibility-aqua-30-v1",
    focus: "부모의 기대와 아이 기질의 차이를 생활 장면으로 번역하고 양육 행동 기준을 제시한다.",
    outline: PARENT_CHILD_REPORT_OUTLINE,
    requiresSecondProfile: true,
  },
  new_year: {
    key: "new_year",
    slug: "new-year",
    title: "신년 운세 리포트",
    subtitle: "올해의 전체 흐름과 12개월 변화, 좋은 시기·조심할 시기·실행 기준을 연결한 개인맞춤 신년 리포트",
    version: "new-year-aqua-24-v1",
    focus: "한 해의 흐름과 월별 변화, 현실적인 활용법을 중심으로 쓴다. 미래를 확정적으로 단정하지 않는다.",
    outline: NEW_YEAR_REPORT_OUTLINE,
  },
};

export function getReportCategoryConfig(product: any): ReportCategoryConfig {
  const slug = String(product?.slug || "").trim().toLowerCase();
  const type = String(product?.report_type || "").trim().toLowerCase();
  const name = String(product?.name || "").trim();

  if (slug === "child-report" || type.includes("child") && !type.includes("compat") || name.includes("자녀 사주")) return REPORT_CATEGORY_CONFIGS.child;
  if (slug === "couple-compatibility" || type.includes("couple") || name.includes("커플") || name.includes("부부")) return REPORT_CATEGORY_CONFIGS.couple;
  if (slug === "parent-child-compatibility" || type.includes("parent") || name.includes("부모·자녀")) return REPORT_CATEGORY_CONFIGS.parent_child;
  if (slug === "new-year" || type.includes("year") || name.includes("신년")) return REPORT_CATEGORY_CONFIGS.new_year;
  return REPORT_CATEGORY_CONFIGS.life;
}
