// ============================================
// Site Configuration Integration Layer
// Bridges data-store.js and site-config.js
// ============================================

const SiteIntegration = {
    // Load configuration from localStorage
    loadConfig() {
        const saved = localStorage.getItem('siteConfig');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                window.SiteConfig = { ...window.SiteConfig, ...config };
                return true;
            } catch (e) {
                console.error('Failed to load site config:', e);
            }
        }
        return false;
    },

    // Save configuration to localStorage
    saveConfig() {
        if (!window.SiteConfig) return;
        localStorage.setItem('siteConfig', JSON.stringify(window.SiteConfig));
        
        // Trigger storage event for other tabs
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'siteConfig',
            newValue: JSON.stringify(window.SiteConfig)
        }));
    },

    // Apply section visibility
    applySectionVisibility() {
        if (!window.SiteConfig || !window.SiteConfig.sections) return;

        window.SiteConfig.sections.forEach(section => {
            this.applySectionConfig(section);
        });
    },

    applySectionConfig(section) {
        let selector;
        switch (section.id) {
            case 'splash':
                selector = '.splash-overlay';
                break;
            case 'header':
                selector = 'header, .site-header';
                break;
            case 'footer':
                selector = 'footer, .site-footer';
                break;
            case 'aiAssistant':
                selector = '#ytmAiFab, .ytm-ai-panel';
                break;
            case 'player':
                selector = '.mini-player, .player-bar';
                break;
            default:
                selector = `.${section.id}-section`;
        }

        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            el.style.display = section.visible ? '' : 'none';
        });
    },

    // Apply element styles
    applyElementStyle(selector, properties) {
        const el = document.querySelector(selector);
        if (!el) return;

        Object.entries(properties).forEach(([key, value]) => {
            if (key === 'textContent') {
                el.textContent = value;
            } else if (key === 'placeholder') {
                el.placeholder = value;
            } else if (key === 'boxShadow' && value && value !== 'none') {
                const shadows = window.SiteConfig?.styles?.effects?.shadows || {};
                el.style.boxShadow = shadows[value] || value;
            } else if (key === 'backdropFilter' && value && value !== 'none') {
                el.style.backdropFilter = value;
                el.style.webkitBackdropFilter = value;
            } else {
                el.style[key] = value;
            }
        });
    },

    // Apply responsive styles
    applyResponsiveStyles() {
        if (!window.SiteConfig) return;

        const width = window.innerWidth;
        const isMobile = width < 640;
        const isTablet = width >= 640 && width < 1024;

        // Apply mobile overrides
        document.querySelectorAll('[data-mobile-width]').forEach(el => {
            if (isMobile) {
                el.style.width = el.dataset.mobileWidth;
            }
        });

        // Apply tablet overrides
        document.querySelectorAll('[data-tablet-width]').forEach(el => {
            if (isTablet) {
                el.style.width = el.dataset.tabletWidth;
            }
        });

        // Hide on mobile
        document.querySelectorAll('[data-hide-mobile="true"]').forEach(el => {
            el.style.display = isMobile ? 'none' : '';
        });

        // Hide on tablet
        document.querySelectorAll('[data-hide-tablet="true"]').forEach(el => {
            el.style.display = isTablet ? 'none' : '';
        });
    },

    // Initialize on page load
    init() {
        const loaded = this.loadConfig();
        if (loaded) {
            this.applySectionVisibility();
            this.applyResponsiveStyles();
            
            // Listen for changes
            window.addEventListener('storage', (e) => {
                if (e.key === 'siteConfig' && e.newValue) {
                    try {
                        window.SiteConfig = JSON.parse(e.newValue);
                        this.applySectionVisibility();
                        this.applyResponsiveStyles();
                    } catch (err) {
                        console.error('Failed to update config:', err);
                    }
                }
            });

            // Listen for resize
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    this.applyResponsiveStyles();
                }, 250);
            });
        }
    }
};

// Auto-initialize
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        SiteIntegration.init();
    });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SiteIntegration;
} else if (typeof window !== 'undefined') {
    window.SiteIntegration = SiteIntegration;
}
