import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Training } from '../types';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Plus, Calendar, MapPin, ChevronRight } from 'lucide-react';
import { TrainingRatingBadge } from '../components/training/TrainingRating';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';

// Monats-Key eines Trainings, z. B. "2026-07" — Basis der Gruppierung.
const monthKey = (date: string) => date.slice(0, 7);

export default function Trainings() {
  const { user } = useAuth();
  const [trainings, setTrainings] = useState<(Training & { studioName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

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

        // Neuester Monat offen; Monate mit aktivem Training dürfen nie versteckt starten.
        const initialOpen = new Set<string>();
        if (loadedTrainings.length > 0) {
          initialOpen.add(monthKey(loadedTrainings[0].date));
        }
        loadedTrainings.forEach(t => {
          if (t.status === 'active') initialOpen.add(monthKey(t.date));
        });
        setOpenMonths(initialOpen);
      } catch (error) {
        console.error("Error fetching trainings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrainings();
  }, [user]);

  // Trainings sind date-desc sortiert — die Gruppenreihenfolge ergibt sich daraus.
  const monthGroups = useMemo(() => {
    const groups: { key: string; trainings: typeof trainings }[] = [];
    trainings.forEach(t => {
      const key = monthKey(t.date);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.trainings.push(t);
      } else {
        groups.push({ key, trainings: [t] });
      }
    });
    return groups;
  }, [trainings]);

  const toggleMonth = (key: string) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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
        <div className="space-y-2">
          {monthGroups.map(group => (
            <CollapsibleSection
              key={group.key}
              title={format(parseISO(`${group.key}-01`), 'MMMM yyyy', { locale: de })}
              count={group.trainings.length}
              open={openMonths.has(group.key)}
              onToggle={() => toggleMonth(group.key)}
            >
              {group.trainings.map(training => (
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
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant font-medium">
                        <span className="flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1" />
                          {training.studioName}
                        </span>
                        {training.status === 'active' && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md font-semibold">Aktiv</span>
                        )}
                        {training.rating && <TrainingRatingBadge value={training.rating} />}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-outline" />
                  </div>
                </Link>
              ))}
            </CollapsibleSection>
          ))}
        </div>
      )}
    </div>
  );
}
