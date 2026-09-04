/**
 * UnifiedPlayer — Centralized Music + FM Player
 * One audio source for both Songs and FM.
 * Bottom Now Playing Bar → Full Screen Player (swipe up / tap).
 * Full Screen Song Player: artwork, blurred BG, progress, controls, queue, fav, share, volume, Ask AI.
 * Full Screen FM Live Player: station logo, FM name, LIVE indicator, current program, no progress bar.
 * Gestures: swipe left=next, right=prev, down=mini, up=queue (from full screen).
 * AI audio-reactive animation around artwork while playing.
 * Responsive: desktop, tablet, mobile/PWA.
 */
const UnifiedPlayer = (() => {
  'use strict';

  /* ─── State ─── */
  const state = {
    mode: 'songs',          // 'songs' | 'fm'
    track: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    previousVolume: 0.8,
    muted: false,
    shuffle: false,
    repeat: 'off',          // 'off' | 'all' | 'one'
    isLive: false,
    favorites: new Set(),
    _shuffleOrder: [],
    // When true, script.js owns real playback via window.audioPlayer.
    // UnifiedPlayer then behaves as a UI layer delegating to script.js.
    externalEngine: false,
  };

  /* ─── Init guard (unified-player.js auto-inits AND index.html/DOMContentLoaded calls init) ─── */
  let _initialized = false;

  /* ─── DOM refs (populated in init) ─── */
  let els = {};

  /* ─── Audio ─── */
  let audio = null;
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let eqBands = new Float32Array(10).fill(0);

  /* ─── Animation ─── */
  let rafId = null;
  let aiCanvasCtx = null;
  let aiAnimFrame = null;

  /* ─── Seek drag state ─── */
  let draggingSeek = false;
  let _progressLoopRunning = false;

  /* ─── Persistence key ─── */
  const STORAGE_KEY = 'tamilai_unifiedPlayer';

  /* ═══════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════ */
  function init() {
    if (_initialized) return;
    _initialized = true;
    _createAudio();
    _bindDOM();
    _bindGestures();
    _bindKeyboard();
    _restoreState();
    _adoptExternalEngine();
    _startProgressLoop();
    _setupServiceWorker();
  }

  /* ═══════════════════════════════════════════
     EXTERNAL ENGINE (script.js)
     UnifiedPlayer is a UI layer when script.js owns playback.
     ═══════════════════════════════════════════ */
  function _liveAudio() {
    if (state.externalEngine && window.audioPlayer && (window.audioPlayer.src || window.audioPlayer.getAttribute && window.audioPlayer.getAttribute('src'))) {
      return window.audioPlayer;
    }
    return audio;
  }

  /** Lazily detect that script.js is driving real playback and adopt its state. */
  function _adoptExternalEngine() {
    if (state.externalEngine) return;
    if (!window.audioPlayer) return;
    let track = null;
    try {
      track = window.currentPlaybackTrack || window.currentStation || null;
    } catch (e) { /* ignore */ }
    if (!track) {
      // Even without globals, a real loaded source means script.js owns playback.
      const src = (window.audioPlayer.src || (window.audioPlayer.getAttribute && window.audioPlayer.getAttribute('src'))) || '';
      if (!src || !state.track) return;
      state.externalEngine = true;
      return;
    }
    state.externalEngine = true;
    if (els.bottomTitle && els.bottomTitle.textContent !== 'Nothing playing') return;
    state.track = track;
    state.mode = (window.currentStation && !window.currentPlaybackTrack) ? 'fm' : 'songs';
    state.isLive = !!(track.streamUrl && !track.audioUrl);
    state.currentTime = window.audioPlayer.currentTime || 0;
    state.duration = window.audioPlayer.duration || 0;
    _showBottomBar();
    _updateTrackUI();
    _updateFavUI();
    _updatePlayUI();
  }

  /* ─── Create audio element ─── */
  function _createAudio() {
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = state.volume;

    audio.addEventListener('loadedmetadata', () => {
      state.duration = audio.duration || 0;
      _updateProgressUI();
    });
    audio.addEventListener('timeupdate', () => {
      state.currentTime = audio.currentTime || 0;
      _updateProgressUI();
    });
    audio.addEventListener('ended', () => {
      if (state.repeat === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        next();
      }
    });
    audio.addEventListener('error', () => {
      console.warn('[UnifiedPlayer] Audio error');
    });
    audio.addEventListener('play', () => {
      state.isPlaying = true;
      _updatePlayUI();
      _startAIAnimation();
      _updateMediaSession();
    });
    audio.addEventListener('pause', () => {
      state.isPlaying = false;
      _updatePlayUI();
      _stopAIAnimation();
      _updateMediaSession();
    });
  }

  /* ═══════════════════════════════════════════
     DOM BINDINGS
     ═══════════════════════════════════════════ */
  function _bindDOM() {
    els = {
      bottomBar: document.getElementById('upBottomBar'),
      bottomArt: document.getElementById('upBottomArt'),
      bottomTitle: document.getElementById('upBottomTitle'),
      bottomArtist: document.getElementById('upBottomArtist'),
      bottomMeta: document.getElementById('upBottomMeta'),
      bottomSeek: document.getElementById('upBottomSeek'),
      bottomCurrentTime: document.getElementById('upBottomCurrentTime'),
      bottomDuration: document.getElementById('upBottomDuration'),
      bottomPlayPause: document.getElementById('upBottomPlayPause'),
      bottomProgressFill: document.getElementById('upBottomProgressFill'),

      fullScreen: document.getElementById('upFullScreen'),
      fsArtworkWrap: document.getElementById('upFsArtworkWrap'),
      fsArtwork: document.getElementById('upFsArtwork'),
      fsAICanvas: document.getElementById('upFsAICanvas'),
      fsBlurBG: document.getElementById('upFsBlurBG'),
      fsTitle: document.getElementById('upFsTitle'),
      fsArtist: document.getElementById('upFsArtist'),
      fsProgress: document.getElementById('upFsProgress'),
      fsProgressFill: document.getElementById('upFsProgressFill'),
      fsCurrentTime: document.getElementById('upFsCurrentTime'),
      fsDuration: document.getElementById('upFsDuration'),
      fsPlayPause: document.getElementById('upFsPlayPause'),
      fsPrev: document.getElementById('upFsPrev'),
      fsNext: document.getElementById('upFsNext'),
      fsShuffle: document.getElementById('upFsShuffle'),
      fsRepeat: document.getElementById('upFsRepeat'),
      fsQueue: document.getElementById('upFsQueue'),
      fsFav: document.getElementById('upFsFav'),
      fsShare: document.getElementById('upFsShare'),
      fsVolume: document.getElementById('upFsVolume'),
      fsVolumeSlider: document.getElementById('upFsVolumeSlider'),
      fsMinimize: document.getElementById('upFsMinimize'),
      fsAskAI: document.getElementById('upFsAskAI'),
      fsLyrics: document.getElementById('upFsLyrics'),
      fsContainer: document.getElementById('upFsContainer'),

      queuePanel: document.getElementById('upQueuePanel'),
      queueList: document.getElementById('upQueueList'),
      queueClose: document.getElementById('upQueueClose'),
      queueClear: document.getElementById('upQueueClear'),

      fmContainer: document.getElementById('upFmContainer'),
      fmLogo: document.getElementById('upFmLogo'),
      fmName: document.getElementById('upFmName'),
      fmLive: document.getElementById('upFmLive'),
      fmProgram: document.getElementById('upFmProgram'),
      fmPlayPause: document.getElementById('upFmPlayPause'),
      fmFav: document.getElementById('upFmFav'),
      fmShare: document.getElementById('upFmShare'),
      fmVolume: document.getElementById('upFmVolume'),
      fmVolumeSlider: document.getElementById('upFmVolumeSlider'),
      fmAskAI: document.getElementById('upFmAskAI'),
    };

    if (els.bottomPlayPause) els.bottomPlayPause.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
    if (els.bottomBar) els.bottomBar.addEventListener('click', () => showFullScreen());

    if (els.bottomSeek) {
      els.bottomSeek.addEventListener('input', (e) => {
        e.stopPropagation();
        draggingSeek = true;
        const pct = parseInt(e.target.value, 10) / 1000;
        const live = _liveAudio();
        const dur = (live && isFinite(live.duration) && live.duration > 0) ? live.duration : (state.duration || 0);
        _updateProgressUI(pct * 100, dur ? pct * dur : state.currentTime);
      });
      els.bottomSeek.addEventListener('change', (e) => {
        draggingSeek = false;
        e.stopPropagation();
        const pct = parseInt(e.target.value, 10) / 1000;
        _seekToPercent(pct);
      });
      els.bottomSeek.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      els.bottomSeek.addEventListener('keydown', (e) => {
        e.stopPropagation();
      });
    }

    if (els.fsPlayPause) els.fsPlayPause.addEventListener('click', togglePlay);
    if (els.fsPrev) els.fsPrev.addEventListener('click', previous);
    if (els.fsNext) els.fsNext.addEventListener('click', next);
    if (els.fsShuffle) els.fsShuffle.addEventListener('click', toggleShuffle);
    if (els.fsRepeat) els.fsRepeat.addEventListener('click', cycleRepeat);
    if (els.fsQueue) els.fsQueue.addEventListener('click', toggleQueuePanel);
    if (els.fsFav) els.fsFav.addEventListener('click', toggleFavorite);
    if (els.fsShare) els.fsShare.addEventListener('click', shareCurrent);
    if (els.fsMinimize) els.fsMinimize.addEventListener('click', hideFullScreen);
    if (els.fsAskAI) els.fsAskAI.addEventListener('click', _openAIAssistant);
    if (els.fsLyrics) els.fsLyrics.addEventListener('click', _openLyrics);

    if (els.fsVolume) els.fsVolume.addEventListener('click', toggleMute);
    if (els.fsVolumeSlider) {
      els.fsVolumeSlider.addEventListener('input', (e) => {
        setVolume(parseFloat(e.target.value));
      });
    }

    if (els.fmPlayPause) els.fmPlayPause.addEventListener('click', togglePlay);
    if (els.fmFav) els.fmFav.addEventListener('click', toggleFavorite);
    if (els.fmShare) els.fmShare.addEventListener('click', shareCurrent);
    if (els.fmAskAI) els.fmAskAI.addEventListener('click', _openAIAssistant);
    if (els.fmVolume) els.fmVolume.addEventListener('click', toggleMute);
    if (els.fmVolumeSlider) {
      els.fmVolumeSlider.addEventListener('input', (e) => {
        setVolume(parseFloat(e.target.value));
      });
    }

    if (els.queueClose) els.queueClose.addEventListener('click', hideQueuePanel);
    if (els.queueClear) els.queueClear.addEventListener('click', clearQueue);

    if (els.fsProgress) {
      _bindSeek(els.fsProgress, (pct) => _seekToPercent(pct), els.fsProgressFill, els.fsCurrentTime);
    }
  }

  function _bindSeek(bar, onSeek, fillEl, timeEl) {
    let seeking = false;
    const getPercent = (e) => {
      const rect = bar.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };
    const onMove = (e) => {
      if (!seeking) return;
      e.preventDefault();
      const pct = getPercent(e);
      const live = _liveAudio();
      const dur = (live && isFinite(live.duration) && live.duration > 0) ? live.duration : (state.duration || 0);
      if (fillEl) fillEl.style.width = (pct * 100) + '%';
      if (timeEl && dur) timeEl.textContent = _fmtTime(pct * dur);
    };
    const onEnd = (e) => {
      if (!seeking) return;
      seeking = false;
      const pct = getPercent(e.changedTouches ? e.changedTouches[0] : e);
      onSeek(pct);
    };
    bar.addEventListener('mousedown', (e) => { seeking = true; onMove(e); document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onEnd, { once: true }); });
    bar.addEventListener('touchstart', (e) => { seeking = true; onMove(e); document.addEventListener('touchmove', onMove, { passive: false }); document.addEventListener('touchend', onEnd, { once: true }); }, { passive: true });
  }

  /* ═══════════════════════════════════════════
     CORE API
     ═══════════════════════════════════════════ */
  function playSong(track, queue, index) {
    if (!track) return;
    state.mode = 'songs';
    state.isLive = !!(track.streamUrl && !track.audioUrl);
    state.track = track;
    state.queue = queue || [track];
    state.queueIndex = (index !== undefined && index >= 0) ? index : 0;
    _updateShuffleOrder();
    _loadAndPlay(track);
    _showBottomBar();
    _updateTrackUI();
    _saveState();
    _emitEvent('trackChange', track);
  }

  function playFM(station) {
    if (!station) return;
    state.mode = 'fm';
    state.isLive = true;
    state.track = station;
    state.queue = [station];
    state.queueIndex = 0;
    const src = station.streamUrl || station.audioUrl;
    if (src) {
      audio.src = src;
      audio.load();
      audio.play().catch(() => {});
    }
    _showBottomBar();
    _showFMPlayer();
    _updateTrackUI();
    _saveState();
    _emitEvent('trackChange', station);
  }

  function play() {
    if (state.externalEngine) {
      if (typeof window.resumePlayback === 'function') { window.resumePlayback(); return; }
      const live = _liveAudio();
      if (live && live.src) live.play().catch(() => {});
      return;
    }
    if (!audio.src && state.track) {
      const src = state.track.audioUrl || state.track.streamUrl;
      if (src) {
        audio.src = src;
        audio.load();
      }
    }
    audio.play().catch(() => {});
  }

  function pause() {
    if (state.externalEngine) {
      if (typeof window.pausePlayback === 'function') { window.pausePlayback(); return; }
      const live = _liveAudio();
      if (live) live.pause();
      return;
    }
    audio.pause();
  }

  function togglePlay() {
    if (state.externalEngine) {
      if (typeof window.togglePlayPause === 'function') { window.togglePlayPause(); return; }
      const live = _liveAudio();
      if (live && !live.paused && (live.currentTime > 0 || audioPlayerCurrentSrc(live))) pause();
      else play();
      return;
    }
    if (state.isPlaying) pause();
    else play();
  }

  function audioPlayerCurrentSrc(el) {
    return el && el.src && el.src !== 'about:blank' && el.src !== '';
  }

  function _seekToPercent(pct) {
    pct = Math.max(0, Math.min(1, pct));
    if (state.externalEngine && typeof window.seekPlaybackToPercent === 'function') {
      window.seekPlaybackToPercent(pct);
      return;
    }
    const live = _liveAudio();
    if (live && isFinite(live.duration) && live.duration > 0) {
      live.currentTime = pct * live.duration;
    }
    state.currentTime = pct * (state.duration || 0);
    _updateProgressUI();
  }

  function stop() {
    audio.pause();
    audio.currentTime = 0;
    state.isPlaying = false;
    state.currentTime = 0;
    _updatePlayUI();
    _updateProgressUI();
  }

  function next() {
    if (state.externalEngine) {
      if (typeof window.playNextTrack === 'function') { window.playNextTrack(); return; }
      const live = _liveAudio();
      if (live && live.src) {
        live.currentTime = live.duration || 0;
        live.pause();
      }
      return;
    }
    if (state.queue.length === 0) return;
    if (state.shuffle) {
      state.queueIndex = Math.floor(Math.random() * state.queue.length);
    } else {
      state.queueIndex = (state.queueIndex + 1) % state.queue.length;
    }
    _loadAndPlay(state.queue[state.queueIndex]);
    _updateTrackUI();
    _saveState();
    _emitEvent('trackChange', state.queue[state.queueIndex]);
  }

  function previous() {
    if (state.externalEngine) {
      if (typeof window.playPreviousTrack === 'function') { window.playPreviousTrack(); return; }
      const live = _liveAudio();
      if (live) live.currentTime = 0;
      return;
    }
    if (state.queue.length === 0) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (state.shuffle) {
      state.queueIndex = Math.floor(Math.random() * state.queue.length);
    } else {
      state.queueIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
    }
    _loadAndPlay(state.queue[state.queueIndex]);
    _updateTrackUI();
    _saveState();
    _emitEvent('trackChange', state.queue[state.queueIndex]);
  }

  function seek(time) {
    if (state.externalEngine && state.duration > 0) {
      _seekToPercent(time / state.duration);
      return;
    }
    if (audio.duration) {
      audio.currentTime = Math.max(0, Math.min(time, audio.duration));
    }
  }

  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, v));
    audio.volume = state.volume;
    state.muted = state.volume === 0;
    audio.muted = state.muted;
    if (window.audioPlayer) {
      window.audioPlayer.volume = state.volume;
      window.audioPlayer.muted = state.muted;
    }
    _updateVolumeUI();
    _saveState();
  }

  function toggleMute() {
    if (state.muted) {
      state.muted = false;
      audio.muted = false;
      if (window.audioPlayer) window.audioPlayer.muted = false;
      if (state.volume === 0) state.volume = state.previousVolume || 0.5;
      audio.volume = state.volume;
      if (window.audioPlayer) window.audioPlayer.volume = state.volume;
    } else {
      state.previousVolume = state.volume;
      state.muted = true;
      audio.muted = true;
      if (window.audioPlayer) window.audioPlayer.muted = true;
    }
    _updateVolumeUI();
    _saveState();
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    if (state.shuffle) _updateShuffleOrder();
    _updateShuffleUI();
    _saveState();
  }

  function cycleRepeat() {
    if (state.repeat === 'off') state.repeat = 'all';
    else if (state.repeat === 'all') state.repeat = 'one';
    else state.repeat = 'off';
    _updateRepeatUI();
    _saveState();
  }

  function addToQueue(track) {
    state.queue.push(track);
    _renderQueue();
    _saveState();
  }

  function removeFromQueue(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.queue.splice(index, 1);
    if (index < state.queueIndex) state.queueIndex--;
    if (state.queueIndex >= state.queue.length) state.queueIndex = 0;
    _renderQueue();
    _saveState();
  }

  function clearQueue() {
    const current = state.queue[state.queueIndex];
    state.queue = current ? [current] : [];
    state.queueIndex = current ? 0 : -1;
    _renderQueue();
    _saveState();
  }

  function toggleFavorite() {
    if (!state.track) return;
    const id = state.track.id || state.track.videoId || state.track.title;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
    } else {
      state.favorites.add(id);
    }
    _updateFavUI();
    _saveState();
    _persistFavorites();
  }

  function shareCurrent() {
    if (!state.track) return;
    const title = state.track.title || state.track.name || 'Tamil AI Stream';
    const shareData = {
      title,
      text: `Listen to ${title} on Tamil AI Stream`,
      url: window.location.href,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareData.text + '\n' + shareData.url).then(() => {
        if (typeof window.showToast === 'function') window.showToast('Link copied!', 'success');
      }).catch(() => {});
    }
  }

  /* ─── UI Show/Hide ─── */
  function _showBottomBar() {
    if (els.bottomBar) els.bottomBar.classList.add('visible');
  }

  function hideBottomBar() {
    if (els.bottomBar) els.bottomBar.classList.remove('visible');
  }

  function showFullScreen() {
    if (!els.fullScreen) return;
    els.fullScreen.classList.add('open');
    document.body.classList.add('up-fullscreen-open');
    if (state.mode === 'fm') _showFMPlayer();
    else _showSongPlayer();
    _updateTrackUI();
    _updateProgressUI();
    _updatePlayUI();
    _updateVolumeUI();
    _updateFavUI();
    _updateShuffleUI();
    _updateRepeatUI();
    _startAIAnimation();
  }

  function hideFullScreen() {
    if (els.fullScreen) els.fullScreen.classList.remove('open');
    document.body.classList.remove('up-fullscreen-open');
    _stopAIAnimation();
  }

  function _showSongPlayer() {
    if (els.fsContainer) els.fsContainer.style.display = '';
    if (els.fmContainer) els.fmContainer.style.display = 'none';
  }

  function _showFMPlayer() {
    if (els.fsContainer) els.fsContainer.style.display = 'none';
    if (els.fmContainer) els.fmContainer.style.display = '';
  }

  function toggleQueuePanel() {
    if (!els.queuePanel) return;
    const isOpen = els.queuePanel.classList.contains('open');
    if (isOpen) hideQueuePanel();
    else showQueuePanel();
  }

  function showQueuePanel() {
    _renderQueue();
    if (els.queuePanel) els.queuePanel.classList.add('open');
  }

  function hideQueuePanel() {
    if (els.queuePanel) els.queuePanel.classList.remove('open');
  }

  /* ═══════════════════════════════════════════
     INTERNAL UI UPDATES
     ═══════════════════════════════════════════ */
  function _loadAndPlay(track) {
    const src = track.audioUrl || track.streamUrl;
    if (!src) return;
    audio.src = src;
    audio.load();
    audio.play().catch(() => {});
    state.isPlaying = true;
    _updatePlayUI();
    _updateTrackUI();
    _startAIAnimation();
  }

  function _updateTrackUI() {
    const t = state.track;
    if (!t) return;
    const title = t.title || t.name || 'Unknown';
    const artist = t.artist || t.album || (state.mode === 'fm' ? 'Live FM' : 'Unknown Artist');
    const art = t.art || t.thumbnail || t.thumbnailUrl || '';
    const movie = t.movie || t.movieName || '';

    let meta = '';
    if (state.mode === 'fm') {
      meta = [t.freq, t.genre, t.program].filter(Boolean).join(' • ') || 'Live';
    } else {
      meta = [movie, t.album && t.album !== movie ? t.album : '', t.label && t.label !== movie ? t.label : '']
        .filter(Boolean)
        .join(' • ');
    }

    /* Bottom bar */
    _setText(els.bottomTitle, title);
    _setText(els.bottomArtist, artist);
    _setText(els.bottomMeta, meta);
    if (els.bottomArt) {
      if (art) els.bottomArt.innerHTML = `<img src="${_escHTML(art)}" alt="">`;
      else els.bottomArt.innerHTML = `<i class="fas ${state.mode === 'fm' ? 'fa-radio' : 'fa-music'}"></i>`;
    }

    /* Full screen song player */
    _setText(els.fsTitle, title);
    _setText(els.fsArtist, artist);
    if (els.fsArtwork) {
      if (art) els.fsArtwork.innerHTML = `<img src="${_escHTML(art)}" alt="" class="up-fs-art-img">`;
      else els.fsArtwork.innerHTML = `<i class="fas ${state.mode === 'fm' ? 'fa-radio' : 'fa-music'} up-fs-art-icon"></i>`;
    }
    if (els.fsBlurBG) {
      if (art) els.fsBlurBG.style.backgroundImage = `url('${_escHTML(art)}')`;
      else els.fsBlurBG.style.backgroundImage = '';
    }

    /* FM player */
    if (state.mode === 'fm') {
      if (els.fmName) els.fmName.textContent = t.name || t.title || 'FM Station';
      if (els.fmLogo) {
        if (art) els.fmLogo.innerHTML = `<img src="${_escHTML(art)}" alt="">`;
        else els.fmLogo.innerHTML = `<i class="fas fa-radio"></i>`;
      }
      if (els.fmProgram) els.fmProgram.textContent = t.program || t.artist || 'Live Now';
      if (els.fmLive) els.fmLive.classList.add('visible');
    }
  }

  function _updatePlayUI() {
    const icon = state.isPlaying ? 'fa-pause' : 'fa-play';
    const iconClass = state.mode === 'fm' ? 'fa-stop' : 'fa-backward-step';

    _setBtnIcon(els.bottomPlayPause, state.isPlaying ? 'fa-pause' : 'fa-play');
    _setBtnIcon(els.fsPlayPause, state.isPlaying ? 'fa-pause' : 'fa-play');
    _setBtnIcon(els.fmPlayPause, state.isPlaying ? 'fa-pause' : 'fa-play');

    if (els.bottomPlayPause) els.bottomPlayPause.classList.toggle('playing', state.isPlaying);
    if (els.fsPlayPause) els.fsPlayPause.classList.toggle('playing', state.isPlaying);
    if (els.fmPlayPause) els.fmPlayPause.classList.toggle('playing', state.isPlaying);

    if (els.bottomArt) els.bottomArt.classList.toggle('spinning', state.isPlaying);
    if (els.fsArtwork) els.fsArtwork.classList.toggle('spinning', state.isPlaying);
  }

  function _updateProgressUI(forcePct, forceTime) {
    const dur = (state.isLive || _liveAudio() === audio) && state.duration <= 0 ? 0 : state.duration;

    let pct = 0;
    if (forcePct !== undefined && forcePct !== null) {
      pct = forcePct;
    } else if (dur > 0) {
      pct = (state.currentTime / dur) * 100;
    }
    pct = Math.max(0, Math.min(100, pct));

    let shownTime = state.currentTime;
    if (forceTime !== undefined && forceTime !== null && isFinite(forceTime)) shownTime = forceTime;

    if (els.bottomProgressFill) els.bottomProgressFill.style.width = pct + '%';
    if (els.fsProgressFill) els.fsProgressFill.style.width = pct + '%';
    if (els.bottomCurrentTime) els.bottomCurrentTime.textContent = _fmtTime(shownTime);
    if (els.fsCurrentTime) els.fsCurrentTime.textContent = _fmtTime(shownTime);
    if (els.bottomDuration) els.bottomDuration.textContent = dur > 0 ? _fmtTime(dur) : (state.isLive ? 'LIVE' : '0:00');
    if (els.fsDuration) els.fsDuration.textContent = dur > 0 ? _fmtTime(dur) : (state.isLive ? 'LIVE' : '0:00');
    if (els.bottomSeek) {
      const max = 1000;
      const val = Math.round((pct / 100) * max);
      if (!draggingSeek || forcePct !== undefined && forcePct !== null) {
        els.bottomSeek.value = val;
      }
      els.bottomSeek.style.background = `linear-gradient(to right, #34d399 ${pct}%, rgba(255,255,255,0.18) ${pct}%)`;
      els.bottomSeek.disabled = state.isLive;
    }
  }

  function _updateVolumeUI() {
    const vol = state.muted ? 0 : state.volume;
    const icon = vol === 0 ? 'fa-volume-xmark' : vol < 0.5 ? 'fa-volume-low' : 'fa-volume-high';
    _setBtnIcon(els.fsVolume, icon);
    _setBtnIcon(els.fmVolume, icon);
    if (els.fsVolumeSlider) els.fsVolumeSlider.value = vol;
    if (els.fmVolumeSlider) els.fmVolumeSlider.value = vol;
  }

  function _updateFavUI() {
    if (!state.track) return;
    const id = state.track.id || state.track.videoId || state.track.title;
    const isFav = state.favorites.has(id);
    if (els.fsFav) {
      els.fsFav.classList.toggle('active', isFav);
      _setBtnIcon(els.fsFav, isFav ? 'fa-heart' : 'fa-heart');
      els.fsFav.classList.toggle('favorited', isFav);
    }
    if (els.fmFav) {
      els.fmFav.classList.toggle('active', isFav);
      _setBtnIcon(els.fmFav, isFav ? 'fa-heart' : 'fa-heart');
      els.fmFav.classList.toggle('favorited', isFav);
    }
  }

  function _updateShuffleUI() {
    if (els.fsShuffle) els.fsShuffle.classList.toggle('active', state.shuffle);
  }

  function _updateRepeatUI() {
    if (els.fsRepeat) {
      els.fsRepeat.classList.toggle('active', state.repeat !== 'off');
      els.fsRepeat.classList.toggle('repeat-one', state.repeat === 'one');
    }
  }

  function _renderQueue() {
    if (!els.queueList) return;
    els.queueList.innerHTML = state.queue.map((track, i) => {
      const isCurrent = i === state.queueIndex;
      const title = track.title || track.name || 'Unknown';
      const artist = track.artist || track.album || '';
      const art = track.art || track.thumbnail || track.thumbnailUrl || '';
      return `<div class="up-queue-item${isCurrent ? ' current' : ''}" data-index="${i}">
        <div class="up-queue-num">${isCurrent ? '<i class="fas fa-volume-high"></i>' : (i + 1)}</div>
        <div class="up-queue-art">${art ? `<img src="${_escHTML(art)}" alt="">` : `<i class="fas fa-music"></i>`}</div>
        <div class="up-queue-info">
          <div class="up-queue-title">${_escHTML(title)}</div>
          <div class="up-queue-artist">${_escHTML(artist)}</div>
        </div>
        <button class="up-queue-remove" data-rm-index="${i}" aria-label="Remove"><i class="fas fa-times"></i></button>
      </div>`;
    }).join('');

    els.queueList.querySelectorAll('.up-queue-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.up-queue-remove')) return;
        const idx = parseInt(item.dataset.index);
        state.queueIndex = idx;
        _loadAndPlay(state.queue[idx]);
        _updateTrackUI();
        _saveState();
      });
    });

    els.queueList.querySelectorAll('.up-queue-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromQueue(parseInt(btn.dataset.rmIndex));
      });
    });
  }

  /* ═══════════════════════════════════════════
     GESTURES
     ═══════════════════════════════════════════ */
  function _bindGestures() {
    const target = els.fsContainer || els.fullScreen;
    if (!target) return;
    let startX = 0, startY = 0, tracking = false;
    const THRESHOLD = 60;

    target.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    }, { passive: true });

    target.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < THRESHOLD && absDy < THRESHOLD) return;

      if (absDx > absDy) {
        if (dx > THRESHOLD) previous();
        else if (dx < -THRESHOLD) next();
      } else {
        if (dy > THRESHOLD) hideFullScreen();
        else if (dy < -THRESHOLD) showQueuePanel();
      }
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════
     KEYBOARD SHORTCUTS
     ═══════════════════════════════════════════ */
  function _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); next(); }
          break;
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); previous(); }
          break;
        case 'ArrowUp':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); setVolume(state.volume + 0.05); }
          break;
        case 'ArrowDown':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); setVolume(state.volume - 0.05); }
          break;
      }
    });
  }

  /* ═══════════════════════════════════════════
     AI AUDIO-REACTIVE ANIMATION
     ═══════════════════════════════════════════ */
  function _initAudioContext() {
    if (audioCtx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      sourceNode = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch (e) {
      console.warn('[UnifiedPlayer] Web Audio API unavailable');
    }
  }

  function _startAIAnimation() {
    const canvas = els.fsAICanvas;
    if (!canvas || !state.isPlaying || state.mode !== 'songs') return;

    _initAudioContext();
    if (!analyser) return;

    canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    aiCanvasCtx = canvas.getContext('2d');
    const ctx = aiCanvasCtx;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const baseR = Math.min(W, H) * 0.38;
    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);

    function draw() {
      if (!state.isPlaying) return;
      aiAnimFrame = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);

      ctx.clearRect(0, 0, W, H);

      const avg = data.reduce((a, b) => a + b, 0) / bufLen;
      const norm = avg / 255;
      const pulse = 1 + norm * 0.08;

      /* Glow */
      const glow = ctx.createRadialGradient(cx, cy, baseR * 0.8, cx, cy, baseR * 1.5);
      glow.addColorStop(0, `rgba(52, 211, 153, ${0.12 + norm * 0.15})`);
      glow.addColorStop(1, 'rgba(52, 211, 153, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 1.5 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      /* Ring segments */
      const segments = bufLen;
      const step = (Math.PI * 2) / segments;
      ctx.beginPath();
      for (let i = 0; i < segments; i++) {
        const val = data[i] / 255;
        const r = baseR + val * baseR * 0.35;
        const angle = step * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * r * pulse;
        const y = cy + Math.sin(angle) * r * pulse;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(52, 211, 153, ${0.3 + norm * 0.4})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      /* Dots at peaks */
      for (let i = 0; i < segments; i += 4) {
        const val = data[i] / 255;
        if (val > 0.4) {
          const r = baseR + val * baseR * 0.35;
          const angle = step * i - Math.PI / 2;
          const x = cx + Math.cos(angle) * r * pulse;
          const y = cy + Math.sin(angle) * r * pulse;
          ctx.beginPath();
          ctx.arc(x, y, 2 + val * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${0.5 + val * 0.5})`;
          ctx.fill();
        }
      }
    }
    draw();
  }

  function _stopAIAnimation() {
    if (aiAnimFrame) {
      cancelAnimationFrame(aiAnimFrame);
      aiAnimFrame = null;
    }
  }

  /* ═══════════════════════════════════════════
     PROGRESS LOOP
     ═══════════════════════════════════════════ */
  function _startProgressLoop() {
    if (_progressLoopRunning) return;
    _progressLoopRunning = true;
    function tick() {
      if (!_progressLoopRunning) return;
      rafId = requestAnimationFrame(tick);

      _adoptExternalEngine();

      const live = _liveAudio();
      if (!live) { _updatePlayUI(); return; }

      const playing = !live.paused;
      const prevPlaying = state.isPlaying;
      state.isPlaying = playing;
      if (playing !== prevPlaying) {
        _updatePlayUI();
        if (playing) _startAIAnimation(); else _stopAIAnimation();
      }

      if (!draggingSeek) {
        state.currentTime = live.currentTime || 0;
        if (isFinite(live.duration) && live.duration > 0) state.duration = live.duration;
        else if (state.isLive) state.duration = 0;
      }

      _updateProgressUI();
    }
    tick();
  }

  /* ═══════════════════════════════════════════
     MEDIA SESSION
     ═══════════════════════════════════════════ */
  function _updateMediaSession() {
    if (!('mediaSession' in navigator) || !state.track) return;
    const t = state.track;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title || t.name || 'Unknown',
      artist: t.artist || t.album || '',
      artwork: t.art || t.thumbnail ? [{ src: t.art || t.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('previoustrack', previous);
    navigator.mediaSession.setActionHandler('nexttrack', next);
  }

  /* ═══════════════════════════════════════════
     STATE PERSISTENCE
     ═══════════════════════════════════════════ */
  function _saveState() {
    try {
      const data = {
        mode: state.mode,
        track: state.track,
        queue: state.queue,
        queueIndex: state.queueIndex,
        volume: state.volume,
        muted: state.muted,
        shuffle: state.shuffle,
        repeat: state.repeat,
        currentTime: audio.currentTime || 0,
        favorites: Array.from(state.favorites),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function _restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        _restoreFromScriptState();
        return;
      }
      const data = JSON.parse(raw);
      if (data.favorites) state.favorites = new Set(data.favorites);
      if (data.volume !== undefined) {
        state.volume = data.volume;
        audio.volume = state.volume;
      }
      if (data.muted !== undefined) {
        state.muted = data.muted;
        audio.muted = state.muted;
      }
      if (data.shuffle !== undefined) state.shuffle = data.shuffle;
      if (data.repeat) state.repeat = data.repeat;
      if (data.track && data.queue) {
        state.mode = data.mode || 'songs';
        state.track = data.track;
        state.queue = data.queue;
        state.queueIndex = data.queueIndex || 0;
        _showBottomBar();
        _updateTrackUI();
        _updateFavUI();
        _updateVolumeUI();
        _updateShuffleUI();
        _updateRepeatUI();
        if (data.currentTime > 0) {
          const src = data.track.audioUrl || data.track.streamUrl;
          if (src) {
            audio.src = src;
            audio.load();
            audio.currentTime = data.currentTime;
          }
        }
      }
    } catch (e) {}
  }

  /** Fallback: adopt script.js's persisted playback state (UI only, no autoplay).
   *  script.js owns playback + position persistence via tamilAIStream_player_state,
   *  so page navigation / PWA minimize / return restores the same position & state. */
  function _restoreFromScriptState() {
    try {
      const data = JSON.parse(localStorage.getItem('tamilAIStream_player_state') || '{}');
      const track = data.currentPlaybackTrack || data.currentStation || null;
      if (!track) return;
      state.track = track;
      state.mode = data.currentPlaybackMode || (data.currentStation && !data.currentPlaybackTrack ? 'fm' : 'songs');
      state.isLive = !!(track.streamUrl && !track.audioUrl);
      state.currentTime = typeof data.progress === 'number' ? data.progress : 0;
      state.duration = typeof data.duration === 'number' ? data.duration : 0;
      state.externalEngine = true;
      _showBottomBar();
      _updateTrackUI();
      _updatePlayUI();
      _updateProgressUI();
    } catch (e) { /* ignore */ }
  }

  function _persistFavorites() {
    try {
      localStorage.setItem('tamilai_favorites', JSON.stringify(Array.from(state.favorites)));
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════
     EVENT SYSTEM
     ═══════════════════════════════════════════ */
  const _listeners = {};
  function on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  }
  function _emitEvent(event, data) {
    (_listeners[event] || []).forEach(fn => {
      try { fn(data); } catch (e) {}
    });
  }

  /* ═══════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════ */
  function _fmtTime(sec) {
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function _setText(el, text) {
    if (el) el.textContent = text;
  }
  function _setBtnIcon(el, iconClass) {
    if (!el) return;
    const i = el.querySelector('i');
    if (i) i.className = 'fas ' + iconClass;
  }
  function _escHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _updateShuffleOrder() {
    state._shuffleOrder = state.queue.map((_, i) => i).sort(() => Math.random() - 0.5);
  }
  function _openAIAssistant() {
    if (typeof window.navigateTo === 'function') window.navigateTo('ai-assistant');
    else if (typeof window.YTMusic !== 'undefined' && YTMusic.navigateTo) YTMusic.navigateTo('ai-assistant');
  }
  function _openLyrics() {
    const panel = document.getElementById('ytmLyricsPanel');
    if (panel) panel.classList.toggle('open');
  }

  function _setupServiceWorker() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SYNC_PLAYER_STATE',
        state: { isPlaying: state.isPlaying, track: state.track }
      });
    }
  }

  /* ═══════════════════════════════════════════
     BACKWARD COMPAT SHIMS
     Expose window.PlayerEngine, window.GlobalPlayer,
     window.MiniAudioPlayer, window.PlayerUI that
     delegate to UnifiedPlayer so all existing
     code continues to work.
     ═══════════════════════════════════════════ */
  function _installShims() {
    /* PlayerEngine shim */
    window.PlayerEngine = {
      init: () => {},
      get audio() { return audio; },
      get currentTrack() { return state.track; },
      get queue() { return state.queue; },
      get queueIndex() { return state.queueIndex; },
      get isPlaying() { return state.isPlaying; },
      get volume() { return state.volume; },
      get shuffle() { return state.shuffle; },
      get repeat() { return state.repeat; },
      set volume(v) { setVolume(v); },
      set shuffle(v) { state.shuffle = v; _updateShuffleUI(); },

      playTrack: (track, queue, idx) => playSong(track, queue, idx),
      play: play,
      pause: pause,
      togglePlay: togglePlay,
      playNext: next,
      playPrevious: previous,
      next: next,
      previous: previous,
      stop: stop,
      seek: seek,
      setVolume: setVolume,
      toggleMute: toggleMute,
      toggleShuffle: toggleShuffle,
      cycleRepeat: cycleRepeat,
      addToQueue: addToQueue,
      removeFromQueue: removeFromQueue,
      clearQueue: () => { clearQueue(); },
      setSleepTimer: (min) => {
        if (typeof window.showToast === 'function') window.showToast(`Sleep timer: ${min} min`, 'info');
      },
      setEqBand: () => {},
      getAudioElement: () => audio,
      getAudioContext: () => { _initAudioContext(); return audioCtx; },
      getAnalyser: () => { _initAudioContext(); return analyser; },
      getState: () => ({
        isPlaying: state.isPlaying,
        currentTime: state.currentTime,
        duration: state.duration,
        volume: state.volume,
        muted: state.muted,
        track: state.track,
      }),
      syncState: _saveState,
      saveState: _saveState,
      on: on,
      _listeners: {},
    };

    /* GlobalPlayer shim */
    window.GlobalPlayer = {
      init: () => {},
      get state() { return {
        track: state.track,
        currentTime: state.currentTime,
        duration: state.duration,
        isLive: state.isLive,
        isPlaying: state.isPlaying,
      }; },
      set state(v) {
        if (v && v.track !== undefined) state.track = v.track;
        if (v && v.currentTime !== undefined) state.currentTime = v.currentTime;
        if (v && v.isLive !== undefined) state.isLive = v.isLive;
      },
      togglePlay: togglePlay,
      play: play,
      pause: pause,
      next: next,
      previous: previous,
      showMiniPlayer: _showBottomBar,
      hideMiniPlayer: hideBottomBar,
      toggleQueue: toggleQueuePanel,
      updateTrackUI: _updateTrackUI,
      updatePlayUI: _updatePlayUI,
      updateLiveUI: () => {},
      updateProgressUI: _updateProgressUI,
      updateVolumeUI: _updateVolumeUI,
    };

    /* MiniAudioPlayer shim */
    window.MiniAudioPlayer = {
      isOpen: els.bottomBar && els.bottomBar.classList.contains('visible'),
      openPopup: (track, opts) => {
        if (opts && opts.queue) playSong(track, opts.queue, opts.index || 0);
        else playSong(track);
      },
      closePopup: hideBottomBar,
      syncPlayingUI: () => _updatePlayUI(),
      syncPausedUI: () => _updatePlayUI(),
    };

    /* PlayerUI shim */
    window.PlayerUI = {
      init: () => {},
      updateUI: _updateTrackUI,
    };
  }

  /* ═══════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════ */
  return {
    init,
    playSong,
    playFM,
    play,
    pause,
    togglePlay,
    stop,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    addToQueue,
    removeFromQueue,
    clearQueue,
    toggleFavorite,
    shareCurrent,
    showFullScreen,
    hideFullScreen,
    showBottomBar,
    hideBottomBar,
    showQueuePanel,
    hideQueuePanel,
    toggleQueuePanel,
    on,
    get state() { return { ...state }; },
    get audio() { return audio; },
    getAudioContext: () => { _initAudioContext(); return audioCtx; },
    getAnalyser: () => { _initAudioContext(); return analyser; },
    getAudioElement: () => audio,
    getState: () => ({
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      duration: state.duration,
      volume: state.volume,
      muted: state.muted,
      track: state.track,
      queue: state.queue,
      queueIndex: state.queueIndex,
      shuffle: state.shuffle,
      repeat: state.repeat,
      mode: state.mode,
      isLive: state.isLive,
    }),
    syncState: _saveState,
    saveState: _saveState,
    /** Sync track/queue state from script.js without starting audio.
     *  Used during the transitional period while script.js still owns the audio element. */
    syncFromScript: (track, queue, queueIndex, isLive) => {
      state.track = track || state.track;
      if (queue) state.queue = queue;
      if (queueIndex !== undefined) state.queueIndex = queueIndex;
      state.isLive = !!isLive;
      state.mode = isLive ? 'fm' : 'songs';
      state.externalEngine = !!window.audioPlayer;
      _showBottomBar();
      _updateTrackUI();
      _updateFavUI();
      _updatePlayUI();
      _saveState();
    },
    /** Update play/pause UI without changing audio state. */
    syncPlayState: (playing) => {
      if (playing) state.externalEngine = !!window.audioPlayer;
      state.isPlaying = playing;
      _updatePlayUI();
      if (playing) _startAIAnimation();
      else _stopAIAnimation();
    },
  };
})();

/* Auto-init shims immediately so they are available even before DOMContentLoaded */
if (typeof window !== 'undefined') {
  try { UnifiedPlayer.init && UnifiedPlayer.init(); } catch(e) {}
}
