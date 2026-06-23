import { useCallback, useEffect, useState } from 'react';
import { X, Sparkles, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import type { GoalKey, RecommendationPayload } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { GOAL_LABELS } from '../../lib/goals';
import { useRecommendation } from '../../hooks/useRecommendation';
import { RecommendationPreview, type PreviewExerciseInfo } from './RecommendationPreview';

interface RecommendationDialogProps {
  studioId: string;
  date: string;
  exercises: PreviewExerciseInfo[]; // aktuelle Übungen des Trainings
  onApply: (payload: RecommendationPayload) => Promise<void> | void;
  onClose: () => void;
}

export function RecommendationDialog({ studioId, date, exercises, onApply, onClose }: RecommendationDialogProps) {
  const { user } = useAuth();
  const { getRecommendation, loading, error } = useRecommendation();
  const [goal, setGoal] = useState<GoalKey>('progression');
  const [payload, setPayload] = useState<RecommendationPayload | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  // Empfehlung für ein Ziel holen. Das Ziel kommt aus dem Profil — kein UI-Schritt mehr.
  const runFetch = useCallback(
    async (g: GoalKey) => {
      if (exercises.length === 0) return;
      try {
        const res = await getRecommendation({
          studioId,
          date,
          goal: g,
          exerciseIds: exercises.map((e) => e.exerciseId),
        });
        setPayload(res.payload);
        setFlags(res.flags);
      } catch {
        /* Fehler wird über `error` angezeigt; manueller Weg bleibt möglich */
      }
    },
    [getRecommendation, studioId, date, exercises],
  );

  // Beim Öffnen: Standard-Ziel aus dem Profil laden und sofort Empfehlung holen.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let g: GoalKey = 'progression';
      if (user && db) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          const profileGoal = snap.data()?.trainingGoal as GoalKey | undefined;
          if (profileGoal) g = profileGoal;
        } catch {
          /* Default 'progression' bleibt */
        }
      }
      if (cancelled) return;
      setGoal(g);
      await runFetch(g);
    })();
    return () => {
      cancelled = true;
    };
    // Nur beim Öffnen ausführen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = async () => {
    if (!payload) return;
    setApplying(true);
    try {
      await onApply(payload);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const hasResult = payload !== null;

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      <div className="p-4 border-b border-surface-container flex items-center justify-between bg-surface-container-lowest sticky top-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="font-headline font-bold text-on-surface leading-tight">Dein Coach</h3>
            <p className="text-xs text-on-surface-variant truncate">Ziel: {GOAL_LABELS[goal]}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center hover:bg-surface-container-highest transition-all duration-150 active:scale-90 shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading && !hasResult && (
          <div className="flex flex-col items-center justify-center text-center py-16 text-on-surface-variant">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium">Dein Coach schaut sich deinen Verlauf an…</p>
            <p className="text-xs mt-1">Abgeglichen mit deinem Ziel „{GOAL_LABELS[goal]}".</p>
          </div>
        )}

        {error && !hasResult && (
          <div className="flex gap-2 p-3 rounded-2xl bg-error-container text-error text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error} Du kannst dein Training ganz normal manuell weiterführen.</span>
          </div>
        )}

        {hasResult && payload && (
          <RecommendationPreview
            payload={payload}
            exerciseInfo={exercises}
            flags={flags}
            onChange={setPayload}
          />
        )}
      </div>

      {!loading && (
        <div className="p-4 border-t border-surface-container bg-surface-container-lowest sticky bottom-0 flex gap-3">
          {error && !hasResult ? (
            <button
              onClick={() => runFetch(goal)}
              className="w-full h-14 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all duration-150 active:scale-[0.97] flex items-center justify-center"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Erneut versuchen
            </button>
          ) : hasResult && payload ? (
            <button
              onClick={handleApply}
              disabled={applying || payload.exercises.every((e) => e.sets.length === 0)}
              className="w-full h-14 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all duration-150 active:scale-[0.97] flex items-center justify-center disabled:opacity-70"
            >
              {applying ? 'Übernehme…' : 'Übernehmen'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
