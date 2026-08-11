import { ExecutionResponse } from '../types';
import { fetchViaServiceWorkerBridge, requestLocalNetworkPermission } from './localhostBridge';

export interface HttpRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Executes an HTTP request for RestStudio.
 * Supports:
 * 1. Automatic Fallback: Tries `/api/proxy` first (if backend available).
 *    If `/api/proxy` is unreachable or returns 404/HTML,
 *    it automatically falls back to Direct Client-Side Browser `fetch()`.
 * 2. Explicit Execution Modes:
 *    - 'auto': Proxy first -> Direct Client Fetch fallback
 *    - 'direct': Direct Client-Side Browser `fetch()`
 *    - 'proxy': Server proxy only
 * 3. Custom Proxy URL: Route requests via a user-defined CORS proxy if specified.
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

  // 0a. Check if running inside Tauri (Rust Native Lightweight App ~3MB)
  if (typeof window !== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_IPC__)) {
    try {
      console.log('[RestStudio Tauri] Executing via Tauri Native Rust Engine...');
      const tauriFetch = (window as any).__TAURI__?.http?.fetch || fetch;
      const startTime = performance.now();
      const res = await tauriFetch(targetUrl, {
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
    } catch (tErr) {
      console.warn('[RestStudio Tauri] Native Tauri execution error, falling back:', tErr);
    }
  }

  // 0b. Check if running inside Electron Native Desktop Container!
  if (typeof window !== 'undefined' && (window as any).electronAPI?.isElectron) {
    try {
      console.log('[RestStudio Desktop] Executing via Electron Native Node HTTP Engine...');
      const electronRes = await (window as any).electronAPI.executeRequest({
        method,
        url: targetUrl,
        headers,
        body,
      });
      if (electronRes) {
        return electronRes;
      }
    } catch (e) {
      console.warn('[RestStudio Desktop] Native Electron execution error, falling back to web pipeline:', e);
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

  // 3. For localhost requests on non-3000 ports in 'auto' mode:
  // Try direct browser fetch first since 'localhost' lives on the user's computer
  if (isLocalhostUrl && !targetUrl.includes(':3000')) {
    const directRes = await executeDirectClientFetch(method, targetUrl, headers, body);
    if (directRes.ok || directRes.status > 0) {
      return directRes;
    }
  }

  // 4. Mode 'auto' or 'proxy': Try /api/proxy first
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

    // Detect if server returned non-200, 404 HTML page or SPA index fallback
    const isHtmlResponse = responseText.trim().toLowerCase().startsWith('<!doctype') || responseText.trim().toLowerCase().startsWith('<html') || contentType.includes('text/html');

    if (!proxyRes.ok || isHtmlResponse) {
      console.warn('[RestStudio] /api/proxy error or HTML response. Auto falling back to direct client fetch.');
      return await executeDirectClientFetch(method, targetUrl, headers, body);
    }

    // Try parsing JSON safely
    try {
      const responseData: ExecutionResponse = JSON.parse(responseText);

      // If the proxy reached target server and got a real HTTP response status (> 0, e.g. 200, 400, 404, 500), return it
      if (responseData.status > 0) {
        return responseData;
      }

      // If responseData.status === 0 (proxy could not connect to target server e.g. ECONNREFUSED)
      console.warn('[RestStudio] Proxy returned status 0 (connection error). Auto falling back to direct client fetch.');
      const directClientRes = await executeDirectClientFetch(method, targetUrl, headers, body);

      // If direct client fetch succeeded or got an actual response status > 0, return it
      if (directClientRes.status > 0) {
        return directClientRes;
      }

      // If direct client fetch also returned status 0, return directClientRes
      return directClientRes;
    } catch (jsonParseErr) {
      console.warn('[RestStudio] Failed to parse proxy response as JSON. Falling back to direct client fetch.', jsonParseErr);
      return await executeDirectClientFetch(method, targetUrl, headers, body);
    }
  } catch (err: any) {
    // Server proxy fetch network/connection exception -> fall back to direct client fetch
    console.warn('[RestStudio] Server proxy fetch error, falling back to direct client fetch:', err?.message);
    return await executeDirectClientFetch(method, targetUrl, headers, body);
  }
}

/**
 * Helper to execute request via public CORS proxies (corsproxy.io, allorigins.win, thingproxy)
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
 * Executes requests directly from the user's browser without requiring any server or function backend.
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
    // If target URL is on local-cors-proxy default port (8010) and missing /proxy/ prefix, auto-format
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
      // 1. Try formatted /proxy/ URL if not tried yet
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

      // 2. Automatically trigger Chrome's Local Network Access preflight
      try {
        await requestLocalNetworkPermission(targetUrl);
        // Retry direct fetch after preflight permission trigger
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
            howChromePermissionWorks: [
              '1. Click "Allow" if Chrome displays the "Local network devices and apps" permission prompt in the address bar.',
              '2. Check Chrome Site Settings -> "Local network access" or "Insecure content" for this site origin and set to "Allow".',
              '3. Ensure your local server sends CORS headers: `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Private-Network: true`.',
              '4. Or run `npx ngrok http <port>` (e.g. https://xxxx.ngrok-free.app) for instant remote & local testing without browser restrictions.'
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
    // 1. Automatically proxy the request via /api/proxy (Axios Server Proxy)
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

    // 2. Fallback to public CORS proxy services (corsproxy.io, allorigins.win, thingproxy)
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
          error: 'Fetch failed across Direct Fetch, Server Axios Proxy, and Public CORS Proxies (corsproxy.io, allorigins.win).',
          targetUrl,
          message: err?.message || 'Failed to fetch',
          cause: 'Browsers enforce Same-Origin Policy (CORS). RestStudio automatically attempted the server proxy and public CORS proxy services.',
          tips: [
            '1. Ensure the target URL is correct, valid, and publicly reachable.',
            '2. Check if the target API endpoint is currently online.',
            '3. For local APIs (http://localhost), ensure your server is running and listening.',
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
 * Routes requests via a user-defined CORS proxy URL.
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
