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
      if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(firstWord)) {
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
    const cleanCurl = curlCommand.replace(/\\\n/g, ' ').trim();
    if (!cleanCurl.toLowerCase().startsWith('curl')) return null;

    let method: HTTPMethod = 'GET';
    let url = '';
    const headers: KeyValuePair[] = [];
    let bodyText = '';

    // Regex match arguments
    const tokens = cleanCurl.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

    for (let i = 1; i < tokens.length; i++) {
      let token = tokens[i];

      // Strip surrounding quotes
      if (
        (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))
      ) {
        token = token.substring(1, token.length - 1);
      }

      if (token === '-X' || token === '--request') {
        method = (tokens[++i]?.replace(/["']/g, '').toUpperCase() as HTTPMethod) || 'GET';
      } else if (token === '-H' || token === '--header') {
        const headerStr = tokens[++i]?.replace(/^["']|["']$/g, '') || '';
        const colonIndex = headerStr.indexOf(':');
        if (colonIndex > -1) {
          headers.push({
            id: 'hdr_' + Math.random().toString(36).substring(2, 9),
            key: headerStr.substring(0, colonIndex).trim(),
            value: headerStr.substring(colonIndex + 1).trim(),
            enabled: true,
          });
        }
      } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
        if (method === 'GET') method = 'POST';
        bodyText = tokens[++i]?.replace(/^["']|["']$/g, '') || '';
      } else if (!token.startsWith('-') && !url) {
        url = token;
      }
    }

    if (!url) return null;

    // Check if body is JSON
    let bodyMode: RequestBody['mode'] = bodyText ? 'json' : 'none';

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
      auth: {
        type: 'none',
        bearerToken: '',
      },
    };
  } catch (err) {
    console.error('Error parsing cURL:', err);
    return null;
  }
}
