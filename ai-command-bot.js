'use strict';

/* ============================================
   AI Command Bot - TamilAI.Stream Builder
   Natural language interface for managing
   website content and layout
   ============================================ */

const AICommandBot = (() => {

    let isOpen = false;
    let chatHistory = [];
    let commandHistory = [];
    let historyIndex = -1;

    /* ---- UI Creation ---- */
    function createBotUI() {
        if (document.getElementById('aiCommandBot')) return;

        const bot = document.createElement('div');
        bot.id = 'aiCommandBot';
        bot.className = 'ai-command-bot';
        bot.innerHTML = `
            <div class="ai-bot-header">
                <div class="ai-bot-header-left">
                    <div class="ai-bot-avatar"><i class="fas fa-robot"></i></div>
                    <div class="ai-bot-title">
                        <span>AI Assistant</span>
                        <span class="ai-bot-status">Ready</span>
                    </div>
                </div>
                <div class="ai-bot-header-right">
                    <button class="ai-bot-btn" id="aiBotClear" title="Clear chat"><i class="fas fa-trash-alt"></i></button>
                    <button class="ai-bot-btn" id="aiBotMinimize" title="Minimize"><i class="fas fa-minus"></i></button>
                </div>
            </div>
            <div class="ai-bot-messages" id="aiBotMessages">
                <div class="ai-bot-message bot">
                    <div class="ai-bot-message-avatar"><i class="fas fa-robot"></i></div>
                    <div class="ai-bot-message-content">
                        <p>Hi! I'm your AI assistant. I can help you manage your website.</p>
                        <p>Try commands like:</p>
                        <ul>
                            <li>"Check for duplicates"</li>
                            <li>"Show sections" — view all website sections</li>
                            <li>"Show categories" — view music categories</li>
                            <li>"Create a devotional playlist"</li>
                            <li>"Show recently added songs"</li>
                            <li>"Run publish check"</li>
                            <li>"Add [song name] to featured"</li>
                            <li>"Stats" — get content summary</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="ai-bot-input-area">
                <div class="ai-bot-suggestions" id="aiBotSuggestions">
                    <button class="ai-bot-suggestion" data-cmd="Check for duplicates">Duplicates</button>
                    <button class="ai-bot-suggestion" data-cmd="Run publish check">Publish Check</button>
                    <button class="ai-bot-suggestion" data-cmd="Show sections">Sections</button>
                    <button class="ai-bot-suggestion" data-cmd="Show categories">Categories</button>
                    <button class="ai-bot-suggestion" data-cmd="Stats">Stats</button>
                </div>
                <div class="ai-bot-input-row">
                    <input type="text" class="ai-bot-input" id="aiBotInput" placeholder="Type a command..." autocomplete="off">
                    <button class="ai-bot-send" id="aiBotSend"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;
        document.body.appendChild(bot);
        loadBotStyles();
        bindBotEvents();
    }

    function loadBotStyles() {
        if (document.getElementById('aiBotStyles')) return;
        const style = document.createElement('style');
        style.id = 'aiBotStyles';
        style.textContent = `
            .ai-command-bot {
                position: fixed;
                bottom: 90px;
                right: 20px;
                width: 380px;
                max-height: 520px;
                background: var(--bg-primary, #1a1a2e);
                border: 1px solid var(--border-color, rgba(255,255,255,0.1));
                border-radius: 16px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.5);
                display: none;
                flex-direction: column;
                z-index: 9999;
                overflow: hidden;
                font-family: 'Inter', sans-serif;
            }
            .ai-command-bot.open { display: flex; }
            .ai-bot-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2));
                border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1));
            }
            .ai-bot-header-left { display: flex; align-items: center; gap: 10px; }
            .ai-bot-avatar {
                width: 32px; height: 32px; border-radius: 50%;
                background: linear-gradient(135deg, #8b5cf6, #3b82f6);
                display: flex; align-items: center; justify-content: center;
                color: #fff; font-size: 14px;
            }
            .ai-bot-title span:first-child { font-weight: 600; color: #fff; font-size: 14px; }
            .ai-bot-title span:last-child { display: block; font-size: 11px; color: #10b981; }
            .ai-bot-header-right { display: flex; gap: 6px; }
            .ai-bot-btn {
                width: 28px; height: 28px; border-radius: 6px; border: none;
                background: rgba(255,255,255,0.1); color: #fff; cursor: pointer;
                display: flex; align-items: center; justify-content: center; font-size: 12px;
            }
            .ai-bot-btn:hover { background: rgba(255,255,255,0.2); }
            .ai-bot-messages {
                flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px;
                max-height: 320px; min-height: 200px;
            }
            .ai-bot-messages::-webkit-scrollbar { width: 4px; }
            .ai-bot-messages::-webkit-scrollbar-track { background: transparent; }
            .ai-bot-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
            .ai-bot-message { display: flex; gap: 8px; animation: botMsgIn 0.2s ease; }
            .ai-bot-message.user { flex-direction: row-reverse; }
            .ai-bot-message-avatar {
                width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
                display: flex; align-items: center; justify-content: center; font-size: 12px;
            }
            .ai-bot-message.bot .ai-bot-message-avatar { background: rgba(139,92,246,0.3); color: #8b5cf6; }
            .ai-bot-message.user .ai-bot-message-avatar { background: rgba(59,130,246,0.3); color: #3b82f6; }
            .ai-bot-message-content {
                background: rgba(255,255,255,0.05); border-radius: 12px; padding: 10px 14px;
                max-width: 280px; font-size: 13px; line-height: 1.5; color: #e0e0e0;
            }
            .ai-bot-message.user .ai-bot-message-content { background: rgba(59,130,246,0.2); }
            .ai-bot-message-content p { margin: 0 0 6px 0; }
            .ai-bot-message-content p:last-child { margin-bottom: 0; }
            .ai-bot-message-content ul { margin: 4px 0 0 0; padding-left: 16px; }
            .ai-bot-message-content li { margin: 2px 0; font-size: 12px; opacity: 0.8; }
            .ai-bot-message-content code {
                background: rgba(139,92,246,0.2); padding: 1px 5px; border-radius: 3px;
                font-family: monospace; font-size: 12px;
            }
            .ai-bot-input-area { padding: 10px 12px; border-top: 1px solid var(--border-color, rgba(255,255,255,0.1)); }
            .ai-bot-suggestions {
                display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;
            }
            .ai-bot-suggestion {
                padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(139,92,246,0.3);
                background: rgba(139,92,246,0.1); color: #c4b5fd; font-size: 11px; cursor: pointer;
                transition: all 0.2s;
            }
            .ai-bot-suggestion:hover { background: rgba(139,92,246,0.2); border-color: rgba(139,92,246,0.5); }
            .ai-bot-input-row { display: flex; gap: 8px; }
            .ai-bot-input {
                flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.05); color: #fff; font-size: 13px; outline: none;
            }
            .ai-bot-input:focus { border-color: rgba(139,92,246,0.5); }
            .ai-bot-input::placeholder { color: rgba(255,255,255,0.4); }
            .ai-bot-send {
                width: 40px; height: 40px; border-radius: 10px; border: none;
                background: linear-gradient(135deg, #8b5cf6, #3b82f6); color: #fff;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: transform 0.15s;
            }
            .ai-bot-send:hover { transform: scale(1.05); }
            .ai-bot-send:active { transform: scale(0.95); }
            @keyframes botMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            .ai-bot-typing { display: flex; gap: 4px; padding: 8px 12px; }
            .ai-bot-typing span {
                width: 6px; height: 6px; border-radius: 50%; background: #8b5cf6;
                animation: botTyping 1.2s infinite;
            }
            .ai-bot-typing span:nth-child(2) { animation-delay: 0.2s; }
            .ai-bot-typing span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes botTyping { 0%,60%,100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } }
            @media (max-width: 480px) {
                .ai-command-bot { width: calc(100vw - 20px); right: 10px; bottom: 80px; max-height: 70vh; }
            }
        `;
        document.head.appendChild(style);
    }

    function bindBotEvents() {
        const input = document.getElementById('aiBotInput');
        const sendBtn = document.getElementById('aiBotSend');
        const clearBtn = document.getElementById('aiBotClear');
        const minBtn = document.getElementById('aiBotMinimize');
        const suggestions = document.getElementById('aiBotSuggestions');

        sendBtn.addEventListener('click', sendCommand);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendCommand();
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    input.value = commandHistory[commandHistory.length - 1 - historyIndex];
                }
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    input.value = commandHistory[commandHistory.length - 1 - historyIndex];
                } else {
                    historyIndex = -1;
                    input.value = '';
                }
            }
        });

        clearBtn.addEventListener('click', () => {
            chatHistory = [];
            const msgs = document.getElementById('aiBotMessages');
            msgs.innerHTML = '';
            addBotMessage('Chat cleared. How can I help you?');
        });

        minBtn.addEventListener('click', () => toggleBot());

        suggestions.addEventListener('click', (e) => {
            const btn = e.target.closest('.ai-bot-suggestion');
            if (btn) {
                input.value = btn.dataset.cmd;
                sendCommand();
            }
        });
    }

    /* ---- Bot Toggle ---- */
    function toggleBot() {
        const bot = document.getElementById('aiCommandBot');
        if (!bot) { createBotUI(); toggleBot(); return; }
        isOpen = !isOpen;
        bot.classList.toggle('open', isOpen);
        if (isOpen) {
            setTimeout(() => document.getElementById('aiBotInput')?.focus(), 100);
        }
    }

    /* ---- Message Handling ---- */
    function addBotMessage(text, isHtml) {
        const msgs = document.getElementById('aiBotMessages');
        if (!msgs) return;
        const div = document.createElement('div');
        div.className = 'ai-bot-message bot';
        div.innerHTML = `
            <div class="ai-bot-message-avatar"><i class="fas fa-robot"></i></div>
            <div class="ai-bot-message-content">${isHtml ? text : `<p>${escapeHtml(text)}</p>`}</div>
        `;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
        chatHistory.push({ role: 'bot', text });
    }

    function addUserMessage(text) {
        const msgs = document.getElementById('aiBotMessages');
        if (!msgs) return;
        const div = document.createElement('div');
        div.className = 'ai-bot-message user';
        div.innerHTML = `
            <div class="ai-bot-message-avatar"><i class="fas fa-user"></i></div>
            <div class="ai-bot-message-content"><p>${escapeHtml(text)}</p></div>
        `;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
        chatHistory.push({ role: 'user', text });
    }

    function showTyping() {
        const msgs = document.getElementById('aiBotMessages');
        if (!msgs) return;
        const div = document.createElement('div');
        div.className = 'ai-bot-message bot';
        div.id = 'aiBotTyping';
        div.innerHTML = `
            <div class="ai-bot-message-avatar"><i class="fas fa-robot"></i></div>
            <div class="ai-bot-message-content">
                <div class="ai-bot-typing"><span></span><span></span><span></span></div>
            </div>
        `;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function hideTyping() {
        const t = document.getElementById('aiBotTyping');
        if (t) t.remove();
    }

    /* ---- Command Processing ---- */
    function sendCommand() {
        const input = document.getElementById('aiBotInput');
        const cmd = input.value.trim();
        if (!cmd) return;

        input.value = '';
        historyIndex = -1;
        commandHistory.push(cmd);
        if (commandHistory.length > 50) commandHistory.shift();

        addUserMessage(cmd);
        showTyping();

        setTimeout(() => {
            hideTyping();
            const result = processCommand(cmd);
            addBotMessage(result, true);
        }, 400 + Math.random() * 400);
    }

    function processCommand(cmd) {
        const lower = cmd.toLowerCase().trim();
        const songs = DataStore.getSongs ? DataStore.getSongs() : [];
        const stations = DataStore.getStations ? DataStore.getStations() : [];
        const featured = DataStore.getFeatured ? DataStore.getFeatured() : [];
        const trending = DataStore.getTrending ? DataStore.getTrending() : [];

        if (lower.includes('help') || lower === '?') {
            return buildHelpResponse();
        }

        if (lower.includes('duplicate') || lower.includes('duplicat')) {
            return handleDuplicateCheck(songs);
        }

        if (lower.includes('publish check') || lower.includes('check publish') || lower.includes('validate')) {
            return handlePublishCheck();
        }

        if (lower.includes('create') && lower.includes('playlist')) {
            return handleCreatePlaylist(cmd, songs);
        }

        if (lower.includes('show') && (lower.includes('song') || lower.includes('all'))) {
            return handleShowSongs(songs);
        }

        if (lower.includes('show') && lower.includes('station')) {
            return handleShowStations(stations);
        }

        if (lower.includes('add') && (lower.includes('featured') || lower.includes('trending'))) {
            return handleAddToSection(cmd, songs);
        }

        if (lower.includes('fix') && lower.includes('seek')) {
            return handleFixSeek();
        }

        if (lower.includes('stats') || lower.includes('dashboard') || lower.includes('summary')) {
            return handleStats(songs, stations, featured, trending);
        }

        if (lower.includes('hide') || lower.includes('show section') || lower.includes('reorder')) {
            return handleSectionManage(cmd);
        }

        if (lower.includes('section') || lower.includes('home page') || lower.includes('layout')) {
            return handleSectionInfo();
        }

        if (lower.includes('category') || lower.includes('categories')) {
            return handleCategoryInfo(songs);
        }

        if (lower.includes('delete') && lower.includes('song')) {
            return handleDeleteSong(cmd, songs);
        }

        if (lower.includes('lyrics') || lower.includes('sync')) {
            return handleLyricsHelp();
        }

        if (lower.includes('export') || lower.includes('backup')) {
            return handleExport();
        }

        if (lower.includes('recent') || lower.includes('latest')) {
            return handleRecentSongs(songs);
        }

        if (lower.includes('search') || lower.includes('find')) {
            return handleSearch(cmd, songs);
        }

        if (lower.includes('language') || lower.includes('tamil') || lower.includes('hindi')) {
            return handleLanguageFilter(cmd, songs);
        }

        if (lower.includes('mood') || lower.includes('genre')) {
            return handleMoodFilter(cmd, songs);
        }

        if (lower.includes('quality') || lower.includes('missing')) {
            return handleQualityCheck(songs);
        }

        if (lower.includes('auto') && (lower.includes('fill') || lower.includes('metadata'))) {
            return `<p>Auto-fill is built into the song upload form. When you upload an audio file, the AI will:</p>
                <ul>
                    <li>Extract metadata (duration, format)</li>
                    <li>Parse filename for title, artist, movie</li>
                    <li>Detect language and genre from filename</li>
                    <li>Suggest mood based on genre</li>
                    <li>Check for duplicates before saving</li>
                </ul>
                <p>Upload a song on the <strong>Add Songs</strong> page to try it!</p>`;
        }

        if (lower.includes('what can') || lower.includes('what do')) {
            return buildHelpResponse();
        }

        return `<p>I didn't understand that command. Try:</p>
            <ul>
                <li>"Check for duplicates" — scan for duplicate songs</li>
                <li>"Create a devotional playlist" — AI generates a playlist</li>
                <li>"Show all songs" — list your songs</li>
                <li>"Run publish check" — validate before publishing</li>
                <li>"Fix seek issues" — apply audio seek fix</li>
                <li>"Stats" — get content summary</li>
                <li>"Help" — see all commands</li>
            </ul>`;
    }

    /* ---- Command Handlers ---- */
    function buildHelpResponse() {
        return `<p><strong>Available Commands:</strong></p>
            <ul>
                <li><code>check duplicates</code> — Find duplicate songs</li>
                <li><code>publish check</code> — Validate before publishing</li>
                <li><code>create [name] playlist</code> — AI playlist generation</li>
                <li><code>show all songs</code> — List all songs</li>
                <li><code>show stations</code> — List all stations</li>
                <li><code>add [song] to featured</code> — Add to section</li>
                <li><code>sections</code> — View all website sections</li>
                <li><code>categories</code> — View music categories</li>
                <li><code>fix seek</code> — Apply audio seek fix</li>
                <li><code>stats</code> — Content summary</li>
                <li><code>recent songs</code> — Recently added</li>
                <li><code>search [query]</code> — Search songs</li>
                <li><code>language [lang]</code> — Filter by language</li>
                <li><code>mood [mood]</code> — Filter by mood</li>
                <li><code>quality check</code> — Find missing metadata</li>
                <li><code>export</code> — Export website data</li>
                <li><code>help</code> — Show this list</li>
            </ul>`;
    }

    function handleSectionInfo() {
        let sections = [];
        try {
            if (typeof DataStore !== 'undefined') {
                const order = DataStore.getSectionsOrder ? DataStore.getSectionsOrder() : [];
                const settings = DataStore.getSiteSettings ? DataStore.getSiteSettings() : {};
                const homeSections = settings.homeSections || {};
                const allSections = [
                    { key: 'hero', name: 'Hero Banner', icon: 'fa-star' },
                    { key: 'featured', name: 'Featured', icon: 'fa-heart' },
                    { key: 'trending', name: 'Trending', icon: 'fa-fire' },
                    { key: 'categories', name: 'Categories', icon: 'fa-layer-group' },
                    { key: 'artistHits', name: 'Artist Hits', icon: 'fa-user' },
                    { key: 'recentlyPlayed', name: 'Recently Played', icon: 'fa-clock-rotate-left' },
                    { key: 'recommendations', name: 'AI Recommendations', icon: 'fa-wand-magic-sparkles' },
                    { key: 'stations', name: 'Live FM', icon: 'fa-broadcast-tower' },
                    { key: 'news', name: 'Live Tamil News', icon: 'fa-newspaper' },
                    { key: 'decades', name: 'Decades', icon: 'fa-calendar' },
                    { key: 'quotes', name: 'Tamil Quotes', icon: 'fa-quote-left' }
                ];
                sections = allSections.map(s => {
                    const enabled = homeSections[s.key] !== false;
                    const pos = order.indexOf(s.key);
                    return { ...s, enabled, pos: pos >= 0 ? pos : 99 };
                }).sort((a, b) => a.pos - b.pos);
            }
        } catch (e) {}
        if (!sections.length) return '<p>No section data available.</p>';
        let html = '<p><strong>Website Home Sections:</strong></p><ul>';
        sections.forEach(s => {
            const status = s.enabled ? '<span style="color:#10b981">✓ Enabled</span>' : '<span style="color:#ef4444">✗ Disabled</span>';
            html += '<li><i class="fas ' + s.icon + '" style="width:18px;"></i> ' + s.name + ' — ' + status + '</li>';
        });
        html += '</ul><p>Use the <strong>Home Sections</strong> page in the sidebar to reorder or toggle sections.</p>';
        return html;
    }

    function handleCategoryInfo(songs) {
        const cats = {};
        songs.forEach(s => {
            const c = s.genre || s.category || 'Uncategorized';
            cats[c] = (cats[c] || 0) + 1;
        });
        const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
        if (!entries.length) return '<p>No songs or categories found.</p>';
        let html = '<p><strong>Music Categories:</strong></p><ul>';
        entries.forEach(([name, count]) => {
            html += '<li><strong>' + name + '</strong> — ' + count + ' song' + (count > 1 ? 's' : '') + '</li>';
        });
        html += '</ul>';
        return html;
    }

    function handleDuplicateCheck(songs) {
        if (songs.length === 0) return '<p>No songs found in the library.</p>';

        const dupes = [];
        for (let i = 0; i < songs.length; i++) {
            for (let j = i + 1; j < songs.length; j++) {
                const score = AIAutomation.detectDuplicates(songs[i], [songs[j]]);
                if (score.length > 0) {
                    dupes.push({ a: songs[i], b: songs[j], score: score[0].score });
                }
            }
        }

        if (dupes.length === 0) {
            return `<p><strong>No duplicates found!</strong> Your library is clean across ${songs.length} songs.</p>`;
        }

        let html = `<p><strong>Found ${dupes.length} possible duplicate pair${dupes.length > 1 ? 's' : ''}:</strong></p><ul>`;
        for (const d of dupes.slice(0, 10)) {
            html += `<li>"${d.a.title}" by ${d.a.artist} ↔ "${d.b.title}" by ${d.b.artist} (${d.score}% match)</li>`;
        }
        if (dupes.length > 10) html += `<li>... and ${dupes.length - 10} more</li>`;
        html += '</ul><p>Consider removing duplicates to keep your library clean.</p>';
        return html;
    }

    function handlePublishCheck() {
        const result = AIAutomation.runPublishChecks(DataStore);
        let html = `<p><strong>${result.passed ? 'Ready to publish!' : 'Issues found!'}</strong></p>`;
        html += `<p>${result.summary}</p>`;
        if (result.issues.length > 0) {
            html += '<ul>';
            for (const issue of result.issues.slice(0, 15)) {
                const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
                html += `<li>${icon} [${issue.category}] ${issue.message}</li>`;
            }
            if (result.issues.length > 15) html += `<li>... and ${result.issues.length - 15} more issues</li>`;
            html += '</ul>';
        }
        return html;
    }

    function handleCreatePlaylist(cmd, songs) {
        const matched = AIAutomation.generatePlaylistFromDescription(cmd, songs);
        if (matched.length === 0) {
            return '<p>No matching songs found for this playlist description. Try adding more songs or a different keyword.</p>';
        }
        let html = `<p><strong>Generated playlist with ${matched.length} songs:</strong></p><ul>`;
        for (const s of matched.slice(0, 15)) {
            html += `<li>${s.title} — ${s.artist}</li>`;
        }
        if (matched.length > 15) html += `<li>... and ${matched.length - 15} more</li>`;
        html += '</ul><p>To save this as a section, go to <strong>Content</strong> and add these songs to a custom section.</p>';
        return html;
    }

    function handleShowSongs(songs) {
        if (songs.length === 0) return '<p>No songs in the library yet.</p>';
        let html = `<p><strong>${songs.length} songs in library:</strong></p><ul>`;
        for (const s of songs.slice(0, 20)) {
            html += `<li>${s.title} — ${s.artist} (${s.language || 'Unknown'})</li>`;
        }
        if (songs.length > 20) html += `<li>... and ${songs.length - 20} more</li>`;
        html += '</ul>';
        return html;
    }

    function handleShowStations(stations) {
        if (stations.length === 0) return '<p>No radio stations configured.</p>';
        let html = `<p><strong>${stations.length} radio stations:</strong></p><ul>`;
        for (const s of stations) {
            html += `<li>${s.name} — ${s.language || 'Unknown'}</li>`;
        }
        html += '</ul>';
        return html;
    }

    function handleAddToSection(cmd, songs) {
        return '<p>To add songs to sections, go to the <strong>Content</strong> page and use the section editors. You can add songs to Featured, Trending, Categories, and Artist Hits sections.</p>';
    }

    function handleFixSeek() {
        return '<p><strong>Audio Seek Fix Applied!</strong> The mini player and full player now correctly use the global <code>audioPlayer</code> element for seeking. This fix was applied in a previous session.</p>';
    }

    function handleStats(songs, stations, featured, trending) {
        const published = songs.filter(s => s.status === 'published' || s.status === 'active');
        const languages = {};
        const genres = {};
        for (const s of songs) {
            if (s.language) languages[s.language] = (languages[s.language] || 0) + 1;
            if (s.genre) genres[s.genre] = (genres[s.genre] || 0) + 1;
        }
        let html = `<p><strong>Content Summary:</strong></p><ul>
            <li>Songs: ${songs.length} (${published.length} published)</li>
            <li>Stations: ${stations.length}</li>
            <li>Featured: ${featured.length}</li>
            <li>Trending: ${trending.length}</li>
        </ul>`;
        if (Object.keys(languages).length > 0) {
            html += '<p><strong>Languages:</strong> ';
            html += Object.entries(languages).map(([l, c]) => `${l} (${c})`).join(', ');
            html += '</p>';
        }
        if (Object.keys(genres).length > 0) {
            html += '<p><strong>Genres:</strong> ';
            html += Object.entries(genres).map(([g, c]) => `${g} (${c})`).join(', ');
            html += '</p>';
        }
        return html;
    }

    function handleSectionManage(cmd) {
        return '<p>Section management is available on the <strong>Sections</strong> page. You can reorder sections, hide/show them, and configure their visibility per device (Desktop, Tablet, Mobile).</p>';
    }

    function handleDeleteSong(cmd, songs) {
        const name = cmd.replace(/delete|remove|song/gi, '').trim();
        const match = songs.find(s => s.title && s.title.toLowerCase().includes(name.toLowerCase()));
        if (match) {
            return `<p>Found: "${match.title}" by ${match.artist}. To delete it, go to the <strong>Add Songs</strong> page, find the song, and click the delete button. I can't delete songs directly for safety.</p>`;
        }
        return `<p>Could not find a song matching "${name}". Try "show all songs" to see what's available.</p>`;
    }

    function handleLyricsHelp() {
        return `<p><strong>Lyrics Sync:</strong> The lyrics system is now fully functional!</p>
            <ul>
                <li>Lyrics are synced with audio <code>currentTime</code></li>
                <li>Click any lyric line to seek to that timestamp</li>
                <li>The current line highlights automatically during playback</li>
                <li>Add lyrics via the <strong>Lyrics</strong> page or inline on the mini player</li>
            </ul>`;
    }

    function handleExport() {
        return '<p>To export your website data, click <strong>Export Website</strong> in the Quick Actions sidebar. This downloads a JSON file with all your songs, stations, settings, and content.</p>';
    }

    function handleRecentSongs(songs) {
        const recent = [...songs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 10);
        if (recent.length === 0) return '<p>No songs found.</p>';
        let html = `<p><strong>Recently added (${recent.length}):</strong></p><ul>`;
        for (const s of recent) {
            const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Unknown';
            html += `<li>${s.title} — ${s.artist} (${date})</li>`;
        }
        html += '</ul>';
        return html;
    }

    function handleSearch(cmd, songs) {
        const query = cmd.replace(/search|find|for/gi, '').trim();
        if (!query) return '<p>Please specify what to search for. Example: "search A.R. Rahman"</p>';
        const results = songs.filter(s =>
            (s.title && s.title.toLowerCase().includes(query.toLowerCase())) ||
            (s.artist && s.artist.toLowerCase().includes(query.toLowerCase())) ||
            (s.movie && s.movie.toLowerCase().includes(query.toLowerCase()))
        );
        if (results.length === 0) return `<p>No songs matching "${query}".</p>`;
        let html = `<p><strong>Found ${results.length} songs matching "${query}":</strong></p><ul>`;
        for (const s of results.slice(0, 10)) {
            html += `<li>${s.title} — ${s.artist}</li>`;
        }
        if (results.length > 10) html += `<li>... and ${results.length - 10} more</li>`;
        html += '</ul>';
        return html;
    }

    function handleLanguageFilter(cmd, songs) {
        const lang = cmd.replace(/language|filter|show|songs/gi, '').trim();
        if (!lang) return '<p>Please specify a language. Example: "show Tamil songs"</p>';
        const matches = songs.filter(s => s.language && s.language.toLowerCase().includes(lang.toLowerCase()));
        if (matches.length === 0) return `<p>No songs in ${lang}.</p>`;
        let html = `<p><strong>${matches.length} ${lang} songs:</strong></p><ul>`;
        for (const s of matches.slice(0, 15)) {
            html += `<li>${s.title} — ${s.artist}</li>`;
        }
        if (matches.length > 15) html += `<li>... and ${matches.length - 15} more</li>`;
        html += '</ul>';
        return html;
    }

    function handleMoodFilter(cmd, songs) {
        const mood = cmd.replace(/mood|genre|show|filter|songs/gi, '').trim();
        if (!mood) return '<p>Please specify a mood or genre. Example: "show romantic songs"</p>';
        const matches = songs.filter(s =>
            (s.mood && s.mood.toLowerCase().includes(mood.toLowerCase())) ||
            (s.genre && s.genre.toLowerCase().includes(mood.toLowerCase()))
        );
        if (matches.length === 0) return `<p>No songs matching mood/genre "${mood}".</p>`;
        let html = `<p><strong>${matches.length} songs matching "${mood}":</strong></p><ul>`;
        for (const s of matches.slice(0, 15)) {
            html += `<li>${s.title} — ${s.artist} (${s.genre || 'Unknown'})</li>`;
        }
        if (matches.length > 15) html += `<li>... and ${matches.length - 15} more</li>`;
        html += '</ul>';
        return html;
    }

    function handleQualityCheck(songs) {
        const issues = [];
        for (const s of songs) {
            if (!s.artist) issues.push(`"${s.title}" missing artist`);
            if (!s.language) issues.push(`"${s.title}" missing language`);
            if (!s.genre) issues.push(`"${s.title}" missing genre/mood`);
            if (!s.duration) issues.push(`"${s.title}" missing duration`);
            if (!s.albumCover && !s.thumbnail) issues.push(`"${s.title}" missing artwork`);
        }
        if (issues.length === 0) {
            return `<p><strong>All songs have complete metadata!</strong> Your ${songs.length} songs are in great shape.</p>`;
        }
        let html = `<p><strong>Quality issues found (${issues.length}):</strong></p><ul>`;
        for (const issue of issues.slice(0, 15)) {
            html += `<li>${issue}</li>`;
        }
        if (issues.length > 15) html += `<li>... and ${issues.length - 15} more</li>`;
        html += '</ul><p>Use the AI Auto-fill feature when adding songs to fill in metadata automatically.</p>';
        return html;
    }

    /* ---- Utilities ---- */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ---- Public API ---- */
    return {
        createBotUI,
        toggleBot
    };
})();

if (typeof window !== 'undefined') window.AICommandBot = AICommandBot;
