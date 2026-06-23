import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, writeBatch } from 'firebase/firestore';
import { Studio } from '../types';
import { useTemplates } from '../hooks/useTemplates';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, MapPin, Calendar, ClipboardList } from 'lucide-react';

export default function NewTraining() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [studioId, setStudioId] = useState('');
  const [templateId, setTemplateId] = useState(''); // '' = ohne Vorlage
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { templates } = useTemplates();

  useEffect(() => {
    if (!user || !db) return;

    const fetchStudios = async () => {
      try {
        const studiosRef = collection(db, 'users', user.uid, 'studios');
        const snapshot = await getDocs(studiosRef);
        const loadedStudios: Studio[] = [];
        snapshot.forEach(doc => {
          loadedStudios.push({ id: doc.id, ...doc.data() } as Studio);
        });
        setStudios(loadedStudios.sort((a, b) => a.createdAt - b.createdAt));
        if (loadedStudios.length > 0) setStudioId(loadedStudios[0].id);
      } catch (error) {
        console.error("Error fetching studios:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudios();
  }, [user]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !studioId || !date) return;

    setIsSubmitting(true);
    try {
      const template = templateId ? templates.find((t) => t.id === templateId) : undefined;

      const trainingsRef = collection(db, 'users', user.uid, 'trainings');
      const docRef = await addDoc(trainingsRef, {
        date,
        studioId,
        status: 'active',
        createdAt: Date.now(),
        ...(template ? { templateId: template.id } : {}),
      });

      // Vorlage anwenden: Übungen als Skelett anlegen (keine Sätze) — gleiches Schema
      // wie addExercise, hier gebündelt als Batch. Gewicht/Wdh kommen später aus Historie + Coach.
      if (template && template.exerciseIds.length > 0) {
        const batch = writeBatch(db);
        const exercisesRef = collection(db, 'users', user.uid, 'trainings', docRef.id, 'exercises');
        template.exerciseIds.forEach((exerciseId, order) => {
          batch.set(doc(exercisesRef), { exerciseId, order, status: 'open' });
        });
        await batch.commit();
      }

      navigate(`/trainings/${docRef.id}`);
    } catch (error) {
      console.error("Error creating training:", error);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-on-surface-variant">Lade...</div>;
  }

  if (studios.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">Neues Training</h2>
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center">
          <h3 className="text-amber-800 font-semibold mb-2">Kein Studio vorhanden</h3>
          <p className="text-amber-700 text-sm mb-4">Du musst zuerst ein Studio in deinem Profil anlegen.</p>
          <button
            onClick={() => navigate('/profile')}
            className="bg-amber-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-amber-700 transition-colors"
          >
            Zum Profil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">Neues Training</h2>

      <form onSubmit={handleStart} className="space-y-6">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-sm space-y-4">

          <div>
            <label className="flex items-center text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              <Calendar className="w-4 h-4 mr-2 text-outline" />
              Datum
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-14 bg-surface-container-low ring-1 ring-outline-variant/30 rounded-2xl px-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
              required
            />
          </div>

          <div>
            <label className="flex items-center text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              <MapPin className="w-4 h-4 mr-2 text-outline" />
              Studio
            </label>
            <select
              value={studioId}
              onChange={(e) => setStudioId(e.target.value)}
              className="w-full h-14 bg-surface-container-low ring-1 ring-outline-variant/30 rounded-2xl px-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150 appearance-none"
              required
            >
              {studios.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="flex items-center text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                <ClipboardList className="w-4 h-4 mr-2 text-outline" />
                Vorlage (optional)
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full h-14 bg-surface-container-low ring-1 ring-outline-variant/30 rounded-2xl px-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150 appearance-none"
              >
                <option value="">Ohne Vorlage</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-14 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all duration-150 active:scale-[0.97] flex items-center justify-center disabled:opacity-70"
        >
          <Dumbbell className="w-5 h-5 mr-2" />
          {isSubmitting ? 'Startet...' : 'Training starten'}
        </button>
      </form>
    </div>
  );
}
