'use strict';

// Admin panel - localStorage-based

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function lsGetCollection(name) {
    const raw = localStorage.getItem('admin_' + name);
    return raw ? JSON.parse(raw) : [];
}

function lsSetCollection(name, data) {
    localStorage.setItem('admin_' + name, JSON.stringify(data));
}

function lsMockSnapshot(arr) {
    return {
        size: arr.length,
        forEach: (fn) => arr.forEach((item, i) => fn({ id: item.id, data: () => ({ ...item }) })),
        docs: arr.map(item => ({ id: item.id, data: () => ({ ...item }) }))
    };
}

// ============================================
// Global State
// ============================================
let currentUser = null;
let currentSongId = null;
let uploadedAlbumUrl = null;
let uploadedAudioUrl = null;

// ============================================
// Admin Authentication
// ============================================
const ADMIN_CREDENTIALS = {
    username: 'admin@tamilaifm.com',
    password: 'Admin@123'
};

function checkAdminAuth() {
    const session = localStorage.getItem('adminSession');
    if (session) {
        const sessionData = JSON.parse(session);
        if (sessionData.expiry > Date.now()) {
            currentUser = sessionData;
            return true;
        } else {
            localStorage.removeItem('adminSession');
        }
    }
    return false;
}

function setAdminSession() {
    const sessionData = {
        username: ADMIN_CREDENTIALS.username,
        expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    localStorage.setItem('adminSession', JSON.stringify(sessionData));
    currentUser = sessionData;
}

function logout() {
    localStorage.removeItem('adminSession');
    currentUser = null;
    window.location.href = 'admin-login.html';
}

// ============================================
// Navigation
// ============================================
function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.admin-page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.admin-sidebar-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));

    // Show selected page
    const pageMap = {
        'dashboard': 'dashboardPage',
        'songs': 'songsPage',
        'add-song': 'addSongPage',
        'categories': 'categoriesPage',
        'artists': 'artistsPage',
        'movies': 'moviesPage',
        'playlists': 'playlistsPage',
        'featured': 'songsPage',
        'trending': 'songsPage'
    };

    const pageId = pageMap[page];
    if (pageId) {
        document.getElementById(pageId).style.display = 'block';
    }

    // Update active states
    document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));

    // Load page data
    if (page === 'dashboard') loadDashboardStats();
    if (page === 'songs') loadAllSongs();
    if (page === 'categories') loadCategories();
    if (page === 'artists') loadArtists();
    if (page === 'movies') loadMovies();
    if (page === 'playlists') loadPlaylists();
}

// ============================================
// Dashboard Stats
// ============================================
async function loadDashboardStats() {
    try {
        const songs = lsGetCollection('songs');
        const artists = lsGetCollection('artists');
        const movies = lsGetCollection('movies');

        document.getElementById('totalSongs').textContent = songs.length;
        document.getElementById('totalArtists').textContent = artists.length;
        document.getElementById('totalMovies').textContent = movies.length;
        document.getElementById('totalPlays').textContent = '0';

        const recentSongs = [...songs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const recentSongsTable = document.getElementById('recentSongsTable');
        recentSongsTable.innerHTML = recentSongs.slice(0, 5).map(song => createSongRow(song)).join('');
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// ============================================
// Song Management
// ============================================
async function loadAllSongs() {
    try {
        const songs = [...lsGetCollection('songs')].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        
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
                    <img src="${song.albumCover || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Ccircle cx="40" cy="40" r="30" fill="%2334d399" opacity="0.3"/%3E%3C/svg%3E'}" alt="${song.title}">
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
    
    const songData = {
        title: document.getElementById('songTitle').value,
        artist: document.getElementById('songArtist').value,
        movie: document.getElementById('songMovie').value,
        director: document.getElementById('songDirector').value,
        singer: document.getElementById('songSinger').value,
        language: document.getElementById('songLanguage').value,
        genre: document.getElementById('songGenre').value,
        duration: document.getElementById('songDuration').value,
        status: document.getElementById('songStatus').value,
        description: document.getElementById('songDescription').value,
        updatedAt: new Date().toISOString()
    };

    try {
        showToast('Saving song...', 'info');
        
        // Upload album cover to R2 if provided
        const albumFile = document.getElementById('albumImage').files[0];
        if (albumFile) {
            showToast('Uploading album cover...', 'info');
            try {
                const albumResult = await R2Uploader.uploadImage(albumFile, 'tamil-ai-fm/albums', (pct) => {
                    showToast(`Album cover: ${pct}%`, 'info');
                });
                songData.albumCover = albumResult.url;
                songData.albumPublicId = albumResult.publicId;
            } catch (err) {
                console.error('Album upload error:', err);
                showToast('Failed to upload album cover: ' + err.message, 'error');
            }
        }

        // Upload audio file to R2 if provided
        const audioFile = document.getElementById('audioFile').files[0];
        if (audioFile) {
            showToast('Uploading audio file...', 'info');
            try {
                const audioResult = await R2Uploader.uploadAudio(audioFile, 'tamil-ai-fm/audio', (pct) => {
                    showToast(`Audio: ${pct}%`, 'info');
                });
                songData.audioUrl = audioResult.url;
                songData.audioPublicId = audioResult.publicId;
                songData.audioFormat = audioResult.format;
                songData.audioSize = audioResult.bytes;
            } catch (err) {
                console.error('Audio upload error:', err);
                showToast('Failed to upload audio: ' + err.message, 'error');
            }
        }

        const songs = lsGetCollection('songs');

        if (currentSongId) {
            const idx = songs.findIndex(s => s.id === currentSongId);
            if (idx !== -1) songs[idx] = { ...songs[idx], ...songData };
            lsSetCollection('songs', songs);
            showToast('Song updated successfully!', 'success');
        } else {
            songData.id = generateId();
            songData.createdAt = new Date().toISOString();
            songData.plays = 0;
            songs.push(songData);
            lsSetCollection('songs', songs);
            showToast('Song added successfully!', 'success');
        }

        if (window.ContentSync && typeof window.ContentSync.syncCurrentState === 'function') {
            await window.ContentSync.syncCurrentState();
        }

        resetSongForm();
        navigateTo('songs');
    } catch (error) {
        console.error('Error saving song:', error);
        showToast('Error saving song: ' + error.message, 'error');
    }
}

async function editSong(songId) {
    try {
        const songs = lsGetCollection('songs');
        const song = songs.find(s => s.id === songId);
        if (song) {
            currentSongId = songId;
            
            document.getElementById('songFormTitle').textContent = 'Edit Song';
            document.getElementById('songTitle').value = song.title || '';
            document.getElementById('songArtist').value = song.artist || '';
            document.getElementById('songMovie').value = song.movie || '';
            document.getElementById('songDirector').value = song.director || '';
            document.getElementById('songSinger').value = song.singer || '';
            document.getElementById('songLanguage').value = song.language || 'Tamil';
            document.getElementById('songGenre').value = song.genre || 'Love';
            document.getElementById('songDuration').value = song.duration || '';
            document.getElementById('songStatus').value = song.status || 'published';
            document.getElementById('songDescription').value = song.description || '';

            if (song.albumCover) {
                document.getElementById('albumPreviewImg').src = song.albumCover;
                document.getElementById('albumPreview').style.display = 'flex';
            }

            navigateTo('add-song');
        }
    } catch (error) {
        console.error('Error loading song:', error);
        showToast('Error loading song', 'error');
    }
}

async function deleteSong(songId) {
    if (!confirm('Are you sure you want to delete this song?')) return;
    
    try {
        const songs = lsGetCollection('songs').filter(s => s.id !== songId);
        lsSetCollection('songs', songs);
        showToast('Song deleted successfully!', 'success');
        loadAllSongs();
    } catch (error) {
        console.error('Error deleting song:', error);
        showToast('Error deleting song', 'error');
    }
}

function previewSong(songId) {
    showToast('Preview feature - Song ID: ' + songId, 'info');
}

function resetSongForm() {
    document.getElementById('songForm').reset();
    currentSongId = null;
    uploadedAlbumUrl = null;
    uploadedAudioUrl = null;
    document.getElementById('songFormTitle').textContent = 'Add New Song';
    document.getElementById('albumPreview').style.display = 'none';
    document.getElementById('audioPreview').style.display = 'none';
}

// ============================================
// Categories Management
// ============================================
async function loadCategories() {
    try {
        const categories = lsGetCollection('categories');
        
        const tableBody = document.getElementById('categoriesTable');
        tableBody.innerHTML = categories.map(cat => `
            <tr>
                <td>${cat.name}</td>
                <td>${cat.description || 'N/A'}</td>
                <td>
                    <div class="actions">
                        <button class="action-btn" onclick="editCategory('${cat.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteCategory('${cat.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function saveCategory() {
    const name = prompt('Enter category name:');
    if (!name) return;
    
    const description = prompt('Enter category description:') || '';
    
    try {
        const categories = lsGetCollection('categories');
        categories.push({
            id: generateId(),
            name,
            description,
            createdAt: new Date().toISOString()
        });
        lsSetCollection('categories', categories);
        showToast('Category added successfully!', 'success');
        loadCategories();
    } catch (error) {
        console.error('Error saving category:', error);
        showToast('Error saving category', 'error');
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
        const categories = lsGetCollection('categories').filter(c => c.id !== categoryId);
        lsSetCollection('categories', categories);
        showToast('Category deleted successfully!', 'success');
        loadCategories();
    } catch (error) {
        console.error('Error deleting category:', error);
    }
}

function editCategory(categoryId) {
    showToast('Edit category feature - ID: ' + categoryId, 'info');
}

// ============================================
// Artists Management
// ============================================
async function loadArtists() {
    try {
        const artists = lsGetCollection('artists');
        
        const tableBody = document.getElementById('artistsTable');
        tableBody.innerHTML = artists.map(artist => `
            <tr>
                <td>${artist.name}</td>
                <td>${artist.type || 'Singer'}</td>
                <td>
                    <div class="actions">
                        <button class="action-btn" onclick="editArtist('${artist.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteArtist('${artist.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading artists:', error);
    }
}

async function saveArtist() {
    const name = prompt('Enter artist name:');
    if (!name) return;
    
    const type = prompt('Enter artist type (Singer/Actor/Director):') || 'Singer';
    
    try {
        const artists = lsGetCollection('artists');
        artists.push({
            id: generateId(),
            name,
            type,
            createdAt: new Date().toISOString()
        });
        lsSetCollection('artists', artists);
        showToast('Artist added successfully!', 'success');
        loadArtists();
    } catch (error) {
        console.error('Error saving artist:', error);
    }
}

async function deleteArtist(artistId) {
    if (!confirm('Are you sure you want to delete this artist?')) return;
    
    try {
        const artists = lsGetCollection('artists').filter(a => a.id !== artistId);
        lsSetCollection('artists', artists);
        showToast('Artist deleted successfully!', 'success');
        loadArtists();
    } catch (error) {
        console.error('Error deleting artist:', error);
    }
}

function editArtist(artistId) {
    showToast('Edit artist feature - ID: ' + artistId, 'info');
}

// ============================================
// Movies Management
// ============================================
async function loadMovies() {
    try {
        const movies = lsGetCollection('movies');
        
        const tableBody = document.getElementById('moviesTable');
        tableBody.innerHTML = movies.map(movie => `
            <tr>
                <td>${movie.title}</td>
                <td>${movie.year || 'N/A'}</td>
                <td>
                    <div class="actions">
                        <button class="action-btn" onclick="editMovie('${movie.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteMovie('${movie.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading movies:', error);
    }
}

async function saveMovie() {
    const title = prompt('Enter movie title:');
    if (!title) return;
    
    const year = prompt('Enter release year:') || '';
    
    try {
        const movies = lsGetCollection('movies');
        movies.push({
            id: generateId(),
            title,
            year,
            createdAt: new Date().toISOString()
        });
        lsSetCollection('movies', movies);
        showToast('Movie added successfully!', 'success');
        loadMovies();
    } catch (error) {
        console.error('Error saving movie:', error);
    }
}

async function deleteMovie(movieId) {
    if (!confirm('Are you sure you want to delete this movie?')) return;
    
    try {
        const movies = lsGetCollection('movies').filter(m => m.id !== movieId);
        lsSetCollection('movies', movies);
        showToast('Movie deleted successfully!', 'success');
        loadMovies();
    } catch (error) {
        console.error('Error deleting movie:', error);
    }
}

function editMovie(movieId) {
    showToast('Edit movie feature - ID: ' + movieId, 'info');
}

// ============================================
// Playlists Management
// ============================================
async function loadPlaylists() {
    try {
        const playlists = lsGetCollection('playlists');
        
        const tableBody = document.getElementById('playlistsTable');
        tableBody.innerHTML = playlists.map(playlist => `
            <tr>
                <td>${playlist.name}</td>
                <td>${playlist.songCount || 0} songs</td>
                <td>
                    <div class="actions">
                        <button class="action-btn" onclick="editPlaylist('${playlist.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deletePlaylist('${playlist.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
}

async function savePlaylist() {
    const name = prompt('Enter playlist name:');
    if (!name) return;
    
    try {
        const playlists = lsGetCollection('playlists');
        playlists.push({
            id: generateId(),
            name,
            songCount: 0,
            createdAt: new Date().toISOString()
        });
        lsSetCollection('playlists', playlists);
        showToast('Playlist created successfully!', 'success');
        loadPlaylists();
    } catch (error) {
        console.error('Error saving playlist:', error);
    }
}

async function deletePlaylist(playlistId) {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    
    try {
        const playlists = lsGetCollection('playlists').filter(p => p.id !== playlistId);
        lsSetCollection('playlists', playlists);
        showToast('Playlist deleted successfully!', 'success');
        loadPlaylists();
    } catch (error) {
        console.error('Error deleting playlist:', error);
    }
}

function editPlaylist(playlistId) {
    showToast('Edit playlist feature - ID: ' + playlistId, 'info');
}

// ============================================
// File Upload Handlers
// ============================================
function setupFileUploads() {
    // Album cover upload
    const albumUpload = document.getElementById('albumUpload');
    const albumInput = document.getElementById('albumImage');
    
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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 140px; left: 50%; transform: translateX(-50%);
        padding: 12px 24px; background: var(--bg-glass); border: 1px solid var(--border-glass);
        border-radius: var(--radius-md); color: var(--text-primary); font-family: var(--font-family);
        font-size: 0.85rem; font-weight: 500; z-index: 9999; animation: slideUp 0.3s ease-out;
        backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        max-width: calc(100% - 32px); text-align: center;
    `;
    if (type === 'success') {
        toast.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        toast.style.background = 'rgba(16, 185, 129, 0.1)';
    } else if (type === 'error') {
        toast.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        toast.style.background = 'rgba(239, 68, 68, 0.1)';
    }
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// Populate Dropdowns
// ============================================
async function populateDropdowns() {
    try {
        const artists = lsGetCollection('artists');
        const artistSelect = document.getElementById('songArtist');
        artistSelect.innerHTML = '<option value="">Select Artist</option>';
        artists.forEach(artist => {
            artistSelect.innerHTML += `<option value="${artist.name}">${artist.name}</option>`;
        });

        const movies = lsGetCollection('movies');
        const movieSelect = document.getElementById('songMovie');
        movieSelect.innerHTML = '<option value="">Select Movie</option>';
        movies.forEach(movie => {
            movieSelect.innerHTML += `<option value="${movie.title}">${movie.title}</option>`;
        });
    } catch (error) {
        console.error('Error populating dropdowns:', error);
    }
}

// ============================================
// Event Listeners
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!checkAdminAuth()) {
        window.location.href = 'admin-login.html';
        return;
    }

    // Navigation
    document.querySelectorAll('.admin-sidebar-item, .admin-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            if (page) navigateTo(page);
        });
    });

    // Logout
    document.getElementById('adminLogout')?.addEventListener('click', logout);

    // Song form submission
    document.getElementById('songForm')?.addEventListener('submit', saveSong);

    // Search functionality
    document.getElementById('songSearch')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#allSongsTable tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });

    // Category/Artist/Movie/Playlist buttons
    document.getElementById('addCategoryBtn')?.addEventListener('click', saveCategory);
    document.getElementById('addArtistBtn')?.addEventListener('click', saveArtist);
    document.getElementById('addMovieBtn')?.addEventListener('click', saveMovie);
    document.getElementById('addPlaylistBtn')?.addEventListener('click', savePlaylist);

    // Setup file uploads
    setupFileUploads();

    // Populate dropdowns
    populateDropdowns();

    // Load dashboard by default
    navigateTo('dashboard');

    // Mobile menu toggle
    const mobileToggle = document.getElementById('adminMobileToggle');
    const sidebar = document.querySelector('.admin-sidebar');
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
        sidebar.querySelectorAll('.admin-sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                const icon = mobileToggle.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            });
        });
    }

    console.log('%c🎙️ Tamil AI FM Admin', 'font-size:20px;font-weight:bold;color:#34d399;');
    console.log('%cAdmin Panel Loaded', 'font-size:12px;color:#6ee7b7;');
});

// ============================================
// Real-time Listeners (Frontend Integration)
// ============================================
function setupRealtimeListeners() {
    // No-op: localStorage-based storage has no real-time listeners
}

setupRealtimeListeners();