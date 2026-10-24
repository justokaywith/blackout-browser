const DEFINITIONS = Object.freeze({
  standard: Object.freeze({ mode: 'standard', partition: 'persist:blackout-standard', persistent: true }),
  incognito: Object.freeze({ mode: 'incognito', partition: 'blackout-incognito', persistent: false })
});

function profileDefinition(mode) {
  const profile = DEFINITIONS[mode];
  if (!profile) throw new TypeError(`Unknown browser profile: ${mode}`);
  return profile;
}

function shouldClearProfileOnClose(mode, remainingWindows) {
  profileDefinition(mode);
  if (!Number.isInteger(remainingWindows) || remainingWindows < 0) {
    throw new TypeError('remainingWindows must be a non-negative integer');
  }
  return mode === 'incognito' && remainingWindows === 0;
}

module.exports = { profileDefinition, shouldClearProfileOnClose };
