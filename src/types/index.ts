import { Timestamp } from 'firebase/firestore';

// --- User ---

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  birthday?: string; // ISO date string, e.g. "1990-05-15"
  createdAt: Timestamp;
}

// --- Exercise (global catalog) ---

export type ExerciseType = 'strength_weighted' | 'strength_reps_only' | 'cardio_basic';

export type MuscleGroup =
  | 'Brust'
  | 'Rücken'
  | 'Schultern'
  | 'Beine'
  | 'Bizeps'
  | 'Trizeps'
  | 'Core'
  | 'Trapez'
  | 'Brust/Trizeps'
  | 'Schultern/Rücken'
  | 'Cardio';

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroup: MuscleGroup;
  contextDependent: boolean; // true = Maschinen/Seilzüge (studio-bound), false = global
}

// --- Studio ---

export interface Studio {
  id: string;
  name: string;
  createdAt: Timestamp;
}

// --- Weight History ---

export interface WeightEntry {
  id: string;
  date: string; // ISO date string, e.g. "2024-03-15"
  weight: number; // in kg
}

// --- Training ---

export type TrainingStatus = 'in_progress' | 'completed';

export interface Training {
  id: string;
  date: string; // ISO date string
  studioId: string;
  templateId?: string;
  status: TrainingStatus;
  notes?: string;
}

// --- Training Exercise (subcollection under training) ---

export type ExerciseStatus = 'pending' | 'completed' | 'skipped';

export interface TrainingExercise {
  id: string;
  exerciseId: string;
  order: number;
  status: ExerciseStatus;
}

// --- Set (subcollection under training exercise) ---

export type SetStatus = 'pending' | 'completed';

export interface TrainingSet {
  id: string;
  order: number;
  status: SetStatus;
  // strength_weighted
  reps?: number;
  weight?: number; // in kg
  // cardio_basic
  duration?: number; // in seconds
  distance?: number; // in meters
}

// --- Template ---

export interface TemplateExercise {
  exerciseId: string;
  order: number;
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: Timestamp;
}
