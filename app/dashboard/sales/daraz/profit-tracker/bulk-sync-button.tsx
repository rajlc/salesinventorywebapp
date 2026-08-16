'use client'

import { useState, useRef } from 'react'
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Sparkles, X, ChevronRight } from 'lucide-react'
import { syncOrderPurchaseCost, getDailyOrdersForDate } from '@/features/sales/actions/report-actions'
import { useQueryClient } from '@tanstack/react-query'

interface SyncLogItem {
    orderNumber: string
    sellerAccount?: string
    status: 'success' | 'error'
    message: string
    fee?: number
}

interface BulkSyncButtonProps {
    orderNumbers?: string[]
    date?: string
    sellerAccount?: string
    label?: string
    className?: string
    onComplete?: () => void
}

export function BulkSyncButton({
    orderNumbers = [],
    date,
    sellerAccount,
    label,
    className,
    onComplete
}: BulkSyncButtonProps) {
    const [isOverlayOpen, setIsOverlayOpen] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [progress, setProgress] = useState<{ current: number, total: number }>({ current: 0, total: 0 })
    const [currentOrder, setCurrentOrder] = useState<string>('')
    const [logs, setLogs] = useState<SyncLogItem[]>([])
    const [summary, setSummary] = useState<{ success: number, failed: number } | null>(null)
    const cancelRef = useRef(false)
    const logContainerRef = useRef<HTMLDivElement>(null)
    const queryClient = useQueryClient()

    const handleStartSync = async () => {
        cancelRef.current = false
        setLogs([])
        setSummary(null)
        setIsOverlayOpen(true)
        setIsSyncing(true)

        let targetOrders = [...orderNumbers]

        // If date is provided and order list is empty, fetch all orders for this date
        if (targetOrders.length === 0 && date) {
            setCurrentOrder(`Fetching orders for ${date}...`)
            try {
                const res = await getDailyOrdersForDate({ dateStr: date, sellerAccount })
                targetOrders = res.orderNumbers || []
            } catch (err: any) {
                setLogs([{
                    orderNumber: 'Fetch Failed',
                    status: 'error',
                    message: `Could not fetch orders for date: ${err.message}`
                }])
                setIsSyncing(false)
                return
            }
        }

        const total = targetOrders.length
        if (total === 0) {
            setLogs([{
                orderNumber: 'None',
                status: 'error',
                message: 'No orders found on this day to sync.'
            }])
            setIsSyncing(false)
            return
        }

        setProgress({ current: 0, total })
        let successCount = 0
        let failCount = 0

        // Process in sequential or fast batches with live UI feedback
        for (let i = 0; i < total; i++) {
            if (cancelRef.current) {
                setLogs(prev => [...prev, {
                    orderNumber: 'Cancelled',
                    status: 'error',
                    message: 'Sync stopped by user.'
                }])
                break
            }

            const orderNum = targetOrders[i]
            setCurrentOrder(`Syncing #${orderNum} (${i + 1} of ${total})...`)
            setProgress({ current: i + 1, total })

            try {
                const result = await syncOrderPurchaseCost(orderNum)
                successCount++
                const logItem: SyncLogItem = {
                    orderNumber: orderNum,
                    sellerAccount: result.sellerAccount,
                    status: 'success',
                    fee: result.fee,
                    message: `${result.feeSync || 'Synced'} • Cost items: ${result.updatesCount || 0}`
                }
                setLogs(prev => [...prev, logItem])
            } catch (err: any) {
                failCount++
                const logItem: SyncLogItem = {
                    orderNumber: orderNum,
                    status: 'error',
                    message: err.message || 'Sync failed'
                }
                setLogs(prev => [...prev, logItem])
            }

            // Scroll log to bottom
            setTimeout(() => {
                if (logContainerRef.current) {
                    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
                }
            }, 10)
        }

        setIsSyncing(false)
        setCurrentOrder('')
        setSummary({ success: successCount, failed: failCount })

        // Invalidate and refetch all profit tracker queries
        await queryClient.invalidateQueries({ queryKey: ['profit-tracker'] })
        await queryClient.invalidateQueries({ queryKey: ['daily-profit-stats'] })
        await queryClient.invalidateQueries({ queryKey: ['complete-date-stats'] })
        await queryClient.invalidateQueries({ queryKey: ['daily-orders-detail'] })
        await queryClient.invalidateQueries({ queryKey: ['weekly-orders-detail'] })

        if (onComplete) {
            onComplete()
        }
    }

    const handleCancel = () => {
        cancelRef.current = true
        setIsSyncing(false)
    }

    const handleClose = () => {
        if (isSyncing) {
            if (!confirm('Sync is still running. Are you sure you want to close and stop?')) {
                return
            }
            cancelRef.current = true
            setIsSyncing(false)
        }
        setIsOverlayOpen(false)
    }

    const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

    const defaultButtonLabel = label
        ? label
        : orderNumbers.length > 0
            ? `Sync Visible (${orderNumbers.length})`
            : 'Bulk Sync Fees'

    return (
        <>
            <button
                type="button"
                onClick={handleStartSync}
                disabled={isSyncing}
                className={className || "flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"}
            >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{defaultButtonLabel}</span>
            </button>

            {/* FULLSCREEN OVERLAY PROCESSING MODAL */}
            {isOverlayOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-5 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-zinc-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        Bulk Sync Fees & Costs
                                        {isSyncing && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 animate-pulse">
                                                Processing
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {date ? `Orders for ${date}` : `${progress.total || orderNumbers.length} orders queued`}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Progress Bar & Current Status */}
                        <div className="space-y-2 bg-gray-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                            <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-gray-700 dark:text-gray-300">
                                    {isSyncing ? 'Syncing in progress...' : summary ? 'Sync complete!' : 'Ready'}
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                    {progress.current} / {progress.total} ({percent}%)
                                </span>
                            </div>

                            {/* Progress bar track */}
                            <div className="w-full h-2.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>

                            {isSyncing && currentOrder && (
                                <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                    <RefreshCw className="h-3 w-3 animate-spin text-emerald-500 shrink-0" />
                                    <span className="truncate">{currentOrder}</span>
                                </div>
                            )}
                        </div>

                        {/* Summary Card when done */}
                        {summary && (
                            <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    <span>Successfully Synced: {summary.success}</span>
                                    {summary.failed > 0 && (
                                        <span className="text-rose-600 dark:text-rose-400 ml-2">
                                            (Failed: {summary.failed})
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                    Profit Tracker Updated
                                </span>
                            </div>
                        )}

                        {/* Live Log Activity Feed */}
                        <div className="flex-1 space-y-2 min-h-0 flex flex-col">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                                <span>Activity Log</span>
                                <span>{logs.length} events</span>
                            </div>
                            <div
                                ref={logContainerRef}
                                className="flex-1 overflow-y-auto max-h-56 min-h-[140px] space-y-1.5 p-2.5 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs font-mono"
                            >
                                {logs.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                                        Starting sync pipeline...
                                    </div>
                                ) : (
                                    logs.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 text-[11px]"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                {item.status === 'success' ? (
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                ) : (
                                                    <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                                )}
                                                <span className="font-semibold text-gray-800 dark:text-gray-200">
                                                    #{item.orderNumber}
                                                </span>
                                                {item.sellerAccount && (
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                                                        {item.sellerAccount}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[11px] shrink-0 ${item.status === 'success' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-500 font-medium'}`}>
                                                {item.fee !== undefined ? `Rs. ${item.fee.toFixed(2)}` : item.message}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
                            {isSyncing ? (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors"
                                >
                                    Stop Sync
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-5 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-black dark:bg-zinc-100 dark:text-gray-900 dark:hover:bg-white rounded-xl transition-all shadow-sm"
                                >
                                    Done
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
