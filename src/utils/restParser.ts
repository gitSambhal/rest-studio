import { HTTPMethod, KeyValuePair, RequestAuth, RequestBody, RestFile, RestRequest } from '../types';

export function parseRestFileContent(content: string, fileName: string = 'untitled.rest'): {
  requests: RestRequest[];
  fileVariables: Record<string, string>;
} {
  const fileVariables: Record<string, string> = {};
  const requests: RestRequest[] = [];

  // Normalize line endings
  const lines = content.split(/\r?\n/);

  let currentBlockLines: string[] = [];
  let currentRequestName = '';

  const processBlock = (blockLines: string[], name: string) => {
    // Filter out top file variables if any
    const filteredLines: string[] = [];
    for (const line of blockLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('@')) {
        const match = trimmed.match(/^@([a-zA-Z0-9_]+)\s*=\s*(.*)$/);
        if (match) {
          fileVariables[match[1]] = match[2];
          continue;
        }
      }
      filteredLines.push(line);
    }

    if (filteredLines.length === 0) return;

    // Find the request line (e.g., "GET https://api.example.com/users HTTP/1.1" or "POST {{baseUrl}}/login")
    let requestLineIndex = -1;
    for (let i = 0; i < filteredLines.length; i++) {
      const line = filteredLines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      
      const firstWord = line.split(/\s+/)[0].toUpperCase();
      if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'QUERY'].includes(firstWord)) {
        requestLineIndex = i;
        break;
      }
    }

    if (requestLineIndex === -1) return;

    const reqLine = filteredLines[requestLineIndex].trim();
    const parts = reqLine.split(/\s+/);
    const method = parts[0].toUpperCase() as HTTPMethod;
    let rawUrl = parts[1] || '';

    // Strip HTTP/1.1 if present
    if (parts.length > 2 && parts[parts.length - 1].toUpperCase().startsWith('HTTP/')) {
      rawUrl = parts.slice(1, parts.length - 1).join(' ');
    } else if (parts.length > 2) {
      rawUrl = parts.slice(1).join(' ');
    }

    // Parse headers (until empty line)
    const headers: KeyValuePair[] = [];
    let bodyStartIndex = -1;

    for (let i = requestLineIndex + 1; i < filteredLines.length; i++) {
      const line = filteredLines[i];
      if (line.trim() === '') {
        bodyStartIndex = i + 1;
        break;
      }

      if (line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key) {
          headers.push({
            id: 'hdr_' + Math.random().toString(36).substring(2, 9),
            key,
            value,
            enabled: true,
          });
        }
      }
    }

    // Parse Body
    let bodyRaw = '';
    if (bodyStartIndex !== -1 && bodyStartIndex < filteredLines.length) {
      bodyRaw = filteredLines.slice(bodyStartIndex).join('\n').trim();
    }

    // Extract query params from URL if present
    const queryParams: KeyValuePair[] = [];
    let cleanUrl = rawUrl;
    if (rawUrl.includes('?')) {
      const [baseUrlPart, queryString] = rawUrl.split('?');
      cleanUrl = baseUrlPart;
      const searchParams = new URLSearchParams(queryString);
      searchParams.forEach((val, key) => {
        queryParams.push({
          id: 'param_' + Math.random().toString(36).substring(2, 9),
          key,
          value: val,
          enabled: true,
        });
      });
    }

    // Determine content type for body mode
    let bodyMode: RequestBody['mode'] = 'none';
    if (bodyRaw) {
      bodyMode = 'raw';
      const contentTypeHeader = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value || '';
      if (contentTypeHeader.includes('json') || (bodyRaw.startsWith('{') || bodyRaw.startsWith('['))) {
        bodyMode = 'json';
      } else if (contentTypeHeader.includes('x-www-form-urlencoded')) {
        bodyMode = 'x-www-form-urlencoded';
      } else if (contentTypeHeader.includes('form-data')) {
        bodyMode = 'form-data';
      }
    }

    // Auth extraction from Authorization header
    const auth: RequestAuth = {
      type: 'none',
      bearerToken: '',
    };
    const authHeader = headers.find((h) => h.key.toLowerCase() === 'authorization');
    if (authHeader) {
      if (authHeader.value.toLowerCase().startsWith('bearer ')) {
        auth.type = 'bearer';
        auth.bearerToken = authHeader.value.substring(7).trim();
      } else if (authHeader.value.toLowerCase().startsWith('basic ')) {
        auth.type = 'basic';
      }
    }

    const reqName = name || (method + ' ' + (cleanUrl || '/'));

    requests.push({
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: reqName,
      method,
      url: cleanUrl || rawUrl,
      headers,
      queryParams,
      body: {
        mode: bodyMode,
        rawText: bodyRaw,
      },
      auth,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('###')) {
      // Process previous block
      if (currentBlockLines.length > 0) {
        processBlock(currentBlockLines, currentRequestName);
        currentBlockLines = [];
      }
      // Extract title after ###
      currentRequestName = trimmed.replace(/^###\s*/, '').trim();
    } else {
      currentBlockLines.push(line);
    }
  }

  if (currentBlockLines.length > 0) {
    processBlock(currentBlockLines, currentRequestName);
  }

  return { requests, fileVariables };
}

export function parsePostmanCollection(jsonData: any): {
  folders: { id: string; name: string; fileIds: string[] }[];
  files: RestFile[];
  error?: string;
} {
  const folders: { id: string; name: string; fileIds: string[] }[] = [];
  const files: RestFile[] = [];

  if (!jsonData || typeof jsonData !== 'object') {
    return { folders, files, error: 'Invalid file format: JSON root must be an object or array.' };
  }

  // Handle Postman v1 legacy collection (uses `requests` array)
  if (jsonData.requests && Array.isArray(jsonData.requests) && !jsonData.item) {
    const v1Requests: RestRequest[] = jsonData.requests
      .map((r: any) => {
        if (!r) return null;
        let headers: KeyValuePair[] = [];
        if (typeof r.headers === 'string') {
          headers = r.headers
            .split('\n')
            .filter(Boolean)
            .map((line: string) => {
              const idx = line.indexOf(':');
              return {
                id: 'hdr_' + Math.random().toString(36).substring(2, 9),
                key: idx > -1 ? line.substring(0, idx).trim() : line.trim(),
                value: idx > -1 ? line.substring(idx + 1).trim() : '',
                enabled: true,
              };
            });
        }
        return {
          id: 'req_' + Math.random().toString(36).substring(2, 9),
          name: r.name || `${r.method || 'GET'} ${r.url || ''}`,
          method: ((r.method || 'GET').toUpperCase() as HTTPMethod) || 'GET',
          url: r.url || '',
          headers,
          queryParams: [],
          body: { mode: 'json', rawText: r.rawModeData || r.data || '' },
          auth: { type: 'none', bearerToken: '' },
        };
      })
      .filter(Boolean) as RestRequest[];

    if (v1Requests.length > 0) {
      const rootFileId = 'file_root_' + Math.random().toString(36).substring(2, 9);
      files.push({
        id: rootFileId,
        name: `${(jsonData.name || 'imported_v1_collection').toLowerCase().replace(/\s+/g, '_')}.rest`,
        rawContent: generateRestFileContent(v1Requests),
        requests: v1Requests,
        updatedAt: Date.now(),
      });
      return { folders, files };
    }
  }

  // Check if missing info object and not v1 requests array
  if (!jsonData.info && !jsonData.item && !Array.isArray(jsonData)) {
    return {
      folders,
      files,
      error:
        'Unrecognized collection structure. Expected Postman Collection v2/v2.1 (containing "info" & "item") or Postman v1 ("requests").',
    };
  }

  const rootRequests: RestRequest[] = [];

  const parsePostmanItem = (item: any): RestRequest | null => {
    if (!item.request) return null;

    const method = (item.request.method || 'GET').toUpperCase() as HTTPMethod;
    let url = '';
    if (typeof item.request.url === 'string') {
      url = item.request.url;
    } else if (item.request.url && item.request.url.raw) {
      url = item.request.url.raw;
    }

    // Convert Postman variables {{var}} if present
    const headers: KeyValuePair[] = (item.request.header || []).map((h: any) => ({
      id: 'hdr_' + Math.random().toString(36).substring(2, 9),
      key: h.key || '',
      value: h.value || '',
      enabled: !h.disabled,
    }));

    // Body
    let bodyRaw = '';
    let bodyMode: RequestBody['mode'] = 'none';

    if (item.request.body) {
      if (item.request.body.mode === 'raw') {
        bodyRaw = item.request.body.raw || '';
        bodyMode = 'json';
      } else if (item.request.body.mode === 'urlencoded') {
        bodyMode = 'x-www-form-urlencoded';
        bodyRaw = (item.request.body.urlencoded || [])
          .map((u: any) => `${u.key}=${u.value}`)
          .join('&');
      }
    }

    // Auth
    const auth: RequestAuth = { type: 'none', bearerToken: '' };
    if (item.request.auth && item.request.auth.type === 'bearer') {
      auth.type = 'bearer';
      const tokenObj = (item.request.auth.bearer || []).find((b: any) => b.key === 'token');
      auth.bearerToken = tokenObj ? tokenObj.value : '';
    }

    return {
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: item.name || `${method} ${url}`,
      method,
      url,
      headers,
      queryParams: [],
      body: { mode: bodyMode, rawText: bodyRaw },
      auth,
    };
  };

  const processItems = (items: any[], folderName?: string) => {
    const folderRequests: RestRequest[] = [];

    for (const item of items) {
      if (item.item && Array.isArray(item.item)) {
        // Nested folder
        processItems(item.item, item.name);
      } else if (item.request) {
        const parsedReq = parsePostmanItem(item);
        if (parsedReq) {
          if (folderName) {
            folderRequests.push(parsedReq);
          } else {
            rootRequests.push(parsedReq);
          }
        }
      }
    }

    if (folderName && folderRequests.length > 0) {
      const fileId = 'file_pm_' + Math.random().toString(36).substring(2, 9);
      const restFile: RestFile = {
        id: fileId,
        name: `${folderName.toLowerCase().replace(/\s+/g, '_')}.rest`,
        rawContent: generateRestFileContent(folderRequests),
        requests: folderRequests,
        updatedAt: Date.now(),
      };
      files.push(restFile);

      const folderId = 'folder_pm_' + Math.random().toString(36).substring(2, 9);
      folders.push({
        id: folderId,
        name: folderName,
        fileIds: [fileId],
      });
    }
  };

  const itemsToProcess = jsonData.item || (Array.isArray(jsonData) ? jsonData : null);
  if (itemsToProcess && Array.isArray(itemsToProcess)) {
    processItems(itemsToProcess);
  }

  if (rootRequests.length > 0) {
    const rootFileId = 'file_root_' + Math.random().toString(36).substring(2, 9);
    files.push({
      id: rootFileId,
      name: `${((jsonData.info && jsonData.info.name) || 'collection').toLowerCase().replace(/\s+/g, '_')}.rest`,
      rawContent: generateRestFileContent(rootRequests),
      requests: rootRequests,
      updatedAt: Date.now(),
    });
  }

  if (files.length === 0) {
    return {
      folders,
      files,
      error: 'No valid request endpoints found inside Postman collection JSON.',
    };
  }

  return { folders, files };
}

export function exportToPostmanCollection(projectName: string, files: RestFile[]): any {
  const collection = {
    info: {
      name: projectName || 'Exported REST Client Suite',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: files.map((file) => ({
      name: file.name,
      item: file.requests.map((req) => ({
        name: req.name,
        request: {
          method: req.method,
          header: req.headers
            .filter((h) => h.enabled)
            .map((h) => ({ key: h.key, value: h.value })),
          body:
            req.body.mode !== 'none'
              ? { mode: 'raw', raw: req.body.rawText }
              : undefined,
          url: {
            raw: req.url,
          },
        },
      })),
    })),
  };

  return collection;
}

export function generateRestFileContent(requests: RestRequest[], fileVariables: Record<string, string> = {}): string {
  let content = '';

  // Append file variables
  const varKeys = Object.keys(fileVariables);
  if (varKeys.length > 0) {
    for (const key of varKeys) {
      content += `@${key} = ${fileVariables[key]}\n`;
    }
    content += '\n';
  }

  requests.forEach((req, index) => {
    if (index > 0 || varKeys.length > 0) {
      content += `### ${req.name || 'Request ' + (index + 1)}\n`;
    } else {
      content += `### ${req.name || 'Request ' + (index + 1)}\n`;
    }

    // Build full URL with enabled query params
    let fullUrl = req.url;
    const activeParams = (req?.queryParams || []).filter((p) => p.enabled && p.key);
    if (activeParams.length > 0) {
      const qStr = activeParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + qStr;
    }

    content += `${req.method} ${fullUrl}\n`;

    // Active headers
    const activeHeaders = (req?.headers || []).filter((h) => h.enabled && h.key);
    for (const h of activeHeaders) {
      content += `${h.key}: ${h.value}\n`;
    }

    // Auth header if needed
    if (req.auth.type === 'bearer' && req.auth.bearerToken) {
      const hasAuthHeader = activeHeaders.some((h) => h.key.toLowerCase() === 'authorization');
      if (!hasAuthHeader) {
        content += `Authorization: Bearer ${req.auth.bearerToken}\n`;
      }
    }

    // Body
    if (req.body.mode !== 'none') {
      content += '\n';
      if (req.body.mode === 'json' || req.body.mode === 'raw') {
        content += req.body.rawText + '\n';
      } else if (req.body.mode === 'x-www-form-urlencoded' && req.body.urlencodedItems) {
        const urlEncodedStr = req.body.urlencodedItems
          .filter((i) => i.enabled && i.key)
          .map((i) => `${encodeURIComponent(i.key)}=${encodeURIComponent(i.value)}`)
          .join('&');
        content += urlEncodedStr + '\n';
      }
    }

    content += '\n';
  });

  return content.trim();
}

export function parseCurlCommand(curlCommand: string): RestRequest | null {
  try {
    const cleanCurl = curlCommand.replace(/\\\n/g, ' ').replace(/\r/g, '').trim();
    if (!cleanCurl.toLowerCase().startsWith('curl')) return null;

    let method: HTTPMethod = 'GET';
    let url = '';
    const headers: KeyValuePair[] = [];
    let bodyText = '';
    let auth: RequestAuth = { type: 'none', bearerToken: '' };

    // Regex match arguments (respecting double and single quotes)
    const tokens: string[] = [];
    const regex = /[^\s"']+|"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cleanCurl)) !== null) {
      tokens.push(match[0]);
    }

    const KNOWN_HTTP_METHODS: HTTPMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'QUERY'];

    for (let i = 1; i < tokens.length; i++) {
      let rawToken = tokens[i];
      let token = rawToken;

      // Strip surrounding quotes
      if (
        (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))
      ) {
        token = token.substring(1, token.length - 1);
      }

      const lowerToken = token.toLowerCase();

      // Check method flags: -X, -x, --request
      if (
        token === '-X' ||
        token === '-x' ||
        token === '--request' ||
        lowerToken.startsWith('--request=')
      ) {
        let val = '';
        if (lowerToken.startsWith('--request=')) {
          val = token.split('=')[1] || '';
        } else if (i + 1 < tokens.length) {
          val = tokens[++i];
        }
        val = val.replace(/^["']|["']$/g, '').trim();
        const upperVal = val.toUpperCase() as HTTPMethod;

        if (KNOWN_HTTP_METHODS.includes(upperVal)) {
          method = upperVal;
        } else if (val) {
          method = upperVal;
        }
        continue;
      }

      // Attached method e.g. -XPOST or -xGET
      if (/^-[Xx][A-Za-z]+$/.test(token)) {
        const potentialMethod = token.substring(2).toUpperCase() as HTTPMethod;
        if (KNOWN_HTTP_METHODS.includes(potentialMethod)) {
          method = potentialMethod;
          continue;
        }
      }

      // Headers: -H, --header, or --header="K: V"
      if (token === '-H' || token === '--header' || lowerToken.startsWith('--header=')) {
        let headerStr = '';
        if (lowerToken.startsWith('--header=')) {
          headerStr = token.substring(9);
        } else if (i + 1 < tokens.length) {
          headerStr = tokens[++i];
        }
        headerStr = headerStr.replace(/^["']|["']$/g, '').trim();
        const colonIndex = headerStr.indexOf(':');
        if (colonIndex > -1) {
          const hKey = headerStr.substring(0, colonIndex).trim();
          const hVal = headerStr.substring(colonIndex + 1).trim();
          headers.push({
            id: 'hdr_' + Math.random().toString(36).substring(2, 9),
            key: hKey,
            value: hVal,
            enabled: true,
          });

          // Check if Authorization Bearer header
          if (hKey.toLowerCase() === 'authorization' && hVal.toLowerCase().startsWith('bearer ')) {
            auth = {
              type: 'bearer',
              bearerToken: hVal.substring(7).trim(),
            };
          }
        }
        continue;
      }

      // Attached header e.g. -H"Content-Type: application/json"
      if (token.startsWith('-H') && token.length > 2) {
        const headerStr = token.substring(2).replace(/^["']|["']$/g, '').trim();
        const colonIndex = headerStr.indexOf(':');
        if (colonIndex > -1) {
          headers.push({
            id: 'hdr_' + Math.random().toString(36).substring(2, 9),
            key: headerStr.substring(0, colonIndex).trim(),
            value: headerStr.substring(colonIndex + 1).trim(),
            enabled: true,
          });
        }
        continue;
      }

      // Data / Body: -d, --data, --data-raw, --data-binary, --data-urlencode, -F, --form
      if (
        token === '-d' ||
        token === '--data' ||
        token === '--data-raw' ||
        token === '--data-binary' ||
        token === '--data-urlencode' ||
        token === '-F' ||
        token === '--form' ||
        lowerToken.startsWith('--data=') ||
        lowerToken.startsWith('--data-raw=')
      ) {
        let bodyVal = '';
        if (lowerToken.includes('=')) {
          bodyVal = token.substring(token.indexOf('=') + 1);
        } else if (i + 1 < tokens.length) {
          bodyVal = tokens[++i];
        }
        bodyVal = bodyVal.replace(/^["']|["']$/g, '');
        if (bodyText) {
          bodyText += '&' + bodyVal;
        } else {
          bodyText = bodyVal;
        }
        if (method === 'GET') method = 'POST';
        continue;
      }

      // User / Auth: -u or --user e.g. user:pass
      if (token === '-u' || token === '--user' || lowerToken.startsWith('--user=')) {
        let userVal = '';
        if (lowerToken.startsWith('--user=')) {
          userVal = token.substring(7);
        } else if (i + 1 < tokens.length) {
          userVal = tokens[++i];
        }
        userVal = userVal.replace(/^["']|["']$/g, '').trim();
        if (userVal) {
          headers.push({
            id: 'hdr_' + Math.random().toString(36).substring(2, 9),
            key: 'Authorization',
            value: 'Basic ' + (typeof btoa !== 'undefined' ? btoa(userVal) : userVal),
            enabled: true,
          });
        }
        continue;
      }

      // --url parameter
      if (token === '--url' || lowerToken.startsWith('--url=')) {
        if (lowerToken.startsWith('--url=')) {
          url = token.substring(6).replace(/^["']|["']$/g, '');
        } else if (i + 1 < tokens.length) {
          url = tokens[++i].replace(/^["']|["']$/g, '');
        }
        continue;
      }

      // Skip other common cURL options with single parameter
      if (
        [
          '-A', '--user-agent',
          '-b', '--cookie',
          '-c', '--cookie-jar',
          '-e', '--referer',
          '-m', '--max-time',
          '--connect-timeout',
          '--retry',
          '--proxy',
          '-o', '--output',
        ].includes(token)
      ) {
        i++; // Skip option argument
        continue;
      }

      // Skip non-URL flag options starting with -
      if (token.startsWith('-')) {
        continue;
      }

      // Assign URL if not already found
      if (!url) {
        url = token;
      }
    }

    if (!url) return null;

    // Determine body mode
    let bodyMode: RequestBody['mode'] = 'none';
    if (bodyText) {
      const trimmedBody = bodyText.trim();
      if ((trimmedBody.startsWith('{') && trimmedBody.endsWith('}')) || (trimmedBody.startsWith('[') && trimmedBody.endsWith(']'))) {
        bodyMode = 'json';
      } else {
        bodyMode = 'x-www-form-urlencoded';
      }
    }

    return {
      id: 'req_curl_' + Math.random().toString(36).substring(2, 9),
      name: `Imported cURL (${method})`,
      method,
      url,
      headers,
      queryParams: [],
      body: {
        mode: bodyMode,
        rawText: bodyText,
      },
      auth,
    };
  } catch (err) {
    console.error('Error parsing cURL:', err);
    return null;
  }
}

// ---------------------------------------------------------------------
// OpenAPI / Swagger Spec Parser (JSON & YAML support)
// ---------------------------------------------------------------------
export function parseOpenApiSpec(specText: string): {
  folders: { id: string; name: string; fileIds: string[] }[];
  files: RestFile[];
  title?: string;
  error?: string;
} {
  const folders: { id: string; name: string; fileIds: string[] }[] = [];
  const files: RestFile[] = [];

  let spec: any = null;

  // 1. Attempt JSON parsing
  try {
    spec = JSON.parse(specText);
  } catch (jsonErr) {
    // 2. Fallback to basic YAML parsing if string contains YAML structures
    try {
      spec = parseYamlToObj(specText);
    } catch (yamlErr) {
      return {
        folders: [],
        files: [],
        error: 'Unable to parse OpenAPI spec. Please ensure it is valid JSON or YAML format.',
      };
    }
  }

  if (!spec || typeof spec !== 'object') {
    return {
      folders: [],
      files: [],
      error: 'Invalid OpenAPI document: Root structure must be an object.',
    };
  }

  const isSwaggerV2 = !!spec.swagger;
  const isOpenApiV3 = !!spec.openapi;

  if (!isSwaggerV2 && !isOpenApiV3 && !spec.paths) {
    return {
      folders: [],
      files: [],
      error: 'Document missing "openapi", "swagger", or "paths" object.',
    };
  }

  const specTitle = spec.info?.title || 'OpenAPI API Specification';

  // Determine Base URL
  let baseUrl = 'https://api.example.com';
  if (isOpenApiV3 && Array.isArray(spec.servers) && spec.servers.length > 0) {
    baseUrl = spec.servers[0].url || 'https://api.example.com';
    // Replace server variables if present e.g. {scheme}://{host}
    if (spec.servers[0].variables) {
      Object.keys(spec.servers[0].variables).forEach((vKey) => {
        const defaultVal = spec.servers[0].variables[vKey]?.default || '';
        baseUrl = baseUrl.replace(new RegExp(`\\{${vKey}\\}`, 'g'), defaultVal);
      });
    }
  } else if (isSwaggerV2) {
    const scheme = (spec.schemes && spec.schemes[0]) || 'https';
    const host = spec.host || 'api.example.com';
    const basePath = spec.basePath || '';
    baseUrl = `${scheme}://${host}${basePath}`;
  }

  // Remove trailing slash from baseUrl
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

  // Group requests by tag
  const tagGroupedRequests: Record<string, RestRequest[]> = {};

  const paths = spec.paths || {};
  const httpMethods: HTTPMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'QUERY'];

  Object.keys(paths).forEach((pathKey) => {
    const pathItem = paths[pathKey];
    if (!pathItem || typeof pathItem !== 'object') return;

    // Common path parameters
    const commonParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

    Object.keys(pathItem).forEach((key) => {
      const upperMethod = key.toUpperCase() as HTTPMethod;
      if (!httpMethods.includes(upperMethod)) return;

      const op = pathItem[key];
      if (!op || typeof op !== 'object') return;

      const reqName = op.summary || op.operationId || `${upperMethod} ${pathKey}`;
      const tag = (Array.isArray(op.tags) && op.tags[0]) || 'General';

      // Combine common & operation parameters
      const allParams = [...commonParams, ...(Array.isArray(op.parameters) ? op.parameters : [])];

      const queryParams: KeyValuePair[] = [];
      const headers: KeyValuePair[] = [];
      let finalPath = pathKey;

      allParams.forEach((param: any) => {
        if (!param || typeof param !== 'object') return;
        const pName = param.name || '';
        const pValue = param.example || param.default || (param.schema?.example) || 'value';

        if (param.in === 'query') {
          queryParams.push({
            id: 'qp_' + Math.random().toString(36).substring(2, 9),
            key: pName,
            value: String(pValue),
            enabled: true,
          });
        } else if (param.in === 'header') {
          headers.push({
            id: 'hdr_' + Math.random().toString(36).substring(2, 9),
            key: pName,
            value: String(pValue),
            enabled: true,
          });
        }
      });

      // Request Body
      let bodyRaw = '';
      let bodyMode: RequestBody['mode'] = 'none';

      // OpenAPI 3.x requestBody
      if (op.requestBody && op.requestBody.content) {
        const contentTypes = Object.keys(op.requestBody.content);
        const jsonType = contentTypes.find((c) => c.includes('json')) || contentTypes[0];
        if (jsonType) {
          const mediaTypeObj = op.requestBody.content[jsonType];
          bodyMode = jsonType.includes('json') ? 'json' : 'raw';

          headers.push({
            id: 'hdr_' + Math.random().toString(36).substring(2, 9),
            key: 'Content-Type',
            value: jsonType,
            enabled: true,
          });

          if (mediaTypeObj.example) {
            bodyRaw = typeof mediaTypeObj.example === 'object' ? JSON.stringify(mediaTypeObj.example, null, 2) : String(mediaTypeObj.example);
          } else if (mediaTypeObj.schema) {
            bodyRaw = generateSampleFromJsonSchema(mediaTypeObj.schema);
          }
        }
      } else if (isSwaggerV2) {
        // Swagger 2.0 body param
        const bodyParam = allParams.find((p: any) => p.in === 'body');
        if (bodyParam) {
          bodyMode = 'json';
          headers.push({
            id: 'hdr_' + Math.random().toString(36).substring(2, 9),
            key: 'Content-Type',
            value: 'application/json',
            enabled: true,
          });
          if (bodyParam.schema) {
            bodyRaw = generateSampleFromJsonSchema(bodyParam.schema);
          }
        }
      }

      // Security / Auth
      const auth: RequestAuth = { type: 'none', bearerToken: '' };

      const fullReqUrl = `${baseUrl}${finalPath}`;

      const request: RestRequest = {
        id: 'req_oai_' + Math.random().toString(36).substring(2, 9),
        name: reqName,
        method: upperMethod,
        url: fullReqUrl,
        headers,
        queryParams,
        body: {
          mode: bodyMode,
          rawText: bodyRaw,
        },
        auth,
      };

      if (!tagGroupedRequests[tag]) {
        tagGroupedRequests[tag] = [];
      }
      tagGroupedRequests[tag].push(request);
    });
  });

  // Convert tag groups to files
  const tagNames = Object.keys(tagGroupedRequests);
  if (tagNames.length === 0) {
    return {
      folders: [],
      files: [],
      error: 'No endpoints found under "paths" in the provided OpenAPI spec.',
    };
  }

  tagNames.forEach((tagName) => {
    const reqs = tagGroupedRequests[tagName];
    const fileName = `${tagName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}.rest`;
    const fileId = 'file_oai_' + Math.random().toString(36).substring(2, 9);

    const restFile: RestFile = {
      id: fileId,
      name: fileName,
      rawContent: generateRestFileContent(reqs),
      requests: reqs,
      updatedAt: Date.now(),
    };

    files.push(restFile);
  });

  return {
    folders,
    files,
    title: specTitle,
  };
}

// Generate sample JSON from schema
function generateSampleFromJsonSchema(schema: any): string {
  if (!schema || typeof schema !== 'object') return '';

  if (schema.example) {
    return typeof schema.example === 'object' ? JSON.stringify(schema.example, null, 2) : String(schema.example);
  }

  function sampleValue(s: any): any {
    if (!s) return null;
    if (s.example !== undefined) return s.example;
    if (s.default !== undefined) return s.default;

    const type = s.type || (s.properties ? 'object' : 'string');

    if (type === 'string') {
      if (s.format === 'date-time') return new Date().toISOString();
      if (s.format === 'email') return 'user@example.com';
      if (s.enum && s.enum.length > 0) return s.enum[0];
      return 'string_value';
    }
    if (type === 'integer' || type === 'number') return 10;
    if (type === 'boolean') return true;
    if (type === 'array') {
      return [sampleValue(s.items || {})];
    }
    if (type === 'object') {
      const obj: Record<string, any> = {};
      const props = s.properties || {};
      Object.keys(props).forEach((pKey) => {
        obj[pKey] = sampleValue(props[pKey]);
      });
      return obj;
    }
    return 'value';
  }

  try {
    const sample = sampleValue(schema);
    return JSON.stringify(sample, null, 2);
  } catch (e) {
    return '{}';
  }
}

export interface SmartPasteResult {
  type: 'curl' | 'postman' | 'openapi' | 'rest_file' | 'url' | 'unknown';
  title: string;
  summary: string;
  requests: RestRequest[];
  files: RestFile[];
  fileVariables?: Record<string, string>;
  error?: string;
}

export function detectAndParsePaste(rawText: string): SmartPasteResult {
  const trimmed = (rawText || '').trim();

  if (!trimmed) {
    return {
      type: 'unknown',
      title: 'Empty Content',
      summary: 'Paste cURL, Postman Collection JSON, REST file, or OpenAPI Spec',
      requests: [],
      files: [],
    };
  }

  // 1. Check for cURL command
  if (trimmed.toLowerCase().startsWith('curl') || /^\s*curl\s+-/i.test(trimmed)) {
    const req = parseCurlCommand(trimmed);
    if (req && req.url) {
      return {
        type: 'curl',
        title: 'cURL Command',
        summary: `${req.method} ${req.url.substring(0, 50)}${req.url.length > 50 ? '...' : ''}`,
        requests: [req],
        files: [],
      };
    }
  }

  // 2. Check for JSON format (Postman Collection or OpenAPI JSON)
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const jsonObj = JSON.parse(trimmed);

      // Postman Collection?
      if (
        jsonObj.info ||
        jsonObj._postman_id ||
        (jsonObj.requests && Array.isArray(jsonObj.requests)) ||
        (jsonObj.item && Array.isArray(jsonObj.item))
      ) {
        const pmResult = parsePostmanCollection(jsonObj);
        if (!pmResult.error && pmResult.files.length > 0) {
          const allReqs = pmResult.files.flatMap((f) => f.requests);
          return {
            type: 'postman',
            title: jsonObj.info?.name || 'Postman Collection',
            summary: `Parsed Postman collection with ${allReqs.length} endpoint(s) across ${pmResult.files.length} file(s)`,
            requests: allReqs,
            files: pmResult.files,
          };
        }
      }

      // OpenAPI / Swagger JSON?
      if (jsonObj.openapi || jsonObj.swagger || jsonObj.paths) {
        const openApiResult = parseOpenApiSpec(trimmed);
        if (!openApiResult.error && openApiResult.files.length > 0) {
          const allReqs = openApiResult.files.flatMap((f) => f.requests);
          return {
            type: 'openapi',
            title: openApiResult.title || jsonObj.info?.title || 'OpenAPI Specification',
            summary: `Parsed OpenAPI spec with ${allReqs.length} endpoint(s) across ${openApiResult.files.length} tag file(s)`,
            requests: allReqs,
            files: openApiResult.files,
          };
        }
      }
    } catch (e) {
      // Not valid JSON, fall through
    }
  }

  // 3. Check for OpenAPI YAML format
  if (
    /^\s*(openapi|swagger):\s*["']?\d/m.test(trimmed) ||
    (/^\s*paths:\s*$/m.test(trimmed) && /^\s*info:\s*$/m.test(trimmed))
  ) {
    const openApiResult = parseOpenApiSpec(trimmed);
    if (!openApiResult.error && openApiResult.files.length > 0) {
      const allReqs = openApiResult.files.flatMap((f) => f.requests);
      return {
        type: 'openapi',
        title: openApiResult.title || 'OpenAPI Specification (YAML)',
        summary: `Parsed OpenAPI YAML spec with ${allReqs.length} endpoint(s)`,
        requests: allReqs,
        files: openApiResult.files,
      };
    }
  }

  // 4. Check for REST File format (.rest / .http)
  if (
    /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|QUERY)\s+(https?:\/\/|\{\{|\/)/m.test(trimmed) ||
    /^\s*@[a-zA-Z0-9_]+\s*=/m.test(trimmed) ||
    /^\s*###/m.test(trimmed)
  ) {
    const restResult = parseRestFileContent(trimmed, 'pasted_requests.rest');
    if (restResult.requests.length > 0) {
      return {
        type: 'rest_file',
        title: 'REST File Snippet',
        summary: `Parsed REST file snippet with ${restResult.requests.length} request(s)`,
        requests: restResult.requests,
        files: [],
        fileVariables: restResult.fileVariables,
      };
    }
  }

  // 5. Direct HTTP / HTTPS URL
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    const urlReq: RestRequest = {
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: `GET ${trimmed.substring(0, 40)}`,
      method: 'GET',
      url: trimmed,
      headers: [],
      queryParams: [],
      body: { mode: 'none', rawText: '' },
      auth: { type: 'none', bearerToken: '' },
    };
    return {
      type: 'url',
      title: 'Direct HTTP URL',
      summary: `Parsed direct URL: ${trimmed}`,
      requests: [urlReq],
      files: [],
    };
  }

  // 6. Fallback: Try cURL parsing in case keyword 'curl' was omitted e.g. -X POST "http..."
  if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes(' -H ') || trimmed.includes(' -X ')) {
    const fakeCurl = trimmed.toLowerCase().startsWith('curl') ? trimmed : `curl ${trimmed}`;
    const curlReq = parseCurlCommand(fakeCurl);
    if (curlReq && curlReq.url) {
      return {
        type: 'curl',
        title: 'cURL Command (Inferred)',
        summary: `${curlReq.method} ${curlReq.url}`,
        requests: [curlReq],
        files: [],
      };
    }
  }

  return {
    type: 'unknown',
    title: 'Unrecognized Format',
    summary: 'Could not auto-detect format. Expected cURL, Postman JSON, REST file, or OpenAPI Spec.',
    requests: [],
    files: [],
    error: 'Unrecognized format',
  };
}


