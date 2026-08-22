import { useState } from 'react';
import { readSignalLog, clearSignalLog, type SignalAttempt } from '../../lib/restSignal';

// Diagnoseansicht für den Pausen-Ton. Nur sichtbar mit ?debug=1 in der URL.
//
// Anlass (2026-08-19): Im Studio blieb der Ton gelegentlich aus, obwohl die App im
// Vordergrund war. Der Moment lässt sich nicht abpassen — deshalb schreibt jeder
// Signalversuch mit, in welchem Zustand der AudioContext war, und hier steht es lesbar.
// Vorübergehend: Sobald die Ursache gefunden ist, fliegt diese Datei wieder raus.

/** Klartext statt Fachbegriff — der Log wird gelesen, nicht ausgewertet. */
const OUTCOME_TEXT: Record<SignalAttempt['outcome'], string> = {
  played: 'Ton gespielt',
  'resume-rejected': 'Hochfahren abgelehnt — KEIN TON',
  error: 'Fehler — KEIN TON',
  'no-context': 'kein Audio freigeschaltet — KEIN TON',
  silent: 'Modus „nur visuell“',
  stalled: 'Clock stand, nichts half — KEIN TON',
};

/** Ergebnis der Clock-Probe (2026-08-22): `state` allein ist kein Beleg. */
const PATH_TEXT: Partial<Record<SignalAttempt['path'], string>> = {
  resume: 'musste hochgefahren werden',
  kick: 'Clock stand → mit suspend+resume angetreten',
  recreate: 'Clock stand → Kontext neu angelegt',
};

function formatEntry(a: SignalAttempt): string {
  const zeit = new Date(a.t).toLocaleTimeString('de-DE');
  const teile = [
    zeit,
    OUTCOME_TEXT[a.outcome] ?? a.outcome,
    `Kontext vorher: ${a.stateBefore}`,
    a.stateAfter && a.stateAfter !== a.stateBefore ? `nachher: ${a.stateAfter}` : null,
    a.clockBefore === 'advancing' ? 'Clock lief' : null,
    PATH_TEXT[a.path] ?? null,
    a.sincePrime >= 0 ? `${a.sincePrime}s nach dem Abhaken` : null,
    a.error ? `(${a.error})` : null,
  ];
  return teile.filter(Boolean).join(' · ');
}

export function RestSignalDebug() {
  const [entries, setEntries] = useState<SignalAttempt[]>(() => readSignalLog());
  const [copied, setCopied] = useState(false);

  const text = entries.map(formatEntry).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text || '(keine Einträge)');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-amber-300 p-4 shadow-sm mt-3">
      <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
        Diagnose · letzte {entries.length} Signale
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          Noch nichts aufgezeichnet. Hake einen Satz ab und lass die Pause ablaufen.
        </p>
      ) : (
        <pre className="text-[11px] leading-relaxed text-on-surface-variant whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
          {[...entries].reverse().map(formatEntry).join('\n')}
        </pre>
      )}

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex-1 px-3 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold active:scale-[0.98]"
        >
          {copied ? 'Kopiert ✓' : 'Log kopieren'}
        </button>
        <button
          type="button"
          onClick={() => { clearSignalLog(); setEntries([]); }}
          className="px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant text-sm font-semibold active:scale-[0.98]"
        >
          Leeren
        </button>
        <button
          type="button"
          onClick={() => setEntries(readSignalLog())}
          className="px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant text-sm font-semibold active:scale-[0.98]"
        >
          Neu laden
        </button>
      </div>
    </div>
  );
}
