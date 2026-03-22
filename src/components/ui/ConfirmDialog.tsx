import React from 'react';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-zinc-900">{title}</h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-zinc-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            Abbrechen
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="px-4 py-2 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}
