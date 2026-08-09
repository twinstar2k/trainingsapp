// Audio-Mechanik des Pausen-Timers. Zwei Aufgaben, eine gemeinsame Grundlage:
//
//  1) SIGNAL: Im Studio darf nichts über den Lautsprecher plärren. Statt eines Alarms
//     unterbricht die App kurz die laufende Musik — das Signal ist die Stille im
//     Kopfhörer, wie bei „Wiedergabe stoppen“ des iPhone-Timers.
//  2) AM LEBEN BLEIBEN: iOS friert JavaScript ein, sobald Safari in den Hintergrund
//     geht — das Signal käme dann zu spät. Seiten, die Audio abspielen, friert iOS
//     nicht ein. Während der Pause läuft deshalb ein stiller, mischbarer Loop
//     (Typ `ambient`, damit die Musik ungestört weiterläuft).
//
// Alles ist Feature-Detection + try/catch: Ohne `navigator.audioSession` (Desktop-Chrome,
// ältere iOS-Versionen) bleibt die Funktion wirkungslos, darf aber nichts kaputt machen.

import type { RestSignalMode } from '../utils/restTimer';

// Die Audio Session API ist experimentell und fehlt in den TS-DOM-Typen.
type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';
interface AudioSessionLike { type: AudioSessionType }

/** Wie lange die Musik beim Signal aussetzt — kurz genug, um nicht zu stören, lang genug zum Merken. */
const SIGNAL_SECONDS = 1.5;

/**
 * Amplitude des „stillen“ Puffers. Bewusst nicht exakt 0: Ein Puffer aus lauter Nullen
 * kann von der Audio-Pipeline wegoptimiert werden, dann bleibt die Audio-Session inaktiv
 * und iOS friert die Seite doch ein. 0.0001 liegt weit unter der Hörschwelle.
 */
const NEAR_SILENT = 0.0001;

let ctx: AudioContext | null = null;
let keepAlive: AudioBufferSourceNode | null = null;

function setSessionType(type: AudioSessionType): void {
  try {
    const session = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
    if (session) session.type = type;
  } catch {
    // Nicht unterstützt oder verboten — der Timer funktioniert auch ohne, nur leiser.
  }
}

function ensureContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Erzeugt einen unhörbaren Puffer der gewünschten Länge. */
function nearSilentBuffer(audio: AudioContext, seconds: number): AudioBuffer {
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * seconds), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (i % 2 === 0 ? NEAR_SILENT : -NEAR_SILENT);
  }
  return buffer;
}

/**
 * Startet den stillen Ambient-Loop und schaltet damit Audio frei.
 *
 * MUSS synchron aus einem Tap-Handler heraus laufen — iOS gibt Audio nur im Rahmen einer
 * echten Nutzergeste frei. Steht davor ein `await`, ist die Geste verbraucht und der
 * Timer bleibt für den Rest der Sitzung stumm.
 */
export function startKeepAlive(): void {
  const audio = ensureContext();
  if (!audio) return;
  if (keepAlive) return;
  try {
    setSessionType('ambient'); // mischbar: die Musik des Nutzers läuft weiter
    const source = audio.createBufferSource();
    source.buffer = nearSilentBuffer(audio, 2);
    source.loop = true;
    source.connect(audio.destination);
    source.start();
    keepAlive = source;
  } catch {
    keepAlive = null;
  }
}

/** Beendet den Loop — nach der Pause soll kein Audio mehr aktiv sein (Akku, Audio-Fokus). */
export function stopKeepAlive(): void {
  if (!keepAlive) return;
  try {
    keepAlive.stop();
  } catch {
    // schon beendet
  }
  keepAlive = null;
}

/**
 * Signalisiert das Pausenende.
 *
 * `interrupt` unterbricht die Musik kurz und überlässt es dem System, sie danach wieder
 * fortzusetzen (`transient-solo`). `stop` lässt sie aus, bis der Nutzer sie selbst startet
 * (`playback`) — das entspricht dem iPhone-Timer. `silent` rührt die Musik nicht an.
 *
 * Vibration läuft immer mit: Auf Android ist das ein zweiter Kanal, auf iOS wirkungslos.
 */
export function fireSignal(mode: RestSignalMode): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // manche Browser werfen bei blockierter Vibration
  }

  if (mode === 'silent') {
    stopKeepAlive();
    return;
  }

  const audio = ensureContext();
  if (!audio) return;

  try {
    stopKeepAlive(); // der ambient-Loop würde den exklusiven Typ sonst überlagern
    setSessionType(mode === 'stop' ? 'playback' : 'transient-solo');
    const source = audio.createBufferSource();
    source.buffer = nearSilentBuffer(audio, SIGNAL_SECONDS);
    source.connect(audio.destination);
    // Nach dem Signal zurück auf mischbar, damit die App den Audio-Fokus wieder freigibt.
    source.onended = () => setSessionType('ambient');
    source.start();
  } catch {
    // Ohne Ton bleibt das sichtbare Signal — der Timer ist deshalb nicht kaputt.
  }
}
