// Session-Scan — geteilte Suchstrategie für „die letzten N Einheiten EINER Übung".
// Single Source für App UND Cloud Functions (ADR-04).
//
// Warum es das gibt (Bug 2026-08-08): Verlauf, „Zuletzt"-Label und KI-Coach luden die
// letzten 20 TRAININGS und suchten die Übung darin. Die Geschäftsregel lautet aber
// „max. 20 Sessions DIESER ÜBUNG". Solange man jede Übung in jedem Training macht, ist
// das dasselbe — sobald man rotiert (Split, Cardio nur gelegentlich), fällt die Historie
// aus dem Fenster: „Indoor Cycle" hatte 6 Einheiten, sichtbar war 1, der Chart meldete
// „Noch zu wenig Daten". Betroffen waren 12 von 32 Übungen.
//
// Die Suche bleibt die zweistufige Query aus ADR-01 (Trainings → exercises → sets);
// neu ist nur, dass sie so weit zurückläuft, bis wirklich N Sessions beisammen sind.

/** Geschäftsregel: so viele Einheiten einer Übung fließen in Verlauf/Referenz/Coach ein. */
export const MAX_SESSIONS = 20;

/**
 * Sicherheitsnetz gegen unbegrenzt wachsende Ladezeit: so viele abgeschlossene Trainings
 * werden höchstens durchsucht. Bei ~3 Trainings/Woche sind 300 knapp zwei Jahre Historie.
 * Wer eine Übung seltener als 20× in 300 Trainings macht, sieht die ältesten nicht mehr —
 * bewusster Kompromiss, weil jedes Training eine eigene Subcollection-Query kostet.
 */
export const MAX_TRAININGS_SCANNED = 300;

/** Trainings pro Runde, die gleichzeitig abgefragt werden (Parallelität vs. Read-Burst). */
export const SCAN_BATCH_SIZE = 25;

export interface CollectOptions {
  maxSessions?: number;
  batchSize?: number;
}

/**
 * Läuft eine nach Datum absteigend sortierte Trainingsliste durch und sammelt daraus die
 * Sessions einer Übung — batchweise parallel, mit Abbruch sobald `maxSessions` erreicht ist.
 *
 * Dadurch kostet eine häufig trainierte Übung genau einen Batch (wie vorher), während eine
 * selten trainierte so weit zurückgesucht wird, bis ihre Historie wirklich vollständig ist.
 *
 * @param trainings  Trainings, absteigend nach Datum (jüngstes zuerst).
 * @param loadSession  Lädt die Session zu einem Training — `null`, wenn die Übung dort fehlt
 *                     oder keine Sätze hat.
 * @returns Gefundene Sessions in Eingabereihenfolge (jüngste zuerst), max. `maxSessions`.
 */
export async function collectExerciseSessions<T, S>(
  trainings: readonly T[],
  loadSession: (training: T, index: number) => Promise<S | null>,
  options: CollectOptions = {},
): Promise<S[]> {
  const maxSessions = options.maxSessions ?? MAX_SESSIONS;
  const batchSize = options.batchSize ?? SCAN_BATCH_SIZE;

  const found: S[] = [];
  for (let start = 0; start < trainings.length; start += batchSize) {
    const batch = trainings.slice(start, start + batchSize);
    const loaded = await Promise.all(batch.map((t, i) => loadSession(t, start + i)));
    for (const session of loaded) {
      if (session !== null) found.push(session);
    }
    if (found.length >= maxSessions) break;
  }

  return found.slice(0, maxSessions);
}
