# Design: Übungstyp „Isometrisch" (Haltezeit-Übungen)

**Datum:** 2026-07-09
**Status:** Vom Nutzer freigegeben

## Kontext

Tester-Feedback: Statische/isometrische Übungen (Plank/Unterarmstütz, Wandsitz, Glute Bridge)
lassen sich bisher nicht anlegen. Sie werden in Minuten und Sekunden gemessen — keiner der
bestehenden Typen (`weighted`, `reps_only`, `cardio_basic`) passt: Gewicht/Wdh greifen nicht,
und Cardio (Minuten + Distanz) hat die falsche Auflösung und falsche Felder.

Ziel: Vierter Übungstyp `isometric`, dem bestehenden Cardio-Muster folgend.

## Entscheidungen

1. **Ein Typ, nur Haltezeit.** Kein Gewichtsfeld — beschwerte Varianten (Plank mit Scheibe)
   sind ein Edgecase vom Edgecase und kommen ggf. später (Backlog). Rückwirkend problemlos
   erweiterbar: Sätze sind in den Rules nicht feldvalidiert, neuer Typ-Wert wäre eine
   Ein-Zeilen-Änderung.
2. **Speicherung in Sekunden** — neues optionales Satz-Feld `holdSeconds?: number`.
   Bewusst nicht das Cardio-`duration` (Minuten) wiederverwendet: saubere Trennung,
   keine Bruch-Minuten.
3. **Eingabe als Min | Sek** — zwei Zahlenfelder nebeneinander (Stoppuhr-Stil), beim
   Speichern zu `holdSeconds` kombiniert.
4. **KI-Coach ausgeblendet** — „Coach fragen"-Button erscheint bei `isometric` und
   (Lücken-Fix nebenbei) bei `cardio_basic` nicht mehr. Policy/Functions unangetastet;
   Haltezeit-Progression im Coach ist ein eigenes Folgefeature (Backlog).

## Umsetzung

### Datenmodell & Rules

- `shared/ai-types.ts`: `ExerciseType` um `'isometric'` erweitern.
- `src/types/index.ts` (`TrainingSet`) und `shared/metrics.ts` (`SetData`):
  neues Feld `holdSeconds?: number` (Haltezeit in Sekunden).
- `firestore.rules`: `'isometric'` in die Typ-Allowlist von `validExercise()`;
  Rules im selben Change deployen (Rules-Drift-Regel). Sätze brauchen keine Rules-Änderung.

### Eingabe im Training

- `src/components/training/SetRow.tsx`: Bei `isometric` zwei Felder **Min | Sek**;
  Anzeige leitet `min = floor(holdSeconds/60)`, `sek = holdSeconds % 60` ab.
- `src/components/training/ExerciseCard.tsx`: Spaltenköpfe „Min | Sek";
  kein RIR-Block (wie Cardio); „Coach fragen"-Button bei `isometric` + `cardio_basic` ausblenden.
- `src/hooks/useTrainingSession.ts`: Default-Satzwerte für `isometric` (holdSeconds leer).

### Anzeige & Fortschritt

- `shared/metrics.ts`: `formatHoldTime(seconds)` → „1:30" bzw. „45 s";
  Metriken `sessionMaxHold`, `sessionTotalHold`;
  `formatLastSessionLabel` um `isometric` erweitern → z. B. „3 × 1:30".
- `src/hooks/useExerciseProgress.ts`: `holdSeconds` laden, Max-/Gesamt-Haltezeit berechnen.
- `src/pages/ExerciseDetail.tsx`: Metriken **Max. Haltezeit** / **Gesamt-Haltezeit**,
  Chart = Max-Haltezeit über die Zeit.
- `src/hooks/useLastSession.ts`: `holdSeconds` laden, Typ-Branch ergänzen
  (heute kollabiert alles Nicht-Weighted auf `reps_only`).

### Katalog & Seed

- `src/pages/Exercises.tsx`: Typ-Option „Isometrisch" im Dropdown
  (Typ bleibt nach Anlage fix, wie bisher; `repsProgression` bleibt weighted-only).
- `src/lib/seed.ts`: Beispiel-Übungen ergänzen (Unterarmstütz/Plank, Wandsitz) —
  betrifft nur Neu-Setups; im Live-System legt der Admin die Übungen über die UI an.

### Backlog

`docs/BACKLOG.md` ergänzen:
- „Isometrisch mit Gewicht" (beschwerter Plank/Wall Sit).
- „Coach-Support für Haltezeit-Progression" (Policy/Prompt/Guardrails/Eval).

## Bewusst nicht enthalten

- Timer/Stoppuhr in der App (nur Erfassung der Zeit).
- Coach-Empfehlungen für Haltezeiten.
- Datenmigration (es gibt keine bestehenden isometrischen Daten).

## Verifikation

- `npm run build` + `npm test` (Eval-Suite, unverändert grün).
- Lokal `npm run dev`: Übung „Unterarmstütz (Plank)" als Admin anlegen (Typ Isometrisch),
  Training starten, Sätze mit Min/Sek erfassen, abschließen; „Zuletzt"-Label und
  ExerciseDetail-Metriken/Chart prüfen; Coach-Button darf bei Isometrisch/Cardio nicht erscheinen.
- Deploy (nur nach Freigabe): `firebase deploy --only firestore:rules` **und** Hosting.
