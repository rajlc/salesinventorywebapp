// Global back button handler for Capacitor
// This must be loaded once and handle ALL back button presses

import { App } from '@capacitor/app';

let backButtonHandler: (() => void) | null = null;

export function setupGlobalBackButton() {
    console.log('[GlobalBack] Setting up GLOBAL back button handler');

    App.addListener('backButton', (data) => {
        console.log('[GlobalBack] ✅ Back button pressed, data:', data);

        if (backButtonHandler) {
            console.log('[GlobalBack] Calling registered handler');
            backButtonHandler();
        } else {
            console.log('[GlobalBack] No handler registered, allowing default navigation');
            // Allow default navigation
        }
    });
}

export function registerBackButtonHandler(handler: () => void) {
    console.log('[GlobalBack] Registering new handler');
    backButtonHandler = handler;
}

export function unregisterBackButtonHandler() {
    console.log('[GlobalBack] Unregistering handler');
    backButtonHandler = null;
}
