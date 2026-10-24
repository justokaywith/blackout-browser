const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__blackout_splash', {
  done: () => {
    ipcRenderer.send('splash:done');
  }
});
