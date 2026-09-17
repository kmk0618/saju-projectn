import { calcSaju } from "./saju-engine";

const number = (value: unknown): number | null => value === "" || value == null || typeof value === "boolean" ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export function normalizeBirthInput(raw: any = {}) {
  const unknown = raw.unknown_time === true || raw.time_unknown === true || raw.unknown_time === "true";
  const gender = raw.gender || raw.g;
  return {
    year: number(raw.y ?? raw.year), month: number(raw.m ?? raw.month), day: number(raw.d ?? raw.day),
    hour: unknown ? null : number(raw.h ?? raw.hour), minute: unknown ? 0 : number(raw.mi ?? raw.minute ?? 0),
    time_unknown: unknown, gender: gender === "male" ? "남" : gender === "female" ? "여" : gender,
    calendar_type: raw.calendar_type || raw.calendar || raw.cal || "solar",
    longitude: number(raw.longitude ?? raw.region), region_name: raw.region_name || raw.regionName || raw.region_text || null,
    question: String(raw.question || "").trim(), category: String(raw.qcat || raw.category || "").trim(),
    target_year: number(raw.target_year),
  };
}

export function validateBirthInput(raw: any) {
  const input = normalizeBirthInput(raw);
  if (!input.time_unknown && input.hour === null) throw new Error("태어난 시간을 입력하거나 시간 미상을 선택해 주세요.");
  const calculation = calcSaju(input.year, input.month, input.day, input.hour, input.gender, input.calendar_type,
    input.minute, input.time_unknown ? null : input.longitude, !input.time_unknown, input.region_name);
  return { input, calculation };
}

export function sameBirthInput(a: any, b: any) {
  const pick = (raw: any) => {
    const n = normalizeBirthInput(raw);
    return [n.year,n.month,n.day,n.hour,n.minute,n.time_unknown,n.gender,n.calendar_type,n.longitude];
  };
  return JSON.stringify(pick(a)) === JSON.stringify(pick(b));
}

export async function assertOwnedReference(sb: any, table: "birth_profiles" | "questions", id: any, userId: string | null) {
  if (!id) return;
  if (!userId || typeof id !== "string") throw new Error("REFERENCE_NOT_OWNED");
  const { data, error } = await sb.from(table).select("id").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("REFERENCE_NOT_OWNED");
}
