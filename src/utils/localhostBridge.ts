/**
 * Localhost Proxy Bridge & Permission Assistant
 * Enables direct client execution to localhost / 127.0.0.1 by utilizing:
 * 1. TargetAddressSpace ('local' / 'private') for Chrome Private Network Access (PNA)
 * 2. Service Worker Message Bridge
 * 3. Localhost Network Access Permission Triggering
 */

export interface BridgeFetchResult {
  success: boolean;
  response?: any;
  error?: string;
}

let swRegistration: ServiceWorkerRegistration | null = null;

// Initialize Service Worker for Localhost Proxy Bridge
export async function initLocalhostBridgeServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    console.log('[LocalhostBridge] Service Worker registered successfully.');
    return true;
  } catch (err) {
    console.warn('[LocalhostBridge] SW registration error:', err);
    return false;
  }
}

// Execute fetch via Service Worker Bridge
export function fetchViaServiceWorkerBridge(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: any
): Promise<BridgeFetchResult> {
  return new Promise((resolve) => {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      resolve({ success: false, error: 'Service Worker controller not active' });
      return;
    }

    const channel = new MessageChannel();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Service Worker Localhost fetch timed out' });
    }, 12000);

    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      if (event.data && event.data.success) {
        resolve({ success: true, response: event.data.response });
      } else {
        resolve({ success: false, error: event.data?.error || 'SW fetch error' });
      }
    };

    navigator.serviceWorker.controller.postMessage(
      {
        type: 'EXECUTE_LOCALHOST_FETCH',
        payload: { id: requestId, method, url, headers, body },
      },
      [channel.port2]
    );
  });
}

// Request Local Network Permission from Chrome / Edge
export async function requestLocalNetworkPermission(targetUrl: string = 'http://127.0.0.1:3000/'): Promise<{
  granted: boolean;
  message: string;
}> {
  try {
    const fetchOpts: any = {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type',
      },
      targetAddressSpace: 'local',
    };

    await fetch(targetUrl, fetchOpts);
    return {
      granted: true,
      message: 'Local Network Access permission granted by browser!',
    };
  } catch (err: any) {
    return {
      granted: false,
      message: err?.message || 'Permission request failed or requires manual site settings adjustment.',
    };
  }
}

// Helper to generate local proxy curl snippet for node/express or ngrok
export function getLocalProxySnippets(targetPort: number = 3000) {
  return {
    ngrok: `npx ngrok http ${targetPort}`,
    localCorsProxy: `npx local-cors-proxy --proxyUrl http://localhost:${targetPort} --port 8010`,
    nodeSnippet: `// 1-Line Node CORS Proxy server:
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use('/', createProxyMiddleware({ target: 'http://localhost:${targetPort}', changeOrigin: true }));
app.listen(8010, () => console.log('Local Proxy running on http://localhost:8010'));`,
  };
}
