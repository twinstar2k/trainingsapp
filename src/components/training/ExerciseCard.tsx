import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RirLevel } from '../../types';
import type { SessionExercise } from '../../hooks/useTrainingSession';
import { LastSessionLabel } from '../LastSessionLabel';
import { AI_RECOMMENDATIONS_ENABLED } from '../../lib/featureFlags';
import { SetRow, type NumericSetField } from './SetRow';

// Reserve (RIR) am Satzende — Signal für die KI-Autoregulation. 2 = 2+ in Reserve … 0 = Versagen.
const RIR_OPTIONS: { value: RirLevel; label: string }[] = [
  { value: 2, label: '2+ Wdh' },
  { value: 1, label: '1 Wdh' },
  { value: 0, label: 'Versagen' },
];

interface ExerciseCardProps {
  exercise: SessionExercise;
  isActive: boolean;
  studioId: string;
  onDelete: () => void;
  onAddSet: () => void;
  onUpdateSet: (setId: string, field: NumericSetField, value: number) => void;
  onToggleSetStatus: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onSetRir: (rir: RirLevel) => void;
  onRecommend: () => void;
}

// Karte einer Übung im Training: Kopf (Name, Zuletzt-Label, Badges), Sätze, Satz/KI-Buttons, RIR.
export function ExerciseCard({
  exercise,
  isActive,
  studioId,
  onDelete,
  onAddSet,
  onUpdateSet,
  onToggleSetStatus,
  onDeleteSet,
  onSetRir,
  onRecommend,
}: ExerciseCardProps) {
  const navigate = useNavigate();
  const { details, sets } = exercise;

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm overflow-hidden">
      <div className="p-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low">
        <div>
          <button
            onClick={() => navigate(`/exercises/${details.id}`)}
            className="font-bold text-on-surface hover:text-primary transition-colors text-left"
          >
            {details.name}
          </button>
          {isActive && (
            <LastSessionLabel
              exerciseId={details.id}
              exerciseType={details.type}
              contextDependent={details.contextDependent}
              currentStudioId={studioId}
            />
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-md">
              {details.muscleGroup}
            </span>
            {details.contextDependent && (
              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100 text-[10px] font-bold uppercase tracking-wider">
                Studio-gebunden
              </span>
            )}
          </div>
        </div>
        {isActive && (
          <button
            onClick={onDelete}
            className="text-outline hover:text-error p-2 -mr-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Sets Header */}
        {sets.length > 0 && (
          <div className="flex text-xs font-semibold text-outline uppercase tracking-wider px-2">
            <div className="w-8 text-center">Set</div>
            {details.type === 'weighted' && (
              <>
                <div className="flex-1 text-center">kg</div>
                <div className="flex-1 text-center">Reps</div>
              </>
            )}
            {details.type === 'reps_only' && <div className="flex-1 text-center">Reps</div>}
            {details.type === 'cardio_basic' && (
              <>
                <div className="flex-1 text-center">Min</div>
                <div className="flex-1 text-center">km</div>
              </>
            )}
            <div className="w-10" />
          </div>
        )}

        {/* Sets */}
        {sets.map((set, setIndex) => (
          <SetRow
            key={set.id}
            set={set}
            index={setIndex}
            type={details.type}
            isActive={isActive}
            onUpdate={(field, value) => onUpdateSet(set.id, field, value)}
            onToggleStatus={() => onToggleSetStatus(set.id)}
            onDelete={() => onDeleteSet(set.id)}
          />
        ))}

        {isActive && (
          <button
            onClick={onAddSet}
            className="w-full py-2.5 border-2 border-dashed border-surface-container rounded-xl text-on-surface-variant font-medium text-sm flex items-center justify-center hover:border-primary/20 hover:text-primary transition-all duration-150 mt-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Satz hinzufügen
          </button>
        )}

        {/* KI-Empfehlung pro Übung (Feature-Flag) — nur solange die Übung noch leer ist. */}
        {isActive && AI_RECOMMENDATIONS_ENABLED && sets.length === 0 && (
          <button
            onClick={onRecommend}
            className="w-full py-2.5 mt-2 border border-primary/30 rounded-xl text-primary font-semibold text-sm flex items-center justify-center hover:bg-primary/5 transition-all duration-150"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Coach fragen
          </button>
        )}

        {/* Reserve (RIR) — Signal für die KI-Autoregulation. Optional. */}
        {(details.type === 'weighted' || details.type === 'reps_only') &&
          sets.length > 0 &&
          (isActive || exercise.rir != null) && (
            <div
              className="flex items-center justify-between gap-2 pt-1"
              title="Wie viele Wiederholungen wären in deinem härtesten Satz noch drin gewesen?"
            >
              <span className="text-xs font-semibold text-outline uppercase tracking-wider">Reserve</span>
              <div className="flex gap-1">
                {RIR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onSetRir(opt.value)}
                    disabled={!isActive}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 disabled:cursor-not-allowed',
                      exercise.rir === opt.value
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high disabled:opacity-60',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
