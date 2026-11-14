'use strict';

// ============================================================================
// Admin Login — Two-Step Verification (Server-Side Auth)
// ============================================================================
// Step 1: Email + Password → server validates → returns verification code
// Step 2: 6-digit verification code → server validates → returns signed token
// Only after both steps is the admin session created.
// ============================================================================

// ─── DOM Elements ───
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const loginBtn = document.getElementById('loginBtn');
const loginSpinner = document.getElementById('loginSpinner');

// Verification step elements
const verifyStep = document.getElementById('verifyStep');
const verifyCodeInput = document.getElementById('verifyCode');
const verifyBtn = document.getElementById('verifyBtn');
const verifySpinner = document.getElementById('verifySpinner');
const verifyBackBtn = document.getElementById('verifyBackBtn');
const verifyResendBtn = document.getElementById('verifyResendBtn');
const verifyEmailDisplay = document.getElementById('verifyEmailDisplay');

// State
let _pendingEmail = null;
let _pendingPassword = null;

// ─── Toggle Password Visibility ───
togglePasswordBtn?.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    const icon = togglePasswordBtn.querySelector('i');
    icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
});

// ─── STEP 1: Login Form Submission ───
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        shakeElement(loginForm);
        return;
    }

    // Show loading state
    loginBtn.disabled = true;
    loginSpinner.style.display = 'inline-block';
    loginBtn.querySelector('.btn-text').textContent = 'Verifying...';

    try {
        // Send credentials to server for validation
        const response = await fetch('/api/admin/verify-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Invalid credentials', 'error');
            shakeElement(loginForm);
            loginBtn.disabled = false;
            loginSpinner.style.display = 'none';
            loginBtn.querySelector('.btn-text').textContent = 'Login';
            return;
        }

        // Credentials valid — move to step 2
        _pendingEmail = email;
        _pendingPassword = password;

        showToast('Credentials verified. Enter the code.', 'success');

        // Show verification step
        showVerificationStep(email, data.code);

    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please try again.', 'error');
        loginBtn.disabled = false;
        loginSpinner.style.display = 'none';
        loginBtn.querySelector('.btn-text').textContent = 'Login';
    }
});

// ─── STEP 2: Show Verification Code Input ───
function showVerificationStep(email, serverCode) {
    // Hide login form, show verification form
    loginForm.style.display = 'none';
    verifyStep.style.display = 'block';

    if (verifyEmailDisplay) {
        verifyEmailDisplay.textContent = email;
    }

    // Clear previous code
    if (verifyCodeInput) {
        verifyCodeInput.value = '';
        verifyCodeInput.focus();
    }

    // Store the code from server for auto-fill hint
    // In production, this would be sent via email/SMS, not returned in response
    if (serverCode && verifyCodeInput) {
        verifyCodeInput.placeholder = `Code sent to your email (${serverCode})`;
    }
}

// ─── STEP 2: Verify Code Submission ───
verifyBtn?.addEventListener('click', async () => {
    const code = verifyCodeInput?.value?.trim();

    if (!code || code.length !== 6) {
        showToast('Please enter the 6-digit verification code', 'error');
        shakeElement(verifyStep);
        return;
    }

    // Show loading state
    verifyBtn.disabled = true;
    verifySpinner.style.display = 'inline-block';
    verifyBtn.querySelector('.btn-text').textContent = 'Verifying...';

    try {
        const response = await fetch('/api/admin/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: _pendingEmail, code })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Invalid verification code', 'error');
            shakeElement(verifyStep);
            verifyBtn.disabled = false;
            verifySpinner.style.display = 'none';
            verifyBtn.querySelector('.btn-text').textContent = 'Verify & Login';
            return;
        }

        // Verification successful — create admin session
        const token = data.token;

        // Store the signed admin session token
        const sessionData = {
            username: _pendingEmail,
            email: _pendingEmail,
            displayName: 'Admin',
            role: 'admin',
            verified: true,
            token: token,
            loginTime: Date.now(),
            expiry: Date.now() + (data.expiresIn * 1000)
        };

        localStorage.setItem('adminSession', JSON.stringify(sessionData));

        // Also create main website session
        if (typeof Auth !== 'undefined' && Auth.createSession) {
            Auth.createSession({
                name: 'Admin',
                email: _pendingEmail,
                uid: 'admin-verified',
                photoURL: '',
                role: 'admin'
            }, true, false);
        }

        showToast('Login successful! Redirecting...', 'success');

        // Redirect to admin dashboard
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 800);

    } catch (error) {
        console.error('Verification error:', error);
        showToast('Network error. Please try again.', 'error');
        verifyBtn.disabled = false;
        verifySpinner.style.display = 'none';
        verifyBtn.querySelector('.btn-text').textContent = 'Verify & Login';
    }
});

// ─── Back to Login ───
verifyBackBtn?.addEventListener('click', () => {
    verifyStep.style.display = 'none';
    loginForm.style.display = 'block';
    _pendingEmail = null;
    _pendingPassword = null;
    loginBtn.disabled = false;
    loginSpinner.style.display = 'none';
    loginBtn.querySelector('.btn-text').textContent = 'Login';
});

// ─── Resend Code ───
verifyResendBtn?.addEventListener('click', async () => {
    if (!_pendingEmail) return;

    verifyResendBtn.disabled = true;
    verifyResendBtn.textContent = 'Sending...';

    try {
        const response = await fetch('/api/admin/verify-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: _pendingEmail, password: _pendingPassword })
        });

        const data = await response.json();

        if (response.ok && data.code) {
            showToast('New code sent!', 'success');
            if (verifyCodeInput) {
                verifyCodeInput.placeholder = `New code: ${data.code}`;
                verifyCodeInput.value = '';
            }
        } else {
            showToast('Failed to resend code', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }

    verifyResendBtn.disabled = false;
    verifyResendBtn.textContent = 'Resend Code';
});

// ─── Check for Existing Session ───
function checkExistingSession() {
    const session = localStorage.getItem('adminSession');
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            if (sessionData.expiry > Date.now() && sessionData.verified && sessionData.token) {
                // Session is valid and verified — redirect to dashboard
                window.location.href = 'admin.html';
                return true;
            } else {
                // Session expired or not verified — clear it
                localStorage.removeItem('adminSession');
            }
        } catch (e) {
            localStorage.removeItem('adminSession');
        }
    }
    return false;
}

// ─── Shake Animation ───
function shakeElement(element) {
    element.style.animation = 'none';
    element.offsetHeight;
    element.style.animation = 'shake 0.5s ease-in-out';

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

// ─── Toast Notifications ───
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

// ─── Add CSS Animations ───
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

// ─── Initialize ───
document.addEventListener('DOMContentLoaded', () => {
    // Check for existing session
    if (checkExistingSession()) return;

    // Add input animations
    [usernameInput, passwordInput, verifyCodeInput].forEach(input => {
        input?.addEventListener('focus', () => {
            input.parentElement.style.borderColor = 'var(--emerald-400)';
            input.parentElement.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)';
        });
        input?.addEventListener('blur', () => {
            input.parentElement.style.borderColor = '';
            input.parentElement.style.boxShadow = '';
        });
    });

    // Auto-focus verification code input when shown
    if (verifyCodeInput) {
        verifyCodeInput.addEventListener('input', (e) => {
            // Auto-submit when 6 digits entered
            if (e.target.value.length === 6) {
                verifyBtn?.click();
            }
        });
    }

    console.log('%c🔐 Tamil AI Stream Admin Login', 'font-size:18px;font-weight:bold;color:#34d399;');
    console.log('%cTwo-Step Verification Required', 'font-size:12px;color:#6ee7b7;');
});
