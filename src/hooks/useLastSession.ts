import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import {
  collection, query, where, orderBy, limit, getDocs
} from 'firebase/firestore';
import { ExerciseType } from '../types';
import { formatLastSessionLabel } from '../utils/metrics';

export function useLastSession(
  exerciseId: string,
  exerciseType: ExerciseType,
  contextDependent: boolean,
  currentStudioId: string
) {
  const { user } = useAuth();
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db || !exerciseId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const trainingsRef = collection(db, 'users', user.uid, 'trainings');
        const constraints = [
          where('status', '==', 'completed'),
          orderBy('date', 'desc'),
          limit(10),
        ];
        if (contextDependent && currentStudioId) {
          constraints.splice(1, 0, where('studioId', '==', currentStudioId));
        }

        const trainingsSnap = await getDocs(query(trainingsRef, ...constraints));

        for (const trainingDoc of trainingsSnap.docs) {
          const exercisesRef = collection(
            db, 'users', user.uid, 'trainings', trainingDoc.id, 'exercises'
          );
          const exercisesSnap = await getDocs(
            query(exercisesRef, where('exerciseId', '==', exerciseId))
          );

          if (exercisesSnap.empty) continue;

          const exerciseDoc = exercisesSnap.docs[0];
          const setsRef = collection(
            db, 'users', user.uid, 'trainings', trainingDoc.id,
            'exercises', exerciseDoc.id, 'sets'
          );
          const setsSnap = await getDocs(setsRef);
          const sets = setsSnap.docs.map(d => ({
            reps: d.data().reps as number | undefined,
            weight: d.data().weight as number | undefined,
          }));

          if (sets.length === 0) continue;

          const type = exerciseType === 'weighted' ? 'weighted' : 'reps_only';
          const formatted = formatLastSessionLabel(sets, type);
          setLabel(formatted || null);
          return;
        }

        setLabel(null);
      } catch (err) {
        console.error('useLastSession error:', err);
        setLabel(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, exerciseId, exerciseType, contextDependent, currentStudioId]);

  return { label, loading };
}
