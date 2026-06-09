/**
 * Deterministischer Policy-Kern der KI-Coach-Engine (Stufe 1.5).
 *
 * "Code = Systematik": Hier wird entschieden, OB und WIE VIEL Progression stattfindet —
 * reine Funktionen, keine IO, offline testbar. Das LLM (Schicht C) erklärt das Ergebnis
 * nur noch in Coach-Sprache, es rechnet nicht mehr.
 *
 * Zwei Schichten:
 *  1) Innerhalb der Einheit: Double Progression + RIR-Gate (Trigger pro letzter Session).
 *  2) Über mehrere Einheiten: Trend-/Plateau-Erkennung (3–5 Exposures) — annotiert die
 *     Entscheidung bzw. greift bei echtem Stillstand ein.
 *
 * Single Source für App + Functions (ADR-04). Spiegel in eval/lib.mjs (Eval ist zero-dep JS).
 * Entscheidungen siehe docs/architecture/ai-coach-engine.md §3–§5 und
 * docs/architecture/progressionsstrategien-krafttraining.md.
 */
import type {
  ExerciseContext, ExercisePlan, GoalKey, RecommendedSet, TrendPoint, TrendSummary,
} from './ai-types';

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

// Trend-/Plateau-Schicht: mind. so viele vergleichbare Einheiten für eine belastbare Aussage.
const TREND_WINDOW = 3;
// Float-Toleranz auf dem Progress-Index (Gewichtsschritte sind ≫ als diese Schwelle).
const TREND_EPSILON = 0.5;

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

function repeatSets(count: number, set: RecommendedSet): RecommendedSet[] {
  return Array.from({ length: count }, () => ({ ...set }));
}

function makePlan(
  ex: ExerciseContext,
  action: ExercisePlan['action'],
  reason: string,
  sets: RecommendedSet[],
  repRange: [number, number] | null,
  increment: number,
  trend: TrendSummary,
): ExercisePlan {
  return { exerciseId: ex.exerciseId, action, reason, repRange, increment, sets, trend };
}

// ─── Trend-Schicht (über mehrere Einheiten) ────────────────────────────────────────

/**
 * Monotone Leistungs-Kennzahl je Einheit. Bewusst NICHT Epley-e1RM: der würde nach einer
 * Last-Erhöhung mit Wdh-Reset (12→8) kurz FALLEN und einen gesunden Double-Progression-Zyklus
 * als „Plateau" lesen. Stattdessen: Arbeitsgewicht dominiert (×100 ≫ Wdh-Bereich), Wdh als
 * Tiebreak → steigt bei JEDER echten Steigerung (Last ODER Wdh), robust gegen den Sägezahn.
 */
function progressIndex(p: TrendPoint): number {
  return (p.maxWeight ?? 0) * 100 + (p.workingReps ?? 0);
}

/** Leistungsrichtung + „seit wann flach" aus den letzten Exposures (ascending). */
export function computeTrend(series: TrendPoint[]): TrendSummary {
  const n = series.length;
  if (n < TREND_WINDOW) return { direction: 'building', exposures: n, stalledSessions: 0 };

  const scores = series.map(progressIndex);

  // Richtung über das jüngste Fenster.
  const window = scores.slice(-TREND_WINDOW);
  const first = window[0];
  const last = window[window.length - 1];
  const direction = last > first + TREND_EPSILON ? 'up'
    : last < first - TREND_EPSILON ? 'down'
      : 'flat';

  // „Seit wann kein neuer Bestwert" über die gesamte Serie.
  let peak = -Infinity;
  let lastPeakIdx = 0;
  scores.forEach((s, i) => {
    if (s > peak + TREND_EPSILON) { peak = s; lastPeakIdx = i; }
  });
  const stalledSessions = (n - 1) - lastPeakIdx;

  return { direction, exposures: n, stalledSessions };
}

/**
 * Anstrengungs-Klassifikation der jüngsten Einheiten (für die Plateau-Reaktion):
 *  - 'fatigue' : irgendwo bis Versagen (RIR 0) trainiert, trotzdem flach → Ermüdung
 *  - 'sandbag' : noch Reserve (RIR ≥ 1), trotzdem flach → Reiz zu niedrig
 *  - 'unknown' : kein RIR erfasst → nicht entscheidbar
 */
function classifyEffort(series: TrendPoint[]): 'fatigue' | 'sandbag' | 'unknown' {
  const window = series.slice(-TREND_WINDOW);
  const rirs = window.map((p) => p.rir);
  if (rirs.some((r) => r === 0)) return 'fatigue';
  if (rirs.some((r) => r != null && r >= 1)) return 'sandbag';
  return 'unknown';
}

/**
 * Plateau-Reaktion: greift NUR bei echtem Stillstand (Richtung flach/ab über ≥ TREND_WINDOW).
 * Ändert die Zahlen ausschließlich im Ermüdungsfall (nicht weiter pushen); sonst nur den
 * Reason-Code (→ Coach-Sprache). Soft, kein Auto-Deload — der Nutzer entscheidet.
 */
function applyStall(plan: ExercisePlan, series: TrendPoint[], heldSets: RecommendedSet[]): ExercisePlan {
  const t = plan.trend;
  const isStall = !!t && (t.direction === 'flat' || t.direction === 'down') && t.exposures >= TREND_WINDOW;
  if (!isStall) return plan;

  const effort = classifyEffort(series);
  if (effort === 'fatigue') {
    // Halten statt weiter pushen + Hinweis auf leichtere Woche (nur Hinweis).
    return { ...plan, action: 'hold', reason: 'stall_fatigue', sets: heldSets };
  }
  if (effort === 'sandbag') {
    // Reserve vorhanden, aber flach → die Wdh wirklich an den oberen Rand bringen.
    return { ...plan, reason: 'stall_push' };
  }
  // Kein RIR → bitten zu loggen, damit Ermüdung von Luft-nach-oben unterscheidbar wird.
  return { ...plan, reason: 'stall_no_rir' };
}

// ─── Innerhalb der Einheit (Double Progression + RIR-Gate) + Trend ─────────────────

/**
 * Berechnet den Trainingsplan einer Übung aus Verlauf + Ziel (deterministisch).
 *
 * Entscheidungsbaum (weighted, mit Historie):
 *  - Range gefüllt (alle Top-Sätze ≥ max Wdh) + RIR ≥ 1  → progress_load (Last hoch, Wdh→min)
 *  - Range gefüllt + RIR = 0                             → hold (Versagen; ggf. stall_fatigue)
 *  - Range gefüllt + RIR fehlt                           → hold (no_rir; 2× in Folge → ask_rir)
 *  - Range nicht gefüllt                                 → progress_reps (Last halten, Wdh +1)
 * Darüber legt sich die Trend-Schicht: bei echtem Plateau (≥3 Exposures flach) greift
 * applyStall ein. Ohne Historie → 'starter'.
 */
export function computeExercisePlan(ex: ExerciseContext, goal: GoalKey): ExercisePlan {
  const range = REP_RANGES[goal];
  const last = ex.lastSession;
  const series = ex.trend ?? [];
  const trend = computeTrend(series);

  // 1) Keine Historie → Starter (LLM füllt einen konservativen Startwert).
  if (!last || last.sets.length === 0) {
    return makePlan(ex, 'starter', 'no_history', [], range, 0, trend);
  }

  const setCount = last.sets.length || DEFAULT_SET_COUNT;

  // 2) reps_only (Körpergewicht): keine Last — Progression über Wiederholungen.
  if (ex.type === 'reps_only') {
    const minReps = Math.min(...last.sets.map((s) => s.reps));
    const plan = makePlan(
      ex, 'progress_reps', 'reps_only_progress', repeatSets(setCount, { reps: minReps + 1 }), range, 0, trend,
    );
    return applyStall(plan, series, repeatSets(setCount, { reps: minReps }));
  }

  // 3) weighted: Arbeits-(Top-)Gewicht der letzten Einheit bestimmen.
  const workingWeight = Math.max(...last.sets.map((s) => s.weight ?? 0));
  if (workingWeight <= 0) {
    // Defensive: gewichtete Übung ohne Gewicht in der Historie → halten.
    const reps = Math.min(...last.sets.map((s) => s.reps));
    return makePlan(ex, 'maintain', 'no_weight', repeatSets(setCount, { reps }), range, 0, trend);
  }

  // Nur die Sätze am Arbeitsgewicht zählen für den Progressions-Trigger.
  const minRepsAtWorking = Math.min(
    ...last.sets.filter((s) => (s.weight ?? 0) >= workingWeight).map((s) => s.reps),
  );

  // Ziel deload: Last bewusst senken.
  if (goal === 'deload') {
    const w = roundWeight(workingWeight * DELOAD_FACTOR);
    return makePlan(ex, 'deload', 'goal_deload', repeatSets(setCount, { reps: minRepsAtWorking, weight: w }), range, 0, trend);
  }

  // Ziel maintenance (oder kein fester Range): wie zuletzt.
  if (range === null) {
    return makePlan(
      ex, 'maintain', 'goal_maintenance',
      repeatSets(setCount, { reps: minRepsAtWorking, weight: workingWeight }), range, 0, trend,
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
        ex, 'progress_load', 'range_filled_reserve',
        repeatSets(setCount, { reps: min, weight: newWeight }), range,
        roundWeight(newWeight - workingWeight), trend,
      );
    }
    if (ex.lastRir === 0) {
      // Bis Versagen → halten/konsolidieren (Plateau-Schicht kann zu stall_fatigue eskalieren).
      const held = repeatSets(setCount, { reps: max, weight: workingWeight });
      return applyStall(makePlan(ex, 'hold', 'failure', held, range, 0, trend), series, held);
    }
    // RIR fehlt: Last NICHT springen lassen. Beim 2.-Mal-in-Folge oberen Rand ohne RIR
    // aktiv nach der Reserve fragen (ask_rir), sonst sanfter Hinweis (no_rir).
    const prior = series[series.length - 2];
    const priorFilledNoRir = prior != null && prior.rir == null && (prior.workingReps ?? 0) >= max;
    const reason = priorFilledNoRir ? 'ask_rir' : 'no_rir';
    return makePlan(ex, 'hold', reason, repeatSets(setCount, { reps: max, weight: workingWeight }), range, 0, trend);
  }

  // progress_reps: Range nicht gefüllt → Last halten, eine Wdh mehr anpeilen (im Range).
  const target = Math.min(Math.max(minRepsAtWorking + 1, min), max);
  const plan = makePlan(
    ex, 'progress_reps', 'range_not_filled',
    repeatSets(setCount, { reps: target, weight: workingWeight }), range, 0, trend,
  );
  // Bei Plateau: Ermüdung → halten (kein +1); sonst nur Reason-Code (Coach-Sprache).
  return applyStall(plan, series, repeatSets(setCount, { reps: minRepsAtWorking, weight: workingWeight }));
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
    case 'ask_rir':
      return `Oberen Wdh-Bereich erneut ohne RIR erreicht — trag die Reserve deines härtesten Satzes ein, dann gebe ich die Last frei. Bis dahin gehalten: ${scheme}.`;
    case 'stall_fatigue':
      return `Seit mehreren Einheiten kein Fortschritt trotz hoher Anstrengung — diese Woche halten; eine leichtere Woche würde den nächsten Sprung freimachen. Ziel: ${scheme}.`;
    case 'stall_push':
      return `Seit mehreren Einheiten flach, aber noch Reserve im Tank — die Wiederholungen müssen wirklich an den oberen Rand: ${scheme}.`;
    case 'stall_no_rir':
      return `Seit mehreren Einheiten flach — logge deinen RIR, damit ich Ermüdung von Luft-nach-oben unterscheiden kann. Ziel: ${scheme}.`;
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
