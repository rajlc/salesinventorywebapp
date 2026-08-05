'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect online/offline status
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState<boolean>(
        typeof window !== 'undefined' ? navigator.onLine : true
    )

    useEffect(() => {
        if (typeof window === 'undefined') return

        const handleOnline = () => {
            setIsOnline(true)
            console.log('🟢 Connection restored')
        }

        const handleOffline = () => {
            setIsOnline(false)
            console.log('🔴 Connection lost')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    return isOnline
}

/**
 * Hook that provides additional network quality info
 */
export function useNetworkStatus() {
    const isOnline = useOnlineStatus()
    const [effectiveType, setEffectiveType] = useState<string>('unknown')
    const [downlink, setDownlink] = useState<number | undefined>(undefined)

    useEffect(() => {
        if (typeof window === 'undefined') return

        const connection = (navigator as any).connection ||
            (navigator as any).mozConnection ||
            (navigator as any).webkitConnection

        if (!connection) return

        const updateNetworkInfo = () => {
            setEffectiveType(connection.effectiveType || 'unknown')
            setDownlink(connection.downlink)
        }

        updateNetworkInfo()
        connection.addEventListener('change', updateNetworkInfo)

        return () => {
            connection.removeEventListener('change', updateNetworkInfo)
        }
    }, [])

    return {
        isOnline,
        effectiveType,
        downlink,
        isSlowConnection: effectiveType === 'slow-2g' || effectiveType === '2g',
    }
}
