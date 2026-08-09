'use strict';

/* ============================================
   Listening History - Continue Listening Panel
   Tracks playback history with saved positions
   ============================================ */

const ListeningHistory = (() => {
    const STORAGE_KEY = 'lh_playback_history';
    const MAX_ITEMS = 50;
    let panel = null;
    let fab = null;
    let isOpen = false;

    /* ============================================
       Storage
       ============================================ */
    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) { return []; }
    }

    function saveHistory(items) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
        } catch (e) {}
    }

    function addOrUpdate(item) {
        const items = getHistory();
        const idx = items.findIndex(h => h.id === item.id && h.type === item.type);
        if (idx >= 0) {
            items.splice(idx, 1);
        }
        items.unshift({
            id: item.id,
            type: item.type,
            title: item.title,
            artist: item.artist || '',
            thumbnail: item.thumbnail || '',
            audioUrl: item.audioUrl || '',
            streamUrl: item.streamUrl || '',
            genre: item.genre || '',
            freq: item.freq || '',
            city: item.city || '',
            progress: item.progress || 0,
            duration: item.duration || 0,
            playedAt: Date.now()
        });
        saveHistory(items);
    }

    function removeItem(id, type) {
        const items = getHistory().filter(h => !(h.id === id && h.type === type));
        saveHistory(items);
    }

    function getContinueListening() {
        return getHistory().filter(h => h.progress > 0 && h.duration > 0 && h.type === 'song').slice(0, 5);
    }

    function getRecentlyPlayed() {
        return getHistory().slice(0, 15);
    }

    function getAIPicks() {
        const history = getHistory();
        if (history.length < 2) return [];
        const artists = {};
        history.forEach(h => {
            if (h.artist) {
                artists[h.artist] = (artists[h.artist] || 0) + 1;
            }
        });
        const topArtists = Object.entries(artists).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
        const allSongs = typeof DataStore !== 'undefined' ? DataStore.getSongs() : [];
        const playedIds = new Set(history.map(h => h.id));
        const picks = allSongs.filter(s => !playedIds.has(s.id) && topArtists.includes(s.artist)).slice(0, 5);
        if (picks.length < 5) {
            const extra = allSongs.filter(s => !playedIds.has(s.id) && !picks.includes(s)).slice(0, 5 - picks.length);
            picks.push(...extra);
        }
        return picks.slice(0, 5);
    }

    /* ============================================
       Format Helpers
       ============================================ */
    function formatTime(sec) {
        if (!sec || isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    function formatTimeAgo(ts) {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return mins + 'm ago';
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours + 'h ago';
        const days = Math.floor(hours / 24);
        return days + 'd ago';
    }

    /* ============================================
       Render
       ============================================ */
    function render() {
        if (!panel) return;
        const continueList = document.getElementById('lhContinueList');
        const recentList = document.getElementById('lhRecentList');
        const picksList = document.getElementById('lhPicksList');
        const continueSection = document.getElementById('lhContinueSection');
        const recentSection = document.getElementById('lhRecentSection');
        const picksSection = document.getElementById('lhPicksSection');
        const emptyEl = document.getElementById('lhEmpty');

        const continueItems = getContinueListening();
        const recentItems = getRecentlyPlayed();
        const picks = getAIPicks();

        // Continue Listening
        if (continueItems.length > 0) {
            continueSection.style.display = '';
            continueList.innerHTML = continueItems.map(h => {
                const pct = Math.min(100, (h.progress / h.duration) * 100);
                const isStation = h.type === 'station';
                return `
                    <div class="lh-item" data-id="${h.id}" data-type="${h.type}" onclick="ListeningHistory.playItem('${h.id}', '${h.type}')">
                        <div class="lh-item-art">
                            ${h.thumbnail ? `<img src="${h.thumbnail}" alt="">` : `<i class="fas ${isStation ? 'fa-radio' : 'fa-music'}"></i>`}
                            ${isStation ? '<div class="lh-live-dot"></div>' : ''}
                        </div>
                        <div class="lh-item-info">
                            <div class="lh-item-title">${h.title || 'Unknown'}</div>
                            <div class="lh-item-meta">${isStation ? (h.freq || 'Live FM') : (h.artist || '')} ${!isStation && h.progress > 0 ? '· ' + formatTime(h.progress) + ' / ' + formatTime(h.duration) : ''}</div>
                            ${!isStation && h.progress > 0 ? `<div class="lh-item-progress"><div class="lh-item-progress-bar" style="width:${pct}%"></div></div>` : ''}
                        </div>
                        <button class="lh-item-action" onclick="event.stopPropagation(); ListeningHistory.removeItem('${h.id}', '${h.type}')" title="Remove">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }).join('');
        } else {
            continueSection.style.display = 'none';
        }

        // Recently Played
        if (recentItems.length > 0) {
            recentSection.style.display = '';
            recentList.innerHTML = recentItems.map(h => {
                const isStation = h.type === 'station';
                return `
                    <div class="lh-item" onclick="ListeningHistory.playItem('${h.id}', '${h.type}')">
                        <div class="lh-item-art">
                            ${h.thumbnail ? `<img src="${h.thumbnail}" alt="">` : `<i class="fas ${isStation ? 'fa-radio' : 'fa-music'}"></i>`}
                            ${isStation ? '<div class="lh-live-dot"></div>' : ''}
                        </div>
                        <div class="lh-item-info">
                            <div class="lh-item-title">${h.title || 'Unknown'}</div>
                            <div class="lh-item-meta">${isStation ? (h.freq || 'Live FM') : (h.artist || '')} · ${formatTimeAgo(h.playedAt)}</div>
                        </div>
                        <button class="lh-item-action" onclick="event.stopPropagation(); ListeningHistory.removeItem('${h.id}', '${h.type}')" title="Remove">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }).join('');
        } else {
            recentSection.style.display = 'none';
        }

        // AI Picks
        if (picks.length > 0) {
            picksSection.style.display = '';
            picksList.innerHTML = picks.map(s => `
                <div class="lh-item" onclick="ListeningHistory.playSongFromStore('${s.id}')">
                    <div class="lh-item-art">
                        ${(s.albumCover || s.cover) ? `<img src="${s.albumCover || s.cover}" alt="">` : `<i class="fas fa-music"></i>`}
                    </div>
                    <div class="lh-item-info">
                        <div class="lh-item-title">${s.title || 'Unknown'}</div>
                        <div class="lh-item-meta">${s.artist || ''}</div>
                    </div>
                    <button class="lh-item-action" onclick="event.stopPropagation(); ListeningHistory.playSongFromStore('${s.id}')" title="Play">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            `).join('');
        } else {
            picksSection.style.display = 'none';
        }

        // Empty state
        const hasAny = continueItems.length > 0 || recentItems.length > 0 || picks.length > 0;
        emptyEl.style.display = hasAny ? 'none' : 'flex';
    }

    /* ============================================
       Play Actions
       ============================================ */
    function playItem(id, type) {
        if (type === 'station') {
            const stations = typeof DataStore !== 'undefined' ? DataStore.getStations() : [];
            const station = stations.find(s => s.name === id || s.id === id);
            if (station) {
                if (typeof playStation === 'function') {
                    playStation(station.name);
                }
                addOrUpdate({
                    id: station.name,
                    type: 'station',
                    title: station.name,
                    thumbnail: station.thumbnail || '',
                    streamUrl: station.streamUrl || '',
                    genre: station.genre || '',
                    freq: station.freq || '',
                    city: station.city || ''
                });
            }
        } else if (type === 'song') {
            const songs = typeof DataStore !== 'undefined' ? DataStore.getSongs() : [];
            const song = songs.find(s => s.id === id);
            if (song && song.audioUrl) {
                const savedHistory = getHistory().find(h => h.id === id && h.type === 'song');
                const resumeAt = savedHistory ? savedHistory.progress : 0;
                if (typeof playSong === 'function') {
                    playSong(song, [song]);
                }
                // Seek to saved position after a short delay to let audio load
                if (resumeAt > 0) {
                    setTimeout(() => {
                        if (typeof audioPlayer !== 'undefined' && audioPlayer && audioPlayer.duration) {
                            audioPlayer.currentTime = resumeAt;
                            if (typeof persistPlaybackState === 'function') persistPlaybackState();
                        }
                    }, 600);
                }
                addOrUpdate({
                    id: song.id,
                    type: 'song',
                    title: song.title,
                    artist: song.artist || '',
                    thumbnail: song.albumCover || song.cover || '',
                    audioUrl: song.audioUrl,
                    progress: resumeAt,
                    duration: song.duration || 0
                });
            }
        }
        closePanel();
    }

    function playSongFromStore(songId) {
        const songs = typeof DataStore !== 'undefined' ? DataStore.getSongs() : [];
        const song = songs.find(s => s.id === songId);
        if (song && song.audioUrl) {
            if (typeof playSong === 'function') {
                playSong(song, [song]);
            }
            addOrUpdate({
                id: song.id,
                type: 'song',
                title: song.title,
                artist: song.artist || '',
                thumbnail: song.albumCover || song.cover || '',
                audioUrl: song.audioUrl,
                progress: 0,
                duration: song.duration || 0
            });
        }
        closePanel();
    }

    /* ============================================
       Track Current Playback (called by hooks)
       ============================================ */
    function trackPlayback(track, mode) {
        if (!track) return;
        if (mode === 'station') {
            // Look up full station data from DataStore
            const stations = typeof DataStore !== 'undefined' ? DataStore.getStations() : [];
            const station = stations.find(s => s.name === track.title || s.id === track.id) || {};
            addOrUpdate({
                id: track.id || track.title,
                type: 'station',
                title: track.title || track.name,
                thumbnail: station.thumbnail || track.thumbnail || '',
                streamUrl: track.streamUrl || '',
                genre: station.genre || '',
                freq: station.freq || '',
                city: station.city || ''
            });
        } else {
            // Look up full song data from DataStore for better thumbnail
            const songs = typeof DataStore !== 'undefined' ? DataStore.getSongs() : [];
            const song = songs.find(s => s.id === track.id) || {};
            addOrUpdate({
                id: track.id,
                type: 'song',
                title: track.title || track.name,
                artist: track.artist || '',
                thumbnail: song.albumCover || song.cover || track.thumbnail || track.albumCover || track.cover || '',
                audioUrl: track.audioUrl || song.audioUrl || '',
                progress: typeof audioPlayer !== 'undefined' && audioPlayer ? audioPlayer.currentTime : 0,
                duration: typeof audioPlayer !== 'undefined' && audioPlayer ? audioPlayer.duration : (track.duration || song.duration || 0)
            });
        }
    }

    function updateCurrentProgress() {
        if (typeof audioPlayer === 'undefined' || !audioPlayer) return;
        if (typeof currentPlaybackTrack === 'undefined' || !currentPlaybackTrack) return;
        if (typeof currentPlaybackMode === 'undefined') return;
        addOrUpdate({
            id: currentPlaybackTrack.id || currentPlaybackTrack.title,
            type: currentPlaybackMode === 'station' ? 'station' : 'song',
            title: currentPlaybackTrack.title,
            artist: currentPlaybackTrack.artist || '',
            thumbnail: currentPlaybackTrack.thumbnail || '',
            audioUrl: currentPlaybackTrack.audioUrl || '',
            streamUrl: currentPlaybackTrack.streamUrl || '',
            progress: audioPlayer.currentTime || 0,
            duration: audioPlayer.duration || 0
        });
    }

    /* ============================================
       Panel Toggle
       ============================================ */
    function togglePanel() {
        if (isOpen) closePanel();
        else openPanel();
    }

    function openPanel() {
        if (!panel) return;
        isOpen = true;
        panel.classList.add('active');
        if (fab) fab.classList.add('active');
        render();
    }

    function closePanel() {
        if (!panel) return;
        isOpen = false;
        panel.classList.remove('active');
        if (fab) fab.classList.remove('active');
    }

    /* ============================================
       Init
       ============================================ */
    function init() {
        fab = document.getElementById('lhFab');
        panel = document.getElementById('lhPanel');
        const closeBtn = document.getElementById('lhClose');

        if (fab) fab.addEventListener('click', togglePanel);
        if (closeBtn) closeBtn.addEventListener('click', closePanel);

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (isOpen && panel && !panel.contains(e.target) && fab && !fab.contains(e.target)) {
                closePanel();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) closePanel();
        });

        // Hook into audio events when audioPlayer becomes available
        function hookAudioPlayer() {
            if (typeof audioPlayer !== 'undefined' && audioPlayer && !audioPlayer._lhHooked) {
                audioPlayer._lhHooked = true;
                audioPlayer.addEventListener('pause', () => {
                    updateCurrentProgress();
                });
                audioPlayer.addEventListener('timeupdate', () => {
                    // Throttle: only save every 10 seconds
                    if (!ListeningHistory._lastSave || Date.now() - ListeningHistory._lastSave > 10000) {
                        ListeningHistory._lastSave = Date.now();
                        updateCurrentProgress();
                    }
                });
            }
        }

        // Try immediately, then poll if audioPlayer doesn't exist yet
        hookAudioPlayer();
        if (typeof audioPlayer === 'undefined' || !audioPlayer) {
            const pollInterval = setInterval(() => {
                hookAudioPlayer();
                if (typeof audioPlayer !== 'undefined' && audioPlayer && audioPlayer._lhHooked) {
                    clearInterval(pollInterval);
                }
            }, 1000);
            setTimeout(() => clearInterval(pollInterval), 30000);
        }
    }

    return {
        init,
        openPanel,
        closePanel,
        togglePanel,
        trackPlayback,
        updateCurrentProgress,
        playItem,
        playSongFromStore,
        removeItem,
        getHistory
    };
})();

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ListeningHistory.init());
} else {
    ListeningHistory.init();
}
