'use strict';

/* ============================================================
   PublishManager — Staging / Publish Workflow for Tamil AI Stream

   STRICT FLOW: Builder Change → Staging → Admin Tests → Publish → Public

   - ALL Builder writes go to staging-manifest.json (R2)
   - Public site ONLY reads content-manifest.json (R2)
   - Admin previews staging, reviews diffs, publishes or discards
   - Full changes history, publish history, and version snapshots
   ============================================================ */

const PublishManager = (() => {
    const STAGING_KEY = 'tamilAIStream_publishManager';
    const HISTORY_KEY = 'tamilAIStream_changesHistory';
    const PUB_HISTORY_KEY = 'tamilAIStream_publishHistory';

    let _state = {
        isStagingMode: false,
        hasStaging: false,
        hasPublished: false,
        stagingSavedAt: null,
        publishedAt: null,
        pendingChanges: [],
    };

    // ── Persistence (localStorage) ──
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

    // ── API helpers ──
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

    // ═══════════════════════════════════════════════════════
    //  CHANGES HISTORY — tracks every sync/publish/revert
    // ═══════════════════════════════════════════════════════

    function _getChangesHistory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        } catch (e) { return []; }
    }

    function _saveChangesHistory(history) {
        try {
            // Keep last 500 entries max
            const trimmed = history.slice(0, 500);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
        } catch (e) { /* ignore */ }
    }

    /**
     * Track a sync event (Builder save → staging)
     * @param {Object} payload - The content payload that was saved
     */
    function trackSync(payload) {
        const history = _getChangesHistory();
        const now = new Date().toISOString();
        const data = payload?.data || {};

        // Detect which sections changed by comparing with previous entry
        const prev = history.length > 0 ? history[0] : null;
        const sections = [];

        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('_')) continue;
            const prevData = prev?.sectionsSnapshot?.[key];
            const currStr = JSON.stringify(value);
            const prevStr = JSON.stringify(prevData);

            if (currStr !== prevStr) {
                let action = 'modified';
                let itemCount = Array.isArray(value) ? value.length : null;

                if (!prevData) {
                    action = 'added';
                } else if (!value || (Array.isArray(value) && value.length === 0 && Array.isArray(prevData) && prevData.length > 0)) {
                    action = 'cleared';
                } else if (Array.isArray(value) && Array.isArray(prevData)) {
                    if (value.length > prevData.length) action = 'items_added';
                    else if (value.length < prevData.length) action = 'items_removed';
                }

                sections.push({
                    name: key,
                    action,
                    itemCount,
                    prevItemCount: Array.isArray(prevData) ? prevData.length : null,
                });
            }
        }

        if (sections.length === 0) return; // No real change

        const entry = {
            id: 'ch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            timestamp: now,
            admin: _getAdminName(),
            type: 'sync',
            status: 'staging',
            sections: sections.map(s => s.name),
            details: sections.map(s =>
                s.name + ': ' + s.action +
                (s.itemCount != null ? ' (' + s.itemCount + ' items)' : '')
            ).join('; '),
            sectionsSnapshot: data,
            changeCount: sections.length,
        };

        history.unshift(entry);
        _saveChangesHistory(history);
        _emit('change-tracked', entry);
    }

    /**
     * Track a publish event
     */
    function trackPublish(summary) {
        const history = _getChangesHistory();
        const now = new Date().toISOString();

        const entry = {
            id: 'pub_' + Date.now(),
            timestamp: now,
            admin: _getAdminName(),
            type: 'publish',
            status: 'published',
            sections: summary?.sections || [],
            details: summary?.details || 'Published to production',
            changeCount: summary?.sections?.length || 0,
        };

        history.unshift(entry);
        _saveChangesHistory(history);

        // Also save to publish history
        _savePublishHistory(entry);

        _emit('change-tracked', entry);
        return entry;
    }

    /**
     * Track a revert/discard event
     */
    function trackRevert(reason) {
        const history = _getChangesHistory();
        const now = new Date().toISOString();

        const entry = {
            id: 'rev_' + Date.now(),
            timestamp: now,
            admin: _getAdminName(),
            type: 'revert',
            status: 'reverted',
            sections: [],
            details: reason || 'Changes discarded',
            changeCount: 0,
        };

        history.unshift(entry);
        _saveChangesHistory(history);
        _emit('change-tracked', entry);
        return entry;
    }

    /** Get all changes history */
    function getChangesHistory() {
        return _getChangesHistory();
    }

    /** Clear changes history */
    function clearChangesHistory() {
        _saveChangesHistory([]);
        _emit('history-cleared', null);
    }

    // ═══════════════════════════════════════════════════════
    //  PUBLISH HISTORY — tracks all publish events
    // ═══════════════════════════════════════════════════════

    function _getPublishHistory() {
        try {
            return JSON.parse(localStorage.getItem(PUB_HISTORY_KEY) || '[]');
        } catch (e) { return []; }
    }

    function _savePublishHistory(entry) {
        const history = _getPublishHistory();
        history.unshift(entry);
        // Keep last 100 publish entries
        localStorage.setItem(PUB_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
    }

    /** Get all publish history */
    function getPublishHistory() {
        return _getPublishHistory();
    }

    // ═══════════════════════════════════════════════════════
    //  VERSION SNAPSHOTS — save/restore full state
    // ═══════════════════════════════════════════════════════

    /**
     * Save a version snapshot to the server
     */
    async function saveVersionSnapshot(label) {
        try {
            const payload = typeof ContentSync !== 'undefined' && typeof ContentSync.buildContentPayload === 'function'
                ? ContentSync.buildContentPayload()
                : _buildPayloadFromStorage();

            const result = await _api('POST', '/api/versions', {
                label: label || 'Snapshot',
                data: payload.data,
                savedBy: _getAdminName(),
            });

            _emit('version-saved', result);
            return result;
        } catch (e) {
            console.error('PublishManager: save version snapshot failed', e);
            throw e;
        }
    }

    /**
     * Get all saved version snapshots
     */
    async function getVersions() {
        try {
            return await _api('GET', '/api/versions');
        } catch (e) {
            console.error('PublishManager: get versions failed', e);
            return { versions: [] };
        }
    }

    /**
     * Revert to a specific version snapshot
     */
    async function revertToVersion(versionId) {
        try {
            const result = await _api('POST', '/api/versions/' + encodeURIComponent(versionId) + '/revert');
            if (result.success && result.data) {
                // Apply the reverted data to local DataStore
                _applyDataToDataStore(result.data);

                // Save to staging so Admin can review before publishing
                await saveToStaging();

                trackRevert('Reverted to version: ' + versionId);
            }
            _emit('version-reverted', result);
            return result;
        } catch (e) {
            console.error('PublishManager: revert to version failed', e);
            throw e;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  CORE PUBLISH WORKFLOW
    // ═══════════════════════════════════════════════════════

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
            let payload;
            if (typeof ContentSync !== 'undefined' && typeof ContentSync.buildContentPayload === 'function') {
                payload = ContentSync.buildContentPayload();
            } else {
                payload = _buildPayloadFromStorage();
            }

            payload._stagingMeta = {
                savedAt: new Date().toISOString(),
                savedBy: _getAdminName(),
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
            // Save a version snapshot before publishing
            try {
                await saveVersionSnapshot('Pre-publish snapshot');
            } catch (e) { /* non-critical */ }

            const result = await _api('POST', '/api/publish');
            _state.hasStaging = false;
            _state.stagingSavedAt = null;
            _state.publishedAt = result.publishedAt;
            _state.hasPublished = true;
            _saveLocalState();

            // Track publish event
            const diff = await getDiff();
            trackPublish({
                sections: (diff.changes || []).map(c => c.section),
                details: (diff.changeCount || 0) + ' section(s) published',
            });

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
            _saveLocalState();

            trackRevert('Staging changes discarded');

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

    /** Enter staging mode — UI indicator only; writes always go to staging */
    function enterStagingMode() {
        _state.isStagingMode = true;
        _saveLocalState();
        _emit('mode-changed', _state);
    }

    /** Exit staging mode — UI indicator only; writes always go to staging */
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

    // ── Internal helpers ──

    function _getAdminName() {
        try {
            const user = typeof Auth !== 'undefined' && Auth.getUser ? Auth.getUser() : null;
            return user?.displayName || user?.email || 'Admin';
        } catch (e) { return 'Admin'; }
    }

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
        try {
            const raw = localStorage.getItem('websiteLayout');
            if (raw) data.layout = JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return { version: 1, updatedAt: new Date().toISOString(), data };
    }

    // ── Event system ──
    const _listeners = {};
    function on(event, fn) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(fn);
        return () => { _listeners[event] = _listeners[event].filter(f => f !== fn); };
    }
    function _emit(event, data) {
        (_listeners[event] || []).forEach(fn => { try { fn(data); } catch (e) { /* ignore */ } });
    }

    // ── Init ──
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
        // Changes history
        trackSync,
        trackPublish,
        trackRevert,
        getChangesHistory,
        clearChangesHistory,
        // Publish history
        getPublishHistory,
        // Version snapshots
        saveVersionSnapshot,
        getVersions,
        revertToVersion,
        // Events
        on,
    };
})();
