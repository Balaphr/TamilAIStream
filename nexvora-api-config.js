'use strict';

// ============================================================================
// nexvora-api-config.js — Centralized API Configuration
// ============================================================================
// All API endpoints, timeouts, and environment settings live here.
// Never hardcode URLs elsewhere. Import this module or use
// window.NexvoraAPIConfig to access configuration.
//
// To connect your own Ubuntu-hosted FastAPI backend, set the values below
// or override them via environment variables:
//   VITE_AI_API_URL, VITE_AI_API_TIMEOUT, VITE_AI_API_KEY, etc.
//
// Architecture:
//   Frontend UI → AI Service Layer → Backend API → AI Model
// ============================================================================

window.NexvoraAPIConfig = (function () {

    // ---------------------------------------------------------------------------
    // Environment variable support (Vite-compatible)
    // In production, replace these with actual env vars or a runtime config endpoint.
    // ---------------------------------------------------------------------------
    var DEFAULT_BASE_URL = 'https://api.tamilai.stream';

    var env = {
        AI_API_URL:      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_API_URL)      || '',
        AI_API_KEY:      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_API_KEY)      || '',
        AI_API_TIMEOUT:  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_API_TIMEOUT)  || '30000',
        AI_STREAM:       (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_STREAM)       || 'false',
        AI_FALLBACK_URL: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_FALLBACK_URL)  || ''
    };

    // ---------------------------------------------------------------------------
    // API Endpoints — all routes in one place
    // ---------------------------------------------------------------------------
    var ENDPOINTS = {
        // Chat completions (OpenAI-compatible)
        chat:               '/v1/chat/completions',
        // Translation (TamilAI backend: POST /translate)
        translate:          '/translate',
        // Summarization
        summarize:          '/v1/summarize',
        // Document analysis
        analyzeDocument:    '/v1/analyze',
        // Model info / health check (TamilAI backend: GET /health)
        models:             '/v1/models',
        health:             '/health',
        // Embeddings (future)
        embeddings:         '/v1/embeddings'
    };

    // ---------------------------------------------------------------------------
    // Request defaults
    // ---------------------------------------------------------------------------
    var DEFAULTS = {
        temperature:    0.7,
        maxTokens:      4096,
        topP:           1.0,
        frequencyPenalty: 0,
        presencePenalty:  0,
        timeout:        parseInt(env.AI_API_TIMEOUT, 10) || 30000,
        retries:        2,
        retryDelay:     1000
    };

    // ---------------------------------------------------------------------------
    // Connection status tracking
    // ---------------------------------------------------------------------------
    var STATUS = {
        DISCONNECTED:   'disconnected',
        CONNECTING:     'connecting',
        CONNECTED:      'connected',
        ERROR:          'error',
        TIMEOUT:        'timeout'
    };

    var connectionState = {
        status: STATUS.DISCONNECTED,
        lastChecked: null,
        lastError: null,
        latency: null,
        modelInfo: null
    };

    // ---------------------------------------------------------------------------
    // Configuration store (persisted to localStorage)
    // ---------------------------------------------------------------------------
    var STORAGE_KEY = 'nexvora_api_config';

    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
    function lsGetJSON(key) { try { return JSON.parse(lsGet(key)); } catch (e) { return null; } }

    function loadConfig() {
        var saved = lsGetJSON(STORAGE_KEY) || {};
        return {
            baseUrl:    saved.baseUrl    || env.AI_API_URL    || DEFAULT_BASE_URL,
            apiKey:     saved.apiKey     || env.AI_API_KEY    || '',
            timeout:    saved.timeout    || DEFAULTS.timeout,
            stream:     saved.stream     || env.AI_STREAM === 'true',
            fallbackUrl: saved.fallbackUrl || env.AI_FALLBACK_URL || '',
            headers:    saved.headers    || {}
        };
    }

    function saveConfig(config) {
        lsSet(STORAGE_KEY, {
            baseUrl:    config.baseUrl,
            apiKey:     config.apiKey,
            timeout:    config.timeout,
            stream:     config.stream,
            fallbackUrl: config.fallbackUrl,
            headers:    config.headers
        });
    }

    function updateConfig(updates) {
        var config = loadConfig();
        Object.assign(config, updates);
        saveConfig(config);
        return config;
    }

    // ---------------------------------------------------------------------------
    // URL builder
    // ---------------------------------------------------------------------------
    function buildUrl(path, model) {
        var config = loadConfig();
        var base = '';

        if (model && model.endpoint) {
            // Use model-specific endpoint (full URL)
            base = model.endpoint.replace(/\/+$/, '');
        } else if (config.baseUrl) {
            // Use global API base URL
            base = config.baseUrl.replace(/\/+$/, '');
        } else {
            return null; // No URL configured
        }

        // If the path looks like a full URL, use it directly
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        return base + path;
    }

    // ---------------------------------------------------------------------------
    // Headers builder
    // ---------------------------------------------------------------------------
    function buildHeaders(model) {
        var config = loadConfig();
        var headers = {
            'Content-Type': 'application/json'
        };

        // Model-specific API key takes precedence
        if (model && model.apiKey) {
            headers['Authorization'] = 'Bearer ' + model.apiKey;
        } else if (config.apiKey) {
            headers['Authorization'] = 'Bearer ' + config.apiKey;
        }

        // Merge custom headers
        if (config.headers) {
            Object.keys(config.headers).forEach(function (key) {
                headers[key] = config.headers[key];
            });
        }

        return headers;
    }

    // ---------------------------------------------------------------------------
    // Connection status
    // ---------------------------------------------------------------------------
    function getStatus() {
        return Object.assign({}, connectionState);
    }

    function setStatus(status, error, latency) {
        connectionState.status = status;
        connectionState.lastChecked = Date.now();
        connectionState.lastError = error || null;
        connectionState.latency = latency || null;
    }

    function setModelInfo(info) {
        connectionState.modelInfo = info;
    }

    // ---------------------------------------------------------------------------
    // Health check (non-destructive, no model logic)
    // ---------------------------------------------------------------------------
    function checkHealth(model) {
        var config = loadConfig();
        var url = buildUrl(ENDPOINTS.health, model);
        if (!url) {
            setStatus(STATUS.DISCONNECTED, 'No API URL configured');
            return Promise.resolve(getStatus());
        }

        setStatus(STATUS.CONNECTING);
        var headers = buildHeaders(model);
        var timeout = config.timeout;

        return new Promise(function (resolve) {
            var controller = null;
            var timeoutId = null;

            if (typeof AbortController !== 'undefined') {
                controller = new AbortController();
                timeoutId = setTimeout(function () { controller.abort(); }, Math.min(timeout, 5000));
            }

            var fetchOptions = {
                method: 'GET',
                headers: headers
            };
            if (controller) fetchOptions.signal = controller.signal;

            var start = Date.now();

            fetch(url, fetchOptions)
                .then(function (res) {
                    if (timeoutId) clearTimeout(timeoutId);
                    var latency = Date.now() - start;
                    if (res.ok) {
                        setStatus(STATUS.CONNECTED, null, latency);
                        return res.json().catch(function () { return {}; });
                    } else {
                        setStatus(STATUS.ERROR, 'HTTP ' + res.status);
                    }
                    resolve(getStatus());
                })
                .catch(function (err) {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (err.name === 'AbortError') {
                        setStatus(STATUS.TIMEOUT, 'Request timed out');
                    } else {
                        setStatus(STATUS.ERROR, err.message || 'Connection failed');
                    }
                    resolve(getStatus());
                });
        });
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    return {
        // Constants
        ENDPOINTS: ENDPOINTS,
        DEFAULTS: DEFAULTS,
        STATUS: STATUS,

        // Config management
        load: loadConfig,
        save: saveConfig,
        update: updateConfig,

        // URL & headers
        buildUrl: buildUrl,
        buildHeaders: buildHeaders,

        // Connection status
        getStatus: getStatus,
        setStatus: setStatus,
        setModelInfo: setModelInfo,
        checkHealth: checkHealth,

        // Quick check
        isConfigured: function () {
            var config = loadConfig();
            return !!(config.baseUrl);
        }
    };

})();
