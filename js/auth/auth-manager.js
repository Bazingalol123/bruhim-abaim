/**
 * Authentication Manager
 * Handles Firebase Authentication for admin access
 */

import { auth } from '../config/firebase-config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

// Auth initialization state
let authInitialized = false;
let authInitPromise = null;
let redirectInProgress = false;

/**
 * Wait for Firebase Auth to initialize
 * @returns {Promise<Object|null>} The current user or null
 */
function waitForAuthInit() {
    if (authInitialized) {
        return Promise.resolve(auth.currentUser);
    }
    
    if (authInitPromise) {
        return authInitPromise;
    }
    
    authInitPromise = new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            authInitialized = true;
            unsubscribe();
            resolve(user);
        });
    });
    
    return authInitPromise;
}

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User credential object
 */
export async function signIn(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Sign in successful:', userCredential.user.email);
        return {
            success: true,
            user: userCredential.user,
            error: null
        };
    } catch (error) {
        console.error('❌ Sign in failed:', error);
        return {
            success: false,
            user: null,
            error: getAuthErrorMessage(error.code)
        };
    }
}

/**
 * Sign out current user
 * @returns {Promise<Object>} Result object
 */
export async function signOutUser() {
    try {
        await signOut(auth);
        console.log('✅ Sign out successful');
        return {
            success: true,
            error: null
        };
    } catch (error) {
        console.error('❌ Sign out failed:', error);
        return {
            success: false,
            error: 'Failed to sign out. Please try again.'
        };
    }
}

/**
 * Get current authenticated user
 * @returns {Object|null} Current user or null if not authenticated
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Check if user is currently authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
export function isAuthenticated() {
    return auth.currentUser !== null;
}

/**
 * Listen for authentication state changes
 * @param {Function} callback - Callback function to execute on auth state change
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
    return onAuthStateChanged(auth, (user) => {
        callback(user);
    });
}

/**
 * Get user-friendly error messages for Firebase Auth error codes
 * @param {string} errorCode - Firebase error code
 * @returns {string} User-friendly error message
 */
function getAuthErrorMessage(errorCode) {
    const errorMessages = {
        'auth/invalid-email': 'כתובת האימייל אינה תקינה',
        'auth/user-disabled': 'חשבון זה הושבת',
        'auth/user-not-found': 'אימייל או סיסמה שגויים',
        'auth/wrong-password': 'אימייל או סיסמה שגויים',
        'auth/email-already-in-use': 'כתובת האימייל כבר בשימוש',
        'auth/weak-password': 'הסיסמה חלשה מדי',
        'auth/network-request-failed': 'בעיית תקשורת. אנא בדקו את החיבור לאינטרנט',
        'auth/too-many-requests': 'יותר מדי ניסיונות. אנא נסו שוב מאוחר יותר',
        'auth/operation-not-allowed': 'פעולה זו אינה מורשית',
        'auth/invalid-credential': 'פרטי ההתחברות שגויים',
        'auth/missing-email': 'אנא הזינו כתובת אימייל',
        'auth/missing-password': 'אנא הזינו סיסמה'
    };

    return errorMessages[errorCode] || 'שגיאה בהתחברות. אנא נסו שוב';
}

/**
 * Redirect to admin panel if authenticated, otherwise to login page
 * @param {string} adminPanelUrl - URL of admin panel
 * @param {string} loginUrl - URL of login page
 * @returns {Promise<void>}
 */
export async function redirectBasedOnAuth(adminPanelUrl = 'admin-panel.html', loginUrl = 'admin-login.html') {
    // Prevent multiple simultaneous redirects
    if (redirectInProgress) {
        console.log('⚠️ Redirect already in progress, skipping...');
        return;
    }
    
    // Wait for auth to initialize
    const user = await waitForAuthInit();
    const currentPage = window.location.pathname.split('/').pop();
    
    if (user && currentPage === loginUrl) {
        // User is authenticated and on login page, redirect to admin panel
        console.log('✅ User authenticated on login page, redirecting to admin panel...');
        redirectInProgress = true;
        window.location.href = adminPanelUrl;
    } else if (!user && currentPage === adminPanelUrl) {
        // User is not authenticated and on admin panel, redirect to login
        console.log('❌ User not authenticated on admin panel, redirecting to login...');
        redirectInProgress = true;
        window.location.href = loginUrl;
    }
}

/**
 * Protect admin pages - redirect to login if not authenticated
 * Call this on protected pages to ensure only authenticated users can access
 * @param {string} loginUrl - URL of login page
 * @returns {Promise<boolean>} True if authenticated, false if redirected
 */
export async function requireAuth(loginUrl = 'admin-login.html') {
    // Prevent multiple simultaneous redirects
    if (redirectInProgress) {
        console.log('⚠️ Redirect already in progress, skipping requireAuth...');
        return false;
    }
    
    // Wait for auth to initialize
    const user = await waitForAuthInit();
    
    if (!user) {
        console.log('⚠️ Not authenticated, redirecting to login...');
        redirectInProgress = true;
        window.location.href = loginUrl;
        return false;
    }
    
    console.log('✅ User authenticated:', user.email);
    return true;
}

/**
 * Check if user is authenticated on login page and redirect to admin panel
 * Call this on login page to redirect already authenticated users
 * @param {string} adminPanelUrl - URL of admin panel
 * @returns {Promise<boolean>} True if redirected, false if not authenticated
 */
export async function redirectIfAuthenticated(adminPanelUrl = 'admin-panel.html') {
    // Prevent multiple simultaneous redirects
    if (redirectInProgress) {
        console.log('⚠️ Redirect already in progress, skipping...');
        return false;
    }
    
    // Wait for auth to initialize
    const user = await waitForAuthInit();
    
    if (user) {
        console.log('✅ User already authenticated, redirecting to admin panel...');
        redirectInProgress = true;
        window.location.href = adminPanelUrl;
        return true;
    }
    
    console.log('No user authenticated, staying on login page');
    return false;
}
