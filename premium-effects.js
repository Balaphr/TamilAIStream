'use strict';

/* ============================================
   PremiumEffects - Ripple, Skeleton Loading,
   Dynamic Color Extraction
   Particles have been removed — the website
   uses a static premium AI background.
   ============================================ */

const PremiumEffects = (() => {

    /* ---- Ripple Effect ---- */
    function addRipple(element, e) {
        const rect = element.getBoundingClientRect();
        const x = (e ? e.clientX : rect.left + rect.width / 2) - rect.left;
        const y = (e ? e.clientY : rect.top + rect.height / 2) - rect.top;
        const size = Math.max(rect.width, rect.height) * 2;

        const ripple = document.createElement('span');
        ripple.className = 'premium-ripple';
        ripple.style.cssText = `
            position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;
            width:${size}px;height:${size}px;border-radius:50%;
            background:rgba(255,255,255,0.15);
            transform:scale(0);animation:rippleExpand 0.6s ease-out forwards;
            pointer-events:none;z-index:10;
        `;

        element.style.position = element.style.position || 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    /* ---- Skeleton Loading ---- */
    function showSkeleton(container, count = 6) {
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'premium-skeleton';
            skeleton.innerHTML = `
                <div class="skeleton-avatar"></div>
                <div class="skeleton-lines">
                    <div class="skeleton-line" style="width:${60 + Math.random() * 30}%"></div>
                    <div class="skeleton-line short" style="width:${30 + Math.random() * 20}%"></div>
                </div>
            `;
            container.appendChild(skeleton);
        }
    }

    function hideSkeleton(container) {
        container.querySelectorAll('.premium-skeleton').forEach(s => {
            s.style.opacity = '0';
            setTimeout(() => s.remove(), 300);
        });
    }

    /* ---- Dynamic Color Extraction ---- */
    function extractColors(imgElement) {
        return new Promise((resolve) => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 50;
                canvas.height = 50;
                ctx.drawImage(imgElement, 0, 0, 50, 50);
                const data = ctx.getImageData(0, 0, 50, 50).data;

                const colorCounts = {};
                for (let i = 0; i < data.length; i += 16) {
                    const r = Math.round(data[i] / 32) * 32;
                    const g = Math.round(data[i + 1] / 32) * 32;
                    const b = Math.round(data[i + 2] / 32) * 32;
                    const key = `${r},${g},${b}`;
                    colorCounts[key] = (colorCounts[key] || 0) + 1;
                }

                const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
                const dominant = sorted[0]?.[0].split(',').map(Number) || [16, 185, 129];
                const secondary = sorted[1]?.[0].split(',').map(Number) || [59, 130, 246];

                resolve({
                    dominant: `rgb(${dominant.join(',')})`,
                    secondary: `rgb(${secondary.join(',')})`,
                    dominantArr: dominant,
                    secondaryArr: secondary,
                    gradient: `linear-gradient(135deg, rgba(${dominant.join(',')},0.3), rgba(${secondary.join(',')},0.2))`
                });
            } catch {
                resolve({
                    dominant: 'rgb(16,185,129)',
                    secondary: 'rgb(59,130,246)',
                    dominantArr: [16, 185, 129],
                    secondaryArr: [59, 130, 246],
                    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(59,130,246,0.2))'
                });
            }
        });
    }

    /* ---- Inject Styles ---- */
    function injectStyles() {
        if (document.getElementById('premium-effects-style')) return;
        const style = document.createElement('style');
        style.id = 'premium-effects-style';
        style.textContent = `
            @keyframes rippleExpand {
                to { transform: scale(1); opacity: 0; }
            }
            .premium-ripple { animation: rippleExpand 0.6s ease-out forwards; }

            .premium-skeleton {
                display: flex; align-items: center; gap: 12px;
                padding: 12px; animation: skeletonPulse 1.5s ease-in-out infinite;
            }
            .skeleton-avatar {
                width: 48px; height: 48px; border-radius: 50%;
                background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
                background-size: 200% 100%;
            }
            .skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
            .skeleton-line {
                height: 12px; border-radius: 6px;
                background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
                background-size: 200% 100%;
            }
            .skeleton-line.short { width: 60%; }
            @keyframes skeletonPulse {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            .premium-skeleton .skeleton-avatar,
            .premium-skeleton .skeleton-line {
                animation: skeletonPulse 1.5s ease-in-out infinite;
            }

            .premium-card-morph {
                transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
            }
            .premium-card-morph:hover {
                transform: translateY(-4px) scale(1.02);
                box-shadow: 0 12px 40px rgba(0,0,0,0.3);
            }

            .premium-fade-in {
                animation: premiumFadeIn 0.4s ease-out;
            }
            @keyframes premiumFadeIn {
                from { opacity: 0; transform: translateY(12px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .premium-slide-up {
                animation: premiumSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
            }
            @keyframes premiumSlideUp {
                from { opacity: 0; transform: translateY(100%); }
                to { opacity: 1; transform: translateY(0); }
            }

            .premium-glow {
                box-shadow: 0 0 20px rgba(16,185,129,0.3), 0 0 60px rgba(16,185,129,0.1);
            }

            @media (max-width: 640px) {
                .premium-skeleton .skeleton-avatar { width: 40px; height: 40px; }
            }
        `;
        document.head.appendChild(style);
    }

    function init() {
        injectStyles();
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-ripple]');
            if (target) addRipple(target, e);
        });
    }

    return {
        init,
        addRipple, showSkeleton, hideSkeleton,
        extractColors
    };
})();
