'use strict';

// ============================================
// Cloudinary Upload Utility
// ============================================

const CloudinaryUploader = {
    /**
     * Upload a file to Cloudinary with progress tracking
     * @param {File} file - The file to upload
     * @param {string} folder - Cloudinary folder (e.g., 'tamil-ai-stream/albums')
     * @param {Function} onProgress - Progress callback (0-100)
     * @returns {Promise<{url: string, publicId: string, format: string, bytes: number}>}
     */
    async upload(file, folder = 'tamil-ai-stream/general', onProgress = null) {
        if (!CLOUDINARY_CONFIG || !CLOUDINARY_CONFIG.cloudName) {
            throw new Error('Cloudinary not configured. Update cloudinary.config.js');
        }

        if (!file || file.size === 0) {
            throw new Error('No file selected or file is empty');
        }

        const isImage = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');

        if (!isImage && !isAudio) {
            throw new Error('Unsupported file type: ' + file.type);
        }

        if (isImage && file.size > MAX_IMAGE_SIZE) {
            throw new Error('Image too large. Max size: 10MB');
        }

        if (isAudio && file.size > MAX_AUDIO_SIZE) {
            throw new Error('Audio too large. Max size: 50MB');
        }

        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            formData.append('folder', folder);
            formData.append('resource_type', isAudio ? 'video' : 'image');

            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve({
                            url: response.secure_url,
                            publicId: response.public_id,
                            format: response.format,
                            bytes: response.bytes,
                            width: response.width || null,
                            height: response.height || null,
                            duration: response.duration || null
                        });
                    } catch (e) {
                        reject(new Error('Failed to parse upload response'));
                    }
                } else {
                    try {
                        const err = JSON.parse(xhr.responseText);
                        reject(new Error(err.error?.message || 'Upload failed with status ' + xhr.status));
                    } catch (e) {
                        reject(new Error('Upload failed with status ' + xhr.status));
                    }
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload. Check your connection.'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload cancelled'));
            });

            xhr.open('POST', CLOUDINARY_UPLOAD_URL);
            xhr.send(formData);
        });
    },

    /**
     * Upload image to Cloudinary
     */
    async uploadImage(file, folder = 'tamil-ai-stream/albums', onProgress = null) {
        return this.upload(file, folder, onProgress);
    },

    /**
     * Upload audio to Cloudinary
     */
    async uploadAudio(file, folder = 'tamil-ai-stream/audio', onProgress = null) {
        return this.upload(file, folder, onProgress);
    },

    /**
     * Delete a file from Cloudinary (requires API secret - server-side only)
     * For client-side, use the admin dashboard to manage
     */
    getDeleteUrl(publicId) {
        return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/resources/image/upload`;
    }
};

// ============================================
// Upload Progress UI
// ============================================
function showUploadToast(message, type = 'info') {
    const existing = document.querySelector('.upload-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `upload-toast upload-toast-${type}`;
    toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        display: flex; align-items: center; gap: 12px;
        padding: 14px 20px; min-width: 300px; max-width: 500px;
        background: rgba(17, 24, 39, 0.95); backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        transform: translateX(400px); opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const icons = {
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        uploading: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" class="upload-spinner"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
    };

    toast.innerHTML = `
        <div style="flex-shrink:0">${icons[type] || icons.info}</div>
        <div style="flex:1;font-size:0.85rem;color:#fff;font-weight:500">${message}</div>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    return {
        update(msg) {
            const msgEl = toast.querySelector('div:nth-child(2)');
            if (msgEl) msgEl.textContent = msg;
        },
        remove() {
            toast.style.transform = 'translateX(400px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        },
        succeed(msg) {
            toast.className = 'upload-toast upload-toast-success';
            toast.querySelector('div:first-child').innerHTML = icons.success;
            this.update(msg);
            setTimeout(() => this.remove(), 3000);
        },
        fail(msg) {
            toast.className = 'upload-toast upload-toast-error';
            toast.querySelector('div:first-child').innerHTML = icons.error;
            this.update(msg);
            setTimeout(() => this.remove(), 5000);
        }
    };
}

// Spinner animation
if (!document.querySelector('#upload-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'upload-spinner-style';
    style.textContent = `
        @keyframes uploadSpin { to { transform: rotate(360deg); } }
        .upload-spinner { animation: uploadSpin 1s linear infinite; }
    `;
    document.head.appendChild(style);
}
