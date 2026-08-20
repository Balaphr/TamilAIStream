'use strict';

/* ============================================
   PlayerEngine - Premium Audio Engine
   Crossfade, Gapless, Queue, State Persistence
   ============================================ */

const PlayerEngine = (() => {
    let audio = null;
    let audioCtx = null;
    let analyser = null;
    let sourceNode = null;
    let gainNode = null;
    let crossfadeNode = null;
    let freqData = null;
    let timeData = null;

    const state = {
        isPlaying: false,
        currentTrack: null,
        queue: [],
        queueIndex: -1,
        shuffle: false,
        repeat: 'off',
        volume: 0.8,
        muted: false,
        speed: 1,
        crossfadeDuration: 2,
        bassBoost: 0,
        trebleBoost: 0,
        vocalBoost: 0,
        stereoBalance: 0,
        loudnessNorm: false,
        surroundEffect: false,
        sleepTimer: null,
        sleepTimerMinutes: 0,
        favorites: [],
        recentlyPlayed: [],
        mostPlayed: {},
        offlineDownloads: [],
        playbackPosition: 0,
        duration: 0,
        bitrate: '128kbps',
        quality: 'High',
        aiAutomation: false,
        colorTheme: 0
    };

    const listeners = {};
    const CROSSFADE_SECONDS = 2;
    const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    let eqFilters = [];

    function emit(event, data) {
        (listeners[event] || []).forEach(fn => fn(data));
    }

    function on(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
        return () => { listeners[event] = listeners[event].filter(f => f !== fn); };
    }

    let _saveStateTimer = null;
    const _SAVE_DEBOUNCE = 1500; // 1.5 second debounce

    function _doSaveState() {
        try {
            const toSave = {
                isPlaying: state.isPlaying,
                currentTrack: state.currentTrack,
                queue: state.queue,
                queueIndex: state.queueIndex,
                shuffle: state.shuffle,
                repeat: state.repeat,
                volume: state.volume,
                muted: state.muted,
                speed: state.speed,
                favorites: state.favorites,
                recentlyPlayed: state.recentlyPlayed.slice(0, 100),
                mostPlayed: state.mostPlayed,
                offlineDownloads: state.offlineDownloads,
                playbackPosition: audio ? audio.currentTime : 0,
                duration: audio ? audio.duration : 0,
                aiAutomation: state.aiAutomation,
                colorTheme: state.colorTheme,
                timestamp: Date.now()
            };
            localStorage.setItem('player_engine_state', JSON.stringify(toSave));
        } catch (e) {}
    }

    function saveState() {
        if (_saveStateTimer) clearTimeout(_saveStateTimer);
        _saveStateTimer = setTimeout(_doSaveState, _SAVE_DEBOUNCE);
    }

    function saveStateImmediate() {
        if (_saveStateTimer) clearTimeout(_saveStateTimer);
        _doSaveState();
    }

    function loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem('player_engine_state') || '{}');
            if (saved.volume !== undefined) state.volume = saved.volume;
            if (saved.shuffle !== undefined) state.shuffle = saved.shuffle;
            if (saved.repeat !== undefined) state.repeat = saved.repeat;
            if (saved.speed !== undefined) state.speed = saved.speed;
            if (saved.muted !== undefined) state.muted = saved.muted;
            if (saved.favorites) state.favorites = saved.favorites;
            if (saved.recentlyPlayed) state.recentlyPlayed = saved.recentlyPlayed;
            if (saved.mostPlayed) state.mostPlayed = saved.mostPlayed;
            if (saved.offlineDownloads) state.offlineDownloads = saved.offlineDownloads;
            if (saved.queue) state.queue = saved.queue;
            if (saved.queueIndex !== undefined) state.queueIndex = saved.queueIndex;
            if (saved.aiAutomation !== undefined) state.aiAutomation = saved.aiAutomation;
            if (saved.colorTheme !== undefined) state.colorTheme = saved.colorTheme;
            if (saved.currentTrack) state.currentTrack = saved.currentTrack;
            if (saved.playbackPosition !== undefined) state.playbackPosition = saved.playbackPosition;
            if (saved.isPlaying !== undefined) state.isPlaying = saved.isPlaying;
            return saved;
        } catch (e) { return null; }
    }

    function initAudio() {
        if (window.__BUILDER_PREVIEW__) return;
        if (audio && audio === window.audioPlayer) return;
        // Always prefer the canonical window.audioPlayer created by script.js
        if (window.audioPlayer) {
            audio = window.audioPlayer;
        } else if (!audio) {
            audio = new Audio();
            window.audioPlayer = audio;
        }
        audio.preload = 'auto';
        audio.volume = state.volume;
        audio.playbackRate = state.speed;

        try {
            audioCtx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            window.audioCtx = audioCtx;
            analyser = window.analyserNode || audioCtx.createAnalyser();
            window.analyserNode = analyser;
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.82;
            gainNode = audioCtx.createGain();
            try { sourceNode = audioCtx.createMediaElementSource(audio); } catch(e) { sourceNode = null; }

            eqFilters = EQ_BANDS.map((freq, i) => {
                const filter = audioCtx.createBiquadFilter();
                filter.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1.4;
                filter.gain.value = 0;
                return filter;
            });

            if (sourceNode) {
                sourceNode.connect(eqFilters[0]);
                for (let i = 0; i < eqFilters.length - 1; i++) eqFilters[i].connect(eqFilters[i + 1]);
                eqFilters[eqFilters.length - 1].connect(gainNode);
                gainNode.connect(analyser);
                analyser.connect(audioCtx.destination);
            }

            freqData = new Uint8Array(analyser.frequencyBinCount);
            timeData = new Uint8Array(analyser.fftSize);
        } catch (e) {
            console.warn('Web Audio API unavailable:', e);
        }

        audio.addEventListener('play', () => {
            state.isPlaying = true;
            emit('play', state);
        });

        audio.addEventListener('pause', () => {
            state.isPlaying = false;
            saveState();
            emit('pause', state);
        });

        // NOTE: 'ended' handler only updates PlayerEngine internal state.
        // Queue advancement is handled exclusively by script.js to avoid
        // double-play-next race conditions.
        audio.addEventListener('ended', () => {
            state.isPlaying = false;
            emit('ended', state);
        });

        audio.addEventListener('timeupdate', () => {
            state.playbackPosition = audio.currentTime;
            state.duration = audio.duration || 0;
            emit('timeupdate', { current: audio.currentTime, duration: audio.duration });
        });

        audio.addEventListener('loadedmetadata', () => {
            state.duration = audio.duration;
            emit('loaded', { duration: audio.duration });
        });

        audio.addEventListener('waiting', () => emit('buffering', true));
        audio.addEventListener('canplay', () => emit('buffering', false));
        audio.addEventListener('playing', () => emit('buffering', false));

        audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            emit('error', e);
        });
    }

    function handleTrackEnd() {
        if (state.repeat === 'one') {
            audio.currentTime = 0;
            audio.play().catch(() => {});
            return;
        }
        if (state.repeat === 'all' || state.queueIndex < state.queue.length - 1) {
            playNext();
            if (state.aiAutomation) autoRecommendNext();
        } else {
            if (state.aiAutomation) {
                autoRecommendNext();
            } else {
                state.isPlaying = false;
                emit('ended', state);
            }
        }
    }

    // ============================================
    // AI Automation - Auto-DJ / Smart Recommendations
    // ============================================
    let autoRecommendTimer = null;
    let autoDJActive = false;

    function autoRecommendNext() {
        try {
            const current = state.currentTrack;
            const mood = current?.genre || current?.mood || '';
            let recommendations = [];

            if (typeof PlaylistManager !== 'undefined' && PlaylistManager.getRecommendationsByMood) {
                const moodSongs = mood ? PlaylistManager.getRecommendationsByMood(mood) : [];
                const trending = typeof DataStore !== 'undefined' && DataStore.getTrending
                    ? DataStore.getTrending().filter(t => t.status === 'active').slice(0, 3)
                    : [];
                const stations = typeof DataStore !== 'undefined' && DataStore.getStations
                    ? DataStore.getStations().filter(s => s.status === 'active')
                    : [];
                
                recommendations = [...moodSongs];
                if (recommendations.length < 5) {
                    const songs = typeof DataStore !== 'undefined' && DataStore.getSongs
                        ? DataStore.getSongs().filter(s => s.status === 'published')
                        : [];
                    recommendations.push(...songs.filter(s => !recommendations.some(r => r.id === s.id)).slice(0, 5));
                }
                if (recommendations.length === 0 && stations.length > 0) {
                    const randomStation = stations[Math.floor(Math.random() * stations.length)];
                    playTrack({
                        id: randomStation.id,
                        title: randomStation.name,
                        artist: randomStation.freq + ' • ' + randomStation.genre,
                        thumbnail: randomStation.thumbnail || '',
                        streamUrl: randomStation.streamUrl
                    }, [randomStation], 0);
                    emit('aiRecommendation', { type: 'station', track: randomStation });
                    return;
                }
            }

            if (recommendations.length > 0) {
                const next = recommendations.filter(r => r.id !== current?.id)[0] || recommendations[0];
                playTrack(next, recommendations, 0);
                emit('aiRecommendation', { type: 'song', track: next });
            } else if (state.queue.length === 0) {
                emit('aiRecommendation', { type: 'none' });
            }
        } catch (e) {
            console.warn('AI auto-recommendation error:', e);
        }
    }

    function toggleAIAutomation() {
        state.aiAutomation = !state.aiAutomation;
        if (state.aiAutomation && state.isPlaying) {
            // Schedule periodic smart recommendations
            scheduleAutoRecommend();
        } else {
            clearTimeout(autoRecommendTimer);
        }
        saveState();
        emit('aiAutomation', state.aiAutomation);
        return state.aiAutomation;
    }

    function scheduleAutoRecommend() {
        clearTimeout(autoRecommendTimer);
        if (!state.aiAutomation || !state.isPlaying) return;
        autoRecommendTimer = setTimeout(() => {
            if (state.aiAutomation && state.isPlaying && state.queue.length <= state.queueIndex + 1) {
                autoRecommendNext();
            }
            if (state.aiAutomation && state.isPlaying) scheduleAutoRecommend();
        }, 5 * 60 * 1000);
    }

    function cycleColorTheme() {
        state.colorTheme = (state.colorTheme + 1) % 6;
        emit('colorTheme', state.colorTheme);
        return state.colorTheme;
    }

    function getColorTheme() { return state.colorTheme; }

    async function playTrack(track, queue, index) {
        if (window.__BUILDER_PREVIEW__) return;
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();

        if (queue) state.queue = [...queue];
        if (index !== undefined) state.queueIndex = index;
        state.currentTrack = track;

        const url = track.streamUrl || track.audioUrl || track.url;
        if (!url) { emit('error', new Error('No audio URL')); return; }

        // CRITICAL FIX: If the same track is already loaded and playing/paused,
        // do NOT reset the audio source or position. Just resume if paused.
        const currentSrc = audio.src;
        const isSameTrack = currentSrc && currentSrc.indexOf(url) !== -1;
        if (isSameTrack && (state.isPlaying || !audio.paused)) {
            // Same track already loaded - just ensure it's playing
            if (audio.paused) {
                await audio.play().catch(() => {});
            }
            addToRecentlyPlayed(track);
            state.mostPlayed[track.id || track.name] = (state.mostPlayed[track.id || track.name] || 0) + 1;
            saveState();
            emit('trackChange', state);
            return;
        }

        if (state.crossfadeDuration > 0 && state.isPlaying) {
            await crossfadeTo(url);
        } else {
            audio.src = url;
            audio.load();
            await audio.play().catch(() => {});
        }

        addToRecentlyPlayed(track);
        state.mostPlayed[track.id || track.name] = (state.mostPlayed[track.id || track.name] || 0) + 1;
        saveState();
        emit('trackChange', state);
    }

    let _isCrossfading = false;
    let _crossfadeTimeout = null;

    async function crossfadeTo(newUrl) {
        if (_isCrossfading) {
            // Cancel previous crossfade - just switch immediately
            if (_crossfadeTimeout) clearTimeout(_crossfadeTimeout);
            _isCrossfading = false;
        }
        
        if (!audioCtx) {
            audio.src = newUrl;
            audio.load();
            await audio.play().catch(() => {});
            return;
        }
        
        _isCrossfading = true;
        const oldGain = gainNode.gain.value;
        gainNode.gain.setValueAtTime(oldGain, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + CROSSFADE_SECONDS);

        await new Promise(r => {
            _crossfadeTimeout = setTimeout(r, CROSSFADE_SECONDS * 800);
        });

        audio.src = newUrl;
        audio.load();
        await audio.play().catch(() => {});

        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(state.volume, audioCtx.currentTime + CROSSFADE_SECONDS * 0.5);
        _isCrossfading = false;
    }

    function play() {
        if (window.__BUILDER_PREVIEW__) return;
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        audio.play().catch(() => {});
    }

    function pause() {
        if (window.__BUILDER_PREVIEW__) return;
        if (audio) audio.pause();
    }

    function togglePlay() {
        if (window.__BUILDER_PREVIEW__) return;
        if (state.isPlaying) pause();
        else play();
    }

    function stop() {
        if (window.__BUILDER_PREVIEW__) return;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.removeAttribute('src');
            audio.load();
        }
        state.isPlaying = false;
        emit('stop', state);
    }

    function playNext() {
        if (state.queue.length === 0) return;
        let nextIdx = state.shuffle
            ? Math.floor(Math.random() * state.queue.length)
            : state.queueIndex + 1;
        if (nextIdx >= state.queue.length) {
            if (state.repeat === 'all') nextIdx = 0;
            else return;
        }
        state.queueIndex = nextIdx;
        playTrack(state.queue[nextIdx], null, nextIdx);
    }

    function playPrevious() {
        if (state.queue.length === 0) return;
        if (audio && audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        let prevIdx = state.shuffle
            ? Math.floor(Math.random() * state.queue.length)
            : state.queueIndex - 1;
        if (prevIdx < 0) prevIdx = state.repeat === 'all' ? state.queue.length - 1 : 0;
        state.queueIndex = prevIdx;
        playTrack(state.queue[prevIdx], null, prevIdx);
    }

    function seekTo(time) {
        if (window.__BUILDER_PREVIEW__) return;
        var dur = (audio && audio.duration) || 0;
        var target = Math.max(0, Math.min(time, dur));
        window._isSeeking = true;
        window._seekingUntil = Date.now() + 1500;
        if (audio && dur && isFinite(dur)) {
            try { audio.currentTime = target; } catch (e) {}
        }
        state.currentTime = target;
        emit('timeupdate', { current: target, duration: dur });
    }

    function seekToPercent(pct) {
        if (window.__BUILDER_PREVIEW__) return;
        var dur = (audio && audio.duration) || (typeof window.audioPlayer !== 'undefined' && window.audioPlayer && window.audioPlayer.duration) || 0;
        if (dur > 0) seekTo(pct * dur);
    }

    function setVolume(v) {
        if (window.__BUILDER_PREVIEW__) return;
        state.volume = Math.max(0, Math.min(1, v));
        if (audio) audio.volume = state.muted ? 0 : state.volume;
        if (gainNode && audioCtx) gainNode.gain.setValueAtTime(state.volume, audioCtx.currentTime);
        saveState();
        emit('volume', state.volume);
    }

    function toggleMute() {
        if (window.__BUILDER_PREVIEW__) return;
        state.muted = !state.muted;
        if (audio) audio.volume = state.muted ? 0 : state.volume;
        saveState();
        emit('mute', state.muted);
    }

    function setSpeed(s) {
        state.speed = Math.max(0.5, Math.min(3, s));
        if (audio) audio.playbackRate = state.speed;
        saveState();
        emit('speed', state.speed);
    }

    function toggleShuffle() {
        state.shuffle = !state.shuffle;
        saveState();
        emit('shuffle', state.shuffle);
    }

    function cycleRepeat() {
        const modes = ['off', 'all', 'one'];
        const idx = modes.indexOf(state.repeat);
        state.repeat = modes[(idx + 1) % modes.length];
        saveState();
        emit('repeat', state.repeat);
    }

    function addToQueue(tracks) {
        if (!Array.isArray(tracks)) tracks = [tracks];
        state.queue.push(...tracks);
        saveState();
        emit('queueChange', state.queue);
    }

    function removeFromQueue(index) {
        state.queue.splice(index, 1);
        if (index < state.queueIndex) state.queueIndex--;
        if (state.queueIndex >= state.queue.length) state.queueIndex = state.queue.length - 1;
        saveState();
        emit('queueChange', state.queue);
    }

    function reorderQueue(from, to) {
        const item = state.queue.splice(from, 1)[0];
        state.queue.splice(to, 0, item);
        if (state.queueIndex === from) state.queueIndex = to;
        else if (from < state.queueIndex && to >= state.queueIndex) state.queueIndex--;
        else if (from > state.queueIndex && to <= state.queueIndex) state.queueIndex++;
        saveState();
        emit('queueChange', state.queue);
    }

    function clearQueue() {
        state.queue = [];
        state.queueIndex = -1;
        saveState();
        emit('queueChange', state.queue);
    }

    function saveQueue() {
        try {
            localStorage.setItem('player_saved_queue', JSON.stringify({
                queue: state.queue,
                queueIndex: state.queueIndex,
                timestamp: Date.now()
            }));
        } catch (e) {}
    }

    function restoreQueue() {
        try {
            const saved = JSON.parse(localStorage.getItem('player_saved_queue') || '{}');
            if (saved.queue) {
                state.queue = saved.queue;
                state.queueIndex = saved.queueIndex || 0;
                emit('queueChange', state.queue);
                return true;
            }
        } catch (e) {}
        return false;
    }

    function addToRecentlyPlayed(track) {
        state.recentlyPlayed = state.recentlyPlayed.filter(t => t.id !== track.id);
        state.recentlyPlayed.unshift({ ...track, playedAt: Date.now() });
        if (state.recentlyPlayed.length > 100) state.recentlyPlayed = state.recentlyPlayed.slice(0, 100);
        saveState();
    }

    function toggleFavorite(track) {
        const id = track.id || track.name;
        const idx = state.favorites.findIndex(f => (f.id || f.name) === id);
        if (idx >= 0) {
            state.favorites.splice(idx, 1);
            emit('unfavorite', track);
        } else {
            state.favorites.push({ ...track, favoritedAt: Date.now() });
            emit('favorite', track);
        }
        saveState();
        return idx < 0;
    }

    function isFavorite(track) {
        const id = track.id || track.name;
        return state.favorites.some(f => (f.id || f.name) === id);
    }

    function setSleepTimer(minutes) {
        clearSleepTimer();
        if (minutes <= 0) return;
        state.sleepTimerMinutes = minutes;
        state.sleepTimer = setTimeout(() => {
            pause();
            emit('sleepTimerEnd', state);
        }, minutes * 60 * 1000);
        emit('sleepTimerStart', { minutes });
    }

    function clearSleepTimer() {
        if (state.sleepTimer) clearTimeout(state.sleepTimer);
        state.sleepTimer = null;
        state.sleepTimerMinutes = 0;
    }

    function setEqBand(index, gain) {
        if (eqFilters[index] && audioCtx) {
            eqFilters[index].gain.setValueAtTime(gain, audioCtx.currentTime);
        }
    }

    function getFrequencyData() {
        if (analyser && freqData) {
            analyser.getByteFrequencyData(freqData);
            return freqData;
        }
        return null;
    }

    function getTimeDomainData() {
        if (analyser && timeData) {
            analyser.getByteTimeDomainData(timeData);
            return timeData;
        }
        return null;
    }

    function getAudioElement() { return audio; }
    function getAudioContext() { return audioCtx; }
    function getAnalyser() { return analyser; }
    function getState() { return { ...state }; }

    let _saveInterval = null;

    function startSaveInterval() {
        if (_saveInterval) return;
        _saveInterval = setInterval(() => {
            if (state.isPlaying) saveStateImmediate();
        }, 30000);
    }

    function stopSaveInterval() {
        if (_saveInterval) { clearInterval(_saveInterval); _saveInterval = null; }
    }

    function init() {
        loadState();
        window.addEventListener('beforeunload', saveStateImmediate);
        startSaveInterval();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                saveStateImmediate();
            }
        });
    }

    return {
        init, on, emit,
        playTrack, play, pause, stop, togglePlay,
        playNext, playPrevious,
        seekTo, seekToPercent,
        setVolume, toggleMute, setSpeed,
        toggleShuffle, cycleRepeat,
        addToQueue, removeFromQueue, reorderQueue, clearQueue,
        saveQueue, restoreQueue,
        toggleFavorite, isFavorite,
        addToRecentlyPlayed,
        setSleepTimer, clearSleepTimer,
        setEqBand,
        getFrequencyData, getTimeDomainData,
        getAudioElement, getAudioContext, getAnalyser, getState,
        toggleAIAutomation, autoRecommendNext, cycleColorTheme, getColorTheme,
        saveState, saveStateImmediate,
        EQ_BANDS,
        get audio() { return audio; },
        get isPlaying() { return state.isPlaying; },
        get currentTrack() { return state.currentTrack; },
        get queue() { return state.queue; },
        get queueIndex() { return state.queueIndex; },
        get favorites() { return state.favorites; },
        get recentlyPlayed() { return state.recentlyPlayed; },
        get volume() { return state.volume; },
        get repeat() { return state.repeat; },
        get shuffle() { return state.shuffle; },
        get duration() { return audio ? audio.duration : 0; },
        get currentTime() { return audio ? audio.currentTime : 0; },
        get aiAutomation() { return state.aiAutomation; },
        get colorTheme() { return state.colorTheme; }
    };
})();
