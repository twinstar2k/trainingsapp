import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { GoalKey } from '../types';

/**
 * Einstellungen auf users/{uid}, die keinem eigenen Context gehören.
 *
 * Das Dokument hat bewusst drei Schreiber: `nickname` gehört dem AuthContext,
 * `restTimerMode/restSeconds/restSignal` dem RestTimerContext, alles Übrige diesem Hook.
 * Unkritisch ist das nur, weil alle drei disjunkte Felder anfassen und ausschließlich
 * mit `{ merge: true }` schreiben — ein volles setDoc würde die Felder der anderen löschen.
 *
 * Andockpunkt für künftige Einstellungen (Split, Einheiten, Benachrichtigungen): Feld in
 * UserSettings ergänzen, sonst nichts.
 */
export interface UserSettings {
  trainingGoal: GoalKey;
}

const DEFAULT_SETTINGS: UserSettings = {
  trainingGoal: 'progression',
};

export function useUserSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Ohne Nutzer/Firestore gibt es nichts zu laden — trotzdem `loaded` setzen, damit
    // wartende Aufrufer (z.B. der Empfehlungs-Dialog) nicht ewig hängen.
    if (!user || !db) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        const data = snap.data();
        setSettings({
          trainingGoal: (data?.trainingGoal as GoalKey) ?? DEFAULT_SETTINGS.trainingGoal,
        });
      } catch (error) {
        console.error('Error loading user settings:', error);
        // Voreinstellungen bleiben stehen — die App ist ohne gespeicherte Werte bedienbar.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Optimistisch setzen, dann schreiben. Gibt false zurück, wenn das Schreiben scheiterte. */
  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>): Promise<boolean> => {
      if (!user || !db) return false;
      const previous = settings;
      setSettings((prev) => ({ ...prev, ...patch }));
      try {
        await setDoc(doc(db, 'users', user.uid), patch, { merge: true });
        return true;
      } catch (error) {
        console.error('Error saving user settings:', error);
        setSettings(previous);
        return false;
      }
    },
    [user, settings],
  );

  return { settings, loaded, updateSettings };
}
