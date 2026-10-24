const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('playlist creation, adding songs, persistence, repeat selection and deletion', async () => {
  const nodes = new Map();
  function node() {
    return { value: '', hidden: true, textContent: '', children: [], style: { setProperty() {} },
      classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {},
      append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); },
      replaceChildren() { this.children = []; }, setAttribute() {}, pause() {}, play() { return Promise.resolve(); } };
  }
  const document = {
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); },
    querySelectorAll() { return []; }, createElement: node, createTextNode: text => text,
    addEventListener() {}, documentElement: { style: { setProperty() {} } }
  };
  const storage = new Map();
  const track = { id: 'song-1', url: 'https://example.test/song.mp3', title: 'Song One' };
  const context = { document, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    window: { blackout: { getUiAppearance: async () => ({ theme: 'ember' }), getMusicFavorites: async () => [track, { id: 'song-2', title: 'Song Two', url: 'https://example.test/two.mp3' }], getMusicState: async () => ({ track, playlist: [track] }), onState() {} } },
    crypto: { randomUUID: () => 'list-1' }, console, setInterval() {}, setTimeout() {}, Date };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../ui/music-popup.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  const get = selector => document.querySelector(selector);
  get('#playlist-name').value = 'Evening';
  get('#playlist-create').onclick();
  get('#playlist-add').onclick();
  get('#playlist-add').onclick();
  let saved = JSON.parse(storage.get('blackout-playlists-v1'));
  assert.equal(saved.lists[0].name, 'Evening');
  assert.equal(saved.lists[0].tracks.length, 1, 'duplicate songs are excluded');
  get('#playlist-add-all').onclick();
  saved = JSON.parse(storage.get('blackout-playlists-v1'));
  assert.equal(saved.lists[0].tracks.length, 2, 'favorites can be added without playing each song');
  get('#playlist-repeat').onchange({ target: { value: 'all' } });
  saved = JSON.parse(storage.get('blackout-playlists-v1'));
  assert.equal(saved.repeat, 'all');
  get('#playlist-delete').onclick();
  assert.equal(JSON.parse(storage.get('blackout-playlists-v1')).lists.length, 0);
});
