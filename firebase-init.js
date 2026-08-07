// Firebase Initialization for Tamil AI FM
// Import the config
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Export services for use in other modules
export { auth, db, storage };

// Test Firebase connection
console.log('🔥 Firebase initialized successfully');
console.log('   Project:', firebaseConfig.projectId);
console.log('   Auth:', auth ? 'Ready' : 'Not available');
console.log('   Firestore:', db ? 'Ready' : 'Not available');
console.log('   Storage:', storage ? 'Ready' : 'Not available');