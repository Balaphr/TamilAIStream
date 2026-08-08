'use strict';
/* ============================================
   YouTube Music-like Features - JavaScript
   Tamil AI Stream Enhanced UI
   ============================================ */

const YTMusic = {
    // State
    isPlaying: false,
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    shuffle: false,
    repeat: 'off',
    volume: 0.7,
    isMuted: false,
    progress: 0,
    duration: 0,
    buffered: 0,
    likedSongs: [],
    playlists: [],
    history: [],
    settings: {
        autoplay: true,
        crossfade: false,
        highQuality: true,
        showLyrics: true,
        notifications: true
    },
    currentPage: 'home',
    searchQuery: '',
    searchFilter: 'all',
    modalMode: 'createPlaylist',
    modalCallback: null,
    visualizerFrame: null,
    assistantListening: false,

    // Initialize
    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderAllPages();
        this.initAssistant();
        this.initVisualizer();
        this.setupAudioEvents();
        this.setupKeyboardShortcuts();
        this.renderQueueList();
        document.body.classList.add('home-active');
        console.log('YTMusic initialized');
    },

    // Load data from localStorage
    loadData() {
        try {
            if (typeof DataStore !== 'undefined') {
                this.likedSongs = DataStore.getLikedSongs();
                this.playlists = DataStore.getPlaylists();
                this.history = DataStore.getHistory();
                this.queue = DataStore.getQueue();
                const settings = DataStore.getYTSettings();
                if (settings && Object.keys(settings).length) this.settings = { ...this.settings, ...settings };
            } else {
                const liked = localStorage.getItem('ytm_likedSongs');
                const playlists = localStorage.getItem('ytm_playlists');
                const history = localStorage.getItem('ytm_history');
                const settings = localStorage.getItem('ytm_settings');
                const queue = localStorage.getItem('ytm_queue');
                if (liked) this.likedSongs = JSON.parse(liked);
                if (playlists) this.playlists = JSON.parse(playlists);
                if (history) this.history = JSON.parse(history);
                if (settings) this.settings = { ...this.settings, ...JSON.parse(settings) };
                if (queue) this.queue = JSON.parse(queue);
            }
        } catch (e) {
            console.error('Error loading YTMusic data:', e);
        }
    },

    // Save data to localStorage
    saveData() {
        try {
            if (typeof DataStore !== 'undefined') {
                DataStore.setLikedSongs(this.likedSongs);
                DataStore.setPlaylists(this.playlists);
                DataStore.setHistory(this.history);
                DataStore.setQueue(this.queue);
                DataStore.setYTSettings(this.settings);
            } else {
                localStorage.setItem('ytm_likedSongs', JSON.stringify(this.likedSongs));
                localStorage.setItem('ytm_playlists', JSON.stringify(this.playlists));
                localStorage.setItem('ytm_history', JSON.stringify(this.history));
                localStorage.setItem('ytm_settings', JSON.stringify(this.settings));
                localStorage.setItem('ytm_queue', JSON.stringify(this.queue));
            }
        } catch (e) {
            console.error('Error saving YTMusic data:', e);
        }
    },

    // ========================================
    // Event Listeners
    // ========================================
    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.ytm-sidebar-item[data-page]').forEach(item => {
            item.addEventListener('click', () => this.navigateTo(item.dataset.page));
        });

        // Bottom nav navigation (mobile)
        document.querySelectorAll('.ytm-bottom-nav-item[data-page]').forEach(item => {
            item.addEventListener('click', () => this.navigateTo(item.dataset.page));
        });

        // Mobile header nav navigation
        document.querySelectorAll('.ytm-mobile-nav-item[data-page]').forEach(item => {
            item.addEventListener('click', () => this.navigateTo(item.dataset.page));
        });

        // Search input
        const searchInput = document.getElementById('ytmSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Search clear
        const searchClear = document.getElementById('ytmSearchClear');
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                const input = document.getElementById('ytmSearchInput');
                if (input) { input.value = ''; this.handleSearch(''); }
            });
        }

        // Mobile search input
        const mobileSearchInput = document.getElementById('ytmMobileSearchInput');
        if (mobileSearchInput) {
            mobileSearchInput.addEventListener('input', (e) => {
                const val = e.target.value;
                const desktopInput = document.getElementById('ytmSearchInput');
                if (desktopInput) desktopInput.value = val;
                this.handleSearch(val);
            });
            mobileSearchInput.addEventListener('focus', () => {
                if (this.currentPage !== 'search') this.navigateTo('search');
            });
        }

        // Mobile logout button
        const mobileLogoutBtn = document.getElementById('ytmMobileLogoutBtn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', () => {
                if (typeof window.logout === 'function') window.logout();
            });
        }

        // Player progress bar click
        const playerProgress = document.getElementById('ytmPlayerProgress');
        if (playerProgress) {
            playerProgress.addEventListener('click', (e) => this.seekTo(e));
        }

        // Fullscreen progress bar click
        const fsProgressBar = document.getElementById('ytmFsProgressBar');
        if (fsProgressBar) {
            fsProgressBar.addEventListener('click', (e) => this.seekTo(e));
        }

        // Volume slider click
        const volumeSlider = document.getElementById('ytmVolumeSlider');
        if (volumeSlider) {
            volumeSlider.addEventListener('click', (e) => this.setVolume(e));
        }

        // Close panels on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ytm-queue-panel') && !e.target.closest('.ytm-player-queue-btn')) {
                this.closeQueuePanel();
            }
            if (!e.target.closest('.ytm-settings-panel') && !e.target.closest('[title="Settings"]')) {
                this.closeSettingsPanel();
            }
            if (!e.target.closest('.ytm-notifications-panel') && !e.target.closest('[title="Notifications"]')) {
                this.closeNotificationsPanel();
            }
            if (!e.target.closest('.ytm-profile-dropdown') && !e.target.closest('.ytm-user-avatar')) {
                this.closeProfileDropdown();
            }
        });
    },

    // Assistant and visualizer
    initAssistant() {
        const fab = document.getElementById('ytmAiFab');
        const panel = document.getElementById('ytmAiPanel');
        const input = document.getElementById('ytmAiInput');
        const sendBtn = document.getElementById('ytmAiSend');
        const voiceBtn = document.getElementById('ytmAiVoice');
        if (!fab || !panel) return;

        fab.addEventListener('click', () => this.toggleAssistant());
        sendBtn?.addEventListener('click', () => this.handleAssistantInput(input?.value));
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleAssistantInput(input.value);
            }
        });
        voiceBtn?.addEventListener('click', () => this.startAssistantVoice());
        this.renderAssistantSuggestions();
        this.addAssistantMessage('assistant', 'Hello! I can play songs, open your queue, or jump to your library. Try “play chill songs” or “show queue”.');
    },

    toggleAssistant() {
        const fab = document.getElementById('ytmAiFab');
        const panel = document.getElementById('ytmAiPanel');
        if (!fab || !panel) return;
        const open = panel.classList.toggle('active');
        fab.classList.toggle('active', open);
        if (open) {
            document.getElementById('ytmAiInput')?.focus();
            this.renderAssistantSuggestions();
        }
    },

    addAssistantMessage(role, text) {
        const container = document.getElementById('ytmAiMessages');
        if (!container) return;
        const bubble = document.createElement('div');
        bubble.className = `ytm-ai-message ${role}`;
        bubble.innerHTML = `<span>${text}</span>`;
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    },

    renderAssistantSuggestions() {
        const container = document.getElementById('ytmAiSuggestions');
        if (!container) return;
        const suggestions = [
            'Play my liked songs',
            'Show queue',
            'Open settings',
            'Search chill songs'
        ];
        container.innerHTML = suggestions.map((text) => `<button class="ytm-ai-suggestion" onclick="YTMusic.handleAssistantInput('${text}')">${text}</button>`).join('');
    },

    handleAssistantInput(text) {
        const value = (text || '').trim();
        if (!value) return;
        const input = document.getElementById('ytmAiInput');
        this.addAssistantMessage('user', value);
        if (input) input.value = '';

        const lower = value.toLowerCase();
        let reply = 'I can help with playback, search, or navigation. Try a simple command.';

        if (lower.includes('queue') || lower.includes('show queue')) {
            this.toggleQueuePanel();
            reply = 'Opening your queue now.';
        } else if (lower.includes('liked') || lower.includes('favorite')) {
            this.navigateTo('liked');
            reply = 'Opening your liked songs.';
        } else if (lower.includes('playlist')) {
            this.navigateTo('playlists');
            reply = 'Opening playlists.';
        } else if (lower.includes('settings')) {
            this.toggleSettingsPanel();
            reply = 'Opening settings.';
        } else if (lower.includes('lyrics')) {
            this.toggleLyrics();
            reply = 'Toggling lyrics.';
        } else if (lower.includes('search') || lower.includes('find')) {
            this.navigateTo('search');
            reply = 'Opening search so you can browse instantly.';
        } else if (lower.includes('play')) {
            const stations = DataStore.getStations();
            const stationMatch = stations.find((s) => (s.name || '').toLowerCase().includes(lower.replace('play', '').trim()) || (s.genre || '').toLowerCase().includes(lower.replace('play', '').trim()));
            if (stationMatch) {
                playStation(stationMatch.name);
                reply = `Playing ${stationMatch.name}.`;
            } else {
                const songs = DataStore.getSongs() || [];
                const songMatch = songs.find((s) => ((s.title || '').toLowerCase().includes(lower.replace('play', '').trim())) || ((s.artist || '').toLowerCase().includes(lower.replace('play', '').trim())));
                if (songMatch) {
                    this.playTrack(songMatch);
                    reply = `Playing ${songMatch.title}.`;
                } else {
                    reply = 'I could not find a matching song or station yet, but I can still open search for you.';
                    this.navigateTo('search');
                }
            }
        }

        this.addAssistantMessage('assistant', reply);
    },

    startAssistantVoice() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.showToast('Voice input is not supported in this browser.', 'info');
            return;
        }
        if (this.assistantListening) return;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        this.assistantListening = true;
        this.showToast('Listening for voice commands…', 'info');
        recognition.onresult = (event) => {
            const transcript = Array.from(event.results).map((result) => result[0].transcript).join('');
            if (transcript) this.handleAssistantInput(transcript);
        };
        recognition.onerror = () => {
            this.showToast('Voice input stopped.', 'info');
        };
        recognition.onend = () => {
            this.assistantListening = false;
        };
        recognition.start();
    },

    initVisualizer() {
        const canvas = document.getElementById('ytmWaveformCanvas');
        const bars = document.getElementById('ytmEqBars');
        if (!canvas || !bars) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const resize = () => {
            const ratio = window.devicePixelRatio || 1;
            canvas.width = canvas.clientWidth * ratio;
            canvas.height = canvas.clientHeight * ratio;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);
        const barCount = 32;
        for (let i = 0; i < barCount; i++) {
            const bar = document.createElement('span');
            bar.className = 'ytm-eq-bar';
            bars.appendChild(bar);
        }
        const draw = () => {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            ctx.clearRect(0, 0, width, height);

            let freqData = null;
            let isActive = false;
            if (typeof audioFreqData !== 'undefined' && audioFreqData && typeof analyserNode !== 'undefined' && analyserNode) {
                analyserNode.getByteFrequencyData(audioFreqData);
                freqData = audioFreqData;
                isActive = this.isPlaying;
            }

            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, '#34d399');
            gradient.addColorStop(0.5, '#10b981');
            gradient.addColorStop(1, '#3ea6ff');

            if (isActive && freqData) {
                const barW = 4;
                const gap = 2;
                const totalBars = Math.floor(width / (barW + gap));
                const step = Math.floor(freqData.length / totalBars);
                for (let i = 0; i < totalBars; i++) {
                    const val = freqData[i * step] / 255;
                    const barH = Math.max(2, val * height * 0.85);
                    const x = i * (barW + gap);
                    const y = (height - barH) / 2;
                    ctx.fillStyle = gradient;
                    ctx.globalAlpha = 0.6 + val * 0.4;
                    ctx.beginPath();
                    ctx.roundRect(x, y, barW, barH, 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            } else {
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                const mid = height / 2;
                for (let i = 0; i <= width; i += 6) {
                    const wave = Math.sin((i / width) * Math.PI * 2 + Date.now() / 1500) * 8;
                    if (i === 0) ctx.moveTo(i, mid + wave);
                    else ctx.lineTo(i, mid + wave);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            const barsList = bars.querySelectorAll('.ytm-eq-bar');
            barsList.forEach((bar, index) => {
                let amplitude;
                if (isActive && freqData) {
                    const idx = Math.floor((index / barsList.length) * freqData.length);
                    amplitude = freqData[idx] / 255;
                } else {
                    amplitude = 0.15 + Math.sin(Date.now() / 2000 + index * 0.5) * 0.1;
                }
                const value = Math.max(8, amplitude * 100);
                bar.style.height = `${value}%`;
                bar.style.opacity = isActive ? (0.5 + amplitude * 0.5) : 0.3;
            });

            this.visualizerFrame = requestAnimationFrame(draw);
        };
        draw();
    },

    stopVisualizer() {
        if (this.visualizerFrame) cancelAnimationFrame(this.visualizerFrame);
        this.visualizerFrame = null;
    },

    // Audio events bridge
    setupAudioEvents() {
        window.addEventListener('ytm:play', (e) => this.playTrack(e.detail));
        window.addEventListener('ytm:pause', () => this.pause());
        window.addEventListener('ytm:timeupdate', (e) => this.updateProgress(e.detail));
        window.addEventListener('ytm:ended', () => this.onTrackEnd());
    },

    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.code) {
                case 'Space': e.preventDefault(); this.togglePlay(); break;
                case 'ArrowRight': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.nextTrack(); } break;
                case 'ArrowLeft': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.previousTrack(); } break;
                case 'ArrowUp': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.setVolume(this.volume + 0.1); } break;
                case 'ArrowDown': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.setVolume(this.volume - 0.1); } break;
                case 'KeyM': this.toggleMute(); break;
                case 'KeyS': this.toggleShuffle(); break;
                case 'KeyR': this.cycleRepeat(); break;
                case 'KeyL': this.toggleLike(); break;
                case 'KeyQ': this.toggleQueuePanel(); break;
                case 'KeyF': if (!e.ctrlKey && !e.metaKey) this.toggleFullscreenPlayer(); break;
                case 'Escape':
                    this.closeFullscreenPlayer();
                    this.closeQueuePanel();
                    this.closeSettingsPanel();
                    this.closeNotificationsPanel();
                    this.closeProfileDropdown();
                    this.closeModal();
                    break;
            }
        });
    },

    // ========================================
    // Navigation
    // ========================================
    navigateTo(page) {
        this.currentPage = page;
        document.body.classList.toggle('home-active', page === 'home');
        document.querySelectorAll('.ytm-sidebar-item[data-page]').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        document.querySelectorAll('.ytm-bottom-nav-item[data-page]').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        document.querySelectorAll('.ytm-mobile-nav-item[data-page]').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        document.querySelectorAll('.ytm-page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById('page-' + page);
        if (target) target.classList.add('active');

        // Render page content
        switch (page) {
            case 'explore': this.renderExploreContent(); break;
            case 'library': this.renderLibraryContent(); break;
            case 'liked': this.renderLikedContent(); break;
            case 'playlists': this.renderPlaylistsContent(); break;
            case 'history': this.renderHistoryContent(); break;
            case 'stations': this.renderStationsContent(); break;
            case 'artists': this.renderArtistsContent(); break;
            case 'search':
                const mobileSI = document.getElementById('ytmMobileSearchInput');
                const desktopSI = document.getElementById('ytmSearchInput');
                if (window.innerWidth <= 640 && mobileSI) {
                    mobileSI.focus();
                } else if (desktopSI) {
                    desktopSI.focus();
                }
                break;
        }

        if (history.pushState) history.pushState(null, null, '#' + page);
    },

    // ========================================
    // Search
    // ========================================
    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        const clearBtn = document.getElementById('ytmSearchClear');
        if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);

        if (query.length > 0) {
            this.navigateTo('search');
            this.performSearch();
        }
    },

    performSearch() {
        const results = { stations: [], songs: [], artists: [] };
        const stations = DataStore.getStations();
        results.stations = stations.filter(s =>
            s.name.toLowerCase().includes(this.searchQuery) ||
            s.genre.toLowerCase().includes(this.searchQuery) ||
            s.city.toLowerCase().includes(this.searchQuery)
        );
        const songs = DataStore.getSongs();
        results.songs = (songs || []).filter(s =>
            (s.title || '').toLowerCase().includes(this.searchQuery) ||
            (s.artist || '').toLowerCase().includes(this.searchQuery) ||
            (s.movie || '').toLowerCase().includes(this.searchQuery)
        );
        const artistHits = DataStore.getArtistHits();
        results.artists = artistHits.filter(a =>
            a.name.toLowerCase().includes(this.searchQuery) ||
            a.artist.toLowerCase().includes(this.searchQuery)
        );
        this.renderSearchResults(results);
    },

    setSearchFilter(filter) {
        this.searchFilter = filter;
        document.querySelectorAll('.ytm-search-filter').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.performSearch();
    },

    // ========================================
    // Player Controls
    // ========================================
    togglePlay() {
        if (this.isPlaying) this.pause();
        else this.resume();
    },

    playTrack(track) {
        if (!track) return;
        if (typeof window.playTrackFromYTMusic === 'function') {
            window.playTrackFromYTMusic(track, {
                queue: this.queue,
                queueIndex: this.queueIndex
            });
            return;
        }
        this.currentTrack = track;
        this.isPlaying = true;
        this.progress = 0;
        this.addToHistory(track);
        this.updatePlayerUI();
        this.updateFullscreenPlayerUI();
        this.updateMiniPlayerUI();
        window.dispatchEvent(new CustomEvent('ytm:playTrack', { detail: track }));
    },

    pause() {
        if (typeof window.pausePlayback === 'function') {
            window.pausePlayback();
        } else {
            this.isPlaying = false;
        }
        this.isPlaying = false;
        this.updatePlayerUI();
        window.dispatchEvent(new CustomEvent('ytm:pauseTrack'));
    },

    resume() {
        if (typeof window.togglePlayPause === 'function') {
            window.togglePlayPause();
            return;
        }
        if (!this.currentTrack && this.queue.length > 0) {
            this.playTrack(this.queue[0]);
            return;
        }
        this.isPlaying = true;
        this.updatePlayerUI();
        window.dispatchEvent(new CustomEvent('ytm:resumeTrack'));
    },

    nextTrack() {
        if (typeof window.playNextTrack === 'function') {
            window.playNextTrack();
            return;
        }
        if (this.queue.length === 0) return;
        if (this.shuffle) this.queueIndex = Math.floor(Math.random() * this.queue.length);
        else this.queueIndex = (this.queueIndex + 1) % this.queue.length;
        this.playTrack(this.queue[this.queueIndex]);
    },

    previousTrack() {
        if (typeof window.playPreviousTrack === 'function') {
            window.playPreviousTrack();
            return;
        }
        if (this.queue.length === 0) return;
        if (this.progress > 3) { this.seekToPercent(0); return; }
        this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
        this.playTrack(this.queue[this.queueIndex]);
    },

    seekTo(e) {
        const bar = e.currentTarget;
        const rect = bar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.seekToPercent(percent);
    },

    seekToPercent(percent) {
        this.progress = percent * this.duration;
        if (typeof window.seekPlaybackToPercent === 'function') {
            window.seekPlaybackToPercent(percent);
        } else {
            window.dispatchEvent(new CustomEvent('ytm:seek', { detail: { time: this.progress } }));
        }
        this.updateProgressUI();
    },

    setVolume(e) {
        if (e && e.currentTarget) {
            const slider = e.currentTarget;
            const rect = slider.getBoundingClientRect();
            this.volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        } else if (typeof e === 'number') {
            this.volume = Math.max(0, Math.min(1, e));
        }
        this.isMuted = this.volume === 0;
        this.updateVolumeUI();
        if (typeof window.setPlaybackVolume === 'function') {
            window.setPlaybackVolume(this.volume);
        } else {
            window.dispatchEvent(new CustomEvent('ytm:setVolume', { detail: { volume: this.volume } }));
        }
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.updateVolumeUI();
        if (typeof window.setPlaybackVolume === 'function') {
            window.setPlaybackVolume(this.isMuted ? 0 : this.volume);
        } else {
            window.dispatchEvent(new CustomEvent('ytm:setVolume', { detail: { volume: this.isMuted ? 0 : this.volume } }));
        }
    },

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        document.querySelectorAll('[data-action="shuffle"]').forEach(b => b.classList.toggle('active', this.shuffle));
        this.showToast(this.shuffle ? 'Shuffle on' : 'Shuffle off', 'info');
    },

    cycleRepeat() {
        const modes = ['off', 'all', 'one'];
        this.repeat = modes[(modes.indexOf(this.repeat) + 1) % 3];
        document.querySelectorAll('[data-action="repeat"]').forEach(b => b.classList.toggle('active', this.repeat !== 'off'));
        this.showToast({ off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }[this.repeat], 'info');
    },

    onTrackEnd() {
        if (this.repeat === 'one') { this.seekToPercent(0); this.resume(); }
        else if (this.repeat === 'all' || this.queueIndex < this.queue.length - 1) this.nextTrack();
        else this.pause();
    },

    updateProgress(detail) {
        if (detail) {
            this.progress = detail.currentTime || 0;
            this.duration = detail.duration || 0;
            this.buffered = detail.buffered || 0;
        }
        this.updateProgressUI();
    },

    // ========================================
    // Queue
    // ========================================
    addToQueue(track) {
        this.queue.push(track);
        this.saveData();
        this.renderQueueList();
        this.showToast('Added to queue', 'success');
    },

    removeFromQueue(index) {
        this.queue.splice(index, 1);
        if (index < this.queueIndex) this.queueIndex--;
        this.saveData();
        this.renderQueueList();
    },

    clearQueue() {
        this.queue = [];
        this.queueIndex = -1;
        this.saveData();
        this.renderQueueList();
        this.showToast('Queue cleared', 'info');
    },

    saveQueue() {
        this.saveData();
        this.showToast('Queue saved', 'success');
    },

    restoreQueue() {
        const restored = DataStore?.getQueue ? DataStore.getQueue() : [];
        if (!restored || !restored.length) {
            this.showToast('No saved queue to restore', 'info');
            return;
        }
        this.queue = restored;
        this.queueIndex = 0;
        this.playTrack(this.queue[0]);
        this.renderQueueList();
        this.showToast('Queue restored', 'success');
    },

    playFromQueue(index) {
        this.queueIndex = index;
        this.playTrack(this.queue[index]);
    },

    toggleQueuePanel() {
        const panel = document.getElementById('ytmQueuePanel');
        if (panel) {
            panel.classList.toggle('active');
            if (panel.classList.contains('active')) this.renderQueueList();
        }
    },

    closeQueuePanel() { document.getElementById('ytmQueuePanel')?.classList.remove('active'); },

    setQueueTab(tab) {
        document.querySelectorAll('.ytm-queue-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        this.renderQueueList(tab);
    },

    // ========================================
    // Liked Songs
    // ========================================
    toggleLike(track) {
        if (!track) track = this.currentTrack;
        if (!track) return;
        const idx = this.likedSongs.findIndex(s => s.id === track.id);
        if (idx > -1) { this.likedSongs.splice(idx, 1); this.showToast('Removed from Liked Songs', 'info'); }
        else { this.likedSongs.push(track); this.showToast('Added to Liked Songs', 'success'); }
        this.saveData();
        this.updateLikeButton();
        this.updateLikedBadge();
    },

    isLiked(track) {
        if (!track) track = this.currentTrack;
        return track ? this.likedSongs.some(s => s.id === track.id) : false;
    },

    updateLikeButton() {
        const liked = this.isLiked();
        document.querySelectorAll('#ytmPlayerLikeBtn, #ytmFsLikeBtn').forEach(btn => {
            btn.classList.toggle('liked', liked);
            const icon = btn.querySelector('i');
            if (icon) icon.className = liked ? 'fas fa-heart' : 'far fa-heart';
        });
    },

    updateLikedBadge() {
        const badge = document.getElementById('likedBadge');
        if (badge) badge.textContent = this.likedSongs.length;
    },

    // ========================================
    // Playlists
    // ========================================
    createPlaylist(name) {
        if (!name || !name.trim()) { this.showToast('Please enter a playlist name', 'error'); return; }
        const playlist = { id: 'pl_' + Date.now(), name: name.trim(), tracks: [], createdAt: new Date().toISOString() };
        this.playlists.push(playlist);
        this.saveData();
        this.closeModal();
        this.showToast('Playlist created', 'success');
        if (this.currentPage === 'playlists') this.renderPlaylistsContent();
        this.renderSidebarPlaylists();
    },

    deletePlaylist(id) {
        this.playlists = this.playlists.filter(p => p.id !== id);
        this.saveData();
        this.showToast('Playlist deleted', 'info');
        this.renderPlaylistsContent();
        this.renderSidebarPlaylists();
    },

    addToPlaylist(playlistId, track) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (playlist && !playlist.tracks.some(t => t.id === track.id)) {
            playlist.tracks.push(track);
            this.saveData();
            this.showToast('Added to ' + playlist.name, 'success');
        }
    },

    playPlaylist(playlist, shuffle) {
        if (!playlist || !playlist.tracks.length) { this.showToast('Playlist is empty', 'info'); return; }
        this.queue = [...playlist.tracks];
        if (shuffle) this.queue.sort(() => Math.random() - 0.5);
        this.queueIndex = 0;
        this.playTrack(this.queue[0]);
    },

    openAddToPlaylistModal() {
        if (!this.currentTrack) return;
        this.modalMode = 'addToPlaylist';
        this.modalCallback = (playlistId) => this.addToPlaylist(playlistId, this.currentTrack);
        document.getElementById('ytmModalTitle').textContent = 'Add to Playlist';
        document.getElementById('ytmModalInput').placeholder = 'Search playlists...';
        document.getElementById('ytmModalInput').value = '';
        const input = document.getElementById('ytmModalInput');
        input.oninput = () => this.renderPlaylistChoices(input.value);
        document.getElementById('ytmModalOverlay').classList.add('active');
        this.renderPlaylistChoices('');
    },

    renderPlaylistChoices(query) {
        const body = document.querySelector('.ytm-modal-body');
        const filtered = this.playlists.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
        let html = filtered.length ? filtered.map(p => `
            <div class="ytm-search-song-item" onclick="YTMusic.modalCallback('${p.id}'); YTMusic.closeModal();" style="padding:10px;border-radius:8px;cursor:pointer;">
                <i class="fas fa-music" style="color:var(--ytm-text-dim)"></i>
                <div class="ytm-search-song-info">
                    <div class="ytm-search-song-title">${p.name}</div>
                    <div class="ytm-search-song-artist">${p.tracks.length} songs</div>
                </div>
            </div>
        `).join('') : '<p style="text-align:center;color:var(--ytm-text-dim);padding:20px;">No playlists found</p>';
        body.innerHTML = `<input type="text" class="ytm-modal-input" id="ytmModalInput" placeholder="Search playlists..." oninput="YTMusic.renderPlaylistChoices(this.value)">${html}`;
    },

    // ========================================
    // History
    // ========================================
    addToHistory(track) {
        if (!track) return;
        this.history = this.history.filter(h => h.id !== track.id);
        this.history.unshift({ ...track, playedAt: new Date().toISOString() });
        if (this.history.length > 100) this.history = this.history.slice(0, 100);
        this.saveData();
    },

    clearHistory() {
        this.history = [];
        this.saveData();
        this.renderHistoryContent();
        this.showToast('History cleared', 'info');
    },

    // ========================================
    // Settings
    // ========================================
    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveData();
    },

    toggleSettingsPanel() {
        const panel = document.getElementById('ytmSettingsPanel');
        if (panel) { panel.classList.toggle('active'); if (panel.classList.contains('active')) this.renderSettingsContent(); }
    },

    closeSettingsPanel() { document.getElementById('ytmSettingsPanel')?.classList.remove('active'); },

    // ========================================
    // Notifications
    // ========================================
    toggleNotificationsPanel() {
        const panel = document.getElementById('ytmNotificationsPanel');
        if (panel) { panel.classList.toggle('active'); if (panel.classList.contains('active')) this.renderNotificationsContent(); }
    },

    closeNotificationsPanel() { document.getElementById('ytmNotificationsPanel')?.classList.remove('active'); },

    // ========================================
    // Profile Dropdown
    // ========================================
    toggleProfileDropdown() {
        const dd = document.getElementById('ytmProfileDropdown');
        if (dd) { dd.classList.toggle('active'); if (dd.classList.contains('active')) this.renderProfileDropdown(); }
    },

    closeProfileDropdown() { document.getElementById('ytmProfileDropdown')?.classList.remove('active'); },

    // ========================================
    // Fullscreen Player
    // ========================================
    toggleFullscreenPlayer() {
        const p = document.getElementById('ytmFullscreenPlayer');
        if (p) { p.classList.toggle('active'); document.body.style.overflow = p.classList.contains('active') ? 'hidden' : ''; }
    },

    closeFullscreenPlayer() {
        document.getElementById('ytmFullscreenPlayer')?.classList.remove('active');
        document.body.style.overflow = '';
    },

    // ========================================
    // Mini Player
    // ========================================
    toggleMiniPlayer() {
        document.getElementById('ytmMiniPlayer')?.classList.toggle('active');
    },

    closeMiniPlayer() { document.getElementById('ytmMiniPlayer')?.classList.remove('active'); },

    // ========================================
    // Modal
    // ========================================
    openCreatePlaylistModal() {
        this.modalMode = 'createPlaylist';
        this.modalCallback = null;
        document.getElementById('ytmModalTitle').textContent = 'New Playlist';
        const input = document.getElementById('ytmModalInput');
        input.value = '';
        input.placeholder = 'Playlist name';
        input.oninput = null;
        document.querySelector('.ytm-modal-body').innerHTML = '';
        document.querySelector('.ytm-modal-body').appendChild(input);
        document.getElementById('ytmModalConfirm').textContent = 'Create';
        document.getElementById('ytmModalOverlay').classList.add('active');
        input.focus();
    },

    closeModal() {
        document.getElementById('ytmModalOverlay')?.classList.remove('active');
    },

    confirmModal() {
        if (this.modalMode === 'createPlaylist') {
            const name = document.getElementById('ytmModalInput')?.value;
            this.createPlaylist(name);
        }
    },

    toggleLyrics() {
        const panel = document.getElementById('ytmLyricsPanel');
        if (panel) panel.classList.toggle('active');
    },

    shareTrack() {
        if (!this.currentTrack) return;
        if (navigator.share) {
            navigator.share({ title: this.currentTrack.title, text: 'Listen to ' + this.currentTrack.title + ' on Tamil AI Stream', url: window.location.href });
        } else {
            navigator.clipboard?.writeText(window.location.href);
            this.showToast('Link copied to clipboard', 'success');
        }
    },

    // ========================================
    // Toast
    // ========================================
    showToast(message, type) {
        const container = document.getElementById('ytmToastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'ytm-toast ' + (type || 'info');
        const icons = { success: 'fas fa-check-circle', error: 'fas fa-exclamation-circle', info: 'fas fa-info-circle' };
        toast.innerHTML = `<i class="ytm-toast-icon ${icons[type] || icons.info}"></i><span>${message}</span><button class="ytm-toast-close"><i class="fas fa-times"></i></button>`;
        container.appendChild(toast);
        toast.querySelector('.ytm-toast-close').addEventListener('click', () => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); });
        setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3000);
    },

    // ========================================
    // Format Time
    // ========================================
    formatTime(s) {
        if (!s || isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + sec.toString().padStart(2, '0');
    },

    // ========================================
    // UI Updates
    // ========================================
    updatePlayerUI() {
        if (!this.currentTrack) return;
        const t = this.currentTrack;
        this.setPlayIcon('ytmFsPlayBtn', this.isPlaying);
        this.setPlayIcon('ytmMiniPlayBtn', this.isPlaying);
        document.querySelectorAll('[data-action="shuffle"]').forEach((btn) => btn.classList.toggle('active', this.shuffle));
        document.querySelectorAll('[data-action="repeat"]').forEach((btn) => btn.classList.toggle('active', this.repeat !== 'off'));
        this.updateFullscreenPlayerUI();
        this.updateMiniPlayerUI();
        this.updateProgressUI();
        this.updateLikeButton();
    },

    updateProgressUI() {
        const pct = this.duration ? (this.progress / this.duration) * 100 : 0;
        this.setWidth('ytmFsProgressFilled', pct + '%');
        this.setLeft('ytmFsProgressThumb', pct + '%');
        this.setWidth('ytmMiniProgressFilled', pct + '%');
        this.setText('ytmFsCurrentTime', this.formatTime(this.progress));
        this.setText('ytmFsTotalTime', this.formatTime(this.duration));
    },

    updateLikeButton() {
        const liked = this.isLiked();
        const fsBtn = document.getElementById('ytmFsLikeBtn');
        if (fsBtn) {
            fsBtn.classList.toggle('liked', liked);
            const icon = fsBtn.querySelector('i');
            if (icon) icon.className = liked ? 'fas fa-heart' : 'far fa-heart';
        }
    },

    updateFullscreenPlayerUI() {
        if (!this.currentTrack) return;
        const t = this.currentTrack;
        this.setText('ytmFsTitle', t.title || 'Unknown');
        this.setText('ytmFsArtist', t.artist || t.name || '');
        const artwork = document.getElementById('ytmFsArtwork');
        const placeholder = document.getElementById('ytmFsPlaceholder');
        const qualityBadge = document.getElementById('ytmQualityBadge');
        const nowPlayingBadge = document.getElementById('ytmNowPlayingBadge');
        if (t.thumbnail || t.cover) {
            this.setSrc('ytmFsArtwork', t.thumbnail || t.cover);
            if (artwork) artwork.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        } else {
            if (artwork) artwork.style.display = 'none';
            if (placeholder) placeholder.style.display = 'flex';
        }
        if (qualityBadge) qualityBadge.textContent = t.streamUrl ? 'Live Stream' : 'AAC 320 kbps';
        if (nowPlayingBadge) nowPlayingBadge.textContent = t.streamUrl ? 'Live FM' : 'Now Playing';
        this.updateProgressUI();
        this.updateLikeButton();
    },

    updateMiniPlayerUI() {
        if (!this.currentTrack) return;
        const t = this.currentTrack;
        this.setText('ytmMiniTitle', t.title || 'Unknown');
        this.setText('ytmMiniArtist', t.artist || '');
        this.setSrc('ytmMiniThumb', t.thumbnail || t.cover || '');
    },

    setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; },
    setSrc(id, src) { const el = document.getElementById(id); if (el) el.src = src; },
    setWidth(id, w) { const el = document.getElementById(id); if (el) el.style.width = w; },
    setLeft(id, l) { const el = document.getElementById(id); if (el) el.style.left = l; },
    setPlayIcon(id, playing) { const el = document.querySelector('#' + id + ' i'); if (el) el.className = playing ? 'fas fa-pause' : 'fas fa-play'; },

    // ========================================
    // Page Renderers
    // ========================================
    renderAllPages() {
        this.updateLikedBadge();
        this.renderSidebarPlaylists();
    },

    renderSidebarPlaylists() {
        const container = document.getElementById('sidebarPlaylists');
        if (!container) return;
        container.innerHTML = this.playlists.map(p => `
            <div class="ytm-sidebar-playlist-item" onclick="YTMusic.playPlaylist(YTMusic.playlists.find(pl=>pl.id==='${p.id}'))">
                <i class="fas fa-music"></i>
                <span>${p.name}</span>
            </div>
        `).join('');
    },

    renderSearchResults(results) {
        const container = document.getElementById('ytmSearchResults');
        if (!container) return;
        let html = '';
        if (results.stations.length) {
            html += `<div class="ytm-search-section"><div class="ytm-search-section-header"><h3 class="ytm-search-section-title">Stations</h3></div><div class="ytm-search-song-list">${results.stations.slice(0, 5).map(s => `
                <div class="ytm-search-song-item" onclick="playStation('${s.name}')">
                    <div class="ytm-search-song-thumb" style="background:${s.gradient || 'var(--ytm-surface-3)'}"></div>
                    <div class="ytm-search-song-info"><div class="ytm-search-song-title">${s.name}</div><div class="ytm-search-song-artist">${s.freq} • ${s.genre}</div></div>
                </div>`).join('')}</div></div>`;
        }
        if (results.artists.length) {
            html += `<div class="ytm-search-section"><div class="ytm-search-section-header"><h3 class="ytm-search-section-title">Artists</h3></div><div class="ytm-search-song-list">${results.artists.slice(0, 5).map(a => `
                <div class="ytm-search-song-item">
                    <div class="ytm-search-song-thumb" style="border-radius:50%;background:${a.gradient || 'var(--ytm-surface-3)'}"></div>
                    <div class="ytm-search-song-info"><div class="ytm-search-song-title">${a.name}</div><div class="ytm-search-song-artist">Artist • ${a.songCount} songs</div></div>
                </div>`).join('')}</div></div>`;
        }
        if (results.songs.length) {
            html += `<div class="ytm-search-section"><div class="ytm-search-section-header"><h3 class="ytm-search-section-title">Songs</h3></div><div class="ytm-search-song-list">${results.songs.slice(0, 10).map(s => `
                <div class="ytm-search-song-item" onclick="YTMusic.playTrack(${JSON.stringify(s).replace(/"/g, '&quot;')})">
                    <div class="ytm-search-song-thumb"><img src="${s.cover || ''}" alt=""></div>
                    <div class="ytm-search-song-info"><div class="ytm-search-song-title">${s.title}</div><div class="ytm-search-song-artist">${s.artist}</div></div>
                </div>`).join('')}</div></div>`;
        }
        if (!html) html = '<div class="ytm-queue-empty"><i class="fas fa-search"></i><p>No results found</p></div>';
        container.innerHTML = html;
    },

    renderExploreContent() {
        const c = document.getElementById('ytmExploreContent');
        if (!c) return;
        const cats = DataStore.getCategories();
        const stations = DataStore.getStations();
        c.innerHTML = `
            <div class="ytm-explore-section"><h2 class="ytm-explore-title">Browse All</h2><div class="ytm-explore-grid">
                ${cats.map(cat => `<div class="ytm-explore-card"><div class="ytm-explore-card-bg" style="background:linear-gradient(135deg,hsl(${Math.random()*360},40%,30%),hsl(${Math.random()*360},50%,20%))"><i class="fas ${cat.icon}"></i></div><div class="ytm-explore-card-label">${cat.name}</div></div>`).join('')}
            </div></div>
            <div class="ytm-explore-section"><h2 class="ytm-explore-title">Tamil FM Stations</h2><div class="ytm-explore-grid">
                ${stations.slice(0, 8).map(s => `<div class="ytm-explore-card" onclick="playStation('${s.name}')"><div class="ytm-explore-card-bg" style="background:${s.gradient}"><i class="fas fa-radio"></i></div><div class="ytm-explore-card-label">${s.name}</div></div>`).join('')}
            </div></div>
            <div class="ytm-explore-section"><h2 class="ytm-explore-title">Moods & Genres</h2><div class="ytm-explore-grid">
                ${['Workout','Party','Chill','Focus','Sleep','Romance','Happy','Relax'].map(m => `<div class="ytm-explore-card"><div class="ytm-explore-card-bg" style="background:linear-gradient(135deg,hsl(${Math.random()*360},60%,40%),hsl(${Math.random()*360},70%,25%))"><i class="fas fa-music"></i></div><div class="ytm-explore-card-label">${m}</div></div>`).join('')}
            </div></div>`;
    },

    renderLibraryContent() {
        const c = document.getElementById('ytmLibraryContent');
        if (!c) return;
        const stations = DataStore.getStations();
        const artists = DataStore.getArtistHits();
        c.innerHTML = `<div class="ytm-library-grid">
            <div class="ytm-library-card" onclick="YTMusic.navigateTo('liked')"><div class="ytm-library-card-art" style="background:linear-gradient(135deg,#1db954,#1ed760)"><i class="fas fa-heart"></i></div><div class="ytm-library-card-info"><div class="ytm-library-card-title">Liked Songs</div><div class="ytm-library-card-subtitle">${this.likedSongs.length} songs</div></div></div>
            <div class="ytm-library-card" onclick="YTMusic.navigateTo('playlists')"><div class="ytm-library-card-art" style="background:linear-gradient(135deg,#3ea6ff,#65b8ff)"><i class="fas fa-list"></i></div><div class="ytm-library-card-info"><div class="ytm-library-card-title">Playlists</div><div class="ytm-library-card-subtitle">${this.playlists.length} playlists</div></div></div>
            <div class="ytm-library-card" onclick="YTMusic.navigateTo('history')"><div class="ytm-library-card-art" style="background:linear-gradient(135deg,#ff0000,#cc0000)"><i class="fas fa-clock-rotate-left"></i></div><div class="ytm-library-card-info"><div class="ytm-library-card-title">History</div><div class="ytm-library-card-subtitle">${this.history.length} songs</div></div></div>
            <div class="ytm-library-card" onclick="YTMusic.navigateTo('stations')"><div class="ytm-library-card-art" style="background:linear-gradient(135deg,#ff6b35,#f7931e)"><i class="fas fa-radio"></i></div><div class="ytm-library-card-info"><div class="ytm-library-card-title">Stations</div><div class="ytm-library-card-subtitle">${stations.length} stations</div></div></div>
            <div class="ytm-library-card" onclick="YTMusic.navigateTo('artists')"><div class="ytm-library-card-art" style="background:linear-gradient(135deg,#9c27b0,#673ab7)"><i class="fas fa-users"></i></div><div class="ytm-library-card-info"><div class="ytm-library-card-title">Artists</div><div class="ytm-library-card-subtitle">${artists.length} artists</div></div></div>
        </div>`;
    },

    renderLikedContent() {
        const c = document.getElementById('ytmLikedContent');
        if (!c) return;
        c.innerHTML = `
            <div class="ytm-playlist-header"><div class="ytm-playlist-cover" style="background:linear-gradient(135deg,#1db954,#1ed760)"><i class="fas fa-heart"></i></div>
                <div class="ytm-playlist-info"><div class="ytm-playlist-title">Liked Songs</div><div class="ytm-playlist-meta">${this.likedSongs.length} songs</div>
                    <div class="ytm-playlist-actions">
                        <button class="ytm-playlist-play-btn" onclick="YTMusic.playLikedSongs()"><i class="fas fa-play"></i> Play</button>
                        <button class="ytm-playlist-shuffle-btn" onclick="YTMusic.playLikedSongs(true)"><i class="fas fa-shuffle"></i> Shuffle</button>
                    </div>
                </div>
            </div>
            <div class="ytm-playlist-tracks">
                ${this.likedSongs.length === 0 ? '<div class="ytm-queue-empty"><i class="fas fa-heart"></i><p>No liked songs yet</p></div>' : this.likedSongs.map((s, i) => `
                    <div class="ytm-playlist-track ${this.currentTrack?.id === s.id ? 'playing' : ''}" onclick="YTMusic.playTrack(${JSON.stringify(s).replace(/"/g, '&quot;')})">
                        <div class="ytm-playlist-track-num">${i + 1}</div>
                        <div class="ytm-playlist-track-thumb"><img src="${s.thumbnail || s.cover || ''}" alt=""></div>
                        <div class="ytm-playlist-track-info"><div class="ytm-playlist-track-title">${s.title || 'Unknown'}</div><div class="ytm-playlist-track-artist">${s.artist || ''}</div></div>
                        <div class="ytm-playlist-track-duration">${this.formatTime(s.duration)}</div>
                    </div>`).join('')}
            </div>`;
    },

    renderPlaylistsContent() {
        const c = document.getElementById('ytmPlaylistsContent');
        if (!c) return;
        c.innerHTML = `
            <div class="ytm-playlist-header"><div class="ytm-playlist-cover"><i class="fas fa-list"></i></div>
                <div class="ytm-playlist-info"><div class="ytm-playlist-title">Your Playlists</div><div class="ytm-playlist-meta">${this.playlists.length} playlists</div>
                    <div class="ytm-playlist-actions"><button class="ytm-playlist-play-btn" onclick="YTMusic.openCreatePlaylistModal()"><i class="fas fa-plus"></i> New Playlist</button></div>
                </div>
            </div>
            <div class="ytm-library-grid">
                ${this.playlists.length === 0 ? '<div class="ytm-queue-empty"><i class="fas fa-list"></i><p>No playlists yet</p></div>' : this.playlists.map(p => `
                    <div class="ytm-library-card" onclick="YTMusic.playPlaylist(YTMusic.playlists.find(pl=>pl.id==='${p.id}'))">
                        <div class="ytm-library-card-art"><i class="fas fa-music"></i></div>
                        <div class="ytm-library-card-info"><div class="ytm-library-card-title">${p.name}</div><div class="ytm-library-card-subtitle">${p.tracks.length} songs</div></div>
                    </div>`).join('')}
            </div>`;
    },

    renderHistoryContent() {
        const c = document.getElementById('ytmHistoryContent');
        if (!c) return;
        c.innerHTML = `
            <div class="ytm-playlist-header"><div class="ytm-playlist-cover" style="background:linear-gradient(135deg,#ff0000,#cc0000)"><i class="fas fa-clock-rotate-left"></i></div>
                <div class="ytm-playlist-info"><div class="ytm-playlist-title">Listening History</div><div class="ytm-playlist-meta">${this.history.length} songs</div>
                    <div class="ytm-playlist-actions">
                        <button class="ytm-playlist-play-btn" onclick="YTMusic.playHistory()"><i class="fas fa-play"></i> Play</button>
                        <button class="ytm-playlist-shuffle-btn" onclick="YTMusic.clearHistory()"><i class="fas fa-trash"></i> Clear</button>
                    </div>
                </div>
            </div>
            <div class="ytm-playlist-tracks">
                ${this.history.length === 0 ? '<div class="ytm-queue-empty"><i class="fas fa-clock-rotate-left"></i><p>No listening history yet</p></div>' : this.history.map((s, i) => `
                    <div class="ytm-playlist-track ${this.currentTrack?.id === s.id ? 'playing' : ''}" onclick="YTMusic.playTrack(${JSON.stringify(s).replace(/"/g, '&quot;')})">
                        <div class="ytm-playlist-track-num">${i + 1}</div>
                        <div class="ytm-playlist-track-thumb"><img src="${s.thumbnail || s.cover || ''}" alt=""></div>
                        <div class="ytm-playlist-track-info"><div class="ytm-playlist-track-title">${s.title || 'Unknown'}</div><div class="ytm-playlist-track-artist">${s.artist || ''}</div></div>
                        <div class="ytm-playlist-track-duration">${s.playedAt ? new Date(s.playedAt).toLocaleDateString() : ''}</div>
                    </div>`).join('')}
            </div>`;
    },

    renderStationsContent() {
        const c = document.getElementById('ytmStationsContent');
        if (!c) return;
        const stations = DataStore.getStations();
        c.innerHTML = `
            <div class="ytm-playlist-header"><div class="ytm-playlist-cover" style="background:linear-gradient(135deg,#ff6b35,#f7931e)"><i class="fas fa-radio"></i></div>
                <div class="ytm-playlist-info"><div class="ytm-playlist-title">All FM Stations</div><div class="ytm-playlist-meta">${stations.length} stations</div></div>
            </div>
            <div class="ytm-playlist-tracks">
                ${stations.filter(s => s.status === 'active').map(s => `
                    <div class="ytm-playlist-track" onclick="playStation('${s.name}')">
                        <div class="ytm-playlist-track-num"><i class="fas fa-play"></i></div>
                        <div class="ytm-playlist-track-thumb" style="background:${s.gradient};border-radius:8px"></div>
                        <div class="ytm-playlist-track-info"><div class="ytm-playlist-track-title">${s.name}</div><div class="ytm-playlist-track-artist">${s.freq} • ${s.genre} • ${s.city}</div></div>
                        <div class="ytm-playlist-track-duration">${((s.listeners || 0) / 1000).toFixed(1)}K</div>
                    </div>`).join('')}
            </div>`;
    },

    renderArtistsContent() {
        const c = document.getElementById('ytmArtistsContent');
        if (!c) return;
        const artists = DataStore.getArtistHits();
        c.innerHTML = `
            <div class="ytm-playlist-header"><div class="ytm-playlist-cover" style="background:linear-gradient(135deg,#9c27b0,#673ab7)"><i class="fas fa-users"></i></div>
                <div class="ytm-playlist-info"><div class="ytm-playlist-title">Artists</div><div class="ytm-playlist-meta">${artists.length} artists</div></div>
            </div>
            <div class="ytm-explore-grid" style="padding:0 24px">
                ${artists.filter(a => a.status === 'active').map(a => `
                    <div class="ytm-explore-card"><div class="ytm-explore-card-bg" style="background:${a.gradient}"><i class="fas fa-user"></i></div><div class="ytm-explore-card-label">${a.name}</div></div>`).join('')}
            </div>`;
    },

    renderQueueList(tab) {
        tab = tab || 'queue';
        const list = document.getElementById('ytmQueueList');
        if (!list) return;
        const items = tab === 'queue' ? this.queue : this.history;
        if (!items.length) {
            list.innerHTML = `<div class="ytm-queue-empty"><i class="fas fa-music"></i><p>No ${tab === 'queue' ? 'songs in queue' : 'play history'}</p></div>`;
            return;
        }
        list.innerHTML = items.map((item, i) => `
            <div class="ytm-queue-item ${tab === 'queue' && i === this.queueIndex ? 'playing' : ''}" onclick="YTMusic.${tab === 'queue' ? 'playFromQueue' : 'playTrack'}(${tab === 'queue' ? i : ''})">
                <div class="ytm-queue-item-thumb"><img src="${item.thumbnail || item.cover || ''}" alt=""></div>
                <div class="ytm-queue-item-info"><div class="ytm-queue-item-title">${item.title || item.name || 'Unknown'}</div><div class="ytm-queue-item-artist">${item.artist || ''}</div></div>
                ${tab === 'queue' ? `<button class="ytm-queue-item-remove" onclick="event.stopPropagation();YTMusic.removeFromQueue(${i})"><i class="fas fa-times"></i></button>` : ''}
            </div>`).join('');
    },

    renderSettingsContent() {
        const c = document.getElementById('ytmSettingsContent');
        if (!c) return;
        c.innerHTML = `
            <div class="ytm-settings-section"><div class="ytm-settings-section-title">Playback</div>
                <div class="ytm-settings-item"><span class="ytm-settings-item-label">Autoplay</span><button class="ytm-settings-toggle ${this.settings.autoplay ? 'active' : ''}" onclick="YTMusic.updateSetting('autoplay',!YTMusic.settings.autoplay);this.classList.toggle('active')"></button></div>
                <div class="ytm-settings-item"><span class="ytm-settings-item-label">Crossfade</span><button class="ytm-settings-toggle ${this.settings.crossfade ? 'active' : ''}" onclick="YTMusic.updateSetting('crossfade',!YTMusic.settings.crossfade);this.classList.toggle('active')"></button></div>
                <div class="ytm-settings-item"><span class="ytm-settings-item-label">High Quality Audio</span><button class="ytm-settings-toggle ${this.settings.highQuality ? 'active' : ''}" onclick="YTMusic.updateSetting('highQuality',!YTMusic.settings.highQuality);this.classList.toggle('active')"></button></div>
            </div>
            <div class="ytm-settings-section"><div class="ytm-settings-section-title">Display</div>
                <div class="ytm-settings-item"><span class="ytm-settings-item-label">Show Lyrics</span><button class="ytm-settings-toggle ${this.settings.showLyrics ? 'active' : ''}" onclick="YTMusic.updateSetting('showLyrics',!YTMusic.settings.showLyrics);this.classList.toggle('active')"></button></div>
            </div>
            <div class="ytm-settings-section"><div class="ytm-settings-section-title">Notifications</div>
                <div class="ytm-settings-item"><span class="ytm-settings-item-label">Enable Notifications</span><button class="ytm-settings-toggle ${this.settings.notifications ? 'active' : ''}" onclick="YTMusic.updateSetting('notifications',!YTMusic.settings.notifications);this.classList.toggle('active')"></button></div>
            </div>
            <div class="ytm-settings-section"><div class="ytm-settings-section-title">Audio</div>
                <div class="ytm-settings-item"><span class="ytm-settings-item-label">Volume</span><span class="ytm-settings-item-value">${Math.round(this.volume * 100)}%</span></div>
            </div>`;
    },

    renderNotificationsContent() {
        const c = document.getElementById('ytmNotificationsList');
        if (!c) return;
        c.innerHTML = `
            <div class="ytm-notification-item unread"><div class="ytm-notification-icon"><i class="fas fa-radio"></i></div><div class="ytm-notification-content"><div class="ytm-notification-title">New Station Added</div><div class="ytm-notification-text">Tamil Hits Songs is now available!</div><div class="ytm-notification-time">2 hours ago</div></div></div>
            <div class="ytm-notification-item unread"><div class="ytm-notification-icon"><i class="fas fa-compact-disc"></i></div><div class="ytm-notification-content"><div class="ytm-notification-title">Weekly Mix Ready</div><div class="ytm-notification-text">Your personalized mix is ready to play</div><div class="ytm-notification-time">1 day ago</div></div></div>
            <div class="ytm-notification-item"><div class="ytm-notification-icon"><i class="fas fa-arrow-up"></i></div><div class="ytm-notification-content"><div class="ytm-notification-title">App Update</div><div class="ytm-notification-text">New features available in the latest update</div><div class="ytm-notification-time">3 days ago</div></div></div>`;
    },

    renderProfileDropdown() {
        const user = JSON.parse(localStorage.getItem('tamilAIStream_user') || '{}');
        const dd = document.getElementById('ytmProfileDropdown');
        if (!dd) return;
        dd.innerHTML = `
            <div class="ytm-profile-header"><div class="ytm-profile-avatar"><img src="${user.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect width=%27100%27 height=%27100%27 fill=%27%2334d399%27 opacity=%270.2%27/%3E%3Ccircle cx=%2750%27 cy=%2735%27 r=%2720%27 fill=%27%2334d399%27 opacity=%270.6%27/%3E%3Ccircle cx=%2750%27 cy=%2780%27 r=%2730%27 fill=%27%2334d399%27 opacity=%270.4%27/%3E%3C/svg%3E'}" alt=""></div>
                <div><div class="ytm-profile-name">${user.name || 'User'}</div><div class="ytm-profile-email">${user.email || ''}</div></div></div>
            <div class="ytm-profile-menu">
                <div class="ytm-profile-menu-item" onclick="YTMusic.navigateTo('library');YTMusic.closeProfileDropdown()"><i class="fas fa-book-open"></i> Library</div>
                <div class="ytm-profile-menu-item" onclick="YTMusic.navigateTo('liked');YTMusic.closeProfileDropdown()"><i class="fas fa-heart"></i> Liked Songs</div>
                <div class="ytm-profile-menu-item" onclick="YTMusic.navigateTo('history');YTMusic.closeProfileDropdown()"><i class="fas fa-clock-rotate-left"></i> History</div>
                <div class="ytm-profile-divider"></div>
                <div class="ytm-profile-menu-item" onclick="YTMusic.toggleSettingsPanel();YTMusic.closeProfileDropdown()"><i class="fas fa-gear"></i> Settings</div>
                <div class="ytm-profile-menu-item" onclick="window.location.href='profile.html'"><i class="fas fa-user"></i> Profile</div>
                <div class="ytm-profile-divider"></div>
                 <div class="ytm-profile-menu-item" onclick="window.logout();YTMusic.closeProfileDropdown()"><i class="fas fa-sign-out-alt"></i> Sign out</div>
            </div>`;
    },

    // Helper functions
    playLikedSongs(shuffle) {
        if (!this.likedSongs.length) { this.showToast('No liked songs yet', 'info'); return; }
        this.queue = [...this.likedSongs];
        if (shuffle) this.queue.sort(() => Math.random() - 0.5);
        this.queueIndex = 0;
        this.playTrack(this.queue[0]);
    },

    playHistory() {
        if (!this.history.length) { this.showToast('No listening history yet', 'info'); return; }
        this.queue = [...this.history];
        this.queueIndex = 0;
        this.playTrack(this.queue[0]);
    }
};

document.addEventListener('DOMContentLoaded', () => { YTMusic.init(); });
window.YTMusic = YTMusic;