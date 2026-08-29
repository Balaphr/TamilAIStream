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

    var Config = window.NexvoraAPIConfig;
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
            var config = Config.load();
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
    function makeRequest(url, headers, body, options) {
        options = options || {};
        var config = Config.load();
        var timeout = options.timeout || config.timeout || Config.DEFAULTS.timeout;
        var retries = options.retries !== undefined ? options.retries : Config.DEFAULTS.retries;
        var retryDelay = options.retryDelay || Config.DEFAULTS.retryDelay;

        function attempt(retriesLeft) {
            return new Promise(function (resolve, reject) {
                var controller = null;
                var timeoutId = null;

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

                fetch(url, fetchOptions)
                    .then(function (res) {
                        if (timeoutId) clearTimeout(timeoutId);
                        var latency = Date.now() - start;

                        if (!res.ok) {
                            return res.text().then(function (text) {
                                var errDetail = { status: res.status, body: text, latency: latency };

                                // Retry on 5xx errors
                                if (res.status >= 500 && retriesLeft > 0) {
                                    return new Promise(function (resolveRetry) {
                                        setTimeout(function () {
                                            attempt(retriesLeft - 1).then(resolveRetry).catch(resolveRetry);
                                        }, retryDelay);
                                    });
                                }

                                reject(createError(ServiceError.API_ERROR, errDetail));
                            });
                        }

                        return res.json();
                    })
                    .then(function (data) {
                        resolve({ data: data, latency: Date.now() - start });
                    })
                    .catch(function (err) {
                        if (timeoutId) clearTimeout(timeoutId);

                        if (err.code) {
                            // Already a ServiceError
                            reject(err);
                            return;
                        }

                        if (err.name === 'AbortError') {
                            reject(createError(ServiceError.TIMEOUT, { timeout: timeout }));
                            return;
                        }

                        // Network error — retry
                        if (retriesLeft > 0) {
                            setTimeout(function () {
                                attempt(retriesLeft - 1).then(resolve).catch(reject);
                            }, retryDelay);
                            return;
                        }

                        reject(createError(ServiceError.NETWORK_ERROR, { original: err.message }));
                    });
            });
        }

        return attempt(retries);
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
    function sendChatMessage(messages, options) {
        options = options || {};
        var validation = validateModel('chat');
        if (!validation.valid) {
            // If chat capability fails but translation is available, try translate fallback
            var translateValidation = validateModel('translation');
            if (translateValidation.valid && messages.length > 0) {
                var lastMsg = messages[messages.length - 1];
                if (lastMsg && lastMsg.content) {
                    return translateText(lastMsg.content, 'en', 'ta', options);
                }
            }
            return Promise.reject(validation.error);
        }

        var model = validation.model;
        var headers = Config.buildHeaders(model);
        var url;
        var body;

        // Custom providers with requestBodyTemplate: use endpoint directly
        if (model.requestBodyTemplate) {
            url = model.endpoint.replace(/\/+$/, '');

            // Extract the last user message text for the template
            var inputText = '';
            for (var i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    inputText = messages[i].content;
                    break;
                }
            }

            try {
                body = JSON.parse(model.requestBodyTemplate.replace(/\{\{input\}\}/g, inputText));
            } catch (e) {
                body = { tamil: inputText };
            }
        } else if (model.provider === 'custom' || model.provider === 'TamilAI') {
            // Custom providers without template: use endpoint directly with simplified body
            url = model.endpoint.replace(/\/+$/, '');
            body = {
                messages: messages,
                model: model.modelId || model.id
            };
        } else {
            // Standard OpenAI-compatible providers: append /v1/chat/completions
            url = Config.buildUrl(Config.ENDPOINTS.chat, model);
            body = {
                model: model.modelId || model.id,
                messages: messages,
                max_tokens: options.maxTokens || model.maxTokens || Config.DEFAULTS.maxTokens,
                temperature: options.temperature !== undefined ? options.temperature : Config.DEFAULTS.temperature,
                top_p: options.topP || Config.DEFAULTS.topP,
                stream: options.stream || false
            };
        }

        if (!url) {
            return Promise.reject(createError(ServiceError.NO_API_CONFIG));
        }

        if (options.systemPrompt && body.messages) {
            body.messages = [{ role: 'system', content: options.systemPrompt }].concat(body.messages);
        }

        Config.setStatus(Config.STATUS.CONNECTING);

        return makeRequest(url, headers, body, options)
            .then(function (result) {
                var parsed = parseResponse(result.data, model.name);
                Config.setStatus(Config.STATUS.CONNECTED, null, result.latency);
                Config.setModelInfo({
                    name: model.name,
                    provider: model.provider,
                    model: result.data.model || model.id
                });
                return parsed;
            })
            .catch(function (err) {
                Config.setStatus(Config.STATUS.ERROR, err.message);
                throw err;
            });
    }

    // ---------------------------------------------------------------------------
    // SERVICE: translateText
    // Supports two backend formats:
    //   1. TamilAI backend: POST /translate with { tamil } → { tamil, english }
    //   2. Generic: uses chat with translation prompt as fallback
    // ---------------------------------------------------------------------------
    function translateText(text, targetLang, sourceLang, options) {
        options = options || {};
        var validation = validateModel('translate');
        if (!validation.valid) {
            // Fallback: try chat capability for translation via prompt
            var chatValidation = validateModel('chat');
            if (!chatValidation.valid) {
                return Promise.reject(validation.error);
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
            url = Config.buildUrl(Config.ENDPOINTS.translate, model);
        }
        if (!url) return Promise.reject(createError(ServiceError.NO_API_CONFIG));

        var headers = Config.buildHeaders(model);

        // Build request body: use template if available, otherwise default TamilAI format
        var body;
        if (model.requestBodyTemplate) {
            try {
                body = JSON.parse(model.requestBodyTemplate.replace(/\{\{input\}\}/g, text));
            } catch (e) {
                // Fallback to default format if template is invalid
                body = { tamil: text };
            }
        } else {
            // Default TamilAI backend format: { tamil: "text" }
            body = { tamil: text };
        }

        return makeRequest(url, headers, body, options)
            .then(function (result) {
                // TamilAI backend returns { tamil, english }
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
                // Fallback to generic response parsing
                return parseResponse(data, model.name);
            });
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
        var url = Config.buildUrl(Config.ENDPOINTS.summarize, model);
        if (!url) return Promise.reject(createError(ServiceError.NO_API_CONFIG));

        var headers = Config.buildHeaders(model);
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
        var url = Config.buildUrl(Config.ENDPOINTS.analyzeDocument, model);
        if (!url) return Promise.reject(createError(ServiceError.NO_API_CONFIG));

        var headers = Config.buildHeaders(model);
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
            Config.setStatus(Config.STATUS.DISCONNECTED, 'No model configured');
            return Promise.resolve(Config.getStatus());
        }
        return Config.checkHealth(m);
    }

    // ---------------------------------------------------------------------------
    // SERVICE: getModelStatus (for UI display)
    // ---------------------------------------------------------------------------
    function getModelStatus() {
        var model = getActiveModel();
        var configStatus = Config.getStatus();

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

        if (!model.endpoint && !Config.isConfigured()) {
            return {
                status: 'not-configured',
                label: model.name,
                detail: 'No API endpoint set',
                connected: false,
                icon: 'fa-circle-question'
            };
        }

        if (configStatus.status === Config.STATUS.CONNECTED) {
            return {
                status: 'connected',
                label: model.name,
                detail: configStatus.latency ? configStatus.latency + 'ms' : 'Connected',
                connected: true,
                icon: 'fa-circle-check'
            };
        }

        if (configStatus.status === Config.STATUS.ERROR) {
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
        Config:             Config
    };

})();
