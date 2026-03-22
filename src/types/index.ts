export type ExerciseType = 'weighted' | 'reps_only' | 'cardio_basic';

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string;
  contextDependent: boolean;
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
  duration?: number; // in seconds
  distance?: number; // in km
  status: 'open' | 'done';
  order: number;
}

export interface TrainingExercise {
  id: string;
  exerciseId: string;
  order: number;
  status: 'open' | 'done';
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
}
