const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { localAudioResponse } = require('../electron/local-audio.cjs');
test('offline audio is served from disk with correct type, range and no fetch', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blackout-offline-'));
  const file = path.join(dir, 'song.m4a');
  fs.writeFileSync(file, Buffer.from('0123456789'));
  const previous = global.fetch;
  global.fetch = () => { throw new Error('Network is offline'); };
  try {
    const response = localAudioResponse(new Request('https://local.test', { headers: { range: 'bytes=2-5' } }), file);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-type'), 'audio/mp4');
    assert.equal(response.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await response.text(), '2345');
    const full = localAudioResponse(new Request('https://local.test'), file);
    assert.equal(await full.text(), '0123456789');
    assert.equal(localAudioResponse(new Request('https://local.test', { headers: { range: 'bytes=20-' } }), file).status, 416);
  } finally { global.fetch = previous; fs.rmSync(dir, { recursive: true, force: true }); }
});
