import { Link } from 'react-router-dom';
import { Dumbbell, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Training } from '../../types';

interface ActiveTrainingBannerProps {
  training: Training;
}

// Antippbare Pille über der Bottom-Nav: ein Tap führt zurück ins aktive Training.
// Sichtbarkeit entscheidet AppLayout.
export function ActiveTrainingBanner({ training }: ActiveTrainingBannerProps) {
  return (
    <div className="max-w-md mx-auto px-4 pb-2">
      <Link
        to={`/trainings/${training.id}`}
        className="flex h-12 items-center gap-3 px-4 bg-primary text-on-primary rounded-2xl shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.97]"
      >
        <Dumbbell className="w-4 h-4 shrink-0" />
        <span className="flex-1 min-w-0 truncate text-sm">
          <span className="font-bold">Aktives Training</span>
          <span className="ml-2 text-xs opacity-80">
            {format(parseISO(training.date), 'EEE, dd. MMM', { locale: de })}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 shrink-0" />
      </Link>
    </div>
  );
}
