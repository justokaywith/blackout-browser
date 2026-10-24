const test = require('node:test');
const assert = require('node:assert/strict');
const { profileDefinition, shouldClearProfileOnClose } = require('../electron/profiles.cjs');

test('standard windows use one persistent profile shared across app restarts', () => {
  assert.deepEqual(profileDefinition('standard'), {
    mode: 'standard', partition: 'persist:blackout-standard', persistent: true
  });
});

test('incognito windows use a distinct in-memory profile', () => {
  assert.deepEqual(profileDefinition('incognito'), {
    mode: 'incognito', partition: 'blackout-incognito', persistent: false
  });
});

test('only closing the last incognito window clears its profile', () => {
  assert.equal(shouldClearProfileOnClose('standard', 0), false);
  assert.equal(shouldClearProfileOnClose('incognito', 1), false);
  assert.equal(shouldClearProfileOnClose('incognito', 0), true);
});

test('unknown profile modes are rejected', () => {
  assert.throws(() => profileDefinition('private-ish'), /Unknown browser profile/);
  assert.throws(() => shouldClearProfileOnClose('private-ish', 0), /Unknown browser profile/);
});

test('invalid remaining window counts are rejected instead of triggering cleanup', () => {
  for (const count of [-1, 1.5, NaN, '0', null]) {
    assert.throws(() => shouldClearProfileOnClose('incognito', count), /remainingWindows/);
  }
});
