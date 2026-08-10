import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'RestStudio API Proxy' });
  });

  // REST Request Proxy Endpoint
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
      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: {
          'User-Agent': 'RestStudio-REST-Client/1.0',
          ...headers,
        },
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && body !== undefined && body !== null) {
        if (typeof body === 'object') {
          fetchOptions.body = JSON.stringify(body);
        } else {
          fetchOptions.body = String(body);
        }
      }

      const response = await fetch(targetUrl, fetchOptions);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const responseText = await response.text();
      const responseSize = Buffer.byteLength(responseText, 'utf8');

      // Extract response headers
      const resHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      res.json({
        status: response.status,
        statusText: response.statusText || 'OK',
        headers: resHeaders,
        body: responseText,
        size: responseSize,
        duration,
        timestamp: Date.now(),
        ok: response.ok,
        contentType: response.headers.get('content-type') || 'text/plain',
      });
    } catch (err: any) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      res.status(502).json({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: JSON.stringify(
          {
            error: 'Failed to connect to target server',
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
