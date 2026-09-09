import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SettingsRowProps {
  icon: LucideIcon;
  title: string;
  /** Zweite Zeile: erklärt, wozu die Einstellung gut ist. */
  hint?: string;
  /** Aktueller Wert, rechts vor dem Chevron. Leer lassen, wenn es keinen gibt. */
  value?: string;
  /** Ziel-Route — macht die Zeile zum Link. Alternativ onClick für Aktionen. */
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}

// Eine Zeile in einer SettingsGroup: Icon, Titel (+ Hinweis), aktueller Wert, Chevron.
// Navigiert (to) oder löst eine Aktion aus (onClick) — der Chevron erscheint nur beim Link,
// weil er ein Weiter-Versprechen ist.
export function SettingsRow({ icon: Icon, title, hint, value, to, onClick, disabled }: SettingsRowProps) {
  const inner = (
    <>
      <Icon className="w-5 h-5 mr-3 text-outline shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-on-surface">{title}</div>
        {hint && <div className="text-xs text-on-surface-variant mt-0.5">{hint}</div>}
      </div>
      {value && (
        <span className="text-sm text-on-surface-variant ml-3 shrink-0 truncate max-w-[45%]">
          {value}
        </span>
      )}
      {to && <ChevronRight className="w-5 h-5 text-outline shrink-0 ml-1" />}
    </>
  );

  const className = cn(
    'w-full p-4 flex items-center text-left transition-colors',
    disabled ? 'opacity-50' : 'hover:bg-surface-container-low active:bg-surface-container',
  );

  return (
    <li>
      {to && !disabled ? (
        <Link to={to} className={className}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} className={className}>
          {inner}
        </button>
      )}
    </li>
  );
}
