import React, { useState } from 'react';
import { HTTPMethod, Project, RestFile, RestRequest } from '../types';
import { X, Plus, Code2, Globe, FileCode, Sparkles, CornerDownLeft, Eye, Zap, CheckCircle2 } from 'lucide-react';
import { resolveEnvVariables, ScopeContext } from '../utils/envUtils';
import { detectAndParsePaste } from '../utils/restParser';

interface QuickNewRequestModalProps {
  isOpen: boolean;
  project: Project;
  activeFileId: string | null;
  isDarkMode?: boolean;
  onClose: () => void;
  onCreateRequest: (fileId: string, method: HTTPMethod, name: string, url?: string, extraRequestProps?: Partial<RestRequest>) => void;
  onCreateNewFileAndRequest: (fileName: string, method: HTTPMethod, name: string, url?: string, extraRequestProps?: Partial<RestRequest>) => void;
}

const HTTP_METHODS: { method: HTTPMethod; color: string; desc: string }[] = [
  { method: 'GET', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', desc: 'Retrieve data' },
  { method: 'POST', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30', desc: 'Send new payload' },
  { method: 'PUT', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', desc: 'Replace resource' },
  { method: 'DELETE', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', desc: 'Remove resource' },
  { method: 'PATCH', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', desc: 'Partial update' },
  { method: 'QUERY', color: 'text-teal-400 bg-teal-500/10 border-teal-500/30', desc: 'Complex query' },
  { method: 'HEAD', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30', desc: 'Fetch headers only' },
  { method: 'OPTIONS', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30', desc: 'Check options' },
];

export const QuickNewRequestModal: React.FC<QuickNewRequestModalProps> = ({
  isOpen,
  project,
  activeFileId,
  isDarkMode = true,
  onClose,
  onCreateRequest,
  onCreateNewFileAndRequest,
}) => {
  if (!isOpen) return null;
  const files = project?.files || [];
  const defaultTargetFileId = activeFileId || (files.length > 0 ? files[0].id : 'NEW_FILE');

  const [selectedMethod, setSelectedMethod] = useState<HTTPMethod>('GET');
  const [requestName, setRequestName] = useState('');
  const [requestUrl, setRequestUrl] = useState('{{baseUrl}}/users');
  const [targetFileId, setTargetFileId] = useState<string>(defaultTargetFileId);
  const [newFileName, setNewFileName] = useState('api_endpoints.rest');

  const activeEnv = project?.environments?.find((e) => e.id === project?.activeEnvId);
  const targetFile = files.find((f) => f.id === targetFileId);

  const scopeCtx: ScopeContext = {
    projectVariables: activeEnv?.variables,
    projectName: activeEnv?.name || 'Active Environment',
    fileVariables: targetFile?.fileVariables,
    fileName: targetFile?.name,
  };

  const resolution = resolveEnvVariables(requestUrl, scopeCtx);
  const detectedPaste = detectAndParsePaste(requestUrl);
  const [extraProps, setExtraProps] = useState<Partial<RestRequest> | null>(null);

  const handleApplySmartPaste = () => {
    if (!detectedPaste || detectedPaste.requests.length === 0) return;
    const req = detectedPaste.requests[0];
    setSelectedMethod(req.method);
    setRequestUrl(req.url);
    if (!requestName || requestName.trim() === '') {
      setRequestName(req.name);
    }
    setExtraProps({
      headers: req.headers,
      queryParams: req.queryParams,
      body: req.body,
      auth: req.auth,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = requestName.trim() || `${selectedMethod} Endpoint`;
    const finalUrl = requestUrl.trim() || '{{baseUrl}}/endpoint';

    if (targetFileId === 'NEW_FILE') {
      const validFileName = newFileName.endsWith('.rest') ? newFileName : `${newFileName}.rest`;
      onCreateNewFileAndRequest(validFileName, selectedMethod, finalName, finalUrl, extraProps || undefined);
    } else {
      onCreateRequest(targetFileId, selectedMethod, finalName, finalUrl, extraProps || undefined);
    }
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 ${
        isDarkMode ? 'bg-slate-950/80 backdrop-blur-sm' : 'bg-slate-900/40 backdrop-blur-sm'
      }`}
      onClick={onClose}
    >
      <div
        className={`border rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/90'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Quick New Request</h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Create and open a new HTTP endpoint immediately
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Method Selection Grid */}
          <div>
            <label className={`text-xs font-bold block mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              HTTP Method
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {HTTP_METHODS.map(({ method, color }) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setSelectedMethod(method)}
                  className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all border text-center cursor-pointer ${
                    selectedMethod === method
                      ? `${color} ring-2 ring-emerald-500/50 shadow-sm scale-105`
                      : isDarkMode
                      ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Request Name */}
          <div>
            <label className={`text-xs font-bold block mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Request Name
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="e.g. Get User Profile, Login, Create Order"
                className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Endpoint URL */}
          <div>
            <label className={`text-xs font-bold block mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Request URL
            </label>
            <div className="relative flex items-center">
              <Globe className="w-4 h-4 text-emerald-500 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={requestUrl}
                onChange={(e) => setRequestUrl(e.target.value)}
                placeholder="e.g. {{baseUrl}}/users or https://api.example.com/v1/data"
                className={`w-full border rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
            <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Supports 3-level environment variables (Global, Project, File) like <code className="text-emerald-500 font-mono">{"{{baseUrl}}"}</code> or paste cURL, Postman JSON, REST snippet, or OpenAPI spec.
            </p>

            {/* Smart Paste Detection Banner */}
            {detectedPaste.type !== 'unknown' && detectedPaste.type !== 'url' && detectedPaste.requests.length > 0 && (
              <div className={`mt-2.5 p-3 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
                isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold block text-amber-400">⚡ Detected {detectedPaste.title}</span>
                    <span className="text-[10px] opacity-80">{detectedPaste.summary}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApplySmartPaste}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer shrink-0"
                >
                  Auto-Fill Request
                </button>
              </div>
            )}

            {/* Live Environment Variable Preview & Hover Inspector */}
            {/\{\{[^}]+\}\}/.test(requestUrl) && (
              <div className={`mt-2.5 p-3 rounded-xl border text-xs space-y-2.5 ${
                isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="flex items-center space-x-1.5 text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Env Variables Preview (Hover chip to inspect)</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    resolution.missingVars.length === 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {resolution.missingVars.length === 0 ? '✓ Resolved' : `⚠️ ${resolution.missingVars.length} Unresolved`}
                  </span>
                </div>

                {/* Variable Badges with Hover Tooltips */}
                <div className="flex flex-wrap gap-1.5">
                  {resolution.matchedVars.map((v, idx) => (
                    <div
                      key={idx}
                      className="group relative inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono hover:bg-emerald-500/20 transition-all cursor-help"
                    >
                      <Eye className="w-3 h-3 text-emerald-400" />
                      <span className="font-bold">{"{{"}{v.key}{"}}"}</span>
                      <span className="text-emerald-500/60">→</span>
                      <span className="font-semibold max-w-[140px] truncate">{v.value || '""'}</span>

                      {/* Floating Tooltip Card on Hover */}
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-72 p-3 bg-slate-900 border border-emerald-500/40 rounded-xl shadow-2xl text-slate-100 font-sans text-xs space-y-1.5 animate-in fade-in zoom-in-95 pointer-events-none">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <span className="font-bold text-emerald-400 font-mono text-xs">{"{{"}{v.key}{"}}"}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            {v.sourceName}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Resolved Value:</span>
                          <div className="font-mono text-emerald-300 font-bold break-all bg-slate-950 p-2 rounded-lg border border-slate-800 mt-1 text-xs">
                            {v.value || '(empty)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {resolution.missingVars.map((mKey, idx) => (
                    <div
                      key={idx}
                      className="group relative inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-mono hover:bg-rose-500/20 transition-all cursor-help"
                    >
                      <span className="font-bold">{"{{"}{mKey}{"}}"}</span>
                      <span className="text-rose-400 font-semibold">(undefined)</span>

                      {/* Tooltip for Missing Var */}
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-2.5 bg-slate-900 border border-rose-500/40 rounded-xl shadow-2xl text-slate-100 font-sans text-xs space-y-1 animate-in fade-in zoom-in-95 pointer-events-none">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                          <span className="font-bold text-rose-400 font-mono">{"{{"}{mKey}{"}}"}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold">
                            Not Found
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 pt-1">
                          No matching variable <code className="text-rose-400 font-mono">{"{{"}{mKey}{"}}"}</code> found in active environment or target file.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resolved URL Display */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400 font-sans font-medium">Evaluated URL:</span>
                  <span className="font-bold text-emerald-400 truncate max-w-[340px]" title={resolution.resolved}>
                    {resolution.resolved}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Target File Selector */}
          <div>
            <label className={`text-xs font-bold block mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Target .rest File
            </label>
            <select
              value={targetFileId}
              onChange={(e) => setTargetFileId(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {files.map((file) => (
                <option key={file.id} value={file.id}>
                  📄 {file.name} ({file.requests.length} endpoints)
                </option>
              ))}
              <option value="NEW_FILE">✨ Create New .rest File</option>
            </select>
          </div>

          {/* Conditional New File Name Input */}
          {targetFileId === 'NEW_FILE' && (
            <div className={`p-3 border rounded-xl space-y-2 animate-in fade-in ${
              isDarkMode ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-500">
                <FileCode className="w-4 h-4" />
                <span>New REST File Details</span>
              </div>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g. user_service.rest"
                className={`w-full border rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className={`pt-3 border-t flex items-center justify-between ${
            isDarkMode ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <span className={`text-[11px] flex items-center space-x-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>Press</span>
              <kbd className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}>
                Enter ↵
              </kbd>
              <span>to create</span>
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <span>Create Endpoint</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
