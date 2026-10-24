function shortcutAction(input) {
  if (!input || input.type !== 'keyDown') return null;
  const key = String(input.key || '').toLowerCase();
  const modifier = input.control === true || input.meta === true;
  if (modifier && input.shift === true && key === 'n') return 'new-incognito';
  if (modifier && input.shift === true && key === 't') return 'reopen-closed-tab';
  if (modifier && input.shift === true && key === 'b') return 'toggle-bookmarks-bar';
  if (modifier && input.shift === true && key === 'p') return 'toggle-pip';
  if (modifier && input.shift === true && key === 'r') return 'hard-reload';
  if (modifier && input.shift !== true) {
    if (key === 'l' || key === 'k') return 'focus-address';
    if (key === 't') return 'new-tab';
    if (key === 'w') return 'close-tab';
    if (key === 'r') return 'reload';
    if (key === 'h') return 'history';
    if (key === 'j') return 'downloads';
    if (key === 'd') return 'bookmark-page';
    if (key === 'tab') return 'next-tab';
    if (key === '+' || key === '=') return 'zoom-in';
    if (key === '-' || key === '_') return 'zoom-out';
    if (key === '0') return 'zoom-reset';
  }
  if (modifier && input.shift === true && key === 'tab') return 'previous-tab';
  if (input.alt === true && input.control !== true && input.meta !== true) {
    if (key === 'arrowleft') return 'back';
    if (key === 'arrowright') return 'forward';
    if (key === 'p') return 'toggle-pip';
  }
  if (!modifier && input.shift === true && key === 'f5') return 'hard-reload';
  if (modifier && key === 'f5') return 'hard-reload';
  if (!modifier && key === 'f5') return 'reload';
  if (!modifier && key === 'f11') return 'toggle-fullscreen';
  return null;
}

module.exports = { shortcutAction };
