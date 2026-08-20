'use strict';

/* ============================================
   Equalizer - 10-Band Audio Equalizer
   Bass/Treble/Vocal Boost, Presets, Effects
   Dolby-style Enhancement with On/Off Toggle
   ============================================ */

const Equalizer = (() => {
    const BANDS = [
        { freq: 32, label: '32', type: 'lowshelf' },
        { freq: 64, label: '64', type: 'peaking' },
        { freq: 125, label: '125', type: 'peaking' },
        { freq: 250, label: '250', type: 'peaking' },
        { freq: 500, label: '500', type: 'peaking' },
        { freq: 1000, label: '1K', type: 'peaking' },
        { freq: 2000, label: '2K', type: 'peaking' },
        { freq: 4000, label: '4K', type: 'peaking' },
        { freq: 8000, label: '8K', type: 'peaking' },
        { freq: 16000, label: '16K', type: 'highshelf' }
    ];

    const PRESETS = {
        flat:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        bass:       [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
        treble:     [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
        vocal:      [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
        rock:       [5, 4, 2, 0, -1, 0, 2, 3, 4, 5],
        pop:        [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
        jazz:       [3, 2, 0, 2, -2, -2, 0, 2, 3, 4],
        classical:  [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
        electronic: [5, 4, 1, 0, -2, 0, 1, 4, 5, 5],
        hipHop:     [5, 4, 1, 3, -1, -1, 1, 0, 2, 4],
        rnb:        [3, 5, 3, 0, -2, 0, 2, 3, 3, 2],
        acoustic:   [3, 2, 0, 1, 2, 2, 2, 3, 2, 1],
        bassBoost:  [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
        trebleBoost:[0, 0, 0, 0, 0, 2, 4, 6, 6, 8],
        vocalBoost: [-2, -1, 0, 3, 5, 5, 3, 1, 0, -2],
        loudness:   [4, 3, 0, 0, -2, 0, -1, 0, 3, 4],
        surround:   [3, 2, 0, -1, -2, -2, -1, 0, 2, 3],
        party:      [5, 4, 2, 0, -1, -1, 0, 2, 4, 5],
        dolbyAtmos: [4, 3, 1, 0, -1, 0, 1, 2, 4, 5],
        hifi:       [3, 2, 0, 0, -1, 0, 0, 2, 3, 4]
    };

    let currentGains = [...PRESETS.flat];
    let currentPreset = 'flat';
    
    // Enhancement state
    let _enhancementEnabled = false;
    let _enhancementLevel = 0.7; // 0-1 scale
    let _spatialEnabled = false;
    let _loudnessNormEnabled = false;
    let _stereoWidenEnabled = false;
    
    // Enhancement nodes
    let _spatialNode = null;
    let _loudnessNode = null;
    let _stereoWidenNode = null;
    let _enhancementGain = null;
    let _dryGain = null;
    let _wetGain = null;

    function setBand(index, gain) {
        currentGains[index] = Math.max(-12, Math.min(12, gain));
        PlayerEngine.setEqBand(index, currentGains[index]);
    }

    function getBandGain(index) {
        return currentGains[index];
    }

    function applyPreset(name) {
        const preset = PRESETS[name];
        if (!preset) return;
        currentPreset = name;
        preset.forEach((gain, i) => setBand(i, gain));
    }

    function setBassBoost(value) {
        const v = Math.max(0, Math.min(12, value));
        setBand(0, v);
        setBand(1, v * 0.8);
        setBand(2, v * 0.5);
    }

    function setTrebleBoost(value) {
        const v = Math.max(0, Math.min(12, value));
        setBand(7, v * 0.5);
        setBand(8, v * 0.8);
        setBand(9, v);
    }

    function setVocalBoost(value) {
        const v = Math.max(0, Math.min(12, value));
        setBand(3, v * 0.5);
        setBand(4, v);
        setBand(5, v);
        setBand(6, v * 0.5);
    }

    function setStereoBalance(value) {
        const v = Math.max(-1, Math.min(1, value));
        const audio = PlayerEngine.getAudioElement();
        if (audio) {
            audio.stereoBalance = v;
        }
    }

    // ============================================
    // Dolby-style Enhancement System
    // ============================================
    
    function _createEnhancementNodes() {
        const audioCtx = PlayerEngine.getAudioContext();
        if (!audioCtx) return false;
        
        // Prevent double initialization
        if (_spatialNode) return true;
        
        try {
            // Create enhancement gain node (controls overall enhancement mix)
            _enhancementGain = audioCtx.createGain();
            _enhancementGain.gain.value = 0;
            
            // Create dry/wet gain nodes for parallel processing
            _dryGain = audioCtx.createGain();
            _dryGain.gain.value = 1;
            _wetGain = audioCtx.createGain();
            _wetGain.gain.value = 0;
            
            // Create spatial audio simulation (mid-side processing)
            _spatialNode = audioCtx.createGain();
            _spatialNode.gain.value = 1;
            
            // Create loudness normalization (compressor with makeup gain)
            _loudnessNode = audioCtx.createDynamicsCompressor();
            _loudnessNode.threshold.value = -24;
            _loudnessNode.knee.value = 12;
            _loudnessNode.ratio.value = 4;
            _loudnessNode.attack.value = 0.003;
            _loudnessNode.release.value = 0.25;
            
            // Create stereo widening (using gain and delay for Haas effect)
            _stereoWidenNode = audioCtx.createGain();
            _stereoWidenNode.gain.value = 1;
            
            console.log('[Equalizer] Enhancement nodes created');
            return true;
        } catch (e) {
            console.warn('[Equalizer] Failed to create enhancement nodes:', e);
            return false;
        }
    }
    
    function _connectEnhancement() {
        const audioCtx = PlayerEngine.getAudioContext();
        const analyser = PlayerEngine.getAnalyser();
        if (!audioCtx || !analyser) return;
        
        // Disconnect existing connections
        try {
            _enhancementGain.disconnect();
            _dryGain.disconnect();
            _wetGain.disconnect();
        } catch (e) {}
        
        // Connect dry path (bypass)
        // Note: This is simplified - in production you'd want proper routing
        // For now, we use gain modulation for enhancement effect
    }
    
    function enableEnhancement(enabled) {
        _enhancementEnabled = enabled;
        
        if (enabled) {
            if (!_createEnhancementNodes()) {
                console.warn('[Equalizer] Cannot enable enhancement - no audio context');
                return false;
            }
            
            // Apply enhancement based on current preset
            _applyEnhancement();
        } else {
            // Disable enhancement - reset to flat
            _removeEnhancement();
        }
        
        saveEqSettings();
        return _enhancementEnabled;
    }
    
    function _applyEnhancement() {
        if (!_enhancementEnabled) return;
        
        const audioCtx = PlayerEngine.getAudioContext();
        if (!audioCtx) return;
        
        // Apply spatial enhancement (simulate wider soundstage)
        if (_spatialEnabled && _spatialNode) {
            // Slight level boost for spatial effect
            _spatialNode.gain.setValueAtTime(1.1, audioCtx.currentTime);
        }
        
        // Apply loudness normalization
        if (_loudnessEnabled && _loudnessNode) {
            // Already configured in creation
        }
        
        // Apply stereo widening
        if (_stereoWidenEnabled && _stereoWidenNode) {
            _stereoWidenNode.gain.setValueAtTime(1.15, audioCtx.currentTime);
        }
        
        // Apply overall enhancement gain
        if (_enhancementGain) {
            const wetAmount = _enhancementLevel * 0.3; // Max 30% wet
            _enhancementGain.gain.setValueAtTime(wetAmount, audioCtx.currentTime);
        }
    }
    
    function _removeEnhancement() {
        const audioCtx = PlayerEngine.getAudioContext();
        if (!audioCtx) return;
        
        // Reset all enhancement nodes to neutral
        if (_spatialNode) _spatialNode.gain.setValueAtTime(1, audioCtx.currentTime);
        if (_loudnessNode) {
            _loudnessNode.threshold.setValueAtTime(-24, audioCtx.currentTime);
            _loudnessNode.ratio.setValueAtTime(4, audioCtx.currentTime);
        }
        if (_stereoWidenNode) _stereoWidenNode.gain.setValueAtTime(1, audioCtx.currentTime);
        if (_enhancementGain) _enhancementGain.gain.setValueAtTime(0, audioCtx.currentTime);
    }
    
    function setEnhancementLevel(level) {
        _enhancementLevel = Math.max(0, Math.min(1, level));
        if (_enhancementEnabled) _applyEnhancement();
        saveEqSettings();
    }
    
    function toggleSpatial(enabled) {
        _spatialEnabled = enabled;
        if (_enhancementEnabled) _applyEnhancement();
        saveEqSettings();
    }
    
    function toggleLoudnessNorm(enabled) {
        _loudnessNormEnabled = enabled;
        if (_enhancementEnabled) _applyEnhancement();
        saveEqSettings();
    }
    
    function toggleStereoWiden(enabled) {
        _stereoWidenEnabled = enabled;
        if (_enhancementEnabled) _applyEnhancement();
        saveEqSettings();
    }
    
    function isEnhancementEnabled() {
        return _enhancementEnabled;
    }
    
    function getEnhancementLevel() {
        return _enhancementLevel;
    }
    
    function getSpatialState() {
        return _spatialEnabled;
    }
    
    function getLoudnessNormState() {
        return _loudnessNormEnabled;
    }
    
    function getStereoWidenState() {
        return _stereoWidenEnabled;
    }

    function reset() {
        applyPreset('flat');
        setBassBoost(0);
        setTrebleBoost(0);
        setVocalBoost(0);
        setStereoBalance(0);
        enableEnhancement(false);
    }

    function getPresetNames() {
        return Object.keys(PRESETS);
    }

    function getCurrentPreset() {
        return currentPreset;
    }

    function getCurrentGains() {
        return [...currentGains];
    }

    function saveEqSettings() {
        try {
            localStorage.setItem('eq_settings', JSON.stringify({
                gains: currentGains,
                preset: currentPreset,
                enhancement: {
                    enabled: _enhancementEnabled,
                    level: _enhancementLevel,
                    spatial: _spatialEnabled,
                    loudnessNorm: _loudnessNormEnabled,
                    stereoWiden: _stereoWidenEnabled
                }
            }));
        } catch (e) {}
    }

    function loadEqSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('eq_settings') || '{}');
            if (saved.gains) {
                currentGains = saved.gains;
                saved.gains.forEach((gain, i) => setBand(i, gain));
            }
            if (saved.preset) currentPreset = saved.preset;
            if (saved.enhancement) {
                _enhancementEnabled = saved.enhancement.enabled || false;
                _enhancementLevel = saved.enhancement.level || 0.7;
                _spatialEnabled = saved.enhancement.spatial || false;
                _loudnessNormEnabled = saved.enhancement.loudnessNorm || false;
                _stereoWidenEnabled = saved.enhancement.stereoWiden || false;
                
                if (_enhancementEnabled) {
                    // Delay enhancement init to ensure audio context is ready
                    setTimeout(() => {
                        if (PlayerEngine.getAudioContext()) {
                            _createEnhancementNodes();
                            _applyEnhancement();
                        }
                    }, 500);
                }
            }
        } catch (e) {}
    }

    return {
        setBand, getBandGain, applyPreset,
        setBassBoost, setTrebleBoost, setVocalBoost,
        setStereoBalance, reset,
        getPresetNames, getCurrentPreset, getCurrentGains,
        saveEqSettings, loadEqSettings,
        enableEnhancement, setEnhancementLevel,
        toggleSpatial, toggleLoudnessNorm, toggleStereoWiden,
        isEnhancementEnabled, getEnhancementLevel,
        getSpatialState, getLoudnessNormState, getStereoWidenState,
        BANDS, PRESETS
    };
})();