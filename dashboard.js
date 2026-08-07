'use strict';

// ============================================
// DOM Elements
// ============================================
const DOM = {
    userName: document.getElementById('userName'),
    userAvatar: document.getElementById('userAvatar'),
    startListening: document.getElementById('startListening'),
    exploreStations: document.getElementById('exploreStations')
};

// ============================================
// Check Authentication
// ============================================
function checkAuth() {
    const isLoggedIn = localStorage.getItem('tamilAIStream_loggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ============================================
// Load User Data
// ============================================
function loadUserData() {
    const userData = localStorage.getItem('tamilAIStream_user');
    if (userData && DOM.userName) {
        try {
            const user = JSON.parse(userData);
            DOM.userName.textContent = user.name || 'User';
        } catch (e) {
            DOM.userName.textContent = 'User';
        }
    }
}

// ============================================
// Logout Function
// ============================================
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('tamilAIStream_loggedIn');
        localStorage.removeItem('tamilAIStream_user');
        localStorage.removeItem('tamilAIStream_rememberEmail');
        localStorage.removeItem('tamilAIStream_rememberMe');

        window.location.href = 'login.html';
    }
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
// Avatar Click - Logout
// ============================================
DOM.userAvatar?.addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        logout();
    }
});

// ============================================
// Button Interactions
// ============================================
DOM.startListening?.addEventListener('click', function() {
    alert('🎵 Starting playback... Feature coming soon!');
});

DOM.exploreStations?.addEventListener('click', function() {
    window.location.href = 'index.html';
});

// ============================================
// Keyboard Shortcut for Logout
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        logout();
    }
});

// ============================================
// Bottom Navigation
// ============================================
document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        switch(tab) {
            case 'home':
                window.location.href = 'index.html';
                break;
            case 'search':
                window.location.href = 'index.html#search';
                break;
            case 'favorites':
                window.location.href = 'index.html#favorites';
                break;
            case 'profile':
                window.location.href = 'profile.html';
                break;
        }
    });
});

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    new ParticleSystem('particles-canvas');
    loadUserData();
    console.log('%c🎙️ Tamil AI Stream', 'font-size:24px;font-weight:bold;color:#34d399;');
    console.log('%cDashboard Loaded', 'font-size:14px;color:#6ee7b7;');
    console.log('%cPress Ctrl+Q to logout', 'font-size:12px;color:#a7f3d0;');
});