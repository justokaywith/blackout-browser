const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  normalizeHistoryItem,
  readHistory,
  writeHistory,
  recordHistoryEntry,
  deleteHistoryEntry,
  clearHistoryFile,
  MAX_HISTORY
} = require('../electron/history.cjs');
const { shortcutAction } = require('../electron/keyboard.cjs');

test('normalizeHistoryItem normalizes valid http and https urls', () => {
  const item = normalizeHistoryItem({ url: 'https://example.com/test', title: 'Example Title' });
  assert.equal(item.url, 'https://example.com/test');
  assert.equal(item.title, 'Example Title');
  assert.equal(item.hostname, 'example.com');
  assert.ok(item.id);
  assert.ok(typeof item.visitedAt === 'number');
});

test('normalizeHistoryItem rejects empty or non-http protocols', () => {
  assert.throws(() => normalizeHistoryItem({ url: '' }));
  assert.throws(() => normalizeHistoryItem({ url: 'blackout://settings' }));
  assert.throws(() => normalizeHistoryItem({ url: 'javascript:alert(1)' }));
});

test('readHistory, writeHistory, and recordHistoryEntry operate atomically with persistence', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blackout-hist-test-'));
  const file = path.join(tmpDir, 'history.json');

  assert.deepEqual(readHistory(file), []);

  recordHistoryEntry(file, { url: 'https://site1.com', title: 'Site 1' });
  recordHistoryEntry(file, { url: 'https://site2.com', title: 'Site 2' });

  let list = readHistory(file);
  assert.equal(list.length, 2);
  assert.equal(list[0].url, 'https://site2.com/');
  assert.equal(list[1].url, 'https://site1.com/');

  // Coalesce duplicate navigation to same URL within 15 seconds
  recordHistoryEntry(file, { url: 'https://site2.com', title: 'Site 2 Updated' });
  list = readHistory(file);
  assert.equal(list.length, 2);
  assert.equal(list[0].title, 'Site 2 Updated');

  // Delete entry
  const idToDelete = list[0].id;
  deleteHistoryEntry(file, idToDelete);
  list = readHistory(file);
  assert.equal(list.length, 1);
  assert.equal(list[0].url, 'https://site1.com/');

  // Clear file
  clearHistoryFile(file);
  assert.deepEqual(readHistory(file), []);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('keyboard shortcut maps Ctrl+H to history', () => {
  assert.equal(shortcutAction({ type: 'keyDown', control: true, key: 'h' }), 'history');
  assert.equal(shortcutAction({ type: 'keyDown', meta: true, key: 'H' }), 'history');
});

test('preload exposes history API and ui/index.html includes history sections', () => {
  const preload = fs.readFileSync(path.join(__dirname, '../electron/preload.cjs'), 'utf8');
  assert.match(preload, /history:\s*\(action,\s*payload\)\s*=>/);

  const html = fs.readFileSync(path.join(__dirname, '../ui/index.html'), 'utf8');
  assert.match(html, /data-settings-target="history"/);
  assert.match(html, /data-settings-section="history"/);
  assert.match(html, /id="menu-history"/);
});
