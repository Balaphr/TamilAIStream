'use strict';
/* ============================================================
   AIHome â€” Reference-Based Premium Home Page
   Renders all new Home sections from EXISTING production data
   (DataStore / ListeningHistory / PlaylistManager / AI systems)
   and wires the sidebar, header and full-width bottom player.
   Never replaces the audio engine â€” it drives the same
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

    // Player-section visibility/rotation config from Builder
    // (Player Settings → Player Sections → saved in playerPrefs.sections).
    function playerSections() {
        try {
            const p = window.DataStore ? DataStore.getPlayerPrefs() : {};
            return (p && p.sections) || {};
        } catch (e) { return {}; }
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
        const infoRow = $('aiHeroInfoRow');
        if (!body) return;
        const songs = publishedSongs();
        heroSlides = songs.length ? songs.slice(0, 10) : [];
        if (!heroSlides.length) {
            body.style.background = stationColorFallback();
            body.innerHTML = '<i class="fa-solid fa-music"></i>';
            if (infoRow) infoRow.style.display = 'none';
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

        // Skip if same image â€” avoids re-downloading
        const currentArt = layerActive.style.backgroundImage || '';
        if (art && currentArt.includes(art)) return;

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
        // Update new hero info row
        const infoRow = $('aiHeroInfoRow');
        const songNameEl = $('aiHeroSongName');
        const movieNameEl = $('aiHeroMovieName');
        const playBtn = $('aiHeroPlayBtn');
        if (infoRow) infoRow.style.display = 'flex';
        if (songNameEl) songNameEl.textContent = song.title || 'Tamil Music';
        if (movieNameEl) movieNameEl.textContent = song.movie || song.album || 'â€”';
        if (playBtn) {
            playBtn.onclick = () => {
                const songs = publishedSongs();
                if (!songs.length) { showToastSafe('No songs available yet', 'info'); return; }
                const start = Math.min(heroIdx, songs.length - 1);
                if (typeof window.playSong === 'function') window.playSong(songs[start], songs);
                else showToastSafe('Ready to play: ' + songs[start].title, 'info');
            };
        }
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
        // Rotation is Builder-configurable (Player Settings → Player Sections).
        // Default: every 20s. Skips hidden/unfocused tabs — zero wasted battery/data.
        let secs = 20;
        try {
            const sec = playerSections();
            if (sec.heroAutoRotate === false) return;
            if (sec.heroInterval >= 5) secs = sec.heroInterval;
        } catch (e) { /* defaults */ }
        heroTimer = setInterval(() => {
            if (!document.hidden && document.hasFocus()) transitionHeroSlide(heroIdx + 1);
        }, secs * 1000);
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
            const name = (s.name || 'FM Station');
            const displayName = name.length > 26 ? name.slice(0, 26) + 'â€¦' : name;
            const freq = s.freq ? s.freq + ' FM' : 'FM';
            const lc = s.city || 'Chennai';
            const listeners = s.listeners || 0;
            const lText = listeners >= 1000 ? (listeners / 1000).toFixed(1) + 'K' : String(listeners);
            const thumb = stationThumb(s);
            return '<div class="ai-fm-card" data-station-id="' + escapeHtml(s.id || '') + '" data-station="' + escapeHtml(name) + '">' +
                '<div class="ai-fm-art" style="background:' + stationColor(s, i) + ';">' +
                '<span class="ai-fm-live-badge"><span class="ai-live-dot" style="box-shadow:none;animation:none;"></span>LIVE</span>' +
                (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="" loading="lazy" onerror="this.remove()">' : '<i class="fa-solid fa-tower-broadcast"></i>') +
                '</div>' +
                '<div class="ai-fm-info">' +
                '<div class="ai-fm-name">' + escapeHtml(displayName) + '</div>' +
                '<div class="ai-fm-meta"><span class="ai-fm-freq">' + escapeHtml(freq) + '</span><span>' + escapeHtml(lc) + '</span></div>' +
                '<div class="ai-fm-wave"><span></span><span></span><span></span><span></span><span></span></div>' +
                '</div>' +
                '<button class="ai-fm-play-btn" aria-label="Play ' + escapeHtml(name) + '"><i class="fa-solid fa-play" style="margin-left:2px;"></i></button>' +
                '</div>';
        }).join('');
        grid.querySelectorAll('.ai-fm-card').forEach(card => {
            const btn = card.querySelector('.ai-fm-play-btn');
            const stationId = card.dataset.stationId;
            const stationName = card.dataset.station;
            if (btn) btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!stationName) return;
                if (typeof window.toggleStationFromCard === 'function') {
                    window.toggleStationFromCard(card, stationName, stationId);
                } else if (typeof window.playStation === 'function') {
                    window.playStation(stationName, stationId);
                }
                setTimeout(syncFmPlaying, 120);
            });
            card.addEventListener('click', () => {
                if (!stationName) return;
                if (typeof window.toggleStationFromCard === 'function') {
                    window.toggleStationFromCard(card, stationName, stationId);
                } else if (typeof window.playStation === 'function') {
                    window.playStation(stationName, stationId);
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


    /* ---------------- Evergreen Classics ---------------- */
    function renderEvergreen() {
        const grid = $('aiEvergreenGrid');
        if (!grid) return;
        const songs = publishedSongs();
        // Filter for evergreen songs (older songs, or songs tagged as evergreen/classic)
        const evergreen = songs
            .filter(s => s && (s.status === 'published' || s.status === 'active'))
            .filter(s => {
                // Consider songs as evergreen if they have mood/genre like 'classic', 'old', 'evergreen', 'retro'
                // or if they are from older movies (pre-2010) - we'll use a simple heuristic
                const genre = (s.genre || s.mood || '').toLowerCase();
                const isClassicTag = genre.includes('classic') || genre.includes('evergreen') || genre.includes('retro') || genre.includes('old');
                // Also include songs from older eras (pre-2010) based on movie/year if available
                return isClassicTag;
            })
            .sort((a, b) => (b.plays || 0) - (a.plays || 0)) // Sort by popularity
            .slice(0, 12);

        if (!evergreen.length) {
            // Fallback: show oldest published songs as evergreen classics
            const fallback = songs
                .filter(s => s && (s.status === 'published' || s.status === 'active'))
                .sort((a, b) => new Date(a.createdAt || a.uploadedAt || 0) - new Date(b.createdAt || b.uploadedAt || 0))
                .slice(0, 12);
            if (!fallback.length) {
                grid.innerHTML = emptyHTML('fa-solid fa-gem', 'No Evergreen Classics yet',
                    'Add classic Tamil songs from the Builder and they will appear here.');
                return;
            }
            grid.innerHTML = fallback.map((s, i) => songCardHTML(s, i)).join('');
            grid.querySelectorAll('.ai-song-card').forEach(card => {
                card.addEventListener('click', () => {
                    const i = parseInt(card.dataset.idx, 10);
                    const song = fallback[i];
                    if (!song) return;
                    if (song.streamUrl && !song.audioUrl && typeof window.playStation === 'function') {
                        window.playStation(song.title || song.name || '');
                    } else if (song.audioUrl && typeof window.playSong === 'function') {
                        window.playSong(song, fallback);
                    } else {
                        showToastSafe('This track has no audio attached yet', 'info');
                    }
                });
            });
            return;
        }

        grid.innerHTML = evergreen.map((s, i) => songCardHTML(s, i)).join('');
        grid.querySelectorAll('.ai-song-card').forEach(card => {
            card.addEventListener('click', () => {
                const i = parseInt(card.dataset.idx, 10);
                const song = evergreen[i];
                if (!song) return;
                if (song.streamUrl && !song.audioUrl && typeof window.playStation === 'function') {
                    window.playStation(song.title || song.name || '');
                } else if (song.audioUrl && typeof window.playSong === 'function') {
                    window.playSong(song, evergreen);
                } else {
                    showToastSafe('This track has no audio attached yet', 'info');
                }
            });
        });
    }

    /* ---------------- One Tap Radio ---------------- */
    // Lightweight radio engine. Builds a category queue from the LOCAL
    // DataStore (zero network on load), shuffles it, and hands it to the
    // existing window.playSong() engine — script.js auto-advances the queue
    // on 'ended' and loops infinitely via playNextTrack(). No new audio
    // element, no polling, no playlist downloads.
    const OTR_MODES = {
        love: {
            label: 'Love Radio',
            match: (s) => /love|romance|romantic|kadhal|kadhalik|kaadhal/.test(((s.genre || '') + ' ' + (s.mood || '') + ' ' + (s.title || '')).toLowerCase())
        },
        melody: {
            label: 'Melody Radio',
            match: (s) => /melody|melodious|soft/.test(((s.genre || '') + ' ' + (s.mood || '')).toLowerCase())
        },
        '90s': {
            label: '90s Radio',
            match: (s) => s.decade === '90s' || /^199\d$/.test(String(s.year || '')) || /\b(199[0-9])\b/.test(String(s.movie || '') + ' ' + String(s.album || ''))
        },
        evergreen: {
            label: 'Evergreen Radio',
            match: (s) => /classic|evergreen|retro|old(?:\s|$|-)/.test(((s.genre || '') + ' ' + (s.mood || '')).toLowerCase()) || s.decade === '80s' || /^19[5-8]\d$/.test(String(s.year || ''))
        },
        latest: { label: 'Latest Radio', match: null } // sorted newest-first
    };

    let _otrActive = false;
    let _otrMode = '';
    let _otrQueueRef = null;
    let _otrHooked = false;

    function otrShuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
    }

    function otrBuildQueue(mode) {
        const cfg = OTR_MODES[mode];
        if (!cfg) return [];
        // Only songs with real audio — metadata comes from local DataStore,
        // so building the queue costs zero network requests.
        let pool = publishedSongs().filter(s => s && (s.audioUrl || s.src));
        let matched = cfg.match ? pool.filter(cfg.match) : [];
        if (mode === 'latest') {
            matched = pool.slice().sort((a, b) =>
                new Date(b.createdAt || b.uploadedAt || 0) - new Date(a.createdAt || a.uploadedAt || 0));
        }
        // Fallback: never leave a tap dead — relax to full library shuffled
        if (!matched.length) matched = pool;
        return otrShuffle(matched.slice(0, 60)); // cap queue size — light on RAM
    }

    function startRadio(mode) {
        const cfg = OTR_MODES[mode];
        if (!cfg) return;
        const queue = otrBuildQueue(mode);
        if (!queue.length) { showToastSafe('No playable songs in the library yet', 'info'); return; }
        _otrActive = true;
        _otrMode = mode;
        _otrQueueRef = queue;
        ensureOtrHooks();
        // Existing global engine handles playback, queue advance, Next/Prev,
        // GlobalPlayer/mini-player sync and MediaSession — one audio element.
        if (typeof window.playSong === 'function') {
            window.playSong(queue[0], queue);
        }
        updateOtrUI();
    }

    function stopRadioState() {
        _otrActive = false;
        _otrMode = '';
        _otrQueueRef = null;
        updateOtrUI();
    }

    // Returns the live playback queue (script.js declares it as a top-level
    // let — a global lexical binding, not a window property).
    function otrLiveQueue() {
        try { return typeof currentPlaybackQueue !== 'undefined' ? currentPlaybackQueue : null; }
        catch (e) { return null; }
    }

    function updateOtrUI() {
        // Radio is only "active" while its own queue is still the live queue
        if (_otrActive && otrLiveQueue() !== _otrQueueRef) stopRadioState();
        const chip = $('otrNowChip');
        const chipText = $('otrNowText');
        const playing = !!(_otrActive && window.isStreamPlaying);
        document.querySelectorAll('.otr-card').forEach(card => {
            card.classList.toggle('active', playing && card.dataset.otr === _otrMode);
        });
        if (chip) {
            chip.style.display = playing ? '' : 'none';
            if (playing && chipText) chipText.textContent = OTR_MODES[_otrMode]?.label + ' • Now Playing';
        }
    }

    // Bind global hooks exactly once — error-skip + play-state sync
    function ensureOtrHooks() {
        if (_otrHooked) return;
        _otrHooked = true;
        // Skip failed tracks and keep the radio running
        document.addEventListener('error', (e) => {
            const ap = window.audioPlayer;
            if (!ap || e.target !== ap) return;
            if (!_otrActive || otrLiveQueue() !== _otrQueueRef) return;
            showToastSafe('Skipping unavailable track…', 'warning');
            setTimeout(() => {
                if (_otrActive && typeof window.playNextTrack === 'function') window.playNextTrack();
            }, 120);
        }, true);
        // Keep card highlight + Now Playing chip in sync with real playback
        document.addEventListener('play', (e) => {
            if (e.target === window.audioPlayer) setTimeout(updateOtrUI, 80);
        }, true);
        document.addEventListener('pause', (e) => {
            if (e.target === window.audioPlayer) setTimeout(updateOtrUI, 80);
        }, true);
        window.addEventListener('ytm:playTrack', () => setTimeout(updateOtrUI, 100));
    }

    function renderOneTapRadio() {
        const section = document.querySelector('.one-tap-radio');
        if (section && playerSections().oneTapRadio === false) { section.style.display = 'none'; return; }
        const row = $('otrRow');
        if (!row || row.dataset.bound === '1') return;
        row.dataset.bound = '1';
        row.querySelectorAll('.otr-card').forEach(card => {
            card.addEventListener('click', () => startRadio(card.dataset.otr));
        });
        ensureOtrHooks();
        updateOtrUI();
    }

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
    // or playback state events) must NOT reshuffle the section â€” it only
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
                showToastSafe('AI playlist builder is loadingâ€¦', 'info');
            }
        });
    }

    /* ---------------- Sidebar ---------------- */
    const PAGE_TO_AI = { home: 'home', explore: 'explore', library: 'library', liked: 'liked', playlists: 'playlists', radio: 'live-fm', stations: 'live-fm', history: 'history' };
    const AI_TO_PAGE = { 'home': 'home', 'explore': 'explore', 'music': 'explore', 'live-fm': 'radio', 'evergreen': 'explore', 'library': 'library', 'liked': 'liked', 'playlists': 'playlists' };

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
        // Admin â†’ show builder in menu
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
                }).join('') : '<div class="ai-notif-empty">No notifications yet.<br>You are all caught up! ðŸŽ‰</div>');
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
                try { const r = await beforeInstallPrompt.userChoice; if (r.outcome === 'accepted') showToastSafe('App installed! ðŸŽ‰', 'success'); } catch (e) { /* ignore */ }
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
            // Primary: use the explicit 'decade' field (e.g. '80s', '90s', '2k', 'new')
            if (s.decade === decade.id) return true;
            // Fallback: derive from 'year' field
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

    /* ---------------- Favourite Songs Section ---------------- */
    let _favBotActive = false;
    let _favBotSongs = [];
    let _favBotIndex = 0;

    function renderFavoritesSection() {
        const section = $('aiFavoritesSection');
        const list = $('aiFavList');
        if (!section || !list) return;
        const favs = DataStore.getFavorites ? DataStore.getFavorites() : [];
        if (!favs.length) {
            section.style.display = 'none';
            return;
        }
        section.style.display = '';
        const playAllBtn = $('aiFavPlayAllBtn');
        const autoBtn = $('aiFavAutoBtn');
        if (playAllBtn) playAllBtn.style.display = '';
        if (autoBtn) {
            autoBtn.style.display = '';
            const isActive = _favBotActive;
            autoBtn.classList.toggle('active', isActive);
            autoBtn.innerHTML = '<i class="fas fa-robot"></i> ' + (isActive ? 'Auto-Playing' : 'Auto-Play');
        }

        list.innerHTML = favs.map((s, i) => {
            const title = (s.title || s.name || 'Untitled').slice(0, 38);
            const artist = (s.artist || s.singer || '').slice(0, 30);
            const dur = s.duration || '';
            const songArt = s.albumCover || s.cover || s.thumbnail || '';
            const playing = typeof window.isSameActivePlayback === 'function' && window.isSameActivePlayback(s);
            return '<div class="ai-decade-song' + (playing ? ' playing-song' : '') + '" data-idx="' + i + '">' +
                '<div class="ai-decade-song-num">' + (i + 1) + '</div>' +
                '<div class="ai-decade-song-art">' +
                (songArt ? '<img src="' + escapeHtml(songArt) + '" alt="" loading="lazy" onerror="this.remove()">' : '<i class="fa-solid fa-heart"></i>') +
                '</div>' +
                '<div class="ai-decade-song-info">' +
                '<div class="ai-decade-song-title">' + escapeHtml(title) + '</div>' +
                '<div class="ai-decade-song-artist">' + escapeHtml(artist) + '</div>' +
                '</div>' +
                (dur ? '<div class="ai-decade-song-dur">' + dur + '</div>' : '') +
                '</div>';
        }).join('');

        // Play All
        if (playAllBtn) {
            playAllBtn.onclick = () => {
                if (favs.length && typeof window.playSong === 'function') window.playSong(favs[0], favs);
            };
        }

        // Auto-Play
        if (autoBtn) {
            autoBtn.onclick = () => {
                if (_favBotActive) {
                    stopFavBot();
                } else {
                    startFavBot(favs);
                }
                const isActive = _favBotActive;
                autoBtn.classList.toggle('active', isActive);
                autoBtn.innerHTML = '<i class="fas fa-robot"></i> ' + (isActive ? 'Auto-Playing' : 'Auto-Play');
            };
        }

        // Individual song clicks
        list.querySelectorAll('.ai-decade-song').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.idx, 10);
                const song = favs[idx];
                if (song && typeof window.playSong === 'function') window.playSong(song, favs);
                list.querySelectorAll('.ai-decade-song').forEach(r => r.classList.remove('playing-song'));
                row.classList.add('playing-song');
            });
        });

        // Bot status stop button
        const botStop = $('aiFavBotStop');
        if (botStop) {
            botStop.addEventListener('click', () => {
                stopFavBot();
                if (autoBtn) {
                    autoBtn.classList.remove('active');
                    autoBtn.innerHTML = '<i class="fas fa-robot"></i> Auto-Play';
                }
            });
        }
    }

    function startFavBot(favs) {
        stopFavBot();
        _favBotActive = true;
        _favBotSongs = [...favs];
        _favBotIndex = 0;
        _favBotSongs.sort(() => Math.random() - 0.5);
        _favBotPlayCurrent();
        // Hook ended event for auto-advance
        if (window.audioPlayer && !window.audioPlayer._favBotHooked) {
            window.audioPlayer._favBotHooked = true;
            window.audioPlayer.addEventListener('ended', _favBotOnEnded);
        }
        const status = $('aiFavBotStatus');
        if (status) status.style.display = '';
    }

    function stopFavBot() {
        _favBotActive = false;
        _favBotSongs = [];
        _favBotIndex = 0;
        if (window.audioPlayer && window.audioPlayer._favBotHooked) {
            window.audioPlayer.removeEventListener('ended', _favBotOnEnded);
            window.audioPlayer._favBotHooked = false;
        }
        const status = $('aiFavBotStatus');
        if (status) status.style.display = 'none';
    }

    function _favBotPlayCurrent() {
        if (!_favBotActive || !_favBotSongs.length) return;
        if (_favBotIndex >= _favBotSongs.length) {
            _favBotSongs.sort(() => Math.random() - 0.5);
            _favBotIndex = 0;
        }
        const song = _favBotSongs[_favBotIndex];
        if (song && typeof window.playSong === 'function') {
            window.playSong(song, _favBotSongs);
        }
        // Update playing state in list
        const list = $('aiFavList');
        if (list) {
            list.querySelectorAll('.ai-decade-song').forEach((r, i) => {
                r.classList.toggle('playing-song', i === _favBotIndex);
            });
        }
    }

    function _favBotOnEnded() {
        if (!_favBotActive) return;
        _favBotIndex++;
        setTimeout(() => {
            if (_favBotActive) _favBotPlayCurrent();
        }, 300);
    }

    /* ---------------- Refresh + init ---------------- */
    let _raScrollRaf = null;
    let _raPaused = false;
    let _raInView = true; // IntersectionObserver: only animate when visible
    let _raIoBound = false;
    let _raSpeed = 0.4; // pixels per frame (~24px/sec at 60fps)
    let _raTrackBound = false; // prevent duplicate event listeners

    function renderRecentlyAdded() {
        const section = document.getElementById('recentlyAddedSection');
        const track = document.getElementById('recentlyAddedTrack');
        if (!section || !track) return;
        if (playerSections().recentlyAdded === false) { section.style.display = 'none'; return; }

        // Stop any existing scroll animation
        if (_raScrollRaf) { cancelAnimationFrame(_raScrollRaf); _raScrollRaf = null; }

        let songs = [];
        try { songs = DataStore.getSongs() || []; } catch (e) { return; }
        songs = songs.filter(s => s && (s.status === 'published' || s.status === 'active'));
        songs.sort((a, b) => new Date(b.createdAt || b.uploadedAt || 0) - new Date(a.createdAt || a.uploadedAt || 0));
        const recent = songs.slice(0, 12);
        if (!recent.length) { section.style.display = 'none'; return; }

        section.style.display = 'block';
        const items = recent.concat(recent);
        track.innerHTML = items.map((s, i) => {
            const art = s.albumCover || s.thumbnail || s.artwork || '';
            const name = (s.title || 'Untitled').slice(0, 30);
            const artist = (s.artist || s.movie || '').slice(0, 28);
            const artStyle = art ? `background-image:url('${art}')` : '';
            const isNew = i < recent.length;
            return `<div class="ra-song-card" data-song-id="${s.id}" onclick="if(typeof playSongById==='function')playSongById('${s.id}')">
                <div class="ra-song-art" style="${artStyle}">${isNew ? '<span class="ra-song-new">NEW</span>' : ''}</div>
                <button class="ra-song-play" onclick="event.stopPropagation();if(typeof playSongById==='function')playSongById('${s.id}')"><i class="fas fa-play"></i></button>
                <div class="ra-song-name">${name}</div>
                <div class="ra-song-artist">${artist}</div>
            </div>`;
        }).join('');

        // Reset scroll position
        track.scrollLeft = 0;
        _raPaused = false;

        // Bind pause/resume events only once
        if (!_raTrackBound) {
            _raTrackBound = true;
            // Battery/CPU: only run the RAF loop while the section is on screen
            if (typeof IntersectionObserver !== 'undefined') {
                new IntersectionObserver((entries) => {
                    _raInView = entries[0] && entries[0].isIntersecting;
                }, { rootMargin: '80px' }).observe(section);
            }
            // Pause on touch
            track.addEventListener('touchstart', () => { _raPaused = true; }, { passive: true });
            track.addEventListener('touchend', () => { setTimeout(() => { _raPaused = false; }, 800); }, { passive: true });
            track.addEventListener('touchcancel', () => { setTimeout(() => { _raPaused = false; }, 800); }, { passive: true });

            // Pause on mouse hover
            track.addEventListener('mouseenter', () => { _raPaused = true; });
            track.addEventListener('mouseleave', () => { _raPaused = false; });

            // Pause when user manually drags
            let dragging = false;
            track.addEventListener('mousedown', () => { dragging = true; _raPaused = true; });
            track.addEventListener('mouseup', () => { dragging = false; setTimeout(() => { _raPaused = false; }, 1200); });
            track.addEventListener('mousemove', (e) => { if (dragging) e.preventDefault(); });

            // Pause when tab is hidden (save CPU/battery)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) _raPaused = true;
                else setTimeout(() => { _raPaused = false; }, 500);
            });
        }

        // Auto-scroll loop
        const tick = () => {
            if (!track || !track.isConnected) { _raScrollRaf = null; return; }
            if (!_raPaused && _raInView) {
                track.scrollLeft += _raSpeed;
                if (track.scrollLeft >= track.scrollWidth / 2) {
                    track.scrollLeft = 0;
                }
            }
            _raScrollRaf = requestAnimationFrame(tick);
        };
        _raScrollRaf = requestAnimationFrame(tick);
    }

    function refreshHome() {
        stopHeroTimer();
        // Clear decade song cache so newly assigned songs appear
        _decadeSongCache = {};
        // Greeting section removed per design — home starts with One Tap Radio.
        renderOneTapRadio();
        renderRecentlyAdded();
        renderMusicHero();
        renderTrendingPlaylists();
        renderLiveFm();
        renderEvergreen();
        renderRecentlyPlayed();
        renderAIRecommendations();
        renderFavoritesSection();
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
