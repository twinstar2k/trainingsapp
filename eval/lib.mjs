// lib.mjs — Prompt, Tool-Schema, Strukturvalidierung und Guardrails für die Modell-Eval.
//
// Bewusst dependency-frei. Diese Logik ist zugleich ein erster Entwurf dessen,
// was später serverseitig in der Cloud Function laufen wird (Sandwich, §2/§3 im
// Architektur-Doc): Prompt bauen → LLM → deterministisch validieren/klammern.

// ─── Trainingsziele ────────────────────────────────────────────────────────────
export const GOAL_DESCRIPTIONS = {
  progression: 'Progressive Overload: moderat steigern (6–12 Wdh), wenn die letzte Einheit sauber geschafft wurde.',
  hypertrophy: 'Muskelaufbau: 8–12 Wdh, moderate Last, Fokus auf Volumen.',
  strength:    'Maximalkraft: 3–6 Wdh, höhere Last, konservative Sprünge.',
  endurance:   'Kraftausdauer: 15+ Wdh, geringere Last.',
  maintenance: 'Halten: Gewicht und Wiederholungen etwa wie zuletzt.',
  deload:      'Entlastung: Last bewusst um 10–20 % senken.',
};

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

// ─── Prompt bauen ───────────────────────────────────────────────────────────────
export function buildMessages(state) {
  const goalDesc = GOAL_DESCRIPTIONS[state.goal] || state.goal;

  const system = [
    'Du bist ein erfahrener Kraft- und Fitnesstrainer. Du erstellst für EINE Trainingseinheit',
    'konkrete Satz-Empfehlungen für eine fest vorgegebene Liste von Übungen.',
    '',
    'REGELN (zwingend):',
    '- Empfiehl NUR für die übergebenen Übungen (exerciseId). Erfinde KEINE neuen Übungen.',
    '- Richte Wiederholungs-Bereiche und Progression am Trainingsziel aus.',
    '- Steigere konservativ: höchstens ~10 % ODER +5 kg gegenüber der letzten Einheit (je nachdem, was kleiner ist).',
    '- Bei Ziel "deload" die Last bewusst um 10–20 % senken.',
    '- context_dependent-Übungen: die Historie ist bereits auf das aktuelle Studio gefiltert — vergleiche nie über Studios hinweg.',
    '- Typ "reps_only" (Körpergewicht): KEIN Gewicht angeben, nur Wiederholungen.',
    '- Typ "weighted": immer Gewicht > 0 und Wiederholungen > 0.',
    '- Übung ohne Historie: konservativer, vorsichtiger Startwert.',
    '- Begründungen kurz und auf Deutsch.',
    '',
    'Antworte AUSSCHLIESSLICH über das Tool submit_recommendation.',
  ].join('\n');

  const user = [
    `Trainingsziel: ${state.goal} — ${goalDesc}`,
    `Datum: ${state.date}`,
    `Studio: ${state.studioId}`,
    `Körpergewicht: ${state.bodyweightKg ?? 'unbekannt'} kg`,
    '',
    'Gib für JEDE der folgenden Übungen eine Satz-Empfehlung.',
    'Die Historie ist – wo nötig – bereits auf das aktuelle Studio gefiltert.',
    '',
    'Übungen inkl. Trainingszustand (JSON):',
    JSON.stringify(state.exercises, null, 2),
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
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
