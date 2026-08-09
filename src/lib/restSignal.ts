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
 * 0.6 war gut hörbar. Nicht ohne erneuten Hörtest ändern.
 */
const PEAK = 0.6;
/** Zweiklang: erst tiefer, dann höher — steigend wird als „fertig“ gelesen, nicht als Fehler. */
const TONES: { freq: number; at: number; duration: number }[] = [
  { freq: 880, at: 0.03, duration: 0.13 },
  { freq: 1175, at: 0.25, duration: 0.18 },
];

let ctx: AudioContext | null = null;

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

  if (mode === 'silent' || !ctx) return;
  const audio = ctx;

  const play = () => {
    try {
      const base = audio.currentTime;
      for (const t of TONES) playTone(audio, base + t.at, t.freq, t.duration);
    } catch {
      // Ohne Ton bleibt das sichtbare Signal — der Timer ist deshalb nicht kaputt.
    }
  };

  // Zwischen dem Freischalten (beim Abhaken) und dem Ablauf liegen Minuten. In dieser Zeit
  // unterbricht iOS den Kontext regelmäßig, sobald die Musik-App den Audio-Fokus hält —
  // ein Start darauf erzeugt keinen hörbaren Ton. Deshalb erst hochfahren.
  try {
    if (audio.state === 'running') play();
    else void audio.resume().then(play, () => { /* nicht erlaubt → nur sichtbares Signal */ });
  } catch {
    // s.o.
  }
}
