const {privacyHeaders}=require('./browser-identity.cjs');
const fs = require('node:fs');
const path = require('node:path');

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
  #masthead-ad {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    max-height: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
`;

const AD_SKIP_SCRIPT = `
(function() {
  if (window.__blackout_ad_shield_active) return;
  window.__blackout_ad_shield_active = true;
  let adVideo = null;
  let originalMuted = false;
  let originalRate = 1;

  function handleYouTubeAds() {
    try {
      const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      if (!player) return;

      const isAd = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
      if (isAd) {
        // 1. Safe native skip if exposed by player engine
        if (typeof player.skipAd === 'function') {
          try { player.skipAd(); } catch(e) {}
        }

        // 2. Click skip buttons as soon as visible
        const skipSelectors = [
          '.ytp-ad-skip-button',
          '.ytp-ad-skip-button-modern',
          '.ytp-skip-ad-button',
          '.ytp-ad-overlay-close-button',
          'button.ytp-ad-skip-button-icon',
          '.ytp-ad-skip-button-slot button',
          '.ytp-ad-skip-button-container button',
          '[class*="ytp-ad-skip-button"]'
        ];
        for (const sel of skipSelectors) {
          const btn = player.querySelector(sel);
          if (btn && typeof btn.click === 'function') {
            try { btn.click(); return; } catch(e) {}
          }
        }

        // 3. For unskippable ads, safely advance without corrupting MediaSource buffers
        const video = player.querySelector('video');
        if (video) {
          if (adVideo !== video) {
            adVideo = video;
            originalMuted = video.muted;
            originalRate = video.playbackRate;
          }
          video.muted = true;
          if (Number.isFinite(video.duration) && video.duration > 0 && video.duration < 120) {
            // Keep at least 0.2s before EOS to prevent MediaSource decoder crash
            if (video.currentTime < video.duration - 0.25) {
              try { video.currentTime = video.duration - 0.25; } catch(e) {}
            }
          }
          if (video.playbackRate < 8) {
            try { video.playbackRate = 8; } catch(e) {}
          }
        }
      } else {
        // Reset playback rate once ad has completed
        const video = player.querySelector('video');
        if (adVideo) {
          try { adVideo.muted = originalMuted; adVideo.playbackRate = originalRate; } catch(e) {}
          adVideo = null;
        }
      }
    } catch(e) {}
  }

  setInterval(handleYouTubeAds, 250);
})();
`;

const PROTECTION_MODES = {
  light: {
    id: 'light',
    label: 'Light',
    theme: 'aurora',
    adBlock: true,
    stripReferrer: false,
    retainSessions: true,
    blockThirdPartyCookies: false,
    anonymityShield: false,
    description: 'Standard browsing with full compatibility and default web storage.'
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    theme: 'eclipse',
    adBlock: true,
    stripReferrer: false,
    retainSessions: true,
    blockThirdPartyCookies: false,
    anonymityShield: false,
    description: 'Secure browsing with active Ad Blocking for YouTube and web pages.'
  },
  extra: {
    id: 'extra',
    label: 'Extra',
    theme: 'ember',
    adBlock: true,
    stripReferrer: true,
    retainSessions: true,
    blockThirdPartyCookies: true,
    anonymityShield: true,
    description: 'Hardened privacy & anti-tracking. Retains your logins and active sessions safely.'
  }
};

let currentMode = 'balanced';
let adsBlockedCount = 0;
const trackerActivity = new Map();

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

function applyProtectionToSession(browserSession) {
  const config = getProtectionSettings(currentMode);

  // 1. Request Interception (Ad & Tracker Blocking)
  browserSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (config.adBlock) {
      const url = details.url.toLowerCase();
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
    const requestHeaders = privacyHeaders(details.requestHeaders);

    const isMainFrame = details.resourceType === 'mainFrame' || details.resourceType === 'main_frame';
    if (config.stripReferrer && !isMainFrame) {
      try {
        const reqOrigin = new URL(details.url).origin;
        const refOrigin = details.referrer ? new URL(details.referrer).origin : '';
        if (reqOrigin !== refOrigin) {
          delete requestHeaders['Referer'];
          delete requestHeaders['referer'];
        }
      } catch {}
    }

    // Strip client hint tracking in Extra mode
    if (currentMode === 'extra') {
      delete requestHeaders['Sec-CH-UA-Model'];
      delete requestHeaders['Sec-CH-UA-Platform-Version'];
    }

    callback({ requestHeaders });
  });

  // 3. Cookie Management (Extra Mode: block 3rd-party cookies while keeping 1st-party logins)
  browserSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    const isMainFrame = details.resourceType === 'mainFrame' || details.resourceType === 'main_frame';

    if (config.blockThirdPartyCookies && !isMainFrame) {
      try {
        const reqHost = new URL(details.url).hostname;
        const mainHost = details.frame ? new URL(details.frame.url || details.url).hostname : reqHost;
        const isThirdParty = !reqHost.endsWith(mainHost) && !mainHost.endsWith(reqHost);

        if (isThirdParty) {
          // Block setting 3rd party tracking cookies
          delete responseHeaders['set-cookie'];
          delete responseHeaders['Set-Cookie'];
        }
      } catch {}
    }

    callback({ responseHeaders });
  });
}

function injectAdShield(webContents) {
  const config = getProtectionSettings(currentMode);
  if (!config.adBlock) return;

  webContents.insertCSS(AD_BLOCK_CSS).catch(() => {});
  webContents.executeJavaScript(AD_SKIP_SCRIPT).catch(() => {});
}

module.exports = {
  PROTECTION_MODES,
  AD_BLOCK_PATTERNS,
  getProtectionSettings,
  setProtectionMode,
  loadSavedProtectionMode,
  applyProtectionToSession,
  injectAdShield,
  recordNetworkActivity,
  getTrackerActivity,
  getAdsBlockedCount: () => adsBlockedCount,
  getCurrentProtectionMode: () => currentMode
};
