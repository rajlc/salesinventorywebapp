'use client';

import { App } from '@capacitor/app';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Global state for back button handlers
let customBackHandler: (() => boolean) | null = null;

// Export function to register custom back button handlers
export function registerBackHandler(handler: () => boolean) {
    console.log('[BackButton] Registering custom handler');
    customBackHandler = handler;
}

export function unregisterBackHandler() {
    console.log('[BackButton] Unregistering custom handler');
    customBackHandler = null;
}

const CapacitorAppListener = () => {
    const router = useRouter();
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);

    // Keep ref updated with latest pathname
    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    useEffect(() => {
        let backButtonListener: any;

        const setupListener = async () => {
            backButtonListener = await App.addListener('backButton', async () => {
                console.log('[BackButton] ✅ Back pressed');

                // Check if there's a custom handler registered
                if (customBackHandler) {
                    console.log('[BackButton] Custom handler exists, calling it');
                    const handled = customBackHandler();
                    if (handled) {
                        console.log('[BackButton] Custom handler handled it, not navigating');
                        return; // Custom handler handled it, don't navigate
                    }
                    console.log('[BackButton] Custom handler returned false, continuing with default');
                }

                const currentPath = pathnameRef.current;

                // Normalize path (remove trailing slash if present)
                const normalizedPath = currentPath?.endsWith('/') && currentPath.length > 1
                    ? currentPath.slice(0, -1)
                    : currentPath;

                // Define routes where the app should exit
                const exitRoutes = ['/', '/login', '/dashboard'];

                if (normalizedPath && exitRoutes.includes(normalizedPath)) {
                    console.log('[BackButton] On exit route, exiting app');
                    await App.exitApp();
                } else {
                    // Navigate back
                    console.log('[BackButton] Navigating back');
                    router.back();
                }
            });
        };

        setupListener();

        return () => {
            if (backButtonListener) {
                backButtonListener.remove();
            }
        };
    }, []); // Empty dependency array - run once on mount

    return null;
};

export default CapacitorAppListener;
