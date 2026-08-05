'use client'

import { useState, useEffect, useMemo } from 'react'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui-shim'
import { RefreshCw, ArrowLeft, Store, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Suspense } from 'react'
import { useState as useReactState } from 'react'

export const dynamic = 'force-dynamic'

// Helper: Same logic as backend to keep consistency
// Helper: Same logic as backend to keep consistency
export function getProminentStatus(statuses: string[], currentStatus: string = ''): string {
    const rawStatuses = statuses || (currentStatus ? [currentStatus] : [])
    if (!rawStatuses || rawStatuses.length === 0) return 'pending'

    const s = rawStatuses.map(x => x.toLowerCase())

    if (s.includes('unpaid')) return 'Unpaid'

    // Priority 1: Failures & Returns (Action Required)
    if (s.includes('returned') || s.includes('customer_return_delivered')) return 'Customer Return Delivered'
    if (s.includes('shipped_back_success') || s.includes('returned_delivered')) return 'Returned Delivered'
    if (s.includes('customer_return')) return 'Customer Return'
    if (s.includes('returning_to_seller') || s.includes('returning to seller') || s.includes('shipped_back') ||
        s.includes('failed_delivery') || s.includes('failed_delivered') || s.includes('delivery_failed') || s.includes('delivery failed')) return 'Returning to Seller'

    // Priority 2: Cancellation (Should override Packed/RTS)
    if (s.includes('canceled') || s.includes('cancelled')) return 'Cancel'

    // Priority 3: Success Flow (Most Advanced State)
    if (s.includes('delivered') || s.includes('completed')) return 'Delivered'
    if (s.includes('shipped')) return 'Shipped'
    if (s.includes('ready_to_ship') || s.includes('ready to ship')) return 'Ready to Ship'
    if (s.includes('packed')) return 'Packed'

    return 'Pending'
}

export function OrderSyncPageContent({ isEmbedded = false }: { isEmbedded?: boolean }) {
    const { data: stores, isLoading, isError, error, refetch } = useOnlineStores()
    const searchParams = useSearchParams()
    const router = useRouter()
    const [syncedOrders, setSyncedOrders] = useState<any[]>([])
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [isSyncingGlobal, setIsSyncingGlobal] = useState(false)

    // Load initial data (Local Storage & DB Orders)
    useEffect(() => {
        // Initialize lastUpdated from localStorage if available
        // Initialize lastUpdated from localStorage if available
        const lastSyncTime = localStorage.getItem('daraz_last_sync_time')
        if (lastSyncTime) {
            setLastUpdated(new Date(parseInt(lastSyncTime)))
        }

        if (stores && stores.length > 0) {
            syncAllStores('db')
        }
    }, [stores])


    useEffect(() => {
        if (searchParams.get('status') === 'success') {
            toast.success('Daraz store connected successfully!', { description: 'You can now sync orders.' })
            router.replace('/dashboard/sales/daraz/order-sync')
        }
    }, [searchParams, router])

    const mergeOrders = (newOrders: any[]) => {
        setSyncedOrders(prev => {
            // Force string ID to prevent duplicate (number vs string)
            const orderMap = new Map(prev.map(o => [String(o.order_id), o]))
            newOrders.forEach(order => {
                orderMap.set(String(order.order_id), order)
            })
            // Initial sort by date desc for raw list
            return Array.from(orderMap.values()).sort((a: any, b: any) => {
                const dateA = new Date(a.daraz_created_at || a.created_at).getTime()
                const dateB = new Date(b.daraz_created_at || b.created_at).getTime()
                return dateB - dateA
            })
        })
    }

    const syncAllStores = async (source: 'api' | 'db' = 'api') => {
        if (!stores || stores.length === 0) return

        setIsSyncingGlobal(true)
        let totalNewOrders = 0

        for (const store of stores) {
            try {
                const url = `/api/daraz/orders?storeId=${store.id}${source === 'db' ? '&source=db' : ''}`
                const response = await fetch(url)
                if (response.ok) {
                    const data = await response.json()

                    if (data.dbSave && !data.dbSave.success && data.dbSave.error) {
                        toast.error('Failed to save orders to database', {
                            description: `Error: ${data.dbSave.error.message || JSON.stringify(data.dbSave.error)}`
                        })
                    }

                    const orders = data.orders || []
                    mergeOrders(orders)
                    totalNewOrders += orders.length
                }
            } catch (error) {
                console.error(`Failed to sync store ${store.seller_account}:`, error)
            }
        }

        // Only update lastUpdated and localStorage for actual API syncs, not DB loads
        if (source === 'api') {
            setLastUpdated(new Date())
            localStorage.setItem('daraz_last_sync_time', String(Date.now()))
        }

        setIsSyncingGlobal(false)
        return totalNewOrders
    }



    // Grouping and Sorting Logic
    const groupedOrders = useMemo(() => {
        if (!syncedOrders.length) return {}

        // 1. Sort by Status Priority (Pending > Packed > Shipped > Delivered > Cancelled)
        const statusPriority: Record<string, number> = {
            'pending': 1,
            'packed': 2,
            'ready_to_ship': 2, // Map to packed equivalent
            'shipped': 3,
            'delivered': 4,
            'canceled': 5,
            'failed': 5,
            'failed_delivered': 5,
            'delivery_failed': 5,
            'returning_to_seller': 5,
            'returned': 5,
            'customer_return_delivered': 6
        }

        const getStatusRank = (o: any) => {
            const displayStatus = getProminentStatus(o.statuses, o.status).toLowerCase()
            return statusPriority[displayStatus] || 6
        }

        // 2. Group by Date
        const groups: Record<string, any[]> = {}

        syncedOrders.forEach(order => {
            const dateObj = new Date(order.daraz_created_at || order.created_at)
            const dateKey = dateObj.toLocaleDateString('en-CA') // YYYY-MM-DD
            if (!groups[dateKey]) groups[dateKey] = []
            groups[dateKey].push(order)
        })

        // 3. Sort within groups by Status Priority
        Object.keys(groups).forEach(date => {
            groups[date].sort((a, b) => getStatusRank(a) - getStatusRank(b))
        })

        // 4. Return stored sorted by Date Key Descending
        return Object.keys(groups)
            .sort((a, b) => b.localeCompare(a))
            .reduce((obj, key) => {
                obj[key] = groups[key]
                return obj
            }, {} as Record<string, any[]>)
    }, [syncedOrders])

    // Helper to get store name
    const getStoreName = (storeId: string) => {
        const store = stores?.find((s: any) => s.id === storeId)
        return store?.seller_account || 'Unknown Store'
    }

    // 5. Compute Status Summary for Top Bar
    const statusSummary = useMemo(() => {
        const summary: Record<string, number> = {
            'Pending': 0,
            'Packed': 0,
            'Ready to Ship': 0,
            'Shipped': 0
        }

        const byStore: Record<string, Record<string, number>> = {}

        syncedOrders.forEach(o => {
            const displayStatus = getProminentStatus(o.statuses, o.status)
            let statusKey = ''

            if (displayStatus === 'Pending') statusKey = 'Pending'
            else if (displayStatus === 'Packed') statusKey = 'Packed'
            else if (displayStatus === 'Ready to Ship') statusKey = 'Ready to Ship'
            else if (displayStatus === 'Shipped') statusKey = 'Shipped'

            if (statusKey) {
                summary[statusKey] = (summary[statusKey] || 0) + 1
                const storeName = getStoreName(o.store_id)
                if (!byStore[storeName]) byStore[storeName] = {}
                byStore[storeName][statusKey] = (byStore[storeName][statusKey] || 0) + 1
            }
        })

        return { total: summary, byStore }
    }, [syncedOrders, stores])

    return (
        <div className="space-y-6 pt-16 md:pt-0">
            {/* Compact Header */}
            <div className="sticky top-16 md:top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm space-y-2">
                {!isEmbedded && (
                    <div className="flex items-center justify-between">
                        <div className="hidden md:block">
                            <h1 className="text-[17px] font-bold">Daraz Order sync</h1>
                            <p className="text-[13px] text-gray-500 dark:text-gray-400">Sync orders from your connected Daraz stores</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Auto Sync Removed */}
                            <Link
                                href="/dashboard/sales/daraz"
                                className="hidden md:flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                            >
                                <ArrowLeft size={12} />
                                Back to Menu
                            </Link>
                        </div>
                    </div>
                )}

                {/* Status Summary Bar */}
                {Object.keys(statusSummary.byStore).length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-[13px] pt-2 border-t dark:border-zinc-800 pb-1">
                        {Object.entries(statusSummary.byStore).map(([storeName, counts]) => (
                            <div key={storeName} className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800/50 px-2 py-1 rounded border border-gray-100 dark:border-zinc-800">
                                <span className="font-bold text-gray-700 dark:text-gray-300">{storeName}:</span>
                                <div className="flex gap-2 text-gray-500 dark:text-gray-400">
                                    {counts['Pending'] > 0 && <span className="text-yellow-600 dark:text-yellow-500">Pending: {counts['Pending']}</span>}
                                    {counts['Ready to Ship'] > 0 && <span className="text-blue-600 dark:text-blue-500">RTS: {counts['Ready to Ship']}</span>}
                                    {counts['Packed'] > 0 && <span className="text-indigo-600 dark:text-indigo-500">Packed: {counts['Packed']}</span>}
                                    {counts['Shipped'] > 0 && <span className="text-green-600 dark:text-green-500">Shipped: {counts['Shipped']}</span>}
                                    {!counts['Pending'] && !counts['Ready to Ship'] && !counts['Packed'] && !counts['Shipped'] && <span>No active orders</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-2 space-y-4">
                {/* Store Cards */}
                <Card>
                    <CardHeader className="px-4 py-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-[17px]">Available Stores</CardTitle>
                            {lastUpdated && (
                                <span className="text-[13px] text-muted-foreground">
                                    Last synced: {lastUpdated.toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        {isLoading ? (
                            <div className="flex justify-center p-4">
                                <RefreshCw className="animate-spin text-gray-400" size={24} />
                            </div>
                        ) : isError ? (
                            <div className="text-center py-8 text-red-500 text-[15px]">
                                <p>Failed to load online stores.</p>
                                <p className="text-xs text-gray-500 mt-1 mb-3">{(error as Error)?.message || 'Unknown error'}</p>
                                <Button
                                    onClick={() => refetch()}
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                                >
                                    <RefreshCw size={14} />
                                    Retry
                                </Button>
                            </div>
                        ) : stores && stores.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {stores.map((store: any) => (
                                    <StoreCard key={store.id} store={store} onSyncSuccess={mergeOrders} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground text-[15px]">
                                <p>No online stores found.</p>
                                <Link href="/dashboard/settings/store-settings" className="text-blue-600 hover:underline mt-1 inline-block">
                                    Add a store in Settings
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Orders Table - Grouped by Date */}
                {Object.keys(groupedOrders).length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-[15px] font-bold text-gray-500 uppercase tracking-wider">Synced Orders</h2>

                        {Object.entries(groupedOrders).map(([date, orders]: [string, any[]], groupIndex) => (
                            <Card key={date} className="overflow-hidden border border-gray-200 dark:border-zinc-800">
                                <div className="bg-gray-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                                    <span className="font-bold text-sm">{date}</span>
                                    <span className="text-[13px] text-muted-foreground">{orders.length} Orders</span>
                                </div>

                                <div className="relative overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-zinc-800">
                                            <tr>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 w-8">S.N</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Order #</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Store</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Date</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Receiver</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Tracking</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">SKUs</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 text-right">Amount</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 text-center">Qty</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 text-center">Status</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 text-center">Raw Status</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 text-center">Item Statuses</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {orders.map((order: any, index: number) => {
                                                const rawStatus = getProminentStatus(order.statuses, order.status).toLowerCase()
                                                const skus = order.items_detail?.map((i: any) => i.sku || i.shop_sku || 'N/A').join(', ') || '-'
                                                const itemStatuses = order.items_detail?.map((i: any) => i.status).filter(Boolean) || []

                                                let displayStatus = 'Pending'
                                                let statusColor = 'bg-gray-100 text-gray-800'

                                                // Determine display status and color based on raw values
                                                if (rawStatus) {
                                                    if (['unpaid'].includes(rawStatus)) {
                                                        displayStatus = 'Unpaid'
                                                        statusColor = 'bg-gray-100 text-gray-700 border border-gray-300'
                                                    }
                                                    else if (['pending'].includes(rawStatus)) {
                                                        displayStatus = 'Pending'
                                                        statusColor = 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                                    }
                                                    else if (['packed'].includes(rawStatus)) {
                                                        displayStatus = 'Packed'
                                                        statusColor = 'bg-blue-50 text-blue-700 border border-blue-200'
                                                    }
                                                    else if (['ready to ship', 'ready_to_ship'].includes(rawStatus)) {
                                                        displayStatus = 'Ready to Ship'
                                                        statusColor = 'bg-green-50 text-green-700 border border-green-200'
                                                    }
                                                    else if (['shipped'].includes(rawStatus)) {
                                                        displayStatus = 'Shipped'
                                                        statusColor = 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                    }
                                                    else if (['delivered', 'completed'].includes(rawStatus)) {
                                                        displayStatus = 'Delivered'
                                                        statusColor = 'bg-green-50 text-green-700 border border-green-200'
                                                    }
                                                    else if (['cancel', 'canceled', 'cancelled'].includes(rawStatus)) {
                                                        displayStatus = 'Cancel'
                                                        statusColor = 'bg-red-50 text-red-700 border border-red-200'
                                                    }
                                                    else if (['failed delivered', 'failed', 'failed_delivery', 'failed_delivered', 'failed delivery', 'shipped_back_success', 'delivery failed', 'delivery_failed', 'returning to seller', 'returning_to_seller', 'shipped_back'].includes(rawStatus)) {
                                                        displayStatus = 'Returning to Seller' // Combined Failure/Return status
                                                        statusColor = 'bg-orange-50 text-orange-700 border border-orange-200'
                                                    }
                                                    else if (['customer return', 'customer_return'].includes(rawStatus)) {
                                                        displayStatus = 'Customer Return'
                                                        statusColor = 'bg-orange-50 text-orange-700 border border-orange-200'
                                                    }
                                                    else if (['returned', 'customer_return_delivered', 'customer return delivered'].includes(rawStatus)) {
                                                        displayStatus = 'Customer Return Delivered'
                                                        statusColor = 'bg-orange-100 text-orange-800 border border-orange-300'
                                                    }
                                                    else if (['shipped_back_success', 'returned_delivered', 'returned delivered'].includes(rawStatus)) {
                                                        displayStatus = 'Returned Delivered'
                                                        statusColor = 'bg-orange-100 text-orange-800 border border-orange-300'
                                                    }

                                                } // End of if(rawStatus) checks

                                                return (
                                                    <tr key={order.order_id} className="bg-white hover:bg-gray-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50">
                                                        <td className="px-2 py-1 text-[13px] text-gray-500">
                                                            {index + 1}
                                                        </td>
                                                        <td className={`px-2 py-1 text-[13px] font-medium ${order.invoice_number ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'text-blue-600'}`}>
                                                            <Link href={`/dashboard/sales/daraz/order-sync/${order.order_number}`} className="hover:underline flex items-center gap-1">
                                                                {order.order_number}
                                                                {order.invoice_number && <span className="text-[11px] px-1 bg-green-200 dark:bg-green-800 rounded">SYNCED</span>}
                                                            </Link>
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px]">
                                                            {getStoreName(order.store_id)}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] text-gray-500">
                                                            {new Date(order.daraz_created_at || order.created_at).toLocaleString()}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] font-medium">
                                                            {order.shipping_name || `${order.customer_first_name} ${order.customer_last_name}`}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] font-mono text-gray-500">
                                                            {order.tracking_code || '-'}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] text-gray-500 max-w-[150px] truncate" title={skus}>
                                                            {skus}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] text-right font-mono">
                                                            {order.price}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] text-center">
                                                            {order.items_count}
                                                        </td>
                                                        <td className="px-2 py-1 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded text-xs uppercase font-bold tracking-wider ${statusColor}`}>
                                                                {displayStatus}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1 text-center">
                                                            <span className="text-[11px] font-mono text-gray-600 dark:text-gray-400">
                                                                {JSON.stringify(order.statuses || [order.status])}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1 text-center">
                                                            <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                                                                {itemStatuses.length > 0 ? JSON.stringify(itemStatuses) : 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1 text-center">
                                                            <RefreshOrderButton
                                                                orderId={order.order_id}
                                                                storeId={order.store_id}
                                                                onRefreshComplete={() => {
                                                                    // Reload orders from DB
                                                                    syncAllStores('db')
                                                                }}
                                                            />
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>

    )
}

export default function OrderSyncPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
            <OrderSyncPageContent />
        </Suspense>
    )
}

function StoreCard({ store, onSyncSuccess }: { store: any, onSyncSuccess: (orders: any[]) => void }) {
    const [status, setStatus] = useState<'idle' | 'linking' | 'syncing' | 'syncing-pending' | 'syncing-shipped' | 'syncing-ready-to-ship' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')

    const handleConnect = async () => {
        try {
            setStatus('linking')
            const response = await fetch(`/api/daraz/auth/url?storeId=${store.id}`)
            const data = await response.json()
            if (data.url) {
                window.location.href = data.url
            } else {
                throw new Error('Failed to get auth URL')
            }
        } catch (error) {
            console.error(error)
            setStatus('error')
            setMessage('Failed to initiate connection')
        }
    }

    const handleSync = async (mode: 'all' | 'pending' | 'shipped' | 'ready_to_ship') => {
        try {
            if (mode === 'all') setStatus('syncing')
            else if (mode === 'pending') setStatus('syncing-pending')
            else if (mode === 'shipped') setStatus('syncing-shipped')
            else if (mode === 'ready_to_ship') setStatus('syncing-ready-to-ship')

            setMessage('')

            const url = `/api/daraz/orders?storeId=${store.id}${mode !== 'all' ? `&status=${mode}` : ''}`
            const response = await fetch(url)

            if (response.status === 401) {
                setMessage('Please connect first')
                setStatus('error')
                return
            }

            const data = await response.json()

            if (data.error) {
                throw new Error(data.error)
            }

            console.log('Orders:', data)

            // Check for DB Save Error
            if (data.dbSave && !data.dbSave.success && data.dbSave.error) {
                toast.error('Sync partly failed', {
                    description: 'Orders fetched but failed to save to database.'
                })
            }

            const orders = data.orders || []
            onSyncSuccess(orders)

            setStatus('success')
            setMessage(`Fetched ${data.count || orders.length} orders`)
        } catch (error: any) {
            console.error(error)
            setStatus('error')
            setMessage(error.message || 'Sync failed')
        }
    }

    const handleSyncAll = () => handleSync('all')
    const handleSyncPending = () => handleSync('pending')
    const handleSyncShipped = () => handleSync('shipped')
    const handleSyncReadyToShip = () => handleSync('ready_to_ship')

    return (
        <div className="flex flex-col gap-3 p-4 border rounded-lg bg-white dark:bg-zinc-900 shadow-sm border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                    <Store size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[17px] truncate" title={store.seller_account}>{store.seller_account}</div>
                    <div className="text-[15px] text-muted-foreground truncate">{store.company_name}</div>
                </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
                <Button
                    onClick={handleConnect}
                    variant="outline"
                    size="sm"
                    className="w-full text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                    disabled={status === 'linking'}
                >
                    {status === 'linking' ? 'Redirecting...' : 'Connect / Re-Auth'}
                </Button>

                <Button
                    onClick={handleSyncAll}
                    variant="default"
                    size="sm"
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    disabled={status.startsWith('syncing') || status === 'linking'}
                >
                    {status === 'syncing' ? (
                        <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync All Orders
                </Button>

                <Button
                    onClick={handleSyncShipped}
                    variant="outline"
                    size="sm"
                    className="w-full text-indigo-700 border-indigo-300 hover:bg-indigo-50 bg-indigo-50/50"
                    disabled={status.startsWith('syncing') || status === 'linking'}
                >
                    {status === 'syncing-shipped' ? (
                        <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Shipped Only
                </Button>

                <Button
                    onClick={handleSyncReadyToShip}
                    variant="outline"
                    size="sm"
                    className="w-full text-blue-700 border-blue-300 hover:bg-blue-50 bg-blue-50/50"
                    disabled={status.startsWith('syncing') || status === 'linking'}
                >
                    {status === 'syncing-ready-to-ship' ? (
                        <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Ready to Ship Only
                </Button>

                <Button
                    onClick={handleSyncPending}
                    variant="outline"
                    size="sm"
                    className="w-full text-yellow-700 border-yellow-300 hover:bg-yellow-50 bg-yellow-50/50"
                    disabled={status.startsWith('syncing') || status === 'linking'}
                >
                    {status === 'syncing-pending' ? (
                        <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Pending Only
                </Button>
            </div>

            {message && (
                <div className={`text-[15px] text-center mt-1 ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                    {message}
                </div>
            )}
        </div>
    )
}

function RefreshOrderButton({ orderId, storeId, onRefreshComplete }: { orderId: string, storeId: string, onRefreshComplete: () => void }) {
    const [isRefreshing, setIsRefreshing] = useReactState(false)

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            const response = await fetch('/api/daraz/orders/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, storeId })
            })

            const data = await response.json()

            if (response.ok) {
                toast.success('Order refreshed!', {
                    description: `Updated statuses: ${data.statuses?.join(', ')}`
                })
                onRefreshComplete()
            } else {
                throw new Error(data.error || 'Failed to refresh')
            }
        } catch (error: any) {
            console.error('Refresh error:', error)
            toast.error('Failed to refresh order', {
                description: error.message
            })
        } finally {
            setIsRefreshing(false)
        }
    }

    return (
        <Button
            onClick={handleRefresh}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={isRefreshing}
        >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
    )
}

