export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'QUERY';

export type EnvVariableScope = 'global' | 'organization' | 'project' | 'folder' | 'file';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
  secret?: boolean;
}

export interface Environment {
  id: string;
  name: string;
  color?: string;
  variables: EnvVariable[];
}

export interface VariableLookupResult {
  key: string;
  value: string;
  scope: EnvVariableScope;
  sourceName: string;
  secret?: boolean;
  overrides?: { scope: EnvVariableScope; sourceName: string; value: string }[];
}

export type AuthType = 'inherit' | 'none' | 'bearer' | 'basic' | 'apikey';

export interface RequestAuth {
  type: AuthType;
  bearerToken: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyAddTo?: 'header' | 'query';
}

export type BodyMode = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'graphql';

export interface RequestBody {
  mode: BodyMode;
  rawText: string;
  formDataItems?: KeyValuePair[];
  urlencodedItems?: KeyValuePair[];
  graphqlQuery?: string;
  graphqlVariables?: string;
}

export interface TestAssertion {
  id: string;
  type: 'status_code' | 'max_time' | 'body_contains' | 'json_property';
  targetValue: string;
  enabled: boolean;
  passed?: boolean;
  message?: string;
}

export interface PreRequestScript {
  enabled: boolean;
  type: 'custom' | 'token_fetch' | 'validate_request';
  script?: string;
  tokenFetchConfig?: {
    tokenUrl: string;
    method: 'POST' | 'GET';
    grantType: 'password' | 'client_credentials' | 'custom_json' | 'x-www-form-urlencoded';
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    customBody?: string;
    tokenJsonPath?: string;
    saveToVarName?: string;
    targetScope?: 'file' | 'environment' | 'global';
    autoInjectHeader?: boolean;
  };
  validationConfig?: {
    requireValidUrl?: boolean;
    requireHeaders?: string[];
    validateJsonBody?: boolean;
    requireNonEmptyParams?: boolean;
  };
}

export interface VariableExtractorItem {
  id: string;
  source: 'body_json' | 'body_regex' | 'header';
  sourcePath: string;
  targetVarName: string;
  targetScope: 'file' | 'environment' | 'global';
  enabled: boolean;
}

export interface PostRequestScript {
  enabled: boolean;
  type: 'custom' | 'extract_variable' | 'validate_response';
  script?: string;
  extractors?: VariableExtractorItem[];
  validationConfig?: {
    expectedStatus?: number;
    maxDurationMs?: number;
    requiredJsonFields?: string[];
  };
}

export interface SavedResponseItem {
  id: string;
  name: string;
  timestamp: number;
  response: ExecutionResponse;
}

export interface RestRequest {
  id: string;
  name: string;
  method: HTTPMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body: RequestBody;
  auth: RequestAuth;
  assertions?: TestAssertion[];
  preRequestScript?: PreRequestScript;
  postRequestScript?: PostRequestScript;
  description?: string;
  savedResponses?: SavedResponseItem[];
}

export interface RestFile {
  id: string;
  name: string;
  rawContent: string;
  requests: RestRequest[];
  fileVariables?: Record<string, string>;
  auth?: RequestAuth;
  updatedAt: number;
}

export interface RestFolder {
  id: string;
  name: string;
  parentId?: string;
  fileIds: string[];
  variables?: EnvVariable[];
  auth?: RequestAuth;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  activeEnvId: string | null;
  environments: Environment[];
  folders: RestFolder[];
  files: RestFile[];
  auth?: RequestAuth;
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  variables: EnvVariable[];
  projects: Project[];
}

export interface WorkspaceTab {
  id: string;
  type: 'request' | 'file' | 'runner' | 'history' | 'onboarding';
  title: string;
  orgId?: string;
  projectId?: string;
  folderId?: string;
  fileId?: string;
  requestId?: string;
  method?: HTTPMethod;
  isDirty?: boolean;
  requestData?: RestRequest;
}

export interface FullWorkspaceData {
  version: number;
  exportedAt: number;
  globalVariables: EnvVariable[];
  organizations: Organization[];
}

export interface ExecutionResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  duration: number;
  timestamp: number;
  ok: boolean;
  error?: string;
  contentType?: string;
  scriptLogs?: string[];
  testResults?: TestAssertion[];
}

export interface RequestHistoryItem {
  id: string;
  projectId: string;
  fileId?: string;
  requestId?: string;
  requestName: string;
  method: HTTPMethod;
  url: string;
  resolvedUrl: string;
  status: number;
  duration: number;
  size: number;
  timestamp: number;
  response: ExecutionResponse;
}

