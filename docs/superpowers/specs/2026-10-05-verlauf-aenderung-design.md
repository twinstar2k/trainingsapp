# Prozentuale Änderung im Übungsverlauf — Design

**Datum:** 2026-10-05
**Betrifft:** `src/pages/ExerciseDetail.tsx`, neu `src/utils/progressChange.ts`

## Anlass

Die Verlaufsansicht einer Übung zeigt eine Kurve je Metrik, aber keine Aussage darüber, wie viel
sich über die Kurve hinweg getan hat. Start- und Endwert muss man selbst ablesen und im Kopf
rechnen. Neu steht die relative Änderung vom ersten zum letzten Punkt der Kurve direkt am Chart —
z. B. Volumen 2175 kg → 3195 kg = **+46,9 %**.

## Entscheidungen

| Frage | Entscheidung | Grund |
|---|---|---|
| Für welche Metriken? | Alle, die der Chart zeigt | Eine Rechenregel, kein Sonderfall im Code |
| Wo? | Im Chart-Kopf, rechts neben „Verlauf · {Metrik}" | Sitzt an der Kurve, auf die sie sich bezieht, und wechselt mit dem Metrik-Tab |
| Wie genau? | Eine Nachkommastelle, deutsches Komma | Verglichen werden zwei einzelne Einheiten; eine zweite Stelle täuscht Genauigkeit vor |

## Verhalten

- **Basis sind exakt die Punkte der Kurve** (`chartSessions`: aufsteigend nach Datum, ohne
  Null-Werte, höchstens 20 Einheiten dieser Übung). Die Zahl passt damit immer zu dem, was man
  sieht — bei 1RM etwa ohne Einheiten mit mehr als 15 Wiederholungen. „Ausgangspunkt" heißt also:
  ältester Punkt der sichtbaren Kurve, nicht die allererste Einheit überhaupt.
- **Formel:** `(letzter − erster) / erster × 100`, gerundet auf 0,1.
- **Sichtbar nur, wenn auch der Chart gezeichnet wird** (mindestens 2 Punkte, Studio steht fest,
  nicht ladend, kein Fehler). Sonst erscheint nichts, auch kein Platzhalter.
- **Format:** `+46,9 %`, `−3,2 %` (echtes Minuszeichen), `0,0 %` ohne Vorzeichen.
- **Farbe folgt der Bewertung, der Pfeil der Richtung der Zahl:**
  - besser → Grün (`text-primary`), schlechter → Rot (`text-error`), unverändert → neutral
  - Bei Pace ist niedriger besser: −5,0 % erscheint grün mit Pfeil nach unten.
  - „Unverändert" richtet sich nach dem gerundeten Wert, damit `0,0 %` nie eingefärbt ist.
- **Zweite Zeile:** Startwert → Endwert in der Einheit der Metrik (`2175 kg → 3195 kg`).

## Aufbau

Die Rechnung liegt als reine Funktion in `src/utils/progressChange.ts`
(`computeProgressChange`, `formatPercentChange`), getestet in `eval/progress-change.test.mjs`.
Sie liegt bewusst nicht in `shared/`: Nur die App braucht sie, und ein Change in `shared/` zöge
einen Functions-Deploy nach sich. Die Seite reicht die Werte der Kurve hinein und rendert das
Ergebnis; Hook, Typen, Firestore und Rules bleiben unberührt.

## Bekannte Grenze

Der Wert vergleicht zwei einzelne Einheiten. Ein schwacher erster oder letzter Tag verschiebt ihn
deutlich; er ist eine Lesehilfe für die Kurve, kein geglätteter Trend. Den Trend über mehrere
Einheiten bewertet weiterhin der Coach (`shared/policy.ts`, `computeTrend`).
