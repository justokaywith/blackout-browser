const test = require('node:test');
const assert = require('node:assert/strict');
const { parseWireGuardConfig } = require('../electron/wireguard.cjs');
const { FINGERPRINT_SHIELD_SCRIPT } = require('../electron/anonymity.cjs');

test('parses standard WireGuard configuration text', () => {
  const sample = `
    [Interface]
    PrivateKey = aaaaabbbbbcccccdddddeeeeefffff=
    Address = 10.14.0.2/16
    DNS = 1.1.1.1

    [Peer]
    PublicKey = 111112222233333444445555566666=
    Endpoint = 198.51.100.1:51820
    AllowedIPs = 0.0.0.0/0
    PersistentKeepalive = 25
  `;

  const parsed = parseWireGuardConfig(sample);
  assert.equal(parsed.privateKey, 'aaaaabbbbbcccccdddddeeeeefffff=');
  assert.equal(parsed.address, '10.14.0.2/16');
  assert.equal(parsed.publicKey, '111112222233333444445555566666=');
  assert.equal(parsed.endpoint, '198.51.100.1:51820');
  assert.equal(parsed.persistentKeepalive, '25');
});

test('rejects empty or corrupt WireGuard configurations', () => {
  assert.throws(() => parseWireGuardConfig(''));
  assert.throws(() => parseWireGuardConfig('random noise with no keys'));
});

test('anonymity shield contains canvas and webgl protection hooks', () => {
  assert.match(FINGERPRINT_SHIELD_SCRIPT, /HTMLCanvasElement\.prototype\.toDataURL/);
  assert.match(FINGERPRINT_SHIELD_SCRIPT, /CanvasRenderingContext2D\.prototype\.getImageData/);
  assert.match(FINGERPRINT_SHIELD_SCRIPT, /UNMASKED_VENDOR_WEBGL/);
  assert.match(FINGERPRINT_SHIELD_SCRIPT, /hardwareConcurrency/);
});
