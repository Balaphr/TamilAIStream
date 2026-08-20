'use strict';

/**
 * ve-edit-mode.js — Visual Editor Edit Mode Script
 * Injected into the preview iframe to block live interactions and enable
 * visual editing controls (selection borders, hover highlights, element labels).
 *
 * This script runs INSIDE the iframe context (index.html).
 * It communicates with the parent builder via postMessage.
 */
(function () {
    if (window.__VE_EDIT_MODE__) return;
    window.__VE_EDIT_MODE__ = true;

    let isEditMode = true;
    let hoveredEl = null;
    let selectedEl = null;
    let overlayBox = null;
    let labelEl = null;
    let dragHandle = null;

    // ─── Block all live interactions ───────────────────────────────────
    function blockEvent(e) {
        if (!isEditMode) return;
        // Allow builder-internal events (from parent)
        if (e.__veInternal) return;
        // Block clicks on interactive elements
        const tag = (e.target || '').tagName;
        const interactive = e.target?.closest?.('a, button, [onclick], input, select, textarea, .song-card, .station-card, .slide-card, .ai-glass-song-card, .ai-fm-card, .ra-card, .dash-song-card, .ytm-song-card, .ai-song-card, .ai-rec-song, .premium-radio-card, .slide-play-btn, .sg-play-btn, .station-play-overlay, .song-play-btn, .recent-play-btn, .playlist-song-play, [data-song-id], [data-station], [role="button"], .ai-play-btn, .ai-quick-tag, .ai-rec-action, .nav-item, .bottom-nav-item, .mini-player, .gp-mini, .gp-expanded');
        if (interactive) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
    }

    function blockKeydown(e) {
        if (!isEditMode) return;
        const tag = (e.target || '').tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        // Block space, enter, arrow keys that trigger playback
        if (['Space', 'Enter', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }

    // ─── Hover highlight ──────────────────────────────────────────────
    function onHover(e) {
        if (!isEditMode) return;
        const el = getEditableAncestor(e.target);
        if (el === hoveredEl) return;
        if (hoveredEl) removeHighlight(hoveredEl);
        hoveredEl = el;
        if (el) addHighlight(el);
    }

    function getEditableAncestor(target) {
        if (!target || target === document.body || target === document.documentElement) return null;
        // Walk up to find a meaningful editable element
        let el = target;
        while (el && el !== document.body) {
            if (el.nodeType === 1 && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') return el;
            el = el.parentElement;
        }
        return null;
    }

    function addHighlight(el) {
        el.style.outline = '2px solid rgba(99, 102, 241, 0.6)';
        el.style.outlineOffset = '-1px';
        el.style.cursor = 'pointer';
        el.setAttribute('data-ve-hovered', 'true');
    }

    function removeHighlight(el) {
        if (!el) return;
        if (el.getAttribute('data-ve-hovered')) {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.style.cursor = '';
            el.removeAttribute('data-ve-hovered');
        }
    }

    // ─── Click selection ──────────────────────────────────────────────
    function onClick(e) {
        if (!isEditMode) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const el = getEditableAncestor(e.target);
        if (!el) return;

        // Deselect previous
        if (selectedEl) deselectElement(selectedEl);

        // Select new
        selectedEl = el;
        selectElement(el);

        // Notify parent builder
        try {
            window.parent.postMessage({
                type: 've-element-selected',
                tag: el.tagName.toLowerCase(),
                id: el.id || '',
                className: el.className || '',
                text: (el.textContent || '').substring(0, 100).trim(),
                rect: el.getBoundingClientRect().toJSON(),
                html: el.outerHTML.substring(0, 500)
            }, '*');
        } catch (err) {}
        return false;
    }

    function selectElement(el) {
        el.style.outline = '2px solid #6366f1';
        el.style.outlineOffset = '-1px';
        el.setAttribute('data-ve-selected', 'true');
        showOverlay(el);
        showLabel(el);
    }

    function deselectElement(el) {
        if (!el) return;
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.removeAttribute('data-ve-selected');
        hideOverlay();
        hideLabel();
    }

    function clearSelection() {
        if (selectedEl) {
            deselectElement(selectedEl);
            selectedEl = null;
            try {
                window.parent.postMessage({ type: 've-selection-cleared' }, '*');
            } catch (err) {}
        }
    }

    // ─── Selection overlay box ────────────────────────────────────────
    function showOverlay(el) {
        if (!overlayBox) {
            overlayBox = document.createElement('div');
            overlayBox.className = 've-selection-overlay';
            overlayBox.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;border:2px solid #6366f1;background:rgba(99,102,241,0.08);transition:all 0.1s ease;';
            document.body.appendChild(overlayBox);
        }
        updateOverlayPosition(el);
    }

    function updateOverlayPosition(el) {
        if (!overlayBox || !el) return;
        const r = el.getBoundingClientRect();
        overlayBox.style.left = (r.left - 2) + 'px';
        overlayBox.style.top = (r.top - 2) + 'px';
        overlayBox.style.width = (r.width + 4) + 'px';
        overlayBox.style.height = (r.height + 4) + 'px';
        overlayBox.style.display = 'block';
    }

    function hideOverlay() {
        if (overlayBox) overlayBox.style.display = 'none';
    }

    // ─── Element label ────────────────────────────────────────────────
    function showLabel(el) {
        if (!labelEl) {
            labelEl = document.createElement('div');
            labelEl.className = 've-element-label';
            labelEl.style.cssText = 'position:fixed;z-index:999999;background:#6366f1;color:#fff;font:600 10px/1 Inter,sans-serif;padding:3px 8px;border-radius:4px 4px 0 0;pointer-events:none;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
            document.body.appendChild(labelEl);
        }
        const tag = el.tagName.toLowerCase();
        const id = el.id ? '#' + el.id : '';
        const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '';
        labelEl.textContent = tag + id + cls;
        const r = el.getBoundingClientRect();
        labelEl.style.left = r.left + 'px';
        labelEl.style.top = (r.top - 22) + 'px';
        labelEl.style.display = 'block';
    }

    function hideLabel() {
        if (labelEl) labelEl.style.display = 'none';
    }

    // ─── PostMessage handler (from parent builder) ────────────────────
    window.addEventListener('message', function (e) {
        const msg = e.data;
        if (!msg || !msg.type) return;

        switch (msg.type) {
            case 've-set-edit-mode':
                isEditMode = !!msg.editMode;
                if (!isEditMode) {
                    clearSelection();
                    document.body.style.cursor = '';
                } else {
                    document.body.style.cursor = 'crosshair';
                }
                break;
            case 've-clear-selection':
                clearSelection();
                break;
            case 've-scroll-to':
                if (msg.selector) {
                    try {
                        const target = document.querySelector(msg.selector);
                        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } catch (err) {}
                }
                break;
            case 've-update-overlay':
                if (selectedEl) updateOverlayPosition(selectedEl);
                break;
            case 've-highlight-element':
                if (msg.selector) {
                    try {
                        const t = document.querySelector(msg.selector);
                        if (t) {
                            t.style.outline = '2px dashed #f59e0b';
                            t.style.outlineOffset = '-1px';
                            setTimeout(() => { t.style.outline = ''; t.style.outlineOffset = ''; }, 2000);
                        }
                    } catch (err) {}
                }
                break;
        }
    });

    // ─── Initialize ───────────────────────────────────────────────────
    function init() {
        // Block live interactions
        document.addEventListener('click', blockEvent, true);
        document.addEventListener('dblclick', blockEvent, true);
        document.addEventListener('mousedown', blockEvent, true);
        document.addEventListener('mouseup', blockEvent, true);
        document.addEventListener('keydown', blockKeydown, true);
        document.addEventListener('keyup', blockKeydown, true);
        document.addEventListener('submit', blockEvent, true);

        // Hover highlight
        document.addEventListener('mouseover', onHover, true);

        // Click selection
        document.addEventListener('click', onClick, true);

        // Escape to deselect
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') clearSelection();
        }, true);

        // Set cursor mode
        document.body.style.cursor = 'crosshair';

        // Notify parent that edit mode is active
        try {
            window.parent.postMessage({ type: 've-edit-mode-ready' }, '*');
        } catch (err) {}

        console.log('[VE] Edit mode active — all live interactions blocked');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
