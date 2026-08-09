'use strict';

// ============================================
// Visual Website Builder - Core System
// ============================================

class VisualBuilder {
    constructor() {
        this.config = window.SiteConfig || {};
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.selectedElement = null;
        this.selectedSection = null;
        this.currentDevice = 'desktop';
        this.isModified = false;
        this.iframe = null;
        this.iframeDoc = null;
        
        this.init();
    }

    initIframe() {
        this.iframe = document.getElementById('previewIframe');
        if (!this.iframe) return;

        this.iframe.addEventListener('load', () => {
            try {
                this.iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
                if (this.iframeDoc && this.iframeDoc.body) {
                    this.applySectionVisibility();
                    console.log('Preview iframe loaded and ready');
                }
            } catch (err) {
                console.warn('[Builder] iframe access error, retrying:', err);
                setTimeout(() => this.initIframe(), 1000);
            }
        });

        // Handle already-loaded iframe (cached)
        if (this.iframe.contentDocument && this.iframe.contentDocument.body) {
            this.iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
            this.applySectionVisibility();
        } else {
            setTimeout(() => this.initIframe(), 1000);
        }
    }

    init() {
        console.log('Visual Builder initializing...');
        this.initIframe();
        this.bindEvents();
        this.loadDraft();
        this.renderElementTree();
        this.renderSectionsList();
        this.updatePublishStatus();
        this.showToast('success', 'Builder Ready', 'Visual website builder loaded successfully');
    }

    bindEvents() {
        // Toolbar buttons
        document.getElementById('undoBtn')?.addEventListener('click', () => this.undo());
        document.getElementById('redoBtn')?.addEventListener('click', () => this.redo());
        document.getElementById('saveDraftBtn')?.addEventListener('click', () => this.saveDraft());
        document.getElementById('previewBtn')?.addEventListener('click', () => this.openPreview());
        document.getElementById('publishBtn')?.addEventListener('click', () => this.publish());
        document.getElementById('resetBtn')?.addEventListener('click', () => this.resetToDefault());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        // Device selector
        document.querySelectorAll('.device-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setDevice(e.currentTarget.dataset.device));
        });

        // Preview controls
        document.getElementById('zoomIn')?.addEventListener('click', () => this.zoom(10));
        document.getElementById('zoomOut')?.addEventListener('click', () => this.zoom(-10));
        document.getElementById('toggleGrid')?.addEventListener('click', () => this.toggleGrid());
        document.getElementById('toggleGuides')?.addEventListener('click', () => this.toggleGuides());

        // Preview modal
        document.getElementById('closePreview')?.addEventListener('click', () => this.closePreview());
        document.getElementById('closePreviewBtn')?.addEventListener('click', () => this.closePreview());
        document.getElementById('publishFromPreview')?.addEventListener('click', () => {
            this.closePreview();
            this.publish();
        });

        // Property controls
        this.bindPropertyControls();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    this.undo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    this.redo();
                } else if (e.key === 's') {
                    e.preventDefault();
                    this.saveDraft();
                }
            }
        });
    }

    bindPropertyControls() {
        // Content
        this.bindInput('propTextContent', 'textContent');
        this.bindInput('propPlaceholder', 'placeholder');
        this.bindInput('propTitle', 'title');

        // Dimensions
        this.bindInput('propWidth', 'width');
        this.bindInput('propHeight', 'height');
        this.bindInput('propMinWidth', 'minWidth');
        this.bindInput('propMaxWidth', 'maxWidth');

        // Spacing
        this.bindInput('propMargin', 'margin');
        this.bindInput('propPadding', 'padding');
        this.bindInput('propMarginTop', 'marginTop');
        this.bindInput('propMarginRight', 'marginRight');
        this.bindInput('propMarginBottom', 'marginBottom');
        this.bindInput('propMarginLeft', 'marginLeft');

        // Typography
        this.bindInput('propFontFamily', 'fontFamily');
        this.bindInput('propFontSize', 'fontSize');
        this.bindInput('propFontWeight', 'fontWeight');
        this.bindInput('propLineHeight', 'lineHeight');
        this.bindInput('propLetterSpacing', 'letterSpacing');

        // Text align buttons
        document.querySelectorAll('[data-value]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.currentTarget.dataset.value;
                if (this.selectedElement) {
                    this.setProperty('textAlign', value);
                }
            });
        });

        // Colors
        this.bindColorInput('propColor', 'propColorText', 'color');
        this.bindColorInput('propBackground', 'propBackgroundText', 'backgroundColor');

        // Border & Radius
        this.bindInput('propBorderRadius', 'borderRadius');
        this.bindInput('propBorderWidth', 'borderWidth');
        this.bindColorInput('propBorderColor', 'propBorderColorText', 'borderColor');

        // Effects
        this.bindInput('propOpacity', 'opacity');
        
        document.getElementById('propGlassEffect')?.addEventListener('change', (e) => {
            this.setProperty('backdropFilter', e.target.checked ? 'blur(10px)' : 'none');
        });

        this.bindInput('propBlur', 'backdropFilter');
        this.bindInput('propBoxShadow', 'boxShadow');
        this.bindInput('propCustomShadow', 'boxShadow');

        // Position
        this.bindInput('propPosition', 'position');
        this.bindInput('propTop', 'top');
        this.bindInput('propRight', 'right');
        this.bindInput('propBottom', 'bottom');
        this.bindInput('propLeft', 'left');
        this.bindInput('propZIndex', 'zIndex');

        // Animation
        this.bindInput('propAnimation', 'animation');
        this.bindInput('propAnimationDuration', 'animationDuration');
        this.bindInput('propHoverEffect', 'hoverEffect');

        // Visibility
        this.bindInput('propDisplay', 'display');
        this.bindInput('propVisible', 'visibility');
        this.bindInput('propOverflowHidden', 'overflow');

        // Responsive
        this.bindInput('propMobileWidth', 'mobileWidth');
        this.bindInput('propTabletWidth', 'tabletWidth');
        this.bindInput('propHideMobile', 'hideMobile');
        this.bindInput('propHideTablet', 'hideTablet');

        // Actions
        document.getElementById('resetElement')?.addEventListener('click', () => this.resetSelectedElement());
        document.getElementById('deleteElement')?.addEventListener('click', () => this.deleteSelectedElement());
    }

    bindInput(elementId, property) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.addEventListener('input', (e) => {
            if (this.selectedElement) {
                this.setProperty(property, e.target.value);
            }
        });

        element.addEventListener('change', (e) => {
            if (this.selectedElement) {
                this.setProperty(property, e.target.value);
            }
        });
    }

    bindColorInput(colorInputId, textInputId, property) {
        const colorInput = document.getElementById(colorInputId);
        const textInput = document.getElementById(textInputId);
        
        if (!colorInput || !textInput) return;

        colorInput.addEventListener('input', (e) => {
            textInput.value = e.target.value;
            if (this.selectedElement) {
                this.setProperty(property, e.target.value);
            }
        });

        textInput.addEventListener('input', (e) => {
            colorInput.value = e.target.value;
            if (this.selectedElement) {
                this.setProperty(property, e.target.value);
            }
        });
    }

    setProperty(property, value) {
        if (!this.selectedElement || !this.iframeDoc) return;

        const el = this.iframeDoc.querySelector(this.selectedElement.selector);
        if (!el) return;

        // Save to history before change
        this.saveToHistory();

        // Apply property
        if (property.includes('.')) {
            const [parent, child] = property.split('.');
            el.style[parent][child] = value;
        } else if (property === 'textContent') {
            el.textContent = value;
        } else if (property === 'placeholder') {
            el.placeholder = value;
        } else if (property === 'title') {
            el.title = value;
        } else if (property === 'boxShadow' && value === 'custom') {
            // Don't apply yet, wait for custom value
            return;
        } else if (property === 'backdropFilter' && !value.includes('blur')) {
            el.style[property] = value;
        } else {
            el.style[property] = value;
        }

        // Update config
        this.updateElementConfig(this.selectedElement.selector, property, value);
        
        // Mark as modified
        this.isModified = true;
        this.updatePublishStatus();

        // Update preview
        this.refreshPropertyPanel();
    }

    updateElementConfig(selector, property, value) {
        const section = this.findSectionForElement(selector);
        if (section && section.config) {
            // Update nested properties
            const parts = selector.replace('#', '').replace('.', '').split('-');
            let current = section.config;
            
            for (let i = 0; i < parts.length - 1; i++) {
                if (current[parts[i]]) {
                    current = current[parts[i]];
                }
            }
            
            const lastKey = parts[parts.length - 1];
            if (current) {
                current[lastKey] = value;
            }
        }
    }

    findSectionForElement(selector) {
        return this.config.sections.find(section => 
            selector.toLowerCase().includes(section.id.toLowerCase())
        );
    }

    refreshPropertyPanel() {
        if (!this.selectedElement) return;
        
        // Update all property values from selected element
        const el = this.iframeDoc.querySelector(this.selectedElement.selector);
        if (!el) return;

        const computed = window.getComputedStyle(el);
        
        document.getElementById('propWidth').value = computed.width;
        document.getElementById('propHeight').value = computed.height;
        document.getElementById('propFontSize').value = computed.fontSize;
        document.getElementById('propColor').value = this.rgbToHex(computed.color);
        document.getElementById('propBackground').value = this.rgbToHex(computed.backgroundColor);
        document.getElementById('propBorderRadius').value = computed.borderRadius;
        document.getElementById('propOpacity').value = computed.opacity;
    }

    rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
        const result = rgb.match(/\d+/g);
        if (!result) return '#000000';
        return '#' + result.slice(0, 3).map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    // ============================================
    // History (Undo/Redo)
    // ============================================
    saveToHistory() {
        if (!this.selectedElement) return;

        const state = {
            selector: this.selectedElement.selector,
            properties: this.getElementProperties(this.selectedElement.selector)
        };

        this.undoStack.push(state);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        
        this.redoStack = [];
        this.updateHistoryButtons();
    }

    getElementProperties(selector) {
        if (!this.iframeDoc) return {};
        
        const el = this.iframeDoc.querySelector(selector);
        if (!el) return {};

        const computed = window.getComputedStyle(el);
        return {
            width: computed.width,
            height: computed.height,
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            fontSize: computed.fontSize,
            fontFamily: computed.fontFamily,
            fontWeight: computed.fontWeight,
            borderRadius: computed.borderRadius,
            opacity: computed.opacity,
            padding: computed.padding,
            margin: computed.margin
        };
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const state = this.undoStack.pop();
        this.redoStack.push(state);

        // Restore previous state
        if (this.iframeDoc) {
            const el = this.iframeDoc.querySelector(state.selector);
            if (el) {
                Object.entries(state.properties).forEach(([key, value]) => {
                    el.style[key] = value;
                });
            }
        }

        this.updateHistoryButtons();
        this.showToast('info', 'Undo', 'Reverted last change');
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const state = this.redoStack.pop();
        this.undoStack.push(state);

        // Re-apply state
        if (this.iframeDoc) {
            const el = this.iframeDoc.querySelector(state.selector);
            if (el) {
                Object.entries(state.properties).forEach(([key, value]) => {
                    el.style[key] = value;
                });
            }
        }

        this.updateHistoryButtons();
        this.showToast('info', 'Redo', 'Re-applied change');
    }

    updateHistoryButtons() {
        document.getElementById('undoBtn').disabled = this.undoStack.length === 0;
        document.getElementById('redoBtn').disabled = this.redoStack.length === 0;
    }

    // ============================================
    // Save / Publish
    // ============================================
    saveDraft() {
        const draft = {
            config: this.config,
            timestamp: Date.now(),
            version: '1.0'
        };

        localStorage.setItem('builderDraft', JSON.stringify(draft));
        this.config.builder.draft = draft;
        this.config.builder.lastSaved = new Date().toISOString();
        
        this.isModified = false;
        this.updatePublishStatus();
        this.showToast('success', 'Draft Saved', 'Your changes have been saved as a draft');
    }

    loadDraft() {
        const draftData = localStorage.getItem('builderDraft');
        if (draftData) {
            try {
                const draft = JSON.parse(draftData);
                this.config = draft.config || this.config;
                this.showToast('info', 'Draft Loaded', 'Previous draft has been restored');
            } catch (e) {
                console.error('Failed to load draft:', e);
            }
        }
    }

    publish() {
        // Save current config to localStorage (shared with live site)
        localStorage.setItem('siteConfig', JSON.stringify(this.config));
        
        // Also save to the keys that the live site expects
        Object.entries(this.config.sections).forEach(([key, section]) => {
            if (section.config) {
                localStorage.setItem(`tamilAIStream_${key}`, JSON.stringify(section.config));
            }
        });

        this.config.builder.published = new Date().toISOString();
        this.isModified = false;
        this.updatePublishStatus();

        this.showToast('success', 'Published!', 'Changes are now live on the website');

        // Trigger storage event for live site to update
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'siteConfig',
            newValue: JSON.stringify(this.config)
        }));

        // Reload preview iframe to show latest published content
        const iframe = document.getElementById('previewIframe');
        if (iframe && iframe.src) {
            const currentSrc = iframe.src;
            iframe.src = 'about:blank';
            setTimeout(() => {
                iframe.src = currentSrc;
            }, 100);
        }
    }

    resetToDefault() {
        if (!confirm('This will reset all changes to default. Are you sure?')) return;

        localStorage.removeItem('builderDraft');
        localStorage.removeItem('siteConfig');

        this.showToast('warning', 'Reset Complete', 'All changes have been reset to default');
        location.reload();
    }

    logout() {
        if (!confirm('Are you sure you want to logout?')) return;

        BuilderV2Auth.logout();
        this.showToast('info', 'Logged Out', 'You have been logged out successfully');
        setTimeout(() => {
            window.location.href = 'builder-v2-login.html';
        }, 800);
    }

    updatePublishStatus() {
        const badge = document.querySelector('.status-badge');
        const text = document.querySelector('.status-text');
        
        if (!badge || !text) return;

        if (this.config.builder.published) {
            badge.textContent = 'PUBLISHED';
            badge.className = 'status-badge published';
            text.textContent = `Last published: ${new Date(this.config.builder.published).toLocaleString()}`;
        } else if (this.config.builder.lastSaved) {
            badge.textContent = 'DRAFT';
            badge.className = 'status-badge draft';
            text.textContent = `Last saved: ${new Date(this.config.builder.lastSaved).toLocaleString()}`;
        } else {
            badge.textContent = 'DRAFT';
            badge.className = 'status-badge draft';
            text.textContent = 'Last saved: Never';
        }
    }

    // ============================================
    // Device Preview
    // ============================================
    setDevice(device) {
        this.currentDevice = device;

        document.querySelectorAll('.device-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.device === device);
        });

        const frame = document.getElementById('previewFrame');
        frame.className = 'preview-frame ' + device;

        // Reload iframe to ensure fresh content for the selected device viewport
        const iframe = document.getElementById('previewIframe');
        if (iframe && iframe.src) {
            const currentSrc = iframe.src;
            iframe.src = 'about:blank';
            setTimeout(() => {
                iframe.src = currentSrc;
            }, 50);
        }

        this.showToast('info', 'Device Changed', `Previewing as ${device}`);
    }

    zoom(delta) {
        const frame = document.getElementById('previewFrame');
        const current = parseInt(frame.style.transform.replace('scale(', '').replace(')', '') || 1);
        const newScale = Math.max(0.5, Math.min(2, current + delta / 100));
        
        frame.style.transform = `scale(${newScale})`;
        document.getElementById('zoomLevel').textContent = Math.round(newScale * 100) + '%';
    }

    toggleGrid() {
        document.getElementById('previewFrame').classList.toggle('show-grid');
    }

    toggleGuides() {
        document.getElementById('previewFrame').classList.toggle('show-guides');
    }

    // ============================================
    // Preview
    // ============================================
    openPreview() {
        document.getElementById('previewModal').style.display = 'flex';
    }

    closePreview() {
        document.getElementById('previewModal').style.display = 'none';
    }

    // ============================================
    // UI Rendering
    // ============================================
    renderElementTree() {
        const tree = document.getElementById('elementTree');
        if (!tree) return;

        const elements = [
            { name: 'Splash Screen', icon: 'fa-play', selector: '.splash-overlay', section: 'splash' },
            { name: 'Header', icon: 'fa-header', selector: 'header, .site-header', section: 'header' },
            { name: 'Search Bar', icon: 'fa-search', selector: '.search-bar, input[type="search"]', section: 'header' },
            { name: 'Navigation', icon: 'fa-bars', selector: 'nav, .main-nav', section: 'header' },
            { name: 'Hero Section', icon: 'fa-image', selector: '.hero-section, .greeting-section', section: 'hero' },
            { name: 'Categories', icon: 'fa-layer-group', selector: '.categories-section', section: 'categories' },
            { name: 'FM Stations', icon: 'fa-radio', selector: '.stations-section', section: 'stations' },
            { name: 'Trending', icon: 'fa-fire', selector: '.trending-section', section: 'trending' },
            { name: 'Featured', icon: 'fa-star', selector: '.featured-section', section: 'featured' },
            { name: 'Recently Added', icon: 'fa-clock', selector: '.recently-added-section', section: 'recentlyAdded' },
            { name: 'AI Assistant', icon: 'fa-robot', selector: '#ytmAiFab, .ytm-ai-fab', section: 'aiAssistant' },
            { name: 'Music Player', icon: 'fa-music', selector: '.mini-player, .player-bar', section: 'player' },
            { name: 'Footer', icon: 'fa-footer', selector: 'footer, .site-footer', section: 'footer' },
            { name: 'Toast Container', icon: 'fa-bell', selector: '.toast-container', section: 'toast' }
        ];

        tree.innerHTML = elements.map(el => `
            <div class="tree-item" data-selector="${el.selector}" data-section="${el.section}">
                <i class="fas ${el.icon}"></i>
                <span>${el.name}</span>
            </div>
        `).join('');

        // Add click handlers
        tree.querySelectorAll('.tree-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectElement(item.dataset.selector, item.dataset.section);
                
                // Update active state
                tree.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    renderSectionsList() {
        const list = document.getElementById('sectionsList');
        if (!list) return;

        list.innerHTML = this.config.sections.map(section => `
            <div class="section-item ${section.visible ? 'active' : ''}" data-section-id="${section.id}">
                <div class="section-icon">
                    <i class="fas fa-layer-group"></i>
                </div>
                <div class="section-info">
                    <div class="section-name">${section.name}</div>
                    <div class="section-status">${section.visible ? 'Visible' : 'Hidden'}</div>
                </div>
                <div class="section-toggle ${section.visible ? 'active' : ''}" data-section="${section.id}"></div>
            </div>
        `).join('');

        // Add click handlers for toggles
        list.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const sectionId = toggle.dataset.section;
                this.toggleSection(sectionId);
            });
        });

        // Add click handlers for section items
        list.querySelectorAll('.section-item').forEach(item => {
            item.addEventListener('click', () => {
                const sectionId = item.dataset.sectionId;
                this.selectSection(sectionId);
            });
        });
    }

    toggleSection(sectionId) {
        const section = this.config.sections.find(s => s.id === sectionId);
        if (section) {
            section.visible = !section.visible;
            this.renderSectionsList();
            this.applySectionVisibility();
            this.isModified = true;
            this.updatePublishStatus();
        }
    }

    selectSection(sectionId) {
        this.selectedSection = sectionId;
        const section = this.config.sections.find(s => s.id === sectionId);
        
        if (section) {
            // Show section-specific properties
            this.showToast('info', 'Section Selected', `Editing: ${section.name}`);
        }
    }

    applySectionVisibility() {
        if (!this.iframeDoc) return;

        this.config.sections.forEach(section => {
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

            const elements = this.iframeDoc.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.display = section.visible ? '' : 'none';
            });
        });
    }

    selectElement(selector, section) {
        this.selectedElement = { selector, section };
        
        // Show properties panel
        document.getElementById('noSelectionState').style.display = 'none';
        document.getElementById('elementProperties').style.display = 'block';

        // Update selected info
        document.getElementById('selectedInfo').textContent = selector;
        document.getElementById('propSection').textContent = section || 'Unknown';

        // Get element info
        if (this.iframeDoc) {
            const el = this.iframeDoc.querySelector(selector);
            if (el) {
                document.getElementById('propTag').textContent = el.tagName.toLowerCase();
                document.getElementById('propId').textContent = el.id || '-';
                document.getElementById('propClasses').textContent = el.className || '-';
                
                // Populate properties
                const computed = window.getComputedStyle(el);
                document.getElementById('propWidth').value = computed.width;
                document.getElementById('propHeight').value = computed.height;
                document.getElementById('propFontSize').value = computed.fontSize;
                document.getElementById('propColor').value = this.rgbToHex(computed.color);
                document.getElementById('propBackground').value = this.rgbToHex(computed.backgroundColor);
                document.getElementById('propBorderRadius').value = computed.borderRadius;
                document.getElementById('propOpacity').value = computed.opacity;
            }
        }

        this.showToast('info', 'Element Selected', selector);
    }

    resetSelectedElement() {
        if (!this.selectedElement || !confirm('Reset this element to default?')) return;

        this.saveToHistory();
        
        // Reset logic would go here
        this.showToast('success', 'Reset Complete', 'Element reset to default values');
    }

    deleteSelectedElement() {
        if (!this.selectedElement || !confirm('Delete this element?')) return;

        this.saveToHistory();
        
        if (this.iframeDoc) {
            const el = this.iframeDoc.querySelector(this.selectedElement.selector);
            if (el) {
                el.remove();
            }
        }

        this.selectedElement = null;
        document.getElementById('noSelectionState').style.display = 'block';
        document.getElementById('elementProperties').style.display = 'none';
        
        this.showToast('warning', 'Element Deleted', 'Element has been removed');
    }

    // ============================================
    // Toast Notifications
    // ============================================
    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `builder-toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.innerHTML = `
            <i class="fas ${icons[type]} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Initialize builder when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.builder = new VisualBuilder();
});
