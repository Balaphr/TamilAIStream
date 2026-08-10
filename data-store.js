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
        SITE_CONFIG: 'siteConfig' // New key for unified config
    },

    get(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },

    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        
        // Trigger storage event for cross-tab sync
        window.dispatchEvent(new StorageEvent('storage', {
            key: key,
            newValue: JSON.stringify(value)
        }));
    },

    getSongs() { return this.get(this.KEYS.SONGS) || []; },
    setSongs(songs) { this.set(this.KEYS.SONGS, songs); },
    
    getStations() { return this.get(this.KEYS.STATIONS) || []; },
    setStations(stations) { this.set(this.KEYS.STATIONS, stations); },
    
    getCategories() { return this.get(this.KEYS.CATEGORIES) || []; },
    setCategories(categories) { this.set(this.KEYS.CATEGORIES, categories); },
    
    getFeatured() { return this.get(this.KEYS.FEATURED) || []; },
    setFeatured(featured) { this.set(this.KEYS.FEATURED, featured); },
    
    getTrending() { return this.get(this.KEYS.TRENDING) || []; },
    setTrending(trending) { this.set(this.KEYS.TRENDING, trending); },
    
    getImages() { return this.get(this.KEYS.IMAGES) || []; },
    setImages(images) { this.set(this.KEYS.IMAGES, images); },
    
    getMoods() { return this.get(this.KEYS.MOODS) || []; },
    setMoods(moods) { this.set(this.KEYS.MOODS, moods); },
    
    getAIRadio() { return this.get(this.KEYS.AI_RADIO) || []; },
    setAIRadio(radio) { this.set(this.KEYS.AI_RADIO, radio); },
    
    getQuotes() { return this.get(this.KEYS.QUOTES) || []; },
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

    getNotifications() { return this.get(this.KEYS.NOTIFICATIONS) || []; },
    setNotifications(notifications) { this.set(this.KEYS.NOTIFICATIONS, notifications); },

    getArtistHits() { return this.get(this.KEYS.ARTIST_HITS) || []; },
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

