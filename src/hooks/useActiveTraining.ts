import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { Training } from '../types';

// Lauscht in Echtzeit auf das neueste aktive Training.
// onSnapshot statt getDocs: AppLayout bleibt über Navigationen gemountet —
// ein Einmal-Fetch würde nach Anlegen/Abschließen eines Trainings veralten.
export function useActiveTraining() {
  const { user } = useAuth();
  const [activeTraining, setActiveTraining] = useState<Training | null>(null);

  useEffect(() => {
    if (!user) return;
    const ref = collection(db, 'users', user.uid, 'trainings');
    const q = query(ref, where('status', '==', 'active'), orderBy('date', 'desc'), limit(1));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const d = snap.docs[0];
        setActiveTraining(d ? ({ id: d.id, ...d.data() } as Training) : null);
      },
      (error) => {
        console.error('Error watching active training:', error);
        setActiveTraining(null);
      }
    );
    return () => unsubscribe();
  }, [user]);

  return { activeTraining };
}
