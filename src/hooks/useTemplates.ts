import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { Template } from '../types';

// Kapselt Laden + CRUD der Trainings-Vorlagen (users/{uid}/templates).
// Vorlagen sind Skelette: nur eine geordnete Übungsliste (exerciseIds), keine Sätze.
// Updates optimistisch; die ID kommt aus doc.id und wird nie als Feld gespeichert.
export function useTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;
    const fetchTemplates = async () => {
      try {
        const ref = collection(db, 'users', user.uid, 'templates');
        const snap = await getDocs(query(ref, orderBy('createdAt', 'asc')));
        const loaded: Template[] = [];
        snap.forEach((d) => loaded.push({ id: d.id, ...d.data() } as Template));
        setTemplates(loaded);
      } catch (error) {
        console.error('Error fetching templates:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [user]);

  // Neue Vorlage anlegen. Gibt die neue ID zurück (null bei Fehler).
  const createTemplate = async (name: string, exerciseIds: string[]): Promise<string | null> => {
    if (!user || !db) return null;
    const data = { name, exerciseIds, createdAt: Date.now() };
    try {
      const ref = collection(db, 'users', user.uid, 'templates');
      const docRef = await addDoc(ref, data);
      setTemplates((prev) => [...prev, { id: docRef.id, ...data }]);
      return docRef.id;
    } catch (error) {
      console.error('Error creating template:', error);
      return null;
    }
  };

  const renameTemplate = async (id: string, name: string) => {
    if (!user || !db) return;
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    try {
      await updateDoc(doc(db, 'users', user.uid, 'templates', id), { name });
    } catch (error) {
      console.error('Error renaming template:', error);
    }
  };

  // Übungsliste einer Vorlage ersetzen (Hinzufügen/Entfernen/Ordnen laufen alle hierüber).
  const updateExercises = async (id: string, exerciseIds: string[]) => {
    if (!user || !db) return;
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, exerciseIds } : t)));
    try {
      await updateDoc(doc(db, 'users', user.uid, 'templates', id), { exerciseIds });
    } catch (error) {
      console.error('Error updating template exercises:', error);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!user || !db) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'templates', id));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  return { templates, loading, createTemplate, renameTemplate, updateExercises, deleteTemplate };
}
