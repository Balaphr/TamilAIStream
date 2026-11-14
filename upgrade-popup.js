'use strict';

// ============================================================================
// upgrade-popup.js — Global Reusable Upgrade/Login Popup System
// ----------------------------------------------------------------------------
// Single popup used everywhere: login gate, trial expiry, upgrade prompts.
// No duplicate popups, no duplicate timers, no repeated API calls.
// ============================================================================

window.UpgradePopup = (function () {
    'use strict';

    var _overlay = null;
    var _visible = false;
    var _dismissCallback = null;
    var _currentReason = null;

    // ─── Styling injection (once) ───
    var _stylesInjected = false;

    function _injectStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;

        var css = `
/* ─── Upgrade/Login Popup ─── */
.ac-popup-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}
.ac-popup-overlay.visible {
    opacity: 1;
    pointer-events: auto;
}
.ac-popup {
    background: linear-gradient(145deg, rgba(20, 27, 45, 0.98), rgba(15, 20, 35, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 40px 32px 32px;
    max-width: 420px;
    width: calc(100% - 40px);
    text-align: center;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(52, 211, 153, 0.08);
    transform: translateY(30px) scale(0.95);
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.ac-popup-overlay.visible .ac-popup {
    transform: translateY(0) scale(1);
}
.ac-popup-icon {
    width: 72px;
    height: 72px;
    margin: 0 auto 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    color: #fff;
}
.ac-popup-icon.login-icon {
    background: linear-gradient(135deg, #34d399, #059669);
}
.ac-popup-icon.upgrade-icon {
    background: linear-gradient(135deg, #f59e0b, #d97706);
}
.ac-popup-icon.trial-icon {
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
}
.ac-popup-title {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 12px;
}
.ac-popup-message {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.65);
    line-height: 1.6;
    margin: 0 0 24px;
}
.ac-popup-trial-info {
    background: rgba(52, 211, 153, 0.1);
    border: 1px solid rgba(52, 211, 153, 0.2);
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 20px;
    text-align: left;
}
.ac-popup-trial-info .trial-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #34d399;
    margin-bottom: 6px;
}
.ac-popup-trial-info .trial-detail {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
}
.ac-popup-trial-info .trial-detail strong {
    color: #fff;
}
.ac-popup-features {
    text-align: left;
    margin-bottom: 24px;
}
.ac-popup-features .feature-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
}
.ac-popup-features .feature-item i {
    color: #34d399;
    font-size: 12px;
    flex-shrink: 0;
}
.ac-popup-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.ac-popup-btn {
    width: 100%;
    padding: 14px 24px;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}
.ac-popup-btn:active {
    transform: scale(0.97);
}
.ac-popup-btn-primary {
    background: linear-gradient(135deg, #34d399, #059669);
    color: #fff;
    box-shadow: 0 4px 20px rgba(52, 211, 153, 0.3);
}
.ac-popup-btn-primary:hover {
    box-shadow: 0 6px 28px rgba(52, 211, 153, 0.45);
}
.ac-popup-btn-premium {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #fff;
    box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);
}
.ac-popup-btn-premium:hover {
    box-shadow: 0 6px 28px rgba(245, 158, 11, 0.45);
}
.ac-popup-btn-secondary {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
}
.ac-popup-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}
.ac-popup-btn-guest {
    background: transparent;
    color: rgba(255, 255, 255, 0.45);
    font-size: 13px;
    font-weight: 500;
    padding: 10px;
}
.ac-popup-btn-guest:hover {
    color: rgba(255, 255, 255, 0.7);
}
.ac-popup-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}
.ac-popup-close:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}
@media (max-width: 480px) {
    .ac-popup {
        padding: 32px 24px 24px;
        border-radius: 20px;
    }
    .ac-popup-title { font-size: 20px; }
}
        `;

        var style = document.createElement('style');
        style.id = 'ac-popup-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ─── Show Popup ───
    function show(reason, onDismiss) {
        if (_visible) return;

        _injectStyles();
        _visible = true;
        _currentReason = reason;
        _dismissCallback = onDismiss || null;

        var isLogin = reason === 'login_required' || reason === 'guest_limit';
        var isExpired = reason === 'trial_expired';
        var isUpgrade = reason === 'upgrade';

        var iconClass = isLogin ? 'login-icon' : (isExpired ? 'trial-icon' : 'upgrade-icon');
        var iconFA = isLogin ? 'fa-user-lock' : (isExpired ? 'fa-clock-rotate-left' : 'fa-crown');

        var title = isLogin ? 'Sign in to Continue' :
                    isExpired ? 'Free Trial Ended' :
                    'Upgrade to Premium';

        var message = isLogin
            ? 'Create a free account to listen without interruptions. You get 1 month of Premium free!'
            : isExpired
            ? 'Your 1-month free trial has ended. Subscribe to Premium to keep enjoying unlimited music.'
            : 'Unlock the full Tamil AI Stream experience with Premium.';

        // Build trial info section (if logged in and not expired)
        var trialInfoHTML = '';
        if (window.AccessControl && AccessControl.isLoggedIn() && !AccessControl.isGuest()) {
            var days = AccessControl.getTrialDaysRemaining();
            var expiryDate = AccessControl.getTrialExpiry();
            if (days > 0) {
                trialInfoHTML =
                    '<div class="ac-popup-trial-info">' +
                        '<div class="trial-label">Free Trial Active</div>' +
                        '<div class="trial-detail"><strong>' + days + ' day' + (days !== 1 ? 's' : '') + '</strong> remaining' +
                        (expiryDate ? ' — expires ' + new Date(expiryDate).toLocaleDateString() : '') + '</div>' +
                    '</div>';
            } else if (isExpired) {
                trialInfoHTML =
                    '<div class="ac-popup-trial-info" style="border-color:rgba(239,68,68,0.2);background:rgba(239,68,68,0.08);">' +
                        '<div class="trial-label" style="color:#ef4444;">Trial Expired</div>' +
                        '<div class="trial-detail">Your free trial ended on <strong>' +
                        (expiryDate ? new Date(expiryDate).toLocaleDateString() : 'unknown date') + '</strong></div>' +
                    '</div>';
            }
        }

        // Features list
        var featuresHTML =
            '<div class="ac-popup-features">' +
                '<div class="feature-item"><i class="fas fa-check-circle"></i> Unlimited music streaming</div>' +
                '<div class="feature-item"><i class="fas fa-check-circle"></i> Ad-free listening experience</div>' +
                '<div class="feature-item"><i class="fas fa-check-circle"></i> High quality audio (320kbps)</div>' +
                '<div class="feature-item"><i class="fas fa-check-circle"></i> Offline downloads</div>' +
                '<div class="feature-item"><i class="fas fa-check-circle"></i> Exclusive content</div>' +
            '</div>';

        // Buttons
        var buttonsHTML = '';
        if (isLogin) {
            buttonsHTML =
                '<button class="ac-popup-btn ac-popup-btn-primary" id="acPopupMainBtn">' +
                    '<i class="fas fa-arrow-right-to-bracket"></i> Sign In' +
                '</button>' +
                '<button class="ac-popup-btn ac-popup-btn-guest" id="acPopupGuestBtn">Continue as Guest (30s limit)</button>';
        } else {
            buttonsHTML =
                '<button class="ac-popup-btn ac-popup-btn-premium" id="acPopupMainBtn">' +
                    '<i class="fas fa-crown"></i> Upgrade to Premium — ₹99/month' +
                '</button>' +
                '<button class="ac-popup-btn ac-popup-btn-secondary" id="acPopupLearnBtn">' +
                    '<i class="fas fa-info-circle"></i> Learn More' +
                '</button>';
        }

        _overlay = document.createElement('div');
        _overlay.className = 'ac-popup-overlay';
        _overlay.innerHTML =
            '<div class="ac-popup" style="position:relative;">' +
                '<button class="ac-popup-close" id="acPopupClose" aria-label="Close"><i class="fas fa-times"></i></button>' +
                '<div class="ac-popup-icon ' + iconClass + '"><i class="fas ' + iconFA + '"></i></div>' +
                '<h3 class="ac-popup-title">' + title + '</h3>' +
                '<p class="ac-popup-message">' + message + '</p>' +
                trialInfoHTML +
                featuresHTML +
                '<div class="ac-popup-buttons">' + buttonsHTML + '</div>' +
            '</div>';

        document.body.appendChild(_overlay);
        requestAnimationFrame(function () { _overlay.classList.add('visible'); });

        // ─── Event Bindings ───
        var closeBtn = _overlay.querySelector('#acPopupClose');
        var mainBtn = _overlay.querySelector('#acPopupMainBtn');
        var guestBtn = _overlay.querySelector('#acPopupGuestBtn');
        var learnBtn = _overlay.querySelector('#acPopupLearnBtn');

        if (closeBtn) closeBtn.addEventListener('click', hide);

        if (mainBtn) {
            mainBtn.addEventListener('click', function () {
                if (isLogin) {
                    // Redirect to login
                    var redirect = window.location.pathname.split('/').pop() || 'index.html';
                    window.location.href = 'login.html?redirect=' + encodeURIComponent(redirect);
                } else {
                    // Show upgrade flow
                    hide();
                    showUpgradeFlow();
                }
            });
        }

        if (guestBtn) {
            guestBtn.addEventListener('click', hide);
        }

        if (learnBtn) {
            learnBtn.addEventListener('click', function () {
                hide();
                showUpgradeFlow();
            });
        }

        // Close on overlay click (outside popup)
        _overlay.addEventListener('click', function (e) {
            if (e.target === _overlay) {
                // Only allow close for login popups (guest can dismiss)
                if (isLogin) {
                    hide();
                }
            }
        });

        // Escape key
        document.addEventListener('keydown', _handleEsc);
    }

    function _handleEsc(e) {
        if (e.key === 'Escape' && _visible) {
            hide();
        }
    }

    // ─── Hide Popup ───
    function hide() {
        if (!_visible || !_overlay) return;
        _visible = false;
        _currentReason = null;
        document.removeEventListener('keydown', _handleEsc);

        _overlay.classList.remove('visible');
        var ref = _overlay;
        setTimeout(function () {
            if (ref && ref.parentNode) ref.parentNode.removeChild(ref);
        }, 350);
        _overlay = null;

        if (_dismissCallback) {
            var cb = _dismissCallback;
            _dismissCallback = null;
            cb();
        }
    }

    // ─── Show Upgrade Flow ───
    function showUpgradeFlow() {
        _injectStyles();

        // Try to find the premium page in the SPA
        var premiumPage = document.getElementById('page-premium');
        if (premiumPage) {
            // SPA navigation
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('premium');
            } else if (typeof window.YTMusic !== 'undefined' && typeof YTMusic.navigateTo === 'function') {
                YTMusic.navigateTo('premium');
            } else {
                premiumPage.scrollIntoView({ behavior: 'smooth' });
            }
            return;
        }

        // Fallback: show upgrade popup inline
        showUpgradeInline();
    }

    // ─── Inline Upgrade Modal (fallback) ───
    function showUpgradeInline() {
        if (document.getElementById('acUpgradeModal')) return;

        var modal = document.createElement('div');
        modal.id = 'acUpgradeModal';
        modal.className = 'ac-popup-overlay visible';
        modal.innerHTML =
            '<div class="ac-popup" style="position:relative;max-width:480px;">' +
                '<button class="ac-popup-close" id="acUpgradeClose" aria-label="Close"><i class="fas fa-times"></i></button>' +
                '<div class="ac-popup-icon upgrade-icon"><i class="fas fa-crown"></i></div>' +
                '<h3 class="ac-popup-title">Choose Your Plan</h3>' +
                '<p class="ac-popup-message">Unlock the full Tamil AI Stream experience</p>' +
                '<div class="ac-popup-features">' +
                    '<div class="feature-item"><i class="fas fa-check-circle"></i> Unlimited music streaming</div>' +
                    '<div class="feature-item"><i class="fas fa-check-circle"></i> Ad-free listening</div>' +
                    '<div class="feature-item"><i class="fas fa-check-circle"></i> High quality 320kbps audio</div>' +
                    '<div class="feature-item"><i class="fas fa-check-circle"></i> Offline downloads</div>' +
                    '<div class="feature-item"><i class="fas fa-check-circle"></i> Exclusive content</div>' +
                    '<div class="feature-item"><i class="fas fa-check-circle"></i> Unlimited playlists</div>' +
                '</div>' +
                '<div class="ac-popup-buttons">' +
                    '<button class="ac-popup-btn ac-popup-btn-premium" onclick="AccessControl.setSubscription(\'premium\');document.getElementById(\'acUpgradeModal\').remove();if(typeof showToast===\'function\')showToast(\'Premium activated! Enjoy unlimited music.\',\'success\');">' +
                        '<i class="fas fa-crown"></i> Premium — ₹99/month' +
                    '</button>' +
                    '<button class="ac-popup-btn ac-popup-btn-secondary" onclick="document.getElementById(\'acUpgradeModal\').remove();">' +
                        'Maybe Later' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);

        var closeBtn = modal.querySelector('#acUpgradeClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () { modal.remove(); });
        }
        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.remove();
        });
    }

    // ─── Show Login Popup (shortcut) ───
    function showLoginPopup(onDismiss) {
        show('login_required', onDismiss);
    }

    // ─── Show Trial Expired Popup (shortcut) ───
    function showTrialExpiredPopup(onDismiss) {
        show('trial_expired', onDismiss);
    }

    // ─── Show Upgrade Prompt (shortcut) ───
    function showUpgradePopup(onDismiss) {
        show('upgrade', onDismiss);
    }

    // ─── Public API ───
    return {
        show: show,
        hide: hide,
        showUpgradeFlow: showUpgradeFlow,
        showLoginPopup: showLoginPopup,
        showTrialExpiredPopup: showTrialExpiredPopup,
        showUpgradePopup: showUpgradePopup,
        isVisible: function () { return _visible; },
    };
})();
