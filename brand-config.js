/* ------------------------------------------------------------------
 * brand-config.js — Centralized premium AI brand identity + 3D Logo.
 *
 * SINGLE SOURCE OF TRUTH for the site brand:
 *   name  : "Tamil AI Stream"
 *   tagline: "AI-Powered Tamil Radio"
 *   logo  : configured in Builder → Home Control → Global 3D Logo,
 *           stored in tamilAIStream_logoSettings and synced via R2.
 *           Every page, PWA, favicon and splash read from here.
 *
 * Animation is paused when the document is hidden (tab switch,
 * app backgrounded) to save GPU/CPU/battery.  CSS-only 3D
 * transforms are used — no JS timers, no WebGL, no Canvas.
 * ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var BRAND = {
    name: 'Tamil AI Stream',
    shortName: 'Tamil AI Stream',
    tagline: 'AI-Powered Tamil Radio',
    defaultLogo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none'%3E%3Ccircle cx='20' cy='20' r='18' fill='url(%23g)'/%3E%3Cpath d='M14 28V14l14 7-14 7z' fill='%23fff' opacity='.9'/%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='40' y2='40'%3E%3Cstop stop-color='%2322d3ee'/%3E%3Cstop offset='.5' stop-color='%233b82f6'/%3E%3Cstop offset='1' stop-color='%23a855f7'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E"
  };

  var DEFAULT_LOGO_SETTINGS = {
    logo: '',
    logoWidth: 40,
    animation3d: false,
    animationStyle: 'float',
    animationSpeed: 3,
    animationDuration: 0,
    sizeDesktop: 40,
    sizeTablet: 36,
    sizeMobile: 32,
    position: 'left',
    headerPlacement: 'topnav',
    showSplash: true,
    showPwa: true,
    showFavicon: true,
    logoText: '',
    logoTextSize: 14,
    logoSpacing: 8
  };

  /* ---- Visibility-aware animation pause ---- */
  var _animationPaused = false;

  function _setAnimationState(paused) {
    if (paused === _animationPaused) return;
    _animationPaused = paused;
    var root = document.documentElement;
    if (paused) {
      root.classList.add('brand-anim-paused');
    } else {
      root.classList.remove('brand-anim-paused');
    }
  }

  function _initVisibilityListener() {
    if (!global.document) return;
    document.addEventListener('visibilitychange', function () {
      _setAnimationState(document.hidden);
    });
    if (global.addEventListener) {
      global.addEventListener('pageshow', function () { _setAnimationState(false); });
      global.addEventListener('pagehide', function () { _setAnimationState(true); });
    }
    /* Also honour prefers-reduced-motion */
    if (global.matchMedia) {
      var mq = global.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.matches) _setAnimationState(true);
      if (mq.addEventListener) {
        mq.addEventListener('change', function (e) { _setAnimationState(e.matches); });
      }
    }
  }

  /* ---- Settings readers ---- */

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

  function readLogoSettings() {
    try {
      if (typeof global.DataStore !== 'undefined' && global.DataStore && typeof global.DataStore.getLogoSettings === 'function') {
        var s = global.DataStore.getLogoSettings();
        if (s && Object.keys(s).length > 0) return Object.assign({}, DEFAULT_LOGO_SETTINGS, s);
      }
    } catch (e) { /* ignore */ }
    try {
      var raw = JSON.parse(localStorage.getItem('tamilAIStream_logoSettings') || '{}');
      if (raw && Object.keys(raw).length > 0) return Object.assign({}, DEFAULT_LOGO_SETTINGS, raw);
    } catch (e) { /* ignore */ }
    return Object.assign({}, DEFAULT_LOGO_SETTINGS);
  }

  function getLogo() {
    var ls = readLogoSettings();
    if (ls.logo) return ls.logo;
    var s = readSettings();
    return (s && s.logo) || BRAND.defaultLogo;
  }

  function getLogoSettings() {
    return readLogoSettings();
  }

  function getFavicon() {
    var s = readSettings();
    return (s && s.favicon) || getLogo();
  }

  function getThemeColor() {
    var s = readSettings();
    return (s && s.themeColor) || '#000000';
  }

  /* ---- Apply brand to DOM ---- */

  function apply() {
    try {
      var logo = getLogo();
      var ls = readLogoSettings();
      var name = ls.logoText || BRAND.name;
      var tagline = BRAND.tagline;

      var root = document.documentElement;

      /* Responsive logo sizing */
      root.style.setProperty('--brand-logo-size-desktop', ls.sizeDesktop + 'px');
      root.style.setProperty('--brand-logo-size-tablet', ls.sizeTablet + 'px');
      root.style.setProperty('--brand-logo-size-mobile', ls.sizeMobile + 'px');

      /* Animation speed / duration */
      var speedVar = ls.animationSpeed || 3;
      root.style.setProperty('--logo-anim-speed', speedVar + 's');
      if (ls.animationDuration && ls.animationDuration > 0) {
        root.style.setProperty('--logo-anim-duration', ls.animationDuration + 's');
        root.style.setProperty('--logo-anim-iterations', Math.ceil(ls.animationDuration / speedVar));
      } else {
        root.style.setProperty('--logo-anim-duration', '0s');
        root.style.setProperty('--logo-anim-iterations', 'infinite');
      }

      /* Logo-text spacing */
      root.style.setProperty('--brand-logo-text-spacing', (ls.logoSpacing != null ? ls.logoSpacing : 8) + 'px');
      root.style.setProperty('--brand-logo-text-size', (ls.logoTextSize || 14) + 'px');

      /* Animation class */
      var animClass = ls.animation3d ? ('logo-3d-' + (ls.animationStyle || 'float')) : '';

      /* Brand text elements */
      document.querySelectorAll('[data-brand-text]').forEach(function (el) {
        el.textContent = name;
      });
      document.querySelectorAll('[data-brand-tagline]').forEach(function (el) {
        el.textContent = tagline;
      });

      /* Logo elements — single unified component */
      document.querySelectorAll('[data-brand-logo]').forEach(function (el) {
        if (logo) {
          el.innerHTML = '';
          var img = document.createElement('img');
          img.src = logo;
          img.alt = name;
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:50%;';
          img.loading = 'lazy';
          el.appendChild(img);

          /* Remove all animation classes then apply configured one */
          el.classList.remove('logo-3d-float', 'logo-3d-rotate', 'logo-3d-pulse', 'logo-3d-glow', 'logo-3d-tilt', 'logo-3d-breathe');
          if (animClass) {
            el.classList.add(animClass);
          }
        }
      });

      /* Also apply to the unified brand-logo-component wrappers */
      document.querySelectorAll('[data-brand-logo-component]').forEach(function (wrap) {
        var logoEl = wrap.querySelector('[data-brand-logo]');
        var textEl = wrap.querySelector('[data-brand-text]');
        if (logoEl && logo) {
          logoEl.innerHTML = '';
          var img2 = document.createElement('img');
          img2.src = logo;
          img2.alt = name;
          img2.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:50%;';
          img2.loading = 'lazy';
          logoEl.appendChild(img2);
          logoEl.classList.remove('logo-3d-float', 'logo-3d-rotate', 'logo-3d-pulse', 'logo-3d-glow', 'logo-3d-tilt', 'logo-3d-breathe');
          if (animClass) logoEl.classList.add(animClass);
        }
        if (textEl) textEl.textContent = name;
        wrap.style.setProperty('--brand-logo-text-size', (ls.logoTextSize || 14) + 'px');
        wrap.style.gap = (ls.logoSpacing != null ? ls.logoSpacing : 8) + 'px';
      });

      /* Favicon / apple-touch-icon */
      if (ls.showFavicon !== false && logo) {
        var favicon = document.querySelector('link[rel="icon"]');
        if (favicon && favicon.getAttribute('href')) favicon.setAttribute('href', logo);
        var apple = document.querySelector('link[rel="apple-touch-icon"]');
        if (apple && apple.getAttribute('href')) apple.setAttribute('href', logo);
      }
      var appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle) appleTitle.setAttribute('content', BRAND.shortName);
      var themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', getThemeColor());

      /* Dynamic PWA icons */
      if (ls.showPwa !== false) {
        generateDynamicIcons(logo);
      }
    } catch (e) { /* ignore */ }
  }

  /* ---- Generate PWA icons from SVG via Canvas API ---- */

  function generateDynamicIcons(logoUrl) {
    if (!logoUrl || !logoUrl.startsWith('data:image/svg')) return;
    try {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        var sizes = [192, 512];
        var blobs = {};
        var loaded = 0;

        sizes.forEach(function (size) {
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
            canvas.toBlob(function (blob) {
              if (blob) {
                blobs[size] = URL.createObjectURL(blob);
                loaded++;
                if (loaded === sizes.length) applyIconURLs(blobs);
              }
            }, 'image/png');
          } catch (e) { loaded++; }
        });

        /* Small favicon (48px) */
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
          favCanvas.toBlob(function (blob) {
            if (blob) {
              blobs['favicon'] = URL.createObjectURL(blob);
              if (loaded === sizes.length) applyIconURLs(blobs);
            }
          }, 'image/png');
        } catch (e) {}

        function applyIconURLs(urls) {
          var favicon = document.querySelector('link[rel="icon"]');
          if (favicon && urls.favicon) favicon.href = urls.favicon;
          else if (favicon && urls[48]) favicon.href = urls[48];

          var appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
          if (appleIcon && urls[192]) appleIcon.href = urls[192];

          document.querySelectorAll('link[rel="icon"][data-dynamic]').forEach(function (link) {
            if (urls[192]) link.href = urls[192];
          });
        }
      };
      img.src = logoUrl;
    } catch (e) { /* ignore */ }
  }

  global.BrandConfig = { BRAND: BRAND, readSettings: readSettings, getLogo: getLogo, getLogoSettings: getLogoSettings, getFavicon: getFavicon, getThemeColor: getThemeColor, apply: apply };

  _initVisibilityListener();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})(window);
