'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    getDarazOrders,
    getDarazOrderById,
    updateDarazOrderStatus,
    getDarazOrderStats,
    syncProductInfoFromInventory,
    syncDarazOrderProducts,
    checkDeliveredCustomerOrders
} from '@/features/sales/actions/daraz-actions'
import { syncOrderStatusesFromDarazData } from '@/features/sales/actions/daraz-sync-status'
import {
    getUserRole,
    getUserDeletionStats,
    createDeletionRequest,
    softDeleteOrder
} from '@/features/sales/actions/daraz-deletion-actions'
import { getOnlineStores } from '@/features/settings/actions/settingsActions'
import { getActivePlanProductIds } from '@/features/purchase/actions/plan-actions'
import { getOrdersStockInfo } from '@/features/sales/actions/get-order-stock-info'
import {
    Search,
    Plus,
    Download,
    Printer,
    List,
    X,
    ArrowLeft,
    Clock,
    RefreshCw,
    Filter,
    FileX,
    ChevronUp,
    ChevronDown,
    Package,
    MessageSquare,
    Copy,
    Check,
    CheckCircle2,
    Truck,
    ExternalLink,
    RotateCcw,
    Store,
    Users,
    CheckSquare,
    Square
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AddDarazOrderModal } from '@/features/sales/components/AddDarazOrderModal'
import { DeletionReasonModal } from '@/features/sales/components/DeletionReasonModal'
import { AdminDeleteConfirm } from '@/features/sales/components/AdminDeleteConfirm'
import { PartialReturnModal } from '@/features/sales/components/PartialReturnModal'
import { QuickPlanButton } from '@/features/sales/components/QuickPlanButton'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { usePermissions } from '@/lib/permissions/PermissionContext'

// Helper Tooltip for Customer Notes
const CustomerRemarksTooltip = ({ remarks }: { remarks: string }) => {
    const [showTooltip, setShowTooltip] = useState(false)
    return (
        <div
            className="relative inline-flex items-center shrink-0 z-20"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    alert(`Remarks / Note:\n\n${remarks}`)
                }}
                className="text-amber-500 hover:text-amber-600 dark:text-amber-400 p-1 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition-colors"
                title="Customer note attached"
            >
                <MessageSquare size={14} />
            </button>

            {showTooltip && (
                <div className="absolute z-50 bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-md text-white border border-zinc-700 rounded-lg shadow-xl p-2.5 min-w-[200px] max-w-[280px] whitespace-normal text-left text-xs leading-snug">
                    <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1">
                        <MessageSquare size={12} /> Customer Note
                    </div>
                    <div className="text-zinc-300 text-xs leading-relaxed break-words">{remarks}</div>
                </div>
            )}
        </div>
    )
}

// Modern Profit / Loss Badge
const ProfitLossBadge = ({ profitInfo, isMobile = false }: { profitInfo: any, isMobile?: boolean }) => {
    if (!profitInfo) {
        return (
            <span className={`inline-flex items-center justify-center ${isMobile ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'} font-medium rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-400 border border-gray-200 dark:border-zinc-700 animate-pulse`}>
                ...
            </span>
        )
    }

    const { status, display, tooltip } = profitInfo

    let badgeClass = ''
    if (status === 'profit') {
        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    } else if (status === 'loss') {
        badgeClass = 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
    } else if (status === 'receivable') {
        badgeClass = 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
    } else {
        badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-800 font-extrabold'
    }

    return (
        <span
            className={`inline-flex items-center justify-center ${isMobile ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'} font-bold rounded-md border whitespace-nowrap select-none ${badgeClass}`}
            title={tooltip || display}
        >
            {display}
        </span>
    )
}

// Status badge styling helper
const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'pending') {
        return {
            label: status,
            bg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
            dot: 'bg-amber-500'
        }
    }
    if (s === 'packed') {
        return {
            label: status,
            bg: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',
            dot: 'bg-indigo-500'
        }
    }
    if (s === 'ready to ship') {
        return {
            label: status,
            bg: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
            dot: 'bg-emerald-500'
        }
    }
    if (s === 'shipped') {
        return {
            label: status,
            bg: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
            dot: 'bg-sky-500'
        }
    }
    if (s === 'delivered') {
        return {
            label: status,
            bg: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/60',
            dot: 'bg-green-500'
        }
    }
    if (s.includes('return')) {
        return {
            label: status,
            bg: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60',
            dot: 'bg-orange-500'
        }
    }
    if (s.includes('fail') || s === 'cancelled' || s === 'cancel') {
        return {
            label: status,
            bg: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
            dot: 'bg-rose-500'
        }
    }
    return {
        label: status,
        bg: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
        dot: 'bg-gray-400'
    }
}

// Active dispatch statuses that qualify for duplicate detection
const ACTIVE_DISPATCH_STATUSES = ['pending', 'packed', 'ready to ship', 'shipped']

// Helper to get last 4 digits of order number
const getOrderLast4 = (orderNumber: string | number) => {
    if (!orderNumber) return ''
    const clean = String(orderNumber).trim()
    return clean.length >= 4 ? clean.slice(-4) : clean
}

// Helper to get compound key: customer name (exact spelling, case-insensitive) + order number last 4 digits
const getCustomerOrderKey = (customerName: string, orderNumber: string | number) => {
    const name = String(customerName || '').trim().toLowerCase()
    const last4 = getOrderLast4(orderNumber)
    if (!name || !last4) return ''
    return `${name}|${last4}`
}

export default function DarazSalesEntryPage() {
    const { canEdit, hasPermission } = usePermissions()
    const canEditOrderEntry = canEdit('Daraz', 'Order Entry')
    const canViewSalesDashboard = hasPermission('Daraz', 'Order List')

    const router = useRouter()
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [selectedOrders, setSelectedOrders] = useState<string[]>([])
    const [searchInput, setSearchInput] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [sellerAccountFilter, setSellerAccountFilter] = useState('all')
    const [unprintedOnly, setUnprintedOnly] = useState(false)
    const [bulkStatus, setBulkStatus] = useState('')
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(1000)
    const [isSyncingOrders, setIsSyncingOrders] = useState(false)
    const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null)
    const [collapsedStores, setCollapsedStores] = useState<Record<string, boolean>>({})

    const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null)
    const [deletionModal, setDeletionModal] = useState<{ isOpen: boolean, order: any | null }>({ isOpen: false, order: null })
    const [adminDeleteModal, setAdminDeleteModal] = useState<{ isOpen: boolean, order: any | null }>({ isOpen: false, order: null })
    const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false)

    // Partial Return State
    const [isPartialReturnOpen, setIsPartialReturnOpen] = useState(false)
    const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null)

    const handleOpenPartialReturn = (order: any) => {
        setSelectedOrderForReturn(order)
        setIsPartialReturnOpen(true)
    }

    const queryClient = useQueryClient()

    // Fetch stats
    const { data: stats } = useQuery({
        queryKey: ['daraz-order-stats', sellerAccountFilter],
        queryFn: () => getDarazOrderStats(sellerAccountFilter, true),
        placeholderData: {
            pending: 0,
            pendingAmount: 0,
            packed: 0,
            packedAmount: 0,
            readyToShip: 0,
            readyToShipAmount: 0,
            shipped: 0,
            shippedAmount: 0
        },
        staleTime: 30 * 1000
    })

    // Fetch online stores for filter
    const { data: onlineStoresResult } = useQuery({
        queryKey: ['online-stores'],
        queryFn: getOnlineStores
    })
    const onlineStores = onlineStoresResult?.data || []

    // Fetch orders (Pending or Today's date + Filters)
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['daraz-orders', page, limit, searchQuery, statusFilter, sellerAccountFilter, unprintedOnly],
        queryFn: () => getDarazOrders({
            page,
            limit,
            status: statusFilter,
            todayOnly: true,
            sellerAccount: sellerAccountFilter,
            unprintedOnly
        }),
        placeholderData: (previousData) => previousData,
        staleTime: 15 * 1000,
        refetchOnWindowFocus: true,
        gcTime: 5 * 60 * 1000
    })

    const orders = data?.orders || []
    const pagination = data?.pagination

    // Fetch stock info for current page orders
    const orderIds = useMemo(() => orders.map(o => o.id), [orders])
    const { data: stockInfoData } = useQuery({
        queryKey: ['order-stock-info', orderIds],
        queryFn: () => getOrdersStockInfo(orderIds),
        enabled: orderIds.length > 0,
        staleTime: 2 * 60 * 1000,
        placeholderData: {}
    })
    const stockInfo = stockInfoData || {}

    // Query for active purchase plans
    const { data: activePlanProductIds = [] } = useQuery({
        queryKey: ['active-purchase-plans'],
        queryFn: () => getActivePlanProductIds(),
        refetchInterval: 30000
    })

    // DUPLICATE ORDER LOGIC:
    // Match BOTH Customer Name (exact spelling, case-insensitive) AND last 4 digits of order number.
    // Qualifying statuses: pending, packed, ready to ship, shipped.
    // Ignored statuses: unpaid, cancel, cancelled, delivered (never marked as duplicate).
    // If two or more qualifying orders share BOTH the same customer name and last 4 digits of order number, mark all as duplicate!
    const activeOrderKeysCount = useMemo(() => {
        const counts: Record<string, number> = {}
        orders.forEach(order => {
            const status = order.order_status?.toLowerCase().trim()
            if (ACTIVE_DISPATCH_STATUSES.includes(status)) {
                const key = getCustomerOrderKey(order.customer_name, order.order_number)
                if (key) {
                    counts[key] = (counts[key] || 0) + 1
                }
            }
        })
        return counts
    }, [orders])

    // REPEAT CUSTOMER LOGIC:
    // Match BOTH Customer Name (exact spelling, case-insensitive) AND last 4 digits of order number.
    // One order is 'Delivered' and another is in ['pending', 'packed', 'ready to ship', 'shipped'].
    // 1. Check within current loaded orders for 'Delivered'
    const deliveredKeysInList = useMemo(() => {
        const set = new Set<string>()
        orders.forEach(order => {
            const status = order.order_status?.toLowerCase().trim()
            if (status === 'delivered') {
                const key = getCustomerOrderKey(order.customer_name, order.order_number)
                if (key) set.add(key)
            }
        })
        return set
    }, [orders])

    // 2. Also check DB for historical 'Delivered' orders matching active customer name + last 4 digits
    const activeLookupList = useMemo(() => {
        const seen = new Set<string>()
        const lookups: { customerName: string; last4: string }[] = []

        orders.forEach(order => {
            const status = order.order_status?.toLowerCase().trim()
            if (ACTIVE_DISPATCH_STATUSES.includes(status)) {
                const cName = String(order.customer_name || '').trim()
                const last4 = getOrderLast4(order.order_number)
                const key = `${cName.toLowerCase()}|${last4}`
                if (cName && last4 && !seen.has(key)) {
                    seen.add(key)
                    lookups.push({ customerName: cName, last4 })
                }
            }
        })

        return lookups
    }, [orders])

    const { data: dbDeliveredKeys = [] } = useQuery({
        queryKey: ['delivered-customer-orders', activeLookupList],
        queryFn: () => checkDeliveredCustomerOrders(activeLookupList),
        enabled: activeLookupList.length > 0,
        staleTime: 5 * 60 * 1000
    })

    const allDeliveredKeys = useMemo(() => {
        const set = new Set<string>(deliveredKeysInList)
        dbDeliveredKeys.forEach((k: string) => set.add(k))
        return set
    }, [deliveredKeysInList, dbDeliveredKeys])

    // Determine customer/order highlight type:
    // 'duplicate' -> GREEN text (duplicate order: same customer name + last 4 digits among active orders)
    // 'repeat'    -> BLUE text (repeat customer: same customer name + last 4 digits with delivered order)
    // 'normal'    -> standard text
    const getOrderHighlightType = (order: any): 'duplicate' | 'repeat' | 'normal' => {
        const status = order.order_status?.toLowerCase().trim()
        const key = getCustomerOrderKey(order.customer_name, order.order_number)
        if (!key) return 'normal'

        // Only active dispatch orders can be marked duplicate or repeat
        if (ACTIVE_DISPATCH_STATUSES.includes(status)) {
            // Priority 1: Duplicate order (2 or more active orders matching BOTH customer name and order number last 4 digits)
            if ((activeOrderKeysCount[key] || 0) > 1) {
                return 'duplicate'
            }

            // Priority 2: Repeat customer (one delivered order exists matching BOTH customer name and order number last 4 digits)
            if (allDeliveredKeys.has(key)) {
                return 'repeat'
            }
        }

        // If this order itself is 'Delivered' and has a matching active order
        if (status === 'delivered' && (activeOrderKeysCount[key] || 0) > 0) {
            return 'repeat'
        }

        return 'normal'
    }

    // Fetch user role on mount
    useEffect(() => {
        getUserRole().then(role => setUserRole(role))
    }, [])

    // Copy order number handler
    const handleCopyOrderNumber = (e: React.MouseEvent, orderNumber: string) => {
        e.stopPropagation()
        navigator.clipboard.writeText(orderNumber)
        setCopiedOrderId(orderNumber)
        toast.success(`Copied #${orderNumber}`, { duration: 1500 })
        setTimeout(() => setCopiedOrderId(null), 2000)
    }

    // Toggle store collapse
    const toggleStoreCollapse = (seller: string) => {
        setCollapsedStores(prev => ({
            ...prev,
            [seller]: !prev[seller]
        }))
    }

    // Handle refreshing order data from database
    const handleSyncOrders = async () => {
        setIsSyncingOrders(true)
        try {
            const syncResult = await syncOrderStatusesFromDarazData()
            if (syncResult.success && syncResult.updated > 0) {
                toast.success(syncResult.message)
            }

            await queryClient.refetchQueries({ queryKey: ['daraz-orders'] })
            await queryClient.refetchQueries({ queryKey: ['daraz-order-stats'] })

            toast.success('Orders refreshed successfully', {
                description: 'Latest statuses synchronized.'
            })
        } catch (error: any) {
            toast.error(error.message || 'Failed to refresh orders')
        } finally {
            setIsSyncingOrders(false)
        }
    }

    const handleUserDeletionSubmit = async (reason: string) => {
        if (!deletionModal.order) return
        setIsSubmittingDeletion(true)
        try {
            const result = await createDeletionRequest(
                deletionModal.order.id,
                deletionModal.order.order_number,
                reason
            )

            if (result.success) {
                toast.success('Deletion request submitted for admin approval')
                queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
                setDeletionModal({ isOpen: false, order: null })
            } else {
                toast.error(result.error || 'Failed to submit request')
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmittingDeletion(false)
        }
    }

    const handleAdminDeleteConfirm = async () => {
        if (!adminDeleteModal.order) return
        setIsSubmittingDeletion(true)
        try {
            const result = await softDeleteOrder(adminDeleteModal.order.id)
            if (result.success) {
                toast.success('Order deleted and moved to Restore Backup')
                queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
                setAdminDeleteModal({ isOpen: false, order: null })
            } else {
                toast.error(result.error || 'Failed to delete order')
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmittingDeletion(false)
        }
    }

    const handleSearch = () => {
        setSearchQuery(searchInput.trim())
        setPage(1)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearchQuery('')
        setPage(1)
    }

    const handleSelectOrder = (orderId: string, checked: boolean) => {
        if (checked) {
            setSelectedOrders([...selectedOrders, orderId])
        } else {
            setSelectedOrders(selectedOrders.filter(id => id !== orderId))
        }
    }

    const handleSelectGroup = (checked: boolean, groupOrders: any[]) => {
        const groupIds = groupOrders.map(o => o.id)
        if (checked) {
            const newSelected = [...selectedOrders]
            groupIds.forEach(id => {
                if (!newSelected.includes(id)) {
                    newSelected.push(id)
                }
            })
            setSelectedOrders(newSelected)
        } else {
            setSelectedOrders(selectedOrders.filter(id => !groupIds.includes(id)))
        }
    }

    const handleBulkStatusUpdate = async () => {
        if (selectedOrders.length === 0 || !bulkStatus) {
            toast.error('Please select orders and a status')
            return
        }

        if (bulkStatus === 'Customer Return Delivered') {
            const targets = orders.filter(o => selectedOrders.includes(o.id))
            const multiItemOrder = targets.find(o => (o.total_quantity || 0) > 1)

            if (multiItemOrder) {
                if (selectedOrders.length > 1) {
                    toast.warning('Please process multi-item returns one at a time to ensure accuracy.')
                    return
                }
                handleOpenPartialReturn(multiItemOrder)
                setBulkStatus('')
                return
            }
        }

        try {
            await updateDarazOrderStatus(selectedOrders, bulkStatus)
            toast.success(`Updated ${selectedOrders.length} orders to ${bulkStatus}`)
            setSelectedOrders([])
            setBulkStatus('')
            queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
            queryClient.invalidateQueries({ queryKey: ['daraz-order-stats'] })
        } catch (error: any) {
            toast.error(error.message || 'Failed to update status')
        }
    }

    // Grouping and Sorting Logic
    const groupedOrders = useMemo(() => {
        if (!orders.length) return []

        const statusPriority: Record<string, number> = {
            'pending': 1,
            'packed': 2,
            'ready to ship': 3,
            'shipped': 4,
            'cancel': 5,
            'cancelled': 5,
            'delivered': 6,
            'failed delivery': 7,
            'delivery failed': 7,
            'fail delivered': 7,
            'returning to seller': 7,
            'customer return': 8,
            'returned': 8,
            'customer return delivered': 9
        }

        const getStatusRank = (status: string) => statusPriority[status.toLowerCase()] || 99

        const groups: Record<string, typeof orders> = {}
        orders.forEach(order => {
            const seller = order.seller_account || 'Unknown'
            if (!groups[seller]) groups[seller] = []
            groups[seller].push(order)
        })

        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === 'Account Not Found') return -1
            if (b === 'Account Not Found') return 1
            return (groups[b]?.length || 0) - (groups[a]?.length || 0)
        })

        sortedKeys.forEach(key => {
            groups[key].sort((a, b) => {
                const rankA = getStatusRank(a.order_status)
                const rankB = getStatusRank(b.order_status)
                if (rankA !== rankB) return rankA - rankB
                return new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
            })
        })

        return sortedKeys.map(key => ({
            seller: key,
            orders: groups[key]
        }))
    }, [orders])

    // Stock Indicator Component
    const StockIndicator = ({ orderId, order }: { orderId: string, order: any }) => {
        const orderStockInfo = stockInfo[orderId]
        const [showTooltip, setShowTooltip] = useState(false)

        if (order?.order_status?.toLowerCase() === 'shipped') {
            return null
        }

        if (!orderStockInfo || orderStockInfo.total_count === 0) {
            return null
        }

        const { products, in_stock_count, total_count } = orderStockInfo

        const getStockBadge = (stock: number) => {
            if (stock > 10) return 'text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            if (stock > 0) return 'text-amber-700 bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
            return 'text-rose-700 bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
        }

        if (total_count === 1) {
            const stock = products[0]?.total_stock ?? 0
            return (
                <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${getStockBadge(stock)}`}
                    title={`Current Stock: ${stock}`}
                >
                    <Package size={13} />
                    <span>{stock}</span>
                </span>
            )
        }

        const allInStock = in_stock_count === total_count
        const someInStock = in_stock_count > 0 && in_stock_count < total_count

        const badgeClass = allInStock
            ? 'text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            : someInStock
                ? 'text-amber-700 bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'text-rose-700 bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'

        return (
            <div
                className="relative inline-block"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border cursor-help ${badgeClass}`}>
                    <Package size={13} />
                    <span>{in_stock_count}/{total_count}</span>
                </span>

                {showTooltip && (
                    <div className="absolute z-50 bottom-full mb-1.5 right-0 bg-zinc-900/95 backdrop-blur-md text-white border border-zinc-700 rounded-lg shadow-xl p-2.5 min-w-[200px]">
                        <div className="text-xs font-bold mb-1.5 text-zinc-300 flex items-center gap-1.5">
                            <Package size={13} className="text-blue-400" /> Stock Breakdown
                        </div>
                        <div className="space-y-1.5">
                            {products.map((product: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs gap-2">
                                    <span className="truncate max-w-[130px] text-zinc-300" title={product.product_name}>
                                        {product.product_name}
                                    </span>
                                    <span className={`font-bold px-1.5 py-0.2 rounded border ${getStockBadge(product.total_stock)}`}>
                                        {product.total_stock}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Smart pagination
    const renderPagination = () => {
        if (!pagination) return null

        const pages = []
        const { page: currentPage, totalPages } = pagination

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
        } else {
            if (currentPage <= 3) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages)
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
            }
        }

        return (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 rounded-b-xl shadow-xs">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                        <span>Show:</span>
                        <select
                            value={limit === 1000 ? 'all' : limit}
                            onChange={(e) => {
                                const val = e.target.value
                                setLimit(val === 'all' ? 1000 : Number(val))
                                setPage(1)
                            }}
                            className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-md px-2 py-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="15">15</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="all">All (Dispatch)</option>
                        </select>
                    </div>
                    <span>
                        Showing {Math.min(((currentPage - 1) * pagination.limit) + 1, pagination.total)} - {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} orders
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {pages.map((p, idx) => (
                        p === '...' ? (
                            <span key={idx} className="px-2 text-sm text-gray-400">...</span>
                        ) : (
                            <button
                                key={idx}
                                onClick={() => setPage(p as number)}
                                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors cursor-pointer ${p === currentPage
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-gray-700 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                {p}
                            </button>
                        )
                    ))}
                </div>
            </div>
        )
    }

    const hasActiveFilters = statusFilter !== 'all' || sellerAccountFilter !== 'all' || unprintedOnly || !!searchQuery

    return (
        <PermissionGuard mainRole="Daraz" subRole="Order Entry">
            <div className="flex flex-col min-h-screen bg-slate-50/70 dark:bg-zinc-950 pb-20">
                {/* 1. Top Executive Header - Full width, narrow padding */}
                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-30 px-3 sm:px-4 py-2.5 transition-colors">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        {/* Title and breadcrumb */}
                        <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-xs shadow-orange-500/20">
                                <Package size={20} />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
                                    Daraz Sales &amp; Dispatch
                                    {isFetching && <RefreshCw size={14} className="animate-spin text-blue-500" />}
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-zinc-400">
                                    Today&apos;s packing operations &amp; order processing
                                </p>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSyncOrders}
                                disabled={isSyncingOrders}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Sync Order Statuses with Daraz Data"
                            >
                                <RefreshCw size={13} className={isSyncingOrders ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline">Sync Orders</span>
                            </button>

                            {canViewSalesDashboard && (
                                <Link
                                    href="/dashboard/sales/daraz/dashboard?from=sales-entry"
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60 border border-purple-200/80 dark:border-purple-800/60 rounded-lg transition-colors"
                                >
                                    <List size={13} />
                                    <span className="hidden sm:inline">Sales Dashboard</span>
                                </Link>
                            )}

                            <Link
                                href="/dashboard/sales/daraz"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors"
                            >
                                <ArrowLeft size={13} />
                                <span className="hidden sm:inline">Back</span>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Main Content: Full-width container with narrow margins to match sidebar */}
                <div className="w-full px-2 sm:px-3 py-2.5 space-y-2.5">
                    {/* 2. Interactive KPI Status Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {/* Pending Card */}
                        <div
                            onClick={() => {
                                setStatusFilter(prev => prev === 'Pending' ? 'all' : 'Pending')
                                setPage(1)
                            }}
                            className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                                statusFilter === 'Pending'
                                    ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 shadow-xs dark:bg-amber-950/40'
                                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-amber-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-600 dark:text-zinc-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    Pending Orders
                                </span>
                                <div className="p-1 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                                    <Clock size={15} />
                                </div>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 flex-wrap">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">
                                        {stats?.pending ?? 0}
                                    </span>
                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                        (Rs. {(stats?.pendingAmount ?? 0).toLocaleString()})
                                    </span>
                                </div>
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Needs packing</span>
                            </div>
                            {statusFilter === 'Pending' && (
                                <span className="absolute top-2 right-2 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.2 rounded">
                                    Active Filter
                                </span>
                            )}
                        </div>

                        {/* Packed Card */}
                        <div
                            onClick={() => {
                                setStatusFilter(prev => prev === 'Packed' ? 'all' : 'Packed')
                                setPage(1)
                            }}
                            className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                                statusFilter === 'Packed'
                                    ? 'bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xs dark:bg-indigo-950/40'
                                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-indigo-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-600 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    Packed Orders
                                </span>
                                <div className="p-1 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40">
                                    <Package size={15} />
                                </div>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 flex-wrap">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">
                                        {stats?.packed ?? 0}
                                    </span>
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                        (Rs. {(stats?.packedAmount ?? 0).toLocaleString()})
                                    </span>
                                </div>
                                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Ready for label</span>
                            </div>
                            {statusFilter === 'Packed' && (
                                <span className="absolute top-2 right-2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.2 rounded">
                                    Active Filter
                                </span>
                            )}
                        </div>

                        {/* Ready to Ship Card */}
                        <div
                            onClick={() => {
                                setStatusFilter(prev => prev === 'Ready to Ship' ? 'all' : 'Ready to Ship')
                                setPage(1)
                            }}
                            className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                                statusFilter === 'Ready to Ship'
                                    ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs dark:bg-emerald-950/40'
                                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-emerald-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-600 dark:text-zinc-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                    Ready to Ship
                                </span>
                                <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                                    <Truck size={15} />
                                </div>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 flex-wrap">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">
                                        {stats?.readyToShip ?? 0}
                                    </span>
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        (Rs. {(stats?.readyToShipAmount ?? 0).toLocaleString()})
                                    </span>
                                </div>
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Awaiting pickup</span>
                            </div>
                            {statusFilter === 'Ready to Ship' && (
                                <span className="absolute top-2 right-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded">
                                    Active Filter
                                </span>
                            )}
                        </div>

                        {/* Shipped Today Card */}
                        <div
                            onClick={() => {
                                setStatusFilter(prev => prev === 'Shipped' ? 'all' : 'Shipped')
                                setPage(1)
                            }}
                            className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                                statusFilter === 'Shipped'
                                    ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-500/30 shadow-xs dark:bg-sky-950/40'
                                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-sky-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-600 dark:text-zinc-300 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                    Shipped Today
                                </span>
                                <div className="p-1 rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-900/40">
                                    <CheckCircle2 size={15} />
                                </div>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 flex-wrap">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">
                                        {stats?.shipped ?? 0}
                                    </span>
                                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                                        (Rs. {(stats?.shippedAmount ?? 0).toLocaleString()})
                                    </span>
                                </div>
                                <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">Handed to rider</span>
                            </div>
                            {statusFilter === 'Shipped' && (
                                <span className="absolute top-2 right-2 text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-1.5 py-0.2 rounded">
                                    Active Filter
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 3. Unified Filter Bar */}
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Search Box */}
                            <div className="relative flex-1 min-w-[200px] max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" size={15} />
                                <input
                                    type="text"
                                    placeholder="Search order#, customer, tracking..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-800 dark:text-zinc-100 transition-all placeholder:text-gray-400"
                                />
                                {searchInput && (
                                    <button
                                        onClick={handleClearSearch}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 rounded"
                                        title="Clear search"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            {/* Seller Store Dropdown */}
                            <div className="relative">
                                <select
                                    value={sellerAccountFilter}
                                    onChange={(e) => {
                                        setSellerAccountFilter(e.target.value)
                                        setPage(1)
                                    }}
                                    className="px-3 py-1.5 text-sm font-semibold bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                                >
                                    <option value="all">🏬 All Stores</option>
                                    {onlineStores.map((store: any) => (
                                        <option key={store.id} value={store.seller_account}>
                                            {store.seller_account}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Dropdown */}
                            <div className="relative">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value)
                                        setPage(1)
                                    }}
                                    className="px-3 py-1.5 text-sm font-semibold bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                                >
                                    <option value="all">⚡ All Statuses</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Packed">Packed</option>
                                    <option value="Ready to Ship">Ready to Ship</option>
                                    <option value="Shipped">Shipped</option>
                                    <option value="Delivered">Delivered</option>
                                    <option value="Delivery Failed">Delivery Failed</option>
                                    <option value="Returning To Seller">Returning To Seller</option>
                                    <option value="Customer Return">Customer Return</option>
                                    <option value="Customer Return Delivered">Customer Return Delivered</option>
                                    <option value="Cancelled">Cancelled</option>
                                    <option value="Unpaid">Unpaid</option>
                                </select>
                            </div>

                            {/* Unprinted Invoices Toggle */}
                            <button
                                onClick={() => {
                                    setUnprintedOnly(!unprintedOnly)
                                    setPage(1)
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg border transition-all cursor-pointer ${
                                    unprintedOnly
                                        ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800'
                                }`}
                                title="Show only orders with unprinted shipping labels"
                            >
                                <FileX size={14} className={unprintedOnly ? 'text-rose-600' : 'text-gray-500'} />
                                <span>Unprinted Labels</span>
                                {unprintedOnly && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                                )}
                            </button>

                            {/* Reset Filters */}
                            {hasActiveFilters && (
                                <button
                                    onClick={() => {
                                        setSellerAccountFilter('all')
                                        setStatusFilter('all')
                                        setUnprintedOnly(false)
                                        setSearchQuery('')
                                        setSearchInput('')
                                        setBulkStatus('')
                                        setPage(1)
                                    }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                    title="Reset all filters"
                                >
                                    <RotateCcw size={13} />
                                    <span>Reset</span>
                                </button>
                            )}

                            {/* Right Actions: Add Order + Total count */}
                            <div className="ml-auto flex items-center gap-2">
                                {canEditOrderEntry && (
                                    <button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs shadow-blue-500/20 transition-colors cursor-pointer"
                                    >
                                        <Plus size={15} />
                                        <span>Add Order</span>
                                    </button>
                                )}

                                <div className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm font-black text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700">
                                    Total: {pagination?.total || 0}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Grouped Order Sections by Seller Store */}
                    <div className="space-y-3">
                        {groupedOrders.map((group, groupIdx) => {
                            const groupStats = group.orders.reduce((acc: any, order) => {
                                const status = order.order_status
                                acc[status] = (acc[status] || 0) + 1
                                return acc
                            }, {})

                            const displayedOrders = group.orders.filter(order => {
                                const s = order.order_status.toLowerCase()
                                if (statusFilter === 'all' && (s === 'cancel' || s === 'cancelled' || s === 'unpaid')) {
                                    return false
                                }
                                return true
                            })

                            if (displayedOrders.length === 0) return null

                            const isCollapsed = collapsedStores[group.seller] ?? false
                            const isAllSelected = displayedOrders.length > 0 && displayedOrders.every(o => selectedOrders.includes(o.id))

                            return (
                                <div
                                    key={group.seller}
                                    id={`group-${groupIdx}`}
                                    className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden transition-all"
                                >
                                    {/* Store Section Header */}
                                    <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-850 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold border border-blue-200 dark:border-blue-800">
                                                <Store size={15} />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-black text-gray-900 dark:text-zinc-100 uppercase tracking-wide">
                                                    {group.seller}
                                                </h3>
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                    {displayedOrders.length} orders
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Breakdown Pills */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {Object.entries(groupStats).map(([st, cnt]) => {
                                                const badge = getStatusBadge(st)
                                                return (
                                                    <span
                                                        key={st}
                                                        className={`text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${badge.bg}`}
                                                    >
                                                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                                                        {st}: {cnt as number}
                                                    </span>
                                                )
                                            })}

                                            {/* Select Group Button */}
                                            <button
                                                onClick={() => handleSelectGroup(!isAllSelected, displayedOrders)}
                                                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ml-1 ${
                                                    isAllSelected
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
                                                }`}
                                                title="Select all orders in this store"
                                            >
                                                {isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                                <span>{isAllSelected ? 'Selected' : 'Select All'}</span>
                                            </button>

                                            {/* Collapse / Expand Toggle */}
                                            <button
                                                onClick={() => toggleStoreCollapse(group.seller)}
                                                className="p-1 text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                                title={isCollapsed ? 'Expand store' : 'Collapse store'}
                                            >
                                                {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Table Content */}
                                    {!isCollapsed && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/80 text-xs font-bold uppercase text-gray-700 dark:text-zinc-300 tracking-wider">
                                                        <th className="py-2.5 px-3 w-10 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isAllSelected}
                                                                onChange={(e) => handleSelectGroup(e.target.checked, displayedOrders)}
                                                                className="rounded border-gray-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                                            />
                                                        </th>
                                                        <th className="py-2.5 px-2 w-10 text-center">#</th>
                                                        <th className="py-2.5 px-2.5 w-24">Date</th>
                                                        <th className="py-2.5 px-2.5 w-28">Invoice</th>
                                                        <th className="py-2.5 px-3 w-48">Order Number</th>
                                                        <th className="hidden lg:table-cell py-2.5 px-3 w-52">Customer</th>
                                                        <th className="py-2.5 px-3 min-w-[220px]">Product / Items</th>
                                                        <th className="py-2.5 px-2 w-16 text-center">Qty</th>
                                                        <th className="py-2.5 px-3 w-28 text-right">Amount</th>
                                                        <th className="py-2.5 px-3 w-28 text-center">Status</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap min-w-[260px] xl:w-72">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm">
                                                    {displayedOrders.map((order, idx) => {
                                                        const isSelected = selectedOrders.includes(order.id)
                                                        const statusBadge = getStatusBadge(order.order_status)
                                                        const isCancelled = order.order_status.toLowerCase().includes('cancel')

                                                        // Customer/Order Highlight Classification:
                                                        // 'duplicate' = Green (active dispatch orders with same last 4 digits)
                                                        // 'repeat'    = Blue (has matching delivered order)
                                                        // 'normal'    = default
                                                        const highlightType = getOrderHighlightType(order)

                                                        const orderClass = highlightType === 'duplicate'
                                                            ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                                            : highlightType === 'repeat'
                                                                ? 'text-blue-600 dark:text-blue-400 font-bold'
                                                                : 'text-gray-800 dark:text-zinc-200 font-medium'

                                                        const customerClass = highlightType === 'duplicate'
                                                            ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                                            : highlightType === 'repeat'
                                                                ? 'text-blue-600 dark:text-blue-400 font-bold'
                                                                : 'text-gray-900 dark:text-zinc-100 font-medium'

                                                        return (
                                                            <tr
                                                                key={order.id}
                                                                className={`group transition-colors ${
                                                                    isSelected
                                                                        ? 'bg-blue-50/70 dark:bg-blue-950/30'
                                                                        : isCancelled
                                                                            ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                                                            : highlightType === 'duplicate'
                                                                                ? 'bg-emerald-50/30 dark:bg-emerald-950/15'
                                                                                : highlightType === 'repeat'
                                                                                    ? 'bg-blue-50/30 dark:bg-blue-950/15'
                                                                                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                                                                }`}
                                                            >
                                                                {/* Selection Checkbox */}
                                                                <td className="py-2 px-3 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                                                                        className="rounded border-gray-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                                                    />
                                                                </td>

                                                                {/* Serial Number */}
                                                                <td className="py-2 px-2 text-center text-sm text-gray-500 dark:text-zinc-400 font-semibold">
                                                                    {idx + 1}
                                                                </td>

                                                                {/* Order Date */}
                                                                <td className="py-2 px-2.5 whitespace-nowrap text-sm text-gray-700 dark:text-zinc-300 font-medium">
                                                                    {new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                                                                </td>

                                                                {/* Invoice Number Link */}
                                                                <td className="py-2 px-2.5 whitespace-nowrap">
                                                                    <button
                                                                        onClick={() => router.push(`/dashboard/sales/daraz/order/${order.id}?from=sales-entry`)}
                                                                        onMouseEnter={() => queryClient.prefetchQuery({
                                                                            queryKey: ['daraz-order', order.id],
                                                                            queryFn: () => getDarazOrderById(order.id)
                                                                        })}
                                                                        className="inline-flex items-center gap-1 font-mono text-sm font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
                                                                        title="View Order Details"
                                                                    >
                                                                        <span>{order.invoice_number}</span>
                                                                        <ExternalLink size={11} className="opacity-60" />
                                                                    </button>
                                                                </td>

                                                                {/* Order Number - Green for Duplicate, Blue for Repeat Customer */}
                                                                <td className="py-2 px-3">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className={`font-mono text-sm ${orderClass}`}>
                                                                            {order.order_number}
                                                                        </span>
                                                                        <button
                                                                            onClick={(e) => handleCopyOrderNumber(e, order.order_number)}
                                                                            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                                                                            title="Copy Order Number"
                                                                        >
                                                                            {copiedOrderId === order.order_number ? (
                                                                                <Check size={13} className="text-emerald-500" />
                                                                            ) : (
                                                                                <Copy size={13} />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </td>

                                                                {/* Customer Name - Green for Duplicate, Blue for Repeat Customer */}
                                                                <td className="hidden lg:table-cell py-2 px-3">
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <span className={`text-sm truncate ${customerClass}`} title={order.customer_name}>
                                                                            {order.customer_name}
                                                                        </span>
                                                                        {order.remarks && (
                                                                            <CustomerRemarksTooltip remarks={order.remarks} />
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* Product Column */}
                                                                <td
                                                                    className="py-2 px-3"
                                                                    title={order.items && order.items.length > 1
                                                                        ? order.items.map((item: any) => `${item.product_name || 'Unknown'} (Qty: ${item.quantity})`).join('\n')
                                                                        : order.first_product_name
                                                                    }
                                                                >
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className={`truncate max-w-[280px] text-sm font-medium ${
                                                                            order.first_product_name === 'Product Not Found'
                                                                                ? 'text-rose-600 font-bold'
                                                                                : 'text-gray-800 dark:text-zinc-200'
                                                                        }`}>
                                                                            {order.first_product_name}
                                                                        </span>
                                                                        {order.item_count > 1 && (
                                                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                                                                                +{order.item_count - 1} more item{order.item_count > 2 ? 's' : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* Total Quantity */}
                                                                <td className="py-2 px-2 text-center">
                                                                    <span className="inline-flex items-center justify-center min-w-[26px] px-2 py-0.5 rounded-md font-bold text-sm bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700">
                                                                        {order.total_quantity}
                                                                    </span>
                                                                </td>

                                                                {/* Grand Total Amount */}
                                                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                                                    <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">
                                                                        Rs. {order.grand_total?.toLocaleString()}
                                                                    </span>
                                                                </td>

                                                                {/* Order Status Badge */}
                                                                <td className="py-2 px-3 text-center whitespace-nowrap">
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md border ${statusBadge.bg}`}>
                                                                        <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot}`} />
                                                                        {order.order_status}
                                                                    </span>
                                                                </td>

                                                                {/* Actions Column: In Single Row without Wrap on Desktop, NO Delete icon */}
                                                                <td className="py-2 px-3 text-center">
                                                                    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                                                        {/* Profit / Loss Badge */}
                                                                        <ProfitLossBadge profitInfo={order.profit_info} />

                                                                        {/* Inventory Stock Indicator */}
                                                                        <StockIndicator orderId={order.id} order={order} />

                                                                        {/* Quick Plan Button */}
                                                                        <QuickPlanButton
                                                                            order={order}
                                                                            stockInfo={stockInfo[order.id]}
                                                                            allOrders={orders}
                                                                            activePlanProductIds={activePlanProductIds}
                                                                        />

                                                                        {/* Print Invoice Button */}
                                                                        <button
                                                                            onClick={() => window.open(`/print/daraz-invoice/${order.id}`, '_blank')}
                                                                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                                                                order.is_printed
                                                                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                                                    : 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-700'
                                                                            }`}
                                                                            title={order.is_printed ? "Invoice printed (Click to re-print)" : "Print Shipping Label"}
                                                                        >
                                                                            <Printer size={15} />
                                                                        </button>

                                                                        {/* Sync Order Products Button */}
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (confirm('Sync products for this order from inventory?')) {
                                                                                    const res = await syncDarazOrderProducts(order.id)
                                                                                    if (res.success) {
                                                                                        toast.success(res.message)
                                                                                        queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
                                                                                    } else {
                                                                                        toast.error(res.message)
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="p-1.5 text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-blue-300 rounded-lg transition-colors cursor-pointer"
                                                                            title="Sync Products from Inventory"
                                                                        >
                                                                            <RefreshCw size={15} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* Empty State */}
                        {orders.length === 0 && !isLoading && !isFetching && (
                            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-12 text-center shadow-xs">
                                <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 flex items-center justify-center mx-auto mb-3">
                                    <Package size={24} />
                                </div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-1">
                                    No Orders Found
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
                                    There are no pending or dispatched orders matching your current filter criteria.
                                </p>
                                {hasActiveFilters && (
                                    <button
                                        onClick={() => {
                                            setSellerAccountFilter('all')
                                            setStatusFilter('all')
                                            setUnprintedOnly(false)
                                            setSearchQuery('')
                                            setSearchInput('')
                                            setBulkStatus('')
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                        <RotateCcw size={14} />
                                        <span>Reset Filters</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Loading State */}
                        {(isLoading || (isFetching && orders.length === 0)) && (
                            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-12 text-center shadow-xs">
                                <RefreshCw className="animate-spin text-blue-500 mx-auto mb-3" size={32} />
                                <p className="text-sm font-bold text-gray-700 dark:text-zinc-300">
                                    Loading Daraz Orders...
                                </p>
                            </div>
                        )}

                        {/* Global Pagination Card */}
                        {renderPagination()}
                    </div>
                </div>

                {/* 5. Modern Floating Bulk Action Bar */}
                {selectedOrders.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-950/90 backdrop-blur-md text-white border border-zinc-700 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-5 max-w-[95vw]">
                        <div className="flex items-center gap-2 pr-3 border-r border-zinc-800">
                            <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-sm font-bold text-zinc-100 whitespace-nowrap">
                                {selectedOrders.length} selected
                            </span>
                            <button
                                onClick={() => setSelectedOrders([])}
                                className="text-xs text-zinc-400 hover:text-white transition-colors underline ml-1 cursor-pointer"
                            >
                                Clear
                            </button>
                        </div>

                        {/* Bulk Print */}
                        <button
                            onClick={() => {
                                const ids = selectedOrders.join(',')
                                window.open(`/print/daraz-invoice/bulk?ids=${ids}`, '_blank')
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            title="Print shipping labels for selected orders"
                        >
                            <Printer size={14} />
                            <span>Print ({selectedOrders.length})</span>
                        </button>

                        {/* Bulk Status Select & Apply */}
                        <div className="flex items-center gap-1.5">
                            <select
                                value={bulkStatus}
                                onChange={(e) => setBulkStatus(e.target.value)}
                                className="px-2.5 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="">Change Status...</option>
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
                            <button
                                onClick={handleBulkStatusUpdate}
                                disabled={!bulkStatus}
                                className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                )}

                {/* 6. Modals */}
                {isAddModalOpen && (
                    <AddDarazOrderModal
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                    />
                )}

                <DeletionReasonModal
                    isOpen={deletionModal.isOpen}
                    orderNumber={deletionModal.order?.order_number || ''}
                    onClose={() => setDeletionModal({ isOpen: false, order: null })}
                    onSubmit={handleUserDeletionSubmit}
                    isSubmitting={isSubmittingDeletion}
                />

                <AdminDeleteConfirm
                    isOpen={adminDeleteModal.isOpen}
                    orderNumber={adminDeleteModal.order?.order_number || ''}
                    onClose={() => setAdminDeleteModal({ isOpen: false, order: null })}
                    onConfirm={handleAdminDeleteConfirm}
                    isDeleting={isSubmittingDeletion}
                />

                <PartialReturnModal
                    isOpen={isPartialReturnOpen}
                    order={selectedOrderForReturn}
                    onClose={() => setIsPartialReturnOpen(false)}
                />
            </div>
        </PermissionGuard>
    )
}
