import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import app from './firebase';
import type {
  AppUser,
  Exercise,
  Studio,
  WeightEntry,
  Training,
  TrainingExercise,
  TrainingSet,
  Template,
} from '../types';

export const db = getFirestore(app);

// ─── Collection references ────────────────────────────────────────────────────

export const exercisesCol = () => collection(db, 'exercises');

export const userDoc = (uid: string) => doc(db, 'users', uid);

export const studiosCol = (uid: string) => collection(db, 'users', uid, 'studios');
export const studioDoc = (uid: string, studioId: string) =>
  doc(db, 'users', uid, 'studios', studioId);

export const weightHistoryCol = (uid: string) => collection(db, 'users', uid, 'weightHistory');
export const weightEntryDoc = (uid: string, entryId: string) =>
  doc(db, 'users', uid, 'weightHistory', entryId);

export const trainingsCol = (uid: string) => collection(db, 'users', uid, 'trainings');
export const trainingDoc = (uid: string, trainingId: string) =>
  doc(db, 'users', uid, 'trainings', trainingId);

export const trainingExercisesCol = (uid: string, trainingId: string) =>
  collection(db, 'users', uid, 'trainings', trainingId, 'exercises');
export const trainingExerciseDoc = (uid: string, trainingId: string, exerciseId: string) =>
  doc(db, 'users', uid, 'trainings', trainingId, 'exercises', exerciseId);

export const setsCol = (uid: string, trainingId: string, trainingExerciseId: string) =>
  collection(db, 'users', uid, 'trainings', trainingId, 'exercises', trainingExerciseId, 'sets');
export const setDoc_ = (
  uid: string,
  trainingId: string,
  trainingExerciseId: string,
  setId: string
) =>
  doc(
    db,
    'users',
    uid,
    'trainings',
    trainingId,
    'exercises',
    trainingExerciseId,
    'sets',
    setId
  );

export const templatesCol = (uid: string) => collection(db, 'users', uid, 'templates');
export const templateDoc = (uid: string, templateId: string) =>
  doc(db, 'users', uid, 'templates', templateId);

// ─── Generic helpers ─────────────────────────────────────────────────────────

function withId<T extends DocumentData>(id: string, data: T): T & { id: string } {
  return { id, ...data };
}

// ─── User ────────────────────────────────────────────────────────────────────

export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) return null;
  return withId(snap.id, snap.data()) as AppUser;
}

export async function setUser(uid: string, data: Omit<AppUser, 'uid' | 'createdAt'>): Promise<void> {
  await setDoc(userDoc(uid), { ...data, createdAt: serverTimestamp() }, { merge: true });
}

// ─── Exercises ───────────────────────────────────────────────────────────────

export async function getExercises(): Promise<Exercise[]> {
  const snap = await getDocs(query(exercisesCol(), orderBy('name')));
  return snap.docs.map((d) => withId(d.id, d.data()) as Exercise);
}

// ─── Studios ─────────────────────────────────────────────────────────────────

export async function getStudios(uid: string): Promise<Studio[]> {
  const snap = await getDocs(query(studiosCol(uid), orderBy('name')));
  return snap.docs.map((d) => withId(d.id, d.data()) as Studio);
}

export async function addStudio(uid: string, name: string): Promise<string> {
  const ref = await addDoc(studiosCol(uid), { name, createdAt: serverTimestamp() });
  return ref.id;
}

export async function deleteStudio(uid: string, studioId: string): Promise<void> {
  await deleteDoc(studioDoc(uid, studioId));
}

// ─── Weight History ───────────────────────────────────────────────────────────

export async function getWeightHistory(uid: string): Promise<WeightEntry[]> {
  const snap = await getDocs(query(weightHistoryCol(uid), orderBy('date', 'desc')));
  return snap.docs.map((d) => withId(d.id, d.data()) as WeightEntry);
}

export async function addWeightEntry(
  uid: string,
  data: Omit<WeightEntry, 'id'>
): Promise<string> {
  const ref = await addDoc(weightHistoryCol(uid), data);
  return ref.id;
}

// ─── Trainings ────────────────────────────────────────────────────────────────

export async function getTrainings(
  uid: string,
  ...constraints: QueryConstraint[]
): Promise<Training[]> {
  const snap = await getDocs(
    query(trainingsCol(uid), orderBy('date', 'desc'), ...constraints)
  );
  return snap.docs.map((d) => withId(d.id, d.data()) as Training);
}

export async function getTraining(uid: string, trainingId: string): Promise<Training | null> {
  const snap = await getDoc(trainingDoc(uid, trainingId));
  if (!snap.exists()) return null;
  return withId(snap.id, snap.data()) as Training;
}

export async function addTraining(uid: string, data: Omit<Training, 'id'>): Promise<string> {
  const ref = await addDoc(trainingsCol(uid), data);
  return ref.id;
}

export async function updateTraining(
  uid: string,
  trainingId: string,
  data: Partial<Omit<Training, 'id'>>
): Promise<void> {
  await updateDoc(trainingDoc(uid, trainingId), data as DocumentData);
}

// ─── Training Exercises ───────────────────────────────────────────────────────

export async function getTrainingExercises(
  uid: string,
  trainingId: string
): Promise<TrainingExercise[]> {
  const snap = await getDocs(
    query(trainingExercisesCol(uid, trainingId), orderBy('order'))
  );
  return snap.docs.map((d) => withId(d.id, d.data()) as TrainingExercise);
}

export async function addTrainingExercise(
  uid: string,
  trainingId: string,
  data: Omit<TrainingExercise, 'id'>
): Promise<string> {
  const ref = await addDoc(trainingExercisesCol(uid, trainingId), data);
  return ref.id;
}

export async function updateTrainingExercise(
  uid: string,
  trainingId: string,
  exerciseId: string,
  data: Partial<Omit<TrainingExercise, 'id'>>
): Promise<void> {
  await updateDoc(trainingExerciseDoc(uid, trainingId, exerciseId), data as DocumentData);
}

// ─── Sets ────────────────────────────────────────────────────────────────────

export async function getSets(
  uid: string,
  trainingId: string,
  trainingExerciseId: string
): Promise<TrainingSet[]> {
  const snap = await getDocs(
    query(setsCol(uid, trainingId, trainingExerciseId), orderBy('order'))
  );
  return snap.docs.map((d) => withId(d.id, d.data()) as TrainingSet);
}

export async function addSet(
  uid: string,
  trainingId: string,
  trainingExerciseId: string,
  data: Omit<TrainingSet, 'id'>
): Promise<string> {
  const ref = await addDoc(setsCol(uid, trainingId, trainingExerciseId), data);
  return ref.id;
}

export async function updateSet(
  uid: string,
  trainingId: string,
  trainingExerciseId: string,
  setId: string,
  data: Partial<Omit<TrainingSet, 'id'>>
): Promise<void> {
  await updateDoc(setDoc_(uid, trainingId, trainingExerciseId, setId), data as DocumentData);
}

export async function deleteSet(
  uid: string,
  trainingId: string,
  trainingExerciseId: string,
  setId: string
): Promise<void> {
  await deleteDoc(setDoc_(uid, trainingId, trainingExerciseId, setId));
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(uid: string): Promise<Template[]> {
  const snap = await getDocs(query(templatesCol(uid), orderBy('name')));
  return snap.docs.map((d) => withId(d.id, d.data()) as Template);
}

export async function addTemplate(uid: string, data: Omit<Template, 'id'>): Promise<string> {
  const ref = await addDoc(templatesCol(uid), data);
  return ref.id;
}

export async function updateTemplate(
  uid: string,
  templateId: string,
  data: Partial<Omit<Template, 'id'>>
): Promise<void> {
  await updateDoc(templateDoc(uid, templateId), data as DocumentData);
}

export async function deleteTemplate(uid: string, templateId: string): Promise<void> {
  await deleteDoc(templateDoc(uid, templateId));
}

// ─── Re-exports for convenience ───────────────────────────────────────────────

export { where, orderBy, serverTimestamp };
