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

      // Generate dynamic PWA icons from canvas if SVG logo is available
      generateDynamicIcons(logo);
    } catch (e) { /* ignore */ }
  }

  // Generate PWA icons dynamically from the brand SVG logo using Canvas API
  function generateDynamicIcons(logoUrl) {
    if (!logoUrl || !logoUrl.startsWith('data:image/svg')) return;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        var sizes = [192, 512];
        var blobs = {};
        var loaded = 0;

        sizes.forEach(function(size) {
          try {
            var canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');
            var radius = size * 0.195;
            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(size - radius, 0);
            ctx.quadraticCurveTo(size, 0, size, radius);
            ctx.lineTo(size, size - radius);
            ctx.quadraticCurveTo(size, size, size - radius, size);
            ctx.lineTo(radius, size);
            ctx.quadraticCurveTo(0, size, 0, size - radius);
            ctx.lineTo(0, radius);
            ctx.quadraticCurveTo(0, 0, radius, 0);
            ctx.closePath();
            ctx.fillStyle = '#060e1a';
            ctx.fill();
            var padding = size * 0.15;
            ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);
            canvas.toBlob(function(blob) {
              if (blob) {
                blobs[size] = URL.createObjectURL(blob);
                loaded++;
                if (loaded === sizes.length) applyIconURLs(blobs);
              }
            }, 'image/png');
          } catch (e) { loaded++; }
        });

        // Also generate a small favicon (48px) from the SVG
        try {
          var favCanvas = document.createElement('canvas');
          favCanvas.width = 48;
          favCanvas.height = 48;
          var favCtx = favCanvas.getContext('2d');
          var fr = 48 * 0.195;
          favCtx.beginPath();
          favCtx.moveTo(fr, 0);
          favCtx.lineTo(48 - fr, 0);
          favCtx.quadraticCurveTo(48, 0, 48, fr);
          favCtx.lineTo(48, 48 - fr);
          favCtx.quadraticCurveTo(48, 48, 48 - fr, 48);
          favCtx.lineTo(fr, 48);
          favCtx.quadraticCurveTo(0, 48, 0, 48 - fr);
          favCtx.lineTo(0, fr);
          favCtx.quadraticCurveTo(0, 0, fr, 0);
          favCtx.closePath();
          favCtx.fillStyle = '#060e1a';
          favCtx.fill();
          var fp = 48 * 0.15;
          favCtx.drawImage(img, fp, fp, 48 - fp * 2, 48 - fp * 2);
          favCanvas.toBlob(function(blob) {
            if (blob) {
              blobs['favicon'] = URL.createObjectURL(blob);
              if (loaded === sizes.length) applyIconURLs(blobs);
            }
          }, 'image/png');
        } catch (e) {}

        function applyIconURLs(urls) {
          // Update favicon
          var favicon = document.querySelector('link[rel="icon"]');
          if (favicon && urls.favicon) favicon.href = urls.favicon;
          else if (favicon && urls[48]) favicon.href = urls[48];

          // Update apple-touch-icon
          var appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
          if (appleIcon && urls[192]) appleIcon.href = urls[192];

          // Update any dynamic icon references
          document.querySelectorAll('link[rel="icon"][data-dynamic]').forEach(function(link) {
            if (urls[192]) link.href = urls[192];
          });

          // Generate a dynamic manifest with the blob URLs
          try {
            var brandName = (typeof BRAND !== 'undefined' && BRAND.name) ? BRAND.name : 'Tamil AI Stream';
            var brandShort = (typeof BRAND !== 'undefined' && BRAND.shortName) ? BRAND.shortName : brandName;
            var manifest = {
              name: brandName,
              short_name: brandShort,
              description: 'AI-Powered Tamil Radio',
              start_url: '/',
              display: 'standalone',
              background_color: '#060e1a',
              theme_color: '#060e1a',
              orientation: 'any',
              icons: [
                { src: urls[192] || '', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
                { src: urls[512] || '', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
              ]
            };
            var manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
            var manifestURL = URL.createObjectURL(manifestBlob);
            var manifestLink = document.querySelector('link[rel="manifest"]');
            if (manifestLink) manifestLink.href = manifestURL;
          } catch (e) { /* ignore */ }
        }
      };
      img.src = logoUrl;
    } catch (e) { /* ignore */ }
  }

  global.BrandConfig = { BRAND, readSettings, getLogo, getFavicon, getThemeColor, apply };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})(window);