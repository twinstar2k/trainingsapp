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

export interface Training {
  id: string;
  date: string; // YYYY-MM-DD
  studioId: string;
  templateId?: string;
  status: 'active' | 'completed';
  notes?: string;
}

export interface Template {
  id: string;
  name: string;
  exercises: string[]; // Array of exercise IDs
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  birthday?: string;
  createdAt: number;
  trainingGoal?: GoalKey; // Standard-Trainingsziel, Default für KI-Empfehlungen
}
