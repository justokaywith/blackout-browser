const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_HISTORY = 1000;
const MAX_FILE_BYTES = 1024 * 1024; // 1 MB

function normalizeHistoryItem(input, options = {}) {
  if (!input || typeof input !== 'object') throw new Error('History item is required.');
  let rawUrl = String(input.url || '').trim();
  if (!rawUrl) throw new Error('URL is required.');
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
    rawUrl = 'https://' + rawUrl;
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('History entry needs a valid web address.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS history items are tracked.');
  }

  const title = String(input.title || url.hostname || 'Untitled').trim().slice(0, 300);
  const visitedAt = Number.isFinite(input.visitedAt) ? input.visitedAt : (options.now ?? Date.now());
  const id = String(input.id || options.id || randomUUID());

  return {
    id,
    title,
    url: url.toString(),
    hostname: url.hostname,
    visitedAt
  };
}

function readHistory(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const stat = fs.statSync(file);
    if (stat.size > MAX_FILE_BYTES) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) return [];
    return data.slice(0, MAX_HISTORY).map(item => normalizeHistoryItem(item));
  } catch {
    return [];
  }
}

function writeHistory(file, items) {
  if (!Array.isArray(items)) throw new Error('History items must be an array.');
  const trimmed = items.slice(0, MAX_HISTORY);
  const normalized = trimmed.map(item => normalizeHistoryItem(item));
  const body = JSON.stringify(normalized, null, 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, body, { mode: 0o600 });
  fs.renameSync(temp, file);
  return normalized;
}

function recordHistoryEntry(file, entry) {
  try {
    const norm = normalizeHistoryItem(entry);
    const existing = readHistory(file);
    // If the top item has the same URL within 15 seconds, just update its title/timestamp
    if (existing.length > 0 && existing[0].url === norm.url && (norm.visitedAt - existing[0].visitedAt) < 15000) {
      existing[0].visitedAt = norm.visitedAt;
      if (norm.title && norm.title !== norm.hostname) {
        existing[0].title = norm.title;
      }
      return writeHistory(file, existing);
    }
    existing.unshift(norm);
    return writeHistory(file, existing);
  } catch {
    return [];
  }
}

function deleteHistoryEntry(file, id) {
  try {
    const existing = readHistory(file);
    const filtered = existing.filter(item => item.id !== id);
    return writeHistory(file, filtered);
  } catch {
    return [];
  }
}

function clearHistoryFile(file) {
  try {
    return writeHistory(file, []);
  } catch {
    return [];
  }
}

module.exports = {
  MAX_HISTORY,
  normalizeHistoryItem,
  readHistory,
  writeHistory,
  recordHistoryEntry,
  deleteHistoryEntry,
  clearHistoryFile
};
