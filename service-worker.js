// Minimal service worker — required for PWA install on Android Chrome.
// No caching by design: every request hits the network like a normal website.
// This avoids stale-asset bugs and lets us push fixes up to the moment of the wedding.

self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    // Skip waiting so a new SW takes over immediately on next page load
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    // Claim all clients so this SW controls open tabs without a reload
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // No caching strategy — just pass through to the network.
    // We still need this listener to exist (Chrome requires a fetch handler
    // for PWA install eligibility).
    return;
});
