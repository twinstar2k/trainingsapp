import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import type { ExerciseType } from '../../types';
import type { BestSessionReference } from '../../hooks/useExerciseReference';
import { formatHoldTime } from '../../utils/metrics';

interface LiveProgressBarProps {
  /** Referenzmetrik der abgehakten Sätze dieser Session (kg-Volumen, Wdh oder Sekunden). */
  current: number;
  best: BestSessionReference;
  type: ExerciseType;
}

const METRIC_NAME: Partial<Record<ExerciseType, string>> = {
  weighted: 'Volumen',
  reps_only: 'Wdh',
  isometric: 'Haltezeit',
};

// Live-Fortschritt Richtung Bestleistung: Balken + Restzeile („noch X bis Best").
// Ab Erreichen des Bestwerts kippt der Balken in Amber (Rekord-Zustand).
export function LiveProgressBar({ current, best, type }: LiveProgressBarProps) {
  const formatMetric = (value: number): string => {
    if (type === 'isometric') return formatHoldTime(value);
    return `${Math.round(value)} ${type === 'weighted' ? 'kg' : 'Wdh'}`;
  };

  const beaten = current >= best.value;
  const ratio = Math.min(current / best.value, 1);

  return (
    <div className="mt-3" title={`Bestleistung vom ${format(parseISO(best.date), 'dd. MMM yyyy', { locale: de })}`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-outline shrink-0">
          {METRIC_NAME[type]}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              beaten ? 'bg-amber-500' : 'bg-primary',
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-on-surface tabular-nums shrink-0">
          {formatMetric(current)}
        </span>
      </div>
      <p className={cn('text-xs mt-1', beaten ? 'text-amber-700 font-semibold' : 'text-outline')}>
        {current > best.value
          ? `Bestleistung übertroffen! +${formatMetric(current - best.value)}`
          : beaten
            ? 'Bestleistung erreicht!'
            : `noch ${formatMetric(best.value - current)} bis Best (${formatMetric(best.value)})`}
      </p>
    </div>
  );
}
