import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TrainingRating } from '../../types';
import { RATING_LABELS, RATING_VALUES as VALUES } from '../../lib/rating';

interface RatingInputProps {
  value?: TrainingRating;
  onChange: (rating: TrainingRating) => void;
  size?: 'sm' | 'lg';
}

/** Interaktive 1–4-Sterne-Bewertung der Trainingsqualität (Celebration + Detail-Header). */
export function TrainingRatingInput({ value, onChange, size = 'lg' }: RatingInputProps) {
  const starSize = size === 'lg' ? 'w-9 h-9' : 'w-6 h-6';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1">
        {VALUES.map((v) => {
          const active = value != null && v <= value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-label={RATING_LABELS[v]}
              title={RATING_LABELS[v]}
              className="p-1 transition-transform duration-150 active:scale-90 hover:scale-110"
            >
              <Star
                className={cn(starSize, active ? 'fill-amber-400 text-amber-400' : 'text-outline')}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      <span className="h-4 text-sm font-medium text-on-surface-variant">
        {value != null ? RATING_LABELS[value] : 'Noch nicht bewertet'}
      </span>
    </div>
  );
}

/** Kompakte, nicht-interaktive Anzeige für Listen: N von 4 Sternen gefüllt, kein Wort.
    Die Stufe steckt als aria-label/Tooltip drin (Barrierefreiheit + Hover). */
export function TrainingRatingBadge({ value }: { value: TrainingRating }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={RATING_LABELS[value]} title={RATING_LABELS[value]}>
      {VALUES.map((v) => (
        <Star
          key={v}
          className={cn('w-3.5 h-3.5', v <= value ? 'fill-amber-400 text-amber-400' : 'text-outline')}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}
