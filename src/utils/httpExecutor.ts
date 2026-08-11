import { ExecutionResponse } from '../types';

export interface HttpRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Safely retrieve Neutralino SDK instance in desktop mode
 */
async function getNeutralino(): Promise<any> {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (w.Neutralino) return w.Neutralino;
  if (w.NL_PORT || w.NL_MODE || w.__NL_PORT__ || w.location.protocol === 'file:') {
    for (let i = 0; i < 10; i++) {
      if (w.Neutralino) return w.Neutralino;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  return w.Neutralino || null;
}

/**
 * Execute HTTP requests via Neutralino Native OS Engine (curl or webview fetch)
 * Completely bypasses browser CORS & Private Network Access restrictions!
 */
async function executeNeutralinoFetch(
  method: string,
  targetUrl: string,
  headers: Record<string, string>,
  body?: any
): Promise<ExecutionResponse | null> {
  const neu = await getNeutralino();
  const startTime = performance.now();

  if (neu && typeof neu.init === 'function') {
    try { neu.init(); } catch (_) {}
  }

  // 1. Execute via Neutralino OS execCommand with native OS curl (0 CORS/PNA restrictions)
  if (neu && neu.os && typeof neu.os.execCommand === 'function') {
    try {
      let headerArgs = '';
      if (headers && typeof headers === 'object') {
        Object.entries(headers).forEach(([k, v]) => {
          if (k && v !== undefined && v !== null) {
            const cleanK = String(k).replace(/"/g, '\\"');
            const cleanV = String(v).replace(/"/g, '\\"');
            headerArgs += ` -H "${cleanK}: ${cleanV}"`;
          }
        });
      }

      let bodyArg = '';
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body !== undefined && body !== null) {
        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
        const escapedBody = bodyStr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        bodyArg = ` -d "${escapedBody}"`;
      }

      const cleanUrl = targetUrl.replace(/"/g, '\\"');
      const curlCmd = `curl -i -s -S -m 30 -X ${method.toUpperCase()}${headerArgs}${bodyArg} "${cleanUrl}"`;
      console.log('[RestStudio Neutralino] Executing native OS curl command:', curlCmd);

      const execResult = await neu.os.execCommand(curlCmd);
      if (execResult && typeof execResult.stdOut === 'string' && execResult.stdOut.trim()) {
        const rawOutput = execResult.stdOut;
        const duration = Math.round(performance.now() - startTime);

        // Parse response status, headers, and body
        const headerBodySplit = rawOutput.split(/\r?\n\r?\n/);
        const lastHeaderIdx = headerBodySplit.length > 1 ? headerBodySplit.length - 2 : 0;
        const rawHeaders = headerBodySplit[lastHeaderIdx] || headerBodySplit[0] || '';
        const responseBody = headerBodySplit.slice(lastHeaderIdx + 1).join('\r\n\r\n') || '';

        const statusMatch = rawHeaders.match(/HTTP\/\d(?:\.\d)?\s+(\d+)\s*(.*)/i);
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
      console.warn('[RestStudio Neutralino] OS execCommand curl attempt error:', cmdErr);
    }
  }

  // 2. Direct webview fetch inside Neutralino window
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

  // 2. Direct webview fetch inside Tauri window
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
 * Direct Client Browser `fetch()`
 */
export async function executeDirectClientFetch(
  method: string,
  targetUrl: string,
  headers: Record<string, string>,
  body?: any
): Promise<ExecutionResponse> {
  const startTime = performance.now();

  const fetchOptions: any = {
    method: method.toUpperCase(),
    headers: { ...headers },
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body !== undefined && body !== null) {
    fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : String(body);
  }

  try {
    const res = await fetch(targetUrl, fetchOptions);
    const duration = Math.round(performance.now() - startTime);

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
    const duration = Math.round(performance.now() - startTime);
    return {
      status: 0,
      statusText: 'Network Error',
      headers: {},
      body: JSON.stringify(
        {
          error: `Failed to connect to ${targetUrl}`,
          message: err?.message || 'Failed to fetch',
        },
        null,
        2
      ),
      size: 0,
      duration,
      timestamp: Date.now(),
      ok: false,
      error: err?.message || 'Connection Refused',
    };
  }
}

/**
 * Main HTTP request executor for RestStudio.
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

  // 1. Neutralino Native Desktop Container Check
  if (typeof window !== 'undefined' && ((window as any).Neutralino || (window as any).NL_PORT || (window as any).NL_MODE || (window as any).__NL_PORT__ || window.location.protocol === 'file:')) {
    try {
      console.log('[RestStudio Neutralino] Executing via Neutralino Native Engine...');
      const neuRes = await executeNeutralinoFetch(method, targetUrl, headers, body);
      if (neuRes && neuRes.status > 0) {
        return neuRes;
      }
    } catch (nErr) {
      console.warn('[RestStudio Neutralino] Native execution error, falling back:', nErr);
    }
  }

  // 2. Tauri Native Desktop Container Check
  if (typeof window !== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_IPC__)) {
    try {
      console.log('[RestStudio Tauri] Executing via Tauri Native Engine...');
      const tauriRes = await executeTauriFetch(method, targetUrl, headers, body);
      if (tauriRes && tauriRes.status > 0) {
        return tauriRes;
      }
    } catch (tErr) {
      console.warn('[RestStudio Tauri] Native execution error, falling back:', tErr);
    }
  }

  // 3. Web Proxy Execution (Routes through Express /api/proxy server to bypass browser CORS)
  try {
    const proxyRes = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, url: targetUrl, headers, body }),
    });

    const contentType = proxyRes.headers.get('content-type') || '';
    const responseText = await proxyRes.text();
    const isHtmlResponse = responseText.trim().toLowerCase().startsWith('<!doctype') || responseText.trim().toLowerCase().startsWith('<html') || contentType.includes('text/html');

    if (proxyRes.ok && !isHtmlResponse) {
      try {
        const responseData: ExecutionResponse = JSON.parse(responseText);
        if (responseData.status > 0) {
          return responseData;
        }
      } catch (_) {}
    }
  } catch (proxyErr) {
    console.warn('[RestStudio] Server proxy fetch error, falling back to direct browser fetch:', proxyErr);
  }

  // 4. Direct Client Browser Fetch Fallback
  return await executeDirectClientFetch(method, targetUrl, headers, body);
}
