import React, { useState } from 'react';
import { EnvVariable, ExecutionResponse, HTTPMethod, KeyValuePair, PostRequestScript, PreRequestScript, RequestAuth, RestRequest, TestAssertion, VariableExtractorItem } from '../types';
import { AutocompleteInput } from './AutocompleteInput';
import { ScriptCodeEditor } from './ScriptCodeEditor';
import { VarBadge, RenderTextWithVars } from './VarBadge';
import { smartFormatJson, validateJsonSyntax, highlightJson } from '../utils/syntaxHighlighter';
import { resolveEnvVariables, generateCodeSnippet, ScopeContext, getVariableLookupDetails } from '../utils/envUtils';
import {
  Send,
  Save,
  Plus,
  Trash2,
  Code,
  Shield,
  FileJson,
  Layers,
  Sparkles,
  Check,
  Copy,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Variable,
  X,
  Zap,
  Terminal,
  Lock,
  ArrowRight,
  ShieldCheck,
  Key,
} from 'lucide-react';

interface RequestEditorProps {
  request: RestRequest;
  envVariables: EnvVariable[];
  fileVariables: Record<string, string>;
  scopeCtx?: ScopeContext;
  projectAuth?: RequestAuth;
  onUpdateProjectAuth?: (auth: RequestAuth) => void;
  onUpdateRequest: (updated: RestRequest) => void;
  onSendRequest: (req: RestRequest) => void;
  isLoading: boolean;
  lastResponse?: ExecutionResponse | null;
}

export const RequestEditor: React.FC<RequestEditorProps> = ({
  request,
  envVariables,
  fileVariables,
  scopeCtx,
  projectAuth,
  onUpdateProjectAuth,
  onUpdateRequest,
  onSendRequest,
  isLoading,
  lastResponse,
}) => {
  const [activeTab, setActiveTab] = useState<
    'params' | 'headers' | 'auth' | 'body' | 'pre-script' | 'post-script' | 'tests' | 'env' | 'code'
  >('params');
  const [codeLang, setCodeLang] = useState<'curl' | 'javascript' | 'axios' | 'python' | 'node' | 'go' | 'rust'>('curl');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);
  const [copiedModalCurl, setCopiedModalCurl] = useState(false);

  // Method colors
  const getMethodColor = (m: HTTPMethod) => {
    switch (m) {
      case 'GET':
        return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40';
      case 'POST':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/40';
      case 'PUT':
        return 'text-amber-400 bg-amber-500/20 border-amber-500/40';
      case 'DELETE':
        return 'text-rose-400 bg-rose-500/20 border-rose-500/40';
      case 'PATCH':
        return 'text-purple-400 bg-purple-500/20 border-purple-500/40';
      default:
        return 'text-slate-400 bg-slate-500/20 border-slate-500/40';
    }
  };

  // Helper updates
  const updateUrl = (newUrl: string) => {
    onUpdateRequest({ ...request, url: newUrl });
  };

  const updateMethod = (method: HTTPMethod) => {
    onUpdateRequest({ ...request, method });
  };

  const updateName = (name: string) => {
    onUpdateRequest({ ...request, name });
  };

  const handleBodyModeChange = (newMode: 'none' | 'json' | 'raw' | 'x-www-form-urlencoded') => {
    const updatedHeaders = [...request.headers];
    const contentTypeIdx = updatedHeaders.findIndex(
      (h) => h.key.toLowerCase() === 'content-type'
    );

    let defaultContentType = '';
    if (newMode === 'json') defaultContentType = 'application/json';
    else if (newMode === 'x-www-form-urlencoded') defaultContentType = 'application/x-www-form-urlencoded';
    else if (newMode === 'raw') defaultContentType = 'text/plain';

    if (defaultContentType) {
      if (contentTypeIdx >= 0) {
        updatedHeaders[contentTypeIdx] = {
          ...updatedHeaders[contentTypeIdx],
          value: defaultContentType,
          enabled: true,
        };
      } else {
        updatedHeaders.push({
          id: 'hdr_' + Math.random().toString(36).substring(2, 9),
          key: 'Content-Type',
          value: defaultContentType,
          enabled: true,
        });
      }
    }

    onUpdateRequest({
      ...request,
      body: { ...request.body, mode: newMode },
      headers: updatedHeaders,
    });
  };

  // Query Params handlers
  const addQueryParam = () => {
    const newParam: KeyValuePair = {
      id: 'param_' + Math.random().toString(36).substring(2, 9),
      key: '',
      value: '',
      enabled: true,
    };
    onUpdateRequest({ ...request, queryParams: [...request.queryParams, newParam] });
  };

  const updateParam = (index: number, updatedItem: Partial<KeyValuePair>) => {
    const newParams = [...request.queryParams];
    newParams[index] = { ...newParams[index], ...updatedItem };
    onUpdateRequest({ ...request, queryParams: newParams });
  };

  const deleteParam = (index: number) => {
    const newParams = request.queryParams.filter((_, i) => i !== index);
    onUpdateRequest({ ...request, queryParams: newParams });
  };

  // Header handlers
  const addHeader = (key = '', value = '') => {
    const newHeader: KeyValuePair = {
      id: 'hdr_' + Math.random().toString(36).substring(2, 9),
      key,
      value,
      enabled: true,
    };
    onUpdateRequest({ ...request, headers: [...request.headers, newHeader] });
  };

  const updateHeader = (index: number, updatedItem: Partial<KeyValuePair>) => {
    const newHeaders = [...request.headers];
    newHeaders[index] = { ...newHeaders[index], ...updatedItem };
    onUpdateRequest({ ...request, headers: newHeaders });
  };

  const deleteHeader = (index: number) => {
    const newHeaders = request.headers.filter((_, i) => i !== index);
    onUpdateRequest({ ...request, headers: newHeaders });
  };

  // Context for resolving variables across URL, params, headers, auth, and body
  const ctxToUse = scopeCtx || { projectVariables: envVariables, fileVariables };

  // 1. Resolve URL with query params
  let fullUrl = request.url;
  const activeParams = request.queryParams.filter((p) => p.enabled && p.key);
  if (activeParams.length > 0) {
    const qParams = activeParams.map((p) => {
      const resKey = resolveEnvVariables(p.key, ctxToUse).resolved;
      const resVal = resolveEnvVariables(p.value, ctxToUse).resolved;
      return `${encodeURIComponent(resKey)}=${encodeURIComponent(resVal)}`;
    });
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + qParams.join('&');
  }

  // 2. Resolve Headers
  const resolvedHeaderMap: Record<string, string> = {};
  request.headers
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      const resKey = resolveEnvVariables(h.key, ctxToUse).resolved;
      const resVal = resolveEnvVariables(h.value, ctxToUse).resolved;
      resolvedHeaderMap[resKey] = resVal;
    });

  // Ensure Content-Type header is added if missing
  const hasContentType = Object.keys(resolvedHeaderMap).some((k) => k.toLowerCase() === 'content-type');
  if (!hasContentType) {
    if (request.body.mode === 'json') {
      resolvedHeaderMap['Content-Type'] = 'application/json';
    } else if (request.body.mode === 'x-www-form-urlencoded') {
      resolvedHeaderMap['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (request.body.mode === 'raw') {
      resolvedHeaderMap['Content-Type'] = 'text/plain';
    }
  }

  // 3. Resolve Auth
  if (request.auth.type === 'bearer' && request.auth.bearerToken) {
    const token = resolveEnvVariables(request.auth.bearerToken, ctxToUse).resolved;
    resolvedHeaderMap['Authorization'] = `Bearer ${token}`;
  } else if (request.auth.type === 'basic') {
    const username = resolveEnvVariables(request.auth.basicUsername || '', ctxToUse).resolved;
    const password = resolveEnvVariables(request.auth.basicPassword || '', ctxToUse).resolved;
    if (username || password) {
      const credentials = `${username}:${password}`;
      const encoded = typeof btoa !== 'undefined' ? btoa(credentials) : '';
      resolvedHeaderMap['Authorization'] = `Basic ${encoded}`;
    }
  } else if (request.auth.type === 'apikey') {
    const key = resolveEnvVariables(request.auth.apiKeyKey || '', ctxToUse).resolved;
    const value = resolveEnvVariables(request.auth.apiKeyValue || '', ctxToUse).resolved;
    const addTo = request.auth.apiKeyAddTo || 'header';
    if (key && value) {
      if (addTo === 'header') {
        resolvedHeaderMap[key] = value;
      } else if (addTo === 'query') {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
    }
  }

  const resolvedUrl = resolveEnvVariables(fullUrl, ctxToUse).resolved;
  const resolvedBody = request.body.rawText
    ? resolveEnvVariables(request.body.rawText, ctxToUse).resolved
    : '';

  const generatedCode = generateCodeSnippet(request, resolvedUrl, resolvedHeaderMap, resolvedBody, codeLang);

  // Extract variables referenced anywhere in current request
  const reqVarsText = JSON.stringify(request);
  const requestVarKeys = Array.from(
    new Set(Array.from(reqVarsText.matchAll(/\{\{([a-zA-Z0-9_.-]+)\}\}/g)).map((m) => m[1]))
  );

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Pre-request Script Helper
  const preScript: PreRequestScript = request.preRequestScript || {
    enabled: false,
    type: 'token_fetch',
    tokenFetchConfig: {
      tokenUrl: '{{baseUrl}}/auth/login',
      method: 'POST',
      grantType: 'password',
      username: '',
      password: '',
      tokenJsonPath: 'access_token',
      saveToVarName: 'bearer_token',
      targetScope: 'environment',
      autoInjectHeader: true,
    },
    validationConfig: {
      requireValidUrl: true,
      requireHeaders: [],
      validateJsonBody: true,
    },
    script: `// Pre-request Custom Script\n// Available API: pm.environment.set(key, val), pm.request.setHeader(key, val), pm.request.setUrl(url), pm.log(msg)\npm.request.setHeader("X-Client-Timestamp", Date.now().toString());\npm.log("Injected X-Client-Timestamp header");\n`,
  };

  const updatePreScript = (updated: PreRequestScript) => {
    onUpdateRequest({ ...request, preRequestScript: updated });
  };

  // Post-request Script Helper
  const postScript: PostRequestScript = request.postRequestScript || {
    enabled: false,
    type: 'extract_variable',
    extractors: [
      {
        id: 'ext_1',
        source: 'body_json',
        sourcePath: 'access_token',
        targetVarName: 'bearer_token',
        targetScope: 'environment',
        enabled: true,
      },
    ],
    validationConfig: {
      expectedStatus: 200,
      maxDurationMs: 1000,
      requiredJsonFields: [],
    },
    script: `// Post-request Custom Script\n// Available API: pm.response.status, pm.response.json(), pm.environment.set(key, val), pm.test(name, fn)\npm.test("Status code is 200", () => {\n  pm.expect(pm.response.status).to.equal(200);\n});\n\nconst json = pm.response.json();\nif (json && json.access_token) {\n  pm.environment.set("bearer_token", json.access_token);\n}\n`,
  };

  const updatePostScript = (updated: PostRequestScript) => {
    onUpdateRequest({ ...request, postRequestScript: updated });
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Top Bar: Request Name, Method, URL, Send Button */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-3">
        {/* Request Title Input */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <input
              type="text"
              value={request.name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="Request Name (e.g., Get All Users)"
              className="text-base font-bold text-slate-100 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none px-1 py-0.5 transition-colors max-w-sm truncate"
            />

            {requestVarKeys.length > 0 && (
              <div className="flex items-center space-x-1.5 shrink-0 bg-slate-950/60 border border-slate-800/80 px-2 py-1 rounded-lg">
                <span className="text-[10px] text-slate-400 font-sans font-medium">Vars in request:</span>
                <div className="flex items-center space-x-1">
                  {requestVarKeys.map((vk) => (
                    <VarBadge
                      key={vk}
                      varKey={vk}
                      envVariables={envVariables}
                      fileVariables={fileVariables}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsCurlModalOpen(true)}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono font-bold text-xs px-3 py-2 rounded-lg border border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer"
              title="View / Copy cURL Command"
            >
              <Code className="w-3.5 h-3.5" />
              <span>cURL</span>
            </button>

            <button
              type="button"
              onClick={() => onSendRequest(request)}
              disabled={isLoading}
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4 fill-slate-950" />
              )}
              <span>Send Request</span>
              <span className="text-[10px] font-mono bg-slate-950/20 text-slate-950 px-1.5 py-0.5 rounded">
                Ctrl+Enter
              </span>
            </button>
          </div>
        </div>

        {/* Method & URL Bar */}
        <div className="flex items-center space-x-2">
          {/* Method Select */}
          <select
            value={request.method}
            onChange={(e) => updateMethod(e.target.value as HTTPMethod)}
            className={`font-mono text-xs font-bold px-3 py-2 rounded-lg border focus:outline-none transition-colors cursor-pointer ${getMethodColor(
              request.method
            )}`}
          >
            <option value="GET" className="bg-slate-900 text-emerald-400">GET</option>
            <option value="POST" className="bg-slate-900 text-blue-400">POST</option>
            <option value="PUT" className="bg-slate-900 text-amber-400">PUT</option>
            <option value="DELETE" className="bg-slate-900 text-rose-400">DELETE</option>
            <option value="PATCH" className="bg-slate-900 text-purple-400">PATCH</option>
            <option value="HEAD" className="bg-slate-900 text-slate-400">HEAD</option>
            <option value="OPTIONS" className="bg-slate-900 text-slate-400">OPTIONS</option>
          </select>

          {/* Autocomplete URL Input */}
          <div className="flex-1">
            <AutocompleteInput
              value={request.url}
              onChange={updateUrl}
              placeholder="https://api.example.com/v1/users or {{baseUrl}}/users"
              scopeCtx={scopeCtx}
              envVariables={envVariables}
              fileVariables={fileVariables}
            />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center px-4 bg-slate-900/60 border-b border-slate-800 text-xs font-medium space-x-6">
        <button
          type="button"
          onClick={() => setActiveTab('params')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'params'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Params</span>
          {request.queryParams.filter((p) => p.enabled && p.key).length > 0 && (
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {request.queryParams.filter((p) => p.enabled && p.key).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('headers')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'headers'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Headers</span>
          {request.headers.filter((h) => h.enabled && h.key).length > 0 && (
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {request.headers.filter((h) => h.enabled && h.key).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('auth')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'auth'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Auth</span>
          {request.auth.type !== 'none' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('body')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'body'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileJson className="w-3.5 h-3.5" />
          <span>Body</span>
          {request.body.mode !== 'none' && (
            <span className="text-[10px] uppercase font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded">
              {request.body.mode}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pre-script')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'pre-script'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Pre-Request</span>
          {request.preRequestScript?.enabled && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('post-script')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'post-script'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-teal-400" />
          <span>Post-Request</span>
          {request.postRequestScript?.enabled && (
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tests')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'tests'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Tests & Assertions</span>
          {(request.assertions?.length || 0) > 0 && (
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {request.assertions?.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('env')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'env'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Env Variables</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'code'
              ? 'border-emerald-500 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>Code Snippet</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* PARAMS TAB */}
        {activeTab === 'params' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Query Parameters (Auto-populates URL query string)</span>
              <button
                type="button"
                onClick={addQueryParam}
                className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-semibold text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Query Param</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
              <div className="grid grid-cols-12 bg-slate-900/80 px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-1 text-center">Use</div>
                <div className="col-span-5">Key</div>
                <div className="col-span-[5]">Value (Supports {"{{env_var}}"})</div>
                <div className="col-span-1 text-center">Action</div>
              </div>

              {request.queryParams.map((param, index) => (
                <div key={param.id} className="grid grid-cols-12 px-3 py-2 items-center gap-2 hover:bg-slate-900/40">
                  <div className="col-span-1 flex justify-center">
                    <input
                      type="checkbox"
                      checked={param.enabled}
                      onChange={(e) => updateParam(index, { enabled: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <div className="col-span-5">
                    <input
                      type="text"
                      value={param.key}
                      onChange={(e) => updateParam(index, { key: e.target.value })}
                      placeholder="e.g. page, limit"
                      className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="col-span-5">
                    <AutocompleteInput
                      value={param.value}
                      onChange={(val) => updateParam(index, { value: val })}
                      placeholder="e.g. {{page}} or 1"
                      scopeCtx={scopeCtx}
                      envVariables={envVariables}
                      fileVariables={fileVariables}
                      showResolvedPreview={true}
                    />
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => deleteParam(index)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {request.queryParams.length === 0 && (
                <div className="py-6 text-center text-slate-500 text-xs font-mono">
                  No query parameters added yet. Click "+ Add Query Param" above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <span>Request Headers</span>
                <span className="text-[10px] text-slate-500 font-mono">Preset quick keys:</span>
                <button
                  type="button"
                  onClick={() => addHeader('Content-Type', 'application/json')}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono"
                >
                  + Content-Type: json
                </button>
                <button
                  type="button"
                  onClick={() => addHeader('Authorization', 'Bearer {{authToken}}')}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono"
                >
                  + Auth: Bearer
                </button>
              </div>

              <button
                type="button"
                onClick={() => addHeader('', '')}
                className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-semibold text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Header</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
              <div className="grid grid-cols-12 bg-slate-900/80 px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-1 text-center">Use</div>
                <div className="col-span-5">Header Key</div>
                <div className="col-span-[5]">Header Value (Supports {"{{env_var}}"})</div>
                <div className="col-span-1 text-center">Action</div>
              </div>

              {request.headers.map((header, index) => (
                <div key={header.id} className="grid grid-cols-12 px-3 py-2 items-center gap-2 hover:bg-slate-900/40">
                  <div className="col-span-1 flex justify-center">
                    <input
                      type="checkbox"
                      checked={header.enabled}
                      onChange={(e) => updateHeader(index, { enabled: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <div className="col-span-5">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => updateHeader(index, { key: e.target.value })}
                      placeholder="e.g. Authorization, Accept"
                      className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="col-span-5">
                    <AutocompleteInput
                      value={header.value}
                      onChange={(val) => updateHeader(index, { value: val })}
                      placeholder="e.g. Bearer {{token}}"
                      scopeCtx={scopeCtx}
                      envVariables={envVariables}
                      fileVariables={fileVariables}
                      showResolvedPreview={true}
                    />
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => deleteHeader(index)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {request.headers.length === 0 && (
                <div className="py-6 text-center text-slate-500 text-xs font-mono">
                  No headers configured. Click "+ Add Header" or choose a preset above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUTH TAB */}
        {activeTab === 'auth' && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center space-x-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-300">Auth Type:</span>
              {(['inherit', 'none', 'bearer', 'basic', 'apikey'] as const).map((type) => (
                <label key={type} className="flex items-center space-x-1.5 cursor-pointer text-xs font-mono">
                  <input
                    type="radio"
                    name="authType"
                    checked={(request.auth.type || 'none') === type}
                    onChange={() => onUpdateRequest({ ...request, auth: { ...request.auth, type } })}
                    className="text-emerald-500 focus:ring-0"
                  />
                  <span className="capitalize text-slate-200">
                    {type === 'inherit' ? 'Inherit Auth' : type}
                  </span>
                </label>
              ))}
            </div>

            {request.auth.type === 'inherit' && (
              <div className="space-y-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">Inheriting Auth from Project</h4>
                      <p className="text-[11px] text-slate-400">
                        This request inherits authentication settings configured at the Project level.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    {projectAuth?.type ? `Project: ${projectAuth.type.toUpperCase()}` : 'Project: NONE'}
                  </span>
                </div>

                {/* Live Preview of Inherited Credentials */}
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs space-y-2">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                    Effective Project Auth Settings:
                  </div>
                  {(!projectAuth || projectAuth.type === 'none') && (
                    <div className="text-slate-400 italic">
                      No project-level authentication is currently configured (Mode: None).
                    </div>
                  )}

                  {projectAuth?.type === 'bearer' && (
                    <div className="font-mono text-slate-200 space-y-1">
                      <div><span className="text-slate-500">Auth Type:</span> Bearer Token</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">Token:</span>
                        <RenderTextWithVars
                          text={projectAuth.bearerToken || '(empty)'}
                          scopeCtx={scopeCtx}
                          envVariables={envVariables}
                          fileVariables={fileVariables}
                          showResolvedValue={true}
                        />
                      </div>
                    </div>
                  )}

                  {projectAuth?.type === 'basic' && (
                    <div className="font-mono text-slate-200 space-y-1">
                      <div><span className="text-slate-500">Auth Type:</span> Basic Auth</div>
                      <div><span className="text-slate-500">Username:</span> {projectAuth.basicUsername || '(none)'}</div>
                      <div><span className="text-slate-500">Password:</span> {projectAuth.basicPassword ? '••••••••' : '(none)'}</div>
                    </div>
                  )}

                  {projectAuth?.type === 'apikey' && (
                    <div className="font-mono text-slate-200 space-y-1">
                      <div><span className="text-slate-500">Auth Type:</span> API Key</div>
                      <div><span className="text-slate-500">Key:</span> {projectAuth.apiKeyKey || '(none)'}</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">Value:</span>
                        <RenderTextWithVars
                          text={projectAuth.apiKeyValue || '(empty)'}
                          scopeCtx={scopeCtx}
                          envVariables={envVariables}
                          fileVariables={fileVariables}
                          showResolvedValue={true}
                        />
                      </div>
                      <div><span className="text-slate-500">Add To:</span> {projectAuth.apiKeyAddTo || 'header'}</div>
                    </div>
                  )}
                </div>

                {/* Inline Project Auth Editor */}
                {onUpdateProjectAuth && (
                  <div className="pt-2">
                    <details className="group">
                      <summary className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center space-x-1 select-none">
                        <span>⚙ Configure / Edit Project Level Auth</span>
                      </summary>
                      <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                        <div className="text-xs font-medium text-slate-300">Set Project Default Auth Type:</div>
                        <div className="flex items-center space-x-3">
                          {(['none', 'bearer', 'basic', 'apikey'] as const).map((pType) => (
                            <label key={pType} className="flex items-center space-x-1.5 cursor-pointer text-xs font-mono">
                              <input
                                type="radio"
                                name="projectAuthType"
                                checked={(projectAuth?.type || 'none') === pType}
                                onChange={() =>
                                  onUpdateProjectAuth({
                                    ...(projectAuth || { type: 'none', bearerToken: '' }),
                                    type: pType,
                                  })
                                }
                                className="text-emerald-500 focus:ring-0"
                              />
                              <span className="capitalize text-slate-200">{pType}</span>
                            </label>
                          ))}
                        </div>

                        {projectAuth?.type === 'bearer' && (
                          <div className="space-y-1">
                            <label className="text-xs text-slate-400 block">Project Bearer Token</label>
                            <AutocompleteInput
                              value={projectAuth.bearerToken || ''}
                              onChange={(val) => onUpdateProjectAuth({ ...projectAuth, bearerToken: val })}
                              placeholder="e.g. {{authToken}}"
                              scopeCtx={scopeCtx}
                              envVariables={envVariables}
                              fileVariables={fileVariables}
                            />
                          </div>
                        )}

                        {projectAuth?.type === 'basic' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-slate-400 block">Username</label>
                              <AutocompleteInput
                                value={projectAuth.basicUsername || ''}
                                onChange={(val) => onUpdateProjectAuth({ ...projectAuth, basicUsername: val })}
                                placeholder="e.g. {{username}}"
                                scopeCtx={scopeCtx}
                                envVariables={envVariables}
                                fileVariables={fileVariables}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 block">Password</label>
                              <AutocompleteInput
                                value={projectAuth.basicPassword || ''}
                                onChange={(val) => onUpdateProjectAuth({ ...projectAuth, basicPassword: val })}
                                placeholder="e.g. {{password}}"
                                scopeCtx={scopeCtx}
                                envVariables={envVariables}
                                fileVariables={fileVariables}
                              />
                            </div>
                          </div>
                        )}

                        {projectAuth?.type === 'apikey' && (
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-5">
                              <label className="text-xs text-slate-400 block">Key</label>
                              <AutocompleteInput
                                value={projectAuth.apiKeyKey || ''}
                                onChange={(val) => onUpdateProjectAuth({ ...projectAuth, apiKeyKey: val })}
                                placeholder="X-API-Key"
                                scopeCtx={scopeCtx}
                                envVariables={envVariables}
                                fileVariables={fileVariables}
                              />
                            </div>
                            <div className="col-span-5">
                              <label className="text-xs text-slate-400 block">Value</label>
                              <AutocompleteInput
                                value={projectAuth.apiKeyValue || ''}
                                onChange={(val) => onUpdateProjectAuth({ ...projectAuth, apiKeyValue: val })}
                                placeholder="{{apiKey}}"
                                scopeCtx={scopeCtx}
                                envVariables={envVariables}
                                fileVariables={fileVariables}
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs text-slate-400 block">Location</label>
                              <select
                                value={projectAuth.apiKeyAddTo || 'header'}
                                onChange={(e) =>
                                  onUpdateProjectAuth({
                                    ...projectAuth,
                                    apiKeyAddTo: e.target.value as 'header' | 'query',
                                  })
                                }
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
                              >
                                <option value="header">Header</option>
                                <option value="query">Query</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}

            {request.auth.type === 'bearer' && (
              <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 block">Bearer Token</label>
                <AutocompleteInput
                  value={request.auth.bearerToken}
                  onChange={(val) =>
                    onUpdateRequest({ ...request, auth: { ...request.auth, bearerToken: val } })
                  }
                  placeholder="e.g. {{authToken}} or eyJhbGciOi..."
                  scopeCtx={scopeCtx}
                  envVariables={envVariables}
                  fileVariables={fileVariables}
                />
                <p className="text-[11px] text-slate-500">
                  This token will automatically be injected as an <code className="text-emerald-400">Authorization: Bearer ...</code> header during request execution.
                </p>
              </div>
            )}

            {request.auth.type === 'basic' && (
              <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Basic Authentication</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300 block">Username</label>
                    <AutocompleteInput
                      value={request.auth.basicUsername || ''}
                      onChange={(val) =>
                        onUpdateRequest({ ...request, auth: { ...request.auth, basicUsername: val } })
                      }
                      placeholder="e.g. {{username}} or admin"
                      scopeCtx={scopeCtx}
                      envVariables={envVariables}
                      fileVariables={fileVariables}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300 block">Password</label>
                    <AutocompleteInput
                      value={request.auth.basicPassword || ''}
                      onChange={(val) =>
                        onUpdateRequest({ ...request, auth: { ...request.auth, basicPassword: val } })
                      }
                      placeholder="e.g. {{password}} or secret"
                      scopeCtx={scopeCtx}
                      envVariables={envVariables}
                      fileVariables={fileVariables}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Username and password will be Base64-encoded and injected as an <code className="text-emerald-400">Authorization: Basic ...</code> header during request execution.
                </p>
              </div>
            )}

            {request.auth.type === 'apikey' && (
              <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  <span>API Key Authentication</span>
                </div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-5 space-y-1">
                    <label className="text-xs font-medium text-slate-300 block">Key Name</label>
                    <AutocompleteInput
                      value={request.auth.apiKeyKey || ''}
                      onChange={(val) =>
                        onUpdateRequest({ ...request, auth: { ...request.auth, apiKeyKey: val } })
                      }
                      placeholder="e.g. X-API-Key or api_key"
                      scopeCtx={scopeCtx}
                      envVariables={envVariables}
                      fileVariables={fileVariables}
                    />
                  </div>
                  <div className="col-span-5 space-y-1">
                    <label className="text-xs font-medium text-slate-300 block">Key Value</label>
                    <AutocompleteInput
                      value={request.auth.apiKeyValue || ''}
                      onChange={(val) =>
                        onUpdateRequest({ ...request, auth: { ...request.auth, apiKeyValue: val } })
                      }
                      placeholder="e.g. {{apiKey}} or secret_val_123"
                      scopeCtx={scopeCtx}
                      envVariables={envVariables}
                      fileVariables={fileVariables}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-medium text-slate-300 block">Add To</label>
                    <select
                      value={request.auth.apiKeyAddTo || 'header'}
                      onChange={(e) =>
                        onUpdateRequest({
                          ...request,
                          auth: { ...request.auth, apiKeyAddTo: e.target.value as 'header' | 'query' },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="header">Header</option>
                      <option value="query">Query Params</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  The API Key will be automatically injected into request {request.auth.apiKeyAddTo || 'header'}s during execution.
                </p>
              </div>
            )}

            {request.auth.type === 'none' && (
              <div className="py-8 text-center text-slate-500 text-xs font-mono">
                No authentication required for this request.
              </div>
            )}
          </div>
        )}

        {/* BODY TAB */}
        {activeTab === 'body' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center space-x-3">
                <span className="font-semibold text-slate-300">Body Type:</span>
                {(['none', 'json', 'raw', 'x-www-form-urlencoded'] as const).map((mode) => (
                  <label key={mode} className="flex items-center space-x-1.5 cursor-pointer font-mono">
                    <input
                      type="radio"
                      name="bodyMode"
                      checked={request.body.mode === mode}
                      onChange={() => handleBodyModeChange(mode)}
                      className="text-emerald-500 focus:ring-0"
                    />
                    <span className="uppercase text-slate-200">{mode}</span>
                  </label>
                ))}
              </div>

              {request.body.mode === 'json' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const res = smartFormatJson(request.body.rawText, 2);
                      if (res.error) {
                        alert(`JSON Formatting Error: ${res.error}`);
                      } else {
                        onUpdateRequest({
                          ...request,
                          body: { ...request.body, rawText: res.formatted },
                        });
                      }
                    }}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/50 px-2.5 py-1 rounded font-mono font-semibold transition-all"
                    title="Pretty-print JSON with 2 spaces (supports {{variables}})"
                  >
                    Format JSON
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const res = smartFormatJson(request.body.rawText, 0);
                      if (res.error) {
                        alert(`JSON Minification Error: ${res.error}`);
                      } else {
                        onUpdateRequest({
                          ...request,
                          body: { ...request.body, rawText: res.formatted },
                        });
                      }
                    }}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 px-2.5 py-1 rounded font-mono transition-all"
                    title="Minify JSON into single-line string"
                  >
                    Minify
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sample = `{\n  "name": "Jane Doe",\n  "email": "jane.doe@example.com",\n  "role": "admin",\n  "status": "active"\n}`;
                      onUpdateRequest({
                        ...request,
                        body: { ...request.body, rawText: sample },
                      });
                    }}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded font-mono"
                  >
                    Insert Sample
                  </button>

                  {/* JSON Syntax Validation Status Badge */}
                  {request.body.rawText.trim().length > 0 && (() => {
                    const ctxToUseForVal = scopeCtx || { projectVariables: envVariables, fileVariables };
                    const resolvedForVal = resolveEnvVariables(request.body.rawText, ctxToUseForVal).resolved;
                    const status = validateJsonSyntax(resolvedForVal);
                    const hasVars = /\{\{[a-zA-Z0-9_.-]+\}\}/.test(request.body.rawText);

                    if (status.isValid) {
                      return (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                          <span>✓</span>
                          <span>{hasVars ? 'Valid JSON (resolved with variables)' : 'Valid JSON'}</span>
                        </span>
                      );
                    }
                    return (
                      <span
                        className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center space-x-1 max-w-xs truncate"
                        title={status.error}
                      >
                        <span>✕</span>
                        <span className="truncate">Invalid JSON: {status.error}</span>
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {request.body.mode !== 'none' && (() => {
              const bodyVarKeys = Array.from(
                new Set(
                  Array.from(request.body.rawText.matchAll(/\{\{([a-zA-Z0-9_.-]+)\}\}/g)).map(
                    (m) => m[1]
                  )
                )
              );

              return (
                <div className="space-y-3">
                  {/* Variables Inspector Toolbar for Body */}
                  {bodyVarKeys.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                      <span className="text-[11px] font-sans font-semibold text-slate-300 shrink-0 flex items-center space-x-1">
                        <Variable className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Hover to inspect body variables:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {bodyVarKeys.map((vk) => (
                          <VarBadge
                            key={vk}
                            varKey={vk}
                            scopeCtx={scopeCtx}
                            envVariables={envVariables}
                            fileVariables={fileVariables}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <AutocompleteInput
                    isMultiline={true}
                    rows={10}
                    value={request.body.rawText}
                    scopeCtx={scopeCtx}
                    envVariables={envVariables}
                    fileVariables={fileVariables}
                    showResolvedPreview={false}
                    onChange={(val) =>
                      onUpdateRequest({
                        ...request,
                        body: { ...request.body, rawText: val },
                      })
                    }
                    placeholder="Enter request body JSON or text... (Type {{ for environment variable autocomplete)"
                  />

                  <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
                    <span>
                      Autocomplete available: Type <code className="text-emerald-400">&#123;&#123;</code> anywhere in the body text
                    </span>
                    <span>{request.body.rawText.length} characters</span>
                  </div>

                  {/* Live Syntax Highlighted & Resolved Body Preview */}
                  {request.body.rawText.length > 0 && (() => {
                    const resolvedBodyText = resolveEnvVariables(
                      request.body.rawText,
                      scopeCtx || { projectVariables: envVariables, fileVariables }
                    ).resolved;

                    const isResolvedJson = validateJsonSyntax(resolvedBodyText).isValid;

                    return (
                      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-sans font-semibold text-slate-400">
                          <span>Live Resolved Body Preview (Syntax Highlighted):</span>
                          <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {isResolvedJson ? 'JSON Highlight Active' : 'Interpolated Text Active'}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap break-all overflow-x-auto">
                          {isResolvedJson ? (
                            <code>{highlightJson(resolvedBodyText)}</code>
                          ) : (
                            <RenderTextWithVars
                              text={request.body.rawText}
                              scopeCtx={scopeCtx}
                              envVariables={envVariables}
                              fileVariables={fileVariables}
                              showResolvedValue={true}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        )}

        {/* PRE-REQUEST TAB */}
        {activeTab === 'pre-script' && (
          <div className="space-y-4">
            {/* Header / Enable Toggle Bar */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                    <span>Pre-Request Script & Auth Pre-Flight</span>
                    {preScript.enabled && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ACTIVE
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Execute pre-flight token fetching, parameter validation, or custom dynamic scripts before sending this HTTP request.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={preScript.enabled}
                  onChange={(e) => updatePreScript({ ...preScript, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Mode Pills */}
            <div className="flex items-center space-x-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => updatePreScript({ ...preScript, type: 'token_fetch' })}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors ${
                  preScript.type === 'token_fetch'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Auth Token Fetcher</span>
              </button>

              <button
                type="button"
                onClick={() => updatePreScript({ ...preScript, type: 'validate_request' })}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors ${
                  preScript.type === 'validate_request'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Request Validator</span>
              </button>

              <button
                type="button"
                onClick={() => updatePreScript({ ...preScript, type: 'custom' })}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors ${
                  preScript.type === 'custom'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Custom JS Script</span>
              </button>
            </div>

            {/* PANEL 1: Token Fetcher */}
            {preScript.type === 'token_fetch' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 pb-2 border-b border-slate-800">
                  <Key className="w-4 h-4" />
                  <span>Pre-Flight OAuth / Auth Token Fetcher</span>
                </div>

                <div className="grid grid-cols-12 gap-3 text-xs">
                  <div className="col-span-8 space-y-1">
                    <label className="block font-medium text-slate-300">Auth Token Endpoint URL:</label>
                    <AutocompleteInput
                      value={preScript.tokenFetchConfig?.tokenUrl || ''}
                      onChange={(val) =>
                        updatePreScript({
                          ...preScript,
                          tokenFetchConfig: { ...preScript.tokenFetchConfig!, tokenUrl: val },
                        })
                      }
                      placeholder="e.g. {{baseUrl}}/api/v1/auth/login"
                      scopeCtx={scopeCtx}
                      envVariables={envVariables}
                      fileVariables={fileVariables}
                    />
                  </div>

                  <div className="col-span-4 space-y-1">
                    <label className="block font-medium text-slate-300">Method:</label>
                    <select
                      value={preScript.tokenFetchConfig?.method || 'POST'}
                      onChange={(e) =>
                        updatePreScript({
                          ...preScript,
                          tokenFetchConfig: { ...preScript.tokenFetchConfig!, method: e.target.value as any },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 font-mono"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                  </div>

                  <div className="col-span-6 space-y-1">
                    <label className="block font-medium text-slate-300">Grant Method / Body Format:</label>
                    <select
                      value={preScript.tokenFetchConfig?.grantType || 'password'}
                      onChange={(e) =>
                        updatePreScript({
                          ...preScript,
                          tokenFetchConfig: { ...preScript.tokenFetchConfig!, grantType: e.target.value as any },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 font-mono"
                    >
                      <option value="password">Password (Username & Password)</option>
                      <option value="client_credentials">OAuth Client Credentials (ID & Secret)</option>
                      <option value="x-www-form-urlencoded">x-www-form-urlencoded</option>
                      <option value="custom_json">Custom JSON Body</option>
                    </select>
                  </div>

                  {(preScript.tokenFetchConfig?.grantType === 'password' || preScript.tokenFetchConfig?.grantType === 'x-www-form-urlencoded') && (
                    <>
                      <div className="col-span-3 space-y-1">
                        <label className="block font-medium text-slate-300">Username / Client Key:</label>
                        <AutocompleteInput
                          value={preScript.tokenFetchConfig?.username || ''}
                          onChange={(val) =>
                            updatePreScript({
                              ...preScript,
                              tokenFetchConfig: { ...preScript.tokenFetchConfig!, username: val },
                            })
                          }
                          placeholder="e.g. admin@example.com"
                          envVariables={envVariables}
                          fileVariables={fileVariables}
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <label className="block font-medium text-slate-300">Password / Secret:</label>
                        <AutocompleteInput
                          value={preScript.tokenFetchConfig?.password || ''}
                          onChange={(val) =>
                            updatePreScript({
                              ...preScript,
                              tokenFetchConfig: { ...preScript.tokenFetchConfig!, password: val },
                            })
                          }
                          placeholder="e.g. {{password}}"
                          envVariables={envVariables}
                          fileVariables={fileVariables}
                        />
                      </div>
                    </>
                  )}

                  {preScript.tokenFetchConfig?.grantType === 'client_credentials' && (
                    <>
                      <div className="col-span-3 space-y-1">
                        <label className="block font-medium text-slate-300">Client ID:</label>
                        <AutocompleteInput
                          value={preScript.tokenFetchConfig?.clientId || ''}
                          onChange={(val) =>
                            updatePreScript({
                              ...preScript,
                              tokenFetchConfig: { ...preScript.tokenFetchConfig!, clientId: val },
                            })
                          }
                          placeholder="client_id"
                          envVariables={envVariables}
                          fileVariables={fileVariables}
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <label className="block font-medium text-slate-300">Client Secret:</label>
                        <AutocompleteInput
                          value={preScript.tokenFetchConfig?.clientSecret || ''}
                          onChange={(val) =>
                            updatePreScript({
                              ...preScript,
                              tokenFetchConfig: { ...preScript.tokenFetchConfig!, clientSecret: val },
                            })
                          }
                          placeholder="client_secret"
                          envVariables={envVariables}
                          fileVariables={fileVariables}
                        />
                      </div>
                    </>
                  )}

                  {preScript.tokenFetchConfig?.grantType === 'custom_json' && (
                    <div className="col-span-12 space-y-1">
                      <label className="block font-medium text-slate-300">Custom JSON Payload:</label>
                      <textarea
                        value={preScript.tokenFetchConfig?.customBody || ''}
                        onChange={(e) =>
                          updatePreScript({
                            ...preScript,
                            tokenFetchConfig: { ...preScript.tokenFetchConfig!, customBody: e.target.value },
                          })
                        }
                        rows={3}
                        placeholder={`{\n  "email": "{{user_email}}",\n  "password": "{{password}}"\n}`}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-100"
                      />
                    </div>
                  )}

                  <div className="col-span-6 space-y-1 border-t border-slate-800 pt-3">
                    <label className="block font-medium text-slate-300">Token Property Key Path in Response:</label>
                    <input
                      type="text"
                      value={preScript.tokenFetchConfig?.tokenJsonPath || 'access_token'}
                      onChange={(e) =>
                        updatePreScript({
                          ...preScript,
                          tokenFetchConfig: { ...preScript.tokenFetchConfig!, tokenJsonPath: e.target.value },
                        })
                      }
                      placeholder="e.g. access_token or data.token"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>

                  <div className="col-span-6 space-y-1 border-t border-slate-800 pt-3">
                    <label className="block font-medium text-slate-300">Save Token to Environment Variable:</label>
                    <input
                      type="text"
                      value={preScript.tokenFetchConfig?.saveToVarName || 'bearer_token'}
                      onChange={(e) =>
                        updatePreScript({
                          ...preScript,
                          tokenFetchConfig: { ...preScript.tokenFetchConfig!, saveToVarName: e.target.value },
                        })
                      }
                      placeholder="e.g. bearer_token"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>

                  <div className="col-span-12 border-t border-slate-800 pt-2 flex items-center justify-between">
                    <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preScript.tokenFetchConfig?.autoInjectHeader !== false}
                        onChange={(e) =>
                          updatePreScript({
                            ...preScript,
                            tokenFetchConfig: { ...preScript.tokenFetchConfig!, autoInjectHeader: e.target.checked },
                          })
                        }
                        className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                      />
                      <span>Auto-inject <code className="text-amber-400 font-mono">Authorization: Bearer &#123;&#123;{preScript.tokenFetchConfig?.saveToVarName || 'bearer_token'}&#125;&#125;</code> header for this request</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* PANEL 2: Request Validator */}
            {preScript.type === 'validate_request' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 pb-2 border-b border-slate-800">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Pre-Request Parameter & Schema Validator</span>
                </div>

                <div className="space-y-3 text-xs">
                  <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preScript.validationConfig?.requireValidUrl !== false}
                      onChange={(e) =>
                        updatePreScript({
                          ...preScript,
                          validationConfig: { ...preScript.validationConfig!, requireValidUrl: e.target.checked },
                        })
                      }
                      className="rounded bg-slate-950 border-slate-700 text-amber-500"
                    />
                    <span>Validate URL: Require URL to start with valid <code className="text-amber-400 font-mono">http://</code> or <code className="text-amber-400 font-mono">https://</code> protocol</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preScript.validationConfig?.validateJsonBody !== false}
                      onChange={(e) =>
                        updatePreScript({
                          ...preScript,
                          validationConfig: { ...preScript.validationConfig!, validateJsonBody: e.target.checked },
                        })
                      }
                      className="rounded bg-slate-950 border-slate-700 text-amber-500"
                    />
                    <span>Validate Body JSON Syntax: Verify JSON body is non-empty and syntactically valid before sending</span>
                  </label>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <label className="block font-medium text-slate-300">Required Headers (Comma Separated):</label>
                    <input
                      type="text"
                      value={(preScript.validationConfig?.requireHeaders || []).join(', ')}
                      onChange={(e) =>
                        updatePreScript({
                          ...preScript,
                          validationConfig: {
                            ...preScript.validationConfig!,
                            requireHeaders: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          },
                        })
                      }
                      placeholder="e.g. Authorization, Content-Type, X-API-Key"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PANEL 3: Custom JS Script */}
            {preScript.type === 'custom' && (
              <ScriptCodeEditor
                value={preScript.script || ''}
                onChange={(script) => updatePreScript({ ...preScript, script })}
                type="pre"
                envVariables={envVariables}
                fileVariables={fileVariables}
              />
            )}

            {/* Console Log Output Panel for Pre-Script */}
            {lastResponse?.scriptLogs && lastResponse.scriptLogs.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    <span>Pre-Request Execution Console Logs ({lastResponse.scriptLogs.length})</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Last execution: {new Date(lastResponse.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg font-mono text-xs text-amber-200 space-y-1 max-h-48 overflow-y-auto leading-relaxed">
                  {lastResponse.scriptLogs.map((log, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <span className="text-slate-600 select-none">[{i + 1}]</span>
                      <span className="whitespace-pre-wrap">{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* POST-REQUEST TAB */}
        {activeTab === 'post-script' && (
          <div className="space-y-4">
            {/* Header / Enable Toggle Bar */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                    <span>Post-Request Actions & Variable Extraction</span>
                    {postScript.enabled && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ACTIVE
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Extract tokens/variables from response JSON or headers, validate response schema, or run custom JS post-scripts.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={postScript.enabled}
                  onChange={(e) => updatePostScript({ ...postScript, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
              </label>
            </div>

            {/* Mode Pills */}
            <div className="flex items-center space-x-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => updatePostScript({ ...postScript, type: 'extract_variable' })}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors ${
                  postScript.type === 'extract_variable'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Variable className="w-3.5 h-3.5" />
                <span>Response Variable Extractor</span>
              </button>

              <button
                type="button"
                onClick={() => updatePostScript({ ...postScript, type: 'validate_response' })}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors ${
                  postScript.type === 'validate_response'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Response Validator</span>
              </button>

              <button
                type="button"
                onClick={() => updatePostScript({ ...postScript, type: 'custom' })}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors ${
                  postScript.type === 'custom'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Custom JS Script</span>
              </button>
            </div>

            {/* PANEL 1: Extractor Table */}
            {postScript.type === 'extract_variable' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-teal-300 flex items-center space-x-2">
                    <Variable className="w-4 h-4" />
                    <span>Response Property Variable Extractors</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const newExt: VariableExtractorItem = {
                        id: 'ext_' + Math.random().toString(36).substring(2, 9),
                        source: 'body_json',
                        sourcePath: 'access_token',
                        targetVarName: 'bearer_token',
                        targetScope: 'environment',
                        enabled: true,
                      };
                      updatePostScript({
                        ...postScript,
                        extractors: [...(postScript.extractors || []), newExt],
                      });
                    }}
                    className="flex items-center space-x-1.5 text-xs bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 px-2.5 py-1 rounded-lg font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Variable Extractor</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(postScript.extractors || []).map((ext) => (
                    <div
                      key={ext.id}
                      className="grid grid-cols-12 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 items-center text-xs"
                    >
                      <div className="col-span-3">
                        <select
                          value={ext.source}
                          onChange={(e) => {
                            const updated = (postScript.extractors || []).map((item) =>
                              item.id === ext.id ? { ...item, source: e.target.value as any } : item
                            );
                            updatePostScript({ ...postScript, extractors: updated });
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono"
                        >
                          <option value="body_json">Body JSON Path</option>
                          <option value="header">Response Header</option>
                          <option value="body_regex">Body Regex Group</option>
                        </select>
                      </div>

                      <div className="col-span-4">
                        <input
                          type="text"
                          value={ext.sourcePath}
                          onChange={(e) => {
                            const updated = (postScript.extractors || []).map((item) =>
                              item.id === ext.id ? { ...item, sourcePath: e.target.value } : item
                            );
                            updatePostScript({ ...postScript, extractors: updated });
                          }}
                          placeholder={
                            ext.source === 'body_json'
                              ? 'e.g. access_token or data.id'
                              : ext.source === 'header'
                              ? 'e.g. Authorization or Set-Cookie'
                              : 'e.g. token=([a-zA-Z0-9]+)'
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono text-slate-100"
                        />
                      </div>

                      <div className="col-span-1 text-center text-slate-500 font-mono font-bold">
                        →
                      </div>

                      <div className="col-span-3">
                        <input
                          type="text"
                          value={ext.targetVarName}
                          onChange={(e) => {
                            const updated = (postScript.extractors || []).map((item) =>
                              item.id === ext.id ? { ...item, targetVarName: e.target.value } : item
                            );
                            updatePostScript({ ...postScript, extractors: updated });
                          }}
                          placeholder="Variable Name e.g. bearer_token"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono text-teal-300 font-semibold"
                        />
                      </div>

                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (postScript.extractors || []).filter((item) => item.id !== ext.id);
                            updatePostScript({ ...postScript, extractors: updated });
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {(!postScript.extractors || postScript.extractors.length === 0) && (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      No extractors configured. Click "Add Variable Extractor" above to extract tokens from response JSON or headers.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PANEL 2: Response Validator */}
            {postScript.type === 'validate_response' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-teal-300 pb-2 border-b border-slate-800">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Post-Request Response Validator</span>
                </div>

                <div className="grid grid-cols-12 gap-3 text-xs">
                  <div className="col-span-6 space-y-1">
                    <label className="block font-medium text-slate-300">Expected HTTP Status Code:</label>
                    <input
                      type="number"
                      value={postScript.validationConfig?.expectedStatus || 200}
                      onChange={(e) =>
                        updatePostScript({
                          ...postScript,
                          validationConfig: {
                            ...postScript.validationConfig!,
                            expectedStatus: parseInt(e.target.value, 10) || 200,
                          },
                        })
                      }
                      placeholder="200"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-100"
                    />
                  </div>

                  <div className="col-span-6 space-y-1">
                    <label className="block font-medium text-slate-300">Max Duration Limit (ms):</label>
                    <input
                      type="number"
                      value={postScript.validationConfig?.maxDurationMs || 1000}
                      onChange={(e) =>
                        updatePostScript({
                          ...postScript,
                          validationConfig: {
                            ...postScript.validationConfig!,
                            maxDurationMs: parseInt(e.target.value, 10) || 1000,
                          },
                        })
                      }
                      placeholder="1000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-100"
                    />
                  </div>

                  <div className="col-span-12 space-y-1 border-t border-slate-800 pt-3">
                    <label className="block font-medium text-slate-300">Required Response JSON Property Keys (Comma Separated):</label>
                    <input
                      type="text"
                      value={(postScript.validationConfig?.requiredJsonFields || []).join(', ')}
                      onChange={(e) =>
                        updatePostScript({
                          ...postScript,
                          validationConfig: {
                            ...postScript.validationConfig!,
                            requiredJsonFields: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          },
                        })
                      }
                      placeholder="e.g. id, access_token, status"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PANEL 3: Custom JS Script */}
            {postScript.type === 'custom' && (
              <ScriptCodeEditor
                value={postScript.script || ''}
                onChange={(script) => updatePostScript({ ...postScript, script })}
                type="post"
                envVariables={envVariables}
                fileVariables={fileVariables}
              />
            )}

            {/* Console Log Output Panel for Post-Script */}
            {lastResponse?.scriptLogs && lastResponse.scriptLogs.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-teal-300">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-teal-400" />
                    <span>Post-Request Execution Console Logs ({lastResponse.scriptLogs.length})</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Last execution: {new Date(lastResponse.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg font-mono text-xs text-teal-200 space-y-1 max-h-48 overflow-y-auto leading-relaxed">
                  {lastResponse.scriptLogs.map((log, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <span className="text-slate-600 select-none">[{i + 1}]</span>
                      <span className="whitespace-pre-wrap">{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TESTS & ASSERTIONS TAB */}
        {activeTab === 'tests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Automated Response Assertions</h4>
                <p className="text-[11px] text-slate-400">
                  Assertions run automatically whenever this request is executed or run in batch suites.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const newAst: TestAssertion = {
                    id: 'ast_' + Math.random().toString(36).substring(2, 9),
                    type: 'status_code',
                    targetValue: '200',
                    enabled: true,
                  };
                  onUpdateRequest({
                    ...request,
                    assertions: [...(request.assertions || []), newAst],
                  });
                }}
                className="flex items-center space-x-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Test Assertion</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
              <div className="grid grid-cols-12 bg-slate-900/80 px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                <div className="col-span-1 text-center">Active</div>
                <div className="col-span-3">Assertion Type</div>
                <div className="col-span-5">Expected Target Value</div>
                <div className="col-span-2 text-center">Last Outcome</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {(request.assertions || []).map((ast) => (
                <div key={ast.id} className="grid grid-cols-12 px-3 py-2 items-center text-xs gap-2">
                  <div className="col-span-1 flex justify-center">
                    <input
                      type="checkbox"
                      checked={ast.enabled}
                      onChange={(e) => {
                        const updated = (request.assertions || []).map((a) =>
                          a.id === ast.id ? { ...a, enabled: e.target.checked } : a
                        );
                        onUpdateRequest({ ...request, assertions: updated });
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
                    />
                  </div>

                  <div className="col-span-3">
                    <select
                      value={ast.type}
                      onChange={(e) => {
                        const updated = (request.assertions || []).map((a) =>
                          a.id === ast.id ? { ...a, type: e.target.value as any } : a
                        );
                        onUpdateRequest({ ...request, assertions: updated });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono"
                    >
                      <option value="status_code">Status Code Equals</option>
                      <option value="max_time">Max Response Time (ms)</option>
                      <option value="body_contains">Body Contains String</option>
                      <option value="json_property">JSON Property Exists</option>
                    </select>
                  </div>

                  <div className="col-span-5">
                    <input
                      type="text"
                      value={ast.targetValue}
                      onChange={(e) => {
                        const updated = (request.assertions || []).map((a) =>
                          a.id === ast.id ? { ...a, targetValue: e.target.value } : a
                        );
                        onUpdateRequest({ ...request, assertions: updated });
                      }}
                      placeholder={
                        ast.type === 'status_code'
                          ? '200'
                          : ast.type === 'max_time'
                          ? '500'
                          : ast.type === 'json_property'
                          ? 'id'
                          : 'success'
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono"
                    />
                  </div>

                  <div className="col-span-2 text-center font-mono text-[11px]">
                    {ast.passed !== undefined ? (
                      ast.passed ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>PASS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          <XCircle className="w-3 h-3" />
                          <span>FAIL</span>
                        </span>
                      )
                    ) : (
                      <span className="text-slate-500">Untested</span>
                    )}
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (request.assertions || []).filter((a) => a.id !== ast.id);
                        onUpdateRequest({ ...request, assertions: updated });
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {(!request.assertions || request.assertions.length === 0) && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No automated assertions defined yet. Click "Add Test Assertion" above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ENV VARIABLES INSPECTOR TAB */}
        {activeTab === 'env' && (
          <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Environment Variable Inspector</span>
              </h4>
              <p className="text-xs text-slate-400">
                Below are all variables available to this request from the active project environment profile and REST file declarations.
              </p>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
              <div className="grid grid-cols-12 bg-slate-900/80 px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                <div className="col-span-3">Variable Name</div>
                <div className="col-span-5">Current Resolved Value</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2 text-right">Status</div>
              </div>

              {envVariables.map((v) => (
                <div key={v.id} className="grid grid-cols-12 px-3 py-2.5 items-center font-mono text-xs hover:bg-slate-900/40">
                  <div className="col-span-3 font-bold text-emerald-400">{`{{${v.key}}}`}</div>
                  <div className="col-span-5 text-slate-200 truncate">
                    {v.secret ? '••••••••' : v.value}
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded uppercase">
                      Env
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    {v.enabled ? (
                      <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded font-semibold">
                        Active
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Disabled</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CODE SNIPPET GENERATOR TAB */}
        {activeTab === 'code' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                <span>Target Code Language:</span>
                {(['curl', 'javascript', 'axios', 'python', 'node', 'go', 'rust'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setCodeLang(lang)}
                    className={`px-2.5 py-1 rounded text-xs font-mono uppercase transition-colors ${
                      codeLang === lang
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 font-medium transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
              <code>{generatedCode}</code>
            </pre>
          </div>
        )}
      </div>

      {/* cURL Modal Overlay */}
      {isCurlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Generated cURL Command</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCurlModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Copy this cURL command to execute in terminal, Postman, or send to teammates:
            </p>

            <div className="relative group">
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed max-h-72">
                <code>{generateCodeSnippet(request, resolvedUrl, resolvedHeaderMap, resolvedBody, 'curl')}</code>
              </pre>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const cmd = generateCodeSnippet(request, resolvedUrl, resolvedHeaderMap, resolvedBody, 'curl');
                  navigator.clipboard.writeText(cmd);
                  setCopiedModalCurl(true);
                  setTimeout(() => setCopiedModalCurl(false), 2000);
                }}
                className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
              >
                {copiedModalCurl ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy cURL Command</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsCurlModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
