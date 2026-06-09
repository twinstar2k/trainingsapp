// policy.test.mjs — Offline-Regressionstest des deterministischen Policy-Kerns (Stufe 1.5).
//
// Testet den KOMPILIERTEN Code (kein hand-portierter Spiegel → kein Drift):
//   1) cd ../functions && npx tsc      (erzeugt functions/lib/shared/policy.js)
//   2) node policy.test.mjs            (oder: npm test)
//
// Dependency-frei. Deckt den Entscheidungsbaum aus docs/architecture/ai-coach-engine.md §4 ab.

import { existsSync } from 'node:fs';

const POLICY_URL = new URL('../functions/lib/shared/policy.js', import.meta.url);
if (!existsSync(POLICY_URL)) {
  console.error('✗ Kompilierte Policy fehlt. Bitte zuerst bauen:  cd ../functions && npx tsc');
  process.exit(2);
}
const { computeExercisePlan, describePlan, isLowerBody, incrementForMuscleGroup, computeTrend } = await import(POLICY_URL);

/** Trend-Punkt-Helfer (ascending übergeben: ältester → neuester). */
const tp = (maxWeight, workingReps, rir = null) => ({ date: '2026-01-01', best1RM: null, maxWeight, workingReps, rir });

const base = {
  exerciseId: 'x', name: 'n', type: 'weighted', muscleGroup: 'Brust',
  contextDependent: true, daysSinceLast: 3, best1RM: 100, trend: [],
};
const sess = (sets) => ({ sets });

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; } else { fail++; console.log(`  ✗ ${label} -> ${JSON.stringify(got)}`); }
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────
check('isLowerBody Beine', isLowerBody('Beine') === true);
check('isLowerBody Brust', isLowerBody('Brust') === false);
check('increment Oberkörper', incrementForMuscleGroup('Rücken') === 2.5);
check('increment Unterkörper', incrementForMuscleGroup('Beine') === 5);

// ── Entscheidungsbaum (Ziel progression, Range 8–12) ─────────────────────────────
let p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 12, weight: 80 }, { reps: 12, weight: 80 }]), lastRir: 1 }, 'progression');
check('A range gefüllt + Reserve -> progress_load +2.5 @82.5 reps8',
  p.action === 'progress_load' && p.sets[0].weight === 82.5 && p.sets[0].reps === 8 && p.increment === 2.5, p);

p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 12, weight: 80 }, { reps: 12, weight: 80 }]), lastRir: 0 }, 'progression');
check('B range gefüllt + Versagen -> hold @80 reps12', p.action === 'hold' && p.reason === 'failure' && p.sets[0].weight === 80 && p.sets[0].reps === 12, p);

p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 12, weight: 80 }, { reps: 12, weight: 80 }]), lastRir: null }, 'progression');
check('C range gefüllt + RIR fehlt -> hold(no_rir), KEIN Last-Sprung', p.action === 'hold' && p.reason === 'no_rir' && p.sets[0].weight === 80, p);

p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 10, weight: 80 }, { reps: 10, weight: 80 }]), lastRir: 1 }, 'progression');
check('D range nicht gefüllt -> progress_reps @80 reps11', p.action === 'progress_reps' && p.sets[0].weight === 80 && p.sets[0].reps === 11, p);

p = computeExercisePlan({ ...base, muscleGroup: 'Beine', lastSession: sess([{ reps: 12, weight: 100 }]), lastRir: 2 }, 'progression');
check('E Unterkörper gefüllt -> +5 @105 reps8', p.action === 'progress_load' && p.sets[0].weight === 105 && p.increment === 5 && p.sets[0].reps === 8, p);

p = computeExercisePlan({ ...base, lastSession: null, lastRir: null }, 'progression');
check('F keine Historie -> starter, leere Sätze', p.action === 'starter' && p.sets.length === 0, p);

p = computeExercisePlan({ ...base, type: 'reps_only', muscleGroup: 'Core', lastSession: sess([{ reps: 12 }, { reps: 12 }, { reps: 12 }]), lastRir: null }, 'progression');
check('G reps_only -> progress_reps reps13, kein Gewicht', p.action === 'progress_reps' && p.sets.length === 3 && p.sets[0].reps === 13 && p.sets[0].weight === undefined, p);

p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 10, weight: 80 }]), lastRir: 1 }, 'deload');
check('H Ziel deload -> -15% @68', p.action === 'deload' && p.sets[0].weight === 68, p);

p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 12, weight: 20 }]), lastRir: 1 }, 'progression');
check('I Cap bei kleinem Gewicht: +2 statt +2.5 (10% von 20) @22', p.action === 'progress_load' && p.sets[0].weight === 22 && p.increment === 2, p);

p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 10, weight: 80 }, { reps: 10, weight: 80 }, { reps: 12, weight: 75 }, { reps: 11, weight: 75 }]), lastRir: 1 }, 'progression');
check('J gemischte Sätze: Top-Gewicht nicht gefüllt -> progress_reps @80 reps11, 4 Sätze',
  p.action === 'progress_reps' && p.sets.length === 4 && p.sets[0].weight === 80 && p.sets[0].reps === 11, p);

p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 8, weight: 60 }]), lastRir: 2 }, 'maintenance');
check('K Ziel maintenance -> wie zuletzt @60 reps8', p.action === 'maintain' && p.sets[0].weight === 60 && p.sets[0].reps === 8, p);

p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 6, weight: 100 }]), lastRir: 1 }, 'strength');
check('L Ziel strength (Range 4–6): gefüllt + Reserve -> progress_load @102.5 reps4', p.action === 'progress_load' && p.sets[0].weight === 102.5 && p.sets[0].reps === 4, p);

// ── Trend-/Plateau-Schicht (über mehrere Einheiten) ──────────────────────────────
// computeTrend: Richtung + stalledSessions (Progress-Index maxWeight*100 + workingReps).
let t = computeTrend([tp(80, 10), tp(80, 11), tp(80, 12)]);
check('N1 Trend steigend (Wdh klettern) -> up', t.direction === 'up' && t.exposures === 3 && t.stalledSessions === 0, t);
t = computeTrend([tp(80, 12), tp(80, 12), tp(80, 12)]);
check('N2 Trend flach -> flat, stalled=2', t.direction === 'flat' && t.stalledSessions === 2, t);
t = computeTrend([tp(80, 12), tp(80, 10), tp(80, 9)]);
check('N3 Trend abfallend -> down', t.direction === 'down', t);
t = computeTrend([tp(80, 12), tp(80, 12)]);
check('N4 < 3 Exposures -> building (keine Aussage)', t.direction === 'building' && t.exposures === 2, t);
// Sägezahn-Schutz: Last-Erhöhung mit Wdh-Reset (12→8) darf NICHT als Abfall gelten.
t = computeTrend([tp(80, 12), tp(82.5, 8), tp(82.5, 9)]);
check('N5 Last-Sprung + Wdh-Reset -> up (kein Fake-Plateau)', t.direction === 'up' && t.stalledSessions === 0, t);

// Plateau-Reaktion im Gesamtplan:
const flat80 = [tp(80, 12), tp(80, 12), tp(80, 12, 0)];
p = computeExercisePlan({ ...base, trend: flat80, lastSession: sess([{ reps: 12, weight: 80 }, { reps: 12, weight: 80 }]), lastRir: 0 }, 'progression');
check('O Plateau + Versagen -> hold/stall_fatigue @80 reps12', p.action === 'hold' && p.reason === 'stall_fatigue' && p.sets[0].weight === 80 && p.sets[0].reps === 12, p);

const flat80reps = [tp(80, 10, 1), tp(80, 10, 1), tp(80, 10, 1)];
p = computeExercisePlan({ ...base, trend: flat80reps, lastSession: sess([{ reps: 10, weight: 80 }, { reps: 10, weight: 80 }]), lastRir: 1 }, 'progression');
check('P Plateau + Reserve -> progress_reps/stall_push @80 reps11', p.action === 'progress_reps' && p.reason === 'stall_push' && p.sets[0].reps === 11, p);

const flat80none = [tp(80, 10), tp(80, 10), tp(80, 10)];
p = computeExercisePlan({ ...base, trend: flat80none, lastSession: sess([{ reps: 10, weight: 80 }, { reps: 10, weight: 80 }]), lastRir: null }, 'progression');
check('Q Plateau + kein RIR -> progress_reps/stall_no_rir', p.action === 'progress_reps' && p.reason === 'stall_no_rir' && p.sets[0].reps === 11, p);

// ask_rir: 2× oberer Rand ohne RIR in Folge → aktiv nach Reserve fragen.
const filledNoRir2 = [tp(80, 12), tp(80, 12)];
p = computeExercisePlan({ ...base, trend: filledNoRir2, lastSession: sess([{ reps: 12, weight: 80 }, { reps: 12, weight: 80 }]), lastRir: null }, 'progression');
check('R 2× oberer Rand ohne RIR -> ask_rir @80', p.action === 'hold' && p.reason === 'ask_rir' && p.sets[0].weight === 80, p);

// no_rir (1. Mal, kein Vorgänger mit gefülltem Rand) bleibt no_rir.
p = computeExercisePlan({ ...base, trend: [tp(80, 9), tp(80, 12)], lastSession: sess([{ reps: 12, weight: 80 }]), lastRir: null }, 'progression');
check('S 1× oberer Rand ohne RIR -> no_rir (nicht ask_rir)', p.reason === 'no_rir', p);

// progress_load wird NICHT von altem flachem Trend überstimmt.
p = computeExercisePlan({ ...base, trend: [tp(80, 12), tp(80, 12), tp(80, 12)], lastSession: sess([{ reps: 12, weight: 80 }, { reps: 12, weight: 80 }]), lastRir: 1 }, 'progression');
check('T Range gefüllt + Reserve schlägt flachen Trend -> progress_load', p.action === 'progress_load' && p.reason === 'range_filled_reserve', p);

// Rebuild nach Last-Sprung: kein Plateau-Flag, sauberes progress_reps.
p = computeExercisePlan({ ...base, trend: [tp(80, 12), tp(82.5, 8), tp(82.5, 9)], lastSession: sess([{ reps: 9, weight: 82.5 }, { reps: 9, weight: 82.5 }]), lastRir: 1 }, 'progression');
check('U Rebuild nach Last-Sprung -> progress_reps (kein stall)', p.action === 'progress_reps' && p.reason === 'range_not_filled' && p.sets[0].reps === 10, p);

// ── Reps-Progression-Flag (weighted am Last-Limit) ───────────────────────────────
p = computeExercisePlan({ ...base, repsProgression: true, lastSession: sess([{ reps: 20, weight: 130 }, { reps: 20, weight: 130 }]), lastRir: 0 }, 'progression');
check('V Flag: weighted am Limit 20@130 -> load_capped_reps 21@130, repRange null',
  p.action === 'progress_reps' && p.reason === 'load_capped_reps' && p.sets[0].reps === 21 && p.sets[0].weight === 130 && p.repRange === null, p);

p = computeExercisePlan({ ...base, type: 'reps_only', muscleGroup: 'Bauch', lastSession: sess([{ reps: 17 }, { reps: 17 }]), lastRir: 0 }, 'progression');
check('W reps_only unverändert -> reps_only_progress 18, kein Gewicht, repRange null',
  p.action === 'progress_reps' && p.reason === 'reps_only_progress' && p.sets[0].reps === 18 && p.sets[0].weight === undefined && p.repRange === null, p);

// Entscheidend: Flag überstimmt den Last-Sprung — auch bei vollem Rand + Reserve nur Reps.
p = computeExercisePlan({ ...base, repsProgression: true, lastSession: sess([{ reps: 12, weight: 130 }, { reps: 12, weight: 130 }]), lastRir: 2 }, 'progression');
check('X Flag bei vollem Rand + Reserve -> trotzdem Reps (13@130), KEIN progress_load',
  p.action === 'progress_reps' && p.reason === 'load_capped_reps' && p.sets[0].reps === 13 && p.sets[0].weight === 130, p);

// ── describePlan (Fallback-Begründung) ───────────────────────────────────────────
p = computeExercisePlan({ ...base, lastSession: sess([{ reps: 12, weight: 80 }]), lastRir: 1 }, 'progression');
check('M describePlan liefert Text', typeof describePlan(p) === 'string' && describePlan(p).length > 10, describePlan(p));
for (const reason of ['ask_rir', 'stall_fatigue', 'stall_push', 'stall_no_rir', 'load_capped_reps']) {
  const txt = describePlan({ action: 'hold', reason, increment: 0, repRange: [8, 12], sets: [{ reps: 12, weight: 80 }] });
  check(`M+ describePlan(${reason}) liefert Text`, typeof txt === 'string' && txt.length > 20, txt);
}

console.log(`\nPolicy-Regressionstest: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
