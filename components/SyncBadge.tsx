'use client'

import { Check, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getEntitySyncStatus } from '@/lib/db/sync-manager'

export type SyncBadgeStatus = 'synced' | 'pending' | 'syncing' | 'error'

interface SyncBadgeProps {
    entityId: string
    status?: SyncBadgeStatus // If provided, don't check database
    compact?: boolean
}

export function SyncBadge({ entityId, status: providedStatus, compact = false }: SyncBadgeProps) {
    const [status, setStatus] = useState<SyncBadgeStatus>(providedStatus || 'synced')

    useEffect(() => {
        if (providedStatus) {
            setStatus(providedStatus)
            return
        }

        // Check sync status from database
        const checkStatus = async () => {
            const syncOp = await getEntitySyncStatus(entityId)
            if (!syncOp) {
                setStatus('synced')
            } else {
                setStatus(syncOp.status === 'pending' ? 'pending' :
                    syncOp.status === 'syncing' ? 'syncing' :
                        syncOp.status === 'failed' ? 'error' : 'synced')
            }
        }

        checkStatus()

        // Listen for sync status changes
        const handleSyncStatusUpdated = (event: CustomEvent) => {
            if (event.detail.operationId === entityId) {
                checkStatus()
            }
        }

        window.addEventListener('sync-status-updated', handleSyncStatusUpdated as EventListener)

        return () => {
            window.removeEventListener('sync-status-updated', handleSyncStatusUpdated as EventListener)
        }
    }, [entityId, providedStatus])

    if (status === 'synced') {
        return null // Don't show badge for synced items
    }


    type ConfigType = {
        icon: typeof Clock | typeof RefreshCw | typeof AlertCircle
        label: string
        className: string
        animated?: boolean
    }

    const configs: Record<Exclude<SyncBadgeStatus, 'synced'>, ConfigType> = {
        pending: {
            icon: Clock,
            label: 'Pending',
            className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
        },
        syncing: {
            icon: RefreshCw,
            label: 'Syncing',
            className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
            animated: true,
        },
        error: {
            icon: AlertCircle,
            label: 'Error',
            className: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
        },
    }


    const config = configs[status]
    const Icon = config.icon

    if (compact) {
        return (
            <div className={`inline-flex items-center justify-center w-5 h-5 rounded-full border ${config.className}`}>
                <Icon size={12} className={config.animated ? 'animate-spin' : ''} />
            </div>
        )
    }

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${config.className}`}>
            <Icon size={14} className={config.animated ? 'animate-spin' : ''} />
            <span>{config.label}</span>
        </div>
    )
}
