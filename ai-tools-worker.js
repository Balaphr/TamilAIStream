'use strict';

/* ============================================================================
   ai-tools-worker.js — Background Job Processing System
   ============================================================================ */

window.AIToolsWorker = (function () {

    var JOBS_KEY = 'nexvora_aitools_jobs';
    var HISTORY_KEY = 'nexvora_aitools_history';
    var MAX_HISTORY = 50;
    var _listeners = {};

    function getJobs() {
        try { return JSON.parse(localStorage.getItem(JOBS_KEY) || '[]'); } catch (e) { return []; }
    }

    function saveJobs(jobs) {
        try { localStorage.setItem(JOBS_KEY, JSON.stringify(jobs)); } catch (e) { /* ignore */ }
        _emit('jobs-changed', jobs);
    }

    function getHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; }
    }

    function saveHistory(history) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) { /* ignore */ }
        _emit('history-changed', history);
    }

    function addJob(job) {
        var jobs = getJobs();
        var newJob = {
            id: 'job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            type: job.type || 'unknown',
            tool: job.tool || 'unknown',
            category: job.category || 'other',
            name: job.name || 'Processing...',
            input: job.input || null,
            files: job.files || [],
            options: job.options || {},
            status: 'queued',
            progress: 0,
            result: null,
            error: null,
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null
        };
        jobs.unshift(newJob);
        saveJobs(jobs);
        _emit('job-added', newJob);
        processJob(newJob.id);
        return newJob;
    }

    function updateJob(id, updates) {
        var jobs = getJobs();
        for (var i = 0; i < jobs.length; i++) {
            if (jobs[i].id === id) {
                Object.assign(jobs[i], updates);
                saveJobs(jobs);
                _emit('job-updated', jobs[i]);

                if (updates.status === 'completed' || updates.status === 'failed') {
                    moveToHistory(jobs[i]);
                    jobs.splice(i, 1);
                    saveJobs(jobs);
                }
                return jobs[i];
            }
        }
        return null;
    }

    function cancelJob(id) {
        return updateJob(id, { status: 'cancelled', completedAt: Date.now() });
    }

    function removeJob(id) {
        var jobs = getJobs().filter(function (j) { return j.id !== id; });
        saveJobs(jobs);
    }

    function moveToHistory(job) {
        var history = getHistory();
        history.unshift({
            id: job.id,
            type: job.type,
            tool: job.tool,
            category: job.category,
            name: job.name,
            status: job.status,
            result: job.result,
            error: job.error,
            createdAt: job.createdAt,
            completedAt: job.completedAt
        });
        if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
        saveHistory(history);
    }

    function clearHistory() {
        saveHistory([]);
    }

    function getActiveJobCount() {
        return getJobs().filter(function (j) {
            return j.status === 'queued' || j.status === 'processing';
        }).length;
    }

    function processJob(jobId) {
        var jobs = getJobs();
        var job = null;
        for (var i = 0; i < jobs.length; i++) {
            if (jobs[i].id === jobId) { job = jobs[i]; break; }
        }
        if (!job || job.status !== 'queued') return;

        updateJob(jobId, { status: 'processing', startedAt: Date.now() });

        // Check if client-side processing is needed (PDF, local image, file tools)
        var clientSideTools = ['pdf-create', 'pdf-to-images', 'pdf-merge', 'pdf-split', 'file-zip', 'file-unzip', 'file-info', 'image-convert', 'image-resize', 'image-crop', 'image-rotate', 'image-compress'];
        if (clientSideTools.indexOf(job.tool) !== -1) {
            simulateProgress(jobId, function () {
                var result = processClientSide(job);
                if (result.error) {
                    updateJob(jobId, { status: 'failed', error: result.error, completedAt: Date.now() });
                } else {
                    updateJob(jobId, { status: 'completed', progress: 100, result: result, completedAt: Date.now() });
                }
            });
            return;
        }

        // Server-side API processing
        simulateProgress(jobId, function () {
            callServerAPI(job, function (err, result) {
                if (err) {
                    updateJob(jobId, { status: 'failed', error: err.message || 'Processing failed', completedAt: Date.now() });
                } else if (result && result.error) {
                    updateJob(jobId, { status: 'failed', error: result.error, completedAt: Date.now() });
                } else {
                    updateJob(jobId, { status: 'completed', progress: 100, result: result, completedAt: Date.now() });
                }
            });
        });
    }

    function callServerAPI(job, callback) {
        var payload = {
            tool: job.tool,
            options: job.options || {},
            files: job.files || [],
            fileUrl: job.options && job.options.url ? job.options.url : null,
            command: job.options && job.options.command ? job.options.command : null,
            imageData: job.options && job.options.imageData ? job.options.imageData : null
        };

        fetch('/api/ai-tools/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function (response) { return response.json(); })
        .then(function (data) { callback(null, data); })
        .catch(function (err) { callback(new Error('Network error: ' + err.message)); });
    }

    function processClientSide(job) {
        // Client-side processing for tools that don't need external APIs
        switch (job.tool) {
            case 'file-info':
                if (job.files && job.files.length > 0) {
                    var f = job.files[0];
                    return { success: true, info: { name: f.name, size: f.size, type: f.type, category: AIToolsAPI.getFileCategory(f.name) } };
                }
                return { error: 'No file provided' };
            case 'pdf-create':
                return { success: true, message: 'PDF creation ready — use pdf-lib in browser', tool: 'pdf-create' };
            case 'pdf-to-images':
                return { success: true, message: 'PDF extraction ready — use pdf.js in browser', tool: 'pdf-to-images' };
            case 'pdf-merge':
                return { success: true, message: 'PDF merge ready — use pdf-lib in browser', tool: 'pdf-merge' };
            case 'pdf-split':
                return { success: true, message: 'PDF split ready — use pdf-lib in browser', tool: 'pdf-split' };
            case 'image-convert':
                return { success: true, message: 'Image conversion ready — use Canvas API', format: job.options.format, tool: 'image-convert' };
            case 'image-resize':
                return { success: true, message: 'Image resize ready — use Canvas API', tool: 'image-resize' };
            case 'image-crop':
                return { success: true, message: 'Image crop ready — use Canvas API', tool: 'image-crop' };
            case 'image-rotate':
                return { success: true, message: 'Image rotation ready — use Canvas API', tool: 'image-rotate' };
            case 'image-compress':
                return { success: true, message: 'Image compression ready — use Canvas API', tool: 'image-compress' };
            case 'file-zip':
                return { success: true, message: 'ZIP creation ready — use JSZip in browser', tool: 'file-zip' };
            case 'file-unzip':
                return { success: true, message: 'ZIP extraction ready — use JSZip in browser', tool: 'file-unzip' };
            default:
                return { error: 'Client-side processing not implemented for: ' + job.tool };
        }
    }

    function simulateProgress(jobId, callback) {
        var progress = 0;
        var interval = setInterval(function () {
            progress += Math.random() * 15 + 5;
            if (progress >= 90) {
                progress = 90;
                clearInterval(interval);
                updateJob(jobId, { progress: Math.round(progress) });
                setTimeout(callback, 300);
            } else {
                updateJob(jobId, { progress: Math.round(progress) });
            }
        }, 400);
    }

    function on(event, callback) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(callback);
    }

    function _emit(event, data) {
        var list = _listeners[event];
        if (list) {
            for (var i = 0; i < list.length; i++) {
                try { list[i](data); } catch (e) { /* ignore */ }
            }
        }
    }

    return {
        getJobs: getJobs,
        addJob: addJob,
        updateJob: updateJob,
        cancelJob: cancelJob,
        removeJob: removeJob,
        getHistory: getHistory,
        clearHistory: clearHistory,
        getActiveJobCount: getActiveJobCount,
        on: on
    };
})();
