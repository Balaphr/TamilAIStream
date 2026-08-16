'use strict';
/* ============================================================
   Site 360 - Visual Website Editor
   Two-panel workspace: visual canvas (left) + settings (right)
   Edits DataStore directly, publishes via existing sync system.
   ============================================================ */

const Site360 = (function () {
    let selectedId = null;
    let canvasElements = [];
    let undoStack = [];
    let redoStack = [];

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    function safeGet(fn, fallback) {
        try { const v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; }
    }

    /* ============================================================
       CANVAS DATA - Maps every website element to editable props
       ============================================================ */
    function buildCanvasData() {
        canvasElements = [];

        // ---- Global Settings ----
        const site = safeGet(() => DataStore.getSiteSettings(), {});
        canvasElements.push({
            id: 'el_site_title', section: 'global', label: 'Site Title', icon: 'fa-heading',
            category: 'settings', source: 'siteSettings', field: 'title',
            value: site.title || 'Tamil AI Stream',
            controls: [
                { key: 'title', label: 'Title', type: 'text', value: site.title || 'Tamil AI Stream' },
                { key: 'description', label: 'Description', type: 'textarea', value: site.description || '' },
                { key: 'themeColor', label: 'Theme Color', type: 'color', value: site.themeColor || '#34d399' },
                { key: 'accentColor', label: 'Accent Color', type: 'color', value: site.accentColor || '#38bdf8' },
                { key: 'bgColor', label: 'Background', type: 'color', value: site.bgColor || '#0a0e17' },
                { key: 'textColor', label: 'Text Color', type: 'color', value: site.textColor || '#ffffff' },
                { key: 'fontFamily', label: 'Font Family', type: 'select', value: site.fontFamily || 'Inter', options: ['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Montserrat', 'Raleway'] },
                { key: 'borderRadius', label: 'Border Radius', type: 'text', value: site.borderRadius || '18px' },
                { key: 'logo', label: 'Logo', type: 'image', value: site.logo || '' },
                { key: 'favicon', label: 'Favicon', type: 'image', value: site.favicon || '' }
            ]
        });

        // ---- Navigation ----
        const nav = safeGet(() => DataStore.getNavigation(), {});
        const navItems = nav.items || nav.navItems || [];
        navItems.forEach((item, i) => {
            canvasElements.push({
                id: 'el_nav_' + i, section: 'navigation', label: item.label || item.name || 'Nav ' + (i + 1),
                icon: item.icon || 'fa-link', category: 'navigation', source: 'navigation',
                navIndex: i, value: item,
                controls: [
                    { key: 'label', label: 'Label', type: 'text', value: item.label || item.name || '' },
                    { key: 'icon', label: 'Icon', type: 'icon', value: item.icon || '' },
                    { key: 'url', label: 'URL / Route', type: 'text', value: item.url || item.href || '' },
                    { key: 'visible', label: 'Visible', type: 'toggle', value: item.visible !== false },
                    { key: 'order', label: 'Order', type: 'number', value: i }
                ]
            });
        });

        // ---- Home Sections ----
        const homeSections = [
            { id: 'el_sec_hero', sectionId: 'hero', label: 'Hero Banner', icon: 'fa-image', source: 'siteSettings', controls: [
                { key: 'heroTitle', label: 'Hero Title', type: 'text', value: site.heroTitle || '' },
                { key: 'heroSubtitle', label: 'Hero Subtitle', type: 'text', value: site.heroSubtitle || '' },
                { key: 'heroImage', label: 'Hero Image', type: 'image', value: site.heroImage || '' },
                { key: 'heroLink', label: 'Link URL', type: 'text', value: site.heroLink || '' }
            ]},
            { id: 'el_sec_categories', sectionId: 'categories', label: 'Categories', icon: 'fa-tags', source: 'siteSettings', controls: [
                { key: 'categoriesTitle', label: 'Section Title', type: 'text', value: site.categoriesTitle || 'Categories' },
                { key: 'categoriesVisible', label: 'Visible', type: 'toggle', value: site.categoriesVisible !== false }
            ]},
            { id: 'el_sec_upcoming', sectionId: 'upcomingReleases', label: 'Upcoming Releases', icon: 'fa-rocket', source: 'siteSettings', controls: [
                { key: 'upcomingTitle', label: 'Section Title', type: 'text', value: site.upcomingTitle || 'Upcoming Releases' },
                { key: 'upcomingVisible', label: 'Visible', type: 'toggle', value: site.upcomingVisible !== false }
            ]},
            { id: 'el_sec_recently', sectionId: 'recentlyAdded', label: 'Recently Added', icon: 'fa-clock-rotate-left', source: 'siteSettings', controls: [
                { key: 'recentlyTitle', label: 'Section Title', type: 'text', value: site.recentlyTitle || 'Recently Added' },
                { key: 'recentlyVisible', label: 'Visible', type: 'toggle', value: site.recentlyVisible !== false },
                { key: 'recentlyLimit', label: 'Max Items', type: 'number', value: site.recentlyLimit || 20 }
            ]},
            { id: 'el_sec_personalized', sectionId: 'personalized', label: 'Made For You', icon: 'fa-heart', source: 'siteSettings', controls: [
                { key: 'personalizedTitle', label: 'Section Title', type: 'text', value: site.personalizedTitle || 'Made For You' },
                { key: 'personalizedVisible', label: 'Visible', type: 'toggle', value: site.personalizedVisible !== false }
            ]},
            { id: 'el_sec_trending', sectionId: 'trending', label: 'Trending Songs', icon: 'fa-fire', source: 'siteSettings', controls: [
                { key: 'trendingTitle', label: 'Section Title', type: 'text', value: site.trendingTitle || 'Trending Songs' },
                { key: 'trendingVisible', label: 'Visible', type: 'toggle', value: site.trendingVisible !== false }
            ]},
            { id: 'el_sec_latest', sectionId: 'latestCollection', label: 'Latest Releases', icon: 'fa-compact-disc', source: 'siteSettings', controls: [
                { key: 'latestTitle', label: 'Section Title', type: 'text', value: site.latestTitle || 'Latest Releases' },
                { key: 'latestVisible', label: 'Visible', type: 'toggle', value: site.latestVisible !== false }
            ]},
            { id: 'el_sec_ai', sectionId: 'aiRecommended', label: 'AI Recommended', icon: 'fa-wand-magic-sparkles', source: 'siteSettings', controls: [
                { key: 'aiTitle', label: 'Section Title', type: 'text', value: site.aiTitle || 'AI Recommended' },
                { key: 'aiVisible', label: 'Visible', type: 'toggle', value: site.aiVisible !== false }
            ]},
            { id: 'el_sec_albums', sectionId: 'albums', label: 'Albums', icon: 'fa-compact-disc', source: 'siteSettings', controls: [
                { key: 'albumsTitle', label: 'Section Title', type: 'text', value: site.albumsTitle || 'Albums' },
                { key: 'albumsVisible', label: 'Visible', type: 'toggle', value: site.albumsVisible !== false }
            ]},
            { id: 'el_sec_artists', sectionId: 'tamilHits', label: 'Artist Hits', icon: 'fa-microphone', source: 'siteSettings', controls: [
                { key: 'artistsTitle', label: 'Section Title', type: 'text', value: site.artistsTitle || 'Artist Hits' },
                { key: 'artistsVisible', label: 'Visible', type: 'toggle', value: site.artistsVisible !== false }
            ]},
            { id: 'el_sec_movies', sectionId: 'moviesCollection', label: 'Movie Collections', icon: 'fa-film', source: 'siteSettings', controls: [
                { key: 'moviesTitle', label: 'Section Title', type: 'text', value: site.moviesTitle || 'Movie Collections' },
                { key: 'moviesVisible', label: 'Visible', type: 'toggle', value: site.moviesVisible !== false }
            ]},
            { id: 'el_sec_yearly', sectionId: 'yearlyCollection', label: 'Yearly Collections', icon: 'fa-calendar', source: 'siteSettings', controls: [
                { key: 'yearlyTitle', label: 'Section Title', type: 'text', value: site.yearlyTitle || 'Yearly Collections' },
                { key: 'yearlyVisible', label: 'Visible', type: 'toggle', value: site.yearlyVisible !== false }
            ]},
            { id: 'el_sec_music', sectionId: 'musicCollection', label: 'Music Collections', icon: 'fa-folder-tree', source: 'siteSettings', controls: [
                { key: 'musicTitle', label: 'Section Title', type: 'text', value: site.musicTitle || 'Music Collections' },
                { key: 'musicVisible', label: 'Visible', type: 'toggle', value: site.musicVisible !== false }
            ]}
        ];
        homeSections.forEach(s => {
            canvasElements.push({ ...s, section: 'homeSections', category: 'section', value: '' });
        });

        // ---- Songs (up to 30) ----
        const songs = safeGet(() => DataStore.getSongs(), []);
        songs.slice(0, 30).forEach((s, i) => {
            canvasElements.push({
                id: 'el_song_' + (s.id || i), section: 'content', label: s.title || 'Untitled',
                icon: 'fa-music', category: 'song', source: 'songs', dataIndex: i, value: s,
                controls: [
                    { key: 'title', label: 'Title', type: 'text', value: s.title || '' },
                    { key: 'artist', label: 'Artist', type: 'text', value: s.artist || '' },
                    { key: 'movie', label: 'Movie', type: 'text', value: s.movie || '' },
                    { key: 'genre', label: 'Genre', type: 'select', value: s.genre || '', options: ['Love', 'Action', 'Comedy', 'Emotional', 'Devotional', 'Dance', 'Folk', 'Classical', 'Rock', 'Pop'] },
                    { key: 'language', label: 'Language', type: 'select', value: s.language || 'Tamil', options: ['Tamil', 'Hindi', 'Telugu', 'Malayalam', 'Kannada'] },
                    { key: 'singer', label: 'Singer', type: 'text', value: s.singer || '' },
                    { key: 'duration', label: 'Duration', type: 'text', value: s.duration || '' },
                    { key: 'status', label: 'Status', type: 'select', value: s.status || 'published', options: ['published', 'draft', 'active', 'inactive'] },
                    { key: 'thumbnail', label: 'Thumbnail', type: 'image', value: s.thumbnail || s.albumCover || s.cover || '' },
                    { key: 'audioUrl', label: 'Audio URL', type: 'text', value: s.audioUrl || '', readonly: true },
                    { key: 'albumCover', label: 'Album Cover', type: 'image', value: s.albumCover || s.cover || '' }
                ]
            });
        });

        // ---- Stations ----
        const stations = safeGet(() => DataStore.getStations(), []);
        stations.forEach((s, i) => {
            canvasElements.push({
                id: 'el_station_' + (s.id || i), section: 'content', label: s.name || 'Station ' + (i + 1),
                icon: 'fa-radio', category: 'station', source: 'stations', dataIndex: i, value: s,
                controls: [
                    { key: 'name', label: 'Name', type: 'text', value: s.name || '' },
                    { key: 'freq', label: 'Frequency', type: 'text', value: s.freq || '' },
                    { key: 'genre', label: 'Genre', type: 'text', value: s.genre || '' },
                    { key: 'city', label: 'City', type: 'text', value: s.city || '' },
                    { key: 'streamUrl', label: 'Stream URL', type: 'text', value: s.streamUrl || '' },
                    { key: 'thumbnail', label: 'Thumbnail', type: 'image', value: s.thumbnail || '' },
                    { key: 'status', label: 'Status', type: 'select', value: s.status || 'active', options: ['active', 'inactive'] }
                ]
            });
        });

        // ---- Advertisements ----
        const ads = safeGet(() => DataStore.getAdvertisements(), []);
        ads.forEach((a, i) => {
            canvasElements.push({
                id: 'el_ad_' + i, section: 'content', label: a.title || 'Ad ' + (i + 1),
                icon: 'fa-ad', category: 'advertisement', source: 'advertisements', dataIndex: i, value: a,
                controls: [
                    { key: 'title', label: 'Title', type: 'text', value: a.title || '' },
                    { key: 'description', label: 'Description', type: 'textarea', value: a.description || '' },
                    { key: 'imageUrl', label: 'Banner Image', type: 'image', value: a.imageUrl || a.image || '' },
                    { key: 'targetLink', label: 'Target Link', type: 'text', value: a.targetLink || a.url || '' },
                    { key: 'position', label: 'Position', type: 'select', value: a.position || 1, options: [0, 1, 2, 3, 4].map(String) },
                    { key: 'enabled', label: 'Enabled', type: 'toggle', value: a.enabled !== false }
                ]
            });
        });

        // ---- Featured ----
        const featured = safeGet(() => DataStore.getFeatured(), []);
        featured.forEach((f, i) => {
            canvasElements.push({
                id: 'el_featured_' + i, section: 'content', label: f.title || f.name || 'Featured ' + (i + 1),
                icon: 'fa-star', category: 'featured', source: 'featured', dataIndex: i, value: f,
                controls: [
                    { key: 'title', label: 'Title', type: 'text', value: f.title || f.name || '' },
                    { key: 'artist', label: 'Artist', type: 'text', value: f.artist || '' },
                    { key: 'thumbnail', label: 'Thumbnail', type: 'image', value: f.thumbnail || f.image || '' },
                    { key: 'status', label: 'Status', type: 'select', value: f.status || 'active', options: ['active', 'inactive'] }
                ]
            });
        });

        // ---- Trending ----
        const trending = safeGet(() => DataStore.getTrending(), []);
        trending.forEach((t, i) => {
            canvasElements.push({
                id: 'el_trending_' + i, section: 'content', label: t.title || t.name || 'Trending ' + (i + 1),
                icon: 'fa-fire', category: 'trending', source: 'trending', dataIndex: i, value: t,
                controls: [
                    { key: 'title', label: 'Title', type: 'text', value: t.title || t.name || '' },
                    { key: 'artist', label: 'Artist', type: 'text', value: t.artist || '' },
                    { key: 'thumbnail', label: 'Thumbnail', type: 'image', value: t.thumbnail || '' },
                    { key: 'status', label: 'Status', type: 'select', value: t.status || 'active', options: ['active', 'inactive'] }
                ]
            });
        });

        // ---- Categories ----
        const categories = safeGet(() => DataStore.getCategories(), []);
        categories.forEach((c, i) => {
            canvasElements.push({
                id: 'el_category_' + i, section: 'content', label: c.name || 'Category ' + (i + 1),
                icon: 'fa-tag', category: 'category', source: 'categories', dataIndex: i, value: c,
                controls: [
                    { key: 'name', label: 'Name', type: 'text', value: c.name || '' },
                    { key: 'icon', label: 'Icon', type: 'icon', value: c.icon || '' },
                    { key: 'color', label: 'Color', type: 'color', value: c.color || '#34d399' }
                ]
            });
        });

        // ---- Artist Hits ----
        const artists = safeGet(() => DataStore.getArtistHits(), []);
        artists.forEach((a, i) => {
            canvasElements.push({
                id: 'el_artist_' + i, section: 'content', label: a.name || 'Artist ' + (i + 1),
                icon: 'fa-microphone', category: 'artist', source: 'artistHits', dataIndex: i, value: a,
                controls: [
                    { key: 'name', label: 'Name', type: 'text', value: a.name || '' },
                    { key: 'artist', label: 'Artist Key', type: 'text', value: a.artist || '' },
                    { key: 'songCount', label: 'Song Count', type: 'number', value: a.songCount || 0 },
                    { key: 'thumbnail', label: 'Thumbnail', type: 'image', value: a.thumbnail || '' },
                    { key: 'gradient', label: 'Gradient', type: 'text', value: a.gradient || '' },
                    { key: 'status', label: 'Status', type: 'select', value: a.status || 'active', options: ['active', 'inactive'] }
                ]
            });
        });

        // ---- Moods ----
        const moods = safeGet(() => DataStore.getMoods(), []);
        moods.forEach((m, i) => {
            canvasElements.push({
                id: 'el_mood_' + i, section: 'content', label: m.name || m.label || 'Mood ' + (i + 1),
                icon: 'fa-smile', category: 'mood', source: 'moods', dataIndex: i, value: m,
                controls: [
                    { key: 'name', label: 'Name', type: 'text', value: m.name || m.label || '' },
                    { key: 'icon', label: 'Icon', type: 'icon', value: m.icon || '' },
                    { key: 'color', label: 'Color', type: 'color', value: m.color || '#34d399' },
                    { key: 'description', label: 'Description', type: 'text', value: m.description || '' }
                ]
            });
        });

        // ---- Splash Screen ----
        const splash = safeGet(() => DataStore.getSplash(), {});
        canvasElements.push({
            id: 'el_splash', section: 'global', label: 'Splash Screen', icon: 'fa-play-circle',
            category: 'splash', source: 'splash', value: splash,
            controls: [
                { key: 'enabled', label: 'Enabled', type: 'toggle', value: splash.enabled !== false },
                { key: 'title', label: 'Title', type: 'text', value: splash.title || 'Tamil AI Stream' },
                { key: 'subtitle', label: 'Subtitle', type: 'text', value: splash.subtitle || 'AI-Powered Tamil Radio' },
                { key: 'background', label: 'Background', type: 'image', value: splash.background || splash.bgImage || '' },
                { key: 'duration', label: 'Duration (ms)', type: 'number', value: splash.duration || 2500, min: 1000, max: 5000 }
            ]
        });

        // ---- Player Settings ----
        const prefs = safeGet(() => DataStore.getPlayerPrefs(), {});
        canvasElements.push({
            id: 'el_player', section: 'global', label: 'Player Settings', icon: 'fa-headphones',
            category: 'player', source: 'playerPrefs', value: prefs,
            controls: [
                { key: 'volume', label: 'Default Volume', type: 'range', value: prefs.volume || 0.7, min: 0, max: 1, step: 0.1 },
                { key: 'autoPlay', label: 'Auto Play', type: 'toggle', value: prefs.autoPlay || false },
                { key: 'crossfade', label: 'Crossfade', type: 'toggle', value: prefs.crossfade || false },
                { key: 'crossfadeDuration', label: 'Crossfade Duration', type: 'number', value: prefs.crossfadeDuration || 3, min: 1, max: 12 },
                { key: 'repeat', label: 'Repeat Mode', type: 'select', value: prefs.repeat || 'off', options: ['off', 'all', 'one'] },
                { key: 'shuffle', label: 'Shuffle', type: 'toggle', value: prefs.shuffle || false }
            ]
        });

        // ---- Mini Player ----
        const mp = safeGet(() => DataStore.getMiniPlayerSettings(), {});
        canvasElements.push({
            id: 'el_minip', section: 'global', label: 'Mini Player', icon: 'fa-play-circle',
            category: 'miniPlayer', source: 'miniPlayerSettings', value: mp,
            controls: [
                { key: 'enabled', label: 'Enabled', type: 'toggle', value: mp.enabled !== false },
                { key: 'position', label: 'Position', type: 'select', value: mp.position || 'bottom-right', options: ['bottom-right', 'bottom-left', 'top-right', 'top-left'] },
                { key: 'theme', label: 'Theme', type: 'select', value: mp.theme || 'dark', options: ['dark', 'light', 'auto'] },
                { key: 'showArtwork', label: 'Show Artwork', type: 'toggle', value: mp.showArtwork !== false }
            ]
        });
    }

    /* ============================================================
       CANVAS RENDERING - Visual website representation
       ============================================================ */
    function renderCanvas() {
        const canvas = $('s360Canvas');
        if (!canvas) return;

        const sections = {};
        canvasElements.forEach(el => {
            if (!sections[el.section]) sections[el.section] = [];
            sections[el.section].push(el);
        });

        const sectionOrder = ['global', 'navigation', 'homeSections', 'content'];
        const sectionLabels = {
            global: { label: 'Global Settings', icon: 'fa-globe' },
            navigation: { label: 'Navigation', icon: 'fa-navicon' },
            homeSections: { label: 'Home Page Sections', icon: 'fa-layer-group' },
            content: { label: 'Content Library', icon: 'fa-database' }
        };

        let html = '';
        sectionOrder.forEach(sec => {
            const items = sections[sec];
            if (!items || !items.length) return;
            const meta = sectionLabels[sec] || { label: sec, icon: 'fa-folder' };

            html += '<div class="s360-canvas-section">';
            html += '<div class="s360-canvas-section-header">';
            html += '<i class="fas ' + meta.icon + '"></i> ' + meta.label;
            html += '<span class="s360-canvas-section-count">' + items.length + '</span>';
            html += '</div>';
            html += '<div class="s360-canvas-section-grid">';

            items.forEach(el => {
                const isSelected = selectedId === el.id;
                const thumbHtml = getThumbnailHtml(el);
                html += '<div class="s360-canvas-card' + (isSelected ? ' selected' : '') + '" data-el-id="' + esc(el.id) + '">';
                html += '<div class="s360-canvas-card-thumb">' + thumbHtml + '</div>';
                html += '<div class="s360-canvas-card-info">';
                html += '<div class="s360-canvas-card-label" title="' + esc(el.label) + '">' + esc(el.label) + '</div>';
                html += '<div class="s360-canvas-card-cat"><i class="fas ' + esc(el.icon) + '"></i> ' + esc(el.category) + '</div>';
                html += '</div>';
                if (isSelected) html += '<div class="s360-canvas-card-check"><i class="fas fa-check"></i></div>';
                html += '</div>';
            });

            html += '</div></div>';
        });

        canvas.innerHTML = html;

        // Bind clicks
        canvas.querySelectorAll('.s360-canvas-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectElement(card.dataset.elId);
            });
        });
    }

    function getThumbnailHtml(el) {
        // Try to get an image from the element's value
        const img = el.value && (el.value.thumbnail || el.value.image || el.value.albumCover || el.value.logo || el.value.background);
        if (img) {
            return '<img src="' + esc(img) + '" alt="" onerror="this.parentElement.innerHTML=\'<div class=s360-canvas-card-icon><i class=fas ' + esc(el.icon) + '></i></div>\'">';
        }
        return '<div class="s360-canvas-card-icon"><i class="fas ' + esc(el.icon) + '"></i></div>';
    }

    /* ============================================================
       ELEMENT SELECTION
       ============================================================ */
    function selectElement(id) {
        selectedId = id;
        renderCanvas();
        renderSettingsPanel();
    }

    /* ============================================================
       SETTINGS PANEL - Comprehensive right-side editor
       ============================================================ */
    function renderSettingsPanel() {
        const panel = $('s360Settings');
        const actionsBar = $('s360Actions');
        if (!panel) return;

        if (!selectedId) {
            panel.innerHTML = '<div class="s360-settings-empty"><i class="fas fa-mouse-pointer"></i><p>Click any element on the canvas to edit it</p></div>';
            if (actionsBar) actionsBar.style.display = 'none';
            return;
        }

        const el = canvasElements.find(e => e.id === selectedId);
        if (!el) { panel.innerHTML = ''; return; }

        if (actionsBar) actionsBar.style.display = 'flex';

        let html = '';

        // Header
        html += '<div class="s360-settings-header">';
        html += '<div class="s360-settings-title"><i class="fas ' + esc(el.icon) + '"></i> ' + esc(el.label) + '</div>';
        html += '<span class="s360-settings-badge">' + esc(el.category) + '</span>';
        html += '</div>';

        // Controls
        if (el.controls && el.controls.length) {
            html += '<div class="s360-settings-fields">';
            el.controls.forEach((ctrl, ci) => {
                html += renderControl(el, ctrl, ci);
            });
            html += '</div>';
        }

        panel.innerHTML = html;

        // Bind input changes
        panel.querySelectorAll('.s360-ctrl').forEach(input => {
            const eventType = (input.type === 'range' || input.type === 'color') ? 'input' : 'change';
            input.addEventListener(eventType, () => {
                handleControlChange(el, input.dataset.key, input);
            });
        });

        // Bind image pickers
        panel.querySelectorAll('.s360-img-pick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                openImagePicker(el, key);
            });
        });
    }

    function renderControl(el, ctrl, index) {
        const inputId = 's360c_' + el.id + '_' + index;
        const val = ctrl.value != null ? ctrl.value : '';
        let input = '';

        switch (ctrl.type) {
            case 'text':
                input = '<input type="text" class="s360-ctrl" id="' + inputId + '" data-key="' + esc(ctrl.key) + '" value="' + esc(val) + '"' + (ctrl.readonly ? ' readonly' : '') + '>';
                break;
            case 'textarea':
                input = '<textarea class="s360-ctrl s360-ctrl-textarea" id="' + inputId + '" data-key="' + esc(ctrl.key) + '" rows="3">' + esc(val) + '</textarea>';
                break;
            case 'number':
                input = '<input type="number" class="s360-ctrl" id="' + inputId + '" data-key="' + esc(ctrl.key) + '" value="' + esc(val) + '"' + (ctrl.min != null ? ' min="' + ctrl.min + '"' : '') + (ctrl.max != null ? ' max="' + ctrl.max + '"' : '') + '>';
                break;
            case 'color':
                input = '<div class="s360-ctrl-color"><input type="color" class="s360-ctrl" id="' + inputId + '" data-key="' + esc(ctrl.key) + '" value="' + esc(val) + '"><span class="s360-ctrl-color-hex">' + esc(val) + '</span></div>';
                break;
            case 'toggle':
                input = '<label class="s360-ctrl-toggle"><input type="checkbox" class="s360-ctrl" id="' + inputId + '" data-key="' + esc(ctrl.key) + '"' + (val ? ' checked' : '') + '><span class="s360-ctrl-toggle-slider"></span></label>';
                break;
            case 'range':
                input = '<div class="s360-ctrl-range"><input type="range" class="s360-ctrl" id="' + inputId + '" data-key="' + esc(ctrl.key) + '" value="' + esc(val) + '" min="' + (ctrl.min || 0) + '" max="' + (ctrl.max || 1) + '" step="' + (ctrl.step || 0.1) + '"><span class="s360-ctrl-range-val">' + esc(val) + '</span></div>';
                break;
            case 'select':
                input = '<select class="s360-ctrl" id="' + inputId + '" data-key="' + esc(ctrl.key) + '">';
                (ctrl.options || []).forEach(opt => {
                    const optVal = typeof opt === 'string' ? opt : String(opt);
                    const optLabel = optVal.charAt(0).toUpperCase() + optVal.slice(1);
                    input += '<option value="' + esc(optVal) + '"' + (String(val) === optVal ? ' selected' : '') + '>' + esc(optLabel) + '</option>';
                });
                input += '</select>';
                break;
            case 'image':
                input = '<div class="s360-ctrl-image">';
                input += '<input type="text" class="s360-ctrl" id="' + inputId + '" data-key="' + esc(ctrl.key) + '" value="' + esc(val) + '" placeholder="Image URL">';
                input += '<button class="s360-img-pick-btn" data-key="' + esc(ctrl.key) + '"><i class="fas fa-folder-open"></i></button>';
                if (val) input += '<img src="' + esc(val) + '" class="s360-ctrl-img-preview" onerror="this.style.display=\'none\'">';
                input += '</div>';
                break;
            case 'icon':
                input = '<div class="s360-ctrl-icon">';
                input += '<input type="text" class="s360-ctrl" id="' + inputId + '" data-key="' + esc(ctrl.key) + '" value="' + esc(val) + '" placeholder="fa-icon-name">';
                input += '<span class="s360-ctrl-icon-preview"><i class="fas ' + esc(val) + '"></i></span>';
                input += '</div>';
                break;
            default:
                input = '<input type="text" class="s360-ctrl" id="' + inputId + '" data-key="' + esc(ctrl.key) + '" value="' + esc(val) + '">';
        }

        return '<div class="s360-settings-group">' +
            '<label class="s360-settings-label" for="' + inputId + '">' + esc(ctrl.label) + (ctrl.readonly ? ' <span class="s360-readonly">(read-only)</span>' : '') + '</label>' +
            '<div class="s360-settings-input">' + input + '</div>' +
            '</div>';
    }

    function handleControlChange(el, key, input) {
        let newValue;
        if (input.type === 'checkbox') newValue = input.checked;
        else if (input.type === 'range') newValue = parseFloat(input.value);
        else if (input.type === 'number') newValue = parseFloat(input.value);
        else newValue = input.value;

        // Update in element controls
        const ctrl = el.controls.find(c => c.key === key);
        if (ctrl) ctrl.value = newValue;

        // Update color hex
        if (input.type === 'color') {
            const hex = input.parentElement.querySelector('.s360-ctrl-color-hex');
            if (hex) hex.textContent = newValue;
        }
        // Update range value
        if (input.type === 'range') {
            const rv = input.parentElement.querySelector('.s360-ctrl-range-val');
            if (rv) rv.textContent = newValue;
        }
        // Update icon preview
        if (ctrl && ctrl.type === 'icon') {
            const ip = input.parentElement.querySelector('.s360-ctrl-icon-preview i');
            if (ip) ip.className = 'fas ' + newValue;
        }
        // Update image preview
        if (ctrl && ctrl.type === 'image') {
            const preview = input.parentElement.querySelector('.s360-ctrl-img-preview');
            if (newValue && preview) { preview.src = newValue; preview.style.display = ''; }
            else if (!newValue && preview) { preview.style.display = 'none'; }
        }

        // Push undo
        pushUndo();
    }

    /* ============================================================
       SAVE TO DATASTORE
       ============================================================ */
    function saveChanges() {
        if (!selectedId) { showToast('No element selected', 'warning'); return; }
        const el = canvasElements.find(e => e.id === selectedId);
        if (!el) return;

        try {
            // Build updated value object from controls
            const updated = {};
            el.controls.forEach(c => { updated[c.key] = c.value; });

            if (el.source === 'siteSettings') {
                const data = DataStore.getSiteSettings();
                Object.assign(data, updated);
                DataStore.setSiteSettings(data);
            } else if (el.source === 'navigation') {
                const data = DataStore.getNavigation();
                if (data.items && el.navIndex !== undefined) {
                    Object.assign(data.items[el.navIndex], updated);
                }
                DataStore.setNavigation(data);
            } else if (el.source === 'splash') {
                const data = DataStore.getSplash();
                Object.assign(data, updated);
                DataStore.setSplash(data);
            } else if (el.source === 'playerPrefs') {
                const data = DataStore.getPlayerPrefs();
                Object.assign(data, updated);
                DataStore.setPlayerPrefs(data);
            } else if (el.source === 'miniPlayerSettings') {
                const data = DataStore.getMiniPlayerSettings();
                Object.assign(data, updated);
                DataStore.setMiniPlayerSettings(data);
            } else if (el.dataIndex !== undefined) {
                // Array-based stores (songs, stations, ads, etc.)
                const getter = 'get' + el.source.charAt(0).toUpperCase() + el.source.slice(1);
                const setter = 'set' + el.source.charAt(0).toUpperCase() + el.source.slice(1);
                if (typeof DataStore[getter] === 'function' && typeof DataStore[setter] === 'function') {
                    const items = DataStore[getter]();
                    if (items[el.dataIndex]) {
                        Object.assign(items[el.dataIndex], updated);
                        DataStore[setter](items);
                    }
                }
            }

            localStorage.setItem('builderLastModified', Date.now().toString());
            showToast('Saved: ' + el.label, 'success');
            buildCanvasData();
            renderCanvas();
        } catch (e) {
            showToast('Error saving: ' + e.message, 'error');
        }
    }

    /* ============================================================
       PUBLISH - Triggers existing sync system
       ============================================================ */
    function publishChanges() {
        saveChanges();
        if (typeof syncToLiveWebsite === 'function') {
            syncToLiveWebsite();
            showToast('Published to live website', 'success');
        } else {
            showToast('Saved locally (sync function not available)', 'info');
        }
    }

    /* ============================================================
       DUPLICATE / DELETE / RESET
       ============================================================ */
    function duplicateSelected() {
        if (!selectedId) return;
        const el = canvasElements.find(e => e.id === selectedId);
        if (!el || el.dataIndex === undefined) { showToast('Cannot duplicate this element', 'warning'); return; }

        try {
            const getter = 'get' + el.source.charAt(0).toUpperCase() + el.source.slice(1);
            const setter = 'set' + el.source.charAt(0).toUpperCase() + el.source.slice(1);
            if (typeof DataStore[getter] !== 'function') return;
            const items = DataStore[getter]();
            if (!Array.isArray(items) || !items[el.dataIndex]) return;
            const clone = JSON.parse(JSON.stringify(items[el.dataIndex]));
            clone.id = 'dup_' + Date.now();
            if (clone.title) clone.title += ' (Copy)';
            if (clone.name) clone.name += ' (Copy)';
            items.splice(el.dataIndex + 1, 0, clone);
            DataStore[setter](items);
            buildCanvasData();
            renderCanvas();
            showToast('Duplicated: ' + el.label);
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    }

    function deleteSelected() {
        if (!selectedId) return;
        const el = canvasElements.find(e => e.id === selectedId);
        if (!el || el.dataIndex === undefined) { showToast('Cannot delete this element', 'warning'); return; }
        if (!confirm('Delete "' + el.label + '"?')) return;

        try {
            const getter = 'get' + el.source.charAt(0).toUpperCase() + el.source.slice(1);
            const setter = 'set' + el.source.charAt(0).toUpperCase() + el.source.slice(1);
            if (typeof DataStore[getter] !== 'function') return;
            const items = DataStore[getter]();
            if (!Array.isArray(items)) return;
            items.splice(el.dataIndex, 1);
            DataStore[setter](items);
            selectedId = null;
            buildCanvasData();
            renderCanvas();
            renderSettingsPanel();
            showToast('Deleted: ' + el.label);
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    }

    function resetSelected() {
        if (!selectedId) return;
        buildCanvasData();
        renderCanvas();
        renderSettingsPanel();
        showToast('Reset to saved values');
    }

    /* ============================================================
       UNDO / REDO
       ============================================================ */
    function pushUndo() {
        undoStack.push(JSON.stringify(canvasElements));
        if (undoStack.length > 50) undoStack.shift();
        redoStack = [];
    }

    function undo() {
        if (!undoStack.length) return;
        redoStack.push(JSON.stringify(canvasElements));
        const prev = JSON.parse(undoStack.pop());
        canvasElements = prev;
        renderCanvas();
        renderSettingsPanel();
    }

    function redo() {
        if (!redoStack.length) return;
        undoStack.push(JSON.stringify(canvasElements));
        const next = JSON.parse(redoStack.pop());
        canvasElements = next;
        renderCanvas();
        renderSettingsPanel();
    }

    /* ============================================================
       IMAGE PICKER
       ============================================================ */
    function openImagePicker(el, key) {
        const images = safeGet(() => DataStore.getImages(), []);
        if (!images.length) {
            showToast('No images uploaded. Use the Images section first.', 'info');
            return;
        }
        const url = prompt('Paste image URL or R2 path:\n\nUploaded images: ' + images.length + '\nType a URL to use:');
        if (url) {
            const ctrl = el.controls.find(c => c.key === key);
            if (ctrl) ctrl.value = url;
            renderSettingsPanel();
        }
    }

    /* ============================================================
       SEARCH / FILTER
       ============================================================ */
    function searchCanvas(query) {
        const cards = document.querySelectorAll('.s360-canvas-card');
        const q = (query || '').toLowerCase();
        cards.forEach(card => {
            const label = card.querySelector('.s360-canvas-card-label');
            const cat = card.querySelector('.s360-canvas-card-cat');
            const text = ((label ? label.textContent : '') + ' ' + (cat ? cat.textContent : '')).toLowerCase();
            card.style.display = !q || text.includes(q) ? '' : 'none';
        });
    }

    /* ============================================================
       TOAST
       ============================================================ */
    function showToast(msg, type) {
        let t = $('s360Toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 's360Toast';
            t.className = 's360-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.className = 's360-toast show' + (type === 'error' ? ' s360-toast-error' : '');
        clearTimeout(t._t);
        t._t = setTimeout(() => t.classList.remove('show'), 2800);
    }

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        buildCanvasData();
        renderCanvas();
        renderSettingsPanel();
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!$('site360Page') || $('site360Page').style.display === 'none') return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
            if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveChanges(); }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
            if (e.key === 'Escape') { selectedId = null; renderCanvas(); renderSettingsPanel(); }
        });
    }

    // Public API
    return {
        init,
        scan: init,
        refresh: () => { buildCanvasData(); renderCanvas(); renderSettingsPanel(); },
        selectElement,
        saveChanges,
        publishChanges,
        duplicateSelected,
        deleteSelected,
        resetSelected,
        undo, redo,
        searchCanvas,
        showToast,
        pickImage: openImagePicker
    };
})();
