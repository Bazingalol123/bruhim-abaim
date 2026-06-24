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

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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

// App Check (reCAPTCHA v3) — required once enforcement is enabled in the
// Firebase Console. Blocks anonymous spam/DoS of Storage and Firestore.
const RECAPTCHA_V3_SITE_KEY = '6LfMBSUtAAAAAKAwpp2Dlo3TaMLmEg22fbI1_mMy';

// Initialize Firebase
let app, storage, db, auth, appCheck;

try {
    app = initializeApp(firebaseConfig);
    // Initialize App Check BEFORE any other Firebase service so the token is
    // attached to every subsequent Storage/Firestore/Auth call.
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
        isTokenAutoRefreshEnabled: true
    });
    storage = getStorage(app);
    // Use custom database ID "default" instead of the standard "(default)"
    db = getFirestore(app, 'default');
    auth = getAuth(app);
    console.log('✅ Firebase initialized successfully');
    console.log('✅ App Check initialized');
    console.log('✅ Firebase Auth initialized');
    console.log('✅ Using Firestore database: default');
} catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    console.error('Make sure you have replaced the placeholder values in firebase-config.js');
}

export { app, storage, db, auth, appCheck };
