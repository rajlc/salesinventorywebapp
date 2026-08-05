'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAllDarazOrders, getUniqueSellerAccounts, getOrderStatusSummary } from '@/features/sales/actions/daraz-actions'
import { RefreshCw, Search, X, Eye, ChevronLeft, ChevronRight, Camera } from 'lucide-react'
import { Card, Button } from '@/components/ui-shim'
import { toast } from 'sonner'
import Link from 'next/link'
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal'

export function OrderStatusSyncTable() {
    const [sellerAccountFilter, setSellerAccountFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [searchInput, setSearchInput] = useState('')
    const [isBatchRefreshing, setIsBatchRefreshing] = useState(false)
    const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 })
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(50) // Default 50 as requested
    const [isScannerOpen, setIsScannerOpen] = useState(false)

    const queryClient = useQueryClient()

    // 1. Fetch Unique Seller Accounts
    const { data: sellerAccounts = [] } = useQuery({
        queryKey: ['seller-accounts'],
        queryFn: getUniqueSellerAccounts,
        staleTime: 5 * 60 * 1000 // 5 mins
    })

    // 2. Fetch Filtered Orders (Server-Side)
    const { data: ordersResult, isLoading } = useQuery({
        queryKey: ['status-sync-orders', page, sellerAccountFilter, statusFilter, searchInput, limit],
        queryFn: () => getAllDarazOrders({
            page,
            limit: limit,
            search: searchInput,
            status: statusFilter,
            sellerAccount: sellerAccountFilter
            // Don't pass ignoreStatusFilter, so Cancel orders are hidden by default
        }),
        placeholderData: (previousData) => previousData // Keep prev data while fetching
    })

    const ordersData = ordersResult?.orders || []
    console.log('Status Sync Orders:', ordersData.length)
    const totalPages = ordersResult?.pagination.totalPages || 0
    const totalOrders = ordersResult?.pagination.total || 0

    // Use server data directly (no client filter)
    const paginatedOrders = ordersData

    // Batch refresh only orders on current page
    const handleBatchRefresh = async () => {
        if (paginatedOrders.length === 0) {
            toast.error('No orders to refresh')
            return
        }

        setIsBatchRefreshing(true)
        setRefreshProgress({ current: 0, total: paginatedOrders.length })

        let successCount = 0
        let errorCount = 0
        const statusChanges: { orderNumber: string, oldStatus: string, newStatus: string }[] = []

        // Batch processing helper with concurrency limit
        const CONCURRENT_LIMIT = 5
        let processedCount = 0

        const processOrder = async (order: any) => {
            try {
                const response = await fetch('/api/daraz/orders/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: order.order_id || order.id,
                        storeId: order.store_id
                    })
                })

                if (response.ok) {
                    const result = await response.json()
                    successCount++

                    if (result.newStatus && result.newStatus !== order.order_status) {
                        statusChanges.push({
                            orderNumber: order.order_number,
                            oldStatus: order.order_status || 'Unknown',
                            newStatus: result.newStatus
                        })
                    }
                } else {
                    errorCount++
                }
            } catch (error) {
                console.error(`Failed to refresh order ${order.order_number}:`, error)
                errorCount++
            } finally {
                processedCount++
                setRefreshProgress({ current: processedCount, total: paginatedOrders.length })
            }
        }

        // Process in chunks or simple promise pool
        const chunks = []
        for (let i = 0; i < paginatedOrders.length; i += CONCURRENT_LIMIT) {
            const chunk = paginatedOrders.slice(i, i + CONCURRENT_LIMIT)
            chunks.push(chunk)
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(processOrder))
        }

        setIsBatchRefreshing(false)
        setRefreshProgress({ current: 0, total: 0 })

        // Invalidate ALL order-related queries to update ALL pages
        queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })           // Sales Entry
        queryClient.invalidateQueries({ queryKey: ['daraz-order-stats'] })       // Stats
        queryClient.invalidateQueries({ queryKey: ['status-sync-orders'] })      // This page
        queryClient.invalidateQueries({ queryKey: ['all-daraz-orders'] })        // Order List
        queryClient.invalidateQueries({ queryKey: ['daraz-order-sync'] })        // Order Sync
        queryClient.invalidateQueries({ queryKey: ['order-status-summary'] })    // Dashboard Summary Table

        // Show results with status changes
        if (statusChanges.length > 0) {
            const changesList = statusChanges.map(c => `${c.orderNumber}: ${c.oldStatus} → ${c.newStatus}`).join('\n')
            toast.success(`${statusChanges.length} status changed!`, {
                description: changesList,
                duration: 8000
            })
        } else {
            toast.success(`Refresh complete!`, {
                description: `${successCount} orders checked, no status changes`
            })
        }
    }

    // Handle barcode scan
    const handleBarcodeScan = async (barcode: string): Promise<boolean> => {
        try {
            console.log('[OrderStatusSyncTable] Barcode scanned:', barcode)

            // Check if barcode matches any order_number or tracking_number
            const result = await getAllDarazOrders({
                page: 1,
                limit: 1,
                search: barcode,
                status: 'all',
                sellerAccount: 'all'
            })

            if (result.orders && result.orders.length > 0) {
                // Order found! Set search input and trigger search
                console.log('[OrderStatusSyncTable] Order found:', result.orders[0].order_number)
                setSearchInput(barcode)
                setPage(1)
                return true
            } else {
                // Order not found
                console.log('[OrderStatusSyncTable] Order not found for barcode:', barcode)
                return false
            }
        } catch (error) {
            console.error('[OrderStatusSyncTable] Error checking barcode:', error)
            throw error
        }
    }

    return (
        <div className="p-0 md:p-6 space-y-4">

            {/* Filters */}
            <Card className="p-2 md:p-4 sticky top-16 z-30 md:static shadow-sm md:shadow-none bg-white dark:bg-zinc-900 border-b md:border-b-0">
                {/* Mobile Layout - Two rows */}
                <div className="md:hidden space-y-2">
                    {/* Row 1: Seller Account + Status + Refresh */}
                    <div className="grid grid-cols-3 gap-2">
                        {/* Seller Account Filter */}
                        <div>
                            <select
                                value={sellerAccountFilter}
                                onChange={(e) => setSellerAccountFilter(e.target.value)}
                                className="w-full px-2 py-1.5 border rounded-md text-xs dark:bg-zinc-800 dark:border-zinc-700"
                            >
                                <option value="all">All Accounts</option>
                                {sellerAccounts.map((account: string) => (
                                    <option key={account} value={account}>
                                        {account}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-2 py-1.5 border rounded-md text-xs dark:bg-zinc-800 dark:border-zinc-700"
                            >
                                <option value="all">All Status</option>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Pending">Pending</option>
                                <option value="Packed">Packed</option>
                                <option value="Ready to Ship">Ready to Ship</option>
                                <option value="Shipped">Shipped</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Returning to Seller">Returning to Seller</option>
                                <option value="Returned Delivered">Returned Delivered</option>
                                <option value="Customer Return">Customer Return</option>
                                <option value="Customer Return Delivered">Customer Return Delivered</option>
                                <option value="Cancel">Cancel</option>
                            </select>
                        </div>

                        {/* Refresh Button */}
                        <Button
                            onClick={handleBatchRefresh}
                            disabled={isBatchRefreshing || paginatedOrders.length === 0}
                            className="w-full text-xs px-1 py-1.5 h-auto flex flex-col items-center gap-0.5"
                            size="sm"
                        >
                            {isBatchRefreshing ? (
                                <>
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    <span className="text-[9px] leading-tight">{refreshProgress.current}/{refreshProgress.total}</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-3 w-3" />
                                    <span className="text-[9px] leading-tight">Refresh ({paginatedOrders.length})</span>
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Row 2: Search Order + Camera + Clear Button */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search Order Number"
                                className="w-full pl-8 pr-10 py-1.5 border rounded-md text-xs dark:bg-zinc-800 dark:border-zinc-700"
                            />
                            <button
                                onClick={() => setIsScannerOpen(true)}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-blue-600 hover:text-blue-700 active:scale-95 transition-transform"
                                title="Scan barcode"
                            >
                                <Camera className="h-4 w-4" />
                            </button>
                        </div>
                        {(sellerAccountFilter !== 'all' || statusFilter !== 'all' || searchInput) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSellerAccountFilter('all')
                                    setStatusFilter('all')
                                    setSearchInput('')
                                }}
                                className="px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 text-xs h-auto"
                                size="sm"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                            </Button>
                        )}
                    </div>
                </div>

                {/* Desktop Layout - Same as before */}
                <div className="hidden md:grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Seller Account Filter */}
                    <div>
                        <label className="text-sm font-medium mb-1 block">Seller Account</label>
                        <select
                            value={sellerAccountFilter}
                            onChange={(e) => setSellerAccountFilter(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                            <option value="all">All Accounts</option>
                            {sellerAccounts.map((account: string) => (
                                <option key={account} value={account}>
                                    {account}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="text-sm font-medium mb-1 block">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                            <option value="all">All Status</option>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Pending">Pending</option>
                            <option value="Packed">Packed</option>
                            <option value="Ready to Ship">Ready to Ship</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Returning to Seller">Returning to Seller</option>
                            <option value="Returned Delivered">Returned Delivered</option>
                            <option value="Customer Return">Customer Return</option>
                            <option value="Customer Return Delivered">Customer Return Delivered</option>
                            <option value="Cancel">Cancel</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="text-sm font-medium mb-1 block">Search Order #</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Order Number"
                                className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
                            />
                        </div>
                    </div>

                    {/* Refresh Button */}
                    <div className="flex items-end gap-2">
                        {(sellerAccountFilter !== 'all' || statusFilter !== 'all' || searchInput) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSellerAccountFilter('all')
                                    setStatusFilter('all')
                                    setSearchInput('')
                                }}
                                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Clear
                            </Button>
                        )}
                        <Button
                            onClick={handleBatchRefresh}
                            disabled={isBatchRefreshing || paginatedOrders.length === 0}
                            className="w-full"
                        >
                            {isBatchRefreshing ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Refreshing {refreshProgress.current}/{refreshProgress.total}
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Refresh Page ({paginatedOrders.length})
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Orders Table */}
            <Card className="border-0 shadow-none md:border md:shadow-sm">
                {/* Mobile Table - Optimized Layout */}
                <div className="md:hidden">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-[154px] z-20 shadow-sm">
                            <tr>
                                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400 w-[8%]">S.N</th>
                                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400 w-[15%]">Seller</th>
                                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400 w-[35%]">Order #</th>
                                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400 w-[42%]">
                                    Product
                                    {(sellerAccountFilter !== 'all' || statusFilter !== 'all' || searchInput) && (
                                        <span className="ml-1 text-blue-600 font-extrabold">({totalOrders})</span>
                                    )}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-2 py-6 text-center text-xs text-gray-500">
                                        Loading orders...
                                    </td>
                                </tr>
                            ) : paginatedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-2 py-6 text-center text-xs text-gray-500">
                                        No orders found
                                    </td>
                                </tr>
                            ) : (
                                paginatedOrders.map((order, index) => {
                                    const statusColors: Record<string, string> = {
                                        'pending': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
                                        'packed': 'bg-blue-50 text-blue-700 border border-blue-200',
                                        'ready to ship': 'bg-green-50 text-green-700 border border-green-200',
                                        'shipped': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
                                        'delivered': 'bg-green-100 text-green-800 border border-green-300',
                                        'cancel': 'bg-red-50 text-red-700 border border-red-200',
                                        'failed delivered': 'bg-red-100 text-red-800 border border-red-300',
                                        'returned delivered': 'bg-orange-100 text-orange-800 border border-orange-300',
                                        'customer return': 'bg-orange-50 text-orange-700 border border-orange-200',
                                        'returning to seller': 'bg-orange-50 text-orange-700 border border-orange-200', // Added matching color
                                        'customer return delivered': 'bg-orange-100 text-orange-800 border border-orange-300',
                                    }

                                    const statusKey = order.order_status?.toLowerCase() || 'pending'
                                    const statusColor = statusColors[statusKey] || 'bg-gray-100 text-gray-800'

                                    return (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-2 py-2 text-[11px] align-top text-gray-500">{(page - 1) * limit + index + 1}</td>
                                            <td className="px-2 py-2 text-[11px] max-w-[60px] truncate align-top">{order.seller_account || 'Unknown'}</td>
                                            <td className="px-2 py-2 align-top">
                                                <Link href={`/dashboard/sales/daraz/order/${order.id}?from=status-sync`} className="hover:underline block">
                                                    <div className="text-[11px] font-medium text-blue-600 truncate">{order.order_number}</div>
                                                    <div className="mt-1">
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap ${statusColor}`}>
                                                            {order.order_status || 'Unknown'}
                                                        </span>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="px-2 py-2 align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="text-[11px] line-clamp-2 leading-tight" title={order.product_name}>
                                                        {order.product_name || '-'}
                                                    </div>
                                                    <div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={async () => {
                                                                const toastId = toast.loading('Refreshing...')
                                                                try {
                                                                    const response = await fetch('/api/daraz/orders/refresh', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            orderId: order.order_id,
                                                                            storeId: order.store_id
                                                                        })
                                                                    })

                                                                    if (response.ok) {
                                                                        toast.success('Order refreshed', { id: toastId })
                                                                        queryClient.invalidateQueries({ queryKey: ['status-sync-orders'] })
                                                                    } else {
                                                                        toast.error('Failed to refresh', { id: toastId })
                                                                    }
                                                                } catch (error) {
                                                                    toast.error('Error refreshing order', { id: toastId })
                                                                }
                                                            }}
                                                            className="h-5 px-1.5 text-[9px] w-auto inline-flex"
                                                        >
                                                            <RefreshCw className="h-2.5 w-2.5 mr-1" />
                                                            Refresh
                                                        </Button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Desktop Table - Original Layout */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-zinc-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-600">S.N</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-600">Seller Account</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-600">Order Number</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-600">Product Name</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">Order Status</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                                        Loading orders...
                                    </td>
                                </tr>
                            ) : paginatedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <p>No orders found matching your filters.</p>
                                            <p className="text-xs text-gray-400">
                                                (Total: {totalOrders}, Page: {page}, Seller: {sellerAccountFilter}, Status: {statusFilter})
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedOrders.map((order, index) => {
                                    const statusColors: Record<string, string> = {
                                        'pending': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
                                        'packed': 'bg-blue-50 text-blue-700 border border-blue-200',
                                        'ready to ship': 'bg-green-50 text-green-700 border border-green-200',
                                        'shipped': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
                                        'delivered': 'bg-green-100 text-green-800 border border-green-300',
                                        'cancel': 'bg-red-50 text-red-700 border border-red-200',
                                        'failed delivered': 'bg-red-100 text-red-800 border border-red-300',
                                        'returned delivered': 'bg-orange-100 text-orange-800 border border-orange-300',
                                        'customer return': 'bg-orange-50 text-orange-700 border border-orange-200',
                                        'returning to seller': 'bg-orange-50 text-orange-700 border border-orange-200',
                                        'customer return delivered': 'bg-orange-100 text-orange-800 border border-orange-300',
                                    }

                                    const statusKey = order.order_status?.toLowerCase() || 'pending'
                                    const statusColor = statusColors[statusKey] || 'bg-gray-100 text-gray-800'

                                    return (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-4 py-3 text-sm">{(page - 1) * limit + index + 1}</td>
                                            <td className="px-4 py-3 text-sm">{order.seller_account || 'Unknown'}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-blue-600">
                                                <Link href={`/dashboard/sales/daraz/order/${order.id}?from=status-sync`} className="hover:underline">
                                                    {order.order_number}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-sm max-w-[200px] truncate" title={order.product_name}>
                                                {order.product_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
                                                    {order.order_status || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={async () => {
                                                        const toastId = toast.loading('Refreshing...')
                                                        try {
                                                            const response = await fetch('/api/daraz/orders/refresh', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    orderId: order.order_id,
                                                                    storeId: order.store_id
                                                                })
                                                            })

                                                            if (response.ok) {
                                                                toast.success('Order refreshed', { id: toastId })
                                                                queryClient.invalidateQueries({ queryKey: ['status-sync-orders'] })
                                                            } else {
                                                                toast.error('Failed to refresh', { id: toastId })
                                                            }
                                                        } catch (error) {
                                                            toast.error('Error refreshing order', { id: toastId })
                                                        }
                                                    }}
                                                    className="h-7 px-2 text-xs gap-1"
                                                >
                                                    <RefreshCw className="h-3 w-3" />
                                                    Refresh
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Smart Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center px-4 py-3 border-t">
                        <div className="text-xs text-gray-500 hidden md:block">
                            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalOrders)} of {totalOrders} orders
                        </div>
                        <div className="flex gap-2 w-full md:w-auto justify-center md:justify-end items-center">
                            {/* Rows per page dropdown */}
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value))
                                    setPage(1) // Reset to page 1 on limit change
                                }}
                                className="h-8 md:h-9 px-2 text-xs border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700"
                            >
                                <option value={20}>20 / page</option>
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                            </select>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 md:h-9"
                            >
                                Previous
                            </Button>
                            <span className="flex items-center text-sm font-medium px-2">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="h-8 md:h-9"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Barcode Scanner Modal (Mobile Only) */}
            <BarcodeScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleBarcodeScan}
            />

            {/* Mobile Quick View FAB & Modal */}
            <QuickViewFab sellerAccounts={sellerAccounts} />
        </div>
    )
}

// Separate component for Quick View logic to keep main component clean

// Separate component for Quick View logic to keep main component clean

function QuickViewFab({ sellerAccounts }: { sellerAccounts: string[] }) {
    const [isOpen, setIsOpen] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
    const [summaryData, setSummaryData] = useState<Record<string, any> | null>(null)

    // Fetch summary data when modal opens
    const handleOpen = async () => {
        setIsOpen(true)
        if (!summaryData) {
            try {
                const data = await getOrderStatusSummary()
                // Convert array to record for easier lookup
                const dataMap = data.reduce((acc: any, curr: any) => {
                    acc[curr.seller_account] = curr
                    return acc
                }, {})
                setSummaryData(dataMap)
            } catch (error) {
                console.error("Failed to fetch summary", error)
            }
        }
    }

    const handleClose = () => {
        setIsOpen(false)
        setSelectedAccount(null)
    }

    if (!isOpen) {
        return (
            <div className="md:hidden fixed bottom-20 right-4 z-50 flex items-center justify-center">
                <button
                    onClick={handleOpen}
                    className="flex items-center justify-center bg-blue-600 text-white p-3.5 rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                    title="Quick Status View"
                >
                    <Eye className="h-6 w-6" />
                </button>
            </div>
        )
    }

    // Statuses to show in detail view (Label -> Key)
    const statusMap = [
        { label: 'Pending', key: 'pending', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
        { label: 'Packed', key: 'packed', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        { label: 'Ready to Ship', key: 'ready_to_ship', color: 'bg-green-50 text-green-700 border-green-200' },
        { label: 'Shipped', key: 'shipped', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
    ]

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={handleClose} />

            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-sm relative z-10 overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-gray-50 dark:bg-zinc-800">
                    <div className="flex items-center gap-2">
                        {selectedAccount && (
                            <button onClick={() => setSelectedAccount(null)} className="mr-1">
                                <ChevronLeft className="h-5 w-5 text-gray-500" />
                            </button>
                        )}
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {selectedAccount ? selectedAccount : 'Select Account'}
                        </h3>
                    </div>
                    <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {!summaryData ? (
                        <div className="flex justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                    ) : !selectedAccount ? (
                        /* Account List */
                        <div className="space-y-2">
                            {sellerAccounts.map(account => {
                                const accountData = summaryData[account]
                                // Calculate total active orders for preview
                                const totalActive = accountData ?
                                    (accountData.pending || 0) +
                                    (accountData.packed || 0) +
                                    (accountData.ready_to_ship || 0) +
                                    (accountData.shipped || 0) : 0

                                return (
                                    <button
                                        key={account}
                                        onClick={() => setSelectedAccount(account)}
                                        className="w-full text-left px-4 py-3 rounded-md bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex justify-between items-center transition-colors"
                                    >
                                        <span className="font-medium text-sm text-gray-700 dark:text-gray-200">{account}</span>
                                        <div className="flex items-center gap-2">
                                            {totalActive > 0 && (
                                                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                    {totalActive}
                                                </span>
                                            )}
                                            <ChevronRight className="h-4 w-4 text-gray-400" />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        /* Account Details */
                        <div className="space-y-3">
                            {statusMap.map(({ label, key, color }) => {
                                const count = summaryData[selectedAccount]?.[key] || 0

                                return (
                                    <div key={key} className={`flex justify-between items-center p-3 rounded-md border ${color}`}>
                                        <span className="font-medium text-sm">{label}</span>
                                        <span className="text-lg font-bold">{count}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
