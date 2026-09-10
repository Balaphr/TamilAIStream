'use strict';

// ============================================================================
// access-control.js — Centralized Music Access & Subscription System
// ----------------------------------------------------------------------------
// One consistent system for all entry points: Desktop, Mobile, Tablet, PWA.
//
// Flow:
//   1. Guest opens site → can browse → clicks Play → 10s playback allowed
//   2. After 10s → Login popup → song pauses → must log in to continue
//   3. After login → 1-month free trial starts automatically
//   4. During trial → full music access
//   5. After trial expires → Upgrade/Subscription popup → must subscribe
//   6. After subscription → full music access restored
//
// Load BEFORE unified-player.js and script.js on every page.
// ============================================================================

window.AccessControl = (function () {
    'use strict';

    // ─── Storage Keys (base, will be suffixed with userId) ───
    var K = {
        TRIAL_START: 'tamilAIStream_trialStart',
        TRIAL_EXPIRY: 'tamilAIStream_trialExpiry',
        SUBSCRIPTION_STATUS: 'tamilAIStream_subscriptionStatus',
        SUBSCRIPTION_PLAN: 'tamilAIStream_subscriptionPlan',
        SUBSCRIPTION_START: 'tamilAIStream_subscriptionStart',
        SUBSCRIPTION_EXPIRY: 'tamilAIStream_subscriptionExpiry',
        GUEST_PLAYED: 'tamilAIStream_guestPlayed',
    };

    // ─── Constants ───
    var TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    var GUEST_TRIAL_SECONDS = 10; // 10 seconds for non-logged-in users

    // ─── Internal State ───
    var _guestTimer = null;
    var _guestElapsed = 0;
    var _popupShown = false;
    var _currentAudioEl = null;
    var _onLoginCallback = null;
    var _onUpgradeCallback = null;

    // ─── Helpers ───
    function lsGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function lsSet(key, val) {
        try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
    }
    function lsRemove(key) {
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }

    // ─── User-scoped key helper ───
    // FAIL CLOSED: if UserDataSync is unavailable, use guest scope instead of
    // falling back to the un-scoped base key. This prevents trial/subscription
    // data from leaking between users on the same browser.
    function _scopedKey(baseKey) {
        try {
            if (typeof UserDataSync !== 'undefined' && UserDataSync.scopedKey) {
                return UserDataSync.scopedKey(baseKey);
            }
        } catch (e) {}
        try {
            const u = JSON.parse(localStorage.getItem('tamilAIStream_user') || 'null');
            const uid = u?.uid || u?.email;
            if (uid) return baseKey + '_' + uid.replace(/[^a-zA-Z0-9._@-]/g, '_');
        } catch(e) {}
        return baseKey + '_guest';
    }
    function _lsGetScoped(baseKey) { return lsGet(_scopedKey(baseKey)); }
    function _lsSetScoped(baseKey, val) { lsSet(_scopedKey(baseKey), val); }
    function _lsRemoveScoped(baseKey) { lsRemove(_scopedKey(baseKey)); }

    // ─── Auth Check (delegates to window.Auth) ───
    function isLoggedIn() {
        try {
            if (window.Auth && typeof Auth.isAuthenticated === 'function') {
                return Auth.isAuthenticated();
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function isGuest() {
        try {
            if (window.Auth && typeof Auth.isGuest === 'function') {
                return Auth.isGuest();
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    // ─── Trial Management ───
    function getTrialStart() {
        var v = _lsGetScoped(K.TRIAL_START);
        return v ? parseInt(v, 10) : 0;
    }

    function getTrialExpiry() {
        var v = _lsGetScoped(K.TRIAL_EXPIRY);
        return v ? parseInt(v, 10) : 0;
    }

    function startTrial() {
        var now = Date.now();
        var expiry = now + TRIAL_DURATION_MS;
        _lsSetScoped(K.TRIAL_START, now.toString());
        _lsSetScoped(K.TRIAL_EXPIRY, expiry.toString());
        return { start: now, expiry: expiry };
    }

    function isTrialActive() {
        if (!isLoggedIn()) return false;
        var expiry = getTrialExpiry();
        if (!expiry) {
            // No trial exists yet — start one now
            var trial = startTrial();
            return true;
        }
        return Date.now() < expiry;
    }

    function isTrialExpired() {
        if (!isLoggedIn()) return false;
        var expiry = getTrialExpiry();
        if (!expiry) return false;
        return Date.now() >= expiry;
    }

    function getTrialDaysRemaining() {
        var expiry = getTrialExpiry();
        if (!expiry) return 0;
        var remaining = expiry - Date.now();
        if (remaining <= 0) return 0;
        return Math.ceil(remaining / (24 * 60 * 60 * 1000));
    }

    // ─── Subscription Management ───
    function getSubscriptionStatus() {
        return _lsGetScoped(K.SUBSCRIPTION_STATUS) || 'none'; // 'none' | 'active' | 'expired' | 'cancelled'
    }

    function getSubscriptionPlan() {
        return _lsGetScoped(K.SUBSCRIPTION_PLAN) || 'free';
    }

    function isSubscribed() {
        var status = getSubscriptionStatus();
        if (status !== 'active') return false;
        var expiry = _lsGetScoped(K.SUBSCRIPTION_EXPIRY);
        if (expiry) {
            return Date.now() < parseInt(expiry, 10);
        }
        return true; // No expiry set = lifetime
    }

    function setSubscription(plan, durationMs) {
        var now = Date.now();
        var expiry = durationMs ? now + durationMs : 0;
        _lsSetScoped(K.SUBSCRIPTION_STATUS, 'active');
        _lsSetScoped(K.SUBSCRIPTION_PLAN, plan || 'premium');
        _lsSetScoped(K.SUBSCRIPTION_START, now.toString());
        if (expiry) _lsSetScoped(K.SUBSCRIPTION_EXPIRY, expiry.toString());
    }

    function cancelSubscription() {
        _lsSetScoped(K.SUBSCRIPTION_STATUS, 'cancelled');
    }

    // ─── Core Access Check ───
    // Returns: 'granted' | 'login_required' | 'trial_expired' | 'guest_limit'
    function checkAccess() {
        if (!isLoggedIn()) {
            return 'guest_limit';
        }
        if (isSubscribed()) {
            return 'granted';
        }
        if (isTrialActive()) {
            return 'granted';
        }
        if (isTrialExpired()) {
            return 'trial_expired';
        }
        // Logged in but no trial started — start one
        startTrial();
        return 'granted';
    }

    // ─── Guest 10-Second Timer ───
    function startGuestTimer(audioElement) {
        stopGuestTimer();
        _guestElapsed = 0;
        _currentAudioEl = audioElement;

        _guestTimer = setInterval(function () {
            _guestElapsed += 1;
            if (_guestElapsed >= GUEST_TRIAL_SECONDS) {
                stopGuestTimer();
                pauseAndShowLogin(audioElement);
            }
        }, 1000);
    }

    function stopGuestTimer() {
        if (_guestTimer) {
            clearInterval(_guestTimer);
            _guestTimer = null;
        }
    }

    function pauseAndShowLogin(audioEl) {
        // Pause the audio
        if (audioEl) {
            try {
                audioEl.pause();
            } catch (e) { /* ignore */ }
        }
        // Also pause via global functions
        if (typeof window.pausePlayback === 'function') {
            try { window.pausePlayback(); } catch (e) { /* ignore */ }
        }
        if (typeof window.pauseStation === 'function') {
            try { window.pauseStation(); } catch (e) { /* ignore */ }
        }

        // Show login popup
        showAccessPopup('login_required');
    }

    // ─── Popup System ───
    function showAccessPopup(reason, onResolve) {
        if (_popupShown) return;
        _popupShown = true;

        // Delegate to UpgradePopup if loaded
        if (window.UpgradePopup && typeof UpgradePopup.show === 'function') {
            UpgradePopup.show(reason, function () {
                _popupShown = false;
                if (onResolve) onResolve();
            });
        } else {
            // Fallback: built-in popup
            _showBuiltinPopup(reason, function () {
                _popupShown = false;
                if (onResolve) onResolve();
            });
        }
    }

    function dismissPopup() {
        _popupShown = false;
        if (window.UpgradePopup && typeof UpgradePopup.hide === 'function') {
            UpgradePopup.hide();
        }
        _hideBuiltinPopup();
    }

    // ─── Built-in Fallback Popup ───
    var _popupEl = null;

    function _showBuiltinPopup(reason, onResolve) {
        _hideBuiltinPopup();

        var isLogin = reason === 'login_required' || reason === 'guest_limit';
        var isExpired = reason === 'trial_expired';

        var title = isLogin ? 'Login Required' : 'Subscription Required';
        var message = isLogin
            ? 'Sign in to continue listening to your favorite Tamil music. You get a 1-month free trial after login!'
            : 'Your free trial has expired. Upgrade to Premium to continue listening without interruptions.';
        var btnText = isLogin ? 'Sign In' : 'Upgrade Now';
        var btnClass = isLogin ? 'ac-popup-btn-primary' : 'ac-popup-btn-premium';

        _popupEl = document.createElement('div');
        _popupEl.className = 'ac-popup-overlay';
        _popupEl.innerHTML =
            '<div class="ac-popup">' +
                '<div class="ac-popup-icon">' +
                    (isLogin ? '<i class="fas fa-user-lock"></i>' : '<i class="fas fa-crown"></i>') +
                '</div>' +
                '<h3 class="ac-popup-title">' + title + '</h3>' +
                '<p class="ac-popup-message">' + message + '</p>' +
                '<div class="ac-popup-buttons">' +
                    '<button class="ac-popup-btn ' + btnClass + '" id="acPopupMainBtn">' + btnText + '</button>' +
                    (isLogin ? '<button class="ac-popup-btn ac-popup-btn-guest" id="acPopupGuestBtn">Continue as Guest</button>' : '') +
                '</div>' +
            '</div>';

        document.body.appendChild(_popupEl);
        requestAnimationFrame(function () { _popupEl.classList.add('visible'); });

        // Event listeners
        var mainBtn = _popupEl.querySelector('#acPopupMainBtn');
        var guestBtn = _popupEl.querySelector('#acPopupGuestBtn');

        if (mainBtn) {
            mainBtn.addEventListener('click', function () {
                _hideBuiltinPopup();
                _popupShown = false;
                if (isLogin) {
                    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html');
                } else {
                    // Navigate to premium/upgrade page or show upgrade flow
                    if (window.UpgradePopup && typeof UpgradePopup.showUpgradeFlow === 'function') {
                        UpgradePopup.showUpgradeFlow();
                    } else {
                        // Try to find premium page
                        var premiumPage = document.getElementById('page-premium');
                        if (premiumPage) {
                            premiumPage.scrollIntoView({ behavior: 'smooth' });
                        } else {
                            window.location.href = 'login.html?redirect=' + encodeURIComponent('index.html#premium');
                        }
                    }
                }
                if (onResolve) onResolve();
            });
        }

        if (guestBtn) {
            guestBtn.addEventListener('click', function () {
                _hideBuiltinPopup();
                _popupShown = false;
                if (onResolve) onResolve();
            });
        }

        // Close on overlay click
        _popupEl.addEventListener('click', function (e) {
            if (e.target === _popupEl) {
                // Don't close — force login/upgrade
            }
        });
    }

    function _hideBuiltinPopup() {
        if (_popupEl) {
            _popupEl.classList.remove('visible');
            setTimeout(function () {
                if (_popupEl && _popupEl.parentNode) {
                    _popupEl.parentNode.removeChild(_popupEl);
                }
                _popupEl = null;
            }, 300);
        }
    }

    // ─── Public API for Player Integration ───
    /**
     * Call this before playing any song/station.
     * Returns true if playback is allowed, false if it should be blocked.
     * For guests: starts the 10-second timer.
     * For logged-in users with expired trial: shows upgrade popup.
     */
    function guardPlayback(audioElement) {
        var access = checkAccess();

        switch (access) {
            case 'granted':
                if (!isLoggedIn() || isGuest()) {
                    // Guest: start 10-second timer
                    startGuestTimer(audioElement);
                }
                return true;

            case 'guest_limit':
                // Should not reach here (guest_limit means not logged in)
                startGuestTimer(audioElement);
                return true;

            case 'login_required':
                pauseAndShowLogin(audioElement);
                return false;

            case 'trial_expired':
                // Pause and show upgrade popup
                if (audioElement) {
                    try { audioElement.pause(); } catch (e) { /* ignore */ }
                }
                if (typeof window.pausePlayback === 'function') {
                    try { window.pausePlayback(); } catch (e) { /* ignore */ }
                }
                showAccessPopup('trial_expired');
                return false;

            default:
                return true;
        }
    }

    /**
     * Called when a new track starts playing.
     * Resets the guest timer for non-logged-in users.
     */
    function onTrackStart(audioElement) {
        if (!isLoggedIn() || isGuest()) {
            startGuestTimer(audioElement);
        } else {
            stopGuestTimer();
        }
    }

    /**
     * Called when playback pauses or stops.
     */
    function onTrackStop() {
        stopGuestTimer();
    }

    // ─── Settings/Profile Helpers ───
    function getAccountInfo() {
        var user = null;
        try {
            if (window.Auth && typeof Auth.currentUser === 'function') {
                user = Auth.currentUser();
            }
        } catch (e) { /* ignore */ }

        var trialStart = getTrialStart();
        var trialExpiry = getTrialExpiry();
        var subStatus = getSubscriptionStatus();
        var subPlan = getSubscriptionPlan();
        var trialDays = getTrialDaysRemaining();

        return {
            isLoggedIn: isLoggedIn(),
            isGuest: isGuest(),
            user: user,
            trial: {
                active: isTrialActive(),
                expired: isTrialExpired(),
                startDate: trialStart ? new Date(trialStart).toLocaleDateString() : 'N/A',
                expiryDate: trialExpiry ? new Date(trialExpiry).toLocaleDateString() : 'N/A',
                daysRemaining: trialDays,
            },
            subscription: {
                status: subStatus,
                plan: subPlan,
                active: isSubscribed(),
            },
        };
    }

    // ─── Initialize ───
    function init() {
        // Auto-start trial for newly logged-in users who don't have one
        if (isLoggedIn() && !isGuest()) {
            if (!getTrialExpiry()) {
                startTrial();
            }
        }
    }

    // ─── Public API ───
    return {
        init: init,
        checkAccess: checkAccess,
        guardPlayback: guardPlayback,
        onTrackStart: onTrackStart,
        onTrackStop: onTrackStop,
        showAccessPopup: showAccessPopup,
        dismissPopup: dismissPopup,
        getAccountInfo: getAccountInfo,

        // Trial
        startTrial: startTrial,
        isTrialActive: isTrialActive,
        isTrialExpired: isTrialExpired,
        getTrialDaysRemaining: getTrialDaysRemaining,
        getTrialStart: getTrialStart,
        getTrialExpiry: getTrialExpiry,

        // Subscription
        isSubscribed: isSubscribed,
        setSubscription: setSubscription,
        cancelSubscription: cancelSubscription,
        getSubscriptionStatus: getSubscriptionStatus,
        getSubscriptionPlan: getSubscriptionPlan,

        // Auth helpers
        isLoggedIn: isLoggedIn,
        isGuest: isGuest,

        // Constants
        GUEST_TRIAL_SECONDS: GUEST_TRIAL_SECONDS,
        TRIAL_DURATION_MS: TRIAL_DURATION_MS,
    };
})();

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        window.AccessControl.init();
    });
} else {
    window.AccessControl.init();
}
