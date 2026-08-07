'use strict';

/* ============================================
   SearchEngine - Advanced Search System
   Instant, AI Suggestions, Multi-criteria
   ============================================ */

const SearchEngine = (() => {
    let searchIndex = [];
    let lastQuery = '';
    let searchHistory = [];

    function buildIndex() {
        const songs = DataStore.getSongs ? DataStore.getSongs() : [];
        const stations = DataStore.getStations ? DataStore.getStations() : [];
        const artists = DataStore.getArtistHits ? DataStore.getArtistHits() : [];
        const categories = DataStore.getCategories ? DataStore.getCategories() : [];

        searchIndex = [];

        songs.filter(s => s.status === 'published').forEach(s => {
            searchIndex.push({
                type: 'song',
                id: s.id,
                title: s.title,
                subtitle: s.artist || 'Unknown Artist',
                artist: s.artist || '',
                album: s.movie || s.album || '',
                genre: s.genre || '',
                language: s.language || '',
                year: s.year || '',
                keywords: `${s.title} ${s.artist || ''} ${s.movie || ''} ${s.genre || ''} ${s.language || ''} ${s.album || ''}`.toLowerCase(),
                data: s
            });
        });

        stations.forEach(s => {
            searchIndex.push({
                type: 'station',
                id: s.id,
                title: s.name,
                subtitle: `${s.freq || ''} - ${s.genre || ''}`,
                genre: s.genre || '',
                city: s.city || '',
                keywords: `${s.name} ${s.freq || ''} ${s.genre || ''} ${s.city || ''}`.toLowerCase(),
                data: s
            });
        });

        const artistMap = {};
        songs.filter(s => s.status === 'published' && s.artist).forEach(s => {
            if (!artistMap[s.artist]) {
                artistMap[s.artist] = { name: s.artist, count: 0, genre: s.genre || '' };
            }
            artistMap[s.artist].count++;
        });
        Object.values(artistMap).forEach(a => {
            searchIndex.push({
                type: 'artist',
                id: a.name,
                title: a.name,
                subtitle: `${a.count} songs`,
                genre: a.genre,
                keywords: `${a.name} ${a.genre}`.toLowerCase(),
                data: a
            });
        });

        categories.forEach(c => {
            searchIndex.push({
                type: 'category',
                id: c.id || c.name,
                title: c.name,
                subtitle: `${c.count || 0} stations`,
                keywords: c.name.toLowerCase(),
                data: c
            });
        });
    }

    function tokenize(text) {
        return text.toLowerCase()
            .replace(/[^\w\s\u0B80-\u0BFF]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    function matchScore(query, keywords) {
        const qTokens = tokenize(query);
        const kTokens = tokenize(keywords);
        let score = 0;
        for (const qt of qTokens) {
            for (const kt of kTokens) {
                if (kt === qt) score += 3;
                else if (kt.startsWith(qt) || qt.startsWith(kt)) score += 2;
                else if (kt.includes(qt) || qt.includes(kt)) score += 1;
            }
        }
        return score / Math.max(qTokens.length, 1);
    }

    function search(query, filters = {}) {
        if (!query || !query.trim()) return [];
        lastQuery = query.trim();
        addToHistory(lastQuery);

        const q = query.toLowerCase().trim();
        let results = [];

        for (const item of searchIndex) {
            let score = matchScore(q, item.keywords);
            if (score < 0.3) continue;

            if (filters.type && item.type !== filters.type) continue;
            if (filters.genre && item.genre && !item.genre.toLowerCase().includes(filters.genre.toLowerCase())) continue;
            if (filters.language && item.language && !item.language.toLowerCase().includes(filters.language.toLowerCase())) continue;

            results.push({ ...item, _score: score });
        }

        results.sort((a, b) => b._score - a._score);

        if (filters.limit) results = results.slice(0, filters.limit);

        return results;
    }

    function getSuggestions(query) {
        if (!query || query.length < 2) return [];
        const q = query.toLowerCase();

        const suggestions = [];
        const seen = new Set();

        for (const item of searchIndex) {
            if (item.title && item.title.toLowerCase().includes(q) && !seen.has(item.title)) {
                seen.add(item.title);
                suggestions.push({
                    text: item.title,
                    type: item.type,
                    subtitle: item.subtitle
                });
            }
            if (suggestions.length >= 8) break;
        }

        return suggestions;
    }

    function getAISuggestions(context) {
        const suggestions = [];
        const songs = DataStore.getSongs ? DataStore.getSongs() : [];
        const published = songs.filter(s => s.status === 'published');

        if (context === 'morning') {
            const morning = published.filter(s => {
                const g = (s.genre || '').toLowerCase();
                return g.includes('devotional') || g.includes('classical') || g.includes('soft');
            });
            if (morning.length) suggestions.push({ label: 'Morning Vibes', songs: morning.slice(0, 10) });
        }

        if (context === 'workout' || context === 'energy') {
            const energy = published.filter(s => {
                const g = (s.genre || '').toLowerCase();
                return g.includes('rock') || g.includes('hip-hop') || g.includes('dance') || g.includes('folk');
            });
            if (energy.length) suggestions.push({ label: 'Workout Energy', songs: energy.slice(0, 10) });
        }

        if (context === 'romantic' || context === 'love') {
            const romantic = published.filter(s => {
                const g = (s.genre || '').toLowerCase();
                return g.includes('romantic') || g.includes('love') || g.includes('melody');
            });
            if (romantic.length) suggestions.push({ label: 'Romantic Vibes', songs: romantic.slice(0, 10) });
        }

        const artistCounts = {};
        published.forEach(s => {
            if (s.artist) {
                artistCounts[s.artist] = (artistCounts[s.artist] || 0) + 1;
            }
        });
        const topArtists = Object.entries(artistCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        if (topArtists.length) {
            suggestions.push({
                label: 'Popular Artists',
                artists: topArtists.map(([name, count]) => ({ name, count }))
            });
        }

        return suggestions;
    }

    function addToHistory(query) {
        searchHistory = searchHistory.filter(h => h !== query);
        searchHistory.unshift(query);
        if (searchHistory.length > 50) searchHistory = searchHistory.slice(0, 50);
        try { localStorage.setItem('search_history', JSON.stringify(searchHistory)); } catch {}
    }

    function getSearchHistory() {
        return [...searchHistory];
    }

    function clearSearchHistory() {
        searchHistory = [];
        try { localStorage.setItem('search_history', '[]'); } catch {}
    }

    function init() {
        try {
            searchHistory = JSON.parse(localStorage.getItem('search_history') || '[]');
        } catch { searchHistory = []; }
        buildIndex();
        if (DataStore.on) {
            DataStore.on('tamilAIFM_songs', () => buildIndex());
            DataStore.on('tamilAIFM_stations', () => buildIndex());
        }
    }

    return {
        init, search, getSuggestions, getAISuggestions,
        getSearchHistory, clearSearchHistory, buildIndex
    };
})();
