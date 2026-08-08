// studio-filter.test.mjs — Offline-Regressionstest für die Studio-Filterregel.
//
// Testet den KOMPILIERTEN Code (kein hand-portierter Spiegel → kein Drift):
//   1) cd ../functions && npx tsc      (erzeugt functions/lib/shared/studio-filter.js)
//   2) node studio-filter.test.mjs     (oder: npm test)
//
// Hintergrund (Bug 2026-08-08): Bei contextDependent-Übungen sind Gewichte nur innerhalb
// desselben Studios vergleichbar. Die Verlaufsseite ermittelte das Studio asynchron und lud,
// solange es noch leer war, ÜBER ALLE STUDIOS — der Verlauf mischte David Lloyd und peoples.
// Kernregel hier: Ist das Studio bei einer studiogebundenen Übung unbekannt, wird NICHT
// geladen (ready: false) — niemals ersatzweise ungefiltert.

import { existsSync } from 'node:fs';

const URL_ = new URL('../functions/lib/shared/studio-filter.js', import.meta.url);
if (!existsSync(URL_)) {
  console.error('✗ Kompilierter Studio-Filter fehlt. Bitte zuerst bauen:  cd ../functions && npx tsc');
  process.exit(2);
}
const { resolveStudioFilter, isStudioLabelRelevant } = await import(URL_);

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; } else { fail++; console.log(`  ✗ ${label} -> ${JSON.stringify(got)}`); }
}

// ── A: globale Übung (Hantel/Bodyweight) — immer über alle Studios ───────────────
{
  const r = resolveStudioFilter(false, 'studio-a');
  check('A global: kein Filter', r.filterStudioId === null, r);
  check('A2 global: lädt sofort', r.ready === true, r);

  const ohne = resolveStudioFilter(false, '');
  check('A3 global ohne Studio: lädt trotzdem', ohne.ready === true && ohne.filterStudioId === null, ohne);
}

// ── B: studiogebundene Übung mit bekanntem Studio ────────────────────────────────
{
  const r = resolveStudioFilter(true, 'studio-a');
  check('B filtert auf das Studio', r.filterStudioId === 'studio-a', r);
  check('B2 lädt', r.ready === true, r);
}

// ── C: KERN-REGRESSION — studiogebunden ohne Studio lädt NICHT ───────────────────
// Genau hier lag der Bug: früher fiel dieser Fall auf "alle Studios" zurück.
{
  for (const [label, value] of [['leerer String', ''], ['null', null], ['undefined', undefined]]) {
    const r = resolveStudioFilter(true, value);
    check(`C studiogebunden, Studio ${label}: ready=false`, r.ready === false, r);
    check(`C2 studiogebunden, Studio ${label}: KEIN ungefilterter Fallback`,
      r.filterStudioId === null, r);
  }
}

// ── D: Rückgabe ist immer vollständig geformt ────────────────────────────────────
{
  for (const [cd, sid] of [[true, 's'], [false, 's'], [true, ''], [false, '']]) {
    const r = resolveStudioFilter(cd, sid);
    check(`D Form ok (${cd}, "${sid}")`,
      typeof r === 'object' && typeof r.ready === 'boolean'
      && (r.filterStudioId === null || typeof r.filterStudioId === 'string'), r);
  }
}

// ── E: Studio-Label nur zeigen, wenn die Zuordnung überhaupt relevant ist ────────
// Der Normalfall ist EIN Studio — dann ist die Angabe Rauschen.
{
  check('E ein Studio: kein Label', isStudioLabelRelevant(true, 1, 'David Lloyd') === false);
  check('E2 kein Studio angelegt: kein Label', isStudioLabelRelevant(true, 0, '') === false);
  check('E3 mehrere Studios + studiogebunden: Label',
    isStudioLabelRelevant(true, 2, 'David Lloyd') === true);
  check('E4 globale Übung trotz mehrerer Studios: kein Label',
    isStudioLabelRelevant(false, 3, 'David Lloyd') === false);
  check('E5 Name noch nicht geladen: kein Label (kein Flackern)',
    isStudioLabelRelevant(true, 2, '') === false);
}

console.log(`\nstudio-filter: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
