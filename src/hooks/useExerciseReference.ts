import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import {
  collection, query, where, orderBy, limit, getDocs
} from 'firebase/firestore';
import { ExerciseType } from '../types';
import { collectExerciseSessions, MAX_TRAININGS_SCANNED } from '../../shared/session-scan';
import {
  SetData,
  formatLastSessionLabel,
  sessionVolume,
  sessionTotalReps,
  sessionTotalHold,
} from '../utils/metrics';

/** Beste Session der Referenzmetrik (Wert + Trainingsdatum YYYY-MM-DD). */
export interface BestSessionReference {
  value: number;
  date: string;
}

/**
 * Referenzmetrik einer Session je Übungstyp — die eine Kernzahl, gegen die live
 * verglichen wird: weighted → Volumen, isometric → Gesamt-Haltezeit, sonst Gesamt-Wdh.
 * cardio_basic liefert damit 0 und bleibt ohne Bestwert (bewusst ohne Live-Anzeige).
 */
export function referenceSessionMetric(sets: SetData[], type: ExerciseType): number {
  if (type === 'weighted') return sessionVolume(sets);
  if (type === 'isometric') return sessionTotalHold(sets);
  return sessionTotalReps(sets);
}

/**
 * Lädt in einem Durchlauf beides für eine Übung: das „Zuletzt"-Label der jüngsten
 * Session UND die Bestleistung (Referenzmetrik) über die letzten 20 Einheiten DIESER
 * Übung — dieselbe Datenbasis wie useExerciseProgress/„Bestes je".
 * `enabled: false` überspringt das Laden (z. B. in abgeschlossenen Trainings).
 */
export function useExerciseReference(
  exerciseId: string,
  exerciseType: ExerciseType,
  contextDependent: boolean,
  currentStudioId: string,
  enabled: boolean = true
) {
  const { user } = useAuth();
  const [label, setLabel] = useState<string | null>(null);
  const [best, setBest] = useState<BestSessionReference | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db || !exerciseId || !enabled) {
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
          limit(MAX_TRAININGS_SCANNED),
        ];
        if (contextDependent && currentStudioId) {
          constraints.splice(1, 0, where('studioId', '==', currentStudioId));
        }

        const trainingsSnap = await getDocs(query(trainingsRef, ...constraints));

        // Rückwärts durch die Trainings, bis 20 Sessions DIESER Übung beisammen sind
        // (nicht: die ersten 20 Trainings durchsuchen) — siehe shared/session-scan.ts.
        const found = await collectExerciseSessions(
          trainingsSnap.docs,
          async (trainingDoc): Promise<{ date: string; sets: SetData[] } | null> => {
            const exercisesRef = collection(
              db, 'users', user.uid, 'trainings', trainingDoc.id, 'exercises'
            );
            const exercisesSnap = await getDocs(
              query(exercisesRef, where('exerciseId', '==', exerciseId))
            );
            if (exercisesSnap.empty) return null;

            const setsRef = collection(
              db, 'users', user.uid, 'trainings', trainingDoc.id,
              'exercises', exercisesSnap.docs[0].id, 'sets'
            );
            const setsSnap = await getDocs(setsRef);
            if (setsSnap.empty) return null;

            const sets: SetData[] = setsSnap.docs.map(d => ({
              reps: d.data().reps as number | undefined,
              weight: d.data().weight as number | undefined,
              holdSeconds: d.data().holdSeconds as number | undefined,
            }));
            return { date: trainingDoc.data().date as string, sets };
          }
        );

        // Zuletzt-Label aus der jüngsten Session (Query-Reihenfolge = date desc)
        const latest = found[0] ?? null;
        const labelType =
          exerciseType === 'weighted' || exerciseType === 'isometric'
            ? exerciseType
            : 'reps_only';
        setLabel(latest ? formatLastSessionLabel(latest.sets, labelType) || null : null);

        // Bestleistung: Maximum der Referenzmetrik; bei Gleichstand gewinnt die jüngste
        let bestRef: BestSessionReference | null = null;
        for (const s of found) {
          const value = referenceSessionMetric(s.sets, exerciseType);
          if (value > 0 && (bestRef === null || value > bestRef.value)) {
            bestRef = { value, date: s.date };
          }
        }
        setBest(bestRef);
      } catch (err) {
        console.error('useExerciseReference error:', err);
        setLabel(null);
        setBest(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, exerciseId, exerciseType, contextDependent, currentStudioId, enabled]);

  return { label, best, loading };
}
