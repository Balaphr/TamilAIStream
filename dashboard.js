'use strict';
/* ============================================================
   TamilAI.Stream — Command Center Dashboard Controller
   Premium AI-powered admin dashboard.
   Keeps ALL existing audio/player/FM/data systems intact.
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
    const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

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

    function allSongs() {
        if (typeof DataStore === 'undefined') return [];
        try { return DataStore.getSongs() || []; } catch (e) { return []; }
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
    function timeAgo(dateStr) {
        if (!dateStr) return 'Never';
        const diff = Date.now() - new Date(dateStr).getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        return Math.floor(diff / 86400000) + 'd ago';
    }
    function fmtBytes(bytes) {
        if (!bytes || isNaN(bytes)) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    let toastTimer = null;
    function showToast(msg, type) {
        let t = $('ccToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'ccToast';
            t.className = 'cc-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.className = 'cc-toast show' + (type === 'error' ? ' cc-toast-error' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
    }

    /* ---------- animated counter ---------- */
    function animateCounter(el, target, suffix) {
        if (!el) return;
        suffix = suffix || '';
        const start = parseInt(el.textContent) || 0;
        if (start === target) { el.textContent = target + suffix; return; }
        const dur = 800;
        const startTime = performance.now();
        function step(now) {
            const progress = Math.min((now - startTime) / dur, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (target - start) * ease);
            el.textContent = current + suffix;
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    /* ============================================================
       AUDIO SETUP (all existing player contract preserved)
       ============================================================ */
    function initAudioPlayer() {
        if (audioPlayer) return;
        audioPlayer = new Audio();
        window.audioPlayer = audioPlayer;
        audioPlayer.preload = 'metadata';
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
        const preservedPosition = audioPlayer.currentTime;
        audioPlayer.pause();
        if (!isStreamPlaying) {
            audioPlayer.removeAttribute('src');
            audioPlayer.load();
        }
        isStreamPlaying = false;
        streamConnecting = false;
        currentStation = null;
        currentPlaybackTrack = null;
        if (window.__PLAYBACK_POSITION__) window.__PLAYBACK_POSITION__ = preservedPosition;
    }

    /* ---------- UI sync ---------- */
    function syncAllUI(playing) {
        if (typeof GlobalPlayer !== 'undefined') {
            if (GlobalPlayer.updatePlayUI) GlobalPlayer.updatePlayUI(playing);
            if (GlobalPlayer.updateTrackUI) GlobalPlayer.updateTrackUI();
            if (GlobalPlayer.updateLiveUI) GlobalPlayer.updateLiveUI();
        }
        updateStationCardStates(playing);
        const liveStat = $('ccStatPlaying');
        if (liveStat) animateCounter(liveStat, playing ? 1 : 0, '');
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

    /* ---------- state persistence ---------- */
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
        } catch (e) { /* ignore */ }
    }

    /* ============================================================
       FM + Song playback (all existing functions preserved)
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

        showToast('Tuning in to ' + stationName + '...');
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
                logAdminAction('Started playing station: ' + stationName);
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
        const preservedPos = window.__PLAYBACK_POSITION__ || 0;
        stopCurrentStream();
        if (window.__PLAYBACK_POSITION__) {
            audioPlayer.currentTime = window.__PLAYBACK_POSITION__;
            window.__PLAYBACK_POSITION__ = null;
        }
        userPaused = false;
        currentPlaybackMode = 'song';
        currentPlaybackQueue = (playlist && playlist.length) ? playlist.slice() : [song];
        currentPlaybackQueueIndex = currentPlaybackQueue.findIndex(t => t.id === song.id);
        if (currentPlaybackQueueIndex < 0) currentPlaybackQueueIndex = 0;
        loadSongTrack(song);
    }

    function loadSongTrack(song) {
        currentPlaybackTrack = {
            id: song.id, title: song.title || 'Untitled',
            artist: song.artist || song.singers || 'Tamil AI Stream',
            thumbnail: song.cover || song.thumbnail || '',
            audioUrl: song.audioUrl, duration: song.duration || 0
        };
        audioPlayer.volume = playbackVolume;
        audioPlayer.src = song.audioUrl;
        audioPlayer.load();
        const p = audioPlayer.play();
        if (p && p.then) {
            p.then(() => { syncAllUI(true); persistState(); }).catch(() => {
                showToast('Unable to play ' + currentPlaybackTrack.title, 'error');
                syncAllUI(false);
            });
        }
        updateStationCardStates(true);
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
            if (audioPlayer.paused) resumePlayback(); else pausePlayback();
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
        if (next >= currentPlaybackQueue.length) { pausePlayback(); showToast('End of queue', 'info'); return; }
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
       ADMIN ACTION LOG
       ============================================================ */
    function logAdminAction(action) {
        try {
            let actions = JSON.parse(localStorage.getItem('cc_adminActions') || '[]');
            actions.unshift({ action, time: new Date().toISOString() });
            if (actions.length > 50) actions = actions.slice(0, 50);
            localStorage.setItem('cc_adminActions', JSON.stringify(actions));
        } catch (e) { /* ignore */ }
    }

    function getAdminActions() {
        try { return JSON.parse(localStorage.getItem('cc_adminActions') || '[]'); } catch (e) { return []; }
    }

    /* ============================================================
       NAVIGATION
       ============================================================ */
    function initNav() {
        const navBtns = document.querySelectorAll('.cc-nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const panel = btn.dataset.panel;
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.cc-panel').forEach(p => p.classList.remove('active'));
                const target = $('panel' + panel.charAt(0).toUpperCase() + panel.slice(1));
                if (target) target.classList.add('active');
            });
        });
    }

    /* ============================================================
       STATS COLLECTION (real data)
       ============================================================ */
    function collectStats() {
        const songs = allSongs();
        const published = publishedSongs();
        const stations = activeStations();
        const images = typeof DataStore !== 'undefined' ? (DataStore.getImages() || []) : [];
        const collections = typeof DataStore !== 'undefined' ? (DataStore.getMusicCollections() || []) : [];
        const featured = typeof DataStore !== 'undefined' ? (DataStore.getFeatured() || []) : [];
        const trending = typeof DataStore !== 'undefined' ? (DataStore.getTrending() || []) : [];
        const users = JSON.parse(localStorage.getItem('tamilAIStream_users') || '[]');
        const notifications = typeof DataStore !== 'undefined' ? (DataStore.getNotifications() || []) : [];
        const categories = typeof DataStore !== 'undefined' ? (DataStore.getCategories() || []) : [];

        return {
            totalSongs: songs.length,
            publishedSongs: published.length,
            draftSongs: songs.filter(s => s.status === 'draft').length,
            activeStations: stations.length,
            totalStations: (typeof DataStore !== 'undefined' ? (DataStore.getStations() || []) : []).length,
            totalUsers: users.length,
            totalImages: images.length,
            totalCollections: collections.length,
            totalFeatured: featured.length,
            totalTrending: trending.length,
            totalCategories: categories.length,
            totalNotifications: notifications.length,
            recentlyAdded: published.slice(0, 5),
            trendingSongs: trending.slice(0, 5),
            songsWithAudio: songs.filter(s => s.audioUrl).length,
            songsWithThumbnail: songs.filter(s => s.thumbnail || s.albumCover || s.cover).length,
            songsWithArtist: songs.filter(s => s.artist && s.artist.trim()).length,
            songsWithGenre: songs.filter(s => s.genre && s.genre.trim()).length,
            songsWithLanguage: songs.filter(s => s.language && s.language.trim()).length,
            totalSize: songs.reduce((acc, s) => acc + (s.size || 0), 0)
        };
    }

    /* ============================================================
       AI ANALYSIS ENGINE (inspects real data, never modifies)
       ============================================================ */
    const AIAnalyzer = {
        healthCheck() {
            const stats = collectStats();
            const issues = [];
            const warnings = [];
            const good = [];

            if (stats.totalSongs === 0) issues.push('No songs in library');
            else good.push(stats.totalSongs + ' songs loaded');

            if (stats.activeStations === 0) issues.push('No active radio stations');
            else good.push(stats.activeStations + ' live stations');

            if (stats.totalUsers === 0) warnings.push('No registered users yet');
            else good.push(stats.totalUsers + ' registered users');

            const songsWithoutAudio = stats.totalSongs - stats.songsWithAudio;
            if (songsWithoutAudio > 0) warnings.push(songsWithoutAudio + ' songs missing audio files');
            else if (stats.totalSongs > 0) good.push('All songs have audio files');

            const songsWithoutThumb = stats.totalSongs - stats.songsWithThumbnail;
            if (songsWithoutThumb > 3) warnings.push(songsWithoutThumb + ' songs missing thumbnails');

            const songsWithoutArtist = stats.totalSongs - stats.songsWithArtist;
            if (songsWithoutArtist > 3) warnings.push(songsWithoutArtist + ' songs missing artist info');

            const sw = typeof ServiceWorker !== 'undefined';
            good.push('PWA service worker ' + (sw ? 'supported' : 'not available'));

            return { issues, warnings, good, score: Math.max(0, 100 - issues.length * 20 - warnings.length * 5) };
        },

        performanceCheck() {
            const perf = {};
            try {
                const nav = performance.getEntriesByType('navigation')[0];
                if (nav) {
                    perf.domContentLoaded = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
                    perf.loadComplete = Math.round(nav.loadEventEnd - nav.startTime);
                    perf.ttfb = Math.round(nav.responseStart - nav.startTime);
                }
                const resources = performance.getEntriesByType('resource');
                perf.totalResources = resources.length;
                perf.slowResources = resources.filter(r => r.duration > 1000).length;
                perf.totalTransferSize = resources.reduce((a, r) => a + (r.transferSize || 0), 0);
            } catch (e) { /* performance API not available */ }

            const suggestions = [];
            if (perf.domContentLoaded > 3000) suggestions.push('DOM content loaded in ' + perf.domContentLoaded + 'ms - consider lazy loading');
            if (perf.ttfb > 1000) suggestions.push('TTFB is ' + perf.ttfb + 'ms - check server response times');
            if (perf.slowResources > 3) suggestions.push(perf.slowResources + ' slow resources detected (>1s)');
            if (!suggestions.length) suggestions.push('Performance looks good! No major bottlenecks detected.');

            return { metrics: perf, suggestions };
        },

        contentAnalysis() {
            const stats = collectStats();
            const suggestions = [];
            const strengths = [];

            if (stats.publishedSongs > 10) strengths.push('Good song library size (' + stats.publishedSongs + ' songs)');
            else if (stats.publishedSongs > 0) suggestions.push('Add more songs to reach 10+ for better recommendations');
            else suggestions.push('Start adding songs to build your library');

            if (stats.activeStations > 3) strengths.push('Strong radio station lineup (' + stats.activeStations + ' stations)');
            else if (stats.activeStations > 0) suggestions.push('Consider adding more radio stations for variety');
            else suggestions.push('Add radio stations to give listeners live FM options');

            if (stats.totalFeatured > 0) strengths.push('Featured section is active');
            else suggestions.push('Add featured songs to highlight curated content');

            if (stats.totalCollections > 0) strengths.push(stats.totalCollections + ' curated collections');
            else suggestions.push('Create music collections to organize content by theme');

            if (stats.totalCategories > 2) strengths.push('Good category coverage');
            else suggestions.push('Add more categories to help listeners discover content');

            const completeness = stats.totalSongs > 0
                ? Math.round(((stats.songsWithArtist + stats.songsWithGenre + stats.songsWithLanguage) / (stats.totalSongs * 3)) * 100)
                : 0;
            if (completeness > 80) strengths.push('Metadata completeness: ' + completeness + '%');
            else suggestions.push('Improve metadata completeness (currently ' + completeness + '%)');

            return { strengths, suggestions, completeness };
        },

        metadataCheck() {
            const songs = allSongs();
            const issues = [];
            let missingTitle = 0, missingArtist = 0, missingGenre = 0, missingDuration = 0, missingLang = 0;

            songs.forEach(s => {
                if (!s.title || !s.title.trim()) missingTitle++;
                if (!s.artist || !s.artist.trim()) missingArtist++;
                if (!s.genre || !s.genre.trim()) missingGenre++;
                if (!s.duration || s.duration === '0:00') missingDuration++;
                if (!s.language || !s.language.trim()) missingLang++;
            });

            if (missingTitle > 0) issues.push(missingTitle + ' songs missing title');
            if (missingArtist > 0) issues.push(missingArtist + ' songs missing artist');
            if (missingGenre > 0) issues.push(missingGenre + ' songs missing genre');
            if (missingDuration > 0) issues.push(missingDuration + ' songs missing duration');
            if (missingLang > 0) issues.push(missingLang + ' songs missing language');

            const totalFields = songs.length * 5;
            const filledFields = totalFields - missingTitle - missingArtist - missingGenre - missingDuration - missingLang;
            const completeness = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 100;

            return { issues, completeness, totalSongs: songs.length };
        },

        recommendationInsights() {
            const songs = publishedSongs();
            const genreCount = {};
            const artistCount = {};
            const langCount = {};

            songs.forEach(s => {
                if (s.genre) genreCount[s.genre] = (genreCount[s.genre] || 0) + 1;
                if (s.artist) artistCount[s.artist] = (artistCount[s.artist] || 0) + 1;
                if (s.language) langCount[s.language] = (langCount[s.language] || 0) + 1;
            });

            const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const topArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const topLangs = Object.entries(langCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

            const suggestions = [];
            if (topGenres.length < 3) suggestions.push('Add more genre diversity for better recommendations');
            if (topArtists.length < 3) suggestions.push('More artist variety would improve discovery');
            if (songs.length < 20) suggestions.push('Reach 20+ songs for more accurate AI recommendations');

            return { topGenres, topArtists, topLangs, suggestions, totalSongs: songs.length };
        },

        errorDetection() {
            const songs = allSongs();
            const stations = typeof DataStore !== 'undefined' ? (DataStore.getStations() || []) : [];
            const errors = [];
            const warnings = [];

            songs.forEach(s => {
                if (s.audioUrl && !s.audioUrl.startsWith('data:') && !s.audioUrl.startsWith('/api/')) {
                    if (s.audioUrl.startsWith('http') && !s.audioUrl.includes('tamilai.stream')) {
                        warnings.push('Song "' + (s.title || 'Untitled') + '" has external audio URL');
                    }
                }
                if (!s.id) errors.push('Song found with no ID');
            });

            stations.forEach(s => {
                if (s.streamUrl && !s.streamUrl.startsWith('http')) {
                    warnings.push('Station "' + s.name + '" has invalid stream URL');
                }
                if (!s.name) errors.push('Station found with no name');
            });

            const duplicateTitles = {};
            songs.forEach(s => {
                const key = (s.title || '').toLowerCase().trim();
                if (key) {
                    if (!duplicateTitles[key]) duplicateTitles[key] = [];
                    duplicateTitles[key].push(s);
                }
            });
            Object.entries(duplicateTitles).forEach(([title, arr]) => {
                if (arr.length > 1) warnings.push('Duplicate song title: "' + title + '" (' + arr.length + ' copies)');
            });

            return { errors, warnings, totalChecked: songs.length + stations.length };
        },

        builderAnalysis() {
            const sections = typeof DataStore !== 'undefined' ? (DataStore.getSectionsOrder() || []) : [];
            const images = typeof DataStore !== 'undefined' ? (DataStore.getImages() || []) : [];
            const settings = typeof DataStore !== 'undefined' ? DataStore.getSiteSettings() : {};
            const nav = typeof DataStore !== 'undefined' ? DataStore.getNavigation() : {};
            const ads = typeof DataStore !== 'undefined' ? (DataStore.getAdvertisements() || []) : [];

            const suggestions = [];
            const status = [];

            if (sections.length > 0) status.push(sections.length + ' sections configured');
            else suggestions.push('Configure home page sections for a better layout');

            if (images.length > 0) status.push(images.length + ' images uploaded');
            else suggestions.push('Upload album covers and banners');

            if (settings.title) status.push('Site title: ' + settings.title);
            else suggestions.push('Set a site title in Settings');

            if (ads.length > 0) status.push(ads.length + ' advertisements active');
            else suggestions.push('Consider adding advertisements for monetization');

            if (nav.items && nav.items.length > 0) status.push('Navigation: ' + nav.items.length + ' items');
            else suggestions.push('Configure navigation menu items');

            return { suggestions, status };
        },

        publishCheck() {
            const stats = collectStats();
            const checks = [];
            const pass = [];
            const fail = [];

            if (stats.totalSongs > 0) pass.push('Songs available (' + stats.totalSongs + ')');
            else fail.push('No songs - cannot publish empty site');

            if (stats.activeStations > 0) pass.push('Radio stations active (' + stats.activeStations + ')');
            else fail.push('No active radio stations');

            if (stats.totalImages > 0) pass.push('Images uploaded (' + stats.totalImages + ')');
            else checks.push('No images uploaded - site may look plain');

            const meta = this.metadataCheck();
            if (meta.completeness > 70) pass.push('Metadata completeness: ' + meta.completeness + '%');
            else fail.push('Metadata too incomplete (' + meta.completeness + '%) - fill missing fields');

            const health = this.healthCheck();
            if (health.issues.length === 0) pass.push('No critical health issues');
            else fail.push(health.issues.length + ' critical issues must be fixed first');

            return { pass, fail, checks, ready: fail.length === 0 };
        },

        growthSuggestions() {
            const stats = collectStats();
            const suggestions = [];

            if (stats.totalSongs < 50) suggestions.push({ priority: 'high', text: 'Add more songs (currently ' + stats.totalSongs + '/50 minimum for good discovery)', icon: 'fa-music' });
            if (stats.activeStations < 5) suggestions.push({ priority: 'medium', text: 'Expand radio stations to ' + (stats.activeStations + 3) + '+ for genre variety', icon: 'fa-radio' });
            if (stats.totalFeatured === 0) suggestions.push({ priority: 'high', text: 'Create featured playlists to highlight best content', icon: 'fa-star' });
            if (stats.totalCollections < 3) suggestions.push({ priority: 'medium', text: 'Build themed collections (Mood, Artist, Year) for better UX', icon: 'fa-layer-group' });
            if (stats.totalUsers < 10) suggestions.push({ priority: 'high', text: 'Grow user base - share on social media and Tamil communities', icon: 'fa-users' });
            if (stats.totalCategories < 5) suggestions.push({ priority: 'low', text: 'Add more categories for content organization', icon: 'fa-tags' });
            if (stats.songsWithThumbnail / Math.max(stats.totalSongs, 1) < 0.7) suggestions.push({ priority: 'medium', text: 'Add album covers to 70%+ of songs for visual appeal', icon: 'fa-image' });
            suggestions.push({ priority: 'low', text: 'Enable AI Auto-DJ for personalized listening experience', icon: 'fa-robot' });

            return { suggestions, stats };
        }
    };

    /* ============================================================
       AI ASSISTANT CHAT
       ============================================================ */
    function processAssistantQuery(query) {
        const q = query.toLowerCase().trim();
        const stats = collectStats();

        // Website speed
        if (q.includes('slow') || q.includes('speed') || q.includes('performance')) {
            const perf = AIAnalyzer.performanceCheck();
            let response = '**Performance Analysis:**\n\n';
            if (perf.metrics.domContentLoaded) response += '- DOM Content Loaded: **' + perf.metrics.domContentLoaded + 'ms**\n';
            if (perf.metrics.ttfb) response += '- Time to First Byte: **' + perf.metrics.ttfb + 'ms**\n';
            if (perf.metrics.totalResources) response += '- Total Resources: **' + perf.metrics.totalResources + '**\n';
            if (perf.metrics.totalTransferSize) response += '- Transfer Size: **' + fmtBytes(perf.metrics.totalTransferSize) + '**\n';
            response += '\n**Suggestions:**\n' + perf.suggestions.map(s => '- ' + s).join('\n');
            return response;
        }

        // Trending songs
        if (q.includes('trending') || q.includes('popular') || q.includes('hot')) {
            const trending = DataStore.getTrending ? DataStore.getTrending() : [];
            const songs = publishedSongs();
            let response = '**Trending Analysis:**\n\n';
            if (trending.length) {
                response += 'Found **' + trending.length + ' trending entries**.\n\n';
                trending.slice(0, 5).forEach((t, i) => {
                    response += (i + 1) + '. ' + (t.title || t.name || 'Unknown') + '\n';
                });
            } else if (songs.length) {
                const top = songs.sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 5);
                response += 'Top songs by plays:\n';
                top.forEach((s, i) => {
                    response += (i + 1) + '. **' + (s.title || 'Untitled') + '** - ' + (s.plays || 0) + ' plays\n';
                });
            } else {
                response += 'No trending data yet. Start playing songs to generate trends!';
            }
            return response;
        }

        // R2 sync
        if (q.includes('r2') || q.includes('sync') || q.includes('cloudflare') || q.includes('storage')) {
            let response = '**Cloudflare R2 Status:**\n\n';
            try {
                const lastSync = localStorage.getItem('tamilAIStream_lastSyncedAt');
                response += '- Last Sync: **' + (lastSync ? timeAgo(lastSync) : 'Never') + '**\n';
                response += '- Manifest: **' + (lastSync ? 'Active' : 'Not synced') + '**\n';
                const songs = allSongs();
                const r2Songs = songs.filter(s => s.source === 'r2' || s.r2Key);
                response += '- R2-backed songs: **' + r2Songs.length + '**\n';
                response += '- Total storage: **' + fmtBytes(songs.reduce((a, s) => a + (s.size || 0), 0)) + '**\n\n';
                if (!lastSync) response += 'R2 sync has not been initialized. Open the Builder and publish to sync.';
                else response += 'R2 synchronization is **operational**.';
            } catch (e) {
                response += 'Unable to check R2 status: ' + e.message;
            }
            return response;
        }

        // Broken features
        if (q.includes('broken') || q.includes('error') || q.includes('bug') || q.includes('issue') || q.includes('fix')) {
            const errors = AIAnalyzer.errorDetection();
            let response = '**Error Detection Report:**\n\n';
            response += '- Total items scanned: **' + errors.totalChecked + '**\n';
            response += '- Critical errors: **' + errors.errors.length + '**\n';
            response += '- Warnings: **' + errors.warnings.length + '**\n\n';
            if (errors.errors.length) {
                response += '**Errors:**\n' + errors.errors.slice(0, 5).map(e => '- ' + e).join('\n') + '\n\n';
            }
            if (errors.warnings.length) {
                response += '**Warnings:**\n' + errors.warnings.slice(0, 5).map(w => '- ' + w).join('\n') + '\n\n';
            }
            if (!errors.errors.length && !errors.warnings.length) {
                response += 'All systems clean! No broken features detected.';
            }
            return response;
        }

        // Activity analysis
        if (q.includes('activity') || q.includes('today') || q.includes('usage') || q.includes('analytics')) {
            const stats = collectStats();
            let response = '**Platform Activity Summary:**\n\n';
            response += '- Total songs: **' + stats.totalSongs + '** (' + stats.publishedSongs + ' published, ' + stats.draftSongs + ' drafts)\n';
            response += '- Active stations: **' + stats.activeStations + '**\n';
            response += '- Registered users: **' + stats.totalUsers + '**\n';
            response += '- Collections: **' + stats.totalCollections + '**\n';
            response += '- Images: **' + stats.totalImages + '**\n';
            response += '- Featured items: **' + stats.totalFeatured + '**\n\n';
            const actions = getAdminActions();
            if (actions.length) {
                response += '**Recent Admin Actions:**\n';
                actions.slice(0, 5).forEach(a => {
                    response += '- ' + a.action + ' (' + timeAgo(a.time) + ')\n';
                });
            } else {
                response += 'No admin actions recorded this session.';
            }
            return response;
        }

        // Improvement suggestions
        if (q.includes('improve') || q.includes('suggest') || q.includes('growth') || q.includes('better')) {
            const growth = AIAnalyzer.growthSuggestions();
            let response = '**AI Growth Recommendations:**\n\n';
            const high = growth.suggestions.filter(s => s.priority === 'high');
            const med = growth.suggestions.filter(s => s.priority === 'medium');
            const low = growth.suggestions.filter(s => s.priority === 'low');
            if (high.length) {
                response += '**High Priority:**\n';
                high.forEach(s => response += '- ' + s.text + '\n');
            }
            if (med.length) {
                response += '\n**Medium Priority:**\n';
                med.forEach(s => response += '- ' + s.text + '\n');
            }
            if (low.length) {
                response += '\n**Suggestions:**\n';
                low.forEach(s => response += '- ' + s.text + '\n');
            }
            return response;
        }

        // Health check
        if (q.includes('health') || q.includes('status') || q.includes('check')) {
            const health = AIAnalyzer.healthCheck();
            let response = '**Health Check Score: ' + health.score + '/100**\n\n';
            if (health.good.length) response += '**Good:**\n' + health.good.map(g => '- ' + g).join('\n') + '\n\n';
            if (health.warnings.length) response += '**Warnings:**\n' + health.warnings.map(w => '- ' + w).join('\n') + '\n\n';
            if (health.issues.length) response += '**Issues:**\n' + health.issues.map(i => '- ' + i).join('\n') + '\n\n';
            return response;
        }

        // Default response
        return 'I can help you with:\n\n' +
            '- **"Why is my website slow?"** - Performance analysis\n' +
            '- **"Which songs are trending?"** - Trending content\n' +
            '- **"Check R2 synchronization"** - Cloudflare R2 status\n' +
            '- **"Find broken features"** - Error detection\n' +
            '- **"Analyze today\'s activity"** - Platform summary\n' +
            '- **"What should I improve?"** - Growth suggestions\n' +
            '- **"Health check"** - System health score\n\n' +
            'Ask me anything about your TamilAI.Stream platform!';
    }

    function addChatMessage(text, isUser) {
        const chat = $('ccAssistantChat');
        if (!chat) return;
        const div = document.createElement('div');
        div.className = 'cc-chat-message ' + (isUser ? 'cc-chat-user' : 'cc-chat-bot');
        const avatar = isUser ? '<i class="fas fa-user-shield"></i>' : '<i class="fas fa-robot"></i>';
        div.innerHTML =
            '<div class="cc-chat-avatar">' + avatar + '</div>' +
            '<div class="cc-chat-bubble"><p>' + esc(text).replace(/\n/g, '<br>') + '</p></div>';
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    }

    function initAssistant() {
        const input = $('ccAssistantInput');
        const sendBtn = $('ccAssistantSend');
        if (!input || !sendBtn) return;

        function handleSend() {
            const query = input.value.trim();
            if (!query) return;
            addChatMessage(query, true);
            input.value = '';

            setTimeout(() => {
                const response = processAssistantQuery(query);
                addChatMessage(response, false);
            }, 300);
        }

        sendBtn.addEventListener('click', handleSend);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        });

        document.querySelectorAll('.cc-assistant-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.dataset.q;
                handleSend();
            });
        });
    }

    /* ============================================================
       RENDERING
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
        const holder = $('ccRadioFilters');
        if (!holder) return;
        const stations = activeStations();
        const genreSet = new Set();
        stations.forEach(s => { if (s.genre) genreSet.add(s.genre.toLowerCase()); });
        const genres = Array.from(genreSet).sort();
        let html = '<button type="button" class="cc-chip active" data-genre="all">All</button>';
        genres.forEach(g => { html += '<button type="button" class="cc-chip" data-genre="' + esc(g) + '">' + esc(g.charAt(0).toUpperCase() + g.slice(1)) + '</button>'; });
        holder.innerHTML = html;
        holder.querySelectorAll('.cc-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                radioFilter = chip.dataset.genre;
                holder.querySelectorAll('.cc-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                applyFilter();
            });
        });
    }

    function applyFilter() {
        let visible = 0;
        document.querySelectorAll('#ccRadioGrid .premium-radio-card').forEach(card => {
            const ok = radioFilter === 'all' || card.dataset.genre === radioFilter;
            card.classList.toggle('hidden', !ok);
            if (ok) visible++;
        });
        if ($('ccRadioEmpty')) $('ccRadioEmpty').style.display = visible ? 'none' : 'block';
    }

    function renderRadio() {
        const container = $('ccRadioGrid');
        if (!container) return;
        const stations = activeStations();
        const countEl = $('ccRadioCount');
        if (countEl) countEl.textContent = stations.length + (stations.length === 1 ? ' station' : ' stations');
        if (!stations.length) {
            if ($('ccRadioEmpty')) $('ccRadioEmpty').style.display = 'block';
            container.innerHTML = '';
            return;
        }
        if ($('ccRadioEmpty')) $('ccRadioEmpty').style.display = 'none';
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

    function renderStats() {
        const stats = collectStats();
        animateCounter($('ccStatSongs'), stats.totalSongs, '');
        animateCounter($('ccStatStations'), stats.activeStations, '');
        animateCounter($('ccStatUsers'), stats.totalUsers, '');
        animateCounter($('ccStatPlaying'), isStreamPlaying ? 1 : 0, '');
        const storageEl = $('ccStatStorage');
        if (storageEl) {
            const size = stats.totalSize;
            if (size >= 1048576) animateCounter(storageEl, Math.round(size / 1048576), ' MB');
            else if (size >= 1024) animateCounter(storageEl, Math.round(size / 1024), ' KB');
            else animateCounter(storageEl, size, ' B');
        }
        animateCounter($('ccStatCollections'), stats.totalCollections, '');

        // Trend indicators
        const songsTrend = $('ccStatSongsTrend');
        if (songsTrend) songsTrend.querySelector('span').textContent = stats.publishedSongs + ' published';
        const usersTrend = $('ccStatUsersTrend');
        if (usersTrend) usersTrend.querySelector('span').textContent = stats.totalUsers + ' total';
    }

    function renderAIInsights() {
        const health = AIAnalyzer.healthCheck();
        const healthCard = $('ccAIHealth');
        if (healthCard) {
            const badge = healthCard.querySelector('.cc-ai-card-badge');
            if (badge) {
                badge.className = 'cc-ai-card-badge ' + (health.score >= 80 ? 'cc-badge-good' : health.score >= 50 ? 'cc-badge-warn' : 'cc-badge-error');
                badge.textContent = health.score + '/100';
            }
            const metrics = $('ccHealthMetrics');
            if (metrics) {
                metrics.innerHTML = health.good.slice(0, 3).map(m => '<div class="cc-ai-metric cc-metric-good"><i class="fas fa-check-circle"></i> ' + esc(m) + '</div>').join('') +
                    health.warnings.slice(0, 2).map(m => '<div class="cc-ai-metric cc-metric-warn"><i class="fas fa-exclamation-triangle"></i> ' + esc(m) + '</div>').join('') +
                    health.issues.slice(0, 2).map(m => '<div class="cc-ai-metric cc-metric-error"><i class="fas fa-times-circle"></i> ' + esc(m) + '</div>').join('');
            }
        }

        const content = AIAnalyzer.contentAnalysis();
        const contentCard = $('ccAIContent');
        if (contentCard) {
            const badge = contentCard.querySelector('.cc-ai-card-badge');
            if (badge) {
                badge.className = 'cc-ai-card-badge ' + (content.completeness >= 70 ? 'cc-badge-good' : 'cc-badge-warn');
                badge.textContent = content.completeness + '% complete';
            }
            const metrics = $('ccContentMetrics');
            if (metrics) {
                metrics.innerHTML = content.strengths.slice(0, 2).map(m => '<div class="cc-ai-metric cc-metric-good"><i class="fas fa-check-circle"></i> ' + esc(m) + '</div>').join('') +
                    content.suggestions.slice(0, 3).map(m => '<div class="cc-ai-metric cc-metric-info"><i class="fas fa-lightbulb"></i> ' + esc(m) + '</div>').join('');
            }
        }

        const meta = AIAnalyzer.metadataCheck();
        const metaCard = $('ccAIMeta');
        if (metaCard) {
            const badge = metaCard.querySelector('.cc-ai-card-badge');
            if (badge) {
                const issueCount = meta.issues.length;
                badge.className = 'cc-ai-card-badge ' + (issueCount === 0 ? 'cc-badge-good' : issueCount <= 3 ? 'cc-badge-warn' : 'cc-badge-error');
                badge.textContent = issueCount === 0 ? 'All Clear' : issueCount + ' Issues';
            }
            const metrics = $('ccMetaMetrics');
            if (metrics) {
                metrics.innerHTML = '<div class="cc-ai-metric cc-metric-info"><i class="fas fa-chart-pie"></i> Completeness: ' + meta.completeness + '%</div>' +
                    '<div class="cc-ai-metric cc-metric-info"><i class="fas fa-music"></i> ' + meta.totalSongs + ' songs scanned</div>' +
                    meta.issues.slice(0, 3).map(m => '<div class="cc-ai-metric cc-metric-warn"><i class="fas fa-exclamation-triangle"></i> ' + esc(m) + '</div>').join('');
            }
        }

        const reco = AIAnalyzer.recommendationInsights();
        const recoCard = $('ccAIReco');
        if (recoCard) {
            const metrics = $('ccRecoMetrics');
            if (metrics) {
                const topGenre = reco.topGenres.length ? reco.topGenres[0][0] : 'None';
                const topArtist = reco.topArtists.length ? reco.topArtists[0][0] : 'None';
                metrics.innerHTML =
                    '<div class="cc-ai-metric cc-metric-info"><i class="fas fa-music"></i> Top Genre: ' + esc(topGenre) + '</div>' +
                    '<div class="cc-ai-metric cc-metric-info"><i class="fas fa-user"></i> Top Artist: ' + esc(topArtist) + '</div>' +
                    '<div class="cc-ai-metric cc-metric-info"><i class="fas fa-layer-group"></i> ' + reco.topGenres.length + ' genres, ' + reco.topArtists.length + ' artists</div>';
            }
        }

        const errors = AIAnalyzer.errorDetection();
        const errorCard = $('ccAIError');
        if (errorCard) {
            const badge = errorCard.querySelector('.cc-ai-card-badge');
            if (badge) {
                const total = errors.errors.length + errors.warnings.length;
                badge.className = 'cc-ai-card-badge ' + (total === 0 ? 'cc-badge-good' : total <= 3 ? 'cc-badge-warn' : 'cc-badge-error');
                badge.textContent = total === 0 ? 'Clear' : total + ' Issues';
            }
            const metrics = $('ccErrorMetrics');
            if (metrics) {
                metrics.innerHTML =
                    '<div class="cc-ai-metric ' + (errors.errors.length === 0 ? 'cc-metric-good' : 'cc-metric-error') + '"><i class="fas fa-' + (errors.errors.length === 0 ? 'check-circle' : 'times-circle') + '"></i> ' + errors.errors.length + ' errors</div>' +
                    '<div class="cc-ai-metric ' + (errors.warnings.length <= 3 ? 'cc-metric-good' : 'cc-metric-warn') + '"><i class="fas fa-exclamation-triangle"></i> ' + errors.warnings.length + ' warnings</div>' +
                    '<div class="cc-ai-metric cc-metric-info"><i class="fas fa-search"></i> ' + errors.totalChecked + ' items scanned</div>';
            }
        }
    }

    function renderLiveStatus() {
        // R2 Status
        const r2Conn = $('ccR2Conn');
        const r2Files = $('ccR2Files');
        const r2Sync = $('ccR2Sync');
        const r2Manifest = $('ccR2Manifest');
        if (r2Conn) r2Conn.textContent = 'Connected';
        if (r2Files) {
            const songs = allSongs();
            const r2Songs = songs.filter(s => s.source === 'r2' || s.r2Key);
            r2Files.textContent = r2Songs.length;
        }
        if (r2Sync) {
            const lastSync = localStorage.getItem('tamilAIStream_lastSyncedAt');
            r2Sync.textContent = lastSync ? timeAgo(lastSync) : 'Never';
        }
        if (r2Manifest) {
            const lastSync = localStorage.getItem('tamilAIStream_lastSyncedAt');
            r2Manifest.textContent = lastSync ? 'Active' : 'Not synced';
        }

        // Builder Status
        const builderSections = $('ccBuilderSections');
        const builderImages = $('ccBuilderImages');
        const builderPublish = $('ccBuilderPublish');
        if (builderSections) {
            const sections = typeof DataStore !== 'undefined' ? (DataStore.getSectionsOrder() || []) : [];
            builderSections.textContent = sections.length;
        }
        if (builderImages) {
            const images = typeof DataStore !== 'undefined' ? (DataStore.getImages() || []) : [];
            builderImages.textContent = images.length;
        }
        if (builderPublish) {
            const lastSync = localStorage.getItem('tamilAIStream_lastSyncedAt');
            builderPublish.textContent = lastSync ? timeAgo(lastSync) : 'Never';
        }

        // Website Health
        const swStatus = $('ccSWStatus');
        if (swStatus) swStatus.textContent = 'navigator.serviceWorker' in navigator ? 'Running' : 'Unavailable';
    }

    function renderContentLists() {
        // Recently Added
        const recentEl = $('ccRecentSongs');
        if (recentEl) {
            const songs = publishedSongs().slice(0, 6);
            if (!songs.length) {
                recentEl.innerHTML = '<div class="cc-list-empty">No songs added yet</div>';
            } else {
                recentEl.innerHTML = songs.map(s => '' +
                    '<div class="cc-list-item">' +
                    '  <img src="' + esc(thumbOf(s, '%2338bdf8')) + '" alt="" loading="lazy">' +
                    '  <div class="cc-list-info">' +
                    '    <div class="cc-list-title">' + esc(s.title || 'Untitled') + '</div>' +
                    '    <div class="cc-list-sub">' + esc(s.artist || 'Unknown') + '</div>' +
                    '  </div>' +
                    '  <span class="cc-list-time">' + timeAgo(s.createdAt) + '</span>' +
                    '</div>'
                ).join('');
            }
        }

        // Trending
        const trendingEl = $('ccTrendingSongs');
        if (trendingEl) {
            const trending = typeof DataStore !== 'undefined' ? (DataStore.getTrending() || []) : [];
            const songs = publishedSongs();
            let displayTrending = trending.length ? trending : songs.slice(0, 6);
            if (!displayTrending.length) {
                trendingEl.innerHTML = '<div class="cc-list-empty">No trending data yet</div>';
            } else {
                trendingEl.innerHTML = displayTrending.slice(0, 6).map((t, i) => {
                    const song = songs.find(s => s.id === t.id || s.title === t.title) || t;
                    return '' +
                        '<div class="cc-list-item">' +
                        '  <span class="cc-list-rank">' + (i + 1) + '</span>' +
                        '  <img src="' + esc(thumbOf(song, '%23f59e0b')) + '" alt="" loading="lazy">' +
                        '  <div class="cc-list-info">' +
                        '    <div class="cc-list-title">' + esc(song.title || t.title || 'Unknown') + '</div>' +
                        '    <div class="cc-list-sub">' + esc(song.artist || '') + '</div>' +
                        '  </div>' +
                        '</div>';
                }).join('');
            }
        }

        // Admin Actions
        const actionsEl = $('ccAdminActions');
        if (actionsEl) {
            const actions = getAdminActions();
            if (!actions.length) {
                actionsEl.innerHTML = '<div class="cc-list-empty">No actions recorded yet</div>';
            } else {
                actionsEl.innerHTML = actions.slice(0, 6).map(a => '' +
                    '<div class="cc-list-item">' +
                    '  <div class="cc-list-info">' +
                    '    <div class="cc-list-title">' + esc(a.action) + '</div>' +
                    '    <div class="cc-list-sub">' + timeAgo(a.time) + '</div>' +
                    '  </div>' +
                    '</div>'
                ).join('');
            }
        }
    }

    function renderLiveFeed() {
        const feed = $('ccLiveFeed');
        if (!feed) return;
        const stats = collectStats();
        const items = [];

        items.push({ time: 'Now', msg: 'System initialized - ' + stats.totalSongs + ' songs, ' + stats.activeStations + ' stations, ' + stats.totalUsers + ' users', type: 'system' });

        if (stats.activeStations > 0) {
            items.push({ time: 'Live', msg: stats.activeStations + ' radio station(s) broadcasting', type: 'live' });
        }

        if (stats.recentlyAdded.length) {
            items.push({ time: 'Content', msg: stats.recentlyAdded.length + ' recently added song(s)', type: 'content' });
        }

        const lastSync = localStorage.getItem('tamilAIStream_lastSyncedAt');
        if (lastSync) {
            items.push({ time: 'Sync', msg: 'R2 last synced ' + timeAgo(lastSync), type: 'sync' });
        }

        feed.innerHTML = items.map(item =>
            '<div class="cc-live-feed-item cc-feed-' + item.type + '">' +
            '  <span class="cc-feed-time">' + esc(item.time) + '</span>' +
            '  <span class="cc-feed-msg">' + esc(item.msg) + '</span>' +
            '</div>'
        ).join('');
    }

    function renderAlerts() {
        const alertsBody = $('ccAlertsBody');
        const alertCount = $('ccAlertCount');
        if (!alertsBody) return;

        const alerts = [];
        const stats = collectStats();

        if (stats.draftSongs > 0) alerts.push({ type: 'warn', msg: stats.draftSongs + ' song(s) in draft status - review and publish' });
        const meta = AIAnalyzer.metadataCheck();
        if (meta.issues.length > 0) alerts.push({ type: 'warn', msg: 'Metadata issues found: ' + meta.issues[0] });
        const errors = AIAnalyzer.errorDetection();
        if (errors.warnings.length > 0) alerts.push({ type: 'info', msg: errors.warnings[0] });

        if (alertCount) alertCount.textContent = alerts.length;

        if (!alerts.length) {
            alertsBody.innerHTML = '<div class="cc-alert-empty">No alerts - all systems operational</div>';
        } else {
            alertsBody.innerHTML = alerts.map(a =>
                '<div class="cc-alert-item cc-alert-' + a.type + '">' +
                '  <i class="fas fa-' + (a.type === 'warn' ? 'exclamation-triangle' : 'info-circle') + '"></i> ' +
                '  <span>' + esc(a.msg) + '</span>' +
                '</div>'
            ).join('');
        }
    }

    function renderAll() {
        renderStats();
        renderRadio();
        renderAIInsights();
        renderLiveStatus();
        renderContentLists();
        renderAlerts();
        renderLiveFeed();
    }

    function loadUserName() {
        try {
            const raw = localStorage.getItem('tamilAIStream_user');
            if (raw) {
                const u = JSON.parse(raw);
                const name = u.name || u.displayName || u.email;
                if (name && $('ccUserName')) {
                    const first = String(name).split(' ')[0];
                    $('ccUserName').textContent = first.charAt(0).toUpperCase() + first.slice(1);
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
            W = window.innerWidth; H = window.innerHeight;
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

    /* ---------- data bootstrap ---------- */
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
        const startBtn = $('ccStartListening');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const stations = activeStations();
                if (stations.length) playStation(stations[0].name);
                else if ($('ccRadioEmpty')) $('ccRadioEmpty').scrollIntoView({ behavior: 'smooth' });
                logAdminAction('Started listening from dashboard');
            });
        }
        const radioBtn = $('ccOpenRadio');
        if (radioBtn) radioBtn.addEventListener('click', () => {
            const grid = $('ccRadioGrid');
            if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        const goLiveBtn = $('ccGoLive');
        if (goLiveBtn) goLiveBtn.addEventListener('click', () => {
            document.querySelectorAll('.cc-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.cc-nav-btn[data-panel="live"]')?.classList.add('active');
            document.querySelectorAll('.cc-panel').forEach(p => p.classList.remove('active'));
            $('panelLive')?.classList.add('active');
        });
        const builderBtn = $('ccOpenBuilder');
        if (builderBtn) builderBtn.addEventListener('click', () => {
            window.location.href = 'builder.html?auto=1';
        });
        const fullBtn = $('ccFullPlayer');
        if (fullBtn) fullBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
        const logoutBtn = $('ccLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (typeof Auth !== 'undefined' && Auth.logout) Auth.logout();
                else try { localStorage.removeItem('tamilAIStream_user'); } catch (e) {}
                window.location.href = 'index.html';
            });
        }
        const refreshLiveBtn = $('ccRefreshLive');
        if (refreshLiveBtn) refreshLiveBtn.addEventListener('click', () => {
            renderLiveFeed();
            renderLiveStatus();
            showToast('Live data refreshed');
        });

        // AI Tool run buttons
        document.querySelectorAll('.cc-ai-run-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const resultEl = $('ccTool' + action.charAt(0).toUpperCase() + action.slice(1));
                if (!resultEl) return;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Analyzing...';
                btn.disabled = true;

                setTimeout(() => {
                    let result = '';
                    switch (action) {
                        case 'health': {
                            const h = AIAnalyzer.healthCheck();
                            result = '<div class="cc-tool-score">Score: ' + h.score + '/100</div>' +
                                h.good.map(m => '<div class="cc-tool-good"><i class="fas fa-check"></i> ' + esc(m) + '</div>').join('') +
                                h.warnings.map(m => '<div class="cc-tool-warn"><i class="fas fa-exclamation"></i> ' + esc(m) + '</div>').join('') +
                                h.issues.map(m => '<div class="cc-tool-error"><i class="fas fa-times"></i> ' + esc(m) + '</div>').join('');
                            break;
                        }
                        case 'performance': {
                            const p = AIAnalyzer.performanceCheck();
                            result = '<div class="cc-tool-metrics">' +
                                (p.metrics.domContentLoaded ? '<div>DOM Loaded: <strong>' + p.metrics.domContentLoaded + 'ms</strong></div>' : '') +
                                (p.metrics.ttfb ? '<div>TTFB: <strong>' + p.metrics.ttfb + 'ms</strong></div>' : '') +
                                (p.metrics.totalResources ? '<div>Resources: <strong>' + p.metrics.totalResources + '</strong></div>' : '') +
                                '</div>' + p.suggestions.map(s => '<div class="cc-tool-info"><i class="fas fa-lightbulb"></i> ' + esc(s) + '</div>').join('');
                            break;
                        }
                        case 'content': {
                            const c = AIAnalyzer.contentAnalysis();
                            result = '<div class="cc-tool-score">Completeness: ' + c.completeness + '%</div>' +
                                c.strengths.map(m => '<div class="cc-tool-good"><i class="fas fa-check"></i> ' + esc(m) + '</div>').join('') +
                                c.suggestions.map(m => '<div class="cc-tool-info"><i class="fas fa-lightbulb"></i> ' + esc(m) + '</div>').join('');
                            break;
                        }
                        case 'metadata': {
                            const m = AIAnalyzer.metadataCheck();
                            result = '<div class="cc-tool-score">Metadata Completeness: ' + m.completeness + '%</div>' +
                                m.issues.map(i => '<div class="cc-tool-warn"><i class="fas fa-exclamation"></i> ' + esc(i) + '</div>').join('') +
                                (m.issues.length === 0 ? '<div class="cc-tool-good"><i class="fas fa-check"></i> All metadata looks good!</div>' : '');
                            break;
                        }
                        case 'reco': {
                            const r = AIAnalyzer.recommendationInsights();
                            result = '<div class="cc-tool-metrics">' +
                                (r.topGenres.length ? '<div>Top Genres: <strong>' + r.topGenres.map(g => g[0] + ' (' + g[1] + ')').join(', ') + '</strong></div>' : '') +
                                (r.topArtists.length ? '<div>Top Artists: <strong>' + r.topArtists.map(a => a[0]).join(', ') + '</strong></div>' : '') +
                                '</div>' + r.suggestions.map(s => '<div class="cc-tool-info"><i class="fas fa-lightbulb"></i> ' + esc(s) + '</div>').join('');
                            break;
                        }
                        case 'activity': {
                            const s = collectStats();
                            result = '<div class="cc-tool-metrics">' +
                                '<div>Songs: <strong>' + s.totalSongs + '</strong></div>' +
                                '<div>Published: <strong>' + s.publishedSongs + '</strong></div>' +
                                '<div>Drafts: <strong>' + s.draftSongs + '</strong></div>' +
                                '<div>Stations: <strong>' + s.activeStations + '</strong></div>' +
                                '<div>Users: <strong>' + s.totalUsers + '</strong></div>' +
                                '<div>Collections: <strong>' + s.totalCollections + '</strong></div>' +
                                '<div>Images: <strong>' + s.totalImages + '</strong></div>' +
                                '</div>';
                            break;
                        }
                        case 'errors': {
                            const e = AIAnalyzer.errorDetection();
                            result = '<div class="cc-tool-metrics"><div>Scanned: <strong>' + e.totalChecked + '</strong> items</div></div>' +
                                e.errors.map(i => '<div class="cc-tool-error"><i class="fas fa-times"></i> ' + esc(i) + '</div>').join('') +
                                e.warnings.map(w => '<div class="cc-tool-warn"><i class="fas fa-exclamation"></i> ' + esc(w) + '</div>').join('') +
                                (e.errors.length === 0 && e.warnings.length === 0 ? '<div class="cc-tool-good"><i class="fas fa-check"></i> No errors found!</div>' : '');
                            break;
                        }
                        case 'builder': {
                            const b = AIAnalyzer.builderAnalysis();
                            result = b.status.map(s => '<div class="cc-tool-good"><i class="fas fa-check"></i> ' + esc(s) + '</div>').join('') +
                                b.suggestions.map(s => '<div class="cc-tool-info"><i class="fas fa-lightbulb"></i> ' + esc(s) + '</div>').join('');
                            break;
                        }
                        case 'publish': {
                            const p = AIAnalyzer.publishCheck();
                            result = '<div class="cc-tool-score">Ready to Publish: ' + (p.ready ? 'Yes' : 'No') + '</div>' +
                                p.pass.map(s => '<div class="cc-tool-good"><i class="fas fa-check"></i> ' + esc(s) + '</div>').join('') +
                                p.fail.map(s => '<div class="cc-tool-error"><i class="fas fa-times"></i> ' + esc(s) + '</div>').join('') +
                                p.checks.map(s => '<div class="cc-tool-info"><i class="fas fa-info"></i> ' + esc(s) + '</div>').join('');
                            break;
                        }
                        case 'growth': {
                            const g = AIAnalyzer.growthSuggestions();
                            result = g.suggestions.map(s =>
                                '<div class="cc-tool-' + (s.priority === 'high' ? 'error' : s.priority === 'medium' ? 'warn' : 'info') + '">' +
                                '<i class="fas ' + esc(s.icon) + '"></i> [' + s.priority.toUpperCase() + '] ' + esc(s.text) + '</div>'
                            ).join('');
                            break;
                        }
                    }
                    resultEl.innerHTML = result;
                    btn.innerHTML = '<i class="fas fa-check"></i> Complete';
                    btn.disabled = false;
                    logAdminAction('Ran AI analysis: ' + action);
                    setTimeout(() => { btn.innerHTML = '<i class="fas fa-play"></i> Re-run'; }, 2000);
                }, 800);
            });
        });
    }

    /* ---------- init ---------- */
    function init() {
        if (typeof PlayerEngine !== 'undefined' && PlayerEngine.init) PlayerEngine.init();
        initAudioPlayer();
        initParticles();
        loadUserName();
        initNav();
        initAssistant();
        bindUI();
        renderAll();

        if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.init) GlobalPlayer.init();

        if (typeof DataStore !== 'undefined' && DataStore.on) {
            DataStore.on('change', () => { renderAll(); syncAllUI(isStreamPlaying); });
        }

        bootstrapData();

        document.addEventListener('play', (e) => { if (e.target === audioPlayer) syncAllUI(true); }, true);
        document.addEventListener('pause', (e) => { if (e.target === audioPlayer) syncAllUI(false); }, true);

        logAdminAction('Dashboard opened');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
