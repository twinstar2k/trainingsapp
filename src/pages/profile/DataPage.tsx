import { useState } from 'react';
import { Download, Database, ChevronRight } from 'lucide-react';
import { SettingsPage } from '../../components/ui/SettingsPage';
import { useAuth } from '../../contexts/AuthContext';
import { exportAllUserData, downloadBackup } from '../../lib/export';
import { seedExercises } from '../../lib/seed';

const actionClass =
  'w-full bg-surface-container-lowest border border-surface-container text-on-surface p-4 rounded-2xl flex items-center justify-center font-medium hover:bg-surface-container-low transition-all duration-150 shadow-sm disabled:opacity-50';

export default function DataPage() {
  const { user, isAdmin } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    setMessage(null);
    try {
      const payload = await exportAllUserData(user.uid);
      downloadBackup(payload);
    } catch (error) {
      console.error('Error exporting data:', error);
      setMessage({ text: 'Export fehlgeschlagen.', error: true });
    } finally {
      setExporting(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      await seedExercises();
      setMessage({ text: 'Übungskatalog erfolgreich initialisiert.', error: false });
    } catch (error) {
      console.error('Error seeding exercises:', error);
      setMessage({ text: 'Katalog konnte nicht initialisiert werden.', error: true });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <SettingsPage title="Daten & Datenschutz" subtitle="Was gespeichert wird — und was nicht">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Deine Daten
        </h3>
        <p className="text-sm text-on-surface-variant">
          Der Export enthält alles, was zu deinem Konto gespeichert ist: Trainings, Sätze,
          Studios, Vorlagen und deine Gewichtshistorie — als JSON-Datei auf dein Gerät.
        </p>
        <button onClick={handleExport} disabled={exporting} className={actionClass}>
          <Download className="w-5 h-5 mr-2 text-outline" />
          {exporting ? 'Exportiere...' : 'Alle Daten exportieren (JSON)'}
        </button>
      </section>

      {/* Transparenz statt Datenfelder: warum es hier kein Alter/Geschlecht gibt. */}
      <details className="group bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm">
        <summary className="p-4 flex items-center justify-between cursor-pointer list-none text-sm font-medium text-on-surface">
          Warum fragen wir nicht nach Alter & Geschlecht?
          <ChevronRight className="w-4 h-4 text-outline shrink-0 transition-transform group-open:rotate-90" />
        </summary>
        <p className="px-4 pb-4 text-sm text-on-surface-variant">
          Dein Coach richtet sich nach deiner echten Trainingshistorie — was du tatsächlich
          leistest und wie sich dein Training entwickelt — statt nach Durchschnittswerten für
          Alter oder Geschlecht. Deshalb erheben wir nur Daten, die dein Training wirklich
          verbessern. Nicht mehr.
        </p>
      </details>

      {isAdmin && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Administration
          </h3>
          <button onClick={handleSeed} disabled={seeding} className={actionClass}>
            <Database className="w-5 h-5 mr-2 text-outline" />
            {seeding ? 'Initialisiere...' : 'Übungskatalog initialisieren'}
          </button>
        </section>
      )}

      {message && (
        <p className={message.error ? 'text-sm text-error' : 'text-sm text-primary'}>
          {message.text}
        </p>
      )}
    </SettingsPage>
  );
}
