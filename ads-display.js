'use strict';

/* ============================================
   Ads Display Engine — Tamil AI Stream
   Renders ads based on user type, location,
   dates, priority. Premium = zero ads.
   ============================================ */

const AdsDisplay = (() => {

    const AD_LOCATIONS = {
        home: 'Home Page',
        music: 'Music List',
        radio: 'Radio Section',
        news: 'News/Posts Section',
        between: 'Between Content Sections',
        sticky: 'Bottom Sticky Area'
    };

    let _initialized = false;
    let _stickyDismissed = false;
    let _renderedSlots = new Set();

    /* --- User Type Detection --- */
    function getUserType() {
        try {
            if (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin()) return 'admin';
            const user = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser() : null;
            if (!user) return 'guest';
            if (user.isGuest) return 'guest';
            if (user.premium || user.plan === 'premium') return 'premium';
            return 'free';
        } catch (e) { return 'guest'; }
    }

    function shouldShowAds() {
        const userType = getUserType();
        if (userType === 'premium') return false;
        const settings = (typeof DataStore !== 'undefined' && DataStore.getSiteSettings) ? DataStore.getSiteSettings() : {};
        if (settings.adsEnabled === false) return false;
        return true;
    }

    function getActiveAds(location) {
        if (typeof DataStore === 'undefined' || !DataStore.getAdvertisements) return [];
        let ads = DataStore.getAdvertisements();
        if (!ads || !ads.length) return [];
        const now = new Date().toISOString();
        ads = ads.filter(ad => {
            if (ad.enabled === false) return false;
            if (ad.startDate && ad.startDate > now) return false;
            if (ad.endDate && ad.endDate < now) return false;
            if (location && ad.location && ad.location !== location) return false;
            return true;
        });
        ads.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        return ads;
    }

    /* --- Ad Card HTML --- */
    function renderAdCard(ad, opts = {}) {
        const compact = opts.compact ? ' tas-ad-compact' : '';
        const bannerSrc = ad.imageUrl || '';
        const title = ad.title || 'Sponsored';
        const link = ad.targetLink || '#';
        const label = ad.label || 'Sponsored';

        const bannerHTML = bannerSrc
            ? `<img class="tas-ad-banner" src="${bannerSrc}" alt="${title}" loading="lazy" onerror="this.outerHTML='<div class=\\'tas-ad-banner-placeholder\\'><i class=\\'fas fa-ad\\'></i></div>'">`
            : `<div class="tas-ad-banner-placeholder"><i class="fas fa-ad"></i></div>`;

        return `
        <div class="tas-ad-card${compact}" data-ad-id="${ad.id}">
            <a class="tas-ad-link" href="${link}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">
                ${bannerHTML}
                <div class="tas-ad-info">
                    <div class="tas-ad-info-left">
                        <span class="tas-ad-label"><i class="fas fa-bullhorn"></i> ${label}</span>
                        ${title ? `<span class="tas-ad-title">${title}</span>` : ''}
                    </div>
                    <span class="tas-ad-cta">Learn More <i class="fas fa-chevron-right" style="font-size:0.55rem;"></i></span>
                </div>
            </a>
        </div>`;
    }

    /* --- Slot Rendering --- */
    function renderSlot(slotId, location, opts = {}) {
        if (_renderedSlots.has(slotId)) return;
        const slot = document.getElementById(slotId);
        if (!slot) return;
        if (!shouldShowAds()) {
            slot.innerHTML = '';
            slot.style.display = 'none';
            return;
        }
        const ads = getActiveAds(location);
        if (!ads.length) {
            slot.innerHTML = '';
            slot.style.display = 'none';
            return;
        }
        const ad = ads[0];
        slot.style.display = '';
        slot.innerHTML = renderAdCard(ad, opts);
        slot.classList.add('tas-ad-visible');
        _renderedSlots.add(slotId);
        trackImpression(ad);
    }

    function renderMultipleSlots(containerId, location, maxAds = 2) {
        if (_renderedSlots.has(containerId)) return;
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!shouldShowAds()) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        const ads = getActiveAds(location).slice(0, maxAds);
        if (!ads.length) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        container.style.display = '';
        container.innerHTML = ads.map((ad, i) => {
            return `<div class="tas-ad-slot tas-ad-inline" id="${containerId}_ad${i}" style="opacity:0;transform:translateY(12px);transition:opacity 0.5s ease ${i * 0.15}s,transform 0.5s ease ${i * 0.15}s;"></div>`;
        }).join('');
        _renderedSlots.add(containerId);
        requestAnimationFrame(() => {
            ads.forEach((ad, i) => {
                const el = document.getElementById(`${containerId}_ad${i}`);
                if (el) {
                    el.innerHTML = renderAdCard(ad, { compact: true });
                    el.classList.add('tas-ad-visible');
                    trackImpression(ad);
                }
            });
        });
    }

    /* --- Sticky Bottom Ad --- */
    function renderStickyBottom() {
        if (_stickyDismissed) return;
        if (!shouldShowAds()) return;
        const ads = getActiveAds('sticky');
        if (!ads.length) return;
        const ad = ads[0];
        let container = document.getElementById('tasAdSticky');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tasAdSticky';
            container.className = 'tas-ad-sticky-bottom';
            container.innerHTML = `
                <button class="tas-ad-sticky-close" onclick="AdsDisplay.dismissSticky()" title="Close"><i class="fas fa-times"></i></button>
                <div id="tasAdStickyContent"></div>`;
            document.body.appendChild(container);
        }
        const content = document.getElementById('tasAdStickyContent');
        if (content) {
            content.innerHTML = renderAdCard(ad, { compact: true });
        }
        setTimeout(() => {
            container.classList.add('tas-ad-sticky-visible');
        }, 2000);
        trackImpression(ad);
    }

    function dismissSticky() {
        _stickyDismissed = true;
        const el = document.getElementById('tasAdSticky');
        if (el) {
            el.classList.remove('tas-ad-sticky-visible');
            setTimeout(() => el.remove(), 500);
        }
    }

    /* --- Analytics (lightweight) --- */
    function trackImpression(ad) {
        try {
            const impressions = JSON.parse(localStorage.getItem('tas_ad_impressions') || '{}');
            impressions[ad.id] = (impressions[ad.id] || 0) + 1;
            localStorage.setItem('tas_ad_impressions', JSON.stringify(impressions));
        } catch (e) {}
    }

    function trackClick(ad) {
        try {
            const clicks = JSON.parse(localStorage.getItem('tas_ad_clicks') || '{}');
            clicks[ad.id] = (clicks[ad.id] || 0) + 1;
            localStorage.setItem('tas_ad_clicks', JSON.stringify(clicks));
        } catch (e) {}
    }

    /* --- Init / Refresh --- */
    function init() {
        if (_initialized) return;
        _initialized = true;
        refreshAll();
    }

    function refreshAll() {
        _renderedSlots.clear();
        document.querySelectorAll('.tas-ad-slot').forEach(slot => {
            const loc = slot.dataset.adLocation;
            const id = slot.id;
            if (id && loc) renderSlot(id, loc);
        });
        renderStickyBottom();
    }

    function refresh() {
        _renderedSlots.clear();
        refreshAll();
    }

    /* --- Public API --- */
    return {
        init,
        refresh,
        renderSlot,
        renderMultipleSlots,
        renderStickyBottom,
        dismissSticky,
        shouldShowAds,
        getUserType,
        getActiveAds,
        trackClick,
        AD_LOCATIONS
    };
})();

/* Auto-init when DOM is ready */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AdsDisplay.init());
} else {
    AdsDisplay.init();
}
