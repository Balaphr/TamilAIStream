'use strict';
/* ============================================================
   TamilAI.Stream — Premium Landing & Radio Experience
   Enhances the existing UI: hero entrance, 3-dot menu,
   dedicated Radio page (all FM stations), and FM state sync.
   It does NOT replace the existing player/FM engine — it
   drives the same window.playStation/toggleStationFromCard path.
   ============================================================ */

const TamilAIPremium = (function () {
    const isPreview = !!window.__BUILDER_PREVIEW__;

    /* ------------------ helpers ------------------ */
    function $(id) { return document.getElementById(id); }
    function stationName(node) {
        const el = node && node.querySelector ? node.querySelector('h3, h4') : null;
        return (el && el.textContent) ? el.textContent.trim() : '';
    }
    function activeStations() {
        if (typeof DataStore === 'undefined') return [];
        try {
            return (DataStore.getStations() || []).filter(s => s && s.status === 'active');
        } catch (e) { return []; }
    }
    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function thumbOf(station) {
        return station.thumbnail || station.cover || station.image ||
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%230d1118'/%3E%3Ccircle cx='100' cy='100' r='64' fill='%2334d399' opacity='0.28'/%3E%3Ccircle cx='100' cy='100' r='40' fill='%2334d399' opacity='0.4'/%3E%3Cpath d='M88 78 L88 128 L124 103 Z' fill='%2334d399' opacity='0.55'/%3E%3C/svg%3E";
    }
    function freqLabel(station) {
        return station.freq ? station.freq + ' FM' : 'FM';
    }
    function genreOf(station) {
        return (station.genre || 'Music').trim().toLowerCase();
    }

    /* ------------------ hero ------------------ */
    let heroCanvasCtx = null;
    function initHeroParticles() {
        // Particles removed — static premium AI background is used instead.
        // This function is kept as a no-op to avoid breaking callers.
    }

    function updateHeroStats() {
        const stCount = activeStations().length;
        const songCountEl = $('premiumHeroSongCount');
        const stCountEl = $('premiumHeroStationCount');
        let songs = 0;
        if (typeof DataStore !== 'undefined') {
            try { songs = (DataStore.getSongs() || []).filter(s => s && s.status === 'published').length; } catch (e) {}
        }
        if (stCountEl) stCountEl.textContent = (stCount > 0 ? stCount : 50) + '+';
        if (songCountEl) songCountEl.textContent = (songs > 0 ? songs : 500) + '+';
    }

    function syncHeroState() {
        const hero = $('premiumHero');
        if (!hero) return;
        const hasTrack = !!(window.currentStation || (window.currentPlaybackTrack && window.currentPlaybackTrack.streamUrl));
        const playing = !isPreview && window.isStreamPlaying === true;
        hero.classList.toggle('paused', !!hasTrack && !playing);
        const eq = $('premiumHeroEq');
        if (eq) { eq.style.opacity = playing ? '1' : '0.45'; }
    }

    /* ------------------ 3-dot menu (removed — replaced by sidebar) ------------------ */
    function bindKebabMenu() {
        // Kebab menu removed — navigation now uses the premium sidebar.
    }

    // Onboarding removed — users go directly to login page
    function initOnboarding() {
        // Onboarding overlay removed from DOM — no-op
        return;
    }

    /* ------------------ Radio page ------------------ */
    let _radioFilter = 'all';

    function radioCardHTML(station) {
        const g = station.gradient || 'linear-gradient(135deg,#0f3b2e,#064e3b)';
        const listeners = (station.listeners || 0);
        return `
            <div class="premium-radio-card" data-name="${escapeHtml(station.name)}" data-genre="${escapeHtml(genreOf(station))}">
                <div class="premium-radio-art" style="background:${escapeHtml(g)};">
                    <img src="${escapeHtml(thumbOf(station))}" alt="${escapeHtml(station.name)}" loading="lazy">
                    <span class="premium-radio-live">LIVE</span>
                    <span class="premium-radio-freq">${escapeHtml(freqLabel(station))}</span>
                    <i class="fas fa-play premium-radio-play" aria-hidden="true"></i>
                </div>
                <div class="premium-radio-body">
                    <h4>${escapeHtml(station.name)}</h4>
                    <div class="premium-radio-meta">${escapeHtml(freqLabel(station))} · ${escapeHtml(station.genre || 'Music')}</div>
                    <div class="premium-radio-tags">
                        ${station.city ? `<span class="premium-radio-tag"><i class="fas fa-location-dot"></i>${escapeHtml(station.city)}</span>` : ''}
                        <span class="premium-radio-tag"><i class="fas fa-headphones"></i>${listeners >= 1000 ? (listeners / 1000).toFixed(1) + 'K' : listeners}</span>
                    </div>
                </div>
            </div>`;
    }

    function renderFilters() {
        const holder = $('premiumRadioFilters');
        if (!holder) return;
        const stations = activeStations();
        const genres = [];
        const genreSet = new Set();
        stations.forEach(s => { if (s.genre) genreSet.add(genreOf(s)); });
        Array.from(genreSet).sort().forEach(g => genres.push(g));

        const chips = [
            `<button class="premium-radio-chip active" data-genre="all">All</button>`
        ].concat(genres.map(g => `<button class="premium-radio-chip" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`)).join('');

        holder.innerHTML = chips;
        holder.querySelectorAll('.premium-radio-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                _radioFilter = chip.dataset.genre;
                holder.querySelectorAll('.premium-radio-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                applyRadioFilter();
            });
        });
    }

    function applyRadioFilter() {
        const cards = document.querySelectorAll('.premium-radio-card');
        let visible = 0;
        cards.forEach(card => {
            const ok = _radioFilter === 'all' || card.dataset.genre === _radioFilter;
            card.classList.toggle('hidden', !ok);
            if (ok) visible++;
        });
        const empty = $('premiumRadioEmpty');
        if (empty) empty.style.display = visible ? 'none' : 'block';
    }

    function renderRadio(targetId) {
        const container = $(targetId || 'premiumRadioGrid');
        if (!container) return;

        const stations = activeStations();
        if (!stations.length) {
            const empty = $('premiumRadioEmpty');
            if (empty) empty.style.display = 'block';
            container.innerHTML = '';
            return;
        }

        container.innerHTML = stations.map((s, i) => radioCardHTML(s)).join('');

        // Ensure cards render ascending stagger without piling up
        container.querySelectorAll('.premium-radio-card').forEach((card, i) => {
            card.style.animationDelay = Math.min(i * 0.045, 0.6) + 's';
            const name = stationName(card);
            const stationId = card.dataset.name ? (activeStations().find(s => s.name === card.dataset.name)?.id || '') : '';
            const playState = () => {
                if (!isPreview && window.isStreamPlaying && name === window.currentStation) {
                    card.classList.add('active-station', 'playing-station');
                    const icon = card.querySelector('.premium-radio-play');
                    if (icon) icon.className = 'fas fa-pause premium-radio-play';
                } else {
                    card.classList.remove('active-station', 'playing-station');
                    const icon = card.querySelector('.premium-radio-play');
                    if (icon) icon.className = 'fas fa-play premium-radio-play';
                }
            };
            playState();
            card.addEventListener('click', () => {
                if (typeof window.toggleStationFromCard === 'function') {
                    window.toggleStationFromCard(card, name, stationId);
                    setTimeout(playState, 80);
                } else if (typeof window.playStation === 'function') {
                    window.playStation(name, stationId);
                    setTimeout(playState, 80);
                }
            });
        });

        if (targetId === 'premiumRadioGrid') renderFilters();
    }

    function syncRadioState() {
        if (document.getElementById('premiumRadioGrid')) renderRadio('premiumRadioGrid');
        if (document.getElementById('ytmStationsContent')) renderRadio('ytmStationsContent');
    }

    function bindRadioRandom() {
        const btn = $('premiumRadioShuffle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const stations = activeStations();
            if (!stations.length) {
                if (typeof showToast === 'function') showToast('No stations available right now', 'info');
                return;
            }
            const pick = stations[Math.floor(Math.random() * stations.length)];
            if (typeof window.playStation === 'function') window.playStation(pick.name, pick.id);
        });
    }

    function goRadio(fromKebab) {
        if (typeof YTMusic !== 'undefined' && YTMusic.navigateTo) {
            YTMusic.navigateTo('radio');
            try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) {}
        }
    }

    /* ------------------ scroll reveal ------------------ */
    function initScrollReveals() {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const els = document.querySelectorAll('[data-premium-reveal]');
        if (!('IntersectionObserver' in window)) {
            els.forEach(el => el.classList.add('revealed'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach(en => {
                if (en.isIntersecting) {
                    en.target.classList.add('revealed');
                    io.unobserve(en.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
        els.forEach(el => io.observe(el));
    }

    /* ------------------ hash / navigation bridge ------------------ */
    function bindNavigation() {
        if (typeof YTMusic === 'undefined') return;
        // Keep Radio rendering in sync whenever the page becomes visible
        const origNavigate = YTMusic.navigateTo.bind(YTMusic);
        YTMusic.navigateTo = function (page, opts) {
            origNavigate(page, opts);
            if (page === 'radio' || page === 'stations') {
                syncRadioState();
            } else if (page === 'home') {
                syncHeroState();
            }
        };
    }

    function bindDataSync() {
        if (typeof DataStore === 'undefined' || typeof DataStore.on !== 'function') return;
        try {
            DataStore.on('change', (event) => {
                if (event && event.keyName === 'STATIONS') {
                    updateHeroStats();
                }
            });
        } catch (e) {}
    }

    /* ------------------ global state hooks ------------------ */
    function installStateHooks() {
        // Keep hero CSS in sync with play/pause — lightweight, no DOM rebuilds.
        document.addEventListener('play', (e) => {
            if (e.target === window.audioPlayer) { syncHeroState(); }
        }, true);
        document.addEventListener('pause', (e) => {
            if (e.target === window.audioPlayer) { syncHeroState(); }
        }, true);
        if (window.audioPlayer) {
            window.audioPlayer.addEventListener('play', () => { syncHeroState(); }, { capture: true });
            window.audioPlayer.addEventListener('pause', () => { syncHeroState(); }, { capture: true });
        }
    }

    /* ------------------ init ------------------ */
    function init() {
        if (isPreview) {
            renderRadio('premiumRadioGrid');
            updateHeroStats();
            bindKebabMenu();
            bindNavigation();
            return;
        }
        initHeroParticles();
        updateHeroStats();
        syncHeroState();
        bindKebabMenu();
        renderRadio('premiumRadioGrid');
        renderRadio('ytmStationsContent');
        bindRadioRandom();
        initScrollReveals();
        bindNavigation();
        bindDataSync();
        installStateHooks();

        // Trigger hero entrance after the splash screen clears.
        requestAnimationFrame(() => {
            setTimeout(() => {
                const hero = $('premiumHero');
                if (hero) hero.classList.add('entered');
            }, 260);
        });

        // Hero CTAs
        const playBtn = $('premiumHeroPlay');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const stations = activeStations();
                if (stations.length && typeof window.playStation === 'function') {
                    const featured = typeof DataStore !== 'undefined' && DataStore.getFeatured
                        ? DataStore.getFeatured().find(f => f.status === 'active') : null;
                    const target = featured
                        ? (DataStore.getStations().find(s => s.id === featured.stationId) || stations[0])
                        : stations[0];
                    window.playStation(target.name, target.id);
                } else {
                    try {
                        document.getElementById('featuredSlider').scrollIntoView({ behavior: 'smooth' });
                    } catch (e) {}
                }
            });
        }
        const radioBtn = $('premiumHeroRadio');
        if (radioBtn) radioBtn.addEventListener('click', goRadio);

        if (typeof YTMusic !== 'undefined' && YTMusic.currentPage === 'radio') {
            setTimeout(syncRadioState, 60);
        }
    }

    const api = {
        init,
        renderRadio,
        syncRadioState,
        syncHeroState,
        goRadio,
        updateHeroStats
    };
    window.TamilAIPremium = api;
    return api;
})();

// Public alias for inline onclick handlers in the existing HTML.
window.premiumGoRadio = function () {
    if (window.TamilAIPremium) TamilAIPremium.goRadio();
};