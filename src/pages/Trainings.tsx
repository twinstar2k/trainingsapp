import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Training, Studio } from '../types';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Plus, Calendar, MapPin, ChevronRight } from 'lucide-react';

export default function Trainings() {
  const { user } = useAuth();
  const [trainings, setTrainings] = useState<(Training & { studioName?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;

    const fetchTrainings = async () => {
      try {
        const studiosRef = collection(db, 'users', user.uid, 'studios');
        const studioDocs = await getDocs(studiosRef);
        const studioMap: Record<string, string> = {};
        studioDocs.forEach(doc => { studioMap[doc.id] = doc.data().name; });

        const trainingsRef = collection(db, 'users', user.uid, 'trainings');
        const q = query(trainingsRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);

        const loadedTrainings: (Training & { studioName?: string })[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Training;
          loadedTrainings.push({
            id: doc.id,
            ...data,
            studioName: studioMap[data.studioId] || 'Unbekanntes Studio'
          });
        });
        setTrainings(loadedTrainings);
      } catch (error) {
        console.error("Error fetching trainings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrainings();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">Training</h2>
        <Link
          to="/trainings/new"
          className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all duration-150 active:scale-90"
        >
          <Plus className="w-5 h-5" />
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant">Lade Trainings...</div>
      ) : trainings.length === 0 ? (
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center shadow-sm">
          <div className="bg-surface-container-low w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-outline" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface mb-2">Keine Trainings</h3>
          <p className="text-on-surface-variant text-sm mb-6">Starte dein erstes Training, um Fortschritte zu tracken.</p>
          <Link
            to="/trainings/new"
            className="inline-flex items-center justify-center h-14 bg-primary text-on-primary px-6 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all duration-150 active:scale-[0.97]"
          >
            Neues Training
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {trainings.map(training => (
            <Link
              key={training.id}
              to={`/trainings/${training.id}`}
              className="block bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm hover:border-primary/20 hover:shadow-sm transition-all duration-150 active:scale-[0.98] relative overflow-hidden"
            >
              {training.status === 'active' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-on-surface text-base mb-1">
                    {format(parseISO(training.date), 'EEEE, dd. MMM yyyy', { locale: de })}
                  </div>
                  <div className="flex items-center text-xs text-on-surface-variant font-medium">
                    <MapPin className="w-3.5 h-3.5 mr-1" />
                    {training.studioName}
                    {training.status === 'active' && (
                      <span className="ml-3 px-2 py-0.5 bg-primary/10 text-primary rounded-md font-semibold">Aktiv</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-outline" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
