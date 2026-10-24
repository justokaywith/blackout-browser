const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { shortcutAction } = require('../electron/keyboard.cjs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../electron/main.cjs'), 'utf8');
const handlerSource = source.slice(source.indexOf('function installKeyboardShortcuts('), source.indexOf('\nfunction getCleanUserAgent'));

for (const chromeFocused of [true, false]) {
  test(`refresh targets the active page and preserves tabs with chrome focus=${chromeFocused}`, () => {
    let normal = 0, hard = 0;
    const tab = { id: 'a', view: { webContents: { reload() { normal++; }, reloadIgnoringCache() { hard++; } } } };
    const context = { activeTab: tab, tabs: new Map([['a', tab], ['b', { id: 'b' }]]) };
    let handler;
    const contents = { on(name, fn) { handler = fn; } };
    const scope = { shortcutAction };
    vm.runInNewContext(handlerSource, scope);
    scope.installKeyboardShortcuts(contents, context, chromeFocused);
    for (const input of [
      { key: 'r', control: true, shift: true }, { key: 'F5', control: true }, { key: 'F5', shift: true }
    ]) {
      let prevented = false;
      handler({ preventDefault() { prevented = true; } }, { type: 'keyDown', ...input });
      assert.equal(prevented, true);
    }
    handler({ preventDefault() {} }, { type: 'keyDown', key: 'r', control: true });
    assert.equal(hard, 3);
    assert.equal(normal, 1);
    assert.equal(context.tabs.size, 2);
    assert.equal(context.activeTab, tab);
  });
}
