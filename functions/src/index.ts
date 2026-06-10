// Callable Cloud Function: getTrainingRecommendation
// Sandwich: (A) Kontext serverseitig bauen → (B) LLM via Requesty EU → (C) deterministisch
// validieren/klammern → persistieren → zurückgeben. Siehe docs/architecture/ai-recommendation.md.
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import type { GoalKey, Recommendation, RecommendationPayload, RirLevel } from '../../shared/ai-types';
import { buildTrainingState, type ExerciseInput, type PastSession } from './lib/context';
import { applyGuardrails, clampPayload } from './lib/guardrails';
import { computeExercisePlan, describePlan } from '../../shared/policy';
import { getRecommendationFromLlm } from './llm/provider';

admin.initializeApp();
const db = admin.firestore();
// `undefined`-Werte beim Schreiben ignorieren statt zu werfen — sonst lässt z.B. ein Bodyweight-Satz
// ohne `weight` im persistierten inputDigest die ganze Empfehlung mit "INTERNAL" scheitern.
db.settings({ ignoreUndefinedProperties: true });

const REQUESTY_API_KEY = defineSecret('REQUESTY_API_KEY');
const BASE_URL = 'https://router.eu.requesty.ai/v1';
const DEFAULT_MODEL = 'bedrock/claude-haiku-4-5@eu-central-1';

// Server-Allowlist: nur EU-Modelle (zweite Schicht zur Requesty-Access-List, §6).
const EU_MODEL_ALLOWLIST = new Set<string>([
  'bedrock/claude-haiku-4-5@eu-central-1',
  'bedrock/minimax-m2.5@eu-central-1',
  'bedrock/claude-opus-4-8@eu-central-1',
]);

const VALID_GOALS: ReadonlyArray<GoalKey> = [
  'progression', 'hypertrophy', 'strength', 'endurance', 'maintenance', 'deload',
];

interface RequestData {
  studioId: string;
  date: string; // YYYY-MM-DD
  goal: GoalKey;
  exerciseIds: string[];
  model?: string;
}

const MAX_EXERCISES = 12;

// Coaching-Reason-Codes der Trend-/Plateau-Schicht — fürs Audit als Flag mitschreiben.
const COACH_REASONS = new Set(['ask_rir', 'stall_fatigue', 'stall_push', 'stall_no_rir']);

export const getTrainingRecommendation = onCall(
  { region: 'europe-west3', secrets: [REQUESTY_API_KEY] },
  async (request: CallableRequest<Partial<RequestData>>) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');

    // Eingeloggt ≠ freigeschaltet: Allowlist-Check (Doc-ID = E-Mail lowercase) schützt
    // insbesondere das LLM-Budget vor fremden Google-Konten. Spiegelt firestore.rules.
    const email = request.auth?.token.email;
    const allowed = typeof email === 'string'
      && (await db.doc(`allowlist/${email.toLowerCase()}`).get()).exists;
    if (!allowed) {
      throw new HttpsError('permission-denied', 'Dieses Konto ist nicht für die App freigeschaltet.');
    }

    const data = request.data ?? {};
    if (typeof data.studioId !== 'string' || !data.studioId) {
      throw new HttpsError('invalid-argument', 'studioId fehlt.');
    }
    if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new HttpsError('invalid-argument', 'date ungültig (YYYY-MM-DD erwartet).');
    }
    if (!VALID_GOALS.includes(data.goal as GoalKey)) {
      throw new HttpsError('invalid-argument', 'goal ungültig.');
    }
    if (!Array.isArray(data.exerciseIds) || data.exerciseIds.length === 0) {
      throw new HttpsError('invalid-argument', 'exerciseIds fehlen.');
    }
    if (data.exerciseIds.length > MAX_EXERCISES) {
      throw new HttpsError('invalid-argument', `Maximal ${MAX_EXERCISES} Übungen pro Empfehlung.`);
    }
    const goal = data.goal as GoalKey;
    const exerciseIds = [...new Set(data.exerciseIds.filter((x) => typeof x === 'string'))];
    const model = data.model && EU_MODEL_ALLOWLIST.has(data.model) ? data.model : DEFAULT_MODEL;

    // studioId muss dem User gehören.
    const studioSnap = await db.doc(`users/${uid}/studios/${data.studioId}`).get();
    if (!studioSnap.exists) throw new HttpsError('invalid-argument', 'Unbekanntes Studio.');

    // Übungs-Stammdaten (globaler Katalog) + Historie je Übung laden.
    const exerciseInputs: ExerciseInput[] = [];
    for (const exId of exerciseIds) {
      const exDoc = await db.doc(`exercises/${exId}`).get();
      if (!exDoc.exists) continue; // erfundene/unbekannte Übungen ignorieren
      const ex = exDoc.data() as { name: string; type: ExerciseInput['type']; muscleGroup: string; contextDependent: boolean; repsProgression?: boolean };
      const sessions = await fetchSessions(uid, exId, ex.contextDependent ? data.studioId : null);
      exerciseInputs.push({
        exerciseId: exId,
        name: ex.name,
        type: ex.type,
        muscleGroup: ex.muscleGroup,
        contextDependent: ex.contextDependent,
        repsProgression: ex.repsProgression ?? false,
        sessions,
      });
    }
    if (exerciseInputs.length === 0) {
      throw new HttpsError('invalid-argument', 'Keine gültigen Übungen gefunden.');
    }

    // Aktuelles Körpergewicht (letzter Eintrag).
    const bwSnap = await db.collection(`users/${uid}/weightHistory`).orderBy('date', 'desc').limit(1).get();
    const bodyweightKg = bwSnap.empty ? null : ((bwSnap.docs[0].data().weight as number) ?? null);

    // (A) Kontext bauen.
    const state = buildTrainingState({
      goal, date: data.date, studioId: data.studioId, bodyweightKg, exercises: exerciseInputs,
    });

    // (B) Policy-Kern: Progression deterministisch berechnen (Code = Systematik).
    const plans = state.exercises.map((e) => computeExercisePlan(e, goal));

    // (C) LLM aufrufen — liefert NUR die Begründung (+ Startsätze für Übungen ohne Verlauf).
    let llm;
    try {
      llm = await getRecommendationFromLlm({
        apiKey: REQUESTY_API_KEY.value(), baseUrl: BASE_URL, model, state, plans,
      });
    } catch (e) {
      throw new HttpsError('failed-precondition', `Empfehlung nicht möglich: ${(e as Error).message}`);
    }

    // (D) Policy-first: Sätze stammen aus dem deterministischen Plan; das LLM liefert nur die
    // Begründung. Bei "starter" (kein Verlauf) übernimmt das LLM die vorgeschlagenen Sätze.
    // Guardrails bleiben als Sicherheitsnetz (Cap, Starter-Flag).
    const llmById = new Map(llm.payload.exercises.map((e) => [e.exerciseId, e]));
    const cleaned: RecommendationPayload = {
      summary: llm.payload.summary,
      exercises: plans.map((plan) => {
        const llmEx = llmById.get(plan.exerciseId);
        const isStarter = plan.action === 'starter';
        return {
          exerciseId: plan.exerciseId,
          rationale: llmEx?.rationale?.trim() || describePlan(plan),
          restSeconds: typeof llmEx?.restSeconds === 'number' ? llmEx.restSeconds : 120,
          sets: isStarter ? (llmEx?.sets ?? []) : plan.sets,
        };
      }),
    };
    const guard = applyGuardrails(cleaned, state);
    const payload = clampPayload(cleaned, guard);
    const flags = [
      ...plans.map((p) => `action:${p.action}:${p.exerciseId}`),
      ...plans.filter((p) => COACH_REASONS.has(p.reason)).map((p) => `reason:${p.reason}:${p.exerciseId}`),
      ...plans
        .filter((p) => p.trend && p.trend.direction !== 'building')
        .map((p) => `trend:${p.trend!.direction}:${p.exerciseId}`),
      ...guard.clamps.map((c) => `clamped:${c.exerciseId}`),
      ...guard.starters.map((s) => `starter:${s}`),
      ...guard.violations.map((v) => `violation:${v}`),
    ];

    // Persistieren (Audit/Eval/Transparenz).
    const recRef = db.collection(`users/${uid}/recommendations`).doc();
    const rec: Omit<Recommendation, 'id'> = {
      createdAt: Date.now(),
      goal, studioId: data.studioId, date: data.date,
      model, inputDigest: state, output: payload, flags, status: 'proposed',
    };
    await recRef.set(rec);

    return { recommendationId: recRef.id, payload, flags, model };
  }
);

/**
 * Zweistufige Query (ADR-01): completed Trainings → exercises(exerciseId) → sets.
 * Bei contextDependent nur das aktuelle Studio. Max. 20 Sessions.
 */
async function fetchSessions(
  uid: string,
  exerciseId: string,
  studioId: string | null,
): Promise<PastSession[]> {
  let q: FirebaseFirestore.Query = db
    .collection(`users/${uid}/trainings`)
    .where('status', '==', 'completed');
  if (studioId) q = q.where('studioId', '==', studioId);
  q = q.orderBy('date', 'desc').limit(20);

  const trainings = await q.get();
  const sessions: PastSession[] = [];
  for (const t of trainings.docs) {
    const tData = t.data() as { date: string; studioId: string };
    const exSnap = await t.ref.collection('exercises').where('exerciseId', '==', exerciseId).limit(1).get();
    if (exSnap.empty) continue;
    const exDoc = exSnap.docs[0];
    const rir = (exDoc.data() as { rir?: RirLevel }).rir;
    const setsSnap = await exDoc.ref.collection('sets').get();
    const sets = setsSnap.docs.map((s) => {
      const d = s.data() as { reps?: number; weight?: number };
      return { reps: d.reps, weight: d.weight };
    });
    if (sets.length) sessions.push({ date: tData.date, studioId: tData.studioId, sets, rir });
  }
  return sessions;
}
