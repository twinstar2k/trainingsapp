// Audio-Mechanik des Pausen-Timers: Am Ende der Pause die laufende Musik stoppen.
//
// Im Studio darf nichts über den Lautsprecher plärren. Statt eines Alarms beansprucht die
// App kurz den Audio-Fokus exklusiv — das Signal ist die Stille im Kopfhörer, wie bei
// „Wiedergabe stoppen“ des iPhone-Timers.
//
// GRENZE, am Gerät gemessen (iPhone, iOS 26.5, Safari und Chrome, 2026-08-09):
// Sobald der Browser in den Hintergrund geht, friert iOS die Seite ein — JavaScript stand
// im Test 24 Sekunden still. Ein stiller Web-Audio-Loop hilft nicht (der AudioContext
// wird „interrupted“), ein stilles <audio>-Element ebenso wenig; ein danach gestartetes
// Signal wird mit NotAllowedError abgelehnt. Der Timer ist deshalb ein
// VORDERGRUND-Timer; das Display wachzuhalten (Wake Lock) ist keine Bequemlichkeit,
// sondern die tragende Maßnahme. Deshalb gibt es hier auch keinen Keep-Alive-Loop mehr:
// Er kostete Akku und Audio-Fokus, ohne das Problem zu lösen.

import type { RestSignalMode } from '../utils/restTimer';

// Die Audio Session API ist experimentell und fehlt in den TS-DOM-Typen.
type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';
interface AudioSessionLike { type: AudioSessionType }

/** Wie lange der exklusive Zugriff gehalten wird — lang genug, dass die Musik sicher stoppt. */
const SIGNAL_SECONDS = 1.5;

/**
 * Amplitude des „stillen“ Puffers. Bewusst nicht exakt 0: Ein Puffer aus lauter Nullen
 * kann von der Audio-Pipeline wegoptimiert werden, dann wird die Audio-Session nie aktiv
 * und die Musik läuft weiter. 0.0001 liegt weit unter der Hörschwelle.
 */
const NEAR_SILENT = 0.0001;

let ctx: AudioContext | null = null;

function setSessionType(type: AudioSessionType): void {
  try {
    const session = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
    if (session) session.type = type;
  } catch {
    // Nicht unterstützt — der Timer funktioniert auch ohne, nur ohne Musik-Signal.
  }
}

/**
 * Schaltet Audio frei.
 *
 * MUSS synchron aus einem Tap-Handler heraus laufen — iOS gibt Audio nur im Rahmen einer
 * echten Nutzergeste frei. Steht davor ein `await`, ist die Geste verbraucht und der
 * Timer bleibt für den Rest der Sitzung stumm.
 */
export function primeAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    // 'ambient' ist mischbar: Bis zum Signal läuft die Musik des Nutzers ungestört.
    setSessionType('ambient');
    if (ctx.state !== 'running') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/**
 * Signalisiert das Pausenende.
 *
 * `stop` beansprucht den Audio-Fokus exklusiv (`playback`) und stoppt damit die laufende
 * Musik, bis der Nutzer sie selbst wieder startet. `silent` rührt sie nicht an.
 *
 * Kann fehlschlagen, wenn die Seite zwischenzeitlich im Hintergrund war — dann bleibt das
 * sichtbare Signal. Bewusst kein lauter Ersatzton: Der wäre genau das, was im Studio
 * niemand will.
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

  try {
    setSessionType('playback');
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * SIGNAL_SECONDS), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = i % 2 === 0 ? NEAR_SILENT : -NEAR_SILENT;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    // Danach den Fokus wieder freigeben, damit die App die Wiedergabe nicht blockiert.
    source.onended = () => setSessionType('ambient');
    source.start();
  } catch {
    // Ohne Ton bleibt das sichtbare Signal — der Timer ist deshalb nicht kaputt.
  }
}

/** Gibt den Audio-Fokus frei (Abbruch der Pause). */
export function releaseAudio(): void {
  setSessionType('ambient');
}
