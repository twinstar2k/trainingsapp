# Trainingsapp

Persönliche Web-App zur Erfassung und Analyse von Krafttraining.

## Projektkontext

Lies `docs/PROJECT-CONTEXT.md` für den vollständigen fachlichen und technischen Kontext.

## Tech-Stack

- **Frontend:** React 18+ mit TypeScript und Vite (mobile-first)
- **Auth:** Firebase Authentication (Google Login)
- **Datenbank:** Cloud Firestore
- **Hosting:** Firebase Hosting
- **Backend:** Keins (Firestore Security Rules steuern Zugriff)

## Projektstruktur

```
trainingsapp/
├── CLAUDE.md                          ← Du bist hier
├── docs/
│   ├── PROJECT-CONTEXT.md             ← Fachlicher + technischer Kontext
│   ├── agents/                        ← Agenten-Prompts für Rollenbasierte Entwicklung
│   ├── requirements/                  ← User Stories und Akzeptanzkriterien
│   ├── architecture/                  ← Technische Designs
│   └── qa-reports/                    ← Testberichte
├── src/
│   ├── components/                    ← React-Komponenten
│   ├── pages/                         ← Seiten / Views
│   ├── hooks/                         ← Custom Hooks
│   ├── context/                       ← React Context (Auth, etc.)
│   ├── services/                      ← Firebase Service Layer
│   ├── types/                         ← TypeScript Type Definitions
│   └── utils/                         ← Hilfsfunktionen
├── functions/                         ← Cloud Functions (falls benötigt)
├── scripts/                           ← Seed-Daten, Migrationen
├── firebase.json                      ← Firebase-Konfiguration
├── firestore.rules                    ← Firestore Security Rules
├── firestore.indexes.json             ← Firestore-Indizes
├── package.json
├── tsconfig.json
└── vite.config.ts
```

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
- CSS-Klassen statt Inline-Styles
- Hooks am Anfang der Komponente
- Jede Komponente hat Loading- und Error-State
- Keine console.log im finalen Code
- Mobile-first Responsive Design

## Firebase-Konventionen

- Security Rules: deny-by-default, jede Collection muss abgedeckt sein
- Dokument-IDs: Auto-ID für user-generierte Daten, sprechende IDs für Stammdaten
- Subcollections für user-gebundene Daten unter `users/{uid}/`
- Globale Daten (Übungskatalog) in Top-Level-Collections

## Wichtige Geschäftsregeln

- **context_dependent-Flag:** Maschinen-/Seilzugübungen werden nur innerhalb desselben Studios verglichen
- **Templates sind flexibel:** Übungen dürfen abweichen, kein starres Korsett
- **Übungskatalog ist global:** Nur Admin kann Übungen hinzufügen
- **Studios sind pro User:** Jeder User pflegt eigene Studios
- **Gewichtshistorie:** Neue Einträge ergänzen, nie überschreiben
