// Prompt-Bau für die KI-Trainingsempfehlung. Portiert aus eval/lib.mjs.
import type { GoalKey, TrainingState } from '../../../shared/ai-types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const GOAL_DESCRIPTIONS: Record<GoalKey, string> = {
  progression: 'Progressive Overload: moderat steigern (6–12 Wdh), wenn die letzte Einheit sauber geschafft wurde.',
  hypertrophy: 'Muskelaufbau: 8–12 Wdh, moderate Last, Fokus auf Volumen.',
  strength: 'Maximalkraft: 3–6 Wdh, höhere Last, konservative Sprünge.',
  endurance: 'Kraftausdauer: 15+ Wdh, geringere Last.',
  maintenance: 'Halten: Gewicht und Wiederholungen etwa wie zuletzt.',
  deload: 'Entlastung: Last bewusst um 10–20 % senken.',
};

export function buildMessages(state: TrainingState): ChatMessage[] {
  const goalDesc = GOAL_DESCRIPTIONS[state.goal] ?? state.goal;

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
