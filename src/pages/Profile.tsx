import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { seedExercises } from '../lib/seed';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Studio } from '../types';
import { Trash2, Plus, LogOut, Database } from 'lucide-react';

export default function Profile() {
  const { user, signOut } = useAuth();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [newStudioName, setNewStudioName] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

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
      } catch (error) {
        console.error("Error fetching studios:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudios();
  }, [user]);

  const handleAddStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudioName.trim() || !user || !db) return;

    try {
      const studiosRef = collection(db, 'users', user.uid, 'studios');
      const docRef = await addDoc(studiosRef, {
        name: newStudioName.trim(),
        createdAt: Date.now()
      });
      
      setStudios([...studios, { id: docRef.id, name: newStudioName.trim(), createdAt: Date.now() }]);
      setNewStudioName('');
    } catch (error) {
      console.error("Error adding studio:", error);
    }
  };

  const handleDeleteStudio = async (id: string) => {
    if (!user || !db) return;
    if (!confirm('Studio wirklich löschen?')) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'studios', id));
      setStudios(studios.filter(s => s.id !== id));
    } catch (error) {
      console.error("Error deleting studio:", error);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedExercises();
      alert('Übungskatalog erfolgreich initialisiert!');
    } catch (error) {
      console.error("Error seeding exercises:", error);
      alert('Fehler beim Initialisieren des Katalogs.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-1">Profil & Einstellungen</h2>
        <p className="text-zinc-500 text-sm">{user?.email}</p>
      </div>

      {/* Studios Management */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4">Meine Studios</h3>
        
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-4 text-center text-zinc-500 text-sm">Lade Studios...</div>
          ) : studios.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm border-b border-zinc-100">
              Noch keine Studios angelegt.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {studios.map(studio => (
                <li key={studio.id} className="p-4 flex items-center justify-between">
                  <span className="font-medium text-zinc-900">{studio.name}</span>
                  <button 
                    onClick={() => handleDeleteStudio(studio.id)}
                    className="text-zinc-400 hover:text-red-500 p-2 -mr-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          
          <div className="p-4 bg-zinc-50">
            <form onSubmit={handleAddStudio} className="flex gap-2">
              <input 
                type="text" 
                value={newStudioName}
                onChange={(e) => setNewStudioName(e.target.value)}
                placeholder="Neues Studio (z.B. Home Gym)"
                className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <button 
                type="submit"
                disabled={!newStudioName.trim()}
                className="bg-zinc-900 text-white p-2 rounded-xl disabled:opacity-50 hover:bg-zinc-800 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Admin / System */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4">System</h3>
        <div className="space-y-3">
          <button 
            onClick={handleSeed}
            disabled={seeding}
            className="w-full bg-white border border-zinc-200 text-zinc-700 p-4 rounded-2xl flex items-center justify-center font-medium hover:bg-zinc-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <Database className="w-5 h-5 mr-2 text-zinc-400" />
            {seeding ? 'Initialisiere...' : 'Übungskatalog initialisieren'}
          </button>
          
          <button 
            onClick={signOut}
            className="w-full bg-red-50 text-red-600 p-4 rounded-2xl flex items-center justify-center font-medium hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Abmelden
          </button>
        </div>
      </section>
    </div>
  );
}
