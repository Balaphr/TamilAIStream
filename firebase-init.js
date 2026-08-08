// Firebase Initialization for Tamil AI Stream
// firebaseConfig is loaded globally from firebase-config.js (loaded before this script)

// Initialize Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase services
const fbAuth = typeof firebase !== 'undefined' ? firebase.auth() : null;
const fbDb = typeof firebase !== 'undefined' ? firebase.firestore() : null;
const fbStorage = typeof firebase !== 'undefined' ? firebase.storage() : null;

// Make services available globally for other scripts
window.FBAuth = fbAuth;
window.FBDb = fbDb;
window.FBStorage = fbStorage;

console.log('🔥 Firebase initialized:', firebaseConfig.projectId);
