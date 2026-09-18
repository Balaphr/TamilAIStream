'use strict';

/* ============================================================================
   ai-tools.js — Nexvora AI Utility & Media Tools Main Application
   ============================================================================ */

window.AIToolsApp = (function () {

    var TOOLS = [
        { id: 'video-convert', name: 'Convert Video', category: 'video', icon: 'fa-solid fa-film', desc: 'Convert between video formats', badge: 'free' },
        { id: 'video-compress', name: 'Compress Video', category: 'video', icon: 'fa-solid fa-compress', desc: 'Reduce video file size', badge: 'free' },
        { id: 'video-extract-audio', name: 'Extract Audio', category: 'video', icon: 'fa-solid fa-music', desc: 'Extract audio from video', badge: 'free' },
        { id: 'video-resize', name: 'Resize Video', category: 'video', icon: 'fa-solid fa-expand', desc: 'Change video resolution', badge: 'free' },
        { id: 'video-trim', name: 'Trim Video', category: 'video', icon: 'fa-solid fa-scissors', desc: 'Cut video segments', badge: 'free' },

        { id: 'audio-convert', name: 'Convert Audio', category: 'audio', icon: 'fa-solid fa-headphones', desc: 'Convert between audio formats', badge: 'free' },
        { id: 'audio-compress', name: 'Compress Audio', category: 'audio', icon: 'fa-solid fa-compress', desc: 'Reduce audio file size', badge: 'free' },
        { id: 'audio-trim', name: 'Trim Audio', category: 'audio', icon: 'fa-solid fa-scissors', desc: 'Cut audio segments', badge: 'free' },
        { id: 'audio-normalize', name: 'Normalize Audio', category: 'audio', icon: 'fa-solid fa-volume-high', desc: 'Normalize audio levels', badge: 'free' },

        { id: 'image-convert', name: 'Convert Image', category: 'image', icon: 'fa-solid fa-image', desc: 'JPG, PNG, WebP, GIF conversion', badge: 'free' },
        { id: 'image-resize', name: 'Resize Image', category: 'image', icon: 'fa-solid fa-expand', desc: 'Change image dimensions', badge: 'free' },
        { id: 'image-crop', name: 'Crop Image', category: 'image', icon: 'fa-solid fa-crop', desc: 'Crop image areas', badge: 'free' },
        { id: 'image-rotate', name: 'Rotate Image', category: 'image', icon: 'fa-solid fa-rotate', desc: 'Rotate or flip images', badge: 'free' },
        { id: 'image-compress', name: 'Compress Image', category: 'image', icon: 'fa-solid fa-compress', desc: 'Reduce image file size', badge: 'free' },

        { id: 'image-enhance', name: 'Enhance Image', category: 'imageai', icon: 'fa-solid fa-wand-magic-sparkles', desc: 'AI-powered image enhancement', badge: 'pro' },
        { id: 'image-upscale', name: 'Upscale Image', category: 'imageai', icon: 'fa-solid fa-maximize', desc: 'AI upscale images 4x', badge: 'pro' },
        { id: 'image-bg-remove', name: 'Remove Background', category: 'imageai', icon: 'fa-solid fa-eraser', desc: 'AI background removal', badge: 'pro' },

        { id: 'pdf-create', name: 'Create PDF', category: 'pdf', icon: 'fa-solid fa-file-pdf', desc: 'Create PDF from images', badge: 'free' },
        { id: 'pdf-to-images', name: 'PDF to Images', category: 'pdf', icon: 'fa-solid fa-images', desc: 'Extract PDF pages as images', badge: 'free' },
        { id: 'pdf-merge', name: 'Merge PDFs', category: 'pdf', icon: 'fa-solid fa-object-group', desc: 'Combine multiple PDFs', badge: 'free' },
        { id: 'pdf-split', name: 'Split PDF', category: 'pdf', icon: 'fa-solid fa-scissors', desc: 'Split PDF into pages', badge: 'free' },

        { id: 'file-zip', name: 'Create ZIP', category: 'file', icon: 'fa-solid fa-box-archive', desc: 'Compress files into ZIP', badge: 'free' },
        { id: 'file-unzip', name: 'Extract ZIP', category: 'file', icon: 'fa-solid fa-folder-open', desc: 'Extract ZIP archives', badge: 'free' },
        { id: 'file-info', name: 'File Info', category: 'file', icon: 'fa-solid fa-circle-info', desc: 'View detailed file information', badge: 'free' },

        { id: 'url-download', name: 'URL Downloader', category: 'url', icon: 'fa-solid fa-download', desc: 'Download from public URLs', badge: 'free' }
    ];

    var AI_COMMANDS = [
        { patterns: [/convert.*video.*(?:to\s+)?(\w+)/i, /video.*convert.*(\w+)/i], tool: 'video-convert', extract: function (m) { return { format: m[1] }; } },
        { patterns: [/compress.*video/i, /video.*compress/i, /reduce.*video.*size/i], tool: 'video-compress' },
        { patterns: [/extract.*audio.*(?:from|out\s+of).*video/i, /audio.*from.*video/i, /video.*to.*audio/i], tool: 'video-extract-audio' },
        { patterns: [/resize.*video/i, /video.*resolution/i], tool: 'video-resize' },
        { patterns: [/trim.*video/i, /cut.*video/i], tool: 'video-trim' },

        { patterns: [/convert.*audio.*(?:to\s+)?(\w+)/i, /audio.*convert.*(\w+)/i], tool: 'audio-convert', extract: function (m) { return { format: m[1] }; } },
        { patterns: [/compress.*audio/i, /audio.*compress/i], tool: 'audio-compress' },
        { patterns: [/trim.*audio/i, /cut.*audio/i], tool: 'audio-trim' },
        { patterns: [/normalize.*audio/i, /audio.*normalize/i], tool: 'audio-normalize' },

        { patterns: [/convert.*image.*(?:to\s+)?(\w+)/i, /image.*(?:to|convert).*jpg|png|webp|gif/i, /(?:jpg|png|webp|gif).*convert/i], tool: 'image-convert', extract: function (m) { var fmt = m[0].match(/(jpg|jpeg|png|webp|gif)/i); return { format: fmt ? fmt[1].toLowerCase() : 'webp' }; } },
        { patterns: [/resize.*image/i, /image.*resize/i, /scale.*image/i], tool: 'image-resize' },
        { patterns: [/crop.*image/i, /image.*crop/i], tool: 'image-crop' },
        { patterns: [/rotate.*image/i, /image.*rotate/i, /flip.*image/i], tool: 'image-rotate' },
        { patterns: [/compress.*image/i, /image.*compress/i, /reduce.*image.*size/i], tool: 'image-compress' },

        { patterns: [/enhance.*image/i, /image.*enhance/i, /improve.*image/i, /image.*quality/i], tool: 'image-enhance' },
        { patterns: [/upscale.*image/i, /image.*upscale/i, /image.*upscale.*(\d+)x/i], tool: 'image-upscale' },
        { patterns: [/remove.*(?:image\s+)?background/i, /bg.*remove/i, /background.*remov/i], tool: 'image-bg-remove' },

        { patterns: [/create.*pdf.*(?:from|with).*image/i, /image.*(?:to|into).*pdf/i], tool: 'pdf-create' },
        { patterns: [/pdf.*to.*image/i, /extract.*pdf.*image/i], tool: 'pdf-to-images' },
        { patterns: [/merge.*pdf/i, /combine.*pdf/i, /pdf.*merge/i], tool: 'pdf-merge' },
        { patterns: [/split.*pdf/i, /pdf.*split/i], tool: 'pdf-split' },

        { patterns: [/create.*zip/i, /zip.*files/i, /compress.*zip/i], tool: 'file-zip' },
        { patterns: [/extract.*zip/i, /unzip/i, /open.*zip/i], tool: 'file-unzip' },
        { patterns: [/file.*info/i, /file.*detail/i, /file.*info/i], tool: 'file-info' },

        { patterns: [/download.*(?:this|video|audio|file|content)/i, /(?:video|audio|file).*download/i, /save.*(?:video|audio|file)/i, /download.*url/i, /download.*public/i], tool: 'url-download' }
    ];

    var _files = [];
    var _activeCategory = 'all';
    var _currentPanel = null;

    function init() {
        bindEvents();
        renderTools();
        renderJobs();
        renderHistory();
        AIToolsWorker.on('jobs-changed', renderJobs);
        AIToolsWorker.on('history-changed', renderHistory);
    }

    function bindEvents() {
        var cmdInput = document.getElementById('aitCommandInput');
        var cmdRun = document.getElementById('aitCommandRun');
        var uploadBtn = document.getElementById('aitUploadBtn');
        var pasteUrlBtn = document.getElementById('aitPasteUrlBtn');
        var fileInput = document.getElementById('aitFileInput');
        var urlInput = document.getElementById('aitUrlInput');
        var urlGo = document.getElementById('aitUrlGo');
        var dropzone = document.getElementById('aitDropzone');
        var clearFiles = document.getElementById('aitClearFiles');
        var batchProcess = document.getElementById('aitBatchProcess');
        var historyBtn = document.getElementById('aitHistoryBtn');
        var settingsBtn = document.getElementById('aitSettingsBtn');
        var clearHistory = document.getElementById('aitClearHistory');
        var panelBack = document.getElementById('aitPanelBack');
        var panelClose = document.getElementById('aitPanelClose');

        if (cmdInput) cmdInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') processCommand(this.value);
        });
        if (cmdRun) cmdRun.addEventListener('click', function () {
            var inp = document.getElementById('aitCommandInput');
            if (inp) processCommand(inp.value);
        });

        if (uploadBtn) uploadBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (fileInput) fileInput.click();
        });
        if (fileInput) fileInput.addEventListener('change', function () { handleFiles(this.files); });

        if (pasteUrlBtn) pasteUrlBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (urlInput) { urlInput.style.display = urlInput.style.display === 'none' ? 'block' : 'none'; }
            if (urlGo) { urlGo.style.display = urlGo.style.display === 'none' ? 'block' : 'none'; }
        });

        if (urlGo) urlGo.addEventListener('click', function () {
            var url = (urlInput ? urlInput.value : '').trim();
            if (url) handleUrlInput(url);
        });
        if (urlInput) urlInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') handleUrlInput(this.value);
        });

        if (dropzone) {
            dropzone.addEventListener('dragover', function (e) { e.preventDefault(); this.classList.add('drag-over'); });
            dropzone.addEventListener('dragleave', function () { this.classList.remove('drag-over'); });
            dropzone.addEventListener('drop', function (e) {
                e.preventDefault();
                this.classList.remove('drag-over');
                if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
            });
            dropzone.addEventListener('click', function (e) {
                if (e.target === this || e.target.closest('.ait-dropzone-inner') && !e.target.closest('button') && !e.target.closest('input')) {
                    if (fileInput) fileInput.click();
                }
            });
        }

        if (clearFiles) clearFiles.addEventListener('click', function () { _files = []; renderFiles(); });
        if (batchProcess) batchProcess.addEventListener('click', batchProcessFiles);
        if (historyBtn) historyBtn.addEventListener('click', function () {
            var sec = document.getElementById('aitRecentSection');
            if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        });
        if (settingsBtn) settingsBtn.addEventListener('click', function () {
            openSettingsPanel();
        });
        if (clearHistory) clearHistory.addEventListener('click', function () { AIToolsWorker.clearHistory(); renderHistory(); });

        if (panelBack) panelBack.addEventListener('click', closeToolPanel);
        if (panelClose) panelClose.addEventListener('click', closeToolPanel);

        // Category buttons
        var catBtns = document.querySelectorAll('.ait-cat-btn');
        catBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                catBtns.forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                _activeCategory = this.dataset.cat;
                renderTools();
            });
        });

        // Suggestion chips
        var chips = document.querySelectorAll('.ait-suggestion-chip');
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                var cmd = this.dataset.cmd;
                var inp = document.getElementById('aitCommandInput');
                if (inp) inp.value = cmd;
                processCommand(cmd);
            });
        });
    }

    function processCommand(text) {
        if (!text || !text.trim()) return;
        text = text.trim();

        // Call server AI to parse the command
        fetch('/api/ai-tools/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: text })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }
            if (data.success && data.tool) {
                openToolPanel(data.tool, data.options || {});
            } else if (data.raw) {
                showToast('AI response: ' + data.raw.substring(0, 100), 'info');
            } else {
                showToast('Could not understand the command. Try selecting a tool below.', 'info');
            }
        })
        .catch(function () {
            // Fallback to local pattern matching
            var matched = null;
            var extractedOptions = {};
            for (var i = 0; i < AI_COMMANDS.length; i++) {
                var cmd = AI_COMMANDS[i];
                for (var j = 0; j < cmd.patterns.length; j++) {
                    var m = text.toLowerCase().match(cmd.patterns[j]);
                    if (m) {
                        matched = cmd;
                        if (cmd.extract) extractedOptions = cmd.extract(m);
                        break;
                    }
                }
                if (matched) break;
            }
            if (matched) {
                openToolPanel(matched.tool, extractedOptions);
            } else {
                showToast('Could not understand the command. Try selecting a tool below.', 'info');
            }
        });
    }

    function handleFiles(fileList) {
        if (!fileList || !fileList.length) return;
        for (var i = 0; i < fileList.length; i++) {
            var f = fileList[i];
            _files.push({
                id: 'file-' + Date.now() + '-' + i,
                file: f,
                name: f.name,
                size: f.size,
                type: f.type,
                category: AIToolsAPI.getFileCategory(f.name)
            });
        }
        renderFiles();
    }

    function handleUrlInput(url) {
        var validation = AIToolsAPI.validateUrl(url);
        if (!validation.valid) {
            showToast(validation.error, 'error');
            return;
        }
        _files.push({
            id: 'url-' + Date.now(),
            file: null,
            name: url.split('/').pop() || 'download',
            size: 0,
            type: 'url',
            category: 'url',
            url: url
        });
        renderFiles();
        showToast('URL added. Select a tool to process it.', 'success');
    }

    function renderFiles() {
        var section = document.getElementById('aitFilesSection');
        var list = document.getElementById('aitFilesList');
        var count = document.getElementById('aitFileCount');
        var batchBtn = document.getElementById('aitBatchProcess');
        if (!section || !list) return;

        if (_files.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';
        if (count) count.textContent = _files.length;
        if (batchBtn) batchBtn.style.display = _files.length > 1 ? '' : 'none';

        list.innerHTML = '';
        _files.forEach(function (f) {
            var iconClass = f.category;
            var icons = { video: 'fa-solid fa-film', audio: 'fa-solid fa-headphones', image: 'fa-solid fa-image', pdf: 'fa-solid fa-file-pdf', archive: 'fa-solid fa-box-archive', url: 'fa-solid fa-link', other: 'fa-solid fa-file' };
            var div = document.createElement('div');
            div.className = 'ait-file-item';
            div.innerHTML =
                '<div class="ait-file-icon ' + iconClass + '"><i class="' + (icons[f.category] || icons.other) + '"></i></div>' +
                '<div class="ait-file-info"><div class="ait-file-name">' + escHtml(f.name) + '</div>' +
                '<div class="ait-file-meta">' + (f.url ? f.url : AIToolsAPI.formatFileSize(f.size)) + '</div></div>' +
                '<div class="ait-file-actions">' +
                '<button class="ait-btn ait-btn-sm ait-btn-ghost" data-action="info" title="Info"><i class="fa-solid fa-circle-info"></i></button>' +
                '<button class="ait-btn ait-btn-sm ait-btn-danger" data-action="remove" title="Remove"><i class="fa-solid fa-xmark"></i></button>' +
                '</div>';
            div.querySelector('[data-action="info"]').addEventListener('click', function () { openToolPanel('file-info', {}, [f]); });
            div.querySelector('[data-action="remove"]').addEventListener('click', function () {
                _files = _files.filter(function (x) { return x.id !== f.id; });
                renderFiles();
            });
            list.appendChild(div);
        });
    }

    function batchProcessFiles() {
        if (_files.length === 0) return;
        var first = _files[0];
        openToolPanel(getBatchTool(first.category), {}, _files.slice());
    }

    function getBatchTool(category) {
        var map = { video: 'video-convert', audio: 'audio-convert', image: 'image-convert', pdf: 'pdf-merge', archive: 'file-zip' };
        return map[category] || 'file-info';
    }

    function renderTools() {
        var grid = document.getElementById('aitToolGrid');
        if (!grid) return;
        grid.innerHTML = '';
        var tools = _activeCategory === 'all' ? TOOLS : TOOLS.filter(function (t) { return t.category === _activeCategory; });
        tools.forEach(function (tool) {
            var card = document.createElement('div');
            card.className = 'ait-tool-card ' + tool.category;
            card.innerHTML =
                '<div class="ait-tool-card-icon"><i class="' + tool.icon + '"></i></div>' +
                '<h4>' + escHtml(tool.name) + '</h4>' +
                '<p>' + escHtml(tool.desc) + '</p>' +
                '<span class="ait-tool-badge ' + tool.badge + '">' + (tool.badge === 'pro' ? 'AI' : 'Free') + '</span>';
            card.addEventListener('click', function () { openToolPanel(tool.id); });
            grid.appendChild(card);
        });
    }

    function renderJobs() {
        var section = document.getElementById('aitJobsSection');
        var list = document.getElementById('aitJobsList');
        var count = document.getElementById('aitJobCount');
        if (!section || !list) return;
        var jobs = AIToolsWorker.getJobs().filter(function (j) { return j.status === 'queued' || j.status === 'processing'; });
        if (jobs.length === 0) { section.style.display = 'none'; return; }
        section.style.display = '';
        if (count) count.textContent = jobs.length;
        list.innerHTML = '';
        jobs.forEach(function (job) {
            var statusLabels = { queued: 'Queued', processing: 'Processing', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' };
            var div = document.createElement('div');
            div.className = 'ait-job-item';
            div.innerHTML =
                '<div class="ait-job-icon"><i class="fa-solid fa-spinner ait-spin"></i></div>' +
                '<div class="ait-job-info"><div class="ait-job-name">' + escHtml(job.name) + '</div>' +
                '<div class="ait-job-status ' + job.status + '">' + (statusLabels[job.status] || job.status) + ' — ' + job.progress + '%</div>' +
                '<div class="ait-progress-bar"><div class="ait-progress-fill" style="width:' + job.progress + '%"></div></div></div>' +
                '<div class="ait-job-actions">' +
                '<button class="ait-btn ait-btn-sm ait-btn-danger" data-action="cancel"><i class="fa-solid fa-xmark"></i></button>' +
                '</div>';
            div.querySelector('[data-action="cancel"]').addEventListener('click', function () { AIToolsWorker.cancelJob(job.id); });
            list.appendChild(div);
        });
    }

    function renderHistory() {
        var section = document.getElementById('aitRecentSection');
        var list = document.getElementById('aitRecentList');
        if (!section || !list) return;
        var history = AIToolsWorker.getHistory();
        if (history.length === 0) { section.style.display = 'none'; return; }
        section.style.display = '';
        list.innerHTML = '';
        history.slice(0, 10).forEach(function (job) {
            var isOk = job.status === 'completed';
            var div = document.createElement('div');
            div.className = 'ait-recent-item';
            div.innerHTML =
                '<div class="ait-recent-icon ' + (isOk ? 'success' : 'error') + '"><i class="fa-solid ' + (isOk ? 'fa-check-circle' : 'fa-exclamation-circle') + '"></i></div>' +
                '<div class="ait-recent-info"><div class="ait-recent-name">' + escHtml(job.name) + '</div>' +
                '<div class="ait-recent-time">' + timeAgo(job.completedAt || job.createdAt) + '</div></div>' +
                (isOk ? '<div class="ait-recent-download"><i class="fa-solid fa-download"></i></div>' : '');
            list.appendChild(div);
        });
    }

    function openToolPanel(toolId, options, files) {
        var tool = null;
        for (var i = 0; i < TOOLS.length; i++) {
            if (TOOLS[i].id === toolId) { tool = TOOLS[i]; break; }
        }
        if (!tool) return;
        _currentPanel = tool;
        var panel = document.getElementById('aitToolPanel');
        var title = document.getElementById('aitPanelTitle');
        var body = document.getElementById('aitPanelBody');
        if (!panel || !body) return;
        panel.style.display = 'flex';
        if (title) title.textContent = tool.name;
        body.innerHTML = renderToolForm(tool, options, files);
        bindToolForm(tool);
    }

    function closeToolPanel() {
        var panel = document.getElementById('aitToolPanel');
        if (panel) panel.style.display = 'none';
        _currentPanel = null;
    }

    function openSettingsPanel() {
        var panel = document.getElementById('aitToolPanel');
        var title = document.getElementById('aitPanelTitle');
        var body = document.getElementById('aitPanelBody');
        if (!panel || !body) return;
        panel.style.display = 'flex';
        if (title) title.textContent = 'AI Tools Settings';
        var config = AIToolsAPI.getConfig();
        var h = '<div class="ait-settings-panel">';
        h += '<p style="color:var(--ait-text-secondary);font-size:13px;margin-bottom:16px;">Configure AI providers and tool settings. Each section saves and tests independently.</p>';
        h += renderSettingSection('AI Assistant', 'ai', config.ai, [
            { key: 'enabled', label: 'Enable AI Assistant', type: 'toggle' },
            { key: 'provider', label: 'Provider', type: 'select', options: ['openai', 'anthropic', 'google', 'custom'] },
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
            { key: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
            { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://api.openai.com/v1/chat/completions' }
        ]);
        h += renderSettingSection('Image Enhancer', 'imageEnhance', config.imageEnhance, [
            { key: 'enabled', label: 'Enable Image Enhancer', type: 'toggle' },
            { key: 'provider', label: 'Provider', type: 'select', options: ['openai', 'replicate', 'custom'] },
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'API key' },
            { key: 'model', label: 'Model', type: 'text', placeholder: 'realesrgan-x4' },
            { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'Custom endpoint' }
        ]);
        h += renderSettingSection('Image Upscaler', 'imageUpscale', config.imageUpscale, [
            { key: 'enabled', label: 'Enable Image Upscaler', type: 'toggle' },
            { key: 'provider', label: 'Provider', type: 'select', options: ['openai', 'replicate', 'custom'] },
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'API key' },
            { key: 'model', label: 'Model', type: 'text', placeholder: 'realesrgan-x4' },
            { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'Custom endpoint' }
        ]);
        h += renderSettingSection('Background Removal', 'bgRemoval', config.bgRemoval, [
            { key: 'enabled', label: 'Enable BG Removal', type: 'toggle' },
            { key: 'provider', label: 'Provider', type: 'select', options: ['removebg', 'clipdrop', 'replicate', 'custom'] },
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'API key' },
            { key: 'model', label: 'Model', type: 'text', placeholder: 'u2net' },
            { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'Custom endpoint' }
        ]);
        h += renderSettingSection('Video Processing', 'videoProcessing', config.videoProcessing, [
            { key: 'enabled', label: 'Enable Video Tools', type: 'toggle' },
            { key: 'provider', label: 'Provider', type: 'select', options: ['cloudconvert', 'custom'] },
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'API key' },
            { key: 'maxFileSize', label: 'Max File Size (MB)', type: 'number', placeholder: '500' }
        ]);
        h += renderSettingSection('Audio Processing', 'audioProcessing', config.audioProcessing, [
            { key: 'enabled', label: 'Enable Audio Tools', type: 'toggle' },
            { key: 'provider', label: 'Provider', type: 'select', options: ['cloudconvert', 'custom'] },
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'API key' },
            { key: 'maxFileSize', label: 'Max File Size (MB)', type: 'number', placeholder: '100' }
        ]);
        h += renderSettingSection('URL Downloader', 'urlDownloader', config.urlDownloader, [
            { key: 'enabled', label: 'Enable URL Download', type: 'toggle' },
            { key: 'provider', label: 'Provider', type: 'select', options: ['yt-dlp', 'ytdl-core', 'custom'] },
            { key: 'maxQuality', label: 'Max Quality', type: 'select', options: ['720p', '1080p', '1440p', '2160p', 'best'] }
        ]);
        h += '</div>';
        body.innerHTML = h;
        body.querySelectorAll('.ait-section-test-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { testSection(this.dataset.group); });
        });
        body.querySelectorAll('.ait-section-save-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { saveSection(this.dataset.group); });
        });
    }

    function renderSettingSection(label, group, groupConfig, fields) {
        var h = '<div class="ait-settings-section">';
        h += '<div class="ait-settings-section-head">';
        h += '<h4>' + escHtml(label) + '</h4>';
        h += '<div class="ait-settings-section-btns">';
        h += '<button class="ait-btn ait-btn-sm ait-btn-outline ait-section-test-btn" data-group="' + group + '"><i class="fa-solid fa-vial"></i> Test</button>';
        h += '<button class="ait-btn ait-btn-sm ait-btn-primary ait-section-save-btn" data-group="' + group + '"><i class="fa-solid fa-save"></i> Save</button>';
        h += '</div></div>';
        fields.forEach(function (f) {
            var val = groupConfig ? (groupConfig[f.key] !== undefined ? groupConfig[f.key] : '') : '';
            h += '<div class="ait-form-group"><label class="ait-form-label">' + escHtml(f.label) + '</label>';
            if (f.type === 'toggle') {
                h += '<label class="toggle"><input type="checkbox" ' + (val ? 'checked' : '') + ' data-group="' + group + '" data-key="' + f.key + '"><span class="slider"></span></label>';
            } else if (f.type === 'select') {
                h += '<select class="ait-form-input" data-group="' + group + '" data-key="' + f.key + '">';
                f.options.forEach(function (o) { h += '<option value="' + o + '" ' + (val === o ? 'selected' : '') + '>' + o + '</option>'; });
                h += '</select>';
            } else if (f.type === 'password') {
                h += '<input type="password" class="ait-form-input" data-group="' + group + '" data-key="' + f.key + '" value="' + escHtml(val) + '" placeholder="' + (f.placeholder || '') + '">';
            } else if (f.type === 'number') {
                h += '<input type="number" class="ait-form-input" data-group="' + group + '" data-key="' + f.key + '" value="' + escHtml(val) + '" placeholder="' + (f.placeholder || '') + '">';
            } else {
                h += '<input type="text" class="ait-form-input" data-group="' + group + '" data-key="' + f.key + '" value="' + escHtml(val) + '" placeholder="' + (f.placeholder || '') + '">';
            }
            h += '</div>';
        });
        h += '</div>';
        return h;
    }

    function collectSectionConfig(group) {
        var config = AIToolsAPI.getConfig();
        var section = config[group] || {};
        var inputs = document.querySelectorAll('#aitPanelBody [data-group="' + group + '"][data-key]');
        inputs.forEach(function (el) {
            var key = el.dataset.key;
            if (el.type === 'checkbox') section[key] = el.checked;
            else if (el.type === 'number') section[key] = parseFloat(el.value) || 0;
            else section[key] = el.value;
        });
        return section;
    }

    function saveSection(group) {
        var section = collectSectionConfig(group);
        var fullConfig = AIToolsAPI.getConfig();
        fullConfig[group] = section;
        AIToolsAPI.saveConfig(fullConfig);
        var btn = document.querySelector('.ait-section-save-btn[data-group="' + group + '"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }
        if (section.apiKey) {
            fetch('/api/ai-tools/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: group, config: section })
            }).then(function (r) { return r.json(); }).then(function (data) {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Save'; }
                if (data.success) showToast(group + ' saved & synced to server', 'success');
                else showToast(group + ' saved locally: ' + (data.error || 'sync failed'), 'error');
            }).catch(function () {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Save'; }
                showToast(group + ' saved locally', 'success');
            });
        } else {
            setTimeout(function () {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Save'; }
                showToast(group + ' saved locally', 'success');
            }, 300);
        }
    }

    function testSection(group) {
        var section = collectSectionConfig(group);
        var btn = document.querySelector('.ait-section-test-btn[data-group="' + group + '"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...'; }
        if (!section.apiKey) {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-vial"></i> Test'; }
            showToast(group + ': No API key configured', 'info');
            return;
        }
        fetch('/api/ai-tools/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: group })
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-vial"></i> Test'; }
            if (data.success) showToast(group + ': ' + (data.message || 'Connection OK'), 'success');
            else showToast(group + ': ' + (data.error || 'Test failed'), 'error');
        }).catch(function (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-vial"></i> Test'; }
            showToast(group + ': Network error - ' + err.message, 'error');
        });
    }

    function renderToolForm(tool, options, files) {
        var h = '<div class="ait-tool-form">';
        h += '<p style="color:var(--ait-text-secondary);font-size:13px;margin-bottom:16px;">' + escHtml(tool.desc) + '</p>';

        if (files && files.length > 0) {
            h += '<div class="ait-form-group"><label class="ait-form-label">Selected Files</label>';
            files.forEach(function (f) {
                h += '<div style="padding:6px 10px;background:var(--ait-surface);border:1px solid var(--ait-border);border-radius:6px;font-size:12px;color:var(--ait-text);margin-bottom:4px;">' + escHtml(f.name) + ' <span style="color:var(--ait-text-muted);">' + AIToolsAPI.formatFileSize(f.size) + '</span></div>';
            });
            h += '</div>';
        }

        h += '<div class="ait-form-group"><label class="ait-form-label">Or Upload Files</label>' +
            '<input type="file" id="aitPanelFileInput" multiple class="ait-form-input" style="padding:6px;"></div>';

        var cat = tool.category;
        if (cat === 'video' || cat === 'audio') {
            var fmts = cat === 'video'
                ? ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv', '3gp']
                : ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'];
            h += '<div class="ait-form-group"><label class="ait-form-label">Output Format</label>' +
                '<select id="aitToolFormat" class="ait-form-select">';
            fmts.forEach(function (f) {
                h += '<option value="' + f + '"' + ((options && options.format === f) ? ' selected' : (f === fmts[0] ? ' selected' : '')) + '>' + f.toUpperCase() + '</option>';
            });
            h += '</select></div>';
        }

        if (cat === 'video' || cat === 'audio') {
            h += '<div class="ait-form-group"><label class="ait-form-label">Quality</label>' +
                '<select id="aitToolQuality" class="ait-form-select">' +
                '<option value="best">Best Quality</option>' +
                '<option value="good" selected>Good</option>' +
                '<option value="medium">Medium</option>' +
                '<option value="low">Low (Smaller Size)</option></select></div>';
        }

        if (tool.id === 'image-convert') {
            h += '<div class="ait-form-group"><label class="ait-form-label">Output Format</label>' +
                '<select id="aitToolFormat" class="ait-form-select">' +
                '<option value="jpg">JPG</option><option value="png">PNG</option>' +
                '<option value="webp" selected>WebP</option><option value="gif">GIF</option>' +
                '<option value="bmp">BMP</option><option value="tiff">TIFF</option></select></div>';
        }

        if (tool.id === 'image-resize') {
            h += '<div class="ait-form-row">' +
                '<div class="ait-form-group"><label class="ait-form-label">Width (px)</label><input type="number" id="aitToolWidth" class="ait-form-input" placeholder="1920"></div>' +
                '<div class="ait-form-group"><label class="ait-form-label">Height (px)</label><input type="number" id="aitToolHeight" class="ait-form-input" placeholder="1080"></div></div>';
            h += '<div class="ait-form-group"><label class="ait-form-label">Preserve Aspect Ratio</label>' +
                '<select id="aitToolAspect" class="ait-form-select"><option value="yes">Yes</option><option value="no">No</option></select></div>';
        }

        if (tool.id === 'image-crop') {
            h += '<div class="ait-form-row">' +
                '<div class="ait-form-group"><label class="ait-form-label">X</label><input type="number" id="aitToolX" class="ait-form-input" value="0"></div>' +
                '<div class="ait-form-group"><label class="ait-form-label">Y</label><input type="number" id="aitToolY" class="ait-form-input" value="0"></div></div>' +
                '<div class="ait-form-row">' +
                '<div class="ait-form-group"><label class="ait-form-label">Width</label><input type="number" id="aitToolCropW" class="ait-form-input" placeholder="800"></div>' +
                '<div class="ait-form-group"><label class="ait-form-label">Height</label><input type="number" id="aitToolCropH" class="ait-form-input" placeholder="600"></div></div>';
        }

        if (tool.id === 'image-rotate') {
            h += '<div class="ait-form-group"><label class="ait-form-label">Rotation</label>' +
                '<select id="aitToolRotation" class="ait-form-select">' +
                '<option value="90">90° Clockwise</option><option value="-90">90° Counter-clockwise</option>' +
                '<option value="180">180°</option><option value="flip-h">Flip Horizontal</option>' +
                '<option value="flip-v">Flip Vertical</option></select></div>';
        }

        if (tool.id === 'image-compress' || tool.id === 'video-compress' || tool.id === 'audio-compress') {
            h += '<div class="ait-form-group"><label class="ait-form-label">Compression Level</label>' +
                '<select id="aitToolCompression" class="ait-form-select">' +
                '<option value="light">Light (Best Quality)</option>' +
                '<option value="medium" selected>Medium (Balanced)</option>' +
                '<option value="heavy">Heavy (Smallest Size)</option></select></div>';
        }

        if (tool.id === 'url-download') {
            h += '<div class="ait-form-group"><label class="ait-form-label">URL</label>' +
                '<input type="url" id="aitToolUrl" class="ait-form-input" placeholder="https://example.com/video.mp4" value="' + (options && options.url ? escHtml(options.url) : '') + '"></div>';
            h += '<div class="ait-form-group"><label class="ait-form-label">Download Quality</label>' +
                '<select id="aitToolQuality" class="ait-form-select">' +
                '<option value="best">Best Available</option><option value="1080p" selected>1080p</option>' +
                '<option value="720p">720p</option><option value="480p">480p</option>' +
                '<option value="audio-only">Audio Only</option></select></div>';
        }

        if (tool.id === 'pdf-create') {
            h += '<div class="ait-form-group"><label class="ait-form-label">Page Size</label>' +
                '<select id="aitToolPageSize" class="ait-form-select"><option value="a4" selected>A4</option><option value="letter">Letter</option><option value="legal">Legal</option></select></div>';
            h += '<div class="ait-form-group"><label class="ait-form-label">Orientation</label>' +
                '<select id="aitToolOrientation" class="ait-form-select"><option value="portrait" selected>Portrait</option><option value="landscape">Landscape</option></select></div>';
        }

        if (tool.id === 'pdf-merge' || tool.id === 'pdf-split') {
            h += '<div class="ait-form-group"><label class="ait-form-label">Select PDF files to process</label>' +
                '<input type="file" id="aitPanelFileInput" multiple accept=".pdf" class="ait-form-input" style="padding:6px;"></div>';
        }

        if (tool.id === 'file-zip') {
            h += '<div class="ait-form-group"><label class="ait-form-label">Compression Level</label>' +
                '<select id="aitToolCompression" class="ait-form-select">' +
                '<option value="fast">Fast</option><option value="balanced" selected>Balanced</option>' +
                '<option value="maximum">Maximum</option></select></div>';
        }

        var selectedFiles = files || [];
        h += '<div style="margin-top:20px;display:flex;gap:8px;">' +
            '<button class="ait-btn ait-btn-primary ait-tool-process-btn" id="aitToolProcessBtn"><i class="fa-solid fa-play"></i> Process</button>' +
            '<button class="ait-btn ait-btn-outline" id="aitToolCancelBtn"><i class="fa-solid fa-xmark"></i> Cancel</button></div>';
        h += '</div>';
        return h;
    }

    function bindToolForm(tool) {
        var processBtn = document.getElementById('aitToolProcessBtn');
        var cancelBtn = document.getElementById('aitToolCancelBtn');
        var fileInput = document.getElementById('aitPanelFileInput');

        if (cancelBtn) cancelBtn.addEventListener('click', closeToolPanel);
        if (fileInput) fileInput.addEventListener('change', function () {
            handleFiles(this.files);
        });

        if (processBtn) processBtn.addEventListener('click', function () {
            var opts = gatherOptions(tool.id);
            var filesToProcess = _files.length > 0 ? _files.slice() : [];
            var jobName = getJobName(tool, opts);
            AIToolsWorker.addJob({
                type: tool.id,
                tool: tool.id,
                category: tool.category,
                name: jobName,
                files: filesToProcess.map(function (f) { return { name: f.name, size: f.size, type: f.type }; }),
                options: opts
            });
            closeToolPanel();
            showToast('Job started: ' + jobName, 'success');
        });
    }

    function gatherOptions(toolId) {
        var opts = {};
        var el;
        el = document.getElementById('aitToolFormat'); if (el) opts.format = el.value;
        el = document.getElementById('aitToolQuality'); if (el) opts.quality = el.value;
        el = document.getElementById('aitToolCompression'); if (el) opts.compression = el.value;
        el = document.getElementById('aitToolWidth'); if (el) opts.width = el.value;
        el = document.getElementById('aitToolHeight'); if (el) opts.height = el.value;
        el = document.getElementById('aitToolAspect'); if (el) opts.preserveAspect = el.value === 'yes';
        el = document.getElementById('aitToolX'); if (el) opts.x = parseInt(el.value) || 0;
        el = document.getElementById('aitToolY'); if (el) opts.y = parseInt(el.value) || 0;
        el = document.getElementById('aitToolCropW'); if (el) opts.cropWidth = el.value;
        el = document.getElementById('aitToolCropH'); if (el) opts.cropHeight = el.value;
        el = document.getElementById('aitToolRotation'); if (el) opts.rotation = el.value;
        el = document.getElementById('aitToolUrl'); if (el) opts.url = el.value;
        el = document.getElementById('aitToolPageSize'); if (el) opts.pageSize = el.value;
        el = document.getElementById('aitToolOrientation'); if (el) opts.orientation = el.value;
        return opts;
    }

    function getJobName(tool, opts) {
        var name = tool.name;
        if (opts.format) name += ' → ' + opts.format.toUpperCase();
        if (tool.id === 'url-download' && opts.url) name = 'Download: ' + opts.url.substring(0, 40);
        return name;
    }

    function showToast(msg, type) {
        if (typeof window.NexvoraAI !== 'undefined' && window.NexvoraAI.showToast) {
            window.NexvoraAI.showToast(msg, type);
        }
    }

    function escHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function timeAgo(ts) {
        if (!ts) return '';
        var diff = Date.now() - ts;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        return new Date(ts).toLocaleDateString();
    }

    return { init: init, processCommand: processCommand, openToolPanel: openToolPanel };
})();
