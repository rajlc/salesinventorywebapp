'use client'

import { Wifi, WifiOff } from 'lucide-react'
import { useOfflineSync } from '@/hooks/useOfflineSync'

export function OfflineIndicator() {
    const { isOnline, pendingCount } = useOfflineSync()

    if (isOnline && pendingCount === 0) {
        return null // Don't show anything when online and no pending syncs
    }

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
            <div
                className={`
          flex items-center gap-2 px-4 py-2 rounded-full shadow-lg
          backdrop-blur-sm border
          ${isOnline
                        ? 'bg-blue-50/90 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'bg-amber-50/90 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                    }
          animate-in fade-in slide-in-from-top-2 duration-300
        `}
            >
                {isOnline ? (
                    <>
                        <Wifi size={16} className="animate-pulse" />
                        <span className="text-sm font-medium">
                            Syncing {pendingCount} {pendingCount === 1 ? 'item' : 'items'}...
                        </span>
                    </>
                ) : (
                    <>
                        <WifiOff size={16} />
                        <span className="text-sm font-medium">
                            Offline Mode
                            {pendingCount > 0 && ` • ${pendingCount} pending`}
                        </span>
                    </>
                )}
            </div>
        </div>
    )
}
