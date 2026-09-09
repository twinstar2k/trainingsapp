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

/**
 * Wie lange die Clock-Probe wartet, um zu sehen, ob `currentTime` vorankommt.
 *
 * WARUM `state` NICHT REICHT: Am iPhone gemessen (2026-08-22, nach Wechsel zur Musik-App
 * und zurück): 14 Einträge „played · running", mehrfach kein Ton — und der fehlende Ton
 * wurde beim nächsten `resume()` nachgeliefert. iOS hält also den Render-Thread an,
 * lässt `state` aber auf 'running'. Einzige Wahrheit: läuft `currentTime` weiter?
 * 60 ms sind unhörbar und zuverlässig mehr als ein Render-Quantum (128 Samples ≈ 3 ms).
 */
const CLOCK_PROBE_MS = 60;

// ── Ergebnis eines Signalversuchs ─────────────────────────────────────────────
// `fireSignal` gibt zurück, was passiert ist. Der Aufrufer wertet das nicht aus — die
// Rückgabe existiert, damit eval/rest-signal.test.mjs prüfen kann, WELCHEN Weg die
// Funktion genommen hat (direkt, resume, kick, recreate). Ohne diese Beobachtung ließe
// sich der Ton-Fix von 2026-08-22 nicht absichern; die Wege sind am Gerät erarbeitet und
// dürfen nicht stillschweigend zurückgebaut werden (siehe CLAUDE.md).

export interface SignalAttempt {
  /** Zeitpunkt des Versuchs (epoch ms). */
  t: number;
  mode: RestSignalMode;
  /** Zustand des AudioContext vor dem Versuch, 'none' wenn keiner existiert. */
  stateBefore: string;
  /** Sekunden seit dem letzten Freischalten — also seit dem Abhaken des Satzes. */
  sincePrime: number;
  /**
   * Wie der Ton zustande kam: direkt, nach resume, nach suspend+resume („kick") oder
   * aus einem neu angelegten Kontext („recreate").
   */
  path: 'direct' | 'resume' | 'kick' | 'recreate' | 'none';
  outcome: 'played' | 'resume-rejected' | 'error' | 'no-context' | 'silent' | 'stalled';
  /** Kam `currentTime` vor dem ersten Abspielversuch voran? */
  clockBefore?: 'advancing' | 'stalled';
  stateAfter?: string;
  error?: string;
}

/**
 * Schaltet Audio frei.
 *
 * MUSS synchron aus einem Tap-Handler heraus laufen — Browser geben Audio nur im Rahmen
 * einer echten Nutzergeste frei. Steht davor ein `await`, ist die Geste verbraucht und
 * der Timer bleibt für den Rest der Sitzung stumm.
 */
function createContext(): AudioContext | null {
  const Ctor = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export function primeAudio(): void {
  try {
    if (!ctx) {
      ctx = createContext();
      if (!ctx) return;
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

/** Kommt die Render-Clock des Kontexts innerhalb der Probe-Zeit voran? */
async function clockAdvances(audio: AudioContext): Promise<boolean> {
  const t0 = audio.currentTime;
  await new Promise<void>((resolve) => setTimeout(resolve, CLOCK_PROBE_MS));
  return audio.currentTime > t0;
}

/**
 * Signalisiert das Pausenende.
 *
 * Vibration läuft immer mit — auf Android ein zweiter Kanal, auf iOS nicht vorhanden
 * (am Gerät bestätigt: `navigator.vibrate` fehlt dort).
 *
 * Der Aufrufer wartet nicht auf das Ergebnis; die Funktion wirft nie, sondern meldet
 * jeden Ausgang über den Rückgabewert (siehe SignalAttempt oben).
 */
export async function fireSignal(mode: RestSignalMode): Promise<SignalAttempt> {
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
    return { ...base, path: 'none', outcome: 'silent' };
  }
  if (!ctx) {
    return { ...base, path: 'none', outcome: 'no-context' };
  }

  let audio = ctx;
  let path: SignalAttempt['path'] = 'direct';

  try {
    // Zwischen dem Freischalten (beim Abhaken) und dem Ablauf liegen Minuten. Meldet iOS
    // die Unterbrechung ehrlich ('interrupted'/'suspended'), reicht ein resume.
    if (audio.state !== 'running') {
      path = 'resume';
      try {
        await audio.resume();
      } catch (error) {
        return {
          ...base, path, outcome: 'resume-rejected', stateAfter: audio.state,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // Meldet iOS die Unterbrechung NICHT (state 'running', Clock steht), würde der Ton in
    // einer stehenden Warteschlange landen und erst beim nächsten resume nachgeliefert.
    const advancing = await clockAdvances(audio);
    base.clockBefore = advancing ? 'advancing' : 'stalled';

    if (!advancing) {
      // Stufe 1: den Render-Thread mit suspend+resume antreten.
      await audio.suspend();
      await audio.resume();
      if (await clockAdvances(audio)) {
        path = 'kick';
      } else {
        // Stufe 2: Kontext ist hinüber — wegwerfen und neu anlegen.
        await audio.close().catch(() => {});
        ctx = null;
        const fresh = createContext();
        if (!fresh) {
          return { ...base, path: 'recreate', outcome: 'stalled', stateAfter: 'closed' };
        }
        ctx = fresh;
        audio = fresh;
        await audio.resume();
        if (await clockAdvances(audio)) {
          path = 'recreate';
        } else {
          return { ...base, path: 'recreate', outcome: 'stalled', stateAfter: audio.state };
        }
      }
    }

    const start = audio.currentTime;
    for (const t of TONES) playTone(audio, start + t.at, t.freq, t.duration);
    return { ...base, path, outcome: 'played', stateAfter: audio.state };
  } catch (error) {
    return {
      ...base, path, outcome: 'error', stateAfter: audio.state,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
