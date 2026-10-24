const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('extensions button has SVG icon and dropdown menu with pinning container', () => {
  const html = read('ui/index.html');
  assert.match(html, /id="pinned-extensions"/);
  assert.match(html, /id="extensions-menu"/);
  assert.match(html, /id="extensions-button"[^>]*><svg/);
  assert.match(html, /id="menu-manage-extensions"/);
});

test('preload exposes extensions openPopup and openTab APIs', () => {
  const preload = read('electron/preload.cjs');
  assert.match(preload, /openPopup:\s*\(id,\s*bounds\)\s*=>/);
  assert.match(preload, /openTab:\s*\(id\)\s*=>/);
});

test('main process wires extensions open-popup and open-tab IPC handlers', () => {
  const main = read('electron/main.cjs');
  assert.match(main, /extensions:open-popup/);
  assert.match(main, /extensions:open-tab/);
  assert.match(main, /openExtensionPopup/);
});

test('extensions and protection popups have external scripts and valid CSP', () => {
  const extHtml = read('ui/extensions-popup.html');
  assert.match(extHtml, /<script src="extensions-popup\.js"><\/script>/);
  assert.ok(fs.existsSync(path.join(root, 'ui/extensions-popup.js')));

  const protHtml = read('ui/protection-popup.html');
  assert.match(protHtml, /<script src="protection-popup\.js"><\/script>/);
  assert.ok(fs.existsSync(path.join(root, 'ui/protection-popup.js')));

  const main = read('electron/main.cjs');
  assert.match(main, /'\/(?:extensions-popup\.js)'/);
  assert.match(main, /'\/(?:protection-popup\.js)'/);
  assert.match(main, /script-src 'self' 'unsafe-inline'/);
});
