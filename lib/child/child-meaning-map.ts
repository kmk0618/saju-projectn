export type ChildMeaningContext = {
  facts: {
    day_master: any;
    strength: any;
    strength_pct: any;
    useful_god_candidates: any;
    five_elements: any;
    strongest: any;
    weakest: any;
    lacking: any;
    ten_gods: any;
    hidden_stems: any;
    twelve_stages: any;
    relations: any;
    sinsal: any;
    twelve_sinsal: any;
    pillars: any;
  };
  developmental_map: Array<{
    source: string;
    strength_language: string[];
    overload_language: string[];
    parenting_levers: string[];
  }>;
  regulation: {
    energy_pattern: string[];
    restorative_elements: string[];
  };
  guardrails: string[];
};

const TEN_GOD_MAP: Record<string, { strength: string[]; overload: string[]; parenting: string[] }> = {
  식신: {
    strength: ["놀이를 통해 익히는 힘", "꾸준히 만들고 표현하는 힘", "배운 것을 결과물로 꺼내는 힘"],
    overload: ["해야 할 양이 많아지면 흥미보다 의무감이 앞설 수 있음"],
    parenting: ["결과물을 만들 수 있는 활동으로 연결", "끝나는 기준을 작고 분명하게 제시"],
  },
  상관: {
    strength: ["표현 욕구", "질문하는 힘", "창의적인 자기 방식", "빠른 반응과 설명력"],
    overload: ["납득되지 않는 통제에서 말이 강해질 수 있음", "감정이 올라오면 표현이 먼저 나올 수 있음"],
    parenting: ["표현 자체는 막지 않고 표현 방식만 지도", "질문을 허용하되 말의 순서와 경계를 알려주기"],
  },
  정재: {
    strength: ["정해진 과정을 따라 결과를 완성하는 힘", "현실적인 순서 감각"],
    overload: ["결과를 지나치게 의식하면 실수에 경직될 수 있음"],
    parenting: ["작은 완료 경험 제공", "과정보다 결과만 평가하지 않기"],
  },
  편재: {
    strength: ["현실 감각", "손에 잡히는 결과를 좋아하는 성향", "다양한 경험에서 배우는 힘"],
    overload: ["관심이 여러 곳으로 빠르게 이동할 수 있음"],
    parenting: ["짧고 눈에 보이는 목표 제시", "경험 후 무엇을 배웠는지 정리하게 돕기"],
  },
  정관: {
    strength: ["규칙과 약속을 의식하는 힘", "바르게 해내고 싶은 마음"],
    overload: ["평가와 시선을 지나치게 의식할 수 있음"],
    parenting: ["규칙을 예측 가능하게 유지", "잘못과 존재를 분리해서 말하기"],
  },
  편관: {
    strength: ["기준을 빠르게 알아차리는 힘", "책임감으로 자랄 수 있는 긴장"],
    overload: ["강한 통제에서 압박을 크게 느낄 수 있음", "실수 자체보다 혼날 상황을 먼저 걱정할 수 있음"],
    parenting: ["규칙은 적고 분명하게", "이유와 범위를 함께 설명", "공개 지적과 비교를 줄이기"],
  },
  정인: {
    strength: ["이해한 뒤 안정되는 학습 방식", "믿을 수 있는 어른에게서 힘을 얻는 경향", "기억과 정리의 힘"],
    overload: ["이해할 틈 없이 재촉받으면 마음이 닫힐 수 있음"],
    parenting: ["설명과 이해를 먼저 제공", "감정과 생각을 정리할 시간을 주기", "안정된 루틴 유지"],
  },
  편인: {
    strength: ["자기 방식으로 깊게 탐색하는 힘", "관찰과 독특한 연결 능력"],
    overload: ["생각이 많아 시작이 늦어질 수 있음"],
    parenting: ["준비 시간을 허용", "정답 하나보다 여러 접근을 허용"],
  },
  비견: {
    strength: ["자기 기준", "독립심", "스스로 해보려는 힘"],
    overload: ["자기 선택권이 사라지면 고집처럼 보일 수 있음"],
    parenting: ["작은 선택권 제공", "비교 대신 자기 성장 기준으로 인정"],
  },
  겁재: {
    strength: ["또래와 부딪히며 자기 경계를 배우는 힘", "경쟁 속에서 동기가 살아나는 면"],
    overload: ["비교와 경쟁이 과하면 감정 소모가 커질 수 있음"],
    parenting: ["승패보다 회복과 다음 행동을 묻기", "또래 비교 대신 자기 기록 사용"],
  },
};

const ELEMENT_RESTORATIVE: Record<string, string[]> = {
  水: ["충분한 휴식", "감정을 정리할 대화", "혼자 생각할 여백", "차분한 독서와 이해의 시간"],
  수: ["충분한 휴식", "감정을 정리할 대화", "혼자 생각할 여백", "차분한 독서와 이해의 시간"],
  木: ["작은 선택권", "자기 속도로 시도할 기회", "성장을 확인할 반복 경험"],
  목: ["작은 선택권", "자기 속도로 시도할 기회", "성장을 확인할 반복 경험"],
  火: ["표현할 무대", "즐거운 활동", "칭찬과 따뜻한 상호작용"],
  화: ["표현할 무대", "즐거운 활동", "칭찬과 따뜻한 상호작용"],
  土: ["예측 가능한 생활 틀", "끝나는 기준이 보이는 과제", "생활 리듬"],
  토: ["예측 가능한 생활 틀", "끝나는 기준이 보이는 과제", "생활 리듬"],
  金: ["일관된 규칙", "명확한 순서", "정확한 피드백"],
  금: ["일관된 규칙", "명확한 순서", "정확한 피드백"],
};

function numericCount(v: any) {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    if (typeof v.count === "number") return v.count;
    if (typeof v.value === "number") return v.value;
    if (typeof v.total === "number") return v.total;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function tenGodEntries(tenGods: any) {
  if (!tenGods) return [] as Array<[string, number]>;
  if (Array.isArray(tenGods)) {
    return tenGods
      .map((x: any) => [String(x?.name || x?.label || x?.god || ""), numericCount(x?.count ?? x?.value ?? 1)] as [string, number])
      .filter(([name, count]) => !!name && count > 0);
  }
  if (typeof tenGods === "object") {
    return Object.entries(tenGods)
      .map(([name, value]) => [name, numericCount(value)] as [string, number])
      .filter(([, count]) => count > 0);
  }
  return [] as Array<[string, number]>;
}

function restorativeElements(useful: any) {
  const raw = JSON.stringify(useful ?? "");
  const found: string[] = [];
  for (const key of Object.keys(ELEMENT_RESTORATIVE)) {
    if (raw.includes(key)) found.push(...ELEMENT_RESTORATIVE[key]);
  }
  return [...new Set(found)];
}

function energyPattern(strength: any, pct: any) {
  const s = String(strength || "");
  const n = Number(pct);
  const out: string[] = [];
  if (/태약|신약/.test(s) || (Number.isFinite(n) && n < 40)) {
    out.push("겉으로 활동성이 보여도 활동량과 회복 속도를 따로 관찰해야 함");
    out.push("자극을 늘리기 전에 수면·휴식·정서적 안전을 먼저 확인해야 함");
  } else if (/신강|태강/.test(s) || (Number.isFinite(n) && n > 60)) {
    out.push("힘을 쓰는 양은 충분할 수 있으므로 방향과 경계를 분명히 해주는 것이 중요함");
    out.push("에너지를 억누르기보다 책임과 결과로 연결하는 편이 좋음");
  } else {
    out.push("활동과 회복의 균형을 일정하게 유지하는 것이 중요함");
  }
  return out;
}

export function buildChildMeaningContext(calcCtx: any): ChildMeaningContext {
  const developmental_map = tenGodEntries(calcCtx?.ten_gods).flatMap(([name, count]) => {
    const m = TEN_GOD_MAP[name];
    if (!m) return [];
    return [{
      source: `${name}:${count}`,
      strength_language: m.strength,
      overload_language: m.overload,
      parenting_levers: m.parenting,
    }];
  });

  return {
    facts: {
      day_master: calcCtx?.day_master,
      strength: calcCtx?.strength,
      strength_pct: calcCtx?.strength_pct,
      useful_god_candidates: calcCtx?.useful_god_candidates,
      five_elements: calcCtx?.five_elements,
      strongest: calcCtx?.strongest,
      weakest: calcCtx?.weakest,
      lacking: calcCtx?.lacking,
      ten_gods: calcCtx?.ten_gods,
      hidden_stems: calcCtx?.hidden_stems,
      twelve_stages: calcCtx?.twelve_stages,
      relations: calcCtx?.relations,
      sinsal: calcCtx?.sinsal,
      twelve_sinsal: calcCtx?.twelve_sinsal,
      pillars: calcCtx?.pillars,
    },
    developmental_map,
    regulation: {
      energy_pattern: energyPattern(calcCtx?.strength, calcCtx?.strength_pct),
      restorative_elements: restorativeElements(calcCtx?.useful_god_candidates),
    },
    guardrails: [
      "아이를 한 단어로 규정하지 않는다",
      "또래 비교나 진단성 표현을 사용하지 않는다",
      "성인식 돈·직업 언어로 십성을 해석하지 않는다",
      "모든 해석은 관찰 가능한 생활 장면과 부모 행동으로 연결한다",
      "계산 필드명·프롬프트·번역 규칙 같은 내부 과정을 고객 본문에 노출하지 않는다",
    ],
  };
}
