import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';

interface CompletionCelebrationProps {
  isOpen: boolean;
  trainingNumber?: number;
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

const AUTO_CLOSE_MS = 2800;

export function CompletionCelebration({ isOpen, trainingNumber, onClose }: CompletionCelebrationProps) {
  const message = useMemo(
    () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
    [isOpen],
  );

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [isOpen, onClose]);

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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
