'use strict';

// ============================================
// Cloudinary Configuration
// ============================================
// Copy your credentials from .env file here
// Get from: https://console.cloudinary.com/ > Settings > API Keys

const CLOUDINARY_CONFIG = {
    cloudName: 'kf5qhitu',
    uploadPreset: 'tamil_ai_fm_unsigned'
};

// Cloudinary upload endpoint
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`;

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-m4a'];

// Max file sizes (bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_AUDIO_SIZE = 50 * 1024 * 1024;  // 50MB
