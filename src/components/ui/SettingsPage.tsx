import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface SettingsPageProps {
  title: string;
  /** Kurze Einordnung unter dem Titel — optional, nur wo die Seite Erklärung braucht. */
  subtitle?: string;
  children: React.ReactNode;
}

// Rahmen jeder Einstellungs-Unterseite: Zurück-Header + Inhalt. Zeichnet bewusst KEINE
// Karte — die Inhalte bringen ihre eigene mit (SettingsGroup, RestTimerSettings), sonst
// entstünde eine doppelte Kartenoptik.
export function SettingsPage({ title, subtitle, children }: SettingsPageProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/profile')}
          aria-label="Zurück zum Profil"
          className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-xl font-headline font-extrabold tracking-tight text-on-surface leading-tight truncate">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>

      {children}
    </div>
  );
}
