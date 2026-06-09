import type { GoalKey } from '../types';

// Anzeige-Metadaten für Trainingsziele (UI). Die Logik-Beschreibungen fürs LLM liegen
// serverseitig in functions/src/lib/prompt.ts (GOAL_DESCRIPTIONS).
export interface GoalMeta {
  key: GoalKey;
  label: string;
  hint: string;
}

export const GOALS: GoalMeta[] = [
  { key: 'progression', label: 'Progression', hint: 'Stärker werden (6–12 Wdh)' },
  { key: 'hypertrophy', label: 'Muskelaufbau', hint: '8–12 Wdh, Volumen' },
  { key: 'strength', label: 'Maximalkraft', hint: '3–6 Wdh, schwer' },
  { key: 'endurance', label: 'Kraftausdauer', hint: '15+ Wdh' },
  { key: 'maintenance', label: 'Halten', hint: 'Wie zuletzt' },
  { key: 'deload', label: 'Deload', hint: 'Bewusst entlasten' },
];

export const GOAL_LABELS: Record<GoalKey, string> = Object.fromEntries(
  GOALS.map((g) => [g.key, g.label]),
) as Record<GoalKey, string>;
