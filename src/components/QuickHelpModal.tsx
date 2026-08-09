import React, { useState } from 'react';
import { highlightJs, highlightRestSyntax } from '../utils/syntaxHighlighter';
import {
  X,
  Keyboard,
  Layers,
  ShieldCheck,
  Code2,
  FileText,
  Split,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';

interface QuickHelpModalProps {
  onClose: () => void;
}

export const QuickHelpModal: React.FC<QuickHelpModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'env' | 'auth' | 'syntax' | 'scripting'>('shortcuts');
  const [searchQuery, setSearchQuery] = useState('');

  const shortcuts = [
    { key: 'Ctrl + Enter / Cmd + Enter', desc: 'Send current API request immediately', category: 'Request' },
    { key: 'Ctrl + Space', desc: 'Trigger Environment Variable autocomplete popup', category: 'Editor' },
    { key: 'Type {{', desc: 'Auto-open environment variable suggestions in input fields', category: 'Editor' },
    { key: 'Tab', desc: 'Navigate to next field or accept autocomplete suggestion', category: 'General' },
    { key: 'Esc', desc: 'Dismiss active popovers or close modal dialogs', category: 'General' },
  ];

  const filteredShortcuts = shortcuts.filter(
    (s) => s.desc.toLowerCase().includes(searchQuery.toLowerCase()) || s.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center space-x-2">
                <span>RestStudio Quick Help & Reference</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                  v1.0
                </span>
              </h3>
              <p className="text-xs text-slate-400">Everything you need to master request building, environments, and scripting</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Close Quick Help (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 bg-slate-950/30 border-b border-slate-800/80 flex items-center space-x-1 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'shortcuts'
                ? 'bg-slate-800/80 text-emerald-400 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/30'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Shortcuts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('env')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'env'
                ? 'bg-slate-800/80 text-emerald-400 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/30'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3-Level Env Scope</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'auth'
                ? 'bg-slate-800/80 text-emerald-400 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/30'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Inherited Auth</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('syntax')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'syntax'
                ? 'bg-slate-800/80 text-emerald-400 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/30'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>.rest Syntax</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scripting')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'scripting'
                ? 'bg-slate-800/80 text-emerald-400 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/30'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Scripting Engine</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">Keyboard Shortcuts & Efficiency Tricks</h4>
                  <p className="text-xs text-slate-400">Boost your productivity with quick keyboard shortcuts</p>
                </div>

                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search shortcuts..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredShortcuts.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-medium text-slate-200">{s.desc}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-mono">{s.category}</div>
                    </div>
                    <kbd className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-xs font-bold rounded-lg shadow-sm">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: ENV HIERARCHY */}
          {activeTab === 'env' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>3-Level Environment Variable Precedence</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  RestStudio uses a strict 3-level scope hierarchy. When a variable is referenced as <code className="text-emerald-400 font-mono">{`{{variable}}`}</code>, the system resolves it according to precedence (highest priority first):
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start space-x-3">
                  <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-bold font-mono text-[11px] rounded shrink-0">1. Highest</span>
                  <div>
                    <div className="text-xs font-bold text-emerald-300">File Level Variables (@var = value)</div>
                    <div className="text-[11px] text-slate-300">Defined directly inside a .rest file header. Overrides all external environment settings for requests in that file.</div>
                  </div>
                </div>

                <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-start space-x-3">
                  <span className="px-2 py-0.5 bg-indigo-500 text-white font-bold font-mono text-[11px] rounded shrink-0">2. Medium</span>
                  <div>
                    <div className="text-xs font-bold text-indigo-300">Project Environment Variables (Dev / Staging / Prod)</div>
                    <div className="text-[11px] text-slate-300">Environment variables belonging to the active project environment selected in the header.</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex items-start space-x-3">
                  <span className="px-2 py-0.5 bg-slate-700 text-slate-200 font-bold font-mono text-[11px] rounded shrink-0">3. Global</span>
                  <div>
                    <div className="text-xs font-bold text-slate-300">Global Fallback Variables</div>
                    <div className="text-[11px] text-slate-400">Global defaults available across all organizations, projects, and requests.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INHERITED AUTH */}
          {activeTab === 'auth' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Project & File Level Auth Inheritance</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Avoid repeating authentication credentials across dozens of requests by using Auth Inheritance.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
                  <Zap className="w-4 h-4" />
                  <span>How to use Inherited Auth:</span>
                </div>
                <ol className="list-decimal list-inside text-xs text-slate-300 space-y-2 leading-relaxed">
                  <li>In any request, navigate to the <strong className="text-slate-100">Auth</strong> tab.</li>
                  <li>Select the <strong className="text-emerald-400">Inherit Auth</strong> radio option.</li>
                  <li>The request automatically uses the Bearer Token, Basic Auth, or API Key configured at the Project level.</li>
                  <li>Variables like <code className="text-emerald-400 font-mono">{`{{authToken}}`}</code> inside Project Auth are dynamically resolved at request runtime.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 4: .REST SYNTAX */}
          {activeTab === 'syntax' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Standard .rest File Syntax</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  RestStudio supports standard VS Code REST Client / IntelliJ HTTP syntax.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 leading-relaxed overflow-x-auto space-y-2">
                <div className="text-slate-500"># Variable Definition at top of file</div>
                <div className="text-amber-400">@baseUrl = https://api.example.com</div>
                <div className="text-amber-400">@token = secret_12345</div>
                <br />
                <div className="text-slate-500">### 1. Get User Details</div>
                <div className="text-emerald-400">GET {`{{baseUrl}}`}/v1/users/me</div>
                <div>Authorization: Bearer {`{{token}}`}</div>
                <div>Accept: application/json</div>
                <br />
                <div className="text-slate-500">### 2. Create New Item</div>
                <div className="text-teal-400">POST {`{{baseUrl}}`}/v1/items</div>
                <div>Content-Type: application/json</div>
                <br />
                <div>{`{`}</div>
                <div className="pl-4">{`"name": "Sample Item",`}</div>
                <div className="pl-4">{`"status": "active"`}</div>
                <div>{`}`}</div>
              </div>
            </div>
          )}

          {/* TAB 5: SCRIPTING */}
          {activeTab === 'scripting' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <span>Pre-request & Test Scripting API</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Write JavaScript scripts before sending requests or assertion tests after receiving responses.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-emerald-400 font-bold font-sans">Pre-Request Script Methods</div>
                  <pre className="text-slate-300 font-mono text-xs whitespace-pre-wrap">
                    {highlightJs(`pm.environment.set('token', 'newVal');\npm.environment.get('baseUrl');\npm.request.setHeader('X-Trace', Date.now());`)}
                  </pre>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-emerald-400 font-bold font-sans">Post-Request Test Assertions</div>
                  <pre className="text-slate-300 font-mono text-xs whitespace-pre-wrap">
                    {highlightJs(`pm.test('Status is 200', () => {\n  pm.expect(pm.response.status).to.equal(200);\n});`)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 shrink-0 gap-2">
          <div className="flex items-center space-x-2">
            <Split className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Developed by <a href="https://suhail.top" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-semibold">Suhail Akhtar (suhail.top)</a> • Offline-first workspace</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg hover:bg-emerald-400 transition-colors cursor-pointer shrink-0"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
};
