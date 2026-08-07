'use strict';

/* ============================================
   AI Assistant - Tamil AI Stream
   Natural language search, voice, actions
   ============================================ */

const AIAssistant = (() => {
    let conversationHistory = [];
    let isListening = false;
    let recognition = null;
    let unreadCount = 0;
    const MAX_HISTORY = 50;

    /* ---- Notification Helpers ---- */
    function getBadge() {
        let badge = document.querySelector('.ai-fab .ai-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'ai-badge';
            const fab = document.getElementById('aiFab');
            if (fab) fab.appendChild(badge);
        }
        return badge;
    }

    function showBadge(count) {
        unreadCount = count || unreadCount + 1;
        const badge = getBadge();
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'flex';
    }

    function hideBadge() {
        unreadCount = 0;
        const badge = document.querySelector('.ai-fab .ai-badge');
        if (badge) badge.style.display = 'none';
    }

    function showAIToast(text) {
        const existing = document.querySelector('.ai-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'ai-toast';
        toast.innerHTML = `<div class="ai-toast-icon"><i class="fas fa-robot"></i></div><div class="ai-toast-text">${text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n/g, ' ')}</div>`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));

        toast.addEventListener('click', () => {
            const fab = document.getElementById('aiFab');
            if (fab) fab.click();
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 4000);
    }

    /* ---- Helpers ---- */
    function getData(key) {
        try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    }
    function getStations() { return DataStore.getStations() || []; }
    function getSongs() { return DataStore.getSongs() || []; }
    function getCategories() { return DataStore.getCategories() || []; }
    function getFeatured() { return DataStore.getFeatured() || []; }
    function getTrending() { return DataStore.getTrending() || []; }
    function getArtistHits() { return DataStore.getArtistHits() || []; }
    function getQuotes() { return DataStore.getQuotes() || []; }
    function getPlaylists() { return DataStore.getPlaylists() || []; }
    function getImages() { return DataStore.getImages() || []; }

    /* ---- NLP Tokenizer ---- */
    function tokenize(text) {
        return text.toLowerCase().replace(/[^\w\s\u0B80-\u0BFF]/g, ' ').split(/\s+/).filter(Boolean);
    }

    function matchScore(query, target) {
        const qTokens = tokenize(query);
        const tTokens = tokenize(target);
        let score = 0;
        for (const qt of qTokens) {
            for (const tt of tTokens) {
                if (tt === qt) score += 3;
                else if (tt.startsWith(qt) || qt.startsWith(tt)) score += 2;
                else if (tt.includes(qt) || qt.includes(tt)) score += 1;
            }
        }
        return score / Math.max(qTokens.length, 1);
    }

    /* ---- Intent Detection ---- */
    function detectIntent(query) {
        const q = query.toLowerCase().trim();
        const intents = [
            { intent: 'play_station', patterns: ['play', 'listen', 'stream', 'open station', 'start'] },
            { intent: 'play_song',    patterns: ['play song', 'play music', 'play track', 'put on', 'hear'] },
            { intent: 'search',       patterns: ['search', 'find', 'look for', 'show me', 'where is', 'which'] },
            { intent: 'navigate',     patterns: ['go to', 'open page', 'take me to', 'navigate', 'visit'] },
            { intent: 'who_is',       patterns: ['who is', 'who are', 'tell me about'] },
            { intent: 'count',        patterns: ['how many', 'count', 'number of'] },
            { intent: 'help',         patterns: ['help', 'what can you', 'how do', 'what do you', 'features'] },
            { intent: 'greeting',     patterns: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'vanakkam'] },
            { intent: 'quote',        patterns: ['quote', 'saying', 'motivation', 'inspire'] },
            { intent: 'status',       patterns: ['status', 'what is playing', 'now playing', 'current'] },
            { intent: 'stop',         patterns: ['stop', 'pause', 'mute', 'quiet', 'silence'] },
            { intent: 'shuffle',      patterns: ['shuffle', 'random', 'mix'] },
            { intent: 'category',     patterns: ['category', 'genre', 'type of music'] },
            { intent: 'trending',     patterns: ['trending', 'popular', 'top', 'hot', 'best'] },
            { intent: 'featured',     patterns: ['featured', 'highlight', 'recommended', 'pick'] },
            { intent: 'artist',       patterns: ['artist', 'singer', 'composer', 'actor'] },
            { intent: 'playlist',     patterns: ['playlist', 'my list', 'saved', 'favorites'] },
            { intent: 'settings',     patterns: ['settings', 'preferences', 'config', 'theme'] },
        ];

        let best = { intent: 'unknown', score: 0 };
        for (const { intent, patterns } of intents) {
            for (const p of patterns) {
                if (q.includes(p)) {
                    const s = matchScore(p, q);
                    if (s > best.score) best = { intent, score: s };
                }
            }
        }
        return best.intent;
    }

    /* ---- Search Engine ---- */
    function searchAll(query) {
        const results = { stations: [], songs: [], artists: [], categories: [], playlists: [] };

        for (const s of getStations()) {
            const score = matchScore(query, `${s.name} ${s.freq} ${s.genre} ${s.city}`);
            if (score > 0.5) results.stations.push({ ...s, _score: score });
        }
        for (const s of getSongs()) {
            if (s.status !== 'published') continue;
            const score = matchScore(query, `${s.title} ${s.artist} ${s.movie} ${s.album || ''}`);
            if (score > 0.5) results.songs.push({ ...s, _score: score });
        }
        const artistMap = {};
        for (const s of getSongs()) {
            if (s.status !== 'published') continue;
            const a = (s.artist || '').toLowerCase();
            if (a && !artistMap[a]) artistMap[a] = { name: s.artist, count: 0, song: s };
            if (artistMap[a]) artistMap[a].count++;
        }
        for (const a of Object.values(artistMap)) {
            const score = matchScore(query, a.name);
            if (score > 0.5) results.artists.push({ ...a, _score: score });
        }
        for (const c of getCategories()) {
            const score = matchScore(query, c.name);
            if (score > 0.5) results.categories.push({ ...c, _score: score });
        }
        for (const p of getPlaylists()) {
            const score = matchScore(query, p.name || p.title || '');
            if (score > 0.5) results.playlists.push({ ...p, _score: score });
        }

        results.stations.sort((a, b) => b._score - a._score);
        results.songs.sort((a, b) => b._score - a._score);
        results.artists.sort((a, b) => b._score - a._score);
        results.categories.sort((a, b) => b._score - a._score);
        results.playlists.sort((a, b) => b._score - a._score);

        return results;
    }

    /* ---- Action Executor ---- */
    function executeAction(action, data) {
        switch (action) {
            case 'play_station':
                if (typeof playStation === 'function') playStation(data.name);
                return `Now playing **${data.name}** (${data.freq || ''})`;
            case 'play_song':
                if (typeof playSong === 'function') playSong(data);
                return `Now playing **${data.title}** by ${data.artist || 'Unknown'}`;
            case 'navigate':
                if (data.url) { window.location.href = data.url; return `Opening ${data.url}...`; }
                break;
            case 'stop':
                if (typeof pausePlayback === 'function') pausePlayback();
                return 'Playback paused.';
            case 'shuffle':
                if (typeof shuffleArtistHits === 'function' && data.artist) {
                    shuffleArtistHits(data.artist, data.name || data.artist);
                    return `Shuffling ${data.name || data.artist} hits...`;
                }
                return 'Shuffle not available for this item.';
        }
        return null;
    }

    /* ---- Response Generator ---- */
    function generateResponse(query) {
        const intent = detectIntent(query);
        const results = searchAll(query);
        const q = query.toLowerCase().trim();

        switch (intent) {
            case 'greeting': {
                const greetings = [
                    'Vanakkam! I am your Tamil AI Stream assistant. How can I help you today?',
                    'Hello! Welcome to Tamil AI Stream. What would you like to listen to?',
                    'Hi there! Ask me to play a station, find a song, or explore the site.'
                ];
                return { text: greetings[Math.floor(Math.random() * greetings.length)], quickActions: ['Play radio', 'Show trending', 'Help'] };
            }

            case 'play_station': {
                if (results.stations.length > 0) {
                    const s = results.stations[0];
                    executeAction('play_station', s);
                    return { text: `Now playing **${s.name}** — ${s.freq || ''} ${s.genre || ''}`, action: { type: 'play_station', data: s } };
                }
                return { text: "I couldn't find a matching station. Try saying a station name like 'Radio Mirchi' or 'Hello FM'.", quickActions: ['Show stations', 'Trending'] };
            }

            case 'play_song': {
                if (results.songs.length > 0) {
                    const s = results.songs[0];
                    executeAction('play_song', s);
                    return { text: `Now playing **${s.title}** by ${s.artist || 'Unknown'}`, action: { type: 'play_song', data: s } };
                }
                return { text: "I couldn't find that song. Try searching by song title or artist name.", quickActions: ['Search songs', 'Show artists'] };
            }

            case 'stop': {
                executeAction('stop');
                return { text: 'Playback paused. Say "play" to resume.' };
            }

            case 'shuffle': {
                if (results.artists.length > 0) {
                    const a = results.artists[0];
                    executeAction('shuffle', a);
                    return { text: `Shuffling **${a.name}** hits (${a.count} songs)...` };
                }
                if (results.stations.length > 0) {
                    const s = results.stations[0];
                    executeAction('play_station', s);
                    return { text: `Playing **${s.name}**...` };
                }
                return { text: 'What would you like me to shuffle? Try an artist name.' };
            }

            case 'search': {
                const total = results.stations.length + results.songs.length + results.artists.length + results.categories.length;
                if (total === 0) {
                    return { text: `No results found for "**${query}**". Try different keywords.`, quickActions: ['Show all stations', 'Show songs', 'Show categories'] };
                }
                let text = `Found **${total}** result${total > 1 ? 's' : ''} for "**${query}**":\n`;
                const cards = [];
                for (const s of results.stations.slice(0, 3)) {
                    text += `\n- Station: ${s.name} (${s.freq || ''})`;
                    cards.push({ icon: 'fa-broadcast-tower', title: s.name, sub: `${s.freq || ''} - ${s.genre || ''}`, action: 'play_station', data: s });
                }
                for (const s of results.songs.slice(0, 3)) {
                    text += `\n- Song: ${s.title} by ${s.artist || 'Unknown'}`;
                    cards.push({ icon: 'fa-music', title: s.title, sub: s.artist || 'Unknown', action: 'play_song', data: s });
                }
                for (const a of results.artists.slice(0, 2)) {
                    text += `\n- Artist: ${a.name} (${a.count} songs)`;
                    cards.push({ icon: 'fa-user', title: a.name, sub: `${a.count} songs`, action: 'shuffle', data: a });
                }
                for (const c of results.categories.slice(0, 2)) {
                    text += `\n- Category: ${c.name}`;
                    cards.push({ icon: c.icon || 'fa-th-large', title: c.name, sub: `${c.count || 0} stations`, action: null });
                }
                return { text, cards: cards.length > 0 ? cards : undefined };
            }

            case 'navigate': {
                const pages = {
                    'home': '/', 'index': '/', 'main': '/',
                    'login': '/login', 'signup': '/login', 'register': '/login',
                    'builder': '/builder', 'website builder': '/builder', 'admin builder': '/builder',
                    'admin': '/admin', 'dashboard': '/dashboard',
                    'upload': '/admin-upload', 'music player': '/music-player.html',
                    'playlist': '/playlist', 'profile': '/profile',
                    'particles': '/particles'
                };
                for (const [key, url] of Object.entries(pages)) {
                    if (q.includes(key)) {
                        window.location.href = url;
                        return { text: `Opening **${key}** page...` };
                    }
                }
                return { text: 'Which page would you like to open?', quickActions: ['Home', 'Builder', 'Admin', 'Profile'] };
            }

            case 'who_is': {
                if (results.artists.length > 0) {
                    const a = results.artists[0];
                    return { text: `**${a.name}** has **${a.count} songs** in the collection. Would you like to play or shuffle their hits?`, cards: [{ icon: 'fa-play', title: `Play ${a.name} Hits`, sub: `${a.count} songs`, action: 'shuffle', data: a }], quickActions: [`Play ${a.name}`, 'Shuffle'] };
                }
                if (results.stations.length > 0) {
                    const s = results.stations[0];
                    return { text: `**${s.name}** is a ${s.genre || ''} FM station at ${s.freq || ''} in ${s.city || 'Tamil Nadu'} with ${(s.listeners || 0).toLocaleString()} listeners.`, cards: [{ icon: 'fa-broadcast-tower', title: `Listen to ${s.name}`, sub: `${s.freq || ''} - ${s.genre || ''}`, action: 'play_station', data: s }], quickActions: [`Play ${s.name}`] };
                }
                return { text: `I couldn't find info about "${query}". Try a station or artist name.` };
            }

            case 'count': {
                const counts = { stations: getStations().length, songs: getSongs().filter(s => s.status === 'published').length, categories: getCategories().length, artists: Object.keys(getSongs().reduce((m, s) => { if (s.artist) m[s.artist] = 1; return m; }, {})).length, featured: getFeatured().length, trending: getTrending().length };
                let text = 'Here are the current stats:\n';
                text += `\n- ${counts.stations} FM Stations`;
                text += `\n- ${counts.songs} Published Songs`;
                text += `\n- ${counts.artists} Artists`;
                text += `\n- ${counts.categories} Categories`;
                text += `\n- ${counts.featured} Featured`;
                text += `\n- ${counts.trending} Trending`;
                return { text, quickActions: ['Show stations', 'Show songs', 'Show categories'] };
            }

            case 'quote': {
                const activeQuotes = getQuotes().filter(q => q.status === 'active');
                if (activeQuotes.length > 0) {
                    const q = activeQuotes[Math.floor(Math.random() * activeQuotes.length)];
                    return { text: `"${q.text}"` };
                }
                return { text: 'No quotes available right now. Add some in the Builder!' };
            }

            case 'status': {
                if (typeof currentStation !== 'undefined' && currentStation) {
                    return { text: `Currently playing: **${currentStation}**` };
                }
                if (typeof currentPlaybackTrack !== 'undefined' && currentPlaybackTrack) {
                    return { text: `Now playing: **${currentPlaybackTrack.title}** by ${currentPlaybackTrack.artist || 'Unknown'}` };
                }
                return { text: 'Nothing is currently playing. Would you like me to play something?', quickActions: ['Play radio', 'Show trending', 'Play songs'] };
            }

            case 'trending': {
                const trending = getTrending().filter(t => t.status === 'active');
                const stations = getStations();
                if (trending.length === 0) return { text: 'No trending stations right now.' };
                const cards = trending.slice(0, 5).map(t => {
                    const s = stations.find(st => st.id === t.stationId) || {};
                    return { icon: 'fa-fire', title: s.name || 'Station', sub: `${s.freq || ''} - ${s.genre || ''}`, action: 'play_station', data: s };
                });
                return { text: `Here are the **top ${trending.length} trending** stations:`, cards };
            }

            case 'featured': {
                const featured = getFeatured().filter(f => f.status === 'active');
                if (featured.length === 0) return { text: 'No featured stations right now.' };
                const cards = featured.slice(0, 5).map(f => ({ icon: 'fa-star', title: f.title || 'Featured', sub: f.subtitle || '', action: 'play_station', data: { name: f.title } }));
                return { text: `Here are the **featured** stations:`, cards };
            }

            case 'category': {
                const cats = getCategories().filter(c => c.status === 'active');
                if (cats.length === 0) return { text: 'No categories available.' };
                const cards = cats.map(c => ({ icon: c.icon || 'fa-th-large', title: c.name, sub: `${c.count || 0} stations`, action: null }));
                return { text: `**${cats.length} categories** available:`, cards };
            }

            case 'artist': {
                const artists = getArtistHits().filter(a => a.status === 'active');
                if (artists.length === 0) return { text: 'No artist collections yet.' };
                if (results.artists.length > 0) {
                    const a = results.artists[0];
                    return { text: `**${a.name}** has ${a.count} songs. Would you like to play them?`, cards: [{ icon: 'fa-play', title: `Play ${a.name}`, sub: `${a.count} songs`, action: 'shuffle', data: a }], quickActions: [`Play ${a.name}`, 'Shuffle'] };
                }
                const cards = artists.slice(0, 6).map(a => ({ icon: 'fa-user', title: a.name, sub: `${a.songCount || 0} songs`, action: 'shuffle', data: a }));
                return { text: `**${artists.length} artist collections** available:`, cards };
            }

            case 'playlist': {
                const playlists = getPlaylists();
                if (playlists.length === 0) return { text: 'No playlists yet. Create one in the Builder!' };
                const cards = playlists.slice(0, 5).map(p => ({ icon: 'fa-list', title: p.name || p.title || 'Playlist', sub: `${(p.songs || []).length} songs`, action: null }));
                return { text: `You have **${playlists.length} playlists**:`, cards };
            }

            case 'settings': {
                return { text: 'You can change settings on the **Profile** page.', cards: [{ icon: 'fa-cog', title: 'Open Profile Settings', sub: 'Manage your preferences', action: 'navigate', data: { url: '/profile' } }], quickActions: ['Open profile'] };
            }

            case 'help': {
                return {
                    text: `I can help you with:\n\n- **Play** a station or song (say "play Radio Mirchi")\n- **Search** songs, artists, stations\n- **Navigate** to any page (say "go to builder")\n- **Browse** categories, trending, featured\n- **Count** total songs, stations, artists\n- **Get info** about an artist or station\n- **Shuffle** artist hits\n- **Voice input** — tap the mic icon\n\nJust type naturally or use voice!`,
                    quickActions: ['Play radio', 'Show stations', 'Show songs', 'How many songs?']
                };
            }

            default: {
                if (results.stations.length > 0 || results.songs.length > 0 || results.artists.length > 0) {
                    return generateResponse('search ' + query);
                }
                return {
                    text: `I'm not sure I understand. Here's what I can do:`,
                    quickActions: ['Help', 'Play radio', 'Show trending', 'Search songs']
                };
            }
        }
    }

    /* ---- UI Controller ---- */
    function renderMessage(container, msg) {
        const div = document.createElement('div');
        div.className = `ai-msg ${msg.from}`;

        const avatar = document.createElement('div');
        avatar.className = 'ai-msg-avatar';
        avatar.innerHTML = msg.from === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';

        const bubble = document.createElement('div');
        bubble.className = 'ai-msg-bubble';

        let html = (msg.text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        if (msg.cards && msg.cards.length > 0) {
            html += '<div class="ai-action-cards">';
            for (const card of msg.cards) {
                html += `<div class="ai-action-card" data-action="${card.action || ''}" data-data='${JSON.stringify(card.data || {}).replace(/'/g, "&#39;")}'><div class="ai-action-icon"><i class="fas ${card.icon}"></i></div><div class="ai-action-text"><div class="ai-action-title">${card.title}</div><div class="ai-action-sub">${card.sub || ''}</div></div></div>`;
            }
            html += '</div>';
        }
        bubble.innerHTML = html;

        div.appendChild(avatar);
        div.appendChild(bubble);
        container.appendChild(div);

        div.querySelectorAll('.ai-action-card').forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                const data = JSON.parse(card.dataset.data || '{}');
                if (action) {
                    const result = executeAction(action, data);
                    if (result) addBotMessage(container, result);
                }
            });
        });

        container.scrollTop = container.scrollHeight;
    }

    function addBotMessage(container, text, cards) {
        renderMessage(container, { from: 'bot', text, cards });
    }

    function addUserMessage(container, text) {
        renderMessage(container, { from: 'user', text });
    }

    function showTyping(container) {
        const div = document.createElement('div');
        div.className = 'ai-msg bot';
        div.id = 'ai-typing';
        div.innerHTML = '<div class="ai-msg-avatar"><i class="fas fa-robot"></i></div><div class="ai-msg-bubble"><div class="ai-typing"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div></div>';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function hideTyping() {
        const el = document.getElementById('ai-typing');
        if (el) el.remove();
    }

    /* ---- Voice Recognition ---- */
    function initVoice(btn, input, container) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { btn.style.display = 'none'; return; }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (e) => {
            const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
            input.value = transcript;
        };

        recognition.onend = () => {
            isListening = false;
            btn.classList.remove('listening');
            const transcript = input.value.trim();
            if (transcript) handleUserInput(transcript, container, input);
        };

        recognition.onerror = () => {
            isListening = false;
            btn.classList.remove('listening');
        };

        btn.addEventListener('click', () => {
            if (isListening) { recognition.stop(); isListening = false; btn.classList.remove('listening'); return; }
            isListening = true;
            btn.classList.add('listening');
            input.value = '';
            recognition.start();
        });
    }

    /* ---- Conversation Memory ---- */
    function addToHistory(role, text) {
        conversationHistory.push({ role, text, time: Date.now() });
        if (conversationHistory.length > MAX_HISTORY) conversationHistory.shift();
        try { localStorage.setItem('ai_conversation', JSON.stringify(conversationHistory)); } catch {}
    }

    function loadHistory() {
        try {
            const h = JSON.parse(localStorage.getItem('ai_conversation'));
            if (Array.isArray(h)) conversationHistory = h.slice(-MAX_HISTORY);
        } catch { conversationHistory = []; }
    }

    /* ---- Main Input Handler ---- */
    function handleUserInput(text, container, input) {
        if (!text.trim()) return;
        input.value = '';
        addUserMessage(container, text);
        addToHistory('user', text);
        showTyping(container);

        setTimeout(() => {
            hideTyping();
            const response = generateResponse(text);
            addBotMessage(container, response.text, response.cards);
            addToHistory('bot', response.text);
            if (response.quickActions) renderQuickActions(container, response.quickActions);

            const chatWindow = document.getElementById('aiChatWindow');
            if (chatWindow && !chatWindow.classList.contains('open')) {
                showBadge();
                showAIToast(response.text);
            }
        }, 300 + Math.random() * 400);
    }

    function renderQuickActions(container, actions) {
        const existing = container.querySelector('.ai-quick-actions');
        if (existing) existing.remove();
        const wrap = document.createElement('div');
        wrap.className = 'ai-quick-actions';
        for (const a of actions) {
            const btn = document.createElement('button');
            btn.className = 'ai-quick-btn';
            btn.textContent = a;
            btn.addEventListener('click', () => handleUserInput(a, container, container.closest('.ai-chat-window').querySelector('input')));
            wrap.appendChild(btn);
        }
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
    }

    /* ---- Public Init ---- */
    function init() {
        loadHistory();

        const fab = document.getElementById('aiFab');
        const chatWindow = document.getElementById('aiChatWindow');
        const messages = document.getElementById('aiMessages');
        const input = document.getElementById('aiInput');
        const sendBtn = document.getElementById('aiSendBtn');
        const voiceBtn = document.getElementById('aiVoiceBtn');
        const closeBtn = document.getElementById('aiCloseBtn');

        if (!fab || !chatWindow) return;

        const badge = document.createElement('span');
        badge.className = 'ai-badge';
        badge.style.display = 'none';
        fab.appendChild(badge);

        fab.addEventListener('click', () => {
            const isOpen = chatWindow.classList.contains('open');
            chatWindow.classList.toggle('open');
            fab.classList.toggle('active');
            fab.querySelector('i').className = isOpen ? 'fas fa-comment-dots' : 'fas fa-times';
            if (!isOpen) {
                hideBadge();
                if (messages.children.length === 0) {
                    addBotMessage(messages, 'Welcome to **Tamil AI Stream**! I can help you play stations, search songs, navigate pages, and more.\n\nTry saying something like:');
                    renderQuickActions(messages, ['Play Radio Mirchi', 'Show trending', 'Search songs', 'Help']);
                }
                input.focus();
            }
        });

        closeBtn.addEventListener('click', () => {
            chatWindow.classList.remove('open');
            fab.classList.remove('active');
            fab.querySelector('i').className = 'fas fa-comment-dots';
        });

        sendBtn.addEventListener('click', () => handleUserInput(input.value, messages, input));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserInput(input.value, messages, input); }
        });

        initVoice(voiceBtn, input, messages);
    }

    return { init, searchAll, generateResponse, handleUserInput, showNotification: showAIToast };
})();

document.addEventListener('DOMContentLoaded', () => AIAssistant.init());
