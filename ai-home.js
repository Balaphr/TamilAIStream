'use strict';
/* ============================================================
   AIHome — Reference-Based Premium Home Page
   Renders all new Home sections from EXISTING production data
   (DataStore / ListeningHistory / PlaylistManager / AI systems)
   and wires the sidebar, header and full-width bottom player.
   Never replaces the audio engine — it drives the same
   window.playSong / window.playStation / PlayerEngine path.
   ============================================================ */
window.AIHome = (() => {

    const $ = (id) => document.getElementById(id);

    /* ---------------- helpers ---------------- */
    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function publishedSongs() {
        try {
            return (window.DataStore ? (DataStore.getSongs() || []) : []).filter(s => s && s.status === 'published');
        } catch (e) { return []; }
    }
    function activeStations() {
        try {
            return (window.DataStore ? (DataStore.getStations() || []) : []).filter(s => s && s.status === 'active');
        } catch (e) { return []; }
    }
    function artOf(item) {
        return item.thumbnail || item.albumCover || item.cover || item.image || '';
    }
    function stationThumb(s) { return s.thumbnail || s.cover || s.image || ''; }
    function stationColor(s, i) {
        if (s && s.gradient) return s.gradient;
        const grads = [
            'linear-gradient(135deg,#312e81,#1e1b4b)',
            'linear-gradient(135deg,#0f3b2e,#064e3b)',
            'linear-gradient(135deg,#7c2d12,#431407)',
            'linear-gradient(135deg,#1e3a5f,#0d1f3c)',
            'linear-gradient(135deg,#3b0a47,#1e0a33)',
            'linear-gradient(135deg,#3b2f0f,#1c1505)'
        ];
        return grads[(i || 0) % grads.length];
    }
    function durationText(d) {
        if (d == null || d === '') return '';
        if (typeof d === 'number') {
            const m = Math.floor(d / 60), s = Math.floor(d % 60);
            return m + ':' + String(s).padStart(2, '0');
        }
        const str = String(d);
        if (/^\d+$/.test(str)) {
            const n = parseInt(str, 10);
            const m = Math.floor(n / 60), s = Math.floor(n % 60);
            return m + ':' + String(s).padStart(2, '0');
        }
        return str;
    }
    function firstWordName() {
        try {
            const u = window.Auth && Auth.currentUser ? Auth.currentUser() : null;
            if (u && u.name) return u.name.split(' ')[0];
            if (u && u.displayName) return u.displayName.split(' ')[0];
        } catch (e) { /* ignore */ }
        return 'Guest';
    }
    function greeting() {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    }
    function isGuestUser() {
        try {
            const u = Auth.currentUser ? Auth.currentUser() : null;
            return !u || !!u.isGuest;
        } catch (e) { return true; }
    }
    const ART_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23101533'/%3E%3Ccircle cx='100' cy='100' r='62' fill='%2322d3ee' opacity='0.16'/%3E%3Cpath d='M84 78 L84 130 L128 104 Z' fill='%2322d3ee' opacity='0.45'/%3E%3C/svg%3E";

    function emptyHTML(icon, title, text) {
        return '<div class="ai-empty"><i class="' + icon + '"></i>' +
            '<div class="ai-empty-title">' + title + '</div>' +
            (text ? '<div class="ai-empty-text">' + text + '</div>' : '') + '</div>';
    }

    function showToastSafe(msg, type) {
        try { if (typeof window.showToast === 'function') window.showToast(msg, type || 'info'); } catch (e) { /* ignore */ }
    }

    /* ---------------- Music Hero ---------------- */
    let heroSlides = [];
    let heroIdx = 0;
    let heroTimer = null;
    let heroBgActive = 'A'; // Track which background layer is active ('A' or 'B')
    let heroTransitioning = false;

    function stationColorFallback() {
        return 'radial-gradient(circle at 50% 40%, rgba(34,211,238,0.28) 0%, rgba(99,102,241,0.16) 40%, rgba(10,15,34,0.9) 75%)';
    }

    function renderMusicHero() {
        const body = $('aiHeroBackdrop');
        const dots = $('aiHeroDotsWrap');
        if (!body) return;
        const songs = publishedSongs();
        heroSlides = songs.length ? songs.slice(0, 10) : [];
        if (!heroSlides.length) {
            body.style.background = stationColorFallback();
            body.innerHTML = '<i class="fa-solid fa-music"></i>';
            return;
        }
        dots.innerHTML = heroSlides.map((_, i) =>
            '<button class="ai-hero-dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '" aria-label="Slide ' + (i + 1) + '"></button>'
        ).join('');
        dots.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.i, 10);
                if (idx !== heroIdx) transitionHeroSlide(idx);
                restartHeroTimer();
            });
        });
        // Set initial background
        applyHeroBackground(heroSlides[0], false);
        applyHeroForeground(heroSlides[0]);
        startHeroTimer();
    }

    // Apply background image to the inactive layer, then crossfade
    function applyHeroBackground(song, animate) {
        const art = artOf(song) || '';
        const layerActive = $('aiHeroBg' + heroBgActive);
        const layerInactive = $('aiHeroBg' + (heroBgActive === 'A' ? 'B' : 'A'));
        if (!layerActive || !layerInactive) return;

        if (animate) {
            // Crossfade: set new image on inactive layer, fade it in, fade old out
            heroTransitioning = true;
            if (art) {
                layerInactive.style.backgroundImage = 'url(' + art + ')';
            } else {
                layerInactive.style.backgroundImage = 'none';
                layerInactive.style.background = stationColorFallback();
            }
            // Force reflow before adding active class
            layerInactive.offsetHeight;
            layerInactive.classList.add('active');
            layerActive.classList.remove('active');
            layerActive.classList.add('prev');

            // Swap active layer reference after transition
            setTimeout(() => {
                layerActive.classList.remove('prev');
                heroBgActive = heroBgActive === 'A' ? 'B' : 'A';
                heroTransitioning = false;
            }, 1300);
        } else {
            // Instant set (first load)
            if (art) {
                layerActive.style.backgroundImage = 'url(' + art + ')';
            } else {
                layerActive.style.backgroundImage = 'none';
                layerActive.style.background = stationColorFallback();
            }
        }
    }

    // Update foreground art, title, artist with slide animation
    function applyHeroForeground(song) {
        const art = artOf(song) || '';
        const body = $('aiHeroBackdrop');
        if (body) {
            if (art) {
                body.style.background = 'url("' + art + '") center/cover no-repeat';
                body.innerHTML = '<img src="' + art + '" alt="" loading="lazy">';
            } else {
                body.style.background = stationColorFallback();
                body.innerHTML = '<i class="fa-solid fa-music"></i>';
            }
        }
        const titleEl = $('aiHeroTitle');
        if (titleEl) titleEl.textContent = song.title || 'Tamil Music';
        const artistEl = $('aiHeroArtist');
        if (artistEl) artistEl.textContent = song.artist || song.singer || 'Tamil AI Stream';
        const dots = $('aiHeroDotsWrap');
        if (dots) Array.from(dots.children).forEach((d, i) => d.classList.toggle('active', i === heroIdx));
    }

    // Full slide transition with crossfade background + foreground animation
    function transitionHeroSlide(idx) {
        if (!heroSlides.length || heroTransitioning) return;
        heroIdx = (idx + heroSlides.length) % heroSlides.length;
        const song = heroSlides[heroIdx];
        const wrap = document.querySelector('.ai-hero-art-wrap');

        // Animate foreground exit
        if (wrap) wrap.classList.add('slide-exit');

        // After brief exit, update content and animate in
        setTimeout(() => {
            applyHeroBackground(song, true);
            applyHeroForeground(song);
            if (wrap) {
                wrap.classList.remove('slide-exit');
                wrap.classList.add('slide-enter');
                setTimeout(() => wrap.classList.remove('slide-enter'), 700);
            }
        }, 350);
    }

    function startHeroTimer() {
        stopHeroTimer();
        if (heroSlides.length < 2) return;
        heroTimer = setInterval(() => {
            if (!document.hidden) transitionHeroSlide(heroIdx + 1);
        }, 20000); // 20 seconds between rotations
    }
    function stopHeroTimer() { if (heroTimer) { clearInterval(heroTimer); heroTimer = null; } }
    function restartHeroTimer() { startHeroTimer(); }

    /* ---------------- Trending Playlists ---------------- */
    function collectPlaylists() {
        const merged = [];
        const seen = {};
        function push(p) {
            if (!p || !p.id || seen[p.id]) return;
            seen[p.id] = 1;
            merged.push(p);
        }
        try { (DataStore.getPlaylists() || []).forEach(push); } catch (e) { /* ignore */ }
        try {
            if (window.PlaylistManager) {
                if (typeof PlaylistManager.getPlaylists === 'function') PlaylistManager.getPlaylists().forEach(push);
                if (typeof PlaylistManager.getAIPlaylists === 'function') PlaylistManager.getAIPlaylists().forEach(push);
            }
        } catch (e) { /* ignore */ }
        return merged;
    }

    function resolvePlaylistSongs(playlist) {
        const items = playlist.songs || playlist.songIds || [];
        if (items.some(s => s && (s.audioUrl || s.streamUrl))) return items.filter(s => s);
        const all = publishedSongs();
        const ids = items.map(s => (s && s.songId) || s || '');
        const found = all.filter(s => ids.indexOf(s.id || s.songId) !== -1);
        return found.length ? found : all.slice(0, 12);
    }

    function bindHeroPlay() {
        const btn = $('aiHeroPlayBtn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const songs = publishedSongs();
            if (!songs.length) { showToastSafe('No songs available yet', 'info'); return; }
            const start = Math.min(heroIdx, songs.length - 1);
            if (typeof window.playSong === 'function') window.playSong(songs[start], songs);
            else showToastSafe('Ready to play: ' + songs[start].title, 'info');
        });
    }

    function renderTrendingPlaylists() {
        const row = $('aiTrendingPlaylists');
        if (!row) return;
        let playlists = collectPlaylists();
        if (!playlists.length) playlists = buildDerivedPlaylists();
        if (!playlists.length) {
            row.innerHTML = emptyHTML('fa-solid fa-list', 'No playlists yet',
                'Create playlists from the Library and your trending mixes will appear here.');
            return;
        }
        row.innerHTML = playlists.slice(0, 10).map((p, i) => {
            const songs = resolvePlaylistSongs(p);
            const cover = p.thumbnail || p.cover || p.image || artOf(songs[0]) || '';
            const count = songs.length;
            const name = (p.name || p.title || 'Playlist').slice(0, 34);
            const grad = p.gradient || stationColor(p, i);
            return '<div class="ai-playlist-card" data-pl="' + i + '">' +
                '<div class="ai-playlist-art" style="background:' + grad + ';' +
                (cover ? 'background-image:url(\'' + cover + '\');background-size:cover;background-position:center;' : '') + '">' +
                (cover ? '<img src="' + escapeHtml(cover) + '" alt="" loading="lazy" onerror="this.remove()">' : '<i class="fa-solid fa-compact-disc ai-pa-icon"></i>') +
                '<button class="ai-play-btn" data-pl="' + i + '" aria-label="Play ' + escapeHtml(name) + '"><i class="fa-solid fa-play" style="margin-left:2px;"></i></button>' +
                '</div><div class="ai-playlist-info">' +
                '<div class="ai-playlist-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</div>' +
                '<div class="ai-playlist-count">' + count + ' songs</div></div></div>';
        }).join('');
        row.querySelectorAll('.ai-playlist-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const idx = parseInt(card.dataset.pl, 10);
                const p = playlists[idx];
                if (!p) return;
                const songs = resolvePlaylistSongs(p);
                if (!songs.length) { showToastSafe('Playlist "' + (p.name || '') + '" has no playable songs yet', 'info'); return; }
                openPlaylistDetail(p, songs);
            });
        });
    }

    function buildDerivedPlaylists() {
        const songs = publishedSongs();
        if (!songs.length) return [];
        const groups = {};
        songs.forEach(s => {
            const g = (s.genre || s.mood || '').trim();
            const key = g || 'Tamil Hits';
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });
        const grads = ['linear-gradient(135deg,#312e81,#1e1b4b)', 'linear-gradient(135deg,#0f3b2e,#064e3b)',
            'linear-gradient(135deg,#7c2d12,#431407)', 'linear-gradient(135deg,#1e3a5f,#0d1f3c)', 'linear-gradient(135deg,#3b0a47,#1e0a33)'];
        return Object.keys(groups).map((name, i) => ({
            id: 'derived_' + i, name: name.slice(0, 34),
            songs: groups[name], thumbnail: artOf(groups[name][0]), gradient: grads[i % grads.length]
        }));
    }

    /* ---- Playlist Detail Overlay ---- */
    function openPlaylistDetail(playlist, songs) {
        const existing = document.getElementById('aiPlaylistDetail');
        if (existing) existing.remove();
        const name = (playlist.name || playlist.title || 'Playlist').slice(0, 40);
        const cover = playlist.thumbnail || playlist.cover || playlist.image || artOf(songs[0]) || '';
        const grad = playlist.gradient || 'linear-gradient(135deg,#312e81,#1e1b4b)';
        const wrap = document.createElement('div');
        wrap.className = 'ai-playlist-detail';
        wrap.id = 'aiPlaylistDetail';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.innerHTML =
            '<div class="ai-playlist-detail-overlay"></div>' +
            '<div class="ai-playlist-detail-panel">' +
            '<div class="ai-pl-detail-header" style="background:' + grad + ';' +
            (cover ? 'background-image:url(\'' + cover + '\');background-size:cover;background-position:center;' : '') + '">' +
            '<div class="ai-pl-detail-header-bg"></div>' +
            '<button class="ai-pl-detail-back" type="button"><i class="fa-solid fa-arrow-left"></i></button>' +
            '<div class="ai-pl-detail-info">' +
            '<h3 class="ai-pl-detail-name">' + escapeHtml(name) + '</h3>' +
            '<div class="ai-pl-detail-meta">' + songs.length + ' songs</div>' +
            '<button class="ai-pl-detail-play" data-pl-action="play-all"><i class="fa-solid fa-play" style="margin-left:2px;"></i> Play All</button>' +
            '</div></div>' +
            '<div class="ai-pl-detail-list">' +
            songs.map((s, i) => {
                const title = (s.title || s.name || 'Untitled').slice(0, 38);
                const artist = (s.artist || s.singer || '').slice(0, 30);
                const dur = durationText(s.duration);
                const songArt = artOf(s);
                return '<div class="ai-pl-detail-song" data-idx="' + i + '">' +
                    '<div class="ai-pl-ds-num">' + (i + 1) + '</div>' +
                    '<div class="ai-pl-ds-art">' +
                    (songArt ? '<img src="' + escapeHtml(songArt) + '" alt="" loading="lazy" onerror="this.remove()">' : '<i class="fa-solid fa-music"></i>') +
                    '</div>' +
                    '<div class="ai-pl-ds-info">' +
                    '<div class="ai-pl-ds-title">' + escapeHtml(title) + '</div>' +
                    '<div class="ai-pl-ds-artist">' + escapeHtml(artist) + '</div>' +
                    '</div>' +
                    (dur ? '<div class="ai-pl-ds-dur">' + dur + '</div>' : '') +
                    '<button class="ai-pl-ds-play" aria-label="Play ' + escapeHtml(title) + '"><i class="fa-solid fa-play"></i></button>' +
                    '</div>';
            }).join('') +
            '</div></div>';
        document.body.appendChild(wrap);
        document.body.classList.add('ai-playlist-detail-open');
        requestAnimationFrame(() => wrap.classList.add('open'));

        /* Play All button */
        wrap.querySelector('[data-pl-action="play-all"]').addEventListener('click', () => {
            if (songs.length && typeof window.playSong === 'function') window.playSong(songs[0], songs);
        });

        /* Individual song clicks */
        wrap.querySelectorAll('.ai-pl-detail-song').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.idx, 10);
                const song = songs[idx];
                if (song && typeof window.playSong === 'function') window.playSong(song, songs);
            });
        });

        /* Close handlers */
        const closeDetail = () => {
            wrap.classList.remove('open');
            setTimeout(() => { if (wrap.parentNode) wrap.remove(); document.body.classList.remove('ai-playlist-detail-open'); }, 250);
        };
        wrap.querySelector('.ai-pl-detail-back').addEventListener('click', closeDetail);
        wrap.querySelector('.ai-playlist-detail-overlay').addEventListener('click', closeDetail);
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { document.removeEventListener('keydown', esc); closeDetail(); }
        });
    }

    /* ---------------- Live FM Stations ---------------- */
    function renderLiveFm() {
        const grid = $('aiLiveFmGrid');
        if (!grid) return;
        const stations = activeStations().slice(0, 6);
        if (!stations.length) {
            grid.innerHTML = emptyHTML('fa-solid fa-tower-broadcast', 'No stations yet',
                'Add your FM stations from the Website Builder and they will appear live here.');
            return;
        }
        grid.innerHTML = stations.map((s, i) => {
            const name = (s.name || 'FM Station').slice(0, 26);
            const freq = s.freq ? s.freq + ' FM' : 'FM';
            const lc = s.city || 'Chennai';
            const listeners = s.listeners || 0;
            const lText = listeners >= 1000 ? (listeners / 1000).toFixed(1) + 'K' : String(listeners);
            const thumb = stationThumb(s);
            return '<div class="ai-fm-card" data-station="' + escapeHtml(name) + '">' +
                '<div class="ai-fm-art" style="background:' + stationColor(s, i) + ';">' +
                '<span class="ai-fm-live-badge"><span class="ai-live-dot" style="box-shadow:none;animation:none;"></span>LIVE</span>' +
                (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="" loading="lazy" onerror="this.remove()">' : '<i class="fa-solid fa-tower-broadcast"></i>') +
                '</div>' +
                '<div class="ai-fm-info">' +
                '<div class="ai-fm-name">' + escapeHtml(name) + '</div>' +
                '<div class="ai-fm-meta"><span class="ai-fm-freq">' + escapeHtml(freq) + '</span><span>' + escapeHtml(lc) + '</span></div>' +
                '<div class="ai-fm-wave"><span></span><span></span><span></span><span></span><span></span></div>' +
                '</div>' +
                '<button class="ai-fm-play-btn" aria-label="Play ' + escapeHtml(name) + '"><i class="fa-solid fa-play" style="margin-left:2px;"></i></button>' +
                '</div>';
        }).join('');
        grid.querySelectorAll('.ai-fm-card').forEach(card => {
            const btn = card.querySelector('.ai-fm-play-btn');
            if (btn) btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = card.dataset.station;
                if (!name) return;
                if (typeof window.toggleStationFromCard === 'function') {
                    window.toggleStationFromCard(card, name);
                } else if (typeof window.playStation === 'function') {
                    window.playStation(name);
                }
                setTimeout(syncFmPlaying, 120);
            });
            card.addEventListener('click', () => {
                const name = card.dataset.station;
                if (!name) return;
                if (typeof window.toggleStationFromCard === 'function') {
                    window.toggleStationFromCard(card, name);
                } else if (typeof window.playStation === 'function') {
                    window.playStation(name);
                }
                setTimeout(syncFmPlaying, 120);
            });
        });
        syncFmPlaying();
    }

    function syncFmPlaying() {
        const cards = document.querySelectorAll('.ai-fm-card');
        if (!cards.length) return;
        let playing = false, cur = '';
        try {
            playing = window.isStreamPlaying === true;
            if (!playing && typeof isStreamPlaying !== 'undefined') playing = isStreamPlaying === true;
            cur = String(window.currentStation || (typeof currentStation !== 'undefined' ? currentStation : '') || '');
        } catch (e) { /* ignore */ }
        cur = cur.toLowerCase();
        cards.forEach(card => {
            const name = (card.dataset.station || '').toLowerCase();
            const active = playing && cur && name &&
                (cur.indexOf(name) !== -1 || name.indexOf(cur) !== -1);
            card.classList.toggle('active-station', !!active);
            card.classList.toggle('playing-station', !!active);
            const wave = card.querySelector('.ai-fm-wave');
            if (wave) wave.classList.toggle('static', !active);
            const icon = card.querySelector('.ai-fm-play-btn i');
            if (icon) icon.className = active ? 'fa-solid fa-pause' : 'fa-solid fa-play';
        });
    }
    function bindPlaybackHooks() {
        document.addEventListener('play', (e) => {
            if (e.target === window.audioPlayer) setTimeout(syncFmPlaying, 80);
            if (e.target === window.audioPlayer) setTimeout(syncDecadeListPlaying, 80);
        }, true);
        document.addEventListener('pause', (e) => {
            if (e.target === window.audioPlayer) setTimeout(syncFmPlaying, 80);
        }, true);
        window.addEventListener('ytm:playTrack', () => setTimeout(syncFmPlaying, 100));
        window.addEventListener('ytm:pauseTrack', () => setTimeout(syncFmPlaying, 100));
        window.addEventListener('ytm:resumeTrack', () => setTimeout(syncFmPlaying, 100));
    }

    /* ---------------- Live Tamil News ---------------- */
    // Loads the latest Tamil news from the worker /api/news endpoint (which
    // pulls from the RCC Tamil RSS feed, filters to Tamil-only content, dedupes,
    // prioritizes Tamil Nadu news first and applies the retention window from
    // Site Settings). Clicking a card opens an in-app detail view (never an
    // external URL) with the thumbnail shown prominently at the top. The list
    // auto-refreshes in place so the audio player is never disturbed.
    let newsItems = [];
    let newsTimer = null;
    let newsLoading = false;
    let newsLastLoaded = 0;
    let _newsCurrentIndex = -1;
    let _newsRefreshCount = 0;
    let _newsLastRefreshTime = 0;

    // News display config lives in Builder Site Settings (tamilAIStream_siteSettings.newsSettings).
    function newsDisplayConfig() {
        const cfg = { maxItems: 4, highlightHours: 6, showPlayerOnDetail: true, seeAllMax: 25, refreshInterval: 300000, retainHours: 72, showNavButtons: true, showViewButton: true, showRefreshIndicator: true };
        try {
            if (window.DataStore) {
                const s = DataStore.getSiteSettings() || {};
                const ns = s.newsSettings || {};
                // Read from nested newsSettings (legacy)
                if (ns.maxItems && ns.maxItems > 0) cfg.maxItems = Math.min(ns.maxItems, 40);
                if (ns.highlightHours && ns.highlightHours > 0) cfg.highlightHours = ns.highlightHours;
                if (typeof ns.showPlayerOnDetail === 'boolean') cfg.showPlayerOnDetail = ns.showPlayerOnDetail;
                if (ns.seeAllMax && ns.seeAllMax > 0) cfg.seeAllMax = Math.min(ns.seeAllMax, 50);
                if (ns.refreshInterval && ns.refreshInterval >= 30000) cfg.refreshInterval = ns.refreshInterval;
                if (ns.retainHours && ns.retainHours > 0) cfg.retainHours = ns.retainHours;
                if (typeof ns.showNavButtons === 'boolean') cfg.showNavButtons = ns.showNavButtons;
                if (typeof ns.showViewButton === 'boolean') cfg.showViewButton = ns.showViewButton;
                if (typeof ns.showRefreshIndicator === 'boolean') cfg.showRefreshIndicator = ns.showRefreshIndicator;
                // Read from flat liveNews* keys (Builder registry)
                if (s.liveNewsMax && s.liveNewsMax > 0) cfg.maxItems = Math.min(s.liveNewsMax, 40);
                if (s.liveNewsHighlightHours && s.liveNewsHighlightHours > 0) cfg.highlightHours = s.liveNewsHighlightHours;
                if (typeof s.liveNewsShowDetail === 'boolean') cfg.showPlayerOnDetail = s.liveNewsShowDetailPlayer !== false;
                if (s.liveNewsSeeAllMax && s.liveNewsSeeAllMax > 0) cfg.seeAllMax = Math.min(s.liveNewsSeeAllMax, 50);
                if (s.liveNewsAutoRefreshInterval && s.liveNewsAutoRefreshInterval >= 30000) cfg.refreshInterval = s.liveNewsAutoRefreshInterval;
                if (s.liveNewsRetainHours && s.liveNewsRetainHours > 0) cfg.retainHours = s.liveNewsRetainHours;
                if (typeof s.liveNewsShowNavButtons === 'boolean') cfg.showNavButtons = s.liveNewsShowNavButtons;
                if (typeof s.liveNewsShowViewButton === 'boolean') cfg.showViewButton = s.liveNewsShowViewButton;
                if (typeof s.liveNewsShowRefreshIndicator === 'boolean') cfg.showRefreshIndicator = s.liveNewsShowRefreshIndicator;
            }
        } catch (e) { /* ignore */ }
        return cfg;
    }

    function timeAgo(iso) {
        if (!iso) return '';
        try {
            const diff = Date.now() - new Date(iso).getTime();
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
            if (diff < 86400000) return Math.floor(diff / 3600000) + ' hr ago';
            return Math.floor(diff / 86400000) + 'd ago';
        } catch (e) { return ''; }
    }

    // Tamil Nadu priority flag comes from the worker (priority:'tamil-nadu').
    function isTnNews(n) { return n && (n.priority === 'tamil-nadu' || n.tamilNadu === true); }

    // Track the currently open detail's Escape handler so we can clean it up
    let _newsDetailEscHandler = null;
    let _newsDetailClosing = false;

    function newsDetailOpen(id, skipIndex) {
        const idx = (newsItems || []).findIndex(n => String(n.id) === String(id));
        if (idx < 0) return;
        const item = newsItems[idx];
        _newsCurrentIndex = idx;
        try {
            // Guard: if a detail is already open, close it first (prevents stacking)
            const existing = document.getElementById('aiNewsDetail');
            if (existing) {
                existing.remove();
                if (_newsDetailEscHandler) {
                    document.removeEventListener('keydown', _newsDetailEscHandler);
                    _newsDetailEscHandler = null;
                }
            }
            // Guard: if a close animation is in progress, don't open yet
            if (_newsDetailClosing) return;

            const cfg = newsDisplayConfig();
            const total = newsItems.length;
            const pubTime = item.publishedAt ? new Date(item.publishedAt) : null;
            const timeText = pubTime ? pubTime.toLocaleString('ta-IN', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '';
            if (cfg.showPlayerOnDetail) {
                document.body.classList.add('ai-news-player-visible');
            }

            const tnBadge = isTnNews(item) ? '<span class="ai-news-detail-tn"><i class="fa-solid fa-location-dot"></i> Tamil Nadu</span>' : '';

            // Nav buttons
            let navHtml = '';
            if (cfg.showNavButtons && total > 1) {
                const hasPrev = idx > 0;
                const hasNext = idx < total - 1;
                navHtml =
                    '<div class="ai-news-detail-nav">' +
                    '<button class="ai-news-nav-btn ai-news-nav-prev" type="button"' + (!hasPrev ? ' disabled' : '') + ' data-dir="prev"><i class="fa-solid fa-chevron-left"></i> Prev</button>' +
                    '<span class="ai-news-nav-counter">' + (idx + 1) + ' / ' + total + '</span>' +
                    '<button class="ai-news-nav-btn ai-news-nav-next" type="button"' + (!hasNext ? ' disabled' : '') + ' data-dir="next">Next <i class="fa-solid fa-chevron-right"></i></button>' +
                    '</div>';
            }

            // View button
            let viewHtml = '';
            if (cfg.showViewButton && item.url) {
                viewHtml = '<a class="ai-news-detail-view-btn" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-up-right-from-square"></i> View Full Article</a>';
            }

            const wrap = document.createElement('div');
            wrap.className = 'ai-news-detail';
            wrap.id = 'aiNewsDetail';
            wrap.setAttribute('role', 'dialog');
            wrap.setAttribute('aria-modal', 'true');
            wrap.innerHTML =
                '<div class="ai-news-detail-overlay"></div>' +
                '<div class="ai-news-detail-panel">' +
                '<div class="ai-news-detail-topbar">' +
                '<button class="ai-news-detail-back" type="button"><i class="fa-solid fa-arrow-left"></i> Back</button>' +
                navHtml +
                '</div>' +
                (item.image ? '<div class="ai-news-detail-img"><img src="' + escapeHtml(item.image) + '" alt="" loading="lazy"></div>' : '') +
                '<div class="ai-news-detail-body">' +
                (tnBadge ? '<div class="ai-news-detail-flags">' + tnBadge + '</div>' : '') +
                '<h3 class="ai-news-detail-title">' + escapeHtml(item.title) + '</h3>' +
                '<div class="ai-news-detail-meta">' +
                (timeText ? '<span class="ai-news-detail-time"><i class="fa-regular fa-clock"></i> ' + escapeHtml(timeText) + '</span>' : '') +
                '</div>' +
                '<div class="ai-news-detail-content">' + escapeHtml(item.content || '') + '</div>' +
                viewHtml +
                '</div></div>';
            document.body.appendChild(wrap);
            document.body.classList.add('ai-news-detail-open');
            requestAnimationFrame(() => wrap.classList.add('open'));

            // Unified close function
            const removeDetail = () => {
                if (_newsDetailClosing) return;
                _newsDetailClosing = true;
                wrap.classList.remove('open');
                if (_newsDetailEscHandler) {
                    document.removeEventListener('keydown', _newsDetailEscHandler);
                    _newsDetailEscHandler = null;
                }
                setTimeout(() => {
                    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
                    document.body.classList.remove('ai-news-detail-open');
                    document.body.classList.remove('ai-news-player-visible');
                    _newsDetailClosing = false;
                    _newsCurrentIndex = -1;
                    // Force re-enable touch on news cards
                    document.querySelectorAll('.ai-news-card').forEach(c => {
                        c.style.pointerEvents = '';
                        c.style.webkitTapHighlightColor = '';
                    });
                }, 220);
            };

            // Navigation function
            const navigateTo = (dir) => {
                const newIdx = dir === 'next' ? _newsCurrentIndex + 1 : _newsCurrentIndex - 1;
                if (newIdx < 0 || newIdx >= newsItems.length) return;
                removeDetail();
                setTimeout(() => {
                    newsDetailOpen(newsItems[newIdx].id);
                }, 260);
            };

            wrap.querySelector('.ai-news-detail-back').addEventListener('click', removeDetail);
            wrap.querySelector('.ai-news-detail-overlay').addEventListener('click', removeDetail);

            // Nav button handlers
            const prevBtn = wrap.querySelector('.ai-news-nav-prev');
            const nextBtn = wrap.querySelector('.ai-news-nav-next');
            if (prevBtn) prevBtn.addEventListener('click', () => navigateTo('prev'));
            if (nextBtn) nextBtn.addEventListener('click', () => navigateTo('next'));

            // Swipe support for mobile
            let touchStartX = 0;
            wrap.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
            wrap.addEventListener('touchend', (e) => {
                const diff = e.changedTouches[0].screenX - touchStartX;
                if (Math.abs(diff) > 60) {
                    if (diff > 0) navigateTo('prev');
                    else navigateTo('next');
                }
            }, { passive: true });

            // Escape key
            _newsDetailEscHandler = (e) => {
                if (e.key === 'Escape') removeDetail();
            };
            document.addEventListener('keydown', _newsDetailEscHandler);
        } catch (e) { /* ignore */ }
    }

    function renderNewsList() {
        const list = $('aiNewsList');
        if (!list) return;
        if (!newsItems.length) {
            if (!newsLoading) list.innerHTML = emptyHTML('fa-solid fa-newspaper', 'Loading Tamil news…',
                'Fetching the latest headlines from the Tamil news feed.');
            return;
        }
        const cfg = newsDisplayConfig();
        const now = Date.now();
        const visible = newsItems.slice(0, cfg.maxItems);
        list.innerHTML = visible.map((n) => {
            const pub = n.publishedAt ? new Date(n.publishedAt).getTime() : 0;
            const isFresh = !isNaN(pub) && (now - pub) < cfg.highlightHours * 3600000;
            const isHighlighted = !!n.highlighted || isFresh;
            const tn = isTnNews(n);
            return '<div class="ai-news-card' + (tn ? ' ai-news-card-tn' : '') + '" role="button" tabindex="0" data-news-id="' + escapeHtml(String(n.id)) + '">' +
                '<div class="ai-news-img">' +
                (n.image ? '<img src="' + escapeHtml(n.image) + '" alt="" loading="lazy" onerror="this.remove()">' : '<i class="fa-solid fa-newspaper"></i>') +
                (isHighlighted ? '<span class="ai-news-live"><span class="ai-live-dot" style="box-shadow:none;animation:none;width:5px;height:5px;"></span>NEW</span>' : '') +
                (tn ? '<span class="ai-news-tn-badge">TAMIL NADU</span>' : '') +
                '</div>' +
                '<div class="ai-news-info">' +
                '<div class="ai-news-headline">' + escapeHtml(n.title) + '</div>' +
                '<div class="ai-news-meta">' +
                (n.publishedAt ? '<span>' + timeAgo(n.publishedAt) + '</span>' : '') +
                '</div></div></div>';
        }).join('');
        list.querySelectorAll('.ai-news-card').forEach(card => {
            const open = () => newsDetailOpen(card.dataset.newsId);
            card.addEventListener('click', open);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
            });
        });
    }

    async function loadNews() {
        const list = $('aiNewsList');
        if (!list) return;
        if (newsLoading) return;
        // Avoid hammering the endpoint when refreshHome fires repeatedly.
        const nowMs = Date.now();
        if (newsItems.length && (nowMs - newsLastLoaded) < 30000) return;
        newsLoading = true;
        try {
            const resp = await fetch('/api/news', { cache: 'no-store' });
            if (!resp.ok) throw new Error('news fetch failed ' + resp.status);
            const data = await resp.json();
            if (data && Array.isArray(data.items)) {
                newsItems = data.items;
                newsLastLoaded = Date.now();
                renderNewsList();
            }
        } catch (e) {
            // Keep whatever we rendered last time (or cached). Only show an
            // error state if we've never successfully loaded anything.
            if (!newsItems.length) {
                list.innerHTML = emptyHTML('fa-solid fa-newspaper', 'News is temporarily unavailable',
                    'Please check your connection and try again shortly.');
            }
        } finally {
            newsLoading = false;
        }
    }

    let newsVisibilityBound = false;
    function startNewsAutoRefresh() {
        const cfg = newsDisplayConfig();
        if (newsTimer) clearInterval(newsTimer);
        // Check if auto-refresh bot is enabled
        let botEnabled = true;
        let botInterval = cfg.refreshInterval;
        let botOnFocus = true;
        try {
            if (window.DataStore) {
                const s = DataStore.getSiteSettings() || {};
                const ns = s.newsSettings || {};
                if (typeof ns.liveNewsAutoRefreshEnabled === 'boolean') botEnabled = ns.liveNewsAutoRefreshEnabled;
                if (ns.liveNewsAutoRefreshInterval && ns.liveNewsAutoRefreshInterval >= 30000) botInterval = ns.liveNewsAutoRefreshInterval;
                if (typeof ns.liveNewsAutoRefreshOnFocus === 'boolean') botOnFocus = ns.liveNewsAutoRefreshOnFocus;
            }
        } catch (e) { /* ignore */ }

        if (!botEnabled) {
            updateNewsRefreshIndicator();
            return;
        }

        newsTimer = setInterval(() => {
            _newsRefreshCount++;
            _newsLastRefreshTime = Date.now();
            updateNewsRefreshIndicator();
            loadNews();
        }, botInterval);

        if (!newsVisibilityBound) {
            newsVisibilityBound = true;
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && botOnFocus) {
                    _newsRefreshCount++;
                    _newsLastRefreshTime = Date.now();
                    updateNewsRefreshIndicator();
                    loadNews();
                }
            });
        }
        updateNewsRefreshIndicator();
    }

    function updateNewsRefreshIndicator() {
        const indicator = $('aiNewsRefreshIndicator');
        if (!indicator) return;
        const cfg = newsDisplayConfig();
        if (!cfg.showRefreshIndicator) { indicator.style.display = 'none'; return; }
        indicator.style.display = '';
        const timeText = _newsLastRefreshTime ? timeAgo(new Date(_newsLastRefreshTime).toISOString()) : 'Never';
        indicator.innerHTML = '<i class="fas fa-sync-alt"></i> Updated ' + timeText + ' (#' + _newsRefreshCount + ')';
    }

    function renderLiveNews() {
        const list = $('aiNewsList');
        if (!list) return;
        if (!newsItems.length) {
            list.innerHTML = emptyHTML('fa-solid fa-newspaper', 'Loading Tamil news…',
                'Fetching the latest headlines from the Tamil news feed.');
        } else {
            renderNewsList();
        }
        loadNews();
        startNewsAutoRefresh();
    }

    /* ---------------- News See All Overlay ---------------- */
    // Opens a full-page overlay showing ALL news items. Clicking an item opens
    // the detail view inside the same overlay. Back returns to the list. This
    // avoids the broken "See All → radio page" redirect and lets users browse
    // multiple articles seamlessly.
    let _newsSeeAllEl = null;
    let _newsSeeAllEscHandler = null;

    function newsSeeAllOpen() {
        // Close any existing overlay first
        newsSeeAllClose();
        if (!newsItems.length) {
            showToastSafe('No news loaded yet', 'info');
            return;
        }
        const wrap = document.createElement('div');
        wrap.className = 'ai-news-seeall';
        wrap.id = 'aiNewsSeeAll';
        const cfg = newsDisplayConfig();
        const now = Date.now();
        const seeAllItems = newsItems.slice(0, cfg.seeAllMax || 25);
        const allHTML = seeAllItems.map((n) => {
            const pub = n.publishedAt ? new Date(n.publishedAt).getTime() : 0;
            const isFresh = !isNaN(pub) && (now - pub) < cfg.highlightHours * 3600000;
            const isHighlighted = !!n.highlighted || isFresh;
            const tn = isTnNews(n);
            return '<div class="ai-news-card' + (tn ? ' ai-news-card-tn' : '') + '" role="button" tabindex="0" data-news-id="' + escapeHtml(String(n.id)) + '">' +
                '<div class="ai-news-img">' +
                (n.image ? '<img src="' + escapeHtml(n.image) + '" alt="" loading="lazy" onerror="this.remove()">' : '<i class="fa-solid fa-newspaper"></i>') +
                (isHighlighted ? '<span class="ai-news-live"><span class="ai-live-dot" style="box-shadow:none;animation:none;width:5px;height:5px;"></span>NEW</span>' : '') +
                (tn ? '<span class="ai-news-tn-badge">TAMIL NADU</span>' : '') +
                '</div>' +
                '<div class="ai-news-info">' +
                '<div class="ai-news-headline">' + escapeHtml(n.title) + '</div>' +
                '<div class="ai-news-meta">' +
                (n.publishedAt ? '<span>' + timeAgo(n.publishedAt) + '</span>' : '') +
                '</div></div></div>';
        }).join('');

        wrap.innerHTML =
            '<div class="ai-news-seeall-overlay"></div>' +
            '<div class="ai-news-seeall-panel">' +
            '<div class="ai-news-seeall-header">' +
            '<button class="ai-news-seeall-close" type="button"><i class="fa-solid fa-xmark"></i></button>' +
            '<h3><span class="ai-live-dot"></span> All Tamil News</h3>' +
            '<span class="ai-news-seeall-count">' + seeAllItems.length + ' articles</span>' +
            '</div>' +
            '<div class="ai-news-seeall-list">' + allHTML + '</div>' +
            '</div>';

        document.body.appendChild(wrap);
        _newsSeeAllEl = wrap;
        document.body.classList.add('ai-news-detail-open');
        requestAnimationFrame(() => wrap.classList.add('open'));

        // Bind close
        const closeOverlay = () => newsSeeAllClose();
        wrap.querySelector('.ai-news-seeall-close').addEventListener('click', closeOverlay);
        wrap.querySelector('.ai-news-seeall-overlay').addEventListener('click', closeOverlay);

        // Bind news card clicks — open detail inside the overlay
        wrap.querySelectorAll('.ai-news-card').forEach(card => {
            const openDetail = () => {
                const id = card.dataset.newsId;
                // Open detail inside the see-all overlay
                newsDetailOpenInline(id, wrap);
            };
            card.addEventListener('click', openDetail);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); }
            });
        });

        // Escape key
        _newsSeeAllEscHandler = (e) => {
            if (e.key === 'Escape') {
                // If a detail is open inside, close that first
                const detail = wrap.querySelector('.ai-news-detail');
                if (detail) { detail.remove(); return; }
                newsSeeAllClose();
            }
        };
        document.addEventListener('keydown', _newsSeeAllEscHandler);
    }

    function newsSeeAllClose() {
        if (_newsSeeAllEscHandler) {
            document.removeEventListener('keydown', _newsSeeAllEscHandler);
            _newsSeeAllEscHandler = null;
        }
        if (_newsSeeAllEl) {
            _newsSeeAllEl.classList.remove('open');
            const el = _newsSeeAllEl;
            setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
            _newsSeeAllEl = null;
        }
        document.body.classList.remove('ai-news-detail-open');
    }

    // Opens a news detail inline within the see-all overlay (not as a separate
    // body-level dialog). This avoids the stacked-dialog bugs.
    function newsDetailOpenInline(id, container) {
        const idx = (newsItems || []).findIndex(n => String(n.id) === String(id));
        if (idx < 0) return;
        const item = newsItems[idx];
        // Remove any existing inline detail first
        const existing = container.querySelector('.ai-news-detail');
        if (existing) existing.remove();

        const cfg = newsDisplayConfig();
        const total = newsItems.length;
        const pubTime = item.publishedAt ? new Date(item.publishedAt) : null;
        const timeText = pubTime ? pubTime.toLocaleString('ta-IN', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '';
        const tnBadge = isTnNews(item) ? '<span class="ai-news-detail-tn"><i class="fa-solid fa-location-dot"></i> Tamil Nadu</span>' : '';

        let navHtml = '';
        if (cfg.showNavButtons && total > 1) {
            const hasPrev = idx > 0;
            const hasNext = idx < total - 1;
            navHtml =
                '<div class="ai-news-detail-nav">' +
                '<button class="ai-news-nav-btn ai-news-nav-prev" type="button"' + (!hasPrev ? ' disabled' : '') + ' data-dir="prev"><i class="fa-solid fa-chevron-left"></i> Prev</button>' +
                '<span class="ai-news-nav-counter">' + (idx + 1) + ' / ' + total + '</span>' +
                '<button class="ai-news-nav-btn ai-news-nav-next" type="button"' + (!hasNext ? ' disabled' : '') + ' data-dir="next">Next <i class="fa-solid fa-chevron-right"></i></button>' +
                '</div>';
        }

        let viewHtml = '';
        if (cfg.showViewButton && item.url) {
            viewHtml = '<a class="ai-news-detail-view-btn" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-up-right-from-square"></i> View Full Article</a>';
        }

        const detail = document.createElement('div');
        detail.className = 'ai-news-detail ai-news-detail-inline';
        detail.innerHTML =
            '<div class="ai-news-detail-overlay"></div>' +
            '<div class="ai-news-detail-panel">' +
            '<div class="ai-news-detail-topbar">' +
            '<button class="ai-news-detail-back" type="button"><i class="fa-solid fa-arrow-left"></i> Back</button>' +
            navHtml +
            '</div>' +
            (item.image ? '<div class="ai-news-detail-img"><img src="' + escapeHtml(item.image) + '" alt="" loading="lazy"></div>' : '') +
            '<div class="ai-news-detail-body">' +
            (tnBadge ? '<div class="ai-news-detail-flags">' + tnBadge + '</div>' : '') +
            '<h3 class="ai-news-detail-title">' + escapeHtml(item.title) + '</h3>' +
            '<div class="ai-news-detail-meta">' +
            (timeText ? '<span class="ai-news-detail-time"><i class="fa-regular fa-clock"></i> ' + escapeHtml(timeText) + '</span>' : '') +
            '</div>' +
            '<div class="ai-news-detail-content">' + escapeHtml(item.content || '') + '</div>' +
            viewHtml +
            '</div></div>';

        container.appendChild(detail);
        requestAnimationFrame(() => detail.classList.add('open'));

        const removeDetail = () => {
            detail.classList.remove('open');
            setTimeout(() => { if (detail.parentNode) detail.parentNode.removeChild(detail); }, 220);
        };

        const navigateInline = (dir) => {
            const newIdx = dir === 'next' ? idx + 1 : idx - 1;
            if (newIdx < 0 || newIdx >= newsItems.length) return;
            removeDetail();
            setTimeout(() => newsDetailOpenInline(newsItems[newIdx].id, container), 260);
        };

        detail.querySelector('.ai-news-detail-back').addEventListener('click', removeDetail);
        detail.querySelector('.ai-news-detail-overlay').addEventListener('click', removeDetail);

        const prevBtn = detail.querySelector('.ai-news-nav-prev');
        const nextBtn = detail.querySelector('.ai-news-nav-next');
        if (prevBtn) prevBtn.addEventListener('click', () => navigateInline('prev'));
        if (nextBtn) nextBtn.addEventListener('click', () => navigateInline('next'));

        // Swipe support
        let touchStartX = 0;
        detail.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        detail.addEventListener('touchend', (e) => {
            const diff = e.changedTouches[0].screenX - touchStartX;
            if (Math.abs(diff) > 60) {
                if (diff > 0) navigateInline('prev');
                else navigateInline('next');
            }
        }, { passive: true });
    }

    function emptyHtml(icon, title, text) { return emptyHTML(icon, title, text); }

    /* ---------------- Recently Played ---------------- */
    function getRecentlyPlayedSongs() {
        let history = [];
        try {
            if (window.ListeningHistory && ListeningHistory.getRecentlyPlayed) {
                history = ListeningHistory.getRecentlyPlayed() || [];
            } else if (window.DataStore) {
                history = DataStore.getHistory() || [];
            }
        } catch (e) { /* ignore */ }
        const all = publishedSongs();
        const out = [];
        (history || []).forEach(h => {
            if (!h) return;
            const match = all.find(s => String(s.id) === String(h.id) || String(s.songId) === String(h.id));
            if (match && match.audioUrl) out.push(match);
            else if (h.audioUrl) out.push(h);
            else if (h.streamUrl) out.push(h);
        });
        return out.slice(0, 12);
    }

    function songCardHTML(song, i) {
        const title = (song.title || song.name || 'Untitled').slice(0, 34);
        const artist = (song.artist || song.singer || 'Unknown Artist').slice(0, 30);
        const art = artOf(song) || ART_PLACEHOLDER;
        const dur = durationText(song.duration);
        return '<div class="ai-song-card" data-idx="' + i + '">' +
            '<div class="ai-song-art">' + (artOf(song) ? '<img src="' + escapeHtml(art) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
            '<i class="fa-solid fa-music"></i></div>' +
            '<div class="ai-song-body"><div class="ai-song-title" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</div>' +
            '<div class="ai-song-artist">' + escapeHtml(artist) + '</div>' +
            (dur ? '<div class="ai-song-dur"><i class="fa-regular fa-clock"></i>' + dur + '</div>' : '') +
            '</div></div>';
    }

    function renderRecentlyPlayed() {
        const row = $('aiRecentlyPlayed');
        if (!row) return;
        const items = getRecentlyPlayedSongs();
        if (!items.length) {
            row.innerHTML = emptyHTML('fa-solid fa-clock-rotate-left', 'No listening history yet',
                'Start playing songs and your recently played tracks will show up here.');
            return;
        }
        row.innerHTML = items.slice(0, 12).map((s, i) => songCardHTML(s, i)).join('');
        row.querySelectorAll('.ai-song-card').forEach(card => {
            card.addEventListener('click', () => {
                // Visual feedback: brief tapped animation
                card.classList.add('tapped');
                setTimeout(() => card.classList.remove('tapped'), 300);

                const i = parseInt(card.dataset.idx, 10);
                const song = items[i];
                if (!song) return;
                if (song.streamUrl && !song.audioUrl && typeof window.playStation === 'function') {
                    window.playStation(song.title || song.name || '');
                } else if (song.audioUrl && typeof window.playSong === 'function') {
                    window.playSong(song, items);
                } else {
                    showToastSafe('This track has no audio attached yet', 'info');
                }
            });
        });
    }

    /* ---------------- AI Recommendations ---------------- */
    // Cache the AI picks by content signature. Re-renders (e.g. storage-sync
    // or playback state events) must NOT reshuffle the section — it only
    // changes when the underlying library actually changes (admin publish).
    let _aiRecCacheSig = '';
    let _aiRecCache = null;
    function getAIRecSongs() {
        const all = publishedSongs();
        if (!all.length) return [];
        const sig = all.map(s => String(s.id || '') + '|' + String(s.audioUrl || s.streamUrl || '')).join('#');
        if (_aiRecCache && _aiRecCacheSig === sig) return _aiRecCache;
        let picks = null;
        try {
            if (window.ListeningHistory && ListeningHistory.getAIPicks) {
                const aiPicks = ListeningHistory.getAIPicks() || [];
                if (aiPicks.length) picks = aiPicks.slice(0, 6);
            }
        } catch (e) { /* ignore */ }
        if (!picks) {
            const played = new Set();
            try {
                const hist = (window.ListeningHistory && ListeningHistory.getRecentlyPlayed) ? ListeningHistory.getRecentlyPlayed() : [];
                (hist || []).forEach(h => played.add(String(h.id)));
            } catch (e) { /* ignore */ }
            const fresh = all.filter(s => !played.has(String(s.id)));
            const pool = fresh.length ? fresh : all;
            picks = pool.slice().sort(() => Math.random() - 0.5).slice(0, 6);
        }
        _aiRecCacheSig = sig;
        _aiRecCache = picks;
        return picks;
    }

    function renderAIRecommendations() {
        const wrap = $('aiRecSongs');
        const greet = $('aiRecGreeting');
        if (greet) {
            greet.innerHTML = '<small>AI Curated For You</small>';
        }
        if (!wrap) return;
        const songs = getAIRecSongs();
        if (!songs.length) {
            wrap.innerHTML = emptyHTML('fa-solid fa-wand-magic-sparkles', 'AI needs more music',
                'Add more songs so the AI can build your personal recommendations.');
            return;
        }
        wrap.innerHTML = songs.slice(0, 6).map((s, i) => {
            const title = (s.title || s.name || 'Untitled').slice(0, 30);
            const artist = (s.artist || s.singer || 'Unknown').slice(0, 28);
            const art = artOf(s) || ART_PLACEHOLDER;
            return '<div class="ai-rec-song" data-idx="' + i + '">' +
                '<div class="ai-rec-song-art">' + (artOf(s) ? '<img src="' + escapeHtml(art) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
                '<i class="fa-solid fa-music"></i></div>' +
                '<div class="ai-rec-song-info">' +
                '<div class="ai-rec-song-title">' + escapeHtml(title) + '</div>' +
                '<div class="ai-rec-song-artist">' + escapeHtml(artist) + '</div></div>' +
                '<button class="ai-play-btn force-show" aria-label="Play ' + escapeHtml(title) + '"><i class="fa-solid fa-play"></i></button>' +
                '</div>';
        }).join('');
        wrap.querySelectorAll('.ai-rec-song').forEach(card => {
            card.addEventListener('click', () => {
                const i = parseInt(card.dataset.idx, 10);
                const song = songs[i];
                if (song && typeof window.playSong === 'function') window.playSong(song, songs);
            });
        });
    }

    function bindDiscoverAI() {
        const btn = $('aiDiscoverBtn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (window.AIFeatures && typeof AIFeatures.openAICreator === 'function') {
                AIFeatures.openAICreator();
            } else if (window.AIMusicAssistant && typeof AIMusicAssistant.generateAIPlaylist === 'function') {
                try { AIMusicAssistant.generateAIPlaylist({}); } catch (e) { /* ignore */ }
            } else {
                showToastSafe('AI playlist builder is loading…', 'info');
            }
        });
    }

    /* ---------------- Sidebar ---------------- */
    const PAGE_TO_AI = { home: 'home', explore: 'explore', library: 'library', liked: 'liked', playlists: 'playlists', radio: 'live-fm', stations: 'live-fm', history: 'history' };
    const AI_TO_PAGE = { 'home': 'home', 'explore': 'explore', 'music': 'explore', 'live-fm': 'radio', 'news': 'radio', 'library': 'library', 'liked': 'liked', 'playlists': 'playlists' };

    function bindSidebar() {
        const items = document.querySelectorAll('.ai-sidebar-item[data-ai-page]');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.aiPage;
                if (target === 'assistant') {
                    if (typeof YTMusic !== 'undefined' && YTMusic.toggleAssistant) YTMusic.toggleAssistant();
                    else if (document.getElementById('ytmAiPanel')) document.getElementById('ytmAiPanel').classList.toggle('open');
                    return;
                }
                const page = AI_TO_PAGE[target];
                if (page && typeof YTMusic !== 'undefined' && YTMusic.navigateTo) {
                    YTMusic.navigateTo(page);
                    requestAnimationFrame(() => { try { window.scrollTo({ top: 0 }); } catch (e) { /* ignore */ } });
                } else if (target === 'news') {
                    newsSeeAllOpen();
                }
                setSidebarActive(target);
            });
        });
        const logo = $('aiSidebarLogo') || document.querySelector('.ai-sidebar-logo');
        if (logo) logo.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof YTMusic !== 'undefined' && YTMusic.navigateTo) YTMusic.navigateTo('home');
        });
        // premium upgrade
        const up = $('aiPremiumBtn') || $('aiUpgradeBtn');
        if (up) up.addEventListener('click', () => {
            try { window.location.href = 'profile.html'; } catch (e) { /* ignore */ }
        });
    }

    function setSidebarActive(aiPage) {
        document.querySelectorAll('.ai-sidebar-item[data-ai-page]').forEach(item => {
            const act = item.dataset.aiPage === aiPage;
            item.classList.toggle('active', act);
        });
    }

    /* ---------------- See All buttons ---------------- */
    function bindSeeAll() {
        document.querySelectorAll('.ai-see-all[data-ai-seeall]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.aiSeeall;
                // News "See All" opens a dedicated overlay with all news items
                if (target === 'news') { newsSeeAllOpen(); return; }
                const page = AI_TO_PAGE[target] || target;
                if (typeof YTMusic !== 'undefined' && YTMusic.navigateTo) {
                    YTMusic.navigateTo(page);
                    requestAnimationFrame(() => { try { window.scrollTo({ top: 0 }); } catch (e) { /* ignore */ } });
                }
            });
        });
    }

    function syncSidebar(page) {
        const aiPage = PAGE_TO_AI[page] || (page === 'home' ? 'home' : null);
        if (aiPage) setSidebarActive(aiPage);
    }

    function hookNavigation() {
        try {
            if (typeof YTMusic === 'undefined' || !YTMusic.navigateTo) return;
            const orig = YTMusic.navigateTo.bind(YTMusic);
            YTMusic.navigateTo = function (page, opts) {
                const res = orig(page, opts);
                syncSidebar(page);
                if (page === 'home') setTimeout(refreshHome, 250);
                return res;
            };
        } catch (e) { /* ignore */ }
    }

    /* ---------------- Dark mode toggle ---------------- */
    function bindDarkToggle() {
        const toggle = $('aiDarkToggle');
        if (!toggle) return;
        let light = false;
        try { light = localStorage.getItem('ai_theme_light') === '1'; } catch (e) { /* ignore */ }
        const apply = (on) => { document.body.classList.toggle('ai-light', on); };
        apply(light);
        toggle.addEventListener('click', () => {
            light = !light;
            apply(light);
            try { localStorage.setItem('ai_theme_light', light ? '1' : '0'); } catch (e) { /* ignore */ }
        });
    }

    /* ---------------- Header user ---------------- */
    function bindHeaderUser() {
        const chip = $('aiUserChip');
        const menu = $('aiUserMenu');
        if (chip && menu) {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = chip.classList.toggle('open');
                document.querySelectorAll('.ai-user-chip.open').forEach(c => { if (c !== chip) c.classList.remove('open'); });
                document.querySelectorAll('.ai-notif-btn.open').forEach(b => b.classList.remove('open'));
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.ai-user-chip')) chip.classList.remove('open');
            });
        }
        document.querySelectorAll('[data-ai-menu]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.aiMenu;
                if (action === 'profile') { window.location.href = 'profile.html'; }
                else if (action === 'settings') { if (typeof YTMusic !== 'undefined' && YTMusic.toggleSettingsPanel) YTMusic.toggleSettingsPanel(); }
                else if (action === 'dashboard') { if (typeof YTMusic !== 'undefined' && YTMusic.navigateTo) YTMusic.navigateTo('dashboard'); }
                else if (action === 'builder') {
                    const sess = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser() : null;
                    const isAdmin = !!sess || (localStorage.getItem('adminSession') ? true : false);
                    if (isAdmin) window.location.href = 'builder.html';
                    else window.location.href = 'admin-login.html';
                }
                else if (action === 'logout') { if (typeof window.logout === 'function') window.logout(); else if (typeof Auth !== 'undefined' && Auth.logout) Auth.logout(); }
                if (chip) chip.classList.remove('open');
            });
        });
        renderHeaderUser();
    }

    function renderHeaderUser() {
        let user = null;
        try { if (window.Auth && Auth.currentUser) user = Auth.currentUser(); } catch (e) { /* ignore */ }
        const nameEl = $('aiUserName');
        const planEl = $('aiUserPlan');
        const avatarEl = $('aiUserAvatar');
        const name = (user && (user.name || user.displayName)) || 'Guest';
        const initials = name.charAt(0).toUpperCase();
        if (nameEl) nameEl.textContent = 'Hi, ' + name.split(' ')[0];
        if (planEl) {
            const premium = !!(user && (user.premium || user.plan === 'premium'));
            planEl.innerHTML = (premium ? '<i class="fa-solid fa-crown"></i> Premium' : '<i class="fa-solid fa-crown" style="color:rgba(255,255,255,0.4);"></i> Free');
        }
        if (avatarEl) {
            const photo = (user && user.photoURL) || '';
            if (photo) avatarEl.innerHTML = '<img src="' + escapeHtml(photo) + '" alt="' + escapeHtml(name) + '">';
            else avatarEl.textContent = initials;
        }
        // Admin → show builder in menu
        let isAdmin = false;
        try { isAdmin = !!(user && (user.role === 'admin' || user.isAdmin)); } catch (e) { /* ignore */ }
        const builtBtn = document.getElementById('aiMenuBuilder');
        if (builtBtn) builtBtn.style.display = isAdmin ? '' : 'none';
    }

    /* ---------------- Notifications + Install ---------------- */
    let beforeInstallPrompt = null;
    function bindNotifications() {
        const btn = $('aiNotifBtn');
        const panel = $('aiNotifPanel');
        if (btn && panel) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.toggle('open');
                btn.classList.toggle('open', panel.classList.contains('open'));
                const chip = $('aiUserChip');
                if (chip) chip.classList.remove('open');
            });
            document.addEventListener('click', (e) => {
                if (btn && !e.target.closest('#aiNotifBtn') && !e.target.closest('#aiNotifPanel')) {
                    panel.classList.remove('open');
                    btn.classList.remove('open');
                }
            });
        }
        if (panel) {
            let notifications = [];
            try { notifications = (DataStore.getNotifications && DataStore.getNotifications()) || []; } catch (e) { /* ignore */ }
            const items = notifications.filter(n => n).slice(0, 4);
            panel.innerHTML = '<div class="ai-notif-head"><i class="fa-solid fa-bell"></i> Notifications</div>' +
                (items.length ? items.map(n => {
                    const t = n.title || n.message || 'Update';
                    const body = n.message && n.message !== t ? n.message : '';
                    const ic = (n.icon || 'fa-circle-info').replace('fa-', 'fa-solid fa-');
                    return '<div class="ai-notif-item"><div class="ai-notif-item-icon"><i class="' + ic + '"></i></div>' +
                        '<div><div class="ai-notif-item-title">' + escapeHtml(t) + '</div>' +
                        (body ? '<div class="ai-notif-item-time">' + escapeHtml(body) + '</div>' : '') +
                        '<div class="ai-notif-item-time">' + (n.time ? escapeHtml(n.time) : 'Now') + '</div></div></div>';
                }).join('') : '<div class="ai-notif-empty">No notifications yet.<br>You are all caught up! 🎉</div>');
        }
    }

    function bindInstall() {
        const btn = $('aiInstallBtn');
        if (!btn) return;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            beforeInstallPrompt = e;
            btn.style.display = '';
        });
        const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone) { btn.style.display = 'none'; return; }
        btn.addEventListener('click', async () => {
            if (beforeInstallPrompt) {
                beforeInstallPrompt.prompt();
                try { const r = await beforeInstallPrompt.userChoice; if (r.outcome === 'accepted') showToastSafe('App installed! 🎉', 'success'); } catch (e) { /* ignore */ }
                beforeInstallPrompt = null;
            } else {
                showToastSafe('Bookmark this page or use your browser menu to install the app', 'info');
            }
        });
    }

    /* ---------------- Search shortcut (Ctrl+/) ---------------- */
    function bindSearchShortcut() {
        const input = $('ytmSearchInput');
        document.addEventListener('keydown', (e) => {
            const mod = (e.ctrlKey || e.metaKey) && (e.key === '/' || e.code === 'Slash');
            if (!mod) return;
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
            e.preventDefault();
            if (input) {
                input.focus();
                try { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) { /* ignore */ }
            } else {
                if (typeof YTMusic !== 'undefined' && YTMusic.navigateTo) YTMusic.navigateTo('search');
            }
        });
    }

    /* ---------------- Bottom player enhancement ---------------- */
    function enhancePlayer() {
        let attempts = 0;
        const timer = setInterval(() => {
            const mini = document.getElementById('gp-mini');
            if (mini) {
                clearInterval(timer);
                injectPlayerExtras(mini);
            } else if (++attempts > 20) { clearInterval(timer); }
        }, 250);
    }

    function injectPlayerExtras(mini) {
        if (mini.querySelector('.ai-gp-extra')) return;
        const right = mini.querySelector('.gp-mini-right');
        if (!right) return;
        const extra = document.createElement('div');
        extra.className = 'ai-gp-extra';
        extra.innerHTML =
            '<div class="ai-gp-vol-wrap">' +
            '<button class="gp-btn ai-gp-vol-btn" id="aiGpVolBtn" title="Volume"><i class="fa-solid fa-volume-high"></i></button>' +
            '<div class="ai-gp-vol-slider"><input type="range" min="0" max="100" value="80" id="aiGpVolRange" aria-label="Volume"></div>' +
            '</div>' +
            '<button class="gp-btn ai-gp-queue-btn" id="aiGpQueueBtn" title="Queue"><i class="fa-solid fa-bars-staggered"></i><span class="ai-gp-queue-badge"></span></button>';
        right.appendChild(extra);

        const range = document.getElementById('aiGpVolRange');
        if (range) {
            const sync = () => {
                let v = 0.8;
                try {
                    if (window.PlayerEngine && PlayerEngine.volume !== undefined) v = PlayerEngine.volume;
                    else if (window.audioPlayer && window.audioPlayer.volume !== undefined) v = window.audioPlayer.volume;
                } catch (e) { /* ignore */ }
                range.value = Math.round(v * 100);
            };
            sync();
            range.addEventListener('input', () => {
                const v = parseInt(range.value, 10) / 100;
                try { if (window.PlayerEngine && PlayerEngine.setVolume) PlayerEngine.setVolume(v); } catch (e) { /* ignore */ }
                try { if (window.audioPlayer) window.audioPlayer.volume = v; } catch (e) { /* ignore */ }
                try { if (typeof window.setPlaybackVolume === 'function') window.setPlaybackVolume(v); } catch (e) { /* ignore */ }
            });
            document.addEventListener('volumechange', sync, true);
        }

        const qBtn = document.getElementById('aiGpQueueBtn');
        if (qBtn) qBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                if (window.GlobalPlayer && GlobalPlayer.toggleQueue) GlobalPlayer.toggleQueue();
                else if (typeof YTMusic !== 'undefined' && YTMusic.toggleQueuePanel) YTMusic.toggleQueuePanel();
            } catch (err) { /* ignore */ }
        });
    }

    /* ---------------- Decades by Era ---------------- */
    const DECADES = [
        { id: '80s', label: "80's", range: [1980, 1989], icon: 'fa-compact-disc', grad: 'linear-gradient(135deg,#f43f5e,#fb923c)', glow: 'rgba(244,63,94,0.3)' },
        { id: '90s', label: "90's", range: [1990, 1999], icon: 'fa-record-vinyl', grad: 'linear-gradient(135deg,#a855f7,#6366f1)', glow: 'rgba(168,85,247,0.3)' },
        { id: '2k', label: '2K', range: [2000, 2009], icon: 'fa-compact-disc', grad: 'linear-gradient(135deg,#3b82f6,#06b6d4)', glow: 'rgba(59,130,246,0.3)' },
        { id: 'new', label: 'New', range: [2010, 2099], icon: 'fa-headphones', grad: 'linear-gradient(135deg,#34d399,#10b981)', glow: 'rgba(52,211,153,0.3)' }
    ];

    let _decadeSongCache = {};
    let _decadeBotActive = false;
    let _decadeBotSongs = [];
    let _decadeBotIndex = 0;
    let _decadeBotDecadeId = '';
    let _decadeListEl = null;
    let _decadeListEscHandler = null;

    function getDecadeSongs(decade) {
        const key = decade.id;
        if (_decadeSongCache[key]) return _decadeSongCache[key];
        const all = publishedSongs();
        const [minY, maxY] = decade.range;
        const songs = all.filter(s => {
            const y = parseInt(s.year, 10);
            return !isNaN(y) && y >= minY && y <= maxY;
        });
        _decadeSongCache[key] = songs;
        return songs;
    }

    function renderDecadeCards() {
        const wrap = $('aiDecadeCards');
        if (!wrap) return;
        wrap.innerHTML = DECADES.map((d, i) => {
            const songs = getDecadeSongs(d);
            const count = songs.length;
            return '<div class="ai-decade-card" data-decade="' + d.id + '" style="--ai-decade-grad:' + d.grad + ';--ai-decade-glow:' + d.glow + ';">' +
                '<div class="ai-decade-icon"><i class="fas ' + d.icon + '"></i></div>' +
                '<div class="ai-decade-label">' + d.label + '</div>' +
                '<div class="ai-decade-count"><strong>' + count + '</strong> songs</div>' +
                '</div>';
        }).join('');
        wrap.querySelectorAll('.ai-decade-card').forEach(card => {
            card.addEventListener('click', () => {
                const decadeId = card.dataset.decade;
                const decade = DECADES.find(d => d.id === decadeId);
                if (decade) openDecadeList(decade);
            });
        });
    }

    function openDecadeList(decade) {
        closeDecadeList();
        const songs = getDecadeSongs(decade);
        if (!songs.length) {
            showToastSafe('No songs found for ' + decade.label, 'info');
            return;
        }
        const wrap = document.createElement('div');
        wrap.className = 'ai-decade-list';
        wrap.id = 'aiDecadeList';
        const autoActive = _decadeBotActive && _decadeBotDecadeId === decade.id;
        wrap.innerHTML =
            '<div class="ai-decade-list-overlay"></div>' +
            '<div class="ai-decade-list-panel">' +
            '<div class="ai-decade-list-header">' +
            '<button class="ai-decade-list-back" type="button"><i class="fa-solid fa-xmark"></i></button>' +
            '<h3><i class="fas ' + decade.icon + '"></i> ' + decade.label + ' Hits</h3>' +
            '<span class="ai-decade-list-count">' + songs.length + ' songs</span>' +
            '</div>' +
            '<div class="ai-decade-list-actions">' +
            '<button class="ai-decade-play-all-btn"><i class="fas fa-play" style="margin-left:2px;"></i> Play All</button>' +
            '<button class="ai-decade-auto-btn' + (autoActive ? ' active' : '') + '" data-auto="' + decade.id + '"><i class="fas fa-robot"></i> ' + (autoActive ? 'Auto-Playing' : 'Auto-Play') + '</button>' +
            '</div>' +
            '<div class="ai-decade-list-body">' +
            songs.map((s, i) => {
                const title = (s.title || s.name || 'Untitled').slice(0, 38);
                const artist = (s.artist || s.singer || '').slice(0, 30);
                const dur = durationText(s.duration);
                const songArt = artOf(s);
                const playing = typeof window.isSameActivePlayback === 'function' && window.isSameActivePlayback(s);
                return '<div class="ai-decade-song' + (playing ? ' playing-song' : '') + '" data-idx="' + i + '">' +
                    '<div class="ai-decade-song-num">' + (i + 1) + '</div>' +
                    '<div class="ai-decade-song-art">' +
                    (songArt ? '<img src="' + escapeHtml(songArt) + '" alt="" loading="lazy" onerror="this.remove()">' : '<i class="fa-solid fa-music"></i>') +
                    '</div>' +
                    '<div class="ai-decade-song-info">' +
                    '<div class="ai-decade-song-title">' + escapeHtml(title) + '</div>' +
                    '<div class="ai-decade-song-artist">' + escapeHtml(artist) + '</div>' +
                    '</div>' +
                    (dur ? '<div class="ai-decade-song-dur">' + dur + '</div>' : '') +
                    '</div>';
            }).join('') +
            '</div></div>';
        document.body.appendChild(wrap);
        _decadeListEl = wrap;
        document.body.classList.add('ai-playlist-detail-open');
        requestAnimationFrame(() => wrap.classList.add('open'));

        /* Play All */
        wrap.querySelector('.ai-decade-play-all-btn').addEventListener('click', () => {
            if (songs.length && typeof window.playSong === 'function') window.playSong(songs[0], songs);
        });

        /* Auto-Play Bot */
        wrap.querySelector('.ai-decade-auto-btn').addEventListener('click', () => {
            if (_decadeBotActive && _decadeBotDecadeId === decade.id) {
                stopDecadeBot();
            } else {
                startDecadeBot(decade, songs);
            }
            const btn = wrap.querySelector('.ai-decade-auto-btn');
            if (btn) {
                const isActive = _decadeBotActive && _decadeBotDecadeId === decade.id;
                btn.classList.toggle('active', isActive);
                btn.innerHTML = '<i class="fas fa-robot"></i> ' + (isActive ? 'Auto-Playing' : 'Auto-Play');
            }
        });

        /* Individual song clicks */
        wrap.querySelectorAll('.ai-decade-song').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.idx, 10);
                const song = songs[idx];
                if (song && typeof window.playSong === 'function') window.playSong(song, songs);
                // Update playing state in list
                wrap.querySelectorAll('.ai-decade-song').forEach(r => r.classList.remove('playing-song'));
                row.classList.add('playing-song');
            });
        });

        /* Close handlers */
        const closeList = () => closeDecadeList();
        wrap.querySelector('.ai-decade-list-back').addEventListener('click', closeList);
        wrap.querySelector('.ai-decade-list-overlay').addEventListener('click', closeList);
        _decadeListEscHandler = (e) => {
            if (e.key === 'Escape') closeList();
        };
        document.addEventListener('keydown', _decadeListEscHandler);
    }

    function closeDecadeList() {
        if (_decadeListEscHandler) {
            document.removeEventListener('keydown', _decadeListEscHandler);
            _decadeListEscHandler = null;
        }
        if (_decadeListEl) {
            _decadeListEl.classList.remove('open');
            const el = _decadeListEl;
            setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
            _decadeListEl = null;
        }
        document.body.classList.remove('ai-playlist-detail-open');
    }

    /* ---- Auto-Play Bot ---- */
    function startDecadeBot(decade, songs) {
        stopDecadeBot();
        if (!songs.length) return;
        _decadeBotActive = true;
        _decadeBotSongs = songs.slice();
        _decadeBotIndex = 0;
        _decadeBotDecadeId = decade.id;
        // Show bot status in section header
        const statusEl = $('aiDecadeBotStatus');
        if (statusEl) statusEl.style.display = '';
        const stopBtn = $('aiDecadeBotStop');
        if (stopBtn) stopBtn.addEventListener('click', stopDecadeBot);
        // Shuffle and play
        _decadeBotSongs.sort(() => Math.random() - 0.5);
        _decadeBotPlayCurrent();
        // Hook ended event for auto-advance
        if (window.audioPlayer && !window.audioPlayer._decadeBotHooked) {
            window.audioPlayer._decadeBotHooked = true;
            window.audioPlayer.addEventListener('ended', _decadeBotOnEnded);
        }
        showToastSafe('AI Bot: Playing ' + decade.label + ' hits continuously', 'success');
    }

    function stopDecadeBot() {
        _decadeBotActive = false;
        _decadeBotSongs = [];
        _decadeBotIndex = 0;
        _decadeBotDecadeId = '';
        const statusEl = $('aiDecadeBotStatus');
        if (statusEl) statusEl.style.display = 'none';
        if (window.audioPlayer && window.audioPlayer._decadeBotHooked) {
            window.audioPlayer.removeEventListener('ended', _decadeBotOnEnded);
            window.audioPlayer._decadeBotHooked = false;
        }
    }

    function _decadeBotPlayCurrent() {
        if (!_decadeBotActive || !_decadeBotSongs.length) return;
        if (_decadeBotIndex >= _decadeBotSongs.length) {
            // Loop: reshuffle and restart
            _decadeBotSongs.sort(() => Math.random() - 0.5);
            _decadeBotIndex = 0;
        }
        const song = _decadeBotSongs[_decadeBotIndex];
        if (!song) return;
        if (typeof window.playSong === 'function') window.playSong(song, _decadeBotSongs);
        _updateDecadeListPlaying(song);
        _updateMediaSessionForBot(song);
    }

    function _decadeBotOnEnded() {
        if (!_decadeBotActive) return;
        _decadeBotIndex++;
        // Brief delay for smooth transition
        setTimeout(() => {
            if (_decadeBotActive) _decadeBotPlayCurrent();
        }, 300);
    }

    function _updateDecadeListPlaying(song) {
        if (!_decadeListEl) return;
        const rows = _decadeListEl.querySelectorAll('.ai-decade-song');
        rows.forEach(r => {
            const idx = parseInt(r.dataset.idx, 10);
            const s = _decadeBotSongs[idx];
            r.classList.toggle('playing-song', s && s === song);
        });
    }

    function _updateMediaSessionForBot(song) {
        if (!('mediaSession' in navigator)) return;
        try {
            const title = song.title || song.name || 'Unknown';
            const artist = song.artist || song.singer || 'Tamil AI Stream';
            const artwork = song.thumbnail || song.albumCover || song.cover || '';
            const meta = { title, artist, album: 'Tamil AI Stream - Auto-Play' };
            if (artwork) meta.artwork = [{ src: artwork, sizes: '512x512', type: 'image/png' }];
            navigator.mediaSession.metadata = new MediaMetadata(meta);
            navigator.mediaSession.playbackState = 'playing';
            navigator.mediaSession.setActionHandler('play', () => { if (typeof window.resumePlayback === 'function') window.resumePlayback(); });
            navigator.mediaSession.setActionHandler('pause', () => { if (typeof window.pausePlayback === 'function') window.pausePlayback(); });
            navigator.mediaSession.setActionHandler('stop', () => { stopDecadeBot(); if (typeof window.pausePlayback === 'function') window.pausePlayback(); });
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                if (_decadeBotActive) { _decadeBotIndex++; _decadeBotPlayCurrent(); }
                else if (typeof window.playNextTrack === 'function') window.playNextTrack();
            });
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                if (_decadeBotActive) { _decadeBotIndex = Math.max(0, _decadeBotIndex - 1); _decadeBotPlayCurrent(); }
                else if (typeof window.playPreviousTrack === 'function') window.playPreviousTrack();
            });
        } catch (e) { /* ignore */ }
    }

    /* ---- Sync decade list playing state with audio events ---- */
    function syncDecadeListPlaying() {
        if (!_decadeListEl || !_decadeBotActive) return;
        const track = window.currentPlaybackTrack;
        if (track) _updateDecadeListPlaying(track);
    }

    /* ---------------- Refresh + init ---------------- */
    function refreshHome() {
        stopHeroTimer();
        // Greeting hero bar sits at the top of Home. Idempotent — builds once,
        // then only updates greeting/date/quote text in place.
        if (typeof renderGreetingSection === 'function') renderGreetingSection();
        renderMusicHero();
        renderTrendingPlaylists();
        renderLiveFm();
        renderLiveNews();
        renderRecentlyPlayed();
        renderAIRecommendations();
        renderDecadeCards();
        bindHeroPlay();
        bindDiscoverAI();
        syncFmPlaying();
    }

    function bindDataSync() {
        const refresh = () => setTimeout(refreshHome, 300);
        window.addEventListener('storage-sync', refresh);
        window.addEventListener('premium-sections-sync', refresh);
        window.addEventListener('tamilAIStream-content-synced', refresh);
        // Only re-render when actual shared CONTENT changed. Playback state
        // (tamilAIStream_player_state) is written continuously while a song
        // plays and must NOT cause the Home sections to re-render/reshuffle.
        const contentKeys = [
            'tamilAIStream_songs', 'tamilAIStream_stations',
            'tamilAIStream_categories', 'tamilAIStream_featured',
            'tamilAIStream_trending', 'tamilAIStream_artistHits',
            'tamilAIStream_quotes', 'tamilAIStream_siteSettings',
            'tamilAIStream_images', 'tamilAIStream_moviesCollections',
            'tamilAIStream_yearlyCollections', 'tamilAIStream_latestCollections',
            'tamilAIStream_musicCollections', 'tamilAIStream_advertisements',
            'tamilAIStream_moods', 'tamilAIStream_aiRadio',
            'tamilAIStream_splash', 'tamilAIStream_playerPrefs',
            'tamilAIStream_navigation', 'tamilAIStream_sectionsOrder',
            'tamilAIStream_miniPlayerSettings'
        ];
        window.addEventListener('storage', (e) => {
            if (e.key && contentKeys.indexOf(e.key) !== -1) refresh();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) setTimeout(syncFmPlaying, 200);
        });
    }

    function init() {
        refreshHome();
        bindHeroPlay();
        bindDiscoverAI();
        bindSidebar();
        bindSeeAll();
        bindDarkToggle();
        bindHeaderUser();
        bindNotifications();
        bindInstall();
        bindSearchShortcut();
        bindPlaybackHooks();
        hookNavigation();
        bindDataSync();
        enhancePlayer();
        if (typeof YTMusic !== 'undefined') syncSidebar(YTMusic.currentPage || 'home');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { init, refreshHome, renderLiveFm, syncFmPlaying, renderDecadeCards, stopDecadeBot };
})();