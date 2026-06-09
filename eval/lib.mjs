// lib.mjs — Prompt, Tool-Schema, Strukturvalidierung und Guardrails für die Modell-Eval.
//
// Bewusst dependency-frei. Diese Logik ist zugleich ein erster Entwurf dessen,
// was später serverseitig in der Cloud Function laufen wird (Sandwich, §2/§3 im
// Architektur-Doc): Prompt bauen → LLM → deterministisch validieren/klammern.

// ─── Trainingsziele (Spiegel von functions/src/lib/prompt.ts, Policy-first) ──────
export const GOAL_DESCRIPTIONS = {
  progression: 'Progressive Overload, Wdh-Bereich 8–12.',
  hypertrophy: 'Muskelaufbau, Wdh-Bereich 8–12, Fokus Volumen.',
  strength:    'Maximalkraft, Wdh-Bereich 4–6, höhere Last.',
  endurance:   'Kraftausdauer, Wdh-Bereich 15–20, geringere Last.',
  maintenance: 'Halten — Gewicht und Wiederholungen etwa wie zuletzt.',
  deload:      'Entlastung — Last bewusst gesenkt.',
};

// Erklärt dem LLM die Plan-Codes des Policy-Kerns (damit die Begründung fachlich stimmt).
export const REASON_LEGEND = {
  range_filled_reserve: 'oberer Wdh-Bereich mit Reserve erreicht → Last erhöht, Wdh zurück auf unteren Rand',
  range_not_filled: 'oberer Wdh-Bereich noch nicht erreicht → Gewicht halten, eine Wdh mehr anpeilen',
  failure: 'letzte Einheit bis ans Limit (0 Reserve) → Gewicht halten, konsolidieren',
  no_rir: 'keine Anstrengung erfasst → Gewicht halten; ermuntere, künftig den RIR zu loggen, um die Last zu steigern',
  ask_rir: 'oberer Wdh-Bereich 2× in Folge ohne RIR erreicht → fordere den Sportler aktiv auf, die Reserve seines härtesten Satzes zu loggen, damit die Last freigegeben werden kann; Gewicht bleibt gehalten',
  stall_fatigue: 'mehrere Einheiten ohne Fortschritt trotz Training bis ans Limit → Gewicht halten; weise behutsam darauf hin, dass eine leichtere Woche den nächsten Fortschritt ermöglichen kann (nur Hinweis, keine Vorgabe)',
  stall_push: 'mehrere Einheiten flach, aber noch Reserve → ermutige, die Wiederholungen wirklich an den oberen Rand zu bringen; Gewicht bleibt',
  stall_no_rir: 'mehrere Einheiten flach, ohne RIR → bitte den Sportler, den RIR zu loggen, um Ermüdung von zu geringer Anstrengung zu unterscheiden',
  goal_deload: 'Deload → Last bewusst gesenkt',
  goal_maintenance: 'Halten → wie zuletzt',
  reps_only_progress: 'Körpergewicht → eine Wiederholung mehr anpeilen',
  no_history: 'keine Historie → konservativer, vorsichtiger Startwert (du schlägst Gewicht/Wdh vor)',
};

// Kurzer Verlaufs-Hinweis fürs LLM aus dem Trend-Befund (Spiegel von prompt.ts).
function trendHint(t) {
  if (!t || t.direction === 'building') return null;
  if (t.direction === 'up') return `seit ${t.exposures} vergleichbaren Einheiten Fortschritt`;
  if (t.direction === 'down') return 'zuletzt rückläufig';
  return `seit ${t.stalledSessions} Einheiten kein Fortschritt (flach)`;
}

// ─── Progressions-Leitplanken (Sicherheit) ──────────────────────────────────────
export const PROGRESSION_CAP_PCT = 0.10; // max. +10 % …
export const PROGRESSION_CAP_ABS_KG = 5; // … oder +5 kg gegenüber letzter Einheit, je nachdem was kleiner ist
export const MIN_REPS = 1;
export const MAX_REPS = 30;

// ─── Tool-Schema (erzwingt RecommendationPayload) ───────────────────────────────
export const RECOMMENDATION_TOOL = {
  type: 'function',
  function: {
    name: 'submit_recommendation',
    description: 'Gibt die Trainingsempfehlung strukturiert zurück.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'exercises'],
      properties: {
        summary: { type: 'string', description: 'Kurze Gesamt-Begründung (Deutsch).' },
        exercises: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['exerciseId', 'rationale', 'restSeconds', 'sets'],
            properties: {
              exerciseId: { type: 'string', description: 'MUSS eine der übergebenen exerciseId sein.' },
              rationale: { type: 'string', description: 'Kurze Einzel-Begründung (Deutsch).' },
              restSeconds: { type: 'number', description: 'Empfohlene Pause in Sekunden.' },
              sets: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['reps'],
                  properties: {
                    reps: { type: 'number' },
                    weight: { type: 'number', description: 'Nur bei type=weighted; bei reps_only weglassen.' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

// ─── Prompt bauen (Policy-first: LLM erklärt die berechneten Sätze) ──────────────
export function buildMessages(state, plans) {
  const goalDesc = GOAL_DESCRIPTIONS[state.goal] || state.goal;
  const planById = new Map((plans || []).map((p) => [p.exerciseId, p]));

  const system = [
    'Du bist ein erfahrener, ehrlicher Kraft-Coach. Die Trainings-Systematik hat die Sätze für',
    'Übungen MIT Verlauf bereits BERECHNET. Deine Aufgabe ist die Begründung in Coach-Sprache,',
    'nicht das Rechnen.',
    '',
    'REGELN (zwingend):',
    '- Übung mit vorgegebenem Plan (action ≠ "starter"): Übernimm die Sätze EXAKT — Gewicht und',
    '  Wiederholungen NICHT ändern. Schreibe nur eine kurze, motivierende Begründung dazu.',
    '- Übung mit action "starter" (kein Verlauf): Schlage selbst konservative, vorsichtige Startsätze',
    '  vor (weighted: Gewicht > 0 und Wdh > 0; reps_only: nur Wdh).',
    '- Nutze NUR beobachtbare Fakten (Wdh × Gewicht aus dem Verlauf, und den RIR falls angegeben).',
    '  Behaupte NIE Anstrengung/Technik/RPE, die nicht erfasst wurde ("sauber", "leicht", "schwer"',
    '  sind verboten, außer der RIR-Wert ist konkret angegeben).',
    '- reps_only: niemals Gewicht. weighted: immer Gewicht > 0.',
    '- reps_only (Körpergewicht): KEIN fester Wdh-Bereich — Progression läuft rein über mehr',
    '  Wiederholungen. Erwähne NICHT den "8–12"-Bereich; begründe nur mit "eine Wiederholung mehr',
    '  als zuletzt" (ggf. plus Verlauf).',
    '- Antworte für JEDE übergebene Übung. Begründungen kurz, Deutsch, du-Form.',
    '',
    'Antworte AUSSCHLIESSLICH über das Tool submit_recommendation.',
  ].join('\n');

  const blocks = state.exercises.map((ex) => {
    const p = planById.get(ex.exerciseId);
    const legend = p ? (REASON_LEGEND[p.reason] || p.reason) : '';
    const verlauf = p ? trendHint(p.trend) : null;
    return {
      exerciseId: ex.exerciseId,
      name: ex.name,
      type: ex.type,
      muscleGroup: ex.muscleGroup,
      daysSinceLast: ex.daysSinceLast,
      lastRir: ex.lastRir,
      lastSession: ex.lastSession,
      plan: p ? { action: p.action, hinweis: legend, ...(verlauf ? { verlauf } : {}), sets: p.sets } : null,
    };
  });

  const user = [
    `Trainingsziel: ${state.goal} — ${goalDesc}`,
    `Datum: ${state.date} · Studio: ${state.studioId} · Körpergewicht: ${state.bodyweightKg ?? 'unbekannt'} kg`,
    '',
    'Gib für JEDE Übung eine Begründung (und bei action "starter" auch die Sätze). RIR: 2 = 2+ Reserve, 1 = 1 Reserve, 0 = Versagen.',
    '',
    'Übungen inkl. berechnetem Plan (JSON):',
    JSON.stringify(blocks, null, 2),
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// Policy-first-Merge (Spiegel von functions/src/index.ts): Sätze aus dem Plan überschreiben
// die LLM-Werte; bei "starter" bleiben die LLM-Sätze. Begründung kommt vom LLM.
export function applyPolicyOverride(payload, plans) {
  const llmById = new Map(payload.exercises.map((e) => [e.exerciseId, e]));
  return {
    summary: payload.summary,
    exercises: plans.map((plan) => {
      const llmEx = llmById.get(plan.exerciseId);
      const isStarter = plan.action === 'starter';
      return {
        exerciseId: plan.exerciseId,
        rationale: (llmEx?.rationale || '').trim() || `[${plan.action}]`,
        restSeconds: typeof llmEx?.restSeconds === 'number' ? llmEx.restSeconds : 120,
        sets: isStarter ? (llmEx?.sets || []) : plan.sets,
      };
    }),
  };
}

// ─── Payload aus der Antwort extrahieren ────────────────────────────────────────
export function extractPayload(completion) {
  try {
    const msg = completion?.choices?.[0]?.message;
    if (!msg) return { payload: null, error: 'keine message in der Antwort' };

    const call =
      msg.tool_calls?.find?.((c) => c.function?.name === 'submit_recommendation') ||
      msg.tool_calls?.[0];
    if (call?.function?.arguments) {
      return { payload: JSON.parse(call.function.arguments) };
    }

    // Fallback: manche Modelle ignorieren tool_choice und liefern JSON im Text.
    if (typeof msg.content === 'string' && msg.content.trim()) {
      const t = msg.content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
      return { payload: JSON.parse(t), viaContent: true };
    }
    return { payload: null, error: 'keine Tool-Antwort und kein JSON-Text' };
  } catch (e) {
    return { payload: null, error: 'JSON-Parsefehler: ' + (e?.message || e) };
  }
}

// ─── Strukturvalidierung (hartes Gate) ──────────────────────────────────────────
export function validateStructure(p) {
  const errors = [];
  const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
  const isStr = (x) => typeof x === 'string' && x.length > 0;

  if (!p || typeof p !== 'object') return { valid: false, errors: ['payload ist kein Objekt'] };
  if (!isStr(p.summary)) errors.push('summary fehlt/ungültig');
  if (!Array.isArray(p.exercises) || p.exercises.length === 0) {
    errors.push('exercises fehlt/leer');
    return { valid: false, errors };
  }
  p.exercises.forEach((ex, i) => {
    if (!isStr(ex?.exerciseId)) errors.push(`ex[${i}].exerciseId ungültig`);
    if (!isStr(ex?.rationale)) errors.push(`ex[${i}].rationale ungültig`);
    if (!isNum(ex?.restSeconds)) errors.push(`ex[${i}].restSeconds ungültig`);
    if (!Array.isArray(ex?.sets) || ex.sets.length === 0) {
      errors.push(`ex[${i}].sets fehlt/leer`);
    } else {
      ex.sets.forEach((s, j) => {
        if (!isNum(s?.reps)) errors.push(`ex[${i}].sets[${j}].reps ungültig`);
        if (s?.weight != null && !isNum(s.weight)) errors.push(`ex[${i}].sets[${j}].weight ungültig`);
      });
    }
  });
  return { valid: errors.length === 0, errors };
}

// ─── Domänen-Guardrails (zählt, was korrigiert werden müsste) ────────────────────
function maxWeightOf(sets) {
  let m = 0;
  for (const s of sets || []) if (typeof s.weight === 'number' && s.weight > m) m = s.weight;
  return m;
}

export function applyGuardrails(payload, state) {
  const byId = new Map(state.exercises.map((e) => [e.exerciseId, e]));
  const clamps = [];     // Gewicht über Progressions-Cap → müsste geklammert werden
  const violations = []; // harte Regelverstöße (Typ/Plausibilität/erfundene Übung)
  const starters = [];   // Übung ohne Historie → Startwert-Flag (kein Verstoß)

  for (const rec of payload.exercises) {
    const ctx = byId.get(rec.exerciseId);
    if (!ctx) { violations.push(`unknown_exercise:${rec.exerciseId}`); continue; }

    const reps = rec.sets.map((s) => s.reps);
    if (reps.some((r) => r < MIN_REPS || r > MAX_REPS)) violations.push(`reps_out_of_range:${rec.exerciseId}`);

    if (ctx.type === 'reps_only') {
      if (rec.sets.some((s) => s.weight != null)) violations.push(`weight_on_bodyweight:${rec.exerciseId}`);
      if (!ctx.lastSession) starters.push(rec.exerciseId);
      continue;
    }

    if (ctx.type === 'weighted') {
      if (rec.sets.some((s) => !(typeof s.weight === 'number' && s.weight > 0))) {
        violations.push(`weight_missing:${rec.exerciseId}`);
      }
      if (!ctx.lastSession) {
        starters.push(rec.exerciseId);
      } else {
        const lastMax = maxWeightOf(ctx.lastSession.sets);
        const recMax = maxWeightOf(rec.sets);
        const cap = lastMax + Math.min(lastMax * PROGRESSION_CAP_PCT, PROGRESSION_CAP_ABS_KG);
        if (lastMax > 0 && recMax > cap + 1e-6) {
          clamps.push({ exerciseId: rec.exerciseId, recMaxWeight: recMax, capWeight: Math.round(cap * 10) / 10, lastMaxWeight: lastMax });
        }
      }
    }
  }
  return { clamps, violations, starters };
}
