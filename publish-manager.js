'use strict';

/* ============================================================
   PublishManager — Staging / Publish Workflow for Tamil AI Stream
   
   Workflow: Admin Change → Preview/Staging → Review → Publish → Public
   
   - All admin changes go to staging-manifest.json (R2)
   - Public site only reads content-manifest.json (R2)
   - Admin can preview staging, review diffs, publish or discard
   ============================================================ */

const PublishManager = (() => {
    const STAGING_KEY = 'tamilAIStream_publishManager';
    let _state = {
        isStagingMode: false,
        hasStaging: false,
        hasPublished: false,
        stagingSavedAt: null,
        publishedAt: null,
        pendingChanges: [],
    };

    // ---- Persistence (localStorage for UI state) ----
    function _saveLocalState() {
        try {
            localStorage.setItem(STAGING_KEY, JSON.stringify({
                isStagingMode: _state.isStagingMode,
            }));
        } catch (e) { /* ignore */ }
    }
    function _loadLocalState() {
        try {
            const raw = localStorage.getItem(STAGING_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                _state.isStagingMode = !!saved.isStagingMode;
            }
        } catch (e) { /* ignore */ }
    }

    // ---- API helpers ----
    async function _api(method, url, body) {
        const opts = { method, headers: {} };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const resp = await fetch(url, opts);
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: resp.statusText }));
            throw new Error(err.error || 'API error');
        }
        return resp.json();
    }

    // ---- Public API ----

    /** Check current publish status from server */
    async function refreshStatus() {
        try {
            const status = await _api('GET', '/api/publish');
            _state.hasPublished = status.hasPublished;
            _state.publishedAt = status.publishedAt;
            _state.hasStaging = status.hasStaging;
            _state.stagingSavedAt = status.stagingSavedAt;
            _emit('status', _state);
            return _state;
        } catch (e) {
            console.error('PublishManager: status check failed', e);
            return _state;
        }
    }

    /** Save current DataStore state to staging manifest */
    async function saveToStaging() {
        try {
            // Build the full content payload from DataStore (same as ContentSync)
            let payload;
            if (typeof ContentSync !== 'undefined' && typeof ContentSync.buildContentPayload === 'function') {
                payload = ContentSync.buildContentPayload();
            } else {
                // Fallback: build from localStorage
                payload = _buildPayloadFromStorage();
            }

            payload._stagingMeta = {
                savedAt: new Date().toISOString(),
                savedBy: 'admin',
            };

            const result = await _api('POST', '/api/staging', payload);
            _state.hasStaging = true;
            _state.stagingSavedAt = result.savedAt;
            _emit('staging-saved', _state);
            return result;
        } catch (e) {
            console.error('PublishManager: save to staging failed', e);
            throw e;
        }
    }

    /** Publish staging to production */
    async function publish() {
        try {
            const result = await _api('POST', '/api/publish');
            _state.hasStaging = false;
            _state.stagingSavedAt = null;
            _state.publishedAt = result.publishedAt;
            _state.hasPublished = true;
            _state.isStagingMode = false;
            _saveLocalState();
            _emit('published', _state);
            return result;
        } catch (e) {
            console.error('PublishManager: publish failed', e);
            throw e;
        }
    }

    /** Discard staging changes */
    async function discardStaging() {
        try {
            await _api('DELETE', '/api/staging');
            _state.hasStaging = false;
            _state.stagingSavedAt = null;
            _state.isStagingMode = false;
            _saveLocalState();
            _emit('staging-discarded', _state);
            return { success: true };
        } catch (e) {
            console.error('PublishManager: discard staging failed', e);
            throw e;
        }
    }

    /** Get diff between staging and published */
    async function getDiff() {
        try {
            const diff = await _api('GET', '/api/staging/diff');
            _state.pendingChanges = diff.changes || [];
            _emit('diff', diff);
            return diff;
        } catch (e) {
            console.error('PublishManager: get diff failed', e);
            return { hasChanges: false, changes: [] };
        }
    }

    /** Enter staging mode — subsequent syncToLiveWebsite() writes to staging */
    function enterStagingMode() {
        _state.isStagingMode = true;
        _saveLocalState();
        _emit('mode-changed', _state);
    }

    /** Exit staging mode — subsequent syncToLiveWebsite() writes to production */
    function exitStagingMode() {
        _state.isStagingMode = false;
        _saveLocalState();
        _emit('mode-changed', _state);
    }

    /** Check if currently in staging mode */
    function isStagingMode() {
        return _state.isStagingMode;
    }

    /** Get current state */
    function getState() {
        return { ..._state };
    }

    /** Load staging manifest into local DataStore for preview */
    async function loadStagingForPreview() {
        try {
            const result = await _api('GET', '/api/staging');
            if (result.hasStaging && result.staging && result.staging.data) {
                _applyDataToDataStore(result.staging.data);
                _emit('preview-loaded', _state);
                return true;
            }
            return false;
        } catch (e) {
            console.error('PublishManager: load staging preview failed', e);
            return false;
        }
    }

    /** Load published manifest into local DataStore (restore from preview) */
    async function loadPublishedForRestore() {
        try {
            const result = await _api('GET', '/api/manifest');
            if (result && result.data) {
                _applyDataToDataStore(result.data);
                _emit('preview-restored', _state);
                return true;
            }
            return false;
        } catch (e) {
            console.error('PublishManager: load published restore failed', e);
            return false;
        }
    }

    // ---- Internal helpers ----

    function _applyDataToDataStore(data) {
        if (typeof DataStore === 'undefined') return;
        const setters = {
            songs: 'setSongs', stations: 'setStations', categories: 'setCategories',
            featured: 'setFeatured', trending: 'setTrending', artistHits: 'setArtistHits',
            quotes: 'setQuotes', siteSettings: 'setSiteSettings', layout: 'setLayout',
            images: 'setImages', moods: 'setMoods', aiRadio: 'setAIRadio',
            notifications: 'setNotifications', splash: 'setSplash',
            playerPrefs: 'setPlayerPrefs', navigation: 'setNavigation',
            sectionsOrder: 'setSectionsOrder', miniPlayerSettings: 'setMiniPlayerSettings',
            moviesCollections: 'setMoviesCollections', yearlyCollections: 'setYearlyCollections',
            latestCollections: 'setLatestCollections', musicCollections: 'setMusicCollections',
            advertisements: 'setAdvertisements', news: 'setNews',
            deletedIds: 'setDeletedIds', trash: 'setTrash',
            songsCollections: 'setSongsCollections', upcomingReleases: 'setUpcomingReleases',
            newAlbums: 'setNewAlbums',
        };
        for (const [key, setter] of Object.entries(setters)) {
            if (data[key] !== undefined && typeof DataStore[setter] === 'function') {
                DataStore[setter](data[key]);
            }
        }
    }

    function _buildPayloadFromStorage() {
        const data = {};
        const keys = [
            'songs', 'stations', 'categories', 'featured', 'trending',
            'artistHits', 'quotes', 'siteSettings', 'layout', 'images',
            'moods', 'aiRadio', 'notifications', 'splash', 'playerPrefs',
            'navigation', 'sectionsOrder', 'miniPlayerSettings',
            'moviesCollections', 'yearlyCollections', 'latestCollections',
            'musicCollections', 'advertisements', 'news', 'deletedIds',
            'trash', 'songsCollections', 'upcomingReleases', 'newAlbums',
        ];
        for (const key of keys) {
            try {
                const raw = localStorage.getItem('tamilAIStream_' + key);
                if (raw) data[key] = JSON.parse(raw);
            } catch (e) { /* ignore */ }
        }
        // websiteLayout uses a different key
        try {
            const raw = localStorage.getItem('websiteLayout');
            if (raw) data.layout = JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return { version: 1, updatedAt: new Date().toISOString(), data };
    }

    // ---- Event system ----
    const _listeners = {};
    function on(event, fn) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(fn);
        return () => { _listeners[event] = _listeners[event].filter(f => f !== fn); };
    }
    function _emit(event, data) {
        (_listeners[event] || []).forEach(fn => { try { fn(data); } catch (e) { /* ignore */ } });
    }

    // ---- Init ----
    _loadLocalState();

    return {
        refreshStatus,
        saveToStaging,
        publish,
        discardStaging,
        getDiff,
        enterStagingMode,
        exitStagingMode,
        isStagingMode,
        getState,
        loadStagingForPreview,
        loadPublishedForRestore,
        on,
    };
})();
