'use strict';

/* ============================================
   EqualizerUI - 10-Band Equalizer Interface
   Dolby-style Enhancement Controls
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
                
                <div class="eq-section">
                    <div class="eq-section-title">Presets</div>
                    <div class="eq-presets" id="eqPresets"></div>
                </div>
                
                <div class="eq-section">
                    <div class="eq-section-title">Frequency Bands</div>
                    <div class="eq-bands" id="eqBands"></div>
                </div>
                
                <div class="eq-section eq-boost-section">
                    <div class="eq-section-title">Quick Boost</div>
                    <div class="eq-boost-row">
                        <button class="eq-boost-btn" id="eqBass">
                            <i class="fas fa-arrow-up"></i> Bass
                        </button>
                        <button class="eq-boost-btn" id="eqVocal">
                            <i class="fas fa-microphone"></i> Vocal
                        </button>
                        <button class="eq-boost-btn" id="eqTreble">
                            <i class="fas fa-arrow-up"></i> Treble
                        </button>
                    </div>
                </div>
                
                <div class="eq-section eq-enhancement-section">
                    <div class="eq-section-title">
                        <i class="fas fa-magic"></i> Audio Enhancement
                    </div>
                    <div class="eq-enhancement-toggle">
                        <label class="eq-switch">
                            <input type="checkbox" id="eqEnhancementToggle">
                            <span class="eq-slider"></span>
                        </label>
                        <span class="eq-switch-label">Enable Enhancement</span>
                    </div>
                    
                    <div class="eq-enhancement-options" id="eqEnhancementOptions" style="display: none;">
                        <div class="eq-enhancement-level">
                            <label>Enhancement Level</label>
                            <input type="range" id="eqEnhancementLevel" min="0" max="100" value="70">
                            <span id="eqEnhancementLevelValue">70%</span>
                        </div>
                        
                        <div class="eq-enhancement-features">
                            <div class="eq-feature-toggle">
                                <label class="eq-switch small">
                                    <input type="checkbox" id="eqSpatialToggle">
                                    <span class="eq-slider"></span>
                                </label>
                                <span>Spatial Audio</span>
                            </div>
                            
                            <div class="eq-feature-toggle">
                                <label class="eq-switch small">
                                    <input type="checkbox" id="eqLoudnessNormToggle">
                                    <span class="eq-slider"></span>
                                </label>
                                <span>Loudness Normalization</span>
                            </div>
                            
                            <div class="eq-feature-toggle">
                                <label class="eq-switch small">
                                    <input type="checkbox" id="eqStereoWidenToggle">
                                    <span class="eq-slider"></span>
                                </label>
                                <span>Stereo Widening</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="eq-footer">
                    <button class="eq-reset-btn" id="eqReset">
                        <i class="fas fa-undo"></i> Reset All
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(el);
        bindEQEvents();
        renderPresets();
        renderBands();
        loadEnhancementState();
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
            loadEnhancementState();
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
        
        // Enhancement toggle
        document.getElementById('eqEnhancementToggle')?.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            Equalizer.enableEnhancement(enabled);
            document.getElementById('eqEnhancementOptions').style.display = enabled ? 'block' : 'none';
        });
        
        // Enhancement level
        document.getElementById('eqEnhancementLevel')?.addEventListener('input', (e) => {
            const level = parseInt(e.target.value) / 100;
            Equalizer.setEnhancementLevel(level);
            document.getElementById('eqEnhancementLevelValue').textContent = e.target.value + '%';
        });
        
        // Feature toggles
        document.getElementById('eqSpatialToggle')?.addEventListener('change', (e) => {
            Equalizer.toggleSpatial(e.target.checked);
        });
        
        document.getElementById('eqLoudnessNormToggle')?.addEventListener('change', (e) => {
            Equalizer.toggleLoudnessNorm(e.target.checked);
        });
        
        document.getElementById('eqStereoWidenToggle')?.addEventListener('change', (e) => {
            Equalizer.toggleStereoWiden(e.target.checked);
        });
    }

    function renderPresets() {
        const container = document.getElementById('eqPresets');
        if (!container) return;
        const presets = Equalizer.getPresetNames();
        const current = Equalizer.getCurrentPreset();

        container.innerHTML = presets.map(p => `
            <button class="eq-preset-btn ${p === current ? 'active' : ''}" data-preset="${p}">
                ${p.replace(/([A-Z])/g, ' $1').trim()}
            </button>
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
    
    function loadEnhancementState() {
        const enabled = Equalizer.isEnhancementEnabled();
        const level = Equalizer.getEnhancementLevel();
        const spatial = Equalizer.getSpatialState();
        const loudness = Equalizer.getLoudnessNormState();
        const stereo = Equalizer.getStereoWidenState();
        
        const toggle = document.getElementById('eqEnhancementToggle');
        const options = document.getElementById('eqEnhancementOptions');
        const levelSlider = document.getElementById('eqEnhancementLevel');
        const levelValue = document.getElementById('eqEnhancementLevelValue');
        const spatialToggle = document.getElementById('eqSpatialToggle');
        const loudnessToggle = document.getElementById('eqLoudnessNormToggle');
        const stereoToggle = document.getElementById('eqStereoWidenToggle');
        
        if (toggle) toggle.checked = enabled;
        if (options) options.style.display = enabled ? 'block' : 'none';
        if (levelSlider) levelSlider.value = Math.round(level * 100);
        if (levelValue) levelValue.textContent = Math.round(level * 100) + '%';
        if (spatialToggle) spatialToggle.checked = spatial;
        if (loudnessToggle) loudnessToggle.checked = loudness;
        if (stereoToggle) stereoToggle.checked = stereo;
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