import { SettingsPage } from '../../components/ui/SettingsPage';
import { GoalPicker } from '../../components/ai/GoalPicker';
import { useUserSettings } from '../../hooks/useUserSettings';

export default function CoachPage() {
  const { settings, loaded, updateSettings } = useUserSettings();

  return (
    <SettingsPage title="Dein Coach" subtitle="Standard-Trainingsziel">
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4 shadow-sm">
        <p className="text-sm text-on-surface-variant mb-3">
          Steuert, worauf dein Coach die Empfehlungen ausrichtet. Nur abgesicherte Ziele sind
          wählbar — die übrigen kommen, sobald sie fachlich unterlegt sind.
        </p>
        {loaded ? (
          <GoalPicker
            value={settings.trainingGoal}
            onChange={(g) => void updateSettings({ trainingGoal: g })}
          />
        ) : (
          <div className="text-sm text-on-surface-variant">Lade Einstellung...</div>
        )}
      </div>
    </SettingsPage>
  );
}
