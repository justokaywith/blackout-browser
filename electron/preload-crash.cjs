const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crashApi', Object.freeze({
  getCrashData: () => ipcRenderer.invoke('crash:get-data'),
  sendEmail: (mailto) => ipcRenderer.invoke('crash:send-email', mailto),
  copyReport: (text) => ipcRenderer.invoke('crash:copy-report', text),
  restartApp: () => ipcRenderer.invoke('crash:restart'),
  closeWindow: () => ipcRenderer.invoke('crash:close')
}));
