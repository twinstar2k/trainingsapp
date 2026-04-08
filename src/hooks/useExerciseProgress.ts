import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import {
  collection, query, where, orderBy, limit,
  getDocs, Query, DocumentData
} from 'firebase/firestore';
import { bestSessionOneRM, sessionMaxReps, sessionMaxWeight, sessionTotalReps, sessionVolume } from '../utils/metrics';

export interface SessionProgress {
  trainingId: string;
  date: string;
  studioId: string;
  maxWeight: number;
  volume: number;
  best1RM: number | null;
  maxReps: number;
  totalReps: number;
  bestSet: { reps: number; weight: number } | null;
  allSets: Array<{ reps?: number; weight?: number }>;
}

export function useExerciseProgress(
  exerciseId: string,
  contextDependent: boolean,
  currentStudioId: string
) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db || !exerciseId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const trainingsRef = collection(db, 'users', user.uid, 'trainings');
        let trainingsQuery: Query<DocumentData>;

        if (contextDependent && currentStudioId) {
          trainingsQuery = query(
            trainingsRef,
            where('status', '==', 'completed'),
            where('studioId', '==', currentStudioId),
            orderBy('date', 'desc'),
            limit(20)
          );
        } else {
          trainingsQuery = query(
            trainingsRef,
            where('status', '==', 'completed'),
            orderBy('date', 'desc'),
            limit(20)
          );
        }

        const trainingsSnap = await getDocs(trainingsQuery);
        const results: SessionProgress[] = [];

        await Promise.all(
          trainingsSnap.docs.map(async (trainingDoc) => {
            const training = trainingDoc.data();

            // Find the exercise in this training
            const exercisesRef = collection(
              db, 'users', user.uid, 'trainings', trainingDoc.id, 'exercises'
            );
            const exercisesSnap = await getDocs(
              query(exercisesRef, where('exerciseId', '==', exerciseId))
            );

            if (exercisesSnap.empty) return;

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
            }));

            if (sets.length === 0) return;

            const maxWeight = sessionMaxWeight(sets);
            const volume = sessionVolume(sets);
            const best1RM = bestSessionOneRM(sets);
            const maxReps = sessionMaxReps(sets);
            const totalReps = sessionTotalReps(sets);

            // Best set: highest weight among completed sets
            const weightedSets = sets.filter(s => s.weight != null && s.reps != null);
            let bestSet: { reps: number; weight: number } | null = null;
            if (weightedSets.length > 0) {
              bestSet = weightedSets.reduce((best, s) => {
                return (s.weight! > best.weight!) ? s : best;
              }) as { reps: number; weight: number };
            }

            results.push({
              trainingId: trainingDoc.id,
              date: training.date as string,
              studioId: training.studioId as string,
              maxWeight,
              volume,
              best1RM,
              maxReps,
              totalReps,
              bestSet,
              allSets: sets,
            });
          })
        );

        // Sort ascending by date for chart display
        results.sort((a, b) => a.date.localeCompare(b.date));
        setSessions(results);
      } catch (err) {
        console.error('useExerciseProgress error:', err);
        setError('Daten konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, exerciseId, contextDependent, currentStudioId]);

  return { sessions, loading, error };
}
