'use strict';

/* ============================================
   user-data-sync.js — Server-side user data sync
   ─────────────────────────────────────────────
   Every logged-in user's personal data is synced
   to the Cloudflare R2 server. Guest users get a
   completely fresh state with no data leakage.
   ============================================ */

window.UserDataSync = (function () {
    const SYNC_DEBOUNCE_MS = 2000;
    const API_BASE = '';
    let _currentUserId = null;
    let _syncTimer = null;
    let _loadedFromServer = false;
    let _pendingChanges = {};

    // ─── Keys that are user-personal and MUST be scoped ───
    const USER_SCOPED_KEYS = {
        likedSongs: 'ytm_likedSongs',
        favorites: 'tamilAIStream_favorites',
        playlists: 'ytm_playlists',
        queue: 'ytm_queue',
        settings: 'ytm_settings',
        aiPreferences: 'tamilAI_preferences',
        aiArtistPrefs: 'tamilAI_artistPrefs',
        aiMoviePrefs: 'tamilAI_moviePrefs',
        aiFavorites: 'tamilAI_favorites',
        aiThemeLight: 'ai_theme_light',
        notifications: 'tamilAIStream_notifications',
        darkMode: 'tamilAIStream_darkMode',
        language: 'tamilAIStream_language',
        playerState: 'tamilAIStream_player_state',
        playerSelection: 'tamilAIStream_player_selection',
        currentPlaylist: 'tamilAIStream_currentPlaylist',
        playerEngineState: 'player_engine_state',
    };

    // ─── Legacy keys that other modules read from (shared → must be isolated) ───
    const LEGACY_SHARED_KEYS = [
        'ytm_likedSongs',
        'tamilAIStream_favorites',
        'ytm_playlists',
        'tamilAI_queue',
        'ytm_settings',
        'tamilAI_preferences',
        'tamilAI_artistPrefs',
        'tamilAI_moviePrefs',
        'tamilAI_favorites',
        'ai_theme_light',
        'tamilAIStream_notifications',
        'tamilAIStream_darkMode',
        'tamilAIStream_language',
        'tamilAIStream_player_state',
        'tamilAIStream_player_selection',
        'tamilAIStream_currentPlaylist',
        'player_engine_state',
    ];

    function _getUserId() {
        if (_currentUserId) return _currentUserId;
        try {
            if (typeof Auth !== 'undefined' && Auth.currentUser) {
                const user = Auth.currentUser();
                if (user && !user.isGuest) {
                    _currentUserId = user.uid || user.email;
                    return _currentUserId;
                }
            }
        } catch (e) {}
        return null;
    }

    /**
     * Get a user-scoped localStorage key.
     * If user is logged in, appends userId suffix.
     * If guest, returns the base key (but guest data is isolated by
     * being ephemeral — cleared on logout).
     */
    function scopedKey(baseKey) {
        const userId = _getUserId();
        if (!userId) return baseKey + '_guest';
        return baseKey + '_' + userId.replace(/[^a-zA-Z0-9._@-]/g, '_');
    }

    /**
     * Ensure the global (un-scoped) key used by legacy code points to
     * the current user's data. Copies from the scoped key to the global key
     * so existing readers (YTMusic, profile page, etc.) see the right data.
     */
    function _syncGlobalKey(baseKey) {
        const userId = _getUserId();
        const scoped = localStorage.getItem(scopedKey(baseKey));
        if (userId) {
            // Logged in: ensure global key shows this user's data
            if (scoped !== null) {
                localStorage.setItem(baseKey, scoped);
            } else {
                // First time — clear any stale data from previous user
                localStorage.removeItem(baseKey);
            }
        } else {
            // Guest: remove stale data, use scoped guest key
            localStorage.removeItem(baseKey);
        }
    }

    /**
     * Read user data from localStorage (all scoped keys).
     */
    function _readLocalData() {
        const data = {};
        for (const [field, baseKey] of Object.entries(USER_SCOPED_KEYS)) {
            const key = scopedKey(baseKey);
            try {
                const raw = localStorage.getItem(key);
                data[field] = raw ? JSON.parse(raw) : null;
            } catch (e) {
                data[field] = null;
            }
        }
        // Also read listening history from its own scoped key
        try {
            const lhKey = 'lh_playback_history_' + (_getUserId() || 'guest').replace(/[^a-zA-Z0-9._@-]/g, '_');
            const raw = localStorage.getItem(lhKey);
            data.listeningHistory = raw ? JSON.parse(raw) : null;
        } catch (e) {
            data.listeningHistory = null;
        }
        return data;
    }

    /**
     * Write user data to localStorage (scoped keys) and sync global keys.
     */
    function _writeLocalData(data) {
        for (const [field, baseKey] of Object.entries(USER_SCOPED_KEYS)) {
            const key = scopedKey(baseKey);
            if (data[field] !== undefined && data[field] !== null) {
                localStorage.setItem(key, JSON.stringify(data[field]));
            }
        }
        if (data.listeningHistory !== undefined && data.listeningHistory !== null) {
            const lhKey = 'lh_playback_history_' + (_getUserId() || 'guest').replace(/[^a-zA-Z0-9._@-]/g, '_');
            localStorage.setItem(lhKey, JSON.stringify(data.listeningHistory));
        }
        // Sync global keys so legacy code reads correct data
        _syncGlobalKeys();
    }

    /**
     * Sync ALL global (un-scoped) keys to current user's scoped data.
     */
    function _syncGlobalKeys() {
        for (const baseKey of LEGACY_SHARED_KEYS) {
            _syncGlobalKey(baseKey);
        }
        // Sync DataStore history
        if (typeof DataStore !== 'undefined' && DataStore.switchHistoryUser) {
            DataStore.switchHistoryUser(_getUserId());
        }
    }

    /**
     * Debounced server save.
     */
    function _scheduleSync() {
        if (_syncTimer) clearTimeout(_syncTimer);
        _syncTimer = setTimeout(() => _flushToServer(), SYNC_DEBOUNCE_MS);
    }

    /**
     * Push all local user data to the server.
     */
    async function _flushToServer() {
        const userId = _getUserId();
        if (!userId) return; // Don't sync guest data
        try {
            const data = _readLocalData();
            const resp = await fetch(API_BASE + '/api/user/data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                },
                body: JSON.stringify({ data }),
            });
            if (resp.ok) {
                console.log('[UserDataSync] Saved to server for', userId);
            } else {
                console.warn('[UserDataSync] Server save failed:', resp.status);
            }
        } catch (e) {
            console.warn('[UserDataSync] Server save error:', e.message);
        }
    }

    /**
     * Load user data from server and populate localStorage.
     * Called on login. Returns true if data was loaded.
     */
    async function loadFromServer() {
        const userId = _getUserId();
        if (!userId) {
            console.log('[UserDataSync] No user, skipping server load');
            return false;
        }
        try {
            const resp = await fetch(API_BASE + '/api/user/data', {
                method: 'GET',
                headers: { 'X-User-Id': userId },
            });
            if (!resp.ok) {
                console.warn('[UserDataSync] Server load failed:', resp.status);
                return false;
            }
            const result = await resp.json();
            if (result.success && result.data && !result.isNew) {
                _writeLocalData(result.data);
                _loadedFromServer = true;
                console.log('[UserDataSync] Loaded from server for', userId);
                return true;
            } else {
                console.log('[UserDataSync] Fresh user on server, saving local data');
                // New user — push local data to server
                await _flushToServer();
                _loadedFromServer = true;
                return false;
            }
        } catch (e) {
            console.warn('[UserDataSync] Server load error:', e.message);
            return false;
        }
    }

    /**
     * Called after any user data change (like, favorite, history, playlist, etc.)
     * Triggers a debounced server sync.
     */
    function notifyChange() {
        if (!_getUserId()) return; // Don't track guest changes
        // Sync global keys in case another module wrote to an un-scoped key
        _syncGlobalKeys();
        _scheduleSync();
    }

    /**
     * Called on login. Loads server data, then syncs global keys.
     */
    async function onLogin() {
        _currentUserId = _getUserId();
        _loadedFromServer = false;
        if (_currentUserId) {
            await loadFromServer();
            _syncGlobalKeys();
            // Start periodic sync
            _startPeriodicSync();
        }
    }

    /**
     * Called on logout. Saves final state, clears globals, stops sync.
     */
    async function onLogout() {
        // Save any pending changes first
        if (_syncTimer) {
            clearTimeout(_syncTimer);
            _syncTimer = null;
        }
        const previousUserId = _currentUserId;
        await _flushToServer();
        // Stop periodic sync
        _stopPeriodicSync();
        // Clear global keys so next user doesn't see stale data
        for (const baseKey of LEGACY_SHARED_KEYS) {
            localStorage.removeItem(baseKey);
        }
        // Clear scoped guest key
        for (const baseKey of Object.values(USER_SCOPED_KEYS)) {
            localStorage.removeItem(baseKey + '_guest');
        }
        // Clear in-memory caches that hold the previous user's data
        _currentUserId = null;
        _loadedFromServer = false;
        // Clear DataStore cache for previous user
        try {
            if (typeof DataStore !== 'undefined' && DataStore.invalidateAll) {
                DataStore.invalidateAll();
            }
        } catch(e) {}
    }

    /**
     * Periodic sync to catch missed changes (every 60 seconds).
     */
    let _periodicInterval = null;
    function _startPeriodicSync() {
        _stopPeriodicSync();
        _periodicInterval = setInterval(() => {
            if (_getUserId()) _flushToServer();
        }, 60000);
    }
    function _stopPeriodicSync() {
        if (_periodicInterval) {
            clearInterval(_periodicInterval);
            _periodicInterval = null;
        }
    }

    // ─── Intercept localStorage.setItem to catch writes from other modules ───
    const _origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
        _origSetItem(key, value);
        // If this is a user-scoped key being written, trigger sync
        for (const baseKey of Object.values(USER_SCOPED_KEYS)) {
            if (key === baseKey || key.startsWith(baseKey + '_')) {
                if (_getUserId()) {
                    // Update the scoped version too
                    const scoped = scopedKey(baseKey);
                    if (key !== scoped) {
                        _origSetItem(scoped, value);
                    }
                    _scheduleSync();
                }
                return;
            }
        }
        // Also intercept listening history writes
        if (key.startsWith('lh_playback_history_')) {
            if (_getUserId()) {
                const scopedLh = 'lh_playback_history_' + _getUserId().replace(/[^a-zA-Z0-9._@-]/g, '_');
                if (key !== scopedLh) {
                    _origSetItem(scopedLh, value);
                }
                _scheduleSync();
            }
        }
    };

    return {
        onLogin,
        onLogout,
        notifyChange,
        loadFromServer,
        flushToServer: _flushToServer,
        scopedKey,
        USER_SCOPED_KEYS,
        get isLoaded() { return _loadedFromServer; },
        get currentUserId() { return _currentUserId; },
    };
})();
