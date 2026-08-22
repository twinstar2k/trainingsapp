import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { SettingsPage } from '../../components/ui/SettingsPage';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useStudios } from '../../hooks/useStudios';

export default function StudiosPage() {
  const { studios, loading, createStudio, deleteStudio } = useStudios();
  const [newStudioName, setNewStudioName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudioName.trim()) return;
    setError(null);
    const ok = await createStudio(newStudioName);
    if (ok) setNewStudioName('');
    else setError('Studio konnte nicht angelegt werden.');
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const ok = await deleteStudio(id);
    if (!ok) setError('Studio konnte nicht gelöscht werden.');
  };

  return (
    <SettingsPage title="Studios" subtitle="Wo du trainierst">
      <p className="text-sm text-on-surface-variant">
        Jedes Training gehört zu einem Studio. Bei Maschinen- und Seilzugübungen vergleicht der
        Verlauf nur Werte aus demselben Studio — die Einstellung an einem Gerät ist woanders eine
        andere.
      </p>

      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-4 text-center text-on-surface-variant text-sm">Lade Studios...</div>
        ) : studios.length === 0 ? (
          <div className="p-4 text-center text-on-surface-variant text-sm border-b border-surface-container">
            Noch keine Studios angelegt.
          </div>
        ) : (
          <ul className="divide-y divide-surface-container">
            {studios.map((studio) => (
              <li key={studio.id} className="p-4 flex items-center justify-between">
                <span className="font-medium text-on-surface">{studio.name}</span>
                <button
                  onClick={() => setPendingDelete(studio.id)}
                  aria-label={`${studio.name} löschen`}
                  className="text-outline hover:text-error p-2 -mr-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="p-4 bg-surface-container-low">
          <form onSubmit={handleAdd} className="flex gap-2">
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
              aria-label="Studio hinzufügen"
              className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all duration-150 active:scale-90 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Studio löschen"
        message="Bereits erfasste Trainings behalten ihre Zuordnung, lassen sich danach aber keinem angelegten Studio mehr zuordnen."
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </SettingsPage>
  );
}
