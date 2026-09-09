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
let resumeCalls = 0, suspendCalls = 0, closeCalls = 0, contextCount = 0, lastContext = null;
// Steuert die Attrappe: Läuft der Render-Thread neuer Kontexte? Hilft suspend+resume?
// Am Gerät (2026-08-22) blieb `state` auf 'running', während `currentTime` stand.
let newContextsStalled = false;
let kickRevives = true;

class FakeAudioContext {
  constructor() {
    contextCount++;
    this.state = 'suspended';
    this.sampleRate = 48000;
    this.destination = {};
    this._base = 100;
    this._since = Date.now();
    this.clockRunning = !newContextsStalled;
    lastContext = this;
  }
  /** Wie im Browser: nur eine laufende Render-Clock kommt voran. */
  get currentTime() {
    return this.clockRunning ? this._base + (Date.now() - this._since) / 1000 : this._base;
  }
  resume() {
    resumeCalls++;
    this.state = 'running';
    if (kickRevives && !this.clockRunning) { this.clockRunning = true; this._since = Date.now(); }
    return Promise.resolve();
  }
  suspend() { suspendCalls++; this.state = 'suspended'; return Promise.resolve(); }
  close() { closeCalls++; this.state = 'closed'; return Promise.resolve(); }
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

// Ergebnis des jeweils letzten Signalversuchs — einige Blöcke prüfen das Verhalten und
// den gemeldeten Weg getrennt voneinander.
let lastAttempt;

// ── A0: Ohne freigeschaltetes Audio bleibt der Ton aus — und das meldet die Funktion ──
// Genau dieser Fall tritt nach einem Reload mitten in der Pause auf. Ohne die Rückmeldung
// wäre nicht unterscheidbar, ob der Ton fehlte oder nur überhört wurde.
{
  const last = await fireSignal('tone');
  check('A0 Ergebnis gemeldet', !!last, last);
  check('A0 als no-context erkannt', last?.outcome === 'no-context', last);
  check('A0 Zustand none vermerkt', last?.stateBefore === 'none', last);
  check('A0 kein Ton', tones.length === 0, tones);
}

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
  const vibBefore = vibrations.length;
  lastAttempt = await fireSignal('tone');
  check('C zwei Töne', tones.length === 2, tones);
  check('C steigende Tonfolge', tones[0].freq < tones[1].freq, tones.map((t) => t.freq));
  check('C zweiter Ton später', tones[1].at > tones[0].at, tones.map((t) => t.at));
  check('C liegt in der Zukunft', tones[0].at > lastContext.currentTime, tones[0].at);
  check('C vibriert (auf iOS wirkungslos)', vibrations.length === vibBefore + 1, vibrations.length);
}

// ── C2: Erfolgreiches Signal wird als 'played' gemeldet ───────────────────────
{
  const last = lastAttempt;
  check('C2 als played vermerkt', last?.outcome === 'played', last);
  check('C2 direkter Weg', last?.path === 'direct', last);
  check('C2 Zeit seit Freischalten erfasst', typeof last?.sincePrime === 'number', last);
}

// ── D: Signal „silent" spielt nichts, vibriert aber ────────────────────────────
{
  const before = tones.length, vibBefore = vibrations.length;
  await fireSignal('silent');
  check('D kein Ton', tones.length === before, tones.length);
  check('D trotzdem Vibration', vibrations.length === vibBefore + 1, vibrations.length);
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
  lastAttempt = await fireSignal('tone');
  check('F resume wurde aufgerufen', resumeCalls === resumesBefore + 1, resumeCalls);
  check('F Ton kam trotzdem', tones.length === before + 2, tones.length);
  check('F Kontext läuft wieder', lastContext.state === 'running', lastContext.state);
}

// ── F2: Der Umweg über resume wird gemeldet ───────────────────────────────────
// Damit lässt sich unterscheiden, ob der Kontext lief oder erst geweckt wurde.
{
  const last = lastAttempt;
  check('F2 resume-Weg vermerkt', last?.path === 'resume', last);
  check('F2 Zustand vorher festgehalten', last?.stateBefore === 'interrupted', last);
}

// ── G: Läuft der Kontext bereits, wird nicht unnötig neu gestartet ─────────────
{
  const resumesBefore = resumeCalls, before = tones.length;
  lastContext.state = 'running';
  await fireSignal('tone');
  check('G kein überflüssiges resume', resumeCalls === resumesBefore, resumeCalls);
  check('G Ton gespielt', tones.length === before + 2, tones.length);
}

// ── I: Der Browser lügt — `state` sagt 'running', die Clock steht ──────────────
// Gemessen 2026-08-22 (iPhone, Chrome/Safari, nach Wechsel zu Amazon Music): 14 Einträge
// „played · running", mehrfach kein Ton; der Ton wurde beim nächsten resume() nachgeliefert.
// Einzige Wahrheit ist, ob `currentTime` vorankommt.
{
  Object.defineProperty(globalThis, 'navigator', {
    value: { audioSession, vibrate: (p) => { vibrations.push(p); return true; } },
    configurable: true, writable: true,
  });
  primeAudio();
  // I1: gesunder Kontext — unverändertes Verhalten, Clock-Befund vermerkt
  {
    const before = tones.length, suspendsBefore = suspendCalls, contexts = contextCount;
    lastContext.state = 'running';
    const last = await fireSignal('tone');
    check('I1 Ton gespielt', tones.length === before + 2, tones.length);
    check('I1 direkter Weg', last?.path === 'direct', last);
    check('I1 Clock lief', last?.clockBefore === 'advancing', last);
    check('I1 kein Kick', suspendCalls === suspendsBefore, suspendCalls);
    check('I1 kein neuer Kontext', contextCount === contexts, contextCount);
  }
  // I2: Clock steht, suspend+resume tritt sie wieder an
  {
    const before = tones.length, suspendsBefore = suspendCalls, contexts = contextCount;
    lastContext.state = 'running';
    lastContext.clockRunning = false;
    kickRevives = true;
    const last = await fireSignal('tone');
    check('I2 Clock stand erkannt', last?.clockBefore === 'stalled', last);
    check('I2 genau ein suspend', suspendCalls === suspendsBefore + 1, suspendCalls);
    check('I2 Ton nach Kick', tones.length === before + 2, tones.length);
    check('I2 Weg kick vermerkt', last?.path === 'kick' && last?.outcome === 'played', last);
    check('I2 kein neuer Kontext', contextCount === contexts, contextCount);
  }
  // I3: Kick hilft nicht — Kontext schließen und neu anlegen
  {
    const before = tones.length, contexts = contextCount, closesBefore = closeCalls;
    const old = lastContext;
    lastContext.state = 'running';
    lastContext.clockRunning = false;
    kickRevives = false;
    const last = await fireSignal('tone');
    kickRevives = true;
    check('I3 alter Kontext geschlossen', closeCalls === closesBefore + 1 && old.state === 'closed', old.state);
    check('I3 neuer Kontext', contextCount === contexts + 1 && lastContext !== old, contextCount);
    check('I3 Ton aus neuem Kontext', tones.length === before + 2, tones.length);
    check('I3 Weg recreate vermerkt', last?.path === 'recreate' && last?.outcome === 'played', last);
  }
  // I4: nichts hilft — kein Ton, aber sauber protokolliert und kein Wurf
  {
    const before = tones.length;
    lastContext.state = 'running';
    lastContext.clockRunning = false;
    kickRevives = false;
    newContextsStalled = true;
    let threw = false;
    let last;
    try { last = await fireSignal('tone'); } catch { threw = true; }
    kickRevives = true;
    newContextsStalled = false;
    check('I4 kein Wurf', !threw, threw);
    check('I4 kein Ton', tones.length === before, tones.length);
    check('I4 als stalled vermerkt', last?.outcome === 'stalled', last);
  }
  // I5: Nach dem Neuanlegen gilt der neue Kontext auch fürs nächste Freischalten
  {
    const contexts = contextCount;
    primeAudio();
    check('I5 primeAudio legt keinen weiteren an', contextCount === contexts, contextCount);
  }
}

// ── H: Fehlende APIs dürfen nichts umwerfen ────────────────────────────────────
// Ältere Geräte haben kein navigator.vibrate; Web Audio kann komplett fehlen.
{
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  let threw = false;
  try { primeAudio(); await fireSignal('tone'); await fireSignal('silent'); } catch { threw = true; }
  check('H ohne vibrate kein Fehler', !threw, threw);
}

console.log(`rest-signal: ${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail === 0 ? 0 : 1);
