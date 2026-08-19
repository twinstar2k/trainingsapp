// Audio-Mechanik des Pausen-Timers: ein kurzer Zweiklang am Ende der Pause.
//
// WARUM EIN TON UND NICHTS EXOTISCHERES
// Beim Training stecken Kopfhörer im Ohr — der Ton geht also dorthin und nicht in den
// Raum. Die ursprüngliche Sorge, im Studio jemanden zu beschallen, trifft diesen Fall
// gar nicht. Frühere Fassungen unterbrachen stattdessen über die Audio Session API die
// laufende Musik. Das ist am Gerät gescheitert (iPhone, iOS 26.5, 2026-08-09):
//
//   • `transient-solo` setzt die Musik nie von allein fort — der Modus „kurz
//     unterbrechen“ war ein Versprechen, das das System nicht einlöst.
//   • `audioSession.type` überhaupt zu setzen und danach den AudioContext zu starten
//     stoppt in Chrome für iOS sofort die Musik. Beide Operationen einzeln sind harmlos.
//   • Die Audio Session API gibt es nur in WebKit — auf Android und im Desktop-Chrome
//     hätte die Einstellung stumm gar nichts getan.
//
// Web Audio dagegen gibt es überall. Deshalb wird hier NIE `navigator.audioSession`
// angefasst; die Kategorie bleibt auf 'auto', und dabei mischt jeder Browser den Ton
// über die laufende Musik. Bewacht von eval/rest-signal.test.mjs.
//
// GRENZE: Sobald der Browser in den Hintergrund geht, friert iOS die Seite ein —
// JavaScript stand im Test 24 Sekunden still, weder ein Web-Audio-Loop noch ein stilles
// <audio>-Element ändern daran etwas. Der Timer ist deshalb ein VORDERGRUND-Timer, und
// der Wake Lock ist keine Bequemlichkeit, sondern die tragende Maßnahme.

import type { RestSignalMode } from '../utils/restTimer';

/**
 * Spitzenpegel des Tons. Muss die laufende Musik durchdringen, ohne im Ohr wehzutun.
 * Am Gerät gegen Musik im Kopfhörer verglichen (2026-08-09): 0.15 und 0.35 gingen unter,
 * 0.6 war gut hörbar, im Studio als „nicht aufdringlich, trotzdem wahrnehmbar“ bestätigt.
 * Nicht ohne erneuten Hörtest ändern.
 */
const PEAK = 0.6;
/** Zweiklang: erst tiefer, dann höher — steigend wird als „fertig“ gelesen, nicht als Fehler. */
const TONES: { freq: number; at: number; duration: number }[] = [
  { freq: 880, at: 0.03, duration: 0.13 },
  { freq: 1175, at: 0.25, duration: 0.18 },
];

let ctx: AudioContext | null = null;
let lastPrimeAt = 0;

// ── Diagnose ──────────────────────────────────────────────────────────────────
// Im Studio bleibt der Ton gelegentlich aus, obwohl die App im Vordergrund ist
// (2026-08-19 gemeldet). Der Moment lässt sich nicht abpassen, deshalb schreibt jeder
// Signalversuch mit, in welchem Zustand der Kontext war. Reine Beobachtung, kein
// Eingriff ins Verhalten — sichtbar im Profil über ?debug=1.

const LOG_KEY = 'trainingsapp.restSignalLog';
const LOG_LIMIT = 30;

export interface SignalAttempt {
  /** Zeitpunkt des Versuchs (epoch ms). */
  t: number;
  mode: RestSignalMode;
  /** Zustand des AudioContext vor dem Versuch, 'none' wenn keiner existiert. */
  stateBefore: string;
  /** Sekunden seit dem letzten Freischalten — also seit dem Abhaken des Satzes. */
  sincePrime: number;
  /** Direkt abgespielt oder erst hochgefahren? */
  path: 'direct' | 'resume' | 'none';
  outcome: 'played' | 'resume-rejected' | 'error' | 'no-context' | 'silent';
  stateAfter?: string;
  error?: string;
}

function readLog(): SignalAttempt[] {
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SignalAttempt[]) : [];
  } catch {
    return [];
  }
}

function record(entry: SignalAttempt): void {
  try {
    const log = readLog();
    log.push(entry);
    window.localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-LOG_LIMIT)));
  } catch {
    // Diagnose darf niemals das Signal verhindern.
  }
}

/** Die letzten Signalversuche, neueste zuletzt. Für die Debug-Ansicht im Profil. */
export function readSignalLog(): SignalAttempt[] {
  return readLog();
}

/** Aufzeichnung verwerfen (Debug-Ansicht). */
export function clearSignalLog(): void {
  try {
    window.localStorage.removeItem(LOG_KEY);
  } catch {
    // egal
  }
}

/**
 * Schaltet Audio frei.
 *
 * MUSS synchron aus einem Tap-Handler heraus laufen — Browser geben Audio nur im Rahmen
 * einer echten Nutzergeste frei. Steht davor ein `await`, ist die Geste verbraucht und
 * der Timer bleibt für den Rest der Sitzung stumm.
 */
export function primeAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    lastPrimeAt = Date.now();
    if (ctx.state !== 'running') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Ein Ton mit weichen Flanken — ohne Rampen knackt es hörbar. */
function playTone(audio: AudioContext, startAt: number, freq: number, duration: number): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(PEAK, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/**
 * Signalisiert das Pausenende.
 *
 * Vibration läuft immer mit — auf Android ein zweiter Kanal, auf iOS nicht vorhanden
 * (am Gerät bestätigt: `navigator.vibrate` fehlt dort).
 */
export function fireSignal(mode: RestSignalMode): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // manche Browser werfen bei blockierter Vibration
  }

  const now = Date.now();
  const sincePrime = lastPrimeAt ? Math.round((now - lastPrimeAt) / 1000) : -1;
  const base: Omit<SignalAttempt, 'path' | 'outcome'> = {
    t: now,
    mode,
    stateBefore: ctx ? ctx.state : 'none',
    sincePrime,
  };

  if (mode === 'silent') {
    record({ ...base, path: 'none', outcome: 'silent' });
    return;
  }
  if (!ctx) {
    record({ ...base, path: 'none', outcome: 'no-context' });
    return;
  }
  const audio = ctx;

  const play = (path: 'direct' | 'resume') => {
    try {
      const start = audio.currentTime;
      for (const t of TONES) playTone(audio, start + t.at, t.freq, t.duration);
      record({ ...base, path, outcome: 'played', stateAfter: audio.state });
    } catch (error) {
      record({
        ...base, path, outcome: 'error', stateAfter: audio.state,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Zwischen dem Freischalten (beim Abhaken) und dem Ablauf liegen Minuten. In dieser Zeit
  // unterbricht iOS den Kontext regelmäßig, sobald die Musik-App den Audio-Fokus hält —
  // ein Start darauf erzeugt keinen hörbaren Ton. Deshalb erst hochfahren.
  try {
    if (audio.state === 'running') {
      play('direct');
    } else {
      void audio.resume().then(
        () => play('resume'),
        (error: unknown) => record({
          ...base, path: 'resume', outcome: 'resume-rejected', stateAfter: audio.state,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  } catch (error) {
    record({
      ...base, path: 'none', outcome: 'error', stateAfter: audio.state,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
