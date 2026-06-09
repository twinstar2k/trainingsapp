// Deterministische Validierung + Guardrails nach dem LLM (Sandwich-Schicht C).
// Portiert aus eval/lib.mjs, typisiert. Diese Schicht garantiert Sicherheit/Verlässlichkeit
// unabhängig von der Modellqualität.
import type { RecommendationPayload, TrainingState } from '../../../shared/ai-types';

export const PROGRESSION_CAP_PCT = 0.1; // max. +10 % …
export const PROGRESSION_CAP_ABS_KG = 5; // … oder +5 kg ggü. letzter Einheit, je nachdem was kleiner ist
export const MIN_REPS = 1;
export const MAX_REPS = 30;

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0;

/** Hartes Strukturgate: prüft, ob die LLM-Ausgabe dem RecommendationPayload-Schema entspricht. */
export function validateStructure(p: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!p || typeof p !== 'object') return { valid: false, errors: ['payload ist kein Objekt'] };
  const payload = p as Record<string, unknown>;

  if (!isStr(payload.summary)) errors.push('summary fehlt/ungültig');
  if (!Array.isArray(payload.exercises) || payload.exercises.length === 0) {
    errors.push('exercises fehlt/leer');
    return { valid: false, errors };
  }
  payload.exercises.forEach((exUnknown, i) => {
    const ex = exUnknown as Record<string, unknown>;
    if (!isStr(ex?.exerciseId)) errors.push(`ex[${i}].exerciseId ungültig`);
    if (!isStr(ex?.rationale)) errors.push(`ex[${i}].rationale ungültig`);
    if (!isNum(ex?.restSeconds)) errors.push(`ex[${i}].restSeconds ungültig`);
    if (!Array.isArray(ex?.sets) || ex.sets.length === 0) {
      errors.push(`ex[${i}].sets fehlt/leer`);
    } else {
      ex.sets.forEach((sUnknown, j) => {
        const s = sUnknown as Record<string, unknown>;
        if (!isNum(s?.reps)) errors.push(`ex[${i}].sets[${j}].reps ungültig`);
        if (s?.weight != null && !isNum(s.weight)) errors.push(`ex[${i}].sets[${j}].weight ungültig`);
      });
    }
  });
  return { valid: errors.length === 0, errors };
}

export interface ClampInfo {
  exerciseId: string;
  recMaxWeight: number;
  capWeight: number;
  lastMaxWeight: number;
}

export interface GuardrailResult {
  clamps: ClampInfo[]; // Gewicht über Progressions-Cap → müsste geklammert werden
  violations: string[]; // harte Regelverstöße
  starters: string[]; // Übung ohne Historie → Startwert-Flag (kein Verstoß)
}

function maxWeightOf(sets: Array<{ weight?: number }>): number {
  let m = 0;
  for (const s of sets) if (typeof s.weight === 'number' && s.weight > m) m = s.weight;
  return m;
}

export function applyGuardrails(payload: RecommendationPayload, state: TrainingState): GuardrailResult {
  const byId = new Map(state.exercises.map((e) => [e.exerciseId, e]));
  const clamps: ClampInfo[] = [];
  const violations: string[] = [];
  const starters: string[] = [];

  for (const rec of payload.exercises) {
    const ctx = byId.get(rec.exerciseId);
    if (!ctx) {
      violations.push(`unknown_exercise:${rec.exerciseId}`);
      continue;
    }

    const reps = rec.sets.map((s) => s.reps);
    if (reps.some((r) => r < MIN_REPS || r > MAX_REPS)) violations.push(`reps_out_of_range:${rec.exerciseId}`);

    if (ctx.type === 'reps_only') {
      if (rec.sets.some((s) => s.weight != null)) violations.push(`weight_on_bodyweight:${rec.exerciseId}`);
      if (!ctx.lastSession) starters.push(rec.exerciseId);
      continue;
    }

    if (ctx.type === 'weighted') {
      if (rec.sets.some((s) => !(typeof s.weight === 'number' && s.weight > 0))) {
        violations.push(`weight_missing:${rec.exerciseId}`);
      }
      if (!ctx.lastSession) {
        starters.push(rec.exerciseId);
      } else {
        const lastMax = maxWeightOf(ctx.lastSession.sets);
        const recMax = maxWeightOf(rec.sets);
        const cap = lastMax + Math.min(lastMax * PROGRESSION_CAP_PCT, PROGRESSION_CAP_ABS_KG);
        if (lastMax > 0 && recMax > cap + 1e-6) {
          clamps.push({
            exerciseId: rec.exerciseId,
            recMaxWeight: recMax,
            capWeight: Math.round(cap * 10) / 10,
            lastMaxWeight: lastMax,
          });
        }
      }
    }
  }
  return { clamps, violations, starters };
}

/** Klammert Gewichte, die über dem Progressions-Cap liegen, herunter (sichere Auslieferung). */
export function clampPayload(payload: RecommendationPayload, result: GuardrailResult): RecommendationPayload {
  const capById = new Map(result.clamps.map((c) => [c.exerciseId, c.capWeight]));
  return {
    summary: payload.summary,
    exercises: payload.exercises.map((ex) => {
      const cap = capById.get(ex.exerciseId);
      if (cap == null) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s) => (typeof s.weight === 'number' && s.weight > cap ? { ...s, weight: cap } : s)),
      };
    }),
  };
}
