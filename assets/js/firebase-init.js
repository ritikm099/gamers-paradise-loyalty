// ─────────────────────────────────────────────────────────────
// Shared Firebase bootstrap (digital menu)
//
// IMPORTANT: this module has NO import-time side effects. index.html
// already calls initializeApp() for the loyalty app, and calling it
// twice throws "app/duplicate-app" — which would break index.html's
// `if (!initFirebase()) return;` guard. So we initialize lazily, on
// first getDb() call, and fall back to the existing default app.
// ─────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const firebaseConfig = {
    apiKey: "AIzaSyBE_UvGf4ylNIsjQ_hDNGicp2iqQfEOkT4",
    authDomain: "gamersparadise-bdc7e.firebaseapp.com",
    projectId: "gamersparadise-bdc7e",
    storageBucket: "gamersparadise-bdc7e.appspot.com",
    messagingSenderId: "409381337462",
    appId: "1:409381337462:web:017001d388c9352f112257"
};

let _db = null;

/** Returns the shared Firestore instance, initializing once if needed. */
export function getDb() {
    if (_db) return _db;
    let app;
    if (getApps().length) {
        app = getApp();
    } else {
        try {
            app = initializeApp(firebaseConfig);
        } catch (e) {
            // Lost a race with another initializer — reuse whatever exists.
            app = getApp();
        }
    }
    _db = getFirestore(app);
    return _db;
}
