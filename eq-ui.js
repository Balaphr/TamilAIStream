'use strict';

/* ============================================
   EqualizerUI - 10-Band Equalizer Interface
   ============================================ */

const EqualizerUI = (() => {
    let isOpen = false;

    function createEQOverlay() {
        if (document.getElementById('eq-overlay')) return;
        const el = document.createElement('div');
        el.id = 'eq-overlay';
        el.className = 'eq-overlay';
        el.innerHTML = `
            <div class="eq-panel">
                <div class="eq-header">
                    <h3>Equalizer</h3>
                    <button class="eq-close" id="eqClose"><i class="fas fa-times"></i></button>
                </div>
                <div class="eq-presets" id="eqPresets"></div>
                <div class="eq-bands" id="eqBands"></div>
                <div class="eq-boost-row">
                    <button class="eq-boost-btn" id="eqBass">Bass Boost</button>
                    <button class="eq-boost-btn" id="eqVocal">Vocal Boost</button>
                    <button class="eq-boost-btn" id="eqTreble">Treble Boost</button>
                </div>
                <div class="eq-boost-row">
                    <button class="eq-boost-btn" id="eqReset">Reset All</button>
                </div>
            </div>
        `;
        document.body.appendChild(el);
        bindEQEvents();
        renderPresets();
        renderBands();
    }

    function bindEQEvents() {
        document.getElementById('eqClose')?.addEventListener('click', closeEQ);
        document.getElementById('eq-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'eq-overlay') closeEQ();
        });

        document.getElementById('eqReset')?.addEventListener('click', () => {
            Equalizer.reset();
            renderBands();
            updateBoostButtons();
        });

        document.getElementById('eqBass')?.addEventListener('click', () => {
            const btn = document.getElementById('eqBass');
            const isActive = btn.classList.toggle('active');
            Equalizer.setBassBoost(isActive ? 8 : 0);
            renderBands();
        });

        document.getElementById('eqVocal')?.addEventListener('click', () => {
            const btn = document.getElementById('eqVocal');
            const isActive = btn.classList.toggle('active');
            Equalizer.setVocalBoost(isActive ? 6 : 0);
            renderBands();
        });

        document.getElementById('eqTreble')?.addEventListener('click', () => {
            const btn = document.getElementById('eqTreble');
            const isActive = btn.classList.toggle('active');
            Equalizer.setTrebleBoost(isActive ? 8 : 0);
            renderBands();
        });
    }

    function renderPresets() {
        const container = document.getElementById('eqPresets');
        if (!container) return;
        const presets = Equalizer.getPresetNames();
        const current = Equalizer.getCurrentPreset();

        container.innerHTML = presets.map(p => `
            <button class="eq-preset-btn ${p === current ? 'active' : ''}" data-preset="${p}">${p}</button>
        `).join('');

        container.querySelectorAll('.eq-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.eq-preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Equalizer.applyPreset(btn.dataset.preset);
                renderBands();
                updateBoostButtons();
            });
        });
    }

    function renderBands() {
        const container = document.getElementById('eqBands');
        if (!container) return;
        const gains = Equalizer.getCurrentGains();
        const bands = Equalizer.BANDS;

        container.innerHTML = bands.map((band, i) => `
            <div class="eq-band">
                <div class="eq-value" id="eqVal${i}">${gains[i] > 0 ? '+' : ''}${gains[i]}</div>
                <div class="eq-slider-wrap">
                    <input type="range" class="eq-slider" min="-12" max="12" value="${gains[i]}"
                        data-index="${i}" step="1">
                </div>
                <div class="eq-label">${band.label}</div>
            </div>
        `).join('');

        container.querySelectorAll('.eq-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const val = parseInt(e.target.value);
                Equalizer.setBand(idx, val);
                document.getElementById(`eqVal${idx}`).textContent = (val > 0 ? '+' : '') + val;
                Equalizer.saveEqSettings();
            });
        });
    }

    function updateBoostButtons() {
        const gains = Equalizer.getCurrentGains();
        const bassAvg = (gains[0] + gains[1] + gains[2]) / 3;
        const vocalAvg = (gains[3] + gains[4] + gains[5] + gains[6]) / 4;
        const trebleAvg = (gains[7] + gains[8] + gains[9]) / 3;

        document.getElementById('eqBass')?.classList.toggle('active', bassAvg > 2);
        document.getElementById('eqVocal')?.classList.toggle('active', vocalAvg > 2);
        document.getElementById('eqTreble')?.classList.toggle('active', trebleAvg > 2);
    }

    function openEQ() {
        createEQOverlay();
        document.getElementById('eq-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        isOpen = true;
    }

    function closeEQ() {
        const overlay = document.getElementById('eq-overlay');
        if (overlay) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            setTimeout(() => overlay.remove(), 300);
        }
        isOpen = false;
    }

    return { openEQ, closeEQ };
})();
