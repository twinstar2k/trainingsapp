# Multi-Agenten Workflow für Software-Projekte mit Claude Code

## Übersicht der Agenten

| # | Agent | Datei | Wann verwenden |
|---|-------|-------|----------------|
| 1 | Requirements Engineer | `01-requirements-engineer.md` | Neue Features planen, Anforderungen klären |
| 2 | Solution Architect | `02-solution-architect.md` | Technisches Design, Architektur, Datenmodell |
| 3 | Frontend Developer | `03-frontend-developer.md` | React-Komponenten, UI, State Management |
| 4 | Firebase & Data Engineer | `04-firebase-data-engineer.md` | Firestore, Security Rules, Auth, Cloud Functions |
| 5 | QA Engineer | `05-qa-engineer.md` | Tests, Bug-Suche, Freigabe |
| 6 | DevOps Engineer | `06-devops-engineer.md` | Deployment, CI/CD, Environments |

## Projekt-Setup

### Dateistruktur im Repository

```
projekt-root/
├── CLAUDE.md                          ← Zentrale Projektdatei für Claude Code
├── docs/
│   ├── agents/
│   │   ├── 00-workflow-anleitung.md
│   │   ├── 01-requirements-engineer.md
│   │   ├── 02-solution-architect.md
│   │   ├── 03-frontend-developer.md
│   │   ├── 04-firebase-data-engineer.md
│   │   ├── 05-qa-engineer.md
│   │   └── 06-devops-engineer.md
│   ├── PROJECT-CONTEXT.md             ← Projektspezifischer Kontext
│   ├── requirements/                  ← Output Requirements Engineer
│   ├── architecture/                  ← Output Solution Architect
│   └── qa-reports/                    ← Output QA Engineer
├── src/                               ← Frontend-Code
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```

### CLAUDE.md einrichten

Die Datei `CLAUDE.md` im Projekt-Root ist die zentrale Konfiguration für Claude Code. Sie verweist auf den Projektkontext und die verfügbaren Agenten-Rollen:

```markdown
# Projekt: [Projektname]

Lies zuerst `docs/PROJECT-CONTEXT.md` für den vollständigen Projektkontext.

## Agenten-Rollen

Agenten-Prompts liegen in `docs/agents/`. Workflow: siehe `docs/agents/00-workflow-anleitung.md`.

## Tech-Stack

[Kurzübersicht des Tech-Stacks]

## Konventionen

[Projektspezifische Code-Konventionen]
```

## Workflow für neue Features

```
┌─────────────────────────┐
│  1. Requirements        │  "Was soll gebaut werden?"
│     Engineer            │  → User Stories, Akzeptanzkriterien
└──────────┬──────────────┘
           │ Output: docs/requirements/feature-name.md
           ▼
┌─────────────────────────┐
│  2. Solution            │  "Wie soll es gebaut werden?"
│     Architect           │  → Datenmodell, API/Firestore-Design, Komponenten
└──────────┬──────────────┘
           │ Output: docs/architecture/feature-name.md
           ▼
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌──────────┐
│ 3. FE   │ │ 4. Fire- │  Parallele Entwicklung möglich
│ Dev     │ │ base Eng │
└────┬────┘ └────┬─────┘
     │           │
     └─────┬─────┘
           │ Output: Code + Dokumentation
           ▼
┌─────────────────────────┐
│  5. QA Engineer         │  Tests, Bug-Reports
└──────────┬──────────────┘
           │ Output: docs/qa-reports/feature-name.md
           │ Bei Bugs → zurück zu FE/Firebase Eng
           │ Bei Freigabe ↓
           ▼
┌─────────────────────────┐
│  6. DevOps Engineer     │  Deployment
└─────────────────────────┘
```

## Verwendung mit Claude Code

### Rollen aktivieren

In Claude Code kannst du eine Rolle aktivieren, indem du Claude bittest, den entsprechenden Agenten-Prompt zu lesen:

```
Lies docs/agents/01-requirements-engineer.md und docs/PROJECT-CONTEXT.md.
Dann analysiere folgendes Feature: [Beschreibung]
```

Oder kürzer, wenn der Projektkontext bereits geladen ist:

```
Übernimm die Rolle Requirements Engineer (docs/agents/01-requirements-engineer.md).
Feature: Benutzer soll Körpergewicht erfassen können.
```

### Übergabe zwischen Rollen

Jeder Agent produziert strukturierte Outputs als Markdown-Dateien im `docs/`-Verzeichnis. Der nächste Agent liest diese als Input:

```
Übernimm die Rolle Solution Architect.
Lies die Requirements aus docs/requirements/koerpergewicht-feature.md
und erstelle das technische Design.
```

### Wann welchen Ansatz wählen

| Situation | Empfohlener Ansatz |
|-----------|-------------------|
| Neues großes Feature | Alle 6 Agenten durchlaufen |
| Kleiner Bugfix | Direkt lösen, kein Agent nötig |
| Mittelgroßes Feature | Requirements → Solution Architect → FE Dev |
| Datenmodell-Änderung | Solution Architect → Firebase Engineer |
| Security-kritische Änderung | Alle Agenten + besonderer QA-Fokus |
| UI-Optimierung | Frontend Developer + QA |
| Pre-Release | QA Engineer → DevOps Engineer |

## Übergabe-Dokumente

| Von | An | Output |
|-----|-----|--------|
| Requirements Engineer | Solution Architect | User Stories + Akzeptanzkriterien |
| Solution Architect | FE Dev + Firebase Eng | Technisches Design (Datenmodell, Komponenten, Flows) |
| Frontend Developer | QA Engineer | Code + Komponenten-Dokumentation |
| Firebase Engineer | QA Engineer | Firestore Rules + Datenstruktur-Doku |
| QA Engineer | DevOps Engineer | Testbericht + Freigabe |
| DevOps Engineer | Team | Deployment-Bestätigung + URLs |

## Tipps

1. **CLAUDE.md pflegen:** Halte die zentrale Projektdatei aktuell — sie ist der wichtigste Kontext für Claude Code
2. **Outputs speichern:** Schreibe Agenten-Outputs als Markdown in `docs/` — so entsteht automatisch Projektdokumentation
3. **Nicht übertreiben:** Für einfache Änderungen sind nicht alle 6 Agenten nötig
4. **QA nicht überspringen:** Auch bei Zeitdruck — die QA-Phase spart langfristig Zeit
5. **Iterativ arbeiten:** Ein Feature muss nicht in einem Durchlauf fertig sein — Rücksprünge sind normal
