'use strict';

// ============================================
// Data Store - Legacy Compatibility Layer
// Maintains backward compatibility while integrating with new site config
// ============================================

const DataStore = {
    KEYS: {
        SONGS: 'tamilAIStream_songs',
        IMAGES: 'tamilAIStream_images',
        STATIONS: 'tamilAIStream_stations',
        CATEGORIES: 'tamilAIStream_categories',
        FEATURED: 'tamilAIStream_featured',
        TRENDING: 'tamilAIStream_trending',
        ARTIST_HITS: 'tamilAIStream_artistHits',
        QUOTES: 'tamilAIStream_quotes',
        SITE_SETTINGS: 'tamilAIStream_siteSettings',
        LAYOUT: 'websiteLayout',
        RECENT_PLAYED: 'tamilAIStream_recent',
        MOODS: 'tamilAIStream_moods',
        AI_RADIO: 'tamilAIStream_aiRadio',
        NOTIFICATIONS: 'tamilAIStream_notifications',
        SPLASH: 'tamilAIStream_splash',
        PLAYER_PREFS: 'tamilAIStream_playerPrefs',
        NAVIGATION: 'tamilAIStream_navigation',
        SECTIONS_ORDER: 'tamilAIStream_sectionsOrder',
        LIKED_SONGS: 'ytm_likedSongs',
        PLAYLISTS: 'ytm_playlists',
        HISTORY: 'ytm_history',
        QUEUE: 'ytm_queue',
        SETTINGS: 'ytm_settings',
        SITE_CONFIG: 'siteConfig',
        MOVIES_COLLECTIONS: 'tamilAIStream_moviesCollections',
        YEARLY_COLLECTIONS: 'tamilAIStream_yearlyCollections',
        LATEST_COLLECTIONS: 'tamilAIStream_latestCollections',
        MUSIC_COLLECTIONS: 'tamilAIStream_musicCollections',
        ADVERTISEMENTS: 'tamilAIStream_advertisements',
        UPCOMING_RELEASES: 'tamilAIStream_upcomingReleases',
        NEWS: 'tamilAIStream_news',
        NEW_ALBUMS: 'tamilAIStream_newAlbums',
        FAVORITES: 'tamilAIStream_favorites',
        TRASH: 'tamilAIStream_trash',
        DELETED_IDS: 'tamilAIStream_deletedIds',
        APPLICATION: 'tamilAIStream_application'
    },

    get(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },

    set(key, value) {
        // Skip unchanged writes entirely: re-saving identical content used to
        // fire synthetic storage events that triggered full section re-renders
        // (the "blinking" storm) for zero benefit.
        let serialized;
        try { serialized = JSON.stringify(value); } catch (e) { return; }
        try {
            if (localStorage.getItem(key) === serialized) return;
        } catch (e) { /* storage unavailable — still attempt set below */ }

        localStorage.setItem(key, serialized);

        // Trigger storage event for cross-tab sync (only on real changes)
        window.dispatchEvent(new StorageEvent('storage', {
            key: key,
            newValue: serialized
        }));
    },

    getLive(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },

    // Internal: filter out items whose IDs appear in deletedIds[type]
    _filterDeleted(items, type) {
        if (!Array.isArray(items) || items.length === 0) return items;
        try {
            const deletedIds = this.get(this.KEYS.DELETED_IDS) || {};
            const ids = deletedIds[type];
            if (!Array.isArray(ids) || ids.length === 0) return items;
            const set = new Set(ids);
            return items.filter(item => item && item.id != null && !set.has(item.id));
        } catch (e) { return items; }
    },

    // Raw (unfiltered) access — used internally by delete operations,
    // R2 discovery, and sync to prevent deleted items from re-appearing.
    _getRaw(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },

    publishToLive() {
        const keys = Object.values(this.KEYS);
        let count = 0;
        keys.forEach(key => {
            const testKey = 'test_' + key;
            const testData = localStorage.getItem(testKey);
            if (testData !== null) {
                localStorage.setItem(key, testData);
                count++;
            }
        });
        return count;
    },

    getSongs() { return this._filterDeleted(this.get(this.KEYS.SONGS) || [], 'songs'); },
    setSongs(songs) { this.set(this.KEYS.SONGS, songs); },
    
    getStations() { return this._filterDeleted(this.get(this.KEYS.STATIONS) || [], 'stations'); },
    setStations(stations) { this.set(this.KEYS.STATIONS, stations); },
    
    getCategories() { return this._filterDeleted(this.get(this.KEYS.CATEGORIES) || [], 'categories'); },
    setCategories(categories) { this.set(this.KEYS.CATEGORIES, categories); },
    
    getFeatured() { return this._filterDeleted(this.get(this.KEYS.FEATURED) || [], 'featured'); },
    setFeatured(featured) { this.set(this.KEYS.FEATURED, featured); },
    
    getTrending() { return this._filterDeleted(this.get(this.KEYS.TRENDING) || [], 'trending'); },
    setTrending(trending) { this.set(this.KEYS.TRENDING, trending); },
    
    getImages() { return this._filterDeleted(this.get(this.KEYS.IMAGES) || [], 'images'); },
    setImages(images) { this.set(this.KEYS.IMAGES, images); },
    
    getMoods() { return this._filterDeleted(this.get(this.KEYS.MOODS) || [], 'moods'); },
    setMoods(moods) { this.set(this.KEYS.MOODS, moods); },
    
    getAIRadio() { return this._filterDeleted(this.get(this.KEYS.AI_RADIO) || [], 'aiRadio'); },
    setAIRadio(radio) { this.set(this.KEYS.AI_RADIO, radio); },
    
    getQuotes() { return this._filterDeleted(this.get(this.KEYS.QUOTES) || [], 'quotes'); },
    setQuotes(quotes) { this.set(this.KEYS.QUOTES, quotes); },
    
    getSiteSettings() { return this.get(this.KEYS.SITE_SETTINGS) || {}; },
    setSiteSettings(settings) { this.set(this.KEYS.SITE_SETTINGS, settings); },
    
    getSiteConfig() { return this.get(this.KEYS.SITE_CONFIG) || {}; },
    setSiteConfig(config) { this.set(this.KEYS.SITE_CONFIG, config); },
    
    getLikedSongs() { return this.get(this.KEYS.LIKED_SONGS) || []; },
    setLikedSongs(songs) { this.set(this.KEYS.LIKED_SONGS, songs); },
    
    getPlaylists() { return this.get(this.KEYS.PLAYLISTS) || []; },
    setPlaylists(playlists) { this.set(this.KEYS.PLAYLISTS, playlists); },
    
    getHistory() { return this.get(this.KEYS.HISTORY) || []; },
    setHistory(history) { this.set(this.KEYS.HISTORY, history); },
    
    getQueue() { return this.get(this.KEYS.QUEUE) || []; },
    setQueue(queue) { this.set(this.KEYS.QUEUE, queue); },

    getYTSettings() { return this.get(this.KEYS.SETTINGS) || {}; },
    setYTSettings(settings) { this.set(this.KEYS.SETTINGS, settings); },

    getNotifications() { return this._filterDeleted(this.get(this.KEYS.NOTIFICATIONS) || [], 'notifications'); },
    setNotifications(notifications) { this.set(this.KEYS.NOTIFICATIONS, notifications); },

    getArtistHits() { return this._filterDeleted(this.get(this.KEYS.ARTIST_HITS) || [], 'artistHits'); },
    setArtistHits(hits) { this.set(this.KEYS.ARTIST_HITS, hits); },

    getSplash() { return this.get('tamilAIStream_splash') || {}; },
    setSplash(data) { this.set('tamilAIStream_splash', data); },

    getPlayerPrefs() { return this.get('tamilAIStream_playerPrefs') || {}; },
    setPlayerPrefs(data) { this.set('tamilAIStream_playerPrefs', data); },

    getNavigation() { return this.get('tamilAIStream_navigation') || {}; },
    setNavigation(data) { this.set('tamilAIStream_navigation', data); },

    getSectionsOrder() { return this.get('tamilAIStream_sectionsOrder') || []; },
    setSectionsOrder(data) { this.set('tamilAIStream_sectionsOrder', data); },

    getLayout() { return this.get('websiteLayout') || []; },
    setLayout(data) { this.set('websiteLayout', data); },

    getMiniPlayerSettings() { return this.get('tamilAIStream_miniPlayerSettings') || {}; },
    setMiniPlayerSettings(data) { this.set('tamilAIStream_miniPlayerSettings', data); },

    getMoviesCollections() { return this.get(this.KEYS.MOVIES_COLLECTIONS) || []; },
    setMoviesCollections(data) { this.set(this.KEYS.MOVIES_COLLECTIONS, data); },

    getYearlyCollections() { return this.get(this.KEYS.YEARLY_COLLECTIONS) || []; },
    setYearlyCollections(data) { this.set(this.KEYS.YEARLY_COLLECTIONS, data); },

    getLatestCollections() { return this.get(this.KEYS.LATEST_COLLECTIONS) || []; },
    setLatestCollections(data) { this.set(this.KEYS.LATEST_COLLECTIONS, data); },

    getMusicCollections() { return this._filterDeleted(this.get(this.KEYS.MUSIC_COLLECTIONS) || [], 'musicCollections'); },
    setMusicCollections(data) { this.set(this.KEYS.MUSIC_COLLECTIONS, data); },

    getAdvertisements() { return this._filterDeleted(this.get(this.KEYS.ADVERTISEMENTS) || [], 'advertisements'); },
    setAdvertisements(ads) { this.set(this.KEYS.ADVERTISEMENTS, ads); },

    getUpcomingReleases() { return this._filterDeleted(this.get(this.KEYS.UPCOMING_RELEASES) || [], 'upcomingReleases'); },
    setUpcomingReleases(data) { this.set(this.KEYS.UPCOMING_RELEASES, data); },

    getNews() { return this.get(this.KEYS.NEWS) || []; },
    setNews(data) { this.set(this.KEYS.NEWS, data); },

    getNewAlbums() { return this._filterDeleted(this.get(this.KEYS.NEW_ALBUMS) || [], 'newAlbums'); },
    setNewAlbums(data) { this.set(this.KEYS.NEW_ALBUMS, data); },

    getFavorites() { return this.get(this.KEYS.FAVORITES) || []; },
    setFavorites(data) { this.set(this.KEYS.FAVORITES, data); },

    getTrash() { return this.get(this.KEYS.TRASH) || []; },
    setTrash(data) { this.set(this.KEYS.TRASH, data); },

    getDeletedIds() { return this.get(this.KEYS.DELETED_IDS) || {}; },
    setDeletedIds(data) { this.set(this.KEYS.DELETED_IDS, data); },

    getApplication() { return this.get(this.KEYS.APPLICATION) || {}; },
    setApplication(data) { this.set(this.KEYS.APPLICATION, data); },

    // Move an item to Trash instead of permanently deleting it
    moveToTrash(item, type) {
        const trash = this.getTrash();
        const deletedIds = this.getDeletedIds();

        const trashEntry = {
            ...item,
            _trashType: type,
            _trashedAt: new Date().toISOString(),
            _originalId: item.id
        };
        trash.push(trashEntry);
        this.setTrash(trash);

        // Track the deleted ID so sync never re-adds it
        if (!deletedIds[type]) deletedIds[type] = [];
        if (!deletedIds[type].includes(item.id)) {
            deletedIds[type].push(item.id);
        }
        this.setDeletedIds(deletedIds);

        return trashEntry;
    },

    // Restore an item from Trash back to its content type
    restoreFromTrash(originalId, type) {
        const trash = this.getTrash();
        const item = trash.find(t => t._originalId === originalId && t._trashType === type);
        if (!item) return null;

        const deletedIds = this.getDeletedIds();
        if (deletedIds[type]) {
            deletedIds[type] = deletedIds[type].filter(id => id !== originalId);
            this.setDeletedIds(deletedIds);
        }

        const cleanItem = { ...item };
        delete cleanItem._trashType;
        delete cleanItem._trashedAt;
        delete cleanItem._originalId;
        return cleanItem;
    },

    // Permanently delete from Trash
    permanentDeleteFromTrash(originalId, type) {
        let trash = this.getTrash();
        trash = trash.filter(t => !(t._originalId === originalId && t._trashType === type));
        this.setTrash(trash);
        // Also remove from deletedIds to prevent stale tracking
        const deletedIds = this.getDeletedIds();
        if (deletedIds[type]) {
            deletedIds[type] = deletedIds[type].filter(id => id !== originalId);
            this.setDeletedIds(deletedIds);
        }
    },

    // Check if an ID is in the deleted list for a content type
    isDeleted(type, id) {
        const deletedIds = this.getDeletedIds();
        return deletedIds[type] && deletedIds[type].includes(id);
    },

    // Purge expired trash items (older than given ms)
    purgeExpiredTrash(maxAgeMs) {
        const trash = this.getTrash();
        const deletedIds = this.getDeletedIds();
        const now = Date.now();
        const remaining = [];
        let purged = 0;

        trash.forEach(item => {
            const trashedAt = item._trashedAt ? new Date(item._trashedAt).getTime() : 0;
            if (now - trashedAt > maxAgeMs) {
                purged++;
                // Remove from deletedIds so it could be re-added if still on server
                if (deletedIds[item._trashType]) {
                    deletedIds[item._trashType] = deletedIds[item._trashType].filter(id => id !== item._originalId);
                }
            } else {
                remaining.push(item);
            }
        });

        this.setTrash(remaining);
        this.setDeletedIds(deletedIds);
        return purged;
    },
    toggleFavorite(song) {
        const favs = this.getFavorites();
        const idx = favs.findIndex(f => f.id === song.id);
        if (idx >= 0) {
            favs.splice(idx, 1);
        } else {
            favs.push({ ...song, favoritedAt: Date.now() });
        }
        this.setFavorites(favs);
        return idx < 0; // returns true if added, false if removed
    },
    isFavorite(songId) {
        return this.getFavorites().some(f => f.id === songId);
    },

    // Initialize with defaults
init() {
        // Songs
        if (!localStorage.getItem(this.KEYS.SONGS)) {
            this.setSongs([]);
        }
        
        // Stations
        if (!localStorage.getItem(this.KEYS.STATIONS)) {
            this.setStations([]);
        }
        
        // Categories
        if (!localStorage.getItem(this.KEYS.CATEGORIES)) {
            this.setCategories([]);
        }
        
        // Artist Hits (Dhanush, Vijay, Ajith collections)
        if (!localStorage.getItem(this.KEYS.ARTIST_HITS)) {
            const defaultArtistHits = [
                {
                    id: 'ah_dhanush',
                    name: 'Dhanush',
                    artist: 'dhanush',
                    songCount: 8,
                    gradient: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                    thumbnail: '',
                    status: 'active'
                },
                {
                    id: 'ah_vijay',
                    name: 'Thalapathy Vijay',
                    artist: 'vijay',
                    songCount: 8,
                    gradient: 'linear-gradient(135deg, #3498db, #2980b9)',
                    thumbnail: '',
                    status: 'active'
                },
                {
                    id: 'ah_ajith',
                    name: 'Thala Ajith',
                    artist: 'ajith',
                    songCount: 7,
                    gradient: 'linear-gradient(135deg, #f39c12, #e67e22)',
                    thumbnail: '',
                    status: 'active'
                },
                {
                    id: 'ah_anirudh',
                    name: 'Anirudh Ravichander',
                    artist: 'anirudh',
                    songCount: 10,
                    gradient: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
                    thumbnail: '',
                    status: 'active'
                },
                {
                    id: 'ah_arrahman',
                    name: 'A.R. Rahman',
                    artist: 'ar rahman',
                    songCount: 6,
                    gradient: 'linear-gradient(135deg, #1abc9c, #16a085)',
                    thumbnail: '',
                    status: 'active'
                },
                {
                    id: 'ah_suriya',
                    name: 'Suriya',
                    artist: 'suriya',
                    songCount: 5,
                    gradient: 'linear-gradient(135deg, #e67e22, #d35400)',
                    thumbnail: '',
                    status: 'active'
                }
            ];
            this.setArtistHits(defaultArtistHits);
        }

        // Site config
        if (!localStorage.getItem(this.KEYS.SITE_CONFIG)) {
            this.setSiteConfig({});
        }

        // Movies, Yearly, Latest Collections
        if (!localStorage.getItem(this.KEYS.MOVIES_COLLECTIONS)) {
            this.setMoviesCollections([]);
        }
        if (!localStorage.getItem(this.KEYS.YEARLY_COLLECTIONS)) {
            this.setYearlyCollections([]);
        }
        if (!localStorage.getItem(this.KEYS.LATEST_COLLECTIONS)) {
            this.setLatestCollections([]);
        }
        // Music Collections (Admin-created playlists/collections)
        if (!localStorage.getItem(this.KEYS.MUSIC_COLLECTIONS)) {
            this.setMusicCollections([]);
        }
        if (!localStorage.getItem(this.KEYS.ADVERTISEMENTS)) {
            this.setAdvertisements([]);
        }
        if (!localStorage.getItem(this.KEYS.UPCOMING_RELEASES)) {
            this.setUpcomingReleases([]);
        }
        if (!localStorage.getItem(this.KEYS.TRASH)) {
            this.setTrash([]);
        }
        if (!localStorage.getItem(this.KEYS.DELETED_IDS)) {
            this.setDeletedIds({});
        }
    },

    // Cross-tab sync
    initSync() {
        window.addEventListener('storage', (e) => {
            if (!e.key || !e.newValue) return;
            
            const keyName = Object.entries(this.KEYS).find(([, v]) => v === e.key)?.[0];
            if (keyName) {
                try {
                    const data = JSON.parse(e.newValue);
                    this._emit(e.key, data);
                    this._emit('change', { key: e.key, keyName, data });
                } catch (err) {
                    // ignore parse errors
                }
            }
        });
    },

    // Simple event emitter
    _callbacks: {},
    on(event, callback) {
        if (!this._callbacks[event]) this._callbacks[event] = [];
        this._callbacks[event].push(callback);
    },
    _emit(event, data) {
        if (this._callbacks[event]) {
            this._callbacks[event].forEach(cb => cb(data));
        }
    }
};

// Auto-initialize
DataStore.init();
DataStore.initSync();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataStore;
} else if (typeof window !== 'undefined') {
    window.DataStore = DataStore;
}

