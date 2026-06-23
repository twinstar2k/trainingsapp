import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTemplates } from '../hooks/useTemplates';
import type { Exercise } from '../types';
import { ExerciseCatalogModal } from '../components/training/ExerciseCatalogModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PromptDialog } from '../components/ui/PromptDialog';
import {
  Plus, Pencil, Trash2, X, ChevronUp, ChevronDown, ClipboardList,
} from 'lucide-react';

export default function Templates() {
  const { user } = useAuth();
  const { templates, loading, createTemplate, renameTemplate, updateExercises, deleteTemplate } = useTemplates();

  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null); // welche Vorlage gerade aufgeklappt ist
  const [showCatalog, setShowCatalog] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Katalog laden — für Namensauflösung der Übungs-IDs + ExerciseCatalogModal.
  useEffect(() => {
    if (!user || !db) return;
    const fetchCatalog = async () => {
      const snap = await getDocs(collection(db, 'exercises'));
      const loaded: Exercise[] = [];
      snap.forEach((d) => loaded.push({ id: d.id, ...d.data() } as Exercise));
      setCatalog(loaded);
    };
    fetchCatalog().catch((e) => console.error('Error fetching catalog:', e));
  }, [user]);

  const nameOf = (exerciseId: string) =>
    catalog.find((e) => e.id === exerciseId)?.name ?? 'Unbekannte Übung';

  const editing = templates.find((t) => t.id === editingId) ?? null;

  const handleCreate = async (name: string) => {
    setShowCreate(false);
    const id = await createTemplate(name, []);
    if (id) setEditingId(id); // direkt aufklappen, damit Übungen ergänzt werden können
  };

  const handleAddExercise = (exerciseId: string) => {
    if (!editing) return;
    updateExercises(editing.id, [...editing.exerciseIds, exerciseId]);
    setShowCatalog(false);
  };

  const handleRemoveExercise = (index: number) => {
    if (!editing) return;
    updateExercises(editing.id, editing.exerciseIds.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, dir: -1 | 1) => {
    if (!editing) return;
    const next = [...editing.exerciseIds];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateExercises(editing.id, next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">Vorlagen</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all duration-150 active:scale-90"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant">Lade Vorlagen...</div>
      ) : templates.length === 0 ? (
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container text-center shadow-sm">
          <div className="bg-surface-container-low w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-outline" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface mb-2">Noch keine Vorlagen</h3>
          <p className="text-on-surface-variant text-sm mb-6">
            Lege eine Vorlage an oder speichere ein bestehendes Training als Vorlage. Beim Start eines neuen Trainings füllst du damit die Übungen auf einen Schlag.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center h-14 bg-primary text-on-primary px-6 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all duration-150 active:scale-[0.97]"
          >
            Neue Vorlage
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const isOpen = t.id === editingId;
            return (
              <div
                key={t.id}
                className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm overflow-hidden"
              >
                <div className="p-4 flex items-center justify-between">
                  <button
                    onClick={() => setEditingId(isOpen ? null : t.id)}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="font-bold text-on-surface truncate">{t.name}</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      {t.exerciseIds.length} {t.exerciseIds.length === 1 ? 'Übung' : 'Übungen'}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setRenameTarget({ id: t.id, name: t.name })}
                      title="Umbenennen"
                      className="p-2 text-outline hover:text-primary transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                      title="Löschen"
                      className="p-2 text-outline hover:text-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-surface-container p-4 bg-surface-container-low space-y-2">
                    {t.exerciseIds.length === 0 ? (
                      <p className="text-sm text-on-surface-variant text-center py-2">
                        Noch keine Übungen — füge welche hinzu.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {t.exerciseIds.map((exId, index) => (
                          <li
                            key={`${exId}-${index}`}
                            className="flex items-center gap-2 bg-surface-container-lowest rounded-xl px-3 py-2 border border-surface-container"
                          >
                            <span className="text-xs font-semibold text-outline w-5 shrink-0">{index + 1}.</span>
                            <span className="flex-1 text-sm text-on-surface truncate">{nameOf(exId)}</span>
                            <button
                              onClick={() => handleMove(index, -1)}
                              disabled={index === 0}
                              className="p-1 text-outline hover:text-primary disabled:opacity-30 transition-colors"
                              title="Nach oben"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleMove(index, 1)}
                              disabled={index === t.exerciseIds.length - 1}
                              className="p-1 text-outline hover:text-primary disabled:opacity-30 transition-colors"
                              title="Nach unten"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveExercise(index)}
                              className="p-1 text-outline hover:text-error transition-colors"
                              title="Entfernen"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={() => setShowCatalog(true)}
                      className="w-full py-2.5 mt-1 border border-primary/30 rounded-xl text-primary font-semibold text-sm flex items-center justify-center hover:bg-primary/5 transition-all duration-150"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Übung hinzufügen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCatalog && editing && (
        <ExerciseCatalogModal
          catalog={catalog}
          onSelect={handleAddExercise}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {showCreate && (
        <PromptDialog
          title="Neue Vorlage"
          placeholder="Name (z.B. Push A, Beine)"
          confirmLabel="Anlegen"
          onConfirm={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {renameTarget && (
        <PromptDialog
          title="Vorlage umbenennen"
          placeholder="Name"
          initialValue={renameTarget.name}
          onConfirm={(name) => {
            renameTemplate(renameTarget.id, name);
            setRenameTarget(null);
          }}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Vorlage löschen"
        message={`Möchtest du die Vorlage „${deleteTarget?.name ?? ''}“ wirklich löschen? Deine Trainings bleiben unberührt.`}
        onConfirm={() => {
          if (deleteTarget) deleteTemplate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
