import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { Studio } from '../types';

// Kapselt Laden + CRUD der Studios (users/{uid}/studios). Studios sind pro User.
// Zwei Nutzer: die Studio-Seite (Liste + Anlegen/Löschen) und der Profil-Hub, der nur
// die Anzahl für die Vorschauzeile braucht.
export function useStudios() {
  const { user } = useAuth();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;
    let cancelled = false;
    const fetchStudios = async () => {
      try {
        const ref = collection(db, 'users', user.uid, 'studios');
        const snap = await getDocs(query(ref, orderBy('createdAt', 'asc')));
        if (cancelled) return;
        const loaded: Studio[] = [];
        snap.forEach((d) => loaded.push({ id: d.id, ...d.data() } as Studio));
        setStudios(loaded);
      } catch (error) {
        console.error('Error fetching studios:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStudios();
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Legt ein Studio an. Gibt false zurück, wenn das Schreiben scheiterte. */
  const createStudio = async (name: string): Promise<boolean> => {
    if (!user || !db) return false;
    const data = { name: name.trim(), createdAt: Date.now() };
    try {
      const ref = collection(db, 'users', user.uid, 'studios');
      const docRef = await addDoc(ref, data);
      setStudios((prev) => [...prev, { id: docRef.id, ...data }]);
      return true;
    } catch (error) {
      console.error('Error creating studio:', error);
      return false;
    }
  };

  const deleteStudio = async (id: string): Promise<boolean> => {
    if (!user || !db) return false;
    const previous = studios;
    setStudios((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'studios', id));
      return true;
    } catch (error) {
      console.error('Error deleting studio:', error);
      setStudios(previous); // optimistische Änderung zurücknehmen
      return false;
    }
  };

  return { studios, loading, createStudio, deleteStudio };
}
