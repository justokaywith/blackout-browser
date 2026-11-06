const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('installer', {
  getDefaults: () => ipcRenderer.invoke('installer:get-defaults'),
  browseFolder: () => ipcRenderer.invoke('installer:browse'),
  install: (options) => ipcRenderer.invoke('installer:install', options),
  launch: (exePath) => ipcRenderer.invoke('installer:launch', exePath),
  close: () => ipcRenderer.invoke('installer:close'),
  minimize: () => ipcRenderer.invoke('installer:minimize'),
  onProgress: (callback) => {
    ipcRenderer.on('installer:progress', (_event, data) => callback(data));
  }
});
