import React, { useState, useEffect } from 'react';
import { WorkspaceTab, HTTPMethod } from '../types';
import {
  X,
  FileCode,
  Play,
  History,
  Compass,
  Rows3,
  Columns3,
  Code2,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Trash2,
} from 'lucide-react';

interface TabBarProps {
  tabs: WorkspaceTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseTabsToRight?: (tabId: string) => void;
  onCloseTabsToLeft?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
  onNewTab: () => void;
  onOpenQuickNewRequest?: () => void;
  onOpenQuickCurl?: () => void;
  splitOrientation?: 'top-bottom' | 'left-right';
  onToggleSplitOrientation?: () => void;
}

const METHOD_COLORS: Record<HTTPMethod, string> = {
  GET: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  POST: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  PUT: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  DELETE: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  PATCH: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  HEAD: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  OPTIONS: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  QUERY: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
};

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseTabsToLeft,
  onCloseAllTabs,
  onNewTab,
  onOpenQuickNewRequest,
  onOpenQuickCurl,
  splitOrientation = 'top-bottom',
  onToggleSplitOrientation,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId,
    });
  };

  const renderTabIcon = (tab: WorkspaceTab) => {
    switch (tab.type) {
      case 'request':
        return tab.method ? (
          <span
            className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border shrink-0 ${
              METHOD_COLORS[tab.method] || 'text-slate-300'
            }`}
          >
            {tab.method}
          </span>
        ) : (
          <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        );
      case 'file':
        return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'runner':
        return <Play className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'history':
        return <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'onboarding':
      default:
        return <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
  };

  return (
    <div className="h-10 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between px-2 overflow-x-auto scrollbar-none shrink-0 select-none relative">
      {/* Left: Open Tabs List */}
      <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              className={`group relative flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border shrink-0 ${
                isActive
                  ? 'bg-slate-800 text-slate-100 border-slate-700 shadow-md font-semibold'
                  : 'bg-slate-950/40 text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              {renderTabIcon(tab)}
              <span className="truncate max-w-[140px] font-mono text-[11px]">{tab.title}</span>

              {tab.isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className={`p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 transition-colors ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Close Tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Right Controls: Split Layout Toggle */}
      {onToggleSplitOrientation && (
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onToggleSplitOrientation}
            className="flex items-center space-x-1.5 px-2 py-1 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-md text-[11px] font-mono text-slate-300 hover:text-emerald-300 transition-colors cursor-pointer"
            title={`Current Split: ${splitOrientation === 'top-bottom' ? 'Top/Bottom' : 'Left/Right'}. Click to toggle layout.`}
          >
            {splitOrientation === 'top-bottom' ? (
              <>
                <Rows3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Top / Bottom</span>
              </>
            ) : (
              <>
                <Columns3 className="w-3.5 h-3.5 text-sky-400" />
                <span>Left / Right</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y + 4, left: contextMenu.x }}
          className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 w-52 text-xs font-sans text-slate-200 space-y-1 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onCloseTab(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-slate-100 transition-colors text-left cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
            <span>Close Tab</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onCloseOtherTabs) onCloseOtherTabs(contextMenu.tabId);
              else {
                tabs.forEach((t) => {
                  if (t.id !== contextMenu.tabId) onCloseTab(t.id);
                });
              }
              setContextMenu(null);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-slate-100 transition-colors text-left cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Close Other Tabs</span>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          <button
            type="button"
            onClick={() => {
              if (onCloseTabsToRight) onCloseTabsToRight(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-slate-100 transition-colors text-left cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
            <span>Close Tabs to Right</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onCloseTabsToLeft) onCloseTabsToLeft(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-slate-100 transition-colors text-left cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-purple-400" />
            <span>Close Tabs to Left</span>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          <button
            type="button"
            onClick={() => {
              if (onCloseAllTabs) onCloseAllTabs();
              setContextMenu(null);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300 transition-colors text-left cursor-pointer font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Close All Tabs</span>
          </button>
        </div>
      )}
    </div>
  );
};
