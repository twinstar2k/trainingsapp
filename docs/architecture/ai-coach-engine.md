# KI-Coach-Engine (Stufe 1.5)

**Status:** Konzept · **Stand:** 2026-06-08 · **Basis:** Stufe 1 (`docs/architecture/ai-recommendation.md`)
**Branch (geplant):** `feat/ai-coach-engine` (auf Basis des aktuellen `feat/ai-recommendation`)

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

**Policy-Output je Übung:** `{ sets:[{weight,reps}], action, reasonCode, increment, repRange }` → geht
als Vorgabe ins LLM (Schicht C) und in die persistierte Empfehlung (Audit).

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
- **Region** in der Policy aus `muscleGroup` ableiten — **kein** Schema-Change an `Exercise`.
- **Firestore Rules:** `rir` liegt im bestehenden Trainings-Subtree → bereits abgedeckt.

## 8. Erfassungs-UX (RIR)

- In `TrainingDetail`, pro Übung, niedrigschwellig: kompaktes 3-Segment-Control
  („2+ Reserve · 1 Reserve · Versagen"). Optional, überspringbar.
- **Fehlt RIR** → Policy konservativ: `progress_reps` erlaubt, **`progress_load` nur mit explizitem
  RIR ≥ 1**. (Kein Last-Sprung ohne bestätigte Reserve.) — **entschieden**.

## 9. Phasenplan

- **P1 (dieser Branch):** RIR-Erfassung · Policy-Modul (Trigger + Inkrement + Wdh-Reset) ·
  Policy-first-Integration · Prompt ausdünnen · Eval-Szenarien erweitern · Redeploy.
- **P2 (später):** Stall-/Deload-Erkennung · Volumen-Progression · weitere Stellschrauben als
  LLM-Vorschläge · Rep-Range/Inkrement pro Übung konfigurierbar.

## 10. Entscheidungen (2026-06-08)

1. **Rep-Range `progression`: 8–12** (Floor 6→8).
2. **Stall-/Deload-Erkennung: erst P2.** P1 bleibt auf den Progressions-Kern fokussiert.
3. **Fehlendes RIR:** `progress_load` nur mit explizit bestätigter Reserve (RIR ≥ 1); ohne RIR
   höchstens `progress_reps`.
