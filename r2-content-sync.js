(function (global) {
    'use strict';

    const DEFAULT_MANIFEST_VERSION = 1;

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
        const remoteIsNewer = remoteTime > localTime;

        keys.forEach((key) => {
            const remoteValue = remoteData[key];
            const localValue = localData[key];
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
        });

        return {
            version: localPayload?.version || remotePayload?.version || DEFAULT_MANIFEST_VERSION,
            updatedAt: remoteIsNewer
                ? (remotePayload?.updatedAt || localPayload?.updatedAt || new Date().toISOString())
                : (localPayload?.updatedAt || remotePayload?.updatedAt || new Date().toISOString()),
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

    async function bootstrapSharedContent() {
        const localPayload = buildContentPayload();
        try {
            const remotePayload = await loadRemoteContent();
            const mergedPayload = mergePayloads(localPayload, remotePayload);
            persistLocalContent(mergedPayload);
            const synced = buildContentPayload();
            await uploadManifest(synced);
            return synced;
        } catch (error) {
            persistLocalContent(localPayload);
            try {
                await syncCurrentState();
            } catch (syncError) {
                console.warn('Initial content manifest sync failed:', syncError);
            }
            return localPayload;
        }
    }

    async function syncCurrentState() {
        const payload = buildContentPayload();
        const remoteUrl = await uploadManifest(payload);
        persistLocalContent(payload);
        return { payload, remoteUrl };
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
