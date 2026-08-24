/* ------------------------------------------------------------------
 * brand-config.js — Centralized premium AI brand identity.
 *
 * SINGLE SOURCE OF TRUTH for the site brand:
 *   name  : "Tamil AI Stream"
 *   tagline: "AI-Powered Tamil Radio"
 *   logo  : configured in the Builder (Site Settings -> Brand Logo),
 *           stored in siteSettings.logo and synced to the live site
 *           (R2 content-manifest.json). Every page, the PWA, favicon
 *           and splash read from here — no hardcoded duplicate logos.
 * ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  const BRAND = {
    name: 'Tamil AI Stream',
    shortName: 'Tamil AI Stream',
    tagline: 'AI-Powered Tamil Radio',
    defaultLogo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none'%3E%3Ccircle cx='20' cy='20' r='18' fill='url(%23g)'/%3E%3Cpath d='M14 28V14l14 7-14 7z' fill='%23fff' opacity='.9'/%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='40' y2='40'%3E%3Cstop stop-color='%2322d3ee'/%3E%3Cstop offset='.5' stop-color='%233b82f6'/%3E%3Cstop offset='1' stop-color='%23a855f7'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E"
  };

  function readSettings() {
    try {
      if (typeof global.DataStore !== 'undefined' && global.DataStore && typeof global.DataStore.getSiteSettings === 'function') {
        return global.DataStore.getSiteSettings() || {};
      }
    } catch (e) { /* ignore */ }
    try {
      return JSON.parse(localStorage.getItem('tamilAIStream_siteSettings') || '{}') || {};
    } catch (e) { return {}; }
  }

  // The centralized logo is a single asset (image URL) configured in the
  // Builder. When unset we fall back to the default brand SVG data URI.
  function getLogo() {
    const s = readSettings();
    return (s && s.logo) || BRAND.defaultLogo;
  }

  function getFavicon() {
    const s = readSettings();
    return (s && s.favicon) || getLogo();
  }

  function getThemeColor() {
    const s = readSettings();
    return (s && s.themeColor) || '#000000';
  }

  // Apply the centralized brand + logo to the current document.
  // Elements opt in via [data-brand-text], [data-brand-logo],
  // [data-brand-tagline] attributes.
  function apply() {
    try {
      const logo = getLogo();
      const name = BRAND.name;
      const tagline = BRAND.tagline;

      if (document.title === '' || document.title.indexOf('Tamil') === -1 || document.title === 'TamilAI.Stream') {
        // Leave pages with custom titles alone unless they match the old brand.
      }

      document.querySelectorAll('[data-brand-text]').forEach((el) => {
        el.textContent = name;
      });
      document.querySelectorAll('[data-brand-tagline]').forEach((el) => {
        el.textContent = tagline;
      });
      document.querySelectorAll('[data-brand-logo]').forEach((el) => {
        if (logo) {
          el.innerHTML = '';
          const img = document.createElement('img');
          img.src = logo;
          img.alt = name;
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:50%;';
          img.loading = 'lazy';
          el.appendChild(img);
          // Update PWA manifest icons to use the brand logo
          try {
            const manifestLink = document.querySelector('link[rel="manifest"]');
            if (manifestLink) {
              fetch(manifestLink.href).then(r => r.json()).then(manifest => {
                if (manifest.icons) {
                  manifest.icons.forEach(icon => { icon.src = logo; });
                  // Note: manifest is only updatable via server-side for installed PWAs
                }
              }).catch(() => {});
            }
          } catch (e) {}
        }
      });

      // Favicon / apple-touch-icon follow the centralized logo.
      if (logo) {
        const favicon = document.querySelector('link[rel="icon"]');
        if (favicon && favicon.getAttribute('href')) favicon.setAttribute('href', logo);
        const apple = document.querySelector('link[rel="apple-touch-icon"]');
        if (apple && apple.getAttribute('href')) apple.setAttribute('href', logo);
      }
      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle) appleTitle.setAttribute('content', BRAND.shortName);
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', getThemeColor());
    } catch (e) { /* ignore */ }
  }

  global.BrandConfig = { BRAND, readSettings, getLogo, getFavicon, getThemeColor, apply };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})(window);