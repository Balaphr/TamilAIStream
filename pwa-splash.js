/* ================================================================
   Tamil AI Stream – PWA Splash Screen
   Single 3D animated logo, 2 seconds, no sound, no text
   ================================================================ */
(function() {
  'use strict';

  var SPLASH_KEY = 'tamilai_splash_seen';
  var SPLASH_DURATION = 2000;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function shouldShowSplash() {
    if (!isStandalone()) return false;
    if (sessionStorage.getItem(SPLASH_KEY)) return false;
    return true;
  }

  function getLogoSrc() {
    try {
      if (typeof BrandConfig !== 'undefined' && BrandConfig.getLogo) {
        return BrandConfig.getLogo();
      }
    } catch(e) {}
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none'%3E%3Ccircle cx='20' cy='20' r='18' fill='url(%23g)'/%3E%3Cpath d='M14 28V14l14 7-14 7z' fill='%23fff' opacity='.9'/%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='40' y2='40'%3E%3Cstop stop-color='%2322d3ee'/%3E%3Cstop offset='.5' stop-color='%233b82f6'/%3E%3Cstop offset='1' stop-color='%23a855f7'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E";
  }

  function createSplash() {
    var logo = getLogoSrc();
    var el = document.createElement('div');
    el.id = 'pwaSplash';
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,#0d1b2a 0%,#060e1a 60%,#020810 100%);opacity:1;transition:opacity 0.4s ease-out,transform 0.4s ease-out;will-change:opacity,transform;';

    el.innerHTML =
      '<div style="width:100px;height:100px;display:flex;align-items:center;justify-content:center;border-radius:24px;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);box-shadow:0 8px 40px rgba(99,102,241,0.25),0 0 80px rgba(99,102,241,0.1),inset 0 1px 0 rgba(255,255,255,0.08);animation:pwaLogo3d 3s ease-in-out infinite;transform-style:preserve-3d;opacity:0;animation:pwaLogoFadeIn 0.5s ease-out forwards,pwaLogo3d 3s ease-in-out infinite;">' +
        '<img src="' + logo + '" alt="Tamil AI Stream" style="width:80px;height:80px;object-fit:contain;border-radius:50%;pointer-events:none;">' +
      '</div>' +
      '<div style="position:absolute;width:150px;height:150px;border:1.5px solid rgba(34,211,238,0.1);border-radius:50%;animation:pwaRingPulse 4s ease-in-out infinite;pointer-events:none;"></div>' +
      '<style>' +
      '@keyframes pwaLogo3d{0%{transform:translateY(0) rotateY(0deg) rotateX(0deg) scale(1)}12%{transform:translateY(-6px) rotateY(10deg) rotateX(4deg) scale(1.04)}25%{transform:translateY(-10px) rotateY(-8deg) rotateX(-3deg) scale(1.06)}37%{transform:translateY(-14px) rotateY(12deg) rotateX(5deg) scale(1.08)}50%{transform:translateY(-16px) rotateY(0deg) rotateX(0deg) scale(1.1)}62%{transform:translateY(-12px) rotateY(-12deg) rotateX(4deg) scale(1.07)}75%{transform:translateY(-8px) rotateY(8deg) rotateX(-3deg) scale(1.04)}87%{transform:translateY(-4px) rotateY(-5deg) rotateX(2deg) scale(1.02)}100%{transform:translateY(0) rotateY(0deg) rotateX(0deg) scale(1)}}' +
      '@keyframes pwaLogoFadeIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}' +
      '@keyframes pwaRingPulse{0%,100%{transform:scale(1);opacity:0.15;border-color:rgba(34,211,238,0.1)}50%{transform:scale(1.35);opacity:0.4;border-color:rgba(168,85,247,0.15)}}' +
      '</style>';

    document.body.appendChild(el);
    return el;
  }

  function hideSplash(el) {
    el.style.opacity = '0';
    el.style.transform = 'scale(1.05)';
    setTimeout(function() {
      el.remove();
      sessionStorage.setItem(SPLASH_KEY, '1');
    }, 450);
  }

  function initSplash() {
    if (!shouldShowSplash()) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
    function run() {
      var el = createSplash();
      setTimeout(function() { hideSplash(el); }, SPLASH_DURATION);
    }
  }

  initSplash();

  window.PWASplash = {
    show: initSplash,
    hide: function() {
      var el = document.getElementById('pwaSplash');
      if (el) hideSplash(el);
    }
  };
})(window);
