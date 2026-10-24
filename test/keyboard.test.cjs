const test = require('node:test');
const assert = require('node:assert/strict');
const { shortcutAction } = require('../electron/keyboard.cjs');

test('maps common browser shortcuts to safe browser actions', () => {
  assert.equal(shortcutAction({ type: 'keyDown', key: 'l', control: true }), 'focus-address');
  assert.equal(shortcutAction({ type: 'keyDown', key: 't', control: true }), 'new-tab');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'w', control: true }), 'close-tab');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'r', control: true }), 'reload');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'r', control: true, shift: true }), 'hard-reload');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'F5', control: true }), 'hard-reload');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'F5', shift: true }), 'hard-reload');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'ArrowLeft', alt: true }), 'back');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'ArrowRight', alt: true }), 'forward');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'F5' }), 'reload');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'n', control: true, shift: true }), 'new-incognito');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'b', control: true, shift: true }), 'toggle-bookmarks-bar');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'b', meta: true, shift: true }), 'toggle-bookmarks-bar');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'p', control: true, shift: true }), 'toggle-pip');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'p', alt: true }), 'toggle-pip');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'j', control: true }), 'downloads');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'd', control: true }), 'bookmark-page');
  assert.equal(shortcutAction({ type: 'keyDown', key: 't', control: true, shift: true }), 'reopen-closed-tab');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'Tab', control: true }), 'next-tab');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'Tab', control: true, shift: true }), 'previous-tab');
  assert.equal(shortcutAction({ type: 'keyDown', key: '+', control: true }), 'zoom-in');
  assert.equal(shortcutAction({ type: 'keyDown', key: '0', control: true }), 'zoom-reset');
  assert.equal(shortcutAction({ type: 'keyDown', key: 'F11' }), 'toggle-fullscreen');
});

test('supports Command shortcuts on macOS and ignores unrelated or key-up events', () => {
  assert.equal(shortcutAction({ type: 'keyDown', key: 'l', meta: true }), 'focus-address');
  assert.equal(shortcutAction({ type: 'keyDown', key: 't', control: true, shift: true }), 'reopen-closed-tab');
  assert.equal(shortcutAction({ type: 'keyUp', key: 'l', control: true }), null);
  assert.equal(shortcutAction({ type: 'keyDown', key: 'x', control: true }), null);
  assert.equal(shortcutAction({ type: 'keyDown', key: 'ArrowLeft', alt: true, control: true }), null);
});
