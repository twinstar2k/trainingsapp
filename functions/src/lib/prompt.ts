// Prompt-Bau für die KI-Trainingsempfehlung (Stufe 1.5, Sandwich-Schicht C).
// Die Progressions-Mathematik macht der deterministische Policy-Kern (shared/policy.ts).
// Das LLM bekommt die BERECHNETEN Sätze und liefert nur die Begründung in Coach-Sprache
// (plus Startsätze für Übungen ohne Verlauf). Spiegel der Logik: eval/lib.mjs.
import type { ExercisePlan, GoalKey, TrainingState } from '../../../shared/ai-types';

export interface ChatMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
}

export const GOAL_DESCRIPTIONS: Record<GoalKey, string> = {
  progression: 'Progressive Overload, Wdh-Bereich 8–12.',
  hypertrophy: 'Muskelaufbau, Wdh-Bereich 8–12, Fokus Volumen.',
  strength: 'Maximalkraft, Wdh-Bereich 4–6, höhere Last.',
  endurance: 'Kraftausdauer, Wdh-Bereich 15–20, geringere Last.',
  maintenance: 'Halten — Gewicht und Wiederholungen etwa wie zuletzt.',
  deload: 'Entlastung — Last bewusst gesenkt.',
};

// Erklärt dem LLM, was die Plan-Codes bedeuten — damit die Begründung fachlich korrekt ist.
const REASON_LEGEND: Record<string, string> = {
  range_filled_reserve: 'oberer Wdh-Bereich mit Reserve erreicht → Last erhöht, Wdh zurück auf unteren Rand',
  range_not_filled: 'oberer Wdh-Bereich noch nicht erreicht → Gewicht halten, eine Wdh mehr anpeilen',
  failure: 'letzte Einheit bis ans Limit (0 Reserve) → Gewicht halten, konsolidieren',
  no_rir: 'keine Anstrengung erfasst → Gewicht halten; ermuntere, künftig den RIR zu loggen, um die Last zu steigern',
  goal_deload: 'Deload → Last bewusst gesenkt',
  goal_maintenance: 'Halten → wie zuletzt',
  reps_only_progress: 'Körpergewicht → eine Wiederholung mehr anpeilen',
  no_history: 'keine Historie → konservativer, vorsichtiger Startwert (du schlägst Gewicht/Wdh vor)',
};

export function buildMessages(state: TrainingState, plans: ExercisePlan[]): ChatMessage[] {
  const goalDesc = GOAL_DESCRIPTIONS[state.goal] ?? state.goal;
  const planById = new Map(plans.map((p) => [p.exerciseId, p]));

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
    '- Antworte für JEDE übergebene Übung. Begründungen kurz, Deutsch, du-Form.',
    '',
    'Antworte AUSSCHLIESSLICH über das Tool submit_recommendation.',
  ].join('\n');

  // Kompakte Übungs-Blöcke: Verlauf + berechneter Plan.
  const blocks = state.exercises.map((ex) => {
    const p = planById.get(ex.exerciseId);
    const legend = p ? REASON_LEGEND[p.reason] ?? p.reason : '';
    return {
      exerciseId: ex.exerciseId,
      name: ex.name,
      type: ex.type,
      muscleGroup: ex.muscleGroup,
      daysSinceLast: ex.daysSinceLast,
      lastRir: ex.lastRir,
      lastSession: ex.lastSession,
      plan: p
        ? { action: p.action, hinweis: legend, sets: p.sets } // sets leer bei "starter" → du füllst
        : null,
    };
  });

  const user = [
    `Trainingsziel: ${state.goal} — ${goalDesc}`,
    `Datum: ${state.date} · Studio: ${state.studioId} · Körpergewicht: ${state.bodyweightKg ?? 'unbekannt'} kg`,
    '',
    'Gib für JEDE Übung eine Begründung (und bei action "starter" auch die Sätze). Der Verlauf ist,',
    'wo nötig, bereits auf das aktuelle Studio gefiltert. RIR: 2 = 2+ Reserve, 1 = 1 Reserve, 0 = Versagen.',
    '',
    'Übungen inkl. berechnetem Plan (JSON):',
    JSON.stringify(blocks, null, 2),
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
