'use strict';

/* ============================================
   Mini Audio Player Popup Modal
   AI-Powered Popup Style Mini Player
   Appears when clicking any FM station or song
   ============================================ */

const MiniAudioPlayer = (() => {
    let popupEl = null;
    let isOpen = false;
    let isExpanded = false;
    let isDraggingSeek = false;
    let isDraggingPopup = false;
    let isAIActive = false;
    let autoTimer = null;
    let stationInterval = null;
    let currentPlayback = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let popupStartX = 0;
    let popupStartY = 0;

    /* ============================================
       Create the Popup Modal
       ============================================ */
    function createPopup() {
        if (document.getElementById('miniAudioPopup')) return;

        const el = document.createElement('div');
        el.id = 'miniAudioPopup';
        el.className = 'mini-audio-popup';
        el.innerHTML = `
            <div class="map-header">
                <div class="map-header-left">
                    <div class="map-ai-badge" id="mapAiBadge" title="AI Automation">
                        <i class="fas fa-robot"></i>
                        <span class="map-ai-pulse"></span>
                    </div>
                    <div class="map-header-title">
                        <span class="map-header-label">Now Playing</span>
                        <span class="map-live-badge" id="mapLiveBadge" style="display:none;">
                            <span class="map-live-dot"></span> LIVE
                        </span>
                        <span class="map-ai-label" id="mapAiLabel" style="display:none;">
                            <i class="fas fa-sparkles"></i> AI Auto-DJ
                        </span>
                    </div>
                </div>
                <div class="map-header-actions">
                    <button class="map-icon-btn" id="mapMinimizeBtn" title="Minimize">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="map-icon-btn" id="mapCloseBtn" title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div class="map-body" id="mapBody">
                <!-- Artwork & Info -->
                <div class="map-art-row">
                    <div class="map-artwork" id="mapArtwork">
                        <div class="map-artwork-img" id="mapArtworkImg"></div>
                        <div class="map-artwork-glow"></div>
                        <div class="map-eq" id="mapEqBars">
                            <span></span><span></span><span></span><span></span>
                        </div>
                    </div>
                    <div class="map-info">
                        <div class="map-track-name" id="mapTrackName">Select a station</div>
                        <div class="map-track-artist" id="mapTrackArtist">Tamil AI Stream</div>
                        <div class="map-track-meta" id="mapTrackMeta"></div>
                        <div class="map-track-tags" id="mapTrackTags"></div>
                    </div>
                </div>

                <!-- Progress -->
                <div class="map-progress-row">
                    <span class="map-time" id="mapCurrentTime">0:00</span>
                    <div class="map-progress" id="mapProgressWrap">
                        <div class="map-progress-buffered" id="mapProgressBuffered"></div>
                        <div class="map-progress-filled" id="mapProgressFilled"></div>
                        <div class="map-progress-thumb" id="mapProgressThumb"></div>
                    </div>
                    <span class="map-time" id="mapDuration">0:00</span>
                </div>

                <!-- Controls -->
                <div class="map-controls">
                    <button class="map-ctrl-btn" id="mapShuffleBtn" title="Shuffle">
                        <i class="fas fa-shuffle"></i>
                    </button>
                    <button class="map-ctrl-btn" id="mapPrevBtn" title="Previous">
                        <i class="fas fa-backward-step"></i>
                    </button>
                    <button class="map-play-btn" id="mapPlayBtn" title="Play/Pause">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="map-ctrl-btn" id="mapNextBtn" title="Next">
                        <i class="fas fa-forward-step"></i>
                    </button>
                    <button class="map-ctrl-btn" id="mapRepeatBtn" title="Repeat">
                        <i class="fas fa-repeat"></i>
                    </button>
                </div>

                <!-- Secondary Controls -->
                <div class="map-secondary">
                    <button class="map-s-btn" id="mapAiToggle" title="AI Auto-DJ">
                        <i class="fas fa-robot"></i>
                        <span>AI</span>
                    </button>
                    <button class="map-s-btn" id="mapFavBtn" title="Favorite">
                        <i class="far fa-heart"></i>
                    </button>
                    <button class="map-s-btn" id="mapQueueBtn" title="Queue">
                        <i class="fas fa-bars-staggered"></i>
                    </button>
                    <button class="map-s-btn" id="mapShareBtn" title="Share">
                        <i class="fas fa-share-nodes"></i>
                    </button>
                    <div class="map-volume-wrap">
                        <button class="map-s-btn" id="mapVolumeBtn" title="Volume">
                            <i class="fas fa-volume-high"></i>
                        </button>
                        <input type="range" class="map-volume-slider" id="mapVolumeRange" min="0" max="100" value="70">
                    </div>
                </div>

                <!-- AI Recommendation Panel -->
                <div class="map-ai-panel" id="mapAiPanel" style="display:none;">
                    <div class="map-ai-panel-title">
                        <i class="fas fa-sparkles"></i>
                        AI Recommended For You
                    </div>
                    <div class="map-ai-suggestions" id="mapAiSuggestions"></div>
                </div>
            </div>

            <!-- Collapsed Mode (minimized) -->
            <div class="map-collapsed" id="mapCollapsed" style="display:none;">
                <div class="map-collapsed-art" id="mapCollapsedArt"></div>
                <div class="map-collapsed-info">
                    <div class="map-collapsed-title" id="mapCollapsedTitle">No track</div>
                    <div class="map-collapsed-artist" id="mapCollapsedArtist"></div>
                </div>
                <button class="map-collapsed-play" id="mapCollapsedPlay">
                    <i class="fas fa-play"></i>
                </button>
                <button class="map-collapsed-expand" id="mapCollapsedExpand" title="Expand">
                    <i class="fas fa-chevron-up"></i>
                </button>
            </div>
        `;

        document.body.appendChild(el);
        popupEl = el;
        bindEvents();
        updateAIBadge(false);
    }

    /* ============================================
       Bind All Button Events
       ============================================ */
    function bindEvents() {
        // Header buttons
        document.getElementById('mapCloseBtn')?.addEventListener('click', closePopup);
        document.getElementById('mapMinimizeBtn')?.addEventListener('click', toggleCollapse);
        document.getElementById('mapCollapsedExpand')?.addEventListener('click', toggleCollapse);
        document.getElementById('mapCollapsedPlay')?.addEventListener('click', () => {
            togglePlayPause();
        });

        // Drag functionality on header
        const header = popupEl?.querySelector('.map-header');
        if (header) {
            header.style.cursor = 'grab';
            header.addEventListener('mousedown', onDragStart);
            header.addEventListener('touchstart', onDragStart, { passive: false });
            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('mouseup', onDragEnd);
            document.addEventListener('touchmove', onDragMove, { passive: false });
            document.addEventListener('touchend', onDragEnd);
        }

        // Restore saved position
        restorePosition();

        // Main Play/Pause
        document.getElementById('mapPlayBtn')?.addEventListener('click', () => {
            togglePlayPause();
        });

        // Next / Previous
        document.getElementById('mapNextBtn')?.addEventListener('click', () => {
            if (isAIActive) {
                showAISuggestion(true);
            } else {
                playNextTrack();
            }
        });
        document.getElementById('mapPrevBtn')?.addEventListener('click', () => {
            playPreviousTrack();
        });

        // Shuffle
        document.getElementById('mapShuffleBtn')?.addEventListener('click', () => {
            if (typeof playbackShuffle !== 'undefined') {
                playbackShuffle = !playbackShuffle;
                updateShuffleBtn(playbackShuffle);
                showToast(playbackShuffle ? '🔀 Shuffle on' : 'Shuffle off', 'info');
            } else if (typeof PlayerEngine !== 'undefined') {
                PlayerEngine.toggleShuffle();
                updateShuffleBtn(PlayerEngine.shuffle);
            }
        });

        // Repeat
        document.getElementById('mapRepeatBtn')?.addEventListener('click', () => {
            if (typeof playbackRepeat !== 'undefined') {
                const modes = ['off', 'all', 'one'];
                playbackRepeat = modes[(modes.indexOf(playbackRepeat) + 1) % 3];
                updateRepeatBtn(playbackRepeat);
                showToast(playbackRepeat === 'off' ? 'Repeat off' : playbackRepeat === 'all' ? '🔁 Repeat all' : '🔂 Repeat one', 'info');
            } else if (typeof PlayerEngine !== 'undefined') {
                PlayerEngine.cycleRepeat();
                updateRepeatBtn(PlayerEngine.repeat);
            }
        });

        // AI Automation Toggle
        document.getElementById('mapAiToggle')?.addEventListener('click', toggleAIAutomation);
        document.getElementById('mapAiBadge')?.addEventListener('click', toggleAIAutomation);

        // Favorite
        document.getElementById('mapFavBtn')?.addEventListener('click', () => {
            if (!currentPlayback) return;
            const track = currentPlayback.track || currentPlayback;
            const wasFav = isFavorite(track);
            if (typeof PlaylistManager !== 'undefined' && typeof PlaylistManager.toggleFavorite === 'function') {
                PlaylistManager.toggleFavorite(track);
            }
            if (typeof PlayerEngine !== 'undefined' && typeof PlayerEngine.toggleFavorite === 'function') {
                PlayerEngine.toggleFavorite(track);
            }
            updateFavBtn(!wasFav);
            showToast(wasFav ? 'Removed from favorites' : '❤️ Added to favorites', wasFav ? 'info' : 'success');
        });

        // Queue
        document.getElementById('mapQueueBtn')?.addEventListener('click', () => {
            if (typeof YTMusic !== 'undefined' && typeof YTMusic.toggleQueuePanel === 'function') {
                YTMusic.toggleQueuePanel();
            } else if (typeof PlayerUI !== 'undefined' && typeof PlayerUI.toggleQueuePanel === 'function') {
                PlayerUI.toggleQueuePanel();
            }
        });

        // Share
        document.getElementById('mapShareBtn')?.addEventListener('click', () => {
            if (!currentPlayback) return;
            const track = currentPlayback.track || currentPlayback;
            const text = `Listening to ${track.title || track.name} on Tamil AI Stream 🎵`;
            if (navigator.share) {
                navigator.share({ title: track.title || track.name, text });
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(text);
                showToast('Link copied to clipboard!', 'success');
            }
        });

        // Volume
        document.getElementById('mapVolumeBtn')?.addEventListener('click', () => {
            if (typeof audioPlayer !== 'undefined' && audioPlayer) {
                const vol = audioPlayer.volume > 0.5 ? 0 : 0.7;
                audioPlayer.volume = vol;
                if (typeof playbackVolume !== 'undefined') playbackVolume = vol;
                const range = document.getElementById('mapVolumeRange');
                if (range) range.value = vol * 100;
                updateVolumeBtn(vol);
            }
        });
        document.getElementById('mapVolumeRange')?.addEventListener('input', (e) => {
            const vol = e.target.value / 100;
            if (typeof audioPlayer !== 'undefined' && audioPlayer) audioPlayer.volume = vol;
            if (typeof playbackVolume !== 'undefined') playbackVolume = vol;
            updateVolumeBtn(vol);
        });

        // Progress Seek
        const progressWrap = document.getElementById('mapProgressWrap');
        if (progressWrap) {
            const seek = (e) => {
                const rect = progressWrap.getBoundingClientRect();
                if (!rect || rect.width <= 0) return;
                const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                if (typeof audioPlayer !== 'undefined' && audioPlayer) {
                    const dur = audioPlayer.duration;
                    if (dur && isFinite(dur) && dur > 0) {
                        audioPlayer.currentTime = pct * dur;
                    }
                } else if (typeof PlayerEngine !== 'undefined') {
                    PlayerEngine.seekToPercent(pct);
                }
                updateProgressUI();
            };
            progressWrap.addEventListener('mousedown', (e) => { isDraggingSeek = true; seek(e); e.preventDefault(); });
            document.addEventListener('mousemove', (e) => { if (isDraggingSeek) seek(e); });
            document.addEventListener('mouseup', () => { isDraggingSeek = false; });
            progressWrap.addEventListener('touchstart', (e) => { isDraggingSeek = true; seek(e.touches[0]); }, { passive: true });
            progressWrap.addEventListener('touchmove', (e) => { if (isDraggingSeek) { e.preventDefault(); seek(e.touches[0]); } }, { passive: false });
            document.addEventListener('touchend', () => { isDraggingSeek = false; });
        }

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (!isOpen) return;
            if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
            if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) { playNextTrack(); }
            if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) { playPreviousTrack(); }
            if (e.key.toLowerCase() === 'm') { toggleMute(); }
        });
    }

    /* ============================================
       AI Automation
       ============================================ */
    function toggleAIAutomation() {
        isAIActive = !isAIActive;

        if (typeof PlayerEngine !== 'undefined' && typeof PlayerEngine.toggleAIAutomation === 'function') {
            PlayerEngine.toggleAIAutomation();
        }

        updateAIBadge(isAIActive);

        if (isAIActive) {
            const panel = document.getElementById('mapAiPanel');
            if (panel) panel.style.display = 'block';
            showAISuggestion(false);

            autoTimer = setInterval(() => {
                if (isAIActive) {
                    const st = typeof currentStation !== 'undefined' ? currentStation : currentPlayback?.title;
                    if (st) autoRecommendNextStation(st);
                }
            }, 45000);

            startStationSimulation();
            showToast('🤖 AI Auto-DJ activated - smart recommendations enabled', 'success');
        } else {
            const panel = document.getElementById('mapAiPanel');
            if (panel) panel.style.display = 'none';
            clearInterval(autoTimer);
            clearInterval(stationInterval);
            stationInterval = null;
            showToast('AI Auto-DJ disabled', 'info');
        }
    }

    function updateAIBadge(active) {
        const badge = document.getElementById('mapAiBadge');
        const label = document.getElementById('mapAiLabel');
        const toggleBtn = document.getElementById('mapAiToggle');

        if (badge) {
            badge.classList.toggle('active', active);
            badge.innerHTML = active
                ? '<i class="fas fa-robot"></i><span class="map-ai-pulse"></span>'
                : '<i class="fas fa-robot"></i>';
        }
        if (label) label.style.display = active ? 'inline-flex' : 'none';
        if (toggleBtn) toggleBtn.classList.toggle('active', active);
    }

    function showAISuggestion(autoPlay = false) {
        const container = document.getElementById('mapAiSuggestions');
        if (!container) return;

        const recommendations = getRecommendations();
        if (!recommendations.length) {
            container.innerHTML = '<div class="map-ai-empty">No recommendations available</div>';
            return;
        }

        container.innerHTML = recommendations.slice(0, 3).map((rec, i) => {
            const isStation = !!rec.streamUrl && !rec.audioUrl;
            const thumb = rec.thumbnail || rec.cover || '';
            const title = rec.title || rec.name || 'Unknown';
            const artist = rec.artist || rec.subtitle || rec.genre || (isStation ? 'FM Station' : 'Tamil AI Stream');
            return `
                <div class="map-ai-suggestion" data-name="${title}" data-type="${isStation ? 'station' : 'song'}">
                    <div class="map-ai-sug-num">${i + 1}</div>
                    <div class="map-ai-sug-thumb" ${thumb ? `style="background-image:url('${thumb}')"` : ''}>
                        ${!thumb ? '<i class="fas fa-' + (isStation ? 'radio' : 'music') + '"></i>' : ''}
                    </div>
                    <div class="map-ai-sug-info">
                        <div class="map-ai-sug-title">${title}</div>
                        <div class="map-ai-sug-artist">${artist}</div>
                    </div>
                    <button class="map-ai-sug-play" data-title="${title}">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.map-ai-sug-play').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                playRecommended(btn.dataset.title);
            });
        });

        container.querySelectorAll('.map-ai-suggestion').forEach(row => {
            row.addEventListener('click', () => {
                playRecommended(row.dataset.name);
            });
        });

        if (autoPlay && recommendations.length > 0) {
            const next = recommendations[0];
            if (next.streamUrl && !next.audioUrl) {
                playStation(next.title || next.name);
            } else {
                playSong(next, recommendations);
            }
        }
    }

    function getRecommendations() {
        const recs = [];
        try {
            const stations = typeof DataStore !== 'undefined' ? DataStore.getStations().filter(s => s.status === 'active') : [];
            const songs = typeof DataStore !== 'undefined' ? DataStore.getSongs().filter(s => s.status === 'published' || s.status === 'active') : [];

            const currentTitle = typeof currentStation !== 'undefined' ? currentStation : (currentPlayback?.title || '');
            const currentGenre = currentPlayback?.genre || '';

            stations.forEach(st => {
                if (st.name !== currentTitle) {
                    recs.push({
                        streamUrl: st.streamUrl,
                        audioUrl: null,
                        title: st.name,
                        name: st.name,
                        artist: st.freq + ' • ' + st.genre,
                        subtitle: st.freq + ' • ' + st.genre,
                        genre: st.genre,
                        thumbnail: st.thumbnail || '',
                        gradient: st.gradient || ''
                    });
                }
            });
            songs.forEach(sg => {
                if (sg.title !== currentTitle) {
                    recs.push({
                        audioUrl: sg.audioUrl,
                        streamUrl: null,
                        title: sg.title,
                        name: sg.title,
                        artist: sg.artist || 'Tamil AI Stream',
                        subtitle: sg.artist || '',
                        genre: sg.genre || '',
                        thumbnail: sg.albumCover || sg.cover || '',
                        movie: sg.movie || ''
                    });
                }
            });

            if (currentGenre) {
                recs.sort((a, b) => {
                    const aMatch = a.genre === currentGenre ? 1 : 0;
                    const bMatch = b.genre === currentGenre ? 1 : 0;
                    return bMatch - aMatch;
                });
            }

            const matched = recs.filter(r => r.genre === currentGenre);
            const others = recs.filter(r => r.genre !== currentGenre);
            const shuffled = [...others].sort(() => Math.random() - 0.5);
            return [...matched, ...shuffled].slice(0, 10);
        } catch (e) {
            console.warn('AI recommendations error:', e);
            return recs;
        }
    }

    function autoRecommendNextStation(currentName) {
        const recs = getRecommendations();
        const stations = recs.filter(r => r.streamUrl);
        if (stations.length > 0) {
            const next = stations[Math.floor(Math.random() * Math.min(3, stations.length))];
            playStation(next.title || next.name);
            showToast(`🤖 AI Auto-DJ: Now playing ${next.title || next.name}`, 'success');
            syncWithPlayback(next);
        }
    }

    function playRecommended(title) {
        const stations = typeof DataStore !== 'undefined' ? DataStore.getStations() : [];
        const station = stations.find(s => s.name === title);
        if (station) {
            playStation(station.name);
            syncWithPlayback(station);
            return;
        }
        const songs = typeof DataStore !== 'undefined' ? DataStore.getSongs() : [];
        const song = songs.find(s => s.title === title);
        if (song && song.audioUrl) {
            playSong(song, [song]);
            syncWithPlayback(song);
        } else {
            showToast('Stream not available', 'error');
        }
    }

    /* ============================================
       Station Live Simulation
       ============================================ */
    function startStationSimulation() {
        clearInterval(stationInterval);
        if (!isAIActive) return;
        stationInterval = setInterval(() => {
            const liveBadge = document.getElementById('mapLiveBadge');
            if (liveBadge) liveBadge.style.display = 'inline-flex';
        }, 1000);
    }

    /* ============================================
       UI Sync Methods
       ============================================ */
    function syncWithPlayback(track) {
        if (!track) return;
        currentPlayback = {
            track: track,
            title: track.title || track.name,
            artist: track.artist || track.subtitle || track.freq || 'Tamil AI Stream',
            meta: track.freq ? `${track.freq} • ${track.city || ''}` : (track.movie || ''),
            genre: track.genre || '',
            thumbnail: track.thumbnail || track.cover || track.albumCover || '',
            isStation: !!track.streamUrl && !track.audioUrl
        };

        const titleEl = document.getElementById('mapTrackName');
        const artistEl = document.getElementById('mapTrackArtist');
        const metaEl = document.getElementById('mapTrackMeta');
        const tagsEl = document.getElementById('mapTrackTags');

        if (titleEl) titleEl.textContent = currentPlayback.title;
        if (artistEl) artistEl.textContent = currentPlayback.artist;
        if (metaEl) metaEl.textContent = currentPlayback.meta;
        if (tagsEl) {
            tagsEl.innerHTML = currentPlayback.genre
                ? `<span class="map-tag"><i class="fas fa-tag"></i> ${currentPlayback.genre}</span>`
                : '';
        }

        const artImg = document.getElementById('mapArtworkImg');
        if (artImg) {
            if (currentPlayback.thumbnail) {
                artImg.style.backgroundImage = `url('${currentPlayback.thumbnail}')`;
                artImg.style.backgroundSize = 'cover';
                artImg.style.backgroundPosition = 'center';
            } else {
                artImg.style.backgroundImage = '';
                artImg.style.background = track.gradient || 'linear-gradient(135deg, #0f3b2e, #064e3b)';
            }
        }

        const clTitle = document.getElementById('mapCollapsedTitle');
        const clArtist = document.getElementById('mapCollapsedArtist');
        const clArt = document.getElementById('mapCollapsedArt');
        if (clTitle) clTitle.textContent = currentPlayback.title;
        if (clArtist) clArtist.textContent = currentPlayback.artist;
        if (clArt) {
            if (currentPlayback.thumbnail) {
                clArt.style.backgroundImage = `url('${currentPlayback.thumbnail}')`;
                clArt.innerHTML = '';
            } else {
                clArt.style.backgroundImage = '';
                clArt.style.background = track.gradient || 'linear-gradient(135deg, #0f3b2e, #064e3b)';
                clArt.innerHTML = currentPlayback.isStation ? '<i class="fas fa-radio"></i>' : '<i class="fas fa-music"></i>';
            }
        }

        const liveBadge = document.getElementById('mapLiveBadge');
        if (liveBadge) liveBadge.style.display = currentPlayback.isStation ? 'inline-flex' : 'none';

        if (isAIActive) showAISuggestion(false);
        updateFavBtn(isFavorite(currentPlayback.track));
    }

    function updateProgressUI() {
        if (!isOpen) return;
        let current = 0;
        let duration = 0;

        if (typeof audioPlayer !== 'undefined' && audioPlayer) {
            current = audioPlayer.currentTime || 0;
            duration = audioPlayer.duration || 0;
        } else if (typeof PlayerEngine !== 'undefined') {
            current = PlayerEngine.currentTime;
            duration = PlayerEngine.duration;
        }

        const isStation = currentPlayback?.isStation;
        const progressWrap = document.getElementById('mapProgressWrap');
        if (isStation && (duration === Infinity || isNaN(duration))) {
            const curEl = document.getElementById('mapCurrentTime');
            const durEl = document.getElementById('mapDuration');
            if (curEl) curEl.textContent = 'LIVE';
            if (durEl) durEl.textContent = '∞';
            if (progressWrap) progressWrap.classList.add('map-live-progress');
            return;
        }

        if (progressWrap) progressWrap.classList.remove('map-live-progress');

        const pct = duration > 0 ? (current / duration) * 100 : 0;
        const curEl = document.getElementById('mapCurrentTime');
        const durEl = document.getElementById('mapDuration');
        if (curEl) curEl.textContent = formatTime(current);
        if (durEl) durEl.textContent = formatTime(duration);

        if (!isDraggingSeek) {
            const filled = document.getElementById('mapProgressFilled');
            const thumb = document.getElementById('mapProgressThumb');
            if (filled) filled.style.width = pct + '%';
            if (thumb) thumb.style.left = pct + '%';
        }
    }

    function syncPlayingUI() {
        const playBtn = document.getElementById('mapPlayBtn');
        const collapsedPlay = document.getElementById('mapCollapsedPlay');
        const eq = document.getElementById('mapEqBars');

        if (playBtn) {
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            playBtn.classList.add('playing');
        }
        if (collapsedPlay) collapsedPlay.innerHTML = '<i class="fas fa-pause"></i>';
        if (eq) eq.classList.add('playing');
        updateEqBars(true);
    }

    function syncPausedUI() {
        const playBtn = document.getElementById('mapPlayBtn');
        const collapsedPlay = document.getElementById('mapCollapsedPlay');
        const eq = document.getElementById('mapEqBars');

        if (playBtn) {
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.classList.remove('playing');
        }
        if (collapsedPlay) collapsedPlay.innerHTML = '<i class="fas fa-play"></i>';
        if (eq) eq.classList.remove('playing');
        updateEqBars(false);
    }

    function updateEqBars(playing) {
        const bars = document.querySelectorAll('#mapEqBars span');
        bars.forEach(bar => {
            if (playing) {
                bar.style.animationPlayState = 'running';
            } else {
                bar.style.animationPlayState = 'paused';
                bar.style.height = '3px';
            }
        });
    }

    function updateShuffleBtn(shuffle) {
        const btn = document.getElementById('mapShuffleBtn');
        if (btn) btn.classList.toggle('active', shuffle);
    }

    function updateRepeatBtn(repeat) {
        const btn = document.getElementById('mapRepeatBtn');
        if (!btn) return;
        btn.classList.toggle('active', repeat !== 'off');
        btn.innerHTML = repeat === 'one'
            ? '<i class="fas fa-repeat"></i><span class="map-repeat-1">1</span>'
            : '<i class="fas fa-repeat"></i>';
    }

    function updateFavBtn(isFav) {
        const btn = document.getElementById('mapFavBtn');
        if (btn) {
            btn.innerHTML = isFav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
            btn.classList.toggle('active', isFav);
        }
    }

    function updateVolumeBtn(vol) {
        const btn = document.getElementById('mapVolumeBtn');
        if (!btn) return;
        btn.innerHTML = vol === 0
            ? '<i class="fas fa-volume-xmark"></i>'
            : vol < 0.5
                ? '<i class="fas fa-volume-low"></i>'
                : '<i class="fas fa-volume-high"></i>';
    }

    function isFavorite(track) {
        const id = track?.id || track?.name || track?.title;
        if (!id) return false;
        if (typeof PlaylistManager !== 'undefined' && typeof PlaylistManager.isFavorite === 'function') {
            return PlaylistManager.isFavorite(track);
        }
        if (typeof PlayerEngine !== 'undefined' && typeof PlayerEngine.isFavorite === 'function') {
            return PlayerEngine.isFavorite(track);
        }
        return false;
    }

    /* ============================================
       Play / Pause / Next / Prev helpers
       ============================================ */
    function togglePlayPause() {
        // Check actual audio state first
        const audioPlaying = typeof audioPlayer !== 'undefined' && audioPlayer && !audioPlayer.paused;
        const enginePlaying = typeof PlayerEngine !== 'undefined' && PlayerEngine.isPlaying;
        const wasPlaying = audioPlaying || enginePlaying;

        if (wasPlaying) {
            // Pause: use the appropriate pause function
            if (typeof window.pausePlayback === 'function') {
                window.pausePlayback();
            } else if (typeof window.pauseStation === 'function') {
                window.pauseStation();
            } else if (typeof PlayerEngine !== 'undefined' && typeof PlayerEngine.pause === 'function') {
                PlayerEngine.pause();
            }
            syncPausedUI();
        } else {
            // Resume: use the appropriate resume function
            if (typeof window.resumePlayback === 'function') {
                window.resumePlayback();
            } else if (typeof window.togglePlayPause === 'function' && window.togglePlayPause !== togglePlayPause) {
                window.togglePlayPause();
            } else if (typeof PlayerEngine !== 'undefined' && typeof PlayerEngine.play === 'function') {
                PlayerEngine.play();
            }
            syncPlayingUI();
        }

        // Re-sync after a short delay to catch async state changes
        setTimeout(() => {
            const nowPlaying = (typeof audioPlayer !== 'undefined' && audioPlayer && !audioPlayer.paused) ||
                               (typeof PlayerEngine !== 'undefined' && PlayerEngine.isPlaying);
            if (nowPlaying) syncPlayingUI(); else syncPausedUI();
        }, 500);
    }

    function playNextTrack() {
        if (isAIActive) {
            showAISuggestion(true);
            return;
        }
        if (typeof window.playNextTrack === 'function' && window.playNextTrack !== playNextTrack) {
            window.playNextTrack();
        } else if (typeof playNextSong === 'function') {
            playNextSong();
        } else if (typeof PlayerEngine !== 'undefined' && typeof PlayerEngine.playNext === 'function') {
            PlayerEngine.playNext();
        } else {
            showAISuggestion(true);
        }
    }

    function playPreviousTrack() {
        if (typeof window.playPreviousTrack === 'function' && window.playPreviousTrack !== playPreviousTrack) {
            window.playPreviousTrack();
        } else if (typeof playPreviousSong === 'function') {
            playPreviousSong();
        } else if (typeof PlayerEngine !== 'undefined' && typeof PlayerEngine.playPrevious === 'function') {
            PlayerEngine.playPrevious();
        }
    }

    function toggleMute() {
        const a = typeof audioPlayer !== 'undefined' ? audioPlayer : null;
        if (a) {
            const vol = a.volume > 0.5 ? 0 : 0.7;
            a.volume = vol;
            if (typeof playbackVolume !== 'undefined') playbackVolume = vol;
            const range = document.getElementById('mapVolumeRange');
            if (range) range.value = vol * 100;
            updateVolumeBtn(vol);
        }
    }

    /* ============================================
       Drag Functionality
       ============================================ */
    function onDragStart(e) {
        if (!popupEl) return;
        isDraggingPopup = true;
        const touch = e.touches ? e.touches[0] : e;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        const rect = popupEl.getBoundingClientRect();
        popupStartX = rect.left;
        popupStartY = rect.top;
        popupEl.style.transition = 'none';
        popupEl.style.cursor = 'grabbing';
        if (e.preventDefault) e.preventDefault();
    }

    function onDragMove(e) {
        if (!isDraggingPopup || !popupEl) return;
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;
        let newX = popupStartX + dx;
        let newY = popupStartY + dy;
        const result = clampToViewport(newX, newY);
        popupEl.style.left = result.x + 'px';
        popupEl.style.top = result.y + 'px';
        popupEl.style.right = 'auto';
        popupEl.style.bottom = 'auto';
        if (e.preventDefault) e.preventDefault();
    }

    function onDragEnd() {
        if (!isDraggingPopup) return;
        isDraggingPopup = false;
        if (popupEl) {
            popupEl.style.transition = '';
            popupEl.style.cursor = '';
        }
        savePosition();
    }

    function clampToViewport(x, y) {
        const rect = popupEl ? popupEl.getBoundingClientRect() : { width: 320, height: 400 };
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const minVisible = 60;
        const maxX = vw - minVisible;
        const maxY = vh - minVisible;
        const minX = -(rect.width - minVisible);
        const minY = 0;
        return {
            x: Math.max(minX, Math.min(maxX, x)),
            y: Math.max(minY, Math.min(maxY, y))
        };
    }

    function savePosition() {
        if (!popupEl) return;
        const rect = popupEl.getBoundingClientRect();
        try {
            localStorage.setItem('miniAudioPlayerPos', JSON.stringify({
                x: rect.left,
                y: rect.top
            }));
        } catch (e) {}
    }

    function restorePosition() {
        if (!popupEl) return;
        try {
            const saved = JSON.parse(localStorage.getItem('miniAudioPlayerPos'));
            if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                const result = clampToViewport(saved.x, saved.y);
                popupEl.style.left = result.x + 'px';
                popupEl.style.top = result.y + 'px';
                popupEl.style.right = 'auto';
                popupEl.style.bottom = 'auto';
            }
        } catch (e) {}
    }

    /* ============================================
       Collapse / Expand / Open / Close
       ============================================ */
    function toggleCollapse() {
        isExpanded = !isExpanded;
        const body = document.getElementById('mapBody');
        const collapsed = document.getElementById('mapCollapsed');
        const minimizeBtn = document.getElementById('mapMinimizeBtn');

        if (body) body.style.display = isExpanded ? 'none' : 'block';
        if (collapsed) collapsed.style.display = isExpanded ? 'flex' : 'none';
        if (minimizeBtn) {
            minimizeBtn.innerHTML = isExpanded
                ? '<i class="fas fa-chevron-up"></i>'
                : '<i class="fas fa-minus"></i>';
            minimizeBtn.title = isExpanded ? 'Expand' : 'Minimize';
        }
        if (popupEl) popupEl.classList.toggle('collapsed', isExpanded);
    }

    function openPopup(track, meta = {}) {
        createPopup();
        if (!popupEl) return;

        isOpen = true;
        popupEl.classList.add('open');

        syncWithPlayback(track || meta);

        const range = document.getElementById('mapVolumeRange');
        if (range && typeof audioPlayer !== 'undefined' && audioPlayer) {
            range.value = audioPlayer.volume * 100;
            updateVolumeBtn(audioPlayer.volume);
        } else if (range && typeof playbackVolume !== 'undefined') {
            range.value = playbackVolume * 100;
            updateVolumeBtn(playbackVolume);
        }

        const isPlaying = typeof isStreamPlaying !== 'undefined' ? isStreamPlaying : (typeof PlayerEngine !== 'undefined' && PlayerEngine.isPlaying);
        if (isPlaying) syncPlayingUI(); else syncPausedUI();

        if (typeof playbackShuffle !== 'undefined') updateShuffleBtn(playbackShuffle);
        if (typeof playbackRepeat !== 'undefined') updateRepeatBtn(playbackRepeat);
        if (typeof PlayerEngine !== 'undefined') {
            updateShuffleBtn(PlayerEngine.shuffle);
            updateRepeatBtn(PlayerEngine.repeat);
        }

        updateAIBadge(isAIActive);
        updateProgressUI();

        if (isAIActive) {
            const panel = document.getElementById('mapAiPanel');
            if (panel) panel.style.display = 'block';
            showAISuggestion(false);
        }
    }

    function closePopup() {
        if (!popupEl) return;
        isOpen = false;
        popupEl.classList.remove('open');

        clearInterval(autoTimer);
        clearInterval(stationInterval);
        stationInterval = null;

        const panel = document.getElementById('mapAiPanel');
        if (panel) panel.style.display = 'none';
    }

    /* ============================================
       Hook into playStation / playSong
       ============================================ */
    function onPlaybackStart(track, meta = {}) {
        openPopup(track, meta);
    }

    /* ============================================
       Init - Monkey patch playStation/playSong
       ============================================ */
    function init() {
        createPopup();

        // Patch playStation to open popup
        if (typeof window.playStation === 'function') {
            const origPlayStation = window.playStation;
            window.playStation = function(stationName) {
                const station = typeof DataStore !== 'undefined'
                    ? DataStore.getStations().find(s => s.name === stationName)
                    : null;
                if (station) onPlaybackStart(station, { isStation: true });
                return origPlayStation(stationName);
            };
        }

        // Patch playSong to open popup
        if (typeof window.playSong === 'function') {
            const origPlaySong = window.playSong;
            window.playSong = function(song, playlist = []) {
                if (song) {
                    onPlaybackStart({
                        ...song,
                        title: song.title || song.name,
                        artist: song.artist || 'Tamil AI Stream',
                        thumbnail: song.albumCover || song.cover || '',
                        isStation: false
                    }, {});
                }
                return origPlaySong(song, playlist);
            };
        }

        // Hook into PlayerEngine track changes
        if (typeof PlayerEngine !== 'undefined') {
            if (typeof PlayerEngine.on === 'function') {
                PlayerEngine.on('trackChange', (state) => {
                    if (state.currentTrack) {
                        onPlaybackStart({
                            ...state.currentTrack,
                            title: state.currentTrack.title || state.currentTrack.name,
                            artist: state.currentTrack.artist || 'Tamil AI Stream',
                            isStation: !!state.currentTrack.streamUrl
                        }, {});
                    }
                });
                PlayerEngine.on('play', () => syncPlayingUI());
                PlayerEngine.on('pause', () => syncPausedUI());
                PlayerEngine.on('aiAutomation', (enabled) => {
                    isAIActive = enabled;
                    updateAIBadge(enabled);
                    const panel = document.getElementById('mapAiPanel');
                    if (panel) {
                        panel.style.display = enabled ? 'block' : 'none';
                        if (enabled) showAISuggestion(false);
                    }
                });
            }
        }

        // Watch for audioPlayer global changes (script.js creates it dynamically)
        let audioWatch = setInterval(() => {
            if (typeof audioPlayer !== 'undefined' && audioPlayer) {
                if (!audioPlayer._mapHooked) {
                    audioPlayer._mapHooked = true;
                    audioPlayer.addEventListener('timeupdate', updateProgressUI);
                    audioPlayer.addEventListener('play', syncPlayingUI);
                    audioPlayer.addEventListener('pause', syncPausedUI);
                }
            }
        }, 2000);

        setTimeout(() => clearInterval(audioWatch), 30000);
    }

    function formatTime(sec) {
        if (!sec || isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    return {
        init,
        openPopup,
        closePopup,
        toggleAIAutomation,
        syncPlayingUI,
        syncPausedUI,
        updateProgressUI,
        get isOpen() { return isOpen; },
        get isAIActive() { return isAIActive; }
    };
})();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MiniAudioPlayer.init());
} else {
    MiniAudioPlayer.init();
}