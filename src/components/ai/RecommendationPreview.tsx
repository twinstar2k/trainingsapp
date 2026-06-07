import type { ExerciseType, RecommendationPayload } from '../../types';
import { Trash2, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PreviewExerciseInfo {
  exerciseId: string;
  name: string;
  type: ExerciseType;
}

interface RecommendationPreviewProps {
  payload: RecommendationPayload;
  exerciseInfo: PreviewExerciseInfo[];
  flags: string[];
  onChange: (payload: RecommendationPayload) => void;
}

const FLAG_LABEL: Record<string, { text: string; cls: string }> = {
  starter: { text: 'Startwert — vorsichtig herantasten', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  clamped: { text: 'auf sicheres Maximum gedeckelt', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
};

/** Editierbare Vorschau der KI-Empfehlung. Reps/Gewicht anpassbar, Sätze löschbar. */
export function RecommendationPreview({ payload, exerciseInfo, flags, onChange }: RecommendationPreviewProps) {
  const infoOf = (id: string) => exerciseInfo.find((e) => e.exerciseId === id);
  const flagsFor = (id: string) =>
    [...new Set(flags.filter((f) => f.endsWith(`:${id}`)).map((f) => f.split(':')[0]))];

  const updateSet = (exIdx: number, setIdx: number, field: 'reps' | 'weight', val: number) => {
    onChange({
      ...payload,
      exercises: payload.exercises.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: val } : s)) },
      ),
    });
  };

  const deleteSet = (exIdx: number, setIdx: number) => {
    onChange({
      ...payload,
      exercises: payload.exercises.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) },
      ),
    });
  };

  return (
    <div className="space-y-4">
      {payload.summary && (
        <div className="flex gap-2 p-3 rounded-2xl bg-primary/5 border border-primary/10 text-sm text-on-surface-variant">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>{payload.summary}</span>
        </div>
      )}

      {payload.exercises.map((ex, exIdx) => {
        const info = infoOf(ex.exerciseId);
        const type: ExerciseType = info?.type ?? 'weighted';
        const exFlags = flagsFor(ex.exerciseId);
        return (
          <div key={ex.exerciseId} className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm overflow-hidden">
            <div className="p-3 border-b border-surface-container bg-surface-container-low">
              <div className="font-bold text-on-surface">{info?.name ?? ex.exerciseId}</div>
              <div className="text-xs text-on-surface-variant mt-0.5">{ex.rationale}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Pause {ex.restSeconds}s
                </span>
                {exFlags.map((f) => {
                  const meta = FLAG_LABEL[f];
                  if (!meta) return null;
                  return (
                    <span key={f} className={cn('px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider', meta.cls)}>
                      {meta.text}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="p-3 space-y-2">
              {ex.sets.map((s, setIdx) => (
                <div key={setIdx} className="flex items-center gap-2">
                  <div className="w-6 text-center font-bold text-outline text-sm">{setIdx + 1}</div>
                  {type === 'weighted' && (
                    <label className="flex-1 flex items-center gap-1">
                      <input
                        type="number"
                        value={s.weight ?? ''}
                        onChange={(e) => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                        className="w-full bg-surface-container-low ring-1 ring-outline-variant/30 rounded-xl px-2 py-1.5 text-center font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <span className="text-xs text-outline">kg</span>
                    </label>
                  )}
                  <label className="flex-1 flex items-center gap-1">
                    <input
                      type="number"
                      value={s.reps ?? ''}
                      onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                      className="w-full bg-surface-container-low ring-1 ring-outline-variant/30 rounded-xl px-2 py-1.5 text-center font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="text-xs text-outline">Wdh</span>
                  </label>
                  <button
                    onClick={() => deleteSet(exIdx, setIdx)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-outline hover:text-error transition-colors"
                    aria-label="Satz entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {ex.sets.length === 0 && (
                <div className="text-xs text-on-surface-variant text-center py-2">Keine Sätze (entfernt).</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
