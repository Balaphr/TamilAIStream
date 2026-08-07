'use strict';

// ============================================
// Global Music Player - Spotify-like Experience
// ============================================

const GlobalPlayer = {
    // State
    audio: null,
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    history: [],
    isPlaying: false,
    shuffle: false,
    repeat: 'off',
    volume: 0.7,
    previousVolume: 0.7,
    isMuted: false,
    isFullscreen: false,
    isQueueOpen: false,
    queueTab: 'queue',
    progress: 0,
    duration: 0,
    buffered: 0,
    likedSongs: [],
    _activePlayElement: null,
    _activePlayKey: null,
    
    // ========================================
    // Initialize
    // ========================================
    init() {
        this.audio = document.getElementById('globalAudioPlayer');
        if (!this.audio) {
            console.error('Global audio player not found');
            return;
        }
        
        // Configure audio element
        this.audio.preload = 'auto';
        this.audio.crossOrigin = 'anonymous';
        this.audio.volume = this.volume;
        
        this.loadState();
        this.setupAudioEvents();
        this.setupKeyboardShortcuts();
        this.setupProgressEvents();
        this.setupVolumeEvents();
        this.setupPlayButtonTracking();
        this.loadLikedSongs();
        this.stopAllOtherAudio();
        
        console.log('Global Player initialized');
        console.log('Audio element ready:', this.audio);
    },
    
    // ========================================
    // Stop All Other Audio Players
    // ========================================
    stopAllOtherAudio() {
        const allAudio = document.querySelectorAll('audio');
        allAudio.forEach(audio => {
            if (audio.id !== 'globalAudioPlayer') {
                audio.pause();
                audio.currentTime = 0;
                audio.src = '';
                audio.load();
            }
        });
        
        if (typeof audioPlayer !== 'undefined' && audioPlayer && audioPlayer !== this.audio) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioPlayer.src = '';
        }
    },
    
    // ========================================
    // State Management
    // ========================================
    loadState() {
        try {
            const state = localStorage.getItem('globalPlayerState');
            if (state) {
                const saved = JSON.parse(state);
                this.volume = saved.volume || 0.7;
                this.shuffle = saved.shuffle || false;
                this.repeat = saved.repeat || 'off';
                this.queue = saved.queue || [];
                this.queueIndex = saved.queueIndex || -1;
                this.history = saved.history || [];
                
                if (saved.currentTrack) {
                    this.loadTrack(saved.currentTrack, false);
                }
                
                this.audio.volume = this.volume;
                this.updateVolumeUI();
                this.updateShuffleUI();
                this.updateRepeatUI();
            }
        } catch (e) {
            console.error('Error loading player state:', e);
        }
    },
    
    saveState() {
        try {
            const state = {
                volume: this.volume,
                shuffle: this.shuffle,
                repeat: this.repeat,
                queue: this.queue,
                queueIndex: this.queueIndex,
                history: this.history,
                currentTrack: this.currentTrack
            };
            localStorage.setItem('globalPlayerState', JSON.stringify(state));
        } catch (e) {
            console.error('Error saving player state:', e);
        }
    },
    
    loadLikedSongs() {
        try {
            const liked = localStorage.getItem('ytm_likedSongs');
            this.likedSongs = liked ? JSON.parse(liked) : [];
        } catch (e) {
            this.likedSongs = [];
        }
    },
    
    // ========================================
    // Audio Events
    // ========================================
    setupAudioEvents() {
        if (!this.audio) return;
        
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('ended', () => this.onTrackEnded());
        this.audio.addEventListener('play', () => this.onPlay());
        this.audio.addEventListener('pause', () => this.onPause());
        this.audio.addEventListener('error', (e) => this.onError(e));
        this.audio.addEventListener('waiting', () => this.showBuffering(true));
        this.audio.addEventListener('canplay', () => this.showBuffering(false));
    },
    
    // ========================================
    // Progress Bar Events
    // ========================================
    setupProgressEvents() {
        const miniProgress = document.getElementById('playerMiniProgress');
        if (miniProgress) {
            miniProgress.addEventListener('click', (e) => this.seekTo(e));
        }
        
        const fullscreenProgress = document.getElementById('playerFullscreenProgressBar');
        if (fullscreenProgress) {
            fullscreenProgress.addEventListener('click', (e) => this.seekTo(e));
        }
    },
    
    // ========================================
    // Volume Events
    // ========================================
    setupVolumeEvents() {
        const miniVolume = document.getElementById('playerMiniVolume');
        if (miniVolume) {
            miniVolume.addEventListener('click', (e) => this.setVolume(e));
        }
        
        const fullscreenVolume = document.getElementById('playerFullscreenVolumeSlider');
        if (fullscreenVolume) {
            fullscreenVolume.addEventListener('click', (e) => this.setVolume(e));
        }
    },
    
    // ========================================
    // Play Button Click Tracking
    // ========================================
    setupPlayButtonTracking() {
        document.addEventListener('click', (e) => {
            const playBtn = e.target.closest('.slide-play-btn, .station-play-overlay, .sg-play-btn, .recent-play-btn, .hit-play-btn, .song-play-btn');
            if (playBtn) {
                this._activePlayElement = playBtn;
                const card = playBtn.closest('.station-card, .slide-card, .recent-item, .station-grid-card, .tamil-hit-card');
                if (card) {
                    const nameEl = card.querySelector('h3, h4');
                    if (nameEl) {
                        this._activePlayKey = nameEl.textContent.trim();
                    }
                }
                return;
            }
            
            const ytmItem = e.target.closest('.ytm-search-song-item, .ytm-playlist-track');
            if (ytmItem) {
                const nameEl = ytmItem.querySelector('.ytm-search-song-title, .ytm-playlist-track-title');
                if (nameEl) {
                    this._activePlayKey = nameEl.textContent.trim();
                }
                return;
            }
            
            const stationCard = e.target.closest('.station-card, .station-grid-card');
            if (stationCard) {
                const nameEl = stationCard.querySelector('h3, .sg-name');
                if (nameEl) {
                    this._activePlayKey = nameEl.textContent.trim();
                    this._activePlayElement = stationCard.querySelector('.station-play-overlay, .sg-play-btn') || stationCard;
                }
            }
        });
    },
    
    // ========================================
    // Keyboard Shortcuts
    // ========================================
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.next();
                    }
                    break;
                case 'ArrowLeft':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.previous();
                    }
                    break;
                case 'ArrowUp':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.setVolumeLevel(Math.min(1, this.volume + 0.1));
                    }
                    break;
                case 'ArrowDown':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.setVolumeLevel(Math.max(0, this.volume - 0.1));
                    }
                    break;
                case 'KeyM':
                    this.toggleMute();
                    break;
                case 'KeyS':
                    this.toggleShuffle();
                    break;
                case 'KeyR':
                    this.toggleRepeat();
                    break;
                case 'KeyL':
                    this.toggleLike();
                    break;
                case 'KeyQ':
                    this.toggleQueue();
                    break;
                case 'KeyF':
                    if (!e.ctrlKey && !e.metaKey) {
                        this.toggleFullscreen();
                    }
                    break;
                case 'Escape':
                    if (this.isFullscreen) {
                        this.toggleFullscreen();
                    }
                    if (this.isQueueOpen) {
                        this.toggleQueue();
                    }
                    break;
            }
        });
    },
    
    // ========================================
    // Playback Controls
    // ========================================
    play(track, playlist = []) {
        if (!track) {
            console.warn('GlobalPlayer: No track provided');
            return;
        }
        
        try {
            this.stopAllAudio();
            
            if (this.currentTrack && this.currentTrack.id !== track.id) {
                this.addToHistory(this.currentTrack);
            }
            
            this.loadTrack(track, true);
            
            if (playlist.length > 0) {
                this.queue = playlist;
                this.queueIndex = playlist.findIndex(t => t.id === track.id);
                if (this.queueIndex === -1) {
                    this.queueIndex = 0;
                }
            }
            
            this.playAudio();
            this.saveState();
            this.updateUI();
            this.renderQueue();
        } catch (error) {
            console.error('GlobalPlayer: Error playing track:', error);
            this.showToast('Error playing audio. Please try again.', 'error');
        }
    },
    
    // ========================================
    // Stop All Audio
    // ========================================
    stopAllAudio() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isPlaying = false;
            this.updatePlayPauseButton();
        }
        
        const allAudio = document.querySelectorAll('audio');
        allAudio.forEach(audio => {
            if (audio.id !== 'globalAudioPlayer') {
                audio.pause();
                audio.currentTime = 0;
                audio.src = '';
                audio.load();
            }
        });
        
        if (typeof audioPlayer !== 'undefined' && audioPlayer && audioPlayer !== this.audio) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioPlayer.src = '';
        }
        
        this.isPlaying = false;
        this.updatePlayPauseButton();
    },
    
    loadTrack(track, autoPlay = false) {
        if (!track) return;
        
        this.currentTrack = track;
        
        if (track.audioUrl) {
            this.audio.src = track.audioUrl;
            this.audio.load();
        }
        
        this.updateTrackInfo();
        this.updateLikeButton();
        
        if (autoPlay) {
            this.playAudio();
        }
    },
    
    playAudio() {
        if (!this.audio || !this.currentTrack) {
            console.warn('Cannot play: no audio element or current track');
            return;
        }
        
        // Ensure audio has a source
        if (!this.audio.src && this.currentTrack.audioUrl) {
            this.audio.src = this.currentTrack.audioUrl;
            this.audio.load();
        }
        
        // Try to play
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Playback started successfully');
                this.isPlaying = true;
                this.updatePlayPauseButton();
            }).catch(err => {
                console.error('Play error:', err);
                this.isPlaying = false;
                this.updatePlayPauseButton();
                this.showToast('Unable to play audio. Please try again.', 'error');
            });
        }
    },
    
    pause() {
        if (!this.audio) return;
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayPauseButton();
    },
    
    togglePlay() {
        if (!this.currentTrack) {
            this.showToast('No track selected', 'info');
            return;
        }
        
        if (this.isPlaying) {
            this.pause();
        } else {
            this.playAudio();
        }
    },
    
    next() {
        if (this.queue.length === 0) {
            this.showToast('No tracks in queue', 'info');
            return;
        }
        
        if (this.repeat === 'one') {
            this.audio.currentTime = 0;
            this.playAudio();
            return;
        }
        
        if (this.shuffle) {
            this.queueIndex = Math.floor(Math.random() * this.queue.length);
        } else {
            this.queueIndex = (this.queueIndex + 1) % this.queue.length;
        }
        
        const nextTrack = this.queue[this.queueIndex];
        if (nextTrack) {
            this.loadTrack(nextTrack, true);
            this.saveState();
            this.updateUI();
            this.renderQueue();
        }
    },
    
    previous() {
        if (this.queue.length === 0) {
            this.showToast('No tracks in queue', 'info');
            return;
        }
        
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        
        this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
        const prevTrack = this.queue[this.queueIndex];
        if (prevTrack) {
            this.loadTrack(prevTrack, true);
            this.saveState();
            this.updateUI();
            this.renderQueue();
        }
    },
    
    // ========================================
    // Progress & Seek
    // ========================================
    updateProgress() {
        if (!this.audio) return;
        
        const currentTime = this.audio.currentTime;
        const duration = this.audio.duration || 0;
        
        if (duration > 0) {
            const percent = (currentTime / duration) * 100;
            
            const miniFilled = document.getElementById('playerMiniProgressFilled');
            if (miniFilled) miniFilled.style.width = percent + '%';
            
            const miniCurrentTime = document.getElementById('playerMiniCurrentTime');
            if (miniCurrentTime) miniCurrentTime.textContent = this.formatTime(currentTime);
            
            const fullscreenFilled = document.getElementById('playerFullscreenProgressFilled');
            if (fullscreenFilled) fullscreenFilled.style.width = percent + '%';
            
            const fullscreenThumb = document.getElementById('playerFullscreenProgressThumb');
            if (fullscreenThumb) fullscreenThumb.style.left = percent + '%';
            
            const fullscreenCurrentTime = document.getElementById('playerFullscreenCurrentTime');
            if (fullscreenCurrentTime) fullscreenCurrentTime.textContent = this.formatTime(currentTime);
        }
    },
    
    updateDuration() {
        if (!this.audio) return;
        
        const duration = this.audio.duration || 0;
        
        const miniTotalTime = document.getElementById('playerMiniTotalTime');
        if (miniTotalTime) miniTotalTime.textContent = this.formatTime(duration);
        
        const fullscreenTotalTime = document.getElementById('playerFullscreenTotalTime');
        if (fullscreenTotalTime) fullscreenTotalTime.textContent = this.formatTime(duration);
    },
    
    seekTo(e) {
        if (!this.audio || !this.audio.duration) return;
        
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const time = percent * this.audio.duration;
        
        this.audio.currentTime = time;
        this.updateProgress();
    },
    
    // ========================================
    // Volume Control
    // ========================================
    setVolume(e) {
        if (!e.currentTarget) return;
        
        const slider = e.currentTarget;
        const rect = slider.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        
        this.setVolumeLevel(percent);
    },
    
    setVolumeLevel(level) {
        this.volume = Math.max(0, Math.min(1, level));
        this.isMuted = this.volume === 0;
        
        if (this.audio) {
            this.audio.volume = this.volume;
        }
        
        this.updateVolumeUI();
        this.saveState();
    },
    
    toggleMute() {
        if (this.isMuted) {
            this.isMuted = false;
            this.volume = this.previousVolume || 0.7;
        } else {
            this.previousVolume = this.volume;
            this.isMuted = true;
            this.volume = 0;
        }
        
        if (this.audio) {
            this.audio.volume = this.volume;
        }
        
        this.updateVolumeUI();
        this.saveState();
    },
    
    updateVolumeUI() {
        const percent = (this.isMuted ? 0 : this.volume) * 100;
        
        const miniFilled = document.getElementById('playerMiniVolumeFilled');
        if (miniFilled) miniFilled.style.width = percent + '%';
        
        const miniBtn = document.getElementById('playerMiniVolumeBtn');
        if (miniBtn) {
            const icon = miniBtn.querySelector('i');
            if (icon) {
                icon.className = this.isMuted || this.volume === 0 ? 'fas fa-volume-xmark' :
                                this.volume < 0.5 ? 'fas fa-volume-low' : 'fas fa-volume-high';
            }
        }
        
        const fullscreenFilled = document.getElementById('playerFullscreenVolumeFilled');
        if (fullscreenFilled) fullscreenFilled.style.width = percent + '%';
        
        const fullscreenBtn = document.getElementById('playerFullscreenVolumeBtn');
        if (fullscreenBtn) {
            const icon = fullscreenBtn.querySelector('i');
            if (icon) {
                icon.className = this.isMuted || this.volume === 0 ? 'fas fa-volume-xmark' :
                                this.volume < 0.5 ? 'fas fa-volume-low' : 'fas fa-volume-high';
            }
        }
    },
    
    // ========================================
    // Shuffle & Repeat
    // ========================================
    toggleShuffle() {
        this.shuffle = !this.shuffle;
        this.updateShuffleUI();
        this.saveState();
        this.showToast(this.shuffle ? 'Shuffle on' : 'Shuffle off', 'info');
    },
    
    toggleRepeat() {
        const modes = ['off', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeat);
        this.repeat = modes[(currentIndex + 1) % 3];
        this.updateRepeatUI();
        this.saveState();
        
        const messages = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };
        this.showToast(messages[this.repeat], 'info');
    },
    
    updateShuffleUI() {
        const miniBtn = document.getElementById('playerMiniShuffle');
        if (miniBtn) miniBtn.classList.toggle('active', this.shuffle);
        
        const fullscreenBtn = document.getElementById('playerFullscreenShuffle');
        if (fullscreenBtn) fullscreenBtn.classList.toggle('active', this.shuffle);
    },
    
    updateRepeatUI() {
        const miniBtn = document.getElementById('playerMiniRepeat');
        if (miniBtn) {
            miniBtn.classList.toggle('active', this.repeat !== 'off');
        }
        
        const fullscreenBtn = document.getElementById('playerFullscreenRepeat');
        if (fullscreenBtn) {
            fullscreenBtn.classList.toggle('active', this.repeat !== 'off');
        }
    },
    
    // ========================================
    // Like Button
    // ========================================
    toggleLike() {
        if (!this.currentTrack) return;
        
        const index = this.likedSongs.findIndex(s => s.id === this.currentTrack.id);
        
        if (index > -1) {
            this.likedSongs.splice(index, 1);
            this.showToast('Removed from Liked Songs', 'info');
        } else {
            this.likedSongs.push(this.currentTrack);
            this.showToast('Added to Liked Songs', 'success');
        }
        
        localStorage.setItem('ytm_likedSongs', JSON.stringify(this.likedSongs));
        this.updateLikeButton();
    },
    
    updateLikeButton() {
        if (!this.currentTrack) return;
        
        const isLiked = this.likedSongs.some(s => s.id === this.currentTrack.id);
        
        const fullscreenBtn = document.getElementById('playerFullscreenLikeBtn');
        if (fullscreenBtn) {
            fullscreenBtn.classList.toggle('active', isLiked);
            const icon = fullscreenBtn.querySelector('i');
            if (icon) {
                icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
            }
        }
    },
    
    // ========================================
    // Queue Management
    // ========================================
    toggleQueue() {
        this.isQueueOpen = !this.isQueueOpen;
        const panel = document.getElementById('playerQueuePanel');
        if (panel) {
            panel.classList.toggle('active', this.isQueueOpen);
        }
        
        if (this.isQueueOpen) {
            this.renderQueue();
        }
    },
    
    setQueueTab(tab) {
        this.queueTab = tab;
        
        document.querySelectorAll('.player-queue-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        this.renderQueue();
    },
    
    renderQueue() {
        const list = document.getElementById('playerQueueList');
        if (!list) return;
        
        const items = this.queueTab === 'queue' ? this.queue : this.history;
        
        if (items.length === 0) {
            list.innerHTML = `
                <div style="text-align:center;padding:40px 20px;color:rgba(255,255,255,0.4)">
                    <i class="fas fa-music" style="font-size:48px;margin-bottom:16px;opacity:0.5"></i>
                    <p>No ${this.queueTab === 'queue' ? 'tracks in queue' : 'play history'}</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = items.map((track, index) => {
            const isPlaying = this.queueTab === 'queue' && index === this.queueIndex;
            return `
                <div class="player-queue-item ${isPlaying ? 'playing' : ''}" 
                     onclick="GlobalPlayer.playFromQueue(${index})">
                    <div class="player-queue-item-thumb">
                        <img src="${track.thumbnail || track.cover || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%231a3b2e"/%3E%3C/svg%3E'}" alt="">
                    </div>
                    <div class="player-queue-item-info">
                        <div class="player-queue-item-title">${track.title || track.name || 'Unknown'}</div>
                        <div class="player-queue-item-artist">${track.artist || ''}</div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    playFromQueue(index) {
        if (index < 0 || index >= this.queue.length) return;
        
        this.queueIndex = index;
        const track = this.queue[index];
        this.loadTrack(track, true);
        this.saveState();
        this.updateUI();
        this.renderQueue();
    },
    
    addToQueue(track) {
        this.queue.push(track);
        this.saveState();
        this.renderQueue();
        this.showToast('Added to queue', 'success');
    },
    
    // ========================================
    // History
    // ========================================
    addToHistory(track) {
        if (!track) return;
        
        this.history = this.history.filter(h => h.id !== track.id);
        this.history.unshift({
            ...track,
            playedAt: new Date().toISOString()
        });
        
        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }
        
        this.saveState();
    },
    
    // ========================================
    // Fullscreen Player
    // ========================================
    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        const fullscreen = document.getElementById('playerFullscreen');
        if (fullscreen) {
            fullscreen.style.display = this.isFullscreen ? 'flex' : 'none';
        }
        
        document.body.style.overflow = this.isFullscreen ? 'hidden' : '';
    },
    
    // ========================================
    // UI Updates
    // ========================================
    updateUI() {
        this.updateTrackInfo();
        this.updatePlayPauseButton();
        this.updateLikeButton();
        this.updateProgress();
        this.updateDuration();
    },
    
    updateTrackInfo() {
        if (!this.currentTrack) return;
        
        const track = this.currentTrack;
        
        const miniTitle = document.getElementById('playerMiniTitle');
        if (miniTitle) miniTitle.textContent = track.title || track.name || 'Unknown';
        
        const miniArtist = document.getElementById('playerMiniArtist');
        if (miniArtist) miniArtist.textContent = track.artist || '';
        
        const miniThumb = document.getElementById('playerMiniThumbImg');
        if (miniThumb) {
            miniThumb.src = track.thumbnail || track.cover || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Crect width="48" height="48" fill="%231a3b2e"/%3E%3Ccircle cx="24" cy="24" r="16" fill="%2334d399" opacity="0.3"/%3E%3C/svg%3E';
        }
        
        const fullscreenTitle = document.getElementById('playerFullscreenTitle');
        if (fullscreenTitle) fullscreenTitle.textContent = track.title || track.name || 'Unknown';
        
        const fullscreenArtist = document.getElementById('playerFullscreenArtist');
        if (fullscreenArtist) fullscreenArtist.textContent = track.artist || '';
        
        const fullscreenArtwork = document.getElementById('playerFullscreenArtworkImg');
        const fullscreenPlaceholder = document.getElementById('playerFullscreenArtworkPlaceholder');
        
        if (track.thumbnail || track.cover) {
            if (fullscreenArtwork) {
                fullscreenArtwork.src = track.thumbnail || track.cover;
                fullscreenArtwork.style.display = 'block';
            }
            if (fullscreenPlaceholder) fullscreenPlaceholder.style.display = 'none';
        } else {
            if (fullscreenArtwork) fullscreenArtwork.style.display = 'none';
            if (fullscreenPlaceholder) fullscreenPlaceholder.style.display = 'flex';
        }
    },
    
    updatePlayPauseButton() {
        const icon = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
        
        const miniBtn = document.getElementById('playerMiniPlayBtn');
        if (miniBtn) {
            const miniIcon = miniBtn.querySelector('i');
            if (miniIcon) miniIcon.className = icon;
        }
        
        const fullscreenBtn = document.getElementById('playerFullscreenPlayBtn');
        if (fullscreenBtn) {
            const fullscreenIcon = fullscreenBtn.querySelector('i');
            if (fullscreenIcon) fullscreenIcon.className = icon;
        }
    },
    
    // ========================================
    // Audio Event Handlers
    // ========================================
    onPlay() {
        this.isPlaying = true;
        this.updatePlayPauseButton();
        this.updateAllPlayingIndicators();
    },
    
    onPause() {
        this.isPlaying = false;
        this.updatePlayPauseButton();
        this.updateAllPlayingIndicators();
    },
    
    onTrackEnded() {
        if (this.repeat === 'one') {
            this.audio.currentTime = 0;
            this.playAudio();
        } else if (this.repeat === 'all' || this.queueIndex < this.queue.length - 1) {
            this.next();
        } else {
            this.isPlaying = false;
            this.updatePlayPauseButton();
            this.updateAllPlayingIndicators();
        }
    },
    
    onError(e) {
        console.error('Audio error:', e);
        this.isPlaying = false;
        this.updatePlayPauseButton();
        this.showToast('Error playing audio. The stream may be unavailable.', 'error');
    },
    
    showBuffering(show) {
        // Buffering indicator can be added here
    },
    
    // ========================================
    // Equalizer Animation Management
    // ========================================
    createEqualizerHTML() {
        return `
            <div class="equalizer-animation ${this.isPlaying ? '' : 'paused'}">
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
            </div>
        `;
    },
    
    updateAllPlayingIndicators() {
        if (!this.currentTrack) return;
        
        const trackName = this.currentTrack.title || this.currentTrack.name || '';
        const allPlayBtns = document.querySelectorAll('.slide-play-btn, .station-play-overlay, .sg-play-btn, .recent-play-btn, .hit-play-btn, .song-play-btn');
        const allCards = document.querySelectorAll('.slide-card, .station-card, .station-grid-card, .tamil-hit-card, .recent-item, .song-card');
        const barsHTML = '<span class="now-playing-bars"><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span></span>';
        
        // Clear all equalizers
        allPlayBtns.forEach(btn => {
            if (btn.querySelector('.equalizer-animation')) {
                btn.innerHTML = '<i class="fas fa-play"></i>';
                btn.classList.remove('playing');
            }
        });
        
        // Clear all now-playing indicators
        document.querySelectorAll('.now-playing-bars').forEach(el => el.remove());
        allCards.forEach(card => card.classList.remove('now-playing'));
        
        // Add indicator to current track
        if (this._activePlayKey && this._activePlayKey === trackName) {
            let targetBtn = this._activePlayElement;
            
            if (!targetBtn || !document.contains(targetBtn)) {
                for (const btn of allPlayBtns) {
                    const card = btn.closest('.station-card, .slide-card, .recent-item, .station-grid-card, .tamil-hit-card');
                    if (card) {
                        const nameEl = card.querySelector('h3, h4, .sg-name');
                        if (nameEl && nameEl.textContent.trim() === this._activePlayKey) {
                            targetBtn = btn;
                            this._activePlayElement = btn;
                            break;
                        }
                    }
                }
            }
            
            if (targetBtn && document.contains(targetBtn)) {
                if (this.isPlaying) {
                    targetBtn.innerHTML = this.createEqualizerHTML();
                    targetBtn.classList.add('playing');
                }
                
                const card = targetBtn.closest('.slide-card, .station-card, .station-grid-card, .tamil-hit-card, .recent-item, .song-card');
                if (card) {
                    card.classList.add('now-playing');
                    const titleEl = card.querySelector('h3, h4, .sg-name, .song-title');
                    if (titleEl && !titleEl.querySelector('.now-playing-bars')) {
                        titleEl.insertAdjacentHTML('beforeend', barsHTML);
                    }
                }
            }
        }
    },
    
    // ========================================
    // Utility Functions
    // ========================================
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    },
    
    // ========================================
    // Public API
    // ========================================
    playTrack(track, playlist = []) {
        this.play(track, playlist);
    },
    
    getCurrentTrack() {
        return this.currentTrack;
    },
    
    getQueue() {
        return this.queue;
    },
    
    getHistory() {
        return this.history;
    },
    
    isCurrentlyPlaying() {
        return this.isPlaying;
    }
};

// ============================================
// Initialize Global Player
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    GlobalPlayer.init();
    window.GlobalPlayer = GlobalPlayer;
    
    // Route all playback through GlobalPlayer
    window.playSong = function(song, playlist = []) {
        if (song) {
            GlobalPlayer.play(song, playlist);
        }
    };
    
    window.playStation = function(stationName) {
        if (!stationName) return;
        const stations = DataStore.getStations();
        const station = stations.find(s => s.name === stationName);
        if (station) {
            GlobalPlayer.play({
                id: station.id,
                title: station.name,
                artist: station.freq + ' • ' + station.genre,
                thumbnail: station.thumbnail || '',
                audioUrl: station.streamUrl
            }, stations.filter(s => s.status === 'active'));
        }
    };
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlobalPlayer;
}