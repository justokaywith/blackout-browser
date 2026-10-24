const { net } = require('electron');
const RELEASE_MANIFEST = 'https://pactuno.online/blackout/releases/latest.json';

function parts(version) {
  return String(version || '').replace(/^v/, '').split('.').map(value => Number(value) || 0);
}

function isNewer(remote, current) {
  const a = parts(remote), b = parts(current);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

async function checkForUpdate(currentVersion) {
  try {
    const url = `${RELEASE_MANIFEST}?_t=${Date.now()}`;
    const response = await net.fetch(url, { redirect: 'follow', cache: 'no-store' });
    if (!response.ok) return null;
    const release = await response.json();
    if (!/^\d+\.\d+\.\d+$/.test(String(release.version || '')) || typeof release.downloadUrl !== 'string') return null;
    const download = new URL(release.downloadUrl);
    if (download.protocol !== 'https:' || download.hostname !== 'pactuno.online') return null;
    return isNewer(release.version, currentVersion)
      ? { version: release.version, downloadUrl: download.href, notes: String(release.notes || '').slice(0, 500) }
      : null;
  } catch {
    return null;
  }
}

module.exports = { RELEASE_MANIFEST, isNewer, checkForUpdate };
