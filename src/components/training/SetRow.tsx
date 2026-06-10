import { CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ExerciseType, TrainingSet } from '../../types';

// Nur die numerischen Eingabefelder eines Satzes — der Status läuft separat über onToggleStatus.
export type NumericSetField = 'weight' | 'reps' | 'duration' | 'distance';

interface SetRowProps {
  set: TrainingSet;
  index: number;
  type: ExerciseType;
  isActive: boolean;
  onUpdate: (field: NumericSetField, value: number) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

const INPUT_CLASS =
  'flex-1 min-w-0 bg-surface-container-lowest ring-1 ring-outline-variant/30 rounded-xl px-2 py-1.5 text-center font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed';

// Eine Satzzeile: Eingabefelder je Übungstyp + Status-Toggle + Löschen.
export function SetRow({ set, index, type, isActive, onUpdate, onToggleStatus, onDelete }: SetRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-xl transition-colors duration-150",
        set.status === 'done' ? "bg-primary/10" : "bg-surface-container-low"
      )}
    >
      <div className="w-8 text-center font-bold text-outline text-sm">{index + 1}</div>

      {type === 'weighted' && (
        <>
          <input
            type="number"
            value={set.weight || ''}
            onChange={(e) => onUpdate('weight', parseFloat(e.target.value) || 0)}
            disabled={!isActive}
            className={INPUT_CLASS}
            placeholder="0"
          />
          <input
            type="number"
            value={set.reps || ''}
            onChange={(e) => onUpdate('reps', parseInt(e.target.value) || 0)}
            disabled={!isActive}
            className={INPUT_CLASS}
            placeholder="0"
          />
        </>
      )}

      {type === 'reps_only' && (
        <input
          type="number"
          value={set.reps || ''}
          onChange={(e) => onUpdate('reps', parseInt(e.target.value) || 0)}
          disabled={!isActive}
          className={INPUT_CLASS}
          placeholder="0"
        />
      )}

      {type === 'cardio_basic' && (
        <>
          <input
            type="number"
            value={set.duration || ''}
            onChange={(e) => onUpdate('duration', parseInt(e.target.value) || 0)}
            disabled={!isActive}
            className={INPUT_CLASS}
            placeholder="0"
          />
          <input
            type="number"
            step="0.1"
            value={set.distance || ''}
            onChange={(e) => onUpdate('distance', parseFloat(e.target.value) || 0)}
            disabled={!isActive}
            className={INPUT_CLASS}
            placeholder="0"
          />
        </>
      )}

      <button
        onClick={onToggleStatus}
        disabled={!isActive}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-xl transition-colors duration-150 disabled:cursor-not-allowed",
          set.status === 'done' ? "text-primary" : "text-outline hover:text-on-surface-variant"
        )}
      >
        {set.status === 'done' ? <CheckCircle2 className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
      </button>
      {isActive && (
        <button
          onClick={onDelete}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-outline hover:text-error transition-colors duration-150"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
