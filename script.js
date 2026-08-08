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
        this.init();
    }
    init() { this.resize(); this.createParticles(); this.createNeuralNodes(); this.bindEvents(); this.animate(); }
    resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }
    createParticles() {
        const count = Math.min(Math.floor((this.canvas.width * this.canvas.height) / 8000), 120);
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
                glassIntensity: Math.random() * 0.5 + 0.3,
                trail: []
            });
        }
    }
    createNeuralNodes() {
        const count = Math.min(Math.floor((this.canvas.width * this.canvas.height) / 15000), 20);
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
        window.addEventListener('resize', () => { this.resize(); this.createParticles(); this.createNeuralNodes(); });
        document.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
        document.addEventListener('mouseleave', () => { this.mouse.x = null; this.mouse.y = null; });
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
        requestAnimationFrame(() => this.animate());
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
    startAutoplay() { this.autoplayInterval = setInterval(() => this.next(), 5000); }
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

function initAudioPlayer() {
    if (!audioPlayer) {
        audioPlayer = new Audio();
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
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            persistPlaybackState();
            updatePlayPauseButton(true);
            showLiveStatus(true);
            hideLoadingSpinner();
            if (typeof YTMusic !== 'undefined') {
                YTMusic.isPlaying = true;
                YTMusic.updatePlayerUI();
                YTMusic.updateFullscreenPlayerUI();
                YTMusic.updateMiniPlayerUI();
            }
        });
        audioPlayer.addEventListener('pause', () => {
            isStreamPlaying = false;
            persistPlaybackState();
            updatePlayPauseButton(false);
            showLiveStatus(false);
            if (typeof YTMusic !== 'undefined') {
                YTMusic.isPlaying = false;
                YTMusic.updatePlayerUI();
                YTMusic.updateFullscreenPlayerUI();
                YTMusic.updateMiniPlayerUI();
            }
        });
        audioPlayer.addEventListener('timeupdate', () => {
            if (typeof YTMusic !== 'undefined') {
                YTMusic.progress = audioPlayer.currentTime || 0;
                YTMusic.duration = audioPlayer.duration || 0;
                YTMusic.updateProgressUI();
            }
            persistPlaybackState();
        });
        audioPlayer.addEventListener('durationchange', () => {
            if (typeof YTMusic !== 'undefined') {
                YTMusic.duration = audioPlayer.duration || 0;
                YTMusic.updateProgressUI();
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
            showToast('Buffering... Please wait.', 'info');
        });
        audioPlayer.addEventListener('canplay', () => {
            hideLoadingSpinner();
        });
        audioPlayer.addEventListener('loadstart', () => {
            streamConnecting = true;
        });
        audioPlayer.addEventListener('stalled', () => {
            showToast('Connection stalled. Retrying...', 'info');
        });
        audioPlayer.addEventListener('ended', () => {
            if (playbackRepeat === 'one') {
                audioPlayer.currentTime = 0;
                audioPlayer.play().catch(() => {});
                return;
            }
            if (currentPlaybackQueue.length > 0 && currentPlaybackQueueIndex >= 0) {
                playNextTrack();
            }
        });
    }
}

function stopCurrentStream() {
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.src = '';
        audioPlayer.removeAttribute('src');
        audioPlayer.load();
        isStreamPlaying = false;
        streamConnecting = false;
        playbackHasLoaded = false;
        updatePlayPauseButton(false);
        showLiveStatus(false);
    }
    currentStation = null;
    currentPlaybackTrack = null;
    currentPlaybackMode = 'station';
}

function playStation(stationName) {
    initAudioPlayer();
    stopCurrentStream();
    userPaused = false;
    currentPlaybackMode = 'station';
    currentPlaybackQueue = [];
    currentPlaybackQueueIndex = -1;
    currentPlaybackTrack = null;
    currentPlaylist = [];
    currentSongIndex = -1;
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
                if (typeof YTMusic !== 'undefined') {
                    YTMusic.currentTrack = currentPlaybackTrack;
                    YTMusic.isPlaying = true;
                    YTMusic.updatePlayerUI();
                    YTMusic.updateFullscreenPlayerUI();
                    YTMusic.updateMiniPlayerUI();
                }
                hideLoadingSpinner();
                showToast(`Now playing: ${stationInfo.name}`, 'success');
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
        thumbnail: song.albumCover || song.cover || '',
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
            updateNowPlayingBar(song.title, `${song.artist} • ${song.movie}`);
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
            showToast(`Now playing: ${song.title}`, 'success');
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
        updateNowPlayingBar(song.title, `${song.artist} • ${song.movie}`);
    }
}

function playTrackFromYTMusic(track, meta = {}) {
    if (!track) return;
    if (track.streamUrl) {
        playStation(track.title || track.artist || 'Tamil Hits Songs');
        return;
    }
    const song = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        movie: track.movie || '',
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
        audioPlayer.currentTime = 0;
        if (currentPlaybackMode === 'station') {
            audioPlayer.removeAttribute('src');
        }
        isStreamPlaying = false;
        updatePlayPauseButton(false);
        showLiveStatus(false);
        persistPlaybackState();
    }
}

function resumePlayback() {
    if (!audioPlayer) return;
    if (audioPlayer.paused) {
        audioPlayer.play().catch(() => {});
    }
}

function seekPlaybackToPercent(percent) {
    if (!audioPlayer || Number.isNaN(audioPlayer.duration)) return;
    const derived = Math.max(0, Math.min(1, percent));
    audioPlayer.currentTime = derived * audioPlayer.duration;
    persistPlaybackState();
}

function setPlaybackVolume(volume) {
    playbackVolume = Math.max(0, Math.min(1, volume));
    if (audioPlayer) {
        audioPlayer.volume = playbackVolume;
    }
    persistPlaybackState();
}

function playNextTrack() {
    if (currentPlaybackQueue.length === 0) return;
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
    if (currentPlaybackQueue.length === 0) return;
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
        showToast('Playback paused', 'info');
    }
}

function togglePlayPause() {
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
        } else {
            showToast('Please select a station or song to play', 'info');
        }
    } else {
        showToast('Please select a station or song to play', 'info');
    }
}

function getStationInfo(stationName) {
    const station = DataStore.getStations().find(s => s.name === stationName);
    if (station) return { name: station.name, freq: `${station.freq} • ${station.genre || 'Music'}` };
    return { name: stationName, freq: 'FM' };
}

function updatePlayPauseButton(playing) {
    const playButtons = document.querySelectorAll('.slide-play-btn, .station-play-overlay i, .recent-play-btn i, .song-play-btn i, .playlist-song-play i');
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

function showLiveStatus(isLive) {
    const liveBadges = document.querySelectorAll('.sg-live-badge, .slide-badge');
    liveBadges.forEach(badge => {
        if (isLive) {
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
            showToast('🔔 You have 3 new notifications', 'info');
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
        } else if (text === 'Clear History') {
            document.querySelector('.recent-list').innerHTML = '<div class="recent-item" style="justify-content:center;padding:24px;color:var(--text-muted)"><p>No recently played stations</p></div>';
            showToast('Recently played history cleared', 'info');
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
        document.querySelector('.now-playing-station').textContent = `${freq} • ${genre}`;
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
        <div class="song-card" style="animation-delay: ${index * 0.05}s">
            <div class="song-card-header">
                <div class="song-thumbnail">
                    <img src="${song.albumCover || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Ccircle cx="40" cy="40" r="30" fill="%2334d399" opacity="0.3"/%3E%3C/svg%3E'}" alt="${song.title || 'Song'}">
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
        
        sectionOrder.forEach(type => {
            const section = mainContent.querySelector(`[data-section="${type}"]`);
            if (section) mainContent.appendChild(section);
        });
        
        allSections.forEach(section => {
            const type = section.dataset.section;
            if (!sectionOrder.includes(type)) {
                section.style.display = 'none';
            } else {
                section.style.display = '';
            }
        });
    } catch (err) {
        console.warn('Layout sync error:', err);
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
// Top Header - Live Time, Date & Quotes
// ============================================
function initTopHeader() {
    const dateEl = document.getElementById('liveDate');
    const timeEl = document.getElementById('liveTime');
    const quoteEl = document.getElementById('tamilQuote');
    
    if (!dateEl && !timeEl && !quoteEl) return; // No top header elements
    
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
    
    // Tamil quotes rotation from DataStore
    let tamilQuotes = [];
    try {
        const quotes = DataStore.getQuotes();
        if (Array.isArray(quotes)) {
            tamilQuotes = quotes.filter(q => q && q.status === 'active').map(q => q.text).filter(Boolean);
        }
    } catch (error) {
        console.warn('Quote data unavailable:', error);
    }
    if (!tamilQuotes.length) {
        tamilQuotes = [];
    }
    
    let quoteIndex = 0;
    
    function updateQuote() {
        if (quoteEl) {
            quoteEl.style.opacity = '0';
            quoteEl.style.transform = 'translateY(10px)';
            setTimeout(() => {
                quoteEl.textContent = tamilQuotes[quoteIndex];
                quoteEl.style.opacity = '1';
                quoteEl.style.transform = 'translateY(0)';
                quoteIndex = (quoteIndex + 1) % tamilQuotes.length;
            }, 300);
        }
    }
    
    // Initial updates
    updateDate();
    updateTime();
    updateQuote();
    
    // Intervals
    setInterval(updateDate, 60000); // Update date every minute
    setInterval(updateTime, 1000); // Update time every second
    setInterval(updateQuote, 15000); // Rotate quotes every 15 seconds
}

// ============================================
// Admin Check - Show Builder Link for Admin Only
// ============================================
function checkAdminAndShowBuilder() {
    const builderNavLink = document.getElementById('builderNavLink');
    if (!builderNavLink) return;
    
    // Default: hide builder
    builderNavLink.style.display = 'none';
    
    // Check if user is guest - NEVER show builder for guests
    const isGuest = localStorage.getItem('tamilAIStream_guest');
    if (isGuest === 'true') {
        return;
    }
    
    // Check for admin session (logged in via builder page)
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
        try {
            const sessionData = JSON.parse(adminSession);
            if (sessionData.username === 'admin@tamilaistream.com' && sessionData.expiry > Date.now()) {
                builderNavLink.style.display = 'flex';
                return;
            }
        } catch (e) {
            // Invalid session, continue checking
        }
    }
    
    // Check for admin logged in via main login page
    const storedUser = localStorage.getItem('tamilAIStream_user');
    if (storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            if (userData.email === 'admin@tamilaistream.com') {
                builderNavLink.style.display = 'flex';
                return;
            }
        } catch (e) {
            // Invalid user data
        }
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
                    <p>${item.subtitle || station.freq + ' • ' + station.city || ''}</p>
                    <span class="slide-listeners"><i class="fas fa-headphones"></i> ${(item.listeners || station.listeners || 0).toLocaleString()} listening</span>
                    <button class="slide-play-btn" onclick="playStation('${station.name || item.title}')"><i class="fas fa-play"></i> Listen Now</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Reinitialize slider
    if (window._featuredSlider) window._featuredSlider.destroy();
    window._featuredSlider = new FeaturedSlider();
}

// Render Trending Section from DataStore
function renderTrendingDynamic() {
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
            <div class="station-card" data-genre="${(station.genre || '').toLowerCase()}" onclick="playStation('${station.name || ''}')">
                <div class="station-art" style="background:${station.gradient || 'linear-gradient(135deg,#1e3a5f,#0d1f3c)'};">
                    <img src="${thumbSrc}" alt="${station.name || ''}" ${station.thumbnail ? 'style="width:100%;height:100%;object-fit:cover;"' : ''}>
                    <div class="station-play-overlay"><i class="fas fa-play"></i></div>
                </div>
                <div class="station-info">
                    <h3>${station.name || 'Station'}</h3>
                    <p>${station.genre || ''} • ${station.freq || ''}</p>
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
                    <p class="sg-genre">${station.genre} • ${station.city || 'Chennai'}</p>
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
function renderAIRecommendedDynamic() {
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
        <div class="station-card recommended" data-genre="${(station.genre || '').toLowerCase()}" onclick="playStation('${station.name}')">
            <div class="station-art" style="background:${station.gradient || 'linear-gradient(135deg,#0f3b2e,#064e3b)'};">
                <img src="${thumbSrc}" alt="${station.name}" ${station.thumbnail ? 'style="width:100%;height:100%;object-fit:cover;"' : ''}>
                <div class="station-play-overlay"><i class="fas fa-play"></i></div>
                <div class="ai-recommend-badge"><i class="fas fa-brain"></i> ${98 - i * 3}% Match</div>
            </div>
            <div class="station-info">
                <h3>${station.name}</h3>
                <p>${station.genre} • ${station.freq}</p>
                <span class="station-listeners"><i class="fas fa-headphones"></i> ${((station.listeners || 0) / 1000).toFixed(1)}K</span>
            </div>
        </div>
        `;
    }).join('');
}

// Render Recently Played from DataStore
function renderRecentlyPlayedDynamic() {
    const container = document.querySelector('.recent-list');
    if (!container) return;
    
    const recent = DataStore.get(DataStore.KEYS.RECENT_PLAYED) || [];
    const stations = DataStore.getStations();
    
    if (!recent.length) {
        container.innerHTML = '<div class="recent-item" style="justify-content:center;padding:24px;color:var(--text-muted)"><p>No recently played stations</p></div>';
        return;
    }
    
    container.innerHTML = recent.slice(0, 5).map(item => {
        const station = stations.find(s => s.name === item.name) || {};
        return `
            <div class="recent-item">
                <div class="recent-thumb" style="background:${station.gradient || 'linear-gradient(135deg,#0f3b2e,#064e3b)'};"></div>
                <div class="recent-info">
                    <h4>${item.name || 'Station'}</h4>
                    <p>${station.genre || ''} • ${station.freq || ''}</p>
                </div>
                <span class="recent-time">${item.time || 'Recently'}</span>
                <button class="recent-play-btn" onclick="playStation('${item.name || ''}')"><i class="fas fa-play"></i></button>
            </div>
        `;
    }).join('');
}

// Apply Site Settings to page
function applySiteSettings() {
    const settings = DataStore.getSiteSettings();
    if (!settings) return;
    
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

// Render all dynamic content
function renderAllDynamicContent() {
    renderFeaturedSliderDynamic();
    renderTrendingDynamic();
    renderCategoriesDynamic();
    renderArtistHitsDynamic();
    renderAllStationsDynamic();
    renderAIRecommendedDynamic();
    renderRecentlyPlayedDynamic();
    applySiteSettings();
    
    // Re-render songs
    loadSongs(true).then(songs => {
        displaySongs(songs);
        renderTickerItems(songs);
    });
}

// ============================================
// Real-time Sync - Listen for DataStore Changes
// ============================================
function setupRealtimeSync() {
    // Listen for any data change from builder
    DataStore.on('change', (event) => {
        console.log('[Realtime] Data changed:', event.keyName);
        
        switch (event.keyName) {
            case 'STATIONS':
                renderAllStationsDynamic();
                renderFeaturedSliderDynamic();
                renderTrendingDynamic();
                renderAIRecommendedDynamic();
                break;
            case 'FEATURED':
                renderFeaturedSliderDynamic();
                break;
            case 'TRENDING':
                renderTrendingDynamic();
                break;
            case 'CATEGORIES':
                renderCategoriesDynamic();
                break;
            case 'ARTIST_HITS':
                renderArtistHitsDynamic();
                break;
            case 'QUOTES':
                initTopHeader();
                break;
            case 'SITE_SETTINGS':
                applySiteSettings();
                break;
            case 'SONGS':
                loadSongs(true).then(songs => {
                    displaySongs(songs);
                    renderTickerItems(songs);
                });
                break;
            case 'LAYOUT':
                setupLayoutSync();
                break;
            case 'IMAGES':
                renderAllStationsDynamic();
                renderFeaturedSliderDynamic();
                renderTrendingDynamic();
                renderArtistHitsDynamic();
                break;
            case 'PLAYLISTS':
                // Reload playlist-related content
                break;
            case 'LIKED_SONGS':
                // Reload liked songs
                break;
            case 'SETTINGS':
                // Reload YT Music settings
                break;
        }
    });
}

// ============================================
// Stations Filter & Search
// ============================================
function filterStations() {
    const stationsGrid = document.getElementById('stationsGrid');
    const stationsSearch = document.getElementById('stationsSearch');
    const stationsCount = document.getElementById('stationsCount');
    if (!stationsGrid) return;
    
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const query = stationsSearch?.value.toLowerCase().trim() || '';
    const cards = stationsGrid.querySelectorAll('.station-grid-card');
    let visibleCount = 0;
    
    cards.forEach(card => {
        const genre = card.dataset.genre || '';
        const name = card.dataset.name?.toLowerCase() || '';
        const freq = card.dataset.freq?.toLowerCase() || '';
        const matchesFilter = activeFilter === 'all' || genre === activeFilter;
        const matchesSearch = !query || name.includes(query) || genre.includes(query) || freq.includes(query);
        const isVisible = matchesFilter && matchesSearch;
        card.classList.toggle('hidden', !isVisible);
        if (isVisible) visibleCount++;
    });
    
    if (stationsCount) stationsCount.textContent = `${visibleCount} station${visibleCount !== 1 ? 's' : ''}`;
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    
    // Check admin and show builder link
    checkAdminAndShowBuilder();
    
    // Initialize UI components
    new ParticleSystem('particles-canvas');
    
    // Initialize top header
    initTopHeader();
    
    // Render all dynamic content from DataStore
    renderAllDynamicContent();
    
    // Setup real-time sync from builder
    setupRealtimeSync();
    
    // Setup layout sync from builder
    setupLayoutSync();
    
    // Setup ticker sync
    setupTickerSync();
    
    // Initialize ticker
    initTicker();
    
    // Setup filter and search after a small delay to ensure DOM is ready
    setTimeout(() => {
        // Re-bind filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterStations();
            });
        });
        
        // Re-bind search
        const searchInput = document.getElementById('stationsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', filterStations);
        }
        
        // Apply filter
        filterStations();
    }, 200);
    
    console.log('%c🎙️ Tamil AI Stream', 'font-size:24px;font-weight:bold;color:#34d399;');
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
                    artist: station.freq + ' • ' + station.genre,
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
                    thumbnail: song.cover || '',
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

function setupTickerSync() {
    DataStore.on('change', (event) => {
        if (event.keyName === 'SONGS') {
            loadSongs(true).then(songs => {
                renderTickerItems(songs);
            });
        }
    });
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
    window.playTickerSong = playTickerSong;
}