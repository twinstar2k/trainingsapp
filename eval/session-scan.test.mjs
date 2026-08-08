// session-scan.test.mjs — Offline-Regressionstest für den Session-Scan (shared/session-scan.ts).
//
// Testet den KOMPILIERTEN Code (kein hand-portierter Spiegel → kein Drift):
//   1) cd ../functions && npx tsc      (erzeugt functions/lib/shared/session-scan.js)
//   2) node session-scan.test.mjs      (oder: npm test)
//
// Hintergrund (Bug 2026-08-08): Verlauf, „Zuletzt"-Label und KI-Coach luden die letzten
// 20 TRAININGS und suchten darin die Übung — statt der letzten 20 SESSIONS DIESER ÜBUNG.
// Bei rotierenden Übungen (Cardio, Split) fiel dadurch die komplette Historie aus dem
// Fenster: „Indoor Cycle" hatte 6 Einheiten, sichtbar war 1 → Chart zeigte „zu wenig Daten".

import { existsSync } from 'node:fs';

const SCAN_URL = new URL('../functions/lib/shared/session-scan.js', import.meta.url);
if (!existsSync(SCAN_URL)) {
  console.error('✗ Kompilierter Session-Scan fehlt. Bitte zuerst bauen:  cd ../functions && npx tsc');
  process.exit(2);
}
const { collectExerciseSessions, MAX_SESSIONS, MAX_TRAININGS_SCANNED, SCAN_BATCH_SIZE } =
  await import(SCAN_URL);

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; } else { fail++; console.log(`  ✗ ${label} -> ${JSON.stringify(got)}`); }
}

/** Trainings absteigend nach Datum, wie sie die Firestore-Query liefert. */
const trainings = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, date: `2026-01-${String(n - i).padStart(2, '0')}` }));

/** Fake-Loader: liefert nur für die angegebenen Indizes eine Session, zählt Aufrufe. */
function loaderFor(indices) {
  const set = new Set(indices);
  const calls = [];
  const load = async (t, i) => {
    calls.push(i);
    return set.has(i) ? { id: t.id, date: t.date } : null;
  };
  return { load, calls };
}

// ── A: der eigentliche Bug — Sessions jenseits von Training #20 werden gefunden ──
// Nachstellung des echten Falls „Indoor Cycle": 55 Trainings, Übung in #0 und #29–#33.
{
  const { load, calls } = loaderFor([0, 29, 30, 31, 32, 33]);
  const found = await collectExerciseSessions(trainings(55), load);
  check('A findet alle 6 Sessions, auch jenseits von Training #20',
    found.length === 6, found.map((s) => s.id));
  check('A2 die alten Sessions sind dabei (nicht nur die jüngste)',
    found.some((s) => s.id === 't33'), found.map((s) => s.id));
  check('A3 durchsucht dafür alle 55 Trainings', calls.length === 55, calls.length);
}

// ── B: Reihenfolge bleibt absteigend (jüngste zuerst) ────────────────────────────
{
  const { load } = loaderFor([0, 29, 33]);
  const found = await collectExerciseSessions(trainings(55), load);
  check('B Reihenfolge = Eingabereihenfolge (date desc)',
    found[0].id === 't0' && found[1].id === 't29' && found[2].id === 't33',
    found.map((s) => s.id));
}

// ── C: kappt bei MAX_SESSIONS (20) — die Geschäftsregel ──────────────────────────
{
  const { load } = loaderFor(Array.from({ length: 60 }, (_, i) => i));
  const found = await collectExerciseSessions(trainings(60), load);
  check('C1 MAX_SESSIONS ist 20', MAX_SESSIONS === 20, MAX_SESSIONS);
  check('C2 höchstens 20 Sessions', found.length === 20, found.length);
  check('C3 es sind die 20 JÜNGSTEN', found[0].id === 't0' && found[19].id === 't19',
    [found[0].id, found[19].id]);
}

// ── D: Early Exit — häufige Übung kostet nicht mehr Reads als nötig ──────────────
{
  const { load, calls } = loaderFor(Array.from({ length: 60 }, (_, i) => i));
  await collectExerciseSessions(trainings(60), load);
  check('D bricht nach dem Batch ab, der 20 Sessions vollmacht (nicht alle 60)',
    calls.length < 60 && calls.length >= 20, calls.length);
}

// ── E: Batches laufen parallel (nicht seriell) ───────────────────────────────────
{
  let inFlight = 0, maxInFlight = 0;
  const load = async () => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
    return null;
  };
  await collectExerciseSessions(trainings(10), load);
  check('E mehrere Trainings gleichzeitig abgefragt', maxInFlight > 1, maxInFlight);
}

// ── F: Randfälle ─────────────────────────────────────────────────────────────────
{
  const found = await collectExerciseSessions([], async () => null);
  check('F leere Trainingsliste → []', Array.isArray(found) && found.length === 0, found);

  const none = await collectExerciseSessions(trainings(5), async () => null);
  check('F2 Übung nie absolviert → []', none.length === 0, none);
}

// ── G: Konstanten sind gesetzt und plausibel ─────────────────────────────────────
check('G MAX_TRAININGS_SCANNED deckt mehrere Jahre Historie',
  MAX_TRAININGS_SCANNED >= 300, MAX_TRAININGS_SCANNED);
check('G2 SCAN_BATCH_SIZE > 0 und kleiner als das Scan-Limit',
  SCAN_BATCH_SIZE > 0 && SCAN_BATCH_SIZE < MAX_TRAININGS_SCANNED, SCAN_BATCH_SIZE);

console.log(`\nsession-scan: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
