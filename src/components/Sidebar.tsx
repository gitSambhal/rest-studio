import React, { useState } from 'react';
import { HTTPMethod, Project, RestFile, RestFolder, RestRequest } from '../types';
import { PromptModal } from './PromptModal';
import {
  FileCode,
  Folder,
  Plus,
  Search,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Copy,
  FolderPlus,
  FilePlus,
  Zap,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  FolderInput,
  Terminal,
} from 'lucide-react';

interface SidebarProps {
  project: Project;
  activeFileId: string | null;
  activeRequestId: string | null;
  onSelectFile: (fileId: string) => void;
  onSelectRequest: (fileId: string, requestId: string) => void;
  onCreateFile: (fileName: string, folderId?: string) => void;
  onCreateFolder: (folderName: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onMoveFileToFolder: (fileId: string, targetFolderId: string | null) => void;
  onCreateRequest: (fileId: string, method: HTTPMethod, name: string) => void;
  onRenameRequest: (fileId: string, requestId: string, newName: string) => void;
  onDuplicateRequest: (fileId: string, requestId: string) => void;
  onDeleteRequest: (fileId: string, requestId: string) => void;
  onMoveRequestOrder: (fileId: string, requestId: string, direction: 'up' | 'down') => void;
  onOpenQuickNewRequest?: () => void;
  onOpenQuickCurl?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  project,
  activeFileId,
  activeRequestId,
  onSelectFile,
  onSelectRequest,
  onCreateFile,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onMoveFileToFolder,
  onCreateRequest,
  onRenameRequest,
  onDuplicateRequest,
  onDeleteRequest,
  onMoveRequestOrder,
  onOpenQuickNewRequest,
  onOpenQuickCurl,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Custom Prompt Modal State
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

  const openPrompt = (config: Omit<typeof promptState, 'isOpen'>) => {
    setPromptState({ ...config, isOpen: true });
  };

  const closePrompt = () => {
    setPromptState((prev) => ({ ...prev, isOpen: false }));
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const getMethodBadgeColor = (method: HTTPMethod) => {
    switch (method) {
      case 'GET':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'POST':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'PUT':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'DELETE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'PATCH':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'QUERY':
        return 'text-teal-400 bg-teal-500/10 border-teal-500/30';
      case 'HEAD':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Header section & Search */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            REST Workspace Explorer
          </span>

          <div className="flex items-center space-x-1">
            {onOpenQuickNewRequest && (
              <button
                type="button"
                onClick={onOpenQuickNewRequest}
                title="Quick New Request (Ctrl + N)"
                className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 rounded transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}

            {onOpenQuickCurl && (
              <button
                type="button"
                onClick={onOpenQuickCurl}
                title="Quick Request from cURL (Ctrl + Shift + C)"
                className="p-1 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 rounded transition-colors cursor-pointer"
              >
                <Terminal className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                openPrompt({
                  title: 'New .rest File',
                  message: 'Enter name for your new REST request file:',
                  initialValue: 'api_tests.rest',
                  placeholder: 'e.g. users.rest',
                  confirmLabel: 'Create File',
                  onConfirm: (name) => {
                    const finalName = name.endsWith('.rest') ? name : `${name}.rest`;
                    onCreateFile(finalName);
                  },
                });
              }}
              title="New .rest File"
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              <FilePlus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                openPrompt({
                  title: 'New Folder',
                  message: 'Enter folder name to group your .rest files:',
                  initialValue: 'Authentication Suite',
                  placeholder: 'e.g. Auth Service',
                  confirmLabel: 'Create Folder',
                  onConfirm: (name) => {
                    if (name) onCreateFolder(name);
                  },
                });
              }}
              title="New Folder"
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search .rest files, endpoints..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
        {/* Folders List */}
        {(project?.folders || []).map((folder) => {
          const folderFiles = (project?.files || []).filter((f) => folder.fileIds?.includes(f.id));
          const isExpanded = expandedFolders[folder.id] ?? true;

          return (
            <div key={folder.id} className="space-y-1">
              <div className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-slate-800/60 text-slate-300 group">
                <div
                  className="flex items-center space-x-2 truncate cursor-pointer flex-1"
                  onClick={() => toggleFolder(folder.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-semibold truncate text-slate-900 dark:text-slate-100">{folder.name}</span>
                </div>

                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPrompt({
                        title: `New File inside ${folder.name}`,
                        message: 'Enter REST file name:',
                        initialValue: 'endpoints.rest',
                        placeholder: 'e.g. auth.rest',
                        confirmLabel: 'Create File',
                        onConfirm: (name) => {
                          const finalName = name.endsWith('.rest') ? name : `${name}.rest`;
                          onCreateFile(finalName, folder.id);
                        },
                      });
                    }}
                    title="Add File to Folder"
                    className="p-1 text-slate-400 hover:text-emerald-400 rounded cursor-pointer"
                  >
                    <FilePlus className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPrompt({
                        title: 'Rename Folder',
                        initialValue: folder.name,
                        confirmLabel: 'Rename',
                        onConfirm: (newName) => {
                          if (newName && newName !== folder.name) onRenameFolder(folder.id, newName);
                        },
                      });
                    }}
                    title="Rename Folder"
                    className="p-1 text-slate-400 hover:text-blue-400 rounded cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPrompt({
                        title: 'Delete Folder',
                        message: `Delete folder "${folder.name}"? Files inside will be moved to root.`,
                        hideInput: true,
                        confirmLabel: 'Delete Folder',
                        onConfirm: () => onDeleteFolder(folder.id),
                      });
                    }}
                    title="Delete Folder"
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 rounded cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Folder's Files */}
              {isExpanded && (
                <div className="pl-4 space-y-1 border-l border-slate-800/80 ml-3">
                  {folderFiles.map((file) => (
                    <RenderRestFile
                      key={file.id}
                      file={file}
                      projectFolders={project?.folders || []}
                      activeFileId={activeFileId}
                      activeRequestId={activeRequestId}
                      searchQuery={searchQuery}
                      getMethodBadgeColor={getMethodBadgeColor}
                      onSelectFile={onSelectFile}
                      onSelectRequest={onSelectRequest}
                      onCreateRequest={onCreateRequest}
                      onRenameFile={onRenameFile}
                      onDuplicateFile={onDuplicateFile}
                      onDeleteFile={onDeleteFile}
                      onMoveFileToFolder={onMoveFileToFolder}
                      onRenameRequest={onRenameRequest}
                      onDuplicateRequest={onDuplicateRequest}
                      onDeleteRequest={onDeleteRequest}
                      onMoveRequestOrder={onMoveRequestOrder}
                      openPrompt={openPrompt}
                    />
                  ))}
                  {folderFiles.length === 0 && (
                    <div className="text-[10px] text-slate-600 font-mono py-1 italic">Empty folder</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Root Level Files (files not in any folder) */}
        {(project?.files || [])
          .filter((f) => !(project?.folders || []).some((fold) => fold.fileIds?.includes(f.id)))
          .map((file) => (
            <RenderRestFile
              key={file.id}
              file={file}
              projectFolders={project?.folders || []}
              activeFileId={activeFileId}
              activeRequestId={activeRequestId}
              searchQuery={searchQuery}
              getMethodBadgeColor={getMethodBadgeColor}
              onSelectFile={onSelectFile}
              onSelectRequest={onSelectRequest}
              onCreateRequest={onCreateRequest}
              onRenameFile={onRenameFile}
              onDuplicateFile={onDuplicateFile}
              onDeleteFile={onDeleteFile}
              onMoveFileToFolder={onMoveFileToFolder}
              onRenameRequest={onRenameRequest}
              onDuplicateRequest={onDuplicateRequest}
              onDeleteRequest={onDeleteRequest}
              onMoveRequestOrder={onMoveRequestOrder}
              openPrompt={openPrompt}
            />
          ))}

        {(project?.files || []).length === 0 && (
          <div className="text-center py-8 text-slate-500 px-4">
            <FileCode className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-400" />
            <p className="font-semibold text-slate-400">No .rest files yet</p>
            <p className="text-[11px] mt-1">Click the + icon above to create your first REST client file.</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 font-mono flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-emerald-400">
          <Zap className="w-3.5 h-3.5" />
          <span>Standard .rest Spec</span>
        </div>
        <span>{(project?.files || []).reduce((acc, f) => acc + (f.requests?.length || 0), 0)} requests</span>
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
          closePrompt();
        }}
        onCancel={closePrompt}
      />
    </aside>
  );
};

interface RenderRestFileProps {
  file: RestFile;
  projectFolders: RestFolder[];
  activeFileId: string | null;
  activeRequestId: string | null;
  searchQuery: string;
  getMethodBadgeColor: (method: HTTPMethod) => string;
  onSelectFile: (fileId: string) => void;
  onSelectRequest: (fileId: string, requestId: string) => void;
  onCreateRequest: (fileId: string, method: HTTPMethod, name: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onMoveFileToFolder: (fileId: string, targetFolderId: string | null) => void;
  onRenameRequest: (fileId: string, requestId: string, newName: string) => void;
  onDuplicateRequest: (fileId: string, requestId: string) => void;
  onDeleteRequest: (fileId: string, requestId: string) => void;
  onMoveRequestOrder: (fileId: string, requestId: string, direction: 'up' | 'down') => void;
  openPrompt: (config: {
    title: string;
    message?: string;
    initialValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    hideInput?: boolean;
    onConfirm: (value: string) => void;
  }) => void;
}

const RenderRestFile: React.FC<RenderRestFileProps> = ({
  file,
  projectFolders,
  activeFileId,
  activeRequestId,
  searchQuery,
  getMethodBadgeColor,
  onSelectFile,
  onSelectRequest,
  onCreateRequest,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onMoveFileToFolder,
  onRenameRequest,
  onDuplicateRequest,
  onDeleteRequest,
  onMoveRequestOrder,
  openPrompt,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const isFileActive = activeFileId === file.id;

  const filteredRequests = (file?.requests || []).filter(
    (req) =>
      !searchQuery ||
      req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.method.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-1 relative">
      {/* File row */}
      <div
        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isFileActive && !activeRequestId
            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30'
            : 'hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
        }`}
        onClick={() => {
          onSelectFile(file.id);
          setIsOpen(!isOpen);
        }}
      >
        <div className="flex items-center space-x-2 truncate">
          <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-mono text-xs truncate font-bold text-slate-900 dark:text-slate-100">{file.name}</span>
        </div>

        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPrompt({
                title: `New Request in ${file.name}`,
                message: 'Enter endpoint request name:',
                initialValue: 'GET /api/data',
                placeholder: 'e.g. GET User Profile',
                confirmLabel: 'Add Request',
                onConfirm: (reqName) => {
                  if (reqName) onCreateRequest(file.id, 'GET', reqName);
                },
              });
            }}
            title="Add Request"
            className="p-1 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded cursor-pointer"
          >
            <Plus className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPrompt({
                title: 'Rename File',
                initialValue: file.name,
                confirmLabel: 'Rename',
                onConfirm: (newName) => {
                  if (newName && newName !== file.name) onRenameFile(file.id, newName);
                },
              });
            }}
            title="Rename File"
            className="p-1 hover:bg-slate-700 text-slate-300 hover:text-blue-400 rounded cursor-pointer"
          >
            <Edit2 className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateFile(file.id);
            }}
            title="Duplicate File"
            className="p-1 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded"
          >
            <Copy className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMoveMenu(!showMoveMenu);
            }}
            title="Move File to Folder"
            className="p-1 hover:bg-slate-700 text-slate-300 hover:text-purple-400 rounded"
          >
            <FolderInput className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPrompt({
                title: 'Delete File',
                message: `Are you sure you want to delete file "${file.name}"?`,
                hideInput: true,
                confirmLabel: 'Delete File',
                onConfirm: () => onDeleteFile(file.id),
              });
            }}
            title="Delete File"
            className="p-1 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 rounded cursor-pointer transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Move File Popover */}
      {showMoveMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-8 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 w-48 text-xs font-sans space-y-1"
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
            Move File To:
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveFileToFolder(file.id, null);
              setShowMoveMenu(false);
            }}
            className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"
          >
            / Root Level
          </button>
          {projectFolders.map((fold) => (
            <button
              key={fold.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveFileToFolder(file.id, fold.id);
                setShowMoveMenu(false);
              }}
              className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-amber-300 truncate cursor-pointer"
            >
              📁 {fold.name}
            </button>
          ))}
        </div>
      )}

      {/* Individual Requests under file */}
      {isOpen && (
        <div className="pl-3 space-y-0.5 border-l border-slate-800 ml-3">
          {filteredRequests.map((req, idx) => {
            const isReqActive = activeRequestId === req.id;
            return (
              <div
                key={req.id}
                onClick={() => onSelectRequest(file.id, req.id)}
                className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                  isReqActive
                    ? 'bg-emerald-500/15 text-slate-950 dark:text-white font-bold border-l-2 border-emerald-500'
                    : 'hover:bg-slate-800/60 text-slate-900 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span
                    className={`font-mono font-bold text-[9px] px-1 py-0.2 rounded border uppercase shrink-0 ${getMethodBadgeColor(
                      req.method
                    )}`}
                  >
                    {req.method}
                  </span>
                  <span className="font-mono text-[11px] truncate font-semibold text-slate-900 dark:text-slate-100">{req.name}</span>
                </div>

                <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveRequestOrder(file.id, req.id, 'up');
                      }}
                      title="Move Up"
                      className="p-0.5 text-slate-400 hover:text-emerald-400"
                    >
                      <ArrowUp className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {idx < (file?.requests?.length || 0) - 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveRequestOrder(file.id, req.id, 'down');
                      }}
                      title="Move Down"
                      className="p-0.5 text-slate-400 hover:text-emerald-400"
                    >
                      <ArrowDown className="w-2.5 h-2.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPrompt({
                        title: 'Rename Request',
                        initialValue: req.name,
                        confirmLabel: 'Rename',
                        onConfirm: (newName) => {
                          if (newName && newName !== req.name) onRenameRequest(file.id, req.id, newName);
                        },
                      });
                    }}
                    title="Rename Request"
                    className="p-0.5 text-slate-400 hover:text-blue-400 cursor-pointer"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateRequest(file.id, req.id);
                    }}
                    title="Duplicate Request"
                    className="p-0.5 text-slate-400 hover:text-amber-400"
                  >
                    <Copy className="w-2.5 h-2.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPrompt({
                        title: 'Delete Request',
                        message: `Are you sure you want to delete request "${req.name}"?`,
                        hideInput: true,
                        confirmLabel: 'Delete Request',
                        onConfirm: () => onDeleteRequest(file.id, req.id),
                      });
                    }}
                    title="Delete Request"
                    className="p-0.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 rounded cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
