'use strict';

/* ============================================
   AI Music Assistant - Enhanced Conversational
   Music Recommendations, Player Control, Navigation
   ============================================ */

const AIMusicAssistant = (() => {
    let conversationHistory = [];
    let sessionContext = {};
    let isSpeaking = false;
    let speechSynth = window.speechSynthesis;
    let recognition = null;
    let isListening = false;
    const MAX_HISTORY = 100;

    const MOODS = ['happy', 'sad', 'energy', 'chill', 'focus', 'party', 'romantic', 'workout', 'morning', 'night', 'rainy', 'celebration'];

    const INTENT_MAP = [
        { intent: 'play', patterns: ['play', 'listen', 'stream', 'start', 'put on', 'hear', 'play song', 'play music'] },
        { intent: 'pause', patterns: ['pause', 'stop', 'halt', 'wait'] },
        { intent: 'resume', patterns: ['resume', 'continue', 'unpause', 'go on'] },
        { intent: 'next', patterns: ['next', 'skip', 'forward'] },
        { intent: 'previous', patterns: ['previous', 'back', 'go back'] },
        { intent: 'shuffle', patterns: ['shuffle', 'random', 'mix', 'shuffle play'] },
        { intent: 'repeat', patterns: ['repeat', 'loop', 'repeat all', 'repeat one'] },
        { intent: 'volume_up', patterns: ['volume up', 'louder', 'increase volume', 'turn up'] },
        { intent: 'volume_down', patterns: ['volume down', 'quieter', 'decrease volume', 'turn down'] },
        { intent: 'mute', patterns: ['mute', 'silent', 'silence'] },
        { intent: 'search', patterns: ['search', 'find', 'look for', 'show me', 'where is'] },
        { intent: 'recommend_mood', patterns: ['recommend', 'suggest', 'what should i listen', 'mood', 'feeling'] },
        { intent: 'recommend_artist', patterns: ['artist', 'singer', 'who sings', 'composer'] },
        { intent: 'recommend_trending', patterns: ['trending', 'popular', 'top', 'hot', 'best', 'chart'] },
        { intent: 'recommend_similar', patterns: ['similar', 'like this', 'more like', 'same style'] },
        { intent: 'recommend_recent', patterns: ['new', 'recent', 'latest', 'fresh', 'just added'] },
        { intent: 'create_playlist', patterns: ['create playlist', 'make playlist', 'new playlist', 'save playlist'] },
        { intent: 'show_queue', patterns: ['queue', 'up next', 'playing next'] },
        { intent: 'show_favorites', patterns: ['favorites', 'liked', 'my songs', 'heart'] },
        { intent: 'show_history', patterns: ['history', 'recently played', 'played before'] },
        { intent: 'show_lyrics', patterns: ['lyrics', 'words', 'what are the words'] },
        { intent: 'equalizer', patterns: ['equalizer', 'eq', 'bass', 'treble', 'boost', 'preset'] },
        { intent: 'navigate', patterns: ['go to', 'open', 'take me to', 'navigate', 'page'] },
        { intent: 'sleep_timer', patterns: ['sleep timer', 'timer', 'sleep', 'auto stop'] },
        { intent: 'share', patterns: ['share', 'send'] },
        { intent: 'download', patterns: ['download', 'save offline'] },
        { intent: 'status', patterns: ['what playing', 'now playing', 'current', 'status', 'who is'] },
        { intent: 'help', patterns: ['help', 'what can you', 'features', 'how do'] },
        { intent: 'greeting', patterns: ['hello', 'hi', 'hey', 'vanakkam', 'good morning', 'good evening', 'good night'] },
        { intent: 'thanks', patterns: ['thanks', 'thank you', 'appreciate'] }
    ];

    const NAVIGATION_MAP = {
        home: '/', index: '/', main: '/',
        search: '/#search', explore: '/#explore',
        library: '/#library', liked: '/#liked', favorites: '/#liked',
        playlists: '/#playlists', history: '/#history',
        stations: '/#stations', artists: '/#artists',
        settings: '/#settings', profile: '/profile',
        builder: '/builder', admin: '/admin',
        login: '/login', help: '/#help'
    };

    function tokenize(text) {
        return text.toLowerCase().replace(/[^\w\s\u0B80-\u0BFF]/g, ' ').split(/\s+/).filter(Boolean);
    }

    function matchScore(query, keywords) {
        const qTokens = tokenize(query);
        const kTokens = tokenize(keywords);
        let score = 0;
        for (const qt of qTokens) {
            for (const kt of kTokens) {
                if (kt === qt) score += 3;
                else if (kt.startsWith(qt) || qt.startsWith(kt)) score += 2;
                else if (kt.includes(qt) || qt.includes(kt)) score += 1;
            }
        }
        return score / Math.max(qTokens.length, 1);
    }

    function detectIntent(text) {
        const q = text.toLowerCase().trim();
        let best = { intent: 'unknown', score: 0 };
        for (const { intent, patterns } of INTENT_MAP) {
            for (const p of patterns) {
                if (q.includes(p)) {
                    const s = matchScore(p, q);
                    if (s > best.score) best = { intent, score: s };
                }
            }
        }
        return best.intent;
    }

    function searchContent(query) {
        const songs = DataStore.getSongs ? DataStore.getSongs().filter(s => s.status === 'published') : [];
        const stations = DataStore.getStations ? DataStore.getStations() : [];
        const results = { songs: [], stations: [], artists: [] };

        for (const s of songs) {
            const score = matchScore(query, `${s.title} ${s.artist || ''} ${s.movie || ''} ${s.genre || ''}`);
            if (score > 0.3) results.songs.push({ ...s, _score: score });
        }
        for (const s of stations) {
            const score = matchScore(query, `${s.name} ${s.freq || ''} ${s.genre || ''}`);
            if (score > 0.3) results.stations.push({ ...s, _score: score });
        }

        const artistMap = {};
        songs.forEach(s => {
            if (s.artist) {
                if (!artistMap[s.artist]) artistMap[s.artist] = { name: s.artist, count: 0, songs: [] };
                artistMap[s.artist].count++;
                artistMap[s.artist].songs.push(s);
            }
        });
        for (const a of Object.values(artistMap)) {
            const score = matchScore(query, a.name);
            if (score > 0.3) results.artists.push({ ...a, _score: score });
        }

        results.songs.sort((a, b) => b._score - a._score);
        results.stations.sort((a, b) => b._score - a._score);
        results.artists.sort((a, b) => b._score - a._score);
        return results;
    }

    function executeAction(action, data) {
        switch (action) {
            case 'play_song':
                if (data.audioUrl) {
                    PlayerEngine.playTrack(data, [data], 0);
                    return `Now playing **${data.title}** by ${data.artist || 'Unknown'}`;
                }
                return `I found **${data.title}** but it doesn't have a playable URL.`;
            case 'play_station':
                if (typeof playStation === 'function') playStation(data.name);
                return `Now playing **${data.name}** (${data.freq || ''})`;
            case 'play_artist':
                if (data.songs && data.songs.length) {
                    PlayerEngine.playTrack(data.songs[0], data.songs, 0);
                    return `Playing **${data.name}** hits (${data.count} songs)`;
                }
                return `I found **${data.name}** but couldn't load their songs.`;
            case 'pause':
                PlayerEngine.pause();
                return 'Paused.';
            case 'resume':
                PlayerEngine.play();
                return 'Resumed.';
            case 'next':
                PlayerEngine.playNext();
                return 'Playing next track.';
            case 'previous':
                PlayerEngine.playPrevious();
                return 'Playing previous track.';
            case 'shuffle':
                PlayerEngine.toggleShuffle();
                return PlayerEngine.shuffle ? 'Shuffle on.' : 'Shuffle off.';
            case 'repeat':
                PlayerEngine.cycleRepeat();
                return `Repeat: ${PlayerEngine.repeat}`;
            case 'volume_up':
                PlayerEngine.setVolume(PlayerEngine.volume + 0.1);
                return `Volume: ${Math.round(PlayerEngine.volume * 100)}%`;
            case 'volume_down':
                PlayerEngine.setVolume(PlayerEngine.volume - 0.1);
                return `Volume: ${Math.round(PlayerEngine.volume * 100)}%`;
            case 'mute':
                PlayerEngine.toggleMute();
                return PlayerEngine.getState().muted ? 'Muted.' : 'Unmuted.';
            case 'navigate':
                if (data.url) { window.location.href = data.url; return `Opening **${data.page}**...`; }
                break;
            case 'sleep_timer':
                PlayerEngine.setSleepTimer(data.minutes || 30);
                return `Sleep timer set for ${data.minutes || 30} minutes.`;
            case 'share':
                if (navigator.share) navigator.share({ title: data.title, text: `Listening to ${data.title} on Tamil AI FM` });
                else navigator.clipboard?.writeText(`Listening to ${data.title} on Tamil AI FM`);
                return 'Shared!';
            case 'download':
                PlaylistManager.addDownload(data);
                return `Downloaded **${data.title || data.name}** for offline listening.`;
        }
        return null;
    }

    function generateResponse(text) {
        const intent = detectIntent(text);
        const results = searchContent(text);
        sessionContext.lastIntent = intent;
        sessionContext.lastQuery = text;

        switch (intent) {
            case 'greeting': {
                const hour = new Date().getHours();
                let timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
                const greetings = [
                    `${timeGreeting}! I'm your AI music assistant. What would you like to listen to?`,
                    `Hey! Ready to play some music? Just tell me what you're in the mood for.`,
                    `Welcome back! I can recommend songs by mood, play stations, or search for anything.`
                ];
                return { text: greetings[Math.floor(Math.random() * greetings.length)], suggestions: ['Play radio', 'Recommend songs', 'Show trending'] };
            }

            case 'play': {
                if (results.songs.length > 0) {
                    const s = results.songs[0];
                    const action = executeAction('play_song', s);
                    return { text: action, suggestions: ['Next', 'Shuffle', 'Add to favorites'] };
                }
                if (results.stations.length > 0) {
                    const s = results.stations[0];
                    const action = executeAction('play_station', s);
                    return { text: action, suggestions: ['Pause', 'Volume up', 'Queue'] };
                }
                if (results.artists.length > 0) {
                    const a = results.artists[0];
                    const action = executeAction('play_artist', a);
                    return { text: action, suggestions: ['Next', 'Shuffle', 'More by artist'] };
                }
                return { text: "I couldn't find a match. Try a song title, artist name, or station name.", suggestions: ['Show stations', 'Show artists', 'Help'] };
            }

            case 'pause': { executeAction('pause'); return { text: 'Paused. Say "resume" to continue.' }; }
            case 'resume': { executeAction('resume'); return { text: 'Resumed playing.' }; }
            case 'next': { executeAction('next'); return { text: 'Playing next track.' }; }
            case 'previous': { executeAction('previous'); return { text: 'Playing previous track.' }; }
            case 'shuffle': { executeAction('shuffle'); return { text: `Shuffle ${PlayerEngine.shuffle ? 'enabled' : 'disabled'}.` }; }
            case 'repeat': { executeAction('repeat'); return { text: `Repeat: ${PlayerEngine.repeat}` }; }
            case 'volume_up': { executeAction('volume_up'); return { text: `Volume: ${Math.round(PlayerEngine.volume * 100)}%` }; }
            case 'volume_down': { executeAction('volume_down'); return { text: `Volume: ${Math.round(PlayerEngine.volume * 100)}%` }; }
            case 'mute': { executeAction('mute'); return { text: PlayerEngine.getState().muted ? 'Muted.' : 'Unmuted.' }; }

            case 'recommend_mood': {
                const q = text.toLowerCase();
                let mood = MOODS.find(m => q.includes(m)) || 'happy';
                const songs = PlaylistManager.getRecommendationsByMood(mood);
                if (songs.length) {
                    const cards = songs.slice(0, 5).map(s => ({ title: s.title, artist: s.artist || '', action: 'play_song', data: s }));
                    return { text: `Here are **${mood}** songs for you:`, cards, suggestions: ['Play all', 'Shuffle', 'Show more'] };
                }
                return { text: `I don't have specific ${mood} songs yet. Try asking for a genre or artist!`, suggestions: ['Show all songs', 'Show stations'] };
            }

            case 'recommend_artist': {
                if (results.artists.length > 0) {
                    const a = results.artists[0];
                    return { text: `**${a.name}** has **${a.count} songs**. Would you like to play them?`, cards: [{ title: `Play ${a.name}`, sub: `${a.count} songs`, action: 'play_artist', data: a }], suggestions: [`Play ${a.name}`, 'Show songs'] };
                }
                const artists = DataStore.getArtistHits ? DataStore.getArtistHits().filter(a => a.status === 'active') : [];
                if (artists.length) {
                    const cards = artists.slice(0, 6).map(a => ({ title: a.name, sub: `${a.songCount || 0} songs`, action: 'play_artist', data: a }));
                    return { text: `Here are popular artists:`, cards };
                }
                return { text: 'No artist data available. Try searching for a specific artist name.' };
            }

            case 'recommend_trending': {
                const trending = DataStore.getTrending ? DataStore.getTrending().filter(t => t.status === 'active') : [];
                const stations = DataStore.getStations ? DataStore.getStations() : [];
                if (trending.length) {
                    const cards = trending.slice(0, 5).map(t => {
                        const s = stations.find(st => st.id === t.stationId) || {};
                        return { title: s.name || 'Station', sub: `${s.freq || ''} - ${s.genre || ''}`, action: 'play_station', data: s };
                    });
                    return { text: `Here are the **top trending** stations:`, cards, suggestions: ['Play top', 'Show all'] };
                }
                return { text: 'No trending stations right now. Try exploring categories!', suggestions: ['Show categories', 'Show stations'] };
            }

            case 'recommend_similar': {
                const track = PlayerEngine.currentTrack;
                if (track) {
                    const similar = PlaylistManager.getSimilarSongs(track, 10);
                    if (similar.length) {
                        const cards = similar.slice(0, 5).map(s => ({ title: s.title, artist: s.artist || '', action: 'play_song', data: s }));
                        return { text: `Songs similar to **${track.title || track.name}**:`, cards, suggestions: ['Play all', 'Shuffle'] };
                    }
                }
                return { text: 'Play a song first, then ask for similar songs!' };
            }

            case 'recommend_recent': {
                const recent = PlaylistManager.getRecentlyAdded(10);
                if (recent.length) {
                    const cards = recent.slice(0, 5).map(s => ({ title: s.title, artist: s.artist || '', action: 'play_song', data: s }));
                    return { text: `Recently added songs:`, cards, suggestions: ['Play all', 'Show more'] };
                }
                return { text: 'No recently added songs found.' };
            }

            case 'create_playlist': {
                const name = text.replace(/create playlist|make playlist|new playlist/gi, '').trim() || 'My Playlist';
                const pl = PlaylistManager.createPlaylist(name);
                return { text: `Created playlist **"${pl.name}"**! Add songs to it from the library.`, suggestions: ['Show playlists', 'Add songs'] };
            }

            case 'show_queue': {
                const queue = PlayerEngine.queue;
                if (queue.length) {
                    const current = queue[PlayerEngine.queueIndex];
                    const next = queue.slice(PlayerEngine.queueIndex + 1, PlayerEngine.queueIndex + 4);
                    let text = `Now playing: **${current?.title || current?.name || 'None'}**\n`;
                    if (next.length) text += '\nUp next:\n' + next.map((s, i) => `${i + 1}. ${s.title || s.name}`).join('\n');
                    return { text, suggestions: ['Shuffle queue', 'Clear queue'] };
                }
                return { text: 'Queue is empty. Add songs to start building your queue!' };
            }

            case 'show_favorites': {
                const favs = PlaylistManager.getFavorites();
                if (favs.length) {
                    const cards = favs.slice(0, 5).map(s => ({ title: s.title || s.name, artist: s.artist || '', action: 'play_song', data: s }));
                    return { text: `You have **${favs.length} favorite** songs:`, cards, suggestions: ['Play all', 'Shuffle favorites'] };
                }
                return { text: 'No favorites yet! Heart songs to add them here.', suggestions: ['Show songs', 'Show stations'] };
            }

            case 'show_history': {
                const recent = PlaylistManager.getRecentlyPlayed(10);
                if (recent.length) {
                    const cards = recent.slice(0, 5).map(s => ({ title: s.title || s.name, artist: s.artist || '', action: 'play_song', data: s }));
                    return { text: `Recently played:`, cards };
                }
                return { text: 'No listening history yet.' };
            }

            case 'equalizer': {
                if (text.includes('bass')) { Equalizer.applyPreset('bass'); return { text: 'Bass boost applied!', suggestions: ['Reset EQ', 'Show presets'] }; }
                if (text.includes('treble')) { Equalizer.applyPreset('treble'); return { text: 'Treble boost applied!', suggestions: ['Reset EQ', 'Show presets'] }; }
                if (text.includes('vocal')) { Equalizer.applyPreset('vocal'); return { text: 'Vocal boost applied!', suggestions: ['Reset EQ', 'Show presets'] }; }
                if (text.includes('reset')) { Equalizer.reset(); return { text: 'Equalizer reset to flat.', suggestions: ['Bass boost', 'Treble boost'] }; }
                const presets = Equalizer.getPresetNames();
                return { text: `Available EQ presets: **${presets.join(', ')}**\n\nSay a preset name to apply it.`, suggestions: ['Bass boost', 'Rock preset', 'Pop preset'] };
            }

            case 'navigate': {
                const q = text.toLowerCase();
                for (const [key, url] of Object.entries(NAVIGATION_MAP)) {
                    if (q.includes(key)) {
                        window.location.href = url;
                        return { text: `Opening **${key}**...` };
                    }
                }
                return { text: 'Which page would you like to open?', suggestions: ['Home', 'Library', 'Search', 'Settings'] };
            }

            case 'sleep_timer': {
                const match = text.match(/(\d+)/);
                const mins = match ? parseInt(match[1]) : 30;
                executeAction('sleep_timer', { minutes: mins });
                return { text: `Sleep timer set for **${mins} minutes**.`, suggestions: ['Cancel timer', 'Set 15 min'] };
            }

            case 'share': {
                const track = PlayerEngine.currentTrack;
                if (track) { executeAction('share', track); return { text: 'Shared to clipboard!' }; }
                return { text: 'Nothing is playing to share.' };
            }

            case 'download': {
                const track = PlayerEngine.currentTrack;
                if (track) { executeAction('download', track); return { text: `Downloaded **${track.title || track.name}**!` }; }
                return { text: 'Nothing is playing to download.' };
            }

            case 'status': {
                const track = PlayerEngine.currentTrack;
                if (track) {
                    const state = PlayerEngine.getState();
                    return { text: `Now playing: **${track.title || track.name}** by ${track.artist || 'Unknown'}\n\nVolume: ${Math.round(state.volume * 100)}% | Shuffle: ${state.shuffle ? 'On' : 'Off'} | Repeat: ${state.repeat}`, suggestions: ['Pause', 'Next', 'Show queue'] };
                }
                return { text: 'Nothing is currently playing.', suggestions: ['Play radio', 'Show trending'] };
            }

            case 'search': {
                const total = results.songs.length + results.stations.length + results.artists.length;
                if (total === 0) return { text: `No results for "**${text}**". Try different keywords.`, suggestions: ['Show all songs', 'Show stations'] };
                let textResp = `Found **${total}** results:\n`;
                const cards = [];
                results.songs.slice(0, 3).forEach(s => { textResp += `\n- Song: ${s.title} by ${s.artist || '?'}`; cards.push({ title: s.title, artist: s.artist || '', action: 'play_song', data: s }); });
                results.stations.slice(0, 3).forEach(s => { textResp += `\n- Station: ${s.name} (${s.freq || ''})`; cards.push({ title: s.name, sub: s.genre || '', action: 'play_station', data: s }); });
                results.artists.slice(0, 2).forEach(a => { textResp += `\n- Artist: ${a.name} (${a.count} songs)`; cards.push({ title: a.name, sub: `${a.count} songs`, action: 'play_artist', data: a }); });
                return { text: textResp, cards, suggestions: ['Play first result', 'Show more'] };
            }

            case 'help': {
                return {
                    text: `I can help you with:\n\n- **Play** songs, stations, or artists\n- **Control** playback (pause, next, previous, shuffle, repeat)\n- **Volume** control\n- **Search** for songs, artists, stations\n- **Recommend** songs by mood or genre\n- **Create** playlists\n- **Navigate** pages\n- **Equalizer** presets\n- **Sleep timer**\n- **Share** or **download** songs\n\nJust speak or type naturally!`,
                    suggestions: ['Play radio', 'Recommend songs', 'Show trending']
                };
            }

            case 'thanks': {
                return { text: 'You\'re welcome! Enjoy the music! 🎵', suggestions: ['Play something', 'Show queue'] };
            }

            default: {
                if (results.songs.length || results.stations.length || results.artists.length) {
                    return generateResponse('play ' + text);
                }
                return {
                    text: `I'm not sure I understand. Try:\n- "Play [song/station name]"\n- "Recommend [mood] songs"\n- "Show trending"\n- "Help"`,
                    suggestions: ['Help', 'Play radio', 'Recommend songs']
                };
            }
        }
    }

    /* ---- Voice Output ---- */
    function speak(text) {
        if (!speechSynth) return;
        speechSynth.cancel();
        const clean = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n/g, '. ').replace(/[#*\-]/g, '');
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        isSpeaking = true;
        utterance.onend = () => { isSpeaking = false; };
        speechSynth.speak(utterance);
    }

    function stopSpeaking() {
        if (speechSynth) speechSynth.cancel();
        isSpeaking = false;
    }

    /* ---- Voice Input ---- */
    function initVoiceInput(onResult) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return null;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (e) => {
            const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
            onResult(transcript, e.results[0].isFinal);
        };
        recognition.onend = () => { isListening = false; };
        recognition.onerror = () => { isListening = false; };
        return recognition;
    }

    function startListening() {
        if (recognition) { isListening = true; recognition.start(); }
    }

    function stopListening() {
        if (recognition) { isListening = false; recognition.stop(); }
    }

    /* ---- Conversation History ---- */
    function addToHistory(role, text) {
        conversationHistory.push({ role, text, time: Date.now() });
        if (conversationHistory.length > MAX_HISTORY) conversationHistory.shift();
        try { localStorage.setItem('ai_music_history', JSON.stringify(conversationHistory)); } catch {}
    }

    function loadHistory() {
        try {
            const h = JSON.parse(localStorage.getItem('ai_music_history') || '[]');
            conversationHistory = Array.isArray(h) ? h.slice(-MAX_HISTORY) : [];
        } catch { conversationHistory = []; }
    }

    function getHistory() { return [...conversationHistory]; }

    /* ---- Player Control Actions ---- */
    function handlePlayerCommand(text) {
        const intent = detectIntent(text);
        const commandMap = {
            play: () => generateResponse(text),
            pause: () => { executeAction('pause'); return { text: 'Paused.' }; },
            resume: () => { executeAction('resume'); return { text: 'Resumed.' }; },
            next: () => { executeAction('next'); return { text: 'Playing next.' }; },
            previous: () => { executeAction('previous'); return { text: 'Playing previous.' }; },
            shuffle: () => { executeAction('shuffle'); return { text: `Shuffle ${PlayerEngine.shuffle ? 'on' : 'off'}.` }; },
            repeat: () => { executeAction('repeat'); return { text: `Repeat: ${PlayerEngine.repeat}` }; },
            volume_up: () => { executeAction('volume_up'); return { text: `Volume: ${Math.round(PlayerEngine.volume * 100)}%` }; },
            volume_down: () => { executeAction('volume_down'); return { text: `Volume: ${Math.round(PlayerEngine.volume * 100)}%` }; },
            mute: () => { executeAction('mute'); return { text: PlayerEngine.getState().muted ? 'Muted.' : 'Unmuted.' }; }
        };
        return commandMap[intent] ? commandMap[intent]() : null;
    }

    /* ---- AI Playlist Generation ---- */
    function generateAIPlaylist(mood, count = 10) {
        const songs = PlaylistManager.getRecommendationsByMood(mood);
        if (songs.length === 0) return null;
        const shuffled = songs.sort(() => Math.random() - 0.5).slice(0, count);
        return PlaylistManager.createAIPlaylist(`${mood.charAt(0).toUpperCase() + mood.slice(1)} Mix`, shuffled, mood);
    }

    /* ---- Init ---- */
    function init() {
        loadHistory();
    }

    return {
        init,
        generateResponse, handlePlayerCommand,
        executeAction, searchContent,
        speak, stopSpeaking,
        initVoiceInput, startListening, stopListening,
        addToHistory, getHistory,
        generateAIPlaylist,
        get isListening() { return isListening; },
        get isSpeaking() { return isSpeaking; }
    };
})();
