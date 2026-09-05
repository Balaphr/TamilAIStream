'use strict';

// ============================================
// Admin Login - localStorage-based
// ============================================

// ============================================
// Admin Credentials
// ============================================
const ADMIN_CREDENTIALS = {
    username: 'admin@tamilaistream.com',
    password: 'Admin@123'
};
const ADMIN_EMAILS = ['admin@tamilaistream.com'];

// ============================================
// DOM Elements
// ============================================
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const loginBtn = document.getElementById('loginBtn');
const loginSpinner = document.getElementById('loginSpinner');
const rememberMe = document.getElementById('rememberMe');

// ============================================
// Toggle Password Visibility
// ============================================
togglePasswordBtn?.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    const icon = togglePasswordBtn.querySelector('i');
    icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
});

// ============================================
// Login Form Submission
// ============================================
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    // Validate credentials
    if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
        showToast('Invalid username or password', 'error');
        shakeElement(loginForm);
        return;
    }
    
    // Show loading state
    loginBtn.disabled = true;
    loginSpinner.style.display = 'inline-block';
    loginBtn.querySelector('.btn-text').textContent = 'Authenticating...';
    
    try {
        // Simulate authentication delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create session
        const sessionData = {
            username: ADMIN_CREDENTIALS.username,
            loginTime: Date.now(),
            expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        
        // Store in localStorage (shared across tabs for admin/builder access)
        localStorage.setItem('adminSession', JSON.stringify(sessionData));
        
        showToast('Login successful! Redirecting...', 'success');
        
        // Redirect to admin dashboard (Builder)
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
        loginBtn.disabled = false;
        loginSpinner.style.display = 'none';
        loginBtn.querySelector('.btn-text').textContent = 'Login';
    }
});

// ============================================
// Check for Existing Session
// ============================================
function checkExistingSession() {
    const session = localStorage.getItem('adminSession');
    if (session) {
        const sessionData = JSON.parse(session);
        if (sessionData.expiry > Date.now()) {
            // Session is valid, redirect to dashboard
            window.location.href = 'admin.html';
            return true;
        } else {
            // Session expired, clear it
            localStorage.removeItem('adminSession');
        }
    }
    return false;
}

// ============================================
// Shake Animation for Errors
// ============================================
function shakeElement(element) {
    element.style.animation = 'none';
    element.offsetHeight; // Trigger reflow
    element.style.animation = 'shake 0.5s ease-in-out';
    
    // Add shake keyframes if not exists
    if (!document.querySelector('#shake-styles')) {
        const style = document.createElement('style');
        style.id = 'shake-styles';
        style.textContent = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 140px; left: 50%; transform: translateX(-50%);
        padding: 12px 24px; background: var(--bg-glass); border: 1px solid var(--border-glass);
        border-radius: var(--radius-md); color: var(--text-primary); font-family: var(--font-family);
        font-size: 0.85rem; font-weight: 500; z-index: 9999; animation: slideUp 0.3s ease-out;
        backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        max-width: calc(100% - 32px); text-align: center;
    `;
    if (type === 'success') {
        toast.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        toast.style.background = 'rgba(16, 185, 129, 0.1)';
    } else if (type === 'error') {
        toast.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        toast.style.background = 'rgba(239, 68, 68, 0.1)';
    }
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// Add CSS Animations
// ============================================
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideUp { 
        from { transform: translateX(-50%) translateY(20px); opacity: 0; } 
        to { transform: translateX(-50%) translateY(0); opacity: 1; } 
    }
    @keyframes fadeIn { 
        from { opacity: 0; } 
        to { opacity: 1; } 
    }
`;
document.head.appendChild(styleSheet);

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Check for existing session
    if (checkExistingSession()) {
        return;
    }
    
    // Add input animations
    [usernameInput, passwordInput].forEach(input => {
        input?.addEventListener('focus', () => {
            input.parentElement.style.borderColor = 'var(--emerald-400)';
            input.parentElement.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)';
        });
        
        input?.addEventListener('blur', () => {
            input.parentElement.style.borderColor = '';
            input.parentElement.style.boxShadow = '';
        });
    });

    // Google Sign-In button
    document.getElementById('googleSignIn')?.addEventListener('click', signInWithGoogle);
    
    console.log('%c🔐 Tamil AI Stream Admin Login', 'font-size:18px;font-weight:bold;color:#34d399;');
    console.log('%cReady for authentication', 'font-size:12px;color:#6ee7b7;');
});

// ============================================
// Firebase Google Sign-In
// ============================================
async function signInWithGoogle() {
    const btn = document.getElementById('googleSignIn');
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

    try {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            showToast('Firebase not loaded. Please refresh.', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
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
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            return;
        }

        const email = user.email.toLowerCase();
        if (!ADMIN_EMAILS.includes(email)) {
            firebase.auth().signOut();
            showToast('Access denied. Admins only.', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            return;
        }

        // Create sessions
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

        // Also create main website session via Auth
        if (typeof Auth !== 'undefined' && Auth.createSession) {
            Auth.createSession({
                name: user.displayName || 'Admin',
                email: email,
                uid: user.uid,
                photoURL: user.photoURL || ''
            }, true, false);
        }

        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => { window.location.href = 'admin.html'; }, 800);

    } catch (error) {
        console.error('Google sign-in error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showToast('Sign-in cancelled', 'info');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please try again.', 'error');
        } else {
            showToast('Google sign-in failed: ' + (error.message || 'Unknown error'), 'error');
        }
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}