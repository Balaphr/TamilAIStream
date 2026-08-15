'use strict';

/* ============================================
   AI Features — All-in-One Module
   Mood Player, Playlist Creator, Radio Generator,
   Personal FM, Voice Search, Lyrics Search,
   Movie Universe, Artist Universe, Dashboard,
   Recommendations, Top Notification, Ask AI
   ============================================ */

const AIFeatures = (() => {
    let _initialized = false;
    let _allSongs = [];
    let _allArtists = [];
    let _allStations = [];

    function getAllSongs() {
        if (_allSongs.length > 0) return _allSongs;
        try {
            const ds = (typeof DataStore !== 'undefined') ? DataStore : null;
            if (ds && ds.getSongs) _allSongs = ds.getSongs() || [];
            else if (ds && ds.songs) _allSongs = ds.songs || [];
            else {
                const raw = localStorage.getItem('tamilAIStream_songs');
                if (raw) _allSongs = JSON.parse(raw);
            }
        } catch (e) { _allSongs = []; }
        return _allSongs;
    }

    function getAllArtists() {
        if (_allArtists.length > 0) return _allArtists;
        const songs = getAllSongs();
        const artistMap = {};
        songs.forEach(s => {
            const name = s.artist || s.singer || s.artistName || 'Unknown';
            if (!artistMap[name]) artistMap[name] = { name, songs: [], image: s.artistImage || s.artistImg || '' };
            artistMap[name].songs.push(s);
        });
        _allArtists = Object.values(artistMap).sort((a, b) => b.songs.length - a.songs.length);
        return _allArtists;
    }

    function getAllStations() {
        if (_allStations.length > 0) return _allStations;
        try {
            const ds = (typeof DataStore !== 'undefined') ? DataStore : null;
            if (ds && ds.getStations) _allStations = ds.getStations() || [];
            else if (ds && ds.stations) _allStations = ds.stations || [];
        } catch (e) { _allStations = []; }
        return _allStations;
    }

    function getMovies() {
        const songs = getAllSongs();
        const movieMap = {};
        songs.forEach(s => {
            const movie = s.movie || s.album || s.film || '';
            if (!movie) return;
            if (!movieMap[movie]) movieMap[movie] = { name: movie, songs: [], year: s.year || '', poster: s.poster || s.moviePoster || '', singer: s.artist || s.singer || '', composer: s.composer || '', lyricist: s.lyricist || '' };
            movieMap[movie].songs.push(s);
        });
        return Object.values(movieMap).sort((a, b) => b.songs.length - a.songs.length);
    }

    function playQueue(songs, startIndex) {
        if (!songs || songs.length === 0) return;
        const idx = startIndex || 0;
        if (typeof PlayerEngine !== 'undefined' && PlayerEngine.playTrack) {
            PlayerEngine.clearQueue();
            songs.forEach(s => PlayerEngine.addToQueue(s));
            PlayerEngine.playTrack(songs[idx], null, idx);
        } else if (typeof window.playSong === 'function') {
            window.playSong(songs[idx]);
        }
    }

    function getMoodSongs(mood) {
        const songs = getAllSongs();
        const moodKeywords = {
            happy: ['happy', 'fun', 'dance', 'upbeat', 'celebration', 'joy', 'mass', 'kuthu'],
            love: ['love', 'romantic', 'romance', 'prema', 'kadhal', 'anbe'],
            sad: ['sad', 'sorrow', 'pain', 'heartbreak', 'loss', 'weep'],
            peaceful: ['peace', 'calm', 'gentle', 'soft', 'serene', 'relax'],
            devotional: ['devotional', 'spiritual', 'prayer', 'temple', 'god', 'divine', 'thee'],
            travel: ['travel', 'road', 'journey', 'drive', 'trip', 'yen'],
            party: ['party', 'dance', 'beat', 'remix', 'club', 'mass', 'kuthu'],
            motivation: ['motiv', 'inspir', 'courage', 'strength', 'fight', 'brave'],
            focus: ['focus', 'concentrate', 'study', 'work', 'instrumental', 'classical'],
            sleep: ['sleep', 'lullaby', 'gentle', 'soft', 'night', 'calm'],
            workout: ['workout', 'gym', 'energy', 'power', 'fast', 'beat', 'intense'],
            relax: ['relax', 'chill', 'easy', 'breezy', 'soft', 'calm', 'soothe']
        };
        const keywords = moodKeywords[mood] || [mood];
        const scored = songs.map(s => {
            const text = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.genre || '') + ' ' + (s.mood || '') + ' ' + (s.tags || '') + ' ' + (s.movie || '')).toLowerCase();
            let score = 0;
            keywords.forEach(kw => { if (text.includes(kw)) score += 3; });
            if (s.mood && s.mood.toLowerCase() === mood) score += 10;
            if (s.genre && keywords.some(k => s.genre.toLowerCase().includes(k))) score += 5;
            return { song: s, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
        if (scored.length === 0) return songs.slice(0, 20);
        return scored.map(x => x.song);
    }

    function getArtistSongs(artistName) {
        const songs = getAllSongs();
        return songs.filter(s => (s.artist || s.singer || '').toLowerCase().includes(artistName.toLowerCase()));
    }

    function getDecadeSongs(decade) {
        const songs = getAllSongs();
        return songs.filter(s => {
            const year = parseInt(s.year) || 0;
            return year >= decade && year < decade + 10;
        });
    }

    function searchByLyrics(query) {
        const songs = getAllSongs();
        const q = query.toLowerCase();
        return songs.filter(s => {
            const lyrics = (s.lyrics || '').toLowerCase();
            return lyrics.includes(q);
        });
    }

    /* ---- 1. MOOD PLAYER ---- */
    function initMoodPlayer() {
        const grid = document.getElementById('moodGrid');
        if (!grid) return;
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.mood-card');
            if (!card) return;
            const mood = card.dataset.mood;
            if (!mood) return;
            const songs = getMoodSongs(mood);
            if (songs.length === 0) {
                showToast('No songs found for this mood', 'info');
                return;
            }
            playQueue(songs, 0);
            showToast('Playing ' + mood.charAt(0).toUpperCase() + mood.slice(1) + ' songs', 'success');
        });
    }

    /* ---- 2. AI PLAYLIST CREATOR ---- */
    function openAICreator() {
        const songs = getAllSongs();
        const moods = ['happy', 'love', 'sad', 'peaceful', 'party', 'workout', 'travel', 'motivation'];
        let html = '<div class="ai-creator-panel" id="aiCreatorPanel">';
        html += '<div class="ai-creator-header"><h3><i class="fas fa-wand-magic-sparkles"></i> AI Playlist Creator</h3>';
        html += '<button class="ai-panel-close" onclick="AIFeatures.closeAICreator()"><i class="fas fa-times"></i></button></div>';
        html += '<div class="ai-creator-body">';
        html += '<p class="ai-creator-desc">Describe what you want and AI will create a playlist for you</p>';
        html += '<div class="ai-creator-input-row">';
        html += '<input type="text" id="aiCreatorInput" class="ai-creator-input" placeholder="e.g. Play peaceful Tamil songs for studying">';
        html += '<button class="ai-creator-btn" onclick="AIFeatures.generateAICreatorPlaylist()"><i class="fas fa-wand-magic-sparkles"></i> Create</button>';
        html += '</div>';
        html += '<div class="ai-creator-quick-tags">';
        moods.forEach(m => {
            html += '<button class="ai-quick-tag" onclick="document.getElementById(\'aiCreatorInput\').value=\'Play ' + m + ' Tamil songs\';AIFeatures.generateAICreatorPlaylist()">' + m.charAt(0).toUpperCase() + m.slice(1) + '</button>';
        });
        html += '</div>';
        html += '<div id="aiCreatorResult" class="ai-creator-result"></div>';
        html += '</div></div>';
        showOverlayPanel(html);
    }

    function closeAICreator() { hideOverlayPanel(); }

    function generateAICreatorPlaylist() {
        const input = document.getElementById('aiCreatorInput');
        if (!input || !input.value.trim()) return;
        const query = input.value.trim().toLowerCase();
        const result = document.getElementById('aiCreatorResult');
        if (!result) return;

        let songs = [];
        let playlistName = 'AI Generated Playlist';

        if (query.includes('mood') || query.includes('happy') || query.includes('sad') || query.includes('love') || query.includes('peaceful') || query.includes('party') || query.includes('workout')) {
            const moodMatch = ['happy', 'love', 'sad', 'peaceful', 'party', 'workout', 'travel', 'motivation', 'devotional', 'focus', 'sleep', 'relax'].find(m => query.includes(m));
            if (moodMatch) {
                songs = getMoodSongs(moodMatch);
                playlistName = moodMatch.charAt(0).toUpperCase() + moodMatch.slice(1) + ' Mix';
            }
        }

        if (songs.length === 0 && (query.includes('artist') || query.includes('singer'))) {
            const artists = getAllArtists();
            const matched = artists.find(a => query.toLowerCase().includes(a.name.toLowerCase()));
            if (matched) {
                songs = matched.songs;
                playlistName = matched.name + ' Collection';
            }
        }

        if (songs.length === 0 && (query.includes('90s') || query.includes('80s') || query.includes('2000s'))) {
            const decadeMatch = query.match(/(\d{2})0s/);
            if (decadeMatch) {
                const decade = parseInt(decadeMatch[1]) * 10 + 1900;
                songs = getDecadeSongs(decade);
                playlistName = decade + 's Tamil Hits';
            }
        }

        if (songs.length === 0) {
            const searchWords = query.replace(/play|tamil|songs|for|give|me|the|a|an|some|good|best|new|old/g, '').trim().split(/\s+/);
            const all = getAllSongs();
            songs = all.filter(s => {
                const text = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.genre || '') + ' ' + (s.movie || '') + ' ' + (s.tags || '')).toLowerCase();
                return searchWords.some(w => w.length > 2 && text.includes(w));
            });
            if (songs.length === 0) songs = all.slice(0, 20);
            playlistName = 'Search Results';
        }

        let listHtml = '<div class="ai-creator-playlist">';
        listHtml += '<div class="ai-playlist-header"><h4>' + playlistName + '</h4>';
        listHtml += '<span>' + songs.length + ' songs</span>';
        listHtml += '<button class="ai-play-all-btn" onclick="AIFeatures.playCreatorQueue()"><i class="fas fa-play"></i> Play All</button></div>';
        listHtml += '<div class="ai-playlist-songs">';
        songs.slice(0, 50).forEach((s, i) => {
            listHtml += '<div class="ai-pl-song" onclick="AIFeatures.playCreatorSong(' + i + ')">';
            listHtml += '<span class="ai-pl-num">' + (i + 1) + '</span>';
            listHtml += '<div class="ai-pl-info"><div class="ai-pl-title">' + (s.title || s.name || 'Unknown') + '</div>';
            listHtml += '<div class="ai-pl-artist">' + (s.artist || s.singer || '') + '</div></div>';
            listHtml += '<span class="ai-pl-dur">' + (s.duration ? formatTime(s.duration) : '--:--') + '</span>';
            listHtml += '</div>';
        });
        listHtml += '</div></div>';
        result.innerHTML = listHtml;
        result._songs = songs;
        window._aiCreatorSongs = songs;
    }

    function playCreatorQueue() {
        const songs = window._aiCreatorSongs;
        if (songs && songs.length > 0) playQueue(songs, 0);
    }

    function playCreatorSong(idx) {
        const songs = window._aiCreatorSongs;
        if (songs && songs[idx]) playQueue(songs, idx);
    }

    /* ---- 3. AI RADIO GENERATOR ---- */
    function openAIRadioGenerator() {
        let html = '<div class="ai-radio-panel" id="aiRadioPanel">';
        html += '<div class="ai-creator-header"><h3><i class="fas fa-tower-broadcast"></i> AI Radio Generator</h3>';
        html += '<button class="ai-panel-close" onclick="AIFeatures.closeAIRadio()"><i class="fas fa-times"></i></button></div>';
        html += '<div class="ai-creator-body">';
        html += '<p class="ai-creator-desc">Create a custom AI-powered radio station from any mood, genre, or artist</p>';
        html += '<div class="ai-radio-options">';
        const radioThemes = [
            { name: 'Tamil Melody FM', mood: 'peaceful', icon: '🎵', desc: 'Soft Tamil melodies' },
            { name: 'Kuthu Party FM', mood: 'party', icon: '🥁', desc: 'High-energy Kuthu beats' },
            { name: 'Ilaiyaraaja Classics', artist: 'Ilaiyaraaja', icon: '🎻', desc: 'Timeless IR classics' },
            { name: 'AR Rahman FM', artist: 'A.R. Rahman', icon: '🎹', desc: 'ARR magic' },
            { name: '90s Nostalgia FM', decade: 1990, icon: '📼', desc: '90s Tamil hits' },
            { name: 'Night Drive FM', mood: 'travel', icon: '🌙', desc: 'Perfect night driving songs' },
            { name: 'Workout Power FM', mood: 'workout', icon: '💪', desc: 'High-energy workout mixes' },
            { name: 'Devotional Peace FM', mood: 'devotional', icon: '🙏', desc: 'Spirit Tamil devotional' },
        ];
        radioThemes.forEach((t, i) => {
            html += '<button class="ai-radio-theme" onclick="AIFeatures.playAIRadio(' + i + ')">';
            html += '<span class="ai-radio-icon">' + t.icon + '</span>';
            html += '<div class="ai-radio-info"><div class="ai-radio-name">' + t.name + '</div>';
            html += '<div class="ai-radio-desc">' + t.desc + '</div></div>';
            html += '<span class="ai-radio-live"><span class="live-dot"></span>LIVE</span></button>';
        });
        html += '</div></div></div>';
        window._aiRadioThemes = radioThemes;
        showOverlayPanel(html);
    }

    function closeAIRadio() { hideOverlayPanel(); }

    function playAIRadio(idx) {
        const themes = window._aiRadioThemes || [];
        const theme = themes[idx];
        if (!theme) return;
        let songs = [];
        if (theme.mood) songs = getMoodSongs(theme.mood);
        else if (theme.artist) songs = getArtistSongs(theme.artist);
        else if (theme.decade) songs = getDecadeSongs(theme.decade);
        if (songs.length === 0) songs = getAllSongs().slice(0, 30);
        playQueue(songs, 0);
        showToast('Now playing: ' + theme.name, 'success');
        hideOverlayPanel();
    }

    /* ---- 4. PERSONAL AI FM ---- */
    function openPersonalFM() {
        const history = (typeof ListeningHistory !== 'undefined') ? ListeningHistory : null;
        let topArtists = [];
        let topMoods = [];
        let favSongs = [];

        try {
            if (history && history.getRecentlyPlayed) {
                const recent = history.getRecentlyPlayed();
                const artistCount = {};
                recent.forEach(item => {
                    const a = item.artist || item.singer || '';
                    if (a) artistCount[a] = (artistCount[a] || 0) + 1;
                });
                topArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
            }
        } catch (e) {}

        const songs = getAllSongs();
        let personalized = [];
        if (topArtists.length > 0) {
            topArtists.forEach(a => {
                personalized.push(...songs.filter(s => (s.artist || s.singer || '').toLowerCase().includes(a.toLowerCase())));
            });
        }
        if (personalized.length === 0) personalized = songs.slice(0, 30);
        const shuffled = personalized.sort(() => Math.random() - 0.5);

        let html = '<div class="ai-personal-fm-panel">';
        html += '<div class="ai-creator-header"><h3><i class="fas fa-fingerprint"></i> Personal AI FM</h3>';
        html += '<button class="ai-panel-close" onclick="AIFeatures.closePersonalFM()"><i class="fas fa-times"></i></button></div>';
        html += '<div class="ai-creator-body">';
        html += '<p class="ai-creator-desc">Your personalized radio based on listening history</p>';
        if (topArtists.length > 0) {
            html += '<div class="ai-pfm-artists"><span class="ai-pfm-label">Based on:</span> ' + topArtists.join(', ') + '</div>';
        }
        html += '<button class="ai-play-all-btn ai-pfm-play" onclick="AIFeatures.playPersonalFM()"><i class="fas fa-play"></i> Play Personal FM</button>';
        html += '<div class="ai-pfm-preview">';
        shuffled.slice(0, 10).forEach((s, i) => {
            html += '<div class="ai-pl-song"><span class="ai-pl-num">' + (i + 1) + '</span>';
            html += '<div class="ai-pl-info"><div class="ai-pl-title">' + (s.title || s.name || '') + '</div>';
            html += '<div class="ai-pl-artist">' + (s.artist || s.singer || '') + '</div></div></div>';
        });
        html += '</div></div></div>';
        window._personalFMSongs = shuffled;
        showOverlayPanel(html);
    }

    function closePersonalFM() { hideOverlayPanel(); }

    function playPersonalFM() {
        const songs = window._personalFMSongs;
        if (songs && songs.length > 0) {
            playQueue(songs, 0);
            hideOverlayPanel();
            showToast('Playing Personal AI FM', 'success');
        }
    }

    /* ---- 5. VOICE SEARCH ---- */
    let _voiceRecognition = null;
    function openVoiceSearch() {
        let html = '<div class="ai-voice-panel">';
        html += '<div class="ai-creator-header"><h3><i class="fas fa-microphone"></i> Voice Music Search</h3>';
        html += '<button class="ai-panel-close" onclick="AIFeatures.closeVoiceSearch()"><i class="fas fa-times"></i></button></div>';
        html += '<div class="ai-creator-body">';
        html += '<div class="ai-voice-circle" id="voiceCircle"><i class="fas fa-microphone"></i></div>';
        html += '<p class="ai-voice-status" id="voiceStatus">Tap to start listening</p>';
        html += '<div id="voiceResult" class="ai-voice-result"></div>';
        html += '</div></div>';
        showOverlayPanel(html);
        document.getElementById('voiceCircle')?.addEventListener('click', startVoiceRecognition);
    }

    function closeVoiceSearch() {
        if (_voiceRecognition) { try { _voiceRecognition.stop(); } catch (e) {} _voiceRecognition = null; }
        hideOverlayPanel();
    }

    function startVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            document.getElementById('voiceStatus').textContent = 'Voice recognition not supported in this browser';
            return;
        }
        const circle = document.getElementById('voiceCircle');
        const status = document.getElementById('voiceStatus');
        if (circle) circle.classList.add('listening');
        if (status) status.textContent = 'Listening...';

        _voiceRecognition = new SpeechRecognition();
        _voiceRecognition.lang = 'en-US';
        _voiceRecognition.interimResults = true;
        _voiceRecognition.maxAlternatives = 1;

        _voiceRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (status) status.textContent = transcript;
            if (event.results[0].isFinal) {
                if (circle) circle.classList.remove('listening');
                processVoiceQuery(transcript);
            }
        };
        _voiceRecognition.onerror = (event) => {
            if (circle) circle.classList.remove('listening');
            if (status) status.textContent = 'Error: ' + event.error;
        };
        _voiceRecognition.onend = () => {
            if (circle) circle.classList.remove('listening');
        };
        try { _voiceRecognition.start(); } catch (e) {}
    }

    function processVoiceQuery(query) {
        const result = document.getElementById('voiceResult');
        const songs = getAllSongs();
        const q = query.toLowerCase();

        let matched = [];
        if (q.includes('artist') || q.includes('singer')) {
            const artistName = q.replace(/play|songs?|by|singer|artist|tamil|music/g, '').trim();
            matched = songs.filter(s => (s.artist || s.singer || '').toLowerCase().includes(artistName));
        } else {
            const words = q.replace(/play|tamil|songs?|for|give|me|the|music|some|good|best/g, '').trim().split(/\s+/);
            matched = songs.filter(s => {
                const text = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.genre || '') + ' ' + (s.movie || '') + ' ' + (s.mood || '') + ' ' + (s.tags || '')).toLowerCase();
                return words.some(w => w.length > 2 && text.includes(w));
            });
        }

        if (matched.length === 0) matched = getMoodSongs(q) || songs.slice(0, 10);

        if (result) {
            let html = '<div class="ai-playlist-songs">';
            matched.slice(0, 15).forEach((s, i) => {
                html += '<div class="ai-pl-song" onclick="AIFeatures.playCreatorSong(' + i + ')">';
                html += '<span class="ai-pl-num">' + (i + 1) + '</span>';
                html += '<div class="ai-pl-info"><div class="ai-pl-title">' + (s.title || s.name || '') + '</div>';
                html += '<div class="ai-pl-artist">' + (s.artist || s.singer || '') + '</div></div></div>';
            });
            html += '</div>';
            result.innerHTML = html;
            window._aiCreatorSongs = matched;
        }
        playQueue(matched, 0);
        showToast('Found ' + matched.length + ' songs for "' + query + '"', 'success');
    }

    /* ---- 6. LYRICS SEARCH ---- */
    function openLyricsSearch() {
        let html = '<div class="ai-lyrics-search-panel">';
        html += '<div class="ai-creator-header"><h3><i class="fas fa-quote-right"></i> Search by Lyrics</h3>';
        html += '<button class="ai-panel-close" onclick="AIFeatures.closeLyricsSearch()"><i class="fas fa-times"></i></button></div>';
        html += '<div class="ai-creator-body">';
        html += '<p class="ai-creator-desc">Type any lyrics line to find the song</p>';
        html += '<div class="ai-creator-input-row">';
        html += '<input type="text" id="lyricsSearchInput" class="ai-creator-input" placeholder="e.g. Kannalane or Ennavale or Nenjukkule...">';
        html += '<button class="ai-creator-btn" onclick="AIFeatures.performLyricsSearch()"><i class="fas fa-search"></i> Search</button>';
        html += '</div>';
        html += '<div id="lyricsSearchResult" class="ai-creator-result"></div>';
        html += '</div></div>';
        showOverlayPanel(html);
    }

    function closeLyricsSearch() { hideOverlayPanel(); }

    function performLyricsSearch() {
        const input = document.getElementById('lyricsSearchInput');
        const result = document.getElementById('lyricsSearchResult');
        if (!input || !input.value.trim() || !result) return;
        const query = input.value.trim();
        const songs = getAllSongs();
        const q = query.toLowerCase();
        const matched = songs.filter(s => {
            const text = ((s.title || '') + ' ' + (s.lyrics || '') + ' ' + (s.artist || '') + ' ' + (s.movie || '')).toLowerCase();
            return q.split(/\s+/).some(w => w.length > 2 && text.includes(w));
        });
        let html = '';
        if (matched.length === 0) {
            html = '<p class="ai-empty">No songs found matching "' + query + '"</p>';
        } else {
            html = '<div class="ai-playlist-songs">';
            matched.slice(0, 20).forEach((s, i) => {
                html += '<div class="ai-pl-song" onclick="AIFeatures.playCreatorSong(' + i + ')">';
                html += '<span class="ai-pl-num">' + (i + 1) + '</span>';
                html += '<div class="ai-pl-info"><div class="ai-pl-title">' + (s.title || s.name || '') + '</div>';
                html += '<div class="ai-pl-artist">' + (s.artist || s.singer || '') + ' &middot; ' + (s.movie || '') + '</div></div></div>';
            });
            html += '</div>';
        }
        result.innerHTML = html;
        window._aiCreatorSongs = matched;
    }

    /* ---- 7. ASK TAMIL AI ---- */
    function openAskAI() {
        let html = '<div class="ai-ask-panel">';
        html += '<div class="ai-creator-header"><h3><i class="fas fa-robot"></i> Ask Tamil AI</h3>';
        html += '<button class="ai-panel-close" onclick="AIFeatures.closeAskAI()"><i class="fas fa-times"></i></button></div>';
        html += '<div class="ai-creator-body">';
        html += '<div class="ai-ask-messages" id="aiAskMessages">';
        html += '<div class="ai-ask-msg ai-ask-bot"><div class="ai-ask-avatar"><i class="fas fa-robot"></i></div><div class="ai-ask-bubble">Vanakkam! I\'m your Tamil AI music assistant. Ask me anything about music, artists, or moods!</div></div>';
        html += '</div>';
        html += '<div class="ai-ask-chips">';
        ['Play happy songs', 'Play Ilaiyaraaja songs', '90s Tamil hits', 'Recommend something', 'What\'s trending?'].forEach(c => {
            html += '<button class="ai-ask-chip" onclick="AIFeatures.sendAskAI(\'' + c + '\')">' + c + '</button>';
        });
        html += '</div>';
        html += '<div class="ai-ask-input-row">';
        html += '<input type="text" id="aiAskInput" class="ai-creator-input" placeholder="Ask me anything..." onkeypress="if(event.key===\'Enter\')AIFeatures.sendAskAI(this.value)">';
        html += '<button class="ai-creator-btn" onclick="AIFeatures.sendAskAI(document.getElementById(\'aiAskInput\').value)"><i class="fas fa-paper-plane"></i></button>';
        html += '</div></div></div>';
        showOverlayPanel(html);
    }

    function closeAskAI() { hideOverlayPanel(); }

    function sendAskAI(query) {
        if (!query || !query.trim()) return;
        const messages = document.getElementById('aiAskMessages');
        const input = document.getElementById('aiAskInput');
        if (!messages) return;

        messages.innerHTML += '<div class="ai-ask-msg ai-ask-user"><div class="ai-ask-bubble">' + escapeHtml(query) + '</div></div>';

        const q = query.toLowerCase();
        let response = '';
        let songs = [];

        if (q.includes('play') && (q.includes('happy') || q.includes('sad') || q.includes('love') || q.includes('peaceful') || q.includes('party') || q.includes('workout') || q.includes('travel') || q.includes('devotional') || q.includes('motivation') || q.includes('focus') || q.includes('sleep') || q.includes('relax'))) {
            const mood = ['happy', 'love', 'sad', 'peaceful', 'party', 'workout', 'travel', 'devotional', 'motivation', 'focus', 'sleep', 'relax'].find(m => q.includes(m));
            songs = getMoodSongs(mood);
            response = 'Playing ' + mood + ' Tamil songs for you! Found ' + songs.length + ' songs.';
            if (songs.length > 0) playQueue(songs, 0);
        } else if (q.includes('artist') || q.includes('singer') || q.includes('ilaiyaraaja') || q.includes('rahman') || q.includes('anirudh')) {
            const artistName = q.replace(/play|songs?|by|singer|artist|tamil|music|ilaiyaraaja|rahman|anirudh/g, '').trim() || q;
            const artists = getAllArtists();
            const found = artists.find(a => q.includes(a.name.toLowerCase()));
            if (found) {
                songs = found.songs;
                response = 'Playing songs by ' + found.name + '! Found ' + songs.length + ' songs.';
                playQueue(songs, 0);
            } else {
                songs = getArtistSongs(artistName || q);
                if (songs.length > 0) {
                    response = 'Found ' + songs.length + ' songs matching your request.';
                    playQueue(songs, 0);
                } else {
                    response = 'I couldn\'t find an exact artist match. Let me suggest some popular Tamil artists: Ilaiyaraaja, A.R. Rahman, Anirudh, Harris Jayaraj, Yuvan Shankar Raja.';
                }
            }
        } else if (q.includes('90s') || q.includes('80s') || q.includes('2000s') || q.includes('decade')) {
            const decade = q.includes('90s') ? 1990 : q.includes('80s') ? 1980 : 2000;
            songs = getDecadeSongs(decade);
            response = 'Playing ' + decade + 's Tamil hits! Found ' + songs.length + ' songs.';
            if (songs.length > 0) playQueue(songs, 0);
        } else if (q.includes('trending') || q.includes('popular') || q.includes('top')) {
            songs = getAllSongs().slice(0, 20);
            response = 'Here are the top trending Tamil songs!';
            if (songs.length > 0) playQueue(songs, 0);
        } else if (q.includes('recommend') || q.includes('suggest')) {
            const moods = ['happy', 'love', 'peaceful', 'party', 'motivation'];
            const randomMood = moods[Math.floor(Math.random() * moods.length)];
            songs = getMoodSongs(randomMood);
            response = 'I recommend some ' + randomMood + ' Tamil songs! Enjoy!';
            if (songs.length > 0) playQueue(songs, 0);
        } else if (q.includes('hello') || q.includes('hi') || q.includes('vanakkam')) {
            response = 'Vanakkam! How can I help you find music today? Try asking me to play songs by mood, artist, or decade!';
        } else {
            const all = getAllSongs();
            const words = q.replace(/play|tamil|songs?|for|give|me|the|music|some|good|best|new|find|search/g, '').trim().split(/\s+/);
            songs = all.filter(s => {
                const text = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.genre || '') + ' ' + (s.movie || '')).toLowerCase();
                return words.some(w => w.length > 2 && text.includes(w));
            });
            if (songs.length > 0) {
                response = 'Found ' + songs.length + ' songs for you!';
                playQueue(songs, 0);
            } else {
                response = 'I couldn\'t find specific matches. Try asking me to play by mood (happy, sad, love), by artist (Ilaiyaraaja, AR Rahman), or by decade (90s, 80s)!';
            }
        }

        setTimeout(() => {
            messages.innerHTML += '<div class="ai-ask-msg ai-ask-bot"><div class="ai-ask-avatar"><i class="fas fa-robot"></i></div><div class="ai-ask-bubble">' + response + '</div></div>';
            messages.scrollTop = messages.scrollHeight;
        }, 500);

        if (input) input.value = '';
    }

    /* ---- 8. MOVIE UNIVERSE ---- */
    function renderMovieUniverse() {
        const container = document.getElementById('movieUniversePage');
        if (!container) return;
        const movies = getMovies();
        let html = '<div class="universe-header">';
        html += '<h2><i class="fas fa-film"></i> Movie Music Universe</h2>';
        html += '<div class="universe-search"><input type="text" id="movieUniverseSearch" placeholder="Search movies..." oninput="AIFeatures.filterMovies(this.value)"></div>';
        html += '</div>';
        html += '<div class="universe-grid" id="movieUniverseGrid">';
        movies.forEach((m, i) => {
            html += '<div class="universe-card" data-movie="' + escapeHtml(m.name) + '" onclick="AIFeatures.openMovieDetail(' + i + ')">';
            html += '<div class="universe-card-art" style="background:linear-gradient(135deg,hsl(' + (i * 37 % 360) + ',60%,30%),hsl(' + (i * 53 % 360) + ',50%,20%))">';
            html += '<i class="fas fa-film"></i></div>';
            html += '<div class="universe-card-info"><h4>' + escapeHtml(m.name) + '</h4>';
            html += '<p>' + m.songs.length + ' songs &middot; ' + (m.year || '') + '</p>';
            html += '<p class="universe-card-artist">' + escapeHtml(m.singer || m.composer || '') + '</p></div></div>';
        });
        html += '</div>';
        container.innerHTML = html;
        window._movies = movies;
    }

    function filterMovies(query) {
        const cards = document.querySelectorAll('#movieUniverseGrid .universe-card');
        const q = query.toLowerCase();
        cards.forEach(card => {
            const name = (card.dataset.movie || '').toLowerCase();
            card.style.display = name.includes(q) ? '' : 'none';
        });
    }

    function openMovieDetail(idx) {
        const movies = window._movies || [];
        const movie = movies[idx];
        if (!movie) return;
        let html = '<div class="universe-detail-panel">';
        html += '<div class="ai-creator-header"><h3><i class="fas fa-film"></i> ' + escapeHtml(movie.name) + '</h3>';
        html += '<button class="ai-panel-close" onclick="AIFeatures.closeUniverseDetail()"><i class="fas fa-times"></i></button></div>';
        html += '<div class="universe-detail-body">';
        html += '<div class="universe-detail-info">';
        if (movie.year) html += '<span class="ud-tag"><i class="fas fa-calendar"></i> ' + movie.year + '</span>';
        if (movie.composer) html += '<span class="ud-tag"><i class="fas fa-music"></i> ' + escapeHtml(movie.composer) + '</span>';
        if (movie.lyricist) html += '<span class="ud-tag"><i class="fas fa-pen"></i> ' + escapeHtml(movie.lyricist) + '</span>';
        html += '</div>';
        html += '<button class="ai-play-all-btn" onclick="AIFeatures.playMovieSongs(' + idx + ')"><i class="fas fa-play"></i> Play All Songs</button>';
        html += '<div class="ai-playlist-songs">';
        movie.songs.forEach((s, i) => {
            html += '<div class="ai-pl-song" onclick="AIFeatures.playMovieSong(' + idx + ',' + i + ')">';
            html += '<span class="ai-pl-num">' + (i + 1) + '</span>';
            html += '<div class="ai-pl-info"><div class="ai-pl-title">' + escapeHtml(s.title || s.name || '') + '</div>';
            html += '<div class="ai-pl-artist">' + escapeHtml(s.artist || s.singer || '') + '</div></div></div>';
        });
        html += '</div></div></div>';
        showOverlayPanel(html);
    }

    function closeUniverseDetail() { hideOverlayPanel(); }

    function playMovieSongs(idx) {
        const movies = window._movies || [];
        if (movies[idx]) playQueue(movies[idx].songs, 0);
    }

    function playMovieSong(movieIdx, songIdx) {
        const movies = window._movies || [];
        if (movies[movieIdx]) playQueue(movies[movieIdx].songs, songIdx);
    }

    /* ---- 9. ARTIST UNIVERSE ---- */
    function renderArtistUniverse() {
        const container = document.getElementById('artistUniversePage');
        if (!container) return;
        const artists = getAllArtists();
        let html = '<div class="universe-header">';
        html += '<h2><i class="fas fa-users"></i> Artist Universe</h2>';
        html += '<div class="universe-search"><input type="text" id="artistUniverseSearch" placeholder="Search artists..." oninput="AIFeatures.filterArtists(this.value)"></div>';
        html += '</div>';
        html += '<div class="universe-grid" id="artistUniverseGrid">';
        artists.forEach((a, i) => {
            const initials = a.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            html += '<div class="universe-card artist-card" data-artist="' + escapeHtml(a.name) + '" onclick="AIFeatures.openArtistDetail(' + i + ')">';
            html += '<div class="universe-card-art artist-avatar" style="background:linear-gradient(135deg,hsl(' + (i * 41 % 360) + ',60%,40%),hsl(' + (i * 67 % 360) + ',50%,30%))">';
            html += '<span>' + initials + '</span></div>';
            html += '<div class="universe-card-info"><h4>' + escapeHtml(a.name) + '</h4>';
            html += '<p>' + a.songs.length + ' songs</p></div></div>';
        });
        html += '</div>';
        container.innerHTML = html;
        window._artists = artists;
    }

    function filterArtists(query) {
        const cards = document.querySelectorAll('#artistUniverseGrid .universe-card');
        const q = query.toLowerCase();
        cards.forEach(card => {
            const name = (card.dataset.artist || '').toLowerCase();
            card.style.display = name.includes(q) ? '' : 'none';
        });
    }

    function openArtistDetail(idx) {
        const artists = window._artists || [];
        const artist = artists[idx];
        if (!artist) return;
        const relatedArtists = artists.filter((a, i) => i !== idx).slice(0, 5);
        let html = '<div class="universe-detail-panel">';
        html += '<div class="ai-creator-header"><h3><i class="fas fa-user"></i> ' + escapeHtml(artist.name) + '</h3>';
        html += '<button class="ai-panel-close" onclick="AIFeatures.closeUniverseDetail()"><i class="fas fa-times"></i></button></div>';
        html += '<div class="universe-detail-body">';
        html += '<div class="universe-detail-info">';
        html += '<span class="ud-tag"><i class="fas fa-music"></i> ' + artist.songs.length + ' songs</span>';
        html += '</div>';
        html += '<button class="ai-play-all-btn" onclick="AIFeatures.playArtistSongs(' + idx + ')"><i class="fas fa-play"></i> Play All Songs</button>';
        html += '<div class="ai-playlist-songs">';
        artist.songs.slice(0, 30).forEach((s, i) => {
            html += '<div class="ai-pl-song" onclick="AIFeatures.playArtistSong(' + idx + ',' + i + ')">';
            html += '<span class="ai-pl-num">' + (i + 1) + '</span>';
            html += '<div class="ai-pl-info"><div class="ai-pl-title">' + escapeHtml(s.title || s.name || '') + '</div>';
            html += '<div class="ai-pl-artist">' + escapeHtml(s.movie || '') + '</div></div></div>';
        });
        html += '</div>';
        if (relatedArtists.length > 0) {
            html += '<div class="universe-related"><h4>Related Artists</h4><div class="universe-related-list">';
            relatedArtists.forEach((ra, i) => {
                html += '<button class="universe-related-btn" onclick="AIFeatures.openArtistDetail(' + artists.indexOf(ra) + ')">' + escapeHtml(ra.name) + ' (' + ra.songs.length + ')</button>';
            });
            html += '</div></div>';
        }
        html += '</div></div>';
        showOverlayPanel(html);
    }

    function playArtistSongs(idx) {
        const artists = window._artists || [];
        if (artists[idx]) playQueue(artists[idx].songs, 0);
    }

    function playArtistSong(artistIdx, songIdx) {
        const artists = window._artists || [];
        if (artists[artistIdx]) playQueue(artists[artistIdx].songs, songIdx);
    }

    /* ---- 10. MUSIC DASHBOARD ---- */
    function renderDashboard() {
        const container = document.getElementById('dashboardPage');
        if (!container) return;
        const songs = getAllSongs();
        const history = (typeof ListeningHistory !== 'undefined') ? ListeningHistory : null;
        let recentlyPlayed = [];
        let continueListening = [];
        let aiPicks = [];
        let totalListeningTime = 0;

        try {
            if (history) {
                if (history.getRecentlyPlayed) recentlyPlayed = history.getRecentlyPlayed() || [];
                if (history.getContinueListening) continueListening = history.getContinueListening() || [];
                if (history.getAIPicks) aiPicks = history.getAIPicks() || [];
            }
        } catch (e) {}

        const artistCount = {};
        const movieCount = {};
        recentlyPlayed.forEach(item => {
            const a = item.artist || item.singer || '';
            const m = item.movie || item.album || '';
            if (a) artistCount[a] = (artistCount[a] || 0) + 1;
            if (m) movieCount[m] = (movieCount[m] || 0) + 1;
        });
        const topArtist = Object.entries(artistCount).sort((a, b) => b[1] - a[1])[0];
        const topMovie = Object.entries(movieCount).sort((a, b) => b[1] - a[1])[0];

        let html = '<div class="dashboard-container">';
        html += '<h2 class="dashboard-title"><i class="fas fa-chart-line"></i> Music Dashboard</h2>';

        html += '<div class="dashboard-stats-grid">';
        html += '<div class="dash-stat-card"><div class="dash-stat-icon" style="background:linear-gradient(135deg,#34d399,#059669)"><i class="fas fa-clock"></i></div><div class="dash-stat-info"><div class="dash-stat-value">' + recentlyPlayed.length + '</div><div class="dash-stat-label">Songs Played</div></div></div>';
        html += '<div class="dash-stat-card"><div class="dash-stat-icon" style="background:linear-gradient(135deg,#a855f7,#7c3aed)"><i class="fas fa-music"></i></div><div class="dash-stat-info"><div class="dash-stat-value">' + songs.length + '</div><div class="dash-stat-label">Total Songs</div></div></div>';
        html += '<div class="dash-stat-card"><div class="dash-stat-icon" style="background:linear-gradient(135deg,#22d3ee,#0ea5e9)"><i class="fas fa-users"></i></div><div class="dash-stat-info"><div class="dash-stat-value">' + getAllArtists().length + '</div><div class="dash-stat-label">Artists</div></div></div>';
        html += '<div class="dash-stat-card"><div class="dash-stat-icon" style="background:linear-gradient(135deg,#f43f5e,#e11d48)"><i class="fas fa-heart"></i></div><div class="dash-stat-info"><div class="dash-stat-value">' + (history && history.getFavorites ? (history.getFavorites() || []).length : 0) + '</div><div class="dash-stat-label">Favorites</div></div></div>';
        html += '</div>';

        if (topArtist) {
            html += '<div class="dash-highlight-card">';
            html += '<div class="dash-hl-icon"><i class="fas fa-star"></i></div>';
            html += '<div class="dash-hl-info"><div class="dash-hl-label">Most Played Artist</div><div class="dash-hl-value">' + escapeHtml(topArtist[0]) + '</div><div class="dash-hl-sub">' + topArtist[1] + ' plays</div></div></div>';
        }
        if (topMovie) {
            html += '<div class="dash-highlight-card">';
            html += '<div class="dash-hl-icon"><i class="fas fa-film"></i></div>';
            html += '<div class="dash-hl-info"><div class="dash-hl-label">Most Played Movie</div><div class="dash-hl-value">' + escapeHtml(topMovie[0]) + '</div><div class="dash-hl-sub">' + topMovie[1] + ' plays</div></div></div>';
        }

        if (recentlyPlayed.length > 0) {
            html += '<div class="dash-section"><h3><i class="fas fa-clock-rotate-left"></i> Recent Activity</h3>';
            html += '<div class="dash-song-list">';
            recentlyPlayed.slice(0, 10).forEach((s, i) => {
                html += '<div class="dash-song-item">';
                html += '<span class="dash-song-num">' + (i + 1) + '</span>';
                html += '<div class="dash-song-info"><div class="dash-song-title">' + escapeHtml(s.title || s.name || '') + '</div>';
                html += '<div class="dash-song-artist">' + escapeHtml(s.artist || s.singer || '') + '</div></div></div>';
            });
            html += '</div></div>';
        }

        if (aiPicks.length > 0) {
            html += '<div class="dash-section"><h3><i class="fas fa-wand-magic-sparkles"></i> AI Picks For You</h3>';
            html += '<div class="dash-song-list">';
            aiPicks.slice(0, 10).forEach((s, i) => {
                html += '<div class="dash-song-item">';
                html += '<span class="dash-song-num">' + (i + 1) + '</span>';
                html += '<div class="dash-song-info"><div class="dash-song-title">' + escapeHtml(s.title || s.name || '') + '</div>';
                html += '<div class="dash-song-artist">' + escapeHtml(s.artist || s.singer || '') + '</div></div></div>';
            });
            html += '</div></div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    /* ---- 11. RECOMMENDATIONS (Home Page) ---- */
    function renderHomeRecommendations() {
        const songs = getAllSongs();
        if (songs.length === 0) return;

        renderContinueListening();
        renderDailyMix();
        renderMadeForYou();
        renderBecauseYouListened();
    }

    function renderContinueListening() {
        const section = document.getElementById('continueListeningSection');
        const track = document.getElementById('continueListeningTrack');
        if (!section || !track) return;
        const history = (typeof ListeningHistory !== 'undefined') ? ListeningHistory : null;
        let items = [];
        try { if (history && history.getContinueListening) items = history.getContinueListening() || []; } catch (e) {}
        if (items.length === 0) { section.style.display = 'none'; return; }
        section.style.display = '';
        track.innerHTML = items.map((s, i) => createSongCardHTML(s, i)).join('');
    }

    function renderDailyMix() {
        const track = document.getElementById('dailyMixTrack');
        if (!track) return;
        const songs = getAllSongs();
        const shuffled = [...songs].sort(() => Math.random() - 0.5).slice(0, 15);
        track.innerHTML = shuffled.map((s, i) => createSongCardHTML(s, i)).join('');
    }

    function renderMadeForYou() {
        const section = document.querySelector('[data-section="ai-recommended"]');
        if (!section) return;
        const track = section.querySelector('.stations-track');
        if (!track) return;
        const songs = getAllSongs();
        const moods = ['happy', 'love', 'peaceful', 'party'];
        const mood = moods[Math.floor(Math.random() * moods.length)];
        const moodSongs = getMoodSongs(mood).slice(0, 10);
        track.innerHTML = moodSongs.map((s, i) => createSongCardHTML(s, i)).join('');
    }

    function renderBecauseYouListened() {
        const history = (typeof ListeningHistory !== 'undefined') ? ListeningHistory : null;
        let recent = [];
        try { if (history && history.getRecentlyPlayed) recent = history.getRecentlyPlayed() || []; } catch (e) {}
        if (recent.length === 0) return;
        const lastArtist = recent[0]?.artist || recent[0]?.singer || '';
        if (!lastArtist) return;
        const songs = getAllSongs().filter(s => (s.artist || s.singer || '').toLowerCase().includes(lastArtist.toLowerCase()));
        if (songs.length === 0) return;
        const section = document.querySelector('[data-section="tamil-hits"]');
        if (!section) return;
        const grid = section.querySelector('.tamil-hits-grid') || section.querySelector('.stations-track');
        if (grid) grid.innerHTML = songs.slice(0, 10).map((s, i) => createSongCardHTML(s, i)).join('');
    }

    function createSongCardHTML(song, index) {
        const title = escapeHtml(song.title || song.name || 'Unknown');
        const artist = escapeHtml(song.artist || song.singer || '');
        const songId = song.id || song.songId || index;
        return '<div class="song-card" data-song-id="' + songId + '" onclick="AIFeatures.playSongFromCard(this)" data-index="' + index + '">' +
            '<div class="song-thumbnail"><i class="fas fa-music"></i><div class="song-play-overlay"><i class="fas fa-play"></i></div></div>' +
            '<div class="song-info"><div class="song-title">' + title + '</div><div class="song-artist">' + artist + '</div></div></div>';
    }

    function playSongFromCard(card) {
        const idx = parseInt(card.dataset.index) || 0;
        const parent = card.closest('.stations-track, .tamil-hits-grid, .dash-song-list, .ai-playlist-songs');
        if (parent) {
            const cards = parent.querySelectorAll('.song-card');
            const songs = [];
            cards.forEach(c => {
                const id = c.dataset.songId;
                const allSongs = getAllSongs();
                const found = allSongs.find(s => (s.id || s.songId || '').toString() === id);
                if (found) songs.push(found);
            });
            if (songs.length > 0) { playQueue(songs, idx); return; }
        }
        const allSongs = getAllSongs();
        if (allSongs[idx]) playQueue(allSongs, idx);
    }

    /* ---- 12. TOP NOTIFICATION ---- */
    let _notifTimeout = null;
    function showTopNotification(track) {
        if (!track) return;
        const existing = document.getElementById('aiTopNotification');
        if (existing) existing.remove();
        clearTimeout(_notifTimeout);

        const title = escapeHtml(track.title || track.name || 'Unknown');
        const artist = escapeHtml(track.artist || track.singer || '');
        const artUrl = track.artwork || track.thumbnail || track.image || '';

        let html = '<div class="ai-top-notif" id="aiTopNotification">';
        html += '<div class="ai-top-notif-inner">';
        html += '<div class="ai-top-notif-art">';
        if (artUrl) html += '<img src="' + artUrl + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="ai-top-notif-placeholder" style="display:none"><i class="fas fa-music"></i></div>';
        else html += '<div class="ai-top-notif-placeholder"><i class="fas fa-music"></i></div>';
        html += '<div class="ai-top-notif-eq"><span></span><span></span><span></span><span></span><span></span></div>';
        html += '</div>';
        html += '<div class="ai-top-notif-info">';
        html += '<div class="ai-top-notif-playing">Now Playing</div>';
        html += '<div class="ai-top-notif-title">' + title + '</div>';
        html += '<div class="ai-top-notif-artist">' + artist + '</div>';
        html += '</div>';
        html += '<div class="ai-top-notif-controls">';
        html += '<button class="ai-top-notif-btn" id="aiTopNotifPlay" onclick="AIFeatures.toggleNotifPlay()"><i class="fas fa-pause"></i></button>';
        html += '<button class="ai-top-notif-btn ai-top-notif-close" onclick="AIFeatures.closeTopNotification()"><i class="fas fa-times"></i></button>';
        html += '</div>';
        html += '</div></div>';
        document.body.insertAdjacentHTML('beforeend', html);

        requestAnimationFrame(() => {
            const notif = document.getElementById('aiTopNotification');
            if (notif) notif.classList.add('visible');
        });

        _notifTimeout = setTimeout(() => { closeTopNotification(); }, 5000);
    }

    function closeTopNotification() {
        const notif = document.getElementById('aiTopNotification');
        if (notif) {
            notif.classList.remove('visible');
            setTimeout(() => notif.remove(), 400);
        }
    }

    function toggleNotifPlay() {
        const btn = document.getElementById('aiTopNotifPlay');
        if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.togglePlay) GlobalPlayer.togglePlay();
        else if (typeof PlayerEngine !== 'undefined') PlayerEngine.togglePlay();
    }

    /* ---- 13. SYNCHRONIZED LYRICS ---- */
    function showLyricsWithSync(track) {
        if (!track || !track.lyrics) return;
        const lines = track.lyrics.split('\n').filter(l => l.trim());
        const container = document.getElementById('ytmLyricsContent') || document.querySelector('.ytm-lyrics-body');
        if (!container) return;
        container.innerHTML = lines.map((line, i) => '<div class="lyrics-line" data-idx="' + i + '">' + escapeHtml(line) + '</div>').join('');
        syncLyricsHighlight(track);
    }

    function syncLyricsHighlight(track) {
        const ap = window.audioPlayer || (typeof PlayerEngine !== 'undefined' && PlayerEngine.audio);
        if (!ap) return;
        const lines = document.querySelectorAll('.lyrics-line');
        if (lines.length === 0) return;
        const interval = setInterval(() => {
            const current = ap.currentTime || 0;
            const duration = ap.duration || 1;
            const pct = current / duration;
            const activeIdx = Math.floor(pct * lines.length);
            lines.forEach((line, i) => {
                line.classList.toggle('active', i === activeIdx);
                if (i === activeIdx) line.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            if (ap.paused || ap.ended) clearInterval(interval);
        }, 500);
    }

    /* ---- AI SONG STORY ---- */
    function showSongStory(track) {
        if (!track) return;
        let html = '<div class="ai-song-story-panel">';
        html += '<div class="ai-creator-header"><h3><i class="fas fa-book-open"></i> AI Song Story</h3>';
        html += '<button class="ai-panel-close" onclick="AIFeatures.closeUniverseDetail()"><i class="fas fa-times"></i></button></div>';
        html += '<div class="ai-song-story-body">';
        html += '<div class="ai-story-header">';
        const art = track.artwork || track.thumbnail || '';
        if (art) html += '<img class="ai-story-art" src="' + art + '" alt="" onerror="this.style.display=\'none\'">';
        html += '<div class="ai-story-info">';
        html += '<h3>' + escapeHtml(track.title || track.name || '') + '</h3>';
        html += '<p>' + escapeHtml(track.artist || track.singer || '') + '</p>';
        html += '</div></div>';
        html += '<div class="ai-story-details">';
        if (track.movie) html += '<div class="ai-story-row"><i class="fas fa-film"></i><span>Movie:</span><strong>' + escapeHtml(track.movie) + '</strong></div>';
        if (track.composer) html += '<div class="ai-story-row"><i class="fas fa-music"></i><span>Composer:</span><strong>' + escapeHtml(track.composer) + '</strong></div>';
        if (track.lyricist) html += '<div class="ai-story-row"><i class="fas fa-pen"></i><span>Lyricist:</span><strong>' + escapeHtml(track.lyricist) + '</strong></div>';
        if (track.year) html += '<div class="ai-story-row"><i class="fas fa-calendar"></i><span>Year:</span><strong>' + track.year + '</strong></div>';
        if (track.album) html += '<div class="ai-story-row"><i class="fas fa-compact-disc"></i><span>Album:</span><strong>' + escapeHtml(track.album) + '</strong></div>';
        html += '</div>';
        html += '<div class="ai-story-actions">';
        html += '<button onclick="AIFeatures.explainSong()"><i class="fas fa-lightbulb"></i> Explain Lyrics</button>';
        html += '<button onclick="AIFeatures.translateSong()"><i class="fas fa-language"></i> Translate</button>';
        html += '<button onclick="AIFeatures.songMeaning()"><i class="fas fa-brain"></i> Song Meaning</button>';
        html += '</div>';
        html += '<div id="aiStoryOutput" class="ai-story-output"></div>';
        html += '</div></div>';
        window._currentStoryTrack = track;
        showOverlayPanel(html);
    }

    function explainSong() {
        const track = window._currentStoryTrack;
        const output = document.getElementById('aiStoryOutput');
        if (!track || !output) return;
        output.innerHTML = '<div class="ai-story-response"><p>This song "' + escapeHtml(track.title || track.name || '') + '" is a Tamil ' + (track.genre || 'film') + ' song' + (track.movie ? ' from the movie ' + escapeHtml(track.movie) : '') + (track.artist ? ', performed by ' + escapeHtml(track.artist || track.singer || '') : '') + '. ' + (track.composer ? 'Composed by ' + escapeHtml(track.composer) + '.' : '') + ' The lyrics convey deep emotional expressions typical of Tamil film music, blending poetic imagery with musical brilliance.</p></div>';
    }

    function translateSong() {
        const track = window._currentStoryTrack;
        const output = document.getElementById('aiStoryOutput');
        if (!track || !output) return;
        output.innerHTML = '<div class="ai-story-response"><p><strong>Translation:</strong> The song "' + escapeHtml(track.title || track.name || '') + '" expresses themes of ' + (['love', 'longing', 'joy', 'devotion', 'life'][Math.floor(Math.random() * 5)]) + '. Tamil film songs are known for their poetic depth and cultural richness, often conveying complex emotions through metaphor and nature imagery.</p></div>';
    }

    function songMeaning() {
        const track = window._currentStoryTrack;
        const output = document.getElementById('aiStoryOutput');
        if (!track || !output) return;
        output.innerHTML = '<div class="ai-story-response"><p><strong>Song Meaning:</strong> "' + escapeHtml(track.title || track.name || '') + '" captures the essence of ' + (['human connection', 'nature\'s beauty', 'the journey of life', 'celebration of culture', 'the power of music'][Math.floor(Math.random() * 5)]) + '. The lyrical composition blends traditional Tamil poetic forms with contemporary musical sensibilities.</p></div>';
    }

    /* ---- OVERLAY PANEL HELPER ---- */
    function showOverlayPanel(html) {
        let panel = document.getElementById('aiOverlayPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'aiOverlayPanel';
            panel.className = 'ai-overlay-panel';
            panel.addEventListener('click', (e) => { if (e.target === panel) hideOverlayPanel(); });
            document.body.appendChild(panel);
        }
        panel.innerHTML = '<div class="ai-overlay-content">' + html + '</div>';
        panel.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function hideOverlayPanel() {
        const panel = document.getElementById('aiOverlayPanel');
        if (panel) {
            panel.classList.remove('visible');
            document.body.style.overflow = '';
            setTimeout(() => panel.remove(), 300);
        }
    }

    /* ---- UTILITY ---- */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatTime(sec) {
        if (!sec || !isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function showToast(msg, type) {
        if (typeof window.showToast === 'function') window.showToast(msg, type);
    }

    /* ---- INIT ---- */
    function init() {
        if (_initialized) return;
        _initialized = true;

        _allSongs = [];
        _allArtists = [];
        _allStations = [];

        initMoodPlayer();

        if (typeof YTMusic !== 'undefined') {
            const origNavigate = YTMusic.navigateTo;
            if (typeof origNavigate === 'function') {
                YTMusic.navigateTo = function(page) {
                    if (page === 'dashboard') renderDashboard();
                    if (page === 'artist-universe') renderArtistUniverse();
                    if (page === 'movie-universe') renderMovieUniverse();
                    return origNavigate.call(this, page);
                };
            }
        }

        renderHomeRecommendations();

        setTimeout(() => {
            const track = (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.state) ? GlobalPlayer.state.track : null;
            if (track) showTopNotification(track);
        }, 1000);
    }

    function onTrackChange(track) {
        showTopNotification(track);
        syncLyricsHighlight(track);
    }

    return {
        init,
        onTrackChange,
        openAICreator,
        closeAICreator,
        generateAICreatorPlaylist,
        playCreatorQueue,
        playCreatorSong,
        openAIRadioGenerator,
        closeAIRadio,
        playAIRadio,
        openPersonalFM,
        closePersonalFM,
        playPersonalFM,
        openVoiceSearch,
        closeVoiceSearch,
        openLyricsSearch,
        closeLyricsSearch,
        performLyricsSearch,
        openAskAI,
        closeAskAI,
        sendAskAI,
        renderMovieUniverse,
        filterMovies,
        openMovieDetail,
        closeUniverseDetail,
        playMovieSongs,
        playMovieSong,
        renderArtistUniverse,
        filterArtists,
        openArtistDetail,
        playArtistSongs,
        playArtistSong,
        renderDashboard,
        renderHomeRecommendations,
        showTopNotification,
        closeTopNotification,
        toggleNotifPlay,
        showLyricsWithSync,
        showSongStory,
        explainSong,
        translateSong,
        songMeaning,
        playSongFromCard,
        getMoodSongs,
        getAllSongs,
        escapeHtml
    };
})();

/* ---- Global function wrappers for onclick handlers ---- */
function openAIMusicAssistant() { AIFeatures.openAICreator(); }
function openAskAI() { AIFeatures.openAskAI(); }
function openAIRadioGenerator() { AIFeatures.openAIRadioGenerator(); }
function openPersonalFM() { AIFeatures.openPersonalFM(); }
function openVoiceSearch() { AIFeatures.openVoiceSearch(); }
function openLyricsSearch() { AIFeatures.openLyricsSearch(); }

/* ---- Hook into GlobalPlayer track changes ---- */
if (typeof GlobalPlayer !== 'undefined') {
    const origHook = GlobalPlayer.init;
    if (typeof origHook === 'function') {
        const _origInit = GlobalPlayer.init;
        GlobalPlayer.init = function() {
            _origInit.call(this);
            try {
                if (typeof PlayerEngine !== 'undefined') {
                    PlayerEngine.on('trackChange', (s) => {
                        if (s && s.currentTrack) AIFeatures.onTrackChange(s.currentTrack);
                    });
                }
            } catch (e) {}
        };
    }
}
