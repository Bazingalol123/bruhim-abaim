/**
 * Firebase Configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (or select existing)
 * 3. Click the web icon (</>) to add a web app
 * 4. Copy your Firebase configuration values below
 * 5. Enable Storage and Firestore in the Firebase Console
 * 6. Set up security rules (see plans/FIREBASE_SIMPLE_STEPS.md)
 * 
 * SECURITY NOTE: 
 * It's safe to expose these values in your frontend code.
 * Security is enforced through Firebase Security Rules, not by hiding these values.
 * See plans/FIREBASE_SIMPLE_STEPS.md for more details.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

// TODO: Replace with your Firebase project credentials
// Get these from: Firebase Console > Project Settings > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyDF23YiwlXBU2BAP5CoxNFM6lDAaNCUaJA",
  authDomain: "wedding-prog.firebaseapp.com",
  projectId: "wedding-prog",
  storageBucket: "wedding-prog.firebasestorage.app",
  messagingSenderId: "1047795100077",
  appId: "1:1047795100077:web:30e6172ea60c7db2065924"
};

// Initialize Firebase
let app, storage, db, auth;

try {
    app = initializeApp(firebaseConfig);
    storage = getStorage(app);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('✅ Firebase initialized successfully');
    console.log('✅ Firebase Auth initialized');
} catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    console.error('Make sure you have replaced the placeholder values in firebase-config.js');
}

export { app, storage, db, auth };
