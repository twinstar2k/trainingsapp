# Design: Listen gruppieren — Trainings nach Monat, Übungen nach Muskelgruppe

**Datum:** 2026-07-23
**Status:** Genehmigt (Brainstorming mit Josef)

## Problem

Beide Hauptlisten der App sind flache Scrollisten und mit wachsender Datenmenge
unübersichtlich geworden:

- **Trainings-Seite** (`src/pages/Trainings.tsx`): alle Trainings absteigend nach
  Datum, eine lange Liste.
- **Übungskatalog** (`src/pages/Exercises.tsx`): 52+ Übungen alphabetisch,
  Muskelgruppe nur als Badge sichtbar.
- **Übungsauswahl-Modal** (`src/components/training/ExerciseCatalogModal.tsx`):
  derselbe Katalog, ebenfalls flach.

## Entscheidungen

1. **Trainings:** einklappbare Monats-Sektionen; der neueste Monat startet offen,
   ältere zugeklappt. Monate mit einem aktiven Training starten ebenfalls offen —
   ein aktives Training darf nie versteckt sein.
2. **Übungskatalog:** einklappbare Muskelgruppen-Sektionen (alphabetisch), alle
   starten zugeklappt. Bei aktiver Suche werden Gruppen mit Treffern automatisch
   offen angezeigt, Gruppen ohne Treffer verschwinden.
3. **Übungsauswahl-Modal:** gleiche Gruppierung wie der Katalog (Konsistenz; beim
   Zusammenstellen eines Trainings denkt man in Muskelgruppen). Die Suche behält
   den AutoFocus — Tippen bleibt der schnellste Weg.

Reiner UI-Umbau: keine Firestore-, Rules- oder Datenmodell-Änderung, keine neuen
Queries.

## Architektur

- **`src/components/ui/CollapsibleSection.tsx`** (neu): wiederverwendbare,
  kontrollierte Sektion (`title`, `count`, `open`, `onToggle`, `children`).
  Kopfzeile als Button mit Count-Badge und rotierendem Chevron; Design-Tokens wie
  im Rest der App. Kein interner State — die Seiten halten die offenen Keys, weil
  Auto-Öffnen (Suche, neuester Monat) von außen kommt.
- **`src/utils/groupExercises.ts`** (neu): gruppiert den Katalog nach
  `muscleGroup` in alphabetisch sortierte Gruppen; geteilt zwischen
  Exercises-Seite und Modal.
- **Trainings.tsx:** Monats-Key = `date.slice(0, 7)`; Titel via date-fns
  `format(..., 'MMMM yyyy', { locale: de })`. Open-State `Set<string>`,
  initialisiert nach dem Laden.
- **Exercises.tsx / Modal:** Open-State `Set<string>`, initial leer. Bei
  nicht-leerem Suchbegriff wird der Open-Zustand abgeleitet überschrieben (alle
  Treffer-Gruppen offen); Suche leeren stellt den manuellen Zustand wieder her.
  Der Muskelgruppen-Badge in der Zeile entfällt (redundant zum Sektionstitel).

## Verifikation

`npm run build` (tsc strict) + Dev-Server-Smoke. Eingeloggte Flows prüft Josef
selbst im Browser (Auth-Wall, echtes Firestore) — danach Merge + Deploy.
