'use strict';
/* ============================================================
   AudioVisualizer — Futuristic Circular Ring Visualizer
   Renders behind player / current music area
   ============================================================ */
window.PremiumNowPlaying = (() => {

    const $ = (id) => document.getElementById(id);
    let _vizRAF = null;
    let vizCanvasEl = null;

    function getAudio() {
        return window.audioPlayer || null;
    }

    /* ============================================================
       AUDIO VISUALIZER (Circular Ring Style)
       ============================================================ */
    function initVisualizer() {
        vizCanvasEl = $('premiumVizCanvas');
        if (!vizCanvasEl) return;
        const ctx = vizCanvasEl.getContext('2d');
        resizeCanvas(vizCanvasEl);
        window.addEventListener('resize', () => resizeCanvas(vizCanvasEl));
        drawVisualizer(ctx, vizCanvasEl);
    }

    function resizeCanvas(canvas) {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const h = canvas.parentElement.offsetHeight || 140;
        canvas.width = rect.width * dpr;
        canvas.height = h * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = h + 'px';
    }

    function drawVisualizer(ctx, canvas) {
        /* Pause when tab is hidden — save CPU/battery */
        if (document.hidden) {
            _vizRAF = requestAnimationFrame(() => drawVisualizer(ctx, canvas));
            return;
        }

        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        const ap = getAudio();
        const playing = ap && !ap.paused;
        const time = performance.now() / 1000;

        ctx.clearRect(0, 0, w, h);

        /* Generate frequency-like data */
        const bars = 64;
        const data = [];
        for (let i = 0; i < bars; i++) {
            if (playing) {
                const base = Math.sin(time * 2 + i * 0.3) * 0.3 + 0.5;
                const harmonic = Math.sin(time * 3.7 + i * 0.5) * 0.2;
                const beat = Math.sin(time * 1.2) * 0.15;
                data.push(Math.max(0.06, Math.min(1, base + harmonic + beat + Math.random() * 0.06)));
            } else {
                data.push(0.04 + Math.sin(time * 0.5 + i * 0.2) * 0.025);
            }
        }

        /* Circular ring visualizer */
        const maxRadius = Math.min(cx, cy) * 0.88;
        const minRadius = maxRadius * 0.42;

        for (let i = 0; i < bars; i++) {
            const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
            const val = data[i];
            const barLen = (maxRadius - minRadius) * val;
            const x1 = cx + Math.cos(angle) * minRadius;
            const y1 = cy + Math.sin(angle) * minRadius;
            const x2 = cx + Math.cos(angle) * (minRadius + barLen);
            const y2 = cy + Math.sin(angle) * (minRadius + barLen);

            const hue = 180 + (i / bars) * 120;
            const alpha = playing ? 0.25 + val * 0.45 : 0.06 + val * 0.08;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${alpha})`;
            ctx.lineWidth = Math.max(2, (w / bars) * 0.3);
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        /* Inner glow */
        const glowR = minRadius * 0.8;
        const grad = ctx.createRadialGradient(cx, cy, glowR * 0.2, cx, cy, glowR);
        if (playing) {
            grad.addColorStop(0, 'rgba(34,211,238,0.05)');
            grad.addColorStop(0.5, 'rgba(59,130,246,0.025)');
            grad.addColorStop(1, 'transparent');
        } else {
            grad.addColorStop(0, 'rgba(34,211,238,0.015)');
            grad.addColorStop(1, 'transparent');
        }
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        /* Outer ring */
        ctx.beginPath();
        ctx.arc(cx, cy, maxRadius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = playing ? 'rgba(34,211,238,0.05)' : 'rgba(255,255,255,0.015)';
        ctx.lineWidth = 1;
        ctx.stroke();

        _vizRAF = requestAnimationFrame(() => drawVisualizer(ctx, canvas));
    }

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(initVisualizer, 120));
        } else {
            setTimeout(initVisualizer, 120);
        }
    }

    function destroy() {
        if (_vizRAF) cancelAnimationFrame(_vizRAF);
    }

    return { init, destroy };
})();
