'use strict';

/* ============================================
   GlobalPlayer - Permanent Bottom Player
   Unified interface for script.js audioPlayer
   and PlayerEngine. Always visible, premium
   glassmorphism design, FM support, seeking fix.
   ============================================ */

const GlobalPlayer = (() => {
    let miniEl = null;
    let expandedEl = null;
    let isExpanded = false;
    let isDragging = false;
    let waveformRAF = null;
    let eqRAF = null;
    let _lyricsRAF = null;
    let _currentLyrics = [];
    let _activeAudio = null;

    /* ---- State ---- */
    const state = {
        isPlaying: false,
        isLive: false,
        stationName: '',
        track: null,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        queue: [],
        queueIndex: -1,
        shuffle: false,
        repeat: 'off'
    };

    /* ---- Color Themes ---- */
    const THEMES = [
        { name: 'Emerald', grad: 'linear-gradient(135deg,#34d399,#3b82f6)', glow: 'rgba(52,211,153,0.5)', accent: '#34d399' },
        { name: 'Sunset', grad: 'linear-gradient(135deg,#f97316,#ef4444)', glow: 'rgba(249,115,22,0.5)', accent: '#f97316' },
        { name: 'Purple', grad: 'linear-gradient(135deg,#a855f7,#6366f1)', glow: 'rgba(168,85,247,0.5)', accent: '#a855f7' },
        { name: 'Ocean', grad: 'linear-gradient(135deg,#06b6d4,#3b82f6)', glow: 'rgba(6,182,212,0.5)', accent: '#06b6d4' },
        { name: 'Pink', grad: 'linear-gradient(135deg,#ec4899,#f97316)', glow: 'rgba(236,72,153,0.5)', accent: '#ec4899' },
        { name: 'Lime', grad: 'linear-gradient(135deg,#84cc16,#34d399)', glow: 'rgba(132,204,22,0.5)', accent: '#84cc16' }
    ];
    let themeIdx = 0;

    /* ============================================
       INIT
       ============================================ */
    function init() {
        injectStyles();
        createMiniPlayer();
        createExpandedPlayer();
        bindEvents();
        hookAudioSources();
        startEqAnimation();
        drawMiniWaveform();

        // Restore state from PlayerEngine or localStorage
        try {
            const saved = JSON.parse(localStorage.getItem('global_player_state') || '{}');
            if (saved.themeIdx !== undefined) { themeIdx = saved.themeIdx; applyTheme(); }
            if (saved.volume !== undefined) state.volume = saved.volume;
        } catch (e) {}

        // Restore track info if something was playing before page load
        setTimeout(() => {
            const track = state.track || getCurrentTrackFromScript();
            if (track) updateTrackUI();
        }, 500);
    }

    /* ============================================
       MINI PLAYER
       ============================================ */
    function createMiniPlayer() {
        if (document.getElementById('gp-mini')) return;
        const el = document.createElement('div');
        el.id = 'gp-mini';
        el.className = 'gp-mini';
        el.innerHTML = `
            <div class="gp-mini-progress" id="gpMiniProgress">
                <div class="gp-mini-progress-bar" id="gpMiniBar"></div>
                <div class="gp-mini-progress-buffered" id="gpMiniBuffered"></div>
                <div class="gp-mini-progress-thumb" id="gpMiniThumb"></div>
            </div>
            <div class="gp-mini-inner">
                <div class="gp-mini-artwork" id="gpMiniArtwork">
                    <div class="gp-mini-art-img" id="gpMiniArtImg"></div>
                    <div class="gp-mini-eq" id="gpMiniEq">
                        <span></span><span></span><span></span><span></span>
                    </div>
                </div>
                <div class="gp-mini-info" id="gpMiniInfo">
                    <div class="gp-mini-live" id="gpMiniLive" style="display:none;">
                        <span class="gp-live-dot"></span><span>LIVE</span>
                    </div>
                    <div class="gp-mini-title" id="gpMiniTitle">Tamil AI Stream</div>
                    <div class="gp-mini-artist" id="gpMiniArtist">Select a song to play</div>
                    <div class="gp-mini-time">
                        <span id="gpMiniCur">0:00</span>
                        <span id="gpMiniDur">0:00</span>
                    </div>
                </div>
                <div class="gp-mini-wave" id="gpMiniWave">
                    <canvas id="gpMiniWaveCanvas"></canvas>
                </div>
                <div class="gp-mini-controls">
                    <button class="gp-btn gp-mini-prev" id="gpMiniPrev" title="Previous"><i class="fas fa-backward-step"></i></button>
                    <button class="gp-btn gp-mini-play" id="gpMiniPlay" title="Play"><i class="fas fa-play"></i></button>
                    <button class="gp-btn gp-mini-next" id="gpMiniNext" title="Next"><i class="fas fa-forward-step"></i></button>
                </div>
                <div class="gp-mini-right">
                    <button class="gp-btn gp-mini-fav" id="gpMiniFav" title="Favorite"><i class="far fa-heart"></i></button>
                    <button class="gp-btn gp-mini-expand" id="gpMiniExpand" title="Expand"><i class="fas fa-chevron-up"></i></button>
                </div>
            </div>
            <div class="gp-mini-np" id="gpMiniNp">
                <span class="gp-np-dot"></span>
                <span id="gpNpText">Now Playing</span>
            </div>
        `;
        document.body.appendChild(el);
        miniEl = el;
    }

    /* ============================================
       EXPANDED PLAYER
       ============================================ */
    function createExpandedPlayer() {
        if (document.getElementById('gp-expanded')) return;
        const el = document.createElement('div');
        el.id = 'gp-expanded';
        el.className = 'gp-expanded';
        el.innerHTML = `
            <div class="gp-exp-bg" id="gpExpBg"></div>
            <div class="gp-exp-container">
                <div class="gp-exp-header">
                    <button class="gp-btn gp-exp-collapse" id="gpExpCollapse" title="Minimize">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="gp-exp-source">
                        <span>Playing from</span>
                        <strong id="gpExpSource">Tamil AI Stream</strong>
                    </div>
                    <button class="gp-btn gp-exp-theme" id="gpExpTheme" title="Color Theme">
                        <i class="fas fa-palette"></i>
                    </button>
                </div>

                <div class="gp-exp-artwork-wrap">
                    <div class="gp-exp-artwork" id="gpExpArtwork">
                        <div class="gp-exp-art-img" id="gpExpArtImg"></div>
                        <div class="gp-exp-art-glow"></div>
                    </div>
                    <canvas class="gp-exp-visualizer" id="gpExpVisualizer"></canvas>
                </div>

                <div class="gp-exp-info">
                    <div class="gp-exp-title" id="gpExpTitle">Select a song</div>
                    <div class="gp-exp-artist" id="gpExpArtist">Tamil AI Stream</div>
                    <div class="gp-exp-live" id="gpExpLive" style="display:none;">
                        <span class="gp-live-dot"></span><span>LIVE FM</span>
                    </div>
                </div>

                <div class="gp-exp-progress">
                    <div class="gp-exp-bar-wrap" id="gpExpBarWrap">
                        <div class="gp-exp-bar" id="gpExpBar"></div>
                        <div class="gp-exp-bar-thumb" id="gpExpBarThumb"></div>
                    </div>
                    <div class="gp-exp-time">
                        <span id="gpExpCur">0:00</span>
                        <span id="gpExpDur">0:00</span>
                    </div>
                </div>

                <div class="gp-exp-controls">
                    <button class="gp-btn gp-exp-shuffle" id="gpExpShuffle" title="Shuffle"><i class="fas fa-shuffle"></i></button>
                    <button class="gp-btn gp-exp-prev" id="gpExpPrev" title="Previous"><i class="fas fa-backward-step"></i></button>
                    <button class="gp-btn gp-exp-play" id="gpExpPlay" title="Play"><i class="fas fa-play"></i></button>
                    <button class="gp-btn gp-exp-next" id="gpExpNext" title="Next"><i class="fas fa-forward-step"></i></button>
                    <button class="gp-btn gp-exp-repeat" id="gpExpRepeat" title="Repeat"><i class="fas fa-repeat"></i></button>
                </div>

                <div class="gp-exp-secondary">
                    <button class="gp-btn gp-exp-fav" id="gpExpFav" title="Favorite"><i class="far fa-heart"></i></button>
                    <button class="gp-btn gp-exp-lyrics" id="gpExpLyrics" title="Lyrics"><i class="fas fa-microphone-lines"></i></button>
                    <button class="gp-btn gp-exp-queue" id="gpExpQueue" title="Queue"><i class="fas fa-bars-staggered"></i></button>
                    <button class="gp-btn gp-exp-share" id="gpExpShare" title="Share"><i class="fas fa-share-nodes"></i></button>
                    <button class="gp-btn gp-exp-volume" id="gpExpVolume" title="Volume"><i class="fas fa-volume-high"></i></button>
                </div>

                <div class="gp-exp-volume-slider" id="gpExpVolSlider" style="display:none;">
                    <i class="fas fa-volume-low"></i>
                    <input type="range" min="0" max="100" value="80" id="gpExpVolRange">
                    <i class="fas fa-volume-high"></i>
                </div>

                <div class="gp-exp-eq" id="gpExpEq">
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                </div>
            </div>

            <!-- Lyrics Panel -->
            <div class="gp-exp-lyrics-panel" id="gpExpLyricsPanel" style="display:none;">
                <div class="gp-lyrics-header">
                    <span>Lyrics</span>
                    <button class="gp-btn" id="gpLyricsClose"><i class="fas fa-times"></i></button>
                </div>
                <div class="gp-lyrics-content" id="gpLyricsContent">
                    <div class="gp-lyrics-empty">No lyrics available</div>
                </div>
            </div>

            <!-- Queue Panel -->
            <div class="gp-exp-queue-panel" id="gpExpQueuePanel" style="display:none;">
                <div class="gp-queue-header">
                    <h3>Queue</h3>
                    <div class="gp-queue-actions">
                        <button class="gp-queue-btn" id="gpQueueClear">Clear</button>
                    </div>
                </div>
                <div class="gp-queue-list" id="gpQueueList"></div>
            </div>
        `;
        document.body.appendChild(el);
        expandedEl = el;
    }

    /* ============================================
       EVENT BINDING
       ============================================ */
    function bindEvents() {
        // Mini player clicks
        document.getElementById('gpMiniInfo')?.addEventListener('click', expand);
        document.getElementById('gpMiniExpand')?.addEventListener('click', expand);
        document.getElementById('gpMiniPlay')?.addEventListener('click', togglePlay);
        document.getElementById('gpMiniPrev')?.addEventListener('click', playPrev);
        document.getElementById('gpMiniNext')?.addEventListener('click', playNext);
        document.getElementById('gpMiniFav')?.addEventListener('click', toggleFavorite);

        // Expanded player clicks
        document.getElementById('gpExpCollapse')?.addEventListener('click', collapse);
        document.getElementById('gpExpPlay')?.addEventListener('click', togglePlay);
        document.getElementById('gpExpPrev')?.addEventListener('click', playPrev);
        document.getElementById('gpExpNext')?.addEventListener('click', playNext);
        document.getElementById('gpExpFav')?.addEventListener('click', toggleFavorite);
        document.getElementById('gpExpShuffle')?.addEventListener('click', toggleShuffle);
        document.getElementById('gpExpRepeat')?.addEventListener('click', cycleRepeat);
        document.getElementById('gpExpQueue')?.addEventListener('click', toggleQueue);
        document.getElementById('gpExpLyrics')?.addEventListener('click', toggleLyrics);
        document.getElementById('gpExpShare')?.addEventListener('click', shareTrack);
        document.getElementById('gpExpTheme')?.addEventListener('click', cycleTheme);
        document.getElementById('gpExpVolume')?.addEventListener('click', () => {
            const s = document.getElementById('gpExpVolSlider');
            s.style.display = s.style.display === 'none' ? 'flex' : 'none';
        });
        document.getElementById('gpExpVolRange')?.addEventListener('input', (e) => {
            setVolume(e.target.value / 100);
        });
        document.getElementById('gpQueueClear')?.addEventListener('click', clearQueue);
        document.getElementById('gpLyricsClose')?.addEventListener('click', toggleLyrics);

        // Mini progress seek
        bindSeek('gpMiniProgress', (pct) => seekToPercent(pct));
        // Expanded progress seek
        bindSeek('gpExpBarWrap', (pct) => seekToPercent(pct));

        // Swipe down to collapse expanded player
        let swipeStartY = 0;
        const expContainer = expandedEl?.querySelector('.gp-exp-container');
        if (expContainer) {
            expContainer.addEventListener('touchstart', (e) => {
                swipeStartY = e.touches[0].clientY;
            }, { passive: true });
            expContainer.addEventListener('touchmove', (e) => {
                const dy = e.touches[0].clientY - swipeStartY;
                if (dy > 80 && !isExpanded) collapse();
            }, { passive: true });
        }
    }

    function bindSeek(elemId, onSeek) {
        const wrap = document.getElementById(elemId);
        if (!wrap) return;
        const doSeek = (e) => {
            const rect = wrap.getBoundingClientRect();
            if (!rect || rect.width <= 0) return;
            const x = (e.clientX !== undefined) ? e.clientX : (e.touches?.[0]?.clientX ?? 0);
            const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
            onSeek(pct);
        };
        wrap.addEventListener('mousedown', (e) => { isDragging = true; doSeek(e); e.preventDefault(); e.stopPropagation(); });
        document.addEventListener('mousemove', (e) => { if (isDragging) doSeek(e); });
        document.addEventListener('mouseup', () => { isDragging = false; });
        wrap.addEventListener('touchstart', (e) => { isDragging = true; doSeek(e); e.preventDefault(); e.stopPropagation(); }, { passive: false });
        wrap.addEventListener('touchmove', (e) => { if (isDragging) { e.preventDefault(); doSeek(e); } }, { passive: false });
        document.addEventListener('touchend', () => { isDragging = false; });
    }

    /* ============================================
       AUDIO BRIDGE
       ============================================ */
    function hookAudioSources() {
        // Hook into script.js window.audioPlayer
        hookAudioPlayer();
        // Hook into PlayerEngine events
        hookPlayerEngine();
        // Watch for audioPlayer creation
        if (!window.audioPlayer) {
            const watcher = setInterval(() => {
                if (window.audioPlayer) {
                    hookAudioPlayer();
                    clearInterval(watcher);
                }
            }, 500);
            setTimeout(() => clearInterval(watcher), 30000);
        }
    }

    function hookAudioPlayer() {
        const ap = window.audioPlayer;
        if (!ap || ap._gpHooked) return;
        ap._gpHooked = true;
        _activeAudio = ap;

        ap.addEventListener('play', () => {
            state.isPlaying = true;
            state.isLive = !isFinite(ap.duration) || ap.duration === 0;
            updatePlayUI(true);
            updateLiveUI();
        });
        ap.addEventListener('pause', () => {
            state.isPlaying = false;
            updatePlayUI(false);
        });
        ap.addEventListener('playing', () => {
            state.isPlaying = true;
            updatePlayUI(true);
        });
        ap.addEventListener('ended', () => {
            state.isPlaying = false;
            updatePlayUI(false);
        });
        ap.addEventListener('loadedmetadata', () => {
            state.duration = ap.duration || 0;
            state.isLive = !isFinite(ap.duration) || ap.duration === 0;
            updateProgressUI();
            updateLiveUI();
        });
        // Register with ProgressSync for smooth 60fps updates
        if (typeof ProgressSync !== 'undefined') {
            ProgressSync.register((_cur, _dur, _pct) => {
                if (isDragging) return;
                state.currentTime = _cur;
                state.duration = _dur;
                updateProgressUI();
            });
        }
        ap.addEventListener('volumechange', () => {
            state.volume = ap.volume;
        });
    }

    function hookPlayerEngine() {
        if (typeof PlayerEngine === 'undefined') return;
        PlayerEngine.on('trackChange', (s) => {
            state.track = s.currentTrack;
            state.queue = s.queue || [];
            state.queueIndex = s.queueIndex ?? -1;
            state.isLive = !!(state.track?.streamUrl && !state.track?.audioUrl);
            updateTrackUI();
            updateLiveUI();
            updateFavUI();
        });
        PlayerEngine.on('play', () => {
            state.isPlaying = true;
            updatePlayUI(true);
        });
        PlayerEngine.on('pause', () => {
            state.isPlaying = false;
            updatePlayUI(false);
        });
        PlayerEngine.on('timeupdate', ({ current, duration }) => {
            if (isDragging) return;
            state.currentTime = current;
            state.duration = duration;
            updateProgressUI();
        });
        PlayerEngine.on('shuffle', (v) => { state.shuffle = v; updateShuffleUI(); });
        PlayerEngine.on('repeat', (v) => { state.repeat = v; updateRepeatUI(); });
        PlayerEngine.on('queueChange', (q) => {
            state.queue = q;
            state.queueIndex = PlayerEngine.queueIndex;
        });
        PlayerEngine.on('volume', (v) => {
            state.volume = v;
            const range = document.getElementById('gpExpVolRange');
            if (range) range.value = v * 100;
        });
        PlayerEngine.on('colorTheme', (idx) => {
            themeIdx = idx;
            applyTheme();
        });
    }

    /* ============================================
       PLAYBACK CONTROLS
       ============================================ */
    function getActiveAudio() {
        if (window.audioPlayer && !window.audioPlayer.paused) return window.audioPlayer;
        if (window.audioPlayer) return window.audioPlayer;
        if (typeof PlayerEngine !== 'undefined' && PlayerEngine.isPlaying) return null; // PlayerEngine manages its own
        return window.audioPlayer;
    }

    function togglePlay() {
        // Check if script.js audioPlayer is active
        if (window.audioPlayer && window.audioPlayer.src) {
            if (window.audioPlayer.paused) {
                if (typeof window.resumePlayback === 'function') window.resumePlayback();
                else window.audioPlayer.play().catch(() => {});
            } else {
                if (typeof window.pausePlayback === 'function') window.pausePlayback();
                else window.audioPlayer.pause();
            }
        } else if (typeof PlayerEngine !== 'undefined') {
            PlayerEngine.togglePlay();
        }
    }

    function playPrev() {
        if (typeof window.playPreviousTrack === 'function') window.playPreviousTrack();
        else if (typeof PlayerEngine !== 'undefined') PlayerEngine.playPrevious();
    }

    function playNext() {
        if (typeof window.playNextTrack === 'function') window.playNextTrack();
        else if (typeof PlayerEngine !== 'undefined') PlayerEngine.playNext();
    }

    function toggleFavorite() {
        const track = state.track || getCurrentTrackFromScript();
        if (!track) return;
        if (typeof PlayerEngine !== 'undefined') {
            const isFav = PlayerEngine.toggleFavorite(track);
            updateFavUI();
        }
        if (typeof PlaylistManager !== 'undefined') {
            PlaylistManager.toggleFavorite(track);
        }
    }

    function toggleShuffle() {
        if (typeof PlayerEngine !== 'undefined') PlayerEngine.toggleShuffle();
    }

    function cycleRepeat() {
        if (typeof PlayerEngine !== 'undefined') PlayerEngine.cycleRepeat();
    }

    function setVolume(v) {
        state.volume = Math.max(0, Math.min(1, v));
        if (window.audioPlayer) window.audioPlayer.volume = state.volume;
        if (typeof PlayerEngine !== 'undefined') PlayerEngine.setVolume(state.volume);
        const range = document.getElementById('gpExpVolRange');
        if (range) range.value = state.volume * 100;
    }

    function clearQueue() {
        if (typeof PlayerEngine !== 'undefined') PlayerEngine.clearQueue();
        state.queue = [];
        state.queueIndex = -1;
        updateQueueUI();
    }

    function shareTrack() {
        const track = state.track || getCurrentTrackFromScript();
        if (!track) return;
        const text = `Listening to ${track.title || track.name} on Tamil AI Stream`;
        if (navigator.share) navigator.share({ title: track.title || track.name, text });
        else navigator.clipboard?.writeText(text);
    }

    /* ============================================
       SEEKING - Fixed
       ============================================ */
    function seekToPercent(pct) {
        const derived = Math.max(0, Math.min(1, pct));

        // Try script.js seekPlaybackToPercent first (has all the safety logic)
        if (typeof seekPlaybackToPercent === 'function') {
            seekPlaybackToPercent(derived);
            return;
        }

        // Direct seek on audioPlayer
        if (window.audioPlayer) {
            const dur = window.audioPlayer.duration;
            if (dur && isFinite(dur) && dur > 0) {
                window.audioPlayer.currentTime = derived * dur;
                state.currentTime = window.audioPlayer.currentTime;
                updateProgressUI();
                return;
            }
        }

        // Fallback to PlayerEngine
        if (typeof PlayerEngine !== 'undefined') {
            PlayerEngine.seekToPercent(derived);
        }
    }

    function seekToTime(time) {
        if (window.audioPlayer && window.audioPlayer.duration) {
            window.audioPlayer.currentTime = Math.max(0, Math.min(time, window.audioPlayer.duration));
        }
        if (typeof PlayerEngine !== 'undefined') PlayerEngine.seekTo(time);
    }

    /* ============================================
       UI UPDATES
       ============================================ */
    function updatePlayUI(playing) {
        state.isPlaying = playing;
        const miniIcon = document.querySelector('#gpMiniPlay i');
        const expIcon = document.querySelector('#gpExpPlay i');
        if (miniIcon) miniIcon.className = playing ? 'fas fa-pause' : 'fas fa-play';
        if (expIcon) expIcon.className = playing ? 'fas fa-pause' : 'fas fa-play';
        updateEqBars(playing);
        // Also update script.js play/pause buttons
        if (typeof updatePlayPauseButton === 'function') updatePlayPauseButton(playing);
    }

    function updateTrackUI() {
        const track = state.track || getCurrentTrackFromScript();
        if (!track) return;

        const title = track.title || track.name || 'Unknown';
        const artist = track.artist || track.subtitle || 'Tamil AI Stream';
        const artwork = track.thumbnail || track.cover || track.image || track.albumCover || '';

        // Mini player
        setText('gpMiniTitle', title);
        setText('gpMiniArtist', artist);
        setArtwork('gpMiniArtImg', artwork);

        // Expanded player
        setText('gpExpTitle', title);
        setText('gpExpArtist', artist);
        setArtwork('gpExpArtImg', artwork);
        setText('gpExpSource', track.movie || 'Tamil AI Stream');

        // Update expanded bg glow
        const bg = document.getElementById('gpExpBg');
        if (bg && artwork) {
            bg.style.background = `radial-gradient(circle at 50% 30%, ${THEMES[themeIdx].glow} 0%, transparent 60%)`;
        }

        updateFavUI();
        showMiniPlayer();
    }

    function updateProgressUI() {
        const cur = state.currentTime;
        const dur = state.duration;
        const pct = dur > 0 ? (cur / dur) * 100 : 0;

        // Mini progress
        setWidth('gpMiniBar', pct + '%');
        setLeft('gpMiniThumb', pct + '%');
        setText('gpMiniCur', fmtTime(cur));
        setText('gpMiniDur', fmtTime(dur));

        // Expanded progress
        setWidth('gpExpBar', pct + '%');
        setLeft('gpExpBarThumb', pct + '%');
        setText('gpExpCur', fmtTime(cur));
        setText('gpExpDur', fmtTime(dur));

        // Sync lyrics
        syncLyricsHighlight();
    }

    function updateLiveUI() {
        const isLive = state.isLive || (window.isStreamPlaying && !isFinite(window.audioPlayer?.duration));
        const miniLive = document.getElementById('gpMiniLive');
        const expLive = document.getElementById('gpExpLive');
        if (miniLive) miniLive.style.display = isLive ? 'flex' : 'none';
        if (expLive) expLive.style.display = isLive ? 'flex' : 'none';

        // Update source text for live
        const src = document.getElementById('gpExpSource');
        if (src && isLive) src.textContent = state.track?.title || 'Live FM';
    }

    function updateFavUI() {
        const track = state.track || getCurrentTrackFromScript();
        const isFav = track && typeof PlayerEngine !== 'undefined' && PlayerEngine.isFavorite(track);
        const miniFav = document.querySelector('#gpMiniFav i');
        const expFav = document.querySelector('#gpExpFav i');
        if (miniFav) { miniFav.className = isFav ? 'fas fa-heart' : 'far fa-heart'; }
        if (expFav) { expFav.className = isFav ? 'fas fa-heart' : 'far fa-heart'; }
        const miniBtn = document.getElementById('gpMiniFav');
        const expBtn = document.getElementById('gpExpFav');
        if (miniBtn) miniBtn.classList.toggle('active', isFav);
        if (expBtn) expBtn.classList.toggle('active', isFav);
    }

    function updateShuffleUI() {
        document.getElementById('gpExpShuffle')?.classList.toggle('active', state.shuffle);
    }

    function updateRepeatUI() {
        const btn = document.getElementById('gpExpRepeat');
        if (!btn) return;
        btn.classList.toggle('active', state.repeat !== 'off');
        btn.innerHTML = state.repeat === 'one'
            ? '<i class="fas fa-repeat"></i><span class="gp-rpt-1">1</span>'
            : '<i class="fas fa-repeat"></i>';
    }

    function updateQueueUI() {
        const list = document.getElementById('gpQueueList');
        if (!list) return;
        const q = state.queue;
        const idx = state.queueIndex;
        list.innerHTML = q.map((t, i) => `
            <div class="gp-q-item ${i === idx ? 'active' : ''}" data-idx="${i}">
                <div class="gp-q-num">${i === idx ? '<i class="fas fa-volume-high"></i>' : (i + 1)}</div>
                <div class="gp-q-art" style="background-image:url(${t.thumbnail || t.cover || ''})"></div>
                <div class="gp-q-info">
                    <div class="gp-q-name">${t.title || t.name || 'Unknown'}</div>
                    <div class="gp-q-artist">${t.artist || ''}</div>
                </div>
                <button class="gp-q-remove" data-idx="${i}"><i class="fas fa-times"></i></button>
            </div>
        `).join('');

        list.querySelectorAll('.gp-q-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.gp-q-remove')) return;
                const i = parseInt(item.dataset.idx);
                if (typeof PlayerEngine !== 'undefined') {
                    PlayerEngine.playTrack(q[i], q, i);
                }
            });
        });
        list.querySelectorAll('.gp-q-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof PlayerEngine !== 'undefined') {
                    PlayerEngine.removeFromQueue(parseInt(btn.dataset.idx));
                }
                updateQueueUI();
            });
        });
    }

    /* ============================================
       EXPAND / COLLAPSE
       ============================================ */
    function expand() {
        if (isExpanded) return;
        isExpanded = true;
        expandedEl?.classList.add('open');
        document.body.style.overflow = 'hidden';
        startVisualizer();
        updateTrackUI();
    }

    function collapse() {
        if (!isExpanded) return;
        isExpanded = false;
        expandedEl?.classList.remove('open');
        document.body.style.overflow = '';
        stopVisualizer();
    }

    function toggleQueue() {
        const panel = document.getElementById('gpExpQueuePanel');
        if (panel) {
            const isOpen = panel.style.display !== 'none';
            panel.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) updateQueueUI();
        }
    }

    function toggleLyrics() {
        const panel = document.getElementById('gpExpLyricsPanel');
        if (!panel) return;
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) loadLyrics();
    }

    function showMiniPlayer() {
        miniEl?.classList.add('visible');
    }

    /* ============================================
       LYRICS
       ============================================ */
    function loadLyrics() {
        const content = document.getElementById('gpLyricsContent');
        if (!content) return;
        const track = state.track || getCurrentTrackFromScript();
        if (!track) { content.innerHTML = '<div class="gp-lyrics-empty">No track playing</div>'; return; }

        let lyricsText = track.lyrics || track.lyricText || '';
        if (!lyricsText && track.id && typeof DataStore !== 'undefined') {
            const songs = DataStore.getSongs ? DataStore.getSongs() : [];
            const song = songs.find(s => s.id === track.id);
            if (song?.lyrics) lyricsText = song.lyrics;
        }

        if (!lyricsText) { content.innerHTML = '<div class="gp-lyrics-empty">No lyrics available</div>'; _currentLyrics = []; return; }

        _currentLyrics = typeof AIAutomation !== 'undefined' ? AIAutomation.parseLyrics(lyricsText) : parseLyricsSimple(lyricsText);
        if (_currentLyrics.length === 0) { content.innerHTML = '<div class="gp-lyrics-empty">Could not parse lyrics</div>'; return; }

        let html = '';
        for (let i = 0; i < _currentLyrics.length; i++) {
            html += `<div class="gp-lyrics-line" data-idx="${i}" data-time="${_currentLyrics[i].time}">
                <span class="gp-lyrics-ts">${fmtTime(_currentLyrics[i].time)}</span>
                <span class="gp-lyrics-txt">${escHtml(_currentLyrics[i].text)}</span>
            </div>`;
        }
        content.innerHTML = html;
        content.querySelectorAll('.gp-lyrics-line').forEach(el => {
            el.addEventListener('click', () => {
                const t = parseFloat(el.dataset.time);
                seekToTime(t);
            });
        });
    }

    function parseLyricsSimple(text) {
        const lines = text.split('\n').filter(l => l.trim());
        const tsRegex = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;
        const result = [];
        let hasTs = false;
        for (const line of lines) {
            const m = line.match(tsRegex);
            if (m) {
                hasTs = true;
                const t = parseInt(m[1]) * 60 + parseInt(m[2]) + (m[3] ? parseInt(m[3].padEnd(3, '0')) / 1000 : 0);
                if (m[4].trim()) result.push({ time: t, text: m[4].trim() });
            }
        }
        if (!hasTs) {
            const interval = (lines.length * 4) / lines.length;
            lines.forEach((l, i) => result.push({ time: Math.round(i * interval * 10) / 10, text: l.trim() }));
        }
        return result;
    }

    function syncLyricsHighlight() {
        if (_currentLyrics.length === 0) return;
        const panel = document.getElementById('gpExpLyricsPanel');
        if (!panel || panel.style.display === 'none') return;

        let idx = -1;
        for (let i = 0; i < _currentLyrics.length; i++) {
            if (_currentLyrics[i].time <= state.currentTime) idx = i;
            else break;
        }
        if (idx < 0) return;

        const content = document.getElementById('gpLyricsContent');
        if (!content) return;
        const lines = content.querySelectorAll('.gp-lyrics-line');
        let changed = false;
        lines.forEach((el, i) => {
            const isActive = i === idx;
            if (isActive && !el.classList.contains('active')) { el.classList.add('active'); changed = true; }
            else if (!isActive && el.classList.contains('active')) el.classList.remove('active');
        });
        if (changed && lines[idx]) {
            const containerRect = content.getBoundingClientRect();
            const lineRect = lines[idx].getBoundingClientRect();
            const offset = lineRect.top - containerRect.top - containerRect.height / 3;
            content.scrollBy({ top: offset, behavior: 'smooth' });
        }
    }

    /* ============================================
       VISUALIZER
       ============================================ */
    function startVisualizer() {
        const canvas = document.getElementById('gpExpVisualizer');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        function draw() {
            if (!isExpanded) { ctx.clearRect(0, 0, canvas.width, canvas.height); waveformRAF = requestAnimationFrame(draw); return; }
            const freqData = (typeof PlayerEngine !== 'undefined' && PlayerEngine.getFrequencyData) ? PlayerEngine.getFrequencyData() : null;
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            ctx.clearRect(0, 0, w, h);
            if (!freqData || !state.isPlaying) { waveformRAF = requestAnimationFrame(draw); return; }

            const bars = 64;
            const barW = w / bars;
            const step = Math.floor(freqData.length / bars);
            for (let i = 0; i < bars; i++) {
                const val = freqData[i * step] / 255;
                const barH = val * h * 0.8;
                const grad = ctx.createLinearGradient(0, h, 0, h - barH);
                grad.addColorStop(0, 'rgba(52,211,153,0.8)');
                grad.addColorStop(0.5, 'rgba(59,130,246,0.6)');
                grad.addColorStop(1, 'rgba(168,85,247,0.4)');
                ctx.fillStyle = grad;
                ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
            }
            waveformRAF = requestAnimationFrame(draw);
        }
        draw();
    }

    function stopVisualizer() {
        if (waveformRAF) cancelAnimationFrame(waveformRAF);
    }

    function startEqAnimation() {
        function animate() {
            document.querySelectorAll('.gp-mini-eq span, .gp-exp-eq span').forEach((bar) => {
                if (state.isPlaying) {
                    bar.style.height = (4 + Math.random() * 14) + 'px';
                } else {
                    bar.style.height = '3px';
                }
            });
            eqRAF = requestAnimationFrame(animate);
        }
        animate();
    }

    /* ============================================
       MINI WAVEFORM CANVAS
       ============================================ */
    function drawMiniWaveform() {
        const canvas = document.getElementById('gpMiniWaveCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = 80;
        canvas.height = 32;

        function draw() {
            ctx.clearRect(0, 0, 80, 32);
            if (!state.isPlaying) { _lyricsRAF = requestAnimationFrame(draw); return; }

            const freqData = (typeof PlayerEngine !== 'undefined' && PlayerEngine.getFrequencyData) ? PlayerEngine.getFrequencyData() : null;
            if (!freqData) { _lyricsRAF = requestAnimationFrame(draw); return; }

            const bars = 16;
            const barW = 80 / bars;
            const step = Math.floor(freqData.length / bars);
            for (let i = 0; i < bars; i++) {
                const val = freqData[i * step] / 255;
                const barH = val * 28 + 2;
                const hue = (i / bars) * 120 + 140;
                ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
                ctx.fillRect(i * barW + 1, 32 - barH, barW - 2, barH);
            }
            _lyricsRAF = requestAnimationFrame(draw);
        }
        draw();
    }

    /* ============================================
       THEME
       ============================================ */
    function cycleTheme() {
        themeIdx = (themeIdx + 1) % THEMES.length;
        applyTheme();
        try { localStorage.setItem('global_player_state', JSON.stringify({ themeIdx, volume: state.volume })); } catch (e) {}
        if (typeof PlayerEngine !== 'undefined' && PlayerEngine.state) {
            PlayerEngine.state.colorTheme = themeIdx;
        }
        showToast(`Theme: ${THEMES[themeIdx].name}`, 'info');
    }

    function applyTheme() {
        const t = THEMES[themeIdx] || THEMES[0];
        document.documentElement.style.setProperty('--gp-theme', t.grad);
        document.documentElement.style.setProperty('--gp-glow', t.glow);
        document.documentElement.style.setProperty('--gp-accent', t.accent);
    }

    /* ============================================
       HELPERS
       ============================================ */
    function getCurrentTrackFromScript() {
        if (typeof window.currentPlaybackTrack !== 'undefined') return window.currentPlaybackTrack;
        return null;
    }

    function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
    function setWidth(id, w) { const el = document.getElementById(id); if (el) el.style.width = w; }
    function setLeft(id, l) { const el = document.getElementById(id); if (el) el.style.left = l; }
    function setArtwork(id, url) {
        const el = document.getElementById(id);
        if (el) {
            el.style.backgroundImage = url ? `url(${url})` : '';
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        }
    }

    function fmtTime(sec) {
        if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function updateEqBars(playing) {
        document.querySelectorAll('.gp-mini-eq span').forEach(bar => {
            bar.style.animationPlayState = playing ? 'running' : 'paused';
        });
    }

    /* ============================================
       STYLES
       ============================================ */
    function injectStyles() {
        if (document.getElementById('gpStyles')) return;
        const style = document.createElement('style');
        style.id = 'gpStyles';
        style.textContent = `
/* GlobalPlayer CSS - see global-player.css */
`;
        document.head.appendChild(style);
    }

    /* ============================================
       PUBLIC API
       ============================================ */
    // Maintain compatibility with existing PlayerUI API
    function toggleFullPlayer() { isExpanded ? collapse() : expand(); }

    return {
        init,
        expand,
        collapse,
        toggleFullPlayer,
        toggleQueue,
        toggleLyrics,
        togglePlay,
        playPrev,
        playNext,
        seekToPercent,
        seekToTime,
        setVolume,
        showMiniPlayer,
        cycleTheme,
        updateTrackUI,
        updatePlayUI,
        updateProgressUI,
        updateLiveUI
    };
})();
