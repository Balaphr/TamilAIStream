/* ================================================================
   Tamil AI Stream – PWA Registration & Update Detection
   
   Responsibilities:
     1. Register the Service Worker at /sw.js.
     2. Detect when a new SW is available (code deploy) and show the
        "New Update Available" banner with an "Update Now" button.
     3. Poll /api/version to detect Builder content publishes and
        show the same banner when content has changed.
     4. Listen for BroadcastChannel messages from the Builder to get
        instant notification of a content publish.
     5. On "Update Now":
        a. Save PlayerEngine state (audio position, track, queue…)
           so playback resumes after reload.
        b. Post SKIP_WAITING to the waiting SW.
        c. Reload the page on controllerchange (with a safety timeout).
   ================================================================ */
(function () {
  'use strict';

  /* ---------- constants ---------- */
  var VERSION_KEY    = 'tamilai_pwa_last_content_version';
  var POLL_INTERVAL  = 600000;   // 10 minutes (increased from 5 min for performance)

  /* ---------- state ---------- */
  var registration    = null;
  var bannerEl        = null;
  var waitingWorker   = null;
  var contentVersion  = localStorage.getItem(VERSION_KEY) || '';
  var pollTimer       = null;

  var SUPPORTED = 'serviceWorker' in navigator &&
    (window.isSecureContext || location.protocol === 'https:');

  /* ============================================================
     Initialise
     ============================================================ */
  function init() {
    if (!SUPPORTED) return;
    registerSW();
    startPolling();
    listenBroadcastChannel();
    handlePWAResume();
  }

  /* ============================================================
     PWA Resume — instant recovery after minimize
     ============================================================ */
  function handlePWAResume() {
    // When PWA resumes from background, avoid heavy work.
    // The page is already in memory — just sync state.
    window.addEventListener('pageshow', function(e) {
      // If persisted from bfcache, the page is already fully loaded.
      if (e.persisted) {
        // Skip all re-init, just sync audio state
        try {
          if (window.PlayerEngine && typeof PlayerEngine.syncState === 'function') {
            PlayerEngine.syncState();
          }
        } catch (_) { /* ok */ }
        return;
      }
    });

    // On visibility change back to visible, do minimal sync
    var _lastHidden = 0;
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        var now = Date.now();
        var hiddenDuration = _lastHidden ? (now - _lastHidden) : 0;
        // If hidden for less than 5 minutes, just sync audio — don't re-render
        if (hiddenDuration < 300000) {
          try {
            if (window.PlayerEngine && typeof PlayerEngine.syncState === 'function') {
              PlayerEngine.syncState();
            }
          } catch (_) { /* ok */ }
          return;
        }
        // If hidden for longer, do a light refresh
        if (registration) {
          try { registration.update(); } catch (_) {}
        }
      } else {
        _lastHidden = Date.now();
      }
    });
  }

  /* ============================================================
     Service Worker Registration
     ============================================================ */
  function registerSW() {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(function (reg) {
        registration = reg;
        reg.addEventListener('updatefound', onUpdateFound);
        if (reg.waiting) waitingWorker = reg.waiting;
      })
      .catch(function (err) {
        console.warn('[PWA] registration failed', err);
      });

    // Auto-reload when a new SW takes control after SKIP_WAITING
    var _reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (_reloading) return;
      _reloading = true;
      // Small delay to let the new SW finish activation
      setTimeout(function () { window.location.reload(); }, 200);
    });
  }

  /* ============================================================
     Update Detection  (code deploy path)
     ============================================================ */
  function onUpdateFound() {
    if (!registration) return;
    var worker = registration.installing;
    if (!worker) return;

    worker.addEventListener('statechange', function () {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        waitingWorker = worker;
        showBanner('New Version Available');
      }
    });
  }

  /* ============================================================
     Content-Version Polling  (Builder publish path)
     ============================================================ */
  function startPolling() {
    pollTimer = setInterval(() => {
      if (!document.hidden) pollVersion();
    }, POLL_INTERVAL);

    document.addEventListener('visibilitychange', () => {
      // Only check SW update when tab becomes visible (don't poll on every visibility change)
    });
  }

  async function pollVersion() {
    try {
      var resp = await fetch('/api/version', { cache: 'default' });
      if (!resp.ok) return;
      var data = await resp.json();

      if (data.contentVersion && data.contentVersion !== contentVersion) {
        contentVersion = data.contentVersion;
        localStorage.setItem(VERSION_KEY, contentVersion);
        showBanner('New Content Published');
      }
    } catch (_) { /* offline / endpoint missing */ }
  }



  /* ============================================================
     BroadcastChannel  (instant Builder notification)
     ============================================================ */
  function listenBroadcastChannel() {
    try {
      var bc = new BroadcastChannel('tamilAIStream_sync');
      bc.addEventListener('message', function (e) {
        var t = e.data && e.data.type;
        if (t === 'content-updated' || t === 'publish' || t === 'version-published') {
          pollVersion();
        }
      });
    } catch (_) { /* BroadcastChannel not supported */ }
  }

  /* ============================================================
     Banner UI
     ============================================================ */
  function showBanner(message) {
    if (bannerEl) return; // already visible

    bannerEl = document.createElement('div');
    bannerEl.id = 'pwa-update-banner';
    bannerEl.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;' +
      'background:linear-gradient(135deg,#10b981,#059669);color:#fff;' +
      'padding:16px 28px;border-radius:16px;display:flex;align-items:center;gap:14px;' +
      'box-shadow:0 8px 32px rgba(16,185,129,.4);font-family:Inter,system-ui,sans-serif;' +
      'font-size:14px;font-weight:600;max-width:90vw;' +
      'animation:pwaSlideUp .4s ease';

    bannerEl.innerHTML =
      '<i class="fas fa-sync-alt" style="font-size:18px;animation:pwaSpin 1.5s linear infinite"></i>' +
      '<span>' + (message || 'New Update Available') + '</span>' +
      '<button id="pwa-update-btn" style="background:#fff;color:#059669;border:none;padding:8px 18px;' +
        'border-radius:10px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap">' +
        'Update Now</button>' +
      '<button id="pwa-dismiss-btn" style="background:transparent;border:none;color:rgba(255,255,255,.7);' +
        'cursor:pointer;font-size:18px;padding:0 0 0 4px;line-height:1" title="Dismiss">&times;</button>';

    document.body.appendChild(bannerEl);

    injectStyles();
    document.getElementById('pwa-update-btn').addEventListener('click', applyUpdate);
    document.getElementById('pwa-dismiss-btn').addEventListener('click', dismissBanner);
  }

  function dismissBanner() {
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
  }

  function injectStyles() {
    if (document.getElementById('pwa-anim-styles')) return;
    var s = document.createElement('style');
    s.id = 'pwa-anim-styles';
    s.textContent =
      '@keyframes pwaSlideUp{from{transform:translateX(-50%) translateY(80px);opacity:0}' +
      'to{transform:translateX(-50%) translateY(0);opacity:1}}' +
      '@keyframes pwaSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }

  /* ============================================================
     Apply Update
     ============================================================ */
  function applyUpdate() {
    // 1. Persist current playback so it survives the reload.
    try {
      if (window.PlayerEngine && typeof PlayerEngine.saveState === 'function') {
        PlayerEngine.saveState();
      }
    } catch (_) { /* ok */ }

    // 2. Tell the waiting SW to take over.
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // 3. controllerchange listener (registered above) will auto-reload the page.
  }

  /* ============================================================
     PWA Install Prompt — Premium Mobile Banner
     ============================================================ */
  var DISMISS_KEY = 'tamilai_pwa_install_dismissed';
  var INSTALLED_KEY = 'tamilai_pwa_installed';
  var _deferredPrompt = null;
  var _bannerShown = false;

  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 0 && window.innerWidth <= 768);
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function isDismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (_) { return false; }
  }

  function isAlreadyInstalled() {
    try { return localStorage.getItem(INSTALLED_KEY) === '1'; } catch (_) { return false; }
  }

  function markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
  }

  function markInstalled() {
    try {
      localStorage.setItem(INSTALLED_KEY, '1');
      localStorage.removeItem(DISMISS_KEY);
    } catch (_) {}
  }

  function getLogoSVG() {
    return '<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="20" cy="20" r="18" fill="url(#pwaInstallGrad)"/>' +
      '<path d="M14 28V14l14 7-14 7z" fill="#fff" opacity=".9"/>' +
      '<defs><linearGradient id="pwaInstallGrad" x1="0" y1="0" x2="40" y2="40">' +
      '<stop stop-color="#22d3ee"/><stop offset="0.5" stop-color="#3b82f6"/>' +
      '<stop offset="1" stop-color="#a855f7"/></linearGradient></defs></svg>';
  }

  function createInstallBanner() {
    if (_bannerShown || !isMobile() || isStandalone() || isDismissed() || isAlreadyInstalled()) return;
    _bannerShown = true;

    var banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-label', 'Install Tamil AI Stream App');

    banner.innerHTML =
      '<div class="pwa-install-logo">' + getLogoSVG() + '</div>' +
      '<div class="pwa-install-text">' +
        '<div class="pwa-install-title">Install Tamil AI Stream</div>' +
        '<div class="pwa-install-subtitle">AI-Powered Tamil Radio — Free App</div>' +
      '</div>' +
      '<button class="pwa-install-btn" aria-label="Install App">' +
        '<i class="fas fa-arrow-down"></i>Install' +
      '</button>' +
      '<button class="pwa-install-dismiss" aria-label="Dismiss">' +
        '<i class="fas fa-xmark"></i>' +
      '</button>';

    document.body.appendChild(banner);
    document.body.classList.add('pwa-install-visible');

    var installBtn = banner.querySelector('.pwa-install-btn');
    var dismissBtn = banner.querySelector('.pwa-install-dismiss');

    installBtn.addEventListener('click', function() {
      if (!_deferredPrompt) {
        showInstallInstructions();
        return;
      }
      _deferredPrompt.prompt();
      _deferredPrompt.userChoice.then(function(choice) {
        if (choice.outcome === 'accepted') {
          markInstalled();
          hideBanner(banner);
        }
        _deferredPrompt = null;
      });
    });

    dismissBtn.addEventListener('click', function() {
      markDismissed();
      hideBanner(banner);
    });
  }

  function hideBanner(banner) {
    if (!banner) return;
    banner.classList.add('pwa-exiting');
    banner.addEventListener('animationend', function() {
      banner.remove();
      document.body.classList.remove('pwa-install-visible');
    }, { once: true });
    setTimeout(function() {
      if (banner.parentNode) {
        banner.remove();
        document.body.classList.remove('pwa-install-visible');
      }
    }, 500);
  }

  function showInstallInstructions() {
    var ua = navigator.userAgent.toLowerCase();
    var isIOS = /iphone|ipad|ipod/.test(ua);
    var isAndroid = /android/.test(ua);
    var instructions = '';

    if (isIOS) {
      instructions = 'Tap the Share button, then "Add to Home Screen".';
    } else if (isAndroid) {
      instructions = 'Tap the menu (3 dots), then "Add to Home Screen" or "Install App".';
    } else {
      instructions = 'Use your browser\'s "Install App" or "Add to Home Screen" option.';
    }

    var toast = document.createElement('div');
    toast.style.cssText =
      'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:99999;' +
      'background:rgba(15,20,30,0.95);backdrop-filter:blur(20px);color:#fff;' +
      'padding:14px 22px;border-radius:14px;font-size:13px;font-weight:500;' +
      'font-family:Inter,system-ui,sans-serif;max-width:85vw;text-align:center;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);' +
      'animation:pwaBannerSlideDown 0.4s cubic-bezier(0.16,1,0.3,1);';
    toast.textContent = instructions;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.animation = 'pwaBannerSlideUp 0.3s ease forwards';
      setTimeout(function() { toast.remove(); }, 400);
    }, 4000);
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _deferredPrompt = e;
    if (isMobile() && !isStandalone() && !isDismissed() && !isAlreadyInstalled()) {
      setTimeout(createInstallBanner, 2500);
    }
  });

  window.addEventListener('appinstalled', function() {
    _deferredPrompt = null;
    markInstalled();
    var existing = document.querySelector('.pwa-install-banner');
    if (existing) hideBanner(existing);
  });

  if (isStandalone()) {
    markInstalled();
  }

  /* ============================================================
     Boot
     ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();