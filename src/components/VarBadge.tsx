import React, { useState, useRef } from 'react';
import { EnvVariable, VariableLookupResult } from '../types';
import { ScopeContext, getVariableLookupDetails } from '../utils/envUtils';
import { Variable, Copy, Check, Eye, EyeOff, Layers } from 'lucide-react';

interface VarBadgeProps {
  varKey: string;
  scopeCtx?: ScopeContext;
  envVariables?: EnvVariable[];
  fileVariables?: Record<string, string>;
  className?: string;
  showBraces?: boolean;
  showResolvedValue?: boolean;
}

const SCOPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  file: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  folder: { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/40' },
  project: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/40' },
  organization: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
  global: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
};

export const VarBadge: React.FC<VarBadgeProps> = ({
  varKey,
  scopeCtx,
  envVariables = [],
  fileVariables = {},
  className = '',
  showBraces = true,
  showResolvedValue = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });

  const badgeRef = useRef<HTMLSpanElement>(null);

  const ctx: ScopeContext = scopeCtx || {
    projectVariables: envVariables,
    fileVariables,
  };

  const lookup: VariableLookupResult | null = getVariableLookupDetails(varKey, ctx);

  const isMatched = !!lookup;
  const isSecret = lookup?.secret;
  const rawValue = lookup?.value;

  const scopeBadgeStyle = lookup
    ? SCOPE_COLORS[lookup.scope] || SCOPE_COLORS.global
    : { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40' };

  const handleMouseEnter = () => {
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      const cardWidth = 288;
      const cardHeight = 200;

      const spaceAbove = rect.top;
      const placeAbove = spaceAbove >= cardHeight;

      const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - cardWidth - 16));

      if (placeAbove) {
        setPopupPos({
          bottom: window.innerHeight - rect.top + 8,
          left,
        });
      } else {
        setPopupPos({
          top: rect.bottom + 8,
          left,
        });
      }
    }
    setIsHovered(true);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rawValue) {
      navigator.clipboard.writeText(rawValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayValue = isSecret && !showSecret ? '••••••••' : rawValue || 'Not defined in scope hierarchy';

  return (
    <span
      ref={badgeRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold cursor-help transition-all border ${
          isMatched
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
            : 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
        } ${className}`}
        title={`Hover to view value & scope hierarchy of {{${varKey}}}`}
      >
        <Variable className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
        <span>
          {showResolvedValue
            ? isMatched
              ? rawValue !== undefined
                ? rawValue
                : '(undefined)'
              : `{{${varKey}}}`
            : showBraces
            ? `{{${varKey}}}`
            : varKey}
        </span>
      </span>

      {/* Floating Hover Tooltip Card */}
      {isHovered && (
        <div
          style={{
            position: 'fixed',
            top: popupPos.top !== undefined ? `${popupPos.top}px` : 'auto',
            bottom: popupPos.bottom !== undefined ? `${popupPos.bottom}px` : 'auto',
            left: `${popupPos.left}px`,
          }}
          className="z-[9999] w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3.5 text-xs font-sans animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center space-x-1.5 font-mono font-bold text-emerald-400">
              <Variable className="w-3.5 h-3.5" />
              <span>{`{{${varKey}}}`}</span>
            </div>

            <div className="flex items-center space-x-1">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono border ${scopeBadgeStyle.bg} ${scopeBadgeStyle.text} ${scopeBadgeStyle.border}`}
              >
                {lookup ? `${lookup.scope}` : 'Missing'}
              </span>
            </div>
          </div>

          {/* Body: Value */}
          <div className="space-y-2">
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Resolved Value:</span>
                <span className="text-[10px] text-slate-500 font-mono font-normal truncate max-w-[130px]">
                  {lookup?.sourceName || 'Undefined'}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs flex items-center justify-between break-all">
                <span className={isSecret && !showSecret ? 'text-slate-500' : 'text-emerald-300'}>
                  {displayValue}
                </span>

                <div className="flex items-center space-x-1 shrink-0 ml-2">
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      title={showSecret ? 'Hide secret' : 'Show secret'}
                      className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 cursor-pointer"
                    >
                      {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  )}

                  {rawValue && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      title="Copy value"
                      className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Hierarchy Scope Overrides list if variable exists in multiple tiers */}
            {lookup?.overrides && lookup.overrides.length > 0 && (
              <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <Layers className="w-3 h-3 text-slate-500" />
                  <span>Scope Hierarchy (Overridden):</span>
                </div>
                <div className="space-y-1 pl-1">
                  {lookup.overrides.map((ov, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-950/60 px-2 py-1 rounded border border-slate-800/50 line-through opacity-75"
                    >
                      <span className="capitalize text-slate-400">{ov.scope} ({ov.sourceName})</span>
                      <span className="truncate max-w-[100px] text-slate-500">{ov.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
};

interface RenderTextWithVarsProps {
  text: string;
  scopeCtx?: ScopeContext;
  envVariables?: EnvVariable[];
  fileVariables?: Record<string, string>;
  className?: string;
  showResolvedValue?: boolean;
}

export const RenderTextWithVars: React.FC<RenderTextWithVarsProps> = ({
  text,
  scopeCtx,
  envVariables = [],
  fileVariables = {},
  className = '',
  showResolvedValue = false,
}) => {
  if (!text) return null;

  const parts = text.split(/(\{\{[a-zA-Z0-9_.-]+\}\})/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const match = part.match(/^\{\{([a-zA-Z0-9_.-]+)\}\}$/);
        if (match) {
          const varKey = match[1];
          return (
            <VarBadge
              key={i}
              varKey={varKey}
              scopeCtx={scopeCtx}
              envVariables={envVariables}
              fileVariables={fileVariables}
              showResolvedValue={showResolvedValue}
            />
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};
