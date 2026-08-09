import React, { useState, useEffect } from 'react';
import { Project, RestRequest, RestFile } from '../types';
import { parseRestFileContent, parseCurlCommand, parsePostmanCollection, parseOpenApiSpec, exportToPostmanCollection } from '../utils/restParser';
import { X, Upload, Download, FileCode, Terminal, Check, FolderArchive, FileJson, Sparkles, AlertCircle, FileText, Zap } from 'lucide-react';

interface ImportExportModalProps {
  project: Project;
  onClose: () => void;
  onImportRestFile: (fileName: string, content: string) => void;
  onImportCurl: (req: RestRequest) => void;
  onImportPostman: (folders: { id: string; name: string; fileIds: string[] }[], files: RestFile[]) => void;
  isDarkMode?: boolean;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  project,
  onClose,
  onImportRestFile,
  onImportCurl,
  onImportPostman,
  isDarkMode = true,
}) => {
  const [activeTab, setActiveTab] = useState<'import_rest' | 'import_postman' | 'import_openapi' | 'import_curl' | 'export'>('import_rest');
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState('imported.rest');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [autoDetectMsg, setAutoDetectMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Auto detect format when text is pasted or changed
  const handleTextChange = (text: string) => {
    setInputText(text);
    setErrorMsg('');
    setAutoDetectMsg('');

    const trimmed = text.trim();
    if (!trimmed) return;

    // cURL detection
    if (trimmed.toLowerCase().startsWith('curl')) {
      if (activeTab !== 'import_curl') {
        setActiveTab('import_curl');
        setAutoDetectMsg('⚡ Detected cURL command! Switched to cURL import mode.');
      }
      return;
    }

    // OpenAPI detection
    if (
      (trimmed.includes('"openapi"') || trimmed.includes('openapi:') || trimmed.includes('"swagger"') || trimmed.includes('swagger:')) &&
      trimmed.includes('paths')
    ) {
      if (activeTab !== 'import_openapi') {
        setActiveTab('import_openapi');
        setAutoDetectMsg('✨ Detected OpenAPI / Swagger Specification!');
      }
      return;
    }

    // Postman detection
    if (trimmed.includes('"_postman_id"') || (trimmed.includes('"schema"') && trimmed.includes('getpostman.com')) || trimmed.includes('"info"') && trimmed.includes('"item"')) {
      if (activeTab !== 'import_postman') {
        setActiveTab('import_postman');
        setAutoDetectMsg('📦 Detected Postman Collection format!');
      }
      return;
    }
  };

  // File reader & Processor
  const processFile = (file: File) => {
    setErrorMsg('');
    setAutoDetectMsg('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setInputText(text);

      if (file.name.endsWith('.json') || file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        if (text.includes('openapi') || text.includes('swagger') || text.includes('"paths"')) {
          setActiveTab('import_openapi');
          setAutoDetectMsg('✨ Detected OpenAPI / Swagger File!');
        } else {
          setActiveTab('import_postman');
        }
      } else if (file.name.endsWith('.rest') || file.name.endsWith('.http')) {
        setActiveTab('import_rest');
      } else if (text.trim().toLowerCase().startsWith('curl')) {
        setActiveTab('import_curl');
        setAutoDetectMsg('⚡ Detected cURL command!');
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleProcessImport = () => {
    setErrorMsg('');
    if (!inputText.trim()) {
      setErrorMsg('Please paste or upload file content before clicking import.');
      return;
    }

    if (activeTab === 'import_rest') {
      try {
        const parsed = parseRestFileContent(inputText, fileName);
        if (!parsed.requests || parsed.requests.length === 0) {
          setErrorMsg(
            'Unable to import .rest file: No valid HTTP request blocks found. Ensure requests start with "METHOD URL" (e.g. GET https://api.example.com).'
          );
          return;
        }
        onImportRestFile(fileName, inputText);
        setSuccessMsg(`Imported file ${fileName} with ${parsed.requests.length} requests successfully!`);
        setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 1000);
      } catch (err: any) {
        setErrorMsg(`Unable to parse .rest file syntax: ${err.message || 'Check request formatting'}`);
      }
    } else if (activeTab === 'import_postman') {
      try {
        const json = JSON.parse(inputText);
        const { folders, files, error } = parsePostmanCollection(json);
        if (error || files.length === 0) {
          setErrorMsg(error || 'No valid HTTP request endpoints found in Postman collection JSON.');
          return;
        }
        onImportPostman(folders, files);
        setSuccessMsg(`Successfully imported ${files.length} REST files from Postman collection!`);
        setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 1000);
      } catch (e: any) {
        setErrorMsg(`Invalid JSON file format: ${e.message || 'Syntax error in collection JSON'}`);
      }
    } else if (activeTab === 'import_openapi') {
      try {
        const { folders, files, title, error } = parseOpenApiSpec(inputText);
        if (error || files.length === 0) {
          setErrorMsg(error || 'Failed to parse OpenAPI / Swagger specification. Check syntax.');
          return;
        }
        onImportPostman(folders, files);
        setSuccessMsg(`Successfully imported OpenAPI spec "${title || 'API Spec'}" with ${files.length} endpoint collections!`);
        setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 1000);
      } catch (e: any) {
        setErrorMsg(`Unable to process OpenAPI spec: ${e.message || 'Syntax error in OpenAPI document'}`);
      }
    } else if (activeTab === 'import_curl') {
      const parsed = parseCurlCommand(inputText);
      if (parsed) {
        onImportCurl(parsed);
        setSuccessMsg('Imported cURL command into Request Builder!');
        setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 1000);
      } else {
        setErrorMsg(
          'Invalid cURL command format. Ensure the command starts with "curl" followed by valid flags (e.g. curl -X GET https://api.example.com).'
        );
      }
    }
  };

  const handleExportPostman = () => {
    const projName = project?.name || 'Project';
    const projFiles = project?.files || [];
    const collectionData = exportToPostmanCollection(projName, projFiles);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(collectionData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${projName.toLowerCase().replace(/\s+/g, '_')}_postman_collection.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportWorkspaceJson = () => {
    const projName = project?.name || 'Project';
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project || {}, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${projName.toLowerCase().replace(/\s+/g, '_')}_workspace.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportRestFileBundle = () => {
    (project?.files || []).forEach((file) => {
      const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(file.rawContent);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', file.name);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (e.target as HTMLElement).tagName !== 'TEXTAREA')) {
        e.preventDefault();
        if (activeTab === 'export') {
          handleExportPostman();
        } else {
          handleProcessImport();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, activeTab, inputText, fileName, handleProcessImport]);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 ${
      isDarkMode ? 'bg-slate-950/80 backdrop-blur-sm' : 'bg-slate-900/40 backdrop-blur-sm'
    }`}>
      <div className={`border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/90'
        }`}>
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-emerald-500" />
            <h3 className={`font-bold text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Import / Export REST Suite</h3>
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

        {/* Tab Buttons */}
        <div className={`flex items-center px-4 border-b text-xs font-semibold overflow-x-auto ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('import_rest');
              setInputText('');
              setAutoDetectMsg('');
            }}
            className={`py-2.5 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'import_rest'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            .rest / .http File
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('import_openapi');
              setInputText('');
              setAutoDetectMsg('');
            }}
            className={`py-2.5 px-3.5 border-b-2 whitespace-nowrap flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeTab === 'import_openapi'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>OpenAPI / Swagger</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('import_postman');
              setInputText('');
              setAutoDetectMsg('');
            }}
            className={`py-2.5 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'import_postman'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Postman Collection (v2.1)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('import_curl');
              setInputText('');
              setAutoDetectMsg('');
            }}
            className={`py-2.5 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'import_curl'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            cURL Command
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-2.5 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Export Project
          </button>
        </div>

        {/* Body */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-4 flex-1 overflow-y-auto space-y-4 relative transition-colors ${
            isDragging ? 'bg-emerald-500/10 ring-2 ring-emerald-500/50' : ''
          }`}
        >
          {/* Auto detection notice */}
          {autoDetectMsg && (
            <div className={`p-2.5 border rounded-xl flex items-center space-x-2 text-xs animate-in fade-in ${
              isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="font-medium">{autoDetectMsg}</span>
            </div>
          )}

          {/* Error Alert Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start space-x-2.5 text-rose-300 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-rose-200">Import Failed</div>
                <div className="leading-relaxed text-rose-300">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Drag Overlay visual indicator */}
          {isDragging && (
            <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-500 rounded-xl space-y-3 ${
              isDarkMode ? 'bg-slate-900/95 text-slate-100' : 'bg-white/95 text-slate-900'
            }`}>
              <Upload className="w-12 h-12 text-emerald-500 animate-bounce" />
              <div className="text-center">
                <p className="text-sm font-bold text-emerald-600">Drop file anywhere to import</p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Supports OpenAPI JSON/YAML, .rest, Postman, or cURL</p>
              </div>
            </div>
          )}

          {activeTab === 'import_rest' && (
            <div className="space-y-3">
              {/* Drag & Drop Dropzone Box */}
              <label
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group ${
                  isDarkMode
                    ? 'border-slate-800 hover:border-emerald-500/60 bg-slate-950 hover:bg-slate-900/60'
                    : 'border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                <Upload className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform mb-1.5" />
                <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  Drag &amp; Drop <code className="text-emerald-500 font-mono">.rest / .http / .txt</code> file here
                </span>
                <span className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>or click to browse from device</span>
                <input
                  type="file"
                  accept=".rest,.http,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="flex items-center space-x-2">
                <label className={`text-xs font-semibold shrink-0 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>File Name:</label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-xs font-mono ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Paste or Edit .rest Syntax:</label>
                <textarea
                  value={inputText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  rows={8}
                  placeholder={`@baseUrl = https://api.example.com\n\n### Get Users\nGET {{baseUrl}}/users\nAccept: application/json`}
                  className={`w-full font-mono border rounded-xl p-3 text-xs leading-relaxed ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>
          )}

          {activeTab === 'import_openapi' && (
            <div className="space-y-3">
              {/* Drag & Drop Dropzone Box */}
              <label
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group ${
                  isDarkMode
                    ? 'border-slate-800 hover:border-emerald-500/60 bg-slate-950 hover:bg-slate-900/60'
                    : 'border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                <Sparkles className="w-6 h-6 text-amber-500 group-hover:scale-110 transition-transform mb-1.5" />
                <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  Drag &amp; Drop <code className="text-emerald-500 font-mono">OpenAPI / Swagger (JSON or YAML)</code> file here
                </span>
                <span className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Supports OpenAPI v3.0, v3.1, and Swagger v2.0 specs</span>
                <input
                  type="file"
                  accept=".json,.yaml,.yml,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Paste OpenAPI / Swagger JSON or YAML Spec:</label>
                <textarea
                  value={inputText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  rows={8}
                  placeholder={`{\n  "openapi": "3.0.0",\n  "info": { "title": "Petstore API", "version": "1.0" },\n  "paths": {\n    "/pets": {\n      "get": { "summary": "List pets", ... }\n    }\n  }\n}`}
                  className={`w-full font-mono border rounded-xl p-3 text-xs leading-relaxed ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>
          )}

          {activeTab === 'import_postman' && (
            <div className="space-y-3">
              {/* Drag & Drop Dropzone Box */}
              <label
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group ${
                  isDarkMode
                    ? 'border-slate-800 hover:border-emerald-500/60 bg-slate-950 hover:bg-slate-900/60'
                    : 'border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                <Upload className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform mb-1.5" />
                <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  Drag &amp; Drop <code className="text-emerald-500 font-mono">Postman Collection JSON</code> file here
                </span>
                <span className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>or click to choose file</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <textarea
                value={inputText}
                onChange={(e) => handleTextChange(e.target.value)}
                rows={8}
                placeholder={`Paste raw Postman Collection v2.1 JSON structure here...`}
                className={`w-full font-mono border rounded-xl p-3 text-xs leading-relaxed ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          )}

          {activeTab === 'import_curl' && (
            <div className="space-y-3">
              <label className={`text-xs font-semibold block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Paste Raw cURL Command:</label>
              <textarea
                value={inputText}
                onChange={(e) => handleTextChange(e.target.value)}
                rows={8}
                placeholder={`curl -X POST "https://api.example.com/v1/users" -H "Content-Type: application/json" -d '{"name": "John"}'`}
                className={`w-full font-mono border rounded-xl p-3 text-xs leading-relaxed ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4 py-4 text-center">
              <p className="text-xs text-slate-300">
                Choose an export format for <strong className="text-emerald-400">{project.name}</strong> or export all organizations:
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={handleExportRestFileBundle}
                  className="flex flex-col items-center justify-center p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-200 transition-colors space-y-2 group cursor-pointer"
                >
                  <FileCode className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs text-slate-100">.rest Files</span>
                  <span className="text-[10px] text-slate-400 font-mono">REST Client Syntax</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPostman}
                  className="flex flex-col items-center justify-center p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-200 transition-colors space-y-2 group cursor-pointer"
                >
                  <FileJson className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs text-slate-100">Postman v2.1</span>
                  <span className="text-[10px] text-slate-400 font-mono">Collection JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportWorkspaceJson}
                  className="flex flex-col items-center justify-center p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-200 transition-colors space-y-2 group cursor-pointer"
                >
                  <Download className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs text-slate-100">Project JSON</span>
                  <span className="text-[10px] text-slate-400 font-mono">Files & Envs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const rawData = localStorage.getItem('restpulse_organizations');
                    if (rawData) {
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(rawData);
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute('href', dataStr);
                      downloadAnchor.setAttribute('download', `restpulse_all_organizations_backup.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    } else {
                      alert('No saved organization data found.');
                    }
                  }}
                  className="flex flex-col items-center justify-center p-3.5 bg-slate-950 hover:bg-slate-800 border border-purple-500/30 hover:border-purple-500/60 rounded-xl text-slate-200 transition-colors space-y-2 group cursor-pointer"
                >
                  <FolderArchive className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs text-purple-300">All Orgs Backup</span>
                  <span className="text-[10px] text-slate-400 font-mono">Full Export JSON</span>
                </button>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono rounded-xl flex items-center space-x-2">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab !== 'export' && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProcessImport}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow"
            >
              Import Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
