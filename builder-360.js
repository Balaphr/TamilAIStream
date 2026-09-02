'use strict';
/* ============================================================
   Site 360 - Complete Website Control System
   Every website section, feature, and function is mapped here.
   Edits DataStore directly, publishes via existing sync system.
   ============================================================ */

const Site360 = (function () {
    let selectedId = null;
    let canvasElements = [];
    let undoStack = [];
    let redoStack = [];
    let _saveTimeout = null;

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    function safeGet(fn, fallback) {
        try { const v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; }
    }

    /* ============================================================
       FEATURE REGISTRY - Auto-detect & auto-configure features
       ============================================================ */
    const FEATURE_REGISTRY = {
        'music-by-era': {
            label: 'Music by Era (Decades)',
            icon: 'fa-clock',
            section: 'home',
            category: 'decades',
            source: 'siteSettings',
            files: { css: 'ai-glass.css', js: 'ai-home.js', html: 'index.html' },
            defaults: {
                decadesVisible: true,
                decadesTitle: 'Music by Era',
                decadesLayout: 'grid',
                decadesColumns: 4,
                decadesCardRadius: 18,
                decadesCardPadding: 24,
                decadesIconSize: 56,
                decadesShowCount: true,
                decadesCountLabel: 'songs',
                decadesAutoRotate: false,
                decadesRotateInterval: 20000,
                decadesAutoPlayEnabled: true,
                decadesAutoPlayShuffle: true,
                decadesAutoPlayLoop: true,
                decadesAutoPlayDelay: 300,
                decadesMediaSession: true,
                decadesMediaSessionArtwork: true,
                decadesMediaSessionActions: 'play,pause,stop,next,prev',
                decadesResponsiveMobile: '2col',
                decadesResponsiveTablet: '4col',
                decadesResponsiveDesktop: '4col',
                decadesPerfLazyLoad: true,
                decadesPerfThrottle: 16,
                decadesPerfHardwareAccel: true,
                decades80sGrad: 'linear-gradient(135deg,#f43f5e,#fb923c)',
                decades80sIcon: 'fa-compact-disc',
                decades80sGlow: 'rgba(244,63,94,0.3)',
                decades90sGrad: 'linear-gradient(135deg,#a855f7,#6366f1)',
                decades90sIcon: 'fa-record-vinyl',
                decades90sGlow: 'rgba(168,85,247,0.3)',
                decades2kGrad: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
                decades2kIcon: 'fa-compact-disc',
                decades2kGlow: 'rgba(59,130,246,0.3)',
                decadesNewGrad: 'linear-gradient(135deg,#34d399,#10b981)',
                decadesNewIcon: 'fa-headphones',
                decadesNewGlow: 'rgba(52,211,153,0.3)'
            },
            controls: [
                { key: 'decadesVisible', label: 'Visible', type: 'toggle' },
                { key: 'decadesTitle', label: 'Section Title', type: 'text' },
                { key: 'decadesLayout', label: 'Layout', type: 'select', options: ['grid', 'carousel', 'list'] },
                { key: 'decadesColumns', label: 'Grid Columns', type: 'number', min: 2, max: 6 },
                { key: 'decadesCardRadius', label: 'Card Border Radius (px)', type: 'number', min: 0, max: 40 },
                { key: 'decadesCardPadding', label: 'Card Padding (px)', type: 'number', min: 8, max: 48 },
                { key: 'decadesIconSize', label: 'Icon Size (px)', type: 'number', min: 24, max: 100 },
                { key: 'decadesShowCount', label: 'Show Song Count', type: 'toggle' },
                { key: 'decadesCountLabel', label: 'Count Label Text', type: 'text' },
                { key: 'decadesAutoRotate', label: 'Auto Rotate (Carousel)', type: 'toggle' },
                { key: 'decadesRotateInterval', label: 'Rotate Interval (ms)', type: 'number', min: 2000, max: 30000 },
                { key: 'decadesAutoPlayEnabled', label: 'AI Auto-Play Bot Enabled', type: 'toggle' },
                { key: 'decadesAutoPlayShuffle', label: 'Auto-Play Shuffle', type: 'toggle' },
                { key: 'decadesAutoPlayLoop', label: 'Auto-Play Loop', type: 'toggle' },
                { key: 'decadesAutoPlayDelay', label: 'Auto-Play Delay (ms)', type: 'number', min: 0, max: 3000 },
                { key: 'decadesMediaSession', label: 'Media Session API', type: 'toggle' },
                { key: 'decadesMediaSessionArtwork', label: 'Show Artwork in Notifications', type: 'toggle' },
                { key: 'decadesMediaSessionActions', label: 'Media Actions', type: 'text' },
                { key: 'decadesResponsiveMobile', label: 'Mobile Columns', type: 'select', options: ['1col', '2col'] },
                { key: 'decadesResponsiveTablet', label: 'Tablet Columns', type: 'select', options: ['2col', '3col', '4col'] },
                { key: 'decadesResponsiveDesktop', label: 'Desktop Columns', type: 'select', options: ['3col', '4col', '5col', '6col'] },
                { key: 'decadesPerfLazyLoad', label: 'Lazy Load Images', type: 'toggle' },
                { key: 'decadesPerfThrottle', label: 'Render Throttle (ms)', type: 'number', min: 0, max: 100 },
                { key: 'decadesPerfHardwareAccel', label: 'Hardware Acceleration', type: 'toggle' },
                { key: 'decades80sGrad', label: '80s Gradient', type: 'text' },
                { key: 'decades80sIcon', label: '80s Icon', type: 'icon' },
                { key: 'decades80sGlow', label: '80s Glow Color', type: 'color' },
                { key: 'decades90sGrad', label: '90s Gradient', type: 'text' },
                { key: 'decades90sIcon', label: '90s Icon', type: 'icon' },
                { key: 'decades90sGlow', label: '90s Glow Color', type: 'color' },
                { key: 'decades2kGrad', label: '2K Gradient', type: 'text' },
                { key: 'decades2kIcon', label: '2K Icon', type: 'icon' },
                { key: 'decades2kGlow', label: '2K Glow Color', type: 'color' },
                { key: 'decadesNewGrad', label: 'New Gradient', type: 'text' },
                { key: 'decadesNewIcon', label: 'New Icon', type: 'icon' },
                { key: 'decadesNewGlow', label: 'New Glow Color', type: 'color' }
            ]
        },
        'music-hero': {
            label: 'Music Hero',
            icon: 'fa-music',
            section: 'home',
            category: 'hero',
            source: 'siteSettings',
            files: { css: 'ai-glass.css', js: 'ai-home.js', html: 'index.html' },
            defaults: {
                musicHeroVisible: true, musicHeroTitle: 'Music',
                musicHeroEyebrow: 'TAMIL AI STREAM', musicHeroSubtitle: 'தமிழின் புதிய டிஜிட்டல் அனுபவம்',
                musicHeroArtSize: 128, musicHeroArtRadius: 34, musicHeroShowPlayBtn: true,
                musicHeroPlayBtnText: 'Play Now', musicHeroShowDots: true,
                musicHeroAutoRotate: true, musicHeroRotateInterval: 5500
            },
            controls: [
                { key: 'musicHeroVisible', label: 'Visible', type: 'toggle' },
                { key: 'musicHeroTitle', label: 'Title', type: 'text' },
                { key: 'musicHeroEyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'musicHeroSubtitle', label: 'Subtitle', type: 'text' },
                { key: 'musicHeroArtSize', label: 'Artwork Size (px)', type: 'number', min: 64, max: 200 },
                { key: 'musicHeroArtRadius', label: 'Artwork Radius (px)', type: 'number', min: 0, max: 50 },
                { key: 'musicHeroShowPlayBtn', label: 'Show Play Button', type: 'toggle' },
                { key: 'musicHeroPlayBtnText', label: 'Play Button Text', type: 'text' },
                { key: 'musicHeroShowDots', label: 'Show Slide Dots', type: 'toggle' },
                { key: 'musicHeroAutoRotate', label: 'Auto Rotate', type: 'toggle' },
                { key: 'musicHeroRotateInterval', label: 'Rotate Interval (ms)', type: 'number', min: 2000, max: 15000 }
            ]
        },
        'ai-recommendations': {
            label: 'AI Recommendations',
            icon: 'fa-wand-magic-sparkles',
            section: 'home',
            category: 'ai',
            source: 'siteSettings',
            files: { css: 'ai-glass.css', js: 'ai-home.js', html: 'index.html' },
            defaults: { aiRecVisible: true, aiRecTitle: 'AI Recommendations', aiRecMax: 6, aiRecShowGreeting: true, aiRecShowDiscoverBtn: true, aiRecDiscoverText: 'Discover with AI' },
            controls: [
                { key: 'aiRecVisible', label: 'Visible', type: 'toggle' },
                { key: 'aiRecTitle', label: 'Title', type: 'text' },
                { key: 'aiRecMax', label: 'Max Items', type: 'number', min: 2, max: 20 },
                { key: 'aiRecShowGreeting', label: 'Show AI Greeting', type: 'toggle' },
                { key: 'aiRecShowDiscoverBtn', label: 'Show Discover Button', type: 'toggle' },
                { key: 'aiRecDiscoverText', label: 'Discover Button Text', type: 'text' }
            ]
        },
        'live-tamil-news': {
            label: 'Live Tamil News',
            icon: 'fa-newspaper',
            section: 'home',
            category: 'news',
            source: 'siteSettings',
            files: { css: 'ai-glass.css', js: 'ai-home.js', html: 'index.html' },
            defaults: {
                liveNewsVisible: true, liveNewsTitle: 'Live Tamil News', liveNewsMax: 6, liveNewsLayout: 'list',
                liveNewsShowThumbnails: true, liveNewsShowTime: true, liveNewsHighlightHours: 6,
                liveNewsTnPriority: true, liveNewsShowBadge: true, liveNewsRefreshInterval: 300000,
                liveNewsShowDetail: true, liveNewsRetainHours: 72, liveNewsShowNavButtons: true,
                liveNewsShowViewButton: true, liveNewsShowRefreshIndicator: true,
                liveNewsAutoRefreshEnabled: true, liveNewsAutoRefreshInterval: 300000,
                liveNewsAutoRefreshOnFocus: true, liveNewsAutoRefreshIndicator: true,
                liveNewsCardBg: 'rgba(255,255,255,0.04)', liveNewsCardRadius: 14,
                liveNewsCardGap: 10, liveNewsThumbWidth: 84, liveNewsThumbHeight: 62,
                liveNewsSeeAllMax: 25, liveNewsShowDetailPlayer: true
            },
            controls: [
                { key: 'liveNewsVisible', label: 'Visible', type: 'toggle' },
                { key: 'liveNewsTitle', label: 'Section Title', type: 'text' },
                { key: 'liveNewsMax', label: 'Max Items Shown', type: 'number', min: 1, max: 40 },
                { key: 'liveNewsLayout', label: 'Layout', type: 'select', options: ['list', 'grid', 'compact'] },
                { key: 'liveNewsShowThumbnails', label: 'Show Thumbnails', type: 'toggle' },
                { key: 'liveNewsShowTime', label: 'Show Time Ago', type: 'toggle' },
                { key: 'liveNewsHighlightHours', label: 'Highlight Fresh News (hours)', type: 'number', min: 1, max: 48 },
                { key: 'liveNewsTnPriority', label: 'TN Priority Badge', type: 'toggle' },
                { key: 'liveNewsShowBadge', label: 'Show NEW Badge', type: 'toggle' },
                { key: 'liveNewsShowDetail', label: 'Open Detail View on Click', type: 'toggle' },
                { key: 'liveNewsShowDetailPlayer', label: 'Keep Player on Detail', type: 'toggle' },
                { key: 'liveNewsCardBg', label: 'Card Background', type: 'color' },
                { key: 'liveNewsCardRadius', label: 'Card Radius (px)', type: 'number', min: 0, max: 30 },
                { key: 'liveNewsCardGap', label: 'Card Gap (px)', type: 'number', min: 0, max: 24 },
                { key: 'liveNewsThumbWidth', label: 'Thumbnail Width (px)', type: 'number', min: 40, max: 160 },
                { key: 'liveNewsThumbHeight', label: 'Thumbnail Height (px)', type: 'number', min: 30, max: 120 },
                { key: 'liveNewsSeeAllMax', label: 'See All Max Items', type: 'number', min: 5, max: 50 },
                { key: 'liveNewsRetainHours', label: 'Retention Period (hours)', type: 'number', min: 6, max: 168 },
                { key: 'liveNewsShowNavButtons', label: 'Show Prev/Next Buttons', type: 'toggle' },
                { key: 'liveNewsShowViewButton', label: 'Show View Article Button', type: 'toggle' },
                { key: 'liveNewsShowRefreshIndicator', label: 'Show Refresh Indicator', type: 'toggle' },
                { key: 'liveNewsAutoRefreshEnabled', label: 'Auto-Refresh Bot Enabled', type: 'toggle' },
                { key: 'liveNewsAutoRefreshInterval', label: 'Bot Refresh Interval (ms)', type: 'number', min: 30000, max: 3600000 },
                { key: 'liveNewsAutoRefreshOnFocus', label: 'Refresh on Tab Focus', type: 'toggle' },
                { key: 'liveNewsAutoRefreshIndicator', label: 'Bot Show Status Indicator', type: 'toggle' }
            ]
        },
        'live-fm': {
            label: 'Live FM Stations',
            icon: 'fa-tower-broadcast',
            section: 'home',
            category: 'fm',
            source: 'siteSettings',
            files: { css: 'ai-glass.css', js: 'ai-home.js', html: 'index.html' },
            defaults: { liveFmVisible: true, liveFmTitle: 'Live FM Stations', liveFmMax: 6, liveFmColumns: '2', liveFmShowBadge: true, liveFmShowFreq: true, liveFmShowListeners: true, liveFmShowWave: true },
            controls: [
                { key: 'liveFmVisible', label: 'Visible', type: 'toggle' },
                { key: 'liveFmTitle', label: 'Title', type: 'text' },
                { key: 'liveFmMax', label: 'Max Stations', type: 'number', min: 1, max: 20 },
                { key: 'liveFmColumns', label: 'Columns', type: 'select', options: ['1', '2', '3'] },
                { key: 'liveFmShowBadge', label: 'Show LIVE Badge', type: 'toggle' },
                { key: 'liveFmShowFreq', label: 'Show Frequency', type: 'toggle' },
                { key: 'liveFmShowListeners', label: 'Show Listeners', type: 'toggle' },
                { key: 'liveFmShowWave', label: 'Show EQ Wave', type: 'toggle' }
            ]
        },
        'greeting': {
            label: 'Greeting Section',
            icon: 'fa-hand-wave',
            section: 'home',
            category: 'greeting',
            source: 'siteSettings',
            files: { css: 'ai-glass.css', js: 'ai-home.js', html: 'index.html' },
            defaults: { greetingVisible: true, greetingShowTime: true, greetingShowWeather: true, greetingShowQuote: true },
            controls: [
                { key: 'greetingVisible', label: 'Visible', type: 'toggle' },
                { key: 'greetingShowTime', label: 'Show Time', type: 'toggle' },
                { key: 'greetingShowWeather', label: 'Show Weather', type: 'toggle' },
                { key: 'greetingShowQuote', label: 'Show Quote', type: 'toggle' }
            ]
        },
        'recently-played': {
            label: 'Recently Played',
            icon: 'fa-clock-rotate-left',
            section: 'home',
            category: 'recently',
            source: 'siteSettings',
            files: { css: 'ai-glass.css', js: 'ai-home.js', html: 'index.html' },
            defaults: { recentlyVisible: true, recentlyTitle: 'Recently Played', recentlyMax: 12, recentlyShowDuration: true },
            controls: [
                { key: 'recentlyVisible', label: 'Visible', type: 'toggle' },
                { key: 'recentlyTitle', label: 'Title', type: 'text' },
                { key: 'recentlyMax', label: 'Max Items', type: 'number', min: 2, max: 30 },
                { key: 'recentlyShowDuration', label: 'Show Duration', type: 'toggle' }
            ]
        },
        'trending-playlists': {
            label: 'Trending Playlists',
            icon: 'fa-fire',
            section: 'home',
            category: 'trending',
            source: 'siteSettings',
            files: { css: 'ai-glass.css', js: 'ai-home.js', html: 'index.html' },
            defaults: { trendingPlaylistsVisible: true, trendingPlaylistsTitle: 'Trending Playlists', trendingPlaylistsMax: 10, trendingPlaylistsCardWidth: 164, trendingPlaylistsShowCount: true, trendingPlaylistsShowPlayBtn: true, trendingPlaylistsScrollSnap: 'proximity' },
            controls: [
                { key: 'trendingPlaylistsVisible', label: 'Visible', type: 'toggle' },
                { key: 'trendingPlaylistsTitle', label: 'Title', type: 'text' },
                { key: 'trendingPlaylistsMax', label: 'Max Items', type: 'number', min: 2, max: 30 },
                { key: 'trendingPlaylistsCardWidth', label: 'Card Width (px)', type: 'number', min: 100, max: 250 },
                { key: 'trendingPlaylistsShowCount', label: 'Show Count', type: 'toggle' },
                { key: 'trendingPlaylistsShowPlayBtn', label: 'Show Play Button', type: 'toggle' },
                { key: 'trendingPlaylistsScrollSnap', label: 'Scroll Snap', type: 'select', options: ['none', 'proximity', 'mandatory'] }
            ]
        },
        'splash-screen': {
            label: 'Splash Screen',
            icon: 'fa-play-circle',
            section: 'global',
            category: 'splash',
            source: 'splash',
            files: { css: 'premium-ui.css', js: 'script.js', html: 'index.html' },
            defaults: { enabled: true, title: 'Tamil AI Stream', subtitle: 'AI-Powered Tamil Radio', duration: 600, showEqualizer: true, showLoadingBar: true, showSkipBtn: true },
            controls: [
                { key: 'enabled', label: 'Enabled', type: 'toggle' },
                { key: 'title', label: 'Title', type: 'text' },
                { key: 'subtitle', label: 'Subtitle', type: 'text' },
                { key: 'background', label: 'Background Image', type: 'image' },
                { key: 'duration', label: 'Duration (ms)', type: 'number', min: 0, max: 5000 },
                { key: 'showEqualizer', label: 'Show Equalizer', type: 'toggle' },
                { key: 'showLoadingBar', label: 'Show Loading Bar', type: 'toggle' },
                { key: 'showSkipBtn', label: 'Show Skip Button', type: 'toggle' }
            ]
        },
        'player-settings': {
            label: 'Player Settings',
            icon: 'fa-headphones',
            section: 'global',
            category: 'player',
            source: 'playerPrefs',
            files: { css: 'global-player.css', js: 'global-player.js', html: 'index.html' },
            defaults: { volume: 0.7, autoPlay: false, crossfade: false, crossfadeDuration: 3, repeat: 'off', shuffle: false },
            controls: [
                { key: 'volume', label: 'Default Volume', type: 'range', min: 0, max: 1, step: 0.1 },
                { key: 'autoPlay', label: 'Auto Play', type: 'toggle' },
                { key: 'crossfade', label: 'Crossfade', type: 'toggle' },
                { key: 'crossfadeDuration', label: 'Crossfade Duration (s)', type: 'number', min: 1, max: 12 },
                { key: 'repeat', label: 'Repeat Mode', type: 'select', options: ['off', 'all', 'one'] },
                { key: 'shuffle', label: 'Shuffle', type: 'toggle' }
            ]
        },
        'bottom-nav': {
            label: 'Bottom Navigation',
            icon: 'fa-navicon',
            section: 'global',
            category: 'navigation',
            source: 'siteSettings',
            files: { css: 'premium-ui.css', js: 'script.js', html: 'index.html' },
            defaults: { bottomNavVisible: true, bottomNavBg: '#080c16', bottomNavOpacity: 0.92, bottomNavBlur: 32, bottomNavHeight: 60, bottomNavActiveColor: '#34d399', bottomNavItems: 'Home,Explore,Playlists,Stations,History' },
            controls: [
                { key: 'bottomNavVisible', label: 'Visible', type: 'toggle' },
                { key: 'bottomNavBg', label: 'Background', type: 'color' },
                { key: 'bottomNavOpacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01 },
                { key: 'bottomNavBlur', label: 'Blur (px)', type: 'number', min: 0, max: 40 },
                { key: 'bottomNavHeight', label: 'Height (px)', type: 'number', min: 44, max: 80 },
                { key: 'bottomNavActiveColor', label: 'Active Color', type: 'color' },
                { key: 'bottomNavItems', label: 'Nav Items', type: 'text' }
            ]
        },
        'new-album': {
            label: 'New Album',
            icon: 'fa-record-vinyl',
            section: 'home',
            category: 'new-album',
            source: 'siteSettings',
            files: { css: 'ai-glass.css', js: 'ai-home.js', html: 'index.html' },
            defaults: {
                newAlbumVisible: true,
                newAlbumTitle: 'New Album',
                newAlbumHeight: 340,
                newAlbumCardWidth: 340,
                newAlbumCardRadius: 20,
                newAlbumThumbSize: 90,
                newAlbumThumbRadius: 14,
                newAlbumPlayBtnPosition: 'center',
                newAlbumShowSpatialBadge: true,
                newAlbumShowAtmosBadge: true,
                newAlbumShowMeta: true,
                newAlbumShowDesc: true,
                newAlbumShowArtist: true,
                newAlbumSectionSpacing: 20,
                newAlbumCardSpacing: 18,
                newAlbumLayout: 'scroll',
                newAlbumTitleSize: 1.15,
                newAlbumTitleWeight: 800,
                newAlbumTitleColor: 'rgba(255,255,255,0.95)',
                newAlbumArtistSize: 0.82,
                newAlbumArtistColor: '#22d3ee',
                newAlbumDescSize: 0.74,
                newAlbumDescColor: 'rgba(255,255,255,0.45)',
                newAlbumBg: 'rgba(255,255,255,0.04)',
                newAlbumBorder: '1px solid rgba(255,255,255,0.08)',
                newAlbumShadow: '0 8px 32px rgba(0,0,0,0.3)',
                newAlbumHoverScale: 1.02,
                newAlbumHoverY: -6,
                newAlbumHoverShadow: '0 18px 48px rgba(0,0,0,0.45)',
                newAlbumHoverBorder: 'rgba(168,85,247,0.35)',
                newAlbumArtBlur: 30,
                newAlbumTransition: '0.35s cubic-bezier(0.4,0,0.2,1)',
                newAlbumMobileWidth: 280,
                newAlbumMobileThumb: 68,
                newAlbumTabletWidth: 300,
                newAlbumMobileSpacing: 14,
                newAlbumPaddingX: 20,
                newAlbumPaddingY: 20,
                newAlbumSectionBg: 'transparent',
                newAlbumShowLabel: true,
                newAlbumLabelText: 'New Album',
                newAlbumLabelSize: 0.6,
                newAlbumLabelColor: 'rgba(255,255,255,0.35)',
                newAlbumPlayBtnSize: 36,
                newAlbumPlayBtnBg: 'rgba(255,255,255,0.95)',
                newAlbumPlayBtnColor: '#0d1a2e',
                newAlbumBadgeRadius: 8,
                newAlbumBadgeSize: 0.58
            },
            controls: [
                { key: 'newAlbumVisible', label: 'Visible', type: 'toggle' },
                { key: 'newAlbumTitle', label: 'Section Title', type: 'text' },
                { key: 'newAlbumLayout', label: 'Layout', type: 'select', options: ['scroll', 'grid'] },
                { key: 'newAlbumShowLabel', label: 'Show "New Album" Label', type: 'toggle' },
                { key: 'newAlbumLabelText', label: 'Label Text', type: 'text' },
                { key: 'newAlbumShowArtist', label: 'Show Artist Name', type: 'toggle' },
                { key: 'newAlbumShowDesc', label: 'Show Description', type: 'toggle' },
                { key: 'newAlbumShowMeta', label: 'Show Meta Info', type: 'toggle' },
                { key: 'newAlbumShowSpatialBadge', label: 'Show Spatial Audio Badge', type: 'toggle' },
                { key: 'newAlbumShowAtmosBadge', label: 'Show Dolby Atmos Badge', type: 'toggle' },
                { key: 'newAlbumCardWidth', label: 'Card Width (px)', type: 'number', min: 200, max: 500 },
                { key: 'newAlbumCardRadius', label: 'Card Border Radius (px)', type: 'number', min: 0, max: 40 },
                { key: 'newAlbumCardSpacing', label: 'Card Spacing (px)', type: 'number', min: 0, max: 48 },
                { key: 'newAlbumHeight', label: 'Card Art Height (px)', type: 'number', min: 120, max: 400 },
                { key: 'newAlbumThumbSize', label: 'Thumbnail Size (px)', type: 'number', min: 40, max: 160 },
                { key: 'newAlbumThumbRadius', label: 'Thumbnail Radius (px)', type: 'number', min: 0, max: 40 },
                { key: 'newAlbumPlayBtnPosition', label: 'Play Button Position', type: 'select', options: ['center', 'top-left', 'bottom-right'] },
                { key: 'newAlbumPlayBtnSize', label: 'Play Button Size (px)', type: 'number', min: 24, max: 64 },
                { key: 'newAlbumPlayBtnBg', label: 'Play Button Background', type: 'color' },
                { key: 'newAlbumPlayBtnColor', label: 'Play Button Color', type: 'color' },
                { key: 'newAlbumTitleSize', label: 'Title Font Size (rem)', type: 'number', min: 0.6, max: 2, step: 0.05 },
                { key: 'newAlbumTitleWeight', label: 'Title Font Weight', type: 'number', min: 100, max: 900, step: 100 },
                { key: 'newAlbumTitleColor', label: 'Title Color', type: 'color' },
                { key: 'newAlbumArtistSize', label: 'Artist Font Size (rem)', type: 'number', min: 0.5, max: 1.5, step: 0.05 },
                { key: 'newAlbumArtistColor', label: 'Artist Color', type: 'color' },
                { key: 'newAlbumDescSize', label: 'Description Font Size (rem)', type: 'number', min: 0.5, max: 1.2, step: 0.05 },
                { key: 'newAlbumDescColor', label: 'Description Color', type: 'color' },
                { key: 'newAlbumLabelSize', label: 'Label Font Size (rem)', type: 'number', min: 0.4, max: 1, step: 0.05 },
                { key: 'newAlbumLabelColor', label: 'Label Color', type: 'color' },
                { key: 'newAlbumBadgeSize', label: 'Badge Font Size (rem)', type: 'number', min: 0.4, max: 1, step: 0.05 },
                { key: 'newAlbumBadgeRadius', label: 'Badge Radius (px)', type: 'number', min: 0, max: 20 },
                { key: 'newAlbumBg', label: 'Card Background', type: 'color' },
                { key: 'newAlbumBorder', label: 'Card Border', type: 'text' },
                { key: 'newAlbumShadow', label: 'Card Shadow', type: 'text' },
                { key: 'newAlbumHoverScale', label: 'Hover Scale', type: 'number', min: 0.9, max: 1.2, step: 0.01 },
                { key: 'newAlbumHoverY', label: 'Hover Y Offset (px)', type: 'number', min: -20, max: 20 },
                { key: 'newAlbumHoverShadow', label: 'Hover Shadow', type: 'text' },
                { key: 'newAlbumHoverBorder', label: 'Hover Border Color', type: 'color' },
                { key: 'newAlbumArtBlur', label: 'Art Background Blur (px)', type: 'number', min: 0, max: 60 },
                { key: 'newAlbumTransition', label: 'Transition', type: 'text' },
                { key: 'newAlbumSectionSpacing', label: 'Section Margin (px)', type: 'number', min: 0, max: 48 },
                { key: 'newAlbumPaddingX', label: 'Section Padding X (px)', type: 'number', min: 0, max: 48 },
                { key: 'newAlbumPaddingY', label: 'Section Padding Y (px)', type: 'number', min: 0, max: 48 },
                { key: 'newAlbumSectionBg', label: 'Section Background', type: 'color' },
                { key: 'newAlbumMobileWidth', label: 'Mobile Card Width (px)', type: 'number', min: 200, max: 400 },
                { key: 'newAlbumMobileThumb', label: 'Mobile Thumbnail Size (px)', type: 'number', min: 40, max: 120 },
                { key: 'newAlbumMobileSpacing', label: 'Mobile Card Spacing (px)', type: 'number', min: 0, max: 32 },
                { key: 'newAlbumTabletWidth', label: 'Tablet Card Width (px)', type: 'number', min: 200, max: 400 }
            ]
        }
    };

    /* ============================================================
       FEATURE AGENT - Activity timeline & status per feature
       ============================================================ */
    const _agentLog = {};
    const _agentSnapshots = {};
    const _agentPolling = {};

    function agentLog(featureId, action, detail, status) {
        if (!_agentLog[featureId]) _agentLog[featureId] = [];
        const entry = { ts: Date.now(), action, detail, status: status || 'done' };
        _agentLog[featureId].push(entry);
        if (_agentLog[featureId].length > 50) _agentLog[featureId].shift();
        _renderAgentPanel(featureId);
    }

    function agentGetLog(featureId) {
        return _agentLog[featureId] || [];
    }

    function agentTakeSnapshot(featureId) {
        const site = safeGet(() => DataStore.getSiteSettings(), {});
        _agentSnapshots[featureId] = JSON.parse(JSON.stringify(site));
        agentLog(featureId, 'snapshot', 'Configuration snapshot saved', 'done');
    }

    function agentRollback(featureId) {
        if (!_agentSnapshots[featureId]) {
            showToast('No snapshot available for rollback', 'warning');
            return;
        }
        const site = DataStore.getSiteSettings();
        const snapshot = _agentSnapshots[featureId];
        const reg = FEATURE_REGISTRY[featureId];
        if (reg && reg.defaults) {
            Object.keys(reg.defaults).forEach(k => {
                if (snapshot[k] !== undefined) site[k] = snapshot[k];
                else delete site[k];
            });
        }
        DataStore.setSiteSettings(site);
        agentLog(featureId, 'rollback', 'Rolled back to previous snapshot', 'done');
        buildCanvasData();
        renderCanvas();
        renderSettingsPanel();
        showToast('Rolled back: ' + (reg ? reg.label : featureId), 'success');
    }

    function agentGetCompletion(featureId) {
        const reg = FEATURE_REGISTRY[featureId];
        if (!reg) return { pct: 0, items: [] };
        const site = safeGet(() => DataStore.getSiteSettings(), {});
        const items = [];
        let done = 0;
        const total = reg.controls.length;
        reg.controls.forEach(c => {
            const val = site[c.key];
            const hasVal = val !== undefined && val !== null && val !== '';
            items.push({ label: c.label, key: c.key, configured: hasVal, value: val });
            if (hasVal) done++;
        });
        return { pct: total ? Math.round((done / total) * 100) : 0, items };
    }

    function _renderAgentPanel(featureId) {
        const panel = $('s360AgentPanel');
        if (!panel) return;
        const reg = FEATURE_REGISTRY[featureId];
        if (!reg) { panel.innerHTML = ''; panel.style.display = 'none'; return; }

        panel.style.display = '';
        const log = agentGetLog(featureId);
        const comp = agentGetCompletion(featureId);
        const logHtml = log.slice(-12).reverse().map(e => {
            const time = new Date(e.ts).toLocaleTimeString();
            const statusIcon = e.status === 'done' ? '<i class="fas fa-check-circle" style="color:#34d399;"></i>' :
                               e.status === 'pending' ? '<i class="fas fa-spinner fa-spin" style="color:#fbbf24;"></i>' :
                               e.status === 'error' ? '<i class="fas fa-exclamation-circle" style="color:#ef4444;"></i>' :
                               '<i class="fas fa-info-circle" style="color:#38bdf8;"></i>';
            return '<div class="s360-agent-log-entry">' + statusIcon +
                   '<span class="s360-agent-log-action">' + esc(e.action) + '</span>' +
                   '<span class="s360-agent-log-detail">' + esc(e.detail) + '</span>' +
                   '<span class="s360-agent-log-time">' + time + '</span></div>';
        }).join('');

        const itemsHtml = comp.items.map(it =>
            '<div class="s360-agent-item' + (it.configured ? ' done' : '') + '">' +
            (it.configured ? '<i class="fas fa-check" style="color:#34d399;"></i>' : '<i class="fas fa-circle" style="color:rgba(255,255,255,0.2);"></i>') +
            '<span>' + esc(it.label) + '</span></div>'
        ).join('');

        panel.innerHTML =
            '<div class="s360-agent-header">' +
            '<div class="s360-agent-title"><i class="fas ' + esc(reg.icon) + '"></i> ' + esc(reg.label) + ' Agent</div>' +
            '<div class="s360-agent-badge">' + comp.pct + '% ready</div>' +
            '</div>' +
            '<div class="s360-agent-progress"><div class="s360-agent-progress-bar" style="width:' + comp.pct + '%"></div></div>' +
            '<div class="s360-agent-files">' +
            '<span class="s360-agent-file"><i class="fas fa-file-code"></i> ' + esc(reg.files.js || '') + '</span>' +
            '<span class="s360-agent-file"><i class="fas fa-file-css"></i> ' + esc(reg.files.css || '') + '</span>' +
            '<span class="s360-agent-file"><i class="fas fa-file-code"></i> ' + esc(reg.files.html || '') + '</span>' +
            '</div>' +
            '<div class="s360-agent-section-title">Configuration Status</div>' +
            '<div class="s360-agent-items">' + itemsHtml + '</div>' +
            '<div class="s360-agent-section-title">Activity Timeline</div>' +
            '<div class="s360-agent-log">' + (logHtml || '<div class="s360-agent-log-empty">No activity yet</div>') + '</div>' +
            '<div class="s360-agent-actions">' +
            '<button class="builder-btn" onclick="Site360.agentRollback(\'' + esc(featureId) + '\')"><i class="fas fa-rotate-left"></i> Rollback</button>' +
            '<button class="builder-btn" onclick="Site360.agentTakeSnapshot(\'' + esc(featureId) + '\')"><i class="fas fa-camera"></i> Snapshot</button>' +
            '<button class="builder-btn primary" onclick="Site360.agentSyncFeature(\'' + esc(featureId) + '\')"><i class="fas fa-sync"></i> Sync Now</button>' +
            '</div>';
    }

    function agentSyncFeature(featureId) {
        const reg = FEATURE_REGISTRY[featureId];
        if (!reg) return;
        agentLog(featureId, 'sync', 'Starting full sync...', 'pending');
        autoConfigureFeature(featureId);
        setTimeout(() => {
            agentLog(featureId, 'sync', 'Builder config updated', 'done');
            buildCanvasData();
            renderCanvas();
            if (typeof syncToLiveWebsite === 'function') {
                syncToLiveWebsite();
                agentLog(featureId, 'publish', 'Published to live website', 'done');
            }
            agentLog(featureId, 'complete', 'All components synchronized', 'done');
            showToast('Synced: ' + reg.label, 'success');
        }, 300);
    }

    /* ============================================================
       AUTO-CONFIGURE - Create settings for any feature automatically
       ============================================================ */
    function autoConfigureFeature(featureId) {
        const reg = FEATURE_REGISTRY[featureId];
        if (!reg || !reg.defaults) return;
        let data;
        if (reg.source === 'siteSettings') data = DataStore.getSiteSettings();
        else if (reg.source === 'splash') data = DataStore.getSplash();
        else if (reg.source === 'playerPrefs') data = DataStore.getPlayerPrefs();
        else data = DataStore.getSiteSettings();

        let changed = 0;
        Object.keys(reg.defaults).forEach(key => {
            if (data[key] === undefined || data[key] === null) {
                data[key] = reg.defaults[key];
                changed++;
            }
        });

        if (reg.source === 'siteSettings') DataStore.setSiteSettings(data);
        else if (reg.source === 'splash') DataStore.setSplash(data);
        else if (reg.source === 'playerPrefs') DataStore.setPlayerPrefs(data);

        if (changed > 0) {
            agentLog(featureId, 'auto-config', 'Created ' + changed + ' new settings with defaults', 'done');
        }
        return changed;
    }

    function autoConfigureAllFeatures() {
        let total = 0;
        Object.keys(FEATURE_REGISTRY).forEach(fid => {
            const n = autoConfigureFeature(fid);
            if (n) total += n;
        });
        if (total > 0) {
            agentLog('system', 'auto-config', 'Auto-configured ' + total + ' settings across all features', 'done');
        }
        return total;
    }

    /* ============================================================
       FEATURE REGISTRY - Build controls from registry for canvas
       ============================================================ */
    function buildRegistryElements() {
        Object.keys(FEATURE_REGISTRY).forEach(featureId => {
            const reg = FEATURE_REGISTRY[featureId];
            const source = reg.source || 'siteSettings';
            let data;
            if (source === 'siteSettings') data = safeGet(() => DataStore.getSiteSettings(), {});
            else if (source === 'splash') data = safeGet(() => DataStore.getSplash(), {});
            else if (source === 'playerPrefs') data = safeGet(() => DataStore.getPlayerPrefs(), {});
            else data = safeGet(() => DataStore.getSiteSettings(), {});

            const controls = reg.controls.map(c => ({
                ...c,
                value: data[c.key] != null ? data[c.key] : (reg.defaults[c.key] != null ? reg.defaults[c.key] : '')
            }));

            canvasElements.push({
                id: 'el_feature_' + featureId,
                section: reg.section,
                label: reg.label,
                icon: reg.icon,
                category: reg.category,
                source: source,
                featureId: featureId,
                value: data,
                controls: controls
            });
        });
    }

    /* ============================================================
       CANVAS DATA - Maps EVERY website element to editable props
       ============================================================ */
    function buildCanvasData() {
        canvasElements = [];
        const site = safeGet(() => DataStore.getSiteSettings(), {});

        // ═══════════════════════════════════════════════
        // SECTION 1: GLOBAL SETTINGS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_site_title', section: 'global', label: 'Site Identity', icon: 'fa-heading',
            category: 'settings', source: 'siteSettings', field: 'title',
            value: site,
            controls: [
                { key: 'title', label: 'Site Title', type: 'text', value: site.title || 'Tamil AI Stream' },
                { key: 'description', label: 'Site Description', type: 'textarea', value: site.description || '' },
                { key: 'logo', label: 'Logo Image', type: 'image', value: site.logo || '' },
                { key: 'favicon', label: 'Favicon', type: 'image', value: site.favicon || '' },
                { key: 'themeColor', label: 'Theme Color', type: 'color', value: site.themeColor || '#34d399' },
                { key: 'accentColor', label: 'Accent Color', type: 'color', value: site.accentColor || '#38bdf8' },
                { key: 'fontFamily', label: 'Font Family', type: 'select', value: site.fontFamily || 'Inter', options: ['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Montserrat', 'Raleway', 'Nunito', 'Outfit'] }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 2: BACKGROUND & THEME
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_bg_theme', section: 'global', label: 'Background & Theme', icon: 'fa-palette',
            category: 'theme', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'bgColor', label: 'Body Background', type: 'color', value: site.bgColor || '#05070f' },
                { key: 'textColor', label: 'Primary Text Color', type: 'color', value: site.textColor || '#ffffff' },
                { key: 'textColor2', label: 'Secondary Text Color', type: 'color', value: site.textColor2 || 'rgba(255,255,255,0.7)' },
                { key: 'textColor3', label: 'Muted Text Color', type: 'color', value: site.textColor3 || 'rgba(255,255,255,0.4)' },
                { key: 'borderRadius', label: 'Global Border Radius', type: 'text', value: site.borderRadius || '18px' },
                { key: 'glowEnabled', label: 'Ambient Glow Enabled', type: 'toggle', value: site.glowEnabled !== false },
                { key: 'glowColor1', label: 'Glow Orb 1 (Top-Left)', type: 'color', value: site.glowColor1 || '#2563eb' },
                { key: 'glowColor2', label: 'Glow Orb 2 (Top-Right)', type: 'color', value: site.glowColor2 || '#8b5cf6' },
                { key: 'glowColor3', label: 'Glow Orb 3 (Bottom)', type: 'color', value: site.glowColor3 || '#06b6d4' },
                { key: 'glowOpacity', label: 'Glow Intensity', type: 'range', value: site.glowOpacity ?? 0.15, min: 0, max: 0.5, step: 0.01 },
                { key: 'noiseOverlay', label: 'Noise Texture Overlay', type: 'toggle', value: site.noiseOverlay !== false }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 3: TOP HEADER
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_header', section: 'global', label: 'Top Header', icon: 'fa-bars',
            category: 'header', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'headerVisible', label: 'Header Visible', type: 'toggle', value: site.headerVisible !== false },
                { key: 'headerBg', label: 'Header Background', type: 'color', value: site.headerBg || '#0a0f1e' },
                { key: 'headerOpacity', label: 'Header Opacity', type: 'range', value: site.headerOpacity ?? 0.92, min: 0, max: 1, step: 0.01 },
                { key: 'headerBlur', label: 'Header Blur (px)', type: 'number', value: site.headerBlur ?? 20, min: 0, max: 40 },
                { key: 'headerHeight', label: 'Header Height (px)', type: 'number', value: site.headerHeight ?? 60, min: 40, max: 100 },
                { key: 'searchPlaceholder', label: 'Search Placeholder', type: 'text', value: site.searchPlaceholder || 'Search songs, artists...' },
                { key: 'showSearch', label: 'Show Search Bar', type: 'toggle', value: site.showSearch !== false },
                { key: 'showNotifications', label: 'Show Notifications Bell', type: 'toggle', value: site.showNotifications !== false },
                { key: 'showUserMenu', label: 'Show User Menu', type: 'toggle', value: site.showUserMenu !== false }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 4: BOTTOM NAVIGATION (PWA/Mobile)
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_bottom_nav', section: 'global', label: 'Bottom Navigation', icon: 'fa-navicon',
            category: 'navigation', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'bottomNavVisible', label: 'Bottom Nav Visible', type: 'toggle', value: site.bottomNavVisible !== false },
                { key: 'bottomNavBg', label: 'Background Color', type: 'color', value: site.bottomNavBg || '#080c16' },
                { key: 'bottomNavOpacity', label: 'Background Opacity', type: 'range', value: site.bottomNavOpacity ?? 0.92, min: 0, max: 1, step: 0.01 },
                { key: 'bottomNavBlur', label: 'Blur (px)', type: 'number', value: site.bottomNavBlur ?? 32, min: 0, max: 40 },
                { key: 'bottomNavHeight', label: 'Height (px)', type: 'number', value: site.bottomNavHeight ?? 60, min: 44, max: 80 },
                { key: 'bottomNavActiveColor', label: 'Active Tab Color', type: 'color', value: site.bottomNavActiveColor || '#34d399' },
                { key: 'bottomNavInactiveColor', label: 'Inactive Tab Color', type: 'color', value: site.bottomNavInactiveColor || 'rgba(255,255,255,0.4)' },
                { key: 'bottomNavItems', label: 'Nav Items (comma-separated)', type: 'text', value: site.bottomNavItems || 'Home,Explore,Playlists,Stations,History' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 5: GREETING SECTION
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_greeting', section: 'home', label: 'Greeting Section', icon: 'fa-hand-wave',
            category: 'greeting', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'greetingVisible', label: 'Visible', type: 'toggle', value: site.greetingVisible !== false },
                { key: 'greetingShowTime', label: 'Show Time', type: 'toggle', value: site.greetingShowTime !== false },
                { key: 'greetingShowWeather', label: 'Show Weather', type: 'toggle', value: site.greetingShowWeather !== false },
                { key: 'greetingShowQuote', label: 'Show Quote', type: 'toggle', value: site.greetingShowQuote !== false },
                { key: 'greetingBg', label: 'Background Color', type: 'color', value: site.greetingBg || 'transparent' },
                { key: 'greetingPadding', label: 'Padding (px)', type: 'number', value: site.greetingPadding ?? 16, min: 0, max: 48 }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 5b: NEW ALBUM
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_new_album', section: 'home', label: 'New Album', icon: 'fa-record-vinyl',
            category: 'new-album', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'newAlbumVisible', label: 'Visible', type: 'toggle', value: site.newAlbumVisible !== false },
                { key: 'newAlbumTitle', label: 'Section Title', type: 'text', value: site.newAlbumTitle || 'New Album' },
                { key: 'newAlbumCardWidth', label: 'Card Width (px)', type: 'number', value: site.newAlbumCardWidth ?? 340, min: 260, max: 500 },
                { key: 'newAlbumCardRadius', label: 'Card Border Radius (px)', type: 'number', value: site.newAlbumCardRadius ?? 20, min: 0, max: 40 },
                { key: 'newAlbumThumbSize', label: 'Thumbnail Size (px)', type: 'number', value: site.newAlbumThumbSize ?? 90, min: 40, max: 160 },
                { key: 'newAlbumThumbRadius', label: 'Thumbnail Radius (px)', type: 'number', value: site.newAlbumThumbRadius ?? 14, min: 0, max: 40 },
                { key: 'newAlbumPlayBtnPosition', label: 'Play Button Position', type: 'select', value: site.newAlbumPlayBtnPosition || 'center', options: ['center', 'top-left', 'bottom-right'] },
                { key: 'newAlbumShowSpatialBadge', label: 'Show Spatial Audio Badge', type: 'toggle', value: site.newAlbumShowSpatialBadge !== false },
                { key: 'newAlbumShowAtmosBadge', label: 'Show Dolby Atmos Badge', type: 'toggle', value: site.newAlbumShowAtmosBadge !== false },
                { key: 'newAlbumShowMeta', label: 'Show Meta Info', type: 'toggle', value: site.newAlbumShowMeta !== false },
                { key: 'newAlbumSectionSpacing', label: 'Section Spacing (px)', type: 'number', value: site.newAlbumSectionSpacing ?? 20, min: 0, max: 48 },
                { key: 'newAlbumCardSpacing', label: 'Card Spacing (px)', type: 'number', value: site.newAlbumCardSpacing ?? 18, min: 0, max: 48 }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 6: MUSIC HERO (Home → Music Section)
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_music_hero', section: 'home', label: 'Music Hero Section', icon: 'fa-music',
            category: 'hero', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'musicHeroVisible', label: 'Visible', type: 'toggle', value: site.musicHeroVisible !== false },
                { key: 'musicHeroBg', label: 'Background Gradient', type: 'text', value: site.musicHeroBg || 'linear-gradient(135deg, #0c1a3d, #0d2847, #0a1e3a, #061228)' },
                { key: 'musicHeroTitle', label: 'Section Title', type: 'text', value: site.musicHeroTitle || 'Music' },
                { key: 'musicHeroEyebrow', label: 'Eyebrow Text', type: 'text', value: site.musicHeroEyebrow || 'TAMIL AI STREAM' },
                { key: 'musicHeroSubtitle', label: 'Subtitle (Tamil)', type: 'text', value: site.musicHeroSubtitle || 'தமிழின் புதிய டிஜிட்டல் அனுபவம்' },
                { key: 'musicHeroArtSize', label: 'Artwork Size (px)', type: 'number', value: site.musicHeroArtSize ?? 128, min: 64, max: 200 },
                { key: 'musicHeroArtRadius', label: 'Artwork Radius (px)', type: 'number', value: site.musicHeroArtRadius ?? 34, min: 0, max: 50 },
                { key: 'musicHeroShowPlayBtn', label: 'Show Play Button', type: 'toggle', value: site.musicHeroShowPlayBtn !== false },
                { key: 'musicHeroPlayBtnText', label: 'Play Button Text', type: 'text', value: site.musicHeroPlayBtnText || 'Play Now' },
                { key: 'musicHeroShowDots', label: 'Show Slide Dots', type: 'toggle', value: site.musicHeroShowDots !== false },
                { key: 'musicHeroAutoRotate', label: 'Auto Rotate Slides', type: 'toggle', value: site.musicHeroAutoRotate !== false },
                { key: 'musicHeroRotateInterval', label: 'Rotate Interval (ms)', type: 'number', value: site.musicHeroRotateInterval ?? 5500, min: 2000, max: 15000 }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 7: TRENDING PLAYLISTS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_trending_playlists', section: 'home', label: 'Trending Playlists', icon: 'fa-fire',
            category: 'trending', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'trendingPlaylistsVisible', label: 'Visible', type: 'toggle', value: site.trendingPlaylistsVisible !== false },
                { key: 'trendingPlaylistsTitle', label: 'Section Title', type: 'text', value: site.trendingPlaylistsTitle || 'Trending Playlists' },
                { key: 'trendingPlaylistsMax', label: 'Max Items', type: 'number', value: site.trendingPlaylistsMax ?? 10, min: 2, max: 30 },
                { key: 'trendingPlaylistsCardWidth', label: 'Card Width (px)', type: 'number', value: site.trendingPlaylistsCardWidth ?? 164, min: 100, max: 250 },
                { key: 'trendingPlaylistsShowCount', label: 'Show Song Count', type: 'toggle', value: site.trendingPlaylistsShowCount !== false },
                { key: 'trendingPlaylistsShowPlayBtn', label: 'Show Play Button', type: 'toggle', value: site.trendingPlaylistsShowPlayBtn !== false },
                { key: 'trendingPlaylistsScrollSnap', label: 'Scroll Snap', type: 'select', value: site.trendingPlaylistsScrollSnap || 'proximity', options: ['none', 'proximity', 'mandatory'] }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 8: LIVE FM STATIONS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_live_fm', section: 'home', label: 'Live FM Stations', icon: 'fa-tower-broadcast',
            category: 'fm', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'liveFmVisible', label: 'Visible', type: 'toggle', value: site.liveFmVisible !== false },
                { key: 'liveFmTitle', label: 'Section Title', type: 'text', value: site.liveFmTitle || 'Live FM Stations' },
                { key: 'liveFmMax', label: 'Max Stations Shown', type: 'number', value: site.liveFmMax ?? 6, min: 1, max: 20 },
                { key: 'liveFmColumns', label: 'Grid Columns', type: 'select', value: site.liveFmColumns || '2', options: ['1', '2', '3'] },
                { key: 'liveFmShowBadge', label: 'Show LIVE Badge', type: 'toggle', value: site.liveFmShowBadge !== false },
                { key: 'liveFmShowFreq', label: 'Show Frequency', type: 'toggle', value: site.liveFmShowFreq !== false },
                { key: 'liveFmShowListeners', label: 'Show Listeners', type: 'toggle', value: site.liveFmShowListeners !== false },
                { key: 'liveFmShowWave', label: 'Show EQ Wave', type: 'toggle', value: site.liveFmShowWave !== false },
                { key: 'liveFmCardBg', label: 'Card Background', type: 'color', value: site.liveFmCardBg || 'rgba(255,255,255,0.04)' },
                { key: 'liveFmCardRadius', label: 'Card Radius (px)', type: 'number', value: site.liveFmCardRadius ?? 16, min: 0, max: 30 }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 9: LIVE TAMIL NEWS (Complete)
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_live_news', section: 'home', label: 'Live Tamil News', icon: 'fa-newspaper',
            category: 'news', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'liveNewsVisible', label: 'Visible', type: 'toggle', value: site.liveNewsVisible !== false },
                { key: 'liveNewsTitle', label: 'Section Title', type: 'text', value: site.liveNewsTitle || 'Live Tamil News' },
                { key: 'liveNewsMax', label: 'Max Items Shown', type: 'number', value: site.liveNewsMax ?? 6, min: 1, max: 40 },
                { key: 'liveNewsLayout', label: 'Layout', type: 'select', value: site.liveNewsLayout || 'list', options: ['list', 'grid', 'compact'] },
                { key: 'liveNewsShowThumbnails', label: 'Show Thumbnails', type: 'toggle', value: site.liveNewsShowThumbnails !== false },
                { key: 'liveNewsShowTime', label: 'Show Time Ago', type: 'toggle', value: site.liveNewsShowTime !== false },
                { key: 'liveNewsHighlightHours', label: 'Highlight Fresh News (hours)', type: 'number', value: site.liveNewsHighlightHours ?? 6, min: 1, max: 48 },
                { key: 'liveNewsTnPriority', label: 'TN Priority Badge', type: 'toggle', value: site.liveNewsTnPriority !== false },
                { key: 'liveNewsShowBadge', label: 'Show NEW Badge', type: 'toggle', value: site.liveNewsShowBadge !== false },
                { key: 'liveNewsCardBg', label: 'Card Background', type: 'color', value: site.liveNewsCardBg || 'rgba(255,255,255,0.04)' },
                { key: 'liveNewsCardRadius', label: 'Card Radius (px)', type: 'number', value: site.liveNewsCardRadius ?? 14, min: 0, max: 30 },
                { key: 'liveNewsCardGap', label: 'Card Gap (px)', type: 'number', value: site.liveNewsCardGap ?? 10, min: 0, max: 24 },
                { key: 'liveNewsThumbWidth', label: 'Thumbnail Width (px)', type: 'number', value: site.liveNewsThumbWidth ?? 84, min: 40, max: 160 },
                { key: 'liveNewsThumbHeight', label: 'Thumbnail Height (px)', type: 'number', value: site.liveNewsThumbHeight ?? 62, min: 30, max: 120 },
                { key: 'liveNewsRefreshInterval', label: 'Auto-Refresh (ms)', type: 'number', value: site.liveNewsRefreshInterval ?? 300000, min: 60000, max: 3600000 },
                { key: 'liveNewsShowDetail', label: 'Open Detail View on Click', type: 'toggle', value: site.liveNewsShowDetail !== false },
                { key: 'liveNewsDetailShowPlayer', label: 'Keep Player on Detail', type: 'toggle', value: site.liveNewsDetailShowPlayer !== false },
                { key: 'liveNewsRetainHours', label: 'Retention Period (hours)', type: 'number', value: site.liveNewsRetainHours ?? 72, min: 6, max: 168 }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 10: AI RECOMMENDATIONS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_ai_rec', section: 'home', label: 'AI Recommendations', icon: 'fa-wand-magic-sparkles',
            category: 'ai', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'aiRecVisible', label: 'Visible', type: 'toggle', value: site.aiRecVisible !== false },
                { key: 'aiRecTitle', label: 'Section Title', type: 'text', value: site.aiRecTitle || 'AI Recommendations' },
                { key: 'aiRecMax', label: 'Max Items', type: 'number', value: site.aiRecMax ?? 6, min: 2, max: 20 },
                { key: 'aiRecShowGreeting', label: 'Show AI Greeting', type: 'toggle', value: site.aiRecShowGreeting !== false },
                { key: 'aiRecShowDiscoverBtn', label: 'Show Discover Button', type: 'toggle', value: site.aiRecShowDiscoverBtn !== false },
                { key: 'aiRecDiscoverText', label: 'Discover Button Text', type: 'text', value: site.aiRecDiscoverText || 'Discover with AI' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 11: RECENTLY PLAYED
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_recently', section: 'home', label: 'Recently Played', icon: 'fa-clock-rotate-left',
            category: 'recently', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'recentlyVisible', label: 'Visible', type: 'toggle', value: site.recentlyVisible !== false },
                { key: 'recentlyTitle', label: 'Section Title', type: 'text', value: site.recentlyTitle || 'Recently Played' },
                { key: 'recentlyMax', label: 'Max Items', type: 'number', value: site.recentlyMax ?? 12, min: 2, max: 30 },
                { key: 'recentlyShowDuration', label: 'Show Duration', type: 'toggle', value: site.recentlyShowDuration !== false }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 12: HERO BANNER (Legacy)
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_hero', section: 'home', label: 'Hero Banner (Legacy)', icon: 'fa-image',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'heroTitle', label: 'Hero Title', type: 'text', value: site.heroTitle || '' },
                { key: 'heroSubtitle', label: 'Hero Subtitle', type: 'text', value: site.heroSubtitle || '' },
                { key: 'heroImage', label: 'Hero Image', type: 'image', value: site.heroImage || '' },
                { key: 'heroLink', label: 'Link URL', type: 'text', value: site.heroLink || '' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 13: CATEGORIES
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_categories', section: 'home', label: 'Categories Section', icon: 'fa-tags',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'categoriesVisible', label: 'Visible', type: 'toggle', value: site.categoriesVisible !== false },
                { key: 'categoriesTitle', label: 'Section Title', type: 'text', value: site.categoriesTitle || 'Categories' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 14: UPCOMING RELEASES
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_upcoming', section: 'home', label: 'Upcoming Releases', icon: 'fa-rocket',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'upcomingVisible', label: 'Visible', type: 'toggle', value: site.upcomingVisible !== false },
                { key: 'upcomingTitle', label: 'Section Title', type: 'text', value: site.upcomingTitle || 'Upcoming Releases' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 14b: SONGS COLLECTIONS
        // ═══════════════════════════════════════════════
        const scData = DataStore.getSongsCollections();
        canvasElements.push({
            id: 'el_sec_songs_collections', section: 'home', label: 'Songs Collections', icon: 'fa-layer-group',
            category: 'section', source: 'siteSettings',
            value: scData,
            controls: [
                { key: 'scVisible', label: 'Visible', type: 'toggle', value: true },
                { key: 'scTitle', label: 'Section Title', type: 'text', value: (scData.settings || {}).title || 'Songs Collections' },
                { key: 'scScrollSpeed', label: 'Scroll Speed (px/s)', type: 'range', value: (scData.settings || {}).scrollSpeed || 18, min: 5, max: 60 },
                { key: 'scLeftCount', label: 'Left Column Songs', type: 'number', value: (scData.left || []).length, min: 0, max: 5 },
                { key: 'scRightCount', label: 'Right Column Songs', type: 'number', value: (scData.right || []).length, min: 0, max: 5 }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 15: LATEST RELEASES
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_latest', section: 'home', label: 'Latest Releases', icon: 'fa-compact-disc',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'latestVisible', label: 'Visible', type: 'toggle', value: site.latestVisible !== false },
                { key: 'latestTitle', label: 'Section Title', type: 'text', value: site.latestTitle || 'Latest Releases' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 16: ALBUMS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_albums', section: 'home', label: 'Albums Section', icon: 'fa-compact-disc',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'albumsVisible', label: 'Visible', type: 'toggle', value: site.albumsVisible !== false },
                { key: 'albumsTitle', label: 'Section Title', type: 'text', value: site.albumsTitle || 'Albums' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 17: ARTIST HITS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_artists', section: 'home', label: 'Artist Hits', icon: 'fa-microphone',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'artistsVisible', label: 'Visible', type: 'toggle', value: site.artistsVisible !== false },
                { key: 'artistsTitle', label: 'Section Title', type: 'text', value: site.artistsTitle || 'Artist Hits' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 18: MOVIE COLLECTIONS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_movies', section: 'home', label: 'Movie Collections', icon: 'fa-film',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'moviesVisible', label: 'Visible', type: 'toggle', value: site.moviesVisible !== false },
                { key: 'moviesTitle', label: 'Section Title', type: 'text', value: site.moviesTitle || 'Movie Collections' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 19: YEARLY COLLECTIONS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_yearly', section: 'home', label: 'Yearly Collections', icon: 'fa-calendar',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'yearlyVisible', label: 'Visible', type: 'toggle', value: site.yearlyVisible !== false },
                { key: 'yearlyTitle', label: 'Section Title', type: 'text', value: site.yearlyTitle || 'Yearly Collections' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 20: MUSIC COLLECTIONS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_music', section: 'home', label: 'Music Collections', icon: 'fa-folder-tree',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'musicVisible', label: 'Visible', type: 'toggle', value: site.musicVisible !== false },
                { key: 'musicTitle', label: 'Section Title', type: 'text', value: site.musicTitle || 'Music Collections' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 21: PERSONALIZED / MADE FOR YOU
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_personalized', section: 'home', label: 'Made For You', icon: 'fa-heart',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'personalizedVisible', label: 'Visible', type: 'toggle', value: site.personalizedVisible !== false },
                { key: 'personalizedTitle', label: 'Section Title', type: 'text', value: site.personalizedTitle || 'Made For You' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 22: AI RECOMMENDED (Legacy)
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_ai', section: 'home', label: 'AI Recommended (Legacy)', icon: 'fa-wand-magic-sparkles',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'aiVisible', label: 'Visible', type: 'toggle', value: site.aiVisible !== false },
                { key: 'aiTitle', label: 'Section Title', type: 'text', value: site.aiTitle || 'AI Recommended' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 23: TRENDING SONGS (Legacy)
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_sec_trending', section: 'home', label: 'Trending Songs (Legacy)', icon: 'fa-fire',
            category: 'section', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'trendingVisible', label: 'Visible', type: 'toggle', value: site.trendingVisible !== false },
                { key: 'trendingTitle', label: 'Section Title', type: 'text', value: site.trendingTitle || 'Trending Songs' }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 24: SPLASH SCREEN
        // ═══════════════════════════════════════════════
        const splash = safeGet(() => DataStore.getSplash(), {});
        canvasElements.push({
            id: 'el_splash', section: 'global', label: 'Splash Screen', icon: 'fa-play-circle',
            category: 'splash', source: 'splash', value: splash,
            controls: [
                { key: 'enabled', label: 'Enabled', type: 'toggle', value: splash.enabled !== false },
                { key: 'title', label: 'Title', type: 'text', value: splash.title || 'Tamil AI Stream' },
                { key: 'subtitle', label: 'Subtitle', type: 'text', value: splash.subtitle || 'AI-Powered Tamil Radio' },
                { key: 'background', label: 'Background Image', type: 'image', value: splash.background || splash.bgImage || '' },
                { key: 'duration', label: 'Duration (ms)', type: 'number', value: splash.duration || 600, min: 0, max: 5000 },
                { key: 'showEqualizer', label: 'Show Equalizer Bars', type: 'toggle', value: splash.showEqualizer !== false },
                { key: 'showLoadingBar', label: 'Show Loading Bar', type: 'toggle', value: splash.showLoadingBar !== false },
                { key: 'showSkipBtn', label: 'Show Skip Button', type: 'toggle', value: splash.showSkipBtn !== false }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 25: PLAYER SETTINGS
        // ═══════════════════════════════════════════════
        const prefs = safeGet(() => DataStore.getPlayerPrefs(), {});
        canvasElements.push({
            id: 'el_player', section: 'global', label: 'Player Settings', icon: 'fa-headphones',
            category: 'player', source: 'playerPrefs', value: prefs,
            controls: [
                { key: 'volume', label: 'Default Volume', type: 'range', value: prefs.volume || 0.7, min: 0, max: 1, step: 0.1 },
                { key: 'autoPlay', label: 'Auto Play', type: 'toggle', value: prefs.autoPlay || false },
                { key: 'crossfade', label: 'Crossfade', type: 'toggle', value: prefs.crossfade || false },
                { key: 'crossfadeDuration', label: 'Crossfade Duration (s)', type: 'number', value: prefs.crossfadeDuration || 3, min: 1, max: 12 },
                { key: 'repeat', label: 'Repeat Mode', type: 'select', value: prefs.repeat || 'off', options: ['off', 'all', 'one'] },
                { key: 'shuffle', label: 'Shuffle', type: 'toggle', value: prefs.shuffle || false }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 26: MINI PLAYER
        // ═══════════════════════════════════════════════
        const mp = safeGet(() => DataStore.getMiniPlayerSettings(), {});
        canvasElements.push({
            id: 'el_minip', section: 'global', label: 'Mini Player (Bottom Bar)', icon: 'fa-play-circle',
            category: 'miniPlayer', source: 'miniPlayerSettings', value: mp,
            controls: [
                { key: 'visible', label: 'Visible', type: 'toggle', value: mp.visible !== false },
                { key: 'bgColor', label: 'Background Color', type: 'color', value: mp.bgColor || '#0a0f1e' },
                { key: 'bgOpacity', label: 'Background Opacity', type: 'range', value: mp.bgOpacity ?? 0.95, min: 0, max: 1, step: 0.01 },
                { key: 'blur', label: 'Blur (px)', type: 'number', value: mp.blur ?? 20, min: 0, max: 40 },
                { key: 'borderWidth', label: 'Border Width (px)', type: 'number', value: mp.borderWidth ?? 1, min: 0, max: 4 },
                { key: 'borderColor', label: 'Border Color', type: 'color', value: mp.borderColor || 'rgba(255,255,255,0.08)' },
                { key: 'borderRadius', label: 'Border Radius (px)', type: 'number', value: mp.borderRadius ?? 18, min: 0, max: 30 },
                { key: 'maxWidth', label: 'Max Width (px)', type: 'number', value: mp.maxWidth ?? 500, min: 300, max: 800 },
                { key: 'bottomOffset', label: 'Bottom Offset (px)', type: 'number', value: mp.bottomOffset ?? 8, min: 0, max: 40 },
                { key: 'zIndex', label: 'Z-Index', type: 'number', value: mp.zIndex ?? 1600, min: 100, max: 9999 },
                { key: 'showArt', label: 'Show Artwork', type: 'toggle', value: mp.showArt !== false },
                { key: 'showEq', label: 'Show EQ Bars', type: 'toggle', value: mp.showEq !== false },
                { key: 'showTime', label: 'Show Time', type: 'toggle', value: mp.showTime !== false },
                { key: 'showProgress', label: 'Show Progress Bar', type: 'toggle', value: mp.showProgress !== false },
                { key: 'showPrev', label: 'Show Previous Button', type: 'toggle', value: mp.showPrev !== false },
                { key: 'showNext', label: 'Show Next Button', type: 'toggle', value: mp.showNext !== false },
                { key: 'showFav', label: 'Show Favorite Button', type: 'toggle', value: mp.showFav !== false },
                { key: 'showExpand', label: 'Show Expand Button', type: 'toggle', value: mp.showExpand !== false },
                { key: 'showWave', label: 'Show Waveform', type: 'toggle', value: mp.showWave !== false },
                { key: 'showNowPlaying', label: 'Show Now Playing Badge', type: 'toggle', value: mp.showNowPlaying !== false }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 27: FULL-SCREEN PLAYER
        // ═══════════════════════════════════════════════
        const fs = safeGet(() => {
            const mp2 = DataStore.getMiniPlayerSettings();
            return mp2.fullScreen || mp2;
        }, {});
        canvasElements.push({
            id: 'el_fs_player', section: 'global', label: 'Full-Screen Player', icon: 'fa-expand',
            category: 'player', source: 'siteSettings',
            value: fs,
            controls: [
                { key: 'fsBgColor', label: 'Background Color', type: 'color', value: fs.bgColor || '#0a0f1e' },
                { key: 'fsBgOpacity', label: 'Background Opacity', type: 'range', value: fs.bgOpacity ?? 0.95, min: 0, max: 1, step: 0.01 },
                { key: 'fsBlur', label: 'Background Blur (px)', type: 'number', value: fs.blur ?? 30, min: 0, max: 60 },
                { key: 'fsGlow', label: 'Ambient Glow', type: 'toggle', value: fs.glow !== false },
                { key: 'fsArtSize', label: 'Artwork Size (px)', type: 'number', value: fs.artSize ?? 280, min: 100, max: 400 },
                { key: 'fsArtRadius', label: 'Artwork Radius (px)', type: 'number', value: fs.artRadius ?? 24, min: 0, max: 50 },
                { key: 'fsArtFloat', label: 'Floating Artwork', type: 'toggle', value: fs.artFloat !== false },
                { key: 'fsArtGlow', label: 'Artwork Glow', type: 'toggle', value: fs.artGlow !== false },
                { key: 'fsAiRing', label: 'AI Ring Around Art', type: 'toggle', value: fs.aiRing !== false },
                { key: 'fsVisualizer', label: 'Show Visualizer', type: 'toggle', value: fs.visualizer !== false },
                { key: 'fsTitleSize', label: 'Title Font Size (px)', type: 'number', value: fs.titleSize ?? 20, min: 12, max: 36 },
                { key: 'fsTitleColor', label: 'Title Color', type: 'color', value: fs.titleColor || '#ffffff' },
                { key: 'fsArtistSize', label: 'Artist Font Size (px)', type: 'number', value: fs.artistSize ?? 14, min: 10, max: 24 },
                { key: 'fsArtistColor', label: 'Artist Color', type: 'color', value: fs.artistColor || 'rgba(255,255,255,0.6)' },
                { key: 'fsPlayBtnSize', label: 'Play Button Size (px)', type: 'number', value: fs.playBtnSize ?? 64, min: 36, max: 100 },
                { key: 'fsPlayBtnColor', label: 'Play Button Color', type: 'color', value: fs.playBtnColor || '#34d399' },
                { key: 'fsProgressH', label: 'Progress Bar Height (px)', type: 'number', value: fs.progressH ?? 4, min: 2, max: 12 },
                { key: 'fsProgressColor', label: 'Progress Color', type: 'color', value: fs.progressColor || '#34d399' },
                { key: 'fsShowShuffle', label: 'Show Shuffle', type: 'toggle', value: fs.showShuffle !== false },
                { key: 'fsShowRepeat', label: 'Show Repeat', type: 'toggle', value: fs.showRepeat !== false },
                { key: 'fsShowFav', label: 'Show Favorite', type: 'toggle', value: fs.showFav !== false },
                { key: 'fsShowLyrics', label: 'Show Lyrics Button', type: 'toggle', value: fs.showLyrics !== false },
                { key: 'fsShowQueue', label: 'Show Queue Button', type: 'toggle', value: fs.showQueue !== false },
                { key: 'fsShowShare', label: 'Show Share Button', type: 'toggle', value: fs.showShare !== false },
                { key: 'fsShowVolume', label: 'Show Volume Control', type: 'toggle', value: fs.showVolume !== false },
                { key: 'fsShowEq', label: 'Show EQ Button', type: 'toggle', value: fs.showEq !== false }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 28: FOOTER
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_footer', section: 'global', label: 'Footer', icon: 'fa-shoe-prints',
            category: 'footer', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'footerVisible', label: 'Visible', type: 'toggle', value: site.footerVisible !== false },
                { key: 'footerText', label: 'Footer Text', type: 'text', value: site.footerText || 'Tamil AI Stream' },
                { key: 'footerCopyright', label: 'Copyright Text', type: 'text', value: site.footerCopyright || '© 2026 Tamil AI Stream. All rights reserved.' },
                { key: 'footerBg', label: 'Background Color', type: 'color', value: site.footerBg || 'rgba(10,15,30,0.95)' },
                { key: 'footerTextColor', label: 'Text Color', type: 'color', value: site.footerTextColor || 'rgba(255,255,255,0.5)' },
                { key: 'footerShowSocial', label: 'Show Social Links', type: 'toggle', value: site.footerShowSocial !== false }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 29: NOTIFICATION SETTINGS
        // ═══════════════════════════════════════════════
        canvasElements.push({
            id: 'el_notifications', section: 'global', label: 'Notifications', icon: 'fa-bell',
            category: 'notifications', source: 'siteSettings',
            value: site,
            controls: [
                { key: 'notificationsEnabled', label: 'Notifications Enabled', type: 'toggle', value: site.notificationsEnabled !== false },
                { key: 'notificationsMax', label: 'Max Shown', type: 'number', value: site.notificationsMax ?? 4, min: 1, max: 20 },
                { key: 'notificationsShowBadge', label: 'Show Badge', type: 'toggle', value: site.notificationsShowBadge !== false }
            ]
        });

        // ═══════════════════════════════════════════════
        // SECTION 30: NAVIGATION ITEMS
        // ═══════════════════════════════════════════════
        const nav = safeGet(() => DataStore.getNavigation(), {});
        const navItems = nav.items || nav.navItems || [];
        navItems.forEach((item, i) => {
            canvasElements.push({
                id: 'el_nav_' + i, section: 'navigation', label: 'Nav: ' + (item.label || item.name || 'Item ' + (i + 1)),
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

        // ═══════════════════════════════════════════════
        // SECTION 31: SONGS (up to 50)
        // ═══════════════════════════════════════════════
        const songs = safeGet(() => DataStore.getSongs(), []);
        songs.slice(0, 50).forEach((s, i) => {
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
                    { key: 'albumCover', label: 'Album Cover', type: 'image', value: s.albumCover || s.cover || '' },
                    { key: 'audioUrl', label: 'Audio URL', type: 'text', value: s.audioUrl || '', readonly: true }
                ]
            });
        });

        // ═══════════════════════════════════════════════
        // SECTION 32: STATIONS
        // ═══════════════════════════════════════════════
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

        // ═══════════════════════════════════════════════
        // SECTION 33: ADVERTISEMENTS
        // ═══════════════════════════════════════════════
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
                    { key: 'position', label: 'Position', type: 'select', value: a.position || 1, options: ['0', '1', '2', '3', '4'] },
                    { key: 'enabled', label: 'Enabled', type: 'toggle', value: a.enabled !== false }
                ]
            });
        });

        // ═══════════════════════════════════════════════
        // SECTION 34: FEATURED
        // ═══════════════════════════════════════════════
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

        // ═══════════════════════════════════════════════
        // SECTION 35: TRENDING ITEMS
        // ═══════════════════════════════════════════════
        const trending = safeGet(() => DataStore.getTrending(), []);
        trending.forEach((t, i) => {
            canvasElements.push({
                id: 'el_trending_' + i, section: 'content', label: t.title || t.name || 'Trending ' + (i + 1),
                icon: 'fa-fire', category: 'trending-item', source: 'trending', dataIndex: i, value: t,
                controls: [
                    { key: 'title', label: 'Title', type: 'text', value: t.title || t.name || '' },
                    { key: 'artist', label: 'Artist', type: 'text', value: t.artist || '' },
                    { key: 'thumbnail', label: 'Thumbnail', type: 'image', value: t.thumbnail || '' },
                    { key: 'status', label: 'Status', type: 'select', value: t.status || 'active', options: ['active', 'inactive'] }
                ]
            });
        });

        // ═══════════════════════════════════════════════
        // SECTION 36: CATEGORIES ITEMS
        // ═══════════════════════════════════════════════
        const categories = safeGet(() => DataStore.getCategories(), []);
        categories.forEach((c, i) => {
            canvasElements.push({
                id: 'el_category_' + i, section: 'content', label: c.name || 'Category ' + (i + 1),
                icon: 'fa-tag', category: 'category-item', source: 'categories', dataIndex: i, value: c,
                controls: [
                    { key: 'name', label: 'Name', type: 'text', value: c.name || '' },
                    { key: 'icon', label: 'Icon', type: 'icon', value: c.icon || '' },
                    { key: 'color', label: 'Color', type: 'color', value: c.color || '#34d399' }
                ]
            });
        });

        // ═══════════════════════════════════════════════
        // SECTION 37: ARTIST HITS ITEMS
        // ═══════════════════════════════════════════════
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

        // ═══════════════════════════════════════════════
        // SECTION 38: MOODS
        // ═══════════════════════════════════════════════
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

        // ═══════════════════════════════════════════════
        // SECTION 39: UPCOMING RELEASES
        // ═══════════════════════════════════════════════
        const releases = safeGet(() => DataStore.getUpcomingReleases(), []);
        releases.forEach((r, i) => {
            canvasElements.push({
                id: 'el_release_' + i, section: 'content', label: r.title || 'Release ' + (i + 1),
                icon: 'fa-rocket', category: 'release', source: 'upcomingReleases', dataIndex: i, value: r,
                controls: [
                    { key: 'title', label: 'Title', type: 'text', value: r.title || '' },
                    { key: 'subtitle', label: 'Subtitle', type: 'text', value: r.subtitle || '' },
                    { key: 'image', label: 'Poster Image', type: 'image', value: r.image || '' },
                    { key: 'order', label: 'Display Order', type: 'number', value: r.order || 0 },
                    { key: 'enabled', label: 'Enabled', type: 'toggle', value: r.enabled !== false }
                ]
            });
        });

        // ═══════════════════════════════════════════════
        // SECTION 40: NEWS ITEMS
        // ═══════════════════════════════════════════════
        const news = safeGet(() => DataStore.getNews(), []);
        news.slice(0, 30).forEach((n, i) => {
            canvasElements.push({
                id: 'el_news_' + i, section: 'content', label: (n.title || 'News ' + (i + 1)).slice(0, 40),
                icon: 'fa-newspaper', category: 'news-item', source: 'news', dataIndex: i, value: n,
                controls: [
                    { key: 'title', label: 'Headline', type: 'text', value: n.title || '' },
                    { key: 'content', label: 'Content', type: 'textarea', value: n.content || '' },
                    { key: 'image', label: 'Thumbnail', type: 'image', value: n.image || '' },
                    { key: 'priority', label: 'TN Priority', type: 'toggle', value: n.priority === 'tamil-nadu' || n.tamilNadu === true },
                    { key: 'highlighted', label: 'Highlight as NEW', type: 'toggle', value: n.highlighted === true },
                    { key: 'status', label: 'Status', type: 'select', value: n.status || 'published', options: ['published', 'draft'] }
                ]
            });
        });

        // ═══════════════════════════════════════════════
        // SECTION 41: COLLECTIONS (Movies/Yearly/Latest/Music)
        // ═══════════════════════════════════════════════
        const collectionTypes = [
            { key: 'moviesCollections', getter: 'getMoviesCollections', label: 'Movie Collection', icon: 'fa-film' },
            { key: 'yearlyCollections', getter: 'getYearlyCollections', label: 'Yearly Collection', icon: 'fa-calendar' },
            { key: 'latestCollections', getter: 'getLatestCollections', label: 'Latest Collection', icon: 'fa-clock' },
            { key: 'musicCollections', getter: 'getMusicCollections', label: 'Music Collection', icon: 'fa-folder-tree' }
        ];
        collectionTypes.forEach(ct => {
            const items = safeGet(() => DataStore[ct.getter](), []);
            items.forEach((item, i) => {
                canvasElements.push({
                    id: 'el_' + ct.key + '_' + i, section: 'content',
                    label: (item.name || item.title || ct.label + ' ' + (i + 1)).slice(0, 34),
                    icon: ct.icon, category: ct.label.toLowerCase().replace(/\s/g, '-'),
                    source: ct.key, dataIndex: i, value: item,
                    controls: [
                        { key: 'name', label: 'Name', type: 'text', value: item.name || item.title || '' },
                        { key: 'description', label: 'Description', type: 'text', value: item.description || '' },
                        { key: 'thumbnail', label: 'Thumbnail', type: 'image', value: item.thumbnail || item.image || '' },
                        { key: 'status', label: 'Status', type: 'select', value: item.status || 'active', options: ['active', 'inactive'] }
                    ]
                });
            });
        });

        // Add registry-powered feature elements (auto-configured)
        buildRegistryElements();

        // Deduplicate: remove hardcoded elements that are now registry-managed
        const registryManagedIds = new Set(Object.keys(FEATURE_REGISTRY).map(fid => 'el_feature_' + fid));
        const registryKeys = new Set();
        Object.values(FEATURE_REGISTRY).forEach(reg => {
            reg.controls.forEach(c => registryKeys.add(c.key));
        });
        canvasElements = canvasElements.filter(el => {
            if (el.featureId) return true;
            // Remove elements whose controls overlap significantly with registry features
            if (el.source === 'siteSettings' && el.controls) {
                const overlap = el.controls.filter(c => registryKeys.has(c.key)).length;
                if (overlap >= 2) return false;
            }
            return true;
        });
    }

    /* ============================================================
       CANVAS RENDERING
       ============================================================ */
    function renderCanvas() {
        const canvas = $('s360Canvas');
        if (!canvas) return;

        const sections = {};
        canvasElements.forEach(el => {
            if (!sections[el.section]) sections[el.section] = [];
            sections[el.section].push(el);
        });

        const sectionOrder = ['global', 'home', 'navigation', 'content'];
        const sectionLabels = {
            global: { label: 'Global & Theme', icon: 'fa-globe' },
            home: { label: 'Home Page Sections', icon: 'fa-layer-group' },
            navigation: { label: 'Navigation Items', icon: 'fa-navicon' },
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
                const hasAgent = el.featureId && FEATURE_REGISTRY[el.featureId];
                const comp = hasAgent ? agentGetCompletion(el.featureId) : null;
                html += '<div class="s360-canvas-card' + (isSelected ? ' selected' : '') + '" data-el-id="' + esc(el.id) + '">';
                html += '<div class="s360-canvas-card-thumb">' + thumbHtml + '</div>';
                if (hasAgent) {
                    const pct = comp ? comp.pct : 0;
                    html += '<button class="s360-agent-btn" data-feature="' + esc(el.featureId) + '" title="Agent Bot - ' + esc(el.label) + '">';
                    html += '<i class="fas fa-robot"></i>';
                    if (pct < 100) html += '<span class="s360-agent-btn-pct">' + pct + '%</span>';
                    html += '</button>';
                }
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

        canvas.querySelectorAll('.s360-canvas-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.s360-agent-btn')) return;
                e.preventDefault();
                e.stopPropagation();
                selectElement(card.dataset.elId);
            });
        });

        canvas.querySelectorAll('.s360-agent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const fid = btn.dataset.feature;
                if (fid) openAgentForFeature(fid);
            });
        });
    }

    function openAgentForFeature(featureId) {
        const reg = FEATURE_REGISTRY[featureId];
        if (!reg) return;
        const elId = 'el_feature_' + featureId;
        selectElement(elId);
        agentLog(featureId, 'open', 'Agent panel opened', 'info');
    }

    function getThumbnailHtml(el) {
        const img = el.value && (el.value.thumbnail || el.value.image || el.value.albumCover || el.value.logo || el.value.background);
        if (img) {
            return '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=s360-canvas-card-icon><i class=fas ' + esc(el.icon) + '></i></div>\'">';
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
       SETTINGS PANEL
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
        html += '<div class="s360-settings-header">';
        html += '<div class="s360-settings-title"><i class="fas ' + esc(el.icon) + '"></i> ' + esc(el.label) + '</div>';
        html += '<span class="s360-settings-badge">' + esc(el.category) + '</span>';
        html += '</div>';

        if (el.controls && el.controls.length) {
            html += '<div class="s360-settings-fields">';
            el.controls.forEach((ctrl, ci) => {
                html += renderControl(el, ctrl, ci);
            });
            html += '</div>';
        }

        panel.innerHTML = html;

        // Render Agent Bot panel for feature elements
        const agentPanel = $('s360AgentPanel');
        if (agentPanel) {
            if (el.featureId && FEATURE_REGISTRY[el.featureId]) {
                agentPanel.style.display = '';
                _renderAgentPanel(el.featureId);
            } else {
                agentPanel.style.display = 'none';
                agentPanel.innerHTML = '';
            }
        }

        panel.querySelectorAll('.s360-ctrl').forEach(input => {
            const eventType = (input.type === 'range' || input.type === 'color') ? 'input' : 'change';
            input.addEventListener(eventType, () => {
                handleControlChange(el, input.dataset.key, input);
            });
        });

        panel.querySelectorAll('.s360-img-pick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                openImagePicker(el, btn.dataset.key);
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

        const ctrl = el.controls.find(c => c.key === key);
        if (ctrl) ctrl.value = newValue;

        if (input.type === 'color') {
            const hex = input.parentElement.querySelector('.s360-ctrl-color-hex');
            if (hex) hex.textContent = newValue;
        }
        if (input.type === 'range') {
            const rv = input.parentElement.querySelector('.s360-ctrl-range-val');
            if (rv) rv.textContent = newValue;
        }
        if (ctrl && ctrl.type === 'icon') {
            const ip = input.parentElement.querySelector('.s360-ctrl-icon-preview i');
            if (ip) ip.className = 'fas ' + newValue;
        }
        if (ctrl && ctrl.type === 'image') {
            const preview = input.parentElement.querySelector('.s360-ctrl-img-preview');
            if (newValue && preview) { preview.src = newValue; preview.style.display = ''; }
            else if (!newValue && preview) { preview.style.display = 'none'; }
        }

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
       PUBLISH
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
        autoConfigureAllFeatures();
        buildCanvasData();
        renderCanvas();
        renderSettingsPanel();
        Object.keys(FEATURE_REGISTRY).forEach(fid => agentTakeSnapshot(fid));
        agentLog('system', 'init', 'Builder initialized with ' + Object.keys(FEATURE_REGISTRY).length + ' registered features', 'done');
        document.addEventListener('keydown', (e) => {
            if (!$('site360Page') || $('site360Page').style.display === 'none') return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
            if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveChanges(); }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
            if (e.key === 'Escape') {
                const agentPanel = $('s360AgentPanel');
                if (agentPanel && agentPanel.style.display !== 'none') {
                    agentPanel.style.display = 'none';
                    agentPanel.innerHTML = '';
                }
                selectedId = null;
                renderCanvas();
                renderSettingsPanel();
            }
        });
    }

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
        pickImage: openImagePicker,
        agentLog,
        agentTakeSnapshot,
        agentRollback,
        agentSyncFeature,
        agentGetCompletion,
        autoConfigureFeature,
        autoConfigureAllFeatures,
        openAgentForFeature,
        FEATURE_REGISTRY
    };
})();
