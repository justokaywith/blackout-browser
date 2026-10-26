const closedWindows=require('./closed-windows.cjs');
const { app, BrowserWindow, WebContentsView, ipcMain, protocol, session, net, Menu, MenuItem, clipboard, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { normalizeTarget } = require('./navigation.cjs');
const { shortcutAction } = require('./keyboard.cjs');
const { localAudioResponse } = require('./local-audio.cjs');
const { profileDefinition, shouldClearProfileOnClose } = require('./profiles.cjs');
const { normalizeFavorite, readFavorites, writeFavorites } = require('./favorites.cjs');
const { readHistory, recordHistoryEntry, deleteHistoryEntry, clearHistoryFile } = require('./history.cjs');
const { initCrashReporter, showCrashReportWindow } = require('./crash-reporter.cjs');
const {
  loadSavedProtectionMode,
  setProtectionMode,
  getProtectionSettings,
  applyProtectionToSession,
  injectAdShield,
  getAdsBlockedCount,
  getTrackerActivity,
  getCurrentProtectionMode
} = require('./protection.cjs');
const { injectAnonymityShield } = require('./anonymity.cjs');
const { parseWireGuardConfig } = require('./wireguard.cjs');
const { checkForUpdate } = require('./updater.cjs');
const { readDownloads, saveDownloads } = require('./download-history.cjs');
const { createSitePermissions } = require('./site-permissions.cjs');
const { applyTabGroup, moveTab } = require('./tab-groups.cjs');
const { launchInstaller } = require('./installer-launch.cjs');
const {browserUserAgent}=require('./browser-identity.cjs');
const {createNotificationPermissions}=require('./notification-permissions.cjs');
const windowsIntegration=require('./windows-integration.cjs');
if(process.platform==='win32')app.setAppUserModelId(windowsIntegration.APP_ID);
const {addressSuggestions}=require('./address-suggestions.cjs');
const {
  loadPersistedExtensions,
  installUnpackedExtension,
  uninstallExtension,
  listActiveExtensions,
  openExtensionPopup
} = require('./extensions.cjs');
const { createOauthBridge } = require('./oauth-bridge.cjs');
const { showSplashIfFirstLaunch } = require('./splash.cjs');
const { injectPipOverlay, togglePictureInPicture } = require('./pip.cjs');
const { searchMusic } = require('./music.cjs');

// Some sites reject Electron's product token even when the embedded Chromium is current.
// Present a stable, modern Chromium identity to remote sites while keeping Blackout's
// own product identity in the native application UI.
const BROWSER_COMPATIBILITY_UA = browserUserAgent(process.versions.chrome);
const {
  initMusicFavorites,
  readFavorites: readMusicFavorites,
  toggleMusicFavorite,
  isMusicFavorited,
  cacheMusicTrack,
  removeCachedMusic
} = require('./music-favorites.cjs');

initCrashReporter();

try {
  app.name = 'Blackout Browser';
  app.setPath('userData', path.join(app.getPath('appData'), 'Blackout Browser'));

  // Profiles are retained across upgrades. Installation never resets user files.

} catch {}

function log(msg) {
  try {
    fs.appendFileSync(path.join(app.getPath('temp'), 'blackout-startup.log'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

const primaryInstance = app.requestSingleInstanceLock();
log(`pid: ${process.pid}, primary: ${primaryInstance}`);
if (!primaryInstance) {
  log('Secondary instance exiting');
  app.exit(0);
}
app.on('second-instance', (_event,argv) => {
  log('second-instance event received');
  const context = [...contexts.values()][0];
  if (context && !context.window.isDestroyed()) {
    if (context.window.isMinimized()) context.window.restore();
    context.window.show();
    context.window.focus();
    const target=require('./external-target.cjs').externalTarget(argv);
    if(target)createTab(context,target);
  } else {
    createBrowserWindow('standard').catch(() => {});
  }
});

app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('no-pings');
app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'disable_non_proxied_udp');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: 'blackout', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

const UI_FILES = new Map([
  ['/address-suggestions.js',['address-suggestions.js','text/javascript; charset=utf-8']],
  ['/browser-finish.css', ['browser-finish.css', 'text/css; charset=utf-8']],
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/music-frost.css', ['music-frost.css', 'text/css; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/tabs.css', ['tabs.css', 'text/css; charset=utf-8']],
  ['/profiles.css', ['profiles.css', 'text/css; charset=utf-8']],
  ['/themes.css', ['themes.css', 'text/css; charset=utf-8']],
  ['/pip-3d.webp', ['pip-3d.webp', 'image/webp']],
  ['/blackout-mark.svg', ['blackout-mark.svg', 'image/svg+xml; charset=utf-8']],
  ['/crash-report.html', ['crash-report.html', 'text/html; charset=utf-8']],
  ['/splash.html', ['splash.html', 'text/html; charset=utf-8']],
  ['/splash.css', ['splash.css', 'text/css; charset=utf-8']],
  ['/splash.js', ['splash.js', 'application/javascript; charset=utf-8']],
  ['/protection-popup.html', ['protection-popup.html', 'text/html; charset=utf-8']],
  ['/protection-popup.js', ['protection-popup.js', 'application/javascript; charset=utf-8']],
  ['/extensions-popup.html', ['extensions-popup.html', 'text/html; charset=utf-8']],
  ['/extensions-popup.js', ['extensions-popup.js', 'application/javascript; charset=utf-8']],
  ['/downloads-popup.html', ['downloads-popup.html', 'text/html; charset=utf-8']],
  ['/downloads-popup.js', ['downloads-popup.js', 'application/javascript; charset=utf-8']],
  ['/music-popup.html', ['music-popup.html', 'text/html; charset=utf-8']],
  ['/music-popup.js', ['music-popup.js', 'application/javascript; charset=utf-8']]
]);
const contexts = new Map();
const profileSessions = new Map();
const profileCleanup = new Map();
const permissionRequests = new Map();
const globalDownloads = new Map();
const activeDownloadItems = new Map();
const deviceAccess = new Map();
function contextForPage(contents) {
  return [...contexts.values()].find(c => [...c.tabs.values()].some(t => t.view?.webContents === contents));
}
function publishDeviceAccess(context) {
  if (!context) return;
  const live=new Set([...contexts.values()].flatMap(c=>[...c.tabs.values()].filter(t=>!t.closing&&t.view?.webContents&&!t.view.webContents.isDestroyed()).map(t=>t.view.webContents.id)));
  for(const id of deviceAccess.keys())if(!live.has(id))deviceAccess.delete(id);
  sendState(context,{type:'device-access',items:[...deviceAccess.values()].filter(item=>item.contextId===context.id).map(({id,origin,types})=>({id,origin,types}))});
}
const sitePermissions = createSitePermissions({dialog,
  findWindow: wc => contextForPage(wc)?.window,
  notify: (wc,types) => {
    const context=contextForPage(wc) || contexts.get(deviceAccess.get(wc.id)?.contextId);
    if (types.length) deviceAccess.set(wc.id,{id:wc.id,contextId:context?.id,origin:wc.getURL(),types});
    else deviceAccess.delete(wc.id);
    publishDeviceAccess(context);
  }
});
const notificationPermissions=createNotificationPermissions({dialog,findWindow:wc=>contextForPage(wc)?.window,isPrivate:wc=>contextForPage(wc)?.profile.mode==='incognito',read:()=>JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'notification-permissions.json'),'utf8')),save:value=>{const file=path.join(app.getPath('userData'),'notification-permissions.json');fs.writeFileSync(file+'.tmp',JSON.stringify(value));fs.renameSync(file+'.tmp',file);}});
function persistDownloads() {
  try { saveDownloads(path.join(app.getPath('userData'), 'downloads.json'), [...globalDownloads.values()].filter(d => !d.private)); } catch (error) { log('Download history save failed: ' + error.code); }
}
let quitting = false;
let isAppReady = false;
let oauthBridge = null;
let backgroundMusicWin = null;
let currentMusicVolume = 0.8;
let currentMusicTrack = null;
let currentMusicPlaylist = [];
let currentMusicIsPlaying = false;

function destroyBackgroundMusic() {
  if (backgroundMusicWin && !backgroundMusicWin.isDestroyed()) {
    try {
      backgroundMusicWin.webContents.stop();
      backgroundMusicWin.destroy();
    } catch {}
    backgroundMusicWin = null;
  }
}

function terminateAppImmediately() {
  log('terminateAppImmediately called - terminating all processes cleanly');
  destroyBackgroundMusic();
  for(const context of contexts.values()){if(!context.recoverySaved){try{closedWindows.saveWindow(path.join(app.getPath('userData'),'closed-windows.json'),context);context.recoverySaved=true}catch{}}}
  try {
    for (const w of BrowserWindow.getAllWindows()) {
      try {
        if (!w.isDestroyed()) w.destroy();
      } catch {}
    }
  } catch {}
  try {
    if (app.hasSingleInstanceLock && app.hasSingleInstanceLock()) {
      app.releaseSingleInstanceLock();
    }
  } catch {}
  try {
    app.exit(0);
  } catch {}
  try {
    process.exit(0);
  } catch {}
}

function contextForSender(sender) {
  for (const context of contexts.values()) {
    if (sender === context.window.webContents) {
      try {
        const url = new URL(sender.getURL());
        if (url.protocol === 'blackout:' && url.hostname === 'app' && (url.pathname === '/' || url.pathname === '/index.html')) return context;
      } catch {}
    }
    if (context.menuPopup && !context.menuPopup.isDestroyed() && sender === context.menuPopup.webContents) {
      return context;
    }
    if (context.siteInfoPopup && !context.siteInfoPopup.isDestroyed() && sender === context.siteInfoPopup.webContents) {
      return context;
    }
  }
  return null;
}

function sendState(context, message) {
  if (context && context.window && !context.window.isDestroyed()) {
    context.window.webContents.send('browser:state', message);
  }
  if (context && context.menuPopup && !context.menuPopup.isDestroyed()) {
    context.menuPopup.webContents.send('browser:state', message);
  }
}

function sendProfile(context) {
  sendState(context, { type: 'profile', mode: context.profile.mode });
}

function sendTabs(context) {
  sendState(context, {
    type: 'tabs',
    activeId: context.activeTab?.id || null,
    groups: [...(context.groups?.values() || [])],
    tabs: [...context.tabs.values()].filter(tab=>!tab.closing&&tab.view?.webContents&&!tab.view.webContents.isDestroyed()).map((tab) => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      groupId: tab.groupId || null,
      audible: tab.view.webContents.isCurrentlyAudible ? tab.view.webContents.isCurrentlyAudible() : Boolean(tab.audible)
    }))
  });
}

function tabState(tab) {
  const contents = tab.view.webContents;
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    loading: tab.loading,
    audible: contents.isCurrentlyAudible ? contents.isCurrentlyAudible() : Boolean(tab.audible),
    canGoBack: contents.canGoBack(),
    canGoForward: contents.canGoForward()
  };
}

function publishTab(context, tab) {
  if(!context||!tab||tab.closing||context.tabs.get(tab.id)!==tab||!tab.view?.webContents||tab.view.webContents.isDestroyed())return false;
  tab.url = tab.view.webContents.getURL() || tab.url;
  if (tab === context.activeTab) {
    updateViewBounds(context);
    sendState(context, { type: 'tab', tab: tabState(tab) });
  }
  sendTabs(context);
}

function updateViewBounds(context) {
  if (!context.activeTab?.view?.webContents || context.activeTab.closing || context.window.isDestroyed()) return;
  const { width, height } = context.window.getContentBounds();
  const shouldBeVisible = Boolean(context.activeTab.url) && !context.settingsOpen && !context.modalOpen;
  const topOffset = context.bookmarksBarVisible ? 118 : 86;
  context.activeTab.view.setVisible(shouldBeVisible);
  context.activeTab.view.setBounds({ x: 0, y: topOffset, width, height: Math.max(120, height - topOffset) });
}

function escapeSiteInfo(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function closeAddressPopup(context){context.addressRevision=(context.addressRevision||0)+1;if(context.addressPopup&&!context.addressPopup.isDestroyed())context.addressPopup.close();context.addressPopup=null;context.addressRows=[];}
async function showAddressPopup(context,rows,index,bounds){
 if(!rows.length){closeAddressPopup(context);return;}
 const source=context.window.getBounds(),revision=context.addressRevision=(context.addressRevision||0)+1;
 const x=Math.max(8,Math.min(Number(bounds.x)||0,source.width-200)),width=Math.max(180,Math.min(Number(bounds.width)||400,source.width-x-8));
 let popup=context.addressPopup;if(!popup||popup.isDestroyed()){
 popup=new BrowserWindow({parent:context.window,frame:false,resizable:false,movable:false,skipTaskbar:true,focusable:false,show:false,width:Math.round(width),height:Math.min(386,rows.length*46+16),backgroundColor:'#24252e',webPreferences:{preload:path.join(__dirname,'address-popup-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});context.addressPopup=popup;
 popup.on('closed',()=>{if(context.addressPopup===popup)context.addressPopup=null;});popup.ready=popup.loadFile(path.join(__dirname,'../ui/address-popup.html'));
 }
 context.addressRows=rows;await popup.ready;if(context.addressPopup!==popup||popup.isDestroyed()||revision!==context.addressRevision)return;
 popup.setBounds({x:Math.round(source.x+x),y:Math.round(source.y+(Number(bounds.y)||0)+(Number(bounds.height)||36)+6),width:Math.round(width),height:Math.min(386,rows.length*46+16)});
 popup.webContents.send('browser:address-rows',{rows,index});popup.showInactive();
}
function closeSiteInfoPopup(context) {
  const popup = context?.siteInfoPopup;
  if (popup && !popup.isDestroyed()) popup.close();
  if (context) context.siteInfoPopup = null;
}

function showSiteInfoPopup(context, info) {
  if (context.siteInfoPopup && !context.siteInfoPopup.isDestroyed()) {
    closeSiteInfoPopup(context);
    return false;
  }
  const source = context.window.getBounds();
  const permissionNames = [...new Set((info.permissions || []).map(item => item.permission))];
  const connection = info.url ? `${info.secure ? 'Secure HTTPS' : 'Unencrypted HTTP'} · ${info.host || 'site'}` : 'No site selected.';
  const permissions = permissionNames.length ? (info.permissions || []).map(item => `${item.permission}: ${item.decision || 'requested'}`).join(', ') : 'No permission requests observed.';
  const privacy = info.url ? `${info.cookies || 0} cookie${info.cookies === 1 ? '' : 's'} · ${getTrackerActivity(context.activeTab.view.webContents.id).blockedRequests} tracker/ad requests blocked` : 'No site data available.';
  const deviceState=sitePermissions.pageState(context.activeTab.view.webContents);
  const controls=['audio','video'].map(type=>`<label>${type==='audio'?'Microphone':'Camera'}<select data-device="${type}" aria-label="${type==='audio'?'Microphone':'Camera'} permission">${['ask','allow','block'].map(value=>`<option value="${value}" ${deviceState[type]===value?'selected':''}>${{ask:'Ask',allow:'Allow for this page',block:'Block'}[value]}</option>`).join('')}</select></label>`).join('');
  const page = `<!doctype html><meta charset="utf-8"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent;color:#f4f1ff;font:13px Inter,Segoe UI,sans-serif}main{box-sizing:border-box;width:100%;height:100%;padding:10px;border:1px solid #3b3c4c;border-radius:12px;background:#171822;box-shadow:0 20px 45px #000c}.item{padding:9px 10px;margin-top:7px;border:1px solid #30313f;border-radius:9px;background:#10111a;line-height:1.35}.item:first-child{margin-top:0}.label{display:block;margin-bottom:3px;color:#77e4c4;font-size:9px;letter-spacing:.1em}</style><main><div class="item"><span class="label">CONNECTION</span>${escapeSiteInfo(connection)}</div><div class="item"><span class="label">PERMISSIONS</span>${controls}<p id="device-status">Windows device privacy settings also apply. Allow lasts until navigation. Block lasts for this site in this tab.</p></div><div class="item"><span class="label">PRIVACY</span>${escapeSiteInfo(privacy)}<p>Location blocked · Do Not Track on · GPC on. Your public IP is still visible.</p></div></main><style>html,body{overflow:auto}main{height:auto;min-height:100%;border-radius:20px;background:#22232df5}label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0}select{max-width:190px;padding:8px;border:1px solid #ffffff24;border-radius:10px;background:#30313e;color:#fff}p{font-size:11px;color:#bfc1ce;line-height:1.5}</style><script>document.querySelectorAll("[data-device]").forEach(select=>select.addEventListener("change",async()=>{try{const result=await window.siteControls.set(select.dataset.device,select.value);document.getElementById("device-status").textContent=result?"Saved. Try the camera or microphone again.":"Not applied. This page may have changed, or access is globally blocked.";}catch{document.getElementById("device-status").textContent="Could not change permission.";}}));</script>`;
  const popup = new BrowserWindow({ parent: context.window, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true, show: false, width: 400, height: 370, x: source.x + 190, y: source.y + (context.bookmarksBarVisible ? 118 : 86), webPreferences: { preload:path.join(__dirname,'site-popup-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  context.siteInfoPopup = popup;
  popup.sitePage=context.activeTab.view.webContents;
  popup.siteUrl=popup.sitePage.getURL();
  popup.on('blur', () => setTimeout(() => closeSiteInfoPopup(context), 0));
  popup.on('closed', () => { if (context.siteInfoPopup === popup) context.siteInfoPopup = null; });
  popup.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`).then(() => popup.show()).catch(() => closeSiteInfoPopup(context));
  return true;
}

function closeMenuPopup(context) {
  const popup = context?.menuPopup;
  if (popup && !popup.isDestroyed()) popup.close();
  if (context) context.menuPopup = null;
}

function getProtectionPopupHtml(currentMode) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0;user-select:none}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#f4f1ff}
.menu{width:100%;height:100%;padding:10px;border:1px solid #3b3c4c;border-radius:14px;background:#171822;box-shadow:0 24px 50px rgba(0,0,0,0.85);display:flex;flex-direction:column;gap:6px}
.head{display:flex;justify-content:space-between;align-items:center;padding:4px 8px 8px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:9.5px;letter-spacing:0.14em;color:#9c9bad;font-weight:700}
.head small{color:#77e4c4;font-size:9px;letter-spacing:0}
.item{display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border:1px solid transparent;border-radius:10px;background:transparent;text-align:left;cursor:pointer;transition:all 0.15s ease;color:inherit}
.item:hover{background:#232435;border-color:#38394a}
.item.active{background:#25263a;border-color:#9a7aff}
.dot{width:10px;height:10px;border-radius:50%;margin-top:4px;flex-shrink:0}
.dot-light{background:#77e4c4;box-shadow:0 0 10px #77e4c4}
.dot-balanced{background:#9a7aff;box-shadow:0 0 10px #9a7aff}
.dot-extra{background:#ff684d;box-shadow:0 0 10px #ff684d}
.meta b{display:flex;align-items:center;gap:8px;font-size:12px;color:#f4f1ff}
.meta b small{font-size:9.5px;font-weight:500;color:#9c9bad}
.meta p{margin:3px 0 0;font-size:10.5px;color:#9c9bad;line-height:1.4}
</style></head><body>
<div class="menu">
  <div class="head">
    <span>PROTECTION &amp; WAVELENGTH</span>
    <small>Shield Active</small>
  </div>
  <button type="button" class="item ${currentMode === 'light' ? 'active' : ''}" data-mode="light">
    <i class="dot dot-light"></i>
    <div class="meta">
      <b>Light <small>Aurora Teal</small></b>
      <p>Standard browsing · Full compatibility</p>
    </div>
  </button>
  <button type="button" class="item ${currentMode === 'balanced' ? 'active' : ''}" data-mode="balanced">
    <i class="dot dot-balanced"></i>
    <div class="meta">
      <b>Balanced <small>Eclipse Violet</small></b>
      <p>Secure browsing · YouTube &amp; web ad block</p>
    </div>
  </button>
  <button type="button" class="item ${currentMode === 'extra' ? 'active' : ''}" data-mode="extra">
    <i class="dot dot-extra"></i>
    <div class="meta">
      <b>Extra <small>Ember Flame</small></b>
      <p>Hardened security · No tracking · Retains logins</p>
    </div>
  </button>
</div>
<script>
document.querySelectorAll('.item').forEach(btn => {
  btn.addEventListener('click', async () => {
    const mode = btn.dataset.mode;
    if (window.blackout?.setProtectionMode) {
      await window.blackout.setProtectionMode(mode);
    }
    window.close();
  });
});
</script></body></html>`;
}

function showProtectionPopup(context, anchorBounds) {
  if (context.menuPopup && !context.menuPopup.isDestroyed()) {
    closeMenuPopup(context);
    return false;
  }
  closeSiteInfoPopup(context);
  const contentBounds = context.window.getContentBounds();
  const width = 310;
  const height = 245;
  let posX = contentBounds.x + contentBounds.width - width - 20;
  if (anchorBounds && Number.isFinite(anchorBounds.right)) {
    posX = contentBounds.x + anchorBounds.right - width;
  }
  let posY = contentBounds.y + (context.bookmarksBarVisible ? 118 : 86);
  if (anchorBounds && Number.isFinite(anchorBounds.bottom)) {
    posY = contentBounds.y + anchorBounds.bottom + 6;
  }
  const popup = new BrowserWindow({
    parent: context.window,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    width,
    height,
    x: Math.round(posX),
    y: Math.round(posY),
    webPreferences: {
      session: session.fromPartition('persist:blackout-ui'),
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  context.menuPopup = popup;
  popup.on('blur', () => {
    setTimeout(() => {
      if (context.menuPopup === popup) closeMenuPopup(context);
    }, 100);
  });
  popup.on('closed', () => { if (context.menuPopup === popup) context.menuPopup = null; });
  popup.loadURL('blackout://app/protection-popup.html').then(() => popup.show()).catch(() => closeMenuPopup(context));
  return true;
}

function showExtensionsPopup(context, anchorBounds, pinnedIds = []) {
  if (context.menuPopup && !context.menuPopup.isDestroyed()) {
    closeMenuPopup(context);
    return false;
  }
  closeSiteInfoPopup(context);
  const contentBounds = context.window.getContentBounds();
  const width = 320;
  const height = 290;
  let posX = contentBounds.x + contentBounds.width - width - 20;
  if (anchorBounds && Number.isFinite(anchorBounds.right)) {
    posX = contentBounds.x + anchorBounds.right - width;
  }
  let posY = contentBounds.y + (context.bookmarksBarVisible ? 118 : 86);
  if (anchorBounds && Number.isFinite(anchorBounds.bottom)) {
    posY = contentBounds.y + anchorBounds.bottom + 6;
  }
  const popup = new BrowserWindow({
    parent: context.window,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    width,
    height,
    x: Math.round(posX),
    y: Math.round(posY),
    webPreferences: {
      session: session.fromPartition('persist:blackout-ui'),
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  context.menuPopup = popup;
  popup.on('blur', () => {
    setTimeout(() => {
      if (context.menuPopup === popup) closeMenuPopup(context);
    }, 100);
  });
  popup.on('closed', () => { if (context.menuPopup === popup) context.menuPopup = null; });
  const pinnedQuery = Array.isArray(pinnedIds) && pinnedIds.length ? `?pinned=${encodeURIComponent(JSON.stringify(pinnedIds))}` : '';
  popup.loadURL(`blackout://app/extensions-popup.html${pinnedQuery}`).then(() => popup.show()).catch(() => closeMenuPopup(context));
  return true;
}

function showDownloadsPopup(context, anchorBounds) {
  if (context.menuPopup && !context.menuPopup.isDestroyed()) {
    closeMenuPopup(context);
    return false;
  }
  closeSiteInfoPopup(context);
  const contentBounds = context.window.getContentBounds();
  const width = 360;
  const height = 360;
  let posX = contentBounds.x + contentBounds.width - width - 20;
  if (anchorBounds && Number.isFinite(anchorBounds.right)) {
    posX = contentBounds.x + anchorBounds.right - width;
  }
  posX = Math.min(posX, contentBounds.x + contentBounds.width - width - 10);
  posX = Math.max(posX, contentBounds.x + 10);
  let posY = contentBounds.y + (context.bookmarksBarVisible ? 118 : 86);
  if (anchorBounds && Number.isFinite(anchorBounds.bottom)) {
    posY = contentBounds.y + anchorBounds.bottom + 6;
  }
  const popup = new BrowserWindow({
    parent: context.window,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    width,
    height,
    x: Math.round(posX),
    y: Math.round(posY),
    webPreferences: {
      session: session.fromPartition('persist:blackout-ui'),
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  context.menuPopup = popup;
  popup.on('blur', () => {
    setTimeout(() => {
      if (context.menuPopup === popup) closeMenuPopup(context);
    }, 100);
  });
  popup.on('closed', () => { if (context.menuPopup === popup) context.menuPopup = null; });
  popup.loadURL('blackout://app/downloads-popup.html').then(() => popup.show()).catch(() => closeMenuPopup(context));
  return true;
}

function showMusicPopup(context, anchorBounds) {
  if (context.menuPopup && !context.menuPopup.isDestroyed()) {
    closeMenuPopup(context);
    return false;
  }
  closeSiteInfoPopup(context);
  const contentBounds = context.window.getContentBounds();
  const width = Math.min(440, contentBounds.width - 24);
  const height = Math.max(280, Math.min(600, contentBounds.height - 140));
  let posX = contentBounds.x + contentBounds.width - width - 20;
  if (anchorBounds && Number.isFinite(anchorBounds.right)) {
    posX = contentBounds.x + anchorBounds.right - width;
  }
  posX = Math.min(posX, contentBounds.x + contentBounds.width - width - 10);
  posX = Math.max(posX, contentBounds.x + 10);
  let posY = contentBounds.y + (context.bookmarksBarVisible ? 118 : 86);
  if (anchorBounds && Number.isFinite(anchorBounds.bottom)) {
    posY = contentBounds.y + anchorBounds.bottom + 6;
  }
  posY = Math.max(contentBounds.y + 10, Math.min(posY, contentBounds.y + contentBounds.height - height - 10));
  const popup = new BrowserWindow({
    parent: context.window,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    width,
    height,
    x: Math.round(posX),
    y: Math.round(posY),
    webPreferences: {
      session: session.fromPartition('persist:blackout-ui'),
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  context.menuPopup = popup;
  popup.on('blur', () => {
    setTimeout(() => {
      if (context.menuPopup === popup) closeMenuPopup(context);
    }, 100);
  });
  popup.on('closed', () => { if (context.menuPopup === popup) context.menuPopup = null; });
  // Local controls are ready at DOM load; remote artwork must not delay opening.
  popup.webContents.once('dom-ready', () => { if (!popup.isDestroyed()) popup.show(); });
  // file:// remains available when Chromium considers the device offline.
  // Keep the player shell independent of custom-scheme navigation and remote assets.
  popup.loadFile(path.join(__dirname, '..', 'ui', 'music-popup.html')).catch(error => {
    log('Music popup local load failed: ' + error.message);
    if (context.menuPopup === popup) closeMenuPopup(context);
  });
  return true;
}

function installKeyboardShortcuts(contents, context, isChrome = false) {
  contents.on('before-input-event', (event, input) => {
    const action = shortcutAction(input);
    if (!action) return;
    event.preventDefault();
    if (action === 'focus-address') {
      context.window.webContents.focus();
      sendState(context, { type: 'focus-address' });
    } else if (action === 'toggle-bookmarks-bar') {
      sendState(context, { type: 'toggle-bookmarks-bar' });
    } else if (action === 'history') {
      sendState(context, { type: 'open-history' });
    } else if (action === 'downloads') {
      sendState(context, { type: 'open-downloads' });
    } else if (action === 'bookmark-page') {
      sendState(context, { type: 'open-bookmark-dialog' });
    } else if (action === 'new-tab') {
      createTab(context);
      context.window.webContents.focus();
      sendState(context, { type: 'focus-address' });
    } else if (action === 'new-incognito') createBrowserWindow('incognito').catch(() => {});
    else if (action === 'close-tab' && context.activeTab) closeTab(context, context.activeTab.id).catch(() => {});
    else if (action === 'reopen-closed-tab') reopenClosedTab(context).catch(()=>{});
    else if (action === 'next-tab') switchRelativeTab(context, 1);
    else if (action === 'previous-tab') switchRelativeTab(context, -1);
    else if (action === 'toggle-pip') togglePictureInPicture(context);
    else if (context.activeTab && action === 'reload') context.activeTab.view.webContents.reload();
    else if (context.activeTab && action === 'hard-reload') context.activeTab.view.webContents.reloadIgnoringCache();
    else if (!isChrome && context.activeTab && action === 'back' && context.activeTab.view.webContents.canGoBack()) context.activeTab.view.webContents.goBack();
    else if (!isChrome && context.activeTab && action === 'forward' && context.activeTab.view.webContents.canGoForward()) context.activeTab.view.webContents.goForward();
    else if (!isChrome && context.activeTab && action === 'zoom-in') adjustTabZoom(context.activeTab, 0.1);
    else if (!isChrome && context.activeTab && action === 'zoom-out') adjustTabZoom(context.activeTab, -0.1);
    else if (!isChrome && context.activeTab && action === 'zoom-reset') context.activeTab.view.webContents.setZoomFactor(1);
    else if (action === 'toggle-fullscreen') context.window.setFullScreen(!context.window.isFullScreen());
  });
}

function getCleanUserAgent() {
  // Use a current Chrome-compatible UA consistently for BrowserViews, popups and
  // network requests. Removing Electron alone leaves old builds at the mercy of
  // version gates such as WhatsApp Web's Chrome 100+ requirement.
  return BROWSER_COMPATIBILITY_UA;
}

function browserSessionFor(mode) {
  const profile = profileDefinition(mode);
  if (profileSessions.has(mode)) return { profile, browserSession: profileSessions.get(mode) };
  const browserSession = session.fromPartition(profile.partition);
  const cleanUa = getCleanUserAgent();
  if (cleanUa) {
    browserSession.setUserAgent(cleanUa);
  }
  browserSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (['fullscreen', 'clipboard-sanitized-write'].includes(permission)) {
      return callback(true);
    }
    const requests = permissionRequests.get(webContents.id) || [];
    const observed={ permission: String(permission), url: String(details?.requestingUrl || webContents.getURL() || ''), at: Date.now(), decision: 'requested' };
    requests.push(observed);
    permissionRequests.set(webContents.id, requests.slice(-24));
    const requestPermission=(wc,permission,callback,details)=>permission==='notifications'?notificationPermissions.request(wc,callback,details):sitePermissions.request(wc,permission,callback,details);
    requestPermission(webContents,permission,allowed => {
      observed.decision = allowed ? 'allowed for this page' : 'denied';
      callback(allowed);
    },details);
  });
  browserSession.on('will-download', (event, item, webContents) => {
    const id = randomUUID();
    const filename = item.getFilename();
    const downloadsDir = app.getPath('downloads');
    let savePath = path.join(downloadsDir, filename);
    let counter = 1;
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    while (fs.existsSync(savePath)) {
      savePath = path.join(downloadsDir, `${base} (${counter++})${ext}`);
    }
    item.setSavePath(savePath);
    activeDownloadItems.set(id, item);

    globalDownloads.set(id, {
      id,
      filename: path.basename(savePath),
      savePath,
      totalBytes: item.getTotalBytes() || 0,
      receivedBytes: 0,
      state: 'progressing'
    });
    globalDownloads.get(id).private = !profile.partition.startsWith('persist:');
    globalDownloads.get(id).startedAt = Date.now();
    persistDownloads();

    const getContext = () => [...contexts.values()].find(c =>
      c.window?.webContents === webContents ||
      [...c.tabs.values()].some(t => t.view?.webContents === webContents)
    ) || [...contexts.values()][0];

    const initialContext = getContext();
    if (initialContext) {
      sendState(initialContext, {
        type: 'download-start',
        id,
        filename: path.basename(savePath),
        totalBytes: item.getTotalBytes() || 0,
        receivedBytes: 0
      });
    }

    item.on('updated', (e, state) => {
      const d = globalDownloads.get(id);
      if (d) {
        d.receivedBytes = item.getReceivedBytes();
        d.totalBytes = item.getTotalBytes() || d.totalBytes;
        d.state = state;
      }
      const currentContext = getContext();
      if (state === 'progressing' && currentContext) {
        sendState(currentContext, {
          type: 'download-progress',
          id,
          filename: path.basename(savePath),
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes() || 0
        });
      }
    });

    item.once('done', (e, state) => {
      activeDownloadItems.delete(id);
      const d = globalDownloads.get(id);
      if (d) {
        d.state = state;
        d.completedAt = Date.now();
        d.receivedBytes = item.getReceivedBytes();
        if (state === 'completed') d.savePath = savePath;
      }
      persistDownloads();
      const currentContext = getContext();
      if (state === 'completed' && currentContext) {
        const fname = path.basename(savePath);
        sendState(currentContext, {
          type: 'download-completed',
          id,
          filename: fname,
          savePath,
          totalBytes: item.getTotalBytes() || item.getReceivedBytes()
        });
        if (/Blackout-Setup.*\.exe$/i.test(fname)) {
          dialog.showMessageBox(currentContext.window, {
            type: 'info',
            title: 'Blackout Update Downloaded',
            message: 'Blackout update has finished downloading.',
            detail: 'Click "Restart and Install" to apply the update now.',
            buttons: ['Restart and Install', 'Install Later'],
            defaultId: 0,
            cancelId: 1
          }).then(({ response }) => {
            if (response === 0) {
              launchInstaller(savePath,{fs,shell,quit:()=>app.quit()}).catch(error=>{
                dialog.showMessageBox(currentContext.window,{type:'error',title:'Could not open the installer',message:'Blackout is still open.',detail:error.message,buttons:['OK']}).catch(()=>{});
              });
            }
          }).catch(() => {});
        }
      } else if (state !== 'completed' && currentContext) {
        sendState(currentContext, {
          type: 'download-failed',
          id,
          filename: path.basename(savePath),
          state
        });
      }
    });
  });
  browserSession.setPermissionCheckHandler((wc,permission,origin,details)=>permission==='notifications'?notificationPermissions.check(wc,origin,mode==='incognito'):sitePermissions.check(wc,permission,origin,details));
  browserSession.on('select-webauthn-account', async (_event, details, callback) => {
    try {
      if (!details.frame || !details.accounts.length) return callback();
      const frameUrl=details.frame.url;
      const accounts=details.accounts.slice(0,10);
      const {response}=await dialog.showMessageBox({type:'question',title:'Choose a passkey',message:`Sign in to ${details.relyingPartyId}`,detail:'Choose an account to continue, or cancel and use another sign-in method.',buttons:[...accounts.map(a=>a.displayName || a.name || 'Passkey account'),'Cancel'],cancelId:accounts.length,defaultId:accounts.length});
      callback(details.frame && details.frame.url === frameUrl ? accounts[response]?.credentialId : undefined);
    } catch { callback(); }
  });
  applyProtectionToSession(browserSession);
  loadPersistedExtensions(browserSession, app).catch(() => {});
  profileSessions.set(mode, browserSession);
  return { profile, browserSession };
}

function guardRemoteContents(context, contents) {
  contents.on('did-start-navigation', (_event,_url,inPlace,isMainFrame) => { if (isMainFrame && !inPlace) sitePermissions.clear(contents); });
  contents.once('destroyed', () => { sitePermissions.clear(contents,true); });
  contents.on('will-navigate', (event, targetUrl) => {
    try {
      if (typeof targetUrl === 'string' && (targetUrl.startsWith('data:text/html') || targetUrl === 'about:blank')) {
        return;
      }
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'file:') {
        event.preventDefault();
        return;
      }
      if (parsed.protocol === 'file:') {
        if (!/\.(?:html?|shtml|xhtml?|xht|pdf|svg|webp|xml|png|jpe?g|txt|json)$/i.test(parsed.pathname)) {
          event.preventDefault();
        }
        return;
      }
      if (parsed.protocol === 'http:') {
        parsed.protocol = 'https:';
        event.preventDefault();
        contents.loadURL(parsed.href).catch(() => {});
      }
    } catch {
      event.preventDefault();
    }
  });

  // Safe redirect handling: do NOT interrupt in-flight HTTP redirects (OAuth handshakes,
  // session cookies, PKCE exchanges) by re-calling loadURL. Only block unsafe protocols.
  contents.on('will-redirect', (event, targetUrl) => {
    try {
      if (typeof targetUrl === 'string' && (targetUrl.startsWith('data:text/html') || targetUrl === 'about:blank')) {
        return;
      }
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'file:') {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  // Handle window.open: allow OAuth and login popups with native window.opener intact,
  // and open standard links in new browser tabs.
  contents.setWindowOpenHandler(({ url, frameName, features, disposition }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { action: 'deny' };
      }
      const isPopup = disposition === 'new-window'
        || Boolean(features && /width=|height=/i.test(features))
        || /accounts\.google\.com|appleid\.apple\.com|login\.microsoftonline\.com|github\.com\/login/i.test(url);

      if (isPopup) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            parent: context.window,
            autoHideMenuBar: true,
            backgroundColor: '#ffffff',
            webPreferences: {
              session: context.browserSession,
      plugins: true, // Chromium built-in PDF viewer.
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true
            }
          }
        };
      }
      setImmediate(() => createTab(context, url));
    } catch {}
    return { action: 'deny' };
  });

  contents.on('did-create-window', (childWindow) => {
    installKeyboardShortcuts(childWindow.webContents, context);
    childWindow.webContents.on('will-redirect', (event, targetUrl) => {
      try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });
  });

  contents.on('will-attach-webview', (event) => event.preventDefault());
}

function createTab(context, target = '') {
  if (target && /\.(exe|msi|dmg|pkg|deb|rpm)(\?.*)?$/i.test(target)) {
    try { context.browserSession.downloadURL(target); } catch {}
    return context.activeTab;
  }
  const id = randomUUID();
  const view = new WebContentsView({
    webPreferences: {
      session: context.browserSession,
      plugins: true, // Chromium built-in PDF viewer.
      preload: path.join(__dirname,'privacy-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });
  view.webContents.setUserAgent(getCleanUserAgent());
  // Website canvases must not inherit the dark browser chrome.
  view.setBackgroundColor('#ffffff');
  installKeyboardShortcuts(view.webContents, context);
  const tab = { id, view, url: target, title: target || 'New tab', loading: Boolean(target), audible: false };
  context.tabs.set(id, tab);
  guardRemoteContents(context, view.webContents);

  view.webContents.on('media-started-playing', () => { tab.audible = true; publishTab(context, tab); });
  view.webContents.on('media-paused', () => { tab.audible = false; publishTab(context, tab); });
  const applyShields = () => {
    injectAdShield(view.webContents);
    injectPipOverlay(view.webContents);
    const settings = getProtectionSettings();
    if (settings.anonymityShield) {
      injectAnonymityShield(view.webContents);
    }
  };
  view.webContents.on('dom-ready', applyShields);
  view.webContents.on('did-finish-load', applyShields);
  view.webContents.on('did-start-loading', () => { tab.loading = true; publishTab(context, tab); });
  view.webContents.on('did-stop-loading', () => { tab.loading = false; publishTab(context, tab); });
  const recordHistory = (url, title) => {
    if (context.profile.mode !== 'incognito' && url && !url.startsWith('blackout:') && !url.startsWith('chrome:') && !url.startsWith('about:')) {
      const file = path.join(app.getPath('userData'), 'history.json');
      recordHistoryEntry(file, { url, title: title || url });
    }
  };

  const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const buildErrorPageDataUrl = (failedUrl, code, description) => {
    let hostname = '';
    try { hostname = new URL(failedUrl).hostname; } catch { hostname = failedUrl; }
    const cleanSearchQuery = hostname ? hostname.replace(/^www\./, '') : failedUrl;
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(cleanSearchQuery)}`;
    const searchGoogleUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanSearchQuery)}`;

    let reasonMsg = `The server at <strong>${escapeHtml(hostname)}</strong> could not be found. The web address might be misspelled, offline, or temporarily unreachable.`;
    if (code === -105) {
      reasonMsg = `The server IP address for <strong>${escapeHtml(hostname)}</strong> could not be found. Check if the address was misspelled or if the website has moved.`;
    } else if (code === -106) {
      reasonMsg = `Your internet connection appears to be offline. Check your Wi-Fi or local network cable.`;
    } else if (code === -102) {
      reasonMsg = `The server at <strong>${escapeHtml(hostname)}</strong> refused the connection. The site may be down.`;
    } else if (code === -118) {
      reasonMsg = `The connection to <strong>${escapeHtml(hostname)}</strong> timed out. The server took too long to reply.`;
    } else if (code === -300) {
      reasonMsg = `The address <strong>${escapeHtml(failedUrl)}</strong> is not a valid web address.`;
    }

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Site Not Available · Blackout</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 50% 25%, #151628 0%, #090a11 80%);
      color: #f4f1ff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px 20px;
      user-select: none;
    }
    .err-card {
      max-width: 580px;
      width: 100%;
      background: rgba(22, 24, 38, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-top: 1px solid rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(154, 122, 255, 0.1);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .err-header { display: flex; align-items: center; gap: 16px; }
    .err-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: linear-gradient(135deg, rgba(255, 104, 77, 0.2), rgba(154, 122, 255, 0.15));
      border: 1px solid rgba(255, 104, 77, 0.35);
      display: flex; align-items: center; justify-content: center;
      color: #ff684d; flex-shrink: 0;
    }
    .err-title-box h1 { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -0.01em; }
    .err-code {
      display: inline-block; margin-top: 4px; font-size: 11px; font-family: monospace;
      color: #9c9bad; background: rgba(255, 255, 255, 0.05); padding: 2px 8px; border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .err-desc { font-size: 13.5px; line-height: 1.6; color: #d1cfe0; }
    .err-desc strong { color: #77e4c4; word-break: break-all; }
    .search-section {
      background: rgba(12, 13, 20, 0.65); border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;
    }
    .search-kicker {
      font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700;
      color: #9a7aff; display: flex; align-items: center; gap: 6px;
    }
    .search-subtitle { font-size: 12px; color: #9c9bad; }
    .search-form { display: flex; gap: 8px; }
    .search-form input {
      flex: 1; background: #151624; border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px; padding: 9px 12px; color: #fff; font-size: 13px; outline: none;
      transition: border-color 0.15s;
    }
    .search-form input:focus { border-color: #9a7aff; box-shadow: 0 0 10px rgba(154, 122, 255, 0.25); }
    .search-form button {
      background: #9a7aff; color: #090a11; font-weight: 700; font-size: 12.5px;
      padding: 0 16px; border-radius: 8px; border: none; cursor: pointer; transition: filter 0.15s;
    }
    .search-form button:hover { filter: brightness(1.15); }
    .err-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn-act {
      text-decoration: none; font-size: 12.5px; font-weight: 600; padding: 8px 16px;
      border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05);
      color: #f4f1ff; transition: all 0.15s ease;
    }
    .btn-act:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.22); color: #fff; }
    .btn-act.primary { background: #9a7aff; color: #090a11; border: none; font-weight: 700; }
    .btn-act.primary:hover { filter: brightness(1.15); }

    body {background:radial-gradient(ellipse at 20% 10%,#242334 0,transparent 60%),#111217;padding:28px;min-height:100vh;box-sizing:border-box;}
    .err-card {max-width:600px;padding:38px;gap:24px;border-radius:28px;background:rgba(31,32,40,.94);border:1px solid #ffffff18;box-shadow:0 24px 70px #0004;}
    .err-icon {width:48px;height:48px;border-radius:50%;background:#ffffff0a;border:1px solid #ffffff12;color:#c8c4dd;}
    .err-title-box h1 {font-size:24px;font-weight:600;letter-spacing:-.6px;}
    .err-desc {font-size:14px;color:#bfc1ce;}.err-desc strong {color:#e5e1fa;}
    .err-code {background:none;border:0;padding:0;color:#a1a2b1;}
    .search-section {background:#ffffff04;border:1px solid #ffffff10;border-radius:20px;padding:20px;}
    .search-kicker {color:#eceaf5;font-size:14px;font-weight:600;letter-spacing:0;text-transform:none;}
    .search-form input {min-width:0;border-radius:14px;background:#14151b;padding:12px 14px;}
    .search-form button,.btn-act {border-radius:999px;min-height:40px;box-sizing:border-box;}
    .search-form button,.btn-act.primary {background:#ddd7ff;color:#241d3e;font-weight:600;}
    .err-actions {gap:10px;}.btn-act {padding:10px 18px;}
    .btn-act:focus-visible,button:focus-visible {outline:2px solid #b9afff;outline-offset:3px;}
    @media(max-width:480px){body{padding:16px;}.err-card{padding:24px;}.err-title-box h1{font-size:21px;}.search-section{padding:16px;}.err-header{align-items:flex-start;}}
    @media(prefers-reduced-motion:reduce){*{transition:none!important;}}
  </style>
</head>
<body>
  <div class="err-card">
    <div class="err-header">
      <div class="err-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="err-title-box">
        <h1>This page is not available</h1>
        <span class="err-code">${escapeHtml(description || 'Connection failed')} · ${code}</span>
      </div>
    </div>
    <p class="err-desc">${reasonMsg}</p>
    <div class="search-section">
      <div class="search-kicker">Search the web</div>
      <p class="search-subtitle">Check the address, or search for the site below.</p>
      <form class="search-form" action="https://duckduckgo.com/" method="GET">
        <input type="text" name="q" value="${escapeHtml(cleanSearchQuery)}" placeholder="Search the web" aria-label="Search the web">
        <button type="submit">Search</button>
      </form>
    </div>
    <div class="err-actions">
      <a href="${escapeHtml(searchUrl)}" class="btn-act primary">DuckDuckGo</a>
      <a href="${escapeHtml(searchGoogleUrl)}" class="btn-act">Google</a>
      <button type="button" class="btn-act" onclick="location.href='${escapeHtml(failedUrl)}'">Try again</button>
      <button type="button" class="btn-act" onclick="location.href='about:blank'">New tab</button>
    </div>
  </div>
</body>
</html>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  };

  view.webContents.on('did-navigate', (_event, navUrl) => {
    if (navUrl && !navUrl.startsWith('data:')) {
      tab.url = navUrl;
    }
    if (navUrl === 'about:blank') {
      tab.url = '';
      tab.loading = false;
      sendState(context, { type: 'empty' });
      updateViewBounds(context);
      return;
    }
    publishTab(context, tab);
    recordHistory(navUrl || tab.url, tab.title);
  });
  view.webContents.on('did-navigate-in-page', (_event, inPageUrl) => {
    applyShields();
    publishTab(context, tab);
    recordHistory(inPageUrl || tab.url, tab.title);
  });
  view.webContents.on('page-title-updated', (_event, title) => {
    tab.title = title || tab.url || 'Blackout';
    publishTab(context, tab);
    recordHistory(tab.url, title);
  });
  view.webContents.on('did-fail-load', (_event, code, description, failedUrl, isMainFrame) => {
    if (isMainFrame && code !== -3) sendState(context, { type: 'error', message: `Could not load ${failedUrl}: ${description}` });
    if (isMainFrame && code < 0 && code !== -3) {
      if (failedUrl && !failedUrl.startsWith('data:') && !failedUrl.startsWith('blackout:')) {
        tab.loading = false;
        tab.url = failedUrl;
        tab.title = 'Site Not Available · Blackout';
        publishTab(context, tab);
        const errDataUrl = buildErrorPageDataUrl(failedUrl, code, description);
        view.webContents.loadURL(errDataUrl).catch(() => {});
        updateViewBounds(context);
        return;
      }
    }
    if (isMainFrame && (code === -3 || code < 0)) {
      if (!view.webContents.getURL() || view.webContents.getURL() === 'about:blank') {
        tab.loading = false;
        tab.url = '';
        if (tab === context.activeTab) {
          updateViewBounds(context);
          sendState(context, { type: 'empty' });
        }
      }
    }
  });

function saveDataUrlImage(dataUrl, context) {
  try {
    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) return;
    const ext = matches[1].replace('jpeg', 'jpg');
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `image-${Date.now()}.${ext}`;
    const downloadsDir = app.getPath('downloads');
    let savePath = path.join(downloadsDir, filename);
    let counter = 1;
    while (fs.existsSync(savePath)) {
      savePath = path.join(downloadsDir, `image-${Date.now()} (${counter++}).${ext}`);
    }
    fs.writeFileSync(savePath, buffer);
    const imageDownloadId = randomUUID();
    globalDownloads.set(imageDownloadId,{id:imageDownloadId,filename:path.basename(savePath),savePath,totalBytes:buffer.length,receivedBytes:buffer.length,state:'completed',startedAt:Date.now(),completedAt:Date.now(),private:!context?.profile?.persistent});
    persistDownloads();
    const id = imageDownloadId;
    if (context) {
      sendState(context, {
        type: 'download-start',
        id,
        filename: path.basename(savePath),
        totalBytes: buffer.length,
        receivedBytes: buffer.length
      });
      setTimeout(() => {
        sendState(context, {
          type: 'download-completed',
          id,
          filename: path.basename(savePath),
          savePath,
          totalBytes: buffer.length
        });
      }, 150);
    }
  } catch (err) {
    console.error('Error saving data URL image:', err);
  }
}

  view.webContents.on('context-menu', async (_event, params) => {
    const menu = new Menu();

    let imageUrl = '';
    if (params.mediaType === 'image' || Boolean(params.hasImageContents)) {
      imageUrl = params.srcURL;
    } else if (params.srcURL && /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)(\?.*)?$/i.test(params.srcURL)) {
      imageUrl = params.srcURL;
    }

    if (!imageUrl && params.linkURL) {
      try {
        const u = new URL(params.linkURL);
        const p = u.searchParams.get('imgurl') || u.searchParams.get('image_url') || u.searchParams.get('img_url');
        if (p) imageUrl = p;
      } catch {}
      if (!imageUrl && /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)(\?.*)?$/i.test(params.linkURL)) {
        imageUrl = params.linkURL;
      }
    }

    if (!imageUrl && !view.webContents.isDestroyed()) {
      try {
        const domImg = await Promise.race([
          view.webContents.executeJavaScript(`
            (() => {
              try {
                const list = document.elementsFromPoint(${params.x}, ${params.y}) || [];
                for (const el of list) {
                  if (el.tagName === 'IMG' && (el.currentSrc || el.src)) return el.currentSrc || el.src;
                  if (el.tagName === 'PICTURE') {
                    const img = el.querySelector('img');
                    if (img && (img.currentSrc || img.src)) return img.currentSrc || img.src;
                  }
                  if (el.tagName === 'SOURCE' && el.srcset) {
                    const src = el.srcset.split(',')[0].trim().split(' ')[0];
                    if (src) return src;
                  }
                  const child = el.querySelector('img');
                  if (child && (child.currentSrc || child.src)) return child.currentSrc || child.src;
                  const bg = window.getComputedStyle(el).backgroundImage;
                  if (bg && bg !== 'none' && bg.startsWith('url(')) {
                    const m = bg.match(/url\\(["']?(.*?)["']?\\)/);
                    if (m && m[1] && !m[1].startsWith('data:image/svg')) return m[1];
                  }
                  const a = el.closest('a');
                  if (a && a.href) {
                    try {
                      const u = new URL(a.href);
                      const p = u.searchParams.get('imgurl') || u.searchParams.get('image_url') || u.searchParams.get('img_url');
                      if (p) return p;
                    } catch {}
                    if (/\\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)(\\?.*)?$/i.test(a.href)) return a.href;
                  }
                }
                const under = document.elementFromPoint(${params.x}, ${params.y});
                if (under) {
                  const closestImg = under.closest('picture')?.querySelector('img') || under.closest('figure')?.querySelector('img') || under.closest('article')?.querySelector('img') || under.closest('div')?.querySelector('img');
                  if (closestImg && (closestImg.currentSrc || closestImg.src)) return closestImg.currentSrc || closestImg.src;
                }
                return null;
              } catch { return null; }
            })()
          `),
          new Promise(r => setTimeout(() => r(null), 350))
        ]);
        if (domImg) imageUrl = domImg;
      } catch {}
    }

    if (imageUrl) {
      menu.append(new MenuItem({
        label: 'Open image in new tab',
        click: () => createTab(context, imageUrl)
      }));
      menu.append(new MenuItem({
        label: 'Download image',
        click: () => {
          try {
            if (imageUrl.startsWith('data:image/')) {
              saveDataUrlImage(imageUrl, context);
            } else {
              view.webContents.downloadURL(imageUrl);
            }
          } catch (e) {
            console.error('Failed to download image:', e);
          }
        }
      }));
      menu.append(new MenuItem({
        label: 'Save image as…',
        click: () => {
          try {
            if (imageUrl.startsWith('data:image/')) {
              saveDataUrlImage(imageUrl, context);
            } else {
              view.webContents.downloadURL(imageUrl);
            }
          } catch (e) {
            console.error('Failed to save image:', e);
          }
        }
      }));
      menu.append(new MenuItem({
        label: 'Copy image',
        click: () => {
          try {
            view.webContents.copyImageAt(params.x, params.y);
          } catch (e) {
            console.error('Failed to copy image:', e);
          }
        }
      }));
      menu.append(new MenuItem({
        label: 'Copy image address',
        click: () => clipboard.writeText(imageUrl)
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    }

    if (params.linkURL) {
      menu.append(new MenuItem({
        label: 'Open link in new tab',
        click: () => createTab(context, params.linkURL)
      }));
      menu.append(new MenuItem({
        label: 'Copy link address',
        click: () => clipboard.writeText(params.linkURL)
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    }
    if (params.selectionText) {
      menu.append(new MenuItem({ role: 'copy', label: 'Copy' }));
      menu.append(new MenuItem({
        label: `Search web for "${params.selectionText.slice(0, 24)}${params.selectionText.length > 24 ? '…' : ''}"`,
        click: () => createTab(context, normalizeTarget(params.selectionText))
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    }
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'undo', label: 'Undo' }));
      menu.append(new MenuItem({ role: 'redo', label: 'Redo' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'cut', label: 'Cut' }));
      menu.append(new MenuItem({ role: 'copy', label: 'Copy' }));
      menu.append(new MenuItem({ role: 'paste', label: 'Paste' }));
      menu.append(new MenuItem({ role: 'selectAll', label: 'Select all' }));
      menu.append(new MenuItem({ type: 'separator' }));
    }
    menu.append(new MenuItem({
      label: 'Pop out video player (Picture in picture)',
      click: () => togglePictureInPicture(context)
    }));
    menu.append(new MenuItem({ type: 'separator' }));

    if (view.webContents.canGoBack()) {
      menu.append(new MenuItem({ label: 'Back', click: () => view.webContents.goBack() }));
    }
    if (view.webContents.canGoForward()) {
      menu.append(new MenuItem({ label: 'Forward', click: () => view.webContents.goForward() }));
    }
    menu.append(new MenuItem({ label: 'Reload', click: () => view.webContents.reload() }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: 'Inspect element',
      click: () => view.webContents.inspectElement(params.x, params.y)
    }));
    menu.popup({ window: context.window });
  });

  if (context.activeTab) context.window.contentView.removeChildView(context.activeTab.view);
  context.activeTab = tab;
  context.window.contentView.addChildView(view);
  updateViewBounds(context);
  publishTab(context, tab);
  if (target) view.webContents.loadURL(target).catch((error) => sendState(context, { type: 'error', message: error.message }));
  else {
    tab.loading = false;
    sendState(context, { type: 'empty' });
    sendState(context, { type: 'focus-address' });
  }
  return tab;
}

function switchTab(context, id) {
  const tab = context.tabs.get(id);
  if (!tab) return false;
  const hadSettingsOpen = Boolean(context.settingsOpen);
  if (hadSettingsOpen) {
    context.settingsOpen = false;
    updateViewBounds(context);
  }
  if (tab !== context.activeTab) {
    if (context.activeTab) context.window.contentView.removeChildView(context.activeTab.view);
    context.activeTab = tab;
    context.window.contentView.addChildView(tab.view);
    updateViewBounds(context);
  }
  publishTab(context, tab);
  if (!tab.url) sendState(context, { type: 'empty' });
  sendTabs(context);
  return true;
}

function switchRelativeTab(context, direction) {
  const tabs = [...context.tabs.values()];
  if (tabs.length < 2 || !context.activeTab) return false;
  const currentIndex = tabs.findIndex(tab => tab.id === context.activeTab.id);
  return switchTab(context, tabs[(currentIndex + direction + tabs.length) % tabs.length].id);
}

function adjustTabZoom(tab, amount) {
  const current = tab?.view?.webContents?.getZoomFactor?.() || 1;
  const next = Math.min(5, Math.max(0.25, Math.round((current + amount) * 100) / 100));
  tab.view.webContents.setZoomFactor(next);
  return next;
}

async function reopenClosedTab(context) {
  const saved = context.closedTabs?.pop();
  if (!saved?.url) {if(context.profile.mode!=='standard')return false;const previous=closedWindows.takeWindow(path.join(app.getPath('userData'),'closed-windows.json'));if(!previous)return false;await createBrowserWindow('standard',previous);return true;}
  const tab=createTab(context,saved.url);
  if(tab&&saved.title)tab.title=saved.title;
  return true;
}

async function closeTab(context, id) {
  const tab = context.tabs.get(id);
  if (!tab) return false;
  const contents=tab.view?.webContents;
  tab.closing=true;
  if(contents&&!contents.isDestroyed())sitePermissions.clear(contents,true);
  if(contents)deviceAccess.delete(contents.id);
  closeSiteInfoPopup(context);
  const wasActive = tab === context.activeTab;
  if (tab.url) {
    context.closedTabs.push({ url: tab.url, title: tab.title });
    context.closedTabs = context.closedTabs.slice(-20);
  }
  context.tabs.delete(id);
  if (wasActive) {
    context.window.contentView.removeChildView(tab.view);
    context.activeTab = null;
  }
  if(contents&&!contents.isDestroyed())contents.destroy();
  publishDeviceAccess(context);
  if (wasActive) {
    const nextTab = [...context.tabs.values()].at(-1);
    if (nextTab) switchTab(context, nextTab.id);
  }
  sendTabs(context);
  if (!context.tabs.size) createTab(context);
  return true;
}

async function createBrowserWindow(mode, restoredWindow=null) {
  await profileCleanup.get(mode)?.catch(() => {});
  const { profile, browserSession } = browserSessionFor(mode);
  const id = randomUUID();
  // Keep only browser-owned UI preferences (such as theme selection) here.
  // Visited pages always use the separate Standard or Incognito session.
  const chromeSession = session.fromPartition('persist:blackout-ui');
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#f8f9fc',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      session: chromeSession,
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false
    }
  });
  const context = { id, profile, browserSession, window, tabs: new Map(), closedTabs: [], activeTab: null, appearance: { theme: 'eclipse' }, settingsOpen: false, modalOpen: false, siteInfoPopup: null, menuPopup: null, bookmarksBarVisible: true };
  contexts.set(window.id, context);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    log(`Renderer [lvl ${level}] (${path.basename(sourceId || '')}:${line}): ${message}`);
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    log(`Renderer process gone: ${details.reason} (exitCode: ${details.exitCode})`);
    showCrashReportWindow(`Renderer Process Crashed (${details.reason})`, details);
  });
  installKeyboardShortcuts(window.webContents, context, true);
  window.webContents.on('context-menu', (_event, params) => {
    const img = params.srcURL;
    if (img || params.mediaType === 'image') {
      const menu = new Menu();
      const target = img || '';
      if (target) {
        menu.append(new MenuItem({ label: 'Open image in new tab', click: () => createTab(context, target) }));
        menu.append(new MenuItem({ label: 'Save image as…', click: () => { try { window.webContents.downloadURL(target); } catch {} } }));
        menu.append(new MenuItem({ label: 'Copy image', click: () => { try { window.webContents.copyImageAt(params.x, params.y); } catch {} } }));
        menu.append(new MenuItem({ label: 'Copy image address', click: () => clipboard.writeText(target) }));
        menu.append(new MenuItem({ type: 'separator' }));
      }
      menu.append(new MenuItem({ role: 'copy', label: 'Copy' }));
      menu.popup({ window: context.window });
    }
  });
  window.on('resize', () => { closeMenuPopup(context); updateViewBounds(context); });
  window.on('move', () => closeMenuPopup(context));
  let updateTimer = null;
  window.on('close', () => {
    log('window close event triggered');
    try{if(!context.recoverySaved){closedWindows.saveWindow(path.join(app.getPath('userData'),'closed-windows.json'),context);context.recoverySaved=true}}catch{log('Closed window recovery could not be saved')}
    closeMenuPopup(context);
    closeSiteInfoPopup(context);
    if (contexts.size <= 1) {
      destroyBackgroundMusic();
    }
  });
  window.on('closed', () => {
    log('window closed event triggered, contexts left: ' + (contexts.size - 1));
    contexts.delete(window.id);
    closeMenuPopup(context);
    closeSiteInfoPopup(context);
    for (const tab of context.tabs.values()) {
      try {
        if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
          tab.view.webContents.destroy();
        }
      } catch {}
    }
    context.tabs.clear();
    if (updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
    if (shouldClearProfileOnClose(mode, [...contexts.values()].filter((item) => item.profile.mode === mode).length)) {
      notificationPermissions.clearPrivate();
      const cleanup = Promise.all([browserSession.clearStorageData(), browserSession.clearCache()]).catch(() => {});
      profileCleanup.set(mode, cleanup);
      cleanup.finally(() => {
        if (profileCleanup.get(mode) === cleanup) profileCleanup.delete(mode);
      });
    }
    if (contexts.size === 0) {
      log('all browser contexts closed, terminating background music and quitting app');
      terminateAppImmediately();
    }
  });
  const promptedUpdateVersions = new Set();
  const runUpdateCheck = () => {
    log('runUpdateCheck executing for version: ' + app.getVersion());
    checkForUpdate(app.getVersion()).then(update => {
      log('runUpdateCheck result: ' + (update ? JSON.stringify(update) : 'null (up-to-date)'));
      if (update && !context.window.isDestroyed()) {
        sendState(context, { type: 'update', update });
        if (promptedUpdateVersions.has(update.version)) return;
        promptedUpdateVersions.add(update.version);
        dialog.showMessageBox(context.window, {
          type: 'info',
          title: 'Blackout Browser Update Available',
          message: `Blackout Browser v${update.version} is available.`,
          detail: update.notes || 'A new update is available. Click Update Now to download the latest version in the background.',
          buttons: ['Update Now', 'Later'],
          defaultId: 0,
          cancelId: 1
        }).then(({ response }) => {
          if (response === 0) {
            context.browserSession.downloadURL(update.downloadUrl);
          }
        }).catch(() => {});
      }
    }).catch(err => {
      log('runUpdateCheck error: ' + (err.stack || err.message || err));
    });
  };

  window.loadURL('blackout://app/').then(() => {
    log('window.loadURL blackout://app/ succeeded');
    window.show();
    window.focus();
    sendProfile(context);
    if(restoredWindow?.tabs?.length){const restored=restoredWindow.tabs.map(t=>createTab(context,t.url));const active=restored[Math.min(restored.length-1,restoredWindow.activeIndex||0)];if(active)switchTab(context,active.id);}else createTab(context);
    setTimeout(runUpdateCheck, 2500);
    updateTimer = setInterval(runUpdateCheck, 10 * 60 * 1000);
  }).catch(err => {
    log('window.loadURL blackout://app/ FAILED: ' + (err.stack || err.message || err));
  });
  return context;
}

function registerIpc() {
  ipcMain.handle('browser:notification-settings',(event,value)=>{const context=contextForSender(event.sender);if(!context)return null;const wc=context.activeTab?.view?.webContents||event.sender;if(value?.policy)notificationPermissions.setPolicy(value.policy);if(value?.origin)notificationPermissions.set(wc,value.origin,value.value);return notificationPermissions.list(wc);});
  ipcMain.handle('browser:default-browser',async event=>{if(!contextForSender(event.sender))return false;if(process.platform!=='win32')return false;await windowsIntegration.registerBrowser(process.execPath);await shell.openExternal(windowsIntegration.defaultAppsUrl);return true;});
  ipcMain.handle('browser:notification-system',async event=>{if(!contextForSender(event.sender)||process.platform!=='win32')return false;await shell.openExternal('ms-settings:notifications');return true;});
  ipcMain.handle('browser:apply-update', (event, update) => {
    const context = contextForSender(event.sender);
    if (!context || !update?.downloadUrl) return false;
    context.browserSession.downloadURL(update.downloadUrl);
    return true;
  });
  ipcMain.handle('browser:toggle-pip', (event) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    return togglePictureInPicture(context);
  });
  ipcMain.handle('browser:window-action', (event, action) => {
    log('browser:window-action: ' + action);
    const context = contextForSender(event.sender);
    if (!context || !['minimize', 'maximize', 'close'].includes(action)) return false;
    if (action === 'minimize') context.window.minimize();
    else if (action === 'maximize') context.window.isMaximized() ? context.window.unmaximize() : context.window.maximize();
    else {
      if (contexts.size <= 1) {
        terminateAppImmediately();
      } else {
        context.window.close();
      }
    }
    return true;
  });
  ipcMain.handle('browser:favorites', (event, action, payload) => {
    const context = contextForSender(event.sender);
    if (!context || typeof action !== 'string') throw new Error('Untrusted favorites request.');
    const file = path.join(app.getPath('userData'), 'favorites.json');
    let items = readFavorites(file);
    if (!items.length && !fs.existsSync(file)) {
      try {
        items = [];
        writeFavorites(file, items);
      } catch {}
    }
    const writable = context.profile.mode === 'standard';
    if (action === 'list') return { items, writable };
    if (!writable) throw new Error('Favorites are read-only in Incognito.');
    if (action === 'add') items.push(normalizeFavorite(payload));
    else {
      const id = String(payload?.id || '');
      const index = items.findIndex(item => item.id === id);
      if (index < 0) throw new Error('Favorite not found.');
      if (action === 'update') items[index] = normalizeFavorite({ ...items[index], ...payload, id: items[index].id, createdAt: items[index].createdAt });
      else if (action === 'remove') items.splice(index, 1);
      else if (action === 'opened') items[index] = { ...items[index], lastOpenedAt: Date.now() };
      else throw new Error('Unknown favorites action.');
    }
    items = writeFavorites(file, items);
    return { items, writable };
  });
  ipcMain.handle('browser:address-popup',(event,rows,index,bounds)=>{const context=contextForSender(event.sender);if(!context||event.sender!==context.window.webContents)return false;const safe=Array.isArray(rows)?rows.slice(0,8).filter(row=>{try{return ['http:','https:'].includes(new URL(row.url).protocol)}catch{return false}}):[];return showAddressPopup(context,safe,Number.isInteger(index)?index:-1,bounds||{});});
  ipcMain.handle('browser:address-choice',(event,index)=>{const context=[...contexts.values()].find(c=>c.addressPopup?.webContents===event.sender),row=context?.addressRows?.[index];if(!row||!Number.isInteger(index))return false;sendState(context,{type:'address-choice',url:row.url});closeAddressPopup(context);return true;});
  ipcMain.handle('browser:address-suggestions',(event,query)=>{
    const context=contextForSender(event.sender);if(!context||typeof query!=='string')return [];
    const profile=app.getPath('userData');return addressSuggestions(query,context.profile.mode==='incognito'?[]:readHistory(path.join(profile,'history.json')),readFavorites(path.join(profile,'favorites.json')));
  });
  ipcMain.handle('browser:history', (event, action, payload) => {
    const context = contextForSender(event.sender);
    if (!context) return [];
    const file = path.join(app.getPath('userData'), 'history.json');
    if (action === 'get') {
      const items = readHistory(file);
      if (typeof payload === 'string' && payload.trim()) {
        const q = payload.trim().toLowerCase();
        return items.filter(item => (item.title && item.title.toLowerCase().includes(q)) || (item.url && item.url.toLowerCase().includes(q)));
      }
      return items;
    }
    if (action === 'delete') {
      return deleteHistoryEntry(file, String(payload || ''));
    }
    if (action === 'clear') {
      return clearHistoryFile(file);
    }
    return [];
  });
  ipcMain.handle('browser:settings', (event, open) => {
    const context = contextForSender(event.sender);
    if (!context || typeof open !== 'boolean') return false;
    context.settingsOpen = open;
    updateViewBounds(context);
    return true;
  });
  ipcMain.handle('browser:modal', (event, open) => {
    const context = contextForSender(event.sender);
    if (!context || typeof open !== 'boolean') return false;
    context.modalOpen = open;
    updateViewBounds(context);
    return true;
  });
  ipcMain.handle('browser:set-bookmarks-bar', (event, visible) => {
    const context = contextForSender(event.sender);
    if (!context || typeof visible !== 'boolean') return false;
    context.bookmarksBarVisible = visible;
    updateViewBounds(context);
    return true;
  });
  ipcMain.handle('browser:set-ui-appearance', (event, appearance) => {
    const context = contextForSender(event.sender);
    const theme = String(appearance?.theme || 'eclipse');
    if (!context || !['eclipse', 'ember', 'aurora'].includes(theme)) return false;
    context.appearance = { theme };
    sendState(context, { type: 'appearance', appearance: context.appearance });
    return true;
  });
  ipcMain.handle('browser:get-ui-appearance', (event) => {
    const context = contextForSender(event.sender);
    return context?.appearance || { theme: 'eclipse' };
  });
  ipcMain.handle('browser:bookmark-context-menu', (event, item) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    const menu = new Menu();
    if (item && item.url) {
      menu.append(new MenuItem({
        label: `Open`,
        click: () => {
          if (context.activeTab) {
            context.activeTab.url = item.url;
            context.activeTab.loading = true;
            updateViewBounds(context);
            publishTab(context, context.activeTab);
            context.activeTab.view.webContents.loadURL(item.url).catch(() => {});
          } else {
            createTab(context, item.url);
          }
        }
      }));
      menu.append(new MenuItem({
        label: 'Open in new tab',
        click: () => createTab(context, item.url)
      }));
      menu.append(new MenuItem({
        label: 'Copy address',
        click: () => clipboard.writeText(item.url)
      }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({
        label: 'Remove bookmark',
        click: () => sendState(context, { type: 'remove-bookmark', id: item.id })
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    }
    menu.append(new MenuItem({
      label: context.bookmarksBarVisible ? 'Hide bookmarks bar' : 'Show bookmarks bar',
      accelerator: 'CmdOrCtrl+Shift+B',
      click: () => sendState(context, { type: 'toggle-bookmarks-bar' })
    }));
    menu.popup({ window: context.window });
    return true;
  });
  ipcMain.handle('browser:app-menu', (event) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    const menu = new Menu();
    menu.append(new MenuItem({
      label: 'New tab',
      accelerator: 'CmdOrCtrl+T',
      click: () => createTab(context)
    }));
    menu.append(new MenuItem({
      label: 'New Incognito window',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: () => createBrowserWindow('incognito').catch(() => {})
    }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: context.bookmarksBarVisible ? 'Hide bookmarks bar' : 'Show bookmarks bar',
      accelerator: 'CmdOrCtrl+Shift+B',
      click: () => sendState(context, { type: 'toggle-bookmarks-bar' })
    }));
    menu.append(new MenuItem({
      label: 'Extensions',
      click: () => sendState(context, { type: 'open-extensions-dialog' })
    }));
    menu.append(new MenuItem({
      label: 'Settings',
      click: () => sendState(context, { type: 'open-settings' })
    }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: 'Blackout v0.2 preview',
      enabled: false
    }));
    menu.popup({ window: context.window });
    return true;
  });
  ipcMain.handle('browser:clear-site-data', async (event) => {
    const context = contextForSender(event.sender);
    if (!context || !context.settingsOpen) throw new Error('Open Settings to clear site data.');
    // Close tabs before clearing so pages cannot immediately recreate cookies/storage.
    const affected = [...contexts.values()].filter(item => item.browserSession === context.browserSession);
    for (const item of affected) {
      for (const id of [...item.tabs.keys()]) await closeTab(item, id);
    }
    await context.browserSession.clearStorageData();
    await context.browserSession.clearCache();
    return true;
  });
  ipcMain.handle('browser:site-info', async (event) => {
    const context = contextForSender(event.sender);
    const contents = context?.activeTab?.view?.webContents;
    const url = contents?.getURL() || '';
    let parsed;
    try { parsed = new URL(url); } catch { return { url: '', secure: false, cookies: 0, permissions: [], trackerStatus: 'Open a website to inspect its site data.' }; }
    if (!['http:', 'https:'].includes(parsed.protocol)) return { url, secure: false, cookies: 0, permissions: [], trackerStatus: 'Site data is available only for HTTP and HTTPS pages.' };
    const cookies = await context.browserSession.cookies.get({ url: parsed.href });
    const permissions = (permissionRequests.get(contents.id) || []).filter(item => {
      try { return new URL(item.url).origin === parsed.origin; } catch { return false; }
    });
    return {
      url: parsed.href,
      host: parsed.hostname,
      secure: parsed.protocol === 'https:',
      cookies: cookies.length,
      permissions,
      trackerStatus: (() => { const activity = getTrackerActivity(contents.id); return `${getProtectionSettings().label} protection · ${activity.blockedRequests} known tracker/ad request${activity.blockedRequests === 1 ? '' : 's'} blocked · ${activity.crossOriginRequests} cross-origin request${activity.crossOriginRequests === 1 ? '' : 's'} observed.`; })()
    };
  });
  ipcMain.handle('browser:site-info-popup', async (event) => {
    const context = contextForSender(event.sender);
    const contents = context?.activeTab?.view?.webContents;
    const url = contents?.getURL() || '';
    let parsed;
    try { parsed = new URL(url); } catch { return showSiteInfoPopup(context, { url: '', permissions: [], cookies: 0, trackerStatus: 'Open a website to inspect it.' }); }
    const cookies = await context.browserSession.cookies.get({ url: parsed.href });
    const permissions = (permissionRequests.get(contents.id) || []).filter(item => { try { return new URL(item.url).origin === parsed.origin; } catch { return false; } });
    return showSiteInfoPopup(context, { url: parsed.href, host: parsed.hostname, secure: parsed.protocol === 'https:', cookies: cookies.length, permissions, trackerStatus: `${getProtectionSettings().label} protection · ${getTrackerActivity(contents.id).blockedRequests} known tracker/ad requests blocked.` });
  });
  ipcMain.handle('browser:navigate', async (event, address, searchEngine) => {
    const context = contextForSender(event.sender);
    if (!context) throw new Error('Untrusted browser control request.');
    let target;
    try {
      target = normalizeTarget(address, searchEngine);
    } catch (normErr) {
      if (/^(javascript|file|data):/i.test(String(address).trim())) {
        throw normErr;
      }
      const baseUrl = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.duckduckgo;
      target = baseUrl + encodeURIComponent(String(address || '').trim());
    }
    if (!context.activeTab) {
      createTab(context, target);
    } else {
      context.activeTab.url = target;
      context.activeTab.loading = true;
      updateViewBounds(context);
      publishTab(context, context.activeTab);
      try {
        await context.activeTab.view.webContents.loadURL(target);
      } catch (loadErr) {
        console.warn('Navigation failed for target:', target, loadErr.message);
      }
    }
    return true;
  });
  ipcMain.handle('browser:control', (event, action) => {
    const context = contextForSender(event.sender);
    if (!context || typeof action !== 'string') return false;
    const contents = context.activeTab?.view.webContents;
    if (action === 'new-tab') createTab(context);
    else if (!contents) return false;
    else if (action === 'back' && contents.canGoBack()) contents.goBack();
    else if (action === 'forward' && contents.canGoForward()) contents.goForward();
    else if (action === 'reload') contents.reload();
    return true;
  });
  ipcMain.handle('browser:tab', (event, action, id) => {
    const context = contextForSender(event.sender);
    if (!context || typeof action !== 'string' || typeof id !== 'string') return false;
    if (action === 'switch') return switchTab(context, id);
    if (action === 'close') return closeTab(context, id);
    return false;
  });
  ipcMain.handle('browser:tab-move',(event,id,targetId,after)=>{
    const context=contextForSender(event.sender);
    if(!context||typeof after!=='boolean')return false;
    const changed=moveTab(context,id,targetId,after);if(changed)sendTabs(context);return changed;
  });
  ipcMain.handle('browser:incognito', (event) => {
    if (!contextForSender(event.sender)) return false;
    createBrowserWindow('incognito').catch(() => {});
    return true;
  });
  ipcMain.handle('browser:tab-group', (event, action, payload) => {
    const context=contextForSender(event.sender);
    if(!context || !payload || typeof payload!=='object')return false;
    const result=applyTabGroup(context,action,payload);
    if(result)sendTabs(context);
    return result;
  });
  ipcMain.handle('browser:set-protection-mode', (_event, mode) => {
    const activeMode = setProtectionMode(mode, app);
    for (const s of profileSessions.values()) {
      applyProtectionToSession(s);
    }
    for (const ctx of contexts.values()) {
      sendState(ctx, { type: 'protection-mode', mode: activeMode });
      for (const tab of ctx.tabs.values()) injectAdShield(tab.view.webContents);
    }
    return getProtectionSettings(activeMode);
  });
  ipcMain.handle('browser:toggle-protection-menu', (event, anchorBounds) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    return showProtectionPopup(context, anchorBounds);
  });
  ipcMain.handle('browser:toggle-extensions-menu', (event, anchorBounds, pinnedIds) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    return showExtensionsPopup(context, anchorBounds, pinnedIds);
  });
  ipcMain.handle('browser:toggle-downloads-menu', (event, anchorBounds) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    return showDownloadsPopup(context, anchorBounds);
  });
  ipcMain.handle('browser:toggle-music-popup', (event, anchorBounds) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    return showMusicPopup(context, anchorBounds);
  });
  ipcMain.handle('browser:get-downloads', () => [...globalDownloads.values()]);
  ipcMain.handle('browser:runtime-info',event=>contextForSender(event.sender)?{electron:process.versions.electron,chromium:process.versions.chrome,platform:process.platform}:null);
  ipcMain.handle('browser:site-device',(event,type,value)=>{
    const context=contextForSender(event.sender),popup=context?.siteInfoPopup,contents=popup?.sitePage;
    if(!popup||event.sender!==popup.webContents||!contents||contents.isDestroyed()||contents.getURL()!==popup.siteUrl)return false;
    const changed=sitePermissions.setPage(contents,type,value);
    if(changed&&value!=='allow')contents.reload();
    return changed;
  });
  ipcMain.handle('browser:device-policy', (event, value) => {
    const context=contextForSender(event.sender);
    if (!context) return null;
    if (value) for (const type of ['audio','video']) if (['ask','block'].includes(value[type])) sitePermissions.policy[type]=value[type];
    publishDeviceAccess(context);
    return {...sitePermissions.policy};
  });
  ipcMain.handle('browser:stop-devices', event => {
    const context=contextForSender(event.sender);
    if (!context) return false;
    for (const item of [...deviceAccess.values()].filter(i=>i.contextId===context.id)) {
      const contents=require('electron').webContents.fromId(item.id);
      if (contents && !contents.isDestroyed()) {sitePermissions.clear(contents); contents.reload();}
    }
    return true;
  });
  ipcMain.handle('browser:clear-downloads', () => {
    for (const [id, download] of globalDownloads) if (!activeDownloadItems.has(id)) globalDownloads.delete(id);
    persistDownloads();
    return true;
  });
  ipcMain.handle('browser:cancel-download', (_event, id) => {
    const item = activeDownloadItems.get(id);
    if (item) {
      try { item.cancel(); } catch {}
      activeDownloadItems.delete(id);
      return true;
    }
    return false;
  });
  ipcMain.handle('browser:close-menu-popup', (event) => {
    const context = contextForSender(event.sender);
    if (context) closeMenuPopup(context);
    return true;
  });
  ipcMain.handle('browser:app-action', (event, action, payload) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    if (action === 'open-extensions-dialog') {
      sendState(context, { type: 'open-extensions-dialog' });
    } else if (action === 'open-extension-item') {
      sendState(context, { type: 'open-extension-item', id: payload?.id });
    } else if (action === 'toggle-pin-extension') {
      sendState(context, { type: 'toggle-pin-extension', id: payload?.id });
    } else if (action === 'set-pinned-extensions') {
      sendState(context, { type: 'set-pinned-extensions', pinnedIds: payload?.pinnedIds });
    }
    return true;
  });
  ipcMain.handle('browser:get-protection-mode', () => {
    return {
      settings: getProtectionSettings(),
      adsBlocked: getAdsBlockedCount()
    };
  });
  ipcMain.handle('browser:set-proxy', async (event, config) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    const mode = config?.mode || 'direct';
    let proxyRules = '';
    if (mode === 'http' || mode === 'https' || mode === 'socks5') {
      const host = (config.host || '').trim();
      const port = (config.port || '').trim();
      if (!host) throw new Error('Proxy host is required.');
      proxyRules = `${mode}://${host}${port ? `:${port}` : ''}`;
    }
    const proxyBypassRules = config?.bypass || '<local>';
    for (const s of profileSessions.values()) {
      await s.setProxy({ proxyRules, proxyBypassRules });
    }
    return { success: true, mode, proxyRules };
  });
  ipcMain.handle('browser:wireguard-parse', (_event, raw) => {
    return parseWireGuardConfig(raw);
  });
  ipcMain.handle('extensions:list', (event) => {
    const context = contextForSender(event.sender);
    const browserSession = context?.browserSession || profileSessions.get('standard') || [...profileSessions.values()][0];
    if (!browserSession) return [];
    return listActiveExtensions(browserSession);
  });
  ipcMain.handle('extensions:load-unpacked', async (event) => {
    const context = contextForSender(event.sender);
    const browserSession = context?.browserSession || profileSessions.get('standard') || [...profileSessions.values()][0];
    if (!browserSession) return null;
    const parentWin = context?.window || (context?.menuPopup ? BrowserWindow.fromWebContents(event.sender) : null);
    const result = await dialog.showOpenDialog(parentWin || undefined, {
      title: 'Select Unpacked Chrome Extension Folder',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths.length) return null;
    const ext = await installUnpackedExtension(browserSession, app, result.filePaths[0]);
    for (const ctx of contexts.values()) {
      sendState(ctx, { type: 'refresh-extensions' });
    }
    return ext;
  });
  ipcMain.handle('extensions:remove', async (event, id) => {
    const context = contextForSender(event.sender);
    const browserSession = context?.browserSession || profileSessions.get('standard') || [...profileSessions.values()][0];
    if (!browserSession) return false;
    const removed = await uninstallExtension(browserSession, app, id);
    for (const ctx of contexts.values()) {
      sendState(ctx, { type: 'refresh-extensions' });
    }
    return removed;
  });
  ipcMain.handle('extensions:open-popup', (event, id, anchorBounds) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    return openExtensionPopup(BrowserWindow, context, id, anchorBounds);
  });
  ipcMain.handle('extensions:open-tab', async (event, id) => {
    const context = contextForSender(event.sender);
    if (!context) return false;
    const extensions = listActiveExtensions(context.browserSession);
    const ext = extensions.find(e => e.id === id);
    if (!ext || !ext.popupUrl) return false;
    createTab(context, ext.popupUrl);
    return true;
  });
  ipcMain.handle('browser:open-file', (event, filePath) => {
    if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
      shell.openPath(filePath);
      return true;
    }
    return false;
  });
  ipcMain.handle('browser:open-download', (event, filePath) => {
    if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  });
  ipcMain.handle('browser:open-downloads-folder', () => {
    shell.openPath(app.getPath('downloads'));
    return true;
  });
  ipcMain.handle('browser:get-downloads-path', () => {
    return app.getPath('downloads');
  });
  ipcMain.handle('browser:search-music', async (_event, query) => {
    return searchMusic(query);
  });

  function getBackgroundMusicWin() {
    if (!backgroundMusicWin || backgroundMusicWin.isDestroyed()) {
      backgroundMusicWin = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        skipTaskbar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          autoplayPolicy: 'no-user-gesture-required',
          backgroundThrottling: false
        }
      });

      backgroundMusicWin.webContents.setBackgroundThrottling(false);

      try {
        applyProtectionToSession(backgroundMusicWin.webContents.session);
      } catch {}

      const setupOptimizer = () => {
        if (!backgroundMusicWin || backgroundMusicWin.isDestroyed()) return;
        backgroundMusicWin.webContents.insertCSS(`
          #comments, #related, #secondary, #masthead-container, ytd-merch-shelf-renderer, ytd-live-chat-frame {
            display: none !important;
          }
        `).catch(() => {});

        backgroundMusicWin.webContents.executeJavaScript(`
          (() => {
            window.__blackoutVolume = ${currentMusicVolume};
            try {
              Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
              Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
              window.dispatchEvent(new Event('visibilitychange'));
            } catch {}

            if (window.__blackoutAdSkipper) clearInterval(window.__blackoutAdSkipper);

            let lastKickstartAttempt = 0;
            window.__blackoutAdSkipper = setInterval(() => {
              const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
              const v = document.querySelector('video') || document.querySelector('audio');

              // 1. Auto-dismiss any Google / YouTube consent dialogs or popups
              const consentBtns = document.querySelectorAll('ytd-consent-bump-v2-lightbox button, button[aria-label*="Accept"], button[aria-label*="agree"], .yt-spec-button-shape-next--filled, #content.ytd-consent-bump-v2-lightbox-renderer button');
              consentBtns.forEach(b => { try { b.click(); } catch {} });

              // 2. Click large play button or center play button if present
              const largePlay = document.querySelector('.ytp-large-play-button, .ytp-play-button');
              if (largePlay && !window.__blackoutUserPaused && v && v.paused) {
                try { largePlay.click(); } catch {}
              }

              // 3. Ad skipping & fast forward
              const ad = document.querySelector('.ad-showing, .ad-interrupting');
              if (ad && v) {
                try { v.playbackRate = 16; } catch {}
                try { v.muted = true; } catch {}
                const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button, .videoAdUiSkipButton, .ytp-ad-skip-button-container button');
                if (skipBtn) try { skipBtn.click(); } catch {}
                if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.2) {
                  try { v.currentTime = v.duration - 0.2; } catch {}
                }
              } else if (v) {
                if (v.playbackRate !== 1) {
                  try { v.playbackRate = 1; } catch {}
                }
                if (typeof window.__blackoutVolume === 'number') {
                  const isZero = (window.__blackoutVolume === 0);
                  try {
                    v.volume = window.__blackoutVolume;
                    v.muted = isZero;
                  } catch {}
                  try {
                    if (player && typeof player.setVolume === 'function') {
                      player.setVolume(Math.round(window.__blackoutVolume * 100));
                      if (isZero && typeof player.mute === 'function') {
                        player.mute();
                      } else if (!isZero && typeof player.unMute === 'function') {
                        player.unMute();
                      }
                    }
                  } catch {}
                }

                // 4. Force unstick at start:
                if (!window.__blackoutUserPaused) {
                  const now = Date.now();
                  const state = (player && typeof player.getPlayerState === 'function') ? player.getPlayerState() : -1;
                  // State 1 = playing. If not playing and at start (< 0.5s):
                  if (state !== 1 && v.currentTime < 0.5 && now - lastKickstartAttempt > 350) {
                    lastKickstartAttempt = now;
                    if (window.__blackoutVolume > 0) {
                      try { player?.unMute?.(); } catch {}
                    } else {
                      try { player?.mute?.(); } catch {}
                      try { v.muted = true; } catch {}
                    }
                    try { player?.playVideo?.(); } catch {}
                    try { player?.seekTo?.(0.1, true); } catch {}
                    if (v.paused) v.play().catch(() => {});
                  } else if (v.paused && !v.ended && state !== 1 && now - lastKickstartAttempt > 500) {
                    lastKickstartAttempt = now;
                    try { player?.playVideo?.(); } catch {}
                    v.play().catch(() => {});
                  }
                }
              }
            }, 180);
          })();
        `).catch(() => {});
      };

      backgroundMusicWin.webContents.on('did-finish-load', setupOptimizer);
      backgroundMusicWin.webContents.on('dom-ready', setupOptimizer);
    }
    return backgroundMusicWin;
  }

  ipcMain.handle('browser:music-play', async (_event, payload) => {
    const videoId = payload?.videoId;
    if (!videoId) return { success: false };
    const win = getBackgroundMusicWin();
    if (typeof payload.volume === 'number') currentMusicVolume = Math.max(0, Math.min(1, payload.volume));
    try {
      win.webContents.setAudioMuted(currentMusicVolume === 0);
    } catch {}
    if (payload.track) {
      currentMusicTrack = payload.track;
    } else {
      currentMusicTrack = {
        videoId,
        title: payload.title || 'Playing Song',
        artist: payload.artist || 'Web Audio',
        album: payload.album || '',
        cover: payload.cover || '',
        duration: payload.duration || 0,
        type: 'WEB STREAM'
      };
    }
    currentMusicIsPlaying = true;
    const url = `https://www.youtube.com/watch?v=${videoId}&autoplay=1`;
    log(`Playing background music for videoId: ${videoId}`);
    try {
      await win.loadURL(url);
      return { success: true };
    } catch (err) {
      log(`Error loading music url ${url}: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('browser:music-pause', async () => {
    currentMusicIsPlaying = false;
    if (!backgroundMusicWin || backgroundMusicWin.isDestroyed()) return false;
    try {
      await backgroundMusicWin.webContents.executeJavaScript(`
        (() => {
          window.__blackoutUserPaused = true;
          const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
          const v = document.querySelector('video');
          if (player && typeof player.pauseVideo === 'function') {
            player.pauseVideo();
          } else if (v) {
            v.pause();
          }
          return true;
        })()
      `);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('browser:music-resume', async () => {
    currentMusicIsPlaying = true;
    if (!backgroundMusicWin || backgroundMusicWin.isDestroyed()) return false;
    try {
      const res = await backgroundMusicWin.webContents.executeJavaScript(`
        (() => {
          window.__blackoutUserPaused = false;
          const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
          const v = document.querySelector('video');
          if (!player && !v) return false;
          try { player?.unMute?.(); } catch {}
          if (player && typeof player.playVideo === 'function') {
            player.playVideo();
            if (player.getCurrentTime && player.getCurrentTime() < 0.2) {
              try { player.seekTo(0.1, true); } catch {}
            }
          } else if (v) {
            v.play().catch(() => {});
          }
          return true;
        })()
      `);
      return Boolean(res);
    } catch {
      return false;
    }
  });

  ipcMain.handle('browser:music-seek', async (_event, seconds) => {
    if (!backgroundMusicWin || backgroundMusicWin.isDestroyed()) return false;
    const target = Number(seconds);
    if (!isFinite(target) || target < 0) return false;
    try {
      await backgroundMusicWin.webContents.executeJavaScript(`
        (() => {
          const target = ${target};
          window.__blackoutUserPaused = false;
          const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
          const v = document.querySelector('video');
          if (player && typeof player.seekTo === 'function') {
            try {
              player.seekTo(target, true);
            } catch (e) {
              if (v) v.currentTime = target;
            }
          } else if (v && isFinite(target)) {
            v.currentTime = target;
          }
          if (player && typeof player.playVideo === 'function') {
            player.playVideo();
          } else if (v) {
            v.play().catch(() => {});
          }
          return true;
        })()
      `);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('browser:music-volume', async (_event, volume) => {
    currentMusicVolume = Math.max(0, Math.min(1, Number(volume) || 0));
    const isMuted = currentMusicVolume === 0;

    // 1. Update background YouTube music window if active
    if (backgroundMusicWin && !backgroundMusicWin.isDestroyed()) {
      try {
        backgroundMusicWin.webContents.setAudioMuted(isMuted);
      } catch {}
      try {
        await backgroundMusicWin.webContents.executeJavaScript(`
          (() => {
            window.__blackoutVolume = ${currentMusicVolume};
            const isZero = ${isMuted};
            const allMedia = document.querySelectorAll('video, audio');
            allMedia.forEach(m => {
              try {
                m.volume = ${currentMusicVolume};
                m.muted = isZero;
              } catch {}
            });
            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (player) {
              if (typeof player.setVolume === 'function') player.setVolume(${Math.round(currentMusicVolume * 100)});
              if (isZero && typeof player.mute === 'function') {
                player.mute();
              } else if (!isZero && typeof player.unMute === 'function') {
                player.unMute();
              }
            }
          })()
        `);
      } catch {}
    }

    // 2. Broadcast volume to ALL open windows and popups
    for (const ctx of contexts.values()) {
      sendState(ctx, { type: 'music-volume', volume: currentMusicVolume });
    }

    return true;
  });

  ipcMain.handle('browser:music-status', async () => {
    if (!backgroundMusicWin || backgroundMusicWin.isDestroyed()) {
      return { active: false, currentTime: 0, duration: 0, playing: false, paused: true, ended: false };
    }
    try {
      const status = await backgroundMusicWin.webContents.executeJavaScript(`
        (() => {
          const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
          const v = document.querySelector('video');
          if (!v && !player) return null;
          const cur = (player && typeof player.getCurrentTime === 'function')
            ? player.getCurrentTime()
            : (v ? v.currentTime : 0);
          const dur = (player && typeof player.getDuration === 'function')
            ? player.getDuration()
            : (v ? v.duration : 0);
          const state = (player && typeof player.getPlayerState === 'function')
            ? player.getPlayerState()
            : -1;
          // State: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
          const isPlaying = (state === 1) || (v && !v.paused && v.currentTime > 0);
          const isEnded = (state === 0) || Boolean(v?.ended);
          return {
            currentTime: cur || 0,
            duration: dur || 0,
            playing: isPlaying,
            paused: !isPlaying,
            ended: isEnded
          };
        })()
      `);
      return status ? { active: true, ...status } : { active: false, currentTime: 0, duration: 0, playing: false, paused: true, ended: false };
    } catch {
      return { active: false, currentTime: 0, duration: 0, playing: false, paused: true, ended: false };
    }
  });

  ipcMain.handle('browser:music-stop', async () => {
    currentMusicIsPlaying = false;
    if (!backgroundMusicWin || backgroundMusicWin.isDestroyed()) return true;
    try {
      await backgroundMusicWin.webContents.executeJavaScript(`
        (() => {
          window.__blackoutUserPaused = true;
          const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
          const v = document.querySelector('video');
          try { player?.pauseVideo?.(); } catch {}
          try { v?.pause(); } catch {}
          if (v) v.currentTime = 0;
        })()
      `);
      await backgroundMusicWin.loadURL('about:blank');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('browser:get-music-state', async () => {
    let status = null;
    if (backgroundMusicWin && !backgroundMusicWin.isDestroyed()) {
      try {
        status = await backgroundMusicWin.webContents.executeJavaScript(`
          (() => {
            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            const v = document.querySelector('video');
            if (!v && !player) return null;
            const cur = (player && typeof player.getCurrentTime === 'function')
              ? player.getCurrentTime()
              : (v ? v.currentTime : 0);
            const dur = (player && typeof player.getDuration === 'function')
              ? player.getDuration()
              : (v ? v.duration : 0);
            const state = (player && typeof player.getPlayerState === 'function')
              ? player.getPlayerState()
              : -1;
            const isPlaying = (state === 1) || (v && !v.paused && v.currentTime > 0);
            const isEnded = (state === 0) || Boolean(v?.ended);
            return {
              currentTime: cur || 0,
              duration: dur || 0,
              playing: isPlaying,
              paused: !isPlaying,
              ended: isEnded
            };
          })()
        `);
      } catch {}
    }
    const isPlaying = status ? Boolean(status.playing) : currentMusicIsPlaying;
    return {
      active: Boolean(backgroundMusicWin && !backgroundMusicWin.isDestroyed()),
      track: currentMusicTrack,
      volume: currentMusicVolume,
      isPlaying,
      currentTime: status?.currentTime || 0,
      duration: status?.duration || currentMusicTrack?.duration || 0,
      playlist: currentMusicPlaylist
    };
  });

  ipcMain.handle('browser:set-music-state', (_event, state) => {
    if (state?.track) currentMusicTrack = state.track;
    if (Array.isArray(state?.playlist)) currentMusicPlaylist = state.playlist;
    if (typeof state?.volume === 'number') currentMusicVolume = state.volume;
    return true;
  });

  ipcMain.handle('browser:get-music-favorites', () => readMusicFavorites());
  ipcMain.handle('browser:toggle-music-favorite', (_event, track) => toggleMusicFavorite(track));
  ipcMain.handle('browser:is-music-favorited', (_event, id) => isMusicFavorited(id));
  ipcMain.handle('browser:cache-music-track', async (_event, track) => cacheMusicTrack(track));
  ipcMain.handle('browser:remove-cached-music', (_event, id) => removeCachedMusic(id));
}

app.whenReady().then(async () => {
  log('whenReady entered');
  if(process.platform==='win32'&&app.isPackaged){try{await windowsIntegration.registerBrowser(process.execPath);windowsIntegration.notificationShortcut({app,shell,executable:process.execPath});}catch(error){log('Windows integration: '+error.message);}}
  try {
    for (const download of readDownloads(path.join(app.getPath('userData'), 'downloads.json'))) globalDownloads.set(download.id, download);
    // The browser shell must never receive Electron's default Reload/Force Reload
    // menu accelerators. All refresh keys are routed to the active page above.
    Menu.setApplicationMenu(null);
    initMusicFavorites(app);
    const cleanUa = getCleanUserAgent();
    if (cleanUa) {
      app.userAgentFallback = cleanUa;
    }
    loadSavedProtectionMode(app);
    log('protection mode loaded');
    oauthBridge = createOauthBridge({
      BrowserWindow,
      authSession: session.fromPartition('persist:blackout-auth'),
      isExtensionLoaded: id => [...profileSessions.values()].some(item => listActiveExtensions(item).some(extension => extension.id === id)),
      parentForExtension: id => [...contexts.values()].find(context => listActiveExtensions(context.browserSession).some(extension => extension.id === id))?.window || null
    });
    try {
      await oauthBridge.start();
      log('oauth bridge started');
    } catch (err) {
      log('oauth bridge failed: ' + err.message);
    }
    log('registering protocol');
    session.fromPartition('persist:blackout-ui').protocol.handle('blackout', async (request) => {
      const url = new URL(request.url);
      if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
      const pathname = url.pathname;
      if (pathname.startsWith('/music-cache/')) {
        const filename = path.basename(pathname);
        const cacheFile = path.join(app.getPath('userData'), 'music-cache', filename);
        if (fs.existsSync(cacheFile)) {
          return localAudioResponse(request, cacheFile);
        }
        return new Response('Not found', { status: 404 });
      }
      if (pathname === '/favicon') {
        const target = url.searchParams.get('url') || '';
        let source;
        try { source = new URL(target); } catch { return new Response('Not found', { status: 404 }); }
        if (source.protocol !== 'https:' || source.username || source.password) return new Response('Not found', { status: 404 });
        try {
          const icon = new URL('/favicon.ico', source.origin);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const response = await net.fetch(icon.href, { signal: controller.signal });
          clearTimeout(timeoutId);
          const type = response.headers.get('content-type') || '';
          if (!response.ok || !/^image\/(?:png|x-icon|vnd\.microsoft\.icon|svg\+xml|webp|jpeg)/i.test(type)) return new Response('Not found', { status: 404 });
          const body = await response.arrayBuffer();
          if (body.byteLength > 512 * 1024) return new Response('Not found', { status: 404 });
          return new Response(body, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'Referrer-Policy': 'no-referrer' } });
        } catch {
          return new Response('Not found', { status: 404 });
        }
      }
      const asset = UI_FILES.get(pathname);
      if (!asset) return new Response('Not found', { status: 404 });
      const file = path.join(__dirname, '..', 'ui', asset[0]);
      try {
        const body = fs.readFileSync(file);
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': asset[1],
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; media-src 'self' https: data: blob:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https: data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer'
          }
        });
      } catch (readErr) {
        log('Failed reading UI file ' + file + ': ' + readErr.message);
        return new Response('Not found', { status: 404 });
      }
    });
    log('protocol registered');

    registerIpc();
    log('ipc registered');
    try {
      await showSplashIfFirstLaunch();
      log('splash handled');
    } catch (err) {
      log('splash error: ' + err.message);
    }
    log('calling createBrowserWindow');
    await createBrowserWindow('standard');
    const external=require('./external-target.cjs').externalTarget(process.argv);
    const firstContext=[...contexts.values()][0];
    if(external&&firstContext)createTab(firstContext,external);
    isAppReady = true;
    log('createBrowserWindow finished, isAppReady set to true');
  } catch (fatal) {
    log('FATAL in whenReady: ' + (fatal.stack || fatal.message || fatal));
  }
}).catch(err => {
  log('unhandled rejection in whenReady: ' + (err.stack || err));
});

app.on('child-process-gone', (_event, details) => {
  if (details.type !== 'Utility') {
    log(`Child process gone: ${details.type} (${details.reason})`);
    showCrashReportWindow(`Browser Process Crashed (${details.type}: ${details.reason})`, details);
  }
});

app.on('before-quit', (event) => {
  log('app before-quit event, quitting=' + quitting);
  if (quitting) return;
  quitting = true;
  if (!isAppReady && !quitting) return; // The first-launch splash closes before browser creation.
  terminateAppImmediately();
});

app.on('window-all-closed', () => {
  log('app window-all-closed, contexts count=' + contexts.size + ', isAppReady=' + isAppReady);
  if (!isAppReady && !quitting) return; // Splash closing is not a browser exit.
  terminateAppImmediately();
});
