# Trainingsapp

Persönliche Web-App zur Erfassung und Analyse von Krafttraining.

**Live:** https://mvp-app-claude.web.app
**GitHub:** https://github.com/twinstar2k/trainingsapp
**Firebase-Projekt:** `mvp-app-claude` (europe-west3)

## Projektkontext

Lies `docs/PROJECT-CONTEXT.md` für den vollständigen fachlichen und technischen Kontext.

## Tech-Stack

- **Frontend:** React 18 + TypeScript + Vite (mobile-first)
- **Styling:** Tailwind CSS v4 mit `@tailwindcss/vite` — Config via `@theme`-Block in `src/index.css`, kein `tailwind.config.js`
- **Auth:** Firebase Authentication (Google Login via `signInWithPopup`)
- **Datenbank:** Cloud Firestore
- **Hosting:** Firebase Hosting
- **Backend:** Keins (Firestore Security Rules steuern Zugriff)

## Projektstruktur

```
trainingsapp/
├── CLAUDE.md                          ← Du bist hier
├── docs/
│   ├── PROJECT-CONTEXT.md             ← Fachlicher + technischer Kontext
│   ├── DESIGN.md                      ← Design-System (Google Stitch Tokens)
│   ├── agents/                        ← Agenten-Prompts für rollenbasierte Entwicklung
│   ├── requirements/                  ← User Stories und Akzeptanzkriterien
│   │   └── exercise-progress.md
│   ├── architecture/                  ← Technische Designs
│   │   └── exercise-progress.md
│   └── qa-reports/                    ← Testberichte
├── src/
│   ├── components/
│   │   ├── layout/AppLayout.tsx       ← Bottom Navigation
│   │   ├── ui/ConfirmDialog.tsx
│   │   └── LastSessionLabel.tsx       ← "Zuletzt: 3×10@50kg"-Label
│   ├── contexts/AuthContext.tsx       ← Google Auth (signInWithPopup)
│   ├── hooks/
│   │   ├── useExerciseProgress.ts     ← Fortschrittsdaten laden
│   │   └── useLastSession.ts          ← Letzte Session einer Übung
│   ├── lib/
│   │   ├── firebase.ts                ← Firebase-Initialisierung
│   │   ├── seed.ts                    ← Übungskatalog-Seed
│   │   ├── export.ts                  ← Client-seitiger JSON-Export aller Userdaten
│   │   └── utils.ts                   ← cn() Hilfsfunktion
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Trainings.tsx
│   │   ├── TrainingDetail.tsx         ← Sätze erfassen, Übung antippbar
│   │   ├── NewTraining.tsx
│   │   ├── ExerciseDetail.tsx         ← Fortschrittschart + Summary
│   │   ├── Exercises.tsx
│   │   ├── Weight.tsx
│   │   └── Profile.tsx
│   ├── types/index.ts                 ← Alle TypeScript-Typen
│   ├── utils/metrics.ts               ← Epley 1RM, Volumen, Label-Formatierung
│   └── App.tsx                        ← Router + ProtectedRoute
├── firebase.json
├── firestore.rules
├── firestore.indexes.json             ← Composite Indexes (status+date, status+studioId+date)
├── index.html                         ← Google Fonts via <link> (nicht CSS @import!)
├── vite.config.ts                     ← COOP-Header für Auth-Popup
├── package.json
└── tsconfig.json
```

## Implementierter Funktionsumfang (Stand 2026-04-08)

- Google Login (signInWithPopup)
- Studio-Verwaltung pro User
- Übungskatalog (global, 50 Übungen Seed + clientseitig erweiterbar via „Neue Übung" auf Exercises-Seite)
- Training anlegen, Übungen + Sätze erfassen, abschließen
- **Edit-Lock:** Abgeschlossene Trainings sind read-only — alle Edit-Affordances (Übung/Satz hinzufügen, löschen, Inputs, Toggles) erst nach „Training wieder öffnen" verfügbar
- Körpergewicht-Historie mit Verlauf-Chart
- **Exercise Progress:**
  - `weighted`: Max-Gewicht / Volumen / 1RM (kg)
  - `reps_only`: Max. Wdh / Gesamt Wdh (Wdh) — für Bodyweight-Übungen wie Beinheben
  - „Zuletzt"-Label im aktiven Training
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
- Dokument-IDs: Auto-ID für user-generierte Daten, sprechende IDs für Stammdaten
- Subcollections für user-gebundene Daten unter `users/{uid}/`
- Globale Daten (Übungskatalog) in Top-Level-Collection `exercises`
- Neue Firestore-Indizes in `firestore.indexes.json` eintragen und mit `firebase deploy --only firestore:indexes` deployen

## Wichtige Geschäftsregeln

- **context_dependent-Flag:** Maschinen-/Seilzugübungen nur innerhalb desselben Studios vergleichen
- **Exercise Progress:** Zweistufige Query (Trainings → exercises → sets), max. 20 Sessions, kein Zeitraum-Filter im MVP
- **1RM (Epley):** `weight × (1 + reps / 30)`, nur gültig für reps ≤ 15
- **Standard-Metrik:** Max-Gewicht (nicht 1RM)
- **Templates sind flexibel:** Übungen dürfen abweichen, kein starres Korsett
- **Übungskatalog ist global:** Nur Admin kann Übungen hinzufügen
- **Studios sind pro User:** Jeder User pflegt eigene Studios
- **Gewichtshistorie:** Neue Einträge ergänzen, nie überschreiben

## Deploy

```bash
npm run build && firebase deploy --only hosting       # App deployen
firebase deploy --only firestore:indexes              # Indizes deployen
firebase deploy --only firestore:rules                # Rules deployen
```

## Backup

Nightly Firestore-Dump in eigenes privates Repo `twinstar2k/trainingsapp-backup`:

- **Lokales Projekt:** `/Users/josef/Projekte/trainingsapp-backup/` (eigenes Node-Projekt mit `firebase-admin`, nicht Teil dieses Repos)
- **Service-Account-Key:** `~/.config/trainingsapp-backup/service-account.json` (Permissions 0600, in `.gitignore`)
- **Cron:** täglich 03:00 → `run-backup.sh` dumpt nach `data/backup.json` und committet/pusht bei Änderungen
- **Manueller Trigger:** `./run-backup.sh` im Backup-Projekt
- **Zusätzlich:** clientseitiger JSON-Export-Button im Profil (`src/lib/export.ts`)
