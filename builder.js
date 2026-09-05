'use strict';

// Website Builder - localStorage-based

// ============================================
// Global State
// ============================================
let currentUser = null;
let currentSongId = null;
let uploadedAlbumUrl = null;
let uploadedAudioUrl = null;
let websiteSections = [];
let previewCount = 0;
let uploadedImages = [];
let currentPreviewImage = null;
let publishState = 'draft';
let publishHistory = [];

// ============================================
// Performance: Debounce Utility
// ============================================
const _syncTimers = {};
function debounce(key, fn, delay) {
    if (_syncTimers[key]) clearTimeout(_syncTimers[key]);
    _syncTimers[key] = setTimeout(fn, delay);
}

// Debounced sync â€” batches rapid-fire calls into one sync per 400ms
let _syncDebounceTimer = null;
function scheduleSync() {
    if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(() => {
        syncToLiveWebsite();
        _syncDebounceTimer = null;
    }, 400);
}

// ============================================
// Authentication System
// ============================================
const ADMIN_CREDENTIALS = {
    username: 'admin@tamilaistream.com',
    password: 'Admin@123'
};

const BUILDER_USERS_KEY = 'tamilAIStream_builderUsers';

function getBuilderUsers() {
    try {
        return JSON.parse(localStorage.getItem(BUILDER_USERS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveBuilderUsers(users) {
    localStorage.setItem(BUILDER_USERS_KEY, JSON.stringify(users));
}

// Detect requests arriving from the login page's "Open Website Builder" button (?auto=1)
function isAutoLoginRequest() {
    try {
        return new URLSearchParams(window.location.search).get('auto') === '1';
    } catch (e) {
        return false;
    }
}

function checkAuth() {
    return new Promise((resolve) => {
        const session = localStorage.getItem('adminSession');
        if (session) {
            try {
                const data = JSON.parse(session);
                // Validate admin email â€” non-admin sessions are rejected
                const email = (data.email || data.username || '').toLowerCase();
                const isAdmin = email === 'admin@tamilaistream.com' || email.startsWith('admin');
                if (data.expiry > Date.now() && isAdmin) {
                    if (!isAutoLoginRequest()) {
                        showAccessGate(data);
                    }
                    resolve(data);
                } else {
                    localStorage.removeItem('adminSession');
                    checkWebsiteAuth(resolve);
                }
            } catch (e) {
                localStorage.removeItem('adminSession');
                checkWebsiteAuth(resolve);
            }
        } else {
            checkWebsiteAuth(resolve);
        }
    });
}

function checkWebsiteAuth(resolve) {
    // Also check for admin login from the main website login page
    const storedUser = localStorage.getItem('tamilAIStream_user');
    const loggedIn = localStorage.getItem('tamilAIStream_loggedIn');
    
    if (loggedIn === 'true' && storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            const isAdmin = userData.email === ADMIN_CREDENTIALS.username ||
                           userData.email === 'admin@tamilaistream.com';
            
            if (isAdmin) {
                // Auto-create adminSession for builder access
                const sessionData = {
                    username: userData.email,
                    email: userData.email,
                    displayName: userData.name || 'Admin',
                    role: 'admin',
                    loginTime: Date.now(),
                    expiry: Date.now() + (24 * 60 * 60 * 1000)
                };
                localStorage.setItem('adminSession', JSON.stringify(sessionData));
                // Show access gate (skipped for ?auto=1 coming from the login page)
                if (!isAutoLoginRequest()) {
                    showAccessGate(sessionData);
                }
                resolve(sessionData);
            } else {
                resolve(null);
            }
        } catch (e) {
            resolve(null);
        }
    } else {
        resolve(null);
    }
}


function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('builderDashboard').style.display = 'none';
    const accessGate = document.getElementById('builderAccessGate');
    if (accessGate) accessGate.style.display = 'none';
    const loginCard = document.querySelector('.login-card');
    if (loginCard) loginCard.style.display = 'block';
}

function showAccessGate(user) {
    currentUser = user;
    const loginCard = document.querySelector('.login-card');
    const accessGate = document.getElementById('builderAccessGate');
    if (loginCard) loginCard.style.display = 'none';
    if (accessGate) {
        accessGate.style.display = 'flex';
        const userNameEl = document.getElementById('accessGateUserName');
        if (userNameEl) userNameEl.textContent = user.displayName || user.email?.split('@')[0] || 'Admin';
    }
}

function showBuilderDashboard(user) {
    currentUser = user;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('builderDashboard').style.display = 'block';
    const accessGate = document.getElementById('builderAccessGate');
    if (accessGate) accessGate.style.display = 'none';
    // Analytics: track login
    if (typeof AnalyticsTracker !== 'undefined') { AnalyticsTracker.setUserId(user.uid || user.email); AnalyticsTracker.track('user_login'); }
    
    // Update user info in nav
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    const initial = displayName.charAt(0).toUpperCase();
    document.getElementById('builderUserName').textContent = displayName;
    document.getElementById('builderUserAvatar').textContent = initial;
    
    // Initialize builder
    initBuilder();
    
    // Initialize AI Webflow
    if (typeof AIWebflow !== 'undefined') AIWebflow.init();
}

// Access Gate Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const enterBtn = document.getElementById('accessGateEnterBtn');
    const backBtn = document.getElementById('accessGateBackBtn');
    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            if (currentUser) showBuilderDashboard(currentUser);
        });
    }
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const accessGate = document.getElementById('builderAccessGate');
            const loginCard = document.querySelector('.login-card');
            if (accessGate) accessGate.style.display = 'none';
            if (loginCard) loginCard.style.display = 'block';
            currentUser = null;
        });
    }
});

// Sign In
async function signInWithEmail(email, password) {
    try {
        const users = getBuilderUsers();
        const user = users.find(u => u.email === email && u.password === password);
        
        if (!user) {
            // Check if it's the admin demo credentials
            if (email === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
                const demoUser = {
                    username: ADMIN_CREDENTIALS.username,
                    email: ADMIN_CREDENTIALS.username,
                    displayName: 'Admin',
                    role: 'admin',
                    password: ADMIN_CREDENTIALS.password
                };
                localStorage.setItem('adminSession', JSON.stringify({
                    username: ADMIN_CREDENTIALS.username,
                    email: ADMIN_CREDENTIALS.username,
                    displayName: 'Admin',
                    role: 'admin',
                    loginTime: Date.now(),
                    expiry: Date.now() + (24 * 60 * 60 * 1000)
                }));
                showToast('Welcome Admin!', 'success');
                showAccessGate(demoUser);
                return;
            }
            showToast('Invalid email or password', 'error');
            return;
        }
        
        localStorage.setItem('adminSession', JSON.stringify({
            username: user.email,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            loginTime: Date.now(),
            expiry: Date.now() + (24 * 60 * 60 * 1000)
        }));
        showToast(`Welcome ${user.displayName}!`, 'success');
        showAccessGate(user);
    } catch (error) {
        console.error('Sign in error:', error);
        showToast('Authentication failed. Please try again', 'error');
    }
}

// Sign Up/Registration
async function signUpWithEmail(name, email, password) {
    const nameTrimmed = name.trim();
    const emailTrimmed = email.trim();
    
    if (!nameTrimmed || !emailTrimmed || !password) {
        showToast('Please fill in all fields', 'error');
        return false;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return false;
    }
    
    const users = getBuilderUsers();
    if (users.find(u => u.email === emailTrimmed)) {
        showToast('Email already registered', 'error');
        return false;
    }
    
    const newUser = {
        displayName: nameTrimmed,
        email: emailTrimmed,
        password: password,
        role: 'user'
    };
    
    users.push(newUser);
    saveBuilderUsers(users);
    
    showToast('Registration successful! Please login.', 'success');
    return true;
}

// Sign In with Google - Disabled
async function signInWithGoogle() {
    const btn = document.getElementById('googleSignIn');
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...'; }

    try {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            showToast('Firebase not loaded. Please refresh.', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            return;
        }

        window.ensureFirebaseInit();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;

        if (!user || !user.email) {
            showToast('Google sign-in failed: no email returned', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            return;
        }

        const email = user.email.toLowerCase();
        if (email !== ADMIN_CREDENTIALS.username && !email.startsWith('admin')) {
            firebase.auth().signOut();
            showToast('Access denied. Admins only.', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            return;
        }

        const sessionData = {
            username: email,
            email: email,
            displayName: user.displayName || 'Admin',
            uid: user.uid,
            photoURL: user.photoURL || '',
            role: 'admin',
            loginTime: Date.now(),
            expiry: Date.now() + (24 * 60 * 60 * 1000)
        };
        localStorage.setItem('adminSession', JSON.stringify(sessionData));

        if (typeof Auth !== 'undefined' && Auth.createSession) {
            Auth.createSession({
                name: user.displayName || 'Admin',
                email: email,
                uid: user.uid,
                photoURL: user.photoURL || ''
            }, true, false);
        }

        showToast('Welcome ' + (user.displayName || 'Admin') + '!', 'success');
        showBuilderDashboard(sessionData);

    } catch (error) {
        console.error('Google sign-in error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showToast('Sign-in cancelled', 'info');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please try again.', 'error');
        } else {
            showToast('Google sign-in failed: ' + (error.message || 'Unknown error'), 'error');
        }
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
    }
}

// Sign In as Guest - Disabled
async function signInAsGuest() {
    showToast('Guest access is disabled. Please login or register.', 'error');
}

// One-click admin login on the Builder login screen.
// Signs in with the built-in admin credentials, persists both sessions
// (adminSession + main website session) and enters the dashboard directly.
function quickAdminLogin() {
    const btn = document.getElementById('builderQuickLogin');
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Signing in...';

    setTimeout(() => {
        const adminUser = {
            username: ADMIN_CREDENTIALS.username,
            email: ADMIN_CREDENTIALS.username,
            displayName: 'Admin',
            role: 'admin',
            password: ADMIN_CREDENTIALS.password
        };

        // Sync the main website session so the admin is also logged in site-wide
        try {
            if (typeof Auth !== 'undefined' && Auth.createSession) {
                Auth.createSession({ name: 'Admin', email: ADMIN_CREDENTIALS.username, uid: 'admin-local', photoURL: '' }, true, false);
            } else {
                localStorage.setItem('tamilAIStream_user', JSON.stringify({
                    uid: 'admin-local',
                    name: 'Admin',
                    email: ADMIN_CREDENTIALS.username,
                    loginTime: Date.now()
                }));
                localStorage.setItem('tamilAIStream_loggedIn', 'true');
            }
        } catch (e) {
            console.warn('Unable to sync website session:', e);
        }

        localStorage.setItem('adminSession', JSON.stringify({
            username: ADMIN_CREDENTIALS.username,
            email: ADMIN_CREDENTIALS.username,
            displayName: 'Admin',
            role: 'admin',
            loginTime: Date.now(),
            expiry: Date.now() + (24 * 60 * 60 * 1000)
        }));

        showToast('Welcome Admin!', 'success');
        // Enter the Builder immediately on this express path
        showBuilderDashboard(adminUser);
    }, 400);
}

// Sign Out
async function signOut() {
    try {
        if (typeof Auth !== 'undefined' && Auth.firebaseSignOut) {
            Auth.firebaseSignOut();
        } else if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().signOut();
        }
        Auth.clearAll();
        currentUser = null;
        if (typeof AnalyticsTracker !== 'undefined') AnalyticsTracker.track('user_logout');
        showLoginScreen();
        showToast('Signed out successfully', 'success');
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('Error signing out', 'error');
    }
}

// Get user-friendly auth error messages
function getAuthErrorMessage(code) {
    return 'Authentication failed. Please try again';
}

// ============================================
// Login Screen Event Listeners
// ============================================
function setupLoginScreen() {
    // Tab switching
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const tabName = this.dataset.tab;
            document.getElementById('signinForm').style.display = tabName === 'signin' ? 'block' : 'none';
            document.getElementById('signupForm').style.display = tabName === 'signup' ? 'block' : 'none';
        });
    });
    
    // Sign In form
    document.getElementById('signinForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signinEmail').value;
        const password = document.getElementById('signinPassword').value;
        await signInWithEmail(email, password);
    });
    
    // Sign Up form
    document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirm').value;
        
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        
        const success = await signUpWithEmail(name, email, password);
        if (success) {
            // Switch to sign in tab
            document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.login-tab[data-tab="signin"]').classList.add('active');
            document.getElementById('signinForm').style.display = 'block';
            document.getElementById('signupForm').style.display = 'none';
            // Pre-fill email
            document.getElementById('signinEmail').value = email;
        }
    });
    
    // Google Sign In - Disabled
    document.getElementById('googleSignIn')?.addEventListener('click', signInWithGoogle);
    
    // Guest Sign In - Disabled
    document.getElementById('guestSignIn')?.addEventListener('click', signInAsGuest);

    // Admin Quick Login (one-click)
    document.getElementById('builderQuickLogin')?.addEventListener('click', quickAdminLogin);
    
    // Switch to sign up tab
    document.getElementById('signupTab')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.login-tab[data-tab="signup"]').classList.add('active');
        document.getElementById('signinForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    });
    
    // Switch to sign in tab
    document.getElementById('signinTab')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.login-tab[data-tab="signin"]').classList.add('active');
        document.getElementById('signinForm').style.display = 'block';
        document.getElementById('signupForm').style.display = 'none';
    });
}

// ============================================
// Navigation
// ============================================
let _currentPage = null;
const _pageLoaded = {};

// ============================================
// GLOBAL BUILDER TOOLBAR
// ============================================
const _gbPageTitles = {
    dashboard: ['fa-gauge-high', 'Dashboard'],
    stations: ['fa-tower-broadcast', 'Radio Management'],
    songs: ['fa-music', 'Add Songs'],
    content: ['fa-layer-group', 'Content Management'],
    images: ['fa-images', 'Manage Images'],
    settings: ['fa-cog', 'Site Settings'],
    moods: ['fa-face-smile', 'Moods & Genres'],
    decades: ['fa-calendar-days', 'Music by Era'],
    airadio: ['fa-robot', 'AI Radio Moods'],
    notifications: ['fa-bell', 'Notifications'],
    splash: ['fa-rocket', 'Splash Screen'],
    player: ['fa-headphones', 'Player Settings'],
    navigation: ['fa-bars', 'Navigation'],
    homecontrol: ['fa-sliders', 'Home Control Center'],
    sections: ['fa-list-ol', 'Home Page Sections'],
    ads: ['fa-bullhorn', 'Ads Manager'],
    upcomingReleases: ['fa-forward', 'Upcoming Releases'],
    visualeditor: ['fa-paint-brush', 'Visual Editor'],
    miniplayersettings: ['fa-window-minimize', 'Mini Player'],
    preview: ['fa-eye', 'Live Preview'],
    analytics: ['fa-chart-line', 'Analytics'],
    musiccollections: ['fa-record-vinyl', 'Music Collections'],
    site360: ['fa-globe', 'Site 360'],
    aiwebflow: ['fa-wand-magic-sparkles', 'AI Webflow'],
    application: ['fa-mobile-screen', 'Application'],
    songsCollections: ['fa-layer-group', 'Songs Collections'],
    newalbums: ['fa-compact-disc', 'New Albums'],
    changes: ['fa-clock-rotate-left', 'Recent Changes'],
    trash: ['fa-trash', 'Trash'],
    entrancelogo: ['fa-door-open', 'Entrance Logo']
};

// Global undo/redo stacks (per-page)
const _gbUndoStacks = {};
const _gbRedoStacks = {};
const _gbHistory = [];
const _gbMaxHistory = 30;
const _gbMaxUndo = 50;

// Pages that have their own save/publish (routed to page-specific functions)
const _gbSpecialPages = ['homecontrol', 'visualeditor', 'aiwebflow', 'site360', 'preview'];

function _gbGetPageUndoStack() {
    const p = _currentPage || 'dashboard';
    if (!_gbUndoStacks[p]) _gbUndoStacks[p] = [];
    return _gbUndoStacks[p];
}
function _gbGetPageRedoStack() {
    const p = _currentPage || 'dashboard';
    if (!_gbRedoStacks[p]) _gbRedoStacks[p] = [];
    return _gbRedoStacks[p];
}

function gbPushUndo(label) {
    const stack = _gbGetPageUndoStack();
    const page = _currentPage || 'dashboard';
    // Capture current page state snapshot
    const snapshot = _gbCapturePageState(page);
    stack.push({ page, state: snapshot, label: label || 'Change', time: Date.now() });
    if (stack.length > _gbMaxUndo) stack.shift();
    _gbRedoStacks[page] = [];
    _gbUpdateToolbarUndoRedo();
    _gbAddHistoryEntry(label || 'Change', page);
}

function _gbCapturePageState(page) {
    try {
        // Capture all DataStore keys relevant to the page
        const keys = ['tamilAIStream_songs', 'tamilAIStream_stations', 'tamilAIStream_categories',
            'tamilAIStream_featured', 'tamilAIStream_trending', 'tamilAIStream_artistHits',
            'tamilAIStream_quotes', 'tamilAIStream_siteSettings', 'tamilAIStream_navigation',
            'tamilAIStream_sectionsOrder', 'tamilAIStream_sectionSettings', 'tamilAIStream_logoSettings', 'tamilAIStream_entranceLogo',
            'tamilAIStream_miniPlayerSettings', 'tamilAIStream_moods', 'tamilAIStream_aiRadio',
            'tamilAIStream_notifications', 'tamilAIStream_splash', 'tamilAIStream_playerPrefs',
            'tamilAIStream_images', 'tamilAIStream_advertisements', 'tamilAIStream_upcomingReleases',
            'tamilAIStream_songsCollections', 'tamilAIStream_newAlbums', 'tamilAIStream_musicCollections'];
        const state = {};
        keys.forEach(k => { const v = localStorage.getItem(k); if (v) state[k] = v; });
        return state;
    } catch (e) { return {}; }
}

function _gbRestorePageState(snapshot) {
    try {
        Object.entries(snapshot).forEach(([k, v]) => { localStorage.setItem(k, v); });
        // Reload current page data
        if (_currentPage) {
            _pageLoaded[_currentPage] = false;
            _loadPageData(_currentPage);
        }
    } catch (e) { console.warn('[GB] Restore failed:', e); }
}

function gbUndo() {
    const stack = _gbGetPageUndoStack();
    if (!stack.length) return;
    const redoStack = _gbGetPageRedoStack();
    const entry = stack.pop();
    const currentSnapshot = _gbCapturePageState(entry.page);
    redoStack.push({ page: entry.page, state: currentSnapshot, label: entry.label, time: Date.now() });
    _gbRestorePageState(entry.state);
    _gbUpdateToolbarUndoRedo();
}

function gbRedo() {
    const redoStack = _gbGetPageRedoStack();
    if (!redoStack.length) return;
    const stack = _gbGetPageUndoStack();
    const entry = redoStack.pop();
    const currentSnapshot = _gbCapturePageState(entry.page);
    stack.push({ page: entry.page, state: currentSnapshot, label: entry.label, time: Date.now() });
    _gbRestorePageState(entry.state);
    _gbUpdateToolbarUndoRedo();
}

function _gbUpdateToolbarUndoRedo() {
    const undoBtn = document.getElementById('gbUndoBtn');
    const redoBtn = document.getElementById('gbRedoBtn');
    if (undoBtn) undoBtn.disabled = _gbGetPageUndoStack().length === 0;
    if (redoBtn) redoBtn.disabled = _gbGetPageRedoStack().length === 0;
}

function _gbAddHistoryEntry(action, page) {
    const pageInfo = _gbPageTitles[page] || ['fa-circle', page];
    _gbHistory.unshift({
        action, page, pageTitle: pageInfo[1], icon: pageInfo[0],
        time: Date.now()
    });
    if (_gbHistory.length > _gbMaxHistory) _gbHistory.pop();
    _gbRenderHistory();
}

function _gbRenderHistory() {
    const list = document.getElementById('gbHistoryList');
    if (!list) return;
    if (!_gbHistory.length) {
        list.innerHTML = '<div class="gb-history-empty">No changes recorded yet</div>';
        return;
    }
    list.innerHTML = _gbHistory.map((h, i) => {
        const t = new Date(h.time);
        const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = t.toLocaleDateString([], { month: 'short', day: 'numeric' });
        return `<div class="gb-history-item" data-idx="${i}">
            <div class="gb-history-item-icon"><i class="fas ${h.icon}"></i></div>
            <div class="gb-history-item-info">
                <div class="gb-history-item-action">${h.action}</div>
                <div class="gb-history-item-meta">${h.pageTitle} · ${dateStr} ${timeStr}</div>
            </div>
        </div>`;
    }).join('');
}

function gbToggleHistory() {
    const panel = document.getElementById('gbHistoryPanel');
    if (!panel) return;
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) _gbRenderHistory();
}

function gbSave() {
    const page = _currentPage || 'dashboard';
    if (page === 'homecontrol') { hccSave(); return; }
    if (page === 'settings') { saveSettings(); return; }
    if (page === 'stations') { saveAllStations(); return; }
    if (page === 'ads') { saveAds(); return; }
    if (page === 'splash') { saveSplashSettings(); return; }
    if (page === 'navigation') { saveNavigation(); return; }
    if (page === 'moods') { saveMoods(); return; }
    if (page === 'decades') { saveDecades(); return; }
    if (page === 'airadio') { saveAIRadioMoods(); return; }
    if (page === 'notifications') { saveNotifications(); return; }
    if (page === 'player') { savePlayerSettings(); return; }
    if (page === 'miniplayersettings') { saveMiniPlayerSettings(); return; }
    if (page === 'musiccollections') { saveMusicCollections(); return; }
    if (page === 'upcomingReleases') { saveUpcomingReleases(); return; }
    if (page === 'songsCollections') { saveSongsCollections(); return; }
    if (page === 'newalbums') { saveNewAlbums(); return; }
    if (page === 'content') { saveContent(); return; }
    if (page === 'songs') { showToast('Songs saved', 'success'); return; }
    if (page === 'images') { showToast('Images saved', 'success'); return; }
    if (page === 'entrancelogo') { elSaveEntranceLogo(); return; }
    // Default: save all DataStore
    try { DataStore.set('tamilAIStream_lastSave', Date.now()); } catch(e) {}
    showToast('Settings saved!', 'success');
}

function gbPreview() {
    gbSave();
    window.open('index.html', '_blank');
}

async function gbPublish() {
    gbSave();
    const progressEl = document.getElementById('gbProgress');
    const fillEl = document.getElementById('gbProgressFill');
    const textEl = document.getElementById('gbProgressText');
    const publishBtn = document.getElementById('gbPublishBtn');
    if (!progressEl || !fillEl || !textEl) return;

    progressEl.style.display = 'flex';
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span class="gb-btn-label">Updating...</span>';

    function setProgress(pct, msg) {
        fillEl.style.width = pct + '%';
        textEl.textContent = msg || (pct + '%');
    }

    try {
        setProgress(10, 'Saving settings...');
        await new Promise(r => setTimeout(r, 300));

        setProgress(30, 'Syncing to live website...');
        syncToLiveWebsite();
        await new Promise(r => setTimeout(r, 500));

        setProgress(60, 'Uploading to R2...');
        if (window.ContentSync && typeof ContentSync.syncCurrentState === 'function') {
            await ContentSync.syncCurrentState();
        }
        await new Promise(r => setTimeout(r, 500));

        setProgress(85, 'Verifying deployment...');
        await new Promise(r => setTimeout(r, 500));

        try {
            const res = await fetch('/api/deploy-verify');
            const data = await res.json();
            if (data.ok) {
                setProgress(100, `Update Complete! (${data.stationCount} stations, ${data.songCount} songs)`);
            } else {
                setProgress(100, 'Update Complete!');
            }
        } catch (_) {
            setProgress(100, 'Update Complete!');
        }

        setTimeout(() => { progressEl.style.display = 'none'; }, 3000);
    } catch (err) {
        setProgress(100, 'Update failed: ' + err.message);
        showToast('Publish failed', 'error');
    } finally {
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<i class="fas fa-rocket"></i> <span class="gb-btn-label">Update Website</span>';
    }
}

function gbUpdateToolbarForPage(page) {
    const info = _gbPageTitles[page] || ['fa-circle', page];
    const titleEl = document.getElementById('gbToolbarTitle');
    if (titleEl) titleEl.innerHTML = `<i class="fas ${info[0]}"></i> ${info[1]}`;
    _gbUpdateToolbarUndoRedo();
}

// ============================================
// Universal Deleted Items Filter
// Filters out items whose IDs are in deletedIds
// ============================================
function _filterDeletedItems(items, type) {
    if (!Array.isArray(items)) return items;
    try {
        const deletedIds = DataStore.getDeletedIds();
        const typeIds = deletedIds?.[type];
        if (!Array.isArray(typeIds) || typeIds.length === 0) return items;
        const deletedSet = new Set(typeIds);
        return items.filter(item => item && item.id && !deletedSet.has(item.id));
    } catch (e) { return items; }
}

// ============================================
// Right Panel (Settings/Properties)
// ============================================
const _rightPanelPages = [
    'settings', 'moods', 'decades', 'navigation', 'sections',
    'player', 'miniplayersettings', 'splash', 'ads', 'upcomingReleases',
    'notifications', 'airadio', 'trash', 'analytics', 'site360',
    'aiwebflow', 'visualeditor', 'musiccollections'
];

function openRightPanel(title, html) {
    const panel = document.getElementById('builderRightPanel');
    const titleEl = document.getElementById('rightPanelTitle');
    const body = document.getElementById('rightPanelBody');
    const overlay = document.getElementById('rightPanelOverlay');
    if (!panel) return;
    if (titleEl) titleEl.innerHTML = title;
    if (body) body.innerHTML = html;
    panel.classList.add('open');
    if (overlay) overlay.classList.add('active');
}

function closeRightPanel() {
    const panel = document.getElementById('builderRightPanel');
    const overlay = document.getElementById('rightPanelOverlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

function isRightPanelPage(page) {
    return _rightPanelPages.includes(page);
}

function navigateTo(page) {
    if (_currentPage === page) return;
    _currentPage = page;

    document.querySelectorAll('.builder-page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.builder-sidebar-item').forEach(i => i.classList.remove('active'));

    // Update global toolbar title
    gbUpdateToolbarForPage(page);

    // Hide page-specific toolbars (global toolbar replaces them)
    document.querySelectorAll('.hcc-topbar, .hcc-progress').forEach(el => el.style.display = 'none');

    // Force close right panel for ALL center pages (including entrancelogo)
    closeRightPanel();
    const panel = document.getElementById('builderRightPanel');
    const overlay = document.getElementById('rightPanelOverlay');
    if (panel) { panel.classList.remove('open'); panel.style.display = 'none'; }
    if (overlay) { overlay.classList.remove('active'); overlay.style.display = 'none'; }

    // Trash opens in right panel, not center
    if (page === 'trash') {
        document.querySelectorAll(`[data-page="trash"]`).forEach(el => el.classList.add('active'));
        _openTrashInRightPanel();
        return;
    }

    const pageMap = {
        'dashboard': 'dashboardPage',
        'stations': 'stationsPage',
        'songs': 'songsPage',
        'content': 'contentPage',
        'images': 'imagesPage',
        'settings': 'settingsPage',
        'moods': 'moodsPage',
        'decades': 'decadesPage',
        'airadio': 'airadioPage',
        'notifications': 'notificationsPage',
        'splash': 'splashPage',
        'player': 'playerPage',
        'navigation': 'navigationPage',
        'homecontrol': 'homecontrolPage',
        'sections': 'sectionsPage',
        'ads': 'adsPage',
        'upcomingReleases': 'upcomingReleasesPage',
        'visualeditor': 'visualeditorPage',
        'miniplayersettings': 'miniplayersettingsPage',
        'preview': 'previewPage',
        'analytics': 'analyticsPage',
        'musiccollections': 'musicCollectionsPage',
        'site360': 'site360Page',
        'aiwebflow': 'aiwebflowPage',
        'application': 'applicationPage',
        'songsCollections': 'songsCollectionsPage',
        'newalbums': 'newAlbumsPage',
        'changes': 'changesPage',
        'entrancelogo': 'entranceLogoPage'
    };

    const pageId = pageMap[page];
    if (pageId) {
        const pageEl = document.getElementById(pageId);
        if (pageEl) {
            pageEl.style.display = 'block';
            pageEl.style.visibility = 'visible';
            pageEl.style.opacity = '1';
        }
    }

    // Update active states
    document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));

    if (!_pageLoaded[page]) {
        _pageLoaded[page] = true;
        _loadPageData(page);
    } else if (page === 'dashboard') {
        loadDashboardStats();
    }
}

function _loadPageData(page) {
    if (page === 'dashboard') { loadDashboardStats(); loadDashboardAnalytics(); refreshDashboardSyncStatus(); }
    if (page === 'stations') loadAllStations();
    if (page === 'songs') loadAllSongs();
    if (page === 'content') { loadFeatured(); loadTrending(); loadCategories(); loadArtistHits(); loadCollectionsTable('movies'); loadCollectionsTable('yearly'); loadCollectionsTable('latest'); loadAllSongs(); loadQuotes(); loadContentSectionStats(); }
    if (page === 'musiccollections') loadMusicCollections();
    if (page === 'newalbums') loadNewAlbums();
    if (page === 'songsCollections') loadSongsCollectionsPage();
    if (page === 'changes') refreshChangesLog();
    if (page === 'images') loadAllImages();
    if (page === 'settings') loadSettings();
    if (page === 'moods') loadMoods();
    if (page === 'decades') loadDecadesAdmin();
    if (page === 'airadio') loadAIRadio();
    if (page === 'notifications') loadNotifications();
    if (page === 'splash') loadSplashSettings();
    if (page === 'player') loadPlayerPrefs();
    if (page === 'navigation') loadNavigation();
    if (page === 'sections') loadSectionsOrder();
    if (page === 'homecontrol') loadHomeControl();
    if (page === 'ads') loadAdsTable();
    if (page === 'upcomingReleases') loadUpcomingReleasesTable();
    if (page === 'visualeditor') initVisualEditor();
    if (page === 'miniplayersettings') loadPlayerSettings();
    if (page === 'preview') updatePreview();
    if (page === 'analytics') { loadAnalyticsData(); initAnalyticsTabs(); }
    if (page === 'site360' && typeof Site360 !== 'undefined') Site360.init();
    if (page === 'aiwebflow' && typeof AIWebflow !== 'undefined') AIWebflow.activate();
    if (page === 'application') AppBuilder.loadApplicationSettings();
    if (page === 'trash') loadTrashPage();
    if (page === 'entrancelogo') loadEntranceLogoSettings();
}

// ============================================
// Trash in Right Panel
// ============================================
function _openTrashInRightPanel() {
    const panelBody = document.getElementById('rightPanelBody');
    if (!panelBody) return;

    // Build trash content directly into the right panel
    const trash = DataStore.getTrash();
    const now = Date.now();

    let html = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
            <button class="builder-btn btn-sm trash-filter-btn active" data-filter="all" onclick="filterTrash('all')">All (${trash.length})</button>
            <button class="builder-btn btn-sm trash-filter-btn" data-filter="songs" onclick="filterTrash('songs')">Songs</button>
            <button class="builder-btn btn-sm trash-filter-btn" data-filter="images" onclick="filterTrash('images')">Images</button>
            <button class="builder-btn btn-sm trash-filter-btn" data-filter="stations" onclick="filterTrash('stations')">Stations</button>
            <button class="builder-btn btn-sm trash-filter-btn" data-filter="other" onclick="filterTrash('other')">Other</button>
            <button class="builder-btn btn-sm" style="margin-left:auto;color:#ef4444;" onclick="emptyTrash()"><i class="fas fa-trash-can"></i> Empty All</button>
        </div>`;

    if (!trash.length) {
        html += '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);"><i class="fas fa-trash-can" style="font-size:48px;margin-bottom:12px;display:block;"></i>Trash is empty</div>';
    } else {
        html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
        html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><th style="text-align:left;padding:8px 4px;">Name</th><th style="text-align:left;padding:8px 4px;">Type</th><th style="text-align:left;padding:8px 4px;">Deleted</th><th style="text-align:left;padding:8px 4px;">Actions</th></tr></thead><tbody id="trashTableBody">';
        trash.forEach(item => {
            const name = item.name || item.title || item.text || item._originalId || 'Unknown';
            const type = item._trashType || 'unknown';
            const trashedAt = item._trashedAt ? new Date(item._trashedAt) : null;
            const ageMs = trashedAt ? now - trashedAt.getTime() : 0;
            const typeBadgeColors = {
                songs: '#34d399', stations: '#60a5fa', moods: '#a78bfa', featured: '#f472b6',
                musicCollections: '#fbbf24', artistHits: '#fb923c', categories: '#38bdf8',
                quotes: '#94a3b8', aiRadio: '#c084fc', notifications: '#f97316',
                advertisements: '#ef4444', upcomingReleases: '#2dd4bf', images: '#67e8f9', trending: '#f59e0b'
            };
            const badgeColor = typeBadgeColors[type] || '#6b7280';
            html += `<tr data-type="${type}">
                <td style="padding:8px 4px;"><strong>${name}</strong></td>
                <td style="padding:8px 4px;"><span class="builder-badge" style="background:${badgeColor}22;color:${badgeColor};">${type}</span></td>
                <td style="padding:8px 4px;font-size:12px;color:rgba(255,255,255,0.5);">${trashedAt ? trashedAt.toLocaleString() : 'â€”'}</td>
                <td style="padding:8px 4px;">
                    <button class="action-btn" onclick="restoreFromTrash('${item._originalId}','${type}')" title="Restore"><i class="fas fa-undo"></i></button>
                    <button class="action-btn delete-btn" onclick="permanentDeleteFromTrash('${item._originalId}','${type}')" title="Delete Permanently"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
    }

    panelBody.innerHTML = html;
    openRightPanel('<i class="fas fa-trash-can-arrow-up"></i> Trash', '');

    // Update trash count badge
    try {
        const badge = document.querySelector('[data-page="trash"] .trash-count');
        if (badge) badge.textContent = trash.length || '';
    } catch (e) {}
}

// ============================================
// Application Settings in Right Panel
// ============================================
// ============================================
// Changes Log
// ============================================
function refreshChangesLog() {
    const list = document.getElementById('changesList');
    if (!list) return;

    // Collect recent changes from localStorage timestamps
    const changes = [];
    const lastSynced = localStorage.getItem('tamilAIStream_lastSyncedAt');
    if (lastSynced) {
        changes.push({
            time: lastSynced,
            action: 'Content synced to live site',
            icon: 'fa-cloud-arrow-up',
            color: '#10b981'
        });
    }

    // Check for recent song additions
    try {
        const songs = DataStore.getSongs() || [];
        const recentSongs = songs.filter(s => {
            if (!s.createdAt) return false;
            const age = Date.now() - new Date(s.createdAt).getTime();
            return age < 7 * 24 * 60 * 60 * 1000; // last 7 days
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        recentSongs.slice(0, 5).forEach(s => {
            changes.push({
                time: s.createdAt,
                action: `Song added: ${s.title || 'Untitled'}`,
                icon: 'fa-music',
                color: '#3b82f6'
            });
        });
    } catch (e) { /* ignore */ }

    // Check for recent station additions
    try {
        const stations = DataStore.getStations() || [];
        const recentStations = stations.filter(s => {
            if (!s.createdAt) return false;
            const age = Date.now() - new Date(s.createdAt).getTime();
            return age < 7 * 24 * 60 * 60 * 1000;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        recentStations.slice(0, 5).forEach(s => {
            changes.push({
                time: s.createdAt,
                action: `Station added: ${s.name || 'Untitled'}`,
                icon: 'fa-tower-broadcast',
                color: '#8b5cf6'
            });
        });
    } catch (e) { /* ignore */ }

    // Check for recent image uploads
    try {
        const images = DataStore.getImages() || [];
        const recentImages = images.filter(img => {
            if (!img.uploadedAt) return false;
            const age = Date.now() - new Date(img.uploadedAt).getTime();
            return age < 7 * 24 * 60 * 60 * 1000;
        }).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        recentImages.slice(0, 5).forEach(img => {
            changes.push({
                time: img.uploadedAt,
                action: `Image uploaded: ${img.name || img.key || 'Untitled'}`,
                icon: 'fa-image',
                color: '#f59e0b'
            });
        });
    } catch (e) { /* ignore */ }

    // Sort by time, most recent first
    changes.sort((a, b) => new Date(b.time) - new Date(a.time));

    if (!changes.length) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);font-size:13px;"><i class="fas fa-clock-rotate-left" style="font-size:32px;margin-bottom:12px;display:block;opacity:0.3;"></i>No changes recorded yet. Start editing content to see changes here.</div>';
        return;
    }

    list.innerHTML = changes.slice(0, 20).map(c => {
        const timeAgo = _timeAgo(c.time);
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;">
            <div style="width:32px;height:32px;border-radius:8px;background:${c.color}15;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas ${c.icon}" style="color:${c.color};font-size:14px;"></i>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="color:rgba(255,255,255,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.action}</div>
                <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px;">${timeAgo}</div>
            </div>
        </div>`;
    }).join('');
}

function _timeAgo(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return new Date(dateStr).toLocaleDateString();
}

// ============================================
// ============================================
// Dashboard Stats
// ============================================
async function loadDashboardStats() {
    try {
        const songs = DataStore.getSongs();
        const images = DataStore.getImages();
        const stations = DataStore.getStations();
        const categories = DataStore.getCategories();
        const featured = DataStore.getFeatured();
        
        document.getElementById('totalSongs').textContent = songs.length;
        document.getElementById('totalImages').textContent = images.length;
        document.getElementById('totalSections').textContent = stations.length;
        document.getElementById('totalViews').textContent = previewCount;
        
        const lastSaved = localStorage.getItem('builderLastSaved');
        if (lastSaved) {
            const date = new Date(parseInt(lastSaved));
            const lastSavedEl = document.getElementById('lastSaved');
            if (lastSavedEl) lastSavedEl.textContent = date.toLocaleTimeString();
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadDashboardAnalytics() {
    try {
        const resp = await fetch('/api/analytics/aggregate?period=7d', { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        const el = (id) => document.getElementById(id);
        if (el('dashTotalViewers')) el('dashTotalViewers').textContent = data.totalViewers || data.totalSessions || '--';
        if (el('dashActiveViewers')) el('dashActiveViewers').textContent = data.activeViewers || data.currentSessions || '--';
        if (el('dashTotalPlays')) el('dashTotalPlays').textContent = data.totalPlays || data.songPlays || '--';
        if (el('dashListenTime')) {
            const mins = data.totalListeningMinutes || data.listeningTime || 0;
            el('dashListenTime').textContent = mins >= 60 ? Math.floor(mins/60) + 'h ' + (mins%60) + 'm' : mins + 'm';
        }
        if (data.topSongs && data.topSongs.length) {
            const container = el('dashTopSongs');
            if (container) container.innerHTML = data.topSongs.slice(0,5).map((s,i) =>
                '<div class="dashboard-list-item"><span class="dashboard-list-rank">' + (i+1) + '</span><span class="dashboard-list-name">' + (s.title||s.name||'Unknown') + '</span><span class="dashboard-list-count">' + (s.plays||s.count||0) + ' plays</span></div>'
            ).join('');
        }
        if (data.sectionUsage && data.sectionUsage.length) {
            const container = el('dashTopSections');
            if (container) container.innerHTML = data.sectionUsage.slice(0,5).map((s,i) =>
                '<div class="dashboard-list-item"><span class="dashboard-list-rank">' + (i+1) + '</span><span class="dashboard-list-name">' + (s.section||s.name||'Unknown') + '</span><span class="dashboard-list-count">' + (s.views||s.count||0) + ' views</span></div>'
            ).join('');
        }
        if (data.dailyPlays && typeof Chart !== 'undefined') {
            const ctx = document.getElementById('dashPlaysChart');
            if (ctx) {
                new Chart(ctx, {
                    type: 'bar',
                    data: { labels: data.dailyPlays.map(d => d.date || d.day), datasets: [{ label: 'Plays', data: data.dailyPlays.map(d => d.plays || d.count || 0), backgroundColor: 'rgba(139,92,246,0.6)', borderRadius: 4 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
                });
            }
        }
        if (data.categoryPlays && typeof Chart !== 'undefined') {
            const ctx2 = document.getElementById('dashCategoriesChart');
            if (ctx2) {
                new Chart(ctx2, {
                    type: 'doughnut',
                    data: { labels: data.categoryPlays.map(c => c.category || c.name), datasets: [{ data: data.categoryPlays.map(c => c.plays || c.count || 0), backgroundColor: ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899'] }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } } }
                });
            }
        }
    } catch (e) { console.warn('Dashboard analytics load failed:', e); }
}

function loadContentSectionStats() {
    try {
        const el = (id) => document.getElementById(id);
        if (el('csSongs')) el('csSongs').textContent = (DataStore.getSongs() || []).length;
        if (el('csFeatured')) el('csFeatured').textContent = (DataStore.getFeatured() || []).length;
        if (el('csTrending')) el('csTrending').textContent = (DataStore.getTrending() || []).length;
        if (el('csCategories')) el('csCategories').textContent = (DataStore.getCategories() || []).length;
        if (el('csArtistHits')) el('csArtistHits').textContent = (DataStore.getArtistHits() || []).length;
        if (el('csMovies')) el('csMovies').textContent = (DataStore.getMoviesCollections ? DataStore.getMoviesCollections() : []).length;
        if (el('csQuotes')) el('csQuotes').textContent = (DataStore.getQuotes() || []).length;
        if (el('csStations')) el('csStations').textContent = (DataStore.getStations() || []).length;
    } catch (e) {}
}

function refreshDashboardSyncStatus() {
    const container = document.getElementById('dashboardSyncStatus');
    if (!container) return;
    try {
        const songs = DataStore.getSongs() || [];
        const stations = DataStore.getStations() || [];
        const featured = DataStore.getFeatured() || [];
        const trending = DataStore.getTrending() || [];
        const categories = DataStore.getCategories() || [];
        const artistHits = DataStore.getArtistHits() || [];
        const moods = DataStore.getMoods() || [];
        const quotes = DataStore.getQuotes() || [];
        const images = DataStore.getImages() || [];
        const aiRadio = DataStore.getAIRadio() || [];
        const notifications = DataStore.getNotifications() || [];
        const advertisements = DataStore.getAdvertisements() || [];
        const musicCollections = DataStore.getMusicCollections() || [];
        const trash = DataStore.getTrash() || [];
        const deletedIds = DataStore.getDeletedIds() || {};
        const lastSynced = localStorage.getItem('tamilAIStream_lastSyncedAt');
        const lastPublished = localStorage.getItem('builderLastPublished');

        let totalDeleted = 0;
        Object.values(deletedIds).forEach(ids => { if (Array.isArray(ids)) totalDeleted += ids.length; });

        const totalItems = songs.length + stations.length + featured.length + trending.length +
            categories.length + artistHits.length + moods.length + quotes.length + images.length +
            aiRadio.length + notifications.length + advertisements.length + musicCollections.length;

        const contentTypes = [
            { label: 'Songs', count: songs.length, icon: 'fa-music', color: '#34d399' },
            { label: 'Stations', count: stations.length, icon: 'fa-radio', color: '#60a5fa' },
            { label: 'Featured', count: featured.length, icon: 'fa-star', color: '#f59e0b' },
            { label: 'Trending', count: trending.length, icon: 'fa-fire', color: '#ef4444' },
            { label: 'Categories', count: categories.length, icon: 'fa-folder', color: '#a78bfa' },
            { label: 'Artist Hits', count: artistHits.length, icon: 'fa-user', color: '#f472b6' },
            { label: 'Moods', count: moods.length, icon: 'fa-face-smile', color: '#38bdf8' },
            { label: 'Quotes', count: quotes.length, icon: 'fa-quote-left', color: '#fb923c' },
            { label: 'Images', count: images.length, icon: 'fa-images', color: '#34d399' },
            { label: 'AI Radio', count: aiRadio.length, icon: 'fa-robot', color: '#a78bfa' },
            { label: 'Notifications', count: notifications.length, icon: 'fa-bell', color: '#f59e0b' },
            { label: 'Ads', count: advertisements.length, icon: 'fa-ad', color: '#ef4444' },
            { label: 'Music Collections', count: musicCollections.length, icon: 'fa-compact-disc', color: '#60a5fa' }
        ];

        const syncStatus = lastSynced ? 'synced' : 'never';
        const publishStatus = lastPublished ? 'published' : 'draft';
        const syncRGB = lastSynced ? '52,211,153' : '245,158,11';
        const pubRGB = lastPublished ? '52,211,153' : '96,165,250';
        const syncColor = lastSynced ? '#34d399' : '#f59e0b';
        const pubColor = lastPublished ? '#34d399' : '#60a5fa';

        let html = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
                <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:800;color:#34d399;">${totalItems}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;">Total Items</div>
                </div>
                <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:800;color:#60a5fa;">${trash.length}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;">In Trash</div>
                </div>
                <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:800;color:#ef4444;">${totalDeleted}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;">Deleted IDs</div>
                </div>
                <div style="background:rgba(${syncRGB},0.08);border:1px solid rgba(${syncRGB},0.2);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:800;color:${syncColor};">${syncStatus === 'synced' ? 'Synced' : 'Never'}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;">Last Sync</div>
                    ${lastSynced ? '<div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:4px;">' + new Date(lastSynced).toLocaleString() + '</div>' : ''}
                </div>
                <div style="background:rgba(${pubRGB},0.08);border:1px solid rgba(${pubRGB},0.2);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:800;color:${pubColor};">${publishStatus === 'published' ? 'Live' : 'Draft'}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;">Publish Status</div>
                    ${lastPublished ? '<div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:4px;">' + new Date(parseInt(lastPublished)).toLocaleString() + '</div>' : ''}
                </div>
            </div>
            <div style="margin-bottom:12px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);">Content Breakdown</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">
        `;

        contentTypes.forEach(ct => {
            html += `
                <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;">
                    <i class="fas ${ct.icon}" style="color:${ct.color};font-size:12px;width:16px;text-align:center;"></i>
                    <span style="font-size:12px;color:rgba(255,255,255,0.6);flex:1;">${ct.label}</span>
                    <span style="font-size:13px;font-weight:700;color:${ct.count > 0 ? ct.color : 'rgba(255,255,255,0.3)'};">${ct.count}</span>
                </div>
            `;
        });

        html += '</div>';

        if (trash.length > 0) {
            html += `
                <div style="margin-top:16px;padding:12px;border-radius:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);">
                    <div style="font-size:12px;font-weight:600;color:#f59e0b;margin-bottom:6px;"><i class="fas fa-trash-can"></i> Trash (${trash.length} items)</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.45);">
                        Items auto-delete after 1 hour. Go to <strong>Trash</strong> page to restore or permanently delete.
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div style="color:#ef4444;font-size:13px;">Error loading sync status: ' + e.message + '</div>';
    }
}

async function loadAllSongs() {
    try {
        // Show loading state
        const tableBody = document.getElementById('allSongsTable');
        const contentTableBody = document.getElementById('contentSongsTable');
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-secondary);"><i class="fas fa-circle-notch fa-spin" style="margin-right:8px;"></i>Loading songsâ€¦</td></tr>';
        if (contentTableBody) contentTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary);"><i class="fas fa-circle-notch fa-spin" style="margin-right:8px;"></i>Loading songsâ€¦</td></tr>';

        let songs = DataStore.getSongs();
        // Filter out any songs that are in the deleted IDs list
        // This prevents R2 sync from re-adding deleted songs
        songs = _filterDeletedItems(songs, 'songs');
        songs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        previewSongList = songs;

        if (tableBody) tableBody.innerHTML = songs.length ? songs.map(song => createSongRow(song)).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-secondary);">No songs yet. Add a song or sync from R2.</td></tr>';

        if (contentTableBody) contentTableBody.innerHTML = songs.length ? songs.map(song => createSongRow(song)).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary);">No songs yet. Add a song or sync from R2.</td></tr>';

        const totalCount = document.getElementById('totalSongsCount');
        if (totalCount) totalCount.textContent = songs.length;
    } catch (error) {
        console.error('Error loading songs:', error);
        showToast('Error loading songs', 'error');
    }
}

// One-click import of every song file already sitting in Cloudflare R2.
// Reuses the existing R2 bucket + metadata store; no re-upload, no duplicates.
async function syncR2Songs() {
    const buttons = document.querySelectorAll('.sync-r2-btn');
    const originals = new Map();
    buttons.forEach(btn => {
        originals.set(btn, btn.innerHTML);
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Scanning R2â€¦';
    });

    try {
        if (typeof ContentSync === 'undefined' || typeof ContentSync.discoverR2Songs !== 'function') {
            showToast('R2 sync is unavailable â€” ContentSync not loaded', 'error');
            return;
        }

        AIUploadOverlay.show();
        AIUploadOverlay.update(5, 'Starting', 'Connecting to Cloudflare R2â€¦');

        const result = await Promise.race([
            ContentSync.discoverR2Songs((pct, phase, status) => {
                if (pct !== null && pct !== undefined) {
                    AIUploadOverlay.update(pct, phase || 'Syncing', status || 'Scanning R2â€¦');
                } else if (status) {
                    AIUploadOverlay.update(null, null, status);
                }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('R2 sync timed out after 120 seconds')), 120000))
        ]);

        AIUploadOverlay.update(95, 'Updating', 'Reloading song listâ€¦');
        await loadAllSongs();

        if (result.added > 0) {
            AIUploadOverlay.success(result.added + ' song(s) imported from R2');
            showToast(result.added + ' song(s) detected in Cloudflare R2 and added to Content', 'success');
        } else {
            AIUploadOverlay.success('Already in sync â€” ' + result.total + ' song(s)');
            showToast('Already in sync â€” ' + result.total + ' song(s) available', 'info');
        }

        if (typeof syncToLiveWebsite === 'function') await syncToLiveWebsite();
        addActivity('R2 Sync', 'Synchronized song library with Cloudflare R2 (' + result.total + ' songs, ' + (result.scanned || 0) + ' scanned)');
    } catch (e) {
        console.error('R2 sync error:', e);
        try { AIUploadOverlay.error('Sync failed: ' + e.message); } catch (_) {}
        showToast('R2 sync failed: ' + e.message, 'error');
    } finally {
        buttons.forEach(btn => {
            btn.disabled = false;
            if (originals.has(btn)) btn.innerHTML = originals.get(btn);
        });
    }
}

// Restore ALL existing R2 songs into the Builder + database.
// Unlike syncR2Songs which only discovers new files, this forces a full
// re-scan and restores every R2 audio file with correct metadata.
async function restoreAllR2Songs() {
    const buttons = document.querySelectorAll('.restore-r2-btn');
    const originals = new Map();
    buttons.forEach(btn => {
        originals.set(btn, btn.innerHTML);
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Restoringâ€¦';
    });

    try {
        if (typeof ContentSync === 'undefined' || typeof ContentSync.discoverR2Songs !== 'function') {
            showToast('R2 restore is unavailable â€” ContentSync not loaded', 'error');
            return;
        }

        AIUploadOverlay.show();
        AIUploadOverlay.update(3, 'Preparing', 'Scanning all R2 audio files for full restoreâ€¦');

        const result = await Promise.race([
            ContentSync.discoverR2Songs((pct, phase, status) => {
                if (pct !== null && pct !== undefined) {
                    AIUploadOverlay.update(pct, phase || 'Restoring', status || 'Scanning R2â€¦');
                } else if (status) {
                    AIUploadOverlay.update(null, null, status);
                }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('R2 restore timed out after 120 seconds')), 120000))
        ]);

        AIUploadOverlay.update(92, 'Verifying', 'Checking audio URLs and metadataâ€¦');

        // Verify all songs have correct audio URLs and metadata
        const songs = DataStore.getSongs() || [];
        let fixedCount = 0;
        const updatedSongs = songs.map(song => {
            if (!song) return song;
            const updates = {};
            // Ensure audioUrl is set correctly from r2Key
            if (song.r2Key && (!song.audioUrl || song.audioUrl === '')) {
                updates.audioUrl = '/api/media/' + encodeURIComponent(song.r2Key).replace(/%2F/g, '/');
            }
            // Ensure src is set
            if (song.r2Key && (!song.src || song.src === '')) {
                updates.src = updates.audioUrl || ('/api/media/' + encodeURIComponent(song.r2Key).replace(/%2F/g, '/'));
            }
            // Ensure status is published
            if (!song.status || song.status === 'draft') {
                updates.status = 'published';
            }
            // Ensure source is marked as r2
            if (!song.source) {
                updates.source = 'r2';
            }
            if (Object.keys(updates).length > 0) {
                fixedCount++;
                return { ...song, ...updates };
            }
            return song;
        });

        if (fixedCount > 0) {
            DataStore.setSongs(updatedSongs);
            localStorage.setItem('tamilAIStream_songs', JSON.stringify(updatedSongs));
        }

        AIUploadOverlay.update(96, 'Syncing', 'Updating song list and live websiteâ€¦');
        await loadAllSongs();

        const total = result ? result.total : updatedSongs.length;
        const added = result ? result.added : 0;
        AIUploadOverlay.success('Restored ' + total + ' song(s) from R2 (' + added + ' new, ' + fixedCount + ' metadata fixed)');
        showToast(total + ' song(s) restored from R2 â€” ' + added + ' newly added', 'success');

        if (typeof syncToLiveWebsite === 'function') await syncToLiveWebsite();
        addActivity('R2 Restore', 'Full restore of ' + total + ' song(s) from Cloudflare R2');
    } catch (e) {
        console.error('R2 restore error:', e);
        try { AIUploadOverlay.error('Restore failed: ' + e.message); } catch (_) {}
        showToast('R2 restore failed: ' + e.message, 'error');
    } finally {
        buttons.forEach(btn => {
            btn.disabled = false;
            if (originals.has(btn)) btn.innerHTML = originals.get(btn);
        });
    }
}

function createSongRow(song) {
    const thumb = song.albumCover || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Ccircle cx="40" cy="40" r="30" fill="%2334d399" opacity="0.3"/%3E%3C/svg%3E';
    return `
        <tr>
            <td>
                <div class="song-thumb">
                    <img src="${thumb}" alt="${song.title}" loading="lazy">
                </div>
            </td>
            <td>
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-meta">${song.language || 'Tamil'}</div>
                </div>
            </td>
            <td>${song.artist || 'N/A'}</td>
            <td>${song.movie || 'N/A'}</td>
            <td>${song.duration || 'N/A'}</td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="editSong('${song.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="previewSong('${song.id}')" title="Preview">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteSong('${song.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

async function saveSong(e) {
    e.preventDefault();
    
    const title = document.getElementById('songTitle').value.trim();
    const artist = document.getElementById('songArtist').value.trim();
    const movie = document.getElementById('songMovie').value.trim();
    
    if (!title || !artist || !movie) {
        showToast('Please fill in Title, Artist, and Movie', 'error');
        return;
    }
    
    const songData = {
        title: title,
        artist: artist,
        movie: movie,
        director: document.getElementById('songDirector').value.trim(),
        singer: document.getElementById('songSinger').value.trim(),
        language: document.getElementById('songLanguage').value,
        genre: document.getElementById('songGenre').value,
        year: parseInt(document.getElementById('songYear').value, 10) || null,
        decade: document.getElementById('songDecade').value || '',
        duration: document.getElementById('songDuration').value.trim(),
        description: document.getElementById('songDescription').value.trim(),
        status: 'published',
                        updatedAt: new Date().toISOString(),
        createdBy: currentUser?.uid || 'unknown'
    };

    try {
        AIUploadOverlay.show();
        AIUploadOverlay.update(2, 'Preparing', 'Validating song dataâ€¦');
        showToast('Saving song...', 'info');

        const albumFile = document.getElementById('albumImage').files[0];
        if (albumFile) {
            const albumSizeMB = (albumFile.size / (1024 * 1024)).toFixed(1);
            AIUploadOverlay.update(3, 'Album cover', 'Uploading ' + albumFile.name + ' (' + albumSizeMB + ' MB)â€¦');
            try {
                const albumResult = await R2Uploader.uploadImage(albumFile, 'tamil-ai-stream/albums', (pct) => {
                    AIUploadOverlay.update(3 + pct * 0.3, 'Album cover', 'Uploading coverâ€¦ ' + pct + '% (' + albumSizeMB + ' MB)');
                });
                songData.albumCover = albumResult.url;
                songData.albumPublicId = albumResult.publicId;
                AIUploadOverlay.update(33, 'Album cover', 'Cover uploaded successfully');
            } catch (err) {
                console.warn('Album upload failed:', err);
                showToast('Album cover upload failed: ' + err.message, 'error');
                AIUploadOverlay.update(33, 'Album cover', 'Cover upload failed â€” continuing without cover');
            }
        }

        const audioFile = document.getElementById('audioFile').files[0];
        if (audioFile) {
            const audioSizeMB = (audioFile.size / (1024 * 1024)).toFixed(1);
            AIUploadOverlay.update(35, 'Audio', 'Uploading ' + audioFile.name + ' (' + audioSizeMB + ' MB)â€¦');
            try {
                const audioResult = await R2Uploader.uploadAudio(audioFile, 'tamil-ai-stream/audio', (pct) => {
                    AIUploadOverlay.update(35 + pct * 0.6, 'Audio', 'Uploading audioâ€¦ ' + pct + '% (' + audioSizeMB + ' MB)');
                });
                songData.audioUrl = audioResult.url;
                songData.audioPublicId = audioResult.publicId;
                songData.audioFormat = audioResult.format;
                songData.audioSize = audioResult.bytes;
                songData.audioFileName = audioFile.name;
                AIUploadOverlay.update(95, 'Audio', 'Audio uploaded successfully');
            } catch (err) {
                console.error('Audio upload error:', err);
                AIUploadOverlay.error('Audio upload failed: ' + err.message);
                showToast('Audio upload failed: ' + err.message, 'error');
                return;
            }
        }

        AIUploadOverlay.update(96, 'Saving', 'Saving to databaseâ€¦');

        const songs = DataStore.getSongs();

        // AI Duplicate Detection before saving
        if (!currentSongId && typeof AIAutomation !== 'undefined') {
            const probe = {
                title: songData.title,
                artist: songData.artist,
                movie: songData.movie,
                hash: window._pendingSongHash || '',
                duration: parseFloat(songData.duration) || 0
            };
            const dupes = AIAutomation.detectDuplicates(probe, songs);
            if (dupes.length > 0) {
                const top = dupes[0];
                if (top.score >= 90) {
                    const proceed = confirm(
                        'High confidence duplicate detected!\n\n' +
                        'New: "' + songData.title + '" by ' + songData.artist + '\n' +
                        'Existing: "' + top.song.title + '" by ' + top.song.artist + ' (' + top.score + '% match)\n\n' +
                        'Save anyway?'
                    );
                    if (!proceed) {
                        AIUploadOverlay.hide();
                        showToast('Save cancelled â€” duplicate detected', 'info');
                        return;
                    }
                } else if (top.score >= 70) {
                    showToast('Note: Possible duplicate with "' + top.song.title + '" (' + top.score + '% match)', 'info');
                }
            }
        }

        // Store AI-generated metadata
        songData.hash = window._pendingSongHash || songData.hash || '';
        window._pendingSongHash = null;
        window._pendingSongMeta = null;

        if (currentSongId) {
            const idx = songs.findIndex(s => s.id === currentSongId);
            if (idx !== -1) {
                songs[idx] = { ...songs[idx], ...songData };
            }
        } else {
            songData.id = 'song_' + Date.now();
            songData.createdAt = new Date().toISOString();
            songData.plays = 0;
            songs.push(songData);
        }

        DataStore.setSongs(songs);

        AIUploadOverlay.update(98, 'Publishing', 'Syncing to live websiteâ€¦');
        await syncToLiveWebsite();

        AIUploadOverlay.success('Song saved and published!');
        showToast('Song saved and published to live website!', 'success');
        resetSongForm();
        loadAllSongs();
        addActivity('Song Added', 'Added "' + songData.title + '"');
    } catch (error) {
        console.error('Error saving song:', error);
        AIUploadOverlay.error('Error: ' + error.message);
        showToast('Error: ' + error.message, 'error');
    }
}

async function editSong(songId) {
    try {
        const songs = DataStore.getSongs();
        const song = songs.find(s => s.id === songId);
        if (song) {
            currentSongId = songId;
            
            document.getElementById('songTitle').value = song.title || '';
            document.getElementById('songArtist').value = song.artist || '';
            document.getElementById('songMovie').value = song.movie || '';
            document.getElementById('songDirector').value = song.director || '';
            document.getElementById('songSinger').value = song.singer || '';
            document.getElementById('songLanguage').value = song.language || 'Tamil';
            document.getElementById('songGenre').value = song.genre || 'Love';
            document.getElementById('songYear').value = song.year || '';
            document.getElementById('songDecade').value = song.decade || '';
            document.getElementById('songDuration').value = song.duration || '';
            document.getElementById('songDescription').value = song.description || '';

            if (song.albumCover) {
                document.getElementById('albumPreviewImg').src = song.albumCover;
                document.getElementById('albumPreview').style.display = 'flex';
            }

            showToast('Song loaded for editing', 'info');
            navigateTo('songs');
        }
    } catch (error) {
        console.error('Error loading song:', error);
        showToast('Error loading song', 'error');
    }
}

async function deleteSong(songId) {
    if (!confirm('Move this song to Trash?')) return;
    
    try {
        // Use RAW data to find the song (getSongs() now filters deleted items)
        const rawSongs = DataStore._getRaw(DataStore.KEYS.SONGS) || [];
        const song = rawSongs.find(s => s.id === songId);
        if (!song) { showToast('Song not found', 'error'); return; }
        
        DataStore.moveToTrash(song, 'songs');
        const filtered = rawSongs.filter(s => s.id !== songId);
        localStorage.setItem(DataStore.KEYS.SONGS, JSON.stringify(filtered));
        showToast('Song moved to Trash', 'success');
        loadAllSongs();
        await syncToLiveWebsite();
        addActivity('Song Trashed', 'Moved "' + (song.title || 'Unknown') + '" to Trash');
    } catch (error) {
        console.error('Error trashing song:', error);
        showToast('Error moving song to trash', 'error');
    }
}

let previewAudioEl = null;
let previewPlaying = false;
let previewSongList = [];
let previewCurrentIdx = -1;

async function previewSong(songId) {
    try {
        const songs = DataStore.getSongs();
        const song = songs.find(s => s.id === songId);
        if (!song) {
            showToast('Song not found', 'error');
            return;
        }
        
        let audioSrc = song.audioUrl;
        
        if (!audioSrc) {
            showToast('No audio file for this song', 'error');
            return;
        }
        
        console.log('Attempting to play:', audioSrc);
        
        const playerEl = document.getElementById('previewPlayer');
        const playBtn = document.getElementById('previewPlayPause');
        
        document.getElementById('previewTitle').textContent = song.title || 'Untitled';
        document.getElementById('previewArtist').textContent = (song.artist || '') + ' â€¢ ' + (song.movie || '');
        document.getElementById('previewThumb').style.backgroundImage = song.albumCover ? 'url(' + song.albumCover + ')' : '';
        
        playerEl.style.display = 'flex';
        
        previewCurrentIdx = previewSongList.findIndex(s => s.id === songId);
        if (previewCurrentIdx === -1) previewCurrentIdx = 0;
        
        const audio = document.getElementById('previewAudio');
        if (!audio) {
            showToast('Audio player not found', 'error');
            return;
        }
        
        audio.pause();
        audio.src = audioSrc;
        audio.volume = 1.0;
        
        setupPreviewPlayer();
        
        try {
            await audio.play();
            previewPlaying = true;
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            showToast('Playing: ' + song.title, 'success');
        } catch (err) {
            console.error('Play error:', err);
            showToast('Click the play button to start playback', 'info');
        }
    } catch (error) {
        console.error('Error previewing song:', error);
        showToast('Error: ' + (error.message || 'Could not play audio'), 'error');
    }
}

function setupPreviewPlayer() {
    const audio = document.getElementById('previewAudio');
    const playBtn = document.getElementById('previewPlayPause');
    const prevBtn = document.getElementById('previewPrev');
    const nextBtn = document.getElementById('previewNext');
    const closeBtn = document.getElementById('previewClose');
    const progressBar = document.getElementById('previewProgressBar');
    const volumeBar = document.getElementById('previewVolumeBar');

    window.togglePreviewPlayPause = async function() {
        if (!audio || !audio.src || audio.src === location.href) return;
        if (!audio.paused) {
            audio.pause();
            previewPlaying = false;
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
        } else {
            try {
                const p = audio.play();
                if (p) await p;
                previewPlaying = true;
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } catch (err) {
                console.error('Resume error:', err);
                showToast('Could not resume playback', 'error');
            }
        }
    };

    if (playBtn) {
        playBtn.onclick = window.togglePreviewPlayPause;
    }

    prevBtn?.addEventListener('click', async () => {
        if (previewSongList.length === 0) return;
        previewCurrentIdx = (previewCurrentIdx - 1 + previewSongList.length) % previewSongList.length;
        await previewSong(previewSongList[previewCurrentIdx].id);
    });

    nextBtn?.addEventListener('click', async () => {
        if (previewSongList.length === 0) return;
        previewCurrentIdx = (previewCurrentIdx + 1) % previewSongList.length;
        await previewSong(previewSongList[previewCurrentIdx].id);
    });

    closeBtn?.addEventListener('click', () => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        previewPlaying = false;
        document.getElementById('previewPlayer').style.display = 'none';
    });

    audio?.addEventListener('timeupdate', () => {
        if (audio.duration) {
            progressBar.value = (audio.currentTime / audio.duration) * 100;
            document.getElementById('previewCurrentTime').textContent = formatTime(audio.currentTime);
            document.getElementById('previewDuration').textContent = formatTime(audio.duration);
        }
    });

    progressBar?.addEventListener('input', () => {
        if (audio.duration) {
            audio.currentTime = (progressBar.value / 100) * audio.duration;
        }
    });

    audio?.addEventListener('ended', async () => {
        previewPlaying = false;
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        if (previewSongList.length > 0) {
            previewCurrentIdx = (previewCurrentIdx + 1) % previewSongList.length;
            await previewSong(previewSongList[previewCurrentIdx].id);
        }
    });

    volumeBar?.addEventListener('input', () => {
        audio.volume = volumeBar.value / 100;
    });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function resetSongForm() {
    document.getElementById('songForm').reset();
    currentSongId = null;
    uploadedAlbumUrl = null;
    uploadedAudioUrl = null;
    document.getElementById('albumPreview').style.display = 'none';
    document.getElementById('audioPreview').style.display = 'none';
}

// ============================================
// Quick Add Song Modal
// ============================================
function openAddSongModal() {
    document.getElementById('addSongModal').style.display = 'flex';
}

function closeAddSongModal() {
    document.getElementById('addSongModal').style.display = 'none';
    document.getElementById('quickSongForm').reset();
}

async function saveQuickSong(e) {
    e.preventDefault();
    
    const songData = {
        id: 'song_' + Date.now(),
        title: document.getElementById('quickSongTitle').value,
        artist: document.getElementById('quickSongArtist').value,
        movie: document.getElementById('quickSongMovie').value,
        audioUrl: document.getElementById('quickSongAudioUrl').value,
        albumCover: document.getElementById('quickSongCoverUrl').value || '',
        status: 'published',
        createdAt: new Date().toISOString(),
        plays: 0,
        language: 'Tamil',
        genre: 'Love',
        createdBy: currentUser?.uid || 'unknown'
    };

    try {
        showToast('Adding song...', 'info');
        const songs = DataStore.getSongs();
        songs.push(songData);
        DataStore.setSongs(songs);
        closeAddSongModal();
        await syncToLiveWebsite();
        loadAllSongs();
        showToast('Song added and published!', 'success');
        addActivity('Quick Add', 'Added "' + songData.title + '" via quick add');
    } catch (error) {
        console.error('Error adding song:', error);
        showToast('Error adding song: ' + error.message, 'error');
    }
}

// ============================================
// Image Management
// ============================================
function openUploadImageModal() {
    document.getElementById('uploadImageModal').style.display = 'flex';
}

function closeUploadImageModal() {
    document.getElementById('uploadImageModal').style.display = 'none';
    document.getElementById('uploadImageForm').reset();
    document.getElementById('modalImagePreview').style.display = 'none';
}

async function loadAllImages() {
    try {
        const images = DataStore.getImages();
        images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        uploadedImages = images;
        
        renderImageGallery(uploadedImages);
        document.getElementById('totalImages').textContent = uploadedImages.length;
    } catch (error) {
        console.error('Error loading images:', error);
        showToast('Error loading images', 'error');
    }
}

function renderImageGallery(images) {
    const gallery = document.getElementById('imageGallery');
    const emptyState = document.getElementById('galleryEmpty');
    
    if (images.length === 0) {
        gallery.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    gallery.innerHTML = images.map(img => createImageCard(img)).join('');
}

function createImageCard(img) {
    const categoryColors = {
        'album': '#34d399',
        'banner': '#60a5fa',
        'artist': '#f472b6',
        'other': '#a78bfa'
    };
    const color = categoryColors[img.category] || '#34d399';
    
    return `
        <div class="image-card" data-id="${img.id}">
            <div class="image-card-thumb" onclick="openImagePreview('${img.id}')">
                <img src="${img.url}" alt="${img.title || 'Image'}" loading="lazy">
                <div class="image-card-overlay">
                    <i class="fas fa-expand"></i>
                </div>
            </div>
            <div class="image-card-info">
                <div class="image-card-title">${img.title || 'Untitled'}</div>
                <div class="image-card-meta">
                    <span class="image-category-badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">
                        ${img.category || 'other'}
                    </span>
                    <span class="image-card-size">${img.size || '-'}</span>
                </div>
            </div>
            <div class="image-card-actions">
                <button class="action-btn" onclick="copyImageLink('${img.id}')" title="Copy URL">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn delete" onclick="deleteImage('${img.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

async function uploadImage(file, category, title) {
    try {
        showToast('Uploading image to R2...', 'info');
        
        const folderMap = {
            'album': 'tamil-ai-stream/albums',
            'banner': 'tamil-ai-stream/banners',
            'artist': 'tamil-ai-stream/artists',
            'other': 'tamil-ai-stream/images'
        };
        
        const result = await R2Uploader.uploadImage(file, folderMap[category] || 'tamil-ai-stream/images', (pct) => {
            showToast('Uploading: ' + pct + '%', 'info');
        });
        
        const imageData = {
            id: 'img_' + Date.now(),
            url: result.url,
            publicId: result.publicId,
            title: title || file.name,
            category: category || 'other',
            format: result.format,
            width: result.width,
            height: result.height,
            fileName: file.name,
            size: formatFileSize(file.size),
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.uid || 'unknown'
        };
        
        const images = DataStore.getImages();
        images.push(imageData);
        DataStore.setImages(images);
        
        showToast('Image uploaded successfully!', 'success');
        addActivity('Image Uploaded', 'Uploaded "' + (title || file.name) + '"');
        loadAllImages();
        syncToLiveWebsite();
        
    } catch (error) {
        console.error('Error uploading image:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

async function uploadFeaturedImage(input) {
    const file = input.files[0];
    if (!file) return;
    try {
        showToast('Uploading image...', 'info');
        const result = await R2Uploader.upload(file, 'tamil-ai-stream/featured');
        const urlInput = document.getElementById('featuredThumbnail');
        if (urlInput) urlInput.value = result.url;
        const preview = document.getElementById('featuredThumbnailPreview');
        const img = document.getElementById('featuredThumbnailImg');
        if (preview && img) { img.src = result.url; preview.style.display = 'block'; }
        showToast('Image uploaded!', 'success');
    } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
    }
    input.value = '';
}

async function uploadTrendingImage(input) {
    const file = input.files[0];
    if (!file) return;
    try {
        showToast('Uploading image...', 'info');
        const result = await R2Uploader.upload(file, 'tamil-ai-stream/trending');
        const urlInput = document.getElementById('trendingThumbnail');
        if (urlInput) urlInput.value = result.url;
        const preview = document.getElementById('trendingThumbnailPreview');
        const img = document.getElementById('trendingThumbnailImg');
        if (preview && img) { img.src = result.url; preview.style.display = 'block'; }
        showToast('Image uploaded!', 'success');
    } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
    }
    input.value = '';
}

async function deleteImage(imageId) {
    if (!confirm('Move this image to Trash?')) return;
    
    try {
        const rawImages = DataStore._getRaw(DataStore.KEYS.IMAGES) || [];
        const imgData = rawImages.find(i => i.id === imageId);
        if (!imgData) { showToast('Image not found', 'error'); return; }
        DataStore.moveToTrash(imgData, 'images');
        const filtered = rawImages.filter(i => i.id !== imageId);
        localStorage.setItem(DataStore.KEYS.IMAGES, JSON.stringify(filtered));
        
        showToast('Image moved to Trash', 'success');
        await syncToLiveWebsite();
        addActivity('Image Trashed', 'Moved "' + (imgData.title || 'Unknown') + '" to Trash');
        loadAllImages();
    } catch (error) {
        console.error('Error trashing image:', error);
        showToast('Error moving image to trash', 'error');
    }
}

function openImagePreview(imageId) {
    const img = uploadedImages.find(i => i.id === imageId);
    if (!img) return;
    
    currentPreviewImage = img;
    
    document.getElementById('previewImageTitle').textContent = img.title || 'Image Preview';
    document.getElementById('previewImageSrc').src = img.url;
    document.getElementById('previewImageCategory').textContent = img.category || 'other';
    document.getElementById('previewImageSizeInfo').textContent = img.size || '-';
    document.getElementById('previewImageUrl').textContent = img.url;
    
    document.getElementById('imagePreviewModal').style.display = 'flex';
}

function closeImagePreviewModal() {
    document.getElementById('imagePreviewModal').style.display = 'none';
    currentPreviewImage = null;
}

function copyImageUrl() {
    if (currentPreviewImage) {
        navigator.clipboard.writeText(currentPreviewImage.url).then(() => {
            showToast('Image URL copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy URL', 'error');
        });
    }
}

function copyImageLink(imageId) {
    const img = uploadedImages.find(i => i.id === imageId);
    if (img) {
        navigator.clipboard.writeText(img.url).then(() => {
            showToast('Image URL copied!', 'success');
        }).catch(() => {
            showToast('Failed to copy URL', 'error');
        });
    }
}

function downloadImage() {
    if (currentPreviewImage) {
        const link = document.createElement('a');
        link.href = currentPreviewImage.url;
        link.download = currentPreviewImage.fileName || 'image';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function deleteImageFromPreview() {
    if (currentPreviewImage) {
        const imageId = currentPreviewImage.id;
        closeImagePreviewModal();
        deleteImage(imageId);
    }
}

// Filter images by category
function filterImages(category) {
    if (category === 'all') {
        renderImageGallery(uploadedImages);
    } else {
        const filtered = uploadedImages.filter(img => img.category === category);
        renderImageGallery(filtered);
    }
}

// Search images
function searchImages(query) {
    const filtered = uploadedImages.filter(img => 
        (img.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (img.category || '').toLowerCase().includes(query.toLowerCase())
    );
    renderImageGallery(filtered);
}

// ============================================
// Preview Functions
// ============================================
function updatePreview() {
    previewCount++;
    document.getElementById('totalViews').textContent = previewCount;
}

function refreshPreview() {
    const iframe = document.getElementById('previewFrame');
    iframe.src = iframe.src;
    updatePreview();
    addActivity('Preview Refreshed', 'Website preview has been refreshed');
}

function openInNewTab() {
    window.location.href = 'index.html';
    addActivity('Preview Opened', 'Opened website preview');
}

// ============================================
// Export & Publish
// ============================================
function exportWebsite() {
    showToast('Preparing website export...', 'info');
    
    const exportData = {
        sections: websiteSections,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "tamil-ai-stream-website.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    showToast('Website exported successfully!', 'success');
    addActivity('Website Exported', 'Website configuration has been exported');
}

// ============================================
// Publishing Workflow
// ============================================
function getPublishState() {
    try {
        const state = localStorage.getItem('publishState');
        const history = localStorage.getItem('publishHistory');
        if (state) publishState = state;
        if (history) publishHistory = JSON.parse(history);
    } catch (e) {
        console.error('Error loading publish state:', e);
    }
}

function savePublishState() {
    try {
        localStorage.setItem('publishState', publishState);
        localStorage.setItem('publishHistory', JSON.stringify(publishHistory));
    } catch (e) {
        console.error('Error saving publish state:', e);
    }
}

function applySavedSettingsToWebsite() {
    try {
        const settings = DataStore.getSiteSettings();
        if (settings && settings.title) {
            document.title = settings.title;
        }
        const themeColor = settings.themeColor;
        if (themeColor) {
            let meta = document.querySelector('meta[name="theme-color"]');
            if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
            meta.content = themeColor;
        }
    } catch (e) {
        console.warn('applySavedSettingsToWebsite:', e);
    }
}

async function _syncToLiveWebsiteActual() {
    try {
        localStorage.setItem('tamilAIStream_lastSyncedAt', new Date().toISOString());
        localStorage.setItem('builderLastPublished', Date.now().toString());

        if (window.ContentSync && typeof window.ContentSync.syncCurrentState === 'function') {
            await window.ContentSync.syncCurrentState();
        }

        window.dispatchEvent(new Event('storage-sync'));

        const keysToSync = [
            'tamilAIStream_songs', 'tamilAIStream_stations', 'tamilAIStream_categories',
            'tamilAIStream_featured', 'tamilAIStream_trending', 'tamilAIStream_artistHits',
            'tamilAIStream_quotes', 'tamilAIStream_siteSettings', 'tamilAIStream_navigation',
            'tamilAIStream_sectionsOrder', 'tamilAIStream_sectionSettings', 'tamilAIStream_logoSettings', 'tamilAIStream_entranceLogo', 'tamilAIStream_miniPlayerSettings',
            'tamilAIStream_playerPrefs', 'tamilAIStream_advertisements', 'tamilAIStream_splash',
            'tamilAIStream_moods', 'tamilAIStream_aiRadio', 'tamilAIStream_notifications',
            'tamilAIStream_images', 'tamilAIStream_moviesCollections',
            'tamilAIStream_yearlyCollections', 'tamilAIStream_latestCollections',
            'tamilAIStream_musicCollections', 'tamilAIStream_upcomingReleases',
            'tamilAIStream_songsCollections', 'tamilAIStream_newAlbums',
            'tamilAIStream_deletedIds', 'tamilAIStream_trash'
        ];

        keysToSync.forEach(key => {
            try { localStorage.setItem(key, localStorage.getItem(key) || 'null'); } catch (e) {}
        });

        const syncEvent = new CustomEvent('storage-sync', { detail: { keys: keysToSync } });
        window.dispatchEvent(syncEvent);

        try {
            const channel = new BroadcastChannel('tamilAIStream_sync');
            channel.postMessage({ type: 'content-updated', timestamp: Date.now() });
            setTimeout(() => channel.close(), 100);
        } catch (e) {}

        window.dispatchEvent(new CustomEvent('premium-sections-sync', { detail: { timestamp: Date.now() } }));

        if (typeof applySavedSettingsToWebsite === 'function') applySavedSettingsToWebsite();

        return true;
    } catch (e) {
        console.error('Error in syncToLiveWebsite:', e);
        return false;
    }
}

// Debounced wrapper â€” batches rapid-fire sync calls into one per 400ms
function syncToLiveWebsite() {
    if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(() => {
        _syncDebounceTimer = null;
        _syncToLiveWebsiteActual();
    }, 400);
}

// Immediate sync bypass for explicit user actions (publish button)
function syncToLiveWebsiteImmediate() {
    if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = null;
    return _syncToLiveWebsiteActual();
}

function saveDraft() {
    showToast('Saving draft...', 'info');
    try {
        const draftData = {
            songs: DataStore.getSongs(),
            stations: DataStore.getStations(),
            categories: DataStore.getCategories(),
            featured: DataStore.getFeatured(),
            trending: DataStore.getTrending(),
            artistHits: DataStore.getArtistHits(),
            quotes: DataStore.getQuotes(),
            siteSettings: DataStore.getSiteSettings(),
            layout: DataStore.getLayout(),
            websiteSections: websiteSections,
            images: DataStore.getImages(),
            moods: DataStore.getMoods(),
            aiRadio: DataStore.getAIRadio(),
            notifications: DataStore.getNotifications(),
            splash: DataStore.getSplash(),
            playerPrefs: DataStore.getPlayerPrefs(),
            navigation: DataStore.getNavigation(),
            sectionsOrder: DataStore.getSectionsOrder(),
            miniPlayerSettings: DataStore.getMiniPlayerSettings(),
            advertisements: DataStore.getAdvertisements(),
            songsCollections: DataStore.getSongsCollections(),
            newAlbums: DataStore.getNewAlbums(),
            savedAt: new Date().toISOString()
        };
        localStorage.setItem('builderDraft', JSON.stringify(draftData));
        localStorage.setItem('builderLastSaved', Date.now().toString());
        publishState = 'draft';
        savePublishState();
        showToast('Draft saved successfully!', 'success');
        addActivity('Draft Saved', 'Website changes saved as draft');
        updatePublishUI();
    } catch (error) {
        console.error('Save draft error:', error);
        showToast('Failed to save draft: ' + error.message, 'error');
    }
}

async function publishChanges() {
    const progressContainer = document.getElementById('deployProgressContainer');
    const progressBar = document.getElementById('deployProgressBar');
    const progressLabel = document.getElementById('deployProgressLabel');
    const progressPct = document.getElementById('deployProgressPct');
    const progressIcon = document.getElementById('deployProgressIcon');

    function setProgress(pct, label) {
        if (progressBar) progressBar.style.width = pct + '%';
        if (progressPct) progressPct.textContent = pct + '%';
        if (progressLabel) progressLabel.textContent = label;
        if (progressIcon) progressIcon.className = pct < 100 ? 'fas fa-rocket fa-spin' : 'fas fa-check-circle';
        if (progressBar) progressBar.style.background = pct >= 100 ? '#10b981' : 'linear-gradient(90deg,#10b981,#3b82f6)';
    }

    try {
        if (progressContainer) progressContainer.style.display = 'block';
        setProgress(5, 'Preparing content...');

        await new Promise(r => setTimeout(r, 100));
        setProgress(15, 'Building content payload...');

        if (window.ContentSync && typeof window.ContentSync.syncCurrentState === 'function') {
            setProgress(30, 'Uploading to production...');
            await window.ContentSync.syncCurrentState();
        } else {
            setProgress(30, 'Syncing to live site...');
            await _syncToLiveWebsiteActual();
        }

        setProgress(55, 'Saving local state...');
        localStorage.setItem('tamilAIStream_lastSyncedAt', new Date().toISOString());
        localStorage.setItem('builderLastPublished', Date.now().toString());

        const keysToSync = [
            'tamilAIStream_songs', 'tamilAIStream_stations', 'tamilAIStream_categories',
            'tamilAIStream_featured', 'tamilAIStream_trending', 'tamilAIStream_artistHits',
            'tamilAIStream_quotes', 'tamilAIStream_siteSettings', 'tamilAIStream_navigation',
            'tamilAIStream_sectionsOrder', 'tamilAIStream_sectionSettings', 'tamilAIStream_logoSettings', 'tamilAIStream_entranceLogo', 'tamilAIStream_miniPlayerSettings',
            'tamilAIStream_playerPrefs', 'tamilAIStream_advertisements', 'tamilAIStream_splash',
            'tamilAIStream_moods', 'tamilAIStream_aiRadio', 'tamilAIStream_notifications',
            'tamilAIStream_images', 'tamilAIStream_moviesCollections',
            'tamilAIStream_yearlyCollections', 'tamilAIStream_latestCollections',
            'tamilAIStream_musicCollections', 'tamilAIStream_upcomingReleases',
            'tamilAIStream_songsCollections', 'tamilAIStream_newAlbums',
            'tamilAIStream_deletedIds', 'tamilAIStream_trash'
        ];
        keysToSync.forEach(key => {
            try { localStorage.setItem(key, localStorage.getItem(key) || 'null'); } catch (e) {}
        });

        setProgress(65, 'Clearing browser caches...');
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    await caches.delete(name);
                }
            } catch (e) { /* ignore */ }
        }

        setProgress(75, 'Notifying live tabs...');
        try {
            const channel = new BroadcastChannel('tamilAIStream_sync');
            channel.postMessage({ type: 'content-updated', timestamp: Date.now() });
            setTimeout(() => channel.close(), 100);
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('storage-sync', { detail: { keys: keysToSync } }));
        window.dispatchEvent(new CustomEvent('premium-sections-sync', { detail: { timestamp: Date.now() } }));

        setProgress(85, 'Verifying deployment...');
        try {
            const verifyResp = await fetch('/api/deploy-verify?t=' + Date.now(), { cache: 'no-store' });
            if (verifyResp.ok) {
                const verifyData = await verifyResp.json();
                if (verifyData.ok) {
                    setProgress(95, 'Verified — ' + verifyData.songCount + ' songs, ' + verifyData.stationCount + ' stations live');
                }
            }
        } catch (e) { /* verification is best-effort */ }

        await new Promise(r => setTimeout(r, 300));
        setProgress(100, 'All changes are live!');

        localStorage.removeItem('tamilAIStream_lastSyncedAt');

        const publishEntry = {
            id: 'pub_' + Date.now(),
            date: new Date().toISOString(),
            status: 'published',
            changes: {
                songs: DataStore.getSongs().length,
                stations: DataStore.getStations().length,
                categories: DataStore.getCategories().length,
                featured: DataStore.getFeatured().length,
                trending: DataStore.getTrending().length,
                artistHits: DataStore.getArtistHits().length,
                quotes: DataStore.getQuotes().length,
                sections: DataStore.getLayout().length,
                miniPlayer: Object.keys(DataStore.getMiniPlayerSettings()).length > 0,
                advertisements: DataStore.getAdvertisements().length
            }
        };
        publishHistory.unshift(publishEntry);
        if (publishHistory.length > 50) publishHistory = publishHistory.slice(0, 50);
        publishState = 'published';
        savePublishState();
        addActivity('Website Published', 'All changes have been published live');

        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
        }, 3000);

    } catch (error) {
        console.error('Publish error:', error);
        setProgress(0, 'Update failed: ' + error.message);
        if (progressBar) progressBar.style.background = '#ef4444';
        if (progressIcon) progressIcon.className = 'fas fa-exclamation-triangle';
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 5000);
    }
}

function unpublish() {
    showToast('All saves go directly to live. No unpublish needed.', 'info');
}

function discardChanges() {
    if (!confirm('Discard all unsaved changes? This cannot be undone.')) return;
    try {
        const draft = localStorage.getItem('builderDraft');
        if (draft) {
            const draftData = JSON.parse(draft);
            if (draftData.songs) DataStore.setSongs(draftData.songs);
            if (draftData.stations) DataStore.setStations(draftData.stations);
            if (draftData.categories) DataStore.setCategories(draftData.categories);
            if (draftData.featured) DataStore.setFeatured(draftData.featured);
            if (draftData.trending) DataStore.setTrending(draftData.trending);
            if (draftData.artistHits) DataStore.setArtistHits(draftData.artistHits);
            if (draftData.quotes) DataStore.setQuotes(draftData.quotes);
            if (draftData.siteSettings) DataStore.setSiteSettings(draftData.siteSettings);
            if (draftData.layout) DataStore.setLayout(draftData.layout);
            if (draftData.websiteSections) { websiteSections = draftData.websiteSections; localStorage.setItem('websiteLayout', JSON.stringify(websiteSections)); }
            if (draftData.images) DataStore.setImages(draftData.images);
            if (draftData.moods) DataStore.setMoods(draftData.moods);
            if (draftData.aiRadio) DataStore.setAIRadio(draftData.aiRadio);
            if (draftData.notifications) DataStore.setNotifications(draftData.notifications);
            if (draftData.splash) DataStore.setSplash(draftData.splash);
            if (draftData.playerPrefs) DataStore.setPlayerPrefs(draftData.playerPrefs);
            if (draftData.navigation) DataStore.setNavigation(draftData.navigation);
            if (draftData.sectionsOrder) DataStore.setSectionsOrder(draftData.sectionsOrder);
            if (draftData.miniPlayerSettings) DataStore.setMiniPlayerSettings(draftData.miniPlayerSettings);
            if (draftData.songsCollections) DataStore.setSongsCollections(draftData.songsCollections);
            if (draftData.newAlbums) DataStore.setNewAlbums(draftData.newAlbums);
        }
        publishState = 'draft';
        savePublishState();
        showToast('Changes discarded. Draft restored.', 'success');
        addActivity('Changes Discarded', 'All unsaved changes have been discarded');
        updatePublishUI();
        navigateTo('dashboard');
    } catch (error) {
        console.error('Discard error:', error);
        showToast('Failed to discard changes: ' + error.message, 'error');
    }
}

function showPublishHistory() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'publishHistoryModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('publishHistoryModal').remove()"></div>
        <div class="modal-content modal-lg">
            <div class="modal-header">
                <h2>Publish History</h2>
                <button class="modal-close" onclick="document.getElementById('publishHistoryModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="publish-state-info">
                    <span class="publish-state-badge ${publishState}">${publishState.toUpperCase()}</span>
                    <span class="publish-state-text">Current Status: ${publishState}</span>
                </div>
                ${publishHistory.length === 0 ? '<p class="no-history">No publish history yet.</p>' : `
                <div class="history-list">
                    ${publishHistory.map(entry => `
                        <div class="history-entry">
                            <div class="history-entry-header">
                                <span class="history-status published"><i class="fas fa-check-circle"></i> Published</span>
                                <span class="history-date">${new Date(entry.date).toLocaleString()}</span>
                            </div>
                            <div class="history-entry-details">
                                <span>${entry.changes.songs} songs</span>
                                <span>${entry.changes.stations} stations</span>
                                <span>${entry.changes.categories} categories</span>
                                <span>${entry.changes.featured} featured</span>
                                <span>${entry.changes.trending} trending</span>
                                <span>${entry.changes.artistHits} artist hits</span>
                                <span>${entry.changes.quotes} quotes</span>
                                <span>${entry.changes.sections} sections</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                `}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function updatePublishUI() {
    const badge = document.getElementById('publishStatusBadge');
    if (badge) {
        badge.textContent = publishState.toUpperCase();
        badge.className = 'publish-state-badge ' + publishState;
    }
    const publishBtn = document.getElementById('quickPublishBtn');
    const unpublishBtn = document.getElementById('quickUnpublishBtn');
    const saveDraftBtn = document.getElementById('quickSaveDraftBtn');
    const discardBtn = document.getElementById('quickDiscardBtn');
    const historyBtn = document.getElementById('quickHistoryBtn');

    if (publishBtn) publishBtn.style.display = publishState === 'published' ? 'none' : 'flex';
    if (unpublishBtn) unpublishBtn.style.display = publishState === 'published' ? 'flex' : 'none';
    if (saveDraftBtn) saveDraftBtn.style.display = 'flex';
    if (discardBtn) discardBtn.style.display = 'flex';
    if (historyBtn) historyBtn.style.display = 'flex';
}

// ============================================
// Utility Functions
// ============================================
function updateDashboardStats() {
    document.getElementById('totalSections').textContent = websiteSections.length;
}

function addActivity(title, description) {
    const activityList = document.getElementById('activityList');
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `
        <div class="activity-icon"><i class="fas fa-plus-circle"></i></div>
        <div class="activity-info">
            <h4>${title}</h4>
            <p>${description}</p>
        </div>
        <span class="activity-time">Just now</span>
    `;
    
    activityList.insertBefore(activityItem, activityList.firstChild);
    
    while (activityList.children.length > 10) {
        activityList.removeChild(activityList.lastChild);
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/* ============================================================
 * AI Animated Upload Status Overlay
 * A glowing, circular progress ring that shows real upload %
 * while a song (album cover + audio) is being saved.
 * ============================================================ */
const AIUploadOverlay = {
    R: 52,
    el: null, ring: null, track: null, pctEl: null, phaseEl: null, statusEl: null,
    orbit: null, timer: null, shown: false,

    init() {
        this.el = document.getElementById('aiUploadOverlay');
        if (!this.el) return;
        this.ring = document.getElementById('aiUploadRing');
        this.track = document.getElementById('aiUploadTrack');
        this.pctEl = document.getElementById('aiUploadPct');
        this.phaseEl = document.getElementById('aiUploadPhase');
        this.statusEl = document.getElementById('aiUploadStatus');
        this.orbit = this.el.querySelector('.ai-upload-orbit');
        const C = this.circ();
        if (this.ring) { this.ring.style.strokeDasharray = C; this.ring.style.strokeDashoffset = C; }
        if (this.track) { this.track.style.strokeDasharray = C; }
        document.getElementById('aiUploadClose')?.addEventListener('click', () => this.hide());
    },

    circ() { return 2 * Math.PI * this.R; },

    show() {
        if (!this.el) return;
        this.shown = true;
        this.el.style.display = 'flex';
        this.el.classList.remove('ai-upload-done', 'ai-upload-error');
        if (this.orbit) this.orbit.style.animationPlayState = 'running';
    },

    update(pct, phase, status) {
        if (!this.shown) this.show();
        const p = Math.min(100, Math.max(0, Math.round(pct)));
        const C = this.circ();
        if (this.ring) this.ring.style.strokeDashoffset = C * (1 - p / 100);
        if (this.pctEl) this.pctEl.textContent = p + '%';
        if (this.phaseEl) this.phaseEl.textContent = phase || '';
        if (this.statusEl) this.statusEl.textContent = status || '';
        if (this.el) this.el.classList.remove('ai-upload-done', 'ai-upload-error');
        if (this.orbit) this.orbit.style.animationPlayState = 'running';
    },

    success(msg) {
        this.update(100, 'Done', msg || 'Song saved to Tamil AI Stream!');
        if (this.el) this.el.classList.add('ai-upload-done');
        if (this.orbit) this.orbit.style.animationPlayState = 'paused';
        this.timer = setTimeout(() => this.hide(), 1800);
    },

    error(msg) {
        this.update(0, 'Error', msg || 'Upload failed');
        if (this.el) this.el.classList.add('ai-upload-error');
        if (this.orbit) this.orbit.style.animationPlayState = 'paused';
        this.timer = setTimeout(() => this.hide(), 5000);
    },

    hide() {
        this.timer && clearTimeout(this.timer);
        this.shown = false;
        if (this.el) this.el.style.display = 'none';
        if (this.orbit) this.orbit.style.animationPlayState = 'paused';
    },

    setProgress(value, max) {
        // helper for phases without a precise pct
        if (max) return this.update(Math.round((value / max) * 100), null, null);
        return this;
    }
};
window.AIUploadOverlay = AIUploadOverlay;

// ============================================
// File Upload Handlers
// ============================================
function setupFileUploads() {
    // Album cover upload
    const albumUpload = document.getElementById('albumUpload');
    const albumInput = document.getElementById('albumImage');
    
    // Click to open file browser
    albumUpload?.addEventListener('click', (e) => {
        if (e.target !== albumInput) {
            albumInput?.click();
        }
    });
    
    albumUpload?.addEventListener('dragover', (e) => {
        e.preventDefault();
        albumUpload.classList.add('dragover');
    });
    
    albumUpload?.addEventListener('dragleave', () => {
        albumUpload.classList.remove('dragover');
    });
    
    albumUpload?.addEventListener('drop', (e) => {
        e.preventDefault();
        albumUpload.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            albumInput.files = files;
            handleAlbumPreview(files[0]);
        }
    });
    
    albumInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAlbumPreview(e.target.files[0]);
        }
    });

    // Audio upload
    const audioUpload = document.getElementById('audioUpload');
    const audioInput = document.getElementById('audioFile');
    
    // Click to open file browser
    audioUpload?.addEventListener('click', (e) => {
        if (e.target !== audioInput) {
            audioInput?.click();
        }
    });
    
    audioUpload?.addEventListener('dragover', (e) => {
        e.preventDefault();
        audioUpload.classList.add('dragover');
    });
    
    audioUpload?.addEventListener('dragleave', () => {
        audioUpload.classList.remove('dragover');
    });
    
    audioUpload?.addEventListener('drop', (e) => {
        e.preventDefault();
        audioUpload.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            audioInput.files = files;
            handleAudioPreview(files[0]);
        }
    });
    
    audioInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAudioPreview(e.target.files[0]);
        }
    });

    // Image upload zone (Images page)
    const imageUploadZone = document.getElementById('imageUploadZone');
    const imageFileInput = document.getElementById('imageFileInput');
    
    imageUploadZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadZone.classList.add('dragover');
    });
    
    imageUploadZone?.addEventListener('dragleave', () => {
        imageUploadZone.classList.remove('dragover');
    });
    
    imageUploadZone?.addEventListener('drop', async (e) => {
        e.preventDefault();
        imageUploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await handleImageUpload(files);
        }
    });
    
    imageFileInput?.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await handleImageUpload(e.target.files);
        }
    });

    // Modal image upload
    const modalImageUpload = document.getElementById('modalImageUpload');
    const modalImageFile = document.getElementById('modalImageFile');
    
    modalImageUpload?.addEventListener('click', () => modalImageFile?.click());
    
    modalImageFile?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleModalImagePreview(e.target.files[0]);
        }
    });
}

async function handleImageUpload(files) {
    const progressEl = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressEl.style.display = 'flex';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const percent = ((i + 1) / files.length) * 100;
        
        progressFill.style.width = percent + '%';
        progressText.textContent = `Uploading ${i + 1} of ${files.length}: ${file.name}`;
        
        await uploadImage(file, 'other', file.name);
    }
    
    progressEl.style.display = 'none';
    progressFill.style.width = '0%';
}

function handleModalImagePreview(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('modalPreviewImg').src = e.target.result;
        document.getElementById('modalImageName').textContent = file.name;
        document.getElementById('modalImageSize').textContent = formatFileSize(file.size);
        document.getElementById('modalImagePreview').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function handleAlbumPreview(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('albumPreviewImg').src = e.target.result;
        document.getElementById('albumFileName').textContent = file.name;
        document.getElementById('albumFileSize').textContent = formatFileSize(file.size);
        document.getElementById('albumPreview').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function handleAudioPreview(file) {
    const AUDIO_RE = /\.(mp3|wav|ogg|oga|aac|m4a|flac|opus|webm)$/i;
    if (!file.type.startsWith('audio/') && !AUDIO_RE.test(file.name)) {
        showToast('Please upload an audio file (MP3, WAV, OGG, M4A)', 'error');
        return;
    }

    document.getElementById('audioFileName').textContent = file.name;
    document.getElementById('audioFileSize').textContent = formatFileSize(file.size);
    document.getElementById('audioPreview').style.display = 'flex';

    // AI Auto-fill from filename intelligence
    if (typeof AIAutomation !== 'undefined') {
        const intel = AIAutomation.parseFilenameIntelligence(file.name);

        if (intel.title) {
            const titleEl = document.getElementById('songTitle');
            if (titleEl && !titleEl.value.trim()) titleEl.value = intel.title;
        }
        if (intel.artist) {
            const artistEl = document.getElementById('songArtist');
            if (artistEl && !artistEl.value.trim()) artistEl.value = intel.artist;
        }
        if (intel.movie) {
            const movieEl = document.getElementById('songMovie');
            if (movieEl && !movieEl.value.trim()) movieEl.value = intel.movie;
        }
        if (intel.language) {
            const langEl = document.getElementById('songLanguage');
            if (langEl && !langEl.value) {
                for (const opt of langEl.options) {
                    if (opt.value.toLowerCase() === intel.language.toLowerCase() || opt.text.toLowerCase() === intel.language.toLowerCase()) {
                        langEl.value = opt.value;
                        break;
                    }
                }
            }
        }
        if (intel.genre) {
            const genreEl = document.getElementById('songGenre');
            if (genreEl && !genreEl.value) {
                for (const opt of genreEl.options) {
                    if (opt.value.toLowerCase() === intel.genre.toLowerCase() || opt.text.toLowerCase() === intel.genre.toLowerCase()) {
                        genreEl.value = opt.value;
                        break;
                    }
                }
            }
        }

        // Extract metadata (duration, hash) in background
        AIAutomation.extractAudioMetadata(file).then(meta => {
            if (meta.duration > 0) {
                const durEl = document.getElementById('songDuration');
                if (durEl && !durEl.value.trim()) {
                    const mins = Math.floor(meta.duration / 60);
                    const secs = meta.duration % 60;
                    durEl.value = mins + ':' + String(secs).padStart(2, '0');
                }
            }

            // Store hash for duplicate detection
            if (meta.hash) {
                window._pendingSongHash = meta.hash;
                window._pendingSongMeta = meta;
            }

            // Check for duplicates
            if (meta.hash || intel.title) {
                const songs = DataStore.getSongs();
                const probe = { title: intel.title, artist: intel.artist, movie: intel.movie, hash: meta.hash, duration: meta.duration };
                const dupes = AIAutomation.detectDuplicates(probe, songs);
                if (dupes.length > 0) {
                    const top = dupes[0];
                    showToast('Possible duplicate: "' + top.song.title + '" by ' + top.song.artist + ' (' + top.score + '% match)', 'warning');
                }
            }
        }).catch(() => {});

        if (intel.tags && intel.tags.length > 0) {
            showToast('AI detected: ' + intel.genre + ' / ' + intel.mood + ' / ' + intel.language, 'info');
        }
    }
}


// ============================================
// Initialize Builder
// ============================================
function initBuilder() {
    // Navigation
    document.querySelectorAll('.builder-sidebar-item, .builder-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            if (page) navigateTo(page);
        });
    });

    // Right panel close button
    document.getElementById('rightPanelClose')?.addEventListener('click', closeRightPanel);
    document.getElementById('rightPanelOverlay')?.addEventListener('click', closeRightPanel);

    // Logout
    document.getElementById('builderLogout')?.addEventListener('click', signOut);

    // Song form submission
    document.getElementById('songForm')?.addEventListener('submit', saveSong);

    // Quick song form submission
    document.getElementById('quickSongForm')?.addEventListener('submit', saveQuickSong);

    // Upload image form
    document.getElementById('uploadImageForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('modalImageFile').files[0];
        const category = document.getElementById('imageCategory').value;
        const title = document.getElementById('imageTitle').value;
        
        if (file) {
            await uploadImage(file, category, title);
            closeUploadImageModal();
        }
        });

    // Music collection form â€“ prevent page reload (fixes auto-logout bug)
    const collectionForm = document.getElementById('newCollectionForm');
    if (collectionForm) {
        collectionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            createCollectionFromForm();
        });
    }

    // Thumbnail preview â€“ auto-update when a URL is typed/pasted
    const thumbInput = document.getElementById('collectionThumbnail');
    if (thumbInput) {
        thumbInput.addEventListener('input', () => {
            const url = thumbInput.value.trim();
            const preview = document.getElementById('collectionThumbPreview');
            const img = document.getElementById('collectionThumbImg');
            if (url) {
                img.src = url;
                preview.style.display = 'flex';
            } else {
                preview.style.display = 'none';
            }
        });
    }

    // Audio / folder upload â€“ click on the styled drop zone
    const audioUploadZone = document.getElementById('collectionAudioUpload');
    const audioFileInput = document.getElementById('collectionAudioFiles');
    if (audioUploadZone && audioFileInput) {
        audioUploadZone.addEventListener('click', () => audioFileInput.click());
    }
    if (audioFileInput) {
        audioFileInput.addEventListener('change', handleCollectionAudioUpload);
    }

    // Search functionality
    document.getElementById('songSearch')?.addEventListener('input', (e) => {
        debounce('songSearch', () => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('#allSongsTable tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
            });
        }, 200);
    });

    document.getElementById('imageSearch')?.addEventListener('input', (e) => {
        debounce('imageSearch', () => searchImages(e.target.value), 200);
    });

    // Image filter
    document.getElementById('imageFilter')?.addEventListener('change', (e) => {
        filterImages(e.target.value);
    });

    // Device buttons for preview
    document.querySelectorAll('.device-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const device = this.dataset.device;
            const frame = document.getElementById('previewFrame');

            switch(device) {
                case 'desktop':
                    frame.style.width = '100%';
                    frame.style.height = '100%';
                    frame.style.margin = '0';
                    break;
                case 'tablet':
                    frame.style.width = '768px';
                    frame.style.height = '1024px';
                    frame.style.margin = '0 auto';
                    break;
                case 'mobile':
                    frame.style.width = '375px';
                    frame.style.height = '812px';
                    frame.style.margin = '0 auto';
                    break;
            }

            // Reload iframe to ensure fresh content rendered for the selected device viewport
            const iframe = document.getElementById('previewFrame');
            if (iframe && iframe.src) {
                const currentSrc = iframe.src;
                iframe.src = 'about:blank';
                setTimeout(() => {
                    iframe.src = currentSrc;
                }, 100);
            }
        });
    });

    // Content tabs
    document.querySelectorAll('.content-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.content-tab-panel').forEach(p => p.style.display = 'none');
            this.classList.add('active');
            const tabName = this.dataset.tab;
            const panel = document.getElementById(tabName + 'Tab');
            if (panel) panel.style.display = 'block';
            if (tabName === 'songs') loadAllSongs();
        });
    });

    // Content page â€” Song Library search
    document.getElementById('contentSongSearch')?.addEventListener('input', (e) => {
        debounce('contentSongSearch', () => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('#contentSongsTable tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
            });
        }, 200);
    });

    // Artist Hits Sub-Tabs
    setupArtistHitsSubTabs();

    // Station form
    document.getElementById('stationForm')?.addEventListener('submit', saveStation);
    
    // Station thumbnail preview
    document.getElementById('stationThumbnail')?.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        const preview = document.getElementById('stationThumbnailPreview');
        const img = document.getElementById('stationThumbnailImg');
        if (url && preview && img) {
            img.src = url;
            preview.style.display = 'block';
            img.onerror = () => { preview.style.display = 'none'; };
        } else if (preview) {
            preview.style.display = 'none';
        }
    });

    // Settings form
    document.getElementById('settingsForm')?.addEventListener('submit', saveSettings);
    // Brand Identity form (shares saveSettings â€” persists logo/favicon via siteSettings)
    document.getElementById('brandSettingsForm')?.addEventListener('submit', saveSettings);

    // Station search
    document.getElementById('stationSearch')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('#stationsTable tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
    });

    // Setup file uploads
    setupFileUploads();

    // Initialize preview player
    setupPreviewPlayer();

    // Initialize publish state
    getPublishState();
    updatePublishUI();

    // Initialize Application Builder
    if (typeof AppBuilder !== 'undefined') AppBuilder.init();

    // Load dashboard by default
    navigateTo('dashboard');

    console.log('%cðŸŽ™ï¸ Tamil AI Stream Admin Panel', 'font-size:20px;font-weight:bold;color:#34d399;');
    console.log('%cAdmin Ready - Logged in as: ' + (currentUser?.displayName || currentUser?.email || 'Admin'), 'font-size:12px;color:#6ee7b7;');
}

// ============================================
// Stations Management
// ============================================
function loadAllStations() {
    let stations = DataStore.getStations();
    stations = _filterDeletedItems(stations, 'stations');
    const tableBody = document.getElementById('stationsTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = stations.map(station => `
        <tr>
            <td><strong>${station.name}</strong></td>
            <td>${station.freq}</td>
            <td>${station.genre}</td>
            <td>${station.city || 'Chennai'}</td>
            <td><span class="status-badge ${station.status === 'active' ? 'active' : 'inactive'}">${station.status}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn edit-btn" onclick="editStation('${station.id}')" title="Edit Station">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn delete" onclick="deleteStation('${station.id}')" title="Delete Station">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function saveStation(e) {
    e.preventDefault();
    const id = document.getElementById('stationId').value;
    const stationData = {
        name: document.getElementById('stationName').value.trim(),
        freq: document.getElementById('stationFreq').value.trim(),
        genre: document.getElementById('stationGenre').value,
        city: document.getElementById('stationCity').value.trim() || 'Chennai',
        streamUrl: document.getElementById('stationStreamUrl').value.trim(),
        thumbnail: document.getElementById('stationThumbnail').value.trim(),
        status: document.getElementById('stationStatus').value,
        gradient: `linear-gradient(135deg, hsl(${Math.random()*360},30%,15%), hsl(${Math.random()*360},40%,10%))`
    };
    
    if (!stationData.name || !stationData.freq || !stationData.streamUrl) {
        showToast('Please fill in required fields', 'error');
        return;
    }
    
    const stations = DataStore.getStations();
    
    if (id) {
        const idx = stations.findIndex(s => s.id === id);
        if (idx !== -1) stations[idx] = { ...stations[idx], ...stationData };
    } else {
        stationData.id = 'st_' + Date.now();
        stationData.listeners = 0;
        stations.push(stationData);
    }
    
    DataStore.setStations(stations);
    showToast('Station saved successfully!', 'success');
    resetStationForm();
    loadAllStations();
    syncToLiveWebsite();
    addActivity('Station Saved', `Saved "${stationData.name}"`);
}

function editStation(id) {
    const stations = DataStore.getStations();
    const station = stations.find(s => s.id === id);
    if (!station) return;
    
    // Set form values
    document.getElementById('stationId').value = station.id;
    document.getElementById('stationName').value = station.name;
    document.getElementById('stationFreq').value = station.freq;
    document.getElementById('stationGenre').value = station.genre;
    document.getElementById('stationCity').value = station.city || '';
    document.getElementById('stationStreamUrl').value = station.streamUrl || '';
    document.getElementById('stationThumbnail').value = station.thumbnail || '';
    document.getElementById('stationStatus').value = station.status || 'active';
    
    // Show thumbnail preview if exists
    const thumbPreview = document.getElementById('stationThumbnailPreview');
    const thumbImg = document.getElementById('stationThumbnailImg');
    if (station.thumbnail && thumbPreview && thumbImg) {
        thumbImg.src = station.thumbnail;
        thumbPreview.style.display = 'block';
    } else if (thumbPreview) {
        thumbPreview.style.display = 'none';
    }
    
    // Add edit mode banner
    const formCard = document.getElementById('stationForm')?.closest('.content-card');
    if (formCard) {
        // Remove existing banner if any
        const existingBanner = formCard.querySelector('.edit-mode-banner');
        if (existingBanner) existingBanner.remove();
        
        // Add new banner
        const banner = document.createElement('div');
        banner.className = 'edit-mode-banner';
        banner.innerHTML = `
            <i class="fas fa-edit"></i>
            <span>Editing: <strong>${station.name}</strong></span>
            <button onclick="cancelEditStation()" type="button"><i class="fas fa-times"></i> Cancel</button>
        `;
        formCard.insertBefore(banner, formCard.firstChild);
    }
    
    // Scroll to form and highlight it
    const form = document.getElementById('stationForm');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.classList.add('highlight-edit');
        setTimeout(() => form.classList.remove('highlight-edit'), 2000);
    }
    
    // Change submit button text to indicate editing
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Station';
    }
    
    showToast('Station loaded for editing. Modify and click Update.', 'info');
}

function cancelEditStation() {
    resetStationForm();
    // Remove edit mode banner
    const banner = document.querySelector('.edit-mode-banner');
    if (banner) banner.remove();
    showToast('Edit cancelled', 'info');
}

function deleteStation(id) {
    if (!confirm('Move this station to Trash?')) return;
    const stations = DataStore._getRaw(DataStore.KEYS.STATIONS) || [];
    const station = stations.find(s => s.id === id);
    if (station) {
        DataStore.moveToTrash(station, 'stations');
    }
    const filtered = stations.filter(s => s.id !== id);
    localStorage.setItem(DataStore.KEYS.STATIONS, JSON.stringify(filtered));
    showToast('Station moved to Trash', 'success');
    loadAllStations();
    syncToLiveWebsite();
}

function resetStationForm() {
    document.getElementById('stationForm').reset();
    document.getElementById('stationId').value = '';
    document.getElementById('stationThumbnailPreview').style.display = 'none';
    
    // Reset submit button text
    const submitBtn = document.querySelector('#stationForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Station';
    }
}

// ============================================
// Featured Management
// ============================================
function loadFeatured() {
    let featured = DataStore.getFeatured();
    featured = _filterDeletedItems(featured, 'featured');
    const stations = DataStore.getStations();
    const tableBody = document.getElementById('featuredTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = featured.map(item => {
        const station = stations.find(s => s.id === item.stationId) || {};
        return `
            <tr>
                <td><strong>${item.title || station.name || 'N/A'}</strong></td>
                <td>${station.name || 'N/A'}</td>
                <td>${(item.listeners || 0).toLocaleString()}</td>
                <td><span class="status-badge ${item.status === 'active' ? 'active' : 'inactive'}">${item.status}</span></td>
                <td>
                    <div class="actions">
                        <button class="action-btn" onclick="editFeatured('${item.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="deleteFeatured('${item.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddFeaturedModal() {
    const stations = DataStore.getStations();
    const stationOptions = stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'featuredModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Featured Station</h2>
                <button class="modal-close" onclick="document.getElementById('featuredModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="featuredForm">
                    <div class="form-group">
                        <label class="form-label">Station *</label>
                        <select class="form-select" id="featuredStationId" required>${stationOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Custom Title (optional)</label>
                        <input type="text" class="form-input" id="featuredTitle" placeholder="Override station name">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Custom Subtitle (optional)</label>
                        <input type="text" class="form-input" id="featuredSubtitle" placeholder="e.g. 98.3 FM - Chennai">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL (optional)</label>
                        <input type="url" class="form-input" id="featuredThumbnail" placeholder="https://example.com/image.jpg">
                        <div class="station-thumbnail-preview" id="featuredThumbnailPreview" style="display:none;">
                            <img id="featuredThumbnailImg" src="" alt="Thumbnail preview">
                        </div>
                        <div style="margin-top:6px;">
                            <label class="builder-btn" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;padding:6px 12px;">
                                <i class="fas fa-cloud-upload-alt"></i> Upload Image
                                <input type="file" accept="image/*" style="display:none;" onchange="uploadFeaturedImage(this)">
                            </label>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('featuredModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('featuredForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const featured = DataStore.getFeatured();
        const stationId = document.getElementById('featuredStationId').value;
        const stations = DataStore.getStations();
        const station = stations.find(s => s.id === stationId);
        
        featured.push({
            id: 'feat_' + Date.now(),
            stationId: stationId,
            title: document.getElementById('featuredTitle').value || station?.name || '',
            subtitle: document.getElementById('featuredSubtitle').value || `${station?.freq || ''} - ${station?.city || ''}`,
            thumbnail: document.getElementById('featuredThumbnail').value.trim() || station?.thumbnail || '',
            listeners: station?.listeners || 0,
            gradient: station?.gradient || 'linear-gradient(135deg, #0f3b2e, #064e3b)',
            status: 'active'
        });
        
        DataStore.setFeatured(featured);
        showToast('Featured station added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadFeatured();
    });
}

function editFeatured(id) {
    const featured = DataStore.getFeatured();
    const item = featured.find(f => f.id === id);
    if (!item) return;
    
    const stations = DataStore.getStations();
    const stationOptions = stations.map(s => `<option value="${s.id}" ${s.id === item.stationId ? 'selected' : ''}>${s.name}</option>`).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'featuredModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Featured Station</h2>
                <button class="modal-close" onclick="document.getElementById('featuredModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="featuredForm">
                    <div class="form-group">
                        <label class="form-label">Station *</label>
                        <select class="form-select" id="featuredStationId" required>${stationOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Custom Title</label>
                        <input type="text" class="form-input" id="featuredTitle" value="${item.title || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Custom Subtitle</label>
                        <input type="text" class="form-input" id="featuredSubtitle" value="${item.subtitle || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL</label>
                        <input type="url" class="form-input" id="featuredThumbnail" value="${item.thumbnail || ''}" placeholder="https://example.com/image.jpg">
                        <div class="station-thumbnail-preview" id="featuredThumbnailPreview" style="display:${item.thumbnail ? 'block' : 'none'};">
                            <img id="featuredThumbnailImg" src="${item.thumbnail || ''}" alt="Thumbnail preview">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('featuredModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('featuredForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const featured = DataStore.getFeatured();
        const idx = featured.findIndex(f => f.id === id);
        const stationId = document.getElementById('featuredStationId').value;
        const station = stations.find(s => s.id === stationId);
        
        featured[idx] = {
            ...featured[idx],
            stationId: stationId,
            title: document.getElementById('featuredTitle').value || station?.name || '',
            subtitle: document.getElementById('featuredSubtitle').value || '',
            thumbnail: document.getElementById('featuredThumbnail').value.trim() || station?.thumbnail || '',
            listeners: station?.listeners || featured[idx].listeners,
            gradient: station?.gradient || featured[idx].gradient
        };
        
        DataStore.setFeatured(featured);
        showToast('Featured updated!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadFeatured();
    });
}

function deleteFeatured(id) {
    if (!confirm('Move this featured item to Trash?')) return;
    const featured = DataStore._getRaw(DataStore.KEYS.FEATURED) || [];
    const item = featured.find(f => f.id === id);
    if (item) DataStore.moveToTrash(item, 'featured');
    localStorage.setItem(DataStore.KEYS.FEATURED, JSON.stringify(featured.filter(f => f.id !== id)));
    showToast('Featured moved to Trash', 'success');
    loadFeatured();
    syncToLiveWebsite();
}

// ============================================
// Trending Management
// ============================================
function loadTrending() {
    let trending = DataStore.getTrending();
    trending = _filterDeletedItems(trending, 'trending');
    const stations = DataStore.getStations();
    const tableBody = document.getElementById('trendingTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = trending.map(item => {
        const station = stations.find(s => s.id === item.stationId) || {};
        return `
            <tr>
                <td><strong>${station.name || 'N/A'}</strong></td>
                <td><span class="status-badge ${item.status === 'active' ? 'active' : 'inactive'}">${item.status}</span></td>
                <td>
                    <div class="actions">
                        <button class="action-btn edit-btn" onclick="editTrending('${item.id}')" title="Edit"><i class="fas fa-edit"></i> Edit</button>
                        <button class="action-btn delete" onclick="deleteTrending('${item.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddTrendingModal() {
    const stations = DataStore.getStations();
    const stationOptions = stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'trendingModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Trending Station</h2>
                <button class="modal-close" onclick="document.getElementById('trendingModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="trendingForm">
                    <div class="form-group">
                        <label class="form-label">Station *</label>
                        <select class="form-select" id="trendingStationId" required>${stationOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL (optional)</label>
                        <input type="url" class="form-input" id="trendingThumbnail" placeholder="https://example.com/image.jpg">
                        <div class="station-thumbnail-preview" id="trendingThumbnailPreview" style="display:none;">
                            <img id="trendingThumbnailImg" src="" alt="Thumbnail preview">
                        </div>
                        <div style="margin-top:6px;">
                            <label class="builder-btn" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;padding:6px 12px;">
                                <i class="fas fa-cloud-upload-alt"></i> Upload Image
                                <input type="file" accept="image/*" style="display:none;" onchange="uploadTrendingImage(this)">
                            </label>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('trendingModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('trendingForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const trending = DataStore.getTrending();
        const stationId = document.getElementById('trendingStationId').value;
        const stations = DataStore.getStations();
        const station = stations.find(s => s.id === stationId);
        trending.push({
            id: 'trend_' + Date.now(),
            stationId: stationId,
            thumbnail: document.getElementById('trendingThumbnail').value.trim() || station?.thumbnail || '',
            status: 'active'
        });
        DataStore.setTrending(trending);
        showToast('Trending station added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadTrending();
    });
}

function deleteTrending(id) {
    if (!confirm('Move from trending to Trash?')) return;
    const trending = DataStore._getRaw(DataStore.KEYS.TRENDING) || [];
    const item = trending.find(t => t.id === id);
    if (item) DataStore.moveToTrash(item, 'trending');
    localStorage.setItem(DataStore.KEYS.TRENDING, JSON.stringify(trending.filter(t => t.id !== id)));
    showToast('Moved to Trash', 'success');
    loadTrending();
    syncToLiveWebsite();
}

function editTrending(id) {
    const trending = DataStore.getTrending();
    const item = trending.find(t => t.id === id);
    if (!item) return;
    
    const stations = DataStore.getStations();
    const stationOptions = stations.map(s => 
        `<option value="${s.id}" ${s.id === item.stationId ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'trendingModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Trending Station</h2>
                <button class="modal-close" onclick="document.getElementById('trendingModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="trendingForm">
                    <div class="form-group">
                        <label class="form-label">Station *</label>
                        <select class="form-select" id="trendingStationId" required>${stationOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select class="form-select" id="trendingStatus">
                            <option value="active" ${item.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${item.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Update</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('trendingModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('trendingForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const idx = trending.findIndex(t => t.id === id);
        if (idx !== -1) {
            trending[idx] = {
                ...trending[idx],
                stationId: document.getElementById('trendingStationId').value,
                status: document.getElementById('trendingStatus').value
            };
            DataStore.setTrending(trending);
            showToast('Trending station updated!', 'success');
            syncToLiveWebsite();
            modal.remove();
            loadTrending();
        }
    });
}

// ============================================
// Categories Management
// ============================================
function loadCategories() {
    let categories = DataStore.getCategories();
    categories = _filterDeletedItems(categories, 'categories');
    const tableBody = document.getElementById('categoriesTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = categories.map(cat => `
        <tr>
            <td><i class="fas ${cat.icon || 'fa-th-large'}"></i></td>
            <td><strong>${cat.name}</strong></td>
            <td>${cat.count || 0}</td>
            <td><span class="status-badge ${cat.status === 'active' ? 'active' : 'inactive'}">${cat.status}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="editCategory('${cat.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteCategory('${cat.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddCategoryModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'categoryModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Category</h2>
                <button class="modal-close" onclick="document.getElementById('categoryModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="categoryForm">
                    <div class="form-group">
                        <label class="form-label">Name *</label>
                        <input type="text" class="form-input" id="catName" required placeholder="e.g. Music">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Icon (FontAwesome class)</label>
                        <input type="text" class="form-input" id="catIcon" placeholder="e.g. fa-music" value="fa-th-large">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Station Count</label>
                        <input type="number" class="form-input" id="catCount" value="0">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('categoryModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('categoryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const categories = DataStore.getCategories();
        categories.push({
            id: 'cat_' + Date.now(),
            name: document.getElementById('catName').value.trim(),
            icon: document.getElementById('catIcon').value.trim() || 'fa-th-large',
            count: parseInt(document.getElementById('catCount').value) || 0,
            status: 'active'
        });
        DataStore.setCategories(categories);
        showToast('Category added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadCategories();
    });
}

function editCategory(id) {
    const categories = DataStore.getCategories();
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'categoryModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Category</h2>
                <button class="modal-close" onclick="document.getElementById('categoryModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="categoryForm">
                    <div class="form-group">
                        <label class="form-label">Name *</label>
                        <input type="text" class="form-input" id="catName" value="${cat.name}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Icon</label>
                        <input type="text" class="form-input" id="catIcon" value="${cat.icon || 'fa-th-large'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Station Count</label>
                        <input type="number" class="form-input" id="catCount" value="${cat.count || 0}">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('categoryModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('categoryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const idx = categories.findIndex(c => c.id === id);
        categories[idx] = {
            ...categories[idx],
            name: document.getElementById('catName').value.trim(),
            icon: document.getElementById('catIcon').value.trim() || 'fa-th-large',
            count: parseInt(document.getElementById('catCount').value) || 0
        };
        DataStore.setCategories(categories);
        showToast('Category updated!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadCategories();
    });
}

function deleteCategory(id) {
    if (!confirm('Move this category to Trash?')) return;
    const categories = DataStore._getRaw(DataStore.KEYS.CATEGORIES) || [];
    const cat = categories.find(c => c.id === id);
    if (cat) DataStore.moveToTrash(cat, 'categories');
    localStorage.setItem(DataStore.KEYS.CATEGORIES, JSON.stringify(categories.filter(c => c.id !== id)));
    showToast('Category moved to Trash', 'success');
    loadCategories();
    syncToLiveWebsite();
}

// ============================================
// Artist Hits Management
// ============================================
function loadArtistHits() {
    let artistHits = DataStore.getArtistHits();
    artistHits = _filterDeletedItems(artistHits, 'artistHits');
    const tableBody = document.getElementById('artistHitsTable');
    if (!tableBody) return;
    
      tableBody.innerHTML = artistHits.map(hit => {
        const songCount = (hit.songs && hit.songs.length) ? hit.songs.length : (hit.songCount || 0);
        return `
        <tr>
            <td>${hit.artist}</td>
            <td><strong>${hit.name}</strong></td>
            <td>${songCount}</td>
            <td><span class="status-badge ${hit.status === 'active' ? 'active' : 'inactive'}">${hit.status}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="openEditArtistSongsModal('${hit.id}')" title="Edit Artist - Manage Songs"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteArtistHit('${hit.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
    loadArtistSongCollections();
}

function openAddArtistHitModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'artistHitModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Artist Hit</h2>
                <button class="modal-close" onclick="document.getElementById('artistHitModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="artistHitForm">
                    <div class="form-group">
                        <label class="form-label">Artist ID *</label>
                        <input type="text" class="form-input" id="ahArtist" required placeholder="e.g. dhanush">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Display Name *</label>
                        <input type="text" class="form-input" id="ahName" required placeholder="e.g. Dhanush Hits">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Song Count</label>
                        <input type="number" class="form-input" id="ahSongCount" value="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Gradient</label>
                        <input type="text" class="form-input" id="ahGradient" placeholder="linear-gradient(135deg,#1e3a5f,#0d1f3c)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL (optional)</label>
                        <input type="url" class="form-input" id="ahThumbnail" placeholder="https://example.com/artist.jpg">
                        <div class="station-thumbnail-preview" id="ahThumbnailPreview" style="display:none;">
                            <img id="ahThumbnailImg" src="" alt="Thumbnail preview">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('artistHitModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('artistHitForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const artistHits = DataStore.getArtistHits();
        artistHits.push({
            id: 'ah_' + Date.now(),
            artist: document.getElementById('ahArtist').value.trim(),
            name: document.getElementById('ahName').value.trim(),
            songCount: parseInt(document.getElementById('ahSongCount').value) || 0,
            gradient: document.getElementById('ahGradient').value.trim() || 'linear-gradient(135deg,#1e3a5f,#0d1f3c)',
            thumbnail: document.getElementById('ahThumbnail').value.trim(),
            status: 'active'
        });
        DataStore.setArtistHits(artistHits);
        showToast('Artist hit added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadArtistHits();
    });
}

function editArtistHit(id) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === id);
    if (!hit) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'artistHitModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Artist Hit</h2>
                <button class="modal-close" onclick="document.getElementById('artistHitModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="artistHitForm">
                    <div class="form-group">
                        <label class="form-label">Artist ID *</label>
                        <input type="text" class="form-input" id="ahArtist" value="${hit.artist}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Display Name *</label>
                        <input type="text" class="form-input" id="ahName" value="${hit.name}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Song Count</label>
                        <input type="number" class="form-input" id="ahSongCount" value="${hit.songCount || 0}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Gradient</label>
                        <input type="text" class="form-input" id="ahGradient" value="${hit.gradient || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL</label>
                        <input type="url" class="form-input" id="ahThumbnail" value="${hit.thumbnail || ''}" placeholder="https://example.com/artist.jpg">
                        <div class="station-thumbnail-preview" id="ahThumbnailPreview" style="display:${hit.thumbnail ? 'block' : 'none'};">
                            <img id="ahThumbnailImg" src="${hit.thumbnail || ''}" alt="Thumbnail preview">
                        </div>
                    </div>
                     <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('artistHitModal').remove()">Cancel</button>
                        <button type="button" class="builder-btn" id="manageSongsBtn" data-id="${id}"><i class="fas fa-music"></i> Manage Songs</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
     document.getElementById('artistHitForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const idx = artistHits.findIndex(h => h.id === id);
        artistHits[idx] = {
            ...artistHits[idx],
            artist: document.getElementById('ahArtist').value.trim(),
            name: document.getElementById('ahName').value.trim(),
            songCount: parseInt(document.getElementById('ahSongCount').value) || 0,
            gradient: document.getElementById('ahGradient').value.trim(),
            thumbnail: document.getElementById('ahThumbnail').value.trim()
        };
        DataStore.setArtistHits(artistHits);
        showToast('Artist hit updated!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadArtistHits();
    });

    document.getElementById('manageSongsBtn').addEventListener('click', function() {
        modal.remove();
        openEditArtistSongsModal(id);
    });

    document.getElementById('ahThumbnail').addEventListener('input', function() {
        const preview = document.getElementById('ahThumbnailPreview');
        const img = document.getElementById('ahThumbnailImg');
        if (this.value) {
            preview.style.display = 'block';
            img.src = this.value;
        } else {
            preview.style.display = 'none';
        }
     });
 }

function manageArtistSongs(id) {
    document.querySelector('.content-tab[data-tab="artistHits"]').click();
    document.querySelector('.artist-hit-sub-tab[data-artist-tab="artistSongs"]').click();
    document.getElementById('artistSongCollection').value = id;
    loadArtistSongs(id);
}

function openEditArtistSongsModal(hitId) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit) {
        showToast('Artist collection not found', 'error');
        return;
    }

    const songs = DataStore.getSongs();
    if (!hit.songs) hit.songs = [];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editArtistSongsModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('editArtistSongsModal').remove()"></div>
        <div class="modal-content" style="max-width:900px;max-height:90vh;">
            <div class="modal-header">
                <h2>Edit Artist: ${hit.name}</h2>
                <button class="modal-close" onclick="document.getElementById('editArtistSongsModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end;">
                    <div class="form-group" style="flex:1;min-width:200px;margin:0;">
                        <label class="form-label">Artist ID</label>
                        <input type="text" class="form-input" id="editAhArtist" value="${hit.artist}" placeholder="e.g. dhanush">
                    </div>
                    <div class="form-group" style="flex:1;min-width:200px;margin:0;">
                        <label class="form-label">Display Name</label>
                        <input type="text" class="form-input" id="editAhName" value="${hit.name}" placeholder="e.g. Dhanush Hits">
                    </div>
                    <button type="button" class="builder-btn primary" onclick="updateArtistName('${hitId}')" style="height:38px;white-space:nowrap;">
                        <i class="fas fa-save"></i> Update Name
                    </button>
                </div>

                <div class="tabs" style="margin-bottom:16px;">
                    <button class="tab-btn active" data-tab="manage" onclick="switchArtistSongTab('manage')"><i class="fas fa-list"></i> Manage Songs (${hit.songs.length})</button>
                    <button class="tab-btn" data-tab="add" onclick="switchArtistSongTab('add')"><i class="fas fa-plus"></i> Add Songs</button>
                </div>
                
                <div id="manageSongsTab">
                    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
                        <input type="text" class="form-input" id="asDuration" placeholder="Filter by duration e.g. 3:45" style="max-width:200px;">
                        <label style="color:#aaa;font-size:12px;display:flex;align-items:center;gap:4px;">
                            <input type="checkbox" id="selectAllSongs"> Select All
                        </label>
                        <button type="button" class="builder-btn delete" onclick="bulkRemoveSongsFromArtist('${hitId}')" id="bulkRemoveBtn" style="display:none;font-size:12px;padding:4px 10px;">
                            <i class="fas fa-trash"></i> Remove Selected
                        </button>
                    </div>
                    <div class="data-table">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:30px;"></th>
                                    <th>#</th>
                                    <th>Title</th>
                                    <th>Artist</th>
                                    <th>Movie</th>
                                    <th>Duration</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="editArtistSongsTable"></tbody>
                        </table>
                    </div>
                </div>
                
                <div id="addSongTab" style="display:none;">
                    <form id="addArtistSongForm">
                        <div style="max-height:300px;overflow-y:auto;">
                            <div class="form-group">
                                <label class="form-label">Select Songs from Library (hold Ctrl/Cmd to select multiple)</label>
                                <select class="form-input" id="asSong" multiple style="height:160px;">
                                    ${songs.map(s => `<option value="${s.id}">${s.title} - ${s.artist} (${s.movie || 'N/A'})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-divider" style="margin:12px 0;border-top:1px solid #333;text-align:center;color:#888;font-size:12px;">OR</div>
                            <div class="form-group">
                                <label class="form-label">Upload MP3 File(s)</label>
                                <div class="file-upload-area" id="fileUploadArea" style="border:2px dashed #444;border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:border 0.3s;">
                                    <i class="fas fa-cloud-upload-alt" style="font-size:24px;color:#888;margin-bottom:10px;"></i>
                                    <p style="margin:5px 0;color:#888;">Drop MP3 file(s) here or click to browse</p>
                                    <p style="margin:5px 0;font-size:11px;color:#666;">MP3 format, max 10MB each</p>
                                    <input type="file" id="mp3FileInput" accept=".mp3,audio/*" multiple style="display:none;">
                                </div>
                            </div>
                            <div id="mp3FilesContainer"></div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Duration (for uploads)</label>
                            <input type="text" class="form-input" id="addSongDuration" placeholder="e.g. 3:45">
                        </div>
                        <button type="button" class="builder-btn primary" onclick="addSongToArtistCollection('${hitId}')" style="margin-top:12px;">
                            <i class="fas fa-plus"></i> Add Selected Songs
                        </button>
                    </form>
                </div>
                
                <div class="form-actions" style="margin-top:24px;">
                    <button class="builder-btn primary" onclick="saveArtistSongs('${hitId}')"><i class="fas fa-save"></i> Save All Changes</button>
                    <button class="builder-btn" onclick="document.getElementById('editArtistSongsModal').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    let uploadedFilesData = [];
    let currentUploadIndex = 0;

    const fileInput = document.getElementById('mp3FileInput');
    const uploadArea = document.getElementById('fileUploadArea');

    if (fileInput && uploadArea) {
        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#00aaff';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#444';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#444';
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
            }
        });

        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files);
            if (!files.length) return;

            uploadedFilesData = [];
            const container = document.getElementById('mp3FilesContainer');
            container.innerHTML = '';

            files.forEach((file, i) => {
                if (!file.name.toLowerCase().endsWith('.mp3')) {
                    showToast(`Skipping ${file.name}: Only MP3 files allowed`, 'warning');
                    return;
                }
                if (file.size > 10 * 1024 * 1024) {
                    showToast(`Skipping ${file.name}: Exceeds 10MB limit`, 'warning');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadedFilesData[i] = {
                        data: e.target.result,
                        name: file.name.replace(/\.mp3$/i, ''),
                        size: file.size
                    };
                    const info = document.createElement('div');
                    info.style.cssText = 'padding:6px 10px;background:rgba(0,170,255,0.1);border-radius:6px;margin-top:4px;font-size:12px;color:#00aaff;';
                    info.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                    container.appendChild(info);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    const selectAllCb = document.getElementById('selectAllSongs');
    if (selectAllCb) {
        selectAllCb.addEventListener('change', function() {
            document.querySelectorAll('.song-select-cb').forEach(cb => cb.checked = this.checked);
            updateBulkRemoveBtn();
        });
    }

    window._currentUploadedFilesData = [];
    renderEditArtistSongsTable(hitId);
}

function deleteArtistHit(id) {
    if (!confirm('Move this artist hit to Trash?')) return;
    const artistHits = DataStore._getRaw(DataStore.KEYS.ARTIST_HITS) || [];
    const hit = artistHits.find(h => h.id === id);
    if (hit) DataStore.moveToTrash(hit, 'artistHits');
    localStorage.setItem(DataStore.KEYS.ARTIST_HITS, JSON.stringify(artistHits.filter(h => h.id !== id)));
    showToast('Artist hit moved to Trash', 'success');
    loadArtistHits();
    syncToLiveWebsite();
}

function updateArtistName(hitId) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit) { showToast('Artist not found', 'error'); return; }
    
    const newArtist = document.getElementById('editAhArtist')?.value.trim();
    const newName = document.getElementById('editAhName')?.value.trim();
    
    if (!newArtist || !newName) {
        showToast('Artist ID and Display Name are required', 'error');
        return;
    }
    
    const oldName = hit.artist;
    hit.artist = newArtist;
    hit.name = newName;
    
    DataStore.setArtistHits(artistHits);
    showToast(`Artist updated: ${oldName} â†’ ${newArtist}`, 'success');
    loadArtistHits();
    syncToLiveWebsite();
    
    const header = document.querySelector('#editArtistSongsModal .modal-header h2');
    if (header) header.textContent = `Edit Artist: ${newName}`;
}

function updateBulkRemoveBtn() {
    const checked = document.querySelectorAll('.song-select-cb:checked');
    const btn = document.getElementById('bulkRemoveBtn');
    if (btn) {
        btn.style.display = checked.length > 0 ? '' : 'none';
        btn.innerHTML = `<i class="fas fa-trash"></i> Remove Selected (${checked.length})`;
    }
}

function bulkRemoveSongsFromArtist(hitId) {
    const checked = document.querySelectorAll('.song-select-cb:checked');
    if (checked.length === 0) {
        showToast('No songs selected', 'warning');
        return;
    }
    if (!confirm(`Remove ${checked.length} song(s) from the collection?`)) return;
    
    const indices = Array.from(checked).map(cb => parseInt(cb.dataset.index)).sort((a, b) => b - a);
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit || !hit.songs) return;
    
    indices.forEach(idx => hit.songs.splice(idx, 1));
    hit.songCount = hit.songs.length;
    
    DataStore.setArtistHits(artistHits);
    showToast(`${indices.length} song(s) removed`, 'success');
    renderEditArtistSongsTable(hitId);
    loadArtistHits();
    syncToLiveWebsite();
}

// ============================================
// Artist Hits Songs Management
// ============================================
function loadArtistSongCollections() {
    const select = document.getElementById('artistSongCollection');
    if (!select) return;
    const artistHits = DataStore.getArtistHits();
    select.innerHTML = '<option value="">-- Select Artist --</option>' +
        artistHits.map(hit => `<option value="${hit.id}">${hit.name} (${hit.artist})</option>`).join('');
}

function openAddArtistSongModal() {
    const collectionId = document.getElementById('artistSongCollection').value;
    if (!collectionId) {
        showToast('Please select an artist collection first', 'error');
        return;
    }

    const songs = DataStore.getSongs();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'artistSongModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content" style="max-width:700px;">
            <div class="modal-header">
                <h2>Add Song to Collection</h2>
                <button class="modal-close" onclick="document.getElementById('artistSongModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="artistSongForm">
                    <div class="form-group">
                        <label class="form-label">Select Song from Library</label>
                        <select class="form-input" id="asSong">
                            <option value="">-- Select Song --</option>
                            ${songs.map(s => `<option value="${s.id}">${s.title} - ${s.artist} (${s.movie})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-divider" style="margin:20px 0;border-top:1px solid #333;text-align:center;color:#888;font-size:12px;">OR</div>
                    <div class="form-group">
                        <label class="form-label">Upload MP3 File</label>
                        <div class="file-upload-area" id="fileUploadArea" style="border:2px dashed #444;border-radius:8px;padding:30px;text-align:center;cursor:pointer;transition:border 0.3s;">
                            <i class="fas fa-cloud-upload-alt" style="font-size:24px;color:#888;margin-bottom:10px;"></i>
                            <p style="margin:5px 0;color:#888;">Drop MP3 file here or click to browse</p>
                            <p style="margin:5px 0;font-size:11px;color:#666;">MP3 format, max 10MB</p>
                            <input type="file" id="mp3FileInput" accept=".mp3,audio/*" style="display:none;">
                        </div>
                    </div>
                    <div class="form-group" id="mp3InfoGroup" style="display:none;">
                        <label class="form-label">Song Title</label>
                        <input type="text" class="form-input" id="asTitle" placeholder="Enter song title">
                    </div>
                    <div class="form-group" id="mp3ArtistGroup" style="display:none;">
                        <label class="form-label">Artist</label>
                        <input type="text" class="form-input" id="asArtist" placeholder="Enter artist name">
                    </div>
                    <div class="form-group" id="mp3MovieGroup" style="display:none;">
                        <label class="form-label">Movie</label>
                        <input type="text" class="form-input" id="asMovie" placeholder="Enter movie name (optional)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Duration</label>
                        <input type="text" class="form-input" id="asDuration" placeholder="e.g. 3:45">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add Song</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('artistSongModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    let uploadedFileData = null;

    const fileInput = document.getElementById('mp3FileInput');
    const uploadArea = document.getElementById('fileUploadArea');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#00aaff';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#444';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#444';
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
        }
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.mp3')) {
            showToast('Only MP3 files are allowed', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showToast('File size exceeds 10MB limit', 'error');
            return;
        }

        uploadArea.innerHTML = `<i class="fas fa-file-audio" style="font-size:24px;color:#00aaff;"></i><p style="margin:5px 0;color:#00aaff;">${file.name}</p><p style="font-size:11px;color:#888;">${(file.size / 1024 / 1024).toFixed(2)} MB</p>`;

        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedFileData = e.target.result;
            document.getElementById('mp3InfoGroup').style.display = 'block';
            document.getElementById('mp3ArtistGroup').style.display = 'block';
            document.getElementById('mp3MovieGroup').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('artistSongForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const songId = document.getElementById('asSong').value;
        const duration = document.getElementById('asDuration').value.trim();

        const artistHits = DataStore.getArtistHits();
        const hit = artistHits.find(h => h.id === collectionId);
        if (!hit) {
            showToast('Artist collection not found', 'error');
            return;
        }
        if (!hit.songs) hit.songs = [];

        let songData;

        if (uploadedFileData) {
            const title = document.getElementById('asTitle').value.trim();
            const artist = document.getElementById('asArtist').value.trim();
            const movie = document.getElementById('asMovie').value.trim();
            if (!title || !artist) {
                showToast('Please enter title and artist', 'error');
                return;
            }
            songData = {
                songId: 'uploaded_' + Date.now(),
                id: 'uploaded_' + Date.now(),
                title: title,
                artist: artist,
                movie: movie || '',
                duration: duration || 'N/A',
                audioUrl: uploadedFileData,
                albumCover: ''
            };
        } else if (songId) {
            const song = songs.find(s => s.id === songId);
            if (!song) {
                showToast('Please select a song', 'error');
                return;
            }
            songData = {
                songId: song.id,
                title: song.title,
                artist: song.artist,
                movie: song.movie,
                duration: duration || song.duration || 'N/A',
                audioUrl: song.audioUrl || '',
                albumCover: song.albumCover || ''
            };
        } else {
            showToast('Please select a song or upload an MP3 file', 'error');
            return;
        }

        if (hit.songs.find(s => s.songId === songData.songId)) {
            showToast('Song already in this collection', 'warning');
            return;
        }

         hit.songs.push(songData);
        hit.songCount = hit.songs.length;
        DataStore.setArtistHits(artistHits);
        showToast('Song added to collection!', 'success');
        modal.remove();
        loadArtistSongs(collectionId);
        loadArtistSongCollections();
    });
}

function loadArtistSongs(collectionId) {
    const tableBody = document.getElementById('artistSongsTable');
    if (!tableBody) return;
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === collectionId);
    if (!hit || !hit.songs || !hit.songs.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">No songs in this collection. Add songs using the button above.</td></tr>';
        return;
    }
    tableBody.innerHTML = hit.songs.map((song, idx) => `
        <tr>
            <td>${song.title || 'Untitled'}</td>
            <td>${song.artist || 'Unknown'}</td>
            <td>${song.movie || 'N/A'}</td>
            <td>${song.duration || 'N/A'}</td>
            <td>
                <div class="actions">
                    <button class="action-btn delete" onclick="deleteArtistSong('${collectionId}',${idx})" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function deleteArtistSong(collectionId, songIndex) {
    const artistHits = DataStore._getRaw(DataStore.KEYS.ARTIST_HITS) || [];
    const hit = artistHits.find(h => h.id === collectionId);
    if (!hit || !hit.songs) return;
    const removed = hit.songs.splice(songIndex, 1);
    hit.songCount = hit.songs.length;
    localStorage.setItem(DataStore.KEYS.ARTIST_HITS, JSON.stringify(artistHits));
    showToast('Song removed from collection', 'success');
    loadArtistSongs(collectionId);
    loadArtistHits();
    loadArtistSongCollections();
    syncToLiveWebsite();
}

// ============================================
// Edit Artist Songs Page Functions
// ============================================
function switchArtistSongTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    
    document.getElementById('manageSongsTab').style.display = tabName === 'manage' ? 'block' : 'none';
    document.getElementById('addSongTab').style.display = tabName === 'add' ? 'block' : 'none';
}

function renderEditArtistSongsTable(hitId) {
    const tableBody = document.getElementById('editArtistSongsTable');
    if (!tableBody) return;
    
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit || !hit.songs) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">No songs yet. Go to Add Songs tab to add some.</td></tr>';
        return;
    }
    
    tableBody.innerHTML = hit.songs.map((song, idx) => `
        <tr>
            <td style="text-align:center;"><input type="checkbox" class="song-select-cb" data-index="${idx}" onchange="updateBulkRemoveBtn()"></td>
            <td style="text-align:center;font-weight:bold;">
                <span class="drag-handle" style="cursor:move;color:#888;margin-right:5px;">â‰¡</span>
                ${idx + 1}
            </td>
            <td>${song.title || 'Untitled'}</td>
            <td>${song.artist || 'Unknown'}</td>
            <td>${song.movie || 'N/A'}</td>
            <td>${song.duration || 'N/A'}</td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="editArtistSongInCollection('${hitId}', ${idx})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="removeSongFromArtistCollection('${hitId}', ${idx})" title="Remove"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
    
    setupSongDragAndDrop(hitId);
    updateBulkRemoveBtn();
}

function setupSongDragAndDrop(hitId) {
    const tableBody = document.getElementById('editArtistSongsTable');
    if (!tableBody) return;
    
    let dragSrcEl = null;
    
    tableBody.addEventListener('dragstart', function(e) {
        dragSrcEl = e.target.closest('tr');
        if (!dragSrcEl) return;
        dragSrcEl.classList.add('drag-over');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragSrcEl.rowIndex);
    });
    
    tableBody.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    });
    
    tableBody.addEventListener('drop', function(e) {
        e.preventDefault();
        if (!dragSrcEl) return;
        
        const rows = Array.from(tableBody.querySelectorAll('tr'));
        const afterElement = getDragAfterElement(tableBody, e.clientY);
        const draggable = tableBody.querySelector('tr.drag-over');
        
        if (afterElement) {
            tableBody.insertBefore(draggable, afterElement);
        } else {
            tableBody.appendChild(draggable);
        }
        
        dragSrcEl.classList.remove('drag-over');
        
        // Reorder the data in localStorage
        const newRows = tableBody.querySelectorAll('tr');
        const artistHits = DataStore.getArtistHits();
        const hit = artistHits.find(h => h.id === hitId);
        if (hit && hit.songs) {
            const newSongs = Array.from(newRows).map((row, idx) => {
                const originalIdx = parseInt(row.dataset.originalIdx) || 0;
                return hit.songs[originalIdx] || hit.songs[idx];
            }).filter(s => s);
            
            // Store the new order based on current DOM position
            const reorderedSongs = [];
            newRows.forEach((row, newIdx) => {
                const originalIdx = parseInt(row.dataset.originalIdx);
                if (originalIdx >= 0 && originalIdx < hit.songs.length) {
                    reorderedSongs[newIdx] = hit.songs[originalIdx];
                }
            });
            
            if (reorderedSongs.length === hit.songs.length) {
                hit.songs = reorderedSongs;
                DataStore.setArtistHits(artistHits);
            }
        }
    });
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('tr:not(.drag-over)')];
        let closest = null;
        let closestOffset = Number.NEGATIVE_INFINITY;
        
        draggableElements.forEach(child => {
            const rect = child.getBoundingClientRect();
            const offset = y - (rect.top + rect.height / 2);
            if (offset < 0 && offset > closestOffset) {
                closest = child;
                closestOffset = offset;
            }
        });
        
        return closest;
    }
}

function editArtistSongInCollection(hitId, songIndex) {
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit || !hit.songs || !hit.songs[songIndex]) return;
    
    const song = hit.songs[songIndex];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editSongModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Song</h2>
                <button class="modal-close" onclick="document.getElementById('editSongModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="editSongForm">
                    <div class="form-group">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-input" id="editSongTitle" value="${song.title || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Artist</label>
                        <input type="text" class="form-input" id="editSongArtist" value="${song.artist || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Movie</label>
                        <input type="text" class="form-input" id="editSongMovie" value="${song.movie || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Duration</label>
                        <input type="text" class="form-input" id="editSongDuration" value="${song.duration || ''}">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('editSongModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('editSongForm').addEventListener('submit', (e) => {
        e.preventDefault();
        hit.songs[songIndex] = {
            ...song,
            title: document.getElementById('editSongTitle').value.trim(),
            artist: document.getElementById('editSongArtist').value.trim(),
            movie: document.getElementById('editSongMovie').value.trim(),
            duration: document.getElementById('editSongDuration').value.trim()
        };
        DataStore.setArtistHits(artistHits);
        showToast('Song updated!', 'success');
        modal.remove();
        renderEditArtistSongsTable(hitId);
        syncToLiveWebsite();
    });
}

function removeSongFromArtistCollection(hitId, songIndex) {
    if (!confirm('Remove this song from the collection?')) return;
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === hitId);
    if (!hit || !hit.songs) return;
    hit.songs.splice(songIndex, 1);
    hit.songCount = hit.songs.length;
    DataStore.setArtistHits(artistHits);
    showToast('Song removed', 'success');
    renderEditArtistSongsTable(hitId);
    loadArtistHits();
    syncToLiveWebsite();
}

function addSongToArtistCollection(hitId) {
    const collectionId = hitId;
    const artistHits = DataStore.getArtistHits();
    const hit = artistHits.find(h => h.id === collectionId);
    if (!hit) {
        showToast('Artist collection not found', 'error');
        return;
    }
    if (!hit.songs) hit.songs = [];

    const songs = DataStore.getSongs();
    const songId = document.getElementById('asSong').value;
    const duration = document.getElementById('addSongDuration')?.value.trim() || document.getElementById('asDuration')?.value.trim() || '';
    const uploadedFileData = window._currentUploadedFileData || null;

    let songData;

    if (uploadedFileData) {
        console.log('Adding uploaded MP3 song to collection');
        const title = document.getElementById('asTitle')?.value.trim();
        const artist = document.getElementById('asArtist')?.value.trim();
        const movie = document.getElementById('asMovie')?.value.trim();
        if (!title || !artist) {
            showToast('Please enter title and artist', 'error');
            return;
        }
        songData = {
            songId: 'uploaded_' + Date.now(),
            id: 'uploaded_' + Date.now(),
            title: title,
            artist: artist,
            movie: movie || '',
            duration: duration || 'N/A',
            audioUrl: uploadedFileData,
            albumCover: ''
        };
    } else if (songId) {
        const song = songs.find(s => s.id === songId);
        if (!song) {
            showToast('Please select a song', 'error');
            return;
        }
        
        if (hit.songs.find(s => s.songId === song.id)) {
            showToast('Song already in this collection', 'warning');
            return;
        }
        
        songData = {
            songId: song.id,
            title: song.title,
            artist: song.artist,
            movie: song.movie,
            duration: duration || song.duration || 'N/A',
            audioUrl: song.audioUrl || '',
            albumCover: song.albumCover || ''
        };
    } else {
        showToast('Please select a song from the library or upload an MP3 file', 'error');
        return;
    }

    hit.songs.push(songData);
    hit.songCount = hit.songs.length;
    DataStore.setArtistHits(artistHits);
    showToast('Song added to collection!', 'success');
    
    // Reset form
    document.getElementById('asSong') && (document.getElementById('asSong').value = '');
    document.getElementById('asDuration') && (document.getElementById('asDuration').value = '');
    document.getElementById('addSongDuration') && (document.getElementById('addSongDuration').value = '');
    document.getElementById('asTitle') && (document.getElementById('asTitle').value = '');
    document.getElementById('asArtist') && (document.getElementById('asArtist').value = '');
    document.getElementById('asMovie') && (document.getElementById('asMovie').value = '');
    
    // Reset uploaded file data
    window._currentUploadedFileData = null;
    
    // Reset file upload area
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.innerHTML = `<i class="fas fa-cloud-upload-alt" style="font-size:24px;color:#888;margin-bottom:10px;"></i><p style="margin:5px 0;color:#888;">Drop MP3 file here or click to browse</p><p style="margin:5px 0;font-size:11px;color:#666;">MP3 format, max 10MB</p><input type="file" id="mp3FileInput" accept=".mp3,audio/*" style="display:none;">`;
    }
    
    // Switch back to manage tab
    switchArtistSongTab('manage');
    renderEditArtistSongsTable(hitId);
    loadArtistHits();
    syncToLiveWebsite();
}

function saveArtistSongs(hitId) {
    const modal = document.getElementById('editArtistSongsModal');
    if (modal) modal.remove();
    loadArtistHits();
    loadArtistSongCollections();
    syncToLiveWebsite();
    showToast('Artist songs saved and published!', 'success');
}

function setupArtistHitsSubTabs() {
    const artistHitsTab = document.getElementById('artistHitsTab');
    if (!artistHitsTab) return;

    artistHitsTab.querySelectorAll('.artist-hit-sub-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.artistTab;
            artistHitsTab.querySelectorAll('.artist-hit-sub-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const listTab = artistHitsTab.querySelector('#artistListTab');
            const songsTab = artistHitsTab.querySelector('#artistSongsTab');

            if (tabName === 'artistList') {
                if (listTab) listTab.style.display = '';
                if (songsTab) songsTab.style.display = 'none';
            } else if (tabName === 'artistSongs') {
                if (listTab) listTab.style.display = 'none';
                if (songsTab) songsTab.style.display = '';
                loadArtistSongCollections();
            }
        });
    });

    const collectionSelect = document.getElementById('artistSongCollection');
    if (collectionSelect) {
        collectionSelect.addEventListener('change', function() {
            const collectionId = this.value;
            if (collectionId) {
                loadArtistSongs(collectionId);
            } else {
                const tableBody = document.getElementById('artistSongsTable');
                if (tableBody) tableBody.innerHTML = '';
            }
        });
    }
}

// ============================================
// Movie / Yearly / Latest Collections Management
// ============================================
function getCollectionsByType(type) {
    if (type === 'movies') return DataStore.getMoviesCollections();
    if (type === 'yearly') return DataStore.getYearlyCollections();
    if (type === 'latest') return DataStore.getLatestCollections();
    return [];
}

function setCollectionsByType(type, data) {
    if (type === 'movies') DataStore.setMoviesCollections(data);
    else if (type === 'yearly') DataStore.setYearlyCollections(data);
    else if (type === 'latest') DataStore.setLatestCollections(data);
}

function loadCollectionsTable(type) {
    const tableId = type + 'CollectionsTable';
    const tableBody = document.getElementById(tableId);
    if (!tableBody) return;
    
    const collections = getCollectionsByType(type);
    if (!collections.length) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#888;">No collections yet</td></tr>';
        return;
    }
    
    tableBody.innerHTML = collections.map(col => `
        <tr>
            <td><strong>${col.name}</strong></td>
            <td>${(col.songs && col.songs.length) || col.songCount || 0}</td>
            <td><span class="status-badge ${col.status === 'active' ? 'active' : 'inactive'}">${col.status || 'active'}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="openEditCollectionModal('${type}', '${col.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteCollection('${type}', '${col.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function loadMusicCollections() {
    let collections = DataStore.getMusicCollections();
    collections = _filterDeletedItems(collections, 'musicCollections');
    const collectionsList = document.getElementById('musicCollectionsList');
    
    // Populate the "Select Songs" multi-select in the create-collection form
    populateCollectionSongs();
    
    if (!collections.length) {
        collectionsList.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center; color: #888;"><i class="fas fa-folder"></i><p>No collections yet. Create your first collection.</p></div>';
        return;
    }
    
    collectionsList.innerHTML = collections.map(col => `
        <div class="collection-card" style="border-left: 4px solid var(--emerald-400); margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; transition: all 0.3s;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div style="flex: 1; display: flex; align-items: center; gap: 12px;">
                    ${col.thumbnail
                        ? `<img src="${col.thumbnail}" alt="" style="width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">`
                        : '<div style="width: 56px; height: 56px; border-radius: 8px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; font-size: 22px;">ðŸŽµ</div>'}
                    <div>
                        <h3 style="margin: 0; font-size: 16px; color: #fff;">${col.name}</h3>
                        <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.6);">${col.description || ''}</p>
                    </div>
                </div>
                <span style="font-size: 12px; color: var(--emerald-400);">${col.songCount || 0} songs</span>
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5);">${col.type || 'Music Collection'}</div>
            <div style="margin-top: 8px;">
                <button class="small-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 4px; font-size: 12px;" onclick="playCollectionSongs('${col.id}', 'music')">
                    <i class="fas fa-play"></i> Play
                </button>
                <button class="small-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 4px; font-size: 12px; margin-left: 8px;" onclick="openEditCollectionModalMusic('${col.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="small-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 4px; font-size: 12px; margin-left: 8px;" onclick="deleteMusicCollection('${col.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function openAddCollectionModalMusic() {
    const songs = DataStore.getSongs();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'musicCollectionModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('musicCollectionModal').remove()"></div>
        <div class="modal-content" style="max-width:800px;max-height:90vh;">
            <div class="modal-header">
                <h2>Create Music Collection</h2>
                <button class="modal-close" onclick="document.getElementById('musicCollectionModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Collection Name *</label>
                    <input type="text" class="form-input" id="colMusicName" required placeholder="e.g. 2026 Collection">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <input type="text" class="form-input" id="colMusicDescription" placeholder="Optional description">
                </div>
                <div class="form-group">
                    <label class="form-label">Cover / Poster Image URL</label>
                    <input type="text" class="form-input" id="colMusicThumbnail" placeholder="https://â€¦ or /uploads/cover.jpg (optional)">
                    <div id="colMusicThumbPreview" style="margin-top:8px;display:none;"><img src="" alt="Preview" style="max-width:140px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Select Songs</label>
                    <select class="form-input" id="colMusicSongs" multiple style="height:300px;">
                        ${songs.map(s => `<option value="${s.id}|${s.title}|${s.artist}|${s.movie || ''}|${s.thumbnail || ''}">${s.title} - ${s.artist}${s.movie ? ` (${s.movie})` : ''}</option>`).join('')}
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="builder-btn primary" onclick="saveMusicCollection()">
                        <i class="fas fa-save"></i> Create Collection
                    </button>
                    <button type="button" class="builder-btn" onclick="document.getElementById('musicCollectionModal').remove()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveMusicCollection() {
    const name = document.getElementById('colMusicName').value.trim();
    const description = document.getElementById('colMusicDescription').value.trim();
    const thumbnail = document.getElementById('colMusicThumbnail').value.trim() || '';
    const songsSelect = document.getElementById('colMusicSongs');
    const selectedOptions = songsSelect ? Array.from(songsSelect.selectedOptions) : [];
    
    if (!name) {
        showToast('Collection name is required', 'error');
        return;
    }
    
    const songs = selectedOptions.map(id => {
        const parts = id.value.split('|');
        return {
            songId: parts[0],
            title: parts[1] || '',
            artist: parts[2] || '',
            movie: parts[3] || '',
            thumbnail: parts[4] || ''
        };
    });
    
    const collection = {
        id: 'music_' + Date.now(),
        name: name,
        description: description,
        thumbnail: thumbnail,
        songs: songs,
        type: 'music',
        status: 'active',
        createdAt: new Date().toISOString(),
        songCount: songs.length
    };
    
    const collections = DataStore.getMusicCollections();
    collections.push(collection);
    DataStore.setMusicCollections(collections);
    
        showToast('Collection created successfully', 'success');
    document.getElementById('musicCollectionModal').remove();
    loadMusicCollections();
    syncToLiveWebsite();
}

// ------------------------------------------------------------------
// Inline Music Collection Form (builder.html â€“ "Create New Collection")
// ------------------------------------------------------------------

/**
 * Save a music collection from the inline form on the Music Collections
 * page. Reads every field (name, description, thumbnail, songs, status,
 * colour theme) and persists it via DataStore.
 */
function createCollectionFromForm() {
    const nameEl = document.getElementById('collectionName');
    if (!nameEl) return;

    const name = nameEl.value.trim();
    if (!name) {
        showToast('Please enter a collection name', 'error');
        nameEl.focus();
        return;
    }

    const descEl = document.getElementById('collectionDescription');
    const thumbEl = document.getElementById('collectionThumbnail');
    const colorEl = document.getElementById('collectionColor');
    const statusEl = document.getElementById('collectionStatus');
    const songsEl = document.getElementById('collectionSongs');

    const description = descEl ? descEl.value.trim() : '';
    const thumbnail = thumbEl ? thumbEl.value.trim() : '';
    const colorTheme = colorEl ? colorEl.value : 'emerald';
    const status = statusEl ? statusEl.value : 'active';

    // Gather selected songs from the multi-select
    const selectedSongs = [];
    if (songsEl) {
        Array.from(songsEl.selectedOptions).forEach(opt => {
            if (!opt.value) return;
            const parts = opt.value.split('||');
            selectedSongs.push({
                songId: parts[0],
                title: parts[1] || '',
                artist: parts[2] || '',
                movie: parts[3] || '',
                thumbnail: parts[4] || ''
            });
        });
    }

    // Pick up songs uploaded via the folder/audio upload widget
    const uploadedSongs = window._collectionUploadedSongs || [];

    const collection = {
        id: 'music_' + Date.now(),
        name: name,
        description: description,
        thumbnail: thumbnail,
        type: 'music',
        status: status,
        colorTheme: colorTheme,
        songs: selectedSongs.length ? selectedSongs : uploadedSongs,
        songCount: (selectedSongs.length || uploadedSongs.length),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.uid || 'admin'
    };

    const collections = DataStore.getMusicCollections();
    collections.push(collection);
    DataStore.setMusicCollections(collections);

    showToast('Collection created successfully!', 'success');
    addActivity('Collection Created', name);
    resetCollectionForm();
    loadMusicCollections();
    syncToLiveWebsite();
}

/**
 * Reset the inline "Create New Collection" form to its default state.
 */
function resetCollectionForm() {
    const nameEl = document.getElementById('collectionName');
    const descEl = document.getElementById('collectionDescription');
    const thumbEl = document.getElementById('collectionThumbnail');
    const colorEl = document.getElementById('collectionColor');
    const statusEl = document.getElementById('collectionStatus');
    const songsEl = document.getElementById('collectionSongs');
    const preview = document.getElementById('collectionThumbPreview');
    const filesContainer = document.getElementById('collectionAudioListContainer');
    const filesList = document.getElementById('collectionAudioList');

    if (nameEl) nameEl.value = '';
    if (descEl) descEl.value = '';
    if (thumbEl) thumbEl.value = '';
    if (colorEl) colorEl.value = 'emerald';
    if (statusEl) statusEl.value = 'active';
    if (songsEl) songsEl.selectedIndex = -1;
    if (preview) preview.style.display = 'none';
    if (filesContainer) filesContainer.style.display = 'none';
    if (filesList) filesList.innerHTML = '';

        window._collectionUploadedSongs = [];
}

/**
 * Handle audio / folder uploads for the Music Collection form.
 * Supports selecting individual audio files or an entire folder
 * (webkitdirectory). Each audio file is uploaded to R2 and a song
 * entry is created automatically.
 */
async function handleCollectionAudioUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const audioFiles = files.filter(f =>
        f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(f.name)
    );

    if (!audioFiles.length) {
        showToast('No audio files found in your selection', 'error');
        return;
    }

    const filesContainer = document.getElementById('collectionAudioListContainer');
    const filesList = document.getElementById('collectionAudioList');
    if (filesContainer) filesContainer.style.display = 'block';
    if (filesList) filesList.innerHTML = '';

    window._collectionUploadedSongs = window._collectionUploadedSongs || [];
    let uploaded = 0;

    for (const file of audioFiles) {
        const row = document.createElement('div');
        row.className = 'file-upload-item';
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:rgba(255,255,255,0.7);';
        row.innerHTML = '<span style="flex:1;"><i class="fas fa-music"></i> ' + file.name + ' (' + formatFileSize(file.size) + ')</span><span class="status">Uploadingâ€¦</span>';
        if (filesList) filesList.appendChild(row);

        try {
            const result = await R2Uploader.uploadAudio(
                file,
                'tamil-ai-stream/audio',
                (pct) => {
                    const statusSpan = row.querySelector('.status');
                    if (statusSpan) statusSpan.textContent = 'Uploading ' + pct + '%';
                }
            );

            const song = {
                id: 'song_' + Date.now() + '_' + uploaded,
                title: file.name.replace(/\.[^.]+$/, ''),
                artist: '', album: '', movie: '',
                src: result.url,
                duration: '0:00',
                size: formatFileSize(file.size),
                format: result.format || 'mp3',
                thumbnail: '',
                year: new Date().getFullYear(),
                language: 'Tamil',
                genre: [], mood: [],
                status: 'active', plays: 0,
                createdAt: new Date().toISOString()
            };

            const songs = DataStore.getSongs();
            songs.unshift(song);
            DataStore.setSongs(songs);

            window._collectionUploadedSongs.push(song);
            uploaded++;

            row.querySelector('.status').textContent = 'Done';
            row.querySelector('.status').style.color = 'var(--emerald-400)';

        } catch (err) {
            console.error('Audio upload error:', err);
            row.querySelector('.status').textContent = 'Failed';
            row.querySelector('.status').style.color = '#ef4444';
            showToast('Failed: ' + file.name, 'error');
        }
    }

    e.target.value = '';

    if (uploaded > 0) {
        showToast(uploaded + ' audio file(s) uploaded & added to song library!', 'success');
        loadAllSongs();
        populateCollectionSongs();
    }
}

/**
 * Populate the "Select Songs" multi-select in the collection form
 * with all existing songs from the DataStore.
 */
function populateCollectionSongs() {
    const songs = DataStore.getSongs();
    const select = document.getElementById('collectionSongs');
    if (!select) return;

    if (!songs.length) {
        select.innerHTML = '<option value="">-- No songs in library --</option>';
        return;
    }

    select.innerHTML = songs.map(s => {
        const value = s.id + '||' + (s.title || '') + '||' + (s.artist || '') + '||' + (s.movie || '') + '||' + (s.thumbnail || '');
        const label = (s.title || 'Untitled') + (s.artist ? ' â€” ' + s.artist : '') + (s.movie ? ' (' + s.movie + ')' : '');
        return '<option value="' + value + '">' + label + '</option>';
        }).join('');
}

/**
 * Pick a thumbnail from the Image Gallery. Opens a simple picker modal
 * showing all uploaded images.
 */
function useGalleryImage(inputId, previewId, imgId) {
    const images = DataStore.getImages();
    if (!images.length) {
        showToast('No images in gallery. Upload one first.', 'info');
        openUploadImageModal();
        return;
    }

    const existing = document.getElementById('galleryPickerModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'galleryPickerModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML =
        '<div class="modal-overlay" onclick="document.getElementById(\'galleryPickerModal\').remove()"></div>' +
        '<div class="modal-content" style="max-width:600px;">' +
        '<div class="modal-header">' +
        '<h2>Select Thumbnail</h2>' +
        '<button class="modal-close" onclick="document.getElementById(\'galleryPickerModal\').remove()">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="max-height:400px;overflow-y:auto;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;">' +
        images.map(img =>
            '<div style="text-align:center;cursor:pointer;" onclick="pickGalleryImage(\'' + img.url + '\',\'' + inputId + '\',\'' + previewId + '\',\'' + imgId + '\');document.getElementById(\'galleryPickerModal\').remove();">' +
            '<img src="' + img.url + '" style="width:80px;height:80px;border-radius:8px;object-fit:cover;">' +
            '<div style="font-size:10px;color:#aaa;margin-top:4px;word-break:break-all;">' + (img.title || 'Image') + '</div>' +
            '</div>'
        ).join('') +
        '</div>' +
        '</div>' +
        '</div>';
    document.body.appendChild(modal);
}

/**
 * Fill the thumbnail input and preview when an image is picked from the gallery.
 */
function pickGalleryImage(url, inputId, previewId, imgId) {
    document.getElementById(inputId).value = url;
    const imgEl = document.getElementById(imgId);
    const previewEl = document.getElementById(previewId);
    if (imgEl) imgEl.src = url;
    if (previewEl) previewEl.style.display = 'flex';
}

function deleteMusicCollection(id) {
    if (confirm('Move this collection to Trash?')) {
        let collections = DataStore._getRaw(DataStore.KEYS.MUSIC_COLLECTIONS) || [];
        const col = collections.find(c => c.id === id);
        if (col) DataStore.moveToTrash(col, 'musicCollections');
        collections = collections.filter(c => c.id !== id);
        localStorage.setItem(DataStore.KEYS.MUSIC_COLLECTIONS, JSON.stringify(collections));
        showToast('Collection moved to Trash', 'info');
        loadMusicCollections();
        syncToLiveWebsite();
    }
}

function openEditCollectionModalMusic(id) {
    const collections = DataStore.getMusicCollections();
    const collection = collections.find(c => c.id === id);
    if (!collection) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editMusicCollectionModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('editMusicCollectionModal').remove()"></div>
        <div class="modal-content" style="max-width:800px;max-height:90vh;">
            <div class="modal-header">
                <h2>Edit Collection: ${collection.name}</h2>
                <button class="modal-close" onclick="document.getElementById('editMusicCollectionModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Collection Name *</label>
                    <input type="text" class="form-input" id="editColName" value="${collection.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <input type="text" class="form-input" id="editColDescription" value="${collection.description || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Cover / Poster Image URL</label>
                    <input type="text" class="form-input" id="editColThumbnail" value="${collection.thumbnail || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Select Songs</label>
                    <select class="form-input" id="editColSongs" multiple style="height:300px;">
                        ${DataStore.getSongs().map(s => {
                            const hasSong = collection.songs.some(cs => cs.songId === s.id);
                            return `<option value="${s.id}|${s.title}|${s.artist}|${s.movie || ''}|${s.thumbnail || ''}" ${hasSong ? 'selected' : ''}>${s.title} - ${s.artist}${s.movie ? ` (${s.movie})` : ''}</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="builder-btn primary" onclick="updateMusicCollection('${collection.id}')">
                        <i class="fas fa-save"></i> Update
                    </button>
                    <button type="button" class="builder-btn" onclick="document.getElementById('editMusicCollectionModal').remove()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateMusicCollection(id) {
    const name = document.getElementById('editColName').value.trim();
    const description = document.getElementById('editColDescription').value.trim();
    const thumbnail = document.getElementById('editColThumbnail').value.trim() || '';
    const songsSelect = document.getElementById('editColSongs');
    const selectedOptions = songsSelect ? Array.from(songsSelect.selectedOptions) : [];
    
    if (!name) {
        showToast('Collection name is required', 'error');
        return;
    }
    
    const songs = selectedOptions.map(id => {
        const parts = id.value.split('|');
        return {
            songId: parts[0],
            title: parts[1] || '',
            artist: parts[2] || '',
            movie: parts[3] || '',
            thumbnail: parts[4] || ''
        };
    });
    
    let collections = DataStore.getMusicCollections();
    const collection = collections.find(c => c.id === id);
    if (collection) {
        collection.name = name;
        collection.description = description;
        collection.thumbnail = thumbnail;
        collection.songs = songs;
        collection.songCount = songs.length;
        collection.updatedAt = new Date().toISOString();
    }
    
    DataStore.setMusicCollections(collections);
    showToast('Collection updated successfully', 'success');
    document.getElementById('editMusicCollectionModal').remove();
    loadMusicCollections();
    syncToLiveWebsite();
}

function openAddCollectionModal(type) {
    const typeLabel = type === 'movies' ? 'Movie' : type === 'yearly' ? 'Yearly' : 'Latest';
    const songs = DataStore.getSongs();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'collectionModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('collectionModal').remove()"></div>
        <div class="modal-content" style="max-width:700px;max-height:90vh;">
            <div class="modal-header">
                <h2>Add ${typeLabel} Collection</h2>
                <button class="modal-close" onclick="document.getElementById('collectionModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Collection Name *</label>
                    <input type="text" class="form-input" id="colName" required placeholder="e.g. ${type === 'movies' ? 'Ponniyin Selvan Songs' : type === 'yearly' ? '2024 Hits' : 'New Releases'}">
                </div>
                <div class="form-group">
                    <label class="form-label">Thumbnail URL (optional)</label>
                    <input type="url" class="form-input" id="colThumbnail" placeholder="https://example.com/thumb.jpg">
                </div>
                <div class="form-group">
                    <label class="form-label">Select Songs (hold Ctrl/Cmd for multiple)</label>
                    <select class="form-input" id="colSongs" multiple style="height:200px;">
                        ${songs.map(s => `<option value="${s.id}">${s.title} - ${s.artist}</option>`).join('')}
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="builder-btn primary" onclick="saveCollection('${type}')">
                        <i class="fas fa-save"></i> Save Collection
                    </button>
                    <button type="button" class="builder-btn" onclick="document.getElementById('collectionModal').remove()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function openEditCollectionModal(type, colId) {
    const collections = getCollectionsByType(type);
    const col = collections.find(c => c.id === colId);
    if (!col) { showToast('Collection not found', 'error'); return; }
    
    const songs = DataStore.getSongs();
    const typeLabel = type === 'movies' ? 'Movie' : type === 'yearly' ? 'Yearly' : 'Latest';
    const selectedSongIds = (col.songs || []).map(s => s.songId || s.id);
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'collectionModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('collectionModal').remove()"></div>
        <div class="modal-content" style="max-width:700px;max-height:90vh;">
            <div class="modal-header">
                <h2>Edit ${typeLabel} Collection</h2>
                <button class="modal-close" onclick="document.getElementById('collectionModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Collection Name *</label>
                    <input type="text" class="form-input" id="colName" required value="${col.name}">
                </div>
                <div class="form-group">
                    <label class="form-label">Thumbnail URL</label>
                    <input type="url" class="form-input" id="colThumbnail" value="${col.thumbnail || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select class="form-input" id="colStatus">
                        <option value="active" ${col.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${col.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Select Songs (hold Ctrl/Cmd for multiple)</label>
                    <select class="form-input" id="colSongs" multiple style="height:200px;">
                        ${songs.map(s => `<option value="${s.id}" ${selectedSongIds.includes(s.id) ? 'selected' : ''}>${s.title} - ${s.artist}</option>`).join('')}
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="builder-btn primary" onclick="saveCollection('${type}', '${colId}')">
                        <i class="fas fa-save"></i> Update Collection
                    </button>
                    <button type="button" class="builder-btn" onclick="document.getElementById('collectionModal').remove()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveCollection(type, editId) {
    const name = document.getElementById('colName')?.value.trim();
    const thumbnail = document.getElementById('colThumbnail')?.value.trim() || '';
    const status = document.getElementById('colStatus')?.value || 'active';
    const songsSelect = document.getElementById('colSongs');
    const selectedOptions = songsSelect ? Array.from(songsSelect.selectedOptions) : [];
    
    if (!name) { showToast('Collection name is required', 'error'); return; }
    
    const allSongs = DataStore.getSongs();
    const songData = selectedOptions.map(opt => {
        const song = allSongs.find(s => s.id === opt.value);
        return song ? { songId: song.id, title: song.title, artist: song.artist, movie: song.movie, duration: song.duration } : null;
    }).filter(Boolean);
    
    const collections = getCollectionsByType(type);
    
    if (editId) {
        const col = collections.find(c => c.id === editId);
        if (col) {
            col.name = name;
            col.thumbnail = thumbnail;
            col.status = status;
            col.songs = songData;
            col.songCount = songData.length;
        }
    } else {
        collections.push({
            id: 'col_' + type + '_' + Date.now(),
            name: name,
            type: type,
            thumbnail: thumbnail,
            status: status,
            songs: songData,
            songCount: songData.length
        });
    }
    
    setCollectionsByType(type, collections);
    loadCollectionsTable(type);
    document.getElementById('collectionModal')?.remove();
    showToast(editId ? 'Collection updated!' : 'Collection created!', 'success');
    syncToLiveWebsite();
}

function deleteCollection(type, colId) {
    if (!confirm('Move this collection to Trash?')) return;
    const rawKey = type === 'movies' ? DataStore.KEYS.MOVIES_COLLECTIONS : type === 'yearly' ? DataStore.KEYS.YEARLY_COLLECTIONS : DataStore.KEYS.LATEST_COLLECTIONS;
    const collections = DataStore._getRaw(rawKey) || [];
    const col = collections.find(c => c.id === colId);
    if (col) DataStore.moveToTrash({ ...col, _collectionType: type }, 'collections');
    const filtered = collections.filter(c => c.id !== colId);
    localStorage.setItem(rawKey, JSON.stringify(filtered));
    loadCollectionsTable(type);
    showToast('Collection moved to Trash', 'success');
    syncToLiveWebsite();
}

// ============================================
// New Albums Management
// ============================================
function loadNewAlbums() {
    let albums = DataStore.getNewAlbums();
    albums = _filterDeletedItems(albums, 'newAlbums');
    const listEl = document.getElementById('newAlbumsList');
    populateAlbumSongs();

    if (!albums.length) {
        listEl.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center; color: #888;"><i class="fas fa-record-vinyl"></i><p>No albums yet. Create your first featured album.</p></div>';
        return;
    }

    listEl.innerHTML = albums.map(a => `
        <div class="collection-card" style="border-left: 4px solid #a855f7; margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div style="flex: 1; display: flex; align-items: center; gap: 12px;">
                    ${a.thumbnail
                        ? `<img src="${a.thumbnail}" alt="" style="width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">`
                        : '<div style="width: 56px; height: 56px; border-radius: 8px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; font-size: 22px;">🎵</div>'}
                    <div>
                        <h3 style="margin: 0; font-size: 16px; color: #fff;">${a.name || 'Untitled'}</h3>
                        <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.6);">${a.artist || 'Unknown'}</p>
                        <p style="margin: 2px 0 0; font-size: 11px; color: rgba(255,255,255,0.4);">${a.description ? a.description.substring(0, 80) + (a.description.length > 80 ? '…' : '') : ''}</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 12px; color: #a855f7;">${(a.tracks || []).length} track${(a.tracks || []).length !== 1 ? 's' : ''}</span>
                    <div style="margin-top: 4px;">
                        ${a.spatialAudio ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(34,211,238,0.2);color:#22d3ee;">Spatial</span>' : ''}
                        ${a.dolbyAtmos ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(168,85,247,0.2);color:#c084fc;margin-left:4px;">Atmos</span>' : ''}
                    </div>
                </div>
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5);">${a.movie || ''} · Order: ${a.order || 0} · ${a.visible !== false ? 'Visible' : 'Hidden'}</div>
            <div style="margin-top: 8px;">
                <button class="small-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 4px; font-size: 12px;" onclick="editNewAlbum('${a.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="small-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 4px; font-size: 12px; margin-left: 8px;" onclick="deleteNewAlbum('${a.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function populateAlbumSongs() {
    const songs = DataStore.getSongs();
    const select = document.getElementById('albumSongs');
    if (!select) return;
    if (!songs.length) {
        select.innerHTML = '<option value="">-- No songs in library --</option>';
        return;
    }
    select.innerHTML = songs.map(s => {
        const value = s.id + '||' + (s.title || '') + '||' + (s.artist || '') + '||' + (s.movie || '') + '||' + (s.thumbnail || '') + '||' + (s.audioUrl || s.streamUrl || '') + '||' + (s.duration || '');
        const label = (s.title || 'Untitled') + (s.artist ? ' — ' + s.artist : '') + (s.movie ? ' (' + s.movie + ')' : '');
        return '<option value="' + value + '">' + label + '</option>';
    }).join('');
}

function saveNewAlbum() {
    const editId = document.getElementById('albumEditId')?.value || '';
    const name = document.getElementById('albumName')?.value.trim();
    const artist = document.getElementById('albumArtist')?.value.trim();
    const movie = document.getElementById('albumMovie')?.value.trim() || '';
    const description = document.getElementById('albumDescription')?.value.trim() || '';
    const thumbnail = document.getElementById('albumThumbnail')?.value.trim() || '';
    const spatialAudio = document.getElementById('albumSpatialAudio')?.value === 'true';
    const dolbyAtmos = document.getElementById('albumDolbyAtmos')?.value === 'true';
    const playBtnPosition = document.getElementById('albumPlayBtnPos')?.value || 'center';
    const status = document.getElementById('albumStatus')?.value || 'active';
    const visible = document.getElementById('albumVisible')?.value !== 'false';
    const order = parseInt(document.getElementById('albumOrder')?.value, 10) || 0;

    if (!name) { showToast('Album name is required', 'error'); return; }
    if (!artist) { showToast('Artist name is required', 'error'); return; }

    const songsSelect = document.getElementById('albumSongs');
    const selectedOptions = songsSelect ? Array.from(songsSelect.selectedOptions) : [];
    const thumbInputs = document.querySelectorAll('.album-song-thumb-input');
    const thumbMap = {};
    thumbInputs.forEach(inp => { thumbMap[inp.dataset.songId] = inp.value.trim(); });

    const tracks = selectedOptions.map(opt => {
        const parts = opt.value.split('||');
        const songId = parts[0] || '';
        return {
            id: songId || ('track_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
            title: parts[1] || '',
            artist: parts[2] || '',
            movie: parts[3] || '',
            thumbnail: thumbMap[songId] || parts[4] || thumbnail,
            audioUrl: parts[5] || '',
            duration: parts[6] || 0
        };
    });

    let albums = DataStore._getRaw(DataStore.KEYS.NEW_ALBUMS) || [];
    albums = _filterDeletedItems(albums, 'newAlbums');

    if (editId) {
        const album = albums.find(a => a.id === editId);
        if (album) {
            album.name = name;
            album.artist = artist;
            album.movie = movie;
            album.description = description;
            album.thumbnail = thumbnail;
            album.spatialAudio = spatialAudio;
            album.dolbyAtmos = dolbyAtmos;
            album.playBtnPosition = playBtnPosition;
            album.status = status;
            album.visible = visible;
            album.order = order;
            album.tracks = tracks;
            album.updatedAt = new Date().toISOString();
        }
    } else {
        albums.push({
            id: 'album_' + Date.now(),
            name, artist, movie, description, thumbnail,
            spatialAudio, dolbyAtmos, playBtnPosition,
            status, visible, order,
            tracks,
            createdAt: new Date().toISOString()
        });
    }

    DataStore.setNewAlbums(albums);
    resetAlbumForm();
    loadNewAlbums();
    showToast(editId ? 'Album updated!' : 'Album created!', 'success');
    syncToLiveWebsite();
}

function editNewAlbum(id) {
    const albums = DataStore.getNewAlbums();
    const album = albums.find(a => a.id === id);
    if (!album) return;

    document.getElementById('albumEditId').value = album.id;
    document.getElementById('albumName').value = album.name || '';
    document.getElementById('albumArtist').value = album.artist || '';
    document.getElementById('albumMovie').value = album.movie || '';
    document.getElementById('albumDescription').value = album.description || '';
    document.getElementById('albumThumbnail').value = album.thumbnail || '';
    document.getElementById('albumSpatialAudio').value = album.spatialAudio ? 'true' : 'false';
    document.getElementById('albumDolbyAtmos').value = album.dolbyAtmos ? 'true' : 'false';
    document.getElementById('albumPlayBtnPos').value = album.playBtnPosition || 'center';
    document.getElementById('albumStatus').value = album.status || 'active';
    document.getElementById('albumVisible').value = album.visible !== false ? 'true' : 'false';
    document.getElementById('albumOrder').value = album.order || 0;

    if (album.thumbnail) {
        const preview = document.getElementById('albumThumbPreview');
        const img = document.getElementById('albumThumbImg');
        if (img) img.src = album.thumbnail;
        if (preview) preview.style.display = 'block';
    }

    const songsSelect = document.getElementById('albumSongs');
    if (songsSelect && album.tracks) {
        const albumTrackIds = album.tracks.map(t => t.id);
        Array.from(songsSelect.options).forEach(opt => {
            const optId = opt.value.split('||')[0];
            opt.selected = albumTrackIds.includes(optId);
        });
        setTimeout(() => refreshAlbumSongThumbnails(), 100);
    }

    document.getElementById('newAlbumForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteNewAlbum(id) {
    if (confirm('Move this album to Trash?')) {
        let albums = DataStore._getRaw(DataStore.KEYS.NEW_ALBUMS) || [];
        const album = albums.find(a => a.id === id);
        if (album) DataStore.moveToTrash(album, 'newAlbums');
        albums = albums.filter(a => a.id !== id);
        localStorage.setItem(DataStore.KEYS.NEW_ALBUMS, JSON.stringify(albums));
        showToast('Album moved to Trash', 'info');
        loadNewAlbums();
        syncToLiveWebsite();
    }
}

function resetAlbumForm() {
    document.getElementById('albumEditId').value = '';
    document.getElementById('albumName').value = '';
    document.getElementById('albumArtist').value = '';
    document.getElementById('albumMovie').value = '';
    document.getElementById('albumDescription').value = '';
    document.getElementById('albumThumbnail').value = '';
    document.getElementById('albumSpatialAudio').value = 'false';
    document.getElementById('albumDolbyAtmos').value = 'false';
    document.getElementById('albumPlayBtnPos').value = 'center';
    document.getElementById('albumStatus').value = 'active';
    document.getElementById('albumVisible').value = 'true';
    document.getElementById('albumOrder').value = '0';
    const preview = document.getElementById('albumThumbPreview');
    if (preview) preview.style.display = 'none';
    const songsSelect = document.getElementById('albumSongs');
    if (songsSelect) Array.from(songsSelect.options).forEach(o => o.selected = false);
    const thumbsContainer = document.getElementById('albumSongThumbs');
    if (thumbsContainer) thumbsContainer.innerHTML = '<div style="font-size:12px;color:#888;">Select songs above, then click "Refresh Song Thumbnails"</div>';
}

function refreshAlbumSongThumbnails() {
    const songsSelect = document.getElementById('albumSongs');
    const container = document.getElementById('albumSongThumbs');
    if (!songsSelect || !container) return;

    const selectedOptions = Array.from(songsSelect.selectedOptions);
    if (!selectedOptions.length) {
        container.innerHTML = '<div style="font-size:12px;color:#888;">No songs selected</div>';
        return;
    }

    const editId = document.getElementById('albumEditId')?.value || '';
    let existingTracks = {};
    if (editId) {
        const albums = DataStore.getNewAlbums();
        const album = albums.find(a => a.id === editId);
        if (album && album.tracks) {
            album.tracks.forEach(t => { existingTracks[t.id] = t; });
        }
    }

    container.innerHTML = selectedOptions.map((opt, i) => {
        const parts = opt.value.split('||');
        const songId = parts[0] || '';
        const title = parts[1] || 'Untitled';
        const artist = parts[2] || '';
        const existing = existingTracks[songId] || {};
        const thumbVal = existing.thumbnail || parts[4] || '';
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px;margin-bottom:6px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid rgba(255,255,255,0.08);">
                <div style="flex:0 0 48px;height:48px;border-radius:6px;overflow:hidden;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;">
                    <img src="${thumbVal}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px;display:${thumbVal ? 'block' : 'none'};" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <div style="width:48px;height:48px;display:${thumbVal ? 'none' : 'flex'};align-items:center;justify-content:center;color:#666;font-size:18px;"><i class="fas fa-music"></i></div>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);">${artist}</div>
                </div>
                <div style="flex:0 0 auto;">
                    <input type="url" class="form-input album-song-thumb-input" data-song-id="${songId}" value="${thumbVal}" placeholder="Thumbnail URL" style="width:180px;font-size:11px;padding:4px 8px;">
                    <button type="button" class="builder-btn small-btn" onclick="useGalleryImage('albumSongThumb_${songId}','albumSongThumbPrev_${songId}','albumSongThumbImg_${songId}')" style="font-size:10px;padding:3px 8px;margin-left:4px;">
                        <i class="fas fa-images"></i>
                    </button>
                </div>
            </div>`;
    }).join('');
}

// ============================================
// Quotes Management
// ============================================
function loadQuotes() {
    let quotes = DataStore.getQuotes();
    quotes = _filterDeletedItems(quotes, 'quotes');
    const tableBody = document.getElementById('quotesTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = quotes.map(quote => `
        <tr>
            <td>${quote.text}</td>
            <td><span class="status-badge ${quote.status === 'active' ? 'active' : 'inactive'}">${quote.status}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn" onclick="editQuote('${quote.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteQuote('${quote.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddQuoteModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'quoteModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Tamil Quote</h2>
                <button class="modal-close" onclick="document.getElementById('quoteModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="quoteForm">
                    <div class="form-group">
                        <label class="form-label">Quote Text *</label>
                        <textarea class="form-textarea" id="quoteText" required rows="3" placeholder="Enter Tamil quote..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-plus"></i> Add</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('quoteModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('quoteForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const quotes = DataStore.getQuotes();
        quotes.push({
            id: 'q_' + Date.now(),
            text: document.getElementById('quoteText').value.trim(),
            status: 'active'
        });
        DataStore.setQuotes(quotes);
        showToast('Quote added!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadQuotes();
    });
}

function editQuote(id) {
    const quotes = DataStore.getQuotes();
    const quote = quotes.find(q => q.id === id);
    if (!quote) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'quoteModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Quote</h2>
                <button class="modal-close" onclick="document.getElementById('quoteModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="quoteForm">
                    <div class="form-group">
                        <label class="form-label">Quote Text *</label>
                        <textarea class="form-textarea" id="quoteText" required rows="3">${quote.text}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="builder-btn primary"><i class="fas fa-save"></i> Save</button>
                        <button type="button" class="builder-btn" onclick="document.getElementById('quoteModal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('quoteForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const idx = quotes.findIndex(q => q.id === id);
        quotes[idx] = { ...quotes[idx], text: document.getElementById('quoteText').value.trim() };
        DataStore.setQuotes(quotes);
        showToast('Quote updated!', 'success');
        syncToLiveWebsite();
        modal.remove();
        loadQuotes();
    });
}

function deleteQuote(id) {
    if (!confirm('Move this quote to Trash?')) return;
    const quotes = DataStore._getRaw(DataStore.KEYS.QUOTES) || [];
    const q = quotes.find(x => x.id === id);
    if (q) DataStore.moveToTrash(q, 'quotes');
    localStorage.setItem(DataStore.KEYS.QUOTES, JSON.stringify(quotes.filter(q => q.id !== id)));
    showToast('Quote moved to Trash', 'success');
    loadQuotes();
    syncToLiveWebsite();
}

// ============================================
// Moods & Genres Management
// ============================================
function loadMoods() {
    let moods = DataStore.getMoods();
    moods = _filterDeletedItems(moods, 'moods');
    const tbody = document.getElementById('moodsTableBody');
    if (!tbody) return;
    tbody.innerHTML = moods.map(m => `
        <tr>
            <td style="font-size:1.5rem">${m.emoji}</td>
            <td>${m.name}</td>
            <td><div style="width:80px;height:24px;border-radius:6px;background:${m.gradient}"></div></td>
            <td><span class="status-badge ${m.status === 'active' ? 'active' : 'inactive'}">${m.status}</span></td>
            <td><div class="actions">
                <button class="builder-btn small" onclick="editMood('${m.id}')"><i class="fas fa-edit"></i></button>
                <button class="builder-btn small danger" onclick="deleteMood('${m.id}')"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`).join('');
}

function openAddMoodModal() {
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Add Mood</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return saveMood(event)"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Emoji</label><input type="text" class="form-input" id="moodEmoji" placeholder="ðŸŽµ" required></div>
            <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="moodName" required></div>
            <div class="form-group"><label class="form-label">Gradient</label><input type="text" class="form-input" id="moodGradient" placeholder="linear-gradient(135deg,#6366f1,#8b5cf6)"></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Save</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveMood(e) {
    e.preventDefault();
    const moods = DataStore.getMoods();
    moods.push({ id: 'm_' + Date.now(), emoji: document.getElementById('moodEmoji').value, name: document.getElementById('moodName').value, gradient: document.getElementById('moodGradient').value || 'linear-gradient(135deg,#6366f1,#8b5cf6)', status: 'active' });
    DataStore.setMoods(moods); showToast('Mood added', 'success'); loadMoods(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function editMood(id) {
    const moods = DataStore.getMoods();
    const m = moods.find(x => x.id === id); if (!m) return;
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Edit Mood</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return updateMood(event,'${id}')"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Emoji</label><input type="text" class="form-input" id="moodEmoji" value="${m.emoji}" required></div>
            <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="moodName" value="${m.name}" required></div>
            <div class="form-group"><label class="form-label">Gradient</label><input type="text" class="form-input" id="moodGradient" value="${m.gradient}"></div>
            <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="moodStatus"><option value="active" ${m.status==='active'?'selected':''}>Active</option><option value="inactive" ${m.status==='inactive'?'selected':''}>Inactive</option></select></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Update</button></div></form></div>`;
    document.body.appendChild(modal);
}

function updateMood(e, id) {
    e.preventDefault();
    const moods = DataStore.getMoods();
    const m = moods.find(x => x.id === id); if (!m) return false;
    m.emoji = document.getElementById('moodEmoji').value;
    m.name = document.getElementById('moodName').value;
    m.gradient = document.getElementById('moodGradient').value;
    m.status = document.getElementById('moodStatus').value;
    DataStore.setMoods(moods); showToast('Mood updated', 'success'); loadMoods(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function deleteMood(id) {
    if (!confirm('Move this mood to Trash?')) return;
    const moods = DataStore._getRaw(DataStore.KEYS.MOODS) || [];
    const mood = moods.find(m => m.id === id);
    if (mood) DataStore.moveToTrash(mood, 'moods');
    localStorage.setItem(DataStore.KEYS.MOODS, JSON.stringify(moods.filter(m => m.id !== id)));
    showToast('Mood moved to Trash', 'success'); loadMoods(); syncToLiveWebsite();
}

// ============================================
// AI Radio Management
// ============================================
function loadAIRadio() {
    let items = DataStore.getAIRadio();
    items = _filterDeletedItems(items, 'aiRadio');
    const tbody = document.getElementById('airadioTableBody');
    if (!tbody) return;
    tbody.innerHTML = items.map(a => `
        <tr>
            <td><i class="fas ${a.icon}"></i></td>
            <td>${a.title}</td>
            <td>${a.desc}</td>
            <td>${a.filter}</td>
            <td><span class="status-badge ${a.status === 'active' ? 'active' : 'inactive'}">${a.status}</span></td>
            <td><div class="actions">
                <button class="builder-btn small" onclick="editAIRadio('${a.id}')"><i class="fas fa-edit"></i></button>
                <button class="builder-btn small danger" onclick="deleteAIRadio('${a.id}')"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`).join('');
}

// ============================================
// Music by Era (Decades) Admin Page
// ============================================
const DECADE_CONFIGS = [
    { id: '80s', label: "80's Hits", range: [1980, 1989], icon: 'fa-compact-disc', color: '#f43f5e', grad: 'linear-gradient(135deg,#f43f5e,#fb923c)' },
    { id: '90s', label: "90's Hits", range: [1990, 1999], icon: 'fa-record-vinyl', color: '#a855f7', grad: 'linear-gradient(135deg,#a855f7,#6366f1)' },
    { id: '2k',  label: '2K Hits',  range: [2000, 2009], icon: 'fa-compact-disc', color: '#3b82f6', grad: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
    { id: 'new', label: 'New Hits', range: [2010, 2099], icon: 'fa-headphones',    color: '#34d399', grad: 'linear-gradient(135deg,#34d399,#10b981)' }
];

function loadDecadesAdmin() {
    const grid = document.getElementById('decadesAdminGrid');
    if (!grid) return;
    const songs = DataStore.getSongs() || [];
    const published = songs.filter(s => s.status === 'published' || !s.status);

    grid.innerHTML = DECADE_CONFIGS.map(d => {
        const decadeSongs = published.filter(s => {
            if (s.decade === d.id) return true;
            const y = parseInt(s.year, 10);
            return !isNaN(y) && y >= d.range[0] && y <= d.range[1];
        });
        const unassigned = published.filter(s => !s.decade && !s.year);
        return `
        <div class="builder-content-card" style="overflow:hidden;">
            <div style="background:${d.grad};padding:16px 20px;display:flex;align-items:center;gap:12px;">
                <i class="fas ${d.icon}" style="font-size:24px;color:#fff;"></i>
                <div>
                    <h3 style="margin:0;color:#fff;font-size:1.1rem;">${d.label}</h3>
                    <span style="color:rgba(255,255,255,0.8);font-size:0.85rem;">${decadeSongs.length} song${decadeSongs.length !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="builder-card-body" style="max-height:300px;overflow-y:auto;">
                ${decadeSongs.length === 0 ? '<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:0.85rem;"><i class="fas fa-inbox" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.4;"></i>No songs assigned yet.<br>Set "Music Era" in the song form.</div>' :
                decadeSongs.map(s => `
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-glass);">
                        <div style="width:36px;height:36px;border-radius:6px;background:var(--bg-glass);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
                            ${s.thumbnail || s.albumCover ? `<img src="${s.thumbnail || s.albumCover}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-music\\' style=\\'font-size:14px;color:var(--text-secondary)\\'></i>'">` : '<i class="fas fa-music" style="font-size:14px;color:var(--text-secondary);"></i>'}
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:0.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(s.title || s.name || 'Untitled')}</div>
                            <div style="font-size:0.75rem;color:var(--text-secondary);">${s.artist || 'Unknown'}</div>
                        </div>
                        <button class="builder-btn small" onclick="removeSongDecade('${s.id}')" title="Remove from era"><i class="fas fa-times"></i></button>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }).join('');

    // Unassigned songs section
    const unassigned = published.filter(s => !s.decade);
    if (unassigned.length > 0) {
        grid.innerHTML += `
        <div class="builder-content-card" style="grid-column:1/-1;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#64748b,#475569);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <i class="fas fa-inbox" style="font-size:24px;color:#fff;"></i>
                    <div>
                        <h3 style="margin:0;color:#fff;font-size:1.1rem;">Unassigned Songs</h3>
                        <span style="color:rgba(255,255,255,0.8);font-size:0.85rem;">${unassigned.length} song${unassigned.length !== 1 ? 's' : ''} without an era</span>
                    </div>
                </div>
                <button class="builder-btn" onclick="bulkAssignDecade()" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);"><i class="fas fa-magic"></i> Auto-Assign by Year</button>
            </div>
            <div class="builder-card-body" style="max-height:250px;overflow-y:auto;">
                ${unassigned.slice(0, 50).map(s => `
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-glass);">
                        <div style="width:36px;height:36px;border-radius:6px;background:var(--bg-glass);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
                            ${s.thumbnail || s.albumCover ? `<img src="${s.thumbnail || s.albumCover}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-music\\' style=\\'font-size:14px;color:var(--text-secondary)\\'></i>'">` : '<i class="fas fa-music" style="font-size:14px;color:var(--text-secondary);"></i>'}
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:0.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(s.title || s.name || 'Untitled')}</div>
                            <div style="font-size:0.75rem;color:var(--text-secondary);">${s.artist || 'Unknown'}${s.year ? ' (' + s.year + ')' : ''}</div>
                        </div>
                        <select class="form-select" style="width:auto;padding:4px 8px;font-size:0.8rem;" onchange="assignSongDecade('${s.id}', this.value)">
                            <option value="">Assign Era</option>
                            <option value="80s">80's</option>
                            <option value="90s">90's</option>
                            <option value="2k">2K</option>
                            <option value="new">New</option>
                        </select>
                    </div>
                `).join('')}
                ${unassigned.length > 50 ? '<div style="text-align:center;padding:12px;color:var(--text-secondary);font-size:0.85rem;">Showing 50 of ' + unassigned.length + ' unassigned songs.</div>' : ''}
            </div>
        </div>`;
    }
}

function assignSongDecade(songId, decade) {
    const songs = DataStore.getSongs() || [];
    const song = songs.find(s => s.id === songId);
    if (song) {
        song.decade = decade;
        DataStore.setSongs(songs);
        loadDecadesAdmin();
    }
}

function removeSongDecade(songId) {
    const songs = DataStore.getSongs() || [];
    const song = songs.find(s => s.id === songId);
    if (song) {
        song.decade = '';
        DataStore.setSongs(songs);
        loadDecadesAdmin();
    }
}

function bulkAssignDecade() {
    const songs = DataStore.getSongs() || [];
    let changed = 0;
    songs.forEach(s => {
        if (s.decade) return;
        const y = parseInt(s.year, 10);
        if (isNaN(y)) return;
        if (y >= 1980 && y <= 1989) { s.decade = '80s'; changed++; }
        else if (y >= 1990 && y <= 1999) { s.decade = '90s'; changed++; }
        else if (y >= 2000 && y <= 2009) { s.decade = '2k'; changed++; }
        else if (y >= 2010) { s.decade = 'new'; changed++; }
    });
    if (changed) {
        DataStore.setSongs(songs);
        loadDecadesAdmin();
        alert('Auto-assigned ' + changed + ' song(s) to their eras based on year.');
    } else {
        alert('No songs could be auto-assigned. Make sure songs have a Year field set.');
    }
}

function openAddAIRadioModal() {
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Add AI Radio Card</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return saveAIRadio(event)"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Icon (FA class)</label><input type="text" class="form-input" id="arIcon" placeholder="fa-sun" required></div>
            <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="arTitle" required></div>
            <div class="form-group"><label class="form-label">Description</label><input type="text" class="form-input" id="arDesc" required></div>
            <div class="form-group"><label class="form-label">Filter (genre)</label><input type="text" class="form-input" id="arFilter" placeholder="music"></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Save</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveAIRadio(e) {
    e.preventDefault();
    const items = DataStore.getAIRadio();
    items.push({ id: 'ar_' + Date.now(), icon: document.getElementById('arIcon').value, title: document.getElementById('arTitle').value, desc: document.getElementById('arDesc').value, filter: document.getElementById('arFilter').value || 'music', status: 'active' });
    DataStore.setAIRadio(items); showToast('AI Radio card added', 'success'); loadAIRadio(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function editAIRadio(id) {
    const items = DataStore.getAIRadio();
    const a = items.find(x => x.id === id); if (!a) return;
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Edit AI Radio Card</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return updateAIRadio(event,'${id}')"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Icon</label><input type="text" class="form-input" id="arIcon" value="${a.icon}" required></div>
            <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="arTitle" value="${a.title}" required></div>
            <div class="form-group"><label class="form-label">Description</label><input type="text" class="form-input" id="arDesc" value="${a.desc}" required></div>
            <div class="form-group"><label class="form-label">Filter</label><input type="text" class="form-input" id="arFilter" value="${a.filter}"></div>
            <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="arStatus"><option value="active" ${a.status==='active'?'selected':''}>Active</option><option value="inactive" ${a.status==='inactive'?'selected':''}>Inactive</option></select></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Update</button></div></form></div>`;
    document.body.appendChild(modal);
}

function updateAIRadio(e, id) {
    e.preventDefault();
    const items = DataStore.getAIRadio();
    const a = items.find(x => x.id === id); if (!a) return false;
    a.icon = document.getElementById('arIcon').value;
    a.title = document.getElementById('arTitle').value;
    a.desc = document.getElementById('arDesc').value;
    a.filter = document.getElementById('arFilter').value;
    a.status = document.getElementById('arStatus').value;
    DataStore.setAIRadio(items); showToast('AI Radio card updated', 'success'); loadAIRadio(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function deleteAIRadio(id) {
    if (!confirm('Move this AI Radio card to Trash?')) return;
    const items = DataStore._getRaw(DataStore.KEYS.AI_RADIO) || [];
    const item = items.find(a => a.id === id);
    if (item) DataStore.moveToTrash(item, 'aiRadio');
    localStorage.setItem(DataStore.KEYS.AI_RADIO, JSON.stringify(items.filter(a => a.id !== id)));
    showToast('AI Radio card moved to Trash', 'success'); loadAIRadio(); syncToLiveWebsite();
}

// ============================================
// Notifications Management
// ============================================
function loadNotifications() {
    let items = DataStore.getNotifications();
    items = _filterDeletedItems(items, 'notifications');
    const tbody = document.getElementById('notificationsTableBody');
    if (!tbody) return;
    tbody.innerHTML = items.map(n => `
        <tr>
            <td>${n.title}</td>
            <td>${n.message}</td>
            <td><span class="status-badge">${n.type}</span></td>
            <td><span class="status-badge ${n.status === 'active' ? 'active' : 'inactive'}">${n.status}</span></td>
            <td><div class="actions">
                <button class="builder-btn small" onclick="editNotification('${n.id}')"><i class="fas fa-edit"></i></button>
                <button class="builder-btn small danger" onclick="deleteNotification('${n.id}')"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`).join('');
}

function openAddNotificationModal() {
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Add Notification</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return saveNotification(event)"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="notifTitle" required></div>
            <div class="form-group"><label class="form-label">Message</label><textarea class="form-textarea" id="notifMessage" rows="2" required></textarea></div>
            <div class="form-group"><label class="form-label">Type</label><select class="form-input" id="notifType"><option value="info">Info</option><option value="update">Update</option><option value="alert">Alert</option><option value="success">Success</option></select></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Save</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveNotification(e) {
    e.preventDefault();
    const items = DataStore.getNotifications();
    items.push({ id: 'n_' + Date.now(), title: document.getElementById('notifTitle').value, message: document.getElementById('notifMessage').value, type: document.getElementById('notifType').value, status: 'active', timestamp: Date.now() });
    DataStore.setNotifications(items); showToast('Notification added', 'success'); loadNotifications(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function editNotification(id) {
    const items = DataStore.getNotifications();
    const n = items.find(x => x.id === id); if (!n) return;
    const modal = document.createElement('div');
    modal.className = 'builder-modal-overlay';
    modal.innerHTML = `<div class="builder-modal"><div class="builder-modal-header"><h3>Edit Notification</h3><button class="builder-modal-close" onclick="this.closest('.builder-modal-overlay').remove()">&times;</button></div>
        <form onsubmit="return updateNotification(event,'${id}')"><div class="builder-modal-body">
            <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="notifTitle" value="${n.title}" required></div>
            <div class="form-group"><label class="form-label">Message</label><textarea class="form-textarea" id="notifMessage" rows="2" required>${n.message}</textarea></div>
            <div class="form-group"><label class="form-label">Type</label><select class="form-input" id="notifType"><option value="info" ${n.type==='info'?'selected':''}>Info</option><option value="update" ${n.type==='update'?'selected':''}>Update</option><option value="alert" ${n.type==='alert'?'selected':''}>Alert</option><option value="success" ${n.type==='success'?'selected':''}>Success</option></select></div>
            <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="notifStatus"><option value="active" ${n.status==='active'?'selected':''}>Active</option><option value="inactive" ${n.status==='inactive'?'selected':''}>Inactive</option></select></div>
        </div><div class="builder-modal-footer"><button type="button" class="builder-btn" onclick="this.closest('.builder-modal-overlay').remove()">Cancel</button><button type="submit" class="builder-btn primary">Update</button></div></form></div>`;
    document.body.appendChild(modal);
}

function updateNotification(e, id) {
    e.preventDefault();
    const items = DataStore.getNotifications();
    const n = items.find(x => x.id === id); if (!n) return false;
    n.title = document.getElementById('notifTitle').value;
    n.message = document.getElementById('notifMessage').value;
    n.type = document.getElementById('notifType').value;
    n.status = document.getElementById('notifStatus').value;
    DataStore.setNotifications(items); showToast('Notification updated', 'success'); loadNotifications(); syncToLiveWebsite();
    document.querySelector('.builder-modal-overlay')?.remove();
    return false;
}

function deleteNotification(id) {
    if (!confirm('Move this notification to Trash?')) return;
    const items = DataStore._getRaw(DataStore.KEYS.NOTIFICATIONS) || [];
    const item = items.find(n => n.id === id);
    if (item) DataStore.moveToTrash(item, 'notifications');
    localStorage.setItem(DataStore.KEYS.NOTIFICATIONS, JSON.stringify(items.filter(n => n.id !== id)));
    showToast('Notification moved to Trash', 'success'); loadNotifications(); syncToLiveWebsite();
}

// ============================================
// Splash Screen Settings
// ============================================
function loadSplashSettings() {
    const s = DataStore.getSplash();
    document.getElementById('splashEnabled').value = s.enabled !== false ? 'true' : 'false';
    document.getElementById('splashDuration').value = s.duration || 2200;
    document.getElementById('splashLogoIcon').value = s.logoIcon || 'fa-headphones-alt';
    document.getElementById('splashTitle').value = s.title || 'Tamil AI Stream';
    document.getElementById('splashSubtitle').value = s.subtitle || 'AI-Powered Tamil Radio';
    document.getElementById('splashShowEqualizer').value = s.showEqualizer !== false ? 'true' : 'false';
    document.getElementById('splashShowParticles').value = s.showParticles !== false ? 'true' : 'false';
    document.getElementById('splashShowLoadingBar').value = s.showLoadingBar !== false ? 'true' : 'false';
    document.getElementById('splashShowSkipButton').value = s.showSkipButton !== false ? 'true' : 'false';
}

function saveSplashSettings(e) {
    e.preventDefault();
    DataStore.setSplash({
        enabled: document.getElementById('splashEnabled').value === 'true',
        duration: parseInt(document.getElementById('splashDuration').value) || 2200,
        logoIcon: document.getElementById('splashLogoIcon').value,
        title: document.getElementById('splashTitle').value,
        subtitle: document.getElementById('splashSubtitle').value,
        showEqualizer: document.getElementById('splashShowEqualizer').value === 'true',
        showParticles: document.getElementById('splashShowParticles').value === 'true',
        showLoadingBar: document.getElementById('splashShowLoadingBar').value === 'true',
        showSkipButton: document.getElementById('splashShowSkipButton').value === 'true'
    });
    showToast('Splash settings saved', 'success');
    syncToLiveWebsite();
    return false;
}

// ============================================
// Entrance Logo Settings
// ============================================
let _elCurrentDevice = 'desktop';

function loadEntranceLogoSettings() {
    const all = DataStore.getEntranceLogo() || {};
    const d = all[_elCurrentDevice] || all.desktop || {};
    
    // Logo
    document.getElementById('elLogoUrl').value = d.logo || '';
    document.getElementById('elBrandName').value = d.brandName || 'Tamil AI Stream';
    document.getElementById('elLogoSize').value = d.logoSize || 120;
    document.getElementById('elBgColor').value = d.background || '#000000';
    document.getElementById('elBgText').value = d.background || 'transparent';
    document.getElementById('elMode').value = d.mode || 'fullscreen';
    document.getElementById('elAlignment').value = d.alignment || 'center';
    document.getElementById('elShowLogo').checked = d.showLogo !== false;
    
    // Animation
    document.getElementById('elAnimEnabled').checked = d.animEnabled !== false;
    document.getElementById('elAnim3D').checked = d.anim3D || false;
    document.getElementById('elAnimType').value = d.animType || 'zoom';
    document.getElementById('elAnimSpeed').value = d.animSpeed || 1;
    document.getElementById('elAnimDuration').value = d.animDuration || 1000;
    document.getElementById('elAnimEasing').value = d.animEasing || 'ease-out';
    document.getElementById('elAnimEntrance').checked = d.animEntrance !== false;
    document.getElementById('elAnimExit').checked = d.animExit || false;
    
    // Sound
    document.getElementById('elSoundEnabled').checked = d.soundEnabled || false;
    document.getElementById('elSoundUrl').value = d.soundUrl || '';
    document.getElementById('elSoundVolume').value = d.soundVolume !== undefined ? d.soundVolume : 0.5;
    document.getElementById('elSoundVolumeVal').textContent = Math.round((d.soundVolume !== undefined ? d.soundVolume : 0.5) * 100) + '%';
    document.getElementById('elSoundDuration').value = d.soundDuration || 3000;
    document.getElementById('elSoundMode').value = d.soundMode || 'once';
    document.getElementById('elSoundFadeIn').value = d.soundFadeIn || 200;
    document.getElementById('elSoundFadeOut').value = d.soundFadeOut || 500;
    
    // Startup Behavior
    document.getElementById('elEnabled').checked = d.enabled !== false;
    document.getElementById('elFrequency').value = d.frequency || 'first-visit';
    document.getElementById('elWebsite').checked = d.website !== false;
    document.getElementById('elPwa').checked = d.pwa !== false;
    document.getElementById('elTablet').checked = d.tablet !== false;
    document.getElementById('elSkipBtn').checked = d.skipBtn !== false;
    document.getElementById('elLoadDuration').value = d.loadDuration || 2000;
    document.getElementById('elAutoTransition').checked = d.autoTransition !== false;
    
    // Update preview
    elUpdatePreview();
}

function elSwitchDevice(btn, device) {
    _elCurrentDevice = device;
    document.querySelectorAll('.el-device-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    loadEntranceLogoSettings();
}

function elUpdateSetting(key, value) {
    const all = DataStore.getEntranceLogo() || {};
    if (!all[_elCurrentDevice]) all[_elCurrentDevice] = {};
    all[_elCurrentDevice][key] = value;
    DataStore.setEntranceLogo(all);
    elUpdatePreview();
}

function elUpdateDeviceSetting(device, key, value) {
    const all = DataStore.getEntranceLogo() || {};
    if (!all[device]) all[device] = {};
    all[device][key] = value;
    DataStore.setEntranceLogo(all);
    // Update preview if we're currently viewing that device
    if (_elCurrentDevice === device) {
        elUpdatePreview();
    }
}

function elUploadLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        elUpdateSetting('logo', e.target.result);
        document.getElementById('elLogoUrl').value = e.target.result;
        showToast('Logo uploaded!', 'success');
    };
    reader.readAsDataURL(file);
}

function elResetLogo() {
    elUpdateSetting('logo', '');
    document.getElementById('elLogoUrl').value = '';
    showToast('Logo reset to default', 'success');
}

function elUploadSound(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { showToast('Sound must be under 500KB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        elUpdateSetting('soundUrl', e.target.result);
        document.getElementById('elSoundUrl').value = e.target.result;
        showToast('Sound uploaded!', 'success');
    };
    reader.readAsDataURL(file);
}

function elRemoveSound() {
    elUpdateSetting('soundUrl', '');
    document.getElementById('elSoundUrl').value = '';
    showToast('Sound removed', 'success');
}

function elUpdatePreview() {
    const all = DataStore.getEntranceLogo() || {};
    const d = all[_elCurrentDevice] || all.desktop || {};
    const frame = document.getElementById('elPreviewFrame');
    if (!frame) return;
    
    const logo = d.logo || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22 fill=%22none%22%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%2218%22 fill=%22url(%23g)%22/%3E%3Cpath d=%22M14 28V14l14 7-14 7z%22 fill=%22%23fff%22 opacity=%22.9%22/%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%2240%22 y2=%2240%22%3E%3Cstop stop-color=%22%2322d3ee%22/%3E%3Cstop offset=%22.5%22 stop-color=%22%233b82f6%22/%3E%3Cstop offset=%221%22 stop-color=%22%23a855f7%22/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E';
    const size = d.logoSize || 120;
    const bg = d.background || 'transparent';
    const mode = d.mode || 'fullscreen';
    
    frame.innerHTML = '';
    frame.style.background = bg === 'transparent' ? 'linear-gradient(135deg, #060e1a, #0a0f1e)' : bg;
    
    const preview = document.createElement('div');
    preview.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        position: relative;
    `;
    
    if (d.showLogo !== false) {
        const img = document.createElement('img');
        img.src = logo;
        img.alt = d.brandName || 'Logo';
        img.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            object-fit: contain;
            border-radius: 50%;
            animation: elPreviewAnim ${(d.animDuration || 1000) / 1000}s ${d.animEasing || 'ease-out'} forwards;
            opacity: 0;
        `;
        preview.appendChild(img);
    }
    
    const brandName = document.createElement('div');
    brandName.textContent = d.brandName || 'Tamil AI Stream';
    brandName.style.cssText = `
        color: #fff;
        font-size: 1.2rem;
        font-weight: 700;
        margin-top: 16px;
        text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        opacity: 0;
        animation: fadeIn 0.6s ease-out 0.3s forwards;
    `;
    preview.appendChild(brandName);
    
    frame.appendChild(preview);
    
    // Add animation keyframes dynamically
    const animType = d.animType || 'zoom';
    const duration = d.animDuration || 1000;
    const easing = d.animEasing || 'ease-out';
    
    let keyframes = '';
    switch (animType) {
        case 'fade':
            keyframes = 'from { opacity: 0; } to { opacity: 1; }';
            break;
        case 'zoom':
            keyframes = 'from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); }';
            break;
        case 'rotate':
            keyframes = 'from { opacity: 0; transform: rotate(-180deg) scale(0.5); } to { opacity: 1; transform: rotate(0) scale(1); }';
            break;
        case 'scale':
            keyframes = 'from { opacity: 0; transform: scale(1.5); } to { opacity: 1; transform: scale(1); }';
            break;
        case 'slide-up':
            keyframes = 'from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); }';
            break;
        case 'slide-down':
            keyframes = 'from { opacity: 0; transform: translateY(-50px); } to { opacity: 1; transform: translateY(0); }';
            break;
        case 'slide-left':
            keyframes = 'from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); }';
            break;
        case 'slide-right':
            keyframes = 'from { opacity: 0; transform: translateX(-50px); } to { opacity: 1; transform: translateX(0); }';
            break;
        case 'flip':
            keyframes = 'from { opacity: 0; transform: rotateY(90deg); } to { opacity: 1; transform: rotateY(0); }';
            break;
        case 'bounce':
            keyframes = '0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 1; transform: scale(1.1); } 70% { transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); }';
            break;
        default:
            keyframes = 'from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); }';
    }
    
    // Inject keyframes
    let style = document.getElementById('elPreviewStyles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'elPreviewStyles';
        document.head.appendChild(style);
    }
    style.textContent = `
        @keyframes elPreviewAnim { ${keyframes} }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    `;
}

function elPreviewAnimation() {
    elUpdatePreview();
    const frame = document.getElementById('elPreviewFrame');
    if (frame) {
        const img = frame.querySelector('img');
        if (img) {
            img.style.animation = 'none';
            img.offsetHeight; // trigger reflow
            img.style.animation = '';
        }
    }
}

function elPreviewSound() {
    const all = DataStore.getEntranceLogo() || {};
    const d = all[_elCurrentDevice] || all.desktop || {};
    if (d.soundUrl && d.soundEnabled) {
        const audio = new Audio(d.soundUrl);
        audio.volume = d.soundVolume || 0.5;
        audio.play().catch(() => showToast('Could not play sound', 'error'));
    } else {
        showToast('No sound configured or sound disabled', 'warning');
    }
}

function elPreviewFull() {
    const all = DataStore.getEntranceLogo() || {};
    const d = all[_elCurrentDevice] || all.desktop || {};
    
    // Create full preview modal
    let modal = document.getElementById('elPreviewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'elPreviewModal';
        modal.className = 'el-preview-modal';
        modal.innerHTML = `
            <div class="el-preview-modal-content" id="elPreviewModalContent">
                <button class="el-preview-modal-close" onclick="elClosePreviewModal()"><i class="fas fa-times"></i></button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const content = document.getElementById('elPreviewModalContent');
    const logo = d.logo || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22 fill=%22none%22%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%2218%22 fill=%22url(%23g)%22/%3E%3Cpath d=%22M14 28V14l14 7-14 7z%22 fill=%22%23fff%22 opacity=%22.9%22/%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%2240%22 y2=%2240%22%3E%3Cstop stop-color=%22%2322d3ee%22/%3E%3Cstop offset=%22.5%22 stop-color=%22%233b82f6%22/%3E%3Cstop offset=%221%22 stop-color=%22%23a855f7%22/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%22';
    const size = d.logoSize || 120;
    const bg = d.background || 'transparent';
    const mode = d.mode || 'fullscreen';
    const duration = d.animDuration || 1000;
    const easing = d.animEasing || 'ease-out';
    
    let keyframes = '';
    switch (d.animType) {
        case 'fade': keyframes = 'from { opacity: 0; } to { opacity: 1; }'; break;
        case 'zoom': keyframes = 'from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); }'; break;
        case 'rotate': keyframes = 'from { opacity: 0; transform: rotate(-180deg) scale(0.5); } to { opacity: 1; transform: rotate(0) scale(1); }'; break;
        case 'scale': keyframes = 'from { opacity: 0; transform: scale(1.5); } to { opacity: 1; transform: scale(1); }'; break;
        case 'slide-up': keyframes = 'from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); }'; break;
        case 'slide-down': keyframes = 'from { opacity: 0; transform: translateY(-50px); } to { opacity: 1; transform: translateY(0); }'; break;
        case 'slide-left': keyframes = 'from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); }'; break;
        case 'slide-right': keyframes = 'from { opacity: 0; transform: translateX(-50px); } to { opacity: 1; transform: translateX(0); }'; break;
        case 'flip': keyframes = 'from { opacity: 0; transform: rotateY(90deg); } to { opacity: 1; transform: rotateY(0); }'; break;
        case 'bounce': keyframes = '0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 1; transform: scale(1.1); } 70% { transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); }'; break;
        default: keyframes = 'from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); }';
    }
    
    let style = document.getElementById('elPreviewModalStyles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'elPreviewModalStyles';
        document.head.appendChild(style);
    }
    style.textContent = `
        @keyframes elFullPreviewAnim { ${keyframes} }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .el-preview-logo { 
            width: ${size}px; height: ${size}px; object-fit: contain; border-radius: 50%; 
            animation: elFullPreviewAnim ${duration / 1000}s ${easing} forwards, fadeIn 0.6s ease-out 0.3s forwards; 
            opacity: 0; 
        }
    `;
    
    content.innerHTML = `
        <button class="el-preview-modal-close" onclick="elClosePreviewModal()"><i class="fas fa-times"></i></button>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;background:${bg === 'transparent' ? 'linear-gradient(135deg, #060e1a, #0a0f1e)' : bg};">
            ${d.showLogo !== false ? `<img src="${logo}" alt="${d.brandName}" class="el-preview-logo">` : ''}
            <div style="color:#fff;font-size:1.5rem;font-weight:700;margin-top:20px;text-shadow:0 2px 8px rgba(0,0,0,0.5);opacity:0;animation:fadeIn 0.6s ease-out 0.5s forwards;">${d.brandName || 'Tamil AI Stream'}</div>
        </div>
    `;
    
    modal.classList.add('active');
    
    // Play sound if enabled
    if (d.soundUrl && d.soundEnabled) {
        const audio = new Audio(d.soundUrl);
        audio.volume = d.soundVolume || 0.5;
        audio.play().catch(() => {});
    }
}

function elClosePreviewModal() {
    const modal = document.getElementById('elPreviewModal');
    if (modal) modal.classList.remove('active');
}

function elSaveEntranceLogo() {
    // Save all device settings
    const all = DataStore.getEntranceLogo() || {};
    // Current device already saved via elUpdateSetting
    DataStore.setEntranceLogo(all);
    showToast('Entrance Logo settings saved!', 'success');
    gbPushUndo('Entrance Logo settings changed');
}

// ============================================
// Player Preferences
// ============================================
function loadPlayerPrefs() {
    const p = DataStore.getPlayerPrefs();
    document.getElementById('prefAutoplay').value = p.autoplay !== false ? 'true' : 'false';
    document.getElementById('prefCrossfade').value = p.crossfade ? 'true' : 'false';
    document.getElementById('prefCrossfadeDuration').value = p.crossfadeDuration || 2;
    document.getElementById('prefDefaultVolume').value = p.defaultVolume || 0.8;
    document.getElementById('prefEqPreset').value = p.eqPreset || 'flat';
    document.getElementById('prefBassBoost').value = p.bassBoost || 0;
    document.getElementById('prefTrebleBoost').value = p.trebleBoost || 0;
    document.getElementById('prefVocalBoost').value = p.vocalBoost || 0;
    document.getElementById('prefStereoBalance').value = p.stereoBalance || 0;
    document.getElementById('prefLoudnessNorm').value = p.loudnessNorm ? 'true' : 'false';
    document.getElementById('prefSurroundEffect').value = p.surroundEffect ? 'true' : 'false';
    loadPlayerSections();
}

// ---- Player Sections (visibility of player components on the live site) ----
function loadPlayerSections() {
    const s = DataStore.getPlayerPrefs().sections || {};
    const oneTap = document.getElementById('psecOneTapRadio');
    if (oneTap) oneTap.checked = s.oneTapRadio !== false;
    const heroRot = document.getElementById('psecHeroAutoRotate');
    if (heroRot) heroRot.checked = s.heroAutoRotate !== false;
    const heroInt = document.getElementById('psecHeroInterval');
    if (heroInt) heroInt.value = s.heroInterval || 20;
    const recent = document.getElementById('psecRecentlyAdded');
    if (recent) recent.checked = s.recentlyAdded !== false;
    const npb = document.getElementById('psecNowPlayingBar');
    if (npb) npb.checked = s.nowPlayingBar !== false;
    const mini = document.getElementById('psecMiniPlayer');
    if (mini) mini.checked = s.miniPlayer !== false;
}

function savePlayerSections(e) {
    e.preventDefault();
    const prefs = DataStore.getPlayerPrefs();
    prefs.sections = {
        oneTapRadio: document.getElementById('psecOneTapRadio').checked,
        heroAutoRotate: document.getElementById('psecHeroAutoRotate').checked,
        heroInterval: parseInt(document.getElementById('psecHeroInterval').value, 10) || 20,
        recentlyAdded: document.getElementById('psecRecentlyAdded').checked,
        nowPlayingBar: document.getElementById('psecNowPlayingBar').checked,
        miniPlayer: document.getElementById('psecMiniPlayer').checked
    };
    DataStore.setPlayerPrefs(prefs);
    showToast('Player sections saved', 'success');
    syncToLiveWebsite();
    return false;
}

function savePlayerPrefs(e) {
    e.preventDefault();
    DataStore.setPlayerPrefs({
        autoplay: document.getElementById('prefAutoplay').value === 'true',
        crossfade: document.getElementById('prefCrossfade').value === 'true',
        crossfadeDuration: parseFloat(document.getElementById('prefCrossfadeDuration').value) || 2,
        defaultVolume: parseFloat(document.getElementById('prefDefaultVolume').value) || 0.8,
        eqPreset: document.getElementById('prefEqPreset').value,
        bassBoost: parseInt(document.getElementById('prefBassBoost').value) || 0,
        trebleBoost: parseInt(document.getElementById('prefTrebleBoost').value) || 0,
        vocalBoost: parseInt(document.getElementById('prefVocalBoost').value) || 0,
        stereoBalance: parseFloat(document.getElementById('prefStereoBalance').value) || 0,
        loudnessNorm: document.getElementById('prefLoudnessNorm').value === 'true',
        surroundEffect: document.getElementById('prefSurroundEffect').value === 'true'
    });
    showToast('Player settings saved', 'success');
    syncToLiveWebsite();
    return false;
}

// ============================================
// Navigation Settings
// ============================================
function loadNavigation() {
    const n = DataStore.getNavigation();
    document.getElementById('navShowHome').value = n.showHome !== false ? 'true' : 'false';
    document.getElementById('navShowExplore').value = n.showExplore !== false ? 'true' : 'false';
    document.getElementById('navShowLibrary').value = n.showLibrary !== false ? 'true' : 'false';
    document.getElementById('navShowSearch').value = n.showSearch !== false ? 'true' : 'false';
    document.getElementById('navShowLiked').value = n.showLiked !== false ? 'true' : 'false';
    document.getElementById('navShowStations').value = n.showStations !== false ? 'true' : 'false';
    document.getElementById('navShowArtists').value = n.showArtists !== false ? 'true' : 'false';
    document.getElementById('navShowHistory').value = n.showHistory !== false ? 'true' : 'false';
    document.getElementById('navShowPlaylists').value = n.showPlaylists !== false ? 'true' : 'false';
}

function saveNavigation(e) {
    e.preventDefault();
    DataStore.setNavigation({
        showHome: document.getElementById('navShowHome').value === 'true',
        showExplore: document.getElementById('navShowExplore').value === 'true',
        showLibrary: document.getElementById('navShowLibrary').value === 'true',
        showSearch: document.getElementById('navShowSearch').value === 'true',
        showLiked: document.getElementById('navShowLiked').value === 'true',
        showStations: document.getElementById('navShowStations').value === 'true',
        showArtists: document.getElementById('navShowArtists').value === 'true',
        showHistory: document.getElementById('navShowHistory').value === 'true',
        showPlaylists: document.getElementById('navShowPlaylists').value === 'true'
    });
    showToast('Navigation settings saved', 'success');
    syncToLiveWebsite();
    return false;
}

// ============================================
// Home Sections Order
// ============================================
function loadSectionsOrder() {
    const sections = DataStore.getSectionsOrder();
    const list = document.getElementById('sectionsList');
    if (!list) return;
    list.innerHTML = sections.sort((a, b) => a.order - b.order).map(s => `
        <div class="section-drag-item" data-id="${s.id}" draggable="true">
            <div class="section-drag-handle"><i class="fas fa-grip-vertical"></i></div>
            <div class="section-drag-info">
                <span class="section-drag-name">${s.name}</span>
                <span class="section-drag-order">#${s.order}</span>
            </div>
            <label class="section-toggle">
                <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleSection('${s.id}', this.checked)">
                <span class="section-toggle-slider"></span>
            </label>
        </div>`).join('');
    setupDragAndDrop();
}

function toggleSection(id, enabled) {
    const sections = DataStore.getSectionsOrder();
    const s = sections.find(x => x.id === id);
    if (s) { s.enabled = enabled; DataStore.setSectionsOrder(sections); }
}

function setupDragAndDrop() {
    const list = document.getElementById('sectionsList');
    if (!list) return;
    let dragItem = null;
    list.querySelectorAll('.section-drag-item').forEach(item => {
        item.addEventListener('dragstart', e => { dragItem = item; item.classList.add('dragging'); });
        item.addEventListener('dragend', () => { dragItem?.classList.remove('dragging'); dragItem = null; updateSectionOrders(); });
        item.addEventListener('dragover', e => { e.preventDefault(); if (dragItem && dragItem !== item) {
            const rect = item.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) list.insertBefore(dragItem, item);
            else list.insertBefore(dragItem, item.nextSibling);
        }});
    });
}

function updateSectionOrders() {
    const items = document.querySelectorAll('.section-drag-item');
    const sections = DataStore.getSectionsOrder();
    items.forEach((item, i) => {
        const id = item.dataset.id;
        const s = sections.find(x => x.id === id);
        if (s) s.order = i + 1;
        item.querySelector('.section-drag-order').textContent = '#' + (i + 1);
    });
    DataStore.setSectionsOrder(sections);
}

function saveSectionsOrder() {
    updateSectionOrders();
    showToast('Sections order saved', 'success');
    syncToLiveWebsite();
}

// ============================================
// HOME CONTROL CENTER
// ============================================
const _hccSections = [
    { id: 'greeting', name: 'Greeting', icon: 'fa-hand-wave' },
    { id: 'foryou-trending', name: 'For You', icon: 'fa-fire-flame-curved', hasCards: true, hasAutoScroll: true },
    { id: 'upcoming-new', name: 'Upcoming', icon: 'fa-calendar-days', hasCards: true, hasAutoScroll: true },
    { id: 'ai-new-album', name: 'New Album', icon: 'fa-compact-disc' },
    { id: 'ur-auto-slider', name: 'Upcoming Releases', icon: 'fa-forward' },
    { id: 'ai-one-tap-radio', name: 'One Tap Radio', icon: 'fa-radio' },
    { id: 'ai-songs-collections', name: 'Songs Collections', icon: 'fa-layer-group', hasAutoScroll: true },
    { id: 'ai-music-hero', name: 'Music Hero', icon: 'fa-star' },
    { id: 'ai-trending', name: 'Trending', icon: 'fa-chart-line', hasCards: true },
    { id: 'ai-live-fm', name: 'Live FM', icon: 'fa-tower-broadcast', hasCards: true },
    { id: 'ai-evergreen', name: 'Evergreen Classics', icon: 'fa-gem', hasCards: true },
    { id: 'ai-ai-rec', name: 'AI Recommendations', icon: 'fa-wand-magic-sparkles' },
    { id: 'ai-favorites', name: 'Favourites', icon: 'fa-heart' },
    { id: 'ai-decades', name: 'Music by Era', icon: 'fa-calendar-days', hasCards: true }
];

let _hccUndoStack = [];
let _hccRedoStack = [];
let _hccSettings = {};
let _hccLogoSettings = {};
let _hccDragItem = null;

function loadHomeControl() {
    _hccSettings = JSON.parse(JSON.stringify(DataStore.getSectionSettings()));
    _hccLogoSettings = JSON.parse(JSON.stringify(DataStore.getLogoSettings()));
    if (!_hccLogoSettings.logo || Object.keys(_hccLogoSettings).length < 3) {
        _hccLogoSettings = { logo: '', logoWidth: 40, animation3d: false, animationStyle: 'float', animationSpeed: 3, sizeDesktop: 40, sizeTablet: 36, sizeMobile: 32, position: 'left', headerPlacement: 'topnav', showSplash: true, showPwa: true, showFavicon: true };
    }
    // Ensure all sections have settings
    _hccSections.forEach(sec => {
        if (!_hccSettings[sec.id]) {
            _hccSettings[sec.id] = { enabled: false, order: _hccSections.indexOf(sec) + 1, title: sec.name, subtitle: '', topSpacing: 0, bottomSpacing: 0, bg: '', animation: 'none', animationSpeed: 0.3 };
        }
    });
    _hccUndoStack = [];
    _hccRedoStack = [];
    _hccRenderLogoPanel();
    _hccRenderList();
    _hccUpdateUndoRedo();
}

function _hccRenderLogoPanel() {
    const panel = document.getElementById('hccLogoPanel');
    if (!panel) return;
    const ls = _hccLogoSettings;
    const previewSrc = ls.logo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none'%3E%3Ccircle cx='20' cy='20' r='18' fill='url(%23g)'/%3E%3Cpath d='M14 28V14l14 7-14 7z' fill='%23fff' opacity='.9'/%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='40' y2='40'%3E%3Cstop stop-color='%2322d3ee'/%3E%3Cstop offset='.5' stop-color='%233b82f6'/%3E%3Cstop offset='1' stop-color='%23a855f7'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E";
    const animClass = ls.animation3d ? ('logo-3d-' + (ls.animationStyle || 'float')) : '';

    panel.innerHTML = `
    <div class="hcc-section" style="border-color: rgba(34,211,238,0.2);">
        <div class="hcc-section-header" style="cursor:default;">
            <div class="hcc-section-icon"><i class="fas fa-cube"></i></div>
            <div class="hcc-section-info">
                <div class="hcc-section-name">Global 3D Logo</div>
                <div class="hcc-section-id">brand-identity</div>
            </div>
        </div>
        <div class="hcc-settings" style="display:block;">
            <div style="display:flex;gap:24px;flex-wrap:wrap;padding:16px;">
                <!-- Preview -->
                <div style="text-align:center;min-width:120px;">
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:8px;">PREVIEW</div>
                    <div style="width:80px;height:80px;margin:0 auto;background:rgba(255,255,255,0.05);border-radius:16px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.1);">
                        <div data-brand-logo class="${animClass}" style="width:${ls.sizeDesktop || 40}px;height:${ls.sizeDesktop || 40}px;">
                            <img src="${previewSrc}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">
                        </div>
                    </div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:6px;">Tamil AI Stream</div>
                </div>
                <!-- Controls -->
                <div style="flex:1;min-width:280px;">
                    <div class="hcc-settings-group">
                        <div class="hcc-settings-group-title"><i class="fas fa-image"></i> Logo Image</div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Upload Logo</span>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <input type="file" accept="image/*" id="hccLogoFile" style="display:none;" onchange="hccLogoUpload(event)">
                                <button class="hcc-topbar-btn hcc-save" onclick="document.getElementById('hccLogoFile').click()" style="font-size:12px;padding:6px 12px;"><i class="fas fa-upload"></i> Choose File</button>
                                <button class="hcc-topbar-btn" onclick="hccLogoReset()" style="font-size:12px;padding:6px 12px;"><i class="fas fa-undo"></i> Reset</button>
                            </div>
                        </div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Logo URL</span>
                            <input class="hcc-input" value="${_hccEsc(ls.logo || '')}" placeholder="https://... or data:image/..." onchange="hccLogoUpdate('logo',this.value)">
                        </div>
                    </div>
                    <div class="hcc-settings-group">
                        <div class="hcc-settings-group-title"><i class="fas fa-cube"></i> 3D Animation</div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Enable 3D</span>
                            <label class="hcc-toggle" onclick="event.stopPropagation()">
                                <input type="checkbox" ${ls.animation3d ? 'checked' : ''} onchange="hccLogoUpdate('animation3d',this.checked)">
                                <span class="hcc-toggle-slider"></span>
                            </label>
                        </div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Style</span>
                            <select class="hcc-input" onchange="hccLogoUpdate('animationStyle',this.value)">
                                <option value="float" ${ls.animationStyle==='float'?'selected':''}>Float</option>
                                <option value="rotate" ${ls.animationStyle==='rotate'?'selected':''}>Rotate</option>
                                <option value="pulse" ${ls.animationStyle==='pulse'?'selected':''}>Pulse</option>
                                <option value="glow" ${ls.animationStyle==='glow'?'selected':''}>Glow</option>
                                <option value="tilt" ${ls.animationStyle==='tilt'?'selected':''}>Tilt</option>
                                <option value="breathe" ${ls.animationStyle==='breathe'?'selected':''}>Breathe</option>
                            </select>
                        </div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Speed (s)</span>
                            <input class="hcc-input" type="number" min="0.5" max="10" step="0.5" value="${ls.animationSpeed || 3}" onchange="hccLogoUpdate('animationSpeed',parseFloat(this.value))">
                        </div>
                    </div>
                    <div class="hcc-settings-group">
                        <div class="hcc-settings-group-title"><i class="fas fa-arrows-alt"></i> Sizes (px)</div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Desktop</span>
                            <input class="hcc-input" type="number" min="16" max="120" value="${ls.sizeDesktop || 40}" onchange="hccLogoUpdate('sizeDesktop',parseInt(this.value))">
                        </div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Tablet</span>
                            <input class="hcc-input" type="number" min="16" max="120" value="${ls.sizeTablet || 36}" onchange="hccLogoUpdate('sizeTablet',parseInt(this.value))">
                        </div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Mobile</span>
                            <input class="hcc-input" type="number" min="16" max="120" value="${ls.sizeMobile || 32}" onchange="hccLogoUpdate('sizeMobile',parseInt(this.value))">
                        </div>
                    </div>
                    <div class="hcc-settings-group">
                        <div class="hcc-settings-group-title"><i class="fas fa-map-marker-alt"></i> Placement</div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Position</span>
                            <select class="hcc-input" onchange="hccLogoUpdate('position',this.value)">
                                <option value="left" ${ls.position==='left'?'selected':''}>Left</option>
                                <option value="center" ${ls.position==='center'?'selected':''}>Center</option>
                                <option value="right" ${ls.position==='right'?'selected':''}>Right</option>
                            </select>
                        </div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Splash Screen</span>
                            <label class="hcc-toggle" onclick="event.stopPropagation()">
                                <input type="checkbox" ${ls.showSplash !== false ? 'checked' : ''} onchange="hccLogoUpdate('showSplash',this.checked)">
                                <span class="hcc-toggle-slider"></span>
                            </label>
                        </div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">PWA Header</span>
                            <label class="hcc-toggle" onclick="event.stopPropagation()">
                                <input type="checkbox" ${ls.showPwa !== false ? 'checked' : ''} onchange="hccLogoUpdate('showPwa',this.checked)">
                                <span class="hcc-toggle-slider"></span>
                            </label>
                        </div>
                        <div class="hcc-settings-row">
                            <span class="hcc-label">Favicon</span>
                            <label class="hcc-toggle" onclick="event.stopPropagation()">
                                <input type="checkbox" ${ls.showFavicon !== false ? 'checked' : ''} onchange="hccLogoUpdate('showFavicon',this.checked)">
                                <span class="hcc-toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function hccLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        _hccLogoSettings.logo = e.target.result;
        _hccRenderLogoPanel();
        showToast('Logo uploaded! Click Save to apply.', 'success');
    };
    reader.readAsDataURL(file);
}

function hccLogoUpdate(key, value) {
    _hccLogoSettings[key] = value;
    _hccRenderLogoPanel();
}

function hccLogoReset() {
    _hccLogoSettings = { logo: '', logoWidth: 40, animation3d: false, animationStyle: 'float', animationSpeed: 3, sizeDesktop: 40, sizeTablet: 36, sizeMobile: 32, position: 'left', headerPlacement: 'topnav', showSplash: true, showPwa: true, showFavicon: true };
    _hccRenderLogoPanel();
    showToast('Logo reset to default', 'success');
}

function _hccRenderList() {
    const container = document.getElementById('hccSectionsList');
    if (!container) return;
    const sorted = _hccSections.slice().sort((a, b) => {
        const sa = _hccSettings[a.id] || {};
        const sb = _hccSettings[b.id] || {};
        return (sa.order || 99) - (sb.order || 99);
    });
    container.innerHTML = sorted.map((sec, idx) => {
        const s = _hccSettings[sec.id] || {};
        const enabled = s.enabled !== false;
        const order = s.order || _hccSections.indexOf(sec) + 1;
        const isFirst = idx === 0;
        const isLast = idx === sorted.length - 1;
        return `<div class="hcc-section ${enabled ? '' : 'disabled-section'}" data-id="${sec.id}" draggable="true">
            <div class="hcc-section-header">
                <div class="hcc-drag-handle"><i class="fas fa-grip-vertical"></i></div>
                <div class="hcc-section-icon"><i class="fas ${sec.icon}"></i></div>
                <div class="hcc-section-info">
                    <div class="hcc-section-name">${sec.name}</div>
                    <div class="hcc-section-id">${sec.id}</div>
                </div>
                <span class="hcc-section-order">#${order}</span>
                <div class="hcc-move-btns">
                    <button class="hcc-move-btn" title="Move Up" ${isFirst ? 'disabled' : ''} onclick="hccMoveSection('${sec.id}','up')"><i class="fas fa-chevron-up"></i></button>
                    <button class="hcc-move-btn" title="Move Down" ${isLast ? 'disabled' : ''} onclick="hccMoveSection('${sec.id}','down')"><i class="fas fa-chevron-down"></i></button>
                </div>
                <label class="hcc-toggle" onclick="event.stopPropagation()">
                    <input type="checkbox" ${enabled ? 'checked' : ''} onchange="hccToggleSection('${sec.id}', this.checked)">
                    <span class="hcc-toggle-slider"></span>
                </label>
                <button class="hcc-expand-btn" onclick="hccToggleSettings('${sec.id}', this)"><i class="fas fa-chevron-down"></i></button>
            </div>
            <div class="hcc-settings" id="hcc-settings-${sec.id}">
                ${_hccRenderSectionSettings(sec, s, sorted)}
            </div>
        </div>`;
    }).join('');
    _hccSetupDrag();
}

function _hccRenderSectionSettings(sec, s, allSorted) {
    let html = '';
    // Section Controls
    html += `<div class="hcc-settings-group">
        <div class="hcc-settings-group-title"><i class="fas fa-cog"></i> Section Controls</div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Title</span>
            <input class="hcc-input" value="${_hccEsc(s.title || sec.name)}" onchange="hccUpdate('${sec.id}','title',this.value)">
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Subtitle</span>
            <input class="hcc-input" value="${_hccEsc(s.subtitle || '')}" onchange="hccUpdate('${sec.id}','subtitle',this.value)">
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Top Spacing</span>
            <input class="hcc-input hcc-input-sm" type="number" min="0" max="200" value="${s.topSpacing || 0}" onchange="hccUpdate('${sec.id}','topSpacing',+this.value)">
            <span class="hcc-label" style="min-width:auto">px</span>
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Bottom Spacing</span>
            <input class="hcc-input hcc-input-sm" type="number" min="0" max="200" value="${s.bottomSpacing || 0}" onchange="hccUpdate('${sec.id}','bottomSpacing',+this.value)">
            <span class="hcc-label" style="min-width:auto">px</span>
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Left Spacing</span>
            <input class="hcc-input hcc-input-sm" type="number" min="0" max="200" value="${s.leftSpacing || 0}" onchange="hccUpdate('${sec.id}','leftSpacing',+this.value)">
            <span class="hcc-label" style="min-width:auto">px</span>
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Right Spacing</span>
            <input class="hcc-input hcc-input-sm" type="number" min="0" max="200" value="${s.rightSpacing || 0}" onchange="hccUpdate('${sec.id}','rightSpacing',+this.value)">
            <span class="hcc-label" style="min-width:auto">px</span>
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Background</span>
            <input class="hcc-color-input" type="color" value="${s.bg || '#000000'}" onchange="hccUpdate('${sec.id}','bg',this.value)">
            <input class="hcc-input" value="${_hccEsc(s.bg || '')}" placeholder="transparent / #hex / rgba()" onchange="hccUpdate('${sec.id}','bg',this.value)" style="flex:1">
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Animation</span>
            <select class="hcc-select" onchange="hccUpdate('${sec.id}','animation',this.value)">
                ${_hccAnimOptions(s.animation)}
            </select>
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Anim Speed</span>
            <input class="hcc-input hcc-input-sm" type="number" min="0.1" max="3" step="0.1" value="${s.animationSpeed || 0.3}" onchange="hccUpdate('${sec.id}','animationSpeed',+this.value)">
            <span class="hcc-label" style="min-width:auto">s</span>
        </div>
    </div>`;

    // Layout & Position Controls
    html += `<div class="hcc-settings-group">
        <div class="hcc-settings-group-title"><i class="fas fa-arrows-alt"></i> Layout & Position</div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Section Width</span>
            <input class="hcc-input" value="${_hccEsc(s.sectionWidth || '')}" placeholder="auto / 800px / 90%" onchange="hccUpdate('${sec.id}','sectionWidth',this.value||null)">
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Alignment</span>
            <select class="hcc-select" onchange="hccUpdate('${sec.id}','alignment',this.value)">
                <option value="stretch" ${(!s.alignment||s.alignment==='stretch')?'selected':''}>Stretch (Full)</option>
                <option value="left" ${s.alignment==='left'?'selected':''}>Left</option>
                <option value="center" ${s.alignment==='center'?'selected':''}>Center</option>
                <option value="right" ${s.alignment==='right'?'selected':''}>Right</option>
            </select>
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Position</span>
            <select class="hcc-select" onchange="hccUpdate('${sec.id}','position',this.value)">
                <option value="static" ${(!s.position||s.position==='static')?'selected':''}>Static (Flow)</option>
                <option value="relative" ${s.position==='relative'?'selected':''}>Relative</option>
            </select>
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Move Before</span>
            <select class="hcc-select" onchange="hccMoveBefore('${sec.id}',this.value);this.value='';">
                <option value="">-- Select Section --</option>
                ${(allSorted||[]).filter(x=>x.id!==sec.id).map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}
            </select>
        </div>
        <div class="hcc-settings-row">
            <span class="hcc-label">Move After</span>
            <select class="hcc-select" onchange="hccMoveAfter('${sec.id}',this.value);this.value='';">
                <option value="">-- Select Section --</option>
                ${(allSorted||[]).filter(x=>x.id!==sec.id).map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}
            </select>
        </div>
    </div>`;

    // Card Controls
    if (sec.hasCards) {
        const c = s.card || {};
        html += `<div class="hcc-settings-group">
            <div class="hcc-settings-group-title"><i class="fas fa-clone"></i> Card Controls</div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Width</span>
                <input class="hcc-input hcc-input-sm" type="number" min="80" max="400" value="${c.width || 180}" onchange="hccUpdateCard('${sec.id}','width',+this.value)">
                <span class="hcc-label" style="min-width:auto">px</span>
            </div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Gap</span>
                <input class="hcc-input hcc-input-sm" type="number" min="0" max="40" value="${c.gap || 12}" onchange="hccUpdateCard('${sec.id}','gap',+this.value)">
                <span class="hcc-label" style="min-width:auto">px</span>
            </div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Radius</span>
                <input class="hcc-input hcc-input-sm" type="number" min="0" max="40" value="${c.radius || 14}" onchange="hccUpdateCard('${sec.id}','radius',+this.value)">
                <span class="hcc-label" style="min-width:auto">px</span>
            </div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Thumb Aspect</span>
                <select class="hcc-select" onchange="hccUpdateCard('${sec.id}','thumbAspect',this.value)">
                    <option value="1/1" ${c.thumbAspect==='1/1'?'selected':''}>1:1 Square</option>
                    <option value="3/4" ${c.thumbAspect==='3/4'?'selected':''}>3:4 Portrait</option>
                    <option value="4/3" ${c.thumbAspect==='4/3'?'selected':''}>4:3 Landscape</option>
                    <option value="16/9" ${c.thumbAspect==='16/9'?'selected':''}>16:9 Wide</option>
                </select>
            </div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Hover Effect</span>
                <select class="hcc-select" onchange="hccUpdateCard('${sec.id}','hover',this.value)">
                    <option value="none" ${c.hover==='none'?'selected':''}>None</option>
                    <option value="lift" ${c.hover==='lift'||!c.hover?'selected':''}>Lift</option>
                    <option value="scale" ${c.hover==='scale'?'selected':''}>Scale</option>
                    <option value="glow" ${c.hover==='glow'?'selected':''}>Glow</option>
                </select>
            </div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Card Animation</span>
                <select class="hcc-select" onchange="hccUpdateCard('${sec.id}','animation',this.value)">
                    ${_hccAnimOptions(c.animation)}
                </select>
            </div>
            ${_hccResponsiveSettings(sec.id, s.responsive)}
        </div>`;
    }

    // Auto-Scroll Controls
    if (sec.hasAutoScroll) {
        const a = s.autoScroll || {};
        html += `<div class="hcc-settings-group">
            <div class="hcc-settings-group-title"><i class="fas fa-arrows-spin"></i> Auto-Scroll</div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Direction</span>
                <select class="hcc-select" onchange="hccUpdateScroll('${sec.id}','direction',this.value)">
                    <option value="ltr" ${a.direction==='ltr'?'selected':''}>Left → Right</option>
                    <option value="rtl" ${a.direction==='rtl'?'selected':''}>Right → Left</option>
                    <option value="up" ${a.direction==='up'?'selected':''}>Up</option>
                    <option value="down" ${a.direction==='down'?'selected':''}>Down</option>
                    <option value="up-down" ${a.direction==='up-down'?'selected':''}>Up + Down (Dual)</option>
                </select>
            </div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Speed</span>
                <input class="hcc-input hcc-input-sm" type="number" min="5" max="100" value="${a.speed || 30}" onchange="hccUpdateScroll('${sec.id}','speed',+this.value)">
                <span class="hcc-label" style="min-width:auto">px/s</span>
            </div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Touch</span>
                <select class="hcc-select" onchange="hccUpdateScroll('${sec.id}','touch',this.value)">
                    <option value="pass-through" ${a.touch==='pass-through'||!a.touch?'selected':''}>Pass Through</option>
                    <option value="pause" ${a.touch==='pause'?'selected':''}>Pause</option>
                </select>
            </div>
            <div class="hcc-settings-row">
                <span class="hcc-label">Hover</span>
                <select class="hcc-select" onchange="hccUpdateScroll('${sec.id}','hover',this.value)">
                    <option value="ignore" ${a.hover==='ignore'||!a.hover?'selected':''}>Ignore</option>
                    <option value="pause" ${a.hover==='pause'?'selected':''}>Pause</option>
                </select>
            </div>
        </div>`;
    }
    return html;
}

function _hccResponsiveSettings(sectionId, resp) {
    const r = resp || {};
    return `<div class="hcc-settings-group" style="margin-top:8px;border-style:dashed;">
        <div class="hcc-settings-group-title"><i class="fas fa-mobile-screen"></i> Responsive</div>
        <div class="hcc-resp-tabs">
            <button class="hcc-resp-tab active" onclick="hccSwitchResp(this,'${sectionId}','mobile')">Mobile</button>
            <button class="hcc-resp-tab" onclick="hccSwitchResp(this,'${sectionId}','tablet')">Tablet</button>
            <button class="hcc-resp-tab" onclick="hccSwitchResp(this,'${sectionId}','desktop')">Desktop</button>
        </div>
        <div class="hcc-resp-content" id="hcc-resp-${sectionId}">
            ${_hccRespFields(sectionId, 'mobile', r.mobile || {})}
        </div>
    </div>`;
}

function _hccRespFields(sectionId, device, vals) {
    return `<div class="hcc-settings-row">
        <span class="hcc-label">Width</span>
        <input class="hcc-input hcc-input-sm" type="number" min="80" max="400" value="${vals.width || ''}" placeholder="auto" onchange="hccUpdateResp('${sectionId}','${device}','width',+this.value||null)">
        <span class="hcc-label" style="min-width:auto">px</span>
    </div>
    <div class="hcc-settings-row">
        <span class="hcc-label">Gap</span>
        <input class="hcc-input hcc-input-sm" type="number" min="0" max="40" value="${vals.gap || ''}" placeholder="auto" onchange="hccUpdateResp('${sectionId}','${device}','gap',+this.value||null)">
        <span class="hcc-label" style="min-width:auto">px</span>
    </div>
    <div class="hcc-settings-row">
        <span class="hcc-label">Radius</span>
        <input class="hcc-input hcc-input-sm" type="number" min="0" max="40" value="${vals.radius || ''}" placeholder="auto" onchange="hccUpdateResp('${sectionId}','${device}','radius',+this.value||null)">
        <span class="hcc-label" style="min-width:auto">px</span>
    </div>
    <div class="hcc-settings-row">
        <span class="hcc-label">Position</span>
        <select class="hcc-select" onchange="hccUpdateResp('${sectionId}','${device}','position',this.value||null)">
            <option value="" ${!vals.position?'selected':''}>Default</option>
            <option value="static" ${vals.position==='static'?'selected':''}>Static</option>
            <option value="relative" ${vals.position==='relative'?'selected':''}>Relative</option>
        </select>
    </div>
    <div class="hcc-settings-row">
        <span class="hcc-label">Alignment</span>
        <select class="hcc-select" onchange="hccUpdateResp('${sectionId}','${device}','alignment',this.value||null)">
            <option value="" ${!vals.alignment?'selected':''}>Default</option>
            <option value="stretch" ${vals.alignment==='stretch'?'selected':''}>Stretch</option>
            <option value="left" ${vals.alignment==='left'?'selected':''}>Left</option>
            <option value="center" ${vals.alignment==='center'?'selected':''}>Center</option>
            <option value="right" ${vals.alignment==='right'?'selected':''}>Right</option>
        </select>
    </div>`;
}

function hccSwitchResp(btn, sectionId, device) {
    const parent = btn.closest('.hcc-settings-group');
    parent.querySelectorAll('.hcc-resp-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const s = _hccSettings[sectionId] || {};
    const r = (s.responsive || {})[device] || {};
    document.getElementById('hcc-resp-' + sectionId).innerHTML = _hccRespFields(sectionId, device, r);
}

function _hccAnimOptions(current) {
    const opts = ['none','fade-in','slide-up','slide-left','scale-in','zoom-in'];
    return opts.map(o => `<option value="${o}" ${current===o||(o==='none'&&!current)?'selected':''}>${o}</option>`).join('');
}

function _hccEsc(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

function hccToggleSection(id, enabled) {
    _hccPushUndo();
    if (!_hccSettings[id]) _hccSettings[id] = {};
    _hccSettings[id].enabled = enabled;
    const el = document.querySelector(`.hcc-section[data-id="${id}"]`);
    if (el) el.classList.toggle('disabled-section', !enabled);
}

function hccToggleSettings(id, btn) {
    const panel = document.getElementById('hcc-settings-' + id);
    if (!panel) return;
    const isOpen = panel.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
}

function hccUpdate(id, key, value) {
    _hccPushUndo();
    if (!_hccSettings[id]) _hccSettings[id] = {};
    _hccSettings[id][key] = value;
}

function hccUpdateCard(id, key, value) {
    _hccPushUndo();
    if (!_hccSettings[id]) _hccSettings[id] = {};
    if (!_hccSettings[id].card) _hccSettings[id].card = {};
    _hccSettings[id].card[key] = value;
}

function hccUpdateScroll(id, key, value) {
    _hccPushUndo();
    if (!_hccSettings[id]) _hccSettings[id] = {};
    if (!_hccSettings[id].autoScroll) _hccSettings[id].autoScroll = {};
    _hccSettings[id].autoScroll[key] = value;
}

function hccUpdateResp(id, device, key, value) {
    _hccPushUndo();
    if (!_hccSettings[id]) _hccSettings[id] = {};
    if (!_hccSettings[id].responsive) _hccSettings[id].responsive = {};
    if (!_hccSettings[id].responsive[device]) _hccSettings[id].responsive[device] = {};
    _hccSettings[id].responsive[device][key] = value;
}

function hccMoveSection(id, dir) {
    _hccPushUndo();
    const sorted = _hccSections.slice().sort((a, b) => {
        const sa = _hccSettings[a.id] || {};
        const sb = _hccSettings[b.id] || {};
        return (sa.order || 99) - (sb.order || 99);
    });
    const idx = sorted.findIndex(s => s.id === id);
    if (idx < 0) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    // Swap orders
    const currentOrder = (_hccSettings[id] || {}).order || (idx + 1);
    const targetId = sorted[targetIdx].id;
    const targetOrder = (_hccSettings[targetId] || {}).order || (targetIdx + 1);
    if (!_hccSettings[id]) _hccSettings[id] = {};
    if (!_hccSettings[targetId]) _hccSettings[targetId] = {};
    _hccSettings[id].order = targetOrder;
    _hccSettings[targetId].order = currentOrder;
    _hccRenderList();
}

function hccMoveBefore(id, beforeId) {
    if (!beforeId || id === beforeId) return;
    _hccPushUndo();
    const sorted = _hccSections.slice().sort((a, b) => {
        const sa = _hccSettings[a.id] || {};
        const sb = _hccSettings[b.id] || {};
        return (sa.order || 99) - (sb.order || 99);
    });
    const beforeIdx = sorted.findIndex(s => s.id === beforeId);
    if (beforeIdx < 0) return;
    // Set order to target order - 0.5, then reindex
    const targetOrder = (_hccSettings[beforeId] || {}).order || (beforeIdx + 1);
    if (!_hccSettings[id]) _hccSettings[id] = {};
    _hccSettings[id].order = targetOrder - 0.5;
    _hccReindexOrders();
    _hccRenderList();
}

function hccMoveAfter(id, afterId) {
    if (!afterId || id === afterId) return;
    _hccPushUndo();
    const sorted = _hccSections.slice().sort((a, b) => {
        const sa = _hccSettings[a.id] || {};
        const sb = _hccSettings[b.id] || {};
        return (sa.order || 99) - (sb.order || 99);
    });
    const afterIdx = sorted.findIndex(s => s.id === afterId);
    if (afterIdx < 0) return;
    const targetOrder = (_hccSettings[afterId] || {}).order || (afterIdx + 1);
    if (!_hccSettings[id]) _hccSettings[id] = {};
    _hccSettings[id].order = targetOrder + 0.5;
    _hccReindexOrders();
    _hccRenderList();
}

function _hccReindexOrders() {
    const sorted = _hccSections.slice().sort((a, b) => {
        const sa = _hccSettings[a.id] || {};
        const sb = _hccSettings[b.id] || {};
        return (sa.order || 99) - (sb.order || 99);
    });
    sorted.forEach((sec, i) => {
        if (_hccSettings[sec.id]) _hccSettings[sec.id].order = i + 1;
    });
}

function _hccPushUndo() {
    _hccUndoStack.push(JSON.stringify(_hccSettings));
    if (_hccUndoStack.length > 50) _hccUndoStack.shift();
    _hccRedoStack = [];
    _hccUpdateUndoRedo();
}

function _hccUpdateUndoRedo() {
    const undoBtn = document.getElementById('hccUndoBtn');
    const redoBtn = document.getElementById('hccRedoBtn');
    if (undoBtn) undoBtn.disabled = _hccUndoStack.length === 0;
    if (redoBtn) redoBtn.disabled = _hccRedoStack.length === 0;
    // Also sync global toolbar when on HCC page
    if (_currentPage === 'homecontrol') {
        const gbUndo = document.getElementById('gbUndoBtn');
        const gbRedo = document.getElementById('gbRedoBtn');
        if (gbUndo) gbUndo.disabled = _hccUndoStack.length === 0;
        if (gbRedo) gbRedo.disabled = _hccRedoStack.length === 0;
    }
}

function hccUndo() {
    if (!_hccUndoStack.length) return;
    _hccRedoStack.push(JSON.stringify(_hccSettings));
    _hccSettings = JSON.parse(_hccUndoStack.pop());
    _hccRenderList();
    _hccUpdateUndoRedo();
}

function hccRedo() {
    if (!_hccRedoStack.length) return;
    _hccUndoStack.push(JSON.stringify(_hccSettings));
    _hccSettings = JSON.parse(_hccRedoStack.pop());
    _hccRenderList();
    _hccUpdateUndoRedo();
}

function hccSave() {
    DataStore.setSectionSettings(_hccSettings);
    DataStore.setLogoSettings(_hccLogoSettings);
    // Also sync sectionsOrder for backward compatibility
    const orderArr = _hccSections.map((sec, i) => {
        const s = _hccSettings[sec.id] || {};
        return { id: sec.id, name: sec.name, order: s.order || i + 1, enabled: s.enabled !== false };
    }).sort((a, b) => a.order - b.order);
    DataStore.setSectionsOrder(orderArr);
    // Also write to websiteLayout for legacy sync
    const layout = orderArr.filter(s => s.enabled).map(s => ({ type: s.id }));
    DataStore.setLayout(layout);
    // Apply logo to live site immediately
    if (typeof BrandConfig !== 'undefined' && BrandConfig.apply) BrandConfig.apply();
    showToast('Settings saved!', 'success');
}

function hccPreview() {
    hccSave();
    window.open('index.html', '_blank');
}

async function hccPublish() {
    hccSave();
    // Use global toolbar progress bar
    const progressEl = document.getElementById('gbProgress');
    const fillEl = document.getElementById('gbProgressFill');
    const textEl = document.getElementById('gbProgressText');
    const publishBtn = document.getElementById('gbPublishBtn');
    if (!progressEl || !fillEl || !textEl) return;

    progressEl.style.display = 'flex';
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span class="gb-btn-label">Updating...</span>';

    function setProgress(pct, msg) {
        fillEl.style.width = pct + '%';
        textEl.textContent = msg || (pct + '%');
    }

    try {
        setProgress(10, 'Saving settings...');
        await new Promise(r => setTimeout(r, 300));

        setProgress(30, 'Syncing to live website...');
        syncToLiveWebsite();
        await new Promise(r => setTimeout(r, 500));

        setProgress(60, 'Uploading to R2...');
        if (window.ContentSync && typeof ContentSync.syncCurrentState === 'function') {
            await ContentSync.syncCurrentState();
        }
        await new Promise(r => setTimeout(r, 500));

        setProgress(85, 'Verifying deployment...');
        await new Promise(r => setTimeout(r, 500));

        try {
            const res = await fetch('/api/deploy-verify');
            const data = await res.json();
            if (data.ok) {
                setProgress(100, `Update Complete! (${data.stationCount} stations, ${data.songCount} songs)`);
            } else {
                setProgress(100, 'Update Complete!');
            }
        } catch (_) {
            setProgress(100, 'Update Complete!');
        }

        setTimeout(() => { progressEl.style.display = 'none'; }, 3000);
    } catch (err) {
        setProgress(100, 'Update failed: ' + err.message);
        showToast('Publish failed', 'error');
    } finally {
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<i class="fas fa-rocket"></i> <span class="gb-btn-label">Update Website</span>';
    }
}

function _hccSetupDrag() {
    const list = document.getElementById('hccSectionsList');
    if (!list) return;
    _hccDragItem = null;
    list.querySelectorAll('.hcc-section').forEach(item => {
        item.addEventListener('dragstart', e => {
            _hccDragItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            _hccDragItem?.classList.remove('dragging');
            _hccDragItem = null;
            _hccReorderFromDOM();
        });
        item.addEventListener('dragover', e => {
            e.preventDefault();
            if (!_hccDragItem || _hccDragItem === item) return;
            const rect = item.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) list.insertBefore(_hccDragItem, item);
            else list.insertBefore(_hccDragItem, item.nextSibling);
        });
    });
}

function _hccReorderFromDOM() {
    _hccPushUndo();
    const items = document.querySelectorAll('.hcc-section');
    items.forEach((item, i) => {
        const id = item.dataset.id;
        if (_hccSettings[id]) _hccSettings[id].order = i + 1;
        const orderEl = item.querySelector('.hcc-section-order');
        if (orderEl) orderEl.textContent = '#' + (i + 1);
    });
}

// Bind Global Toolbar + HCC button events
document.addEventListener('DOMContentLoaded', () => {
    // Global toolbar buttons
    document.getElementById('gbUndoBtn')?.addEventListener('click', gbUndo);
    document.getElementById('gbRedoBtn')?.addEventListener('click', gbRedo);
    document.getElementById('gbHistoryBtn')?.addEventListener('click', gbToggleHistory);
    document.getElementById('gbSaveBtn')?.addEventListener('click', gbSave);
    document.getElementById('gbPreviewBtn')?.addEventListener('click', gbPreview);
    document.getElementById('gbPublishBtn')?.addEventListener('click', gbPublish);

    // Legacy HCC buttons (redirect to global toolbar)
    document.getElementById('hccUndoBtn')?.addEventListener('click', gbUndo);
    document.getElementById('hccRedoBtn')?.addEventListener('click', gbRedo);
    document.getElementById('hccSaveBtn')?.addEventListener('click', gbSave);
    document.getElementById('hccPreviewBtn')?.addEventListener('click', gbPreview);
    document.getElementById('hccPublishBtn')?.addEventListener('click', gbPublish);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); gbUndo(); }
        if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); gbRedo(); }
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); gbSave(); }
    });

    // Initialize toolbar for default page
    gbUpdateToolbarForPage('dashboard');
});

// ============================================
// Advertisement/Banner Management
// ============================================
const AD_POSITIONS = {
    0: 'Hero (Top Carousel)',
    2: 'After Recently Added',
    3: 'After Trending',
    4: 'After Latest Releases'
};

function loadAdsTable() {
    let ads = DataStore.getAdvertisements();
    ads = _filterDeletedItems(ads, 'advertisements');
    const tbody = document.getElementById('adsTableBody');
    const emptyState = document.getElementById('adsEmptyState');
    if (!tbody) return;

    if (!ads.length) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = ads.sort((a, b) => (a.position || 0) - (b.position || 0)).map(ad => {
        const thumbSrc = ad.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 60'%3E%3Crect width='120' height='60' rx='6' fill='%23374151'/%3E%3Ctext x='60' y='35' text-anchor='middle' fill='%239ca3af' font-size='11'%3EAd Banner%3C/text%3E%3C/svg%3E";
        return `
        <tr>
            <td data-label="Preview"><img src="${thumbSrc}" alt="${ad.title || ''}" style="width:120px;height:60px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1);"></td>
            <td data-label="Title"><strong>${ad.title || 'Untitled'}</strong><br><small style="color:#888;">${ad.description || ''}</small></td>
            <td data-label="Position"><span style="background:rgba(52,211,153,0.15);color:#6ee7b7;padding:3px 10px;border-radius:12px;font-size:12px;">Position ${ad.position || '?'} â€” ${AD_POSITIONS[ad.position] || 'Unknown'}</span></td>
            <td data-label="Status"><span class="status-badge ${ad.enabled !== false ? 'active' : 'inactive'}" style="cursor:pointer;" onclick="toggleAd('${ad.id}')">${ad.enabled !== false ? 'Enabled' : 'Disabled'}</span></td>
            <td data-label="Actions">
                <div style="display:flex;gap:6px;">
                    <button class="builder-btn small" onclick="openEditAdModal('${ad.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="builder-btn small danger" onclick="deleteAd('${ad.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function openAddAdModal() {
    document.getElementById('adModalTitle').textContent = 'Add Advertisement';
    document.getElementById('adEditId').value = '';
    document.getElementById('adForm').reset();
    document.getElementById('adEnabled').value = 'true';
    document.getElementById('adPosition').value = '0';
    const preview = document.getElementById('adImagePreview');
    if (preview) preview.style.display = 'none';
    document.getElementById('adModalOverlay').style.display = 'flex';
}

function openEditAdModal(adId) {
    const ads = DataStore.getAdvertisements();
    const ad = ads.find(a => a.id === adId);
    if (!ad) return;

    document.getElementById('adModalTitle').textContent = 'Edit Advertisement';
    document.getElementById('adEditId').value = ad.id;
    document.getElementById('adTitle').value = ad.title || '';
    document.getElementById('adDescription').value = ad.description || '';
    document.getElementById('adImageUrl').value = ad.imageUrl || '';
    document.getElementById('adTargetLink').value = ad.targetLink || '';
    document.getElementById('adPosition').value = String(ad.position || 1);
    document.getElementById('adEnabled').value = ad.enabled !== false ? 'true' : 'false';

    const preview = document.getElementById('adImagePreview');
    if (ad.imageUrl && preview) {
        preview.querySelector('img').src = ad.imageUrl;
        preview.style.display = 'block';
    } else if (preview) {
        preview.style.display = 'none';
    }

    document.getElementById('adModalOverlay').style.display = 'flex';
}

function closeAdModal() {
    document.getElementById('adModalOverlay').style.display = 'none';
}

async function saveAd(event) {
    event.preventDefault();
    const editId = document.getElementById('adEditId').value;
    const title = document.getElementById('adTitle').value.trim();
    const description = document.getElementById('adDescription').value.trim();
    const imageUrlInput = document.getElementById('adImageUrl').value.trim();
    const imageFile = document.getElementById('adImageFile').files[0];
    const targetLink = document.getElementById('adTargetLink').value.trim();
    const position = parseInt(document.getElementById('adPosition').value) || 1;
    const enabled = document.getElementById('adEnabled').value === 'true';

    if (!title) { showToast('Title is required', 'warning'); return; }

    let imageUrl = imageUrlInput;
    let imagePublicId = '';

    if (imageFile) {
        try {
            const result = await R2Uploader.uploadImage(imageFile, 'tamil-ai-stream/banners', (pct) => {
                console.log('Upload progress:', pct + '%');
            });
            if (result && result.url) {
                imageUrl = result.url;
                imagePublicId = result.publicId || '';
            }
        } catch (err) {
            console.error('Banner upload failed:', err);
            showToast('Image upload failed. Using URL fallback.', 'warning');
            if (!imageUrl) { showToast('Please provide an image URL or file', 'error'); return; }
        }
    }

    if (!imageUrl) { showToast('Banner image is required', 'warning'); return; }

    const ads = DataStore.getAdvertisements();
    const now = new Date().toISOString();

    if (editId) {
        const idx = ads.findIndex(a => a.id === editId);
        if (idx !== -1) {
            ads[idx] = Object.assign({}, ads[idx], {
                title, description, imageUrl,
                imagePublicId: imagePublicId || ads[idx].imagePublicId,
                targetLink, position, enabled, updatedAt: now
            });
        }
    } else {
        ads.push({
            id: 'ad_' + Date.now(),
            title, description, imageUrl, imagePublicId,
            targetLink, position, enabled,
            createdAt: now, updatedAt: now
        });
    }

    DataStore.setAdvertisements(ads);
    closeAdModal();
    loadAdsTable();
    showToast(editId ? 'Advertisement updated' : 'Advertisement added', 'success');
    syncToLiveWebsite();
}

function deleteAd(adId) {
    if (!confirm('Move this advertisement to Trash?')) return;
    let ads = DataStore._getRaw(DataStore.KEYS.ADVERTISEMENTS) || [];
    const ad = ads.find(a => a.id === adId);
    if (ad) DataStore.moveToTrash(ad, 'advertisements');
    ads = ads.filter(a => a.id !== adId);
    localStorage.setItem(DataStore.KEYS.ADVERTISEMENTS, JSON.stringify(ads));
    loadAdsTable();
    showToast('Advertisement moved to Trash', 'success');
    syncToLiveWebsite();
}

function toggleAd(adId) {
    const ads = DataStore.getAdvertisements();
    const ad = ads.find(a => a.id === adId);
    if (ad) {
        ad.enabled = !ad.enabled;
        ad.updatedAt = new Date().toISOString();
        DataStore.setAdvertisements(ads);
        loadAdsTable();
        showToast(ad.enabled ? 'Advertisement enabled' : 'Advertisement disabled', 'info');
        syncToLiveWebsite();
    }
}

// ============================================
// Upcoming Releases Management
// ============================================
function loadUpcomingReleasesTable() {
    let releases = DataStore.getUpcomingReleases();
    releases = _filterDeletedItems(releases, 'upcomingReleases');
    const tbody = document.getElementById('upcomingReleasesTableBody');
    const emptyState = document.getElementById('upcomingReleasesEmptyState');
    if (!tbody) return;

    if (!releases.length) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = releases.sort((a, b) => (a.order || 0) - (b.order || 0)).map(r => `
        <tr>
            <td><div style="width:80px;height:45px;border-radius:6px;overflow:hidden;background:rgba(255,255,255,0.05);">
                ${r.image ? `<img src="${r.image}" alt="" style="width:100%;height:100%;object-fit:cover;">` :
                '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;"><i class="fas fa-image"></i></div>'}
            </div></td>
            <td><strong>${r.title || 'Untitled'}</strong></td>
            <td style="color:rgba(255,255,255,0.6);font-size:13px;">${r.subtitle || 'â€”'}</td>
            <td><span class="builder-badge info">${r.order || 0}</span></td>
            <td><span class="builder-badge ${r.enabled !== false ? 'success' : 'warning'}">${r.enabled !== false ? 'Enabled' : 'Disabled'}</span></td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="builder-btn small" onclick="openUpcomingReleaseModal('${r.id}')" title="Edit"><i class="fas fa-pen"></i></button>
                    <button class="builder-btn small" onclick="toggleUpcomingRelease('${r.id}')" title="Toggle">${r.enabled !== false ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'}</button>
                    <button class="builder-btn small" onclick="moveUpcomingRelease('${r.id}', -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                    <button class="builder-btn small" onclick="moveUpcomingRelease('${r.id}', 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>
                    <button class="builder-btn small danger" onclick="deleteUpcomingRelease('${r.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');
}

function openUpcomingReleaseModal(editId) {
    const overlay = document.getElementById('upcomingReleaseModalOverlay');
    const titleEl = document.getElementById('upcomingReleaseModalTitle');
    const form = document.getElementById('upcomingReleaseForm');

    if (editId) {
        const releases = DataStore.getUpcomingReleases();
        const r = releases.find(x => x.id === editId);
        if (!r) return;
        titleEl.textContent = 'Edit Upcoming Release';
        document.getElementById('urEditId').value = r.id;
        document.getElementById('urTitle').value = r.title || '';
        document.getElementById('urSubtitle').value = r.subtitle || '';
        document.getElementById('urImageUrl').value = r.image || '';
        document.getElementById('urOrder').value = r.order || 0;
        document.getElementById('urEnabled').value = r.enabled !== false ? 'true' : 'false';
        const preview = document.getElementById('urImagePreview');
        if (r.image) { preview.style.display = 'block'; preview.querySelector('img').src = r.image; }
        else { preview.style.display = 'none'; }
    } else {
        titleEl.textContent = 'Add Upcoming Release';
        form.reset();
        document.getElementById('urEditId').value = '';
        document.getElementById('urOrder').value = (DataStore.getUpcomingReleases().length);
        document.getElementById('urImagePreview').style.display = 'none';
    }
    overlay.style.display = 'flex';
}

function closeUpcomingReleaseModal() {
    document.getElementById('upcomingReleaseModalOverlay').style.display = 'none';
}

async function saveUpcomingRelease(event) {
    event.preventDefault();
    const editId = document.getElementById('urEditId').value;
    const title = document.getElementById('urTitle').value.trim();
    const subtitle = document.getElementById('urSubtitle').value.trim();
    const imageUrlInput = document.getElementById('urImageUrl').value.trim();
    const imageFile = document.getElementById('urImageFile').files[0];
    const order = parseInt(document.getElementById('urOrder').value) || 0;
    const enabled = document.getElementById('urEnabled').value === 'true';

    if (!title) { showToast('Title is required', 'warning'); return; }

    let imageUrl = imageUrlInput;

    if (imageFile) {
        try {
            const result = await R2Uploader.uploadImage(imageFile, 'tamil-ai-stream/releases', (pct) => {
                console.log('Upload progress:', pct + '%');
            });
            if (result && result.url) {
                imageUrl = result.url;
            }
        } catch (err) {
            console.error('Upload failed:', err);
            showToast('Image upload failed', 'error');
            return;
        }
    }

    if (!imageUrl) { showToast('Please provide a poster image', 'warning'); return; }

    const now = new Date().toISOString();
    let releases = DataStore.getUpcomingReleases();

    if (editId) {
        const r = releases.find(x => x.id === editId);
        if (r) { Object.assign(r, { title, subtitle, imageUrl, image: imageUrl, order, enabled, updatedAt: now }); }
    } else {
        releases.push({
            id: 'ur_' + Date.now(),
            title, subtitle, image: imageUrl, order, enabled,
            createdAt: now, updatedAt: now
        });
    }

    DataStore.setUpcomingReleases(releases);
    closeUpcomingReleaseModal();
    loadUpcomingReleasesTable();
    showToast(editId ? 'Release updated' : 'Release added', 'success');
    syncToLiveWebsite();
}

function deleteUpcomingRelease(id) {
    if (!confirm('Move this release to Trash?')) return;
    let releases = DataStore._getRaw(DataStore.KEYS.UPCOMING_RELEASES) || [];
    const rel = releases.find(r => r.id === id);
    if (rel) DataStore.moveToTrash(rel, 'upcomingReleases');
    releases = releases.filter(r => r.id !== id);
    localStorage.setItem(DataStore.KEYS.UPCOMING_RELEASES, JSON.stringify(releases));
    loadUpcomingReleasesTable();
    showToast('Release moved to Trash', 'success');
    syncToLiveWebsite();
}

function toggleUpcomingRelease(id) {
    const releases = DataStore.getUpcomingReleases();
    const r = releases.find(x => x.id === id);
    if (r) {
        r.enabled = r.enabled === false ? true : false;
        r.updatedAt = new Date().toISOString();
        DataStore.setUpcomingReleases(releases);
        loadUpcomingReleasesTable();
        showToast(r.enabled ? 'Release enabled' : 'Release disabled', 'info');
        syncToLiveWebsite();
    }
}

function moveUpcomingRelease(id, dir) {
    const releases = DataStore.getUpcomingReleases();
    const sorted = releases.sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex(r => r.id === id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const tmp = sorted[idx].order;
    sorted[idx].order = sorted[swapIdx].order;
    sorted[swapIdx].order = tmp;
    DataStore.setUpcomingReleases(sorted);
    loadUpcomingReleasesTable();
    showToast('Order updated', 'info');
    syncToLiveWebsite();
}

// Image preview for Upcoming Releases modal
document.addEventListener('DOMContentLoaded', function() {
    const urImageFile = document.getElementById('urImageFile');
    if (urImageFile) {
        urImageFile.addEventListener('change', function() {
            const file = this.files[0];
            const preview = document.getElementById('urImagePreview');
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { preview.style.display = 'block'; preview.querySelector('img').src = e.target.result; };
                reader.readAsDataURL(file);
            } else {
                const url = document.getElementById('urImageUrl').value.trim();
                if (url) { preview.style.display = 'block'; preview.querySelector('img').src = url; }
                else { preview.style.display = 'none'; }
            }
        });
    }
});

// ============================================
// Songs Collections — Builder CRUD
// ============================================
function loadSongsCollectionsPage() {
    const data = DataStore.getSongsCollections();
    const songs = (DataStore.getSongs() || [])
        .filter(s => s && (s.status === 'published' || s.status === 'active'))
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    // Populate song select dropdowns
    ['scLeftSongSelect', 'scRightSongSelect'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">— Select a song —</option>' +
            songs.map(s => `<option value="${s.id}">${s.title || 'Untitled'}${s.artist ? ' — ' + s.artist : ''}</option>`).join('');
        sel.value = current;
    });

    // Render lists
    _scRenderList('scLeftList', data.left || [], songs, 'left');
    _scRenderList('scRightList', data.right || [], songs, 'right');

    // Update count labels
    const leftLen = (data.left || []).length;
    const rightLen = (data.right || []).length;
    const leftLabel = document.getElementById('scLeftCountLabel');
    const rightLabel = document.getElementById('scRightCountLabel');
    if (leftLabel) leftLabel.textContent = leftLen + ' / 10';
    if (rightLabel) rightLabel.textContent = rightLen + ' / 10';

    // Settings
    const settings = data.settings || {};
    document.getElementById('scSectionTitle').value = settings.title || 'Songs Collections';
    document.getElementById('scScrollSpeed').value = settings.scrollSpeed || 18;
    document.getElementById('scCardGap').value = settings.cardGap || 10;
    document.getElementById('scLeftCount').value = settings.leftCount || leftLen || 5;
    document.getElementById('scRightCount').value = settings.rightCount || rightLen || 5;
    document.getElementById('scSectionHeight').value = settings.sectionHeight || 420;
    document.getElementById('scVisible').checked = settings.visible !== false;
    document.getElementById('scSwapSides').checked = !!settings.swapSides;
}

function _scRenderList(containerId, items, allSongs, side) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items.length) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#666;font-size:13px;">No songs added yet.</div>';
        return;
    }
    container.innerHTML = items.map((ref, i) => {
        const song = (typeof ref === 'object') ? ref : allSongs.find(s => s.id === ref);
        if (!song) return '';
        const art = song.albumCover || song.thumbnail || song.artwork || '';
        return `<div class="sc-builder-item" data-side="${side}" data-idx="${i}" style="display:flex;align-items:center;gap:10px;padding:8px;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;">
            <div style="width:40px;height:40px;border-radius:6px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,0.08);">
                ${art ? `<img src="${art}" alt="" style="width:100%;height:100%;object-fit:cover;">` :
                '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;"><i class="fas fa-music"></i></div>'}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(song.title || 'Untitled').slice(0, 35)}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(song.artist || '').slice(0, 30)}</div>
            </div>
            <div style="display:flex;gap:4px;">
                <button class="builder-btn small" onclick="scMoveSong('${side}',${i},-1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                <button class="builder-btn small" onclick="scMoveSong('${side}',${i},1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>
                <button class="builder-btn small danger" onclick="scRemoveSong('${side}',${i})" title="Remove"><i class="fas fa-times"></i></button>
            </div>
        </div>`;
    }).join('');
}

function scAddSong(side) {
    const selId = side === 'left' ? 'scLeftSongSelect' : 'scRightSongSelect';
    const sel = document.getElementById(selId);
    if (!sel || !sel.value) { showToast('Select a song first', 'warning'); return; }
    const songId = sel.value;
    const data = DataStore.getSongsCollections();
    const list = data[side] || [];
    if (list.length >= 10) { showToast('Maximum 10 songs per column', 'warning'); return; }
    if (list.includes(songId)) { showToast('Song already in this column', 'warning'); return; }
    list.push(songId);
    data[side] = list;
    DataStore.setSongsCollections(data);
    sel.value = '';
    loadSongsCollectionsPage();
    showToast('Song added to ' + side + ' column', 'success');
    syncToLiveWebsite();
}

function scRemoveSong(side, idx) {
    const data = DataStore.getSongsCollections();
    const list = data[side] || [];
    list.splice(idx, 1);
    data[side] = list;
    DataStore.setSongsCollections(data);
    loadSongsCollectionsPage();
    showToast('Song removed', 'info');
    syncToLiveWebsite();
}

function scMoveSong(side, idx, dir) {
    const data = DataStore.getSongsCollections();
    const list = data[side] || [];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    data[side] = list;
    DataStore.setSongsCollections(data);
    loadSongsCollectionsPage();
    syncToLiveWebsite();
}

function saveSongsCollections() {
    const data = DataStore.getSongsCollections();
    data.settings = {
        title: (document.getElementById('scSectionTitle').value || 'Songs Collections').trim(),
        scrollSpeed: parseInt(document.getElementById('scScrollSpeed').value) || 18,
        cardGap: parseInt(document.getElementById('scCardGap').value) || 10,
        leftCount: parseInt(document.getElementById('scLeftCount').value) || 5,
        rightCount: parseInt(document.getElementById('scRightCount').value) || 5,
        sectionHeight: parseInt(document.getElementById('scSectionHeight').value) || 420,
        visible: document.getElementById('scVisible').checked,
        swapSides: document.getElementById('scSwapSides').checked,
    };
    DataStore.setSongsCollections(data);

    // Apply section height to CSS
    const section = document.getElementById('songsCollectionsSection');
    if (section) section.style.setProperty('--sc-section-height', data.settings.sectionHeight + 'px');

    showToast('Songs Collections settings saved', 'success');
    syncToLiveWebsite();
}

// Register in keysToSync and saveDraft
(function() {
    const origSync = window.syncToLiveWebsite;
    if (typeof origSync === 'function') {
        window.syncToLiveWebsite = function() {
            origSync.apply(this, arguments);
            try {
                const key = 'tamilAIStream_songsCollections';
                localStorage.setItem(key, localStorage.getItem(key) || 'null');
            } catch (e) {}
        };
    }
})();

// ═══════════════════════════════════════════════════════════════
//  STAGING & PRE-PUBLISH TESTS PAGE
// ═══════════════════════════════════════════════════════════════

let _stagingCheckResults = [];

async function loadStagingPage() {
    try {
        await refreshStagingData();
    } catch (e) {
        console.error('[Staging] Error loading staging page:', e);
    }
}

async function refreshStagingData() {
    const banner = document.getElementById('stagingBanner');
    const bannerIcon = document.getElementById('stagingBannerIcon');
    const bannerText = document.getElementById('stagingBannerText');

    // Fetch staging diff
    let diff = { hasChanges: false, changes: [], changeCount: 0 };
    try { diff = await PublishManager.getDiff(); } catch (e) {}

    // Fetch publish status
    let status = {};
    try { status = await PublishManager.refreshStatus(); } catch (e) {}

    // Update banner
    if (diff.hasChanges || status.hasStaging) {
        banner.style.background = 'rgba(59,130,246,0.12)';
        banner.style.border = '1px solid rgba(59,130,246,0.3)';
        banner.style.color = '#60a5fa';
        bannerIcon.className = 'fas fa-clock';
        bannerText.textContent = diff.changeCount + ' pending change(s) ready for review — ' + (status.stagingSavedAt ? new Date(status.stagingSavedAt).toLocaleString() : 'Unknown time');
    } else {
        banner.style.background = 'rgba(16,185,129,0.12)';
        banner.style.border = '1px solid rgba(16,185,129,0.3)';
        banner.style.color = '#34d399';
        bannerIcon.className = 'fas fa-check-circle';
        bannerText.textContent = 'No pending changes — website is up to date';
    }

    // Render changes list
    const changesList = document.getElementById('stagingChangesList');
    const changeCount = document.getElementById('stagingChangeCount');
    const changes = diff.changes || [];
    changeCount.textContent = changes.length + ' change(s)';

    if (changes.length === 0) {
        changesList.innerHTML = '<div style="text-align:center;padding:20px;color:#666;font-size:13px;"><i class="fas fa-check-circle" style="font-size:24px;color:#10b981;display:block;margin-bottom:8px;"></i>No pending changes</div>';
    } else {
        changesList.innerHTML = changes.map(c => {
            const colors = { added: '#10b981', modified: '#3b82f6', removed: '#ef4444', items_added: '#10b981', items_removed: '#ef4444', cleared: '#f59e0b' };
            const icons = { added: 'fa-plus-circle', modified: 'fa-pen', removed: 'fa-trash', items_added: 'fa-plus', items_removed: 'fa-minus', cleared: 'fa-eraser' };
            const action = c.action || 'modified';
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:4px;">' +
                '<i class="fas ' + (icons[action] || 'fa-circle') + '" style="color:' + (colors[action] || '#888') + ';width:16px;text-align:center;font-size:11px;"></i>' +
                '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:12px;font-weight:600;">' + (c.section || c.key || 'Unknown') + '</div>' +
                '<div style="font-size:10px;color:rgba(255,255,255,0.4);">' + action.replace(/_/g, ' ') + (c.changeCount ? ' (' + c.changeCount + ' items)' : '') + '</div>' +
                '</div>' +
                '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);">' + (c.section ? 'section' : 'data') + '</span>' +
                '</div>';
        }).join('');
    }

    // Render affected pages
    renderAffectedPages(changes);

    // Run checks automatically
    await runStagingChecks();
}

function renderAffectedPages(changes) {
    const container = document.getElementById('stagingAffectedPages');
    const sectionPages = {
        'songs': ['index.html (Home)', 'builder.html'],
        'stations': ['index.html (Home)'],
        'categories': ['index.html (Home)'],
        'featured': ['index.html (Home)'],
        'trending': ['index.html (Home)'],
        'artistHits': ['index.html (Home)'],
        'songsCollections': ['index.html (Home)'],
        'musicCollections': ['index.html (Home)'],
        'newAlbums': ['index.html (Home)'],
        'upcomingReleases': ['index.html (Home)'],
        'siteSettings': ['index.html (Global)'],
        'navigation': ['index.html (Top Nav)', 'index.html (Bottom Nav)'],
        'layout': ['index.html (All Sections)'],
        'moods': ['index.html (Home)'],
        'decades': ['index.html (Home)'],
        'aiRadio': ['index.html (Home)'],
        'advertisements': ['index.html (Ads)'],
        'notifications': ['index.html (Notifications)'],
        'splash': ['splash.html'],
        'playerPrefs': ['index.html (Player)'],
        'miniPlayerSettings': ['index.html (Mini Player)'],
        'images': ['All pages (Media)'],
    };

    const affected = new Set();
    changes.forEach(c => {
        const pages = sectionPages[c.section || c.key] || ['index.html'];
        pages.forEach(p => affected.add(p));
    });

    if (affected.size === 0) {
        container.innerHTML = '<div style="text-align:center;padding:16px;color:#666;font-size:13px;">No pages affected</div>';
        return;
    }

    container.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
        [...affected].map(p =>
            '<span style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:6px;font-size:11px;color:#60a5fa;">' +
            '<i class="fas fa-file" style="font-size:9px;"></i>' + p + '</span>'
        ).join('') + '</div>';
}

// ═══════════════════════════════════════════════════════════════
//  VALIDATION CHECKS ENGINE
// ═══════════════════════════════════════════════════════════════

async function runStagingChecks() {
    const btn = document.getElementById('btnRunChecks');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';

    _stagingCheckResults = [];
    const startTime = Date.now();

    // ── 1. Data Integrity Checks ──
    await _stagingCheck('Data integrity — Songs', 'Data integrity', () => {
        const songs = DataStore.getSongs();
        if (!Array.isArray(songs) || songs.length === 0) return { pass: false, msg: 'No songs found in DataStore', severity: 'error' };
        const missing = songs.filter(s => !s.id || !s.title);
        if (missing.length > 0) return { pass: false, msg: missing.length + ' song(s) missing id or title', severity: 'error' };
        return { pass: true, msg: songs.length + ' songs valid' };
    });

    await _stagingCheck('Data integrity — Stations', 'Data integrity', () => {
        const stations = DataStore.getStations();
        if (!Array.isArray(stations)) return { pass: false, msg: 'Stations data is not an array', severity: 'error' };
        const missing = stations.filter(s => !s.id || !s.name);
        if (missing.length > 0) return { pass: false, msg: missing.length + ' station(s) missing id or name', severity: 'error' };
        return { pass: true, msg: stations.length + ' stations valid' };
    });

    await _stagingCheck('Data integrity — Categories', 'Data integrity', () => {
        const cats = DataStore.getCategories();
        if (!Array.isArray(cats)) return { pass: false, msg: 'Categories data is not an array', severity: 'error' };
        return { pass: true, msg: cats.length + ' categories' };
    });

    await _stagingCheck('Data integrity — Featured/Trending', 'Data integrity', () => {
        const feat = DataStore.getFeatured();
        const trend = DataStore.getTrending();
        if (!Array.isArray(feat) || !Array.isArray(trend)) return { pass: false, msg: 'Featured or Trending data is invalid', severity: 'error' };
        return { pass: true, msg: 'Featured: ' + feat.length + ', Trending: ' + trend.length };
    });

    await _stagingCheck('Data integrity — Songs Collections', 'Data integrity', () => {
        const sc = DataStore.getSongsCollections();
        if (!sc || !Array.isArray(sc.left) || !Array.isArray(sc.right)) return { pass: false, msg: 'Songs Collections data structure invalid', severity: 'error' };
        return { pass: true, msg: 'Left: ' + sc.left.length + ', Right: ' + sc.right.length + ' songs' };
    });

    await _stagingCheck('Data integrity — Site Settings', 'Data integrity', () => {
        const ss = DataStore.getSiteSettings();
        if (!ss || typeof ss !== 'object') return { pass: false, msg: 'Site settings missing or invalid', severity: 'warning' };
        return { pass: true, msg: 'Site settings present' };
    });

    await _stagingCheck('Data integrity — Navigation', 'Data integrity', () => {
        const nav = DataStore.getNavigation();
        if (!nav || typeof nav !== 'object') return { pass: false, msg: 'Navigation data missing', severity: 'warning' };
        return { pass: true, msg: 'Navigation configured' };
    });

    // ── 2. Content Validation ──
    await _stagingCheck('Content — Duplicate song IDs', 'Content validation', () => {
        const songs = DataStore.getSongs() || [];
        const ids = songs.map(s => s.id).filter(Boolean);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (dupes.length > 0) return { pass: false, msg: dupes.length + ' duplicate song ID(s) found', severity: 'error' };
        return { pass: true, msg: 'No duplicate song IDs' };
    });

    await _stagingCheck('Content — Broken image URLs', 'Content validation', () => {
        const songs = DataStore.getSongs() || [];
        const broken = songs.filter(s => s.albumCover && !s.albumCover.startsWith('http') && !s.albumCover.startsWith('data:'));
        if (broken.length > 0) return { pass: false, msg: broken.length + ' song(s) with invalid image URLs', severity: 'warning' };
        return { pass: true, msg: 'All image URLs valid' };
    });

    await _stagingCheck('Content — Empty sections check', 'Content validation', () => {
        const featured = DataStore.getFeatured() || [];
        const trending = DataStore.getTrending() || [];
        const empty = [];
        if (featured.length === 0) empty.push('Featured');
        if (trending.length === 0) empty.push('Trending');
        if (empty.length > 0) return { pass: false, msg: 'Empty sections: ' + empty.join(', '), severity: 'warning' };
        return { pass: true, msg: 'All sections have content' };
    });

    // ── 3. Security Checks ──
    await _stagingCheck('Security — XSS scan', 'Security', () => {
        const songs = DataStore.getSongs() || [];
        const suspect = songs.filter(s => {
            const str = JSON.stringify(s);
            return /<script|javascript:|onerror=|onload=/i.test(str);
        });
        if (suspect.length > 0) return { pass: false, msg: suspect.length + ' song(s) contain suspicious HTML/script content', severity: 'error' };
        return { pass: true, msg: 'No XSS patterns detected' };
    });

    await _stagingCheck('Security — Malicious URLs', 'Security', () => {
        const songs = DataStore.getSongs() || [];
        const suspect = songs.filter(s => {
            const urls = [s.albumCover, s.thumbnail, s.audioUrl, s.streamingUrl].filter(Boolean);
            return urls.some(u => /javascript:|data:text\/html|\.exe|\.bat|\.php/i.test(u));
        });
        if (suspect.length > 0) return { pass: false, msg: suspect.length + ' song(s) with suspicious URLs', severity: 'error' };
        return { pass: true, msg: 'No malicious URLs detected' };
    });

    await _stagingCheck('Security — API key exposure', 'Security', () => {
        const settings = DataStore.getSiteSettings() || {};
        const str = JSON.stringify(settings);
        const keys = ['AIza', 'sk-', 'pk_', 'Bearer ', 'Authorization'];
        const exposed = keys.filter(k => str.includes(k));
        if (exposed.length > 0) return { pass: false, msg: 'Possible API key exposure in settings', severity: 'error' };
        return { pass: true, msg: 'No API keys exposed' };
    });

    await _stagingCheck('Security — Bot / spam detection', 'Security', () => {
        const songs = DataStore.getSongs() || [];
        const spamTitles = songs.filter(s => {
            const t = (s.title || '').toLowerCase();
            return t.includes('buy now') || t.includes('click here') || t.includes('free money') || t.includes('www.') && t.length < 5;
        });
        if (spamTitles.length > 0) return { pass: false, msg: spamTitles.length + ' song(s) flagged as potential spam', severity: 'warning' };
        return { pass: true, msg: 'No spam/bot content detected' };
    });

    // ── 4. Performance Checks ──
    await _stagingCheck('Performance — Total data size', 'Performance', () => {
        let totalSize = 0;
        const keys = ['songs', 'stations', 'categories', 'featured', 'trending', 'artistHits', 'quotes', 'siteSettings', 'layout', 'moods', 'aiRadio', 'navigation', 'sectionsOrder', 'miniPlayerSettings', 'songsCollections', 'newAlbums', 'upcomingReleases', 'advertisements'];
        keys.forEach(k => {
            try { totalSize += (localStorage.getItem('tamilAIStream_' + k) || '').length; } catch (e) {}
        });
        const kb = Math.round(totalSize / 1024);
        if (kb > 5120) return { pass: false, msg: 'Total data size: ' + kb + ' KB (exceeds 5 MB limit)', severity: 'error' };
        if (kb > 2048) return { pass: true, msg: 'Total data size: ' + kb + ' KB (large but OK)', severity: 'warning' };
        return { pass: true, msg: 'Total data size: ' + kb + ' KB' };
    });

    await _stagingCheck('Performance — Song count', 'Performance', () => {
        const songs = DataStore.getSongs() || [];
        if (songs.length > 500) return { pass: false, msg: songs.length + ' songs (may slow down mobile)', severity: 'warning' };
        return { pass: true, msg: songs.length + ' songs (good)' };
    });

    await _stagingCheck('Performance — Image optimization', 'Performance', () => {
        const songs = DataStore.getSongs() || [];
        const largeImages = songs.filter(s => {
            const url = s.albumCover || s.thumbnail || '';
            return url.includes('unsplash') || url.includes('original');
        });
        if (largeImages.length > 10) return { pass: false, msg: largeImages.length + ' songs using large unoptimized images', severity: 'warning' };
        return { pass: true, msg: 'Image optimization OK' };
    });

    // ── 5. Publish readiness ──
    await _stagingCheck('Publish — Staging manifest exists', 'Publish readiness', async () => {
        try {
            const st = await PublishManager.getState();
            if (!st.hasStaging) return { pass: false, msg: 'No staging manifest found — save changes first', severity: 'error' };
            return { pass: true, msg: 'Staging manifest ready' };
        } catch (e) {
            return { pass: false, msg: 'Cannot check staging status: ' + e.message, severity: 'error' };
        }
    });

    await _stagingCheck('Publish — API connectivity', 'Publish readiness', async () => {
        try {
            const resp = await fetch('/api/publish', { method: 'GET' });
            if (!resp.ok) return { pass: false, msg: 'API returned status ' + resp.status, severity: 'error' };
            return { pass: true, msg: 'API reachable' };
        } catch (e) {
            return { pass: false, msg: 'API unreachable: ' + e.message, severity: 'error' };
        }
    });

    // Calculate results
    const elapsed = Date.now() - startTime;
    const errors = _stagingCheckResults.filter(r => r.severity === 'error' && !r.pass);
    const warnings = _stagingCheckResults.filter(r => r.severity === 'warning' && !r.pass);
    const passed = _stagingCheckResults.filter(r => r.pass);
    const total = _stagingCheckResults.length;
    const score = total > 0 ? Math.round((passed.length / total) * 100) : 0;

    // Update score ring
    const arc = document.getElementById('stagingScoreArc');
    const num = document.getElementById('stagingScoreNum');
    const label = document.getElementById('stagingScoreLabel');
    const circumference = 326.7;
    arc.style.strokeDashoffset = circumference - (circumference * score / 100);
    arc.style.stroke = score === 100 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';
    num.textContent = score + '%';
    num.style.color = score === 100 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';

    if (score === 100) {
        label.textContent = 'All checks passed — Ready to publish!';
        label.style.color = '#10b981';
    } else if (errors.length > 0) {
        label.textContent = errors.length + ' error(s) must be fixed before publishing';
        label.style.color = '#ef4444';
    } else {
        label.textContent = warnings.length + ' warning(s) — publish allowed';
        label.style.color = '#f59e0b';
    }

    // Update counts
    document.getElementById('stagingCheckCount').textContent = passed.length + ' / ' + total + ' passed';
    document.getElementById('stagingErrorCount').textContent = errors.length + ' error' + (errors.length !== 1 ? 's' : '');
    document.getElementById('stagingWarningCount').textContent = warnings.length + ' warning' + (warnings.length !== 1 ? 's' : '');

    // Enable/disable publish button
    const publishBtn = document.getElementById('btnStagingPublish');
    const forceBtn = document.getElementById('btnForcePublish');
    const publishLabel = document.getElementById('stagingPublishLabel');
    const publishDesc = document.getElementById('stagingPublishDesc');

    if (errors.length === 0) {
        publishBtn.disabled = false;
        forceBtn.disabled = true;
        publishLabel.textContent = 'Ready to Publish';
        publishLabel.style.color = '#10b981';
        publishDesc.textContent = 'All critical checks passed (' + elapsed + 'ms)';
    } else {
        publishBtn.disabled = true;
        forceBtn.disabled = false;
        publishLabel.textContent = 'BLOCKED — ' + errors.length + ' error(s) found';
        publishLabel.style.color = '#ef4444';
        publishDesc.textContent = 'Fix all errors before publishing, or use Force Publish';
    }

    // Update security status
    const secChecks = _stagingCheckResults.filter(r => r.category === 'Security');
    const secPass = secChecks.filter(r => r.pass).length;
    document.getElementById('stagingSecurityStatus').textContent = secPass + ' / ' + secChecks.length + ' passed';
    document.getElementById('stagingSecurityStatus').style.color = secPass === secChecks.length ? '#10b981' : '#ef4444';

    // Update perf status
    const perfChecks = _stagingCheckResults.filter(r => r.category === 'Performance');
    const perfPass = perfChecks.filter(r => r.pass).length;
    document.getElementById('stagingPerfStatus').textContent = perfPass + ' / ' + perfChecks.length + ' passed';
    document.getElementById('stagingPerfStatus').style.color = perfPass === perfChecks.length ? '#10b981' : '#f59e0b';

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play-circle"></i> Run All Checks';
}

async function _stagingCheck(name, category, fn) {
    let result = { pass: true, msg: 'OK', severity: 'info' };
    try {
        const r = await fn();
        if (r) result = { ...result, ...r };
    } catch (e) {
        result = { pass: false, msg: 'Check failed: ' + e.message, severity: 'error' };
    }
    const entry = { name, category, ...result, time: new Date().toISOString() };
    _stagingCheckResults.push(entry);
    _renderStagingCheck(entry);
    return entry;
}

function _renderStagingCheck(entry) {
    // Update checks list
    const list = document.getElementById('stagingChecksList');
    if (list.querySelector('[style*="text-align:center"]')) list.innerHTML = '';

    const colors = { error: '#ef4444', warning: '#f59e0b', info: '#10b981' };
    const icons = { error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-check-circle' };
    const sev = entry.pass ? 'info' : (entry.severity || 'info');

    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;';
    el.innerHTML = '<i class="fas ' + (icons[sev] || 'fa-circle') + '" style="color:' + (colors[sev] || '#888') + ';width:14px;text-align:center;font-size:10px;"></i>' +
        '<div style="flex:1;min-width:0;">' +
        '<span style="font-weight:600;">' + entry.name + '</span>' +
        '<span style="color:rgba(255,255,255,0.4);margin-left:6px;">' + entry.msg + '</span>' +
        '</div>';
    list.appendChild(el);

    // Update security list
    if (entry.category === 'Security') {
        const secList = document.getElementById('stagingSecurityList');
        if (secList.querySelector('[style*="text-align:center"]')) secList.innerHTML = '';
        const secEl = el.cloneNode(true);
        secList.appendChild(secEl);
    }

    // Update perf list
    if (entry.category === 'Performance') {
        const perfList = document.getElementById('stagingPerfList');
        if (perfList.querySelector('[style*="text-align:center"]')) perfList.innerHTML = '';
        const perfEl = el.cloneNode(true);
        perfList.appendChild(perfEl);
    }

    // Update issues log
    if (!entry.pass) {
        const log = document.getElementById('stagingIssuesLog');
        if (log.querySelector('[style*="text-align:center"]')) log.innerHTML = '';
        const logEl = document.createElement('div');
        const logColor = entry.severity === 'error' ? '#ef4444' : '#f59e0b';
        logEl.style.cssText = 'padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.03);color:' + logColor + ';';
        logEl.textContent = '[' + entry.severity.toUpperCase() + '] ' + entry.name + ': ' + entry.msg;
        log.appendChild(logEl);
    }
}

// ═══════════════════════════════════════════════════════════════
//  PUBLISH FROM STAGING (verified only)
// ═══════════════════════════════════════════════════════════════

async function stagingPublish() {
    const errors = _stagingCheckResults.filter(r => r.severity === 'error' && !r.pass);
    if (errors.length > 0) {
        showToast('Cannot publish: ' + errors.length + ' error(s) must be fixed first', 'error');
        return;
    }

    if (!confirm('Publish verified staging content to the live website?')) return;

    const btn = document.getElementById('btnStagingPublish');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

    try {
        await PublishManager.saveToStaging();
        await PublishManager.publish();

        if ('caches' in window) {
            try {
                const names = await caches.keys();
                for (const name of names) await caches.delete(name);
            } catch (e) {}
        }

        localStorage.removeItem('tamilAIStream_lastSyncedAt');

        publishState = 'published';
        savePublishState();
        updatePublishUI();

        showToast('Published successfully! Live website updated.', 'success');
        addActivity('Staging Published', 'Verified staging content published to live');
        await refreshStagingData();
    } catch (e) {
        console.error('Staging publish error:', e);
        showToast('Publish failed: ' + e.message, 'error');
    }

    btn.innerHTML = '<i class="fas fa-rocket"></i> Publish to Live';
}

async function forcePublish() {
    const errors = _stagingCheckResults.filter(r => r.severity === 'error' && !r.pass);
    if (!confirm('WARNING: You are about to publish with ' + errors.length + ' unresolved error(s):\n\n' +
        errors.map(e => '- ' + e.name + ': ' + e.msg).join('\n') +
        '\n\nThis may cause issues on the live website. Continue?')) return;

    const btn = document.getElementById('btnForcePublish');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Force publishing...';

    try {
        await PublishManager.saveToStaging();
        await PublishManager.publish();

        if ('caches' in window) {
            try {
                const names = await caches.keys();
                for (const name of names) await caches.delete(name);
            } catch (e) {}
        }

        publishState = 'published';
        savePublishState();
        updatePublishUI();

        showToast('Force published! Check live website for issues.', 'success');
        addActivity('Force Published', 'Content published with ' + errors.length + ' unresolved error(s)');
        await refreshStagingData();
    } catch (e) {
        console.error('Force publish error:', e);
        showToast('Force publish failed: ' + e.message, 'error');
    }

    btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Force Publish';
}

// Global exports
window.loadStagingPage = loadStagingPage;
window.refreshStagingData = refreshStagingData;
window.runStagingChecks = runStagingChecks;
window.stagingPublish = stagingPublish;
window.forcePublish = forcePublish;

// Brand logo upload + preview
document.addEventListener('DOMContentLoaded', function() {
    const brandLogoFile = document.getElementById('brandLogoFile');
    if (brandLogoFile) {
        brandLogoFile.addEventListener('change', async function() {
            const file = this.files[0];
            if (!file) return;
            try {
                const result = await R2Uploader.uploadImage(file, 'tamil-ai-stream/brand', (pct) => {
                    console.log('Brand logo upload progress:', pct + '%');
                });
                if (result && result.url) {
                    document.getElementById('settingsBrandLogo').value = result.url;
                    const preview = document.getElementById('settingsBrandLogoPreview');
                    if (preview) { preview.style.display = 'block'; preview.querySelector('img').src = result.url; }
                    showToast('Logo uploaded! Click Save Brand to apply.', 'success');
                }
            } catch (err) {
                console.error('Brand logo upload failed:', err);
                showToast('Logo upload failed: ' + err.message, 'error');
            }
        });
    }
    const settingsBrandLogo = document.getElementById('settingsBrandLogo');
    if (settingsBrandLogo) {
        settingsBrandLogo.addEventListener('input', function() {
            const preview = document.getElementById('settingsBrandLogoPreview');
            if (preview) {
                if (this.value.trim()) { preview.style.display = 'block'; preview.querySelector('img').src = this.value.trim(); }
                else { preview.style.display = 'none'; }
            }
        });
    }
});

// ============================================
// Site Settings Management
// ============================================
function loadSettings() {
    const settings = DataStore.getSiteSettings();
    document.getElementById('settingsTitle').value = settings.title || '';
    document.getElementById('settingsDescription').value = settings.description || '';
    document.getElementById('settingsKeywords').value = settings.keywords || '';
    document.getElementById('settingsOgTitle').value = settings.ogTitle || '';
    document.getElementById('settingsOgUrl').value = settings.ogUrl || '';
    document.getElementById('settingsOgDescription').value = settings.ogDescription || '';
    document.getElementById('settingsThemeColor').value = settings.themeColor || '#000000';
    document.getElementById('settingsFooterText').value = settings.footerText || '';
    const brandLogoEl = document.getElementById('settingsBrandLogo');
    if (brandLogoEl) brandLogoEl.value = settings.logo || '';
    const faviconEl = document.getElementById('settingsFavicon');
    if (faviconEl) faviconEl.value = settings.favicon || '';
    const brandPreview = document.getElementById('settingsBrandLogoPreview');
    if (brandPreview) {
        if (settings.logo) { brandPreview.style.display = 'block'; brandPreview.querySelector('img').src = settings.logo; }
        else { brandPreview.style.display = 'none'; }
    }
}

function saveSettings(e) {
    e.preventDefault();
    const settings = {
        title: document.getElementById('settingsTitle').value.trim(),
        description: document.getElementById('settingsDescription').value.trim(),
        keywords: document.getElementById('settingsKeywords').value.trim(),
        ogTitle: document.getElementById('settingsOgTitle').value.trim(),
        ogUrl: document.getElementById('settingsOgUrl').value.trim(),
        ogDescription: document.getElementById('settingsOgDescription').value.trim(),
        themeColor: document.getElementById('settingsThemeColor').value,
        footerText: document.getElementById('settingsFooterText').value.trim()
    };
    const brandLogoEl = document.getElementById('settingsBrandLogo');
    const faviconEl = document.getElementById('settingsFavicon');
    if (brandLogoEl) settings.logo = brandLogoEl.value.trim();
    if (faviconEl) settings.favicon = faviconEl.value.trim();
    DataStore.setSiteSettings(settings);
    showToast('Settings saved!', 'success');
    syncToLiveWebsite();
    addActivity('Settings Updated', 'Site settings have been saved');
}

// ============================================
// Dashboard Stats
// ============================================
// Main Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // ============================================
    // ADMIN-ONLY ACCESS GUARD
    // Builder is restricted to admin users only.
    // Non-admin users are redirected to the main site.
    // ============================================
    const ADMIN_EMAILS = ['admin@tamilaistream.com'];

    setupLoginScreen();
    
    const user = await checkAuth();
    
    if (user) {
        // Verify the user is actually an admin
        const email = (user.email || user.username || '').toLowerCase();
        const isAdmin = ADMIN_EMAILS.includes(email) || email.startsWith('admin');
        if (!isAdmin) {
            showToast('Access denied. Admins only.', 'error');
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            return;
        }
        showBuilderDashboard(user);
    } else {
        showLoginScreen();
    }

    const mobileToggle = document.getElementById('builderMobileToggle');
    const sidebar = document.querySelector('.builder-sidebar');
    const sidebarOverlay = document.getElementById('builderSidebarOverlay');
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('active', sidebar.classList.contains('mobile-open'));
            const icon = mobileToggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
                const icon = mobileToggle.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            });
        }
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && e.target !== mobileToggle && !mobileToggle.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
                const icon = mobileToggle.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        });
        sidebar.querySelectorAll('.builder-sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
                const icon = mobileToggle.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            });
        });
    }
});

// ============================================
// Visual Editor ï¿½ Comprehensive Implementation
// ============================================
let veInitialized = false;
let veIframe = null;
let veIframeDoc = null;
let veSelectedElement = null;
let veSelectedSelector = '';
let veCurrentDevice = 'desktop';
let veZoom = 100;
let veUndoStack = [];
let veRedoStack = [];
let veMaxHistory = 50;
let veOverrides = {};
let veCurrentBreakpoint = 'desktop';
let veAllElements = [];
let veVisibleElements = [];
let veTreeSearchTerm = '';
let veHistoryEntries = [];
let veIsDragging = false;
let veDragStartX = 0;
let veDragStartY = 0;
let veDragOrigX = 0;
let veDragOrigY = 0;
let veResizing = false;
let veResizeHandle = '';
let veResizeStartX = 0;
let veResizeStartY = 0;
let veResizeOrigRect = null;
let veGridEnabled = false;
let veGuidesEnabled = true;
let veSnapThreshold = 5;
let veElementCount = 0;
let veEditMode = true; // true = edit mode, false = preview mode

function initVisualEditor() {
    if (veInitialized) {
        if (veIframe && veIframeDoc) scanIframeElements();
        return;
    }
    veInitialized = true;

    veIframe = document.getElementById('veFrame');
    if (!veIframe) return;

    veIframe.addEventListener('load', onVEIframeLoad);

    if (veIframe.contentDocument && veIframe.contentDocument.body) {
        onVEIframeLoad();
    } else {
        setTimeout(onVEIframeLoad, 1000);
    }

    // Mode toggle buttons
    document.querySelectorAll('.ve-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ve-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.veMode;
            setVEEditMode(mode === 'edit');
        });
    });

    // Listen for messages from the iframe
    window.addEventListener('message', handleVEIframeMessage);

    bindVisualEditorEvents();
    loadVEDraft();
    if (typeof initV2Enhancements === 'function') initV2Enhancements();
}

function handleVEIframeMessage(e) {
    const msg = e.data;
    if (!msg || !msg.type) return;
    switch (msg.type) {
        case 've-edit-mode-ready':
            console.log('[VE] Edit mode script injected successfully');
            break;
        case 've-element-selected':
            handleVEElementSelected(msg);
            break;
        case 've-selection-cleared':
            clearVESelection();
            break;
    }
}

function handleVEElementSelected(msg) {
    // Find the element in the iframe by building a selector
    const tag = msg.tag;
    const id = msg.id;
    const className = msg.className;

    let selector = tag;
    if (id) selector = '#' + id;
    else if (className && typeof className === 'string') {
        const firstClass = className.split(' ')[0];
        if (firstClass) selector = tag + '.' + firstClass;
    }

    // Try to find the element
    try {
        const el = veIframeDoc.querySelector(selector);
        if (el) {
            veSelectedElement = el;
            veSelectedSelector = selector;
            updateVEOverlay();
            showVEProperties(el);
            updateVEElementTree();
            document.getElementById('veStatusElement').textContent = tag + (id ? '#' + id : '') + (className ? '.' + (className.split(' ')[0] || '') : '');
        }
    } catch (err) {}
}

function setVEEditMode(editMode) {
    veEditMode = editMode;
    if (!veIframe) return;
    try {
        veIframe.contentWindow.postMessage({
            type: 've-set-edit-mode',
            editMode: editMode
        }, '*');
    } catch (err) {}

    if (!editMode) {
        // Preview mode: clear selection, restore cursor
        clearVESelection();
        if (veIframeDoc && veIframeDoc.body) {
            veIframeDoc.body.style.cursor = '';
        }
        document.getElementById('veStatusElement').textContent = 'Preview mode â€” website interactions active';
    } else {
        // Edit mode: set crosshair cursor
        if (veIframeDoc && veIframeDoc.body) {
            veIframeDoc.body.style.cursor = 'crosshair';
        }
        document.getElementById('veStatusElement').textContent = 'Edit mode â€” click elements to select and edit';
    }
}

function onVEIframeLoad() {
    try {
        veIframeDoc = veIframe.contentDocument || veIframe.contentWindow?.document;
        if (!veIframeDoc || !veIframeDoc.body) {
            setTimeout(onVEIframeLoad, 500);
            return;
        }
        // Inject edit mode script into the iframe
        injectVEEditModeScript();
        scanIframeElements();
        setupIframeInteraction();
        addVEHistoryEntry('Page loaded');
    } catch (err) {
        console.warn('[VE] iframe access error, retrying:', err);
        setTimeout(onVEIframeLoad, 1000);
    }
}

function injectVEEditModeScript() {
    if (!veIframeDoc) return;
    try {
        // Check if already injected
        if (veIframeDoc.querySelector('script[data-ve-edit-mode]')) return;
        const script = veIframeDoc.createElement('script');
        script.src = 've-edit-mode.js';
        script.setAttribute('data-ve-edit-mode', 'true');
        veIframeDoc.head.appendChild(script);
    } catch (err) {
        console.warn('[VE] Could not inject edit mode script:', err);
    }
}

function bindVisualEditorEvents() {
    document.querySelectorAll('.ve-device-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ve-device-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setVEDevice(btn.dataset.veDevice);
        });
    });

    document.getElementById('veZoomIn')?.addEventListener('click', () => setVEZoom(veZoom + 10));
    document.getElementById('veZoomOut')?.addEventListener('click', () => setVEZoom(veZoom - 10));
    document.getElementById('veZoomFit')?.addEventListener('click', () => setVEZoom(100));
    document.getElementById('veToggleGrid')?.addEventListener('click', toggleVEGrid);
    document.getElementById('veToggleGuides')?.addEventListener('click', toggleVEGuides);
    document.getElementById('veUndoBtn')?.addEventListener('click', veUndo);
    document.getElementById('veRedoBtn')?.addEventListener('click', veRedo);
    document.getElementById('veSaveDraft')?.addEventListener('click', saveVEDraft);
    document.getElementById('vePublishBtn')?.addEventListener('click', publishVEChanges);
    document.getElementById('veCloseProps')?.addEventListener('click', clearVESelection);

    // Panel Undo/Redo/Save buttons (Layers tab)
    document.getElementById('vePanelUndo')?.addEventListener('click', veUndo);
    document.getElementById('vePanelRedo')?.addEventListener('click', veRedo);
    document.getElementById('vePanelSave')?.addEventListener('click', saveVEDraft);
    // Panel Undo/Redo/Save buttons (Components tab)
    document.getElementById('vePanelUndo2')?.addEventListener('click', veUndo);
    document.getElementById('vePanelRedo2')?.addEventListener('click', veRedo);
    document.getElementById('vePanelSave2')?.addEventListener('click', saveVEDraft);
    document.getElementById('vePanelSave2')?.addEventListener('click', saveVEDraft);

    document.querySelectorAll('.ve-panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.veLtab;
            tab.parentElement.querySelectorAll('.ve-panel-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.ve-panel-content').forEach(c => c.style.display = 'none');
            if (tabId === 'layers') document.getElementById('veLayersTab').style.display = '';
            else if (tabId === 'components') document.getElementById('veComponentsTab').style.display = '';
            else if (tabId === 'history') document.getElementById('veHistoryTab').style.display = '';
        });
    });

    document.querySelectorAll('.ve-resp-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ve-resp-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            veCurrentBreakpoint = tab.dataset.veResp;
            if (veSelectedElement) showVEProperties(veSelectedSelector);
        });
    });

    document.getElementById('veLayerSearch')?.addEventListener('input', (e) => {
        veTreeSearchTerm = e.target.value.toLowerCase();
        renderVEElementTree();
    });

    document.getElementById('veExpandAll')?.addEventListener('click', () => {
        document.querySelectorAll('.ve-tree-node.collapsed').forEach(n => n.classList.remove('collapsed'));
    });
    document.getElementById('veCollapseAll')?.addEventListener('click', () => {
        document.querySelectorAll('.ve-tree-node').forEach(n => n.classList.add('collapsed'));
    });

    document.getElementById('veActDuplicate')?.addEventListener('click', veDuplicateElement);
    document.getElementById('veActDelete')?.addEventListener('click', veDeleteElement);
    document.getElementById('veActHide')?.addEventListener('click', veToggleHide);
    document.getElementById('veActLock')?.addEventListener('click', veToggleLock);
    document.getElementById('veActMoveUp')?.addEventListener('click', () => veMoveElement('up'));
    document.getElementById('veActMoveDown')?.addEventListener('click', () => veMoveElement('down'));
    document.getElementById('veActWrap')?.addEventListener('click', veWrapInContainer);
    document.getElementById('veActEditHTML')?.addEventListener('click', veEditHTML);

    setupComponentDrag();

    document.addEventListener('keydown', (e) => {
        const vePage = document.getElementById('visualeditorPage');
        if (!vePage || vePage.style.display === 'none') return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); veUndo(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); veRedo(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveVEDraft(); }
        if (e.key === 'Escape') clearVESelection();
        if (e.key === 'Delete' && veSelectedElement && !e.target.matches('input, textarea, select')) { e.preventDefault(); veDeleteElement(); }
        if (e.key === 'd' && (e.ctrlKey || e.metaKey) && veSelectedElement) { e.preventDefault(); veDuplicateElement(); }
    });
}

// --- Device / Zoom ---
function setVEDevice(device) {
    veCurrentDevice = device;
    const wrapper = document.getElementById('veCanvasWrapper');
    const label = document.getElementById('veDeviceLabel');
    if (!wrapper) return;
    const widths = { desktop: '100%', tablet: '768px', mobile: '375px' };
    const labels = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
    veIframe.style.width = widths[device] || '100%';
    veIframe.style.maxWidth = '100%';
    wrapper.style.justifyContent = device === 'desktop' ? 'stretch' : 'center';
    if (label) label.textContent = labels[device] || device;

    // Reload iframe to ensure fresh content rendered for the selected device viewport
    const currentSrc = veIframe.src;
    veIframe.src = 'about:blank';
    setTimeout(() => {
        veIframe.src = currentSrc;
    }, 100);

    updateVEStatusBar();
}

function setVEZoom(level) {
    veZoom = Math.max(25, Math.min(200, level));
    const label = document.getElementById('veZoomLabel');
    if (label) label.textContent = veZoom + '%';
    veIframe.style.transform = `scale(${veZoom / 100})`;
    veIframe.style.transformOrigin = 'top center';
    updateVEOverlay();
}

function toggleVEGrid() {
    veGridEnabled = !veGridEnabled;
    const grid = document.getElementById('veSnapGrid');
    const btn = document.getElementById('veToggleGrid');
    if (grid) grid.style.display = veGridEnabled ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', veGridEnabled);
}

function toggleVEGuides() {
    veGuidesEnabled = !veGuidesEnabled;
    const btn = document.getElementById('veToggleGuides');
    if (btn) btn.classList.toggle('active', veGuidesEnabled);
}

// --- Element scanning ---
function scanIframeElements() {
    if (!veIframeDoc || !veIframeDoc.body) return;
    veAllElements = [];
    veElementCount = 0;

    const SKIP_SELF = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE']);
    const SKIP_IDS = new Set(['splashOverlay', 'eqOverlay', 'mapMiniPlayer']);

    const walker = (node, depth, parentPath) => {
        if (node.nodeType !== 1) return;
        const el = node;
        if (SKIP_SELF.has(el.tagName)) return;
        if (el.id && SKIP_IDS.has(el.id)) return;
        if (el.classList?.contains('toast-container') || el.classList?.contains('splash-screen')) return;

        const path = parentPath ? parentPath + ' > ' + getVEShortSelector(el) : getVEShortSelector(el);
        const tag = el.tagName.toLowerCase();
        const id = el.id || '';
        const cls = (typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '');
        const hasChildren = el.children.length > 0;
        const hidden = el.style.display === 'none' || el.hidden;
        const locked = el.dataset.veLocked === 'true';

        veAllElements.push({ el, tag, id, cls, depth, path, hasChildren, hidden, locked });
        veElementCount++;

        for (const child of el.children) {
            walker(child, depth + 1, path);
        }
    };

    for (const child of veIframeDoc.body.children) {
        walker(child, 0, '');
    }

    renderVEElementTree();
    renderVESections();
    updateVEStatusBar();
}

function getVEShortSelector(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string') {
        s += '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    }
    return s;
}

function getVEUniqueSelector(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    let current = el;
    while (current && current !== veIframeDoc.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) { selector = '#' + current.id; parts.unshift(selector); break; }
        if (current.className && typeof current.className === 'string') {
            const cls = current.className.trim().split(/\s+/).slice(0, 2).map(c => '.' + c).join('');
            selector += cls;
        }
        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
            if (siblings.length > 1) {
                const idx = siblings.indexOf(current) + 1;
                selector += ':nth-of-type(' + idx + ')';
            }
        }
        parts.unshift(selector);
        current = current.parentElement;
    }
    return parts.join(' > ');
}

// --- Layers tree ---
function renderVEElementTree() {
    const tree = document.getElementById('veElementTree');
    if (!tree) return;

    let html = '';
    let visibleIdx = 0;
    veVisibleElements = [];

    for (const item of veAllElements) {
        const matchSearch = !veTreeSearchTerm ||
            item.tag.includes(veTreeSearchTerm) ||
            item.id.toLowerCase().includes(veTreeSearchTerm) ||
            item.cls.toLowerCase().includes(veTreeSearchTerm) ||
            item.path.toLowerCase().includes(veTreeSearchTerm);

        if (!matchSearch && veTreeSearchTerm) continue;

        veVisibleElements.push(item);
        const isSelected = veSelectedElement === item.el;
        const indent = Math.min(item.depth, 8) * 14;

        html += `<div class="ve-tree-item${isSelected ? ' selected' : ''}${item.hidden ? ' ve-hidden-el' : ''}${item.locked ? ' ve-locked-el' : ''}"
            style="padding-left:${indent + 8}px" data-ve-tree-idx="${visibleIdx}" title="${item.path}">
            <span class="ve-tree-icon"><i class="fas ${veGetTagIcon(item.tag)}"></i></span>
            <span class="ve-tree-tag">&lt;${item.tag}&gt;</span>
            ${item.id ? '<span class="ve-tree-id">#' + item.id + '</span>' : ''}
            ${item.cls ? '<span class="ve-tree-cls">.' + item.cls + '</span>' : ''}
            ${item.hidden ? '<i class="fas fa-eye-slash" style="opacity:0.4;margin-left:auto"></i>' : ''}
            ${item.locked ? '<i class="fas fa-lock" style="opacity:0.4;margin-left:2px"></i>' : ''}
        </div>`;
        visibleIdx++;
    }

    tree.innerHTML = html || '<div class="ve-empty-hint"><i class="fas fa-search"></i><p>No elements found</p></div>';

    // Event delegation for tree item clicks
    tree.onclick = (e) => {
        const item = e.target.closest('.ve-tree-item');
        if (!item) return;
        const idx = parseInt(item.dataset.veTreeIdx, 10);
        if (!isNaN(idx) && veVisibleElements[idx]) {
            selectVEElement(veVisibleElements[idx].el);
        }
    };
}

function veGetTagIcon(tag) {
    const icons = {
        header: 'fa-heading', nav: 'fa-bars', main: 'fa-desktop', section: 'fa-square',
        div: 'fa-table-cells', footer: 'fa-shoe-prints',
        h1: 'fa-heading', h2: 'fa-heading', h3: 'fa-heading', h4: 'fa-heading', h5: 'fa-heading', h6: 'fa-heading',
        p: 'fa-paragraph', a: 'fa-link', button: 'fa-button-pointer', img: 'fa-image',
        video: 'fa-video', audio: 'fa-music', form: 'fa-form', input: 'fa-i-cursor',
        ul: 'fa-list', ol: 'fa-list-ol', li: 'fa-list-item', table: 'fa-table',
        canvas: 'fa-paint-roller', svg: 'fa-bezier-curve', i: 'fa-icons', span: 'fa-font',
        label: 'fa-tag', select: 'fa-caret-down', option: 'fa-caret-down',
        textarea: 'fa-i-cursor', iframe: 'fa-window-maximize', picture: 'fa-image',
        source: 'fa-link', strong: 'fa-bold', em: 'fa-italic', br: 'fa-corner-down-left'
    };
    return icons[tag] || 'fa-code';
}

function renderVESections() {
    if (!veIframeDoc) return;

    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);

    const buildItem = (el, i) => {
        const label = el.getAttribute('data-section') || el.id || el.className?.split(' ')[0] || el.tagName.toLowerCase() + ' ' + (i + 1);
        const tag = el.tagName.toLowerCase();
        const isHidden = el.style.display === 'none' || el.hidden;
        const isSelected = veSelectedElement === el;
        return { el, label, tag, isHidden, isSelected, idx: i };
    };

    // 1. Components tab
    const compList = document.getElementById('veSectionsComponentList');
    if (compList) {
        if (meaningful.length === 0) {
            compList.innerHTML = '<div class="ve-empty-hint"><i class="fas fa-layer-group"></i><p>No sections found</p></div>';
        } else {
            compList.innerHTML = meaningful.map((el, i) => {
                const s = buildItem(el, i);
                const icon = veGetSectionIcon(s.label);
                return `<div class="ve-section-comp-item${s.isSelected ? ' selected' : ''}${s.isHidden ? ' ve-hidden-section' : ''}" data-ve-sec-idx="${s.idx}">
                    <i class="${icon} ve-section-comp-icon"></i>
                    <span class="ve-section-comp-label">${s.label}</span>
                    <span class="ve-section-comp-tag">&lt;${s.tag}&gt;</span>
                    <div class="ve-section-comp-actions">
                        <button class="ve-sec-act-btn" title="Toggle Visibility" data-action="toggle-vis" data-idx="${s.idx}"><i class="fas ${s.isHidden ? 'fa-eye-slash' : 'fa-eye'} ve-sec-vis-icon"></i></button>
                        <button class="ve-sec-act-btn" title="Duplicate" data-action="duplicate" data-idx="${s.idx}"><i class="fas fa-copy"></i></button>
                        <button class="ve-sec-act-btn" title="Move Up" data-action="move-up" data-idx="${s.idx}"><i class="fas fa-arrow-up"></i></button>
                        <button class="ve-sec-act-btn" title="Move Down" data-action="move-down" data-idx="${s.idx}"><i class="fas fa-arrow-down"></i></button>
                        <button class="ve-sec-act-btn" title="Edit HTML" data-action="edit-html" data-idx="${s.idx}"><i class="fas fa-code"></i></button>
                        <button class="ve-sec-act-btn ve-sec-delete" title="Delete" data-action="delete" data-idx="${s.idx}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
            }).join('');
        }
        compList.onclick = (e) => {
            const btn = e.target.closest('.ve-sec-act-btn');
            if (btn) { e.stopPropagation(); handleSectionAction(btn.dataset.action, parseInt(btn.dataset.idx, 10)); return; }
            const item = e.target.closest('.ve-section-comp-item');
            if (item) veSelectSection(parseInt(item.dataset.veSecIdx, 10));
        };
    }

    // 2. Sections Order panel
    const orderList = document.getElementById('veSectionsList');
    if (orderList) {
        if (meaningful.length === 0) {
            orderList.innerHTML = '<div class="ve-empty-hint"><p>No sections</p></div>';
        } else {
            orderList.innerHTML = meaningful.map((el, i) => {
                const s = buildItem(el, i);
                return `<div class="ve-section-order-item${s.isSelected ? ' selected' : ''}${s.isHidden ? ' ve-hidden-section' : ''}" data-ve-sec-idx="${s.idx}">
                    <span class="ve-section-order-num">#${i + 1}</span>
                    <span class="ve-section-order-label">${s.label}</span>
                    <div class="ve-section-order-actions">
                        <button class="ve-sec-act-btn" title="Toggle Visibility" data-action="toggle-vis" data-idx="${s.idx}"><i class="fas ${s.isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                        <button class="ve-sec-act-btn" title="Move Up" data-action="move-up" data-idx="${s.idx}"><i class="fas fa-arrow-up"></i></button>
                        <button class="ve-sec-act-btn" title="Move Down" data-action="move-down" data-idx="${s.idx}"><i class="fas fa-arrow-down"></i></button>
                    </div>
                </div>`;
            }).join('');
        }
        orderList.onclick = (e) => {
            const btn = e.target.closest('.ve-sec-act-btn');
            if (btn) { e.stopPropagation(); handleSectionAction(btn.dataset.action, parseInt(btn.dataset.idx, 10)); return; }
            const item = e.target.closest('.ve-section-order-item');
            if (item) veSelectSection(parseInt(item.dataset.veSecIdx, 10));
        };
    }
}

function handleSectionAction(action, idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    switch (action) {
        case 'toggle-vis': veToggleSectionVisibility(idx); break;
        case 'duplicate': veDuplicateSection(idx); break;
        case 'move-up': veMoveSection(idx, 'up'); break;
        case 'move-down': veMoveSection(idx, 'down'); break;
        case 'edit-html': selectVEElement(el); veEditHTML(); break;
        case 'delete': veDeleteSection(idx); break;
    }
}

function veGetSectionIcon(label) {
    const l = label.toLowerCase();
    if (l.includes('header') || l.includes('nav') || l.includes('top')) return 'fas fa-bars';
    if (l.includes('hero') || l.includes('banner') || l.includes('splash')) return 'fas fa-star';
    if (l.includes('station') || l.includes('fm') || l.includes('radio')) return 'fas fa-broadcast-tower';
    if (l.includes('song') || l.includes('music') || l.includes('track')) return 'fas fa-music';
    if (l.includes('artist') || l.includes('singer')) return 'fas fa-user';
    if (l.includes('chart') || l.includes('top') || l.includes('trending')) return 'fas fa-ranking-star';
    if (l.includes('featured') || l.includes('curated') || l.includes('made')) return 'fas fa-sparkles';
    if (l.includes('new') || l.includes('release') || l.includes('recent')) return 'fas fa-clock-rotate-left';
    if (l.includes('search') || l.includes('filter')) return 'fas fa-search';
    if (l.includes('player') || l.includes('mini')) return 'fas fa-headphones';
    if (l.includes('footer')) return 'fas fa-shoe-prints';
    if (l.includes('ticker') || l.includes('marquee')) return 'fas fa-scroll';
    if (l.includes('category') || l.includes('genre') || l.includes('mood')) return 'fas fa-grip';
    if (l.includes('ai') || l.includes('assist')) return 'fas fa-robot';
    return 'fas fa-layer-group';
}

function veSelectTreeItem(idx) {
    const item = veVisibleElements[idx];
    if (!item) return;
    selectVEElement(item.el);
}

function veSelectSection(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    if (meaningful[idx]) { selectVEElement(meaningful[idx]); renderVESections(); }
}

function veToggleSectionVisibility(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    pushVEUndo('Toggle section visibility');
    const isHidden = el.style.display === 'none' || el.hidden;
    el.style.display = isHidden ? '' : 'none';
    addVEHistoryEntry((isHidden ? 'Showed ' : 'Hidden ') + (el.getAttribute('data-section') || el.id || 'section'));
    scanIframeElements();
}

function veDuplicateSection(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    pushVEUndo('Duplicate section');
    const clone = el.cloneNode(true);
    clone.removeAttribute('id');
    el.parentElement.insertBefore(clone, el.nextSibling);
    addVEHistoryEntry('Duplicated ' + (el.getAttribute('data-section') || el.id || 'section'));
    scanIframeElements();
    selectVEElement(clone);
}

function veMoveSection(idx, dir) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el || !el.parentElement) return;
    pushVEUndo('Move section ' + dir);
    if (dir === 'up' && el.previousElementSibling) el.parentElement.insertBefore(el, el.previousElementSibling);
    else if (dir === 'down' && el.nextElementSibling) el.parentElement.insertBefore(el.nextElementSibling, el);
    addVEHistoryEntry('Moved section ' + dir);
    scanIframeElements();
}

function veEditSectionHTML(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    selectVEElement(el);
    veEditHTML();
}

function veDeleteSection(idx) {
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const el = meaningful[idx];
    if (!el) return;
    const label = el.getAttribute('data-section') || el.id || 'section';
    if (!confirm('Delete section "' + label + '"? This can be undone with Ctrl+Z.')) return;
    pushVEUndo('Delete section');
    el.remove();
    addVEHistoryEntry('Deleted section: ' + label);
    scanIframeElements();
    clearVESelection();
}

// --- Iframe interaction ---
function setupIframeInteraction() {
    if (!veIframeDoc) return;

    // Click selection is handled by ve-edit-mode.js inside the iframe
    // via postMessage. We only need drag/resize handlers here.

    veIframeDoc.addEventListener('mousedown', (e) => {
        if (!veSelectedElement || e.target !== veSelectedElement) return;
        const rect = veSelectedElement.getBoundingClientRect();
        const handles = { 'n': 'top', 's': 'bottom', 'e': 'right', 'w': 'left',
            'ne': 'top-right', 'nw': 'top-left', 'se': 'bottom-right', 'sw': 'bottom-left' };
        const targetClass = e.target?.className || '';
        let matchedHandle = null;
        for (const h of Object.keys(handles)) { if (targetClass.includes(' ' + h) || targetClass === h) { matchedHandle = h; break; } }
        if (matchedHandle) {
            veResizing = true;
            veResizeHandle = handles[matchedHandle];
            veResizeStartX = e.clientX;
            veResizeStartY = e.clientY;
            veResizeOrigRect = rect;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        veIsDragging = true;
        veDragStartX = e.clientX;
        veDragStartY = e.clientY;
        veDragOrigX = parseFloat(veSelectedElement.style.left) || 0;
        veDragOrigY = parseFloat(veSelectedElement.style.top) || 0;
        veSelectedElement.style.position = veSelectedElement.style.position || 'relative';
        e.preventDefault();
        e.stopPropagation();
    });

    veIframeDoc.addEventListener('mousemove', (e) => {
        if (veIsDragging && veSelectedElement) {
            const dx = (e.clientX - veDragStartX) / (veZoom / 100);
            const dy = (e.clientY - veDragStartY) / (veZoom / 100);
            const newX = Math.round(veDragOrigX + dx);
            const newY = Math.round(veDragOrigY + dy);
            veSelectedElement.style.left = newX + 'px';
            veSelectedElement.style.top = newY + 'px';
            updateVEOverlay();
            if (veGuidesEnabled) showVESnapGuides(veSelectedElement);
        }
        if (veResizing && veSelectedElement) {
            const dx = (e.clientX - veResizeStartX) / (veZoom / 100);
            const dy = (e.clientY - veResizeStartY) / (veZoom / 100);
            veApplyResize(veResizeHandle, dx, dy);
            updateVEOverlay();
        }
    });

    veIframeDoc.addEventListener('mouseup', () => {
        if (veIsDragging) {
            veIsDragging = false;
            hideVESnapGuides();
            if (veSelectedSelector) {
                const bp = veCurrentBreakpoint;
                if (!veOverrides[veSelectedSelector]) veOverrides[veSelectedSelector] = {};
                if (!veOverrides[veSelectedSelector][bp]) veOverrides[veSelectedSelector][bp] = {};
                veOverrides[veSelectedSelector][bp].left = veSelectedElement.style.left;
                veOverrides[veSelectedSelector][bp].top = veSelectedElement.style.top;
            }
        }
        if (veResizing) {
            veResizing = false;
            if (veSelectedSelector) {
                const bp = veCurrentBreakpoint;
                if (!veOverrides[veSelectedSelector]) veOverrides[veSelectedSelector] = {};
                if (!veOverrides[veSelectedSelector][bp]) veOverrides[veSelectedSelector][bp] = {};
                veOverrides[veSelectedSelector][bp].width = veSelectedElement.style.width;
                veOverrides[veSelectedSelector][bp].height = veSelectedElement.style.height;
            }
        }
    });
}

function veApplyResize(handle, dx, dy) {
    if (!veSelectedElement || !veResizeOrigRect) return;
    const el = veSelectedElement;
    const orig = veResizeOrigRect;
    const w = orig.width;
    const h = orig.height;

    if (handle.includes('right')) el.style.width = Math.max(20, Math.round(w + dx)) + 'px';
    if (handle.includes('left')) { el.style.width = Math.max(20, Math.round(w - dx)) + 'px'; el.style.left = Math.round(veDragOrigX + dx) + 'px'; }
    if (handle.includes('bottom')) el.style.height = Math.max(20, Math.round(h + dy)) + 'px';
    if (handle.includes('top')) { el.style.height = Math.max(20, Math.round(h - dy)) + 'px'; el.style.top = Math.round(veDragOrigY + dy) + 'px'; }
}

function showVESnapGuides(el) {
    if (!el || !veIframeDoc) return;
    const rect = el.getBoundingClientRect();
    const iframeRect = veIframe.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - iframeRect.left;
    const cy = rect.top + rect.height / 2 - iframeRect.top;
    const guideH = document.getElementById('veGuideH');
    const guideV = document.getElementById('veGuideV');
    const iframeW = iframeRect.width;

    if (guideV && Math.abs(cx - iframeW / 2) < veSnapThreshold) {
        guideV.style.display = 'block';
        guideV.style.left = (iframeW / 2) + 'px';
    } else if (guideV) guideV.style.display = 'none';

    if (guideH && Math.abs(cy - 30) < veSnapThreshold) {
        guideH.style.display = 'block';
        guideH.style.top = '30px';
    } else if (guideH) guideH.style.display = 'none';
}

function hideVESnapGuides() {
    document.getElementById('veGuideH').style.display = 'none';
    document.getElementById('veGuideV').style.display = 'none';
}

// --- Selection ---
function selectVEElement(el) {
    clearVEOverlay();
    veSelectedElement = el;
    veSelectedSelector = getVEUniqueSelector(el);
    updateVEOverlay();
    showVEProperties(veSelectedSelector);
    updateVEActionsBar(true);
    highlightVETreeItem();
    renderVESections();
    updateVEStatusBar();
}

function updateVEOverlay() {
    if (!veSelectedElement || !veIframe) return;
    const rect = veSelectedElement.getBoundingClientRect();
    const iframeRect = veIframe.getBoundingClientRect();
    const overlay = document.getElementById('veOverlay');
    if (!overlay) return;

    overlay.style.display = 'block';
    overlay.style.left = (rect.left - iframeRect.left + veIframe.contentWindow.scrollX) + 'px';
    overlay.style.top = (rect.top - iframeRect.top + veIframe.contentWindow.scrollY) + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    overlay.innerHTML = `<div class="ve-resize-handle n"></div><div class="ve-resize-handle s"></div>
        <div class="ve-resize-handle e"></div><div class="ve-resize-handle w"></div>
        <div class="ve-resize-handle ne"></div><div class="ve-resize-handle nw"></div>
        <div class="ve-resize-handle se"></div><div class="ve-resize-handle sw"></div>`;

    overlay.querySelectorAll('.ve-resize-handle').forEach(h => {
        h.addEventListener('mousedown', (e) => e.stopPropagation());
    });
}

function clearVESelection() {
    veSelectedElement = null;
    veSelectedSelector = '';
    clearVEOverlay();
    updateVEActionsBar(false);
    const propsBody = document.getElementById('vePropsBody');
    if (propsBody) {
        propsBody.innerHTML = '<div class="ve-empty-state"><i class="fas fa-mouse-pointer"></i><p>Click any element on the canvas to edit its properties</p></div>';
    }
    highlightVETreeItem();
    renderVESections();
    updateVEStatusBar();
}

function clearVEOverlay() {
    const overlay = document.getElementById('veOverlay');
    if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
}

function updateVEActionsBar(show) {
    const header = document.getElementById('veActionsHeader');
    const bar = document.getElementById('veActionsBar');
    if (header) header.style.display = show ? '' : 'none';
    if (bar) bar.style.display = show ? '' : 'none';
    if (show && veSelectedElement) {
        const hideBtn = document.getElementById('veActHide');
        const lockBtn = document.getElementById('veActLock');
        if (hideBtn) hideBtn.querySelector('i').className = veSelectedElement.style.display === 'none' ? 'fas fa-eye-slash' : 'fas fa-eye';
        if (lockBtn) lockBtn.querySelector('i').className = veSelectedElement.dataset.veLocked === 'true' ? 'fas fa-unlock' : 'fas fa-lock';
    }
}

function highlightVETreeItem() {
    document.querySelectorAll('.ve-tree-item').forEach(i => i.classList.remove('selected'));
    if (!veSelectedElement) return;
    const idx = veVisibleElements.findIndex(item => item.el === veSelectedElement);
    if (idx >= 0) {
        const treeItem = document.querySelector(`.ve-tree-item[data-ve-tree-idx="${idx}"]`);
        if (treeItem) { treeItem.classList.add('selected'); treeItem.scrollIntoView({ block: 'nearest' }); }
    }
}

function updateVEStatusBar() {
    const elInfo = document.getElementById('veStatusElement');
    const posInfo = document.getElementById('veStatusPos');
    const sizeInfo = document.getElementById('veStatusSize');
    if (!veSelectedElement) {
        if (elInfo) elInfo.textContent = 'No element selected';
        if (posInfo) posInfo.textContent = '';
        if (sizeInfo) sizeInfo.textContent = '';
        return;
    }
    const tag = veSelectedElement.tagName.toLowerCase();
    const id = veSelectedElement.id ? '#' + veSelectedElement.id : '';
    if (elInfo) elInfo.textContent = `<${tag}>${id}`;
    const rect = veSelectedElement.getBoundingClientRect();
    if (posInfo) posInfo.textContent = `X: ${Math.round(rect.left)} Y: ${Math.round(rect.top)}`;
    if (sizeInfo) sizeInfo.textContent = `${Math.round(rect.width)} x ${Math.round(rect.height)}`;
}

// --- Properties panel ---
function showVEProperties(selector) {
    const propsBody = document.getElementById('vePropsBody');
    if (!propsBody || !veSelectedElement) return;

    const el = veSelectedElement;
    const computed = veIframeDoc.defaultView.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const id = el.id || '';
    const cls = (typeof el.className === 'string' ? el.className : '').trim();
    const text = el.textContent?.trim().substring(0, 100) || '';

    const bp = veCurrentBreakpoint;
    const key = selector;
    if (!veOverrides[key]) veOverrides[key] = {};
    const ov = veOverrides[key][bp] || {};
    const getVal = (prop, fallback) => ov[prop] !== undefined ? ov[prop] : fallback;

    propsBody.innerHTML = `
        <div class="ve-props-section">
            <div class="ve-props-label">Element Info</div>
            <div class="ve-props-info">
                <span class="ve-tag">${tag}</span> ${id ? '<span class="ve-id">#' + id + '</span>' : ''}
                <div class="ve-classes">${cls || 'no classes'}</div>
                ${text ? '<div class="ve-text-preview">"' + text.substring(0, 50) + '..."</div>' : ''}
            </div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Content</div>
            <div class="ve-prop-row"><label>Text</label><input type="text" value="${escapeVEAttr(el.textContent?.trim() || '')}" onchange="veSetProp('text', this.value)"></div>
            ${tag === 'img' ? `<div class="ve-prop-row"><label>Src</label><input type="text" value="${escapeVEAttr(el.src || '')}" onchange="veSetProp('src', this.value)"></div>
            <div class="ve-prop-row"><label>Alt</label><input type="text" value="${escapeVEAttr(el.alt || '')}" onchange="veSetProp('alt', this.value)"></div>` : ''}
            ${tag === 'a' ? `<div class="ve-prop-row"><label>Href</label><input type="text" value="${escapeVEAttr(el.href || '')}" onchange="veSetProp('href', this.value)"></div>` : ''}
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Typography</div>
            <div class="ve-prop-row"><label>Font Size</label><input type="text" value="${getVal('fontSize', computed.fontSize)}" onchange="veSetProp('fontSize', this.value)"></div>
            <div class="ve-prop-row"><label>Font Weight</label><select onchange="veSetProp('fontWeight', this.value)">
                ${[100,200,300,400,500,600,700,800,900].map(w => '<option value="'+w+'" '+(computed.fontWeight==w?'selected':'')+'>'+w+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Font Family</label><select onchange="veSetProp('fontFamily', this.value)">
                ${['','system-ui, sans-serif','serif','monospace','cursive'].map(f => '<option value="'+f+'" '+(computed.fontFamily===f?'selected':'')+'>'+(f||'Default')+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Color</label><div class="ve-color-wrap"><input type="color" value="${veRgbToHex(computed.color)}" onchange="veSetProp('color', this.value)"><input type="text" value="${veRgbToHex(computed.color)}" onchange="this.previousElementSibling.value=this.value;veSetProp('color',this.value)"></div></div>
            <div class="ve-prop-row"><label>Text Align</label><select onchange="veSetProp('textAlign', this.value)">
                ${['left','center','right','justify'].map(v => '<option value="'+v+'" '+(computed.textAlign===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Line Height</label><input type="text" value="${getVal('lineHeight', computed.lineHeight)}" onchange="veSetProp('lineHeight', this.value)"></div>
            <div class="ve-prop-row"><label>Letter Spacing</label><input type="text" value="${getVal('letterSpacing', computed.letterSpacing)}" onchange="veSetProp('letterSpacing', this.value)"></div>
            <div class="ve-prop-row"><label>Text Transform</label><select onchange="veSetProp('textTransform', this.value)">
                ${['none','uppercase','lowercase','capitalize'].map(v => '<option value="'+v+'" '+(computed.textTransform===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Text Decoration</label><select onchange="veSetProp('textDecoration', this.value)">
                ${['none','underline','overline','line-through'].map(v => '<option value="'+v+'" '+(computed.textDecoration===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Spacing</div>
            <div class="ve-prop-row"><label>Margin</label><input type="text" value="${getVal('margin', computed.margin)}" onchange="veSetProp('margin', this.value)"></div>
            <div class="ve-prop-row"><label>Padding</label><input type="text" value="${getVal('padding', computed.padding)}" onchange="veSetProp('padding', this.value)"></div>
            <div class="ve-prop-row"><label>Margin Top</label><input type="text" value="${getVal('marginTop', computed.marginTop)}" onchange="veSetProp('marginTop', this.value)"></div>
            <div class="ve-prop-row"><label>Margin Right</label><input type="text" value="${getVal('marginRight', computed.marginRight)}" onchange="veSetProp('marginRight', this.value)"></div>
            <div class="ve-prop-row"><label>Margin Bottom</label><input type="text" value="${getVal('marginBottom', computed.marginBottom)}" onchange="veSetProp('marginBottom', this.value)"></div>
            <div class="ve-prop-row"><label>Margin Left</label><input type="text" value="${getVal('marginLeft', computed.marginLeft)}" onchange="veSetProp('marginLeft', this.value)"></div>
            <div class="ve-prop-row"><label>Padding Top</label><input type="text" value="${getVal('paddingTop', computed.paddingTop)}" onchange="veSetProp('paddingTop', this.value)"></div>
            <div class="ve-prop-row"><label>Padding Right</label><input type="text" value="${getVal('paddingRight', computed.paddingRight)}" onchange="veSetProp('paddingRight', this.value)"></div>
            <div class="ve-prop-row"><label>Padding Bottom</label><input type="text" value="${getVal('paddingBottom', computed.paddingBottom)}" onchange="veSetProp('paddingBottom', this.value)"></div>
            <div class="ve-prop-row"><label>Padding Left</label><input type="text" value="${getVal('paddingLeft', computed.paddingLeft)}" onchange="veSetProp('paddingLeft', this.value)"></div>
        </div>
        <div class="ve-props-section">
            <div class="ve-props-label">Size</div>
            <div class="ve-prop-row"><label>Box Sizing</label><select onchange="veSetProp('boxSizing', this.value)">
                ${['content-box','border-box'].map(v => '<option value="'+v+'" '+(computed.boxSizing===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Width</label><input type="text" value="${getVal('width', computed.width)}" onchange="veSetProp('width', this.value)"></div>
            <div class="ve-prop-row"><label>Height</label><input type="text" value="${getVal('height', computed.height)}" onchange="veSetProp('height', this.value)"></div>
            <div class="ve-prop-row"><label>Min W</label><input type="text" value="${getVal('minWidth', computed.minWidth)}" onchange="veSetProp('minWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Max W</label><input type="text" value="${getVal('maxWidth', computed.maxWidth)}" onchange="veSetProp('maxWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Min H</label><input type="text" value="${getVal('minHeight', computed.minHeight)}" onchange="veSetProp('minHeight', this.value)"></div>
            <div class="ve-prop-row"><label>Max H</label><input type="text" value="${getVal('maxHeight', computed.maxHeight)}" onchange="veSetProp('maxHeight', this.value)"></div>
        </div>
        <div class="ve-props-section">
            <div class="ve-props-label">Spacing</div>
            <div class="ve-prop-row"><label>Margin</label><input type="text" value="${getVal('margin', computed.margin)}" onchange="veSetProp('margin', this.value)"></div>
            <div class="ve-prop-row"><label>Padding</label><input type="text" value="${getVal('padding', computed.padding)}" onchange="veSetProp('padding', this.value)"></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Size</div>
            <div class="ve-prop-row"><label>Width</label><input type="text" value="${getVal('width', computed.width)}" onchange="veSetProp('width', this.value)"></div>
            <div class="ve-prop-row"><label>Height</label><input type="text" value="${getVal('height', computed.height)}" onchange="veSetProp('height', this.value)"></div>
            <div class="ve-prop-row"><label>Min W</label><input type="text" value="${getVal('minWidth', computed.minWidth)}" onchange="veSetProp('minWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Max W</label><input type="text" value="${getVal('maxWidth', computed.maxWidth)}" onchange="veSetProp('maxWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Min H</label><input type="text" value="${getVal('minHeight', computed.minHeight)}" onchange="veSetProp('minHeight', this.value)"></div>
            <div class="ve-prop-row"><label>Max H</label><input type="text" value="${getVal('maxHeight', computed.maxHeight)}" onchange="veSetProp('maxHeight', this.value)"></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Background</div>
            <div class="ve-prop-row"><label>BG Color</label><div class="ve-color-wrap"><input type="color" value="${veRgbToHex(computed.backgroundColor)}" onchange="veSetProp('backgroundColor', this.value)"><input type="text" value="${veRgbToHex(computed.backgroundColor)}" onchange="this.previousElementSibling.value=this.value;veSetProp('backgroundColor',this.value)"></div></div>
            <div class="ve-prop-row"><label>Border Radius</label><input type="text" value="${getVal('borderRadius', computed.borderRadius)}" onchange="veSetProp('borderRadius', this.value)"></div>
            <div class="ve-prop-row"><label>Opacity</label><input type="range" min="0" max="1" step="0.05" value="${getVal('opacity', computed.opacity)}" onchange="veSetProp('opacity', this.value)"></div>
            <div class="ve-prop-row"><label>Border</label><input type="text" value="${getVal('border', computed.border)}" onchange="veSetProp('border', this.value)"></div>
            <div class="ve-prop-row"><label>Shadow</label><input type="text" value="${getVal('boxShadow', computed.boxShadow)}" onchange="veSetProp('boxShadow', this.value)"></div>
            <div class="ve-prop-row"><label>Backdrop Blur</label><input type="text" value="${getVal('backdropFilter', computed.backdropFilter)}" onchange="veSetProp('backdropFilter', this.value)"></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Layout</div>
            <div class="ve-prop-row"><label>Display</label><select onchange="veSetProp('display', this.value)">
                ${['block','inline','inline-block','flex','grid','none'].map(v => '<option value="'+v+'" '+(computed.display===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Position</label><select onchange="veSetProp('position', this.value)">
                ${['static','relative','absolute','fixed','sticky'].map(v => '<option value="'+v+'" '+(computed.position===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Z-Index</label><input type="number" value="${getVal('zIndex', computed.zIndex)}" onchange="veSetProp('zIndex', this.value)"></div>
            <div class="ve-prop-row"><label>Overflow</label><select onchange="veSetProp('overflow', this.value)">
                ${['visible','hidden','scroll','auto'].map(v => '<option value="'+v+'" '+(computed.overflow===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Visibility</div>
            <div class="ve-prop-row"><label>Visibility</label><select onchange="veSetProp('visibility', this.value)">
                ${['visible','hidden'].map(v => '<option value="'+v+'" '+(computed.visibility===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Cursor</label><select onchange="veSetProp('cursor', this.value)">
                ${['default','pointer','move','not-allowed','grab','grabbing'].map(v => '<option value="'+v+'" '+(computed.cursor===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Animation</div>
            <div class="ve-prop-row"><label>Transition</label><input type="text" value="${getVal('transition', computed.transition)}" onchange="veSetProp('transition', this.value)"></div>
            <div class="ve-prop-row"><label>Transform</label><input type="text" value="${getVal('transform', computed.transform)}" onchange="veSetProp('transform', this.value)"></div>
        </div>
    `;
}

function veSetProp(prop, value) {
    if (!veSelectedElement) return;
    pushVEUndo('Set ' + prop);

    if (prop === 'text') {
        veSelectedElement.textContent = value;
    } else if (prop === 'src') {
        veSelectedElement.src = value;
    } else if (prop === 'alt') {
        veSelectedElement.alt = value;
    } else if (prop === 'href') {
        veSelectedElement.href = value;
    } else {
        veSelectedElement.style[prop] = value;
        const bp = veCurrentBreakpoint;
        if (!veOverrides[veSelectedSelector]) veOverrides[veSelectedSelector] = {};
        if (!veOverrides[veSelectedSelector][bp]) veOverrides[veSelectedSelector][bp] = {};
        veOverrides[veSelectedSelector][bp][prop] = value;
    }
    updateVEOverlay();
}

// Builder V2 Enhanced Properties
function enhanceVEProperties() {
    const propsBody = document.getElementById('vePropsBody');
    if (!propsBody || !veSelectedElement) return;

    const el = veSelectedElement;
    const computed = veIframeDoc.defaultView.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const id = el.id || '';
    const cls = (typeof el.className === 'string' ? el.className : '').trim();
    const text = el.textContent?.trim().substring(0, 100) || '';

    const bp = veCurrentBreakpoint;
    const key = veSelectedSelector;
    if (!veOverrides[key]) veOverrides[key] = {};
    const ov = veOverrides[key][bp] || {};
    const getVal = (prop, fallback) => ov[prop] !== undefined ? ov[prop] : fallback;

    propsBody.innerHTML = `
        <div class="ve-props-section">
            <div class="ve-props-label">Element Info</div>
            <div class="ve-props-info">
                <span class="ve-tag">${tag}</span> ${id ? '<span class="ve-id">#' + id + '</span>' : ''}
                <div class="ve-classes">${cls || 'no classes'}</div>
                ${text ? '<div class="ve-text-preview">"' + text.substring(0, 50) + '..."</div>' : ''}
            </div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Content</div>
            <div class="ve-prop-row"><label>Text</label><input type="text" value="${escapeVEAttr(el.textContent?.trim() || '')}" onchange="veSetProp('text', this.value)"></div>
            ${tag === 'img' ? `<div class="ve-prop-row"><label>Src</label><input type="text" value="${escapeVEAttr(el.src || '')}" onchange="veSetProp('src', this.value)"></div>
            <div class="ve-prop-row"><label>Alt</label><input type="text" value="${escapeVEAttr(el.alt || '')}" onchange="veSetProp('alt', this.value)"></div>` : ''}
            ${tag === 'a' ? `<div class="ve-prop-row"><label>Href</label><input type="text" value="${escapeVEAttr(el.href || '')}" onchange="veSetProp('href', this.value)"></div>` : ''}
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Dimensions</div>
            <div class="ve-prop-row"><label>Width</label><input type="text" value="${getVal('width', computed.width)}" onchange="veSetProp('width', this.value)"></div>
            <div class="ve-prop-row"><label>Height</label><input type="text" value="${getVal('height', computed.height)}" onchange="veSetProp('height', this.value)"></div>
            <div class="ve-prop-row"><label>Min W</label><input type="text" value="${getVal('minWidth', computed.minWidth)}" onchange="veSetProp('minWidth', this.value)"></div>
            <div class="ve-prop-row"><label>Max W</label><input type="text" value="${getVal('maxWidth', computed.maxWidth)}" onchange="veSetProp('maxWidth', this.value)"></div>
        </div>

        <div class="ve-props-section">
            <div class="ve-props-label">Typography</div>
            <div class="ve-prop-row"><label>Font Size</label><input type="text" value="${getVal('fontSize', computed.fontSize)}" onchange="veSetProp('fontSize', this.value)"></div>
            <div class="ve-prop-row"><label>Font Weight</label><select onchange="veSetProp('fontWeight', this.value)">
                ${[100,200,300,400,500,600,700,800,900].map(w => '<option value="'+w+'" '+(computed.fontWeight==w?'selected':'')+'>'+w+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Font Family</label><select onchange="veSetProp('fontFamily', this.value)">
                ${['','system-ui, sans-serif','serif','monospace','cursive'].map(f => '<option value="'+f+'" '+(computed.fontFamily===f?'selected':'')+'>'+(f||'Default')+'</option>').join('')}
            </select></div>
            <div class="ve-prop-row"><label>Color</label><div class="ve-color-wrap"><input type="color" value="${veRgbToHex(computed.color)}" onchange="veSetProp('color', this.value)"><input type="text" value="${veRgbToHex(computed.color)}" onchange="this.previousElementSibling.value=this.value;veSetProp('color',this.value)"></div></div>
            <div class="ve-prop-row"><label>Text Align</label><select onchange="veSetProp('textAlign', this.value)">
                ${['left','center','right','justify'].map(v => '<option value="'+v+'" '+(computed.textAlign===v?'selected':'')+'>'+v+'</option>').join('')}
            </select></div>
        </div>
    `;
}

// --- Element actions ---
function veDuplicateElement() {
    if (!veSelectedElement) return;
    pushVEUndo('Duplicate element');
    const clone = veSelectedElement.cloneNode(true);
    clone.removeAttribute('id');
    veSelectedElement.parentElement.insertBefore(clone, veSelectedElement.nextSibling);
    addVEHistoryEntry('Duplicated ' + veSelectedElement.tagName.toLowerCase());
    scanIframeElements();
    selectVEElement(clone);
}

function veDeleteElement() {
    if (!veSelectedElement) return;
    pushVEUndo('Delete element');
    const tag = veSelectedElement.tagName.toLowerCase();
    veSelectedElement.remove();
    addVEHistoryEntry('Deleted <' + tag + '>');
    scanIframeElements();
    clearVESelection();
}

function veToggleHide() {
    if (!veSelectedElement) return;
    const hidden = veSelectedElement.style.display === 'none';
    veSelectedElement.style.display = hidden ? '' : 'none';
    addVEHistoryEntry((hidden ? 'Showed ' : 'Hidden ') + veSelectedElement.tagName.toLowerCase());
    scanIframeElements();
    updateVEActionsBar(true);
}

function veToggleLock() {
    if (!veSelectedElement) return;
    const locked = veSelectedElement.dataset.veLocked === 'true';
    veSelectedElement.dataset.veLocked = locked ? 'false' : 'true';
    addVEHistoryEntry((locked ? 'Unlocked ' : 'Locked ') + veSelectedElement.tagName.toLowerCase());
    scanIframeElements();
    updateVEActionsBar(true);
}

function veMoveElement(dir) {
    if (!veSelectedElement || !veSelectedElement.parentElement) return;
    pushVEUndo('Move element ' + dir);
    const parent = veSelectedElement.parentElement;
    if (dir === 'up' && veSelectedElement.previousElementSibling) {
        parent.insertBefore(veSelectedElement, veSelectedElement.previousElementSibling);
    } else if (dir === 'down' && veSelectedElement.nextElementSibling) {
        parent.insertBefore(veSelectedElement.nextElementSibling, veSelectedElement);
    }
    addVEHistoryEntry('Moved ' + veSelectedElement.tagName.toLowerCase() + ' ' + dir);
    scanIframeElements();
    updateVEOverlay();
}

function veWrapInContainer() {
    if (!veSelectedElement) return;
    pushVEUndo('Wrap in container');
    const wrapper = veIframeDoc.createElement('div');
    wrapper.style.padding = '16px';
    wrapper.style.border = '1px dashed rgba(255,255,255,0.3)';
    wrapper.style.borderRadius = '8px';
    veSelectedElement.parentElement.insertBefore(wrapper, veSelectedElement);
    wrapper.appendChild(veSelectedElement);
    addVEHistoryEntry('Wrapped element in container');
    scanIframeElements();
    selectVEElement(wrapper);
}

function veEditHTML() {
    if (!veSelectedElement) return;
    const currentHTML = veSelectedElement.outerHTML;
    const overlay = document.createElement('div');
    overlay.className = 've-html-editor';
    overlay.innerHTML = `<div class="ve-html-editor-content">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border-glass);"><span style="font-weight:600;color:var(--text-primary)">Edit HTML</span><button class="ve-html-close" onclick="this.closest('.ve-html-editor').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;"><i class="fas fa-times"></i></button></div>
        <textarea spellcheck="false">${escapeVEAttr(currentHTML)}</textarea>
        <div class="ve-html-editor-actions">
            <button class="ve-btn-secondary" onclick="this.closest('.ve-html-editor').remove()">Cancel</button>
            <button class="ve-btn-primary" onclick="veApplyHTMLEdit(this)">Apply</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('textarea').focus();
}

function veApplyHTMLEdit(btn) {
    const modal = btn.closest('.ve-html-editor');
    const textarea = modal.querySelector('textarea');
    const newHTML = textarea.value.trim();
    if (!newHTML || !veSelectedElement) { modal.remove(); return; }
    pushVEUndo('Edit HTML');
    const temp = veIframeDoc.createElement('div');
    temp.innerHTML = newHTML;
    const newEl = temp.firstChild;
    if (newEl) {
        veSelectedElement.parentElement.replaceChild(newEl, veSelectedElement);
        veSelectedElement = newEl;
        veSelectedSelector = getVEUniqueSelector(newEl);
        addVEHistoryEntry('Edited HTML');
        scanIframeElements();
        updateVEOverlay();
    }
    modal.remove();
}

// --- Undo / Redo ---
function pushVEUndo(action) {
    if (!veIframeDoc) return;
    veUndoStack.push({ html: veIframeDoc.documentElement.outerHTML, action: action || 'Edit', time: new Date().toLocaleTimeString() });
    if (veUndoStack.length > veMaxHistory) veUndoStack.shift();
    veRedoStack = [];
    updateVEUndoRedoBtns();
}

function veUndo() {
    if (veUndoStack.length === 0) return;
    veRedoStack.push({ html: veIframeDoc.documentElement.outerHTML, action: 'Undo', time: new Date().toLocaleTimeString() });
    const prev = veUndoStack.pop();
    veIframeDoc.documentElement.innerHTML = new DOMParser().parseFromString(prev.html, 'text/html').documentElement.innerHTML;
    updateVEUndoRedoBtns();
    addVEHistoryEntry('Undo: ' + prev.action);
    scanIframeElements();
    clearVESelection();
}

function veRedo() {
    if (veRedoStack.length === 0) return;
    veUndoStack.push({ html: veIframeDoc.documentElement.outerHTML, action: 'Redo', time: new Date().toLocaleTimeString() });
    const next = veRedoStack.pop();
    veIframeDoc.documentElement.innerHTML = new DOMParser().parseFromString(next.html, 'text/html').documentElement.innerHTML;
    updateVEUndoRedoBtns();
    addVEHistoryEntry('Redo');
    scanIframeElements();
    clearVESelection();
}

function updateVEUndoRedoBtns() {
    const canUndo = veUndoStack.length > 0;
    const canRedo = veRedoStack.length > 0;
    // Canvas toolbar
    const undoBtn = document.getElementById('veUndoBtn');
    const redoBtn = document.getElementById('veRedoBtn');
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
    // Panel buttons (Layers tab)
    const pUndo = document.getElementById('vePanelUndo');
    const pRedo = document.getElementById('vePanelRedo');
    if (pUndo) pUndo.disabled = !canUndo;
    if (pRedo) pRedo.disabled = !canRedo;
    // Panel buttons (Components tab)
    const pUndo2 = document.getElementById('vePanelUndo2');
    const pRedo2 = document.getElementById('vePanelRedo2');
    if (pUndo2) pUndo2.disabled = !canUndo;
    if (pRedo2) pRedo2.disabled = !canRedo;
}

// --- History panel ---
function addVEHistoryEntry(action) {
    const entry = { action, time: new Date().toLocaleTimeString() };
    veHistoryEntries.push(entry);
    if (veHistoryEntries.length > 100) veHistoryEntries.shift();
    renderVEHistory();
}

function renderVEHistory() {
    const list = document.getElementById('veHistoryList');
    if (!list) return;
    if (veHistoryEntries.length === 0) {
        list.innerHTML = '<div class="ve-empty-hint"><i class="fas fa-clock"></i><p>No changes yet</p></div>';
        return;
    }
    list.innerHTML = veHistoryEntries.slice().reverse().map((e, i) =>
        `<div class="ve-history-entry"><span class="ve-history-action">${e.action}</span><span class="ve-history-time">${e.time}</span></div>`
    ).join('');
}

// --- Component drag & drop ---
function setupComponentDrag() {
    document.querySelectorAll('.ve-comp-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.compType);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    const wrapper = document.getElementById('veCanvasWrapper');
    if (wrapper) {
        wrapper.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('text/plain');
            if (type) veInsertComponent(type);
        });
    }
}

function veInsertComponent(type) {
    if (!veIframeDoc) return;
    pushVEUndo('Insert ' + type);
    let el;
    switch (type) {
        case 'section': el = veIframeDoc.createElement('section'); el.style.padding = '60px 20px'; el.style.minHeight = '300px'; break;
        case 'div': el = veIframeDoc.createElement('div'); el.style.padding = '20px'; el.style.border = '1px dashed rgba(255,255,255,0.3)'; el.style.borderRadius = '8px'; break;
        case 'grid': el = veIframeDoc.createElement('div'); el.style.display = 'grid'; el.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))'; el.style.gap = '16px'; el.style.padding = '20px'; break;
        case 'heading': el = veIframeDoc.createElement('h2'); el.textContent = 'Heading'; el.style.color = '#ffffff'; break;
        case 'text': el = veIframeDoc.createElement('p'); el.textContent = 'Text content goes here.'; el.style.color = '#b3b3b3'; break;
        case 'image': el = veIframeDoc.createElement('img'); el.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23333" width="200" height="200"/><text fill="%23666" x="50%" y="50%" text-anchor="middle" dy=".3em">Image</text></svg>'; el.style.maxWidth = '100%'; el.style.borderRadius = '8px'; break;
        case 'icon': el = veIframeDoc.createElement('i'); el.className = 'fas fa-star'; el.style.color = '#1db954'; el.style.fontSize = '24px'; break;
        case 'button': el = veIframeDoc.createElement('button'); el.textContent = 'Button'; el.style.padding = '10px 24px'; el.style.borderRadius = '24px'; el.style.background = '#1db954'; el.style.color = '#fff'; el.style.border = 'none'; el.style.cursor = 'pointer'; break;
        case 'link': el = veIframeDoc.createElement('a'); el.textContent = 'Link'; el.href = '#'; el.style.color = '#1db954'; break;
        case 'song-card': el = veIframeDoc.createElement('div'); el.className = 'song-card'; el.innerHTML = '<div style="width:100%;aspect-ratio:1;background:#333;border-radius:8px"></div><p style="margin:8px 0 0;color:#fff">Song Title</p>'; break;
        case 'station-card': el = veIframeDoc.createElement('div'); el.className = 'station-card'; el.innerHTML = '<div style="width:100%;aspect-ratio:1;background:#1a1a2e;border-radius:12px"></div><p style="margin:8px 0 0;color:#fff">Station</p>'; break;
        case 'artist-card': el = veIframeDoc.createElement('div'); el.className = 'artist-card'; el.innerHTML = '<div style="width:80px;height:80px;border-radius:50%;background:#333;margin:0 auto"></div><p style="margin:8px 0 0;color:#fff;text-align:center">Artist</p>'; break;
        case 'carousel': el = veIframeDoc.createElement('div'); el.style.display = 'flex'; el.style.gap = '16px'; el.style.overflow = 'auto'; el.style.padding = '16px'; for (let i = 0; i < 4; i++) { const c = veIframeDoc.createElement('div'); c.style.minWidth = '200px'; c.style.height = '200px'; c.style.background = '#222'; c.style.borderRadius = '8px'; el.appendChild(c); } break;
        case 'chart-list': el = veIframeDoc.createElement('div'); el.className = 'chart-list'; el.innerHTML = '<div style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:#fff">1. Song Title</div><div style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:#fff">2. Song Title</div>'; break;
        default: el = veIframeDoc.createElement('div'); el.textContent = type; el.style.padding = '16px';
    }

    veIframeDoc.body.appendChild(el);
    addVEHistoryEntry('Inserted ' + type);
    scanIframeElements();
    selectVEElement(el);
}

// --- Draft / Publish ---
function saveVEDraft() {
    try {
        const draft = {
            overrides: veOverrides,
            html: veIframeDoc?.documentElement?.outerHTML || '',
            history: veHistoryEntries,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem('veDraft', JSON.stringify(draft));
        addVEHistoryEntry('Draft saved');
        showToast('Visual editor draft saved!', 'success');
    } catch (e) {
        showToast('Failed to save draft', 'error');
    }
}

function loadVEDraft() {
    try {
        const raw = localStorage.getItem('veDraft');
        if (raw) {
            const draft = JSON.parse(raw);
            if (draft.overrides) veOverrides = draft.overrides;
            if (draft.history) veHistoryEntries = draft.history;
        }
    } catch (e) { /* ignore */ }
}

function publishVEChanges() {
    if (!confirm('Publish visual editor changes to the live site?')) return;
    saveVEOverridesForLive();
    saveVEDraft();
    syncToLiveWebsite();
    addVEHistoryEntry('Published to live');
    showToast('Visual editor changes published!', 'success');
}

function saveVEOverridesForLive() {
    if (!veIframeDoc) return;
    const sectionEls = veIframeDoc.querySelectorAll(
        'section, [data-section], header, nav, footer, main, [class*="section"], .home-section, .site-footer, .top-header'
    );
    const meaningful = Array.from(sectionEls).filter(el => el.id || el.getAttribute('data-section') || el.children.length > 0);
    const sectionStates = meaningful.map(el => {
        const id = el.getAttribute('data-section') || el.id || '';
        const hidden = el.style.display === 'none' || el.hidden;
        const computed = window.getComputedStyle(el);
        return {
            id,
            hidden,
            display: hidden ? 'none' : '',
            order: Array.from(el.parentElement.children).indexOf(el)
        };
    });
    const payload = {
        sectionStates,
        overrides: veOverrides,
        timestamp: Date.now()
    };
    localStorage.setItem('tamilAIStream_veOverrides', JSON.stringify(payload));
}

// --- Helpers ---
function escapeVEAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function veRgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return '#000000';
    return '#' + match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

// ============================================
// Player Settings (Bottom Nav + Mini Player + Full-Screen)
// ============================================
const PLAYER_DEFAULTS = {
    bn: {
        visible: true, height: 64, showWithPlayer: true, playerOffset: 18,
        bgColor: '#0c0f1e', bgOpacity: 92, blur: 24,
        borderColor: '#ffffff', borderWidth: 1, borderOpacity: 10,
        iconSize: 26, iconColor: '#8b8fa3', activeColor: '#34d399',
        labelSize: 10, labelColor: '#8b8fa3', activeLabelColor: '#34d399',
        indicator: 'pill', indicatorColor: 'rgba(52,211,153,0.15)',
        showMobile: true, showTablet: true, showDesktop: false, safeArea: 0
    },
    mp: {
        visible: true, position: 'bottom-center', maxWidth: 720, bottomOffset: 18, sideMargin: 12, zIndex: 1800,
        bgColor: '#0c0f1e', bgOpacity: 88, blur: 32, borderRadius: 18,
        borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, shadow: 'medium',
        showArt: true, artSize: 46, artRadius: 10, showEq: true,
        titleSize: 13.4, titleWeight: '600', titleColor: '#ffffff',
        artistSize: 11.2, artistColor: '#b3b3b3', showTime: true,
        showPlay: true, showPrev: true, showNext: true, showFav: true, showExpand: true, showWave: true,
        btnSize: 44, btnColor: '#ffffff', playBtnColor: '#34d399',
        showProgress: true, progressH: 6, progressColor: '#34d399', progressBg: 'rgba(255,255,255,0.15)',
        showThumb: true, thumbSize: 10, expandHover: true,
        showOnPlay: true, autoHide: 0, animation: 'slide-up', showNowPlaying: true,
        mobileArtSize: 38, mobileBtnSize: 38, mobileHideWave: true, mobileCompact: true
    },
    fs: {
        bgColor: '#0a0c18', bgOpacity: 98, blur: 40, glow: true, glowIntensity: 50, animation: 'slide-up',
        artSize: 320, artRadius: 16, artFloat: true, artGlow: true, aiRing: true, particles: true, visualizer: true,
        titleSize: 22, titleWeight: '700', titleColor: '#ffffff',
        artistSize: 16, artistColor: '#b3b3b3', showMovie: true, showBadge: true, showNowPlaying: true,
        playBtnSize: 64, playBtnColor: '#34d399', btnSize: 40, btnColor: '#ffffff',
        showShuffle: true, showRepeat: true,
        progressH: 6, progressColor: '#34d399', progressBg: 'rgba(255,255,255,0.15)',
        showThumb: true, thumbSize: 12, showTime: true,
        showFav: true, showLyrics: true, showQueue: true, showShare: true, showAddPlaylist: true,
        secBtnSize: 40, secBtnColor: '#ffffff',
        showVolume: true, volumeWidth: 140, volumeColor: '#34d399', showMute: true,
        queueBg: 'rgba(20,22,40,0.95)', queueActive: '#34d399',
        lyricsBg: 'rgba(20,22,40,0.95)', lyricsActive: '#34d399', lyricsSize: 16,
        showEq: true, eqCount: 20, eqColor: '#34d399', eqWidth: 3, eqGap: 2,
        showAIBot: true,
        mobileArtSize: 260, mobilePlayBtn: 56, mobileWave: false, safeArea: 20
    }
};

function loadPlayerSettings() {
    const raw = DataStore.getMiniPlayerSettings();
    const s = raw.playerSettings || raw;
    const bn = { ...PLAYER_DEFAULTS.bn, ...(s.bn || {}) };
    const mp = { ...PLAYER_DEFAULTS.mp, ...(s.mp || {}) };
    const fs = { ...PLAYER_DEFAULTS.fs, ...(s.fs || {}) };

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = String(val ?? ''); };
    const b = (v) => String(v);

    // Bottom Nav
    setVal('bnVisible', b(bn.visible)); setVal('bnHeight', bn.height);
    setVal('bnShowWithPlayer', b(bn.showWithPlayer)); setVal('bnPlayerOffset', bn.playerOffset);
    setVal('bnBgColor', bn.bgColor); setVal('bnBgOpacity', bn.bgOpacity); setVal('bnBlur', bn.blur);
    setVal('bnBorderColor', bn.borderColor); setVal('bnBorderWidth', bn.borderWidth); setVal('bnBorderOpacity', bn.borderOpacity);
    setVal('bnIconSize', bn.iconSize); setVal('bnIconColor', bn.iconColor); setVal('bnActiveColor', bn.activeColor);
    setVal('bnLabelSize', bn.labelSize); setVal('bnLabelColor', bn.labelColor); setVal('bnActiveLabelColor', bn.activeLabelColor);
    setVal('bnIndicator', bn.indicator); setVal('bnIndicatorColor', bn.indicatorColor);
    setVal('bnShowMobile', b(bn.showMobile)); setVal('bnShowTablet', b(bn.showTablet)); setVal('bnShowDesktop', b(bn.showDesktop));
    setVal('bnSafeArea', bn.safeArea);

    // Mini Player
    setVal('mpVisible', b(mp.visible)); setVal('mpPosition', mp.position); setVal('mpMaxWidth', mp.maxWidth);
    setVal('mpBottomOffset', mp.bottomOffset); setVal('mpSideMargin', mp.sideMargin); setVal('mpZIndex', mp.zIndex);
    setVal('mpBgColor', mp.bgColor); setVal('mpBgOpacity', mp.bgOpacity); setVal('mpBlur', mp.blur);
    setVal('mpBorderRadius', mp.borderRadius); setVal('mpBorderColor', mp.borderColor); setVal('mpBorderWidth', mp.borderWidth);
    setVal('mpShadow', mp.shadow);
    setVal('mpShowArt', b(mp.showArt)); setVal('mpArtSize', mp.artSize); setVal('mpArtRadius', mp.artRadius); setVal('mpShowEq', b(mp.showEq));
    setVal('mpTitleSize', mp.titleSize); setVal('mpTitleWeight', mp.titleWeight); setVal('mpTitleColor', mp.titleColor);
    setVal('mpArtistSize', mp.artistSize); setVal('mpArtistColor', mp.artistColor); setVal('mpShowTime', b(mp.showTime));
    setVal('mpShowPlay', b(mp.showPlay)); setVal('mpShowPrev', b(mp.showPrev)); setVal('mpShowNext', b(mp.showNext));
    setVal('mpShowFav', b(mp.showFav)); setVal('mpShowExpand', b(mp.showExpand)); setVal('mpShowWave', b(mp.showWave));
    setVal('mpBtnSize', mp.btnSize); setVal('mpBtnColor', mp.btnColor); setVal('mpPlayBtnColor', mp.playBtnColor);
    setVal('mpShowProgress', b(mp.showProgress)); setVal('mpProgressH', mp.progressH); setVal('mpProgressColor', mp.progressColor);
    setVal('mpProgressBg', mp.progressBg); setVal('mpShowThumb', b(mp.showThumb)); setVal('mpThumbSize', mp.thumbSize);
    setVal('mpExpandHover', b(mp.expandHover));
    setVal('mpShowOnPlay', b(mp.showOnPlay)); setVal('mpAutoHide', mp.autoHide); setVal('mpAnimation', mp.animation);
    setVal('mpShowNowPlaying', b(mp.showNowPlaying));
    setVal('mpMobileArtSize', mp.mobileArtSize); setVal('mpMobileBtnSize', mp.mobileBtnSize);
    setVal('mpMobileHideWave', b(mp.mobileHideWave)); setVal('mpMobileCompact', b(mp.mobileCompact));

    // Full-Screen
    setVal('fsBgColor', fs.bgColor); setVal('fsBgOpacity', fs.bgOpacity); setVal('fsBlur', fs.blur);
    setVal('fsGlow', b(fs.glow)); setVal('fsGlowIntensity', fs.glowIntensity); setVal('fsAnimation', fs.animation);
    setVal('fsArtSize', fs.artSize); setVal('fsArtRadius', fs.artRadius); setVal('fsArtFloat', b(fs.artFloat));
    setVal('fsArtGlow', b(fs.artGlow)); setVal('fsAIRing', b(fs.aiRing)); setVal('fsParticles', b(fs.particles));
    setVal('fsVisualizer', b(fs.visualizer));
    setVal('fsTitleSize', fs.titleSize); setVal('fsTitleWeight', fs.titleWeight); setVal('fsTitleColor', fs.titleColor);
    setVal('fsArtistSize', fs.artistSize); setVal('fsArtistColor', fs.artistColor);
    setVal('fsShowMovie', b(fs.showMovie)); setVal('fsShowBadge', b(fs.showBadge)); setVal('fsShowNowPlaying', b(fs.showNowPlaying));
    setVal('fsPlayBtnSize', fs.playBtnSize); setVal('fsPlayBtnColor', fs.playBtnColor);
    setVal('fsBtnSize', fs.btnSize); setVal('fsBtnColor', fs.btnColor);
    setVal('fsShowShuffle', b(fs.showShuffle)); setVal('fsShowRepeat', b(fs.showRepeat));
    setVal('fsProgressH', fs.progressH); setVal('fsProgressColor', fs.progressColor); setVal('fsProgressBg', fs.progressBg);
    setVal('fsShowThumb', b(fs.showThumb)); setVal('fsThumbSize', fs.thumbSize); setVal('fsShowTime', b(fs.showTime));
    setVal('fsShowFav', b(fs.showFav)); setVal('fsShowLyrics', b(fs.showLyrics)); setVal('fsShowQueue', b(fs.showQueue));
    setVal('fsShowShare', b(fs.showShare)); setVal('fsShowAddPlaylist', b(fs.showAddPlaylist));
    setVal('fsSecBtnSize', fs.secBtnSize); setVal('fsSecBtnColor', fs.secBtnColor);
    setVal('fsShowVolume', b(fs.showVolume)); setVal('fsVolumeWidth', fs.volumeWidth);
    setVal('fsVolumeColor', fs.volumeColor); setVal('fsShowMute', b(fs.showMute));
    setVal('fsQueueBg', fs.queueBg); setVal('fsQueueActive', fs.queueActive);
    setVal('fsLyricsBg', fs.lyricsBg); setVal('fsLyricsActive', fs.lyricsActive); setVal('fsLyricsSize', fs.lyricsSize);
    setVal('fsShowEq', b(fs.showEq)); setVal('fsEqCount', fs.eqCount); setVal('fsEqColor', fs.eqColor);
    setVal('fsEqWidth', fs.eqWidth); setVal('fsEqGap', fs.eqGap); setVal('fsShowAIBot', b(fs.showAIBot));
    setVal('fsMobileArtSize', fs.mobileArtSize); setVal('fsMobilePlayBtn', fs.mobilePlayBtn);
    setVal('fsMobileWave', b(fs.mobileWave)); setVal('fsSafeArea', fs.safeArea);
}

function savePlayerSettings(e) {
    e.preventDefault();
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const n = (id) => parseFloat(g(id)) || 0;
    const b = (id) => g(id) === 'true';

    const settings = {
        bn: {
            visible: b('bnVisible'), height: n('bnHeight'), showWithPlayer: b('bnShowWithPlayer'), playerOffset: n('bnPlayerOffset'),
            bgColor: g('bnBgColor'), bgOpacity: n('bnBgOpacity'), blur: n('bnBlur'),
            borderColor: g('bnBorderColor'), borderWidth: n('bnBorderWidth'), borderOpacity: n('bnBorderOpacity'),
            iconSize: n('bnIconSize'), iconColor: g('bnIconColor'), activeColor: g('bnActiveColor'),
            labelSize: n('bnLabelSize'), labelColor: g('bnLabelColor'), activeLabelColor: g('bnActiveLabelColor'),
            indicator: g('bnIndicator'), indicatorColor: g('bnIndicatorColor'),
            showMobile: b('bnShowMobile'), showTablet: b('bnShowTablet'), showDesktop: b('bnShowDesktop'), safeArea: n('bnSafeArea')
        },
        mp: {
            visible: b('mpVisible'), position: g('mpPosition'), maxWidth: n('mpMaxWidth'), bottomOffset: n('mpBottomOffset'),
            sideMargin: n('mpSideMargin'), zIndex: n('mpZIndex'),
            bgColor: g('mpBgColor'), bgOpacity: n('mpBgOpacity'), blur: n('mpBlur'), borderRadius: n('mpBorderRadius'),
            borderColor: g('mpBorderColor'), borderWidth: n('mpBorderWidth'), shadow: g('mpShadow'),
            showArt: b('mpShowArt'), artSize: n('mpArtSize'), artRadius: n('mpArtRadius'), showEq: b('mpShowEq'),
            titleSize: n('mpTitleSize'), titleWeight: g('mpTitleWeight'), titleColor: g('mpTitleColor'),
            artistSize: n('mpArtistSize'), artistColor: g('mpArtistColor'), showTime: b('mpShowTime'),
            showPlay: b('mpShowPlay'), showPrev: b('mpShowPrev'), showNext: b('mpShowNext'),
            showFav: b('mpShowFav'), showExpand: b('mpShowExpand'), showWave: b('mpShowWave'),
            btnSize: n('mpBtnSize'), btnColor: g('mpBtnColor'), playBtnColor: g('mpPlayBtnColor'),
            showProgress: b('mpShowProgress'), progressH: n('mpProgressH'), progressColor: g('mpProgressColor'),
            progressBg: g('mpProgressBg'), showThumb: b('mpShowThumb'), thumbSize: n('mpThumbSize'), expandHover: b('mpExpandHover'),
            showOnPlay: b('mpShowOnPlay'), autoHide: n('mpAutoHide'), animation: g('mpAnimation'), showNowPlaying: b('mpShowNowPlaying'),
            mobileArtSize: n('mpMobileArtSize'), mobileBtnSize: n('mpMobileBtnSize'),
            mobileHideWave: b('mpMobileHideWave'), mobileCompact: b('mpMobileCompact')
        },
        fs: {
            bgColor: g('fsBgColor'), bgOpacity: n('fsBgOpacity'), blur: n('fsBlur'), glow: b('fsGlow'),
            glowIntensity: n('fsGlowIntensity'), animation: g('fsAnimation'),
            artSize: n('fsArtSize'), artRadius: n('fsArtRadius'), artFloat: b('fsArtFloat'),
            artGlow: b('fsArtGlow'), aiRing: b('fsAIRing'), particles: b('fsParticles'), visualizer: b('fsVisualizer'),
            titleSize: n('fsTitleSize'), titleWeight: g('fsTitleWeight'), titleColor: g('fsTitleColor'),
            artistSize: n('fsArtistSize'), artistColor: g('fsArtistColor'),
            showMovie: b('fsShowMovie'), showBadge: b('fsShowBadge'), showNowPlaying: b('fsShowNowPlaying'),
            playBtnSize: n('fsPlayBtnSize'), playBtnColor: g('fsPlayBtnColor'),
            btnSize: n('fsBtnSize'), btnColor: g('fsBtnColor'), showShuffle: b('fsShowShuffle'), showRepeat: b('fsShowRepeat'),
            progressH: n('fsProgressH'), progressColor: g('fsProgressColor'), progressBg: g('fsProgressBg'),
            showThumb: b('fsShowThumb'), thumbSize: n('fsThumbSize'), showTime: b('fsShowTime'),
            showFav: b('fsShowFav'), showLyrics: b('fsShowLyrics'), showQueue: b('fsShowQueue'),
            showShare: b('fsShowShare'), showAddPlaylist: b('fsShowAddPlaylist'),
            secBtnSize: n('fsSecBtnSize'), secBtnColor: g('fsSecBtnColor'),
            showVolume: b('fsShowVolume'), volumeWidth: n('fsVolumeWidth'), volumeColor: g('fsVolumeColor'), showMute: b('fsShowMute'),
            queueBg: g('fsQueueBg'), queueActive: g('fsQueueActive'),
            lyricsBg: g('fsLyricsBg'), lyricsActive: g('fsLyricsActive'), lyricsSize: n('fsLyricsSize'),
            showEq: b('fsShowEq'), eqCount: n('fsEqCount'), eqColor: g('fsEqColor'),
            eqWidth: n('fsEqWidth'), eqGap: n('fsEqGap'), showAIBot: b('fsShowAIBot'),
            mobileArtSize: n('fsMobileArtSize'), mobilePlayBtn: n('fsMobilePlayBtn'),
            mobileWave: b('fsMobileWave'), safeArea: n('fsSafeArea')
        }
    };

    const raw = DataStore.getMiniPlayerSettings();
    raw.playerSettings = settings;
    DataStore.setMiniPlayerSettings(raw);
    applyPlayerSettings(settings);
    showToast('Player settings saved & applied!', 'success');
    syncToLiveWebsite();
    return false;
}

function resetPlayerSettings() {
    if (!confirm('Reset all player settings to defaults?')) return;
    const raw = DataStore.getMiniPlayerSettings();
    raw.playerSettings = PLAYER_DEFAULTS;
    DataStore.setMiniPlayerSettings(raw);
    loadPlayerSettings();
    applyPlayerSettings(PLAYER_DEFAULTS);
    showToast('Player settings reset to defaults', 'success');
}

function previewPlayerSettings() {
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const n = (id) => parseFloat(g(id)) || 0;
    const b = (id) => g(id) === 'true';
    const preview = {
        bn: { visible: b('bnVisible'), height: n('bnHeight'), showWithPlayer: b('bnShowWithPlayer'), playerOffset: n('bnPlayerOffset'), bgColor: g('bnBgColor'), bgOpacity: n('bnBgOpacity'), blur: n('bnBlur'), borderColor: g('bnBorderColor'), borderWidth: n('bnBorderWidth'), borderOpacity: n('bnBorderOpacity'), iconSize: n('bnIconSize'), iconColor: g('bnIconColor'), activeColor: g('bnActiveColor'), labelSize: n('bnLabelSize'), labelColor: g('bnLabelColor'), activeLabelColor: g('bnActiveLabelColor'), indicator: g('bnIndicator'), indicatorColor: g('bnIndicatorColor'), showMobile: b('bnShowMobile'), showTablet: b('bnShowTablet'), showDesktop: b('bnShowDesktop'), safeArea: n('bnSafeArea') },
        mp: { visible: b('mpVisible'), position: g('mpPosition'), maxWidth: n('mpMaxWidth'), bottomOffset: n('mpBottomOffset'), sideMargin: n('mpSideMargin'), zIndex: n('mpZIndex'), bgColor: g('mpBgColor'), bgOpacity: n('mpBgOpacity'), blur: n('mpBlur'), borderRadius: n('mpBorderRadius'), borderColor: g('mpBorderColor'), borderWidth: n('mpBorderWidth'), shadow: g('mpShadow'), showArt: b('mpShowArt'), artSize: n('mpArtSize'), artRadius: n('mpArtRadius'), showEq: b('mpShowEq'), titleSize: n('mpTitleSize'), titleWeight: g('mpTitleWeight'), titleColor: g('mpTitleColor'), artistSize: n('mpArtistSize'), artistColor: g('mpArtistColor'), showTime: b('mpShowTime'), showPlay: b('mpShowPlay'), showPrev: b('mpShowPrev'), showNext: b('mpShowNext'), showFav: b('mpShowFav'), showExpand: b('mpShowExpand'), showWave: b('mpShowWave'), btnSize: n('mpBtnSize'), btnColor: g('mpBtnColor'), playBtnColor: g('mpPlayBtnColor'), showProgress: b('mpShowProgress'), progressH: n('mpProgressH'), progressColor: g('mpProgressColor'), progressBg: g('mpProgressBg'), showThumb: b('mpShowThumb'), thumbSize: n('mpThumbSize'), expandHover: b('mpExpandHover'), showOnPlay: b('mpShowOnPlay'), autoHide: n('mpAutoHide'), animation: g('mpAnimation'), showNowPlaying: b('mpShowNowPlaying'), mobileArtSize: n('mpMobileArtSize'), mobileBtnSize: n('mpMobileBtnSize'), mobileHideWave: b('mpMobileHideWave'), mobileCompact: b('mpMobileCompact') },
        fs: { bgColor: g('fsBgColor'), bgOpacity: n('fsBgOpacity'), blur: n('fsBlur'), glow: b('fsGlow'), glowIntensity: n('fsGlowIntensity'), animation: g('fsAnimation'), artSize: n('fsArtSize'), artRadius: n('fsArtRadius'), artFloat: b('fsArtFloat'), artGlow: b('fsArtGlow'), aiRing: b('fsAIRing'), particles: b('fsParticles'), visualizer: b('fsVisualizer'), titleSize: n('fsTitleSize'), titleWeight: g('fsTitleWeight'), titleColor: g('fsTitleColor'), artistSize: n('fsArtistSize'), artistColor: g('fsArtistColor'), showMovie: b('fsShowMovie'), showBadge: b('fsShowBadge'), showNowPlaying: b('fsShowNowPlaying'), playBtnSize: n('fsPlayBtnSize'), playBtnColor: g('fsPlayBtnColor'), btnSize: n('fsBtnSize'), btnColor: g('fsBtnColor'), showShuffle: b('fsShowShuffle'), showRepeat: b('fsShowRepeat'), progressH: n('fsProgressH'), progressColor: g('fsProgressColor'), progressBg: g('fsProgressBg'), showThumb: b('fsShowThumb'), thumbSize: n('fsThumbSize'), showTime: b('fsShowTime'), showFav: b('fsShowFav'), showLyrics: b('fsShowLyrics'), showQueue: b('fsShowQueue'), showShare: b('fsShowShare'), showAddPlaylist: b('fsShowAddPlaylist'), secBtnSize: n('fsSecBtnSize'), secBtnColor: g('fsSecBtnColor'), showVolume: b('fsShowVolume'), volumeWidth: n('fsVolumeWidth'), volumeColor: g('fsVolumeColor'), showMute: b('fsShowMute'), queueBg: g('fsQueueBg'), queueActive: g('fsQueueActive'), lyricsBg: g('fsLyricsBg'), lyricsActive: g('fsLyricsActive'), lyricsSize: n('fsLyricsSize'), showEq: b('fsShowEq'), eqCount: n('fsEqCount'), eqColor: g('fsEqColor'), eqWidth: n('fsEqWidth'), eqGap: n('fsEqGap'), showAIBot: b('fsShowAIBot'), mobileArtSize: n('fsMobileArtSize'), mobilePlayBtn: n('fsMobilePlayBtn'), mobileWave: b('fsMobileWave'), safeArea: n('fsSafeArea') }
    };
    applyPlayerSettings(preview);
    showToast('Preview applied â€” open live site to see changes', 'info');
}

function applyPlayerSettings(s) {
    if (!s) return;
    const bn = s.bn || PLAYER_DEFAULTS.bn;
    const mp = s.mp || PLAYER_DEFAULTS.mp;
    const fs = s.fs || PLAYER_DEFAULTS.fs;
    const root = document.documentElement;

    // Bottom Nav CSS Variables
    root.style.setProperty('--bn-visible', bn.visible ? 'flex' : 'none');
    root.style.setProperty('--bn-height', bn.height + 'px');
    root.style.setProperty('--bn-offset-with-player', bn.showWithPlayer ? bn.playerOffset + 'px' : '0px');
    root.style.setProperty('--bn-bg', bn.bgColor);
    root.style.setProperty('--bn-bg-opacity', bn.bgOpacity / 100);
    root.style.setProperty('--bn-blur', bn.blur + 'px');
    root.style.setProperty('--bn-border-color', bn.borderColor);
    root.style.setProperty('--bn-border-width', bn.borderWidth + 'px');
    root.style.setProperty('--bn-border-opacity', bn.borderOpacity / 100);
    root.style.setProperty('--bn-icon-size', bn.iconSize + 'px');
    root.style.setProperty('--bn-icon-color', bn.iconColor);
    root.style.setProperty('--bn-active-color', bn.activeColor);
    root.style.setProperty('--bn-label-size', bn.labelSize + 'px');
    root.style.setProperty('--bn-label-color', bn.labelColor);
    root.style.setProperty('--bn-active-label-color', bn.activeLabelColor);
    root.style.setProperty('--bn-indicator', bn.indicator);
    root.style.setProperty('--bn-indicator-color', bn.indicatorColor);
    root.style.setProperty('--bn-show-mobile', bn.showMobile ? 'flex' : 'none');
    root.style.setProperty('--bn-show-tablet', bn.showTablet ? 'flex' : 'none');
    root.style.setProperty('--bn-show-desktop', bn.showDesktop ? 'flex' : 'none');
    root.style.setProperty('--bn-safe-area', bn.safeArea + 'px');

    // Mini Player CSS Variables
    root.style.setProperty('--gp-mini-visible', mp.visible ? 'flex' : 'none');
    root.style.setProperty('--gp-mini-bottom', mp.bottomOffset + 'px');
    root.style.setProperty('--gp-mini-max-w', mp.maxWidth + 'px');
    root.style.setProperty('--gp-mini-margin', '0 auto');
    root.style.setProperty('--gp-mini-z', mp.zIndex);
    root.style.setProperty('--gp-mini-bg', `rgba(${hexToRgb(mp.bgColor)},${mp.bgOpacity / 100})`);
    root.style.setProperty('--gp-mini-blur', mp.blur + 'px');
    root.style.setProperty('--gp-mini-radius', mp.borderRadius + 'px');
    root.style.setProperty('--gp-mini-border', `${mp.borderWidth}px solid ${mp.borderColor}`);
    root.style.setProperty('--gp-mini-art-size', mp.artSize + 'px');
    root.style.setProperty('--gp-mini-art-radius', mp.artRadius + 'px');
    root.style.setProperty('--gp-mini-title-size', mp.titleSize + 'px');
    root.style.setProperty('--gp-mini-title-weight', mp.titleWeight);
    root.style.setProperty('--gp-mini-title-color', mp.titleColor);
    root.style.setProperty('--gp-mini-artist-size', mp.artistSize + 'px');
    root.style.setProperty('--gp-mini-artist-color', mp.artistColor);
    root.style.setProperty('--gp-mini-btn-size', mp.btnSize + 'px');
    root.style.setProperty('--gp-mini-btn-color', mp.btnColor);
    root.style.setProperty('--gp-mini-play-color', mp.playBtnColor);
    root.style.setProperty('--gp-mini-progress-h', mp.progressH + 'px');
    root.style.setProperty('--gp-mini-progress-color', mp.progressColor);
    root.style.setProperty('--gp-mini-progress-bg', mp.progressBg);
    root.style.setProperty('--gp-mini-thumb-size', mp.thumbSize + 'px');
    root.style.setProperty('--gp-mini-shadow', mp.shadow);

    // Show/hide elements via CSS classes
    root.style.setProperty('--gp-mini-show-art', mp.showArt ? 'flex' : 'none');
    root.style.setProperty('--gp-mini-show-eq', mp.showEq ? 'flex' : 'none');
    root.style.setProperty('--gp-mini-show-time', mp.showTime ? 'flex' : 'none');
    root.style.setProperty('--gp-mini-show-prev', mp.showPrev ? 'flex' : 'none');
    root.style.setProperty('--gp-mini-show-next', mp.showNext ? 'flex' : 'none');
    root.style.setProperty('--gp-mini-show-fav', mp.showFav ? 'flex' : 'none');
    root.style.setProperty('--gp-mini-show-expand', mp.showExpand ? 'flex' : 'none');
    root.style.setProperty('--gp-mini-show-wave', mp.showWave ? 'flex' : 'none');
    root.style.setProperty('--gp-mini-show-progress', mp.showProgress ? 'block' : 'none');
    root.style.setProperty('--gp-mini-show-np', mp.showNowPlaying ? 'flex' : 'none');

    // Full-Screen Player CSS Variables
    root.style.setProperty('--gp-fs-bg', `rgba(${hexToRgb(fs.bgColor)},${fs.bgOpacity / 100})`);
    root.style.setProperty('--gp-fs-blur', fs.blur + 'px');
    root.style.setProperty('--gp-fs-glow', fs.glow ? '1' : '0');
    root.style.setProperty('--gp-fs-glow-intensity', fs.glowIntensity / 100);
    root.style.setProperty('--gp-fs-art-size', fs.artSize + 'px');
    root.style.setProperty('--gp-fs-art-radius', fs.artRadius + 'px');
    root.style.setProperty('--gp-fs-art-float', fs.artFloat ? 'floating 6s ease-in-out infinite' : 'none');
    root.style.setProperty('--gp-fs-art-glow', fs.artGlow ? '1' : '0');
    root.style.setProperty('--gp-fs-ai-ring', fs.aiRing ? '1' : '0');
    root.style.setProperty('--gp-fs-particles', fs.particles ? '1' : '0');
    root.style.setProperty('--gp-fs-visualizer', fs.visualizer ? '1' : '0');
    root.style.setProperty('--gp-fs-title-size', fs.titleSize + 'px');
    root.style.setProperty('--gp-fs-title-weight', fs.titleWeight);
    root.style.setProperty('--gp-fs-title-color', fs.titleColor);
    root.style.setProperty('--gp-fs-artist-size', fs.artistSize + 'px');
    root.style.setProperty('--gp-fs-artist-color', fs.artistColor);
    root.style.setProperty('--gp-fs-play-size', fs.playBtnSize + 'px');
    root.style.setProperty('--gp-fs-play-color', fs.playBtnColor);
    root.style.setProperty('--gp-fs-btn-size', fs.btnSize + 'px');
    root.style.setProperty('--gp-fs-btn-color', fs.btnColor);
    root.style.setProperty('--gp-fs-progress-h', fs.progressH + 'px');
    root.style.setProperty('--gp-fs-progress-color', fs.progressColor);
    root.style.setProperty('--gp-fs-progress-bg', fs.progressBg);
    root.style.setProperty('--gp-fs-thumb-size', fs.thumbSize + 'px');
    root.style.setProperty('--gp-fs-sec-btn-size', fs.secBtnSize + 'px');
    root.style.setProperty('--gp-fs-sec-btn-color', fs.secBtnColor);
    root.style.setProperty('--gp-fs-volume-w', fs.volumeWidth + 'px');
    root.style.setProperty('--gp-fs-volume-color', fs.volumeColor);
    root.style.setProperty('--gp-fs-queue-bg', fs.queueBg);
    root.style.setProperty('--gp-fs-queue-active', fs.queueActive);
    root.style.setProperty('--gp-fs-lyrics-bg', fs.lyricsBg);
    root.style.setProperty('--gp-fs-lyrics-active', fs.lyricsActive);
    root.style.setProperty('--gp-fs-lyrics-size', fs.lyricsSize + 'px');
    root.style.setProperty('--gp-fs-eq-count', fs.eqCount);
    root.style.setProperty('--gp-fs-eq-color', fs.eqColor);
    root.style.setProperty('--gp-fs-eq-width', fs.eqWidth + 'px');
    root.style.setProperty('--gp-fs-eq-gap', fs.eqGap + 'px');
    root.style.setProperty('--gp-fs-safe-area', fs.safeArea + 'px');

    // Show/hide FS elements
    root.style.setProperty('--gp-fs-show-movie', fs.showMovie ? 'block' : 'none');
    root.style.setProperty('--gp-fs-show-badge', fs.showBadge ? 'inline-flex' : 'none');
    root.style.setProperty('--gp-fs-show-np-badge', fs.showNowPlaying ? 'inline-flex' : 'none');
    root.style.setProperty('--gp-fs-show-shuffle', fs.showShuffle ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-repeat', fs.showRepeat ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-thumb', fs.showThumb ? 'block' : 'none');
    root.style.setProperty('--gp-fs-show-time', fs.showTime ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-fav', fs.showFav ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-lyrics', fs.showLyrics ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-queue', fs.showQueue ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-share', fs.showShare ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-add-playlist', fs.showAddPlaylist ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-volume', fs.showVolume ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-mute', fs.showMute ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-eq', fs.showEq ? 'flex' : 'none');
    root.style.setProperty('--gp-fs-show-ai-bot', fs.showAIBot ? 'flex' : 'none');

    // Apply directly to GlobalPlayer elements if they exist
    const mini = document.getElementById('gp-mini');
    if (mini) {
        if (!mp.visible) mini.style.display = 'none'; else mini.style.display = '';
        mini.style.maxWidth = mp.maxWidth + 'px';
        mini.style.bottom = mp.bottomOffset + 'px';
        mini.style.borderRadius = mp.borderRadius + 'px';
        mini.style.zIndex = mp.zIndex;
        mini.style.background = `rgba(${hexToRgb(mp.bgColor)},${mp.bgOpacity / 100})`;
        mini.style.backdropFilter = mp.blur > 0 ? `blur(${mp.blur}px)` : '';
        mini.style.border = `${mp.borderWidth}px solid ${mp.borderColor}`;
    }

    const fsEl = document.getElementById('gp-expanded');
    if (fsEl) {
        fsEl.style.background = `rgba(${hexToRgb(fs.bgColor)},${fs.bgOpacity / 100})`;
        fsEl.style.backdropFilter = fs.blur > 0 ? `blur(${fs.blur}px)` : '';
    }

    // Apply to Bottom Nav
    const bnEl = document.querySelector('.tamilai-bottom-nav');
    if (bnEl) {
        bnEl.style.display = bn.visible ? '' : 'none';
        bnEl.style.height = bn.height + 'px';
        bnEl.style.background = `rgba(${hexToRgb(bn.bgColor)},${bn.bgOpacity / 100})`;
        bnEl.style.backdropFilter = bn.blur > 0 ? `blur(${bn.blur}px)` : '';
    }

    // Store for live site consumption
    try { localStorage.setItem('tamilAIStream_playerCSSVars', JSON.stringify({ bn, mp, fs })); } catch (e) { }
}

function hexToRgb(hex) {
    if (!hex) return '12,15,30';
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `${r},${g},${b}`;
}

// Player Settings Tab Switching
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.mp-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.mp-tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.mp-settings-panel').forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');
            var panelId = 'mp' + this.dataset.mptab.charAt(0).toUpperCase() + this.dataset.mptab.slice(1);
            var panel = document.getElementById(panelId);
            if (panel) panel.classList.add('active');
        });
    });
});

// Export functions for global access
if (typeof window !== 'undefined') {
    window.signInWithEmail = signInWithEmail;
    window.signUpWithEmail = signUpWithEmail;
    window.signInWithGoogle = signInWithGoogle;
    window.signInAsGuest = signInAsGuest;
    window.signOut = signOut;
    window.showToast = showToast;
    window.publishChanges = publishChanges;
    window.openEditArtistSongsModal = openEditArtistSongsModal;
    window.switchArtistSongTab = switchArtistSongTab;
    window.addSongToArtistCollection = addSongToArtistCollection;
    window.saveArtistSongs = saveArtistSongs;
    window.removeSongFromArtistCollection = removeSongFromArtistCollection;
    window.editArtistSongInCollection = editArtistSongInCollection;
    window.updateArtistName = updateArtistName;
    window.updateBulkRemoveBtn = updateBulkRemoveBtn;
    window.bulkRemoveSongsFromArtist = bulkRemoveSongsFromArtist;
        window.openAddCollectionModal = openAddCollectionModal;
    window.openEditCollectionModal = openEditCollectionModal;
    window.saveCollection = saveCollection;
    window.deleteCollection = deleteCollection;
    window.loadCollectionsTable = loadCollectionsTable;
    window.uploadFeaturedImage = uploadFeaturedImage;
    window.uploadTrendingImage = uploadTrendingImage;

    // Music Collections (inline form + modal)
    window.openAddCollectionModalMusic = openAddCollectionModalMusic;
    window.saveMusicCollection = saveMusicCollection;
    window.deleteMusicCollection = deleteMusicCollection;
    window.openEditCollectionModalMusic = openEditCollectionModalMusic;
    window.updateMusicCollection = updateMusicCollection;
    window.createCollectionFromForm = createCollectionFromForm;
    window.resetCollectionForm = resetCollectionForm;
    window.handleCollectionAudioUpload = handleCollectionAudioUpload;
    window.useGalleryImage = useGalleryImage;
    window.pickGalleryImage = pickGalleryImage;
    window.populateCollectionSongs = populateCollectionSongs;

    window.initVisualEditor = initVisualEditor;
    window.veSelectTreeItem = veSelectTreeItem;
    window.veSelectSection = veSelectSection;
    window.veSetProp = veSetProp;
    window.veApplyHTMLEdit = veApplyHTMLEdit;
    window.veToggleSectionVisibility = veToggleSectionVisibility;
    window.veDuplicateSection = veDuplicateSection;
    window.veMoveSection = veMoveSection;
    window.veEditSectionHTML = veEditSectionHTML;
    window.veDeleteSection = veDeleteSection;
    window.handleSectionAction = handleSectionAction;
    window.loadPlayerSettings = loadPlayerSettings;
    window.savePlayerSettings = savePlayerSettings;
    window.resetPlayerSettings = resetPlayerSettings;
    window.previewPlayerSettings = previewPlayerSettings;
    window.syncR2Songs = syncR2Songs;
    window.restoreAllR2Songs = restoreAllR2Songs;
    window.loadAllSongs = loadAllSongs;
    window.restoreFromTrash = restoreFromTrash;
    window.permanentDeleteFromTrash = permanentDeleteFromTrash;
    window.emptyTrash = emptyTrash;
    window.runTrashBotNow = runTrashBotNow;
    window.filterTrash = filterTrash;
    window.loadTrashPage = loadTrashPage;
    window.runSyncAudit = runSyncAudit;
    if (typeof initV2Enhancements === 'function') window.initV2Enhancements = initV2Enhancements;
    if (typeof showVEToast === 'function') window.showVEToast = showVEToast;
    if (typeof openVEPreview === 'function') window.openVEPreview = openVEPreview;
    if (typeof closeVEPreview === 'function') window.closeVEPreview = closeVEPreview;
}

// ============================================
// Trash Management
// ============================================
const TRASH_AUTO_DELETE_MS = 60 * 60 * 1000; // 1 hour
let _trashCurrentFilter = 'all';

function loadTrashPage() {
    runTrashBotNow();
    // If right panel is available, render there
    const panelBody = document.getElementById('rightPanelBody');
    if (panelBody) { _openTrashInRightPanel(); return; }
    renderTrashTable();
}

function renderTrashTable(filter) {
    const tbody = document.getElementById('trashTableBody');
    const emptyState = document.getElementById('trashEmptyState');
    const countEl = document.getElementById('trashTotalCount');
    const nextCleanupEl = document.getElementById('trashNextCleanup');
    if (!tbody) return;

    let trash = DataStore.getTrash();
    const now = Date.now();

    // Calculate next cleanup time
    if (nextCleanupEl) {
        const nextCleanup = trash.length > 0
            ? Math.min(...trash.map(t => {
                const trashedAt = t._trashedAt ? new Date(t._trashedAt).getTime() : 0;
                return trashedAt + TRASH_AUTO_DELETE_MS;
            }))
            : 0;
        if (nextCleanup > now) {
            const mins = Math.ceil((nextCleanup - now) / 60000);
            nextCleanupEl.textContent = mins + ' min';
        } else if (trash.length > 0) {
            nextCleanupEl.textContent = 'Overdue â€” cleaning now';
        } else {
            nextCleanupEl.textContent = '--';
        }
    }

    // Apply filter
    const activeFilter = filter || _trashCurrentFilter;
    _trashCurrentFilter = activeFilter;
    if (activeFilter !== 'all') {
        if (activeFilter === 'other') {
            const knownTypes = ['songs', 'stations', 'moods', 'featured', 'collections', 'artistHits', 'categories', 'quotes', 'aiRadio', 'notifications', 'musicCollections', 'advertisements', 'upcomingReleases', 'images', 'trending'];
            trash = trash.filter(t => !knownTypes.includes(t._trashType));
        } else {
            trash = trash.filter(t => t._trashType === activeFilter);
        }
    }

    if (countEl) countEl.textContent = DataStore.getTrash().length;

    if (!trash.length) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = trash.map(item => {
        const name = item.name || item.title || item.text || item._originalId || 'Unknown';
        const type = item._trashType || 'unknown';
        const trashedAt = item._trashedAt ? new Date(item._trashedAt) : null;
        const ageMs = trashedAt ? now - trashedAt.getTime() : 0;
        const remainingMs = Math.max(0, TRASH_AUTO_DELETE_MS - ageMs);
        const remainingMin = Math.ceil(remainingMs / 60000);
        const remainingStr = remainingMin > 60
            ? Math.floor(remainingMin / 60) + 'h ' + (remainingMin % 60) + 'm'
            : remainingMin + 'm';
        const urgencyClass = remainingMin < 15 ? 'color:#ef4444;' : remainingMin < 30 ? 'color:#f59e0b;' : '';
        const typeBadgeColors = {
            songs: '#34d399', stations: '#60a5fa', moods: '#a78bfa', featured: '#f472b6',
            collections: '#fbbf24', musicCollections: '#fbbf24', artistHits: '#fb923c',
            categories: '#38bdf8', quotes: '#94a3b8', aiRadio: '#c084fc',
            notifications: '#f97316', advertisements: '#ef4444', upcomingReleases: '#2dd4bf',
            images: '#67e8f9', trending: '#f59e0b'
        };
        const badgeColor = typeBadgeColors[type] || '#6b7280';

        return `<tr>
            <td><strong>${name}</strong></td>
            <td><span class="builder-badge" style="background:${badgeColor}22;color:${badgeColor};">${type}</span></td>
            <td style="font-size:12px;color:rgba(255,255,255,0.5);">${trashedAt ? trashedAt.toLocaleString() : 'â€”'}</td>
            <td style="font-size:12px;${urgencyClass}"><strong>${remainingStr}</strong></td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="builder-btn small" onclick="restoreFromTrash('${item._originalId}', '${type}')" title="Restore"><i class="fas fa-undo"></i></button>
                    <button class="builder-btn small danger" onclick="permanentDeleteFromTrash('${item._originalId}', '${type}')" title="Delete Forever"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterTrash(type) {
    // Update active tab styling
    document.querySelectorAll('.trash-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === type);
    });
    // Filter right panel trash table rows
    const tbody = document.querySelector('#rightPanelBody #trashTableBody') || document.getElementById('trashTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr[data-type]').forEach(row => {
        row.style.display = (type === 'all' || row.dataset.type === type) ? '' : 'none';
    });
}

function restoreFromTrash(originalId, type) {
    const cleanItem = DataStore.restoreFromTrash(originalId, type);
    if (!cleanItem) { showToast('Item not found in Trash', 'error'); return; }

    // Re-add to the appropriate content store using RAW data
    const rawKeyMap = {
        songs: 'tamilAIStream_songs', stations: 'tamilAIStream_stations',
        categories: 'tamilAIStream_categories', featured: 'tamilAIStream_featured',
        trending: 'tamilAIStream_trending', artistHits: 'tamilAIStream_artistHits',
        quotes: 'tamilAIStream_quotes', moods: 'tamilAIStream_moods',
        aiRadio: 'tamilAIStream_aiRadio', notifications: 'tamilAIStream_notifications',
        images: 'tamilAIStream_images', musicCollections: 'tamilAIStream_musicCollections',
        advertisements: 'tamilAIStream_advertisements', upcomingReleases: 'tamilAIStream_upcomingReleases'
    };
    const rawKey = rawKeyMap[type];
    if (rawKey) {
        const raw = DataStore._getRaw(rawKey) || [];
        if (!raw.find(s => s.id === originalId)) {
            raw.push(cleanItem);
            localStorage.setItem(rawKey, JSON.stringify(raw));
        }
    }

    showToast('Item restored from Trash', 'success');
    // Refresh right panel if open
    const panel = document.getElementById('rightPanelBody');
    if (panel && panel.querySelector('#trashTableBody')) _openTrashInRightPanel();
    syncToLiveWebsite();
}

function permanentDeleteFromTrash(originalId, type) {
    if (!confirm('Permanently delete this item? This cannot be undone.')) return;
    DataStore.permanentDeleteFromTrash(originalId, type);
    showToast('Item permanently deleted', 'success');
    // Refresh right panel if open
    const panel = document.getElementById('rightPanelBody');
    if (panel && panel.querySelector('#trashTableBody')) { _openTrashInRightPanel(); }
    else { renderTrashTable(); }
    syncToLiveWebsite();
}

function emptyTrash() {
    if (!confirm('Permanently delete ALL items in Trash? This cannot be undone.')) return;
    DataStore.setTrash([]);
    DataStore.setDeletedIds({});
    showToast('Trash emptied', 'success');
    // Refresh right panel if open
    const panel = document.getElementById('rightPanelBody');
    if (panel && panel.querySelector('#trashTableBody')) { _openTrashInRightPanel(); }
    else { renderTrashTable(); }
    syncToLiveWebsite();
}

function runTrashBotNow() {
    const purged = DataStore.purgeExpiredTrash(TRASH_AUTO_DELETE_MS);
    if (purged > 0) {
        showToast(`Trash Bot auto-deleted ${purged} expired item${purged > 1 ? 's' : ''}`, 'success');
        syncToLiveWebsite();
    }
    // Update next cleanup display
    renderTrashTable();
}

// Auto-run Trash Bot every 5 minutes while Builder is open
(function startTrashBot() {
    setInterval(() => {
        try {
            if (typeof DataStore !== 'undefined' && DataStore.getTrash) {
                runTrashBotNow();
            }
        } catch (e) { /* ignore */ }
    }, 5 * 60 * 1000);
})();

// ============================================
// Sync Audit / Content Sync Analysis
// ============================================
function runSyncAudit() {
    const results = document.getElementById('syncAuditResults');
    const lastSyncedEl = document.getElementById('syncLastSynced');
    const trashCountEl = document.getElementById('syncTrashCount');
    const deletedCountEl = document.getElementById('syncDeletedCount');
    if (!results) return;

    const lastSynced = localStorage.getItem('tamilAIStream_lastSyncedAt');
    if (lastSyncedEl) lastSyncedEl.textContent = lastSynced ? new Date(lastSynced).toLocaleString() : 'Never';

    const trash = DataStore.getTrash();
    if (trashCountEl) trashCountEl.textContent = trash.length;

    const deletedIds = DataStore.getDeletedIds();
    let totalDeleted = 0;
    Object.values(deletedIds).forEach(ids => { if (Array.isArray(ids)) totalDeleted += ids.length; });
    if (deletedCountEl) deletedCountEl.textContent = totalDeleted;

    // Build audit data
    const contentTypes = [
        { key: 'songs', label: 'Songs', getter: () => DataStore.getSongs() },
        { key: 'stations', label: 'Radio Stations', getter: () => DataStore.getStations() },
        { key: 'moods', label: 'Moods & Genres', getter: () => DataStore.getMoods() },
        { key: 'featured', label: 'Featured', getter: () => DataStore.getFeatured() },
        { key: 'trending', label: 'Trending', getter: () => DataStore.getTrending() },
        { key: 'categories', label: 'Categories', getter: () => DataStore.getCategories() },
        { key: 'artistHits', label: 'Artist Hits', getter: () => DataStore.getArtistHits() },
        { key: 'quotes', label: 'Quotes', getter: () => DataStore.getQuotes() },
        { key: 'aiRadio', label: 'AI Radio', getter: () => DataStore.getAIRadio() },
        { key: 'notifications', label: 'Notifications', getter: () => DataStore.getNotifications() },
        { key: 'musicCollections', label: 'Music Collections', getter: () => DataStore.getMusicCollections() },
        { key: 'moviesCollections', label: 'Movies Collections', getter: () => DataStore.getMoviesCollections() },
        { key: 'yearlyCollections', label: 'Yearly Collections', getter: () => DataStore.getYearlyCollections() },
        { key: 'latestCollections', label: 'Latest Collections', getter: () => DataStore.getLatestCollections() },
        { key: 'advertisements', label: 'Advertisements', getter: () => DataStore.getAdvertisements() },
        { key: 'upcomingReleases', label: 'Upcoming Releases', getter: () => DataStore.getUpcomingReleases() },
        { key: 'images', label: 'Images', getter: () => DataStore.getImages() }
    ];

    let totalItems = 0;
    let totalTrashed = 0;
    let totalDeletedTracked = 0;
    const rows = [];

    contentTypes.forEach(ct => {
        const items = ct.getter();
        const count = Array.isArray(items) ? items.length : 0;
        const trashedCount = trash.filter(t => t._trashType === ct.key).length;
        const deletedCount = deletedIds[ct.key] ? deletedIds[ct.key].length : 0;
        totalItems += count;
        totalTrashed += trashedCount;
        totalDeletedTracked += deletedCount;

        const statusIcon = count > 0 ? '<i class="fas fa-circle-check" style="color:#34d399;"></i>'
            : deletedCount > 0 ? '<i class="fas fa-circle-minus" style="color:#f59e0b;"></i>'
            : '<i class="fas fa-circle" style="color:#6b7280;"></i>';

        rows.push(`
            <tr>
                <td>${statusIcon} ${ct.label}</td>
                <td><strong>${count}</strong></td>
                <td>${trashedCount > 0 ? '<span style="color:#f59e0b;">' + trashedCount + '</span>' : '0'}</td>
                <td>${deletedCount > 0 ? '<span style="color:#ef4444;">' + deletedCount + '</span>' : '0'}</td>
                <td style="color:#34d399;">Synced</td>
            </tr>
        `);
    });

    // Render KPIs
    const kpiEl = document.getElementById('syncAuditKPI');
    if (kpiEl) {
        kpiEl.innerHTML = `
            <div class="analytics-kpi">
                <div class="analytics-kpi-icon" style="background:rgba(52,211,153,0.15);"><i class="fas fa-database"></i></div>
                <div class="analytics-kpi-info"><div class="analytics-kpi-value">${totalItems}</div><div class="analytics-kpi-label">Total Items</div></div>
            </div>
            <div class="analytics-kpi">
                <div class="analytics-kpi-icon" style="background:rgba(96,165,250,0.15);"><i class="fas fa-check-circle"></i></div>
                <div class="analytics-kpi-info"><div class="analytics-kpi-value">${contentTypes.filter(ct => ct.getter().length > 0).length}</div><div class="analytics-kpi-label">Active Content Types</div></div>
            </div>
            <div class="analytics-kpi">
                <div class="analytics-kpi-icon" style="background:rgba(245,158,11,0.15);"><i class="fas fa-trash-can-arrow-up"></i></div>
                <div class="analytics-kpi-info"><div class="analytics-kpi-value">${totalTrashed}</div><div class="analytics-kpi-label">In Trash</div></div>
            </div>
            <div class="analytics-kpi">
                <div class="analytics-kpi-icon" style="background:rgba(239,68,68,0.15);"><i class="fas fa-ban"></i></div>
                <div class="analytics-kpi-info"><div class="analytics-kpi-value">${totalDeletedTracked}</div><div class="analytics-kpi-label">Deleted IDs Tracked</div></div>
            </div>
            <div class="analytics-kpi">
                <div class="analytics-kpi-icon" style="background:rgba(167,139,250,0.15);"><i class="fas fa-rocket"></i></div>
                <div class="analytics-kpi-info"><div class="analytics-kpi-value">Live</div><div class="analytics-kpi-label">Publish Status</div></div>
            </div>
        `;
    }

    results.innerHTML = `
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>Content Type</th>
                    <th>Builder Items</th>
                    <th>In Trash</th>
                    <th>Deleted IDs</th>
                    <th>Website Sync</th>
                </tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
        </table>
        <div style="margin-top:16px;padding:12px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);">
            <strong style="color:#34d399;"><i class="fas fa-circle-check"></i> Single Source of Truth</strong>
            <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px;">
                Builder â†’ localStorage â†’ R2 Manifest â†’ Live Website. All deletions are tracked via deletedIds and respected during sync.
                Deleted items move to Trash first (1 hour retention). Changes persist across refresh, logout, and reopening.
            </p>
        </div>
    `;
}

// ============================================
// AI Bot Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof AICommandBot !== 'undefined') {
        AICommandBot.createBotUI();
    }
});

// ============================================
// Duplicate Scan Helper
// ============================================
const AIDuplicateScan = {
    run() {
        const songs = DataStore.getSongs();
        if (songs.length === 0) {
            showToast('No songs to scan', 'info');
            return;
        }

        showToast('Scanning for duplicates...', 'info');

        const dupes = [];
        for (let i = 0; i < songs.length; i++) {
            for (let j = i + 1; j < songs.length; j++) {
                const result = AIAutomation.detectDuplicates(songs[i], [songs[j]]);
                if (result.length > 0) {
                    dupes.push({
                        a: songs[i],
                        b: songs[j],
                        score: result[0].score
                    });
                }
            }
        }

        if (dupes.length === 0) {
            showToast('No duplicates found! Library is clean.', 'success');
            return;
        }

        let msg = 'Found ' + dupes.length + ' duplicate pairs:\n\n';
        for (const d of dupes.slice(0, 8)) {
            msg += '- "' + d.a.title + '" by ' + d.a.artist + '  â†”  "' + d.b.title + '" by ' + d.b.artist + ' (' + d.score + '% match)\n';
        }
        if (dupes.length > 8) msg += '\n... and ' + (dupes.length - 8) + ' more';

        alert(msg);
        showToast('Found ' + dupes.length + ' duplicate pairs', 'warning');
    }
};
if (typeof window !== 'undefined') window.AIDuplicateScan = AIDuplicateScan;

// ============================================
// Application Builder — Mobile App Configuration
// ============================================
const AppBuilder = (() => {
    let _settings = {};
    let _changeCount = 0;
    let _aiLogEl = null;
    let _debounceTimers = {};

    const DEFAULTS = {
        appName: 'Tamil AI Stream',
        shortName: 'TAIS',
        description: 'Tamil music streaming app with AI-powered recommendations',
        version: '1.0.0',
        packageName: 'com.tamilaistream.app',
        websiteUrl: window.location.origin,
        icon: '',
        splashLogo: '',
        favicon: '',
        maskableIcon: '',
        splashEnabled: 'true',
        splashDuration: 2500,
        splashBgColor: '#080c1c',
        splashAnimation: 'fade',
        splashLoadingBar: 'true',
        splashShowName: 'true',
        themeMode: 'dark',
        primaryColor: '#22d3ee',
        accentColor: '#34d399',
        bgColor: '#080c1c',
        statusBarStyle: 'dark',
        navBarColor: '#0a0e1a',
        homeStyle: 'standard',
        showHero: 'true',
        showFm: 'true',
        showRecent: 'true',
        showAiRec: 'true',
        showPlaylists: 'true',
        navHome: 'true',
        navFm: 'true',
        navMusic: 'true',
        navSearch: 'true',
        navAccount: 'true',
        navStyle: 'icons',
        fullScreenPlayer: 'true',
        bgAudio: 'true',
        lockScreenControls: 'true',
        miniPlayer: 'true',
        sleepTimer: 'true',
        audioQuality: 'auto',
        notifications: 'true',
        newReleaseAlert: 'true',
        recPush: 'true',
        fmAlert: 'true',
        loginEnabled: 'true',
        googleLogin: 'true',
        emailLogin: 'true',
        guestMode: 'true',
        allowDownloads: 'false',
        offlineMode: 'true',
        shareButton: 'true',
        analytics: 'true',
        cacheStrategy: 'aggressive',
        autoUpdate: 'true',
        safeArea: 'true',
        statusBarOverlay: 'true',
        landscape: 'portrait',
        tabletLayout: 'responsive',
        haptic: 'true',
        gestures: 'true',
        aiOptimizeImages: 'true',
        aiSmartCache: 'true',
        aiAutoApply: 'true',
        aiPerfMonitor: 'true',
        aiContentSync: 'true',
        aiUpdateFreq: 'realtime'
    };

    function init() {
        _settings = { ...DEFAULTS, ...DataStore.getApplication() };
        _aiLogEl = document.getElementById('appAiBotLog');
        _bindFieldListeners();
        _updateBuildStatus();
        _renderBuildHistory();
    }

    function _bindFieldListeners() {
        document.querySelectorAll('[data-app-field]').forEach(el => {
            const handler = (e) => {
                const field = e.target.dataset.appField;
                let value = e.target.type === 'file' ? '' : e.target.value;
                if (e.target.type === 'file' && e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        value = ev.target.result;
                        _settings[field] = value;
                        _onFieldChanged(field, value);
                        _updateIconPreview(field, value);
                    };
                    reader.readAsDataURL(e.target.files[0]);
                    return;
                }
                _settings[field] = value;
                _onFieldChanged(field, value);
            };
            el.addEventListener('change', handler);
            if (el.type !== 'file') {
                el.addEventListener('input', debounce(handler, 500));
            }
        });
    }

    function debounce(fn, delay) {
        return function(...args) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function _onFieldChanged(field, value) {
        _changeCount++;
        document.getElementById('appChangesCount').textContent = _changeCount;
        _aiLog(`Setting "${field}" updated → ${typeof value === 'string' && value.length > 50 ? value.slice(0, 50) + '...' : value}`, 'info');
        _applyToManifest();
    }

    function _updateIconPreview(field, value) {
        const map = {
            icon: 'appIconPreview',
            splashLogo: 'appSplashLogoPreview',
            favicon: 'appFaviconPreview',
            maskableIcon: 'appMaskablePreview'
        };
        const previewId = map[field];
        if (!previewId || !value) return;
        const el = document.getElementById(previewId);
        if (el) el.innerHTML = '<img src="' + value + '" alt="Preview">';
    }

    function _aiLog(msg, type) {
        if (!_aiLogEl) return;
        const cls = type || '';
        _aiLogEl.innerHTML += '<div class="app-bot-msg ' + cls + '">' + msg + '</div>';
        _aiLogEl.scrollTop = _aiLogEl.scrollHeight;
    }

    function _applyToManifest() {
        try {
            const manifest = {
                name: _settings.appName,
                short_name: _settings.shortName,
                description: _settings.description,
                start_url: _settings.websiteUrl || window.location.origin,
                display: 'standalone',
                orientation: _settings.landscape === 'both' ? 'any' : 'portrait',
                background_color: _settings.bgColor,
                theme_color: _settings.primaryColor,
                icons: [],
                categories: ['music', 'entertainment']
            };
            if (_settings.icon) manifest.icons.push({ src: _settings.icon, sizes: '512x512', type: 'image/png', purpose: 'any' });
            if (_settings.maskableIcon) manifest.icons.push({ src: _settings.maskableIcon, sizes: '512x512', type: 'image/png', purpose: 'maskable' });
            if (_settings.favicon) manifest.icons.push({ src: _settings.favicon, sizes: '192x192', type: 'image/png' });

            const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            let link = document.querySelector('link[rel="manifest"]');
            if (link) {
                URL.revokeObjectURL(link.href);
                link.href = url;
            } else {
                link = document.createElement('link');
                link.rel = 'manifest';
                link.href = url;
                document.head.appendChild(link);
            }
            _aiLog('Manifest applied dynamically', 'success');
        } catch (e) {
            _aiLog('Manifest apply error: ' + e.message, 'warning');
        }
    }

    function _updateBuildStatus() {
        const saved = DataStore.getApplication();
        document.getElementById('appLastSaved').textContent = saved._lastSaved ? new Date(saved._lastSaved).toLocaleString() : 'Never';
        document.getElementById('appLastPublished').textContent = saved._lastPublished ? new Date(saved._lastPublished).toLocaleString() : 'Never';
        document.getElementById('appLastBuild').textContent = saved._lastBuild ? new Date(saved._lastBuild).toLocaleString() : 'Never';
        document.getElementById('appDraftStatus').textContent = saved._hasDraft ? 'Draft exists' : 'No draft';
    }

    function loadApplicationSettings() {
        _settings = { ...DEFAULTS, ...DataStore.getApplication() };
        document.querySelectorAll('[data-app-field]').forEach(el => {
            const field = el.dataset.appField;
            if (_settings[field] !== undefined && el.type !== 'file') {
                el.value = _settings[field];
            }
        });
        document.querySelectorAll('[data-app-field][type="file"]').forEach(el => {
            const field = el.dataset.appField;
            if (_settings[field]) {
                _updateIconPreview(field, _settings[field]);
            }
        });
        _updateBuildStatus();
        _renderBuildHistory();
        _changeCount = 0;
        document.getElementById('appChangesCount').textContent = '0';
    }

    function saveApplicationSettings() {
        _settings._lastSaved = new Date().toISOString();
        _settings._hasDraft = false;
        DataStore.setApplication(_settings);
        _aiLog('Settings saved to storage', 'success');
        showToast('Application settings saved', 'success');
        _updateBuildStatus();
        syncToLiveWebsite();
    }

    function preview() {
        _aiLog('Generating preview...', 'info');
        const params = new URLSearchParams();
        Object.entries(_settings).forEach(([k, v]) => {
            if (k.startsWith('_') || !v) return;
            params.set(k, v);
        });
        const previewUrl = (_settings.websiteUrl || window.location.origin) + '?appPreview=1&' + params.toString();
        window.open(previewUrl, '_blank', 'width=400,height=800');
        _aiLog('Preview opened in new window', 'success');
        showToast('Preview opened', 'info');
    }

    function saveDraft() {
        _settings._hasDraft = true;
        _settings._lastSaved = new Date().toISOString();
        DataStore.setApplication(_settings);
        _aiLog('Draft saved', 'success');
        showToast('Draft saved', 'success');
        _updateBuildStatus();
    }

    function publish() {
        _aiLog('Publishing application...', 'info');
        _settings._lastPublished = new Date().toISOString();
        _settings._hasDraft = false;
        DataStore.setApplication(_settings);

        // Generate and inject manifest
        _applyToManifest();

        // Generate splash screen config
        _generateSplashConfig();

        // Generate service worker config
        _generateSWConfig();

        _aiLog('Application published successfully', 'success');
        showToast('Application published!', 'success');
        _updateBuildStatus();
        syncToLiveWebsite();
    }

    function buildApp() {
        _aiLog('Starting Android build pipeline...', 'info');
        _showBuildStatus('preparing');

        const buildId = 'build_' + Date.now();
        const buildNumber = (DataStore.getApplication()._buildCount || 0) + 1;

        setTimeout(() => {
            _aiLog('Collecting application settings...', 'info');
            _showBuildStatus('preparing', 'Collecting settings...');

            const config = {
                settings: { ..._settings },
                buildId,
                buildNumber,
                buildTime: new Date().toISOString(),
                version: _settings.version || '1.0.0',
                packageName: _settings.packageName || 'com.tamilaistream.app',
                appName: _settings.appName || 'Tamil AI Stream'
            };

            setTimeout(() => {
                _aiLog('Generating Capacitor Android project...', 'info');
                _showBuildStatus('building', 'Generating Android project files...');

                const files = _generateCapacitorProject(config);

                setTimeout(() => {
                    _aiLog('Packaging Android project...', 'info');
                    _showBuildStatus('packaging', 'Creating downloadable archive...');

                    setTimeout(() => {
                        const zipBlob = _createZip(files);
                        const zipUrl = URL.createObjectURL(zipBlob);
                        const a = document.createElement('a');
                        a.href = zipUrl;
                        a.download = (config.appName.replace(/[^a-zA-Z0-9]/g, '') || 'TamilAIStream') + '-android-' + config.version + '-b' + buildNumber + '.zip';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(zipUrl);

                        const buildRecord = {
                            id: buildId,
                            number: buildNumber,
                            appName: config.appName,
                            version: config.version,
                            buildNumber: buildNumber,
                            date: config.buildTime,
                            status: 'completed',
                            packageName: config.packageName,
                            settings: { ..._settings }
                        };

                        _saveBuildHistory(buildRecord);
                        _settings._lastBuild = config.buildTime;
                        _settings._buildCount = buildNumber;
                        DataStore.setApplication(_settings);

                        _aiLog('Android project built successfully!', 'success');
                        _aiLog('Build #' + buildNumber + ' — ' + config.appName + ' v' + config.version, 'success');
                        _aiLog('To generate APK: extract zip → install Android Studio → open project → Build → Build APK', 'info');
                        _aiLog('Or use GitHub Actions: push to repo → workflow builds APK/AAB automatically', 'info');
                        _showBuildStatus('completed', 'Build #' + buildNumber + ' ready!');
                        showToast('Android build completed! Download started.', 'success');
                        _updateBuildStatus();
                    }, 600);
                }, 800);
            }, 700);
        }, 400);
    }

    function _showBuildStatus(stage, detail) {
        const el = document.getElementById('appBuildProgress');
        if (!el) return;
        const stages = ['preparing', 'building', 'packaging', 'completed'];
        const labels = ['Preparing', 'Building', 'Packaging', 'Completed'];
        const icons = ['fa-spinner fa-spin', 'fa-hammer', 'fa-box-archive', 'fa-check-circle'];
        const currentIdx = stages.indexOf(stage);

        let html = '<div class="build-progress-bar">';
        stages.forEach((s, i) => {
            const cls = i < currentIdx ? 'done' : i === currentIdx ? 'active' : '';
            html += '<div class="build-stage ' + cls + '"><div class="build-stage-dot"><i class="fas ' + (i <= currentIdx ? icons[i] : 'fa-circle') + '"></i></div><span>' + labels[i] + '</span></div>';
        });
        html += '</div>';
        if (detail) html += '<div class="build-detail">' + detail + '</div>';
        el.innerHTML = html;
    }

    function _saveBuildHistory(build) {
        let history = [];
        try { history = JSON.parse(localStorage.getItem('tais_build_history') || '[]'); } catch(e) {}
        history.unshift(build);
        if (history.length > 20) history = history.slice(0, 20);
        localStorage.setItem('tais_build_history', JSON.stringify(history));
        _renderBuildHistory();
    }

    function _renderBuildHistory() {
        const el = document.getElementById('appBuildHistory');
        if (!el) return;
        let history = [];
        try { history = JSON.parse(localStorage.getItem('tais_build_history') || '[]'); } catch(e) {}

        if (history.length === 0) {
            el.innerHTML = '<div class="build-history-empty"><i class="fas fa-box-archive"></i><p>No builds yet. Click "Build Application" to create your first Android build.</p></div>';
            return;
        }

        let html = '';
        history.forEach(b => {
            const d = new Date(b.date);
            const dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const statusCls = b.status === 'completed' ? 'success' : b.status === 'failed' ? 'failed' : 'pending';
            html += '<div class="build-history-item">' +
                '<div class="build-history-left">' +
                    '<div class="build-history-num">#' + b.buildNumber + '</div>' +
                    '<div class="build-history-info">' +
                        '<strong>' + (b.appName || 'App') + '</strong> v' + (b.version || '1.0.0') +
                        '<span class="build-history-date">' + dateStr + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="build-history-right">' +
                    '<span class="build-status-badge ' + statusCls + '">' + (b.status || 'completed') + '</span>' +
                '</div>' +
            '</div>';
        });
        el.innerHTML = html;
    }

    function _generateCapacitorProject(config) {
        const s = config.settings;
        const files = {};

        files['package.json'] = JSON.stringify({
            name: (s.shortName || 'tamilaistream').toLowerCase().replace(/[^a-z0-9]/g, ''),
            version: config.version,
            description: s.description || 'Tamil AI Music Streaming Application',
            main: 'index.js',
            scripts: {
                start: 'cap run android',
                build: 'cap sync && cap open android',
                android: 'cap open android',
                sync: 'cap sync'
            },
            dependencies: {
                '@capacitor/android': '^5.6.0',
                '@capacitor/app': '^5.6.0',
                '@capacitor/core': '^5.6.0',
                '@capacitor/haptics': '^5.6.0',
                '@capacitor/keyboard': '^5.6.0',
                '@capacitor/status-bar': '^5.6.0',
                '@capacitor/splash-screen': '^5.6.0',
                '@capacitor/local-notifications': '^5.6.0',
                '@capacitor/push-notifications': '^5.6.0',
                '@capacitor/browser': '^5.6.0',
                '@capacitor/share': '^5.6.0',
                '@capacitor/screen-reader': '^5.6.0'
            },
            devDependencies: {
                '@capacitor/cli': '^5.6.0',
                '@nicepkg/gpt-runner': '^2.0.0'
            }
        }, null, 2);

        files['capacitor.config.ts'] = `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${config.packageName}',
  appName: ${JSON.stringify(config.appName)},
  webDir: 'www',
  server: {
    androidScheme: 'https',
    url: ${JSON.stringify(s.websiteUrl || 'https://tamilaistream.com')},
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: ${s.splashEnabled === 'true'},
      launchShowDuration: ${parseInt(s.splashDuration) || 2500},
      backgroundColor: ${JSON.stringify(s.splashBgColor || '#080c1c')},
      showSpinner: true,
      spinnerColor: ${JSON.stringify(s.primaryColor || '#22d3ee')},
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
      launchFadeOutDuration: 300
    },
    StatusBar: {
      style: ${JSON.stringify(s.statusBarStyle === 'light' ? 'LIGHT' : 'DARK')},
      backgroundColor: ${JSON.stringify(s.navBarColor || '#0a0e1a')},
      overlaysWebView: ${s.statusBarOverlay === 'true'}
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: ${JSON.stringify(s.primaryColor || '#22d3ee')}
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  },
  android: {
    allowMixedContent: true,
    backgroundColor: ${JSON.stringify(s.bgColor || '#080c1c')},
    buildOptions: {
      keystorePath: null,
      keystoreAlias: null
    }
  }
};

export default config;
`;

        files['package-lock.json'] = '{}';

        files['www/index.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
    <meta name="theme-color" content="${s.primaryColor || '#22d3ee'}">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>${config.appName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${s.bgColor || '#080c1c'}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        #app { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center;
            flex-direction: column; gap: 16px; color: rgba(255,255,255,0.8); }
        .logo { width: 80px; height: 80px; border-radius: 20px;
            background: linear-gradient(135deg, ${s.primaryColor || '#22d3ee'}, ${s.accentColor || '#34d399'});
            display: flex; align-items: center; justify-content: center; font-size: 36px; color: white;
            box-shadow: 0 8px 32px rgba(34,211,238,0.3); }
        .name { font-size: 18px; font-weight: 700; color: white; }
        .sub { font-size: 13px; color: rgba(255,255,255,0.5); }
        .spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1);
            border-top-color: ${s.primaryColor || '#22d3ee'}; border-radius: 50%; animation: spin 0.8s linear infinite; margin-top: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ${s.splashEnabled === 'true' ? `
        #splash { position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center;
            justify-content: center; flex-direction: column; gap: 20px;
            background: ${s.splashBgColor || '#080c1c'}; transition: opacity 0.4s ease; }
        #splash.hide { opacity: 0; pointer-events: none; }` : ''}
    </style>
</head>
<body>
    ${s.splashEnabled === 'true' ? `<div id="splash"><div class="logo">&#9654;</div><div class="name">${config.appName}</div></div>` : ''}
    <div id="app">
        <div class="logo">&#9654;</div>
        <div class="name">${config.appName}</div>
        <div class="sub">Loading your music...</div>
        <div class="spinner"></div>
    </div>
    <script type="module" src="main.js"></script>
</body>
</html>`;

        files['www/main.js'] = `import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const WEBSITE_URL = ${JSON.stringify(s.websiteUrl || 'https://tamilaistream.com')};
const APP_NAME = ${JSON.stringify(config.appName)};

class TamilAIStreamApp {
    constructor() {
        this.iframe = null;
        this.init();
    }

    async init() {
        if (Capacitor.isNativePlatform()) {
            await this.setupNative();
        }
        this.loadWebsite();
        this.setupListeners();
    }

    async setupNative() {
        try {
            await StatusBar.setStyle({ style: Style.${s.statusBarStyle === 'light' ? 'Light' : 'Dark'} });
            await StatusBar.setBackgroundColor({ color: ${JSON.stringify(s.navBarColor || '#0a0e1a')} });
        } catch(e) {}

        try {
            if (${s.haptic === 'true'}) {
                await Haptics.impact({ style: ImpactStyle.Light });
            }
        } catch(e) {}
    }

    loadWebsite() {
        const container = document.getElementById('app');
        container.innerHTML = '';

        this.iframe = document.createElement('iframe');
        this.iframe.src = WEBSITE_URL;
        this.iframe.style.cssText = 'width:100%;height:100%;border:none;position:fixed;inset:0;';
        this.iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
        this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms allow-modals');
        document.body.appendChild(this.iframe);

        ${s.splashEnabled === 'true' ? `
        setTimeout(() => {
            SplashScreen.hide();
            const splash = document.getElementById('splash');
            if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 500); }
        }, ${parseInt(s.splashDuration) || 2500});` : `SplashScreen.hide();`}
    }

    setupListeners() {
        App.addListener('appStateChange', ({ isActive }) => {
            if (this.iframe && this.iframe.contentWindow) {
                this.iframe.contentWindow.postMessage({ type: 'appStateChange', isActive }, '*');
            }
        });

        App.addListener('backButton', ({ canGoBack }) => {
            if (this.iframe && this.iframe.contentWindow) {
                this.iframe.contentWindow.postMessage({ type: 'backButton' }, '*');
            }
        });

        App.addListener('appUrlOpen', (data) => {
            console.log('App opened via URL:', data.url);
        });

        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'haptic') {
                Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            }
        });
    }
}

new TamilAIStreamApp();
`;

        files['www/capacitor.plugins.json'] = JSON.stringify({
            "plugins": {
                "@capacitor/app": {},
                "@capacitor/haptics": {},
                "@capacitor/keyboard": {},
                "@capacitor/status-bar": {},
                "@capacitor/splash-screen": {},
                "@capacitor/local-notifications": {},
                "@capacitor/push-notifications": {},
                "@capacitor/browser": {},
                "@capacitor/share": {}
            }
        }, null, 2);

        files['android/app/src/main/AndroidManifest.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${config.packageName}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    ${s.allowDownloads === 'true' ? '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />' : ''}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${config.appName}"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/AppTheme"
        android:networkSecurityConfig="@xml/network_security_config">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:theme="@style/AppTheme.Splash">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${config.packageName}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
`;

        files['android/app/src/main/res/values/styles.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:style/Theme.DeviceDefault.NoActionBar">
        <item name="android:editTextBackground">@drawable/ripple</item>
        <item name="android:windowBackground">${s.bgColor || '#080c1c'}</item>
        <item name="android:navigationBarColor">${s.navBarColor || '#0a0e1a'}</item>
        <item name="android:statusBarColor">${s.navBarColor || '#0a0e1a'}</item>
        <item name="android:windowLightStatusBar">${s.statusBarStyle === 'light' ? 'true' : 'false'}</item>
    </style>
    <style name="AppTheme.Splash" parent="AppTheme">
        <item name="android:windowBackground">@drawable/splash</item>
    </style>
</resources>
`;

        files['android/app/src/main/res/drawable/splash.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="${s.splashBgColor || '#080c1c'}" />
</layer-list>
`;

        files['android/app/src/main/res/drawable/ripple.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<ripple xmlns:android="http://schemas.android.com/apk/res/android"
    android:color="#22d3ee">
    <item android:id="@android:id/mask" android:drawable="@android:color/white" />
</ripple>
`;

        files['android/app/src/main/res/xml/network_security_config.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">${(s.websiteUrl || 'tamilaistream.com').replace('https://', '').replace('http://', '')}</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

        files['android/app/src/main/res/xml/file_paths'] = `<?xml version="1.0" encoding="utf-8"?>
<paths>
    <external-path name="external_files" path="." />
    <cache-path name="cache" path="." />
</paths>
`;

        files['android/app/src/main/java/com/tamilaistream/app/MainActivity.java'] = `package com.tamilaistream.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
`;

        files['android/build.gradle'] = `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.1.1'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`;

        files['android/app/build.gradle'] = `apply plugin: 'com.android.application'

android {
    namespace "${config.packageName}"
    compileSdkVersion 34
    defaultConfig {
        applicationId "${config.packageName}"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode ${config.buildNumber}
        versionName "${config.version}"
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
        debug {
            debuggable true
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
    lint {
        abortOnError false
    }
}

dependencies {
    implementation fileTree(dir: 'libs', include: ['*.jar'])
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.core:core:1.12.0'
}
`;

        files['android/settings.gradle'] = `include ':app';
rootProject.name = "${config.appName.replace(/[^a-zA-Z0-9]/g, '')}";
`;

        files['android/gradle.properties'] = `org.gradle.jvmargs=-Xmx2048m
android.useAndroidX=true
android.enableJetifier=true
`;

        files['android/gradle/wrapper/gradle-wrapper.properties'] = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.2-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;

        files['.github/workflows/android-build.yml'] = `name: Android Build

on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      build_type:
        description: 'Build type'
        required: false
        default: 'release'
        type: choice
        options:
          - release
          - debug

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install dependencies
        run: npm install

      - name: Install Capacitor
        run: npx cap sync android

      - name: Make Gradlew executable
        run: chmod +x android/gradlew

      - name: Build APK
        run: |
          cd android
          ./gradlew assembleRelease

      - name: Build AAB
        run: |
          cd android
          ./gradlew bundleRelease

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-release.apk
          path: android/app/build/outputs/apk/release/app-release.apk

      - name: Upload AAB
        uses: actions/upload-artifact@v4
        with:
          name: app-release.aab
          path: android/app/build/outputs/bundle/release/app-release.aab

      - name: Create Release
        uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: |
            android/app/build/outputs/apk/release/app-release.apk
            android/app/build/outputs/bundle/release/app-release.aab
          generate_release_notes: true
`;

        files['build-android.bat'] = `@echo off
echo ========================================
echo  ${config.appName} - Android Build
echo ========================================
echo.
echo [1/5] Installing npm dependencies...
call npm install
if errorlevel 1 (echo ERROR: npm install failed & pause & exit /b 1)
echo.
echo [2/5] Installing Capacitor...
call npx cap sync android
if errorlevel 1 (echo ERROR: Capacitor sync failed & pause & exit /b 1)
echo.
echo [3/5] Opening Android Studio...
echo Please open android/ folder in Android Studio
echo Then: Build -> Build Bundle(s) / APK(s) -> Build APK(s)
echo.
echo [4/5] Or build from command line:
echo   cd android
echo   gradlew.bat assembleRelease
echo.
echo [5/5] Build output will be in:
echo   android\\app\\build\\outputs\\apk\\release\\
echo.
pause
`;

        files['build-android.sh'] = `#!/bin/bash
echo "========================================"
echo " ${config.appName} - Android Build"
echo "========================================"
echo ""
echo "[1/4] Installing dependencies..."
npm install
echo ""
echo "[2/4] Syncing Capacitor..."
npx cap sync android
echo ""
echo "[3/4] Building APK..."
cd android
chmod +x gradlew
./gradlew assembleRelease
echo ""
echo "[4/4] Build complete!"
echo "APK: android/app/build/outputs/apk/release/"
echo "AAB: android/app/build/outputs/bundle/release/"
`;

        files['README.md'] = `# ${config.appName} — Android App

## Build Requirements

- **Node.js** v16+
- **Android Studio** (latest)
- **JDK 17**

## Quick Build (Windows)

1. Double-click \`build-android.bat\`
2. Open \`android/\` folder in Android Studio
3. Build → Build Bundle(s) / APK(s) → Build APK(s)

## Quick Build (Mac/Linux)

\`\`\`bash
chmod +x build-android.sh
./build-android.sh
\`\`\`

## GitHub Actions (Automatic Build)

1. Push this project to a GitHub repository
2. Go to Actions tab → "Android Build" → Run workflow
3. Download APK/AAB from Artifacts

## Manual Build

\`\`\`bash
npm install
npx cap sync android
cd android
./gradlew assembleRelease    # APK
./gradlew bundleRelease      # AAB (for Play Store)
\`\`\`

## Build Output

- **APK**: \`android/app/build/outputs/apk/release/app-release.apk\`
- **AAB**: \`android/app/build/outputs/bundle/release/app-release.aab\`

## Configuration

- **App Name**: ${config.appName}
- **Package**: ${config.packageName}
- **Version**: ${config.version}
- **Build**: #${config.buildNumber}
- **Website**: ${s.websiteUrl || 'https://tamilaistream.com'}

## Play Store Submission

1. Build AAB: \`./gradlew bundleRelease\`
2. Sign with release keystore
3. Upload to Google Play Console
`;

        files['.gitignore'] = `node_modules/
android/.gradle/
android/app/build/
android/build/
android/capacitor-*
*.log
.DS_Store
local.properties
`;

        return files;
    }

    function _createZip(files) {
        const entries = [];
        let offset = 0;

        for (const [name, content] of Object.entries(files)) {
            const nameBytes = new TextEncoder().encode(name);
            const contentBytes = content ? new TextEncoder().encode(content) : new Uint8Array(0);
            const compressed = _deflateRaw(contentBytes);

            const crc = _crc32(contentBytes);
            entries.push({ nameBytes, compressed, crc, uncompressedSize: contentBytes.length, compressedSize: compressed.length });
        }

        let centralSize = 0;
        const centralHeaders = [];
        let tempOffset = 0;

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const header = new Uint8Array(46 + e.nameBytes.length);
            const view = new DataView(header.buffer);

            view.setUint32(0, 0x02014b50, true);
            view.setUint16(4, 20, true);
            view.setUint16(6, 20, true);
            view.setUint16(8, 0, true);
            view.setUint16(10, 0, true);
            view.setUint16(12, 0, true);
            view.setUint32(16, e.crc, true);
            view.setUint32(20, e.compressedSize, true);
            view.setUint32(24, e.uncompressedSize, true);
            view.setUint16(28, e.nameBytes.length, true);
            view.setUint16(30, 0, true);
            view.setUint16(32, 0, true);
            view.setUint16(34, 0, true);
            view.setUint16(36, 0, true);
            view.setUint32(38, 0x20, true);
            view.setUint32(42, tempOffset, true);
            header.set(e.nameBytes, 46);

            centralHeaders.push(header);
            centralSize += header.length;
            tempOffset += 30 + e.nameBytes.length + e.compressedSize;
        }

        const totalSize = tempOffset + centralSize + 22;
        const zip = new Uint8Array(totalSize);
        const zipView = new DataView(zip.buffer);
        let pos = 0;

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const localHeader = new Uint8Array(30 + e.nameBytes.length);
            const lv = new DataView(localHeader.buffer);

            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);
            lv.setUint16(6, 0, true);
            lv.setUint16(8, 0, true);
            lv.setUint16(10, 0, true);
            lv.setUint32(14, e.crc, true);
            lv.setUint32(18, e.compressedSize, true);
            lv.setUint32(22, e.uncompressedSize, true);
            lv.setUint16(26, e.nameBytes.length, true);
            lv.setUint16(28, 0, true);
            localHeader.set(e.nameBytes, 30);

            zip.set(localHeader, pos);
            pos += localHeader.length;
            zip.set(e.compressed, pos);
            pos += e.compressedSize;
        }

        for (const ch of centralHeaders) {
            zip.set(ch, pos);
            pos += ch.length;
        }

        zipView.setUint32(pos, 0x06054b50, true);
        zipView.setUint16(pos + 4, 0, true);
        zipView.setUint16(pos + 6, 0, true);
        zipView.setUint16(pos + 8, entries.length, true);
        zipView.setUint16(pos + 10, entries.length, true);
        zipView.setUint32(pos + 12, centralSize, true);
        zipView.setUint32(pos + 16, tempOffset, true);
        zipView.setUint16(pos + 20, 0, true);

        return new Blob([zip], { type: 'application/zip' });
    }

    function _crc32(bytes) {
        let crc = 0xFFFFFFFF;
        const table = _crc32._table || (_crc32._table = (() => {
            const t = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                t[i] = c;
            }
            return t;
        })());
        for (let i = 0; i < bytes.length; i++) {
            crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function _deflateRaw(data) {
        if (data.length === 0) return new Uint8Array(0);
        const out = [];
        let i = 0;
        out.push(0x78, 0x01);
        let pos = 0;
        while (pos < data.length) {
            const remaining = data.length - pos;
            const blockLen = Math.min(32768, remaining);
            const isLast = (pos + blockLen >= data.length);
            out.push(isLast ? 0x01 : 0x00);
            out.push(blockLen & 0xFF, (blockLen >> 8) & 0xFF);
            out.push((~blockLen) & 0xFF, ((~blockLen) >> 8) & 0xFF);
            for (let j = 0; j < blockLen; j++) {
                out.push(data[pos + j]);
            }
            pos += blockLen;
        }
        const adler = _adler32(data);
        out.push((adler >> 24) & 0xFF, (adler >> 16) & 0xFF, (adler >> 8) & 0xFF, adler & 0xFF);
        return new Uint8Array(out);
    }

    function _adler32(data) {
        let a = 1, b = 0;
        for (let i = 0; i < data.length; i++) {
            a = (a + data[i]) % 65521;
            b = (b + a) % 65521;
        }
        return (b << 16) | a;
    }

    function _generateManifest() {
        return {
            name: _settings.appName,
            short_name: _settings.shortName,
            description: _settings.description,
            start_url: _settings.websiteUrl || window.location.origin,
            display: 'standalone',
            orientation: _settings.landscape === 'both' ? 'any' : 'portrait',
            background_color: _settings.bgColor,
            theme_color: _settings.primaryColor,
            scope: '/',
            lang: 'en',
            dir: 'ltr',
            categories: ['music', 'entertainment'],
            prefer_related_applications: false,
            icons: [
                { src: _settings.icon || '/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: _settings.icon || '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: _settings.maskableIcon || _settings.icon || '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ],
            shortcuts: [
                { name: 'FM Radio', url: '/?tab=fm', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
                { name: 'Search', url: '/?tab=search', icons: [{ src: '/icon-192.png', sizes: '192x192' }] }
            ]
        };
    }

    function _generateSplashConfig() {
        return {
            enabled: _settings.splashEnabled === 'true',
            duration: parseInt(_settings.splashDuration) || 2500,
            backgroundColor: _settings.splashBgColor,
            animation: _settings.splashAnimation,
            showLoadingBar: _settings.splashLoadingBar === 'true',
            showAppName: _settings.splashShowName === 'true',
            logo: _settings.splashLogo,
            appName: _settings.appName,
            accentColor: _settings.primaryColor
        };
    }

    function _generateSWConfig() {
        return {
            cacheStrategy: _settings.cacheStrategy,
            offlineMode: _settings.offlineMode === 'true',
            autoUpdate: _settings.autoUpdate === 'true',
            aiOptimize: _settings.aiOptimizeImages === 'true',
            aiSmartCache: _settings.aiSmartCache === 'true',
            version: _settings.version
        };
    }

    return {
        init, loadApplicationSettings, saveApplicationSettings,
        preview, saveDraft, publish, buildApp
    };
})();

if (typeof window !== 'undefined') window.AppBuilder = AppBuilder;
