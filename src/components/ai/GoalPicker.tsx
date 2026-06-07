import type { GoalKey } from '../../types';
import { GOALS } from '../../lib/goals';
import { cn } from '../../lib/utils';

interface GoalPickerProps {
  value: GoalKey;
  onChange: (goal: GoalKey) => void;
}

/** Auswahl des Trainingsziels (wiederverwendbar in Profil und Empfehlungs-Dialog). */
export function GoalPicker({ value, onChange }: GoalPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {GOALS.map((g) => (
        <button
          key={g.key}
          type="button"
          onClick={() => onChange(g.key)}
          className={cn(
            'text-left p-3 rounded-2xl border transition-all duration-150 active:scale-[0.98]',
            value === g.key
              ? 'border-primary bg-primary/10 ring-1 ring-primary'
              : 'border-surface-container bg-surface-container-lowest hover:border-primary/20',
          )}
        >
          <div className="font-bold text-on-surface text-sm">{g.label}</div>
          <div className="text-xs text-on-surface-variant mt-0.5">{g.hint}</div>
        </button>
      ))}
    </div>
  );
}
