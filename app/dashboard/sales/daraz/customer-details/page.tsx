'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDarazCustomerDetails } from '@/features/sales/actions/daraz-actions'
import { getOnlineStores } from '@/features/settings/actions/settingsActions'
import { Search, Download, ArrowLeft, RefreshCw, X, User } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

export default function DarazCustomerDetailsPage() {
    const [searchInput, setSearchInput] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [sellerAccountFilter, setSellerAccountFilter] = useState('all')
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(50)
    const [isExporting, setIsExporting] = useState(false)

    const queryClient = useQueryClient()

    // Fetch unique seller accounts from online stores
    const { data: onlineStoresResult } = useQuery({
        queryKey: ['online-stores'],
        queryFn: getOnlineStores
    })
    const onlineStores = onlineStoresResult?.data || []

    // Fetch customer details with React Query
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['daraz-customer-details', page, limit, searchQuery, statusFilter, sellerAccountFilter],
        queryFn: () => getDarazCustomerDetails({
            page,
            limit,
            search: searchQuery,
            status: statusFilter,
            sellerAccount: sellerAccountFilter
        }),
        placeholderData: (previousData) => previousData,
        staleTime: 30 * 1000
    })

    const customers = data?.customers || []
    const pagination = data?.pagination

    const handleSearch = () => {
        setSearchQuery(searchInput)
        setPage(1)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearchQuery('')
        setPage(1)
    }

    // Export to Excel handler
    const handleExportExcel = async () => {
        setIsExporting(true)
        try {
            // Fetch all matching records without pagination limit
            const allData = await getDarazCustomerDetails({
                search: searchQuery,
                status: statusFilter,
                sellerAccount: sellerAccountFilter,
                all: true
            })

            const exportList = allData.customers || []

            if (exportList.length === 0) {
                toast.warning('No customer records to export')
                return
            }

            // Map data for Excel conversion
            const rows = exportList.map((c: any, index: number) => {
                const email = c.items_detail && Array.isArray(c.items_detail)
                    ? (c.items_detail.find((item: any) => item.digital_delivery_info && item.digital_delivery_info.trim())?.digital_delivery_info || '-')
                    : '-'
                return {
                    'S.N.': index + 1,
                    'Customer Name': c.customer_name || 'N/A',
                    'Phone Number': c.shipping_phone || 'N/A',
                    'Email Address': email || 'N/A',
                    'Order ID / Number': c.order_number || c.order_id || 'N/A',
                    'Seller Account': c.seller_account || 'N/A',
                    'Order Status': c.order_status || 'N/A',
                    'Order Date': c.order_date ? new Date(c.order_date).toLocaleDateString('en-GB') : 'N/A'
                }
            })

            const ws = XLSX.utils.json_to_sheet(rows)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Daraz Customer Details")

            // Adjust columns widths automatically
            const colWidths = [
                { wch: 6 },  // S.N.
                { wch: 25 }, // Customer Name
                { wch: 18 }, // Phone Number
                { wch: 30 }, // Email Address
                { wch: 20 }, // Order ID / Number
                { wch: 20 }, // Seller Account
                { wch: 15 }, // Order Status
                { wch: 15 }  // Order Date
            ]
            ws['!cols'] = colWidths

            XLSX.writeFile(wb, `Daraz_Customer_Details_${new Date().toISOString().split('T')[0]}.xlsx`)
            toast.success(`Successfully exported ${exportList.length} customer records to Excel!`)
        } catch (error: any) {
            console.error('Export failed:', error)
            toast.error(error.message || 'Failed to export customer details to Excel')
        } finally {
            setIsExporting(false)
        }
    }

    // Render pagination controls
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
            <div className="flex items-center justify-between px-4 py-3 border-t dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-b-lg">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] text-gray-600 dark:text-gray-400">Show:</span>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value))
                                setPage(1)
                            }}
                            className="bg-zinc-50 border border-gray-300 text-gray-900 text-[13px] rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        >
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="200">200</option>
                        </select>
                    </div>
                    <div className="text-[14px] text-gray-600 dark:text-gray-400">
                        Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} entries
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
                                className={`px-3 py-1 text-sm rounded ${p === currentPage
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300'
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

    const getStatusColor = (status: string) => {
        const s = (status || '').toLowerCase()
        if (s === 'pending') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
        if (s === 'ready to ship' || s === 'ready_to_ship') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
        if (s === 'packed') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200'
        if (s === 'shipped') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
        if (s === 'delivered') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
        if (s === 'cancel' || s === 'cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
        if (s.includes('return')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
        if (s.includes('fail') || s === 'failed delivered') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }

    return (
        <PermissionGuard mainRole="Daraz" subRole="Order List">
            <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
                {/* Header */}
                <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link
                                href="/dashboard/sales/daraz"
                                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                <ArrowLeft size={18} />
                            </Link>
                            <div>
                                <h1 className="text-lg font-bold flex items-center gap-2">
                                    <User size={20} className="text-teal-600" />
                                    Daraz Customer Details
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400">View and export customer contact details for message marketing</p>
                            </div>
                        </div>

                        <button
                            onClick={handleExportExcel}
                            disabled={isExporting || customers.length === 0}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {isExporting ? (
                                <RefreshCw className="animate-spin" size={16} />
                            ) : (
                                <Download size={16} />
                            )}
                            Export Excel
                        </button>
                    </div>
                </div>

                {/* Filters Action Bar */}
                <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 p-3 shadow-xs">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[240px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search Name, Phone, or Order #..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-9 pr-8 py-1.5 border dark:border-zinc-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:bg-zinc-850 text-sm dark:text-gray-100"
                            />
                            {searchInput && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Search Action Button */}
                        <button
                            onClick={handleSearch}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs"
                        >
                            Search
                        </button>

                        {/* Seller Account Filter */}
                        <select
                            value={sellerAccountFilter}
                            onChange={(e) => { setSellerAccountFilter(e.target.value); setPage(1); }}
                            className="px-3 py-1.5 text-sm border dark:border-zinc-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-200"
                        >
                            <option value="all">All Seller Accounts</option>
                            {onlineStores.map((store: any) => (
                                <option key={store.id} value={store.seller_account}>
                                    {store.seller_account}
                                </option>
                            ))}
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="px-3 py-1.5 text-sm border dark:border-zinc-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-200"
                        >
                            <option value="all">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Packed">Packed</option>
                            <option value="Ready to Ship">Ready to Ship</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Returning to Seller">Returning to Seller</option>
                            <option value="Returned Delivered">Returned Delivered</option>
                            <option value="Customer Return">Customer Return</option>
                            <option value="Customer Return Delivered">Customer Return Delivered</option>
                            <option value="Cancel">Cancelled</option>
                        </select>

                        {/* Clear All Filters */}
                        {(sellerAccountFilter !== 'all' || statusFilter !== 'all' || searchQuery !== '') && (
                            <button
                                onClick={() => {
                                    setSearchInput('')
                                    setSearchQuery('')
                                    setStatusFilter('all')
                                    setSellerAccountFilter('all')
                                    setPage(1)
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900 transition-colors"
                            >
                                <X size={14} />
                                Reset Filters
                            </button>
                        )}

                        <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            {isFetching && <RefreshCw className="animate-spin text-blue-600" size={14} />}
                            Total Records: {pagination?.total || 0}
                        </div>
                    </div>
                </div>

                {/* Customers Table Area */}
                <div className="flex-1 p-4 overflow-y-auto">
                    <Card className="dark:bg-zinc-900 dark:border-zinc-800 shadow-md">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 dark:bg-zinc-800 border-b dark:border-zinc-700 text-xs uppercase font-bold text-gray-700 dark:text-gray-300">
                                    <tr>
                                        <th className="px-4 py-3 w-16">SN</th>
                                        <th className="px-4 py-3">Customer Name</th>
                                        <th className="px-4 py-3">Phone Number</th>
                                        <th className="px-4 py-3">Email Address</th>
                                        <th className="px-4 py-3">Order Number</th>
                                        <th className="px-4 py-3">Seller Account</th>
                                        <th className="px-4 py-3">Order Status</th>
                                        <th className="px-4 py-3">Order Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                                <RefreshCw className="animate-spin inline-block mr-2" size={16} />
                                                Loading customer details...
                                            </td>
                                        </tr>
                                    ) : customers.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                                No customer details found matching current filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        customers.map((c: any, index: number) => {
                                            const email = c.items_detail && Array.isArray(c.items_detail)
                                                ? (c.items_detail.find((item: any) => item.digital_delivery_info && item.digital_delivery_info.trim())?.digital_delivery_info || '-')
                                                : '-'
                                            return (
                                                <tr
                                                    key={c.id}
                                                    className="hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors"
                                                >
                                                    <td className="px-4 py-3.5 font-medium text-gray-500">
                                                        {((page - 1) * limit) + index + 1}
                                                    </td>
                                                    <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-white">
                                                        {c.customer_name}
                                                    </td>
                                                    <td className="px-4 py-3.5 font-mono text-blue-600 dark:text-blue-400 font-medium select-all" title="Double click to select phone number">
                                                        {c.shipping_phone}
                                                    </td>
                                                    <td className="px-4 py-3.5 font-mono text-gray-600 dark:text-gray-400 font-medium select-all" title="Double click to select email address">
                                                        {email}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <Link
                                                            href={`/dashboard/sales/daraz/order/${c.id}?from=customer-details`}
                                                            className="font-mono text-blue-600 hover:text-blue-800 dark:text-blue-450 dark:hover:text-blue-300 hover:underline"
                                                        >
                                                            {c.order_number || c.order_id}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                                                        {c.seller_account}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(c.order_status)}`}>
                                                            {c.order_status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400">
                                                        {c.order_date ? new Date(c.order_date).toLocaleDateString('en-GB') : '-'}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {renderPagination()}
                    </Card>
                </div>
            </div>
        </PermissionGuard>
    )
}
