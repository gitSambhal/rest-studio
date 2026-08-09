import React, { useState, useEffect } from 'react';
import { X, Sliders, Globe, Shield, Check, Server, Zap } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  isDarkMode,
  onToggleDarkMode,
  showToast,
}: SettingsModalProps) {
  const [requestMode, setRequestMode] = useState<'auto' | 'direct' | 'proxy'>(() => {
    return (localStorage.getItem('reststudio_request_mode') as 'auto' | 'direct' | 'proxy') || 'auto';
  });
  const [customProxyUrl, setCustomProxyUrl] = useState<string>(() => {
    return localStorage.getItem('reststudio_custom_proxy_url') || '';
  });

  useEffect(() => {
    if (isOpen) {
      setRequestMode((localStorage.getItem('reststudio_request_mode') as any) || 'auto');
      setCustomProxyUrl(localStorage.getItem('reststudio_custom_proxy_url') || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('reststudio_request_mode', requestMode);
    localStorage.setItem('reststudio_custom_proxy_url', customProxyUrl.trim());
    showToast('success', 'Settings Saved', 'Request execution configuration updated.');
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in ${
      isDarkMode ? 'bg-slate-950/80 backdrop-blur-sm' : 'bg-slate-900/40 backdrop-blur-sm'
    }`}>
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl border ${
              isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}>
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Workspace Settings</h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Configure request execution mode and CORS proxy settings</p>
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

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Section 1: Request Execution Mode */}
          <div className="space-y-3">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${
              isDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>Request Execution Engine</span>
            </label>
            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Select how RestStudio dispatches HTTP requests to target endpoints.
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Auto */}
              <label
                onClick={() => setRequestMode('auto')}
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  requestMode === 'auto'
                    ? isDarkMode
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-slate-100'
                      : 'bg-emerald-50/90 border-emerald-500 text-slate-900 shadow-sm'
                    : isDarkMode
                      ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/80'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${
                  requestMode === 'auto'
                    ? isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200/80 text-slate-500'
                }`}>
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Auto (Server Proxy → Direct Client Fallback)</span>
                    {requestMode === 'auto' && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Recommended. Routes via server proxy when available, and automatically falls back to direct browser fetch if the proxy is unreachable.
                  </p>
                </div>
              </label>

              {/* Option 2: Direct Client */}
              <label
                onClick={() => setRequestMode('direct')}
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  requestMode === 'direct'
                    ? isDarkMode
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-slate-100'
                      : 'bg-emerald-50/90 border-emerald-500 text-slate-900 shadow-sm'
                    : isDarkMode
                      ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/80'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${
                  requestMode === 'direct'
                    ? isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200/80 text-slate-500'
                }`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Direct Client-Side Fetch</span>
                    {requestMode === 'direct' && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Executes HTTP requests directly from the user browser without calling any server endpoint.
                  </p>
                </div>
              </label>

              {/* Option 3: Proxy Only */}
              <label
                onClick={() => setRequestMode('proxy')}
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  requestMode === 'proxy'
                    ? isDarkMode
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-slate-100'
                      : 'bg-emerald-50/90 border-emerald-500 text-slate-900 shadow-sm'
                    : isDarkMode
                      ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/80'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${
                  requestMode === 'proxy'
                    ? isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200/80 text-slate-500'
                }`}>
                  <Server className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Server Proxy Only</span>
                    {requestMode === 'proxy' && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Routes all requests exclusively through the backend proxy server.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Custom Proxy Endpoint */}
          <div className={`space-y-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${
              isDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <Shield className="w-4 h-4 text-sky-500" />
              <span>Custom CORS Proxy URL (Optional)</span>
            </label>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Specify a custom CORS proxy server URL if targeting APIs that block cross-origin browser requests.
            </p>
            <input
              type="text"
              value={customProxyUrl}
              onChange={(e) => setCustomProxyUrl(e.target.value)}
              placeholder="e.g. https://my-cors-proxy.example.com/proxy"
              className={`w-full rounded-lg px-3 py-2 text-xs font-mono border focus:outline-none focus:border-emerald-500/50 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
              }`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-3.5 border-t flex items-center justify-between ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <button
            type="button"
            onClick={onToggleDarkMode}
            className={`text-xs transition-colors cursor-pointer ${
              isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Toggle Theme ({isDarkMode ? 'Dark' : 'Light'})
          </button>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-md"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
