'use strict';
// Admin Upload - localStorage-based

// ============================================
// Global State
// ============================================
let selectedFile = null;
let isUploading = false;

// ============================================
// Tab Navigation
// ============================================
function switchTab(tabName) {
    document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.upload-panel').forEach(p => p.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Panel`).classList.add('active');

    resetForm();
}

// ============================================
// File Selection
// ============================================
function setupDragDrop() {
    const zones = document.querySelectorAll('.drop-zone');

    zones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });

        zone.addEventListener('click', () => {
            const input = zone.querySelector('input[type="file"]');
            if (input) input.click();
        });
    });

    document.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    });
}

function handleFileSelect(file) {
    if (!file) return;

    const activeTab = document.querySelector('.upload-tab.active').dataset.tab;
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');

    if (activeTab === 'song' && !isAudio) {
        showToast('Please select an audio file (MP3, WAV, etc.)', 'error');
        return;
    }

    if (activeTab === 'image' && !isImage) {
        showToast('Please select an image file (JPG, PNG, etc.)', 'error');
        return;
    }

    if (activeTab === 'logo' && !isImage) {
        showToast('Please select an image file for the logo', 'error');
        return;
    }

    if (isImage && file.size > 10 * 1024 * 1024) {
        showToast('Image must be less than 10MB', 'error');
        return;
    }

    if (isAudio && file.size > 50 * 1024 * 1024) {
        showToast('Audio must be less than 50MB', 'error');
        return;
    }

    selectedFile = file;
    showFilePreview(file);
}

function getActivePreviewEl() {
    const activeTab = document.querySelector('.upload-tab.active').dataset.tab;
    const map = { song: 'songFilePreview', image: 'imageFilePreview', logo: 'logoFilePreview' };
    return document.getElementById(map[activeTab]);
}

function showFilePreview(file) {
    const previewEl = getActivePreviewEl();
    if (!previewEl) return;
    const isImage = file.type.startsWith('image/');

    if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewEl.innerHTML = `
                <div class="preview-row">
                    <img src="${e.target.result}" alt="Preview" class="preview-thumb">
                    <div class="preview-details">
                        <div class="preview-filename">${file.name}</div>
                        <div class="preview-filesize">${formatFileSize(file.size)}</div>
                        <button class="preview-remove" onclick="removeFile()"><i class="fas fa-times"></i> Remove</button>
                    </div>
                </div>
            `;
            previewEl.classList.add('show');
        };
        reader.readAsDataURL(file);
    } else {
        previewEl.innerHTML = `
            <div class="preview-row">
                <div class="preview-audio-thumb"><i class="fas fa-music"></i></div>
                <div class="preview-details">
                    <div class="preview-filename">${file.name}</div>
                    <div class="preview-filesize">${formatFileSize(file.size)}</div>
                    <button class="preview-remove" onclick="removeFile()"><i class="fas fa-times"></i> Remove</button>
                </div>
            </div>
        `;
        previewEl.classList.add('show');
    }
}

function removeFile() {
    selectedFile = null;
    document.querySelectorAll('.file-preview-box').forEach(el => {
        el.classList.remove('show');
        el.innerHTML = '';
    });
    document.querySelectorAll('input[type="file"]').forEach(i => i.value = '');
}

// ============================================
// Upload Song
// ============================================
async function uploadSong() {
    if (!selectedFile) {
        showToast('Please select an audio file', 'error');
        return;
    }

    const title = document.getElementById('songTitle').value.trim();
    const artist = document.getElementById('songArtist').value.trim();
    const movie = document.getElementById('songMovie').value.trim();

    if (!title) {
        showToast('Please enter a song title', 'error');
        return;
    }

    if (isUploading) return;
    isUploading = true;

    const uploadBtn = document.getElementById('songUploadBtn');
    const progressBar = document.getElementById('songProgress');
    const progressFill = document.getElementById('songProgressFill');
    const progressText = document.getElementById('songProgressText');

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    progressBar.style.display = 'block';

    const toast = showUploadToast('Uploading audio to R2...', 'uploading');

    try {
        const result = await R2Uploader.uploadAudio(
            selectedFile,
            'tamil-ai-fm/audio',
            (percent) => {
                progressFill.style.width = percent + '%';
                progressText.textContent = `${percent}%`;
                toast.update(`Uploading audio... ${percent}%`);
            }
        );

        toast.update('Saving to database...');

        const songData = {
            title: title,
            artist: artist || 'Unknown Artist',
            movie: movie || 'Single',
            singer: document.getElementById('songSinger')?.value.trim() || '',
            language: document.getElementById('songLanguage')?.value || 'Tamil',
            genre: document.getElementById('songGenre')?.value || 'Love',
            duration: document.getElementById('songDuration')?.value.trim() || '',
            description: document.getElementById('songDescription')?.value.trim() || '',
            audioUrl: result.url,
            audioPublicId: result.publicId,
            audioFormat: result.format,
            audioSize: result.bytes,
            albumCover: '',
            status: 'published',
            plays: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const songs = JSON.parse(localStorage.getItem('admin_songs') || '[]');
        songs.push(songData);
        localStorage.setItem('admin_songs', JSON.stringify(songs));

        toast.succeed('Song uploaded successfully!');
        showToast('Song is now live on the website!', 'success');
        resetForm();
        loadRecentUploads();

    } catch (error) {
        console.error('Upload error:', error);
        toast.fail('Upload failed: ' + error.message);
        showToast('Upload failed. Please try again.', 'error');
    } finally {
        isUploading = false;
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Upload Song';
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
    }
}

// ============================================
// Upload Image
// ============================================
async function uploadImage() {
    if (!selectedFile) {
        showToast('Please select an image file', 'error');
        return;
    }

    const title = document.getElementById('imageTitle').value.trim();
    const category = document.getElementById('imageCategory').value;

    if (!title) {
        showToast('Please enter an image title', 'error');
        return;
    }

    if (isUploading) return;
    isUploading = true;

    const uploadBtn = document.getElementById('imageUploadBtn');
    const progressBar = document.getElementById('imageProgress');
    const progressFill = document.getElementById('imageProgressFill');
    const progressText = document.getElementById('imageProgressText');

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    progressBar.style.display = 'block';

    const toast = showUploadToast('Uploading image to R2...', 'uploading');

    try {
        const folderMap = {
            'album': 'tamil-ai-fm/albums',
            'banner': 'tamil-ai-fm/banners',
            'artist': 'tamil-ai-fm/artists',
            'other': 'tamil-ai-fm/images'
        };

        const result = await R2Uploader.uploadImage(
            selectedFile,
            folderMap[category] || 'tamil-ai-fm/images',
            (percent) => {
                progressFill.style.width = percent + '%';
                progressText.textContent = `${percent}%`;
                toast.update(`Uploading image... ${percent}%`);
            }
        );

        toast.update('Saving to database...');

        const imageData = {
            url: result.url,
            publicId: result.publicId,
            title: title,
            category: category,
            format: result.format,
            width: result.width,
            height: result.height,
            fileName: selectedFile.name,
            size: formatFileSize(selectedFile.size),
            createdAt: new Date().toISOString(),
            createdBy: 'admin'
        };

        const images = JSON.parse(localStorage.getItem('admin_images') || '[]');
        images.push(imageData);
        localStorage.setItem('admin_images', JSON.stringify(images));

        toast.succeed('Image uploaded successfully!');
        showToast('Image is now available on the website!', 'success');
        resetForm();
        loadRecentUploads();

    } catch (error) {
        console.error('Upload error:', error);
        toast.fail('Upload failed: ' + error.message);
        showToast('Upload failed. Please try again.', 'error');
    } finally {
        isUploading = false;
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Upload Image';
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
    }
}

// ============================================
// Upload Logo
// ============================================
async function uploadLogo() {
    if (!selectedFile) {
        showToast('Please select a logo image', 'error');
        return;
    }

    const stationName = document.getElementById('logoStationName').value.trim();
    const category = document.getElementById('logoCategory').value;

    if (!stationName) {
        showToast('Please enter a station/FM name', 'error');
        return;
    }

    if (isUploading) return;
    isUploading = true;

    const uploadBtn = document.getElementById('logoUploadBtn');
    const progressBar = document.getElementById('logoProgress');
    const progressFill = document.getElementById('logoProgressFill');
    const progressText = document.getElementById('logoProgressText');

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    progressBar.style.display = 'block';

    const toast = showUploadToast('Uploading logo to R2...', 'uploading');

    try {
        const result = await R2Uploader.uploadImage(
            selectedFile,
            'tamil-ai-fm/logos',
            (percent) => {
                progressFill.style.width = percent + '%';
                progressText.textContent = `${percent}%`;
                toast.update(`Uploading logo... ${percent}%`);
            }
        );

        toast.update('Saving to database...');

        const logoData = {
            url: result.url,
            publicId: result.publicId,
            stationName: stationName,
            category: category,
            format: result.format,
            width: result.width,
            height: result.height,
            fileName: selectedFile.name,
            size: formatFileSize(selectedFile.size),
            createdAt: new Date().toISOString(),
            createdBy: 'admin'
        };

        const logos = JSON.parse(localStorage.getItem('admin_logos') || '[]');
        logos.push(logoData);
        localStorage.setItem('admin_logos', JSON.stringify(logos));

        toast.succeed('Logo uploaded successfully!');
        showToast('Logo is now live on the website!', 'success');
        resetForm();
        loadRecentUploads();

    } catch (error) {
        console.error('Upload error:', error);
        toast.fail('Upload failed: ' + error.message);
        showToast('Upload failed. Please try again.', 'error');
    } finally {
        isUploading = false;
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Upload Logo';
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
    }
}

// ============================================
// Recent Uploads
// ============================================
async function loadRecentUploads() {
    try {
        const songs = JSON.parse(localStorage.getItem('admin_songs') || '[]');
        const images = JSON.parse(localStorage.getItem('admin_images') || '[]');

        const recentSongs = songs.slice(-5).reverse();
        const recentImages = images.slice(-5).reverse();

        const container = document.getElementById('recentUploads');
        let html = '';

        recentSongs.forEach(song => {
            const time = song.createdAt ? new Date(song.createdAt).toLocaleDateString() : 'Recently';
            html += `
                <div class="recent-item">
                    <div class="recent-icon audio"><i class="fas fa-music"></i></div>
                    <div class="recent-info">
                        <span class="recent-name">${song.title || 'Untitled'}</span>
                        <span class="recent-meta">${song.artist || 'Unknown'} &bull; ${time}</span>
                    </div>
                    <span class="recent-badge song">Song</span>
                </div>
            `;
        });

        recentImages.forEach(img => {
            const time = img.createdAt ? new Date(img.createdAt).toLocaleDateString() : 'Recently';
            html += `
                <div class="recent-item">
                    <div class="recent-thumb"><img src="${img.url}" alt="${img.title}"></div>
                    <div class="recent-info">
                        <span class="recent-name">${img.title || 'Untitled'}</span>
                        <span class="recent-meta">${img.category || 'other'} &bull; ${time}</span>
                    </div>
                    <span class="recent-badge image">Image</span>
                </div>
            `;
        });

        if (!html) {
            html = '<div class="recent-empty"><i class="fas fa-inbox"></i><p>No uploads yet</p></div>';
        }

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading recent uploads:', error);
    }
}

// ============================================
// Reset Form
// ============================================
function resetForm(type) {
    selectedFile = null;
    const formMap = { song: 'songForm', image: 'imageForm', logo: 'logoForm' };
    const form = document.getElementById(formMap[type]);
    if (form) form.reset();
    document.querySelectorAll('.file-preview-box').forEach(el => {
        el.classList.remove('show');
        el.innerHTML = '';
    });
}

// ============================================
// Utility
// ============================================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showToast(message, type = 'info') {
    showUploadToast(message, type);
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setupDragDrop();
    loadRecentUploads();

    document.querySelectorAll('.upload-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.getElementById('songForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        uploadSong();
    });

    document.getElementById('imageForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        uploadImage();
    });

    document.getElementById('logoForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        uploadLogo();
    });

    console.log('%c🎙️ Tamil AI FM - Admin Upload', 'font-size:18px;font-weight:bold;color:#34d399;');
    console.log('%cR2 Upload Panel Ready', 'font-size:12px;color:#6ee7b7;');
});
