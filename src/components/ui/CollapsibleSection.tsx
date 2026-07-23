import { ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// Kontrollierte Sektion für gruppierte Listen (Trainings nach Monat, Übungen nach
// Muskelgruppe). Kein interner State — die Seiten halten die offenen Keys, weil
// Auto-Öffnen (Suche, neuester Monat) von außen kommen muss.
export function CollapsibleSection({ title, count, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-1 py-2 text-left"
      >
        <span className="font-headline font-bold text-on-surface">{title}</span>
        <span className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-md">
            {count}
          </span>
          <ChevronRight
            className={`w-4 h-4 text-outline shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </span>
      </button>
      {open && <div className="space-y-3 mt-1 mb-2">{children}</div>}
    </section>
  );
}
