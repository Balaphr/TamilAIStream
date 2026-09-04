/* ================================================================
   Tamil AI Stream – PWA 3D Logo Splash Screen
   Premium JioHotstar-style app opening animation
   ================================================================ */
(function() {
  'use strict';

  const SPLASH_KEY = 'tamilai_splash_seen';
  const SPLASH_DURATION = 2200; // Total splash duration in ms

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function shouldShowSplash() {
    // Show splash only in PWA standalone mode
    if (!isStandalone()) return false;
    // Show splash once per session
    if (sessionStorage.getItem(SPLASH_KEY)) return false;
    return true;
  }

  function createSplashScreen() {
    const splash = document.createElement('div');
    splash.id = 'pwaSplash';
    splash.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: radial-gradient(ellipse at center, #0a0f1a 0%, #060e1a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      font-family: Inter, system-ui, sans-serif;
    `;

    splash.innerHTML = `
      <div id="splashContainer" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        transform: scale(1);
      ">
        <!-- 3D Logo Container -->
        <div id="logo3D" style="
          position: relative;
          width: 120px;
          height: 120px;
          transform-style: preserve-3d;
          perspective: 1000px;
          animation: logoFloat 3s ease-in-out infinite;
        ">
          <!-- Logo Front Face -->
          <div class="logo-face logo-front" style="
            position: absolute;
            inset: 0;
            transform: translateZ(12px);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg viewBox="0 0 120 120" width="120" height="120" style="filter: drop-shadow(0 8px 32px rgba(52,211,153,0.4));">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#34d399"/>
                  <stop offset="50%" stop-color="#10b981"/>
                  <stop offset="100%" stop-color="#059669"/>
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <!-- Microphone Icon with Sound Waves -->
              <g filter="url(#glow)">
                <path d="M60 20c-11 0-20 9-20 20v40c0 11 9 20 20 20s20-9 20-20V40c0-11-9-20-20-20z" fill="url(#logoGrad)"/>
                <path d="M60 28c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16s16-7.2 16-16V44c0-8.8-7.2-16-16-16z" fill="#060e1a"/>
                <path d="M44 40c0-4.4 3.6-8 8-8s8 3.6 8 8v24c0 4.4-3.6 8-8 8s-8-3.6-8-8V40z" fill="url(#logoGrad)"/>
                <!-- Sound waves -->
                <g opacity="0.7" fill="url(#logoGrad)">
                  <path d="M76 32a24 24 0 0 1 0 56" stroke="#34d399" stroke-width="2.5" fill="none" stroke-linecap="round">
                    <animate attributeName="opacity" values="0.7;0.3;0.7" dur="1.5s" repeatCount="indefinite" begin="0s"/>
                    <animate attributeName="stroke-dashoffset" values="0;100" dur="2s" repeatCount="indefinite"/>
                  </path>
                  <path d="M84 24a32 32 0 0 1 0 72" stroke="#10b981" stroke-width="2" fill="none" stroke-linecap="round">
                    <animate attributeName="opacity" values="0.5;0.2;0.5" dur="1.5s" repeatCount="indefinite" begin="0.3s"/>
                  </path>
                  <path d="M92 16a40 40 0 0 1 0 88" stroke="#34d399" stroke-width="1.5" fill="none" stroke-linecap="round">
                    <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" begin="0.6s"/>
                  </path>
                </g>
              </g>
            </svg>
          </div>

          <!-- Logo Back Face (for 3D depth) -->
          <div class="logo-face logo-back" style="
            position: absolute;
            inset: 0;
            transform: translateZ(-12px) rotateY(180deg);
            background: linear-gradient(135deg, #059669, #047857);
            border-radius: 24px;
            opacity: 0.3;
          "></div>

          <!-- Logo Side Faces for 3D thickness -->
          <div class="logo-side logo-right" style="
            position: absolute;
            width: 24px;
            height: 120px;
            left: 60px;
            top: 0;
            transform: rotateY(90deg) translateZ(-12px);
            background: linear-gradient(180deg, #059669, #047857);
            opacity: 0.4;
          "></div>
          <div class="logo-side logo-left" style="
            position: absolute;
            width: 24px;
            height: 120px;
            right: 60px;
            top: 0;
            transform: rotateY(-90deg) translateZ(-12px);
            background: linear-gradient(180deg, #059669, #047857);
            opacity: 0.4;
          "></div>
          <div class="logo-side logo-top" style="
            position: absolute;
            width: 120px;
            height: 24px;
            left: 0;
            top: 0;
            transform: rotateX(90deg) translateZ(-12px);
            background: linear-gradient(90deg, #059669, #047857);
            opacity: 0.4;
          "></div>
          <div class="logo-side logo-bottom" style="
            position: absolute;
            width: 120px;
            height: 24px;
            left: 0;
            bottom: 0;
            transform: rotateX(-90deg) translateZ(-12px);
            background: linear-gradient(90deg, #059669, #047857);
            opacity: 0.4;
          "></div>
        </div>

        <!-- Rotating Ring Animation -->
        <div id="logoRing" style="
          position: absolute;
          width: 180px;
          height: 180px;
          border: 2px solid rgba(52,211,153,0.3);
          border-radius: 50%;
          border-top-color: #34d399;
          border-right-color: #10b981;
          animation: ringSpin 4s linear infinite;
        "></div>

        <div id="logoRing2" style="
          position: absolute;
          width: 220px;
          height: 220px;
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 50%;
          border-bottom-color: #34d399;
          animation: ringSpin 6s linear infinite reverse;
        "></div>

        <!-- App Name -->
        <div id="appName" style="
          font-size: 28px;
          font-weight: 800;
          background: linear-gradient(135deg, #34d399, #10b981, #34d399);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 1.5px;
          text-shadow: 0 0 60px rgba(52,211,153,0.3);
          animation: nameShimmer 3s ease-in-out infinite;
        ">Tamil AI Stream</div>

        <!-- Tagline -->
        <div id="appTagline" style="
          font-size: 14px;
          color: rgba(255,255,255,0.5);
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: 500;
          opacity: 0;
          animation: taglineFade 0.8s ease-out 0.6s forwards;
        ">AI-Powered Tamil Radio</div>

        <!-- Loading Progress -->
        <div id="loadingProgress" style="
          margin-top: 40px;
          width: 200px;
          height: 4px;
          background: rgba(255,255,255,0.08);
          border-radius: 2px;
          overflow: hidden;
          opacity: 0;
          animation: progressFade 0.8s ease-out 1s forwards;
        ">
          <div id="progressBar" style="
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #34d399, #10b981, #34d399);
            background-size: 200% 100%;
            border-radius: 2px;
            animation: progressFill 1.8s ease-out 1.2s forwards, progressShimmer 2s linear infinite;
          "></div>
        </div>

        <!-- Loading Text -->
        <div id="loadingText" style="
          margin-top: 12px;
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          font-weight: 500;
          min-height: 16px;
          opacity: 0;
          animation: textFade 0.8s ease-out 1s forwards;
        ">Initializing AI Engine...</div>
      </div>

      <style>
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0) rotateX(0deg) rotateY(0deg); }
          25% { transform: translateY(-8px) rotateX(5deg) rotateY(-5deg); }
          50% { transform: translateY(0) rotateX(0deg) rotateY(0deg); }
          75% { transform: translateY(8px) rotateX(-5deg) rotateY(5deg); }
        }
        @keyframes ringSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes nameShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes taglineFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes progressFill {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes progressShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes textFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes splashFadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.05); }
        }
        @keyframes containerFadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.95); }
        }
      </style>
    `;

    document.body.appendChild(splash);
    return splash;
  }

  function animateProgress(splash) {
    const texts = [
      'Initializing AI Engine...',
      'Loading Neural Networks...',
      'Calibrating Audio Engine...',
      'Connecting to Tamil FM...',
      'Ready to Stream!'
    ];
    let currentIndex = 0;
    const loadingText = splash.querySelector('#loadingText');
    const progressBar = splash.querySelector('#progressBar');

    const interval = setInterval(() => {
      if (currentIndex >= texts.length) {
        clearInterval(interval);
        return;
      }
      if (loadingText) {
        loadingText.style.opacity = '0';
        setTimeout(() => {
          loadingText.textContent = texts[currentIndex];
          loadingText.style.opacity = '1';
        }, 150);
      }
      if (progressBar) {
        progressBar.style.width = ((currentIndex + 1) / texts.length * 100) + '%';
      }
      currentIndex++;
    }, SPLASH_DURATION / texts.length);
  }

  function hideSplash(splash) {
    return new Promise(resolve => {
      const container = splash.querySelector('#splashContainer');
      
      // Fade out container
      container.style.animation = 'containerFadeOut 0.5s ease-in forwards';
      
      // Fade out splash
      setTimeout(() => {
        splash.style.animation = 'splashFadeOut 0.5s ease-in forwards';
      }, 100);
      
      setTimeout(() => {
        splash.remove();
        sessionStorage.setItem(SPLASH_KEY, 'true');
        resolve();
      }, 600);
    });
  }

  async function initSplash() {
    if (!shouldShowSplash()) return;
    
    // Wait for DOM ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    
    const splash = createSplashScreen();
    animateProgress(splash);
    
    // Wait for splash duration then hide
    setTimeout(async () => {
      await hideSplash(splash);
    }, SPLASH_DURATION);
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSplash);
  } else {
    initSplash();
  }

  // Expose for manual control
  window.PWASplash = {
    show: initSplash,
    hide: () => {
      const splash = document.getElementById('pwaSplash');
      if (splash) hideSplash(splash);
    }
  };
})();