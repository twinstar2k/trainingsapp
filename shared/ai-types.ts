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

/**
 * Wiederholungen in Reserve (RIR) der letzten Einheit — grob, 3-stufig (pro Übung erfasst).
 * 2 = 2+ in Reserve · 1 = 1 in Reserve · 0 = bis zum Muskelversagen.
 */
export type RirLevel = 0 | 1 | 2;

/**
 * Eine vergangene Einheit als Trend-Punkt — verdichtet auf das, was der Policy-Kern für
 * Trend-/Plateau-Erkennung braucht (Stufe 1.5). Ascending nach Datum, letzte 3–5.
 */
export interface TrendPoint {
  date: string;
  best1RM: number | null; // Epley-Schätzung des besten Satzes (nur reps ≤ 15)
  maxWeight: number; // Arbeitsgewicht der Einheit (höchstes Satzgewicht)
  workingReps: number | null; // Wdh am Arbeitsgewicht (min über die Top-Sätze); reps_only: min Wdh
  rir: RirLevel | null; // erfasste Anstrengung dieser Einheit
}

/** Kuratierter Verlaufs-Kontext einer Übung — Input fürs LLM (klein gehalten). */
export interface ExerciseContext {
  exerciseId: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string;
  contextDependent: boolean;
  daysSinceLast: number | null;
  lastSession: { sets: Array<{ reps: number; weight?: number }> } | null;
  lastRir: RirLevel | null; // RIR der letzten Einheit — Signal für Autoregulation
  best1RM: number | null;
  trend: TrendPoint[]; // letzte 3–5 Einheiten (ascending), für Trend-/Plateau-Erkennung
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

/**
 * Aktion, die der deterministische Policy-Kern (Stufe 1.5) je Übung gewählt hat.
 * Siehe shared/policy.ts und docs/architecture/ai-coach-engine.md.
 */
export type PlanAction =
  | 'starter' // keine Historie — LLM schlägt konservativen Startwert vor
  | 'progress_load' // Range gefüllt + Reserve → Last hoch, Wdh zurück auf min
  | 'progress_reps' // Range nicht gefüllt → Last halten, Wdh Richtung max
  | 'hold' // Range gefüllt, aber kein Last-Sprung erlaubt (Versagen oder RIR fehlt)
  | 'deload' // Ziel deload → Last senken
  | 'maintain'; // Ziel maintenance / Fallback → wie zuletzt

/**
 * Leistungsrichtung über die letzten vergleichbaren Einheiten (Stufe 1.5, Trend-Schicht).
 * 'building' = noch zu wenige Exposures (< 3) für eine belastbare Aussage.
 */
export type ProgressDirection = 'up' | 'flat' | 'down' | 'building';

/** Verdichteter Trend einer Übung — vom Policy-Kern berechnet, fürs Coaching/Audit. */
export interface TrendSummary {
  direction: ProgressDirection;
  exposures: number; // Anzahl betrachteter vergleichbarer Einheiten
  stalledSessions: number; // jüngste Einheiten in Folge ohne neuen Bestwert
}

/** Ergebnis des Policy-Kerns je Übung (deterministisch berechnet). */
export interface ExercisePlan {
  exerciseId: string;
  action: PlanAction;
  reason: string; // Maschinen-Code, z.B. 'range_filled_reserve' / 'stall_fatigue' / 'ask_rir'
  repRange: [number, number] | null;
  increment: number; // kg-Schritt der Last-Erhöhung (0 wenn keine)
  sets: RecommendedSet[]; // berechnete Sätze ([] bei 'starter' → LLM füllt)
  trend?: TrendSummary; // Trend-/Plateau-Befund (Stufe 1.5)
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
