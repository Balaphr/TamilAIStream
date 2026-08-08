'use strict';

// ============================================
// Shared Data Store - Real-time Sync via localStorage
// ============================================
// This file provides a centralized data layer that both the website and builder use.
// Changes made in one tab are immediately reflected in other tabs via storage events.

const DataStore = {
    // ============================================
    // Storage Keys
    // ============================================
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
        // New Builder-controlled sections
        MOODS: 'tamilAIStream_moods',
        AI_RADIO: 'tamilAIStream_aiRadio',
        NOTIFICATIONS: 'tamilAIStream_notifications',
        SPLASH: 'tamilAIStream_splash',
        PLAYER_PREFS: 'tamilAIStream_playerPrefs',
        NAVIGATION: 'tamilAIStream_navigation',
        SECTIONS_ORDER: 'tamilAIStream_sectionsOrder',
        // YouTube Music-like features
        LIKED_SONGS: 'ytm_likedSongs',
        PLAYLISTS: 'ytm_playlists',
        HISTORY: 'ytm_history',
        QUEUE: 'ytm_queue',
        SETTINGS: 'ytm_settings'
    },

    // ============================================
    // Default Data
    // ============================================
    DEFAULTS: {
        stations: [
            { id: 'st_1', name: 'Radio Mirchi Tamil', freq: '98.3 FM', genre: 'Music', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 12482, status: 'active', gradient: 'linear-gradient(135deg,#0f3b2e,#064e3b)' },
            { id: 'st_2', name: 'Hello FM Tamil', freq: '106.4 FM', genre: 'News', city: 'Coimbatore', streamUrl: 'https://stream.zeno.fm/s5w61993828uv', listeners: 8756, status: 'active', gradient: 'linear-gradient(135deg,#1a1a3e,#0a1628)' },
            { id: 'st_3', name: 'Tamil 89.4 FM', freq: '89.4 FM', genre: 'Music', city: 'Chennai', streamUrl: 'https://centova.aarenworld.com/proxy/894tamilfm/stream', listeners: 5200, status: 'active', gradient: 'linear-gradient(135deg,#1e3a5f,#0d1f3c)' },
            { id: 'st_4', name: 'Suryan FM', freq: '93.5 FM', genre: 'Music', city: 'Madurai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 6321, status: 'active', gradient: 'linear-gradient(135deg,#0f2b3e,#062b4e)' },
            { id: 'st_5', name: 'Rainbow FM', freq: '101.5 FM', genre: 'Entertainment', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 5904, status: 'active', gradient: 'linear-gradient(135deg,#2e0f3b,#3b0650)' },
            { id: 'st_6', name: 'Anna FM', freq: '90.4 FM', genre: 'Talk', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 4800, status: 'active', gradient: 'linear-gradient(135deg,#1a3b1a,#064e1a)' },
            { id: 'st_7', name: 'B IG FM', freq: '92.7 FM', genre: 'Music', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 3200, status: 'active', gradient: 'linear-gradient(135deg,#1a2e4e,#0a1e3e)' },
            { id: 'st_8', name: 'Lotus FM', freq: '96.2 FM', genre: 'Devotional', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 2800, status: 'active', gradient: 'linear-gradient(135deg,#2e1a0f,#4e2a0a)' },
            { id: 'st_9', name: 'Comedy FM', freq: '94.3 FM', genre: 'Comedy', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 3500, status: 'active', gradient: 'linear-gradient(135deg,#3b2e0f,#4e3a0a)' },
            { id: 'st_10', name: 'Sports FM', freq: '99.8 FM', genre: 'Sports', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 2100, status: 'active', gradient: 'linear-gradient(135deg,#1a2e1a,#0a4e1a)' },
            { id: 'st_11', name: 'Edu FM', freq: '88.6 FM', genre: 'Education', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 1800, status: 'active', gradient: 'linear-gradient(135deg,#2e2e1a,#3b3b0a)' },
            { id: 'st_12', name: 'Vel FM', freq: '99.1 FM', genre: 'Music', city: 'Salem', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 2900, status: 'active', gradient: 'linear-gradient(135deg,#0f2e3b,#063b4e)' },
            { id: 'st_13', name: 'News 24 Tamil', freq: '105.2 FM', genre: 'News', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 4200, status: 'active', gradient: 'linear-gradient(135deg,#3b1a1a,#4e0a0a)' },
            { id: 'st_14', name: 'Kala FM', freq: '97.8 FM', genre: 'Entertainment', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 3100, status: 'active', gradient: 'linear-gradient(135deg,#1a3b3b,#0a4e4e)' },
            { id: 'st_15', name: 'Mozhi FM', freq: '89.2 FM', genre: 'Talk', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 2600, status: 'active', gradient: 'linear-gradient(135deg,#2e1a2e,#4e0a3e)' },
            { id: 'st_16', name: 'Thendral FM', freq: '95.5 FM', genre: 'Devotional', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 2200, status: 'active', gradient: 'linear-gradient(135deg,#3b0f2e,#4e0a3e)' },
            { id: 'st_17', name: 'Ulagam FM', freq: '100.0 FM', genre: 'Music', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 3800, status: 'active', gradient: 'linear-gradient(135deg,#1a2e3b,#0a1e4e)' },
            { id: 'st_18', name: 'Nakkal FM', freq: '91.0 FM', genre: 'Comedy', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 2400, status: 'active', gradient: 'linear-gradient(135deg,#2e0f2e,#4e0a4e)' },
            { id: 'st_19', name: 'Tamil Hits Songs', freq: '103.2 FM', genre: 'Music', city: 'Chennai', streamUrl: 'https://stream.zeno.fm/0r0xa792kwzuv', listeners: 9500, status: 'active', gradient: 'linear-gradient(135deg,#1a3b2e,#064e3b)' }
        ],
        categories: [
            { id: 'cat_1', name: 'Music', icon: 'fa-music', count: 42, status: 'active' },
            { id: 'cat_2', name: 'News', icon: 'fa-newspaper', count: 28, status: 'active' },
            { id: 'cat_3', name: 'Talk Shows', icon: 'fa-comments', count: 18, status: 'active' },
            { id: 'cat_4', name: 'Entertainment', icon: 'fa-film', count: 24, status: 'active' },
            { id: 'cat_5', name: 'Devotional', icon: 'fa-pray', count: 15, status: 'active' },
            { id: 'cat_6', name: 'Comedy', icon: 'fa-laugh', count: 12, status: 'active' },
            { id: 'cat_7', name: 'Sports', icon: 'fa-futbol', count: 9, status: 'active' },
            { id: 'cat_8', name: 'Education', icon: 'fa-graduation-cap', count: 11, status: 'active' }
        ],
        featured: [
            { id: 'feat_1', title: 'Radio Mirchi Tamil', subtitle: '98.3 FM - Chennai', listeners: 12482, stationId: 'st_1', gradient: 'linear-gradient(135deg, #0f3b2e, #064e3b)', status: 'active' },
            { id: 'feat_2', title: 'Hello FM Tamil', subtitle: '106.4 FM - Coimbatore', listeners: 8756, stationId: 'st_2', gradient: 'linear-gradient(135deg, #1a1a3e, #0a1628)', status: 'active' },
            { id: 'feat_3', title: 'Tamil 89.4 FM', subtitle: '89.4 FM - Chennai', listeners: 5200, stationId: 'st_3', gradient: 'linear-gradient(135deg, #1e3a5f, #0d1f3c)', status: 'active' },
            { id: 'feat_4', title: 'Suryan FM', subtitle: '93.5 FM - Madurai', listeners: 6321, stationId: 'st_4', gradient: 'linear-gradient(135deg, #0f2b3e, #062b4e)', status: 'active' },
            { id: 'feat_5', title: 'Rainbow FM', subtitle: '101.5 FM - Chennai', listeners: 5904, stationId: 'st_5', gradient: 'linear-gradient(135deg, #2e0f3b, #3b0650)', status: 'active' }
        ],
        trending: [
            { id: 'trend_1', stationId: 'st_1', status: 'active' },
            { id: 'trend_2', stationId: 'st_2', status: 'active' },
            { id: 'trend_3', stationId: 'st_3', status: 'active' },
            { id: 'trend_4', stationId: 'st_4', status: 'active' },
            { id: 'trend_5', stationId: 'st_5', status: 'active' },
            { id: 'trend_6', stationId: 'st_6', status: 'active' },
            { id: 'trend_7', stationId: 'st_7', status: 'active' }
        ],
        artistHits: [
            { id: 'ah_1', artist: 'dhanush', name: 'Dhanush Hits', songCount: 156, gradient: 'linear-gradient(135deg,#1e3a5f,#0d1f3c)', status: 'active' },
            { id: 'ah_2', artist: 'vijay', name: 'Vijay Hits', songCount: 203, gradient: 'linear-gradient(135deg,#3b1a3b,#4e0a4e)', status: 'active' },
            { id: 'ah_3', artist: 'suriya', name: 'Suriya Hits', songCount: 178, gradient: 'linear-gradient(135deg,#2e1a0f,#4e2a0a)', status: 'active' },
            { id: 'ah_4', artist: 'ajith', name: 'Ajith Hits', songCount: 192, gradient: 'linear-gradient(135deg,#1a2e3b,#0a1e4e)', status: 'active' },
            { id: 'ah_5', artist: 'sivakarthikeyan', name: 'Sivakarthikeyan Hits', songCount: 145, gradient: 'linear-gradient(135deg,#3b2e0f,#4e3a0a)', status: 'active' },
            { id: 'ah_6', artist: 'str', name: 'STR (Simbu) Hits', songCount: 167, gradient: 'linear-gradient(135deg,#2e0f2e,#4e0a4e)', status: 'active' },
            { id: 'ah_7', artist: 'rajinikanth', name: 'Rajinikanth Hits', songCount: 134, gradient: 'linear-gradient(135deg,#3b1a1a,#4e0a0a)', status: 'active' },
            { id: 'ah_8', artist: 'kamalhaasan', name: 'Kamal Haasan Hits', songCount: 189, gradient: 'linear-gradient(135deg,#1a3b3b,#0a4e4e)', status: 'active' },
            { id: 'ah_9', artist: 'ilaiyaraaja', name: 'Ilaiyaraaja Hits', songCount: 412, gradient: 'linear-gradient(135deg,#2e2e1a,#3b3b0a)', status: 'active' },
            { id: 'ah_10', artist: 'arrahman', name: 'A.R. Rahman Hits', songCount: 356, gradient: 'linear-gradient(135deg,#0f2e3b,#063b4e)', status: 'active' },
            { id: 'ah_11', artist: 'anirudh', name: 'Anirudh Hits', songCount: 198, gradient: 'linear-gradient(135deg,#1a2e1a,#0a4e1a)', status: 'active' },
            { id: 'ah_12', artist: 'yuvan', name: 'Yuvan Shankar Raja Hits', songCount: 287, gradient: 'linear-gradient(135deg,#2e1a2e,#4e0a3e)', status: 'active' },
            { id: 'ah_13', artist: 'harris', name: 'Harris Jayaraj Hits', songCount: 234, gradient: 'linear-gradient(135deg,#1a2e4e,#0a1e6e)', status: 'active' },
            { id: 'ah_14', artist: 'gvprakash', name: 'G.V. Prakash Hits', songCount: 176, gradient: 'linear-gradient(135deg,#3b0f2e,#4e0a3e)', status: 'active' }
        ],
        quotes: [
            { id: 'q_1', text: 'இசை மனதை இணைக்கும் மொழி.', status: 'active' },
            { id: 'q_2', text: 'ஒவ்வொரு நாளும் ஒரு புதிய பாடலுடன் தொடங்குங்கள்.', status: 'active' },
            { id: 'q_3', text: 'இசை என்பது உணர்வுகளின் மொழி.', status: 'active' },
            { id: 'q_4', text: 'நல்ல இசை, நல்ல நாள்.', status: 'active' },
            { id: 'q_5', text: 'இசை இல்லா வாழ்க்கை வாழ்க்கையல்ல.', status: 'active' },
            { id: 'q_6', text: 'இசை உள்ளம் குளிரும்.', status: 'active' },
            { id: 'q_7', text: 'இசை என்பது இறைவனின் மொழி.', status: 'active' },
            { id: 'q_8', text: 'ஒவ்வொரு பாடலும் ஒரு கதை சொல்லும்.', status: 'active' }
        ],
        siteSettings: {
            title: 'Tamil AI Stream - AI-Powered Tamil Radio',
            description: 'Listen to your favorite Tamil FM stations with AI-powered recommendations. Discover 100+ live Tamil radio stations curated by artificial intelligence.',
            keywords: 'Tamil FM, Tamil radio, AI radio, Tamil music, online radio, Tamil AI Stream, live radio',
            ogTitle: 'Tamil AI Stream - AI-Powered Tamil Radio',
            ogDescription: 'Listen to your favorite Tamil FM stations with AI-powered recommendations.',
            ogUrl: 'https://tamilai.stream',
            themeColor: '#000000',
            footerText: '© 2024 Tamil AI Stream. All rights reserved.'
        },
        layout: [],
        moods: [
            { id: 'm_1', emoji: '🎵', name: 'Melody', gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', status: 'active' },
            { id: 'm_2', emoji: '⚡', name: 'Energy', gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)', status: 'active' },
            { id: 'm_3', emoji: '💕', name: 'Romance', gradient: 'linear-gradient(135deg,#ec4899,#f43f5e)', status: 'active' },
            { id: 'm_4', emoji: '🕊️', name: 'Peace', gradient: 'linear-gradient(135deg,#10b981,#06b6d4)', status: 'active' },
            { id: 'm_5', emoji: '🎉', name: 'Party', gradient: 'linear-gradient(135deg,#8b5cf6,#d946ef)', status: 'active' },
            { id: 'm_6', emoji: '💪', name: 'Workout', gradient: 'linear-gradient(135deg,#ef4444,#f97316)', status: 'active' },
            { id: 'm_7', emoji: '🌧️', name: 'Rainy', gradient: 'linear-gradient(135deg,#64748b,#3b82f6)', status: 'active' },
            { id: 'm_8', emoji: '🌅', name: 'Sunset', gradient: 'linear-gradient(135deg,#f97316,#eab308)', status: 'active' },
            { id: 'm_9', emoji: '🌙', name: 'Night', gradient: 'linear-gradient(135deg,#1e1b4b,#312e81)', status: 'active' },
            { id: 'm_10', emoji: '😎', name: 'Chill', gradient: 'linear-gradient(135deg,#06b6d4,#22d3ee)', status: 'active' },
            { id: 'm_11', emoji: '🔥', name: 'Power', gradient: 'linear-gradient(135deg,#dc2626,#ea580c)', status: 'active' },
            { id: 'm_12', emoji: '🎶', name: 'Classical', gradient: 'linear-gradient(135deg,#7c3aed,#a855f7)', status: 'active' }
        ],
        aiRadio: [
            { id: 'ar_1', icon: 'fa-sun', title: 'Morning Raga', desc: 'Start your day with soulful Tamil melodies', filter: 'music', status: 'active' },
            { id: 'ar_2', icon: 'fa-bolt', title: 'Workout Energy', desc: 'High-energy Tamil hits to power your workout', filter: 'music', status: 'active' },
            { id: 'ar_3', icon: 'fa-moon', title: 'Late Night Jazz', desc: 'Relax with smooth Tamil instrumentals', filter: 'music', status: 'active' },
            { id: 'ar_4', icon: 'fa-om', title: 'Devotional Flow', desc: 'Peaceful spiritual Tamil hymns', filter: 'devotional', status: 'active' },
            { id: 'ar_5', icon: 'fa-masks-theater', title: 'Comedy Hour', desc: 'Laugh out loud with Tamil comedy shows', filter: 'comedy', status: 'active' },
            { id: 'ar_6', icon: 'fa-newspaper', title: 'News Digest', desc: 'Stay updated with Tamil news channels', filter: 'news', status: 'active' }
        ],
        notifications: [
            { id: 'n_1', title: 'Welcome to Tamil AI Stream', message: 'Discover 100+ live Tamil FM stations powered by AI.', type: 'info', status: 'active', timestamp: Date.now() },
            { id: 'n_2', title: 'New Stations Added', message: 'Check out the latest Tamil radio stations added this week.', type: 'update', status: 'active', timestamp: Date.now() }
        ],
        splash: {
            enabled: true,
            duration: 2200,
            showEqualizer: true,
            showParticles: true,
            showLoadingBar: true,
            showSkipButton: true,
            logoIcon: 'fa-headphones-alt',
            title: 'Tamil AI Stream',
            subtitle: 'AI-Powered Tamil Radio'
        },
        playerPrefs: {
            autoplay: true,
            crossfade: false,
            crossfadeDuration: 2,
            defaultVolume: 0.8,
            eqPreset: 'flat',
            bassBoost: 0,
            trebleBoost: 0,
            vocalBoost: 0,
            stereoBalance: 0,
            loudnessNorm: false,
            surroundEffect: false
        },
        navigation: {
            showHome: true,
            showExplore: true,
            showLibrary: true,
            showSearch: true,
            showLiked: true,
            showStations: true,
            showArtists: true,
            showHistory: true,
            showPlaylists: true
        },
        sectionsOrder: [
            { id: 'sec_greeting', name: 'AI Greeting', enabled: true, order: 1 },
            { id: 'sec_featured', name: 'Featured Stations', enabled: true, order: 2 },
            { id: 'sec_trending', name: 'Trending Now', enabled: true, order: 3 },
            { id: 'sec_categories', name: 'Browse Categories', enabled: true, order: 4 },
            { id: 'sec_artisthits', name: 'Tamil Hits Collections', enabled: true, order: 5 },
            { id: 'sec_allstations', name: 'All Tamil FM Stations', enabled: true, order: 6 },
            { id: 'sec_recentadded', name: 'Recently Added', enabled: true, order: 7 },
            { id: 'sec_recommended', name: 'AI Recommended', enabled: true, order: 8 }
        ]
    },

    // ============================================
    // Event System
    // ============================================
    _listeners: {},

    on(key, callback) {
        if (!this._listeners[key]) this._listeners[key] = [];
        this._listeners[key].push(callback);
    },

    off(key, callback) {
        if (!this._listeners[key]) return;
        this._listeners[key] = this._listeners[key].filter(cb => cb !== callback);
    },

    _emit(key, data) {
        if (this._listeners[key]) {
            this._listeners[key].forEach(cb => cb(data));
        }
        // Also emit a wildcard event
        if (this._listeners['*']) {
            this._listeners['*'].forEach(cb => cb(key, data));
        }
    },

    // ============================================
    // Core Read/Write Methods
    // ============================================
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('DataStore.get error:', key, e);
            return null;
        }
    },

    set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            this._emit(key, data);
        } catch (e) {
            console.error('DataStore.set error:', key, e);
        }
    },

    // ============================================
    // Typed Getters with Defaults
    // ============================================
    getSongs() {
        return this.get(this.KEYS.SONGS) || [];
    },

    getStations() {
        return this.get(this.KEYS.STATIONS) || this.DEFAULTS.stations;
    },

    getCategories() {
        return this.get(this.KEYS.CATEGORIES) || this.DEFAULTS.categories;
    },

    getFeatured() {
        return this.get(this.KEYS.FEATURED) || this.DEFAULTS.featured;
    },

    getTrending() {
        return this.get(this.KEYS.TRENDING) || this.DEFAULTS.trending;
    },

    getArtistHits() {
        return this.get(this.KEYS.ARTIST_HITS) || this.DEFAULTS.artistHits;
    },

    getQuotes() {
        return this.get(this.KEYS.QUOTES) || this.DEFAULTS.quotes;
    },

    getSiteSettings() {
        return this.get(this.KEYS.SITE_SETTINGS) || this.DEFAULTS.siteSettings;
    },

    getLayout() {
        return this.get(this.KEYS.LAYOUT) || this.DEFAULTS.layout;
    },

    getImages() {
        return this.get(this.KEYS.IMAGES) || [];
    },

    getMoods() {
        return this.get(this.KEYS.MOODS) || this.DEFAULTS.moods;
    },

    getAIRadio() {
        return this.get(this.KEYS.AI_RADIO) || this.DEFAULTS.aiRadio;
    },

    getNotifications() {
        return this.get(this.KEYS.NOTIFICATIONS) || this.DEFAULTS.notifications;
    },

    getSplash() {
        return this.get(this.KEYS.SPLASH) || this.DEFAULTS.splash;
    },

    getPlayerPrefs() {
        return this.get(this.KEYS.PLAYER_PREFS) || this.DEFAULTS.playerPrefs;
    },

    getNavigation() {
        return this.get(this.KEYS.NAVIGATION) || this.DEFAULTS.navigation;
    },

    getSectionsOrder() {
        return this.get(this.KEYS.SECTIONS_ORDER) || this.DEFAULTS.sectionsOrder;
    },

    // ============================================
    // Typed Setters
    // ============================================
    setSongs(songs) { this.set(this.KEYS.SONGS, songs); },
    setStations(stations) { this.set(this.KEYS.STATIONS, stations); },
    setCategories(categories) { this.set(this.KEYS.CATEGORIES, categories); },
    setFeatured(featured) { this.set(this.KEYS.FEATURED, featured); },
    setTrending(trending) { this.set(this.KEYS.TRENDING, trending); },
    setArtistHits(hits) { this.set(this.KEYS.ARTIST_HITS, hits); },
    setQuotes(quotes) { this.set(this.KEYS.QUOTES, quotes); },
    setSiteSettings(settings) { this.set(this.KEYS.SITE_SETTINGS, settings); },
    setLayout(layout) { this.set(this.KEYS.LAYOUT, layout); },
    setImages(images) { this.set(this.KEYS.IMAGES, images); },
    setMoods(moods) { this.set(this.KEYS.MOODS, moods); },
    setAIRadio(radio) { this.set(this.KEYS.AI_RADIO, radio); },
    setNotifications(notifs) { this.set(this.KEYS.NOTIFICATIONS, notifs); },
    setSplash(splash) { this.set(this.KEYS.SPLASH, splash); },
    setPlayerPrefs(prefs) { this.set(this.KEYS.PLAYER_PREFS, prefs); },
    setNavigation(nav) { this.set(this.KEYS.NAVIGATION, nav); },
    setSectionsOrder(order) { this.set(this.KEYS.SECTIONS_ORDER, order); },
    
    // YouTube Music-like feature getters
    getLikedSongs() { return this.get(this.KEYS.LIKED_SONGS) || []; },
    getPlaylists() { return this.get(this.KEYS.PLAYLISTS) || []; },
    getHistory() { return this.get(this.KEYS.HISTORY) || []; },
    getQueue() { return this.get(this.KEYS.QUEUE) || []; },
    getYTSettings() { return this.get(this.KEYS.SETTINGS) || {}; },
    
    // YouTube Music-like feature setters
    setLikedSongs(songs) { this.set(this.KEYS.LIKED_SONGS, songs); },
    setPlaylists(playlists) { this.set(this.KEYS.PLAYLISTS, playlists); },
    setHistory(history) { this.set(this.KEYS.HISTORY, history); },
    setQueue(queue) { this.set(this.KEYS.QUEUE, queue); },
    setYTSettings(settings) { this.set(this.KEYS.SETTINGS, settings); },

    // ============================================
    // Initialize Default Data (if not exists)
    // ============================================
    init() {
        Object.entries(this.KEYS).forEach(([name, key]) => {
            const defaultKey = name.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            const defaults = this.DEFAULTS[defaultKey];
            if (!defaults) return;
            
            const existing = localStorage.getItem(key);
            if (existing === null) {
                this.set(key, defaults);
            }
        });
    },

    // ============================================
    // Cross-tab Sync via Storage Event
    // ============================================
    initSync() {
        window.addEventListener('storage', (e) => {
            if (!e.key || !e.newValue) return;
            
            // Find which key changed
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
    }
};

// Auto-initialize sync listeners (but NOT init defaults - R2 sync handles that)
DataStore.initSync();
