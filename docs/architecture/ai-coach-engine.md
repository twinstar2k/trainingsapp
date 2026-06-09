# KI-Coach-Engine (Stufe 1.5)

**Status:** umgesetzt (P1 + P1.5), noch nicht deployt · **Stand:** 2026-06-09 · **Basis:** Stufe 1 (`docs/architecture/ai-recommendation.md`)
**Branch:** `feat/ai-coach-engine`
**Trainingswissenschaftliche Grundlage:** `docs/architecture/progressionsstrategien-krafttraining.md` (ACSM 2026).

Konsolidiert für diese Iteration Requirements + Architektur in einem Dokument.

---

## 1. Problem

Die Stufe-1-Empfehlung ist **reaktiv und LLM-getrieben**: Das Modell rechnet selbst, leitet
die Progression aus der letzten Session ab und improvisiert die Satzstruktur. Beobachtet im Praxistest
(Brustpresse, Ziel Progression):

- Empfahl **+5 kg** (Cap-Maximum) und nannte es „konservativ" — beide Wertungen (`konservativ`,
  `sauber geschafft`) stammen **wörtlich aus dem Prompt** und werden als Beobachtung zurückgespiegelt.
- „**Sauber geschafft**" ist ein Overclaim: Die App speichert nur Wdh × Gewicht, **keine Anstrengung**.
- Strukturen (Top-Set/Back-off vs. gerade Sätze) entstehen **ad hoc** → von Session zu Session
  inkonsistent. Ein Coach hat **ein** konsistentes Modell.
- Das Grundproblem: **+5 kg jede Woche ist nicht nachhaltig.** Es fehlt das Signal, ob die
  Progression **verdient** wurde.

## 2. Architektur-Prinzip: der Schwenk

> **Code = Systematik. LLM = Kommunikation mit dem Sportler.**

**Policy-first / LLM-explains:** Ein **deterministischer Policy-Kern** berechnet die Zahlen
(ob & wie viel Progression). Das LLM **formuliert die Begründung** in Coach-Sprache und behandelt
Sonderfälle (fehlende Historie, Übungswechsel) — es **rechnet nicht mehr**.

Das Sandwich bleibt, bekommt aber eine neue Schicht:

```
A. Kontext (deterministisch)      letzte Sessions, RIR, Trend, Region
        │
B. POLICY (deterministisch, NEU)  Entscheidungsbaum → konkrete Sätze (Gewicht/Wdh/Anzahl)
        │
C. LLM (Narration)                erklärt die berechnete Vorgabe, ehrlich & beobachtbar
        │
D. Guardrails (deterministisch)   schrumpfen — Policy liefert schon korrekte Werte
```

**Eigenschaften:**
- **Reproduzierbar** — gleiche Eingaben → gleiche Zahlen. Kein Re-roll nötig (siehe entfernter „Neu"-Button).
- **Graceful degradation** — fällt das LLM aus, kann eine Template-Begründung die Zahlen erklären.
- **Günstig & vertrauenswürdig** — die sicherheitsrelevante Mathematik liegt nicht im Modell.

## 3. Entschiedene Regeln (Produkt-Entscheidungen)

| Dimension | Entscheidung |
|---|---|
| **RIR-Erfassung** | Pro Übung, 3 Stufen: `2+ in Reserve` (=2) · `1 in Reserve` (=1) · `bis Versagen` (=0). Optional. |
| **Progressions-Trigger** | Last steigt nur, wenn **alle** Arbeitssätze den **oberen** Wdh-Rand erreichen **UND** RIR ≥ 1. |
| **Schrittweite** | Oberkörper **+2,5 kg** · Unterkörper **+5 kg**. Region deterministisch aus `muscleGroup`. |

**Region-Ableitung (kostet 0 Datenmodell-Arbeit):** Einzige Unterkörper-Gruppe im Katalog ist `Beine`.
→ `muscleGroup` enthält „Bein" → Unterkörper (+5 kg), sonst → Oberkörper (+2,5 kg). Core/Arme/Brust/
Rücken/Schultern = Oberkörper.

## 4. Der Policy-Kern (deterministischer Entscheidungsbaum)

Pro Übung, gegeben: Rep-Range `[min,max]` (aus Ziel), letzte Session (Sätze reps×weight),
letzter RIR, Region.

1. **Keine Historie** → konservativer Startwert, Flag `starter`. (LLM formuliert „vorsichtig herantasten".)
2. **Mit Historie:**
   - **a)** Range gefüllt (alle Sätze ≥ `max`) **und** RIR ≥ 1 → **Last erhöhen** um Inkrement(Region),
     Wdh zurück auf `min`. → `progress_load`
   - **b)** Range gefüllt **und** RIR = 0 (am Versagen erreicht) → **Last halten**, konsolidieren. → `hold_failure`
   - **c)** Range **nicht** gefüllt → **Last halten, Wdh Richtung `max`** (Ziel +1 Wdh/Satz, gedeckelt). → `progress_reps`
   - **Ziel `deload`** → Last −10…20 %, moderate Wdh. **Ziel `maintenance`** → wie zuletzt.
3. **Satzzahl:** wie letzte Session (Fallback 3).
4. **Cap-Sicherung (bleibt als Netz):** erhöhte Last nie > `min(+10 %, +5 kg)` ggü. letzter Session.
   Die Inkremente liegen ohnehin darunter.

**Policy-Output je Übung:** `{ sets:[{weight,reps}], action, reasonCode, increment, repRange, trend }` → geht
als Vorgabe ins LLM (Schicht C) und in die persistierte Empfehlung (Audit).

## 4.1 Trend-/Plateau-Schicht (über mehrere Einheiten) ✅ implementiert

Die §4-Logik entscheidet *innerhalb* einer Einheit. Darüber liegt eine zweite Schicht, die den
**Verlauf der letzten 3–5 vergleichbaren Exposures** bewertet — das macht aus dem Rechner einen Coach
(vgl. `progressionsstrategien-krafttraining.md` §6.2/§8/§14: „Trend vor Einzeldatum").

**Trend-Metrik = Progress-Index `maxWeight×100 + workingReps`** — bewusst **nicht** Epley-e1RM.
Begründung: Nach einer Last-Erhöhung mit Wdh-Reset (12→8) **fällt** der Epley-Wert kurz und würde
einen *gesunden* Double-Progression-Zyklus fälschlich als Plateau lesen. Der Index dagegen steigt bei
**jeder** echten Steigerung (Last *oder* Wdh) → robust gegen den Sägezahn. (Offline-Test deckt genau
diesen Fall ab.)

- **Richtung** über das jüngste 3er-Fenster: `up` / `flat` / `down`; `building` bei < 3 Exposures
  (dann keine Plateau-Aussage). `stalledSessions` = jüngste Einheiten ohne neuen Bestwert.
- **Plateau** = `flat`/`down` über ≥ 3 Exposures. Reaktion nach RIR der jüngsten Einheiten:
  - **Versagen erreicht (RIR 0), trotzdem flach → `stall_fatigue`:** Last halten (kein weiteres Pushen),
    Coach weist **behutsam** auf eine leichtere Woche hin. **Kein Auto-Deload** — der Nutzer entscheidet.
  - **Noch Reserve (RIR ≥ 1), trotzdem flach → `stall_push`:** „die Wdh wirklich an den oberen Rand"
    (Reiz war zu niedrig), Zahlen bleiben (progress_reps).
  - **Kein RIR → `stall_no_rir`:** bitten zu loggen, um Ermüdung von Luft-nach-oben zu trennen.
- **Zahlen ändert die Trend-Schicht nur im Ermüdungsfall** (halten statt +1 Wdh); sonst nur den
  Reason-Code → Coach-Sprache. `progress_load` (echte Steigerung jetzt) wird von altem flachem Trend
  **nicht** überstimmt.

**ask_rir (Sackgassen-Auflösung, Entscheidung Q2):** Wird der obere Wdh-Rand **2× in Folge ohne RIR**
erreicht, hängt die strikte Regel sonst ewig auf `hold`. Stattdessen fordert die Empfehlung dann **aktiv
die Reserve des härtesten Satzes** ein (`ask_rir`) — behält den Logging-Nudge, beendet die Sackgasse.

## 5. Rep-Ranges pro Ziel (entschieden)

| Ziel | Range | Anmerkung |
|---|---|---|
| `progression` | **8–12** | Floor von 6→8 angehoben: nach Last-Erhöhung kleinerer Wdh-Rücksprung, glatter. ✅ |
| `hypertrophy` | 8–12 | |
| `strength` | 4–6 | |
| `endurance` | 15–20 | |
| `maintenance` | wie zuletzt | kein fester Range |
| `deload` | wie zuletzt, Last −10…20 % | |

*(Stufe-1-Prompt nutzt aktuell „6–12" für progression. Der Floor wirkt nur auf den Rücksprung nach
einer Last-Erhöhung, nicht auf den Trigger.)*

## 6. LLM-Rolle neu definiert (Schicht C)

- **Input:** Kontext **+ die von der Policy berechnete Vorgabe + `reasonCode`**.
- **Aufgabe:** kurze, ehrliche Begründung in Coach-Sprache; erklärt das *warum*
  („letzte Einheit oberer Range bei 1 RIR Reserve → +2,5 kg verdient"); bei Datenlücke vorsichtig;
  bei Stagnation Stellschrauben-Hinweis (Pause/Tempo/Frequenz) in Prosa.
- **Verboten:** Zahlen ändern; Anstrengung/Technik/RPE behaupten, die nicht erfasst wurde
  („sauber", „leicht"); Framing-Vokabeln als Beobachtung.
- **Prompt ausgedünnt:** Progressions-Mathematik raus (macht die Policy), „sauber/konservativ" raus.

## 7. Datenmodell-Änderungen

- **`TrainingExercise.rir?: 0 | 1 | 2`** (pro Übung; sitzt bei `restSeconds`). Optional.
- **`PastSession.rir` / `ExerciseContext.lastRir`** durchreichen (`fetchSessions` + `context.ts`).
- **`ExerciseContext.trend: TrendPoint[]`** je Exposure um **`workingReps` + `rir`** angereichert
  (vorher nur `best1RM`/`maxWeight`) — Datenbasis der Trend-Schicht (§4.1). `context.ts` berechnet
  `workingReps` (Wdh am Arbeitsgewicht) pro Einheit vor.
- **`ExercisePlan.trend?: TrendSummary`** (Richtung/Exposures/stalledSessions) — fürs Coaching + Audit.
- **Region** in der Policy aus `muscleGroup` ableiten — **kein** Schema-Change an `Exercise`.
- **Firestore Rules:** `rir` liegt im bestehenden Trainings-Subtree → bereits abgedeckt.

## 8. Erfassungs-UX (RIR)

- In `TrainingDetail`, pro Übung, niedrigschwellig: kompaktes 3-Segment-Control
  („2+ Reserve · 1 Reserve · Versagen"). Optional, überspringbar. RIR = Reserve im **härtesten**
  Arbeitssatz (Tooltip entsprechend formuliert).
- **Fehlt RIR** → Policy konservativ: `progress_reps` erlaubt, **`progress_load` nur mit explizitem
  RIR ≥ 1**. Wird der obere Rand **2× in Folge ohne RIR** erreicht → **`ask_rir`** (aktiv nach der
  Reserve fragen, siehe §4.1) statt stiller Dauerschleife. — **entschieden (Q2)**.

## 9. Phasenplan

- **P1 (✅ umgesetzt):** RIR-Erfassung · Policy-Modul (Trigger + Inkrement + Wdh-Reset) ·
  Policy-first-Integration · Prompt ausdünnen · Eval-Szenarien erweitern · Redeploy.
- **P1.5 (✅ umgesetzt, dieser Branch):** **Trend-/Plateau-Erkennung** (§4.1) über 3–5 Exposures ·
  Plateau-Reaktion (`stall_fatigue`/`stall_push`/`stall_no_rir`, soft, kein Auto-Deload) ·
  **`ask_rir`** (Q2) · Trend-Hinweis im Prompt · Audit-Flags.
- **P2 (später):** Hard-Set-/Volumen-Manager pro Muskelgruppe/Woche (braucht Wochen-Aggregation) ·
  Schmerz-/Readiness-/Technik-Erfassung → harte Deload-/Override-Trigger · Übungswechsel-Engine ·
  Rep-Range/Inkrement pro Übung & Equipment konfigurierbar (Microloading) · RIR-Kalibrierung ·
  weitere Ziele exzellent machen (Maximalkraft etc.). Begründung der Priorisierung: für den
  **natürlichen** Sportler konvergieren Progression und Hypertrophie → Progressions-Kern zuerst.

## 10. Entscheidungen

**2026-06-08 (P1):**
1. **Rep-Range `progression`: 8–12** (Floor 6→8).
2. **Fehlendes RIR:** `progress_load` nur mit explizit bestätigter Reserve (RIR ≥ 1); ohne RIR
   höchstens `progress_reps`.

**2026-06-09 (P1.5, nach Abgleich mit `progressionsstrategien-krafttraining.md`):**
3. **Scope: Trend + Plateau jetzt** (statt nur testen) — parallel zum Deployen, weil der
   Progressions-Pfad ohnehin Trainingstage zum Testen braucht. **Kein** Volumen-Hinweis in P1.5
   (eigene Achse, P2).
4. **Trend-Metrik = Progress-Index** (`maxWeight×100 + workingReps`), **nicht** Epley-e1RM —
   sonst Fake-Plateau nach jedem Last-Sprung (§4.1).
5. **Plateau-Reaktion ist soft:** Hinweis auf leichtere Woche, **kein Auto-Deload** (Nutzer macht
   bewusst keine Deloads). Zahlen ändern nur im Ermüdungsfall.
6. **Fehlendes RIR → `ask_rir` (Q2):** Statt Dauer-`hold` aktiv nach der Reserve des härtesten
   Satzes fragen, sobald der obere Rand 2× in Folge ohne RIR erreicht wurde.
