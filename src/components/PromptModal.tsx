import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Trash2 } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  hideInput?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title,
  message,
  initialValue = '',
  placeholder = '',
  confirmLabel = 'Create',
  hideInput = false,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      if (!hideInput) {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
      }
    }
  }, [isOpen, initialValue, hideInput]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        if (hideInput || value.trim()) {
          e.preventDefault();
          onConfirm(hideInput ? '' : value.trim());
          onCancel();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hideInput, value, onConfirm, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hideInput || value.trim()) {
      onConfirm(hideInput ? '' : value.trim());
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-5 text-slate-100 flex flex-col space-y-4 dark:bg-slate-900 dark:text-slate-100 light:bg-white light:text-slate-800 light:border-slate-300">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-100 dark:text-slate-100 light:text-slate-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {message && (
          <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600">
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!hideInput && (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 dark:bg-slate-950 dark:text-slate-100 light:bg-slate-50 light:text-slate-900 light:border-slate-300"
            />
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors dark:text-slate-300 light:text-slate-700 light:hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hideInput && !value.trim()}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm ${
                /delete|remove|clear/i.test(confirmLabel)
                  ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/20'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
              }`}
            >
              {/delete|remove|clear/i.test(confirmLabel) ? (
                <Trash2 className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{confirmLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
