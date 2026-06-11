# Trainingsapp

Persönliche Web-App zur Erfassung und Analyse von Krafttraining.

**Live:** https://mvp-app-claude.web.app
**GitHub:** https://github.com/twinstar2k/trainingsapp
**Firebase-Projekt:** `mvp-app-claude` (europe-west3)

## Projektkontext

Lies `docs/PROJECT-CONTEXT.md` für den vollständigen fachlichen und technischen Kontext.

## Tech-Stack

- **Frontend:** React 19 + TypeScript + Vite (mobile-first)
- **Styling:** Tailwind CSS v4 mit `@tailwindcss/vite` — Config via `@theme`-Block in `src/index.css`, kein `tailwind.config.js`
- **Auth:** Firebase Authentication (Google Login via `signInWithPopup`)
- **Datenbank:** Cloud Firestore
- **Hosting:** Firebase Hosting
- **Backend:** Cloud Functions (`functions/`, europe-west3, Node 22, firebase-functions v7) — Callable `getTrainingRecommendation` für die KI-Empfehlung. Sonstiger Datenzugriff weiterhin direkt via Firestore Security Rules.
- **Geteilter Code:** `shared/` (Metriken + KI-Vertragstypen + Policy-Kern) — Single Source für App UND Functions (ADR-04).
- **LLM:** EU-Gateway Requesty (`router.eu.requesty.ai`, OpenAI-kompatibel), Secret `REQUESTY_API_KEY` in Google Secret Manager. Feature-Flag `VITE_AI_RECOMMENDATIONS` (default AUS).

## Projektstruktur

```
trainingsapp/
├── CLAUDE.md                          ← Du bist hier
├── docs/
│   ├── PROJECT-CONTEXT.md             ← Fachlicher + technischer Kontext
│   ├── BACKLOG.md                     ← Ideen / „Nice to have" (inkl. Test-Feedback)
│   ├── DESIGN.md                      ← Design-System (Google Stitch Tokens)
│   ├── trainingsapp_konzept_v1.md     ← Historisches Fachkonzept (V1, nicht mehr gepflegt)
│   ├── agents/                        ← Agenten-Prompts für rollenbasierte Entwicklung
│   ├── requirements/                  ← User Stories und Akzeptanzkriterien
│   │   ├── exercise-progress.md
│   │   └── ai-recommendation.md
│   ├── architecture/                  ← Technische Designs
│   │   ├── exercise-progress.md
│   │   ├── ai-recommendation.md       ← KI-Sandwich, ADRs, §6 DSGVO
│   │   ├── ai-coach-engine.md         ← Policy-Kern (Code = Systematik, Trend/Plateau)
│   │   └── progressionsstrategien-krafttraining.md  ← Trainingswissenschaft (ACSM 2026)
│   └── qa-reports/                    ← Testberichte
│       └── ai-recommendation-model-eval.md
├── src/
│   ├── components/
│   │   ├── layout/AppLayout.tsx       ← Bottom Navigation
│   │   ├── training/                  ← Bausteine der Trainings-Seite (ExerciseCard, SetRow, ExerciseCatalogModal)
│   │   ├── ui/ConfirmDialog.tsx
│   │   └── LastSessionLabel.tsx       ← "Zuletzt: 3×10@50kg"-Label
│   ├── contexts/AuthContext.tsx       ← Google Auth (signInWithPopup)
│   ├── hooks/
│   │   ├── useExerciseProgress.ts     ← Fortschrittsdaten laden
│   │   ├── useLastSession.ts          ← Letzte Session einer Übung
│   │   ├── useRecommendation.ts       ← Callable getTrainingRecommendation aufrufen
│   │   └── useTrainingSession.ts      ← Daten + alle Firestore-Mutationen eines Trainings
│   ├── lib/
│   │   ├── firebase.ts                ← Firebase-Initialisierung
│   │   ├── seed.ts                    ← Übungskatalog-Seed
│   │   ├── export.ts                  ← Client-seitiger JSON-Export aller Userdaten
│   │   └── utils.ts                   ← cn() Hilfsfunktion
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Trainings.tsx
│   │   ├── TrainingDetail.tsx         ← Komposition: useTrainingSession + components/training
│   │   ├── NewTraining.tsx
│   │   ├── ExerciseDetail.tsx         ← Fortschrittschart + Summary
│   │   ├── Exercises.tsx
│   │   ├── Weight.tsx
│   │   └── Profile.tsx
│   ├── components/ai/                 ← RecommendationDialog + Preview (KI-Empfehlung)
│   ├── types/index.ts                 ← Alle TS-Typen (re-exportiert shared/ai-types)
│   ├── utils/metrics.ts               ← Epley 1RM, Volumen, Label-Formatierung
│   └── App.tsx                        ← Router + ProtectedRoute
├── shared/                            ← Single Source für App + Functions (ADR-04)
│   ├── ai-types.ts                    ← KI-Vertragstypen (Context/Plan/Payload)
│   ├── metrics.ts                     ← geteilte Metrik-Funktionen
│   └── policy.ts                      ← deterministischer Coach-Kern (Code = Systematik)
├── functions/                         ← Cloud Functions (Node 22, europe-west3)
│   └── src/                           ← index.ts (Callable) + lib/ (context, prompt, guardrails) + llm/
├── eval/                              ← zero-dep Eval-Harness + Offline-Tests (npm test)
├── firebase.json
├── firestore.rules
├── firestore.indexes.json             ← Composite Indexes (status+date, status+studioId+date)
├── index.html                         ← Google Fonts via <link> (nicht CSS @import!)
├── vite.config.ts                     ← COOP-Header für Auth-Popup
├── package.json
└── tsconfig.json
```

## Implementierter Funktionsumfang (Stand 2026-06-11)

- Google Login (signInWithPopup)
- **Private Beta / Zugangs-Allowlist:** Eingeloggt ≠ freigeschaltet — nur gelistete Konten können die App nutzen (siehe Firebase-Konventionen). Fremde Konten sehen eine „Private Beta"-Sperrseite.
- Studio-Verwaltung pro User
- Übungskatalog (global, 50 Übungen Seed; clientseitig erweiterbar via „Neue Übung" UND bearbeitbar via Stift-Button auf der Exercises-Seite — Name/Muskelgruppe/context_dependent/repsProgression; Typ bleibt nach Anlage fix, kein Löschen)
- Training anlegen, Übungen + Sätze erfassen, abschließen
- **Edit-Lock:** Abgeschlossene Trainings sind read-only — alle Edit-Affordances (Übung/Satz hinzufügen, löschen, Inputs, Toggles) erst nach „Training wieder öffnen" verfügbar
- Körpergewicht-Historie mit Verlauf-Chart
- **Exercise Progress:**
  - `weighted`: Max-Gewicht / Volumen / 1RM (kg)
  - `reps_only`: Max. Wdh / Gesamt Wdh (Wdh) — für Bodyweight-Übungen wie Beinheben
  - „Zuletzt"-Label im aktiven Training
- **KI-Trainingsempfehlung (Flag-gesteuert, `VITE_AI_RECOMMENDATIONS`):** Pro Übung, Policy-first — deterministischer Coach-Kern (`shared/policy.ts`, Double Progression + RIR-Autoregulation + Trend/Plateau) rechnet, das LLM begründet nur. Callable `getTrainingRecommendation` über EU-Gateway. Konzept: `docs/architecture/ai-coach-engine.md`.
- **Daten-Export:** Button im Profil → JSON-Dump aller Userdaten (`src/lib/export.ts`)

## Agenten-Workflow

Für strukturierte Feature-Entwicklung stehen 6 Agenten-Rollen zur Verfügung in `docs/agents/`. Workflow: siehe `docs/agents/00-workflow-anleitung.md`.

Rolle aktivieren:
```
Lies docs/agents/01-requirements-engineer.md und docs/PROJECT-CONTEXT.md.
Dann: [Aufgabe beschreiben]
```

## Code-Konventionen

- TypeScript strict mode
- Functional Components mit expliziten Props-Interfaces
- CSS-Klassen statt Inline-Styles (Tailwind)
- Hooks am Anfang der Komponente
- Jede Komponente hat Loading- und Error-State
- Keine console.log im finalen Code
- Mobile-first Responsive Design

## Tailwind-Besonderheiten

- **Version 4** — kein `tailwind.config.js`, Config ausschließlich via `@theme { }` in `src/index.css`
- **Google Fonts:** Müssen via `<link>` in `index.html` geladen werden — `@import url()` in CSS funktioniert in Vite dev nicht
- **Design Tokens:** `bg-primary`, `text-on-surface`, `bg-surface-container-lowest` etc. — alle in `src/index.css` definiert

## Firebase-Konventionen

- Security Rules: deny-by-default, jede Collection muss abgedeckt sein
- **Zugangs-Allowlist (Private Beta):** Top-Level-Collection `allowlist`, Doc-ID = Google-E-Mail in lowercase (exakt wie in Firebase Console → Authentication angezeigt; ein beliebiges Feld wie `note` genügt). Rules (`allowedUser()`) UND die KI-Function prüfen dagegen — eingeloggt ≠ freigeschaltet. Tester freischalten = Dokument in der Console anlegen, kein Deploy nötig. Pflege nur über die Console, Clients haben keinen Zugriff.
- Dokument-IDs: Auto-ID für user-generierte Daten, sprechende IDs für Stammdaten
- Subcollections für user-gebundene Daten unter `users/{uid}/`
- Globale Daten (Übungskatalog) in Top-Level-Collection `exercises`
- Neue Firestore-Indizes in `firestore.indexes.json` eintragen und mit `firebase deploy --only firestore:indexes` deployen
- **Rules-Drift vermeiden:** Schreibt der Client neue Felder auf rule-validierte Docs (z. B. `exercises` mit `hasOnly`), MUSS `firestore.rules` im selben Change nachgezogen und deployt werden — sonst scheitern Writes zur Laufzeit mit „Missing or insufficient permissions"

## Wichtige Geschäftsregeln

- **context_dependent-Flag:** Maschinen-/Seilzugübungen nur innerhalb desselben Studios vergleichen
- **Exercise Progress:** Zweistufige Query (Trainings → exercises → sets), max. 20 Sessions, kein Zeitraum-Filter im MVP
- **1RM (Epley):** `weight × (1 + reps / 30)`, nur gültig für reps ≤ 15
- **Standard-Metrik:** Max-Gewicht (nicht 1RM)
- **Templates sind flexibel:** Übungen dürfen abweichen, kein starres Korsett
- **Übungskatalog ist global UND von jedem freigeschalteten User schreibbar:** Die Rules kennen (noch) keine Admin-Rolle — `allowedUser()` darf Übungen anlegen und bearbeiten. Da der Katalog global ist, wirkt die Bearbeitung durch einen Tester für alle. In der Single-User-Phase unkritisch; sobald mehrere Konsumenten den Katalog teilen, wäre ein Ownership-/Admin-Konzept nötig (siehe `docs/BACKLOG.md`).
- **Studios sind pro User:** Jeder User pflegt eigene Studios
- **Gewichtshistorie:** Neue Einträge ergänzen, nie überschreiben

## Deploy

```bash
npm run build && firebase deploy --only hosting       # App deployen
firebase deploy --only functions                      # Cloud Functions deployen (KI-Empfehlung)
firebase deploy --only firestore:indexes              # Indizes deployen
firebase deploy --only firestore:rules                # Rules deployen
```

KI-Konzept/Architektur: `docs/architecture/ai-coach-engine.md` (Policy-first, Trend/Plateau),
`docs/architecture/progressionsstrategien-krafttraining.md` (Trainingswissenschaft, ACSM 2026).

## Backup

Nightly Firestore-Dump in eigenes privates Repo `twinstar2k/trainingsapp-backup`:

- **Lokales Projekt:** `/Users/josef/Projekte/trainingsapp-backup/` (eigenes Node-Projekt mit `firebase-admin`, nicht Teil dieses Repos)
- **Service-Account-Key:** `~/.config/trainingsapp-backup/service-account.json` (Permissions 0600, in `.gitignore`)
- **Cron:** täglich 20:00 → `run-backup.sh` dumpt nach `data/backup.json` und committet/pusht bei Änderungen (tagsüber gewählt, weil cron im Ruhezustand schweigt und der Mac nicht aufgeweckt werden soll)
- **Manueller Trigger:** `./run-backup.sh` im Backup-Projekt
- **Zusätzlich:** clientseitiger JSON-Export-Button im Profil (`src/lib/export.ts`)
