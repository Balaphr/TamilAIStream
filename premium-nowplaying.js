'use strict';
/* ============================================================
   PremiumNowPlaying — Now Playing Player + Audio Visualizer + FM Carousel
   Integrates with existing GlobalPlayer / script.js audio system
   ============================================================ */
window.PremiumNowPlaying = (() => {

    const $ = (id) => document.getElementById(id);

    /* ---- State ---- */
    let _audioEl = null;
    let _isPlaying = false;
    let _isLive = false;
    let _vizRAF = null;
    let _waveRAF = null;
    let _carouselPage = 0;
    let _carouselPages = 1;
    let _moreMenuOpen = false;

    /* ---- DOM refs ---- */
    let cardEl, artImgEl, artPlaceholderEl, liveBadgeEl;
    let stationEl, titleEl, artistEl;
    let progressWrapEl, progressBarEl, progressTimeEl, durationTimeEl;
    let playBtnEl, prevBtnEl, nextBtnEl, shuffleBtnEl, repeatBtnEl, favBtnEl;
    let volumeBtnEl, volumeSliderEl, moreBtnEl, moreMenuEl;
    let vizCanvasEl, waveCanvasEl;
    let fmTrackEl, fmDotsEl;

    /* ---- Helpers ---- */
    function fmt(s) {
        if (!s || !isFinite(s)) return '0:00';
        const m = Math.floor(s / 60), sec = Math.floor(s % 60);
        return m + ':' + String(sec).padStart(2, '0');
    }

    function getAudio() {
        if (_audioEl) return _audioEl;
        _audioEl = window.audioPlayer || null;
        return _audioEl;
    }

    function currentTrack() {
        try {
            if (window.currentPlaybackTrack) return window.currentPlaybackTrack;
            if (window.PlayerEngine && PlayerEngine.currentTrack) return PlayerEngine.currentTrack;
        } catch(e) {}
        return null;
    }

    function isFav(track) {
        if (!track) return false;
        try {
            const favs = JSON.parse(localStorage.getItem('tamilAIStream_favorites') || '[]');
            return favs.some(f => (f.id || f.songId) === (track.id || track.songId));
        } catch(e) { return false; }
    }

    /* ============================================================
       1. NOW PLAYING PLAYER
       ============================================================ */
    function initPlayer() {
        cardEl = $('premiumNpCard');
        if (!cardEl) return;
        artImgEl = $('premiumNpArtImg');
        artPlaceholderEl = $('premiumNpArtPlaceholder');
        liveBadgeEl = $('premiumNpLiveBadge');
        stationEl = $('premiumNpStation');
        titleEl = $('premiumNpTitle');
        artistEl = $('premiumNpArtist');
        progressWrapEl = $('premiumNpProgress');
        progressBarEl = $('premiumNpProgressBar');
        progressTimeEl = $('premiumNpCurrentTime');
        durationTimeEl = $('premiumNpDuration');
        playBtnEl = $('premiumNpPlayBtn');
        prevBtnEl = $('premiumNpPrevBtn');
        nextBtnEl = $('premiumNpNextBtn');
        shuffleBtnEl = $('premiumNpShuffleBtn');
        repeatBtnEl = $('premiumNpRepeatBtn');
        favBtnEl = $('premiumNpFavBtn');
        volumeBtnEl = $('premiumNpVolumeBtn');
        volumeSliderEl = $('premiumNpVolumeSlider');
        moreBtnEl = $('premiumNpMoreBtn');
        moreMenuEl = $('premiumNpMoreMenu');
        waveCanvasEl = $('premiumNpWaveform');

        bindPlayerEvents();
        syncPlayerUI();
        startProgressSync();
    }

    function bindPlayerEvents() {
        if (playBtnEl) playBtnEl.addEventListener('click', togglePlay);
        if (prevBtnEl) prevBtnEl.addEventListener('click', () => {
            try { if (typeof playPreviousTrack === 'function') playPreviousTrack(); } catch(e) {}
        });
        if (nextBtnEl) nextBtnEl.addEventListener('click', () => {
            try { if (typeof playNextTrack === 'function') playNextTrack(); } catch(e) {}
        });
        if (shuffleBtnEl) shuffleBtnEl.addEventListener('click', () => {
            try {
                if (typeof playbackShuffle !== 'undefined') {
                    window.playbackShuffle = !window.playbackShuffle;
                    shuffleBtnEl.classList.toggle('active', window.playbackShuffle);
                }
            } catch(e) {}
        });
        if (repeatBtnEl) repeatBtnEl.addEventListener('click', () => {
            try {
                const modes = ['off', 'all', 'one'];
                let idx = modes.indexOf(window.playbackRepeat || 'off');
                idx = (idx + 1) % modes.length;
                window.playbackRepeat = modes[idx];
                repeatBtnEl.classList.toggle('active', modes[idx] !== 'off');
                const icon = repeatBtnEl.querySelector('i');
                if (icon) {
                    icon.className = modes[idx] === 'one' ? 'fas fa-repeat' : 'fas fa-repeat';
                }
            } catch(e) {}
        });
        if (favBtnEl) favBtnEl.addEventListener('click', () => {
            const track = currentTrack();
            if (!track) return;
            try {
                if (typeof PlaylistManager !== 'undefined' && PlaylistManager.toggleFavorite) {
                    PlaylistManager.toggleFavorite(track);
                }
                syncFavUI();
            } catch(e) {}
        });
        if (volumeSliderEl) {
            volumeSliderEl.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                const ap = getAudio();
                if (ap) ap.volume = val;
                updateVolumeIcon(val);
            });
        }
        if (volumeBtnEl) volumeBtnEl.addEventListener('click', () => {
            const ap = getAudio();
            if (!ap) return;
            if (ap.volume > 0) {
                ap._prevVol = ap.volume;
                ap.volume = 0;
                if (volumeSliderEl) volumeSliderEl.value = 0;
                updateVolumeIcon(0);
            } else {
                const restore = ap._prevVol || 0.7;
                ap.volume = restore;
                if (volumeSliderEl) volumeSliderEl.value = restore;
                updateVolumeIcon(restore);
            }
        });
        if (moreBtnEl) moreBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            _moreMenuOpen = !_moreMenuOpen;
            if (moreMenuEl) moreMenuEl.classList.toggle('open', _moreMenuOpen);
        });
        if (moreMenuEl) {
            moreMenuEl.querySelectorAll('.premium-np-more-item').forEach(item => {
                item.addEventListener('click', () => {
                    _moreMenuOpen = false;
                    moreMenuEl.classList.remove('open');
                });
            });
        }
        document.addEventListener('click', () => {
            if (_moreMenuOpen && moreMenuEl) {
                _moreMenuOpen = false;
                moreMenuEl.classList.remove('open');
            }
        });
        if (progressWrapEl) {
            progressWrapEl.addEventListener('click', (e) => {
                const ap = getAudio();
                if (!ap || !ap.duration || !isFinite(ap.duration)) return;
                const rect = progressWrapEl.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                ap.currentTime = pct * ap.duration;
            });
        }
    }

    function togglePlay() {
        const ap = getAudio();
        if (!ap) return;
        if (ap.paused) {
            try { ap.play().catch(()=>{}); } catch(e) {}
        } else {
            ap.pause();
        }
    }

    function syncPlayerUI() {
        const track = currentTrack();
        const ap = getAudio();
        const isStation = !!(track && track.streamUrl && !track.audioUrl);

        _isLive = isStation || !!(window.currentStation);
        _isPlaying = ap && !ap.paused;

        // Card playing state
        if (cardEl) cardEl.classList.toggle('is-playing', _isPlaying);

        // Artwork
        const thumb = track ? (track.thumbnail || track.albumCover || track.cover || '') : '';
        if (artImgEl) {
            if (thumb) {
                artImgEl.src = thumb;
                artImgEl.style.display = 'block';
                if (artPlaceholderEl) artPlaceholderEl.style.display = 'none';
            } else {
                artImgEl.style.display = 'none';
                if (artPlaceholderEl) artPlaceholderEl.style.display = 'flex';
            }
        }

        // Live badge
        if (liveBadgeEl) liveBadgeEl.classList.toggle('visible', _isLive);

        // Station / track info
        if (stationEl) {
            if (_isLive && window.currentStation) {
                stationEl.textContent = window.currentStation;
                stationEl.style.display = 'flex';
            } else {
                stationEl.style.display = 'none';
            }
        }
        if (titleEl) titleEl.textContent = track ? (track.title || track.name || 'No Track') : 'No Track';
        if (artistEl) {
            if (_isLive) {
                artistEl.textContent = 'Live FM Stream';
            } else {
                artistEl.textContent = track ? (track.artist || 'Unknown Artist') : 'Select a station or song';
            }
        }

        // Play/pause icon
        if (playBtnEl) {
            const icon = playBtnEl.querySelector('i');
            if (icon) icon.className = _isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }

        // Progress
        if (ap && ap.duration && isFinite(ap.duration)) {
            const pct = (ap.currentTime / ap.duration) * 100;
            if (progressBarEl) progressBarEl.style.width = pct + '%';
            if (progressTimeEl) progressTimeEl.textContent = fmt(ap.currentTime);
            if (durationTimeEl) durationTimeEl.textContent = fmt(ap.duration);
        } else {
            if (progressBarEl) progressBarEl.style.width = '0%';
            if (progressTimeEl) progressTimeEl.textContent = '0:00';
            if (durationTimeEl) durationTimeEl.textContent = _isLive ? 'LIVE' : '0:00';
        }

        // Shuffle / Repeat
        if (shuffleBtnEl) shuffleBtnEl.classList.toggle('active', !!window.playbackShuffle);
        if (repeatBtnEl) repeatBtnEl.classList.toggle('active', (window.playbackRepeat || 'off') !== 'off');

        // Volume
        if (volumeSliderEl && ap) volumeSliderEl.value = ap.volume;
        updateVolumeIcon(ap ? ap.volume : 0.7);

        syncFavUI();
    }

    function syncFavUI() {
        const track = currentTrack();
        if (favBtnEl) {
            const fav = isFav(track);
            const icon = favBtnEl.querySelector('i');
            if (icon) icon.className = fav ? 'fas fa-heart' : 'far fa-heart';
            favBtnEl.classList.toggle('active', fav);
        }
    }

    function updateVolumeIcon(vol) {
        if (!volumeBtnEl) return;
        const icon = volumeBtnEl.querySelector('i');
        if (!icon) return;
        if (vol === 0) icon.className = 'fas fa-volume-xmark';
        else if (vol < 0.5) icon.className = 'fas fa-volume-low';
        else icon.className = 'fas fa-volume-high';
    }

    let _progressRAF = null;
    function startProgressSync() {
        function tick() {
            const ap = getAudio();
            if (ap && !ap.paused && ap.duration && isFinite(ap.duration)) {
                const pct = (ap.currentTime / ap.duration) * 100;
                if (progressBarEl) progressBarEl.style.width = pct + '%';
                if (progressTimeEl) progressTimeEl.textContent = fmt(ap.currentTime);
                if (durationTimeEl) durationTimeEl.textContent = fmt(ap.duration);
            } else if (ap && _isLive) {
                if (progressBarEl) progressBarEl.style.width = '100%';
                if (progressTimeEl) progressTimeEl.textContent = '';
                if (durationTimeEl) durationTimeEl.textContent = 'LIVE';
            }
            _progressRAF = requestAnimationFrame(tick);
        }
        _progressRAF = requestAnimationFrame(tick);
    }

    /* ============================================================
       2. AUDIO VISUALIZER (Circular Ring Style)
       ============================================================ */
    function initVisualizer() {
        vizCanvasEl = $('premiumVizCanvas');
        if (!vizCanvasEl) return;
        const ctx = vizCanvasEl.getContext('2d');
        resizeVizCanvas(vizCanvasEl);
        window.addEventListener('resize', () => resizeVizCanvas(vizCanvasEl));
        drawVisualizer(ctx, vizCanvasEl);
    }

    function resizeVizCanvas(canvas) {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = rect.width * dpr;
        canvas.height = 120 * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = '120px';
    }

    function drawVisualizer(ctx, canvas) {
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        const ap = getAudio();
        const playing = ap && !ap.paused;
        const time = performance.now() / 1000;

        ctx.clearRect(0, 0, w, h);

        // Generate fake frequency data for visual effect (since Web Audio API is intentionally disabled)
        const bars = 48;
        const data = [];
        for (let i = 0; i < bars; i++) {
            if (playing) {
                const base = Math.sin(time * 2 + i * 0.3) * 0.3 + 0.5;
                const harmonic = Math.sin(time * 3.7 + i * 0.5) * 0.2;
                const beat = Math.sin(time * 1.2) * 0.15;
                data.push(Math.max(0.08, Math.min(1, base + harmonic + beat + Math.random() * 0.08)));
            } else {
                data.push(0.05 + Math.sin(time * 0.5 + i * 0.2) * 0.03);
            }
        }

        // Draw circular ring visualizer
        const maxRadius = Math.min(cx, cy) * 0.85;
        const minRadius = maxRadius * 0.45;

        for (let i = 0; i < bars; i++) {
            const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
            const val = data[i];
            const barLen = (maxRadius - minRadius) * val;
            const x1 = cx + Math.cos(angle) * minRadius;
            const y1 = cy + Math.sin(angle) * minRadius;
            const x2 = cx + Math.cos(angle) * (minRadius + barLen);
            const y2 = cy + Math.sin(angle) * (minRadius + barLen);

            const hue = 180 + (i / bars) * 120; // cyan -> blue -> purple
            const alpha = playing ? 0.3 + val * 0.5 : 0.08 + val * 0.1;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${alpha})`;
            ctx.lineWidth = Math.max(2, (w / bars) * 0.35);
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Inner glow ring
        const glowRadius = minRadius * 0.85;
        const gradient = ctx.createRadialGradient(cx, cy, glowRadius * 0.3, cx, cy, glowRadius);
        if (playing) {
            gradient.addColorStop(0, 'rgba(34,211,238,0.06)');
            gradient.addColorStop(0.5, 'rgba(59,130,246,0.03)');
            gradient.addColorStop(1, 'transparent');
        } else {
            gradient.addColorStop(0, 'rgba(34,211,238,0.02)');
            gradient.addColorStop(1, 'transparent');
        }
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Outer subtle ring
        ctx.beginPath();
        ctx.arc(cx, cy, maxRadius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = playing ? 'rgba(34,211,238,0.06)' : 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 1;
        ctx.stroke();

        _vizRAF = requestAnimationFrame(() => drawVisualizer(ctx, canvas));
    }

    /* ============================================================
       2b. WAVEFORM (below player artwork/controls)
       ============================================================ */
    function initWaveform() {
        waveCanvasEl = $('premiumNpWaveform');
        if (!waveCanvasEl) return;
        const ctx = waveCanvasEl.getContext('2d');
        resizeWaveCanvas(waveCanvasEl);
        window.addEventListener('resize', () => resizeWaveCanvas(waveCanvasEl));
        drawWaveform(ctx, waveCanvasEl);
    }

    function resizeWaveCanvas(canvas) {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = rect.width * dpr;
        canvas.height = 36 * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = '36px';
    }

    function drawWaveform(ctx, canvas) {
        const w = canvas.width, h = canvas.height;
        const ap = getAudio();
        const playing = ap && !ap.paused;
        const time = performance.now() / 1000;

        ctx.clearRect(0, 0, w, h);

        const points = 100;
        const midY = h / 2;

        // Draw smooth waveform
        ctx.beginPath();
        ctx.moveTo(0, midY);
        for (let i = 0; i <= points; i++) {
            const x = (i / points) * w;
            let amp;
            if (playing) {
                amp = Math.sin(time * 3 + i * 0.15) * 8
                    + Math.sin(time * 5.3 + i * 0.08) * 4
                    + Math.sin(time * 1.7 + i * 0.22) * 6;
                amp *= 0.5 + Math.sin(time * 0.8 + i * 0.05) * 0.3;
            } else {
                amp = Math.sin(time * 0.4 + i * 0.08) * 1.5;
            }
            ctx.lineTo(x, midY + amp);
        }
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, playing ? 'rgba(34,211,238,0.6)' : 'rgba(34,211,238,0.12)');
        grad.addColorStop(0.5, playing ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.12)');
        grad.addColorStop(1, playing ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.12)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Mirror wave
        ctx.beginPath();
        ctx.moveTo(0, midY);
        for (let i = 0; i <= points; i++) {
            const x = (i / points) * w;
            let amp;
            if (playing) {
                amp = Math.sin(time * 3 + i * 0.15 + 1) * 6
                    + Math.sin(time * 5.3 + i * 0.08 + 2) * 3
                    + Math.sin(time * 1.7 + i * 0.22 + 0.5) * 5;
                amp *= 0.4 + Math.sin(time * 0.8 + i * 0.05 + 1) * 0.25;
            } else {
                amp = Math.sin(time * 0.4 + i * 0.08 + 1) * 1;
            }
            ctx.lineTo(x, midY - amp);
        }
        ctx.strokeStyle = playing ? 'rgba(34,211,238,0.25)' : 'rgba(34,211,238,0.06)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        _waveRAF = requestAnimationFrame(() => drawWaveform(ctx, canvas));
    }

    /* ============================================================
       3. FM STATIONS CAROUSEL
       ============================================================ */
    function initCarousel() {
        fmTrackEl = $('premiumFmTrack');
        fmDotsEl = $('premiumFmDots');
        if (!fmTrackEl) return;
        renderCarousel();
    }

    function renderCarousel() {
        let stations = [];
        try {
            stations = (window.DataStore ? DataStore.getStations() : [])
                .filter(s => s && s.status === 'active');
        } catch(e) {}

        if (!stations.length) {
            if (fmTrackEl) fmTrackEl.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,0.3);font-size:0.85rem;">No stations available. Add stations from the Website Builder.</div>';
            return;
        }

        const playingStation = window.currentStation || '';

        fmTrackEl.innerHTML = stations.map((s, i) => {
            const name = escapeHtml(s.name || 'Station');
            const genre = escapeHtml(s.genre || s.category || 'Tamil FM');
            const thumb = s.thumbnail || s.cover || '';
            const isActive = s.name === playingStation;
            return `
                <div class="premium-fm-card${isActive ? ' active' : ''}" data-station-name="${name}" data-station-id="${escapeHtml(s.id || '')}" onclick="PremiumNowPlaying.playStationFromCarousel(this)">
                    <div class="premium-fm-card-art">
                        ${thumb
                            ? `<img src="${thumb}" alt="${name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                            : ''}
                        <div class="premium-fm-card-logo-placeholder" ${thumb ? 'style="display:none"' : ''}>
                            <i class="fas fa-tower-broadcast"></i>
                        </div>
                        <div class="premium-fm-card-live">LIVE</div>
                        <div class="premium-fm-card-eq">
                            <span></span><span></span><span></span><span></span>
                        </div>
                    </div>
                    <div class="premium-fm-card-info">
                        <div class="premium-fm-card-name">${name}</div>
                        <div class="premium-fm-card-meta">
                            <span class="premium-fm-card-category">${genre}</span>
                            <i class="fas fa-volume-high premium-fm-card-speaker"></i>
                        </div>
                    </div>
                </div>`;
        }).join('');

        updateCarouselDots();
        bindCarouselScroll();
    }

    function updateCarouselDots() {
        if (!fmDotsEl || !fmTrackEl) return;
        const cardWidth = 216; // 200 + 16 gap
        const visibleWidth = fmTrackEl.clientWidth;
        const totalWidth = fmTrackEl.scrollWidth;
        _carouselPages = Math.max(1, Math.ceil(totalWidth / visibleWidth));
        _carouselPage = Math.round(fmTrackEl.scrollLeft / visibleWidth);

        fmDotsEl.innerHTML = '';
        for (let i = 0; i < _carouselPages; i++) {
            const dot = document.createElement('button');
            dot.className = 'premium-fm-dot' + (i === _carouselPage ? ' active' : '');
            dot.addEventListener('click', () => {
                fmTrackEl.scrollTo({ left: i * visibleWidth, behavior: 'smooth' });
            });
            fmDotsEl.appendChild(dot);
        }
    }

    function bindCarouselScroll() {
        if (!fmTrackEl) return;
        let scrollTimer;
        fmTrackEl.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(updateCarouselDots, 100);
        }, { passive: true });
    }

    function playStationFromCarousel(cardEl) {
        const name = cardEl.getAttribute('data-station-name');
        const id = cardEl.getAttribute('data-station-id');
        if (!name) return;

        // Update active state
        fmTrackEl.querySelectorAll('.premium-fm-card').forEach(c => c.classList.remove('active'));
        cardEl.classList.add('active');

        // Use existing playStation function
        try {
            if (typeof playStation === 'function') {
                playStation(name, id);
            }
        } catch(e) {}

        // Sync UI after short delay
        setTimeout(syncPlayerUI, 300);
    }

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        // Wait for DOM and audio player
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(_initAll, 100);
            });
        } else {
            setTimeout(_initAll, 100);
        }
    }

    function _initAll() {
        initPlayer();
        initVisualizer();
        initWaveform();
        initCarousel();

        // Listen for audio state changes
        const ap = getAudio();
        if (ap) {
            ap.addEventListener('play', () => { _isPlaying = true; syncPlayerUI(); updateActiveStationCards(); });
            ap.addEventListener('pause', () => { _isPlaying = false; syncPlayerUI(); updateActiveStationCards(); });
            ap.addEventListener('ended', () => { _isPlaying = false; syncPlayerUI(); updateActiveStationCards(); });
            ap.addEventListener('timeupdate', () => { /* progress handled by RAF */ });
            ap.addEventListener('loadedmetadata', () => syncPlayerUI());
        }

        // Also hook into existing event system
        window.addEventListener('storage', (e) => {
            if (e.key === 'tamilAIStream_player_state') {
                setTimeout(syncPlayerUI, 50);
            }
        });

        // Periodic sync to catch all changes
        setInterval(() => {
            syncPlayerUI();
            updateActiveStationCards();
        }, 1000);
    }

    function updateActiveStationCards() {
        const playingStation = window.currentStation || '';
        const cards = document.querySelectorAll('.premium-fm-card');
        cards.forEach(c => {
            const name = c.getAttribute('data-station-name');
            c.classList.toggle('active', name === playingStation);
        });
    }

    /* Cleanup */
    function destroy() {
        if (_vizRAF) cancelAnimationFrame(_vizRAF);
        if (_waveRAF) cancelAnimationFrame(_waveRAF);
        if (_progressRAF) cancelAnimationFrame(_progressRAF);
    }

    return {
        init,
        destroy,
        playStationFromCarousel,
        syncPlayerUI
    };
})();
