'use strict';

// ============================================================================
// nexvora-ai-service.js — AI Service Layer
// ============================================================================
// Reusable service functions that sit between the UI and the backend API.
// The UI calls these functions; they handle configuration, error states,
// retries, timeouts, and response parsing.
//
// When connecting your own Ubuntu-hosted FastAPI backend:
//   1. Set the API URL in NexvoraAPIConfig (or via VITE_AI_API_URL env var)
//   2. Implement your backend to accept these request formats
//   3. The UI components do not need to change
//
// Architecture:
//   Frontend UI → THIS SERVICE LAYER → Backend API → AI Model
//
// Never put model logic, API keys, or URLs in UI components.
// ============================================================================

window.NexvoraAIService = (function () {

    // Lazy getter — always reads fresh from window so load order doesn't matter
    var _fallbackConfig = {
        ENDPOINTS: { chat: '/v1/chat/completions', translate: '/translate', health: '/health', models: '/v1/models' },
        DEFAULTS: { temperature: 0.7, maxTokens: 4096, timeout: 30000, retries: 2, retryDelay: 1000 },
        STATUS: { DISCONNECTED: 'disconnected', CONNECTING: 'connecting', CONNECTED: 'connected', ERROR: 'error', TIMEOUT: 'timeout' },
        load: function () { return { baseUrl: '', apiKey: '', timeout: 30000, stream: false, fallbackUrl: '', headers: {} }; },
        save: function () {},
        update: function () { return this.load(); },
        buildUrl: function (p) { return p; },
        buildHeaders: function () { return { 'Content-Type': 'application/json' }; },
        getStatus: function () { return { status: 'error', lastChecked: null, lastError: 'Config not loaded', latency: null, modelInfo: null }; },
        setStatus: function () {},
        setModelInfo: function () {},
        checkHealth: function () { return Promise.resolve(this.getStatus()); },
        isConfigured: function () { return false; }
    };
    function getConfig() {
        if (!window.NexvoraAPIConfig) {
            console.warn('[NexvoraAIService] NexvoraAPIConfig not found on window, using fallback config');
            return _fallbackConfig;
        }
        return window.NexvoraAPIConfig;
    }
    var Manager = null; // Set after ModelManager loads

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------
    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
    function lsGetJSON(key) { try { return JSON.parse(lsGet(key)); } catch (e) { return null; } }

    function getManager() {
        if (!Manager) Manager = window.NexvoraModelManager;
        return Manager;
    }

    function getActiveModel() {
        var m = getManager();
        return m ? m.getActiveModel() : null;
    }

    // ---------------------------------------------------------------------------
    // Error types
    // ---------------------------------------------------------------------------
    var ServiceError = {
        NO_MODEL:           { code: 'NO_MODEL',           message: 'No active model configured. Open Model Manager to add one.' },
        NO_ENDPOINT:        { code: 'NO_ENDPOINT',        message: 'No API endpoint configured. Edit the model in Model Manager.' },
        NO_API_CONFIG:      { code: 'NO_API_CONFIG',      message: 'API not configured. Set the API URL in Settings or Model Manager.' },
        MODEL_DISABLED:     { code: 'MODEL_DISABLED',     message: 'Active model is disabled. Enable it in Model Manager.' },
        CAPABILITY_MISSING: { code: 'CAPABILITY_MISSING', message: 'Active model does not support this capability.' },
        TIMEOUT:            { code: 'TIMEOUT',            message: 'Request timed out. Check your network and API endpoint.' },
        NETWORK_ERROR:      { code: 'NETWORK_ERROR',      message: 'Network error. Check your internet connection.' },
        API_ERROR:          { code: 'API_ERROR',          message: 'API returned an error.' },
        NOT_CONNECTED:      { code: 'NOT_CONNECTED',      message: 'AI backend not connected. Configure your API endpoint in Settings.' }
    };

    function createError(type, detail) {
        var err = new Error(type.message);
        err.code = type.code;
        err.detail = detail || null;
        return err;
    }

    // ---------------------------------------------------------------------------
    // Pre-flight checks
    // ---------------------------------------------------------------------------
    function validateModel(requiredCapability) {
        var model = getActiveModel();

        if (!model) {
            return { valid: false, error: createError(ServiceError.NO_MODEL) };
        }

        if (!model.enabled) {
            return { valid: false, error: createError(ServiceError.MODEL_DISABLED) };
        }

        if (!model.endpoint) {
            // If no endpoint, check if global API URL can serve as fallback
            var config = getConfig().load();
            if (config.baseUrl) {
                // Global config available — use it as the endpoint fallback
                model.endpoint = config.baseUrl;
            } else if (model.provider === 'custom' || model.provider === 'TamilAI') {
                return { valid: false, error: createError(ServiceError.NO_ENDPOINT) };
            } else {
                return { valid: false, error: createError(ServiceError.NO_API_CONFIG) };
            }
        }

        if (requiredCapability) {
            var caps = model.capabilities || [];
            // Normalize capability names for comparison (translate === translation, etc.)
            var normalizedRequired = requiredCapability === 'translate' ? 'translation' : requiredCapability;
            var hasCapability = caps.some(function (c) {
                var nc = c === 'translate' ? 'translation' : c;
                return nc === normalizedRequired;
            });
            // 'chat' is always available as a base capability
            if (normalizedRequired !== 'chat' && caps.length > 0 && !hasCapability) {
                return { valid: false, error: createError(ServiceError.CAPABILITY_MISSING, 'Required: ' + requiredCapability) };
            }
        }

        return { valid: true, model: model };
    }

    // ---------------------------------------------------------------------------
    // HTTP request with timeout and retries
    // ---------------------------------------------------------------------------
    async function makeRequest(url, headers, body, options) {
        options = options || {};
        var config = getConfig().load();
        var timeout = options.timeout || config.timeout || getConfig().DEFAULTS.timeout;
        var retries = options.retries !== undefined ? options.retries : getConfig().DEFAULTS.retries;
        var retryDelay = options.retryDelay || getConfig().DEFAULTS.retryDelay;

        var lastError = null;

        for (var attempt = 0; attempt <= retries; attempt++) {
            if (attempt > 0) {
                await new Promise(function (r) { setTimeout(r, retryDelay); });
            }

            var controller = null;
            var timeoutId = null;

            try {
                if (typeof AbortController !== 'undefined') {
                    controller = new AbortController();
                    timeoutId = setTimeout(function () { controller.abort(); }, timeout);
                }

                var fetchOptions = {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body)
                };
                if (controller) fetchOptions.signal = controller.signal;

                var start = Date.now();
                var res = await fetch(url, fetchOptions);
                if (timeoutId) clearTimeout(timeoutId);
                var latency = Date.now() - start;

                if (!res.ok) {
                    var errorText = '';
                    try { errorText = await res.text(); } catch (e) { /* ignore */ }
                    var errDetail = { status: res.status, body: errorText, latency: latency };

                    // Retry on 5xx errors
                    if (res.status >= 500 && attempt < retries) {
                        lastError = createError(ServiceError.API_ERROR, errDetail);
                        continue;
                    }

                    throw createError(ServiceError.API_ERROR, errDetail);
                }

                var data = await res.json();
                return { data: data, latency: latency };

            } catch (err) {
                if (timeoutId) clearTimeout(timeoutId);

                // Already a ServiceError from above — throw immediately (unless retrying 5xx)
                if (err.code && err.code !== 'TIMEOUT' && err.code !== 'NETWORK_ERROR') {
                    throw err;
                }

                if (err.name === 'AbortError') {
                    throw createError(ServiceError.TIMEOUT, { timeout: timeout });
                }

                lastError = err;

                // Network/fetch error — retry if attempts remain
                if (attempt < retries) {
                    continue;
                }

                throw createError(ServiceError.NETWORK_ERROR, { original: err.message });
            }
        }

        // Should not reach here, but just in case
        throw lastError || createError(ServiceError.NETWORK_ERROR, { original: 'Request failed' });
    }

    // ---------------------------------------------------------------------------
    // Response parser (OpenAI-compatible + fallbacks)
    // ---------------------------------------------------------------------------
    function parseResponse(data, modelName) {
        // Standard OpenAI-compatible
        if (data.choices && data.choices[0]) {
            var choice = data.choices[0];
            return {
                content: choice.message ? choice.message.content : choice.text || '',
                model: data.model || modelName || 'unknown',
                usage: data.usage || null,
                finishReason: choice.finish_reason || null
            };
        }

        // Anthropic format
        if (data.content && Array.isArray(data.content)) {
            var textParts = data.content.filter(function (c) { return c.type === 'text'; });
            return {
                content: textParts.map(function (c) { return c.text; }).join(''),
                model: data.model || modelName || 'unknown',
                usage: data.usage || null,
                finishReason: data.stop_reason || null
            };
        }

        // TamilAI translation format: { tamil, english }
        if (data.tamil !== undefined && data.english !== undefined) {
            return {
                content: data.english,
                model: modelName || 'TamilAI Translator',
                usage: null,
                finishReason: null,
                source: data.tamil
            };
        }

        // Fallback
        return {
            content: data.response || data.content || data.text || data.output || data.english || JSON.stringify(data),
            model: data.model || modelName || 'unknown',
            usage: data.usage || null,
            finishReason: null
        };
    }

    // ---------------------------------------------------------------------------
    // SERVICE: sendChatMessage
    // ---------------------------------------------------------------------------
    async function sendChatMessage(messages, options) {
        options = options || {};

        // Always use standard chat format — never use requestBodyTemplate for chat
        var validation = validateModel('chat');
        if (!validation.valid) {
            throw validation.error;
        }

        var model = validation.model;
        console.log('[NexvoraAIService] Active model:', JSON.stringify({ id: model.id, name: model.name, endpoint: model.endpoint, modelId: model.modelId, apiKey: model.apiKey ? '(set)' : '(empty)', capabilities: model.capabilities }));
        var headers = getConfig().buildHeaders(model);
        var url;
        var body;

        // Build the URL: use model endpoint directly, or fall back to global config
        if (model.endpoint) {
            url = model.endpoint.replace(/\/+$/, '');
        } else {
            var cfg = getConfig().load();
            if (cfg.baseUrl) {
                url = getConfig().buildUrl(getConfig().ENDPOINTS.chat, model);
            }
        }

        // Always build standard OpenAI-compatible chat body
        body = {
            model: model.modelId || model.id,
            messages: messages,
            stream: false
        };

        // Only add optional params if they have explicit values
        if (options.maxTokens || model.maxTokens) {
            body.max_tokens = options.maxTokens || model.maxTokens || getConfig().DEFAULTS.maxTokens;
        }
        if (options.temperature !== undefined) {
            body.temperature = options.temperature;
        } else {
            body.temperature = getConfig().DEFAULTS.temperature;
        }

        if (!url) {
            throw createError(ServiceError.NO_API_CONFIG);
        }

        if (options.systemPrompt && body.messages) {
            body.messages = [{ role: 'system', content: options.systemPrompt }].concat(body.messages);
        }

        // Diagnostic logging
        console.log('[NexvoraAIService] sendChatMessage → URL:', url);
        console.log('[NexvoraAIService] sendChatMessage → Method: POST');
        console.log('[NexvoraAIService] sendChatMessage → Headers:', JSON.stringify(headers));
        console.log('[NexvoraAIService] sendChatMessage → Body:', JSON.stringify(body));

        getConfig().setStatus(getConfig().STATUS.CONNECTING);

        try {
            var result = await makeRequest(url, headers, body, options);
            var parsed = parseResponse(result.data, model.name);
            getConfig().setStatus(getConfig().STATUS.CONNECTED, null, result.latency);
            getConfig().setModelInfo({
                name: model.name,
                provider: model.provider,
                model: result.data.model || model.id
            });
            return parsed;
        } catch (err) {
            console.error('[NexvoraAIService] sendChatMessage error:', err.code, err.message, err.detail);
            getConfig().setStatus(getConfig().STATUS.ERROR, err.message);
            throw err;
        }
    }

    // ---------------------------------------------------------------------------
    // SERVICE: translateText
    // Supports two backend formats:
    //   1. TamilAI backend: POST /translate with { tamil } → { tamil, english }
    //   2. Generic: uses chat with translation prompt as fallback
    // ---------------------------------------------------------------------------
    async function translateText(text, targetLang, sourceLang, options) {
        options = options || {};
        var validation = validateModel('translate');
        if (!validation.valid) {
            // Fallback: try chat capability for translation via prompt
            var chatValidation = validateModel('chat');
            if (!chatValidation.valid) {
                throw validation.error;
            }
            // Use chat with translation prompt
            var systemPrompt = 'You are a professional translator. Translate the following text' +
                (sourceLang ? ' from ' + sourceLang : '') +
                ' to ' + targetLang + '. Output only the translated text, nothing else.';
            return sendChatMessage(
                [{ role: 'user', content: text }],
                Object.assign({}, options, { systemPrompt: systemPrompt })
            );
        }

        var model = validation.model;

        // Use model endpoint directly if it's a custom provider (endpoint IS the full URL)
        var url;
        if (model.requestBodyTemplate || model.provider === 'custom' || model.provider === 'TamilAI') {
            url = model.endpoint ? model.endpoint.replace(/\/+$/, '') : null;
        } else {
            url = getConfig().buildUrl(getConfig().ENDPOINTS.translate, model);
        }
        if (!url) throw createError(ServiceError.NO_API_CONFIG);

        var headers = getConfig().buildHeaders(model);

        // Build request body: use template if available, otherwise default TamilAI format
        var body;
        if (model.requestBodyTemplate) {
            try {
                body = JSON.parse(model.requestBodyTemplate.replace(/\{\{input\}\}/g, text));
            } catch (e) {
                body = { tamil: text };
            }
        } else {
            body = { tamil: text };
        }

        var result = await makeRequest(url, headers, body, options);
        var data = result.data;
        if (data && data.english !== undefined) {
            return {
                content: data.english,
                model: model.name,
                usage: null,
                finishReason: null,
                source: data.tamil || text
            };
        }
        return parseResponse(data, model.name);
    }

    // ---------------------------------------------------------------------------
    // SERVICE: summarizeText
    // ---------------------------------------------------------------------------
    function summarizeText(text, options) {
        options = options || {};
        var validation = validateModel('summarize');
        if (!validation.valid) {
            var chatValidation = validateModel('chat');
            if (!chatValidation.valid) {
                return Promise.reject(validation.error);
            }
            var systemPrompt = 'You are a text summarizer. Summarize the following text concisely. ' +
                'Focus on key points and main ideas. Keep it ' +
                (options.maxWords ? 'under ' + options.maxWords + ' words' : 'concise') + '.';
            return sendChatMessage(
                [{ role: 'user', content: text }],
                Object.assign({}, options, { systemPrompt: systemPrompt })
            );
        }

        var model = validation.model;
        var url = getConfig().buildUrl(getConfig().ENDPOINTS.summarize, model);
        if (!url) return Promise.reject(createError(ServiceError.NO_API_CONFIG));

        var headers = getConfig().buildHeaders(model);
        var body = {
            text: text,
            maxLength: options.maxLength || 200,
            model: model.modelId || model.id
        };

        return makeRequest(url, headers, body, options)
            .then(function (result) {
                return parseResponse(result.data, model.name);
            });
    }

    // ---------------------------------------------------------------------------
    // SERVICE: analyzeDocument
    // ---------------------------------------------------------------------------
    function analyzeDocument(content, options) {
        options = options || {};
        var validation = validateModel('document');
        if (!validation.valid) {
            var chatValidation = validateModel('chat');
            if (!chatValidation.valid) {
                return Promise.reject(validation.error);
            }
            var systemPrompt = 'You are a document analysis assistant. Analyze the following document ' +
                'and provide: key points, summary, entities, and sentiment. Be thorough but concise.';
            return sendChatMessage(
                [{ role: 'user', content: content }],
                Object.assign({}, options, { systemPrompt: systemPrompt })
            );
        }

        var model = validation.model;
        var url = getConfig().buildUrl(getConfig().ENDPOINTS.analyzeDocument, model);
        if (!url) return Promise.reject(createError(ServiceError.NO_API_CONFIG));

        var headers = getConfig().buildHeaders(model);
        var body = {
            content: content,
            analysisType: options.type || 'full',
            model: model.modelId || model.id
        };

        return makeRequest(url, headers, body, options)
            .then(function (result) {
                return parseResponse(result.data, model.name);
            });
    }

    // ---------------------------------------------------------------------------
    // SERVICE: generateCode
    // ---------------------------------------------------------------------------
    function generateCode(prompt, language, options) {
        options = options || {};
        var systemPrompt = 'You are an expert programmer. ' +
            (language ? 'Write code in ' + language + '. ' : '') +
            'Provide clean, well-commented code. ' +
            'If the prompt asks for explanation, provide it after the code.';

        return sendChatMessage(
            [{ role: 'user', content: prompt }],
            Object.assign({}, options, { systemPrompt: systemPrompt })
        );
    }

    // ---------------------------------------------------------------------------
    // SERVICE: checkConnection
    // ---------------------------------------------------------------------------
    function checkConnection(model) {
        var m = model || getActiveModel();
        if (!m) {
            getConfig().setStatus(getConfig().STATUS.DISCONNECTED, 'No model configured');
            return Promise.resolve(getConfig().getStatus());
        }
        return getConfig().checkHealth(m);
    }

    // ---------------------------------------------------------------------------
    // SERVICE: getModelStatus (for UI display)
    // ---------------------------------------------------------------------------
    function getModelStatus() {
        var model = getActiveModel();
        var configStatus = getConfig().getStatus();

        if (!model) {
            return {
                status: 'no-model',
                label: 'No Model',
                detail: 'Add a model in Model Manager',
                connected: false,
                icon: 'fa-circle-xmark'
            };
        }

        if (!model.enabled) {
            return {
                status: 'disabled',
                label: model.name,
                detail: 'Model is disabled',
                connected: false,
                icon: 'fa-circle-pause'
            };
        }

        if (!model.endpoint && !getConfig().isConfigured()) {
            return {
                status: 'not-configured',
                label: model.name,
                detail: 'No API endpoint set',
                connected: false,
                icon: 'fa-circle-question'
            };
        }

        if (configStatus.status === getConfig().STATUS.CONNECTED) {
            return {
                status: 'connected',
                label: model.name,
                detail: configStatus.latency ? configStatus.latency + 'ms' : 'Connected',
                connected: true,
                icon: 'fa-circle-check'
            };
        }

        if (configStatus.status === getConfig().STATUS.ERROR) {
            return {
                status: 'error',
                label: model.name,
                detail: configStatus.lastError || 'Connection error',
                connected: false,
                icon: 'fa-circle-exclamation'
            };
        }

        return {
            status: 'ready',
            label: model.name,
            detail: model.provider || 'Ready',
            connected: false,
            icon: 'fa-circle'
        };
    }

    // ---------------------------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------------------------
    return {
        // Core services
        sendChatMessage:    sendChatMessage,
        translateText:      translateText,
        summarizeText:      summarizeText,
        analyzeDocument:    analyzeDocument,
        generateCode:       generateCode,

        // Connection management
        checkConnection:    checkConnection,
        getModelStatus:     getModelStatus,

        // Validation
        validateModel:      validateModel,

        // Error types (for UI to reference)
        ServiceError:       ServiceError,

        // Config reference
        getConfig:           getConfig
    };

})();
