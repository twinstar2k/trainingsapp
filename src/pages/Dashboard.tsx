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
        const trainingsRef = collection(db, 'users', user.uid, 'trainings');
        const qTrainings = query(trainingsRef, orderBy('date', 'desc'), limit(3));
        const trainingDocs = await getDocs(qTrainings);
        const trainings: Training[] = [];
        trainingDocs.forEach(doc => trainings.push({ id: doc.id, ...doc.data() } as Training));
        setRecentTrainings(trainings);

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
    return <div className="flex justify-center py-12 text-on-surface-variant">Lade Dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">
          Hallo {user?.displayName?.split(' ')[0] || 'Athlet'}!
        </h2>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm flex flex-col transition-all duration-150">
          <div className="flex items-center text-outline mb-2">
            <Scale className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium uppercase tracking-wider">Gewicht</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-on-surface">{latestWeight ? latestWeight.weight : '--'}</span>
            <span className="text-sm text-on-surface-variant ml-1">kg</span>
          </div>
          {latestWeight && (
            <div className="text-xs text-outline mt-1">
              {format(new Date(latestWeight.date), 'dd. MMM yyyy', { locale: de })}
            </div>
          )}
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm flex flex-col transition-all duration-150">
          <div className="flex items-center text-outline mb-2">
            <Activity className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium uppercase tracking-wider">Letztes Training</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-lg font-bold text-on-surface truncate">
              {recentTrainings.length > 0 ? format(new Date(recentTrainings[0].date), 'dd. MMM', { locale: de }) : 'Keins'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <Link
        to="/trainings/new"
        className="flex items-center justify-center h-14 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all duration-150 active:scale-[0.97]"
      >
        <Dumbbell className="w-5 h-5 mr-2" />
        Neues Training starten
      </Link>

      {/* Recent Trainings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Letzte Einheiten</h3>
          <Link to="/trainings" className="text-sm text-primary font-medium">Alle ansehen</Link>
        </div>

        {recentTrainings.length === 0 ? (
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container text-center text-on-surface-variant text-sm">
            Noch keine Trainings erfasst.
          </div>
        ) : (
          <div className="space-y-3">
            {recentTrainings.map(training => (
              <Link
                key={training.id}
                to={`/trainings/${training.id}`}
                className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm flex items-center justify-between hover:border-primary/20 hover:shadow-sm transition-all duration-150 active:scale-[0.98]"
              >
                <div className="flex items-center">
                  <div className="bg-surface-container-high p-3 rounded-xl mr-4">
                    <Calendar className="w-5 h-5 text-outline" />
                  </div>
                  <div>
                    <div className="font-bold text-on-surface">
                      {format(new Date(training.date), 'EEEE, dd. MMMM', { locale: de })}
                    </div>
                    <div className="text-xs mt-0.5">
                      {training.status === 'completed' ? (
                        <span className="text-primary font-medium">Abgeschlossen</span>
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
