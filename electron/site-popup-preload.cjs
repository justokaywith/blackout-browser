const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('siteControls',{set:(type,value)=>ipcRenderer.invoke('browser:site-device',type,value)});
