import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
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
        // Fetch studios first to map names
        const studiosRef = collection(db, 'users', user.uid, 'studios');
        const studioDocs = await getDocs(studiosRef);
        const studioMap: Record<string, string> = {};
        studioDocs.forEach(doc => {
          studioMap[doc.id] = doc.data().name;
        });

        // Fetch trainings
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
        <h2 className="text-2xl font-bold text-zinc-900">Training</h2>
        <Link 
          to="/trainings/new" 
          className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Lade Trainings...</div>
      ) : trainings.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center shadow-sm">
          <div className="bg-zinc-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">Keine Trainings</h3>
          <p className="text-zinc-500 text-sm mb-6">Starte dein erstes Training, um Fortschritte zu tracken.</p>
          <Link 
            to="/trainings/new" 
            className="inline-flex items-center justify-center bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
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
              className="block bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm hover:border-emerald-200 transition-colors relative overflow-hidden"
            >
              {training.status === 'active' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-900 text-lg mb-1">
                    {format(parseISO(training.date), 'EEEE, dd. MMM yyyy', { locale: de })}
                  </div>
                  <div className="flex items-center text-xs text-zinc-500 font-medium">
                    <MapPin className="w-3.5 h-3.5 mr-1" />
                    {training.studioName}
                    {training.status === 'active' && (
                      <span className="ml-3 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">Aktiv</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
