'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDarazOrders, getDarazOrderById, deleteDarazOrder, updateDarazOrderStatus, getDarazOrderStats, syncProductInfoFromInventory, syncDarazOrderProducts } from '@/features/sales/actions/daraz-actions'
import { syncOrderStatusesFromDarazData } from '@/features/sales/actions/daraz-sync-status'
import { getUserRole, getUserDeletionStats, createDeletionRequest, softDeleteOrder } from '@/features/sales/actions/daraz-deletion-actions'
import { getOnlineStores } from '@/features/settings/actions/settingsActions'
import { getActivePlanProductIds } from '@/features/purchase/actions/plan-actions'
import { getOrdersStockInfo } from '@/features/sales/actions/get-order-stock-info'
import { Search, Plus, Upload, Download, Printer, List, X, ArrowLeft, Trash2, Clock, RefreshCw, Filter, FileX, ChevronUp, ChevronDown, Package, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui-shim'
import { AddDarazOrderModal } from '@/features/sales/components/AddDarazOrderModal'
import { ImportDarazOrdersModal } from '@/features/sales/components/ImportDarazOrdersModal'
import { DeletionReasonModal } from '@/features/sales/components/DeletionReasonModal'
import { AdminDeleteConfirm } from '@/features/sales/components/AdminDeleteConfirm'
import { AuditTrailHover } from '@/features/sales/components/AuditTrailHover'
import { PartialReturnModal } from '@/features/sales/components/PartialReturnModal'
import { QuickPlanButton } from '@/features/sales/components/QuickPlanButton'
// DarazInvoice removed

import { toast } from 'sonner'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { usePermissions } from '@/lib/permissions/PermissionContext'
const CustomerRemarksTooltip = ({ remarks }: { remarks: string }) => {
    const [showTooltip, setShowTooltip] = useState(false)
    return (
        <div 
            className="relative z-20 hover:z-30 inline-block shrink-0"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={(e) => {
                e.stopPropagation()
                alert(`Remarks / Note:\n\n${remarks}`)
            }}
        >
            <button 
                type="button" 
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors focus:outline-none flex items-center justify-center p-0.5"
                title="Click to view full note"
            >
                <MessageSquare size={13} />
            </button>
            
            {showTooltip && (
                <div className="absolute z-50 bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-zinc-900 text-white border border-zinc-700 rounded shadow-lg p-2 min-w-[200px] max-w-[300px] whitespace-normal text-left text-[11px] leading-snug font-normal">
                    <div className="font-bold text-yellow-450 mb-0.5">Remarks / Note:</div>
                    <div className="italic break-words text-zinc-200">{remarks}</div>
                </div>
            )}
        </div>
    )
}

export default function DarazSalesEntryPage() {
    const { canEdit, hasPermission } = usePermissions()
    const canEditOrderEntry = canEdit('Daraz', 'Order Entry')
    const canViewSalesDashboard = hasPermission('Daraz', 'Order List')

    const router = useRouter()
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [selectedOrders, setSelectedOrders] = useState<string[]>([])
    const [searchInput, setSearchInput] = useState('')
    const [searchQuery, setSearchQuery] = useState('') // Actual search query used for fetching
    const [statusFilter, setStatusFilter] = useState('all')
    const [sellerAccountFilter, setSellerAccountFilter] = useState('all') // New filter
    const [unprintedOnly, setUnprintedOnly] = useState(false) // New filter for 'Awb Unprint'
    const [bulkStatus, setBulkStatus] = useState('')
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(1000)
    const [isSyncingOrders, setIsSyncingOrders] = useState(false)

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

    // Fetch stats (Filtered by Seller Account, Shipped restricted to Today for Sales Entry context)
    const { data: stats } = useQuery({
        queryKey: ['daraz-order-stats', sellerAccountFilter],
        queryFn: () => getDarazOrderStats(sellerAccountFilter, true),
        placeholderData: { pending: 0, packed: 0, readyToShip: 0, shipped: 0 },
        staleTime: 60 * 1000 // 1 minute
    })

    // Fetch online stores for filter
    const { data: onlineStoresResult } = useQuery({
        queryKey: ['online-stores'],
        queryFn: getOnlineStores
    })
    const onlineStores = onlineStoresResult?.data || []

    // Fetch orders (Pending or Today's date + Filters)
    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['daraz-orders', page, limit, searchQuery, statusFilter, sellerAccountFilter, unprintedOnly],
        queryFn: () => getDarazOrders({
            page,
            limit,
            status: statusFilter,
            todayOnly: true, // Show only Pending or today's orders
            sellerAccount: sellerAccountFilter,
            unprintedOnly
        }),
        placeholderData: (previousData) => previousData,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000
    })

    const orders = data?.orders || []
    const pagination = data?.pagination

    // Fetch stock info for current page orders
    const orderIds = orders.map(o => o.id)
    const { data: stockInfoData } = useQuery({
        queryKey: ['order-stock-info', orderIds],
        queryFn: () => getOrdersStockInfo(orderIds),
        enabled: orderIds.length > 0,
        staleTime: 2 * 60 * 1000, // 2 minutes
        placeholderData: {}
    })

    const stockInfo = stockInfoData || {}


    // Query for active purchase plans
    const { data: activePlanProductIds = [] } = useQuery({
        queryKey: ['active-purchase-plans'],
        queryFn: () => getActivePlanProductIds(),
        // Refetch often to keep UI sync
        refetchInterval: 30000
    })


    // Calculate customer frequency (Global in current list)
    const customerCounts = useMemo(() => {
        return orders.reduce((acc: { [key: string]: number }, order) => {
            const name = order.customer_name?.toLowerCase().trim() || ''
            if (name) acc[name] = (acc[name] || 0) + 1
            return acc
        }, {})
    }, [orders])

    // Calculate customer frequency per date
    const customerCountsByDate = useMemo(() => {
        return orders.reduce((acc: { [key: string]: number }, order) => {
            const name = order.customer_name?.toLowerCase().trim() || ''
            // Normalize date to YYYY-MM-DD to ignore time
            const date = new Date(order.order_date).toLocaleDateString('en-CA')
            const key = `${name}|${date}`
            if (name) acc[key] = (acc[key] || 0) + 1
            return acc
        }, {})
    }, [orders])

    // Helper to determine customer highlight class
    const getCustomerClass = (name: string, dateStr: string) => {
        const n = name?.toLowerCase().trim() || ''
        const date = new Date(dateStr).toLocaleDateString('en-CA')
        const dateKey = `${n}|${date}`

        // Priority 1: Duplicate Name AND Same Date (Green)
        if (customerCountsByDate[dateKey] > 1) {
            return 'text-green-600 dark:text-green-400 font-bold'
        }

        // Priority 2: Duplicate Name in List (Blue)
        if (customerCounts[n] > 1) {
            return 'text-blue-600 dark:text-blue-400 font-bold'
        }

        return 'text-gray-700 dark:text-gray-300'
    }

    // Memoize duplicate order number detection for performance
    const duplicateOrderNumbers = useMemo(() => {
        const counts: { [key: string]: number } = {}
        orders.forEach(order => {
            counts[order.order_number] = (counts[order.order_number] || 0) + 1
        })
        return Object.keys(counts).filter(orderNumber => counts[orderNumber] > 1)
    }, [orders])

    // Memoize highlighted duplicate IDs
    const highlightedDuplicates = useMemo(() => {
        const ids: string[] = []
        orders.forEach(order => {
            if (duplicateOrderNumbers.includes(order.order_number)) {
                ids.push(order.id)
            }
        })
        return ids
    }, [orders, duplicateOrderNumbers])

    // Fetch user role on mount
    useEffect(() => {
        getUserRole().then(role => setUserRole(role))
    }, [])

    // Handle refreshing order data from database
    const handleSyncOrders = async () => {
        setIsSyncingOrders(true)
        try {

            // 1. Trigger Status Sync Logic (Fix mismatches between Raw JSON and Status Column)
            const syncResult = await syncOrderStatusesFromDarazData()
            if (syncResult.success && syncResult.updated > 0) {
                toast.success(syncResult.message)
            } else if (syncResult.success && syncResult.updated === 0) {
                // constant feedback might be annoying, but good for confirmation
                console.log(syncResult.message)
            }

            // 2. Refetch queries
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

    // Handle syncing product info from inventory
    const handleSyncProductInfo = async () => {
        if (!confirm('This will match seller SKUs from your orders with products in the inventory and update product names/accounts.\n\nContinue?')) {
            return
        }

        try {
            const result = await syncProductInfoFromInventory()
            alert(result.message)

            if (result.success && result.updated > 0) {
                // Refresh orders to show updated product info
                queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
            }
        } catch (error: any) {
            alert(`Sync error: ${error.message}`)
        }
    }

    // Delete handlers
    const handleDeleteClick = async (order: any) => {
        if (userRole === 'admin') {
            setAdminDeleteModal({ isOpen: true, order })
        } else {
            const stats = await getUserDeletionStats()
            if (!stats.canDelete) {
                const nextTime = stats.nextDeletionAvailable
                    ? new Date(stats.nextDeletionAvailable).toLocaleString()
                    : 'later'
                toast.error(`Feature blocked! You can delete again after ${nextTime}`)
                return
            }
            setDeletionModal({ isOpen: true, order })
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

    const handleDelete = (orderId: string, orderNumber: string) => {
        // Legacy function - redirect to new system
        const order = orders.find(o => o.id === orderId)
        if (order) handleDeleteClick(order)
    }


    const handleSearch = () => {
        setSearchQuery(searchInput)
        setPage(1)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearchQuery('')
        setPage(1)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedOrders(orders.map(o => o.id))
        } else {
            setSelectedOrders([])
        }
    }

    const handleSelectOrder = (orderId: string, checked: boolean) => {
        if (checked) {
            setSelectedOrders([...selectedOrders, orderId])
        } else {
            setSelectedOrders(selectedOrders.filter(id => id !== orderId))
        }
    }

    // New: Handle selection for a specific group of orders
    const handleSelectGroup = (checked: boolean, groupOrders: any[]) => {
        const groupIds = groupOrders.map(o => o.id)

        if (checked) {
            // Add group IDs to selection (avoid duplicates)
            const newSelected = [...selectedOrders]
            groupIds.forEach(id => {
                if (!newSelected.includes(id)) {
                    newSelected.push(id)
                }
            })
            setSelectedOrders(newSelected)
        } else {
            // Remove group IDs from selection
            setSelectedOrders(selectedOrders.filter(id => !groupIds.includes(id)))
        }
    }

    const handleBulkStatusUpdate = async () => {
        if (selectedOrders.length === 0 || !bulkStatus) {
            toast.error('Please select orders and a status')
            return
        }

        // Intercept "Customer Return Delivered" for Partial Returns
        if (bulkStatus === 'Customer Return Delivered') {
            const targets = orders.filter(o => selectedOrders.includes(o.id))
            const multiItemOrder = targets.find(o => (o.total_quantity || 0) > 1)

            if (multiItemOrder) {
                if (selectedOrders.length > 1) {
                    toast.warning('Please process multi-item returns one at a time to ensure accuracy.')
                    return
                }

                // Open Partial Return Modal for the single selected multi-item order
                handleOpenPartialReturn(multiItemOrder)
                // Reset bulk status to avoid confusion
                setBulkStatus('')
                return
            }
        }

        try {
            await updateDarazOrderStatus(selectedOrders, bulkStatus)
            toast.success(`Updated ${selectedOrders.length} orders`)
            setSelectedOrders([])
            setBulkStatus('')
            queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
        } catch (error: any) {
            toast.error(error.message || 'Failed to update status')
        }
    }

    /* handlePrint removed in favor of direct window.open */


    // Render pagination
    const renderPagination = () => {
        if (!pagination) return null

        const pages = []
        const { page: currentPage, totalPages } = pagination

        // Smart pagination logic (same as Product List)
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i)
            }
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
            <div className="flex items-center justify-between px-4 py-3 border-t dark:border-zinc-700">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] text-gray-600 dark:text-gray-400">Show:</span>
                        <select
                            value={limit === 1000 ? 'all' : limit}
                            onChange={(e) => {
                                const val = e.target.value
                                setLimit(val === 'all' ? 1000 : Number(val))
                                setPage(1)
                            }}
                            className="bg-zinc-50 border border-gray-300 text-gray-900 text-[13px] rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1 dark:bg-zinc-700 dark:border-zinc-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                        >
                            <option value="9">9</option>
                            <option value="18">18</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="all">All</option>
                        </select>
                    </div>
                    <div className="text-[15px] text-gray-600 dark:text-gray-400">
                        Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} orders
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {pages.map((p, idx) => (
                        p === '...' ? (
                            <span key={idx} className="px-2 text-gray-400">...</span>
                        ) : (
                            <button
                                key={idx}
                                onClick={() => setPage(p as number)}
                                className={`px-3 py-1 text-[17px] rounded ${p === currentPage
                                    ? 'bg-blue-600 text-white'
                                    : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
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

    // Grouping and Sorting Logic
    const groupedOrders = useMemo(() => {
        if (!orders.length) return []

        const storeOrder = ['Bagmati Traders', 'Balaju Shop', 'Btas', 'Cosmetic Shop']
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

        // 1. Group by Seller Account
        const groups: Record<string, typeof orders> = {}
        orders.forEach(order => {
            const seller = order.seller_account || 'Unknown'
            if (!groups[seller]) groups[seller] = []
            groups[seller].push(order)
        })

        // 2. Sort Groups - "Account Not Found" first, then by Order Count (Descending)
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            // Priority: "Account Not Found" should always be first
            if (a === 'Account Not Found') return -1
            if (b === 'Account Not Found') return 1

            // For other groups, sort by order count (descending)
            return (groups[b]?.length || 0) - (groups[a]?.length || 0)
        })

        // 3. Sort Orders within Groups
        sortedKeys.forEach(key => {
            groups[key].sort((a, b) => {
                const rankA = getStatusRank(a.order_status)
                const rankB = getStatusRank(b.order_status)
                if (rankA !== rankB) return rankA - rankB

                // If same status, sort by Date (Desc)
                return new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
            })
        })

        return sortedKeys.map(key => ({
            seller: key,
            orders: groups[key]
        }))
    }, [orders])

    /* REMOVED: Navigation code that used deleted currentGroupIndex state
    // Sync current group index on scroll (Placed here so groupedOrders is defined)
    useEffect(() => {
        const handleScroll = () => {
            const headerOffset = 180 // Increased offset for safety
 
            // Find the group that is currently at the top of the viewport
            let activeIndex = 0
 
            for (let i = 0; i < groupedOrders.length; i++) {
                const element = document.getElementById(`group-${i}`)
                if (element) {
                    const rect = element.getBoundingClientRect()
                    // If the top of the element is visible or above the viewport, 
                    // and the bottom is still in view (or it's the last one)
                    if (rect.top <= headerOffset + 50) {
                        activeIndex = i
                    }
                }
            }
 
            setCurrentGroupIndex(activeIndex)
        }
 
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [groupedOrders.length])
    */

    /* REMOVED: handleNextGroup function
    const handleNextGroup = () => {
        const headerOffset = 150 // Approx header height + sticky group header
        let targetIndex = -1
 
        // Find the FIRST group that starts BELOW the current header line
        for (let i = 0; i < groupedOrders.length; i++) {
            const element = document.getElementById(`group-${i}`)
            if (element) {
                const rect = element.getBoundingClientRect()
                // If this group's top is reasonably below the header, it's our target
                // We use a small buffer (+10) to avoid selecting the current one if it's just barely aligned
                if (rect.top > headerOffset + 10) {
                    targetIndex = i
                    break
                }
            }
        }
 
        // If no group is below (e.g. we are at the last one), do nothing or strictly +1 if valid
        if (targetIndex === -1 && currentGroupIndex < groupedOrders.length - 1) {
            targetIndex = currentGroupIndex + 1
        }
 
        if (targetIndex !== -1) {
            const element = document.getElementById(`group-${targetIndex}`)
            if (element) {
                const elementPosition = element.getBoundingClientRect().top
                const offsetPosition = elementPosition + window.scrollY - headerOffset
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                })
                // No need to manually set index, the scroll listener will pick it up
            }
        }
    }
    */

    /* REMOVED: handlePrevGroup function
    const handlePrevGroup = () => {
        const headerOffset = 150
        let targetIndex = -1
 
        // Find the LAST group that is ABOVE or AT the header line
        // We want to go to the "Previous" visual block
        // Best logic: Find the group currently at the top (activeIndex), and go to activeIndex - 1
 
        // Let's re-calculate active index from DOM to be sure
        let currentVisualIndex = 0
        for (let i = 0; i < groupedOrders.length; i++) {
            const element = document.getElementById(`group-${i}`)
            if (element) {
                const rect = element.getBoundingClientRect()
                if (rect.top <= headerOffset + 50) {
                    currentVisualIndex = i
                }
            }
        }
 
        targetIndex = currentVisualIndex - 1
 
        if (targetIndex >= 0) {
            const element = document.getElementById(`group-${targetIndex}`)
            if (element) {
                const elementPosition = element.getBoundingClientRect().top
                const offsetPosition = elementPosition + window.scrollY - headerOffset
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                })
            }
        }
    }
    */

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase()
        if (s === 'pending') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        if (s === 'ready to ship') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' // Light Green as requested
        if (s === 'packed') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
        if (s === 'shipped') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        if (s === 'delivered') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        if (s === 'cancel' || s === 'cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' // Red as requested
        if (s.includes('return')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        if (s.includes('fail') || s.includes('delivery failed') || s === 'failed delivered') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }

    const getRowClass = (order: any) => {
        const status = order.order_status.toLowerCase()
        const isDuplicate = highlightedDuplicates.includes(order.id)

        if (status === 'cancel' || status === 'cancelled') return 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors'
        if (isDuplicate) return 'bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors'
        return 'hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors'
    }

    // Stock Indicator Component
    const StockIndicator = ({ orderId, order }: { orderId: string, order: any }) => {
        const orderStockInfo = stockInfo[orderId]
        const [showTooltip, setShowTooltip] = useState(false)

        // Hide stock for shipped orders
        if (order?.order_status?.toLowerCase() === 'shipped') {
            return null
        }

        if (!orderStockInfo || orderStockInfo.total_count === 0) {
            return null // No products or no stock data yet
        }

        const { products, in_stock_count, total_count } = orderStockInfo

        // Helper to get stock color
        const getStockColor = (stock: number) => {
            if (stock > 10) return 'text-green-600 dark:text-green-400'
            if (stock > 0) return 'text-yellow-600 dark:text-yellow-400'
            return 'text-red-600 dark:text-red-400'
        }

        // For single product
        if (total_count === 1) {
            const stock = products[0].total_stock
            return (
                <div className={`flex items-center gap-1 text-[11px] font-medium ${getStockColor(stock)}`} title={`Stock: ${stock}`}>
                    <Package size={16} />
                    <span>{stock}</span>
                </div>
            )
        }

        // For multiple products - show summary with tooltip
        const allInStock = in_stock_count === total_count
        const someInStock = in_stock_count > 0 && in_stock_count < total_count
        const noneInStock = in_stock_count === 0

        const badgeColor = allInStock
            ? 'text-green-600 dark:text-green-400'
            : someInStock
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'

        return (
            <div
                className="relative"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <div className={`flex items-center gap-1 text-[11px] font-medium cursor-help ${badgeColor}`}>
                    <Package size={18} />
                    <span>{in_stock_count}/{total_count}</span>
                </div>

                {/* Tooltip */}
                {showTooltip && (
                    <div className="absolute z-50 bottom-full mb-2 right-0 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-lg shadow-lg p-2 min-w-[180px]">
                        <div className="text-[11px] font-bold mb-1 text-gray-700 dark:text-gray-300">Stock Details:</div>
                        <div className="space-y-1">
                            {products.map((product, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[10px]">
                                    <span className="truncate max-w-[120px] text-gray-600 dark:text-gray-400" title={product.product_name}>
                                        {product.product_name}
                                    </span>
                                    <span className={`font-medium ml-2 ${getStockColor(product.total_stock)}`}>
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

    return (
        <PermissionGuard mainRole="Daraz" subRole="Order Entry">
            <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Compact Header */}
            <div className="z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Left: Title Group */}
                    {/* Left: Title Group */}
                    <div className="hidden md:block">
                        <h1 className="text-[18px] font-bold">Daraz Sales</h1>
                        <p className="text-[14px] text-gray-500 dark:text-gray-400">Order Management</p>
                    </div>

                    {stats && (
                        <div className="flex flex-wrap gap-1.5">
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-900 dark:text-yellow-400 whitespace-nowrap`}>
                                Pending: {stats.pending}
                            </span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-900 dark:text-indigo-400 whitespace-nowrap`}>
                                Packed: {stats.packed}
                            </span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-900 dark:text-green-400 whitespace-nowrap`}>
                                Ready: {stats.readyToShip}
                            </span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-400 whitespace-nowrap`}>
                                Shipped: {stats.shipped}
                            </span>
                        </div>
                    )}

                    {/* Right: Actions Group (Import/Export + Back) */}
                    <div className="flex items-center gap-2">
                        {canEditOrderEntry && (
                            <>
                                <button
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1 text-[15px] border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors dark:text-gray-50 whitespace-nowrap hidden md:flex"
                                >
                                    <Upload size={11} />
                                    Import
                                </button>
                                <button className="flex items-center gap-2 px-3 py-1 text-[15px] border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors dark:text-gray-50 whitespace-nowrap hidden md:flex">
                                    <Download size={11} />
                                    Export
                                </button>
                            </>
                        )}

                        <Link
                            href="/dashboard/sales/daraz"
                            className="hidden md:flex items-center gap-1 px-2 py-1 text-[15px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors whitespace-nowrap"
                        >
                            <ArrowLeft size={11} />
                            Back to Sales
                        </Link>
                    </div>
                </div>
            </div>

            {/* Compact Action Bar with Filters */}
            <div className="z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">

                    {/* Seller Account Dropdown */}
                    <select
                        value={sellerAccountFilter}
                        onChange={(e) => setSellerAccountFilter(e.target.value)}
                        className="px-2 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-200"
                        style={{ maxWidth: '120px' }}
                    >
                        <option value="all">All Sellers</option>
                        {onlineStores.map((store: any) => (
                            <option key={store.id} value={store.seller_account}>
                                {store.seller_account}
                            </option>
                        ))}
                    </select>

                    {/* Status Dropdown */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-2 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-200"
                    >
                        <option value="all">All Status</option>
                        <option value="Unpaid">Unpaid</option>
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
                    </select>

                    {/* Awb Unprint Button */}
                    <button
                        onClick={() => setUnprintedOnly(!unprintedOnly)}
                        className={`hidden md:flex items-center gap-1 px-2 py-1 text-[15px] border rounded transition-colors whitespace-nowrap ${unprintedOnly
                            ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 font-medium'
                            : 'hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-gray-300'
                            }`}
                        title="Show orders with unprinted invoices/AWB only"
                    >
                        <FileX size={10} />
                        Unprinted Invoices
                    </button>

                    {/* Separator */}
                    <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700"></div>

                    {/* Search Box */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={11} />
                        <input
                            type="text"
                            placeholder="Search order#, tracking#..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-6 pr-6 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                        />
                        {searchInput && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="Clear search"
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>

                    {/* Action Buttons */}
                    {canEditOrderEntry && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 text-[15px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap"
                        >
                            <Plus size={11} />
                            Add
                        </button>
                    )}


                    {/* Clear Filters Button */}
                    <button
                        onClick={() => {
                            setSellerAccountFilter('all')
                            setStatusFilter('all')
                            setUnprintedOnly(false)
                            setSearchQuery('')
                            setSearchInput('')
                            setBulkStatus('')
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-[15px] font-bold text-white bg-red-500 hover:bg-red-600 rounded transition-colors whitespace-nowrap"
                        title="Clear all filters"
                    >
                        <X size={10} strokeWidth={3} />
                        Clear
                    </button>

                    {/* Right Aligned Navigation Group */}
                    <div className="ml-auto flex items-center gap-2">
                        {canViewSalesDashboard && (
                            <Link
                                href="/dashboard/sales/daraz/dashboard?from=sales-entry"
                                className="hidden md:flex items-center gap-1 px-2 py-1 text-[15px] bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors whitespace-nowrap"
                            >
                                <List size={11} />
                                Sales Dashboard
                            </Link>
                        )}



                        <div className="text-[15px] font-black text-black dark:text-gray-100 whitespace-nowrap flex items-center gap-2">
                            {isFetching && <RefreshCw className="animate-spin text-blue-600" size={12} />}
                            Total: {pagination?.total || 0}
                        </div>
                    </div>
                </div>

                {/* Compact Bulk Actions */}
                {selectedOrders.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t dark:border-zinc-700 flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{selectedOrders.length} selected</span>
                        <button
                            onClick={() => setSelectedOrders([])}
                            className="px-2 py-0.5 text-[11px] font-medium  text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded dark:bg-red-900/20 dark:text-red-400 dark:border-red-900 transition-colors"
                        >
                            Unselect All
                        </button>
                        <button
                            onClick={() => {
                                const ids = selectedOrders.join(',')
                                window.open(`/print/daraz-invoice/bulk?ids=${ids}`, '_blank')
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 text-[13px] border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded dark:text-gray-50"
                        >
                            <Printer size={11} />
                            Print
                        </button>
                        <select
                            value={bulkStatus}
                            onChange={(e) => setBulkStatus(e.target.value)}
                            className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
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
                            className="px-2 py-0.5 text-[13px] bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Update
                        </button>
                    </div>
                )}
            </div>

            {/* Orders Area - Grouped by Seller */}
            <div className={`flex-1 overflow-y-auto p-2 pb-24 transition-opacity duration-200 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
                {groupedOrders.map((group, groupIdx) => {
                    // Calculate stats for this group
                    const groupStats = group.orders.reduce((acc: any, order) => {
                        const status = order.order_status
                        acc[status] = (acc[status] || 0) + 1
                        return acc
                    }, {})

                    // Filter orders for display: Hide Cancel/Cancelled or Unpaid orders
                    const displayedOrders = group.orders.filter(order => {
                        const s = order.order_status.toLowerCase()
                        if (s === 'cancel' || s === 'cancelled' || s === 'unpaid') {
                            return false // Hide Cancel/Cancelled and Unpaid orders
                        }
                        return true
                    })

                    if (displayedOrders.length === 0) return null // Skip empty groups after filter

                    return (
                        <div key={group.seller} id={`group-${groupIdx}`} className="mb-6 scroll-mt-32">
                            {/* Group Header */}
                            <div className="flex flex-col gap-1 mb-2 px-1 sticky top-0 z-10 bg-gray-50 dark:bg-zinc-900 py-1">
                                {/* Row 1: Name and Total */}
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide min-w-fit">
                                        {group.seller}
                                    </h3>
                                    <span className="text-xs px-2 py-0.5 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-full text-gray-600 dark:text-gray-400 font-medium">
                                        Total: {group.orders.length}
                                    </span>
                                </div>
                                {/* Row 2: Status Badges (Scrollable) */}
                                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide pb-1">
                                    {Object.entries(groupStats).map(([status, count]) => (
                                        <span key={status} className={`text-[11px] px-1.5 py-0.5 rounded border ${status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                            status === 'Packed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                status === 'Ready to Ship' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    (status === 'Cancel' || status === 'Cancelled') ? 'bg-red-50 text-red-700 border-red-200' :
                                                        'bg-gray-50 text-gray-600 border-gray-200'
                                            }`}>
                                            {status}: {count as number}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <Card className="dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full table-fixed border-collapse">
                                        <thead className="bg-gray-50 dark:bg-zinc-800 border-b dark:border-zinc-700">
                                            <tr>
                                                <th className="hidden md:table-cell px-1.5 py-1 text-left w-8">
                                                    <input
                                                        type="checkbox"
                                                        // Checked if ALL displayed orders in this group are selected
                                                        checked={displayedOrders.length > 0 && displayedOrders.every(o => selectedOrders.includes(o.id))}
                                                        onChange={(e) => handleSelectGroup(e.target.checked, displayedOrders)}
                                                        className="rounded text-blue-600 focus:ring-blue-500 dark:bg-zinc-700 dark:border-zinc-600 w-3.5 h-3.5"
                                                        title="Select Group"
                                                    />
                                                </th>
                                                <th className="px-1.5 py-1 text-left text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-10">SN</th>
                                                <th className="px-1.5 py-1 text-left text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-14 md:w-22">Date</th>
                                                <th className="px-1.5 py-1 text-left text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-auto md:w-28">Invoice</th>
                                                <th className="px-1.5 py-1 text-left text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-auto md:w-32">Order</th>
                                                <th className="hidden md:table-cell px-1.5 py-1 text-left text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-45">Customer</th>
                                                <th className="hidden md:table-cell px-1.5 py-1 text-left text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-48">Product</th>
                                                {/* <th className="hidden md:table-cell px-1.5 py-1 text-left text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-20">Product ID</th> */}
                                                <th className="hidden md:table-cell px-1.5 py-1 text-right text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-16">Qty</th>
                                                <th className="hidden md:table-cell px-1.5 py-1 text-right text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-24">Amount</th>
                                                <th className="hidden md:table-cell px-1.5 py-1 text-left text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-24">Status</th>

                                                <th className="hidden md:table-cell px-1.5 py-1 text-center text-[13px] font-bold uppercase text-gray-900 dark:text-gray-100 w-29">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                                            {displayedOrders.map((order, idx) => (
                                                <tr
                                                    key={order.id}
                                                    className={getRowClass(order)}
                                                >
                                                    <td className="hidden md:table-cell px-1.5 py-0.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedOrders.includes(order.id)}
                                                            onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                                                            className="rounded text-blue-600 focus:ring-blue-500 dark:bg-zinc-700 dark:border-zinc-600 w-3.5 h-3.5"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300 align-top md:align-middle">{idx + 1}</td>
                                                    <td className="px-1.5 py-0.5 text-[15px] text-gray-700 dark:text-gray-300 align-top md:align-middle">
                                                        <span className="md:hidden font-medium">{new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</span>
                                                        <span className="hidden md:inline">{new Date(order.order_date).toLocaleDateString('en-GB')}</span>
                                                    </td>
                                                    <td className="px-1.5 py-0.5 align-top md:align-middle">
                                                        <button
                                                            onClick={() => router.push(`/dashboard/sales/daraz/order/${order.id}?from=sales-entry`)}
                                                            onMouseEnter={() => queryClient.prefetchQuery({
                                                                queryKey: ['daraz-order', order.id],
                                                                queryFn: () => getDarazOrderById(order.id)
                                                            })}
                                                            className="text-[14px] font-mono text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
                                                        >
                                                            <span className="md:hidden">{order.invoice_number?.slice(-5)}</span>
                                                            <span className="hidden md:inline">{order.invoice_number}</span>
                                                        </button>
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300 align-top md:align-middle">
                                                        {/* Desktop View */}
                                                        <div className="hidden md:block">
                                                            {order.order_number}
                                                            {highlightedDuplicates.includes(order.id) && (
                                                                <span className="ml-1 text-red-600 text-xs font-bold" title="Duplicate">⚠️</span>
                                                            )}
                                                        </div>

                                                        {/* Mobile Merged View (3 Rows) */}
                                                        <div className="md:hidden flex flex-col gap-0.5">
                                                            {/* Row 1: Order # */}
                                                            <div className="font-bold text-[13px] break-all">
                                                                #{order.order_number}
                                                            </div>
                                                            {/* Row 2: Qty • Price */}
                                                            <div className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                                                                {order.total_quantity} • Rs. {order.grand_total?.toLocaleString()}
                                                            </div>
                                                            {/* Row 3: Status */}
                                                            <div>
                                                                <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${getStatusColor(order.order_status)} inline-block`}>
                                                                    {order.order_status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className={`hidden md:table-cell px-1.5 py-0.5 text-[15px] ${getCustomerClass(order.customer_name, order.order_date)}`}>
                                                        <div className="flex items-center gap-1.5 min-w-0 overflow-visible relative z-10 hover:z-30">
                                                            <span className="truncate" title={order.customer_name}>{order.customer_name}</span>
                                                            {order.remarks && (
                                                                <CustomerRemarksTooltip remarks={order.remarks} />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td
                                                        className={`hidden md:table-cell px-1.5 py-0.5 text-[15px] ${order.first_product_name === 'Product Not Found' ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'} ${order.item_count > 1 ? 'cursor-help' : ''}`}
                                                        title={order.items && order.items.length > 1
                                                            ? order.items.map((item: any) => item.product_name || 'Unknown Product').join('\n')
                                                            : order.first_product_name
                                                        }
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="truncate">{order.first_product_name}</span>
                                                            {order.item_count > 1 && (
                                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                                    (+{order.item_count - 1} more)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {/* <td className="hidden md:table-cell px-1.5 py-0.5 text-sm text-gray-600 dark:text-gray-400">
                                                        {order.first_product_code ? `#${order.first_product_code}` : '-'}
                                                    </td> */}
                                                    <td className="hidden md:table-cell px-1.5 py-0.5 text-[15px] text-right text-gray-700 dark:text-gray-300">{order.total_quantity}</td>
                                                    <td className="hidden md:table-cell px-1.5 py-0.5 text-[15px] text-right font-medium text-gray-700 dark:text-gray-300">
                                                        <span>Rs. {order.grand_total?.toLocaleString()}</span>
                                                    </td>
                                                    <td className="hidden md:table-cell px-1.5 py-0.5">
                                                        <span className={`px-1 py-0.5 text-xs font-medium rounded ${getStatusColor(order.order_status)}`}>
                                                            {order.order_status}
                                                        </span>
                                                    </td>

                                                    <td className="hidden md:table-cell px-1.5 py-0.5">
                                                        <div className="flex items-center justify-center gap-0.5">
                                                            {/* Stock Indicator */}
                                                            <StockIndicator orderId={order.id} order={order} />

                                                            {/* Quick Plan Button */}
                                                            <QuickPlanButton
                                                                order={order}
                                                                stockInfo={stockInfo[order.id]}
                                                                allOrders={orders}
                                                                activePlanProductIds={activePlanProductIds}
                                                            />

                                                            <button
                                                                onClick={() => window.open(`/print/daraz-invoice/${order.id}`, '_blank')}
                                                                className={`p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded ${order.is_printed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}
                                                                title={order.is_printed ? "Printed" : "Print"}
                                                            >
                                                                <Printer size={13} />
                                                            </button>

                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm('Sync products for this order?')) {
                                                                        const res = await syncDarazOrderProducts(order.id)
                                                                        if (res.success) {
                                                                            toast.success(res.message)
                                                                            // Auto-refresh: Invalidate orders cache to trigger automatic UI update
                                                                            queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
                                                                        } else {
                                                                            toast.error(res.message)
                                                                        }
                                                                    }
                                                                }}
                                                                className="px-1 py-0.5 text-[13px] text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                                title="Sync products from inventory"
                                                            >
                                                                <RefreshCw size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )
                })}

                {orders.length === 0 && !isLoading && !isFetching && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No orders found. Click "Add New Order" to create one.
                    </div>
                )}

                {isLoading || isFetching && orders.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        Loading...
                    </div>
                )}

                {/* Global Pagination */}
                {renderPagination()}
            </div>

            {/* Modals */}
            {
                isAddModalOpen && (
                    <AddDarazOrderModal
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                    />
                )
            }

            {
                isImportModalOpen && (
                    <ImportDarazOrdersModal
                        isOpen={isImportModalOpen}
                        onClose={() => setIsImportModalOpen(false)}
                    />
                )
            }

            {/* Deletion Modals */}
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

        </div >
        </PermissionGuard>
    )
}

