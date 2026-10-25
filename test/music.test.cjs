const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { searchMusic } = require('../electron/music.cjs');

test('searchMusic returns formatted matches for direct audio URL', async () => {
  const direct = await searchMusic('https://example.com/audio/song.mp3');
  assert.equal(direct.length, 1);
  assert.equal(direct[0].url, 'https://example.com/audio/song.mp3');
  assert.equal(direct[0].artist, 'example.com');
  assert.equal(direct[0].type, 'WEB STREAM');
});

test('searchMusic handles empty or non-string queries gracefully', async () => {
  assert.deepEqual(await searchMusic(''), []);
  assert.deepEqual(await searchMusic('   '), []);
  assert.deepEqual(await searchMusic(null), []);
});

test('preload exposes searchMusic and main registers browser:search-music', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  assert.match(preload, /searchMusic:\s*\(query\)\s*=>\s*ipcRenderer\.invoke\('browser:search-music',\s*query\)/);

  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
  assert.match(main, /ipcMain\.handle\('browser:search-music'/);
  assert.match(main, /require\('\.\/music\.cjs'\)/);
});

test('searchMusic enforces 6-minute maximum duration limit for songs', async () => {
  const results = await searchMusic('Phir milenge');
  assert.ok(Array.isArray(results));
  for (const song of results) {
    if (song.duration) {
      assert.ok(song.duration <= 360, `Song "${song.title}" is ${song.duration}s, which exceeds 6 minutes (360s)`);
    }
  }
});

test('closing browser window destroys background music engine and triggers clean app quit', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
  assert.match(main, /destroyBackgroundMusic\(\)/);
  assert.match(main, /window\.on\('close'/);
  assert.match(main, /window\.on\('closed'/);
  assert.match(main, /terminateAppImmediately\(\)/);
});

test('music favorites module manages liking, storage, and caching', async () => {
  const tmpDir = path.join(__dirname, `.tmp-fav-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const mockApp = { getPath: () => tmpDir };
  const favModule = require('../electron/music-favorites.cjs');
  favModule.initMusicFavorites(mockApp);

  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': 6001 });
    const audio = Buffer.alloc(6001, 7);
    audio.write('ID3');
    response.end(audio);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const sample = {
    id: 'test_song_1',
    title: 'Cosmic Drift',
    artist: 'Pactuno Sound',
    duration: 180,
    type: 'HQ AUDIO',
    url: `http://127.0.0.1:${port}/cosmic-drift.mp3`
  };

  assert.equal(favModule.isMusicFavorited('test_song_1'), false);
  const toggleRes = favModule.toggleMusicFavorite(sample);
  assert.equal(toggleRes.favorited, true);
  assert.equal(favModule.isMusicFavorited('test_song_1'), true);

  const favorites = favModule.readFavorites();
  assert.equal(favorites.length, 1);
  assert.equal(favorites[0].title, 'Cosmic Drift');

  const cacheRes = await favModule.cacheMusicTrack(sample);
  assert.equal(cacheRes.success, true);
  assert.equal(cacheRes.cached, true);

  const updatedFavorites = favModule.readFavorites();
  assert.equal(updatedFavorites[0].isCached, true);
  assert.ok(updatedFavorites[0].cachedUrl.includes('blackout://app/music-cache/'));
  // Restarting the browser must retain a valid cache file instead of deleting it.
  favModule.initMusicFavorites(mockApp);
  assert.equal(favModule.readFavorites()[0].isCached, true);
  // Historical cache files could be HTML watch pages with an .mp3 extension.
  fs.writeFileSync(path.join(tmpDir, 'music-cache', cacheRes.track.cachedFile), '<!DOCTYPE html>' + 'x'.repeat(7000));
  assert.equal(favModule.readFavorites()[0].isCached, false, 'HTML must never count as downloaded audio');

  // Toggle again to remove
  const untoggleRes = favModule.toggleMusicFavorite(sample);
  assert.equal(untoggleRes.favorited, false);
  assert.equal(favModule.isMusicFavorited('test_song_1'), false);

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  await new Promise(resolve => server.close(resolve));
});

test('YouTube entries are never labelled as offline cached without an audio file', async () => {
  const tmpDir = path.join(__dirname, `.tmp-youtube-cache-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const favModule = require('../electron/music-favorites.cjs');
  favModule.initMusicFavorites({ getPath: () => tmpDir });
  const result = await favModule.cacheMusicTrack({
    id: 'yt_abc1234', videoId: 'abc1234', title: 'Streaming only',
    url: 'https://www.youtube.com/watch?v=abc1234'
  });
  assert.equal(result.success, false);
  assert.equal(result.cached, false);
  assert.match(result.error, /YouTube/);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test('music popup and main UI include favorites star, cache, and library views', () => {
  const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'ui', 'music-popup.html'), 'utf8');
  assert.match(popupHtml, /id="song-star-btn"/);
  assert.match(popupHtml, /id="song-cache-btn"/);
  assert.match(popupHtml, /id="music-library-panel"/);
  assert.match(popupHtml, /id="music-tab-toggle"/);

  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8');
  assert.match(indexHtml, /data-settings-target="music-library"/);
  assert.match(indexHtml, /data-settings-section="music-library"/);
  assert.match(indexHtml, /id="settings-music-list"/);

  const preload = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  assert.match(preload, /getMusicFavorites:/);
  assert.match(preload, /toggleMusicFavorite:/);
  assert.match(preload, /cacheMusicTrack:/);
});

