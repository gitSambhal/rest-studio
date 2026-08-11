import express from 'express';
import path from 'path';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Global CORS Middleware to ensure zero CORS restrictions on proxy API
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'RestStudio API Proxy' });
  });

  // Return JS stub for Neutralino client library in web browser preview mode to prevent HTML 404 syntax error
  app.get(['/js/neutralino.js', '/dist/js/neutralino.js'], (req, res) => {
    res.type('application/javascript').send('/* Neutralino JS stub for web browser preview */');
  });

  // REST Request Proxy Endpoint - Uses Axios on server to bypass Browser CORS for ALL external APIs
  app.post('/api/proxy', async (req, res) => {
    const { method = 'GET', url, headers = {}, body } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Valid URL parameter is required' });
      return;
    }

    // Ensure URL has protocol
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

    // Convert localhost or 0.0.0.0 to 127.0.0.1 to avoid Node 18+ IPv6 (::1) lookup connection refused errors
    targetUrl = targetUrl
      .replace(/^http:\/\/localhost(?=[:\/]|$)/i, 'http://127.0.0.1')
      .replace(/^http:\/\/0\.0\.0\.0(?=[:\/]|$)/i, 'http://127.0.0.1');

    // Prevent recursive proxy loops
    if (targetUrl.includes('/api/proxy')) {
      res.status(400).json({
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        body: JSON.stringify({ error: 'Cannot proxy request recursively to /api/proxy' }, null, 2),
        size: 0,
        duration: 0,
        timestamp: Date.now(),
        ok: false,
        error: 'Recursive proxy call prohibited',
      });
      return;
    }

    const startTime = performance.now();

    try {
      // Clean up headers to prevent host/content-length conflicts
      const cleanedHeaders: Record<string, string> = {
        'User-Agent': 'RestStudio-REST-Client/1.0 (CORS-Bypass-Axios)',
      };

      if (headers && typeof headers === 'object') {
        Object.entries(headers).forEach(([k, v]) => {
          const lowerKey = k.toLowerCase();
          if (lowerKey !== 'host' && lowerKey !== 'content-length' && lowerKey !== 'connection') {
            cleanedHeaders[k] = String(v);
          }
        });
      }

      const axiosResponse = await axios({
        method: method.toUpperCase(),
        url: targetUrl,
        headers: cleanedHeaders,
        data: body !== undefined && body !== null ? body : undefined,
        validateStatus: () => true, // Don't throw on non-2xx status codes
        responseType: 'text',
        timeout: 25000,
        maxRedirects: 10,
      });

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const responseText = typeof axiosResponse.data === 'string' 
        ? axiosResponse.data 
        : JSON.stringify(axiosResponse.data);

      const responseSize = Buffer.byteLength(responseText, 'utf8');

      // Extract response headers
      const resHeaders: Record<string, string> = {};
      if (axiosResponse.headers) {
        Object.entries(axiosResponse.headers).forEach(([k, v]) => {
          if (v !== undefined) {
            resHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v);
          }
        });
      }

      res.json({
        status: axiosResponse.status,
        statusText: axiosResponse.statusText || 'OK',
        headers: resHeaders,
        body: responseText,
        size: responseSize,
        duration,
        timestamp: Date.now(),
        ok: axiosResponse.status >= 200 && axiosResponse.status < 300,
        contentType: resHeaders['content-type'] || 'text/plain',
      });
    } catch (err: any) {
      // Fallback server-side attempt using public CORS proxy (corsproxy.io / allorigins.win)
      try {
        console.log('[RestStudio Proxy] Direct Axios failed. Attempting corsproxy.io fallback...');
        const fallbackUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const fallbackRes = await axios({
          method: method.toUpperCase(),
          url: fallbackUrl,
          data: body !== undefined && body !== null ? body : undefined,
          validateStatus: () => true,
          responseType: 'text',
          timeout: 15000,
        });

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        const responseText = typeof fallbackRes.data === 'string' ? fallbackRes.data : JSON.stringify(fallbackRes.data);

        return res.json({
          status: fallbackRes.status,
          statusText: fallbackRes.statusText || 'OK',
          headers: {},
          body: responseText,
          size: Buffer.byteLength(responseText, 'utf8'),
          duration,
          timestamp: Date.now(),
          ok: fallbackRes.status >= 200 && fallbackRes.status < 300,
          contentType: 'text/plain',
        });
      } catch (fallbackErr) {
        console.warn('[RestStudio Proxy] Corsproxy.io fallback failed:', fallbackErr);
      }

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      res.status(502).json({
        status: 0,
        statusText: 'Network Error / Proxy Error',
        headers: {},
        body: JSON.stringify(
          {
            error: 'Failed to connect to target server via Axios proxy or Public CORS Proxy',
            details: err.message || String(err),
            targetUrl,
          },
          null,
          2
        ),
        size: 0,
        duration,
        timestamp: Date.now(),
        ok: false,
        error: err.message || 'Connection Refused or invalid hostname',
      });
    }
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RestStudio server running on http://localhost:${PORT}`);
  });
}

startServer();
