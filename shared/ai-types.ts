/**
 * Gemeinsame Vertragstypen für die KI-Trainingsempfehlung — Single Source (ADR-04).
 * Genutzt von der App (src/types/index.ts re-exportiert sie) UND vom Functions-Backend
 * (functions/src importiert direkt). Siehe docs/architecture/ai-recommendation.md §2.
 */

export type ExerciseType = 'weighted' | 'reps_only' | 'cardio_basic';

/** Trainingsziel — steuert Rep-Range und Progressions-Charakter der Empfehlung. */
export type GoalKey =
  | 'progression'
  | 'hypertrophy'
  | 'strength'
  | 'endurance'
  | 'maintenance'
  | 'deload';

/** Kuratierter Verlaufs-Kontext einer Übung — Input fürs LLM (klein gehalten). */
export interface ExerciseContext {
  exerciseId: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string;
  contextDependent: boolean;
  daysSinceLast: number | null;
  lastSession: { sets: Array<{ reps: number; weight?: number }> } | null;
  best1RM: number | null;
  trend: Array<{ date: string; best1RM: number | null; maxWeight: number }>; // letzte 3–5
}

/** Gesamter Trainingszustand, den das LLM als Kontext erhält. */
export interface TrainingState {
  goal: GoalKey;
  date: string; // YYYY-MM-DD
  studioId: string;
  bodyweightKg: number | null;
  exercises: ExerciseContext[];
}

/** Ein vom LLM empfohlener Satz (weight nur bei type=weighted). */
export interface RecommendedSet {
  reps: number;
  weight?: number;
}

/** Empfehlung für eine einzelne Übung. */
export interface RecommendedExercise {
  exerciseId: string; // MUSS aus der angefragten Liste stammen
  rationale: string;
  restSeconds: number;
  sets: RecommendedSet[];
}

/** Validierte Gesamt-Empfehlung (Rückgabe der Cloud Function). */
export interface RecommendationPayload {
  summary: string;
  exercises: RecommendedExercise[];
}

/** Persistiertes Empfehlungs-Dokument (users/{uid}/recommendations) — Audit/Eval/Transparenz. */
export interface Recommendation {
  id: string;
  createdAt: number;
  goal: GoalKey;
  studioId: string;
  date: string; // Zieldatum des Trainings
  model: string; // verwendetes LLM-Modell
  inputDigest: TrainingState; // was dem LLM gezeigt wurde
  output: RecommendationPayload; // validierte Empfehlung
  flags: string[]; // z.B. ["clamped:exId", "starter:exId"]
  status: 'proposed' | 'accepted' | 'discarded';
}
