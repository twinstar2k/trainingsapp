import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import type { TrainingRating } from '../../types';
import { TrainingRatingInput } from '../training/TrainingRating';

interface CompletionCelebrationProps {
  isOpen: boolean;
  trainingNumber?: number;
  messageSeed?: number; // vom Aufrufer (Event-Handler) gewürfelt → Render bleibt rein
  rating?: TrainingRating; // bereits gesetzte Bewertung (Vorauswahl)
  onRate: (rating: TrainingRating) => void;
  onClose: () => void;
}

const MESSAGES = [
  'Stark durchgezogen!',
  'Wieder einen Schritt weiter.',
  'Gut gemacht!',
  'Schweiß ist Fortschritt.',
  'Weiter so – das zahlt sich aus.',
  'Dranbleiben ist alles.',
  'Dein zukünftiges Ich dankt dir.',
  'Sauber abgeliefert.',
  'Kraft wächst im Tun.',
  'Nächstes Level freigeschaltet.',
];

// Fallback-Auto-Close, falls der Nutzer nicht bewertet. Großzügig (war früher 2,8 s),
// damit Zeit zum Bewerten bleibt; eine Bewertung schließt schneller (siehe handleRate).
const AUTO_CLOSE_MS = 7000;
const CLOSE_AFTER_RATE_MS = 650;

export function CompletionCelebration({ isOpen, trainingNumber, messageSeed = 0, rating, onRate, onClose }: CompletionCelebrationProps) {
  // Deterministisch aus dem Seed gewählt → reiner Render (Zufall liegt im Aufrufer-Event).
  const message = MESSAGES[((messageSeed % MESSAGES.length) + MESSAGES.length) % MESSAGES.length];

  // Auto-Close-Fallback: schließt von selbst, falls keine Bewertung erfolgt.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [isOpen, onClose]);

  // onRate aktualisiert die Bewertung im Parent optimistisch → fließt als `rating`-Prop
  // zurück und füllt die Sterne. Kein lokaler State nötig.
  const handleRate = (r: TrainingRating) => {
    onRate(r);
    // Auswahl kurz sichtbar lassen, dann schließen.
    setTimeout(onClose, CLOSE_AFTER_RATE_MS);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl w-full max-w-sm p-8 shadow-xl flex flex-col items-center text-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.1 }}
            >
              <Check className="w-10 h-10 text-emerald-600" strokeWidth={3} />
            </motion.div>
            <h3 className="text-xl font-bold text-zinc-900 mb-1">{message}</h3>
            <div className="h-5 text-sm text-zinc-500">
              <AnimatePresence>
                {trainingNumber !== undefined && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    Dein <span className="font-semibold text-zinc-700">{trainingNumber}.</span> abgeschlossenes Training
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Subjektive Trainingsbewertung — der „Ende des Trainings"-Moment. */}
            <div className="mt-6 pt-5 w-full border-t border-zinc-100 flex flex-col items-center gap-3">
              <span className="text-sm font-medium text-zinc-600">Wie hat sich dein Training angefühlt?</span>
              <TrainingRatingInput value={rating} onChange={handleRate} />
              <button
                onClick={onClose}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Überspringen
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
