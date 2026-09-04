'use strict';

(() => {
    if (window.__VA_INSTALLED__) return;
    window.__VA_INSTALLED__ = true;

    const VOICE_TTS_KEY = 'va_tts_enabled';
    const VOICE_CONSENT_KEY = 'va_consent_granted';

    const CONFIG = {
        WAKE_WINDOW_MS: 15000,
        COMMAND_WINDOW_MS: 10000,
        COOLDOWN_MS: 1400,
        MIN_INTERIM_CHARS: 2,
    };

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

    try { _tts = localStorage.getItem(VOICE_TTS_KEY) !== '0'; } catch (e) {}

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

    const activeKey = () => {
        const t = window.currentPlaybackTrack;
        if (t && (t.id || t.title)) return 's:' + (t.id || t.title);
        if (window.currentStation) return 'fm:' + String(window.currentStation).toLowerCase();
        return '';
    };

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
            u.lang = 'en-IN';
            u.rate = 1.02;
            u.volume = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
        } catch (e) {}
    }

    const canUseVoice = () => {
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

        let withTimedWindow = true;
        _stageTimer = setTimeout(() => {
            if (_activeStage === stage) {
                stopRecognition();
                if (stage === 'wake') {
                    setState('idle');
                    feedback('Time up. Tap the mic and say "Hello" when you are ready.', 'info');
                } else if (!_handled) {
                    setState('idle');
                    feedback('Time up. Try "Next song" or "Play Dhanush hits".', 'info');
                }
            }
        }, stage === 'wake' ? CONFIG.WAKE_WINDOW_MS : CONFIG.COMMAND_WINDOW_MS);

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
            } else if ((_accum + ' ' + interimBuffer).trim().length >= CONFIG.MIN_INTERIM_CHARS) {
                if (stage === 'command') setState('command-active');
                else setState('wake-active');
            }
        };

        const rearm = () => {
            try {
                const rr = _recognition;
                rec.onend = null;
                if (rr) { try { rr.stop(); } catch (e) {} }
                rec.onend = onEndHandler;
                rec.start();
            } catch (e) {}
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
                    feedback('I did not catch that. Try "Next song" or "Play Dhanush hits".', 'info');
                }
                return;
            }
            if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'permission-denied' || err === 'denied') {
                _denied = true;
                stopRecognition();
                setState('denied');
                feedback('Microphone permission is blocked. Enable it in browser settings and tap Voice AI again.', 'error');
                return;
            }
            if (err === 'network') {
                stopRecognition();
                setState('idle');
                feedback('Voice recognition network error. Check your connection and try again.', 'error');
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
                feedback('No microphone detected. Plug in a mic or headphones and try again.', 'error');
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

    const WAKE_TOKENS = ['hello', 'halo', 'hallo', 'hellow', 'hey', 'hai', 'hi', 'halo', 'ஹலோ', 'ஹெலோ', 'ஹல்லோ', 'வணக்கம்'];

    function findWake(n) {
        const words = n.split(' ');
        for (const w of words) {
            if (WAKE_TOKENS.indexOf(w) !== -1) return true;
        }
        return false;
    }

    function textAfterWake(text, n) {
        const words = n.split(' ');
        const rawWords = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
        let idx = -1;
        for (let i = 0; i < words.length; i++) {
            if (WAKE_TOKENS.indexOf(words[i]) !== -1) { idx = i; break; }
        }
        if (idx === -1) return '';
        return rawWords.slice(idx + 1).join(' ');
    }

    function arm() {
        if (!canUseVoice()) {
            if (!getSpeechRecognition()) {
                setState('error', 'Voice AI is not supported on this browser.');
                return false;
            }
            if (_denied) {
                feedback('Microphone permission is blocked. Enable it in browser settings.', 'error');
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
        stopRecognition();
        setState('wake');
        startListener('en-IN', 'wake', (text) => {
            const n = norm(text);
            if (findWake(n)) {
                const rest = textAfterWake(text, n);
                const restNorm = norm(rest).replace(/\s+/g, '').replace(/^[.!?]+/, '');
                if (restNorm.length >= CONFIG.MIN_INTERIM_CHARS) {
                    executeCommand(rest);
                } else {
                    startCommandListening();
                }
            } else {
                feedback('I did not hear "Hello". Say "Hello" to activate me.', 'info');
                setState('idle');
            }
        }, () => {
            setState('idle');
        });
    }

    function startCommandListening() {
        stopRecognition();
        setState('command');
        startListener('ta-IN', 'command', (text) => {
            _handled = true;
            stopRecognition();
            executeCommand(text);
        }, () => {
            setState('idle');
            feedback('I did not catch that. Try "Next song" or "Play Dhanush hits".', 'info');
        });
    }

    const FM_WORDS = ['fm', 'radio', 'station', 'radio', 'radiyo', 'reydiyo', 'ridio', 'rally', 'रडियो', 'ரேடியோ', 'ரேடியோவ'];

    const FREQ_RE = /\b(\d{2}(?:\.\d)?)\s*(?:fm|radio)?\b/;

    function resolveStation(wanted) {
        const wk = String(wanted || '').toLowerCase();
        const stations = window.DataStore && typeof window.DataStore.getStations === 'function' ? window.DataStore.getStations() : [];
        const list = stations.filter((s) => s && (s.streamUrl || s.url));
        if (!list.length) return null;
        const freqMatch = wk.match(FREQ_RE);
        if (freqMatch) {
            const target = parseFloat(freqMatch[1]);
            let best = null;
            let bestDiff = Infinity;
            for (const s of list) {
                const v = parseFloat(String(s.frequency || s.freq || '').replace(/[^0-9.]/g, ''));
                if (!isNaN(v)) {
                    const d = Math.abs(v - target);
                    if (d < bestDiff) { bestDiff = d; best = s; }
                }
            }
            if (best) return best;
            for (const s of list) {
                const v = parseFloat(String(s.frequency || s.freq || '').replace(/[^0-9.]/g, ''));
                if (!isNaN(v) && String(s.frequency || s.freq || '').indexOf(freqMatch[1]) !== -1) return s;
            }
        }
        let best = null;
        let bestScore = 0;
        for (const s of list) {
            const hay = norm((s.name || '') + ' ' + (s.category || '') + ' ' + (s.city || '') + ' ' + (s.language || '') + ' ' + (s.genre || ''));
            const words = wk.split(' ').filter((w) => w.length > 1);
            let score = 0;
            for (const w of words) {
                if (hay.indexOf(w) !== -1) score += w.length;
            }
            if (score > bestScore) { bestScore = score; best = s; }
        }
        if (best && bestScore > 0) return best;
        return null;
    }

    function playFm(wanted) {
        const pending = resolveStation(wanted);
        let text;
        if (!pending) {
            const stations = window.DataStore && typeof window.DataStore.getStations === 'function' ? window.DataStore.getStations() : [];
            const first = stations.find((s) => s && (s.streamUrl || s.url));
            if (!first) {
                feedback('No FM stations available to play right now.', 'error');
                setState('idle');
                return;
            }
            text = 'FM station not found, starting ' + (first.name || 'FM') + ' instead.';
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

    const PLAY_WORDS = [
        'play', 'podu', 'poadu', 'podunga', 'podhu', 'poot', 'poddu', 'pla', 'poru', 'podu',
        'boattu', 'potru', 'potu', 'vai', 'podungo', 'poadunga', 'podunga', 'play pannu', 'play podu',
        'play the', 'please play', 'i want', 'want to hear', 'let me hear', 'play some', 'play song',
        'play songs', 'music podu', 'songs podu', 'pattu podu', 'patta podu', 'pattugal', 'pattugal podu',
        'padaal', 'padaal podu', 'padaalu', 'pattugal', 'pattal', 'geet', 'gaane', 'song', 'songs',
        'songu', 'music', 'hits', 'hit', 'hit songs', 'pattu', 'patta', 'pathu', 'paatu', 'padam',
        'kele', 'kelo', 'kaka', 'vaanga', 'vaa', 'veer', 'tha', 'sense', 'panni', 'pannu',
    ];

    const STRIP_WORDS = ['play', 'songs', 'song', 'music', 'podunga', 'podu', 'poadu', 'podhu', 'poddu',
        'pattugal', 'hits', 'hit', 'please', 'the', 'some', 'for', 'kaka', 'kaetu', 'gimme', 'give',
        'me', 'a', 'an', 'vaanga', 'panni', 'pannu', 'pannunga', 'podu da', 'podu ma', 'boattu',
        'vecha', 'vai', 'poru', 'poadunga', 'podunga'];

    function stripTarget(text) {
        const raw = String(text || '');
        const n = norm(raw);
        let out = n;
        for (const w of STRIP_WORDS) {
            out = out.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), ' ');
        }
        out = out.replace(/\blove songs?\b/g, ' love ');
        out = out.replace(/\bmelody songs?\b/g, ' melody ');
        out = out.replace(/\bdevotional songs?\b/g, ' devotional ');
        out = out.replace(/\bsad songs?\b/g, ' sad ');
        out = out.replace(/\bhappy songs?\b/g, ' happy ');
        out = out.replace(/\bparty songs?\b/g, ' party ');
        out = out.replace(/\bchill songs?\b/g, ' chill ');
        out = out.replace(/\bworkout songs?\b/g, ' workout ');
        out = out.replace(/\bclassical songs?\b/g, ' classical ');
        out = out.replace(/\bfolk songs?\b/g, ' folk ');
        out = out.replace(/\brock songs?\b/g, ' rock ');
        out = out.replace(/\bevergreen songs?\b/g, ' evergreen ');
        out = out.replace(/\b90s songs?\b/g, ' 90s ');
        out = out.replace(/\b80s songs?\b/g, ' 80s ');
        out = out.replace(/\b2k songs?\b/g, ' 2k ');
        return out.replace(/\s+/g, ' ').replace(/'s/g, ' s').trim();
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
            if (score > 0) {
                ranked.push({ s: s, score: score });
            }
        }
        ranked.sort((a, b) => b.score - a.score);
        const artistSet = {};
        const ordered = [];
        for (const r of ranked) {
            const key = String(r.s.artist || 'unknown').toLowerCase();
            if (!artistSet[key]) {
                artistSet[key] = true;
                ordered.push(r.s.artist || 'unknown');
            }
            if (ordered.length >= 12) break;
        }
        return { ranked: ranked, artists: ordered };
    }

    function playArtistSongs(artistName, ranked) {
        const gathered = ranked.map((r) => r.s);
        if (!gathered.length) return false;
        setState('thinking');
        feedback('Playing ' + artistName + ' hit songs.', 'success');
        window.playSong(gathered[0], gathered);
        setState('idle');
        return true;
    }

    const MOOD_PATTERNS = {
        love: [/\blove\b/, /\bkadhal\b/, /\bkadhala\b/, /\bkadal\b/, /\bromance\b/, /\bromantic\b/, /\bromantic songs\b/, /\bகாதல்\b/, /\bகாதலா\b/],
        melody: [/\bmelody\b/, /\bmelodies\b/, /\bsoft\b/, /\bcalm\b/, /\bsoothing\b/, /\bமெலடி\b/, /\bமெல்ல\b/],
        devotional: [/\bdevotional\b/, /\bbhakti\b/, /\bspiritual\b/, /\bdevotion\b/, /\bgods\b/, /\bgod\b/, /\bganesha\b/, /\bshiva\b/, /\bvishnu\b/, /\bamma\b/, /\banjaneya\b/, /\bmaria\b/, /\bambal\b/, /\bபக்தி\b/, /\bதெய்வம்\b/],
        sad: [/\bsad\b/, /\bsorrow\b/, /\bcry\b/, /\bweep\b/, /\bheartbreak\b/, /\bmiss\b/, /\bsob\b/, /\bdukkha\b/, /\bvivaham\b/, /\bமனசு\b/],
        happy: [/\bhappy\b/, /\bcheer\b/, /\bjoy\b/, /\bjoyful\b/, /\bfun\b/, /\buplift\b/, /\bsantosham\b/, /\bsantosh\b/],
        party: [/\bparty\b/, /\bcelebrations?\b/, /\bcelebration\b/, /\bkuthu\b/, /\bmass\b/, /\bbeat\b/, /\bdisco\b/, /\bdance\b/, /\bpunda\b/, /\bமாஸ்\b/, /\bகுத்து\b/],
        chill: [/\bchill\b/, /\bchill out\b/, /\brelax\b/, /\bpeaceful\b/, /\blower\b/, /\bcalm\b/, /\bsoft\b/],
        workout: [/\bworkout\b/, /\bexercise\b/, /\bgym\b/, /\bitrain\b/, /\bpump\b/, /\bcardio\b/],
        classical: [/\bclassical\b/, /\bcarnatic\b/, /\bbharatham\b/, /\btraditional\b/, /\bமெட்ராஸ்\b/, /\bபாரம்பரிய\b/, /\bசென்னை\b/],
        folk: [/\bfolk\b/, /\bsueli\b/, /\brural\b/, /\bgrama\b/, /\bgena\b/, /\bநாட்டுப்புற\b/],
        rock: [/\brock\b/, /\bmetal\b/, /\bloud\b/, /\bthunder\b/, /\bred\b/],
        evergreen: [/\bevergreen\b/, /\bold\b/, /\bretro\b/, /\bvintage\b/, /\bclassic\b/, /\bnostalgia\b/, /\bமறை\b/],
    };

    const DECADE_PATTERNS = {
        '90s': [/\b90s\b/, /\b90 s\b/, /\b90\b/, /\bnineties\b/, /\b1990\b/, /\b1995\b/, /\b1999\b/, /\bஐந்து\b/],
        '80s': [/\b80s\b/, /\b80 s\b/, /\beighties\b/, /\b1980\b/, /\b1985\b/, /\b1989\b/],
        '2k': [/\b2000s\b/, /\b2k\b/, /\b2 k\b/, /\btwo thousand\b/, /\b2000 2010\b/, /\b2ks\b/],
    };

    function songMatches(s, moodKey) {
        const year = String(s.year || '');
        const decade = String(s.decade || '');
        const movie = String(s.movie || '');
        const album = String(s.album || '');
        const title = String(s.title || '');
        const artist = String(s.artist || '');
        if (moodKey === '90s') {
            return decade === '90s' || /^199\d$/.test(year) || /\b(199[0-9])\b/.test(movie) || /\b(199[0-9])\b/.test(album) || /\b(199[0-9])\b/.test(title);
        }
        if (moodKey === '80s') {
            return decade === '80s' || /^198\d$/.test(year) || /\b(198[0-9])\b/.test(movie) || /\b(198[0-9])\b/.test(album);
        }
        if (moodKey === '2k') {
            return decade === '2000s' || decade === '2k' || /^200\d$/.test(year) || /^201\d$/.test(year) || /\b(200[0-9])\b/.test(movie) || /\b(201[0-9])\b/.test(movie) || /\b(200[0-9])\b/.test(album) || /\b(201[0-9])\b/.test(album);
        }
        const hay = title + ' ' + movie + ' ' + artist + ' ' + (s.genre || '') + ' ' + (s.mood || '');
        const lk = hay.toLowerCase();
        return matchAny(lk, MOOD_PATTERNS[moodKey] || []);
    }

    function findMoodOrDecade(wanted, songs) {
        const wk = norm(wanted);
        const list = songs && songs.length ? songs : (window.DataStore && typeof window.DataStore.getSongs === 'function' ? window.DataStore.getSongs() : []);
        for (const key of Object.keys(DECADE_PATTERNS)) {
            if (matchAny(wk, DECADE_PATTERNS[key])) {
                const out = list.filter((s) => songMatches(s, key) && (s.audioUrl || s.streamUrl));
                if (out.length >= 3) return { type: 'decade', key: key, songs: out };
            }
        }
        let bestKey = null;
        let bestScore = 0;
        for (const key of Object.keys(MOOD_PATTERNS)) {
            const pats = MOOD_PATTERNS[key];
            let score = 0;
            for (const p of pats) {
                const m = wk.match(p);
                if (m) score += m[0].length + 4;
            }
            if (score > bestScore) { bestScore = score; bestKey = key; }
        }
        if (bestKey) {
            const out = list.filter((s) => songMatches(s, bestKey) && (s.audioUrl || s.streamUrl));
            if (out.length >= 3) return { type: 'mood', key: bestKey, songs: out };
        }
        return null;
    }

    function findPlaylist(wanted) {
        let playlists = [];
        try {
            if (window.DataStore && typeof window.DataStore.getPlaylists === 'function') {
                playlists = window.DataStore.getPlaylists() || [];
            }
            const custom = JSON.parse(localStorage.getItem('pm_custom_playlists') || '[]') || [];
            const ai = JSON.parse(localStorage.getItem('pm_ai_playlists') || '[]') || [];
            playlists = playlists.concat(custom).concat(ai);
        } catch (e) {}
        const wk = norm(wanted);
        let best = null;
        let bestScore = 0;
        for (const pl of playlists) {
            const name = String(pl.name || pl.title || '').toLowerCase();
            const pts = wk.split(' ').filter((w) => w.length > 1);
            let score = 0;
            for (const t of pts) {
                if (name === t) score += 6;
                else if (name.indexOf(t) !== -1) score += t.length * 2;
            }
            if (wk && name.indexOf(wk) !== -1) score += 5;
            if (score > bestScore) { bestScore = score; best = pl; }
        }
        if (best && bestScore > 0) {
            const songs = (best.songs && best.songs.length) ? best.songs : [];
            if (songs.length) return { type: 'playlist', key: best.name || best.title, songs: songs };
        }
        return null;
    }

    function findTitle(wanted, songs) {
        const wk = norm(wanted);
        const list = songs && songs.length ? songs : (window.DataStore && typeof window.DataStore.getSongs === 'function' ? window.DataStore.getSongs() : []);
        const words = wk.split(' ').filter((w) => w.length > 1);
        let best = null;
        let bestScore = 0;
        for (const s of list) {
            const title = String(s.title || '').toLowerCase();
            if (!title) continue;
            let score = 0;
            for (const w of words) {
                if (title.indexOf(w) !== -1) score += w.length;
            }
            if (wk && title === wk) score += 8;
            if (score > bestScore) { bestScore = score; best = s; }
        }
        if (best && bestScore > 3) return { type: 'title', key: best.title, songs: [best] };
        return null;
    }

    function findCollection(wanted) {
        const wk = norm(wanted);
        const ds = window.DataStore;
        if (!ds) return null;
        const groups = [];
        if (typeof ds.getMusicCollections === 'function') groups.push({ label: 'music', items: ds.getMusicCollections() || [] });
        if (typeof ds.getMoviesCollections === 'function') groups.push({ label: 'movies', items: ds.getMoviesCollections() || [] });
        if (typeof ds.getYearlyCollections === 'function') groups.push({ label: 'yearly', items: ds.getYearlyCollections() || [] });
        if (typeof ds.getLatestCollections === 'function') groups.push({ label: 'latest', items: ds.getLatestCollections() || [] });

        let best = null;
        let bestInfo = null;
        for (const g of groups) {
            for (const col of g.items) {
                const name = String(col.name || col.title || '').toLowerCase();
                let score = 0;
                const words = wk.split(' ').filter((w) => w.length > 1);
                for (const w of words) {
                    if (name === w) score += 5;
                    else if (name.indexOf(w) !== -1) score += w.length;
                }
                if (wk && (name === wk || name.indexOf(wk) !== -1)) score += 6;
                if (score > 0 && score > (bestInfo ? bestInfo.score : 0)) {
                    bestInfo = { score: score, label: g.label };
                    best = col;
                }
            }
        }
        if (best) {
            let songs = best.songs || best.tracks || best.items || [];
            if (best.id && Array.isArray(best.songIds)) {
                const all = ds.getSongs ? ds.getSongs() : [];
                songs = best.songIds.map((id) => all.find((s) => String(s.id) === String(id) || s.title === id || s.audioUrl === id)).filter(Boolean);
            }
            if (best.year) {
                const all = ds.getSongs ? ds.getSongs() : [];
                const yrArr = String(best.year).split('-').map((v) => v.trim());
                songs = all.filter((s) => yrArr.some((y) => (s.year || '') === y || (s.decade || '') === y));
            }
            const playable = songs.filter((s) => s && (s.audioUrl || s.streamUrl));
            if (playable.length) return { type: 'collection', key: best.name || best.title, songs: playable };
        }
        return null;
    }

    function playSongList(songList) {
        if (!songList || !songList.length) return false;
        setState('thinking');
        window.playSong(songList[0], songList);
        setState('idle');
        return true;
    }

    const INTENT_PATTERNS = {
        next: [/\bnext\b/, /\bnextsong\b/, /\badutha\b/, /\baduthu\b/, /\baduttha\b/, /\bskip\b/, /\bforward\b/, /\bscaleup\b/, /\bஅடுத்த\b/],
        prev: [/\bprevious\b/, /\bprev\b/, /\bmunnadi\b/, /\bmunal\b/, /\bmunnaal\b/, /\bback\b/, /\breverse\b/, /\bgo previous\b/, /\bமுந்தைய\b/, /\bமுன்னாடி\b/],
        pause: [/\bpause\b/, /\bpause pannu\b/, /\bstop\b/, /\bstop the music\b/, /\bstop music\b/, /\bniruthu\b/, /\bniruthi\b/, /\bநிறுத்து\b/, /\bநிறுத்தி\b/],
        resume: [/\bresume\b/, /\bcontinue\b/, /\bcontinue the song\b/, /\bplay pannu\b/, /\bstart pannu\b/, /\bpodhu\b/, /\bமீண்டும்\b/, /\bதொடரு\b/],
        volUp: [/\b(volume|sound|oli|ஒலி)\s+(up|high|increase|max|louder|keep)\b/, /\blouder\b/, /\bkeechu\b/, /\bvolume bhaiya\b/, /\bsound high\b/, /\barakku\b/, /\buhh\b/],
        volDown: [/\b(volume|sound|oli|ஒலி)\s+(down|low|decrease|reduce|lower)\b/, /\bquieter\b/, /\blower/i, /\bkammi\b/],
        mute: [/\bmute\b/, /\bam samai\b/, /\bsound off\b/, /\soon samay\b/, /\bsilence\b/, /\bchauch\b/],
        fm: [/\bfm\b/, /\bradio\b/, /\broadcast\b/, /\bstation\b/, /\bரேடியோ\b/, /\bfm podu\b/, /\bradio podu\b/, /\bplay fm\b/, /\bplay radio\b/, /\b\d{2}(?:\.\d)?\s*fm\b/],
    };

    function executeCommand(text) {
        const now = Date.now();
        if (now - _lastCmdAt < CONFIG.COOLDOWN_MS) return;
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
                setState('idle');
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
                setState('idle');
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
        if (hasPlayback() && matchAny(n, [/\bplay\b/]) && n.replace(/\bplay\b/g, '').trim().length === 0) {
            setState('thinking');
            window.togglePlayPause();
            setState('idle');
            feedback('Resuming music.', 'success');
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
        feedback(up ? 'Volume up a bit.' : 'Volume down a bit.', 'success');
    }

    function toggleMute() {
        const ap = window.audioPlayer;
        if (!ap) {
            feedback('No player is active right now.', 'info');
            setState('idle');
            return;
        }
        try {
            ap.muted = !ap.muted;
            feedback(ap.muted ? 'Muted.' : 'Unmuted.', 'success');
        } catch (e) {}
        setState('idle');
    }

    function extractFmTarget(raw) {
        const n = raw.replace(/\bfm\b/gi, '');
        return n.replace(/\b(play|radio|podhu|podu|podunga|song|station)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    }

    function requestTarget(raw) {
        const text = String(raw || '');
        const target = stripTarget(text);
        if (!target) {
            feedback('Say "Next song", "Play Dhanush hits" or "Play love songs".', 'info');
            setState('idle');
            return;
        }
        const songs = window.DataStore && typeof window.DataStore.getSongs === 'function' ? window.DataStore.getSongs() : [];

        const asPlaylist = findPlaylist(target);
        if (asPlaylist) {
            setState('thinking');
            feedback('Found playlist ' + asPlaylist.key + '.', 'success');
            playSongList(asPlaylist.songs);
            setState('idle');
            return;
        }

        const moodHit = findMoodOrDecade(target, songs);
        if (moodHit) {
            setState('thinking');
            feedback((moodHit.type === 'decade' ? moodHit.key + ' songs' : moodHit.key + ' songs') + ' coming up.', 'success');
            playSongList(moodHit.songs);
            setState('idle');
            return;
        }

        const artistRes = findArtist(target, songs);
        if (artistRes && artistRes.ranked.length >= 2) {
            setState('thinking');
            playArtistSongs(artistRes.artists[0], artistRes.ranked);
            setState('idle');
            return;
        }

        const coll = findCollection(target);
        if (coll) {
            setState('thinking');
            feedback('Playing ' + coll.key + '.', 'success');
            playSongList(coll.songs);
            setState('idle');
            return;
        }

        const titleHit = findTitle(target, songs);
        if (titleHit) {
            setState('thinking');
            feedback('Playing ' + titleHit.key + '.', 'success');
            playSongList(titleHit.songs);
            setState('idle');
            return;
        }

        const anyList = songs.filter((s) => s && (s.audioUrl || s.streamUrl));
        if (anyList.length) {
            setState('thinking');
            feedback('No exact match for "' + target + '". Playing top songs instead.', 'info');
            playSongList(anyList);
            setState('idle');
            return;
        }

        setState('idle');
        feedback('Sorry, I could not find "' + target + '". Try "Play Dhanush hits" or "Play love songs".', 'error');
    }

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
            _bubbleTitle.textContent = 'Listening for wake word';
            _bubbleHint.textContent = 'Say "Hello" to activate me';
        } else if (_state === 'command' || _state === 'command-active') {
            _bubble.classList.add('va-show');
            _bubbleTitle.textContent = 'Listening';
            _bubbleHint.textContent = 'Say: "Next song" • "Play Dhanush hits" • "Play love songs" • "Play FM"';
        } else if (_state === 'thinking') {
            _bubble.classList.add('va-show');
            _bubbleTitle.textContent = 'Working';
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
        if (full) {
            _root.style.display = 'none';
            return;
        }
        _root.style.display = '';
        let pad = 72;
        if (bar) {
            const r = bar.getBoundingClientRect();
            if (r.top > 0) pad = window.innerHeight - r.top + 12;
        }
        _root.style.bottom = pad + 'px';
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
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) abortAll();
        });
        window.addEventListener('pagehide', abortAll);
        reposition();
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
        injectCss();
        ensureDom();
    }

    window.VoiceAIBot = {
        init: init,
        arm: arm,
        deactivate: deactivate,
        isActive: () => _state !== 'idle',
        setTts: (on) => {
            _tts = !!on;
            try { localStorage.setItem(VOICE_TTS_KEY, _tts ? '1' : '0'); } catch (e) {}
        },
        getState: () => _state,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
