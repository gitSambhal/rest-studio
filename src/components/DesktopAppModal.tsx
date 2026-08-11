import React, { useState, useEffect } from 'react';
import {
  Monitor,
  X,
  Copy,
  Check,
  Terminal,
  Zap,
  ShieldCheck,
  Cpu,
  Globe,
  Sparkles,
  Feather,
  Layers,
  ArrowRight,
  HardDrive,
} from 'lucide-react';

interface DesktopAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const DesktopAppModal: React.FC<DesktopAppModalProps> = ({
  isOpen,
  onClose,
  isDarkMode = true,
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tauri' | 'wails' | 'neutralino'>('tauri');
  const [isNativeActive, setIsNativeActive] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)) {
      setIsNativeActive(true);
    }
  }, []);

  if (!isOpen) return null;

  const handleCopy = (cmd: string, key: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border flex flex-col max-h-[92vh] ${
          isDarkMode
            ? 'bg-slate-900 border-slate-700/80 text-slate-100 shadow-emerald-950/20'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
        }`}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Feather className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Lightweight Desktop App Alternatives</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono px-2 py-0.5 rounded-full font-semibold">
                  ~3 MB Tiny Binaries
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Replace 100MB+ Electron apps with ultra-fast native wrappers (Tauri, Wails, Neutralino)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tauri */}
            <button
              type="button"
              onClick={() => setActiveTab('tauri')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                activeTab === 'tauri'
                  ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-400 uppercase tracking-wider font-mono">Tauri</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.5 rounded">
                  ★ Recommended
                </span>
              </div>
              <div className="mt-2 text-lg font-extrabold text-white">~3 MB</div>
              <div className="text-[10px] text-slate-400 font-mono">Rust + System WebView</div>
              <div className="mt-1 text-[10px] text-emerald-300">RAM: ~30MB</div>
            </button>

            {/* Neutralino */}
            <button
              type="button"
              onClick={() => setActiveTab('neutralino')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                activeTab === 'neutralino'
                  ? 'bg-teal-950/50 border-teal-500 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-teal-400 uppercase tracking-wider font-mono">Neutralino</span>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 font-mono px-1.5 py-0.5 rounded">
                  Smallest
                </span>
              </div>
              <div className="mt-2 text-lg font-extrabold text-white">~2 MB</div>
              <div className="text-[10px] text-slate-400 font-mono">C/C++ + Lightweight IPC</div>
              <div className="mt-1 text-[10px] text-teal-300">RAM: ~20MB</div>
            </button>

            {/* Wails */}
            <button
              type="button"
              onClick={() => setActiveTab('wails')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                activeTab === 'wails'
                  ? 'bg-sky-950/50 border-sky-500 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-sky-400 uppercase tracking-wider font-mono">Wails</span>
                <span className="text-[10px] bg-sky-500/20 text-sky-300 font-mono px-1.5 py-0.5 rounded">
                  Go Engine
                </span>
              </div>
              <div className="mt-2 text-lg font-extrabold text-white">~10 MB</div>
              <div className="text-[10px] text-slate-400 font-mono">Go + Webview2 / WebKit</div>
              <div className="mt-1 text-[10px] text-sky-300">RAM: ~40MB</div>
            </button>
          </div>

          {/* Active Tab Configuration Details */}
          {activeTab === 'tauri' && (
            <div className="bg-slate-950 border border-emerald-500/40 p-4 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Feather className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm">Tauri (Rust Native Desktop Wrapper)</h3>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono px-2 py-0.5 rounded">
                  Configured in /src-tauri
                </span>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed">
                <strong>Tauri</strong> uses your operating system&apos;s native web engine (WebKit on macOS/Linux, Edge WebView2 on Windows) alongside a blazingly fast Rust backend. Output binaries are tiny (<strong>~3MB to 8MB</strong> total) and use 80% less memory than Electron.
              </p>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">1. Run Tauri in Live Development:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('npm run tauri:dev', 'tauri_dev')}
                    className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded cursor-pointer transition-colors"
                  >
                    {copiedCmd === 'tauri_dev' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedCmd === 'tauri_dev' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <code className="text-emerald-400 font-mono text-xs block bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  npm run tauri:dev
                </code>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="font-bold text-slate-200">2. Build Lightweight Native Binary Installer:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('npm run build:tauri', 'tauri_build')}
                    className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded cursor-pointer transition-colors"
                  >
                    {copiedCmd === 'tauri_build' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedCmd === 'tauri_build' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <code className="text-emerald-400 font-mono text-xs block bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  npm run build:tauri
                </code>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 pt-1 font-mono">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-300 font-bold block">Binary Size</span>
                  <span className="text-emerald-400 font-bold text-xs">~3.5 MB</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-300 font-bold block">Memory RAM</span>
                  <span className="text-emerald-400 font-bold text-xs">~30 MB</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-300 font-bold block">Security</span>
                  <span className="text-emerald-400 font-bold text-xs">Rust Safe Memory</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'neutralino' && (
            <div className="bg-slate-950 border border-teal-500/40 p-4 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-teal-400" />
                  <h3 className="font-bold text-white text-sm">Neutralinojs (Ultra Lightweight C/C++)</h3>
                </div>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono px-2 py-0.5 rounded">
                  Configured in neutralino.config.json
                </span>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed">
                <strong>Neutralinojs</strong> provides a portable, lightweight C++ process that communicates with the system web browser engine via WebSocket. It generates the smallest possible desktop executable files (<strong>~2MB</strong>).
              </p>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">1. Run Neutralino in Live Dev Mode:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('npm run neu:dev', 'neu_dev')}
                    className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded cursor-pointer transition-colors"
                  >
                    {copiedCmd === 'neu_dev' ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedCmd === 'neu_dev' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <code className="text-teal-400 font-mono text-xs block bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  npm run neu:dev
                </code>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="font-bold text-slate-200">2. Build Ultra-Lightweight Neutralino Package (~2MB):</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('npm run build:neu', 'neu_build')}
                    className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded cursor-pointer transition-colors"
                  >
                    {copiedCmd === 'neu_build' ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedCmd === 'neu_build' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <code className="text-teal-400 font-mono text-xs block bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  npm run build:neu
                </code>
              </div>
            </div>
          )}

          {activeTab === 'wails' && (
            <div className="bg-slate-950 border border-sky-500/40 p-4 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Globe className="w-5 h-5 text-sky-400" />
                  <h3 className="font-bold text-white text-sm">Wails (Go Language Desktop Wrapper)</h3>
                </div>
                <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono px-2 py-0.5 rounded">
                  Go Backend + Native Webview
                </span>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed">
                <strong>Wails</strong> is a popular Go alternative to Electron. It compiles your frontend into a single native Go binary (<strong>~10MB</strong>) with native HTTP capabilities and zero node runtime bloat.
              </p>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">Build Wails App:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('wails build', 'wails_cmd')}
                    className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded cursor-pointer transition-colors"
                  >
                    {copiedCmd === 'wails_cmd' ? <Check className="w-3.5 h-3.5 text-sky-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedCmd === 'wails_cmd' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <code className="text-sky-400 font-mono text-xs block bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  wails build
                </code>
              </div>
            </div>
          )}

          {/* Quick Setup Guide for Tauri */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-xl space-y-2">
            <h4 className="font-bold text-emerald-400 text-xs flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>How to build your ~3MB Tauri Desktop App</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
              <li>Ensure Rust is installed on your machine (<code className="text-emerald-300 font-mono">curl --proto &apos;=https&apos; --tlsv1.2 -sSf https://sh.rustup.rs | sh</code> or via Homebrew/Installer).</li>
              <li>Clone or export your RestStudio project folder.</li>
              <li>Run <code className="text-emerald-300 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">npm run build:tauri</code> to produce your tiny ~3MB desktop installer!</li>
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
            <span>App Identifier:</span>
            <code className="text-emerald-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-bold">top.suhail.rest-studio</code>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
