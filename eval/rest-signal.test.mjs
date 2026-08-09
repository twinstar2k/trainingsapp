// rest-signal.test.mjs — Regressionstest für die Audio-Mechanik des Pausen-Timers.
//
//   1) npm run build:utils     (erzeugt eval/lib/lib/restSignal.js)
//   2) node rest-signal.test.mjs               (oder: npm test)
//
// HINTERGRUND — zwei am iPhone gefundene Fehler, die dieser Test festhält:
//
// (1) Musik stoppte schon beim Abhaken. Ursache war die Kombination aus
//     `navigator.audioSession.type = 'ambient'` und dem Start des AudioContext: einzeln
//     harmlos, zusammen stoppen sie in Chrome für iOS die Musik. Die Audio Session API
//     ist außerdem WebKit-only. Konsequenz: Sie wird gar nicht mehr benutzt — das Signal
//     ist jetzt ein Ton, der über die Kopfhörer läuft und in jedem Browser funktioniert.
//     REGEL: `navigator.audioSession` darf hier nirgends mehr angefasst werden.
//
// (2) Das Signal kam mal, mal nicht. iOS unterbricht den AudioContext, während die
//     Musik-App den Audio-Fokus hält (im Spike als state 'interrupted' sichtbar), und
//     zwischen Freischalten und Ablauf liegen Minuten. REGEL: fireSignal fährt den
//     Kontext erst hoch und spielt danach ab.

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
const sessionWrites = [];   // jede Zuweisung an audioSession.type — muss leer bleiben
const tones = [];           // jeder tatsächlich gestartete Oszillator
const vibrations = [];
let resumeCalls = 0, contextCount = 0, lastContext = null;

class FakeAudioContext {
  constructor() {
    contextCount++;
    this.state = 'suspended';
    this.sampleRate = 48000;
    this.currentTime = 100;
    this.destination = {};
    lastContext = this;
  }
  resume() { resumeCalls++; this.state = 'running'; return Promise.resolve(); }
  createGain() {
    return {
      gain: {
        setValueAtTime() {}, exponentialRampToValueAtTime() {},
      },
      connect() { return this; },
    };
  }
  createOscillator() {
    const osc = {
      type: '', frequency: { value: 0 },
      connect() { return this; },
      start(at) { tones.push({ freq: osc.frequency.value, at }); },
      stop() {},
    };
    return osc;
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

const { primeAudio, fireSignal } = await import(URL_);

// ── A: Freischalten startet den Kontext und sonst nichts ────────────────────────
{
  primeAudio();
  check('A AudioContext erzeugt', contextCount === 1, contextCount);
  check('A AudioContext gestartet', resumeCalls === 1, resumeCalls);
  check('A kein Ton beim Freischalten', tones.length === 0, tones);
}

// ── B: Mehrfaches Freischalten erzeugt keinen zweiten Kontext ───────────────────
{
  primeAudio();
  primeAudio();
  check('B nur ein AudioContext', contextCount === 1, contextCount);
  check('B kein erneutes resume im laufenden Zustand', resumeCalls === 1, resumeCalls);
}

// ── C: Signal „tone" spielt den Zweiklang ──────────────────────────────────────
{
  fireSignal('tone');
  check('C zwei Töne', tones.length === 2, tones);
  check('C steigende Tonfolge', tones[0].freq < tones[1].freq, tones.map((t) => t.freq));
  check('C zweiter Ton später', tones[1].at > tones[0].at, tones.map((t) => t.at));
  check('C liegt in der Zukunft', tones[0].at > lastContext.currentTime, tones[0].at);
  check('C vibriert (auf iOS wirkungslos)', vibrations.length === 1, vibrations);
}

// ── D: Signal „silent" spielt nichts, vibriert aber ────────────────────────────
{
  const before = tones.length;
  fireSignal('silent');
  check('D kein Ton', tones.length === before, tones.length);
  check('D trotzdem Vibration', vibrations.length === 2, vibrations);
}

// ── E: DIE Kernregel — die Audio-Session wird nirgends angefasst ────────────────
// Ein 'ambient' oder 'playback' an dieser Stelle stoppte am Gerät die Musik und tat
// außerhalb von WebKit ohnehin nichts. Wer das wieder einbaut, bricht beides.
{
  check('E niemals in audioSession geschrieben', sessionWrites.length === 0, sessionWrites);
  check('E Session steht unverändert auf auto', audioSession.type === 'auto', audioSession.type);
}

// ── F: Unterbrochener Kontext wird vor dem Signal wieder gestartet ──────────────
{
  const before = tones.length, resumesBefore = resumeCalls;
  lastContext.state = 'interrupted';   // iOS hat den Kontext kassiert
  fireSignal('tone');
  await new Promise((r) => setTimeout(r, 0));
  check('F resume wurde aufgerufen', resumeCalls === resumesBefore + 1, resumeCalls);
  check('F Ton kam trotzdem', tones.length === before + 2, tones.length);
  check('F Kontext läuft wieder', lastContext.state === 'running', lastContext.state);
}

// ── G: Läuft der Kontext bereits, wird nicht unnötig neu gestartet ─────────────
{
  const resumesBefore = resumeCalls, before = tones.length;
  lastContext.state = 'running';
  fireSignal('tone');
  await new Promise((r) => setTimeout(r, 0));
  check('G kein überflüssiges resume', resumeCalls === resumesBefore, resumeCalls);
  check('G Ton gespielt', tones.length === before + 2, tones.length);
}

// ── H: Fehlende APIs dürfen nichts umwerfen ────────────────────────────────────
// Ältere Geräte haben kein navigator.vibrate; Web Audio kann komplett fehlen.
{
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  let threw = false;
  try { primeAudio(); fireSignal('tone'); fireSignal('silent'); } catch { threw = true; }
  check('H ohne vibrate kein Fehler', !threw, threw);
}

console.log(`rest-signal: ${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail === 0 ? 0 : 1);
