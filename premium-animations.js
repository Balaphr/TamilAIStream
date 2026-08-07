'use strict';

/* ============================================
   PREMIUM ANIMATIONS - Audio-Reactive Engine
   Tamil AI FM Enhanced Visual Experience
   ============================================
   Lightweight, GPU-accelerated, 60 FPS
   ============================================ */

const PremiumAnimations = {
    // Audio context & analyzer
    audioContext: null,
    analyzer: null,
    dataArray: null,
    source: null,
    isActive: false,
    
    // Waveform canvas
    waveformCanvas: null,
    waveformCtx: null,
    waveformAnimFrame: null,
    
    // Particles enhancement
    particleBoost: false,
    
    // Accent color
    currentAccent: '#10b981',
    accentTimeout: null,
    
    // Scroll reveal observer
    scrollObserver: null,
    
    // Ambient glow element
    ambientGlow: null,
    
    // ========================================
    // Initialize
    // ========================================
    init() {
        this.createAmbientGlow();
        this.createWaveformVisualizer();
        this.setupScrollReveal();
        this.setupMicroInteractions();
        this.setupCardEffects();
        this.setupHeartBurst();
        this.setupLiveBadgePulse();
        this.setupGlassPlayer();
        this.setupProgressBarGlow();
        this.setupPageTransitions();
        this.setupSkeletonEnhancements();
        this.setupQueueAnimations();
        
        // Listen for GlobalPlayer events
        this.setupGlobalPlayerIntegration();
        
        console.log('Premium Animations initialized');
    },
    
    // ========================================
    // Audio Analyzer Setup
    // ========================================
    setupAudioAnalyzer(audioElement) {
        if (!audioElement || this.audioContext) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyzer = this.audioContext.createAnalyser();
            this.analyzer.fftSize = 256;
            this.analyzer.smoothingTimeConstant = 0.8;
            
            this.source = this.audioContext.createMediaElementSource(audioElement);
            this.source.connect(this.analyzer);
            this.analyzer.connect(this.audioContext.destination);
            
            this.dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
            this.isActive = true;
            
            console.log('Audio analyzer connected');
        } catch (e) {
            console.warn('Audio analyzer not available:', e.message);
        }
    },
    
    getAudioData() {
        if (!this.analyzer || !this.dataArray) return null;
        this.analyzer.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    },
    
    getAverageFrequency() {
        const data = this.getAudioData();
        if (!data) return 0;
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        return sum / data.length / 255;
    },
    
    // ========================================
    // Waveform Visualizer
    // ========================================
    createWaveformVisualizer() {
        const container = document.querySelector('.player-mini');
        if (!container) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'waveform-visualizer';
        wrapper.innerHTML = '<canvas id="premiumWaveform"></canvas>';
        container.appendChild(wrapper);
        
        this.waveformCanvas = document.getElementById('premiumWaveform');
        if (this.waveformCanvas) {
            this.waveformCtx = this.waveformCanvas.getContext('2d');
            this.resizeWaveform();
            window.addEventListener('resize', () => this.resizeWaveform());
        }
    },
    
    resizeWaveform() {
        if (!this.waveformCanvas) return;
        const rect = this.waveformCanvas.parentElement.getBoundingClientRect();
        this.waveformCanvas.width = rect.width * (window.devicePixelRatio || 1);
        this.waveformCanvas.height = rect.height * (window.devicePixelRatio || 1);
        this.waveformCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    },
    
    drawWaveform() {
        if (!this.waveformCtx || !this.isActive) return;
        
        const canvas = this.waveformCanvas;
        const ctx = this.waveformCtx;
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        
        ctx.clearRect(0, 0, width, height);
        
        const data = this.getAudioData();
        if (!data) {
            this.waveformAnimFrame = requestAnimationFrame(() => this.drawWaveform());
            return;
        }
        
        const barCount = 64;
        const barWidth = width / barCount;
        const step = Math.floor(data.length / barCount);
        
        for (let i = 0; i < barCount; i++) {
            const value = data[i * step] / 255;
            const barHeight = value * height * 0.8;
            
            const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.1)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.4)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(
                i * barWidth + 1,
                height - barHeight,
                barWidth - 2,
                barHeight
            );
        }
        
        this.waveformAnimFrame = requestAnimationFrame(() => this.drawWaveform());
    },
    
    startWaveform() {
        const visualizer = document.querySelector('.waveform-visualizer');
        if (visualizer) visualizer.classList.add('active');
        this.drawWaveform();
    },
    
    stopWaveform() {
        const visualizer = document.querySelector('.waveform-visualizer');
        if (visualizer) visualizer.classList.remove('active');
        if (this.waveformAnimFrame) {
            cancelAnimationFrame(this.waveformAnimFrame);
            this.waveformAnimFrame = null;
        }
    },
    
    // ========================================
    // Ambient Glow
    // ========================================
    createAmbientGlow() {
        this.ambientGlow = document.createElement('div');
        this.ambientGlow.className = 'ambient-glow';
        document.body.appendChild(this.ambientGlow);
    },
    
    // ========================================
    // Accent Color Extraction
    // ========================================
    extractAccentColor(imageUrl) {
        if (!imageUrl) return '#10b981';
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 50;
                canvas.height = 50;
                ctx.drawImage(img, 0, 0, 50, 50);
                
                const data = ctx.getImageData(0, 0, 50, 50).data;
                let r = 0, g = 0, b = 0, count = 0;
                
                // Sample pixels from center area
                for (let i = 0; i < data.length; i += 16) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }
                
                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);
                
                // Ensure color is vibrant enough
                const max = Math.max(r, g, b);
                if (max < 80) {
                    this.setAccentColor('#10b981');
                    return;
                }
                
                // Boost saturation
                const boost = 1.3;
                r = Math.min(255, Math.round(r * boost));
                g = Math.min(255, Math.round(g * boost));
                b = Math.min(255, Math.round(b * boost));
                
                this.setAccentColor(`rgb(${r}, ${g}, ${b})`);
            } catch (e) {
                this.setAccentColor('#10b981');
            }
        };
        
        img.onerror = () => this.setAccentColor('#10b981');
    },
    
    setAccentColor(color) {
        this.currentAccent = color;
        document.documentElement.style.setProperty('--accent-color', color.replace('rgb', 'rgba').replace(')', ', 0.15)'));
        document.documentElement.style.setProperty('--accent-solid', color);
        document.documentElement.style.setProperty('--accent-glow', color.replace('rgb', 'rgba').replace(')', ', 0.3)'));
    },
    
    // ========================================
    // GlobalPlayer Integration
    // ========================================
    setupGlobalPlayerIntegration() {
        // Wait for GlobalPlayer to be available
        const checkGP = setInterval(() => {
            if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.audio) {
                clearInterval(checkGP);
                this.hookGlobalPlayer();
            }
        }, 100);
    },
    
    hookGlobalPlayer() {
        const gp = GlobalPlayer;
        
        // Override onPlay to add premium effects
        const origOnPlay = gp.onPlay.bind(gp);
        gp.onPlay = () => {
            origOnPlay();
            this.onTrackPlay(gp);
        };
        
        // Override onPause to remove premium effects
        const origOnPause = gp.onPause.bind(gp);
        gp.onPause = () => {
            origOnPause();
            this.onTrackPause(gp);
        };
        
        // Override loadTrack to extract accent color
        const origLoadTrack = gp.loadTrack.bind(gp);
        gp.loadTrack = (track, autoPlay) => {
            origLoadTrack(track, autoPlay);
            if (track && (track.thumbnail || track.cover)) {
                this.extractAccentColor(track.thumbnail || track.cover);
            }
        };
        
        // Setup audio analyzer on first play
        gp.audio.addEventListener('play', () => {
            if (!this.audioContext) {
                this.setupAudioAnalyzer(gp.audio);
            }
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }, { once: false });
    },
    
    onTrackPlay(gp) {
        // Activate ambient glow
        if (this.ambientGlow) this.ambientGlow.classList.add('active');
        
        // Activate glass player
        const playerMini = document.querySelector('.player-mini');
        if (playerMini) playerMini.classList.add('playing', 'glass-player');
        
        // Activate fullscreen vinyl
        const fsPlayer = document.getElementById('playerFullscreen');
        if (fsPlayer) fsPlayer.classList.add('playing');
        
        // Start waveform
        this.startWaveform();
        
        // Boost particles
        this.particleBoost = true;
        
        // Activate progress shimmer
        const progressBars = document.querySelectorAll('.player-mini-progress, .player-fullscreen-progress');
        progressBars.forEach(bar => bar.classList.add('progress-shimmer'));
    },
    
    onTrackPause(gp) {
        // Deactivate ambient glow
        if (this.ambientGlow) this.ambientGlow.classList.remove('active');
        
        // Deactivate glass player
        const playerMini = document.querySelector('.player-mini');
        if (playerMini) playerMini.classList.remove('playing');
        
        // Deactivate fullscreen vinyl
        const fsPlayer = document.getElementById('playerFullscreen');
        if (fsPlayer) fsPlayer.classList.remove('playing');
        
        // Stop waveform
        this.stopWaveform();
        
        // Unboost particles
        this.particleBoost = false;
        
        // Deactivate progress shimmer
        const progressBars = document.querySelectorAll('.player-mini-progress, .player-fullscreen-progress');
        progressBars.forEach(bar => bar.classList.remove('progress-shimmer'));
    },
    
    // ========================================
    // Scroll Reveal
    // ========================================
    setupScrollReveal() {
        if (!('IntersectionObserver' in window)) return;
        
        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    this.scrollObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        
        // Observe sections
        this.observeScrollElements();
    },
    
    observeScrollElements() {
        document.querySelectorAll('.scroll-reveal, .scroll-reveal-stagger').forEach(el => {
            this.scrollObserver.observe(el);
        });
    },
    
    // ========================================
    // Micro-Interactions
    // ========================================
    setupMicroInteractions() {
        // Add ripple effect to all interactive elements
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.ripple-effect, .btn-glow, .scale-bounce');
            if (!target) return;
            
            // Create ripple
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                width: 5px;
                height: 5px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                transform: translate(-50%, -50%) scale(0);
                animation: rippleExpand 0.6s ease-out forwards;
                pointer-events: none;
                left: ${e.offsetX}px;
                top: ${e.offsetY}px;
            `;
            
            target.style.position = 'relative';
            target.style.overflow = 'hidden';
            target.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
        
        // Inject ripple keyframe
        if (!document.getElementById('premium-ripple-style')) {
            const style = document.createElement('style');
            style.id = 'premium-ripple-style';
            style.textContent = `
                @keyframes rippleExpand {
                    to { transform: translate(-50%, -50%) scale(60); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    },
    
    // ========================================
    // Card Effects
    // ========================================
    setupCardEffects() {
        // Add hover-lift to cards
        const cardSelectors = '.station-card, .slide-card, .station-grid-card, .tamil-hit-card, .song-card';
        
        document.addEventListener('mouseenter', (e) => {
            const card = e.target.closest(cardSelectors);
            if (card) card.classList.add('hover-lift');
        }, true);
        
        document.addEventListener('mouseleave', (e) => {
            const card = e.target.closest(cardSelectors);
            if (card) card.classList.remove('hover-lift');
        }, true);
    },
    
    // ========================================
    // Heart Burst Animation
    // ========================================
    setupHeartBurst() {
        document.addEventListener('click', (e) => {
            const heartBtn = e.target.closest('.hit-fav-btn, .song-fav-btn, .sg-fav-btn');
            if (!heartBtn) return;
            
            heartBtn.classList.add('active');
            setTimeout(() => heartBtn.classList.remove('active'), 600);
        });
    },
    
    // ========================================
    // Live Badge Pulse
    // ========================================
    setupLiveBadgePulse() {
        document.querySelectorAll('.sg-live-badge, .slide-badge').forEach(badge => {
            badge.classList.add('live-badge-pulse');
        });
    },
    
    // ========================================
    // Glass Player
    // ========================================
    setupGlassPlayer() {
        const playerMini = document.querySelector('.player-mini');
        if (playerMini) {
            playerMini.classList.add('glass-player');
        }
    },
    
    // ========================================
    // Progress Bar Glow
    // ========================================
    setupProgressBarGlow() {
        const progressBars = document.querySelectorAll('.player-mini-progress, .player-fullscreen-progress');
        progressBars.forEach(bar => bar.classList.add('progress-glow'));
    },
    
    // ========================================
    // Page Transitions
    // ========================================
    setupPageTransitions() {
        // Add smooth transitions to YTMusic pages
        document.querySelectorAll('.ytm-page').forEach(page => {
            page.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        });
    },
    
    // ========================================
    // Skeleton Enhancements
    // ========================================
    setupSkeletonEnhancements() {
        document.querySelectorAll('.skeleton-card, .skeleton-row, .skeleton-pulse').forEach(el => {
            el.classList.add('skeleton-enhanced');
        });
    },
    
    // ========================================
    // Queue Animations
    // ========================================
    setupQueueAnimations() {
        // Animate queue items when added
        const queueList = document.getElementById('playerQueueList');
        if (!queueList) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        node.classList.add('queue-item-enter');
                        setTimeout(() => node.classList.remove('queue-item-enter'), 300);
                    }
                });
            });
        });
        
        observer.observe(queueList, { childList: true });
    },
    
    // ========================================
    // Public API
    // ========================================
    refresh() {
        this.observeScrollElements();
        this.setupLiveBadgePulse();
        this.setupSkeletonEnhancements();
    },
    
    destroy() {
        if (this.waveformAnimFrame) cancelAnimationFrame(this.waveformAnimFrame);
        if (this.scrollObserver) this.scrollObserver.disconnect();
        if (this.audioContext) this.audioContext.close();
        if (this.ambientGlow) this.ambientGlow.remove();
    }
};

// ============================================
// Initialize on DOMContentLoaded
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    PremiumAnimations.init();
    
    // Re-observe elements when content changes
    if (typeof DataStore !== 'undefined') {
        DataStore.on('change', () => {
            setTimeout(() => PremiumAnimations.refresh(), 100);
        });
    }
});

// Expose to global scope
window.PremiumAnimations = PremiumAnimations;
