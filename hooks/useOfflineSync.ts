'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { getPendingSyncCount, getEntitySyncStatus } from '@/lib/db/sync-manager'
import type { SyncOperation } from '@/lib/db/sync-manager'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

/**
 * Hook for managing offline sync operations
 */
export function useOfflineSync() {
    const isOnline = useOnlineStatus()
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
    const [pendingCount, setPendingCount] = useState(0)
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)

    // Update pending count
    const updatePendingCount = useCallback(async () => {
        try {
            const count = await getPendingSyncCount()
            setPendingCount(count)
        } catch (error) {
            console.error('Failed to get pending sync count:', error)
        }
    }, [])

    // Listen for sync queue updates
    useEffect(() => {
        if (typeof window === 'undefined') return

        const handleSyncQueueUpdated = () => {
            updatePendingCount()
        }

        const handleSyncStatusUpdated = (event: CustomEvent) => {
            const { status } = event.detail
            if (status === 'completed') {
                updatePendingCount()
            }
        }

        window.addEventListener('sync-queue-updated', handleSyncQueueUpdated as EventListener)
        window.addEventListener('sync-status-updated', handleSyncStatusUpdated as EventListener)

        // Initial count
        updatePendingCount()

        return () => {
            window.removeEventListener('sync-queue-updated', handleSyncQueueUpdated as EventListener)
            window.removeEventListener('sync-status-updated', handleSyncStatusUpdated as EventListener)
        }
    }, [updatePendingCount])

    // Trigger sync when coming online
    useEffect(() => {
        if (isOnline && pendingCount > 0) {
            // Trigger sync via custom event
            window.dispatchEvent(new CustomEvent('trigger-auto-sync'))
        }
    }, [isOnline, pendingCount])

    /**
     * Check sync status for a specific entity
     */
    const checkEntitySyncStatus = useCallback(async (entityId: string): Promise<SyncOperation | null> => {
        try {
            return await getEntitySyncStatus(entityId)
        } catch (error) {
            console.error('Failed to check entity sync status:', error)
            return null
        }
    }, [])

    /**
     * Manually trigger sync
     */
    const triggerSync = useCallback(() => {
        if (isOnline && pendingCount > 0) {
            window.dispatchEvent(new CustomEvent('trigger-auto-sync'))
        }
    }, [isOnline, pendingCount])

    return {
        isOnline,
        syncStatus,
        pendingCount,
        lastSyncTime,
        checkEntitySyncStatus,
        triggerSync,
        hasPendingSync: pendingCount > 0,
    }
}
