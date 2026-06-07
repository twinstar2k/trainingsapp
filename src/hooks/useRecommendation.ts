import { useCallback, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import type { GoalKey, RecommendationPayload } from '../types';

export interface RecommendationRequest {
  studioId: string;
  date: string; // YYYY-MM-DD
  goal: GoalKey;
  exerciseIds: string[];
  model?: string;
}

export interface RecommendationResult {
  recommendationId: string;
  payload: RecommendationPayload;
  flags: string[];
  model: string;
}

/** Kapselt den Aufruf der Callable getTrainingRecommendation (europe-west3). */
export function useRecommendation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendation = useCallback(
    async (req: RecommendationRequest): Promise<RecommendationResult> => {
      if (!functions) throw new Error('Funktionen sind nicht verfügbar (Firebase nicht konfiguriert).');
      setLoading(true);
      setError(null);
      try {
        const callable = httpsCallable<RecommendationRequest, RecommendationResult>(
          functions,
          'getTrainingRecommendation',
        );
        const res = await callable(req);
        return res.data;
      } catch (e) {
        const msg =
          (e as { message?: string })?.message || 'Die Empfehlung konnte nicht erstellt werden.';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { getRecommendation, loading, error };
}
