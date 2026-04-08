import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { seedExercises } from '../lib/seed';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Studio } from '../types';
import { Trash2, Plus, LogOut, Database, Download } from 'lucide-react';
import { exportAllUserData, downloadBackup } from '../lib/export';

export default function Profile() {
  const { user, signOut } = useAuth();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [newStudioName, setNewStudioName] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const payload = await exportAllUserData(user.uid);
      downloadBackup(payload);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Export fehlgeschlagen. Details in der Konsole.');
    } finally {
      setExporting(false);
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
        <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface mb-1">Profil & Einstellungen</h2>
        <p className="text-on-surface-variant text-sm">{user?.email}</p>
      </div>

      {/* Studios Management */}
      <section>
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Meine Studios</h3>

        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-4 text-center text-on-surface-variant text-sm">Lade Studios...</div>
          ) : studios.length === 0 ? (
            <div className="p-4 text-center text-on-surface-variant text-sm border-b border-surface-container">
              Noch keine Studios angelegt.
            </div>
          ) : (
            <ul className="divide-y divide-surface-container">
              {studios.map(studio => (
                <li key={studio.id} className="p-4 flex items-center justify-between">
                  <span className="font-medium text-on-surface">{studio.name}</span>
                  <button
                    onClick={() => handleDeleteStudio(studio.id)}
                    className="text-outline hover:text-error p-2 -mr-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="p-4 bg-surface-container-low">
            <form onSubmit={handleAddStudio} className="flex gap-2">
              <input
                type="text"
                value={newStudioName}
                onChange={(e) => setNewStudioName(e.target.value)}
                placeholder="Neues Studio (z.B. Home Gym)"
                className="flex-1 bg-surface-container-lowest ring-1 ring-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
              />
              <button
                type="submit"
                disabled={!newStudioName.trim()}
                className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all duration-150 active:scale-90 disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* System */}
      <section>
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">System</h3>
        <div className="space-y-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-surface-container-lowest border border-surface-container text-on-surface p-4 rounded-2xl flex items-center justify-center font-medium hover:bg-surface-container-low transition-all duration-150 shadow-sm disabled:opacity-50"
          >
            <Download className="w-5 h-5 mr-2 text-outline" />
            {exporting ? 'Exportiere...' : 'Alle Daten exportieren (JSON)'}
          </button>

          <button
            onClick={handleSeed}
            disabled={seeding}
            className="w-full bg-surface-container-lowest border border-surface-container text-on-surface p-4 rounded-2xl flex items-center justify-center font-medium hover:bg-surface-container-low transition-all duration-150 shadow-sm disabled:opacity-50"
          >
            <Database className="w-5 h-5 mr-2 text-outline" />
            {seeding ? 'Initialisiere...' : 'Übungskatalog initialisieren'}
          </button>

          <button
            onClick={signOut}
            className="w-full bg-error-container text-error p-4 rounded-2xl flex items-center justify-center font-medium hover:bg-red-100 transition-all duration-150"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Abmelden
          </button>
        </div>
      </section>
    </div>
  );
}
