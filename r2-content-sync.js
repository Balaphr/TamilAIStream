(function (global) {
    'use strict';

    const DEFAULT_MANIFEST_VERSION = 1;
    const SYNC_LOCK_KEY = 'tamilAIStream_syncLock';
    const SYNC_LOCK_TIMEOUT = 10000; // 10 seconds
    const SYNC_EVENT = 'tamilAIStream-content-synced';

    function readLocalStorage(key, fallback = null) {
        try {
            const value = global.localStorage?.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function writeLocalStorage(key, value) {
        try {
            global.localStorage?.setItem(key, JSON.stringify(value));
        } catch (error) {
            // Ignore storage errors in non-browser contexts.
        }
    }

    // Safely invoke an optional DataStore getter. Never throws.
    function safeGet(getter, fallback) {
        try {
            if (typeof getter === 'function') {
                const value = getter();
                return value === undefined || value === null ? fallback : value;
            }
        } catch (error) {
            // fall through to fallback
        }
        return fallback;
    }

    // Determine whether the current page is a WRITER (Builder/Admin) or a
    // READER (live site). Writers push changes to R2; readers only consume.
    function isWriterPage() {
        try {
            const path = global.location?.pathname || global.location?.href || '';
            return /(builder|admin)(-|\.|\/|$)/i.test(path) && /\.html/i.test(path);
        } catch (e) {
            return false;
        }
    }

    function buildContentPayload() {
        const payload = {
            version: DEFAULT_MANIFEST_VERSION,
            updatedAt: new Date().toISOString(),
            data: {}
        };

        const hasDataStore = typeof global.DataStore !== 'undefined' && global.DataStore;
        if (hasDataStore) {
            payload.data = {
                songs: safeGet(global.DataStore.getSongs?.bind(global.DataStore), []),
                stations: safeGet(global.DataStore.getStations?.bind(global.DataStore), []),
                categories: safeGet(global.DataStore.getCategories?.bind(global.DataStore), []),
                featured: safeGet(global.DataStore.getFeatured?.bind(global.DataStore), []),
                trending: safeGet(global.DataStore.getTrending?.bind(global.DataStore), []),
                artistHits: safeGet(global.DataStore.getArtistHits?.bind(global.DataStore), []),
                quotes: safeGet(global.DataStore.getQuotes?.bind(global.DataStore), []),
                siteSettings: safeGet(global.DataStore.getSiteSettings?.bind(global.DataStore), {}),
                layout: safeGet(global.DataStore.getLayout?.bind(global.DataStore), []),
                images: safeGet(global.DataStore.getImages?.bind(global.DataStore), []),
                moods: safeGet(global.DataStore.getMoods?.bind(global.DataStore), []),
                aiRadio: safeGet(global.DataStore.getAIRadio?.bind(global.DataStore), []),
                notifications: safeGet(global.DataStore.getNotifications?.bind(global.DataStore), []),
                splash: safeGet(global.DataStore.getSplash?.bind(global.DataStore), {}),
                playerPrefs: safeGet(global.DataStore.getPlayerPrefs?.bind(global.DataStore), {}),
                navigation: safeGet(global.DataStore.getNavigation?.bind(global.DataStore), {}),
                sectionsOrder: safeGet(global.DataStore.getSectionsOrder?.bind(global.DataStore), []),
                miniPlayerSettings: safeGet(global.DataStore.getMiniPlayerSettings?.bind(global.DataStore), {}),
                playlists: safeGet(global.DataStore.getPlaylists?.bind(global.DataStore), []),
                likedSongs: safeGet(global.DataStore.getLikedSongs?.bind(global.DataStore), []),
                history: safeGet(global.DataStore.getHistory?.bind(global.DataStore), []),
                queue: safeGet(global.DataStore.getQueue?.bind(global.DataStore), []),
                settings: safeGet(global.DataStore.getYTSettings?.bind(global.DataStore), {})
            };
            return payload;
        }

        payload.data = {
            songs: readLocalStorage('tamilAIStream_songs', []),
            stations: readLocalStorage('tamilAIStream_stations', []),
            categories: readLocalStorage('tamilAIStream_categories', []),
            featured: readLocalStorage('tamilAIStream_featured', []),
            trending: readLocalStorage('tamilAIStream_trending', []),
            artistHits: readLocalStorage('tamilAIStream_artistHits', []),
            quotes: readLocalStorage('tamilAIStream_quotes', []),
            siteSettings: readLocalStorage('tamilAIStream_siteSettings', {}),
            layout: readLocalStorage('websiteLayout', []),
            images: readLocalStorage('tamilAIStream_images', []),
            moods: readLocalStorage('tamilAIStream_moods', []),
            aiRadio: readLocalStorage('tamilAIStream_aiRadio', []),
            notifications: readLocalStorage('tamilAIStream_notifications', []),
            splash: readLocalStorage('tamilAIStream_splash', {}),
            playerPrefs: readLocalStorage('tamilAIStream_playerPrefs', {}),
            navigation: readLocalStorage('tamilAIStream_navigation', {}),
            sectionsOrder: readLocalStorage('tamilAIStream_sectionsOrder', []),
            miniPlayerSettings: readLocalStorage('tamilAIStream_miniPlayerSettings', {}),
            playlists: readLocalStorage('ytm_playlists', []),
            likedSongs: readLocalStorage('ytm_likedSongs', []),
            history: readLocalStorage('ytm_history', []),
            queue: readLocalStorage('ytm_queue', []),
            settings: readLocalStorage('ytm_settings', {})
        };

        return payload;
    }

    // Merge remote (R2) content into local state.
    // - Remote (R2) is ALWAYS the single source of truth for shared content.
    // - On WRITER pages we also keep local-only items (songs/changes that were
    //   authored on this device but not yet pushed) so nothing is lost.
    // - User-specific content (liked/playlists/history/queue/settings) is
    //   local-first so personal preferences are preserved.
    function mergePayloads(localPayload, remotePayload, isWriter = isWriterPage()) {
        const mergedData = {};
        const localData = localPayload?.data || {};
        const remoteData = remotePayload?.data || {};
        const keys = Object.keys({ ...localData, ...remoteData });

        const localTime = localPayload?.updatedAt ? new Date(localPayload.updatedAt).getTime() : 0;
        const remoteTime = remotePayload?.updatedAt ? new Date(remotePayload.updatedAt).getTime() : 0;

        const sharedKeys = ['songs', 'stations', 'categories', 'featured', 'trending', 'artistHits', 'quotes', 'siteSettings', 'layout', 'images', 'moods', 'aiRadio', 'notifications', 'splash', 'playerPrefs', 'navigation', 'sectionsOrder', 'miniPlayerSettings'];
        const userKeys = ['likedSongs', 'playlists', 'history', 'queue', 'settings'];

        keys.forEach((key) => {
            const remoteValue = remoteData[key];
            const localValue = localData[key];

            if (sharedKeys.includes(key)) {
                if (Array.isArray(remoteValue)) {
                    // Remote arrays carry authoritative items by ID.
                    const mergedMap = new Map();
                    remoteValue.forEach(item => {
                        if (item && item.id !== undefined && item.id !== null) mergedMap.set(item.id, item);
                    });
                    // Writers may hold local-only items (new additions not yet pushed).
                    if (isWriter && Array.isArray(localValue)) {
                        localValue.forEach(item => {
                            if (item && item.id !== undefined && item.id !== null && !mergedMap.has(item.id)) {
                                mergedMap.set(item.id, item);
                            }
                        });
                    }
                    mergedData[key] = Array.from(mergedMap.values());
                } else if (Array.isArray(localValue) && localValue.length > 0 && isWriter) {
                    mergedData[key] = localValue;
                } else if (remoteValue !== undefined && remoteValue !== null) {
                    mergedData[key] = remoteValue;
                } else if (localValue !== undefined && localValue !== null) {
                    mergedData[key] = localValue;
                } else {
                    mergedData[key] = Array.isArray(remoteValue) ? [] : {};
                }
            } else if (userKeys.includes(key)) {
                // User-specific content: newer timestamp wins
                const remoteIsNewer = remoteTime > localTime;
                if (Array.isArray(remoteValue) && Array.isArray(localValue)) {
                    mergedData[key] = remoteIsNewer ? remoteValue : localValue;
                } else if (Array.isArray(localValue)) {
                    mergedData[key] = remoteIsNewer && remoteValue !== undefined ? remoteValue : localValue;
                } else if (Array.isArray(remoteValue)) {
                    mergedData[key] = remoteIsNewer ? remoteValue : (localValue !== undefined ? localValue : remoteValue);
                } else if (localValue && typeof localValue === 'object' && !Array.isArray(localValue)) {
                    if (remoteIsNewer) {
                        mergedData[key] = { ...(localValue || {}), ...(remoteValue || {}) };
                    } else {
                        mergedData[key] = { ...(remoteValue || {}), ...(localValue || {}) };
                    }
                } else {
                    mergedData[key] = remoteIsNewer
                        ? (remoteValue !== undefined ? remoteValue : localValue)
                        : (localValue !== undefined ? localValue : remoteValue);
                }
            } else {
                // Default: newer wins
                const remoteIsNewer = remoteTime > localTime;
                mergedData[key] = remoteIsNewer
                    ? (remoteValue !== undefined ? remoteValue : localValue)
                    : (localValue !== undefined ? localValue : remoteValue);
            }
        });

        return {
            version: remotePayload?.version || localPayload?.version || DEFAULT_MANIFEST_VERSION,
            updatedAt: remotePayload?.updatedAt || new Date().toISOString(),
            data: mergedData
        };
    }

    function persistLocalContent(payload) {
        const data = payload?.data || {};

        if (typeof global.DataStore !== 'undefined' && global.DataStore) {
            const setters = {
                setSongs: data.songs || [],
                setStations: data.stations || [],
                setCategories: data.categories || [],
                setFeatured: data.featured || [],
                setTrending: data.trending || [],
                setArtistHits: data.artistHits || [],
                setQuotes: data.quotes || [],
                setSiteSettings: data.siteSettings || {},
                setLayout: data.layout || [],
                setImages: data.images || [],
                setMoods: data.moods || [],
                setAIRadio: data.aiRadio || [],
                setNotifications: data.notifications || [],
                setSplash: data.splash || {},
                setPlayerPrefs: data.playerPrefs || {},
                setNavigation: data.navigation || {},
                setSectionsOrder: data.sectionsOrder || [],
                setMiniPlayerSettings: data.miniPlayerSettings || {},
                setPlaylists: data.playlists || [],
                setLikedSongs: data.likedSongs || [],
                setHistory: data.history || [],
                setQueue: data.queue || [],
                setYTSettings: data.settings || {}
            };
            Object.entries(setters).forEach(([method, value]) => {
                if (typeof global.DataStore[method] === 'function') {
                    try { global.DataStore[method](value); } catch (e) { /* ignore */ }
                }
            });
        }

        writeLocalStorage('tamilAIStream_songs', data.songs || []);
        writeLocalStorage('tamilAIStream_stations', data.stations || []);
        writeLocalStorage('tamilAIStream_categories', data.categories || []);
        writeLocalStorage('tamilAIStream_featured', data.featured || []);
        writeLocalStorage('tamilAIStream_trending', data.trending || []);
        writeLocalStorage('tamilAIStream_artistHits', data.artistHits || []);
        writeLocalStorage('tamilAIStream_quotes', data.quotes || []);
        writeLocalStorage('tamilAIStream_siteSettings', data.siteSettings || {});
        writeLocalStorage('websiteLayout', data.layout || []);
        writeLocalStorage('tamilAIStream_images', data.images || []);
        writeLocalStorage('tamilAIStream_moods', data.moods || []);
        writeLocalStorage('tamilAIStream_aiRadio', data.aiRadio || []);
        writeLocalStorage('tamilAIStream_notifications', data.notifications || []);
        writeLocalStorage('tamilAIStream_splash', data.splash || {});
        writeLocalStorage('tamilAIStream_playerPrefs', data.playerPrefs || {});
        writeLocalStorage('tamilAIStream_navigation', data.navigation || {});
        writeLocalStorage('tamilAIStream_sectionsOrder', data.sectionsOrder || []);
        writeLocalStorage('tamilAIStream_miniPlayerSettings', data.miniPlayerSettings || {});
        writeLocalStorage('ytm_playlists', data.playlists || []);
        writeLocalStorage('ytm_likedSongs', data.likedSongs || []);
        writeLocalStorage('ytm_history', data.history || []);
        writeLocalStorage('ytm_queue', data.queue || []);
        writeLocalStorage('ytm_settings', data.settings || {});
        writeLocalStorage('tamilAIStream_lastSyncedAt', payload?.updatedAt || new Date().toISOString());
    }

    async function loadRemoteContent() {
        const response = await fetch('/api/manifest', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Manifest fetch failed with status ${response.status}`);
        }
        return await response.json();
    }

    async function uploadManifest(payload) {
        try {
            const response = await fetch('/api/manifest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Manifest upload failed with status ${response.status}`);
            }

            const result = await response.json();
            return result.success ? payload.updatedAt : null;
        } catch (error) {
            console.warn('Content manifest upload failed:', error);
            return null;
        }
    }

    // Simple lock to prevent concurrent syncs
    function acquireSyncLock() {
        const now = Date.now();
        const lockTime = readLocalStorage(SYNC_LOCK_KEY, 0);
        if (now - lockTime < SYNC_LOCK_TIMEOUT) {
            return false; // Another sync is in progress
        }
        writeLocalStorage(SYNC_LOCK_KEY, now);
        return true;
    }

    function releaseSyncLock() {
        writeLocalStorage(SYNC_LOCK_KEY, 0);
    }

    // Notify every open page (same browser tab + other windows of this origin)
    // that shared content has changed.
    // Simple hash of the last-notified content to avoid re-firing events when
    // nothing actually changed. Only a fast string comparison is needed.
    let _lastNotifiedHash = '';
    function _hashPayload(payload) {
        try { return JSON.stringify(payload?.data || {}); } catch (e) { return ''; }
    }

    function notifyContentChanged() {
        const currentPayload = buildContentPayload();
        const hash = _hashPayload(currentPayload);
        if (hash === _lastNotifiedHash) return; // no real change
        _lastNotifiedHash = hash;

        try {
            global.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { timestamp: Date.now() } }));
            global.dispatchEvent(new CustomEvent('storage-sync', { detail: { timestamp: Date.now() } }));
            global.dispatchEvent(new CustomEvent('premium-sections-sync', { detail: { timestamp: Date.now() } }));
        } catch (e) { /* ignore */ }

        try {
            writeLocalStorage('tamilAIStream_lastSyncedAt', new Date().toISOString());
        } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------------------
    // Pull the manifest from R2 and apply it as the shared source of truth.
    // On reader pages remote shared content completely replaces local shared
    // content. On writer (Builder/Admin) pages local-only items are preserved
    // and the merged result is pushed back so all devices stay in sync.
    // ------------------------------------------------------------------
    async function pullAndApply(forcePushBack = false) {
        const localPayload = buildContentPayload();
        let remotePayload = null;
        try {
            remotePayload = await loadRemoteContent();
        } catch (error) {
            console.warn('R2 manifest unavailable, keeping local data:', error);
            return { payload: localPayload, source: 'local', changed: false };
        }

        const hasRemoteData = remotePayload && remotePayload.data &&
            Object.keys(remotePayload.data).length > 0 &&
            (Array.isArray(remotePayload.data.songs) ? remotePayload.data.songs.length > 0 : false);

        if (!hasRemoteData) {
            // Remote has never been seeded. Only writers seed it.
            if (isWriterPage() || forcePushBack) {
                await uploadManifest(localPayload);
                persistLocalContent(localPayload);
                return { payload: localPayload, source: 'seeded', changed: true };
            }
            // Readers start with an empty list until a writer seeds R2.
            const empty = { ...localPayload, data: { ...localPayload.data, songs: [] } };
            persistLocalContent(empty);
            return { payload: empty, source: 'empty', changed: true };
        }

        const isWriter = isWriterPage() || forcePushBack;
        const mergedPayload = mergePayloads(localPayload, remotePayload, isWriter);
        persistLocalContent(mergedPayload);

        // Writers always push their merged state back so any local-only item
        // becomes visible to every device.
        if (isWriter) {
            await uploadManifest(mergedPayload);
        }

        return { payload: mergedPayload, source: 'remote', changed: true, remoteChanged: remotePayload.updatedAt !== localPayload.updatedAt };
    }

    async function bootstrapSharedContent() {
        const result = await pullAndApply(false);
        if (result.changed) {
            notifyContentChanged();
        }
        return result.payload;
    }

    async function syncCurrentState() {
        if (!acquireSyncLock()) {
            return { payload: null, remoteUrl: null, skipped: true };
        }

        try {
            const payload = buildContentPayload();
            const remoteUrl = await uploadManifest(payload);
            persistLocalContent(payload);
            notifyContentChanged();
            return { payload, remoteUrl };
        } finally {
            releaseSyncLock();
        }
    }

    // ------------------------------------------------------------------
    // Real-time cross-device synchronization
    // Polls the R2 manifest and re-applies it when it changes. Used by the
    // live site so an upload from the Builder on ANY device shows up here.
    // ------------------------------------------------------------------
    let _syncTimer = null;
    let _onSyncCallbacks = [];

    function onSync(callback) {
        if (typeof callback === 'function') {
            _onSyncCallbacks.push(callback);
        }
    }

    function _emitCallbacks(result) {
        _onSyncCallbacks.forEach(cb => {
            try { cb(result); } catch (e) { /* ignore */ }
        });
    }

    async function pollForChanges() {
        try {
            const localPayload = buildContentPayload();
            const remotePayload = await loadRemoteContent();
            if (!remotePayload || !remotePayload.updatedAt) return null;
            const localUpdatedAt = readLocalStorage('tamilAIStream_lastSyncedAt', '');
            if (remotePayload.updatedAt && remotePayload.updatedAt === localUpdatedAt) {
                return null; // nothing new
            }
            const isWriter = isWriterPage();
            const mergedPayload = mergePayloads(localPayload, remotePayload, isWriter);
            persistLocalContent(mergedPayload);
            writeLocalStorage('tamilAIStream_lastSyncedAt', remotePayload.updatedAt);
            notifyContentChanged();
            _emitCallbacks({ payload: mergedPayload, source: 'remote', changed: true });
            return mergedPayload;
        } catch (e) {
            console.warn('[ContentSync] poll failed:', e);
            return null;
        }
    }

    function startSyncing(intervalMs = 120000) {
        if (_syncTimer) return;
        _syncTimer = setInterval(() => {
            pollForChanges();
        }, intervalMs);
    }

    function stopSyncing() {
        if (_syncTimer) {
            clearInterval(_syncTimer);
            _syncTimer = null;
        }
    }

    const ContentSync = {
        buildContentPayload,
        mergePayloads,
        persistLocalContent,
        loadRemoteContent,
        uploadManifest,
        bootstrapSharedContent,
        syncCurrentState,
        pullAndApply,
        pollForChanges,
        startSyncing,
        stopSyncing,
        onSync,
        isWriterPage,
        getRuntimeConfig: () => ({})
    };

    global.ContentSync = ContentSync;

    global.addEventListener?.('DOMContentLoaded', () => {
        // Pull the authoritative R2 manifest once on load.
        global.ContentSync?.bootstrapSharedContent?.().then(() => {
            // Keep open sessions in sync in near real-time.
            global.ContentSync?.startSyncing?.(120000);
        }).catch(() => {});
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ContentSync;
    }
})(typeof window !== 'undefined' ? window : globalThis);