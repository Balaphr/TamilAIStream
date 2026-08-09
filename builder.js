'use strict';

// Website Builder - localStorage-based

// ============================================
// Global State
// ============================================
let currentUser = null;
let currentSongId = null;
let uploadedAlbumUrl = null;
let uploadedAudioUrl = null;
let websiteSections = [];
let previewCount = 0;
let uploadedImages = [];
let currentPreviewImage = null;
let publishState = 'draft';
let publishHistory = [];

// ============================================
// Authentication System
// ============================================
const ADMIN_CREDENTIALS = {
    username: 'admin@tamilaistream.com',
    password: 'Admin@123'
};

const BUILDER_USERS_KEY = 'tamilAIStream_builderUsers';

function getBuilderUsers() {
    try {
        return JSON.parse(localStorage.getItem(BUILDER_USERS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveBuilderUsers(users) {
    localStorage.setItem(BUILDER_USERS_KEY, JSON.stringify(users));
}

function checkAuth() {
    return new Promise((resolve) => {
        const session = localStorage.getItem('adminSession');
        if (session) {
            try {
                const data = JSON.parse(session);
                if (data.expiry > Date.now()) {
                    resolve(data);
                } else {
                    localStorage.removeItem('adminSession');
                    checkWebsiteAuth(resolve);
                }
            } catch (e) {
                localStorage.removeItem('adminSession');
                checkWebsiteAuth(resolve);
            }
        } else {
            checkWebsiteAuth(resolve);
        }
    });
}

function checkWebsiteAuth(resolve) {
    // Also check for admin login from the main website login page
    const storedUser = localStorage.getItem('tamilAIStream_user');
    const loggedIn = localStorage.getItem('tamilAIStream_loggedIn');
    
    if (loggedIn === 'true' && storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            const isAdmin = userData.email === ADMIN_CREDENTIALS.username ||
                           userData.email === 'admin@tamilaistream.com';
            
            if (isAdmin) {
                // Auto-create adminSession for builder access
                const sessionData = {
                    username: userData.email,
                    email: userData.email,
                    displayName: userData.name || 'Admin',
                    role: 'admin',
                    loginTime: Date.now(),
                    expiry: Date.now() + (24 * 60 * 60 * 1000)
                };
                localStorage.setItem('adminSession', JSON.stringify(sessionData));
                resolve(sessionData);
            } else {
                resolve(null);
            }
        } catch (e) {
            resolve(null);
        }
    } else {
        resolve(null);
    }
}


function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('builderDashboard').style.display = 'none';
}

function showBuilderDashboard(user) {
    currentUser = user;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('builderDashboard').style.display = 'block';
    
    // Update user info in nav
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    const initial = displayName.charAt(0).toUpperCase();
    document.getElementById('builderUserName').textContent = displayName;
    document.getElementById('builderUserAvatar').textContent = initial;
    
    // Initialize builder
    initBuilder();
}

// Sign In
async function signInWithEmail(email, password) {
    try {
        const users = getBuilderUsers();
        const user = users.find(u => u.email === email && u.password === password);
        
        if (!user) {
            // Check if it's the admin demo credentials
            if (email === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
                const demoUser = {
                    username: ADMIN_CREDENTIALS.username,
                    email: ADMIN_CREDENTIALS.username,
                    displayName: 'Admin',
                    role: 'admin',
                    password: ADMIN_CREDENTIALS.password
                };
                localStorage.setItem('adminSession', JSON.stringify({
                    username: ADMIN_CREDENTIALS.username,
                    email: ADMIN_CREDENTIALS.username,
                    displayName: 'Admin',
                    role: 'admin',
                    loginTime: Date.now(),
                    expiry: Date.now() + (24 * 60 * 60 * 1000)
                }));
                showToast('Welcome Admin!', 'success');
                showBuilderDashboard(demoUser);
                return;
            }
            showToast('Invalid email or password', 'error');
            return;
        }
        
        localStorage.setItem('adminSession', JSON.stringify({
            username: user.email,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            loginTime: Date.now(),
            expiry: Date.now() + (24 * 60 * 60 * 1000)
        }));
        showToast(`Welcome ${user.displayName}!`, 'success');
        showBuilderDashboard(user);
    } catch (error) {
        console.error('Sign in error:', error);
        showToast('Authentication failed. Please try again', 'error');
    }
}

// Sign Up/Registration
async function signUpWithEmail(name, email, password) {
    const nameTrimmed = name.trim();
    const emailTrimmed = email.trim();
    
    if (!nameTrimmed || !emailTrimmed || !password) {
        showToast('Please fill in all fields', 'error');
        return false;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return false;
    }
    
    const users = getBuilderUsers();
    if (users.find(u => u.email === emailTrimmed)) {
        showToast('Email already registered', 'error');
        return false;
    }
    
    const newUser = {
        displayName: nameTrimmed,
        email: emailTrimmed,
        password: password,
        role: 'user'
    };
    
    users.push(newUser);
    saveBuilderUsers(users);
    
    showToast('Registration successful! Please login.', 'success');
    return true;
}

// Sign In with Google - Disabled
async function signInWithGoogle() {
    showToast('Google sign-in is disabled', 'error');
}

// Sign In as Guest - Disabled
async function signInAsGuest() {
    showToast('Guest access is disabled. Please login or register.', 'error');
}

// Sign Out
async function signOut() {
    try {
        Auth.clearAll();
        currentUser = null;
        showLoginScreen();
        showToast('Signed out successfully', 'success');
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('Error signing out', 'error');
    }
}

// Get user-friendly auth error messages
function getAuthErrorMessage(code) {
    return 'Authentication failed. Please try again';
}

// ============================================
// Login Screen Event Listeners
// ============================================
function setupLoginScreen() {
    // Tab switching
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const tabName = this.dataset.tab;
            document.getElementById('signinForm').style.display = tabName === 'signin' ? 'block' : 'none';
            document.getElementById('signupForm').style.display = tabName === 'signup' ? 'block' : 'none';
        });
    });
    
    // Sign In form
    document.getElementById('signinForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signinEmail').value;
        const password = document.getElementById('signinPassword').value;
        await signInWithEmail(email, password);
    });
    
    // Sign Up form
    document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirm').value;
        
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        
        const success = await signUpWithEmail(name, email, password);
        if (success) {
            // Switch to sign in tab
            document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.login-tab[data-tab="signin"]').classList.add('active');
            document.getElementById('signinForm').style.display = 'block';
            document.getElementById('signupForm').style.display = 'none';
            // Pre-fill email
            document.getElementById('signinEmail').value = email;
        }
    });
    
    // Google Sign In - Disabled
    document.getElementById('googleSignIn')?.addEventListener('click', signInWithGoogle);
    
    // Guest Sign In - Disabled
    document.getElementById('guestSignIn')?.addEventListener('click', signInAsGuest);
    
    // Switch to sign up tab
    document.getElementById('signupTab')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.login-tab[data-tab="signup"]').classList.add('active');
        document.getElementById('signinForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    });
    
    // Switch to sign in tab
    document.getElementById('signinTab')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.login-tab[data-tab="signin"]').classList.add('active');
        document.getElementById('signinForm').style.display = 'block';
        document.getElementById('signupForm').style.display = 'none';
    });
}

// ============================================
// Navigation
// ============================================
function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.builder-page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.builder-sidebar-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.builder-nav-item').forEach(i => i.classList.remove('active'));

    // Show selected page
    const pageMap = {
        'dashboard': 'dashboardPage',
        'stations': 'stationsPage',
        'songs': 'songsPage',
        'content': 'contentPage',
        'images': 'imagesPage',
        'settings': 'settingsPage',
        'moods': 'moodsPage',
        'airadio': 'airadioPage',
        'notifications': 'notificationsPage',
        'splash': 'splashPage',
        'player': 'playerPage',
        'navigation': 'navigationPage',
        'sections': 'sectionsPage',
        'visualeditor': 'visualeditorPage',
        'miniplayersettings': 'miniplayersettingsPage',
        'preview': 'previewPage'
    };

    const pageId = pageMap[page];
    if (pageId) {
        document.getElementById(pageId).style.display = 'block';
    }

    // Update active states
    document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));

    // Load page data
    if (page === 'dashboard') loadDashboardStats();
    if (page === 'stations') loadAllStations();
    if (page === 'songs') loadAllSongs();
    if (page === 'content') {
        loadFeatured();
        loadTrending();
        loadCategories();
        loadArtistHits();
        loadQuotes();
    }
    if (page === 'images') loadAllImages();
    if (page === 'settings') loadSettings();
    if (page === 'moods') loadMoods();
    if (page === 'airadio') loadAIRadio();
    if (page === 'notifications') loadNotifications();
    if (page === 'splash') loadSplashSettings();
    if (page === 'player') loadPlayerPrefs();
    if (page === 'navigation') loadNavigation();
    if (page === 'sections') loadSectionsOrder();
    if (page === 'visualeditor') initVisualEditor();
    if (page === 'miniplayersettings') loadMiniPlayerSettings();
    if (page === 'preview') updatePreview();
}

// ============================================
// Dashboard Stats
// ============================================
async function loadDashboardStats() {
    try {
        const songs = DataStore.getSongs();
        const images = DataStore.getImages();
        const stations = DataStore.getStations();
        const categories = DataStore.getCategories();
        const featured = DataStore.getFeatured();
        
        document.getElementById('totalSongs').textContent = songs.length;
        document.getElementById('totalImages').textContent = images.length;
        document.getElementById('totalSections').textContent = stations.length;
        document.getElementById('totalViews').textContent = previewCount;
        
        const lastSaved = localStorage.getItem('builderLastSaved');
        if (lastSaved) {
            const date = new Date(parseInt(lastSaved));
            const lastSavedEl = document.getElementById('lastSaved');
            if (lastSavedEl) lastSavedEl.textContent = date.toLocaleTimeString();
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// ============================================
// Song Management
// ============================================
async function loadAllSongs() {
    try {
        const songs = DataStore.getSongs();
        songs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        previewSongList = songs;
        
        const tableBody = document.getElementById('allSongsTable');
        tableBody.innerHTML = songs.map(song => createSongRow(song)).join('');
    } catch (error) {
        console.error('Error loading songs:', error);
        showToast('Error loading songs', 'error');
    }
}

function createSongRow(song) {
    return `
        <tr>
            <td>
                <div class="song-thumb">
                    <img src="${song.albumCover || 'data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 80 80\"%3E%3Ccircle cx=\"40\" cy=\"40\" r=\"30\" fill=\"%2334d399\" opacity=\"0.3\"/%3E%3C/svg%3E'}" alt="${song.title}">
                </div>
            </td>
            <td>
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-meta">${song.language || 'Tamil'}</div>
                </div>
            </td>
            <td>${song.artist || 'N/A'}</td>
            <td>${song.movie || 'N/A'}</td>
            <td>${song.duration || 'N/A'}</td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="editSong('${song.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="previewSong('${song.id}')" title="Preview">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteSong('${song.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

async function saveSong(e) {
    e.preventDefault();
    
    const title = document.getElementById('songTitle').value.trim();
    const artist = document.getElementById('songArtist').value.trim();
    const movie = document.getElementById('songMovie').value.trim();
    
    if (!title || !artist || !movie) {
        showToast('Please fill in Title, Artist, and Movie', 'error');
        return;
    }
    
    const songData = {
        title: title,
        artist: artist,
        movie: movie,
        director: document.getElementById('songDirector').value.trim(),
        singer: document.getElementById('songSinger').value.trim(),
        language: document.getElementById('songLanguage').value,
        genre: document.getElementById('songGenre').value,
        duration: document.getElementById('songDuration').value.trim(),
        description: document.getElementById('songDescription').value.trim(),
        status: 'published',
                        updatedAt: new Date().toISOString(),
        createdBy: currentUser?.uid || 'unknown'
    };

    try {
        AIUploadOverlay.update(2, 'Preparing', 'Starting upload…');
        showToast('Saving song...', 'info');

        const albumFile = document.getElementById('albumImage').files[0];
        if (albumFile) {
            AIUploadOverlay.update(3, 'Album cover', 'Uploading album cover…');
            try {
                const albumResult = await R2Uploader.uploadImage(albumFile, 'tamil-ai-stream/albums', (pct) => {
                    AIUploadOverlay.update(3 + pct * 0.3, 'Album cover', 'Uploading album cover… ' + pct + '%');
                });
                songData.albumCover = albumResult.url;
                songData.albumPublicId = albumResult.publicId;
            } catch (err) {
                console.warn('Album upload failed:', err);
                showToast('Album cover upload failed: ' + err.message, 'error');
                AIUploadOverlay.hide();
            }
        }

        const audioFile = document.getElementById('audioFile').files[0];
        if (audioFile) {
            AIUploadOverlay.update(35, 'Audio', 'Checking audio file…');
            try {
                const audioResult = await R2Uploader.uploadAudio(audioFile, 'tamil-ai-stream/audio', (pct) => {
                    AIUploadOverlay.update(35 + pct * 0.6, 'Audio', 'Uploading audio… ' + pct + '%');
                });
                songData.audioUrl = audioResult.url;
                songData.audioPublicId = audioResult.publicId;
                songData.audioFormat = audioResult.format;
                songData.audioSize = audioResult.bytes;
                songData.audioFileName = audioFile.name;
            } catch (err) {
                console.error('Audio upload error:', err);
                AIUploadOverlay.error('Audio upload failed: ' + err.message);
                showToast('Audio upload failed: ' + err.message, 'error');
                return;
            }
        }

        AIUploadOverlay.update(97, 'Publishing', 'Saving to live website…');
        showToast('Saving to database...', 'info');

        const songs = DataStore.getSongs();

        if (currentSongId) {
            const idx = songs.findIndex(s => s.id === currentSongId);
            if (idx !== -1) {
                songs[idx] = { ...songs[idx], ...songData };
            }
        } else {
            songData.id = 'song_' + Date.now();
            songData.createdAt = new Date().toISOString();
            songData.plays = 0;
            songs.push(songData);
        }

        DataStore.setSongs(songs);

        AIUploadOverlay.success('Song published to Tamil AI Stream!');
        showToast('Song saved successfully!', 'success');
        resetSongForm();
        loadAllSongs();
        syncToLiveWebsite();
        addActivity('Song Added', 'Added "' + songData.title + '"');
    } catch (error) {
        console.error('Error saving song:', error);
        AIUploadOverlay.error('Error: ' + error.message);
        showToast('Error: ' + error.message, 'error');
    }
}

async function editSong(songId) {
    try {
        const songs = DataStore.getSongs();
        const song = songs.find(s => s.id === songId);
        if (song) {
            currentSongId = songId;
            
            document.getElementById('songTitle').value = song.title || '';
            document.getElementById('songArtist').value = song.artist || '';
            document.getElementById('songMovie').value = song.movie || '';
            document.getElementById('songDirector').value = song.director || '';
            document.getElementById('songSinger').value = song.singer || '';
            document.getElementById('songLanguage').value = song.language || 'Tamil';
            document.getElementById('songGenre').value = song.genre || 'Love';
            document.getElementById('songDuration').value = song.duration || '';
            document.getElementById('songDescription').value = song.description || '';

            if (song.albumCover) {
                document.getElementById('albumPreviewImg').src = song.albumCover;
                document.getElementById('albumPreview').style.display = 'flex';
            }

            showToast('Song loaded for editing', 'info');
            navigateTo('songs');
        }
    } catch (error) {
        console.error('Error loading song:', error);
        showToast('Error loading song', 'error');
    }
}

async function deleteSong(songId) {
    if (!confirm('Are you sure you want to delete this song?')) return;
    
    try {
        const songs = DataStore.getSongs();
        const filtered = songs.filter(s => s.id !== songId);
        DataStore.setSongs(filtered);
        showToast('Song deleted successfully!', 'success');
        loadAllSongs();
        syncToLiveWebsite();
        addActivity('Song Deleted', 'Removed a song from the library');
    } catch (error) {
        console.error('Error deleting song:', error);
        showToast('Error deleting song', 'error');
    }
}

let previewAudioEl = null;
let previewPlaying = false;
let previewSongList = [];
let previewCurrentIdx = -1;

async function previewSong(songId) {
    try {
        const songs = DataStore.getSongs();
        const song = songs.find(s => s.id === songId);
        if (!song) {
            showToast('Song not found', 'error');
            return;
        }
        
        let audioSrc = song.audioUrl;
        
        if (!audioSrc) {
            showToast('No audio file for this song', 'error');
            return;
        }
        
        console.log('Attempting to play:', audioSrc);
        
        const playerEl = document.getElementById('previewPlayer');
        const playBtn = document.getElementById('previewPlayPause');
        
        document.getElementById('previewTitle').textContent = song.title || 'Untitled';
        document.getElementById('previewArtist').textContent = (song.artist || '') + ' • ' + (song.movie || '');
        document.getElementById('previewThumb').style.backgroundImage = song.albumCover ? 'url(' + song.albumCover + ')' : '';
        
        playerEl.style.display = 'flex';
        
        previewCurrentIdx = previewSongList.findIndex(s => s.id === songId);
        if (previewCurrentIdx === -1) previewCurrentIdx = 0;
        
        const audio = document.getElementById('previewAudio');
        if (!audio) {
            showToast('Audio player not found', 'error');
            return;
        }
        
        audio.pause();
        audio.src = audioSrc;
        audio.volume = 1.0;
        
        setupPreviewPlayer();
        
        try {
            await audio.play();
            previewPlaying = true;
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            showToast('Playing: ' + song.title, 'success');
        } catch (err) {
            console.error('Play error:', err);
            showToast('Click the play button to start playback', 'info');
        }
    } catch (error) {
        console.error('Error previewing song:', error);
        showToast('Error: ' + (error.message || 'Could not play audio'), 'error');
    }
}

function setupPreviewPlayer() {
    const audio = document.getElementById('previewAudio');
    const playBtn = document.getElementById('previewPlayPause');
    const prevBtn = document.getElementById('previewPrev');
    const nextBtn = document.getElementById('previewNext');
    const closeBtn = document.getElementById('previewClose');
    const progressBar = document.getElementById('previewProgressBar');
    const volumeBar = document.getElementById('previewVolumeBar');

    window.togglePreviewPlayPause = async function() {
        if (!audio || !audio.src || audio.src === location.href) return;
        if (!audio.paused) {
            audio.pause();
            previewPlaying = false;
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
        } else {
            try {
                const p = audio.play();
                if (p) await p;
                previewPlaying = true;
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } catch (err) {
                console.error('Resume error:', err);
                showToast('Could not resume playback', 'error');
            }
        }
    };

    if (playBtn) {
        playBtn.onclick = window.togglePreviewPlayPause;
    }

    prevBtn?.addEventListener('click', async () => {
        if (previewSongList.length === 0) return;
        previewCurrentIdx = (previewCurrentIdx - 1 + previewSongList.length) % previewSongList.length;
        await previewSong(previewSongList[previewCurrentIdx].id);
    });

    nextBtn?.addEventListener('click', async () => {
        if (previewSongList.length === 0) return;
        previewCurrentIdx = (previewCurrentIdx + 1) % previewSongList.length;
        await previewSong(previewSongList[previewCurrentIdx].id);
    });

    closeBtn?.addEventListener('click', () => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        previewPlaying = false;
        document.getElementById('previewPlayer').style.display = 'none';
    });

    audio?.addEventListener('timeupdate', () => {
        if (audio.duration) {
            progressBar.value = (audio.currentTime / audio.duration) * 100;
            document.getElementById('previewCurrentTime').textContent = formatTime(audio.currentTime);
            document.getElementById('previewDuration').textContent = formatTime(audio.duration);
        }
    });

    progressBar?.addEventListener('input', () => {
        if (audio.duration) {
            audio.currentTime = (progressBar.value / 100) * audio.duration;
        }
    });

    audio?.addEventListener('ended', async () => {
        previewPlaying = false;
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        if (previewSongList.length > 0) {
            previewCurrentIdx = (previewCurrentIdx + 1) % previewSongList.length;
            await previewSong(previewSongList[previewCurrentIdx].id);
        }
    });

    volumeBar?.addEventListener('input', () => {
        audio.volume = volumeBar.value / 100;
    });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function resetSongForm() {
    document.getElementById('songForm').reset();
    currentSongId = null;
    uploadedAlbumUrl = null;
    uploadedAudioUrl = null;
    document.getElementById('albumPreview').style.display = 'none';
    document.getElementById('audioPreview').style.display = 'none';
}

// ============================================
// Quick Add Song Modal
// ============================================
function openAddSongModal() {
    document.getElementById('addSongModal').style.display = 'flex';
}

function closeAddSongModal() {
    document.getElementById('addSongModal').style.display = 'none';
    document.getElementById('quickSongForm').reset();
}

async function saveQuickSong(e) {
    e.preventDefault();
    
    const songData = {
        id: 'song_' + Date.now(),
        title: document.getElementById('quickSongTitle').value,
        artist: document.getElementById('quickSongArtist').value,
        movie: document.getElementById('quickSongMovie').value,
        audioUrl: document.getElementById('quickSongAudioUrl').value,
        albumCover: document.getElementById('quickSongCoverUrl').value || '',
        status: 'published',
        createdAt: new Date().toISOString(),
        plays: 0,
        language: 'Tamil',
        genre: 'Love',
        createdBy: currentUser?.uid || 'unknown'
    };

    try {
        showToast('Adding song...', 'info');
        const songs = DataStore.getSongs();
        songs.push(songData);
        DataStore.setSongs(songs);
        showToast('Song added successfully!', 'success');
        closeAddSongModal();
        loadAllSongs();
        syncToLiveWebsite();
        addActivity('Quick Add', 'Added "' + songData.title + '" via quick add');
    } catch (error) {
        console.error('Error adding song:', error);
        showToast('Error adding song: ' + error.message, 'error');
    }
}

// ============================================
// Image Management
// ============================================
function openUploadImageModal() {
    document.getElementById('uploadImageModal').style.display = 'flex';
}

function closeUploadImageModal() {
    document.getElementById('uploadImageModal').style.display = 'none';
    document.getElementById('uploadImageForm').reset();
    document.getElementById('modalImagePreview').style.display = 'none';
}

async function loadAllImages() {
    try {
        const images = DataStore.getImages();
        images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        uploadedImages = images;
        
        renderImageGallery(uploadedImages);
        document.getElementById('totalImages').textContent = uploadedImages.length;
    } catch (error) {
        console.error('Error loading images:', error);
        showToast('Error loading images', 'error');
    }
}

function renderImageGallery(images) {
    const gallery = document.getElementById('imageGallery');
    const emptyState = document.getElementById('galleryEmpty');
    
    if (images.length === 0) {
        gallery.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    gallery.innerHTML = images.map(img => createImageCard(img)).join('');
}

function createImageCard(img) {
    const categoryColors = {
        'album': '#34d399',
        'banner': '#60a5fa',
        'artist': '#f472b6',
        'other': '#a78bfa'
    };
    const color = categoryColors[img.category] || '#34d399';
    
    return `
        <div class="image-card" data-id="${img.id}">
            <div class="image-card-thumb" onclick="openImagePreview('${img.id}')">
                <img src="${img.url}" alt="${img.title || 'Image'}" loading="lazy">
                <div class="image-card-overlay">
                    <i class="fas fa-expand"></i>
                </div>
            </div>
            <div class="image-card-info">
                <div class="image-card-title">${img.title || 'Untitled'}</div>
                <div class="image-card-meta">
                    <span class="image-category-badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">
                        ${img.category || 'other'}
                    </span>
                    <span class="image-card-size">${img.size || '-'}</span>
                </div>
            </div>
            <div class="image-card-actions">
                <button class="action-btn" onclick="copyImageLink('${img.id}')" title="Copy URL">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn delete" onclick="deleteImage('${img.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

async function uploadImage(file, category, title) {
    try {
        showToast('Uploading image to R2...', 'info');
        
        const folderMap = {
            'album': 'tamil-ai-stream/albums',
            'banner': 'tamil-ai-stream/banners',
            'artist': 'tamil-ai-stream/artists',
            'other': 'tamil-ai-stream/images'
        };
        
        const result = await R2Uploader.uploadImage(file, folderMap[category] || 'tamil-ai-stream/images', (pct) => {
            showToast('Uploading: ' + pct + '%', 'info');
        });
        
        const imageData = {
            id: 'img_' + Date.now(),
            url: result.url,
            publicId: result.publicId,
            title: title || file.name,
            category: category || 'other',
            format: result.format,
            width: result.width,
            height: result.height,
            fileName: file.name,
            size: formatFileSize(file.size),
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.uid || 'unknown'
        };
        
        const images = DataStore.getImages();
        images.push(imageData);
        DataStore.setImages(images);
        
        showToast('Image uploaded successfully!', 'success');
        addActivity('Image Uploaded', 'Uploaded "' + (title || file.name) + '"');
        loadAllImages();
        syncToLiveWebsite();
        
    } catch (error) {
        console.error('Error uploading image:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteImage(imageId) {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    try {
        const images = DataStore.getImages();
        const imgData = images.find(i => i.id === imageId);
        const filtered = images.filter(i => i.id !== imageId);
        DataStore.setImages(filtered);
        
        showToast('Image deleted successfully!', 'success');
        syncToLiveWebsite();
        if (imgData) {
            addActivity('Image Deleted', 'Deleted "' + imgData.title + '"');
        }
        loadAllImages();
    } catch (error) {
        console.error('Error deleting image:', error);
        showToast('Error deleting image', 'error');
    }
}

function openImagePreview(imageId) {
    const img = uploadedImages.find(i => i.id === imageId);
    if (!img) return;
    
    currentPreviewImage = img;
    
    document.getElementById('previewImageTitle').textContent = img.title || 'Image Preview';
    document.getElementById('previewImageSrc').src = img.url;
    document.getElementById('previewImageCategory').textContent = img.category || 'other';
    document.getElementById('previewImageSizeInfo').textContent = img.size || '-';
    document.getElementById('previewImageUrl').textContent = img.url;
    
    document.getElementById('imagePreviewModal').style.display = 'flex';
}

function closeImagePreviewModal() {
    document.getElementById('imagePreviewModal').style.display = 'none';
    currentPreviewImage = null;
}

function copyImageUrl() {
    if (currentPreviewImage) {
        navigator.clipboard.writeText(currentPreviewImage.url).then(() => {
            showToast('Image URL copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy URL', 'error');
        });
    }
}

function copyImageLink(imageId) {
    const img = uploadedImages.find(i => i.id === imageId);
    if (img) {
        navigator.clipboard.writeText(img.url).then(() => {
            showToast('Image URL copied!', 'success');
        }).catch(() => {
            showToast('Failed to copy URL', 'error');
        });
    }
}

function downloadImage() {
    if (currentPreviewImage) {
        const link = document.createElement('a');
        link.href = currentPreviewImage.url;
        link.download = currentPreviewImage.fileName || 'image';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function deleteImageFromPreview() {
    if (currentPreviewImage) {
        const imageId = currentPreviewImage.id;
        closeImagePreviewModal();
        deleteImage(imageId);
    }
}

// Filter images by category
function filterImages(category) {
    if (category === 'all') {
        renderImageGallery(uploadedImages);
    } else {
        const filtered = uploadedImages.filter(img => img.category === category);
        renderImageGallery(filtered);
    }
}

// Search images
function searchImages(query) {
    const filtered = uploadedImages.filter(img => 
        (img.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (img.category || '').toLowerCase().includes(query.toLowerCase())
    );
    renderImageGallery(filtered);
}

// ============================================
// Preview Functions
// ============================================
function updatePreview() {
    previewCount++;
    document.getElementById('totalViews').textContent = previewCount;
}

function refreshPreview() {
    const iframe = document.getElementById('previewFrame');
    iframe.src = iframe.src;
    updatePreview();
    addActivity('Preview Refreshed', 'Website preview has been refreshed');
}

function openInNewTab() {
    window.location.href = 'index.html';
    addActivity('Preview Opened', 'Opened website preview');
}

// ============================================
// Export & Publish
// ============================================
function exportWebsite() {
    showToast('Preparing website export...', 'info');
    
    const exportData = {
        sections: websiteSections,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "tamil-ai-stream-website.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    showToast('Website exported successfully!', 'success');
    addActivity('Website Exported', 'Website configuration has been exported');
}

// ============================================
// Publishing Workflow
// ============================================
function getPublishState() {
    try {
        const state = localStorage.getItem('publishState');
        const history = localStorage.getItem('publishHistory');
        if (state) publishState = state;
        if (history) publishHistory = JSON.parse(history);
    } catch (e) {
        console.error('Error loading publish state:', e);
    }
}

function savePublishState() {
    try {
        localStorage.setItem('publishState', publishState);
        localStorage.setItem('publishHistory', JSON.stringify(publishHistory));
    } catch (e) {
        console.error('Error saving publish state:', e);
    }
}

async function syncToLiveWebsite() {
    try {
        localStorage.setItem('tamilAIStream_lastSyncedAt', new Date().toISOString());
        localStorage.setItem('builderLastPublished', Date.now().toString());

        if (window.ContentSync && typeof window.ContentSync.syncCurrentState === 'function') {
            await window.ContentSync.syncCurrentState();
        }

        // Method 1: Dispatch custom event
        window.dispatchEvent(new Event('storage-sync'));

        // Method 2: Dispatch storage event for cross-tab
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'tamilAIStream_songs',
            newValue: JSON.stringify(DataStore.getSongs()),
            url: window.location.href
        }));

        // Method 3: BroadcastChannel (modern browsers)
        try {
            const channel = new BroadcastChannel('tamilAIStream_sync');
            channel.postMessage({
                type: 'content-updated',
                timestamp: Date.now(),
                songCount: DataStore.getSongs().length,
                stationCount: DataStore.getStations().length,
                sections: ['songs', 'stations', 'featured', 'trending', 'artistHits', 'categories', 'premium']
            });
        } catch (e) {
            console.warn('[Builder] BroadcastChannel not supported');
        }

        // Method 4: Dispatch premium section re-render event
        window.dispatchEvent(new CustomEvent('premium-sections-sync', {
            detail: { timestamp: Date.now() }
        }));

        console.log('[Builder] Sync signals sent successfully');

        // Refresh preview iframe to show latest content
        const previewIframe = document.getElementById('previewFrame');
        if (previewIframe && previewIframe.src) {
            const currentSrc = previewIframe.src;
            previewIframe.src = 'about:blank';
            setTimeout(() => {
                previewIframe.src = currentSrc;
            }, 200);
        }

        // Also refresh visual editor iframe if active
        const veIframe = document.getElementById('veFrame');
        if (veIframe && veIframe.src) {
            const currentSrc = veIframe.src;
            veIframe.src = 'about:blank';
            setTimeout(() => {
                veIframe.src = currentSrc;
            }, 200);
        }
    } catch (e) {
        console.error('Error syncing to live website:', e);
    }
}
function saveDraft() {
    showToast('Saving draft...', 'info');
    try {
        const draftData = {
            songs: DataStore.getSongs(),
            stations: DataStore.getStations(),
            categories: DataStore.getCategories(),
            featured: DataStore.getFeatured(),
            trending: DataStore.getTrending(),
            artistHits: DataStore.getArtistHits(),
            quotes: DataStore.getQuotes(),
            siteSettings: DataStore.getSiteSettings(),
            layout: DataStore.getLayout(),
            websiteSections: websiteSections,
            images: DataStore.getImages(),
            moods: DataStore.getMoods(),
            aiRadio: DataStore.getAIRadio(),
            notifications: DataStore.getNotifications(),
            splash: DataStore.getSplash(),
            playerPrefs: DataStore.getPlayerPrefs(),
            navigation: DataStore.getNavigation(),
            sectionsOrder: DataStore.getSectionsOrder(),
            miniPlayerSettings: DataStore.getMiniPlayerSettings(),
            savedAt: new Date().toISOString()
        };
        localStorage.setItem('builderDraft', JSON.stringify(draftData));
        localStorage.setItem('builderLastSaved', Date.now().toString());
        publishState = 'draft';
        savePublishState();
        showToast('Draft saved successfully!', 'success');
        addActivity('Draft Saved', 'Website changes saved as draft');
        updatePublishUI();
    } catch (error) {
        console.error('Save draft error:', error);
        showToast('Failed to save draft: ' + error.message, 'error');
    }
}

async function publishChanges() {
    showToast('Publishing changes...', 'info');
    try {
        await syncToLiveWebsite();

        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    await caches.delete(name);
                }
            } catch (e) { /* ignore */ }
        }

        localStorage.removeItem('tamilAIStream_lastSyncedAt');

        const publishEntry = {
            id: 'pub_' + Date.now(),
            date: new Date().toISOString(),
            status: 'published',
            changes: {
                songs: DataStore.getSongs().length,
                stations: DataStore.getStations().length,
                categories: DataStore.getCategories().length,
                featured: DataStore.getFeatured().length,
                trending: DataStore.getTrending().length,
                artistHits: DataStore.getArtistHits().length,
                quotes: DataStore.getQuotes().length,
                sections: DataStore.getLayout().length,
                miniPlayer: Object.keys(DataStore.getMiniPlayerSettings()).length > 0
            }
        };
        publishHistory.unshift(publishEntry);
        if (publishHistory.length > 50) publishHistory = publishHistory.slice(0, 50);
        publishState = 'published';
        savePublishState();
        showToast('Website published successfully!', 'success');
        addActivity('Website Published', 'All changes have been published live');
        updatePublishUI();
    } catch (error) {
        console.error('Publish error:', error);
        showToast('Publish failed: ' + error.message, 'error');
    }
}

function unpublish() {
    if (!confirm('Are you sure you want to unpublish the website? The live site will show the previous published version.')) return;
    try {
        publishState = 'unpublished';
        savePublishState();
        showToast('Website unpublished. Previous version is now live.', 'info');
        addActivity('Website Unpublished', 'The website has been taken offline');
        updatePublishUI();
    } catch (error) {
        console.error('Unpublish error:', error);
        showToast('Unpublish failed: ' + error.message, 'error');
    }
}

function discardChanges() {
    if (!confirm('Discard all unsaved changes? This cannot be undone.')) return;
    try {
        const draft = localStorage.getItem('builderDraft');
        if (draft) {
            const draftData = JSON.parse(draft);
            if (draftData.songs) DataStore.setSongs(draftData.songs);
            if (draftData.stations) DataStore.setStations(draftData.stations);
            if (draftData.categories) DataStore.setCategories(draftData.categories);
            if (draftData.featured) DataStore.setFeatured(draftData.featured);
            if (draftData.trending) DataStore.setTrending(draftData.trending);
            if (draftData.artistHits) DataStore.setArtistHits(draftData.artistHits);
            if (draftData.quotes) DataStore.setQuotes(draftData.quotes);
            if (draftData.siteSettings) DataStore.setSiteSettings(draftData.siteSettings);
            if (draftData.layout) DataStore.setLayout(draftData.layout);
            if (draftData.websiteSections) { websiteSections = draftData.websiteSections; localStorage.setItem('websiteLayout', JSON.stringify(websiteSections)); }
            if (draftData.images) DataStore.setImages(draftData.images);
            if (draftData.moods) DataStore.setMoods(draftData.moods);
            if (draftData.aiRadio) DataStore.setAIRadio(draftData.aiRadio);
            if (draftData.notifications) DataStore.setNotifications(draftData.notifications);
            if (draftData.splash) DataStore.setSplash(draftData.splash);
            if (draftData.playerPrefs) DataStore.setPlayerPrefs(draftData.playerPrefs);
            if (draftData.navigation) DataStore.setNavigation(draftData.navigation);
            if (draftData.sectionsOrder) DataStore.setSectionsOrder(draftData.sectionsOrder);
            if (draftData.miniPlayerSettings) DataStore.setMiniPlayerSettings(draftData.miniPlayerSettings);
        }
        publishState = 'draft';
        savePublishState();
        showToast('Changes discarded. Draft restored.', 'success');
        addActivity('Changes Discarded', 'All unsaved changes have been discarded');
        updatePublishUI();
        navigateTo('dashboard');
    } catch (error) {
        console.error('Discard error:', error);
        showToast('Failed to discard changes: ' + error.message, 'error');
    }
}

function showPublishHistory() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'publishHistoryModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('publishHistoryModal').remove()"></div>
        <div class="modal-content modal-lg">
            <div class="modal-header">
                <h2>Publish History</h2>
                <button class="modal-close" onclick="document.getElementById('publishHistoryModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="publish-state-info">
                    <span class="publish-state-badge ${publishState}">${publishState.toUpperCase()}</span>
                    <span class="publish-state-text">Current Status: ${publishState}</span>
                </div>
                ${publishHistory.length === 0 ? '<p class="no-history">No publish history yet.</p>' : `
                <div class="history-list">
                    ${publishHistory.map(entry => `
                        <div class="history-entry">
                            <div class="history-entry-header">
                                <span class="history-status published"><i class="fas fa-check-circle"></i> Published</span>
                                <span class="history-date">${new Date(entry.date).toLocaleString()}</span>
                            </div>
                            <div class="history-entry-details">
                                <span>${entry.changes.songs} songs</span>
                                <span>${entry.changes.stations} stations</span>
                                <span>${entry.changes.categories} categories</span>
                                <span>${entry.changes.featured} featured</span>
                                <span>${entry.changes.trending} trending</span>
                                <span>${entry.changes.artistHits} artist hits</span>
                                <span>${entry.changes.quotes} quotes</span>
                                <span>${entry.changes.sections} sections</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                `}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function updatePublishUI() {
    const badge = document.getElementById('publishStatusBadge');
    if (badge) {
        badge.textContent = publishState.toUpperCase();
        badge.className = 'publish-state-badge ' + publishState;
    }
    const publishBtn = document.getElementById('quickPublishBtn');
    const unpublishBtn = document.getElementById('quickUnpublishBtn');
    const saveDraftBtn = document.getElementById('quickSaveDraftBtn');
    const discardBtn = document.getElementById('quickDiscardBtn');
    const historyBtn = document.getElementById('quickHistoryBtn');

    if (publishBtn) publishBtn.style.display = publishState === 'published' ? 'none' : 'flex';
    if (unpublishBtn) unpublishBtn.style.display = publishState === 'published' ? 'flex' : 'none';
    if (saveDraftBtn) saveDraftBtn.style.display = 'flex';
    if (discardBtn) discardBtn.style.display = 'flex';
    if (historyBtn) historyBtn.style.display = 'flex';
}

// ============================================
// Utility Functions
// ============================================
function updateDashboardStats() {
    document.getElementById('totalSections').textContent = websiteSections.length;
}

function addActivity(title, description) {
    const activityList = document.getElementById('activityList');
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `
        <div class="activity-icon"><i class="fas fa-plus-circle"></i></div>
        <div class="activity-info">
            <h4>${title}</h4>
            <p>${description}</p>
        </div>
        <span class="activity-time">Just now</span>
    `;
    
    activityList.insertBefore(activityItem, activityList.firstChild);
    
    while (activityList.children.length > 10) {
        activityList.removeChild(activityList.lastChild);
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/* ============================================================
 * AI Animated Upload Status Overlay
 * A glowing, circular progress ring that shows real upload %
 * while a song (album cover + audio) is being saved.
 * ============================================================ */
const AIUploadOverlay = {
    R: 52,
    el: null, ring: null, track: null, pctEl: null, phaseEl: null, statusEl: null,
    orbit: null, timer: null, shown: false,

    init() {
        this.el = document.getElementById('aiUploadOverlay');
        if (!this.el) return;
        this.ring = document.getElementById('aiUploadRing');
        this.track = document.getElementById('aiUploadTrack');
        this.pctEl = document.getElementById('aiUploadPct');
        this.phaseEl = document.getElementById('aiUploadPhase');
        this.statusEl = document.getElementById('aiUploadStatus');
        this.orbit = this.el.querySelector('.ai-upload-orbit');
        const C = this.circ();
        if (this.ring) { this.ring.style.strokeDasharray = C; this.ring.style.strokeDashoffset = C; }
        if (this.track) { this.track.style.strokeDasharray = C; }
        document.getElementById('aiUploadClose')?.addEventListener('click', () => this.hide());
    },

    circ() { return 2 * Math.PI * this.R; },

    show() {
        if (!this.el) return;
        this.shown = true;
        this.el.style.display = 'flex';
        this.el.classList.remove('ai-upload-done', 'ai-upload-error');
        if (this.orbit) this.orbit.style.animationPlayState = 'running';
    },

    update(pct, phase, status) {
        if (!this.shown) this.show();
        const p = Math.min(100, Math.max(0, Math.round(pct)));
        const C = this.circ();
        if (this.ring) this.ring.style.strokeDashoffset = C * (1 - p / 100);
        if (this.pctEl) this.pctEl.textContent = p + '%';
        if (this.phaseEl) this.phaseEl.textContent = phase || '';
        if (this.statusEl) this.statusEl.textContent = status || '';
        if (this.el) this.el.classList.remove('ai-upload-done', 'ai-upload-error');
        if (this.orbit) this.orbit.style.animationPlayState = 'running';
    },

    success(msg) {
        this.update(100, 'Done', msg || 'Song saved to Tamil AI Stream!');
        if (this.el) this.el.classList.add('ai-upload-done');
        if (this.orbit) this.orbit.style.animationPlayState = 'paused';
        this.timer = setTimeout(() => this.hide(), 1800);
    },

    error(msg) {
        this.update(0, 'Error', msg || 'Upload failed');
        if (this.el) this.el.classList.add('ai-upload-error');
        if (this.orbit) this.orbit.style.animationPlayState = 'paused';
        this.timer = setTimeout(() => this.hide(), 5000);
    },

    hide() {
        this.timer && clearTimeout(this.timer);
        this.shown = false;
        if (this.el) this.el.style.display = 'none';
        if (this.orbit) this.orbit.style.animationPlayState = 'paused';
    },

    setProgress(value, max) {
        // helper for phases without a precise pct
        if (max) return this.update(Math.round((value / max) * 100), null, null);
        return this;
    }
};
window.AIUploadOverlay = AIUploadOverlay;

// ============================================
// File Upload Handlers
// ============================================
function setupFileUploads() {
    // Album cover upload
    const albumUpload = document.getElementById('albumUpload');
    const albumInput = document.getElementById('albumImage');
    
    // Click to open file browser
    albumUpload?.addEventListener('click', (e) => {
        if (e.target !== albumInput) {
            albumInput?.click();
        }
    });
    
    albumUpload?.addEventListener('dragover', (e) => {
        e.preventDefault();
        albumUpload.classList.add('dragover');
    });
    
    albumUpload?.addEventListener('dragleave', () => {
        albumUpload.classList.remove('dragover');
    });
    
    albumUpload?.addEventListener('drop', (e) => {
        e.preventDefault();
        albumUpload.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            albumInput.files = files;
            handleAlbumPreview(files[0]);
        }
    });
    
    albumInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAlbumPreview(e.target.files[0]);
        }
    });

    // Audio upload
    const audioUpload = document.getElementById('audioUpload');
    const audioInput = document.getElementById('audioFile');
    
    // Click to open file browser
    audioUpload?.addEventListener('click', (e) => {
        if (e.target !== audioInput) {
            audioInput?.click();
        }
    });
    
    audioUpload?.addEventListener('dragover', (e) => {
        e.preventDefault();
        audioUpload.classList.add('dragover');
    });
    
    audioUpload?.addEventListener('dragleave', () => {
        audioUpload.classList.remove('dragover');
    });
    
    audioUpload?.addEventListener('drop', (e) => {
        e.preventDefault();
        audioUpload.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            audioInput.files = files;
            handleAudioPreview(files[0]);
        }
    });
    
    audioInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAudioPreview(e.target.files[0]);
        }
    });

    // Image upload zone (Images page)
    const imageUploadZone = document.getElementById('imageUploadZone');
    const imageFileInput = document.getElementById('imageFileInput');
    
    imageUploadZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadZone.classList.add('dragover');
    });
    
    imageUploadZone?.addEventListener('dragleave', () => {
        imageUploadZone.classList.remove('dragover');
    });
    
    imageUploadZone?.addEventListener('drop', async (e) => {
        e.preventDefault();
        imageUploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await handleImageUpload(files);
        }
    });
    
    imageFileInput?.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await handleImageUpload(e.target.files);
        }
    });

    // Modal image upload
    const modalImageUpload = document.getElementById('modalImageUpload');
    const modalImageFile = document.getElementById('modalImageFile');
    
    modalImageUpload?.addEventListener('click', () => modalImageFile?.click());
    
    modalImageFile?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleModalImagePreview(e.target.files[0]);
        }
    });
}

async function handleImageUpload(files) {
    const progressEl = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressEl.style.display = 'flex';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const percent = ((i + 1) / files.length) * 100;
        
        progressFill.style.width = percent + '%';
        progressText.textContent = `Uploading ${i + 1} of ${files.length}: ${file.name}`;
        
        await uploadImage(file, 'other', file.name);
    }
    
    progressEl.style.display = 'none';
    progressFill.style.width = '0%';
}

function handleModalImagePreview(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('modalPreviewImg').src = e.target.result;
        document.getElementById('modalImageName').textContent = file.name;
        document.getElementById('modalImageSize').textContent = formatFileSize(file.size);
        document.getElementById('modalImagePreview').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function handleAlbumPreview(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('albumPreviewImg').src = e.target.result;
        document.getElementById('albumFileName').textContent = file.name;
        document.getElementById('albumFileSize').textContent = formatFileSize(file.size);
        document.getElementById('albumPreview').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function handleAudioPreview(file) {
    const AUDIO_RE = /\.(mp3|wav|ogg|oga|aac|m4a|flac|opus|webm)$/i;
    // Some browsers report an empty MIME type for .mp3/.wav files, so accept
    // the file by extension as well as by type.
    if (!file.type.startsWith('audio/') && !AUDIO_RE.test(file.name)) {
        showToast('Please upload an audio file (MP3, WAV, OGG, M4A)', 'error');
        return;
    }

    document.getElementById('audioFileName').textContent = file.name;
    document.getElementById('audioFileSize').textContent = formatFileSize(file.size);
    document.getElementById('audioPreview').style.display = 'flex';
}


// ============================================
// Initialize Builder
// ============================================
function initBuilder() {
    // Navigation
    document.querySelectorAll('.builder-sidebar-item, .builder-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            if (page) navigateTo(page);
        });
    });

    // Logout
    document.getElementById('builderLogout')?.addEventListener('click', signOut);

    // Song form submission
    document.getElementById('songForm')?.addEventListener('submit', saveSong);

    // Quick song form submission
    document.getElementById('quickSongForm')?.addEventListener('submit', saveQuickSong);

    // Upload image form
    document.getElementById('uploadImageForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('modalImageFile').files[0];
        const category = document.getElementById('imageCategory').value;
        const title = document.getElementById('imageTitle').value;
        
        if (file) {
            await uploadImage(file, category, title);
            closeUploadImageModal();
        }
    });

    // Search functionality
    document.getElementById('songSearch')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#allSongsTable tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });

    // Image search
    document.getElementById('imageSearch')?.addEventListener('input', (e) => {
        searchImages(e.target.value);
    });

    // Image filter
    document.getElementById('imageFilter')?.addEventListener('change', (e) => {
        filterImages(e.target.value);
    });

    // Device buttons for preview
    document.querySelectorAll('.device-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const device = this.dataset.device;
            const frame = document.getElementById('previewFrame');

            switch(device) {
                case 'desktop':
                    frame.style.width = '100%';
                    frame.style.height = '100%';
                    frame.style.margin = '0';
                    break;
                case 'tablet':
                    frame.style.width = '768px';
                    frame.style.height = '1024px';
                    frame.style.margin = '0 auto';
                    break;
                case 'mobile':
                    frame.style.width = '375px';
                    frame.style.height = '812px';
                    frame.style.margin = '0 auto';
                    break;
            }

            // Reload iframe to ensure fresh content rendered for the selected device viewport
            const iframe = document.getElementById('previewFrame');
            if (iframe && iframe.src) {
                const currentSrc = iframe.src;
                iframe.src = 'about:blank';
                setTimeout(() => {
                    iframe.src = currentSrc;
                }, 100);
            }
        });
    });

    // Content tabs
    document.querySelectorAll('.content-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.content-tab-panel').forEach(p => p.style.display = 'none');
            this.classList.add('active');
            const tabName = this.dataset.tab;
            const panel = document.getElementById(tabName + 'Tab');
            if (panel) panel.style.display = 'block';
        });
    });

    // Artist Hits Sub-Tabs
    setupArtistHitsSubTabs();

    // Station form
    document.getElementById('stationForm')?.addEventListener('submit', saveStation);
    
    // Station thumbnail preview
    document.getElementById('stationThumbnail')?.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        const preview = document.getElementById('stationThumbnailPreview');
        const img = document.getElementById('stationThumbnailImg');
        if (url && preview && img) {
            img.src = url;
            preview.style.display = 'block';
            img.onerror = () => { preview.style.display = 'none'; };
        } else if (preview) {
            preview.style.display = 'none';
        }
    });

    // Settings form
    document.getElementById('settingsForm')?.addEventListener('submit', saveSettings);

    // Station search
    document.getElementById('stationSearch')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('#stationsTable tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
    });

    // Setup file uploads
    setupFileUploads();

    // Initialize preview player
    setupPreviewPlayer();

    // Initialize publish state
    getPublishState();
    updatePublishUI();

    // Load dashboard by default
    navigateTo('dashboard');

    console.log('%c🎙️ Tamil AI Stream Admin Panel', 'font-size:20px;font-weight:bold;color:#34d399;');
    console.log('%cAdmin Ready - Logged in as: ' + (currentUser?.displayName || currentUser?.email || 'Admin'), 'font-size:12px;color:#6ee7b7;');
}

// ============================================
// Stations Management
// ============================================
function loadAllStations() {
    const stations = DataStore.getStations();
    const tableBody = document.getElementById('stationsTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = stations.map(station => `
        <tr>
            <td><strong>${station.name}</strong></td>
            <td>${station.freq}</td>
            <td>${station.genre}</td>
            <td>${station.city || 'Chennai'}</td>
            <td><span class="status-badge ${station.status === 'active' ? 'active' : 'inactive'}">${station.status}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn edit-btn" onclick="editStation('${station.id}')" title="Edit Station">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn delete" onclick="deleteStation('${station.id}')" title="Delete Station">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function saveStation(e) {
    e.preventDefault();
    const id = document.getElementById('stationId').value;
    const stationData = {
        name: document.getElementById('stationName').value.trim(),
        freq: document.getElementById('stationFreq').value.trim(),
        genre: document.getElementById('stationGenre').value,
        city: document.getElementById('stationCity').value.trim() || 'Chennai',
        streamUrl: document.getElementById('stationStreamUrl').value.trim(),
        thumbnail: document.getElementById('stationThumbnail').value.trim(),
        status: document.getElementById('stationStatus').value,
        gradient: `linear-gradient(135deg, hsl(${Math.random()*360},30%,15%), hsl(${Math.random()*360},40%,10%))`
    };
    
    if (!stationData.name || !stationData.freq || !stationData.streamUrl) {
        showToast('Please fill in required fields', 'error');
        return;
    }
    
    const stations = DataStore.getStations();
    
    if (id) {
        const idx = stations.findIndex(s => s.id === id);
        if (idx !== -1) stations[idx] = { ...stations[idx], ...stationData };
    } else {
        stationData.id = 'st_' + Date.now();
        stationData.listeners = 0;
        stations.push(stationData);
    }
    
    DataStore.setStations(stations);
    showToast('Station saved successfully!', 'success');
    resetStationForm();
    loadAllStations();
    syncToLiveWebsite();
    addActivity('Station Saved', `Saved "${stationData.name}"`);
}

function editStation(id) {
    const stations = DataStore.getStations();
    const station = stations.find(s => s.id === id);
    if (!station) return;
    
    // Set form values
    document.getElementById('stationId').value = station.id;
    document.getElementById('stationName').value = station.name;
    document.getElementById('stationFreq').value = station.freq;
    document.getElementById('stationGenre').value = station.genre;
    document.getElementById('stationCity').value = station.city || '';
    document.getElementById('stationStreamUrl').value = station.streamUrl || '';
    document.getElementById('stationThumbnail').value = station.thumbnail || '';
    document.getElementById('stationStatus').value = station.status || 'active';
    
    // Show thumbnail preview if exists
    const thumbPreview = document.getElementById('stationThumbnailPreview');
    const thumbImg = document.getElementById('stationThumbnailImg');
    if (station.thumbnail && thumbPreview && thumbImg) {
        thumbImg.src = station.thumbnail;
        thumbPreview.style.display = 'block';
    } else if (thumbPreview) {
        thumbPreview.style.display = 'none';
    }
    
    // Add edit mode banner
    const formCard = document.getElementById('stationForm')?.closest('.content-card');
    if (formCard) {
        // Remove existing banner if any
        const existingBanner = formCard.querySelector('.edit-mode-banner');
        if (existingBanner) existingBanner.remove();
        
        // Add new banner
        const banner = document.createElement('div');
        banner.className = 'edit-mode-banner';
        banner.innerHTML = `
            <i class="fas fa-edit"></i>
            <span>Editing: <strong>${station.name}</strong></span>
            <button onclick="cancelEditStation()" type="button"><i class="fas fa-times"></i> Cancel</button>
        `;
        formCard.insertBefore(banner, formCard.firstChild);
    }
    
    // Scroll to form and highlight it
    const form = document.getElementById('stationForm');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.classList.add('highlight-edit');
        setTimeout(() => form.classList.remove('highlight-edit'), 2000);
    }
    
    // Change submit button text to indicate editing
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Station';
    }
    
    showToast('Station loaded for editing. Modify and click Update.', 'info');
}

function cancelEditStation() {
    resetStationForm();
    // Remove edit mode banner
    const banner = document.querySelector('.edit-mode-banner');
    if (banner) banner.remove();
    showToast('Edit cancelled', 'info');
}

function deleteStation(id) {
    if (!confirm('Delete this station?')) return;
    const stations = DataStore.getStations().filter(s => s.id !== id);
    DataStore.setStations(stations);
    showToast('Station deleted', 'success');
    loadAllStations();
    syncToLiveWebsite();
}

function resetStationForm() {
    document.getElementById('stationForm').reset();
    document.getElementById('stationId').value = '';
    document.getElementById('stationThumbnailPreview').style.display = 'none';
    
    // Reset submit button text
    const submitBtn = document.querySelector('#stationForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Station';
    }
}

// ============================================
// Featured Management
// ============================================
function loadFeatured() {
    const featured = DataStore.getFeatured();
    const stations = DataStore.getStations();
    const tableBody = document.getElementById('featuredTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = featured.map(item => {
        const station = stations.find(s => s.id === item.stationId) || {};
        return `
            <tr>
                <td><strong>${item.title || station.name || 'N/A'}</strong></td>
                <td>${station.name || 'N/A'}</td>
                <td>${(item.listeners || 0).toLocaleString()}</td>
                <td><span class="status-badge ${item.status === 'active' ? 'active' : 'inactive'}">${item.status}</span></td>
                <td>
                    <div class="actions">
                        <button class="action-btn" onclick="editFeatured('${item.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="deleteFeatured('${item.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddFeaturedModal() {
    const stations = DataStore.getStations();
    const stationOptions = stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'featuredModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Featured Station</h2>
                <button class="modal-close" onclick="document.getElementById('featuredModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="featuredForm">
                    <div class="form-group">
                        <label class="form-label">Station *</label>
                        <select class="form-select" id="featuredStationId" required>${stationOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Custom Title (optional)</label>
                        <input type="text" class="form-input" id="featuredTitle" placeholder="Override station name">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Custom Subtitle (optional)</label>
                        <input type="text" class="form-input" id="featuredSubtitle" placeholder="e.g. 98.3 FM - Chennai">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL (optional)</label>
                        <input type="url" class="form-input" id="featuredThumbnail" placeholder="https://example.com/image.jpg">
                        <div class="station-thumbnail-preview" id="featuredThumbnailPreview" style="display:none;">
                            <img id="featuredThumbnailImg" src="" alt="Thumbnail preview">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('featuredModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('featuredForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const featured = DataStore.getFeatured();
        const stationId = document.getElementById('featuredStationId').value;
        const stations = DataStore.getStations();
        const station = stations.find(s => s.id === stationId);
        
        featured.push({
            id: 'feat_' + Date.now(),
            stationId: stationId,
            title: document.getElementById('featuredTitle').value || station?.name || '',
            subtitle: document.getElementById('featuredSubtitle').value || `${station?.freq || ''} - ${station?.city || ''}`,
            thumbnail: document.getElementById('featuredThumbnail').value.trim() || station?.thumbnail || '',
            listeners: station?.listeners || 0,
            gradient: station?.gradient || 'linear-gradient(135deg, #0f3b2e, #064e3b)',
            status: 'active'
        });
        
        DataStore.setFeatured(featured);
        showToast('Featured station added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadFeatured();
    });
}

function editFeatured(id) {
    const featured = DataStore.getFeatured();
    const item = featured.find(f => f.id === id);
    if (!item) return;
    
    const stations = DataStore.getStations();
    const stationOptions = stations.map(s => `<option value="${s.id}" ${s.id === item.stationId ? 'selected' : ''}>${s.name}</option>`).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'featuredModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Featured Station</h2>
                <button class="modal-close" onclick="document.getElementById('featuredModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="featuredForm">
                    <div class="form-group">
                        <label class="form-label">Station *</label>
                        <select class="form-select" id="featuredStationId" required>${stationOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Custom Title</label>
                        <input type="text" class="form-input" id="featuredTitle" value="${item.title || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Custom Subtitle</label>
                        <input type="text" class="form-input" id="featuredSubtitle" value="${item.subtitle || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL</label>
                        <input type="url" class="form-input" id="featuredThumbnail" value="${item.thumbnail || ''}" placeholder="https://example.com/image.jpg">
                        <div class="station-thumbnail-preview" id="featuredThumbnailPreview" style="display:${item.thumbnail ? 'block' : 'none'};">
                            <img id="featuredThumbnailImg" src="${item.thumbnail || ''}" alt="Thumbnail preview">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('featuredModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('featuredForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const featured = DataStore.getFeatured();
        const idx = featured.findIndex(f => f.id === id);
        const stationId = document.getElementById('featuredStationId').value;
        const station = stations.find(s => s.id === stationId);
        
        featured[idx] = {
            ...featured[idx],
            stationId: stationId,
            title: document.getElementById('featuredTitle').value || station?.name || '',
            subtitle: document.getElementById('featuredSubtitle').value || '',
            thumbnail: document.getElementById('featuredThumbnail').value.trim() || station?.thumbnail || '',
            listeners: station?.listeners || featured[idx].listeners,
            gradient: station?.gradient || featured[idx].gradient
        };
        
        DataStore.setFeatured(featured);
        showToast('Featured updated!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadFeatured();
    });
}

function deleteFeatured(id) {
    if (!confirm('Delete this featured item?')) return;
    const featured = DataStore.getFeatured().filter(f => f.id !== id);
    DataStore.setFeatured(featured);
    showToast('Featured deleted', 'success');
    loadFeatured();
    syncToLiveWebsite();
}

// ============================================
// Trending Management
// ============================================
function loadTrending() {
    const trending = DataStore.getTrending();
    const stations = DataStore.getStations();
    const tableBody = document.getElementById('trendingTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = trending.map(item => {
        const station = stations.find(s => s.id === item.stationId) || {};
        return `
            <tr>
                <td><strong>${station.name || 'N/A'}</strong></td>
                <td><span class="status-badge ${item.status === 'active' ? 'active' : 'inactive'}">${item.status}</span></td>
                <td>
                    <div class="actions">
                        <button class="action-btn edit-btn" onclick="editTrending('${item.id}')" title="Edit"><i class="fas fa-edit"></i> Edit</button>
                        <button class="action-btn delete" onclick="deleteTrending('${item.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddTrendingModal() {
    const stations = DataStore.getStations();
    const stationOptions = stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'trendingModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Trending Station</h2>
                <button class="modal-close" onclick="document.getElementById('trendingModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="trendingForm">
                    <div class="form-group">
                        <label class="form-label">Station *</label>
                        <select class="form-select" id="trendingStationId" required>${stationOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL (optional)</label>
                        <input type="url" class="form-input" id="trendingThumbnail" placeholder="https://example.com/image.jpg">
                        <div class="station-thumbnail-preview" id="trendingThumbnailPreview" style="display:none;">
                            <img id="trendingThumbnailImg" src="" alt="Thumbnail preview">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('trendingModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('trendingForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const trending = DataStore.getTrending();
        const stationId = document.getElementById('trendingStationId').value;
        const stations = DataStore.getStations();
        const station = stations.find(s => s.id === stationId);
        trending.push({
            id: 'trend_' + Date.now(),
            stationId: stationId,
            thumbnail: document.getElementById('trendingThumbnail').value.trim() || station?.thumbnail || '',
            status: 'active'
        });
        DataStore.setTrending(trending);
        showToast('Trending station added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadTrending();
    });
}

function deleteTrending(id) {
    if (!confirm('Delete from trending?')) return;
    const trending = DataStore.getTrending().filter(t => t.id !== id);
    DataStore.setTrending(trending);
    showToast('Removed from trending', 'success');
    loadTrending();
    syncToLiveWebsite();
}

function editTrending(id) {
    const trending = DataStore.getTrending();
    const item = trending.find(t => t.id === id);
    if (!item) return;
    
    const stations = DataStore.getStations();
    const stationOptions = stations.map(s => 
        `<option value="${s.id}" ${s.id === item.stationId ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'trendingModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Trending Station</h2>
                <button class="modal-close" onclick="document.getElementById('trendingModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="trendingForm">
                    <div class="form-group">
                        <label class="form-label">Station *</label>
                        <select class="form-select" id="trendingStationId" required>${stationOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select class="form-select" id="trendingStatus">
                            <option value="active" ${item.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${item.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Update</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('trendingModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('trendingForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const idx = trending.findIndex(t => t.id === id);
        if (idx !== -1) {
            trending[idx] = {
                ...trending[idx],
                stationId: document.getElementById('trendingStationId').value,
                status: document.getElementById('trendingStatus').value
            };
            DataStore.setTrending(trending);
            showToast('Trending station updated!', 'success');
            syncToLiveWebsite();
            modal.remove();
            loadTrending();
        }
    });
}

// ============================================
// Categories Management
// ============================================
function loadCategories() {
    const categories = DataStore.getCategories();
    const tableBody = document.getElementById('categoriesTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = categories.map(cat => `
        <tr>
            <td><i class="fas ${cat.icon || 'fa-th-large'}"></i></td>
            <td><strong>${cat.name}</strong></td>
            <td>${cat.count || 0}</td>
            <td><span class="status-badge ${cat.status === 'active' ? 'active' : 'inactive'}">${cat.status}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="editCategory('${cat.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteCategory('${cat.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddCategoryModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'categoryModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Category</h2>
                <button class="modal-close" onclick="document.getElementById('categoryModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="categoryForm">
                    <div class="form-group">
                        <label class="form-label">Name *</label>
                        <input type="text" class="form-input" id="catName" required placeholder="e.g. Music">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Icon (FontAwesome class)</label>
                        <input type="text" class="form-input" id="catIcon" placeholder="e.g. fa-music" value="fa-th-large">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Station Count</label>
                        <input type="number" class="form-input" id="catCount" value="0">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('categoryModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('categoryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const categories = DataStore.getCategories();
        categories.push({
            id: 'cat_' + Date.now(),
            name: document.getElementById('catName').value.trim(),
            icon: document.getElementById('catIcon').value.trim() || 'fa-th-large',
            count: parseInt(document.getElementById('catCount').value) || 0,
            status: 'active'
        });
        DataStore.setCategories(categories);
        showToast('Category added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadCategories();
    });
}

function editCategory(id) {
    const categories = DataStore.getCategories();
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'categoryModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Category</h2>
                <button class="modal-close" onclick="document.getElementById('categoryModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="categoryForm">
                    <div class="form-group">
                        <label class="form-label">Name *</label>
                        <input type="text" class="form-input" id="catName" value="${cat.name}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Icon</label>
                        <input type="text" class="form-input" id="catIcon" value="${cat.icon || 'fa-th-large'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Station Count</label>
                        <input type="number" class="form-input" id="catCount" value="${cat.count || 0}">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('categoryModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('categoryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const idx = categories.findIndex(c => c.id === id);
        categories[idx] = {
            ...categories[idx],
            name: document.getElementById('catName').value.trim(),
            icon: document.getElementById('catIcon').value.trim() || 'fa-th-large',
            count: parseInt(document.getElementById('catCount').value) || 0
        };
        DataStore.setCategories(categories);
        showToast('Category updated!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadCategories();
    });
}

function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    const categories = DataStore.getCategories().filter(c => c.id !== id);
    DataStore.setCategories(categories);
    showToast('Category deleted', 'success');
    loadCategories();
    syncToLiveWebsite();
}

// ============================================
// Artist Hits Management
// ============================================
function loadArtistHits() {
    const artistHits = DataStore.getArtistHits();
    const tableBody = document.getElementById('artistHitsTable');
    if (!tableBody) return;
    
      tableBody.innerHTML = artistHits.map(hit => {
        const songCount = (hit.songs && hit.songs.length) ? hit.songs.length : (hit.songCount || 0);
        return `
        <tr>
            <td>${hit.artist}</td>
            <td><strong>${hit.name}</strong></td>
            <td>${songCount}</td>
            <td><span class="status-badge ${hit.status === 'active' ? 'active' : 'inactive'}">${hit.status}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="openEditArtistSongsModal('${hit.id}')" title="Edit Artist - Manage Songs"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteArtistHit('${hit.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
    loadArtistSongCollections();
}

function openAddArtistHitModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'artistHitModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Artist Hit</h2>
                <button class="modal-close" onclick="document.getElementById('artistHitModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="artistHitForm">
                    <div class="form-group">
                        <label class="form-label">Artist ID *</label>
                        <input type="text" class="form-input" id="ahArtist" required placeholder="e.g. dhanush">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Display Name *</label>
                        <input type="text" class="form-input" id="ahName" required placeholder="e.g. Dhanush Hits">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Song Count</label>
                        <input type="number" class="form-input" id="ahSongCount" value="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Gradient</label>
                        <input type="text" class="form-input" id="ahGradient" placeholder="linear-gradient(135deg,#1e3a5f,#0d1f3c)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL (optional)</label>
                        <input type="url" class="form-input" id="ahThumbnail" placeholder="https://example.com/artist.jpg">
                        <div class="station-thumbnail-preview" id="ahThumbnailPreview" style="display:none;">
                            <img id="ahThumbnailImg" src="" alt="Thumbnail preview">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('artistHitModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('artistHitForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const artistHits = DataStore.getArtistHits();
        artistHits.push({
            id: 'ah_' + Date.now(),
            artist: document.getElementById('ahArtist').value.trim(),
            name: document.getElementById('ahName').value.trim(),
            songCount: parseInt(document.getElementById('ahSongCount').value) || 0,
            gradient: document.getElementById('ahGradient').value.trim() || 'linear-gradient(135deg,#1e3a5f,#0d1f3c)',
            thumbnail: document.getElementById('ahThumbnail').value.trim(),
            status: 'active'
        });
        DataStore.setArtistHits(artistHits);
        showToast('Artist hit added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadArtistHits();
    });
}

function editArtistHit(id) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === id);
    if (!hit) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'artistHitModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Artist Hit</h2>
                <button class="modal-close" onclick="document.getElementById('artistHitModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="artistHitForm">
                    <div class="form-group">
                        <label class="form-label">Artist ID *</label>
                        <input type="text" class="form-input" id="ahArtist" value="${hit.artist}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Display Name *</label>
                        <input type="text" class="form-input" id="ahName" value="${hit.name}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Song Count</label>
                        <input type="number" class="form-input" id="ahSongCount" value="${hit.songCount || 0}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Gradient</label>
                        <input type="text" class="form-input" id="ahGradient" value="${hit.gradient || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL</label>
                        <input type="url" class="form-input" id="ahThumbnail" value="${hit.thumbnail || ''}" placeholder="https://example.com/artist.jpg">
                        <div class="station-thumbnail-preview" id="ahThumbnailPreview" style="display:${hit.thumbnail ? 'block' : 'none'};">
                            <img id="ahThumbnailImg" src="${hit.thumbnail || ''}" alt="Thumbnail preview">
                        </div>
                    </div>
                     <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('artistHitModal').remove()">Cancel</button>
                        <button type="button" class="builder-btn" id="manageSongsBtn" data-id="${id}"><i class="fas fa-music"></i> Manage Songs</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
     document.getElementById('artistHitForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const idx = artistHits.findIndex(h => h.id === id);
        artistHits[idx] = {
            ...artistHits[idx],
            artist: document.getElementById('ahArtist').value.trim(),
            name: document.getElementById('ahName').value.trim(),
            songCount: parseInt(document.getElementById('ahSongCount').value) || 0,
            gradient: document.getElementById('ahGradient').value.trim(),
            thumbnail: document.getElementById('ahThumbnail').value.trim()
        };
        DataStore.setArtistHits(artistHits);
        showToast('Artist hit updated!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadArtistHits();
    });

    document.getElementById('manageSongsBtn').addEventListener('click', function() {
        modal.remove();
        openEditArtistSongsModal(id);
    });

    document.getElementById('ahThumbnail').addEventListener('input', function() {
        const preview = document.getElementById('ahThumbnailPreview');
        const img = document.getElementById('ahThumbnailImg');
        if (this.value) {
            preview.style.display = 'block';
            img.src = this.value;
        } else {
            preview.style.display = 'none';
        }
     });
 }

function manageArtistSongs(id) {
    document.querySelector('.content-tab[data-tab="artistHits"]').click();
    document.querySelector('.artist-hit-sub-tab[data-artist-tab="artistSongs"]').click();
    document.getElementById('artistSongCollection').value = id;
    loadArtistSongs(id);
}

function openEditArtistSongsModal(hitId) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit) {
        showToast('Artist collection not found', 'error');
        return;
    }

    const songs = DataStore.getSongs();
    if (!hit.songs) hit.songs = [];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editArtistSongsModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('editArtistSongsModal').remove()"></div>
        <div class="modal-content" style="max-width:900px;max-height:90vh;">
            <div class="modal-header">
                <h2>Edit Artist: ${hit.name} (${hit.artist})</h2>
                <button class="modal-close" onclick="document.getElementById('editArtistSongsModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="tabs" style="margin-bottom:16px;">
                    <button class="tab-btn active" data-tab="manage" onclick="switchArtistSongTab('manage')"><i class="fas fa-list"></i> Manage Songs</button>
                    <button class="tab-btn" data-tab="add" onclick="switchArtistSongTab('add')"><i class="fas fa-plus"></i> Add Song</button>
                </div>
                
                <div id="manageSongsTab">
                    <div class="form-group">
                        <label class="form-label">Duration Filter</label>
                        <input type="text" class="form-input" id="asDuration" placeholder="e.g. 3:45">
                    </div>
                    <div class="data-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Title</th>
                                    <th>Artist</th>
                                    <th>Movie</th>
                                    <th>Duration</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="editArtistSongsTable"></tbody>
                        </table>
                    </div>
                </div>
                
                <div id="addSongTab" style="display:none;">
                    <form id="addArtistSongForm">
                        <div class="form-group">
                            <label class="form-label">Select Song from Library</label>
                            <select class="form-input" id="asSong">
                                <option value="">-- Select Song --</option>
                                ${songs.map(s => `<option value="${s.id}">${s.title} - ${s.artist} (${s.movie})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-divider" style="margin:20px 0;border-top:1px solid #333;text-align:center;color:#888;font-size:12px;">OR</div>
                        <div class="form-group">
                            <label class="form-label">Upload MP3 File</label>
                            <div class="file-upload-area" id="fileUploadArea" style="border:2px dashed #444;border-radius:8px;padding:30px;text-align:center;cursor:pointer;transition:border 0.3s;">
                                <i class="fas fa-cloud-upload-alt" style="font-size:24px;color:#888;margin-bottom:10px;"></i>
                                <p style="margin:5px 0;color:#888;">Drop MP3 file here or click to browse</p>
                                <p style="margin:5px 0;font-size:11px;color:#666;">MP3 format, max 10MB</p>
                                <input type="file" id="mp3FileInput" accept=".mp3,audio/*" style="display:none;">
                            </div>
                        </div>
                        <div class="form-group" id="mp3InfoGroup" style="display:none;">
                            <label class="form-label">Song Title</label>
                            <input type="text" class="form-input" id="asTitle" placeholder="Enter song title">
                        </div>
                        <div class="form-group" id="mp3ArtistGroup" style="display:none;">
                            <label class="form-label">Artist</label>
                            <input type="text" class="form-input" id="asArtist" placeholder="Enter artist name">
                        </div>
                        <div class="form-group" id="mp3MovieGroup" style="display:none;">
                            <label class="form-label">Movie</label>
                            <input type="text" class="form-input" id="asMovie" placeholder="Enter movie name (optional)">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Duration</label>
                            <input type="text" class="form-input" id="addSongDuration" placeholder="e.g. 3:45">
                        </div>
                        <button type="button" class="builder-btn primary" onclick="addSongToArtistCollection('${hitId}')" style="margin-top:16px;">
                            <i class="fas fa-plus"></i> Add Song
                        </button>
                    </form>
                </div>
                
                <div class="form-actions" style="margin-top:24px;">
                    <button class="builder-btn primary" onclick="saveArtistSongs('${hitId}')"><i class="fas fa-save"></i> Save All Changes</button>
                    <button class="builder-btn" onclick="document.getElementById('editArtistSongsModal').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    let uploadedFileData = null;

    const fileInput = document.getElementById('mp3FileInput');
    const uploadArea = document.getElementById('fileUploadArea');

    if (fileInput && uploadArea) {
        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#00aaff';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#444';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#444';
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
            }
        });

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return;

            if (!file.name.toLowerCase().endsWith('.mp3')) {
                showToast('Only MP3 files are allowed', 'error');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                showToast('File size exceeds 10MB limit', 'error');
                return;
            }

            uploadArea.innerHTML = `<i class="fas fa-file-audio" style="font-size:24px;color:#00aaff;"></i><p style="margin:5px 0;color:#00aaff;">${file.name}</p><p style="font-size:11px;color:#888;">${(file.size / 1024 / 1024).toFixed(2)} MB</p>`;

             const reader = new FileReader();
            reader.onload = (e) => {
                uploadedFileData = e.target.result;
                window._currentUploadedFileData = e.target.result;
                document.getElementById('mp3InfoGroup').style.display = 'block';
                document.getElementById('mp3ArtistGroup').style.display = 'block';
                document.getElementById('mp3MovieGroup').style.display = 'block';
            };
            reader.readAsDataURL(file);
        });
    }

    // Store reference to uploadedFileData for addSongToArtistCollection
    window._currentUploadedFileData = null;

    renderEditArtistSongsTable(hitId);
}

function deleteArtistHit(id) {
    if (!confirm('Delete this artist hit?')) return;
    const artistHits = DataStore.getArtistHits().filter(h => h.id !== id);
    DataStore.setArtistHits(artistHits);
    showToast('Artist hit deleted', 'success');
    loadArtistHits();
    syncToLiveWebsite();
}

// ============================================
// Artist Hits Songs Management
// ============================================
function loadArtistSongCollections() {
    const select = document.getElementById('artistSongCollection');
    if (!select) return;
    const artistHits = DataStore.getArtistHits();
    select.innerHTML = '<option value="">-- Select Artist --</option>' +
        artistHits.map(hit => `<option value="${hit.id}">${hit.name} (${hit.artist})</option>`).join('');
}

function openAddArtistSongModal() {
    const collectionId = document.getElementById('artistSongCollection').value;
    if (!collectionId) {
        showToast('Please select an artist collection first', 'error');
        return;
    }

    const songs = DataStore.getSongs();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'artistSongModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content" style="max-width:700px;">
            <div class="modal-header">
                <h2>Add Song to Collection</h2>
                <button class="modal-close" onclick="document.getElementById('artistSongModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="artistSongForm">
                    <div class="form-group">
                        <label class="form-label">Select Song from Library</label>
                        <select class="form-input" id="asSong">
                            <option value="">-- Select Song --</option>
                            ${songs.map(s => `<option value="${s.id}">${s.title} - ${s.artist} (${s.movie})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-divider" style="margin:20px 0;border-top:1px solid #333;text-align:center;color:#888;font-size:12px;">OR</div>
                    <div class="form-group">
                        <label class="form-label">Upload MP3 File</label>
                        <div class="file-upload-area" id="fileUploadArea" style="border:2px dashed #444;border-radius:8px;padding:30px;text-align:center;cursor:pointer;transition:border 0.3s;">
                            <i class="fas fa-cloud-upload-alt" style="font-size:24px;color:#888;margin-bottom:10px;"></i>
                            <p style="margin:5px 0;color:#888;">Drop MP3 file here or click to browse</p>
                            <p style="margin:5px 0;font-size:11px;color:#666;">MP3 format, max 10MB</p>
                            <input type="file" id="mp3FileInput" accept=".mp3,audio/*" style="display:none;">
                        </div>
                    </div>
                    <div class="form-group" id="mp3InfoGroup" style="display:none;">
                        <label class="form-label">Song Title</label>
                        <input type="text" class="form-input" id="asTitle" placeholder="Enter song title">
                    </div>
                    <div class="form-group" id="mp3ArtistGroup" style="display:none;">
                        <label class="form-label">Artist</label>
                        <input type="text" class="form-input" id="asArtist" placeholder="Enter artist name">
                    </div>
                    <div class="form-group" id="mp3MovieGroup" style="display:none;">
                        <label class="form-label">Movie</label>
                        <input type="text" class="form-input" id="asMovie" placeholder="Enter movie name (optional)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Duration</label>
                        <input type="text" class="form-input" id="asDuration" placeholder="e.g. 3:45">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add Song</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('artistSongModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    let uploadedFileData = null;

    const fileInput = document.getElementById('mp3FileInput');
    const uploadArea = document.getElementById('fileUploadArea');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#00aaff';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#444';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#444';
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
        }
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.mp3')) {
            showToast('Only MP3 files are allowed', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showToast('File size exceeds 10MB limit', 'error');
            return;
        }

        uploadArea.innerHTML = `<i class="fas fa-file-audio" style="font-size:24px;color:#00aaff;"></i><p style="margin:5px 0;color:#00aaff;">${file.name}</p><p style="font-size:11px;color:#888;">${(file.size / 1024 / 1024).toFixed(2)} MB</p>`;

        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedFileData = e.target.result;
            document.getElementById('mp3InfoGroup').style.display = 'block';
            document.getElementById('mp3ArtistGroup').style.display = 'block';
            document.getElementById('mp3MovieGroup').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('artistSongForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const songId = document.getElementById('asSong').value;
        const duration = document.getElementById('asDuration').value.trim();

        const artistHits = DataStore.getArtistHits();
        const hit = artistHits.find(h => h.id === collectionId);
        if (!hit) {
            showToast('Artist collection not found', 'error');
            return;
        }
        if (!hit.songs) hit.songs = [];

        let songData;

        if (uploadedFileData) {
            const title = document.getElementById('asTitle').value.trim();
            const artist = document.getElementById('asArtist').value.trim();
            const movie = document.getElementById('asMovie').value.trim();
            if (!title || !artist) {
                showToast('Please enter title and artist', 'error');
                return;
            }
            songData = {
                songId: 'uploaded_' + Date.now(),
                id: 'uploaded_' + Date.now(),
                title: title,
                artist: artist,
                movie: movie || '',
                duration: duration || 'N/A',
                audioUrl: uploadedFileData,
                albumCover: ''
            };
        } else if (songId) {
            const song = songs.find(s => s.id === songId);
            if (!song) {
                showToast('Please select a song', 'error');
                return;
            }
            songData = {
                songId: song.id,
                title: song.title,
                artist: song.artist,
                movie: song.movie,
                duration: duration || song.duration || 'N/A',
                audioUrl: song.audioUrl || '',
                albumCover: song.albumCover || ''
            };
        } else {
            showToast('Please select a song or upload an MP3 file', 'error');
            return;
        }

        if (hit.songs.find(s => s.songId === songData.songId)) {
            showToast('Song already in this collection', 'warning');
            return;
        }

         hit.songs.push(songData);
        hit.songCount = hit.songs.length;
        DataStore.setArtistHits(artistHits);
        showToast('Song added to collection!', 'success');
        modal.remove();
        loadArtistSongs(collectionId);
        loadArtistSongCollections();
    });
}

function loadArtistSongs(collectionId) {
    const tableBody = document.getElementById('artistSongsTable');
    if (!tableBody) return;
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === collectionId);
    if (!hit || !hit.songs || !hit.songs.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">No songs in this collection. Add songs using the button above.</td></tr>';
        return;
    }
    tableBody.innerHTML = hit.songs.map((song, idx) => `
        <tr>
            <td>${song.title || 'Untitled'}</td>
            <td>${song.artist || 'Unknown'}</td>
            <td>${song.movie || 'N/A'}</td>
            <td>${song.duration || 'N/A'}</td>
            <td>
                <div class="actions">
                    <button class="action-btn delete" onclick="deleteArtistSong('${collectionId}',${idx})" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function deleteArtistSong(collectionId, songIndex) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === collectionId);
    if (!hit || !hit.songs) return;
    hit.songs.splice(songIndex, 1);
    hit.songCount = hit.songs.length;
    DataStore.setArtistHits(artistHits);
    showToast('Song removed from collection', 'success');
    loadArtistSongs(collectionId);
    loadArtistHits();
    loadArtistSongCollections();
}

// ============================================
// Edit Artist Songs Page Functions
// ============================================
function switchArtistSongTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    
    document.getElementById('manageSongsTab').style.display = tabName === 'manage' ? 'block' : 'none';
    document.getElementById('addSongTab').style.display = tabName === 'add' ? 'block' : 'none';
}

function renderEditArtistSongsTable(hitId) {
    const tableBody = document.getElementById('editArtistSongsTable');
    if (!tableBody) return;
    
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit || !hit.songs) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;">No songs yet</td></tr>';
        return;
    }
    
    tableBody.innerHTML = hit.songs.map((song, idx) => `
        <tr>
            <td style="text-align:center;font-weight:bold;">
                <span class="drag-handle" style="cursor:move;color:#888;margin-right:5px;">≡</span>
                ${idx + 1}
            </td>
            <td>${song.title || 'Untitled'}</td>
            <td>${song.artist || 'Unknown'}</td>
            <td>${song.movie || 'N/A'}</td>
            <td>${song.duration || 'N/A'}</td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="editArtistSongInCollection('${hitId}', ${idx})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="removeSongFromArtistCollection('${hitId}', ${idx})" title="Remove"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Setup drag and drop ordering
    setupSongDragAndDrop(hitId);
}

function setupSongDragAndDrop(hitId) {
    const tableBody = document.getElementById('editArtistSongsTable');
    if (!tableBody) return;
    
    let dragSrcEl = null;
    
    tableBody.addEventListener('dragstart', function(e) {
        dragSrcEl = e.target.closest('tr');
        if (!dragSrcEl) return;
        dragSrcEl.classList.add('drag-over');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragSrcEl.rowIndex);
    });
    
    tableBody.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    });
    
    tableBody.addEventListener('drop', function(e) {
        e.preventDefault();
        if (!dragSrcEl) return;
        
        const rows = Array.from(tableBody.querySelectorAll('tr'));
        const afterElement = getDragAfterElement(tableBody, e.clientY);
        const draggable = tableBody.querySelector('tr.drag-over');
        
        if (afterElement) {
            tableBody.insertBefore(draggable, afterElement);
        } else {
            tableBody.appendChild(draggable);
        }
        
        dragSrcEl.classList.remove('drag-over');
        
        // Reorder the data in localStorage
        const newRows = tableBody.querySelectorAll('tr');
        const artistHits = DataStore.getArtistHits();
        const hit = artistHits.find(h => h.id === hitId);
        if (hit && hit.songs) {
            const newSongs = Array.from(newRows).map((row, idx) => {
                const originalIdx = parseInt(row.dataset.originalIdx) || 0;
                return hit.songs[originalIdx] || hit.songs[idx];
            }).filter(s => s);
            
            // Store the new order based on current DOM position
            const reorderedSongs = [];
            newRows.forEach((row, newIdx) => {
                const originalIdx = parseInt(row.dataset.originalIdx);
                if (originalIdx >= 0 && originalIdx < hit.songs.length) {
                    reorderedSongs[newIdx] = hit.songs[originalIdx];
                }
            });
            
            if (reorderedSongs.length === hit.songs.length) {
                hit.songs = reorderedSongs;
                DataStore.setArtistHits(artistHits);
            }
        }
    });
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('tr:not(.drag-over)')];
        let closest = null;
        let closestOffset = Number.NEGATIVE_INFINITY;
        
        draggableElements.forEach(child => {
            const rect = child.getBoundingClientRect();
            const offset = y - (rect.top + rect.height / 2);
            if (offset < 0 && offset > closestOffset) {
                closest = child;
                closestOffset = offset;
            }
        });
        
        return closest;
    }
}

function editArtistSongInCollection(hitId, songIndex) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit || !hit.songs || !hit.songs[songIndex]) return;
    
    const song = hit.songs[songIndex];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editSongModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Song</h2>
                <button class="modal-close" onclick="document.getElementById('editSongModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="editSongForm">
                    <div class="form-group">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-input" id="editSongTitle" value="${song.title || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Artist</label>
                        <input type="text" class="form-input" id="editSongArtist" value="${song.artist || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Movie</label>
                        <input type="text" class="form-input" id="editSongMovie" value="${song.movie || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Duration</label>
                        <input type="text" class="form-input" id="editSongDuration" value="${song.duration || ''}">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('editSongModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('editSongForm').addEventListener('submit', (e) => {
        e.preventDefault();
        hit.songs[songIndex] = {
            ...song,
            title: document.getElementById('editSongTitle').value.trim(),
            artist: document.getElementById('editSongArtist').value.trim(),
            movie: document.getElementById('editSongMovie').value.trim(),
            duration: document.getElementById('editSongDuration').value.trim()
        };
        DataStore.setArtistHits(artistHits);
        showToast('Song updated!', 'success');
        modal.remove();
        renderEditArtistSongsTable(hitId);
        syncToLiveWebsite();
    });
}

function removeSongFromArtistCollection(hitId, songIndex) {
    if (!confirm('Remove this song from the collection?')) return;
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit || !hit.songs) return;
    hit.songs.splice(songIndex, 1);
    hit.songCount = hit.songs.length;
    DataStore.setArtistHits(artistHits);
    showToast('Song removed', 'success');
    renderEditArtistSongsTable(hitId);
    loadArtistHits();
    syncToLiveWebsite();
}

function addSongToArtistCollection(hitId) {
    const collectionId = hitId;
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === collectionId);
    if (!hit) {
        showToast('Artist collection not found', 'error');
        return;
    }
    if (!hit.songs) hit.songs = [];

    const songs = DataStore.getSongs();
    const songId = document.getElementById('asSong').value;
    const duration = document.getElementById('addSongDuration')?.value.trim() || document.getElementById('asDuration')?.value.trim() || '';
    const uploadedFileData = window._currentUploadedFileData || null;

    let songData;

    if (uploadedFileData) {
        console.log('Adding uploaded MP3 song to collection');
        const title = document.getElementById('asTitle')?.value.trim();
        const artist = document.getElementById('asArtist')?.value.trim();
        const movie = document.getElementById('asMovie')?.value.trim();
        if (!title || !artist) {
            showToast('Please enter title and artist', 'error');
            return;
        }
        songData = {
            songId: 'uploaded_' + Date.now(),
            id: 'uploaded_' + Date.now(),
            title: title,
            artist: artist,
            movie: movie || '',
            duration: duration || 'N/A',
            audioUrl: uploadedFileData,
            albumCover: ''
        };
    } else if (songId) {
        const song = songs.find(s => s.id === songId);
        if (!song) {
            showToast('Please select a song', 'error');
            return;
        }
        
        if (hit.songs.find(s => s.songId === song.id)) {
            showToast('Song already in this collection', 'warning');
            return;
        }
        
        songData = {
            songId: song.id,
            title: song.title,
            artist: song.artist,
            movie: song.movie,
            duration: duration || song.duration || 'N/A',
            audioUrl: song.audioUrl || '',
            albumCover: song.albumCover || ''
        };
    } else {
        showToast('Please select a song from the library or upload an MP3 file', 'error');
        return;
    }

    hit.songs.push(songData);
    hit.songCount = hit.songs.length;
    DataStore.setArtistHits(artistHits);
    showToast('Song added to collection!', 'success');
    
    // Reset form
    document.getElementById('asSong') && (document.getElementById('asSong').value = '');
    document.getElementById('asDuration') && (document.getElementById('asDuration').value = '');
    document.getElementById('addSongDuration') && (document.getElementById('addSongDuration').value = '');
    document.getElementById('asTitle') && (document.getElementById('asTitle').value = '');
    document.getElementById('asArtist') && (document.getElementById('asArtist').value = '');
    document.getElementById('asMovie') && (document.getElementById('asMovie').value = '');
    
    // Reset uploaded file data
    window._currentUploadedFileData = null;
    
    // Reset file upload area
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.innerHTML = `<i class="fas fa-cloud-upload-alt" style="font-size:24px;color:#888;margin-bottom:10px;"></i><p style="margin:5px 0;color:#888;">Drop MP3 file here or click to browse</p><p style="margin:5px 0;font-size:11px;color:#666;">MP3 format, max 10MB</p><input type="file" id="mp3FileInput" accept=".mp3,audio/*" style="display:none;">`;
    }
    
    // Switch back to manage tab
    switchArtistSongTab('manage');
    renderEditArtistSongsTable(hitId);
    loadArtistHits();
    syncToLiveWebsite();
}

function saveArtistSongs(hitId) {
    const modal = document.getElementById('editArtistSongsModal');
    if (modal) modal.remove();
    loadArtistHits();
    loadArtistSongCollections();
    syncToLiveWebsite();
    showToast('Artist songs saved and published!', 'success');
}

function setupArtistHitsSubTabs() {
    const artistHitsTab = document.getElementById('artistHitsTab');
    if (!artistHitsTab) return;

    artistHitsTab.querySelectorAll('.artist-hit-sub-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.artistTab;
            artistHitsTab.querySelectorAll('.artist-hit-sub-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const listTab = artistHitsTab.querySelector('#artistListTab');
            const songsTab = artistHitsTab.querySelector('#artistSongsTab');

            if (tabName === 'artistList') {
                if (listTab) listTab.style.display = '';
                if (songsTab) songsTab.style.display = 'none';
            } else if (tabName === 'artistSongs') {
                if (listTab) listTab.style.display = 'none';
                if (songsTab) songsTab.style.display = '';
                loadArtistSongCollections();
            }
        });
    });

    const collectionSelect = document.getElementById('artistSongCollection');
    if (collectionSelect) {
        collectionSelect.addEventListener('change', function() {
            const collectionId = this.value;
            if (collectionId) {
                loadArtistSongs(collectionId);
            } else {
                const tableBody = document.getElementById('artistSongsTable');
                if (tableBody) tableBody.innerHTML = '';
            }
        });
    }
}

// ============================================
// Quotes Management
// ============================================
function loadQuotes() {
    const quotes = DataStore.getQuotes();
    const tableBody = document.getElementById('quotesTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = quotes.map(quote => `
        <tr>
            <td>${quote.text}</td>
            <td><span class="status-badge ${quote.status === 'active' ? 'active' : 'inactive'}">${quote.status}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="editQuote('${quote.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteQuote('${quote.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddQuoteModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'quoteModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Tamil Quote</h2>
                <button class="modal-close" onclick="document.getElementById('quoteModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="quoteForm">
                    <div class="form-group">
                        <label class="form-label">Quote Text *</label>
                        <textarea class="form-textarea" id="quoteText" required rows="3" placeholder="Enter Tamil quote..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('quoteModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('quoteForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const quotes = DataStore.getQuotes();
        quotes.push({
            id: 'q_' + Date.now(),
            text: document.getElementById('quoteText').value.trim(),
            status: 'active'
        });
        DataStore.setQuotes(quotes);
        showToast('Quote added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadQuotes();
    });
}

function editQuote(id) {
    const quotes = DataStore.getQuotes();
    const quote = quotes.find(q => q.id === id);
    if (!quote) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'quoteModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Quote</h2>
                <button class="modal-close" onclick="document.getElementById('quoteModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="quoteForm">
                    <div class="form-group">
                        <label class="form-label">Quote Text *</label>
                        <textarea class="form-textarea" id="quoteText" required rows="3">${quote.text}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('quoteModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('quoteForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const idx = quotes.findIndex(q => q.id === id);
        quotes[idx] = { ...quotes[idx], text: document.getElementById('quoteText').value.trim() };
        DataStore.setQuotes(quotes);
        showToast('Quote updated!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadQuotes();
    });
}

function deleteQuote(id) {
    if (!confirm('Delete this quote?')) return;
    const quotes = DataStore.getQuotes().filter(q => q.id !== id);
    DataStore.setQuotes(quotes);
    showToast('Quote deleted', 'success');
    loadQuotes();
    syncToLiveWebsite();
}

// ============================================
// Moods & Genres Management
// ============================================
function loadMoods() {
    const moods = DataStore.getMoods();
    const tbody = document.getElementById('moodsTableBody');
    if (!tbody) return;
    tbody.innerHTML = moods.map(m => `
        <tr>
            <td style="font-size:1.5rem">${m.emoji}</td>
            <td>${m.name}</td>
            <td><div style="width:80px;height:24px;border-radius:6px;background:${m.gradient}"></div></td>
            <td><span class="status-badge ${m.status === 'active' ? 'active' : 'inactive'}">${m.status}</span></td>
            <td><div class="actions">
                <button class="builder-btn small" onclick="editMood('${m.id}')"><i class="fas fa-edit"></i></button>
                <button class="builder-btn small danger" onclick="deleteMood('${m.id}')"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`).join('');
}

function openAddMoodModal() {
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Add Mood</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return saveMood(event)"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Emoji</label><input type="text" class="form-input" id="moodEmoji" placeholder="🎵" required></div>
            <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="moodName" required></div>
            <div class="form-group"><label class="form-label">Gradient</label><input type="text" class="form-input" id="moodGradient" placeholder="linear-gradient(135deg,#6366f1,#8b5cf6)"></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Save</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveMood(e) {
    e.preventDefault();
    const moods = DataStore.getMoods();
    moods.push({ id: 'm_' + Date.now(), emoji: document.getElementById('moodEmoji').value, name: document.getElementById('moodName').value, gradient: document.getElementById('moodGradient').value || 'linear-gradient(135deg,#6366f1,#8b5cf6)', status: 'active' });
    DataStore.setMoods(moods); showToast('Mood added', 'success'); loadMoods(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function editMood(id) {
    const moods = DataStore.getMoods();
    const m = moods.find(x => x.id === id); if (!m) return;
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Edit Mood</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return updateMood(event,'${id}')"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Emoji</label><input type="text" class="form-input" id="moodEmoji" value="${m.emoji}" required></div>
            <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="moodName" value="${m.name}" required></div>
            <div class="form-group"><label class="form-label">Gradient</label><input type="text" class="form-input" id="moodGradient" value="${m.gradient}"></div>
            <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="moodStatus"><option value="active" ${m.status==='active'?'selected':''}>Active</option><option value="inactive" ${m.status==='inactive'?'selected':''}>Inactive</option></select></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Update</button></div></form></div>`;
    document.body.appendChild(modal);
}

function updateMood(e, id) {
    e.preventDefault();
    const moods = DataStore.getMoods();
    const m = moods.find(x => x.id === id); if (!m) return false;
    m.emoji = document.getElementById('moodEmoji').value;
    m.name = document.getElementById('moodName').value;
    m.gradient = document.getElementById('moodGradient').value;
    m.status = document.getElementById('moodStatus').value;
    DataStore.setMoods(moods); showToast('Mood updated', 'success'); loadMoods(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function deleteMood(id) {
    if (!confirm('Delete this mood?')) return;
    DataStore.setMoods(DataStore.getMoods().filter(m => m.id !== id));
    showToast('Mood deleted', 'success'); loadMoods(); syncToLiveWebsite();
}

// ============================================
// AI Radio Management
// ============================================
function loadAIRadio() {
    const items = DataStore.getAIRadio();
    const tbody = document.getElementById('airadioTableBody');
    if (!tbody) return;
    tbody.innerHTML = items.map(a => `
        <tr>
            <td><i class="fas ${a.icon}"></i></td>
            <td>${a.title}</td>
            <td>${a.desc}</td>
            <td>${a.filter}</td>
            <td><span class="status-badge ${a.status === 'active' ? 'active' : 'inactive'}">${a.status}</span></td>
            <td><div class="actions">
                <button class="builder-btn small" onclick="editAIRadio('${a.id}')"><i class="fas fa-edit"></i></button>
                <button class="builder-btn small danger" onclick="deleteAIRadio('${a.id}')"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`).join('');
}

function openAddAIRadioModal() {
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Add AI Radio Card</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return saveAIRadio(event)"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Icon (FA class)</label><input type="text" class="form-input" id="arIcon" placeholder="fa-sun" required></div>
            <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="arTitle" required></div>
            <div class="form-group"><label class="form-label">Description</label><input type="text" class="form-input" id="arDesc" required></div>
            <div class="form-group"><label class="form-label">Filter (genre)</label><input type="text" class="form-input" id="arFilter" placeholder="music"></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Save</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveAIRadio(e) {
    e.preventDefault();
    const items = DataStore.getAIRadio();
    items.push({ id: 'ar_' + Date.now(), icon: document.getElementById('arIcon').value, title: document.getElementById('arTitle').value, desc: document.getElementById('arDesc').value, filter: document.getElementById('arFilter').value || 'music', status: 'active' });
    DataStore.setAIRadio(items); showToast('AI Radio card added', 'success'); loadAIRadio(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function editAIRadio(id) {
    const items = DataStore.getAIRadio();
    const a = items.find(x => x.id === id); if (!a) return;
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Edit AI Radio Card</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return updateAIRadio(event,'${id}')"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Icon</label><input type="text" class="form-input" id="arIcon" value="${a.icon}" required></div>
            <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="arTitle" value="${a.title}" required></div>
            <div class="form-group"><label class="form-label">Description</label><input type="text" class="form-input" id="arDesc" value="${a.desc}" required></div>
            <div class="form-group"><label class="form-label">Filter</label><input type="text" class="form-input" id="arFilter" value="${a.filter}"></div>
            <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="arStatus"><option value="active" ${a.status==='active'?'selected':''}>Active</option><option value="inactive" ${a.status==='inactive'?'selected':''}>Inactive</option></select></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Update</button></div></form></div>`;
    document.body.appendChild(modal);
}

function updateAIRadio(e, id) {
    e.preventDefault();
    const items = DataStore.getAIRadio();
    const a = items.find(x => x.id === id); if (!a) return false;
    a.icon = document.getElementById('arIcon').value;
    a.title = document.getElementById('arTitle').value;
    a.desc = document.getElementById('arDesc').value;
    a.filter = document.getElementById('arFilter').value;
    a.status = document.getElementById('arStatus').value;
    DataStore.setAIRadio(items); showToast('AI Radio card updated', 'success'); loadAIRadio(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function deleteAIRadio(id) {
    if (!confirm('Delete this AI Radio card?')) return;
    DataStore.setAIRadio(DataStore.getAIRadio().filter(a => a.id !== id));
    showToast('AI Radio card deleted', 'success'); loadAIRadio(); syncToLiveWebsite();
}

// ============================================
// Notifications Management
// ============================================
function loadNotifications() {
    const items = DataStore.getNotifications();
    const tbody = document.getElementById('notificationsTableBody');
    if (!tbody) return;
    tbody.innerHTML = items.map(n => `
        <tr>
            <td>${n.title}</td>
            <td>${n.message}</td>
            <td><span class="status-badge">${n.type}</span></td>
            <td><span class="status-badge ${n.status === 'active' ? 'active' : 'inactive'}">${n.status}</span></td>
            <td><div class="actions">
                <button class="builder-btn small" onclick="editNotification('${n.id}')"><i class="fas fa-edit"></i></button>
                <button class="builder-btn small danger" onclick="deleteNotification('${n.id}')"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`).join('');
}

function openAddNotificationModal() {
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Add Notification</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return saveNotification(event)"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="notifTitle" required></div>
            <div class="form-group"><label class="form-label">Message</label><textarea class="form-textarea" id="notifMessage" rows="2" required></textarea></div>
            <div class="form-group"><label class="form-label">Type</label><select class="form-input" id="notifType"><option value="info">Info</option><option value="update">Update</option><option value="alert">Alert</option><option value="success">Success</option></select></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Save</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveNotification(e) {
    e.preventDefault();
    const items = DataStore.getNotifications();
    items.push({ id: 'n_' + Date.now(), title: document.getElementById('notifTitle').value, message: document.getElementById('notifMessage').value, type: document.getElementById('notifType').value, status: 'active', timestamp: Date.now() });
    DataStore.setNotifications(items); showToast('Notification added', 'success'); loadNotifications(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function editNotification(id) {
    const items = DataStore.getNotifications();
    const n = items.find(x => x.id === id); if (!n) return;
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Edit Notification</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return updateNotification(event,'${id}')"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="notifTitle" value="${n.title}" required></div>
            <div class="form-group"><label class="form-label">Message</label><textarea class="form-textarea" id="notifMessage" rows="2" required>${n.message}</textarea></div>
            <div class="form-group"><label class="form-label">Type</label><select class="form-input" id="notifType"><option value="info" ${n.type==='info'?'selected':''}>Info</option><option value="update" ${n.type==='update'?'selected':''}>Update</option><option value="alert" ${n.type==='alert'?'selected':''}>Alert</option><option value="success" ${n.type==='success'?'selected':''}>Success</option></select></div>
            <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="notifStatus"><option value="active" ${n.status==='active'?'selected':''}>Active</option><option value="inactive" ${n.status==='inactive'?'selected':''}>Inactive</option></select></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Update</button></div></form></div>`;
    document.body.appendChild(modal);
}

function updateNotification(e, id) {
    e.preventDefault();
    const items = DataStore.getNotifications();
    const n = items.find(x => x.id === id); if (!n) return false;
    n.title = document.getElementById('notifTitle').value;
    n.message = document.getElementById('notifMessage').value;
    n.type = document.getElementById('notifType').value;
    n.status = document.getElementById('notifStatus').value;
    DataStore.setNotifications(items); showToast('Notification updated', 'success'); loadNotifications(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function deleteNotification(id) {
    if (!confirm('Delete this notification?')) return;
    DataStore.setNotifications(DataStore.getNotifications().filter(n => n.id !== id));
    showToast('Notification deleted', 'success'); loadNotifications(); syncToLiveWebsite();
}

// ============================================
// Splash Screen Settings
// ============================================
function loadSplashSettings() {
    const s = DataStore.getSplash();
    document.getElementById('splashEnabled').value = s.enabled !== false ? 'true' : 'false';
    document.getElementById('splashDuration').value = s.duration || 2200;
    document.getElementById('splashLogoIcon').value = s.logoIcon || 'fa-headphones-alt';
    document.getElementById('splashTitle').value = s.title || 'Tamil AI Stream';
    document.getElementById('splashSubtitle').value = s.subtitle || 'AI-Powered Tamil Radio';
    document.getElementById('splashShowEqualizer').value = s.showEqualizer !== false ? 'true' : 'false';
    document.getElementById('splashShowParticles').value = s.showParticles !== false ? 'true' : 'false';
    document.getElementById('splashShowLoadingBar').value = s.showLoadingBar !== false ? 'true' : 'false';
    document.getElementById('splashShowSkipButton').value = s.showSkipButton !== false ? 'true' : 'false';
}

function saveSplashSettings(e) {
    e.preventDefault();
    DataStore.setSplash({
        enabled: document.getElementById('splashEnabled').value === 'true',
        duration: parseInt(document.getElementById('splashDuration').value) || 2200,
        logoIcon: document.getElementById('splashLogoIcon').value,
        title: document.getElementById('splashTitle').value,
        subtitle: document.getElementById('splashSubtitle').value,
        showEqualizer: document.getElementById('splashShowEqualizer').value === 'true',
        showParticles: document.getElementById('splashShowParticles').value === 'true',
        showLoadingBar: document.getElementById('splashShowLoadingBar').value === 'true',
        showSkipButton: document.getElementById('splashShowSkipButton').value === 'true'
    });
    showToast('Splash settings saved', 'success');
    syncToLiveWebsite();
    return false;
}

// ============================================
// Player Preferences
// ============================================
function loadPlayerPrefs() {
    const p = DataStore.getPlayerPrefs();
    document.getElementById('prefAutoplay').value = p.autoplay !== false ? 'true' : 'false';
    document.getElementById('prefCrossfade').value = p.crossfade ? 'true' : 'false';
    document.getElementById('prefCrossfadeDuration').value = p.crossfadeDuration || 2;
    document.getElementById('prefDefaultVolume').value = p.defaultVolume || 0.8;
    document.getElementById('prefEqPreset').value = p.eqPreset || 'flat';
    document.getElementById('prefBassBoost').value = p.bassBoost || 0;
    document.getElementById('prefTrebleBoost').value = p.trebleBoost || 0;
    document.getElementById('prefVocalBoost').value = p.vocalBoost || 0;
    document.getElementById('prefStereoBalance').value = p.stereoBalance || 0;
    document.getElementById('prefLoudnessNorm').value = p.loudnessNorm ? 'true' : 'false';
    document.getElementById('prefSurroundEffect').value = p.surroundEffect ? 'true' : 'false';
}

function savePlayerPrefs(e) {
    e.preventDefault();
    DataStore.setPlayerPrefs({
        autoplay: document.getElementById('prefAutoplay').value === 'true',
        crossfade: document.getElementById('prefCrossfade').value === 'true',
        crossfadeDuration: parseFloat(document.getElementById('prefCrossfadeDuration').value) || 2,
        defaultVolume: parseFloat(document.getElementById('prefDefaultVolume').value) || 0.8,
        eqPreset: document.getElementById('prefEqPreset').value,
        bassBoost: parseInt(document.getElementById('prefBassBoost').value) || 0,
        trebleBoost: parseInt(document.getElementById('prefTrebleBoost').value) || 0,
        vocalBoost: parseInt(document.getElementById('prefVocalBoost').value) || 0,
        stereoBalance: parseFloat(document.getElementById('prefStereoBalance').value) || 0,
        loudnessNorm: document.getElementById('prefLoudnessNorm').value === 'true',
        surroundEffect: document.getElementById('prefSurroundEffect').value === 'true'
    });
    showToast('Player settings saved', 'success');
    syncToLiveWebsite();
    return false;
}

// ============================================
// Navigation Settings
// ============================================
function loadNavigation() {
    const n = DataStore.getNavigation();
    document.getElementById('navShowHome').value = n.showHome !== false ? 'true' : 'false';
    document.getElementById('navShowExplore').value = n.showExplore !== false ? 'true' : 'false';
    document.getElementById('navShowLibrary').value = n.showLibrary !== false ? 'true' : 'false';
    document.getElementById('navShowSearch').value = n.showSearch !== false ? 'true' : 'false';
    document.getElementById('navShowLiked').value = n.showLiked !== false ? 'true' : 'false';
    document.getElementById('navShowStations').value = n.showStations !== false ? 'true' : 'false';
    document.getElementById('navShowArtists').value = n.showArtists !== false ? 'true' : 'false';
    document.getElementById('navShowHistory').value = n.showHistory !== false ? 'true' : 'false';
    document.getElementById('navShowPlaylists').value = n.showPlaylists !== false ? 'true' : 'false';
}

function saveNavigation(e) {
    e.preventDefault();
    DataStore.setNavigation({
        showHome: document.getElementById('navShowHome').value === 'true',
        showExplore: document.getElementById('navShowExplore').value === 'true',
        showLibrary: document.getElementById('navShowLibrary').value === 'true',
        showSearch: document.getElementById('navShowSearch').value === 'true',
        showLiked: document.getElementById('navShowLiked').value === 'true',
        showStations: document.getElementById('navShowStations').value === 'true',
        showArtists: document.getElementById('navShowArtists').value === 'true',
        showHistory: document.getElementById('navShowHistory').value === 'true',
        showPlaylists: document.getElementById('navShowPlaylists').value === 'true'
    });
    showToast('Navigation settings saved', 'success');
    syncToLiveWebsite();
    return false;
}

// ============================================
// Home Sections Order
// ============================================
function loadSectionsOrder() {
    const sections = DataStore.getSectionsOrder();
    const list = document.getElementById('sectionsList');
    if (!list) return;
    list.innerHTML = sections.sort((a, b) => a.order - b.order).map(s => `
        <div class="section-drag-item" data-id="${s.id}" draggable="true">
            <div class="section-drag-handle"><i class="fas fa-grip-vertical"></i></div>
            <div class="section-drag-info">
                <span class="section-drag-name">${s.name}</span>
                <span class="section-drag-order">#${s.order}</span>
            </div>
            <label class="section-toggle">
                <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleSection('${s.id}', this.checked)">
                <span class="section-toggle-slider"></span>
            </label>
        </div>`).join('');
    setupDragAndDrop();
}

function toggleSection(id, enabled) {
    const sections = DataStore.getSectionsOrder();
    const s = sections.find(x => x.id === id);
    if (s) { s.enabled = enabled; DataStore.setSectionsOrder(sections); }
}

function setupDragAndDrop() {
    const list = document.getElementById('sectionsList');
    if (!list) return;
    let dragItem = null;
    list.querySelectorAll('.section-drag-item').forEach(item => {
        item.addEventListener('dragstart', e => { dragItem = item; item.classList.add('dragging'); });
        item.addEventListener('dragend', () => { dragItem?.classList.remove('dragging'); dragItem = null; updateSectionOrders(); });
        item.addEventListener('dragover', e => { e.preventDefault(); if (dragItem && dragItem !== item) {
            const rect = item.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) list.insertBefore(dragItem, item);
            else list.insertBefore(dragItem, item.nextSibling);
        }});
    });
}

function updateSectionOrders() {
    const items = document.querySelectorAll('.section-drag-item');
    const sections = DataStore.getSectionsOrder();
    items.forEach((item, i) => {
        const id = item.dataset.id;
        const s = sections.find(x => x.id === id);
        if (s) s.order = i + 1;
        item.querySelector('.section-drag-order').textContent = '#' + (i + 1);
    });
    DataStore.setSectionsOrder(sections);
}

function saveSectionsOrder() {
    updateSectionOrders();
    showToast('Sections order saved', 'success');
    syncToLiveWebsite();
}

// ============================================
// Site Settings Management
// ============================================
function loadSettings() {
    const settings = DataStore.getSiteSettings();
    document.getElementById('settingsTitle').value = settings.title || '';
    document.getElementById('settingsDescription').value = settings.description || '';
    document.getElementById('settingsKeywords').value = settings.keywords || '';
    document.getElementById('settingsOgTitle').value = settings.ogTitle || '';
    document.getElementById('settingsOgUrl').value = settings.ogUrl || '';
    document.getElementById('settingsOgDescription').value = settings.ogDescription || '';
    document.getElementById('settingsThemeColor').value = settings.themeColor || '#000000';
    document.getElementById('settingsFooterText').value = settings.footerText || '';
}

function saveSettings(e) {
    e.preventDefault();
    const settings = {
        title: document.getElementById('settingsTitle').value.trim(),
        description: document.getElementById('settingsDescription').value.trim(),
        keywords: document.getElementById('settingsKeywords').value.trim(),
        ogTitle: document.getElementById('settingsOgTitle').value.trim(),
        ogUrl: document.getElementById('settingsOgUrl').value.trim(),
        ogDescription: document.getElementById('settingsOgDescription').value.trim(),
        themeColor: document.getElementById('settingsThemeColor').value,
        footerText: document.getElementById('settingsFooterText').value.trim()
    };
    DataStore.setSiteSettings(settings);
    showToast('Settings saved!', 'success');
    syncToLiveWebsite();
    addActivity('Settings Updated', 'Site settings have been saved');
}

// ============================================
// Dashboard Stats
// ============================================
// Main Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Require a valid session before allowing access to the Builder.
    // (A user with NO session is sent to login.html; admins/logged-in users
    //  continue to the builder's own admin login screen if needed.)
    setupLoginScreen();
    
    const user = await checkAuth();
    
    if (user) {
        showBuilderDashboard(user);
    } else {
        showLoginScreen();
    }

    const mobileToggle = document.getElementById('builderMobileToggle');
    const sidebar = document.querySelector('.builder-sidebar');
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            const icon = mobileToggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && e.target !== mobileToggle && !mobileToggle.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
                const icon = mobileToggle.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        });
        sidebar.querySelectorAll('.builder-sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                const icon = mobileToggle.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            });
        });
    }
});

// ============================================
// Visual Editor � Comprehensive Implementation
// ============================================
let veInitialized = false;
let veIframe = null;
let veIframeDoc = null;
let veSelectedElement = null;
let veSelectedSelector = '';
let veCurrentDevice = 'desktop';
let veZoom = 100;
let veUndoStack = [];
let veRedoStack = [];
let veMaxHistory = 50;
let veOverrides = {};
let veCurrentBreakpoint = 'desktop';
let veAllElements = [];
let veVisibleElements = [];
let veTreeSearchTerm = '';
let veHistoryEntries = [];
let veIsDragging = false;
let veDragStartX = 0;
let veDragStartY = 0;
let veDragOrigX = 0;
let veDragOrigY = 0;
let veResizing = false;
let veResizeHandle = '';
let veResizeStartX = 0;
let veResizeStartY = 0;
let veResizeOrigRect = null;
let veGridEnabled = false;
let veGuidesEnabled = true;
let veSnapThreshold = 5;
let veElementCount = 0;

function initVisualEditor() {
    if (veInitialized) {
        if (veIframe && veIframeDoc) scanIframeElements();
        return;
    }
    veInitialized = true;

    veIframe = document.getElementById('veFrame');
    if (!veIframe) return;

    veIframe.addEventListener('load', onVEIframeLoad);

    if (veIframe.contentDocument && veIframe.contentDocument.body) {
        onVEIframeLoad();
    } else {
        setTimeout(onVEIframeLoad, 1000);
    }

    bindVisualEditorEvents();
    loadVEDraft();
    initV2Enhancements();
}
function initVisualEditor() {
    if (veInitialized) {
        // Re-scan if revisited
        if (veIframe && veIframeDoc) scanIframeElements();
        return;
    }
    veInitialized = true;

    veIframe = document.getElementById('veFrame');
    if (!veIframe) return;

    veIframe.addEventListener('load', onVEIframeLoad);

    // Handle already-loaded iframe (cached)
    if (veIframe.contentDocument && veIframe.contentDocument.body) {
        onVEIframeLoad();
    } else {
        setTimeout(onVEIframeLoad, 1000);
    }

    bindVisualEditorEvents();
    loadVEDraft();
}

function onVEIframeLoad() {
    try {
        veIframeDoc = veIframe.contentDocument || veIframe.contentWindow?.document;
        if (!veIframeDoc || !veIframeDoc.body) {
            setTimeout(onVEIframeLoad, 500);
            return;
        }
        scanIframeElements();
        setupIframeInteraction();
        addVEHistoryEntry('Page loaded');
    } catch (err) {
        console.warn('[VE] iframe access error, retrying:', err);
        setTimeout(onVEIframeLoad, 1000);
    }
}

function bindVisualEditorEvents() {
    document.querySelectorAll('.ve-device-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ve-device-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setVEDevice(btn.dataset.veDevice);
        });
    });

    document.getElementById('veZoomIn')?.addEventListener('click', () => setVEZoom(veZoom + 10));
    document.getElementById('veZoomOut')?.addEventListener('click', () => setVEZoom(veZoom - 10));
    document.getElementById('veZoomFit')?.addEventListener('click', () => setVEZoom(100));
    document.getElementById('veToggleGrid')?.addEventListener('click', toggleVEGrid);
    document.getElementById('veToggleGuides')?.addEventListener('click', toggleVEGuides);
    document.getElementById('veUndoBtn')?.addEventListener('click', veUndo);
    document.getElementById('veRedoBtn')?.addEventListener('click', veRedo);
    document.getElementById('veSaveDraft')?.addEventListener('click', saveVEDraft);
    document.getElementById('vePublishBtn')?.addEventListener('click', publishVEChanges);
    document.getElementById('veCloseProps')?.addEventListener('click', clearVESelection);

    // Panel Undo/Redo/Save buttons (Layers tab)
    document.getElementById('vePanelUndo')?.addEventListener('click', veUndo);
    document.getElementById('vePanelRedo')?.addEventListener('click', veRedo);
    document.getElementById('vePanelSave')?.addEventListener('click', saveVEDraft);
    // Panel Undo/Redo/Save buttons (Components tab)
    document.getElementById('vePanelUndo2')?.addEventListener('click', veUndo);
    document.getElementById('vePanelRedo2')?.addEventListener('click', veRedo);
    document.getElementById('vePanelSave2')?.addEventListener('click', saveVEDraft);

    document.querySelectorAll('.ve-panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.veLtab;
            tab.parentElement.querySelectorAll('.ve-panel-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.ve-panel-content').forEach(c => c.style.display = 'none');
            if (tabId === 'layers') document.getElementById('veLayersTab').style.display = '';
            else if (tabId === 'components') document.getElementById('veComponentsTab').style.display = '';
            else if (tabId === 'history') document.getElementById('veHistoryTab').style.display = '';
        });
    });

    document.querySelectorAll('.ve-resp-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ve-resp-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            veCurrentBreakpoint = tab.dataset.veResp;
            if (veSelectedElement) showVEProperties(veSelectedSelector);
        });
    });

    document.getElementById('veLayerSearch')?.addEventListener('input', (e) => {
        veTreeSearchTerm = e.target.value.toLowerCase();
        renderVEElementTree();
    });

    document.getElementById('veExpandAll')?.addEventListener('click', () => {
        document.querySelectorAll('.ve-tree-node.collapsed').forEach(n => n.classList.remove('collapsed'));
    });
    document.getElementById('veCollapseAll')?.addEventListener('click', () => {
        document.querySelectorAll('.ve-tree-node').forEach(n => n.classList.add('collapsed'));
    });

    document.getElementById('veActDuplicate')?.addEventListener('click', veDuplicateElement);
    document.getElementById('veActDelete')?.addEventListener('click', veDeleteElement);
    document.getElementById('veActHide')?.addEventListener('click', veToggleHide);
    document.getElementById('veActLock')?.addEventListener('click', veToggleLock);
    document.getElementById('veActMoveUp')?.addEventListener('click', () => veMoveElement('up'));
    document.getElementById('veActMoveDown')?.addEventListener('click', () => veMoveElement('down'));
    document.getElementById('veActWrap')?.addEventListener('click', veWrapInContainer);
    document.getElementById('veActEditHTML')?.addEventListener('click', veEditHTML);

    setupComponentDrag();

    document.addEventListener('keydown', (e) => {
        const vePage = document.getElementById('visualeditorPage');
        if (!vePage || vePage.style.display === 'none') return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); veUndo(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); veRedo(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveVEDraft(); }
        if (e.key === 'Escape') clearVESelection();
        if (e.key === 'Delete' && veSelectedElement && !e.target.matches('input, textarea, select')) { e.preventDefault(); veDeleteElement(); }
        if (e.key === 'd' && (e.ctrlKey || e.metaKey) && veSelectedElement) { e.preventDefault(); veDuplicateElement(); }
    });
}

// --- Device / Zoom ---
function setVEDevice(device) {
    veCurrentDevice = device;
    const wrapper = document.getElementById('veCanvasWrapper');
    const label = document.getElementById('veDeviceLabel');
    if (!wrapper) return;
    const widths = { desktop: '100%', tablet: '768px', mobile: '375px' };
    const labels = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
    veIframe.style.width = widths[device] || '100%';
    veIframe.style.maxWidth = '100%';
    wrapper.style.justifyContent = device === 'desktop' ? 'stretch' : 'center';
    if (label) label.textContent = labels[device] || device;

    // Reload iframe to ensure fresh content rendered for the selected device viewport
    const currentSrc = veIframe.src;
    veIframe.src = 'about:blank';
    setTimeout(() => {
        veIframe.src = currentSrc;
    }, 100);

    updateVEStatusBar();
}

function setVEZoom(level) {
    veZoom = Math.max(25, Math.min(200, level));
    const label = document.getElementById('veZoomLabel');
    if (label) label.textContent = veZoom + '%';
    veIframe.style.transform = `scale(${veZoom / 100})`;
    veIframe.style.transformOrigin = 'top center';
    updateVEOverlay();
}

function toggleVEGrid() {
    veGridEnabled = !veGridEnabled;
    const grid = document.getElementById('veSnapGrid');
    const btn = document.getElementById('veToggleGrid');
    if (grid) grid.style.display = veGridEnabled ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', veGridEnabled);
}

function toggleVEGuides() {
    veGuidesEnabled = !veGuidesEnabled;
    const btn = document.getElementById('veToggleGuides');
    if (btn) btn.classList.toggle('active', veGuidesEnabled);
}

// --- Element scanning ---
function scanIframeElements() {
    if (!veIframeDoc || !veIframeDoc.body) return;
    veAllElements = [];
    veElementCount = 0;

    const SKIP_SELF = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE']);
    const SKIP_IDS = new Set(['splashOverlay', 'eqOverlay', 'mapMiniPlayer']);

    const walker = (node, depth, parentPath) => {
        if (node.nodeType !== 1) return;
        const el = node;
        if (SKIP_SELF.has(el.tagName)) return;
        if (el.id && SKIP_IDS.has(el.id)) return;
        if (el.classList?.contains('toast-container') || el.classList?.contains('splash-screen')) return;

        const path = parentPath ? parentPath + ' > ' + getVEShortSelector(el) : getVEShortSelector(el);
        const tag = el.tagName.toLowerCase();
        const id = el.id || '';
        const cls = (typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '');
        const hasChildren = el.children.length > 0;
        const hidden = el.style.display === 'none' || el.hidden;
        const locked = el.dataset.veLocked === 'true';

        veAllElements.push({ el, tag, id, cls, depth, path, hasChildren, hidden, locked });
        veElementCount++;

        for (const child of el.children) {
            walker(child, depth + 1, path);
        }
    };

    for (const child of veIframeDoc.body.children) {
        walker(child, 0, '');
    }

    renderVEElementTree();
    renderVESections();
    updateVEStatusBar();
}

function getVEShortSelector(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string') {
        s += '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    }
    return s;
}

function getVEUniqueSelector(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    let current = el;
    while (current && current !== veIframeDoc.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) { selector = '#' + current.id; parts.unshift(selector); break; }
        if (current.className && typeof current.className === 'string') {
            const cls = current.className.trim().split(/\s+/).slice(0, 2).map(c => '.' + c).join('');
            selector += cls;
        }
        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
            if (siblings.length > 1) {
                const idx = siblings.indexOf(current) + 1;
                selector += ':nth-of-type(' + idx + ')';
            }
        }
        parts.unshift(selector);
        current = current.parentElement;
    }
    return parts.join(' > ');
}

// --- Layers tree ---
function renderVEElementTree() {
    const tree = document.getElementById('veElementTree');
    if (!tree) return;

    let html = '';
    let visibleIdx = 0;
    veVisibleElements = [];

    for (const item of veAllElements) {
        const matchSearch = !veTreeSearchTerm ||
            item.tag.includes(veTreeSearchTerm) ||
            item.id.toLowerCase().includes(veTreeSearchTerm) ||
            item.cls.toLowerCase().includes(veTreeSearchTerm) ||
            item.path.toLowerCase().includes(veTreeSearchTerm);

        if (!matchSearch && veTreeSearchTerm) continue;

        veVisibleElements.push(item);
        const isSelected = veSelectedElement === item.el;
        const indent = Math.min(item.depth, 8) * 14;

        html += `<div class="ve-tree-item${isSelected ? ' selected' : ''}${item.hidden ? ' ve-hidden-el' : ''}${item.locked ? ' ve-locked-el' : ''}"
            style="padding-left:${indent + 8}px" data-ve-tree-idx="${visibleIdx}" title="${item.path}">
            <span class="ve-tree-icon"><i class="fas ${veGetTagIcon(item.tag)}"></i></span>
            <span class="ve-tree-tag">&lt;${item.tag}&gt;</span>
            ${item.id ? '<span class="ve-tree-id">#' + item.id + '</span>' : ''}
            ${item.cls ? '<span class="ve-tree-cls">.' + item.cls + '</span>' : ''}
            ${item.hidden ? '<i class="fas fa-eye-slash" style="opacity:0.4;margin-left:auto"></i>' : ''}
            ${item.locked ? '<i class="fas fa-lock" style="opacity:0.4;margin-left:2px"></i>' : ''}
        </div>`;
        visibleIdx++;
    }

    tree.innerHTML = html || '<div class="ve-empty-hint"><i class="fas fa-search"></i><p>No elements found</p></div>';

    // Event delegation for tree item clicks
    tree.onclick = (e) => {
        const item = e.target.closest('.ve-tree-item');
        if (!item) return;
        const idx = parseInt(item.dataset.veTreeIdx, 10);
        if (!isNaN(idx) && veVisibleElements[idx]) {
            selectVEElement(veVisibleElements[idx].el);
        }
    };
}

function veGetTagIcon(tag) {
    const icons = {
        header: 'fa-heading', nav: 'fa-bars', main: 'fa-desktop', section: 'fa-square',
        div: 'fa-table-cells', footer: 'fa-shoe-prints',
        h1: 'fa-heading', h2: 'fa-heading', h3: 'fa-heading', h4: 'fa-heading', h5: 'fa-heading', h6: 'fa-heading',
        p: 'fa-paragraph', a: 'fa-link', button: 'fa-button-pointer', img: 'fa-image',
        video: 'fa-video', audio: 'fa-music', form: 'fa-form', input: 'fa-i-cursor',
        ul: 'fa-list', ol: 'fa-list-ol', li: 'fa-list-item', table: 'fa-table',
        canvas: 'fa-paint-roller', svg: 'fa-bezier-curve', i: 'fa-icons', span: 'fa-font',
        label: 'fa-tag', select: 'fa-caret-down', option: 'fa-caret-down',
        textarea: 'fa-i-cursor', iframe: 'fa-window-maximize', picture: 'fa-image',
        source: 'fa-link', strong: 'fa-bold', em: 'fa-italic', br: 'fa-corner-down-left'
    };
    return icons[tag] || 'fa-code';
}

function renderVESections() {
    if (!veIframeDoc) return;

    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);

    const buildItem = (el, i) => {
        const label = el.getAttribute('data-section') || el.id || el.className?.split(' ')[0] || el.tagName.toLowerCase() + ' ' + (i + 1);
        const tag = el.tagName.toLowerCase();
        const isHidden = el.style.display === 'none' || el.hidden;
        const isSelected = veSelectedElement === el;
        return { el, label, tag, isHidden, isSelected, idx: i };
    };

    // 1. Components tab
    const compList = document.getElementById('veSectionsComponentList');
    if (compList) {
        if (meaningful.length === 0) {
            compList.innerHTML = '<div class="ve-empty-hint"><i class="fas fa-layer-group"></i><p>No sections found</p></div>';
        } else {
            compList.innerHTML = meaningful.map((el, i) => {
                const s = buildItem(el, i);
                const icon = veGetSectionIcon(s.label);
                return `<div class="ve-section-comp-item${s.isSelected ? ' selected' : ''}${s.isHidden ? ' ve-hidden-section' : ''}" data-ve-sec-idx="${s.idx}">
                    <i class="${icon} ve-section-comp-icon"></i>
                    <span class="ve-section-comp-label">${s.label}</span>
                    <span class="ve-section-comp-tag">&lt;${s.tag}&gt;</span>
                    <div class="ve-section-comp-actions">
                        <button class="ve-sec-act-btn" title="Toggle Visibility" data-action="toggle-vis" data-idx="${s.idx}"><i class="fas ${s.isHidden ? 'fa-eye-slash' : 'fa-eye'} ve-sec-vis-icon"></i></button>
                        <button class="ve-sec-act-btn" title="Duplicate" data-action="duplicate" data-idx="${s.idx}"><i class="fas fa-copy"></i></button>
                        <button class="ve-sec-act-btn" title="Move Up" data-action="move-up" data-idx="${s.idx}"><i class="fas fa-arrow-up"></i></button>
                        <button class="ve-sec-act-btn" title="Move Down" data-action="move-down" data-idx="${s.idx}"><i class="fas fa-arrow-down"></i></button>
                        <button class="ve-sec-act-btn" title="Edit HTML" data-action="edit-html" data-idx="${s.idx}"><i class="fas fa-code"></i></button>
                        <button class="ve-sec-act-btn ve-sec-delete" title="Delete" data-action="delete" data-idx="${s.idx}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
            }).join('');
        }
        compList.onclick = (e) => {
            const btn = e.target.closest('.ve-sec-act-btn');
            if (btn) { e.stopPropagation(); handleSectionAction(btn.dataset.action, parseInt(btn.dataset.idx, 10)); return; }
            const item = e.target.closest('.ve-section-comp-item');
            if (item) veSelectSection(parseInt(item.dataset.veSecIdx, 10));
        };
    }

    // 2. Sections Order panel
    const orderList = document.getElementById('veSectionsList');
    if (orderList) {
        if (meaningful.length === 0) {
            orderList.innerHTML = '<div class="ve-empty-hint"><p>No sections</p></div>';
        } else {
            orderList.innerHTML = meaningful.map((el, i) => {
                const s = buildItem(el, i);
                return `<div class="ve-section-order-item${s.isSelected ? ' selected' : ''}${s.isHidden ? ' ve-hidden-section' : ''}" data-ve-sec-idx="${s.idx}">
                    <span class="ve-section-order-num">#${i + 1}</span>
                    <span class="ve-section-order-label">${s.label}</span>
                    <div class="ve-section-order-actions">
                        <button class="ve-sec-act-btn" title="Toggle Visibility" data-action="toggle-vis" data-idx="${s.idx}"><i class="fas ${s.isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                        <button class="ve-sec-act-btn" title="Move Up" data-action="move-up" data-idx="${s.idx}"><i class="fas fa-arrow-up"></i></button>
                        <button class="ve-sec-act-btn" title="Move Down" data-action="move-down" data-idx="${s.idx}"><i class="fas fa-arrow-down"></i></button>
                    </div>
                </div>`;
            }).join('');
        }
        orderList.onclick = (e) => {
            const btn = e.target.closest('.ve-sec-act-btn');
            if (btn) { e.stopPropagation(); handleSectionAction(btn.dataset.action, parseInt(btn.dataset.idx, 10)); return; }
            const item = e.target.closest('.ve-section-order-item');
            if (item) veSelectSection(parseInt(item.dataset.veSecIdx, 10));
        };
    }
}

function handleSectionAction(action, idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    switch (action) {
        case 'toggle-vis': veToggleSectionVisibility(idx); break;
        case 'duplicate': veDuplicateSection(idx); break;
        case 'move-up': veMoveSection(idx, 'up'); break;
        case 'move-down': veMoveSection(idx, 'down'); break;
        case 'edit-html': selectVEElement(el); veEditHTML(); break;
        case 'delete': veDeleteSection(idx); break;
    }
}

function veGetSectionIcon(label) {
    const l = label.toLowerCase();
    if (l.includes('header') || l.includes('nav') || l.includes('top')) return 'fas fa-bars';
    if (l.includes('hero') || l.includes('banner') || l.includes('splash')) return 'fas fa-star';
    if (l.includes('station') || l.includes('fm') || l.includes('radio')) return 'fas fa-broadcast-tower';
    if (l.includes('song') || l.includes('music') || l.includes('track')) return 'fas fa-music';
    if (l.includes('artist') || l.includes('singer')) return 'fas fa-user';
    if (l.includes('chart') || l.includes('top') || l.includes('trending')) return 'fas fa-ranking-star';
    if (l.includes('featured') || l.includes('curated') || l.includes('made')) return 'fas fa-sparkles';
    if (l.includes('new') || l.includes('release') || l.includes('recent')) return 'fas fa-clock-rotate-left';
    if (l.includes('search') || l.includes('filter')) return 'fas fa-search';
    if (l.includes('player') || l.includes('mini')) return 'fas fa-headphones';
    if (l.includes('footer')) return 'fas fa-shoe-prints';
    if (l.includes('ticker') || l.includes('marquee')) return 'fas fa-scroll';
    if (l.includes('category') || l.includes('genre') || l.includes('mood')) return 'fas fa-grip';
    if (l.includes('ai') || l.includes('assist')) return 'fas fa-robot';
    return 'fas fa-layer-group';
}

function veSelectTreeItem(idx) {
    const item = veVisibleElements[idx];
    if (!item) return;
    selectVEElement(item.el);
}

function veSelectSection(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    if (meaningful[idx]) { selectVEElement(meaningful[idx]); renderVESections(); }
}

function veToggleSectionVisibility(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    pushVEUndo('Toggle section visibility');
    const isHidden = el.style.display === 'none' || el.hidden;
    el.style.display = isHidden ? '' : 'none';
    addVEHistoryEntry((isHidden ? 'Showed ' : 'Hidden ') + (el.getAttribute('data-section') || el.id || 'section'));
    scanIframeElements();
}

function veDuplicateSection(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    pushVEUndo('Duplicate section');
    const clone = el.cloneNode(true);
    clone.removeAttribute('id');
    el.parentElement.insertBefore(clone, el.nextSibling);
    addVEHistoryEntry('Duplicated ' + (el.getAttribute('data-section') || el.id || 'section'));
    scanIframeElements();
    selectVEElement(clone);
}

function veMoveSection(idx, dir) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el || !el.parentElement) return;
    pushVEUndo('Move section ' + dir);
    if (dir === 'up' && el.previousElementSibling) el.parentElement.insertBefore(el, el.previousElementSibling);
    else if (dir === 'down' && el.nextElementSibling) el.parentElement.insertBefore(el.nextElementSibling, el);
    addVEHistoryEntry('Moved section ' + dir);
    scanIframeElements();
}

function veEditSectionHTML(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    selectVEElement(el);
    veEditHTML();
}

function veDeleteSection(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    const label = el.getAttribute('data-section') || el.id || 'section';
    if (!confirm('Delete section "' + label + '"? This can be undone with Ctrl+Z.')) return;
    pushVEUndo('Delete section');
    el.remove();
    addVEHistoryEntry('Deleted section: ' + label);
    scanIframeElements();
    clearVESelection();
}

// --- Iframe interaction ---
function setupIframeInteraction() {
    if (!veIframeDoc) return;

    veIframeDoc.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target;
        if (!target || target === veIframeDoc.body) { clearVESelection(); return; }
        selectVEElement(target);
    });

    veIframeDoc.addEventListener('mousedown', (e) => {
        if (!veSelectedElement || e.target !== veSelectedElement) return;
        const rect = veSelectedElement.getBoundingClientRect();
        const handles = { 'n': 'top', 's': 'bottom', 'e': 'right', 'w': 'left',
            'ne': 'top-right', 'nw': 'top-left', 'se': 'bottom-right', 'sw': 'bottom-left' };
        const targetClass = e.target?.className || '';
        let matchedHandle = null;
        for (const h of Object.keys(handles)) { if (targetClass.includes(' ' + h) || targetClass === h) { matchedHandle = h; break; } }
        if (matchedHandle) {
            veResizing = true;
            veResizeHandle = handles[matchedHandle];
            veResizeStartX = e.clientX;
            veResizeStartY = e.clientY;
            veResizeOrigRect = rect;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        veIsDragging = true;
        veDragStartX = e.clientX;
        veDragStartY = e.clientY;
        veDragOrigX = parseFloat(veSelectedElement.style.left) || 0;
        veDragOrigY = parseFloat(veSelectedElement.style.top) || 0;
        veSelectedElement.style.position = veSelectedElement.style.position || 'relative';
        e.preventDefault();
        e.stopPropagation();
    });

    veIframeDoc.addEventListener('mousemove', (e) => {
        if (veIsDragging && veSelectedElement) {
            const dx = (e.clientX - veDragStartX) / (veZoom / 100);
            const dy = (e.clientY - veDragStartY) / (veZoom / 100);
            const newX = Math.round(veDragOrigX + dx);
            const newY = Math.round(veDragOrigY + dy);
            veSelectedElement.style.left = newX + 'px';
            veSelectedElement.style.top = newY + 'px';
            updateVEOverlay();
            if (veGuidesEnabled) showVESnapGuides(veSelectedElement);
        }
        if (veResizing && veSelectedElement) {
            const dx = (e.clientX - veResizeStartX) / (veZoom / 100);
            const dy = (e.clientY - veResizeStartY) / (veZoom / 100);
            veApplyResize(veResizeHandle, dx, dy);
            updateVEOverlay();
        }
    });

    veIframeDoc.addEventListener('mouseup', () => {
        if (veIsDragging) {
            veIsDragging = false;
            hideVESnapGuides();
            if (veSelectedSelector) {
                const bp = veCurrentBreakpoint;
                if (!veOverrides[veSelectedSelector]) veOverrides[veSelectedSelector] = {};
                if (!veOverrides[veSelectedSelector][bp]) veOverrides[veSelectedSelector][bp] = {};
                veOverrides[veSelectedSelector][bp].left = veSelectedElement.style.left;
                veOverrides[veSelectedSelector][bp].top = veSelectedElement.style.top;
            }
        }
        if (veResizing) {
            veResizing = false;
            if (veSelectedSelector) {
                const bp = veCurrentBreakpoint;
                if (!veOverrides[veSelectedSelector]) veOverrides[veSelectedSelector] = {};
                if (!veOverrides[veSelectedSelector][bp]) veOverrides[veSelectedSelector][bp] = {};
                veOverrides[veSelectedSelector][bp].width = veSelectedElement.style.width;
                veOverrides[veSelectedSelector][bp].height = veSelectedElement.style.height;
            }
        }
    });
}

function veApplyResize(handle, dx, dy) {
    if (!veSelectedElement || !veResizeOrigRect) return;
    const el = veSelectedElement;
    const orig = veResizeOrigRect;
    const w = orig.width;
    const h = orig.height;

    if (handle.includes('right')) el.style.width = Math.max(20, Math.round(w + dx)) + 'px';
    if (handle.includes('left')) { el.style.width = Math.max(20, Math.round(w - dx)) + 'px'; el.style.left = Math.round(veDragOrigX + dx) + 'px'; }
    if (handle.includes('bottom')) el.style.height = Math.max(20, Math.round(h + dy)) + 'px';
    if (handle.includes('top')) { el.style.height = Math.max(20, Math.round(h - dy)) + 'px'; el.style.top = Math.round(veDragOrigY + dy) + 'px'; }
}

function showVESnapGuides(el) {
    if (!el || !veIframeDoc) return;
    const rect = el.getBoundingClientRect();
    const iframeRect = veIframe.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - iframeRect.left;
    const cy = rect.top + rect.height / 2 - iframeRect.top;
    const guideH = document.getElementById('veGuideH');
    const guideV = document.getElementById('veGuideV');
    const iframeW = iframeRect.width;

    if (guideV && Math.abs(cx - iframeW / 2) < veSnapThreshold) {
        guideV.style.display = 'block';
        guideV.style.left = (iframeW / 2) + 'px';
    } else if (guideV) guideV.style.display = 'none';

    if (guideH && Math.abs(cy - 30) < veSnapThreshold) {
        guideH.style.display = 'block';
        guideH.style.top = '30px';
    } else if (guideH) guideH.style.display = 'none';
}

function hideVESnapGuides() {
    document.getElementById('veGuideH').style.display = 'none';
    document.getElementById('veGuideV').style.display = 'none';
}

// --- Selection ---
function selectVEElement(el) {
    clearVEOverlay();
    veSelectedElement = el;
    veSelectedSelector = getVEUniqueSelector(el);
    updateVEOverlay();
    showVEProperties(veSelectedSelector);
    updateVEActionsBar(true);
    highlightVETreeItem();
    renderVESections();
    updateVEStatusBar();
}

function updateVEOverlay() {
    if (!veSelectedElement || !veIframe) return;
    const rect = veSelectedElement.getBoundingClientRect();
    const iframeRect = veIframe.getBoundingClientRect();
    const overlay = document.getElementById('veOverlay');
    if (!overlay) return;

    overlay.style.display = 'block';
    overlay.style.left = (rect.left - iframeRect.left + veIframe.contentWindow.scrollX) + 'px';
    overlay.style.top = (rect.top - iframeRect.top + veIframe.contentWindow.scrollY) + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    overlay.innerHTML = `<div class="ve-resize-handle n"></div><div class="ve-resize-handle s"></div>
        <div class="ve-resize-handle e"></div><div class="ve-resize-handle w"></div>
        <div class="ve-resize-handle ne"></div><div class="ve-resize-handle nw"></div>
        <div class="ve-resize-handle se"></div><div class="ve-resize-handle sw"></div>`;

    overlay.querySelectorAll('.ve-resize-handle').forEach(h => {
        h.addEventListener('mousedown', (e) => e.stopPropagation());
    });
}

function clearVESelection() {
    veSelectedElement = null;
    veSelectedSelector = '';
    clearVEOverlay();
    updateVEActionsBar(false);
    const propsBody = document.getElementById('vePropsBody');
    if (propsBody) {
        propsBody.innerHTML = '<div class="ve-empty-state"><i class="fas fa-mouse-pointer"></i><p>Click any element on the canvas to edit its properties</p></div>';
    }
    highlightVETreeItem();
    renderVESections();
    updateVEStatusBar();
}

function clearVEOverlay() {
    const overlay = document.getElementById('veOverlay');
    if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
}

function updateVEActionsBar(show) {
    const header = document.getElementById('veActionsHeader');
    const bar = document.getElementById('veActionsBar');
    if (header) header.style.display = show ? '' : 'none';
    if (bar) bar.style.display = show ? '' : 'none';
    if (show && veSelectedElement) {
        const hideBtn = document.getElementById('veActHide');
        const lockBtn = document.getElementById('veActLock');
        if (hideBtn) hideBtn.querySelector('i').className = veSelectedElement.style.display === 'none' ? 'fas fa-eye-slash' : 'fas fa-eye';
        if (lockBtn) lockBtn.querySelector('i').className = veSelectedElement.dataset.veLocked === 'true' ? 'fas fa-unlock' : 'fas fa-lock';
    }
}

function highlightVETreeItem() {
    document.querySelectorAll('.ve-tree-item').forEach(i => i.classList.remove('selected'));
    if (!veSelectedElement) return;
    const idx = veVisibleElements.findIndex(item => item.el === veSelectedElement);
    if (idx >= 0) {
        const treeItem = document.querySelector(`.ve-tree-item[data-ve-tree-idx="${idx}"]`);
        if (treeItem) { treeItem.classList.add('selected'); treeItem.scrollIntoView({ block: 'nearest' }); }
    }
}

function updateVEStatusBar() {
    const elInfo = document.getElementById('veStatusElement');
    const posInfo = document.getElementById('veStatusPos');
    const sizeInfo = document.getElementById('veStatusSize');
    if (!veSelectedElement) {
        if (elInfo) elInfo.textContent = 'No element selected';
        if (posInfo) posInfo.textContent = '';
        if (sizeInfo) sizeInfo.textContent = '';
        return;
    }
    const tag = veSelectedElement.tagName.toLowerCase();
    const id = veSelectedElement.id ? '#' + veSelectedElement.id : '';
    if (elInfo) elInfo.textContent = `<${tag}>${id}`;
    const rect = veSelectedElement.getBoundingClientRect();
    if (posInfo) posInfo.textContent = `X: ${Math.round(rect.left)} Y: ${Math.round(rect.top)}`;
    if (sizeInfo) sizeInfo.textContent = `${Math.round(rect.width)} x ${Math.round(rect.height)}`;
}

// --- Properties panel ---
function showVEProperties(selector) {
    const propsBody = document.getElementById('vePropsBody');
    if (!propsBody || !veSelectedElement) return;

    const el = veSelectedElement;
    const computed = veIframeDoc.defaultView.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const id = el.id || '';
    const cls = (typeof el.className === 'string' ? el.className : '').trim();
    const text = el.textContent?.trim().substring(0, 100) || '';

    const bp = veCurrentBreakpoint;
    const key = selector;
    if (!veOverrides[key]) veOverrides[key] = {};
    const ov = veOverrides[key][bp] || {};
    const getVal = (prop, fallback) => ov[prop] !== undefined ? ov[prop] : fallback;

    propsBody.innerHTML = `
        <div class="ve-props-section">
            <div class="ve-props-label">Element Info</div>
            <div class="ve-props-info">
                <span class="ve-tag">${tag}</span> ${id ? '<span class="ve-id">#' + id + '</span>' : ''}
                <div class="ve-classes">${cls || 'no classes'}</div>
                ${text ? '<div class="ve-text-preview">"' + text.substring(0, 50) + '..."</div>' : ''}
            </div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Content</div>
            <div class="ve-prop-row"><label>Text</label><input type="text" value="${escapeVEAttr(el.textContent?.trim() || '')}" onchange="veSetProp('text', this.value)"></div>
            ${tag === 'img' ? `<div class="ve-prop-row"><label>Src</label><input type="text" value="${escapeVEAttr(el.src || '')}" onchange="veSetProp('src', this.value)"></div>
            <div class="ve-prop-row"><label>Alt</label><input type="text" value="${escapeVEAttr(el.alt || '')}" onchange="veSetProp('alt', this.value)"></div>` : ''}
            ${tag === 'a' ? `<div class="ve-prop-row"><label>Href</label><input type="text" value="${escapeVEAttr(el.href || '')}" onchange="veSetProp('href', this.value)"></div>` : ''}
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Typography</div>
            <div class="ve-prop-row"><label>Font Size</label><input type="text" value="${getVal('fontSize', computed.fontSize)}" onchange="veSetProp('fontSize', this.value)"></div>
            <div class="ve-prop-row"><label>Font Weight</label><select onchange="veSetProp('fontWeight', this.value)">
                ${[100,200,300,400,500,600,700,800,900].map(w => '<option value="'+w+'" '+(computed.fontWeight==w?'selected':'')+'>'+w+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Font Family</label><select onchange="veSetProp('fontFamily', this.value)">
                ${['','system-ui, sans-serif','serif','monospace','cursive'].map(f => '<option value="'+f+'" '+(computed.fontFamily===f?'selected':'')+'>'+(f||'Default')+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Color</label><div class="ve-color-wrap"><input type="color" value="${veRgbToHex(computed.color)}" onchange="veSetProp('color', this.value)"><input type="text" value="${veRgbToHex(computed.color)}" onchange="this.previousElementSibling.value=this.value;veSetProp('color',this.value)"></div></div>
            <div class="ve-prop-row"><label>Text Align</label><select onchange="veSetProp('textAlign', this.value)">
                ${['left','center','right','justify'].map(v => '<option value="'+v+'" '+(computed.textAlign===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Line Height</label><input type="text" value="${getVal('lineHeight', computed.lineHeight)}" onchange="veSetProp('lineHeight', this.value)"></div>
            <div class="ve-prop-row"><label>Letter Spacing</label><input type="text" value="${getVal('letterSpacing', computed.letterSpacing)}" onchange="veSetProp('letterSpacing', this.value)"></div>
            <div class="ve-prop-row"><label>Text Transform</label><select onchange="veSetProp('textTransform', this.value)">
                ${['none','uppercase','lowercase','capitalize'].map(v => '<option value="'+v+'" '+(computed.textTransform===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Text Decoration</label><select onchange="veSetProp('textDecoration', this.value)">
                ${['none','underline','overline','line-through'].map(v => '<option value="'+v+'" '+(computed.textDecoration===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Spacing</div>
            <div class="ve-prop-row"><label>Margin</label><input type="text" value="${getVal('margin', computed.margin)}" onchange="veSetProp('margin', this.value)"></div>
            <div class="ve-prop-row"><label>Padding</label><input type="text" value="${getVal('padding', computed.padding)}" onchange="veSetProp('padding', this.value)"></div>
            <div class="ve-prop-row"><label>Margin Top</label><input type="text" value="${getVal('marginTop', computed.marginTop)}" onchange="veSetProp('marginTop', this.value)"></div>
            <div class="ve-prop-row"><label>Margin Right</label><input type="text" value="${getVal('marginRight', computed.marginRight)}" onchange="veSetProp('marginRight', this.value)"></div>
            <div class="ve-prop-row"><label>Margin Bottom</label><input type="text" value="${getVal('marginBottom', computed.marginBottom)}" onchange="veSetProp('marginBottom', this.value)"></div>
            <div class="ve-prop-row"><label>Margin Left</label><input type="text" value="${getVal('marginLeft', computed.marginLeft)}" onchange="veSetProp('marginLeft', this.value)"></div>
            <div class="ve-prop-row"><label>Padding Top</label><input type="text" value="${getVal('paddingTop', computed.paddingTop)}" onchange="veSetProp('paddingTop', this.value)"></div>
            <div class="ve-prop-row"><label>Padding Right</label><input type="text" value="${getVal('paddingRight', computed.paddingRight)}" onchange="veSetProp('paddingRight', this.value)"></div>
            <div class="ve-prop-row"><label>Padding Bottom</label><input type="text" value="${getVal('paddingBottom', computed.paddingBottom)}" onchange="veSetProp('paddingBottom', this.value)"></div>
            <div class="ve-prop-row"><label>Padding Left</label><input type="text" value="${getVal('paddingLeft', computed.paddingLeft)}" onchange="veSetProp('paddingLeft', this.value)"></div>
        </div>
        <div class="ve-props-section">
            <div class="ve-props-label">Size</div>
            <div class="ve-prop-row"><label>Box Sizing</label><select onchange="veSetProp('boxSizing', this.value)">
                ${['content-box','border-box'].map(v => '<option value="'+v+'" '+(computed.boxSizing===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Width</label><input type="text" value="${getVal('width', computed.width)}" onchange="veSetProp('width', this.value)"></div>
            <div class="ve-prop-row"><label>Height</label><input type="text" value="${getVal('height', computed.height)}" onchange="veSetProp('height', this.value)"></div>
            <div class="ve-prop-row"><label>Min W</label><input type="text" value="${getVal('minWidth', computed.minWidth)}" onchange="veSetProp('minWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Max W</label><input type="text" value="${getVal('maxWidth', computed.maxWidth)}" onchange="veSetProp('maxWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Min H</label><input type="text" value="${getVal('minHeight', computed.minHeight)}" onchange="veSetProp('minHeight', this.value)"></div>
            <div class="ve-prop-row"><label>Max H</label><input type="text" value="${getVal('maxHeight', computed.maxHeight)}" onchange="veSetProp('maxHeight', this.value)"></div>
        </div>
        <div class="ve-props-section">
            <div class="ve-props-label">Spacing</div>
            <div class="ve-prop-row"><label>Margin</label><input type="text" value="${getVal('margin', computed.margin)}" onchange="veSetProp('margin', this.value)"></div>
            <div class="ve-prop-row"><label>Padding</label><input type="text" value="${getVal('padding', computed.padding)}" onchange="veSetProp('padding', this.value)"></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Size</div>
            <div class="ve-prop-row"><label>Width</label><input type="text" value="${getVal('width', computed.width)}" onchange="veSetProp('width', this.value)"></div>
            <div class="ve-prop-row"><label>Height</label><input type="text" value="${getVal('height', computed.height)}" onchange="veSetProp('height', this.value)"></div>
            <div class="ve-prop-row"><label>Min W</label><input type="text" value="${getVal('minWidth', computed.minWidth)}" onchange="veSetProp('minWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Max W</label><input type="text" value="${getVal('maxWidth', computed.maxWidth)}" onchange="veSetProp('maxWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Min H</label><input type="text" value="${getVal('minHeight', computed.minHeight)}" onchange="veSetProp('minHeight', this.value)"></div>
            <div class="ve-prop-row"><label>Max H</label><input type="text" value="${getVal('maxHeight', computed.maxHeight)}" onchange="veSetProp('maxHeight', this.value)"></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Background</div>
            <div class="ve-prop-row"><label>BG Color</label><div class="ve-color-wrap"><input type="color" value="${veRgbToHex(computed.backgroundColor)}" onchange="veSetProp('backgroundColor', this.value)"><input type="text" value="${veRgbToHex(computed.backgroundColor)}" onchange="this.previousElementSibling.value=this.value;veSetProp('backgroundColor',this.value)"></div></div>
            <div class="ve-prop-row"><label>Border Radius</label><input type="text" value="${getVal('borderRadius', computed.borderRadius)}" onchange="veSetProp('borderRadius', this.value)"></div>
            <div class="ve-prop-row"><label>Opacity</label><input type="range" min="0" max="1" step="0.05" value="${getVal('opacity', computed.opacity)}" onchange="veSetProp('opacity', this.value)"></div>
            <div class="ve-prop-row"><label>Border</label><input type="text" value="${getVal('border', computed.border)}" onchange="veSetProp('border', this.value)"></div>
            <div class="ve-prop-row"><label>Shadow</label><input type="text" value="${getVal('boxShadow', computed.boxShadow)}" onchange="veSetProp('boxShadow', this.value)"></div>
            <div class="ve-prop-row"><label>Backdrop Blur</label><input type="text" value="${getVal('backdropFilter', computed.backdropFilter)}" onchange="veSetProp('backdropFilter', this.value)"></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Layout</div>
            <div class="ve-prop-row"><label>Display</label><select onchange="veSetProp('display', this.value)">
                ${['block','inline','inline-block','flex','grid','none'].map(v => '<option value="'+v+'" '+(computed.display===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Position</label><select onchange="veSetProp('position', this.value)">
                ${['static','relative','absolute','fixed','sticky'].map(v => '<option value="'+v+'" '+(computed.position===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Z-Index</label><input type="number" value="${getVal('zIndex', computed.zIndex)}" onchange="veSetProp('zIndex', this.value)"></div>
            <div class="ve-prop-row"><label>Overflow</label><select onchange="veSetProp('overflow', this.value)">
                ${['visible','hidden','scroll','auto'].map(v => '<option value="'+v+'" '+(computed.overflow===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Visibility</div>
            <div class="ve-prop-row"><label>Visibility</label><select onchange="veSetProp('visibility', this.value)">
                ${['visible','hidden'].map(v => '<option value="'+v+'" '+(computed.visibility===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Cursor</label><select onchange="veSetProp('cursor', this.value)">
                ${['default','pointer','move','not-allowed','grab','grabbing'].map(v => '<option value="'+v+'" '+(computed.cursor===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Animation</div>
            <div class="ve-prop-row"><label>Transition</label><input type="text" value="${getVal('transition', computed.transition)}" onchange="veSetProp('transition', this.value)"></div>
            <div class="ve-prop-row"><label>Transform</label><input type="text" value="${getVal('transform', computed.transform)}" onchange="veSetProp('transform', this.value)"></div>
        </div>
    `;
}

function veSetProp(prop, value) {
    if (!veSelectedElement) return;
    pushVEUndo('Set ' + prop);

    if (prop === 'text') {
        veSelectedElement.textContent = value;
    } else if (prop === 'src') {
        veSelectedElement.src = value;
    } else if (prop === 'alt') {
        veSelectedElement.alt = value;
    } else if (prop === 'href') {
        veSelectedElement.href = value;
    } else {
        veSelectedElement.style[prop] = value;
        const bp = veCurrentBreakpoint;
        if (!veOverrides[veSelectedSelector]) veOverrides[veSelectedSelector] = {};
        if (!veOverrides[veSelectedSelector][bp]) veOverrides[veSelectedSelector][bp] = {};
        veOverrides[veSelectedSelector][bp][prop] = value;
    }
    updateVEOverlay();
    updateVEOverlay();
}

// Builder V2 Enhanced Properties
function enhanceVEProperties() {
    const propsBody = document.getElementById('vePropsBody');
    if (!propsBody || !veSelectedElement) return;

    const el = veSelectedElement;
    const computed = veIframeDoc.defaultView.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const id = el.id || '';
    const cls = (typeof el.className === 'string' ? el.className : '').trim();
    const text = el.textContent?.trim().substring(0, 100) || '';

    const bp = veCurrentBreakpoint;
    const key = veSelectedSelector;
    if (!veOverrides[key]) veOverrides[key] = {};
    const ov = veOverrides[key][bp] || {};
    const getVal = (prop, fallback) => ov[prop] !== undefined ? ov[prop] : fallback;

    propsBody.innerHTML = `
        <div class="ve-props-section">
            <div class="ve-props-label">Element Info</div>
            <div class="ve-props-info">
                <span class="ve-tag">${tag}</span> ${id ? '<span class="ve-id">#' + id + '</span>' : ''}
                <div class="ve-classes">${cls || 'no classes'}</div>
                ${text ? '<div class="ve-text-preview">"' + text.substring(0, 50) + '..."</div>' : ''}
            </div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Content</div>
            <div class="ve-prop-row"><label>Text</label><input type="text" value="${escapeVEAttr(el.textContent?.trim() || '')}" onchange="veSetProp('text', this.value)"></div>
            ${tag === 'img' ? `<div class="ve-prop-row"><label>Src</label><input type="text" value="${escapeVEAttr(el.src || '')}" onchange="veSetProp('src', this.value)"></div>
            <div class="ve-prop-row"><label>Alt</label><input type="text" value="${escapeVEAttr(el.alt || '')}" onchange="veSetProp('alt', this.value)"></div>` : ''}
            ${tag === 'a' ? `<div class="ve-prop-row"><label>Href</label><input type="text" value="${escapeVEAttr(el.href || '')}" onchange="veSetProp('href', this.value)"></div>` : ''}
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Dimensions</div>
            <div class="ve-prop-row"><label>Width</label><input type="text" value="${getVal('width', computed.width)}" onchange="veSetProp('width', this.value)"></div>
            <div class="ve-prop-row"><label>Height</label><input type="text" value="${getVal('height', computed.height)}" onchange="veSetProp('height', this.value)"></div>
            <div class="ve-prop-row"><label>Min W</label><input type="text" value="${getVal('minWidth', computed.minWidth)}" onchange="veSetProp('minWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Max W</label><input type="text" value="${getVal('maxWidth', computed.maxWidth)}" onchange="veSetProp('maxWidth', this.value)"></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Typography</div>
            <div class="ve-prop-row"><label>Font Size</label><input type="text" value="${getVal('fontSize', computed.fontSize)}" onchange="veSetProp('fontSize', this.value)"></div>
            <div class="ve-prop-row"><label>Font Weight</label><select onchange="veSetProp('fontWeight', this.value)">
                ${[100,200,300,400,500,600,700,800,900].map(w => '<option value="'+w+'" '+(computed.fontWeight==w?'selected':'')+'>'+w+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Font Family</label><select onchange="veSetProp('fontFamily', this.value)">
                ${['','system-ui, sans-serif','serif','monospace','cursive'].map(f => '<option value="'+f+'" '+(computed.fontFamily===f?'selected':'')+'>'+(f||'Default')+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Color</label><div class="ve-color-wrap"><input type="color" value="${veRgbToHex(computed.color)}" onchange="veSetProp('color', this.value)"><input type="text" value="${veRgbToHex(computed.color)}" onchange="this.previousElementSibling.value=this.value;veSetProp('color',this.value)"></div></div>
            <div class="ve-prop-row"><label>Text Align</label><select onchange="veSetProp('textAlign', this.value)">
                ${['left','center','right','justify'].map(v => '<option value="'+v+'" '+(computed.textAlign===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
        </div>
    `;
}
}

// --- Element actions ---
function veDuplicateElement() {
    if (!veSelectedElement) return;
    pushVEUndo('Duplicate element');
    const clone = veSelectedElement.cloneNode(true);
    clone.removeAttribute('id');
    veSelectedElement.parentElement.insertBefore(clone, veSelectedElement.nextSibling);
    addVEHistoryEntry('Duplicated ' + veSelectedElement.tagName.toLowerCase());
    scanIframeElements();
    selectVEElement(clone);
}

function veDeleteElement() {
    if (!veSelectedElement) return;
    pushVEUndo('Delete element');
    const tag = veSelectedElement.tagName.toLowerCase();
    veSelectedElement.remove();
    addVEHistoryEntry('Deleted <' + tag + '>');
    scanIframeElements();
    clearVESelection();
}

function veToggleHide() {
    if (!veSelectedElement) return;
    const hidden = veSelectedElement.style.display === 'none';
    veSelectedElement.style.display = hidden ? '' : 'none';
    addVEHistoryEntry((hidden ? 'Showed ' : 'Hidden ') + veSelectedElement.tagName.toLowerCase());
    scanIframeElements();
    updateVEActionsBar(true);
}

function veToggleLock() {
    if (!veSelectedElement) return;
    const locked = veSelectedElement.dataset.veLocked === 'true';
    veSelectedElement.dataset.veLocked = locked ? 'false' : 'true';
    addVEHistoryEntry((locked ? 'Unlocked ' : 'Locked ') + veSelectedElement.tagName.toLowerCase());
    scanIframeElements();
    updateVEActionsBar(true);
}

function veMoveElement(dir) {
    if (!veSelectedElement || !veSelectedElement.parentElement) return;
    pushVEUndo('Move element ' + dir);
    const parent = veSelectedElement.parentElement;
    if (dir === 'up' && veSelectedElement.previousElementSibling) {
        parent.insertBefore(veSelectedElement, veSelectedElement.previousElementSibling);
    } else if (dir === 'down' && veSelectedElement.nextElementSibling) {
        parent.insertBefore(veSelectedElement.nextElementSibling, veSelectedElement);
    }
    addVEHistoryEntry('Moved ' + veSelectedElement.tagName.toLowerCase() + ' ' + dir);
    scanIframeElements();
    updateVEOverlay();
}

function veWrapInContainer() {
    if (!veSelectedElement) return;
    pushVEUndo('Wrap in container');
    const wrapper = veIframeDoc.createElement('div');
    wrapper.style.padding = '16px';
    wrapper.style.border = '1px dashed rgba(255,255,255,0.3)';
    wrapper.style.borderRadius = '8px';
    veSelectedElement.parentElement.insertBefore(wrapper, veSelectedElement);
    wrapper.appendChild(veSelectedElement);
    addVEHistoryEntry('Wrapped element in container');
    scanIframeElements();
    selectVEElement(wrapper);
}

function veEditHTML() {
    if (!veSelectedElement) return;
    const currentHTML = veSelectedElement.outerHTML;
    const overlay = document.createElement('div');
    overlay.className = 've-html-editor';
    overlay.innerHTML = `<div class="ve-html-editor-content">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border-glass);"><span style="font-weight:600;color:var(--text-primary)">Edit HTML</span><button class="ve-html-close" onclick="this.closest('.ve-html-editor').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;"><i class="fas fa-times"></i></button></div>
        <textarea spellcheck="false">${escapeVEAttr(currentHTML)}</textarea>
        <div class="ve-html-editor-actions">
            <button class="ve-btn-secondary" onclick="this.closest('.ve-html-editor').remove()">Cancel</button>
            <button class="ve-btn-primary" onclick="veApplyHTMLEdit(this)">Apply</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('textarea').focus();
}

function veApplyHTMLEdit(btn) {
    const modal = btn.closest('.ve-html-editor');
    const textarea = modal.querySelector('textarea');
    const newHTML = textarea.value.trim();
    if (!newHTML || !veSelectedElement) { modal.remove(); return; }
    pushVEUndo('Edit HTML');
    const temp = veIframeDoc.createElement('div');
    temp.innerHTML = newHTML;
    const newEl = temp.firstChild;
    if (newEl) {
        veSelectedElement.parentElement.replaceChild(newEl, veSelectedElement);
        veSelectedElement = newEl;
        veSelectedSelector = getVEUniqueSelector(newEl);
        addVEHistoryEntry('Edited HTML');
        scanIframeElements();
        updateVEOverlay();
    }
    modal.remove();
}

// --- Undo / Redo ---
function pushVEUndo(action) {
    if (!veIframeDoc) return;
    veUndoStack.push({ html: veIframeDoc.documentElement.outerHTML, action: action || 'Edit', time: new Date().toLocaleTimeString() });
    if (veUndoStack.length > veMaxHistory) veUndoStack.shift();
    veRedoStack = [];
    updateVEUndoRedoBtns();
}

function veUndo() {
    if (veUndoStack.length === 0) return;
    veRedoStack.push({ html: veIframeDoc.documentElement.outerHTML, action: 'Undo', time: new Date().toLocaleTimeString() });
    const prev = veUndoStack.pop();
    veIframeDoc.documentElement.innerHTML = new DOMParser().parseFromString(prev.html, 'text/html').documentElement.innerHTML;
    updateVEUndoRedoBtns();
    addVEHistoryEntry('Undo: ' + prev.action);
    scanIframeElements();
    clearVESelection();
}

function veRedo() {
    if (veRedoStack.length === 0) return;
    veUndoStack.push({ html: veIframeDoc.documentElement.outerHTML, action: 'Redo', time: new Date().toLocaleTimeString() });
    const next = veRedoStack.pop();
    veIframeDoc.documentElement.innerHTML = new DOMParser().parseFromString(next.html, 'text/html').documentElement.innerHTML;
    updateVEUndoRedoBtns();
    addVEHistoryEntry('Redo');
    scanIframeElements();
    clearVESelection();
}

function updateVEUndoRedoBtns() {
    const canUndo = veUndoStack.length > 0;
    const canRedo = veRedoStack.length > 0;
    // Canvas toolbar
    const undoBtn = document.getElementById('veUndoBtn');
    const redoBtn = document.getElementById('veRedoBtn');
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
    // Panel buttons (Layers tab)
    const pUndo = document.getElementById('vePanelUndo');
    const pRedo = document.getElementById('vePanelRedo');
    if (pUndo) pUndo.disabled = !canUndo;
    if (pRedo) pRedo.disabled = !canRedo;
    // Panel buttons (Components tab)
    const pUndo2 = document.getElementById('vePanelUndo2');
    const pRedo2 = document.getElementById('vePanelRedo2');
    if (pUndo2) pUndo2.disabled = !canUndo;
    if (pRedo2) pRedo2.disabled = !canRedo;
}

// --- History panel ---
function addVEHistoryEntry(action) {
    const entry = { action, time: new Date().toLocaleTimeString() };
    veHistoryEntries.push(entry);
    if (veHistoryEntries.length > 100) veHistoryEntries.shift();
    renderVEHistory();
}

function renderVEHistory() {
    const list = document.getElementById('veHistoryList');
    if (!list) return;
    if (veHistoryEntries.length === 0) {
        list.innerHTML = '<div class="ve-empty-hint"><i class="fas fa-clock"></i><p>No changes yet</p></div>';
        return;
    }
    list.innerHTML = veHistoryEntries.slice().reverse().map((e, i) =>
        `<div class="ve-history-entry"><span class="ve-history-action">${e.action}</span><span class="ve-history-time">${e.time}</span></div>`
    ).join('');
}

// --- Component drag & drop ---
function setupComponentDrag() {
    document.querySelectorAll('.ve-comp-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.compType);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    const wrapper = document.getElementById('veCanvasWrapper');
    if (wrapper) {
        wrapper.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('text/plain');
            if (type) veInsertComponent(type);
        });
    }
}

function veInsertComponent(type) {
    if (!veIframeDoc) return;
    pushVEUndo('Insert ' + type);
    let el;
    switch (type) {
        case 'section': el = veIframeDoc.createElement('section'); el.style.padding = '60px 20px'; el.style.minHeight = '300px'; break;
        case 'div': el = veIframeDoc.createElement('div'); el.style.padding = '20px'; el.style.border = '1px dashed rgba(255,255,255,0.3)'; el.style.borderRadius = '8px'; break;
        case 'grid': el = veIframeDoc.createElement('div'); el.style.display = 'grid'; el.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))'; el.style.gap = '16px'; el.style.padding = '20px'; break;
        case 'heading': el = veIframeDoc.createElement('h2'); el.textContent = 'Heading'; el.style.color = '#ffffff'; break;
        case 'text': el = veIframeDoc.createElement('p'); el.textContent = 'Text content goes here.'; el.style.color = '#b3b3b3'; break;
        case 'image': el = veIframeDoc.createElement('img'); el.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23333" width="200" height="200"/><text fill="%23666" x="50%" y="50%" text-anchor="middle" dy=".3em">Image</text></svg>'; el.style.maxWidth = '100%'; el.style.borderRadius = '8px'; break;
        case 'icon': el = veIframeDoc.createElement('i'); el.className = 'fas fa-star'; el.style.color = '#1db954'; el.style.fontSize = '24px'; break;
        case 'button': el = veIframeDoc.createElement('button'); el.textContent = 'Button'; el.style.padding = '10px 24px'; el.style.borderRadius = '24px'; el.style.background = '#1db954'; el.style.color = '#fff'; el.style.border = 'none'; el.style.cursor = 'pointer'; break;
        case 'link': el = veIframeDoc.createElement('a'); el.textContent = 'Link'; el.href = '#'; el.style.color = '#1db954'; break;
        case 'song-card': el = veIframeDoc.createElement('div'); el.className = 'song-card'; el.innerHTML = '<div style="width:100%;aspect-ratio:1;background:#333;border-radius:8px"></div><p style="margin:8px 0 0;color:#fff">Song Title</p>'; break;
        case 'station-card': el = veIframeDoc.createElement('div'); el.className = 'station-card'; el.innerHTML = '<div style="width:100%;aspect-ratio:1;background:#1a1a2e;border-radius:12px"></div><p style="margin:8px 0 0;color:#fff">Station</p>'; break;
        case 'artist-card': el = veIframeDoc.createElement('div'); el.className = 'artist-card'; el.innerHTML = '<div style="width:80px;height:80px;border-radius:50%;background:#333;margin:0 auto"></div><p style="margin:8px 0 0;color:#fff;text-align:center">Artist</p>'; break;
        case 'carousel': el = veIframeDoc.createElement('div'); el.style.display = 'flex'; el.style.gap = '16px'; el.style.overflow = 'auto'; el.style.padding = '16px'; for (let i = 0; i < 4; i++) { const c = veIframeDoc.createElement('div'); c.style.minWidth = '200px'; c.style.height = '200px'; c.style.background = '#222'; c.style.borderRadius = '8px'; el.appendChild(c); } break;
        case 'chart-list': el = veIframeDoc.createElement('div'); el.className = 'chart-list'; el.innerHTML = '<div style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:#fff">1. Song Title</div><div style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:#fff">2. Song Title</div>'; break;
        default: el = veIframeDoc.createElement('div'); el.textContent = type; el.style.padding = '16px';
    }

    veIframeDoc.body.appendChild(el);
    addVEHistoryEntry('Inserted ' + type);
    scanIframeElements();
    selectVEElement(el);
}

// --- Draft / Publish ---
function saveVEDraft() {
    try {
        const draft = {
            overrides: veOverrides,
            html: veIframeDoc?.documentElement?.outerHTML || '',
            history: veHistoryEntries,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem('veDraft', JSON.stringify(draft));
        addVEHistoryEntry('Draft saved');
        showToast('Visual editor draft saved!', 'success');
    } catch (e) {
        showToast('Failed to save draft', 'error');
    }
}

function loadVEDraft() {
    try {
        const raw = localStorage.getItem('veDraft');
        if (raw) {
            const draft = JSON.parse(raw);
            if (draft.overrides) veOverrides = draft.overrides;
            if (draft.history) veHistoryEntries = draft.history;
        }
    } catch (e) { /* ignore */ }
}

function publishVEChanges() {
    if (!confirm('Publish visual editor changes to the live site?')) return;
    saveVEOverridesForLive();
    saveVEDraft();
    syncToLiveWebsite();
    addVEHistoryEntry('Published to live');
    showToast('Visual editor changes published!', 'success');
}

function saveVEOverridesForLive() {
    if (!veIframeDoc) return;
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const sectionStates = meaningful.map(el => {
        const id = el.getAttribute('data-section') || el.id || '';
        const hidden = el.style.display === 'none' || el.hidden;
        const computed = window.getComputedStyle(el);
        return {
            id,
            hidden,
            display: hidden ? 'none' : '',
            order: Array.from(el.parentElement.children).indexOf(el)
        };
    });
    const payload = {
        sectionStates,
        overrides: veOverrides,
        timestamp: Date.now()
    };
    localStorage.setItem('tamilAIStream_veOverrides', JSON.stringify(payload));
}

// --- Helpers ---
function escapeVEAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function veRgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return '#000000';
    return '#' + match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

// ============================================
// Mini Player Settings
// ============================================
const MINI_PLAYER_DEFAULTS = {
    width: 320, height: 500, borderRadius: 16, bgColor: '#1a1a2e', bgOpacity: 95,
    blur: 20, glass: true, shadow: 'medium', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    showArt: true, artSize: 80, artRadius: 50, vinylSpin: true,
    titleSize: 14, titleWeight: '600', titleColor: '#ffffff', artistSize: 12, artistColor: '#b3b3b3', textAlign: 'center',
    showPlay: true, showPrev: true, showNext: true, showShuffle: false, showRepeat: false,
    showProgress: true, showVolume: false, showFav: false, showQueue: false, showShare: false, showAI: false,
    btnSize: 32, btnColor: '#ffffff', btnHover: '#1db954', playBtnSize: 48,
    progressH: 4, progressColor: '#1db954', progressBg: 'rgba(255,255,255,0.2)', showThumb: true, thumbSize: 10,
    position: 'bottom-center', draggable: true, autoMinimize: false, showOnPlay: true, zIndex: 1000, animation: 'slide-up',
    miniWidth: 200, miniHeight: 56, miniRadius: 28, miniBg: '#1a1a2e', miniShowArt: true, miniShowPlay: true, miniShowExpand: true
};

function loadMiniPlayerSettings() {
    const s = DataStore.getMiniPlayerSettings();
    const d = { ...MINI_PLAYER_DEFAULTS, ...s };

    const fields = {
        mpWidth: d.width, mpHeight: d.height, mpBorderRadius: d.borderRadius,
        mpBgColor: d.bgColor, mpBgOpacity: d.bgOpacity, mpBlur: d.blur,
        mpGlass: String(d.glass), mpShadow: d.shadow, mpBorderColor: d.borderColor, mpBorderWidth: d.borderWidth,
        mpShowArt: String(d.showArt), mpArtSize: d.artSize, mpArtRadius: d.artRadius, mpVinylSpin: String(d.vinylSpin),
        mpTitleSize: d.titleSize, mpTitleWeight: d.titleWeight, mpTitleColor: d.titleColor,
        mpArtistSize: d.artistSize, mpArtistColor: d.artistColor, mpTextAlign: d.textAlign,
        mpShowPlay: String(d.showPlay), mpShowPrev: String(d.showPrev), mpShowNext: String(d.showNext),
        mpShowShuffle: String(d.showShuffle), mpShowRepeat: String(d.showRepeat), mpShowProgress: String(d.showProgress),
        mpShowVolume: String(d.showVolume), mpShowFav: String(d.showFav), mpShowQueue: String(d.showQueue),
        mpShowShare: String(d.showShare), mpShowAI: String(d.showAI), mpBtnSize: d.btnSize,
        mpBtnColor: d.btnColor, mpBtnHover: d.btnHover, mpPlayBtnSize: d.playBtnSize,
        mpProgressH: d.progressH, mpProgressColor: d.progressColor, mpProgressBg: d.progressBg,
        mpShowThumb: String(d.showThumb), mpThumbSize: d.thumbSize,
        mpPosition: d.position, mpDraggable: String(d.draggable), mpAutoMinimize: String(d.autoMinimize),
        mpShowOnPlay: String(d.showOnPlay), mpZIndex: d.zIndex, mpAnimation: d.animation,
        mpMiniWidth: d.miniWidth, mpMiniHeight: d.miniHeight, mpMiniRadius: d.miniRadius,
        mpMiniBg: d.miniBg, mpMiniShowArt: String(d.miniShowArt), mpMiniShowPlay: String(d.miniShowPlay),
        mpMiniShowExpand: String(d.miniShowExpand)
    };

    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? '';
    });
}

function saveMiniPlayerSettings(e) {
    e.preventDefault();
    const get = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    const getNum = (id) => parseFloat(get(id)) || 0;
    window.resetMiniPlayerSettings = resetMiniPlayerSettings;
    window.resetMiniPlayerSettings = resetMiniPlayerSettings;
}

// Builder V2 Enhanced Functions

function veRgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return '#000000';
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return '#000000';
    return '#' + result.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
}
    const getBool = (id) => get(id) === 'true';

    const settings = {
        width: getNum('mpWidth'), height: getNum('mpHeight'), borderRadius: getNum('mpBorderRadius'),
        bgColor: get('mpBgColor'), bgOpacity: getNum('mpBgOpacity'), blur: getNum('mpBlur'),
        glass: getBool('mpGlass'), shadow: get('mpShadow'), borderColor: get('mpBorderColor'), borderWidth: getNum('mpBorderWidth'),
        showArt: getBool('mpShowArt'), artSize: getNum('mpArtSize'), artRadius: getNum('mpArtRadius'), vinylSpin: getBool('mpVinylSpin'),
        titleSize: getNum('mpTitleSize'), titleWeight: get('mpTitleWeight'), titleColor: get('mpTitleColor'),
        artistSize: getNum('mpArtistSize'), artistColor: get('mpArtistColor'), textAlign: get('mpTextAlign'),
        showPlay: getBool('mpShowPlay'), showPrev: getBool('mpShowPrev'), showNext: getBool('mpShowNext'),
        showShuffle: getBool('mpShowShuffle'), showRepeat: getBool('mpShowRepeat'), showProgress: getBool('mpShowProgress'),
        showVolume: getBool('mpShowVolume'), showFav: getBool('mpShowFav'), showQueue: getBool('mpShowQueue'),
        showShare: getBool('mpShowShare'), showAI: getBool('mpShowAI'), btnSize: getNum('mpBtnSize'),
        btnColor: get('mpBtnColor'), btnHover: get('mpBtnHover'), playBtnSize: getNum('mpPlayBtnSize'),
        progressH: getNum('mpProgressH'), progressColor: get('mpProgressColor'), progressBg: get('mpProgressBg'),
        showThumb: getBool('mpShowThumb'), thumbSize: getNum('mpThumbSize'),
        position: get('mpPosition'), draggable: getBool('mpDraggable'), autoMinimize: getBool('mpAutoMinimize'),
        showOnPlay: getBool('mpShowOnPlay'), zIndex: getNum('mpZIndex'), animation: get('mpAnimation'),
        miniWidth: getNum('mpMiniWidth'), miniHeight: getNum('mpMiniHeight'), miniRadius: getNum('mpMiniRadius'),
        miniBg: get('mpMiniBg'), miniShowArt: getBool('mpMiniShowArt'), miniShowPlay: getBool('mpMiniShowPlay'),
        miniShowExpand: getBool('mpMiniShowExpand')
    };

    DataStore.setMiniPlayerSettings(settings);
    showToast('Mini Player settings saved!', 'success');
    syncToLiveWebsite();
    return false;
}

function resetMiniPlayerSettings() {
    if (!confirm('Reset all Mini Player settings to defaults?')) return;
    DataStore.setMiniPlayerSettings(MINI_PLAYER_DEFAULTS);
    loadMiniPlayerSettings();
    showToast('Mini Player settings reset to defaults', 'success');
}

// Export functions for global access
if (typeof window !== 'undefined') {
    window.signInWithEmail = signInWithEmail;
    window.signUpWithEmail = signUpWithEmail;
    window.signInWithGoogle = signInWithGoogle;
    window.signInAsGuest = signInAsGuest;
    window.signOut = signOut;
    window.openEditArtistSongsModal = openEditArtistSongsModal;
    window.switchArtistSongTab = switchArtistSongTab;
    window.addSongToArtistCollection = addSongToArtistCollection;
    window.saveArtistSongs = saveArtistSongs;
    window.removeSongFromArtistCollection = removeSongFromArtistCollection;
    window.editArtistSongInCollection = editArtistSongInCollection;
    window.initVisualEditor = initVisualEditor;
    window.veSelectTreeItem = veSelectTreeItem;
    window.veSelectSection = veSelectSection;
    window.veSetProp = veSetProp;
    window.veApplyHTMLEdit = veApplyHTMLEdit;
    window.veToggleSectionVisibility = veToggleSectionVisibility;
    window.veDuplicateSection = veDuplicateSection;
    window.veMoveSection = veMoveSection;
    window.veEditSectionHTML = veEditSectionHTML;
    window.veDeleteSection = veDeleteSection;
    window.handleSectionAction = handleSectionAction;
    window.loadMiniPlayerSettings = loadMiniPlayerSettings;
    window.saveMiniPlayerSettings = saveMiniPlayerSettings;
    window.resetMiniPlayerSettings = resetMiniPlayerSettings;
    window.initV2Enhancements = initV2Enhancements;
    window.showVEToast = showVEToast;
    window.openVEPreview = openVEPreview;
    window.closeVEPreview = closeVEPreview;
}
// Export functions for global access
if (typeof window !== 'undefined') {
    window.signInWithEmail = signInWithEmail;
    window.signUpWithEmail = signUpWithEmail;
    window.signInWithGoogle = signInWithGoogle;
    window.signInAsGuest = signInAsGuest;
    window.signOut = signOut;
    window.openEditArtistSongsModal = openEditArtistSongsModal;
    window.switchArtistSongTab = switchArtistSongTab;
    window.addSongToArtistCollection = addSongToArtistCollection;
    window.saveArtistSongs = saveArtistSongs;
    window.removeSongFromArtistCollection = removeSongFromArtistCollection;
    window.saveMiniPlayerSettings = saveMiniPlayerSettings;
    window.resetMiniPlayerSettings = resetMiniPlayerSettings;
    window.editArtistSongInCollection = editArtistSongInCollection;
    window.initVisualEditor = initVisualEditor;
    window.veSelectTreeItem = veSelectTreeItem;
    window.veSelectSection = veSelectSection;
    window.veSetProp = veSetProp;
    window.veApplyHTMLEdit = veApplyHTMLEdit;
    window.veToggleSectionVisibility = veToggleSectionVisibility;
    window.veDuplicateSection = veDuplicateSection;
    window.veMoveSection = veMoveSection;
    window.veEditSectionHTML = veEditSectionHTML;
    window.veDeleteSection = veDeleteSection;
    window.handleSectionAction = handleSectionAction;
    window.loadMiniPlayerSettings = loadMiniPlayerSettings;
    window.saveMiniPlayerSettings = saveMiniPlayerSettings;
    window.resetMiniPlayerSettings = resetMiniPlayerSettings;
    window.resetMiniPlayerSettings = resetMiniPlayerSettings;
