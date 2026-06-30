import type { TrainingRating } from '../types';

// Labels + Skala der subjektiven Trainingsbewertung (1–4). Eigene Nicht-Komponenten-Datei,
// damit Komponenten (TrainingRating.tsx) sie teilen können, ohne die Fast-Refresh-Regel
// (only-export-components) zu verletzen. Analog zu lib/goals.ts.
export const RATING_LABELS: Record<TrainingRating, string> = {
  1: 'Schwach',
  2: 'Ok',
  3: 'Stark',
  4: 'Super',
};

export const RATING_VALUES: TrainingRating[] = [1, 2, 3, 4];

/** Durchschnitt einer Bewertungs-Serie (null bei leer). */
export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}
