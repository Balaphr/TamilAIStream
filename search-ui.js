'use strict';

/* ============================================
   SearchUI - Premium Search Interface
   Instant search, AI suggestions, Filters
   ============================================ */

const SearchUI = (() => {
    let isOpen = false;
    let debounceTimer = null;

    function createSearchOverlay() {
        if (document.getElementById('search-overlay')) return;
        const el = document.createElement('div');
        el.id = 'search-overlay';
        el.className = 'search-overlay';
        el.innerHTML = `
            <div class="search-container">
                <div class="search-header">
                    <div class="search-input-wrap">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="searchInput" class="search-input" placeholder="Search songs, artists, stations..." autocomplete="off">
                        <button class="search-clear-btn" id="searchClear"><i class="fas fa-times"></i></button>
                        <button class="search-voice-btn" id="searchVoice"><i class="fas fa-microphone"></i></button>
                    </div>
                    <button class="search-close-btn" id="searchClose"><i class="fas fa-times"></i></button>
                </div>

                <div class="search-filters" id="searchFilters">
                    <button class="search-filter active" data-type="all">All</button>
                    <button class="search-filter" data-type="song">Songs</button>
                    <button class="search-filter" data-type="station">Stations</button>
                    <button class="search-filter" data-type="artist">Artists</button>
                    <button class="search-filter" data-type="album">Albums</button>
                </div>

                <div class="search-body" id="searchBody">
                    <div class="search-history" id="searchHistory">
                        <div class="search-section-title">Recent Searches</div>
                        <div class="search-history-list" id="searchHistoryList"></div>
                    </div>

                    <div class="search-suggestions" id="searchSuggestions" style="display:none;">
                        <div class="search-section-title">Suggestions</div>
                        <div class="search-suggestions-list" id="searchSuggestionsList"></div>
                    </div>

                    <div class="search-results" id="searchResults" style="display:none;">
                        <div class="search-section-title" id="searchResultsTitle">Results</div>
                        <div class="search-results-list" id="searchResultsList"></div>
                    </div>

                    <div class="search-empty" id="searchEmpty" style="display:none;">
                        <i class="fas fa-search"></i>
                        <p>No results found</p>
                    </div>
                </div>

                <div class="search-ai-suggestions" id="searchAISuggestions"></div>
            </div>
        `;
        document.body.appendChild(el);
        bindSearchEvents();
    }

    function bindSearchEvents() {
        document.getElementById('searchClose')?.addEventListener('click', closeSearch);
        document.getElementById('searchClear')?.addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            showDefaultView();
        });

        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => handleSearchInput(e.target.value), 200);
        });

        document.getElementById('searchInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSearch();
            if (e.key === 'Enter') handleSearchInput(e.target.value, true);
        });

        document.getElementById('searchVoice')?.addEventListener('click', () => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;
            const rec = new SpeechRecognition();
            rec.lang = 'en-US';
            rec.onresult = (e) => {
                const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
                document.getElementById('searchInput').value = transcript;
                handleSearchInput(transcript);
            };
            rec.start();
            document.getElementById('searchVoice').classList.add('listening');
            rec.onend = () => document.getElementById('searchVoice').classList.remove('listening');
        });

        document.querySelectorAll('.search-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.search-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                handleSearchInput(document.getElementById('searchInput').value, true);
            });
        });

        document.getElementById('search-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'search-overlay') closeSearch();
        });
    }

    function handleSearchInput(query, immediate = false) {
        if (!query || !query.trim()) { showDefaultView(); return; }

        if (!immediate) {
            const suggestions = SearchEngine.getSuggestions(query);
            renderSuggestions(suggestions);
        }

        const activeFilter = document.querySelector('.search-filter.active');
        const type = activeFilter?.dataset.type || 'all';
        const filters = type !== 'all' ? { type } : {};
        const results = SearchEngine.search(query, { ...filters, limit: 30 });

        renderResults(results, query);
    }

    function renderSuggestions(suggestions) {
        const container = document.getElementById('searchSuggestions');
        const list = document.getElementById('searchSuggestionsList');
        if (!container || !list) return;

        if (!suggestions.length) { container.style.display = 'none'; return; }
        container.style.display = 'block';

        list.innerHTML = suggestions.map(s => `
            <div class="search-suggestion-item" data-text="${s.text}">
                <i class="fas fa-${s.type === 'song' ? 'music' : s.type === 'station' ? 'broadcast-tower' : s.type === 'artist' ? 'user' : 'search'}"></i>
                <span>${s.text}</span>
                <span class="search-suggestion-type">${s.type}</span>
            </div>
        `).join('');

        list.querySelectorAll('.search-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('searchInput').value = item.dataset.text;
                handleSearchInput(item.dataset.text, true);
            });
        });
    }

    function renderResults(results, query) {
        const container = document.getElementById('searchResults');
        const list = document.getElementById('searchResultsList');
        const title = document.getElementById('searchResultsTitle');
        const empty = document.getElementById('searchEmpty');
        const historyEl = document.getElementById('searchHistory');

        if (!results.length) {
            container.style.display = 'none';
            empty.style.display = 'flex';
            historyEl.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        container.style.display = 'block';
        historyEl.style.display = 'none';
        title.textContent = `Results (${results.length})`;

        list.innerHTML = results.map(r => `
            <div class="search-result-item" data-type="${r.type}" data-id="${r.id}">
                <div class="search-result-icon">
                    <i class="fas fa-${r.type === 'song' ? 'music' : r.type === 'station' ? 'broadcast-tower' : r.type === 'artist' ? 'user' : 'th-large'}"></i>
                </div>
                <div class="search-result-info">
                    <div class="search-result-title">${r.title}</div>
                    <div class="search-result-subtitle">${r.subtitle || ''}</div>
                </div>
                <button class="search-result-play" data-action="${r.type}" data-index="${results.indexOf(r)}">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        `).join('');

        list.querySelectorAll('.search-result-play').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                const item = results[idx];
                if (item.type === 'song') AIMusicAssistant.executeAction('play_song', item.data);
                else if (item.type === 'station') AIMusicAssistant.executeAction('play_station', item.data);
                else if (item.type === 'artist') AIMusicAssistant.executeAction('play_artist', item);
            });
        });

        list.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = Array.from(list.children).indexOf(item);
                const result = results[idx];
                if (result.type === 'song') AIMusicAssistant.executeAction('play_song', result.data);
                else if (result.type === 'station') AIMusicAssistant.executeAction('play_station', result.data);
            });
        });
    }

    function showDefaultView() {
        document.getElementById('searchSuggestions').style.display = 'none';
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('searchEmpty').style.display = 'none';
        document.getElementById('searchHistory').style.display = 'block';
        renderHistory();
    }

    function renderHistory() {
        const list = document.getElementById('searchHistoryList');
        if (!list) return;
        const history = SearchEngine.getSearchHistory().slice(0, 10);
        if (!history.length) {
            list.innerHTML = '<div class="search-history-empty">No recent searches</div>';
            return;
        }
        list.innerHTML = history.map(h => `
            <div class="search-history-item" data-text="${h}">
                <i class="fas fa-clock-rotate-left"></i>
                <span>${h}</span>
            </div>
        `).join('');

        list.querySelectorAll('.search-history-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('searchInput').value = item.dataset.text;
                handleSearchInput(item.dataset.text, true);
            });
        });
    }

    function openSearch() {
        createSearchOverlay();
        const overlay = document.getElementById('search-overlay');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('searchInput')?.focus(), 300);
        showDefaultView();
        isOpen = true;
    }

    function closeSearch() {
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            setTimeout(() => overlay.remove(), 300);
        }
        isOpen = false;
    }

    return { openSearch, closeSearch, createSearchOverlay };
})();
