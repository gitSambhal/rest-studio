const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const axios = require('axios');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: 'RestStudio - Desktop REST Client',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disables browser CORS restrictions inside Desktop Electron app
    },
  });

  // Load app: use local server URL or dist index.html
  const startUrl = process.env.ELECTRON_START_URL || `http://localhost:3000`;
  
  mainWindow.loadURL(startUrl).catch(() => {
    // Fallback if local dev server isn't running
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handler: Native Desktop HTTP Executor (Bypasses Browser CORS & Private Network Rules 100%)
ipcMain.handle('execute-http-request', async (event, reqData) => {
  const { method = 'GET', url, headers = {}, body } = reqData;
  const startTime = Date.now();

  try {
    const cleanedHeaders = {
      'User-Agent': 'RestStudio-Desktop/1.0 (Native-Electron-Engine)',
      ...headers,
    };

    const axiosResponse = await axios({
      method: method.toUpperCase(),
      url,
      headers: cleanedHeaders,
      data: body !== undefined && body !== null ? body : undefined,
      validateStatus: () => true, // Don't throw on HTTP errors (4xx, 5xx)
      responseType: 'text',
      timeout: 30000,
      maxRedirects: 10,
    });

    const duration = Date.now() - startTime;
    const responseText = typeof axiosResponse.data === 'string'
      ? axiosResponse.data
      : JSON.stringify(axiosResponse.data);

    const resHeaders = {};
    if (axiosResponse.headers) {
      Object.entries(axiosResponse.headers).forEach(([k, v]) => {
        if (v !== undefined) {
          resHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v);
        }
      });
    }

    return {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText || 'OK',
      headers: resHeaders,
      body: responseText,
      size: Buffer.byteLength(responseText, 'utf8'),
      duration,
      timestamp: Date.now(),
      ok: axiosResponse.status >= 200 && axiosResponse.status < 300,
      contentType: resHeaders['content-type'] || 'text/plain',
      isElectronNative: true,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      status: 0,
      statusText: 'Electron Native Network Failure',
      headers: {},
      body: JSON.stringify({
        error: 'Desktop Native Request Failed',
        message: err.message || String(err),
        url,
      }, null, 2),
      size: 0,
      duration,
      timestamp: Date.now(),
      ok: false,
      error: err.message,
      isElectronNative: true,
    };
  }
});

ipcMain.handle('open-external-url', async (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
