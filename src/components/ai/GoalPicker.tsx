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
      {GOALS.map((g) => {
        const selected = value === g.key;
        // Deaktivierte Ziele sind nicht wählbar — außer es ist bereits das gespeicherte
        // Ziel (Altbestand): dann bleibt es sichtbar markiert, lässt sich aber nicht neu setzen.
        const locked = !g.enabled && !selected;
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => g.enabled && onChange(g.key)}
            disabled={locked}
            aria-disabled={locked}
            title={locked ? 'Bald verfügbar' : undefined}
            className={cn(
              'relative text-left p-3 rounded-2xl border transition-all duration-150',
              selected
                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                : 'border-surface-container bg-surface-container-lowest',
              locked
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-primary/20 active:scale-[0.98]',
            )}
          >
            <div className="font-bold text-on-surface text-sm">{g.label}</div>
            <div className="text-xs text-on-surface-variant mt-0.5">{g.hint}</div>
            {!g.enabled && (
              <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container-high rounded-full px-1.5 py-0.5">
                bald
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
