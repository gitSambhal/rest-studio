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
    const res = await fetch(targetUrl, fetchOptions);
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
      // 1. Attempt Service Worker Proxy Bridge automatically as primary fallback
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
    // automatically proxy the request via /api/proxy to bypass CORS completely
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
          console.log('[RestStudio] Auto-proxy bypass for CORS succeeded!');
          return data;
        }
      }
    } catch (proxyErr) {
      console.warn('[RestStudio] Auto-proxy bypass attempt failed:', proxyErr);
    }

    return {
      status: 0,
      statusText: 'Network Error / CORS Blocked',
      headers: {},
      body: JSON.stringify(
        {
          error: 'Direct Client-Side Fetch failed (CORS restriction or network error).',
          targetUrl,
          message: err?.message || 'Failed to fetch',
          cause: 'Browsers enforce Same-Origin Policy (CORS). RestStudio automatically attempted the CORS-bypass server proxy.',
          tips: [
            '1. Ensure the target URL is correct and accessible.',
            '2. Test APIs that allow public CORS (e.g. jsonplaceholder.typicode.com, httpbin.org).',
            '3. Check server logs or firewall settings for target URL.',
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
