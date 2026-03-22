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
        <h2 className="text-2xl font-bold text-zinc-900">Übungskatalog</h2>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input 
          type="text" 
          placeholder="Suchen nach Name oder Muskelgruppe..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Lade Übungen...</div>
      ) : catalog.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center shadow-sm">
          <div className="bg-zinc-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">Keine Übungen</h3>
          <p className="text-zinc-500 text-sm">Gehe ins Profil und initialisiere den Katalog.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <ul className="divide-y divide-zinc-100">
            {filteredCatalog.map(ex => (
              <li key={ex.id} className="p-4 hover:bg-zinc-50 transition-colors">
                <div className="font-medium text-zinc-900">{ex.name}</div>
                <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                  <span className="bg-zinc-100 px-2 py-0.5 rounded-md">{ex.muscleGroup}</span>
                  {ex.contextDependent && (
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100">
                      Studio-gebunden
                    </span>
                  )}
                </div>
              </li>
            ))}
            {filteredCatalog.length === 0 && (
              <li className="p-8 text-center text-zinc-500 text-sm">
                Keine Übung für "{searchQuery}" gefunden.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
