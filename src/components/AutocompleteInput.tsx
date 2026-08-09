import React, { useEffect, useRef, useState } from 'react';
import { EnvVariable } from '../types';
import { ScopeContext, getEnvAutocompleteSuggestions, resolveEnvVariables } from '../utils/envUtils';
import { VarBadge } from './VarBadge';
import { Variable, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  scopeCtx?: ScopeContext;
  envVariables?: EnvVariable[];
  fileVariables?: Record<string, string>;
  className?: string;
  showResolvedPreview?: boolean;
  isMultiline?: boolean;
  rows?: number;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  id,
  value,
  onChange,
  placeholder = 'Enter text or {{variable}}...',
  scopeCtx,
  envVariables = [],
  fileVariables = {},
  className = '',
  showResolvedPreview = true,
  isMultiline = false,
  rows = 6,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showMaskedValue, setShowMaskedValue] = useState(false);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const ctxToUse: ScopeContext = scopeCtx || {
    projectVariables: envVariables,
    fileVariables,
  };

  const autocomplete = getEnvAutocompleteSuggestions(value, cursorPos, ctxToUse);
  const { resolved, matchedVars, missingVars } = resolveEnvVariables(value, ctxToUse);

  // Extract all distinct variable keys referenced in value
  const extractedVarKeys: string[] = Array.from(
    new Set(Array.from(value.matchAll(/\{\{([a-zA-Z0-9_.-]+)\}\}/g)).map((m) => m[1]))
  );

  // Build native hover tooltip summary
  const inputHoverTooltip =
    matchedVars.length > 0
      ? matchedVars.map((v) => `{{${v.key}}} → ${v.value}`).join('\n')
      : undefined;

  useEffect(() => {
    setSelectedIndex(0);
  }, [autocomplete.query]);

  const insertSuggestion = (suggestionKey: string) => {
    if (autocomplete.startIndex === -1) return;

    const before = value.slice(0, autocomplete.startIndex);
    let after = value.slice(cursorPos);
    if (after.startsWith('}}')) {
      after = after.slice(2);
    } else if (after.startsWith('}')) {
      after = after.slice(1);
    }
    const newValue = `${before}{{${suggestionKey}}}${after}`;

    onChange(newValue);

    // Focus back and set cursor position right after }}
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = before.length + suggestionKey.length + 4; // {{key}}
        inputRef.current.setSelectionRange(newPos, newPos);
        setCursorPos(newPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
      e.preventDefault();
      const pos = inputRef.current?.selectionStart || value.length;
      setCursorPos(pos);
      return;
    }

    if (autocomplete.show) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % autocomplete.suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + autocomplete.suggestions.length) % autocomplete.suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (autocomplete.suggestions[selectedIndex]) {
          insertSuggestion(autocomplete.suggestions[selectedIndex].key);
        }
      } else if (e.key === 'Escape') {
        // Close suggestion
        setCursorPos(0);
      }
    }
  };

  const handleSelectVarButtonClick = () => {
    // Manually trigger {{ at current cursor or end
    const pos = inputRef.current?.selectionStart || value.length;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const newValue = `${before}{{${after}`;
    onChange(newValue);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = pos + 2;
        inputRef.current.setSelectionRange(newPos, newPos);
        setCursorPos(newPos);
      }
    }, 10);
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        {isMultiline ? (
          <textarea
            id={id}
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={rows}
            value={value}
            title={inputHoverTooltip}
            onChange={(e) => {
              onChange(e.target.value);
              setCursorPos(e.target.selectionStart || e.target.value.length);
            }}
            onKeyDown={handleKeyDown}
            onSelect={(e) => {
              setCursorPos((e.target as HTMLTextAreaElement).selectionStart || 0);
            }}
            onFocus={(e) => {
              setIsFocused(true);
              setCursorPos(e.target.selectionStart || value.length);
            }}
            onBlur={() => {
              setTimeout(() => setIsFocused(false), 200);
            }}
            placeholder={placeholder}
            className={`w-full font-mono text-xs p-3 bg-slate-900 border border-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 leading-relaxed transition-all ${className}`}
          />
        ) : (
          <input
            id={id}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            title={inputHoverTooltip}
            onChange={(e) => {
              onChange(e.target.value);
              setCursorPos(e.target.selectionStart || e.target.value.length);
            }}
            onKeyDown={handleKeyDown}
            onSelect={(e) => {
              setCursorPos((e.target as HTMLInputElement).selectionStart || 0);
            }}
            onFocus={(e) => {
              setIsFocused(true);
              setCursorPos(e.target.selectionStart || value.length);
            }}
            onBlur={() => {
              setTimeout(() => setIsFocused(false), 200);
            }}
            placeholder={placeholder}
            className={`w-full font-mono text-sm px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all ${className}`}
          />
        )}

        {/* Action Button: Insert Variable */}
        <button
          type="button"
          onClick={handleSelectVarButtonClick}
          title="Insert Environment Variable {{...}}"
          className="absolute right-2 top-2 p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
        >
          <Variable className="w-4 h-4" />
        </button>
      </div>

      {/* Autocomplete Dropdown Popover */}
      {isFocused && autocomplete.show && (
        <div
          ref={popupRef}
          className="absolute z-[9999] left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-700/50 animate-in fade-in duration-100"
        >
          <div className="px-3 py-1.5 bg-slate-900/80 text-xs font-semibold text-slate-400 flex items-center justify-between">
            <span>Environment Variable Autocomplete</span>
            <span className="text-[10px] text-emerald-400 font-mono">Press Enter / Tab / Ctrl+Space to select</span>
          </div>

          {autocomplete.suggestions.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={item.key + '_' + index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertSuggestion(item.key);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-emerald-600/20 border-l-2 border-emerald-500 text-white' : 'hover:bg-slate-700/50 text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-emerald-400">{`{{${item.key}}}`}</span>
                  {item.description && <span className="text-xs text-slate-400 truncate max-w-[200px]">{item.description}</span>}
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700/50 max-w-[150px] truncate">
                    {item.secret ? '••••••••' : item.value}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-semibold px-1 py-0.5 rounded ${
                      item.source === 'project'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : item.source === 'organization'
                        ? 'bg-purple-500/20 text-purple-300'
                        : item.source === 'folder'
                        ? 'bg-amber-500/20 text-amber-300'
                        : item.source === 'file'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-slate-500/20 text-slate-300'
                    }`}
                  >
                    {item.source}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Interpolation Resolved Preview */}
      {showResolvedPreview && extractedVarKeys.length > 0 && (
        <div className="mt-1.5 px-2.5 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 font-mono text-slate-300">
          <div className="flex items-center space-x-2 truncate max-w-full">
            <span className="text-slate-500 shrink-0 font-sans text-[11px] font-semibold">Resolves:</span>
            <span className="text-emerald-300 truncate font-semibold">
              {matchedVars.some((v) => envVariables.find((e) => e.key === v.key)?.secret) && !showMaskedValue
                ? resolved.replace(/Bearer\s+[^\s]+/g, 'Bearer ••••••••')
                : resolved}
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-[10px] text-slate-500 font-sans font-medium">Hover to inspect:</span>
            {extractedVarKeys.map((varKey) => (
              <VarBadge
                key={varKey}
                varKey={varKey}
                scopeCtx={ctxToUse}
                envVariables={envVariables}
                fileVariables={fileVariables}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
