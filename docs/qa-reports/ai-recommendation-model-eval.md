# QA-Report: Modell-Eval KI-Trainingsempfehlung (Stufe 1)

**Datum:** 2026-06-07 · **Gateway:** Requesty EU (`router.eu.requesty.ai`) · **Zone:** Frankfurt `eu-central-1` (Bedrock)
**Harness:** `eval/` (6 synthetische Szenarien, je 1 Lauf) · **Bezug:** `docs/architecture/ai-recommendation.md` §10

## Entscheidung

**Default-Modell: `bedrock/claude-haiku-4-5@eu-central-1`.**
- `bedrock/minimax-m2.5@eu-central-1` — günstiger Fallback
- `bedrock/claude-opus-4-8@eu-central-1` — optionaler Qualitätsmodus

## Messwerte

Alle 18 Läufe (3 Modelle × 6 Szenarien): **valide, 0 violations, 0 clamps**; `starter`-Flag korrekt nur im „ohne Historie"-Szenario. Das Structured-Output-Gate haben **alle drei** bestanden — auch das offene minimax.

| Modell | valide | viol/clamps | Ø Latenz (e2e) | Ø Tokens | ~Kosten/Empf. |
|---|---|---|---|---|---|
| **claude-haiku-4-5** | 6/6 | 0/0 | **~2,8 s** | ~2.020 | ~0,15 ¢ |
| minimax-m2.5 | 6/6 | 0/0 | ~5,9 s | ~1.680 | ~0,06 ¢ |
| claude-opus-4-8 | 6/6 | 0/0 | ~5,2 s | ~2.220 | ~0,27 ¢ |

## Begründung

- **Latenz ist der entscheidende UX-Hebel** für „Klick → Vorschlag" — haiku-4-5 ist mit ~2,8 s e2e mit Abstand am schnellsten (minimax/opus ~5–6 s).
- **Structured Output:** 100 % bei allen → kein Unterscheidungskriterium.
- **Kosten:** trennen die Modelle praktisch nicht (alle < ⅓ Cent/Empfehlung).
- **Qualität:** alle drei sicher (korrekte Deload-Richtung −15…−17 %, Typ-Regeln eingehalten, Cap nie verletzt). opus am feinsten (referenzierte in Szenario C explizit das Studio → context_dependent verstanden); haiku gelegentlich leicht forsch (C: +5 kg *und* 12 Reps); minimax am forschesten beim Gewicht.

## Caveats

- **n = 1 pro Zelle** → Latenz ist verrauscht; bei Bedarf den Finalisten 2–3× wiederholen.
- Szenarien sind **synthetisch** (prüfen Korrektheit, nicht Geschmack auf echten Daten). Re-Eval mit echter Historie via gitignorierter `eval/scenarios.local.json` möglich.
- Requesty-Dashboard-Latenz ≠ unsere e2e-Messung (Dashboard nennt für minimax 1,7 s; e2e war ~5,9 s — vermutlich TTFT vs. Vollständigkeit).

## Reproduktion

```bash
cd eval && echo "REQUESTY_API_KEY=..." > .env && node run-eval.mjs
```
Rohdaten (gitignored): `eval/results/eval-<ts>.{json,md}`.
</content>
