// Kontextaufbau (Sandwich-Schicht A): aus geladenen Vergangenheits-Sessions die kuratierte
// TrainingState-Zusammenfassung bauen. Reine Funktionen (kein Firestore-IO) → offline testbar.
// Nutzt die geteilten Metriken aus shared/metrics.ts (Single Source, ADR-04).
import type { ExerciseContext, ExerciseType, GoalKey, RirLevel, TrainingState } from '../../../shared/ai-types';
import { bestSessionOneRM, sessionMaxWeight } from '../../../shared/metrics';

/** Eine vergangene (abgeschlossene) Session einer Übung. */
export interface PastSession {
  date: string; // YYYY-MM-DD
  studioId: string;
  sets: Array<{ reps?: number; weight?: number }>;
  rir?: RirLevel; // erfasste Anstrengung dieser Einheit (falls geloggt)
}

/** Eingabe pro Übung: Stammdaten + bereits geladene Sessions (studio-gefiltert wenn contextDependent). */
export interface ExerciseInput {
  exerciseId: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string;
  contextDependent: boolean;
  sessions: PastSession[];
}

/** Ganztägige Differenz zwischen zwei YYYY-MM-DD-Daten (a → b). */
function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function buildExerciseContext(input: ExerciseInput, referenceDate: string): ExerciseContext {
  const sessions = [...input.sessions].sort((a, b) => (a.date < b.date ? 1 : -1)); // desc nach Datum
  const last = sessions[0] ?? null;

  let best1RM: number | null = null;
  for (const s of sessions) {
    const rm = bestSessionOneRM(s.sets);
    if (rm != null && (best1RM === null || rm > best1RM)) best1RM = rm;
  }

  const trend = sessions
    .slice(0, 5)
    .reverse() // aufsteigend für die Anzeige
    .map((s) => ({
      date: s.date,
      best1RM: bestSessionOneRM(s.sets),
      maxWeight: sessionMaxWeight(s.sets),
    }));

  return {
    exerciseId: input.exerciseId,
    name: input.name,
    type: input.type,
    muscleGroup: input.muscleGroup,
    contextDependent: input.contextDependent,
    daysSinceLast: last ? daysBetween(last.date, referenceDate) : null,
    lastSession: last
      ? {
          sets: last.sets
            .filter((x) => x.reps != null)
            .map((x) => ({ reps: x.reps as number, weight: x.weight })),
        }
      : null,
    lastRir: last?.rir ?? null,
    best1RM,
    trend,
  };
}

export function buildTrainingState(args: {
  goal: GoalKey;
  date: string;
  studioId: string;
  bodyweightKg: number | null;
  exercises: ExerciseInput[];
}): TrainingState {
  return {
    goal: args.goal,
    date: args.date,
    studioId: args.studioId,
    bodyweightKg: args.bodyweightKg,
    exercises: args.exercises.map((e) => buildExerciseContext(e, args.date)),
  };
}
