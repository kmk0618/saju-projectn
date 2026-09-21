import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { normalizeBirthInput, sameBirthInput } from "./birth-input";

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}

export function calculationRevision(input: any, calculation: any) {
  const birth: any = normalizeBirthInput(input);
  delete birth.question;
  delete birth.category;
  delete birth.target_year;
  return "manse-v3-deterministic:" + createHash("sha256").update(JSON.stringify(canonical({ birth, calculation }))).digest("hex").slice(0, 24);
}

// A changed input/engine result gets a new immutable row. Reports that reference
// an older calculation keep it; concurrent identical requests share one revision.
export async function ensureCalculationSnapshot(sb: any, userId: string | null, profileId: string, input: any, calculation: any) {
  const version = calculationRevision(input, calculation);
  const policy = input.time_unknown ? "none" : "longitude+equation_of_time";
  const read = () => sb.from("saju_calculations").select("id,calculation_json,input_json,engine_version")
    .eq("birth_profile_id", profileId).eq("engine_version", version).eq("correction_policy", policy).maybeSingle();
  const validate = (row: any) => {
    if (!row || !sameBirthInput(row.input_json, input) || !isDeepStrictEqual(row.calculation_json, calculation)) throw new Error("CALC_SNAPSHOT_MISMATCH");
    return row;
  };
  const prior = await read();
  if (prior.error) throw new Error("CALC_LOOKUP_FAILED:" + prior.error.message);
  if (prior.data) return validate(prior.data);
  const result = await sb.from("saju_calculations").insert({ user_id:userId, birth_profile_id:profileId,
    engine_version:version, input_json:input, calculation_json:calculation,
    raw_time_candidate_json:calculation.raw_time_candidate || null, correction_policy:policy,
  }).select("id,calculation_json,input_json,engine_version").single();
  if (!result.error) return validate(result.data);
  if (result.error.code !== "23505") throw new Error("CALC_CREATE_FAILED:" + result.error.message);
  const concurrent = await read();
  if (concurrent.error) throw new Error("CALC_LOOKUP_FAILED:" + concurrent.error.message);
  return validate(concurrent.data);
}
