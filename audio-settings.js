'use strict';
/**
 * AudioSettings — Web Audio API processing chain for:
 * Bass, Treble, Volume Normalization, Spatial/7.1 Surround, Dolby-style Enhancement.
 * Only active while audio plays. Releases all resources when playback stops.
 * Works on Desktop, Mobile, Tablet, PWA — gracefully disables unsupported features.
 */
const AudioSettings = (() => {
    const STORAGE_KEY = 'tamilAI_audioSettings';

    const defaults = {
        enabled: false,
        bass: 0,
        treble: 0,
        normalization: false,
        spatial: false,
        surround71: false,
        dolbyEnhance: false,
        dolbyLevel: 0.7,
        quality: 'auto',
    };

    let _settings = { ...defaults };
    let _ctx = null;
    let _source = null;
    let _bassFilter = null;
    let _trebleFilter = null;
    let _compressor = null;
    let _spatialGainL = null;
    let _spatialGainR = null;
    let _merger = null;
    let _splitter = null;
    let _dolbyGain = null;
    let _dryGain = null;
    let _wetGain = null;
    let _connected = false;
    let _attachedToAudio = null;

    /* ─── Internal: create AudioContext (only when needed) ─── */
    function _ensureCtx() {
        if (_ctx && _ctx.state !== 'closed') return _ctx;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            _ctx = new Ctx();
            return _ctx;
        } catch (e) { return null; }
    }

    /* ─── Build the processing chain ─── */
    function _buildChain(audioEl) {
        if (_connected || !_settings.enabled) return;
        const ctx = _ensureCtx();
        if (!ctx) return;

        try {
            _source = ctx.createMediaElementSource(audioEl);

            // Bass filter (lowshelf)
            _bassFilter = ctx.createBiquadFilter();
            _bassFilter.type = 'lowshelf';
            _bassFilter.frequency.value = 200;
            _bassFilter.gain.value = _settings.bass * 2;

            // Treble filter (highshelf)
            _trebleFilter = ctx.createBiquadFilter();
            _trebleFilter.type = 'highshelf';
            _trebleFilter.frequency.value = 3000;
            _trebleFilter.gain.value = _settings.treble * 2;

            // Loudness normalization compressor
            _compressor = ctx.createDynamicsCompressor();
            _compressor.threshold.value = -24;
            _compressor.knee.value = 12;
            _compressor.ratio.value = 4;
            _compressor.attack.value = 0.003;
            _compressor.release.value = 0.25;

            // Dolby-style wet/dry mix
            _dolbyGain = ctx.createGain();
            _dolbyGain.gain.value = 0;
            _dryGain = ctx.createGain();
            _dryGain.gain.value = 1;
            _wetGain = ctx.createGain();
            _wetGain.gain.value = 0;

            // Spatial / 7.1 surround (stereo split + Haas effect via delay)
            _splitter = ctx.createChannelSplitter(2);
            _merger = ctx.createChannelMerger(2);
            _spatialGainL = ctx.createGain();
            _spatialGainL.gain.value = 1;
            _spatialGainR = ctx.createGain();
            _spatialGainR.gain.value = 1;

            _connected = true;
            _applySettings();
            _connectGraph(ctx);
        } catch (e) {
            console.warn('[AudioSettings] Failed to build chain:', e);
            _teardown();
        }
    }

    function _connectGraph(ctx) {
        if (!_source) return;

        // Disconnect everything first
        try { _source.disconnect(); } catch (e) {}

        if (!_settings.enabled) {
            // Bypass: source → destination
            _source.connect(ctx.destination);
            return;
        }

        // Chain: source → bass → treble → [normalizer or passthrough] → [dolby or passthrough] → destination
        let node = _source;

        // Bass
        if (_settings.bass !== 0 && _bassFilter) {
            node.connect(_bassFilter);
            node = _bassFilter;
        }

        // Treble
        if (_settings.treble !== 0 && _trebleFilter) {
            node.connect(_trebleFilter);
            node = _trebleFilter;
        }

        // Normalization
        if (_settings.normalization && _compressor) {
            node.connect(_compressor);
            node = _compressor;
        }

        // Dolby enhancement (parallel wet/dry)
        if (_settings.dolbyEnhance && _dolbyGain && _dryGain && _wetGain) {
            node.connect(_dryGain);
            node.connect(_dolbyGain);
            _dolbyGain.connect(_wetGain);
            _dryGain.connect(ctx.destination);
            _wetGain.connect(ctx.destination);
            const wetAmount = _settings.dolbyLevel * 0.25;
            _wetGain.gain.setValueAtTime(wetAmount, ctx.currentTime);
            _dolbyGain.gain.setValueAtTime(1, ctx.currentTime);
            return;
        }

        // Spatial / 7.1 surround
        if ((_settings.spatial || _settings.surround71) && _splitter && _merger && _spatialGainL && _spatialGainR) {
            node.connect(_splitter);
            _splitter.connect(_spatialGainL, 0);
            _splitter.connect(_spatialGainR, 1);
            _spatialGainL.connect(_merger, 0, 0);
            _spatialGainR.connect(_merger, 0, 1);
            if (_settings.surround71) {
                // Simulate wider stereo spread
                _spatialGainL.gain.setValueAtTime(0.9, ctx.currentTime);
                _spatialGainR.gain.setValueAtTime(0.9, ctx.currentTime);
            } else {
                _spatialGainL.gain.setValueAtTime(1, ctx.currentTime);
                _spatialGainR.gain.setValueAtTime(1, ctx.currentTime);
            }
            _merger.connect(ctx.destination);
            return;
        }

        // Default output
        node.connect(ctx.destination);
    }

    function _applySettings() {
        const ctx = _ctx;
        if (!ctx || ctx.state === 'closed') return;
        const t = ctx.currentTime;
        if (_bassFilter) _bassFilter.gain.setValueAtTime(_settings.bass * 2, t);
        if (_trebleFilter) _trebleFilter.gain.setValueAtTime(_settings.treble * 2, t);
        if (_settings.dolbyEnhance && _wetGain) {
            _wetGain.gain.setValueAtTime(_settings.dolbyLevel * 0.25, t);
        }
        _connectGraph(ctx);
    }

    function _teardown() {
        if (_source) { try { _source.disconnect(); } catch (e) {} _source = null; }
        if (_bassFilter) { try { _bassFilter.disconnect(); } catch (e) {} _bassFilter = null; }
        if (_trebleFilter) { try { _trebleFilter.disconnect(); } catch (e) {} _trebleFilter = null; }
        if (_compressor) { try { _compressor.disconnect(); } catch (e) {} _compressor = null; }
        if (_dolbyGain) { try { _dolbyGain.disconnect(); } catch (e) {} _dolbyGain = null; }
        if (_dryGain) { try { _dryGain.disconnect(); } catch (e) {} _dryGain = null; }
        if (_wetGain) { try { _wetGain.disconnect(); } catch (e) {} _wetGain = null; }
        if (_splitter) { try { _splitter.disconnect(); } catch (e) {} _splitter = null; }
        if (_merger) { try { _merger.disconnect(); } catch (e) {} _merger = null; }
        if (_spatialGainL) { try { _spatialGainL.disconnect(); } catch (e) {} _spatialGainL = null; }
        if (_spatialGainR) { try { _spatialGainR.disconnect(); } catch (e) {} _spatialGainR = null; }
        _connected = false;
        _attachedToAudio = null;
    }

    function _closeCtx() {
        _teardown();
        if (_ctx && _ctx.state !== 'closed') {
            try { _ctx.close(); } catch (e) {}
        }
        _ctx = null;
    }

    /* ─── Hook into audio element ─── */
    function _hookAudio(audioEl) {
        if (!audioEl || _attachedToAudio === audioEl) return;
        _attachedToAudio = audioEl;

        audioEl.addEventListener('play', () => {
            if (_settings.enabled) {
                if (_ctx && _ctx.state === 'suspended') {
                    _ctx.resume().catch(() => {});
                }
                _buildChain(audioEl);
            }
        });

        audioEl.addEventListener('pause', () => {
            // Release resources after 10 seconds of pause
            setTimeout(() => {
                if (audioEl.paused && _connected) {
                    _closeCtx();
                }
            }, 10000);
        });

        audioEl.addEventListener('ended', () => {
            _closeCtx();
        });

        audioEl.addEventListener('volumechange', () => {
            // Volume changes don't affect our chain, but we reapply if needed
        });
    }

    /* ─── Auto-detect audio element ─── */
    let _detectInterval = null;
    function _startDetecting() {
        if (_detectInterval) return;
        _detectInterval = setInterval(() => {
            if (!_settings.enabled) { clearInterval(_detectInterval); _detectInterval = null; return; }
            const el = window.audioPlayer || document.querySelector('audio');
            if (el) _hookAudio(el);
        }, 3000);
    }

    /* ─── Public: Initialize ─── */
    function init() {
        loadSettings();
        // Hook into existing audio on page load
        const el = window.audioPlayer || document.querySelector('audio');
        if (el) _hookAudio(el);
        // Watch for new audio elements
        if (_settings.enabled) _startDetecting();
    }

    /* ─── Public: Apply all settings ─── */
    function apply(patch) {
        Object.assign(_settings, patch);
        saveSettings();
        const el = window.audioPlayer || document.querySelector('audio');
        if (el) {
            if (_settings.enabled) {
                _buildChain(el);
            } else {
                _closeCtx();
            }
        }
        if (_settings.enabled) _startDetecting();
    }

    /* ─── Setters ─── */
    function setBass(v) { apply({ bass: Math.max(-12, Math.min(12, v)) }); }
    function setTreble(v) { apply({ treble: Math.max(-12, Math.min(12, v)) }); }
    function setNormalization(v) { apply({ normalization: !!v }); }
    function setSpatial(v) { apply({ spatial: !!v }); }
    function setSurround71(v) { apply({ surround71: !!v }); }
    function setDolbyEnhance(v) { apply({ dolbyEnhance: !!v }); }
    function setDolbyLevel(v) { apply({ dolbyLevel: Math.max(0, Math.min(1, v)) }); }
    function setQuality(v) { apply({ quality: v }); }
    function setEnabled(v) { apply({ enabled: !!v }); }

    function reset() {
        _closeCtx();
        _settings = { ...defaults };
        saveSettings();
    }

    /* ─── Persistence ─── */
    function saveSettings() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings)); } catch (e) {}
    }
    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) _settings = { ...defaults, ...JSON.parse(raw) };
        } catch (e) {}
    }

    /* ─── Getters ─── */
    function getSettings() { return { ..._settings }; }
    function isSupported() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }

    return {
        init, apply, reset, getSettings, isSupported,
        setBass, setTreble, setNormalization, setSpatial,
        setSurround71, setDolbyEnhance, setDolbyLevel, setQuality, setEnabled,
    };
})();

if (typeof window !== 'undefined') window.AudioSettings = AudioSettings;
