# Projektkontext: Trainingsapp

## Produktziel

Persönliche Web-App zur Erfassung und Analyse von Krafttraining. Die App beantwortet vier zentrale Fragen:
- Hat sich eine Übung verbessert?
- Wie entwickelt sich das Trainingsvolumen?
- Wie verändert sich das Körpergewicht?
- Ist ein Vergleich fachlich zulässig, wenn unterschiedliche Studios genutzt wurden?

**Leitprinzip:** Die analytische Qualität der Daten hat Vorrang vor Feature-Vielfalt. Vergleiche nur im passenden Kontext.

## Zielgruppe

- Primär: Entwickler selbst + Partnerin (aktive Nutzung)
- Sekundär: Freunde zum Testen und für Feedback
- Mehrbenutzerfähig: Jeder User hat eigenen Datenraum

## Tech-Stack

> Versionen abgeglichen mit `package.json` und `functions/package.json` (Stand 2026-06-16).

### Frontend (App)

| Bereich | Technologie | Version |
|---------|-------------|---------|
| Framework | React + React DOM | `^19.2.4` |
| Sprache | TypeScript (strict mode) | `~5.9.3` |
| Build-Tool | Vite | `^8.0.1` |
| React-Plugin | `@vitejs/plugin-react` | `^6.0.1` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | `^4.1.14` |
| Routing | `react-router-dom` | `^7.13.1` |
| Charts | Recharts | `^3.8.0` |
| Icons | `lucide-react` | `^0.546.0` |
| Animationen | `motion` (Framer Motion) | `^12.23.24` |
| Datums-Utils | `date-fns` | `^4.1.0` |
| Class-Utils | `clsx` + `tailwind-merge` | `^2.1.1` / `^3.5.0` |
| Firebase-Client-SDK | `firebase` | `^12.11.0` |

**Tailwind-Besonderheit:** v4 ohne `tailwind.config.js` — Config via `@theme`-Block in `src/index.css`. Google Fonts via `<link>` in `index.html` (nicht CSS `@import`).

### Backend / Cloud

| Bereich | Technologie | Version / Detail |
|---------|-------------|------------------|
| Plattform | Firebase-Projekt `mvp-app-claude` | Region `europe-west3` |
| Auth | Firebase Authentication | Google Login (`signInWithPopup`) |
| Datenbank | Cloud Firestore (NoSQL) | Security Rules deny-by-default; Client mit erzwungenem Long-Polling |
| Hosting | Firebase Hosting | live: mvp-app-claude.web.app |
| Functions | Cloud Functions | Node **22**, `firebase-functions ^7.2.5`, `firebase-admin ^12.6.0` |

Cloud Function: Callable `getTrainingRecommendation` für die KI-Empfehlung. Sonstiger Datenzugriff läuft direkt über Firestore Security Rules.

**Firestore-Client-Transport:** In `src/lib/firebase.ts` wird der Client via `initializeFirestore(app, { experimentalForceLongPolling: true })` initialisiert (nicht `getFirestore`). Auf Mobilnetzen blieb die erste `getDocs`-Anfrage einer frisch geöffneten Liste sonst hängen — Long-Polling ist dort robuster. Details siehe CLAUDE.md → Firebase-Konventionen.

### KI-Schicht

- **LLM-Gateway:** Requesty (`router.eu.requesty.ai`, EU, OpenAI-kompatibel)
- **Secret:** `REQUESTY_API_KEY` in Google Secret Manager
- **Feature-Flag:** `VITE_AI_RECOMMENDATIONS` (default AUS)
- **Architektur:** Policy-first — deterministischer Coach-Kern (`shared/policy.ts`, Double Progression + RIR-Autoregulation + Trend/Plateau) rechnet, das LLM begründet nur. Siehe `docs/architecture/ai-coach-engine.md`.

### Tooling & Struktur

- **Linting:** ESLint `^9.39.4` (flat config) + `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- **Geteilter Code:** `shared/` (Metriken, KI-Vertragstypen, Policy-Kern) — Single Source für App **und** Functions (ADR-04)
- **Eval:** `eval/` — zero-dependency Eval-Harness + Offline-Tests (`npm test`)
- **Indizes:** `firestore.indexes.json` (Composite: `status+date`, `status+studioId+date`)
- **Entwicklung:** Claude Code (CLI)

### Betrieb

- **Deploy:** `npm run build && firebase deploy --only hosting` (analog für `functions` / `firestore:rules` / `firestore:indexes`)
- **Backup:** nächtlicher Firestore-Dump via Cron (20:00) ins private Repo `twinstar2k/trainingsapp-backup` (eigenes Node-Projekt mit `firebase-admin`), plus clientseitiger JSON-Export (`src/lib/export.ts`)

## Kernkonzept: context_dependent

Die zentrale Besonderheit der App ist das `context_dependent`-Flag pro Übung:

- **context_dependent = true:** Maschinen- und Seilzugübungen. Fortschritt wird **pro Studio** angezeigt. Grund: Gewichtsübersetzung der Maschinen unterscheidet sich zwischen Studios (z.B. Butterfly 80 kg im David Lloyd vs. 50 kg im peoples bei vergleichbarer Leistung).
- **context_dependent = false:** Freie Gewichte, Bodyweight, Cardio. Fortschritt wird **global** verglichen.

Namensprefix bestimmt das Flag:
- `Maschine *`, `Seilzug *`, `GTS *` → context_dependent: true
- `Kurzhantel *`, `Langhantel *`, `Kettlebell *` → context_dependent: false
- Bodyweight (Dips, Liegestütze, Beinheben) → context_dependent: false
- Cardio (Laufband, Indoor Cycle, Rudern Ergometer) → context_dependent: false

## Datenmodell (Firestore)

```
allowlist/{email}               → Zugangs-Allowlist (Doc-ID = E-Mail lowercase); nur Console/Admin
exercises (global)              → id, name, type, muscleGroup, contextDependent, repsProgression
users/{uid}                     → name, birthday, email, createdAt
users/{uid}/studios             → name, createdAt
users/{uid}/weightHistory       → date, weight
users/{uid}/trainings           → date, studioId, templateId, status, notes
users/{uid}/trainings/{id}/exercises    → exerciseId, order, status
users/{uid}/trainings/{id}/exercises/{id}/sets → reps, weight, duration, distance, status, order
users/{uid}/templates           → name, exercises[]
```

### Übungstypen

| Typ | Zu erfassen | Gewicht | Beispiele |
|-----|-------------|---------|-----------|
| Strength weighted | Satz, Reps, Gewicht | Pflicht | Bankdrücken, Brustpresse, Curls |
| Strength reps only | Satz, Reps | Nein | Dips, Liegestütze, Beinheben |
| Cardio basic | Zeit, Strecke | Nein | Laufband, Indoor Cycle, Rudern Ergometer |

## Benutzerrollen

| Rolle | Rechte |
|-------|--------|
| User (Standard) | Eigene Studios, Trainings, Templates, Gewichtshistorie verwalten. Übungskatalog lesen. |
| Admin | Zusätzlich: Globalen Übungskatalog pflegen (Übungen hinzufügen/bearbeiten). |

## Datentrennung

- **Übungskatalog:** Global, für alle User gleich. Nur Admin darf Übungen hinzufügen.
- **Studios:** Pro User. Jeder User pflegt eigene Studios.
- **Trainings, Templates, Gewichtshistorie:** Pro User. Kein Cross-User-Zugriff.

## Erfassungslogik

- **Gewichtseingabe:** Freie Zahleneingabe (Tastatur)
- **Satz duplizieren:** Letzten Satz kopieren, dann Gewicht und Reps editieren
- **Templates:** Flexible Startpunkte — Übungen können im Training hinzugefügt oder weggelassen werden
- **Rückwirkendes Anlegen:** Trainings können auch für vergangene Tage erfasst werden

## Dashboard-Kennzahlen

| Bereich | Kennzahlen |
|---------|------------|
| Überblick | Trainingstage pro Woche/Monat, Satzanzahl, Gesamtvolumen |
| Körpergewicht | Aktueller Wert, Trend, Veränderung 30/90 Tage |
| Weighted Exercises | Max Gewicht, bestes Set, Volumen, Frequenz (bei context_dependent: pro Studio) |
| Bodyweight | Max Reps, Gesamtwiederholungen, Frequenz |
| Cardio | Gesamtdauer, Gesamtstrecke, Sessions |
| Aktivitätsmuster | Muskelgruppen-Verteilung, Trainingsfrequenz |

## Screens

| Screen | Beschreibung |
|--------|-------------|
| Dashboard | Überblick: Trainingsaktivität, Fortschritt, Körpergewicht |
| Trainingsliste | Historie mit Filtern (Datum, Studio, Status, Übung) |
| Neues Training | Schnellstart: Datum, Studio, Template, Übungen |
| Trainingsdetail | Sätze erfassen/duplizieren, abhaken, speichern |
| Übungsdetail | Verlauf global oder nach Studio (je nach context_dependent) |
| Gewichtsverlauf | Körpergewichts-Historie und Trendlinie |
| Templates | Vorlagen verwalten |
| Stammdaten | Studios verwalten, Übungskatalog ansehen |

## MVP-Scope (Version 1)

**Enthalten:**
- Google Login und Profil
- Gewichtshistorie mit Verlauf
- Globaler Übungskatalog (50 Übungen, mit Typen und context_dependent)
- Studio-Verwaltung (pro User)
- Training anlegen, editieren, abschließen (auch rückwirkend)
- Übungen und Sätze erfassen, Sätze duplizieren
- Bodyweight ohne Gewicht, Cardio mit Zeit/Strecke
- Templates (flexibel, kein starres Korsett)
- Dashboard mit Fortschritt und automatischem Studio-Filter

**Nach V1 ergänzt (Stand 2026-06-11):**
- KI-Trainingsempfehlung (Flag `VITE_AI_RECOMMENDATIONS`, Policy-first Coach-Engine — siehe `docs/architecture/ai-coach-engine.md`)
- Übungen im Katalog bearbeiten (nicht nur anlegen)
- Private Beta / Zugangs-Allowlist

**Nicht enthalten (spätere Phasen):**
- Favoriten und Schnellzugriff
- Persönliche Rekorde
- Export (CSV/Excel)
- Gerätevarianten-Ebene
- Offline-Fähigkeit
- Soziale Funktionen

## Übungskatalog (Initialer Seed)

50 Übungen — vollständige Liste mit Typ, Muskelgruppe und context_dependent-Flag:

### Strength weighted, context_dependent: true (Maschinen/Seilzüge)
GTS Butterfly einarmig (Brust), Maschine Abduktor (Beine), Maschine Adduktor (Beine), Maschine Bauchcrunch (Core), Maschine Beinbeuger (Beine), Maschine Beinbeuger liegend (Beine), Maschine Beinstrecker (Beine), Maschine Brustpresse (Brust), Maschine Butterfly gestreckte Arme (Brust), Maschine Butterfly Reverse gestreckte Arme (Schultern/Rücken), Maschine Butterfly Reverse gestreckte Arme proniert (Schultern/Rücken), Maschine Klimmzüge mit Unterstützung (Rücken), Maschine Latzug (Rücken), Maschine Rudern (Rücken), Maschine Rückenstrecker (Rücken), Maschine Schrägbankdrücken (Brust), Maschine Schulterdrücken (Schultern), Seilzug Bizeps Curls (Bizeps), Seilzug Butterfly einarmig nach unten (Brust), Seilzug Butterfly nach oben stehend (Brust), Seilzug Butterfly nach unten (Brust), Seilzug Butterfly Reverse einarmig (Schultern/Rücken), Seilzug Latziehen zur Brust (Rücken), Seilzug Rudern eng (Rücken), Seilzug Rudern im Untergriff (Rücken), Seilzug Rudern weit sitzend (Rücken), Seilzug Rumpfrotation (Core), Seilzug Seitheben einarmig (Schultern), Seilzug Trizepsdrücken einarmig im Obergriff (Trizeps), Seilzug Trizepsdrücken im Obergriff (Trizeps)

### Strength weighted, context_dependent: false (Freie Gewichte)
Core Bag Kniebeugen (Beine), Kettlebell Schulterdrücken einarmig (Schultern), Kurzhantel Arnold Press (Schultern), Kurzhantel Bizeps Curls einarmig (Bizeps), Kurzhantel Butterfly Reverse einarmig vorgebeugt (Schultern/Rücken), Kurzhantel Butterfly Reverse stehend (Schultern/Rücken), Kurzhantel Seitheben (Schultern), Kurzhantel Schulterdrücken einarmig (Schultern), Kurzhantel Schulterheben (Trapez), Kurzhantel Schulterheben stehend (Trapez), Langhantel Bankdrücken (Brust), Langhantel Rudern vorgebeugt (Rücken)

### Strength reps only (Bodyweight)
Beinheben im Hang mit Kontakt (Core), Dips (Brust/Trizeps), Equalizer Liegestütze (Brust), Liegestütze (Brust), Theraband Butterfly Reverse (Schultern/Rücken)

### Cardio basic
Indoor Cycle (Cardio), Laufband (Cardio), Rudern Ergometer (Cardio)

## Referenzdokumente

- Fachkonzept (historisch, V1): `docs/trainingsapp_konzept_v1.md`
- Agenten-Workflow: `docs/agents/00-workflow-anleitung.md`
