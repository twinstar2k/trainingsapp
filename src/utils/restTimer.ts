// Reine Rechenlogik des Pausen-Timers — kein React, kein Firestore, kein Browser-API.
//
// Warum hier und nicht im Hook (CLAUDE.md, Code-Konventionen): Der Timer entscheidet und
// rechnet (Raster, Grenzen, Restzeit, „ist ein gespeicherter Stand noch gültig?"). Genau
// dieser Teil muss ohne laufende App prüfbar sein — Test: eval/rest-timer.test.mjs.
// Die Mechanik (setInterval, Wake Lock, Audio) bleibt im Context.
//
// Zentrale Regel: Die Restzeit wird IMMER aus dem Zielzeitstempel gerechnet, nie
// heruntergezählt. Nur so stimmt sie nach einem Tab-Wechsel oder einem Reload sofort
// wieder — iOS friert JavaScript im Hintergrund ein, ein Zähler liefe dann falsch.

/** Kürzeste wählbare Pause (Sekunden). */
export const REST_MIN = 30;
/** Längste wählbare Pause (Sekunden). Niemand pausiert eine Stunde. */
export const REST_MAX = 600;
/** Raster der Einstellung und Schrittweite der ±-Buttons (Sekunden). */
export const REST_STEP = 30;
/** Voreinstellung für neue Nutzer (Sekunden). */
export const REST_DEFAULT = 90;

/** Wann startet der Timer? */
export type RestTimerMode = 'auto' | 'manual' | 'off';
/**
 * Wie wird das Pausenende signalisiert?
 *
 * Es gab einen dritten Modus „kurz unterbrechen und automatisch fortsetzen“
 * (`transient-solo`). Am Gerät getestet (iOS 26.5, 2026-08-09): Die Musik stoppt, kommt
 * aber nicht von allein zurück — der Modus wäre ein Versprechen gewesen, das das System
 * nicht einlöst. Deshalb nur noch: stoppen oder gar nichts anfassen.
 */
export type RestSignalMode = 'stop' | 'silent';

/** Die drei Nutzereinstellungen, wie sie auf users/{uid} liegen. */
export interface RestSettings {
  mode: RestTimerMode;
  seconds: number;
  signal: RestSignalMode;
}

export const DEFAULT_REST_SETTINGS: RestSettings = {
  mode: 'auto',
  seconds: REST_DEFAULT,
  signal: 'stop',
};

/** Ein laufender oder wiederhergestellter Timer. */
export interface RestTimerState {
  /** Zielzeitpunkt in epoch ms. */
  endsAt: number;
  /** Ursprünglich gewählte Dauer — Basis für den Fortschrittsbalken. */
  durationSeconds: number;
}

/**
 * Bringt eine Sekundenzahl auf das 30er-Raster und in den erlaubten Bereich.
 * Unbrauchbare Eingaben (NaN, Infinity, Text) fallen auf die Voreinstellung zurück,
 * damit ein kaputter Firestore-Wert nie einen Timer ohne Ende erzeugt.
 */
export function clampRestSeconds(seconds: unknown): number {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return REST_DEFAULT;
  const snapped = Math.round(seconds / REST_STEP) * REST_STEP;
  return Math.min(REST_MAX, Math.max(REST_MIN, snapped));
}

/** ±30 s an der laufenden Pause. Die Grenzen gelten auch hier. */
export function adjustRestSeconds(current: unknown, deltaSeconds: number): number {
  return clampRestSeconds(clampRestSeconds(current) + deltaSeconds);
}

/**
 * Verbleibende Sekunden, aufgerundet — 0,3 s Rest zeigen noch „1", damit die Anzeige
 * nicht eine Sekunde zu früh auf 0 springt.
 */
export function remainingSeconds(endsAt: number, now: number): number {
  if (!Number.isFinite(endsAt) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Fortschritt 0..1 für den Balken (0 = gerade gestartet, 1 = abgelaufen). */
export function restProgress(endsAt: number, durationSeconds: number, now: number): number {
  const totalMs = durationSeconds * 1000;
  if (!Number.isFinite(totalMs) || totalMs <= 0) return 1;
  const elapsed = totalMs - (endsAt - now);
  return Math.min(1, Math.max(0, elapsed / totalMs));
}

/** Sekunden als „m:ss“ — 107 → „1:47“. */
export function formatRestTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Liest den in localStorage gesicherten Timer zurück (Reload mitten in der Pause).
 *
 * Verworfen wird alles, dem man nicht trauen kann: kaputtes JSON, abgelaufene Pausen und
 * Stände, deren Restzeit über der Höchstdauer liegt (Uhr verstellt, Gerätewechsel, alter
 * Eintrag). Lieber kein Timer als ein Geistertimer, der nie endet.
 */
export function restoreTimer(raw: string | null | undefined, now: number): RestTimerState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const { endsAt, durationSeconds } = parsed as Record<string, unknown>;
  if (typeof endsAt !== 'number' || !Number.isFinite(endsAt)) return null;
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) return null;
  if (durationSeconds < REST_MIN || durationSeconds > REST_MAX) return null;

  const leftMs = endsAt - now;
  if (leftMs <= 0) return null;                    // abgelaufen
  if (leftMs > REST_MAX * 1000) return null;       // unplausibel weit in der Zukunft

  return { endsAt, durationSeconds };
}

/**
 * Normalisiert das rohe users/{uid}-Dokument zu vollständigen Einstellungen.
 * Fehlende oder unbekannte Werte fallen einzeln auf die Voreinstellung zurück — ein
 * kaputtes Feld darf die beiden anderen nicht mitreißen.
 */
export function parseRestSettings(data: Record<string, unknown> | null | undefined): RestSettings {
  const mode = data?.restTimerMode;
  const signal = data?.restSignal;
  return {
    mode: mode === 'auto' || mode === 'manual' || mode === 'off' ? mode : DEFAULT_REST_SETTINGS.mode,
    seconds: data?.restSeconds === undefined
      ? DEFAULT_REST_SETTINGS.seconds
      : clampRestSeconds(data.restSeconds),
    // 'interrupt' war ein früher Modus, der am Gerät nicht funktionierte — gespeicherte
    // Altwerte landen über den Fallback automatisch auf 'stop'.
    signal: signal === 'stop' || signal === 'silent' ? signal : DEFAULT_REST_SETTINGS.signal,
  };
}
