// Feature-Flags. Die KI-Empfehlung ist standardmäßig AUS und wird erst aktiv, wenn
// VITE_AI_RECOMMENDATIONS=true gesetzt ist (z.B. in .env.local für Dev, oder im Prod-Build,
// sobald die Cloud Function deployed ist). So kann der Branch inkrementell gemergt werden,
// ohne halbfertige UI sichtbar zu machen.
export const AI_RECOMMENDATIONS_ENABLED = import.meta.env.VITE_AI_RECOMMENDATIONS === 'true';
