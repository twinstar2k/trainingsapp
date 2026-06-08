/**
 * Deterministischer Policy-Kern der KI-Coach-Engine (Stufe 1.5).
 *
 * "Code = Systematik": Hier wird entschieden, OB und WIE VIEL Progression stattfindet —
 * reine Funktionen, keine IO, offline testbar. Das LLM (Schicht C) erklärt das Ergebnis
 * nur noch in Coach-Sprache, es rechnet nicht mehr.
 *
 * Single Source für App + Functions (ADR-04). Spiegel in eval/lib.mjs (Eval ist zero-dep JS).
 * Entscheidungen siehe docs/architecture/ai-coach-engine.md §3–§5.
 */
import type { ExerciseContext, ExercisePlan, GoalKey, RecommendedSet } from './ai-types';

/** Ziel-Wiederholungsbereiche [min,max]. null = kein fester Bereich (maintenance/deload). */
export const REP_RANGES: Record<GoalKey, [number, number] | null> = {
  progression: [8, 12],
  hypertrophy: [8, 12],
  strength: [4, 6],
  endurance: [15, 20],
  maintenance: null,
  deload: null,
};

const UPPER_INCREMENT_KG = 2.5;
const LOWER_INCREMENT_KG = 5;

// Sicherheits-Cap (aus Stufe 1): nie mehr als das Kleinere von +10 % oder +5 kg.
const PROGRESSION_CAP_PCT = 0.1;
const PROGRESSION_CAP_ABS_KG = 5;

const DEFAULT_SET_COUNT = 3;
const DELOAD_FACTOR = 0.85; // −15 % Last

/** Unterkörper an der Muskelgruppe erkennen — einzige Unterkörper-Gruppe im Katalog: "Beine". */
export function isLowerBody(muscleGroup: string): boolean {
  return /bein/i.test(muscleGroup);
}

/** Last-Schrittweite nach Körperregion (Oberkörper +2,5 kg / Unterkörper +5 kg). */
export function incrementForMuscleGroup(muscleGroup: string): number {
  return isLowerBody(muscleGroup) ? LOWER_INCREMENT_KG : UPPER_INCREMENT_KG;
}

/** Auf 0,5 kg runden (Hantel-/Maschinen-tauglich). */
function roundWeight(kg: number): number {
  return Math.round(kg * 2) / 2;
}

/** Erhöhte Last, gedeckelt durch das Sicherheits-Cap. */
function cappedWeight(current: number, increment: number): number {
  const capped = Math.min(
    current + increment,
    current * (1 + PROGRESSION_CAP_PCT),
    current + PROGRESSION_CAP_ABS_KG,
  );
  return roundWeight(capped);
}

function makePlan(
  ex: ExerciseContext,
  action: ExercisePlan['action'],
  reason: string,
  sets: RecommendedSet[],
  repRange: [number, number] | null,
  increment = 0,
): ExercisePlan {
  return { exerciseId: ex.exerciseId, action, reason, repRange, increment, sets };
}

function repeatSets(count: number, set: RecommendedSet): RecommendedSet[] {
  return Array.from({ length: count }, () => ({ ...set }));
}

/**
 * Berechnet den Trainingsplan einer Übung aus Verlauf + Ziel (deterministisch).
 *
 * Entscheidungsbaum (weighted, mit Historie):
 *  - Range gefüllt (alle Top-Sätze ≥ max Wdh) + RIR ≥ 1  → progress_load (Last hoch, Wdh→min)
 *  - Range gefüllt + RIR = 0 oder RIR fehlt              → hold (kein Last-Sprung)
 *  - Range nicht gefüllt                                 → progress_reps (Last halten, Wdh +1)
 * Ohne Historie → 'starter' (leere Sätze; das LLM schlägt einen konservativen Startwert vor).
 */
export function computeExercisePlan(ex: ExerciseContext, goal: GoalKey): ExercisePlan {
  const range = REP_RANGES[goal];
  const last = ex.lastSession;

  // 1) Keine Historie → Starter (LLM füllt einen konservativen Startwert).
  if (!last || last.sets.length === 0) {
    return makePlan(ex, 'starter', 'no_history', [], range);
  }

  const setCount = last.sets.length || DEFAULT_SET_COUNT;

  // 2) reps_only (Körpergewicht): keine Last — Progression über Wiederholungen.
  if (ex.type === 'reps_only') {
    const minReps = Math.min(...last.sets.map((s) => s.reps));
    return makePlan(ex, 'progress_reps', 'reps_only_progress', repeatSets(setCount, { reps: minReps + 1 }), range);
  }

  // 3) weighted: Arbeits-(Top-)Gewicht der letzten Einheit bestimmen.
  const workingWeight = Math.max(...last.sets.map((s) => s.weight ?? 0));
  if (workingWeight <= 0) {
    // Defensive: gewichtete Übung ohne Gewicht in der Historie → halten.
    const reps = Math.min(...last.sets.map((s) => s.reps));
    return makePlan(ex, 'maintain', 'no_weight', repeatSets(setCount, { reps }), range);
  }

  // Nur die Sätze am Arbeitsgewicht zählen für den Progressions-Trigger.
  const minRepsAtWorking = Math.min(
    ...last.sets.filter((s) => (s.weight ?? 0) >= workingWeight).map((s) => s.reps),
  );

  // Ziel deload: Last bewusst senken.
  if (goal === 'deload') {
    const w = roundWeight(workingWeight * DELOAD_FACTOR);
    return makePlan(ex, 'deload', 'goal_deload', repeatSets(setCount, { reps: minRepsAtWorking, weight: w }), range);
  }

  // Ziel maintenance (oder kein fester Range): wie zuletzt.
  if (range === null) {
    return makePlan(
      ex,
      'maintain',
      'goal_maintenance',
      repeatSets(setCount, { reps: minRepsAtWorking, weight: workingWeight }),
      range,
    );
  }

  const [min, max] = range;
  const rangeFilled = minRepsAtWorking >= max;

  if (rangeFilled) {
    const hasReserve = ex.lastRir != null && ex.lastRir >= 1;
    if (hasReserve) {
      // progress_load: Last hoch (region-abhängig, gedeckelt), Wdh zurück auf den unteren Rand.
      const newWeight = cappedWeight(workingWeight, incrementForMuscleGroup(ex.muscleGroup));
      return makePlan(
        ex,
        'progress_load',
        'range_filled_reserve',
        repeatSets(setCount, { reps: min, weight: newWeight }),
        range,
        roundWeight(newWeight - workingWeight),
      );
    }
    // Range gefüllt, aber kein Last-Sprung: am Versagen ODER kein RIR erfasst → halten.
    const reason = ex.lastRir === 0 ? 'failure' : 'no_rir';
    return makePlan(ex, 'hold', reason, repeatSets(setCount, { reps: max, weight: workingWeight }), range);
  }

  // progress_reps: Range nicht gefüllt → Last halten, eine Wdh mehr anpeilen (im Range).
  const target = Math.min(Math.max(minRepsAtWorking + 1, min), max);
  return makePlan(ex, 'progress_reps', 'range_not_filled', repeatSets(setCount, { reps: target, weight: workingWeight }), range);
}

/**
 * Kurze, rein faktische Begründung (Deutsch) zu einem Plan — ohne Anstrengungs-Behauptung.
 * Dient als Hinweis fürs LLM (Schicht C) UND als deterministischer Fallback, wenn kein LLM
 * verfügbar ist (graceful degradation).
 */
export function describePlan(plan: ExercisePlan): string {
  const top = plan.sets[0];
  const reps = top?.reps;
  const w = top?.weight;
  const n = plan.sets.length;
  const scheme = w != null ? `${n}×${reps} @ ${w} kg` : `${n}×${reps} Wdh`;
  switch (plan.reason) {
    case 'range_filled_reserve':
      return `Oberen Wdh-Bereich mit Reserve erreicht — Last +${plan.increment} kg, Wdh zurück auf ${reps}. Ziel: ${scheme}.`;
    case 'range_not_filled':
      return `Oberen Wdh-Bereich noch nicht erreicht — Gewicht halten, eine Wdh mehr anpeilen: ${scheme}.`;
    case 'failure':
      return `Letzte Einheit bis ans Limit — Gewicht halten und konsolidieren: ${scheme}.`;
    case 'no_rir':
      return `Kein RIR erfasst — Gewicht gehalten. Logge die Anstrengung, um die Last freizugeben. Ziel: ${scheme}.`;
    case 'goal_deload':
      return `Deload — Last bewusst gesenkt: ${scheme}.`;
    case 'goal_maintenance':
      return `Halten — wie zuletzt: ${scheme}.`;
    case 'reps_only_progress':
      return `Körpergewicht — eine Wiederholung mehr anpeilen: ${scheme}.`;
    case 'no_history':
      return 'Noch keine Historie — vorsichtig mit moderatem Startwert herantasten.';
    default:
      return scheme;
  }
}
