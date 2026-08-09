import React, { useState, useEffect } from 'react';
import { RestFile, RestRequest, EnvVariable } from '../types';
import { parseRestFileContent, generateRestFileContent } from '../utils/restParser';
import { ScopeContext } from '../utils/envUtils';
import { VarBadge, RenderTextWithVars } from './VarBadge';
import { Play, Copy, Check, Variable } from 'lucide-react';

interface RestFileEditorProps {
  file: RestFile;
  envVariables?: EnvVariable[];
  scopeCtx?: ScopeContext;
  onSaveFileContent: (fileId: string, rawContent: string, parsedRequests: RestRequest[]) => void;
  onRunSingleRequest: (req: RestRequest) => void;
}

export const RestFileEditor: React.FC<RestFileEditorProps> = ({
  file,
  envVariables,
  scopeCtx,
  onSaveFileContent,
  onRunSingleRequest,
}) => {
  const [content, setContent] = useState(file.rawContent || generateRestFileContent(file.requests));
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setContent(file.rawContent || generateRestFileContent(file.requests));
  }, [file.id, file.rawContent]);

  const handleContentChange = (newText: string) => {
    setContent(newText);
    try {
      const { requests } = parseRestFileContent(newText, file.name);
      setParseError(null);
      onSaveFileContent(file.id, newText, requests);
    } catch (err: any) {
      setParseError(err.message || 'Syntax warning');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parsed = parseRestFileContent(content, file.name);

  // Extract all variables present in file content or fileVariables
  const fileVars = parsed.fileVariables || {};
  const extractedVarKeys = Array.from(
    new Set([
      ...Object.keys(fileVars),
      ...Array.from(content.matchAll(/\{\{([a-zA-Z0-9_.-]+)\}\}/g)).map((m) => m[1]),
    ])
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <span className="font-mono font-bold text-sm text-slate-100">{file.name}</span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
            {parsed.requests.length} Requests Parsed
          </span>

          {/* Active variables inspector toolbar */}
          {extractedVarKeys.length > 0 && (
            <div className="flex items-center space-x-1.5 bg-slate-950/60 border border-slate-800/80 px-2.5 py-1 rounded-lg">
              <Variable className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-slate-400 font-sans font-medium shrink-0">Hover to inspect vars:</span>
              <div className="flex items-center space-x-1.5 overflow-x-auto max-w-xs">
                {extractedVarKeys.map((vk) => (
                  <VarBadge
                    key={vk}
                    varKey={vk}
                    envVariables={envVariables}
                    fileVariables={fileVars}
                    scopeCtx={scopeCtx}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 font-medium transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied .rest' : 'Copy Text'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Code Textarea + Interactive Request List */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left: Interactive `.rest` Code Textarea */}
        <div className="col-span-8 p-4 border-r border-slate-800 flex flex-col bg-slate-950 overflow-y-auto space-y-3">
          <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Standard REST Client (.rest / .http) Syntax</span>
            <span className="text-emerald-400">@variable = val &nbsp;|&nbsp; ### Request Name</span>
          </div>

          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            rows={16}
            className="w-full flex-1 font-mono text-xs p-4 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500/50 leading-relaxed font-normal"
            placeholder="Enter .rest file syntax..."
          />

          {extractedVarKeys.length > 0 && (
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px] font-sans font-semibold text-slate-400">
                <span>Live Document Preview (Hover over any variable below):</span>
                <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded">
                  {extractedVarKeys.length} Variables Identified
                </span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap break-all overflow-x-auto max-h-48">
                <RenderTextWithVars
                  text={content}
                  envVariables={envVariables}
                  fileVariables={fileVars}
                  scopeCtx={scopeCtx}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Executable Request Cards */}
        <div className="col-span-4 p-4 bg-slate-900/40 overflow-y-auto space-y-3">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Executable Blocks</span>
            <span className="text-[10px] text-emerald-400 font-mono">One-Click Run</span>
          </div>

          {parsed.requests.map((req, idx) => (
            <div
              key={req.id || idx}
              className="p-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-xl space-y-2 transition-all shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-200 truncate max-w-[160px]">
                  {req.name || `Request ${idx + 1}`}
                </span>

                <button
                  type="button"
                  onClick={() => onRunSingleRequest(req)}
                  className="flex items-center space-x-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] px-2.5 py-1 rounded shadow transition-colors"
                >
                  <Play className="w-3 h-3 fill-slate-950" />
                  <span>Run</span>
                </button>
              </div>

              <div className="font-mono text-[11px] text-slate-400 truncate flex items-center space-x-1.5">
                <span className="font-bold text-emerald-400">{req.method}</span>
                <div className="truncate">
                  <RenderTextWithVars
                    text={req.url}
                    envVariables={envVariables}
                    fileVariables={fileVars}
                    scopeCtx={scopeCtx}
                  />
                </div>
              </div>
            </div>
          ))}

          {parsed.requests.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              No request blocks found in this file. Type <code className="text-emerald-400">### Request Name</code> followed by METHOD URL.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
