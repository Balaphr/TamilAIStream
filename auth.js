'use strict';

// ============================================================================
// auth.js — Centralized Authentication & Route Guard for Tamil AI Stream
// ----------------------------------------------------------------------------
// Load this file (via <script src="auth.js"></script>) on EVERY page BEFORE
// the page's own scripts. It exposes a global `window.Auth` object used by all
// protected pages to:
//
//   * create a valid session (flag + user + random token + expiry)
//   * validate the session on every page load (expiry + token integrity)
//   * gate routes via requireAuth() -> redirects to login.html?redirect=...
//   * redirect back to the originally requested page after login
//   * fully clear all auth state (localStorage, sessionStorage & cookies)
//
// Works on localhost, GitHub Pages, Cloudflare Pages, desktop & mobile.
// ============================================================================

window.Auth = (function () {
    // ----- Storage keys (must match the rest of the app) -----
    var K = {
        LOGGED_IN: 'tamilAIStream_loggedIn',
        USER: 'tamilAIStream_user',
        GUEST: 'tamilAIStream_guest',
        REMEMBER: 'tamilAIStream_rememberMe',
        REMEMBER_EMAIL: 'tamilAIStream_rememberEmail',
        ADMIN: 'adminSession',
        TOKEN: 'tamilAIStream_sessionToken'
    };

    var SESSION_DURATION = 24 * 60 * 60 * 1000;              // 24h (non-remembered)
    var REMEMBER_DURATION = 30 * 24 * 60 * 60 * 1000;        // 30 days (remembered)

    function now() { return Date.now(); }

    function genToken() {
        return 'tls-' + now().toString(36) + '-' +
            Math.random().toString(36).slice(2, 10) + '-' +
            Math.random().toString(36).slice(2, 8);
    }

    // ----- Guarded storage helpers (never throw, file:// safe) -----
    function lsGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function lsSet(key, val) {
        try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
    }
    function lsRemove(key) {
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
    function ssGet(key) {
        try { return sessionStorage.getItem(key); } catch (e) { return null; }
    }
    function ssSet(key, val) {
        try { sessionStorage.setItem(key, val); } catch (e) { /* ignore */ }
    }
    function ssRemove(key) {
        try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
    }

    function getStoredUser() {
        var raw = lsGet(K.USER);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    }
// Store the session token in sessionStorage (tab-scoped) and, for
    // remembered sessions, in localStorage + a long-lived cookie.
    function storeToken(token, remember) {
        ssSet(K.TOKEN, token);
        try {
            if (remember) {
                lsSet(K.TOKEN, token);
                document.cookie = K.TOKEN + '=' + encodeURIComponent(token) +
                    '; max-age=' + Math.round(REMEMBER_DURATION / 1000) + '; path=/; SameSite=Lax';
            } else {
                lsRemove(K.TOKEN);
                document.cookie = K.TOKEN + '=' + encodeURIComponent(token) +
                    '; path=/; SameSite=Lax';   // session cookie - dies with the browser
            }
        } catch (e) { /* ignore */ }
    }

    function getToken() {
        var t = ssGet(K.TOKEN) || lsGet(K.TOKEN);
        if (t) return t;
        try {
            var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + K.TOKEN + '=([^;]+)'));
            if (match) return decodeURIComponent(match[1]);
        } catch (e) { /* ignore */ }
        return null;
    }

    // --------------------------------------------------------------------------
    // Session creation
    // --------------------------------------------------------------------------
    function createSession(userData, remember, isGuest) {
        remember = !!remember;
        isGuest = !!isGuest;

        var token = genToken();
        var nowMs = now();
        var duration = remember ? REMEMBER_DURATION : SESSION_DURATION;

        var sessionUser = {};
        for (var key in userData) {
            if (Object.prototype.hasOwnProperty.call(userData, key)) {
                sessionUser[key] = userData[key];
            }
        }
        sessionUser.token = token;
        sessionUser.loginTime = nowMs;
        sessionUser.expiry = nowMs + duration;
        sessionUser.isGuest = isGuest;

        lsSet(K.LOGGED_IN, 'true');
        lsSet(K.USER, JSON.stringify(sessionUser));
        if (isGuest) { lsSet(K.GUEST, 'true'); } else { lsRemove(K.GUEST); }
        if (remember) { lsSet(K.REMEMBER, 'true'); } else { lsRemove(K.REMEMBER); }

        storeToken(token, remember);
        return sessionUser;
    }

    // --------------------------------------------------------------------------
    // Validation — the single place every route guard should trust.
    // Missing / expired / tampered sessions are auto-cleared here.
    // --------------------------------------------------------------------------
    function isAuthenticated() {
        if (lsGet(K.LOGGED_IN) !== 'true') return false;

        var user = getStoredUser();
        if (!user || !user.email) {
            clearAll();
            return false;
        }
        if (user.expiry && user.expiry < now()) {
            clearAll();
            return false;
        }
        if (user.token) {
            var token = getToken();
            if (!token || token !== user.token) {
                clearAll();
                return false;
            }
        }
        return true;
    }

    function currentUser() {
        if (!isAuthenticated()) return null;
        return getStoredUser();
    }

    function isAdmin() {
        // Valid adminSession (created by admin-login / demo login / builder).
        try {
            var s = JSON.parse(lsGet(K.ADMIN) || 'null');
            if (s && s.expiry && s.expiry > now()) return true;
        } catch (e) { /* ignore */ }
        // Admin main-site session also grants admin access.
        try {
            var u = getStoredUser();
            if (u && u.expiry && u.expiry > now() && /admin@tamilaistream\.com/i.test(u.email || '')) {
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    // --------------------------------------------------------------------------
    // Route guards
    // --------------------------------------------------------------------------
    function currentPageName() {
        var p = window.location.pathname.split('/').pop() || 'index.html';
        return p.split('?')[0];
    }

    function getRedirect() {
        var target = 'index.html';
        try {
            var r = new URLSearchParams(window.location.search).get('redirect');
            if (r && decodeURIComponent(r).trim()) {
                var decoded = decodeURIComponent(r).trim();
                // Block open redirects / absolute URLs.
                if (!/^(https?:)?\/\//i.test(decoded) &&
                    !decoded.startsWith('login.html') &&
                    !decoded.startsWith('admin-login.html')) {
                    target = decoded;
                }
            }
        } catch (e) { /* ignore */ }
        return target;
    }

    /**
     * If the visitor is not authenticated, clear any stale data and send them
     * to login.html while remembering where they were headed.
     */
    function requireAuth() {
        if (isAuthenticated()) return true;

        var page = currentPageName();
        if (page === 'login.html' || page === 'admin-login.html') return false;

        clearAll();
        var target = encodeURIComponent(page + window.location.hash);
        window.location.replace('login.html?redirect=' + target);
        return false;
    }

    /** Redirect after a successful login (home or the requested page). */
    function afterLogin() {
        window.location.replace(getRedirect());
    }

    // --------------------------------------------------------------------------
    // Logout / cleanup
    // --------------------------------------------------------------------------
    function clearAuthCookies() {
        try {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var name = cookies[i].split('=')[0].trim();
                if (!name) continue;
                // Clear anything that looks like an auth / session / token cookie.
                if (/(session|token|auth|login|remember|firebase|tamil|google)/i.test(name)) {
                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
                }
            }
        } catch (e) { /* ignore */ }
    }

    /** Remove every auth key from localStorage, sessionStorage and cookies. */
    function clearAll() {
        var keys = [K.LOGGED_IN, K.USER, K.GUEST, K.REMEMBER, K.REMEMBER_EMAIL, K.ADMIN, K.TOKEN];
        for (var i = 0; i < keys.length; i++) {
            lsRemove(keys[i]);
            ssRemove(keys[i]);
        }
        clearAuthCookies();
    }

    /** Full logout: clear everything and return to the login page. */
    function logout() {
        clearAll();
        window.location.href = 'login.html';
    }

    // Public API
    return {
        createSession: createSession,
        isAuthenticated: isAuthenticated,
        currentUser: currentUser,
        isAdmin: isAdmin,
        requireAuth: requireAuth,
        getRedirect: getRedirect,
        afterLogin: afterLogin,
        clearAll: clearAll,
        logout: logout
    };
})();