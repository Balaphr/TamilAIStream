'use strict';

/* ============================================
   PlaylistManager - Full Playlist System
   Favorites, History, Custom, AI, Downloads
   ============================================ */

const PlaylistManager = (() => {
    const STORAGE_KEYS = {
        favorites: 'pm_favorites',
        recentlyPlayed: 'pm_recently_played',
        mostPlayed: 'pm_most_played',
        customPlaylists: 'pm_custom_playlists',
        offlineDownloads: 'pm_offline_downloads',
        aiPlaylists: 'pm_ai_playlists'
    };

    let data = {
        favorites: [],
        recentlyPlayed: [],
        mostPlayed: {},
        customPlaylists: [],
        offlineDownloads: [],
        aiPlaylists: []
    };

    const listeners = {};

    function emit(event, payload) {
        (listeners[event] || []).forEach(fn => fn(payload));
    }

    function on(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
        return () => { listeners[event] = listeners[event].filter(f => f !== fn); };
    }

    function save() {
        try {
            Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
                localStorage.setItem(storageKey, JSON.stringify(data[key]));
            });
        } catch (e) {}
    }

    function load() {
        try {
            Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
                const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
                if (saved !== null) data[key] = saved;
            });
        } catch (e) {}
    }

    /* ---- Favorites ---- */
    function addFavorite(song) {
        const id = song.id || song.name;
        if (!data.favorites.some(f => (f.id || f.name) === id)) {
            data.favorites.unshift({ ...song, favoritedAt: Date.now() });
            save();
            emit('favorite', song);
        }
    }

    function removeFavorite(song) {
        const id = song.id || song.name;
        data.favorites = data.favorites.filter(f => (f.id || f.name) !== id);
        save();
        emit('unfavorite', song);
    }

    function toggleFavorite(song) {
        const id = song.id || song.name;
        if (isFavorite(song)) {
            removeFavorite(song);
            return false;
        } else {
            addFavorite(song);
            return true;
        }
    }

    function isFavorite(song) {
        const id = song.id || song.name;
        return data.favorites.some(f => (f.id || f.name) === id);
    }

    function getFavorites() { return [...data.favorites]; }

    /* ---- Recently Played ---- */
    function addRecentlyPlayed(song) {
        data.recentlyPlayed = data.recentlyPlayed.filter(s => (s.id || s.name) !== (song.id || song.name));
        data.recentlyPlayed.unshift({ ...song, playedAt: Date.now() });
        if (data.recentlyPlayed.length > 200) data.recentlyPlayed = data.recentlyPlayed.slice(0, 200);
        save();
        emit('recentlyPlayed', data.recentlyPlayed);
    }

    function getRecentlyPlayed(limit = 50) {
        return data.recentlyPlayed.slice(0, limit);
    }

    function clearRecentlyPlayed() {
        data.recentlyPlayed = [];
        save();
        emit('recentlyPlayed', data.recentlyPlayed);
    }

    /* ---- Most Played ---- */
    function incrementPlayCount(song) {
        const id = song.id || song.name;
        if (!data.mostPlayed[id]) {
            data.mostPlayed[id] = { ...song, playCount: 0 };
        }
        data.mostPlayed[id].playCount++;
        data.mostPlayed[id].lastPlayed = Date.now();
        save();
    }

    function getMostPlayed(limit = 50) {
        return Object.values(data.mostPlayed)
            .sort((a, b) => b.playCount - a.playCount)
            .slice(0, limit);
    }

    /* ---- Custom Playlists ---- */
    function createPlaylist(name, description = '') {
        const playlist = {
            id: 'pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name,
            description,
            songs: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cover: ''
        };
        data.customPlaylists.push(playlist);
        save();
        emit('playlistCreate', playlist);
        return playlist;
    }

    function deletePlaylist(id) {
        data.customPlaylists = data.customPlaylists.filter(p => p.id !== id);
        save();
        emit('playlistDelete', id);
    }

    function renamePlaylist(id, newName) {
        const pl = data.customPlaylists.find(p => p.id === id);
        if (pl) {
            pl.name = newName;
            pl.updatedAt = Date.now();
            save();
            emit('playlistUpdate', pl);
        }
    }

    function addToPlaylist(playlistId, songs) {
        const pl = data.customPlaylists.find(p => p.id === playlistId);
        if (!pl) return;
        if (!Array.isArray(songs)) songs = [songs];
        songs.forEach(song => {
            const id = song.id || song.name;
            if (!pl.songs.some(s => (s.id || s.name) === id)) {
                pl.songs.push({ ...song });
            }
        });
        pl.updatedAt = Date.now();
        save();
        emit('playlistUpdate', pl);
    }

    function removeFromPlaylist(playlistId, songId) {
        const pl = data.customPlaylists.find(p => p.id === playlistId);
        if (!pl) return;
        pl.songs = pl.songs.filter(s => (s.id || s.name) !== songId);
        pl.updatedAt = Date.now();
        save();
        emit('playlistUpdate', pl);
    }

    function getPlaylists() { return [...data.customPlaylists]; }

    function getPlaylist(id) {
        return data.customPlaylists.find(p => p.id === id) || null;
    }

    /* ---- AI Playlists ---- */
    function createAIPlaylist(name, songs, mood = '') {
        const playlist = {
            id: 'ai_pl_' + Date.now(),
            name,
            mood,
            songs: [...songs],
            createdAt: Date.now(),
            isAI: true
        };
        data.aiPlaylists.push(playlist);
        save();
        emit('aiPlaylistCreate', playlist);
        return playlist;
    }

    function getAIPlaylists() { return [...data.aiPlaylists]; }

    function deleteAIPlaylist(id) {
        data.aiPlaylists = data.aiPlaylists.filter(p => p.id !== id);
        save();
    }

    /* ---- Offline Downloads ---- */
    function addDownload(song) {
        const id = song.id || song.name;
        if (!data.offlineDownloads.some(d => (d.id || d.name) === id)) {
            data.offlineDownloads.push({ ...song, downloadedAt: Date.now() });
            save();
            emit('download', song);
        }
    }

    function removeDownload(song) {
        const id = song.id || song.name;
        data.offlineDownloads = data.offlineDownloads.filter(d => (d.id || d.name) !== id);
        save();
    }

    function isDownloaded(song) {
        const id = song.id || song.name;
        return data.offlineDownloads.some(d => (d.id || d.name) === id);
    }

    function getDownloads() { return [...data.offlineDownloads]; }

    /* ---- AI Recommendations ---- */
    function getRecommendationsByMood(mood) {
        const songs = DataStore.getSongs ? DataStore.getSongs() : [];
        const moodMap = {
            happy: ['folk', 'pop', 'dance', 'celebration'],
            sad: ['melody', 'romantic', 'sad', 'love'],
            energy: ['rock', 'hip-hop', 'dance', 'action'],
            chill: ['acoustic', 'classical', 'soft', 'romantic'],
            focus: ['instrumental', 'classical', 'ambient'],
            party: ['dance', 'folk', 'celebration', 'hip-hop'],
            romantic: ['romantic', 'love', 'melody']
        };
        const keywords = moodMap[mood.toLowerCase()] || [];
        return songs.filter(s => {
            if (s.status !== 'published') return false;
            const text = `${s.genre || ''} ${s.mood || ''} ${s.title || ''}`.toLowerCase();
            return keywords.some(k => text.includes(k));
        }).slice(0, 20);
    }

    function getSimilarSongs(song, limit = 10) {
        const songs = DataStore.getSongs ? DataStore.getSongs() : [];
        return songs.filter(s => {
            if (s.id === song.id) return false;
            if (s.status !== 'published') return false;
            return s.artist === song.artist || s.genre === song.genre || s.movie === song.movie;
        }).slice(0, limit);
    }

    function getRecentlyAdded(limit = 20) {
        const songs = DataStore.getSongs ? DataStore.getSongs() : [];
        return songs.filter(s => s.status === 'published')
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, limit);
    }

    function getTrendingSongs(limit = 20) {
        return getMostPlayed(limit);
    }

    function init() {
        load();
    }

    return {
        init, on,
        addFavorite, removeFavorite, toggleFavorite, isFavorite, getFavorites,
        addRecentlyPlayed, getRecentlyPlayed, clearRecentlyPlayed,
        incrementPlayCount, getMostPlayed,
        createPlaylist, deletePlaylist, renamePlaylist,
        addToPlaylist, removeFromPlaylist, getPlaylists, getPlaylist,
        createAIPlaylist, getAIPlaylists, deleteAIPlaylist,
        addDownload, removeDownload, isDownloaded, getDownloads,
        getRecommendationsByMood, getSimilarSongs, getRecentlyAdded, getTrendingSongs
    };
})();
