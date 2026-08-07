# Firebase Setup for Tamil AI FM

This guide will help you connect Firebase to your Tamil AI FM app.

## 📋 Prerequisites

- Firebase project created: `tamil-ai-fm-b916a`
- Firebase CLI installed (v15.25.1)

## 🚀 Setup Steps

### Step 1: Create Firebase Web App

1. Go to Firebase Console: https://console.firebase.google.com/project/tamil-ai-fm-b916a/settings/general
2. Scroll down to "Your apps" section
3. Click "Add app" and select the Web icon (`</`)
4. Register the app:
   - App nickname: `Tamil AI FM Web`
   - Uncheck "Also set up Firebase Hosting" (you're using Vercel)
   - Click "Register app"
5. **Copy the firebaseConfig object** that appears

### Step 2: Update Firebase Configuration

Open `firebase-config.js` and replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",                    // Replace with your actual API key
  authDomain: "tamil-ai-fm-b916a.firebaseapp.com",
  projectId: "tamil-ai-fm-b916a",
  storageBucket: "tamil-ai-fm-b916a.appspot.com",
  messagingSenderId: "123456789",       // Replace with your actual value
  appId: "1:123456789:web:abc123"      // Replace with your actual value
};
```

### Step 3: Enable Firebase Services

In Firebase Console, enable the following services:

#### 3.1 Authentication
1. Go to https://console.firebase.google.com/project/tamil-ai-fm-b916a/authentication
2. Click "Get started"
3. Enable "Email/Password" sign-in method
4. (Optional) Enable "Google" sign-in method

#### 3.2 Firestore Database
1. Go to https://console.firebase.google.com/project/tamil-ai-fm-b916a/firestore
2. Click "Create database"
3. Select "Start in test mode" (we'll secure it later)
4. Choose a location (e.g., nam5 for Mumbai)
5. Click "Enable"

#### 3.3 Storage
1. Go to https://console.firebase.google.com/project/tamil-ai-fm-b916a/storage
2. Click "Get started"
3. Select "Start in test mode"
4. Click "Next" then "Done"

### Step 4: Test Firebase Connection

1. Start your local dev server: `npm run dev`
2. Open browser console (F12)
3. You should see:
   ```
   🔥 Firebase initialized successfully
      Project: tamil-ai-fm-b916a
      Auth: Ready
      Firestore: Ready
      Storage: Ready
   ```

### Step 5: Deploy to Vercel

Once Firebase is working locally, deploy to Vercel:

```bash
npm run deploy
```

Or if using auto-deploy:
```bash
git add .
git commit -m "Connect Firebase"
git push origin main
```

## 🔧 Firebase Services Integration

### What's Already Set Up

✅ Firebase SDK loaded from CDN (v9.22.0)
✅ Firebase configuration file created (`firebase-config.js`)
✅ Firebase initialization module (`firebase-init.js`)
✅ HTML updated with Firebase scripts

### What You Need to Configure

1. **Update `firebase-config.js`** with your actual Firebase config values
2. **Enable Firebase services** in the Firebase Console (Auth, Firestore, Storage)
3. **Test the connection** locally
4. **Deploy to Vercel**

## 📚 Firebase Features You Can Add

Once connected, you can use Firebase for:

- **Authentication**: Email/Password, Google Sign-In
- **Firestore**: Store user data, playlists, liked songs, listening history
- **Storage**: Store album covers, audio files, user uploads
- **Hosting**: Alternative to Vercel (optional)

## 🆘 Troubleshooting

### Firebase not initializing
- Check browser console for errors
- Verify `firebase-config.js` has correct values
- Make sure Firebase services are enabled in console

### Auth not working
- Check Authentication is enabled in Firebase Console
- Verify sign-in methods are configured

### Firestore/Storage errors
- Check security rules in Firebase Console
- Ensure services are enabled
- Verify project ID is correct

## 📖 Next Steps

After Firebase is connected, you can:

1. Add user authentication to your app
2. Store user playlists in Firestore
3. Save liked songs to Firestore
4. Store listening history
5. Upload songs/album art to Firebase Storage

## 🔐 Security Rules (Important!)

After testing, update Firebase security rules:

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow public read for stations
    match /stations/{stationId} {
      allow read: if true;
      allow write: if false; // Only admins can write
    }
  }
}
```

### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow users to upload their own files
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow public read for public assets
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

## 📞 Support

- Firebase Docs: https://firebase.google.com/docs
- Firebase Console: https://console.firebase.google.com/project/tamil-ai-fm-b916a
- Vercel Dashboard: https://vercel.com/dwmx-fcsz/tamil-ai-fm