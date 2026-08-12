'use strict';
/* ============================================================
   TamilAI.Stream — Dashboard Controller
   Wires the premium dashboard to the EXISTING data + player/FM
   systems:
     • Data : DataStore + ContentSync (Firebase / R2)
     • Player: shares the same window.audioPlayer contract and
       drives GlobalPlayer.init() (the existing bottom player)
     • FM   : playStation / toggleStationFromCard / playSong with
       Play-Pause-Resume-Next-Prev-Seek and cross-page state sync.
   ============================================================ */

(function () {
    const isPreview = !!window.__BUILDER_PREVIEW__;

    /* ---------- shared state (mirrors script.js contract) ---------- */
    let audioPlayer = null;
    let userPaused = false;
    let currentStation = null;
    let isStreamPlaying = false;
    let streamConnecting = false;
    let currentPlaybackMode = 'station';
    let currentPlaybackTrack = null;
    let currentPlaybackQueue = [];
    let currentPlaybackQueueIndex = -1;
    let playbackVolume = 0.7;

    /* ---------- helpers ---------- */
    const $ = (id) => document.getElementById(id);

    function esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function activeStations() {
        if (typeof DataStore === 'undefined') return [];
        try { return (DataStore.getStations() || []).filter(s => s && s.status === 'active'); } catch (e) { return []; }
    }

    function publishedSongs() {
        if (typeof DataStore === 'undefined') return [];
        try {
            return (DataStore.getSongs() || [])
                .filter(s => s && (s.status === 'published' || s.status === 'active'))
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } catch (e) { return []; }
    }

    function thumbOf(item, fallbackColor) {
        return item.thumbnail || item.cover || item.image ||
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%230d1118'/%3E%3Ccircle cx='100' cy='100' r='64' fill='" + (fallbackColor || '%2334d399') + "' opacity='0.28'/%3E%3Ccircle cx='100' cy='100' r='40' fill='" + (fallbackColor || '%2334d399') + "' opacity='0.4'/%3E%3Cpath d='M88 78 L88 128 L124 103 Z' fill='" + (fallbackColor || '%2334d399') + "' opacity='0.55'/%3E%3C/svg%3E";
    }

    function freqLabel(station) { return station.freq ? station.freq + ' FM' : 'FM'; }
    function fmtTime(sec) {
        if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    let toastTimer = null;
    function showToast(msg, type) {
        let t = $('dashToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'dashToast';
            t.className = 'dash-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.className = 'dash-toast show' + (type === 'error' ? ' dash-toast-error' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
    }
/* ---------- audio setup ---------- */
    function initAudioPlayer() {
        if (audioPlayer) return;
        audioPlayer = new Audio();
        window.audioPlayer = audioPlayer;
        audioPlayer.preload = 'auto';
        audioPlayer.volume = playbackVolume;

        audioPlayer.addEventListener('playing', () => {
            if (userPaused) return;
            isStreamPlaying = true;
            streamConnecting = false;
            syncAllUI(true);
            persistState();
        });
        audioPlayer.addEventListener('pause', () => {
            isStreamPlaying = false;
            streamConnecting = false;
            syncAllUI(false);
            persistState();
        });
        audioPlayer.addEventListener('timeupdate', () => {
            if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.updateProgressUI) {
                GlobalPlayer.updateProgressUI();
            }
        });
        audioPlayer.addEventListener('ended', () => {
            if (currentPlaybackMode === 'song') playNextTrack();
        });
    }

    function stopCurrentStream() {
        if (!audioPlayer) return;
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.removeAttribute('src');
        audioPlayer.load();
        isStreamPlaying = false;
        streamConnecting = false;
        currentStation = null;
        currentPlaybackTrack = null;
    }

    /* ---------- UI sync ---------- */
    function syncAllUI(playing) {
        if (typeof GlobalPlayer !== 'undefined') {
            if (GlobalPlayer.updatePlayUI) GlobalPlayer.updatePlayUI(playing);
            if (GlobalPlayer.updateTrackUI) GlobalPlayer.updateTrackUI();
            if (GlobalPlayer.updateLiveUI) GlobalPlayer.updateLiveUI();
        }
        updateStationCardStates(playing);
        updateSongCardStates(playing);
        const liveStat = $('dashLiveStat');
        if (liveStat) {
            liveStat.textContent = playing ? '● LIVE' : '●';
            liveStat.classList.toggle('live', !!playing);
        }
    }

    function updateStationCardStates(playing) {
        document.querySelectorAll('.premium-radio-card').forEach(card => {
            const name = (card.querySelector('h4') || card).textContent.trim();
            const icon = card.querySelector('.premium-radio-play');
            const isActive = playing && currentPlaybackMode === 'station' && name === currentStation;
            card.classList.toggle('active-station', isActive);
            card.classList.toggle('playing-station', isActive);
            if (icon) icon.className = isActive ? 'fa-solid fa-pause premium-radio-play' : 'fa-solid fa-play premium-radio-play';
        });
    }

    function updateSongCardStates(playing) {
        document.querySelectorAll('.dash-song-card').forEach(card => {
            const id = card.dataset.songId;
            const icon = card.querySelector('.dash-song-play i');
            const isActive = playing && currentPlaybackMode === 'song' && currentPlaybackTrack && currentPlaybackTrack.id === id;
            card.classList.toggle('playing', isActive);
            if (icon) icon.className = isActive ? 'fa-solid fa-pause' : 'fa-solid fa-play';
        });
    }

    /* ---------- state persistence (cross-page sync with main site) ---------- */
    function persistState() {
        if (!audioPlayer) return;
        try {
            localStorage.setItem('tamilAIStream_player_state', JSON.stringify({
                currentStation, currentPlaybackMode, currentPlaybackTrack,
                currentPlaybackQueue, currentPlaybackQueueIndex,
                currentPlaylist: currentPlaybackQueue, currentSongIndex: currentPlaybackQueueIndex,
                isStreamPlaying, streamConnecting, playbackVolume,
                progress: audioPlayer.currentTime || 0, duration: audioPlayer.duration || 0,
                timestamp: Date.now()
            }));
        } catch (e) { /* ignore quota errors */ }
    }
/* ============================================================
     FM + Song playback (reuses the shared window contract)
     ============================================================ */
    function playStation(stationName) {
        if (isPreview) return;
        initAudioPlayer();
        const stations = activeStations();
        const station = stations.find(s => s.name === stationName) ||
            (typeof DataStore !== 'undefined' ? (DataStore.getStations() || []).find(s => s.name === stationName) : null);
        if (!station || !station.streamUrl) {
            showToast('Stream unavailable for ' + stationName, 'error');
            return;
        }
        stopCurrentStream();
        userPaused = false;
        currentPlaybackMode = 'station';
        currentPlaybackQueue = [];
        currentPlaybackQueueIndex = -1;
        currentStation = stationName;
        currentPlaybackTrack = {
            id: 'station_' + stationName,
            title: stationName,
            artist: (station.freq ? station.freq + ' FM · ' : '') + (station.genre || 'Live FM'),
            thumbnail: station.thumbnail || station.cover || '',
            streamUrl: station.streamUrl
        };

        showToast('Tuning in to ' + stationName + '…');
        streamConnecting = true;
        audioPlayer.volume = playbackVolume;
        audioPlayer.src = station.streamUrl;
        audioPlayer.load();
        const p = audioPlayer.play();
        if (p && p.then) {
            p.then(() => {
                streamConnecting = false;
                syncAllUI(true);
                persistState();
                showToast('Now playing: ' + stationName, 'success');
            }).catch(() => {
                streamConnecting = false;
                showToast('Unable to connect to ' + stationName, 'error');
            });
        }
        updateStationCardStates(true);
        persistState();
    }

    function toggleStationFromCard(card, stationName) {
        if (isStreamPlaying && currentPlaybackMode === 'station' && currentStation === stationName) {
            pausePlayback();
        } else {
            playStation(stationName);
        }
    }

    function playSong(song, playlist) {
        if (isPreview) return;
        if (!song || !song.audioUrl) { showToast('No audio available for this track', 'error'); return; }
        initAudioPlayer();
        stopCurrentStream();
        userPaused = false;
        currentPlaybackMode = 'song';
        currentPlaybackQueue = (playlist && playlist.length) ? playlist.slice() : [song];
        currentPlaybackQueueIndex = currentPlaybackQueue.findIndex(t => t.id === song.id);
        if (currentPlaybackQueueIndex < 0) currentPlaybackQueueIndex = 0;
        loadSongTrack(song);
    }

    function loadSongTrack(song) {
        currentPlaybackTrack = {
            id: song.id,
            title: song.title || 'Untitled',
            artist: song.artist || song.singers || 'Tamil AI Stream',
            thumbnail: song.cover || song.thumbnail || '',
            audioUrl: song.audioUrl,
            duration: song.duration || 0
        };
        audioPlayer.volume = playbackVolume;
        audioPlayer.src = song.audioUrl;
        audioPlayer.load();
        const p = audioPlayer.play();
        if (p && p.then) {
            p.then(() => {
                syncAllUI(true);
                persistState();
            }).catch(() => {
                showToast('Unable to play ' + currentPlaybackTrack.title, 'error');
                syncAllUI(false);
            });
        }
        updateSongCardStates(true);
        persistState();
    }

    function pausePlayback() {
        userPaused = true;
        if (audioPlayer && !audioPlayer.paused) audioPlayer.pause();
        syncAllUI(false);
        persistState();
    }

    function resumePlayback() {
        if (!audioPlayer) return;
        if (audioPlayer.src && audioPlayer.paused) {
            userPaused = false;
            const p = audioPlayer.play();
            if (p && p.catch) p.catch(() => syncAllUI(false));
            syncAllUI(true);
            persistState();
        }
    }

    function togglePlay() {
        if (audioPlayer && audioPlayer.src) {
            if (audioPlayer.paused) resumePlayback();
            else pausePlayback();
        } else if (currentStation || currentPlaybackTrack) {
            resumePlayback();
        } else {
            const stations = activeStations();
            if (stations.length) playStation(stations[0].name);
        }
    }

    function seekPlaybackToPercent(percent) {
        if (!audioPlayer) return;
        try {
            const dur = (isFinite(audioPlayer.duration) && audioPlayer.duration > 0) ? audioPlayer.duration : (currentPlaybackTrack && currentPlaybackTrack.duration) || 0;
            if (dur > 0) {
                audioPlayer.currentTime = Math.max(0, Math.min(dur, (percent / 100) * dur));
                if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.updateProgressUI) GlobalPlayer.updateProgressUI();
            }
        } catch (e) { /* live stream: seeking not supported */ }
    }
    function playNextTrack() {
        if (currentPlaybackMode !== 'song' || !currentPlaybackQueue.length) return;
        const next = currentPlaybackQueueIndex + 1;
        if (next >= currentPlaybackQueue.length) {
            pausePlayback();
            showToast('End of queue', 'info');
            return;
        }
        currentPlaybackQueueIndex = next;
        loadSongTrack(currentPlaybackQueue[next]);
    }

    function playPreviousTrack() {
        if (currentPlaybackMode !== 'song' || !currentPlaybackQueue.length) return;
        const prev = currentPlaybackQueueIndex - 1;
        if (prev < 0) return;
        currentPlaybackQueueIndex = prev;
        loadSongTrack(currentPlaybackQueue[prev]);
    }

    /* ---------- expose to the existing player contract ---------- */
    window.playStation = playStation;
    window.toggleStationFromCard = toggleStationFromCard;
    window.playSong = playSong;
    window.playSongById = (id) => { const s = publishedSongs().find(x => x.id === id); if (s) playSong(s, publishedSongs()); };
    window.pausePlayback = pausePlayback;
    window.resumePlayback = resumePlayback;
    window.togglePlay = togglePlay;
    window.seekPlaybackToPercent = seekPlaybackToPercent;
    window.playNextTrack = playNextTrack;
    window.playPreviousTrack = playPreviousTrack;
    Object.defineProperty(window, 'isStreamPlaying', {
        get: () => isStreamPlaying,
        set: v => { isStreamPlaying = !!v; }
    });
    Object.defineProperty(window, 'currentStation', {
        get: () => currentStation,
        set: v => { currentStation = v; }
    });
/* ============================================================
     Rendering (real data from DataStore)
     ============================================================ */
    let radioFilter = 'all';

    function radioCardHTML(station) {
        const g = station.gradient || 'linear-gradient(135deg,#0f3b2e,#064e3b)';
        const listeners = station.listeners || 0;
        return '' +
            '<div class="premium-radio-card" data-name="' + esc(station.name) + '" data-genre="' + esc((station.genre || 'Music').toLowerCase()) + '">' +
            '  <div class="premium-radio-art" style="background:' + esc(g) + ';">' +
            '    <img src="' + esc(thumbOf(station)) + '" alt="' + esc(station.name) + '" loading="lazy">' +
            '    <span class="premium-radio-live">LIVE</span>' +
            '    <span class="premium-radio-freq">' + esc(freqLabel(station)) + '</span>' +
            '    <i class="fa-solid fa-play premium-radio-play" aria-hidden="true"></i>' +
            '  </div>' +
            '  <div class="premium-radio-body">' +
            '    <h4>' + esc(station.name) + '</h4>' +
            '    <div class="premium-radio-meta">' + esc(freqLabel(station)) + ' · ' + esc(station.genre || 'Music') + '</div>' +
            '    <div class="premium-radio-tags">' +
            (station.city ? '<span class="premium-radio-tag"><i class="fas fa-location-dot"></i>' + esc(station.city) + '</span>' : '') +
            '      <span class="premium-radio-tag"><i class="fas fa-headphones"></i>' + (listeners >= 1000 ? (listeners / 1000).toFixed(1) + 'K' : listeners) + '</span>' +
            '    </div>' +
            '  </div>' +
            '</div>';
    }

    function renderFilters() {
        const holder = $('dashRadioFilters');
        if (!holder) return;
        const stations = activeStations();
        const genreSet = new Set();
        stations.forEach(s => { if (s.genre) genreSet.add(s.genre.toLowerCase()); });
        const genres = Array.from(genreSet).sort();
        let html = '<button type="button" class="dash-chip active" data-genre="all">All</button>';
        genres.forEach(g => { html += '<button type="button" class="dash-chip" data-genre="' + esc(g) + '">' + esc(g.charAt(0).toUpperCase() + g.slice(1)) + '</button>'; });
        holder.innerHTML = html;
        holder.querySelectorAll('.dash-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                radioFilter = chip.dataset.genre;
                holder.querySelectorAll('.dash-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                applyFilter();
            });
        });
    }

    function applyFilter() {
        let visible = 0;
        document.querySelectorAll('#dashRadioGrid .premium-radio-card').forEach(card => {
            const ok = radioFilter === 'all' || card.dataset.genre === radioFilter;
            card.classList.toggle('hidden', !ok);
            if (ok) visible++;
        });
        if ($('dashRadioEmpty')) $('dashRadioEmpty').style.display = visible ? 'none' : 'block';
    }

    function renderRadio() {
        const container = $('dashRadioGrid');
        if (!container) return;
        const stations = activeStations();
        const countEl = $('dashRadioCount');
        if (countEl) countEl.textContent = stations.length + (stations.length === 1 ? ' station' : ' stations');
        if (!stations.length) {
            if ($('dashRadioEmpty')) $('dashRadioEmpty').style.display = 'block';
            container.innerHTML = '';
            return;
        }
        if ($('dashRadioEmpty')) $('dashRadioEmpty').style.display = 'none';
        container.innerHTML = stations.map(radioCardHTML).join('');
        container.querySelectorAll('.premium-radio-card').forEach((card, i) => {
            card.style.animationDelay = Math.min(i * 0.045, 0.6) + 's';
            const name = (card.querySelector('h4') || card).textContent.trim();
            card.addEventListener('click', () => {
                window.toggleStationFromCard(card, name);
                setTimeout(() => updateStationCardStates(isStreamPlaying), 80);
            });
        });
        renderFilters();
        updateStationCardStates(isStreamPlaying);
    }
    function songCardHTML(song, i) {
        const dur = song.duration || 0;
        return '' +
            '<div class="dash-song-card" data-song-id="' + esc(song.id || '') + '" style="animation-delay:' + Math.min(i * 0.04, 0.5) + 's">' +
            '  <div class="dash-song-art" style="background:linear-gradient(135deg,#101c33,#0a1424);">' +
            '    <img src="' + esc(thumbOf(song, '%2338bdf8')) + '" alt="' + esc(song.title || 'Song') + '" loading="lazy">' +
            (dur > 0 ? '<span class="dash-song-duration">' + fmtTime(dur) + '</span>' : '') +
            '    <div class="dash-song-play"><i class="fa-solid fa-play"></i></div>' +
            '  </div>' +
            '  <div class="dash-song-body">' +
            '    <div class="dash-song-title">' + esc(song.title || 'Untitled') + '</div>' +
            '    <div class="dash-song-artist">' + esc(song.artist || song.singers || 'Tamil AI Stream') + '</div>' +
            '  </div>' +
            '</div>';
    }

    function renderSongs() {
        const grid = $('dashSongGrid');
        const loading = $('dashSongLoading');
        const empty = $('dashSongEmpty');
        if (!grid) return;
        const songs = publishedSongs();
        if (loading) loading.style.display = 'none';
        if (!songs.length) {
            if (empty) empty.style.display = 'block';
            grid.innerHTML = '';
            return;
        }
        if (empty) empty.style.display = 'none';
        const shown = songs.slice(0, 12);
        grid.innerHTML = shown.map(songCardHTML).join('');
        grid.querySelectorAll('.dash-song-card').forEach(card => {
            const id = card.dataset.songId;
            card.addEventListener('click', () => {
                const song = shown.find(s => s.id === id);
                if (song) playSong(song, shown);
            });
        });
        updateSongCardStates(isStreamPlaying);
    }

    function updateHeroStats() {
        const sc = $('dashStationCount'), so = $('dashSongCount');
        if (sc) sc.textContent = activeStations().length || (typeof DataStore !== 'undefined' ? (DataStore.getStations() || []).length : 0);
        if (so) so.textContent = publishedSongs().length;
    }

    function renderAll() {
        renderRadio();
        renderSongs();
        updateHeroStats();
    }

    function loadUserName() {
        try {
            const raw = localStorage.getItem('tamilAIStream_user');
            if (raw) {
                const u = JSON.parse(raw);
                const name = u.name || u.displayName || u.email;
                if (name && $('dashUserName')) {
                    const first = String(name).split(' ')[0];
                    $('dashUserName').textContent = first.charAt(0).toUpperCase() + first.slice(1);
                }
            }
        } catch (e) { /* use default greeting */ }
    }
/* ---------- particle background (lightweight) ---------- */
    function initParticles() {
        const canvas = $('particles-canvas');
        if (!canvas || isPreview || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const ctx = canvas.getContext('2d');
        let W = 0, H = 0;
        const pts = [];
        function resize() {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W; canvas.height = H;
        }
        resize();
        window.addEventListener('resize', resize);
        for (let i = 0; i < 42; i++) {
            pts.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.5, dy: Math.random() * 0.3 + 0.06, o: Math.random() * 0.4 + 0.1 });
        }
        let raf;
        function draw() {
            ctx.clearRect(0, 0, W, H);
            pts.forEach(p => {
                p.y = (p.y - p.dy + H) % H;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(52,211,153,' + p.o + ')';
                ctx.fill();
            });
            raf = requestAnimationFrame(draw);
        }
        draw();
    }

    /* ---------- data bootstrap (Firebase / R2 real content) ---------- */
    async function bootstrapData() {
        try {
            if (typeof ContentSync !== 'undefined' && ContentSync.bootstrapSharedContent) {
                await ContentSync.bootstrapSharedContent();
            }
        } catch (e) { /* keep whatever DataStore already has */ }
        renderAll();
    }

    /* ---------- navigation / ui ---------- */
    function bindUI() {
        const startBtn = $('dashStartListening');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const stations = activeStations();
                if (stations.length) playStation(stations[0].name);
                else if ($('dashRadioEmpty')) $('dashRadioEmpty').scrollIntoView({ behavior: 'smooth' });
            });
        }
        const radioBtn = $('dashOpenRadio');
        if (radioBtn) radioBtn.addEventListener('click', () => {
            const grid = $('dashRadioGrid');
            if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        const exploreBtn = $('dashExplore');
        if (exploreBtn) exploreBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
        const fullBtn = $('dashFullPlayer');
        if (fullBtn) fullBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
        const logoutBtn = $('dashLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (typeof Auth !== 'undefined' && Auth.logout) Auth.logout();
                else try { localStorage.removeItem('tamilAIStream_user'); } catch (e) {}
                window.location.href = 'index.html';
            });
        }
    }

    /* ---------- init ---------- */
    function init() {
        if (typeof PlayerEngine !== 'undefined' && PlayerEngine.init) PlayerEngine.init();
        initAudioPlayer();
        initParticles();
        loadUserName();
        bindUI();
        renderAll();

        // Existing bottom player + cross-page state restore
        if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.init) GlobalPlayer.init();

        // Re-render when the Builder/Firebase pushes new content
        if (typeof DataStore !== 'undefined' && DataStore.on) {
            DataStore.on('change', () => { renderAll(); syncAllUI(isStreamPlaying); });
        }

        // Pull authoritative content from R2/Firebase, then re-render
        bootstrapData();

        // Keep card states in sync with any external pause/play
        document.addEventListener('play', (e) => { if (e.target === audioPlayer) syncAllUI(true); }, true);
        document.addEventListener('pause', (e) => { if (e.target === audioPlayer) syncAllUI(false); }, true);
        setInterval(() => updateStationCardStates(isStreamPlaying), 1500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();