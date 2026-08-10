/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Organization,
  Project,
  RestFile,
  RestRequest,
  ExecutionResponse,
  RequestHistoryItem,
  EnvVariable,
  HTTPMethod,
  RequestAuth,
  WorkspaceTab,
} from './types';
import { INITIAL_ORGANIZATIONS, INITIAL_GLOBAL_VARIABLES } from './data/initialOrganizations';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { RequestEditor } from './components/RequestEditor';
import { ResponseViewer } from './components/ResponseViewer';
import { EnvironmentManager } from './components/EnvironmentManager';
import { RestFileEditor } from './components/RestFileEditor';
import { CollectionRunner } from './components/CollectionRunner';
import { HistoryViewer } from './components/HistoryViewer';
import { ImportExportModal } from './components/ImportExportModal';
import { QuickHelpModal } from './components/QuickHelpModal';
import { SettingsModal } from './components/SettingsModal';
import { PromptModal } from './components/PromptModal';
import { QuickNewRequestModal } from './components/QuickNewRequestModal';
import { QuickCurlModal } from './components/QuickCurlModal';
import { TabBar } from './components/TabBar';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ToastContainer, ToastMessage } from './components/ToastContainer';
import { ScopeContext, resolveEnvVariables } from './utils/envUtils';
import { parseRestFileContent, detectAndParsePaste } from './utils/restParser';
import { evaluateAssertions } from './utils/testUtils';
import { runPreRequestScript, runPostRequestScript } from './utils/scriptRunner';
import { executeHttpRequest } from './utils/httpExecutor';

export default function App() {
  // 1. Global Variables
  const [globalVariables, setGlobalVariables] = useState<EnvVariable[]>(() => {
    try {
      const saved = localStorage.getItem('restpulse_global_vars');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_GLOBAL_VARIABLES;
  });

  // 2. Organizations & Projects
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    try {
      const saved = localStorage.getItem('restpulse_organizations');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load saved organizations:', e);
    }
    return INITIAL_ORGANIZATIONS;
  });

  const [activeOrgId, setActiveOrgId] = useState<string>(
    organizations[0]?.id || 'org_acme'
  );
  const activeOrg = organizations?.find((o) => o.id === activeOrgId) || organizations?.[0];

  const [activeProjectId, setActiveProjectId] = useState<string>(
    activeOrg?.projects?.[0]?.id || 'proj_ecommerce'
  );
  const activeProject = activeOrg?.projects?.find((p) => p.id === activeProjectId) || activeOrg?.projects?.[0];

  const [activeFileId, setActiveFileId] = useState<string | null>(
    activeProject?.files?.[0]?.id || null
  );
  const activeFile = activeProject?.files?.find((f) => f.id === activeFileId) || activeProject?.files?.[0];

  const [activeRequestId, setActiveRequestId] = useState<string | null>(
    activeFile?.requests?.[0]?.id || null
  );
  const activeRequest =
    activeFile?.requests?.find((r) => r.id === activeRequestId) || activeFile?.requests?.[0];

  // 3. Multi-Tab System
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => {
    try {
      const saved = localStorage.getItem('restpulse_tabs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'tab_onboarding',
        type: 'onboarding',
        title: 'Welcome Workspace',
      },
      {
        id: 'tab_req_1',
        type: 'request',
        title: 'GET Products',
        fileId: activeFile?.id,
        requestId: activeFile?.requests?.[0]?.id,
        method: 'GET',
      },
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || 'tab_onboarding');
  const activeTabObj = tabs?.find((t) => t.id === activeTabId) || tabs?.[0];

  // Main Header mode tabs ('editor', 'code', 'runner', 'history')
  const [activeTabMode, setActiveTabMode] = useState<'editor' | 'code' | 'runner' | 'history'>('editor');

  // Dark Mode State & Effect
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('restpulse_theme');
      if (saved) return saved === 'dark';
    } catch (e) {}
    return true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.documentElement.classList.add('light-theme');
      document.body.classList.add('light-theme');
    }
    try {
      localStorage.setItem('restpulse_theme', isDarkMode ? 'dark' : 'light');
    } catch (e) {}
  }, [isDarkMode]);

  const handleToggleDarkMode = () => setIsDarkMode((prev) => !prev);

  // Custom Prompt Modal state for App
  const [appPromptState, setAppPromptState] = useState<{
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

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const newToast: ToastMessage = {
      id: 'toast_' + Math.random().toString(36).substring(2, 9),
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 4. Split Orientation & Resizable Panes
  const [splitOrientation, setSplitOrientation] = useState<'top-bottom' | 'left-right'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('restpulse_split_orientation');
      if (saved === 'top-bottom' || saved === 'left-right') return saved;
    }
    return 'top-bottom';
  });
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('restpulse_split_ratio');
      if (saved) {
        const num = parseFloat(saved);
        if (!isNaN(num) && num >= 15 && num <= 85) return num;
      }
    }
    return 55;
  }); // percentage for top or left pane
  const isDraggingSplitter = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('restpulse_split_orientation', splitOrientation);
    }
  }, [splitOrientation]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('restpulse_split_ratio', splitRatio.toString());
    }
  }, [splitRatio]);

  // Modals
  const [isEnvManagerOpen, setIsEnvManagerOpen] = useState<boolean>(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState<boolean>(false);
  const [isQuickHelpOpen, setIsQuickHelpOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isQuickNewRequestOpen, setIsQuickNewRequestOpen] = useState<boolean>(false);
  const [isQuickCurlOpen, setIsQuickCurlOpen] = useState<boolean>(false);
  const [initialPasteText, setInitialPasteText] = useState<string>('');

  // Global Paste Listener (Auto-detect cURL / Smart Paste anywhere when not typing in input/textarea)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.getAttribute('contenteditable') === 'true';
      if (isInput) return;

      const pastedText = e.clipboardData?.getData('text');
      if (!pastedText) return;

      const trimmed = pastedText.trim();
      const result = detectAndParsePaste(trimmed);

      if (result && result.type !== 'unknown' && result.requests.length > 0) {
        e.preventDefault();
        setInitialPasteText(trimmed);
        setIsQuickNewRequestOpen(true);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+N for Quick Request, Ctrl+Shift+C / Alt+C for Quick cURL)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if focus is inside an input/textarea and user presses N
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.getAttribute('contenteditable') === 'true';

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsQuickNewRequestOpen(true);
      } else if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') ||
        (e.altKey && e.key.toLowerCase() === 'c')
      ) {
        e.preventDefault();
        setIsQuickCurlOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Execution State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<ExecutionResponse | null>(null);

  // History State
  const [history, setHistory] = useState<RequestHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('restpulse_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // LocalStorage Persistence
  useEffect(() => {
    try {
      localStorage.setItem('restpulse_global_vars', JSON.stringify(globalVariables));
    } catch (e) {}
  }, [globalVariables]);

  useEffect(() => {
    try {
      localStorage.setItem('restpulse_organizations', JSON.stringify(organizations));
    } catch (e) {}
  }, [organizations]);

  useEffect(() => {
    try {
      localStorage.setItem('restpulse_tabs', JSON.stringify(tabs));
    } catch (e) {}
  }, [tabs]);

  useEffect(() => {
    try {
      localStorage.setItem('restpulse_history', JSON.stringify(history));
    } catch (e) {}
  }, [history]);

  // Keep project reference consistent when switching organization
  useEffect(() => {
    if (activeOrg) {
      if (!(activeOrg.projects || []).some((p) => p.id === activeProjectId)) {
        const firstProj = activeOrg.projects?.[0];
        if (firstProj) {
          setActiveProjectId(firstProj.id);
          const firstFile = firstProj.files?.[0];
          setActiveFileId(firstFile?.id || null);
          setActiveRequestId(firstFile?.requests?.[0]?.id || null);
        }
      }
    }
  }, [activeOrgId]);

  // Derive Scope Context for Variable Resolution
  const activeEnv = activeProject?.environments?.find((e) => e.id === activeProject?.activeEnvId);
  const activeFolder = activeProject?.folders?.find((f) => activeFile && f.fileIds?.includes(activeFile.id));

  const scopeCtx: ScopeContext = {
    globalVariables,
    organizationVariables: activeOrg?.variables || [],
    organizationName: activeOrg?.name,
    projectVariables: activeEnv?.variables || [],
    projectName: activeProject?.name,
    folderVariables: activeFolder?.variables || [],
    folderName: activeFolder?.name,
    fileVariables: activeFile?.fileVariables || {},
    fileName: activeFile?.name,
  };

  const handleUpdateProjectAuth = (auth: RequestAuth) => {
    if (!activeOrg || !activeProject) return;
    setOrganizations((prevOrgs) =>
      prevOrgs.map((org) => {
        if (org.id !== activeOrg.id) return org;
        return {
          ...org,
          projects: (org.projects || []).map((proj) => {
            if (proj.id !== activeProject.id) return proj;
            return {
              ...proj,
              auth,
              updatedAt: Date.now(),
            };
          }),
        };
      })
    );
  };

  // Splitter mouse drag listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplitter.current) return;
      const container = document.getElementById('resizable-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (splitOrientation === 'top-bottom') {
        const relativeY = e.clientY - rect.top;
        const percentage = Math.max(20, Math.min(80, (relativeY / rect.height) * 100));
        setSplitRatio(percentage);
      } else {
        const relativeX = e.clientX - rect.left;
        const percentage = Math.max(20, Math.min(80, (relativeX / rect.width) * 100));
        setSplitRatio(percentage);
      }
    };

    const handleMouseUp = () => {
      isDraggingSplitter.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [splitOrientation]);

  // Variable updater helper for pre/post scripts
  const saveScriptVariables = (newVars?: Record<string, string>) => {
    if (!newVars || Object.keys(newVars).length === 0) return;
    if (!activeOrg || !activeProject) return;

    const activeEnvId = activeProject.activeEnvId;
    if (activeEnvId) {
      setOrganizations((prevOrgs) =>
        prevOrgs.map((org) => {
          if (org.id !== activeOrg.id) return org;
          return {
            ...org,
            projects: (org.projects || []).map((proj) => {
              if (proj.id !== activeProject.id) return proj;
              const envs = (proj.environments || []).map((env) => {
                if (env.id !== activeEnvId) return env;
                const existingVars = [...(env.variables || [])];
                Object.entries(newVars).forEach(([key, value]) => {
                  const existingIdx = existingVars.findIndex((v) => v.key === key);
                  if (existingIdx >= 0) {
                    existingVars[existingIdx] = { ...existingVars[existingIdx], value };
                  } else {
                    existingVars.push({
                      id: 'var_' + Math.random().toString(36).substring(2, 9),
                      key,
                      value,
                      secret: false,
                      enabled: true,
                    });
                  }
                });
                return { ...env, variables: existingVars };
              });
              return { ...proj, environments: envs };
            }),
          };
        })
      );
    }
  };

  // Execute Request Handler
  const handleExecuteRequest = async (req: RestRequest): Promise<ExecutionResponse> => {
    setIsExecuting(true);

    // 1. Resolve URL with 3-level env variables
    const urlResolution = resolveEnvVariables(req.url, scopeCtx);
    let targetUrl = urlResolution.resolved;

    // 2. Append query parameters
    const activeParams = (req?.queryParams || []).filter((p) => p.enabled && p.key);
    if (activeParams.length > 0) {
      const qParams = activeParams.map((p) => {
        const resKey = resolveEnvVariables(p.key, scopeCtx).resolved;
        const resVal = resolveEnvVariables(p.value, scopeCtx).resolved;
        return `${encodeURIComponent(resKey)}=${encodeURIComponent(resVal)}`;
      });
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + qParams.join('&');
    }

    // 3. Resolve Headers
    const resolvedHeaders: Record<string, string> = {};
    (req?.headers || [])
      .filter((h) => h.enabled && h.key)
      .forEach((h) => {
        const resKey = resolveEnvVariables(h.key, scopeCtx).resolved;
        const resVal = resolveEnvVariables(h.value, scopeCtx).resolved;
        resolvedHeaders[resKey] = resVal;
      });

    // 4. Resolve Auth (Support Inherited Auth from File or Project)
    let effectiveAuth = req.auth;
    if (!effectiveAuth || effectiveAuth.type === 'inherit') {
      effectiveAuth = activeFile?.auth || activeProject?.auth || { type: 'none', bearerToken: '' };
    }

    if (effectiveAuth.type === 'bearer' && effectiveAuth.bearerToken) {
      const token = resolveEnvVariables(effectiveAuth.bearerToken, scopeCtx).resolved;
      resolvedHeaders['Authorization'] = `Bearer ${token}`;
    } else if (effectiveAuth.type === 'basic') {
      const username = resolveEnvVariables(effectiveAuth.basicUsername || '', scopeCtx).resolved;
      const password = resolveEnvVariables(effectiveAuth.basicPassword || '', scopeCtx).resolved;
      if (username || password) {
        const credentials = `${username}:${password}`;
        const encoded = typeof btoa !== 'undefined' ? btoa(credentials) : '';
        resolvedHeaders['Authorization'] = `Basic ${encoded}`;
      }
    } else if (effectiveAuth.type === 'apikey') {
      const key = resolveEnvVariables(effectiveAuth.apiKeyKey || '', scopeCtx).resolved;
      const value = resolveEnvVariables(effectiveAuth.apiKeyValue || '', scopeCtx).resolved;
      const addTo = effectiveAuth.apiKeyAddTo || 'header';
      if (key && value) {
        if (addTo === 'header') {
          resolvedHeaders[key] = value;
        } else if (addTo === 'query') {
          targetUrl += (targetUrl.includes('?') ? '&' : '?') + `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
      }
    }

    // Ensure Content-Type header is set if missing or if body mode requires it
    const existingContentTypeKey = Object.keys(resolvedHeaders).find(
      (k) => k.toLowerCase() === 'content-type'
    );
    if (!existingContentTypeKey) {
      if (req.body.mode === 'json') {
        resolvedHeaders['Content-Type'] = 'application/json';
      } else if (req.body.mode === 'x-www-form-urlencoded') {
        resolvedHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (req.body.mode === 'raw') {
        resolvedHeaders['Content-Type'] = 'text/plain';
      }
    }

    // 5. Resolve Body
    let resolvedBody: any = undefined;
    if (req.body.mode === 'json' || req.body.mode === 'raw' || req.body.mode === 'x-www-form-urlencoded') {
      resolvedBody = resolveEnvVariables(req.body.rawText, scopeCtx).resolved;
    }

    // 6. RUN PRE-REQUEST SCRIPT IF ENABLED
    let scriptLogs: string[] = [];
    if (req.preRequestScript?.enabled) {
      const preResult = await runPreRequestScript(
        req,
        scopeCtx,
        resolvedHeaders,
        targetUrl,
        typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody || '')
      );

      scriptLogs = preResult.logs || [];

      if (preResult.newVariables && Object.keys(preResult.newVariables).length > 0) {
        saveScriptVariables(preResult.newVariables);
      }

      if (!preResult.success && preResult.error) {
        const preErrResp: ExecutionResponse = {
          status: 400,
          statusText: 'Pre-Request Validation Failed',
          headers: {},
          body: JSON.stringify({ error: preResult.error, logs: preResult.logs }, null, 2),
          size: 0,
          duration: 0,
          timestamp: Date.now(),
          ok: false,
          error: preResult.error,
          scriptLogs,
        };
        setLastResponse(preErrResp);
        setIsExecuting(false);
        showToast('error', 'Pre-Request Script Error', preResult.error);
        return preErrResp;
      }

      if (preResult.modifiedUrl) {
        targetUrl = preResult.modifiedUrl;
      }
      if (preResult.modifiedHeaders) {
        Object.assign(resolvedHeaders, preResult.modifiedHeaders);
      }
      if (preResult.modifiedBody) {
        resolvedBody = preResult.modifiedBody;
      }
    }

    try {
      const responseData = await executeHttpRequest({
        method: req.method,
        url: targetUrl,
        headers: resolvedHeaders,
        body: resolvedBody,
      });
      responseData.scriptLogs = scriptLogs;

      // 7. RUN POST-REQUEST SCRIPT IF ENABLED
      if (req.postRequestScript?.enabled) {
        const postResult = runPostRequestScript(req, responseData);

        if (postResult.logs && postResult.logs.length > 0) {
          responseData.scriptLogs = [...(responseData.scriptLogs || []), ...postResult.logs];
        }

        if (postResult.newVariables && Object.keys(postResult.newVariables).length > 0) {
          saveScriptVariables(postResult.newVariables);
        }

        if (postResult.assertions && postResult.assertions.length > 0) {
          responseData.testResults = postResult.assertions;
        }
      }

      setLastResponse(responseData);

      if (req.assertions && req.assertions.length > 0) {
        const { assertions: evaluated } = evaluateAssertions(req.assertions, responseData);
        handleUpdateActiveRequest({
          ...req,
          assertions: evaluated,
        });
      }

      const historyItem: RequestHistoryItem = {
        id: 'hist_' + Date.now(),
        projectId: activeProject.id,
        fileId: activeFile?.id,
        requestId: req.id,
        requestName: req.name || `${req.method} ${targetUrl}`,
        method: req.method,
        url: req.url,
        resolvedUrl: targetUrl,
        status: responseData.status,
        duration: responseData.duration,
        size: responseData.size,
        timestamp: Date.now(),
        response: responseData,
      };

      setHistory((prev) => [historyItem, ...prev.slice(0, 49)]);
      return responseData;
    } catch (err: any) {
      const errResp: ExecutionResponse = {
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: JSON.stringify({ error: err.message || 'Failed to proxy request' }, null, 2),
        size: 0,
        duration: 0,
        timestamp: Date.now(),
        ok: false,
        error: err.message,
        scriptLogs,
      };
      setLastResponse(errResp);
      return errResp;
    } finally {
      setIsExecuting(false);
    }
  };

  // Keyboard shortcut listener for Ctrl/Cmd + Enter to send
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (activeRequest && activeTabMode === 'editor') {
          e.preventDefault();
          handleExecuteRequest(activeRequest);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeRequest, activeTabMode, scopeCtx]);

  // Tab Management Helpers
  const handleOpenRequestInTab = (fileId: string, requestId: string) => {
    setActiveFileId(fileId);
    setActiveRequestId(requestId);

    const file = activeProject?.files?.find((f) => f.id === fileId);
    const req = file?.requests?.find((r) => r.id === requestId);

    const existingTab = tabs?.find((t) => t.requestId === requestId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: WorkspaceTab = {
        id: 'tab_' + Math.random().toString(36).substring(2, 9),
        type: 'request',
        title: req?.name || 'REST Request',
        fileId,
        requestId,
        method: req?.method || 'GET',
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
    setActiveTabMode('editor');
  };

  const handleCreateNewTabWithDummy = () => {
    const targetFile = activeFile || activeProject?.files?.[0];
    if (!targetFile || !activeProject) {
      setIsQuickNewRequestOpen(true);
      return;
    }

    const dummyReq: RestRequest = {
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: 'New Request',
      method: 'GET',
      url: '{{baseUrl}}/users',
      headers: [
        { id: 'h1', key: 'Accept', value: 'application/json', enabled: true },
      ],
      queryParams: [],
      body: { mode: 'none', rawText: '' },
      auth: { type: 'inherit', bearerToken: '' },
    };

    const updatedFiles = (activeProject.files || []).map((f) =>
      f.id === targetFile.id ? { ...f, requests: [...(f.requests || []), dummyReq] } : f
    );
    updateProjectFiles(updatedFiles);

    handleOpenRequestInTab(targetFile.id, dummyReq.id);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length <= 1) {
      // Don't close last tab, replace with onboarding
      setTabs([
        {
          id: 'tab_onboarding',
          type: 'onboarding',
          title: 'Welcome Workspace',
        },
      ]);
      setActiveTabId('tab_onboarding');
      return;
    }

    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const handleCloseOtherTabs = (targetTabId: string) => {
    const targetTab = tabs.find((t) => t.id === targetTabId);
    if (targetTab) {
      setTabs([targetTab]);
      setActiveTabId(targetTab.id);
      showToast('info', 'Tabs Closed', 'Closed all other tabs.');
    }
  };

  const handleCloseTabsToRight = (targetTabId: string) => {
    const index = tabs.findIndex((t) => t.id === targetTabId);
    if (index !== -1) {
      const newTabs = tabs.slice(0, index + 1);
      setTabs(newTabs);
      if (!newTabs.some((t) => t.id === activeTabId)) {
        setActiveTabId(targetTabId);
      }
      showToast('info', 'Tabs Closed', 'Closed tabs to the right.');
    }
  };

  const handleCloseTabsToLeft = (targetTabId: string) => {
    const index = tabs.findIndex((t) => t.id === targetTabId);
    if (index !== -1) {
      const newTabs = tabs.slice(index);
      setTabs(newTabs);
      if (!newTabs.some((t) => t.id === activeTabId)) {
        setActiveTabId(targetTabId);
      }
      showToast('info', 'Tabs Closed', 'Closed tabs to the left.');
    }
  };

  const handleCloseAllTabs = () => {
    const onboardingTab: WorkspaceTab = {
      id: 'tab_onboarding',
      type: 'onboarding',
      title: 'Welcome Workspace',
    };
    setTabs([onboardingTab]);
    setActiveTabId(onboardingTab.id);
    showToast('info', 'All Tabs Closed', 'Closed all open workspace tabs.');
  };

  // State Updates for Organizations / Projects / Files
  const updateProjectFiles = (updatedFiles: RestFile[]) => {
    if (!activeOrg || !activeProject) return;
    setOrganizations((prevOrgs) =>
      prevOrgs.map((org) =>
        org.id === activeOrg.id
          ? {
              ...org,
              projects: (org.projects || []).map((p) =>
                p.id === activeProject.id ? { ...p, files: updatedFiles, updatedAt: Date.now() } : p
              ),
            }
          : org
      )
    );
  };

  const handleUpdateActiveRequest = (updatedReq: RestRequest) => {
    if (!activeFile || !activeProject) return;
    const updatedRequests = (activeFile.requests || []).map((r) => (r.id === updatedReq.id ? updatedReq : r));
    const updatedFiles = (activeProject.files || []).map((f) =>
      f.id === activeFile.id ? { ...f, requests: updatedRequests, updatedAt: Date.now() } : f
    );
    updateProjectFiles(updatedFiles);
  };

  // FILE CRUD
  const handleCreateFile = (fileName: string, folderId?: string) => {
    if (!activeOrg || !activeProject) return;
    const newFileId = 'file_' + Math.random().toString(36).substring(2, 9);
    const newFile: RestFile = {
      id: newFileId,
      name: fileName,
      rawContent: `@baseUrl = {{baseUrl}}\n\n### GET Initial Endpoint\nGET {{baseUrl}}/users\n`,
      requests: [
        {
          id: 'req_init_' + Math.random().toString(36).substring(2, 9),
          name: 'GET Initial Endpoint',
          method: 'GET',
          url: '{{baseUrl}}/users',
          headers: [],
          queryParams: [],
          body: { mode: 'none', rawText: '' },
          auth: { type: 'none', bearerToken: '' },
        },
      ],
      updatedAt: Date.now(),
    };

    const updatedFiles = [...(activeProject.files || []), newFile];

    if (folderId) {
      const updatedFolders = (activeProject.folders || []).map((f) =>
        f.id === folderId ? { ...f, fileIds: [...(f.fileIds || []), newFileId] } : f
      );
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === activeOrg.id
            ? {
                ...org,
                projects: (org.projects || []).map((p) =>
                  p.id === activeProject.id
                    ? { ...p, files: updatedFiles, folders: updatedFolders }
                    : p
                ),
              }
            : org
        )
      );
    } else {
      updateProjectFiles(updatedFiles);
    }

    handleOpenRequestInTab(newFile.id, newFile.requests[0].id);
    showToast('success', 'File Created', `Created REST file "${newFile.name}" successfully.`);
  };

  const handleRenameFile = (fileId: string, newName: string) => {
    if (!activeProject) return;
    const updatedFiles = (activeProject.files || []).map((f) =>
      f.id === fileId ? { ...f, name: newName, updatedAt: Date.now() } : f
    );
    updateProjectFiles(updatedFiles);
    showToast('success', 'File Renamed', `Renamed file to "${newName}".`);
  };

  const handleDuplicateFile = (fileId: string) => {
    if (!activeOrg || !activeProject) return;
    const targetFile = (activeProject.files || []).find((f) => f.id === fileId);
    if (!targetFile) return;

    const dupFileId = 'file_' + Math.random().toString(36).substring(2, 9);
    const duplicatedRequests = (targetFile.requests || []).map((r) => ({
      ...r,
      id: 'req_' + Math.random().toString(36).substring(2, 9),
    }));

    const dupFile: RestFile = {
      ...targetFile,
      id: dupFileId,
      name: `copy_${targetFile.name}`,
      requests: duplicatedRequests,
      updatedAt: Date.now(),
    };

    const updatedFiles = [...(activeProject.files || []), dupFile];

    // Preserve folder location if the file was in a folder
    const parentFolder = (activeProject.folders || []).find((f) => f.fileIds?.includes(fileId));
    if (parentFolder) {
      const updatedFolders = (activeProject.folders || []).map((f) =>
        f.id === parentFolder.id ? { ...f, fileIds: [...(f.fileIds || []), dupFileId] } : f
      );
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === activeOrg.id
            ? {
                ...org,
                projects: (org.projects || []).map((p) =>
                  p.id === activeProject.id
                    ? { ...p, files: updatedFiles, folders: updatedFolders }
                    : p
                ),
              }
            : org
        )
      );
    } else {
      updateProjectFiles(updatedFiles);
    }

    if (duplicatedRequests.length > 0) {
      handleOpenRequestInTab(dupFileId, duplicatedRequests[0].id);
    }
    showToast(
      'success',
      'File Duplicated Successfully',
      `Created "${dupFile.name}" with ${duplicatedRequests.length} endpoints.`
    );
  };

  const handleDeleteFile = (fileId: string) => {
    if (!activeOrg || !activeProject) return;
    const targetFile = (activeProject.files || []).find((f) => f.id === fileId);
    const updatedFiles = (activeProject.files || []).filter((f) => f.id !== fileId);
    const updatedFolders = (activeProject.folders || []).map((f) => ({
      ...f,
      fileIds: (f.fileIds || []).filter((id) => id !== fileId),
    }));

    setOrganizations((prev) =>
      prev.map((org) =>
        org.id === activeOrg.id
          ? {
              ...org,
              projects: (org.projects || []).map((p) =>
                p.id === activeProject.id
                  ? { ...p, files: updatedFiles, folders: updatedFolders }
                  : p
              ),
            }
          : org
      )
    );
    showToast('info', 'File Deleted', `Deleted file "${targetFile?.name || 'file'}".`);
  };

  const handleMoveFileToFolder = (fileId: string, targetFolderId: string | null) => {
    const targetFolder = (activeProject.folders || []).find((f) => f.id === targetFolderId);
    const targetFile = (activeProject.files || []).find((f) => f.id === fileId);
    const updatedFolders = activeProject.folders.map((f) => {
      if (f.id === targetFolderId) {
        return f.fileIds.includes(fileId) ? f : { ...f, fileIds: [...f.fileIds, fileId] };
      } else {
        return { ...f, fileIds: f.fileIds.filter((id) => id !== fileId) };
      }
    });

    setOrganizations((prev) =>
      prev.map((org) =>
        org.id === activeOrg.id
          ? {
              ...org,
              projects: org.projects.map((p) =>
                p.id === activeProject.id ? { ...p, folders: updatedFolders } : p
              ),
            }
          : org
      )
    );
    showToast(
      'success',
      'File Moved',
      `Moved "${targetFile?.name || 'file'}" to ${targetFolder ? `folder "${targetFolder.name}"` : 'Root level'}.`
    );
  };

  // FOLDER CRUD
  const handleCreateFolder = (folderName: string) => {
    const newFolder = {
      id: 'folder_' + Math.random().toString(36).substring(2, 9),
      name: folderName,
      fileIds: [],
    };

    setOrganizations((prev) =>
      prev.map((org) =>
        org.id === activeOrg.id
          ? {
              ...org,
              projects: org.projects.map((p) =>
                p.id === activeProject.id ? { ...p, folders: [...p.folders, newFolder] } : p
              ),
            }
          : org
      )
    );
    showToast('success', 'Folder Created', `Created folder "${folderName}".`);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    const updatedFolders = activeProject.folders.map((f) =>
      f.id === folderId ? { ...f, name: newName } : f
    );
    setOrganizations((prev) =>
      prev.map((org) =>
        org.id === activeOrg.id
          ? {
              ...org,
              projects: org.projects.map((p) =>
                p.id === activeProject.id ? { ...p, folders: updatedFolders } : p
              ),
            }
          : org
      )
    );
    showToast('success', 'Folder Renamed', `Renamed folder to "${newName}".`);
  };

  const handleDeleteFolder = (folderId: string) => {
    const targetFolder = (activeProject.folders || []).find((f) => f.id === folderId);
    const updatedFolders = activeProject.folders.filter((f) => f.id !== folderId);
    setOrganizations((prev) =>
      prev.map((org) =>
        org.id === activeOrg.id
          ? {
              ...org,
              projects: org.projects.map((p) =>
                p.id === activeProject.id ? { ...p, folders: updatedFolders } : p
              ),
            }
          : org
      )
    );
    showToast('info', 'Folder Deleted', `Deleted folder "${targetFolder?.name || 'folder'}".`);
  };

  // REQUEST CRUD
  const handleCreateRequest = (fileId: string, method: HTTPMethod, name: string, url?: string) => {
    const targetFile = (activeProject.files || []).find((f) => f.id === fileId);
    const newReq: RestRequest = {
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: name || `${method} Endpoint`,
      method,
      url: url || '{{baseUrl}}/endpoint',
      headers: [],
      queryParams: [],
      body: { mode: 'none', rawText: '' },
      auth: { type: 'none', bearerToken: '' },
    };

    const updatedFiles = activeProject.files.map((f) =>
      f.id === fileId ? { ...f, requests: [...(f.requests || []), newReq], updatedAt: Date.now() } : f
    );
    updateProjectFiles(updatedFiles);
    handleOpenRequestInTab(fileId, newReq.id);
    showToast('success', 'Endpoint Created', `Added "${newReq.name}" to ${targetFile?.name || 'file'}.`);
  };

  const handleCreateNewFileAndRequest = (fileName: string, method: HTTPMethod, name: string, url?: string) => {
    if (!activeProject) return;
    const newReq: RestRequest = {
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: name || `${method} Endpoint`,
      method,
      url: url || '{{baseUrl}}/endpoint',
      headers: [],
      queryParams: [],
      body: { mode: 'none', rawText: '' },
      auth: { type: 'none', bearerToken: '' },
    };

    const newFile: RestFile = {
      id: 'file_' + Math.random().toString(36).substring(2, 9),
      name: fileName,
      rawContent: `### ${newReq.name}\n${method} ${url || '{{baseUrl}}/endpoint'}\n`,
      requests: [newReq],
      updatedAt: Date.now(),
    };

    updateProjectFiles([...(activeProject.files || []), newFile]);
    handleOpenRequestInTab(newFile.id, newReq.id);
    showToast('success', 'File & Request Created', `Created "${fileName}" with endpoint "${newReq.name}".`);
  };

  const handleImportQuickCurl = (req: RestRequest, targetFileId?: string) => {
    if (!activeProject) return;

    let targetFile = (activeProject.files || []).find((f) => f.id === targetFileId) || activeFile || activeProject.files?.[0];

    if (!targetFile) {
      // Create a default file if project has no files
      const newFile: RestFile = {
        id: 'file_' + Math.random().toString(36).substring(2, 9),
        name: 'curl_requests.rest',
        rawContent: '',
        requests: [req],
        updatedAt: Date.now(),
      };
      updateProjectFiles([newFile]);
      handleOpenRequestInTab(newFile.id, req.id);
      showToast('success', 'cURL Endpoint Imported', `Imported "${req.name}" into new curl_requests.rest file.`);
      return;
    }

    const updatedFiles = (activeProject.files || []).map((f) =>
      f.id === targetFile!.id ? { ...f, requests: [...(f.requests || []), req], updatedAt: Date.now() } : f
    );
    updateProjectFiles(updatedFiles);
    handleOpenRequestInTab(targetFile.id, req.id);
    showToast('success', 'cURL Endpoint Imported', `Imported "${req.name}" into ${targetFile.name}.`);
  };

  const handleRenameRequest = (fileId: string, requestId: string, newName: string) => {
    if (!activeProject) return;
    const targetFile = (activeProject.files || []).find((f) => f.id === fileId);
    if (!targetFile) return;

    const updatedRequests = (targetFile.requests || []).map((r) =>
      r.id === requestId ? { ...r, name: newName } : r
    );
    const updatedFiles = (activeProject.files || []).map((f) =>
      f.id === fileId ? { ...f, requests: updatedRequests } : f
    );
    updateProjectFiles(updatedFiles);
  };

  const handleDuplicateRequest = (fileId: string, requestId: string) => {
    if (!activeProject) return;
    const targetFile = (activeProject.files || []).find((f) => f.id === fileId);
    if (!targetFile) return;

    const targetReq = (targetFile.requests || []).find((r) => r.id === requestId);
    if (!targetReq) return;

    const dupReq: RestRequest = {
      ...targetReq,
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: `${targetReq.name} (Copy)`,
    };

    // Insert right after targetReq for intuitive ordering
    const targetIdx = (targetFile.requests || []).findIndex((r) => r.id === requestId);
    const updatedRequests = [...(targetFile.requests || [])];
    if (targetIdx !== -1) {
      updatedRequests.splice(targetIdx + 1, 0, dupReq);
    } else {
      updatedRequests.push(dupReq);
    }

    const updatedFiles = (activeProject.files || []).map((f) =>
      f.id === fileId ? { ...f, requests: updatedRequests } : f
    );
    updateProjectFiles(updatedFiles);
    handleOpenRequestInTab(fileId, dupReq.id);
    showToast(
      'success',
      'Request Duplicated',
      `Duplicated "${targetReq.name}" as "${dupReq.name}" in ${targetFile.name}.`
    );
  };

  const handleDeleteRequest = (fileId: string, requestId: string) => {
    if (!activeProject) return;
    const targetFile = (activeProject.files || []).find((f) => f.id === fileId);
    if (!targetFile) return;

    const targetReq = (targetFile.requests || []).find((r) => r.id === requestId);
    const updatedRequests = (targetFile.requests || []).filter((r) => r.id !== requestId);
    const updatedFiles = (activeProject.files || []).map((f) =>
      f.id === fileId ? { ...f, requests: updatedRequests } : f
    );
    updateProjectFiles(updatedFiles);
    showToast('info', 'Endpoint Deleted', `Deleted endpoint "${targetReq?.name || 'request'}".`);
  };

  const handleMoveRequestOrder = (fileId: string, requestId: string, direction: 'up' | 'down') => {
    if (!activeProject) return;
    const targetFile = (activeProject.files || []).find((f) => f.id === fileId);
    if (!targetFile) return;

    const idx = (targetFile.requests || []).findIndex((r) => r.id === requestId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= (targetFile.requests || []).length) return;

    const newReqs = [...(targetFile.requests || [])];
    const temp = newReqs[idx];
    newReqs[idx] = newReqs[targetIdx];
    newReqs[targetIdx] = temp;

    const updatedFiles = (activeProject.files || []).map((f) =>
      f.id === fileId ? { ...f, requests: newReqs } : f
    );
    updateProjectFiles(updatedFiles);
  };

  // POSTMAN IMPORT
  const handleImportPostman = (
    newFolders: { id: string; name: string; fileIds: string[] }[],
    newFiles: RestFile[]
  ) => {
    setOrganizations((prev) =>
      prev.map((org) =>
        org.id === activeOrg.id
          ? {
              ...org,
              projects: org.projects.map((p) =>
                p.id === activeProject.id
                  ? {
                      ...p,
                      folders: [...p.folders, ...newFolders],
                      files: [...p.files, ...newFiles],
                      updatedAt: Date.now(),
                    }
                  : p
              ),
            }
          : org
      )
    );

    if (newFiles.length > 0 && newFiles[0].requests.length > 0) {
      handleOpenRequestInTab(newFiles[0].id, newFiles[0].requests[0].id);
    }
  };

  // New Organization & New Project Modals
  const handleCreateNewOrg = () => {
    setAppPromptState({
      isOpen: true,
      title: 'New Organization',
      message: 'Enter name for your new organization workspace:',
      initialValue: 'FinTech Global Corp',
      placeholder: 'e.g. Acme Corp',
      confirmLabel: 'Create Organization',
      onConfirm: (name) => {
        if (!name) return;

        const newOrg: Organization = {
          id: 'org_' + Math.random().toString(36).substring(2, 9),
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          variables: [
            { id: 'ov1', key: 'orgDomain', value: 'api.fintech.internal', enabled: true },
          ],
          projects: [
            {
              id: 'proj_' + Math.random().toString(36).substring(2, 9),
              name: 'Core Payment Service',
              description: 'Payment API Gateway',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              activeEnvId: 'env_dev',
              environments: [
                {
                  id: 'env_dev',
                  name: 'Development',
                  color: '#10b981',
                  variables: [
                    { id: 'v1', key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true },
                  ],
                },
              ],
              folders: [],
              files: [
                {
                  id: 'file_init',
                  name: 'payments.rest',
                  updatedAt: Date.now(),
                  rawContent: `### Get Payment Status\nGET {{baseUrl}}/todos/1\n`,
                  requests: [
                    {
                      id: 'req_pay',
                      name: 'Get Payment Status',
                      method: 'GET',
                      url: '{{baseUrl}}/todos/1',
                      headers: [],
                      queryParams: [],
                      body: { mode: 'none', rawText: '' },
                      auth: { type: 'none', bearerToken: '' },
                    },
                  ],
                },
              ],
            },
          ],
        };

        setOrganizations([...organizations, newOrg]);
        setActiveOrgId(newOrg.id);
      },
    });
  };

  const handleCreateNewProject = () => {
    setAppPromptState({
      isOpen: true,
      title: 'New Project',
      message: `Enter new project name inside ${activeOrg?.name || 'Organization'}:`,
      initialValue: 'Microservice Suite',
      placeholder: 'e.g. Payment Gateway',
      confirmLabel: 'Create Project',
      onConfirm: (name) => {
        if (!name) return;

        const newProj: Project = {
          id: 'proj_' + Math.random().toString(36).substring(2, 9),
          name,
          description: 'REST Client Workspace',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          activeEnvId: 'env_dev_' + Date.now(),
          environments: [
            {
              id: 'env_dev_' + Date.now(),
              name: 'Development',
              color: '#10b981',
              variables: [
                { id: 'v1', key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true },
              ],
            },
          ],
          folders: [],
          files: [
            {
              id: 'file_default_' + Date.now(),
              name: 'api.rest',
              updatedAt: Date.now(),
              rawContent: `### Get All Items\nGET {{baseUrl}}/posts\n`,
              requests: [
                {
                  id: 'req_def_' + Date.now(),
                  name: 'Get All Items',
                  method: 'GET',
                  url: '{{baseUrl}}/posts',
                  headers: [],
                  queryParams: [],
                  body: { mode: 'none', rawText: '' },
                  auth: { type: 'none', bearerToken: '' },
                },
              ],
            },
          ],
        };

        const updatedOrg = {
          ...activeOrg,
          projects: [...(activeOrg.projects || []), newProj],
        };

        setOrganizations(organizations.map((o) => (o.id === activeOrg.id ? updatedOrg : o)));
        setActiveProjectId(newProj.id);
        showToast('success', 'Project Created', `Created project "${name}".`);
      },
    });
  };

  // Organization Rename & Delete
  const handleRenameOrg = (orgId: string, currentName: string) => {
    setAppPromptState({
      isOpen: true,
      title: 'Rename Organization',
      message: 'Enter new name for organization:',
      initialValue: currentName,
      placeholder: 'e.g. Acme Corp',
      confirmLabel: 'Save Name',
      onConfirm: (newName) => {
        if (!newName || !newName.trim()) return;
        setOrganizations((prev) =>
          prev.map((o) => (o.id === orgId ? { ...o, name: newName.trim(), updatedAt: Date.now() } : o))
        );
        showToast('success', 'Organization Renamed', 'Organization renamed successfully.');
      },
    });
  };

  const handleDeleteOrg = (orgId: string, currentName: string) => {
    if (organizations.length <= 1) {
      showToast('error', 'Delete Error', 'Cannot delete the only organization workspace.');
      return;
    }
    setAppPromptState({
      isOpen: true,
      title: 'Delete Organization',
      message: `Are you sure you want to delete "${currentName}"? All projects, files, and endpoints inside this organization will be removed.`,
      hideInput: true,
      confirmLabel: 'Delete Organization',
      onConfirm: () => {
        const remaining = organizations.filter((o) => o.id !== orgId);
        setOrganizations(remaining);
        if (activeOrgId === orgId) {
          setActiveOrgId(remaining[0].id);
          if (remaining[0].projects.length > 0) {
            setActiveProjectId(remaining[0].projects[0].id);
          }
        }
        showToast('info', 'Organization Deleted', `Organization "${currentName}" deleted.`);
      },
    });
  };

  // Project Rename & Delete
  const handleRenameProject = (projectId: string, currentName: string) => {
    setAppPromptState({
      isOpen: true,
      title: 'Rename Project',
      message: 'Enter new name for project:',
      initialValue: currentName,
      placeholder: 'e.g. Microservices',
      confirmLabel: 'Save Name',
      onConfirm: (newName) => {
        if (!newName || !newName.trim()) return;
        setOrganizations((prev) =>
          prev.map((org) =>
            org.id === activeOrg.id
              ? {
                  ...org,
                  projects: org.projects.map((p) =>
                    p.id === projectId ? { ...p, name: newName.trim(), updatedAt: Date.now() } : p
                  ),
                }
              : org
          )
        );
        showToast('success', 'Project Renamed', 'Project renamed successfully.');
      },
    });
  };

  const handleDeleteProject = (projectId: string, currentName: string) => {
    setAppPromptState({
      isOpen: true,
      title: 'Delete Project',
      message: `Are you sure you want to delete project "${currentName}"?`,
      hideInput: true,
      confirmLabel: 'Delete Project',
      onConfirm: () => {
        const currentProjects = activeOrg?.projects || [];
        const remaining = currentProjects.filter((p) => p.id !== projectId);

        let finalProjects = remaining;
        if (remaining.length === 0) {
          const defaultProj: Project = {
            id: 'proj_' + Math.random().toString(36).substring(2, 9),
            name: 'API Workspace',
            description: 'Default REST Project',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            activeEnvId: 'env_dev',
            environments: [
              {
                id: 'env_dev',
                name: 'Development',
                color: '#10b981',
                variables: [
                  { id: 'v1', key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true },
                ],
              },
            ],
            folders: [],
            files: [
              {
                id: 'file_default',
                name: 'default.rest',
                updatedAt: Date.now(),
                rawContent: `### Health Check\nGET {{baseUrl}}/todos/1\n`,
                requests: [
                  {
                    id: 'req_hc',
                    name: 'Health Check',
                    method: 'GET',
                    url: '{{baseUrl}}/todos/1',
                    headers: [],
                    queryParams: [],
                    body: { mode: 'none', rawText: '' },
                    auth: { type: 'none', bearerToken: '' },
                  },
                ],
              },
            ],
          };
          finalProjects = [defaultProj];
        }

        setOrganizations((prev) =>
          prev.map((org) =>
            org.id === activeOrg.id
              ? {
                  ...org,
                  projects: finalProjects,
                }
              : org
          )
        );

        if (activeProjectId === projectId) {
          setActiveProjectId(finalProjects[0].id);
        }

        showToast('info', 'Project Deleted', `Project "${currentName}" deleted.`);
      },
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-slate-950 via-[#0b1220] to-[#0f172a] text-slate-100 font-sans overflow-hidden select-none">
      {/* Top Header */}
      <Header
        organizations={organizations}
        activeOrg={activeOrg}
        onSelectOrg={(org) => setActiveOrgId(org.id)}
        onOpenNewOrgModal={handleCreateNewOrg}
        onRenameOrg={handleRenameOrg}
        onDeleteOrg={handleDeleteOrg}
        projects={activeOrg?.projects || []}
        activeProject={activeProject}
        onSelectProject={(p) => setActiveProjectId(p.id)}
        onOpenNewProjectModal={handleCreateNewProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onSelectEnvironment={(envId) => {
          setOrganizations((prev) =>
            prev.map((org) =>
              org.id === activeOrg.id
                ? {
                    ...org,
                    projects: org.projects.map((p) =>
                      p.id === activeProject.id ? { ...p, activeEnvId: envId } : p
                    ),
                  }
                : org
            )
          );
        }}
        onOpenEnvManager={() => setIsEnvManagerOpen(true)}
        activeTab={activeTabMode}
        onChangeTab={setActiveTabMode}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onOpenQuickHelp={() => setIsQuickHelpOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenQuickNewRequest={() => setIsQuickNewRequestOpen(true)}
        onOpenQuickCurl={() => setIsQuickCurlOpen(true)}
        historyCount={history.length}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Multi Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={(tabId) => {
          setActiveTabId(tabId);
          const tabObj = tabs.find((t) => t.id === tabId);
          if (tabObj && tabObj.fileId && tabObj.requestId) {
            setActiveFileId(tabObj.fileId);
            setActiveRequestId(tabObj.requestId);
          }
        }}
        onCloseTab={handleCloseTab}
        onCloseOtherTabs={handleCloseOtherTabs}
        onCloseTabsToRight={handleCloseTabsToRight}
        onCloseTabsToLeft={handleCloseTabsToLeft}
        onCloseAllTabs={handleCloseAllTabs}
        onNewTab={handleCreateNewTabWithDummy}
        onOpenQuickNewRequest={() => setIsQuickNewRequestOpen(true)}
        onOpenQuickCurl={() => setIsQuickCurlOpen(true)}
        splitOrientation={splitOrientation}
        onToggleSplitOrientation={() =>
          setSplitOrientation(splitOrientation === 'top-bottom' ? 'left-right' : 'top-bottom')
        }
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          project={activeProject}
          activeFileId={activeFileId}
          activeRequestId={activeRequestId}
          onSelectFile={(fId) => {
            setActiveFileId(fId);
            const f = activeProject?.files?.find((file) => file.id === fId);
            if (f && f.requests && f.requests.length > 0) handleOpenRequestInTab(fId, f.requests[0].id);
          }}
          onSelectRequest={(fId, rId) => handleOpenRequestInTab(fId, rId)}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onRenameFile={handleRenameFile}
          onDuplicateFile={handleDuplicateFile}
          onDeleteFile={handleDeleteFile}
          onMoveFileToFolder={handleMoveFileToFolder}
          onCreateRequest={handleCreateRequest}
          onRenameRequest={handleRenameRequest}
          onDuplicateRequest={handleDuplicateRequest}
          onDeleteRequest={handleDeleteRequest}
          onMoveRequestOrder={handleMoveRequestOrder}
          onOpenQuickNewRequest={() => setIsQuickNewRequestOpen(true)}
          onOpenQuickCurl={() => setIsQuickCurlOpen(true)}
        />

        {/* Central Workspace Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden bg-transparent">
          {/* If current activeTabObj is onboarding, show OnboardingScreen */}
          {activeTabObj?.type === 'onboarding' ? (
            <OnboardingScreen
              onCreateNewRequest={handleCreateNewTabWithDummy}
              onOpenImportModal={() => setIsImportExportOpen(true)}
            />
          ) : (
            <>
              {/* TAB MODE 1: REQUEST BUILDER (Split Layout options: Top/Bottom or Left/Right) */}
              {activeTabMode === 'editor' && (
                <>
                  {activeRequest ? (
                    <div
                      id="resizable-container"
                      className={`flex-1 flex overflow-hidden relative ${
                        splitOrientation === 'top-bottom' ? 'flex-col' : 'flex-row'
                      }`}
                    >
                      {/* Section 1: Request Editor */}
                      <div
                        style={{
                          [splitOrientation === 'top-bottom' ? 'height' : 'width']: `${splitRatio}%`,
                        }}
                        className="overflow-hidden flex flex-col min-h-[150px] min-w-[200px]"
                      >
                        <RequestEditor
                          request={activeRequest}
                          scopeCtx={scopeCtx}
                          envVariables={activeEnv?.variables || []}
                          fileVariables={activeFile?.fileVariables || {}}
                          projectAuth={activeProject?.auth}
                          onUpdateProjectAuth={handleUpdateProjectAuth}
                          onUpdateRequest={handleUpdateActiveRequest}
                          onSendRequest={handleExecuteRequest}
                          isLoading={isExecuting}
                          lastResponse={lastResponse}
                        />
                      </div>

                      {/* Resizable Splitter Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          isDraggingSplitter.current = true;
                          document.body.style.cursor =
                            splitOrientation === 'top-bottom' ? 'row-resize' : 'col-resize';
                          document.body.style.userSelect = 'none';
                        }}
                        className={`bg-slate-800 hover:bg-emerald-500/80 active:bg-emerald-400 transition-colors z-20 shrink-0 ${
                          splitOrientation === 'top-bottom'
                            ? 'h-1.5 cursor-row-resize w-full'
                            : 'w-1.5 cursor-col-resize h-full'
                        }`}
                        title="Click and drag to resize Request / Response sections"
                      />

                      {/* Section 2: Response Viewer */}
                      <div
                        style={{
                          [splitOrientation === 'top-bottom' ? 'height' : 'width']: `${100 - splitRatio}%`,
                        }}
                        className="overflow-hidden flex flex-col min-h-[150px] min-w-[200px]"
                      >
                        <ResponseViewer
                          response={lastResponse}
                          isLoading={isExecuting}
                          assertions={activeRequest.assertions}
                          savedResponses={activeRequest.savedResponses}
                          onSaveResponseSnapshot={(resp, name) => {
                            const newSnapshot = {
                              id: 'snap_' + Math.random().toString(36).substring(2, 9),
                              name,
                              timestamp: Date.now(),
                              response: resp,
                            };
                            const updatedSaved = [...(activeRequest.savedResponses || []), newSnapshot];
                            handleUpdateActiveRequest({ ...activeRequest, savedResponses: updatedSaved });
                          }}
                          onDeleteSavedResponseSnapshot={(snapId) => {
                            const updatedSaved = (activeRequest.savedResponses || []).filter((s) => s.id !== snapId);
                            handleUpdateActiveRequest({ ...activeRequest, savedResponses: updatedSaved });
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs">
                      Select or create a REST request from the left sidebar.
                    </div>
                  )}
                </>
              )}

              {/* TAB MODE 2: RAW .REST FILE CODE EDITOR */}
              {activeTabMode === 'code' && (
                <>
                  {activeFile ? (
                    <RestFileEditor
                      file={activeFile}
                      scopeCtx={scopeCtx}
                      onSaveFileContent={(fId, rawText, parsedRequests) => {
                        if (!activeProject) return;
                        const updatedFiles = (activeProject.files || []).map((f) =>
                          f.id === fId ? { ...f, rawContent: rawText, requests: parsedRequests } : f
                        );
                        updateProjectFiles(updatedFiles);
                      }}
                      onRunSingleRequest={(req) => handleExecuteRequest(req)}
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs">
                      No REST file selected. Create or select a file in sidebar.
                    </div>
                  )}
                </>
              )}

              {/* TAB MODE 3: COLLECTION RUNNER */}
              {activeTabMode === 'runner' && (
                <CollectionRunner
                  project={activeProject}
                  onExecuteRequestProxy={handleExecuteRequest}
                />
              )}

              {/* TAB MODE 4: HISTORY VIEWER */}
              {activeTabMode === 'history' && (
                <HistoryViewer
                  history={history}
                  onClearHistory={() => setHistory([])}
                  onSelectHistoryItem={(item) => {
                    setLastResponse(item.response);
                    setActiveTabMode('editor');
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Environment Hierarchy Manager Modal */}
      {isEnvManagerOpen && (
        <EnvironmentManager
          organization={activeOrg}
          project={activeProject}
          globalVariables={globalVariables}
          onClose={() => setIsEnvManagerOpen(false)}
          onUpdateGlobalVariables={setGlobalVariables}
          onUpdateOrganizationVariables={(updatedOrgVars) => {
            setOrganizations((prev) =>
              prev.map((org) => (org.id === activeOrg.id ? { ...org, variables: updatedOrgVars } : org))
            );
          }}
          onUpdateProjectEnvironments={(updatedEnvs, activeEnvId) => {
            setOrganizations((prev) =>
              prev.map((org) =>
                org.id === activeOrg.id
                  ? {
                      ...org,
                      projects: org.projects.map((p) =>
                        p.id === activeProject.id
                          ? { ...p, environments: updatedEnvs, activeEnvId: activeEnvId }
                          : p
                      ),
                    }
                  : org
              )
            );
          }}
          onUpdateFolderVariables={(folderId, updatedVars) => {
            setOrganizations((prev) =>
              prev.map((org) =>
                org.id === activeOrg.id
                  ? {
                      ...org,
                      projects: org.projects.map((p) =>
                        p.id === activeProject.id
                          ? {
                              ...p,
                              folders: p.folders.map((f) =>
                                f.id === folderId ? { ...f, variables: updatedVars } : f
                              ),
                            }
                          : p
                      ),
                    }
                  : org
              )
            );
          }}
        />
      )}

      {/* Import / Export Workspace Modal */}
      {isImportExportOpen && (
        <ImportExportModal
          project={activeProject}
          isDarkMode={isDarkMode}
          onClose={() => setIsImportExportOpen(false)}
          onImportRestFile={(fileName, content) => {
            if (!activeProject) return;
            const parsed = parseRestFileContent(content, fileName);
            const newFile: RestFile = {
              id: 'file_' + Math.random().toString(36).substring(2, 9),
              name: fileName,
              rawContent: content,
              requests: parsed.requests,
              fileVariables: parsed.fileVariables,
              updatedAt: Date.now(),
            };
            updateProjectFiles([...(activeProject.files || []), newFile]);
            if (newFile.requests.length > 0) {
              handleOpenRequestInTab(newFile.id, newFile.requests[0].id);
            }
          }}
          onImportCurl={(req) => {
            if (activeFile && activeProject) {
              const updatedFiles = (activeProject.files || []).map((f) =>
                f.id === activeFile.id ? { ...f, requests: [...(f.requests || []), req] } : f
              );
              updateProjectFiles(updatedFiles);
              handleOpenRequestInTab(activeFile.id, req.id);
            }
          }}
          onImportPostman={handleImportPostman}
        />
      )}

      {/* Quick Help Modal */}
      {isQuickHelpOpen && (
        <QuickHelpModal onClose={() => setIsQuickHelpOpen(false)} />
      )}

      {/* Quick New Request Modal */}
      <QuickNewRequestModal
        isOpen={isQuickNewRequestOpen}
        project={activeProject}
        activeFileId={activeFileId}
        isDarkMode={isDarkMode}
        initialPasteText={initialPasteText}
        onClose={() => {
          setIsQuickNewRequestOpen(false);
          setInitialPasteText('');
        }}
        onCreateRequest={handleCreateRequest}
        onCreateNewFileAndRequest={handleCreateNewFileAndRequest}
      />

      {/* Quick Request from cURL Modal */}
      <QuickCurlModal
        isOpen={isQuickCurlOpen}
        project={activeProject}
        activeFileId={activeFileId}
        isDarkMode={isDarkMode}
        onClose={() => setIsQuickCurlOpen(false)}
        onImportCurl={handleImportQuickCurl}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        showToast={showToast}
      />

      {/* Global App Prompt Modal */}
      <PromptModal
        isOpen={appPromptState.isOpen}
        title={appPromptState.title}
        message={appPromptState.message}
        initialValue={appPromptState.initialValue}
        placeholder={appPromptState.placeholder}
        confirmLabel={appPromptState.confirmLabel}
        hideInput={appPromptState.hideInput}
        isDarkMode={isDarkMode}
        onConfirm={(val) => {
          appPromptState.onConfirm(val);
          setAppPromptState((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setAppPromptState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
