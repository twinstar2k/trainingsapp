import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Training, WeightEntry } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Activity, Dumbbell, Scale, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const [recentTrainings, setRecentTrainings] = useState<Training[]>([]);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;

    const fetchData = async () => {
      try {
        // Fetch recent trainings
        const trainingsRef = collection(db, 'users', user.uid, 'trainings');
        const qTrainings = query(trainingsRef, orderBy('date', 'desc'), limit(3));
        const trainingDocs = await getDocs(qTrainings);
        
        const trainings: Training[] = [];
        trainingDocs.forEach(doc => {
          trainings.push({ id: doc.id, ...doc.data() } as Training);
        });
        setRecentTrainings(trainings);

        // Fetch latest weight
        const weightRef = collection(db, 'users', user.uid, 'weightHistory');
        const qWeight = query(weightRef, orderBy('date', 'desc'), limit(1));
        const weightDocs = await getDocs(qWeight);
        
        if (!weightDocs.empty) {
          const doc = weightDocs.docs[0];
          setLatestWeight({ id: doc.id, ...doc.data() } as WeightEntry);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-12 text-zinc-500">Lade Dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">Hallo {user?.displayName?.split(' ')[0] || 'Athlet'}!</h2>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col">
          <div className="flex items-center text-zinc-500 mb-2">
            <Scale className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium uppercase tracking-wider">Gewicht</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-zinc-900">{latestWeight ? latestWeight.weight : '--'}</span>
            <span className="text-sm text-zinc-500 ml-1">kg</span>
          </div>
          {latestWeight && (
            <div className="text-xs text-zinc-400 mt-1">
              {format(new Date(latestWeight.date), 'dd. MMM yyyy', { locale: de })}
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col">
          <div className="flex items-center text-zinc-500 mb-2">
            <Activity className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium uppercase tracking-wider">Letztes Training</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-lg font-bold text-zinc-900 truncate">
              {recentTrainings.length > 0 ? format(new Date(recentTrainings[0].date), 'dd. MMM', { locale: de }) : 'Keins'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3">
        <Link 
          to="/trainings/new" 
          className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center justify-center font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Dumbbell className="w-5 h-5 mr-2" />
          Neues Training starten
        </Link>
      </div>

      {/* Recent Trainings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Letzte Einheiten</h3>
          <Link to="/trainings" className="text-sm text-emerald-600 font-medium">Alle ansehen</Link>
        </div>
        
        {recentTrainings.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 text-center text-zinc-500 text-sm">
            Noch keine Trainings erfasst.
          </div>
        ) : (
          <div className="space-y-3">
            {recentTrainings.map(training => (
              <Link 
                key={training.id} 
                to={`/trainings/${training.id}`}
                className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between hover:border-emerald-200 transition-colors"
              >
                <div className="flex items-center">
                  <div className="bg-zinc-100 p-3 rounded-xl mr-4">
                    <Calendar className="w-5 h-5 text-zinc-600" />
                  </div>
                  <div>
                    <div className="font-medium text-zinc-900">
                      {format(new Date(training.date), 'EEEE, dd. MMMM', { locale: de })}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center">
                      {training.status === 'completed' ? (
                        <span className="text-emerald-600 font-medium">Abgeschlossen</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Aktiv</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
