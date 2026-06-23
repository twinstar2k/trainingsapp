import type { GoalKey } from '../types';

// Anzeige-Metadaten für Trainingsziele (UI). Die Logik-Beschreibungen fürs LLM liegen
// serverseitig in functions/src/lib/prompt.ts (GOAL_DESCRIPTIONS).
export interface GoalMeta {
  key: GoalKey;
  label: string;
  hint: string;
  // false = in der UI ausgegraut/nicht wählbar. Der Coach-Kern (shared/policy.ts) rechnet
  // für diese Ziele bislang nur generisch (nur Wdh-Bereich unterschiedlich) — bis das jeweilige
  // Ziel trainingswissenschaftlich fundiert ist (siehe BACKLOG „KI-Coach & Wissensbasis“),
  // bieten wir es ehrlich als „bald“ an, statt scheinbare Validität vorzutäuschen.
  enabled: boolean;
}

export const GOALS: GoalMeta[] = [
  { key: 'progression', label: 'Progression', hint: 'Stärker werden (6–12 Wdh)', enabled: true },
  { key: 'hypertrophy', label: 'Muskelaufbau', hint: '8–12 Wdh, Volumen', enabled: false },
  { key: 'strength', label: 'Maximalkraft', hint: '3–6 Wdh, schwer', enabled: false },
  { key: 'endurance', label: 'Kraftausdauer', hint: '15+ Wdh', enabled: false },
  { key: 'maintenance', label: 'Halten', hint: 'Wie zuletzt', enabled: false },
  { key: 'deload', label: 'Deload', hint: 'Bewusst entlasten', enabled: false },
];

export const GOAL_LABELS: Record<GoalKey, string> = Object.fromEntries(
  GOALS.map((g) => [g.key, g.label]),
) as Record<GoalKey, string>;
