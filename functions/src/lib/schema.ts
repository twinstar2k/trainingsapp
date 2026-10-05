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
      required: ['exercises'],
      properties: {
        exercises: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['exerciseId', 'rationale', 'restSeconds', 'sets'],
            properties: {
              exerciseId: { type: 'string', description: 'MUSS eine der übergebenen exerciseId sein.' },
              rationale: { type: 'string', description: '2–4 Sätze, Deutsch, du-Form: erst die Beobachtung aus dem Verlauf mit konkreten Zahlen, dann die Empfehlung für heute.' },
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
