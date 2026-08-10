import React, { useState, useEffect } from 'react';
import { Environment, EnvVariable, Organization, Project } from '../types';
import { PromptModal } from './PromptModal';
import {
  X,
  Plus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Variable,
  Info,
  Globe,
  Building2,
  FolderOpen,
  Folder,
} from 'lucide-react';

interface EnvironmentManagerProps {
  organization: Organization;
  project: Project;
  globalVariables: EnvVariable[];
  onClose: () => void;
  onUpdateGlobalVariables: (vars: EnvVariable[]) => void;
  onUpdateOrganizationVariables: (vars: EnvVariable[]) => void;
  onUpdateProjectEnvironments: (updatedEnvironments: Environment[], activeEnvId: string | null) => void;
  onUpdateFolderVariables: (folderId: string, vars: EnvVariable[]) => void;
}

interface ScopeVarTableProps {
  title: string;
  subtitle: string;
  badgeColor: string;
  variables: EnvVariable[];
  showSecrets: Record<string, boolean>;
  setShowSecrets: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onAddVar: () => void;
  onUpdateVar: (id: string, fields: Partial<EnvVariable>) => void;
  onDeleteVar: (id: string) => void;
}

const ScopeVarTable: React.FC<ScopeVarTableProps> = ({
  title,
  subtitle,
  badgeColor,
  variables,
  showSecrets,
  setShowSecrets,
  onAddVar,
  onUpdateVar,
  onDeleteVar,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-slate-200 text-xs flex items-center space-x-2">
            <span>{title}</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badgeColor}`}>
              {variables.length} vars
            </span>
          </h4>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onAddVar}
          className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg shadow transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Variable</span>
        </button>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
        <div className="grid grid-cols-12 bg-slate-950 px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
          <div className="col-span-1 text-center">Use</div>
          <div className="col-span-4">Variable Key</div>
          <div className="col-span-5">Value</div>
          <div className="col-span-2 text-center">Actions</div>
        </div>

        {variables.map((variable) => (
          <div key={variable.id} className="grid grid-cols-12 px-3 py-2 items-center gap-2 hover:bg-slate-800/30">
            <div className="col-span-1 flex justify-center">
              <input
                type="checkbox"
                checked={variable.enabled}
                onChange={(e) => onUpdateVar(variable.id, { enabled: e.target.checked })}
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="col-span-4">
              <input
                type="text"
                value={variable.key}
                onChange={(e) => onUpdateVar(variable.id, { key: e.target.value })}
                placeholder="key..."
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="col-span-5 relative">
              <input
                type={variable.secret && !showSecrets[variable.id] ? 'password' : 'text'}
                value={variable.value}
                onChange={(e) => onUpdateVar(variable.id, { value: e.target.value })}
                placeholder="value..."
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50 pr-8"
              />
              <button
                type="button"
                onClick={() =>
                  setShowSecrets((prev) => ({ ...prev, [variable.id]: !prev[variable.id] }))
                }
                title={variable.secret ? 'Toggle visibility' : 'Mask as secret'}
                className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"
              >
                {variable.secret && !showSecrets[variable.id] ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="col-span-2 flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => onUpdateVar(variable.id, { secret: !variable.secret })}
                className={`p-1 rounded text-xs ${
                  variable.secret ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Toggle Secret Masking"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onDeleteVar(variable.id)}
                className="p-1 text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
                title="Delete Variable"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              </button>
            </div>
          </div>
        ))}

        {variables.length === 0 && (
          <div className="py-8 text-center text-slate-500 text-xs font-mono">
            No variables added in this scope. Click "+ Add Variable" above.
          </div>
        )}
      </div>
    </div>
  );
};

export const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({
  organization,
  project,
  globalVariables,
  onClose,
  onUpdateGlobalVariables,
  onUpdateOrganizationVariables,
  onUpdateProjectEnvironments,
  onUpdateFolderVariables,
}) => {
  const [activeScopeTab, setActiveScopeTab] = useState<'global' | 'organization' | 'project' | 'folder'>(
    'project'
  );

  // Local state for Global
  const [localGlobalVars, setLocalGlobalVars] = useState<EnvVariable[]>(globalVariables || []);

  // Local state for Organization
  const [localOrgVars, setLocalOrgVars] = useState<EnvVariable[]>(organization?.variables || []);

  // Local state for Project Environments
  const [environments, setEnvironments] = useState<Environment[]>(project?.environments || []);
  const [selectedEnvId, setSelectedEnvId] = useState<string>(
    project?.activeEnvId || (project?.environments?.[0]?.id ?? '')
  );

  // Local state for Folder selection
  const [selectedFolderId, setSelectedFolderId] = useState<string>(project?.folders?.[0]?.id || '');
  const [folderVarsMap, setFolderVarsMap] = useState<Record<string, EnvVariable[]>>(() => {
    const map: Record<string, EnvVariable[]> = {};
    (project?.folders || []).forEach((f) => {
      map[f.id] = f.variables || [];
    });
    return map;
  });

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Prompt Modal state for New Env Profile
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    initialValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    hideInput?: boolean;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });

  const activeEnv = (environments || []).find((e) => e.id === selectedEnvId) || environments?.[0];
  const activeFolder = project?.folders?.find((f) => f.id === selectedFolderId) || project?.folders?.[0];

  // Helper to manage variables array edits
  const handleAddVarToTarget = (
    currentVars: EnvVariable[],
    setVarsFn: (v: EnvVariable[]) => void
  ) => {
    const newVar: EnvVariable = {
      id: 'v_' + Math.random().toString(36).substring(2, 9),
      key: '',
      value: '',
      enabled: true,
      description: '',
      secret: false,
    };
    setVarsFn([...currentVars, newVar]);
  };

  const handleUpdateVarInTarget = (
    currentVars: EnvVariable[],
    setVarsFn: (v: EnvVariable[]) => void,
    varId: string,
    updatedFields: Partial<EnvVariable>
  ) => {
    const updated = currentVars.map((v) => (v.id === varId ? { ...v, ...updatedFields } : v));
    setVarsFn(updated);
  };

  const handleDeleteVarFromTarget = (
    currentVars: EnvVariable[],
    setVarsFn: (v: EnvVariable[]) => void,
    varId: string
  ) => {
    setVarsFn(currentVars.filter((v) => v.id !== varId));
  };

  const handleSaveAndClose = () => {
    onUpdateGlobalVariables(localGlobalVars);
    onUpdateOrganizationVariables(localOrgVars);
    onUpdateProjectEnvironments(environments, selectedEnvId);
    Object.entries(folderVarsMap).forEach(([fId, vars]) => {
      onUpdateFolderVariables(fId, vars);
    });
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (e.target as HTMLElement).tagName !== 'TEXTAREA')) {
        e.preventDefault();
        handleSaveAndClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleSaveAndClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Variable className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Environment Variable Hierarchy Manager</h3>
              <p className="text-xs text-slate-400">
                Variable Precedence (Highest &rarr; Base): <span className="font-mono text-sky-400 font-bold">1. Project</span> &gt; <span className="font-mono text-purple-400 font-bold">2. Organization</span> &gt; <span className="font-mono text-amber-400 font-bold">3. Global</span>
              </p>
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

        {/* Scope Level Selector Bar */}
        <div className="flex items-center space-x-1.5 p-2 bg-slate-950 border-b border-slate-800 font-mono text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveScopeTab('global')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeScopeTab === 'global'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>1. Global (Base)</span>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded-full border border-amber-500/20">
              {localGlobalVars.length}
            </span>
          </button>

          <span className="text-slate-600 text-xs font-sans">&rarr;</span>

          <button
            type="button"
            onClick={() => setActiveScopeTab('organization')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeScopeTab === 'organization'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-purple-400" />
            <span>2. Org ({organization?.name || 'Organization'})</span>
            <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.2 rounded-full border border-purple-500/20">
              {localOrgVars.length}
            </span>
          </button>

          <span className="text-slate-600 text-xs font-sans">&rarr;</span>

          <button
            type="button"
            onClick={() => setActiveScopeTab('project')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeScopeTab === 'project'
                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>3. Project ({project?.name || 'Project'})</span>
            <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.2 rounded-full border border-sky-500/20">
              {activeEnv?.variables.length || 0}
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 p-4 flex flex-col overflow-y-auto space-y-4">
          {/* Render Active Scope Table */}
          {activeScopeTab === 'global' && (
            <ScopeVarTable
              title="Global Variables"
              subtitle="Accessible across all organizations and projects."
              badgeColor="bg-amber-500/10 text-amber-400 border-amber-500/20"
              variables={localGlobalVars}
              showSecrets={showSecrets}
              setShowSecrets={setShowSecrets}
              onAddVar={() => handleAddVarToTarget(localGlobalVars, setLocalGlobalVars)}
              onUpdateVar={(id, fields) =>
                handleUpdateVarInTarget(localGlobalVars, setLocalGlobalVars, id, fields)
              }
              onDeleteVar={(id) => handleDeleteVarFromTarget(localGlobalVars, setLocalGlobalVars, id)}
            />
          )}

          {activeScopeTab === 'organization' && (
            <ScopeVarTable
              title={`Organization Variables: ${organization?.name}`}
              subtitle="Accessible across all projects inside this organization."
              badgeColor="bg-purple-500/10 text-purple-400 border-purple-500/20"
              variables={localOrgVars}
              showSecrets={showSecrets}
              setShowSecrets={setShowSecrets}
              onAddVar={() => handleAddVarToTarget(localOrgVars, setLocalOrgVars)}
              onUpdateVar={(id, fields) =>
                handleUpdateVarInTarget(localOrgVars, setLocalOrgVars, id, fields)
              }
              onDeleteVar={(id) => handleDeleteVarFromTarget(localOrgVars, setLocalOrgVars, id)}
            />
          )}

          {activeScopeTab === 'project' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 flex-wrap gap-2">
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-400 font-mono">Active Profile:</span>
                  <select
                    value={selectedEnvId}
                    onChange={(e) => setSelectedEnvId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 font-mono focus:outline-none"
                  >
                    {environments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>

                  {environments.length > 1 && activeEnv && (
                    <button
                      type="button"
                      onClick={() => {
                        setPromptState({
                          isOpen: true,
                          title: 'Delete Profile',
                          message: `Are you sure you want to delete environment profile "${activeEnv.name}"?`,
                          hideInput: true,
                          confirmLabel: 'Delete Profile',
                          onConfirm: () => {
                            const filtered = environments.filter((e) => e.id !== activeEnv.id);
                            setEnvironments(filtered);
                            if (filtered.length > 0) setSelectedEnvId(filtered[0].id);
                          },
                        });
                      }}
                      className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer border border-rose-500/30 flex items-center space-x-1 px-2 py-1 text-xs"
                      title="Delete Environment Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete Profile</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPromptState({
                      isOpen: true,
                      title: 'New Environment Profile',
                      message: 'Enter profile name (e.g., Staging, Production, QA):',
                      initialValue: 'New Profile',
                      placeholder: 'e.g. Staging',
                      confirmLabel: 'Create Profile',
                      onConfirm: (name) => {
                        if (!name) return;
                        const newEnv: Environment = {
                          id: 'env_' + Math.random().toString(36).substring(2, 9),
                          name,
                          color: '#38bdf8',
                          variables: [],
                        };
                        setEnvironments([...environments, newEnv]);
                        setSelectedEnvId(newEnv.id);
                      },
                    });
                  }}
                  className="flex items-center space-x-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg shadow transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Env Profile</span>
                </button>
              </div>

              {activeEnv && (
                <ScopeVarTable
                  title={`Project Environment: ${activeEnv.name}`}
                  subtitle={`Variables for active profile in ${project?.name}`}
                  badgeColor="bg-sky-500/10 text-sky-400 border-sky-500/20"
                  variables={activeEnv.variables}
                  showSecrets={showSecrets}
                  setShowSecrets={setShowSecrets}
                  onAddVar={() => {
                    const newVars = [
                      ...activeEnv.variables,
                      {
                        id: 'v_' + Math.random().toString(36).substring(2, 9),
                        key: '',
                        value: '',
                        enabled: true,
                        description: '',
                      },
                    ];
                    setEnvironments(
                      environments.map((e) => (e.id === activeEnv.id ? { ...e, variables: newVars } : e))
                    );
                  }}
                  onUpdateVar={(id, fields) => {
                    const newVars = activeEnv.variables.map((v) => (v.id === id ? { ...v, ...fields } : v));
                    setEnvironments(
                      environments.map((e) => (e.id === activeEnv.id ? { ...e, variables: newVars } : e))
                    );
                  }}
                  onDeleteVar={(id) => {
                    const newVars = activeEnv.variables.filter((v) => v.id !== id);
                    setEnvironments(
                      environments.map((e) => (e.id === activeEnv.id ? { ...e, variables: newVars } : e))
                    );
                  }}
                />
              )}
            </div>
          )}

          {activeScopeTab === 'folder' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-400 font-mono">Select Folder:</span>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 font-mono focus:outline-none"
                  >
                    {project?.folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeFolder && (
                <ScopeVarTable
                  title={`Folder Scope: ${activeFolder.name}`}
                  subtitle="Variables defined here override Project, Org, and Global variables for requests inside this folder."
                  badgeColor="bg-teal-500/10 text-teal-400 border-teal-500/20"
                  variables={folderVarsMap[activeFolder.id] || []}
                  showSecrets={showSecrets}
                  setShowSecrets={setShowSecrets}
                  onAddVar={() => {
                    const current = folderVarsMap[activeFolder.id] || [];
                    const newVar: EnvVariable = {
                      id: 'v_' + Math.random().toString(36).substring(2, 9),
                      key: '',
                      value: '',
                      enabled: true,
                    };
                    setFolderVarsMap({ ...folderVarsMap, [activeFolder.id]: [...current, newVar] });
                  }}
                  onUpdateVar={(id, fields) => {
                    const current = folderVarsMap[activeFolder.id] || [];
                    const updated = current.map((v) => (v.id === id ? { ...v, ...fields } : v));
                    setFolderVarsMap({ ...folderVarsMap, [activeFolder.id]: updated });
                  }}
                  onDeleteVar={(id) => {
                    const current = folderVarsMap[activeFolder.id] || [];
                    setFolderVarsMap({
                      ...folderVarsMap,
                      [activeFolder.id]: current.filter((v) => v.id !== id),
                    });
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hovering over any <code className="text-emerald-400 font-mono">&#123;&#123;var&#125;&#125;</code> will show scope & value.</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition-colors cursor-pointer"
            >
              Apply All Variable Changes
            </button>
          </div>
        </div>
      </div>

      <PromptModal
        isOpen={promptState.isOpen}
        title={promptState.title}
        message={promptState.message}
        initialValue={promptState.initialValue}
        placeholder={promptState.placeholder}
        confirmLabel={promptState.confirmLabel}
        hideInput={promptState.hideInput}
        onConfirm={(val) => {
          promptState.onConfirm(val);
          setPromptState((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setPromptState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

