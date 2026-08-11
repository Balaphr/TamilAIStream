'use strict';

/* ============================================
   PlayerUI - Mini Player + Full Player
   Spotify-style, Glassmorphism, Visualizer
   ============================================ */

const PlayerUI = (() => {
    let miniPlayerEl = null;
    let fullPlayerEl = null;
    let visualizerRAF = null;
    let waveformRAF = null;
    let eqBarsRAF = null;
    let isDragging = false;

    /* ---- Mini Player ---- */
    function createMiniPlayer() {
        if (document.getElementById('mini-player')) return;
        const el = document.createElement('div');
        el.id = 'mini-player';
        el.className = 'mini-player';
        el.innerHTML = `
            <div class="mini-player-inner">
                <div class="mini-player-artwork" id="miniArtwork">
                    <div class="mini-artwork-img" id="miniArtworkImg"></div>
                    <div class="mini-eq-bars" id="miniEqBars">
                        <span></span><span></span><span></span><span></span>
                    </div>
                </div>
                <div class="mini-player-info" id="miniInfo">
                    <div class="mini-track-name" id="miniTrackName">Select a song</div>
                    <div class="mini-track-artist" id="miniTrackArtist">Tamil AI Stream</div>
                    <div class="mini-time-row">
                        <span id="miniCurrentTime">0:00</span>
                        <span id="miniDuration">0:00</span>
                    </div>
                </div>
                <div class="mini-player-progress" id="miniProgressWrap">
                    <div class="mini-progress-bar" id="miniProgressBar"></div>
                    <div class="mini-progress-buffered" id="miniProgressBuffered"></div>
                    <div class="mini-progress-thumb" id="miniProgressThumb"></div>
                </div>
                <div class="mini-player-controls">
                    <button class="mini-btn mini-ai-btn" id="miniAiBtn" title="AI Auto-DJ"><i class="fas fa-robot"></i></button>
                    <button class="mini-btn mini-color-btn" id="miniColorBtn" title="Color Theme"><i class="fas fa-palette"></i></button>
                    <button class="mini-btn" id="miniPrev" title="Previous"><i class="fas fa-backward-step"></i></button>
                    <button class="mini-btn mini-play-btn" id="miniPlayBtn" title="Play"><i class="fas fa-play"></i></button>
                    <button class="mini-btn" id="miniNext" title="Next"><i class="fas fa-forward-step"></i></button>
                    <button class="mini-btn mini-fav-btn" id="miniFavBtn" title="Favorite"><i class="far fa-heart"></i></button>
                </div>
                <div class="mini-player-right">
                    <button class="mini-btn mini-queue-btn" id="miniQueueBtn" title="Queue"><i class="fas fa-bars-staggered"></i></button>
                    <button class="mini-btn mini-expand-btn" id="miniExpandBtn" title="Expand"><i class="fas fa-chevron-up"></i></button>
                </div>
            </div>
            <div class="mini-now-playing" id="miniNowPlaying">
                <span class="mini-np-dot"></span>
                <span class="mini-np-text" id="miniNpText">Now Playing</span>
            </div>
        `;
        document.body.appendChild(el);
        miniPlayerEl = el;
        bindMiniPlayerEvents();
    }

    function bindMiniPlayerEvents() {
        document.getElementById('miniPlayBtn')?.addEventListener('click', () => {
            if (typeof window.pausePlayback === 'function' && typeof window.isStreamPlaying !== 'undefined' && window.isStreamPlaying) {
                window.pausePlayback();
            } else if (typeof window.resumePlayback === 'function') {
                window.resumePlayback();
            } else {
                PlayerEngine.togglePlay();
            }
        });
        document.getElementById('miniPrev')?.addEventListener('click', () => {
            if (typeof window.playPreviousTrack === 'function') { window.playPreviousTrack(); }
            else { PlayerEngine.playPrevious(); }
        });
        document.getElementById('miniNext')?.addEventListener('click', () => {
            if (typeof window.playNextTrack === 'function') { window.playNextTrack(); }
            else { PlayerEngine.playNext(); }
        });
        document.getElementById('miniFavBtn')?.addEventListener('click', () => {
            const track = PlayerEngine.currentTrack;
            if (track) {
                const isFav = PlayerEngine.toggleFavorite(track);
                PlaylistManager.toggleFavorite(track);
                updateFavButton(isFav);
            }
        });
        document.getElementById('miniAiBtn')?.addEventListener('click', () => {
            const enabled = PlayerEngine.toggleAIAutomation();
            updateAIButton(enabled);
            if (enabled) {
                // Show AI activity in now-playing bar
                const npText = document.getElementById('miniNpText');
                if (npText) npText.textContent = 'AI Auto-DJ Active';
                showToast('🤖 AI Auto-DJ enabled - smart music automation', 'success');
            } else {
                const npText = document.getElementById('miniNpText');
                if (npText) npText.textContent = 'Now Playing';
                showToast('AI Auto-DJ disabled', 'info');
            }
        });
        document.getElementById('miniColorBtn')?.addEventListener('click', () => {
            const theme = PlayerEngine.cycleColorTheme();
            showColorThemeToast(theme);
        });
        // Also make miniInfo clickable to open full player
        document.getElementById('miniInfo')?.addEventListener('click', () => toggleFullPlayer());
        document.getElementById('miniExpandBtn')?.addEventListener('click', () => toggleFullPlayer());
        document.getElementById('miniQueueBtn')?.addEventListener('click', () => toggleQueuePanel());

        const progressWrap = document.getElementById('miniProgressWrap');
        if (progressWrap) {
            const seek = (e) => {
                const rect = progressWrap.getBoundingClientRect();
                if (!rect || rect.width <= 0) return;
                const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                if (typeof seekPlaybackToPercent === 'function') {
                    seekPlaybackToPercent(pct);
                } else if (typeof window.audioPlayer !== 'undefined' && window.audioPlayer && window.audioPlayer.duration) {
                    window.audioPlayer.currentTime = pct * window.audioPlayer.duration;
                } else {
                    PlayerEngine.seekToPercent(pct);
                }
            };
            progressWrap.addEventListener('mousedown', (e) => { isDragging = true; seek(e); e.preventDefault(); e.stopPropagation(); });
            document.addEventListener('mousemove', (e) => { if (isDragging) seek(e); });
            document.addEventListener('mouseup', () => { isDragging = false; });
            progressWrap.addEventListener('touchstart', (e) => { isDragging = true; seek(e.touches[0]); e.preventDefault(); e.stopPropagation(); }, { passive: false });
            progressWrap.addEventListener('touchmove', (e) => { if (isDragging) { e.preventDefault(); seek(e.touches[0]); } }, { passive: false });
            document.addEventListener('touchend', () => { isDragging = false; });
        }
    }

    function updateMiniPlayer(state) {
        const track = state.currentTrack;
        if (!track) return;

        const name = track.title || track.name || 'Unknown';
        const artist = track.artist || track.subtitle || 'Tamil AI Stream';

        document.getElementById('miniTrackName').textContent = name;
        document.getElementById('miniTrackArtist').textContent = artist;

        const artwork = track.thumbnail || track.cover || track.image || '';
        const artworkImg = document.getElementById('miniArtworkImg');
        if (artworkImg) {
            artworkImg.style.backgroundImage = artwork ? `url(${artwork})` : '';
            artworkImg.style.backgroundSize = 'cover';
            artworkImg.style.backgroundPosition = 'center';
        }

        updateFavButton(PlayerEngine.isFavorite(track));
        updatePlayButton(state.isPlaying);
        updateEqBars(state.isPlaying);
        showMiniPlayer();
        updateAIButton(PlayerEngine.aiAutomation);
        applyColorTheme(PlayerEngine.colorTheme);
    }

    // ============================================
    // AI Automation UI & Color Themes
    // ============================================
    const COLOR_THEMES = [
        { name: 'Emerald & Blue', css: 'linear-gradient(90deg, #34d399, #3b82f6)', glow: 'rgba(52,211,153,0.5)' },
        { name: 'Sunset', css: 'linear-gradient(90deg, #f97316, #ef4444)', glow: 'rgba(249,115,22,0.5)' },
        { name: 'Purple Dream', css: 'linear-gradient(90deg, #a855f7, #6366f1)', glow: 'rgba(168,85,247,0.5)' },
        { name: 'Ocean Wave', css: 'linear-gradient(90deg, #06b6d4, #3b82f6)', glow: 'rgba(6,182,212,0.5)' },
        { name: 'Pink Sunset', css: 'linear-gradient(90deg, #ec4899, #f97316)', glow: 'rgba(236,72,153,0.5)' },
        { name: 'Lime Fresh', css: 'linear-gradient(90deg, #84cc16, #34d399)', glow: 'rgba(132,204,22,0.5)' }
    ];

    function showMiniPlayer() {
        const mini = document.getElementById('mini-player');
        if (mini) mini.classList.add('visible');
    }

    function hideMiniPlayer() {
        const mini = document.getElementById('mini-player');
        if (mini) mini.classList.remove('visible');
    }

    function updateAIButton(enabled) {
        const btn = document.getElementById('miniAiBtn');
        if (btn) {
            btn.classList.toggle('active', enabled);
            btn.innerHTML = enabled
                ? '<i class="fas fa-robot"></i><span class="mini-ai-indicator"></span>'
                : '<i class="fas fa-robot"></i>';
        }
    }

    function showColorThemeToast(theme) {
        const t = COLOR_THEMES[theme] || COLOR_THEMES[0];
        const toast = document.createElement('div');
        toast.className = 'toast-notification visible color-theme-toast';
        toast.innerHTML = `
            <div class="toast-icon" style="background:${t.css};-webkit-background-clip:text;background-clip:text;color:transparent;">
                <i class="fas fa-palette"></i>
            </div>
            <span>Color Theme: ${t.name}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    function applyColorTheme(theme) {
        const t = COLOR_THEMES[theme] || COLOR_THEMES[0];
        const mini = document.getElementById('mini-player');
        const full = document.getElementById('full-player');
        
        if (mini) {
            mini.style.setProperty('--mini-theme', t.css);
            mini.style.setProperty('--mini-glow', t.glow);
        }
        if (full) {
            full.style.setProperty('--fp-theme', t.css);
        }
        
        // Update progress bars
        const miniBar = document.getElementById('miniProgressBar');
        if (miniBar) miniBar.style.background = t.css;
        const fpBar = document.getElementById('fpProgressBar');
        if (fpBar) fpBar.style.background = t.css;
        
        // Update play buttons
        const miniPlay = document.querySelector('.mini-play-btn');
        if (miniPlay) miniPlay.style.background = t.css;
        const fpPlay = document.querySelector('.fp-play-btn');
        if (fpPlay) { fpPlay.style.background = t.css; }
        
        // Update EQ bars
        const eqBars = document.querySelectorAll('.mini-eq-bars span, .fp-eq-bars span');
        eqBars.forEach(bar => { bar.style.background = t.css; });
        
        // Update now-playing dot
        const npDot = document.querySelector('.mini-np-dot');
        if (npDot) npDot.style.background = t.css.split('gradient')[0] || t.glow;
        
        // Update full player bg glow
        const fpBg = document.getElementById('fpBg');
        if (fpBg) {
            fpBg.style.background = t.css.replace('90deg', '135deg').replace('linear-gradient', 'radial-gradient');
            fpBg.style.opacity = '0.3';
        }
    }

    function updatePlayButton(isPlaying) {
        const btn = document.getElementById('miniPlayBtn');
        if (btn) {
            btn.innerHTML = isPlaying
                ? '<i class="fas fa-pause"></i>'
                : '<i class="fas fa-play"></i>';
            btn.classList.toggle('playing', isPlaying);
        }
    }

    function updateFavButton(isFav) {
        const btn = document.getElementById('miniFavBtn');
        if (btn) {
            btn.innerHTML = isFav
                ? '<i class="fas fa-heart"></i>'
                : '<i class="far fa-heart"></i>';
            btn.classList.toggle('active', isFav);
        }
    }

    function updateProgress(current, duration) {
        if (isDragging || !duration) return;
        const pct = (current / duration) * 100;
        const bar = document.getElementById('miniProgressBar');
        const thumb = document.getElementById('miniProgressThumb');
        if (bar) bar.style.width = pct + '%';
        if (thumb) thumb.style.left = pct + '%';

        const curEl = document.getElementById('miniCurrentTime');
        const durEl = document.getElementById('miniDuration');
        if (curEl) curEl.textContent = formatTime(current);
        if (durEl) durEl.textContent = formatTime(duration);
    }

    function updateEqBars(playing) {
        const bars = document.querySelectorAll('#miniEqBars span');
        bars.forEach((bar, i) => {
            bar.style.animationPlayState = playing ? 'running' : 'paused';
        });
    }

    /* ---- Full Player ---- */
    function createFullPlayer() {
        if (document.getElementById('full-player')) return;
        const el = document.createElement('div');
        el.id = 'full-player';
        el.className = 'full-player';
        el.innerHTML = `
            <div class="fp-bg" id="fpBg"></div>
            <div class="fp-container">
                <div class="fp-header">
                    <button class="fp-btn" id="fpCollapse"><i class="fas fa-chevron-down"></i></button>
                    <div class="fp-header-title">
                        <span>Playing from</span>
                        <strong id="fpSource">Tamil AI Stream</strong>
                    </div>
                    <button class="fp-btn" id="fpMore"><i class="fas fa-ellipsis-vertical"></i></button>
                </div>

                <div class="fp-artwork-container">
                    <div class="fp-artwork" id="fpArtwork">
                        <div class="fp-artwork-img" id="fpArtworkImg"></div>
                        <div class="fp-artwork-glow"></div>
                    </div>
                    <canvas class="fp-visualizer" id="fpVisualizer"></canvas>
                </div>

                <div class="fp-info">
                    <div class="fp-track-name" id="fpTrackName">Select a song</div>
                    <div class="fp-track-artist" id="fpTrackArtist">Tamil AI Stream</div>
                    <div class="fp-quality-badge" id="fpQuality">HD</div>
                </div>

                <div class="fp-progress">
                    <div class="fp-progress-bar-wrap" id="fpProgressWrap">
                        <div class="fp-progress-bar" id="fpProgressBar"></div>
                        <div class="fp-progress-thumb" id="fpProgressThumb"></div>
                    </div>
                    <div class="fp-time-row">
                        <span id="fpCurrentTime">0:00</span>
                        <span id="fpDuration">0:00</span>
                    </div>
                </div>

                <div class="fp-controls">
                    <button class="fp-ctrl-btn" id="fpShuffle" title="Shuffle"><i class="fas fa-shuffle"></i></button>
                    <button class="fp-ctrl-btn" id="fpPrev" title="Previous"><i class="fas fa-backward-step"></i></button>
                    <button class="fp-ctrl-btn fp-play-btn" id="fpPlayBtn" title="Play"><i class="fas fa-play"></i></button>
                    <button class="fp-ctrl-btn" id="fpNext" title="Next"><i class="fas fa-forward-step"></i></button>
                    <button class="fp-ctrl-btn" id="fpRepeat" title="Repeat"><i class="fas fa-repeat"></i></button>
                </div>

                <div class="fp-secondary-controls">
                    <button class="fp-btn" id="fpFav" title="Favorite"><i class="far fa-heart"></i></button>
                    <button class="fp-btn" id="fpLyrics" title="Lyrics"><i class="fas fa-microphone-lines"></i></button>
                    <button class="fp-btn" id="fpQueue" title="Queue"><i class="fas fa-bars-staggered"></i></button>
                    <button class="fp-btn" id="fpShare" title="Share"><i class="fas fa-share-nodes"></i></button>
                    <button class="fp-btn" id="fpDownload" title="Download"><i class="fas fa-download"></i></button>
                    <button class="fp-btn" id="fpSleep" title="Sleep Timer"><i class="fas fa-moon"></i></button>
                    <button class="fp-btn" id="fpSpeed" title="Speed">1x</button>
                    <button class="fp-btn" id="fpVolume" title="Volume"><i class="fas fa-volume-high"></i></button>
                </div>

                <div class="fp-volume-slider" id="fpVolumeSlider" style="display:none;">
                    <i class="fas fa-volume-low"></i>
                    <input type="range" min="0" max="100" value="80" id="fpVolumeRange">
                    <i class="fas fa-volume-high"></i>
                </div>

                <div class="fp-eq-bars" id="fpEqBars">
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                </div>
            </div>

            <div class="fp-lyrics-panel" id="fpLyricsPanel" style="display:none;">
                <div class="fp-lyrics-header">
                    <span class="fp-lyrics-title">Lyrics</span>
                    <button class="fp-lyrics-close" id="fpLyricsClose"><i class="fas fa-times"></i></button>
                </div>
                <div class="fp-lyrics-content" id="fpLyricsContent">
                    <div class="fp-lyrics-unavailable">No lyrics available for this track</div>
                </div>
            </div>

            <div class="fp-queue-panel" id="fpQueuePanel" style="display:none;">
                <div class="fp-queue-header">
                    <h3>Queue</h3>
                    <div class="fp-queue-actions">
                        <button id="fpQueueSave" class="fp-q-btn">Save as Playlist</button>
                        <button id="fpQueueClear" class="fp-q-btn">Clear</button>
                    </div>
                </div>
                <div class="fp-queue-list" id="fpQueueList"></div>
            </div>
        `;
        document.body.appendChild(el);
        fullPlayerEl = el;
        bindFullPlayerEvents();
    }

    function bindFullPlayerEvents() {
        document.getElementById('fpCollapse')?.addEventListener('click', () => toggleFullPlayer());
        document.getElementById('fpPlayBtn')?.addEventListener('click', () => {
            if (typeof window.pausePlayback === 'function' && typeof window.isStreamPlaying !== 'undefined' && window.isStreamPlaying) {
                window.pausePlayback();
            } else if (typeof window.resumePlayback === 'function') {
                window.resumePlayback();
            } else {
                PlayerEngine.togglePlay();
            }
        });
        document.getElementById('fpPrev')?.addEventListener('click', () => {
            if (typeof window.playPreviousTrack === 'function') { window.playPreviousTrack(); }
            else { PlayerEngine.playPrevious(); }
        });
        document.getElementById('fpNext')?.addEventListener('click', () => {
            if (typeof window.playNextTrack === 'function') { window.playNextTrack(); }
            else { PlayerEngine.playNext(); }
        });
        document.getElementById('fpShuffle')?.addEventListener('click', () => PlayerEngine.toggleShuffle());
        document.getElementById('fpRepeat')?.addEventListener('click', () => PlayerEngine.cycleRepeat());

        document.getElementById('fpFav')?.addEventListener('click', () => {
            const track = PlayerEngine.currentTrack;
            if (track) {
                const isFav = PlayerEngine.toggleFavorite(track);
                PlaylistManager.toggleFavorite(track);
                updateFullFavButton(isFav);
            }
        });

        document.getElementById('fpQueue')?.addEventListener('click', () => toggleQueuePanel());
        document.getElementById('fpLyrics')?.addEventListener('click', () => toggleLyricsPanel());
        document.getElementById('fpLyricsClose')?.addEventListener('click', () => toggleLyricsPanel());
        document.getElementById('fpShare')?.addEventListener('click', () => shareTrack());
        document.getElementById('fpDownload')?.addEventListener('click', () => downloadTrack());
        document.getElementById('fpSleep')?.addEventListener('click', () => showSleepTimer());

        document.getElementById('fpSpeed')?.addEventListener('click', () => {
            const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
            const current = PlayerEngine.getState().speed;
            const next = speeds[(speeds.indexOf(current) + 1) % speeds.length];
            PlayerEngine.setSpeed(next);
            document.getElementById('fpSpeed').textContent = next + 'x';
        });

        document.getElementById('fpVolume')?.addEventListener('click', () => {
            const slider = document.getElementById('fpVolumeSlider');
            slider.style.display = slider.style.display === 'none' ? 'flex' : 'none';
        });

        document.getElementById('fpVolumeRange')?.addEventListener('input', (e) => {
            PlayerEngine.setVolume(e.target.value / 100);
        });

        const progressWrap = document.getElementById('fpProgressWrap');
        if (progressWrap) {
            const seek = (e) => {
                const rect = progressWrap.getBoundingClientRect();
                if (!rect || rect.width <= 0) return;
                const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                if (typeof seekPlaybackToPercent === 'function') {
                    seekPlaybackToPercent(pct);
                } else if (typeof window.audioPlayer !== 'undefined' && window.audioPlayer && window.audioPlayer.duration) {
                    window.audioPlayer.currentTime = pct * window.audioPlayer.duration;
                } else {
                    PlayerEngine.seekToPercent(pct);
                }
            };
            progressWrap.addEventListener('mousedown', (e) => { isDragging = true; seek(e); e.preventDefault(); e.stopPropagation(); });
            document.addEventListener('mousemove', (e) => { if (isDragging) seek(e); });
            document.addEventListener('mouseup', () => { isDragging = false; });
            progressWrap.addEventListener('touchstart', (e) => { isDragging = true; seek(e.touches[0]); e.preventDefault(); e.stopPropagation(); }, { passive: false });
            progressWrap.addEventListener('touchmove', (e) => { if (isDragging) { e.preventDefault(); seek(e.touches[0]); } }, { passive: false });
            document.addEventListener('touchend', () => { isDragging = false; });
        }

        document.getElementById('fpQueueClear')?.addEventListener('click', () => PlayerEngine.clearQueue());
        document.getElementById('fpQueueSave')?.addEventListener('click', () => {
            const queue = PlayerEngine.queue;
            if (queue.length) {
                const pl = PlaylistManager.createPlaylist('Queue ' + new Date().toLocaleDateString());
                PlaylistManager.addToPlaylist(pl.id, queue);
            }
        });
    }

    function updateFullPlayer(state) {
        const track = state.currentTrack;
        if (!track) return;

        document.getElementById('fpTrackName').textContent = track.title || track.name || 'Unknown';
        document.getElementById('fpTrackArtist').textContent = track.artist || track.subtitle || 'Tamil AI Stream';

        const artwork = track.thumbnail || track.cover || track.image || '';
        const artworkImg = document.getElementById('fpArtworkImg');
        if (artworkImg) {
            artworkImg.style.backgroundImage = artwork ? `url(${artwork})` : '';
        }

        updateFullPlayButton(state.isPlaying);
        updateFullFavButton(PlayerEngine.isFavorite(track));
        updateShuffleButton(state.shuffle);
        updateRepeatButton(state.repeat);
        updateQueueList();
    }

    function updateFullPlayButton(isPlaying) {
        const btn = document.getElementById('fpPlayBtn');
        if (btn) {
            btn.innerHTML = isPlaying
                ? '<i class="fas fa-pause"></i>'
                : '<i class="fas fa-play"></i>';
            btn.classList.toggle('playing', isPlaying);
        }
    }

    function updateFullFavButton(isFav) {
        const btn = document.getElementById('fpFav');
        if (btn) {
            btn.innerHTML = isFav
                ? '<i class="fas fa-heart"></i>'
                : '<i class="far fa-heart"></i>';
            btn.classList.toggle('active', isFav);
        }
    }

    function updateShuffleButton(shuffle) {
        document.getElementById('fpShuffle')?.classList.toggle('active', shuffle);
    }

    function updateRepeatButton(repeat) {
        const btn = document.getElementById('fpRepeat');
        if (!btn) return;
        btn.classList.toggle('active', repeat !== 'off');
        btn.innerHTML = repeat === 'one'
            ? '<i class="fas fa-repeat"></i><span class="fp-repeat-1">1</span>'
            : '<i class="fas fa-repeat"></i>';
    }

    function updateFullProgress(current, duration) {
        if (isDragging || !duration) return;
        const pct = (current / duration) * 100;
        document.getElementById('fpProgressBar').style.width = pct + '%';
        document.getElementById('fpProgressThumb').style.left = pct + '%';
        document.getElementById('fpCurrentTime').textContent = formatTime(current);
        document.getElementById('fpDuration').textContent = formatTime(duration);
    }

    function updateQueueList() {
        const list = document.getElementById('fpQueueList');
        if (!list) return;
        const queue = PlayerEngine.queue;
        const idx = PlayerEngine.queueIndex;

        list.innerHTML = queue.map((track, i) => `
            <div class="fp-queue-item ${i === idx ? 'active' : ''}" data-index="${i}" draggable="true">
                <div class="fp-queue-num">${i === idx ? '<i class="fas fa-volume-high"></i>' : i + 1}</div>
                <div class="fp-queue-art" style="background-image:url(${track.thumbnail || track.cover || ''})"></div>
                <div class="fp-queue-info">
                    <div class="fp-queue-name">${track.title || track.name || 'Unknown'}</div>
                    <div class="fp-queue-artist">${track.artist || ''}</div>
                </div>
                <button class="fp-queue-remove" data-index="${i}"><i class="fas fa-times"></i></button>
            </div>
        `).join('');

        list.querySelectorAll('.fp-queue-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.fp-queue-remove')) return;
                const i = parseInt(item.dataset.index);
                PlayerEngine.playTrack(queue[i], queue, i);
            });
            item.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', item.dataset.index));
            item.addEventListener('dragover', (e) => e.preventDefault());
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const from = parseInt(e.dataTransfer.getData('text/plain'));
                const to = parseInt(item.dataset.index);
                PlayerEngine.reorderQueue(from, to);
                updateQueueList();
            });
        });

        list.querySelectorAll('.fp-queue-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                PlayerEngine.removeFromQueue(parseInt(btn.dataset.index));
                updateQueueList();
            });
        });
    }

    /* ---- Visualizer ---- */
    function startVisualizer() {
        const canvas = document.getElementById('fpVisualizer');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        function resize() {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        resize();
        window.addEventListener('resize', resize);

        function draw() {
            if (!PlayerEngine.isPlaying) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                visualizerRAF = requestAnimationFrame(draw);
                return;
            }

            const freqData = PlayerEngine.getFrequencyData();
            if (!freqData) { visualizerRAF = requestAnimationFrame(draw); return; }

            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            ctx.clearRect(0, 0, w, h);

            const bars = 64;
            const barWidth = w / bars;
            const step = Math.floor(freqData.length / bars);

            for (let i = 0; i < bars; i++) {
                const value = freqData[i * step] / 255;
                const barHeight = value * h * 0.8;

                const gradient = ctx.createLinearGradient(0, h, 0, h - barHeight);
                gradient.addColorStop(0, 'rgba(16,185,129,0.8)');
                gradient.addColorStop(0.5, 'rgba(52,211,153,0.6)');
                gradient.addColorStop(1, 'rgba(59,130,246,0.4)');

                ctx.fillStyle = gradient;
                ctx.fillRect(i * barWidth + 1, h - barHeight, barWidth - 2, barHeight);

                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(i * barWidth + 1, h - barHeight - 2, barWidth - 2, 2);
            }

            visualizerRAF = requestAnimationFrame(draw);
        }
        draw();
    }

    function stopVisualizer() {
        if (visualizerRAF) cancelAnimationFrame(visualizerRAF);
    }

    /* ---- EQ Bars Animation ---- */
    function startEqAnimation() {
        function animate() {
            const bars = document.querySelectorAll('.fp-eq-bars span, #miniEqBars span');
            bars.forEach((bar, i) => {
                if (PlayerEngine.isPlaying) {
                    const h = 4 + Math.random() * 16;
                    bar.style.height = h + 'px';
                } else {
                    bar.style.height = '3px';
                }
            });
            eqBarsRAF = requestAnimationFrame(animate);
        }
        animate();
    }

    /* ---- Panel Toggles ---- */
    function toggleFullPlayer() {
        const fp = document.getElementById('full-player');
        if (!fp) return;
        fp.classList.toggle('open');
        if (fp.classList.contains('open')) {
            document.body.style.overflow = 'hidden';
            startVisualizer();
        } else {
            document.body.style.overflow = '';
            stopVisualizer();
        }
    }

    function toggleQueuePanel() {
        const panel = document.getElementById('fpQueuePanel');
        if (panel) {
            const isOpen = panel.style.display !== 'none';
            panel.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) updateQueueList();
        }
    }

    function toggleLyricsPanel() {
        const panel = document.getElementById('fpLyricsPanel');
        if (!panel) return;
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) {
            loadLyricsForCurrentTrack();
        }
    }

    /* ---- Lyrics Time-Sync System ---- */
    let _currentLyrics = [];
    let _lyricsScrollTimer = null;

    function loadLyricsForCurrentTrack() {
        const content = document.getElementById('fpLyricsContent');
        if (!content) return;

        const track = PlayerEngine.currentTrack || window._currentSongData;
        if (!track) {
            content.innerHTML = '<div class="fp-lyrics-unavailable">No track playing</div>';
            return;
        }

        // Check if lyrics exist on the track object
        let lyricsText = track.lyrics || track.lyricText || '';

        // Also check DataStore for lyrics by song ID
        if (!lyricsText && track.id) {
            const songs = DataStore.getSongs ? DataStore.getSongs() : [];
            const song = songs.find(s => s.id === track.id);
            if (song && song.lyrics) lyricsText = song.lyrics;
        }

        if (!lyricsText) {
            content.innerHTML = '<div class="fp-lyrics-unavailable">No lyrics available for this track</div>';
            _currentLyrics = [];
            return;
        }

        _currentLyrics = AIAutomation.parseLyrics(lyricsText);
        if (_currentLyrics.length === 0) {
            content.innerHTML = '<div class="fp-lyrics-unavailable">Could not parse lyrics</div>';
            return;
        }

        // Render lyrics lines
        let html = '';
        for (let i = 0; i < _currentLyrics.length; i++) {
            const line = _currentLyrics[i];
            const timeStr = formatTime(line.time);
            html += '<div class="fp-lyrics-line" data-idx="' + i + '" data-time="' + line.time + '">';
            html += '<span class="fp-lyrics-time">' + timeStr + '</span>';
            html += '<span class="fp-lyrics-text">' + escapeHtml(line.text) + '</span>';
            html += '</div>';
        }
        content.innerHTML = html;

        // Bind click-to-seek
        content.querySelectorAll('.fp-lyrics-line').forEach(el => {
            el.addEventListener('click', () => {
                const time = parseFloat(el.dataset.time);
                seekToLyricTime(time);
            });
        });

        // Start sync
        startLyricsSync();
    }

    function seekToLyricTime(time) {
        // Set the seeking flag so the waiting handler suppresses the toast
        window._isSeeking = true;
        window._seekingUntil = Date.now() + 1200;
        // Seek the global audioPlayer (script.js)
        if (typeof window.audioPlayer !== 'undefined' && window.audioPlayer) {
            window.audioPlayer.currentTime = time;
        }
        // Also seek PlayerEngine
        if (typeof PlayerEngine !== 'undefined' && PlayerEngine.seekTo) {
            PlayerEngine.seekTo(time);
        }
    }

    function startLyricsSync() {
        if (_lyricsScrollTimer) clearInterval(_lyricsScrollTimer);
        _lyricsScrollTimer = setInterval(syncLyricsHighlight, 250);
    }

    function syncLyricsHighlight() {
        if (_currentLyrics.length === 0) return;
        const panel = document.getElementById('fpLyricsPanel');
        if (!panel || panel.style.display === 'none') {
            clearInterval(_lyricsScrollTimer);
            return;
        }

        let currentTime = 0;
        if (typeof window.audioPlayer !== 'undefined' && window.audioPlayer) {
            currentTime = window.audioPlayer.currentTime || 0;
        }

        const idx = AIAutomation.findCurrentLyricLine(_currentLyrics, currentTime);
        if (idx < 0) return;

        const content = document.getElementById('fpLyricsContent');
        if (!content) return;

        const lines = content.querySelectorAll('.fp-lyrics-line');
        let changed = false;
        lines.forEach((el, i) => {
            const isActive = i === idx;
            if (isActive && !el.classList.contains('active')) {
                el.classList.add('active');
                changed = true;
            } else if (!isActive && el.classList.contains('active')) {
                el.classList.remove('active');
            }
        });

        // Auto-scroll to active line
        if (changed && lines[idx]) {
            const containerRect = content.getBoundingClientRect();
            const lineRect = lines[idx].getBoundingClientRect();
            const offset = lineRect.top - containerRect.top - containerRect.height / 3;
            content.scrollBy({ top: offset, behavior: 'smooth' });
        }
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function showSleepTimer() {
        const minutes = prompt('Sleep timer (minutes):', '30');
        if (minutes && parseInt(minutes) > 0) {
            PlayerEngine.setSleepTimer(parseInt(minutes));
        }
    }

    function shareTrack() {
        const track = PlayerEngine.currentTrack;
        if (!track) return;
        const text = `Listening to ${track.title || track.name} on Tamil AI Stream`;
        if (navigator.share) {
            navigator.share({ title: track.title || track.name, text });
        } else {
            navigator.clipboard?.writeText(text);
        }
    }

    function downloadTrack() {
        const track = PlayerEngine.currentTrack;
        if (track) PlaylistManager.addDownload(track);
    }

    /* ---- Helpers ---- */
    function formatTime(sec) {
        if (!sec || isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    /* ---- Init ---- */
    function init() {
        createMiniPlayer();
        createFullPlayer();
        startEqAnimation();

        PlayerEngine.on('trackChange', (state) => {
            updateMiniPlayer(state);
            updateFullPlayer(state);
            const artwork = state.currentTrack?.thumbnail || state.currentTrack?.cover || '';
            if (artwork) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = artwork;
                img.onload = async () => {
                    const colors = await PremiumEffects.extractColors(img);
                    document.getElementById('fpBg').style.background = colors.gradient;
                    document.getElementById('fpBg').style.filter = 'blur(40px)';
                };
            }
        });

        PlayerEngine.on('play', (state) => {
            updatePlayButton(true);
            updateFullPlayButton(true);
            updateEqBars(true);
        });

        PlayerEngine.on('pause', (state) => {
            updatePlayButton(false);
            updateFullPlayButton(false);
            updateEqBars(false);
        });

        PlayerEngine.on('stop', () => {
            updatePlayButton(false);
            updateFullPlayButton(false);
            updateEqBars(false);
        });

        PlayerEngine.on('timeupdate', ({ current, duration }) => {
            updateProgress(current, duration);
            updateFullProgress(current, duration);
        });

        // Register with ProgressSync for smooth 60fps updates from audioPlayer
        function _progressSyncCallback(cur, dur, pct) {
            if (isDragging) return;
            const bar = document.getElementById('miniProgressBar');
            const thumb = document.getElementById('miniProgressThumb');
            if (bar) bar.style.width = pct + '%';
            if (thumb) thumb.style.left = pct + '%';
            const curEl = document.getElementById('miniCurrentTime');
            const durEl = document.getElementById('miniDuration');
            if (curEl) curEl.textContent = formatTime(cur);
            if (durEl) durEl.textContent = formatTime(dur);
            const fpBar = document.getElementById('fpProgressBar');
            const fpThumb = document.getElementById('fpProgressThumb');
            if (fpBar) fpBar.style.width = pct + '%';
            if (fpThumb) fpThumb.style.left = pct + '%';
            const fpCur = document.getElementById('fpCurrentTime');
            const fpDur = document.getElementById('fpDuration');
            if (fpCur) fpCur.textContent = formatTime(cur);
            if (fpDur) fpDur.textContent = formatTime(dur);
        }
        if (typeof ProgressSync !== 'undefined') {
            ProgressSync.register(_progressSyncCallback);
        }

        function _syncPlayStateFromAudioPlayer(playing) {
            updatePlayButton(playing);
            updateFullPlayButton(playing);
            updateEqBars(playing);
        }
        function _hookAudioPlayer(ap) {
            ap.addEventListener('timeupdate', syncLyricsHighlight);
            ap.addEventListener('play', () => _syncPlayStateFromAudioPlayer(true));
            ap.addEventListener('pause', () => _syncPlayStateFromAudioPlayer(false));
            ap.addEventListener('playing', () => _syncPlayStateFromAudioPlayer(true));
            ap.addEventListener('ended', () => _syncPlayStateFromAudioPlayer(false));
        }
        if (typeof window.audioPlayer !== 'undefined' && window.audioPlayer) {
            _hookAudioPlayer(window.audioPlayer);
        } else {
            var _apWatcher = setInterval(function() {
                if (typeof window.audioPlayer !== 'undefined' && window.audioPlayer) {
                    _hookAudioPlayer(window.audioPlayer);
                    clearInterval(_apWatcher);
                }
            }, 500);
            setTimeout(function() { clearInterval(_apWatcher); }, 30000);
        }

        PlayerEngine.on('shuffle', (shuffle) => updateShuffleButton(shuffle));
        PlayerEngine.on('repeat', (repeat) => updateRepeatButton(repeat));
        PlayerEngine.on('queueChange', () => updateQueueList());
        PlayerEngine.on('volume', (vol) => {
            const range = document.getElementById('fpVolumeRange');
            if (range) range.value = vol * 100;
        });
    }

    return { init, toggleFullPlayer, toggleQueuePanel, toggleLyricsPanel, loadLyricsForCurrentTrack };
})();
