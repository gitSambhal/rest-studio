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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Workspace Settings</h2>
              <p className="text-xs text-slate-400">Configure request execution mode and static deployment behavior</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Section 1: Request Execution Mode */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Request Execution Engine (Netlify / Static Support)</span>
            </label>
            <p className="text-xs text-slate-400 leading-relaxed">
              When deployed on static hosts like Netlify (without backend functions), requests run directly from your browser.
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Auto */}
              <label
                onClick={() => setRequestMode('auto')}
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  requestMode === 'auto'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-slate-100'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${requestMode === 'auto' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Auto (Server Proxy -&gt; Direct Client Fallback)</span>
                    {requestMode === 'auto' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Recommended. Tries backend proxy if available; automatically falls back to direct browser fetch on static hosts like Netlify.
                  </p>
                </div>
              </label>

              {/* Option 2: Direct Client */}
              <label
                onClick={() => setRequestMode('direct')}
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  requestMode === 'direct'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-slate-100'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${requestMode === 'direct' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Direct Client-Side Fetch (100% Static / Netlify)</span>
                    {requestMode === 'direct' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sends HTTP requests directly from the browser without calling any backend server.
                  </p>
                </div>
              </label>

              {/* Option 3: Proxy Only */}
              <label
                onClick={() => setRequestMode('proxy')}
                className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  requestMode === 'proxy'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-slate-100'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${requestMode === 'proxy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Server className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Server Proxy Only</span>
                    {requestMode === 'proxy' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Forces all requests to route through backend proxy endpoint. (Fails on static hosts without server).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Custom Proxy Endpoint */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <Shield className="w-4 h-4 text-sky-400" />
              <span>Custom CORS Proxy URL (Optional)</span>
            </label>
            <p className="text-xs text-slate-400">
              Specify a custom CORS proxy server URL if targeting APIs that block cross-origin browser requests.
            </p>
            <input
              type="text"
              value={customProxyUrl}
              onChange={(e) => setCustomProxyUrl(e.target.value)}
              placeholder="e.g. https://my-cors-proxy.example.com/proxy"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Toggle Theme ({isDarkMode ? 'Dark' : 'Light'})
          </button>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
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
