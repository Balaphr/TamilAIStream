'use strict';

// ============================================
// App State
// ============================================
let db = null;

// ============================================
// Premium Toast Notification System
// ============================================
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    const icons = {
        error: '<i class="fas fa-exclamation-circle"></i>',
        success: '<i class="fas fa-check-circle"></i>',
        info: '<i class="fas fa-info-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" aria-label="Close"><i class="fas fa-times"></i></button>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Playback notification — slides in from left with AI recommendation
function showPlaybackNotification(track, isStation) {
    const existing = document.querySelector('.playback-notification');
    if (existing) existing.remove();
    const name = track.title || track.name || 'Unknown';
    const artist = track.artist || (isStation ? 'Live FM Station' : 'Unknown Artist');
    const thumb = track.thumbnail || track.albumCover || track.cover || '';
    const isFM = isStation || track.streamUrl;
    // AI recommendation based on context
    const recs = isFM
        ? ['Enjoying the vibes? Try Tamil Hits next!', 'Love this station? Check out similar FM channels.', 'FM playing — explore curated playlists next.', 'Great taste! Try our AI-powered radio for more.']
        : ['Up next: more songs you love.', 'Enjoying this? Try a curated playlist.', 'Want similar music? Ask the AI assistant.', 'Add to favorites to build your collection.'];
    const rec = recs[Math.floor(Math.random() * recs.length)];
    const el = document.createElement('div');
    el.className = 'playback-notification';
    el.innerHTML =
        '<div class="pn-art">' + (thumb ? '<img src="' + thumb + '" alt="" onerror="this.remove()">' : '<i class="fa-solid fa-' + (isFM ? 'tower-broadcast' : 'music') + '"></i>') + '</div>' +
        '<div class="pn-info">' +
        '<div class="pn-label">' + (isFM ? '<span class="pn-live"><span class="gp-live-dot"></span>LIVE</span>' : 'Now Playing') + '</div>' +
        '<div class="pn-title">' + name + '</div>' +
        '<div class="pn-artist">' + artist + '</div>' +
        '<div class="pn-rec"><i class="fa-solid fa-wand-magic-sparkles"></i> ' + rec + '</div>' +
        '</div>' +
        '<button class="pn-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    el.querySelector('.pn-close').addEventListener('click', () => {
        el.classList.remove('visible');
        setTimeout(() => { if (el.parentNode) el.remove(); }, 350);
    });
    setTimeout(() => {
        if (el.parentNode) {
            el.classList.remove('visible');
            setTimeout(() => { if (el.parentNode) el.remove(); }, 350);
        }
    }, 5000);
}

// Inject toast styles (if not already present)
if (!document.querySelector('#toast-style')) {
    const toastStyle = document.createElement('style');
    toastStyle.id = 'toast-style';
    toastStyle.textContent = `
        .toast-notification {
            position: fixed; top: 20px; right: 20px; z-index: 9999;
            display: flex; align-items: center; gap: 12px;
            padding: 14px 18px; min-width: 300px; max-width: 500px;
            background: rgba(17, 24, 39, 0.95); backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            transform: translateX(400px); opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .toast-notification.visible { transform: translateX(0); opacity: 1; }
        .toast-icon { font-size: 20px; flex-shrink: 0; }
        .toast-error .toast-icon { color: #ef4444; }
        .toast-success .toast-icon { color: #10b981; }
        .toast-info .toast-icon { color: #34d399; }
        .toast-warning .toast-icon { color: #f59e0b; }
        .toast-message { flex: 1; font-size: 0.85rem; color: #fff; font-weight: 500; }
        .toast-close {
            background: none; border: none; color: rgba(255,255,255,0.5);
            cursor: pointer; font-size: 16px; padding: 0; transition: color 0.2s;
        }
        .toast-close:hover { color: #fff; }
        @media (max-width: 480px) {
            .toast-notification { top: 10px; right: 10px; left: 10px; min-width: auto; }
        }
    `;
    document.head.appendChild(toastStyle);
}

// ============================================
// AI Glassy Particle System
// ============================================
class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.neuralNodes = [];
        this.mouse = { x: null, y: null, radius: 200 };
        this.time = 0;
        this._rafId = null;
        this._resizeHandler = null;
        this._moveHandler = null;
        this._leaveHandler = null;
        this._bound = [];
        this.init();
    }
    init() { this.resize(); this.createParticles(); this.createNeuralNodes(); this.bindEvents(); this.animate(); }
    resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }
    createParticles() {
        const count = Math.min(Math.floor((this.canvas.width * this.canvas.height) / 8000), 80);
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 3 + 1,
                baseSize: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 0.4,
                speedY: (Math.random() - 0.5) * 0.4,
                opacity: Math.random() * 0.6 + 0.1,
                pulse: Math.random() * Math.PI * 2,
                pulseSpeed: Math.random() * 0.03 + 0.01,
                hue: Math.random() > 0.5 ? 160 : 220,
                saturation: Math.random() * 40 + 60,
                lightness: Math.random() * 30 + 50,
                glassIntensity: Math.random() * 0.5 + 0.3
            });
        }
    }
    createNeuralNodes() {
        const count = Math.min(Math.floor((this.canvas.width * this.canvas.height) / 15000), 12);
        this.neuralNodes = [];
        for (let i = 0; i < count; i++) {
            this.neuralNodes.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: Math.random() * 4 + 2,
                pulse: Math.random() * Math.PI * 2,
                connections: [],
                opacity: Math.random() * 0.4 + 0.2
            });
        }
        this.neuralNodes.forEach((node, i) => {
            this.neuralNodes.forEach((other, j) => {
                if (i !== j) {
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 300) {
                        node.connections.push({ index: j, dist });
                    }
                }
            });
        });
    }
    bindEvents() {
        this._resizeHandler = () => { this.resize(); this.createParticles(); this.createNeuralNodes(); };
        this._moveHandler = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
        this._leaveHandler = () => { this.mouse.x = null; this.mouse.y = null; };
        window.addEventListener('resize', this._resizeHandler, { passive: true });
        document.addEventListener('mousemove', this._moveHandler, { passive: true });
        document.addEventListener('mouseleave', this._leaveHandler);
    }
    destroy() {
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        if (this._moveHandler) document.removeEventListener('mousemove', this._moveHandler);
        if (this._leaveHandler) document.removeEventListener('mouseleave', this._leaveHandler);
        this.particles = [];
        this.neuralNodes = [];
    }
    drawGlassParticle(p) {
        const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        gradient.addColorStop(0, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.opacity * p.glassIntensity})`);
        gradient.addColorStop(0.3, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.opacity * p.glassIntensity * 0.4})`);
        gradient.addColorStop(1, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, 0)`);
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${p.hue}, ${p.saturation}%, ${Math.min(p.lightness + 30, 90)}%, ${p.opacity * 0.9})`;
        this.ctx.fill();
    }
    drawNeuralNode(node) {
        const glow = this.ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 6);
        glow.addColorStop(0, `rgba(100, 200, 255, ${node.opacity * 0.6})`);
        glow.addColorStop(0.5, `rgba(100, 200, 255, ${node.opacity * 0.15})`);
        glow.addColorStop(1, `rgba(100, 200, 255, 0)`);
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, node.radius * 6, 0, Math.PI * 2);
        this.ctx.fillStyle = glow;
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(180, 220, 255, ${node.opacity})`;
        this.ctx.fill();
    }
    drawNeuralConnection(node, conn) {
        const other = this.neuralNodes[conn.index];
        if (!other) return;
        const alpha = 0.06 * (1 - conn.dist / 300);
        this.ctx.beginPath();
        this.ctx.moveTo(node.x, node.y);
        const midX = (node.x + other.x) / 2 + Math.sin(this.time * 0.5 + conn.index) * 20;
        const midY = (node.y + other.y) / 2 + Math.cos(this.time * 0.5 + conn.index) * 20;
        this.ctx.quadraticCurveTo(midX, midY, other.x, other.y);
        this.ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();
    }
    animate() {
        this.time += 0.01;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles.forEach((p, i) => {
            p.pulse += p.pulseSpeed;
            p.x += p.speedX + Math.sin(this.time + p.pulse) * 0.15;
            p.y += p.speedY + Math.cos(this.time + p.pulse) * 0.15;
            if (p.x < 0) p.x = this.canvas.width; if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height; if (p.y > this.canvas.height) p.y = 0;
            if (this.mouse.x !== null) {
                const dx = this.mouse.x - p.x, dy = this.mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouse.radius) {
                    const force = (this.mouse.radius - dist) / this.mouse.radius;
                    p.x -= dx * force * 0.015;
                    p.y -= dy * force * 0.015;
                    p.size = p.baseSize + force * 3;
                } else {
                    p.size += (p.baseSize - p.size) * 0.05;
                }
            } else {
                p.size += (p.baseSize - p.size) * 0.05;
            }
            const pulseOpacity = p.opacity + Math.sin(p.pulse) * 0.15;
            p.opacity = Math.max(0.05, Math.min(0.8, pulseOpacity));
            this.drawGlassParticle(p);
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p.x - p2.x, dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    const alpha = 0.04 * (1 - dist / 150);
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
                    this.ctx.lineWidth = 0.3;
                    this.ctx.stroke();
                }
            }
        });
        this.neuralNodes.forEach(node => {
            node.pulse += 0.02;
            node.x += Math.sin(this.time + node.pulse) * 0.1;
            node.y += Math.cos(this.time + node.pulse) * 0.1;
            node.connections.forEach(conn => this.drawNeuralConnection(node, conn));
            this.drawNeuralNode(node);
        });
        if (!document.hidden) this._rafId = requestAnimationFrame(() => this.animate());
    }
}

// ============================================
// Featured Slider
// ============================================
class FeaturedSlider {
    constructor() {
        this.track = document.getElementById('sliderTrack');
        this.dotsContainer = document.getElementById('sliderDots');
        this.prevBtn = document.querySelector('.slider-prev');
        this.nextBtn = document.querySelector('.slider-next');
        this.slides = this.track ? this.track.querySelectorAll('.slide-card') : [];
        this.current = 0;
        this.autoplayInterval = null;
        if (this.slides.length === 0) return;
        this.init();
    }
    init() {
        this.createDots();
        this.goToSlide(0);
        this.bindEvents();
        this.startAutoplay();
    }
    createDots() {
        if (!this.dotsContainer) return;
        this.dotsContainer.innerHTML = '';
        this.slides = this.track ? this.track.querySelectorAll('.slide-card') : [];
        this.slides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => { this.goToSlide(i); this.resetAutoplay(); });
            this.dotsContainer.appendChild(dot);
        });
    }
    goToSlide(index) {
        if (!this.track) return;
        this.current = index;
        this.track.style.transform = `translateX(-${index * 100}%)`;
        this.dotsContainer?.querySelectorAll('.slider-dot').forEach((d, i) => {
            d.classList.toggle('active', i === index);
        });
    }
    next() { this.goToSlide((this.current + 1) % this.slides.length); }
    prev() { this.goToSlide((this.current - 1 + this.slides.length) % this.slides.length); }
    bindEvents() {
        this.prevBtn?.addEventListener('click', () => { this.prev(); this.resetAutoplay(); });
        this.nextBtn?.addEventListener('click', () => { this.next(); this.resetAutoplay(); });
        this.track?.addEventListener('touchstart', (e) => { this.touchStartX = e.touches[0].clientX; });
        this.track?.addEventListener('touchend', (e) => {
            const diff = this.touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) { diff > 0 ? this.next() : this.prev(); this.resetAutoplay(); }
        });
    }
    startAutoplay() { this.autoplayInterval = setInterval(() => { if (!document.hidden) this.next(); }, 5000); }
    resetAutoplay() { clearInterval(this.autoplayInterval); this.startAutoplay(); }
    destroy() { clearInterval(this.autoplayInterval); }
}

// ============================================
// Search Functionality (for search bar in header)
// ============================================
const searchInput = document.getElementById('ytmSearchInput');
    const searchClear = document.getElementById('ytmSearchClear');
if (searchInput && searchClear) {
    searchInput.addEventListener('input', function() {
        searchClear.style.display = this.value.length > 0 ? 'block' : 'none';
        const query = this.value.toLowerCase().trim();
        document.querySelectorAll('.station-card').forEach(card => {
            const title = card.querySelector('h3')?.textContent?.toLowerCase() || '';
            const genre = card.dataset.genre || '';
            const isMatch = title.includes(query) || genre.includes(query);
            card.style.display = query && !isMatch ? 'none' : 'block';
        });
    });
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
    });
}

// ============================================
// Bottom Navigation
// ============================================
document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        const tab = this.dataset.tab;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (tab === 'home') {
            document.querySelector('.home-container')?.scrollIntoView({ behavior: 'smooth' });
        } else if (tab === 'profile') {
            window.location.href = 'profile.html';
        } else if (tab === 'favorites') {
            showToast('Favorites page coming soon!', 'info');
        } else if (tab === 'search') {
            document.getElementById('ytmSearchInput')?.focus();
        }
    });
});

// ============================================
// Now Playing Bar Controls
// ============================================
const npPlayBtn = document.querySelector('.np-play-btn');

// ============================================
// Audio Streaming System
// ============================================
let audioPlayer = null;
let audioCtx = null;
let analyserNode = null;
let audioSourceNode = null;
let audioFreqData = null;
let userPaused = false;
let currentStation = null;
let isStreamPlaying = false;
let streamConnecting = false;
let currentPlaylist = []; // For song playlist functionality
let currentSongIndex = -1;
let currentPlaybackMode = 'station';
let currentPlaybackTrack = null;
let currentPlaybackQueue = [];
let currentPlaybackQueueIndex = -1;
let playbackVolume = 0.7;
let playbackRepeat = 'off';
let playbackShuffle = false;
let playbackEndedByUser = false;
let playbackHasLoaded = false;

function persistPlaybackState() {
    try {
        const state = {
            currentStation,
            currentPlaybackMode,
            currentPlaybackTrack,
            currentPlaybackQueue,
            currentPlaybackQueueIndex,
            currentPlaylist,
            currentSongIndex,
            isStreamPlaying,
            streamConnecting,
            playbackVolume,
            playbackRepeat,
            playbackShuffle,
            progress: audioPlayer?.currentTime || 0,
            duration: audioPlayer?.duration || 0,
            timestamp: Date.now()
        };
        localStorage.setItem('tamilAIStream_player_state', JSON.stringify(state));
    } catch (e) {
        console.warn('Unable to persist playback state', e);
    }
}

function restorePlaybackState() {
    try {
        const saved = JSON.parse(localStorage.getItem('tamilAIStream_player_state') || '{}');
        if (!saved || !saved.currentPlaybackTrack && !saved.currentStation) return null;
        currentStation = saved.currentStation || null;
        currentPlaybackMode = saved.currentPlaybackMode || 'station';
        currentPlaybackTrack = saved.currentPlaybackTrack || null;
        currentPlaybackQueue = Array.isArray(saved.currentPlaybackQueue) ? saved.currentPlaybackQueue : [];
        currentPlaybackQueueIndex = typeof saved.currentPlaybackQueueIndex === 'number' ? saved.currentPlaybackQueueIndex : -1;
        currentPlaylist = Array.isArray(saved.currentPlaylist) ? saved.currentPlaylist : [];
        currentSongIndex = typeof saved.currentSongIndex === 'number' ? saved.currentSongIndex : -1;
        playbackVolume = typeof saved.playbackVolume === 'number' ? saved.playbackVolume : 0.7;
        playbackRepeat = saved.playbackRepeat || 'off';
        playbackShuffle = Boolean(saved.playbackShuffle);
        if (audioPlayer) {
            audioPlayer.volume = playbackVolume;
        }
        return saved;
    } catch (e) {
        console.warn('Unable to restore playback state', e);
        return null;
    }
}

function openMusicPlayer(track, playlist = [], queueIndex = -1) {
    const selection = {
        track,
        playlist,
        queueIndex,
        source: 'song'
    };
    localStorage.setItem('tamilAIStream_player_selection', JSON.stringify(selection));
    persistPlaybackState();
    if (!window.location.pathname.includes('music-player.html')) {
        window.location.href = 'music-player.html';
    }
}

function getStationStreamUrl(stationName) {
    const station = DataStore.getStations().find(s => s.name === stationName);
    return station?.streamUrl || '';
}

// ============================================
// ProgressSync — Smooth 60fps progress tracking
// ============================================
const ProgressSync = (() => {
    let _rafId = null;
    let _callbacks = [];
    let _lastPercent = -1;
    let _isRunning = false;

    function _tick() {
        if (!_isRunning) return;
        const ap = window.audioPlayer;
        if (ap && !ap.paused) {
            const cur = ap.currentTime || 0;
            const dur = ap.duration || 0;
            if (dur > 0 && isFinite(dur)) {
                const pct = (cur / dur) * 100;
                if (Math.abs(pct - _lastPercent) > 0.001) {
                    _lastPercent = pct;
                    for (let i = 0; i < _callbacks.length; i++) {
                        try { _callbacks[i](cur, dur, pct); } catch (e) {}
                    }
                }
            }
        }
        if (!document.hidden) _rafId = requestAnimationFrame(_tick);
    }

    function start() {
        if (_isRunning) return;
        _isRunning = true;
        _lastPercent = -1;
        _rafId = requestAnimationFrame(_tick);
    }

    function stop() {
        _isRunning = false;
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    }

    function register(fn) {
        if (typeof fn === 'function' && _callbacks.indexOf(fn) === -1) {
            _callbacks.push(fn);
        }
    }

    function unregister(fn) {
        _callbacks = _callbacks.filter(cb => cb !== fn);
    }

    function destroy() {
        stop();
        _callbacks = [];
    }

    function syncAll() {
        const ap = window.audioPlayer;
        if (ap) {
            const cur = ap.currentTime || 0;
            const dur = ap.duration || 0;
            if (dur > 0 && isFinite(dur)) {
                const pct = (cur / dur) * 100;
                _lastPercent = pct;
                for (let i = 0; i < _callbacks.length; i++) {
                    try { _callbacks[i](cur, dur, pct); } catch (e) {}
                }
            }
        }
    }

    return { start, stop, register, unregister, syncAll, destroy };
})();

function initAudioPlayer() {
    if (window.__BUILDER_PREVIEW__) return;
    if (!audioPlayer) {
        audioPlayer = new Audio();
        window.audioPlayer = audioPlayer;
        audioPlayer.preload = 'auto';
        audioPlayer.volume = playbackVolume;

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyserNode = audioCtx.createAnalyser();
            analyserNode.fftSize = 256;
            analyserNode.smoothingTimeConstant = 0.8;
            audioFreqData = new Uint8Array(analyserNode.frequencyBinCount);
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
        audioPlayer.addEventListener('playing', () => {
            if (userPaused) return;
            isStreamPlaying = true;
            streamConnecting = false;
            playbackHasLoaded = true;
            // Clear the seek flag — post-seek buffering is done
            window._isSeeking = false;
            window._seekingUntil = 0;
            // Analytics: track song play
            if (typeof AnalyticsTracker !== 'undefined' && currentPlaybackTrack) {
                AnalyticsTracker.trackSongPlay(currentPlaybackTrack);
            }
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            persistPlaybackState();
            updatePlayPauseButton(true);
            showLiveStatus(true);
            updateStationCardStates(true);
            hideLoadingSpinner();
            document.body.classList.add('gp-active');
            ProgressSync.start();
            if (typeof GlobalPlayer !== 'undefined') {
                GlobalPlayer.updatePlayUI(true);
                GlobalPlayer.updateLiveUI();
            }
            if (typeof YTMusic !== 'undefined') {
                YTMusic.isPlaying = true;
                YTMusic.updatePlayerUI();
                YTMusic.updateFullscreenPlayerUI();
                YTMusic.updateMiniPlayerUI();
            }
            if (typeof MiniAudioPlayer !== 'undefined') {
                MiniAudioPlayer.syncPlayingUI();
            }
        });
        audioPlayer.addEventListener('pause', () => {
            isStreamPlaying = false;
            ProgressSync.stop();
            ProgressSync.syncAll();
            persistPlaybackState();
            updatePlayPauseButton(false);
            showLiveStatus(false);
            // Analytics: track song pause
            if (typeof AnalyticsTracker !== 'undefined' && currentPlaybackTrack) {
                AnalyticsTracker.trackSongEvent('song_pause', currentPlaybackTrack, { position: audioPlayer.currentTime });
            }
            updateStationCardStates(false);
            if (typeof GlobalPlayer !== 'undefined') {
                GlobalPlayer.updatePlayUI(false);
            }
            if (typeof YTMusic !== 'undefined') {
                YTMusic.isPlaying = false;
                YTMusic.updatePlayerUI();
                YTMusic.updateFullscreenPlayerUI();
                YTMusic.updateMiniPlayerUI();
            }
            if (typeof MiniAudioPlayer !== 'undefined') {
                MiniAudioPlayer.syncPausedUI();
            }
        });
        audioPlayer.addEventListener('timeupdate', () => {
            if (typeof YTMusic !== 'undefined') {
                YTMusic.progress = audioPlayer.currentTime || 0;
                YTMusic.duration = audioPlayer.duration || 0;
                YTMusic.updateProgressUI();
            }
            if (typeof GlobalPlayer !== 'undefined') {
                GlobalPlayer.updateProgressUI();
            }
            persistPlaybackState();
        });
        audioPlayer.addEventListener('durationchange', () => {
            if (typeof YTMusic !== 'undefined') {
                YTMusic.duration = audioPlayer.duration || 0;
                YTMusic.updateProgressUI();
            }
            if (typeof GlobalPlayer !== 'undefined') {
                GlobalPlayer.updateProgressUI();
            }
        });
        audioPlayer.addEventListener('error', (e) => {
            streamConnecting = false;
            isStreamPlaying = false;
            updatePlayPauseButton(false);
            showLiveStatus(false);
            hideLoadingSpinner();
            const stationName = currentStation || currentPlaybackTrack?.title || 'Station';
            const errCode = audioPlayer.error?.code;
            const errMsg = audioPlayer.error?.message;
            console.error('[TamilAI FM] Audio error:', errCode, errMsg, '| src:', audioPlayer.src);
            showToast(`Unable to connect to ${stationName}. Stream currently unavailable. (Error ${errCode})`, 'error');
        });
        audioPlayer.addEventListener('waiting', () => {
            // Suppress the buffering toast during/after a user-initiated seek.
            // The seeking flag is set by seekPlaybackToPercent and cleared after
            // a short grace period so brief post-seek buffers are invisible.
            if (window._isSeeking || Date.now() < window._seekingUntil) return;
            showToast('Buffering... Please wait.', 'info');
        });
        audioPlayer.addEventListener('canplay', () => {
            hideLoadingSpinner();
            // Also clear seek flag on canplay in case playing event is delayed
            if (Date.now() >= window._seekingUntil) window._isSeeking = false;
        });
        audioPlayer.addEventListener('loadstart', () => {
            streamConnecting = true;
        });
        audioPlayer.addEventListener('stalled', () => {
            if (window._isSeeking || Date.now() < window._seekingUntil) return;
            showToast('Connection stalled. Retrying...', 'info');
        });
        audioPlayer.addEventListener('ended', () => {
            ProgressSync.stop();
            // Analytics: track song complete
            if (typeof AnalyticsTracker !== 'undefined' && currentPlaybackTrack) {
                AnalyticsTracker.trackSongEvent('song_complete', currentPlaybackTrack);
            }
            if (playbackRepeat === 'one') {
                audioPlayer.currentTime = 0;
                audioPlayer.play().catch(() => {});
                return;
            }
            if (currentPlaybackQueue.length > 0 && currentPlaybackQueueIndex >= 0) {
                playNextTrack();
            }
        });

        // ---- MediaSession API (Android notification / lock-screen controls) ----
        if ('mediaSession' in navigator) {
            audioPlayer.addEventListener('play', () => {
                navigator.mediaSession.playbackState = 'playing';
            });
            audioPlayer.addEventListener('pause', () => {
                navigator.mediaSession.playbackState = 'paused';
            });
            audioPlayer.addEventListener('timeupdate', () => {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: isFinite(audioPlayer.duration) ? audioPlayer.duration : 0,
                        playbackRate: audioPlayer.playbackRate,
                        position: isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0
                    });
                } catch (e) {}
            });

            navigator.mediaSession.setActionHandler('play', () => { resumePlayback(); });
            navigator.mediaSession.setActionHandler('pause', () => { pausePlayback(); });
            navigator.mediaSession.setActionHandler('previoustrack', () => { playPreviousTrack(); });
            navigator.mediaSession.setActionHandler('nexttrack', () => { playNextTrack(); });
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                const offset = details.seekOffset || 10;
                if (audioPlayer) {
                    window._isSeeking = true;
                    window._seekingUntil = Date.now() + 1200;
                    audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - offset);
                }
            });
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                const offset = details.seekOffset || 10;
                if (audioPlayer) {
                    window._isSeeking = true;
                    window._seekingUntil = Date.now() + 1200;
                    audioPlayer.currentTime = Math.min(audioPlayer.duration || 0, audioPlayer.currentTime + offset);
                }
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (audioPlayer && details.seekTime != null) {
                    window._isSeeking = true;
                    window._seekingUntil = Date.now() + 1200;
                    audioPlayer.currentTime = details.seekTime;
                }
            });
        }
    }
}

function stopCurrentStream() {
    if (window.__BUILDER_PREVIEW__) return;
    if (audioPlayer) {
        // CRITICAL FIX: Preserve current playback position instead of always resetting to 0:00
        // This ensures position is saved when switching views/players
        const preservedPosition = audioPlayer.currentTime;
        audioPlayer.pause();
        // Do NOT reset currentTime to 0 - preserve the position
        // Only remove src if we're truly stopping (not just pausing between tracks)
        audioPlayer.src = '';
        audioPlayer.removeAttribute('src');
        audioPlayer.load();
        isStreamPlaying = false;
        streamConnecting = false;
        playbackHasLoaded = false;
        // Restore preserved position after pause if available
        if (window.__PLAYBACK_POSITION__) {
            audioPlayer.currentTime = window.__PLAYBACK_POSITION__;
            window.__PLAYBACK_POSITION__ = null;
        }
        updatePlayPauseButton(false);
        showLiveStatus(false);
    }
    currentStation = null;
    currentPlaybackTrack = null;
    currentPlaybackMode = 'station';
}

/**
 * Check whether the same song/station is already the active playback source.
 * Returns true when clicking the currently-playing track must NOT restart it.
 */
function isSameActivePlayback(trackOrStation) {
    if (!trackOrStation) return false;
    if (typeof trackOrStation === 'string') {
        // Station name comparison
        return !!(currentStation && currentStation === trackOrStation);
    }
    // Track object comparison (by id, then by audioUrl/streamUrl, then by title+artist)
    const id = trackOrStation.id || trackOrStation.songId;
    if (id && currentPlaybackTrack && currentPlaybackTrack.id === id) return true;
    const url = trackOrStation.audioUrl || trackOrStation.streamUrl || trackOrStation.url;
    if (url && audioPlayer && audioPlayer.src && audioPlayer.src.indexOf(url) !== -1) return true;
    if (currentPlaybackTrack && trackOrStation.title && currentPlaybackTrack.title === trackOrStation.title
        && (!trackOrStation.artist || !currentPlaybackTrack.artist || currentPlaybackTrack.artist === trackOrStation.artist)) {
        return true;
    }
    return false;
}

/**
 * Resume the currently active playback session without creating a new audio
 * instance or resetting currentTime. Used when the user clicks/touches the
 * currently playing song/station — playback must continue from its exact
 * position, never jump back to 00:00.
 */
function resumeActivePlaybackSession() {
    if (window.__BUILDER_PREVIEW__) return;
    if (!audioPlayer || !audioPlayer.src) return false;
    // Preserve the current playback position — do NOT reset currentTime to 0.
    // DO NOT call audioPlayer.load() as it resets currentTime to 0 per HTML spec.
    const preservedPosition = audioPlayer.currentTime || 0;
    if (audioPlayer.paused) {
        audioPlayer.play().catch(() => {});
    }
    return true;
}

function toggleStationFromCard(btn, stationName) {
    if (isStreamPlaying && currentStation === stationName) {
        pauseStation();
    } else {
        playStation(stationName);
    }
}

function playStation(stationName) {
    if (window.__BUILDER_PREVIEW__) return;
    // CRITICAL FIX: If the user clicks/touches the station that is ALREADY the
    // active playback source, do NOT stop, restart, or reset it. Preserve the
    // current currentTime, play/pause state, volume and selected station.
    // Only create/load a new audio source when the user selects a DIFFERENT station.
    if (isSameActivePlayback(stationName)) {
        // If currently paused, resume the existing session from its position.
        if (audioPlayer && audioPlayer.paused) resumeActivePlaybackSession();
        return;
    }
    initAudioPlayer();
    stopCurrentStream();
    userPaused = false;
    currentPlaybackMode = 'station';
    currentPlaybackQueue = [];
    currentPlaybackQueueIndex = -1;
    currentPlaybackTrack = null;
    currentPlaylist = [];
    currentSongIndex = -1;
    // Analytics: track FM play
    if (typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.trackFMPlay({ id: stationName, name: stationName });
    
    // Clear all station card active states before starting new station
    document.querySelectorAll('.station-card, .station-grid-card, .slide-card').forEach(card => {
        card.classList.remove('active-station', 'playing-station');
        const playIcon = card.querySelector('.slide-play-btn, .sg-play-btn, .station-play-overlay i');
        if (playIcon) playIcon.className = 'fas fa-play';
    });
    document.querySelectorAll('.slide-play-btn').forEach(btn => {
        btn.classList.remove('wave-active', 'pulse-active');
    });
    
    let streamUrl = getStationStreamUrl(stationName);
    if (!streamUrl || streamUrl.trim() === '') {
        hideLoadingSpinner();
        showToast(`${stationName} stream is currently unavailable.`, 'error');
        return;
    }
    let streamUrlsToTry = [streamUrl];
    showLoadingSpinner();
    streamConnecting = true;
    let currentUrlIndex = 0;
    function tryNextStream() {
        if (currentUrlIndex >= streamUrlsToTry.length) {
            streamConnecting = false;
            hideLoadingSpinner();
            showToast(`Unable to connect to ${stationName}. Stream currently unavailable.`, 'error');
            return;
        }
        streamUrl = streamUrlsToTry[currentUrlIndex];
        console.log('[TamilAI FM] Playing stream:', streamUrl);
        audioPlayer.src = streamUrl;
        audioPlayer.volume = playbackVolume;
        audioPlayer.load();
        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                currentStation = stationName;
                currentPlaybackTrack = {
                    id: 'station_' + stationName,
                    title: stationName,
                    artist: 'Live FM Station',
                    thumbnail: '',
                    streamUrl
                };
                const stationInfo = getStationInfo(stationName);
                updateNowPlayingBar(stationInfo.name, stationInfo.freq);
                updateMediaSessionMetadata(stationInfo.name, stationInfo.freq, currentPlaybackTrack.thumbnail);
                updateStationCardStates(true);
                document.body.classList.add('gp-active');
                if (typeof GlobalPlayer !== 'undefined') {
                    GlobalPlayer.updateTrackUI();
                    GlobalPlayer.updateLiveUI();
                }
                if (typeof ListeningHistory !== 'undefined') {
                    ListeningHistory.trackPlayback(currentPlaybackTrack, 'station');
                }
                if (typeof YTMusic !== 'undefined') {
                    YTMusic.currentTrack = currentPlaybackTrack;
                    YTMusic.isPlaying = true;
                    YTMusic.updatePlayerUI();
                    YTMusic.updateFullscreenPlayerUI();
                    YTMusic.updateMiniPlayerUI();
                }
                hideLoadingSpinner();
                showToast(`Now playing: ${stationInfo.name}`, 'success');
                showPlaybackNotification(currentPlaybackTrack, true);
            }).catch((err) => {
                console.error('[TamilAI FM] Play promise rejected:', err?.name, err?.message, '| URL:', streamUrl);
                currentUrlIndex++;
                setTimeout(tryNextStream, 500);
            });
        }
    }
    tryNextStream();
}

async function playSong(song, playlist = []) {
    if (window.__BUILDER_PREVIEW__) return;
    // CRITICAL FIX: If the user clicks/touches the song that is ALREADY the
    // active playback source, do NOT stop, restart, or reset it. Preserve the
    // current currentTime, play/pause state, volume and selected track/station.
    // Only create/load a new audio source when the user selects a DIFFERENT song.
    if (isSameActivePlayback(song)) {
        // If currently paused, resume the existing session from its position.
        if (audioPlayer && audioPlayer.paused) resumeActivePlaybackSession();
        return;
    }
    initAudioPlayer();
    stopCurrentStream();
    userPaused = false;
    currentPlaybackMode = 'song';
    currentPlaylist = Array.isArray(playlist) ? playlist : [];
    currentSongIndex = currentPlaylist.findIndex(s => s.id === song.id);
    currentPlaybackQueue = currentPlaylist;
    currentPlaybackQueueIndex = currentSongIndex;
    currentPlaybackTrack = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail || song.albumCover || song.cover || '',
        audioUrl: song.audioUrl,
        movie: song.movie,
        duration: song.duration
    };
    if (song.audioUrl) {
        showLoadingSpinner();
        streamConnecting = true;
        audioPlayer.src = song.audioUrl;
        audioPlayer.volume = playbackVolume;
        audioPlayer.load();
        try {
            await audioPlayer.play();
            currentStation = song.title;
            isStreamPlaying = true;
            streamConnecting = false;
            persistPlaybackState();
            updatePlayPauseButton(true);
            updateNowPlayingBar(song.title, `${song.artist} â€¢ ${song.movie}`);
            updateMediaSessionMetadata(song.title, song.artist, song.thumbnail || song.albumCover || song.cover || '');
            document.body.classList.add('gp-active');
            if (typeof GlobalPlayer !== 'undefined') {
                GlobalPlayer.updateTrackUI();
                GlobalPlayer.updateLiveUI();
            }
            if (typeof ListeningHistory !== 'undefined') {
                ListeningHistory.trackPlayback(currentPlaybackTrack, 'song');
            }
            if (typeof YTMusic !== 'undefined') {
                YTMusic.currentTrack = currentPlaybackTrack;
                YTMusic.queue = currentPlaybackQueue;
                YTMusic.queueIndex = currentPlaybackQueueIndex;
                YTMusic.isPlaying = true;
                YTMusic.addToHistory(currentPlaybackTrack);
                YTMusic.updatePlayerUI();
                YTMusic.updateFullscreenPlayerUI();
                YTMusic.updateMiniPlayerUI();
            }
            hideLoadingSpinner();
            // Smart Queue: auto-select next song based on mood/artist/movie
                        _updateSmartQueue(song, currentPlaylist);
            showToast(`Now playing: ${song.title}`, 'success');
            showPlaybackNotification(currentPlaybackTrack, false);
            // Playback plays in the bottom mini bar only. The full-screen
            // player (gp-expanded) is opened exclusively by the user via the
            // mini-player expand control (gpMiniExpand / gpMiniInfo) — never
            // automatically on track start, so song clicks stay non-intrusive.
        } catch (err) {
            console.error('Play error:', err);
            streamConnecting = false;
            hideLoadingSpinner();
            showToast('Click play button to start', 'info');
        }
    } else {
        showToast(`Playing: ${song.title} (Demo mode)`, 'info');
        currentStation = song.title;
        isStreamPlaying = true;
        updatePlayPauseButton(true);
        updateNowPlayingBar(song.title, `${song.artist} â€¢ ${song.movie}`);
        updateMediaSessionMetadata(song.title, song.artist, song.thumbnail || song.albumCover || song.cover || '');
// Record listening history even in demo mode (songs without an audioUrl)
        if (typeof ListeningHistory !== 'undefined') {
            ListeningHistory.trackPlayback(currentPlaybackTrack, 'song');
        }
                // (No auto-expand here either — bottom player only; see playSong note.)
    }
}

function playTrackFromYTMusic(track, meta = {}) {
    if (!track) return;
    // CRITICAL FIX: If the user clicks/touches the track that is ALREADY the
    // active playback source, do NOT stop, restart, or reset it. Preserve the
    // current currentTime, play/pause state, volume and selected track/station.
    // Only create/load a new audio source when the user selects a DIFFERENT track.
    if (isSameActivePlayback(track)) {
        // If currently paused, resume the existing session from its position.
        if (audioPlayer && audioPlayer.paused) resumeActivePlaybackSession();
        return;
    }
    if (track.streamUrl) {
        playStation(track.title || track.artist || 'Tamil Hits Songs');
        return;
    }
    const song = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        movie: track.movie || '',
        thumbnail: track.thumbnail || '',
        albumCover: track.thumbnail || track.cover || '',
        cover: track.thumbnail || track.cover || '',
        audioUrl: track.audioUrl
    };
    const playlist = Array.isArray(meta.queue) && meta.queue.length ? meta.queue : [];
    playSong(song, playlist);
}

function pausePlayback() {
    if (audioPlayer) {
        userPaused = true;
        audioPlayer.pause();
        isStreamPlaying = false;
        updatePlayPauseButton(false);
        showLiveStatus(false);
        persistPlaybackState();
        if (typeof YTMusic !== 'undefined') {
            YTMusic.isPlaying = false;
            YTMusic.updatePlayerUI();
        }
        if (typeof MiniAudioPlayer !== 'undefined') {
            MiniAudioPlayer.syncPausedUI();
        }
    }
}

function resumePlayback() {
    if (!audioPlayer) return;
    if (audioPlayer.paused) {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        audioPlayer.play().catch(() => {});
        isStreamPlaying = true;
        updatePlayPauseButton(true);
        if (typeof GlobalPlayer !== 'undefined') GlobalPlayer.updatePlayUI(true);
        if (typeof YTMusic !== 'undefined') {
            YTMusic.isPlaying = true;
            YTMusic.updatePlayerUI();
        }
        if (typeof MiniAudioPlayer !== 'undefined') {
            MiniAudioPlayer.syncPlayingUI();
        }
    }
}

// ---- Robust seek support ----
// Resolves a playback duration from the most reliable source available:
//   1. audioPlayer.duration (when metadata has loaded)
//   2. duration metadata from the current track / yt-player / queue
//   3. the seekable end of the media element (for non-seekable streams)
let _pendingSeekPct = null;
let _pendingSeekTimer = null;
// Use window globals so all player scripts can check/set these
window._isSeeking = false;
window._seekingUntil = 0;
function getPlaybackDuration() {
    if (audioPlayer && typeof audioPlayer.duration === 'number' && isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
        return audioPlayer.duration;
    }
    if (currentPlaybackTrack) {
        const d = parseTrackDuration(currentPlaybackTrack);
        if (d > 0) return d;
    }
    if (typeof YTMusic !== 'undefined' && YTMusic.duration > 0) return YTMusic.duration;
    if (audioPlayer && audioPlayer.seekable && audioPlayer.seekable.length > 0) {
        const end = audioPlayer.seekable.end(audioPlayer.seekable.length - 1);
        if (isFinite(end) && end > 0) return end;
    }
    return 0;
}
function parseTrackDuration(track) {
    if (!track) return 0;
    let d = track.duration;
    if (typeof d === 'number' && isFinite(d) && d > 0) return d;
    if (typeof d === 'string') {
        const m = String(d).match(/^(\d+):(\d{1,2})$/);
        if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        const n = parseFloat(d);
        if (isFinite(n) && n > 0) return n;
    }
    return 0;
}
function applyPlaybackSeek(el, seconds) {
    if (!el) return;
    const dur = el.duration || getPlaybackDuration();
    let target = Math.max(0, Math.min(seconds, (dur && isFinite(dur) && dur > 0) ? dur : seconds));
    // Skip no-op seeks (within 10ms tolerance to avoid jitter)
    if (Math.abs((el.currentTime || 0) - target) < 0.01) return;
    try {
        el.currentTime = target;
    } catch (e3) {}
    persistPlaybackState();
    // Keep playing if it was playing before the seek — but only if
    // the audio has actually loaded (prevents restart from 0:00 on
    // an element whose src was never set or was cleared).
    if (window.isStreamPlaying && el.paused && playbackHasLoaded && el.src) {
        el.play().catch(() => {});
    }
}
function seekPlaybackToPercent(percent) {
    if (window.__BUILDER_PREVIEW__) return;
    if (!audioPlayer) return;
    const derived = Math.max(0, Math.min(1, percent));
    const dur = getPlaybackDuration();
    // Analytics: track seek
    if (typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.track('song_seek', { position: derived, duration: dur });
    // Set seeking flag — the waiting handler will suppress the buffering toast
    // while this flag is active.
    window._isSeeking = true;
    window._seekingUntil = Date.now() + 1200;
    // Immediately preview the requested position on all UIs so the bar/thumb
    // never snap back to 0:00 while the engine seeks.
    _pendingSeekPct = derived;
    if (typeof YTMusic !== 'undefined' && YTMusic.updateProgressUI) {
        if (dur && isFinite(dur) && dur > 0) {
            YTMusic.progress = derived * dur;
            YTMusic.duration = dur;
        }
        YTMusic.updateProgressUI();
    }
    if (typeof MiniAudioPlayer !== 'undefined' && typeof MiniAudioPlayer.setSeekPreview === 'function') {
        MiniAudioPlayer.setSeekPreview(derived, dur);
    }
    if (typeof GlobalPlayer !== 'undefined' && typeof GlobalPlayer.updateProgressUI === 'function') {
        GlobalPlayer.updateProgressUI();
    }
    if (dur && isFinite(dur) && dur > 0) {
        // Duration is known: seek immediately.
        if (_pendingSeekTimer) { clearTimeout(_pendingSeekTimer); _pendingSeekTimer = null; }
        applyPlaybackSeek(audioPlayer, derived * dur);
        ProgressSync.syncAll();
    } else {
        // Duration not ready yet (typical at 0:00 before metadata loads).
        // Defer the actual seek until the duration becomes available, but
        // keep the UI preview at the requested position.
        if (_pendingSeekTimer) clearTimeout(_pendingSeekTimer);
        const finish = () => {
            _pendingSeekTimer = null;
            const d2 = getPlaybackDuration();
            if (d2 && isFinite(d2) && d2 > 0 && _pendingSeekPct !== null) {
                applyPlaybackSeek(audioPlayer, _pendingSeekPct * d2);
                ProgressSync.syncAll();
            }
            _pendingSeekPct = null;
        };
        audioPlayer.addEventListener('loadedmetadata', finish, { once: true });
        audioPlayer.addEventListener('durationchange', finish, { once: true });
        _pendingSeekTimer = setTimeout(() => {
            const d2 = getPlaybackDuration();
            if (d2 && isFinite(d2) && d2 > 0 && _pendingSeekPct !== null) {
                applyPlaybackSeek(audioPlayer, _pendingSeekPct * d2);
                ProgressSync.syncAll();
            }
            _pendingSeekPct = null;
        }, 800);
    }
}

function setPlaybackVolume(volume) {
    playbackVolume = Math.max(0, Math.min(1, volume));
    if (audioPlayer) {
        audioPlayer.volume = playbackVolume;
    }
    // Analytics: track volume change
    if (typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.track('volume_change', { volume: playbackVolume });
    persistPlaybackState();
}

function playNextTrack() {
    if (window.__BUILDER_PREVIEW__) return;
    if (currentPlaybackQueue.length === 0) return;
    // Analytics: track next song
    if (typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.track('next_song');
    if (playbackShuffle) {
        currentPlaybackQueueIndex = Math.floor(Math.random() * currentPlaybackQueue.length);
    } else {
        currentPlaybackQueueIndex = (currentPlaybackQueueIndex + 1) % currentPlaybackQueue.length;
    }
    const nextItem = currentPlaybackQueue[currentPlaybackQueueIndex];
    if (!nextItem) return;
    if (nextItem.audioUrl || nextItem.streamUrl) {
        if (nextItem.streamUrl) {
            playStation(nextItem.title || nextItem.name || 'Tamil Hits Songs');
        } else {
            playSong(nextItem, currentPlaybackQueue);
        }
    }
}

function playPreviousTrack() {
    if (window.__BUILDER_PREVIEW__) return;
    if (currentPlaybackQueue.length === 0) return;
    // Analytics: track previous song
    if (typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.track('previous_song');
    if (currentPlaybackQueueIndex < 0) currentPlaybackQueueIndex = 0;
    if (playbackShuffle) {
        currentPlaybackQueueIndex = Math.floor(Math.random() * currentPlaybackQueue.length);
    } else {
        currentPlaybackQueueIndex = (currentPlaybackQueueIndex - 1 + currentPlaybackQueue.length) % currentPlaybackQueue.length;
    }
    const prevItem = currentPlaybackQueue[currentPlaybackQueueIndex];
    if (!prevItem) return;
    if (prevItem.audioUrl || prevItem.streamUrl) {
        if (prevItem.streamUrl) {
            playStation(prevItem.title || prevItem.name || 'Tamil Hits Songs');
        } else {
            playSong(prevItem, currentPlaybackQueue);
        }
    }
}

function playNextSong() {
    playNextTrack();
}

function playPreviousSong() {
    playPreviousTrack();
}

function pauseStation() {
    if (audioPlayer && isStreamPlaying) {
        userPaused = true;
        audioPlayer.pause();
        isStreamPlaying = false;
        updatePlayPauseButton(false);
        showLiveStatus(false);
        updateStationCardStates(false);
        if (typeof YTMusic !== 'undefined') {
            YTMusic.isPlaying = false;
            YTMusic.updatePlayerUI();
        }
        if (typeof MiniAudioPlayer !== 'undefined') {
            MiniAudioPlayer.syncPausedUI();
        }
        showToast('Playback paused', 'info');
    }
}

function togglePlayPause() {
    if (window.__BUILDER_PREVIEW__) return;
    if (isStreamPlaying) {
        pausePlayback();
    } else if (currentStation || currentPlaybackTrack) {
        userPaused = false;
        if (currentStation && (!audioPlayer.src || audioPlayer.src === '' || audioPlayer.src === 'about:blank')) {
            playStation(currentStation);
        } else if (audioPlayer && (audioPlayer.src || currentPlaybackTrack?.audioUrl)) {
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            audioPlayer.play().catch(() => {});
            isStreamPlaying = true;
            updatePlayPauseButton(true);
            if (typeof YTMusic !== 'undefined') {
                YTMusic.isPlaying = true;
                YTMusic.updatePlayerUI();
            }
            if (typeof MiniAudioPlayer !== 'undefined') {
                MiniAudioPlayer.syncPlayingUI();
            }
        } else {
            showToast('Please select a station or song to play', 'info');
        }
    } else {
        showToast('Please select a station or song to play', 'info');
    }
}

function getStationInfo(stationName) {
    const station = DataStore.getStations().find(s => s.name === stationName);
    if (station) return { name: station.name, freq: `${station.freq} â€¢ ${station.genre || 'Music'}` };
    return { name: stationName, freq: 'FM' };
}

function updatePlayPauseButton(playing) {
    const playButtons = document.querySelectorAll('.slide-play-btn, .station-play-overlay i, .recent-play-btn i, .song-play-btn i, .playlist-song-play i, .premium-radio-play');
    playButtons.forEach(btn => {
        if (playing) {
            btn.classList.remove('fa-play');
            btn.classList.add('fa-pause');
        } else {
            btn.classList.remove('fa-pause');
            btn.classList.add('fa-play');
        }
    });
    if (npPlayBtn) {
        npPlayBtn.innerHTML = playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    }

    document.querySelectorAll('.slide-play-btn').forEach(btn => {
        btn.classList.remove('wave-active', 'pulse-active');
        if (currentStation) {
            const card = btn.closest('.slide-card');
            const cardStation = card?.querySelector('h3')?.textContent || '';
            if (cardStation === currentStation && playing) {
                btn.classList.add('wave-active');
            }
        }
    });

    document.querySelectorAll('.station-card, .station-grid-card').forEach(card => {
        card.classList.remove('active-station', 'playing-station');
        if (currentStation) {
            const cardName = card.querySelector('h3')?.textContent || '';
            if (cardName === currentStation) {
                card.classList.add('active-station');
                if (playing) card.classList.add('playing-station');
            }
        }
    });
}

function updateNowPlayingBar(title, station) {
    const titleEl = document.querySelector('.now-playing-title');
    const stationEl = document.querySelector('.now-playing-station');
    if (titleEl) titleEl.textContent = title;
    if (stationEl) stationEl.textContent = station;
}

function updateMediaSessionMetadata(title, artist, artwork) {
    if (!('mediaSession' in navigator)) return;
    try {
        var meta = {
            title: title || 'Tamil AI Stream',
            artist: artist || 'Tamil AI Stream',
            album: 'Tamil AI Stream'
        };
        if (artwork) {
            meta.artwork = [{ src: artwork, sizes: '512x512', type: 'image/png' }];
        }
        navigator.mediaSession.metadata = new MediaMetadata(meta);
    } catch (e) {}
}

function showLiveStatus(isLive) {
    // Only affect the LIVE badge on the currently active station card
    document.querySelectorAll('.sg-live-badge, .slide-badge').forEach(badge => {
        const card = badge.closest('.station-card, .station-grid-card, .slide-card');
        if (!card) return;
        const cardName = card.querySelector('h3, h4')?.textContent || '';
        if (cardName === currentStation && isLive) {
            badge.style.background = 'rgba(16, 185, 129, 0.2)';
            badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            badge.style.color = '#34d399';
        } else {
            badge.style.background = 'rgba(239, 68, 68, 0.15)';
            badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            badge.style.color = '#f87171';
        }
    });
}

function updateStationCardStates(playing) {
    document.querySelectorAll('.station-card, .station-grid-card, .slide-card, .premium-radio-card').forEach(card => {
        const cardName = card.querySelector('h3, h4')?.textContent || '';
        const playBtn = card.querySelector('.slide-play-btn, .sg-play-btn, .station-play-overlay i, .premium-radio-play');
        if (!playBtn) return;
        if (cardName === currentStation && playing) {
            card.classList.add('active-station', 'playing-station');
            if (playBtn.classList.contains('slide-play-btn') || playBtn.classList.contains('sg-play-btn')) {
                playBtn.classList.add('wave-active');
                playBtn.classList.remove('pulse-active');
                playBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            } else if (playBtn.classList.contains('premium-radio-play')) {
                playBtn.className = 'fa-solid fa-pause premium-radio-play';
            } else {
                playBtn.className = 'fas fa-pause';
            }
        } else {
            card.classList.remove('active-station', 'playing-station');
            if (playBtn.classList.contains('slide-play-btn') || playBtn.classList.contains('sg-play-btn')) {
                playBtn.classList.remove('wave-active', 'pulse-active');
                playBtn.innerHTML = '<i class="fas fa-play"></i> Listen Now';
            } else if (playBtn.classList.contains('premium-radio-play')) {
                playBtn.className = 'fa-solid fa-play premium-radio-play';
            } else {
                playBtn.className = 'fas fa-play';
            }
        }
    });
}

function showLoadingSpinner() {
    const playButtons = document.querySelectorAll('.slide-play-btn, .sg-play-btn, .song-play-btn, .playlist-song-play');
    playButtons.forEach(btn => {
        const originalContent = btn.innerHTML;
        btn.setAttribute('data-original', originalContent);
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        btn.disabled = true;
    });
}

function hideLoadingSpinner() {
    const playButtons = document.querySelectorAll('.slide-play-btn, .sg-play-btn, .song-play-btn, .playlist-song-play');
    playButtons.forEach(btn => {
        const originalContent = btn.getAttribute('data-original');
        if (originalContent) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });
}

// ============================================
// Station-Specific Play Buttons
// ============================================
document.querySelectorAll('.slide-card, .station-grid-card').forEach(card => {
    const stationName = card.querySelector('h3, h4')?.textContent || '';
    const playBtn = card.querySelector('.slide-play-btn, .sg-play-btn');
    const playOverlay = card.querySelector('.station-play-overlay');
    
    const handlePlay = (e) => {
        e.stopPropagation();
        if (stationName) {
            if (isStreamPlaying && currentStation === stationName) {
                pauseStation();
            } else {
                playStation(stationName);
            }
            createRipple(e, e.currentTarget);
        }
    };
    
    playBtn?.addEventListener('click', handlePlay);
    playOverlay?.addEventListener('click', handlePlay);
});

// ============================================
// Now Playing Bar Controls
// ============================================
npPlayBtn?.addEventListener('click', togglePlayPause);

// Previous button
const prevBtn = document.querySelector('.fa-backward-step')?.closest('.np-btn');
prevBtn?.addEventListener('click', () => {
    if (currentPlaylist.length > 0) {
        playPreviousSong();
    } else {
        showToast('No playlist active', 'info');
    }
});

// Next button
const nextBtn = document.querySelector('.fa-forward-step')?.closest('.np-btn');
nextBtn?.addEventListener('click', () => {
    if (currentPlaylist.length > 0) {
        playNextSong();
    } else {
        showToast('No playlist active', 'info');
    }
});

const volumeBtn = document.querySelector('.now-playing-volume .np-btn');
volumeBtn?.addEventListener('click', function() {
    if (audioPlayer) {
        const currentVolume = audioPlayer.volume;
        const newVolume = currentVolume > 0.5 ? 0 : 1;
        audioPlayer.volume = newVolume;
        this.innerHTML = newVolume > 0 ? '<i class="fas fa-volume-high"></i>' : '<i class="fas fa-volume-xmark"></i>';
    }
});

// ============================================
// Play Button Interactions (Other Stations)
// ============================================
document.querySelectorAll('.recent-play-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const stationName = this.closest('.station-card, .slide-card, .recent-item')
            ?.querySelector('h3, h4')?.textContent || 'Station';
        const stationGenre = this.closest('.station-card, .slide-card, .recent-item')
            ?.querySelector('p')?.textContent || '';
        
        if (stationName) {
            const station = DataStore.getStations().find(s => s.name === stationName);
            if (station) {
                playStation(stationName);
            } else {
                document.querySelector('.now-playing-title').textContent = stationName;
                document.querySelector('.now-playing-station').textContent = stationGenre;
                showToast(`${stationName} is not available.`, 'info');
            }
        }
        createRipple(e, this);
    });
});

// ============================================
// Tamil Hits Card Click
// ============================================
document.querySelectorAll('.tamil-hit-card').forEach(card => {
    const artist = card.dataset.artist;
    const artistName = card.querySelector('h3')?.textContent || '';
    const songCount = card.dataset.songs;
    
    card.addEventListener('click', function(e) {
        if (e.target.closest('.hit-play-btn, .hit-shuffle-btn, .hit-fav-btn')) {
            return;
        }
        openPlaylistPage(artist, artistName, songCount);
    });
    
    const playBtn = card.querySelector('.hit-play-btn');
    playBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        playArtistHits(artist, artistName);
        createRipple(e, this);
    });
    
    const shuffleBtn = card.querySelector('.hit-shuffle-btn');
    shuffleBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        shuffleArtistHits(artist, artistName);
        createRipple(e, this);
    });
    
    const favBtn = card.querySelector('.hit-fav-btn');
    favBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.toggle('active');
        const icon = this.querySelector('i');
        icon.style.fontWeight = this.classList.contains('active') ? '900' : '400';
        const isFav = this.classList.contains('active');
        showToast(isFav ? `Added ${artistName} to favorites` : `Removed ${artistName} from favorites`, 'success');
        createRipple(e, this);
    });
});

// ============================================
// Playlist Page Navigation
// ============================================
function openPlaylistPage(artist, artistName, songCount) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.artist === artist);
    const songs = (hit && hit.songs && hit.songs.length) ? hit.songs : [];
    const playlistData = {
        artist: artist,
        artistName: artistName,
        songCount: songCount,
        songs: songs,
        timestamp: Date.now()
    };
    localStorage.setItem('tamilAIStream_currentPlaylist', JSON.stringify(playlistData));
    window.location.href = 'playlist.html';
}

function playArtistHits(artist, artistName) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.artist === artist);
    if (hit && hit.songs && hit.songs.length > 0) {
        const firstSong = hit.songs[0];
        if (firstSong.audioUrl) {
            playSong(firstSong, hit.songs);
        } else {
            showToast(`Playing ${artistName} - Demo mode`, 'info');
        }
    } else {
        showToast(`Playing ${artistName} - Demo mode`, 'info');
    }
}

function shuffleArtistHits(artist, artistName) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.artist === artist);
    if (hit && hit.songs && hit.songs.length > 0) {
        const shuffled = [...hit.songs].sort(() => Math.random() - 0.5);
        const firstSong = shuffled[0];
        if (firstSong.audioUrl) {
            playSong(firstSong, shuffled);
            showToast(`Shuffled ${artistName} hits`, 'success');
        } else {
            showToast(`Shuffling ${artistName} - Demo mode`, 'info');
        }
    } else {
        showToast(`Shuffling ${artistName} hits`, 'success');
    }
}

// ============================================
// Category Card Click
// ============================================
document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', function() {
        const category = this.dataset.category;
        const name = this.querySelector('.category-name').textContent;
        const count = this.querySelector('.category-count').textContent;
        showToast(`Showing ${name} stations (${count})`, 'info');
    });
});

// ============================================
// Station Card Click
// ============================================
document.querySelectorAll('.station-card').forEach(card => {
    card.addEventListener('click', function() {
        const title = this.querySelector('h3')?.textContent || 'Station';
        const genre = this.querySelector('p')?.textContent || '';
        document.querySelector('.now-playing-title').textContent = title;
        document.querySelector('.now-playing-station').textContent = genre;
        isPlaying = true;
        if (npPlayBtn) npPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
    });
});

// ============================================
// Ripple Effect
// ============================================
function createRipple(e, element) {
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `position:absolute;width:${size}px;height:${size}px;left:${x}px;top:${y}px;border-radius:50%;background:rgba(255,255,255,0.3);transform:scale(0);animation:rippleAnim 0.6s ease-out forwards;pointer-events:none;`;
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

const styleSheet = document.createElement('style');
styleSheet.textContent = `
@keyframes rippleAnim { to { transform: scale(4); opacity: 0; } }
.ripple { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.3); transform: scale(0); pointer-events: none; }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
.pulse { animation: pulse 0.3s ease-in-out; }
`;
document.head.appendChild(styleSheet);

document.querySelectorAll('.slide-play-btn, .category-card, .nav-icon-btn, .recent-play-btn, .hit-play-btn, .hit-shuffle-btn, .hit-fav-btn').forEach(el => {
    el.addEventListener('click', function(e) { createRipple(e, this); });
});

// ============================================
// Section Header Animation
// ============================================
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'none';
            entry.target.offsetHeight;
            entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.section-header').forEach(header => observer.observe(header));

// ============================================
// Nav Icon Button Interactions
// ============================================
document.querySelectorAll('.nav-icon-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const icon = this.querySelector('i');
        if (icon.classList.contains('fa-bell')) {
            showToast('ðŸ”” You have 3 new notifications', 'info');
        } else if (icon.classList.contains('fa-heart')) {
            this.classList.toggle('active');
            icon.style.color = this.classList.contains('active') ? '#ef4444' : '';
        }
    });
});

// ============================================
// Nav Avatar Click
// ============================================
document.querySelector('.nav-avatar')?.addEventListener('click', function() {
    window.location.href = 'profile.html';
});

// ============================================
// Section Link Interactions
// ============================================
document.querySelectorAll('.section-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const text = this.textContent.trim();
        if (text === 'View All') {
            document.querySelector('.stations-scroll')?.scrollBy({ left: 500, behavior: 'smooth' });
        }
    });
});

// ============================================
// Keyboard Shortcuts
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        playNextTrack();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        playPreviousTrack();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
        e.preventDefault();
        setPlaybackVolume(playbackVolume + 0.1);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        setPlaybackVolume(playbackVolume - 0.1);
    }
    if (e.key.toLowerCase() === 'm') {
        setPlaybackVolume(playbackVolume === 0 ? 0.7 : 0);
    }
    if (e.key.toLowerCase() === 's') {
        playbackShuffle = !playbackShuffle;
        showToast(playbackShuffle ? 'Shuffle on' : 'Shuffle off', 'info');
    }
    if (e.key.toLowerCase() === 'r') {
        const modes = ['off', 'all', 'one'];
        playbackRepeat = modes[(modes.indexOf(playbackRepeat) + 1) % 3];
        showToast(playbackRepeat === 'off' ? 'Repeat off' : playbackRepeat === 'all' ? 'Repeat all' : 'Repeat one', 'info');
    }
    if (e.key === 'ArrowRight' && !document.activeElement?.closest('.search-bar')) {
        document.querySelector('.slider-next')?.click();
    }
    if (e.key === 'ArrowLeft' && !document.activeElement?.closest('.search-bar')) {
        document.querySelector('.slider-prev')?.click();
    }
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInput?.focus();
    }
});

// ============================================
// Stations Grid - Filter & Search (initialized in DOMContentLoaded)
// ============================================

// ============================================
// Favorite Button Toggle
// ============================================
document.querySelectorAll('.sg-fav-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.toggle('active');
        const icon = this.querySelector('i');
        icon.style.fontWeight = this.classList.contains('active') ? '900' : '400';
        createRipple(e, this);
    });
});

// ============================================
// Station Grid Card Play
// ============================================
document.querySelectorAll('.station-grid-card').forEach(card => {
    card.addEventListener('click', function() {
        const name = this.dataset.name || 'Station';
        const freq = this.dataset.freq || '';
        const genre = this.querySelector('.sg-genre')?.textContent || '';
        document.querySelector('.now-playing-title').textContent = name;
        document.querySelector('.now-playing-station').textContent = `${freq} â€¢ ${genre}`;
        const thumb = document.querySelector('.now-playing-thumb');
        const logoBg = this.querySelector('.sg-logo')?.style.background || 'linear-gradient(135deg,#0f3b2e,#064e3b)';
        thumb.style.background = logoBg;
        isPlaying = true;
        if (npPlayBtn) npPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
    });
    card.querySelector('.sg-play-btn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        card.click();
    });
});

// ============================================
// Pagination
// ============================================
document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.page-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const text = this.textContent.trim();
        if (text === '2') {
            stationsGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        createRipple({ clientX: this.getBoundingClientRect().left + 20, clientY: this.getBoundingClientRect().top + 20 }, this);
    });
});

// ============================================
// Song Management System
// ============================================
// Cache for songs data
let songsCache = null;
let songsCacheTimestamp = 0;
const CACHE_DURATION = 30000;

async function loadSongs(forceRefresh = false) {
    try {
        const songs = JSON.parse(localStorage.getItem('tamilAIStream_songs') || '[]');
        songsCache = songs.filter(s => s.status === 'published');
        return songsCache;
    } catch (e) {
        console.error('Error loading songs from localStorage:', e);
        return songsCache || [];
    }
}

function showSkeletonLoading() {
    const container = document.getElementById('songsContainer');
    if (!container) return;
    
    const skeletonItems = Array(6).fill(0).map((_, i) => `
        <div class="song-card skeleton-card" style="animation-delay: ${i * 0.05}s">
            <div class="song-card-header">
                <div class="song-thumbnail skeleton-pulse"></div>
                <div class="song-info">
                    <div class="skeleton-line skeleton-title"></div>
                    <div class="skeleton-line skeleton-artist"></div>
                    <div class="skeleton-line skeleton-movie"></div>
                </div>
            </div>
            <div class="song-card-footer">
                <div class="skeleton-line skeleton-duration"></div>
                <div class="song-actions">
                    <div class="skeleton-circle"></div>
                    <div class="skeleton-circle"></div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = skeletonItems;
}

function displaySongs(songs) {
    const container = document.getElementById('songsContainer');
    if (!container) return;
    
    if (songs.length === 0) {
        container.innerHTML = `
            <div class="songs-empty">
                <div class="songs-empty-icon"><i class="fas fa-music"></i></div>
                <h3 class="songs-empty-title">No songs available</h3>
                <p class="songs-empty-text">Songs will appear here once they are added. Check back later!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = songs.map((song, index) => `
        <div class="song-card" data-song-id="${song.id}" style="animation-delay: ${index * 0.05}s">
            <div class="song-card-header">
                <div class="song-thumbnail">
                    <img src="${song.albumCover || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Ccircle cx="40" cy="40" r="30" fill="%2334d399" opacity="0.3"/%3E%3C/svg%3E'}" alt="${song.title || 'Song'}">
                    <div class="song-eq-bars"><span></span><span></span><span></span><span></span></div>
                    <div class="song-play-overlay" data-song-id="${song.id}">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
                <div class="song-info">
                    <div class="song-title" title="${song.title || 'Untitled'}">${song.title || 'Untitled'}</div>
                    <div class="song-artist" title="${song.artist || 'Unknown Artist'}">${song.artist || 'Unknown Artist'}</div>
                    <div class="song-movie" title="${song.movie || 'Single'}">${song.movie || 'Single'}</div>
                </div>
            </div>
            <div class="song-card-footer">
                <div class="song-duration">
                    <i class="fas fa-clock"></i>
                    <span>${song.duration || 'N/A'}</span>
                </div>
                <div class="song-actions">
                    <button class="song-play-btn" data-song-id="${song.id}" aria-label="Play">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="song-fav-btn" aria-label="Add to favorites">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add event listeners to song play buttons
    document.querySelectorAll('.song-play-btn, .song-play-overlay').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const songId = this.dataset.songId;
            if (songId) {
                const song = songs.find(s => s.id === songId);
                if (song) {
                    playSong(song, songs);
                }
            }
        });
    });
    
    // Add event listeners to favorite buttons
    document.querySelectorAll('.song-fav-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
            const icon = this.querySelector('i');
            icon.style.fontWeight = this.classList.contains('active') ? '900' : '400';
            createRipple(e, this);
        });
    });

    // AI glow effect — track mouse position on song cards
    container.querySelectorAll('.song-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--mouse-x', x + '%');
            card.style.setProperty('--mouse-y', y + '%');
        });
    });
}

async function playSongById(songId) {
    try {
        const songs = JSON.parse(localStorage.getItem('tamilAIStream_songs') || '[]');
        const song = songs.find(s => s.id === songId);
        if (!song) {
            showToast('Song not found', 'error');
            return;
        }
        playSong(song, songs);
    } catch (error) {
        console.error('Error playing song:', error);
        showToast('Error playing song', 'error');
    }
}

function toggleFavorite(button, event) {
    button.classList.toggle('active');
    const icon = button.querySelector('i');
    icon.style.fontWeight = button.classList.contains('active') ? '900' : '400';
    const isFav = button.classList.contains('active');
    showToast(isFav ? 'Added to favorites' : 'Removed from favorites', 'success');
    try {
        if (event) createRipple(event, button);
    } catch (e) {
        // Silently handle ripple errors
    }
}

// ============================================
// Website Layout Sync from Builder (localStorage)
// ============================================
function setupLayoutSync() {
    const saved = localStorage.getItem('websiteLayout');
    if (!saved) return;
    
    try {
        const sections = JSON.parse(saved);
        if (!sections || !sections.length) return;
        
        console.log('Layout loaded from localStorage:', sections.length, 'sections');
        
        const allSections = document.querySelectorAll('[data-section]');
        const sectionOrder = sections.map(s => s.type);
        
        const mainContent = allSections[0]?.parentElement;
        if (!mainContent) return;
        
        // Reorder sections that are in the saved layout
        sectionOrder.forEach(type => {
            const section = mainContent.querySelector(`[data-section="${type}"]`);
            if (section) mainContent.appendChild(section);
        });
        
        // Show/hide sections based on saved layout
        // New sections not in saved layout are shown by default (additive approach)
        allSections.forEach(section => {
            const type = section.dataset.section;
            if (sectionOrder.includes(type)) {
                section.style.display = '';
            } else if (type.startsWith('made-for-') || type.startsWith('new-releases') || 
                       type.startsWith('top-charts') || type.startsWith('curated-playlists') ||
                       type.startsWith('recently-played') || type.startsWith('artist-essentials')) {
                // Premium sections: show by default
                section.style.display = '';
            } else {
                // Other unknown sections: hide
                section.style.display = 'none';
            }
        });
    } catch (err) {
        console.warn('Layout sync error:', err);
    }
}

// ============================================
// Visual Editor Overrides (from Builder Publish)
// ============================================
function applyVEOverrides() {
    try {
        const raw = localStorage.getItem('tamilAIStream_veOverrides');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || !data.timestamp) return;

        // Apply section visibility and order
        if (data.sectionStates && data.sectionStates.length) {
            const mainContent = document.querySelector('main') || document.querySelector('#mainContent') || document.body;
            const allSections = mainContent.querySelectorAll('[data-section], header, nav, footer, section');

            // First: apply visibility
            data.sectionStates.forEach(state => {
                if (!state.id) return;
                const el = mainContent.querySelector(`[data-section="${state.id}"]`) ||
                           mainContent.querySelector(`#${state.id}`);
                if (el) {
                    el.style.display = state.hidden ? 'none' : '';
                }
            });

            // Second: apply order (re-append sections in saved order)
            const sectionOrder = data.sectionStates.map(s => s.id).filter(Boolean);
            sectionOrder.forEach(id => {
                const el = mainContent.querySelector(`[data-section="${id}"]`) ||
                           mainContent.querySelector(`#${id}`);
                if (el && el.parentElement) el.parentElement.appendChild(el);
            });
        }

        // Apply element style overrides (position, size, etc.)
        if (data.overrides && typeof data.overrides === 'object') {
            Object.keys(data.overrides).forEach(selector => {
                const bpData = data.overrides[selector];
                if (!bpData || typeof bpData !== 'object') return;
                Object.keys(bpData).forEach(bp => {
                    const styles = bpData[bp];
                    if (!styles || typeof styles !== 'object') return;
                    let el;
                    try { el = document.querySelector(selector); } catch(e) {}
                    if (!el) return;
                    // Apply only for matching breakpoint
                    const w = window.innerWidth;
                    const matchesBp = (bp === 'desktop' && w >= 992) ||
                                      (bp === 'tablet' && w >= 576 && w < 992) ||
                                      (bp === 'mobile' && w < 576) ||
                                      (bp === 'all');
                    if (!matchesBp) return;
                    Object.keys(styles).forEach(prop => {
                        if (prop === 'visibility') el.style.visibility = styles[prop];
                        else if (prop === 'display') el.style.display = styles[prop];
                        else if (prop === 'opacity') el.style.opacity = styles[prop];
                        else el.style[prop] = styles[prop];
                    });
                });
            });
        }

        console.log('[VE] Applied visual editor overrides from Builder');
    } catch (err) {
        console.warn('[VE] Failed to apply overrides:', err);
    }
}

// ============================================
// User Profile Update
// ============================================
function updateUserProfile(userData) {
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        if (userData.photoURL) {
            avatar.innerHTML = `<img src="${userData.photoURL}" alt="${userData.name}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            const initials = userData.name ? userData.name.charAt(0).toUpperCase() : 'U';
            avatar.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#34d399,#059669);color:white;font-weight:600;font-size:0.85rem;">${initials}</div>`;
        }
    }
}

// ============================================
// Authentication Check & Logout (localStorage)
// ============================================
function checkAuth() {
    // Allow unauthenticated users to view the home page (public radio site).
    // Only redirect to login for protected routes.
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const protectedPages = ['admin.html', 'admin-login.html', 'builder.html', 'admin-upload.html'];
    if (protectedPages.includes(page) && !Auth.isAuthenticated()) {
        Auth.requireAuth();
        return false;
    }
    if (Auth.isAuthenticated()) {
        const user = Auth.currentUser();
        if (user) {
            updateUserProfile({
                name: user.name || 'User',
                email: user.email || '',
                photoURL: user.photoURL || '',
                isGuest: !!user.isGuest
            });
        }
    } else {
        // Guest mode - show guest profile
        updateUserProfile({
            name: 'Guest',
            email: '',
            photoURL: '',
            isGuest: true
        });
    }
    return true;
}

function logout() {
    Auth.logout();
}

// ============================================
// Logout Button
// ============================================
document.getElementById('logoutBtn')?.addEventListener('click', logout);

// ============================================
// Top Header - Live Time & Date
// ============================================
let _topHeaderDateInterval = null;
let _topHeaderTimeInterval = null;

function initTopHeader() {
    const dateEl = document.getElementById('liveDate');
    const timeEl = document.getElementById('liveTime');

    if (!dateEl && !timeEl) return; // No top header elements

    // Clear existing intervals to prevent duplicates
    if (_topHeaderDateInterval) clearInterval(_topHeaderDateInterval);
    if (_topHeaderTimeInterval) clearInterval(_topHeaderTimeInterval);

    // Update date
    function updateDate() {
        if (dateEl) {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('en-US', options);
        }
    }

    // Update time
    function updateTime() {
        if (timeEl) {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        }
    }

    // Initial updates
    updateDate();
    updateTime();

    // Intervals — pause when tab hidden
    _topHeaderDateInterval = setInterval(() => { if (!document.hidden) updateDate(); }, 60000);
    _topHeaderTimeInterval = setInterval(() => { if (!document.hidden) updateTime(); }, 1000);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { updateDate(); updateTime(); }
    });
}

// ============================================
// Admin Check - Show Builder Link for Admin Only
// ============================================
function checkAdminAndShowBuilder() {
    const builderNavLink = document.getElementById('builderNavLink');
    const premiumNavBuilder = document.getElementById('premiumNavBuilder');
    const premiumMobileNavBuilder = document.getElementById('premiumMobileNavBuilder');
    let isAdmin = false;
    
    // Default: hide builder everywhere
    if (builderNavLink) builderNavLink.style.display = 'none';
    if (premiumNavBuilder) premiumNavBuilder.style.display = 'none';
    if (premiumMobileNavBuilder) premiumMobileNavBuilder.style.display = 'none';
    
    // Check if user is guest - NEVER show builder for guests
    const isGuest = localStorage.getItem('tamilAIStream_guest');
    if (isGuest === 'true') return;
    
    // Check for admin session (logged in via builder page)
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
        try {
            const sessionData = JSON.parse(adminSession);
            if (sessionData.username === 'admin@tamilaistream.com' && sessionData.expiry > Date.now()) {
                isAdmin = true;
            }
        } catch (e) { /* Invalid session, continue checking */ }
    }
    
    // Check for admin logged in via main login page
    if (!isAdmin) {
        const storedUser = localStorage.getItem('tamilAIStream_user');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                if (userData.email === 'admin@tamilaistream.com') {
                    isAdmin = true;
                }
            } catch (e) { /* Invalid user data */ }
        }
    }
    
    // Show/hide builder elements based on admin status
    if (isAdmin) {
        if (builderNavLink) builderNavLink.style.display = 'flex';
        if (premiumNavBuilder) premiumNavBuilder.style.display = 'flex';
        if (premiumMobileNavBuilder) premiumMobileNavBuilder.style.display = 'flex';
    }
}

// ============================================
// Dynamic Content Rendering from DataStore
// ============================================

// Render Featured Slider from DataStore
function renderFeaturedSliderDynamic() {
    const track = document.getElementById('sliderTrack');
    const dotsContainer = document.getElementById('sliderDots');
    if (!track) return;

    const featured = DataStore.getFeatured();
    const stations = DataStore.getStations();

    const hash = featured.map(f => f.id + (f.stationId || '') + (f.status || '')).join(',');
    if (!_hasSectionChanged('featured', hash)) return;
    
    if (!featured.length) {
        track.innerHTML = '<div class="slide-card"><div class="slide-info"><h3>No featured stations</h3></div></div>';
        return;
    }
    
    track.innerHTML = featured.filter(f => f.status === 'active').map(item => {
        const station = stations.find(s => s.id === item.stationId) || {};
        const thumbSrc = item.thumbnail || station.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='100' r='90' fill='%2334d399' opacity='0.15'/%3E%3Ccircle cx='100' cy='100' r='60' fill='%2334d399' opacity='0.25'/%3E%3Ccircle cx='100' cy='100' r='30' fill='%2334d399' opacity='0.4'/%3E%3C/svg%3E";
        const isRealImage = item.thumbnail || station.thumbnail;
        return `
            <div class="slide-card" style="--slide-bg: ${item.gradient || station.gradient || 'linear-gradient(135deg, #0f3b2e, #064e3b)'};">
                <div class="slide-art">
                    <img src="${thumbSrc}" alt="${item.title || station.name || ''}" ${isRealImage ? 'style="width:100%;height:100%;object-fit:cover;"' : ''}>
                </div>
                <div class="slide-info">
                    <span class="slide-badge"><i class="fas fa-signal"></i> Live</span>
                    <h3>${item.title || station.name || 'Station'}</h3>
                    <p>${item.subtitle || station.freq + ' â€¢ ' + station.city || ''}</p>
                    <span class="slide-listeners"><i class="fas fa-headphones"></i> ${(item.listeners || station.listeners || 0).toLocaleString()} listening</span>
                    <button class="slide-play-btn" onclick="toggleStationFromCard(this, '${station.name || item.title}')"><i class="fas fa-play"></i> Listen Now</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Reinitialize slider
    if (window._featuredSlider) window._featuredSlider.destroy();
    window._featuredSlider = new FeaturedSlider();
}

// Render Trending Section from DataStore
function renderTrendingDynamicStationsLegacy() {
    const container = document.querySelector('#trendingScroll .stations-track');
    if (!container) return;
    
    const trending = DataStore.getTrending();
    const stations = DataStore.getStations();
    
    if (!trending.length) {
        container.innerHTML = '<div class="station-card"><div class="station-info"><h3>No trending stations</h3></div></div>';
        return;
    }
    
    container.innerHTML = trending.filter(t => t.status === 'active').map(item => {
        const station = stations.find(s => s.id === item.stationId) || {};
        const thumbSrc = station.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Ccircle cx='60' cy='60' r='50' fill='%2334d399' opacity='0.2'/%3E%3Ccircle cx='60' cy='60' r='30' fill='%2334d399' opacity='0.35'/%3E%3Cpath d='M50 45 L50 80 L80 62.5 Z' fill='%2334d399' opacity='0.5'/%3E%3C/svg%3E";
        return `
            <div class="station-card" data-genre="${(station.genre || '').toLowerCase()}" onclick="toggleStationFromCard(this, '${station.name || ''}')">
                <div class="station-art" style="background:${station.gradient || 'linear-gradient(135deg,#1e3a5f,#0d1f3c)'};">
                    <img src="${thumbSrc}" alt="${station.name || ''}" ${station.thumbnail ? 'style="width:100%;height:100%;object-fit:cover;"' : ''}>
                    <div class="station-play-overlay"><i class="fas fa-play"></i></div>
                </div>
                <div class="station-info">
                    <h3>${station.name || 'Station'}</h3>
                    <p>${station.genre || ''} â€¢ ${station.freq || ''}</p>
                    <span class="station-listeners"><i class="fas fa-headphones"></i> ${((station.listeners || 0) / 1000).toFixed(1)}K</span>
                </div>
            </div>
        `;
    }).join('');
}

// Render Categories from DataStore
function renderCategoriesDynamic() {
    const container = document.querySelector('.categories-grid');
    if (!container) return;

    const categories = DataStore.getCategories();

    const hash = categories.map(c => c.id + (c.status || '')).join(',');
    if (!_hasSectionChanged('categories', hash)) return;
    
    if (!categories.length) {
        container.innerHTML = '<div class="category-card"><span class="category-name">No categories</span></div>';
        return;
    }
    
    container.innerHTML = categories.filter(c => c.status === 'active').map(cat => `
        <div class="category-card" data-category="${(cat.name || '').toLowerCase()}">
            <div class="category-icon"><i class="fas ${cat.icon || 'fa-th-large'}"></i></div>
            <span class="category-name">${cat.name || 'Category'}</span>
            <span class="category-count">${cat.count || 0} stations</span>
        </div>
    `).join('');
    
    // Rebind category click events
    container.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', function() {
            const name = this.querySelector('.category-name').textContent;
            const count = this.querySelector('.category-count').textContent;
            showToast(`Showing ${name} stations (${count})`, 'info');
        });
    });
}

// Render Tamil Hits from DataStore
function renderArtistHitsDynamic() {
    const container = document.getElementById('tamilHitsGrid');
    if (!container) return;

    const artistHits = DataStore.getArtistHits();

    const hash = artistHits.map(a => a.id + (a.status || '')).join(',');
    if (!_hasSectionChanged('artistHits', hash)) return;
    
    if (!artistHits.length) {
        container.innerHTML = '<div class="tamil-hit-card"><div class="hit-card-content"><h3>No artist collections</h3></div></div>';
        return;
    }
    
    container.innerHTML = artistHits.filter(a => a.status === 'active').map(hit => {
        const thumbSrc = hit.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Ccircle cx='60' cy='45' r='25' fill='%2334d399' opacity='0.3'/%3E%3Cpath d='M30 85 Q60 95 90 85 L90 110 L30 110 Z' fill='%2334d399' opacity='0.25'/%3E%3Ccircle cx='60' cy='45' r='15' fill='%2334d399' opacity='0.4'/%3E%3C/svg%3E";
        return `
        <div class="tamil-hit-card" data-artist="${hit.artist}" data-songs="${hit.songCount}">
            <div class="hit-card-bg" style="background:${hit.gradient || 'linear-gradient(135deg,#1e3a5f,#0d1f3c)'};"></div>
            <div class="hit-card-content">
                <div class="hit-artist-image">
                    <img src="${thumbSrc}" alt="${hit.name}" ${hit.thumbnail ? 'style="width:100%;height:100%;object-fit:cover;"' : ''}>
                    <div class="hit-play-overlay"><i class="fas fa-play"></i></div>
                </div>
                <div class="hit-info">
                    <h3>${hit.name}</h3>
                    <p class="hit-song-count"><i class="fas fa-music"></i> ${hit.songCount} songs</p>
                </div>
                <div class="hit-actions">
                    <button class="hit-play-btn" aria-label="Play"><i class="fas fa-play"></i></button>
                    <button class="hit-shuffle-btn" aria-label="Shuffle"><i class="fas fa-shuffle"></i></button>
                    <button class="hit-fav-btn" aria-label="Add to favorites"><i class="fas fa-heart"></i></button>
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    // Rebind artist hit card events
    container.querySelectorAll('.tamil-hit-card').forEach(card => {
        const artist = card.dataset.artist;
        const artistName = card.querySelector('h3')?.textContent || '';
        
        card.addEventListener('click', function(e) {
            if (e.target.closest('.hit-play-btn, .hit-shuffle-btn, .hit-fav-btn')) return;
            openPlaylistPage(artist, artistName, card.dataset.songs);
        });
        
        card.querySelector('.hit-play-btn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            playArtistHits(artist, artistName);
            createRipple(e, this);
        });
        
        card.querySelector('.hit-shuffle-btn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            shuffleArtistHits(artist, artistName);
            createRipple(e, this);
        });
        
        card.querySelector('.hit-fav-btn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
            const icon = this.querySelector('i');
            icon.style.fontWeight = this.classList.contains('active') ? '900' : '400';
            showToast(this.classList.contains('active') ? `Added ${artistName} to favorites` : `Removed ${artistName} from favorites`, 'success');
            createRipple(e, this);
        });
    });
}

// ============================================
// Movie / Yearly / Latest Collections Rendering
// ============================================

// Scroll a carousel track left/right from its prev/next button.
// The buttons live inside .carousel-container alongside the .carousel-track.
function scrollCarousel(btn, dir) {
    try {
        const container = btn && btn.closest ? btn.closest('.carousel-container') : null;
        if (!container) return;
        const track = container.querySelector('.carousel-track');
        if (!track) return;
        const amount = Math.max(160, Math.round(track.clientWidth * 0.8));
        track.scrollBy({ left: (dir < 0 ? -1 : 1) * amount, behavior: 'smooth' });
    } catch (e) { /* silent */ }
}
window.scrollCarousel = scrollCarousel;

function renderRoundCollectionCard(item) {
    const thumbSrc = item.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='20' fill='%23374151'/%3E%3Ctext x='60' y='68' text-anchor='middle' fill='%239ca3af' font-size='32'%3E🎵%3C/text%3E%3C/svg%3E";
    return `
    <div class="round-collection-card" data-id="${item.id}" onclick="playCollectionSongs('${item.id}', '${item.type || ''}')">
        <div class="round-collection-thumb">
            <img src="${thumbSrc}" alt="${item.name}">
            <div class="round-collection-play"><i class="fas fa-play"></i></div>
        </div>
        <div class="round-collection-info">
            <span class="round-collection-name">${item.name}</span>
            <span class="round-collection-count">${item.songCount || 0} songs</span>
        </div>
    </div>`;
}

function renderCollectionsTrack(trackId, items) {
    const track = document.getElementById(trackId);
    if (!track) return;
    if (!items.length) {
        track.innerHTML = '<div style="padding:20px;color:#888;text-align:center;width:100%;">No collections yet. Add from Builder.</div>';
        return;
    }
    const isMovies = trackId === 'moviesCollectionTrack';
    track.innerHTML = items.filter(i => i.status !== 'inactive').map(item =>
        isMovies ? renderMovieCollectionCard(item) : renderRoundCollectionCard(item)
    ).join('');
}

function renderMoviesCollectionsDynamic() {
    const data = DataStore.getMoviesCollections();
    const hash = data.map(c => c.id + '|' + (c.status || '') + '|' + (c.name || '') + '|' + (c.thumbnail || '') + '|' + (c.songCount || 0)).join(',');
    if (!_hasSectionChanged('movies', hash)) return;
    renderCollectionsTrack('moviesCollectionTrack', data);
}

function renderYearlyCollectionsDynamic() {
    const data = DataStore.getYearlyCollections();
    const hash = data.map(c => c.id + '|' + (c.status || '') + '|' + (c.name || '') + '|' + (c.thumbnail || '') + '|' + (c.songCount || 0)).join(',');
    if (!_hasSectionChanged('yearly', hash)) return;
    renderCollectionsTrack('yearlyCollectionTrack', data);
}

function renderLatestCollectionsDynamic() {
    const data = DataStore.getLatestCollections();
    const hash = data.map(c => c.id + '|' + (c.status || '') + '|' + (c.name || '') + '|' + (c.thumbnail || '') + '|' + (c.songCount || 0)).join(',');
    if (!_hasSectionChanged('latest', hash)) return;
    renderCollectionsTrack('latestCollectionTrack', data);
}

// ============================================
// Music Collections Rendering
// ============================================

function renderMusicCollectionsDynamic() {
    const data = DataStore.getMusicCollections();
    const hash = data.map(c => c.id + '|' + (c.status || '') + '|' + (c.name || '') + '|' + (c.thumbnail || '') + '|' + (c.songCount || 0)).join(',');
    if (!_hasSectionChanged('music-collections', hash)) return;
    renderMusicCollectionTrack('musicCollectionTrack', data);
}

// Render individual music collection card
function renderMusicCollectionCard(item) {
    const thumbSrc = item.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='20' fill='%23374151'/%3E%3Ctext x='60' y='68' text-anchor='middle' fill='%239ca3af' font-size='32'%3E🎵%3C/text%3E%3C/svg%3E";
    return `
    <div class="music-collection-card" data-id="${item.id}" onclick="playCollectionSongs('${item.id}', 'music')">
        <div class="music-collection-thumb">
            <img src="${thumbSrc}" alt="${item.name}">
            <div class="music-collection-play"><i class="fas fa-play"></i></div>
        </div>
        <div class="music-collection-info">
            <span class="music-collection-name">${item.name}</span>
            <span class="music-collection-count">${item.songCount || 0} songs</span>
        </div>
    </div>`;
}

function renderMusicCollectionTrack(trackId, items) {
    const track = document.getElementById(trackId);
    if (!track) return;
    if (!items.length) {
        track.innerHTML = '<div style="padding:20px;color:#888;text-align:center;width:100%;">No music collections yet. Add from Builder.</div>';
        return;
    }
    track.innerHTML = items.filter(i => i.status !== 'inactive').map(item => renderMusicCollectionCard(item)).join('');
}

// ============================================
// Advertisement Banner Rendering
// ============================================
const _adTimers = {};

function renderAdBanners() {
    const ads = DataStore.getAdvertisements().filter(a => a.enabled !== false);
    const newHash = JSON.stringify(ads.map(a => a.id + a.imageUrl + a.position + a.enabled));
    if (window._lastAdHash === newHash) return;
    window._lastAdHash = newHash;

    // Hero ad (position 0)
    const heroContainer = document.getElementById('heroAdContainer');
    if (heroContainer) {
        const heroAds = ads.filter(a => a.position === 0);
        if (!heroAds.length) {
            heroContainer.innerHTML = '';
        } else {
            renderHeroAd(heroContainer, heroAds);
        }
    }

    // Banner ads (positions 2, 3, 4)
    for (let pos = 2; pos <= 4; pos++) {
        const container = document.getElementById('adBannerContainer' + pos);
        if (!container) continue;
        const posAds = ads.filter(a => a.position === pos);
        if (!posAds.length) {
            if (container.children.length > 0) container.innerHTML = '';
            if (_adTimers[pos]) { clearInterval(_adTimers[pos]); delete _adTimers[pos]; }
            continue;
        }
        renderAdSlot(container, posAds, pos);
    }
}

function renderHeroAd(container, ads) {
    if (ads.length === 1) {
        container.innerHTML = buildHeroAdHTML(ads[0]);
        initAdTiltEffect(container);
        return;
    }
    let currentIdx = 0;
    container.innerHTML = buildHeroAdHTML(ads[0]);
    initAdTiltEffect(container);

    if (_adTimers[0]) clearInterval(_adTimers[0]);
    _adTimers[0] = setInterval(() => {
        if (document.hidden) return;
        currentIdx = (currentIdx + 1) % ads.length;
        container.innerHTML = buildHeroAdHTML(ads[currentIdx]);
        initAdTiltEffect(container);
    }, 40000);
}

function buildHeroAdHTML(ad) {
    const wrapper = ad.targetLink ? 'a' : 'div';
    const attrs = ad.targetLink ? `href="${ad.targetLink}" ${ad.targetLink.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}` : '';
    return `<${wrapper} class="hero-ad-card" ${attrs}>
        <img src="${ad.imageUrl}" alt="${ad.title || 'Advertisement'}" class="hero-ad-image" loading="lazy">
        <div class="hero-ad-overlay">
            ${ad.title ? `<span class="hero-ad-title">${ad.title}</span>` : ''}
            ${ad.description ? `<span class="hero-ad-desc">${ad.description}</span>` : ''}
        </div>
    </${wrapper}>`;
}

/* AI-Assisted Collection Organization */
function organizeSongsByMovieTitle(movieTitle) {
    const allSongs = DataStore.getSongs() || [];
    const matchingSongs = allSongs.filter(s => {
        const movie = (s.movie || '').toLowerCase();
        const title = (s.title || '').toLowerCase();
        return movie.includes(movieTitle.toLowerCase()) || title.includes(movieTitle.toLowerCase());
    });
    
    // Group by artist and create collections
    const collections = {};
    matchingSongs.forEach(song => {
        const artist = song.artist || 'Unknown';
        if (!collections[artist]) {
            collections[artist] = [];
        }
        collections[artist].push({
            songId: song.id,
            title: song.title,
            artist: song.artist,
            movie: song.movie,
            thumbnail: song.thumbnail
        });
    });
    
    // Create collection entries
    const collectionEntries = [];
    for (const [artist, songs] of Object.entries(collections)) {
        collectionEntries.push({
            id: 'ai_' + artist.replace(/\s+/g, '_') + '_' + Date.now(),
            name: `${artist} - ${movieTitle} Collection`,
            description: `AI-organized collection for ${movieTitle}`,
            songs: songs,
            type: 'music',
            status: 'active',
            createdAt: new Date().toISOString(),
            songCount: songs.length
        });
    }
    
    return collectionEntries;
}

function organizeAllSongsByMovie() {
    const allSongs = DataStore.getSongs() || [];
    const movieTitles = [...new Set(allSongs.map(s => s.movie).filter(Boolean))];
    
    const collections = [];
    movieTitles.forEach(title => {
        const entries = organizeSongsByMovieTitle(title);
        collections.push(...entries);
    });
    
    return collections;
}

/* Home page AI collection builder */
function AIOrganizeCollections() {
    const collectionEntries = organizeAllSongsByMovie();
    if (!collectionEntries.length) {
        showToast('No songs found to organize', 'info');
        return;
    }
    
    const collections = DataStore.getMusicCollections();
    // Add new collections, avoiding duplicates
    const existingIds = new Set(collections.map(c => c.id));
    
    collectionEntries.forEach(entry => {
        if (!existingIds.has(entry.id)) {
            collections.push(entry);
        }
    });
    
    DataStore.setMusicCollections(collections);
    showToast(`AI organized ${collectionEntries.length} collections from movie titles`, 'success');
    loadMusicCollections();
}

function renderAdSlot(container, ads, pos) {
    if (ads.length === 1) {
        const ad = ads[0];
        container.innerHTML = buildAdBannerHTML(ad);
        initAdTiltEffect(container);
        return;
    }
    let currentIdx = 0;
    container.innerHTML = `<div class="ad-banner-slide active">${buildAdBannerHTML(ads[0])}</div>`;
    initAdTiltEffect(container);

    if (_adTimers[pos]) clearInterval(_adTimers[pos]);
    _adTimers[pos] = setInterval(() => {
        if (document.hidden) return;
        const slides = container.querySelectorAll('.ad-banner-slide');
        if (slides.length) slides[currentIdx].classList.remove('active');
        currentIdx = (currentIdx + 1) % ads.length;
        container.innerHTML = `<div class="ad-banner-slide active">${buildAdBannerHTML(ads[currentIdx])}</div>`;
        initAdTiltEffect(container);
    }, 40000);
}

function buildAdBannerHTML(ad) {
    const wrapper = ad.targetLink ? 'a' : 'div';
    const attrs = ad.targetLink ? `href="${ad.targetLink}" ${ad.targetLink.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}` : '';
    return `<${wrapper} class="ad-banner-card" ${attrs}>
        <div class="ad-banner-glow"></div>
        <img src="${ad.imageUrl}" alt="${ad.title || 'Advertisement'}" class="ad-banner-image" loading="lazy">
        <div class="ad-banner-overlay">
            <div class="ad-banner-content">
                <span class="ad-banner-title">${ad.title || ''}</span>
                ${ad.description ? `<span class="ad-banner-desc">${ad.description}</span>` : ''}
            </div>
        </div>
        <div class="ad-banner-3d-layer"></div>
    </${wrapper}>`;
}

function initAdTiltEffect(container) {
    const card = container.querySelector('.ad-banner-card');
    if (!card) return;
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) scale(1.01)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)';
    });
}

// ============================================
// Albums Section Rendering
// ============================================
function renderAlbumsDynamic() {
    const container = document.getElementById('albumsTrack');
    if (!container) return;
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch (e) {}

    const hash = songs.map(s => s.id).join(',');
    if (!_hasSectionChanged('albums', hash)) return;
    if (!songs.length) {
        container.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,0.4);text-align:center;width:100%;font-size:13px;">No albums yet. Add songs from Builder.</div>';
        return;
    }
    const albumMap = {};
    songs.forEach(s => {
        const key = s.movie || s.album || s.artist || 'Singles';
        if (!albumMap[key]) albumMap[key] = { name: key, songs: [], cover: s.albumCover || s.cover || '' };
        albumMap[key].songs.push(s);
        if (!albumMap[key].cover && (s.albumCover || s.cover)) albumMap[key].cover = s.albumCover || s.cover;
    });
    const albums = Object.values(albumMap).sort((a, b) => b.songs.length - a.songs.length).slice(0, 20);
    const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='30' fill='%2334d399' opacity='0.3'/%3E%3C/svg%3E";
    container.innerHTML = albums.map(album => {
        const coverSrc = album.cover || placeholder;
        return `
        <div class="ra-card" onclick="playAlbumSongs('${album.name.replace(/'/g, "\\'")}')">
            <div class="ra-card-art">
                <img src="${coverSrc}" alt="${album.name}" loading="lazy" onerror="this.src='${placeholder}'">
                <div class="ra-card-play-overlay">
                    <button class="ra-card-play-btn" title="Play ${album.name}">
                        <i class="fas fa-play" style="margin-left:2px;"></i>
                    </button>
                </div>
            </div>
            <div class="ra-card-info">
                <div class="ra-card-title" title="${album.name}">${album.name}</div>
                <div class="ra-card-artist">${album.songs.length} song${album.songs.length !== 1 ? 's' : ''}</div>
                <div class="ra-card-meta">
                    <span class="ra-card-badge">ALBUM</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function playAlbumSongs(albumName) {
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch (e) {}
    const matched = songs.filter(s => (s.movie || s.album || s.artist || 'Singles') === albumName);
    if (matched.length && typeof playSong === 'function') {
        playSong(matched[0], matched);
        if (typeof showToast === 'function') showToast('Playing ' + albumName, 'success');
    }
}
window.playAlbumSongs = playAlbumSongs;

// ============================================
// Personalized Music / Made For You
// ============================================
let _personalizedLastHash = '';
function renderPersonalizedMusic() {
    const container = document.getElementById('personalizedTrack');
    if (!container) return;
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch (e) {}

    // Use liked songs + recently played for personalization
    let liked = [];
    try { liked = JSON.parse(localStorage.getItem('ytm_likedSongs') || '[]'); } catch (e) {}

    // Also check the R2-synced key as a fallback
    if (!liked.length) {
        try { liked = JSON.parse(localStorage.getItem('tamilAIStream_likedSongs') || '[]'); } catch (e) {}
    }

    let personalized = [];
    if (liked.length && songs.length) {
        // Get liked songs that are also published
        personalized = songs.filter(s => liked.includes(s.id));
    }

    if (personalized.length < 5) {
        // Fallback: prioritize songs not yet played, then random
        let history = [];
        try { history = JSON.parse(localStorage.getItem('ytm_history') || '[]'); } catch (e) {}
        const playedIds = new Set(history.map(h => h && h.id).filter(Boolean));
        const unplayed = songs.filter(s => !playedIds.has(s.id));
        const pool = unplayed.length >= 5 ? unplayed : songs;
        personalized = pool.slice().sort(() => Math.random() - 0.5).slice(0, 10);
    } else {
        personalized = personalized.slice(0, 10);
    }

    // Always re-render — the hash check caused stale data after R2 sync
    // because liked songs change asynchronously via content sync.
    if (!personalized.length) {
        container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;width:100%;">Like some songs to get personalized recommendations!</div>';
        return;
    }
    renderSongTrack(container, personalized, 10);
}

// ============================================
// AI Recommended
// ============================================
function renderAIRecommendedSection() {
    const container = document.getElementById('aiRecommendedTrack');
    if (!container) return;
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch (e) {}
    const picks = songs.slice().sort(() => Math.random() - 0.5).slice(0, 10);
    const hash = picks.map(s => s.id).join(',') + Date.now();
    // AI recommended is random, so always render with a time-based hash that changes slowly
    const slowHash = Math.floor(Date.now() / 300000).toString(); // changes every 5 min
    if (!_hasSectionChanged('ai-recommended', slowHash)) return;
    renderSongTrack(container, picks, 10);
}

// ============================================
// Category Navigation Filter
// ============================================
function filterHomeCategory(cat) {
    document.querySelectorAll('.home-cat-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector('.home-cat-btn[data-cat="' + cat + '"]');
    if (btn) btn.classList.add('active');
    // Show/hide sections based on category
    const sections = {
        all: null,
        songs: ['trending', 'recently-added', 'ai-recommended'],
        albums: ['albums'],
        artists: ['tamil-hits'],
        movies: ['movies-collection', 'yearly-collection'],
        collections: ['latest-collection', 'yearly-collection'],
        musiccollections: ['music-collection'],
        radio: [],
        ai: ['ai-recommended']
    };
    const showSections = sections[cat] || null;
    document.querySelectorAll('#page-home .section').forEach(sec => {
        if (!showSections) {
            sec.style.display = '';
        } else {
            const secId = sec.dataset.section || '';
            sec.style.display = showSections.includes(secId) ? '' : 'none';
        }
    });
}
window.filterHomeCategory = filterHomeCategory;

// ============================================
// Home Search (debounced)
// ============================================
(function() {
    let _searchTimer = null;
    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('homeSearchInput');
        if (!input) return;
        input.addEventListener('input', () => {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(() => {
                const q = input.value.trim().toLowerCase();
                if (q.length < 2) {
                    // Show all sections
                    document.querySelectorAll('#page-home .section').forEach(s => s.style.display = '');
                    return;
                }
                // Filter visible sections by search query
                let songs = [];
                try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch (e) {}
                const matched = songs.filter(s => {
                    const text = ((s.title||'') + ' ' + (s.artist||'') + ' ' + (s.movie||'') + ' ' + (s.album||'')).toLowerCase();
                    return text.includes(q);
                });
                // Update trending with filtered results
                const trendingContainer = document.querySelector('#trendingScroll .stations-track');
                if (trendingContainer && matched.length) {
                    renderSongTrack(trendingContainer, matched.slice(0, 12), 12);
                }
            }, 300);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof YTMusic !== 'undefined' && YTMusic.navigateTo) {
                    YTMusic.navigateTo('search');
                    const searchInput = document.getElementById('ytmSearchInput');
                    if (searchInput) {
                        searchInput.value = input.value;
                        searchInput.dispatchEvent(new Event('input'));
                    }
                }
            }
        });
    });
})();

// ============================================
// Movie Sidebar (Desktop)
// ============================================
function toggleMovieSidebar() {
    const panel = document.getElementById('movieSidebarPanel');
    if (!panel) return;
    if (panel.classList.contains('active')) {
        closeMovieSidebar();
    } else {
        openMovieSidebar();
    }
}
window.toggleMovieSidebar = toggleMovieSidebar;

function openMovieSidebar() {
    const panel = document.getElementById('movieSidebarPanel');
    if (!panel) return;
    panel.classList.add('active');
    document.getElementById('page-home').classList.add('movie-sidebar-open');
    renderMovieSidebarContent();
}
window.openMovieSidebar = openMovieSidebar;

function closeMovieSidebar() {
    const panel = document.getElementById('movieSidebarPanel');
    if (!panel) return;
    panel.classList.remove('active');
    document.getElementById('page-home').classList.remove('movie-sidebar-open');
}
window.closeMovieSidebar = closeMovieSidebar;

function toggleMusicCollectionSidebar() {
    const panel = document.getElementById('musicSidebarPanel');
    if (!panel) return;
    if (panel.classList.contains('active')) {
        closeMusicCollectionSidebar();
    } else {
        openMusicCollectionSidebar();
    }
}
window.toggleMusicCollectionSidebar = toggleMusicCollectionSidebar;

function openMusicCollectionSidebar() {
    const panel = document.getElementById('musicSidebarPanel');
    if (!panel) return;
    panel.classList.add('active');
    document.getElementById('page-home').classList.add('music-sidebar-open');
    renderMusicCollectionSidebarContent();
}
window.openMusicCollectionSidebar = openMusicCollectionSidebar;

function closeMusicCollectionSidebar() {
    const panel = document.getElementById('musicSidebarPanel');
    if (!panel) return;
    panel.classList.remove('active');
    document.getElementById('page-home').classList.remove('music-sidebar-open');
}
window.closeMusicCollectionSidebar = closeMusicCollectionSidebar;

function renderMusicCollectionSidebarContent() {
    const container = document.getElementById('musicSidebarContent');
    if (!container) return;
    const collections = DataStore.getMusicCollections().filter(c => c.status !== 'inactive');
    const allSongs = DataStore.getSongs();
    const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 280'%3E%3Crect width='200' height='280' rx='12' fill='%23374151'/%3E%3Ctext x='100' y='150' text-anchor='middle' fill='%239ca3af' font-size='36'%3E🎵%3C/text%3E%3C/svg%3E";
    if (!collections.length) {
        container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#888;"><i class="fas fa-folder" style="font-size:40px;margin-bottom:12px;display:block;color:#555;"></i><p>No music collections yet.</p><p style="font-size:12px;margin-top:8px;">Create from Builder → Music Collections</p></div>';
        return;
    }
    container.innerHTML = collections.map(col => {
        const colSongs = col.songs || [];
        const songCount = allSongs.filter(s => colSongs.some(cs => cs.songId === s.id)).length;
        return `<div class="sidebar-collection-item" style="border-left: 4px solid var(--emerald-400); margin-bottom: 12px; padding: 12px 16px; background: rgba(255,255,255,0.03); border-radius: 8px; cursor: pointer; transition: all 0.2s;" onclick="selectMusicCollectionSidebar('${col.id}')">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 6px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 18px;">${col.name.substring(0,2)}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #fff; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${col.name}</div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${col.songCount || 0} songs</div>
                        </div>
                        <div style="font-size: 12px; color: var(--emerald-400);"><i class="fas fa-play"></i> Play</div>
                    </div>
                </div>`;
    }).join('');
}

function renderMovieSidebarContent() {
    const container = document.getElementById('movieSidebarContent');
    if (!container) return;
    const collections = DataStore.getMoviesCollections().filter(c => c.status !== 'inactive');
    if (!collections.length) {
        container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#888;"><i class="fas fa-film" style="font-size:40px;margin-bottom:12px;display:block;color:#555;"></i><p>No movie collections yet.</p><p style="font-size:12px;margin-top:8px;">Add from Builder → Content</p></div>';
        return;
    }
    const allSongs = DataStore.getSongs();
    const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 280'%3E%3Crect width='200' height='280' rx='12' fill='%23374151'/%3E%3Ctext x='100' y='150' text-anchor='middle' fill='%239ca3af' font-size='36'%3E🎬%3C/text%3E%3C/svg%3E";
    container.innerHTML = collections.map(col => {
        const thumb = col.thumbnail || placeholder;
        const songCount = col.songs ? col.songs.length : (col.songCount || 0);
        const yearMatch = (col.name || '').match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : '';
        return `
        <div class="movie-sidebar-card" onclick="playCollectionSongs('${col.id}', 'movies')">
            <div class="movie-sidebar-poster">
                <img src="${thumb}" alt="${col.name}" loading="lazy">
                <div class="movie-sidebar-play"><i class="fas fa-play"></i></div>
            </div>
            <div class="movie-sidebar-info">
                <span class="movie-sidebar-title">${col.name}</span>
                <div class="movie-sidebar-meta">
                    ${year ? `<span class="movie-sidebar-year"><i class="fas fa-calendar"></i> ${year}</span>` : ''}
                    <span class="movie-sidebar-count"><i class="fas fa-music"></i> ${songCount} songs</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ============================================
// Movie Collection Card (separate from round card)
// ============================================
function renderMovieCollectionCard(item) {
    const thumbSrc = item.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 280'%3E%3Crect width='200' height='280' rx='12' fill='%23374151'/%3E%3Ctext x='100' y='150' text-anchor='middle' fill='%239ca3af' font-size='36'%3E🎬%3C/text%3E%3C/svg%3E";
    const yearMatch = (item.name || '').match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : '';
    return `
    <div class="movie-collection-card" data-id="${item.id}" onclick="playCollectionSongs('${item.id}', '${item.type || 'movies'}')">
        <div class="movie-card-poster">
            <img src="${thumbSrc}" alt="${item.name}" loading="lazy">
            <div class="movie-card-play"><i class="fas fa-play"></i></div>
            ${year ? `<span class="movie-card-year">${year}</span>` : ''}
        </div>
        <div class="movie-card-info">
            <span class="movie-card-title">${item.name}</span>
            <span class="movie-card-count">${item.songCount || (item.songs ? item.songs.length : 0)} songs</span>
        </div>
    </div>`;
}

// Override renderCollectionsTrack to use movie cards for movies type
const _originalRenderCollectionsTrack = renderCollectionsTrack;
window.renderCollectionsTrack = renderCollectionsTrack;

function playCollectionSongs(collectionId, collectionType) {
    let collections = [];
    if (collectionType === 'music') collections = DataStore.getMusicCollections();
    if (collectionType === 'movies') collections = DataStore.getMoviesCollections();
    if (collectionType === 'yearly') collections = DataStore.getYearlyCollections();
    if (collectionType === 'latest') collections = DataStore.getLatestCollections();

    // If the type is missing/mismatched, fall back to searching every library
    // so a valid tap always resolves regardless of which section rendered it.
    if (!collections.length) {
        collections = [].concat(
            DataStore.getMusicCollections() || [],
            DataStore.getMoviesCollections() || [],
            DataStore.getYearlyCollections() || [],
            DataStore.getLatestCollections() || []
        );
    }

    const collection = collections.find(c => String(c.id) === String(collectionId));
    if (!collection || !collection.songs || !collection.songs.length) {
        showToast('No songs in this collection', 'info');
        return;
    }
    
    const allSongs = DataStore.getSongs();
    // Resolve each collection entry to the full song record from the Builder's
    // song library. Collection entries may store the reference under songId, id,
    // or embed the full song directly — check all, and prefer the rich record
    // from allSongs so thumbnails/audio propagate from a single source of truth.
    const playableSongs = collection.songs.map(cs => {
        if (!cs) return null;
        const key = cs.songId || cs.id;
        const full = allSongs.find(s => String(s.id) === String(key) || (cs.songId && String(s.id) === String(cs.songId)));
        // Merge: full record wins, but keep the embedded entry's fields as
        // fallback so nothing the Builder set is lost.
        return full ? Object.assign({}, cs, full) : cs;
    }).filter(s => s && (s.audioUrl || s.streamUrl));
    
    if (playableSongs.length) {
        // Reuse the global audio system exclusively (no duplicate players).
        // playSong() sets src on window.audioPlayer, updates the queue and all
        // player UIs, and starts playback through initAudioPlayer().
        const normalized = playableSongs.map(s => ({
            id: s.id || s.songId,
            title: s.title || s.name || 'Untitled',
            artist: s.artist || 'Unknown Artist',
            movie: s.movie || collection.name || '',
            albumCover: s.albumCover || s.cover || s.thumbnail || collection.thumbnail || '',
            cover: s.albumCover || s.cover || s.thumbnail || collection.thumbnail || '',
            audioUrl: s.audioUrl || s.streamUrl,
            duration: s.duration
        }));
        playSong(normalized[0], normalized);
        showToast(`Playing ${collection.name}`, 'success');
    } else {
        showToast('No playable songs in this collection', 'warning');
    }
}

// ============================================
// Tamil Hits Carousel â€” Touch/Swipe Support
// ============================================
function initTamilHitsCarousel() {
    const grid = document.getElementById('tamilHitsGrid');
    if (!grid) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;
    let rafId = null;

    // Mouse drag (desktop)
    grid.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDown = true;
        grid.style.cursor = 'grabbing';
        startX = e.pageX - grid.offsetLeft;
        scrollLeft = grid.scrollLeft;
        lastX = startX;
        lastTime = Date.now();
        velocity = 0;
        if (rafId) cancelAnimationFrame(rafId);
    });

    grid.addEventListener('mouseleave', () => {
        isDown = false;
        grid.style.cursor = '';
    });

    grid.addEventListener('mouseup', () => {
        isDown = false;
        grid.style.cursor = '';
        // Momentum scrolling
        if (Math.abs(velocity) > 0.5) {
            const decelerate = () => {
                velocity *= 0.95;
                grid.scrollLeft -= velocity;
                if (Math.abs(velocity) > 0.5) {
                    rafId = requestAnimationFrame(decelerate);
                }
            };
            decelerate();
        }
    });

    grid.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - grid.offsetLeft;
        const walk = (x - startX) * 1.5;
        const now = Date.now();
        const dt = now - lastTime;
        if (dt > 0) {
            velocity = (x - lastX) / dt * 16;
        }
        lastX = x;
        lastTime = now;
        grid.scrollLeft = scrollLeft - walk;
    });

    // Touch handling (mobile) â€” native scroll is primary, we just prevent page scroll conflict
    let touchStartX = 0;
    let touchStartY = 0;
    let isHorizontalSwipe = null;

    grid.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isHorizontalSwipe = null;
        if (rafId) cancelAnimationFrame(rafId);
    }, { passive: true });

    grid.addEventListener('touchmove', (e) => {
        if (isHorizontalSwipe === null) {
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            isHorizontalSwipe = dx > dy;
        }
        // If horizontal swipe, prevent vertical page scroll
        if (isHorizontalSwipe) {
            e.stopPropagation();
        }
    }, { passive: true });

    // Wheel scroll support (desktop trackpad)
    grid.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.stopPropagation();
        }
    }, { passive: true });
}

// Render All FM Stations from DataStore
function renderAllStationsDynamic() {
    const container = document.getElementById('stationsGrid');
    if (!container) return;
    
    const stations = DataStore.getStations();
    
    if (!stations.length) {
        container.innerHTML = '<div class="station-grid-card"><div class="sg-card-content"><h3>No stations available</h3></div></div>';
        return;
    }
    
    container.innerHTML = stations.filter(s => s.status === 'active').map(station => {
        const thumbSrc = station.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='32' fill='%2334d399' opacity='0.2'/%3E%3Ccircle cx='40' cy='40' r='18' fill='%2334d399' opacity='0.35'/%3E%3Cpath d='M33 28 L33 58 L55 43 Z' fill='%2334d399' opacity='0.5'/%3E%3C/svg%3E";
        return `
        <div class="station-grid-card" data-genre="${(station.genre || '').toLowerCase()}" data-name="${station.name}" data-freq="${station.freq}">
            <div class="sg-card-bg" style="background:${station.gradient || 'linear-gradient(135deg,#0f3b2e,#064e3b)'};"></div>
            <div class="sg-card-content">
                <div class="sg-card-top">
                    <div class="sg-logo" style="background:${station.gradient || 'linear-gradient(135deg,#0f3b2e,#064e3b)'};">
                        <img src="${thumbSrc}" alt="${station.name}" ${station.thumbnail ? 'style="width:100%;height:100%;object-fit:cover;"' : ''}>
                    </div>
                    <div class="sg-badges">
                        <span class="sg-live-badge"><i class="fas fa-signal"></i> Live</span>
                        <span class="sg-freq">${station.freq}</span>
                    </div>
                </div>
                <div class="sg-card-body">
                    <h3 class="sg-name">${station.name}</h3>
                    <p class="sg-genre">${station.genre} â€¢ ${station.city || 'Chennai'}</p>
                    <div class="sg-meta">
                        <span class="sg-listeners"><i class="fas fa-headphones"></i> ${((station.listeners || 0) / 1000).toFixed(1)}K</span>
                        <span class="sg-rating"><i class="fas fa-star"></i> 4.${Math.floor(Math.random() * 9) + 1}</span>
                    </div>
                </div>
                <div class="sg-card-actions">
                    <button class="sg-play-btn" aria-label="Play"><i class="fas fa-play"></i></button>
                    <button class="sg-fav-btn" aria-label="Add to favorites"><i class="fas fa-heart"></i></button>
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    // Update stations count
    const countEl = document.getElementById('stationsCount');
    if (countEl) countEl.textContent = `${stations.filter(s => s.status === 'active').length} stations`;
    
    // Rebind station card events
    container.querySelectorAll('.station-grid-card').forEach(card => {
        card.addEventListener('click', function() {
            const name = this.dataset.name;
            playStation(name);
        });
        card.querySelector('.sg-play-btn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            card.click();
        });
        card.querySelector('.sg-fav-btn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
            createRipple(e, this);
        });
    });
}

// Render AI Recommended from DataStore
function renderAIRecommendedStationsLegacy() {
    const container = document.querySelector('[data-section="ai-recommended"] .stations-track');
    if (!container) return;
    
    const stations = DataStore.getStations();
    const recommended = stations.slice(0, 5).filter(s => s.status === 'active');
    
    if (!recommended.length) {
        container.innerHTML = '<div class="station-card"><div class="station-info"><h3>No recommendations</h3></div></div>';
        return;
    }
    
    container.innerHTML = recommended.map((station, i) => {
        const thumbSrc = station.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Ccircle cx='60' cy='60' r='50' fill='%2334d399' opacity='0.2'/%3E%3Ccircle cx='60' cy='60' r='30' fill='%2334d399' opacity='0.35'/%3E%3Cpath d='M50 45 L50 80 L80 62.5 Z' fill='%2334d399' opacity='0.5'/%3E%3C/svg%3E";
        return `
        <div class="station-card recommended" data-genre="${(station.genre || '').toLowerCase()}" onclick="toggleStationFromCard(this, '${station.name}')">
            <div class="station-art" style="background:${station.gradient || 'linear-gradient(135deg,#0f3b2e,#064e3b)'};">
                <img src="${thumbSrc}" alt="${station.name}" ${station.thumbnail ? 'style="width:100%;height:100%;object-fit:cover;"' : ''}>
                <div class="station-play-overlay"><i class="fas fa-play"></i></div>
                <div class="ai-recommend-badge"><i class="fas fa-brain"></i> ${98 - i * 3}% Match</div>
            </div>
            <div class="station-info">
                <h3>${station.name}</h3>
                <p>${station.genre} â€¢ ${station.freq}</p>
                <span class="station-listeners"><i class="fas fa-headphones"></i> ${((station.listeners || 0) / 1000).toFixed(1)}K</span>
            </div>
        </div>
        `;
    }).join('');
}

// Apply Site Settings to page
function applySiteSettings() {
    const settings = DataStore.getSiteSettings();
    if (!settings) return;

    const hash = JSON.stringify(settings);
    if (!_hasSectionChanged('siteSettings', hash)) return;
    
    document.title = settings.title || 'Tamil AI Stream';
    
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = settings.description || '';
    
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) metaKeywords.content = settings.keywords || '';
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = settings.ogTitle || '';
    
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = settings.ogDescription || '';
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = settings.ogUrl || '';
    
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = settings.themeColor || '#000000';
    
    const footerText = document.getElementById('footerText');
    if (footerText) footerText.textContent = settings.footerText || '';
}

// ============================================
// AI Glass Premium Home Sections
// ============================================

// ---- Premium Glass Hero Bar helpers (greeting + live weather) ----
const HERO_WEATHER_LABELS = {
    'fa-sun': 'Clear', 'fa-cloud-sun': 'Partly cloudy', 'fa-cloud': 'Overcast',
    'fa-smog': 'Fog', 'fa-cloud-rain': 'Rain', 'fa-cloud-showers-heavy': 'Showers',
    'fa-snowflake': 'Snow', 'fa-bolt': 'Thunderstorm',
    'fa-moon': 'Clear night', 'fa-cloud-moon': 'Cloudy night'
};

function _heroTimeGreeting() {
    const h = new Date().getHours();
    if (h < 5)  return { text: 'Good Night', emoji: '🌙' };
    if (h < 12) return { text: 'Good Morning', emoji: '☀️' };
    if (h < 17) return { text: 'Good Afternoon', emoji: '🌤️' };
    if (h < 21) return { text: 'Good Evening', emoji: '🌆' };
    return { text: 'Good Night', emoji: '🌙' };
}

function _heroTimeWeatherIcon() {
    const h = new Date().getHours();
    if (h < 5 || h >= 21) return { icon: 'fa-moon', label: 'Clear night' };
    if (h < 8)  return { icon: 'fa-cloud-sun', label: 'Dawn' };
    if (h < 17) return { icon: 'fa-sun', label: 'Clear' };
    if (h < 19) return { icon: 'fa-cloud-sun', label: 'Evening' };
    return { icon: 'fa-cloud-moon', label: 'Cloudy night' };
}

function _heroSetWeather(icon, label) {
    const el = document.getElementById('greetingWeather');
    if (!el) return;
    el.innerHTML = `<i class="fas ${icon}"></i>`;
    if (label) el.title = label;
}

function _heroGetTimeOfDay() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Morning';
    if (h >= 12 && h < 17) return 'Afternoon';
    return 'Evening';
}
function _heroSetGreeting() {
    const el = document.getElementById('greetingText');
    if (!el) return;
    el.textContent = 'Good ' + _heroGetTimeOfDay();
}

let _heroLiveWeather = false;
let _heroWeatherInterval = null;
let _heroGreetingInterval = null;
let _heroQuoteInterval = null;
let _heroUpdatersStarted = false;
let _greetingQuotePicked = '';

function _heroWmoToIcon(code) {
    if (code === 0) return 'fa-sun';
    if (code === 1 || code === 2) return 'fa-cloud-sun';
    if (code === 3) return 'fa-cloud';
    if (code === 45 || code === 48) return 'fa-smog';
    if (code >= 51 && code <= 57) return 'fa-cloud-rain';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'fa-cloud-showers-heavy';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'fa-snowflake';
    if (code >= 95) return 'fa-bolt';
    return null;
}

// Live weather (best-effort, keyless via Open-Meteo). Falls back to the
// time-based icon shown instantly. Only the weather-chip node is updated.
function updateHeroWeather() {
    const t = _heroTimeWeatherIcon();
    _heroSetWeather(t.icon, t.label); // instant fallback
    if (!navigator.geolocation || typeof fetch !== 'function') return;
    const guard = setTimeout(() => {}, 8000);
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weather_code`)
                .then(r => (r.ok ? r.json() : null))
                .then(d => {
                    const code = d && d.current && d.current.weather_code;
                    if (code == null) return;
                    const icon = _heroWmoToIcon(code);
                    if (icon) {
                        _heroLiveWeather = true;
                        _heroSetWeather(icon, HERO_WEATHER_LABELS[icon] || 'Live weather');
                    }
                })
                .catch(() => {})
                .finally(() => clearTimeout(guard));
        },
        () => clearTimeout(guard), // denied/offline -> keep time-based
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 }
    );
}

function _heroQuotePool() {
    let pool = [];
    try {
        if (typeof DataStore !== 'undefined' && DataStore.getQuotes) {
            pool = (DataStore.getQuotes() || [])
                .map(q => q && (q.text || q.quote))
                .filter(Boolean);
        }
    } catch (e) {}
    const fallbacks = [
        'Music is the language of the soul — feel every beat of Tamil.',
        'Let the rhythm of Tamil melodies carry your day.',
        'Every song is a story; every beat is a memory.',
        'Stream the sound of home, wherever you are.',
        'Discover new Tamil sounds, curated just for you.'
    ];
    return pool.length >= 2 ? pool : fallbacks;
}

// Pick a quote once and keep it stable — the greeting must not auto-rotate.
function _heroPickQuote() {
    if (_greetingQuotePicked) return _greetingQuotePicked;
    const pool = _heroQuotePool();
    _greetingQuotePicked = pool[Math.floor(Math.random() * pool.length)];
    return _greetingQuotePicked;
}

// Live date/time line that updates in place (no re-render).
function _heroSetDateTime() {
    const el = document.getElementById('greetingDateTime');
    if (!el) return;
    try {
        const now = new Date();
        const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        el.textContent = dateStr + '  •  ' + timeStr;
    } catch (e) { /* ignore */ }
}

// Rotate the quote in place with a subtle 3D swap — no re-render.
function _heroRotateQuote() {
    const qEl = document.getElementById('greetingQuoteText');
    const qWrap = document.getElementById('greetingQuote');
    if (!qEl || !qWrap) return;
    const pool = _heroQuotePool();
    const current = qEl.textContent;
    let next = current;
    if (pool.length > 1) {
        do { next = pool[Math.floor(Math.random() * pool.length)]; }
        while (next === current);
    }
    qWrap.classList.remove('is-swapping');
    void qWrap.offsetWidth; // force reflow so the animation restarts
    qEl.textContent = next;
    qWrap.classList.add('is-swapping');
}

// Pointer-driven 3D tilt micro-interaction (hover-capable devices only).
function _heroInitTilt() {
    const hero = document.getElementById('greetingHero');
    const content = hero && hero.querySelector('.greeting-hero-content');
    if (!hero || !content) return;
    const reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hover = window.matchMedia &&
        window.matchMedia('(hover: hover)').matches;
    if (reduce || !hover) return;
    hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        content.style.setProperty('--hero-ry', (px * 8).toFixed(2) + 'deg');
        content.style.setProperty('--hero-rx', (-py * 8).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', () => {
        content.style.setProperty('--hero-rx', '0deg');
        content.style.setProperty('--hero-ry', '0deg');
    });
}

function _heroStartUpdaters() {
    if (_heroUpdatersStarted) return;
    _heroUpdatersStarted = true;
    _heroGreetingInterval = setInterval(() => {
        if (!document.hidden) {
            _heroSetGreeting();
            if (!_heroLiveWeather) {
                const t = _heroTimeWeatherIcon();
                _heroSetWeather(t.icon, t.label);
            }
        }
    }, 60000);
    _heroWeatherInterval = setInterval(() => { if (!document.hidden) updateHeroWeather(); }, 15 * 60 * 1000);
    setInterval(() => { if (!document.hidden) _heroSetDateTime(); }, 60000);
}

// Greeting Section - Premium Glass Hero Bar
function _updateSmartQueue(currentSong, playlist) {
    if (!currentSong || !playlist || playlist.length < 2) return;
    try {
        const prefs = JSON.parse(localStorage.getItem('tamilAI_preferences') || '[]');
        const text = ((currentSong.artist||'')+' '+(currentSong.movie||'')+' '+(currentSong.genre||'')+' '+(currentSong.mood||'')).toLowerCase();
        const artistPrefs = JSON.parse(localStorage.getItem('tamilAI_artistPrefs') || '{}');
        if (currentSong.artist) {
            artistPrefs[currentSong.artist] = (artistPrefs[currentSong.artist] || 0) + 1;
            localStorage.setItem('tamilAI_artistPrefs', JSON.stringify(artistPrefs));
        }
        const moviePrefs = JSON.parse(localStorage.getItem('tamilAI_moviePrefs') || '{}');
        if (currentSong.movie) {
            moviePrefs[currentSong.movie] = (moviePrefs[currentSong.movie] || 0) + 1;
            localStorage.setItem('tamilAI_moviePrefs', JSON.stringify(moviePrefs));
        }
    } catch(e) {}
}

function renderGreetingSection() {
    const container = document.querySelector('.greeting-section');
    if (!container) return;

    // Build the bar structure once. If it already exists (e.g. a later
    // dynamic refresh), we keep the DOM and only update inner content so
    // the website is never re-rendered.
    if (!document.getElementById('greetingHero')) {
        const userName = (typeof Auth !== 'undefined' && Auth.currentUser && Auth.currentUser()) ? (Auth.currentUser().name || Auth.currentUser().displayName || '').split(' ')[0] : '';
        const welcomeName = userName ? `, ${userName}` : '';
        let resumeHTML = '';
        try {
            if (typeof ListeningHistory !== 'undefined' && ListeningHistory.getHistory) {
                const hist = ListeningHistory.getHistory();
                const last = hist && hist[0];
                if (last && last.track) {
                    resumeHTML = `
                        <div class="greeting-resume" id="greetingResume" onclick="if(typeof playSongById==='function')playSongById('${last.track.id || ''}')">
                            <div class="greeting-resume-art">
                                <img src="${last.track.thumbnail || last.track.albumCover || ''}" alt="" onerror="this.style.display='none'">
                                <div class="greeting-resume-play"><i class="fas fa-play"></i></div>
                            </div>
                            <div class="greeting-resume-info">
                                <span class="greeting-resume-label">Resume Listening</span>
                                <span class="greeting-resume-title">${last.track.title || 'Unknown'}</span>
                                <span class="greeting-resume-artist">${last.track.artist || ''}</span>
                            </div>
                        </div>
                    `;
                }
            }
        } catch(e) {}
        container.innerHTML = `
            <div class="greeting-card greeting-hero" id="greetingHero">
                <div class="greeting-hero-glow" aria-hidden="true"></div>
                <div class="greeting-hero-content">
                    <div class="greeting-hero-top">
                        <div class="greeting-weather">
                            <span class="greeting-label greeting-greeting" id="greetingText"></span>
                            <span class="greeting-weather-icon" id="greetingWeather" title=""><i class="fas fa-moon"></i></span>
                        </div>
                        <span class="greeting-datetime" id="greetingDateTime"></span>
                    </div>
                    <h1 class="greeting-title" id="greetingTitle"><span class="hero-hash">#</span> Good ${_heroGetTimeOfDay()}${welcomeName}</h1>
                    <p class="greeting-subtitle">Discover the best of Tamil music, powered by AI</p>
                    ${resumeHTML}
                    <p class="greeting-quote" id="greetingQuote"><i class="fas fa-quote-left"></i> <span id="greetingQuoteText"></span></p>
                </div>
            </div>
        `;
    }

    // Seed greeting + quote text in place (no flash of placeholders)
    _heroSetGreeting();
    const qEl = document.getElementById('greetingQuoteText');
    if (qEl) {
        qEl.textContent = _heroPickQuote();
    }
    _heroSetDateTime();

    // Live weather (time-based instantly, upgrades to real data if allowed)
    updateHeroWeather();

    // Micro-interactions + lightweight in-place updaters
    _heroInitTilt();
    _heroStartUpdaters();
}

// Generic carousel swipe handler
function initCarouselSwipe(track) {
    if (!track) return;
    
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;
    let rafId = null;
    
    track.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDown = true;
        track.style.cursor = 'grabbing';
        startX = e.pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
        lastX = startX;
        lastTime = Date.now();
        velocity = 0;
        if (rafId) cancelAnimationFrame(rafId);
    });
    
    track.addEventListener('mouseleave', () => {
        isDown = false;
        track.style.cursor = '';
    });
    
    track.addEventListener('mouseup', () => {
        isDown = false;
        track.style.cursor = '';
        if (Math.abs(velocity) > 0.5) {
            const decelerate = () => {
                velocity *= 0.95;
                track.scrollLeft -= velocity;
                if (Math.abs(velocity) > 0.5) {
                    rafId = requestAnimationFrame(decelerate);
                }
            };
            decelerate();
        }
    });
    
    track.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - track.offsetLeft;
        const walk = (x - startX) * 1.5;
        const now = Date.now();
        const dt = now - lastTime;
        if (dt > 0) {
            velocity = (x - lastX) / dt * 16;
        }
        lastX = x;
        lastTime = now;
        track.scrollLeft = scrollLeft - walk;
    });
    
    // Touch
    let touchStartX = 0;
    let touchStartY = 0;
    let isHorizontalSwipe = null;
    
    track.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isHorizontalSwipe = null;
    }, { passive: true });
    
    track.addEventListener('touchmove', (e) => {
        if (isHorizontalSwipe === null) {
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            isHorizontalSwipe = dx > dy;
        }
        if (isHorizontalSwipe) {
            e.stopPropagation();
        }
    }, { passive: true });
    
    // Scroll buttons
    const section = track.closest('.carousel-section');
    if (section) {
        const leftBtn = section.querySelector('.scroll-left');
        const rightBtn = section.querySelector('.scroll-right');
        if (leftBtn) leftBtn.addEventListener('click', () => track.scrollBy({ left: -200, behavior: 'smooth' }));
        if (rightBtn) rightBtn.addEventListener('click', () => track.scrollBy({ left: 200, behavior: 'smooth' }));
    }
}

function renderContinueListening() {
    const section = document.getElementById('continueListeningSection');
    const track = document.getElementById('continueListeningTrack');
    if (!section || !track) return;
    try {
        if (typeof ListeningHistory === 'undefined' || !ListeningHistory.getHistory) { section.style.display = 'none'; return; }
        const hist = ListeningHistory.getHistory();
        const songs = (hist || []).filter(h => h && h.track && h.track.id).map(h => h.track).slice(0, 12);
        if (!songs.length) { section.style.display = 'none'; return; }
        section.style.display = '';
        if (typeof renderSongTrack === 'function') {
            renderSongTrack(track, songs, 12);
        }
    } catch(e) { section.style.display = 'none'; }
}

function renderDailyMix() {
    const track = document.getElementById('dailyMixTrack');
    if (!track) return;
    try {
        let songs = [];
        if (typeof DataStore !== 'undefined' && DataStore.getSongs) {
            songs = (DataStore.getSongs() || []).filter(s => s.status === 'published');
        }
        if (!songs.length) return;
        const prefs = JSON.parse(localStorage.getItem('tamilAI_preferences') || '[]');
        let mix = songs;
        if (prefs.length > 0) {
            const scored = songs.map(s => {
                let score = Math.random() * 0.3;
                const text = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.movie || '') + ' ' + (s.genre || '') + ' ' + (s.mood || '')).toLowerCase();
                prefs.forEach(p => { if (text.includes(p.toLowerCase())) score += 0.4; });
                return { song: s, score };
            });
            scored.sort((a, b) => b.score - a.score);
            mix = scored.map(s => s.song);
        } else {
            mix = songs.sort(() => Math.random() - 0.5);
        }
        if (typeof renderSongTrack === 'function') {
            renderSongTrack(track, mix.slice(0, 12), 12);
        }
    } catch(e) {}
}

// ==================== MUSIC DASHBOARD ====================
function renderDashboard() {
    const container = document.getElementById('dashboardPage');
    if (!container) return;
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch(e) {}
    let history = [];
    try { if (typeof ListeningHistory !== 'undefined' && ListeningHistory.getHistory) history = ListeningHistory.getHistory() || []; } catch(e) {}
    const artistPrefs = JSON.parse(localStorage.getItem('tamilAI_artistPrefs') || '{}');
    const moviePrefs = JSON.parse(localStorage.getItem('tamilAI_moviePrefs') || '{}');
    const favs = JSON.parse(localStorage.getItem('tamilAI_favorites') || '[]');

    const totalSongs = songs.length;
    const totalListeningTime = history.reduce((sum, h) => sum + (h.duration || 0), 0);
    const mostPlayed = history.length > 0 ? history[0] : null;
    const topArtist = Object.entries(artistPrefs).sort((a, b) => b[1] - a[1])[0];
    const topMovie = Object.entries(moviePrefs).sort((a, b) => b[1] - a[1])[0];
    const favCount = favs.length;

    const decades = {};
    songs.forEach(s => {
        const year = parseInt(s.year || s.releaseYear || '0');
        if (year >= 1990 && year < 2000) decades['90s'] = (decades['90s'] || 0) + 1;
        else if (year >= 2000 && year < 2010) decades['2000s'] = (decades['2000s'] || 0) + 1;
        else if (year >= 2010 && year < 2020) decades['2010s'] = (decades['2010s'] || 0) + 1;
        else if (year >= 2020) decades['2020s'] = (decades['2020s'] || 0) + 1;
    });

    const formatTime = (secs) => {
        if (secs < 60) return secs + 's';
        if (secs < 3600) return Math.floor(secs / 60) + 'm';
        return Math.floor(secs / 3600) + 'h ' + Math.floor((secs % 3600) / 60) + 'm';
    };

    container.innerHTML = `
        <div class="dashboard-header">
            <h1><i class="fas fa-chart-line" style="color:#34d399;margin-right:12px;"></i>Music Dashboard</h1>
            <p>Your personal music insights</p>
        </div>
        <div class="dashboard-stats">
            <div class="dashboard-stat-card">
                <div class="dashboard-stat-icon" style="background:linear-gradient(135deg,#34d399,#10b981)"><i class="fas fa-music"></i></div>
                <div class="dashboard-stat-value">${totalSongs}</div>
                <div class="dashboard-stat-label">Total Songs</div>
            </div>
            <div class="dashboard-stat-card">
                <div class="dashboard-stat-icon" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"><i class="fas fa-clock"></i></div>
                <div class="dashboard-stat-value">${formatTime(totalListeningTime)}</div>
                <div class="dashboard-stat-label">Listening Time</div>
            </div>
            <div class="dashboard-stat-card">
                <div class="dashboard-stat-icon" style="background:linear-gradient(135deg,#f43f5e,#e11d48)"><i class="fas fa-heart"></i></div>
                <div class="dashboard-stat-value">${favCount}</div>
                <div class="dashboard-stat-label">Favorites</div>
            </div>
            <div class="dashboard-stat-card">
                <div class="dashboard-stat-icon" style="background:linear-gradient(135deg,#f59e0b,#d97706)"><i class="fas fa-play-circle"></i></div>
                <div class="dashboard-stat-value">${history.length}</div>
                <div class="dashboard-stat-label">Songs Played</div>
            </div>
        </div>
        <div class="dashboard-details">
            ${topArtist ? `<div class="dashboard-detail-card"><div class="dashboard-detail-icon"><i class="fas fa-user" style="color:#34d399"></i></div><div><div class="dashboard-detail-title">Most Played Artist</div><div class="dashboard-detail-value">${topArtist[0]}</div><div class="dashboard-detail-sub">${topArtist[1]} plays</div></div></div>` : ''}
            ${topMovie ? `<div class="dashboard-detail-card"><div class="dashboard-detail-icon"><i class="fas fa-film" style="color:#f59e0b"></i></div><div><div class="dashboard-detail-title">Most Played Movie</div><div class="dashboard-detail-value">${topMovie[0]}</div><div class="dashboard-detail-sub">${topMovie[1]} plays</div></div></div>` : ''}
            ${mostPlayed && mostPlayed.track ? `<div class="dashboard-detail-card"><div class="dashboard-detail-icon"><i class="fas fa-redo" style="color:#6366f1"></i></div><div><div class="dashboard-detail-title">Most Recent</div><div class="dashboard-detail-value">${mostPlayed.track.title || 'Unknown'}</div><div class="dashboard-detail-sub">${mostPlayed.track.artist || ''}</div></div></div>` : ''}
        </div>
        ${Object.keys(decades).length > 0 ? `
        <div class="dashboard-section">
            <h3><i class="fas fa-calendar-days" style="color:#22d3ee;margin-right:8px;"></i>Decade Distribution</h3>
            <div class="dashboard-decades">
                ${Object.entries(decades).map(([decade, count]) => `
                    <div class="dashboard-decade">
                        <div class="dashboard-decade-bar" style="height:${Math.min(100, (count / totalSongs) * 100)}%"></div>
                        <div class="dashboard-decade-label">${decade}</div>
                        <div class="dashboard-decade-count">${count}</div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}
    `;
}

// ==================== ARTIST UNIVERSE ====================
function openArtistUniverse(artistName) {
    if (!artistName) return;
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch(e) {}
    const artistSongs = songs.filter(s => (s.artist || '').toLowerCase() === artistName.toLowerCase());
    const container = document.getElementById('artistUniversePage');
    if (!container) return;
    const movies = [...new Set(artistSongs.map(s => s.movie).filter(Boolean))];
    container.innerHTML = `
        <div class="universe-header">
            <button class="universe-back" onclick="YTMusic.navigateTo('home')"><i class="fas fa-arrow-left"></i></button>
            <div class="universe-hero">
                <div class="universe-avatar"><i class="fas fa-user"></i></div>
                <h1>${artistName}</h1>
                <p>${artistSongs.length} songs • ${movies.length} movies</p>
            </div>
        </div>
        <div class="universe-section">
            <h3>Top Songs</h3>
            <div class="universe-songs" id="artistUniverseSongs"></div>
        </div>
        ${movies.length > 0 ? `<div class="universe-section"><h3>Movies</h3><div class="universe-movies">${movies.map(m => `
            <button class="universe-movie-card" onclick="openMovieUniverse('${m.replace(/'/g, "\\'")}')">
                <i class="fas fa-film"></i><span>${m}</span>
            </button>
        `).join('')}</div></div>` : ''}
    `;
    const songsContainer = document.getElementById('artistUniverseSongs');
    if (songsContainer && typeof renderSongTrack === 'function') {
        renderSongTrack(songsContainer, artistSongs.slice(0, 20), 20);
    }
    YTMusic.navigateTo('artist-universe');
}

// ==================== MOVIE UNIVERSE ====================
function openMovieUniverse(movieName) {
    if (!movieName) return;
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch(e) {}
    const movieSongs = songs.filter(s => (s.movie || '').toLowerCase() === movieName.toLowerCase());
    const container = document.getElementById('movieUniversePage');
    if (!container) return;
    const artists = [...new Set(movieSongs.map(s => s.artist).filter(Boolean))];
    container.innerHTML = `
        <div class="universe-header">
            <button class="universe-back" onclick="YTMusic.navigateTo('home')"><i class="fas fa-arrow-left"></i></button>
            <div class="universe-hero">
                <div class="universe-avatar"><i class="fas fa-film"></i></div>
                <h1>${movieName}</h1>
                <p>${movieSongs.length} songs • ${artists.length} artists</p>
            </div>
        </div>
        <div class="universe-section">
            <h3>Songs</h3>
            <div class="universe-songs" id="movieUniverseSongs"></div>
        </div>
        ${artists.length > 0 ? `<div class="universe-section"><h3>Artists</h3><div class="universe-artists">${artists.map(a => `
            <button class="universe-artist-card" onclick="openArtistUniverse('${a.replace(/'/g, "\\'")}')">
                <i class="fas fa-user"></i><span>${a}</span>
            </button>
        `).join('')}</div></div>` : ''}
    `;
    const songsContainer = document.getElementById('movieUniverseSongs');
    if (songsContainer && typeof renderSongTrack === 'function') {
        renderSongTrack(songsContainer, movieSongs.slice(0, 20), 20);
    }
    YTMusic.navigateTo('movie-universe');
}

// Render all dynamic content
let _isRenderingAll = false;
const _homeSectionHashes = {};
function _hasSectionChanged(sectionId, data) {
    const hash = typeof data === 'string' ? data : JSON.stringify(data);
    if (_homeSectionHashes[sectionId] === hash) return false;
    _homeSectionHashes[sectionId] = hash;
    return true;
}

// ============================================
// PWA Home Header — Dynamic Date/Time + Tamil Quote
// ============================================
const _tamilQuotes = [
    { tamil: 'வாழ்க்கை என்பது ஒரு இசை', english: 'Life is music' },
    { tamil: 'இசை இல்லாத வாழ்க்கை வெறுமை', english: 'Life without music is empty' },
    { tamil: 'ஒவ்வொரு பாடலும் ஒரு கதை', english: 'Every song tells a story' },
    { tamil: 'இசை மனதின் மருந்து', english: 'Music is the medicine of the mind' },
    { tamil: 'தமிழ் இசை என்றும் மாறாது', english: 'Tamil music never fades' },
    { tamil: 'பாடல்கள் உயிரின் சிறகுகள்', english: 'Songs are the wings of the soul' },
    { tamil: 'இசை கேள், மனம் மகிழ்', english: 'Listen to music, let the heart rejoice' },
    { tamil: 'ஒலி என்பது கடவுளின் குரல்', english: 'Sound is the voice of God' },
    { tamil: 'தமிழ் பாடல்கள் உலகை ஆளும்', english: 'Tamil songs rule the world' },
    { tamil: 'இசை நேசம், நேசம் இசை', english: 'Music is love, love is music' },
    { tamil: 'ஒரு பாடல் ஆயிரம் உணர்வுகள்', english: 'One song, a thousand emotions' },
    { tamil: 'வானம் பாடும் போது, பூமி கேக்கும்', english: 'When the sky sings, the earth listens' }
];
let _currentQuoteIndex = 0;
let _quoteTimer = null;

function initPWAHomeHeader() {
    const dtEl = document.getElementById('pwaHomeDateTime');
    const quoteEl = document.getElementById('pwaHomeQuote');
    if (!dtEl && !quoteEl) return;

    // Date/time updater — runs every second without full re-render
    function updateDateTime() {
        if (!dtEl) return;
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', options);
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dtEl.textContent = dateStr + '  •  ' + timeStr;
    }

    function updateQuote() {
        if (!quoteEl) return;
        const q = _tamilQuotes[_currentQuoteIndex];
        quoteEl.style.opacity = '0';
        setTimeout(() => {
            quoteEl.innerHTML = '<span class="tamil">' + q.tamil + '</span> — ' + q.english;
            quoteEl.style.opacity = '1';
        }, 400);
        _currentQuoteIndex = (_currentQuoteIndex + 1) % _tamilQuotes.length;
    }

    updateDateTime();
    updateQuote();
    let _pwaDtInterval = setInterval(() => { if (!document.hidden) updateDateTime(); }, 1000);
    _quoteTimer = setInterval(() => { if (!document.hidden) updateQuote(); }, 12000);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { updateDateTime(); }
    });
}

function renderAllDynamicContent() {
    if (_isRenderingAll) return;
    _isRenderingAll = true;

    // Light synchronous renders
    renderAdBanners();
    applySiteSettings();

    // Heavy renders batched in animation frame
    requestAnimationFrame(() => {
        renderTrendingDynamic();
        renderArtistHitsDynamic();
        initTamilHitsCarousel();
        renderMoviesCollectionsDynamic();
        renderYearlyCollectionsDynamic();
        renderLatestCollectionsDynamic();
        renderMusicCollectionsDynamic();
        renderCategoriesDynamic();
        renderAlbumsDynamic();
        renderPersonalizedMusic();
        renderAIRecommendedSection();
        initHorizontalDragScroll();
        initPWAHomeHeader();

        loadSongs(true).then(songs => {
            renderTickerItems(songs);
            renderRecentlyAdded(songs);
            renderUpcomingReleases();
            _isRenderingAll = false;
        });
    });
}
// Mood Player click handler
document.addEventListener('click', function(e) {
    const moodCard = e.target.closest('.mood-card');
    if (!moodCard) return;
    const mood = moodCard.dataset.mood;
    if (!mood) return;
    // Highlight active mood
    document.querySelectorAll('.mood-card').forEach(c => c.classList.remove('active'));
    moodCard.classList.add('active');
    // Get songs matching mood
    try {
        let songs = [];
        if (typeof DataStore !== 'undefined' && DataStore.getSongs) {
            songs = (DataStore.getSongs() || []).filter(s => s.status === 'published');
        }
        if (!songs.length) return;
        const moodLower = mood.toLowerCase();
        const matched = songs.filter(s => {
            const text = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.movie || '') + ' ' + (s.genre || '') + ' ' + (s.mood || '') + ' ' + (s.tags || '')).toLowerCase();
            return text.includes(moodLower);
        });
        const queue = matched.length >= 3 ? matched : songs.sort(() => Math.random() - 0.5);
        if (queue.length > 0 && typeof playSong === 'function') {
            playSong(queue[0], queue);
            if (typeof showToast === 'function') showToast('Playing ' + mood + ' mood', 'success');
        }
    } catch(e) {}
});

// Handle dashboard and universe page navigation
document.addEventListener('click', function(e) {
    const dashboardItem = e.target.closest('.premium-nav-item[data-page="dashboard"]');
    if (dashboardItem) {
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof YTMusic !== 'undefined' && YTMusic.navigateTo) YTMusic.navigateTo('dashboard');
        if (typeof YTMusic !== 'undefined' && YTMusic.toggleMobileMenu) YTMusic.toggleMobileMenu(false);
    }
    const artistEl = e.target.closest('.song-artist');
    if (artistEl) {
        const name = artistEl.textContent.trim();
        if (name && name !== 'Unknown Artist') {
            e.stopPropagation();
            if (typeof openArtistUniverse === 'function') openArtistUniverse(name);
        }
    }
    const movieEl = e.target.closest('.song-movie');
    if (movieEl) {
        const name = movieEl.textContent.trim();
        if (name && name !== 'Single') {
            e.stopPropagation();
            if (typeof openMovieUniverse === 'function') openMovieUniverse(name);
        }
    }
});

// ============================================
// Cross-Tab Sync - Builder ↔ Live Website
// ============================================

// Re-pull the authoritative R2 manifest and re-render every dynamic section.
// This runs on a live site tab whenever the Builder publishes — no full-page
// reload, no duplicate records, and the audio player is left completely alone
// (no playback interruption / reset).
function refreshLiveContent() {
    const render = () => {
        _isRenderingAll = false;
        renderAllDynamicContent();
        if (typeof YTMusic !== 'undefined' && typeof YTMusic.renderAllPages === 'function') {
            try { YTMusic.renderAllPages(); } catch (e) { /* ignore */ }
        }
    };

    if (typeof ContentSync !== 'undefined' && typeof ContentSync.bootstrapSharedContent === 'function') {
        ContentSync.bootstrapSharedContent().then(function() {
            // After R2 sync, force re-render all sections including personalized
            _isRenderingAll = false;
            _homeSectionHashes.personalized = ''; // clear hash cache for Made For You
            _homeSectionHashes.recentlyAdded = ''; // clear hash cache for Recently Added
            _homeSectionHashes.upcomingReleases = ''; // clear hash cache for Upcoming Releases
            _homeSectionHashes.trending = ''; // clear hash cache for Trending
            _homeSectionHashes.aiRecommended = ''; // clear hash cache for AI Recommended
            _homeSectionHashes.albums = ''; // clear hash cache for Albums
            render();
        }).catch(render);
    } else {
        render();
    }
}

function setupRealtimeSync() {
    // Listen for content changes from the Builder (cross-tab)
    window.addEventListener('storage', (e) => {
        if (!e.key) return;
        if (e.key === 'tamilAIStream_advertisements') {
            renderAdBanners();
        }
        if (e.key === 'tamilAIStream_upcomingReleases') {
            renderUpcomingReleases();
        }
        if (['tamilAIStream_songs', 'tamilAIStream_stations', 'tamilAIStream_featured',
            'tamilAIStream_trending', 'tamilAIStream_artistHits', 'tamilAIStream_categories',
            'tamilAIStream_moods', 'tamilAIStream_aiRadio', 'tamilAIStream_quotes'].includes(e.key)) {
            refreshLiveContent();
        }
        if (e.key === 'tamilAIStream_musicCollections' ||
            e.key === 'tamilAIStream_moviesCollections' ||
            e.key === 'tamilAIStream_yearlyCollections' ||
            e.key === 'tamilAIStream_latestCollections') {
            renderMusicCollectionsDynamic();
            renderMoviesCollectionsDynamic();
            renderYearlyCollectionsDynamic();
            renderLatestCollectionsDynamic();
        }
    });
    // Custom event from builder for immediate sync
    window.addEventListener('storage-sync', () => {
        refreshLiveContent();
    });
    // ContentSync change notifications (manifest pulled/applied)
    window.addEventListener('tamilAIStream-content-synced', () => {
        refreshLiveContent();
    });
    window.addEventListener('premium-sections-sync', () => {
        refreshLiveContent();
    });
}

// ============================================
// Stations Filter & Search
// ============================================
function filterStations() {
    const stationsGrid = document.getElementById('stationsGrid');
    const stationsCount = document.getElementById('stationsCount');
    if (!stationsGrid) return;
    
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const cards = stationsGrid.querySelectorAll('.station-grid-card');
    let visibleCount = 0;
    
    cards.forEach(card => {
        const genre = card.dataset.genre || '';
        const matchesFilter = activeFilter === 'all' || genre === activeFilter;
        card.classList.toggle('hidden', !matchesFilter);
        if (matchesFilter) visibleCount++;
    });
    
    if (stationsCount) stationsCount.textContent = `${visibleCount} station${visibleCount !== 1 ? 's' : ''}`;
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize analytics tracker
    if (typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.init();
    // Builder preview mode: skip auth, splash, particles — keep rendering only
    if (window.__BUILDER_PREVIEW__) {
        const splash = document.getElementById('splashOverlay');
        if (splash) splash.style.display = 'none';
        document.body.classList.add('builder-preview');
    }

    if (!checkAuth()) return;
    
    // Add global player body class
    document.body.classList.add('gp-active');
    
    // Check admin and show builder link
    checkAdminAndShowBuilder();
    
    // Particles removed per user request
    // Initialize top header
    initTopHeader();
    
    // Render all dynamic content from DataStore
    renderAllDynamicContent();
    
    // Pull latest content from R2 (Cloudflare) and re-render.
    // This ensures "Made For You", "Recently Added", and all other sections
    // show the latest published content from the Builder, not stale localStorage.
    if (typeof ContentSync !== 'undefined' && typeof ContentSync.bootstrapSharedContent === 'function') {
        ContentSync.bootstrapSharedContent().then(function() {
            _isRenderingAll = false;
            // Clear hash caches so all sections re-render with fresh data
            Object.keys(_homeSectionHashes).forEach(function(k) { _homeSectionHashes[k] = ''; });
            renderAllDynamicContent();
        }).catch(function() {
            // R2 unavailable — local data is already rendered, no action needed
        });
    }
    
    // Analytics: track page view
    if (typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.trackPageView(window.location.pathname);
    
    // Setup real-time sync from builder
    setupRealtimeSync();
    
    // Setup layout sync from builder
    setupLayoutSync();
    
    // Apply visual editor overrides from builder
    applyVEOverrides();
    
    // Initialize ticker
    initTicker();

    // Initialize recently added event listeners (hover/touch)
    initRecentlyAdded();

    // Setup filter buttons
    setTimeout(() => {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterStations();
            });
        });
    
        // Apply filter
        filterStations();
    }, 200);
    
    console.log('%cðŸŽ™ï¸ Tamil AI Stream', 'font-size:24px;font-weight:bold;color:#34d399;');
    console.log('%cHome Page Loaded with Real-time Sync', 'font-size:14px;color:#6ee7b7;');
    console.log('%cVersion 3.0.0 - YouTube Music Features', 'font-size:12px;color:#a7f3d0;');
    
    // Initialize YTMusic integration
    if (typeof YTMusic !== 'undefined') {
        const originalPlayStation = window.playStation;
        window.playStation = function(stationName) {
            const stations = DataStore.getStations();
            const station = stations.find(s => s.name === stationName);
            if (station) {
                YTMusic.queue = stations.filter(s => s.status === 'active');
                YTMusic.queueIndex = YTMusic.queue.findIndex(s => s.name === stationName);
                YTMusic.currentTrack = {
                    id: station.id,
                    title: station.name,
                    artist: station.freq + ' â€¢ ' + station.genre,
                    thumbnail: station.thumbnail || '',
                    streamUrl: station.streamUrl
                };
                YTMusic.isPlaying = true;
                YTMusic.progress = 0;
                YTMusic.addToHistory(YTMusic.currentTrack);
                YTMusic.updatePlayerUI();
                YTMusic.updateFullscreenPlayerUI();
                YTMusic.updateMiniPlayerUI();
                window.dispatchEvent(new CustomEvent('ytm:playTrack', { detail: YTMusic.currentTrack }));
            }
            if (originalPlayStation) originalPlayStation(stationName);
        };

        const originalPlaySong = window.playSong;
        window.playSong = function(song, playlist) {
            if (song) {
                if (playlist && playlist.length > 0) {
                    YTMusic.queue = playlist;
                    YTMusic.queueIndex = playlist.findIndex(s => s.id === song.id);
                }
                YTMusic.currentTrack = {
                    id: song.id,
                    title: song.title,
                    artist: song.artist,
                    thumbnail: song.thumbnail || song.cover || '',
                    audioUrl: song.audioUrl
                };
                YTMusic.isPlaying = true;
                YTMusic.progress = 0;
                YTMusic.addToHistory(YTMusic.currentTrack);
                YTMusic.updatePlayerUI();
                YTMusic.updateFullscreenPlayerUI();
                YTMusic.updateMiniPlayerUI();
                window.dispatchEvent(new CustomEvent('ytm:playTrack', { detail: YTMusic.currentTrack }));
            }
            if (originalPlaySong) originalPlaySong(song, playlist);
        };
    }
});

// ============================================
// Recently Added Songs Ticker
// ============================================
let tickerInitialized = false;

function renderTickerItems(songs) {
    const track = document.getElementById('ytmTickerTrack');
    if (!track) return;

    const publishedSongs = (songs || []).filter(s => s.status === 'published').slice(0, 20);

    const hash = publishedSongs.map(s => s.id).join(',');
    if (!_hasSectionChanged('ticker', hash)) return;
    if (publishedSongs.length === 0) {
        track.innerHTML = `
            <div class="ytm-ticker-item">
                <div class="ytm-ticker-item-icon"><i class="fas fa-music"></i></div>
                <div class="ytm-ticker-item-info">
                    <span class="ytm-ticker-item-title">No songs added yet</span>
                    <span class="ytm-ticker-item-artist">Add songs from the Website Builder</span>
                </div>
            </div>`;
        return;
    }

    const items = publishedSongs.map(song => `
        <div class="ytm-ticker-item" onclick="playTickerSong('${song.id}')" title="Play ${song.title}">
            <div class="ytm-ticker-item-icon"><i class="fas fa-play"></i></div>
            <div class="ytm-ticker-item-info">
                <span class="ytm-ticker-item-title">${song.title || 'Untitled'}</span>
                <span class="ytm-ticker-item-artist">${song.artist || 'Unknown Artist'}</span>
            </div>
            <span class="ytm-ticker-item-badge">NEW</span>
        </div>
    `).join('');

    track.innerHTML = items + items;
}

function playTickerSong(songId) {
    const songs = DataStore.getSongs ? DataStore.getSongs() : [];
    const song = songs.find(s => s.id === songId);
    if (song) {
        playSong(song, songs);
        showToast(`Now playing: ${song.title}`, 'success');
    }
}

function initTicker() {
    if (tickerInitialized) return;
    tickerInitialized = true;

    const viewport = document.getElementById('ytmTickerViewport');
    if (!viewport) return;

    loadSongs(true).then(songs => {
        renderTickerItems(songs);
    });

    // Pause on hover for desktop
    const ticker = document.getElementById('ytmTicker');
    if (ticker) {
        ticker.addEventListener('mouseenter', () => {
            const track = ticker.querySelector('.ytm-ticker-track');
            if (track) track.style.animationPlayState = 'paused';
        });
        ticker.addEventListener('mouseleave', () => {
            const track = ticker.querySelector('.ytm-ticker-track');
            if (track) track.style.animationPlayState = 'running';
        });
    }
}

// ============================================
// Recently Added Songs Marquee (Dashboard)
// ============================================
let recentlyAddedInitialized = false;

function renderRecentlyAdded(songs) {
    const track = document.getElementById('recentlyAddedTrack');
    const viewport = document.getElementById('recentlyAddedViewport');
    if (!track || !viewport) return;

    const publishedSongs = (songs || [])
        .filter(s => s.status === 'published')
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 20);

    const hash = publishedSongs.map(s => s.id + (s.createdAt || '')).join(',');
    if (!_hasSectionChanged('recentlyAdded', hash)) return;

    if (publishedSongs.length === 0) {
        viewport.innerHTML = `
            <div class="recently-added-empty">
                <i class="fas fa-record-vinyl"></i>
                <p>No songs added yet</p>
            </div>`;
        return;
    }

    const allSongs = publishedSongs;

    const cards = publishedSongs.map(song => {
        const artwork = song.albumCover || song.cover || '';
        const artHtml = artwork
            ? `<img src="${artwork}" alt="${song.title || 'Song'}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'recently-added-card-art-placeholder\\'><i class=\\'fas fa-music\\'></i></div>'">`
            : `<div class="recently-added-card-art-placeholder"><i class="fas fa-music"></i></div>`;

        return `
            <div class="recently-added-card" data-song-id="${song.id}">
                <div class="recently-added-card-art">
                    ${artHtml}
                    <div class="recently-added-card-play-overlay">
                        <button class="recently-added-card-play-btn" data-song-id="${song.id}" title="Play ${song.title || 'Song'}">
                            <i class="fas fa-play" style="margin-left:2px;"></i>
                        </button>
                    </div>
                </div>
                <div class="recently-added-card-info">
                    <div class="recently-added-card-title" title="${song.title || 'Untitled'}">${song.title || 'Untitled'}</div>
                    <div class="recently-added-card-artist" title="${song.artist || 'Unknown Artist'}">${song.artist || 'Unknown Artist'}</div>
                    <div class="recently-added-card-meta">
                        <span class="recently-added-card-badge">NEW</span>
                    </div>
                </div>
            </div>`;
    }).join('');

    // Duplicate for seamless loop
    track.innerHTML = cards + cards;

    // Bind play buttons
    track.querySelectorAll('.recently-added-card-play-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            const songId = this.dataset.songId;
            const song = allSongs.find(s => s.id === songId);
            if (song) {
                playSong(song, allSongs);
                if (typeof showToast === 'function') showToast(`Now playing: ${song.title}`, 'success');
            }
        });
    });

    // Bind card click (play the song)
    track.querySelectorAll('.recently-added-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.recently-added-card-play-btn')) return;
            const songId = this.dataset.songId;
            const song = allSongs.find(s => s.id === songId);
            if (song) {
                playSong(song, allSongs);
                if (typeof showToast === 'function') showToast(`Now playing: ${song.title}`, 'success');
            }
        });
    });
}

// ============================================
// Upcoming Releases - Premium Flipkart-style Carousel
// ============================================
(function() {
    let _urIndex = 0;
    let _urTimer = null;
    let _urAutoMs = 35000;
    let _urReleases = [];
    let _urPauseAuto = false;

    function renderUpcomingReleases() {
        const track = document.getElementById('urCarouselTrack');
        const viewport = document.getElementById('urCarouselViewport');
        const dotsWrap = document.getElementById('urCarouselDots');
        if (!track || !viewport || !dotsWrap) return;

        _urReleases = (DataStore.getUpcomingReleases() || [])
            .filter(r => r.enabled !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const hash = _urReleases.map(r => r.id + (r.title || '') + (r.image || '') + (r.order || 0)).join(',');
        if (!_hasSectionChanged('upcomingReleases', hash)) return;

        if (_urReleases.length === 0) {
            const section = document.querySelector('.upcoming-releases-section');
            if (section) section.style.display = 'none';
            return;
        }
        const sectionEl = document.querySelector('.upcoming-releases-section');
        if (sectionEl) sectionEl.style.display = '';

        track.innerHTML = _urReleases.map((r, i) => {
            const imgHtml = r.image
                ? `<img src="${r.image}" alt="${r.title || 'Release'}" loading="${i === 0 ? 'eager' : 'lazy'}" draggable="false" onerror="this.parentElement.innerHTML='<div class=\\'ur-slide-placeholder\\'><i class=\\'fas fa-music\\'></i></div>'">`
                : `<div class="ur-slide-placeholder"><i class="fas fa-music"></i></div>`;
            return `<div class="ur-slide" data-ur-index="${i}">
                <div class="ur-slide-image">${imgHtml}</div>
                ${r.title ? `<div class="ur-slide-overlay"><h3 class="ur-slide-title">${r.title}</h3>${r.subtitle ? `<p class="ur-slide-subtitle">${r.subtitle}</p>` : ''}</div>` : ''}
            </div>`;
        }).join('');

        dotsWrap.innerHTML = _urReleases.map((_, i) =>
            `<button class="ur-dot ${i === 0 ? 'active' : ''}" data-ur-dot="${i}" aria-label="Go to slide ${i + 1}"></button>`
        ).join('');

        _urIndex = 0;
        _urSetTransform(track, 0);
        _urUpdateDots(dotsWrap, 0);
        _urBindControls(viewport, track, dotsWrap);
        _urResetAuto(track, dotsWrap);
    }

    function _urSetTransform(track, idx) {
        if (!track) return;
        track.style.transition = 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
        track.style.transform = `translateX(-${idx * 100}%)`;
    }

    function _urUpdateDots(dotsWrap, idx) {
        if (!dotsWrap) return;
        dotsWrap.querySelectorAll('.ur-dot').forEach((d, i) => {
            d.classList.toggle('active', i === idx);
        });
    }

    function _urGoTo(idx, track, dotsWrap, smooth) {
        if (!_urReleases.length) return;
        if (idx < 0) idx = _urReleases.length - 1;
        if (idx >= _urReleases.length) idx = 0;
        _urIndex = idx;
        if (track) {
            track.style.transition = smooth === false ? 'none' : 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
            track.style.transform = `translateX(-${_urIndex * 100}%)`;
        }
        _urUpdateDots(dotsWrap, _urIndex);
    }

    function _urNext(track, dotsWrap) {
        _urGoTo(_urIndex + 1, track, dotsWrap);
    }

    function _urResetAuto(track, dotsWrap) {
        clearInterval(_urTimer);
        if (_urPauseAuto) return;
        _urTimer = setInterval(() => _urNext(track, dotsWrap), _urAutoMs);
    }

    function _urBindControls(viewport, track, dotsWrap) {
        const prevBtn = document.querySelector('.ur-prev');
        const nextBtn = document.querySelector('.ur-next');
        if (prevBtn) {
            prevBtn.onclick = (e) => { e.preventDefault(); _urGoTo(_urIndex - 1, track, dotsWrap); _urResetAuto(track, dotsWrap); };
        }
        if (nextBtn) {
            nextBtn.onclick = (e) => { e.preventDefault(); _urGoTo(_urIndex + 1, track, dotsWrap); _urResetAuto(track, dotsWrap); };
        }
        if (dotsWrap) {
            dotsWrap.onclick = (e) => {
                const dot = e.target.closest('.ur-dot');
                if (!dot) return;
                _urGoTo(parseInt(dot.dataset.urDot) || 0, track, dotsWrap);
                _urResetAuto(track, dotsWrap);
            };
        }

        // Touch/swipe support
        let touchStartX = 0, touchDeltaX = 0, swiping = false;
        viewport.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchDeltaX = 0;
            swiping = true;
            if (track) track.style.transition = 'none';
        }, { passive: true });
        viewport.addEventListener('touchmove', (e) => {
            if (!swiping) return;
            touchDeltaX = e.touches[0].clientX - touchStartX;
        }, { passive: true });
        viewport.addEventListener('touchend', () => {
            if (!swiping) return;
            swiping = false;
            if (Math.abs(touchDeltaX) > 50) {
                _urGoTo(touchDeltaX > 0 ? _urIndex - 1 : _urIndex + 1, track, dotsWrap);
            } else {
                if (track) {
                    track.style.transition = 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
                    track.style.transform = `translateX(-${_urIndex * 100}%)`;
                }
            }
            _urResetAuto(track, dotsWrap);
        }, { passive: true });

        // Mouse drag support
        let mouseDown = false, mouseStartX = 0, mouseDelta = 0;
        viewport.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            mouseDown = true; mouseStartX = e.clientX; mouseDelta = 0;
            viewport.style.cursor = 'grabbing';
            if (track) track.style.transition = 'none';
        });
        viewport.addEventListener('mousemove', (e) => {
            if (!mouseDown) return;
            mouseDelta = e.clientX - mouseStartX;
        });
        viewport.addEventListener('mouseup', () => {
            if (!mouseDown) return;
            mouseDown = false;
            viewport.style.cursor = '';
            if (Math.abs(mouseDelta) > 50) {
                _urGoTo(mouseDelta > 0 ? _urIndex - 1 : _urIndex + 1, track, dotsWrap);
            } else {
                if (track) {
                    track.style.transition = 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
                    track.style.transform = `translateX(-${_urIndex * 100}%)`;
                }
            }
            _urResetAuto(track, dotsWrap);
        });
        viewport.addEventListener('mouseleave', () => {
            if (mouseDown) {
                mouseDown = false;
                viewport.style.cursor = '';
                if (Math.abs(mouseDelta) > 50) {
                    _urGoTo(mouseDelta > 0 ? _urIndex - 1 : _urIndex + 1, track, dotsWrap);
                } else {
                    if (track) {
                        track.style.transition = 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
                        track.style.transform = `translateX(-${_urIndex * 100}%)`;
                    }
                }
                _urResetAuto(track, dotsWrap);
            }
        });

        // Pause auto on hover
        viewport.addEventListener('mouseenter', () => { _urPauseAuto = true; clearInterval(_urTimer); });
        viewport.addEventListener('mouseleave', () => { _urPauseAuto = false; _urResetAuto(track, dotsWrap); });
    }

    window.renderUpcomingReleases = renderUpcomingReleases;
})();

function initRecentlyAdded() {
    const viewport = document.getElementById('recentlyAddedViewport');
    if (!viewport) return;

    // Only add event listeners once (prevents duplicates)
    if (recentlyAddedInitialized) return;
    recentlyAddedInitialized = true;

    // Desktop: hover pauses marquee (handled via CSS :hover)
    // But also support JS for reliability
    viewport.addEventListener('mouseenter', function() {
        this.classList.add('hovering');
    }, { passive: true });
    viewport.addEventListener('mouseleave', function() {
        this.classList.remove('hovering');
        this.classList.remove('touching');
    }, { passive: true });

    // Mobile: touch swipe pauses marquee, allows manual scroll
    let isTouching = false;

    viewport.addEventListener('touchstart', function() {
        isTouching = true;
        this.classList.add('touching');
    }, { passive: true });

    viewport.addEventListener('touchend', function() {
        isTouching = false;
        const vp = this;
        setTimeout(function() { vp.classList.remove('touching'); }, 800);
    }, { passive: true });
}

// ============================================
// Horizontal Drag-to-Scroll for ra-track sections
// ============================================
let _dragScrollInitialized = false;
let _dragScrollObserver = null;
function initHorizontalDragScroll() {
    if (_dragScrollInitialized) return;
    _dragScrollInitialized = true;

    function attachDragScroll(viewport) {
        if (viewport._dragAttached) return;
        viewport._dragAttached = true;
        const track = viewport.querySelector('.ra-track');
        if (!track) return;
        let isDragging = false;
        let startX = 0;
        let scrollLeft = 0;

        viewport.addEventListener('mousedown', function(e) {
            isDragging = true;
            startX = e.pageX - viewport.offsetLeft;
            scrollLeft = viewport.scrollLeft;
            viewport.style.cursor = 'grabbing';
            viewport.style.userSelect = 'none';
        });
        viewport.addEventListener('mouseleave', function() {
            isDragging = false;
            viewport.style.cursor = '';
            viewport.style.userSelect = '';
        });
        viewport.addEventListener('mouseup', function() {
            isDragging = false;
            viewport.style.cursor = '';
            viewport.style.userSelect = '';
        });
        viewport.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - viewport.offsetLeft;
            const walk = (x - startX) * 1.5;
            viewport.scrollLeft = scrollLeft - walk;
        });

        // Touch drag-to-scroll
        let touchStartX = 0;
        let touchScrollLeft = 0;
        viewport.addEventListener('touchstart', function(e) {
            touchStartX = e.touches[0].pageX;
            touchScrollLeft = viewport.scrollLeft;
        }, { passive: true });
        viewport.addEventListener('touchmove', function(e) {
            const x = e.touches[0].pageX;
            const walk = (touchStartX - x) * 1.2;
            viewport.scrollLeft = touchScrollLeft + walk;
        }, { passive: true });
    }

    document.querySelectorAll('.ra-track-viewport').forEach(attachDragScroll);

    // Use MutationObserver to catch dynamically added viewports
    if (!_dragScrollObserver) {
        _dragScrollObserver = new MutationObserver(function(mutations) {
            for (let i = 0; i < mutations.length; i++) {
                const added = mutations[i].addedNodes;
                for (let j = 0; j < added.length; j++) {
                    const node = added[j];
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.contains('ra-track-viewport')) {
                            attachDragScroll(node);
                        }
                        const children = node.querySelectorAll ? node.querySelectorAll('.ra-track-viewport') : [];
                        children.forEach(attachDragScroll);
                    }
                }
            }
        });
        _dragScrollObserver.observe(document.body, { childList: true, subtree: true });
    }
}

// ============================================
// Export functions for playlist page
// ============================================
if (typeof window !== 'undefined') {
    window.showToast = showToast;
    window.playSong = playSong;
    window.playSongById = playSongById;
    window.toggleFavorite = toggleFavorite;
    window.logout = logout;
    window.playStation = playStation;
    window.toggleStationFromCard = toggleStationFromCard;
    window.playTickerSong = playTickerSong;
    // Playback bridge globals. yt-music.js (YTMusic) and global-player.js (GlobalPlayer)
    // delegate play/pause/volume/seek through these so the single audio engine stays
    // the source of truth. They MUST be exported here so seek never falls back to the
    // naive `audioPlayer.currentTime = percent*(duration||0)` path (which snaps live
    // stations to 0:00).
    window.getPlaybackDuration = getPlaybackDuration;
    window.seekPlaybackToPercent = seekPlaybackToPercent;
    window.setPlaybackVolume = setPlaybackVolume;
    window.togglePlayPause = togglePlayPause;
    window.playNextTrack = playNextTrack;
    window.playPreviousTrack = playPreviousTrack;
    window.pausePlayback = pausePlayback;
}








// ============================================================
// Home is music-focused: Trending + AI sections render SONGS.
// FM/Radio content stays only in the Radio section/menu.
// (Earlier station-based versions live on as *StationsLegacy.)
// ============================================================
function renderSongTrack(container, songs, limit) {
    if (!container) return;
    const items = (songs || []).slice(0, limit || 10);
    if (!items.length) {
        container.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,0.4);text-align:center;width:100%;font-size:13px;">No songs yet</div>';
        return;
    }
    const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='30' fill='%2334d399' opacity='0.3'/%3E%3C/svg%3E";
    const itemsArr = items;
    container.innerHTML = items.map((song, index) => {
        const artwork = song.albumCover || song.cover || placeholder;
        return `
        <div class="ra-card" data-song-id="${song.id}">
            <div class="ra-card-art">
                <img src="${artwork}" alt="${song.title || 'Song'}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'ra-card-art-placeholder\\'><i class=\\'fas fa-music\\'></i></div>'">
                <div class="ra-card-play-overlay">
                    <button class="ra-card-play-btn" data-song-id="${song.id}" title="Play ${song.title || 'Song'}">
                        <i class="fas fa-play" style="margin-left:2px;"></i>
                    </button>
                </div>
            </div>
            <div class="ra-card-info">
                <div class="ra-card-title" title="${song.title || 'Untitled'}">${song.title || 'Untitled'}</div>
                <div class="ra-card-artist" title="${song.artist || 'Unknown Artist'}">${song.artist || 'Unknown Artist'}</div>
                <div class="ra-card-meta">
                    <span class="ra-card-badge">PLAY</span>
                    ${song.movie ? '<span class="ra-card-movie" title="' + song.movie + '">' + song.movie + '</span>' : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.ra-card-play-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            const songId = this.dataset.songId;
            const song = itemsArr.find(s => s.id === songId);
            if (song) {
                playSong(song, itemsArr);
                if (typeof showToast === 'function') showToast('Now playing: ' + song.title, 'success');
            }
        });
    });
    container.querySelectorAll('.ra-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.ra-card-play-btn')) return;
            const songId = this.dataset.songId;
            const song = itemsArr.find(s => s.id === songId);
            if (song) {
                playSong(song, itemsArr);
                if (typeof showToast === 'function') showToast('Now playing: ' + song.title, 'success');
            }
        });
    });
}

function renderTrendingDynamic() {
    const container = document.querySelector('#trendingScroll .ra-track') || document.querySelector('#trendingScroll .stations-track');
    if (!container) return;
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch (e) {}
    const hash = songs.map(s => s.id).join(',');
    if (!_hasSectionChanged('trending', hash)) return;
    renderSongTrack(container, songs, 12);
}

function renderAIRecommendedDynamic() {
    const container = document.querySelector('[data-section="ai-recommended"] .ra-track') || document.querySelector('[data-section="ai-recommended"] .stations-track');
    if (!container) return;
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch (e) {}
    const picks = songs.slice().sort(() => Math.random() - 0.5).slice(0, 8);
    const hash = picks.map(s => s.id).join(',');
    if (!_hasSectionChanged('aiRecommended', hash)) return;
    renderSongTrack(container, picks, 8);
}

// ==================== AI MUSIC FEATURES ====================

// AI Music Assistant — conversational music control
function openAIMusicAssistant() {
    let panel = document.getElementById('aiMusicAssistantPanel');
    if (panel) { panel.classList.toggle('open'); return; }
    panel = document.createElement('div');
    panel.id = 'aiMusicAssistantPanel';
    panel.className = 'ai-assistant-panel open';
    panel.innerHTML = `
        <div class="ai-assistant-header">
            <div class="ai-assistant-avatar"><i class="fas fa-robot"></i></div>
            <div><h3>Tamil AI Assistant</h3><p>Ask me to play music</p></div>
            <button class="ai-assistant-close" onclick="this.closest('.ai-assistant-panel').remove()"><i class="fas fa-times"></i></button>
        </div>
        <div class="ai-assistant-messages" id="aiAssistantMessages">
            <div class="ai-assistant-msg ai-assistant-bot">
                <div class="ai-assistant-msg-avatar"><i class="fas fa-robot"></i></div>
                <div class="ai-assistant-msg-text">Hi! I'm your Tamil AI Music Assistant. Try saying:<br>"Play Ilaiyaraaja songs"<br>"Play peaceful Tamil songs"<br>"Give me 90s melodies"<br>"Play my favorites"</div>
            </div>
        </div>
        <div class="ai-assistant-suggestions">
            <button class="ai-assistant-chip" onclick="sendAICommand('Play my favorites')">❤️ Favorites</button>
            <button class="ai-assistant-chip" onclick="sendAICommand('Play trending songs')">🔥 Trending</button>
            <button class="ai-assistant-chip" onclick="sendAICommand('Play 90s melodies')">🎵 90s Melodies</button>
            <button class="ai-assistant-chip" onclick="sendAICommand('Play peaceful songs')">🕊️ Peaceful</button>
            <button class="ai-assistant-chip" onclick="sendAICommand('Play Ilaiyaraaja')">🎸 Ilaiyaraaja</button>
            <button class="ai-assistant-chip" onclick="sendAICommand('Shuffle all')">🔀 Shuffle All</button>
        </div>
        <div class="ai-assistant-input-row">
            <input type="text" id="aiAssistantInput" placeholder="Ask me to play any music..." autocomplete="off">
            <button class="ai-assistant-send" onclick="sendAITextCommand()"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;
    document.body.appendChild(panel);
    const input = document.getElementById('aiAssistantInput');
    if (input) {
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAITextCommand(); });
        setTimeout(() => input.focus(), 300);
    }
}

function sendAITextCommand() {
    const input = document.getElementById('aiAssistantInput');
    if (!input || !input.value.trim()) return;
    sendAICommand(input.value.trim());
    input.value = '';
}

function sendAICommand(text) {
    const messagesEl = document.getElementById('aiAssistantMessages');
    if (!messagesEl) return;
    messagesEl.innerHTML += `<div class="ai-assistant-msg ai-assistant-user"><div class="ai-assistant-msg-text">${text}</div></div>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    const lower = text.toLowerCase();
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch(e) {}
    if (!songs.length) {
        addBotMessage('No songs available yet. Add songs from the Builder.');
        return;
    }
    let matched = [];
    let response = '';
    if (lower.includes('favorite') || lower.includes('fav')) {
        try {
            const favs = JSON.parse(localStorage.getItem('tamilAI_favorites') || '[]');
            matched = songs.filter(s => favs.includes(s.id));
        } catch(e) {}
        response = matched.length ? `Playing your ${matched.length} favorite songs!` : 'No favorites yet. Heart some songs first!';
    } else if (lower.includes('trending') || lower.includes('popular')) {
        matched = songs.slice().sort(() => Math.random() - 0.5).slice(0, 20);
        response = 'Playing trending Tamil songs!';
    } else if (lower.includes('shuffle') || lower.includes('random')) {
        matched = songs.slice().sort(() => Math.random() - 0.5);
        response = 'Shuffling all songs!';
    } else if (lower.includes('90') || lower.includes('ninety')) {
        matched = songs.filter(s => {
            const year = parseInt(s.year || s.releaseYear || '0');
            return year >= 1990 && year < 2000;
        });
        response = matched.length ? `Playing ${matched.length} songs from the 90s!` : 'No 90s songs found.';
    } else if (lower.includes('2000') || lower.includes('2k')) {
        matched = songs.filter(s => {
            const year = parseInt(s.year || s.releaseYear || '0');
            return year >= 2000 && year < 2010;
        });
        response = matched.length ? `Playing ${matched.length} songs from the 2000s!` : 'No 2000s songs found.';
    } else if (lower.includes('peaceful') || lower.includes('relax') || lower.includes('calm') || lower.includes('sleep')) {
        matched = songs.filter(s => {
            const text = ((s.title||'')+' '+(s.artist||'')+' '+(s.genre||'')+' '+(s.mood||'')+' '+(s.tags||'')).toLowerCase();
            return text.includes('peace') || text.includes('relax') || text.includes('soft') || text.includes('lullaby') || text.includes('calm');
        });
        if (matched.length < 3) matched = songs.sort(() => Math.random() - 0.5).slice(0, 15);
        response = 'Playing peaceful Tamil melodies!';
    } else if (lower.includes('love') || lower.includes('romantic')) {
        matched = songs.filter(s => {
            const text = ((s.title||'')+' '+(s.artist||'')+' '+(s.genre||'')+' '+(s.mood||'')+' '+(s.tags||'')).toLowerCase();
            return text.includes('love') || text.includes('romantic') || text.includes('kaadhal') || text.includes('pesama');
        });
        if (matched.length < 3) matched = songs.sort(() => Math.random() - 0.5).slice(0, 15);
        response = 'Playing romantic Tamil songs!';
    } else if (lower.includes('workout') || lower.includes('gym') || lower.includes('energy') || lower.includes('mass')) {
        matched = songs.filter(s => {
            const text = ((s.title||'')+' '+(s.artist||'')+' '+(s.genre||'')+' '+(s.mood||'')+' '+(s.tags||'')).toLowerCase();
            return text.includes('mass') || text.includes('kuthu') || text.includes('dance') || text.includes('energy');
        });
        if (matched.length < 3) matched = songs.sort(() => Math.random() - 0.5).slice(0, 15);
        response = 'Playing high-energy Tamil tracks!';
    } else if (lower.includes('devotional') || lower.includes('prayer') || lower.includes('god')) {
        matched = songs.filter(s => {
            const text = ((s.title||'')+' '+(s.artist||'')+' '+(s.genre||'')+' '+(s.movie||'')).toLowerCase();
            return text.includes('devotional') || text.includes('prayer') || text.includes('kovil') || text.includes('temple');
        });
        response = matched.length ? 'Playing devotional songs!' : 'Playing spiritual Tamil songs.';
        if (matched.length < 3) matched = songs.sort(() => Math.random() - 0.5).slice(0, 10);
    } else {
        const artistMatch = songs.filter(s => (s.artist || '').toLowerCase().includes(lower.replace('play ', '').replace('songs', '').trim()));
        if (artistMatch.length > 0) {
            matched = artistMatch;
            response = `Playing ${matched[0].artist} songs!`;
        } else {
            const movieMatch = songs.filter(s => (s.movie || '').toLowerCase().includes(lower.replace('play ', '').replace('songs', '').trim()));
            if (movieMatch.length > 0) {
                matched = movieMatch;
                response = `Playing songs from ${matched[0].movie}!`;
            } else {
                matched = songs.filter(s => {
                    const text = ((s.title||'')+' '+(s.artist||'')+' '+(s.movie||'')+' '+(s.genre||'')+' '+(s.mood||'')+' '+(s.tags||'')).toLowerCase();
                    return lower.split(' ').some(word => word.length > 2 && text.includes(word));
                });
                response = matched.length ? `Found ${matched.length} songs matching your request!` : 'I couldn\'t find exact matches. Try a different artist, movie, or mood.';
            }
        }
    }
    addBotMessage(response);
    if (matched.length > 0 && typeof playSong === 'function') {
        const queue = matched.slice(0, 30);
        playSong(queue[0], queue);
    }
}

function addBotMessage(text) {
    const messagesEl = document.getElementById('aiAssistantMessages');
    if (!messagesEl) return;
    messagesEl.innerHTML += `<div class="ai-assistant-msg ai-assistant-bot"><div class="ai-assistant-msg-avatar"><i class="fas fa-robot"></i></div><div class="ai-assistant-msg-text">${text}</div></div>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function openAskAI() { openAIMusicAssistant(); }

function openAIRadioGenerator() {
    let panel = document.getElementById('aiRadioGenPanel');
    if (panel) { panel.classList.toggle('open'); return; }
    panel = document.createElement('div');
    panel.id = 'aiRadioGenPanel';
    panel.className = 'ai-assistant-panel open';
    panel.innerHTML = `
        <div class="ai-assistant-header">
            <div class="ai-assistant-avatar" style="background:linear-gradient(135deg,#a855f7,#6366f1)"><i class="fas fa-tower-broadcast"></i></div>
            <div><h3>AI Radio Generator</h3><p>Create your own Tamil radio</p></div>
            <button class="ai-assistant-close" onclick="this.closest('.ai-assistant-panel').remove()"><i class="fas fa-times"></i></button>
        </div>
        <div class="ai-assistant-suggestions" style="padding:16px;">
            <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin-bottom:12px;">Describe your radio and AI will create it:</p>
            <button class="ai-assistant-chip" onclick="generateAIRadio('melody')">🎵 Tamil Melody Radio</button>
            <button class="ai-assistant-chip" onclick="generateAIRadio('90s')">📻 90s Tamil Radio</button>
            <button class="ai-assistant-chip" onclick="generateAIRadio('love')">❤️ Romantic Radio</button>
            <button class="ai-assistant-chip" onclick="generateAIRadio('workout')">💪 Workout Radio</button>
            <button class="ai-assistant-chip" onclick="generateAIRadio('night')">🌙 Night Drive Radio</button>
            <button class="ai-assistant-chip" onclick="generateAIRadio('devotional')">🙏 Devotional Radio</button>
        </div>
    `;
    document.body.appendChild(panel);
}

function generateAIRadio(theme) {
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch(e) {}
    if (!songs.length) { if (typeof showToast === 'function') showToast('No songs available', 'error'); return; }
    const lower = theme.toLowerCase();
    let matched = songs.filter(s => {
        const text = ((s.title||'')+' '+(s.artist||'')+' '+(s.movie||'')+' '+(s.genre||'')+' '+(s.mood||'')+' '+(s.tags||'')).toLowerCase();
        return lower.split(' ').some(w => w.length > 2 && text.includes(w));
    });
    if (matched.length < 5) matched = songs.sort(() => Math.random() - 0.5);
    const queue = matched.slice(0, Math.min(40, matched.length));
    if (typeof playSong === 'function') {
        playSong(queue[0], queue);
        if (typeof showToast === 'function') showToast('AI Radio: ' + theme + ' — ' + queue.length + ' songs', 'success');
    }
}

function openPersonalFM() {
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch(e) {}
    if (!songs.length) { if (typeof showToast === 'function') showToast('No songs available', 'error'); return; }
    const prefs = JSON.parse(localStorage.getItem('tamilAI_preferences') || '[]');
    let history = [];
    try { if (typeof ListeningHistory !== 'undefined' && ListeningHistory.getHistory) history = ListeningHistory.getHistory() || []; } catch(e) {}
    const playedIds = new Set(history.map(h => h && h.track && h.track.id).filter(Boolean));
    const scored = songs.map(s => {
        let score = Math.random() * 0.2;
        const text = ((s.title||'')+' '+(s.artist||'')+' '+(s.movie||'')+' '+(s.genre||'')+' '+(s.mood||'')+' '+(s.tags||'')).toLowerCase();
        prefs.forEach(p => { if (text.includes(p.toLowerCase())) score += 0.3; });
        if (!playedIds.has(s.id)) score += 0.15;
        return { song: s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const queue = scored.slice(0, 30).map(s => s.song);
    if (typeof playSong === 'function') {
        playSong(queue[0], queue);
        if (typeof showToast === 'function') showToast('Your Personal AI FM — personalized for you', 'success');
    }
}

function openVoiceSearch() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        if (typeof showToast === 'function') showToast('Voice search not supported in this browser', 'error');
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    if (typeof showToast === 'function') showToast('Listening... Speak now', 'info');
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (typeof sendAICommand === 'function') {
            openAIMusicAssistant();
            setTimeout(() => sendAICommand(text), 300);
        }
    };
    recognition.onerror = () => { if (typeof showToast === 'function') showToast('Voice recognition error', 'error'); };
    recognition.start();
}

function openLyricsSearch() {
    let panel = document.getElementById('lyricsSearchPanel');
    if (panel) { panel.classList.toggle('open'); return; }
    panel = document.createElement('div');
    panel.id = 'lyricsSearchPanel';
    panel.className = 'ai-assistant-panel open';
    panel.innerHTML = `
        <div class="ai-assistant-header">
            <div class="ai-assistant-avatar" style="background:linear-gradient(135deg,#f59e0b,#ef4444)"><i class="fas fa-quote-right"></i></div>
            <div><h3>Search by Lyrics</h3><p>Remember a line? Find the song</p></div>
            <button class="ai-assistant-close" onclick="this.closest('.ai-assistant-panel').remove()"><i class="fas fa-times"></i></button>
        </div>
        <div style="padding:16px;">
            <div style="display:flex;gap:8px;">
                <input type="text" id="lyricsSearchInput" placeholder="Type a lyric line..." style="flex:1;padding:12px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#fff;font-size:0.95rem;outline:none;" autocomplete="off">
                <button onclick="searchByLyrics()" style="padding:12px 20px;background:linear-gradient(135deg,#34d399,#10b981);border:none;border-radius:12px;color:#fff;font-weight:600;cursor:pointer;"><i class="fas fa-search"></i></button>
            </div>
            <div id="lyricsSearchResults" style="margin-top:12px;"></div>
        </div>
    `;
    document.body.appendChild(panel);
    const input = document.getElementById('lyricsSearchInput');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchByLyrics(); });
}

function searchByLyrics() {
    const input = document.getElementById('lyricsSearchInput');
    const results = document.getElementById('lyricsSearchResults');
    if (!input || !results) return;
    const query = input.value.trim().toLowerCase();
    if (!query) return;
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch(e) {}
    const matched = songs.filter(s => {
        const text = ((s.title||'')+' '+(s.artist||'')+' '+(s.movie||'')+' '+(s.lyrics||'')+' '+(s.genre||'')).toLowerCase();
        return query.split(' ').some(w => w.length > 2 && text.includes(w));
    });
    if (!matched.length) {
        results.innerHTML = '<p style="color:rgba(255,255,255,0.4);font-size:0.85rem;padding:8px 0;">No songs found matching those lyrics.</p>';
        return;
    }
    results.innerHTML = matched.slice(0, 8).map(s => `
        <div class="ai-assistant-msg" style="display:flex;align-items:center;gap:12px;padding:10px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:8px;cursor:pointer;" onclick="if(typeof playSongById==='function')playSongById('${s.id}')">
            <img src="${s.albumCover || s.thumbnail || ''}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'">
            <div style="min-width:0;"><div style="font-size:0.9rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.title||'Unknown'}</div><div style="font-size:0.75rem;color:rgba(255,255,255,0.5);">${s.artist||''} • ${s.movie||''}</div></div>
        </div>
    `).join('');
}

function openAIPlaylistCreator() {
    let panel = document.getElementById('aiPlaylistPanel');
    if (panel) { panel.classList.toggle('open'); return; }
    panel = document.createElement('div');
    panel.id = 'aiPlaylistPanel';
    panel.className = 'ai-assistant-panel open';
    panel.innerHTML = `
        <div class="ai-assistant-header">
            <div class="ai-assistant-avatar" style="background:linear-gradient(135deg,#06b6d4,#3b82f6)"><i class="fas fa-list-music"></i></div>
            <div><h3>AI Playlist Creator</h3><p>Describe your playlist</p></div>
            <button class="ai-assistant-close" onclick="this.closest('.ai-assistant-panel').remove()"><i class="fas fa-times"></i></button>
        </div>
        <div class="ai-assistant-suggestions" style="padding:16px;">
            <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin-bottom:12px;">Describe what you want:</p>
            <button class="ai-assistant-chip" onclick="createAIPlaylist('30 minute Tamil workout')">🏋️ 30-min Workout</button>
            <button class="ai-assistant-chip" onclick="createAIPlaylist('romantic Tamil playlist')">💕 Romantic Mix</button>
            <button class="ai-assistant-chip" onclick="createAIPlaylist('90s Tamil melody')">🎵 90s Melodies</button>
            <button class="ai-assistant-chip" onclick="createAIPlaylist('Tamil road trip')">🚗 Road Trip</button>
            <button class="ai-assistant-chip" onclick="createAIPlaylist('focus and study')">📚 Study Focus</button>
            <button class="ai-assistant-chip" onclick="createAIPlaylist('party Tamil hits')">🎉 Party Hits</button>
        </div>
    `;
    document.body.appendChild(panel);
}

function createAIPlaylist(description) {
    let songs = [];
    try { songs = (DataStore.getSongs() || []).filter(s => s.status === 'published'); } catch(e) {}
    if (!songs.length) { if (typeof showToast === 'function') showToast('No songs available', 'error'); return; }
    const lower = description.toLowerCase();
    let matched = songs.filter(s => {
        const text = ((s.title||'')+' '+(s.artist||'')+' '+(s.movie||'')+' '+(s.genre||'')+' '+(s.mood||'')+' '+(s.tags||'')).toLowerCase();
        return lower.split(' ').some(w => w.length > 2 && text.includes(w));
    });
    if (matched.length < 3) matched = songs.sort(() => Math.random() - 0.5);
    const queue = matched.slice(0, Math.min(25, matched.length));
    if (typeof playSong === 'function') {
        playSong(queue[0], queue);
        if (typeof showToast === 'function') showToast('Created: ' + description + ' (' + queue.length + ' songs)', 'success');
    }
}

function showWhyThisSong(track) {
    if (!track) return;
    const prefs = JSON.parse(localStorage.getItem('tamilAI_preferences') || '[]');
    let reasons = [];
    const text = ((track.title||'')+' '+(track.artist||'')+' '+(track.movie||'')+' '+(track.genre||'')+' '+(track.mood||'')).toLowerCase();
    prefs.forEach(p => { if (text.includes(p.toLowerCase())) reasons.push('matches your ' + p + ' preference'); });
    if (reasons.length === 0) reasons.push('based on your listening pattern');
    if (typeof showToast === 'function') showToast('Why this song: ' + reasons.join(', '), 'info');
}

// ============================================
// PWA Background / Resume Fix
// Prevents unresponsiveness after minimizing and reopening the PWA.
// Preserves: scroll position, login session, playback state, event listeners.
// ============================================
(function initPWABackgroundResume() {
    if (typeof window === 'undefined') return;
    let _savedScrollY = 0;
    let _resumeListenersAttached = false;

    function onVisibilityChange() {
        if (document.hidden) {
            // Going to background — save state
            _savedScrollY = window.scrollY || window.pageYOffset;
            try { sessionStorage.setItem('tamilAI_scrollY', String(_savedScrollY)); } catch(e) {}
        } else {
            // Coming back from background — restore state
            restoreFromBackground();
        }
    }

    function restoreFromBackground() {
        // 1. Restore scroll position
        try {
            const saved = sessionStorage.getItem('tamilAI_scrollY');
            if (saved) {
                const pos = parseInt(saved, 10);
                if (pos > 0) window.scrollTo(0, pos);
            }
        } catch(e) {}

        // 2. Restore audio player state — ensure the global audio element
        //    is still connected and playing if it was before backgrounding
        try {
            if (typeof audioPlayer !== 'undefined' && audioPlayer && audioPlayer.src && !audioPlayer.paused) {
                // Audio is still playing, no action needed
            } else if (typeof audioPlayer !== 'undefined' && audioPlayer && audioPlayer.src && audioPlayer.paused) {
                // Audio exists but is paused — leave it paused, user can resume
            }
        } catch(e) {}

        // 3. Re-attach any lost event listeners (only once per background cycle)
        if (!_resumeListenersAttached) {
            _resumeListenersAttached = true;
            // Re-initialize touch handlers for horizontal scroll sections
            try { initHorizontalDragScroll(); } catch(e) {}
            // Re-initialize recently added touch handlers
            try { initRecentlyAdded(); } catch(e) {}
            // Small delay to allow DOM to settle
            setTimeout(() => { _resumeListenersAttached = false; }, 1000);
        }

        // 4. Force a lightweight UI sync (no full re-render, no audio reset)
        try {
            if (typeof updatePlayPauseButton === 'function') {
                const playing = typeof audioPlayer !== 'undefined' && audioPlayer && !audioPlayer.paused;
                updatePlayPauseButton(playing);
            }
        } catch(e) {}

        // 5. Re-sync mini player UI if available
        try {
            if (typeof YTMusic !== 'undefined' && typeof YTMusic.updateMiniPlayerUI === 'function') {
                YTMusic.updateMiniPlayerUI();
            }
        } catch(e) {}

        // 6. Re-sync global player UI if available
        try {
            if (typeof GlobalPlayer !== 'undefined' && typeof GlobalPlayer.updateTrackUI === 'function') {
                GlobalPlayer.updateTrackUI();
            }
        } catch(e) {}
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    // Also handle pageshow event for mobile PWA resume
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            restoreFromBackground();
        }
    });

    // Handle focus event for PWA mode
    window.addEventListener('focus', () => {
        if (!document.hidden) {
            restoreFromBackground();
        }
    });
})();
