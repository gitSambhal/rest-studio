const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  executeRequest: (reqData) => ipcRenderer.invoke('execute-http-request', reqData),
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
});
