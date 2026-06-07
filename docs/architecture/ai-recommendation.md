# Technisches Design: KI-Trainingsempfehlung

> Status: **Konzept / Entwurf**. Bezieht sich auf `docs/requirements/ai-recommendation.md`.
> Bezugsentscheidungen: Hosted-API hinter Backend · phasiert (Stufe 1 Progression → Stufe 2 Session-Design).

## 1. Architektur-Übersicht

Heute ist die App rein clientseitig („kein Backend"). Dieses Feature führt **zum ersten Mal eine serverseitige Schicht** ein — eine Firebase **Callable Cloud Function** als Proxy zur LLM-API. Das ist die zentrale Änderung.

### Das „Sandwich" — Code → LLM → Code

```
 NewTraining (Datum, Studio, gewählte Übungen)
        │  Klick "KI-Empfehlung holen"
        ▼
 httpsCallable: getTrainingRecommendation({ studioId, date, goal, exerciseIds })
        │
        ▼  ┌─────────────────────────  Cloud Function (Node, europe-west3)  ─────────────────────────┐
        │  │ (a) Auth: request.auth.uid prüfen (sonst abweisen)                                        │
        │  │ (b) Input validieren: goal ∈ Enum, exerciseIds ⊆ Katalog, studioId gehört dem User        │
        │  │ (c) KONTEXT BAUEN (admin SDK, streng auf uid begrenzt):                                    │
        │  │       • je Übung: letzte Session, bestes 1RM, Trend (letzte 3–5), Tage seit zuletzt        │
        │  │         → bei contextDependent NUR Historie desselben Studios                              │
        │  │       • Übungs-Metadaten (Typ, Muskelgruppe), aktuelles Körpergewicht (optional)           │
        │  │       → kompaktes "TrainingState"-Objekt (kein Roh-Dump → spart Tokens)                    │
        │  │ (d) LLM-AUFRUF: System-Prompt + TrainingState, STRUKTURIERTE Ausgabe erzwingen             │
        │  │       (Tool/JSON-Schema), Provider hinter Interface, Key aus Functions-Secret              │
        │  │ (e) VALIDIEREN/GUARDRAILS (deterministisch):                                               │
        │  │       • jede exerciseId ∈ angeforderte Liste                                               │
        │  │       • Gewicht innerhalb Progressions-Cap ggü. letzter Einheit (sonst klammern + Flag)    │
        │  │       • Reps in zielkonformer Range, numerische Plausibilität                              │
        │  │       • kein Verlauf → konservativer Startwert + Flag                                       │
        │  │ (f) Empfehlung persistieren (users/{uid}/recommendations) + an Client zurück               │
        │  └────────────────────────────────────────────────────────────────────────────────────────┘
        ▼
 Empfehlungs-Vorschau (editierbar)  ── User passt an ──┐
        │  Klick "Übernehmen"                           │
        ▼                                               │
 Bestehender Anlege-Pfad (addTrainingExercise/addSet)  ◄┘
        │
        ▼
 TrainingDetail (wie beim manuellen Anlegen)
```

**Kernidee:** Kontextaufbau (c) und Validierung (e) passieren in **Code**, das LLM (d) macht nur das Reasoning dazwischen. Der Client sieht den API-Key nie, und ein ungültiger/unsicherer Vorschlag erreicht den User gar nicht erst.

---

## 2. Datenmodell

### Erweiterungen (additiv, nicht-brechend)

```
users/{uid}
  └── trainingGoal?: GoalKey          ← NEU: Standard-Ziel (Default für Empfehlungen)

users/{uid}/trainings/{id}/exercises/{eid}
  └── restSeconds?: number            ← NEU (optional): empfohlene/erfasste Pause pro Übung

users/{uid}/trainings/{id}/exercises/{eid}/sets/{sid}
  └── (unverändert: reps?, weight?, duration?, distance?, status, order)

users/{uid}/recommendations/{rid}     ← NEUE Subcollection (Audit/Eval/Transparenz)
  ├── createdAt: number
  ├── goal: GoalKey
  ├── studioId: string
  ├── date: string                    ← Zieldatum des Trainings
  ├── model: string                   ← welches LLM-Modell
  ├── inputDigest: TrainingState      ← was dem LLM gezeigt wurde (kuratiert, klein)
  ├── output: RecommendationPayload   ← validierte Empfehlung
  ├── flags: string[]                 ← z.B. ["clamped:exId", "starter:exId"]
  └── status: 'proposed' | 'accepted' | 'discarded'
```

### Neue/erweiterte Typen (`src/types/index.ts`)

```typescript
export type GoalKey =
  | 'progression' | 'hypertrophy' | 'strength'
  | 'endurance' | 'maintenance' | 'deload';

// Was dem LLM als Kontext gezeigt wird (klein gehalten)
export interface ExerciseContext {
  exerciseId: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string;
  contextDependent: boolean;
  daysSinceLast: number | null;
  lastSession: { sets: Array<{ reps: number; weight?: number }> } | null;
  best1RM: number | null;
  trend: Array<{ date: string; best1RM: number | null; maxWeight: number }>; // letzte 3–5
}

export interface TrainingState {
  goal: GoalKey;
  date: string;
  studioId: string;
  bodyweightKg: number | null;
  exercises: ExerciseContext[];
}

// Was das LLM zurückgeben MUSS (strukturierte Ausgabe)
export interface RecommendedSet { reps: number; weight?: number; }
export interface RecommendedExercise {
  exerciseId: string;            // MUSS aus der angefragten Liste stammen
  rationale: string;             // kurze Begründung
  restSeconds: number;
  sets: RecommendedSet[];
}
export interface RecommendationPayload {
  summary: string;               // Gesamt-Begründung
  exercises: RecommendedExercise[];
}
```

### Indizes & Rules

- **Indizes:** Die Kontext-Query nutzt dieselbe Strategie wie `exercise-progress` (Trainings `status==completed`, nach Datum desc, ggf. `studioId`-Filter) → **die dort definierten Composite-Indizes reichen aus**, kein neuer Index nötig.
- **Security Rules:** neue Subcollection ergänzen:
  ```
  match /users/{userId}/recommendations/{recId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```
  Die Function selbst nutzt das **admin SDK und umgeht Rules** — sie muss deshalb **jeden Read/Write manuell auf `request.auth.uid` einschränken** (siehe Sicherheitsaspekte).

---

## 3. Backend — Cloud Function

### Wahl: Callable Function (`onCall`, Functions v2)

- **`onCall`** liefert `request.auth` automatisch (kein eigenes Token-Handling, kein CORS-Setup).
- **Region:** `europe-west3` (konsistent mit dem Projekt).
- **Secret + Endpunkt:** API-Key via `defineSecret('LLM_API_KEY')` (nur zur Laufzeit, nicht im Code); Base-URL = Requesty-EU-Endpunkt `https://router.eu.requesty.ai/v1` (OpenAI-SDK-kompatibel).
- **Neues Projektartefakt:** `functions/`-Verzeichnis (eigenes `package.json`, TypeScript), `firebase.json` um `functions`-Block erweitern.

### Provider-Abstraktion

```typescript
// functions/src/llm/provider.ts
export interface LlmProvider {
  recommend(system: string, state: TrainingState, schema: JsonSchema): Promise<RecommendationPayload>;
}
// Erste Implementierung: RequestyProvider (OpenAI-SDK gegen EU-Endpunkt, EU-Modell-ID),
// strukturierte Ausgabe via Tool-Use/JSON-Schema.
```

Dünne Schnittstelle → Gateway/Provider (Requesty-EU, Direkt-Provider, lokal) später austauschbar, ohne Aufrufer zu ändern.

### Strukturierte Ausgabe erzwingen

Das LLM wird über **Tool-Use / JSON-Schema** gezwungen, exakt `RecommendationPayload` zu liefern. Bei Schema-Verstoß: **ein Retry**, danach Fehler an den Client (US-06.1). So ist die Ausgabe maschinell weiterverarbeitbar (Voraussetzung fürs automatische Anlegen).

### Validierung / Guardrails (deterministisch, nach dem LLM)

| Regel | Verhalten bei Verstoß |
|---|---|
| `exerciseId` ∈ angefragte Liste | Übung verwerfen (Stufe 1 darf keine Übungen erfinden) |
| Gewicht ≤ Cap ggü. letzter Einheit (Default: **min(+10 %, +5 kg)**; `deload`: gezielt darunter) | auf Cap klammern, Flag `clamped:<id>` |
| Reps in zielkonformer Range, `reps > 0`, `weight ≥ 0`, plausible Obergrenzen | klammern/normalisieren |
| Übung ohne Historie | konservativer Startwert, Flag `starter:<id>` |
| `weighted` ohne Gewicht / `reps_only` mit Gewicht | Feldlogik je `type` erzwingen |

Die Caps sind als Konstanten zentral konfigurierbar (spätere Feinjustierung, offene Frage #3 im Requirements-Doc).

---

## 4. Schnittstellen / API

### Callable: `getTrainingRecommendation`

**Input:**
```typescript
{
  studioId: string;
  date: string;            // YYYY-MM-DD
  goal: GoalKey;
  exerciseIds: string[];   // vom User gewählt (Stufe 1)
}
```

**Output:**
```typescript
{
  recommendationId: string;
  payload: RecommendationPayload;   // bereits validiert/geklammert
  flags: string[];                  // z.B. ["clamped:exA", "starter:exB"]
  model: string;
}
```

**Fehlerszenarien (→ `HttpsError`):**
- `unauthenticated` — kein `request.auth`
- `invalid-argument` — Goal unbekannt / exerciseIds nicht im Katalog / studioId fremd
- `failed-precondition` — keine gültige LLM-Antwort nach Retry
- `internal` — unerwarteter Fehler
→ Client fängt alle ab und fällt sauber auf den manuellen Weg zurück (US-06.1).

---

## 5. Frontend-Komponenten

```
src/pages/NewTraining.tsx           ← Button "KI-Empfehlung holen" (aktiv ab ≥1 Übung)
src/components/ai/
  ├── RecommendationDialog.tsx      ← Ziel-Auswahl + Trigger + Lade-/Fehlerzustand
  ├── RecommendationPreview.tsx     ← editierbare Vorschau (Sätze, Pause, Begründung, Flags)
  └── GoalPicker.tsx                ← Ziel-Auswahl (auch im Profil wiederverwendbar)
src/hooks/useRecommendation.ts      ← httpsCallable kapseln (loading/error/result)
src/pages/Profile.tsx               ← Standard-Ziel (trainingGoal) setzen
src/lib/firebase.ts                 ← getFunctions(app, 'europe-west3') ergänzen
```

**State / Fluss:** `useRecommendation` ruft die Callable, liefert `loading | error | payload`. `RecommendationPreview` hält den (editierbaren) Vorschlag als lokalen State; „Übernehmen" mappt ihn auf den **bestehenden** Anlege-Pfad (`addTrainingExercise` + `addSet`) — kein neuer Schreibweg, dadurch konsistent mit dem manuellen Anlegen.

**Design:** gleiche Card-/Chip-/Button-Konventionen wie bestehende Seiten (`bg-surface-container-lowest rounded-2xl border border-surface-container`, Chips `rounded-full`, Primary-Button-Stil). Flags als dezente Badges („Startwert", „gedeckelt").

---

## 6. Sicherheitsaspekte

- **API-Key:** ausschließlich als Functions-Secret (`defineSecret`). Niemals im Client-Bundle, niemals im Repo. (Erinnerung: alles `VITE_*` landet im Client — der LLM-Key darf **kein** `VITE_*` sein.)
- **admin SDK umgeht Security Rules:** Die Function muss **jeden** Firestore-Zugriff explizit auf `request.auth.uid` scopen. Kein Pfad darf `uid` aus dem Input übernehmen — immer aus `request.auth`.
- **Input-Validierung in der Function:** `goal` gegen Enum, `exerciseIds` gegen Katalog, `studioId` gegen die Studios des Users. Nichts Ungeprüftes in den Prompt.
- **Prompt-Injection:** Übungs-/Studio-Namen sind teils user-generiert (Custom-Übungen). Mitigiert durch die **Validierungsschicht**: selbst ein manipulierter Prompt kann keine ungültige Übung oder ein unsicheres Gewicht erzeugen — die Guardrails klammern/verwerfen. LLM-Ausgabe gilt grundsätzlich als nicht vertrauenswürdig.
- **Missbrauch/Kosten:** Auth-gated; spätere Härtung optional ein simples per-User-Tageslimit.

### DSGVO / EU-Datenresidenz (Requesty)

**Zwei-Ebenen-Regel:** Vollständige EU-Residenz erfordert **beides** — den EU-Endpunkt *und* ein EU-gehostetes Modell:
1. **Gateway-Ebene:** EU-Endpunkt `https://router.eu.requesty.ai/v1` (Anthropic-kompatibel ohne `/v1`) → Routing/Logging/Analytics in Frankfurt (AWS `eu-central-1`).
2. **Inferenz-Ebene:** ausschließlich EU-Region-Modelle. **Globale** Modell-IDs (z. B. `anthropic/claude-sonnet-4-5-...`) verlassen zur Inferenz die EU.

**EU-Modelle — Frankfurt (`@eu-central-1`, Provider Bedrock), evaluiert Juni 2026:**

| Modell-ID | Rolle | Eval-Notiz |
|---|---|---|
| `bedrock/claude-haiku-4-5@eu-central-1` | **Default (gewählt)** | schnellste Latenz (~2,8 s e2e), 100 % valide, ~0,15 ¢/Empf. |
| `bedrock/minimax-m2.5@eu-central-1` | Fallback (günstig) | günstigstes (~0,06 ¢), aber ~2× Latenz, etwas forscher |
| `bedrock/claude-opus-4-8@eu-central-1` | optionaler Qualitätsmodus | feinste Beratung (Studio-Kontext erkannt), aber zu langsam als Default |

Entscheidung & Messwerte: `docs/qa-reports/ai-recommendation-model-eval.md`.

> Weitere EU-Optionen existieren (andere Bedrock-Zonen `@eu-west-1`/`@eu-north-1`, sowie Vertex `@eu`, Azure `@francecentral`/`@swedencentral`, Mistral EU-Default) — der obige Filter war Frankfurt/`eu-central-1`. „Flexibilität ∩ EU" bleibt die **Schnittmenge** EU-fähiger Modelle, nicht der volle 400+-Katalog. Exakte IDs + Live-Metriken in Requestys Model Library.

**Absicherung gegen versehentliche Nicht-EU-Nutzung (zwei Schichten):**
- In Requesty die Organisation per „Model Library"-Approval **auf EU-Modelle beschränken**.
- Zusätzlich serverseitig in der Function eine **Allowlist von EU-Modell-IDs** erzwingen (Konstante) — kein Request darf eine nicht-gelistete Modell-ID verwenden.

**Datenhaltung (Requesty-Angaben):** **Zero-Retention** — „prompts and completions are never stored … immediately discarded after delivery"; Audit-Logs nur Metadaten (Zeit, User, Modell, Token, Kosten), kein Prompt-Inhalt. TLS 1.3 (Transit) / AES-256 (at rest), GDPR-konform, **DPA auf Anfrage**.

**Vor produktivem Multi-User-Einsatz zu verifizieren / erledigen:**
- DPA unterzeichnen; Requesty **und** das jeweilige EU-Inferenz-Backend (AWS/Google/Azure/Mistral) als **Auftragsverarbeiter ins ROPA** aufnehmen — Datenkette `App → Requesty (EU) → EU-Modell-Provider`.
- **SOC 2 Type II:** Requesty-Doku ist hier widersprüchlich (an einer Stelle „compliant", an anderer „in progress, erwartet Q2 2026") → Status vor Produktion **bestätigen**.
- Explizite **„kein Training auf Daten"-Zusage** im DPA/Terms schriftlich festmachen (Zero-Retention impliziert es, reicht aber als Zusicherung allein nicht).
- **Eval vs. Produktion trennen:** Eval mit *deinen eigenen* Daten ist DSGVO-unkritisch (du bist einziges Datensubjekt). Die volle EU-/No-Train-/DPA-Härte greift ab dem Moment, in dem *fremde* Nutzerdaten fließen.

---

## 7. Kosten & Performance

- **Token-Budget klein halten:** Nur die kuratierte `TrainingState` geht in den Prompt (kein Roh-Verlauf). System-Prompt + Katalog-/Regelteil per **Prompt-Caching** wiederverwenden (sofern vom EU-Modell unterstützt) → günstiger pro Anfrage.
- **Gateway-Aufschlag:** Requesty ~5 % auf die Modellkosten (für unified API, Routing, Failover, EU-Endpunkt). Bei den kleinen Kontexten hier vernachlässigbar gegenüber dem Komfort; Direkt-Provider (0 % Aufschlag, aber Key-Verwaltung pro Anbieter) bleibt via Abstraktion offen.
- **Modellwahl:** Default `bedrock/claude-haiku-4-5@eu-central-1` (per Eval gewählt — ADR-03 / §6 / qa-report). Kosten je Empfehlung < ⅓ Cent → bei den kleinen Kontexten kein Unterscheidungskriterium.
- **Latenz:** wenige Sekunden pro Empfehlung — akzeptabel, weil bewusst per Klick ausgelöst; klarer Lade-Zustand (US-02.1).
- **Caching von Empfehlungen:** Innerhalb eines Tages ändert sich die Empfehlung kaum — optionales späteres Caching per (exerciseIds + goal + Verlaufs-Hash); für MVP nicht nötig.

---

## 8. Technische Entscheidungen (ADR)

### ADR-01: Callable Cloud Function als LLM-Proxy
**Status:** Akzeptiert
**Kontext:** Der LLM-Key darf nicht in den Client. Es braucht erstmals eine serverseitige Schicht.
**Entscheidung:** Firebase Callable Function (`onCall`, v2, `europe-west3`) als Proxy. Automatischer Auth-Context, kein CORS-/Token-Handling.
**Konsequenzen:** Blaze-Plan nötig (externe Egress-Calls). Neues `functions/`-Artefakt. App ist nicht mehr „rein clientseitig".
**Verworfen:** Direktaufruf aus dem Browser (Key-Leak); fremder Proxy-Dienst (zusätzliche Abhängigkeit, Datenschutz).

### ADR-02: Sandwich (serverseitiger Kontext + deterministische Validierung)
**Status:** Akzeptiert
**Kontext:** LLM-Ausgaben können halluzinieren oder unsichere Lasten vorschlagen; die Ausgabe muss exakt aufs Datenmodell passen.
**Entscheidung:** Kontext serverseitig bauen, LLM strikt strukturiert antworten lassen, Ausgabe gegen Katalog + Progressions-Caps + `contextDependent` validieren, bevor sie den User erreicht.
**Konsequenzen:** Mehr Backend-Logik, aber Sicherheit, Verlässlichkeit und sauberes Auto-Anlegen sind systemisch garantiert statt erhofft.

### ADR-03: Modell-Zugang über EU-Gateway (Requesty), hinter Provider-Abstraktion
**Status:** Akzeptiert (ersetzt die frühere Annahme „Anthropic direkt")
**Kontext:** Anforderung = LLM-**Flexibilität** + **EU-Datenresidenz** + **kein Training** auf Daten + Kosten/Leistung evaluierbar. Direkt-Provider erfüllen EU/No-Train je nach Anbieter unterschiedlich; ein US-Gateway (OpenRouter) bricht die EU-Residenz durch den US-Hop.
**Entscheidung:** Modell-Zugang über **Requesty** als EU-Gateway (Frankfurt, AWS `eu-central-1`), OpenAI-SDK-kompatibel über den **EU-Endpunkt** `https://router.eu.requesty.ai/v1`. Dahinter weiterhin die dünne `LlmProvider`-Abstraktion, damit Requesty selbst austauschbar bleibt. Strukturierte Ausgabe via Tool-Use/JSON-Schema; Prompt-Caching nur, sofern vom gewählten EU-Modell unterstützt.
**Zwei-Ebenen-Pflicht:** Der EU-Endpunkt hält nur *Requestys* Verarbeitung in der EU. Für Ende-zu-Ende-EU muss zusätzlich ein **EU-gehostetes Modell** gewählt werden (Details: §6 „DSGVO / EU-Datenresidenz"). Globale Modell-IDs würden zur Inferenz die EU verlassen.
**Modellwahl:** Per Eval entschieden (Juni 2026, Frankfurt/`eu-central-1` — siehe `docs/qa-reports/ai-recommendation-model-eval.md`): **Default `bedrock/claude-haiku-4-5@eu-central-1`** (schnellste e2e-Latenz ~2,8 s, 100 % Structured-Output, vernachlässigbare Kosten). Fallback `bedrock/minimax-m2.5@eu-central-1` (günstiger, aber ~2× Latenz); optionaler Qualitätsmodus `bedrock/claude-opus-4-8@eu-central-1` (feinste Beratung, zu langsam als Default).
**Konsequenzen:** Flexibilität (viele Modelle, ein Key, OpenAI-SDK) + EU-Residenz + Zero-Retention in einem Schritt; dafür ein zusätzlicher Sub-Prozessor (DPA/ROPA, §6) und Bindung an die Schnittmenge EU-fähiger Modelle. Die Abstraktion bleibt als Versicherung gegen Vendor-/Reifegrad-Risiko (Requesty = junges Startup).
**Verworfen:** OpenRouter (US-Hop, EU-Residenz unzuverlässig); Anthropic direkt (EU-Residenz schwächer). Beides bleibt über die Abstraktion theoretisch anschließbar; Local-LLM-Option ebenfalls offen.

### ADR-04: Metrik-Code für Function bereitstellen
**Status:** Vorschlag (im Umsetzungsschritt finalisieren)
**Kontext:** `src/utils/metrics.ts` (1RM, Volumen, Last-Session) wird auch serverseitig gebraucht; Function ist ein separates Node-Paket.
**Entscheidung (Vorschlag):** Reine Metrik-Funktionen in ein gemeinsam importierbares Modul auslagern (oder die wenigen benötigten Funktionen in `functions/` spiegeln). Keine Duplizierung der Formel-Logik ohne Single-Source.
**Konsequenzen:** Einheitliche Berechnung in Client und Function; kleine Umstrukturierung von `metrics.ts`.

---

## 9. Übergabe an Entwickler

### Voraussetzungen (DevOps)
1. **Firebase Blaze-Plan aktivieren** (Egress für externe LLM-API).
2. **Requesty-Account (EU):** API-Key als Functions-Secret (`firebase functions:secrets:set LLM_API_KEY`); EU-Endpunkt `https://router.eu.requesty.ai/v1` als Base-URL konfigurieren; Organisation in Requesty auf **EU-Modelle beschränken** (Model-Library-Approval); **DPA anfordern/unterzeichnen** (siehe §6).
3. `functions/`-Setup (`firebase init functions`, TypeScript), `firebase.json` um Functions-Block erweitern.

### Data Engineer
1. Security Rule für `users/{uid}/recommendations` ergänzen (siehe §2).
2. Bestätigen, dass die `exercise-progress`-Indizes die Kontext-Query abdecken (kein neuer Index erwartet).
3. Kein Migrationsskript nötig — neue Felder sind optional, Bestandsdaten kompatibel.

### Backend / Functions
1. `functions/src/llm/provider.ts` (+ `claudeProvider.ts`), JSON-Schema für `RecommendationPayload`.
2. `getTrainingRecommendation` (`onCall`): Auth → Input-Validierung → Kontext bauen → LLM → Guardrails → persistieren.
3. Guardrail-/Caps-Konstanten zentral; Unit-tests für die reine Guardrail-Logik (gut isoliert testbar — passt zum Tests-Punkt im Backlog).

### Frontend
1. `getFunctions(app, 'europe-west3')` in `src/lib/firebase.ts`.
2. Neue Typen in `src/types/index.ts`.
3. `useRecommendation`-Hook + `RecommendationDialog`/`Preview`/`GoalPicker`.
4. Button in `NewTraining.tsx`; „Übernehmen" auf bestehenden Anlege-Pfad mappen.
5. Standard-Ziel in `Profile.tsx`.

### Empfohlene Implementierungsreihenfolge (Stufe 1)
1. Datenmodell-Typen + Rules + `metrics.ts`-Auslagerung (ADR-04).
2. `functions/`-Gerüst + Provider + Schema (mit Mock-Antwort lokal testen, Emulator).
3. Kontextaufbau + Guardrails (Unit-tests).
4. Echter Claude-Aufruf + Secret.
5. Frontend: Hook → Dialog → editierbare Vorschau → Übernehmen.
6. Profil: Standard-Ziel. Ende-zu-Ende-Test im Emulator, dann Deploy.

### Stufe 2 (separates Detailkonzept)
LLM wählt Übungen selbst (Split/Balance/Erholung): erweiterter Kandidaten-Kontext (zuletzt trainierte Muskelgruppen, Erholung), zusätzliche Guardrails (Volumen-/Erholungs-Plausibilität), Übungsauswahl aus dem **gesamten** Katalog statt fester Liste.

---

## 10. Modell-Eval-Plan (erster praktischer Schritt)

**Ziel:** Vor dem Bau der Function das EU-Modell mit dem besten **Verhältnis aus Structured-Output-Zuverlässigkeit, Coaching-Qualität und Kosten** für Stufe 1 bestimmen. Bewusst klein gehalten — eine Vorab-Messung, kein vollständiges Benchmarking.

> **Status: durchgeführt (Juni 2026).** Ergebnis & Entscheidung: `docs/qa-reports/ai-recommendation-model-eval.md` → Default `bedrock/claude-haiku-4-5@eu-central-1`.

**Evaluierte Kandidaten (Frankfurt/`eu-central-1`, Bedrock):**
1. `bedrock/claude-haiku-4-5@eu-central-1` — Sweet-Spot (schnell, robustes Tool-Use) → **gewählt**
2. `bedrock/minimax-m2.5@eu-central-1` — günstiger Herausforderer (offenes Modell)
3. `bedrock/claude-opus-4-8@eu-central-1` — Qualitäts-Obergrenze

**Testdaten:** 5–8 reale `TrainingState`-Szenarien aus der **eigenen** Historie (du = einziges Datensubjekt → DSGVO unkritisch), die die Grenzfälle abdecken:
- (a) `weighted` mit klarer Progressionshistorie
- (b) `reps_only`/Bodyweight
- (c) `context_dependent`-Maschine über zwei Studios (Studio-Scope muss greifen)
- (d) Übung **ohne** Historie (Startwert-Fall)
- (e) Ziel `deload` (Last muss bewusst sinken)

**Vorgehen:** Schlankes, eigenständiges Node-Skript (OpenAI-SDK gegen `https://router.eu.requesty.ai/v1`, Requesty-Key lokal) — **kein** Cloud-Function-Bau nötig. Je Kandidat × Szenario: identischer System-Prompt + JSON-Schema, Ausgabe + Latenz + Token/Kosten protokollieren.

**Bewertungskriterien:**
| Kriterium | Messung | Schwelle |
|---|---|---|
| Structured-Output-Validität | Schema-konform 1. Versuch / nach 1 Retry | **Hartes Gate** — muss zuverlässig sein |
| Guardrail-Sauberkeit | Anteil Ausgaben ohne nötiges Klammern | je höher, desto besser |
| Coaching-Qualität | subjektiv 1–5 (passt Vorschlag zu Ziel + Verlauf?) | Hauptkriterium |
| Kosten / Empfehlung | Tokens × Preis | so gering wie sinnvoll |
| Latenz | Sekunden bis Antwort | < ~5 s angenehm |

**Entscheidungsregel:** Structured-Output ist Pflicht-Gate (Auto-Anlegen hängt daran). Unter den Bestehern das beste **Qualität-pro-Kosten**-Modell als Default pinnen; Rest bleibt via Abstraktion austauschbar.

**Ergebnis:** kurze Resultate-Tabelle → bei Abschluss als `docs/qa-reports/ai-recommendation-model-eval.md` festhalten.
</content>
