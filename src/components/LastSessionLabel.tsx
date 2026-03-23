import { ExerciseType } from '../types';
import { useLastSession } from '../hooks/useLastSession';

interface Props {
  exerciseId: string;
  exerciseType: ExerciseType;
  contextDependent: boolean;
  currentStudioId: string;
}

export function LastSessionLabel({ exerciseId, exerciseType, contextDependent, currentStudioId }: Props) {
  const { label, loading } = useLastSession(exerciseId, exerciseType, contextDependent, currentStudioId);

  if (loading || !label) return null;

  return (
    <span className="text-xs text-outline mt-0.5 block">
      Zuletzt: {label}
    </span>
  );
}
