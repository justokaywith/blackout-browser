// Blackout Browser Chrome Extension Manager
const fs = require('node:fs');
const path = require('node:path');

function getExtensionsStoragePath(app) {
  return path.join(app.getPath('userData'), 'installed-extensions.json');
}

function readInstalledExtensionPaths(app) {
  try {
    const file = getExtensionsStoragePath(app);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch {}
  return [];
}

function writeInstalledExtensionPaths(app, paths) {
  try {
    const file = getExtensionsStoragePath(app);
    fs.writeFileSync(file, JSON.stringify(paths, null, 2), 'utf8');
  } catch {}
}

async function loadPersistedExtensions(session, app) {
  const paths = readInstalledExtensionPaths(app);
  const loaded = [];
  for (const extPath of paths) {
    try {
      if (fs.existsSync(extPath)) {
        const ext = await session.loadExtension(extPath, { allowFileAccess: true });
        loaded.push(ext);
      }
    } catch (e) {
      console.warn(`Failed to restore extension from ${extPath}:`, e.message);
    }
  }
  return loaded;
}

async function installUnpackedExtension(session, app, extensionPath) {
  const resolved = path.resolve(extensionPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('Extension directory does not exist.');
  }

  const manifestPath = path.join(resolved, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json not found in the selected folder.');
  }

  const ext = await session.loadExtension(resolved, { allowFileAccess: true });
  const current = readInstalledExtensionPaths(app);
  if (!current.includes(resolved)) {
    current.push(resolved);
    writeInstalledExtensionPaths(app, current);
  }

  return {
    id: ext.id,
    name: ext.name,
    version: ext.version,
    path: resolved
  };
}

async function uninstallExtension(session, app, id) {
  const all = session.getAllExtensions();
  const target = all.find(e => e.id === id);
  if (target) {
    await session.removeExtension(id);
    const current = readInstalledExtensionPaths(app);
    const updated = current.filter(p => p !== target.path);
    writeInstalledExtensionPaths(app, updated);
    return true;
  }
  return false;
}

function listActiveExtensions(session) {
  const all = session.getAllExtensions ? session.getAllExtensions() : [];
  return all.map(ext => {
    let manifest = {};
    try {
      const manifestPath = path.join(ext.path, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      }
    } catch {}

    const popup = manifest.action?.default_popup || manifest.browser_action?.default_popup || '';
    const popupUrl = popup ? `chrome-extension://${ext.id}/${popup}` : '';

    let iconDataUrl = '';
    try {
      const icons = manifest.icons || manifest.action?.default_icon;
      let iconRel = '';
      if (typeof icons === 'string') iconRel = icons;
      else if (icons && typeof icons === 'object') iconRel = icons['32'] || icons['48'] || icons['16'] || icons['128'] || '';
      if (iconRel) {
        const fullIconPath = path.join(ext.path, iconRel);
        if (fs.existsSync(fullIconPath)) {
          const extName = path.extname(fullIconPath).toLowerCase();
          const mime = extName === '.svg' ? 'image/svg+xml' : 'image/png';
          iconDataUrl = `data:${mime};base64,${fs.readFileSync(fullIconPath).toString('base64')}`;
        }
      }
    } catch {}

    return {
      id: ext.id,
      name: ext.name || manifest.name || 'Extension',
      version: ext.version || manifest.version || '1.0',
      description: manifest.description || '',
      url: ext.url || `chrome-extension://${ext.id}/`,
      path: ext.path,
      popup,
      popupUrl,
      iconDataUrl
    };
  });
}

let activeExtensionPopup = null;

function openExtensionPopup(BrowserWindow, context, extensionId, anchorBounds) {
  if (activeExtensionPopup && !activeExtensionPopup.isDestroyed()) {
    activeExtensionPopup.close();
    activeExtensionPopup = null;
  }
  const extensions = listActiveExtensions(context.browserSession);
  const ext = extensions.find(e => e.id === extensionId);
  if (!ext || !ext.popupUrl) return false;

  const parentBounds = context.window.getBounds();
  const width = 380;
  const height = 520;

  let posX = parentBounds.x + parentBounds.width - width - 24;
  if (anchorBounds && Number.isFinite(anchorBounds.x)) {
    posX = parentBounds.x + anchorBounds.x - Math.floor(width / 2);
    if (posX + width > parentBounds.x + parentBounds.width - 12) {
      posX = parentBounds.x + parentBounds.width - width - 12;
    }
    if (posX < parentBounds.x + 12) {
      posX = parentBounds.x + 12;
    }
  }
  let posY = parentBounds.y + (context.bookmarksBarVisible ? 118 : 86);
  if (anchorBounds && Number.isFinite(anchorBounds.bottom)) {
    posY = parentBounds.y + anchorBounds.bottom + 6;
  }

  const popupWin = new BrowserWindow({
    width,
    height,
    x: Math.round(posX),
    y: Math.round(posY),
    frame: false,
    resizable: false,
    parent: context.window,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      session: context.browserSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  popupWin.loadURL(ext.popupUrl).catch(() => {});
  popupWin.once('ready-to-show', () => popupWin.show());
  popupWin.on('blur', () => {
    if (!popupWin.isDestroyed()) popupWin.close();
  });
  activeExtensionPopup = popupWin;
  return true;
}

module.exports = {
  loadPersistedExtensions,
  installUnpackedExtension,
  uninstallExtension,
  listActiveExtensions,
  openExtensionPopup
};
