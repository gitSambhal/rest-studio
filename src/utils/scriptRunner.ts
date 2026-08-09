import { ExecutionResponse, KeyValuePair, PostRequestScript, PreRequestScript, RestRequest, TestAssertion } from '../types';
import { resolveEnvVariables, ScopeContext } from './envUtils';
import { executeHttpRequest } from './httpExecutor';

export interface PreRequestRunResult {
  success: boolean;
  error?: string;
  logs: string[];
  newVariables: Record<string, string>;
  targetScope: 'environment' | 'file' | 'global';
  modifiedUrl?: string;
  modifiedHeaders?: Record<string, string>;
  modifiedBody?: string;
}

export interface PostRequestRunResult {
  logs: string[];
  newVariables: Record<string, string>;
  targetScope: 'environment' | 'file' | 'global';
  assertions?: TestAssertion[];
}

export function getValueByJsonPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    const trimmed = part.trim();
    if (!trimmed) continue;
    current = current[trimmed];
  }
  return current;
}

export async function runPreRequestScript(
  req: RestRequest,
  scopeCtx: ScopeContext,
  initialHeaders: Record<string, string>,
  initialUrl: string,
  initialBody: string
): Promise<PreRequestRunResult> {
  const logs: string[] = [];
  const newVariables: Record<string, string> = {};
  const modifiedHeaders: Record<string, string> = { ...initialHeaders };
  let modifiedUrl = initialUrl;
  let modifiedBody = initialBody;
  let targetScope: 'environment' | 'file' | 'global' = 'environment';

  const script = req.preRequestScript;
  if (!script || !script.enabled) {
    return {
      success: true,
      logs: ['Pre-request script skipped (disabled).'],
      newVariables: {},
      targetScope: 'environment',
    };
  }

  logs.push(`Running Pre-Request Action [Mode: ${script.type}]...`);

  // MODE 1: Token Fetcher (OAuth / Auth Pre-flight)
  if (script.type === 'token_fetch' && script.tokenFetchConfig) {
    const cfg = script.tokenFetchConfig;
    targetScope = cfg.targetScope || 'environment';
    const resolvedTokenUrl = resolveEnvVariables(cfg.tokenUrl || '', scopeCtx).resolved;
    const saveVar = cfg.saveToVarName || 'bearer_token';
    const jsonPath = cfg.tokenJsonPath || 'access_token';

    logs.push(`[Token Fetcher] Endpoint: ${resolvedTokenUrl || '(Not specified)'}`);

    if (!resolvedTokenUrl) {
      return {
        success: false,
        error: 'Pre-request Token Fetch failed: Token Endpoint URL is missing or empty.',
        logs,
        newVariables: {},
        targetScope,
      };
    }

    // Build payload
    let fetchBody: any = undefined;
    let fetchHeaders: Record<string, string> = {};

    const username = resolveEnvVariables(cfg.username || '', scopeCtx).resolved;
    const password = resolveEnvVariables(cfg.password || '', scopeCtx).resolved;
    const clientId = resolveEnvVariables(cfg.clientId || '', scopeCtx).resolved;
    const clientSecret = resolveEnvVariables(cfg.clientSecret || '', scopeCtx).resolved;

    if (cfg.grantType === 'password') {
      fetchHeaders['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify({ grant_type: 'password', username, password });
    } else if (cfg.grantType === 'client_credentials') {
      fetchHeaders['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      });
    } else if (cfg.grantType === 'x-www-form-urlencoded') {
      fetchHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      const params = new URLSearchParams();
      if (username) params.append('username', username);
      if (password) params.append('password', password);
      if (clientId) params.append('client_id', clientId);
      if (clientSecret) params.append('client_secret', clientSecret);
      fetchBody = params.toString();
    } else if (cfg.grantType === 'custom_json' && cfg.customBody) {
      fetchHeaders['Content-Type'] = 'application/json';
      fetchBody = resolveEnvVariables(cfg.customBody, scopeCtx).resolved;
    }

    try {
      logs.push(`[Token Fetcher] Sending pre-flight ${cfg.method || 'POST'} request...`);
      const responseData: ExecutionResponse = await executeHttpRequest({
        method: cfg.method || 'POST',
        url: resolvedTokenUrl,
        headers: fetchHeaders,
        body: fetchBody,
      });

      if (!responseData.ok && responseData.status >= 400) {
        const errMsg = `Pre-flight Token Fetch returned HTTP status ${responseData.status} (${responseData.statusText})`;
        logs.push(`[Error] ${errMsg}`);
        return {
          success: false,
          error: errMsg,
          logs,
          newVariables: {},
          targetScope,
        };
      }

      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(responseData.body);
      } catch (e) {
        const errMsg = 'Pre-flight Token response body is not valid JSON.';
        logs.push(`[Error] ${errMsg}`);
        return {
          success: false,
          error: errMsg,
          logs,
          newVariables: {},
          targetScope,
        };
      }

      const extractedToken = getValueByJsonPath(parsedJson, jsonPath);
      if (!extractedToken) {
        const errMsg = `Could not extract token property "${jsonPath}" from token response. Available keys: ${Object.keys(parsedJson || {}).join(', ')}`;
        logs.push(`[Error] ${errMsg}`);
        return {
          success: false,
          error: errMsg,
          logs,
          newVariables: {},
          targetScope,
        };
      }

      const tokenStr = String(extractedToken);
      newVariables[saveVar] = tokenStr;
      logs.push(`[Token Fetcher] Successfully extracted token into variable "{{${saveVar}}}"!`);

      if (cfg.autoInjectHeader !== false) {
        modifiedHeaders['Authorization'] = `Bearer ${tokenStr}`;
        logs.push(`[Token Fetcher] Automatically injected Authorization header: "Bearer ${tokenStr.substring(0, 10)}..."`);
      }

      return {
        success: true,
        logs,
        newVariables,
        targetScope,
        modifiedHeaders,
      };
    } catch (err: any) {
      const errMsg = `Pre-flight Token Fetch error: ${err.message || 'Network failure'}`;
      logs.push(`[Error] ${errMsg}`);
      return {
        success: false,
        error: errMsg,
        logs,
        newVariables: {},
        targetScope,
      };
    }
  }

  // MODE 2: Request Validator
  if (script.type === 'validate_request' && script.validationConfig) {
    const cfg = script.validationConfig;

    if (cfg.requireValidUrl !== false) {
      if (!initialUrl || !initialUrl.trim()) {
        const err = 'Validation Failed: Request URL is empty.';
        logs.push(`[Error] ${err}`);
        return { success: false, error: err, logs, newVariables: {}, targetScope };
      }
      if (!initialUrl.startsWith('http://') && !initialUrl.startsWith('https://')) {
        const err = `Validation Failed: URL must start with http:// or https:// (got "${initialUrl.substring(0, 30)}")`;
        logs.push(`[Error] ${err}`);
        return { success: false, error: err, logs, newVariables: {}, targetScope };
      }
      logs.push('✓ Request URL validation passed.');
    }

    if (cfg.requireHeaders && cfg.requireHeaders.length > 0) {
      for (const reqHdr of cfg.requireHeaders) {
        const hdrName = reqHdr.trim();
        if (!hdrName) continue;
        const exists = Object.keys(modifiedHeaders).some((k) => k.toLowerCase() === hdrName.toLowerCase());
        if (!exists) {
          const err = `Validation Failed: Required header "${hdrName}" is missing.`;
          logs.push(`[Error] ${err}`);
          return { success: false, error: err, logs, newVariables: {}, targetScope };
        }
      }
      logs.push(`✓ Required headers check passed (${cfg.requireHeaders.join(', ')}).`);
    }

    if (cfg.validateJsonBody && req.body.mode === 'json' && initialBody) {
      try {
        JSON.parse(initialBody);
        logs.push('✓ Request JSON body syntax validation passed.');
      } catch (e: any) {
        const err = `Validation Failed: Request body contains invalid JSON syntax (${e.message})`;
        logs.push(`[Error] ${err}`);
        return { success: false, error: err, logs, newVariables: {}, targetScope };
      }
    }

    logs.push('✓ All pre-request validations passed successfully.');
    return { success: true, logs, newVariables: {}, targetScope, modifiedHeaders, modifiedUrl, modifiedBody };
  }

  // MODE 3: Custom JS Script
  if (script.type === 'custom' && script.script) {
    try {
      const pmLog = (...args: any[]) => {
        const formatted = args
          .map((a) => {
            if (typeof a === 'string') return a;
            if (a instanceof Error) return `${a.name}: ${a.message}`;
            if (typeof a === 'object') {
              try {
                return JSON.stringify(a, null, 2);
              } catch (e) {
                return String(a);
              }
            }
            return String(a);
          })
          .join(' ');
        logs.push(`[Script Log] ${formatted}`);
      };

      const customConsole = {
        log: pmLog,
        info: pmLog,
        warn: pmLog,
        error: pmLog,
        debug: pmLog,
        trace: pmLog,
      };

      const pm = {
        environment: {
          set: (key: string, val: string) => {
            newVariables[key] = String(val);
            pmLog(`Environment variable set: ${key} = ${val}`);
          },
        },
        variables: {
          set: (key: string, val: string) => {
            newVariables[key] = String(val);
            pmLog(`Variable set: ${key} = ${val}`);
          },
        },
        request: {
          setHeader: (key: string, val: string) => {
            modifiedHeaders[key] = String(val);
            pmLog(`Header set: ${key} = ${val}`);
          },
          setUrl: (newUrl: string) => {
            modifiedUrl = newUrl;
            pmLog(`URL modified: ${newUrl}`);
          },
          setBody: (newBodyText: string) => {
            modifiedBody = newBodyText;
            pmLog(`Body modified: ${newBodyText.substring(0, 50)}...`);
          },
        },
        log: pmLog,
      };

      const runnerFn = new Function('pm', 'console', script.script);
      runnerFn(pm, customConsole);

      logs.push('✓ Pre-request custom script completed.');
      return {
        success: true,
        logs,
        newVariables,
        targetScope,
        modifiedHeaders,
        modifiedUrl,
        modifiedBody,
      };
    } catch (err: any) {
      const errorMsg = `Custom pre-request script execution error: ${err.message}`;
      logs.push(`[Script Error] ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        logs,
        newVariables,
        targetScope,
      };
    }
  }

  return { success: true, logs, newVariables, targetScope };
}

export function runPostRequestScript(
  req: RestRequest,
  response: ExecutionResponse
): PostRequestRunResult {
  const logs: string[] = [];
  const newVariables: Record<string, string> = {};
  let targetScope: 'environment' | 'file' | 'global' = 'environment';
  const assertions: TestAssertion[] = [];

  const script = req.postRequestScript;
  if (!script || !script.enabled) {
    return { logs: ['Post-request script skipped (disabled).'], newVariables: {}, targetScope: 'environment' };
  }

  logs.push(`Running Post-Request Action [Mode: ${script.type}]...`);

  // MODE 1: Extract Variables from Response
  if (script.type === 'extract_variable' && script.extractors) {
    let parsedBodyJson: any = null;
    try {
      parsedBodyJson = JSON.parse(response.body);
    } catch (e) {
      // not json
    }

    for (const ext of script.extractors) {
      if (!ext.enabled || !ext.targetVarName || !ext.sourcePath) continue;

      targetScope = ext.targetScope || 'environment';

      if (ext.source === 'body_json') {
        if (!parsedBodyJson) {
          logs.push(`[Warning] Extractor "{{${ext.targetVarName}}}": Response body is not valid JSON.`);
          continue;
        }
        const val = getValueByJsonPath(parsedBodyJson, ext.sourcePath);
        if (val !== undefined && val !== null) {
          const valStr = String(val);
          newVariables[ext.targetVarName] = valStr;
          logs.push(`[Extractor] Saved "{{${ext.targetVarName}}}" = "${valStr.length > 40 ? valStr.substring(0, 40) + '...' : valStr}" (from JSON path "${ext.sourcePath}")`);
        } else {
          logs.push(`[Warning] Extractor "{{${ext.targetVarName}}}": JSON path "${ext.sourcePath}" not found in response.`);
        }
      } else if (ext.source === 'header') {
        const searchHdr = ext.sourcePath.toLowerCase();
        const foundKey = Object.keys(response.headers || {}).find((k) => k.toLowerCase() === searchHdr);
        if (foundKey && response.headers[foundKey]) {
          const valStr = response.headers[foundKey];
          newVariables[ext.targetVarName] = valStr;
          logs.push(`[Extractor] Saved "{{${ext.targetVarName}}}" = "${valStr}" (from Header "${foundKey}")`);
        } else {
          logs.push(`[Warning] Extractor "{{${ext.targetVarName}}}": Header "${ext.sourcePath}" not found in response headers.`);
        }
      } else if (ext.source === 'body_regex') {
        try {
          const reg = new RegExp(ext.sourcePath);
          const match = response.body.match(reg);
          if (match && (match[1] || match[0])) {
            const valStr = match[1] || match[0];
            newVariables[ext.targetVarName] = valStr;
            logs.push(`[Extractor] Saved "{{${ext.targetVarName}}}" = "${valStr}" (from Regex match "${ext.sourcePath}")`);
          } else {
            logs.push(`[Warning] Extractor "{{${ext.targetVarName}}}": Regex "${ext.sourcePath}" produced no match.`);
          }
        } catch (e: any) {
          logs.push(`[Error] Invalid regex in extractor: ${e.message}`);
        }
      }
    }

    logs.push(`✓ Post-request variable extraction completed (${Object.keys(newVariables).length} variables updated).`);
    return { logs, newVariables, targetScope };
  }

  // MODE 2: Validate Response
  if (script.type === 'validate_response' && script.validationConfig) {
    const cfg = script.validationConfig;

    if (cfg.expectedStatus) {
      const passed = response.status === cfg.expectedStatus;
      assertions.push({
        id: 'ast_' + Math.random().toString(36).substring(2, 9),
        type: 'status_code',
        targetValue: String(cfg.expectedStatus),
        enabled: true,
        passed,
        message: passed
          ? `Status code is ${response.status}`
          : `Expected status ${cfg.expectedStatus}, got ${response.status}`,
      });
      logs.push(passed ? `✓ Status code check passed (${response.status})` : `✗ Status code check failed (expected ${cfg.expectedStatus}, got ${response.status})`);
    }

    if (cfg.maxDurationMs) {
      const passed = response.duration <= cfg.maxDurationMs;
      assertions.push({
        id: 'ast_' + Math.random().toString(36).substring(2, 9),
        type: 'max_time',
        targetValue: String(cfg.maxDurationMs),
        enabled: true,
        passed,
        message: passed
          ? `Response time ${response.duration}ms <= ${cfg.maxDurationMs}ms`
          : `Response time ${response.duration}ms > ${cfg.maxDurationMs}ms`,
      });
      logs.push(passed ? `✓ Response speed check passed (${response.duration}ms)` : `✗ Response speed check failed (${response.duration}ms > ${cfg.maxDurationMs}ms)`);
    }

    if (cfg.requiredJsonFields && cfg.requiredJsonFields.length > 0) {
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(response.body);
      } catch (e) {}

      for (const field of cfg.requiredJsonFields) {
        const trimmed = field.trim();
        if (!trimmed) continue;
        const val = parsedJson ? getValueByJsonPath(parsedJson, trimmed) : undefined;
        const passed = val !== undefined && val !== null;
        assertions.push({
          id: 'ast_' + Math.random().toString(36).substring(2, 9),
          type: 'json_property',
          targetValue: trimmed,
          enabled: true,
          passed,
          message: passed ? `JSON field "${trimmed}" exists` : `JSON field "${trimmed}" missing in response`,
        });
        logs.push(passed ? `✓ JSON field "${trimmed}" verified` : `✗ JSON field "${trimmed}" missing`);
      }
    }

    return { logs, newVariables: {}, targetScope, assertions };
  }

  // MODE 3: Custom JS Script
  if (script.type === 'custom' && script.script) {
    try {
      const pmLog = (...args: any[]) => {
        const formatted = args
          .map((a) => {
            if (typeof a === 'string') return a;
            if (a instanceof Error) return `${a.name}: ${a.message}`;
            if (typeof a === 'object') {
              try {
                return JSON.stringify(a, null, 2);
              } catch (e) {
                return String(a);
              }
            }
            return String(a);
          })
          .join(' ');
        logs.push(`[Script Log] ${formatted}`);
      };

      const customConsole = {
        log: pmLog,
        info: pmLog,
        warn: pmLog,
        error: pmLog,
        debug: pmLog,
        trace: pmLog,
      };

      let parsedJsonBody: any = null;
      try {
        parsedJsonBody = JSON.parse(response.body);
      } catch (e) {}

      const pm = {
        response: {
          status: response.status,
          statusText: response.statusText,
          duration: response.duration,
          headers: response.headers,
          body: response.body,
          json: () => parsedJsonBody,
        },
        environment: {
          set: (key: string, val: string) => {
            newVariables[key] = String(val);
            pmLog(`Environment variable set: ${key} = ${val}`);
          },
        },
        variables: {
          set: (key: string, val: string) => {
            newVariables[key] = String(val);
            pmLog(`Variable set: ${key} = ${val}`);
          },
        },
        test: (testName: string, testFn: () => void) => {
          try {
            testFn();
            assertions.push({
              id: 'ast_' + Math.random().toString(36).substring(2, 9),
              type: 'body_contains',
              targetValue: testName,
              enabled: true,
              passed: true,
              message: `Test passed: ${testName}`,
            });
            pmLog(`✓ Test Passed: ${testName}`);
          } catch (e: any) {
            assertions.push({
              id: 'ast_' + Math.random().toString(36).substring(2, 9),
              type: 'body_contains',
              targetValue: testName,
              enabled: true,
              passed: false,
              message: `Test failed: ${testName} (${e.message})`,
            });
            pmLog(`✗ Test Failed: ${testName} (${e.message})`);
          }
        },
        expect: (val: any) => ({
          to: {
            equal: (expected: any) => {
              if (val !== expected) throw new Error(`Expected ${val} to equal ${expected}`);
            },
            be: {
              ok: () => {
                if (!val) throw new Error(`Expected ${val} to be truthy`);
              },
            },
            include: (substr: string) => {
              if (typeof val === 'string' && !val.includes(substr)) throw new Error(`Expected string to include "${substr}"`);
            },
          },
        }),
        log: pmLog,
      };

      const runnerFn = new Function('pm', 'console', script.script);
      runnerFn(pm, customConsole);

      logs.push('✓ Post-request custom script completed.');
      return { logs, newVariables, targetScope, assertions };
    } catch (err: any) {
      logs.push(`[Script Error] ${err.message}`);
      return { logs, newVariables: {}, targetScope };
    }
  }

  return { logs, newVariables: {}, targetScope };
}
