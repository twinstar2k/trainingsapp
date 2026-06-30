import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  getCountFromServer,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { Training, TrainingExercise, TrainingSet, Exercise, RecommendationPayload, RirLevel, TrainingRating } from '../types';

// Eine Übung der laufenden Session: Trainings-Dokument, angereichert um Katalogdaten + geladene Sätze.
export type SessionExercise = TrainingExercise & { details: Exercise; sets: TrainingSet[] };

// Kapselt Laden + alle Firestore-Mutationen eines Trainings (Übungen, Sätze, RIR, Status).
// Alle Funktionen adressieren über Dokument-IDs (nicht Array-Indizes); Updates optimistisch wie zuvor.
export function useTrainingSession(trainingId: string | undefined) {
  const { user } = useAuth();

  const [training, setTraining] = useState<Training | null>(null);
  const [studioName, setStudioName] = useState('');
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !db || !trainingId) return;

    const fetchTrainingData = async () => {
      try {
        const trainingRef = doc(db, 'users', user.uid, 'trainings', trainingId);
        const trainingSnap = await getDoc(trainingRef);
        if (!trainingSnap.exists()) {
          setNotFound(true);
          return;
        }

        const tData = { id: trainingSnap.id, ...trainingSnap.data() } as Training;
        setTraining(tData);

        if (tData.studioId) {
          const studioSnap = await getDoc(doc(db, 'users', user.uid, 'studios', tData.studioId));
          if (studioSnap.exists()) setStudioName(studioSnap.data().name);
        }

        const catalogRef = collection(db, 'exercises');
        const catalogSnap = await getDocs(catalogRef);
        const catalogData: Exercise[] = [];
        catalogSnap.forEach(doc => catalogData.push({ id: doc.id, ...doc.data() } as Exercise));
        setCatalog(catalogData);

        const exercisesRef = collection(db, 'users', user.uid, 'trainings', trainingId, 'exercises');
        const qExercises = query(exercisesRef, orderBy('order', 'asc'));
        const exercisesSnap = await getDocs(qExercises);

        const loadedExercises: SessionExercise[] = [];
        for (const exDoc of exercisesSnap.docs) {
          const exData = { id: exDoc.id, ...exDoc.data() } as TrainingExercise;
          const details = catalogData.find(e => e.id === exData.exerciseId);
          if (details) {
            const setsRef = collection(db, 'users', user.uid, 'trainings', trainingId, 'exercises', exDoc.id, 'sets');
            const qSets = query(setsRef, orderBy('order', 'asc'));
            const setsSnap = await getDocs(qSets);
            const sets: TrainingSet[] = [];
            setsSnap.forEach(sDoc => sets.push({ id: sDoc.id, ...sDoc.data() } as TrainingSet));
            loadedExercises.push({ ...exData, details, sets });
          }
        }
        setExercises(loadedExercises);
      } catch (error) {
        console.error("Error fetching training details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrainingData();
  }, [user, trainingId]);

  // Übung aus dem Katalog anhängen. true = erfolgreich (Aufrufer darf z.B. das Modal schließen).
  const addExercise = async (catalogExerciseId: string): Promise<boolean> => {
    if (!user || !db || !trainingId) return false;
    try {
      const exercisesRef = collection(db, 'users', user.uid, 'trainings', trainingId, 'exercises');
      const newOrder = exercises.length > 0 ? Math.max(...exercises.map(e => e.order)) + 1 : 0;
      const docRef = await addDoc(exercisesRef, { exerciseId: catalogExerciseId, order: newOrder, status: 'open' });
      const details = catalog.find(e => e.id === catalogExerciseId);
      if (details) {
        setExercises([...exercises, { id: docRef.id, exerciseId: catalogExerciseId, order: newOrder, status: 'open', details, sets: [] }]);
      }
      return true;
    } catch (error) {
      console.error("Error adding exercise:", error);
      return false;
    }
  };

  const deleteExercise = async (trainingExerciseId: string) => {
    if (!user || !db || !trainingId) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'trainings', trainingId, 'exercises', trainingExerciseId));
      setExercises(exercises.filter(e => e.id !== trainingExerciseId));
    } catch (error) {
      console.error("Error deleting exercise:", error);
    }
  };

  // Neuen Satz anhängen: Werte vom letzten Satz übernehmen, sonst Defaults je Übungstyp.
  const addSet = async (trainingExerciseId: string) => {
    if (!user || !db || !trainingId) return;
    const exIndex = exercises.findIndex(e => e.id === trainingExerciseId);
    if (exIndex < 0) return;
    const exercise = exercises[exIndex];
    const setsRef = collection(db, 'users', user.uid, 'trainings', trainingId, 'exercises', trainingExerciseId, 'sets');
    const newOrder = exercise.sets.length > 0 ? Math.max(...exercise.sets.map(s => s.order)) + 1 : 0;

    const newSetData: Partial<TrainingSet> = { order: newOrder, status: 'open' };
    if (exercise.sets.length > 0) {
      const lastSet = exercise.sets[exercise.sets.length - 1];
      if (lastSet.reps !== undefined) newSetData.reps = lastSet.reps;
      if (lastSet.weight !== undefined) newSetData.weight = lastSet.weight;
      if (lastSet.duration !== undefined) newSetData.duration = lastSet.duration;
      if (lastSet.distance !== undefined) newSetData.distance = lastSet.distance;
    } else {
      if (exercise.details.type === 'weighted') { newSetData.reps = 10; newSetData.weight = 0; }
      else if (exercise.details.type === 'reps_only') { newSetData.reps = 10; }
      else if (exercise.details.type === 'cardio_basic') { newSetData.duration = 15; newSetData.distance = 0; }
    }

    try {
      const docRef = await addDoc(setsRef, newSetData);
      const updatedExercises = [...exercises];
      updatedExercises[exIndex] = {
        ...updatedExercises[exIndex],
        sets: [...updatedExercises[exIndex].sets, { id: docRef.id, ...newSetData } as TrainingSet]
      };
      setExercises(updatedExercises);
    } catch (error) {
      console.error("Error adding set:", error);
    }
  };

  const updateSet = async <K extends keyof TrainingSet>(trainingExerciseId: string, setId: string, field: K, value: TrainingSet[K]) => {
    if (!user || !db || !trainingId) return;
    const exIndex = exercises.findIndex(e => e.id === trainingExerciseId);
    if (exIndex < 0) return;
    const setIndex = exercises[exIndex].sets.findIndex(s => s.id === setId);
    if (setIndex < 0) return;

    const updatedExercises = [...exercises];
    const updatedSets = [...updatedExercises[exIndex].sets];
    updatedSets[setIndex] = { ...updatedSets[setIndex], [field]: value };
    updatedExercises[exIndex] = { ...updatedExercises[exIndex], sets: updatedSets };
    setExercises(updatedExercises);

    try {
      const setRef = doc(db, 'users', user.uid, 'trainings', trainingId, 'exercises', trainingExerciseId, 'sets', setId);
      await updateDoc(setRef, { [field]: value });
    } catch (error) {
      console.error("Error updating set:", error);
    }
  };

  const deleteSet = async (trainingExerciseId: string, setId: string) => {
    if (!user || !db || !trainingId) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'trainings', trainingId, 'exercises', trainingExerciseId, 'sets', setId));
      const exIndex = exercises.findIndex(e => e.id === trainingExerciseId);
      if (exIndex < 0) return;
      const updatedExercises = [...exercises];
      updatedExercises[exIndex] = {
        ...updatedExercises[exIndex],
        sets: updatedExercises[exIndex].sets.filter(s => s.id !== setId)
      };
      setExercises(updatedExercises);
    } catch (error) {
      console.error("Error deleting set:", error);
    }
  };

  const toggleSetStatus = async (trainingExerciseId: string, setId: string) => {
    const exercise = exercises.find(e => e.id === trainingExerciseId);
    const set = exercise?.sets.find(s => s.id === setId);
    if (!set) return;
    await updateSet(trainingExerciseId, setId, 'status', set.status === 'open' ? 'done' : 'open');
  };

  // Reserve (RIR) der Übung erfassen — pro Übung ein Wert, optional. Speist die KI-Autoregulation.
  const setRir = async (trainingExerciseId: string, rir: RirLevel) => {
    if (!user || !db || !trainingId) return;
    const exIndex = exercises.findIndex(e => e.id === trainingExerciseId);
    if (exIndex < 0) return;
    const updated = [...exercises];
    updated[exIndex] = { ...updated[exIndex], rir };
    setExercises(updated);
    try {
      const exRef = doc(db, 'users', user.uid, 'trainings', trainingId, 'exercises', trainingExerciseId);
      await updateDoc(exRef, { rir });
    } catch (error) {
      console.error('Error updating RIR:', error);
    }
  };

  // Abschließen/Wiedereröffnen. Gibt den neuen Status zurück (null bei Fehler) —
  // die Celebration-UI dazu gehört der Seite, nicht dem Daten-Hook.
  const toggleTrainingStatus = async (): Promise<'active' | 'completed' | null> => {
    if (!user || !db || !trainingId || !training) return null;
    const newStatus = training.status === 'active' ? 'completed' : 'active';
    // completedAt nur beim ERSTEN Abschluss stempeln (wenn noch leer) — bleibt über
    // Wieder-Öffnen/erneut-Abschließen stabil und markiert den echten Erst-Abschluss.
    const stampCompletedAt = newStatus === 'completed' && training.completedAt == null;
    try {
      const update: { status: 'active' | 'completed'; completedAt?: number } = { status: newStatus };
      if (stampCompletedAt) update.completedAt = Date.now();
      await updateDoc(doc(db, 'users', user.uid, 'trainings', trainingId), update);
      setTraining({ ...training, ...update });
      return newStatus;
    } catch (error) {
      console.error("Error updating training status:", error);
      return null;
    }
  };

  // Subjektive Trainingsbewertung (1–4) setzen. Optimistisch; reine Selbsteinschätzung,
  // daher auch bei abgeschlossenen Trainings erlaubt (kein Edit-Lock).
  const setRating = async (rating: TrainingRating) => {
    if (!user || !db || !trainingId || !training) return;
    setTraining({ ...training, rating });
    try {
      await updateDoc(doc(db, 'users', user.uid, 'trainings', trainingId), { rating });
    } catch (error) {
      console.error('Error updating training rating:', error);
    }
  };

  // Anzahl abgeschlossener Trainings (für die Celebration-Nummer). null bei Fehler.
  const countCompletedTrainings = async (): Promise<number | null> => {
    if (!user || !db) return null;
    try {
      const completedQ = query(
        collection(db, 'users', user.uid, 'trainings'),
        where('status', '==', 'completed'),
      );
      const snap = await getCountFromServer(completedQ);
      return snap.data().count;
    } catch {
      return null;
    }
  };

  // true = gelöscht (Aufrufer navigiert weg).
  const deleteTraining = async (): Promise<boolean> => {
    if (!user || !db || !trainingId) return false;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'trainings', trainingId));
      return true;
    } catch (error) {
      console.error("Error deleting training:", error);
      return false;
    }
  };

  // Übernimmt eine (ggf. angepasste) KI-Empfehlung: hängt die vorgeschlagenen Sätze an die
  // jeweiligen Übungen an (bestehender addDoc-Pfad) und setzt die empfohlene Pause.
  const applyRecommendation = async (payload: RecommendationPayload) => {
    if (!user || !db || !trainingId) return;
    const updated = [...exercises];
    for (const rec of payload.exercises) {
      const exIndex = updated.findIndex((e) => e.exerciseId === rec.exerciseId);
      if (exIndex < 0) continue;
      const ex = updated[exIndex];
      const setsRef = collection(db, 'users', user.uid, 'trainings', trainingId, 'exercises', ex.id, 'sets');
      let order = ex.sets.length > 0 ? Math.max(...ex.sets.map((s) => s.order)) + 1 : 0;
      const created: TrainingSet[] = [];
      for (const rs of rec.sets) {
        const setData: Partial<TrainingSet> = { order: order++, status: 'open', reps: rs.reps };
        if (ex.details.type === 'weighted' && rs.weight != null) setData.weight = rs.weight;
        const docRef = await addDoc(setsRef, setData);
        created.push({ id: docRef.id, ...setData } as TrainingSet);
      }
      if (rec.restSeconds != null) {
        await updateDoc(doc(db, 'users', user.uid, 'trainings', trainingId, 'exercises', ex.id), {
          restSeconds: rec.restSeconds,
        });
      }
      updated[exIndex] = { ...ex, restSeconds: rec.restSeconds, sets: [...ex.sets, ...created] };
    }
    setExercises(updated);
  };

  return {
    training,
    studioName,
    exercises,
    catalog,
    loading,
    notFound,
    addExercise,
    deleteExercise,
    addSet,
    updateSet,
    deleteSet,
    toggleSetStatus,
    setRir,
    toggleTrainingStatus,
    setRating,
    countCompletedTrainings,
    deleteTraining,
    applyRecommendation,
  };
}
