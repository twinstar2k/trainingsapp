import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';

interface ExportedTrainingExercise {
  id: string;
  data: Record<string, unknown>;
  sets: Array<{ id: string; data: Record<string, unknown> }>;
}

interface ExportedTraining {
  id: string;
  data: Record<string, unknown>;
  exercises: ExportedTrainingExercise[];
}

export interface BackupPayload {
  schemaVersion: 1;
  exportedAt: string;
  uid: string;
  userProfile: Record<string, unknown> | null;
  studios: Array<{ id: string; data: Record<string, unknown> }>;
  weightHistory: Array<{ id: string; data: Record<string, unknown> }>;
  templates: Array<{ id: string; data: Record<string, unknown> }>;
  trainings: ExportedTraining[];
  exercisesCatalog: Array<{ id: string; data: Record<string, unknown> }>;
}

const dumpCollection = async (path: string[]) => {
  if (!db) return [];
  const ref = collection(db, path[0], ...path.slice(1));
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, data: d.data() }));
};

export async function exportAllUserData(uid: string): Promise<BackupPayload> {
  if (!db) throw new Error('Firestore not initialized');

  const userSnap = await getDoc(doc(db, 'users', uid));
  const userProfile = userSnap.exists() ? userSnap.data() : null;

  const [studios, weightHistory, templates, exercisesCatalog] = await Promise.all([
    dumpCollection(['users', uid, 'studios']),
    dumpCollection(['users', uid, 'weightHistory']),
    dumpCollection(['users', uid, 'templates']),
    dumpCollection(['exercises']),
  ]);

  // Trainings with nested exercises and sets
  const trainingsSnap = await getDocs(collection(db, 'users', uid, 'trainings'));
  const trainings: ExportedTraining[] = await Promise.all(
    trainingsSnap.docs.map(async trainingDoc => {
      const exercisesSnap = await getDocs(
        collection(db!, 'users', uid, 'trainings', trainingDoc.id, 'exercises')
      );
      const exercises: ExportedTrainingExercise[] = await Promise.all(
        exercisesSnap.docs.map(async exDoc => {
          const setsSnap = await getDocs(
            collection(
              db!, 'users', uid, 'trainings', trainingDoc.id, 'exercises', exDoc.id, 'sets'
            )
          );
          return {
            id: exDoc.id,
            data: exDoc.data(),
            sets: setsSnap.docs.map(s => ({ id: s.id, data: s.data() })),
          };
        })
      );
      return { id: trainingDoc.id, data: trainingDoc.data(), exercises };
    })
  );

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    uid,
    userProfile,
    studios,
    weightHistory,
    templates,
    trainings,
    exercisesCatalog,
  };
}

export function downloadBackup(payload: BackupPayload) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trainingsapp-backup-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
