# Modell-Eval — KI-Trainingsempfehlung (Stufe 1)

Eigenständiges Harness, um **vor** dem Bau der Cloud Function das beste EU-Modell auszuwählen.
Misst pro Modell × Szenario: **Structured-Output-Zuverlässigkeit, Guardrail-Sauberkeit, Latenz, Tokens** —
und legt die Empfehlungen für die manuelle **Qualitäts-Bewertung (1–5)** ab.

Gehört zum Konzept in `docs/architecture/ai-recommendation.md` (§10 Modell-Eval-Plan).
**Dependency-frei** (native `fetch`, Node ≥ 18) — kein `npm install` nötig.

## Start

1. Requesty-API-Key bereitstellen — `eval/.env` anlegen:
   ```
   REQUESTY_API_KEY=sk-...
   ```
2. Laufen lassen:
   ```
   cd eval
   node run-eval.mjs        # oder: npm run eval
   ```

Ergebnisse landen in `eval/results/` (gitignored): eine `.json` (vollständig) und eine `.md`
mit Übersicht + Empfehlungen je Szenario inkl. Platzhalter „Qualität (1–5)".

## Konfiguration (optional, per Env)

| Variable | Default | Zweck |
|---|---|---|
| `REQUESTY_API_KEY` | – | **Pflicht.** Requesty-Key. |
| `REQUESTY_BASE_URL` | `https://router.eu.requesty.ai/v1` | EU-Endpunkt (OpenAI-kompatibel). |
| `REQUESTY_MODELS` | `bedrock/claude-haiku-4-5@eu-central-1,bedrock/minimax-m2.5@eu-central-1,bedrock/claude-opus-4-8@eu-central-1` | Kandidaten, kommagetrennt. |

> **Exakte Modell-IDs** per Copy-Button in Requestys Model Library holen. Falls ein Lauf `model not found`
> meldet, das `bedrock/`-Prefix anpassen/weglassen. Default = Frankfurt-Kandidaten (haiku-4-5 / minimax-m2.5 / opus-4-8).

> **EU-Pflicht:** Nur **EU-Modell-IDs** verwenden (`@eu`, `@eu-central-1`, …). Globale IDs verlassen zur Inferenz die EU
> (siehe `docs/architecture/ai-recommendation.md`, §6). Exakte EU-Modell-IDs in Requestys Model Library prüfen.

Kosten werden nur berechnet, wenn in `run-eval.mjs` die `PRICES`-Tabelle gefüllt ist
(aktuelle Preise aus dem Requesty-Dashboard) — sonst Spalte `cost = –`.

## Datenschutz / echte Daten

`scenarios.json` enthält **synthetische** Daten (sicher commitbar). Für eine Eval mit deiner
**echten** Historie: lege `eval/scenarios.local.json` an (gleiche Struktur) — das Skript bevorzugt sie
automatisch, und sie ist **gitignored** (wird nie committet).

## Was gemessen wird

| Kriterium | Bedeutung | Schwelle |
|---|---|---|
| **valide** | Schema-konforme Ausgabe (1. Versuch / nach 1 Retry) | Hartes Gate — Auto-Anlegen hängt daran |
| **clamps** | Gewicht über Progressions-Cap (`min(+10 %, +5 kg)`) → müsste geklammert werden | je weniger, desto besser |
| **viol** | harte Regelverstöße (erfundene Übung, Gewicht bei Bodyweight, Reps außerhalb 1–30) | sollte 0 sein |
| **starter** | Übung ohne Historie → Startwert-Flag (kein Verstoß) | nur Info |
| **ms / tok** | Latenz und Tokenverbrauch | Kosten/Performance |
| **Qualität** | manuell 1–5 im `.md`: passt der Vorschlag zu Ziel + Verlauf? | Hauptkriterium |

## Dateien

- `run-eval.mjs` — Runner (Aufrufe, Retry-Logik, Tabellen, Ergebnis-Export)
- `lib.mjs` — Prompt, Tool-Schema, Strukturvalidierung, Guardrails (Entwurf der späteren Function-Logik)
- `scenarios.json` — synthetische Test-Szenarien (Grenzfälle a–e + Multi-Übung)
