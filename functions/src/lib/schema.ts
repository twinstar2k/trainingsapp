// Tool-Schema, das die strukturierte LLM-Ausgabe erzwingt (entspricht RecommendationPayload).
// Portiert aus eval/lib.mjs; OpenAI-kompatibles Function-/Tool-Calling.

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
} as const;
