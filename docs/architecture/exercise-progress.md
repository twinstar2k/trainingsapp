# Technisches Design: Exercise Progress

## 1. Architektur-Übersicht

```
User tippt Übungsname
        │
        ▼
TrainingDetail (aktives Training)
        │  navigate('/exercises/:exerciseId', { state: { fromTrainingId } })
        ▼
ExerciseDetailPage
        │
        ├─ useExerciseProgress(exerciseId, studioId?)
        │         │
        │         ├─ collectionGroup('sets') Query (gefiltert auf exerciseId via parent)
        │         │  ODER
        │         └─ Query: users/{uid}/trainings → je Training exercises-Sub-Query
        │
        ├─ ExerciseSummaryCard         ← Bestes je / Letzte Session
        ├─ MetricTabBar                ← Max-Gewicht | Volumen | 1RM
        └─ ProgressChart (Recharts)    ← Linienchart, letzte 20 Sessions
```

**Datenfluss für "Letztes Mal"-Label im aktiven Training:**

```
TrainingDetail mountet Übung
        │
        └─ useLastSession(exerciseId, studioId?, contextDependent)
                  │
                  └─ Query: trainings (completed, desc date, limit 1 mit dieser Übung)
                            → sets dieser Übung → Satzstruktur-Label
```

---

## 2. Datenmodell

### Bestehende Strukturen (keine Änderung)

Das bestehende Modell reicht aus — kein neues Feld, keine neue Collection nötig.

```
users/{uid}/trainings/{trainingId}
  └── exercises/{exerciseId_instance}
        ├── exerciseId: string       ← Referenz auf globalen Katalog
        ├── order: number
        ├── status: 'open' | 'done'
        └── sets/{setId}
              ├── reps?: number
              ├── weight?: number
              ├── duration?: number
              ├── distance?: number
              ├── status: 'open' | 'done'
              └── order: number
```

Das Training-Dokument enthält bereits `studioId` und `status` — beides wird für die Filterlogik genutzt.

### Query-Strategie (ADR-01 begründet diese Entscheidung)

**Gewählter Ansatz: Zweistufige Query**

1. **Schritt 1 — Trainings laden:**
   ```
   Query: users/{uid}/trainings
     WHERE status == 'completed'
     ORDER BY date DESC
     LIMIT 20 (+ ggf. studioId filter)
   ```

2. **Schritt 2 — Exercises pro Training filtern:**
   Für jedes Training: Sub-Collection `exercises` nach `exerciseId` filtern, dann `sets` laden.

   Da wir maximal 20 Trainings laden und jedes Training typischerweise 5–12 Übungen hat, sind das ≤ 20 parallele Queries — akzeptabel für einen MVP.

### Berechnete Typen (nur Frontend, kein Firestore-Dokument)

```typescript
interface SessionProgress {
  trainingId: string;
  date: string;           // YYYY-MM-DD
  studioId: string;
  maxWeight: number;      // Höchstes Gewicht dieser Session
  volume: number;         // Σ(weight × reps) aller Sätze
  best1RM: number | null; // Epley-Wert des besten Satzes, null wenn alle Reps > 15
  bestSet: {              // Für Zusammenfassung & "Letztes Mal"-Label
    reps: number;
    weight: number;
  };
  allSets: Array<{ reps: number; weight?: number }>;
}
```

### Indizes

**Firestore Composite Index erforderlich:**

| Collection | Felder | Zweck |
|---|---|---|
| `users/{uid}/trainings` | `status ASC`, `date DESC` | Completed Trainings laden |
| `users/{uid}/trainings` | `status ASC`, `studioId ASC`, `date DESC` | context_dependent Filter |

Diese Indizes sind in `firestore.indexes.json` einzutragen.

### Sicherheitsregeln

Keine neuen Rules nötig — bestehende Rule `allow read, write: if request.auth.uid == userId` auf `users/{userId}/**` deckt alle Sub-Collections ab.

---

## 3. Schnittstellen / API

### Aktion: Exercise Progress laden

**Datenfluss:**
```
ExerciseDetailPage
  → useExerciseProgress(exerciseId, contextDependent, currentStudioId)
  → Firestore: trainings (completed, letzte 20, ggf. studioId-Filter)
  → Pro Training: exercises Sub-Query nach exerciseId
  → Pro Exercise: sets Sub-Collection laden
  → Client: SessionProgress[] berechnen (maxWeight, volume, 1RM)
  → Chart + Summary rendern
```

**Input (Hook-Parameter):**
```typescript
{
  exerciseId: string;
  contextDependent: boolean;
  currentStudioId: string;  // Studio des laufenden/letzten Trainings
}
```

**Output (Hook-Return):**
```typescript
{
  sessions: SessionProgress[];   // Aufsteigend nach Datum (für Chart)
  loading: boolean;
  error: string | null;
}
```

**Fehlerszenarien:**
- Keine Sessions: `sessions = []` → Empty State "Noch nicht trainiert"
- Genau 1 Session: `sessions.length === 1` → kein Chart, Hinweis "Mindestens 2 Einheiten nötig"
- Alle Sätze Reps > 15: `best1RM = null` → 1RM-Tab zeigt Hinweistext

---

### Aktion: "Letztes Mal"-Label laden

**Datenfluss:**
```
TrainingDetail (Übung wird gerendert)
  → useLastSession(exerciseId, contextDependent, currentStudioId)
  → Firestore: trainings (completed, studioId-Filter wenn contextDependent, limit 5)
  → Für jedes Training prüfen: hat diese exerciseId eine Done-Exercise?
  → Ersten Treffer nehmen → sets laden → Label formatieren
```

**Output:**
```typescript
{
  label: string | null;  // z.B. "Zuletzt: 3 × 10 @ 50 kg" oder null
  loading: boolean;
}
```

**Label-Format:**
- Weighted: `"Zuletzt: {satzanzahl} × {reps} @ {gewicht} kg"` (bei einheitlichen Sätzen) oder `"Zuletzt: {bester Satz}: {reps} Wdh @ {gewicht} kg"` (bei gemischten Sätzen)
- Reps only: `"Zuletzt: {max reps} Wdh"`
- Keine Session gefunden: `null` → kein Label anzeigen

---

## 4. Frontend-Komponenten

```
src/pages/ExerciseDetail.tsx              ← Neue Seite, Route: /exercises/:exerciseId
├── ExerciseSummaryCard                   ← "Bestes je" + "Letzte Session"
│     Props: sessions: SessionProgress[], exercise: Exercise
├── MetricTabBar                          ← Tab-Auswahl: Max-Gewicht | Volumen | 1RM
│     Props: activeMetric, onChange
├── ProgressChart                         ← Recharts LineChart
│     Props: sessions: SessionProgress[], metric: 'maxWeight'|'volume'|'oneRM'
│     Zeigt: Linienchart mit Datum auf X-Achse
└── EmptyState                            ← Wenn < 2 Sessions

src/hooks/useExerciseProgress.ts          ← Datenladelogik (Hook)
src/hooks/useLastSession.ts               ← "Letztes Mal"-Label (Hook)
src/utils/metrics.ts                      ← Epley-Berechnung, Label-Formatierung
```

### State-Management

| State | Ort | Beschreibung |
|---|---|---|
| `sessions` | `useExerciseProgress` | Geladene und berechnete Fortschrittsdaten |
| `activeMetric` | `ExerciseDetail` (useState) | Aktuell gewählte Metrik |
| `exercise` | `ExerciseDetail` | Übungsdaten aus globalem Katalog |
| `lastSessionLabel` | `useLastSession` | Label-String für TrainingDetail |

### Navigation

- **Einstieg:** `TrainingDetail` → `navigate('/exercises/:exerciseId', { state: { fromTrainingId: id } })`
- **Zurück:** Standard Back-Button des Browsers / native Navigation — kein spezieller Handler nötig
- **Zukünftig:** Auch aus einer globalen Übungsliste navigierbar (gleiche Route)

### Chart-Details

- **Bibliothek:** Recharts (bereits installiert, genutzt in Weight.tsx)
- **Typ:** `LineChart` mit `ResponsiveContainer`
- **X-Achse:** `date` formatiert als `dd.MM` (via date-fns)
- **Y-Achse:** Einheit je nach Metrik (kg / kg Volumen)
- **Default-Tab:** Max-Gewicht (laut Requirements-Entscheidung)
- **Datenpunkte:** Max. 20 Sessions

---

## 5. Sicherheitsaspekte

- **Authentifizierung:** Alle Queries laufen unter `users/{uid}/...` — nur der eingeloggte User kann seine eigenen Trainings lesen
- **Autorisierung:** Bestehende Firestore Security Rules (`allow read, write: if request.auth.uid == userId`) decken alle Sub-Collections ab
- **Datentrennung:** `exerciseId` ist eine Referenz auf den globalen Katalog — keine User-Daten enthalten. Die Satz-Daten liegen ausschließlich in der User-Sub-Collection
- **Validierung:** Epley-Berechnung nur auf Client-Seite; keine schreibenden Operationen in diesem Feature

---

## 6. Technische Entscheidungen (ADR)

### ADR-01: Zweistufige Query statt collectionGroup
**Status:** Akzeptiert
**Kontext:** Um alle Sätze einer Übung über alle Trainings zu finden, gibt es zwei Ansätze: (a) Firestore `collectionGroup('sets')` mit Filter auf ein Feld, das `exerciseId` enthält, oder (b) zuerst Trainings laden, dann Sub-Collections filtern.
**Problem mit collectionGroup:** Die Sets-Collection enthält `exerciseId` nicht direkt — sie liegt in der Parent-Collection `exercises`. Eine collectionGroup-Query auf `sets` kann nicht nach dem Feld eines Parent-Dokuments filtern. Eine Denormalisierung (exerciseId in jeden Set schreiben) wäre nötig, ändert aber das bestehende Datenmodell.
**Entscheidung:** Zweistufige Query: Trainings laden → exercises filtern → sets laden. Für 20 Trainings sind das ≤ 20 parallele Firestore-Reads — performant und ohne Datenmigration.
**Konsequenzen:** Etwas mehr Client-seitige Logik; kein neuer Firestore-Index auf sets; kein Breaking Change am Datenmodell.
**Alternativen verworfen:** Denormalisierung (exerciseId in sets schreiben) — erhöht Schreibkomplexität und erfordert Datenmigration aller bestehenden Sets.

---

### ADR-02: Epley-Berechnung auf dem Client
**Status:** Akzeptiert
**Kontext:** Die 1RM-Schätzung könnte als gespeicherter Wert in Firestore oder als berechneter Wert im Client vorliegen.
**Entscheidung:** Reine Client-Berechnung. Formel: `1RM = weight × (1 + reps / 30)`, nur wenn `reps ≤ 15`.
**Konsequenzen:** Kein zusätzliches Feld in Firestore; Formel kann jederzeit angepasst werden ohne Datenmigration; minimaler Rechenaufwand.

---

### ADR-03: context_dependent — nur aktuelles Studio
**Status:** Akzeptiert (aus Requirements)
**Kontext:** Bei Maschinen/Seilzugübungen sind Gewichte nur innerhalb desselben Studios vergleichbar.
**Entscheidung:** Das Studio des laufenden oder zuletzt abgeschlossenen Trainings wird als Filter verwendet. Kein Studio-Switcher in der MVP-Version.
**Konsequenz:** User sieht nur Daten vom aktuell relevanten Studio — konsistent mit dem Kontext, in dem er gerade trainiert.

---

## 7. Übergabe an Entwickler

### Firebase / Data Engineer

1. **Firestore Indexes** in `firestore.indexes.json` eintragen:
   ```json
   {
     "indexes": [
       {
         "collectionGroup": "trainings",
         "queryScope": "COLLECTION",
         "fields": [
           { "fieldPath": "status", "order": "ASCENDING" },
           { "fieldPath": "date", "order": "DESCENDING" }
         ]
       },
       {
         "collectionGroup": "trainings",
         "queryScope": "COLLECTION",
         "fields": [
           { "fieldPath": "status", "order": "ASCENDING" },
           { "fieldPath": "studioId", "order": "ASCENDING" },
           { "fieldPath": "date", "order": "DESCENDING" }
         ]
       }
     ]
   }
   ```

2. **Security Rules** prüfen: Sicherstellen, dass `users/{userId}/trainings/{trainingId}/exercises/{exerciseId}/sets` durch die bestehende Wildcard-Rule `users/{userId}/**` abgedeckt ist.

3. **Kein Datenmigrations-Skript** nötig — bestehende Daten sind kompatibel.

---

### Frontend Developer

**Neue Dateien:**

| Datei | Beschreibung |
|---|---|
| `src/pages/ExerciseDetail.tsx` | Hauptseite: Chart + Summary + Tabs |
| `src/hooks/useExerciseProgress.ts` | Daten laden + SessionProgress berechnen |
| `src/hooks/useLastSession.ts` | "Letztes Mal"-Label für TrainingDetail |
| `src/utils/metrics.ts` | Epley-Formel, Label-Formatierung |

**Anpassungen bestehender Dateien:**

| Datei | Änderung |
|---|---|
| `src/App.tsx` | Route `/exercises/:exerciseId` hinzufügen |
| `src/pages/TrainingDetail.tsx` | Übungsname antippbar machen → navigiert zu `/exercises/:exerciseId`; "Letztes Mal"-Label unter Übungsname rendern via `useLastSession` |

**Implementierungsreihenfolge (empfohlen):**

1. `src/utils/metrics.ts` — Epley + Label (reine Funktionen, leicht testbar)
2. `src/hooks/useExerciseProgress.ts` — Daten laden
3. `src/pages/ExerciseDetail.tsx` — Seite mit Chart und Summary
4. Route in `App.tsx` eintragen
5. Navigation in `TrainingDetail.tsx` verdrahten
6. `src/hooks/useLastSession.ts` + Label in `TrainingDetail.tsx`

**Design-Hinweise:**
- Gleiche Card-Styles wie Weight.tsx: `bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm`
- Chart: gleiche Recharts-Konfiguration wie Weight.tsx (Farbe: `#059669`, `strokeWidth={3}`)
- Tabs als Chips: `rounded-full px-3 py-1 text-sm font-semibold`, aktiv: `bg-primary text-on-primary`, inaktiv: `bg-surface-container text-on-surface-variant`
- Empty State: Gleiche Abstands- und Textkonventionen wie andere Seiten
