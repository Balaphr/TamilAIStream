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
        localStorage.removeItem('adminSession');
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
        showToast('Saving song...', 'info');
        
        const albumFile = document.getElementById('albumImage').files[0];
        if (albumFile) {
            showToast('Uploading album cover...', 'info');
            try {
                const albumResult = await R2Uploader.uploadImage(albumFile, 'tamil-ai-stream/albums', (pct) => {
                    showToast('Album cover: ' + pct + '%', 'info');
                });
                songData.albumCover = albumResult.url;
                songData.albumPublicId = albumResult.publicId;
            } catch (err) {
                console.warn('Album upload failed:', err);
                showToast('Album cover upload failed: ' + err.message, 'error');
            }
        }

        const audioFile = document.getElementById('audioFile').files[0];
        if (audioFile) {
            showToast('Uploading audio file...', 'info');
            try {
                const audioResult = await R2Uploader.uploadAudio(audioFile, 'tamil-ai-stream/audio', (pct) => {
                    showToast('Audio: ' + pct + '%', 'info');
                });
                songData.audioUrl = audioResult.url;
                songData.audioPublicId = audioResult.publicId;
                songData.audioFormat = audioResult.format;
                songData.audioSize = audioResult.bytes;
                songData.audioFileName = audioFile.name;
            } catch (err) {
                console.error('Audio upload error:', err);
                showToast('Audio upload failed: ' + err.message, 'error');
                return;
            }
        }

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

        showToast('Song saved successfully!', 'success');
        resetSongForm();
        loadAllSongs();
        syncToLiveWebsite();
        addActivity('Song Added', 'Added "' + songData.title + '"');
    } catch (error) {
        console.error('Error saving song:', error);
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

        window.dispatchEvent(new Event('storage-sync'));
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
                sections: DataStore.getLayout().length
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
    if (!file.type.startsWith('audio/')) {
        showToast('Please upload an audio file', 'error');
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
}

