export async function handler(event: any) {
  const rawPath = event.path || '';
  const path = rawPath.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '');

  function tryJsonParse(val: string) {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }

  // CORS headers for Netlify functions
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Health check
  if (path === '/health' || path === '') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ status: 'ok', service: 'RestStudio Netlify API Proxy' }),
    };
  }

  // Mock Endpoints
  if (path === '/v1/users') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: [
          { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
          { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'developer' },
          { id: 3, name: 'Carol Williams', email: 'carol@example.com', role: 'viewer' },
        ],
        total: 3,
        page: 1,
      }),
    };
  }

  if (path === '/v1/posts') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: [
          { id: 101, title: 'Getting Started with RestStudio', author: 'Alice', views: 1250 },
          { id: 102, title: 'Building RESTful APIs with Express', author: 'Bob', views: 890 },
        ],
      }),
    };
  }

  if (path === '/v1/auth/login') {
    const bodyObj = tryJsonParse(event.body || '{}') || {};
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        tokenType: 'Bearer',
        user: {
          id: 'usr_89213',
          name: bodyObj.username || 'Demo User',
          email: bodyObj.email || 'user@example.com',
        },
      }),
    };
  }

  if (path === '/v1/echo') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        method: event.httpMethod,
        query: event.queryStringParameters,
        headers: event.headers,
        body: event.body ? (tryJsonParse(event.body) || event.body) : null,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // REST Request Proxy Endpoint
  if (path === '/proxy' && event.httpMethod === 'POST') {
    const payload = tryJsonParse(event.body || '{}') || {};
    const { method = 'GET', url, headers = {}, body } = payload;

    if (!url || typeof url !== 'string') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Valid URL parameter is required' }),
      };
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      if (targetUrl.startsWith('/')) {
        targetUrl = 'http://localhost:3000' + targetUrl;
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

    if (targetUrl.includes('/api/proxy')) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          body: JSON.stringify({ error: 'Cannot proxy request recursively to /api/proxy' }, null, 2),
          size: 0,
          duration: 0,
          timestamp: Date.now(),
          ok: false,
          error: 'Recursive proxy call prohibited',
        }),
      };
    }

    const startTime = Date.now();
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
      const duration = Date.now() - startTime;
      const responseText = await response.text();

      const resHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: response.status,
          statusText: response.statusText || 'OK',
          headers: resHeaders,
          body: responseText,
          size: responseText.length,
          duration,
          timestamp: Date.now(),
          ok: response.ok,
          contentType: response.headers.get('content-type') || 'text/plain',
        }),
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
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
        }),
      };
    }
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Endpoint not found on Netlify function' }),
  };
}
