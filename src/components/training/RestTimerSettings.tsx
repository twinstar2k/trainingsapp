import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRestTimer } from '../../contexts/RestTimerContext';
import {
  REST_MAX,
  REST_MIN,
  REST_STEP,
  formatRestTime,
  type RestSignalMode,
  type RestTimerMode,
} from '../../utils/restTimer';

// Einstellungen des Pausen-Timers. Eigene Komponente, damit die Profilseite nicht weiter
// wächst — sie ist reine Komposition und liest den Zustand aus dem RestTimerContext.

const MODES: { key: RestTimerMode; label: string; hint: string }[] = [
  { key: 'auto', label: 'Automatisch', hint: 'Startet beim Abhaken eines Satzes' },
  { key: 'manual', label: 'Nur manuell', hint: 'Leiste erscheint, du startest selbst' },
  { key: 'off', label: 'Aus', hint: 'Kein Pausen-Timer' },
];

const SIGNALS: { key: RestSignalMode; label: string; hint: string }[] = [
  { key: 'interrupt', label: 'Musik kurz unterbrechen', hint: 'Setzt danach von selbst wieder ein' },
  { key: 'stop', label: 'Musik stoppen', hint: 'Bleibt aus, bis du sie startest' },
  { key: 'silent', label: 'Nur visuell', hint: 'Rührt die Wiedergabe nicht an' },
];

const cardClass = (selected: boolean) =>
  cn(
    'text-left p-3 rounded-2xl border transition-all duration-150 hover:border-primary/20 active:scale-[0.98]',
    selected
      ? 'border-primary bg-primary/10 ring-1 ring-primary'
      : 'border-surface-container bg-surface-container-lowest',
  );

export function RestTimerSettings() {
  const { settings, updateSettings } = useRestTimer();
  const stepDisabled = 'disabled:opacity-40 disabled:active:scale-100';

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4 shadow-sm space-y-4">
      <p className="text-sm text-on-surface-variant">
        Misst die Pause zwischen den Sätzen, damit du dafür nicht mehr aus der App wechseln musst.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => void updateSettings({ mode: m.key })}
            className={cardClass(settings.mode === m.key)}
          >
            <div className="font-bold text-on-surface text-sm">{m.label}</div>
            <div className="text-xs text-on-surface-variant mt-0.5">{m.hint}</div>
          </button>
        ))}
      </div>

      {settings.mode !== 'off' && (
        <>
          <div>
            <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Standard-Pause
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void updateSettings({ seconds: settings.seconds - REST_STEP })}
                disabled={settings.seconds <= REST_MIN}
                aria-label="30 Sekunden kürzer"
                className={cn(
                  'w-12 h-12 flex items-center justify-center rounded-xl bg-surface-container text-on-surface-variant active:scale-95',
                  stepDisabled,
                )}
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="flex-1 text-center font-headline text-2xl font-bold tabular-nums text-on-surface">
                {formatRestTime(settings.seconds)}
              </div>
              <button
                type="button"
                onClick={() => void updateSettings({ seconds: settings.seconds + REST_STEP })}
                disabled={settings.seconds >= REST_MAX}
                aria-label="30 Sekunden länger"
                className={cn(
                  'w-12 h-12 flex items-center justify-center rounded-xl bg-surface-container text-on-surface-variant active:scale-95',
                  stepDisabled,
                )}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-outline mt-2">
              Im Training jederzeit um ±30 s anpassbar — das gilt dann nur für die laufende Pause.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Pausenende signalisieren
            </div>
            <div className="grid grid-cols-1 gap-2">
              {SIGNALS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => void updateSettings({ signal: s.key })}
                  className={cardClass(settings.signal === s.key)}
                >
                  <div className="font-bold text-on-surface text-sm">{s.label}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">{s.hint}</div>
                </button>
              ))}
            </div>
            {/* Bewusst kein Signalton: Im Studio soll niemand von der App beschallt werden. */}
            <p className="text-xs text-outline mt-2">
              Kein Alarm über den Lautsprecher — das Signal ist die kurze Stille im Kopfhörer.
              Das Display bleibt während der Pause an.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
