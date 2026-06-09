// context.test.mjs — Offline-Regressionstest für die Kontext-Schicht (Sandwich A).
//
// Testet den KOMPILIERTEN Code (kein hand-portierter Spiegel → kein Drift):
//   1) cd ../functions && npx tsc      (erzeugt functions/lib/.../context.js)
//   2) node context.test.mjs           (oder: npm test)
//
// Schwerpunkt: der reps_only-mit-Verlauf-Bug (weight: undefined → Firestore "INTERNAL")
// und die für die Trend-Schicht vorberechneten Felder (workingReps, rir).

import { existsSync } from 'node:fs';

const CTX_URL = new URL('../functions/lib/functions/src/lib/context.js', import.meta.url);
if (!existsSync(CTX_URL)) {
  console.error('✗ Kompilierter Kontext fehlt. Bitte zuerst bauen:  cd ../functions && npx tsc');
  process.exit(2);
}
const { buildExerciseContext, buildTrainingState } = await import(CTX_URL);

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; } else { fail++; console.log(`  ✗ ${label} -> ${JSON.stringify(got)}`); }
}

const REF = '2026-06-09';
const baseInput = (over) => ({
  exerciseId: 'x', name: 'n', type: 'weighted', muscleGroup: 'Brust', contextDependent: false, sessions: [], ...over,
});

// ── reps_only MIT Verlauf: KEIN weight-Key (sonst Firestore-"INTERNAL") ───────────
let ctx = buildExerciseContext(baseInput({
  exerciseId: 'dips', name: 'Dips', type: 'reps_only', muscleGroup: 'Brust / Trizeps',
  sessions: [
    { date: '2026-06-02', studioId: 's1', sets: [{ reps: 20 }, { reps: 20 }, { reps: 18 }, { reps: 17 }], rir: 0 },
    { date: '2026-05-28', studioId: 's1', sets: [{ reps: 19 }, { reps: 18 }] },
  ],
}), REF);
check('A reps_only: lastSession.sets ohne weight-Key',
  ctx.lastSession.sets.every((s) => !('weight' in s)), ctx.lastSession.sets);
check('A2 kein undefined irgendwo im Kontext (Firestore-tauglich)',
  !JSON.stringify(ctx).includes(':undefined') && !hasUndefined(ctx), ctx);
check('A3 lastRir durchgereicht', ctx.lastRir === 0, ctx.lastRir);
check('A4 workingReps = min Wdh der letzten Einheit (17)', ctx.trend.at(-1).workingReps === 17, ctx.trend.at(-1));
check('A5 maxWeight 0 / best1RM null bei Bodyweight', ctx.trend.at(-1).maxWeight === 0 && ctx.trend.at(-1).best1RM === null, ctx.trend.at(-1));

// ── weighted MIT Verlauf: weight vorhanden, workingReps = min Wdh am Top-Gewicht ──
ctx = buildExerciseContext(baseInput({
  sessions: [
    { date: '2026-06-02', studioId: 's1', sets: [{ reps: 10, weight: 80 }, { reps: 9, weight: 80 }, { reps: 12, weight: 75 }], rir: 1 },
    { date: '2026-05-28', studioId: 's1', sets: [{ reps: 8, weight: 80 }, { reps: 8, weight: 80 }] },
  ],
}), REF);
check('B weighted: weight vorhanden', ctx.lastSession.sets[0].weight === 80, ctx.lastSession.sets[0]);
check('B2 workingReps = min Wdh am Top-Gewicht 80 (=9, nicht 12@75)', ctx.trend.at(-1).workingReps === 9, ctx.trend.at(-1));
check('B3 best1RM gesetzt (Epley)', typeof ctx.trend.at(-1).best1RM === 'number' && ctx.trend.at(-1).best1RM > 80, ctx.trend.at(-1));
check('B4 lastRir = 1', ctx.lastRir === 1, ctx.lastRir);

// ── Trend ist ascending (älteste → neueste) ──────────────────────────────────────
check('C Trend ascending nach Datum', ctx.trend[0].date < ctx.trend.at(-1).date, ctx.trend.map((t) => t.date));
check('C2 daysSinceLast korrekt (2026-06-02 → 2026-06-09 = 7)', ctx.daysSinceLast === 7, ctx.daysSinceLast);

// ── Keine Historie → Starter-Form ────────────────────────────────────────────────
ctx = buildExerciseContext(baseInput({ sessions: [] }), REF);
check('D keine Historie -> lastSession null, trend leer, daysSinceLast null',
  ctx.lastSession === null && ctx.trend.length === 0 && ctx.daysSinceLast === null, ctx);

// ── buildTrainingState reicht durch + bleibt undefined-frei ───────────────────────
const state = buildTrainingState({
  goal: 'progression', date: REF, studioId: 's1', bodyweightKg: null,
  exercises: [baseInput({ exerciseId: 'd', type: 'reps_only', sessions: [{ date: '2026-06-01', studioId: 's1', sets: [{ reps: 15 }] }] })],
});
check('E TrainingState undefined-frei (persistierbar)', !hasUndefined(state), state);

/** Rekursiv prüfen, ob irgendwo ein undefined als Wert steckt (Firestore lehnt das ab). */
function hasUndefined(obj) {
  if (obj === undefined) return true;
  if (obj === null || typeof obj !== 'object') return false;
  return Object.values(obj).some(hasUndefined);
}

console.log(`\nKontext-Regressionstest: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
