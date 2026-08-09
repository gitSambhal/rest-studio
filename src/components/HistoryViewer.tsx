import React, { useState } from 'react';
import { RequestHistoryItem } from '../types';
import { History, Search, Trash2, Clock, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

interface HistoryViewerProps {
  history: RequestHistoryItem[];
  onClearHistory: () => void;
  onSelectHistoryItem: (item: RequestHistoryItem) => void;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({
  history,
  onClearHistory,
  onSelectHistoryItem,
}) => {
  const [filterText, setFilterText] = useState('');

  const filteredHistory = history.filter(
    (item) =>
      !filterText ||
      item.requestName.toLowerCase().includes(filterText.toLowerCase()) ||
      item.url.toLowerCase().includes(filterText.toLowerCase()) ||
      item.method.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-slate-100 text-sm">Request Execution History</span>
          <span className="text-xs text-slate-400 font-mono">({history.length} items logged)</span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search history logs..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="flex items-center space-x-1.5 text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 px-3 py-1.5 rounded-lg border border-rose-500/30 font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
          <div className="grid grid-cols-12 bg-slate-900/80 px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            <div className="col-span-2">Time</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Method</div>
            <div className="col-span-3">Request Name</div>
            <div className="col-span-3">URL</div>
            <div className="col-span-2 text-right">Duration / Action</div>
          </div>

          {filteredHistory.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectHistoryItem(item)}
              className="grid grid-cols-12 px-4 py-3 items-center font-mono text-xs hover:bg-slate-900/60 cursor-pointer transition-colors group"
            >
              <div className="col-span-2 text-slate-400 text-[11px]">
                {new Date(item.timestamp).toLocaleTimeString()}
              </div>

              <div className="col-span-1">
                {item.status >= 200 && item.status < 300 ? (
                  <span className="text-emerald-400 font-bold text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {item.status}
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold text-[11px] bg-rose-500/10 px-1.5 py-0.5 rounded">
                    {item.status}
                  </span>
                )}
              </div>

              <div className="col-span-1 font-bold text-slate-300">{item.method}</div>
              <div className="col-span-3 font-bold text-slate-200 truncate">{item.requestName}</div>
              <div className="col-span-3 text-slate-400 truncate">{item.resolvedUrl}</div>

              <div className="col-span-2 text-right flex items-center justify-end space-x-2">
                <span className="text-slate-400">{item.duration} ms</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}

          {filteredHistory.length === 0 && (
            <div className="py-16 text-center text-slate-500 text-xs font-mono">
              No request history recorded yet. Execute requests in the Request Builder.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
