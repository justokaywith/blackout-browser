const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('crash reporter module exists and exports expected functions', () => {
  const reporterCode = read('electron/crash-reporter.cjs');
  assert.match(reporterCode, /initCrashReporter/);
  assert.match(reporterCode, /showCrashReportWindow/);
  assert.match(reporterCode, /support@pactuno\.online/);
  assert.match(reporterCode, /formatDiagnosticReport/);
  assert.match(reporterCode, /saveCrashLog/);
});

test('crash report UI has email action to support@pactuno.online', () => {
  const html = read('ui/crash-report.html');
  assert.match(html, /support@pactuno\.online/);
  assert.match(html, /btn-email/);
  assert.match(html, /btn-copy/);
  assert.match(html, /btn-restart/);
  assert.match(html, /Blackout Browser Crash Report/);
});

test('preload exposes reportCrash API', () => {
  const preload = read('electron/preload.cjs');
  assert.match(preload, /reportCrash:\s*\(data\)\s*=>/);
});

test('installer configures desktop shortcut to actual user desktop', () => {
  const installerMain = read('installer/main.cjs');
  assert.match(installerMain, /GetFolderPath\('Desktop'\)/);
  assert.match(installerMain, /CommonDesktop/);
  assert.match(installerMain, /createDesktopShortcut/);
  assert.doesNotMatch(installerMain, /HarisRana/);
  assert.doesNotMatch(read('installer/ui/installer.js'), /C:\\\\Users\\\\HarisRana/);
});

test('installer does not auto-dismiss on successful installation', () => {
  const installerJs = read('installer/ui/installer.js');
  assert.doesNotMatch(installerJs, /setTimeout\(\(\)\s*=>\s*\{\s*window\.installer\.launch/);
});
