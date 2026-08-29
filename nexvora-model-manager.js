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
            id: 'tamilai-translator',
            name: 'TamilAI Translator',
            modelId: 'tamilai-translator',
            endpoint: '',
            provider: 'TamilAI',
            apiKey: '',
            languages: ['ta', 'en'],
            capabilities: ['translate', 'chat'],
            maxTokens: 4096,
            enabled: true,
            isDefault: true
        }
    ];

    // --- Storage helpers ---
    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
    function lsGetJSON(key) { try { return JSON.parse(lsGet(key)); } catch (e) { return null; } }

    // --- Model CRUD ---
    function getAllModels() {
        var models = lsGetJSON(STORAGE_KEY);
        if (!models || !Array.isArray(models) || models.length === 0) {
            models = DEFAULT_MODELS.map(function (m) {
                return Object.assign({}, m, { createdAt: Date.now() });
            });
            lsSet(STORAGE_KEY, models);
        }
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
        var newModel = {
            id: config.id || ('model-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
            name: config.name || 'Untitled Model',
            modelId: config.modelId || config.id || ('model-' + Date.now()),
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

        var body = {
            model: model.modelId || model.id,
            messages: messages,
            max_tokens: options.maxTokens || model.maxTokens || 4096,
            temperature: options.temperature || 0.7,
            stream: !!options.stream
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
                content: data.response || data.content || data.text || JSON.stringify(data),
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
        lsSet(ACTIVE_MODEL_KEY, 'tamilai-translator');
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
            setConnectionStatus(m.id, 'no-config', null);
            return Promise.resolve({ connected: false, message: 'API configuration not available' });
        }

        return config.checkHealth(m).then(function (result) {
            if (result.status === config.STATUS.CONNECTED) {
                setConnectionStatus(m.id, 'connected', result.latency);
                return { connected: true, latency: result.latency, message: 'Connected' };
            } else {
                setConnectionStatus(m.id, 'error', null);
                return { connected: false, message: result.error || 'Connection failed' };
            }
        }).catch(function (err) {
            setConnectionStatus(m.id, 'error', null);
            return { connected: false, message: err.message || 'Connection failed' };
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
