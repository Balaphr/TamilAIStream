'use strict';

/* ============================================
   Equalizer - 10-Band Audio Equalizer
   Bass/Treble/Vocal Boost, Presets, Effects
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
        party:      [5, 4, 2, 0, -1, -1, 0, 2, 4, 5]
    };

    let currentGains = [...PRESETS.flat];
    let currentPreset = 'flat';

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

    function reset() {
        applyPreset('flat');
        setBassBoost(0);
        setTrebleBoost(0);
        setVocalBoost(0);
        setStereoBalance(0);
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
                preset: currentPreset
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
        } catch (e) {}
    }

    return {
        setBand, getBandGain, applyPreset,
        setBassBoost, setTrebleBoost, setVocalBoost,
        setStereoBalance, reset,
        getPresetNames, getCurrentPreset, getCurrentGains,
        saveEqSettings, loadEqSettings,
        BANDS, PRESETS
    };
})();
