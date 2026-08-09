(function (global) {
    'use strict';

    const DEFAULT_MANIFEST_VERSION = 1;
    const SYNC_LOCK_KEY = 'tamilAIStream_syncLock';
    const SYNC_LOCK_TIMEOUT = 10000; // 10 seconds

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

    function buildContentPayload() {
        const payload = {
            version: DEFAULT_MANIFEST_VERSION,
            updatedAt: new Date().toISOString(),
            data: {}
        };

        const hasDataStore = typeof global.DataStore !== 'undefined' && global.DataStore;
        if (hasDataStore && typeof global.DataStore.getSongs === 'function') {
            payload.data = {
                songs: global.DataStore.getSongs() || [],
                stations: global.DataStore.getStations() || [],
                categories: global.DataStore.getCategories() || [],
                featured: global.DataStore.getFeatured() || [],
                trending: global.DataStore.getTrending() || [],
                artistHits: global.DataStore.getArtistHits() || [],
                quotes: global.DataStore.getQuotes() || [],
                siteSettings: global.DataStore.getSiteSettings() || {},
                layout: global.DataStore.getLayout() || [],
                images: global.DataStore.getImages() || [],
                moods: global.DataStore.getMoods() || [],
                aiRadio: global.DataStore.getAIRadio() || [],
                notifications: global.DataStore.getNotifications() || [],
                splash: global.DataStore.getSplash() || {},
                playerPrefs: global.DataStore.getPlayerPrefs() || {},
                navigation: global.DataStore.getNavigation() || {},
                sectionsOrder: global.DataStore.getSectionsOrder() || [],
                playlists: global.DataStore.getPlaylists() || [],
                likedSongs: global.DataStore.getLikedSongs() || [],
                history: global.DataStore.getHistory() || [],
                queue: global.DataStore.getQueue() || [],
                settings: global.DataStore.getYTSettings() || {}
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
            playlists: readLocalStorage('ytm_playlists', []),
            likedSongs: readLocalStorage('ytm_likedSongs', []),
            history: readLocalStorage('ytm_history', []),
            queue: readLocalStorage('ytm_queue', []),
            settings: readLocalStorage('ytm_settings', {})
        };

        return payload;
    }

    function mergePayloads(localPayload, remotePayload) {
        const mergedData = {};
        const localData = localPayload?.data || {};
        const remoteData = remotePayload?.data || {};
        const keys = Object.keys({ ...localData, ...remoteData });

        const localTime = localPayload?.updatedAt ? new Date(localPayload.updatedAt).getTime() : 0;
        const remoteTime = remotePayload?.updatedAt ? new Date(remotePayload.updatedAt).getTime() : 0;

        // FIX: Remote (R2) is ALWAYS the source of truth for shared content.
        // Only user-specific data (likedSongs, playlists, history, queue, settings)
        // uses local-first merge to preserve personal preferences.
        const sharedKeys = ['songs', 'stations', 'categories', 'featured', 'trending', 'artistHits', 'quotes', 'siteSettings', 'layout', 'images'];
        const userKeys = ['likedSongs', 'playlists', 'history', 'queue', 'settings'];

        keys.forEach((key) => {
            const remoteValue = remoteData[key];
            const localValue = localData[key];

            if (sharedKeys.includes(key)) {
                // For array keys that contain items with IDs (songs, stations, etc.),
                // merge by ID so local Builder additions are never lost
                if (Array.isArray(remoteValue) && Array.isArray(localValue)) {
                    const mergedMap = new Map();
                    // Add remote items first
                    remoteValue.forEach(item => {
                        if (item && item.id) mergedMap.set(item.id, item);
                    });
                    // Add local items - local wins for same ID (Builder is source of truth)
                    localValue.forEach(item => {
                        if (item && item.id) mergedMap.set(item.id, item);
                    });
                    mergedData[key] = Array.from(mergedMap.values());
                } else if (Array.isArray(remoteValue) && remoteValue.length > 0) {
                    mergedData[key] = remoteValue;
                } else if (Array.isArray(localValue) && localValue.length > 0) {
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
            version: localPayload?.version || remotePayload?.version || DEFAULT_MANIFEST_VERSION,
            updatedAt: new Date().toISOString(), // Always use current time for merged result
            data: mergedData
        };
    }

    function persistLocalContent(payload) {
        const data = payload?.data || {};

        if (typeof global.DataStore !== 'undefined' && global.DataStore) {
            if (typeof global.DataStore.setSongs === 'function') global.DataStore.setSongs(data.songs || []);
            if (typeof global.DataStore.setStations === 'function') global.DataStore.setStations(data.stations || []);
            if (typeof global.DataStore.setCategories === 'function') global.DataStore.setCategories(data.categories || []);
            if (typeof global.DataStore.setFeatured === 'function') global.DataStore.setFeatured(data.featured || []);
            if (typeof global.DataStore.setTrending === 'function') global.DataStore.setTrending(data.trending || []);
            if (typeof global.DataStore.setArtistHits === 'function') global.DataStore.setArtistHits(data.artistHits || []);
            if (typeof global.DataStore.setQuotes === 'function') global.DataStore.setQuotes(data.quotes || []);
            if (typeof global.DataStore.setSiteSettings === 'function') global.DataStore.setSiteSettings(data.siteSettings || {});
            if (typeof global.DataStore.setLayout === 'function') global.DataStore.setLayout(data.layout || []);
            if (typeof global.DataStore.setImages === 'function') global.DataStore.setImages(data.images || []);
            if (typeof global.DataStore.setMoods === 'function') global.DataStore.setMoods(data.moods || []);
            if (typeof global.DataStore.setAIRadio === 'function') global.DataStore.setAIRadio(data.aiRadio || []);
            if (typeof global.DataStore.setNotifications === 'function') global.DataStore.setNotifications(data.notifications || []);
            if (typeof global.DataStore.setSplash === 'function') global.DataStore.setSplash(data.splash || {});
            if (typeof global.DataStore.setPlayerPrefs === 'function') global.DataStore.setPlayerPrefs(data.playerPrefs || {});
            if (typeof global.DataStore.setNavigation === 'function') global.DataStore.setNavigation(data.navigation || {});
            if (typeof global.DataStore.setSectionsOrder === 'function') global.DataStore.setSectionsOrder(data.sectionsOrder || []);
            if (typeof global.DataStore.setPlaylists === 'function') global.DataStore.setPlaylists(data.playlists || []);
            if (typeof global.DataStore.setLikedSongs === 'function') global.DataStore.setLikedSongs(data.likedSongs || []);
            if (typeof global.DataStore.setHistory === 'function') global.DataStore.setHistory(data.history || []);
            if (typeof global.DataStore.setQueue === 'function') global.DataStore.setQueue(data.queue || []);
            if (typeof global.DataStore.setYTSettings === 'function') global.DataStore.setYTSettings(data.settings || {});
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

    async function bootstrapSharedContent() {
        const localPayload = buildContentPayload();
        try {
            // Step 1: Fetch remote (R2) content - this is the source of truth
            const remotePayload = await loadRemoteContent();

            if (!remotePayload || !remotePayload.data || Object.keys(remotePayload.data).length === 0) {
                // Remote is empty - upload local as initial seed
                persistLocalContent(localPayload);
                await uploadManifest(localPayload);
                return localPayload;
            }

            // Step 2: Merge - remote shared content ALWAYS wins
            const mergedPayload = mergePayloads(localPayload, remotePayload);

            // Step 3: Persist merged result locally
            persistLocalContent(mergedPayload);

            // Step 4: Upload merged result back to R2
            const synced = buildContentPayload();
            await uploadManifest(synced);
            return synced;
        } catch (error) {
            console.warn('R2 sync failed, using local data:', error);
            // On failure, still use local data so the site works
            persistLocalContent(localPayload);
            return localPayload;
        }
    }

    async function syncCurrentState() {
        if (!acquireSyncLock()) {
            return { payload: null, remoteUrl: null, skipped: true };
        }

        try {
            const payload = buildContentPayload();
            const remoteUrl = await uploadManifest(payload);
            persistLocalContent(payload);
            return { payload, remoteUrl };
        } finally {
            releaseSyncLock();
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
        getRuntimeConfig: () => ({})
    };

    global.ContentSync = ContentSync;
    global.addEventListener?.('DOMContentLoaded', () => {
        global.ContentSync?.bootstrapSharedContent?.().catch(() => {});
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ContentSync;
    }
})(typeof window !== 'undefined' ? window : globalThis);
