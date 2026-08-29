'use strict';

// ============================================================================
// nexvora.js — Nexvora AI Platform Main Application Logic
// ============================================================================

window.NexvoraAI = (function () {

    var SK = {
        CHATS: 'nexvora_chats',
        ACTIVE_CHAT: 'nexvora_active_chat',
        PROJECTS: 'nexvora_projects',
        FILES: 'nexvora_files',
        SETTINGS: 'nexvora_settings',
        ARCHIVED: 'nexvora_archived',
        LIBRARY: 'nexvora_library',
        SIDEBAR_STATE: 'nexvora_sidebar_collapsed',
        PROMPTS: 'nexvora_prompts',
        FAVORITES: 'nexvora_favorites',
        FEEDBACK: 'nexvora_feedback',
        ADMIN_SEEN: 'nexvora_admin_seen'
    };

    var DEFAULT_SETTINGS = {
        theme: 'system',
        language: 'en',
        enterToSend: true,
        autoScroll: true,
        markdownEnabled: true,
        compactMode: false,
        accentColor: '#6c5ce7',
        chatNotif: true,
        sounds: false
    };

    var DEFAULT_PROMPTS = [
        { id: 'p-w1', title: 'Professional Email Writer', category: 'writing', description: 'Write a professional email for any occasion', content: 'Write a professional email with the following details:\n\nSubject: {input}\n\nMake it clear, concise, and professional. Use appropriate greetings and closings.', isDefault: true },
        { id: 'p-w2', title: 'Blog Post Outline', category: 'writing', description: 'Create a structured blog post outline', content: 'Create a detailed blog post outline for the topic: {input}\n\nInclude:\n- Engaging title options\n- Introduction hook\n- 3-5 main sections with sub-points\n- Conclusion with call to action\n- SEO keywords to target', isDefault: true },
        { id: 'p-w3', title: 'Creative Story Starter', category: 'writing', description: 'Generate a creative story opening', content: 'Write an engaging opening paragraph for a story based on: {input}\n\nMake it vivid, compelling, and hook the reader immediately.', isDefault: true },
        { id: 'p-b1', title: 'Business Proposal Summary', category: 'business', description: 'Summarize a business proposal', content: 'Create a concise business proposal summary for: {input}\n\nInclude: Executive summary, key objectives, expected outcomes, and next steps.', isDefault: true },
        { id: 'p-b2', title: 'Meeting Agenda', category: 'business', description: 'Generate a meeting agenda', content: 'Create a structured meeting agenda for: {input}\n\nInclude: Topics, time allocations, discussion leaders, and expected outcomes.', isDefault: true },
        { id: 'p-c1', title: 'Code Review Assistant', category: 'coding', description: 'Review code for issues and improvements', content: 'Review the following code and provide:\n1. Potential bugs or errors\n2. Performance improvements\n3. Code style suggestions\n4. Security concerns\n5. Overall assessment\n\nCode:\n{input}', isDefault: true },
        { id: 'p-c2', title: 'Debug Helper', category: 'coding', description: 'Help debug code issues', content: 'Help me debug the following issue:\n\n{input}\n\nProvide:\n- Likely cause of the error\n- Step-by-step fix\n- Prevention tips for the future', isDefault: true },
        { id: 'p-c3', title: 'API Documentation', category: 'coding', description: 'Generate API documentation', content: 'Generate comprehensive API documentation for:\n\n{input}\n\nInclude: Endpoint, method, parameters, response format, examples, and error codes.', isDefault: true },
        { id: 'p-e1', title: 'Study Guide Generator', category: 'education', description: 'Create a study guide for any topic', content: 'Create a comprehensive study guide for: {input}\n\nInclude:\n- Key concepts and definitions\n- Summary notes\n- Practice questions\n- Memory techniques\n- Recommended resources', isDefault: true },
        { id: 'p-e2', title: 'Explain Like I\'m 5', category: 'education', description: 'Explain complex topics simply', content: 'Explain the following concept in simple terms, as if teaching a beginner:\n\n{input}\n\nUse analogies and everyday examples.', isDefault: true },
        { id: 'p-t1', title: 'Multi-language Translator', category: 'translation', description: 'Translate text between languages', content: 'Translate the following text to {input}\n\nMaintain the original tone and meaning. Provide the translation and any cultural notes if relevant.', isDefault: true },
        { id: 'p-m1', title: 'Social Media Post', category: 'marketing', description: 'Create engaging social media content', content: 'Create an engaging social media post about: {input}\n\nPlatform: (specify if needed)\nInclude: Hook, main content, hashtags, call to action.\nKeep it concise and engaging.', isDefault: true },
        { id: 'p-m2', title: 'Product Description', category: 'marketing', description: 'Write compelling product descriptions', content: 'Write a compelling product description for: {input}\n\nHighlight benefits, features, and unique selling points. Make it persuasive and scannable.', isDefault: true },
        { id: 'p-p1', title: 'Weekly Planner', category: 'productivity', description: 'Plan your week effectively', content: 'Create an effective weekly plan based on:\n\n{input}\n\nInclude: Priority tasks, time blocks, breaks, and realistic scheduling.', isDefault: true },
        { id: 'p-p2', title: 'Decision Matrix', category: 'productivity', description: 'Analyze a decision systematically', content: 'Help me analyze the following decision:\n\n{input}\n\nCreate a decision matrix with pros, cons, alternatives, and a recommendation.', isDefault: true }
    ];

    var settings = {};
    var currentChatId = null;
    var isGenerating = false;
    var speechRecognition = null;
    var isRecording = false;
    var translationMode = false;

    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
    function lsGetJSON(key) { try { return JSON.parse(lsGet(key)); } catch (e) { return null; } }

    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }
    function genId() { return 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6); }
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    function truncate(str, len) {
        return str && str.length > len ? str.slice(0, len) + '...' : str || '';
    }
    function timeAgo(ts) {
        var diff = Date.now() - ts;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
        return new Date(ts).toLocaleDateString();
    }

    // --- Admin role checking ---
    function isAdmin() {
        if (typeof window.Auth !== 'undefined' && window.Auth.isAdmin) {
            return window.Auth.isAdmin();
        }
        return false;
    }

    function requireAdmin() {
        if (!isAdmin()) {
            showToast('Access denied. Admin privileges required.', 'error');
            return false;
        }
        return true;
    }

    // --- Settings ---
    function loadSettings() { settings = Object.assign({}, DEFAULT_SETTINGS, lsGetJSON(SK.SETTINGS) || {}); }
    function saveSettings() { lsSet(SK.SETTINGS, settings); }

    // --- Chat Management ---
    function getAllChats() { return lsGetJSON(SK.CHATS) || []; }
    function saveChats(chats) { lsSet(SK.CHATS, chats); }

    function createChat(title, projectId) {
        var chat = {
            id: genId(),
            title: title || 'New Chat',
            messages: [],
            projectId: projectId || null,
            modelId: (NexvoraModelManager.getActiveModel() || {}).id || '',
            pinned: false,
            favorite: false,
            archived: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        var chats = getAllChats();
        chats.unshift(chat);
        saveChats(chats);
        return chat;
    }

    function getChat(id) {
        var chats = getAllChats();
        for (var i = 0; i < chats.length; i++) {
            if (chats[i].id === id) return chats[i];
        }
        return null;
    }

    function updateChat(id, updates) {
        var chats = getAllChats();
        for (var i = 0; i < chats.length; i++) {
            if (chats[i].id === id) {
                Object.assign(chats[i], updates, { updatedAt: Date.now() });
                saveChats(chats);
                return chats[i];
            }
        }
        return null;
    }

    function deleteChat(id) {
        var chats = getAllChats().filter(function (c) { return c.id !== id; });
        saveChats(chats);
        if (currentChatId === id) {
            currentChatId = null;
            lsSet(SK.ACTIVE_CHAT, '');
            if (chats.length > 0) openChat(chats[0].id);
            else showWelcome();
        }
        renderChatList();
        renderDashboard();
    }

    // --- Projects ---
    function getAllProjects() { return lsGetJSON(SK.PROJECTS) || []; }
    function saveProjects(p) { lsSet(SK.PROJECTS, p); }

    function createProject(name, desc) {
        var projects = getAllProjects();
        var project = { id: 'proj-' + Date.now(), name: name, description: desc || '', createdAt: Date.now() };
        projects.push(project);
        saveProjects(projects);
        return project;
    }

    function deleteProject(id) {
        var projects = getAllProjects().filter(function (p) { return p.id !== id; });
        saveProjects(projects);
        var chats = getAllChats();
        chats.forEach(function (c) { if (c.projectId === id) c.projectId = null; });
        saveChats(chats);
    }

    // --- Files ---
    function getAllFiles() { return lsGetJSON(SK.FILES) || []; }
    function saveFiles(f) { lsSet(SK.FILES, f); }

    // --- Library ---
    function getAllLibrary() { return lsGetJSON(SK.LIBRARY) || []; }
    function saveLibrary(items) { lsSet(SK.LIBRARY, items); }

    function addToLibrary(item) {
        var lib = getAllLibrary();
        lib.unshift({
            id: 'lib-' + Date.now() + '-' + Math.random().toString(36).slice(2, 4),
            title: item.title || 'Untitled',
            content: item.content || '',
            source: item.source || '',
            model: item.model || '',
            type: item.type || 'output',
            createdAt: Date.now()
        });
        saveLibrary(lib);
    }

    function removeFromLibrary(id) {
        var lib = getAllLibrary().filter(function (i) { return i.id !== id; });
        saveLibrary(lib);
    }

    // --- Prompts ---
    function getAllPrompts() {
        var prompts = lsGetJSON(SK.PROMPTS);
        if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
            prompts = DEFAULT_PROMPTS.map(function (p) { return Object.assign({}, p, { createdAt: Date.now() }); });
            lsSet(SK.PROMPTS, prompts);
        }
        return prompts;
    }
    function savePrompts(p) { lsSet(SK.PROMPTS, p); }

    function addPrompt(data) {
        var prompts = getAllPrompts();
        var prompt = {
            id: 'prompt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 4),
            title: data.title,
            category: data.category || 'custom',
            description: data.description || '',
            content: data.content,
            isDefault: false,
            createdAt: Date.now()
        };
        prompts.push(prompt);
        savePrompts(prompts);
        return prompt;
    }

    function deletePrompt(id) {
        var prompts = getAllPrompts().filter(function (p) { return p.id !== id; });
        savePrompts(prompts);
    }

    // --- Favorites ---
    function getAllFavorites() { return lsGetJSON(SK.FAVORITES) || []; }
    function saveFavorites(f) { lsSet(SK.FAVORITES, f); }

    function addToFavorites(item) {
        var favs = getAllFavorites();
        for (var i = 0; i < favs.length; i++) {
            if (favs[i].sourceId === item.sourceId) return;
        }
        favs.unshift({
            id: 'fav-' + Date.now() + '-' + Math.random().toString(36).slice(2, 4),
            sourceId: item.sourceId || '',
            title: item.title || 'Untitled',
            content: item.content || '',
            type: item.type || 'chat',
            createdAt: Date.now()
        });
        saveFavorites(favs);
    }

    function removeFromFavorites(id) {
        var favs = getAllFavorites().filter(function (f) { return f.id !== id; });
        saveFavorites(favs);
    }

    // --- Toast ---
    function showToast(msg, type) {
        type = type || 'info';
        var container = $('#nexvoraToasts');
        if (!container) return;
        var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
        var toast = document.createElement('div');
        toast.className = 'nexvora-toast ' + type;
        toast.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span>' + escapeHtml(msg) + '</span>';
        container.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('removing');
            setTimeout(function () { toast.remove(); }, 300);
        }, 3500);
    }

    // --- Auth ---
    function checkAuth() {
        if (typeof Auth !== 'undefined' && Auth.isAuthenticated()) {
            showApp();
        } else {
            showAuthGate();
        }
    }

    function showAuthGate() {
        $('#authGate').classList.remove('nexvora-hidden');
        $('#nexvoraApp').classList.add('nexvora-hidden');
        initAuthParticles();
    }

    function showApp() {
        $('#authGate').classList.add('nexvora-hidden');
        $('#nexvoraApp').classList.remove('nexvora-hidden');
        initApp();
    }

    function initAuthParticles() {
        var canvas = $('#nexvora-particles');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var w, h, particles = [];
        function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
        function init() {
            resize(); particles = [];
            var count = Math.min(80, Math.floor((w * h) / 15000));
            for (var i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * w, y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
                    r: Math.random() * 2 + 0.5, phase: Math.random() * Math.PI * 2
                });
            }
        }
        function animate() {
            ctx.clearRect(0, 0, w, h);
            particles.forEach(function (p) {
                p.x += p.vx; p.y += p.vy; p.phase += 0.01;
                if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
                var pulse = Math.sin(p.phase) * 0.3 + 0.7;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(108,92,231,' + (0.2 * pulse) + ')'; ctx.fill();
            });
            for (var i = 0; i < particles.length; i++) {
                for (var j = i + 1; j < particles.length; j++) {
                    var dx = particles[i].x - particles[j].x;
                    var dy = particles[i].y - particles[j].y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = 'rgba(108,92,231,' + (0.05 * (1 - dist / 120)) + ')';
                        ctx.lineWidth = 0.5; ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        }
        window.addEventListener('resize', resize); init(); animate();
    }

    function initAuthForms() {
        var passToggle = $('#nexvoraPassToggle');
        if (passToggle) passToggle.addEventListener('click', function () {
            var input = $('#nexvoraPass'); var icon = this.querySelector('i');
            if (input.type === 'password') { input.type = 'text'; icon.className = 'fa-solid fa-eye-slash'; }
            else { input.type = 'password'; icon.className = 'fa-solid fa-eye'; }
        });
        var regPassToggle = $('#nexvoraRegPassToggle');
        if (regPassToggle) regPassToggle.addEventListener('click', function () {
            var input = $('#nexvoraRegPass'); var icon = this.querySelector('i');
            if (input.type === 'password') { input.type = 'text'; icon.className = 'fa-solid fa-eye-slash'; }
            else { input.type = 'password'; icon.className = 'fa-solid fa-eye'; }
        });
        var showReg = $('#nexvoraShowRegister');
        var showLogin = $('#nexvoraShowLogin');
        if (showReg) showReg.addEventListener('click', function () {
            $('#authLoginForm').classList.add('nexvora-hidden');
            $('#authRegisterForm').classList.remove('nexvora-hidden');
        });
        if (showLogin) showLogin.addEventListener('click', function () {
            $('#authRegisterForm').classList.add('nexvora-hidden');
            $('#authLoginForm').classList.remove('nexvora-hidden');
        });
        var loginForm = $('#nexvoraLoginForm');
        if (loginForm) loginForm.addEventListener('submit', function (e) { e.preventDefault(); handleLogin(); });
        var regForm = $('#nexvoraRegisterForm');
        if (regForm) regForm.addEventListener('submit', function (e) { e.preventDefault(); handleRegister(); });
        var googleBtn = $('#nexvoraGoogleLogin');
        if (googleBtn) googleBtn.addEventListener('click', function () { handleGoogleLogin(); });
        var guestBtn = $('#nexvoraGuestLogin');
        if (guestBtn) guestBtn.addEventListener('click', function () { handleGuestLogin(); });
        var adminLoginBtn = $('#nexvoraAdminLogin');
        if (adminLoginBtn) adminLoginBtn.addEventListener('click', function () { handleAdminLogin(); });
        var adminDashBtn = $('#nexvoraAdminDashboard');
        if (adminDashBtn) adminDashBtn.addEventListener('click', function () { handleAdminDashboard(); });
    }

    function handleLogin() {
        var email = ($('#nexvoraEmail') || {}).value || '';
        var pass = ($('#nexvoraPass') || {}).value || '';
        var errorEl = $('#nexvoraAuthError');
        var btn = $('#nexvoraSubmitBtn');
        if (!email || !pass) { if (errorEl) errorEl.textContent = 'Please fill in all fields'; return; }
        btn.classList.add('loading');
        try {
            var users = JSON.parse(localStorage.getItem('tamilAIStream_users') || '[]');
            var user = null;
            for (var i = 0; i < users.length; i++) {
                if (users[i].email === email && users[i].password === pass) { user = users[i]; break; }
            }
            if (user) {
                var sessionUser = Auth.createSession({
                    email: user.email, name: user.name || user.email.split('@')[0], avatar: user.avatar || ''
                }, $('#nexvoraRemember') && $('#nexvoraRemember').checked);
                btn.classList.remove('loading'); showApp();
                showToast('Welcome back, ' + (sessionUser.name || 'User') + '!', 'success');
            } else {
                btn.classList.remove('loading');
                if (errorEl) errorEl.textContent = 'Invalid email or password';
                showToast('Invalid credentials', 'error');
            }
        } catch (e) {
            btn.classList.remove('loading');
            if (errorEl) errorEl.textContent = 'Login failed. Please try again.';
        }
    }

    function handleRegister() {
        var name = ($('#nexvoraRegName') || {}).value || '';
        var email = ($('#nexvoraRegEmail') || {}).value || '';
        var pass = ($('#nexvoraRegPass') || {}).value || '';
        var confirm = ($('#nexvoraRegConfirm') || {}).value || '';
        var errorEl = $('#nexvoraRegError');
        var btn = $('#nexvoraRegBtn');
        if (!name || !email || !pass || !confirm) { if (errorEl) errorEl.textContent = 'Please fill in all fields'; return; }
        if (pass.length < 8) { if (errorEl) errorEl.textContent = 'Password must be at least 8 characters'; return; }
        if (pass !== confirm) { if (errorEl) errorEl.textContent = 'Passwords do not match'; return; }
        btn.classList.add('loading');
        try {
            var users = JSON.parse(localStorage.getItem('tamilAIStream_users') || '[]');
            for (var i = 0; i < users.length; i++) {
                if (users[i].email === email) { btn.classList.remove('loading'); if (errorEl) errorEl.textContent = 'Email already registered'; return; }
            }
            users.push({ name: name, email: email, password: pass, createdAt: Date.now() });
            localStorage.setItem('tamilAIStream_users', JSON.stringify(users));
            Auth.createSession({ email: email, name: name }, true);
            btn.classList.remove('loading'); showApp();
            showToast('Account created! Welcome, ' + name + '!', 'success');
        } catch (e) { btn.classList.remove('loading'); if (errorEl) errorEl.textContent = 'Registration failed'; }
    }

    function handleGoogleLogin() {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
                .then(function (result) {
                    var user = result.user;
                    Auth.createSession({ email: user.email, name: user.displayName || user.email.split('@')[0], avatar: user.photoURL || '' }, true);
                    showApp(); showToast('Signed in with Google!', 'success');
                })
                .catch(function (err) { showToast('Google sign-in failed: ' + err.message, 'error'); });
        } else { showToast('Firebase not loaded. Use email login.', 'info'); }
    }

    function handleGuestLogin() {
        Auth.createSession({ email: 'guest@nexvora.ai', name: 'Guest User' }, false, true);
        showApp(); showToast('Continuing as Guest', 'info');
    }

    var ADMIN_EMAIL = 'admin@tamilaistream.com';
    var ADMIN_PASSWORD = 'Admin@123';
    var ADMIN_NAME = 'Admin User';

    function handleAdminLogin() {
        var btn = $('#nexvoraAdminLogin');
        if (!btn) return;
        btn.classList.add('loading');
        btn.disabled = true;
        var originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';
        try {
            var users = JSON.parse(localStorage.getItem('tamilAIStream_users') || '[]');
            var user = null;
            for (var i = 0; i < users.length; i++) {
                if (users[i].email === ADMIN_EMAIL && users[i].password === ADMIN_PASSWORD) { user = users[i]; break; }
            }
            if (!user) {
                user = { uid: 'admin-nexvora', email: ADMIN_EMAIL, name: ADMIN_NAME, password: ADMIN_PASSWORD };
                users.push(user);
                localStorage.setItem('tamilAIStream_users', JSON.stringify(users));
            }
            Auth.createSession({ email: user.email, name: user.name, avatar: user.avatar || '' }, true);
            localStorage.setItem('adminSession', JSON.stringify({
                username: ADMIN_EMAIL, email: ADMIN_EMAIL, displayName: ADMIN_NAME,
                loginTime: Date.now(), expiry: Date.now() + (24 * 60 * 60 * 1000)
            }));
            btn.innerHTML = originalHTML;
            btn.classList.remove('loading');
            btn.disabled = false;
            showApp();
            showToast('Welcome Admin!', 'success');
        } catch (e) {
            btn.innerHTML = originalHTML;
            btn.classList.remove('loading');
            btn.disabled = false;
            showToast('Admin login failed', 'error');
        }
    }

    function handleAdminDashboard() {
        var btn = $('#nexvoraAdminDashboard');
        if (!btn) return;
        btn.classList.add('loading');
        btn.disabled = true;
        var originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Opening...';
        try {
            var users = JSON.parse(localStorage.getItem('tamilAIStream_users') || '[]');
            var user = null;
            for (var i = 0; i < users.length; i++) {
                if (users[i].email === ADMIN_EMAIL && users[i].password === ADMIN_PASSWORD) { user = users[i]; break; }
            }
            if (!user) {
                user = { uid: 'admin-nexvora', email: ADMIN_EMAIL, name: ADMIN_NAME, password: ADMIN_PASSWORD };
                users.push(user);
                localStorage.setItem('tamilAIStream_users', JSON.stringify(users));
            }
            Auth.createSession({ email: user.email, name: user.name, avatar: user.avatar || '' }, true);
            localStorage.setItem('adminSession', JSON.stringify({
                username: ADMIN_EMAIL, email: ADMIN_EMAIL, displayName: ADMIN_NAME,
                loginTime: Date.now(), expiry: Date.now() + (24 * 60 * 60 * 1000)
            }));
            showToast('Opening Admin Dashboard...', 'success');
            setTimeout(function () { window.location.href = 'dashboard.html'; }, 600);
        } catch (e) {
            btn.innerHTML = originalHTML;
            btn.classList.remove('loading');
            btn.disabled = false;
            showToast('Failed to open dashboard', 'error');
        }
    }

    // --- App Initialization ---
    function initApp() {
        loadSettings();
        var user = Auth.currentUser();
        if (user) {
            var name = user.name || user.email || 'User';
            var email = user.email || '';
            if ($('#nexvoraUserName')) $('#nexvoraUserName').textContent = name;
            if ($('#nexvoraDropdownName')) $('#nexvoraDropdownName').textContent = name;
            if ($('#nexvoraDropdownEmail')) $('#nexvoraDropdownEmail').textContent = email;
            if ($('#nexvoraUserEmail')) $('#nexvoraUserEmail').textContent = email;
            var avatarEl = $('#nexvoraUserAvatar');
            if (avatarEl) {
                if (user.avatar) {
                    avatarEl.innerHTML = '<img src="' + user.avatar + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
                } else {
                    avatarEl.innerHTML = name.charAt(0).toUpperCase();
                }
            }

            // Show/hide admin-only menu items
            var adminItems = $$('.nexvora-dropdown-admin-only');
            adminItems.forEach(function (item) {
                item.style.display = isAdmin() ? '' : 'none';
            });
        }
        restoreSidebarState();
        initEventListeners();

        try { renderModelSelector(); } catch (e) { console.error('[Nexvora] renderModelSelector error:', e); }
        try { renderModelManagerCards(); } catch (e) { console.error('[Nexvora] renderModelManagerCards error:', e); }
        try { renderChatList(); } catch (e) { console.error('[Nexvora] renderChatList error:', e); }
        try { renderProjects(); } catch (e) { console.error('[Nexvora] renderProjects error:', e); }
        try { renderFiles(); } catch (e) { console.error('[Nexvora] renderFiles error:', e); }
        try { renderLibrary(); } catch (e) { console.error('[Nexvora] renderLibrary error:', e); }
        try { renderPrompts(); } catch (e) { console.error('[Nexvora] renderPrompts error:', e); }
        try { renderFavorites(); } catch (e) { console.error('[Nexvora] renderFavorites error:', e); }
        try { renderDashboard(); } catch (e) { console.error('[Nexvora] renderDashboard error:', e); }
        try { applySettings(); } catch (e) { console.error('[Nexvora] applySettings error:', e); }
        try { updateConnectionStatus(); } catch (e) { console.error('[Nexvora] updateConnectionStatus error:', e); }

        // Check API connection on startup (non-blocking)
        if (typeof NexvoraAIService !== 'undefined') {
            NexvoraAIService.checkConnection().then(function () {
                updateConnectionStatus();
                renderDashboard();
            });
        }

        var lastChat = lsGet(SK.ACTIVE_CHAT);
        if (lastChat && getChat(lastChat)) {
            openChat(lastChat);
            showView('chat');
        } else {
            showView('dashboard');
            showWelcome();
        }
    }

    // --- Event Listeners ---
    function initEventListeners() {
        var hamburger = $('#nexvoraHamburger');
        var sidebarClose = $('#nexvoraSidebarClose');
        var sidebarOverlay = $('#nexvoraSidebarOverlay');
        if (hamburger) hamburger.addEventListener('click', toggleSidebar);
        if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

        var collapseBtn = $('#nexvoraCollapseBtn');
        if (collapseBtn) collapseBtn.addEventListener('click', toggleSidebarCollapse);

        var newChatBtns = ['nexvoraNewChat', 'nexvoraModelBarNewChat', 'mobileNewChat'];
        newChatBtns.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('click', function () { startNewChat(); closeSidebar(); });
        });

        var input = $('#nexvoraInput');
        if (input) {
            input.addEventListener('input', function () {
                autoResize(this);
                var sendBtn = $('#nexvoraSendBtn');
                if (sendBtn) sendBtn.disabled = !this.value.trim();
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey && settings.enterToSend) {
                    e.preventDefault(); sendMessage();
                }
            });
        }

        var sendBtn = $('#nexvoraSendBtn');
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);
        var stopBtn = $('#nexvoraStopBtn');
        if (stopBtn) stopBtn.addEventListener('click', stopGeneration);

        var modelSelector = $('#nexvoraModelSelector');
        if (modelSelector) modelSelector.addEventListener('click', function (e) {
            e.stopPropagation();
            var dd = $('#nexvoraModelDropdown');
            if (dd) dd.classList.toggle('open');
        });

        document.addEventListener('click', function (e) {
            var dd = $('#nexvoraModelDropdown');
            if (dd) dd.classList.remove('open');
            var ctx = $('#nexvoraContextMenu');
            if (ctx && !ctx.contains(e.target)) ctx.classList.add('nexvora-hidden');
            var acctDd = $('#nexvoraAccountDropdown');
            var acctTrigger = $('#nexvoraAccountTrigger');
            if (acctDd && acctDd.classList.contains('open')) {
                if (!acctDd.contains(e.target) && !acctTrigger.contains(e.target)) {
                    acctDd.classList.remove('open');
                }
            }
        });

        // Search - open global search modal
        var searchInput = $('#nexvoraSearch');
        if (searchInput) searchInput.addEventListener('focus', function () {
            showSearchModal();
            this.blur();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function (e) {
            // Ctrl+K - Search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault(); showSearchModal();
            }
            // Ctrl+N - New Chat
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault(); startNewChat(); closeSidebar();
            }
            // Ctrl+/ - Shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault(); showShortcutsModal();
            }
            // Ctrl+B - Toggle Sidebar
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault(); toggleSidebarCollapse();
            }
            // Ctrl+1-4 - Navigation
            if ((e.ctrlKey || e.metaKey) && e.key === '1') { e.preventDefault(); navigateTo('dashboard'); }
            if ((e.ctrlKey || e.metaKey) && e.key === '2') { e.preventDefault(); navigateTo('chat'); }
            if ((e.ctrlKey || e.metaKey) && e.key === '3') { e.preventDefault(); navigateTo('tools'); }
            if ((e.ctrlKey || e.metaKey) && e.key === '4') { e.preventDefault(); navigateTo('prompts'); }
            // Escape - close modals, stop generation
            if (e.key === 'Escape') {
                closeAllModals();
                if (isGenerating) stopGeneration();
            }
        });

        // Primary nav buttons
        var navItems = $$('.nexvora-nav-item');
        navItems.forEach(function (item) {
            item.addEventListener('click', function () {
                var nav = this.dataset.nav;
                if (nav === 'tools') {
                    this.classList.toggle('open');
                    var submenu = $('#nexvoraToolsSubmenu');
                    if (submenu) submenu.classList.toggle('open');
                    return;
                }
                navigateTo(nav);
                closeSidebar();
            });
        });

        // Tool items
        var toolItems = $$('.nexvora-tool-item');
        toolItems.forEach(function (item) {
            item.addEventListener('click', function () {
                var tool = this.dataset.tool;
                if (tool === 'more') {
                    navigateTo('tools');
                } else if (tool === 'translate') {
                    translationMode = true;
                    startNewChat('Translation');
                    var input = $('#nexvoraInput');
                    if (input) { input.placeholder = 'Enter Tamil text to translate...'; input.focus(); }
                    showToast('Translation mode — type Tamil text to translate to English', 'info');
                } else {
                    translationMode = false;
                    startNewChat();
                    showToast(tool.charAt(0).toUpperCase() + tool.slice(1) + ' tool ready — type your request', 'info');
                }
                closeSidebar();
            });
        });

        // Welcome chips
        var chips = $$('.nexvora-chip');
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                var prompt = this.dataset.prompt;
                if (prompt) {
                    var input = $('#nexvoraInput');
                    if (input) { input.value = prompt; input.dispatchEvent(new Event('input')); }
                    sendMessage();
                }
            });
        });

        // File attachment
        var attachBtn = $('#nexvoraAttachBtn');
        var fileInput = $('#nexvoraFileInput');
        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', function () { fileInput.click(); });
            fileInput.addEventListener('change', handleFileAttachment);
        }

        var voiceBtn = $('#nexvoraVoiceBtn');
        if (voiceBtn) voiceBtn.addEventListener('click', toggleVoiceInput);

        var addProjectBtn = $('#nexvoraAddProject');
        if (addProjectBtn) addProjectBtn.addEventListener('click', showProjectModal);

        var acctTrigger = $('#nexvoraAccountTrigger');
        if (acctTrigger) acctTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var dd = $('#nexvoraAccountDropdown');
            if (dd) dd.classList.toggle('open');
        });

        var acctItems = $$('.nexvora-dropdown-item');
        acctItems.forEach(function (item) {
            item.addEventListener('click', function () {
                var action = this.dataset.action;
                var dd = $('#nexvoraAccountDropdown');
                if (dd) dd.classList.remove('open');
                handleAccountAction(action);
            });
        });

        initSettingsListeners();

        var addModelBtn = $('#nexvoraAddModel');
        if (addModelBtn) addModelBtn.addEventListener('click', function () { showModelModal(); });
        var modelForm = $('#nexvoraModelForm');
        if (modelForm) modelForm.addEventListener('submit', function (e) { e.preventDefault(); saveModelFromForm(); });
        var modelFormCancel = $('#nexvoraModelFormCancel');
        if (modelFormCancel) modelFormCancel.addEventListener('click', hideModelModal);
        var modelModalClose = $('#nexvoraModelModalClose');
        if (modelModalClose) modelModalClose.addEventListener('click', hideModelModal);
        var modelModalBackdrop = $('#nexvoraModelModalBackdrop');
        if (modelModalBackdrop) modelModalBackdrop.addEventListener('click', hideModelModal);
        var mdlKeyToggle = $('#nexvoraMdlKeyToggle');
        if (mdlKeyToggle) mdlKeyToggle.addEventListener('click', function () {
            var input = $('#nexvoraMdlApiKey'); var icon = this.querySelector('i');
            if (input.type === 'password') { input.type = 'text'; icon.className = 'fa-solid fa-eye-slash'; }
            else { input.type = 'password'; icon.className = 'fa-solid fa-eye'; }
        });

        initModelManagerListeners();

        var projectForm = $('#nexvoraProjectForm');
        if (projectForm) projectForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = ($('#nexvoraProjectName') || {}).value.trim();
            var desc = ($('#nexvoraProjectDesc') || {}).value.trim();
            if (name) { createProject(name, desc); renderProjects(); hideProjectModal(); renderDashboard(); showToast('Project "' + name + '" created', 'success'); }
        });
        var projectCancel = $('#nexvoraProjectFormCancel');
        if (projectCancel) projectCancel.addEventListener('click', hideProjectModal);
        var projectClose = $('#nexvoraProjectModalClose');
        if (projectClose) projectClose.addEventListener('click', hideProjectModal);
        var projectBackdrop = $('#nexvoraProjectModalBackdrop');
        if (projectBackdrop) projectBackdrop.addEventListener('click', hideProjectModal);

        // Prompt form
        var promptForm = $('#nexvoraPromptForm');
        if (promptForm) promptForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var title = ($('#nexvoraPromptTitle') || {}).value.trim();
            var content = ($('#nexvoraPromptContent') || {}).value.trim();
            var category = ($('#nexvoraPromptCategory') || {}).value;
            var desc = ($('#nexvoraPromptDesc') || {}).value.trim();
            if (title && content) {
                addPrompt({ title: title, content: content, category: category, description: desc });
                hidePromptModal(); renderPrompts(); showToast('Prompt saved', 'success');
            }
        });
        var promptCancel = $('#nexvoraPromptFormCancel');
        if (promptCancel) promptCancel.addEventListener('click', hidePromptModal);
        var promptClose = $('#nexvoraPromptModalClose');
        if (promptClose) promptClose.addEventListener('click', hidePromptModal);
        var promptBackdrop = $('#nexvoraPromptModalBackdrop');
        if (promptBackdrop) promptBackdrop.addEventListener('click', hidePromptModal);

        var newPromptBtn = $('#nexvoraNewPrompt');
        if (newPromptBtn) newPromptBtn.addEventListener('click', function () { showPromptModal(); });

        // Prompt search
        var promptSearch = $('#nexvoraPromptSearch');
        if (promptSearch) promptSearch.addEventListener('input', function () { renderPrompts(this.value); });

        // Prompt categories
        var catBtns = $$('.nexvora-cat-btn');
        catBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                catBtns.forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                renderPrompts($('#nexvoraPromptSearch') ? $('#nexvoraPromptSearch').value : '', this.dataset.cat);
            });
        });

        // FAQ toggle
        var faqItems = $$('.nexvora-faq-q');
        faqItems.forEach(function (q) {
            q.addEventListener('click', function () {
                this.closest('.nexvora-faq-item').classList.toggle('open');
            });
        });

        // Feedback form
        var feedbackBtn = $('#nexvoraSubmitFeedback');
        if (feedbackBtn) feedbackBtn.addEventListener('click', function () {
            var type = ($('#nexvoraFeedbackType') || {}).value;
            var msg = ($('#nexvoraFeedbackMsg') || {}).value.trim();
            if (!msg) { showToast('Please enter your feedback', 'error'); return; }
            var feedback = lsGetJSON(SK.FEEDBACK) || [];
            feedback.push({ type: type, message: msg, createdAt: Date.now() });
            lsSet(SK.FEEDBACK, feedback);
            ($('#nexvoraFeedbackMsg')).value = '';
            showToast('Feedback submitted! Thank you.', 'success');
        });

        // Global search modal
        var searchModalBackdrop = $('#nexvoraSearchModalBackdrop');
        if (searchModalBackdrop) searchModalBackdrop.addEventListener('click', hideSearchModal);
        var globalSearch = $('#nexvoraGlobalSearch');
        if (globalSearch) globalSearch.addEventListener('input', function () { performGlobalSearch(this.value); });

        // Shortcuts modal
        var shortcutsClose = $('#nexvoraShortcutsModalClose');
        if (shortcutsClose) shortcutsClose.addEventListener('click', hideShortcutsModal);
        var shortcutsBackdrop = $('#nexvoraShortcutsModalBackdrop');
        if (shortcutsBackdrop) shortcutsBackdrop.addEventListener('click', hideShortcutsModal);

        // Export chat button
        var exportChatBtn = $('#nexvoraExportChat');
        if (exportChatBtn) exportChatBtn.addEventListener('click', function () {
            if (currentChatId) exportSingleChat(currentChatId);
        });

        // Quick actions on dashboard
        var quickActions = $$('.nexvora-quick-action');
        quickActions.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = this.dataset.action;
                if (action === 'new-chat') { translationMode = false; startNewChat(); }
                else if (action === 'translate') {
                    translationMode = true;
                    startNewChat('Translation');
                    var input = $('#nexvoraInput');
                    if (input) { input.placeholder = 'Enter Tamil text to translate...'; input.focus(); }
                    showToast('Translation mode — type Tamil text to translate to English', 'info');
                }
                else if (action === 'projects') { showProjectModal(); }
                else if (action === 'prompts') { navigateTo('prompts'); }
                else { translationMode = false; startNewChat(); showToast(action.charAt(0).toUpperCase() + action.slice(1) + ' ready — type your request', 'info'); }
                closeSidebar();
            });
        });

        // Tip cards
        var tipCards = $$('.nexvora-tip-card');
        tipCards.forEach(function (card) {
            card.addEventListener('click', function () {
                var tip = this.dataset.tip;
                if (tip === 'chat') { navigateTo('chat'); }
                else if (tip === 'models') { handleAccountAction('models'); }
                else if (tip === 'projects') { showProjectModal(); }
                else if (tip === 'prompts') { navigateTo('prompts'); }
                closeSidebar();
            });
        });

        // Admin cards
        var adminCards = $$('.nexvora-admin-card button[data-admin]');
        adminCards.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var section = this.dataset.admin;
                if (section === 'models') { handleAccountAction('models'); }
            });
        });

        // Test connection button in model bar
        var testConnBtn = $('#nexvoraTestConnection');
        if (testConnBtn) {
            testConnBtn.addEventListener('click', function () {
                if (typeof NexvoraAIService === 'undefined') { showToast('Service layer not loaded', 'error'); return; }
                showToast('Testing connection...', 'info');
                NexvoraAIService.checkConnection().then(function (status) {
                    updateConnectionStatus();
                    renderDashboard();
                    if (status.status === 'connected') {
                        showToast('Connected! Latency: ' + (status.latency || '?') + 'ms', 'success');
                    } else {
                        showToast('Not connected: ' + (status.lastError || 'No API URL configured'), 'error');
                    }
                });
            });
        }

        // Context menu
        document.addEventListener('contextmenu', function (e) {
            var chatItem = e.target.closest('.nexvora-chat-item');
            if (chatItem) {
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY, chatItem.dataset.id);
            }
        });

        // File upload in files view
        var uploadBtn = $('#nexvoraUploadFile');
        if (uploadBtn) uploadBtn.addEventListener('click', function () {
            var input = document.createElement('input');
            input.type = 'file'; input.multiple = true;
            input.onchange = function (e) {
                Array.from(e.target.files).forEach(function (file) {
                    var files = getAllFiles();
                    files.push({
                        id: 'file-' + Date.now() + '-' + Math.random().toString(36).slice(2, 4),
                        name: file.name, size: file.size, type: file.type, addedAt: Date.now()
                    });
                    saveFiles(files);
                });
                renderFiles(); renderDashboard(); showToast('Files uploaded', 'success');
            };
            input.click();
        });
    }

    // --- Navigation ---
    function navigateTo(nav) {
        // Admin-only views require admin access
        if (nav === 'models' || nav === 'admin') {
            if (!isAdmin()) {
                showToast('Access denied. Admin privileges required.', 'error');
                return;
            }
        }

        var viewMap = {
            dashboard: 'nexvoraDashboardView',
            chat: 'nexvoraChatView',
            tools: 'nexvoraToolsView',
            prompts: 'nexvoraPromptsView',
            favorites: 'nexvoraFavoritesView',
            library: 'nexvoraLibraryView',
            files: 'nexvoraFilesView',
            settings: 'nexvoraSettingsView',
            models: 'nexvoraModelsView',
            help: 'nexvoraHelpView',
            admin: 'nexvoraAdminView'
        };
        $$('.nexvora-view').forEach(function (v) { v.classList.remove('nexvora-active'); });
        var viewId = viewMap[nav];
        if (viewId) {
            var el = document.getElementById(viewId);
            if (el) el.classList.add('nexvora-active');
        }
        updateNavActive(nav === 'nexvoraHelpView' || nav === 'nexvoraAdminView' || nav === 'nexvoraSettingsView' || nav === 'nexvoraModelsView' || nav === 'nexvoraFilesView' ? 'chat' : nav);
        // Refresh data for specific views
        if (nav === 'dashboard') renderDashboard();
        if (nav === 'favorites') renderFavorites();
        if (nav === 'library') renderLibrary();
        if (nav === 'prompts') renderPrompts();
        if (nav === 'models') renderModelManagerCards();
    }

    function showView(name) { navigateTo(name); }

    // --- Sidebar ---
    function toggleSidebar() {
        var sidebar = $('#nexvoraSidebar');
        var overlay = $('#nexvoraSidebarOverlay');
        if (sidebar) sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open');
    }
    function closeSidebar() {
        var sidebar = $('#nexvoraSidebar');
        var overlay = $('#nexvoraSidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }
    function toggleSidebarCollapse() {
        var sidebar = $('#nexvoraSidebar');
        if (!sidebar) return;
        var isCollapsed = sidebar.dataset.collapsed === 'true';
        sidebar.dataset.collapsed = isCollapsed ? 'false' : 'true';
        lsSet(SK.SIDEBAR_STATE, sidebar.dataset.collapsed);
    }
    function restoreSidebarState() {
        var sidebar = $('#nexvoraSidebar');
        if (!sidebar) return;
        var collapsed = lsGet(SK.SIDEBAR_STATE);
        sidebar.dataset.collapsed = collapsed === 'true' ? 'true' : 'false';
    }
    function updateNavActive(nav) {
        $$('.nexvora-nav-item').forEach(function (item) {
            item.classList.toggle('active', item.dataset.nav === nav);
        });
    }

    // --- Account Actions ---
    function handleAccountAction(action) {
        // Admin-only actions
        if (action === 'models' || action === 'admin') {
            if (!isAdmin()) {
                showToast('Access denied. Admin privileges required.', 'error');
                closeSidebar();
                return;
            }
        }

        switch (action) {
            case 'account':
            case 'settings':
                navigateTo('settings'); closeSidebar(); break;
            case 'models':
                navigateTo('models'); closeSidebar(); break;
            case 'shortcuts':
                showShortcutsModal(); break;
            case 'help':
                navigateTo('help'); closeSidebar(); break;
            case 'admin':
                navigateTo('admin'); closeSidebar(); break;
            case 'signout':
                Auth.logout(); break;
        }
    }

    // --- Dashboard ---
    function renderDashboard() {
        // Greeting
        var hour = new Date().getHours();
        var greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        var user = typeof Auth !== 'undefined' && Auth.currentUser();
        var name = user ? (user.name || '').split(' ')[0] : '';
        if ($('#nexvoraDashGreeting')) $('#nexvoraDashGreeting').textContent = greeting + (name ? ', ' + name : '');

        // Date
        if ($('#nexvoraDashDate')) {
            $('#nexvoraDashDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }

        // Stats
        var chats = getAllChats();
        var totalMessages = 0;
        chats.forEach(function (c) { totalMessages += (c.messages || []).length; });
        if ($('#nexvoraStatChats')) $('#nexvoraStatChats').textContent = chats.length;
        if ($('#nexvoraStatMessages')) $('#nexvoraStatMessages').textContent = totalMessages;
        if ($('#nexvoraStatProjects')) $('#nexvoraStatProjects').textContent = getAllProjects().length;
        if ($('#nexvoraStatFiles')) $('#nexvoraStatFiles').textContent = getAllFiles().length;

        // Recent Activity
        var actList = $('#nexvoraActivityList');
        if (actList) {
            var recent = chats.slice(0, 5);
            if (recent.length === 0) {
                actList.innerHTML = '<div class="nexvora-empty-state-sm"><i class="fa-solid fa-inbox"></i><p>No recent activity</p></div>';
            } else {
                actList.innerHTML = '';
                recent.forEach(function (c) {
                    var div = document.createElement('div');
                    div.className = 'nexvora-activity-item';
                    div.innerHTML = '<i class="fa-solid fa-message"></i><span>' + escapeHtml(truncate(c.title, 35)) + '</span><small>' + timeAgo(c.updatedAt) + '</small>';
                    div.addEventListener('click', function () { openChat(c.id); navigateTo('chat'); });
                    actList.appendChild(div);
                });
            }
        }

        // Model Status
        var modelStatus = $('#nexvoraModelStatus');
        if (modelStatus) {
            var serviceStatus = (typeof NexvoraAIService !== 'undefined') ? NexvoraAIService.getModelStatus() : null;
            var models = NexvoraModelManager.getAllModels();
            modelStatus.innerHTML = '';

            // Show active model connection status at top
            if (serviceStatus) {
                var statusDiv = document.createElement('div');
                statusDiv.className = 'nexvora-model-status-item nexvora-model-status-active';
                var statusClass = serviceStatus.connected ? 'online' : (serviceStatus.status === 'error' ? 'error' : 'offline');
                statusDiv.innerHTML = '<div class="nexvora-model-status-dot ' + statusClass + '"></div>' +
                    '<span>' + escapeHtml(serviceStatus.label) + '</span>' +
                    '<small>' + escapeHtml(serviceStatus.detail) + '</small>';
                modelStatus.appendChild(statusDiv);
            }

            if (models.length === 0) {
                var emptyDiv = document.createElement('div');
                emptyDiv.className = 'nexvora-empty-state-sm';
                emptyDiv.innerHTML = '<i class="fa-solid fa-microchip"></i><p>No models configured</p>';
                modelStatus.appendChild(emptyDiv);
            } else {
                models.forEach(function (m) {
                    var div = document.createElement('div');
                    div.className = 'nexvora-model-status-item';
                    var dotClass = m.enabled ? 'online' : 'offline';
                    if (serviceStatus && serviceStatus.status === 'error') dotClass = 'error';
                    div.innerHTML = '<div class="nexvora-model-status-dot ' + dotClass + '"></div><span>' + escapeHtml(m.name) + '</span><small>' + escapeHtml(m.provider || 'Custom') + '</small>';
                    modelStatus.appendChild(div);
                });
            }
        }
    }

    // --- Prompts ---
    function renderPrompts(filter, category) {
        var grid = $('#nexvoraPromptsGrid');
        if (!grid) return;
        var prompts = getAllPrompts();
        var activeCat = category || 'all';
        if (!category) {
            var activeCatBtn = $('.nexvora-cat-btn.active');
            if (activeCatBtn) activeCat = activeCatBtn.dataset.cat;
        }
        if (activeCat !== 'all') {
            prompts = prompts.filter(function (p) { return p.category === activeCat; });
        }
        if (filter) {
            var f = filter.toLowerCase();
            prompts = prompts.filter(function (p) {
                return (p.title || '').toLowerCase().includes(f) || (p.description || '').toLowerCase().includes(f) || (p.content || '').toLowerCase().includes(f);
            });
        }
        grid.innerHTML = '';
        if (prompts.length === 0) {
            grid.innerHTML = '<div class="nexvora-empty-state"><i class="fa-solid fa-wand-sparkles"></i><p>No prompts found. Create your first custom prompt!</p></div>';
            return;
        }
        prompts.forEach(function (p) {
            var card = document.createElement('div');
            card.className = 'nexvora-prompt-card';
            card.innerHTML = '<div class="nexvora-prompt-card-header">' +
                '<span class="nexvora-prompt-card-title">' + escapeHtml(p.title) + '</span>' +
                '<span class="nexvora-prompt-card-cat">' + escapeHtml(p.category) + '</span></div>' +
                (p.description ? '<div class="nexvora-prompt-card-desc">' + escapeHtml(p.description) + '</div>' : '') +
                '<div class="nexvora-prompt-card-preview">' + escapeHtml(truncate(p.content, 100)) + '</div>' +
                '<div class="nexvora-prompt-card-actions">' +
                '<button class="nexvora-prompt-use" data-id="' + p.id + '"><i class="fa-solid fa-play"></i> Use</button>' +
                (p.isDefault ? '' : '<button class="nexvora-prompt-delete" data-id="' + p.id + '"><i class="fa-solid fa-trash"></i></button>') +
                '</div>';
            card.querySelector('.nexvora-prompt-use').addEventListener('click', function (e) {
                e.stopPropagation();
                var prompt = getAllPrompts().find(function (pr) { return pr.id === p.id; });
                if (prompt) {
                    navigateTo('chat');
                    var input = $('#nexvoraInput');
                    if (input) { input.value = prompt.content.replace('{input}', ''); input.dispatchEvent(new Event('input')); input.focus(); }
                }
            });
            var delBtn = card.querySelector('.nexvora-prompt-delete');
            if (delBtn) {
                delBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (confirm('Delete this prompt?')) { deletePrompt(p.id); renderPrompts(); showToast('Prompt deleted', 'success'); }
                });
            }
            grid.appendChild(card);
        });
    }

    function showPromptModal() {
        var modal = $('#nexvoraPromptModal');
        if (modal) { modal.classList.remove('nexvora-hidden'); ($('#nexvoraPromptForm')).reset(); }
    }
    function hidePromptModal() {
        var modal = $('#nexvoraPromptModal');
        if (modal) modal.classList.add('nexvora-hidden');
    }

    // --- Favorites ---
    function renderFavorites() {
        var grid = $('#nexvoraFavoritesGrid');
        if (!grid) return;
        var favs = getAllFavorites();
        if (favs.length === 0) {
            grid.innerHTML = '<div class="nexvora-empty-state"><i class="fa-solid fa-star"></i><p>No favorite items yet. Star messages to save them here.</p></div>';
            return;
        }
        grid.innerHTML = '';
        favs.forEach(function (fav) {
            var card = document.createElement('div');
            card.className = 'nexvora-file-card';
            var icon = fav.type === 'chat' ? 'fa-message' : fav.type === 'message' ? 'fa-comment' : 'fa-bookmark';
            card.innerHTML = '<i class="fa-solid ' + icon + ' nexvora-file-icon"></i>' +
                '<div class="nexvora-file-name">' + escapeHtml(truncate(fav.title, 40)) + '</div>' +
                '<div class="nexvora-file-meta">' + escapeHtml(truncate(fav.content, 60)) + '</div>';
            card.addEventListener('click', function () {
                if (fav.type === 'chat' && fav.sourceId) {
                    openChat(fav.sourceId); navigateTo('chat');
                }
            });
            grid.appendChild(card);
        });
    }

    // --- Global Search ---
    function showSearchModal() {
        var modal = $('#nexvoraSearchModal');
        if (modal) {
            modal.classList.remove('nexvora-hidden');
            var input = $('#nexvoraGlobalSearch');
            if (input) { input.value = ''; input.focus(); }
            var results = $('#nexvoraSearchResults');
            if (results) results.innerHTML = '<div class="nexvora-search-empty">Type to search across all your content</div>';
        }
    }
    function hideSearchModal() {
        var modal = $('#nexvoraSearchModal');
        if (modal) modal.classList.add('nexvora-hidden');
    }

    function performGlobalSearch(query) {
        var results = $('#nexvoraSearchResults');
        if (!results) return;
        if (!query || query.length < 2) {
            results.innerHTML = '<div class="nexvora-search-empty">Type to search across all your content</div>';
            return;
        }
        var q = query.toLowerCase();
        var html = '';

        // Search chats
        var chats = getAllChats().filter(function (c) {
            return (c.title || '').toLowerCase().includes(q);
        }).slice(0, 5);
        if (chats.length > 0) {
            html += '<div class="nexvora-search-group-label">Chats</div>';
            chats.forEach(function (c) {
                html += '<div class="nexvora-search-item" data-type="chat" data-id="' + c.id + '"><i class="fa-solid fa-message"></i><span>' + escapeHtml(truncate(c.title, 40)) + '</span><small>' + timeAgo(c.updatedAt) + '</small></div>';
            });
        }

        // Search projects
        var projects = getAllProjects().filter(function (p) {
            return (p.name || '').toLowerCase().includes(q);
        }).slice(0, 3);
        if (projects.length > 0) {
            html += '<div class="nexvora-search-group-label">Projects</div>';
            projects.forEach(function (p) {
                html += '<div class="nexvora-search-item" data-type="project" data-id="' + p.id + '"><i class="fa-solid fa-folder"></i><span>' + escapeHtml(p.name) + '</span></div>';
            });
        }

        // Search prompts
        var prompts = getAllPrompts().filter(function (p) {
            return (p.title || '').toLowerCase().includes(q) || (p.content || '').toLowerCase().includes(q);
        }).slice(0, 3);
        if (prompts.length > 0) {
            html += '<div class="nexvora-search-group-label">Prompts</div>';
            prompts.forEach(function (p) {
                html += '<div class="nexvora-search-item" data-type="prompt" data-id="' + p.id + '"><i class="fa-solid fa-wand-sparkles"></i><span>' + escapeHtml(p.title) + '</span><small>' + escapeHtml(p.category) + '</small></div>';
            });
        }

        // Search library
        var lib = getAllLibrary().filter(function (l) {
            return (l.title || '').toLowerCase().includes(q) || (l.content || '').toLowerCase().includes(q);
        }).slice(0, 3);
        if (lib.length > 0) {
            html += '<div class="nexvora-search-group-label">Library</div>';
            lib.forEach(function (l) {
                html += '<div class="nexvora-search-item" data-type="library" data-id="' + l.id + '"><i class="fa-solid fa-bookmark"></i><span>' + escapeHtml(truncate(l.title, 40)) + '</span></div>';
            });
        }

        // Search files
        var files = getAllFiles().filter(function (f) {
            return (f.name || '').toLowerCase().includes(q);
        }).slice(0, 3);
        if (files.length > 0) {
            html += '<div class="nexvora-search-group-label">Files</div>';
            files.forEach(function (f) {
                html += '<div class="nexvora-search-item" data-type="file" data-id="' + f.id + '"><i class="fa-solid fa-file"></i><span>' + escapeHtml(f.name) + '</span><small>' + formatSize(f.size) + '</small></div>';
            });
        }

        if (!html) {
            html = '<div class="nexvora-search-empty">No results found for "' + escapeHtml(query) + '"</div>';
        }

        results.innerHTML = html;

        // Click handlers for search results
        results.querySelectorAll('.nexvora-search-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var type = this.dataset.type;
                var id = this.dataset.id;
                hideSearchModal();
                if (type === 'chat') { openChat(id); navigateTo('chat'); }
                else if (type === 'prompt') { navigateTo('prompts'); }
                else if (type === 'project') { navigateTo('chat'); }
                else if (type === 'library') { navigateTo('library'); }
                else if (type === 'file') { navigateTo('files'); }
            });
        });
    }

    // --- Shortcuts Modal ---
    function showShortcutsModal() {
        var modal = $('#nexvoraShortcutsModal');
        if (modal) modal.classList.remove('nexvora-hidden');
    }
    function hideShortcutsModal() {
        var modal = $('#nexvoraShortcutsModal');
        if (modal) modal.classList.add('nexvora-hidden');
    }

    function closeAllModals() {
        hideSearchModal();
        hideShortcutsModal();
        hidePromptModal();
        hideModelModal();
        hideProjectModal();
    }

    // --- Library ---
    function renderLibrary() {
        var grid = $('#nexvoraLibraryGrid');
        if (!grid) return;
        var items = getAllLibrary();
        if (items.length === 0) {
            grid.innerHTML = '<div class="nexvora-empty-state"><i class="fa-solid fa-bookmark"></i><p>No saved items yet. Bookmark useful AI outputs to find them later.</p></div>';
            return;
        }
        grid.innerHTML = '';
        items.forEach(function (item) {
            var card = document.createElement('div');
            card.className = 'nexvora-file-card';
            card.innerHTML = '<i class="fa-solid fa-bookmark nexvora-file-icon"></i>' +
                '<div class="nexvora-file-name">' + escapeHtml(truncate(item.title, 40)) + '</div>' +
                '<div class="nexvora-file-meta">' + escapeHtml(truncate(item.content, 60)) + '</div>';
            card.addEventListener('click', function () {
                var input = $('#nexvoraInput');
                if (input) { input.value = item.content; input.dispatchEvent(new Event('input')); }
                navigateTo('chat');
            });
            grid.appendChild(card);
        });
    }

    // --- Model Selector ---
    function renderModelSelector() {
        var models = NexvoraModelManager.getEnabledModels();
        var active = NexvoraModelManager.getActiveModel();
        var label = $('#nexvoraCurrentModel');
        var dropdown = $('#nexvoraModelDropdown');
        if (label) label.textContent = active ? active.name : 'No Model';
        if (!dropdown) return;
        dropdown.innerHTML = '';
        if (models.length === 0) {
            dropdown.innerHTML = '<div style="padding:12px 14px;color:var(--nv-text-muted);font-size:13px;">No models configured. Add one in Model Manager.</div>';
            return;
        }
        models.forEach(function (m) {
            var isActive = active && m.id === active.id;
            var opt = document.createElement('div');
            opt.className = 'nexvora-model-option' + (isActive ? ' active' : '');
            opt.innerHTML = '<i class="fa-solid fa-microchip"></i>' +
                '<div class="nexvora-model-option-info"><div class="nexvora-model-option-name">' + escapeHtml(m.name) + '</div>' +
                '<div class="nexvora-model-option-provider">' + escapeHtml(m.provider || 'Custom') + '</div></div>' +
                '<i class="fa-solid fa-check nexvora-model-check"></i>';
            opt.addEventListener('click', function (e) {
                e.stopPropagation(); NexvoraModelManager.setActiveModel(m.id);
                renderModelSelector(); dropdown.classList.remove('open');
            });
            dropdown.appendChild(opt);
        });
    }

    // --- Chat List ---
    function renderChatList(filter) {
        var list = $('#nexvoraChatList');
        if (!list) return;
        var chats = getAllChats().filter(function (c) { return !c.archived; });
        if (filter) {
            var f = filter.toLowerCase();
            chats = chats.filter(function (c) { return (c.title || '').toLowerCase().includes(f); });
        }
        // Sort: pinned first, then by updatedAt
        chats.sort(function (a, b) {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        list.innerHTML = '';
        if (chats.length === 0) {
            list.innerHTML = '<div class="nexvora-empty-chats">No conversations yet</div>';
            return;
        }
        var groups = groupChatsByDate(chats);
        var groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days', 'Older'];
        groupOrder.forEach(function (label) {
            var items = groups[label];
            if (!items || items.length === 0) return;
            var groupEl = document.createElement('div');
            groupEl.className = 'nexvora-date-group';
            groupEl.textContent = label;
            list.appendChild(groupEl);
            items.forEach(function (chat) {
                var item = document.createElement('div');
                item.className = 'nexvora-chat-item' + (chat.id === currentChatId ? ' active' : '');
                item.dataset.id = chat.id;
                item.dataset.tooltip = escapeHtml(truncate(chat.title, 30));
                var indicators = '';
                if (chat.pinned) indicators += '<i class="fa-solid fa-thumbtack nexvora-chat-pin"></i> ';
                if (chat.favorite) indicators += '<i class="fa-solid fa-star nexvora-chat-star"></i> ';
                item.innerHTML = '<i class="fa-solid fa-message"></i>' +
                    '<span>' + indicators + escapeHtml(truncate(chat.title, 40)) + '</span>' +
                    '<div class="nexvora-chat-item-menu">' +
                    '<button class="nexvora-chat-item-dots" title="More options"><i class="fa-solid fa-ellipsis"></i></button></div>';
                item.addEventListener('click', function (e) {
                    if (e.target.closest('.nexvora-chat-item-dots')) return;
                    openChat(chat.id); closeSidebar();
                });
                var dotsBtn = item.querySelector('.nexvora-chat-item-dots');
                if (dotsBtn) {
                    dotsBtn.addEventListener('click', function (e) {
                        e.stopPropagation(); showContextMenu(e.clientX, e.clientY, chat.id);
                    });
                }
                list.appendChild(item);
            });
        });
    }

    function groupChatsByDate(chats) {
        var now = Date.now(); var day = 86400000;
        var groups = { 'Today': [], 'Yesterday': [], 'Previous 7 Days': [], 'Previous 30 Days': [], 'Older': [] };
        chats.forEach(function (chat) {
            var ts = chat.updatedAt || chat.createdAt || 0;
            var diff = now - ts;
            if (diff < day) groups['Today'].push(chat);
            else if (diff < 2 * day) groups['Yesterday'].push(chat);
            else if (diff < 7 * day) groups['Previous 7 Days'].push(chat);
            else if (diff < 30 * day) groups['Previous 30 Days'].push(chat);
            else groups['Older'].push(chat);
        });
        return groups;
    }

    // --- Projects ---
    function renderProjects() {
        var list = $('#nexvoraProjectsList');
        if (!list) return;
        var projects = getAllProjects();
        list.innerHTML = '';
        if (projects.length === 0) {
            list.innerHTML = '<div style="padding:4px 10px;color:var(--nv-text-muted);font-size:12px;">No projects yet</div>';
            return;
        }
        projects.forEach(function (proj) {
            var chatCount = getAllChats().filter(function (c) { return c.projectId === proj.id; }).length;
            var item = document.createElement('div');
            item.className = 'nexvora-chat-item';
            item.innerHTML = '<i class="fa-solid fa-folder"></i><span>' + escapeHtml(proj.name) + (chatCount > 0 ? ' <small style="color:var(--nv-text-muted);font-size:10px">(' + chatCount + ')</small>' : '') + '</span>';
            item.addEventListener('click', function () {
                startNewChat(null, proj.id); closeSidebar();
            });
            list.appendChild(item);
        });
    }

    // --- Files ---
    function renderFiles() {
        var grid = $('#nexvoraFilesGrid');
        if (!grid) return;
        var files = getAllFiles();
        if (files.length === 0) {
            grid.innerHTML = '<div class="nexvora-empty-state"><i class="fa-solid fa-folder-open"></i><p>No files yet. Upload files to attach them to conversations.</p></div>';
            return;
        }
        grid.innerHTML = '';
        files.forEach(function (file) {
            var icons = { 'application/pdf': 'fa-file-pdf', 'image/': 'fa-file-image', 'text/': 'fa-file-lines', 'audio/': 'fa-file-audio', 'video/': 'fa-file-video' };
            var icon = 'fa-file';
            for (var key in icons) { if (file.type && file.type.startsWith(key)) { icon = icons[key]; break; } }
            var card = document.createElement('div');
            card.className = 'nexvora-file-card';
            card.innerHTML = '<i class="fa-solid ' + icon + ' nexvora-file-icon"></i>' +
                '<div class="nexvora-file-name">' + escapeHtml(file.name) + '</div>' +
                '<div class="nexvora-file-meta">' + formatSize(file.size) + '</div>';
            grid.appendChild(card);
        });
    }

    function formatSize(bytes) {
        if (!bytes) return '0 B';
        var units = ['B', 'KB', 'MB', 'GB']; var i = 0;
        while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
        return bytes.toFixed(i ? 1 : 0) + ' ' + units[i];
    }

    // --- Chat Operations ---
    function startNewChat(title, projectId) {
        var chat = createChat(title || 'New Chat', projectId);
        currentChatId = chat.id;
        lsSet(SK.ACTIVE_CHAT, chat.id);
        renderChatList(); showWelcome();
        navigateTo('chat');
        var input = $('#nexvoraInput');
        if (input) {
            input.value = '';
            input.placeholder = translationMode ? 'Enter Tamil text to translate...' : 'Message Nexvora AI...';
            input.focus();
        }
    }

    function openChat(chatId) {
        var chat = getChat(chatId);
        if (!chat) return;
        currentChatId = chatId;
        lsSet(SK.ACTIVE_CHAT, chatId);
        renderChatList();
        renderMessages(chat);
        navigateTo('chat');
    }

    function showWelcome() {
        var welcome = $('#nexvoraWelcome');
        var messages = $('#nexvoraMessages');
        if (welcome) welcome.classList.remove('nexvora-hidden');
        if (messages) messages.innerHTML = '';
    }

    function hideWelcome() {
        var welcome = $('#nexvoraWelcome');
        if (welcome) welcome.classList.add('nexvora-hidden');
    }

    // --- Messages Rendering ---
    function renderMessages(chat) {
        hideWelcome();
        var container = $('#nexvoraMessages');
        if (!container) return;
        container.innerHTML = '';
        if (!chat.messages || chat.messages.length === 0) { showWelcome(); return; }
        chat.messages.forEach(function (msg) { appendMessageToDOM(msg); });
        scrollToBottom();
    }

    function appendMessageToDOM(msg) {
        var container = $('#nexvoraMessages');
        if (!container) return;
        hideWelcome();
        var div = document.createElement('div');
        div.className = 'nexvora-message ' + msg.role;
        div.dataset.id = msg.id || '';
        var avatar = msg.role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-bolt"></i>';
        var sender = msg.role === 'user' ? 'You' : 'Nexvora AI';
        var modelTag = msg.model ? '<span class="nexvora-message-model">' + escapeHtml(msg.model) + '</span>' : '';
        var content = settings.markdownEnabled && msg.role === 'assistant'
            ? renderMarkdown(msg.content)
            : '<p>' + escapeHtml(msg.content).replace(/\n/g, '<br>') + '</p>';

        div.innerHTML = '<div class="nexvora-message-avatar">' + avatar + '</div>' +
            '<div class="nexvora-message-body"><div class="nexvora-message-header">' +
            '<span class="nexvora-message-sender">' + sender + '</span>' +
            '<span class="nexvora-message-time">' + (msg.timestamp ? timeAgo(msg.timestamp) : '') + '</span>' + modelTag +
            '</div><div class="nexvora-message-content">' + content + '</div>' +
            '<div class="nexvora-message-actions">' +
            '<button class="nexvora-msg-action" data-action="copy"><i class="fa-regular fa-copy"></i> Copy</button>' +
            '<button class="nexvora-msg-action" data-action="favorite-msg"><i class="fa-solid fa-star"></i></button>' +
            (msg.role === 'assistant' ? '<button class="nexvora-msg-action" data-action="regenerate"><i class="fa-solid fa-rotate"></i> Regenerate</button>' : '') +
            (msg.role === 'user' ? '<button class="nexvora-msg-action" data-action="edit"><i class="fa-regular fa-pen-to-square"></i> Edit</button>' : '') +
            '<button class="nexvora-msg-action" data-action="delete-msg"><i class="fa-solid fa-trash"></i></button>' +
            '</div></div>';

        div.querySelectorAll('.nexvora-msg-action').forEach(function (btn) {
            btn.addEventListener('click', function () { handleMessageAction(this.dataset.action, msg, div); });
        });

        div.querySelectorAll('pre').forEach(function (pre) {
            var code = pre.querySelector('code');
            if (!code) return;
            var lang = (code.className.match(/language-(\w+)/) || [])[1] || '';
            var header = document.createElement('div');
            header.className = 'nexvora-code-header';
            header.innerHTML = '<span>' + (lang || 'code') + '</span><button class="nexvora-copy-code"><i class="fa-regular fa-copy"></i> Copy</button>';
            pre.insertBefore(header, code);
            header.querySelector('.nexvora-copy-code').addEventListener('click', function () {
                navigator.clipboard.writeText(code.textContent).then(function () { showToast('Code copied', 'success'); });
            });
        });
        container.appendChild(div);
    }

    function renderMarkdown(text) {
        if (!text) return '';
        var html = escapeHtml(text);
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (match, lang, code) {
            return '<pre><code class="language-' + lang + '">' + code.trim() + '</code></pre>';
        });
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/^---$/gm, '<hr>');
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        html = html.replace(/\n/g, '<br>');
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p>(<h[1-4]>)/g, '$1');
        html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<pre>)/g, '$1');
        html = html.replace(/(<\/pre>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)<\/p>/g, '$1');
        html = html.replace(/<p>(<blockquote>)/g, '$1');
        html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
        html = html.replace(/<p>(<hr>)/g, '$1');
        html = html.replace(/(<hr>)<\/p>/g, '$1');
        return html;
    }

    // --- Message Actions ---
    function handleMessageAction(action, msg, el) {
        switch (action) {
            case 'copy':
                navigator.clipboard.writeText(msg.content).then(function () {
                    var btn = el.querySelector('[data-action="copy"]');
                    btn.classList.add('copied'); btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
                    setTimeout(function () { btn.classList.remove('copied'); btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy'; }, 2000);
                });
                break;
            case 'regenerate': regenerateMessage(msg); break;
            case 'edit': editMessage(msg); break;
            case 'delete-msg': deleteMessage(msg); break;
            case 'favorite-msg':
                addToFavorites({ sourceId: msg.id, title: truncate(msg.content, 40), content: msg.content, type: 'message' });
                showToast('Added to favorites', 'success');
                renderFavorites();
                break;
        }
    }

    function editMessage(msg) {
        var newContent = prompt('Edit message:', msg.content);
        if (newContent && newContent.trim() && newContent !== msg.content) {
            var chat = getChat(currentChatId);
            if (!chat) return;
            var idx = chat.messages.findIndex(function (m) { return m.id === msg.id; });
            if (idx >= 0) {
                chat.messages[idx].content = newContent.trim();
                chat.messages = chat.messages.slice(0, idx + 1);
                updateChat(currentChatId, { messages: chat.messages });
                renderMessages(chat);
            }
        }
    }

    function deleteMessage(msg) {
        var chat = getChat(currentChatId);
        if (!chat) return;
        chat.messages = chat.messages.filter(function (m) { return m.id !== msg.id; });
        updateChat(currentChatId, { messages: chat.messages });
        renderMessages(chat);
    }

    function regenerateMessage(msg) {
        var chat = getChat(currentChatId);
        if (!chat) return;
        var idx = chat.messages.findIndex(function (m) { return m.id === msg.id; });
        if (idx > 0) {
            var userMsg = chat.messages[idx - 1];
            chat.messages = chat.messages.slice(0, idx);
            updateChat(currentChatId, { messages: chat.messages });
            renderMessages(chat);
            generateResponse(chat, userMsg.content);
        }
    }

    // --- Send Message ---
    function sendMessage() {
        var input = $('#nexvoraInput');
        if (!input) return;
        var text = input.value.trim();
        if (!text || isGenerating) return;

        if (!currentChatId) {
            var chat = createChat(truncate(text, 50));
            currentChatId = chat.id;
            lsSet(SK.ACTIVE_CHAT, chat.id);
            renderChatList();
        }

        var userMsg = { id: 'msg-' + Date.now(), role: 'user', content: text, timestamp: Date.now() };
        var chat = getChat(currentChatId);
        if (!chat) return;
        chat.messages.push(userMsg);
        updateChat(currentChatId, { messages: chat.messages, title: chat.messages.length === 1 ? truncate(text, 50) : chat.title });
        appendMessageToDOM(userMsg);
        input.value = ''; autoResize(input);
        var sendBtn = $('#nexvoraSendBtn');
        if (sendBtn) sendBtn.disabled = true;
        scrollToBottom();
        generateResponse(chat, text);
    }

    function generateResponse(chat, userText) {
        isGenerating = true; showLoading(true);
        var thinkingEl = null;

        function finishSuccess(assistantMsg) {
            try {
                isGenerating = false; showLoading(false); removeThinkingMessage();
                chat.messages.push(assistantMsg);
                updateChat(chat.id, { messages: chat.messages });
                appendMessageToDOM(assistantMsg);
                scrollToBottom();
                renderDashboard();
                updateConnectionStatus();
            } catch (e) {
                isGenerating = false; showLoading(false); removeThinkingMessage();
            }
        }

        function finishError(err, prefix) {
            try {
                isGenerating = false; showLoading(false); removeThinkingMessage();
                var errorContent = getNotConnectedMessage(err);
                var errorMsg = { id: 'msg-' + Date.now(), role: 'assistant', content: errorContent, model: '', timestamp: Date.now() };
                chat.messages.push(errorMsg);
                updateChat(chat.id, { messages: chat.messages });
                appendMessageToDOM(errorMsg);
                scrollToBottom();
                showToast(err.message || (prefix || 'Error'), 'error');
                updateConnectionStatus();
            } catch (e) {
                isGenerating = false; showLoading(false); removeThinkingMessage();
            }
        }

        // Translation mode: use the translation service directly
        if (translationMode && typeof NexvoraAIService !== 'undefined') {
            thinkingEl = showThinkingMessage();
            NexvoraAIService.translateText(userText, 'en', 'ta')
                .then(function (result) {
                    finishSuccess({
                        id: 'msg-' + Date.now(),
                        role: 'assistant',
                        content: '**Translation:**\n\n' + result.content +
                            (result.source ? '\n\n**Original:** ' + result.source : ''),
                        model: result.model || 'TamilAI Translator',
                        timestamp: Date.now()
                    });
                })
                .catch(function (err) { finishError(err, 'Translation error'); });
            return;
        }

        // Standard chat mode
        // Validate via service layer before attempting
        if (typeof NexvoraAIService !== 'undefined') {
            var validation = NexvoraAIService.validateModel('chat');
            if (!validation.valid) {
                finishError(validation.error);
                return;
            }
        }

        var messages = chat.messages.map(function (m) { return { role: m.role, content: m.content }; });

        thinkingEl = showThinkingMessage();
        NexvoraModelManager.sendRequest(messages, { temperature: 0.7 })
            .then(function (response) {
                finishSuccess({ id: 'msg-' + Date.now(), role: 'assistant', content: response.content, model: response.model, timestamp: Date.now() });
            })
            .catch(function (err) { finishError(err, 'Connection error'); });
    }

    // Build user-friendly "not connected" messages
    function getNotConnectedMessage(err) {
        var code = err.code || '';
        var base = '**AI Model Not Connected**\n\n';
        switch (code) {
            case 'NO_MODEL':
                return base + 'No AI model is configured yet.\n\n' +
                    '**To get started:**\n' +
                    '1. Go to **Settings > Model Manager**\n' +
                    '2. Click **Add Model**\n' +
                    '3. Enter your API endpoint and model details\n' +
                    '4. The model will appear in the selector above';
            case 'NO_ENDPOINT':
            case 'NO_API_CONFIG':
                return base + 'The active model has no API endpoint configured.\n\n' +
                    '**To fix:**\n' +
                    '1. Go to **Settings > Model Manager**\n' +
                    '2. Edit your model and add the API endpoint URL\n' +
                    '3. For Ubuntu-hosted FastAPI: `http://your-server:8000/v1/chat/completions`';
            case 'MODEL_DISABLED':
                return base + 'The active model is currently disabled.\n\n' +
                    '**To fix:** Go to **Model Manager** and enable the model.';
            case 'TIMEOUT':
                return base + 'The request timed out. This usually means:\n' +
                    '- The API server is not running\n' +
                    '- The network connection is slow\n' +
                    '- The server is taking too long to respond\n\n' +
                    '**To fix:** Check that your API server is running and accessible.';
            case 'NETWORK_ERROR':
                return base + 'Could not reach the API server.\n\n' +
                    '**Possible causes:**\n' +
                    '- API server is not running\n' +
                    '- Incorrect API endpoint URL\n' +
                    '- CORS configuration issue\n' +
                    '- Network firewall blocking the request\n\n' +
                    '**To fix:** Verify your API endpoint is correct and the server is running.';
            case 'API_ERROR':
                var detail = err.detail || {};
                return base + 'API returned an error' + (detail.status ? ' (HTTP ' + detail.status + ')' : '') + '.\n\n' +
                    (detail.body ? '```\n' + detail.body.substring(0, 500) + '\n```\n\n' : '') +
                    '**To fix:** Check your API server logs for details.';
            default:
                return base + 'Error: ' + (err.message || 'Unknown error') + '\n\n' +
                    'Check that your model is properly configured in **Model Manager**.';
        }
    }

    function updateConnectionStatus() {
        if (typeof NexvoraAIService === 'undefined') return;
        var status = NexvoraAIService.getModelStatus();
        var el = $('#nexvoraConnectionStatus');
        if (el) {
            el.className = 'nexvora-connection-status ' + status.status;
            el.innerHTML = '<i class="fa-solid ' + status.icon + '"></i><span>' + escapeHtml(status.detail) + '</span>';
        }
    }

    function stopGeneration() { isGenerating = false; showLoading(false); removeThinkingMessage(); }
    function showLoading(show) {
        var el = $('#nexvoraLoading');
        if (el) { if (show) el.classList.remove('nexvora-hidden'); else el.classList.add('nexvora-hidden'); }
    }
    function showThinkingMessage() {
        var container = $('#nexvoraMessages');
        if (!container) return null;
        hideWelcome();
        var div = document.createElement('div');
        div.className = 'nexvora-message assistant nexvora-thinking-msg';
        div.id = 'nexvoraThinkingMsg';
        div.innerHTML = '<div class="nexvora-message-avatar"><i class="fa-solid fa-bolt"></i></div>' +
            '<div class="nexvora-message-body"><div class="nexvora-message-header">' +
            '<span class="nexvora-message-sender">Nexvora AI</span>' +
            '</div><div class="nexvora-message-content">' +
            '<div class="nexvora-thinking-dots"><span></span><span></span><span></span></div>' +
            '</div></div>';
        container.appendChild(div);
        scrollToBottom();
        return div;
    }
    function removeThinkingMessage() {
        var el = document.getElementById('nexvoraThinkingMsg');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    function scrollToBottom() {
        if (!settings.autoScroll) return;
        var area = $('#nexvoraChatArea');
        if (area) setTimeout(function () { area.scrollTop = area.scrollHeight; }, 50);
    }
    function autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    // --- File Attachment ---
    function handleFileAttachment(e) {
        var bar = $('#nexvoraAttachmentBar');
        if (!bar) return;
        var files = Array.from(e.target.files);
        if (files.length === 0) return;
        bar.classList.remove('nexvora-hidden'); bar.innerHTML = '';
        files.forEach(function (file) {
            var item = document.createElement('div');
            item.className = 'nexvora-attachment-item';
            item.innerHTML = '<i class="fa-solid fa-file"></i><span>' + escapeHtml(file.name) + '</span><button class="nexvora-attachment-remove"><i class="fa-solid fa-xmark"></i></button>';
            item.querySelector('.nexvora-attachment-remove').addEventListener('click', function () {
                item.remove(); if (bar.children.length === 0) bar.classList.add('nexvora-hidden');
            });
            bar.appendChild(item);
        });
        e.target.value = '';
    }

    // --- Voice Input ---
    function toggleVoiceInput() {
        var btn = $('#nexvoraVoiceBtn');
        if (!btn) return;
        if (isRecording) { stopVoiceInput(); return; }
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            showToast('Voice input not supported in this browser', 'error'); return;
        }
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = false; speechRecognition.interimResults = true;
        speechRecognition.lang = settings.language || 'en';
        speechRecognition.onstart = function () { isRecording = true; btn.classList.add('recording'); btn.querySelector('i').className = 'fa-solid fa-stop'; };
        speechRecognition.onresult = function (event) {
            var input = $('#nexvoraInput'); if (!input) return;
            var transcript = '';
            for (var i = event.resultIndex; i < event.results.length; i++) { transcript += event.results[i][0].transcript; }
            input.value = transcript; input.dispatchEvent(new Event('input'));
        };
        speechRecognition.onend = function () { stopVoiceInput(); };
        speechRecognition.onerror = function (e) { stopVoiceInput(); if (e.error !== 'no-speech') showToast('Voice error: ' + e.error, 'error'); };
        speechRecognition.start();
    }
    function stopVoiceInput() {
        isRecording = false;
        var btn = $('#nexvoraVoiceBtn');
        if (btn) { btn.classList.remove('recording'); btn.querySelector('i').className = 'fa-solid fa-microphone'; }
        if (speechRecognition) { try { speechRecognition.stop(); } catch (e) { /* ignore */ } }
    }

    // --- Context Menu ---
    function showContextMenu(x, y, chatId) {
        var menu = $('#nexvoraContextMenu');
        if (!menu) return;
        menu.classList.remove('nexvora-hidden');
        var menuW = 200, menuH = 280;
        var winW = window.innerWidth, winH = window.innerHeight;
        menu.style.left = Math.min(x, winW - menuW) + 'px';
        menu.style.top = Math.min(y, winH - menuH) + 'px';

        // Update pin/favorite labels based on chat state
        var chat = getChat(chatId);
        if (chat) {
            var pinItem = menu.querySelector('[data-action="pin"]');
            var favItem = menu.querySelector('[data-action="favorite"]');
            if (pinItem) pinItem.innerHTML = '<i class="fa-solid fa-thumbtack"></i> ' + (chat.pinned ? 'Unpin' : 'Pin');
            if (favItem) favItem.innerHTML = '<i class="fa-solid fa-star"></i> ' + (chat.favorite ? 'Unfavorite' : 'Favorite');
        }

        menu.querySelectorAll('.nexvora-ctx-item').forEach(function (item) {
            item.onclick = function () {
                var action = this.dataset.action;
                if (action === 'delete') {
                    if (confirm('Delete this conversation?')) deleteChat(chatId);
                }
                if (action === 'rename') {
                    var chat = getChat(chatId);
                    if (chat) {
                        var newTitle = prompt('Rename:', chat.title);
                        if (newTitle && newTitle.trim()) { updateChat(chatId, { title: newTitle.trim() }); renderChatList(); }
                    }
                }
                if (action === 'archive') {
                    updateChat(chatId, { archived: true }); renderChatList();
                    showToast('Conversation archived', 'success');
                }
                if (action === 'pin') {
                    var chat = getChat(chatId);
                    if (chat) { updateChat(chatId, { pinned: !chat.pinned }); renderChatList(); showToast(chat.pinned ? 'Unpinned' : 'Pinned', 'success'); }
                }
                if (action === 'favorite') {
                    var chat = getChat(chatId);
                    if (chat) {
                        if (chat.favorite) {
                            updateChat(chatId, { favorite: false });
                            showToast('Removed from favorites', 'success');
                        } else {
                            updateChat(chatId, { favorite: true });
                            addToFavorites({ sourceId: chatId, title: chat.title, content: (chat.messages[0] || {}).content || '', type: 'chat' });
                            showToast('Added to favorites', 'success');
                        }
                        renderChatList(); renderFavorites();
                    }
                }
                if (action === 'project') {
                    var projects = getAllProjects();
                    if (projects.length === 0) { showToast('Create a project first', 'info'); }
                    else {
                        var names = projects.map(function (p, i) { return (i + 1) + '. ' + p.name; }).join('\n');
                        var choice = prompt('Move to project (enter number):\n' + names);
                        if (choice) {
                            var idx = parseInt(choice, 10) - 1;
                            if (idx >= 0 && idx < projects.length) {
                                updateChat(chatId, { projectId: projects[idx].id }); renderChatList();
                                showToast('Moved to ' + projects[idx].name, 'success');
                            }
                        }
                    }
                }
                if (action === 'clear') {
                    if (confirm('Clear all messages in this chat?')) {
                        updateChat(chatId, { messages: [] });
                        if (currentChatId === chatId) showWelcome();
                        renderChatList(); showToast('Chat cleared', 'success');
                    }
                }
                if (action === 'export') {
                    exportSingleChat(chatId);
                }
                menu.classList.add('nexvora-hidden');
            };
        });
    }

    // --- Export ---
    function exportSingleChat(chatId) {
        var chat = getChat(chatId);
        if (!chat) return;
        var data = JSON.stringify(chat, null, 2);
        var blob = new Blob([data], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = (chat.title || 'chat') + '.json'; a.click();
        URL.revokeObjectURL(url);
        showToast('Chat exported', 'success');
    }

    // --- Model Manager ---
    var modelSearchQuery = '';
    var modelFilterProvider = '';
    var modelFilterStatus = '';

    function getModelStats() {
        var models = NexvoraModelManager.getAllModels();
        var enabled = models.filter(function (m) { return m.enabled; });
        var statuses = NexvoraModelManager.getConnectionStatus ? models.map(function (m) {
            return NexvoraModelManager.getConnectionStatus(m.id);
        }) : [];
        var connected = statuses.filter(function (s) { return s.status === 'connected'; }).length;
        return { total: models.length, active: enabled.length, connected: connected };
    }

    function populateProviderFilter() {
        var select = $('#nexvoraModelFilterProvider');
        if (!select) return;
        var models = NexvoraModelManager.getAllModels();
        var providers = {};
        models.forEach(function (m) { if (m.provider) providers[m.provider] = true; });
        var current = select.value;
        select.innerHTML = '<option value="">All Providers</option>';
        Object.keys(providers).sort().forEach(function (p) {
            var opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            select.appendChild(opt);
        });
        select.value = current;
    }

    function updateModelStats() {
        var stats = getModelStats();
        var totalEl = $('#nexvoraModelTotal');
        var activeEl = $('#nexvoraModelActive');
        var connectedEl = $('#nexvoraModelConnected');
        if (totalEl) totalEl.textContent = stats.total;
        if (activeEl) activeEl.textContent = stats.active;
        if (connectedEl) connectedEl.textContent = stats.connected;
    }

    function filterModels(models) {
        return models.filter(function (m) {
            if (modelSearchQuery) {
                var q = modelSearchQuery.toLowerCase();
                var matchName = (m.name || '').toLowerCase().indexOf(q) !== -1;
                var matchId = (m.modelId || m.id || '').toLowerCase().indexOf(q) !== -1;
                var matchProvider = (m.provider || '').toLowerCase().indexOf(q) !== -1;
                var matchEndpoint = (m.endpoint || '').toLowerCase().indexOf(q) !== -1;
                if (!matchName && !matchId && !matchProvider && !matchEndpoint) return false;
            }
            if (modelFilterProvider && m.provider !== modelFilterProvider) return false;
            if (modelFilterStatus === 'enabled' && !m.enabled) return false;
            if (modelFilterStatus === 'disabled' && m.enabled) return false;
            if (modelFilterStatus === 'default' && !m.isDefault) return false;
            return true;
        });
    }

    function renderModelManagerCards() {
        var container = $('#nexvoraModelsContent');
        if (!container) return;

        // Check admin access
        if (!isAdmin()) {
            container.innerHTML = '<div class="nexvora-admin-required">' +
                '<i class="fa-solid fa-shield-halved"></i>' +
                '<h3>Admin Access Required</h3>' +
                '<p>Only administrators can manage AI models. Please log in with an admin account.</p>' +
                '</div>';
            return;
        }

        updateModelStats();
        populateProviderFilter();

        var allModels = NexvoraModelManager.getAllModels();
        var models = filterModels(allModels);

        // Professional empty state (no models at all)
        if (allModels.length === 0) {
            container.innerHTML = '<div class="nexvora-model-empty-state">' +
                '<div class="nexvora-model-empty-icon"><i class="fa-solid fa-microchip"></i></div>' +
                '<h3>No AI Models Configured</h3>' +
                '<p>Add your first AI model to start using Nexvora AI. You can connect to OpenAI, Anthropic, or your own custom backend.</p>' +
                '<div class="nexvora-model-empty-steps">' +
                '<div class="nexvora-model-empty-step">' +
                '<span class="nexvora-model-empty-step-num">1</span>' +
                '<div><strong>Click "Add Model"</strong><br>Enter your model details</div>' +
                '</div>' +
                '<div class="nexvora-model-empty-step">' +
                '<span class="nexvora-model-empty-step-num">2</span>' +
                '<div><strong>Configure Endpoint</strong><br>Set your API URL and key</div>' +
                '</div>' +
                '<div class="nexvora-model-empty-step">' +
                '<span class="nexvora-model-empty-step-num">3</span>' +
                '<div><strong>Test Connection</strong><br>Verify everything works</div>' +
                '</div>' +
                '</div>' +
                '</div>';
            return;
        }

        // No search results
        if (models.length === 0) {
            container.innerHTML = '<div class="nexvora-model-no-results">' +
                '<i class="fa-solid fa-magnifying-glass"></i>' +
                '<p>No models match your search or filter.</p>' +
                '</div>';
            return;
        }

        container.innerHTML = '';
        models.forEach(function (m) {
            var card = document.createElement('div');
            card.className = 'nexvora-model-card';
            if (m.isDefault) card.classList.add('nexvora-model-card-default');
            if (!m.enabled) card.classList.add('nexvora-model-card-disabled');

            var connStatus = NexvoraModelManager.getConnectionStatus(m.id);
            var statusClass = 'nexvora-model-status-unknown';
            var statusText = 'Unknown';
            var statusIcon = 'fa-circle-question';

            if (connStatus.status === 'connected') {
                statusClass = 'nexvora-model-status-connected';
                statusText = connStatus.latency ? connStatus.latency + 'ms' : 'Connected';
                statusIcon = 'fa-circle-check';
            } else if (connStatus.status === 'error') {
                statusClass = 'nexvora-model-status-error';
                statusText = 'Error';
                statusIcon = 'fa-circle-exclamation';
            } else if (connStatus.status === 'testing') {
                statusClass = 'nexvora-model-status-testing';
                statusText = 'Testing...';
                statusIcon = 'fa-spinner fa-spin';
            } else if (connStatus.status === 'no-endpoint') {
                statusClass = 'nexvora-model-status-noendpoint';
                statusText = 'No Endpoint';
                statusIcon = 'fa-circle-xmark';
            }

            card.innerHTML = '<div class="nexvora-model-card-header">' +
                '<div class="nexvora-model-card-title">' +
                escapeHtml(m.name) +
                (m.isDefault ? ' <span class="nexvora-model-card-default-badge">Default</span>' : '') +
                '</div>' +
                '<span class="nexvora-model-card-badge ' + (m.enabled ? 'enabled' : 'disabled') + '">' + (m.enabled ? 'Active' : 'Disabled') + '</span>' +
                '</div>' +
                '<div class="nexvora-model-card-body">' +
                '<div class="nexvora-model-card-meta">' +
                '<div class="nexvora-model-card-row"><i class="fa-solid fa-id-tag"></i><span class="nexvora-model-card-label">Model ID:</span><span>' + escapeHtml(m.modelId || m.id) + '</span></div>' +
                '<div class="nexvora-model-card-row"><i class="fa-solid fa-link"></i><span class="nexvora-model-card-label">Endpoint:</span><span class="nexvora-model-card-url">' + escapeHtml(m.endpoint || 'Not configured') + '</span></div>' +
                '<div class="nexvora-model-card-row"><i class="fa-solid fa-building"></i><span class="nexvora-model-card-label">Provider:</span><span>' + escapeHtml(m.provider || 'Custom') + '</span></div>' +
                '<div class="nexvora-model-card-row"><i class="fa-solid fa-maximize"></i><span class="nexvora-model-card-label">Max Tokens:</span><span>' + (m.maxTokens || 4096) + '</span></div>' +
                '</div>' +
                '<div class="nexvora-model-card-section">' +
                '<div class="nexvora-model-card-label">Capabilities</div>' +
                '<div class="nexvora-model-card-chips">' +
                (m.capabilities || []).map(function (c) {
                    var capClass = 'nexvora-chip-cap';
                    if (c === 'chat') capClass += ' nexvora-chip-chat';
                    else if (c === 'translation' || c === 'translate') capClass += ' nexvora-chip-translation';
                    else if (c === 'writing') capClass += ' nexvora-chip-writing';
                    else if (c === 'summarization') capClass += ' nexvora-chip-summarization';
                    else if (c === 'documents') capClass += ' nexvora-chip-documents';
                    else if (c === 'coding') capClass += ' nexvora-chip-coding';
                    return '<span class="' + capClass + '">' + escapeHtml(c) + '</span>';
                }).join('') +
                '</div>' +
                '</div>' +
                '<div class="nexvora-model-card-section">' +
                '<div class="nexvora-model-card-label">Languages</div>' +
                '<div class="nexvora-model-card-chips">' +
                (m.languages || []).map(function (l) {
                    return '<span class="nexvora-chip-lang">' + escapeHtml(l) + '</span>';
                }).join('') +
                ((m.languages || []).length === 0 ? '<span class="nexvora-model-card-none">All languages</span>' : '') +
                '</div>' +
                '</div>' +
                '</div>' +
                '<div class="nexvora-model-card-footer">' +
                '<div class="nexvora-model-card-connection ' + statusClass + '">' +
                '<i class="fa-solid ' + statusIcon + '"></i> ' + statusText +
                '</div>' +
                '<div class="nexvora-model-card-actions">' +
                '<button class="nexvora-model-card-test" data-id="' + m.id + '" title="Test Connection"><i class="fa-solid fa-plug"></i> Test</button>' +
                (!m.isDefault ? '<button class="nexvora-model-card-setdefault" data-id="' + m.id + '" title="Set as Default"><i class="fa-solid fa-star"></i></button>' : '') +
                '<button class="nexvora-model-card-toggle" data-id="' + m.id + '" title="' + (m.enabled ? 'Disable' : 'Enable') + '">' +
                '<i class="fa-solid fa-' + (m.enabled ? 'toggle-on' : 'toggle-off') + '"></i>' +
                '</button>' +
                '<button class="nexvora-model-card-edit" data-id="' + m.id + '" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
                '<button class="nexvora-model-card-duplicate" data-id="' + m.id + '" title="Duplicate"><i class="fa-solid fa-copy"></i></button>' +
                (!m.isDefault ? '<button class="nexvora-model-card-delete" data-id="' + m.id + '" title="Delete"><i class="fa-solid fa-trash"></i></button>' : '') +
                '</div>' +
                '</div>';

            // Event listeners
            card.querySelector('.nexvora-model-card-test').addEventListener('click', function (e) {
                e.stopPropagation();
                testModelConnection(m);
            });

            var setDefaultBtn = card.querySelector('.nexvora-model-card-setdefault');
            if (setDefaultBtn) {
                setDefaultBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    NexvoraModelManager.updateModel(m.id, { isDefault: true });
                    // Remove default from all others
                    NexvoraModelManager.getAllModels().forEach(function (other) {
                        if (other.id !== m.id && other.isDefault) {
                            NexvoraModelManager.updateModel(other.id, { isDefault: false });
                        }
                    });
                    renderModelManagerCards();
                    renderModelSelector();
                    showToast(m.name + ' set as default model', 'success');
                });
            }

            card.querySelector('.nexvora-model-card-toggle').addEventListener('click', function (e) {
                e.stopPropagation();
                NexvoraModelManager.updateModel(m.id, { enabled: !m.enabled });
                renderModelManagerCards();
                renderModelSelector();
                showToast('Model ' + (!m.enabled ? 'enabled' : 'disabled'), 'success');
            });

            card.querySelector('.nexvora-model-card-edit').addEventListener('click', function (e) {
                e.stopPropagation();
                showModelModal(m);
            });

            var dupBtn = card.querySelector('.nexvora-model-card-duplicate');
            if (dupBtn) {
                dupBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var copy = NexvoraModelManager.duplicateModel(m.id);
                    if (copy) {
                        renderModelManagerCards();
                        renderModelSelector();
                        populateProviderFilter();
                        showToast('Model duplicated as "' + copy.name + '"', 'success');
                    }
                });
            }

            var deleteBtn = card.querySelector('.nexvora-model-card-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (confirm('Delete model "' + m.name + '"? This cannot be undone.')) {
                        NexvoraModelManager.removeModel(m.id);
                        renderModelManagerCards();
                        renderModelSelector();
                        populateProviderFilter();
                        showToast('Model deleted', 'success');
                    }
                });
            }

            container.appendChild(card);
        });
    }

    function initModelManagerListeners() {
        var searchInput = $('#nexvoraModelSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                modelSearchQuery = this.value.trim();
                renderModelManagerCards();
            });
        }
        var providerFilter = $('#nexvoraModelFilterProvider');
        if (providerFilter) {
            providerFilter.addEventListener('change', function () {
                modelFilterProvider = this.value;
                renderModelManagerCards();
            });
        }
        var statusFilter = $('#nexvoraModelFilterStatus');
        if (statusFilter) {
            statusFilter.addEventListener('change', function () {
                modelFilterStatus = this.value;
                renderModelManagerCards();
            });
        }
    }

    function testModelConnection(model) {
        var card = document.querySelector('[data-id="' + model.id + '"]').closest('.nexvora-model-card');
        var statusEl = card.querySelector('.nexvora-model-card-connection');
        var testBtn = card.querySelector('.nexvora-model-card-test');

        if (!model.endpoint) {
            statusEl.className = 'nexvora-model-card-connection nexvora-model-status-noendpoint';
            statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Not Configured';
            showToast('No API endpoint configured. Edit this model to add an endpoint.', 'error');
            return;
        }

        // Validate URL format
        var urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(model.endpoint)) {
            statusEl.className = 'nexvora-model-card-connection nexvora-model-status-error';
            statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Invalid URL';
            showToast('Invalid endpoint URL. Must start with http:// or https://', 'error');
            return;
        }

        statusEl.className = 'nexvora-model-card-connection nexvora-model-status-testing';
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
        testBtn.disabled = true;

        NexvoraModelManager.testConnection(model).then(function (result) {
            testBtn.disabled = false;
            if (result.connected) {
                statusEl.className = 'nexvora-model-card-connection nexvora-model-status-connected';
                statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + (result.latency ? result.latency + 'ms' : 'Connected');
                showToast('Connection successful! Latency: ' + (result.latency ? result.latency + 'ms' : 'OK'), 'success');
            } else {
                statusEl.className = 'nexvora-model-card-connection nexvora-model-status-error';
                statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Failed';
                var msg = result.message || 'Unknown error';
                if (msg.indexOf('not configured') !== -1 || msg.indexOf('No API') !== -1) {
                    showToast('Backend not configured. Set your API URL in Settings or edit this model.', 'error');
                } else {
                    showToast('Connection failed: ' + msg, 'error');
                }
            }
        }).catch(function (err) {
            testBtn.disabled = false;
            statusEl.className = 'nexvora-model-card-connection nexvora-model-status-error';
            statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Error';
            showToast('Connection test failed: ' + (err.message || 'Unknown error'), 'error');
        });
    }

    var editingModelId = null;

    function showModelModal(model) {
        if (!requireAdmin()) return;

        editingModelId = model ? model.id : null;
        var modal = $('#nexvoraModelModal');
        var title = $('#nexvoraModelModalTitle');
        if (!modal) return;
        if (title) title.textContent = model ? 'Edit Model' : 'Add Model';

        // Clear previous errors
        var endpointError = $('#nexvoraMdlEndpointError');
        if (endpointError) endpointError.classList.add('nexvora-hidden');
        var errEls = $$('.nexvora-input-error');
        for (var ei = 0; ei < errEls.length; ei++) { errEls[ei].classList.remove('nexvora-input-error'); }

        if (model) {
            $('#nexvoraMdlName').value = model.name || '';
            $('#nexvoraMdlId').value = model.modelId || model.id || '';
            $('#nexvoraMdlEndpoint').value = model.endpoint || '';
            $('#nexvoraMdlProvider').value = model.provider || '';
            $('#nexvoraMdlApiKey').value = model.apiKey || '';
            $('#nexvoraMdlLangs').value = (model.languages || []).join(', ');
            $('#nexvoraMdlMaxTokens').value = model.maxTokens || 4096;
            $('#nexvoraMdlEnabled').checked = model.enabled !== false;
            $('#nexvoraMdlDefault').checked = !!model.isDefault;
            if ($('#nexvoraMdlTemplate')) $('#nexvoraMdlTemplate').value = model.requestBodyTemplate || '';

            // Set capabilities checkboxes
            var caps = model.capabilities || ['chat'];
            var capCheckboxes = ['nexvoraCapChat', 'nexvoraCapTranslation', 'nexvoraCapWriting',
                'nexvoraCapSummarization', 'nexvoraCapDocuments', 'nexvoraCapCoding'];
            capCheckboxes.forEach(function (id) {
                var cb = $('#' + id);
                if (cb) cb.checked = caps.indexOf(cb.value) !== -1;
            });
        } else {
            $('#nexvoraModelForm').reset();
            $('#nexvoraMdlEnabled').checked = true;
            $('#nexvoraMdlMaxTokens').value = '4096';
            // Default to chat capability
            var chatCap = $('#nexvoraCapChat');
            if (chatCap) chatCap.checked = true;
        }
        modal.classList.remove('nexvora-hidden');
    }

    function hideModelModal() {
        var modal = $('#nexvoraModelModal');
        if (modal) modal.classList.add('nexvora-hidden');
        editingModelId = null;
    }

    function saveModelFromForm() {
        if (!requireAdmin()) return;

        // Clear previous errors
        var endpointError = $('#nexvoraMdlEndpointError');
        if (endpointError) endpointError.classList.add('nexvora-hidden');
        var errEls = $$('.nexvora-input-error');
        for (var ei = 0; ei < errEls.length; ei++) { errEls[ei].classList.remove('nexvora-input-error'); }

        var nameEl = $('#nexvoraMdlName');
        var idEl = $('#nexvoraMdlId');
        var endpointEl = $('#nexvoraMdlEndpoint');
        var providerEl = $('#nexvoraMdlProvider');
        var apiKeyEl = $('#nexvoraMdlApiKey');
        var langsEl = $('#nexvoraMdlLangs');
        var maxTokensEl = $('#nexvoraMdlMaxTokens');
        var enabledEl = $('#nexvoraMdlEnabled');
        var defaultEl = $('#nexvoraMdlDefault');
        var templateEl = $('#nexvoraMdlTemplate');

        var name = (nameEl || {}).value ? nameEl.value.trim() : '';
        var modelId = (idEl || {}).value ? idEl.value.trim() : '';
        var endpoint = (endpointEl || {}).value ? endpointEl.value.trim() : '';
        var provider = (providerEl || {}).value || '';
        var apiKey = (apiKeyEl || {}).value ? apiKeyEl.value.trim() : '';
        var langs = (langsEl || {}).value || '';
        var maxTokens = (maxTokensEl || {}).value || '';
        var enabled = (enabledEl || {}).checked !== false;
        var isDefault = (defaultEl || {}).checked || false;
        var requestBodyTemplate = (templateEl || {}).value ? templateEl.value.trim() : '';

        // Collect capabilities from checkboxes
        var capabilities = [];
        var capCheckboxes = ['nexvoraCapChat', 'nexvoraCapTranslation', 'nexvoraCapWriting',
            'nexvoraCapSummarization', 'nexvoraCapDocuments', 'nexvoraCapCoding'];
        capCheckboxes.forEach(function (id) {
            var cb = $('#' + id);
            if (cb && cb.checked) capabilities.push(cb.value);
        });

        // Validation
        var errors = [];
        if (!name) {
            errors.push('Model name is required');
            if (nameEl) nameEl.classList.add('nexvora-input-error');
        }
        if (!modelId) {
            errors.push('Model ID is required');
            if (idEl) idEl.classList.add('nexvora-input-error');
        }
        if (!provider) {
            errors.push('Provider is required');
            if (providerEl) providerEl.classList.add('nexvora-input-error');
        }
        if (!endpoint) {
            errors.push('API endpoint is required');
            if (endpointEl) endpointEl.classList.add('nexvora-input-error');
        } else {
            // URL validation
            var urlPattern = /^https?:\/\/.+/i;
            var localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i;
            if (!urlPattern.test(endpoint) && !localhostPattern.test(endpoint)) {
                errors.push('Invalid URL format. Must start with http:// or https://');
                if (endpointEl) endpointEl.classList.add('nexvora-input-error');
                if (endpointError) {
                    endpointError.textContent = 'Invalid URL. Example: http://127.0.0.1:8000/v1/chat/completions';
                    endpointError.classList.remove('nexvora-hidden');
                }
            }
        }

        if (errors.length > 0) {
            showToast(errors[0], 'error');
            return;
        }

        var config = {
            name: name,
            modelId: modelId,
            endpoint: endpoint,
            provider: provider,
            apiKey: apiKey,
            languages: langs,
            maxTokens: maxTokens,
            capabilities: capabilities,
            enabled: enabled,
            isDefault: isDefault,
            requestBodyTemplate: requestBodyTemplate
        };

        // Handle languages as array
        if (typeof config.languages === 'string') {
            config.languages = config.languages.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        }

        try {
            if (editingModelId) {
                NexvoraModelManager.updateModel(editingModelId, config);
                showToast('Model updated successfully', 'success');
            } else {
                config.id = config.modelId || undefined;
                NexvoraModelManager.addModel(config);
                showToast('Model added successfully', 'success');
            }
            hideModelModal();
            try { renderModelManagerCards(); } catch (e) { console.error('[Nexvora] renderModelManagerCards error:', e); }
            try { renderModelSelector(); } catch (e) { console.error('[Nexvora] renderModelSelector error:', e); }
            try { renderDashboard(); } catch (e) { console.error('[Nexvora] renderDashboard error:', e); }
        } catch (e) {
            console.error('[Nexvora] saveModelFromForm error:', e);
            showToast('Failed to save model: ' + (e.message || 'Unknown error'), 'error');
        }
    }

    // --- Project Modal ---
    function showProjectModal() {
        var modal = $('#nexvoraProjectModal');
        if (modal) { modal.classList.remove('nexvora-hidden'); ($('#nexvoraProjectName')).value = ''; ($('#nexvoraProjectDesc')).value = ''; }
    }
    function hideProjectModal() {
        var modal = $('#nexvoraProjectModal');
        if (modal) modal.classList.add('nexvora-hidden');
    }

    // --- Settings ---
    function initSettingsListeners() {
        var themeSelect = $('#nexvoraThemeSelect');
        if (themeSelect) {
            themeSelect.value = settings.theme;
            themeSelect.addEventListener('change', function () {
                settings.theme = this.value; saveSettings(); applySettings();
            });
        }

        var langSelect = $('#nexvoraLangSelect');
        if (langSelect) {
            langSelect.value = settings.language;
            langSelect.addEventListener('change', function () { settings.language = this.value; saveSettings(); });
        }

        var enterSend = $('#nexvoraEnterSend');
        if (enterSend) {
            enterSend.checked = settings.enterToSend;
            enterSend.addEventListener('change', function () { settings.enterToSend = this.checked; saveSettings(); });
        }

        var autoScroll = $('#nexvoraAutoScroll');
        if (autoScroll) {
            autoScroll.checked = settings.autoScroll;
            autoScroll.addEventListener('change', function () { settings.autoScroll = this.checked; saveSettings(); });
        }

        var markdown = $('#nexvoraMarkdown');
        if (markdown) {
            markdown.checked = settings.markdownEnabled;
            markdown.addEventListener('change', function () { settings.markdownEnabled = this.checked; saveSettings(); });
        }

        var compactMode = $('#nexvoraCompactMode');
        if (compactMode) {
            compactMode.checked = settings.compactMode;
            compactMode.addEventListener('change', function () { settings.compactMode = this.checked; saveSettings(); applySettings(); });
        }

        var chatNotif = $('#nexvoraChatNotif');
        if (chatNotif) {
            chatNotif.checked = settings.chatNotif;
            chatNotif.addEventListener('change', function () { settings.chatNotif = this.checked; saveSettings(); });
        }

        var sounds = $('#nexvoraSounds');
        if (sounds) {
            sounds.checked = settings.sounds;
            sounds.addEventListener('change', function () { settings.sounds = this.checked; saveSettings(); });
        }

        // Accent color
        var colorSwatches = $$('.nexvora-color-swatch');
        colorSwatches.forEach(function (swatch) {
            swatch.addEventListener('click', function () {
                colorSwatches.forEach(function (s) { s.classList.remove('active'); });
                this.classList.add('active');
                settings.accentColor = this.dataset.color;
                saveSettings(); applySettings();
            });
        });

        var exportBtn = $('#nexvoraExportChats');
        if (exportBtn) {
            exportBtn.addEventListener('click', function () {
                var data = JSON.stringify({ chats: getAllChats(), projects: getAllProjects(), library: getAllLibrary() }, null, 2);
                var blob = new Blob([data], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url; a.download = 'nexvora-export.json'; a.click();
                URL.revokeObjectURL(url); showToast('Data exported', 'success');
            });
        }

        var clearBtn = $('#nexvoraClearData');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (confirm('Are you sure? This will delete ALL chats, projects, files, and library items.')) {
                    lsSet(SK.CHATS, []); lsSet(SK.PROJECTS, []); lsSet(SK.FILES, []);
                    lsSet(SK.ACTIVE_CHAT, ''); lsSet(SK.LIBRARY, []);
                    lsSet(SK.FAVORITES, []); currentChatId = null;
                    renderChatList(); renderProjects(); renderFiles(); renderLibrary();
                    renderFavorites(); renderDashboard(); showWelcome();
                    showToast('All data cleared', 'success');
                }
            });
        }

        var signOutBtn = $('#nexvoraSignOut');
        if (signOutBtn) signOutBtn.addEventListener('click', function () { Auth.logout(); });

        // API Configuration
        if (typeof NexvoraAPIConfig !== 'undefined') {
            var apiConfig = NexvoraAPIConfig.load();
            var apiUrlInput = $('#nexvoraApiUrl');
            var apiKeyInput = $('#nexvoraApiKey');
            var apiTimeoutInput = $('#nexvoraApiTimeout');
            var apiStatusEl = $('#nexvoraApiConnectionStatus');
            var apiDescEl = $('#nexvoraApiConnectionDesc');

            // Update connection status display
            function updateApiStatusDisplay() {
                var status = NexvoraAPIConfig.getStatus();
                if (!apiStatusEl || !apiDescEl) return;

                if (status.status === 'connected') {
                    apiStatusEl.className = 'nexvora-api-status nexvora-api-status-connected';
                    apiStatusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Connected' + (status.latency ? ' (' + status.latency + 'ms)' : '');
                    apiDescEl.textContent = 'Backend is reachable and responding';
                } else if (status.status === 'error') {
                    apiStatusEl.className = 'nexvora-api-status nexvora-api-status-error';
                    apiStatusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Error';
                    apiDescEl.textContent = status.lastError || 'Connection failed';
                } else {
                    apiStatusEl.className = 'nexvora-api-status nexvora-api-status-disconnected';
                    apiStatusEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Not Connected';
                    apiDescEl.textContent = apiConfig.baseUrl ? 'URL configured but not tested' : 'No API URL configured';
                }
            }

            updateApiStatusDisplay();

            if (apiUrlInput) {
                apiUrlInput.value = apiConfig.baseUrl || '';
                apiUrlInput.addEventListener('change', function () {
                    var url = this.value.trim();
                    // URL validation
                    if (url && !/^https?:\/\/.+/i.test(url)) {
                        showToast('Invalid URL. Must start with http:// or https://', 'error');
                        this.value = apiConfig.baseUrl || '';
                        return;
                    }
                    NexvoraAPIConfig.update({ baseUrl: url });
                    updateApiStatusDisplay();
                    showToast('API URL updated', 'success');
                });
            }
            if (apiKeyInput) {
                apiKeyInput.value = apiConfig.apiKey || '';
                apiKeyInput.addEventListener('change', function () {
                    NexvoraAPIConfig.update({ apiKey: this.value.trim() });
                    showToast('API key updated (stored locally only)', 'success');
                });
            }
            if (apiTimeoutInput) {
                apiTimeoutInput.value = apiConfig.timeout || 30000;
                apiTimeoutInput.addEventListener('change', function () {
                    NexvoraAPIConfig.update({ timeout: parseInt(this.value, 10) || 30000 });
                });
            }

            var testApiBtn = $('#nexvoraTestApiConnection');
            if (testApiBtn) {
                testApiBtn.addEventListener('click', function () {
                    if (!apiConfig.baseUrl && !apiUrlInput.value.trim()) {
                        showToast('No API URL configured. Enter your backend URL first.', 'error');
                        return;
                    }
                    testApiBtn.disabled = true;
                    testApiBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
                    apiStatusEl.className = 'nexvora-api-status nexvora-api-status-testing';
                    apiStatusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';

                    NexvoraAPIConfig.checkHealth().then(function (status) {
                        testApiBtn.disabled = false;
                        testApiBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Test';
                        updateApiStatusDisplay();
                        renderDashboard();
                        if (status.status === 'connected') {
                            showToast('API connected! Latency: ' + (status.latency || '?') + 'ms', 'success');
                        } else {
                            showToast('API not reachable: ' + (status.lastError || 'Check your backend URL'), 'error');
                        }
                    }).catch(function () {
                        testApiBtn.disabled = false;
                        testApiBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Test';
                        updateApiStatusDisplay();
                        showToast('Connection test failed', 'error');
                    });
                });
            }
        }
    }

    function applySettings() {
        // Theme
        document.body.className = '';
        if (settings.theme === 'system') {
            var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.add(prefersDark ? 'nexvora-theme-dark' : 'nexvora-theme-light');
        } else {
            document.body.classList.add('nexvora-theme-' + settings.theme);
        }
        // Compact mode
        if (settings.compactMode) document.body.classList.add('nexvora-compact');
        // Accent color
        if (settings.accentColor) {
            document.documentElement.style.setProperty('--nv-accent', settings.accentColor);
        }
    }

    // --- Public API ---
    return {
        init: function () { loadSettings(); initAuthForms(); checkAuth(); },
        createChat: createChat,
        startNewChat: startNewChat,
        openChat: openChat,
        deleteChat: deleteChat,
        showToast: showToast,
        getModelManager: function () { return NexvoraModelManager; }
    };

})();

document.addEventListener('DOMContentLoaded', function () { NexvoraAI.init(); });
