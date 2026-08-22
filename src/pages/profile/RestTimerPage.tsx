import { SettingsPage } from '../../components/ui/SettingsPage';
import { RestTimerSettings } from '../../components/training/RestTimerSettings';

export default function RestTimerPage() {
  return (
    <SettingsPage title="Pausen-Timer" subtitle="Satzpause, Dauer und Signal">
      <RestTimerSettings />
    </SettingsPage>
  );
}
