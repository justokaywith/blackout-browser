const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_FAVORITES = 48;
const MAX_FILE_BYTES = 256 * 1024;

function normalizeFavorite(input, options = {}) {
  if (!input || typeof input !== 'object') throw new Error('Favorite is required.');
  const title = String(input.title || '').trim();
  if (!title || title.length > 120) throw new Error('Favorite title must be 1–120 characters.');
  let rawUrl = String(input.url || '').trim();
  if (rawUrl && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
    rawUrl = 'https://' + rawUrl;
  }
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Favorite needs a valid web address.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Favorite needs a safe HTTP or HTTPS web address.');
  const color = /^#[0-9a-f]{6}$/i.test(String(input.color || '')) ? String(input.color).toLowerCase() : null;
  const createdAt = Number.isFinite(input.createdAt) ? input.createdAt : (options.now ?? Date.now());
  const lastOpenedAt = Number.isFinite(input.lastOpenedAt) ? input.lastOpenedAt : null;
  const id = String(input.id || options.id || randomUUID());
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Favorite identifier is invalid.');
  return { id, title, url: url.toString(), color, createdAt, lastOpenedAt };
}

function readFavorites(file) {
  try {
    const stat = fs.statSync(file);
    if (stat.size > MAX_FILE_BYTES) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data) || data.length > MAX_FAVORITES) return [];
    return data.map(item => normalizeFavorite(item));
  } catch { return []; }
}

function writeFavorites(file, items) {
  if (!Array.isArray(items) || items.length > MAX_FAVORITES) throw new Error(`Favorites limit is ${MAX_FAVORITES}.`);
  const normalized = items.map(item => normalizeFavorite(item));
  const body = JSON.stringify(normalized, null, 2);
  if (Buffer.byteLength(body) > MAX_FILE_BYTES) throw new Error('Favorites data is too large.');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, body, { mode: 0o600 });
  fs.renameSync(temp, file);
  return normalized;
}

module.exports = { MAX_FAVORITES, normalizeFavorite, readFavorites, writeFavorites };
