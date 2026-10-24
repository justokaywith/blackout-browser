const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('offline Play prioritizes downloaded YouTube audio over stale online state', async () => {
  const nodes = new Map();
  let played = 0, remote = 0;
  const local = { id: 'a', videoId: 'jNQXAC9IVRw', title: 'Downloaded', hasLocalAudio: true, cachedUrl: 'blackout://app/music-cache/a.m4a' };
  function node() { return { src: '', value: '', hidden: true, style: { setProperty() {} }, handlers: {}, classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(name, handler) { this.handlers[name] = handler; }, append() {}, appendChild() {}, replaceChildren() {}, setAttribute() {},
    getAttribute(name) { return this[name]; }, pause() { this.paused = true; }, play() { played++; this.paused = false; return Promise.resolve(); } }; }
  const document = { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); }, querySelectorAll: () => [],
    createElement: node, createTextNode: x => x, addEventListener() {}, documentElement: { style: { setProperty() {} } } };
  const offline = () => { remote++; throw new Error('Network offline'); };
  const scope = { document, navigator: { onLine: false }, localStorage: { getItem: () => null, setItem() {} }, crypto: { randomUUID: () => 'list' }, Date, console,
    setTimeout, setInterval() {}, window: { blackout: { onState() {}, getUiAppearance: async () => ({}), getMusicFavorites: async () => [local],
      getMusicState: async () => ({ track: { id: 'a', videoId: local.videoId }, playlist: [{ id: 'a', videoId: local.videoId }], isPlaying: false }),
      musicPlay: offline, musicResume: offline, musicStatus: offline } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../ui/music-popup.js'), 'utf8'), scope);
  await new Promise(resolve => setImmediate(resolve));
  await document.querySelector('#music-play').handlers.click({ stopPropagation() {} });
  assert.equal(played, 1);
  assert.equal(document.querySelector('#universal-audio-player').src, local.cachedUrl);
  assert.equal(remote, 0);
});

test('music popup opens at DOM ready without waiting for remote assets', () => {
  const main = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf8');
  const source = main.slice(main.indexOf('function showMusicPopup('), main.indexOf('\nfunction installKeyboardShortcuts('));
  let ready, shown = false;
  class BrowserWindow {
    constructor() { this.webContents = { once(name, handler) { if (name === 'dom-ready') ready = handler; } }; }
    on() {} isDestroyed() { return false; } show() { shown = true; }
    loadURL() { throw new Error('Popup must not navigate through the network stack'); }
    loadFile(file) { assert.equal(path.basename(file), 'music-popup.html'); return new Promise(() => {}); }
  }
  const scope = { BrowserWindow, session: { fromPartition() {} }, path, __dirname: 'electron', closeSiteInfoPopup() {}, closeMenuPopup() {}, setTimeout };
  vm.runInNewContext(source, scope);
  scope.showMusicPopup({ window: { getContentBounds: () => ({ x: 0, y: 0, width: 1000 }) }, bookmarksBarVisible: true });
  assert.equal(typeof ready, 'function');
  ready();
  assert.equal(shown, true);
});
