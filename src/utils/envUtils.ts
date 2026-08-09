import { EnvVariable, EnvVariableScope, HTTPMethod, RestRequest, VariableLookupResult } from '../types';

export interface ScopeContext {
  globalVariables?: EnvVariable[];
  organizationVariables?: EnvVariable[];
  organizationName?: string;
  projectVariables?: EnvVariable[];
  projectName?: string;
  folderVariables?: EnvVariable[];
  folderName?: string;
  fileVariables?: Record<string, string>;
  fileName?: string;
}

export interface ResolutionResult {
  resolved: string;
  matchedVars: { key: string; value: string; source: EnvVariableScope; sourceName: string }[];
  missingVars: string[];
}

export function getVariableLookupDetails(
  varKey: string,
  scopeCtx: ScopeContext
): VariableLookupResult | null {
  const matches: { scope: EnvVariableScope; sourceName: string; value: string; secret?: boolean }[] = [];

  // 1. File
  if (scopeCtx.fileVariables && varKey in scopeCtx.fileVariables) {
    matches.push({
      scope: 'file',
      sourceName: scopeCtx.fileName ? `File (${scopeCtx.fileName})` : 'File Variable',
      value: scopeCtx.fileVariables[varKey],
    });
  }

  // 2. Folder
  if (scopeCtx.folderVariables) {
    const fv = scopeCtx.folderVariables.find((v) => v.enabled !== false && v.key === varKey);
    if (fv) {
      matches.push({
        scope: 'folder',
        sourceName: scopeCtx.folderName ? `Folder (${scopeCtx.folderName})` : 'Folder Level',
        value: fv.value,
        secret: fv.secret,
      });
    }
  }

  // 3. Project
  if (scopeCtx.projectVariables) {
    const pv = scopeCtx.projectVariables.find((v) => v.enabled !== false && v.key === varKey);
    if (pv) {
      matches.push({
        scope: 'project',
        sourceName: scopeCtx.projectName ? `Project (${scopeCtx.projectName})` : 'Project Environment',
        value: pv.value,
        secret: pv.secret,
      });
    }
  }

  // 4. Organization
  if (scopeCtx.organizationVariables) {
    const ov = scopeCtx.organizationVariables.find((v) => v.enabled !== false && v.key === varKey);
    if (ov) {
      matches.push({
        scope: 'organization',
        sourceName: scopeCtx.organizationName ? `Org (${scopeCtx.organizationName})` : 'Organization',
        value: ov.value,
        secret: ov.secret,
      });
    }
  }

  // 5. Global
  if (scopeCtx.globalVariables) {
    const gv = scopeCtx.globalVariables.find((v) => v.enabled !== false && v.key === varKey);
    if (gv) {
      matches.push({
        scope: 'global',
        sourceName: 'Global Environment',
        value: gv.value,
        secret: gv.secret,
      });
    }
  }

  if (matches.length === 0) return null;

  const winner = matches[0];
  const overrides = matches.slice(1).map((m) => ({
    scope: m.scope,
    sourceName: m.sourceName,
    value: m.value,
  }));

  return {
    key: varKey,
    value: winner.value,
    scope: winner.scope,
    sourceName: winner.sourceName,
    secret: winner.secret,
    overrides: overrides.length > 0 ? overrides : undefined,
  };
}

export function resolveEnvVariables(
  text: string,
  scopeCtxOrLegacyEnvs?: ScopeContext | EnvVariable[],
  legacyFileVars?: Record<string, string>
): ResolutionResult {
  if (!text) {
    return { resolved: '', matchedVars: [], missingVars: [] };
  }

  let ctx: ScopeContext;
  if (Array.isArray(scopeCtxOrLegacyEnvs)) {
    ctx = {
      projectVariables: scopeCtxOrLegacyEnvs,
      fileVariables: legacyFileVars || {},
    };
  } else {
    ctx = scopeCtxOrLegacyEnvs || {};
  }

  const matchedVars: { key: string; value: string; source: EnvVariableScope; sourceName: string }[] = [];
  const missingVarsSet = new Set<string>();

  const regex = /\{\{([a-zA-Z0-9_.-]+)\}\}/g;
  const resolved = text.replace(regex, (match, varName) => {
    const trimmedKey = varName.trim();
    const details = getVariableLookupDetails(trimmedKey, ctx);
    if (details) {
      matchedVars.push({
        key: trimmedKey,
        value: details.value,
        source: details.scope,
        sourceName: details.sourceName,
      });
      return details.value;
    } else {
      missingVarsSet.add(trimmedKey);
      return match;
    }
  });

  return {
    resolved,
    matchedVars,
    missingVars: Array.from(missingVarsSet),
  };
}

export interface AutocompleteSuggestion {
  key: string;
  value: string;
  description?: string;
  source: EnvVariableScope;
  sourceName?: string;
  secret?: boolean;
}

export function getEnvAutocompleteSuggestions(
  currentInput: string,
  cursorPos: number,
  scopeCtxOrLegacyEnvs?: ScopeContext | EnvVariable[],
  legacyFileVars?: Record<string, string>
): {
  show: boolean;
  trigger: '{{' | '@';
  query: string;
  startIndex: number;
  suggestions: AutocompleteSuggestion[];
} {
  let ctx: ScopeContext;
  if (Array.isArray(scopeCtxOrLegacyEnvs)) {
    ctx = {
      projectVariables: scopeCtxOrLegacyEnvs,
      fileVariables: legacyFileVars || {},
    };
  } else {
    ctx = scopeCtxOrLegacyEnvs || {};
  }

  const textBeforeCursor = currentInput.slice(0, cursorPos);
  const lastDoubleBrace = textBeforeCursor.lastIndexOf('{{');

  if (lastDoubleBrace !== -1) {
    const textAfterBrace = textBeforeCursor.slice(lastDoubleBrace + 2);
    if (!textAfterBrace.includes('}}')) {
      const query = textAfterBrace.toLowerCase();
      const suggestionsMap = new Map<string, AutocompleteSuggestion>();

      // Priority order: File -> Folder -> Project -> Org -> Global
      // 1. File
      if (ctx.fileVariables) {
        Object.entries(ctx.fileVariables).forEach(([k, val]) => {
          if (k.toLowerCase().includes(query) && !suggestionsMap.has(k)) {
            suggestionsMap.set(k, {
              key: k,
              value: val,
              description: ctx.fileName ? `File Var (${ctx.fileName})` : 'File Variable',
              source: 'file',
            });
          }
        });
      }

      // 2. Folder
      if (ctx.folderVariables) {
        ctx.folderVariables.forEach((v) => {
          if (v.enabled !== false && v.key && v.key.toLowerCase().includes(query) && !suggestionsMap.has(v.key)) {
            suggestionsMap.set(v.key, {
              key: v.key,
              value: v.value,
              description: ctx.folderName ? `Folder Var (${ctx.folderName})` : 'Folder Variable',
              source: 'folder',
              secret: v.secret,
            });
          }
        });
      }

      // 3. Project
      if (ctx.projectVariables) {
        ctx.projectVariables.forEach((v) => {
          if (v.enabled !== false && v.key && v.key.toLowerCase().includes(query) && !suggestionsMap.has(v.key)) {
            suggestionsMap.set(v.key, {
              key: v.key,
              value: v.value,
              description: ctx.projectName ? `Project Env (${ctx.projectName})` : 'Project Env Var',
              source: 'project',
              secret: v.secret,
            });
          }
        });
      }

      // 4. Organization
      if (ctx.organizationVariables) {
        ctx.organizationVariables.forEach((v) => {
          if (v.enabled !== false && v.key && v.key.toLowerCase().includes(query) && !suggestionsMap.has(v.key)) {
            suggestionsMap.set(v.key, {
              key: v.key,
              value: v.value,
              description: ctx.organizationName ? `Org Var (${ctx.organizationName})` : 'Organization Var',
              source: 'organization',
              secret: v.secret,
            });
          }
        });
      }

      // 5. Global
      if (ctx.globalVariables) {
        ctx.globalVariables.forEach((v) => {
          if (v.enabled !== false && v.key && v.key.toLowerCase().includes(query) && !suggestionsMap.has(v.key)) {
            suggestionsMap.set(v.key, {
              key: v.key,
              value: v.value,
              description: 'Global Environment Variable',
              source: 'global',
              secret: v.secret,
            });
          }
        });
      }

      const suggestions = Array.from(suggestionsMap.values());

      return {
        show: suggestions.length > 0,
        trigger: '{{',
        query,
        startIndex: lastDoubleBrace,
        suggestions,
      };
    }
  }

  return {
    show: false,
    trigger: '{{',
    query: '',
    startIndex: -1,
    suggestions: [],
  };
}


export function generateCodeSnippet(
  req: RestRequest,
  resolvedUrl: string,
  resolvedHeaders: Record<string, string>,
  resolvedBody: string,
  language: 'curl' | 'javascript' | 'axios' | 'python' | 'node' | 'go' | 'rust'
): string {
  const method = req.method;
  const bodyText = resolvedBody || req.body.rawText || '';

  switch (language) {
    case 'curl': {
      let cmd = `curl -X ${method} "${resolvedUrl}"`;
      Object.entries(resolvedHeaders).forEach(([k, v]) => {
        cmd += ` \\\n  -H "${k}: ${v}"`;
      });
      if ((req.body.mode === 'json' || req.body.mode === 'raw' || req.body.mode === 'x-www-form-urlencoded') && bodyText) {
        cmd += ` \\\n  -d '${bodyText.replace(/'/g, "\\'")}'`;
      }
      return cmd;
    }

    case 'javascript': {
      let code = `fetch("${resolvedUrl}", {\n  method: "${method}",\n`;
      if (Object.keys(resolvedHeaders).length > 0) {
        code += `  headers: ${JSON.stringify(resolvedHeaders, null, 4)},\n`;
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && bodyText) {
        let bodyPayload = bodyText;
        if (req.body.mode === 'json') {
          try {
            JSON.parse(bodyText);
            bodyPayload = `JSON.stringify(${bodyText})`;
          } catch {
            bodyPayload = `JSON.stringify(${JSON.stringify(bodyText)})`;
          }
        } else {
          bodyPayload = JSON.stringify(bodyText);
        }
        code += `  body: ${bodyPayload},\n`;
      }
      code += `})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
      return code;
    }

    case 'axios': {
      let code = `import axios from 'axios';\n\n`;
      code += `axios({\n  method: '${method.toLowerCase()}',\n  url: '${resolvedUrl}',\n`;
      if (Object.keys(resolvedHeaders).length > 0) {
        code += `  headers: ${JSON.stringify(resolvedHeaders, null, 4)},\n`;
      }
      if (bodyText) {
        if (req.body.mode === 'json') {
          try {
            JSON.parse(bodyText);
            code += `  data: ${bodyText},\n`;
          } catch {
            code += `  data: ${JSON.stringify(bodyText)},\n`;
          }
        } else {
          code += `  data: ${JSON.stringify(bodyText)},\n`;
        }
      }
      code += `})\n.then(response => console.log(response.data))\n.catch(error => console.error(error));`;
      return code;
    }

    case 'python': {
      let code = `import requests\n\nurl = "${resolvedUrl}"\n`;
      if (Object.keys(resolvedHeaders).length > 0) {
        code += `headers = ${JSON.stringify(resolvedHeaders, null, 4)}\n`;
      } else {
        code += `headers = {}\n`;
      }
      if (bodyText) {
        if (req.body.mode === 'json') {
          try {
            const parsed = JSON.parse(bodyText);
            code += `payload = ${JSON.stringify(parsed, null, 4)}\n`;
            code += `response = requests.request("${method}", url, headers=headers, json=payload)\n`;
          } catch {
            code += `payload = ${JSON.stringify(bodyText)}\n`;
            code += `response = requests.request("${method}", url, headers=headers, data=payload)\n`;
          }
        } else {
          code += `payload = ${JSON.stringify(bodyText)}\n`;
          code += `response = requests.request("${method}", url, headers=headers, data=payload)\n`;
        }
      } else {
        code += `response = requests.request("${method}", url, headers=headers)\n`;
      }
      code += `print(response.status_code)\nprint(response.text)`;
      return code;
    }

    case 'node': {
      let hostname = 'localhost';
      try {
        hostname = new URL(resolvedUrl.startsWith('http') ? resolvedUrl : 'http://' + resolvedUrl).hostname;
      } catch {
        // fallback
      }
      return `const https = require('https');\n\nconst options = {\n  hostname: '${hostname}',\n  method: '${method}',\n  headers: ${JSON.stringify(resolvedHeaders, null, 4)}\n};\n\nconst req = https.request('${resolvedUrl}', options, res => {\n  let data = '';\n  res.on('data', chunk => data += chunk);\n  res.on('end', () => console.log(data));\n});\n${bodyText ? `req.write(${JSON.stringify(bodyText)});\n` : ''}req.end();`;
    }

    case 'go': {
      return `package main\n\nimport (\n\t"fmt"\n\t"io/ioutil"\n\t"net/http"\n${bodyText ? `\t"strings"\n` : ''})\n\nfunc main() {\n\turl := "${resolvedUrl}"\n\t${bodyText ? `payload := strings.NewReader(\`${bodyText.replace(/`/g, "'")}\`)\n\treq, _ := http.NewRequest("${method}", url, payload)` : `req, _ := http.NewRequest("${method}", url, nil)`}\n${Object.entries(resolvedHeaders).map(([k, v]) => `\treq.Header.Add("${k}", "${v}")`).join('\n')}\n\tres, _ := http.DefaultClient.Do(req)\n\tdefer res.Body.Close()\n\tbody, _ := ioutil.ReadAll(res.Body)\n\tfmt.Println(string(body))\n}`;
    }

    case 'rust': {
      return `use reqwest;\n\n#[tokio::main]\nasync fn main() -> Result<(), Box<dyn std.error.Error>> {\n    let client = reqwest::Client::new();\n    let res = client.${method.toLowerCase()}("${resolvedUrl}")\n${Object.entries(resolvedHeaders).map(([k, v]) => `        .header("${k}", "${v}")`).join('\n')}\n${bodyText ? `        .body(\`${bodyText}\`)\n` : ''}        .send()\n        .await?;\n    println!("Status: {}", res.status());\n    Ok(())\n}`;
    }

    default:
      return '';
  }
}
