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
                moviesCollections: safeGet(global.DataStore.getMoviesCollections?.bind(global.DataStore), []),
                yearlyCollections: safeGet(global.DataStore.getYearlyCollections?.bind(global.DataStore), []),
                latestCollections: safeGet(global.DataStore.getLatestCollections?.bind(global.DataStore), []),
                musicCollections: safeGet(global.DataStore.getMusicCollections?.bind(global.DataStore), []),
                advertisements: safeGet(global.DataStore.getAdvertisements?.bind(global.DataStore), []),
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
                settings: safeGet(global.DataStore.getYTSettings?.bind(global.DataStore), {}),
                news: safeGet(global.DataStore.getNews?.bind(global.DataStore), []),
                deletedIds: safeGet(global.DataStore.getDeletedIds?.bind(global.DataStore), {}),
                trash: safeGet(global.DataStore.getTrash?.bind(global.DataStore), [])
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
            moviesCollections: readLocalStorage('tamilAIStream_moviesCollections', []),
            yearlyCollections: readLocalStorage('tamilAIStream_yearlyCollections', []),
            latestCollections: readLocalStorage('tamilAIStream_latestCollections', []),
            musicCollections: readLocalStorage('tamilAIStream_musicCollections', []),
            advertisements: readLocalStorage('tamilAIStream_advertisements', []),
            moods: readLocalStorage('tamilAIStream_moods', []),
            aiRadio: readLocalStorage('tamilAIStream_aiRadio', []),
            notifications: readLocalStorage('tamilAIStream_notifications', []),
            splash: readLocalStorage('tamilAIStream_splash', {}),
            playerPrefs: readLocalStorage('tamilAIStream_playerPrefs', {}),
            navigation: readLocalStorage('tamilAIStream_navigation', {}),
            sectionsOrder: readLocalStorage('tamilAIStream_sectionsOrder', []),
            miniPlayerSettings: readLocalStorage('tamilAIStream_miniPlayerSettings', {}),
            news: readLocalStorage('tamilAIStream_news', []),
            deletedIds: readLocalStorage('tamilAIStream_deletedIds', {}),
            trash: readLocalStorage('tamilAIStream_trash', []),
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

        const sharedKeys = ['songs', 'stations', 'categories', 'featured', 'trending', 'artistHits', 'quotes', 'siteSettings', 'layout', 'images', 'moods', 'aiRadio', 'notifications', 'splash', 'playerPrefs', 'navigation', 'sectionsOrder', 'miniPlayerSettings', 'moviesCollections', 'yearlyCollections', 'latestCollections', 'musicCollections', 'advertisements', 'news', 'deletedIds', 'trash'];
        const userKeys = ['likedSongs', 'playlists', 'history', 'queue', 'settings'];

        keys.forEach((key) => {
            const remoteValue = remoteData[key];
            const localValue = localData[key];

            if (sharedKeys.includes(key)) {
                // CRITICAL FIX: deletedIds and trash must be deep-merged so that
                // deletions from multiple devices are all preserved.
                if (key === 'deletedIds') {
                    const merged = {};
                    const allTypes = new Set([...Object.keys(localValue || {}), ...Object.keys(remoteValue || {})]);
                    allTypes.forEach(type => {
                        const localIds = Array.isArray(localValue?.[type]) ? localValue[type] : [];
                        const remoteIds = Array.isArray(remoteValue?.[type]) ? remoteValue[type] : [];
                        merged[type] = [...new Set([...localIds, ...remoteIds])];
                    });
                    mergedData[key] = merged;
                } else if (key === 'trash') {
                    // Union-merge trash by _originalId + _trashType
                    const trashMap = new Map();
                    const addTrash = (arr) => {
                        if (!Array.isArray(arr)) return;
                        arr.forEach(item => {
                            if (item && item._originalId && item._trashType) {
                                const tKey = item._trashType + ':' + item._originalId;
                                if (!trashMap.has(tKey)) trashMap.set(tKey, item);
                            }
                        });
                    };
                    addTrash(remoteValue);
                    addTrash(localValue);
                    mergedData[key] = Array.from(trashMap.values());
                } else if (Array.isArray(remoteValue)) {
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

    // After merging, strip out items whose IDs are in the local deletedIds list.
    // This ensures that items deleted in the Builder stay deleted even when the
    // remote manifest still contains them.
    function applyDeletedIdsFilter(payload) {
        if (typeof global.DataStore === 'undefined' || !global.DataStore) return payload;
        try {
            const deletedIds = global.DataStore.getDeletedIds ? global.DataStore.getDeletedIds() : {};
            if (!deletedIds || typeof deletedIds !== 'object') return payload;

            const data = payload?.data || {};
            const typeMap = {
                songs: 'songs',
                stations: 'stations',
                categories: 'categories',
                featured: 'featured',
                trending: 'trending',
                artistHits: 'artistHits',
                quotes: 'quotes',
                moods: 'moods',
                aiRadio: 'aiRadio',
                notifications: 'notifications',
                images: 'images',
                moviesCollections: 'moviesCollections',
                yearlyCollections: 'yearlyCollections',
                latestCollections: 'latestCollections',
                musicCollections: 'musicCollections',
                advertisements: 'advertisements',
                news: 'news'
            };

            let changed = false;
            for (const [dataKey, typeKey] of Object.entries(typeMap)) {
                const ids = deletedIds[typeKey];
                if (Array.isArray(ids) && ids.length > 0 && Array.isArray(data[dataKey])) {
                    const before = data[dataKey].length;
                    data[dataKey] = data[dataKey].filter(item => item && !ids.includes(item.id));
                    if (data[dataKey].length !== before) changed = true;
                }
            }
            if (changed) {
                payload.data = data;
            }
        } catch (e) {
            // ignore errors in deleted-IDs filtering
        }
        return payload;
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
                setMoviesCollections: data.moviesCollections || [],
                setYearlyCollections: data.yearlyCollections || [],
                setLatestCollections: data.latestCollections || [],
                setMusicCollections: data.musicCollections || [],
                setAdvertisements: data.advertisements || [],
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
                setYTSettings: data.settings || {},
                setNews: data.news || [],
                setDeletedIds: data.deletedIds || {},
                setTrash: data.trash || []
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
        writeLocalStorage('tamilAIStream_moviesCollections', data.moviesCollections || []);
        writeLocalStorage('tamilAIStream_yearlyCollections', data.yearlyCollections || []);
        writeLocalStorage('tamilAIStream_latestCollections', data.latestCollections || []);
        writeLocalStorage('tamilAIStream_musicCollections', data.musicCollections || []);
        writeLocalStorage('tamilAIStream_advertisements', data.advertisements || []);
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
        writeLocalStorage('tamilAIStream_news', data.news || []);
        writeLocalStorage('tamilAIStream_deletedIds', data.deletedIds || {});
        writeLocalStorage('tamilAIStream_trash', data.trash || []);
        writeLocalStorage('tamilAIStream_lastSyncedAt', payload?.updatedAt || new Date().toISOString());
    }

    async function loadRemoteContent() {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('/api/manifest', {
                cache: 'default',
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error(`Manifest fetch failed with status ${response.status}`);
            }
            return await response.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async function uploadManifest(payload) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 20000);
            let response;
            try {
                response = await fetch('/api/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timer);
            }

            if (!response.ok) {
                throw new Error(`Manifest upload failed with status ${response.status}`);
            }

            const result = await response.json();
            return result.success ? payload.updatedAt : null;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('[ContentSync] Manifest upload timed out');
            } else {
                console.warn('Content manifest upload failed:', error);
            }
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
        // Remove any items the user previously deleted (even if R2 still has them)
        applyDeletedIdsFilter(mergedPayload);
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
            applyDeletedIdsFilter(payload);
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
            applyDeletedIdsFilter(mergedPayload);
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
            if (!document.hidden) pollForChanges();
        }, intervalMs);
    }

    function stopSyncing() {
        if (_syncTimer) {
            clearInterval(_syncTimer);
            _syncTimer = null;
        }
    }

    // ------------------------------------------------------------------
    // R2 media discovery — import existing Cloudflare R2 uploads into the
    // local content store so previously uploaded songs are never lost.
    // Idempotent: matches by R2 key/audio URL, never creates duplicates.
    // ------------------------------------------------------------------
    function hashCode(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h + str.charCodeAt(i)) | 0;
        }
        return Math.abs(h).toString(36);
    }

    function cleanTitleFromKey(key) {
        const base = key.split('/').pop() || key;
        const withoutExt = base.replace(/\.[^.]+$/, '');
        const withoutTs = withoutExt.replace(/^\d{10,}-?/, '');
        return (withoutTs || withoutExt).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
    }

    function keyFromUrl(url) {
        if (!url) return '';
        const m = /\/api\/media\/(.+)$/.exec(String(url));
        if (m) {
            try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
        }
        return '';
    }

    // Build a public URL for an R2 key (keeps folder separators, encodes segments).
    function r2PublicUrl(key) {
        const encoded = String(key).split('/').map((seg) => encodeURIComponent(seg)).join('/');
        return '/api/media/' + encoded;
    }

    // List objects in the R2 bucket under a prefix (paginated via cursors).
    // Accepts an optional onProgress(percent, message) callback for UI updates.
    async function listR2Objects(prefix = '', limit = 200, onProgress = null) {
        const objects = [];
        try {
            let cursor = undefined;
            let page = 0;
            do {
                page++;
                if (onProgress) onProgress(null, 'Scanning R2' + (prefix ? ' [' + prefix + ']' : '') + ' — page ' + page + '…');
                const params = new URLSearchParams();
                if (prefix) params.set('prefix', prefix);
                params.set('limit', String(limit));
                if (cursor) params.set('cursor', cursor);

                // 15-second timeout per page so the UI never hangs
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 15000);
                let response;
                try {
                    response = await fetch('/api/media/list?' + params.toString(), {
                        cache: 'no-store',
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timer);
                }
                if (!response.ok) throw new Error('R2 list failed with status ' + response.status);
                const data = await response.json();
                if (Array.isArray(data.objects)) objects.push(...data.objects);
                cursor = data.truncated && data.cursor ? data.cursor : undefined;
            } while (cursor);
        } catch (e) {
            if (e.name === 'AbortError') {
                console.warn('[ContentSync] R2 list timed out for prefix:', prefix);
            } else {
                console.warn('[ContentSync] R2 list failed:', e);
            }
        }
        return objects;
    }

    const R2_AUDIO_EXT_RE = /\.(mp3|wav|ogg|oga|aac|m4a|flac|opus|webm)$/i;
    const R2_IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i;

    /**
     * Detect songs already uploaded to Cloudflare R2 and merge them into the
     * local song library (DataStore + localStorage). Existing songs matched by
     * their R2 key / audio URL are left untouched — no re-upload, no duplicates.
     * Accepts an optional onProgress(percent, phase, status) callback.
     * Returns { added, total, scanned }.
     */
    async function discoverR2Songs(onProgress = null) {
        const pct = (val, phase, status) => { if (onProgress) onProgress(val, phase, status); };
        try {
            pct(5, 'Preparing', 'Reading existing songs…');
            const existing = safeGet(global.DataStore.getSongs?.bind(global.DataStore), []) || [];
            const existingByKey = new Set();
            existing.forEach((s) => {
                if (!s) return;
                if (s.audioPublicId) existingByKey.add(s.audioPublicId);
                const k = keyFromUrl(s.audioUrl || s.src || s.streamUrl || '');
                if (k) existingByKey.add(k);
                if (s.r2Key) existingByKey.add(s.r2Key);
            });

            // Audio has been stored under several prefixes across the app's history.
            // Reduced from 5 to 3 most common prefixes to cut network requests.
            const prefixes = ['audio/', 'songs/', ''];
            const audioObjects = [];
            const seen = new Set();
            for (let i = 0; i < prefixes.length; i++) {
                const prefix = prefixes[i];
                const pBase = 10 + (i / prefixes.length) * 40;
                pct(pBase, 'Scanning R2', 'Listing files under "' + (prefix || 'root') + '"…');
                const objs = await listR2Objects(prefix, 1000, (p, msg) => {
                    if (msg) pct(null, null, msg);
                });
                for (const o of objs) {
                    if (!o || !o.key) continue;
                    if (R2_AUDIO_EXT_RE.test(o.key) && !seen.has(o.key)) {
                        seen.add(o.key);
                        audioObjects.push(o);
                    }
                }
                pct(pBase + 8, 'Scanning R2', 'Found ' + audioObjects.length + ' audio file(s) so far…');
            }

            if (!audioObjects.length) {
                pct(100, 'Done', 'No new R2 audio files — ' + existing.length + ' song(s) in library');
                return { added: 0, total: existing.length, scanned: 0 };
            }

            // Best-effort album cover matching using the leading upload timestamp.
            pct(55, 'Matching covers', 'Scanning image files for album covers…');
            const imageByTs = new Map();
            for (const prefix of ['albums/', 'images/']) {
                const objs = await listR2Objects(prefix, 1000, (p, msg) => {
                    if (msg) pct(null, null, msg);
                });
                for (const o of objs) {
                    if (!o || !o.key || !R2_IMAGE_EXT_RE.test(o.key)) continue;
                    const m = /^(\d{10,})/.exec(o.key.split('/').pop() || '');
                    if (m && !imageByTs.has(m[1])) imageByTs.set(m[1], o.key);
                }
            }

            pct(65, 'Importing', 'Building song entries from R2 files…');
            const additions = [];
            audioObjects.forEach((obj, idx) => {
                const key = obj.key;
                if (existingByKey.has(key)) return;
                const url = r2PublicUrl(key);
                const tsMatch = /^(\d{10,})/.exec(key.split('/').pop() || '');
                const ts = tsMatch ? tsMatch[1] : '';
                const createdAt = obj.uploaded ||
                    (ts ? new Date(parseInt(ts, 10)).toISOString() : new Date().toISOString());
                const coverKey = ts && imageByTs.has(ts) ? imageByTs.get(ts) : '';

                additions.push({
                    id: 'r2_' + hashCode(key),
                    title: cleanTitleFromKey(key),
                    artist: '',
                    movie: '',
                    album: '',
                    language: 'Tamil',
                    genre: '',
                    mood: '',
                    duration: '0:00',
                    audioUrl: url,
                    src: url,
                    audioPublicId: key,
                    r2Key: key,
                    albumCover: coverKey ? r2PublicUrl(coverKey) : '',
                    thumbnail: coverKey ? r2PublicUrl(coverKey) : '',
                    status: 'published',
                    plays: 0,
                    source: 'r2',
                    createdAt,
                    updatedAt: createdAt,
                    uploadedAt: obj.uploaded || null,
                    size: obj.size || 0,
                    format: key.split('.').pop().toLowerCase(),
                });
                if (onProgress && idx % 5 === 0) {
                    pct(65 + Math.round((idx / audioObjects.length) * 25), 'Importing',
                        'Processing file ' + (idx + 1) + ' of ' + audioObjects.length + '…');
                }
            });

            if (additions.length) {
                pct(92, 'Saving', 'Saving ' + additions.length + ' song(s) to library…');
                const merged = additions.concat(existing);
                if (typeof global.DataStore?.setSongs === 'function') {
                    global.DataStore.setSongs(merged);
                }
                writeLocalStorage('tamilAIStream_songs', merged);
                pct(96, 'Syncing', 'Notifying content listeners…');
                notifyContentChanged();
            }

            const total = existing.length + additions.length;
            pct(100, 'Done', additions.length + ' song(s) imported from R2 — ' + total + ' total');
            return { added: additions.length, total, scanned: audioObjects.length };
        } catch (e) {
            console.warn('[ContentSync] R2 song discovery failed:', e);
            pct(100, 'Error', 'R2 discovery failed: ' + (e.message || e));
            const current = safeGet(global.DataStore.getSongs?.bind(global.DataStore), []);
            return { added: 0, total: Array.isArray(current) ? current.length : 0, scanned: 0 };
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
        listR2Objects,
        discoverR2Songs,
        getRuntimeConfig: () => ({})
    };

    global.ContentSync = ContentSync;

    global.addEventListener?.('DOMContentLoaded', () => {
        // Pull the authoritative R2 manifest once on load.
        global.ContentSync?.bootstrapSharedContent?.().then(() => {
            // Defer R2 discovery to avoid heavy network requests on initial load.
            // Only scan R2 if user has no songs locally (first visit) or on idle.
            const hasLocalSongs = (global.DataStore?.getSongs?.() || []).length > 0;
            if (!hasLocalSongs) {
                global.ContentSync?.discoverR2Songs?.().catch(() => {});
            } else if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => { global.ContentSync?.discoverR2Songs?.().catch(() => {}); }, { timeout: 30000 });
            } else {
                setTimeout(() => { global.ContentSync?.discoverR2Songs?.().catch(() => {}); }, 10000);
            }
            // Sync every 2 minutes (was 30s — excessive for data savings on mobile)
            global.ContentSync?.startSyncing?.(120000);
        }).catch(() => {});
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ContentSync;
    }
})(typeof window !== 'undefined' ? window : globalThis);