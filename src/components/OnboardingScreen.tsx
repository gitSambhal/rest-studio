import React from 'react';
import { Send, Upload, Sparkles, Code2, Globe } from 'lucide-react';

interface OnboardingScreenProps {
  onCreateNewRequest: () => void;
  onOpenImportModal: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onCreateNewRequest,
  onOpenImportModal,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-100 select-none overflow-y-auto">
      <div className="max-w-2xl w-full space-y-8">
        {/* Simple Minimal Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 font-mono text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>RestStudio Workspace</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Welcome to REST API Client
          </h1>
          <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
            Choose an option below to start building, testing, or importing your HTTP microservices.
          </p>
        </div>

        {/* 2 Simple Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: New Request */}
          <button
            type="button"
            onClick={onCreateNewRequest}
            className="group p-6 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl shadow-xl text-left transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 overflow-hidden"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
                  New Request
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed break-words">
                  Start testing immediately with a dummy URL prefilled (<span className="font-mono text-emerald-400 break-all">jsonplaceholder.typicode.com/todos/1</span>).
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center text-xs font-semibold text-emerald-400 font-mono">
              <span>Create Request &rarr;</span>
            </div>
          </button>

          {/* Option 2: Import */}
          <button
            type="button"
            onClick={onOpenImportModal}
            className="group p-6 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/50 rounded-2xl shadow-xl text-left transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 group-hover:text-sky-300 transition-colors">
                  Import
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Import Postman collections, cURL commands, standard <span className="font-mono text-sky-400">.rest</span> / <span className="font-mono text-sky-400">.http</span> files, or full workspace JSON exports.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center text-xs font-semibold text-sky-400 font-mono">
              <span>Open Import Modal &rarr;</span>
            </div>
          </button>
        </div>

        {/* Footer info */}
        <div className="pt-4 text-center text-[11px] font-mono text-slate-500 flex items-center justify-center space-x-4">
          <span className="flex items-center space-x-1">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>Local Storage Auto-Saved</span>
          </span>
          <span>&bull;</span>
          <span className="flex items-center space-x-1">
            <Code2 className="w-3.5 h-3.5 text-slate-400" />
            <span>REST Client (.rest) Syntax</span>
          </span>
        </div>
      </div>
    </div>
  );
};
