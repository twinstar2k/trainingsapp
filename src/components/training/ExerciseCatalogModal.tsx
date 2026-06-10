import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { Exercise } from '../../types';

interface ExerciseCatalogModalProps {
  catalog: Exercise[];
  onSelect: (catalogExerciseId: string) => void;
  onClose: () => void;
}

// Vollbild-Modal: Übungskatalog durchsuchen und eine Übung ins Training übernehmen.
// Der Suchbegriff lebt im Modal — beim Schließen (Unmount) ist er automatisch zurückgesetzt.
export function ExerciseCatalogModal({ catalog, onSelect, onClose }: ExerciseCatalogModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCatalog = catalog.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="p-4 border-b border-surface-container flex items-center gap-3 bg-surface-container-lowest sticky top-0">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            placeholder="Übung suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-14 bg-surface-container-low ring-1 ring-outline-variant/30 rounded-2xl pl-12 pr-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
            autoFocus
          />
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center hover:bg-surface-container-highest transition-all duration-150 active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {filteredCatalog.map(ex => (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              className="w-full text-left p-4 bg-surface-container-lowest border border-surface-container rounded-2xl hover:border-primary/20 hover:shadow-sm transition-all duration-150 active:scale-[0.98] flex justify-between items-center group"
            >
              <div>
                <div className="font-bold text-on-surface">{ex.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-md">
                    {ex.muscleGroup}
                  </span>
                  {ex.contextDependent && (
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100 text-[10px] font-bold uppercase tracking-wider">
                      Studio-gebunden
                    </span>
                  )}
                </div>
              </div>
              <Plus className="w-5 h-5 text-outline group-hover:text-primary transition-colors" />
            </button>
          ))}
          {filteredCatalog.length === 0 && (
            <div className="text-center py-12 text-on-surface-variant">Keine Übung gefunden.</div>
          )}
        </div>
      </div>
    </div>
  );
}
