import React, { useState, useRef, useEffect, useMemo } from 'react';
import { EnvVariable } from '../types';
import { Code, Terminal, Sparkles, Check, ChevronRight, Zap, Info, Play, Lightbulb } from 'lucide-react';

interface ScriptCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  type: 'pre' | 'post';
  envVariables?: EnvVariable[];
  fileVariables?: Record<string, string>;
  placeholder?: string;
  minRows?: number;
}

interface ScriptSuggestion {
  id: string;
  label: string;
  snippet: string;
  description: string;
  category: 'pm' | 'response' | 'request' | 'test' | 'console' | 'env' | 'js';
  prefixMatch: string[];
  type: 'pre' | 'post' | 'both';
  cursorOffset?: number; // Offset from end of inserted snippet where cursor should land
}

export const ScriptCodeEditor: React.FC<ScriptCodeEditorProps> = ({
  value,
  onChange,
  type,
  envVariables = [],
  fileVariables = {},
  placeholder,
  minRows = 10,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [cursorPos, setCursorPos] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Built-in suggestions database
  const baseSuggestions: ScriptSuggestion[] = useMemo(() => [
    // Pre & Post Request Env / Globals / Variables
    {
      id: 'pm-env-set',
      label: 'pm.environment.set(key, val)',
      snippet: 'pm.environment.set("variable_name", "value");',
      description: 'Set environment variable in active scope',
      category: 'env',
      prefixMatch: ['pm', 'pm.', 'pm.e', 'pm.env', 'pm.environment', 'set', 'env'],
      type: 'both',
      cursorOffset: 12,
    },
    {
      id: 'pm-env-get',
      label: 'pm.environment.get(key)',
      snippet: 'const val = pm.environment.get("variable_name");',
      description: 'Get value of an environment variable',
      category: 'env',
      prefixMatch: ['pm', 'pm.', 'pm.e', 'pm.env', 'pm.environment', 'get', 'env'],
      type: 'both',
      cursorOffset: 3,
    },
    {
      id: 'pm-globals-set',
      label: 'pm.globals.set(key, val)',
      snippet: 'pm.globals.set("global_name", "value");',
      description: 'Set global workspace variable',
      category: 'env',
      prefixMatch: ['pm', 'pm.', 'pm.g', 'pm.globals', 'globals'],
      type: 'both',
    },
    {
      id: 'pm-globals-get',
      label: 'pm.globals.get(key)',
      snippet: 'const globalVal = pm.globals.get("global_name");',
      description: 'Get value of a global variable',
      category: 'env',
      prefixMatch: ['pm', 'pm.', 'pm.g', 'pm.globals', 'globals'],
      type: 'both',
    },
    {
      id: 'pm-variables-get',
      label: 'pm.variables.get(key)',
      snippet: 'const myVar = pm.variables.get("var_name");',
      description: 'Get variable from any scope (env, file, collection)',
      category: 'env',
      prefixMatch: ['pm', 'pm.', 'pm.v', 'pm.variables', 'variables'],
      type: 'both',
    },

    // Request Headers & URL (Pre & Post)
    {
      id: 'pm-req-setheader',
      label: 'pm.request.setHeader(key, val)',
      snippet: 'pm.request.setHeader("Authorization", "Bearer " + token);',
      description: 'Set or update HTTP header on outgoing request',
      category: 'request',
      prefixMatch: ['pm', 'pm.', 'pm.r', 'pm.req', 'pm.request', 'setHeader', 'header'],
      type: 'pre',
    },
    {
      id: 'pm-req-header-add',
      label: 'pm.request.headers.add({key, val})',
      snippet: 'pm.request.headers.add({ key: "X-Custom-Header", value: "CustomValue" });',
      description: 'Add a new header to the request object',
      category: 'request',
      prefixMatch: ['pm', 'pm.', 'pm.r', 'pm.request', 'headers'],
      type: 'pre',
    },

    // Console Logging
    {
      id: 'console-log',
      label: 'console.log(...)',
      snippet: 'console.log("Debug message:", data);',
      description: 'Log values to pre/post execution console logs',
      category: 'console',
      prefixMatch: ['con', 'console', 'console.', 'log', 'pm.log'],
      type: 'both',
      cursorOffset: 2,
    },
    {
      id: 'console-error',
      label: 'console.error(...)',
      snippet: 'console.error("Script error occurred:", err);',
      description: 'Log error message to execution console',
      category: 'console',
      prefixMatch: ['con', 'console', 'console.', 'err', 'error'],
      type: 'both',
    },
    {
      id: 'console-warn',
      label: 'console.warn(...)',
      snippet: 'console.warn("Warning check:", val);',
      description: 'Log warning message to execution console',
      category: 'console',
      prefixMatch: ['con', 'console', 'console.', 'warn'],
      type: 'both',
    },

    // Post-Request Response Inspection & Testing
    {
      id: 'pm-resp-json',
      label: 'pm.response.json()',
      snippet: 'const jsonData = pm.response.json();',
      description: 'Parse JSON payload from response body',
      category: 'response',
      prefixMatch: ['pm', 'pm.', 'pm.res', 'pm.response', 'json', 'body'],
      type: 'post',
    },
    {
      id: 'pm-resp-text',
      label: 'pm.response.text()',
      snippet: 'const textBody = pm.response.text();',
      description: 'Get raw text string of response body',
      category: 'response',
      prefixMatch: ['pm', 'pm.', 'pm.res', 'pm.response', 'text'],
      type: 'post',
    },
    {
      id: 'pm-resp-status',
      label: 'pm.response.status',
      snippet: 'console.log("Status Code:", pm.response.status);',
      description: 'HTTP status code number (e.g. 200, 201, 400, 404)',
      category: 'response',
      prefixMatch: ['pm', 'pm.', 'pm.res', 'pm.response', 'status'],
      type: 'post',
    },
    {
      id: 'pm-resp-time',
      label: 'pm.response.responseTime',
      snippet: 'console.log("Response Time (ms):", pm.response.responseTime);',
      description: 'Response time in milliseconds',
      category: 'response',
      prefixMatch: ['pm', 'pm.', 'pm.res', 'pm.response', 'time', 'responseTime'],
      type: 'post',
    },

    // Test Assertions (Post-Request)
    {
      id: 'pm-test-block',
      label: 'pm.test("Name", function)',
      snippet: 'pm.test("Status code is 200", function () {\n  pm.expect(pm.response.status).to.equal(200);\n});',
      description: 'Create test assertion suite block',
      category: 'test',
      prefixMatch: ['pm', 'pm.', 'pm.t', 'pm.test', 'test'],
      type: 'post',
    },
    {
      id: 'pm-expect-equal',
      label: 'pm.expect(val).to.equal(expected)',
      snippet: 'pm.expect(pm.response.status).to.equal(200);',
      description: 'Assert actual value equals expected value',
      category: 'test',
      prefixMatch: ['pm', 'pm.', 'pm.e', 'pm.expect', 'expect', 'equal'],
      type: 'post',
    },
    {
      id: 'pm-expect-property',
      label: 'pm.expect(obj).to.have.property(prop)',
      snippet: 'const json = pm.response.json();\npm.expect(json).to.have.property("token");',
      description: 'Assert JSON response object contains a property',
      category: 'test',
      prefixMatch: ['pm', 'pm.', 'pm.e', 'pm.expect', 'property', 'has'],
      type: 'post',
    },
    {
      id: 'pm-expect-type',
      label: 'pm.expect(val).to.be.a("string")',
      snippet: 'const json = pm.response.json();\npm.expect(json.id).to.be.a("number");',
      description: 'Assert value data type (string, number, array, object, boolean)',
      category: 'test',
      prefixMatch: ['pm', 'pm.', 'pm.e', 'pm.expect', 'type', 'be.a'],
      type: 'post',
    },
    {
      id: 'pm-expect-time',
      label: 'pm.expect(time).to.be.below(500)',
      snippet: 'pm.expect(pm.response.responseTime).to.be.below(500);',
      description: 'Assert response speed under millisecond threshold',
      category: 'test',
      prefixMatch: ['pm', 'pm.', 'pm.e', 'pm.expect', 'below', 'time'],
      type: 'post',
    },

    // Common JS Utilities
    {
      id: 'js-json-parse',
      label: 'JSON.parse(string)',
      snippet: 'const parsed = JSON.parse(jsonString);',
      description: 'Convert JSON string into JS Object',
      category: 'js',
      prefixMatch: ['json', 'json.', 'parse'],
      type: 'both',
    },
    {
      id: 'js-json-stringify',
      label: 'JSON.stringify(object)',
      snippet: 'const str = JSON.stringify(dataObj, null, 2);',
      description: 'Convert JS Object into formatted JSON string',
      category: 'js',
      prefixMatch: ['json', 'json.', 'stringify'],
      type: 'both',
    },
    {
      id: 'js-date-now',
      label: 'Date.now() / ISO String',
      snippet: 'const timestamp = new Date().toISOString();',
      description: 'Generate ISO 8601 timestamp string',
      category: 'js',
      prefixMatch: ['date', 'time', 'iso', 'timestamp'],
      type: 'both',
    },
  ], []);

  // Dynamic suggestions for defined environment variables
  const envSuggestions: ScriptSuggestion[] = useMemo(() => {
    const list: ScriptSuggestion[] = [];
    envVariables.forEach((env) => {
      if (!env.key) return;
      list.push({
        id: `env-get-${env.key}`,
        label: `pm.environment.get("${env.key}")`,
        snippet: `pm.environment.get("${env.key}")`,
        description: `Get environment variable '${env.key}' (current: ${env.value || 'empty'})`,
        category: 'env',
        prefixMatch: ['pm', 'pm.e', 'pm.env', env.key.toLowerCase()],
        type: 'both',
      });
      list.push({
        id: `env-set-${env.key}`,
        label: `pm.environment.set("${env.key}", val)`,
        snippet: `pm.environment.set("${env.key}", "newValue");`,
        description: `Set value for environment variable '${env.key}'`,
        category: 'env',
        prefixMatch: ['pm', 'pm.e', 'pm.env', env.key.toLowerCase()],
        type: 'both',
      });
    });
    return list;
  }, [envVariables]);

  const allSuggestions = useMemo(() => {
    const combined = [...baseSuggestions, ...envSuggestions];
    return combined.filter((s) => s.type === 'both' || s.type === type);
  }, [baseSuggestions, envSuggestions, type]);

  // Compute active word token at current cursor position
  const textBeforeCursor = value.slice(0, cursorPos);
  const currentLine = textBeforeCursor.split('\n').pop() || '';
  const currentToken = useMemo(() => {
    const match = currentLine.match(/([a-zA-Z0-9_.$]+)$/);
    return match ? match[1] : '';
  }, [currentLine]);

  // Filtered suggestions for autocomplete dropdown
  const matchingSuggestions = useMemo(() => {
    if (!currentToken && !searchFilter && activeCategoryFilter === 'all') {
      return allSuggestions;
    }

    const query = searchFilter || currentToken.toLowerCase();
    if (!query && activeCategoryFilter === 'all') return allSuggestions;

    return allSuggestions.filter((item) => {
      const matchCat = activeCategoryFilter === 'all' || item.category === activeCategoryFilter;
      if (!matchCat) return false;

      if (!query) return true;

      const labelMatch = item.label.toLowerCase().includes(query);
      const descMatch = item.description.toLowerCase().includes(query);
      const prefixMatch = item.prefixMatch.some((p) => p.toLowerCase().includes(query) || query.startsWith(p.toLowerCase()));
      const snippetMatch = item.snippet.toLowerCase().includes(query);

      return labelMatch || descMatch || prefixMatch || snippetMatch;
    });
  }, [allSuggestions, currentToken, searchFilter, activeCategoryFilter]);

  // Reset selected index when matching list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [matchingSuggestions.length, currentToken, searchFilter, activeCategoryFilter]);

  // Insert a snippet at current cursor or replacing current token
  const insertSnippet = (suggestion: ScriptSuggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value + (value ? '\n' : '') + suggestion.snippet);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Determine how much of the token before cursor to replace
    let replaceStart = start;
    if (currentToken && textBeforeCursor.endsWith(currentToken)) {
      replaceStart = start - currentToken.length;
    }

    const before = value.slice(0, replaceStart);
    const after = value.slice(end);

    const newValue = before + suggestion.snippet + after;
    onChange(newValue);

    setShowSuggestions(false);
    setSearchFilter('');

    // Focus and position cursor
    setTimeout(() => {
      textarea.focus();
      let newCursorPos = before.length + suggestion.snippet.length;
      if (suggestion.cursorOffset) {
        newCursorPos -= suggestion.cursorOffset;
      }
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 15);
  };

  // Keyboard navigation & Shortcuts inside editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key handling for code indentation or suggestion pick
    if (e.key === 'Tab') {
      if (showSuggestions && matchingSuggestions.length > 0) {
        e.preventDefault();
        insertSnippet(matchingSuggestions[selectedIndex]);
        return;
      }

      // Standard tab indentation (2 spaces)
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
      return;
    }

    // Support Ctrl+Space, Cmd+Space, Option+Space for both Mac and Windows/Linux
    const isSpace = e.key === ' ' || e.code === 'Space' || e.keyCode === 32;
    const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

    if (hasModifier && isSpace) {
      e.preventDefault();
      setShowSuggestions((prev) => !prev);
      return;
    }

    // Navigation when suggestions popup is visible
    if (showSuggestions && matchingSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % matchingSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + matchingSuggestions.length) % matchingSuggestions.length);
        return;
      }
      if (e.key === 'Enter') {
        // If ctrl+enter or shift+enter, let line break happen unless selected
        if (!e.ctrlKey && !e.shiftKey) {
          e.preventDefault();
          insertSnippet(matchingSuggestions[selectedIndex]);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    // Auto trigger suggestion popup when typing pm. or console.
    if (e.key === '.') {
      setTimeout(() => {
        setShowSuggestions(true);
      }, 50);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setCursorPos(e.target.selectionStart);

    // Auto show suggestions if currentToken is interesting
    const token = e.target.value.slice(0, e.target.selectionStart).split('\n').pop()?.match(/([a-zA-Z0-9_.$]+)$/)?.[1] || '';
    if (token.startsWith('pm') || token.startsWith('con') || token.startsWith('json')) {
      if (!showSuggestions) setShowSuggestions(true);
    }
  };

  // Line count calculations
  const lineCount = useMemo(() => {
    const count = (value || '').split('\n').length;
    return Math.max(count, minRows);
  }, [value, minRows]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }, [lineCount]);

  const colorTheme = type === 'pre' ? {
    border: 'border-amber-500/30',
    focusBorder: 'focus:border-amber-500/60',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    buttonBg: 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700',
    text: 'text-amber-200',
    activeTab: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    highlight: 'text-amber-400',
  } : {
    border: 'border-teal-500/30',
    focusBorder: 'focus:border-teal-500/60',
    badgeBg: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    buttonBg: 'bg-slate-800 hover:bg-slate-700 text-teal-300 border-slate-700',
    text: 'text-teal-200',
    activeTab: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    highlight: 'text-teal-400',
  };

  return (
    <div ref={containerRef} className="space-y-3 font-sans">
      {/* Quick Snippet Pills & Helper Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center space-x-2">
          <span className={`text-xs font-bold flex items-center space-x-1.5 px-2 py-0.5 rounded border ${colorTheme.badgeBg}`}>
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{type === 'pre' ? 'Pre-Request Script' : 'Post-Request Script'}</span>
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Press <kbd className="px-1 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px] font-mono">Ctrl / ⌘ / ⌥</kbd> + <kbd className="px-1 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px] font-mono">Space</kbd> for Intellisense suggestions
          </span>
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5 scrollbar-none">
          <button
            type="button"
            onClick={() => setShowSuggestions((prev) => !prev)}
            className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors flex items-center space-x-1 ${
              showSuggestions ? colorTheme.activeTab : colorTheme.buttonBg
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{showSuggestions ? 'Hide Auto-complete' : 'Auto-complete'}</span>
          </button>

          {type === 'pre' && (
            <>
              <button
                type="button"
                onClick={() => insertSnippet(baseSuggestions.find((s) => s.id === 'pm-env-set')!)}
                className={`text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors ${colorTheme.buttonBg}`}
              >
                + Set Env Var
              </button>
              <button
                type="button"
                onClick={() => insertSnippet(baseSuggestions.find((s) => s.id === 'pm-req-setheader')!)}
                className={`text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors ${colorTheme.buttonBg}`}
              >
                + Set Header
              </button>
            </>
          )}

          {type === 'post' && (
            <>
              <button
                type="button"
                onClick={() => insertSnippet(baseSuggestions.find((s) => s.id === 'pm-test-block')!)}
                className={`text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors ${colorTheme.buttonBg}`}
              >
                + Status 200 Test
              </button>
              <button
                type="button"
                onClick={() => insertSnippet(baseSuggestions.find((s) => s.id === 'pm-resp-json')!)}
                className={`text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors ${colorTheme.buttonBg}`}
              >
                + Response JSON
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => insertSnippet(baseSuggestions.find((s) => s.id === 'console-log')!)}
            className={`text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors ${colorTheme.buttonBg}`}
          >
            + Console Log
          </button>
        </div>
      </div>

      {/* Main Code Editor Area with Line Numbers & Suggestions Drawer */}
      <div className="relative flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner focus-within:border-emerald-500/50 transition-colors">
        {/* Line Numbers Column */}
        <div className="select-none py-3 px-2 bg-slate-900/60 border-r border-slate-850 text-right text-slate-600 font-mono text-xs leading-relaxed min-w-[2.5rem]">
          {lineNumbers.map((num) => (
            <div key={num}>{num}</div>
          ))}
        </div>

        {/* Textarea Editor */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onClick={(e) => setCursorPos(e.currentTarget.selectionStart)}
            onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart)}
            rows={lineCount}
            spellCheck={false}
            className={`w-full bg-transparent p-3 font-mono text-xs ${colorTheme.text} leading-relaxed focus:outline-none resize-y min-h-[160px]`}
            placeholder={
              placeholder ||
              (type === 'pre'
                ? `// Pre-Request Script\npm.environment.set("timestamp", Date.now().toString());\npm.request.setHeader("X-Client-Key", "abc123");\nconsole.log("Pre-request script executed");`
                : `// Post-Request Script & Tests\npm.test("Status is 200", function () {\n  pm.expect(pm.response.status).to.equal(200);\n});\nconst json = pm.response.json();\npm.environment.set("bearer_token", json.token);`)
            }
          />
        </div>
      </div>

      {/* INTELLISENSE & SUGGESTION POPUP / PANEL */}
      {showSuggestions && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Zap className={`w-4 h-4 ${colorTheme.highlight}`} />
              <span className="text-xs font-bold text-slate-200">
                Script Intellisense & Snippet Suggestions
              </span>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                {matchingSuggestions.length} items
              </span>
            </div>

            {/* Filter Input */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search methods (e.g. env, test, json, header)..."
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-48 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSuggestions(false)}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs font-mono scrollbar-none">
            {[
              { id: 'all', label: 'All' },
              { id: 'env', label: 'Variables (pm.env)' },
              { id: 'response', label: 'Response (pm.res)' },
              { id: 'request', label: 'Request (pm.req)' },
              { id: 'test', label: 'Tests (pm.test)' },
              { id: 'console', label: 'Console' },
              { id: 'js', label: 'JS Utilities' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-md transition-colors shrink-0 ${
                  activeCategoryFilter === cat.id
                    ? `${colorTheme.activeTab} font-semibold`
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Suggestion Items List */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-850">
            {matchingSuggestions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 font-mono">
                No matching code suggestions found for "{searchFilter || currentToken}".
              </div>
            ) : (
              matchingSuggestions.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => insertSnippet(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-colors flex items-start justify-between group ${
                      isSelected
                        ? 'bg-slate-800/90 border border-slate-700'
                        : 'hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <div className="space-y-1 pr-2 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`font-mono text-xs font-bold ${isSelected ? colorTheme.highlight : 'text-slate-200'}`}>
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {item.category}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-snug">
                        {item.description}
                      </p>

                      <div className="p-1.5 bg-slate-950 rounded border border-slate-850 font-mono text-[11px] text-slate-300 opacity-90 group-hover:opacity-100 overflow-x-auto whitespace-pre">
                        {item.snippet}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`text-xs font-mono shrink-0 px-2.5 py-1 rounded-md flex items-center space-x-1 ${
                        isSelected ? colorTheme.activeTab : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span>Insert</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-800">
            <span>Tip: Use <kbd className="text-slate-300">↑</kbd> <kbd className="text-slate-300">↓</kbd> to select and <kbd className="text-slate-300">Enter</kbd> or <kbd className="text-slate-300">Tab</kbd> to insert.</span>
            <span>All scripts run in isolated JS environment</span>
          </div>
        </div>
      )}
    </div>
  );
};
