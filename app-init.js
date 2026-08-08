// ============================================
// Tamil AI Stream - Master Initialization
// Loads all systems in correct order
// ============================================

const AppInit = {
    init() {
        console.log('🚀 Tamil AI Stream - Initializing...');
        
        // 1. Load site configuration
        this.loadConfig();
        
        // 2. Initialize data store
        this.initDataStore();
        
        // 3. Initialize site integration
        this.initSiteIntegration();
        
        // 4. Initialize UI components
        this.initUI();
        
        console.log('✅ All systems initialized');
    },

    loadConfig() {
        // Load from localStorage if exists
        const saved = localStorage.getItem('siteConfig');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                Object.assign(window.SiteConfig, config);
                console.log('✓ Site configuration loaded');
            } catch (e) {
                console.warn('⚠ Failed to load config:', e);
            }
        }
    },

    initDataStore() {
        // DataStore is already initialized in data-store.js
        console.log('✓ Data store ready');
    },

    initSiteIntegration() {
        // SiteIntegration is already initialized in site-integration.js
        console.log('✓ Site integration ready');
    },

    initUI() {
        // Initialize UI components when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initComponents();
            });
        } else {
            this.initComponents();
        }
    },

    initComponents() {
        // Player Engine
        if (typeof PlayerEngine !== 'undefined') {
            PlayerEngine.init();
        }
        
        // Equalizer
        if (typeof Equalizer !== 'undefined') {
            Equalizer.loadEqSettings();
        }
        
        // Playlist Manager
        if (typeof PlaylistManager !== 'undefined') {
            PlaylistManager.init();
        }
        
        // Search Engine
        if (typeof SearchEngine !== 'undefined') {
            SearchEngine.init();
        }
        
        // Premium Effects
        if (typeof PremiumEffects !== 'undefined') {
            PremiumEffects.init();
            PremiumEffects.initParticles();
        }
        
        // Player UI
        if (typeof PlayerUI !== 'undefined') {
            PlayerUI.init();
        }
        
        // AI Music Assistant
        if (typeof AIMusicAssistant !== 'undefined') {
            AIMusicAssistant.init();
        }
        
        console.log('✓ UI components initialized');
    },

    // Get current configuration
    getConfig() {
        return window.SiteConfig || {};
    },

    // Update configuration
    updateConfig(newConfig) {
        window.SiteConfig = { ...window.SiteConfig, ...newConfig };
        this.saveConfig();
    },

    // Save configuration
    saveConfig() {
        localStorage.setItem('siteConfig', JSON.stringify(window.SiteConfig));
        
        // Trigger sync
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'siteConfig',
            newValue: JSON.stringify(window.SiteConfig)
        }));
    },

    // Reset configuration
    resetConfig() {
        localStorage.removeItem('siteConfig');
        localStorage.removeItem('builderDraft');
        location.reload();
    }
};

// Auto-initialize
if (typeof window !== 'undefined') {
    window.AppInit = AppInit;
    AppInit.init();
}
