import { ExecutionResponse } from '../types';

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
    targetUrl = 'https://' + targetUrl;
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

  // 3. Mode 'auto' or 'proxy': Try /api/proxy first, with automatic direct fetch fallback
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

    // Detect if server returned a 404 HTML page or SPA index fallback
    const isHtmlResponse = responseText.trim().toLowerCase().startsWith('<!doctype') || contentType.includes('text/html');

    if (!proxyRes.ok && (proxyRes.status === 404 || isHtmlResponse)) {
      if (requestMode === 'proxy') {
        // If strictly 'proxy' mode was requested, return a descriptive error
        return {
          status: 404,
          statusText: 'Proxy Endpoint Not Found (404)',
          headers: {},
          body: JSON.stringify(
            {
              error: '/api/proxy is not available on this endpoint.',
              recommendation: 'Switch request mode to "Direct Client Fetch" or "Auto Fallback" in Settings.',
            },
            null,
            2
          ),
          size: 0,
          duration: Math.round(performance.now() - startTime),
          timestamp: Date.now(),
          ok: false,
          error: 'Proxy endpoint 404',
        };
      }

      // Auto mode: Fallback to direct client fetch seamlessly
      console.warn('[RestStudio] /api/proxy not available (static host detected). Falling back to direct client fetch.');
      return await executeDirectClientFetch(method, targetUrl, headers, body);
    }

    if (isHtmlResponse) {
      console.warn('[RestStudio] /api/proxy returned HTML instead of JSON. Falling back to direct client fetch.');
      return await executeDirectClientFetch(method, targetUrl, headers, body);
    }

    // Try parsing JSON safely
    try {
      const responseData: ExecutionResponse = JSON.parse(responseText);
      return responseData;
    } catch (jsonParseErr) {
      console.warn('[RestStudio] Failed to parse proxy response as JSON. Falling back to direct client fetch.', jsonParseErr);
      return await executeDirectClientFetch(method, targetUrl, headers, body);
    }
  } catch (err: any) {
    if (requestMode === 'proxy') {
      return {
        status: 0,
        statusText: 'Proxy Request Failed',
        headers: {},
        body: JSON.stringify({ error: 'Failed to connect to proxy server', details: err.message }, null, 2),
        size: 0,
        duration: 0,
        timestamp: Date.now(),
        ok: false,
        error: err.message,
      };
    }

    // Fall back to direct client fetch
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

  try {
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: { ...headers },
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body !== undefined && body !== null) {
      if (typeof body === 'object') {
        fetchOptions.body = JSON.stringify(body);
      } else {
        fetchOptions.body = String(body);
      }
    }

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

    return {
      status: 0,
      statusText: 'Network Error / CORS Blocked',
      headers: {},
      body: JSON.stringify(
        {
          error: 'Direct Client-Side Fetch failed (CORS restriction or network error).',
          targetUrl,
          message: err?.message || 'Failed to fetch',
          cause: 'Browsers enforce Same-Origin Policy (CORS). If the target server does not send `Access-Control-Allow-Origin` headers, direct browser requests are blocked.',
          tips: [
            '1. Ensure the target URL is correct and accessible.',
            '2. Test APIs that allow public CORS (e.g. jsonplaceholder.typicode.com, httpbin.org).',
            '3. Configure a custom CORS proxy in RestStudio Settings if contacting non-CORS APIs.',
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
