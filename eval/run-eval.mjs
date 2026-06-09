// run-eval.mjs — Modell-Eval für die KI-Trainingsempfehlung (Stufe 1).
//
// Ruft je Kandidaten-Modell × Szenario die Requesty-EU-API (OpenAI-kompatibel)
// auf, erzwingt strukturierte Ausgabe per Tool-Use, validiert und prüft Guardrails.
// Dependency-frei (native fetch, Node >= 18).
//
// Nutzung:
//   1) eval/.env anlegen mit:  REQUESTY_API_KEY=sk-...
//   2) node run-eval.mjs    (oder: npm run eval)
//
// Optional per Env: REQUESTY_BASE_URL, REQUESTY_MODELS (kommagetrennt)

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import {
  RECOMMENDATION_TOOL, buildMessages, extractPayload, validateStructure, applyGuardrails, applyPolicyOverride,
} from './lib.mjs';
// Policy-first: deterministischer Kern (kompiliert). Vorher bauen: cd ../functions && npx tsc
import { computeExercisePlan } from '../functions/lib/shared/policy.js';

// ─── .env laden (versionsunabhängig, kein dotenv nötig) ──────────────────────────
function loadEnv() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const API_KEY = process.env.REQUESTY_API_KEY;
if (!API_KEY) {
  console.error('✗ REQUESTY_API_KEY fehlt. In eval/.env setzen oder exportieren.');
  process.exit(1);
}

const BASE_URL = process.env.REQUESTY_BASE_URL || 'https://router.eu.requesty.ai/v1';
// Frankfurt/eu-central-1 (Bedrock) — exakte IDs via Copy-Button in Requesty prüfen.
// haiku-4-5 = Sweet-Spot, minimax-m2.5 = günstiger Herausforderer, opus-4-8 = Qualitäts-Obergrenze.
const MODELS = (process.env.REQUESTY_MODELS ||
  'bedrock/claude-haiku-4-5@eu-central-1,bedrock/minimax-m2.5@eu-central-1,bedrock/claude-opus-4-8@eu-central-1')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Blended $/1M Tokens aus dem Requesty-Dashboard (Frankfurt) — grobe Näherung ohne in/out-Split.
// Bei Bedarf je Modell auf den aktuellen Wert anpassen; leerer Eintrag → Kosten-Spalte zeigt "–".
const PRICES = {
  'bedrock/claude-haiku-4-5@eu-central-1': 0.73,
  'bedrock/minimax-m2.5@eu-central-1': 0.37,
  'bedrock/claude-opus-4-8@eu-central-1': 1.23,
};

const scenariosFile = existsSync('scenarios.local.json') ? 'scenarios.local.json' : 'scenarios.json';
const scenarios = JSON.parse(readFileSync(scenariosFile, 'utf8'));

// ─── Ein API-Call ───────────────────────────────────────────────────────────────
async function callModel(model, messages) {
  const t0 = Date.now();
  let res, text;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        tools: [RECOMMENDATION_TOOL],
        tool_choice: { type: 'function', function: { name: 'submit_recommendation' } },
        temperature: 0.3,
      }),
    });
    text = await res.text();
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e), latencyMs: Date.now() - t0 };
  }
  let json = null;
  try { json = JSON.parse(text); } catch { /* lassen wir als null */ }
  return { ok: res.ok, status: res.status, json, text, latencyMs: Date.now() - t0 };
}

// ─── Ein Szenario gegen ein Modell ───────────────────────────────────────────────
async function evalOne(model, scenario) {
  const state = scenario.state;
  const plans = state.exercises.map((e) => computeExercisePlan(e, state.goal));
  let messages = buildMessages(state, plans);
  let payload = null, structErr = null, api = null, tries = 0;

  for (tries = 1; tries <= 2; tries++) {
    api = await callModel(model, messages);
    if (!api.ok || !api.json) {
      return { ok: false, valid: false, apiError: api.error || `HTTP ${api.status}: ${(api.text || '').slice(0, 160)}`, latencyMs: api.latencyMs };
    }
    const ex = extractPayload(api.json);
    if (ex.payload) {
      const v = validateStructure(ex.payload);
      if (v.valid) { payload = ex.payload; break; }
      structErr = v.errors.join('; ');
    } else {
      structErr = ex.error || 'keine Tool-Antwort';
    }
    if (tries < 2) {
      messages = [...messages, {
        role: 'user',
        content: `Deine letzte Antwort war ungültig (${structErr}). Antworte erneut AUSSCHLIESSLICH über das Tool submit_recommendation mit gültigem Schema.`,
      }];
    }
  }

  const usage = api?.json?.usage || {};
  if (!payload) {
    return { ok: false, valid: false, validFirst: false, retried: tries > 1, structErr, latencyMs: api.latencyMs, usage };
  }
  const merged = applyPolicyOverride(payload, plans);
  const g = applyGuardrails(merged, state);
  return {
    ok: true,
    valid: true,
    validFirst: tries === 1,
    retried: tries > 1,
    clamps: g.clamps.length,
    violations: g.violations.length,
    starters: g.starters.length,
    guardrails: g,
    latencyMs: api.latencyMs,
    usage,
    payload: merged,
  };
}

// ─── Kosten ──────────────────────────────────────────────────────────────────────
function costOf(model, usage) {
  const p = PRICES[model];
  if (p == null || !usage?.total_tokens) return null;
  return (usage.total_tokens / 1e6) * p; // p = blended $/1M Tokens
}

// ─── Hauptlauf ────────────────────────────────────────────────────────────────────
console.log(`\nEU-Endpunkt: ${BASE_URL}`);
console.log(`Modelle:     ${MODELS.join(', ')}`);
console.log(`Szenarien:   ${scenarios.length} aus ${scenariosFile}\n`);

const results = [];
for (const model of MODELS) {
  for (const sc of scenarios) {
    process.stdout.write(`▶ ${model}  ×  ${sc.id} … `);
    let r;
    try { r = await evalOne(model, sc); } catch (e) { r = { ok: false, valid: false, apiError: String(e?.message || e) }; }
    results.push({ model, scenario: sc.id, ...r });

    if (r.apiError) console.log(`API-FEHLER (${r.apiError})`);
    else if (!r.valid) console.log(`UNGÜLTIG (${r.structErr})`);
    else console.log(`ok${r.retried ? ' (retry)' : ''}  clamps=${r.clamps} viol=${r.violations} starter=${r.starters}  ${r.latencyMs}ms  ${r.usage.total_tokens ?? '?'}tok`);
  }
}

// ─── Übersichtstabelle ─────────────────────────────────────────────────────────────
const table = results.map((r) => ({
  Modell: r.model,
  Szenario: r.scenario,
  valide: r.valid ? (r.retried ? 'ja (retry)' : 'ja') : 'NEIN',
  clamps: r.clamps ?? '–',
  viol: r.violations ?? '–',
  starter: r.starters ?? '–',
  ms: r.latencyMs ?? '–',
  tok: r.usage?.total_tokens ?? '–',
  cost: (() => { const c = costOf(r.model, r.usage); return c == null ? '–' : c.toFixed(5); })(),
}));
console.log('\n── Übersicht ──');
console.table(table);

// Aggregat je Modell
console.log('\n── Aggregat je Modell ──');
const agg = {};
for (const r of results) {
  const a = (agg[r.model] ||= { n: 0, valid: 0, retried: 0, clamps: 0, viol: 0, ms: 0, tok: 0 });
  a.n++; if (r.valid) a.valid++; if (r.retried) a.retried++;
  a.clamps += r.clamps || 0; a.viol += r.violations || 0; a.ms += r.latencyMs || 0; a.tok += r.usage?.total_tokens || 0;
}
console.table(Object.entries(agg).map(([model, a]) => ({
  Modell: model,
  'valide/n': `${a.valid}/${a.n}`,
  retries: a.retried,
  clamps: a.clamps,
  viol: a.viol,
  'Ø ms': Math.round(a.ms / a.n),
  'Σ tok': a.tok,
})));

// ─── Ergebnisse speichern (inkl. Empfehlungen für manuelle Qualitäts-Bewertung) ──
const ts = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync('results', { recursive: true });
writeFileSync(`results/eval-${ts}.json`, JSON.stringify(results, null, 2));

const md = [`# Modell-Eval — ${ts}`, '', `Endpunkt: \`${BASE_URL}\`  ·  Szenarien: ${scenariosFile}`, ''];
for (const model of MODELS) {
  md.push(`## ${model}`, '');
  for (const sc of scenarios) {
    const r = results.find((x) => x.model === model && x.scenario === sc.id);
    md.push(`### ${sc.id}`, `_${sc.description}_`, '');
    if (!r?.valid) { md.push(`**Ergebnis:** ${r?.apiError ? 'API-FEHLER — ' + r.apiError : 'UNGÜLTIG — ' + r?.structErr}`, ''); continue; }
    md.push(`**valide:** ${r.retried ? 'ja (nach Retry)' : 'ja'}  ·  **clamps:** ${r.clamps}  ·  **viol:** ${r.violations}  ·  **starter:** ${r.starters}  ·  **${r.latencyMs}ms**  ·  **${r.usage?.total_tokens ?? '?'} tok**`, '');
    md.push('> ' + (r.payload.summary || '').replace(/\n/g, ' '), '');
    for (const ex of r.payload.exercises) {
      const sets = ex.sets.map((s) => (s.weight != null ? `${s.reps}×${s.weight}kg` : `${s.reps} Wdh`)).join(', ');
      md.push(`- **${ex.exerciseId}** — ${sets}  (Pause ${ex.restSeconds}s) — _${ex.rationale}_`);
    }
    md.push('', '**Qualität (1–5): ____**', '');
  }
}
writeFileSync(`results/eval-${ts}.md`, md.join('\n'));
console.log(`\n✓ Ergebnisse gespeichert: results/eval-${ts}.json  +  results/eval-${ts}.md`);
console.log('  → Im .md die "Qualität (1–5)" je Szenario manuell bewerten (Coaching-Qualität).');
