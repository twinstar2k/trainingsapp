interface Props {
  label: string | null;
}

// Rein präsentational — die Daten liefert useExerciseReference (Aufruf in der ExerciseCard).
export function LastSessionLabel({ label }: Props) {
  if (!label) return null;

  return (
    <span className="text-xs text-outline mt-0.5 block">
      Zuletzt: {label}
    </span>
  );
}
