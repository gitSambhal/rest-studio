import { ExecutionResponse } from '../types';
import { fetchViaServiceWorkerBridge, requestLocalNetworkPermission } from './localhostBridge';

export interface HttpRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Execute HTTP requests via Neutralino Native OS Engine (curl or native fetch)
 */
async function executeNeutralinoFetch(
  method: string,
  targetUrl: string,
  headers: Record<string, string>,
  body?: any
): Promise<ExecutionResponse | null> {
  const neu = (window as any).Neutralino;
  const startTime = performance.now();

  // 1. Try Neutralino OS execCommand with native curl (0 CORS/PNA restrictions)
  if (neu && neu.os && typeof neu.os.execCommand === 'function') {
    try {
      let headerArgs = '';
      if (headers && typeof headers === 'object') {
        Object.entries(headers).forEach(([k, v]) => {
          if (k && v !== undefined && v !== null) {
            headerArgs += ` -H "${k.replace(/"/g, '\\"')}: ${String(v).replace(/"/g, '\\"')}"`;
          }
        });
      }

      let bodyArg = '';
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body !== undefined && body !== null) {
        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
        bodyArg = ` -d ${JSON.stringify(bodyStr)}`;
      }

      // -i includes response headers, -s suppresses progress meter, -S shows errors
      const curlCmd = `curl -i -s -S -X ${method.toUpperCase()}${headerArgs}${bodyArg} "${targetUrl.replace(/"/g, '\\"')}"`;
      console.log('[RestStudio Neutralino] Executing native OS curl command...');

      const execResult = await neu.os.execCommand(curlCmd);
      if (execResult && typeof execResult.stdOut === 'string' && execResult.stdOut.trim()) {
        const rawOutput = execResult.stdOut;
        const duration = Math.round(performance.now() - startTime);

        // Parse response status, headers, and body
        const headerBodySplit = rawOutput.split(/\r?\n\r?\n/);
        const rawHeaders = headerBodySplit[0] || '';
        const responseBody = headerBodySplit.slice(1).join('\r\n\r\n') || '';

        const statusMatch = rawHeaders.match(/HTTP\/\d\.\d\s+(\d+)\s*(.*)/i);
        const status = statusMatch ? parseInt(statusMatch[1], 10) : 200;
        const statusText = statusMatch ? statusMatch[2].trim() : 'OK';

        const parsedHeaders: Record<string, string> = {};
        rawHeaders.split(/\r?\n/).forEach((line) => {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const k = line.substring(0, colonIdx).trim().toLowerCase();
            const v = line.substring(colonIdx + 1).trim();
            parsedHeaders[k] = v;
          }
        });

        return {
          status,
          statusText,
          headers: parsedHeaders,
          body: responseBody,
          size: new Blob([responseBody]).size,
          duration,
          timestamp: Date.now(),
          ok: status >= 200 && status < 300,
          contentType: parsedHeaders['content-type'] || 'text/plain',
        };
      }
    } catch (cmdErr) {
      console.warn('[RestStudio Neutralino] OS execCommand curl attempt failed:', cmdErr);
    }
  }

  // 2. Fallback to standard webview fetch
  try {
    const res = await fetch(targetUrl, {
      method: method.toUpperCase(),
      headers,
      body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body ? (typeof body === 'object' ? JSON.stringify(body) : String(body)) : undefined,
    });
    const duration = Math.round(performance.now() - startTime);
    const text = await res.text();
    const resHeaders: Record<string, string> = {};
    if (res.headers && typeof res.headers.forEach === 'function') {
      res.headers.forEach((v: string, k: string) => { resHeaders[k] = v; });
    }
    return {
      status: res.status,
      statusText: res.statusText || 'OK',
      headers: resHeaders,
      body: text,
      size: new Blob([text]).size,
      duration,
      timestamp: Date.now(),
      ok: res.ok,
      contentType: res.headers?.get('content-type') || 'text/plain',
    };
  } catch (fErr) {
    console.warn('[RestStudio Neutralino] Neutralino webview fetch error:', fErr);
  }

  return null;
}

/**
 * Execute HTTP requests via Tauri Native Engine
 */
async function executeTauriFetch(
  method: string,
  targetUrl: string,
  headers: Record<string, string>,
  body?: any
): Promise<ExecutionResponse | null> {
  const startTime = performance.now();

  // 1. Try Tauri v2/v1 http plugin fetch if present
  if ((window as any).__TAURI__?.http?.fetch) {
    try {
      const res = await (window as any).__TAURI__.http.fetch(targetUrl, {
        method: method.toUpperCase(),
        headers,
        body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body ? (typeof body === 'object' ? JSON.stringify(body) : String(body)) : undefined,
      });
      const duration = Math.round(performance.now() - startTime);
      const text = await res.text();
      const resHeaders: Record<string, string> = {};
      if (res.headers && typeof res.headers.forEach === 'function') {
        res.headers.forEach((v: string, k: string) => { resHeaders[k] = v; });
      }
      return {
        status: res.status,
        statusText: res.statusText || 'OK',
        headers: resHeaders,
        body: text,
        size: new Blob([text]).size,
        duration,
        timestamp: Date.now(),
        ok: res.ok,
        contentType: res.headers?.get('content-type') || 'text/plain',
      };
    } catch (err) {
      console.warn('[RestStudio Tauri] Tauri http fetch failed:', err);
    }
  }

  // 2. Fallback to standard webview fetch inside Tauri window
  try {
    const res = await fetch(targetUrl, {
      method: method.toUpperCase(),
      headers,
      body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body ? (typeof body === 'object' ? JSON.stringify(body) : String(body)) : undefined,
    });
    const duration = Math.round(performance.now() - startTime);
    const text = await res.text();
    const resHeaders: Record<string, string> = {};
    if (res.headers && typeof res.headers.forEach === 'function') {
      res.headers.forEach((v: string, k: string) => { resHeaders[k] = v; });
    }
    return {
      status: res.status,
      statusText: res.statusText || 'OK',
      headers: resHeaders,
      body: text,
      size: new Blob([text]).size,
      duration,
      timestamp: Date.now(),
      ok: res.ok,
      contentType: res.headers?.get('content-type') || 'text/plain',
    };
  } catch (err) {
    console.warn('[RestStudio Tauri] Standard fetch inside Tauri failed:', err);
  }

  return null;
}

/**
 * Executes an HTTP request for RestStudio.
 */
export async function executeHttpRequest(options: HttpRequestOptions): Promise<ExecutionResponse> {
  const { method = 'GET', url, headers = {}, body } = options;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return {
      status: 0,
      statusText: 'Bad Request',
      headers: {},
      body: JSON.stringify({ error: 'Valid URL parameter is required' }, null, 2),
      size: 0,
      duration: 0,
      timestamp: Date.now(),
      ok: false,
      error: 'Valid URL is required',
    };
  }

  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (targetUrl.startsWith('/')) {
      targetUrl = 'http://127.0.0.1:3000' + targetUrl;
    } else if (
      targetUrl.startsWith('localhost') ||
      targetUrl.startsWith('127.0.0.1') ||
      targetUrl.startsWith('0.0.0.0')
    ) {
      targetUrl = 'http://' + targetUrl;
    } else {
      targetUrl = 'https://' + targetUrl;
    }
  }

  const isLocalhostUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(targetUrl);

  // 0a. Check if running inside Neutralino Native Desktop Container (~2MB)
  if (typeof window !== 'undefined' && ((window as any).Neutralino || (window as any).NL_PORT || (window as any).__NL_PORT__)) {
    try {
      console.log('[RestStudio Neutralino] Executing via Neutralino Native OS Engine...');
      const neuRes = await executeNeutralinoFetch(method, targetUrl, headers, body);
      if (neuRes && neuRes.status > 0) {
        return neuRes;
      }
    } catch (nErr) {
      console.warn('[RestStudio Neutralino] Native execution error, falling back:', nErr);
    }
  }

  // 0b. Check if running inside Tauri Native Desktop Container (~3MB)
  if (typeof window !== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_IPC__)) {
    try {
      console.log('[RestStudio Tauri] Executing via Tauri Native Rust Engine...');
      const tauriRes = await executeTauriFetch(method, targetUrl, headers, body);
      if (tauriRes && tauriRes.status > 0) {
        return tauriRes;
      }
    } catch (tErr) {
      console.warn('[RestStudio Tauri] Native Tauri execution error, falling back:', tErr);
    }
  }

  // Retrieve user settings from localStorage
  const requestMode = localStorage.getItem('reststudio_request_mode') || 'auto'; // 'auto' | 'direct' | 'proxy'
  const customProxyUrl = localStorage.getItem('reststudio_custom_proxy_url') || '';

  // 1. If explicit direct mode is set
  if (requestMode === 'direct') {
    return await executeDirectClientFetch(method, targetUrl, headers, body);
  }

  // 2. If user configured a custom CORS proxy URL
  if (customProxyUrl.trim()) {
    return await executeCustomProxyFetch(customProxyUrl.trim(), method, targetUrl, headers, body);
  }

  // 3. For ALL localhost / 127.0.0.1 requests in 'auto' mode:
  // Since 'localhost' lives on the user's local physical computer (not on the Cloud Run server),
  // we MUST execute direct client fetch directly.
  if (isLocalhostUrl) {
    const directRes = await executeDirectClientFetch(method, targetUrl, headers, body);
    return directRes;
  }

  // 4. Mode 'auto' or 'proxy': Try /api/proxy first for remote APIs
  try {
    const startTime = performance.now();
    const proxyRes = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        url: targetUrl,
        headers,
        body,
      }),
    });

    const contentType = proxyRes.headers.get('content-type') || '';
    const responseText = await proxyRes.text();

    const isHtmlResponse = responseText.trim().toLowerCase().startsWith('<!doctype') || responseText.trim().toLowerCase().startsWith('<html') || contentType.includes('text/html');

    if (!proxyRes.ok || isHtmlResponse) {
      console.warn('[RestStudio] /api/proxy error or HTML response. Auto falling back to direct client fetch.');
      return await executeDirectClientFetch(method, targetUrl, headers, body);
    }

    try {
      const responseData: ExecutionResponse = JSON.parse(responseText);

      if (responseData.status > 0) {
        return responseData;
      }

      console.warn('[RestStudio] Proxy returned status 0. Auto falling back to direct client fetch.');
      return await executeDirectClientFetch(method, targetUrl, headers, body);
    } catch (jsonParseErr) {
      console.warn('[RestStudio] Failed to parse proxy response as JSON. Falling back to direct client fetch.', jsonParseErr);
      return await executeDirectClientFetch(method, targetUrl, headers, body);
    }
  } catch (err: any) {
    console.warn('[RestStudio] Server proxy fetch error, falling back to direct client fetch:', err?.message);
    return await executeDirectClientFetch(method, targetUrl, headers, body);
  }
}

/**
 * Helper to execute request via public CORS proxies
 */
async function tryPublicCorsProxies(
  method: string,
  targetUrl: string,
  headers: Record<string, string>,
  body?: any
): Promise<ExecutionResponse | null> {
  const proxies = [
    {
      name: 'corsproxy.io',
      getUrl: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    },
    {
      name: 'allorigins.win',
      getUrl: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    },
    {
      name: 'thingproxy',
      getUrl: (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
    },
  ];

  for (const proxy of proxies) {
    try {
      console.log(`[RestStudio] Attempting public CORS proxy: ${proxy.name}...`);
      const proxyTargetUrl = proxy.getUrl(targetUrl);
      const startTime = performance.now();

      const fetchOpts: any = {
        method: method.toUpperCase(),
        headers: { ...headers },
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body !== undefined && body !== null) {
        fetchOpts.body = typeof body === 'object' ? JSON.stringify(body) : String(body);
      }

      const res = await fetch(proxyTargetUrl, fetchOpts);
      const duration = Math.round(performance.now() - startTime);
      const text = await res.text();

      if (res.status > 0) {
        const resHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          resHeaders[k] = v;
        });

        console.log(`[RestStudio] Public CORS Proxy (${proxy.name}) succeeded! Status: ${res.status}`);
        return {
          status: res.status,
          statusText: res.statusText || 'OK',
          headers: resHeaders,
          body: text,
          size: new Blob([text]).size,
          duration,
          timestamp: Date.now(),
          ok: res.ok,
          contentType: res.headers.get('content-type') || 'text/plain',
        };
      }
    } catch (proxyErr) {
      console.warn(`[RestStudio] Public CORS proxy ${proxy.name} failed:`, proxyErr);
    }
  }

  return null;
}

/**
 * Direct Client-Side Browser `fetch()`
 */
export async function executeDirectClientFetch(
  method: string,
  targetUrl: string,
  headers: Record<string, string>,
  body?: any
): Promise<ExecutionResponse> {
  const startTime = performance.now();
  const isLocalhostUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(targetUrl);
  const isPrivateIpUrl = /^https?:\/\/(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/i.test(targetUrl);

  const fetchOptions: any = {
    method: method.toUpperCase(),
    headers: { ...headers },
  };

  if (isLocalhostUrl) {
    fetchOptions.targetAddressSpace = 'local';
  } else if (isPrivateIpUrl) {
    fetchOptions.targetAddressSpace = 'private';
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body !== undefined && body !== null) {
    if (typeof body === 'object') {
      fetchOptions.body = JSON.stringify(body);
    } else {
      fetchOptions.body = String(body);
    }
  }

  try {
    let actualFetchUrl = targetUrl;
    if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):8010\/(?!proxy\/)/i.test(targetUrl)) {
      actualFetchUrl = targetUrl.replace(/^(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):8010)\/(?!proxy\/)?(.*)$/i, '$1/proxy/$2');
      console.log(`[RestStudio] Auto-formatted local-cors-proxy URL to: ${actualFetchUrl}`);
    }

    const res = await fetch(actualFetchUrl, fetchOptions);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    const text = await res.text();
    const size = new Blob([text]).size;

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    return {
      status: res.status,
      statusText: res.statusText || 'OK',
      headers: resHeaders,
      body: text,
      size,
      duration,
      timestamp: Date.now(),
      ok: res.ok,
      contentType: res.headers.get('content-type') || 'text/plain',
    };
  } catch (err: any) {
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    if (isLocalhostUrl || isPrivateIpUrl) {
      // 1. Try formatted /proxy/ URL if local-cors-proxy port 8010 is targeted
      if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):8010\//i.test(targetUrl) && !targetUrl.includes('/proxy/')) {
        const proxyFormattedUrl = targetUrl.replace(/^(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):8010)\/(.*)$/i, '$1/proxy/$2');
        try {
          console.log(`[RestStudio] Retrying with local-cors-proxy path: ${proxyFormattedUrl}`);
          const pRes = await fetch(proxyFormattedUrl, fetchOptions);
          const pText = await pRes.text();
          const pHeaders: Record<string, string> = {};
          pRes.headers.forEach((v, k) => { pHeaders[k] = v; });
          return {
            status: pRes.status,
            statusText: pRes.statusText || 'OK',
            headers: pHeaders,
            body: pText,
            size: new Blob([pText]).size,
            duration: Math.round(performance.now() - startTime),
            timestamp: Date.now(),
            ok: pRes.ok,
            contentType: pRes.headers.get('content-type') || 'text/plain',
          };
        } catch (pErr) {
          console.warn('[RestStudio] Retry with /proxy/ path failed:', pErr);
        }
      }

      // 2. Attempt Service Worker Proxy Bridge automatically as secondary fallback
      try {
        const swBridgeResult = await fetchViaServiceWorkerBridge(method, targetUrl, headers, body);
        if (swBridgeResult.success && swBridgeResult.response) {
          console.log('[RestStudio] Service Worker Localhost Proxy Bridge succeeded automatically!');
          return swBridgeResult.response;
        }
      } catch (swErr) {
        console.warn('[RestStudio] SW Proxy Bridge automatic attempt failed:', swErr);
      }

      // 3. Automatically trigger Chrome's Local Network Access preflight
      try {
        await requestLocalNetworkPermission(targetUrl);
        const retryRes = await fetch(targetUrl, fetchOptions);
        const retryEndTime = performance.now();
        const retryText = await retryRes.text();
        const retryResHeaders: Record<string, string> = {};
        retryRes.headers.forEach((val, key) => {
          retryResHeaders[key] = val;
        });

        console.log('[RestStudio] Automated Local Network Access retry succeeded!');
        return {
          status: retryRes.status,
          statusText: retryRes.statusText || 'OK',
          headers: retryResHeaders,
          body: retryText,
          size: new Blob([retryText]).size,
          duration: Math.round(retryEndTime - startTime),
          timestamp: Date.now(),
          ok: retryRes.ok,
          contentType: retryRes.headers.get('content-type') || 'text/plain',
        };
      } catch (retryErr) {
        console.warn('[RestStudio] Automated retry after preflight failed:', retryErr);
      }

      return {
        status: 0,
        statusText: 'Local Network Access / CORS Blocked',
        headers: {},
        body: JSON.stringify(
          {
            error: `Cannot connect directly to local endpoint at ${targetUrl}`,
            message: err?.message || 'Failed to fetch',
            cause: 'Chrome enforces Private Network Access (PNA) and CORS when HTTPS web apps try to fetch from localhost or private network IPs.',
            swBridgeStatus: 'Automated Service Worker Bridge and PNA preflight executed.',
            howToFix: [
              'Option A (Native Desktop App): Run `npm run neu:dev` or `npm run tauri:dev` for 0 CORS / 0 PNA restrictions.',
              'Option B (Local CORS Proxy): Run `npx local-cors-proxy --proxyUrl http://localhost:3000` (bridges to http://localhost:8010).',
              'Option C (Server CORS Headers): Ensure your local server sends: `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Private-Network: true`.',
              'Option D (Tunnel): Run `npx ngrok http <port>` (e.g. https://xxxx.ngrok-free.app) for instant HTTPS testing.'
            ],
            browserError: err?.message || 'Failed to fetch (Permission denied for local network address space)',
          },
          null,
          2
        ),
        size: 0,
        duration,
        timestamp: Date.now(),
        ok: false,
        error: 'Local network access blocked by browser Private Network Access policy or server CORS header missing',
      };
    }

    // For external non-localhost URLs: if direct fetch fails (typically due to browser CORS rules)
    try {
      console.log('[RestStudio] Direct fetch failed for external API. Auto-proxying via /api/proxy to bypass CORS...');
      const proxyRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, url: targetUrl, headers, body }),
      });

      if (proxyRes.ok) {
        const text = await proxyRes.text();
        const data: ExecutionResponse = JSON.parse(text);
        if (data.status > 0) {
          console.log('[RestStudio] Server auto-proxy bypass for CORS succeeded!');
          return data;
        }
      }
    } catch (proxyErr) {
      console.warn('[RestStudio] Server auto-proxy bypass attempt failed:', proxyErr);
    }

    try {
      const publicProxyResult = await tryPublicCorsProxies(method, targetUrl, headers, body);
      if (publicProxyResult && publicProxyResult.status > 0) {
        console.log('[RestStudio] Public CORS proxy bypass succeeded!');
        return publicProxyResult;
      }
    } catch (pubProxyErr) {
      console.warn('[RestStudio] Public CORS proxy pipeline failed:', pubProxyErr);
    }

    return {
      status: 0,
      statusText: 'Network Error / CORS Blocked',
      headers: {},
      body: JSON.stringify(
        {
          error: 'Fetch failed across Direct Fetch, Server Axios Proxy, and Public CORS Proxies.',
          targetUrl,
          message: err?.message || 'Failed to fetch',
          cause: 'Browsers enforce Same-Origin Policy (CORS).',
          tips: [
            '1. Ensure the target URL is correct, valid, and publicly reachable.',
            '2. Check if the target API endpoint is currently online.',
            '3. For local APIs (http://localhost), launch via `npm run neu:dev` or `npm run tauri:dev`.',
          ],
        },
        null,
        2
      ),
      size: 0,
      duration,
      timestamp: Date.now(),
      ok: false,
      error: err?.message || 'Connection Refused or CORS blocked',
    };
  }
}

/**
 * Custom Proxy Fetch
 */
async function executeCustomProxyFetch(
  proxyUrl: string,
  method: string,
  targetUrl: string,
  headers: Record<string, string>,
  body?: any
): Promise<ExecutionResponse> {
  const startTime = performance.now();
  try {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, url: targetUrl, headers, body }),
    });

    const responseText = await res.text();
    const duration = Math.round(performance.now() - startTime);

    try {
      const data: ExecutionResponse = JSON.parse(responseText);
      return data;
    } catch {
      return {
        status: res.status,
        statusText: res.statusText || 'OK',
        headers: {},
        body: responseText,
        size: new Blob([responseText]).size,
        duration,
        timestamp: Date.now(),
        ok: res.ok,
      };
    }
  } catch (err: any) {
    return {
      status: 0,
      statusText: 'Custom Proxy Error',
      headers: {},
      body: JSON.stringify(
        {
          error: 'Failed to communicate with custom proxy server',
          proxyUrl,
          details: err?.message,
        },
        null,
        2
      ),
      size: 0,
      duration: Math.round(performance.now() - startTime),
      timestamp: Date.now(),
      ok: false,
      error: err?.message,
    };
  }
}
