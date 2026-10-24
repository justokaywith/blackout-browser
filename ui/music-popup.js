(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const closeBtn = $('#music-panel-close');
  const playBtn = $('#music-play');
  const playIcon = $('#music-play-icon');
  const stopBtn = $('#music-stop');
  const prevBtn = $('#music-prev');
  const nextBtn = $('#music-next');
  const trackName = $('#music-track-name');
  const trackArtist = $('#music-track-artist');
  const typeBadge = $('#music-type-badge');
  const sourceInfo = $('#music-source-info');
  const statusPill = $('#music-status-pill');
  const timelineTrack = $('#music-timeline-track');
  const timelineFill = $('#music-timeline-fill');
  const timelineThumb = $('#music-timeline-thumb');
  const timeElapsed = $('#music-time-elapsed');
  const timeDuration = $('#music-time-duration');
  const volumeSlider = $('#music-volume-slider');
  const volumeToggle = $('#music-volume-toggle');
  const searchInput = $('#music-search-input');
  const searchBtn = $('#music-search-btn');
  const searchResults = $('#music-results-dropdown');
  const songDisc = $('#song-disc');
  const songDiscCover = $('#song-disc-cover');
  const songDiscCenter = $('#song-disc-center');
  const audio = $('#universal-audio-player');
  const songStarBtn = $('#song-star-btn');
  const songCacheBtn = $('#song-cache-btn');
  const tabToggleBtn = $('#music-tab-toggle');
  const favCountBadge = $('#music-fav-count');
  const libraryPanel = $('#music-library-panel');
  const libBackBtn = $('#lib-back-btn');
  const libCountHeading = $('#lib-count-heading');
  const favoritesList = $('#music-favorites-list');

  let playlist = [];
  let favoriteTracks = [];
  let currentTrack = null;
  let currentIndex = 0;
  let isPlaying = false;
  let isSeeking = false;
  let seekLockUntil = 0;
  let currentTimeSec = 0;
  let durationSec = 0;
  let syncInterval = null;
  let savedLists = [];
  let selectedListId = '';
  let activeListId = '';
  let repeatMode = 'off';
  let advancing = false;
  const trackKey = track => track?.videoId || track?.url || track?.id;
  try {
    const saved = JSON.parse(localStorage.getItem('blackout-playlists-v1') || '{}');
    savedLists = Array.isArray(saved.lists) ? saved.lists.filter(list => list && typeof list.id === 'string' && Array.isArray(list.tracks)) : [];
    selectedListId = saved.selected || savedLists[0]?.id || '';
    repeatMode = ['off', 'all', 'one'].includes(saved.repeat) ? saved.repeat : 'off';
  } catch {}
  const selectedList = () => savedLists.find(list => list.id === selectedListId);
  function saveLists() {
    try {
      localStorage.setItem('blackout-playlists-v1', JSON.stringify({ lists: savedLists, selected: selectedListId, repeat: repeatMode }));
      return true;
    } catch {
      $('#playlist-message').textContent = 'Storage is full. This change could not be saved.';
      return false;
    }
  }
  function renderLists() {
    const select = $('#playlist-select');
    select.replaceChildren();
    for (const list of savedLists) {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = `${list.name} (${list.tracks.length})`;
      select.append(option);
    }
    select.value = selectedListId;
    $('#playlist-repeat').value = repeatMode;
    const list = selectedList();
    const tracks = $('#playlist-tracks');
    tracks.replaceChildren();
    for (const [index, track] of (list?.tracks || []).entries()) {
      const row = document.createElement('li');
      row.append(document.createTextNode(track.title || 'Untitled song'));
      const remove = document.createElement('button');
      remove.textContent = 'Remove';
      remove.onclick = () => { list.tracks.splice(index, 1); saveLists(); renderLists(); };
      row.append(remove);
      tracks.append(row);
    }
    $('#playlist-message').textContent = list ? `${list.tracks.length} songs saved on this device.` : 'Create a playlist, then add songs from the player.';
  }
  $('#playlist-create').onclick = () => {
    const name = $('#playlist-name').value.trim();
    if (!name) { $('#playlist-message').textContent = 'Enter a playlist name first.'; return; }
    if (savedLists.length >= 50) { $('#playlist-message').textContent = 'You can save up to 50 playlists.'; return; }
    const list = { id: crypto.randomUUID(), name, tracks: [] };
    savedLists.push(list); selectedListId = list.id;
    if (saveLists()) { $('#playlist-name').value = ''; renderLists(); }
  };
  $('#playlist-select').onchange = event => { selectedListId = event.target.value; saveLists(); renderLists(); };
  $('#playlist-add').onclick = () => {
    const list = selectedList();
    if (!list || !currentTrack) { $('#playlist-message').textContent = 'Select a playlist and a song first.'; return; }
    if (list.tracks.some(track => trackKey(track) === trackKey(currentTrack))) { $('#playlist-message').textContent = 'This song is already in the list.'; return; }
    if (list.tracks.length >= 200) { $('#playlist-message').textContent = 'A playlist can hold up to 200 songs.'; return; }
    list.tracks.push({ ...currentTrack });
    if (saveLists()) renderLists();
  };
  $('#playlist-play').onclick = () => {
    const list = selectedList();
    if (!list?.tracks.length) { $('#playlist-message').textContent = 'Add songs before playing this list.'; return; }
    activeListId = list.id;
    playlist = list.tracks.map(track => favoriteTracks.find(fav => trackKey(fav) === trackKey(track)) || track);
    currentIndex = 0;
    playSelectedTrack(playlist[0]);
  };
  function addFavoritesToList(tracks) {
    const list = selectedList();
    if (!list) { $('#playlist-message').textContent = 'Create or select a playlist first.'; return; }
    for (const track of tracks) {
      if (list.tracks.length < 200 && !list.tracks.some(item => trackKey(item) === trackKey(track))) list.tracks.push({ ...track });
    }
    if (saveLists()) renderLists();
  }
  $('#playlist-add-favorite').onclick = () => addFavoritesToList(favoriteTracks.filter(track => trackKey(track) === $('#playlist-favorite').value));
  $('#playlist-add-all').onclick = () => addFavoritesToList(favoriteTracks);
  $('#playlist-delete').onclick = () => {
    if (!selectedList()) return;
    savedLists = savedLists.filter(list => list.id !== selectedListId);
    if (activeListId === selectedListId) activeListId = '';
    selectedListId = savedLists[0]?.id || '';
    saveLists(); renderLists();
  };
  $('#playlist-repeat').onchange = event => { repeatMode = event.target.value; saveLists(); };
  renderLists();

  async function advanceAtEnd() {
    if (advancing) return;
    advancing = true;
    try {
      if (repeatMode === 'one' && currentTrack) await playSelectedTrack(currentTrack);
      else if (currentIndex < playlist.length - 1) await playSelectedTrack(playlist[currentIndex + 1]);
      else if (repeatMode === 'all' && playlist.length) await playSelectedTrack(playlist[0]);
      else { setPlayingUI(false); await window.blackout?.musicStop?.(); }
    } finally { setTimeout(() => { advancing = false; }, 1200); }
  }
  audio.addEventListener('ended', advanceAtEnd);

  const MOODS = {
    focus: {
      name: 'Focus Flow',
      accent: '#77e4c4',
      gradient: 'linear-gradient(90deg, #77e4c4 0%, #2dd4bf 50%, #38bdf8 100%)',
      glow: 'rgba(119, 228, 196, 0.45)',
      tracks: [
        { title: 'SomaFM Groove Salad', artist: 'SomaFM Broadcaster', url: 'https://ice1.somafm.com/groovesalad-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'SomaFM Drone Zone', artist: 'Atmospheric Ambient Space', url: 'https://ice1.somafm.com/dronezone-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Deep Space Resonance', artist: 'Cosmic Soundscapes', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3', live: false, type: 'FREE TRACK' }
      ]
    },
    lofi: {
      name: 'Lofi Chill',
      accent: '#9a7aff',
      gradient: 'linear-gradient(90deg, #9a7aff 0%, #c084fc 50%, #f472b6 100%)',
      glow: 'rgba(154, 122, 255, 0.45)',
      tracks: [
        { title: 'SomaFM DEF CON Radio', artist: 'Music for Hacking & Chill', url: 'https://ice1.somafm.com/defcon-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Chillout Lounge Radio', artist: '24/7 Lofi Coffee Study', url: 'https://streams.ilovemusic.de/iloveradio17.mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Midnight Coffee Beats', artist: 'Komorebi Study Session', url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3', live: false, type: 'FREE TRACK' }
      ]
    },
    cyberpunk: {
      name: 'Cyberpunk Energy',
      accent: '#ff684d',
      gradient: 'linear-gradient(90deg, #ff684d 0%, #f43f5e 50%, #ec4899 100%)',
      glow: 'rgba(255, 104, 77, 0.45)',
      tracks: [
        { title: 'SomaFM Beat Blender', artist: 'Electro Synthwave Pulse', url: 'https://ice1.somafm.com/beatblender-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'SomaFM Secret Agent', artist: 'Spy Synth & Electro', url: 'https://ice1.somafm.com/secretagent-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Neon Metropolis 2099', artist: 'Overdrive Synthetics', url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c3527e30ec.mp3', live: false, type: 'FREE TRACK' }
      ]
    },
    ambient: {
      name: 'Deep Ambient',
      accent: '#38bdf8',
      gradient: 'linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #a855f7 100%)',
      glow: 'rgba(56, 189, 248, 0.45)',
      tracks: [
        { title: 'SomaFM Deep Space One', artist: 'Deep Ambient Electronic Space', url: 'https://ice1.somafm.com/deepspaceone-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'SomaFM Mission Control', artist: 'NASA Audio Mixed Ambient', url: 'https://ice1.somafm.com/missioncontrol-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Celestial Horizons', artist: 'Astral Echo Observatory', url: 'https://cdn.pixabay.com/download/audio/2021/11/01/audio_001d9f0494.mp3', live: false, type: 'FREE TRACK' }
      ]
    },
    acoustic: {
      name: 'Acoustic Warmth',
      accent: '#fbbf24',
      gradient: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #ea580c 100%)',
      glow: 'rgba(251, 191, 36, 0.45)',
      tracks: [
        { title: 'SomaFM Folk Forward', artist: 'Indie Folk & Acoustic', url: 'https://ice1.somafm.com/folkfwd-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'SomaFM Left Coast 70s', artist: 'Mellow Acoustic Rock', url: 'https://ice1.somafm.com/seventies-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Woodland Morning Walk', artist: 'Timber Fingerstyle Strings', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3', live: false, type: 'FREE TRACK' }
      ]
    }
  };

  const BROWSER_THEMES = {
    eclipse: { accent: '#9a7aff', glow: 'rgba(154, 122, 255, 0.45)', gradient: 'linear-gradient(90deg, #9a7aff, #c084fc, #f472b6)' },
    ember: { accent: '#ff684d', glow: 'rgba(255, 104, 77, 0.45)', gradient: 'linear-gradient(90deg, #ff684d, #f43f5e, #ec4899)' },
    aurora: { accent: '#77e4c4', glow: 'rgba(119, 228, 196, 0.45)', gradient: 'linear-gradient(90deg, #77e4c4, #2dd4bf, #38bdf8)' }
  };

  function applyBrowserTheme(themeName) {
    const theme = BROWSER_THEMES[themeName] || BROWSER_THEMES.eclipse;
    const panel = $('#music-panel');
    if (panel) {
      panel.style.setProperty('--mood-accent', theme.accent);
      panel.style.setProperty('--mood-gradient', theme.gradient);
      panel.style.setProperty('--mood-glow', theme.glow);
      panel.style.setProperty('--mood-border', theme.accent);
    }
    document.documentElement.style.setProperty('--mood-accent', theme.accent);
    document.documentElement.style.setProperty('--mood-glow', theme.glow);
    if (volumeSlider) {
      volumeSlider.style.accentColor = theme.accent;
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function setPlayingUI(playing) {
    isPlaying = playing;
    if (songDisc) songDisc.classList.toggle('spinning', playing);
    if (statusPill) {
      statusPill.textContent = playing ? 'PLAYING' : (currentTrack ? 'PAUSED' : 'READY');
      statusPill.classList.toggle('playing', playing);
    }
    if (playIcon) {
      if (playing) {
        // Pause icon (two vertical bars)
        playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      } else {
        // Play icon (triangle)
        playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      }
    }
  }

  function displayTrackInfo(track) {
    if (!track) {
      if (trackName) trackName.textContent = 'Ready to Play';
      if (trackArtist) trackArtist.textContent = 'Search any track to begin streaming';
      if (typeBadge) typeBadge.textContent = 'STANDBY';
      if (sourceInfo) sourceInfo.textContent = 'Internet Audio';
      if (songDiscCover) songDiscCover.style.display = 'none';
      if (songDiscCenter) songDiscCenter.style.display = 'flex';
      return;
    }
    currentTrack = track;
    if (trackName) trackName.textContent = track.title || 'Untitled Song';
    if (trackArtist) trackArtist.textContent = track.artist ? (track.artist + (track.album ? ` · ${track.album}` : '')) : 'Web Audio';
    if (typeBadge) typeBadge.textContent = track.live ? 'LIVE' : (track.type || 'HQ AUDIO');
    if (sourceInfo) sourceInfo.textContent = track.videoId ? 'YouTube Audio' : (track.album || 'Web Stream');

    if (songDiscCover && songDiscCenter) {
      if (track.cover) {
        songDiscCover.src = track.cover;
        songDiscCover.style.display = 'block';
        songDiscCenter.style.display = 'none';
      } else {
        songDiscCover.style.display = 'none';
        songDiscCenter.style.display = 'flex';
      }
    }

    if (track.duration && !durationSec) {
      durationSec = track.duration;
      if (timeDuration) timeDuration.textContent = formatTime(durationSec);
    }
    updateStarState();
  }

  function updateTimelineUI() {
    if (isSeeking) return;
    const dur = durationSec || (currentTrack?.duration) || 0;
    if (dur > 0) {
      const pct = Math.min(100, Math.max(0, (currentTimeSec / dur) * 100));
      if (timelineFill) timelineFill.style.width = `${pct}%`;
      if (timelineThumb) timelineThumb.style.left = `${pct}%`;
      if (timeDuration) timeDuration.textContent = formatTime(dur);
    }
    if (timeElapsed) timeElapsed.textContent = formatTime(currentTimeSec);
  }

  async function syncStatusFromMain() {
    if (isSeeking) return;
    if (currentTrack?.hasLocalAudio && currentTrack?.cachedUrl) {
      currentTimeSec = Math.floor(audio.currentTime || 0);
      durationSec = Number.isFinite(audio.duration) ? audio.duration : (currentTrack.duration || 0);
      setPlayingUI(!audio.paused && !audio.ended);
      updateTimelineUI();
      return;
    }
    try {
      const status = await window.blackout?.musicStatus?.();
      if (status && status.active) {
        if (status.ended) {
          advanceAtEnd();
          return;
        }
        if (Date.now() < seekLockUntil) {
          if (Math.abs((status.currentTime || 0) - currentTimeSec) <= 2) {
            seekLockUntil = 0;
          } else {
            return;
          }
        }
        currentTimeSec = Math.floor(status.currentTime || 0);
        if (status.duration > 0) durationSec = Math.round(status.duration);
        setPlayingUI(Boolean(status.playing));
        updateTimelineUI();
      } else if (currentTrack && audio.src && !audio.paused) {
        currentTimeSec = Math.floor(audio.currentTime || 0);
        durationSec = Math.round(audio.duration || currentTrack.duration || 0);
        setPlayingUI(true);
        updateTimelineUI();
      }
    } catch {}
  }

  async function playSelectedTrack(track) {
    if (!track) return;
    // Saved playlists/main-process snapshots may predate the download.
    const stored = favoriteTracks.find(item => trackKey(item) === trackKey(track));
    if (stored) track = { ...track, ...stored };
    currentTrack = track;
    currentIndex = playlist.findIndex(t => trackKey(t) === trackKey(track));
    if (currentIndex < 0) {
      playlist = [track, ...playlist];
      currentIndex = 0;
    }
    currentTimeSec = 0;
    durationSec = track.duration || 0;
    displayTrackInfo(track);
    setPlayingUI(true);
    updateTimelineUI();

    // Persist active state in main process so reopening the popup never resets it
    window.blackout?.setMusicState?.({
      track,
      playlist,
      volume: audio.volume
    });

    if (track.hasLocalAudio && track.cachedUrl) {
      // PLAY INSTANTLY FROM LOCAL AUDIO CACHE (0ms, Offline, No network delay)
      try { await window.blackout?.musicStop?.(); } catch {}
      audio.src = track.cachedUrl;
      audio.currentTime = 0;
      audio.play().then(() => setPlayingUI(true)).catch(() => {
        setPlayingUI(false);
        $('#download-message').textContent = 'The downloaded audio could not be played. Download it again when connected.';
      });
    } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPlayingUI(false);
      $('#download-message').textContent = 'This song is not downloaded on this device. Connect to download it first.';
    } else if (track.videoId) {
      try { audio.pause(); } catch {}
      window.blackout?.musicPlay?.({
        videoId: track.videoId,
        volume: audio.volume,
        track
      });
    } else if (track.url) {
      try { await window.blackout?.musicStop?.(); } catch {}
      audio.src = track.url;
      audio.currentTime = 0;
      audio.play().then(() => setPlayingUI(true)).catch(() => setPlayingUI(false));
    }
  }

  async function refreshFavorites() {
    try {
      favoriteTracks = await window.blackout?.getMusicFavorites?.() || [];
      const count = favoriteTracks.length;
      if (favCountBadge) favCountBadge.textContent = count;
      if (libCountHeading) libCountHeading.textContent = count;
      updateStarState();
      renderFavoritesList();
      const picker = $('#playlist-favorite');
      picker.replaceChildren();
      for (const track of favoriteTracks) {
        const option = document.createElement('button');
        option.type = 'button';
        option.textContent = track.title || 'Untitled song';
        option.onclick = () => {
          picker.value = trackKey(track);
          $('#playlist-favorite-label').textContent = track.title || 'Untitled song';
          picker.parentElement.open = false;
        };
        picker.append(option);
      }
      if (!favoriteTracks.some(track => trackKey(track) === picker.value)) {
        picker.value = trackKey(favoriteTracks[0]) || '';
        $('#playlist-favorite-label').textContent = favoriteTracks[0]?.title || 'No favorite songs yet';
      }
    } catch {}
  }

  function updateStarState() {
    if (!songStarBtn) return;
    const isFav = currentTrack && favoriteTracks.some(t => (currentTrack.id && t.id === currentTrack.id) || (currentTrack.videoId && t.videoId === currentTrack.videoId));
    songStarBtn.classList.toggle('favorited', Boolean(isFav));
    songStarBtn.textContent = isFav ? '★' : '☆';
    songStarBtn.title = isFav ? 'Remove from Favorites' : 'Add to Favorites';

    if (songCacheBtn) {
      const fav = currentTrack && favoriteTracks.find(t => (currentTrack.id && t.id === currentTrack.id) || (currentTrack.videoId && t.videoId === currentTrack.videoId));
      const cached = Boolean(fav?.hasLocalAudio);
      songCacheBtn.classList.toggle('cached', cached);
      songCacheBtn.textContent = cached ? 'Downloaded' : 'Download';
      songCacheBtn.disabled = cached;
      songCacheBtn.title = cached ? 'Downloaded for offline playback' : 'Download for offline playback';
    }
  }

  function renderFavoritesList() {
    if (!favoritesList) return;
    favoritesList.replaceChildren();
    if (!favoriteTracks.length) {
      favoritesList.innerHTML = '<div class="lib-empty-state">No favorite songs saved yet.<br>Click the ⭐ star on any playing song to add it!</div>';
      return;
    }

    favoriteTracks.forEach(track => {
      const item = document.createElement('div');
      item.className = 'lib-item';
      if (currentTrack && ((track.videoId && track.videoId === currentTrack.videoId) || (track.id === currentTrack.id))) {
        item.classList.add('active');
      }

      const thumb = document.createElement('div');
      thumb.className = 'lib-thumb';
      if (track.cover) {
        const img = document.createElement('img');
        img.src = track.cover;
        img.alt = track.title;
        thumb.appendChild(img);
      } else {
        thumb.textContent = '♫';
      }

      const info = document.createElement('div');
      info.className = 'lib-info';
      const title = document.createElement('div');
      title.className = 'lib-title';
      title.textContent = track.title || 'Untitled Track';
      const artist = document.createElement('div');
      artist.className = 'lib-artist';
      artist.textContent = (track.artist || 'Web Artist') + (track.durationFormatted ? ` · ${track.durationFormatted}` : '');
      info.appendChild(title);
      info.appendChild(artist);

      const actions = document.createElement('div');
      actions.className = 'lib-actions';

      if (track.isCached) {
        const badge = document.createElement('span');
        badge.className = 'lib-badge';
        badge.textContent = 'Downloaded';
        actions.appendChild(badge);
      } else {
        const cacheBtn = document.createElement('button');
        cacheBtn.className = 'lib-btn';
        cacheBtn.textContent = 'Download';
        cacheBtn.title = 'Download track';
        cacheBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          cacheBtn.textContent = 'Downloading...';
          try {
            const result = await window.blackout?.cacheMusicTrack?.(track);
            if (!result?.success) {
              cacheBtn.textContent = 'Download';
              cacheBtn.title = result?.error || 'This track could not be saved for offline playback.';
              return;
            }
            await refreshFavorites();
          } catch {
            cacheBtn.textContent = 'Download';
            cacheBtn.title = 'This track could not be saved for offline playback.';
          }
        });
        actions.appendChild(cacheBtn);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'lib-btn';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove from Favorites';
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.blackout?.toggleMusicFavorite?.(track);
        await refreshFavorites();
      });
      actions.appendChild(removeBtn);

      item.appendChild(thumb);
      item.appendChild(info);
      item.appendChild(actions);

      item.addEventListener('click', () => {
        if (libraryPanel) libraryPanel.hidden = true;
        if (tabToggleBtn) tabToggleBtn.classList.remove('active');
        playSelectedTrack(track);
      });

      favoritesList.appendChild(item);
    });
  }

  // Favorites & Cache Wiring
  if (songStarBtn) {
    songStarBtn.addEventListener('click', async () => {
      if (!currentTrack) return;
      await window.blackout?.toggleMusicFavorite?.(currentTrack);
      await refreshFavorites();
    });
  }

  if (songCacheBtn) {
    songCacheBtn.addEventListener('click', async () => {
      if (!currentTrack) return;
      songCacheBtn.textContent = 'Downloading...';
      songCacheBtn.disabled = true;
      try {
        const result = await window.blackout?.cacheMusicTrack?.(currentTrack);
        if (!result?.success) {
          songCacheBtn.textContent = 'Download';
          songCacheBtn.disabled = false;
          songCacheBtn.title = result?.error || 'This track could not be saved for offline playback.';
          $('#download-message').textContent = songCacheBtn.title;
          return;
        }
        currentTrack = { ...currentTrack, ...result.track, isCached: true, hasLocalAudio: true };
        await refreshFavorites();
        updateStarState();
        $('#download-message').textContent = 'Audio saved on this device for offline playback.';
      } catch (err) {
        songCacheBtn.textContent = 'Download';
        songCacheBtn.disabled = false;
        songCacheBtn.title = 'This track could not be saved for offline playback.';
      }
    });
  }

  if (tabToggleBtn) {
    tabToggleBtn.addEventListener('click', () => {
      const show = libraryPanel ? libraryPanel.hidden : false;
      if (libraryPanel) libraryPanel.hidden = !show;
      tabToggleBtn.classList.toggle('active', show);
      if (show) renderFavoritesList();
    });
  }

  if (libBackBtn) {
    libBackBtn.addEventListener('click', () => {
      if (libraryPanel) libraryPanel.hidden = true;
      if (tabToggleBtn) tabToggleBtn.classList.remove('active');
    });
  }

  // Restore State on Startup
  async function initPlayerState() {
    const initialMood = 'focus';
    const appearance = await window.blackout?.getUiAppearance?.();
    applyBrowserTheme(appearance?.theme);

    await refreshFavorites();
    try {
      const state = await Promise.race([window.blackout?.getMusicState?.(), new Promise(resolve => setTimeout(() => resolve(null), 800))]);
      if (state && state.track) {
        currentTrack = { ...state.track, ...favoriteTracks.find(item => trackKey(item) === trackKey(state.track)) };
        if (Array.isArray(state.playlist) && state.playlist.length) {
          playlist = state.playlist;
          currentIndex = playlist.findIndex(t => t.videoId === state.track.videoId || t.url === state.track.url);
          if (currentIndex < 0) currentIndex = 0;
        } else {
          playlist = [state.track];
          currentIndex = 0;
        }
        if (typeof state.volume === 'number') {
          audio.volume = state.volume;
          if (volumeSlider) volumeSlider.value = String(state.volume);
        }
        currentTimeSec = Math.floor(state.currentTime || 0);
        durationSec = Math.round(state.duration || state.track.duration || 0);
        displayTrackInfo(currentTrack);
        setPlayingUI(currentTrack.hasLocalAudio ? false : state.isPlaying);
        updateTimelineUI();
      } else {
        // Fallback: check saved track in localStorage or load current mood playlist
        try {
          const saved = localStorage.getItem('blackout-saved-track');
          if (saved) {
            const track = JSON.parse(saved);
            playlist = [track];
            displayTrackInfo(track);
          } else {
            const defaultTrack = MOODS[initialMood]?.tracks?.[0];
            if (defaultTrack) {
              playlist = [...MOODS[initialMood].tracks];
              displayTrackInfo(defaultTrack);
            }
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Error restoring music state:', err);
    }

    // Start live sync loop
    if (!syncInterval) {
      syncInterval = setInterval(syncStatusFromMain, 500);
    }
  }

  window.blackout?.onState?.(state => {
    if (state?.type === 'appearance') applyBrowserTheme(state.appearance?.theme);
  });

  // Navigation & Track Advance Helpers
  function playPreviousTrack() {
    // If track has been playing for more than 3 seconds, restart current track to 0:00
    if (currentTimeSec > 3) {
      currentTimeSec = 0;
      updateTimelineUI();
      if (currentTrack?.videoId && !currentTrack.hasLocalAudio) {
        window.blackout?.musicSeek?.(0.1);
      } else if (audio.src) {
        audio.currentTime = 0;
      }
      return;
    }

    if (playlist.length > 1) {
      currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
      playSelectedTrack(playlist[currentIndex]);
    } else if (favoriteTracks.length > 0) {
      const favIdx = favoriteTracks.findIndex(t => t.videoId === currentTrack?.videoId || t.id === currentTrack?.id);
      const prevFavIdx = favIdx >= 0 ? (favIdx - 1 + favoriteTracks.length) % favoriteTracks.length : 0;
      playSelectedTrack(favoriteTracks[prevFavIdx]);
    } else if (currentTrack) {
      currentTimeSec = 0;
      updateTimelineUI();
      if (currentTrack.videoId && !currentTrack.hasLocalAudio) {
        window.blackout?.musicSeek?.(0.1);
      } else if (audio.src) {
        audio.currentTime = 0;
      }
    }
  }

  function playNextTrack() {
    if (playlist.length > 1) {
      currentIndex = (currentIndex + 1) % playlist.length;
      playSelectedTrack(playlist[currentIndex]);
    } else if (favoriteTracks.length > 0) {
      const favIdx = favoriteTracks.findIndex(t => t.videoId === currentTrack?.videoId || t.id === currentTrack?.id);
      const nextFavIdx = favIdx >= 0 ? (favIdx + 1) % favoriteTracks.length : 0;
      playSelectedTrack(favoriteTracks[nextFavIdx]);
    } else if (currentTrack) {
      currentTimeSec = 0;
      updateTimelineUI();
      if (currentTrack.videoId && !currentTrack.hasLocalAudio) {
        window.blackout?.musicSeek?.(0.1);
      } else if (audio.src) {
        audio.currentTime = 0;
      }
    }
  }

  // Controls Wiring
  if (playBtn) {
    playBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!currentTrack) {
        if (playlist.length) {
          playSelectedTrack(playlist[0]);
        } else if (favoriteTracks.length) {
          playSelectedTrack(favoriteTracks[0]);
        } else if (searchInput) {
          searchInput.focus();
        }
        return;
      }

      if (isPlaying) {
        setPlayingUI(false);
        if (currentTrack.hasLocalAudio && currentTrack.cachedUrl) {
          audio.pause();
        } else if (currentTrack.videoId && !currentTrack.hasLocalAudio) {
          await window.blackout?.musicPause?.();
        } else {
          audio.pause();
        }
      } else {
        setPlayingUI(true);
        const stored = favoriteTracks.find(item => trackKey(item) === trackKey(currentTrack));
        if (stored) currentTrack = { ...currentTrack, ...stored };
        if (currentTrack.hasLocalAudio && currentTrack.cachedUrl) {
          if (audio.getAttribute('src') !== currentTrack.cachedUrl) audio.src = currentTrack.cachedUrl;
          audio.play().catch(() => {
            setPlayingUI(false);
            $('#download-message').textContent = 'The downloaded audio could not be played. Download it again when connected.';
          });
        } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setPlayingUI(false);
          $('#download-message').textContent = 'This song is not downloaded on this device. Connect to download it first.';
        } else if (currentTrack.videoId && !currentTrack.hasLocalAudio) {
          const resumed = await window.blackout?.musicResume?.();
          if (!resumed) {
            playSelectedTrack(currentTrack);
          }
        } else if (currentTrack.hasLocalAudio && currentTrack.cachedUrl) {
          audio.src = currentTrack.cachedUrl;
          audio.play().catch(() => {});
        } else if (currentTrack.url) {
          audio.src = currentTrack.url;
          audio.play().catch(() => {});
        }
      }
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      setPlayingUI(false);
      currentTimeSec = 0;
      updateTimelineUI();
      if (timelineFill) timelineFill.style.width = '0%';
      if (timelineThumb) timelineThumb.style.left = '0%';
      if (timeElapsed) timeElapsed.textContent = '00:00';
      if (currentTrack?.videoId && !currentTrack.hasLocalAudio) {
        await window.blackout?.musicStop?.();
      } else {
        audio.pause();
        try { audio.currentTime = 0; } catch {}
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPreviousTrack();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playNextTrack();
    });
  }

  // Seek bar functionality
  function getSeekTarget(e) {
    if (!timelineTrack) return null;
    const rect = timelineTrack.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const seekPct = clickX / rect.width;
    const dur = durationSec || (currentTrack?.duration) || 0;
    if (dur <= 0) return null;
    const targetSec = Math.min(dur, Math.max(0, Math.round(seekPct * dur)));
    return { targetSec, dur, seekPct };
  }

  function previewSeek(e) {
    const target = getSeekTarget(e);
    if (!target) return;
    const { targetSec, dur } = target;
    currentTimeSec = targetSec;
    if (timeElapsed) timeElapsed.textContent = formatTime(targetSec);
    const pct = Math.min(100, Math.max(0, (targetSec / dur) * 100));
    if (timelineFill) timelineFill.style.width = `${pct}%`;
    if (timelineThumb) timelineThumb.style.left = `${pct}%`;
  }

  function performSeek(e) {
    const target = getSeekTarget(e);
    if (!target) return;
    const { targetSec } = target;
    currentTimeSec = targetSec;
    seekLockUntil = Date.now() + 2500;
    updateTimelineUI();
    setPlayingUI(true);

    if (currentTrack?.videoId && !currentTrack.hasLocalAudio) {
      window.blackout?.musicSeek?.(targetSec);
    } else if (audio.duration) {
      audio.currentTime = targetSec;
      if (audio.paused) audio.play().catch(() => {});
    }
  }

  if (timelineTrack) {
    timelineTrack.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isSeeking = true;
      try { timelineTrack.setPointerCapture(e.pointerId); } catch {}
      previewSeek(e);
    });

    timelineTrack.addEventListener('pointermove', (e) => {
      if (isSeeking) previewSeek(e);
    });

    timelineTrack.addEventListener('pointerup', (e) => {
      if (isSeeking) {
        isSeeking = false;
        try { timelineTrack.releasePointerCapture(e.pointerId); } catch {}
        performSeek(e);
      }
    });

    timelineTrack.addEventListener('pointercancel', (e) => {
      if (isSeeking) {
        isSeeking = false;
        try { timelineTrack.releasePointerCapture(e.pointerId); } catch {}
        updateTimelineUI();
      }
    });

    timelineTrack.addEventListener('click', (e) => {
      e.stopPropagation();
      performSeek(e);
    });
  }

  // Volume
  if (volumeSlider) {
    try {
      const savedVol = localStorage.getItem('blackout-music-vol');
      if (savedVol !== null) {
        audio.volume = parseFloat(savedVol);
        volumeSlider.value = savedVol;
      } else {
        audio.volume = 0.8;
      }
    } catch { audio.volume = 0.8; }

    const updateVol = (val) => {
      const num = Math.max(0, Math.min(1, parseFloat(val) || 0));
      audio.volume = num;
      audio.muted = (num === 0);
      window.blackout?.musicVolume?.(num);
      try { localStorage.setItem('blackout-music-vol', String(num)); } catch {}
      if (volumeToggle) volumeToggle.textContent = num === 0 ? '🔇' : (num < 0.5 ? '🔉' : '🔊');
    };

    volumeSlider.addEventListener('input', (e) => updateVol(e.target.value));
    volumeSlider.addEventListener('change', (e) => updateVol(e.target.value));
  }

  if (volumeToggle) {
    let prevVolume = 0.8;
    volumeToggle.addEventListener('click', () => {
      if (audio.volume > 0 && !audio.muted) {
        prevVolume = audio.volume;
        updateVol(0);
        if (volumeSlider) volumeSlider.value = '0';
      } else {
        const restoreVol = prevVolume > 0 ? prevVolume : 0.8;
        updateVol(restoreVol);
        if (volumeSlider) volumeSlider.value = String(restoreVol);
      }
    });
  }

  // Search
  function renderResults(results) {
    if (!searchResults) return;
    searchResults.replaceChildren();
    if (!results || !results.length) {
      searchResults.hidden = true;
      return;
    }

    results.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'music-result-item';

      const thumb = document.createElement('div');
      thumb.className = 'music-result-thumb';
      if (item.cover) {
        const img = document.createElement('img');
        img.src = item.cover;
        img.alt = item.title || 'Track';
        thumb.appendChild(img);
      } else {
        thumb.textContent = '♫';
      }

      const info = document.createElement('div');
      info.className = 'music-result-info';

      const title = document.createElement('div');
      title.className = 'music-result-title';
      title.textContent = item.title || 'Unknown Song';

      const artist = document.createElement('div');
      artist.className = 'music-result-artist';
      artist.textContent = (item.artist || 'Web Artist') + (item.album ? ` · ${item.album}` : '');

      info.appendChild(title);
      info.appendChild(artist);

      const dur = document.createElement('div');
      dur.className = 'music-result-dur';
      dur.textContent = item.duration ? formatTime(item.duration) : (item.live ? 'LIVE' : '');

      btn.appendChild(thumb);
      btn.appendChild(info);
      btn.appendChild(dur);

      // Keep result actions separate from the play button (no nested buttons).
      const row = document.createElement('div');
      row.className = 'music-result-row';
      row.appendChild(btn);
      const actions = document.createElement('div');
      actions.className = 'music-result-actions';
      const favorite = document.createElement('button');
      favorite.type = 'button';
      const saved = favoriteTracks.some(track => trackKey(track) === trackKey(item));
      favorite.textContent = saved ? 'In Library' : 'Favorite';
      favorite.disabled = saved;
      favorite.addEventListener('click', async event => {
        event.stopPropagation();
        favorite.disabled = true;
        try {
          await window.blackout?.toggleMusicFavorite?.(item);
          await refreshFavorites();
          favorite.textContent = 'In Library';
        } catch { favorite.disabled = false; }
      });
      const download = document.createElement('button');
      download.type = 'button';
      const downloaded = favoriteTracks.some(track => trackKey(track) === trackKey(item) && track.hasLocalAudio);
      download.textContent = downloaded ? 'Downloaded' : 'Download';
      download.disabled = downloaded;
      download.addEventListener('click', async event => {
        event.stopPropagation();
        download.disabled = true;
        download.textContent = 'Downloading...';
        try {
          const result = await window.blackout?.cacheMusicTrack?.(item);
          if (!result?.success) throw new Error(result?.error || 'Download failed. Please try again.');
          await refreshFavorites();
          download.textContent = 'Downloaded';
          favorite.textContent = 'In Library';
          favorite.disabled = true;
          $('#download-message').textContent = 'Saved in Music Library for offline playback.';
        } catch (error) {
          download.disabled = false;
          download.textContent = 'Download';
          $('#download-message').textContent = error.message;
        }
      });
      actions.appendChild(favorite);
      actions.appendChild(download);
      row.appendChild(actions);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchResults.hidden = true;
        playlist = [item, ...playlist.filter(t => t.videoId !== item.videoId && t.url !== item.url)];
        currentIndex = 0;
        try { localStorage.setItem('blackout-saved-track', JSON.stringify(item)); } catch {}
        playSelectedTrack(item);
      });

      searchResults.appendChild(row);
    });

    searchResults.hidden = false;
  }

  async function performSearch(query) {
    if (!query || !query.trim()) return;
    const q = query.trim();

    if (searchResults) {
      searchResults.hidden = false;
      searchResults.innerHTML = '<div class="music-loading-msg">Searching web &amp; music networks…</div>';
    }

    try {
      const results = await window.blackout?.searchMusic?.(q);
      if (results && results.length) {
        renderResults(results);
      } else {
        if (searchResults) {
          searchResults.innerHTML = `<div class="music-loading-msg" style="color:#ff684d;">No songs found for "${q.slice(0, 20)}"</div>`;
        }
      }
    } catch (err) {
      if (searchResults) {
        searchResults.innerHTML = '<div class="music-loading-msg" style="color:#ff684d;">Search error. Please try again.</div>';
      }
    }
  }

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      performSearch(searchInput.value);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch(searchInput.value);
      }
    });
  }

  // Close popup
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.blackout?.closeMenuPopup?.();
    });
  }

  // Close results dropdown on outside click
  document.addEventListener('click', (e) => {
    if (searchResults && !searchResults.hidden && !searchResults.contains(e.target) && !searchInput.contains(e.target)) {
      searchResults.hidden = true;
    }
  });

  // Synchronize state from main process
  window.blackout?.onState?.(state => {
    if (state.type === 'music-volume') {
      const vol = Number(state.volume) || 0;
      const isZero = (vol === 0);
      if (audio) {
        audio.volume = vol;
        audio.muted = isZero;
      }
      if (volumeSlider) volumeSlider.value = String(vol);
      if (volumeToggle) volumeToggle.textContent = isZero ? '🔇' : (vol < 0.5 ? '🔉' : '🔊');
    }
  });

  // Initialize
  initPlayerState();
})();
