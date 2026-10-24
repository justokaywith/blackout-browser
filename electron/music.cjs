/**
 * Blackout Browser - Universal Internet Music Search & Streaming Engine
 * Provides FULL SONGS under 6 minutes from YouTube & global streaming networks.
 */

async function searchYouTubeMusic(query, limit = 30) {
  const q = query.trim();
  const searchQueries = [
    q,
    `${q} audio`,
    `${q} song`,
    `${q} music`
  ];

  const searchUrls = [...new Set(searchQueries)].map(
    term => `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`
  );

  const results = [];
  const seenIds = new Set();

  const fetchPromises = searchUrls.map(async (url) => {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return [];
      const html = await res.text();
      const m = html.match(/ytInitialData = (\{.+?\});<\/script>/);
      if (!m) return [];

      let data;
      try {
        data = JSON.parse(m[1]);
      } catch {
        return [];
      }

      const found = [];
      const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

      for (const sec of sections) {
        const items = sec?.itemSectionRenderer?.contents || [];
        for (const item of items) {
          const v = item?.videoRenderer;
          if (!v || !v.videoId) continue;

          const title = v.title?.runs?.map(r => r.text).join('') || v.title?.simpleText || 'Untitled';
          const durationStr = v.lengthText?.simpleText || '';
          if (!durationStr) continue;

          const parts = durationStr.split(':').map(Number);
          let durationSec = 0;
          if (parts.length === 2) {
            durationSec = parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }

          // Rule: anything over 6 minutes is NOT music (max 360s), minimum 30s
          if (durationSec > 360 || durationSec < 30) continue;

          const artist = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'YouTube Music';
          const thumbnail = v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;
          const cleanTitle = title
            .replace(/\s*\(Official (Music )?Video\)/gi, '')
            .replace(/\s*\[Official (Music )?Video\]/gi, '')
            .replace(/\s*\(Official Audio\)/gi, '')
            .replace(/\s*\[Official Audio\]/gi, '')
            .replace(/\s*\(Lyric Video\)/gi, '')
            .replace(/\s*\[Lyrics?\]/gi, '')
            .trim();

          found.push({
            id: 'yt_' + v.videoId,
            videoId: v.videoId,
            title: cleanTitle,
            artist,
            album: 'YouTube Music',
            cover: thumbnail,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            duration: durationSec,
            durationFormatted: durationStr,
            live: false,
            source: 'YOUTUBE',
            type: 'FULL SONG'
          });
        }
      }
      return found;
    } catch {
      return [];
    }
  });

  const batches = await Promise.allSettled(fetchPromises);
  for (const b of batches) {
    if (b.status === 'fulfilled' && Array.isArray(b.value)) {
      for (const item of b.value) {
        if (!seenIds.has(item.videoId)) {
          seenIds.add(item.videoId);
          results.push(item);
          if (results.length >= limit) break;
        }
      }
    }
    if (results.length >= limit) break;
  }

  return results;
}

async function searchAudiusMusic(query, limit = 6) {
  try {
    const res = await fetch(`https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=BlackoutBrowser`, {
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data || [];
    const list = [];
    for (const t of data) {
      if (!t.id || !t.duration) continue;
      // Rule: anything over 6 minutes is NOT music (max 360s), minimum 30s
      if (t.duration > 360 || t.duration < 30) continue;

      const durM = Math.floor(t.duration / 60);
      const durS = Math.floor(t.duration % 60);
      list.push({
        id: 'aud_' + t.id,
        title: t.title || 'Untitled Track',
        artist: t.user?.name || 'Audius Creator',
        album: 'Audius',
        cover: t.artwork?.['150x150'] || t.artwork?.['480x480'] || '',
        url: `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=BlackoutBrowser`,
        duration: t.duration,
        durationFormatted: `${String(durM).padStart(2, '0')}:${String(durS).padStart(2, '0')}`,
        live: false,
        source: 'AUDIUS',
        type: 'FULL SONG'
      });
      if (list.length >= limit) break;
    }
    return list;
  } catch {
    return [];
  }
}

async function searchMusic(query) {
  if (!query || typeof query !== 'string') return [];
  const q = query.trim();
  if (!q) return [];
  const qLower = q.toLowerCase();

  // 1. Direct audio stream link support
  if (/^https?:\/\//i.test(q)) {
    try {
      const urlObj = new URL(q);
      const filename = urlObj.pathname.split('/').pop() || 'Web Audio Stream';
      const cleanTitle = decodeURIComponent(filename.replace(/\.[a-z0-9]+$/i, '') || 'Live Web Stream');
      return [{
        id: 'direct_' + Date.now(),
        title: cleanTitle,
        artist: urlObj.hostname,
        album: 'Direct Stream',
        cover: '',
        url: q,
        duration: 0,
        durationFormatted: 'LIVE',
        live: !/\.(mp3|m4a|aac|ogg|wav|flac)($|\?)/i.test(q),
        source: 'DIRECT STREAM',
        type: 'WEB STREAM'
      }];
    } catch {}
  }

  // 2. Fetch full songs from YouTube (primary master catalog) and Audius
  const [ytResults, audiusResults] = await Promise.all([
    searchYouTubeMusic(q, 30),
    searchAudiusMusic(q, 8)
  ]);

  const results = [];
  const seenTitles = new Set();

  for (const item of [...ytResults, ...audiusResults]) {
    // Enforce 6-minute ceiling strictly
    if (item.duration > 360 || (item.duration > 0 && item.duration < 30)) continue;

    const key = `${(item.artist || '').toLowerCase().trim()} - ${(item.title || '').toLowerCase().trim()}`;
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      results.push(item);
    }
  }

  // Rank matches: exact match on title or artist first
  results.sort((a, b) => {
    const aTitleMatch = a.title.toLowerCase().includes(qLower);
    const bTitleMatch = b.title.toLowerCase().includes(qLower);
    const aArtistMatch = a.artist.toLowerCase().includes(qLower);
    const bArtistMatch = b.artist.toLowerCase().includes(qLower);

    const aScore = (aTitleMatch ? 2 : 0) + (aArtistMatch ? 1 : 0);
    const bScore = (bTitleMatch ? 2 : 0) + (bArtistMatch ? 1 : 0);
    return bScore - aScore;
  });

  return results.slice(0, 30);
}

module.exports = { searchMusic, searchYouTubeMusic };
