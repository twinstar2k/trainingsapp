import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Pencil, Timer, Target, ClipboardList, Building2, ShieldCheck } from 'lucide-react';
import { SettingsGroup } from '../components/ui/SettingsGroup';
import { SettingsRow } from '../components/ui/SettingsRow';
import { PromptDialog } from '../components/ui/PromptDialog';
import { useStudios } from '../hooks/useStudios';
import { useTemplates } from '../hooks/useTemplates';
import { useUserSettings } from '../hooks/useUserSettings';
import { useRestTimer } from '../contexts/RestTimerContext';
import { formatRestTime } from '../utils/restTimer';
import { GOAL_LABELS } from '../lib/goals';
import { AI_RECOMMENDATIONS_ENABLED } from '../lib/featureFlags';

const REST_MODE_LABELS = { auto: 'automatisch', manual: 'nur manuell', off: 'aus' } as const;

// Einstiegsseite für alles Persönliche: Profilkarte oben, darunter die Einstellungen als
// kurze Gruppen. Jede Zeile führt auf eine eigene Seite und zeigt hier schon ihren
// aktuellen Wert — die häufigste Frage („steht der Timer auf automatisch?") beantwortet
// also bereits der Hub. Damit bleibt diese Seite kurz, egal wie viele Einstellungen
// dazukommen: eine neue ist eine SettingsRow, kein neuer Block.
export default function Profile() {
  const { user, signOut, nickname, firstName, updateNickname } = useAuth();
  const { studios, loading: studiosLoading } = useStudios();
  const { templates, loading: templatesLoading } = useTemplates();
  const { settings: userSettings, loaded: settingsLoaded } = useUserSettings();
  const { settings: restSettings, settingsLoaded: restLoaded } = useRestTimer();

  const [editingNickname, setEditingNickname] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  const handleNicknameConfirm = async (value: string) => {
    setEditingNickname(false);
    setNicknameError(null);
    try {
      await updateNickname(value || null);
    } catch (error) {
      console.error('Error saving nickname:', error);
      setNicknameError('Spitzname konnte nicht gespeichert werden.');
    }
  };

  // Vorschauwerte. Solange geladen wird, bleibt die Zeile ohne Wert statt einen falschen
  // Standardwert zu behaupten — der Hub blockiert nie auf einen Spinner.
  const restValue = restLoaded
    ? restSettings.mode === 'off'
      ? 'aus'
      : `${formatRestTime(restSettings.seconds)}, ${REST_MODE_LABELS[restSettings.mode]}`
    : undefined;
  const goalValue = settingsLoaded ? GOAL_LABELS[userSettings.trainingGoal] : undefined;
  const templatesValue = templatesLoading
    ? undefined
    : `${templates.length} ${templates.length === 1 ? 'Vorlage' : 'Vorlagen'}`;
  const studiosValue = studiosLoading
    ? undefined
    : `${studios.length} ${studios.length === 1 ? 'Studio' : 'Studios'}`;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">Profil</h2>

      {/* Wer bin ich: Google-Foto + Name (bzw. Spitzname), E-Mail — bewusst ohne weitere
          Profilfelder, siehe Transparenz-Block unter „Daten & Datenschutz". */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm p-4 flex items-center gap-4">
        {user?.photoURL && !photoError ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setPhotoError(true)}
            className="w-14 h-14 rounded-full object-cover ring-1 ring-outline-variant/30 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary-container text-primary flex items-center justify-center text-xl font-bold shrink-0">
            {firstName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-on-surface truncate">
              {nickname ?? user?.displayName ?? 'Athlet'}
            </span>
            <button
              onClick={() => setEditingNickname(true)}
              className="text-outline hover:text-primary p-1.5 -my-1.5 transition-colors shrink-0"
              aria-label="Spitznamen bearbeiten"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <p className="text-on-surface-variant text-sm truncate">{user?.email}</p>
        </div>
      </div>

      {nicknameError && <p className="text-sm text-error">{nicknameError}</p>}

      <SettingsGroup label="Training">
        <SettingsRow
          icon={Timer}
          title="Pausen-Timer"
          value={restValue}
          to="/profile/rest-timer"
        />
        {AI_RECOMMENDATIONS_ENABLED && (
          <SettingsRow icon={Target} title="Dein Coach" value={goalValue} to="/profile/coach" />
        )}
        <SettingsRow
          icon={ClipboardList}
          title="Vorlagen"
          value={templatesValue}
          to="/templates"
        />
      </SettingsGroup>

      <SettingsGroup label="Stammdaten">
        <SettingsRow icon={Building2} title="Studios" value={studiosValue} to="/profile/studios" />
      </SettingsGroup>

      <SettingsGroup label="Konto">
        <SettingsRow icon={ShieldCheck} title="Daten & Datenschutz" to="/profile/data" />
      </SettingsGroup>

      <button
        onClick={signOut}
        className="w-full bg-error-container text-error p-4 rounded-2xl flex items-center justify-center font-medium hover:bg-red-100 transition-all duration-150"
      >
        <LogOut className="w-5 h-5 mr-2" />
        Abmelden
      </button>

      {editingNickname && (
        <PromptDialog
          title="Spitzname"
          placeholder="Leer lassen für deinen Google-Namen"
          initialValue={nickname ?? ''}
          allowEmpty
          onConfirm={handleNicknameConfirm}
          onCancel={() => setEditingNickname(false)}
        />
      )}
    </div>
  );
}
