# Design: Live-Progressionsanzeige während des Trainings

**Datum:** 2026-07-18
**Status:** Vom Nutzer freigegeben

## Kontext

Die Entwicklung von Volumen/Wdh ist bisher erst **nach** Abschluss eines Trainings im Verlauf
(`ExerciseDetail`) sichtbar. Um Progression während der Session zu steuern, muss man heute
selbst rechnen und in den Verlauf klicken. Ziel: **In der aktiven Übungskarte live sehen, wie
nah die aktuelle Leistung an der Bestleistung ist** — um gezielt zu versuchen, den Bestwert
zu schlagen oder nah heranzukommen.

## Entscheidungen

1. **Referenz = Bestleistung**, nicht die letzte Session. Datenbasis: die letzten 20
   abgeschlossenen Trainings (dieselbe Basis wie „Bestes je" auf der ExerciseDetail-Seite).
2. **Eine Kernmetrik je Übungstyp:** `weighted` → **Volumen** (Σ Gewicht × Wdh),
   `reps_only` → **Gesamt-Wdh**, `isometric` → **Gesamt-Haltezeit**. `cardio_basic` bleibt
   bewusst außen vor (wie beim Zuletzt-Label und Coach).
3. **Nur abgehakte Sätze zählen** (`status === 'done'`) — vorbelegte Plansätze verfälschen
   die Live-Zahl nicht; die Anzeige wächst mit jedem abgehakten Satz.
4. **Darstellung:** Fortschrittsbalken Richtung Bestwert + Restzeile
   „noch X bis Best (Y)". Bei Erreichen/Überschreiten: Balken voll in Akzentfarbe +
   „Bestleistung übertroffen! +X".
5. **Sichtbarkeit:** nur im aktiven Training; keine Anzeige ohne Historie (erste Session
   einer Übung) und nicht in abgeschlossenen Trainings.
6. **Kein Doppel-Query (Ansatz B):** Der bestehende `useLastSession`-Hook wird zu
   `useExerciseReference` erweitert — ein Query-Durchlauf liefert Zuletzt-Label UND
   Bestwert. Kein Backend-Touch (keine Rules-/Functions-/Index-Änderung).

## Umsetzung

### Hook: `src/hooks/useLastSession.ts` → `src/hooks/useExerciseReference.ts`

- Query-Gerüst unverändert (`status == 'completed'`, bei `contextDependent` zusätzlich
  `studioId ==`, `orderBy('date','desc')`), **Limit 10 → 20** für dieselbe Datenbasis wie
  `useExerciseProgress`.
- Statt beim ersten Treffer zu stoppen: alle Trainings mit dieser Übung laden
  (Subqueries parallel via `Promise.all`, Muster aus `useExerciseProgress`).
  - Zuletzt-Label: neuester Treffer via `formatLastSessionLabel` (shared/metrics)
  - Bestwert: Maximum der Referenzmetrik über alle Treffer
    (`sessionVolume` / `sessionTotalReps` / `sessionTotalHold`)
- Rückgabe: `{ label, best: { value, date } | null, loading }` + `enabled`-Parameter,
  damit der Hook in abgeschlossenen Trainings nicht lädt.

### UI

- `src/components/LastSessionLabel.tsx` wird rein präsentational (`label`-Prop);
  der Hook-Aufruf wandert in die `ExerciseCard` (ein Aufruf versorgt Label + Balken).
- Neu: `src/components/training/LiveProgressBar.tsx` —
  Props `current`, `best { value, date }`, `type`. Balken (`min(current/best, 1)`),
  Restzeile; ab `current >= best` Akzentfarbe (amber = Rekord) + Übertroffen-Text.
  Formatierung: kg/Wdh gerundet, Haltezeit via `formatHoldTime`.
- `src/components/training/ExerciseCard.tsx`: Live-Wert = Referenzmetrik über
  `sets.filter(s => s.status === 'done')` (shared/metrics, identische Mathematik wie
  Historie); Balken im Header-Block unter der Namenszeile, volle Kartenbreite.

## Verifikation

`npm run build` (strict) + `npm run dev`: Balken erscheint nur im aktiven Training mit
Historie, wächst nur beim Abhaken, Bestwert deckt sich mit „Bestes je" (Volumen) auf der
ExerciseDetail-Seite, Übertroffen-Zustand beim Überschreiten, reps_only/isometric geprüft.
