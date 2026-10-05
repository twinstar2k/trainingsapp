// Prozentuale Änderung über eine Verlaufskurve — kein React, kein Firestore.
//
// Warum hier und nicht in der Seite (CLAUDE.md, Code-Konventionen): Die Anzeige entscheidet
// (gibt es einen Bezugswert? besser oder schlechter?) und rechnet. Dieser Teil muss ohne
// laufende App prüfbar sein — Test: eval/progress-change.test.mjs.
//
// Zentrale Regel: Verglichen werden NUR der erste und der letzte Punkt der Kurve. Das ist
// eine Lesehilfe für das, was man sieht, kein geglätteter Trend — den bewertet der Coach
// (shared/policy.ts, computeTrend).

/** Bewertung der Änderung — nicht ihr Vorzeichen (bei Pace ist ein Minus „besser"). */
export type ChangeDirection = 'better' | 'worse' | 'flat';

export interface ProgressChange {
  /** Wert des ersten Kurvenpunkts. */
  first: number;
  /** Wert des letzten Kurvenpunkts. */
  last: number;
  /** Relative Änderung in Prozent, vorzeichenbehaftet, auf 0,1 gerundet. */
  percent: number;
  direction: ChangeDirection;
}

/**
 * Änderung vom ersten zum letzten Wert der Kurve.
 *
 * `null`, wenn es nichts zu vergleichen gibt: weniger als zwei Punkte oder ein Startwert
 * ≤ 0 (ohne positiven Bezugswert ist eine Prozentangabe sinnlos).
 *
 * Die Richtung richtet sich nach dem GERUNDETEN Wert — eine Änderung, die als „0,0 %"
 * erscheint, ist `flat` und wird damit nie eingefärbt.
 */
export function computeProgressChange(
  values: number[],
  lowerIsBetter = false
): ProgressChange | null {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (!(first > 0)) return null;

  // „+ 0" macht aus −0 eine 0 (Math.round(-0.04) liefert −0).
  const percent = Math.round(((last - first) / first) * 1000) / 10 + 0;

  let direction: ChangeDirection = 'flat';
  if (percent !== 0) {
    direction = percent > 0 !== lowerIsBetter ? 'better' : 'worse';
  }
  return { first, last, percent, direction };
}

/** „+46,9 %", „−3,2 %", „0,0 %" — deutsches Komma, echtes Minuszeichen. */
export function formatPercentChange(percent: number): string {
  const sign = percent > 0 ? '+' : percent < 0 ? '−' : '';
  return `${sign}${Math.abs(percent).toFixed(1).replace('.', ',')} %`;
}
