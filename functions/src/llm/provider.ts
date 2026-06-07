// LLM-Provider (Sandwich-Schicht B): Aufruf des EU-Gateways Requesty (OpenAI-kompatibel)
// via native fetch, strukturierte Ausgabe per Tool-Use, 1 Retry bei Schema-Verstoß.
// Provider hinter dünner Funktion → später austauschbar (ADR-03).
import type { RecommendationPayload, TrainingState } from '../../../shared/ai-types';
import { RECOMMENDATION_TOOL } from '../lib/schema';
import { buildMessages, type ChatMessage } from '../lib/prompt';
import { validateStructure } from '../lib/guardrails';

export interface LlmResult {
  payload: RecommendationPayload;
  model: string;
  usage?: unknown;
}

interface ToolCall {
  function?: { name?: string; arguments?: string };
}
interface Completion {
  choices?: Array<{ message?: { tool_calls?: ToolCall[]; content?: string } }>;
  usage?: unknown;
}

function extractPayload(completion: Completion): RecommendationPayload | null {
  const msg = completion?.choices?.[0]?.message;
  if (!msg) return null;
  const call =
    msg.tool_calls?.find((c) => c.function?.name === 'submit_recommendation') ?? msg.tool_calls?.[0];
  try {
    if (call?.function?.arguments) return JSON.parse(call.function.arguments) as RecommendationPayload;
    if (typeof msg.content === 'string' && msg.content.trim()) {
      const t = msg.content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
      return JSON.parse(t) as RecommendationPayload;
    }
  } catch {
    return null;
  }
  return null;
}

export async function getRecommendationFromLlm(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  state: TrainingState;
}): Promise<LlmResult> {
  let messages: ChatMessage[] = buildMessages(opts.state);
  let lastErr = 'unbekannt';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages,
        tools: [RECOMMENDATION_TOOL],
        tool_choice: { type: 'function', function: { name: 'submit_recommendation' } },
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM-Aufruf fehlgeschlagen: HTTP ${res.status} ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as Completion;
    const payload = extractPayload(json);
    if (payload) {
      const v = validateStructure(payload);
      if (v.valid) return { payload, model: opts.model, usage: json.usage };
      lastErr = v.errors.join('; ');
    } else {
      lastErr = 'keine valide Tool-Antwort';
    }

    messages = [
      ...messages,
      {
        role: 'user',
        content: `Deine letzte Antwort war ungültig (${lastErr}). Antworte erneut AUSSCHLIESSLICH über das Tool submit_recommendation mit gültigem Schema.`,
      },
    ];
  }

  throw new Error(`Keine valide Empfehlung nach Retry: ${lastErr}`);
}
