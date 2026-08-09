// rest-signal.test.mjs — Regressionstest für die Audio-Mechanik des Pausen-Timers.
//
//   1) npm run build:utils     (erzeugt eval/lib/lib/restSignal.js)
//   2) node rest-signal.test.mjs               (oder: npm test)
//
// HINTERGRUND (Bug 2026-08-09, am iPhone gefunden): Beim Abhaken eines Satzes stoppte
// sofort die Musik, statt erst am Pausenende. Ursache war NICHT das Abspielen, sondern
// die Kombination aus zwei Zeilen in primeAudio():
//
//     navigator.audioSession.type = 'ambient';   // "bitte mischen"
//     new AudioContext(); ctx.resume();
//
// Am Gerät isoliert gemessen: Jede Zeile für sich ist harmlos, beide zusammen stoppen in
// Chrome für iOS die Musik. Sobald die Session explizit gesetzt ist, verlässt sie 'auto';
// Chrome wendet die explizite Kategorie dann exklusiv an, statt zu mischen. Safari mischt
// bei 'ambient' korrekt — der Fehler war also nur in einem der beiden Browser sichtbar.
//
// KERNREGEL, die dieser Test bewacht: Das Freischalten von Audio darf die Audio-Session
// NICHT anfassen. Sie wird ausschließlich für das Signal auf 'playback' gesetzt und danach
// auf 'auto' zurückgestellt. Wer hier wieder ein 'ambient' einbaut, bricht die Musik.

import { existsSync } from 'node:fs';

const URL_ = new URL('./lib/lib/restSignal.js', import.meta.url);
if (!existsSync(URL_)) {
  console.error('✗ Kompiliertes restSignal fehlt. Bitte zuerst bauen:  npm run build:utils');
  process.exit(2);
}

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; } else { fail++; console.log(`  ✗ ${label} -> ${JSON.stringify(got)}`); }
}

// ── Browser-Attrappen ───────────────────────────────────────────────────────────
const sessionWrites = [];   // jede Zuweisung an audioSession.type
const started = [];         // jede tatsächlich gestartete Wiedergabe
const vibrations = [];
let resumeCalls = 0, contextCount = 0;
let lastSource = null;

class FakeAudioContext {
  constructor() { contextCount++; this.state = 'suspended'; this.sampleRate = 48000; this.destination = {}; }
  resume() { resumeCalls++; this.state = 'running'; return Promise.resolve(); }
  createBuffer(_ch, length) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() {
    lastSource = {
      buffer: null, onended: null,
      connect() { return this; },
      start() { started.push('source'); },
    };
    return lastSource;
  }
}

const audioSession = {
  _type: 'auto',
  get type() { return this._type; },
  set type(v) { this._type = v; sessionWrites.push(v); },
};

Object.defineProperty(globalThis, 'navigator', {
  value: { audioSession, vibrate: (p) => { vibrations.push(p); return true; } },
  configurable: true, writable: true,
});
globalThis.window = { AudioContext: FakeAudioContext };

const { primeAudio, fireSignal, releaseAudio } = await import(URL_);

// ── A: Freischalten lässt die Audio-Session in Ruhe ──────────────────────────────
// Das ist der eigentliche Bug. Schlägt dieser Block fehl, stoppt im Studio die Musik,
// sobald ein Satz abgehakt wird.
{
  primeAudio();
  check('A keine Zuweisung an audioSession.type', sessionWrites.length === 0, sessionWrites);
  check('A Session bleibt auf auto', audioSession.type === 'auto', audioSession.type);
  check('A AudioContext wurde erzeugt', contextCount === 1, contextCount);
  check('A AudioContext wurde gestartet', resumeCalls === 1, resumeCalls);
  check('A nichts abgespielt', started.length === 0, started);
}

// ── B: Mehrfaches Freischalten erzeugt keinen zweiten Kontext ────────────────────
{
  primeAudio();
  primeAudio();
  check('B nur ein AudioContext', contextCount === 1, contextCount);
  check('B kein erneutes resume im laufenden Zustand', resumeCalls === 1, resumeCalls);
  check('B weiterhin keine Session-Zuweisung', sessionWrites.length === 0, sessionWrites);
}

// ── C: Signal „stop" beansprucht den Fokus und gibt ihn wieder frei ──────────────
{
  fireSignal('stop');
  check('C Session auf playback gesetzt', sessionWrites[0] === 'playback', sessionWrites);
  check('C Wiedergabe gestartet', started.length === 1, started);
  check('C vibriert (auf iOS wirkungslos)', vibrations.length === 1, vibrations);

  // Nach dem Signal zurück auf 'auto' — NICHT auf 'ambient'. 'ambient' war genau die
  // Einstellung, die in Chrome beim nächsten Start des Kontexts die Musik killte.
  lastSource.onended();
  check('C danach zurück auf auto', audioSession.type === 'auto', audioSession.type);
  check('C niemals ambient gesetzt', !sessionWrites.includes('ambient'), sessionWrites);
}

// ── D: Signal „silent" rührt Session und Wiedergabe nicht an ────────────────────
{
  const before = sessionWrites.length, playedBefore = started.length;
  fireSignal('silent');
  check('D keine Session-Zuweisung', sessionWrites.length === before, sessionWrites);
  check('D nichts abgespielt', started.length === playedBefore, started);
  check('D trotzdem Vibration', vibrations.length === 2, vibrations);
}

// ── E: Abbruch gibt den Fokus frei, ohne etwas abzuspielen ──────────────────────
{
  const playedBefore = started.length;
  releaseAudio();
  check('E Session auf auto', audioSession.type === 'auto', audioSession.type);
  check('E nichts abgespielt', started.length === playedBefore, started);
}

// ── F: Fehlende APIs dürfen nichts umwerfen ─────────────────────────────────────
// Desktop-Chrome hat kein navigator.audioSession, ältere Geräte kein vibrate.
{
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  let threw = false;
  try { primeAudio(); fireSignal('stop'); releaseAudio(); } catch { threw = true; }
  check('F ohne audioSession/vibrate kein Fehler', !threw, threw);
}

console.log(`rest-signal: ${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail === 0 ? 0 : 1);
