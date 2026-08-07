'use strict';

// ============================================
// DOM Elements
// ============================================
const DOM = {
    // Profile Elements
    profileAvatar: document.getElementById('profileAvatar'),
    profileImage: document.getElementById('profileImage'),
    avatarPlaceholder: document.getElementById('avatarPlaceholder'),
    changePhotoBtn: document.getElementById('changePhotoBtn'),
    photoInput: document.getElementById('photoInput'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    accountTypeBadge: document.getElementById('accountTypeBadge'),
    authStatusBadge: document.getElementById('authStatusBadge'),
    
    // Stats
    favoritesCount: document.getElementById('favoritesCount'),
    recentCount: document.getElementById('recentCount'),
    listeningTime: document.getElementById('listeningTime'),
    playlistsCount: document.getElementById('playlistsCount'),
    
    // Settings
    settingEmail: document.getElementById('settingEmail'),
    settingPhone: document.getElementById('settingPhone'),
    settingBio: document.getElementById('settingBio'),
    memberSince: document.getElementById('memberSince'),
    
    // Buttons
    backBtn: document.getElementById('backBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    logoutBtnBottom: document.getElementById('logoutBtnBottom'),
    editNameBtn: document.getElementById('editNameBtn'),
    editEmailBtn: document.getElementById('editEmailBtn'),
    editPhoneBtn: document.getElementById('editPhoneBtn'),
    editBioBtn: document.getElementById('editBioBtn'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    deleteAccountBtn: document.getElementById('deleteAccountBtn'),
    favoritesBtn: document.getElementById('favoritesBtn'),
    recentlyPlayedBtn: document.getElementById('recentlyPlayedBtn'),
    downloadsBtn: document.getElementById('downloadsBtn'),
    playlistsBtn: document.getElementById('playlistsBtn'),
    likedArtistsBtn: document.getElementById('likedArtistsBtn'),
    helpBtn: document.getElementById('helpBtn'),
    privacyBtn: document.getElementById('privacyBtn'),
    termsBtn: document.getElementById('termsBtn'),
    aboutBtn: document.getElementById('aboutBtn'),
    notificationsToggle: document.getElementById('notificationsToggle'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    languageSelect: document.getElementById('languageSelect')
};

// localStorage-based data persistence
let db = null; // localStorage-based

// ============================================
// Toast Notification System
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

// Inject toast styles if not already present
if (!document.querySelector('#toast-style')) {
    const toastStyle = document.createElement('style');
    toastStyle.id = 'toast-style';
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
}

// ============================================
// Modal System
// ============================================
function showModal(title, content, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-cancel">Cancel</button>
                <button class="btn btn-primary modal-confirm">Confirm</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const close = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };
    
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.modal-cancel').addEventListener('click', () => {
        close();
        if (onCancel) onCancel();
    });
    overlay.querySelector('.modal-confirm').addEventListener('click', () => {
        close();
        if (onConfirm) onConfirm();
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
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
    
    init() {
        this.resize();
        this.createParticles();
        this.bindEvents();
        this.animate();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        const count = Math.min(Math.floor((this.canvas.width * this.canvas.height) / 12000), 80);
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2.5 + 0.5,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
                opacity: Math.random() * 0.5 + 0.1,
                pulse: Math.random() * Math.PI * 2
            });
        }
    }
    
    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        document.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles.forEach((p, i) => {
            p.pulse += 0.02;
            p.x += p.speedX;
            p.y += p.speedY;
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
            if (this.mouse.x !== null) {
                const dx = this.mouse.x - p.x;
                const dy = this.mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouse.radius) {
                    const force = (this.mouse.radius - dist) / this.mouse.radius;
                    p.x -= dx * force * 0.02;
                    p.y -= dy * force * 0.02;
                }
            }
            const pulseOpacity = p.opacity + Math.sin(p.pulse) * 0.1;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(52, 211, 153, ${pulseOpacity})`;
            this.ctx.fill();
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = p.x - this.particles[j].x;
                const dy = p.y - this.particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(52, 211, 153, ${0.08 * (1 - dist / 120)})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        });
        requestAnimationFrame(() => this.animate());
    }
}

// ============================================
// User Data Management
// ============================================
let currentUser = null;
let userData = {
    name: 'User',
    email: '',
    phone: '',
    bio: '',
    photoURL: '',
    memberSince: '',
    accountType: 'User',
    isGuest: false
};

/**
 * Load user data from localStorage
 */
async function loadUserData() {
    try {
        // Read from localStorage
        const stored = localStorage.getItem('tamilAIFM_user');
        if (stored) {
            const saved = JSON.parse(stored);
            userData.name = saved.name || 'User';
            userData.email = saved.email || '';
            userData.phone = saved.phone || '';
            userData.bio = saved.bio || '';
            userData.photoURL = saved.photoURL || '';
            userData.memberSince = saved.memberSince || '';
            userData.password = saved.password || '';

            // Determine account type
            const isAdmin = userData.email === 'admin@tamilaifm.com';
            if (isAdmin) {
                userData.accountType = 'Admin';
                DOM.accountTypeBadge.innerHTML = '<i class="fas fa-crown"></i> <span>Admin</span>';
            } else {
                userData.accountType = 'User';
                DOM.accountTypeBadge.innerHTML = '<i class="fas fa-user"></i> <span>User</span>';
            }

            DOM.authStatusBadge.innerHTML = '<i class="fas fa-check-circle"></i> <span>Verified</span>';
        } else {
            // No stored user, create defaults
            userData.memberSince = new Date().toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });
            DOM.authStatusBadge.innerHTML = '<i class="fas fa-times-circle"></i> <span>Not Verified</span>';
        }

        updateProfileUI();
        loadUserStats();
        loadUserPreferences();

    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading profile data', 'error');
    }
}

/**
 * Update profile UI with user data
 */
function updateProfileUI() {
    DOM.profileName.textContent = userData.name;
    DOM.profileEmail.textContent = userData.email;
    DOM.settingEmail.textContent = userData.email;
    DOM.settingPhone.textContent = userData.phone || 'Not set';
    DOM.settingBio.textContent = userData.bio || 'Tell us about yourself';
    DOM.memberSince.textContent = userData.memberSince || 'January 2024';
    
    // Update profile photo
    if (userData.photoURL) {
        DOM.profileImage.src = userData.photoURL;
        DOM.profileImage.style.display = 'block';
        DOM.avatarPlaceholder.style.display = 'none';
    } else {
        DOM.profileImage.style.display = 'none';
        DOM.avatarPlaceholder.style.display = 'flex';
    }
}

/**
 * Load user statistics
 */
async function loadUserStats() {
    try {
        // Favorites count
        const favorites = localStorage.getItem('tamilAIFM_favorites');
        const favCount = favorites ? JSON.parse(favorites).length : 0;
        DOM.favoritesCount.textContent = favCount;
        
        // Recently played count
        const recent = localStorage.getItem('tamilAIFM_recent');
        const recentCount = recent ? JSON.parse(recent).length : 0;
        DOM.recentCount.textContent = recentCount;
        
        // Listening time (mock data - would come from Firestore in production)
        DOM.listeningTime.textContent = '24h';
        
        // Playlists count
        const playlists = localStorage.getItem('tamilAIFM_playlists');
        const playlistCount = playlists ? JSON.parse(playlists).length : 0;
        DOM.playlistsCount.textContent = playlistCount;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/**
 * Load user preferences
 */
function loadUserPreferences() {
    // Notifications
    const notifications = localStorage.getItem('tamilAIFM_notifications');
    DOM.notificationsToggle.checked = notifications !== 'false';
    
    // Dark mode
    const darkMode = localStorage.getItem('tamilAIFM_darkMode');
    DOM.darkModeToggle.checked = darkMode !== 'false';
    
    // Language
    const language = localStorage.getItem('tamilAIFM_language') || 'en';
    DOM.languageSelect.value = language;
}

// ============================================
// Profile Photo Upload
// ============================================
DOM.changePhotoBtn?.addEventListener('click', () => {
    DOM.photoInput?.click();
});

DOM.photoInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB', 'error');
        return;
    }
    
    try {
        showToast('Uploading photo...', 'info');
        
        // Convert to base64 for demo
        const reader = new FileReader();
        reader.onload = async (e) => {
            const photoURL = e.target.result;
            
            // Update UI
            DOM.profileImage.src = photoURL;
            DOM.profileImage.style.display = 'block';
            DOM.avatarPlaceholder.style.display = 'none';
            
            // Update localStorage
            userData.photoURL = photoURL;
            const stored = localStorage.getItem('tamilAIFM_user');
            const saved = stored ? JSON.parse(stored) : {};
            saved.photoURL = photoURL;
            localStorage.setItem('tamilAIFM_user', JSON.stringify(saved));

            showToast('Profile photo updated!', 'success');
        };
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('Error uploading photo:', error);
        showToast('Failed to upload photo', 'error');
    }
});

// ============================================
// Edit Profile Fields
// ============================================
DOM.editNameBtn?.addEventListener('click', () => {
    showModal(
        'Edit Display Name',
        `
            <div class="form-group">
                <label class="form-label">Display Name</label>
                <input type="text" class="form-input" id="editNameInput" value="${userData.name}" placeholder="Enter your name">
            </div>
        `,
        async () => {
            const newName = document.getElementById('editNameInput').value.trim();
            if (!newName) {
                showToast('Name cannot be empty', 'error');
                return;
            }
            
            try {
                // Update localStorage
                userData.name = newName;
                const stored = localStorage.getItem('tamilAIFM_user');
                const saved = stored ? JSON.parse(stored) : {};
                saved.name = newName;
                localStorage.setItem('tamilAIFM_user', JSON.stringify(saved));
                
                updateProfileUI();
                showToast('Name updated successfully!', 'success');
            } catch (error) {
                console.error('Error updating name:', error);
                showToast('Failed to update name', 'error');
            }
        }
    );
});

DOM.editEmailBtn?.addEventListener('click', () => {
    showModal(
        'Edit Email Address',
        `
            <div class="form-group">
                <label class="form-label">Email Address</label>
                <input type="email" class="form-input" id="editEmailInput" value="${userData.email}" placeholder="Enter your email">
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
                <i class="fas fa-info-circle"></i> Changing email requires verification
            </p>
        `,
        async () => {
            const newEmail = document.getElementById('editEmailInput').value.trim();
            if (!newEmail || !newEmail.includes('@')) {
                showToast('Please enter a valid email', 'error');
                return;
            }
            
            try {
                // Update localStorage
                userData.email = newEmail;
                const stored = localStorage.getItem('tamilAIFM_user');
                const saved = stored ? JSON.parse(stored) : {};
                saved.email = newEmail;
                localStorage.setItem('tamilAIFM_user', JSON.stringify(saved));
                
                updateProfileUI();
                showToast('Email updated!', 'success');
            } catch (error) {
                console.error('Error updating email:', error);
                showToast('Failed to update email.', 'error');
            }
        }
    );
});

DOM.editPhoneBtn?.addEventListener('click', () => {
    showModal(
        'Edit Phone Number',
        `
            <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="tel" class="form-input" id="editPhoneInput" value="${userData.phone}" placeholder="Enter your phone number">
            </div>
        `,
        async () => {
            const newPhone = document.getElementById('editPhoneInput').value.trim();
            
            try {
                // Update localStorage
                userData.phone = newPhone;
                const stored = localStorage.getItem('tamilAIFM_user');
                const saved = stored ? JSON.parse(stored) : {};
                saved.phone = newPhone;
                localStorage.setItem('tamilAIFM_user', JSON.stringify(saved));
                
                updateProfileUI();
                showToast('Phone number updated!', 'success');
            } catch (error) {
                console.error('Error updating phone:', error);
                showToast('Failed to update phone', 'error');
            }
        }
    );
});

DOM.editBioBtn?.addEventListener('click', () => {
    showModal(
        'Edit Bio',
        `
            <div class="form-group">
                <label class="form-label">Bio</label>
                <textarea class="form-input" id="editBioInput" placeholder="Tell us about yourself">${userData.bio}</textarea>
            </div>
        `,
        async () => {
            const newBio = document.getElementById('editBioInput').value.trim();
            
            try {
                // Update localStorage
                userData.bio = newBio;
                const stored = localStorage.getItem('tamilAIFM_user');
                const saved = stored ? JSON.parse(stored) : {};
                saved.bio = newBio;
                localStorage.setItem('tamilAIFM_user', JSON.stringify(saved));
                
                updateProfileUI();
                showToast('Bio updated!', 'success');
            } catch (error) {
                console.error('Error updating bio:', error);
                showToast('Failed to update bio', 'error');
            }
        }
    );
});

// ============================================
// Change Password
// ============================================
DOM.changePasswordBtn?.addEventListener('click', () => {
    showModal(
        'Change Password',
        `
            <div class="form-group">
                <label class="form-label">Current Password</label>
                <input type="password" class="form-input" id="currentPassword" placeholder="Enter current password">
            </div>
            <div class="form-group">
                <label class="form-label">New Password</label>
                <input type="password" class="form-input" id="newPassword" placeholder="Enter new password (min 8 characters)">
            </div>
            <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input type="password" class="form-input" id="confirmNewPassword" placeholder="Confirm new password">
            </div>
        `,
        async () => {
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                showToast('Please fill all fields', 'error');
                return;
            }
            
            if (newPassword.length < 8) {
                showToast('Password must be at least 8 characters', 'error');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showToast('Passwords do not match', 'error');
                return;
            }
            
            try {
                // Validate current password against localStorage
                const stored = localStorage.getItem('tamilAIFM_user');
                const saved = stored ? JSON.parse(stored) : {};
                if (saved.password && saved.password !== currentPassword) {
                    showToast('Current password is incorrect', 'error');
                    return;
                }

                // Update localStorage
                saved.password = newPassword;
                localStorage.setItem('tamilAIFM_user', JSON.stringify(saved));
                
                showToast('Password changed successfully!', 'success');
            } catch (error) {
                console.error('Error changing password:', error);
                showToast('Failed to change password. Please check your current password.', 'error');
            }
        }
    );
});

// ============================================
// Delete Account
// ============================================
DOM.deleteAccountBtn?.addEventListener('click', () => {
    showModal(
        'Delete Account',
        `
            <div style="text-align: center; padding: 20px 0;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ef4444; margin-bottom: 16px;"></i>
                <h4 style="margin-bottom: 12px; color: #ef4444;">This action cannot be undone!</h4>
                <p style="color: var(--text-secondary);">All your data, including favorites, playlists, and listening history will be permanently deleted.</p>
            </div>
            <div class="form-group">
                <label class="form-label">Type "DELETE" to confirm</label>
                <input type="text" class="form-input" id="deleteConfirmInput" placeholder="Type DELETE">
            </div>
        `,
        async () => {
            const confirmText = document.getElementById('deleteConfirmInput').value;
            if (confirmText !== 'DELETE') {
                showToast('Please type DELETE to confirm', 'error');
                return;
            }
            
            try {
                showToast('Deleting account...', 'info');
                
                // Clear localStorage and sessionStorage
                localStorage.clear();
                sessionStorage.clear();
                
                showToast('Account deleted successfully', 'success');
                
                // Redirect to login
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
                
            } catch (error) {
                console.error('Error deleting account:', error);
                showToast('Failed to delete account.', 'error');
            }
        }
    );
});

// ============================================
// Logout
// ============================================
function logout() {
    showModal(
        'Logout',
        `
            <div style="text-align: center; padding: 20px 0;">
                <i class="fas fa-sign-out-alt" style="font-size: 48px; color: var(--emerald-400); margin-bottom: 16px;"></i>
                <h4 style="margin-bottom: 12px;">Are you sure you want to logout?</h4>
                <p style="color: var(--text-secondary);">You will need to sign in again to access your account.</p>
            </div>
        `,
        async () => {
            try {
                // Clear localStorage and sessionStorage
                localStorage.clear();
                sessionStorage.clear();
                
                showToast('Logged out successfully', 'success');
                
                // Redirect to login
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
                
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Error during logout', 'error');
            }
        }
    );
}

DOM.logoutBtn?.addEventListener('click', logout);
DOM.logoutBtnBottom?.addEventListener('click', logout);

// ============================================
// Back Button
// ============================================
DOM.backBtn?.addEventListener('click', () => {
    window.history.back();
});

// ============================================
// Preferences
// ============================================
DOM.notificationsToggle?.addEventListener('change', (e) => {
    localStorage.setItem('tamilAIFM_notifications', e.target.checked);
    showToast(e.target.checked ? 'Notifications enabled' : 'Notifications disabled', 'info');
});

DOM.darkModeToggle?.addEventListener('change', (e) => {
    localStorage.setItem('tamilAIFM_darkMode', e.target.checked);
    showToast(e.target.checked ? 'Dark mode enabled' : 'Light mode enabled', 'info');
    // In production, toggle CSS class on body
});

DOM.languageSelect?.addEventListener('change', (e) => {
    localStorage.setItem('tamilAIFM_language', e.target.value);
    showToast(`Language changed to ${e.target.value === 'ta' ? 'Tamil' : 'English'}`, 'success');
    // In production, reload page with new language
});

// ============================================
// Content Buttons - Navigate to respective pages
// ============================================
DOM.favoritesBtn?.addEventListener('click', () => {
    window.location.href = 'index.html#favorites';
});

DOM.recentlyPlayedBtn?.addEventListener('click', () => {
    window.location.href = 'index.html#recent';
});

DOM.downloadsBtn?.addEventListener('click', () => {
    window.location.href = 'index.html#downloads';
});

DOM.playlistsBtn?.addEventListener('click', () => {
    window.location.href = 'playlist.html';
});

DOM.likedArtistsBtn?.addEventListener('click', () => {
    window.location.href = 'index.html#artists';
});

// ============================================
// About & Support
// ============================================
DOM.helpBtn?.addEventListener('click', () => {
    showModal(
        'Help & Support',
        `
            <div style="padding: 20px 0;">
                <h4 style="margin-bottom: 16px; color: var(--emerald-400);">Contact Us</h4>
                <p style="margin-bottom: 12px;"><i class="fas fa-envelope" style="width: 20px;"></i> support@tamilaifm.com</p>
                <p style="margin-bottom: 12px;"><i class="fas fa-phone" style="width: 20px;"></i> +91 98765 43210</p>
                <p style="margin-bottom: 12px;"><i class="fas fa-clock" style="width: 20px;"></i> 24/7 Support</p>
                <hr style="border-color: var(--border-glass); margin: 20px 0;">
                <h4 style="margin-bottom: 12px; color: var(--emerald-400);">FAQs</h4>
                <p style="color: var(--text-secondary); margin-bottom: 8px;">• How do I create an account?</p>
                <p style="color: var(--text-secondary); margin-bottom: 8px;">• How do I download songs?</p>
                <p style="color: var(--text-secondary); margin-bottom: 8px;">• How do I report a bug?</p>
            </div>
        `,
        null,
        () => {}
    );
});

DOM.privacyBtn?.addEventListener('click', () => {
    showModal(
        'Privacy Policy',
        `
            <div style="padding: 20px 0; max-height: 400px; overflow-y: auto;">
                <h4 style="margin-bottom: 16px; color: var(--emerald-400);">Privacy Policy</h4>
                <p style="margin-bottom: 12px; color: var(--text-secondary);">Last updated: January 2024</p>
                <h5 style="margin-top: 16px; margin-bottom: 8px;">1. Information We Collect</h5>
                <p style="color: var(--text-secondary); margin-bottom: 12px;">We collect information you provide directly to us, such as your name, email address, and profile information.</p>
                <h5 style="margin-top: 16px; margin-bottom: 8px;">2. How We Use Your Information</h5>
                <p style="color: var(--text-secondary); margin-bottom: 12px;">We use your information to provide and improve our services, personalize your experience, and communicate with you.</p>
                <h5 style="margin-top: 16px; margin-bottom: 8px;">3. Data Security</h5>
                <p style="color: var(--text-secondary); margin-bottom: 12px;">We implement appropriate security measures to protect your personal information from unauthorized access.</p>
            </div>
        `,
        null,
        () => {}
    );
});

DOM.termsBtn?.addEventListener('click', () => {
    showModal(
        'Terms & Conditions',
        `
            <div style="padding: 20px 0; max-height: 400px; overflow-y: auto;">
                <h4 style="margin-bottom: 16px; color: var(--emerald-400);">Terms & Conditions</h4>
                <p style="margin-bottom: 12px; color: var(--text-secondary);">Last updated: January 2024</p>
                <h5 style="margin-top: 16px; margin-bottom: 8px;">1. Acceptance of Terms</h5>
                <p style="color: var(--text-secondary); margin-bottom: 12px;">By accessing or using Tamil AI FM, you agree to be bound by these terms.</p>
                <h5 style="margin-top: 16px; margin-bottom: 8px;">2. User Responsibilities</h5>
                <p style="color: var(--text-secondary); margin-bottom: 12px;">You are responsible for maintaining the confidentiality of your account and password.</p>
                <h5 style="margin-top: 16px; margin-bottom: 8px;">3. Intellectual Property</h5>
                <p style="color: var(--text-secondary); margin-bottom: 12px;">All content provided on Tamil AI FM is the property of Tamil AI FM or its licensors.</p>
            </div>
        `,
        null,
        () => {}
    );
});

DOM.aboutBtn?.addEventListener('click', () => {
    showModal(
        'About Tamil AI FM',
        `
            <div style="text-align: center; padding: 20px 0;">
                <div class="logo-icon" style="width: 80px; height: 80px; margin: 0 auto 16px; background: var(--gradient-brand); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 36px; color: white; box-shadow: 0 4px 16px rgba(16,185,129,0.3);">
                    <i class="fas fa-microphone-alt"></i>
                </div>
                <h4 style="margin-bottom: 8px; background: var(--gradient-brand); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Tamil AI FM</h4>
                <p style="color: var(--text-secondary); margin-bottom: 16px;">AI-Powered Tamil Radio</p>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 8px;">Version 1.0.0</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">© 2024 Tamil AI FM. All rights reserved.</p>
                <hr style="border-color: var(--border-glass); margin: 20px 0;">
                <p style="font-size: 0.85rem; color: var(--text-muted);">Built with ❤️ for Tamil music lovers</p>
            </div>
        `,
        null,
        () => {}
    );
});

// ============================================
// Authentication Check
// ============================================
function checkAuth() {
    const isLoggedIn = localStorage.getItem('tamilAIFM_loggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!checkAuth()) return;
    
    // Initialize particle system
    new ParticleSystem('particles-canvas');
    
    // Load user data
    loadUserData();
    
    console.log('%c🎙️ Tamil AI FM', 'font-size:24px;font-weight:bold;color:#34d399;');
    console.log('%cProfile Page Loaded', 'font-size:14px;color:#6ee7b7;');
});