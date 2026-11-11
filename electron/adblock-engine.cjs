// Filter-list ad blocking (EasyList, EasyPrivacy, uBlock Origin filters) via the vendored Ghostery engine.
// Network matching is called from protection.cjs's own webRequest handlers (Electron allows one listener
// per event). Cosmetic styles and scriptlets (needed for YouTube video ads) are delivered through the
// engine's frame preload and two IPC handlers, gated by the current protection settings.
const fs = require('node:fs');
const path = require('node:path');

const VENDOR = path.join(__dirname, 'vendor');
const PRELOAD = path.join(VENDOR, 'ghostery-preload.cjs');
let engine = null, lib = null, loadError = null, handlersInstalled = false;
const sessions = new WeakSet();
const preloadIds = new WeakMap();

function load() {
  if (engine || loadError) return engine;
  try {
    lib = require(path.join(VENDOR, 'ghostery-adblocker.cjs'));
    engine = lib.ElectronBlocker.deserialize(new Uint8Array(fs.readFileSync(path.join(VENDOR, 'adblock-engine.bin'))));
  } catch (error) {
    loadError = error;
    console.error('[blackout] adblock engine unavailable, using built-in list', error?.message || error);
  }
  return engine;
}

function available() { return !!load(); }

function requestFrom(details) {
  return lib.Request.fromRawDetails({
    _originalRequestDetails: details,
    requestId: String(details.id),
    sourceUrl: details.referrer || details.frame?.url || '',
    tabId: details.webContentsId,
    type: details.resourceType || 'other',
    url: details.url,
  });
}

// Returns {cancel:true} | {redirectURL} | null. Main-frame navigations are never blocked.
function matchRequest(details) {
  if (!load()) return null;
  const request = requestFrom(details);
  if (request.type === 'other') request.guessTypeOfRequest();
  if (request.isMainFrame()) return null;
  const { redirect, match } = engine.match(request);
  if (redirect) return { redirectURL: redirect.dataUrl };
  if (match) return { cancel: true };
  return null;
}

// Adds filter-list CSP directives to documents (e.g. blocking inline ad scripts). Mutates headers.
function applyCsp(details, responseHeaders) {
  if (!load()) return;
  if (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') return;
  const csp = engine.getCSPDirectives(requestFrom(details));
  if (!csp) return;
  const policies = csp.split(';').map((value) => value.trim()).filter(Boolean);
  for (const [name, values] of Object.entries(responseHeaders)) {
    if (name.toLowerCase() === 'content-security-policy') { policies.push(...[].concat(values)); delete responseHeaders[name]; }
  }
  responseHeaders['content-security-policy'] = [policies.join(';')];
}

// settings(): {styles:boolean, scripts:boolean}
function attachCosmetics(browserSession, settings) {
  if (!load() || sessions.has(browserSession)) return;
  preloadIds.set(browserSession, browserSession.registerPreloadScript({ type: 'frame', filePath: PRELOAD }));
  sessions.add(browserSession);
  if (handlersInstalled) return;
  const { ipcMain } = require('electron');
  if (!ipcMain?.handle) return; // outside the Electron main process (tests)
  handlersInstalled = true;
  ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', () => engine.config.enableMutationObserver);
  ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', async (event, url, msg) => {
    const sender = event.sender;
    if (!sender || sender.isDestroyed?.() || !sessions.has(sender.session)) return;
    const { styles: wantStyles, scripts: wantScripts } = settings();
    if (!wantStyles && !wantScripts) return;
    let hostname = '', domain = '';
    try { const parsed = lib.Request.fromRawDetails({ url }); hostname = parsed.hostname; domain = parsed.domain || hostname; } catch { return; }
    if (!hostname) return;
    const first = msg === undefined;
    const { active, styles, scripts } = engine.getCosmeticsFilters({
      domain, hostname, url,
      classes: msg?.classes, hrefs: msg?.hrefs, ids: msg?.ids,
      getBaseRules: first, getInjectionRules: first, getExtendedRules: false,
      getRulesFromHostname: first, getRulesFromDOM: !first,
      callerContext: { frameId: event.frameId, processId: event.processId, lifecycle: msg?.lifecycle },
    });
    if (active === false) return;
    if (wantStyles && styles.length) sender.insertCSS(styles, { cssOrigin: 'user' }).catch(() => {});
    // One injection per frame update; each scriptlet is isolated so one failure cannot stop the rest.
    if (wantScripts && scripts.length) sender.executeJavaScript(scripts.map((script) => `try{${script}}catch(e){}`).join('\n'), true).catch(() => {});
  });
}

function info() {
  try { return JSON.parse(fs.readFileSync(path.join(VENDOR, 'adblock-engine.json'), 'utf8')); } catch { return null; }
}

module.exports = { available, matchRequest, applyCsp, attachCosmetics, info, PRELOAD };
