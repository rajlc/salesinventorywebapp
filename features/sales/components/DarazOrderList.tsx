'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAllDarazOrders, deleteDarazOrder, updateDarazOrderStatus, getDarazOrderById, getAllFiscalYears, getActiveFiscalYear, syncDarazOrderProducts, syncProductInfoFromInventory, getUniqueSellerAccounts } from '@/features/sales/actions/daraz-actions'
import { getUserRole, getUserDeletionStats, createDeletionRequest, softDeleteOrder } from '@/features/sales/actions/daraz-deletion-actions'
import { Search, Printer, ArrowLeft, X, Trash2, Clock, RefreshCw, Split, Camera } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui-shim'
import { DeletionReasonModal } from '@/features/sales/components/DeletionReasonModal'
import { AdminDeleteConfirm } from '@/features/sales/components/AdminDeleteConfirm'
import { AuditTrailHover } from '@/features/sales/components/AuditTrailHover'
import { toast } from 'sonner'
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal'
import { useDashboard } from '@/app/dashboard/context'

import { PartialReturnModal } from '@/features/sales/components/PartialReturnModal'

interface DarazOrderListProps {
    isEmbedded?: boolean
}

export function DarazOrderList({ isEmbedded = false }: DarazOrderListProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [selectedOrders, setSelectedOrders] = useState<string[]>([])
    const [searchInput, setSearchInput] = useState('')
    const [isScannerOpen, setIsScannerOpen] = useState(false)

    // Handle barcode scan
    const handleBarcodeScan = async (barcode: string): Promise<boolean> => {
        try {
            // Check if barcode matches any order
            const result = await getAllDarazOrders({
                page: 1,
                limit: 1,
                search: barcode,
                status: 'all',
                sellerAccount: 'all'
            })

            if (result.orders && result.orders.length > 0) {
                setSearchInput(barcode)
                setPage(1)
                return true
            }
            return false
        } catch (error) {
            console.error('Scan error:', error)
            return false
        }
    }
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [bulkStatus, setBulkStatus] = useState('')
    const [page, setPage] = useState(1)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('')
    const [timestampField, setTimestampField] = useState<string>('order_date')
    const [displayStatus, setDisplayStatus] = useState<string>('order_date')
    const [sellerAccount, setSellerAccount] = useState<string>('all')
    const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null)
    const [deletionModal, setDeletionModal] = useState<{ isOpen: boolean, order: any | null }>({ isOpen: false, order: null })
    const [adminDeleteModal, setAdminDeleteModal] = useState<{ isOpen: boolean, order: any | null }>({ isOpen: false, order: null })
    const [partialReturnModal, setPartialReturnModal] = useState<{ isOpen: boolean, order: any | null }>({ isOpen: false, order: null })

    const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false)
    const [isSyncingLinks, setIsSyncingLinks] = useState(false)

    const queryClient = useQueryClient()

    // Debounce search input
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setSearch(searchInput)
            setPage(1)
        }, 500) // 500ms delay

        return () => clearTimeout(timeoutId)
    }, [searchInput])

    // Global Header Integration
    const { setHeaderTitle } = useDashboard()

    useEffect(() => {
        if (isEmbedded) return

        if (setHeaderTitle) {
            setHeaderTitle('Order List')
        }
        return () => {
            if (setHeaderTitle) setHeaderTitle(null)
        }
    }, [setHeaderTitle, isEmbedded])

    // Fetch fiscal years
    const { data: fiscalYears } = useQuery({
        queryKey: ['fiscal-years'],
        queryFn: getAllFiscalYears,
    })

    // Set fiscal year from URL params
    useEffect(() => {
        const fyFromUrl = searchParams.get('fiscalYear')
        if (fyFromUrl) {
            setSelectedFiscalYear(fyFromUrl)
        }
    }, [searchParams])

    // Fetch user role on mount
    useEffect(() => {
        getUserRole().then(role => setUserRole(role))
    }, [])

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
                queryClient.invalidateQueries({ queryKey: ['all-daraz-orders'] })
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
                queryClient.invalidateQueries({ queryKey: ['all-daraz-orders'] })
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
        const order = orders.find(o => o.id === orderId)
        if (order) handleDeleteClick(order)
    }

    // Fetch ALL orders
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['all-daraz-orders', page, search, statusFilter, startDate, endDate, selectedFiscalYear, timestampField, sellerAccount],
        queryFn: () => getAllDarazOrders({
            page,
            limit: 50,
            search,
            status: statusFilter,
            fromDate: startDate,
            toDate: endDate,
            fiscalYearId: selectedFiscalYear || undefined,
            timestampField: timestampField || 'order_date',
            sellerAccount: sellerAccount !== 'all' ? sellerAccount : undefined
        })
    })

    // Fetch unique seller accounts
    const { data: sellerAccounts } = useQuery({
        queryKey: ['unique-seller-accounts'],
        queryFn: getUniqueSellerAccounts,
    })

    const orders = data?.orders || []
    const pagination = data?.pagination

    // Calculate customer frequency
    const customerCounts = orders.reduce((acc: { [key: string]: number }, order) => {
        acc[order.customer_name] = (acc[order.customer_name] || 0) + 1
        return acc
    }, {})

    // Calculate customer frequency specifically for TODAY
    const customerCountsToday = orders.reduce((acc: { [key: string]: number }, order) => {
        const today = new Date().toISOString().split('T')[0]
        const orderDate = new Date(order.order_date).toLocaleDateString('en-CA') // YYYY-MM-DD

        if (orderDate === today) {
            acc[order.customer_name] = (acc[order.customer_name] || 0) + 1
        }
        return acc
    }, {})

    // Helper to determine customer highlight class
    const getCustomerClass = (name: string, dateStr: string) => {
        const today = new Date().toISOString().split('T')[0]
        const orderDate = new Date(dateStr).toLocaleDateString('en-CA')

        // Priority 1: Duplicate ON TODAY (Green)
        if (orderDate === today && (customerCountsToday[name] || 0) > 1) {
            return 'text-green-600 dark:text-green-400 font-bold'
        }

        // Priority 2: Duplicate Global/History (Blue)
        if (customerCounts[name] > 1) {
            return 'text-blue-600 dark:text-blue-400 font-bold'
        }

        return 'text-gray-700 dark:text-gray-300'
    }

    // Group orders by date
    const groupedOrders = orders.reduce<{ [key: string]: typeof orders }>((acc, order) => {
        const date = new Date(order.order_date).toLocaleDateString('en-GB')
        if (!acc[date]) acc[date] = []
        acc[date].push(order)
        return acc
    }, {})

    const handleSearch = () => {
        setSearch(searchInput)
        setPage(1)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
    }

    const handleClearDateFilter = () => {
        setStartDate('')
        setEndDate('')
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

    const handleBulkStatusUpdate = async () => {
        if (selectedOrders.length === 0 || !bulkStatus) {
            toast.error('Please select orders and a status')
            return
        }

        try {
            await updateDarazOrderStatus(selectedOrders, bulkStatus)
            toast.success(`Updated ${selectedOrders.length} orders`)
            setSelectedOrders([])
            setBulkStatus('')
            queryClient.invalidateQueries({ queryKey: ['all-daraz-orders'] })
        } catch (error: any) {
            toast.error(error.message || 'Failed to update status')
        }
    }

    // Render pagination (Compact)
    const renderPagination = () => {
        if (!pagination || pagination.totalPages <= 1) return null

        const pages = []
        const { page: currentPage, totalPages } = pagination

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
                <div className="text-[17px] text-gray-600 dark:text-gray-400">
                    Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} orders
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

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Mobile Filter Section - Replaces Header & Action Bar on Mobile */}
            <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-3 shadow-sm space-y-3">
                {/* Row 1: Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search order or tracking..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full pl-8 pr-16 py-2 text-sm border dark:border-zinc-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50 bg-gray-50"
                    />

                    {searchInput && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X size={14} />
                        </button>
                    )}

                    <button
                        onClick={() => setIsScannerOpen(true)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 hover:text-blue-700 active:scale-95"
                        title="Scan Barcode"
                    >
                        <Camera size={16} />
                    </button>
                </div>

                {/* Row 2: Status & Account (Grid) */}
                <div className="grid grid-cols-2 gap-2">
                    <select
                        value={displayStatus}
                        onChange={(e) => {
                            const selectedField = e.target.value
                            setDisplayStatus(selectedField)
                            // Auto-set status logic (duplicated from desktop)
                            const statusMap: Record<string, { status: string, timestampField: string }> = {
                                'order_date': { status: 'all', timestampField: 'order_date' },
                                'pending': { status: 'Pending', timestampField: 'order_date' },
                                'packed': { status: 'Packed', timestampField: 'order_date' },
                                'ready_to_ship': { status: 'Ready to Ship', timestampField: 'order_date' },
                                'shipped_at': { status: 'Shipped', timestampField: 'shipped_at' },
                                'delivered_at': { status: 'Delivered', timestampField: 'delivered_at' },
                                'returning_to_seller': { status: 'Returning to Seller', timestampField: 'order_date' },
                                'returned_delivered': { status: 'Returned Delivered', timestampField: 'returned_delivered_at' },
                                'customer_return_at': { status: 'Customer Return', timestampField: 'customer_return_at' },
                                'customer_return_delivered_at': { status: 'Customer Return Delivered', timestampField: 'customer_return_delivered_at' },
                                'cancelled_at': { status: 'Cancel', timestampField: 'cancelled_at' }
                            }
                            const mapping = statusMap[selectedField] || { status: 'all', timestampField: 'order_date' }
                            setStatusFilter(mapping.status)
                            setTimestampField(mapping.timestampField)
                            setPage(1)
                        }}
                        className="w-full px-2 py-2 text-sm border dark:border-zinc-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50 bg-gray-50"
                    >
                        <option value="order_date">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="packed">Packed</option>
                        <option value="ready_to_ship">Ready to Ship</option>
                        <option value="shipped_at">Shipped</option>
                        <option value="delivered_at">Delivered</option>
                        <option value="returning_to_seller">Returning to Seller</option>
                        <option value="returned_delivered">Returned Delivered</option>
                        <option value="customer_return_at">Customer Return</option>
                        <option value="customer_return_delivered_at">Customer Return Delivered</option>
                        <option value="cancelled_at">Cancelled</option>
                    </select>

                    <select
                        value={sellerAccount}
                        onChange={(e) => { setSellerAccount(e.target.value); setPage(1); }}
                        className="w-full px-2 py-2 text-sm border dark:border-zinc-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50 bg-gray-50"
                    >
                        <option value="all">All Accounts</option>
                        {sellerAccounts?.map((account: string) => (
                            <option key={account} value={account}>{account}</option>
                        ))}
                    </select>
                </div>

                {/* Row 3: Dates & Actions */}
                <div className="flex gap-2 items-center">
                    <div className="grid grid-cols-[1fr_auto_1fr] flex-1 gap-2 items-center bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-lg px-2 py-1">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="w-full bg-transparent text-sm focus:outline-none p-1"
                            placeholder="Start"
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            className="w-full bg-transparent text-sm focus:outline-none p-1"
                            placeholder="End"
                        />
                    </div>

                    {(startDate || endDate || statusFilter !== 'all' || sellerAccount !== 'all' || searchInput) && (
                        <button
                            onClick={() => {
                                setTimestampField('order_date')
                                setDisplayStatus('order_date')
                                setStartDate('')
                                setEndDate('')
                                setStatusFilter('all')
                                setSellerAccount('all')
                                setSearchInput('')
                                setSearch('')
                                setPage(1)
                            }}
                            className="px-3 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg whitespace-nowrap"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                {/* Row 4: Total Count (Visible on mobile) */}
                {pagination && pagination.total > 0 && (
                    <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
                        <div className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded">
                            Total: <span className="font-bold text-blue-600 dark:text-blue-400">{pagination.total}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Compact Header - Conditionally rendered */}
            {!isEmbedded && (
                <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold">Daraz Order List</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">All History</p>
                    </div>
                    <Link
                        href="/dashboard/sales/daraz/sales-entry"
                        className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        Back to Sales Entry
                    </Link>
                </div>
            )}

            {/* Compact Action Bar - Desktop Only */}
            <div className={`hidden md:block sticky ${isEmbedded ? 'top-0' : 'top-[44px]'} z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm`}>
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Fiscal Year Selector - Only show when coming from Sales Report */}
                    {searchParams.get('fiscalYear') && (
                        <select
                            value={selectedFiscalYear}
                            onChange={(e) => {
                                setSelectedFiscalYear(e.target.value)
                                setPage(1)
                            }}
                            className="px-2 py-1 text-[11px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                            disabled={!fiscalYears || fiscalYears.length === 0}
                        >
                            <option value="">All Time</option>
                            {!fiscalYears || fiscalYears.length === 0 ? (
                                <option disabled>Loading...</option>
                            ) : (
                                fiscalYears.map(fy => {
                                    const startDate = new Date(fy.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                    const endDate = new Date(fy.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                    return (
                                        <option key={fy.id} value={fy.id}>
                                            {fy.name} ({startDate} - {endDate})
                                        </option>
                                    )
                                })
                            )}
                        </select>
                    )}

                    {/* Comprehensive Status Filter */}
                    <select
                        value={displayStatus}
                        onChange={(e) => {
                            const selectedField = e.target.value
                            setDisplayStatus(selectedField)

                            // Auto-set status filter and ensure proper timestamp field mapping
                            const statusMap: Record<string, { status: string, timestampField: string }> = {
                                'order_date': { status: 'all', timestampField: 'order_date' },
                                'pending': { status: 'Pending', timestampField: 'order_date' },
                                'packed': { status: 'Packed', timestampField: 'order_date' },
                                'ready_to_ship': { status: 'Ready to Ship', timestampField: 'order_date' },
                                'shipped_at': { status: 'Shipped', timestampField: 'shipped_at' },
                                'delivered_at': { status: 'Delivered', timestampField: 'delivered_at' },
                                'returning_to_seller': { status: 'Returning to Seller', timestampField: 'order_date' },
                                'returned_delivered': { status: 'Returned Delivered', timestampField: 'returned_delivered_at' },
                                'customer_return_at': { status: 'Customer Return', timestampField: 'customer_return_at' },
                                'customer_return_delivered_at': { status: 'Customer Return Delivered', timestampField: 'customer_return_delivered_at' },
                                'cancelled_at': { status: 'Cancel', timestampField: 'cancelled_at' }
                            }

                            const mapping = statusMap[selectedField] || { status: 'all', timestampField: 'order_date' }
                            setStatusFilter(mapping.status)
                            setTimestampField(mapping.timestampField)
                            setPage(1)
                        }}
                        className="px-2 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50 font-medium"
                        title="Select status to filter"
                    >
                        <option value="order_date">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="packed">Packed</option>
                        <option value="ready_to_ship">Ready to Ship</option>
                        <option value="shipped_at">Shipped</option>
                        <option value="delivered_at">Delivered</option>
                        <option value="returning_to_seller">Returning to Seller</option>
                        <option value="returned_delivered">Returned Delivered</option>
                        <option value="customer_return_at">Customer Return</option>
                        <option value="customer_return_delivered_at">Customer Return Delivered</option>
                        <option value="cancelled_at">Cancelled</option>
                    </select>

                    {/* Seller Account Filter */}
                    <select
                        value={sellerAccount}
                        onChange={(e) => { setSellerAccount(e.target.value); setPage(1); }}
                        className="px-2 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                        title="Filter by seller account"
                    >
                        <option value="all">All Accounts</option>
                        {sellerAccounts?.map((account: string) => (
                            <option key={account} value={account}>
                                {account}
                            </option>
                        ))}
                    </select>

                    {/* Date Range Inputs */}
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                        onClick={(e) => e.currentTarget.showPicker()}
                        className="w-28 px-2 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50 cursor-pointer"
                        placeholder="Start"
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                        onClick={(e) => e.currentTarget.showPicker()}
                        className="w-28 px-2 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50 cursor-pointer"
                        placeholder="End"
                    />
                    {(startDate || endDate) && (
                        <button
                            onClick={handleClearDateFilter}
                            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Clear Dates"
                        >
                            <X size={11} />
                        </button>
                    )}

                    {/* Search Box */}
                    <div className="relative flex-1 min-w-[180px] max-w-sm hidden md:block">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search order#, tracking#..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-7 pr-7 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
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

                    {/* Clear All Filters Button - Now next to Search */}
                    <button
                        onClick={() => {
                            setTimestampField('order_date')
                            setDisplayStatus('order_date')
                            setStartDate('')
                            setEndDate('')
                            setStatusFilter('all')
                            setSellerAccount('all')
                            setSearchInput('')
                            setSearch('')
                            setPage(1)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors whitespace-nowrap shadow-sm"
                        title="Clear all filters"
                    >
                        <X size={14} strokeWidth={2.5} />
                        Clear All
                    </button>

                    {/* Total Count Display */}
                    {pagination && pagination.total > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 rounded border border-gray-300 dark:border-zinc-600">
                            <span className="text-gray-500 dark:text-gray-400">Total:</span>
                            <span className="text-blue-600 dark:text-blue-400">{pagination.total}</span>
                        </div>
                    )}
                </div>

                {/* Compact Bulk Actions */}
                {selectedOrders.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t dark:border-zinc-700 flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{selectedOrders.length} selected</span>
                        <button className="flex items-center gap-1 px-2 py-0.5 text-[13px] border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded dark:text-gray-50">
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

            {/* Orders Table */}
            <div className="flex-1 overflow-y-auto p-2">
                {/* Mobile Card List */}
                <div className="md:hidden space-y-4 pb-20">
                    {isLoading || isFetching ? (
                        <div className="text-center py-8 text-sm text-gray-500">Loading...</div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-12 text-sm text-gray-500">No orders found.</div>
                    ) : (
                        Object.entries(groupedOrders).map(([date, groupOrders]) => (
                            <div key={date} className="space-y-2">
                                <div className="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-900 py-1 flex justify-between items-center">
                                    <span className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{date}</span>
                                    <span className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-zinc-800 rounded-full text-gray-600 dark:text-gray-400">
                                        {groupOrders.length}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {groupOrders.map((order: any) => (
                                        <div
                                            key={order.id}
                                            className="bg-white dark:bg-zinc-800 p-3 rounded-lg border dark:border-zinc-700 shadow-sm relative active:scale-[0.99] transition-transform"
                                            onClick={() => router.push(`/dashboard/sales/daraz/order/${order.id}?from=order-list`)}
                                        >
                                            {/* Header Row */}
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-blue-600 dark:text-blue-400">#{order.order_number}</span>
                                                    <span className="text-[10px] text-gray-400">{order.invoice_number}</span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        order.order_status === 'Ready to Ship' ? 'bg-green-100 text-green-800' :
                                                            order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-800' :
                                                                order.order_status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                                                    order.order_status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                                                        'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {order.order_status}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Content Row */}
                                            <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
                                                <div className="flex flex-col min-w-0">
                                                    <span className={`text-sm font-medium truncate ${getCustomerClass(order.customer_name, order.order_date)}`}>{order.customer_name}</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{order.first_product_name}</span>
                                                    {order.item_count > 1 && <span className="text-[10px] text-blue-500">+{order.item_count - 1} more items</span>}
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100">Rs. {order.grand_total?.toLocaleString()}</span>
                                                    <span className="text-xs text-gray-500">{order.total_quantity} item(s)</span>
                                                </div>
                                            </div>

                                            {/* Footer Row */}
                                            <div className="flex justify-between items-center pt-2 border-t dark:border-zinc-700/50 mt-1">
                                                <span className="text-[10px] text-gray-400">{new Date(order.order_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <div className="flex gap-2">
                                                    {order.is_printed && <Printer size={12} className="text-green-500" />}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                    {/* Mobile Pagination */}
                    <div className="py-2">
                        {renderPagination()}
                    </div>
                </div>

                <Card className="dark:bg-zinc-900 dark:border-zinc-700 hidden md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed border-collapse">
                            <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="hidden md:table-cell px-1.5 py-1 text-left w-8">
                                        <input
                                            type="checkbox"
                                            checked={selectedOrders.length === orders.length && orders.length > 0}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="rounded text-blue-600 focus:ring-blue-500 dark:bg-zinc-700 dark:border-zinc-600 w-3.5 h-3.5"
                                        />
                                    </th>
                                    <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-10">SN</th>
                                    <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-14 md:w-22">Date</th>
                                    <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-auto md:w-28">Invoice</th>
                                    <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-auto md:w-32">Order</th>
                                    <th className="hidden md:table-cell px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-45">Customer</th>
                                    <th className="hidden md:table-cell px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-64">Product</th>
                                    <th className="hidden md:table-cell px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-20">Product ID</th>
                                    <th className="hidden md:table-cell px-1.5 py-1 text-right text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-16">Qty</th>
                                    <th className="hidden md:table-cell px-1.5 py-1 text-right text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-24">Amount</th>
                                    <th className="hidden md:table-cell px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-24">Status</th>
                                    <th className="hidden md:table-cell px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-48">Item Statuses</th>
                                    <th className="hidden md:table-cell px-1.5 py-1 text-center text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-29">Actions</th>
                                </tr>
                            </thead>
                            {isLoading || isFetching ? (
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                                    <tr>
                                        <td colSpan={12} className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">Loading...</td>
                                    </tr>
                                </tbody>
                            ) : orders.length === 0 ? (
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                                    <tr>
                                        <td colSpan={12} className="hidden"></td>
                                    </tr>
                                </tbody>
                            ) : (
                                Object.entries(groupedOrders).map(([date, groupOrders]) => (
                                    <tbody key={date} className="divide-y divide-gray-200 dark:divide-zinc-700 border-b-4 border-gray-100 dark:border-zinc-900 last:border-0 bg-white dark:bg-zinc-900">
                                        {/* Date Header Row - 2-Row Layout like Sales Entry */}
                                        <tr className="bg-gray-50 dark:bg-zinc-800/50">
                                            <td colSpan={12} className="px-2 py-1 border-y dark:border-zinc-700">
                                                <div className="flex flex-col gap-1">
                                                    {/* Row 1: Date and Total Count */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[13px] text-gray-700 dark:text-gray-300">{date}</span>
                                                        <span className="text-xs px-2 py-0.5 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-full text-gray-600 dark:text-gray-400 font-medium">
                                                            Total: {groupOrders.length}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Order Rows */}
                                        {groupOrders.map((order: any, idx) => (
                                            <tr
                                                key={order.id}
                                                className="hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <td className="hidden md:table-cell px-1.5 py-0.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedOrders.includes(order.id)}
                                                        onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                                                        className="rounded text-blue-600 focus:ring-blue-500 dark:bg-zinc-700 dark:border-zinc-600 w-3.5 h-3.5"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300 align-top md:align-middle">
                                                    {((page - 1) * 50) + idx + 1}
                                                </td>
                                                <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300 align-top md:align-middle">
                                                    <span className="md:hidden font-medium">{new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</span>
                                                    <span className="hidden md:inline">{new Date(order.order_date).toLocaleDateString('en-GB')}</span>
                                                </td>
                                                <td className="px-1.5 py-0.5 align-top md:align-middle">
                                                    <button
                                                        onClick={() => router.push(`/dashboard/sales/daraz/order/${order.id}?from=order-list`)}
                                                        onMouseEnter={() => queryClient.prefetchQuery({
                                                            queryKey: ['daraz-order', order.id],
                                                            queryFn: () => getDarazOrderById(order.id)
                                                        })}
                                                        className="text-[13px] font-mono text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
                                                    >
                                                        <span className="md:hidden">...{order.invoice_number.slice(-5)}</span>
                                                        <span className="hidden md:inline">{order.invoice_number}</span>
                                                    </button>
                                                </td>
                                                <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300 align-top md:align-middle">
                                                    <div className="flex flex-col gap-0.5">
                                                        {/* Row 1: Order Number */}
                                                        <span className="font-medium break-all">{order.order_number}</span>

                                                        {/* Row 2: Qty & Price (Mobile Only) */}
                                                        <div className="md:hidden flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                                                            <span>{order.total_quantity}</span>
                                                            <span>•</span>
                                                            <span>Rs. {order.grand_total?.toLocaleString()}</span>
                                                        </div>

                                                        {/* Row 3: Status Badge (Mobile Only) */}
                                                        <div className="md:hidden">
                                                            <AuditTrailHover order={order}>
                                                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                                    order.order_status === 'Unpaid' ? 'bg-gray-100 text-gray-700 border border-gray-300' :
                                                                        order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                                            order.order_status === 'Delivered' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                                                ['Returning to Seller', 'Customer Return'].includes(order.order_status) ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                                                                    ['Returned Delivered', 'Customer Return Delivered'].includes(order.order_status) ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                                                                                        (order.order_status === 'Cancel' || order.order_status === 'Cancelled') ? 'bg-red-50 text-red-700 border-red-200' :
                                                                                            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                                                    }`}>
                                                                    {order.order_status}
                                                                </span>
                                                            </AuditTrailHover>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={`hidden md:table-cell px-1.5 py-0.5 text-sm truncate ${getCustomerClass(order.customer_name, order.order_date)}`} title={order.customer_name}>
                                                    {order.customer_name}
                                                </td>
                                                <td className={`hidden md:table-cell px-1.5 py-0.5 text-sm truncate ${order.first_product_name === 'Product Not Found' ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`} title={order.first_product_name}>
                                                    {order.first_product_name}
                                                    {order.item_count > 1 && <span className="text-gray-500 dark:text-gray-400 text-xs"> +{order.item_count - 1} Product{order.item_count - 1 > 1 ? 's' : ''}</span>}
                                                </td>
                                                <td className="hidden md:table-cell px-1.5 py-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                    {order.first_product_code ? `#${order.first_product_code}` : '-'}
                                                </td>
                                                <td className="hidden md:table-cell px-1.5 py-0.5 text-sm text-right text-gray-700 dark:text-gray-300">{order.total_quantity}</td>
                                                <td className="hidden md:table-cell px-1.5 py-0.5 text-sm text-right font-medium text-gray-700 dark:text-gray-300">Rs. {order.grand_total?.toLocaleString()}</td>
                                                <td className="hidden md:table-cell px-1.5 py-0.5">
                                                    <AuditTrailHover order={order}>
                                                        <span className={`px-1 py-0.5 text-xs font-medium rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                            order.order_status === 'Unpaid' ? 'bg-gray-100 text-gray-700 border border-gray-300' :
                                                                order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                                    order.order_status === 'Delivered' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                                        ['Returning to Seller', 'Customer Return'].includes(order.order_status) ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                                            ['Returned Delivered', 'Customer Return Delivered'].includes(order.order_status) ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                                                                (order.order_status === 'Cancel' || order.order_status === 'Cancelled') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                                                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                                            }`}>
                                                            {order.order_status}
                                                        </span>
                                                        {(new Set(order.item_statuses || []).size > 1) && (
                                                            <span className="ml-1 inline-flex items-center justify-center p-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500" title="Partial/Mixed Status">
                                                                <Split size={12} />
                                                            </span>
                                                        )}
                                                    </AuditTrailHover>
                                                </td>
                                                <td className="hidden md:table-cell px-1.5 py-0.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(order.item_statuses || []).length > 0 ? (
                                                            <>
                                                                <span className="text-xs text-gray-500 font-mono hidden">[</span>
                                                                {(order.item_statuses || []).map((rawStatus: string, sIdx: number) => {
                                                                    let status = rawStatus;
                                                                    if (status === 'ready_to_ship') status = 'Ready to Ship';
                                                                    else if (status === 'returned_delivered') status = 'Returned Delivered'; // Keep standard
                                                                    else if (status === 'customer_return_delivered') status = 'Customer Return Delivered';
                                                                    else if (status === 'returning_to_seller') status = 'Returning to Seller';
                                                                    else if (status === 'customer_return') status = 'Customer Return';

                                                                    return (
                                                                        <span key={sIdx} className={`px-1 py-0.5 text-[10px] font-medium rounded border ${status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                            status === 'Packed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                                                status === 'Ready to Ship' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                                    status === 'Shipped' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                                        status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                                            ['Returning to Seller', 'Customer Return', 'returned', 'returning_to_seller'].includes(status) ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                                                                ['Returned Delivered', 'Customer Return Delivered', 'customer_return_delivered', 'returned_delivered'].includes(status) ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                                                                                    (status === 'Cancel' || status === 'Cancelled') ? 'bg-red-50 text-red-700 border-red-200' :
                                                                                                        'bg-gray-50 text-gray-600 border-gray-200'
                                                                            }`}>
                                                                            "{status}"
                                                                        </span>
                                                                    )
                                                                })}
                                                                <span className="text-xs text-gray-500 font-mono hidden">]</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="hidden md:table-cell px-1.5 py-0.5">
                                                    <div className="flex items-center justify-between gap-0.5">
                                                        <button
                                                            className={`p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded ${order.is_printed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}
                                                            title={order.is_printed ? "Printed" : "Print"}
                                                        >
                                                            <Printer size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => router.push(`/dashboard/sales/daraz/order/${order.id}`)}
                                                            onMouseEnter={() => queryClient.prefetchQuery({
                                                                queryKey: ['daraz-order', order.id],
                                                                queryFn: () => getDarazOrderById(order.id)
                                                            })}
                                                            className="px-1 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                        >
                                                            View
                                                        </button>

                                                        <button
                                                            onClick={() => handleDelete(order.id, order.order_number)}
                                                            className="px-1 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                            disabled={order.pending_deletion}
                                                        >
                                                            {order.pending_deletion ? (
                                                                <span className="flex items-center gap-0.5 text-yellow-600">
                                                                    <Clock size={9} />
                                                                    Pending
                                                                </span>
                                                            ) : (
                                                                'Del'
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('Sync products for this order?')) {
                                                                    const res = await syncDarazOrderProducts(order.id)
                                                                    if (res.success) toast.success(res.message)
                                                                    else toast.error(res.message)
                                                                }
                                                            }}
                                                            className="px-1 py-0.5 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                            title="Sync products from inventory"
                                                        >
                                                            <RefreshCw size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                ))
                            )}
                        </table>

                        {orders.length === 0 && !isLoading && !isFetching && (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                No orders found.
                            </div>
                        )}
                    </div>

                    {renderPagination()}
                </Card>
            </div>

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
                isOpen={partialReturnModal.isOpen}
                order={partialReturnModal.order}
                onClose={() => {
                    setPartialReturnModal({ isOpen: false, order: null })
                    // Invalidate query to refresh list data (item statuses)
                    queryClient.invalidateQueries({ queryKey: ['all-daraz-orders'] })
                }}
            />

            {/* Barcode Scanner Modal (Mobile Only) */}
            <BarcodeScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleBarcodeScan}
            />
        </div>
    )
}
