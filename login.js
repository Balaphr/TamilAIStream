'use strict';

// ============================================
// DOM Elements
// ============================================
const DOM = {
    // Views
    loginView: document.getElementById('loginView'),
    registerView: document.getElementById('registerView'),
    forgotPasswordView: document.getElementById('forgotPasswordView'),
    // Login Form
    loginForm: document.getElementById('loginForm'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    loginBtn: document.getElementById('loginBtn'),
    loginError: document.getElementById('loginError'),
    loginErrorText: document.getElementById('loginErrorText'),
    emailError: document.getElementById('emailError'),
    passwordError: document.getElementById('passwordError'),
    togglePassword: document.getElementById('togglePassword'),
    rememberMe: document.getElementById('rememberMe'),
    // Register Form
    registerForm: document.getElementById('registerForm'),
    registerName: document.getElementById('registerName'),
    registerEmail: document.getElementById('registerEmail'),
    registerPassword: document.getElementById('registerPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    registerBtn: document.getElementById('registerBtn'),
    registerError: document.getElementById('registerError'),
    registerErrorText: document.getElementById('registerErrorText'),
    nameError: document.getElementById('nameError'),
    registerEmailError: document.getElementById('registerEmailError'),
    registerPasswordError: document.getElementById('registerPasswordError'),
    confirmPasswordError: document.getElementById('confirmPasswordError'),
    toggleRegisterPassword: document.getElementById('toggleRegisterPassword'),
    // Forgot Password
    forgotPasswordForm: document.getElementById('forgotPasswordForm'),
    resetEmail: document.getElementById('resetEmail'),
    resetBtn: document.getElementById('resetBtn'),
    resetError: document.getElementById('resetError'),
    resetErrorText: document.getElementById('resetErrorText'),
    resetEmailError: document.getElementById('resetEmailError'),
    // Social Login
    googleLogin: document.getElementById('googleLogin'),
    googleRegister: document.getElementById('googleRegister'),
    guestLogin: document.getElementById('guestLogin'),
    // Navigation Links
    forgotPassword: document.getElementById('forgotPassword'),
    createAccount: document.getElementById('createAccount'),
    backToLogin: document.getElementById('backToLogin'),
    backToLoginFromReset: document.getElementById('backToLoginFromReset'),
    // Success Overlay
    successOverlay: document.getElementById('successOverlay'),
    successTitle: document.getElementById('successTitle'),
    successMessage: document.getElementById('successMessage')
};

// ============================================
// Auth Configuration (localStorage-based)
// ============================================
const AUTH_STORAGE_KEY = 'tamilAIStream_users';

// ============================================
// Local Auth Helpers
// ============================================
function getStoredUsers() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || [];
    } catch { return []; }
}

function saveStoredUsers(users) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
}

function findUserByEmail(email) {
    return getStoredUsers().find(u => u.email === email);
}

function createUser(email, password, name) {
    const users = getStoredUsers();
    if (users.find(u => u.email === email)) return null;
    const user = { email, password, name, photoURL: '', uid: 'user_' + Date.now(), createdAt: Date.now() };
    users.push(user);
    saveStoredUsers(users);
    return user;
}

function validateCredentials(email, password) {
    return getStoredUsers().find(u => u.email === email && u.password === password);
}

// ============================================
// Particle System
// ============================================
class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        this.init();
    }
    init() { this.resize(); this.createParticles(); this.bindEvents(); this.animate(); }
    resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }
    createParticles() {
        const count = Math.min(Math.floor((this.canvas.width * this.canvas.height) / 12000), 80);
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height,
                size: Math.random() * 2.5 + 0.5, speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5, opacity: Math.random() * 0.5 + 0.1,
                pulse: Math.random() * Math.PI * 2
            });
        }
    }
    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
        document.addEventListener('mouseleave', () => { this.mouse.x = null; this.mouse.y = null; });
    }
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles.forEach((p, i) => {
            p.pulse += 0.02; p.x += p.speedX; p.y += p.speedY;
            if (p.x < 0) p.x = this.canvas.width; if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height; if (p.y > this.canvas.height) p.y = 0;
            if (this.mouse.x !== null) {
                const dx = this.mouse.x - p.x, dy = this.mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouse.radius) {
                    const force = (this.mouse.radius - dist) / this.mouse.radius;
                    p.x -= dx * force * 0.02; p.y -= dy * force * 0.02;
                }
            }
            const pulseOpacity = p.opacity + Math.sin(p.pulse) * 0.1;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(52, 211, 153, ${pulseOpacity})`;
            this.ctx.fill();
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = p.x - this.particles[j].x, dy = p.y - this.particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(52, 211, 153, ${0.08 * (1 - dist / 120)})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.moveTo(p.x, p.y); this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        });
        requestAnimationFrame(() => this.animate());
    }
}

// ============================================
// Validation
// ============================================
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function validateEmail(email) {
    if (!email) return { valid: false, message: 'Email address is required' };
    if (!EMAIL_REGEX.test(email)) return { valid: false, message: 'Please enter a valid email address' };
    return { valid: true, message: '' };
}

function validatePassword(password) {
    if (!password) return { valid: false, message: 'Password is required' };
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
    return { valid: true, message: '' };
}

function validateName(name) {
    if (!name || name.trim().length < 2) return { valid: false, message: 'Please enter your full name' };
    return { valid: true, message: '' };
}

// ============================================
// Premium Toast Notification System
// ============================================
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    const icons = {
        error: '<i class="fas fa-exclamation-circle"></i>',
        success: '<i class="fas fa-check-circle"></i>',
        info: '<i class="fas fa-info-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" aria-label="Close"><i class="fas fa-times"></i></button>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Inject toast styles
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    .toast-notification {
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        display: flex; align-items: center; gap: 12px;
        padding: 14px 18px; min-width: 300px; max-width: 500px;
        background: rgba(17, 24, 39, 0.95); backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        transform: translateX(400px); opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .toast-notification.visible { transform: translateX(0); opacity: 1; }
    .toast-icon { font-size: 20px; flex-shrink: 0; }
    .toast-error .toast-icon { color: #ef4444; }
    .toast-success .toast-icon { color: #10b981; }
    .toast-info .toast-icon { color: #34d399; }
    .toast-warning .toast-icon { color: #f59e0b; }
    .toast-message { flex: 1; font-size: 0.85rem; color: #fff; font-weight: 500; }
    .toast-close {
        background: none; border: none; color: rgba(255,255,255,0.5);
        cursor: pointer; font-size: 16px; padding: 0; transition: color 0.2s;
    }
    .toast-close:hover { color: #fff; }
    @media (max-width: 480px) {
        .toast-notification { top: 10px; right: 10px; left: 10px; min-width: auto; }
    }
`;
document.head.appendChild(toastStyle);

// ============================================
// View Switching
// ============================================
function showView(viewName) {
    document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
    const viewMap = {
        'login': 'loginView',
        'register': 'registerView',
        'forgot': 'forgotPasswordView'
    };
    const viewId = viewMap[viewName];
    if (viewId) {
        document.getElementById(viewId).classList.add('active');
    }
}

// ============================================
// Error Message Helper
// ============================================
function getAuthErrorMessage(error) {
    return error.message || 'An error occurred. Please try again';
}

// ============================================
// "Remember Me" Persistence Helper
// ============================================
/**
 * Sets or clears the "Remember Me" flag in localStorage.
 * This flag is the ONLY indicator used to determine if a user
 * should be automatically redirected to index.html on page load.
 * 
 * - When "Remember Me" is checked: Sets flag (session persists across browser restarts)
 * - When "Remember Me" is NOT checked: Clears flag (session lost when browser is closed)
 */
function setRememberMeFlag(remember) {
    if (remember) {
        localStorage.setItem('tamilAIStream_rememberMe', 'true');
    } else {
        localStorage.removeItem('tamilAIStream_rememberMe');
    }
}

function getRememberMeFlag() {
    return localStorage.getItem('tamilAIStream_rememberMe') === 'true';
}

async function applyPersistence(remember) {
    setRememberMeFlag(remember);
}

// ============================================
// Redirect to Home (Used by login handlers ONLY)
// ============================================
/**
 * Redirects to index.html after a successful login.
 * This function is called directly by each login handler
 * (form submit, Google sign-in, guest login, demo login).
 * 
 * The auth state listener (onAuthStateChanged) does NOT trigger redirects.
 * This prevents automatic redirects from stale sessions.
 */
function redirectToHome() {
    window.location.href = Auth.getRedirect();
}

// ============================================
// Toggle Password Visibility
// ============================================
function setupTogglePassword(buttonId, inputId) {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    button?.addEventListener('click', function() {
        const type = input.getAttribute('type');
        if (type === 'password') {
            input.setAttribute('type', 'text');
            this.classList.add('showing');
        } else {
            input.setAttribute('type', 'password');
            this.classList.remove('showing');
        }
    });
}

setupTogglePassword('togglePassword', 'loginPassword');
setupTogglePassword('toggleRegisterPassword', 'registerPassword');

// ============================================
// Real-time Validation
// ============================================
DOM.loginEmail?.addEventListener('input', function() {
    const value = this.value.trim();
    const result = validateEmail(value);
    this.classList.remove('valid', 'invalid');
    if (value.length === 0) { DOM.emailError.classList.remove('visible'); return; }
    if (result.valid) { this.classList.add('valid'); DOM.emailError.classList.remove('visible'); }
    else { this.classList.add('invalid'); DOM.emailError.querySelector('span').textContent = result.message; DOM.emailError.classList.add('visible'); }
});

DOM.loginPassword?.addEventListener('input', function() {
    const value = this.value;
    this.classList.remove('valid', 'invalid');
    if (value.length === 0) { DOM.passwordError.classList.remove('visible'); return; }
    if (value.length >= 8) { this.classList.add('valid'); DOM.passwordError.classList.remove('visible'); }
    else { this.classList.add('invalid'); DOM.passwordError.querySelector('span').textContent = 'Password must be at least 8 characters'; DOM.passwordError.classList.add('visible'); }
});

DOM.registerName?.addEventListener('input', function() {
    const value = this.value.trim();
    const result = validateName(value);
    this.classList.remove('valid', 'invalid');
    if (value.length === 0) { DOM.nameError.classList.remove('visible'); return; }
    if (result.valid) { this.classList.add('valid'); DOM.nameError.classList.remove('visible'); }
    else { this.classList.add('invalid'); DOM.nameError.querySelector('span').textContent = result.message; DOM.nameError.classList.add('visible'); }
});

DOM.registerEmail?.addEventListener('input', function() {
    const value = this.value.trim();
    const result = validateEmail(value);
    this.classList.remove('valid', 'invalid');
    if (value.length === 0) { DOM.registerEmailError.classList.remove('visible'); return; }
    if (result.valid) { this.classList.add('valid'); DOM.registerEmailError.classList.remove('visible'); }
    else { this.classList.add('invalid'); DOM.registerEmailError.querySelector('span').textContent = result.message; DOM.registerEmailError.classList.add('visible'); }
});

DOM.registerPassword?.addEventListener('input', function() {
    const value = this.value;
    this.classList.remove('valid', 'invalid');
    if (value.length === 0) { DOM.registerPasswordError.classList.remove('visible'); return; }
    if (value.length >= 8) { this.classList.add('valid'); DOM.registerPasswordError.classList.remove('visible'); }
    else { this.classList.add('invalid'); DOM.registerPasswordError.querySelector('span').textContent = 'Password must be at least 8 characters'; DOM.registerPasswordError.classList.add('visible'); }
    if (DOM.confirmPassword.value.length > 0) {
        DOM.confirmPassword.dispatchEvent(new Event('input'));
    }
});

DOM.confirmPassword?.addEventListener('input', function() {
    const value = this.value;
    const password = DOM.registerPassword.value;
    this.classList.remove('valid', 'invalid');
    if (value.length === 0) { DOM.confirmPasswordError.classList.remove('visible'); return; }
    if (value === password && value.length >= 8) { this.classList.add('valid'); DOM.confirmPasswordError.classList.remove('visible'); }
    else { this.classList.add('invalid'); DOM.confirmPasswordError.querySelector('span').textContent = value !== password ? 'Passwords do not match' : 'Password must be at least 8 characters'; DOM.confirmPasswordError.classList.add('visible'); }
});

DOM.resetEmail?.addEventListener('input', function() {
    const value = this.value.trim();
    const result = validateEmail(value);
    this.classList.remove('valid', 'invalid');
    if (value.length === 0) { DOM.resetEmailError.classList.remove('visible'); return; }
    if (result.valid) { this.classList.add('valid'); DOM.resetEmailError.classList.remove('visible'); }
    else { this.classList.add('invalid'); DOM.resetEmailError.querySelector('span').textContent = result.message; DOM.resetEmailError.classList.add('visible'); }
});

// ============================================
// Login Form Submission
// ============================================
/**
 * Email/Password login handler.
 * 1. Sets persistence based on "Remember Me" checkbox
 * 2. Signs in with email/password
 * 3. Redirects to index.html on success
 * 
 * The onAuthStateChanged listener does NOT redirect - this function does.
 */
DOM.loginForm?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = DOM.loginEmail.value.trim();
    const password = DOM.loginPassword.value;

    const emailResult = validateEmail(email);
    const passwordResult = validatePassword(password);

    DOM.loginEmail.classList.remove('valid', 'invalid');
    DOM.loginPassword.classList.remove('valid', 'invalid');
    DOM.loginError.classList.remove('visible');

    let isValid = true;

    if (!emailResult.valid) {
        DOM.loginEmail.classList.add('invalid');
        DOM.emailError.querySelector('span').textContent = emailResult.message;
        DOM.emailError.classList.add('visible');
        isValid = false;
    } else {
        DOM.loginEmail.classList.add('valid');
    }

    if (!passwordResult.valid) {
        DOM.loginPassword.classList.add('invalid');
        DOM.passwordError.querySelector('span').textContent = passwordResult.message;
        DOM.passwordError.classList.add('visible');
        isValid = false;
    } else {
        DOM.loginPassword.classList.add('valid');
    }

    if (!isValid) {
        DOM.loginForm.classList.add('shake');
        setTimeout(() => DOM.loginForm.classList.remove('shake'), 500);
        return;
    }

    DOM.loginBtn.classList.add('loading');
    DOM.loginBtn.disabled = true;

    try {
        const rememberMe = DOM.rememberMe.checked;
        await applyPersistence(rememberMe);

         const user = validateCredentials(email, password);
        if (!user) {
            throw new Error('Invalid email or password');
        }

        const userData = { name: user.name, email: user.email, photoURL: user.photoURL || '', uid: user.uid };
        Auth.createSession(userData, rememberMe, false);
        
        const isAdmin = (email === DEMO_EMAIL && password === DEMO_PASSWORD);
        if (isAdmin) {
            localStorage.setItem('adminSession', JSON.stringify({
                username: DEMO_EMAIL,
                email: DEMO_EMAIL,
                displayName: user.name,
                loginTime: Date.now(),
                expiry: Date.now() + (24 * 60 * 60 * 1000)
            }));
        }
        
        DOM.loginBtn.classList.remove('loading');
        DOM.loginBtn.disabled = false;
        
        DOM.successTitle.textContent = isAdmin ? 'Welcome Admin!' : 'Welcome back!';
        DOM.successMessage.textContent = isAdmin ? 'Loading your Command Center...' : 'Redirecting to your dashboard...';
        DOM.successOverlay.classList.add('visible');
        
        showToast(isAdmin ? 'Admin login successful! Opening Command Center.' : 'Login successful! Welcome back.', 'success');
        
        setTimeout(() => isAdmin ? (window.location.href = 'dashboard.html') : redirectToHome(), 1500);
        
    } catch (error) {
        DOM.loginBtn.classList.remove('loading');
        DOM.loginBtn.disabled = false;
        const errorMsg = error.message || 'Login failed';
        DOM.loginErrorText.textContent = errorMsg;
        DOM.loginError.classList.add('visible');
        showToast(errorMsg, 'error');
        DOM.loginForm.classList.add('shake');
        setTimeout(() => DOM.loginForm.classList.remove('shake'), 500);
    }
});

// ============================================
// Register Form Submission
// ============================================
/**
 * Registration handler.
 * Creates a new user account, sets persistence, and redirects.
 */
DOM.registerForm?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = DOM.registerName.value.trim();
    const email = DOM.registerEmail.value.trim();
    const password = DOM.registerPassword.value;
    const confirmPassword = DOM.confirmPassword.value;

    const nameResult = validateName(name);
    const emailResult = validateEmail(email);
    const passwordResult = validatePassword(password);

    DOM.registerName.classList.remove('valid', 'invalid');
    DOM.registerEmail.classList.remove('valid', 'invalid');
    DOM.registerPassword.classList.remove('valid', 'invalid');
    DOM.confirmPassword.classList.remove('valid', 'invalid');
    DOM.registerError.classList.remove('visible');

    let isValid = true;

    if (!nameResult.valid) {
        DOM.registerName.classList.add('invalid');
        DOM.nameError.querySelector('span').textContent = nameResult.message;
        DOM.nameError.classList.add('visible');
        isValid = false;
    } else {
        DOM.registerName.classList.add('valid');
    }

    if (!emailResult.valid) {
        DOM.registerEmail.classList.add('invalid');
        DOM.registerEmailError.querySelector('span').textContent = emailResult.message;
        DOM.registerEmailError.classList.add('visible');
        isValid = false;
    } else {
        DOM.registerEmail.classList.add('valid');
    }

    if (!passwordResult.valid) {
        DOM.registerPassword.classList.add('invalid');
        DOM.registerPasswordError.querySelector('span').textContent = passwordResult.message;
        DOM.registerPasswordError.classList.add('visible');
        isValid = false;
    } else {
        DOM.registerPassword.classList.add('valid');
    }

    if (password !== confirmPassword) {
        DOM.confirmPassword.classList.add('invalid');
        DOM.confirmPasswordError.querySelector('span').textContent = 'Passwords do not match';
        DOM.confirmPasswordError.classList.add('visible');
        isValid = false;
    } else if (confirmPassword.length >= 8) {
        DOM.confirmPassword.classList.add('valid');
    }

    if (!isValid) {
        DOM.registerForm.classList.add('shake');
        setTimeout(() => DOM.registerForm.classList.remove('shake'), 500);
        return;
    }

    DOM.registerBtn.classList.add('loading');
    DOM.registerBtn.disabled = true;

    try {
        const rememberMe = DOM.rememberMe.checked;
        await applyPersistence(rememberMe);
        
        const newUser = createUser(email, password, name);
        if (!newUser) {
            throw new Error('An account with this email already exists');
        }
        
        const userData = { name: newUser.name, email: newUser.email, photoURL: '', uid: newUser.uid };
        Auth.createSession(userData, rememberMe, false);
        
        DOM.registerBtn.classList.remove('loading');
        DOM.registerBtn.disabled = false;
        
        DOM.successTitle.textContent = 'Account Created!';
        DOM.successMessage.textContent = 'Welcome to Tamil AI Stream! Redirecting...';
        DOM.successOverlay.classList.add('visible');
        
        showToast('Account created successfully! Welcome to Tamil AI Stream.', 'success');
        
        setTimeout(() => redirectToHome(), 1500);
        
    } catch (error) {
        DOM.registerBtn.classList.remove('loading');
        DOM.registerBtn.disabled = false;
        const errorMsg = error.message || 'Registration failed';
        DOM.registerErrorText.textContent = errorMsg;
        DOM.registerError.classList.add('visible');
        showToast(errorMsg, 'error');
        DOM.registerForm.classList.add('shake');
        setTimeout(() => DOM.registerForm.classList.remove('shake'), 500);
    }
});

// ============================================
// Firebase Google Sign-In
// ============================================
async function signInWithGoogle() {
    try {
        // Ensure Firebase is initialized before using it
        if (typeof window.ensureFirebaseInit === 'function') {
            window.ensureFirebaseInit();
        }

        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            throw new Error('Firebase not initialized. Please refresh the page.');
        }

        const auth = firebase.auth();
        if (!auth) {
            throw new Error('Firebase Auth not available. Please refresh the page.');
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        
        // Add scopes
        provider.addScope('email');
        provider.addScope('profile');
        
        // Sign in with Google popup
        const result = await auth.signInWithPopup(provider);
        
        if (result.user) {
            const user = result.user;
            
            // Store user data
            const userData = {
                name: user.displayName || 'Google User',
                email: user.email,
                photoURL: user.photoURL || '',
                uid: user.uid,
                emailVerified: user.emailVerified
            };
            
            Auth.createSession(userData, true, false);
            
            showToast(`Welcome ${userData.name}! Signed in with Google.`, 'success');
            
            DOM.successTitle.textContent = 'Welcome!';
            DOM.successMessage.textContent = 'Signed in with Google successfully. Redirecting...';
            DOM.successOverlay.classList.add('visible');
            
            setTimeout(() => redirectToHome(), 1500);
        }
    } catch (error) {
        console.error('Google Sign-In Error:', error);
        
        let errorMessage = 'Google Sign-In failed. Please try again.';
        
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in popup was closed. Please try again.';
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = 'Sign-in was cancelled. Please try again.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Popup was blocked by your browser. Please allow popups for this site.';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Google sign-in is not enabled. Please contact support.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showToast(errorMessage, 'error');
    }
}

DOM.googleLogin?.addEventListener('click', signInWithGoogle);
DOM.googleRegister?.addEventListener('click', signInWithGoogle);

// ============================================
// Continue as Guest
// ============================================
DOM.guestLogin?.addEventListener('click', async function() {
    this.classList.add('loading');
    const originalHTML = this.innerHTML;
    this.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Connecting...';
    this.disabled = true;

    try {
        const rememberMe = DOM.rememberMe ? DOM.rememberMe.checked : false;
        await applyPersistence(rememberMe);
        
        Auth.createSession({
            name: 'Guest User',
            email: 'guest@tamilaistream.com',
            photoURL: '',
            uid: 'guest_' + Date.now(),
            isGuest: true
        }, rememberMe, true);
        
        showToast('Continuing as Guest. Some features may be limited.', 'info');
        DOM.successTitle.textContent = 'Welcome Guest!';
        DOM.successMessage.textContent = 'Enjoy limited access. Sign up for full features!';
        DOM.successOverlay.classList.add('visible');
        
        setTimeout(() => redirectToHome(), 2000);
    } catch (error) {
        this.innerHTML = originalHTML;
        this.classList.remove('loading');
        this.disabled = false;
        showToast(error.message || 'Guest login failed', 'error');
    }
});

// ============================================
// Forgot Password
// ============================================
DOM.forgotPasswordForm?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = DOM.resetEmail.value.trim();
    const emailResult = validateEmail(email);

    DOM.resetEmail.classList.remove('valid', 'invalid');
    DOM.resetError.classList.remove('visible');

    if (!emailResult.valid) {
        DOM.resetEmail.classList.add('invalid');
        DOM.resetEmailError.querySelector('span').textContent = emailResult.message;
        DOM.resetEmailError.classList.add('visible');
        DOM.forgotPasswordForm.classList.add('shake');
        setTimeout(() => DOM.forgotPasswordForm.classList.remove('shake'), 500);
        return;
    }

    DOM.resetEmail.classList.add('valid');
    DOM.resetBtn.classList.add('loading');
    DOM.resetBtn.disabled = true;

    try {
        const user = findUserByEmail(email);
        if (!user) {
            throw new Error('No account found with this email');
        }
        DOM.resetBtn.classList.remove('loading');
        DOM.resetBtn.disabled = false;
        showToast('Password reset instructions sent! (Demo: contact admin@tamilaistream.com)', 'success');
        setTimeout(() => {
            showView('login');
            DOM.loginEmail.value = email;
        }, 2000);
    } catch (error) {
        DOM.resetBtn.classList.remove('loading');
        DOM.resetBtn.disabled = false;
        const errorMsg = error.message || 'Reset failed';
        DOM.resetErrorText.textContent = errorMsg;
        DOM.resetError.classList.add('visible');
        showToast(errorMsg, 'error');
    }
});

// ============================================
// Navigation Links
// ============================================
DOM.createAccount?.addEventListener('click', function(e) {
    e.preventDefault();
    showView('register');
});

DOM.backToLogin?.addEventListener('click', function(e) {
    e.preventDefault();
    showView('login');
});

DOM.forgotPassword?.addEventListener('click', function(e) {
    e.preventDefault();
    showView('forgot');
});

DOM.backToLoginFromReset?.addEventListener('click', function(e) {
    e.preventDefault();
    showView('login');
});

// ============================================
// Auth State (localStorage-based, no listener needed)
// ============================================
// Auth state is managed entirely via localStorage.
// No real-time listener required.

// ============================================
// Load Remembered Email
// ============================================
function loadRememberedEmail() {
    const rememberedEmail = localStorage.getItem('tamilAIStream_rememberEmail');
    if (rememberedEmail) {
        DOM.loginEmail.value = rememberedEmail;
        DOM.rememberMe.checked = true;
    }
}

// ============================================
// Shake Animation
// ============================================
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%,100% { transform: translateX(0); }
        10%,30%,50%,70%,90% { transform: translateX(-4px); }
        20%,40%,60%,80% { transform: translateX(4px); }
    }
    .shake { animation: shake 0.5s ease-in-out; }
`;
document.head.appendChild(shakeStyle);

// ============================================
// Demo Account
// ============================================
const DEMO_EMAIL = 'admin@tamilaistream.com';
const DEMO_PASSWORD = 'Admin@123';
const DEMO_NAME = 'Admin User';

/**
 * Seed demo account on page load (localStorage-based).
 */
function seedDemoAccount() {
    const existing = findUserByEmail(DEMO_EMAIL);
    if (!existing) {
        createUser(DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME);
        console.log('Demo account created successfully');
        showToast('Demo account ready! Use the credentials below to log in.', 'success');
    } else {
        console.log('Demo account already exists');
    }
}

/**
 * Quick Login with Demo Account.
 * Respects the "Remember Me" checkbox.
 */
async function quickDemoLogin() {
    const demoBtn = document.getElementById('demoLoginBtn');
    if (!demoBtn) return;
    
    demoBtn.classList.add('loading');
    demoBtn.disabled = true;
    const originalHTML = demoBtn.innerHTML;
    demoBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Logging in...';
    
    try {
        const rememberMe = DOM.rememberMe ? DOM.rememberMe.checked : true;
        await applyPersistence(rememberMe);

        let user = validateCredentials(DEMO_EMAIL, DEMO_PASSWORD);
        if (!user) {
            user = createUser(DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME);
        }
        
        if (!user) {
            throw new Error('Failed to create demo account');
        }

        const userData = { name: user.name, email: user.email, photoURL: user.photoURL || '', uid: user.uid };
        Auth.createSession(userData, rememberMe, false);
        
        showToast('Demo login successful! Welcome Admin.', 'success');
        
        // Also set adminSession so builder.html recognizes the admin login
        // (Auth.createSession above also sets main website session, but we also set adminSession explicitly)
        localStorage.setItem('adminSession', JSON.stringify({
            username: DEMO_EMAIL,
            email: DEMO_EMAIL,
            displayName: user.name,
            loginTime: Date.now(),
            expiry: Date.now() + (24 * 60 * 60 * 1000)
        }));
        
        // Also set main website session so builder auth fallback works
        // (Ensures checkWebsiteAuth() in builder.js can authenticate even if adminSession check fails)
        try {
            localStorage.setItem('tamilAIStream_user', JSON.stringify({
                uid: user.uid || 'admin-local',
                name: user.name || 'Admin',
                email: user.email,
                loginTime: Date.now(),
                photoURL: user.photoURL || ''
            }));
            localStorage.setItem('tamilAIStream_loggedIn', 'true');
        } catch (e) {
            console.warn('Unable to sync website session:', e);
        }
        
        DOM.successTitle.textContent = 'Welcome Admin!';
        DOM.successMessage.textContent = 'Loading your Command Center...';
        DOM.successOverlay.classList.add('visible');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        demoBtn.innerHTML = originalHTML;
        demoBtn.classList.remove('loading');
        demoBtn.disabled = false;
        showToast(error.message || 'Demo login failed', 'error');
    }
}

/**
 * Open the Website Builder — ensures the admin account is seeded and the
 * adminSession flag exists, then navigates to builder.html?auto=1 so the
 * Builder opens straight into the dashboard (no extra typing / gate click).
 */
async function openBuilderFromLogin() {
    const btn = document.getElementById('openBuilderBtn');
    if (!btn) return;

    btn.classList.add('loading');
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Opening Builder...';

    try {
        const rememberMe = DOM.rememberMe ? DOM.rememberMe.checked : true;
        await applyPersistence(rememberMe);

        let user = validateCredentials(DEMO_EMAIL, DEMO_PASSWORD);
        if (!user) {
            user = createUser(DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME);
        }
        if (!user) {
            throw new Error('Failed to prepare admin session');
        }

        Auth.createSession({ name: user.name, email: user.email, photoURL: user.photoURL || '', uid: user.uid }, rememberMe, false);

        // Set adminSession so builder.html recognizes the admin login
        localStorage.setItem('adminSession', JSON.stringify({
            username: DEMO_EMAIL,
            email: DEMO_EMAIL,
            displayName: user.name,
            loginTime: Date.now(),
            expiry: Date.now() + (24 * 60 * 60 * 1000)
        }));

        // Also set main website session so builder auth fallback works
        // (Ensures checkWebsiteAuth() in builder.js can authenticate even if adminSession check fails)
        try {
            localStorage.setItem('tamilAIStream_user', JSON.stringify({
                uid: user.uid || 'admin-local',
                name: user.name || 'Admin',
                email: user.email,
                loginTime: Date.now(),
                photoURL: user.photoURL || ''
            }));
            localStorage.setItem('tamilAIStream_loggedIn', 'true');
        } catch (e) {
            console.warn('Unable to sync website session:', e);
        }

        showToast('Opening Builder...', 'success');

        setTimeout(() => {
            window.location.href = 'builder.html?auto=1';
        }, 600);
    } catch (error) {
        btn.innerHTML = originalHTML;
        btn.classList.remove('loading');
        btn.disabled = false;
        showToast(error.message || 'Failed to open Website Builder', 'error');
    }
}

/**
 * Open Nexvora AI — ensures the admin account exists and navigates to /Nexvora.
 */
async function openNexvoraFromLogin() {
    const btn = document.getElementById('openNexvoraBtn');
    if (!btn) return;

    btn.classList.add('loading');
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Opening Nexvora...';

    try {
        const rememberMe = DOM.rememberMe ? DOM.rememberMe.checked : true;
        await applyPersistence(rememberMe);

        let user = validateCredentials(DEMO_EMAIL, DEMO_PASSWORD);
        if (!user) {
            user = createUser(DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME);
        }
        if (!user) {
            throw new Error('Failed to prepare admin session');
        }

        Auth.createSession({ name: user.name, email: user.email, photoURL: user.photoURL || '', uid: user.uid }, rememberMe, false);

        localStorage.setItem('adminSession', JSON.stringify({
            username: DEMO_EMAIL,
            email: DEMO_EMAIL,
            displayName: user.name,
            loginTime: Date.now(),
            expiry: Date.now() + (24 * 60 * 60 * 1000)
        }));

        try {
            localStorage.setItem('tamilAIStream_user', JSON.stringify({
                uid: user.uid || 'admin-local',
                name: user.name || 'Admin',
                email: user.email,
                loginTime: Date.now(),
                photoURL: user.photoURL || ''
            }));
            localStorage.setItem('tamilAIStream_loggedIn', 'true');
        } catch (e) {
            console.warn('Unable to sync website session:', e);
        }

        showToast('Opening Nexvora AI...', 'success');

        setTimeout(() => {
            window.location.href = 'Nexvora';
        }, 600);
    } catch (error) {
        btn.innerHTML = originalHTML;
        btn.classList.remove('loading');
        btn.disabled = false;
        showToast(error.message || 'Failed to open Nexvora AI', 'error');
    }
}

// Demo Copy Button
function setupDemoCopyButtons() {
    document.querySelectorAll('.demo-copy-btn, .admin-copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.dataset.copy;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    showToast('Copied to clipboard!', 'success');
                }).catch(() => {
                    fallbackCopy(text);
                });
            } else {
                fallbackCopy(text);
            }
        });
    });
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('Copied to clipboard!', 'success');
    } catch (e) {
        showToast('Failed to copy', 'error');
    }
    document.body.removeChild(textarea);
}

// ============================================
// Initialize
// ============================================
/**
 * On page load:
 * 1. If a VALID authenticated session already exists (flag + stored user,
 *    unexpired + token intact), redirect to the originally requested page
 *    (or the home page) immediately.
 * 2. Auth.isAuthenticated() silently clears missing/expired/invalid sessions,
 *    so an unauthenticated visitor always stays on the login page first.
 * 3. Otherwise, show the login form.
 */
document.addEventListener('DOMContentLoaded', () => {
    new ParticleSystem('particles-canvas');
    loadRememberedEmail();
    
    setupDemoCopyButtons();
    document.getElementById('demoLoginBtn')?.addEventListener('click', quickDemoLogin);
    document.getElementById('openBuilderBtn')?.addEventListener('click', openBuilderFromLogin);
    document.getElementById('openNexvoraBtn')?.addEventListener('click', openNexvoraFromLogin);
    
    seedDemoAccount();
    
    if (Auth.isAuthenticated()) {
        window.location.href = Auth.getRedirect();
        return;
    }
    
    console.log('%c🎙️ Tamil AI FM', 'font-size:24px;font-weight:bold;color:#34d399;');
    console.log('%cLogin Page Loaded', 'font-size:14px;color:#6ee7b7;');
});