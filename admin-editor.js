'use strict';

/* ============================================================
   AdminEditor — Section-based Visual Website Editor for Tamil AI Stream
   
   Provides: section detection, CSS override editing, responsive
   controls, undo/redo, drag reorder, duplicate, hide/show, and
   staging/publish workflow.
   ============================================================ */

const AdminEditor = (() => {
    // All editable sections discovered via data-section + structural selectors
    const SECTION_SELECTORS = [
        '[data-section="greeting"]',
        '[data-section="ai-new-album"]',
        '[data-section="ur-auto-slider"]',
        '[data-section="ai-one-tap-radio"]',
        '[data-section="ai-songs-collections"]',
        '[data-section="ai-music-hero"]',
        '[data-section="ai-trending"]',
        '[data-section="ai-live-fm"]',
        '[data-section="ai-evergreen"]',
        '[data-section="ai-recently"]',
        '[data-section="ai-ai-rec"]',
        '[data-section="ai-favorites"]',
        '[data-section="ai-decades"]',
        '.ai-home-row',
        '.ai-sidebar',
        '.premium-top-nav',
        '.site-footer',
        '.tamilai-bottom-nav',
    ];

    const SECTION_LABELS = {
        'greeting': 'Greeting',
        'ai-new-album': 'New Album',
        'ur-auto-slider': 'Upcoming Releases',
        'ai-one-tap-radio': 'One Tap Radio',
        'ai-songs-collections': 'Songs Collections',
        'ai-music-hero': 'Music Hero',
        'ai-trending': 'Trending',
        'ai-live-fm': 'Live FM',
        'ai-evergreen': 'Evergreen',
        'ai-recently': 'Recently Played',
        'ai-ai-rec': 'AI Recommendations',
        'ai-favorites': 'Favorites',
        'ai-decades': 'Decades / Era',
        'ai-home-row': 'Content Row',
        'ai-sidebar': 'Sidebar',
        'premium-top-nav': 'Top Navigation',
        'site-footer': 'Footer',
        'tamilai-bottom-nav': 'Bottom Nav',
    };

    const RESPONSIVE_KEYS = ['desktop', 'tablet', 'mobile'];

    // CSS property definitions grouped by category
    const CSS_CATEGORIES = {
        layout: {
            label: 'Layout',
            icon: 'fa-table-cells-large',
            properties: [
                { key: 'display', label: 'Display', type: 'select', options: ['block', 'flex', 'grid', 'none', 'inline-block', 'inline-flex'] },
                { key: 'flexDirection', label: 'Flex Direction', type: 'select', options: ['row', 'column', 'row-reverse', 'column-reverse'] },
                { key: 'justifyContent', label: 'Justify', type: 'select', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] },
                { key: 'alignItems', label: 'Align Items', type: 'select', options: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'] },
                { key: 'flexWrap', label: 'Flex Wrap', type: 'select', options: ['nowrap', 'wrap', 'wrap-reverse'] },
                { key: 'gap', label: 'Gap', type: 'size' },
                { key: 'width', label: 'Width', type: 'size' },
                { key: 'height', label: 'Height', type: 'size' },
                { key: 'minHeight', label: 'Min Height', type: 'size' },
                { key: 'maxWidth', label: 'Max Width', type: 'size' },
                { key: 'overflow', label: 'Overflow', type: 'select', options: ['visible', 'hidden', 'scroll', 'auto'] },
            ],
        },
        spacing: {
            label: 'Spacing',
            icon: 'fa-arrows-left-right',
            properties: [
                { key: 'paddingTop', label: 'Padding Top', type: 'size' },
                { key: 'paddingRight', label: 'Padding Right', type: 'size' },
                { key: 'paddingBottom', label: 'Padding Bottom', type: 'size' },
                { key: 'paddingLeft', label: 'Padding Left', type: 'size' },
                { key: 'marginTop', label: 'Margin Top', type: 'size' },
                { key: 'marginRight', label: 'Margin Right', type: 'size' },
                { key: 'marginBottom', label: 'Margin Bottom', type: 'size' },
                { key: 'marginLeft', label: 'Margin Left', type: 'size' },
            ],
        },
        background: {
            label: 'Background',
            icon: 'fa-fill-drip',
            properties: [
                { key: 'backgroundColor', label: 'Color', type: 'color' },
                { key: 'backgroundImage', label: 'Image URL', type: 'text' },
                { key: 'backgroundSize', label: 'Size', type: 'select', options: ['auto', 'cover', 'contain'] },
                { key: 'backgroundPosition', label: 'Position', type: 'text' },
                { key: 'backgroundRepeat', label: 'Repeat', type: 'select', options: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] },
                { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
            ],
        },
        typography: {
            label: 'Typography',
            icon: 'fa-font',
            properties: [
                { key: 'color', label: 'Text Color', type: 'color' },
                { key: 'fontSize', label: 'Font Size', type: 'size' },
                { key: 'fontWeight', label: 'Weight', type: 'select', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
                { key: 'fontFamily', label: 'Font Family', type: 'text' },
                { key: 'lineHeight', label: 'Line Height', type: 'size' },
                { key: 'letterSpacing', label: 'Letter Spacing', type: 'size' },
                { key: 'textAlign', label: 'Align', type: 'select', options: ['left', 'center', 'right', 'justify'] },
                { key: 'textTransform', label: 'Transform', type: 'select', options: ['none', 'uppercase', 'lowercase', 'capitalize'] },
                { key: 'textDecoration', label: 'Decoration', type: 'select', options: ['none', 'underline', 'overline', 'line-through'] },
                { key: 'whiteSpace', label: 'White Space', type: 'select', options: ['normal', 'nowrap', 'pre', 'pre-wrap'] },
            ],
        },
        border: {
            label: 'Border',
            icon: 'fa-border-all',
            properties: [
                { key: 'borderWidth', label: 'Width', type: 'size' },
                { key: 'borderStyle', label: 'Style', type: 'select', options: ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge'] },
                { key: 'borderColor', label: 'Color', type: 'color' },
                { key: 'borderRadius', label: 'Radius', type: 'size' },
                { key: 'borderTopLeftRadius', label: 'Radius TL', type: 'size' },
                { key: 'borderTopRightRadius', label: 'Radius TR', type: 'size' },
                { key: 'borderBottomLeftRadius', label: 'Radius BL', type: 'size' },
                { key: 'borderBottomRightRadius', label: 'Radius BR', type: 'size' },
            ],
        },
        shadow: {
            label: 'Shadow & Effects',
            icon: 'fa-cloud',
            properties: [
                { key: 'boxShadow', label: 'Box Shadow', type: 'text' },
                { key: 'textShadow', label: 'Text Shadow', type: 'text' },
                { key: 'backdropFilter', label: 'Backdrop Filter', type: 'text' },
            ],
        },
        transform: {
            label: 'Transform & Animation',
            icon: 'fa-wand-magic-sparkles',
            properties: [
                { key: 'transform', label: 'Transform', type: 'text' },
                { key: 'transition', label: 'Transition', type: 'text' },
                { key: 'animation', label: 'Animation', type: 'text' },
            ],
        },
        visibility: {
            label: 'Visibility',
            icon: 'fa-eye',
            properties: [
                { key: 'visibility', label: 'Visibility', type: 'select', options: ['visible', 'hidden'] },
                { key: 'display', label: 'Display', type: 'select', options: ['block', 'flex', 'grid', 'none', 'inline-block'] },
                { key: 'position', label: 'Position', type: 'select', options: ['static', 'relative', 'absolute', 'fixed', 'sticky'] },
                { key: 'zIndex', label: 'Z-Index', type: 'number' },
                { key: 'top', label: 'Top', type: 'size' },
                { key: 'right', label: 'Right', type: 'size' },
                { key: 'bottom', label: 'Bottom', type: 'size' },
                { key: 'left', label: 'Left', type: 'size' },
            ],
        },
    };

    let _frame = null;
    let _frameWin = null;
    let _frameDoc = null;
    let _sections = [];
    let _selectedSectionId = null;
    let _currentDevice = 'desktop';
    let _overrides = { sections: {}, order: [], hidden: {} };
    let _undoStack = [];
    let _redoStack = [];
    let _isDirty = false;
    let _listeners = {};

    // ── Element-level editing ──
    let _elements = [];           // All detected editable elements
    let _selectedElementId = null;
    let _elementOverrides = {};   // { elementId: { desktop: {...}, tablet: {...}, mobile: {...} } }
    let _lockedElements = {};     // { elementId: true }
    let _clipboard = null;        // Copied CSS properties
    let _globalSettings = {       // Site-wide CSS variables
        colors: {}, fonts: {}, spacing: {}, borderRadius: {},
    };
    let _elementMode = false;     // true = editing individual elements, false = editing sections

    // ── Init ──
    function init(iframe) {
        _frame = iframe;
        _frame.addEventListener('load', _onFrameLoad);
        if (_frame.contentDocument && _frame.contentDocument.readyState === 'complete') {
            _onFrameLoad();
        }
    }

    function _onFrameLoad() {
        try {
            _frameWin = _frame.contentWindow;
            _frameDoc = _frame.contentDocument;
            if (!_frameDoc) return;
            _injectEditorStyles();
            _blockAudio();
            detectSections();
            _emit('frame-loaded');
        } catch (e) {
            console.warn('[AdminEditor] Frame load error:', e);
        }
    }

    // ── Block audio playback inside iframe ──
    function _blockAudio() {
        if (!_frameWin) return;
        try {
            // Override Audio constructor
            const OrigAudio = _frameWin.Audio;
            _frameWin.Audio = function() {
                console.warn('[AdminEditor] Audio playback blocked in admin mode');
                return { play: () => Promise.resolve(), pause: () => {}, load: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
            };
            // Pause all existing media elements
            _frameDoc.querySelectorAll('audio, video').forEach(el => {
                el.pause();
                el.src = '';
                el.removeAttribute('src');
            });
            // Override play() on all media elements
            _frameDoc.querySelectorAll('audio, video').forEach(el => {
                el.play = () => { console.warn('[AdminEditor] Playback blocked'); return Promise.resolve(); };
            });
            // MutationObserver to catch dynamically added media
            const obs = new _frameWin.MutationObserver((mutations) => {
                mutations.forEach(m => {
                    m.addedNodes.forEach(node => {
                        if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
                            node.pause();
                            node.src = '';
                            node.play = () => Promise.resolve();
                        }
                        if (node.querySelectorAll) {
                            node.querySelectorAll('audio, video').forEach(el => {
                                el.pause();
                                el.src = '';
                                el.play = () => Promise.resolve();
                            });
                        }
                    });
                });
            });
            obs.observe(_frameDoc.body, { childList: true, subtree: true });
        } catch (e) { /* ignore */ }
    }

    // ── Inject editor highlight styles into iframe ──
    function _injectEditorStyles() {
        if (!_frameDoc) return;
        if (_frameDoc.getElementById('admin-editor-inject')) return;
        const style = _frameDoc.createElement('style');
        style.id = 'admin-editor-inject';
        style.textContent = `
            [data-ao-highlight] { outline: 2px dashed rgba(16,185,129,0.5) !important; outline-offset: 2px; cursor: pointer !important; transition: outline 0.15s; }
            [data-ao-highlight]:hover { outline-color: rgba(16,185,129,0.9) !important; }
            [data-ao-selected] { outline: 2px solid #10b981 !important; outline-offset: 2px; }
            [data-ao-hidden] { opacity: 0.15 !important; }
        `;
        _frameDoc.head.appendChild(style);
    }

    // ── Section Detection ──
    function detectSections() {
        if (!_frameDoc) return [];
        _sections = [];
        const seen = new Set();

        SECTION_SELECTORS.forEach(sel => {
            try {
                _frameDoc.querySelectorAll(sel).forEach(el => {
                    if (seen.has(el)) return;
                    seen.add(el);

                    const ds = el.getAttribute('data-section');
                    const id = ds || el.id || el.className.split(' ').filter(c => c.startsWith('ai-') || c.startsWith('premium-') || c.startsWith('site-')).slice(0, 2).join('-') || 'section-' + _sections.length;
                    const label = SECTION_LABELS[ds] || el.className.split(' ').filter(c => c && !c.includes('active')).slice(0, 2).join(' / ') || id;

                    _sections.push({
                        id,
                        label,
                        selector: ds ? `[data-section="${ds}"]` : _buildSelector(el),
                        element: el,
                        visible: el.style.display !== 'none' && !_overrides.hidden?.[id],
                    });

                    el.setAttribute('data-ao-highlight', id);
                    el.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectSection(id);
                    }, { capture: true });
                });
            } catch (e) { /* ignore invalid selectors */ }
        });

        _emit('sections-detected', _sections);
        return _sections;
    }

    function _buildSelector(el) {
        if (el.id) return '#' + el.id;
        const classes = Array.from(el.classList).filter(c => c && !c.includes('active')).slice(0, 3);
        return classes.length ? '.' + classes.join('.') : el.tagName.toLowerCase();
    }

    function getSections() { return _sections.slice(); }

    // ── Section Selection ──
    function selectSection(id) {
        // Deselect previous
        if (_selectedSectionId) {
            const prev = _frameDoc.querySelector(`[data-ao-selected]`);
            if (prev) prev.removeAttribute('data-ao-selected');
        }

        _selectedSectionId = id;
        const sec = _sections.find(s => s.id === id);
        if (sec && sec.element) {
            sec.element.setAttribute('data-ao-selected', id);
            sec.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        _emit('section-selected', { id, section: sec });
    }

    function getSelectedSection() {
        return _sections.find(s => s.id === _selectedSectionId) || null;
    }

    function getSelectedSectionId() { return _selectedSectionId; }

    // ── Device / Responsive Mode ──
    function setDevice(device) {
        _currentDevice = device;
        if (!_frameWin) return;
        const widths = { desktop: '100%', tablet: '768px', mobile: '375px' };
        _frame.style.maxWidth = widths[device] || '100%';
        _frame.style.margin = device === 'desktop' ? '0' : '0 auto';
        _frame.style.borderLeft = device !== 'desktop' ? '1px solid rgba(255,255,255,0.1)' : 'none';
        _frame.style.borderRight = device !== 'desktop' ? '1px solid rgba(255,255,255,0.1)' : 'none';
        _emit('device-changed', device);
    }

    function getDevice() { return _currentDevice; }

    // ── CSS Overrides ──
    function setOverride(sectionId, property, value) {
        _pushUndo();
        if (!_overrides.sections[sectionId]) _overrides.sections[sectionId] = {};
        if (!_overrides.sections[sectionId][_currentDevice]) _overrides.sections[sectionId][_currentDevice] = {};

        if (value === '' || value === null || value === undefined) {
            delete _overrides.sections[sectionId][_currentDevice][property];
        } else {
            _overrides.sections[sectionId][_currentDevice][property] = value;
        }

        _applyOverride(sectionId);
        _isDirty = true;
        _emit('override-changed', { sectionId, property, value, device: _currentDevice });
    }

    function getOverrides(sectionId) {
        const sec = _overrides.sections[sectionId] || {};
        return sec[_currentDevice] || {};
    }

    function getAllOverrides() {
        return JSON.parse(JSON.stringify(_overrides));
    }

    function _applyOverride(sectionId) {
        if (!_frameDoc) return;
        const sec = _sections.find(s => s.id === sectionId);
        if (!sec || !sec.element) return;

        const allDevices = _overrides.sections[sectionId] || {};
        const merged = {};

        // Apply in order: mobile -> tablet -> desktop (responsive cascade)
        if (allDevices.desktop) Object.assign(merged, allDevices.desktop);
        if (_currentDevice === 'tablet' && allDevices.tablet) Object.assign(merged, allDevices.tablet);
        if (_currentDevice === 'mobile') {
            if (allDevices.tablet) Object.assign(merged, allDevices.tablet);
            if (allDevices.mobile) Object.assign(merged, allDevices.mobile);
        }

        // Apply CSS
        Object.entries(merged).forEach(([prop, val]) => {
            if (val === '' || val === null || val === undefined) {
                sec.element.style.removeProperty(_toKebab(prop));
            } else {
                sec.element.style[prop] = val;
            }
        });
    }

    function applyAllOverrides() {
        if (!_frameDoc) return;
        // Reset all section styles first
        _sections.forEach(sec => {
            if (sec.element) sec.element.removeAttribute('style');
        });
        // Apply overrides
        Object.keys(_overrides.sections).forEach(id => _applyOverride(id));
        // Apply hidden state
        Object.entries(_overrides.hidden || {}).forEach(([id, hidden]) => {
            const sec = _sections.find(s => s.id === id);
            if (sec && sec.element) {
                sec.element.classList.toggle('data-ao-hidden', hidden);
                sec.element.style.display = hidden ? 'none' : '';
            }
        });
        // Apply order
        if (_overrides.order && _overrides.order.length) {
            _applyOrder();
        }
    }

    function _toKebab(str) {
        return str.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    // ── Section Operations ──
    function toggleVisibility(sectionId) {
        _pushUndo();
        const hidden = !_overrides.hidden?.[sectionId];
        if (!_overrides.hidden) _overrides.hidden = {};
        _overrides.hidden[sectionId] = hidden;

        const sec = _sections.find(s => s.id === sectionId);
        if (sec && sec.element) {
            sec.element.style.display = hidden ? 'none' : '';
            sec.visible = !hidden;
        }
        _isDirty = true;
        _emit('visibility-changed', { sectionId, hidden });
    }

    function duplicateSection(sectionId) {
        const sec = _sections.find(s => s.id === sectionId);
        if (!sec || !sec.element || !_frameDoc) return;

        _pushUndo();
        const clone = sec.element.cloneNode(true);
        const newId = sectionId + '-copy-' + Date.now();
        clone.setAttribute('data-section', newId);
        clone.setAttribute('data-ao-highlight', newId);
        sec.element.parentNode.insertBefore(clone, sec.element.nextSibling);

        _sections.push({
            id: newId,
            label: sec.label + ' (Copy)',
            selector: `[data-section="${newId}"]`,
            element: clone,
            visible: true,
        });

        // Copy overrides
        if (_overrides.sections[sectionId]) {
            _overrides.sections[newId] = JSON.parse(JSON.stringify(_overrides.sections[sectionId]));
        }

        _isDirty = true;
        _emit('section-duplicated', { originalId: sectionId, newId });
        detectSections();
    }

    function deleteSection(sectionId) {
        const sec = _sections.find(s => s.id === sectionId);
        if (!sec || !sec.element) return;

        _pushUndo();
        sec.element.style.display = 'none';
        if (!_overrides.hidden) _overrides.hidden = {};
        _overrides.hidden[sectionId] = true;
        sec.visible = false;

        _isDirty = true;
        _emit('section-deleted', { sectionId });
    }

    function moveSection(sectionId, direction) {
        const sec = _sections.find(s => s.id === sectionId);
        if (!sec || !sec.element) return;

        _pushUndo();
        const parent = sec.element.parentNode;
        if (direction === 'up' && sec.element.previousElementSibling) {
            parent.insertBefore(sec.element, sec.element.previousElementSibling);
        } else if (direction === 'down' && sec.element.nextElementSibling) {
            parent.insertBefore(sec.element.nextElementSibling, sec.element);
        }

        _isDirty = true;
        _updateOrder();
        _emit('section-moved', { sectionId, direction });
    }

    function reorderSections(orderedIds) {
        _pushUndo();
        orderedIds.forEach((id, index) => {
            const sec = _sections.find(s => s.id === id);
            if (sec && sec.element) {
                sec.element.parentNode.appendChild(sec.element);
            }
        });
        _overrides.order = orderedIds;
        _isDirty = true;
        _emit('sections-reordered', orderedIds);
    }

    function _updateOrder() {
        _overrides.order = _sections
            .filter(s => s.element && s.element.parentNode)
            .map(s => s.id);
    }

    function _applyOrder() {
        if (!_overrides.order || !_frameDoc) return;
        _overrides.order.forEach(id => {
            const sec = _sections.find(s => s.id === id);
            if (sec && sec.element && sec.element.parentNode) {
                sec.element.parentNode.appendChild(sec.element);
            }
        });
    }

    // ── Undo / Redo ──
    function _pushUndo() {
        _undoStack.push(JSON.parse(JSON.stringify(_overrides)));
        if (_undoStack.length > 50) _undoStack.shift();
        _redoStack = [];
    }

    function undo() {
        if (_undoStack.length === 0) return;
        _redoStack.push(JSON.parse(JSON.stringify(_overrides)));
        _overrides = _undoStack.pop();
        applyAllOverrides();
        _isDirty = true;
        _emit('undo', null);
    }

    function redo() {
        if (_redoStack.length === 0) return;
        _undoStack.push(JSON.parse(JSON.stringify(_overrides)));
        _overrides = _redoStack.pop();
        applyAllOverrides();
        _isDirty = true;
        _emit('redo', null);
    }

    function canUndo() { return _undoStack.length > 0; }
    function canRedo() { return _redoStack.length > 0; }

    // ── Generate CSS string from overrides ──
    function generateCSS() {
        let css = '/* Admin Editor Overrides — Generated by TamilAI Stream Admin */\n\n';
        Object.entries(_overrides.sections).forEach(([sectionId, devices]) => {
            const sec = _sections.find(s => s.id === sectionId);
            const selector = sec ? sec.selector : `[data-section="${sectionId}"]`;
            Object.entries(devices).forEach(([device, props]) => {
                if (!props || Object.keys(props).length === 0) return;
                const mediaQuery = device === 'mobile' ? '@media (max-width: 640px)' : device === 'tablet' ? '@media (min-width: 641px) and (max-width: 1024px)' : '';
                const lines = Object.entries(props).map(([k, v]) => `  ${_toKebab(k)}: ${v};`).join('\n');
                if (mediaQuery) {
                    css += `${mediaQuery} {\n  ${selector} {\n${lines}\n  }\n}\n\n`;
                } else {
                    css += `${selector} {\n${lines}\n}\n\n`;
                }
            });
        });
        return css;
    }

    // ── Save / Load ──
    function exportOverrides() {
        return JSON.parse(JSON.stringify(_overrides));
    }

    function importOverrides(data) {
        _pushUndo();
        _overrides = data || { sections: {}, order: [], hidden: {} };
        applyAllOverrides();
        _isDirty = false;
        _emit('overrides-imported', _overrides);
    }

    function isDirty() { return _isDirty; }
    function markClean() { _isDirty = false; }

    // ═══════════════════════════════════════════════════════
    //  ELEMENT-LEVEL EDITING — click any element to edit it
    // ═══════════════════════════════════════════════════════

    function setElementMode(enabled) {
        _elementMode = enabled;
        _emit('element-mode-changed', enabled);
    }
    function isElementMode() { return _elementMode; }

    function detectElements() {
        if (!_frameDoc) return [];
        _elements = [];
        const skip = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'HTML', 'BODY', 'BR', 'HR']);
        let idx = 0;

        function walk(root, depth, parent) {
            if (!root || !root.children) return;
            Array.from(root.children).forEach(el => {
                if (skip.has(el.tagName)) return;
                if (el.id === 'admin-editor-inject') return;
                if (el.closest && el.closest('#admin-editor-inject')) return;
                if (el.getAttribute && el.getAttribute('data-ao-highlight')) return; // section-level

                const tag = el.tagName.toLowerCase();
                const id = el.id || '';
                const cls = Array.from(el.classList || []).filter(c => c && !c.includes('active') && !c.includes('data-ao')).slice(0, 2).join('.');
                const selector = id ? '#' + id : (cls ? tag + '.' + cls : _buildSelector(el));
                const text = (el.textContent || '').trim().slice(0, 40);
                const elId = id || (parent ? parent.id + '>' : '') + selector + '-' + idx;

                const entry = {
                    id: elId,
                    tag,
                    label: id || cls || tag,
                    selector,
                    element: el,
                    depth,
                    parent: parent ? parent.id : null,
                    children: [],
                    text: text || undefined,
                    visible: el.style.display !== 'none',
                    locked: !!_lockedElements[elId],
                };
                _elements.push(entry);
                if (parent) parent.children.push(entry);
                idx++;

                // Make clickable in element mode
                el.addEventListener('click', (e) => {
                    if (!_elementMode) return;
                    e.preventDefault();
                    e.stopPropagation();
                    selectElement(elId);
                }, { capture: true });

                walk(el, depth + 1, entry);
            });
        }
        walk(_frameDoc.body, 0, null);
        _emit('elements-detected', _elements);
        return _elements;
    }

    function getElements() { return _elements.slice(); }

    function getRootElementChildren() {
        return _elements.filter(e => !e.parent);
    }

    function selectElement(id) {
        // Deselect previous
        if (_selectedElementId) {
            const prev = _frameDoc.querySelector('[data-ao-el-selected]');
            if (prev) prev.removeAttribute('data-ao-el-selected');
        }
        _selectedElementId = id;
        const el = _elements.find(e => e.id === id);
        if (el && el.element) {
            el.element.setAttribute('data-ao-el-selected', id);
            el.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        _emit('element-selected', { id, element: el });
    }

    function getSelectedElement() { return _elements.find(e => e.id === _selectedElementId) || null; }
    function getSelectedElementId() { return _selectedElementId; }

    function getElementOverrides(id) {
        const el = _elementOverrides[id] || {};
        return el[_currentDevice] || {};
    }

    function setElementOverride(id, property, value) {
        _pushUndo();
        if (!_elementOverrides[id]) _elementOverrides[id] = {};
        if (!_elementOverrides[id][_currentDevice]) _elementOverrides[id][_currentDevice] = {};
        if (value === '' || value === null || value === undefined) {
            delete _elementOverrides[id][_currentDevice][property];
        } else {
            _elementOverrides[id][_currentDevice][property] = value;
        }
        _applyElementOverride(id);
        _isDirty = true;
        _emit('element-override-changed', { elementId: id, property, value, device: _currentDevice });
    }

    function _applyElementOverride(id) {
        if (!_frameDoc) return;
        const el = _elements.find(e => e.id === id);
        if (!el || !el.element) return;

        const allDevices = _elementOverrides[id] || {};
        const merged = {};
        if (allDevices.desktop) Object.assign(merged, allDevices.desktop);
        if (_currentDevice === 'tablet' && allDevices.tablet) Object.assign(merged, allDevices.tablet);
        if (_currentDevice === 'mobile') {
            if (allDevices.tablet) Object.assign(merged, allDevices.tablet);
            if (allDevices.mobile) Object.assign(merged, allDevices.mobile);
        }

        Object.entries(merged).forEach(([prop, val]) => {
            if (val === '' || val === null || val === undefined) {
                el.element.style.removeProperty(_toKebab(prop));
            } else {
                el.element.style[prop] = val;
            }
        });
    }

    function applyAllElementOverrides() {
        Object.keys(_elementOverrides).forEach(id => _applyElementOverride(id));
    }

    // ── Lock / Unlock ──
    function lockElement(id) {
        _lockedElements[id] = true;
        const el = _elements.find(e => e.id === id);
        if (el) el.locked = true;
        _emit('element-locked', id);
    }

    function unlockElement(id) {
        delete _lockedElements[id];
        const el = _elements.find(e => e.id === id);
        if (el) el.locked = false;
        _emit('element-unlocked', id);
    }

    function isLocked(id) { return !!_lockedElements[id]; }

    function toggleLock(id) {
        if (_lockedElements[id]) unlockElement(id); else lockElement(id);
    }

    // ── Copy / Paste CSS ──
    function copyProperties() {
        const id = _selectedElementId || _selectedSectionId;
        if (!id) return;
        const src = _elementOverrides[id] || _overrides.sections[id] || {};
        _clipboard = JSON.parse(JSON.stringify(src));
        _emit('properties-copied', { id, clipboard: _clipboard });
    }

    function pasteProperties() {
        const id = _selectedElementId || _selectedSectionId;
        if (!id || !_clipboard) return;
        _pushUndo();
        if (_selectedElementId) {
            _elementOverrides[id] = JSON.parse(JSON.stringify(_clipboard));
            _applyElementOverride(id);
        } else {
            _overrides.sections[id] = JSON.parse(JSON.stringify(_clipboard));
            _applyOverride(id);
        }
        _isDirty = true;
        _emit('properties-pasted', { id });
    }

    function getClipboard() { return _clipboard ? JSON.parse(JSON.stringify(_clipboard)) : null; }

    // ── Global Settings ──
    function getGlobalSettings() { return JSON.parse(JSON.stringify(_globalSettings)); }

    function setGlobalSettings(settings) {
        _pushUndo();
        _globalSettings = settings || _globalSettings;
        _applyGlobalSettings();
        _isDirty = true;
        _emit('global-settings-changed', _globalSettings);
    }

    function _applyGlobalSettings() {
        if (!_frameDoc) return;
        let style = _frameDoc.getElementById('admin-global-settings');
        if (!style) {
            style = _frameDoc.createElement('style');
            style.id = 'admin-global-settings';
            _frameDoc.head.appendChild(style);
        }
        let css = ':root {\n';
        Object.entries(_globalSettings.colors || {}).forEach(([k, v]) => { if (v) css += `  ${k}: ${v};\n`; });
        Object.entries(_globalSettings.fonts || {}).forEach(([k, v]) => { if (v) css += `  ${k}: ${v};\n`; });
        Object.entries(_globalSettings.spacing || {}).forEach(([k, v]) => { if (v) css += `  ${k}: ${v};\n`; });
        Object.entries(_globalSettings.borderRadius || {}).forEach(([k, v]) => { if (v) css += `  ${k}: ${v};\n`; });
        css += '}';
        style.textContent = css;
    }

    // ── Get element tree for layers panel ──
    function getElementTree() {
        const root = getRootElementChildren();
        function toNode(el) {
            return {
                id: el.id,
                label: el.label,
                tag: el.tag,
                visible: el.visible !== false,
                locked: !!_lockedElements[el.id],
                selected: _selectedElementId === el.id,
                children: (el.children || []).map(toNode),
            };
        }
        return root.map(toNode);
    }

    // ── Events ──
    function on(event, fn) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(fn);
        return () => { _listeners[event] = _listeners[event].filter(f => f !== fn); };
    }

    function _emit(event, data) {
        (_listeners[event] || []).forEach(fn => { try { fn(data); } catch (e) { /* ignore */ } });
    }

    // ── Public API ──
    return {
        init,
        detectSections,
        getSections,
        selectSection,
        getSelectedSection,
        getSelectedSectionId,
        setDevice,
        getDevice,
        setOverride,
        getOverrides,
        getAllOverrides,
        applyAllOverrides,
        toggleVisibility,
        duplicateSection,
        deleteSection,
        moveSection,
        reorderSections,
        undo,
        redo,
        canUndo,
        canRedo,
        generateCSS,
        exportOverrides,
        importOverrides,
        isDirty,
        markClean,
        on,
        CSS_CATEGORIES,
        RESPONSIVE_KEYS,
        // Element-level editing
        setElementMode,
        isElementMode,
        detectElements,
        getElements,
        getRootElementChildren,
        selectElement,
        getSelectedElement,
        getSelectedElementId,
        getElementOverrides,
        setElementOverride,
        applyAllElementOverrides,
        // Lock
        lockElement,
        unlockElement,
        isLocked,
        toggleLock,
        // Copy/Paste
        copyProperties,
        pasteProperties,
        getClipboard,
        // Global settings
        getGlobalSettings,
        setGlobalSettings,
        // Layers
        getElementTree,
    };
})();
