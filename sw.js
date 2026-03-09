/* =========================================
    MYCOTECH BETA - SERVICE WORKER (sw.js)
    =========================================
    Purpose: Enables PWA Installation 
    Function: Caches core files for offline use
    =========================================
*/

// The version name for your app's local storage
const CACHE_NAME = 'mycotech-cache-v1';

/**
 * 1. INSTALL EVENT
 * Triggered when you first visit the site or click "+ Install App".
 * This saves your core files into the phone's memory.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // These are the 3 essential files needed to show the dashboard UI
      return cache.addAll([
        './', 
        'index.html', 
        'manifest.json'
      ]);
    })
  );
  console.log("SYSTEM: Mycotech Service Worker Installed");
});

/**
 * 2. FETCH EVENT
 * Triggered every time the app asks for data.
 * If the internet fails, it "catches" the error and serves the saved files.
 */
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // If offline, provide the cached version so the UI doesn't break
      return caches.match(event.request);
    })
  );
});
