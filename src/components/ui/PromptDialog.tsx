import { useState } from 'react';
import { X } from 'lucide-react';

interface PromptDialogProps {
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

// Kleiner Eingabe-Dialog (ein Textfeld), Stil analog ConfirmDialog.
// Genutzt für "Als Vorlage speichern" und "Vorlage umbenennen".
// Wird vom Aufrufer nur bei Bedarf gemountet (kein isOpen) — so startet der
// State bei jedem Öffnen frisch mit initialValue (idiomatisch statt Effekt-Sync).
export function PromptDialog({
  title,
  placeholder,
  initialValue = '',
  confirmLabel = 'Speichern',
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);

  const trimmed = value.trim();
  const submit = () => {
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-zinc-900">{title}</h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={placeholder}
          autoFocus
          className="w-full bg-zinc-50 ring-1 ring-zinc-200 rounded-xl px-3 py-2.5 text-zinc-900 mb-6 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={!trimmed}
            className="px-4 py-2 rounded-xl font-medium bg-primary text-on-primary hover:bg-primary-container transition-colors disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
