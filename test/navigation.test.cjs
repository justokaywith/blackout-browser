const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTarget } = require('../electron/navigation.cjs');

test('bare domains are upgraded to HTTPS', () => {
  assert.equal(normalizeTarget('example.com'), 'https://example.com/');
  assert.equal(normalizeTarget('http://example.com/path'), 'https://example.com/path');
});

test('search phrases go to DuckDuckGo by default, and support configured engines', () => {
  assert.equal(normalizeTarget('privacy browser'), 'https://duckduckgo.com/?q=privacy%20browser');
  assert.equal(normalizeTarget('privacy browser', 'google'), 'https://www.google.com/search?q=privacy%20browser');
  assert.equal(normalizeTarget('privacy browser', 'brave'), 'https://search.brave.com/search?q=privacy%20browser');
  assert.equal(normalizeTarget('privacy browser', 'bing'), 'https://www.bing.com/search?q=privacy%20browser');
  assert.equal(normalizeTarget('privacy browser', 'ecosia'), 'https://www.ecosia.org/search?q=privacy%20browser');
  assert.equal(normalizeTarget('privacy browser', 'startpage'), 'https://www.startpage.com/sp/search?query=privacy%20browser');
});

test('dangerous schemes and embedded credentials are rejected', () => {
  for (const value of ['javascript:alert(1)', 'file:///C:/Windows/win.ini', 'data:text/html,hello', 'https://user:pass@example.com']) {
    assert.throws(() => normalizeTarget(value));
  }
});

test('email addresses and handles are treated as search queries', () => {
  assert.equal(normalizeTarget('user@example.com'), 'https://duckduckgo.com/?q=user%40example.com');
  assert.equal(normalizeTarget('support@pactuno.online', 'google'), 'https://www.google.com/search?q=support%40pactuno.online');
});

test('empty, oversized and control-character inputs are rejected', () => {
  assert.throws(() => normalizeTarget(''));
  assert.throws(() => normalizeTarget('x'.repeat(2049)));
  assert.throws(() => normalizeTarget('https://example.com/\nattack'));
});
