import { Minus, Play, Plus, Timer, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRestTimer } from '../../contexts/RestTimerContext';
import { REST_MAX, REST_MIN, REST_STEP, formatRestTime } from '../../utils/restTimer';

// Pausen-Leiste über der Bottom-Navigation. Nur die Darstellung — der Timer selbst lebt im
// RestTimerContext und läuft weiter, wenn man diese Seite verlässt.
//
// `bottom-28` entspricht dem `pb-28`, mit dem AppLayout die Höhe der Navigation freihält.
export function RestTimerBar() {
  const { phase, remaining, durationSeconds, progress, overdue, startRest, adjustRest, cancelRest } = useRestTimer();

  if (phase === 'idle') return null;

  const finished = phase === 'finished';
  const ready = phase === 'ready';
  const atMin = durationSeconds <= REST_MIN;
  const atMax = durationSeconds >= REST_MAX;

  const stepClass = 'w-11 h-11 flex items-center justify-center rounded-xl bg-surface-container ' +
    'text-on-surface-variant transition-colors duration-150 active:scale-95 ' +
    'disabled:opacity-40 disabled:active:scale-100';

  return (
    <div className="fixed bottom-28 left-0 right-0 z-20 pointer-events-none">
      <div className="max-w-md mx-auto px-4">
        <div
          className={cn(
            'pointer-events-auto rounded-2xl border p-3 shadow-lg backdrop-blur-xl transition-colors duration-300',
            finished
              ? 'bg-amber-50/95 border-amber-300'
              : 'bg-surface-container-lowest/95 border-surface-container',
          )}
        >
          <div className="flex items-center gap-3">
            <Timer className={cn('w-5 h-5 shrink-0', finished ? 'text-amber-600' : 'text-primary')} />

            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  'font-headline font-bold tabular-nums leading-none',
                  finished ? 'text-xl text-amber-700' : 'text-2xl text-on-surface',
                )}
              >
                {finished ? 'Pause vorbei' : formatRestTime(ready ? durationSeconds : remaining)}
              </div>
              {ready && (
                <p className="text-xs text-outline mt-1">Pause bereit — antippen zum Starten</p>
              )}
              {/* War die App zwischendurch im Hintergrund, stand der Timer nicht — er lief
                  nur unbemerkt ab. Ohne diese Zeile wüsste man nicht, wie lange schon. */}
              {finished && overdue >= 5 && (
                <p className="text-xs text-amber-700 mt-1">
                  vor {formatRestTime(overdue)} abgelaufen
                </p>
              )}
            </div>

            {ready ? (
              <button
                onClick={() => startRest(durationSeconds)}
                aria-label="Pause starten"
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary text-on-primary transition-transform duration-150 active:scale-95"
              >
                <Play className="w-5 h-5" />
              </button>
            ) : !finished && (
              <>
                <button
                  onClick={() => adjustRest(-REST_STEP)}
                  disabled={atMin}
                  aria-label="30 Sekunden kürzer"
                  className={stepClass}
                >
                  <Minus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => adjustRest(REST_STEP)}
                  disabled={atMax}
                  aria-label="30 Sekunden länger"
                  className={stepClass}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </>
            )}

            <button
              onClick={cancelRest}
              aria-label={finished ? 'Ausblenden' : 'Pause abbrechen'}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-outline transition-colors duration-150 hover:text-on-surface active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!ready && (
            <div className="mt-2 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  finished ? 'bg-amber-500' : 'bg-primary',
                )}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
