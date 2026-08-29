'use strict';

// ============================================================================
// nexvora-model-manager.js — Model Configuration & Selection Layer
// ============================================================================
// Manages model definitions, CRUD, active model selection, and provides
// the bridge between the UI and the AI Service Layer.
//
// This file does NOT contain API call logic. API calls are handled by
// NexvoraAIService (nexvora-ai-service.js). This module only manages
// model configuration data.
//
// Storage key: 'nexvora_models' (localStorage)
// ============================================================================

window.NexvoraModelManager = (function () {

    var STORAGE_KEY = 'nexvora_models';
    var ACTIVE_MODEL_KEY = 'nexvora_active_model';

    // --- Default models (TamilAI Translation pre-configured) ---
    var DEFAULT_MODELS = [
        {
            id: 'tamil-translation',
            name: 'TamilAI Chat',
            modelId: 'tamilai',
            endpoint: 'https://api.tamilai.stream/v1/chat/completions',
            provider: 'custom',
            apiKey: '',
            languages: ['ta', 'en'],
            capabilities: ['chat', 'translation'],
            maxTokens: 4096,
            enabled: true,
            isDefault: true,
            requestBodyTemplate: '{"tamil": "{{input}}"}'
        }
    ];

    // --- Storage helpers ---
    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
    function lsGetJSON(key) { try { return JSON.parse(lsGet(key)); } catch (e) { return null; } }

    // --- Model CRUD ---
    function getAllModels() {
        var models;
        try {
            models = lsGetJSON(STORAGE_KEY);
        } catch (e) {
            models = null;
        }
        if (!models || !Array.isArray(models) || models.length === 0) {
            models = DEFAULT_MODELS.map(function (m) {
                return Object.assign({}, m, { createdAt: Date.now() });
            });
            lsSet(STORAGE_KEY, models);
            return models;
        }

        // Remove any null/undefined/corrupt entries
        var cleaned = models.filter(function (m) { return m && typeof m === 'object' && m.id; });
        if (cleaned.length !== models.length) { models = cleaned; lsSet(STORAGE_KEY, models); }

        // Merge saved models with defaults to fill in missing fields
        // (handles upgrades where new fields like endpoint, requestBodyTemplate were added)
        var defaultsById = {};
        DEFAULT_MODELS.forEach(function (d) { defaultsById[d.id] = d; });
        var changed = false;
        models.forEach(function (m) {
            var def = defaultsById[m.id];
            if (def) {
                Object.keys(def).forEach(function (key) {
                    if (m[key] === undefined || m[key] === null || m[key] === '') {
                        m[key] = def[key];
                        changed = true;
                    }
                });
            }
        });
        if (changed) lsSet(STORAGE_KEY, models);

        return models;
    }

    function getEnabledModels() {
        return getAllModels().filter(function (m) { return m.enabled; });
    }

    function getModelById(id) {
        var models = getAllModels();
        for (var i = 0; i < models.length; i++) {
            if (models[i].id === id) return models[i];
        }
        return null;
    }

    function addModel(config) {
        var models = getAllModels();
        var newId = config.id || config.modelId || ('model-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));

        // Prevent duplicate IDs — append suffix if needed
        var existingIds = {};
        models.forEach(function (m) { existingIds[m.id] = true; });
        if (existingIds[newId]) {
            newId = newId + '-' + Date.now();
        }

        var newModel = {
            id: newId,
            name: config.name || 'Untitled Model',
            modelId: config.modelId || newId,
            endpoint: config.endpoint || '',
            provider: config.provider || '',
            apiKey: config.apiKey || '',
            languages: Array.isArray(config.languages) ? config.languages :
                (config.languages ? config.languages.split(',').map(function (s) { return s.trim(); }) : ['en']),
            capabilities: Array.isArray(config.capabilities) ? config.capabilities :
                (config.capabilities ? config.capabilities.split(',').map(function (s) { return s.trim(); }) : ['chat']),
            maxTokens: parseInt(config.maxTokens, 10) || 4096,
            enabled: config.enabled !== false,
            isDefault: config.isDefault || false,
            requestBodyTemplate: config.requestBodyTemplate || '',
            createdAt: Date.now()
        };
        models.push(newModel);
        lsSet(STORAGE_KEY, models);
        return newModel;
    }

    function updateModel(id, updates) {
        var models = getAllModels();
        for (var i = 0; i < models.length; i++) {
            if (models[i].id === id) {
                if (updates.name !== undefined) models[i].name = updates.name;
                if (updates.modelId !== undefined) models[i].modelId = updates.modelId;
                if (updates.endpoint !== undefined) models[i].endpoint = updates.endpoint;
                if (updates.provider !== undefined) models[i].provider = updates.provider;
                if (updates.apiKey !== undefined) models[i].apiKey = updates.apiKey;
                if (updates.languages !== undefined) {
                    models[i].languages = Array.isArray(updates.languages)
                        ? updates.languages
                        : updates.languages.split(',').map(function (s) { return s.trim(); });
                }
                if (updates.capabilities !== undefined) {
                    models[i].capabilities = Array.isArray(updates.capabilities)
                        ? updates.capabilities
                        : (typeof updates.capabilities === 'string' ? updates.capabilities.split(',').map(function (s) { return s.trim(); }) : []);
                }
                if (updates.maxTokens !== undefined) models[i].maxTokens = parseInt(updates.maxTokens, 10);
                if (updates.enabled !== undefined) models[i].enabled = updates.enabled;
                if (updates.isDefault !== undefined) models[i].isDefault = updates.isDefault;
                if (updates.requestBodyTemplate !== undefined) models[i].requestBodyTemplate = updates.requestBodyTemplate;
                models[i].updatedAt = Date.now();
                lsSet(STORAGE_KEY, models);
                return models[i];
            }
        }
        return null;
    }

    function removeModel(id) {
        var models = getAllModels();
        models = models.filter(function (m) { return m.id !== id || m.isDefault; });
        lsSet(STORAGE_KEY, models);
        var active = getActiveModel();
        if (!active || !active.enabled) {
            var enabled = getEnabledModels();
            if (enabled.length > 0) setActiveModel(enabled[0].id);
        }
    }

    function duplicateModel(id) {
        var original = getModelById(id);
        if (!original) return null;
        var copy = Object.assign({}, original, {
            id: 'model-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            name: original.name + ' (Copy)',
            isDefault: false,
            enabled: true,
            createdAt: Date.now()
        });
        delete copy.updatedAt;
        var models = getAllModels();
        models.push(copy);
        lsSet(STORAGE_KEY, models);
        return copy;
    }

    // --- Active model selection ---
    function getActiveModel() {
        var activeId = lsGet(ACTIVE_MODEL_KEY);
        if (activeId) {
            var m = getModelById(activeId);
            if (m && m.enabled) return m;
        }
        var enabled = getEnabledModels();
        if (enabled.length > 0) {
            setActiveModel(enabled[0].id);
            return enabled[0];
        }
        return null;
    }

    function setActiveModel(id) {
        lsSet(ACTIVE_MODEL_KEY, id);
    }

    // --- API call delegation (delegates to NexvoraAIService) ---
    // This is the bridge between UI and AI backend.
    // When connecting your own Ubuntu-hosted AI models, the service layer
    // (nexvora-ai-service.js) handles the actual HTTP calls.
    //
    // Usage:
    //   NexvoraModelManager.sendRequest(messages, options)
    //     .then(response => ...)
    //     .catch(err => ...);
    //
    // options: { temperature, maxTokens, stream, systemPrompt }
    function sendRequest(messages, options) {
        // Delegate to the service layer
        if (typeof window.NexvoraAIService !== 'undefined') {
            return window.NexvoraAIService.sendChatMessage(messages, options);
        }

        // Fallback: direct call (legacy path, should not be reached)
        options = options || {};
        var model = getActiveModel();
        if (!model) {
            return Promise.reject(new Error('No active model configured. Go to Model Manager to add one.'));
        }
        if (!model.endpoint) {
            return Promise.reject(new Error('Model "' + model.name + '" has no API endpoint configured. Edit it in Model Manager.'));
        }

        // Always use standard OpenAI-compatible chat body — never use requestBodyTemplate for chat
        var body = {
            model: model.modelId || model.id,
            messages: messages,
            max_tokens: options.maxTokens || model.maxTokens || 4096,
            temperature: options.temperature || 0.7,
            stream: false
        };
        if (options.systemPrompt) {
            body.messages = [{ role: 'system', content: options.systemPrompt }].concat(body.messages);
        }

        var headers = { 'Content-Type': 'application/json' };
        if (model.apiKey) {
            headers['Authorization'] = 'Bearer ' + model.apiKey;
        }

        return fetch(model.endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        }).then(function (res) {
            if (!res.ok) {
                return res.text().then(function (text) {
                    throw new Error('API error ' + res.status + ': ' + text);
                });
            }
            return res.json();
        }).then(function (data) {
            if (data.choices && data.choices[0]) {
                return {
                    content: data.choices[0].message ? data.choices[0].message.content : data.choices[0].text || '',
                    model: data.model || model.name,
                    usage: data.usage || null
                };
            }
            return {
                content: data.response || data.content || data.text || data.english || JSON.stringify(data),
                model: data.model || model.name,
                usage: data.usage || null
            };
        });
    }

    // --- Export/Import ---
    function exportModels() {
        return JSON.stringify({
            models: getAllModels(),
            activeModel: lsGet(ACTIVE_MODEL_KEY),
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    function importModels(jsonString) {
        try {
            var data = JSON.parse(jsonString);
            if (data.models && Array.isArray(data.models)) {
                lsSet(STORAGE_KEY, data.models);
                if (data.activeModel) lsSet(ACTIVE_MODEL_KEY, data.activeModel);
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function clearAllModels() {
        lsSet(STORAGE_KEY, DEFAULT_MODELS.map(function (m) {
            return Object.assign({}, m, { createdAt: Date.now() });
        }));
        lsSet(ACTIVE_MODEL_KEY, 'tamil-translation');
    }

    // --- Connection status tracking ---
    var CONNECTION_STATUS_KEY = 'nexvora_connection_status';

    function getConnectionStatus(modelId) {
        var statuses = lsGetJSON(CONNECTION_STATUS_KEY) || {};
        return statuses[modelId] || { status: 'unknown', latency: null, lastChecked: null };
    }

    function setConnectionStatus(modelId, status, latency) {
        var statuses = lsGetJSON(CONNECTION_STATUS_KEY) || {};
        statuses[modelId] = {
            status: status,
            latency: latency || null,
            lastChecked: Date.now()
        };
        lsSet(CONNECTION_STATUS_KEY, statuses);
    }

    // --- Test connection for a model ---
    function testConnection(model) {
        var m = model || getActiveModel();
        if (!m) {
            return Promise.resolve({ connected: false, message: 'No model configured' });
        }

        if (!m.endpoint) {
            setConnectionStatus(m.id, 'no-endpoint', null);
            return Promise.resolve({ connected: false, message: 'No API endpoint configured' });
        }

        setConnectionStatus(m.id, 'testing', null);

        var config = window.NexvoraAPIConfig;
        if (!config) {
            // No config module — try direct fetch as a last resort
            return testConnectionDirect(m);
        }

        return config.checkHealth(m).then(function (result) {
            if (result.status === config.STATUS.CONNECTED) {
                setConnectionStatus(m.id, 'connected', result.latency);
                return { connected: true, latency: result.latency, message: 'Connected' };
            } else {
                setConnectionStatus(m.id, 'error', null);
                return { connected: false, message: result.lastError || result.error || 'Connection failed' };
            }
        }).catch(function (err) {
            setConnectionStatus(m.id, 'error', null);
            return { connected: false, message: err.message || 'Connection failed' };
        });
    }

    // --- Direct connection test fallback (no config module needed) ---
    function testConnectionDirect(m) {
        var controller = null;
        var timeoutId = null;
        var timeout = 30000;

        return new Promise(function (resolve) {
            if (typeof AbortController !== 'undefined') {
                controller = new AbortController();
                timeoutId = setTimeout(function () { controller.abort(); }, timeout);
            }

            var headers = { 'Content-Type': 'application/json' };
            if (m.apiKey) {
                headers['Authorization'] = 'Bearer ' + m.apiKey;
            }

            // Custom providers with requestBodyTemplate: send POST with test data
            var fetchOptions;
            if (m.requestBodyTemplate) {
                var testBody;
                try {
                    testBody = JSON.parse(m.requestBodyTemplate.replace(/\{\{input\}\}/g, '\u0B85\u0BA9\u0BCD'));
                } catch (e) {
                    testBody = { tamil: '\u0B85\u0BA9\u0BCD' };
                }
                fetchOptions = { method: 'POST', headers: headers, body: JSON.stringify(testBody) };
            } else {
                fetchOptions = { method: 'GET', headers: headers };
            }
            if (controller) fetchOptions.signal = controller.signal;

            var start = Date.now();

            fetch(m.endpoint, fetchOptions)
                .then(function (res) {
                    if (timeoutId) clearTimeout(timeoutId);
                    var latency = Date.now() - start;

                    if (!res.ok) {
                        return res.text().then(function (text) {
                            setConnectionStatus(m.id, 'error', null);
                            resolve({ connected: false, message: 'HTTP ' + res.status + (text ? ': ' + text.slice(0, 200) : '') });
                        });
                    }

                    if (m.requestBodyTemplate) {
                        return res.json().then(function (data) {
                            if (data && data.english !== undefined) {
                                setConnectionStatus(m.id, 'connected', latency);
                                resolve({ connected: true, latency: latency, message: 'Connected' });
                            } else {
                                setConnectionStatus(m.id, 'error', null);
                                resolve({ connected: false, message: 'API returned unexpected response \u2014 expected "english" field' });
                            }
                        });
                    }

                    setConnectionStatus(m.id, 'connected', latency);
                    resolve({ connected: true, latency: latency, message: 'Connected' });
                })
                .catch(function (err) {
                    if (timeoutId) clearTimeout(timeoutId);
                    setConnectionStatus(m.id, 'error', null);
                    if (err.name === 'AbortError') {
                        resolve({ connected: false, message: 'Request timed out after ' + timeout + 'ms' });
                    } else {
                        resolve({ connected: false, message: err.message || 'Connection failed' });
                    }
                });
        });
    }

    // --- Language support ---
    function getSupportedLanguages() {
        var langs = {};
        var models = getEnabledModels();
        models.forEach(function (m) {
            (m.languages || []).forEach(function (l) {
                if (l) langs[l.toLowerCase()] = true;
            });
        });
        return Object.keys(langs).sort();
    }

    // --- Capability support ---
    function getSupportedCapabilities() {
        var caps = {};
        var models = getEnabledModels();
        models.forEach(function (m) {
            (m.capabilities || []).forEach(function (c) {
                if (c) caps[c.toLowerCase()] = true;
            });
        });
        return Object.keys(caps).sort();
    }

    // Public API
    return {
        getAllModels: getAllModels,
        getEnabledModels: getEnabledModels,
        getModelById: getModelById,
        addModel: addModel,
        updateModel: updateModel,
        removeModel: removeModel,
        duplicateModel: duplicateModel,
        getActiveModel: getActiveModel,
        setActiveModel: setActiveModel,
        sendRequest: sendRequest,
        exportModels: exportModels,
        importModels: importModels,
        clearAllModels: clearAllModels,
        getSupportedLanguages: getSupportedLanguages,
        getSupportedCapabilities: getSupportedCapabilities,
        getConnectionStatus: getConnectionStatus,
        setConnectionStatus: setConnectionStatus,
        testConnection: testConnection
    };

})();
