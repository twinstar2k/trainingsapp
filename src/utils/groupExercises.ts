import { Exercise } from '../types';

export interface ExerciseGroup {
  muscleGroup: string;
  exercises: Exercise[];
}

// Gruppiert den (bereits alphabetisch sortierten) Katalog nach Muskelgruppe,
// Gruppen alphabetisch. Geteilt zwischen Exercises-Seite und Übungsauswahl-Modal.
export function groupByMuscleGroup(exercises: Exercise[]): ExerciseGroup[] {
  const map = new Map<string, Exercise[]>();
  for (const ex of exercises) {
    const list = map.get(ex.muscleGroup);
    if (list) {
      list.push(ex);
    } else {
      map.set(ex.muscleGroup, [ex]);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
    .map(([muscleGroup, groupExercises]) => ({ muscleGroup, exercises: groupExercises }));
}
