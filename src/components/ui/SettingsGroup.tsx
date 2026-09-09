interface SettingsGroupProps {
  /** Abschnittslabel über der Karte (z.B. „Training"). */
  label: string;
  children: React.ReactNode;
}

// Eine Gruppe von SettingsRow-Zeilen als Karte mit Trennlinien — dasselbe Listenmuster,
// das Übungskatalog und Trainingsliste verwenden. Zusammen mit SettingsRow kostet eine
// neue Einstellung genau eine Zeile statt eines handgebauten Blocks.
export function SettingsGroup({ label, children }: SettingsGroupProps) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
        {label}
      </h3>
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-sm">
        <ul className="divide-y divide-surface-container">{children}</ul>
      </div>
    </section>
  );
}
