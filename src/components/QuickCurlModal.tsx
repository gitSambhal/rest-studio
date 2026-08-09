import React, { useState, useEffect } from 'react';
import { Project, RestRequest, RestFile } from '../types';
import { detectAndParsePaste, SmartPasteResult } from '../utils/restParser';
import {
  X,
  Terminal,
  Zap,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Globe,
  CornerDownLeft,
  Copy,
  Sparkles,
  FileJson,
  Layers,
  Code2,
} from 'lucide-react';

interface QuickCurlModalProps {
  isOpen: boolean;
  project: Project;
  activeFileId: string | null;
  isDarkMode?: boolean;
  onClose: () => void;
  onImportCurl: (req: RestRequest, targetFileId?: string) => void;
  onImportPostman?: (folders: { id: string; name: string; fileIds: string[] }[], files: RestFile[]) => void;
  onImportRestFile?: (fileName: string, content: string) => void;
}

const SAMPLE_PASTES = [
  {
    label: 'cURL Command',
    type: 'curl',
    command: `curl -X POST "https://api.example.com/v1/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"username": "admin", "password": "secret123"}'`,
  },
  {
    label: 'Postman JSON',
    type: 'postman',
    command: `{
  "info": {
    "name": "User Service API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get User Profile",
      "request": {
        "method": "GET",
        "url": "https://api.example.com/v1/users/profile",
        "header": [{ "key": "Authorization", "value": "Bearer my_jwt_token_123" }]
      }
    },
    {
      "name": "Update Profile",
      "request": {
        "method": "PUT",
        "url": "https://api.example.com/v1/users/profile",
        "header": [{ "key": "Content-Type", "value": "application/json" }],
        "body": { "mode": "raw", "raw": "{\\"name\\": \\"John Doe\\", \\"email\\": \\"john@example.com\\"}" }
      }
    }
  ]
}`,
  },
  {
    label: 'REST File Snippet',
    type: 'rest_file',
    command: `@baseUrl = https://api.example.com/v1
@authToken = Bearer my_jwt_token_123

### Login Endpoint
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "secret123"
}

### Get Users List
GET {{baseUrl}}/users?limit=20
Authorization: {{authToken}}`,
  },
  {
    label: 'OpenAPI Spec',
    type: 'openapi',
    command: `{
  "openapi": "3.0.0",
  "info": {
    "title": "Petstore API",
    "version": "1.0.0"
  },
  "servers": [{ "url": "https://petstore.swagger.io/v2" }],
  "paths": {
    "/pets": {
      "get": {
        "summary": "List all pets"
      },
      "post": {
        "summary": "Create a pet"
      }
    }
  }
}`,
  },
];

export const QuickCurlModal: React.FC<QuickCurlModalProps> = ({
  isOpen,
  project,
  activeFileId,
  isDarkMode = true,
  onClose,
  onImportCurl,
  onImportPostman,
  onImportRestFile,
}) => {
  if (!isOpen) return null;
  const files = project?.files || [];
  const defaultTargetFileId = activeFileId || (files.length > 0 ? files[0].id : '');

  const [inputText, setInputText] = useState('');
  const [targetFileId, setTargetFileId] = useState<string>(defaultTargetFileId);
  const [parseResult, setParseResult] = useState<SmartPasteResult | null>(null);

  // Live Auto-Detection Effect
  useEffect(() => {
    const result = detectAndParsePaste(inputText);
    setParseResult(result);
  }, [inputText]);

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseResult || parseResult.type === 'unknown' || parseResult.requests.length === 0) return;

    if (parseResult.type === 'postman' || parseResult.type === 'openapi') {
      if (parseResult.files.length > 0 && onImportPostman) {
        onImportPostman([], parseResult.files);
        onClose();
        return;
      }
    }

    if (parseResult.type === 'rest_file' && parseResult.requests.length > 1 && onImportRestFile) {
      onImportRestFile('imported_requests.rest', inputText);
      onClose();
      return;
    }

    // Single or primary request import
    const firstReq = parseResult.requests[0];
    onImportCurl(firstReq, targetFileId || undefined);
    onClose();
  };

  const getBadgeIcon = (type: SmartPasteResult['type']) => {
    switch (type) {
      case 'curl':
        return <Terminal className="w-4 h-4 text-amber-400" />;
      case 'postman':
        return <FileJson className="w-4 h-4 text-orange-400" />;
      case 'openapi':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'rest_file':
        return <FileCode className="w-4 h-4 text-indigo-400" />;
      case 'url':
        return <Globe className="w-4 h-4 text-sky-400" />;
      default:
        return <Zap className="w-4 h-4 text-slate-400" />;
    }
  };

  const getBadgeStyle = (type: SmartPasteResult['type']) => {
    switch (type) {
      case 'curl':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'postman':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'openapi':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'rest_file':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'url':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 ${
        isDarkMode ? 'bg-slate-950/80 backdrop-blur-sm' : 'bg-slate-900/40 backdrop-blur-sm'
      }`}
      onClick={onClose}
    >
      <div
        className={`border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/90'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Zap className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight flex items-center space-x-2">
                <span>Smart Import &amp; Quick Paste</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Auto-Detects 4 Formats
                </span>
              </h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Paste cURL, Postman JSON, REST File, or OpenAPI Spec — instant detection &amp; parsing
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

        {/* Body */}
        <form onSubmit={handleImport} className="p-5 space-y-4">
          {/* Quick Preset Fillers */}
          <div className="flex items-center justify-between">
            <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Paste Code / Snippet:
            </label>
            <div className="flex items-center space-x-1.5">
              <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Presets:</span>
              {SAMPLE_PASTES.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(sample.command)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                    isDarkMode
                      ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/40'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-amber-600 hover:border-amber-300'
                  }`}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area Input */}
          <div className="relative">
            <textarea
              autoFocus
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={6}
              placeholder={`Paste anything here:\n- cURL: curl -X POST "https://..." -H "Content-Type: application/json"\n- Postman Collection JSON\n- REST File (.rest / .http) snippet\n- OpenAPI / Swagger JSON or YAML`}
              className={`w-full font-mono border rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Live Parsing Preview Banner */}
          {parseResult && parseResult.type !== 'unknown' && parseResult.requests.length > 0 ? (
            <div className={`p-3.5 border rounded-xl space-y-2.5 animate-in fade-in duration-150 ${
              isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-400">{parseResult.title}</span>
                </div>

                <div className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-bold ${getBadgeStyle(parseResult.type)}`}>
                  {getBadgeIcon(parseResult.type)}
                  <span className="capitalize">{parseResult.type.replace('_', ' ')}</span>
                </div>
              </div>

              <p className="text-[11px] font-medium opacity-90">{parseResult.summary}</p>

              {/* Endpoints Preview List */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {parseResult.requests.slice(0, 5).map((req, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border flex items-center justify-between text-xs font-mono ${
                      isDarkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        req.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' :
                        req.method === 'POST' ? 'bg-sky-500/20 text-sky-400' :
                        req.method === 'PUT' ? 'bg-amber-500/20 text-amber-400' :
                        req.method === 'DELETE' ? 'bg-rose-500/20 text-rose-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {req.method}
                      </span>
                      <span className="font-semibold text-slate-200 truncate">{req.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate ml-2 max-w-[200px]">{req.url}</span>
                  </div>
                ))}

                {parseResult.requests.length > 5 && (
                  <p className="text-[10px] text-center font-semibold text-emerald-400 pt-1">
                    + {parseResult.requests.length - 5} more request(s) will be imported
                  </p>
                )}
              </div>
            </div>
          ) : inputText.trim() ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center space-x-2 text-amber-400 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Could not parse format. Please check your cURL, Postman JSON, REST file snippet, or OpenAPI spec syntax.</span>
            </div>
          ) : null}

          {/* Target File Selector */}
          <div>
            <label className={`text-xs font-bold block mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Target File to Append Request(s)
            </label>
            <select
              value={targetFileId}
              onChange={(e) => setTargetFileId(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {files.map((file) => (
                <option key={file.id} value={file.id}>
                  📄 {file.name} ({file.requests.length} endpoints)
                </option>
              ))}
            </select>
          </div>

          {/* Footer Actions */}
          <div className={`pt-3 border-t flex items-center justify-between ${
            isDarkMode ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <span className={`text-[11px] flex items-center space-x-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Instant request creation from smart paste</span>
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
                disabled={!parseResult || parseResult.type === 'unknown' || parseResult.requests.length === 0}
                className={`px-5 py-2 rounded-xl font-bold text-xs shadow-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  parseResult && parseResult.type !== 'unknown' && parseResult.requests.length > 0
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                }`}
              >
                <span>
                  {parseResult && parseResult.requests.length > 1
                    ? `Import All (${parseResult.requests.length}) Endpoints`
                    : 'Import & Open Request'}
                </span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

