import React, { useState, useRef, useEffect } from 'react';
import { Organization, Project } from '../types';
import {
  Zap,
  Building2,
  FolderOpen,
  Plus,
  Settings2,
  Upload,
  ChevronDown,
  FileCode,
  PlayCircle,
  History,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  HelpCircle,
  SlidersHorizontal,
  Layers,
  Code2,
  Terminal,
  Edit2,
  Trash2,
  Monitor,
} from 'lucide-react';

interface HeaderProps {
  organizations: Organization[];
  activeOrg: Organization;
  onSelectOrg: (org: Organization) => void;
  onOpenNewOrgModal: () => void;
  onRenameOrg?: (orgId: string, currentName: string) => void;
  onDeleteOrg?: (orgId: string, currentName: string) => void;

  projects: Project[];
  activeProject: Project;
  onSelectProject: (project: Project) => void;
  onOpenNewProjectModal: () => void;
  onRenameProject?: (projectId: string, currentName: string) => void;
  onDeleteProject?: (projectId: string, currentName: string) => void;

  onSelectEnvironment: (envId: string) => void;
  onOpenEnvManager: () => void;

  activeTab: string;
  onChangeTab: (tab: any) => void;
  onOpenImportExport: () => void;
  onOpenQuickHelp: () => void;
  onOpenSettings?: () => void;
  onOpenDesktopModal?: () => void;
  onOpenQuickNewRequest?: () => void;
  onOpenQuickCurl?: () => void;
  historyCount: number;

  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  organizations,
  activeOrg,
  onSelectOrg,
  onOpenNewOrgModal,
  onRenameOrg,
  onDeleteOrg,
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProjectModal,
  onRenameProject,
  onDeleteProject,
  onSelectEnvironment,
  onOpenEnvManager,
  activeTab,
  onChangeTab,
  onOpenImportExport,
  onOpenQuickHelp,
  onOpenSettings,
  onOpenDesktopModal,
  onOpenQuickNewRequest,
  onOpenQuickCurl,
  historyCount,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const activeEnv = activeProject?.environments?.find((e) => e.id === activeProject?.activeEnvId);

  const [isOrgOpen, setIsOrgOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isEnvOpen, setIsEnvOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const orgRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(event.target as Node)) {
        setIsOrgOpen(false);
      }
      if (projectRef.current && !projectRef.current.contains(event.target as Node)) {
        setIsProjectOpen(false);
      }
      if (envRef.current && !envRef.current.contains(event.target as Node)) {
        setIsEnvOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-2 sm:px-4 py-2 md:py-0 md:h-16 flex flex-col md:flex-row md:items-center md:justify-between shrink-0 select-none gap-2 md:gap-4 min-w-0">
      {/* Top Row on Mobile / Direct children on Desktop */}
      <div className="flex items-center justify-between w-full md:contents min-w-0 gap-2">
        {/* SECTION 1: Brand & Workspace Context (Org, Project, Environment) */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0 shrink-0 md:order-1">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Zap className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <div className="flex flex-col justify-center hidden lg:flex">
              <div className="flex items-center space-x-1.5 leading-none">
                <span className="font-bold text-sm text-white tracking-tight">RestStudio</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v1.0
                </span>
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800 shrink-0 hidden lg:block" />

          {/* Unified Workspace Context Bar (Org -> Project -> Env) */}
          <div className="flex items-center bg-slate-950/90 border border-slate-800 p-1 rounded-xl space-x-1 min-w-0">
            {/* 1. Organization Dropdown */}
            <div className="relative shrink-0" ref={orgRef}>
              <button
                type="button"
                onClick={() => {
                  setIsOrgOpen(!isOrgOpen);
                  setIsProjectOpen(false);
                  setIsEnvOpen(false);
                  setIsMenuOpen(false);
                }}
                className="flex items-center space-x-1 hover:bg-slate-800/80 px-1.5 sm:px-2 py-1 rounded-lg text-slate-200 text-xs font-medium transition-all cursor-pointer"
                title={`Organization: ${activeOrg?.name || 'Organization'}`}
              >
                <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="hidden sm:inline max-w-[70px] md:max-w-[110px] truncate font-semibold">{activeOrg?.name || 'Org'}</span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform ${isOrgOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Org Menu */}
              {isOrgOpen && (
                <div className={`absolute left-0 top-full mt-2 w-72 rounded-xl shadow-2xl z-50 divide-y p-1 space-y-1 animate-in fade-in zoom-in-95 duration-100 ${
                  isDarkMode
                    ? 'bg-slate-900 border border-slate-700/80 divide-slate-800/60 text-slate-100'
                    : 'bg-white border border-slate-200 divide-slate-100 text-slate-900 shadow-slate-900/10'
                }`}>
                  <div className="p-1 space-y-0.5 max-h-56 overflow-y-auto">
                    <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Organizations
                    </div>
                    {organizations.map((org) => (
                      <div
                        key={org.id}
                        className={`group w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
                          org.id === activeOrg?.id
                            ? isDarkMode ? 'bg-purple-500/20 text-purple-300 font-semibold' : 'bg-purple-50 text-purple-700 font-semibold border border-purple-200'
                            : isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectOrg(org);
                            setIsOrgOpen(false);
                          }}
                          className="flex items-center space-x-2 min-w-0 flex-1 text-left cursor-pointer py-0.5"
                        >
                          <Building2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span className="truncate">{org.name}</span>
                        </button>

                        <div className="flex items-center space-x-1 shrink-0">
                          <span className={`text-[10px] font-mono shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded border ${
                            isDarkMode ? 'bg-slate-800/60 text-slate-400 border-slate-700/50' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {org.projects?.length || 0} proj
                          </span>
                          {onRenameOrg && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRenameOrg(org.id, org.name);
                                setIsOrgOpen(false);
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:text-purple-400 rounded transition-all cursor-pointer"
                              title="Rename Organization"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          {onDeleteOrg && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteOrg(org.id, org.name);
                                setIsOrgOpen(false);
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:text-rose-400 rounded transition-all cursor-pointer"
                              title="Delete Organization"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenNewOrgModal();
                        setIsOrgOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer ${
                        isDarkMode ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Organization</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <span className="text-slate-700 font-mono text-xs shrink-0">/</span>

            {/* 2. Project Dropdown */}
            <div className="relative shrink-0" ref={projectRef}>
              <button
                type="button"
                onClick={() => {
                  setIsProjectOpen(!isProjectOpen);
                  setIsOrgOpen(false);
                  setIsEnvOpen(false);
                  setIsMenuOpen(false);
                }}
                className="flex items-center space-x-1 hover:bg-slate-800/80 px-1.5 sm:px-2 py-1 rounded-lg text-slate-200 text-xs font-medium transition-all cursor-pointer"
                title={`Project: ${activeProject?.name || 'Project'}`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="max-w-[70px] sm:max-w-[100px] md:max-w-[130px] truncate font-semibold">{activeProject?.name || 'Project'}</span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform ${isProjectOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Project Menu */}
              {isProjectOpen && (
                <div className={`absolute left-0 top-full mt-2 w-72 sm:w-80 rounded-xl shadow-2xl z-50 divide-y p-1 space-y-1 animate-in fade-in zoom-in-95 duration-100 ${
                  isDarkMode
                    ? 'bg-slate-900 border border-slate-700/80 divide-slate-800/60 text-slate-100'
                    : 'bg-white border border-slate-200 divide-slate-100 text-slate-900 shadow-slate-900/10'
                }`}>
                  <div className="p-1 space-y-0.5 max-h-60 overflow-y-auto">
                    <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Projects in {activeOrg?.name}
                    </div>
                    {projects.map((proj) => (
                      <div
                        key={proj.id}
                        className={`group w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
                          proj.id === activeProject?.id
                            ? isDarkMode ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                            : isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectProject(proj);
                            setIsProjectOpen(false);
                          }}
                          className="flex items-center space-x-2 min-w-0 flex-1 text-left cursor-pointer py-0.5"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate font-medium">{proj.name}</span>
                        </button>

                        <div className="flex items-center space-x-1 shrink-0">
                          <span className={`text-[10px] font-mono shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded border ${
                            isDarkMode ? 'bg-slate-800/60 text-slate-400 border-slate-700/50' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {proj.files?.length || 0} .rest
                          </span>
                          {onRenameProject && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRenameProject(proj.id, proj.name);
                                setIsProjectOpen(false);
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:text-emerald-400 rounded transition-all cursor-pointer"
                              title="Rename Project"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          {onDeleteProject && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProject(proj.id, proj.name);
                                setIsProjectOpen(false);
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:text-rose-400 rounded transition-all cursor-pointer"
                              title="Delete Project"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenNewProjectModal();
                        setIsProjectOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer ${
                        isDarkMode ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Project in Org</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <span className="text-slate-700 font-mono text-xs shrink-0">:</span>

            {/* 3. Environment Dropdown */}
            <div className="relative shrink-0" ref={envRef}>
              <button
                type="button"
                onClick={() => {
                  setIsEnvOpen(!isEnvOpen);
                  setIsOrgOpen(false);
                  setIsProjectOpen(false);
                  setIsMenuOpen(false);
                }}
                className={`flex items-center space-x-1 px-1.5 sm:px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-200/80'
                }`}
                title={`Environment: ${activeEnv ? activeEnv.name : 'No Env'}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeEnv?.color || '#94a3b8' }}
                />
                <span className="max-w-[60px] sm:max-w-[80px] md:max-w-[110px] truncate text-xs font-mono font-semibold">
                  {activeEnv ? activeEnv.name : 'No Env'}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 transition-transform" />
              </button>

              {/* Environment Menu */}
              {isEnvOpen && (
                <div className={`absolute left-0 top-full mt-2 w-72 rounded-xl shadow-2xl z-50 divide-y p-1 space-y-1 animate-in fade-in zoom-in-95 duration-100 ${
                  isDarkMode
                    ? 'bg-slate-900 border border-slate-700/80 divide-slate-800/60 text-slate-100'
                    : 'bg-white border border-slate-200 divide-slate-100 text-slate-900 shadow-slate-900/10'
                }`}>
                  <div className="p-1 space-y-0.5 max-h-60 overflow-y-auto">
                    <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span>Project Environment</span>
                      <span className="text-[10px] text-emerald-500 font-mono">
                        {activeProject?.environments.length} Envs
                      </span>
                    </div>

                    {activeProject?.environments.map((env) => (
                      <button
                        key={env.id}
                        type="button"
                        onClick={() => {
                          onSelectEnvironment(env.id);
                          setIsEnvOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                          env.id === activeProject.activeEnvId
                            ? isDarkMode ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                            : isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0 pr-1">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: env.color || '#10b981' }}
                          />
                          <span className="truncate">{env.name}</span>
                        </div>
                        <span className={`text-[10px] font-normal shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded border ${
                          isDarkMode ? 'bg-slate-800/60 text-slate-400 border-slate-700/50' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {env.variables.filter((v) => v.enabled).length} vars
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenEnvManager();
                        setIsEnvOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Settings2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Manage Env Variables</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: Settings & Tools Menu */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 md:order-3">
          {onOpenDesktopModal && (
            <button
              type="button"
              onClick={onOpenDesktopModal}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer shadow-sm shadow-emerald-950/20"
              title="Desktop App Mode & Build Executables"
            >
              <Monitor className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Desktop App</span>
            </button>
          )}

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(!isMenuOpen);
                setIsOrgOpen(false);
                setIsProjectOpen(false);
                setIsEnvOpen(false);
              }}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs px-2 sm:px-3 py-1.5 rounded-lg font-medium border border-slate-700 transition-all cursor-pointer shadow-sm"
              title="Settings, Tools & Preferences"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold text-xs hidden sm:inline">Settings & Tools</span>
              <span className="font-semibold text-xs sm:hidden">Settings</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className={`absolute right-0 top-full mt-2 w-64 rounded-xl shadow-2xl z-50 divide-y p-1 space-y-1 animate-in fade-in zoom-in-95 duration-100 ${
                isDarkMode
                  ? 'bg-slate-900 border border-slate-700/80 divide-slate-800/60 text-slate-100'
                  : 'bg-white border border-slate-200 divide-slate-100 text-slate-900 shadow-slate-900/10'
              }`}>
                {/* Category 0: Desktop Native Mode */}
                {onOpenDesktopModal && (
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenDesktopModal();
                        setIsMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30`}
                    >
                      <Monitor className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-bold leading-tight text-emerald-300">Desktop App Conversion</span>
                        <span className="text-[10px] text-emerald-400/80">Build .dmg, .exe, .AppImage installers</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Category 1: Environment & Variables */}
                <div className="p-1 space-y-0.5">
                  <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Variables & Environment
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenEnvManager();
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors cursor-pointer ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold leading-tight">Env Hierarchy Manager</span>
                      <span className={`text-[10px] font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Global, Org, Project & Folder vars</span>
                    </div>
                  </button>
                </div>

                {/* Category 2: Data Import & Export */}
                <div className="p-1 space-y-0.5">
                  <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Data & Files
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenImportExport();
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors cursor-pointer ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold leading-tight">Import / Export Suite</span>
                      <span className={`text-[10px] font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Postman, cURL, OpenAPI & REST</span>
                    </div>
                  </button>
                </div>

                {/* Category 3: System & Preferences */}
                <div className="p-1 space-y-0.5">
                  <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    System & Help
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenSettings) onOpenSettings();
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors cursor-pointer ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold leading-tight">Request Execution Engine</span>
                      <span className={`text-[10px] font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Auto fallback, Direct Client & CORS Proxy</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenQuickHelp();
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors cursor-pointer ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 text-sky-500 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold leading-tight">Quick Help & Docs</span>
                      <span className={`text-[10px] font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Shortcuts, syntax & variable guide</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onToggleDarkMode();
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      {isDarkMode ? (
                        <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
                      )}
                      <span className="font-semibold">Appearance Theme</span>
                    </div>
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700/60' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {isDarkMode ? 'Dark' : 'Light'}
                    </span>
                  </button>

                  <div className={`px-2.5 py-2 flex items-center justify-between text-xs border-t mt-1 ${
                    isDarkMode ? 'text-slate-400 border-slate-800/60' : 'text-slate-500 border-slate-100'
                  }`}>
                    <span className="text-[11px]">Network Status</span>
                    {isOnline ? (
                      <div className="flex items-center space-x-1.5 text-[10px] text-emerald-500 font-mono font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <Wifi className="w-3 h-3 text-emerald-500" />
                        <span>Online</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5 text-[10px] text-rose-500 font-mono font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <WifiOff className="w-3 h-3 text-rose-500" />
                        <span>Offline</span>
                      </div>
                    )}
                  </div>

                  <div className={`px-2.5 py-1.5 flex items-center justify-between text-[11px] border-t mt-1 rounded-b-lg ${
                    isDarkMode ? 'text-slate-400 border-slate-800/60 bg-slate-950/40' : 'text-slate-500 border-slate-100 bg-slate-50'
                  }`}>
                    <span>Developer</span>
                    <a
                      href="https://suhail.top"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-500 hover:text-emerald-600 font-semibold hover:underline flex items-center space-x-1"
                    >
                      <span>Suhail Akhtar</span>
                      <span className={`text-[10px] font-mono font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>suhail.top</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Center View Modes (Request Builder, .rest Code, Runner, History) */}
      {/* Moves to a dedicated row on small screens and centers on desktop */}
      <div className="flex items-center justify-start md:justify-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner shrink-0 w-full md:w-auto overflow-x-auto scrollbar-none md:order-2 space-x-1">
        <button
          type="button"
          onClick={() => onChangeTab('editor')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'editor'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Request Builder Interface"
        >
          <Zap className="w-3.5 h-3.5 shrink-0" />
          <span>Request Builder</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('code')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'code'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Raw .rest / .http Script Code View"
        >
          <FileCode className="w-3.5 h-3.5 shrink-0" />
          <span>.rest Code</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('runner')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'runner'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Batch REST File Runner"
        >
          <PlayCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Runner</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('history')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Execution History Log"
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          <span>History</span>
          {historyCount > 0 && (
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full font-mono">
              {historyCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
