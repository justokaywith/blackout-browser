const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const { pipeline } = require('node:stream/promises');
const { downloadYouTubeAudio } = require('./music-downloader.cjs');

let userDataPath = '';
let favoritesFilePath = '';
let musicCacheDirPath = '';

function validAudioFile(file) {
  let fd;
  try {
    if (fs.statSync(file).size <= 5000) return false;
    fd = fs.openSync(file, 'r');
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, header.length, 0);
    return header.toString('ascii', 0, 3) === 'ID3' ||
      (header[0] === 0xff && (header[1] & 0xe0) === 0xe0) ||
      ['OggS', 'fLaC', 'RIFF'].includes(header.toString('ascii', 0, 4)) ||
      header.toString('ascii', 4, 8) === 'ftyp' || header.readUInt32BE(0) === 0x1a45dfa3;
  } catch { return false; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

function initMusicFavorites(app) {
  userDataPath = app.getPath('userData');
  favoritesFilePath = path.join(userDataPath, 'music-favorites.json');
  musicCacheDirPath = path.join(userDataPath, 'music-cache');

  if (!fs.existsSync(musicCacheDirPath)) {
    try {
      fs.mkdirSync(musicCacheDirPath, { recursive: true });
    } catch (e) {
      console.error('Failed to create music-cache directory:', e);
    }
  } else {
    // Clean up empty/corrupt files only. The old 50 KB cutoff deleted valid
    // short tracks and test clips on the next launch, which made offline cache
    // appear to work until Blackout restarted.
    try {
      const files = fs.readdirSync(musicCacheDirPath);
      for (const f of files) {
        const fp = path.join(musicCacheDirPath, f);
        try {
          if (fs.statSync(fp).size < 5000) {
            fs.unlinkSync(fp);
          }
        } catch {}
      }
    } catch {}
  }

  if (!fs.existsSync(favoritesFilePath)) {
    try {
      fs.writeFileSync(favoritesFilePath, JSON.stringify([]), 'utf8');
    } catch (e) {
      console.error('Failed to initialize music-favorites.json:', e);
    }
  }
}

function readFavorites() {
  if (!favoritesFilePath || !fs.existsSync(favoritesFilePath)) return [];
  try {
    const raw = fs.readFileSync(favoritesFilePath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(item => {
      const cacheFilename = item.cachedFile || `${item.id || item.videoId}.mp3`;
      const cachePath = path.join(musicCacheDirPath, cacheFilename);
      const altCachePath = item.videoId ? path.join(musicCacheDirPath, `${item.videoId}.webm`) : null;
      const hasRealAudioFile = validAudioFile(cachePath) || Boolean(altCachePath && validAudioFile(altCachePath));
      const activeFilename = (altCachePath && validAudioFile(altCachePath)) ? `${item.videoId}.webm` : cacheFilename;
      // A cached flag in JSON is not enough: the local audio file is the source
      // of truth. This prevents stale entries claiming offline availability.
      const isCached = hasRealAudioFile;
      return {
        ...item,
        isCached,
        hasLocalAudio: hasRealAudioFile,
        cachedFile: isCached ? activeFilename : null,
        cachedUrl: isCached ? `blackout://app/music-cache/${activeFilename}` : null
      };
    });
  } catch {
    return [];
  }
}

function writeFavorites(list) {
  if (!favoritesFilePath) return;
  try {
    fs.writeFileSync(favoritesFilePath, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write music favorites:', e);
  }
}

function normalizeTrack(raw) {
  if (!raw) return null;
  const id = raw.id || (raw.videoId ? `yt_${raw.videoId}` : `track_${Date.now()}`);
  return {
    id,
    videoId: raw.videoId || '',
    title: raw.title || 'Untitled Song',
    artist: raw.artist || 'Web Artist',
    album: raw.album || '',
    cover: raw.cover || (raw.videoId ? `https://i.ytimg.com/vi/${raw.videoId}/mqdefault.jpg` : ''),
    duration: Number(raw.duration) || 0,
    durationFormatted: raw.durationFormatted || '',
    url: raw.url || (raw.videoId ? `https://www.youtube.com/watch?v=${raw.videoId}` : ''),
    type: raw.type || 'HQ AUDIO',
    isCached: Boolean(raw.isCached),
    cachedFile: raw.cachedFile || null,
    addedAt: raw.addedAt || Date.now()
  };
}

function isMusicFavorited(idOrVideoId) {
  if (!idOrVideoId) return false;
  const list = readFavorites();
  return list.some(item => item.id === idOrVideoId || item.videoId === idOrVideoId);
}

function toggleMusicFavorite(rawTrack) {
  if (!rawTrack) return { favorited: false, favorites: readFavorites() };
  const targetId = rawTrack.id || (rawTrack.videoId ? `yt_${rawTrack.videoId}` : '');
  const targetVideoId = rawTrack.videoId || '';

  const list = readFavorites();
  const existingIdx = list.findIndex(item => (targetId && item.id === targetId) || (targetVideoId && item.videoId === targetVideoId));

  let favorited = false;
  let track = null;

  if (existingIdx >= 0) {
    // Remove from favorites
    const removed = list.splice(existingIdx, 1)[0];
    favorited = false;
    track = removed;
  } else {
    // Add to favorites
    track = normalizeTrack(rawTrack);
    list.unshift(track);
    favorited = true;
  }

  writeFavorites(list);
  return { favorited, track, favorites: readFavorites() };
}

async function downloadFile(sourceUrl, destPath, isLive = false) {
  let referer = 'https://pixabay.com/';
  try { referer = new URL(sourceUrl).origin + '/'; } catch {}

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': referer,
    'Accept': 'audio/*, */*',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive'
  };

  try {
    const res = await fetch(sourceUrl, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(45000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentLength = Number(res.headers.get('content-length')) || 0;
    if (/html|json|text\//i.test(res.headers.get('content-type') || '')) throw new Error('The source returned a web page instead of audio.');
    if (isLive) throw new Error('Live radio cannot be downloaded as a complete song.');
    if (contentLength > 100 * 1024 * 1024) throw new Error('Audio exceeds the 100 MB download limit.');
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 5000) throw new Error('Downloaded file too small');
    fs.writeFileSync(destPath, Buffer.from(buf));
    if (!validAudioFile(destPath)) throw new Error('The downloaded file is not recognized audio.');
    return destPath;
  } catch (err) {
    try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch {}
    throw err;
  }
}

/**
 * Cache music track locally for instantaneous 0-second offline playback
 */
async function cacheMusicTrack(rawTrack) {
  if (!rawTrack) throw new Error('No track provided');
  const track = normalizeTrack(rawTrack);
  const cacheFilename = track.videoId ? `${track.videoId}.m4a` : `${track.id}.mp3`;
  const destPath = path.join(musicCacheDirPath, cacheFilename);

  // If already cached on disk and valid audio size (>5KB)
  if (validAudioFile(destPath)) {
    track.isCached = true;
    track.hasLocalAudio = true;
    track.cachedFile = cacheFilename;
    track.cachedUrl = `blackout://app/music-cache/${cacheFilename}`;

    const list = readFavorites();
    const idx = list.findIndex(item => item.id === track.id || (track.videoId && item.videoId === track.videoId));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...track };
    } else {
      list.unshift(track);
    }
    writeFavorites(list);
    return { success: true, track, cached: true };
  }

  // YouTube watch pages are HTML pages, not downloadable audio files. Marking
  // one as cached produced a fake offline state. Offline downloads are only
  // offered for direct, authorized audio streams.
  if (track.videoId || /youtube\.com|youtu\.be/i.test(track.url || '')) {
    try {
      await downloadYouTubeAudio(track.videoId, destPath);
      if (!validAudioFile(destPath)) throw new Error('The source did not return playable audio.');
      const downloaded = { ...track, isCached: true, hasLocalAudio: true, cachedFile: cacheFilename, cachedUrl: `blackout://app/music-cache/${cacheFilename}` };
      const list = readFavorites();
      const index = list.findIndex(item => item.id === track.id || item.videoId === track.videoId);
      if (index >= 0) list[index] = downloaded;
      else list.unshift(downloaded);
      writeFavorites(list);
      return { success: true, track: downloaded, cached: true };
    } catch (error) {
      return { success: false, track, cached: false, error: `YouTube download failed: ${error.message}` };
    }
  }

  // 1. Direct, non-DRM audio stream download
  if (track.url && /^https?:\/\//i.test(track.url)) {
    try {
      await downloadFile(track.url, destPath, Boolean(rawTrack.live));
      if (validAudioFile(destPath)) {
        track.isCached = true;
        track.hasLocalAudio = true;
        track.cachedFile = cacheFilename;
        track.cachedUrl = `blackout://app/music-cache/${cacheFilename}`;

        const list = readFavorites();
        const idx = list.findIndex(item => item.id === track.id || (track.videoId && item.videoId === track.videoId));
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...track };
        } else {
          list.unshift(track);
        }
        writeFavorites(list);
        return { success: true, track, cached: true };
      }
    } catch (err) {
      console.warn('Stream cache download failed:', err);
    }
  }

  // 2. Fallback: only mark cached if file actually exists on disk
  const hasFile = validAudioFile(destPath);
  if (!hasFile) {
    return { success: false, track, cached: false, error: 'Could not download audio. The stream may require browser playback.' };
  }
  track.isCached = true;
  track.hasLocalAudio = true;
  track.cachedFile = cacheFilename;
  track.cachedUrl = `blackout://app/music-cache/${cacheFilename}`;

  const list = readFavorites();
  const idx = list.findIndex(item => item.id === track.id || (track.videoId && item.videoId === track.videoId));
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...track };
  } else {
    list.unshift(track);
  }
  writeFavorites(list);
  return { success: true, track, cached: true };
}

function removeCachedMusic(idOrVideoId) {
  if (!idOrVideoId) return false;
  const list = readFavorites();
  const item = list.find(t => t.id === idOrVideoId || t.videoId === idOrVideoId);
  if (item && item.cachedFile) {
    const filePath = path.join(musicCacheDirPath, item.cachedFile);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
    item.isCached = false;
    item.cachedFile = null;
    writeFavorites(list);
    return true;
  }
  return false;
}

module.exports = {
  initMusicFavorites,
  readFavorites,
  writeFavorites,
  isMusicFavorited,
  toggleMusicFavorite,
  cacheMusicTrack,
  removeCachedMusic
};
