const {BrowserWindow,screen,ipcMain,app}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const shownFlag=()=>path.join(app.getPath('userData'),'.splash-shown');
function markSplashShown(){
 for(const marker of [path.join(process.resourcesPath,'.first-launch'),path.join(app.getPath('userData'),'.first-launch')])try{fs.unlinkSync(marker)}catch{}
 try{fs.writeFileSync(shownFlag(),'1','utf8')}catch{}
}
function showSplash(){
 return new Promise(resolve=>{
  const area=screen.getPrimaryDisplay().workArea,width=Math.min(560,area.width),height=Math.min(480,area.height);
  const win=new BrowserWindow({width,height,x:area.x+Math.round((area.width-width)/2),y:area.y+Math.round((area.height-height)/2),frame:false,resizable:false,movable:true,minimizable:false,maximizable:false,skipTaskbar:false,backgroundColor:'#101114',show:false,
   webPreferences:{preload:path.join(__dirname,'splash-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,webviewTag:false}});
  let finished=false,timer;
  const complete=()=>{
   if(finished)return;finished=true;clearTimeout(timer);ipcMain.removeListener('splash:done',onDone);
   markSplashShown();
   if(!win.isDestroyed())win.destroy();
   resolve();
  };
  const onDone=event=>{if(event.sender===win.webContents)complete()};
  ipcMain.on('splash:done',onDone);
  win.once('closed',complete);
  win.once('unresponsive',complete);
  win.webContents.once('render-process-gone',complete);
  win.webContents.once('did-fail-load',complete);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  timer=setTimeout(complete,4000);
  win.once('ready-to-show',()=>{if(!finished)win.show()});
  win.loadURL(pathToFileURL(path.join(__dirname,'..','ui','splash.html')).href).catch(complete);
 });
}
async function showSplashIfFirstLaunch(){if(fs.existsSync(shownFlag()))return;await showSplash()}
module.exports={showSplash,showSplashIfFirstLaunch};
