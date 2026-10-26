const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('uses a frameless custom Blackout browser shell', () => {
  const main = read('electron/main.cjs');
  const html = read('ui/index.html');
  assert.match(main, /frame:\s*false/);
  assert.match(html, /data-window-action="minimize"/);
  assert.match(html, /id="app-menu"/);
  assert.doesNotMatch(html, /id="incognito-button"/);
});

test('new tab carries the approved motion system and favorites', () => {
  const html = read('ui/index.html');
  const css = read('ui/style.css');
  assert.match(html, /id="startup-sequence"/);
  assert.match(html, /class="topographic"/);
  assert.match(html, /id="favorites-grid"/);
  assert.match(css, /@keyframes\s+star-fall/);
  assert.match(css, /prefers-reduced-motion/);
});

test('favorites request each saved site favicon and retain an initial fallback', () => {
  const js = read('ui/app.js');
  const main = read('electron/main.cjs');
  assert.match(js, /function favoriteIconUrl/);
  assert.match(js, /blackout:\/\/app\/favicon/);
  assert.match(main, /new URL\('\/favicon\.ico', source\.origin\)/);
  assert.match(js, /iconImage\.onerror/);
  assert.match(js, /favorite-fallback/);
});

test('address security button opens live site data, permissions, and cookie details', () => {
  const js = read('ui/app.js');
  const html = read('ui/index.html');
  const main = read('electron/main.cjs');
  const preload = read('electron/preload.cjs');
  assert.match(js, /site-info-button/);
  assert.match(js, /siteInfoIcon\.replaceWith\(siteInfoButton\)/);
  assert.match(js, /site-info-panel/);
  assert.match(html, /id="site-info-panel"/);
  assert.match(js, /toggleSiteInfoPopup/);
  assert.match(preload, /siteInfo:\s*\(\)\s*=>/);
  assert.match(preload, /toggleSiteInfoPopup:\s*\(\)\s*=>/);
  assert.match(main, /browser:site-info/);
  assert.match(main, /browser:site-info-popup/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /pathname === '\/favicon'/);
  assert.match(main, /new URL\('\/favicon\.ico', source\.origin\)/);
});

test('appearance stores theme surface and motion independently', () => {
  const js = read('ui/app.js');
  assert.match(js, /blackout-appearance/);
  assert.match(js, /surface/);
  assert.match(js, /motion/);
  assert.match(js, /textContent = tab\.title/);
  assert.doesNotMatch(js, /innerHTML\s*=\s*tab\.title/);
});

test('settings exposes the ten approved sections without false protection claims', () => {
  const html = read('ui/index.html');
  for (const id of ['you','appearance','privacy','permissions','search','favorites','downloads','network','system','about']) assert.match(html, new RegExp(`data-settings-target="${id}"`));
  assert.match(html, /Coming in v0\.3/);
  assert.match(html, /Coming in v0\.4/);
  assert.doesNotMatch(html, />Connected</);
});

test('package and visible about copy identify v0.2', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '0.2.34');
  assert.ok(read('ui/index.html').includes('Blackout '+pkg.version));
});

test('image context menu supports download, copy image, copy address, and open in new tab', () => {
  const main = read('electron/main.cjs');
  assert.match(main, /Open image in new tab/);
  assert.match(main, /Save image as…/);
  assert.match(main, /Copy image/);
  assert.match(main, /Copy image address/);
  assert.match(main, /view\.webContents\.downloadURL\((?:imageUrl|params\.srcURL)/);
  assert.match(main, /view\.webContents\.copyImageAt\(params\.x,\s*params\.y\)/);
});

test('top bar includes circular progress downloads button and interactive menu', () => {
  const html = read('ui/index.html');
  const css = read('ui/style.css');
  const js = read('ui/app.js');
  assert.match(html, /id="downloads-button"/);
  assert.match(html, /class="download-progress-ring"/);
  assert.match(html, /id="download-ring-fill"/);
  assert.match(html, /id="downloads-menu"/);
  assert.match(css, /\.downloads-btn\.downloading/);
  assert.match(css, /\.download-progress-ring/);
  assert.match(js, /handleDownloadProgress/);
  assert.match(js, /updateDownloadUI/);
  assert.match(js, /initDownloadsDropdown/);
});

test('top bar, context menu, and injected overlay provide pop-out video player', () => {
  const html = read('ui/index.html');
  const css = read('ui/style.css');
  const js = read('ui/app.js');
  const main = read('electron/main.cjs');
  const preload = read('electron/preload.cjs');
  const pip = read('electron/pip.cjs');

  assert.match(html, /id="pip-button"/);
  assert.match(html, /id="menu-pip"/);
  assert.match(css, /\.pip-btn/);
  assert.match(js, /togglePictureInPicture/);
  assert.match(preload, /togglePictureInPicture/);
  assert.match(main, /browser:toggle-pip/);
  assert.match(main, /Pop out video player \(Picture in picture\)/);
  assert.match(pip, /blackout-pip-pill/);
  assert.match(pip, /requestPictureInPicture/);
});

test('top bar and shell include Universal Music Player controls without a separate mood selector', () => {
  const html = read('ui/index.html');
  const css = read('ui/style.css');
  const js = read('ui/app.js');
  const popupHtml = read('ui/music-popup.html');
  const popupJs = read('ui/music-popup.js');

  assert.match(html, /id="music-button"/);
  assert.match(html, /id="music-player-panel"/);
  assert.match(html, /id="universal-audio-player"/);
  assert.match(html, /id="music-search-input"/);
  assert.doesNotMatch(html, /data-mood=/);
  assert.match(html, /id="music-timeline-track"/);
  assert.match(html, /id="music-timeline-fill"/);
  assert.match(html, /id="music-timeline-thumb"/);
  assert.match(html, /id="music-time-elapsed"/);
  assert.match(html, /id="music-time-duration"/);
  assert.match(html, /id="music-play"/);
  assert.match(html, /id="music-stop"/);
  assert.match(html, /id="music-prev"/);
  assert.match(html, /id="music-next"/);
  assert.match(html, /id="music-volume-slider"/);

  assert.match(css, /\.music-btn/);
  assert.match(css, /\.music-player-panel/);
  assert.match(css, /\.music-timeline-track/);
  assert.match(css, /\.music-timeline-fill/);

  assert.match(js, /initUniversalMusicPlayer/);
  assert.match(js, /updateTimeline/);
  assert.doesNotMatch(popupHtml, /music-mood-bar/);
  assert.match(popupHtml, /mix-blend-mode: soft-light/);
  assert.match(popupJs, /applyBrowserTheme/);
  assert.match(popupJs, /getUiAppearance/);
});


