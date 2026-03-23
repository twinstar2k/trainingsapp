import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Exercise } from '../types';
import { Search, Activity } from 'lucide-react';

export default function Exercises() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user || !db) return;

    const fetchCatalog = async () => {
      try {
        const catalogRef = collection(db, 'exercises');
        const catalogSnap = await getDocs(catalogRef);
        const catalogData: Exercise[] = [];
        catalogSnap.forEach(doc => catalogData.push({ id: doc.id, ...doc.data() } as Exercise));
        setCatalog(catalogData.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error fetching catalog:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [user]);

  const filteredCatalog = catalog.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">Übungskatalog</h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
        <input
          type="text"
          placeholder="Suchen nach Name oder Muskelgruppe..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-14 bg-surface-container-lowest ring-1 ring-outline-variant/30 rounded-2xl pl-12 pr-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant">Lade Übungen...</div>
      ) : catalog.length === 0 ? (
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center shadow-sm">
          <div className="bg-surface-container-low w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-outline" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface mb-2">Keine Übungen</h3>
          <p className="text-on-surface-variant text-sm">Gehe ins Profil und initialisiere den Katalog.</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-sm">
          <ul className="divide-y divide-surface-container">
            {filteredCatalog.map(ex => (
              <li key={ex.id} className="p-4 hover:bg-surface-container-low transition-colors duration-150">
                <div className="font-bold text-on-surface">{ex.name}</div>
                <div className="text-xs mt-1 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-md">
                    {ex.muscleGroup}
                  </span>
                  {ex.contextDependent && (
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100 text-[10px] font-bold uppercase tracking-wider">
                      Studio-gebunden
                    </span>
                  )}
                </div>
              </li>
            ))}
            {filteredCatalog.length === 0 && (
              <li className="p-8 text-center text-on-surface-variant text-sm">
                Keine Übung für „{searchQuery}" gefunden.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
