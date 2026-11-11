const {privacyHeaders, isGoogleAuthUrl}=require('./browser-identity.cjs');
const fs = require('node:fs');
const path = require('node:path');
const adblockEngine = require('./adblock-engine.cjs');

const AD_BLOCK_PATTERNS = [
  // Google & YouTube Ads (metadata, tracking, telemetry, break triggers)
  '*://*.doubleclick.net/*',
  '*://*.googleadservices.com/*',
  '*://*.googlesyndication.com/*',
  '*://pagead2.googlesyndication.com/*',
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/ptracking*',
  '*://*.youtube.com/get_midroll_info*',
  '*://*.youtube.com/youtubei/v1/player/ad_break*',
  '*://ad.youtube.com/*',
  // Major Ad Networks
  '*://*.criteo.com/*',
  '*://*.criteo.net/*',
  '*://*.taboola.com/*',
  '*://*.outbrain.com/*',
  '*://*.adnxs.com/*',
  '*://*.rubiconproject.com/*',
  '*://*.pubmatic.com/*',
  '*://*.openx.net/*',
  '*://*.casalemedia.com/*',
  '*://*.moatads.com/*',
  '*://*.adroll.com/*',
  '*://*.advertising.com/*',
  '*://*.scorecardresearch.com/*',
  '*://*.zedo.com/*',
  '*://*.popads.net/*',
  '*://*.adsterra.com/*',
  '*://*.ad-delivery.net/*',
  // Trackers & Telemetry
  '*://*.hotjar.com/*',
  '*://*.clarity.ms/*',
  '*://*.mouseflow.com/*',
  '*://pixel.facebook.com/*',
  '*://*.analytics.yahoo.com/*'
];

const AD_BLOCK_CSS = `
  /* Universal Web & YouTube Ad Hiding (preserves video-ads & player layout containers) */
  ins.adsbygoogle,
  [id^="google_ads"],
  [id^="div-gpt-ad"],
  .ad-container,
  .ad-box,
  .ad-slot,
  .sponsored-content,
  /* YouTube overlay and banner ads only - do NOT hide player layout containers */
  .ytp-ad-overlay-container,
  .ytp-ad-message-container,
  #player-ads,
  ytd-promoted-video-renderer,
  ytd-ad-slot-renderer,
  ytd-display-ad-renderer,
  ytd-in-feed-ad-layout-renderer,
  ytd-banner-promo-renderer,
  #masthead-ad
 {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    max-height: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
`;

const PROTECTION_MODES = {
  light: {
    id: 'light',
    label: 'Light',
    theme: 'aurora',
    adBlock: true,
    cosmeticFilter: false,
    stripReferrer: false,
    retainSessions: true,
    blockThirdPartyCookies: false,
    anonymityShield: false,
    description: 'Filter-list network blocking plus targeted ad scriptlets (removes YouTube video ads). No cosmetic page hiding.'
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    theme: 'eclipse',
    adBlock: true,
    cosmeticFilter: true,
    stripReferrer: false,
    retainSessions: true,
    blockThirdPartyCookies: false,
    anonymityShield: false,
    description: 'Filter-list network blocking, ad scriptlets (YouTube video ads) and cosmetic hiding of leftover ad slots.'
  },
  extra: {
    id: 'extra',
    label: 'Extra',
    theme: 'ember',
    adBlock: true,
    cosmeticFilter: true,
    stripReferrer: true,
    retainSessions: true,
    blockThirdPartyCookies: true,
    anonymityShield: true,
    description: 'Adds cross-origin cookie/referrer restrictions and fingerprinting mitigations. Some sites may need Balanced; this is not anonymity.'
  }
};

let currentMode = 'balanced';
let adBlockActive = true;
let adsBlockedCount = 0;
const trackerActivity = new Map();

function isAdBlockEnabled() {
  return adBlockActive;
}

function setAdBlockEnabled(enabled, app) {
  adBlockActive = Boolean(enabled);
  try {
    if (app) {
      const p = path.join(app.getPath('userData'), 'adblock-toggle.json');
      fs.writeFileSync(p, JSON.stringify({ enabled: adBlockActive }), 'utf8');
    }
  } catch {}
  return adBlockActive;
}

function toggleAdBlock(app) {
  return setAdBlockEnabled(!adBlockActive, app);
}

function loadSavedAdBlockState(app) {
  try {
    if (app) {
      const p = path.join(app.getPath('userData'), 'adblock-toggle.json');
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (typeof data?.enabled === 'boolean') {
          adBlockActive = data.enabled;
        }
      }
    }
  } catch {}
  return adBlockActive;
}

function recordNetworkActivity(details, blocked) {
  if (!Number.isInteger(details?.webContentsId)) return;
  let entry = trackerActivity.get(details.webContentsId);
  if (!entry || details.resourceType === 'mainFrame') {
    let mainHost = '';
    try { mainHost = new URL(details.url).hostname; } catch {}
    entry = { mainHost, crossOriginRequests: 0, blockedRequests: 0 };
    trackerActivity.set(details.webContentsId, entry);
  }
  try {
    const host = new URL(details.url).hostname;
    if (entry.mainHost && host !== entry.mainHost) entry.crossOriginRequests++;
  } catch {}
  if (blocked) entry.blockedRequests++;
}

function getTrackerActivity(webContentsId) {
  const entry = trackerActivity.get(webContentsId);
  return entry ? { crossOriginRequests: entry.crossOriginRequests, blockedRequests: entry.blockedRequests } : { crossOriginRequests: 0, blockedRequests: 0 };
}

function getProtectionSettings(mode = currentMode) {
  return PROTECTION_MODES[mode] || PROTECTION_MODES.balanced;
}

function setProtectionMode(mode, app) {
  if (!PROTECTION_MODES[mode]) {
    throw new TypeError(`Invalid protection mode: ${mode}`);
  }
  currentMode = mode;
  try {
    if (app) {
      const p = path.join(app.getPath('userData'), 'protection-mode.json');
      fs.writeFileSync(p, JSON.stringify({ mode: currentMode }), 'utf8');
    }
  } catch {}
  return currentMode;
}

function loadSavedProtectionMode(app) {
  try {
    if (app) {
      const p = path.join(app.getPath('userData'), 'protection-mode.json');
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (data && PROTECTION_MODES[data.mode]) {
          currentMode = data.mode;
        }
      }
    }
  } catch {}
  return currentMode;
}

function applyProtectionToSession(browserSession, pageUrl = () => null) {
  const config = getProtectionSettings(currentMode);
  const crossOrigin=details=>{try{const top=pageUrl(details.webContentsId)||details.initiator||details.referrer||details.frame?.url;if(!top)return false;return new URL(top).origin!==new URL(details.url).origin;}catch{return false;}};
  const removeHeaders=(headers,names)=>{for(const key of Object.keys(headers))if(names.includes(key.toLowerCase()))delete headers[key];};

  // 1. Request Interception (Ad & Tracker Blocking)
  browserSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (adBlockActive && config.adBlock && adblockEngine.available()) {
      // Filter lists (EasyList/EasyPrivacy/uBlock). Video streams and main-frame navigations are never blocked.
      let verdict = null;
      try { verdict = adblockEngine.matchRequest(details); } catch {}
      if (verdict) { adsBlockedCount++; recordNetworkActivity(details, true); return callback(verdict); }
      recordNetworkActivity(details, false);
      return callback({ cancel: false });
    }
    if (adBlockActive && config.adBlock) {
      // Fallback built-in list when the engine cannot load.
      const url = details.url.toLowerCase();
      // Compatibility exception: keep video/ad playback contracts intact on YouTube.
      // This is intentionally not advertised as undetectable video-ad blocking.
      const youtube=value=>{try{const host=new URL(value).hostname;return host==="youtube.com"||host.endsWith(".youtube.com")}catch{return false}};
      if(youtube(details.url)||youtube(details.referrer)||youtube(details.initiator)||youtube(pageUrl(details.webContentsId))){recordNetworkActivity(details,false);return callback({cancel:false});}

      const isAd = AD_BLOCK_PATTERNS.some(pat => {
        if (!pat.includes('*')) return url.includes(pat);
        const regexStr = '^' + pat.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
        try {
          return new RegExp(regexStr, 'i').test(url);
        } catch {
          return url.includes(pat.replace(/\*/g, ''));
        }
      });

      if (isAd) {
        adsBlockedCount++;
        recordNetworkActivity(details, true);
        return callback({ cancel: true });
      }
    }
    recordNetworkActivity(details, false);
    callback({ cancel: false });
  });

  // 2. Privacy & Anti-Tracking Header Controls
  browserSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = privacyHeaders(details.requestHeaders, undefined, details.url);
    const isGoogleAuth = isGoogleAuthUrl(details.url);

    const isMainFrame = details.resourceType === 'mainFrame' || details.resourceType === 'main_frame';
    if (!isGoogleAuth) {
      if (config.stripReferrer && !isMainFrame && crossOrigin(details)) removeHeaders(requestHeaders, ['referer']);
      if (config.blockThirdPartyCookies && !isMainFrame && crossOrigin(details)) removeHeaders(requestHeaders, ['cookie']);

      // Strip client hint tracking in Extra mode
      if (currentMode === 'extra') {
        removeHeaders(requestHeaders, ['sec-ch-ua-model', 'sec-ch-ua-platform-version']);
      }
    }

    callback({ requestHeaders });
  });

  // 3. Cookie Management (Extra Mode: block 3rd-party cookies while keeping 1st-party logins)
  browserSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    const isMainFrame = details.resourceType === 'mainFrame' || details.resourceType === 'main_frame';
    const isGoogleAuth = isGoogleAuthUrl(details.url);

    if (!isGoogleAuth && config.blockThirdPartyCookies && !isMainFrame && crossOrigin(details)) {
      removeHeaders(responseHeaders, ['set-cookie']);
    }
    if (!isGoogleAuth && adBlockActive && config.adBlock) { try { adblockEngine.applyCsp(details, responseHeaders); } catch {} }

    callback({ responseHeaders });
  });

  // 4. Cosmetic styles + scriptlets through the engine preload (gated live by the current settings).
  try {
    adblockEngine.attachCosmetics(browserSession, () => {
      const live = getProtectionSettings(currentMode);
      return { scripts: adBlockActive && !!live.adBlock, styles: adBlockActive && !!live.adBlock && !!live.cosmeticFilter };
    });
  } catch (error) { console.error('[blackout] cosmetic filters unavailable', error?.message || error); }
}

const pageStyles=new WeakMap(),styleJobs=new WeakMap();
function injectAdShield(webContents){
 const task=(styleJobs.get(webContents)||Promise.resolve()).catch(()=>{}).then(async()=>{
  if(webContents.isDestroyed?.())return;
  const old=pageStyles.get(webContents);if(old){await webContents.removeInsertedCSS(old).catch(()=>{});pageStyles.delete(webContents);}
  const config=getProtectionSettings(currentMode);if(!adBlockActive||!config.adBlock||!config.cosmeticFilter)return;
  try{const h=new URL(webContents.getURL()).hostname;if(h==="youtube.com"||h.endsWith(".youtube.com"))return;}catch{}
  const key=await webContents.insertCSS(AD_BLOCK_CSS).catch(()=>null);if(key)pageStyles.set(webContents,key);
 });styleJobs.set(webContents,task);return task;
}

module.exports = {
  PROTECTION_MODES,
  AD_BLOCK_PATTERNS,
  getProtectionSettings,
  setProtectionMode,
  loadSavedProtectionMode,
  isAdBlockEnabled,
  setAdBlockEnabled,
  toggleAdBlock,
  loadSavedAdBlockState,
  applyProtectionToSession,
  injectAdShield,
  recordNetworkActivity,
  getTrackerActivity,
  getAdsBlockedCount: () => adsBlockedCount,
  getCurrentProtectionMode: () => currentMode,
  getAdblockEngineInfo: () => ({ available: adblockEngine.available(), ...(adblockEngine.info() || {}) })
};
