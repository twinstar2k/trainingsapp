# Übungstyp „Isometrisch" — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vierter Übungstyp `isometric` für statische Halteübungen (Plank, Wandsitz), gemessen in Minuten + Sekunden, gespeichert als `holdSeconds`.

**Architecture:** Folgt exakt dem bestehenden `cardio_basic`-Muster: Typ-Union in `shared/ai-types.ts`, neues optionales Satz-Feld, Typ-Branches in SetRow/ExerciseCard/ExerciseDetail, Metriken in `shared/metrics.ts`. KI-Coach wird für `isometric` und `cardio_basic` ausgeblendet (Policy/Functions unangetastet). Spec: `docs/superpowers/specs/2026-07-09-isometric-exercise-type-design.md`.

**Tech Stack:** React 19 + TypeScript (strict), Tailwind v4 (Design-Tokens wie `bg-surface-container-low`), Firestore, kein Test-Runner für App-Code (Verifikation = `tsc`-Build + Lint + manueller Dev-Check; die Eval-Suite in `eval/` betrifft nur den Policy-Kern und bleibt unberührt).

## Global Constraints

- UI-Texte auf Deutsch; Commit-Messages auf Deutsch mit Trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- TypeScript strict mode; keine `console.log`; CSS nur über Tailwind-Klassen/Tokens.
- `holdSeconds` ist IMMER Sekunden (number, optional); Cardio-`duration` (Minuten) bleibt unangetastet.
- Rules-Drift-Regel: `firestore.rules` ändert sich in Task 5 — Deploy (`firebase deploy --only firestore:rules`) erst nach Nutzer-Freigabe, aber VOR dem Hosting-Deploy.
- Outward-Aktionen (merge, push, deploy) nur nach ausdrücklicher Freigabe durch Josef.
- Branch: `feat/isometric-exercises` (existiert bereits).
- Verifikation nach jedem Task: `npm run build` (läuft `tsc -b && vite build`) muss grün sein.

---

### Task 1: Metrik-Helfer + Satz-Feld `holdSeconds`

Baut die reinen Daten-/Formel-Bausteine, ohne die Typ-Union anzufassen — Build bleibt nach jedem Schritt grün.

**Files:**
- Modify: `shared/metrics.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `SetData.holdSeconds?: number` (Sekunden), `TrainingSet.holdSeconds?: number`,
  `sessionMaxHold(sets: SetData[]): number` (Sekunden, 0 wenn keine), `sessionTotalHold(sets: SetData[]): number`,
  `formatHoldTime(totalSeconds: number): string` (`45 s` bzw. `1:30`),
  `formatLastSessionLabel(sets, type: 'weighted' | 'reps_only' | 'isometric')`.

- [ ] **Step 1: `SetData` und `TrainingSet` um `holdSeconds` erweitern**

In `shared/metrics.ts` (Interface `SetData`, Zeile 17–22):

```ts
export interface SetData {
  reps?: number;
  weight?: number;
  duration?: number; // minutes
  distance?: number; // km
  holdSeconds?: number; // Haltezeit in Sekunden (isometric)
}
```

In `src/types/index.ts` (Interface `TrainingSet`, Zeile 44–52):

```ts
export interface TrainingSet {
  id: string;
  reps?: number;
  weight?: number;
  duration?: number; // in minutes
  distance?: number; // in km
  holdSeconds?: number; // Haltezeit in Sekunden (isometric)
  status: 'open' | 'done';
  order: number;
}
```

- [ ] **Step 2: Hold-Metriken + Formatierung in `shared/metrics.ts` ergänzen**

Direkt nach `sessionTotalDistance` (nach Zeile 77) einfügen:

```ts
/** Longest hold in seconds in any single set (for isometric exercises). */
export function sessionMaxHold(sets: SetData[]): number {
  return sets.reduce((max, s) => {
    if (s.holdSeconds == null) return max;
    return s.holdSeconds > max ? s.holdSeconds : max;
  }, 0);
}

/** Total hold time in seconds summed across all sets. */
export function sessionTotalHold(sets: SetData[]): number {
  return sets.reduce((sum, s) => sum + (s.holdSeconds ?? 0), 0);
}

/** Format hold seconds as "45 s" (< 1 min) or "M:SS" (e.g. 90 → "1:30"). */
export function formatHoldTime(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  if (rounded < 60) return `${rounded} s`;
  const min = Math.floor(rounded / 60);
  const sec = rounded % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 3: `formatLastSessionLabel` um `isometric` erweitern**

Signatur (Zeile 105) ändern und den Isometrie-Zweig VOR dem bestehenden `doneSets`-Filter einschieben (der filtert auf `reps` und würde Halte-Sätze verschlucken). Doku-Kommentar über der Funktion um eine Zeile ergänzen:

```ts
/**
 * Formats the set structure of a session as a human-readable label.
 *
 * Weighted: "3 × 10 @ 50 kg" (wenn alle Sätze gleich)
 *           "bester Satz: 10 Wdh @ 50 kg" (wenn Sätze gemischt)
 * Reps only: "3 × 12 Wdh" or "max. 15 Wdh"
 * Isometric: "3 × 1:30" or "max. 1:30"
 */
export function formatLastSessionLabel(
  sets: SetData[],
  type: 'weighted' | 'reps_only' | 'isometric'
): string {
  if (type === 'isometric') {
    const holdSets = sets.filter(s => s.holdSeconds != null && s.holdSeconds > 0);
    if (holdSets.length === 0) return '';
    const maxHold = sessionMaxHold(holdSets);
    const allSame = holdSets.every(s => s.holdSeconds === holdSets[0].holdSeconds);
    if (allSame && holdSets.length > 1) {
      return `${holdSets.length} × ${formatHoldTime(maxHold)}`;
    }
    return `max. ${formatHoldTime(maxHold)}`;
  }

  const doneSets = sets.filter(s => s.reps != null && s.reps > 0);
  // ... Rest der Funktion unverändert
```

- [ ] **Step 4: Build prüfen**

Run: `npm run build`
Expected: exit 0, keine TS-Fehler.

- [ ] **Step 5: Commit**

```bash
git add shared/metrics.ts src/types/index.ts
git commit -m "feat(metrics): holdSeconds-Feld + Haltezeit-Metriken für isometrische Übungen

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Typ `isometric` + Fortschrittsanzeige

Die Union-Erweiterung zwingt via `Record<Exercise['type'], …>` (tsc) die `METRICS_BY_TYPE`-Erweiterung in `ExerciseDetail.tsx` — deshalb ein Task.

**Files:**
- Modify: `shared/ai-types.ts:7`
- Modify: `src/hooks/useExerciseProgress.ts`
- Modify: `src/pages/ExerciseDetail.tsx`

**Interfaces:**
- Consumes: `sessionMaxHold`, `sessionTotalHold`, `formatHoldTime` aus Task 1 (Import über `../utils/metrics`, das ist ein Re-Export von `shared/metrics`).
- Produces: `ExerciseType = 'weighted' | 'reps_only' | 'cardio_basic' | 'isometric'`; `SessionProgress.maxHold: number` und `SessionProgress.totalHold: number` (Sekunden); Metric-Keys `'maxHold' | 'totalHold'`.

- [ ] **Step 1: Typ-Union erweitern**

`shared/ai-types.ts` Zeile 7:

```ts
export type ExerciseType = 'weighted' | 'reps_only' | 'cardio_basic' | 'isometric';
```

- [ ] **Step 2: `useExerciseProgress.ts` — Hold-Werte laden und berechnen**

Import ergänzen (in der bestehenden Import-Liste aus `../utils/metrics`): `sessionMaxHold, sessionTotalHold`.

`SessionProgress` (Zeile 19–33) erweitern:

```ts
export interface SessionProgress {
  trainingId: string;
  date: string;
  studioId: string;
  maxWeight: number;
  volume: number;
  best1RM: number | null;
  maxReps: number;
  totalReps: number;
  totalDuration: number; // minutes
  totalDistance: number; // km
  maxHold: number; // seconds (isometric)
  totalHold: number; // seconds (isometric)
  pace: number | null; // decimal min/km
  bestSet: { reps: number; weight: number } | null;
  allSets: Array<{ reps?: number; weight?: number; duration?: number; distance?: number; holdSeconds?: number }>;
}
```

Sets-Mapping (Zeile 98–103) um `holdSeconds` ergänzen:

```ts
const sets = setsSnap.docs.map(d => ({
  reps: d.data().reps as number | undefined,
  weight: d.data().weight as number | undefined,
  duration: d.data().duration as number | undefined,
  distance: d.data().distance as number | undefined,
  holdSeconds: d.data().holdSeconds as number | undefined,
}));
```

Nach `const pace = sessionPace(sets);` (Zeile 114):

```ts
const maxHold = sessionMaxHold(sets);
const totalHold = sessionTotalHold(sets);
```

Und im `results.push({ … })` nach `totalDistance,`: `maxHold, totalHold,` ergänzen.

- [ ] **Step 3: `ExerciseDetail.tsx` — Metriken, Formatierung, Summary**

Import (Zeile 14): `import { formatPace, formatHoldTime } from '../utils/metrics';`

Metric-Definitionen (Zeile 16–44):

```ts
type Metric = 'maxWeight' | 'volume' | 'oneRM' | 'maxReps' | 'totalReps' | 'duration' | 'distance' | 'pace' | 'maxHold' | 'totalHold';

const METRIC_LABELS: Record<Metric, string> = {
  maxWeight: 'Max-Gewicht',
  volume: 'Volumen',
  oneRM: '1RM',
  maxReps: 'Max. Wdh',
  totalReps: 'Gesamt Wdh',
  duration: 'Dauer',
  distance: 'Distanz',
  pace: 'Pace',
  maxHold: 'Max. Haltezeit',
  totalHold: 'Gesamt-Haltezeit',
};

const METRIC_UNIT: Record<Metric, string> = {
  maxWeight: 'kg',
  volume: 'kg',
  oneRM: 'kg',
  maxReps: 'Wdh',
  totalReps: 'Wdh',
  duration: 'min',
  distance: 'km',
  pace: 'min/km',
  maxHold: '', // formatHoldTime liefert die Einheit mit ("45 s" / "1:30")
  totalHold: '',
};

const METRICS_BY_TYPE: Record<Exercise['type'], Metric[]> = {
  weighted: ['maxWeight', 'volume', 'oneRM'],
  reps_only: ['maxReps', 'totalReps'],
  cardio_basic: ['distance', 'duration', 'pace'],
  isometric: ['maxHold', 'totalHold'],
};
```

`metricValue` (Zeile 46–57) um zwei Cases ergänzen:

```ts
    case 'maxHold': return session.maxHold || null;
    case 'totalHold': return session.totalHold || null;
```

Nach `const isPaceMetric = …` (Zeile 140) ergänzen:

```ts
const isHoldMetric = activeMetric === 'maxHold' || activeMetric === 'totalHold';
```

`formatValue` (Zeile 148–155) — nach der Pace-Zeile einschieben:

```ts
    if (isHoldMetric) return formatHoldTime(value);
```

`YAxis` (Zeile 314–322) — `tickFormatter` und `unit` erweitern:

```tsx
tickFormatter={
  isPaceMetric ? (v: number) => formatPace(v)
  : isHoldMetric ? (v: number) => formatHoldTime(v)
  : undefined
}
unit={isPaceMetric || isHoldMetric ? undefined : ` ${unit}`}
```

Summary-Karte „Letztes Training" (Zeile 233–251) — Isometrie-Zweig zwischen `isCardio` und `isRepsMetric` einschieben:

```tsx
{isCardio ? (
  /* … bestehender Cardio-Block unverändert … */
) : isHoldMetric ? (
  lastSession.maxHold > 0 && (
    <p className="text-xs text-on-surface-variant mt-0.5">
      {lastSession.allSets.filter(s => s.holdSeconds != null && s.holdSeconds > 0).length} Sätze · max. {formatHoldTime(lastSession.maxHold)}
    </p>
  )
) : isRepsMetric ? (
  /* … bestehender Reps-Block unverändert … */
) : (
  /* … bestehender Weighted-Block unverändert … */
)}
```

- [ ] **Step 4: Build prüfen**

Run: `npm run build`
Expected: exit 0. (Falls tsc weitere Stellen anmeckert, die `ExerciseType` exhaustiv matchen: beheben — laut Exploration ist `METRICS_BY_TYPE` die einzige.)

- [ ] **Step 5: Commit**

```bash
git add shared/ai-types.ts src/hooks/useExerciseProgress.ts src/pages/ExerciseDetail.tsx
git commit -m "feat(progress): Übungstyp isometric — Haltezeit-Metriken in der Fortschrittsansicht

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Erfassung im Training (SetRow, ExerciseCard, Defaults)

**Files:**
- Modify: `src/components/training/SetRow.tsx`
- Modify: `src/components/training/ExerciseCard.tsx`
- Modify: `src/hooks/useTrainingSession.ts`

**Interfaces:**
- Consumes: `TrainingSet.holdSeconds` (Task 1), `ExerciseType` inkl. `'isometric'` (Task 2).
- Produces: `NumericSetField = 'weight' | 'reps' | 'duration' | 'distance' | 'holdSeconds'`.

- [ ] **Step 1: `SetRow.tsx` — Min|Sek-Eingabe für `isometric`**

`NumericSetField` (Zeile 6) erweitern:

```ts
export type NumericSetField = 'weight' | 'reps' | 'duration' | 'distance' | 'holdSeconds';
```

Nach dem `cardio_basic`-Block (nach Zeile 84) einfügen. Beide Felder schreiben auf EIN gespeichertes Feld `holdSeconds`; Übertrag ist erlaubt (90 in „Sek" → normalisiert sich beim Re-Render zu 1:30):

```tsx
      {type === 'isometric' && (
        <>
          <input
            type="number"
            min="0"
            value={set.holdSeconds ? Math.floor(set.holdSeconds / 60) : ''}
            onChange={(e) => {
              const min = parseInt(e.target.value) || 0;
              onUpdate('holdSeconds', min * 60 + ((set.holdSeconds ?? 0) % 60));
            }}
            disabled={!isActive}
            className={INPUT_CLASS}
            placeholder="0"
          />
          <input
            type="number"
            min="0"
            value={set.holdSeconds ? set.holdSeconds % 60 : ''}
            onChange={(e) => {
              const sek = parseInt(e.target.value) || 0;
              onUpdate('holdSeconds', Math.floor((set.holdSeconds ?? 0) / 60) * 60 + sek);
            }}
            disabled={!isActive}
            className={INPUT_CLASS}
            placeholder="0"
          />
        </>
      )}
```

- [ ] **Step 2: `ExerciseCard.tsx` — Spaltenköpfe + Coach-Button ausblenden**

Im Sets-Header (nach dem `cardio_basic`-Block, Zeile 97–102) ergänzen:

```tsx
            {details.type === 'isometric' && (
              <>
                <div className="flex-1 text-center">Min</div>
                <div className="flex-1 text-center">Sek</div>
              </>
            )}
```

Coach-Button (Zeile 132): Bedingung um die Typ-Prüfung erweitern — blendet den Coach auch bei Cardio aus (bestehende Lücke, Policy kennt nur weighted/reps_only). Kommentar anpassen:

```tsx
        {/* KI-Empfehlung pro Übung (Feature-Flag) — nur solange die Übung noch leer ist.
            Nur weighted/reps_only: der Policy-Kern kennt keine Zeit-/Cardio-Progression. */}
        {isActive && AI_RECOMMENDATIONS_ENABLED && sets.length === 0 &&
          (details.type === 'weighted' || details.type === 'reps_only') && (
```

(Der RIR-Block prüft bereits `weighted || reps_only` — keine Änderung nötig.)

- [ ] **Step 3: `useTrainingSession.ts` — Satz-Defaults**

In `addSet` (Zeile 126–136): Übernahme vom letzten Satz um `holdSeconds` ergänzen und Default-Zweig anfügen:

```ts
    if (exercise.sets.length > 0) {
      const lastSet = exercise.sets[exercise.sets.length - 1];
      if (lastSet.reps !== undefined) newSetData.reps = lastSet.reps;
      if (lastSet.weight !== undefined) newSetData.weight = lastSet.weight;
      if (lastSet.duration !== undefined) newSetData.duration = lastSet.duration;
      if (lastSet.distance !== undefined) newSetData.distance = lastSet.distance;
      if (lastSet.holdSeconds !== undefined) newSetData.holdSeconds = lastSet.holdSeconds;
    } else {
      if (exercise.details.type === 'weighted') { newSetData.reps = 10; newSetData.weight = 0; }
      else if (exercise.details.type === 'reps_only') { newSetData.reps = 10; }
      else if (exercise.details.type === 'cardio_basic') { newSetData.duration = 15; newSetData.distance = 0; }
      else if (exercise.details.type === 'isometric') { newSetData.holdSeconds = 0; }
    }
```

(Sätze sind in den Rules nicht feldvalidiert — kein Rules-Change nötig. `applyRecommendation` bleibt unangetastet, der Coach-Button ist für `isometric` ausgeblendet.)

- [ ] **Step 4: Build prüfen**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/training/SetRow.tsx src/components/training/ExerciseCard.tsx src/hooks/useTrainingSession.ts
git commit -m "feat(training): Min/Sek-Erfassung für isometrische Übungen; Coach-Button nur für weighted/reps_only

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: „Zuletzt"-Label für isometrische Übungen

**Files:**
- Modify: `src/hooks/useLastSession.ts`

**Interfaces:**
- Consumes: `formatLastSessionLabel(sets, 'weighted' | 'reps_only' | 'isometric')` aus Task 1.

- [ ] **Step 1: `holdSeconds` laden + Typ-Mapping erweitern**

Sets-Mapping (Zeile 57–60):

```ts
          const sets = setsSnap.docs.map(d => ({
            reps: d.data().reps as number | undefined,
            weight: d.data().weight as number | undefined,
            holdSeconds: d.data().holdSeconds as number | undefined,
          }));
```

Typ-Mapping (Zeile 64) — isometric durchreichen, alles andere wie bisher auf reps_only kollabieren:

```ts
          const type =
            exerciseType === 'weighted' || exerciseType === 'isometric'
              ? exerciseType
              : 'reps_only';
```

- [ ] **Step 2: Build prüfen**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLastSession.ts
git commit -m "feat(training): Zuletzt-Label zeigt Haltezeiten isometrischer Übungen (z. B. 3 × 1:30)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Katalog-UI, Seed und Firestore-Rules

**Files:**
- Modify: `src/pages/Exercises.tsx:8-12`
- Modify: `src/lib/seed.ts`
- Modify: `firestore.rules` (Zeile 54)

- [ ] **Step 1: Typ-Option im Katalog-Formular**

`TYPE_OPTIONS` in `Exercises.tsx`:

```ts
const TYPE_OPTIONS: { value: ExerciseType; label: string }[] = [
  { value: 'weighted', label: 'Gewicht' },
  { value: 'reps_only', label: 'Nur Wiederholungen' },
  { value: 'cardio_basic', label: 'Cardio' },
  { value: 'isometric', label: 'Isometrisch (Haltezeit)' },
];
```

- [ ] **Step 2: Seed-Übungen ergänzen**

In `src/lib/seed.ts` nach dem Cardio-Block (nach Zeile 62) einfügen:

```ts
  // Isometrisch (Haltezeit)
  { name: 'Unterarmstütz (Plank)', type: 'isometric', muscleGroup: 'Core', contextDependent: false },
  { name: 'Wandsitz', type: 'isometric', muscleGroup: 'Beine', contextDependent: false },
```

(Wirkt nur bei Neu-Setups — der Seed läuft nur, wenn der Katalog leer ist. Im Live-System legt der Admin die Übungen über die UI an.)

- [ ] **Step 3: Rules-Allowlist erweitern**

`firestore.rules` Zeile 54:

```
          && d.type in ['weighted', 'reps_only', 'cardio_basic', 'isometric']
```

**WICHTIG (Rules-Drift):** Ohne Rules-Deploy scheitert das Anlegen einer isometrischen Übung zur Laufzeit mit „Missing or insufficient permissions" — Deploy in Task 7, nach Freigabe.

- [ ] **Step 4: Build prüfen**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Exercises.tsx src/lib/seed.ts firestore.rules
git commit -m "feat(catalog): Typ Isometrisch anlegbar — Dropdown, Seed-Beispiele, Rules-Allowlist

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Doku (Backlog + CLAUDE.md)

Doku getrennt vom Code committen (Josefs Workflow).

**Files:**
- Modify: `docs/BACKLOG.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Backlog-Einträge**

In `docs/BACKLOG.md` unter `## Features` (ans Ende der Sektion) ergänzen:

```markdown
- **Isometrisch mit Gewicht (beschwerter Plank/Wall Sit):** Folge-Idee zum Übungstyp `isometric` (2026-07-09). Edgecase vom Edgecase — bewusst zurückgestellt. Falls Bedarf entsteht: entweder zweiter Typ oder optionales Gewichtsfeld am bestehenden Typ; beides rückwirkend problemlos (Sätze sind rules-seitig nicht feldvalidiert, neuer Typ-Wert = Ein-Zeilen-Änderung in `validExercise()`). Siehe Spec `docs/superpowers/specs/2026-07-09-isometric-exercise-type-design.md`.
```

Unter `## KI-Coach & Wissensbasis` (ans Ende der Sektion) ergänzen:

```markdown
- **Coach-Support für Haltezeit-Progression (isometrische Übungen):** Der „Coach fragen"-Button ist für `isometric` (und `cardio_basic`) bewusst ausgeblendet — der Policy-Kern kennt nur weighted/reps_only. Für Haltezeit-Progression (z. B. +10 s bei stabiler Leistung) bräuchte es: Branch in `shared/policy.ts`, Zeit-Felder im Tool-Schema (`functions/src/lib/schema.ts`), Prompt-Regeln, Guardrails, Kontext-Plumbing (`context.ts` liest bisher nur reps/weight) + Eval-Szenarien. Verdient zuerst einen Abschnitt in `docs/architecture/ai-coach-engine.md`.
```

- [ ] **Step 2: CLAUDE.md aktualisieren**

Überschrift `## Implementierter Funktionsumfang (Stand 2026-06-23)` → `(Stand 2026-07-09)`.

In der Bullet-Liste unter **Exercise Progress** nach der `reps_only`-Zeile ergänzen:

```markdown
  - `isometric`: Max. Haltezeit / Gesamt-Haltezeit — für statische Übungen wie Plank/Wandsitz, Erfassung in Min + Sek (gespeichert als `holdSeconds`, Sekunden)
```

In der KI-Zeile („KI-Trainingsempfehlung …") am Ende ergänzen: ` Coach-Button nur für weighted/reps_only (isometric/cardio bewusst ohne Coach).`

Im Bullet „Übungskatalog (global, 50 Übungen Seed…" die Zahl auf `52` anpassen.

- [ ] **Step 3: Commit**

```bash
git add docs/BACKLOG.md CLAUDE.md
git commit -m "docs: Übungstyp Isometrisch dokumentiert; Folge-Ideen (Gewicht, Coach-Haltezeit) ins Backlog

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Verifikation & Übergabe

- [ ] **Step 1: Vollständige Checks**

```bash
npm run build        # erwartet: exit 0
npm run lint         # erwartet: exit 0
cd eval && npm test  # erwartet: alle Policy-/Context-Tests grün (unberührt)
```

- [ ] **Step 2: Manuelle End-to-End-Prüfung mit `npm run dev`**

ACHTUNG: Der Dev-Server schreibt gegen das ECHTE Firestore. Solange die Rules nicht deployt sind, scheitert das Anlegen einer isometrischen Übung — das ist der erwartete Zustand vor dem Rules-Deploy. Prüfschritte (zusammen mit Josef):

1. Exercises-Seite: „Neue Übung" → Typ „Isometrisch (Haltezeit)" wählbar; Anlegen erst NACH Rules-Deploy testen.
2. Training starten, isometrische Übung hinzufügen: Satz-Eingabe zeigt Min | Sek; 1:30 erfassen; Satz abhaken.
3. Training abschließen; neues Training starten: „Zuletzt: 1 × 1:30"-Label erscheint (bzw. `max. …`).
4. ExerciseDetail: Metrik-Tabs „Max. Haltezeit" / „Gesamt-Haltezeit", Werte als „1:30" formatiert; Chart ab 2 Einheiten.
5. Coach-Button: erscheint bei isometrischer UND Cardio-Übung NICHT (bei leerer Satzliste, Flag an), bei weighted weiterhin.

- [ ] **Step 3: Abschluss nur nach Freigabe (superpowers:finishing-a-development-branch)**

Reihenfolge (Josefs Ship-Workflow, jede Outward-Aktion einzeln freigeben lassen):

```bash
firebase deploy --only firestore:rules      # VOR Hosting — sonst Rules-Drift
git checkout main && git merge feat/isometric-exercises
npm run build && firebase deploy --only hosting   # Hinweis: .env.local schaltet VITE_AI_RECOMMENDATIONS=true live
git push
```
