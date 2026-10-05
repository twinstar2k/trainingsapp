// progress-change.test.mjs — Offline-Test für die prozentuale Änderung im Übungsverlauf.
//
// Testet den KOMPILIERTEN Code (kein hand-portierter Spiegel → kein Drift):
//   1) npm run build:utils     (erzeugt eval/lib/utils/progressChange.js)
//   2) node progress-change.test.mjs   (oder: npm test — macht beides)
//
// Kernregel: Verglichen werden NUR erster und letzter Punkt der Kurve. Die Farbe folgt der
// Bewertung (bei Pace ist niedriger besser), und sie richtet sich nach dem GERUNDETEN Wert —
// „0,0 %" darf nie grün oder rot sein.

import { existsSync } from 'node:fs';

const URL_ = new URL('./lib/utils/progressChange.js', import.meta.url);
if (!existsSync(URL_)) {
  console.error('✗ Kompilierte Verlaufs-Änderung fehlt. Bitte zuerst bauen (siehe Kopf dieser Datei).');
  process.exit(2);
}
const { computeProgressChange, formatPercentChange } = await import(URL_);

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; } else { fail++; console.log(`  ✗ ${label} -> ${JSON.stringify(got)}`); }
}

// ── A: Anstieg (Beispiel aus der Anforderung) ───────────────────────────────────
{
  const c = computeProgressChange([2175, 3195]);
  check('A Prozent auf 0,1 gerundet', c?.percent === 46.9, c);
  check('A Richtung besser', c?.direction === 'better', c);
  check('A erster/letzter Wert', c?.first === 2175 && c?.last === 3195, c);
  check('A Format mit Plus und Komma', formatPercentChange(46.9) === '+46,9 %', formatPercentChange(46.9));
}

// ── B: Rückgang ─────────────────────────────────────────────────────────────────
{
  const c = computeProgressChange([100, 90]);
  check('B Prozent negativ', c?.percent === -10, c);
  check('B Richtung schlechter', c?.direction === 'worse', c);
  check('B Format mit echtem Minus', formatPercentChange(-10) === '−10,0 %', formatPercentChange(-10));
}

// ── C: niedriger ist besser (Pace) ──────────────────────────────────────────────
{
  const faster = computeProgressChange([6, 5.7], true);
  check('C Rückgang bleibt negativ', faster?.percent === -5, faster);
  check('C Rückgang ist besser', faster?.direction === 'better', faster);
  const slower = computeProgressChange([5.7, 6], true);
  check('C Anstieg ist schlechter', slower?.direction === 'worse', slower);
}

// ── D: unverändert — nach dem gerundeten Wert ───────────────────────────────────
{
  const same = computeProgressChange([80, 80]);
  check('D gleich → 0', same?.percent === 0, same);
  check('D gleich → flat', same?.direction === 'flat', same);
  const tiny = computeProgressChange([10000, 10004]);
  check('D unter 0,05 % → 0', tiny?.percent === 0, tiny);
  check('D unter 0,05 % → flat', tiny?.direction === 'flat', tiny);
  const tinyDown = computeProgressChange([10000, 9996]);
  check('D minimal runter → 0 (kein −0)', Object.is(tinyDown?.percent, 0), tinyDown);
  check('D Format ohne Vorzeichen', formatPercentChange(0) === '0,0 %', formatPercentChange(0));
  check('D Format −0 ohne Vorzeichen', formatPercentChange(-0) === '0,0 %', formatPercentChange(-0));
}

// ── E: Zwischenwerte zählen nicht ───────────────────────────────────────────────
{
  const c = computeProgressChange([50, 200, 10, 75]);
  check('E nur erster und letzter', c?.percent === 50 && c?.first === 50 && c?.last === 75, c);
}

// ── F: kein Bezugswert → null ───────────────────────────────────────────────────
{
  check('F leer', computeProgressChange([]) === null, computeProgressChange([]));
  check('F ein Wert', computeProgressChange([100]) === null, computeProgressChange([100]));
  check('F Start 0', computeProgressChange([0, 100]) === null, computeProgressChange([0, 100]));
  check('F Start negativ', computeProgressChange([-5, 100]) === null, computeProgressChange([-5, 100]));
}

// ── G: Format großer und krummer Werte ──────────────────────────────────────────
{
  check('G dreistellig', formatPercentChange(123.4) === '+123,4 %', formatPercentChange(123.4));
  check('G ganze Zahl bekommt ,0', formatPercentChange(5) === '+5,0 %', formatPercentChange(5));
}

console.log(`progress-change: ${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail === 0 ? 0 : 1);
