const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PROTECTION_MODES,
  AD_BLOCK_PATTERNS,
  getProtectionSettings,
  setProtectionMode,
  recordNetworkActivity,
  getTrackerActivity
} = require('../electron/protection.cjs');

test('protection modes have the 3 required options mapped to color profiles', () => {
  assert.equal(PROTECTION_MODES.light.theme, 'aurora');
  assert.equal(PROTECTION_MODES.balanced.theme, 'eclipse');
  assert.equal(PROTECTION_MODES.extra.theme, 'ember');

  assert.equal(PROTECTION_MODES.light.adBlock, true);
  assert.equal(PROTECTION_MODES.balanced.adBlock, true);
  assert.equal(PROTECTION_MODES.extra.adBlock, true);

  // All modes must retain user sessions & logins
  assert.equal(PROTECTION_MODES.light.retainSessions, true);
  assert.equal(PROTECTION_MODES.balanced.retainSessions, true);
  assert.equal(PROTECTION_MODES.extra.retainSessions, true);

  // Extra mode blocks third-party tracking cookies and strips cross-origin referrers
  assert.equal(PROTECTION_MODES.extra.blockThirdPartyCookies, true);
  assert.equal(PROTECTION_MODES.extra.stripReferrer, true);
});

test('ad blocker covers YouTube and web ad delivery endpoints', () => {
  const hasYouTubeAds = AD_BLOCK_PATTERNS.some(p => p.includes('youtube.com'));
  const hasDoubleClick = AD_BLOCK_PATTERNS.some(p => p.includes('doubleclick.net'));
  const hasGoogleAdServices = AD_BLOCK_PATTERNS.some(p => p.includes('googleadservices.com'));

  assert.equal(hasYouTubeAds, true);
  assert.equal(hasDoubleClick, true);
  assert.equal(hasGoogleAdServices, true);
});

test('setProtectionMode validates mode and returns updated config', () => {
  assert.throws(() => setProtectionMode('invalid-mode'), /Invalid protection mode/);
  setProtectionMode('extra');
  const config = getProtectionSettings('extra');
  assert.equal(config.id, 'extra');
  assert.equal(config.theme, 'ember');
  // Reset back to balanced
  setProtectionMode('balanced');
});

test('site information can report cross-origin and blocked network activity without URLs', () => {
  recordNetworkActivity({ webContentsId: 91, resourceType: 'mainFrame', url: 'https://example.com/' }, false);
  recordNetworkActivity({ webContentsId: 91, resourceType: 'script', url: 'https://cdn.example.net/app.js' }, false);
  recordNetworkActivity({ webContentsId: 91, resourceType: 'script', url: 'https://ads.example.org/ad.js' }, true);
  assert.deepEqual(getTrackerActivity(91), { crossOriginRequests: 2, blockedRequests: 1 });
});

test('preload script exposes protection APIs', () => {
  const preloadCode = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  assert.match(preloadCode, /setProtectionMode:\s*\(mode\)\s*=>/);
  assert.match(preloadCode, /getProtectionMode:\s*\(\)\s*=>/);
});

test('UI index.html contains protection pill and menu options', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8');
  assert.match(html, /id="protection-button"/);
  assert.match(html, /id="protection-menu"/);
  assert.match(html, /data-mode="light"/);
  assert.match(html, /data-mode="balanced"/);
  assert.match(html, /data-mode="extra"/);
});
