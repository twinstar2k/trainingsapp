# Design: Profil-Personalisierung ohne Datensammlung

**Datum:** 2026-07-19
**Anlass:** Testuserinnen-Feedback — das Profil wirkt „unvollständig", weil User keinen Namen, Geschlecht oder Geburtsdatum hinterlegen können.

## Fachliche Einordnung: Warum kein Alter/Geschlecht?

Die Kernfrage der Diskussion war, ob Geschlecht und Alter den KI-Coach verbessern würden. Antwort: nein — und das ist eine Stärke der App, kein Versäumnis.

- **Alter und Geschlecht sind Populations-Priors.** Sie beschreiben Durchschnitte über Gruppen und sind nur nützlich, wenn man über eine Person nichts weiß. Die App hat das bessere Signal: die tatsächliche individuelle Trainingshistorie. Der Coach autoreguliert über real geloggte Leistung + RIR (`shared/policy.ts`) — eine 50-jährige trainierte Frau ist damit korrekt stärker eingeschätzt als ein 20-jähriger untrainierter Mann, ohne dass die App Alter oder Geschlecht kennt.
- **Relative Progression ist zwischen den Geschlechtern ähnlich.** Absolute Lasten unterscheiden sich im Mittel, aber die App rechnet nie mit Normwerten, sondern immer relativ zur eigenen Historie (Double Progression). Ein Geschlechts-Feld lieferte der Engine kein zusätzliches Signal.
- **Die eine echte Geschlechts-Ausnahme ist der Menstruationszyklus** — dafür existiert ein eigenes Backlog-Item (Zyklus-Awareness, DSGVO Art. 9). Wer das Feature später nutzt, hat die Geschlechtsfrage implizit beantwortet; ein Profil-Feld braucht es dafür nicht.
- **Alter wird nur an Extremen relevant** (Kinder: keine Maximallasten; Hochbetagte: langsamere Sehnen-Adaptation, längere Erholung). Auch das dämpft die Autoregulation größtenteils selbst; für die Private Beta mit erwachsenen Testern ist es theoretisch.
- **DSGVO-Datenminimierung (Art. 5 Abs. 1 lit. c):** Daten ohne Zweck zu erheben ist genau das, was man nicht tun soll. Kein Geschlechts-/Geburtsdatums-Feld ist Privacy by Design — die App weiß nur, was sie für gutes Coaching braucht.

**Konsequenz:** Das Gefühl von Vollständigkeit entsteht durch Personalisierung ohne Datenerhebung — und die Design-Entscheidung wird in der App selbst transparent gemacht.

## Entscheidung

1. **Profilseite** zeigt Google-Profilbild + Name statt nur E-Mail
2. **Dashboard-Begrüßung** nutzt den aufgelösten Anzeigenamen (existierte schon mit Google-Vornamen)
3. **Optionaler Spitzname** überschreibt den Google-Vornamen — das einzige neue Datum, freiwillig und vom User selbst gewählt
4. **Transparenz-Abschnitt** im Profil: ausklappbar „Warum fragen wir nicht nach Alter & Geschlecht?"
5. **Kein Coach-/LLM-Einfluss** — der Name geht nicht an die KI-Function

## Design

### Datenmodell

- `users/{uid}.nickname?: string` — optional, getrimmt, max. 30 Zeichen. Entfernen = Feld löschen (`deleteField()`) → Fallback auf Google-Namen.
- Auflösung Anzeigename: `nickname` → erster Token von `user.displayName` → `'Athlet'`.
- **Kein Rules-Change:** `users/{userId}` hat keine Feld-Validierung (`firestore.rules`).

### AuthContext (`src/contexts/AuthContext.tsx`)

Der Login-Flow liest `users/{uid}` bereits (Ensure-Exists) — `nickname` wird aus demselben Snapshot mitgelesen, null zusätzliche Firestore-Reads. Neu im Context:

- `nickname: string | null`
- `firstName: string` — fertig aufgelöst, damit Konsumenten keine Split-Logik duplizieren
- `updateNickname(n: string | null): Promise<void>` — schreibt/löscht das Feld und aktualisiert den State

### Profilseite (`src/pages/Profile.tsx`)

- **Kopf:** Google-Profilbild (`user.photoURL` mit `referrerPolicy="no-referrer"`; Fallback: Initialen-Kreis), Name groß, E-Mail klein darunter.
- **Spitzname:** Stift-Button am Namen → `PromptDialog` (erweitert um `allowEmpty`-Prop, da leere Eingabe = Spitzname entfernen).
- **Transparenz-Block** direkt unter dem Kopf, ausklappbar: Der Coach nutzt die echte Trainingshistorie statt Durchschnittswerten nach Alter/Geschlecht; erhoben wird nur, was das Training verbessert.

### Dashboard (`src/pages/Dashboard.tsx`)

Begrüßung stellt auf `firstName` aus `useAuth()` um.

## Verifikation

- `npm run build` (TypeScript strict + Vite)
- Manuell am Dev-Server: Spitzname setzen/ändern/entfernen (Profil + Dashboard-Begrüßung), Verhalten ohne `photoURL`, Transparenz-Block auf-/zuklappen
- Kein Rules-, Functions- oder Index-Deploy nötig
