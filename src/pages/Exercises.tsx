import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { Exercise, ExerciseType } from '../types';
import { Search, Activity, Plus, X } from 'lucide-react';

const TYPE_OPTIONS: { value: ExerciseType; label: string }[] = [
  { value: 'weighted', label: 'Gewicht' },
  { value: 'reps_only', label: 'Nur Wiederholungen' },
  { value: 'cardio_basic', label: 'Cardio' },
];

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function Exercises() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ExerciseType>('weighted');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [contextDependent, setContextDependent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCatalog = async () => {
    if (!db) return;
    const catalogRef = collection(db, 'exercises');
    const catalogSnap = await getDocs(catalogRef);
    const catalogData: Exercise[] = [];
    catalogSnap.forEach(d => catalogData.push({ id: d.id, ...d.data() } as Exercise));
    setCatalog(catalogData.sort((a, b) => a.name.localeCompare(b.name)));
  };

  useEffect(() => {
    if (!user || !db) return;
    setLoading(true);
    fetchCatalog()
      .catch(error => console.error('Error fetching catalog:', error))
      .finally(() => setLoading(false));
  }, [user]);

  const muscleGroupSuggestions = useMemo(
    () => Array.from(new Set(catalog.map(ex => ex.muscleGroup))).sort(),
    [catalog]
  );

  const filteredCatalog = catalog.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setName('');
    setType('weighted');
    setMuscleGroup('');
    setContextDependent(false);
    setFormError(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    const trimmedName = name.trim();
    const trimmedGroup = muscleGroup.trim();

    if (!trimmedName || !trimmedGroup) {
      setFormError('Name und Muskelgruppe sind Pflichtfelder.');
      return;
    }

    const id = slugify(trimmedName);
    if (!id) {
      setFormError('Der Name ergibt keine gültige ID.');
      return;
    }
    if (catalog.some(ex => ex.id === id)) {
      setFormError('Eine Übung mit diesem Namen existiert bereits.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await setDoc(doc(db, 'exercises', id), {
        id,
        name: trimmedName,
        type,
        muscleGroup: trimmedGroup,
        contextDependent,
      });
      await fetchCatalog();
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      console.error('Error creating exercise:', error);
      setFormError(error?.message || 'Übung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">Übungskatalog</h2>
        <button
          onClick={() => setShowForm(s => !s)}
          className="h-11 px-4 bg-primary text-on-primary font-bold text-sm rounded-2xl hover:bg-primary-container transition-all duration-150 shadow-sm shadow-primary/20 active:scale-[0.97] flex items-center gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Schließen' : 'Neue Übung'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm space-y-4"
        >
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              required
              className="w-full h-12 bg-surface-container-low ring-1 ring-outline-variant/30 rounded-xl px-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
              placeholder="z. B. Maschine Wadenheben"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Typ</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ExerciseType)}
              className="w-full h-12 bg-surface-container-low ring-1 ring-outline-variant/30 rounded-xl px-4 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
            >
              {TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Muskelgruppe</label>
            <input
              type="text"
              value={muscleGroup}
              onChange={e => setMuscleGroup(e.target.value)}
              list="muscle-group-suggestions"
              maxLength={50}
              required
              className="w-full h-12 bg-surface-container-low ring-1 ring-outline-variant/30 rounded-xl px-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
              placeholder="z. B. Beine"
            />
            <datalist id="muscle-group-suggestions">
              {muscleGroupSuggestions.map(g => <option key={g} value={g} />)}
            </datalist>
          </div>

          <label className="flex items-center gap-3 text-sm text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={contextDependent}
              onChange={e => setContextDependent(e.target.checked)}
              className="w-5 h-5 accent-primary"
            />
            Studio-gebunden (Maschinen-/Seilzug-Übung)
          </label>

          {formError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{formError}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 bg-primary text-on-primary font-bold text-sm rounded-2xl hover:bg-primary-container transition-all duration-150 shadow-sm shadow-primary/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Speichere...' : 'Übung anlegen'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="h-12 px-5 bg-surface-container-low text-on-surface font-bold text-sm rounded-2xl hover:bg-surface-container transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

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
