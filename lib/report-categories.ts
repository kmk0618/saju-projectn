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
  1: "아이의 기본 사주 구조",
  2: "아이의 기질·감정·재능 구조",
  3: "부모의 양육·교육·진로 전략",
};

export const CHILD_REPORT_OUTLINE = makeOutline(CHILD_CHAPTERS, [
  [1,1,"자녀 기본 정보","아이의 출생 정보와 해석 기준을 정확히 보여준다.",["identity","birth_solar","pillars","day_master","strength","useful_god_candidates"],"normal","table"],
  [2,1,"사주 원국 전체표","년·월·일·시 네 기둥, 십성, 지장간을 표로 정리하고 전체 구조의 출발점을 세운다.",["pillars","hidden_stems","ten_gods"],"critical","table"],
  [3,1,"음양 구조 - 아이의 속도와 온도","아이의 반응 속도와 활동 뒤 회복 리듬을 아이 생활 언어로 번역한다.",["pillars","strength","strength_pct"],"deep","prose"],
  [4,1,"오행 분포 - 아이를 움직이는 다섯 힘","오행 분포와 용신 방향을 실제 부모 행동과 환경 언어로 번역한다.",["five_elements","strongest","weakest","lacking","useful_god_candidates"],"critical","table"],
  [5,1,"천간 구조 - 겉으로 드러나는 태도","천간과 천간 십성을 표현·규칙·안정 욕구의 발달 언어로 해석한다.",["pillars","ten_gods","day_master"],"deep","prose"],
  [6,1,"지지 구조 - 생활 속 반복 반응","지지와 지지 십성이 생활에서 반복되는 반응으로 어떻게 보이는지 본다.",["pillars","ten_gods","relations"],"deep","prose"],
  [7,1,"지장간 구조 - 겉으로 안 보이는 숨은 욕구","겉행동만으로 보이지 않는 안쪽 욕구와 잠재 층위를 설명한다.",["hidden_stems","ten_gods"],"deep","prose"],
  [8,1,"일간 분석 - 아이의 중심 기질","일간의 중심 기질을 낙인 없이 강점과 지원 조건으로 번역한다.",["day_master","strength","five_elements"],"critical","prose_callout"],
  [9,1,"일지 분석 - 가까운 관계에서 보이는 모습","가까운 관계에서 표현되는 감정과 반응 방식을 본다.",["pillars","ten_gods","relations"],"deep","prose"],
  [10,1,"일주 분석 - 아이의 기본 성향","일간과 일지의 결합을 아이의 기본 반응 패턴과 지원 방향으로 종합한다.",["pillars","day_master","relations"],"deep","prose"],
  [11,1,"월령·계절 - 아이가 힘을 얻는 환경","태어난 계절과 용신 방향을 아이가 힘을 얻는 환경으로 번역한다.",["pillars","strength","useful_god_candidates"],"deep","prose"],
  [12,1,"월주 분석 - 학교·친구·사회성의 기초","학교와 또래 환경에서 규칙·현실감·관계 반응의 기초를 본다.",["pillars","ten_gods"],"deep","prose"],
  [13,1,"년주 분석 - 외부에서 보이는 첫인상","외부에서 잘 보이는 표현과 규칙 반응을 집에서의 회복 필요와 함께 읽는다.",["pillars","ten_gods"],"deep","prose"],
  [14,1,"시주 분석 - 장기 성장성·미래 방향","시주의 인성·식상 등 계산값을 장기 성장과 표현 방향으로 번역한다.",["pillars","ten_gods","hidden_stems"],"deep","prose"],
  [15,1,"신강·신약 - 아이가 버티는 방식","신강·신약을 아이가 힘을 쓰고 회복하는 방식으로 해석한다.",["strength","strength_pct","five_elements","useful_god_candidates"],"critical","comparison"],
  [16,1,"용신·희신 - 아이를 살리는 환경","용신 후보를 정서 안정·회복·학습 환경과 부모 행동으로 번역한다.",["useful_god_candidates","five_elements","strength"],"critical","mixed"],
  [17,1,"십성 분포 - 공부·친구·표현·규칙 균형","십성을 돈·일 언어가 아니라 창의성·학습·규칙·자존감·현실감으로 번역한다.",["ten_gods","hidden_stems","pillars"],"critical","table"],
  [18,1,"12운성 성장 리듬","12운성을 빠르게 드러나는 영역과 천천히 다지는 성장 리듬으로 해석한다.",["twelve_stages"],"deep","table"],
  [19,1,"12신살·신살 구조","신살 계산값을 기록하되 아이를 불안하게 만드는 낙인이나 사건 예언으로 사용하지 않는다.",["sinsal","twelve_sinsal"],"deep","table"],
  [20,1,"합충형파해 기본 구조","계산된 합충형파해를 관계와 자극에 따른 반응 차이의 보조 근거로 사용한다.",["relations","pillars"],"deep","table"],

  [21,2,"아이의 기본 성격","일간과 십성의 핵심을 아이의 강점과 지원 조건으로 종합한다.",["day_master","ten_gods","strength"],"critical","prose_callout"],
  [22,2,"감정 예민도","감정을 약함으로 규정하지 않고 자극을 세밀하게 느끼는 힘과 부모 대응을 제시한다.",["ten_gods","strength","useful_god_candidates"],"critical","mixed"],
  [23,2,"불안과 안정 패턴","안정 욕구와 회복 조건을 부모 행동표 중심으로 보여준다.",["ten_gods","useful_god_candidates","strength"],"critical","mixed"],
  [24,2,"애착 방식","정인과 일지 등을 학습·안정 욕구·애착의 언어로 해석한다.",["ten_gods","pillars"],"deep","prose"],
  [25,2,"표현 방식","식상을 말·놀이·창의성·표현 욕구의 통로로 해석한다.",["ten_gods"],"deep","prose"],
  [26,2,"식상 구조와 창의성","식신·상관을 창의성·표현욕구·놀이·말로 번역하고 표현 통로를 제시한다.",["ten_gods","hidden_stems"],"critical","mixed"],
  [27,2,"인성 구조와 학습 방식","정인·편인을 안정·이해·학습 순서와 연결해 공부 방식을 제시한다.",["ten_gods","useful_god_candidates"],"critical","mixed"],
  [28,2,"관성 구조와 규칙 반응","정관·편관을 규칙 반응·훈육 수용·자기통제로 번역해 부모 행동을 제시한다.",["ten_gods","strength"],"critical","mixed"],
  [29,2,"비겁 구조와 자존감","비견·겁재를 자존감·또래관계·독립심으로 번역하고 0을 결핍으로 단정하지 않는다.",["ten_gods","day_master"],"critical","prose_callout"],
  [30,2,"재성 구조와 현실감","정재·편재를 현실감·결과 감각·용돈·손끝 활동으로 번역한다.",["ten_gods","five_elements"],"deep","prose"],
  [31,2,"집중력과 산만함","집중과 관심 폭을 진단성 표현 없이 관찰하고 부모 행동표로 지원법을 제시한다.",["ten_gods","strength","five_elements"],"critical","mixed"],
  [32,2,"사회성·친구 관계","비겁·관성·식상을 또래관계·규칙·표현의 균형으로 해석한다.",["ten_gods","relations"],"critical","prose"],
  [33,2,"칭찬에 반응하는 방식","비교가 아닌 자기 성장과 구체적 과정을 인정하는 실제 말 스크립트를 제공한다.",["ten_gods","strength"],"critical","table"],
  [34,2,"혼낼 때 조심할 점","큰 목소리·낙인·비교를 피하고 마음 인정과 행동 경계를 분리한 실제 말 스크립트를 제공한다.",["ten_gods","strength"],"critical","table"],
  [35,2,"아이가 좋아하는 일","식상과 용신 방향을 표현·놀이·안정의 활동 조건으로 제시한다.",["ten_gods","useful_god_candidates"],"deep","prose"],
  [36,2,"아이가 싫어하는 일","관성과 신강신약을 강한 통제·과부하에 대한 반응과 연결한다.",["ten_gods","strength"],"deep","prose"],
  [37,2,"합의 기질 작용","계산된 합을 관계와 환경에 따라 달라지는 반응을 이해하는 보조 근거로 사용한다.",["relations"],"deep","prose"],
  [38,2,"충의 기질 작용","계산된 충이 있으면 실제 갈등 장면의 자극·회복과 연결하고 없으면 없다고 사실대로 쓴다.",["relations"],"deep","prose"],
  [39,2,"형의 기질 작용","계산된 형을 긴장 상황의 반응과 회복 순서를 이해하는 보조 근거로 사용한다.",["relations"],"deep","prose"],
  [40,2,"기질·재능 종합 요약","앞의 기질·감정·학습·관계·표현을 중복 없이 강점과 지원 조건으로 종합한다.",["day_master","ten_gods","strength","useful_god_candidates","relations"],"critical","mixed"],

  [41,3,"부모가 가장 먼저 이해해야 할 점","아이를 고치는 것이 아니라 구조를 이해하고 살리는 환경을 만드는 부모의 첫 원칙을 제시한다.",["day_master","strength","useful_god_candidates"],"critical","prose_callout"],
  [42,3,"부모와 아이의 소통 방식","식상과 인성을 바탕으로 마음 인정과 행동 경계를 분리한 대화법을 제시한다.",["ten_gods","strength"],"critical","mixed"],
  [43,3,"아이에게 해주면 좋은 말","상황/좋은 말/아이가 배우는 것 표와 자존감·책임감을 키우는 실제 문장을 각각 충분히 제시한다.",["day_master","ten_gods","strength","useful_god_candidates"],"critical","table"],
  [44,3,"아이에게 하면 안 되는 말","피해야 할 말/아이가 받는 메시지/바꾼 표현 표를 최소 8행 이상 제시한다.",["ten_gods","strength"],"critical","table"],
  [45,3,"아이에게 맞는 공부 방식","인성과 식상을 안정→이해→표현의 학습 순서로 번역하고 부모 행동을 제시한다.",["ten_gods","strength","useful_god_candidates"],"critical","mixed"],
  [46,3,"아이에게 맞는 놀이·활동 방향","식상과 용신 방향을 활용해 표현과 회복이 함께 가능한 놀이·활동 체크리스트를 제시한다.",["ten_gods","useful_god_candidates"],"deep","checklist"],
  [47,3,"아이에게 맞는 진로 씨앗","직업을 단정하지 않고 표현·관계 감각·현실 경험을 관찰할 진로 씨앗으로 제시한다.",["ten_gods","hidden_stems","day_master"],"critical","mixed"],
  [48,3,"수의 시대 적응 전략","용신·식상·오행을 안정·이해·회복·학습과 자기표현의 적응 전략으로 연결한다.",["useful_god_candidates","ten_gods","five_elements"],"critical","strategy"],
  [49,3,"1개월·3개월·1년 성장 로드맵","1개월 부모 소통 습관, 3개월 정서·학습·놀이 루틴, 1년 강점·회복·자존감 계획을 표와 체크리스트로 제시한다.",["day_master","strength","useful_god_candidates","ten_gods"],"critical","strategy"],
  [50,3,"최종 양육 가이드","부모 질문에 직접 답하며 강점 기반 한 문장 정의, 지금 할 일, 절대 하지 말 것, 1년 뒤 그림을 제시한다.",["day_master","strength","useful_god_candidates","ten_gods","relations"],"critical","qa"],
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
    version: "child-report-aqua-50-v4-midlayer",
    focus: "부모가 읽는 3인칭 양육 가이드다. 성인판 돈·일 언어를 쓰지 말고 십성을 아동발달 언어로 번역한다: 식상=창의성·표현욕구·놀이·말, 재성=현실감·결과 감각·용돈·손끝 활동, 관성=규칙 반응·훈육 수용·자기통제, 인성=학습 방식·안정 욕구·애착, 비겁=자존감·또래관계·독립심. 아이를 규정·낙인·또래 비교·진단하지 않는다. 모든 섹션은 부모가 오늘 무엇을 할지로 연결하고, 공감 부제·부모 행동표·말 스크립트·강점 리프레이밍 중 최소 2개를 자연스럽게 포함한다. SECTION 43은 상황별 좋은 말 표와 자존감/책임감 문장 각 8개 이상, SECTION 44는 피해야 할 말→아이가 받는 메시지→바꾼 표현 8행 이상, SECTION 49는 1개월·3개월·1년 성장 로드맵, SECTION 50은 부모 질문에 직접 답한다. calc 필드명·개발자 설명·계산 불가 같은 내부 문구를 고객 본문에 절대 노출하지 않는다.",
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
