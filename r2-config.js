'use strict';

// ============================================
// R2 Configuration
// ============================================

const R2_CONFIG = {
    apiBase: '/api',
    maxImageSize: 10 * 1024 * 1024,  // 10MB
    maxAudioSize: 50 * 1024 * 1024,  // 50MB
};

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-m4a'];

// Max file sizes (bytes)
const MAX_IMAGE_SIZE = R2_CONFIG.maxImageSize;
const MAX_AUDIO_SIZE = R2_CONFIG.maxAudioSize;

if (typeof window !== 'undefined') {
    window.__R2_CONFIG__ = window.__R2_CONFIG__ || R2_CONFIG;
}
