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
        const canvas = $('premiumHeroCanvas');
        if (!canvas || isPreview || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const ctx = canvas.getContext('2d');
        const DPR = window.devicePixelRatio || 1;
        let W = 0, H = 0;
        const notes = [];
        function resize() {
            W = canvas.clientWidth; H = canvas.clientHeight;
            canvas.width = W * DPR; canvas.height = H * DPR;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize);
        for (let i = 0; i < 22; i++) {
            notes.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.6 + 0.6,
                dy: Math.random() * 0.35 + 0.08,
                dx: (Math.random() - 0.5) * 0.2,
                o: Math.random() * 0.5 + 0.15,
                phase: Math.random() * Math.PI * 2,
                hue: Math.random() > 0.6 ? 190 : 160
            });
        }
        let raf;
        function draw(t) {
            ctx.clearRect(0, 0, W, H);
            for (const p of notes) {
                const depth = 1 + Math.sin(t * 0.001 + p.phase);
                p.y = (p.y - p.dy + H) % H;
                p.x = (p.x + p.dx + Math.sin(t * 0.0006 + p.phase) * 0.4 + W) % W;
                const a = p.o * (0.4 + depth * 0.3);
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
                g.addColorStop(0, `hsla(${p.hue}, 78%, 66%, ${a * 0.6})`);
                g.addColorStop(1, `hsla(${p.hue}, 78%, 66%, 0)`);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
                ctx.fillStyle = g;
                ctx.fill();
            }
            raf = requestAnimationFrame(draw);
        }
        raf = requestAnimationFrame(draw);
        TamilAIPremium._heroRaf = raf;
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

    /* ------------------ 3-dot menu ------------------ */
    function bindKebabMenu() {
        const btn = $('premiumKebabBtn');
        const menu = $('premiumKebabMenu');
        if (!btn || !menu) return;

        function open(force) {
            const shouldOpen = typeof force === 'boolean' ? force : !menu.classList.contains('open');
            menu.classList.toggle('open', shouldOpen);
            btn.classList.toggle('active', shouldOpen);
        }

        // Desktop (>=1025px): clicking 3-dot opens the left sidebar
        // Mobile (<1025px): clicking 3-dot opens the left sidebar (closed by default)
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close the kebab dropdown if it was open
            open(false);
            // Toggle the sidebar
            if (typeof YTMusic !== 'undefined' && YTMusic.togglePremiumSidebar) {
                YTMusic.togglePremiumSidebar();
            }
        });

        // Dropdown menu item clicks
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.premium-kebab-item');
            if (!item) return;
            e.stopPropagation();
            open(false);
            // On mobile: close sidebar after selecting an option
            if (window.innerWidth < 1025 && typeof YTMusic !== 'undefined' && YTMusic.togglePremiumSidebar) {
                YTMusic.togglePremiumSidebar(false);
            }
            const goto = item.dataset.goto;
            if (goto) {
                if (typeof YTMusic !== 'undefined' && YTMusic.navigateTo) {
                    YTMusic.navigateTo(goto);
                    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) {}
                }
            } else if (item.id === 'premiumKebabSettings' && typeof YTMusic !== 'undefined') {
                if (typeof YTMusic.toggleSettingsPanel === 'function') YTMusic.toggleSettingsPanel();
            }
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.premium-kebab-btn') && !e.target.closest('.premium-kebab-menu')) open(false);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') open(false);
        });
    }

    // Onboarding removed — users go directly to login page
    function initOnboarding() {
        // Onboarding overlay removed from DOM — no-op
        return;
    }

        // Check if user has completed onboarding
        const hasOnboarded = localStorage.getItem('tamilAI_onboarded');
        const isAuth = (typeof Auth !== 'undefined' && Auth.isAuthenticated && Auth.isAuthenticated());

        // If already authenticated and onboarded, skip
        if (isAuth && hasOnboarded) return;

        // If not authenticated, show onboarding after splash
        if (!isAuth) {
            setTimeout(() => {
                overlay.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }, 2500);
        }

        // Step navigation
        const step1 = document.getElementById('onboardStep1');
        const step2 = document.getElementById('onboardStep2');
        const step3 = document.getElementById('onboardStep3');

        function showStep(step) {
            [step1, step2, step3].forEach(s => s.classList.remove('active'));
            step.classList.add('active');
        }

        // Get Started button → show login
        const getStartedBtn = document.getElementById('onboardGetStarted');
        if (getStartedBtn) {
            getStartedBtn.addEventListener('click', () => showStep(step2));
        }

        // Skip to login
        const skipToLogin = document.getElementById('onboardSkipToLogin');
        if (skipToLogin) {
            skipToLogin.addEventListener('click', () => showStep(step2));
        }

        // Back button
        const backBtn = document.getElementById('onboardBack');
        if (backBtn) {
            backBtn.addEventListener('click', () => showStep(step1));
        }

        // Toggle login/register
        const showReg = document.getElementById('onboardShowRegister');
        const showLogin = document.getElementById('onboardShowLogin');
        const loginForm = document.getElementById('onboardLoginForm');
        const regForm = document.getElementById('onboardRegisterForm');
        const regSwitch = document.getElementById('onboardRegisterSwitch');

        if (showReg) showReg.addEventListener('click', () => {
            loginForm.style.display = 'none';
            regForm.style.display = 'flex';
            regSwitch.style.display = 'block';
            document.querySelector('.onboard-switch-text').style.display = 'none';
        });
        if (showLogin) showLogin.addEventListener('click', () => {
            loginForm.style.display = 'flex';
            regForm.style.display = 'none';
            regSwitch.style.display = 'none';
            document.querySelector('.onboard-switch-text').style.display = 'block';
        });

        // Login form submission
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('onboardEmail').value;
                const password = document.getElementById('onboardPassword').value;
                if (!email || !password) return;
                try {
                    if (typeof Auth !== 'undefined' && Auth.login) {
                        await Auth.login(email, password);
                    }
                    closeOnboarding(true);
                } catch (err) {
                    alert(err.message || 'Login failed');
                }
            });
        }

        // Register form submission
        if (regForm) {
            regForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('onboardRegName').value;
                const email = document.getElementById('onboardRegEmail').value;
                const password = document.getElementById('onboardRegPassword').value;
                const confirm = document.getElementById('onboardRegConfirm').value;
                if (!name || !email || !password) return;
                if (password !== confirm) { alert('Passwords do not match'); return; }
                try {
                    if (typeof Auth !== 'undefined' && Auth.register) {
                        await Auth.register(email, password, name);
                    }
                    showStep(step3);
                } catch (err) {
                    alert(err.message || 'Registration failed');
                }
            });
        }

        // Google login
        const googleBtn = document.getElementById('onboardGoogleLogin');
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                try {
                    if (typeof Auth !== 'undefined' && Auth.googleLogin) {
                        await Auth.googleLogin();
                    }
                    closeOnboarding(true);
                } catch (err) {
                    alert(err.message || 'Google login failed');
                }
            });
        }

        // Guest login
        const guestBtn = document.getElementById('onboardGuestLogin');
        if (guestBtn) {
            guestBtn.addEventListener('click', () => {
                localStorage.setItem('tamilAI_onboarded', 'true');
                closeOnboarding(false);
            });
        }

        // Interest selection
        const interestsGrid = document.getElementById('onboardInterests');
        if (interestsGrid) {
            interestsGrid.addEventListener('click', (e) => {
                const btn = e.target.closest('.onboard-interest');
                if (btn) btn.classList.toggle('selected');
            });
        }

        // Finish button
        const finishBtn = document.getElementById('onboardFinish');
        if (finishBtn) {
            finishBtn.addEventListener('click', () => {
                const selected = [];
                document.querySelectorAll('.onboard-interest.selected').forEach(el => {
                    selected.push(el.dataset.mood);
                });
                if (selected.length > 0) {
                    localStorage.setItem('tamilAI_preferences', JSON.stringify(selected));
                }
                localStorage.setItem('tamilAI_onboarded', 'true');
                closeOnboarding(true);
            });
        }

        // Skip prefs
        const skipPrefs = document.getElementById('onboardSkipPrefs');
        if (skipPrefs) {
            skipPrefs.addEventListener('click', () => {
                localStorage.setItem('tamilAI_onboarded', 'true');
                closeOnboarding(true);
            });
        }

        function closeOnboarding(reload) {
            overlay.classList.add('onboard-hide');
            document.body.style.overflow = '';
            setTimeout(() => {
                overlay.style.display = 'none';
                if (reload) window.location.reload();
            }, 600);
        }
    }

    // Initialize onboarding when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOnboarding);
    } else {
        initOnboarding();
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
                    window.toggleStationFromCard(card, name);
                    setTimeout(playState, 80);
                } else if (typeof window.playStation === 'function') {
                    window.playStation(name);
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
            if (typeof window.playStation === 'function') window.playStation(pick.name);
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
                requestAnimationFrame(syncRadioState);
            } else if (page === 'home') {
                syncHeroState();
            }
        };
    }

    function bindDataSync() {
        if (typeof DataStore === 'undefined' || typeof DataStore.on !== 'function') return;
        try {
            DataStore.on('change', (event) => {
                if (event && (event.keyName === 'STATIONS' || event.keyName === 'IMAGES')) {
                    syncRadioState();
                    updateHeroStats();
                }
            });
        } catch (e) {}
    }

    /* ------------------ global state hooks ------------------ */
    function installStateHooks() {
        // Keep vinyl + radio cards in sync with play/pause across the app.
        document.addEventListener('play', (e) => {
            if (e.target === window.audioPlayer) { syncHeroState(); syncRadioState(); }
        }, true);
        document.addEventListener('pause', (e) => {
            if (e.target === window.audioPlayer) { syncHeroState(); syncRadioState(); }
        }, true);
        if (window.audioPlayer) {
            window.audioPlayer.addEventListener('play', () => { syncHeroState(); syncRadioState(); }, { capture: true });
            window.audioPlayer.addEventListener('pause', () => { syncHeroState(); syncRadioState(); }, { capture: true });
        }
        // Re-check every second in case a custom player bypasses events.
        setInterval(() => syncHeroState(), 900);
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
                    window.playStation(target.name);
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Public alias for inline onclick handlers in the existing HTML.
window.premiumGoRadio = function () {
    if (window.TamilAIPremium) TamilAIPremium.goRadio();
};