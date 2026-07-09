// Domänen- und Vertragstypen.
// Der KI-Empfehlungs-Vertrag (von App UND Cloud Function genutzt) liegt in shared/ai-types.ts
// und wird hier re-exportiert, damit bestehende Imports aus '@/types' unverändert funktionieren.
import type { ExerciseType, GoalKey, RirLevel } from '../../shared/ai-types';

export type {
  ExerciseType,
  GoalKey,
  RirLevel,
  ExerciseContext,
  TrendPoint,
  TrainingState,
  RecommendedSet,
  RecommendedExercise,
  RecommendationPayload,
  PlanAction,
  ProgressDirection,
  TrendSummary,
  ExercisePlan,
  Recommendation,
} from '../../shared/ai-types';

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string;
  contextDependent: boolean;
  repsProgression?: boolean; // weighted-Übung am Last-Limit → Progression nur über Wdh (kein Last-Sprung)
}

export interface Studio {
  id: string;
  name: string;
  createdAt: number;
}

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number;
}

export interface TrainingSet {
  id: string;
  reps?: number;
  weight?: number;
  duration?: number; // in minutes
  distance?: number; // in km
  holdSeconds?: number; // Haltezeit in Sekunden (isometric)
  status: 'open' | 'done';
  order: number;
}

export interface TrainingExercise {
  id: string;
  exerciseId: string;
  order: number;
  status: 'open' | 'done';
  restSeconds?: number; // Empfohlene/erfasste Pause pro Übung (z.B. aus KI-Empfehlung)
  rir?: RirLevel; // Anstrengung der Übung (Wiederholungen in Reserve) — Signal für Autoregulation
  sets?: TrainingSet[]; // Loaded separately or nested depending on view
}

// Subjektive Trainingsqualität: 1=Schwach, 2=Ok, 3=Stark, 4=Super.
export type TrainingRating = 1 | 2 | 3 | 4;

export interface Training {
  id: string;
  date: string; // YYYY-MM-DD
  studioId: string;
  templateId?: string;
  status: 'active' | 'completed';
  // Zeitpunkt des ERSTEN Abschlusses (epoch ms). Wird nur gesetzt, wenn noch leer —
  // bleibt also über Wieder-Öffnen/erneut-Abschließen stabil. Fehlt bei Altdaten.
  completedAt?: number;
  notes?: string;
  // Subjektive Trainingsqualität (1–4), beim Abschließen erfasst. Optional + reine
  // Selbsteinschätzung → nicht unter dem Edit-Lock, jederzeit nachträglich änderbar.
  rating?: TrainingRating;
}

export interface Template {
  id: string; // aus doc.id — NICHT als Feld gespeichert
  name: string;
  exerciseIds: string[]; // geordnete Liste von Katalog-Übungs-IDs (Reihenfolge = Array-Index)
  category?: string; // reservierter Platz für späteres Split-Label (Stufe 2), aktuell ungenutzt
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  birthday?: string;
  createdAt: number;
  trainingGoal?: GoalKey; // Standard-Trainingsziel, Default für KI-Empfehlungen
}
