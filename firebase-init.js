// Firebase Initialization for Tamil AI Stream
// firebaseConfig is loaded globally from firebase-config.js (loaded before this script)
// LAZY INIT: Only initialize Firebase when an auth-related function is actually called.
// This avoids opening persistent connections and downloading SDK data on page load.

let _fbInitialized = false;

function _ensureFirebaseInit() {
    if (_fbInitialized) return;
    _fbInitialized = true;
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
}

// Expose globally so login.js / script.js can call it before using firebase.auth()
window.ensureFirebaseInit = _ensureFirebaseInit;

// Lazy getter properties — Firebase only initializes when first accessed
Object.defineProperty(window, 'FBAuth', {
    get() { _ensureFirebaseInit(); return typeof firebase !== 'undefined' ? firebase.auth() : null; },
    set(v) { /* allow overwrite */ },
    configurable: true
});
Object.defineProperty(window, 'FBDb', {
    get() { _ensureFirebaseInit(); return typeof firebase !== 'undefined' ? firebase.firestore() : null; },
    set(v) { /* allow overwrite */ },
    configurable: true
});
Object.defineProperty(window, 'FBStorage', {
    get() { _ensureFirebaseInit(); return typeof firebase !== 'undefined' ? firebase.storage() : null; },
    set(v) { /* allow overwrite */ },
    configurable: true
});
