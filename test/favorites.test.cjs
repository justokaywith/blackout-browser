const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { normalizeFavorite, readFavorites, writeFavorites, MAX_FAVORITES } = require('../electron/favorites.cjs');

test('normalizes a safe web favorite', () => {
  const item = normalizeFavorite({ title: '  Pactuno  ', url: 'https://pactuno.online/path', color: '#9a7aff' }, { id: 'fav-1', now: 123 });
  assert.deepEqual(item, { id: 'fav-1', title: 'Pactuno', url: 'https://pactuno.online/path', color: '#9a7aff', createdAt: 123, lastOpenedAt: null });
});

test('rejects dangerous protocols and oversized values', () => {
  assert.throws(() => normalizeFavorite({ title: 'Bad', url: 'javascript:alert(1)' }), /web address/i);
  assert.throws(() => normalizeFavorite({ title: 'x'.repeat(121), url: 'https://example.com' }), /title/i);
});

test('corrupt favorites files fall back to an empty list', () => {
  const dir = fs.mkdtempSync(path.join(__dirname, '.tmp-favorites-'));
  const file = path.join(dir, 'favorites.json');
  fs.writeFileSync(file, '{broken');
  assert.deepEqual(readFavorites(file), []);
});

test('writes favorites atomically and enforces the collection limit', () => {
  const dir = fs.mkdtempSync(path.join(__dirname, '.tmp-favorites-'));
  const file = path.join(dir, 'favorites.json');
  const items = Array.from({ length: MAX_FAVORITES }, (_, index) => normalizeFavorite({ title: `Site ${index}`, url: `https://example.com/${index}` }, { id: `fav-${index}`, now: index }));
  writeFavorites(file, items);
  assert.equal(readFavorites(file).length, MAX_FAVORITES);
  assert.throws(() => writeFavorites(file, [...items, items[0]]), /limit/i);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});

test('modal API and lifecycle hooks are wired in main and preload', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  assert.match(preload, /modal:\s*\(open\)\s*=>/);
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
  assert.match(main, /browser:modal/);
  assert.match(main, /modalOpen/);
});

test('bookmarks bar APIs, UI elements, and right-click context menu are wired', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  assert.match(preload, /setBookmarksBar:\s*\(visible\)\s*=>/);
  assert.match(preload, /bookmarkContextMenu:\s*\(item\)\s*=>/);

  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
  assert.match(main, /bookmarksBarVisible/);
  assert.match(main, /browser:set-bookmarks-bar/);
  assert.match(main, /browser:bookmark-context-menu/);

  const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8');
  assert.match(html, /id="bookmarks-bar"/);
  assert.match(html, /id="bookmarks-list"/);
  assert.match(html, /id="menu-toggle-bookmarks"/);

  const css = fs.readFileSync(path.join(__dirname, '..', 'ui', 'style.css'), 'utf8');
  assert.match(css, /\.bookmarks-bar/);
  assert.match(css, /\.bookmark-item/);
  assert.match(css, /\.has-bookmarks-bar\s+\.chrome/);

  const js = fs.readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8');
  assert.match(js, /toggleBookmarksBar/);
  assert.match(js, /bookmarkContextMenu/);
});
