import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import {
  collection, query, where, orderBy, limit,
  getDocs, Query, DocumentData
} from 'firebase/firestore';
import { collectExerciseSessions, MAX_TRAININGS_SCANNED } from '../../shared/session-scan';
import { resolveStudioFilter } from '../../shared/studio-filter';
import {
  bestSessionOneRM,
  sessionMaxHold,
  sessionMaxReps,
  sessionMaxWeight,
  sessionPace,
  sessionTotalDistance,
  sessionTotalDuration,
  sessionTotalHold,
  sessionTotalReps,
  sessionVolume,
} from '../utils/metrics';

export interface SessionProgress {
  trainingId: string;
  date: string;
  studioId: string;
  maxWeight: number;
  volume: number;
  best1RM: number | null;
  maxReps: number;
  totalReps: number;
  totalDuration: number; // minutes
  totalDistance: number; // km
  maxHold: number; // seconds (isometric)
  totalHold: number; // seconds (isometric)
  pace: number | null; // decimal min/km
  bestSet: { reps: number; weight: number } | null;
  allSets: Array<{ reps?: number; weight?: number; duration?: number; distance?: number; holdSeconds?: number }>;
}

/**
 * Fortschrittsdaten einer Übung. `enabled: false` überspringt das Laden — nötig, solange bei
 * einer studiogebundenen Übung das Studio noch nicht feststeht (sonst würde ungefiltert über
 * alle Studios geladen und der Verlauf mischte die Studios).
 */
export function useExerciseProgress(
  exerciseId: string,
  contextDependent: boolean,
  currentStudioId: string,
  enabled: boolean = true
) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db || !exerciseId || !enabled) return;

    // Gegen verspätete Antworten: Wechselt Übung oder Studio, während eine Query noch läuft,
    // darf deren Ergebnis den neueren Stand nicht überschreiben (Long-Polling ⇒ Reihenfolge
    // der Antworten ist nicht garantiert).
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { filterStudioId } = resolveStudioFilter(contextDependent, currentStudioId);
        const trainingsRef = collection(db, 'users', user.uid, 'trainings');
        let trainingsQuery: Query<DocumentData>;

        if (filterStudioId) {
          trainingsQuery = query(
            trainingsRef,
            where('status', '==', 'completed'),
            where('studioId', '==', filterStudioId),
            orderBy('date', 'desc'),
            limit(MAX_TRAININGS_SCANNED)
          );
        } else {
          trainingsQuery = query(
            trainingsRef,
            where('status', '==', 'completed'),
            orderBy('date', 'desc'),
            limit(MAX_TRAININGS_SCANNED)
          );
        }

        const trainingsSnap = await getDocs(trainingsQuery);

        // Rückwärts durch die Trainings, bis 20 Sessions DIESER Übung beisammen sind
        // (nicht: die ersten 20 Trainings durchsuchen) — siehe shared/session-scan.ts.
        const results = await collectExerciseSessions(
          trainingsSnap.docs,
          async (trainingDoc): Promise<SessionProgress | null> => {
            const training = trainingDoc.data();

            // Find the exercise in this training
            const exercisesRef = collection(
              db, 'users', user.uid, 'trainings', trainingDoc.id, 'exercises'
            );
            const exercisesSnap = await getDocs(
              query(exercisesRef, where('exerciseId', '==', exerciseId))
            );

            if (exercisesSnap.empty) return null;

            // Take first matching exercise instance
            const exerciseDoc = exercisesSnap.docs[0];

            // Load its sets
            const setsRef = collection(
              db, 'users', user.uid, 'trainings', trainingDoc.id,
              'exercises', exerciseDoc.id, 'sets'
            );
            const setsSnap = await getDocs(setsRef);
            const sets = setsSnap.docs.map(d => ({
              reps: d.data().reps as number | undefined,
              weight: d.data().weight as number | undefined,
              duration: d.data().duration as number | undefined,
              distance: d.data().distance as number | undefined,
              holdSeconds: d.data().holdSeconds as number | undefined,
            }));

            if (sets.length === 0) return null;

            const maxWeight = sessionMaxWeight(sets);
            const volume = sessionVolume(sets);
            const best1RM = bestSessionOneRM(sets);
            const maxReps = sessionMaxReps(sets);
            const totalReps = sessionTotalReps(sets);
            const totalDuration = sessionTotalDuration(sets);
            const totalDistance = sessionTotalDistance(sets);
            const pace = sessionPace(sets);
            const maxHold = sessionMaxHold(sets);
            const totalHold = sessionTotalHold(sets);

            // Best set: highest weight among completed sets
            const weightedSets = sets.filter(s => s.weight != null && s.reps != null);
            let bestSet: { reps: number; weight: number } | null = null;
            if (weightedSets.length > 0) {
              bestSet = weightedSets.reduce((best, s) => {
                return (s.weight! > best.weight!) ? s : best;
              }) as { reps: number; weight: number };
            }

            return {
              trainingId: trainingDoc.id,
              date: training.date as string,
              studioId: training.studioId as string,
              maxWeight,
              volume,
              best1RM,
              maxReps,
              totalReps,
              totalDuration,
              totalDistance,
              maxHold,
              totalHold,
              pace,
              bestSet,
              allSets: sets,
            };
          }
        );

        // Sort ascending by date for chart display
        results.sort((a, b) => a.date.localeCompare(b.date));
        if (!cancelled) setSessions(results);
      } catch (err) {
        console.error('useExerciseProgress error:', err);
        if (!cancelled) setError('Daten konnten nicht geladen werden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user, exerciseId, contextDependent, currentStudioId, enabled]);

  return { sessions, loading, error };
}
