'use strict';

// ============================================
// Tamil AI Stream - Complete Site Configuration
// Controls every visible element, style, and behavior
// ============================================

const SiteConfig = {
    // ============================================
    // Global Site Settings
    // ============================================
    site: {
        title: 'Tamil AI Stream - AI-Powered Tamil Radio | Home',
        description: 'Listen to your favorite Tamil FM stations with AI-powered recommendations.',
        keywords: 'Tamil FM, Tamil radio, AI radio, Tamil music, online radio',
        ogTitle: 'Tamil AI Stream - AI-Powered Tamil Radio',
        ogDescription: 'Listen to your favorite Tamil FM stations with AI-powered recommendations.',
        ogUrl: 'https://tamilai.stream',
        themeColor: '#000000',
        favicon: 'favicon.ico'
    },

    // ============================================
    // Page Sections Configuration
    // ============================================
    sections: [
        {
            id: 'splash',
            name: 'Startup Splash Screen',
            visible: true,
            order: 0,
            config: {
                duration: 2000,
                showSkip: true,
                logo: { icon: 'fa-headphones-alt', size: 80, glowSize: 120 },
                title: { text: 'Tamil AI Stream', highlight: 'Tamil AI', fontSize: 48, fontWeight: 800 },
                subtitle: { text: 'AI-Powered Tamil Radio', fontSize: 18 }
            }
        },
        {
            id: 'header',
            name: 'Header & Navigation',
            visible: true,
            order: 1,
            config: {
                logo: { text: 'Tamil AI Stream', icon: 'fa-microphone-alt', showIcon: true, fontSize: 24 },
                searchBar: {
                    visible: true,
                    placeholder: 'Search songs, artists, stations...',
                    width: 400, height: 40, borderRadius: 20,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    fontSize: 14, glassEffect: true, blur: 10
                },
                navigation: {
                    items: [
                        { id: 'home', label: 'Home', icon: 'fa-house', visible: true },
                        { id: 'stations', label: 'Stations', icon: 'fa-radio', visible: true },
                        { id: 'explore', label: 'Explore', icon: 'fa-compass', visible: true },
                        { id: 'library', label: 'Library', icon: 'fa-book-open', visible: true },
                        { id: 'liked', label: 'Liked', icon: 'fa-heart', visible: true }
                    ],
                    activeColor: '#6366f1', fontSize: 14, fontWeight: 500
                },
                background: { type: 'glass', color: 'rgba(13,27,42,0.7)', blur: 20 }
            }
        },
        {
            id: 'hero',
            name: 'Hero Section',
            visible: true,
            order: 2,
            config: {
                greeting: { text: 'Good Evening', fontSize: 32, fontWeight: 700, showIcon: true, icon: 'fa-sun' },
                featured: { title: 'Featured Station', autoPlay: true, interval: 5000 },
                background: { gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }
            }
        },
        {
            id: 'categories',
            name: 'Categories Section',
            visible: true,
            order: 3,
            config: {
                title: { text: 'Browse Categories', fontSize: 24, fontWeight: 700, icon: 'fa-layer-group' },
                layout: { columns: 4, gap: 16, cardHeight: 120 },
                cards: {
                    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)',
                    glassEffect: true, blur: 10, hoverEffect: 'scale(1.05)'
                }
            }
        },
        {
            id: 'stations',
            name: 'FM Stations Section',
            visible: true,
            order: 4,
            config: {
                title: { text: 'FM Stations', fontSize: 24, fontWeight: 700, icon: 'fa-radio' },
                layout: { columns: 4, gap: 20, cardWidth: 280, cardHeight: 180 },
                cards: {
                    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)',
                    glassEffect: true, blur: 10, showGradient: true,
                    showListeners: true, showGenre: true, showCity: true
                },
                features: { showLiveIndicator: true, showSearch: true, showFilter: true, itemsPerPage: 12 }
            }
        },
        {
            id: 'trending',
            name: 'Trending Songs Section',
            visible: true,
            order: 5,
            config: {
                title: { text: 'Trending Now', fontSize: 24, fontWeight: 700, icon: 'fa-fire' },
                layout: { cardStyle: 'list', columns: 1, showNumber: true, showThumbnail: true },
                cards: { borderRadius: 12, hoverBackgroundColor: 'rgba(255,255,255,0.05)' },
                features: { showScroll: true, showSeeAll: true }
            }
        },
        {
            id: 'featured',
            name: 'Featured Songs Section',
            visible: true,
            order: 6,
            config: {
                title: { text: 'Featured Songs', fontSize: 24, fontWeight: 700, icon: 'fa-star' },
                layout: { columns: 5, gap: 20, showThumbnail: true, showPlayButton: true },
                cards: {
                    borderRadius: 12, glassEffect: true, blur: 10,
                    hoverEffect: 'scale(1.03)', showPlayOverlay: true
                },
                slider: { enabled: true, autoSlide: true, interval: 4000 }
            }
        },
        {
            id: 'recentlyAdded',
            name: 'Recently Added Section',
            visible: true,
            order: 7,
            config: {
                title: { text: 'Recently Added', fontSize: 24, fontWeight: 700, icon: 'fa-clock' },
                layout: { columns: 6, gap: 16, showThumbnail: true },
                cards: { borderRadius: 12, hoverEffect: 'scale(1.05)' },
                ticker: { enabled: true, speed: 50, pauseOnHover: true }
            }
        },
        {
            id: 'aiAssistant',
            name: 'AI Assistant',
            visible: true,
            order: 8,
            config: {
                fab: {
                    show: true, position: 'bottom-right', size: 56,
                    backgroundColor: '#6366f1', color: '#ffffff',
                    icon: 'fa-robot', borderRadius: 50, pulseAnimation: true
                },
                panel: {
                    show: true, width: 400, height: 600, position: 'bottom-right',
                    backgroundColor: 'rgba(13,27,42,0.95)', borderRadius: 20, blur: 20
                },
                input: {
                    placeholder: 'Ask me to play, search, or navigate...',
                    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24
                }
            }
        },
        {
            id: 'player',
            name: 'Music Player',
            visible: true,
            order: 10,
            config: {
                mini: {
                    show: true, height: 80,
                    backgroundColor: 'rgba(13,27,42,0.95)', blur: 20, glassEffect: true
                },
                controls: {
                    showPlayPause: true, showPrev: true, showNext: true,
                    showShuffle: true, showRepeat: true, showProgress: true,
                    showVolume: true, showLike: true, showQueue: true
                },
                buttons: { size: 36, color: '#ffffff', hoverColor: '#6366f1' },
                progress: { height: 4, color: '#6366f1', backgroundColor: 'rgba(255,255,255,0.1)' },
                artwork: { show: true, size: 56, borderRadius: 8 }
            }
        },
        {
            id: 'footer',
            name: 'Footer',
            visible: true,
            order: 11,
            config: {
                text: {
                    content: '© 2024 Tamil AI Stream. All rights reserved.',
                    fontSize: 14, color: 'rgba(255,255,255,0.6)', alignment: 'center'
                },
                links: { show: true },
                social: { show: true },
                background: { color: 'rgba(13,27,42,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)' }
            }
        },
        {
            id: 'toast',
            name: 'Toast Notifications',
            visible: true,
            order: 999,
            config: {
                position: 'top-right',
                maxVisible: 3,
                duration: 4000,
                backgroundColor: 'rgba(13,27,42,0.95)',
                borderRadius: 12,
                glassEffect: true
            }
        }
    ],

    // ============================================
    // Content Data (Dynamic)
    // ============================================
    content: {
        songs: [],
        stations: [],
        categories: [
            { id: 'music', name: 'Music', icon: 'fa-music', color: '#6366f1', count: 120 },
            { id: 'news', name: 'News', icon: 'fa-newspaper', color: '#ef4444', count: 45 },
            { id: 'talk', name: 'Talk Shows', icon: 'fa-microphone', color: '#10b981', count: 30 },
            { id: 'devotional', name: 'Devotional', icon: 'fa-pray', color: '#f59e0b', count: 25 }
        ],
        featured: [],
        trending: [],
        recentlyAdded: [],
        moods: [],
        aiRadio: []
    },

    // ============================================
    // Visual Styling System
    // ============================================
    styles: {
        colors: {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            accent: '#06b6d4',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444',
            background: '#0d1b2a',
            surface: 'rgba(255,255,255,0.05)',
            text: '#ffffff',
            textSecondary: 'rgba(255,255,255,0.7)'
        },
        fonts: {
            family: 'Inter, sans-serif',
            weights: [300, 400, 500, 600, 700, 800, 900]
        },
        effects: {
            glass: { blur: 10, opacity: 0.1, saturation: 1.2 },
            shadows: {
                small: '0 2px 8px rgba(0,0,0,0.3)',
                medium: '0 4px 16px rgba(0,0,0,0.4)',
                large: '0 8px 32px rgba(0,0,0,0.5)',
                glow: '0 0 20px rgba(99,102,241,0.5)'
            }
        }
    },

    // ============================================
    // Responsive Breakpoints
    // ============================================
    breakpoints: {
        mobile: 640,
        tablet: 1024,
        desktop: 1025
    },

    // ============================================
    // Builder State
    // ============================================
    builder: {
        selectedElement: null,
        selectedSection: null,
        selectedDevice: 'desktop',
        history: [],
        historyIndex: -1,
        draft: null,
        published: null,
        lastSaved: null
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SiteConfig;
} else if (typeof window !== 'undefined') {
    window.SiteConfig = SiteConfig;
}
