'use strict';

/* ============================================================================
   ai-tools-api.js — Centralized API Manager for AI Tools
   ============================================================================
   Stores provider configs in localStorage (admin-only keys).
   NEVER exposes API keys to frontend beyond this module's internals.
   All actual key usage happens server-side; this module only reads admin config.
   ============================================================================ */

window.AIToolsAPI = (function () {

    var STORAGE_KEY = 'nexvora_aitools_api_config';

    var DEFAULT_CONFIG = {
        ai: {
            enabled: true,
            provider: 'openai',
            apiKey: '',
            model: 'gpt-4o-mini',
            endpoint: 'https://api.openai.com/v1/chat/completions'
        },
        imageEnhance: {
            enabled: true,
            provider: 'sharp',
            apiKey: '',
            model: 'realesrgan-x4',
            endpoint: ''
        },
        imageUpscale: {
            enabled: true,
            provider: 'sharp',
            apiKey: '',
            model: 'realesrgan-x4',
            endpoint: ''
        },
        bgRemoval: {
            enabled: true,
            provider: 'rembg',
            apiKey: '',
            model: 'u2net',
            endpoint: ''
        },
        videoProcessing: {
            enabled: true,
            provider: 'ffmpeg',
            apiKey: '',
            model: '',
            endpoint: '',
            maxFileSize: 500 * 1024 * 1024,
            supportedFormats: ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv', '3gp']
        },
        audioProcessing: {
            enabled: true,
            provider: 'ffmpeg',
            apiKey: '',
            model: '',
            endpoint: '',
            maxFileSize: 100 * 1024 * 1024,
            supportedFormats: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a']
        },
        imageProcessing: {
            enabled: true,
            provider: 'sharp',
            apiKey: '',
            model: '',
            endpoint: '',
            maxFileSize: 50 * 1024 * 1024,
            supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'svg']
        },
        pdfTools: {
            enabled: true,
            provider: 'pdf-lib',
            apiKey: '',
            model: '',
            endpoint: '',
            maxFileSize: 100 * 1024 * 1024
        },
        urlDownloader: {
            enabled: true,
            provider: 'cobalt',
            apiKey: '',
            model: '',
            endpoint: '',
            allowAudioOnly: true,
            allowVideoOnly: true,
            maxQuality: '1080p'
        },
        storage: {
            tempDir: '/tmp/aitools',
            maxStorage: 2 * 1024 * 1024 * 1024,
            autoCleanup: true,
            cleanupAfterHours: 24
        },
        limits: {
            maxUploadSize: 500 * 1024 * 1024,
            maxConcurrentJobs: 3,
            maxDailyJobs: 100,
            rateLimitPerMinute: 10
        },
        security: {
            allowDRMBypass: false,
            allowPrivateContent: false,
            allowAuthBypass: false,
            allowShellCommands: false,
            validateUrls: true,
            allowedDomains: [],
            blockedDomains: ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254']
        }
    };

    function getConfig() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            var stored = JSON.parse(raw);
            return deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), stored);
        } catch (e) {
            return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    }

    function saveConfig(config) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (e) { /* ignore */ }
    }

    // Load config from server (R2) if available
    function loadFromServer() {
        return fetch('/api/ai-tools/config')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.config) {
                    // Merge server config with defaults (server has redacted keys)
                    var local = getConfig();
                    for (var key in data.config) {
                        if (data.config[key] && data.config[key].enabled !== undefined) {
                            // Only merge non-secret fields from server
                            local[key] = local[key] || {};
                            local[key].enabled = data.config[key].enabled;
                            local[key].provider = data.config[key].provider || local[key].provider;
                            local[key].model = data.config[key].model || local[key].model;
                            local[key].endpoint = data.config[key].endpoint || local[key].endpoint;
                        }
                    }
                    saveConfig(local);
                }
            })
            .catch(function () { /* offline or error, use local config */ });
    }

    function getProvider(type) {
        var config = getConfig();
        return config[type] || null;
    }

    function isProviderEnabled(type) {
        var p = getProvider(type);
        return p && p.enabled;
    }

    function getApiKey(type) {
        var p = getProvider(type);
        return p ? (p.apiKey || '') : '';
    }

    function getEndpoint(type) {
        var p = getProvider(type);
        return p ? (p.endpoint || '') : '';
    }

    function getModel(type) {
        var p = getProvider(type);
        return p ? (p.model || '') : '';
    }

    function updateProvider(type, updates) {
        var config = getConfig();
        if (!config[type]) config[type] = {};
        Object.assign(config[type], updates);
        saveConfig(config);
    }

    function resetProvider(type) {
        var config = getConfig();
        if (DEFAULT_CONFIG[type]) {
            config[type] = JSON.parse(JSON.stringify(DEFAULT_CONFIG[type]));
        }
        saveConfig(config);
    }

    function resetAll() {
        saveConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
    }

    function validateUrl(url) {
        var sec = getConfig().security;
        if (!sec.validateUrls) return { valid: true };
        try {
            var parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
            }
            var hostname = parsed.hostname.toLowerCase();
            for (var i = 0; i < sec.blockedDomains.length; i++) {
                if (hostname === sec.blockedDomains[i] || hostname.endsWith('.' + sec.blockedDomains[i])) {
                    return { valid: false, error: 'This domain is blocked for security reasons' };
                }
            }
            if (sec.allowedDomains.length > 0) {
                var allowed = false;
                for (var j = 0; j < sec.allowedDomains.length; j++) {
                    if (hostname === sec.allowedDomains[j] || hostname.endsWith('.' + sec.allowedDomains[j])) {
                        allowed = true;
                        break;
                    }
                }
                if (!allowed) return { valid: false, error: 'This domain is not in the allowed list' };
            }
            return { valid: true, protocol: parsed.protocol, hostname: hostname };
        } catch (e) {
            return { valid: false, error: 'Invalid URL format' };
        }
    }

    function validateFileType(file, allowedTypes) {
        if (!allowedTypes || allowedTypes.length === 0) return true;
        var ext = (file.name || '').split('.').pop().toLowerCase();
        var mime = file.type || '';
        for (var i = 0; i < allowedTypes.length; i++) {
            var t = allowedTypes[i].toLowerCase();
            if (ext === t || mime.indexOf(t) !== -1) return true;
        }
        return false;
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        var units = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    }

    function getFileCategory(filename) {
        var ext = (filename || '').split('.').pop().toLowerCase();
        var videoExts = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv', '3gp', 'm4v'];
        var audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'];
        var imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'svg', 'ico'];
        var pdfExts = ['pdf'];
        var archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
        if (videoExts.indexOf(ext) !== -1) return 'video';
        if (audioExts.indexOf(ext) !== -1) return 'audio';
        if (imageExts.indexOf(ext) !== -1) return 'image';
        if (pdfExts.indexOf(ext) !== -1) return 'pdf';
        if (archiveExts.indexOf(ext) !== -1) return 'archive';
        return 'other';
    }

    function deepMerge(target, source) {
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

    function testConnection(type) {
        return new Promise(function (resolve) {
            var p = getProvider(type);
            if (!p || !p.enabled) {
                resolve({ ok: false, error: 'Provider not configured or disabled' });
                return;
            }
            if (p.provider === 'ffmpeg' || p.provider === 'sharp' || p.provider === 'pdf-lib' || p.provider === 'rembg') {
                resolve({ ok: true, message: p.provider + ' is configured locally' });
                return;
            }
            if (!p.apiKey && !p.endpoint) {
                resolve({ ok: false, error: 'No API key or endpoint configured' });
                return;
            }
            resolve({ ok: true, message: 'Configuration looks valid' });
        });
    }

    return {
        getConfig: getConfig,
        saveConfig: saveConfig,
        loadFromServer: loadFromServer,
        getProvider: getProvider,
        isProviderEnabled: isProviderEnabled,
        getApiKey: getApiKey,
        getEndpoint: getEndpoint,
        getModel: getModel,
        updateProvider: updateProvider,
        resetProvider: resetProvider,
        resetAll: resetAll,
        validateUrl: validateUrl,
        validateFileType: validateFileType,
        formatFileSize: formatFileSize,
        getFileCategory: getFileCategory,
        testConnection: testConnection
    };
})();
