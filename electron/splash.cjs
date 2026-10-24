/**
 * electron/splash.cjs — First-launch splash screen for Blackout Browser.
 *
 * Shows the atom-death animation in a frameless window, resolves when the
 * animation finishes or the user clicks/presses a key to skip.
 *
 * Usage:
 *   const { showSplashIfFirstLaunch } = require('./splash.cjs');
 *   await showSplashIfFirstLaunch();   // resolves immediately if not first launch
 */

const { BrowserWindow, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

/**
 * Return the path to the first-launch marker.
 * The NSIS installer writes this to  <installDir>/resources/.first-launch.
 * As a fallback for dev / portable builds we also check userData.
 */
function markerPath() {
  // In a packaged app, resources path contains .first-launch from the installer
  const installerMarker = path.join(process.resourcesPath, '.first-launch');
  if (fs.existsSync(installerMarker)) return installerMarker;
  // Fallback: use a userData flag (for dev mode / first-ever run)
  const { app } = require('electron');
  return path.join(app.getPath('userData'), '.first-launch');
}

function isFirstLaunch() {
  const marker = markerPath();
  if (fs.existsSync(marker)) return true;
  // If neither marker exists this is the very first run in dev mode — treat as first launch
  const { app } = require('electron');
  const doneFlag = path.join(app.getPath('userData'), '.splash-shown');
  return !fs.existsSync(doneFlag);
}

function markSplashShown() {
  // Remove installer marker if present
  try { fs.unlinkSync(path.join(process.resourcesPath, '.first-launch')); } catch { /* ignore */ }
  // Write persistent "shown" flag in userData
  const { app } = require('electron');
  const doneFlag = path.join(app.getPath('userData'), '.splash-shown');
  try { fs.writeFileSync(doneFlag, '1', 'utf8'); } catch { /* ignore */ }
}

/**
 * Show the splash screen. Returns a promise that resolves once the splash
 * animation is done (or the user dismissed it).
 */
function showSplash() {
  return new Promise((resolve) => {
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
    const splashW = 800;
    const splashH = 500;

    const win = new BrowserWindow({
      width: splashW,
      height: splashH,
      x: Math.round((screenW - splashW) / 2),
      y: Math.round((screenH - splashH) / 2),
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      backgroundColor: '#090a11',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'splash-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
        webviewTag: false
      }
    });

    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      markSplashShown();
      // Fade is handled by the HTML; give it a moment then destroy
      setTimeout(() => {
        if (!win.isDestroyed()) win.destroy();
        resolve();
      }, 100);
    };

    // Safety timeout — never block the browser from starting for more than 12 s
    const safetyTimer = setTimeout(done, 12000);

    // We don't use ipc handlers — we listen for 'splash:done' on the webContents
    const { ipcMain } = require('electron');
    const handler = () => { clearTimeout(safetyTimer); done(); };
    ipcMain.once('splash:done', handler);

    win.once('closed', () => {
      ipcMain.removeListener('splash:done', handler);
      clearTimeout(safetyTimer);
      if (!resolved) { resolved = true; resolve(); }
    });

    // Load the splash HTML from ui/splash.html
    const splashFile = path.join(__dirname, '..', 'ui', 'splash.html');
    win.loadURL(pathToFileURL(splashFile).toString());
    win.once('ready-to-show', () => win.show());
  });
}

/**
 * Show splash only on first launch, otherwise resolve immediately.
 */
async function showSplashIfFirstLaunch() {
  if (!isFirstLaunch()) return;
  await showSplash();
}

module.exports = { showSplashIfFirstLaunch, showSplash };
