'use strict';

/**
 * Voice AI Agent — Upgraded
 * - Works while music is playing
 * - Auto-arms when playback starts, disarms when paused/stopped
 * - Settings: enable/disable, wake word, timeout, language, sensitivity, TTS
 * - Tamil, English, Tanglish command support
 * - No background recording when disabled
 * - Stops mic immediately after command or timeout
 */
(() => {
    if (window.__VA_INSTALLED__) return;
    window.__VA_INSTALLED__ = true;

    // ─── Settings Keys ───
    const SETTINGS_KEY = 'va_agent_settings';
    const VOICE_TTS_KEY = 'va_tts_enabled';

    // ─── Default Settings ───
    const DEFAULTS = {
        enabled: true,
        wakeWord: 'hello',
        wakeTimeout: 15000,
        commandTimeout: 10000,
        language: 'en-IN',
        sensitivity: 'medium',
        ttsEnabled: true,
        autoArm: false,
        supportedCommands: ['next', 'previous', 'pause', 'play', 'volume', 'mute', 'fm', 'shuffle', 'repeat']
    };

    let _settings = { ...DEFAULTS };
    let _state = 'idle';
    let _activeStage = null;
    let _recognition = null;
    let _stageTimer = null;
    let _accum = '';
    let _handled = false;
    let _lastCmdAt = 0;
    let _tts = true;
    let _denied = false;
    let _root = null;
    let _trigger = null;
    let _bubble = null;
    let _bubbleTitle = null;
    let _bubbleHint = null;
    let _wave = null;
    let _autoArmListenerAttached = false;
    let _wasPlayingBeforeHide = false;

    // ─── Settings Management ───
    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
            if (saved && typeof saved === 'object') {
                _settings = { ...DEFAULTS, ...saved };
            }
        } catch (e) {}
        _tts = _settings.ttsEnabled;
        try { if (localStorage.getItem(VOICE_TTS_KEY) === '0') _tts = false; } catch (e) {}
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings));
            localStorage.setItem(VOICE_TTS_KEY, _tts ? '1' : '0');
        } catch (e) {}
    }

    function getSettings() {
        return { ..._settings };
    }

    function updateSettings(patch) {
        _settings = { ..._settings, ...patch };
        _tts = _settings.ttsEnabled;
        saveSettings();
        if (!_settings.enabled) {
            if (_state !== 'idle') deactivate();
            hideTrigger();
            if (_hookInterval) { clearInterval(_hookInterval); _hookInterval = null; }
        } else {
            showTrigger();
            setupAutoArm();
        }
    }

    const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;

    const norm = (t) => String(t || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const matchAny = (n, patterns) => {
        for (const p of patterns) {
            if (p.test(n)) return true;
        }
        return false;
    };

    const isPlaying = () => {
        const ap = window.audioPlayer;
        return !!(ap && !ap.paused);
    };

    const hasPlayback = () => !!(window.currentPlaybackTrack || window.currentStation) || !!(window.audioPlayer && window.audioPlayer.src);

    const feedback = (msg, type) => {
        if (typeof showToast === 'function') showToast(msg, type || 'info');
        if (_bubbleTitle) _bubbleTitle.textContent = msg;
        if (_bubbleHint) _bubbleHint.textContent = '';
        if (_tts) speakTiny(msg);
    };

    function speakTiny(text) {
        try {
            if (!('speechSynthesis' in window)) return;
            const safe = String(text || '').replace(/[^ a-zA-Z0-9.,]/g, ' ').slice(0, 90);
            if (!safe.trim()) return;
            const u = new SpeechSynthesisUtterance(safe);
            u.lang = _settings.language || 'en-IN';
            u.rate = 1.02;
            u.volume = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
        } catch (e) {}
    }

    const canUseVoice = () => {
        if (!_settings.enabled) return false;
        if (!getSpeechRecognition()) return false;
        if (_denied) return false;
        return true;
    };

    function stopRecognition() {
        clearTimeout(_stageTimer);
        if (_recognition) {
            const rec = _recognition;
            _recognition = null;
            try { rec.onresult = null; rec.onerror = null; rec.onend = null; rec.stop(); } catch (e) {}
        }
        _activeStage = null;
        _handled = false;
    }

    function abortAll() {
        stopRecognition();
        _accum = '';
        setState('idle');
    }

    function startListener(lang, stage, onFinal, onEnd) {
        stopRecognition();
        if (!_settings.enabled) return false;
        const SR = getSpeechRecognition();
        if (!SR) {
            setState('error', 'Voice AI is not supported on this browser.');
            return false;
        }
        let rec;
        try { rec = new SR(); } catch (e) {
            setState('error', 'Could not start voice input.');
            return false;
        }
        _recognition = rec;
        _activeStage = stage;
        _handled = false;
        _accum = '';
        rec.lang = lang;
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 3;

        const timeoutMs = stage === 'wake' ? _settings.wakeTimeout : _settings.commandTimeout;
        _stageTimer = setTimeout(() => {
            if (_activeStage === stage) {
                stopRecognition();
                if (stage === 'wake') {
                    setState('idle');
                    // Silent timeout for wake word — no annoying message
                } else if (!_handled) {
                    setState('idle');
                    feedback('Try "Next song" or "Play Dhanush hits".', 'info');
                }
            }
        }, timeoutMs);

        let interimBuffer = '';
        rec.onresult = (e) => {
            let gotFinal = false;
            let finalText = '';
            for (let i = Math.max(0, e.resultIndex); i < e.results.length; i++) {
                const res = e.results[i];
                const tx = (res && res[0]) ? (res[0].transcript || '') : '';
                if (res.isFinal) {
                    gotFinal = true;
                    finalText += ' ' + tx;
                } else {
                    interimBuffer += ' ' + tx;
                }
            }
            _accum = (_accum + ' ' + interimBuffer + (gotFinal ? ' ' + finalText : '')).replace(/\s+/g, ' ').trim();
            interimBuffer = '';
            if (gotFinal) {
                setBusyFeedback(stage);
                onFinal(_accum);
            } else if ((_accum + ' ' + interimBuffer).trim().length >= 2) {
                if (stage === 'command') setState('command-active');
                else setState('wake-active');
            }
        };

        const onEndHandler = () => {
            const endedFor = _activeStage;
            const hadText = _accum.trim().length > 0;
            if (endedFor === 'wake' && hadText) {
                stopRecognition();
                onFinal(_accum);
                return;
            }
            if (endedFor === 'command' && !_handled) {
                if (hadText) {
                    stopRecognition();
                    onFinal(_accum);
                } else {
                    stopRecognition();
                    onEnd();
                }
            }
        };
        rec.onend = onEndHandler;

        rec.onerror = (ev) => {
            const err = ev && ev.error;
            if (err === 'no-speech') {
                if (_activeStage === 'command' && !_handled && !_accum.trim()) {
                    _handled = true;
                    stopRecognition();
                    setState('idle');
                }
                return;
            }
            if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'permission-denied' || err === 'denied') {
                _denied = true;
                stopRecognition();
                setState('denied');
                feedback('Microphone permission is blocked. Enable it in browser settings.', 'error');
                return;
            }
            if (err === 'network') {
                stopRecognition();
                setState('idle');
                return;
            }
            if (err === 'aborted') {
                if (_activeStage) {
                    stopRecognition();
                    setState('idle');
                }
                return;
            }
            if (err === 'audio-capture') {
                stopRecognition();
                setState('idle');
                feedback('No microphone detected.', 'error');
                return;
            }
            stopRecognition();
            if (_activeStage) setState('idle');
        };

        try { rec.start(); } catch (e) {
            _recognition = null;
            _activeStage = null;
            setState('idle');
            return false;
        }
        return true;
    }

    function setBusyFeedback(stage) {
        if (stage === 'command') setState('command-active');
        else setState('wake-active');
    }

    // ─── Wake Word Detection ───
    const WAKE_TOKENS = ['hello', 'halo', 'hallo', 'hellow', 'hey', 'hai', 'hi', 'ஹலோ', 'ஹெலோ', 'ஹல்லோ', 'வணக்கம்'];

    function findWake(n) {
        const customWake = (_settings.wakeWord || 'hello').toLowerCase().split(',').map(s => s.trim());
        const allTokens = [...new Set([...WAKE_TOKENS, ...customWake])];
        const words = n.split(' ');
        for (const w of words) {
            if (allTokens.indexOf(w) !== -1) return true;
        }
        return false;
    }

    function textAfterWake(text, n) {
        const customWake = (_settings.wakeWord || 'hello').toLowerCase().split(',').map(s => s.trim());
        const allTokens = [...new Set([...WAKE_TOKENS, ...customWake])];
        const words = n.split(' ');
        const rawWords = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
        let idx = -1;
        for (let i = 0; i < words.length; i++) {
            if (allTokens.indexOf(words[i]) !== -1) { idx = i; break; }
        }
        if (idx === -1) return '';
        return rawWords.slice(idx + 1).join(' ');
    }

    function arm() {
        if (!canUseVoice()) {
            if (!_settings.enabled) return false;
            if (!getSpeechRecognition()) {
                setState('error', 'Voice AI is not supported on this browser.');
                return false;
            }
            if (_denied) {
                feedback('Microphone permission is blocked.', 'error');
                return false;
            }
            return false;
        }
        startWakeListening();
        return true;
    }

    function deactivate() {
        abortAll();
    }

    function startWakeListening() {
        if (!_settings.enabled) return;
        stopRecognition();
        setState('wake');
        startListener(_settings.language || 'en-IN', 'wake', (text) => {
            const n = norm(text);
            if (findWake(n)) {
                const rest = textAfterWake(text, n);
                const restNorm = norm(rest).replace(/\s+/g, '').replace(/^[.!?]+/, '');
                if (restNorm.length >= 2) {
                    executeCommand(rest);
                } else {
                    startCommandListening();
                }
            } else {
                // Silent — don't show error for non-wake words during auto-arm
                setState('idle');
            }
        }, () => {
            setState('idle');
        });
    }

    function startCommandListening() {
        if (!_settings.enabled) return;
        stopRecognition();
        setState('command');
        const lang = _settings.language === 'ta-IN' ? 'ta-IN' : (_settings.language || 'en-IN');
        startListener(lang, 'command', (text) => {
            _handled = true;
            stopRecognition();
            executeCommand(text);
        }, () => {
            setState('idle');
        });
    }

    // ─── Intent Patterns ───
    const INTENT_PATTERNS = {
        next: [/\bnext\b/, /\bnextsong\b/, /\badutha\b/, /\baduthu\b/, /\baduttha\b/, /\bskip\b/, /\bforward\b/, /\bஅடுத்த\b/, /\bஅடுத்த\s*பாடல்\b/, /\bஅடுத்த\s*song\b/],
        prev: [/\bprevious\b/, /\bprev\b/, /\bmunnadi\b/, /\bmunal\b/, /\bmunnaal\b/, /\bback\b/, /\breverse\b/, /\bgo previous\b/, /\bமுந்தைய\b/, /\bமுன்னாடி\b/],
        pause: [/\bpause\b/, /\bpause pannu\b/, /\bstop\b/, /\bstop the music\b/, /\bstop music\b/, /\bniruthu\b/, /\bniruthi\b/, /\bநிறுத்து\b/, /\bநிறுத்தி\b/],
        resume: [/\bresume\b/, /\bcontinue\b/, /\bplay pannu\b/, /\bstart pannu\b/, /\bpodhu\b/, /\bமீண்டும்\b/, /\bதொடரு\b/, /\bplay\b/],
        volUp: [/\b(volume|sound|oli|ஒலி)\s+(up|high|increase|max|louder)\b/, /\blouder\b/, /\bkeechu\b/, /\bsound high\b/, /\barakku\b/],
        volDown: [/\b(volume|sound|oli|ஒலி)\s+(down|low|decrease|reduce|lower)\b/, /\bquieter\b/, /\bkammi\b/],
        mute: [/\bmute\b/, /\bam samai\b/, /\bsound off\b/, /\bsilence\b/],
        fm: [/\bfm\b/, /\bradio\b/, /\bstation\b/, /\bரேடியோ\b/, /\bfm podu\b/, /\bradio podu\b/, /\bplay fm\b/, /\bplay radio\b/, /\b\d{2}(?:\.\d)?\s*fm\b/],
        shuffle: [/\bshuffle\b/, /\bmix\b/, /\bcshuffle\b/],
        repeat: [/\brepeat\b/, /\bloop\b/, /\bமீண்டும்\b/],
    };

    function executeCommand(text) {
        const now = Date.now();
        if (now - _lastCmdAt < 1400) return;
        _lastCmdAt = now;
        const raw = String(text || '');
        const n = norm(raw);

        if (matchAny(n, INTENT_PATTERNS.next)) {
            setState('thinking');
            window.playNextTrack();
            setState('idle');
            feedback('Playing the next song.', 'success');
            return;
        }
        if (matchAny(n, INTENT_PATTERNS.prev)) {
            setState('thinking');
            window.playPreviousTrack();
            setState('idle');
            feedback('Going back one song.', 'success');
            return;
        }
        if (matchAny(n, INTENT_PATTERNS.pause)) {
            if (isPlaying()) {
                setState('thinking');
                window.pausePlayback();
                setState('idle');
                feedback('Music paused.', 'success');
            } else {
                feedback('Nothing is playing right now.', 'info');
            }
            return;
        }
        if (matchAny(n, INTENT_PATTERNS.resume)) {
            if (!isPlaying()) {
                setState('thinking');
                window.togglePlayPause();
                setState('idle');
                feedback('Resuming music.', 'success');
            } else {
                feedback('Already playing.', 'info');
            }
            return;
        }
        if (matchAny(n, INTENT_PATTERNS.volUp)) {
            setState('thinking');
            adjustVolume(true);
            setState('idle');
            return;
        }
        if (matchAny(n, INTENT_PATTERNS.volDown)) {
            setState('thinking');
            adjustVolume(false);
            setState('idle');
            return;
        }
        if (matchAny(n, INTENT_PATTERNS.mute)) {
            toggleMute();
            return;
        }
        if (matchAny(n, INTENT_PATTERNS.fm)) {
            const fmWanted = extractFmTarget(raw);
            playFm(fmWanted);
            return;
        }
        if (matchAny(n, INTENT_PATTERNS.shuffle)) {
            setState('thinking');
            if (typeof window.toggleShuffle === 'function') window.toggleShuffle();
            setState('idle');
            feedback('Shuffle toggled.', 'success');
            return;
        }
        if (matchAny(n, INTENT_PATTERNS.repeat)) {
            setState('thinking');
            if (typeof window.toggleRepeat === 'function') window.toggleRepeat();
            setState('idle');
            feedback('Repeat toggled.', 'success');
            return;
        }
        // Bare "play" with playback active = toggle play/pause
        if (hasPlayback() && matchAny(n, [/\bplay\b/]) && n.replace(/\bplay\b/g, '').trim().length === 0) {
            setState('thinking');
            window.togglePlayPause();
            setState('idle');
            feedback(isPlaying() ? 'Playing.' : 'Paused.', 'success');
            return;
        }
        requestTarget(raw);
    }

    function adjustVolume(up) {
        const ap = window.audioPlayer;
        const cur = (ap && typeof ap.volume === 'number') ? ap.volume : 1;
        const next = up ? Math.min(1, cur + 0.15) : Math.max(0, cur - 0.15);
        if (typeof window.setPlaybackVolume === 'function') window.setPlaybackVolume(next);
        else if (ap) { try { ap.volume = next; } catch (e) {} }
        feedback(up ? 'Volume up.' : 'Volume down.', 'success');
    }

    function toggleMute() {
        const ap = window.audioPlayer;
        if (!ap) { feedback('No player active.', 'info'); return; }
        try { ap.muted = !ap.muted; feedback(ap.muted ? 'Muted.' : 'Unmuted.', 'success'); } catch (e) {}
        setState('idle');
    }

    function extractFmTarget(raw) {
        return raw.replace(/\bfm\b/gi, '').replace(/\b(play|radio|podu|podunga|station)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    }

    // ─── Song Matching ───
    const PLAY_WORDS = ['play', 'podu', 'poadu', 'podunga', 'podhu', 'poot', 'pla', 'poru', 'boattu', 'potru', 'potu', 'vai', 'podungo', 'poadunga', 'play pannu', 'play podu', 'song', 'songs', 'music', 'hits', 'hit', 'pattu', 'patta', 'paatu', 'padam', 'kele', 'kelo', 'vaanga', 'vaa'];
    const STRIP_WORDS = ['play', 'songs', 'song', 'music', 'podunga', 'podu', 'poadu', 'podhu', 'poddu', 'pattugal', 'hits', 'hit', 'please', 'the', 'some', 'for', 'kaka', 'gimme', 'give', 'me', 'a', 'an', 'vaanga', 'panni', 'pannu', 'podu da', 'podu ma', 'boattu', 'vecha', 'vai', 'poru', 'poadunga', 'podunga'];

    function stripTarget(text) {
        const n = norm(text);
        let out = n;
        for (const w of STRIP_WORDS) {
            out = out.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), ' ');
        }
        return out.replace(/\s+/g, ' ').trim();
    }

    function findArtist(wanted, songs) {
        const wk = norm(wanted);
        const list = songs && songs.length ? songs : (window.DataStore && typeof window.DataStore.getSongs === 'function' ? window.DataStore.getSongs() : []);
        const ranked = [];
        for (const s of list) {
            const artist = String(s.artist || '').toLowerCase();
            const movie = String(s.movie || '').toLowerCase();
            const title = String(s.title || '').toLowerCase();
            const tokens = wk.split(' ');
            let score = 0;
            for (const t of tokens) {
                if (t.length < 2) continue;
                if (artist.indexOf(t) !== -1) score += t.length * 2;
                if (movie.indexOf(t) !== -1 && t.length > 3) score += t.length;
                if (title.indexOf(t) !== -1 && t.length > 3) score += Math.floor(t.length / 2);
            }
            if (score > 0) ranked.push({ s, score });
        }
        ranked.sort((a, b) => b.score - a.score);
        const artistSet = {};
        const ordered = [];
        for (const r of ranked) {
            const key = String(r.s.artist || 'unknown').toLowerCase();
            if (!artistSet[key]) { artistSet[key] = true; ordered.push(r.s.artist || 'unknown'); }
            if (ordered.length >= 12) break;
        }
        return { ranked, artists: ordered };
    }

    function playArtistSongs(artistName, ranked) {
        const gathered = ranked.map(r => r.s);
        if (gathered.length) {
            feedback('Playing ' + artistName + ' songs.', 'success');
            playSongList(gathered);
        }
    }

    function findMoodOrDecade(target, songs) {
        const moods = ['love', 'romantic', 'sad', 'happy', 'party', 'chill', 'workout', 'devotional', 'classical', 'folk', 'rock', 'melody', 'evergreen', 'energetic', 'peaceful', 'romance', 'kuthu', 'karakattam'];
        const decades = ['80s', '90s', '2000s', '2k', '80', '90', '2000', '70s', '60s'];
        const list = songs && songs.length ? songs : (window.DataStore && typeof window.DataStore.getSongs === 'function' ? window.DataStore.getSongs() : []);
        for (const m of moods) {
            if (target.indexOf(m) !== -1) {
                const matched = list.filter(s => {
                    const txt = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.genre || '') + ' ' + (s.mood || '') + ' ' + (s.tags || '') + ' ' + (s.movie || '')).toLowerCase();
                    return txt.indexOf(m) !== -1 && (s.audioUrl || s.streamUrl);
                });
                if (matched.length >= 2) return { type: 'mood', key: m, songs: matched };
            }
        }
        for (const d of decades) {
            if (target.indexOf(d) !== -1) {
                const decadeNum = parseInt(d);
                const matched = list.filter(s => {
                    const yr = parseInt(String(s.year || s.releaseYear || ''));
                    if (isNaN(yr)) return false;
                    return yr >= decadeNum && yr < decadeNum + 10 && (s.audioUrl || s.streamUrl);
                });
                if (matched.length >= 2) return { type: 'decade', key: d, songs: matched };
            }
        }
        return null;
    }

    function findPlaylist(target) {
        if (window.DataStore && typeof window.DataStore.getStations === 'function') {
            const stations = window.DataStore.getStations();
            for (const s of stations) {
                const name = norm(s.name || '');
                const words = target.split(' ');
                let score = 0;
                for (const w of words) { if (w.length > 1 && name.indexOf(w) !== -1) score += w.length; }
                if (score >= 3) return { key: s.name, songs: [{ ...s, audioUrl: s.streamUrl || s.url }] };
            }
        }
        return null;
    }

    function findCollection(target) {
        const collections = window.DataStore && typeof window.DataStore.getSongsCollections === 'function' ? window.DataStore.getSongsCollections() : [];
        for (const c of collections) {
            const name = norm(c.name || c.title || '');
            const words = target.split(' ');
            let score = 0;
            for (const w of words) { if (w.length > 1 && name.indexOf(w) !== -1) score += w.length; }
            if (score >= 3 && c.songs && c.songs.length) return { key: c.name || c.title, songs: c.songs };
        }
        return null;
    }

    function findTitle(target, songs) {
        const list = songs && songs.length ? songs : (window.DataStore && typeof window.DataStore.getSongs === 'function' ? window.DataStore.getSongs() : []);
        const words = target.split(' ').filter(w => w.length > 2);
        const scored = [];
        for (const s of list) {
            const title = norm(s.title || '');
            let score = 0;
            for (const w of words) { if (title.indexOf(w) !== -1) score += w.length; }
            if (score >= 3) scored.push({ s, score, key: s.title });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.length ? scored[0] : null;
    }

    function playSongList(songList) {
        if (!songList || !songList.length) return false;
        setState('thinking');
        window.playSong(songList[0], songList);
        setState('idle');
        return true;
    }

    function resolveStation(wanted) {
        const wk = String(wanted || '').toLowerCase();
        const stations = window.DataStore && typeof window.DataStore.getStations === 'function' ? window.DataStore.getStations() : [];
        const list = stations.filter(s => s && (s.streamUrl || s.url));
        if (!list.length) return null;
        let best = null;
        let bestScore = 0;
        for (const s of list) {
            const hay = norm((s.name || '') + ' ' + (s.category || '') + ' ' + (s.city || '') + ' ' + (s.language || '') + ' ' + (s.genre || ''));
            const words = wk.split(' ').filter(w => w.length > 1);
            let score = 0;
            for (const w of words) { if (hay.indexOf(w) !== -1) score += w.length; }
            if (score > bestScore) { bestScore = score; best = s; }
        }
        return best && bestScore > 0 ? best : null;
    }

    function playFm(wanted) {
        const pending = resolveStation(wanted);
        let text;
        if (!pending) {
            const stations = window.DataStore && typeof window.DataStore.getStations === 'function' ? window.DataStore.getStations() : [];
            const first = stations.find(s => s && (s.streamUrl || s.url));
            if (!first) { feedback('No FM stations available.', 'error'); setState('idle'); return; }
            text = 'Starting ' + (first.name || 'FM') + '.';
            setState('thinking');
            window.playStation(first.name, first.id);
        } else {
            text = 'Playing ' + (pending.name || 'FM') + '.';
            setState('thinking');
            window.playStation(pending.name, pending.id);
        }
        feedback(text, 'success');
        setState('idle');
    }

    function requestTarget(raw) {
        const target = stripTarget(raw);
        if (!target) {
            feedback('Say "Next song" or "Play Dhanush hits".', 'info');
            setState('idle');
            return;
        }
        const songs = window.DataStore && typeof window.DataStore.getSongs === 'function' ? window.DataStore.getSongs() : [];

        const asPlaylist = findPlaylist(target);
        if (asPlaylist) { setState('thinking'); feedback('Found ' + asPlaylist.key + '.', 'success'); playSongList(asPlaylist.songs); setState('idle'); return; }

        const moodHit = findMoodOrDecade(target, songs);
        if (moodHit) { setState('thinking'); feedback(moodHit.key + ' songs coming up.', 'success'); playSongList(moodHit.songs); setState('idle'); return; }

        const artistRes = findArtist(target, songs);
        if (artistRes && artistRes.ranked.length >= 2) { setState('thinking'); playArtistSongs(artistRes.artists[0], artistRes.ranked); setState('idle'); return; }

        const coll = findCollection(target);
        if (coll) { setState('thinking'); feedback('Playing ' + coll.key + '.', 'success'); playSongList(coll.songs); setState('idle'); return; }

        const titleHit = findTitle(target, songs);
        if (titleHit) { setState('thinking'); feedback('Playing ' + titleHit.key + '.', 'success'); playSongList([titleHit.s]); setState('idle'); return; }

        const anyList = songs.filter(s => s && (s.audioUrl || s.streamUrl));
        if (anyList.length) { setState('thinking'); feedback('Playing top songs.', 'info'); playSongList(anyList.slice(0, 10)); setState('idle'); return; }

        setState('idle');
        feedback('No match for "' + target + '".', 'error');
    }

    // ─── State & UI ───
    function setState(state, msg) {
        _state = state;
        if (!_root) return;
        _root.className = 'va-root';
        if (state !== 'idle') {
            if (state === 'wake') _root.classList.add('is-wake');
            else if (state === 'wake-active') _root.classList.add('is-wake', 'is-active');
            else if (state === 'command') _root.classList.add('is-command');
            else if (state === 'command-active') _root.classList.add('is-command', 'is-active');
            else if (state === 'thinking') _root.classList.add('is-thinking', 'is-active');
            else if (state === 'error') _root.classList.add('is-error');
            else if (state === 'denied') _root.classList.add('is-denied');
            else _root.classList.add('is-active');
        }
        if (msg && _bubbleTitle) _bubbleTitle.textContent = msg;
        updateBubble();
    }

    function updateBubble() {
        if (!_root || !_bubble) return;
        if (_state === 'idle') {
            _bubble.classList.remove('va-show');
            _bubbleTitle.textContent = 'Voice AI';
        } else if (_state === 'wake' || _state === 'wake-active') {
            _bubble.classList.add('va-show');
            _bubbleTitle.textContent = 'Listening...';
            _bubbleHint.textContent = 'Say "' + (_settings.wakeWord || 'Hello') + '" to activate';
        } else if (_state === 'command' || _state === 'command-active') {
            _bubble.classList.add('va-show');
            _bubbleTitle.textContent = 'Listening for command';
            _bubbleHint.textContent = 'Say: Next • Previous • Pause • Play • Volume';
        } else if (_state === 'thinking') {
            _bubble.classList.add('va-show');
            _bubbleTitle.textContent = 'Working...';
            _bubbleHint.textContent = '';
        } else if (_state === 'error' || _state === 'denied') {
            _bubble.classList.add('va-show');
            _bubbleTitle.textContent = 'Voice AI';
            _bubbleHint.textContent = '';
        }
    }

    function onTriggerTap() {
        if (_state === 'wake' || _state === 'wake-active' || _state === 'command' || _state === 'command-active') {
            abortAll();
            return;
        }
        arm();
    }

    function reposition() {
        if (!_root) return;
        const bar = document.querySelector('.up-bottom-bar.visible');
        const full = document.body.classList.contains('up-fullscreen-open');
        if (full) { _root.style.display = 'none'; return; }
        _root.style.display = '';
        let pad = 72;
        if (bar) {
            const r = bar.getBoundingClientRect();
            if (r.top > 0) pad = window.innerHeight - r.top + 12;
        }
        _root.style.bottom = pad + 'px';
    }

    function showTrigger() {
        if (_trigger) _trigger.style.display = '';
        if (_root) _root.style.display = '';
    }

    function hideTrigger() {
        if (_trigger) _trigger.style.display = 'none';
        if (_bubble) _bubble.classList.remove('va-show');
    }

    function ensureDom() {
        if (document.getElementById('vaRoot')) {
            _root = document.getElementById('vaRoot');
            _trigger = document.getElementById('vaTrigger');
            _bubble = document.getElementById('vaBubble');
            _bubbleTitle = document.getElementById('vaBubbleTitle');
            _bubbleHint = document.getElementById('vaBubbleHint');
            _wave = document.getElementById('vaWave');
            return;
        }
        _root = document.createElement('div');
        _root.id = 'vaRoot';
        _root.className = 'va-root';

        _bubble = document.createElement('div');
        _bubble.id = 'vaBubble';
        _bubble.className = 'va-bubble';
        _bubbleTitle = document.createElement('div');
        _bubbleTitle.id = 'vaBubbleTitle';
        _bubbleTitle.className = 'va-bubble-title';
        _bubbleHint = document.createElement('div');
        _bubbleHint.id = 'vaBubbleHint';
        _bubbleHint.className = 'va-bubble-hint';
        _bubble.appendChild(_bubbleTitle);
        _bubble.appendChild(_bubbleHint);

        _trigger = document.createElement('button');
        _trigger.id = 'vaTrigger';
        _trigger.className = 'va-trigger';
        _trigger.type = 'button';
        _trigger.setAttribute('aria-label', 'Voice AI assistant');
        _trigger.setAttribute('title', 'Voice AI - say Hello');

        _wave = document.createElement('span');
        _wave.id = 'vaWave';
        _wave.className = 'va-wave';
        _wave.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';

        const icon = document.createElement('i');
        icon.className = 'fas fa-microphone va-icon';
        _trigger.appendChild(icon);
        _trigger.appendChild(_wave);

        _root.appendChild(_bubble);
        _root.appendChild(_trigger);
        document.body.appendChild(_root);

        _trigger.addEventListener('click', onTriggerTap);
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition);
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('pagehide', abortAll);
        reposition();

        // Show/hide based on settings
        if (!_settings.enabled) hideTrigger();
    }

    // ─── Audio Hooks (disarm mic on pause/stop only — NO auto-arm on play) ───
    let _hookInterval = null;

    function setupAutoArm() {
        if (_autoArmListenerAttached) return;
        _autoArmListenerAttached = true;

        const hookAudio = () => {
            const ap = window.audioPlayer;
            if (ap && !ap._vaHooked) {
                ap._vaHooked = true;
                ap.addEventListener('pause', () => {
                    if (_state === 'wake' || _state === 'wake-active' || _state === 'command' || _state === 'command-active') {
                        abortAll();
                    }
                });
                ap.addEventListener('ended', () => {
                    if (_state === 'wake' || _state === 'wake-active' || _state === 'command' || _state === 'command-active') {
                        abortAll();
                    }
                });
            }
        };
        hookAudio();
        if (_hookInterval) clearInterval(_hookInterval);
        _hookInterval = setInterval(hookAudio, 3000);
    }

    function onVisibilityChange() {
        if (document.hidden) {
            _wasPlayingBeforeHide = isPlaying();
            // Stop mic when page is hidden — do NOT auto-arm on return
            if (_state !== 'idle') abortAll();
        }
        // NO auto-arm on visibility return — mic must only be activated by explicit user action
    }

    function injectCss() {
        if (document.getElementById('va-ai-style')) return;
        const style = document.createElement('style');
        style.id = 'va-ai-style';
        style.textContent = [
            '.va-root{position:fixed;right:12px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none;transition:bottom .25s ease,display .25s ease;}',
            '.va-root .va-trigger{pointer-events:auto;position:relative;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;color:#fff;background:radial-gradient(circle at 30% 25%,#10b981,#0d9488 40%,#7c3aed);box-shadow:0 8px 28px rgba(16,185,129,.45),0 0 0 1px rgba(255,255,255,.12) inset;display:flex;align-items:center;justify-content:center;font-size:22px;outline:none;-webkit-tap-highlight-color:transparent;}',
            '.va-root .va-trigger:hover{transform:scale(1.06);}',
            '.va-root .va-trigger:active{transform:scale(.95);}',
            '.va-root .va-icon{pointer-events:none;}',
            '.va-root .va-wave{position:absolute;inset:-14px;display:flex;align-items:center;justify-content:center;gap:3px;opacity:0;pointer-events:none;}',
            '.va-root .va-wave i{display:block;width:3px;height:10px;border-radius:2px;background:#22d3ee;}',
            '.va-root.is-active .va-wave{opacity:1;}',
            '.va-root.is-active .va-wave i:nth-child(1){animation:vaWave .9s ease-in-out infinite;}',
            '.va-root.is-active .va-wave i:nth-child(2){animation:vaWave 1.1s ease-in-out infinite .1s;}',
            '.va-root.is-active .va-wave i:nth-child(3){animation:vaWave .8s ease-in-out infinite .2s;}',
            '.va-root.is-active .va-wave i:nth-child(4){animation:vaWave 1s ease-in-out infinite .05s;}',
            '.va-root.is-active .va-wave i:nth-child(5){animation:vaWave 1.2s ease-in-out infinite .15s;}',
            '@keyframes vaWave{0%,100%{transform:scaleY(.4);}50%{transform:scaleY(1.6);}}',
            '.va-root.is-error .va-trigger{background:radial-gradient(circle at 30% 25%,#f87171,#dc2626);box-shadow:0 8px 28px rgba(239,68,68,.45);}',
            '.va-root.is-denied .va-trigger{background:radial-gradient(circle at 30% 25%,#fbbf24,#d97706);box-shadow:0 8px 28px rgba(245,158,11,.45);}',
            '.va-bubble{pointer-events:none;max-width:250px;background:rgba(10,12,24,.92);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:14px 14px 4px 14px;padding:8px 12px;box-shadow:0 10px 30px rgba(0,0,0,.35);opacity:0;transform:translateY(8px) scale(.96);transition:opacity .2s ease,transform .2s ease;backdrop-filter:blur(8px);}',
            '.va-bubble.va-show{opacity:1;transform:translateY(0) scale(1);}',
            '.va-bubble-title{font-size:13px;font-weight:700;line-height:1.25;}',
            '.va-bubble-hint{font-size:11px;color:#a5f3fc;margin-top:2px;line-height:1.3;}',
        ].join('');
        document.head.appendChild(style);
    }

    function init() {
        if (window.__BUILDER_PREVIEW__) return;
        loadSettings();
        injectCss();
        ensureDom();
        setupAutoArm();
    }

    // ─── Global API ───
    window.VoiceAIBot = {
        init,
        arm,
        deactivate,
        isActive: () => _state !== 'idle',
        isDisabled: () => !_settings.enabled,
        isListening: () => _state === 'wake' || _state === 'wake-active' || _state === 'command' || _state === 'command-active',
        setTts: (on) => { _tts = !!on; _settings.ttsEnabled = _tts; saveSettings(); },
        getState: () => _state,
        getSettings,
        updateSettings,
        getSettingsRaw: () => ({ ..._settings }),
        // Explicit mic control — only activate via user action
        micOn: () => {
            if (!_settings.enabled) return false;
            return arm();
        },
        micOff: () => {
            abortAll();
            return true;
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
