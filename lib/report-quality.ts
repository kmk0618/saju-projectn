function stripHtml(s: string) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ngrams(s: string, n = 3) {
  const t = stripHtml(s).replace(/[\s.,!?“”'"()\[\]{}:;·—–-]/g, "");
  const set = new Set<string>();
  for (let i = 0; i <= t.length - n; i++) set.add(t.slice(i, i + n));
  return set;
}

export function similarity(a: string, b: string) {
  const A = ngrams(a);
  const B = ngrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

const GENERIC_OPENINGS = [
  /^일간은/,
  /^현재 대운은/,
  /기운이 (?:강|약)/,
  /^이 구조를 현실에서/,
  /^기본적으로/,
  /^김민경 님은 기본적으로/,
  /^사주를 보면/,
];

export type QualityCandidate = {
  opening_sentence?: string;
  content_html?: string;
  key_basis?: string[];
  life_scenes?: string[];
  action_point?: string;
};

export function validateGeneratedSection(args: {
  candidate: QualityCandidate;
  minChars: number;
  previous: QualityCandidate[];
}) {
  const { candidate, minChars, previous } = args;
  const issues: string[] = [];
  const opening = stripHtml(candidate.opening_sentence || "");
  const content = stripHtml(candidate.content_html || "");

  if (content.length < minChars) issues.push(`TOO_SHORT_${content.length}`);
  if (!Array.isArray(candidate.key_basis) || candidate.key_basis.length < 1) issues.push("NO_FACT_BASIS");
  if (GENERIC_OPENINGS.some((re) => re.test(opening))) issues.push("GENERIC_OPENING");

  for (const p of previous) {
    if (opening && p.opening_sentence && similarity(opening, p.opening_sentence) > 0.46) {
      issues.push("OPENING_TOO_SIMILAR");
      break;
    }
  }

  for (const p of previous) {
    if (content && p.content_html && similarity(content, p.content_html) > 0.58) {
      issues.push("BODY_TOO_SIMILAR");
      break;
    }
  }

  const sig = [...new Set(candidate.key_basis || [])].sort().join("|");
  if (sig) {
    for (const p of previous.slice(-10)) {
      const ps = [...new Set(p.key_basis || [])].sort().join("|");
      if (ps && ps === sig) {
        issues.push("EVIDENCE_COMBO_REPEATED");
        break;
      }
    }
  }

  if ((candidate.life_scenes || []).length > 0) {
    const joined = (candidate.life_scenes || []).join(" ");
    for (const p of previous.slice(-10)) {
      if (p.life_scenes?.length && similarity(joined, p.life_scenes.join(" ")) > 0.55) {
        issues.push("LIFE_SCENE_REPEATED");
        break;
      }
    }
  }

  if (candidate.action_point) {
    for (const p of previous.slice(-10)) {
      if (p.action_point && similarity(candidate.action_point, p.action_point) > 0.62) {
        issues.push("ACTION_REPEATED");
        break;
      }
    }
  }

  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}
