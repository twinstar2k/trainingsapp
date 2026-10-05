// guardrails.test.mjs — Offline-Regressionstest für das Strukturgate der KI-Empfehlung.
//
// Testet den KOMPILIERTEN Code UND den Eval-Spiegel (lib.mjs) gegen dieselben Fälle — so fällt
// auf, wenn die beiden auseinanderlaufen:
//   1) cd ../functions && npx tsc      (erzeugt functions/lib/functions/src/lib/guardrails.js)
//   2) node guardrails.test.mjs        (oder: npm test)
//
// Hintergrund (2026-10-05): Der Coach wird immer für genau eine Übung gefragt. Die frühere
// Gesamt-Begründung `summary` war dort nur eine Dopplung der Einzel-Begründung und ist aus dem
// Vertrag entfernt. Der einzige Text ist `rationale` — er bleibt Pflicht.

import { existsSync } from 'node:fs';
import { validateStructure as mirrorValidate, applyPolicyOverride } from './lib.mjs';

const URL_ = new URL('../functions/lib/functions/src/lib/guardrails.js', import.meta.url);
if (!existsSync(URL_)) {
  console.error('✗ Kompilierte Guardrails fehlen. Bitte zuerst bauen:  cd ../functions && npx tsc');
  process.exit(2);
}
const { validateStructure, clampPayload } = await import(URL_);

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; } else { fail++; console.log(`  ✗ ${label} -> ${JSON.stringify(got)}`); }
}

const exercise = { exerciseId: 'bench', rationale: 'Zuletzt 3×12 @ 60 kg. Heute 62,5 kg.', restSeconds: 120, sets: [{ reps: 8, weight: 62.5 }] };

for (const [name, validate] of [['Function', validateStructure], ['Eval-Spiegel', mirrorValidate]]) {
  // ── A: Payload ohne summary ist gültig ─────────────────────────────────────────
  {
    const r = validate({ exercises: [exercise] });
    check(`A ${name}: ohne summary gültig`, r.valid === true, r);
  }
  // ── B: rationale bleibt Pflicht (fehlend oder leer) ────────────────────────────
  {
    const { rationale: _omit, ...ohne } = exercise;
    const r = validate({ exercises: [ohne] });
    check(`B ${name}: fehlende rationale abgelehnt`, r.valid === false, r);
    const leer = validate({ exercises: [{ ...exercise, rationale: '' }] });
    check(`B ${name}: leere rationale abgelehnt`, leer.valid === false, leer);
  }
  // ── C: ein überzähliges summary (altes Modellverhalten) stört nicht ────────────
  {
    const r = validate({ summary: 'alt', exercises: [exercise] });
    check(`C ${name}: überzähliges summary toleriert`, r.valid === true, r);
  }
}

// ── D: ausgelieferte Payloads tragen kein summary mehr ───────────────────────────
{
  const clamped = clampPayload({ summary: 'alt', exercises: [exercise] }, { clamps: [], violations: [], starters: [] });
  check('D clampPayload: kein summary', !('summary' in clamped), clamped);
  const merged = applyPolicyOverride(
    { summary: 'alt', exercises: [exercise] },
    [{ exerciseId: 'bench', action: 'progress_load', sets: exercise.sets }],
  );
  check('D applyPolicyOverride: kein summary', !('summary' in merged), merged);
}

console.log(`guardrails: ${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
