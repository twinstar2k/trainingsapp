import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { primeAudio as unlockAudio, fireSignal } from '../lib/restSignal';
import {
  DEFAULT_REST_SETTINGS,
  adjustRestSeconds,
  clampRestSeconds,
  parseRestSettings,
  remainingSeconds,
  restProgress,
  restoreTimer,
  type RestSettings,
} from '../utils/restTimer';

// Der Pausen-Timer läuft bewusst NICHT in der Trainingsseite, sondern hier oberhalb des
// Routers: Wer während der Pause den Verlauf einer Übung nachschlägt, darf seine Pause
// nicht verlieren. Die Leiste wird trotzdem nur im Training gerendert — Sichtbarkeit und
// Lebensdauer sind zwei verschiedene Dinge.
//
// Gerechnet wird nichts hier: Raster, Restzeit und Wiederherstellung liegen als reine
// Funktionen in src/utils/restTimer.ts (getestet in eval/rest-timer.test.mjs). Hier steht
// nur die Mechanik, die sich nicht ohne Browser testen lässt — Intervall, Wake Lock, Audio.

const STORAGE_KEY = 'trainingsapp.restTimer';
/**
 * Wie lange „Pause vorbei“ stehen bleibt, bevor die Leiste von selbst verschwindet.
 * Gemessen ab dem Moment, in dem die Seite zuletzt sichtbar wurde — wer erst nach zwei
 * Minuten zurückkommt, soll die Meldung noch sehen und nicht in eine leere Leiste blicken.
 */
const FINISHED_LINGER_MS = 15_000;

type RestPhase = 'idle' | 'ready' | 'running' | 'finished';

interface RestTimerContextType {
  settings: RestSettings;
  settingsLoaded: boolean;
  updateSettings: (patch: Partial<RestSettings>) => Promise<void>;

  phase: RestPhase;
  /** Verbleibende Sekunden (0, sobald abgelaufen). */
  remaining: number;
  /** Gewählte Dauer dieser Pause in Sekunden. */
  durationSeconds: number;
  /** 0..1 für den Fortschrittsbalken. */
  progress: number;
  /**
   * Wie lange die Pause schon vorbei ist (Sekunden, nur in der Phase 'finished').
   * Wichtig, weil die Seite im Hintergrund einfriert: Wer zurückkommt, sieht sonst
   * „Pause vorbei“ ohne zu wissen, ob das gerade eben oder vor zwei Minuten war.
   */
  overdue: number;

  /** Audio im Rahmen der Nutzergeste freischalten — MUSS synchron im Tap-Handler laufen. */
  primeAudio: () => void;
  /** Pause starten (automatischer Modus) bzw. aus der Bereitschaft heraus. */
  startRest: (seconds?: number) => void;
  /** Leiste in Bereitschaft zeigen, ohne zu starten (manueller Modus). */
  armRest: (seconds?: number) => void;
  /** ±30 s an der laufenden oder bereitstehenden Pause. */
  adjustRest: (deltaSeconds: number) => void;
  /** Abbrechen bzw. „Pause vorbei“ wegtippen. */
  cancelRest: () => void;
}

const noop = () => {};

const RestTimerContext = createContext<RestTimerContextType>({
  settings: DEFAULT_REST_SETTINGS,
  settingsLoaded: false,
  updateSettings: async () => {},
  phase: 'idle',
  remaining: 0,
  durationSeconds: DEFAULT_REST_SETTINGS.seconds,
  progress: 0,
  overdue: 0,
  primeAudio: noop,
  startRest: noop,
  armRest: noop,
  adjustRest: noop,
  cancelRest: noop,
});

// Context + Hook kolokiert wie im AuthContext; react-refresh ist eine DX-Regel, keine Korrektheit.
// eslint-disable-next-line react-refresh/only-export-components
export const useRestTimer = () => useContext(RestTimerContext);

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [settings, setSettings] = useState<RestSettings>(DEFAULT_REST_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [phase, setPhase] = useState<RestPhase>('idle');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_REST_SETTINGS.seconds);
  const [now, setNow] = useState(() => Date.now());

  // Das Signal muss auch feuern, wenn der Nutzer gerade auf einer anderen Seite ist —
  // deshalb liest der Tick die Einstellung über eine Ref statt über die Closure.
  const signalRef = useRef(settings.signal);
  signalRef.current = settings.signal;

  // ── Einstellungen laden ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !db) {
      setSettings(DEFAULT_REST_SETTINGS);
      setSettingsLoaded(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        // Bewusst NICHT durationSeconds mitsetzen: Nach einem Reload mitten in der Pause
        // trifft diese Antwort später ein als die Wiederherstellung und würde die Dauer
        // der laufenden Pause überschreiben (Balken zeigt dann Unsinn).
        setSettings(parseRestSettings(snap.data()));
      } catch (error) {
        console.error('Error loading rest timer settings:', error);
      } finally {
        if (!cancelled) setSettingsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const updateSettings = useCallback(async (patch: Partial<RestSettings>) => {
    const next: RestSettings = {
      ...settings,
      ...patch,
      ...(patch.seconds !== undefined ? { seconds: clampRestSeconds(patch.seconds) } : {}),
    };
    setSettings(next); // optimistisch, wie beim Trainingsziel im Profil
    if (!user || !db) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { restTimerMode: next.mode, restSeconds: next.seconds, restSignal: next.signal },
        { merge: true },
      );
    } catch (error) {
      console.error('Error saving rest timer settings:', error);
    }
  }, [settings, user]);

  // ── Nach Reload fortsetzen ────────────────────────────────────────────────────
  // Achtung: Audio ist nach einem Reload nicht freigeschaltet (es gab keine Geste).
  // Der Countdown stimmt, das akustische Signal bleibt in diesem Fall aus — das
  // sichtbare greift weiterhin.
  useEffect(() => {
    const restored = restoreTimer(window.localStorage.getItem(STORAGE_KEY), Date.now());
    if (!restored) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    setEndsAt(restored.endsAt);
    setDurationSeconds(restored.durationSeconds);
    setPhase('running');
  }, []);

  useEffect(() => {
    if (phase === 'running' && endsAt) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ endsAt, durationSeconds }));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [phase, endsAt, durationSeconds]);

  // ── Tick ──────────────────────────────────────────────────────────────────────
  // Läuft auch in der Phase 'finished' weiter, damit die Leiste zeigen kann, wie lange
  // die Pause schon vorbei ist.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'finished') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    setNow(Date.now());
    return () => window.clearInterval(id);
  }, [phase]);

  const remaining = phase === 'running' && endsAt ? remainingSeconds(endsAt, now) : 0;

  // Ablauf: genau einmal signalisieren. Der Phasenwechsel selbst ist die Sperre —
  // sobald 'finished' gesetzt ist, läuft dieser Effekt nicht erneut in den Zweig.
  useEffect(() => {
    if (phase !== 'running' || !endsAt) return;
    if (remaining > 0) return;
    setPhase('finished');
    fireSignal(signalRef.current);
  }, [phase, endsAt, remaining]);

  // „Pause vorbei“ blendet sich von selbst aus — aber erst, nachdem der Nutzer sie auch
  // sehen konnte. Die Frist startet beim Ablauf und erneut bei jeder Rückkehr zur Seite;
  // ein einfacher setTimeout würde im eingefrorenen Hintergrund verstreichen und die
  // Meldung direkt nach dem Zurückkommen wegräumen.
  const [finishedSeenAt, setFinishedSeenAt] = useState<number | null>(null);

  useEffect(() => {
    if (phase !== 'finished') {
      setFinishedSeenAt(null);
      return;
    }
    setFinishedSeenAt(Date.now());
    const onVisibility = () => { if (!document.hidden) setFinishedSeenAt(Date.now()); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || finishedSeenAt === null) return;
    if (now - finishedSeenAt < FINISHED_LINGER_MS) return;
    setPhase('idle');
    setEndsAt(null);
  }, [phase, finishedSeenAt, now]);

  // ── Wake Lock ─────────────────────────────────────────────────────────────────
  // Hält das Display während der Pause an. iOS gibt den Lock beim Verlassen der Seite
  // frei, deshalb wird er bei der Rückkehr neu angefordert.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (phase !== 'running') {
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }

    let released = false;
    const acquire = async () => {
      if (released || document.hidden || wakeLockRef.current) return;
      try {
        wakeLockRef.current = await navigator.wakeLock?.request('screen') ?? null;
      } catch {
        wakeLockRef.current = null; // z.B. Akkusparmodus — kein Grund, den Timer zu stoppen
      }
    };
    const onVisibility = () => {
      if (!document.hidden) void acquire();
      else wakeLockRef.current = null; // vom System freigegeben
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [phase]);

  // ── Aktionen ──────────────────────────────────────────────────────────────────
  const primeAudio = useCallback(() => unlockAudio(), []);

  const startRest = useCallback((seconds?: number) => {
    const duration = clampRestSeconds(seconds ?? settings.seconds);
    setDurationSeconds(duration);
    setEndsAt(Date.now() + duration * 1000);
    setNow(Date.now());
    setPhase('running');
  }, [settings.seconds]);

  const armRest = useCallback((seconds?: number) => {
    setDurationSeconds(clampRestSeconds(seconds ?? settings.seconds));
    setEndsAt(null);
    setPhase('ready');
  }, [settings.seconds]);

  const adjustRest = useCallback((deltaSeconds: number) => {
    const next = adjustRestSeconds(durationSeconds, deltaSeconds);
    // Die laufende Pause verschiebt sich um genau die Differenz — der Balken behält damit
    // seinen Bezug und die Restzeit springt nicht auf die volle Dauer zurück.
    // (Die Verschiebung wird hier berechnet, nicht in einem setState-Updater: Updater
    // müssen frei von Seiteneffekten sein, sonst zählt React sie im StrictMode doppelt.)
    const shiftMs = (next - durationSeconds) * 1000;
    setDurationSeconds(next);
    setEndsAt((prev) => (prev === null ? prev : prev + shiftMs));
  }, [durationSeconds]);

  const cancelRest = useCallback(() => {
    setPhase('idle');
    setEndsAt(null);
  }, []);

  const progress = phase === 'finished'
    ? 1
    : endsAt
      ? restProgress(endsAt, durationSeconds, now)
      : 0;

  const overdue = phase === 'finished' && endsAt ? Math.max(0, Math.floor((now - endsAt) / 1000)) : 0;

  return (
    <RestTimerContext.Provider
      value={{
        settings, settingsLoaded, updateSettings,
        phase, remaining, durationSeconds, progress, overdue,
        primeAudio, startRest, armRest, adjustRest, cancelRest,
      }}
    >
      {children}
    </RestTimerContext.Provider>
  );
}
