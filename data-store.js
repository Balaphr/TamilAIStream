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
            const defaultSongs = [
                {
                    id: 'song_001',
                    title: 'Vaathi Coming',
                    artist: 'Anirudh Ravichander',
                    album: 'Master',
                    albumCover: 'https://i.ytimg.com/vi/1UOm9iM3k54/maxresdefault.jpg',
                    duration: '3:45',
                    status: 'published',
                    createdAt: Date.now() - 86400000,
                    youtubeId: '1UOm9iM3k54'
                },
                {
                    id: 'song_002',
                    title: 'Hukum',
                    artist: 'Anirudh Ravichander',
                    album: 'Jailer',
                    albumCover: 'https://i.ytimg.com/vi/dCxmW0Y5hLU/maxresdefault.jpg',
                    duration: '4:12',
                    status: 'published',
                    createdAt: Date.now() - 172800000,
                    youtubeId: 'dCxmW0Y5hLU'
                },
                {
                    id: 'song_003',
                    title: 'Arabic Kuthu',
                    artist: 'Anirudh Ravichander',
                    album: 'Beast',
                    albumCover: 'https://i.ytimg.com/vi/B7xaiNiBMEc/maxresdefault.jpg',
                    duration: '4:28',
                    status: 'published',
                    createdAt: Date.now() - 259200000,
                    youtubeId: 'B7xaiNiBMEc'
                },
                {
                    id: 'song_004',
                    title: 'Ranjithame',
                    artist: 'Thaman S',
                    album: 'Varisu',
                    albumCover: 'https://i.ytimg.com/vi/SZbmXXj4cnM/maxresdefault.jpg',
                    duration: '3:58',
                    status: 'published',
                    createdAt: Date.now() - 345600000,
                    youtubeId: 'SZbmXXj4cnM'
                },
                {
                    id: 'song_005',
                    title: 'Kutty Story',
                    artist: 'Anirudh Ravichander',
                    album: 'Master',
                    albumCover: 'https://i.ytimg.com/vi/yL5lu5JTK58/maxresdefault.jpg',
                    duration: '3:32',
                    status: 'published',
                    createdAt: Date.now() - 432000000,
                    youtubeId: 'yL5lu5JTK58'
                },
                {
                    id: 'song_006',
                    title: 'Nenjukulle',
                    artist: 'A.R. Rahman',
                    album: 'Kadal',
                    albumCover: 'https://i.ytimg.com/vi/8FNAj4SxSbM/maxresdefault.jpg',
                    duration: '4:15',
                    status: 'published',
                    createdAt: Date.now() - 518400000,
                    youtubeId: '8FNAj4SxSbM'
                },
                {
                    id: 'song_007',
                    title: 'Enjoy Enjaami',
                    artist: 'Dhee ft. Arivu',
                    album: 'Single',
                    albumCover: 'https://i.ytimg.com/vi/p9WFEKp1zRg/maxresdefault.jpg',
                    duration: '3:38',
                    status: 'published',
                    createdAt: Date.now() - 604800000,
                    youtubeId: 'p9WFEKp1zRg'
                },
                {
                    id: 'song_008',
                    title: 'Kannazhaga',
                    artist: 'Anirudh Ravichander',
                    album: '3',
                    albumCover: 'https://i.ytimg.com/vi/6F2dJfKqS2o/maxresdefault.jpg',
                    duration: '4:02',
                    status: 'published',
                    createdAt: Date.now() - 691200000,
                    youtubeId: '6F2dJfKqS2o'
                },
                {
                    id: 'song_009',
                    title: 'Rowdy Baby',
                    artist: 'Dhanush ft. Dhee',
                    album: 'Maari 2',
                    albumCover: 'https://i.ytimg.com/vi/f2DZPwQm2D8/maxresdefault.jpg',
                    duration: '3:52',
                    status: 'published',
                    createdAt: Date.now() - 777600000,
                    youtubeId: 'f2DZPwQm2D8'
                },
                {
                    id: 'song_010',
                    title: 'Verithanam',
                    artist: 'Thalapathy Vijay',
                    album: 'Bigil',
                    albumCover: 'https://i.ytimg.com/vi/cKdOKsH9vhM/maxresdefault.jpg',
                    duration: '4:05',
                    status: 'published',
                    createdAt: Date.now() - 864000000,
                    youtubeId: 'cKdOKsH9vhM'
                },
                {
                    id: 'song_011',
                    title: 'Kathu Vela Kaithavu',
                    artist: 'Anirudh Ravichander',
                    album: 'Nenjil Thunivirundhal',
                    albumCover: 'https://i.ytimg.com/vi/s7EdK3v3K3Y/maxresdefault.jpg',
                    duration: '3:48',
                    status: 'published',
                    createdAt: Date.now() - 950400000,
                    youtubeId: 's7EdK3v3K3Y'
                },
                {
                    id: 'song_012',
                    title: 'Aaluma Doluma',
                    artist: 'Anirudh Ravichander',
                    album: 'Vedalam',
                    albumCover: 'https://i.ytimg.com/vi/8ZJ0rJd1T5o/maxresdefault.jpg',
                    duration: '3:30',
                    status: 'published',
                    createdAt: Date.now() - 1036800000,
                    youtubeId: '8ZJ0rJd1T5o'
                },
                {
                    id: 'song_013',
                    title: 'Chaiyya Chaiyya',
                    artist: 'A.R. Rahman',
                    album: 'Raavanan',
                    albumCover: 'https://i.ytimg.com/vi/b3HiqXJY5yY/maxresdefault.jpg',
                    duration: '4:22',
                    status: 'published',
                    createdAt: Date.now() - 1123200000,
                    youtubeId: 'b3HiqXJY5yY'
                },
                {
                    id: 'song_014',
                    title: 'Aathangara Marame',
                    artist: 'Dhanush',
                    album: 'Komban',
                    albumCover: 'https://i.ytimg.com/vi/lM3nKlCjKmE/maxresdefault.jpg',
                    duration: '3:55',
                    status: 'published',
                    createdAt: Date.now() - 1209600000,
                    youtubeId: 'lM3nKlCjKmE'
                },
                {
                    id: 'song_015',
                    title: 'Why This Kolaveri Di',
                    artist: 'Dhanush',
                    album: '3',
                    albumCover: 'https://i.ytimg.com/vi/RfHGlO_50y4/maxresdefault.jpg',
                    duration: '3:42',
                    status: 'published',
                    createdAt: Date.now() - 1296000000,
                    youtubeId: 'RfHGlO_50y4'
                },
                {
                    id: 'song_016',
                    title: 'Theri Theme',
                    artist: 'Anirudh Ravichander',
                    album: 'Theri',
                    albumCover: 'https://i.ytimg.com/vi/aNkH2VZ0xKY/maxresdefault.jpg',
                    duration: '2:58',
                    status: 'published',
                    createdAt: Date.now() - 1382400000,
                    youtubeId: 'aNkH2VZ0xKY'
                },
                {
                    id: 'song_017',
                    title: 'Maari Thara Local',
                    artist: 'Anirudh Ravichander',
                    album: 'Maari',
                    albumCover: 'https://i.ytimg.com/vi/gN0VpLm2JqE/maxresdefault.jpg',
                    duration: '3:35',
                    status: 'published',
                    createdAt: Date.now() - 1468800000,
                    youtubeId: 'gN0VpLm2JqE'
                },
                {
                    id: 'song_018',
                    title: 'Kalasala Kalasala',
                    artist: 'A.R. Rahman',
                    album: 'Osthe',
                    albumCover: 'https://i.ytimg.com/vi/EKvKfGJjKtQ/maxresdefault.jpg',
                    duration: '4:10',
                    status: 'published',
                    createdAt: Date.now() - 1555200000,
                    youtubeId: 'EKvKfGJjKtQ'
                },
                {
                    id: 'song_019',
                    title: 'Adiye Romba Kuzhappam',
                    artist: 'Anirudh Ravichander',
                    album: 'Bachelor',
                    albumCover: 'https://i.ytimg.com/vi/bqj7N7g6QwY/maxresdefault.jpg',
                    duration: '3:40',
                    status: 'published',
                    createdAt: Date.now() - 1641600000,
                    youtubeId: 'bqj7N7g6QwY'
                },
                {
                    id: 'song_020',
                    title: 'Hridayam Aanandham',
                    artist: 'A.R. Rahman',
                    album: 'Kadal',
                    albumCover: 'https://i.ytimg.com/vi/qY1a3cK4tYU/maxresdefault.jpg',
                    duration: '4:25',
                    status: 'published',
                    createdAt: Date.now() - 1728000000,
                    youtubeId: 'qY1a3cK4tYU'
                }
            ];
            this.setSongs(defaultSongs);
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

