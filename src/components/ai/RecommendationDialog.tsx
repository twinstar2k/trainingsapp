import { useEffect, useState } from 'react';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import type { GoalKey, RecommendationPayload } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { useRecommendation } from '../../hooks/useRecommendation';
import { GoalPicker } from './GoalPicker';
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

  // Standard-Ziel aus dem Profil vorbelegen.
  useEffect(() => {
    if (!user || !db) return;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const g = snap.data()?.trainingGoal as GoalKey | undefined;
        if (g) setGoal(g);
      } catch {
        /* Default 'progression' bleibt */
      }
    })();
  }, [user]);

  const handleFetch = async () => {
    try {
      const res = await getRecommendation({
        studioId,
        date,
        goal,
        exerciseIds: exercises.map((e) => e.exerciseId),
      });
      setPayload(res.payload);
      setFlags(res.flags);
    } catch {
      /* Fehler wird über `error` angezeigt; manueller Weg bleibt möglich */
    }
  };

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
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-headline font-bold text-on-surface">KI-Empfehlung</h3>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center hover:bg-surface-container-highest transition-all duration-150 active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {!hasResult && (
          <>
            <div>
              <p className="text-sm text-on-surface-variant mb-3">
                Für welches Ziel sollen Sätze, Wiederholungen und Gewichte deiner {exercises.length}{' '}
                {exercises.length === 1 ? 'Übung' : 'Übungen'} vorgeschlagen werden?
              </p>
              <GoalPicker value={goal} onChange={setGoal} />
            </div>

            {error && (
              <div className="flex gap-2 p-3 rounded-2xl bg-error-container text-error text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error} Du kannst dein Training ganz normal manuell weiterführen.</span>
              </div>
            )}
          </>
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

      <div className="p-4 border-t border-surface-container bg-surface-container-lowest sticky bottom-0 flex gap-3">
        {!hasResult ? (
          <button
            onClick={handleFetch}
            disabled={loading || exercises.length === 0}
            className="w-full h-14 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all duration-150 active:scale-[0.97] flex items-center justify-center disabled:opacity-70"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {loading ? 'Empfehlung wird erstellt…' : 'Empfehlung holen'}
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                setPayload(null);
                setFlags([]);
              }}
              className="px-5 h-14 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              Neu
            </button>
            <button
              onClick={handleApply}
              disabled={applying || payload.exercises.every((e) => e.sets.length === 0)}
              className="flex-1 h-14 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all duration-150 active:scale-[0.97] flex items-center justify-center disabled:opacity-70"
            >
              {applying ? 'Übernehme…' : 'Übernehmen'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
