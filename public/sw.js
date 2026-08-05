// Service Worker for offline functionality
// This file will be processed by next-pwa which injects Workbox

/* eslint-disable no-restricted-globals */

// Take control of all pages immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.clients.claim().then(() => {
            return self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SW_ACTIVATED',
                        timestamp: Date.now(),
                    });
                });
            });
        })
    );
});

// Background sync for offline operations
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-purchases') {
        event.waitUntil(syncPurchases());
    }
});

async function syncPurchases() {
    console.log('🔄 Background sync triggered');
    // Notify all clients to trigger sync
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
        client.postMessage({
            type: 'SYNC_TRIGGERED',
            timestamp: Date.now(),
        });
    });
}

// Listen for skip waiting message
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Handle fetch events - basic offline fallback
self.addEventListener('fetch', (event) => {
    // Let next-pwa's Workbox handle most requests
    // This is just a fallback handler
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('/offline.html').then((response) => {
                    return response || new Response('Offline - Please check your connection', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: new Headers({
                            'Content-Type': 'text/plain'
                        })
                    });
                });
            })
        );
    }
});

console.log('✅ Service Worker loaded and ready!');
