'use strict';

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
    let _bc = null;
    let _lastActiveCard = null;
    let _lastActiveStation = null;

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

    const THEMES = [
        { name: 'Emerald', grad: 'linear-gradient(135deg,#34d399,#3b82f6)', glow: 'rgba(52,211,153,0.5)', accent: '#34d399' },
        { name: 'Sunset', grad: 'linear-gradient(135deg,#f97316,#ef4444)', glow: 'rgba(249,115,22,0.5)', accent: '#f97316' },
        { name: 'Purple', grad: 'linear-gradient(135deg,#a855f7,#6366f1)', glow: 'rgba(168,85,247,0.5)', accent: '#a855f7' },
        { name: 'Ocean', grad: 'linear-gradient(135deg,#06b6d4,#3b82f6)', glow: 'rgba(6,182,212,0.5)', accent: '#06b6d4' },
        { name: 'Pink', grad: 'linear-gradient(135deg,#ec4899,#f97316)', glow: 'rgba(236,72,153,0.5)', accent: '#ec4899' },
        { name: 'Lime', grad: 'linear-gradient(135deg,#84cc16,#34d399)', glow: 'rgba(132,204,22,0.5)', accent: '#84cc16' }
    ];
    let themeIdx = 0;

    function init() {
        injectStyles();
        createMiniPlayer();
        createExpandedPlayer();
        bindEvents();
        hookAudioSources();
        startEqAnimation();
        drawMiniWaveform();
        initBroadcastChannel();
        restoreStateFromStorage();
        updateBodyPadding();
        const watcher = setInterval(() => {
            if (window.audioPlayer && !window.audioPlayer._gpHooked) hookAudioPlayer();
        }, 1000);
        setTimeout(() => clearInterval(watcher), 30000);
        window.addEventListener('storage', onStorageChange);
    }

    function initBroadcastChannel() {
        try {
            _bc = new BroadcastChannel('tamilai_player_sync');
            _bc.onmessage = (e) => {
                const msg = e.data;
                if (!msg || !msg.type) return;
                switch (msg.type) {
                    case 'state':
                        if (msg.track) state.track = msg.track;
                        if (msg.isPlaying !== undefined) state.isPlaying = msg.isPlaying;
                        if (msg.currentTime !== undefined) state.currentTime = msg.currentTime;
                        if (msg.duration !== undefined) state.duration = msg.duration;
                        if (msg.volume !== undefined) state.volume = msg.volume;
                        if (msg.queue) state.queue = msg.queue;
                        if (msg.queueIndex !== undefined) state.queueIndex = msg.queueIndex;
                        if (msg.shuffle !== undefined) state.shuffle = msg.shuffle;
                        if (msg.repeat !== undefined) state.repeat = msg.repeat;
                        if (msg.isLive !== undefined) state.isLive = msg.isLive;
                        updatePlayUI(state.isPlaying);
                        updateTrackUI();
                        updateProgressUI();
                        updateLiveUI();
                        updateFavUI();
                        updateShuffleUI();
                        updateRepeatUI();
                        break;
                    case 'play':
                        state.isPlaying = true;
                        updatePlayUI(true);
                        break;
                    case 'pause':
                        state.isPlaying = false;
                        updatePlayUI(false);
                        break;
                    case 'trackChange':
                        if (msg.track) {
                            state.track = msg.track;
                            state.isLive = !!(msg.track.streamUrl && !msg.track.audioUrl);
                            updateTrackUI();
                            updateLiveUI();
                        }
                        break;
                }
            };
        } catch (e) {}
    }

    function broadcastState(type, extra) {
        if (!_bc) return;
        try { _bc.postMessage({ type, ...extra }); } catch (e) {}
    }

    function onStorageChange(e) {
        if (e.key === 'tamilAIStream_player_state' && e.newValue) {
            try {
                const s = JSON.parse(e.newValue);
                if (s.currentPlaybackTrack) {
                    state.track = s.currentPlaybackTrack;
                    state.isLive = !!(s.currentPlaybackTrack?.streamUrl && !s.currentPlaybackTrack?.audioUrl);
                    updateTrackUI();
                    updateLiveUI();
                }
                if (s.isPlaying !== undefined) { state.isPlaying = s.isPlaying; updatePlayUI(s.isPlaying); }
                if (s.progress !== undefined && s.duration) { state.currentTime = s.progress; state.duration = s.duration; updateProgressUI(); }
            } catch (e) {}
        }
        if (e.key === 'player_engine_state' && e.newValue) {
            try {
                const s = JSON.parse(e.newValue);
                if (s.currentTrack) {
                    state.track = s.currentTrack;
                    state.isLive = !!(s.currentTrack?.streamUrl && !s.currentTrack?.audioUrl);
                    updateTrackUI();
                    updateLiveUI();
                }
                if (s.isPlaying !== undefined) { state.isPlaying = s.isPlaying; updatePlayUI(s.isPlaying); }
                if (s.playbackPosition !== undefined) state.currentTime = s.playbackPosition;
                if (s.duration) state.duration = s.duration;
                updateProgressUI();
            } catch (e) {}
        }
    }

    function restoreStateFromStorage() {
        try {
            const raw1 = localStorage.getItem('tamilAIStream_player_state');
            const raw2 = localStorage.getItem('player_engine_state');
            const saved = raw2 ? JSON.parse(raw2) : (raw1 ? JSON.parse(raw1) : null);
            if (saved) {
                const track = saved.currentPlaybackTrack || saved.currentTrack || null;
                if (track) {
                    state.track = track;
                    state.isLive = !!(track.streamUrl && !track.audioUrl);
                    updateTrackUI();
                    updateLiveUI();
                }
                if (saved.playbackVolume !== undefined) state.volume = saved.playbackVolume;
                else if (saved.volume !== undefined) state.volume = saved.volume;
                if (saved.playbackShuffle !== undefined) state.shuffle = saved.playbackShuffle;
                else if (saved.shuffle !== undefined) state.shuffle = saved.shuffle;
                if (saved.playbackRepeat !== undefined) state.repeat = saved.playbackRepeat;
                else if (saved.repeat !== undefined) state.repeat = saved.repeat;
                if (saved.playbackPosition !== undefined) state.currentTime = saved.playbackPosition;
                updateShuffleUI();
                updateRepeatUI();
            }
            const gpState = JSON.parse(localStorage.getItem('global_player_state') || '{}');
            if (gpState.themeIdx !== undefined) { themeIdx = gpState.themeIdx; applyTheme(); }
            if (gpState.volume !== undefined) state.volume = gpState.volume;
        } catch (e) {}
        applyTheme();
    }

    function updateBodyPadding() {
        if (!document.body.classList.contains('gp-active')) {
            document.body.classList.add('gp-active');
        }
    }

    function createMiniPlayer() {
        if (document.getElementById('gp-mini')) { miniEl = document.getElementById('gp-mini'); return; }
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

    function createExpandedPlayer() {
        if (document.getElementById('gp-expanded')) { expandedEl = document.getElementById('gp-expanded'); return; }
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
                    <div class="gp-exp-header-right">
                        <button class="gp-btn gp-exp-theme" id="gpExpTheme" title="Color Theme">
                            <i class="fas fa-palette"></i>
                        </button>
                        <button class="gp-btn gp-exp-close" id="gpExpClose" title="Close Player">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>
                </div>
                <div class="gp-exp-artwork-wrap">
                    <div class="gp-exp-artwork-particles">
                        <span></span><span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <div class="gp-exp-artwork" id="gpExpArtwork">
                        <div class="gp-exp-artwork-ai-ring"></div>
                        <div class="gp-exp-art-img" id="gpExpArtImg"></div>
                        <div class="gp-exp-art-glow"></div>
                    </div>
                    <canvas class="gp-exp-visualizer" id="gpExpVisualizer"></canvas>
                    </div>
                    <div class="gp-exp-info">
                        <div class="gp-exp-title" id="gpExpTitle">Select a song</div>
                        <div class="gp-exp-artist" id="gpExpArtist">Tamil AI Stream</div>
                        <div class="gp-exp-movie" id="gpExpMovie">Tamil AI Stream</div>
                        <button class="gp-exp-why-btn" onclick="if(typeof showWhyThisSong==='function'){const t=state.track||getCurrentTrackFromScript();showWhyThisSong(t);}"><i class="fas fa-lightbulb"></i> Why this song?</button>
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
                <div class="gp-exp-ai-bot" id="gpExpAiBot">
                    <div class="gp-ai-bot-header">
                        <div class="gp-ai-bot-icon"><i class="fas fa-robot"></i></div>
                        <span class="gp-ai-bot-title">AI Music Assistant</span>
                        <button class="gp-btn gp-ai-bot-toggle" id="gpAiBotToggle" title="Toggle AI Bot">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                    </div>
                    <div class="gp-ai-bot-body" id="gpAiBotBody" style="display:none;">
                        <div class="gp-ai-bot-messages" id="gpAiBotMessages">
                            <div class="gp-ai-bot-msg gp-ai-bot-msg-ai">
                                <i class="fas fa-robot"></i>
                                <span>Hi! I can help with song info, lyrics, recommendations, queue management, and player commands. Try asking me something!</span>
                            </div>
                        </div>
                        <div class="gp-ai-bot-suggestions" id="gpAiBotSuggestions">
                            <button class="gp-ai-bot-chip" data-cmd="what is playing">What's playing?</button>
                            <button class="gp-ai-bot-chip" data-cmd="show lyrics">Show lyrics</button>
                            <button class="gp-ai-bot-chip" data-cmd="recommend songs">Recommend</button>
                            <button class="gp-ai-bot-chip" data-cmd="show queue">Queue</button>
                        </div>
                        <div class="gp-ai-bot-input-row">
                            <input type="text" class="gp-ai-bot-input" id="gpAiBotInput" placeholder="Ask AI about music...">
                            <button class="gp-ai-bot-send" id="gpAiBotSend"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="gp-exp-lyrics-panel" id="gpExpLyricsPanel" style="display:none;">
                <div class="gp-lyrics-header">
                    <span>Lyrics</span>
                    <button class="gp-btn" id="gpLyricsClose"><i class="fas fa-times"></i></button>
                </div>
                <div class="gp-lyrics-content" id="gpLyricsContent">
                    <div class="gp-lyrics-empty">No lyrics available</div>
                </div>
            </div>
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

    function bindEvents() {
        document.getElementById('gpMiniInfo')?.addEventListener('click', expand);
        document.getElementById('gpMiniExpand')?.addEventListener('click', expand);
        document.getElementById('gpMiniArtwork')?.addEventListener('click', expand);
        document.getElementById('gpMiniPlay')?.addEventListener('click', togglePlay);
        document.getElementById('gpMiniPrev')?.addEventListener('click', playPrev);
        document.getElementById('gpMiniNext')?.addEventListener('click', playNext);
        document.getElementById('gpMiniFav')?.addEventListener('click', toggleFavorite);
        document.getElementById('gpExpCollapse')?.addEventListener('click', collapse);
        document.getElementById('gpExpClose')?.addEventListener('click', closePlayer);
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
        // AI Bot events
        document.getElementById('gpAiBotToggle')?.addEventListener('click', toggleAiBot);
        document.getElementById('gpAiBotSend')?.addEventListener('click', sendAiBotMessage);
        document.getElementById('gpAiBotInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAiBotMessage(); });
        document.querySelectorAll('.gp-ai-bot-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const cmd = chip.dataset.cmd;
                if (cmd) { document.getElementById('gpAiBotInput').value = cmd; sendAiBotMessage(); }
            });
        });
        bindSeek('gpMiniProgress', (pct) => seekToPercent(pct));
        bindSeek('gpExpBarWrap', (pct) => seekToPercent(pct));
        let swipeStartY = 0;
        const expContainer = expandedEl?.querySelector('.gp-exp-container');
        if (expContainer) {
            expContainer.addEventListener('touchstart', (e) => { swipeStartY = e.touches[0].clientY; }, { passive: true });
            expContainer.addEventListener('touchmove', (e) => { if (e.touches[0].clientY - swipeStartY > 80) collapse(); }, { passive: true });
        }
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space' && !e.repeat) { e.preventDefault(); togglePlay(); }
            if (e.code === 'ArrowRight' && e.shiftKey) { e.preventDefault(); playNext(); }
            if (e.code === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); playPrev(); }
        });
    }

    function bindSeek(elemId, onSeek) {
        const wrap = document.getElementById(elemId);
        if (!wrap) return;
        let dragPct = null;
        const previewSeek = (e) => {
            const rect = wrap.getBoundingClientRect();
            if (!rect || rect.width <= 0) return;
            const x = (e.clientX !== undefined) ? e.clientX : (e.touches?.[0]?.clientX ?? 0);
            dragPct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
            // Preview: update bar visual only (no audio seek yet)
            if (elemId === 'gpExpBarWrap') {
                setWidth('gpExpBar', (dragPct * 100) + '%');
                setLeft('gpExpBarThumb', (dragPct * 100) + '%');
                setText('gpExpCur', fmtTime(dragPct * (state.duration || 0)));
            } else {
                setWidth('gpMiniBar', (dragPct * 100) + '%');
                setLeft('gpMiniThumb', (dragPct * 100) + '%');
                setText('gpMiniCur', fmtTime(dragPct * (state.duration || 0)));
            }
        };
        const commitSeek = () => {
            if (dragPct === null) return;
            const target = dragPct;
            dragPct = null;
            // Perform actual audio seek
            onSeek(target);
            // Force UI sync from actual audio position after seek
            setTimeout(() => {
                const ap = window.audioPlayer;
                if (ap) {
                    state.currentTime = ap.currentTime || 0;
                    state.duration = ap.duration || 0;
                }
                updateProgressUI();
            }, 50);
        };
        // Click/tap to seek immediately (no drag needed)
        const clickSeek = (e) => {
            const rect = wrap.getBoundingClientRect();
            if (!rect || rect.width <= 0) return;
            const x = (e.clientX !== undefined) ? e.clientX : (e.touches?.[0]?.clientX ?? 0);
            const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
            // Update UI immediately
            if (elemId === 'gpExpBarWrap') {
                setWidth('gpExpBar', (pct * 100) + '%');
                setLeft('gpExpBarThumb', (pct * 100) + '%');
                setText('gpExpCur', fmtTime(pct * (state.duration || 0)));
            } else {
                setWidth('gpMiniBar', (pct * 100) + '%');
                setLeft('gpMiniThumb', (pct * 100) + '%');
                setText('gpMiniCur', fmtTime(pct * (state.duration || 0)));
            }
            // Perform actual audio seek immediately
            onSeek(pct);
            // Force UI sync from actual audio position after seek
            setTimeout(() => {
                const ap = window.audioPlayer;
                if (ap) {
                    state.currentTime = ap.currentTime || 0;
                    state.duration = ap.duration || 0;
                }
                updateProgressUI();
            }, 50);
        };
        wrap.addEventListener('click', (e) => { clickSeek(e); e.preventDefault(); e.stopPropagation(); });
        wrap.addEventListener('mousedown', (e) => { isDragging = true; previewSeek(e); e.preventDefault(); e.stopPropagation(); });
        document.addEventListener('mousemove', (e) => { if (isDragging) previewSeek(e); });
        document.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; commitSeek(); } });
        wrap.addEventListener('touchstart', (e) => { isDragging = true; previewSeek(e); e.preventDefault(); e.stopPropagation(); }, { passive: false });
        wrap.addEventListener('touchmove', (e) => { if (isDragging) { e.preventDefault(); previewSeek(e); } }, { passive: false });
        document.addEventListener('touchend', () => { if (isDragging) { isDragging = false; commitSeek(); } });
    }

    function hookAudioSources() {
        hookAudioPlayer();
        hookPlayerEngine();
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
            broadcastState('play');
            persistState();
        });
        ap.addEventListener('pause', () => {
            state.isPlaying = false;
            updatePlayUI(false);
            broadcastState('pause');
            persistState();
        });
        ap.addEventListener('playing', () => { state.isPlaying = true; updatePlayUI(true); });
        ap.addEventListener('ended', () => { state.isPlaying = false; updatePlayUI(false); });
        ap.addEventListener('loadedmetadata', () => {
            state.duration = ap.duration || 0;
            state.isLive = !isFinite(ap.duration) || ap.duration === 0;
            updateProgressUI();
            updateLiveUI();
        });
        ap.addEventListener('timeupdate', () => {
            if (isDragging) return;
            // Don't overwrite UI while a seek is being applied
            if (window._isSeeking && Date.now() < (window._seekingUntil || 0)) return;
            state.currentTime = ap.currentTime || 0;
            state.duration = ap.duration || 0;
            updateProgressUI();
        });
        if (typeof ProgressSync !== 'undefined') {
            ProgressSync.register((_cur, _dur, _pct) => {
                if (isDragging) return;
                // Don't overwrite UI while a seek is being applied
                if (window._isSeeking && Date.now() < (window._seekingUntil || 0)) return;
                state.currentTime = _cur;
                state.duration = _dur;
                updateProgressUI();
            });
        }
        ap.addEventListener('volumechange', () => { state.volume = ap.volume; });
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
            broadcastState('trackChange', { track: state.track });
            persistState();
        });
        PlayerEngine.on('play', () => { state.isPlaying = true; updatePlayUI(true); broadcastState('play'); });
        PlayerEngine.on('pause', () => { state.isPlaying = false; updatePlayUI(false); broadcastState('pause'); });
        PlayerEngine.on('timeupdate', ({ current, duration }) => {
            if (isDragging) return;
            if (window._isSeeking && Date.now() < (window._seekingUntil || 0)) return;
            state.currentTime = current;
            state.duration = duration;
            updateProgressUI();
        });
        PlayerEngine.on('shuffle', (v) => { state.shuffle = v; updateShuffleUI(); });
        PlayerEngine.on('repeat', (v) => { state.repeat = v; updateRepeatUI(); });
        PlayerEngine.on('queueChange', (q) => { state.queue = q; state.queueIndex = PlayerEngine.queueIndex; });
        PlayerEngine.on('volume', (v) => {
            state.volume = v;
            const range = document.getElementById('gpExpVolRange');
            if (range) range.value = v * 100;
        });
        PlayerEngine.on('colorTheme', (idx) => { themeIdx = idx; applyTheme(); });
    }

    function persistState() {
        try {
            localStorage.setItem('gp_current_state', JSON.stringify({
                isPlaying: state.isPlaying, track: state.track, currentTime: state.currentTime,
                duration: state.duration, volume: state.volume, timestamp: Date.now()
            }));
        } catch (e) {}
    }

    function togglePlay() {
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
        // Show next song notification
        setTimeout(() => {
            const track = state.track || getCurrentTrackFromScript();
            if (track) showNextNotification(track);
        }, 300);
    }

    function showNextNotification(track) {
        const existing = document.querySelector('.gp-next-notification');
        if (existing) existing.remove();
        const notif = document.createElement('div');
        notif.className = 'gp-next-notification';
        notif.innerHTML = `
            <div class="gp-next-art"><img src="${track.thumbnail || track.albumCover || ''}" alt="" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-music\\' style=\\'padding:14px;color:rgba(255,255,255,0.3)\\'></i>'"></div>
            <div class="gp-next-info">
                <div class="gp-next-label">Up Next</div>
                <div class="gp-next-title">${track.title || 'Unknown'}</div>
                <div class="gp-next-artist">${track.artist || ''}</div>
            </div>
        `;
        document.body.appendChild(notif);
        setTimeout(() => { notif.classList.add('leaving'); setTimeout(() => notif.remove(), 300); }, 4000);
    }

    function toggleFavorite() {
        const track = state.track || getCurrentTrackFromScript();
        if (!track) return;
        if (typeof PlayerEngine !== 'undefined') { PlayerEngine.toggleFavorite(track); updateFavUI(); }
        if (typeof PlaylistManager !== 'undefined') PlaylistManager.toggleFavorite(track);
    }

    function toggleShuffle() { if (typeof PlayerEngine !== 'undefined') PlayerEngine.toggleShuffle(); }
    function cycleRepeat() { if (typeof PlayerEngine !== 'undefined') PlayerEngine.cycleRepeat(); }

    function setVolume(v) {
        state.volume = Math.max(0, Math.min(1, v));
        if (window.audioPlayer) window.audioPlayer.volume = state.volume;
        if (typeof PlayerEngine !== 'undefined') PlayerEngine.setVolume(state.volume);
        const range = document.getElementById('gpExpVolRange');
        if (range) range.value = state.volume * 100;
        broadcastState('state', { volume: state.volume });
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
        const text = 'Listening to ' + (track.title || track.name) + ' on Tamil AI Stream';
        if (navigator.share) navigator.share({ title: track.title || track.name, text });
        else navigator.clipboard?.writeText(text);
    }

    function seekToPercent(pct) {
        const derived = Math.max(0, Math.min(1, pct));
        const targetTime = derived * (state.duration || 0);
        state.currentTime = targetTime;
        window._isSeeking = true;
        window._seekingUntil = Date.now() + 1500;
        updateProgressUI();
        if (window.audioPlayer && window.audioPlayer.duration && isFinite(window.audioPlayer.duration)) {
            window.audioPlayer.currentTime = derived * window.audioPlayer.duration;
            state.currentTime = window.audioPlayer.currentTime;
            updateProgressUI();
            return;
        }
        if (typeof PlayerEngine !== 'undefined') {
            PlayerEngine.seekTo(targetTime);
        }
    }

    function seekToTime(time) {
        const target = Math.max(0, Math.min(time, (window.audioPlayer && window.audioPlayer.duration) || (state.duration || 0)));
        state.currentTime = target;
        window._isSeeking = true;
        window._seekingUntil = Date.now() + 1500;
        updateProgressUI();
        if (window.audioPlayer && window.audioPlayer.duration && isFinite(window.audioPlayer.duration)) {
            window.audioPlayer.currentTime = target;
        }
        if (typeof PlayerEngine !== 'undefined') PlayerEngine.seekTo(target);
    }

    function updatePlayUI(playing) {
        state.isPlaying = playing;
        const miniIcon = document.querySelector('#gpMiniPlay i');
        const expIcon = document.querySelector('#gpExpPlay i');
        if (miniIcon) miniIcon.className = playing ? 'fas fa-pause' : 'fas fa-play';
        if (expIcon) expIcon.className = playing ? 'fas fa-pause' : 'fas fa-play';
        updateEqBars(playing);
        if (typeof updatePlayPauseButton === 'function') updatePlayPauseButton(playing);
        
        // Restart animation loops when playback starts
        if (playing) {
            if (!eqRAF) startEqAnimation();
            if (!_lyricsRAF) drawMiniWaveform();
        } else {
            if (eqRAF) startEqAnimation();
        }

        // Sync playing state with song cards and station cards across the site
        syncPlayingIndicators(playing);
    }
    
    function syncPlayingIndicators(playing) {
        const track = state.track || getCurrentTrackFromScript();
        const currentTrackId = track?.id || track?.songId;
        const currentStationName = state.track?.title || state.track?.name || '';

        // --- Song card: only update previous + new active card ---
        let newActiveCard = null;
        if (playing && currentTrackId) {
            const selector = '.song-card, .dash-song-card, .ai-glass-song-card, .ytm-song-card';
            document.querySelectorAll(selector).forEach(card => {
                const songId = card.dataset?.songId || card.dataset?.id;
                if (songId && songId === currentTrackId) newActiveCard = card;
            });
        }

        if (_lastActiveCard && _lastActiveCard !== newActiveCard) {
            _lastActiveCard.classList.remove('playing-song');
            const thumb = _lastActiveCard.querySelector('.song-thumbnail, .dash-song-art, .ytm-song-art');
            if (thumb) thumb.classList.remove('playing-indicator');
        }
        if (newActiveCard) {
            if (!newActiveCard.classList.contains('playing-song')) {
                newActiveCard.classList.add('playing-song');
                const thumb = newActiveCard.querySelector('.song-thumbnail, .dash-song-art, .ytm-song-art');
                if (thumb) thumb.classList.add('playing-indicator');
            }
        }
        _lastActiveCard = newActiveCard;

        // --- Station card: only update previous + new active card ---
        let newActiveStation = null;
        if (playing && currentStationName) {
            document.querySelectorAll('.station-card, .station-grid-card, .slide-card, .premium-radio-card').forEach(card => {
                const cardName = card.querySelector('h3, h4')?.textContent || '';
                if (cardName && cardName === currentStationName) newActiveStation = card;
            });
        }

        if (_lastActiveStation && _lastActiveStation !== newActiveStation) {
            _lastActiveStation.classList.remove('active-station', 'playing-station');
        }
        if (newActiveStation) {
            if (!newActiveStation.classList.contains('active-station')) {
                newActiveStation.classList.add('active-station', 'playing-station');
            }
        }
        _lastActiveStation = newActiveStation;

        // YTMusic / MiniAudioPlayer external sync
        if (typeof YTMusic !== 'undefined') {
            YTMusic.isPlaying = playing;
            if (typeof YTMusic.updatePlayerUI === 'function') YTMusic.updatePlayerUI();
        }
        if (typeof MiniAudioPlayer !== 'undefined') {
            if (playing && typeof MiniAudioPlayer.syncPlayingUI === 'function') MiniAudioPlayer.syncPlayingUI();
            else if (!playing && typeof MiniAudioPlayer.syncPausedUI === 'function') MiniAudioPlayer.syncPausedUI();
        }
    }

    function updateTrackUI() {
        const track = state.track || getCurrentTrackFromScript();
        if (!track) return;
        const title = track.title || track.name || 'Unknown';
        const artist = track.artist || track.subtitle || 'Tamil AI Stream';
        const artwork = track.thumbnail || track.cover || track.image || track.albumCover || '';
        setText('gpMiniTitle', title);
        setText('gpMiniArtist', artist);
        setArtwork('gpMiniArtImg', artwork);
        setText('gpExpTitle', title);
        setText('gpExpArtist', artist);
        setText('gpExpMovie', track.movie || track.album || track.movieName || '');
        const movieEl = document.getElementById('gpExpMovie');
        if (movieEl) movieEl.style.display = (track.movie || track.album || track.movieName) ? '' : 'none';
        setArtwork('gpExpArtImg', artwork);
        setText('gpExpSource', track.movie || 'Tamil AI Stream');
        const bg = document.getElementById('gpExpBg');
        if (bg && artwork) bg.style.background = 'radial-gradient(circle at 50% 30%, ' + THEMES[themeIdx].glow + ' 0%, transparent 60%)';
        // Dynamic gradient from artwork
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = artwork;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 50, 50);
                const data = ctx.getImageData(10, 10, 1, 1).data;
                const r = data[0], g = data[1], b = data[2];
                const glowColor = `rgba(${r},${g},${b},0.2)`;
                const gradientColor = `rgba(${r},${g},${b},0.12)`;
                const expandedEl = document.getElementById('gp-expanded');
                if (expandedEl) {
                    expandedEl.style.setProperty('--gp-glow', glowColor);
                    expandedEl.style.setProperty('--gp-dynamic-gradient', `radial-gradient(ellipse at 50% 0%, ${gradientColor} 0%, transparent 70%)`);
                }
            };
        } catch(e) {}
        updateFavUI();
    }

    function updateProgressUI() {
        const cur = state.currentTime;
        const dur = state.duration;
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        setWidth('gpMiniBar', pct + '%');
        setLeft('gpMiniThumb', pct + '%');
        setText('gpMiniCur', fmtTime(cur));
        setText('gpMiniDur', fmtTime(dur));
        setWidth('gpExpBar', pct + '%');
        setLeft('gpExpBarThumb', pct + '%');
        setText('gpExpCur', fmtTime(cur));
        setText('gpExpDur', fmtTime(dur));
        syncLyricsHighlight();
    }

    function updateLiveUI() {
        const isLive = state.isLive || (window.isStreamPlaying && !isFinite(window.audioPlayer?.duration));
        const miniLive = document.getElementById('gpMiniLive');
        const expLive = document.getElementById('gpExpLive');
        if (miniLive) miniLive.style.display = isLive ? 'flex' : 'none';
        if (expLive) expLive.style.display = isLive ? 'flex' : 'none';
        const src = document.getElementById('gpExpSource');
        if (src && isLive) src.textContent = state.track?.title || 'Live FM';
    }

    function updateFavUI() {
        const track = state.track || getCurrentTrackFromScript();
        const isFav = track && typeof PlayerEngine !== 'undefined' && PlayerEngine.isFavorite(track);
        const miniFav = document.querySelector('#gpMiniFav i');
        const expFav = document.querySelector('#gpExpFav i');
        if (miniFav) miniFav.className = isFav ? 'fas fa-heart' : 'far fa-heart';
        if (expFav) expFav.className = isFav ? 'fas fa-heart' : 'far fa-heart';
        const miniBtn = document.getElementById('gpMiniFav');
        const expBtn = document.getElementById('gpExpFav');
        if (miniBtn) miniBtn.classList.toggle('active', isFav);
        if (expBtn) expBtn.classList.toggle('active', isFav);
    }

    function updateShuffleUI() { document.getElementById('gpExpShuffle')?.classList.toggle('active', state.shuffle); }

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
        list.innerHTML = q.map((t, i) =>
            '<div class="gp-q-item ' + (i === idx ? 'active' : '') + '" data-idx="' + i + '">' +
            '<div class="gp-q-num">' + (i === idx ? '<i class="fas fa-volume-high"></i>' : (i + 1)) + '</div>' +
            '<div class="gp-q-art" style="background-image:url(' + (t.thumbnail || t.cover || '') + ')"></div>' +
            '<div class="gp-q-info"><div class="gp-q-name">' + (t.title || t.name || 'Unknown') + '</div>' +
            '<div class="gp-q-artist">' + (t.artist || '') + '</div></div>' +
            '<button class="gp-q-remove" data-idx="' + i + '"><i class="fas fa-times"></i></button></div>'
        ).join('');
        list.querySelectorAll('.gp-q-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.gp-q-remove')) return;
                const i = parseInt(item.dataset.idx);
                // Unify through the global audioPlayer engine so no duplicate players exist
                if (typeof window.playTrackFromYTMusic === 'function') {
                    window.playTrackFromYTMusic(q[i], { queue: q, queueIndex: i });
                } else if (typeof PlayerEngine !== 'undefined') {
                    PlayerEngine.playTrack(q[i], q, i);
                }
            });
        });
        list.querySelectorAll('.gp-q-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof PlayerEngine !== 'undefined') PlayerEngine.removeFromQueue(parseInt(btn.dataset.idx));
                updateQueueUI();
            });
        });
    }

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
            // Analytics: track queue open
            if (!isOpen && typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.track('queue_open');
            if (!isOpen) updateQueueUI();
        }
    }

    function toggleLyrics() {
        const panel = document.getElementById('gpExpLyricsPanel');
        if (!panel) return;
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'flex';
        // Analytics: track lyrics open
        if (!isOpen && typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.track('lyrics_open');
        if (!isOpen) loadLyrics();
    }

    function showMiniPlayer() {
        miniEl?.classList.add('visible');
        document.body.classList.add('gp-visible');
    }

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
            html += '<div class="gp-lyrics-line" data-idx="' + i + '" data-time="' + _currentLyrics[i].time + '">' +
                '<span class="gp-lyrics-ts">' + fmtTime(_currentLyrics[i].time) + '</span>' +
                '<span class="gp-lyrics-txt">' + escHtml(_currentLyrics[i].text) + '</span></div>';
        }
        content.innerHTML = html;
        content.querySelectorAll('.gp-lyrics-line').forEach(el => {
            el.addEventListener('click', () => seekToTime(parseFloat(el.dataset.time)));
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
            const interval = 4;
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

    function startVisualizer() {
        const canvas = document.getElementById('gpExpVisualizer');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        function draw() {
            if (document.hidden) { waveformRAF = requestAnimationFrame(draw); return; }
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

    function stopVisualizer() { if (waveformRAF) cancelAnimationFrame(waveformRAF); }

    function startEqAnimation() {
        if (eqRAF) cancelAnimationFrame(eqRAF);
        eqRAF = null;
        if (!state.isPlaying) {
            document.querySelectorAll('.gp-mini-eq span, .gp-exp-eq span').forEach(bar => { bar.style.height = '3px'; });
            return;
        }
        function animate() {
            if (!state.isPlaying || document.hidden) {
                document.querySelectorAll('.gp-mini-eq span, .gp-exp-eq span').forEach(bar => { bar.style.height = '3px'; });
                eqRAF = null;
                return;
            }
            document.querySelectorAll('.gp-mini-eq span, .gp-exp-eq span').forEach((bar) => {
                bar.style.height = (4 + Math.random() * 14) + 'px';
            });
            eqRAF = requestAnimationFrame(animate);
        }
        eqRAF = requestAnimationFrame(animate);
    }

    function drawMiniWaveform() {
        const canvas = document.getElementById('gpMiniWaveCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = 80;
        canvas.height = 32;
        function draw() {
            if (document.hidden) { _lyricsRAF = requestAnimationFrame(draw); return; }
            ctx.clearRect(0, 0, 80, 32);
            if (!state.isPlaying) {
                _lyricsRAF = null;
                return;
            }
            const freqData = (typeof PlayerEngine !== 'undefined' && PlayerEngine.getFrequencyData) ? PlayerEngine.getFrequencyData() : null;
            if (!freqData) { _lyricsRAF = requestAnimationFrame(draw); return; }
            const bars = 16;
            const barW = 80 / bars;
            const step = Math.floor(freqData.length / bars);
            for (let i = 0; i < bars; i++) {
                const val = freqData[i * step] / 255;
                const barH = val * 28 + 2;
                const hue = (i / bars) * 120 + 140;
                ctx.fillStyle = 'hsla(' + hue + ', 80%, 60%, 0.8)';
                ctx.fillRect(i * barW + 1, 32 - barH, barW - 2, barH);
            }
            _lyricsRAF = requestAnimationFrame(draw);
        }
        draw();
    }

    function cycleTheme() {
        themeIdx = (themeIdx + 1) % THEMES.length;
        applyTheme();
        try { localStorage.setItem('global_player_state', JSON.stringify({ themeIdx, volume: state.volume })); } catch (e) {}
        if (typeof PlayerEngine !== 'undefined' && PlayerEngine.state) PlayerEngine.state.colorTheme = themeIdx;
        if (typeof showToast === 'function') showToast('Theme: ' + THEMES[themeIdx].name, 'info');
    }

    function applyTheme() {
        const t = THEMES[themeIdx] || THEMES[0];
        document.documentElement.style.setProperty('--gp-theme', t.grad);
        document.documentElement.style.setProperty('--gp-glow', t.glow);
        document.documentElement.style.setProperty('--gp-accent', t.accent);
    }

    function getCurrentTrackFromScript() {
        if (typeof window.currentPlaybackTrack !== 'undefined') return window.currentPlaybackTrack;
        return null;
    }

    function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
    function setWidth(id, w) { const el = document.getElementById(id); if (el) el.style.width = w; }
    function setLeft(id, l) { const el = document.getElementById(id); if (el) el.style.left = l; }
    function setArtwork(id, url) {
        const el = document.getElementById(id);
        if (el) { el.style.backgroundImage = url ? 'url(' + url + ')' : ''; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
    }

    function fmtTime(sec) {
        if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    function escHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

    function updateEqBars(playing) {
        document.querySelectorAll('.gp-mini-eq span').forEach(bar => { bar.style.animationPlayState = playing ? 'running' : 'paused'; });
    }

    function injectStyles() {
        if (document.getElementById('gpStyles')) return;
        const style = document.createElement('style');
        style.id = 'gpStyles';
        style.textContent = '';
        document.head.appendChild(style);
    }

    function toggleFullPlayer() { isExpanded ? collapse() : expand(); }

    function closePlayer() {
        collapse();
        if (typeof PlayerEngine !== 'undefined') PlayerEngine.pause();
        const miniEl = document.getElementById('gp-mini');
        if (miniEl) miniEl.classList.remove('visible');
        document.body.classList.remove('gp-active');
        document.body.classList.remove('gp-visible');
    }

    function toggleAiBot() {
        const body = document.getElementById('gpAiBotBody');
        const toggle = document.getElementById('gpAiBotToggle');
        if (!body) return;
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'flex';
        if (toggle) toggle.querySelector('i').className = isOpen ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }

    function sendAiBotMessage() {
        const input = document.getElementById('gpAiBotInput');
        const messagesEl = document.getElementById('gpAiBotMessages');
        if (!input || !messagesEl) return;
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        // Add user message
        messagesEl.innerHTML += '<div class="gp-ai-bot-msg gp-ai-bot-msg-user"><span>' + escHtml(text) + '</span></div>';
        messagesEl.scrollTop = messagesEl.scrollHeight;
        // Process with AI Music Assistant
        let response = 'I can help with music controls. Try: "play", "pause", "next", "previous", "what is playing", "show lyrics", "recommend songs", or "show queue".';
        try {
            if (typeof AIMusicAssistant !== 'undefined' && AIMusicAssistant.generateResponse) {
                const result = AIMusicAssistant.generateResponse(text);
                if (result && result.text) response = result.text;
            }
        } catch (e) { /* fallback to default response */ }
        // Add AI response
        setTimeout(() => {
            messagesEl.innerHTML += '<div class="gp-ai-bot-msg gp-ai-bot-msg-ai"><i class="fas fa-robot"></i><span>' + escHtml(response) + '</span></div>';
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }, 300);
    }

    return {
        init, expand, collapse, toggleFullPlayer, toggleQueue, toggleLyrics,
        togglePlay, playPrev, playNext, seekToPercent, seekToTime, setVolume,
        showMiniPlayer, cycleTheme, updateTrackUI, updatePlayUI, updateProgressUI, updateLiveUI
    };
})();