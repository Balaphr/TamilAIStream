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
  var POLL_INTERVAL  = 60000;   // 60 s

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
    document.addEventListener('visibilitychange', onVisibility);
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

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      // A new SW has taken control → reload to pick up the new version.
      window.location.reload();
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
    pollTimer = setInterval(pollVersion, POLL_INTERVAL);
  }

  async function pollVersion() {
    if (!registration) return;
    try {
      // Force the browser to re-fetch /sw.js and check for code changes.
      registration.update();
    } catch (_) { /* ok */ }

    try {
      var resp = await fetch('/api/version', { cache: 'no-store' });
      if (!resp.ok) return;
      var data = await resp.json();

      if (data.contentVersion && data.contentVersion !== contentVersion) {
        contentVersion = data.contentVersion;
        localStorage.setItem(VERSION_KEY, contentVersion);
        showBanner('New Content Published');
      }
    } catch (_) { /* offline / endpoint missing */ }
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') pollVersion();
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

    // 3. Safety: reload after 2 s even if controllerchange doesn't fire.
    setTimeout(function () {
      window.location.reload();
    }, 2000);
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