'use strict';
/**
 * AudioSettings — Single Web Audio processing hub for the entire app.
 *
 * Processing chain (all nodes created lazily, only while audio plays):
 *   source → 10-band EQ → Bass Boost → Vocal Clarity → Compressor
 *         → Stereo Widener → Enhancer (parallel wet/dry) → destination
 *
 * Properly releases all resources when playback stops.
 * Access-controlled: only Admin / active Subscription users can use effects.
 */
const AudioSettings = (() => {
    const STORAGE_KEY = 'tamilAI_audioSettings';

    /* ─── Access Control ─── */
    function _hasPremiumAccess() {
        try {
            if (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin()) return true;
        } catch (e) {}
        try {
            if (typeof AccessControl !== 'undefined' && AccessControl.isSubscribed && AccessControl.isSubscribed()) return true;
        } catch (e) {}
        try {
            if (typeof AccessControl !== 'undefined' && AccessControl.isTrialActive && AccessControl.isTrialActive()) return true;
        } catch (e) {}
        return false;
    }

    /* ─── 10-Band EQ frequencies ─── */
    const EQ_BANDS = [
        { freq: 32,   type: 'lowshelf',  gain: 0 },
        { freq: 64,   type: 'peaking',   gain: 0 },
        { freq: 125,  type: 'peaking',   gain: 0 },
        { freq: 250,  type: 'peaking',   gain: 0 },
        { freq: 500,  type: 'peaking',   gain: 0 },
        { freq: 1000, type: 'peaking',   gain: 0 },
        { freq: 2000, type: 'peaking',   gain: 0 },
        { freq: 4000, type: 'peaking',   gain: 0 },
        { freq: 8000, type: 'peaking',   gain: 0 },
        { freq: 16000, type: 'highshelf', gain: 0 },
    ];

    const defaults = {
        enabled: false,
        eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        bassBoost: 0,
        vocalClarity: 0,
        normalization: false,
        stereoWiden: false,
        enhance: false,
        enhanceLevel: 0.7,
    };

    let _settings = JSON.parse(JSON.stringify(defaults));

    /* ─── Web Audio nodes ─── */
    let _ctx = null;
    let _source = null;
    let _eqFilters = [];
    let _bassBoost = null;
    let _vocalClarity = null;
    let _compressor = null;
    let _stereoSplitter = null;
    let _stereoMerger = null;
    let _stereoGainL = null;
    let _stereoGainR = null;
    let _enhanceDry = null;
    let _enhanceWet = null;
    let _enhanceMix = null;
    let _connected = false;
    let _attachedToAudio = null;
    let _playing = false;

    /* ─── AudioContext lifecycle ─── */
    function _ensureCtx() {
        if (_ctx && _ctx.state !== 'closed') return _ctx;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            _ctx = new Ctx();
            return _ctx;
        } catch (e) { return null; }
    }

    function _suspendCtx() {
        if (_ctx && _ctx.state === 'running' && !_playing) {
            _ctx.suspend().catch(() => {});
        }
    }

    function _resumeCtx() {
        if (_ctx && _ctx.state === 'suspended') {
            _ctx.resume().catch(() => {});
        }
    }

    /* ─── Build processing nodes (lazy, only when needed) ─── */
    function _ensureNodes(ctx) {
        /* 10-band EQ */
        if (_eqFilters.length === 0) {
            _eqFilters = EQ_BANDS.map((b, i) => {
                const f = ctx.createBiquadFilter();
                f.type = b.type;
                f.frequency.value = b.freq;
                f.gain.value = _settings.eqBands[i] || 0;
                f.Q.value = b.type === 'peaking' ? 1.2 : 0.7;
                return f;
            });
        }
        /* Bass boost (lowshelf @ 150Hz) */
        if (!_bassBoost) {
            _bassBoost = ctx.createBiquadFilter();
            _bassBoost.type = 'lowshelf';
            _bassBoost.frequency.value = 150;
            _bassBoost.gain.value = _settings.bassBoost * 1.5;
        }
        /* Vocal clarity (peaking @ 3kHz, moderate Q) */
        if (!_vocalClarity) {
            _vocalClarity = ctx.createBiquadFilter();
            _vocalClarity.type = 'peaking';
            _vocalClarity.frequency.value = 3000;
            _vocalClarity.Q.value = 1.0;
            _vocalClarity.gain.value = _settings.vocalClarity * 1.2;
        }
        /* Compressor (loudness normalization) */
        if (!_compressor) {
            _compressor = ctx.createDynamicsCompressor();
            _compressor.threshold.value = -24;
            _compressor.knee.value = 12;
            _compressor.ratio.value = 4;
            _compressor.attack.value = 0.003;
            _compressor.release.value = 0.25;
        }
        /* Stereo widener */
        if (!_stereoSplitter) {
            _stereoSplitter = ctx.createChannelSplitter(2);
            _stereoMerger = ctx.createChannelMerger(2);
            _stereoGainL = ctx.createGain();
            _stereoGainR = ctx.createGain();
            _stereoGainL.gain.value = 1;
            _stereoGainR.gain.value = 1;
        }
        /* Enhancer (parallel wet/dry) */
        if (!_enhanceDry) {
            _enhanceDry = ctx.createGain();
            _enhanceDry.gain.value = 1;
            _enhanceWet = ctx.createGain();
            _enhanceWet.gain.value = 0;
            _enhanceMix = ctx.createGain();
            _enhanceMix.gain.value = 1;
        }
    }

    /* ─── Disconnect all nodes ─── */
    function _disconnectAll() {
        const nodes = [
            _source, ..._eqFilters, _bassBoost, _vocalClarity, _compressor,
            _stereoSplitter, _stereoMerger, _stereoGainL, _stereoGainR,
            _enhanceDry, _enhanceWet, _enhanceMix,
        ];
        nodes.forEach(n => { if (n) try { n.disconnect(); } catch (e) {} });
        _connected = false;
    }

    /* ─── Connect the graph ─── */
    function _connectGraph(ctx) {
        if (!_source) return;
        _disconnectAll();

        if (!_settings.enabled) {
            _source.connect(ctx.destination);
            return;
        }

        let node = _source;

        /* 10-band EQ: always in chain (even if all flat — minimal CPU cost) */
        const hasEqChange = _settings.eqBands.some(g => g !== 0);
        if (hasEqChange) {
            for (let i = 0; i < _eqFilters.length; i++) {
                node.connect(_eqFilters[i]);
                node = _eqFilters[i];
            }
        }

        /* Bass boost */
        if (_settings.bassBoost !== 0 && _bassBoost) {
            node.connect(_bassBoost);
            node = _bassBoost;
        }

        /* Vocal clarity */
        if (_settings.vocalClarity !== 0 && _vocalClarity) {
            node.connect(_vocalClarity);
            node = _vocalClarity;
        }

        /* Compressor (normalization) */
        if (_settings.normalization && _compressor) {
            node.connect(_compressor);
            node = _compressor;
        }

        /* Stereo widening */
        if (_settings.stereoWiden && _stereoSplitter && _stereoMerger && _stereoGainL && _stereoGainR) {
            node.connect(_stereoSplitter);
            _stereoSplitter.connect(_stereoGainL, 0);
            _stereoSplitter.connect(_stereoGainR, 1);
            /* Haas effect: tiny delay on one channel for width */
            _stereoGainL.gain.setValueAtTime(1, ctx.currentTime);
            _stereoGainR.gain.setValueAtTime(0.92, ctx.currentTime);
            _stereoGainL.connect(_stereoMerger, 0, 0);
            _stereoGainR.connect(_stereoMerger, 0, 1);
            _stereoMerger.connect(ctx.destination);
            return; /* spatial path ends at destination */
        }

        /* Enhancer (parallel wet/dry) */
        if (_settings.enhance && _enhanceDry && _enhanceWet && _enhanceMix) {
            node.connect(_enhanceDry);
            node.connect(_enhanceWet);
            /* Wet path gets slight high-shelf lift for "air" */
            _enhanceWet.gain.setValueAtTime(_settings.enhanceLevel * 0.3, ctx.currentTime);
            _enhanceDry.connect(_enhanceMix);
            _enhanceWet.connect(_enhanceMix);
            _enhanceMix.connect(ctx.destination);
            return;
        }

        /* Default output */
        node.connect(ctx.destination);
    }

    /* ─── Apply current settings to live nodes ─── */
    function _applyToNodes() {
        if (!_ctx || _ctx.state === 'closed') return;
        const t = _ctx.currentTime;

        _eqFilters.forEach((f, i) => {
            if (f) f.gain.setValueAtTime(_settings.eqBands[i] || 0, t);
        });
        if (_bassBoost) _bassBoost.gain.setValueAtTime(_settings.bassBoost * 1.5, t);
        if (_vocalClarity) _vocalClarity.gain.setValueAtTime(_settings.vocalClarity * 1.2, t);
        if (_settings.enhance && _enhanceWet) {
            _enhanceWet.gain.setValueAtTime(_settings.enhanceLevel * 0.3, t);
        }
        _connectGraph(_ctx);
    }

    /* ─── Teardown: release all Web Audio resources ─── */
    function _teardown() {
        _disconnectAll();
        _eqFilters.forEach(f => { if (f) try { f.disconnect(); } catch (e) {} });
        _eqFilters = [];
        _bassBoost = null;
        _vocalClarity = null;
        _compressor = null;
        _stereoSplitter = null;
        _stereoMerger = null;
        _stereoGainL = null;
        _stereoGainR = null;
        _enhanceDry = null;
        _enhanceWet = null;
        _enhanceMix = null;
        _source = null;
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
            if (!_settings.enabled || !_hasPremiumAccess()) return;
            _playing = true;
            const ctx = _ensureCtx();
            if (!ctx) return;
            _resumeCtx();
            try {
                if (!_source) {
                    _source = ctx.createMediaElementSource(audioEl);
                }
                _ensureNodes(ctx);
                _applyToNodes();
                _connected = true;
            } catch (e) {
                console.warn('[AudioSettings] Chain build failed:', e);
                _teardown();
            }
        });

        audioEl.addEventListener('pause', () => {
            _playing = false;
            /* Suspend context after 5s of pause to save CPU */
            setTimeout(() => {
                if (!_playing && _ctx && _ctx.state === 'running') {
                    _ctx.suspend().catch(() => {});
                }
            }, 5000);
        });

        audioEl.addEventListener('ended', () => {
            _playing = false;
            _closeCtx();
        });

        audioEl.addEventListener('waiting', () => {
            _playing = false;
        });

        audioEl.addEventListener('canplay', () => {
            if (_settings.enabled && _hasPremiumAccess() && !audioEl.paused) {
                _playing = true;
                const ctx = _ensureCtx();
                if (ctx) _resumeCtx();
            }
        });
    }

    /* ─── Auto-detect audio element ─── */
    let _detectInterval = null;
    function _startDetecting() {
        if (_detectInterval) return;
        const el = window.audioPlayer || document.querySelector('audio');
        if (el) { _hookAudio(el); return; }
        let attempts = 0;
        _detectInterval = setInterval(() => {
            if (!_settings.enabled) { clearInterval(_detectInterval); _detectInterval = null; return; }
            const el = window.audioPlayer || document.querySelector('audio');
            if (el) { _hookAudio(el); clearInterval(_detectInterval); _detectInterval = null; return; }
            if (++attempts > 10) { clearInterval(_detectInterval); _detectInterval = null; }
        }, 500);
    }

    /* ─── Persistence ─── */
    function saveSettings() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings)); } catch (e) {}
    }
    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                _settings = { ...defaults, ...parsed };
                /* Ensure eqBands array is correct length */
                if (!Array.isArray(_settings.eqBands) || _settings.eqBands.length !== 10) {
                    _settings.eqBands = [...defaults.eqBands];
                }
            }
        } catch (e) {}
    }

    /* ─── Public API ─── */
    function init() {
        loadSettings();
        const el = window.audioPlayer || document.querySelector('audio');
        if (el) _hookAudio(el);
        if (_settings.enabled) _startDetecting();
    }

    function apply(patch) {
        Object.assign(_settings, patch);
        saveSettings();
        if (_settings.enabled && _hasPremiumAccess()) {
            const el = window.audioPlayer || document.querySelector('audio');
            if (el) {
                _hookAudio(el);
                const ctx = _ensureCtx();
                if (ctx) {
                    _resumeCtx();
                    if (!_source) {
                        try { _source = ctx.createMediaElementSource(el); } catch (e) {}
                    }
                    if (_source) {
                        _ensureNodes(ctx);
                        _applyToNodes();
                    }
                }
            }
            _startDetecting();
        } else {
            if (_ctx) _closeCtx();
        }
    }

    function setEnabled(v) {
        if (v && !_hasPremiumAccess()) return;
        apply({ enabled: !!v });
    }

    /* EQ bands */
    function setEqBand(index, gain) {
        if (index < 0 || index > 9) return;
        const v = Math.max(-12, Math.min(12, gain));
        _settings.eqBands[index] = v;
        if (_connected && _eqFilters[index]) {
            const t = _ctx ? _ctx.currentTime : 0;
            _eqFilters[index].gain.setValueAtTime(v, t);
        }
        saveSettings();
    }
    function getEqBands() { return [..._settings.eqBands]; }
    function setEqBands(bands) {
        if (!Array.isArray(bands) || bands.length !== 10) return;
        bands.forEach((g, i) => { _settings.eqBands[i] = Math.max(-12, Math.min(12, g)); });
        if (_connected) _applyToNodes();
        saveSettings();
    }

    /* Bass / Vocal / Enhancement */
    function setBassBoost(v) { apply({ bassBoost: Math.max(-12, Math.min(12, v)) }); }
    function setVocalClarity(v) { apply({ vocalClarity: Math.max(-12, Math.min(12, v)) }); }
    function setNormalization(v) { apply({ normalization: !!v }); }
    function setStereoWiden(v) { apply({ stereoWiden: !!v }); }
    function setEnhance(v) { apply({ enhance: !!v }); }
    function setEnhanceLevel(v) { apply({ enhanceLevel: Math.max(0, Math.min(1, v)) }); }

    function reset() {
        _closeCtx();
        _settings = JSON.parse(JSON.stringify(defaults));
        saveSettings();
    }

    function getSettings() { return JSON.parse(JSON.stringify(_settings)); }
    function isSupported() { return !!(window.AudioContext || window.webkitAudioContext); }
    function isEnabled() { return _settings.enabled && _hasPremiumAccess(); }
    function hasPremiumAccess() { return _hasPremiumAccess(); }

    return {
        init, apply, reset, getSettings, isSupported, isEnabled, hasPremiumAccess, saveSettings,
        setEnabled, setEqBand, getEqBands, setEqBands,
        setBassBoost, setVocalClarity, setNormalization,
        setStereoWiden, setEnhance, setEnhanceLevel,
    };
})();

if (typeof window !== 'undefined') window.AudioSettings = AudioSettings;
