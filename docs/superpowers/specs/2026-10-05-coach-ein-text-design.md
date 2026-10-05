# Coach fragen: ein Text statt zwei

**Stand:** 2026-10-05

## Problem

Der Coach-Dialog zeigte zwei Texte: oben einen grünen Kasten, darunter im grauen Kartenkopf einen
zweiten. Beide sagten weitgehend dasselbe, und der zweite stand in der kleineren Schrift
(`text-xs` gegenüber `text-sm`).

## Ursache

Der Vertrag stammt aus der Zeit, als eine Anfrage mehrere Übungen abdecken sollte: `summary` als
Gesamt-Begründung, `rationale` als Einzel-Begründung je Übung. Tatsächlich öffnet
`TrainingDetail` den Dialog immer für **genau eine Übung**. Bei einer Übung sind „gesamt" und
„einzeln" derselbe Inhalt — das LLM musste ihn zweimal formulieren.

## Entscheidung

- `summary` ist aus dem Vertrag entfernt (`shared/ai-types.ts`, Tool-Schema, Prompt, Guardrails,
  Eval-Spiegel). Der Feldname `rationale` bleibt.
- `rationale` ist der einzige Text: ein Fließtext mit 2–4 Sätzen, erst was der Verlauf zeigt
  (Wdh × Gewicht, RIR falls erfasst, Trend-Hinweis), dann was heute ansteht und warum. Keine
  Zwischenüberschriften, kein zweites Feld.
- Die inhaltlichen Verbote im Prompt gelten unverändert (keine erfundene Anstrengung, kein
  8–12-Bereich bei `reps_only`, kein Last-Sprung bei `load_capped_reps`).
- Anzeige: grauer Kopfstreifen mit Übungsname, Pause und Flag-Chips. Darunter der Text als grün
  getönter Block (`bg-primary/10`, `text-base leading-relaxed text-on-surface`), dann die
  editierbaren Sätze. Der Block trägt weder Icon noch Label — der Absender steht bereits in der
  Kopfzeile des Dialogs („Dein Coach" mit Funkeln-Icon). Kräftiges Vollgrün bleibt dem
  „Übernehmen"-Button vorbehalten.
- Der Fallback bei fehlendem LLM-Text bleibt `describePlan` (`shared/policy.ts`).

Verworfen: zwei beschriftete Absätze „Analyse" / „Empfehlung". Das wären wieder zwei Felder im
Vertrag und mehr Höhe über den Sätzen, ohne dass der Inhalt klarer würde.

## Kompatibilität und Deploy

Hosting und Function lassen sich in beliebiger Reihenfolge ausliefern:

- neue App, alte Function: `summary` wird ignoriert, der bisherige kürzere Text erscheint im neuen
  Layout.
- alte App, neue Function: der grüne Kasten hängt an `payload.summary &&` und bleibt leer.

Der ausführlichere Text kommt erst mit `firebase deploy --only functions`. Alte Dokumente in
`users/{uid}/recommendations` behalten ihr `summary`; der Client liest sie nicht zurück, eine
Migration ist nicht nötig. `validateStructure` toleriert ein überzähliges `summary`, falls ein
Modell es weiterhin mitschickt.

## Test

`eval/guardrails.test.mjs` prüft das Strukturgate der kompilierten Function und des Eval-Spiegels
gegen dieselben Fälle: Payload ohne `summary` gültig, `rationale` bleibt Pflicht, ausgelieferte
Payloads tragen kein `summary`.
