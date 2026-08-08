# Trainingsapp

Persönliche Web-App zur Erfassung und Analyse von Krafttraining.

> **Sprache:** Immer auf Deutsch mit dem Nutzer kommunizieren (Antworten, Erklärungen, Rückfragen).

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
- **Geteilter Code:** `shared/` (Metriken + KI-Vertragstypen + Policy-Kern + Historie-Suche) — Single Source für App UND Functions (ADR-04).
- **LLM:** EU-Gateway Requesty (`router.eu.requesty.ai`, OpenAI-kompatibel), Secret `REQUESTY_API_KEY` in Google Secret Manager. Feature-Flag `VITE_AI_RECOMMENDATIONS` (default AUS).

## Projektstruktur

```
trainingsapp/
├── CLAUDE.md                          ← Du bist hier
├── docs/
│   ├── PROJECT-CONTEXT.md             ← Fachlicher + technischer Kontext
│   ├── BACKLOG.md                     ← Ideen / „Nice to have" (inkl. Test-Feedback)
│   ├── DESIGN.md                      ← Design-System (Google Stitch Tokens)
│   ├── prozess-blueprint.md           ← Arbeitsablauf + CI/CD + Absicherung, providerneutral (auf andere Projekte übertragbar)
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
│   │   ├── ui/ConfirmDialog.tsx       ← + PromptDialog.tsx (Name-Eingabe, z.B. Vorlage benennen)
│   │   └── LastSessionLabel.tsx       ← "Zuletzt: 3×10@50kg"-Label
│   ├── contexts/AuthContext.tsx       ← Google Auth (signInWithPopup)
│   ├── hooks/
│   │   ├── useExerciseProgress.ts     ← Fortschrittsdaten laden
│   │   ├── useExerciseReference.ts    ← Zuletzt-Label + Bestleistung einer Übung (ein Query-Durchlauf)
│   │   ├── useRecommendation.ts       ← Callable getTrainingRecommendation aufrufen
│   │   ├── useTrainingSession.ts      ← Daten + alle Firestore-Mutationen eines Trainings
│   │   └── useTemplates.ts            ← CRUD der Trainings-Vorlagen (users/{uid}/templates)
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
│   │   ├── Templates.tsx              ← Vorlagen-Verwaltung (anlegen/ordnen/löschen)
│   │   └── Profile.tsx
│   ├── components/ai/                 ← RecommendationDialog + Preview (KI-Empfehlung)
│   ├── types/index.ts                 ← Alle TS-Typen (re-exportiert shared/ai-types)
│   ├── utils/metrics.ts               ← Epley 1RM, Volumen, Label-Formatierung
│   └── App.tsx                        ← Router + ProtectedRoute
├── shared/                            ← Single Source für App + Functions (ADR-04)
│   ├── ai-types.ts                    ← KI-Vertragstypen (Context/Plan/Payload)
│   ├── metrics.ts                     ← geteilte Metrik-Funktionen
│   ├── policy.ts                      ← deterministischer Coach-Kern (Code = Systematik)
│   ├── session-scan.ts                ← „letzte 20 Einheiten dieser Übung" finden (Historie-Suche)
│   └── studio-filter.ts               ← Studio-Regel für context_dependent (inkl. „noch nicht laden")
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

## Implementierter Funktionsumfang (Stand 2026-07-18)

- Google Login (signInWithPopup)
- **Private Beta / Zugangs-Allowlist:** Eingeloggt ≠ freigeschaltet — nur gelistete Konten können die App nutzen (siehe Firebase-Konventionen). Fremde Konten sehen eine „Private Beta"-Sperrseite.
- Studio-Verwaltung pro User
- Übungskatalog (global, 52 Übungen Seed; **nur Admin** pflegt ihn — anlegen via „Neue Übung" UND bearbeiten via Stift-Button auf der Exercises-Seite, Name/Muskelgruppe/context_dependent/repsProgression; Typ bleibt nach Anlage fix, kein Löschen. Nicht-Admins sehen den Katalog read-only.)
- Training anlegen, Übungen + Sätze erfassen, abschließen
- **Trainings-Vorlagen (Templates):** Wiederverwendbare Session-Skelette (geordnete Übungsliste, keine Sätze — Gewicht/Wdh kommen aus Historie + Coach). Verwaltungsseite `/templates` (anlegen/umbenennen/löschen/ordnen), „Als Vorlage speichern" aus einem Training, „Mit Vorlage starten" in NewTraining (setzt `Training.templateId`). Typ `Template = { name, exerciseIds[], category?, createdAt }`; das optionale `category` ist reservierter Platz für die spätere Split-Anbindung (KI-Stufe 2).
- **Edit-Lock:** Abgeschlossene Trainings sind read-only — alle Edit-Affordances (Übung/Satz hinzufügen, löschen, Inputs, Toggles) erst nach „Training wieder öffnen" verfügbar
- Körpergewicht-Historie mit Verlauf-Chart
- **Exercise Progress:**
  - `weighted`: Max-Gewicht / Volumen / 1RM (kg)
  - `reps_only`: Max. Wdh / Gesamt Wdh (Wdh) — für Bodyweight-Übungen wie Beinheben
  - `isometric`: Max. Haltezeit / Gesamt-Haltezeit — für statische Übungen wie Plank/Wandsitz, Erfassung in Min + Sek (gespeichert als `holdSeconds`, Sekunden)
  - „Zuletzt"-Label im aktiven Training
- **Live-Progressionsanzeige im aktiven Training:** Fortschrittsbalken in der Übungskarte zeigt live, wie nah die abgehakten Sätze an der Bestleistung sind (weighted: Volumen, reps_only: Gesamt-Wdh, isometric: Gesamt-Haltezeit; letzte 20 Sessions als Basis). Ab Bestwert: Amber + „Bestleistung übertroffen!". Hook `src/hooks/useExerciseReference.ts` (ersetzt `useLastSession`, liefert Zuletzt-Label + Bestwert in einem Durchlauf), Komponente `src/components/training/LiveProgressBar.tsx`.
- **KI-Trainingsempfehlung (Flag-gesteuert, `VITE_AI_RECOMMENDATIONS`):** Pro Übung, Policy-first — deterministischer Coach-Kern (`shared/policy.ts`, Double Progression + RIR-Autoregulation + Trend/Plateau) rechnet, das LLM begründet nur. Callable `getTrainingRecommendation` über EU-Gateway. Konzept: `docs/architecture/ai-coach-engine.md`. Coach-Button nur für weighted/reps_only (isometric/cardio bewusst ohne Coach).
- **Gruppierte Listen:** Trainings-Seite nach Monat (neuester Monat + Monate mit aktivem Training starten offen), Übungskatalog und Übungsauswahl-Modal nach Muskelgruppe (alle zu, Suche öffnet Treffer-Gruppen). Wiederverwendbare Sektion `src/components/ui/CollapsibleSection.tsx`, Gruppier-Utility `src/utils/groupExercises.ts`.
- **Aktives-Training-Banner:** Antippbare Pille über der Bottom-Nav führt von jeder Seite mit einem Klick zurück ins laufende Training (versteckt auf dessen eigener Detailseite; ohne aktives Training unsichtbar). Echtzeit via `onSnapshot` — Hook `src/hooks/useActiveTraining.ts`, Komponente `src/components/layout/ActiveTrainingBanner.tsx`.
- **Daten-Export:** Button im Profil → JSON-Dump aller Userdaten (`src/lib/export.ts`)
- **Profil-Personalisierung (bewusst ohne Datensammlung):** Profilkopf zeigt Google-Foto + Name; optionaler Spitzname (`users/{uid}.nickname`, kein Rules-Change nötig) überschreibt den Google-Vornamen — aufgelöst als `useAuth().firstName`, genutzt auch von der Dashboard-Begrüßung. Ausklappbarer Transparenz-Block im Profil erklärt, warum es kein Alter/Geschlechts-Feld gibt (Coach nutzt die individuelle Historie statt demografischer Durchschnitte; DSGVO-Datenminimierung). Fachliche Begründung: `docs/superpowers/specs/2026-07-19-profil-personalisierung-design.md`. Der Name geht **nicht** an die KI-Function.

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
- **Entscheidungslogik als reine Funktion, nicht im Hook:** Sobald ein Hook mehr tut als Daten zu holen und zu setzen — filtern, sortieren, rechnen, „laden oder nicht?" entscheiden — gehört dieser Teil als reine Funktion nach `shared/` (wenn auch die Function sie braucht) oder `src/utils/`, mit Test in `eval/*.test.mjs`. Firestore-Aufrufe bleiben im Hook. Grund: Beide Bugs vom 2026-08-08 steckten in Hook-Logik, die man ohne laufende App nicht prüfen konnte; als reine Funktion (`shared/session-scan.ts`, `shared/studio-filter.ts`) sind sie in Minuten testbar. Beim Bauen kostet das kaum etwas, nachträglich extrahieren ist teuer.

## Tailwind-Besonderheiten

- **Version 4** — kein `tailwind.config.js`, Config ausschließlich via `@theme { }` in `src/index.css`
- **Google Fonts:** Müssen via `<link>` in `index.html` geladen werden — `@import url()` in CSS funktioniert in Vite dev nicht
- **Design Tokens:** `bg-primary`, `text-on-surface`, `bg-surface-container-lowest` etc. — alle in `src/index.css` definiert

## Firebase-Konventionen

- Security Rules: deny-by-default, jede Collection muss abgedeckt sein
- **Zugangs-Allowlist (Private Beta):** Top-Level-Collection `allowlist`, Doc-ID = Google-E-Mail in lowercase (exakt wie in Firebase Console → Authentication angezeigt; ein beliebiges Feld wie `note` genügt). Rules (`allowedUser()`) UND die KI-Function prüfen dagegen — eingeloggt ≠ freigeschaltet. Tester freischalten = Dokument in der Console anlegen, kein Deploy nötig. Pflege nur über die Console; ein Client darf seinen **eigenen** Eintrag lesen (für Freischaltung + Rolle), aber keinen fremden und keinen schreiben.
- **Rollen via `note`-Feld:** Das `note`-Feld der Allowlist-Docs doppelt als Rolle. `note == "Admin"` (case-insensitive) ⇒ Admin und darf den globalen Übungskatalog anlegen/bearbeiten (Rules-Funktion `isAdmin()`, Client-Flag `useAuth().isAdmin`). Jeder andere Wert (z. B. `User`) ⇒ normaler Nutzer, Katalog read-only. Rollenwechsel = `note` in der Console ändern, kein Deploy nötig.
- Dokument-IDs: Auto-ID für user-generierte Daten, sprechende IDs für Stammdaten
- Subcollections für user-gebundene Daten unter `users/{uid}/`
- Globale Daten (Übungskatalog) in Top-Level-Collection `exercises`
- Neue Firestore-Indizes in `firestore.indexes.json` eintragen und mit `firebase deploy --only firestore:indexes` deployen
- **Rules-Drift vermeiden:** Schreibt der Client neue Felder auf rule-validierte Docs (z. B. `exercises` mit `hasOnly`), MUSS `firestore.rules` im selben Change nachgezogen und deployt werden — sonst scheitern Writes zur Laufzeit mit „Missing or insufficient permissions"
- **Firestore-Transport = erzwungenes Long-Polling:** `src/lib/firebase.ts` initialisiert den Client bewusst via `initializeFirestore(app, { experimentalForceLongPolling: true })` statt `getFirestore(app)`. Grund: Auf Mobilnetzen (Mobilfunk/Proxy/NAT) blieb die erste `getDocs`-Anfrage einer frisch geöffneten Liste sonst hängen (Dauer-Spinner, erst Reload/Tab-Wechsel löste es) — Firestores WebChannel-Streaming bzw. die Long-Polling-Auto-Erkennung gerät dort ins Stocken. Long-Polling macht jede Query zu einer eigenständigen HTTP-Anfrage (minimal höhere Latenz, dafür robust). **Nicht** auf `getFirestore` zurückbauen.

## Wichtige Geschäftsregeln

- **context_dependent-Flag:** Maschinen-/Seilzugübungen nur innerhalb desselben Studios vergleichen. Maßgeblich ist das Studio des **Herkunftstrainings** (die `ExerciseCard` gibt es beim Navigieren via `state.studioId` mit), nicht das des jüngsten Trainings. Die Regel liegt in `shared/studio-filter.ts` (`resolveStudioFilter`) und wird von App **und** Coach genutzt. Steht das Studio noch nicht fest, wird **gar nicht geladen** (`ready: false`) — niemals ersatzweise ungefiltert, sonst mischt der Verlauf die Studios (Bug 2026-08-08, siehe ADR-03 in `docs/architecture/exercise-progress.md`). Der Studioname erscheint im Verlauf nur bei **mehr als einem angelegten Studio** (`isStudioLabelRelevant`) — bei einem Studio gibt es nichts zu unterscheiden.
- **Firestore-Ladeeffekte brauchen Cleanup:** Hooks, die bei Parameterwechsel neu abfragen (`useExerciseProgress`, `useExerciseReference`), setzen `let cancelled = false` + `return () => { cancelled = true }` und prüfen das vor jedem `setState`. Mit erzwungenem Long-Polling ist die Reihenfolge der Antworten nicht garantiert — ohne Cleanup gewinnt die zuletzt eintreffende Query statt der aktuellsten.
- **Exercise Progress:** Zweistufige Query (Trainings → exercises → sets), max. 20 Sessions, kein Zeitraum-Filter im MVP
- **„20 Sessions" heißt 20 Einheiten DIESER Übung — nicht 20 Trainings:** Die Suche läuft rückwärts durch die abgeschlossenen Trainings, bis 20 Treffer beisammen sind (`shared/session-scan.ts`, `collectExerciseSessions`). Sie darf **nicht** auf „die letzten 20 Trainings durchsuchen" zurückgebaut werden: Bei rotierenden Übungen (Split, Cardio) fällt die Historie sonst komplett aus dem Fenster — 2026-08 hatten dadurch 12 von 32 Übungen keinen Verlauf mehr (u. a. „Indoor Cycle": 6 Einheiten vorhanden, 1 sichtbar → „Noch zu wenig Daten"). Betrifft alle drei Nutzer der Historie: Verlaufschart (`useExerciseProgress`), Zuletzt-Label + Live-Progressbalken (`useExerciseReference`) und den KI-Coach (`functions/src/index.ts`, `fetchSessions`). Gedeckelt ist nur die Zahl der durchsuchten Trainings (`MAX_TRAININGS_SCANNED = 300`, ~2 Jahre Historie), weil jedes Training eine eigene Subcollection-Query kostet.
- **1RM (Epley):** `weight × (1 + reps / 30)`, nur gültig für reps ≤ 15
- **Standard-Metrik:** Max-Gewicht (nicht 1RM)
- **Templates sind flexibel:** Übungen dürfen abweichen, kein starres Korsett
- **Übungskatalog ist global, aber nur vom Admin schreibbar:** Lesen darf jeder Freigeschaltete, anlegen/bearbeiten nur der Admin (`isAdmin()` in den Rules, `note == "Admin"`). Da der Katalog global ist, wirken Admin-Änderungen für alle. Das war die „minimale" erste Stufe des Rollenkonzepts; ein volles Konzept (eigene User-Übungen vs. unveränderbare Basis-Übungen via `createdBy`/`isBase`) steht weiterhin im `docs/BACKLOG.md`.
- **Studios sind pro User:** Jeder User pflegt eigene Studios
- **Gewichtshistorie:** Neue Einträge ergänzen, nie überschreiben

## Deploy

**Hosting läuft automatisch:** Jeder Push auf `main` baut, lintet, testet und deployt via
GitHub Action (`.github/workflows/deploy-hosting.yml`). Einrichtung und benötigte
Secrets/Variables: `.github/workflows/README-secrets.md`. Der Workflow bricht ab, wenn die
`VITE_FIREBASE_*`-Werte fehlen — sonst würde eine App ohne Login und Daten live gehen.

Damit ist der Ablauf: **Feature-Branch → Commit → lokale Sichtprüfung → Merge → Push**
(der Push deployt). Kein manueller Hosting-Deploy mehr nötig.

Alles Übrige bleibt bewusst manuell — es braucht weitere IAM-Rechte bzw. kann im Fehlerfall
die App aussperren. **Der Workflow warnt aber sichtbar**, wenn ein Push `shared/`, `functions/`,
`firestore.rules` oder `firestore.indexes.json` berührt hat: Dann ist Hosting live, der Rest
läuft noch auf altem Stand. Besonders relevant bei `shared/` — das nutzen App **und** Function,
sonst rechnet der Coach mit altem Code weiter.

```bash
firebase deploy --only functions                      # Cloud Functions (KI-Empfehlung)
firebase deploy --only firestore:indexes              # Indizes
firebase deploy --only firestore:rules                # Rules
npm run build && firebase deploy --only hosting       # Hosting von Hand (Notfall/Rollback)
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
