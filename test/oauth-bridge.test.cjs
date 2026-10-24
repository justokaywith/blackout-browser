const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PORT, CALLBACK, HOST, validStart, originExtensionId, createOauthBridge } = require('../electron/oauth-bridge.cjs');

test('OAuth bridge accepts only well-formed extension PKCE starts', () => {
  const extensionId = 'a'.repeat(32);
  const valid = { extensionId, state: 'f'.repeat(64), challenge: 'A'.repeat(43), method: 'pactuno', mode: 'login' };
  assert.equal(validStart(valid), true);
  assert.equal(validStart({ ...valid, extensionId: 'blackout-desktop' }), false);
  assert.equal(validStart({ ...valid, challenge: 'short' }), false);
  assert.equal(validStart({ ...valid, method: 'unknown' }), false);
  assert.equal(originExtensionId(`chrome-extension://${extensionId}`), extensionId);
  assert.equal(originExtensionId('https://evil.example'), '');
  assert.equal(PORT, 48177);
  assert.equal(CALLBACK, 'blackout://auth/callback');
  assert.equal(HOST, 'blackout-desktop');
});

test('OAuth bridge returns a captured callback only to the installed extension origin', async () => {
  const extensionId = 'a'.repeat(32);
  class FakeWindow extends EventEmitter {
    static latest;
    constructor() { super(); this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = () => {}; FakeWindow.latest = this; }
    loadURL(url) { this.url = url; this.emit('ready-to-show'); return Promise.resolve(); }
    show() {}
    isDestroyed() { return false; }
    close() { this.emit('closed'); }
  }
  const bridge = createOauthBridge({ BrowserWindow: FakeWindow, authSession: {}, isExtensionLoaded: id => id === extensionId });
  try {
    await bridge.start();
  } catch (err) {
    if (err.code === 'EADDRINUSE') return;
    throw err;
  }
  try {
    const headers = { Origin: `chrome-extension://${extensionId}`, 'Content-Type': 'application/json' };
    const body = { extensionId, state: 'f'.repeat(64), challenge: 'A'.repeat(43), method: 'email', mode: 'login' };
    const started = await fetch(`http://127.0.0.1:${PORT}/oauth/start`, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(started.status, 201);
    const { requestId } = await started.json();
    const target = new URL(FakeWindow.latest.url);
    assert.equal(target.searchParams.get('client_id'), extensionId);
    assert.equal(target.searchParams.get('redirect_uri'), CALLBACK);
    assert.equal(target.searchParams.get('host'), HOST);
    const event = { prevented: false, preventDefault() { this.prevented = true; } };
    FakeWindow.latest.webContents.emit('will-redirect', event, `${CALLBACK}?code=${'c'.repeat(64)}&state=${body.state}`);
    assert.equal(event.prevented, true);
    const completed = await fetch(`http://127.0.0.1:${PORT}/oauth/result?id=${requestId}`, { headers: { Origin: headers.Origin } });
    assert.equal(completed.status, 200);
    assert.deepEqual(await completed.json(), { code: 'c'.repeat(64), state: body.state });
    const replay = await fetch(`http://127.0.0.1:${PORT}/oauth/result?id=${requestId}`, { headers: { Origin: headers.Origin } });
    assert.equal(replay.status, 404);
  } finally {
    await bridge.stop();
  }
});
