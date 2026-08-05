'use client'

import { useState, useEffect, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDailySalesReport, getOrderSummaryReport, getOrderStatusSummary } from '@/features/sales/actions/daraz-actions'
import { getUserRole } from '@/features/sales/actions/daraz-deletion-actions'
import { ArrowLeft, BarChart2, AlertCircle, PieChart, RefreshCw, Download, List, FileText, Menu, Package } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { useSearchParams } from 'next/navigation'
import { useDashboard } from '@/app/dashboard/context'

import { OrderStatusSyncTable } from '@/features/sales/components/OrderStatusSyncTable'
import { OrderSyncPageContent } from '../order-sync/page'
import ProfitTrackerPage from '../profit-tracker/page'
import { DarazOrderList } from '@/features/sales/components/DarazOrderList'
import { DarazSalesReport } from '@/features/sales/components/DarazSalesReport'
import { DarazProductReport } from '@/features/sales/components/DarazProductReport'
import { usePermissions } from '@/lib/permissions/PermissionContext'
import { Forbidden403 } from '@/components/permissions/Forbidden403'

import { Suspense } from 'react'

type ReportTab = 'daily' | 'summary' | 'status-sync' | 'order-sync' | 'profit-tracker' | 'order-list' | 'sales-report' | 'product-report'

function DashboardContent() {
    const { hasPermission } = usePermissions()
    const [activeTab, setActiveTab] = useState<ReportTab>('order-list')
    
    // Auto-select first available tab if current is not permitted
    useEffect(() => {
        const availableTabs = [
            { id: 'order-list', has: hasPermission('Daraz', 'Order List') },
            { id: 'daily', has: hasPermission('Daraz', 'Daily Sales Report') },
            { id: 'summary', has: hasPermission('Daraz', 'Account Summary') },
            { id: 'status-sync', has: hasPermission('Daraz', 'Order Status Sync') },
            { id: 'order-sync', has: hasPermission('Daraz', 'Order Sync') },
            { id: 'profit-tracker', has: hasPermission('Daraz', 'Profit Tracker') },
            { id: 'sales-report', has: hasPermission('Daraz', 'Sales Report') },
            { id: 'product-report', has: hasPermission('Daraz', 'Sales Report') },
        ].filter(t => t.has)

        if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
            setActiveTab(availableTabs[0].id as ReportTab)
        }
    }, [hasPermission, activeTab])

    const searchParams = useSearchParams()
    const fromPage = searchParams.get('from')

    const backLink = fromPage === 'sales-entry'
        ? { href: '/dashboard/sales/daraz/sales-entry', label: 'Back to Sales Entry' }
        : { href: '/dashboard/sales/daraz', label: 'Back to Dashboard' }

    const { isMobileMenuOpen, setIsMobileMenuOpen, setHeaderTitle } = useDashboard()

    // Update Global Header based on active Tab
    useEffect(() => {
        if (!setHeaderTitle) return

        const titles: Record<string, string> = {
            'order-list': 'Order List',
            'daily': 'Daily Sales Report',
            'summary': 'Account Summary',
            'status-sync': 'Order Status Sync',
            'order-sync': 'Order Sync',
            'profit-tracker': 'Profit Tracker',
            'sales-report': 'Sales Report Details',
            'product-report': 'Product Report Details',
        }

        setHeaderTitle(titles[activeTab] || 'Sales Dashboard')

        return () => setHeaderTitle(null)
    }, [activeTab, setHeaderTitle])

    // Fetch daily sales report
    const { data: dailyReport, isLoading } = useQuery({
        queryKey: ['daily-sales-report'],
        queryFn: getDailySalesReport,
        enabled: activeTab === 'daily',
        staleTime: 60 * 1000
    })

    // Fetch order summary report
    const { data: summaryReport, isLoading: isSummaryLoading } = useQuery({
        queryKey: ['order-summary-report'],
        queryFn: getOrderSummaryReport,
        enabled: activeTab === 'summary',
        staleTime: 60 * 1000
    })

    // Fetch order status summary
    const { data: statusSummary, isLoading: isStatusSummaryLoading } = useQuery({
        queryKey: ['order-status-summary'],
        queryFn: getOrderStatusSummary,
        enabled: activeTab === 'status-sync',
        staleTime: 0 // Always fetch fresh data to avoid inconsistency
    })

    // Format currency
    const formatAmount = (amount: number) => {
        return `Rs. ${amount.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    // Calculate totals for Daily Sales Report
    const dailyTotals = dailyReport?.reduce((acc, row) => ({
        shipped_qty: acc.shipped_qty + row.shipped_qty,
        shipped_amount: acc.shipped_amount + row.shipped_amount,
        returning_to_seller_qty: acc.returning_to_seller_qty + row.returning_to_seller_qty,
        returned_delivered_qty: acc.returned_delivered_qty + row.returned_delivered_qty,
        delivered_qty: acc.delivered_qty + row.delivered_qty,
        return_qty: acc.return_qty + row.return_qty,
        customer_return_delivered_qty: acc.customer_return_delivered_qty + row.customer_return_delivered_qty
    }), {
        shipped_qty: 0,
        shipped_amount: 0,
        returning_to_seller_qty: 0,
        returned_delivered_qty: 0,
        delivered_qty: 0,
        return_qty: 0,
        customer_return_delivered_qty: 0
    })

    // Calculate totals for Order Summary Report
    const summaryTotals = summaryReport?.reduce((acc, row) => ({
        shipped_qty: acc.shipped_qty + row.shipped_qty,
        shipped_amount: acc.shipped_amount + row.shipped_amount,
        returning_to_seller_qty: acc.returning_to_seller_qty + row.returning_to_seller_qty,
        returned_delivered_qty: acc.returned_delivered_qty + row.returned_delivered_qty,
        delivered_qty: acc.delivered_qty + row.delivered_qty,
        return_qty: acc.return_qty + row.return_qty,
        customer_return_delivered_qty: acc.customer_return_delivered_qty + row.customer_return_delivered_qty,
        remain_qty: acc.remain_qty + row.remain_qty
    }), {
        shipped_qty: 0,
        shipped_amount: 0,
        returning_to_seller_qty: 0,
        returned_delivered_qty: 0,
        delivered_qty: 0,
        return_qty: 0,
        customer_return_delivered_qty: 0,
        remain_qty: 0
    })

    // Check if user has any tabs available
    const hasAnyTab = [
        hasPermission('Daraz', 'Order List'),
        hasPermission('Daraz', 'Daily Sales Report'),
        hasPermission('Daraz', 'Account Summary'),
        hasPermission('Daraz', 'Order Status Sync'),
        hasPermission('Daraz', 'Order Sync'),
        hasPermission('Daraz', 'Profit Tracker'),
        hasPermission('Daraz', 'Sales Report')
    ].some(Boolean)

    if (!hasAnyTab) {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
                <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold">Sales Dashboard</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">Access Denied</p>
                    </div>
                    <Link
                        href={backLink.href}
                        className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        {backLink.label}
                    </Link>
                </div>
                <div className="flex-1">
                    <Forbidden403 />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">

            {/* Compact Header - Hidden on mobile, visible on desktop */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Sales Dashboard</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Performance Reports</p>
                </div>
                <div className="flex gap-2">

                    <Link
                        href={backLink.href}
                        className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        {backLink.label}
                    </Link>
                </div>
            </div>


            {/* Tab Bar - Hidden on mobile, visible on desktop */}
            <div className="hidden md:block sticky top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm overflow-x-auto">
                <div className="flex items-center gap-1.5 min-w-max">
                    {hasPermission('Daraz', 'Order List') && (
                        <button
                            onClick={() => setActiveTab('order-list')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'order-list'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <List size={12} />
                            Order List
                        </button>
                    )}
                    {hasPermission('Daraz', 'Daily Sales Report') && (
                        <button
                            onClick={() => setActiveTab('daily')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'daily'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <BarChart2 size={12} />
                            Daily Sales Report
                        </button>
                    )}
                    {hasPermission('Daraz', 'Account Summary') && (
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'summary'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <PieChart size={12} />
                            Account Summary
                        </button>
                    )}
                    {hasPermission('Daraz', 'Order Status Sync') && (
                        <button
                            onClick={() => setActiveTab('status-sync')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'status-sync'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <RefreshCw size={12} />
                            Order Status Sync
                        </button>
                    )}
                    {hasPermission('Daraz', 'Order Sync') && (
                        <button
                            onClick={() => setActiveTab('order-sync')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'order-sync'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <Download size={12} />
                            Order Sync
                        </button>
                    )}
                    {hasPermission('Daraz', 'Profit Tracker') && (
                        <button
                            onClick={() => setActiveTab('profit-tracker')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'profit-tracker'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <BarChart2 size={12} />
                            Profit Tracker
                        </button>
                    )}
                    {hasPermission('Daraz', 'Sales Report') && (
                        <>
                            <button
                                onClick={() => setActiveTab('sales-report')}
                                className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'sales-report'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                    }`}
                            >
                                <FileText size={12} />
                                Sales Report Details
                            </button>
                            <button
                                onClick={() => setActiveTab('product-report')}
                                className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'product-report'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                    }`}
                            >
                                <Package size={12} />
                                Product Report Details
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={`flex-1 ${(activeTab === 'sales-report' || activeTab === 'product-report' || activeTab === 'order-list') ? 'overflow-hidden p-0' : 'overflow-auto p-3 pb-20 md:pb-3'}`}>
                {activeTab === 'sales-report' && (
                    <DarazSalesReport isEmbedded={true} />
                )}
                {activeTab === 'product-report' && (
                    <DarazProductReport isEmbedded={true} />
                )}
                {activeTab === 'daily' && (
                    <Card className="overflow-hidden hidden md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-10">S.N</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Date</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Seller Account</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Shipped Qty</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Shipped Amount</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Returning to Seller</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Returned Delivered</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Delivered Qty</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Customer Return</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Customer Return Delivered</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                                Loading report data...
                                            </td>
                                        </tr>
                                    ) : dailyReport && dailyReport.length > 0 ? (
                                        (() => {
                                            // Group by date
                                            const groupedReport = dailyReport?.reduce((acc, row) => {
                                                if (!acc[row.date]) acc[row.date] = []
                                                acc[row.date].push(row)
                                                return acc
                                            }, {} as Record<string, typeof dailyReport>)

                                            return Object.entries(groupedReport || {}).map(([date, rows]) => {
                                                // Calculate date totals
                                                const dateTotals = rows.reduce((acc, row) => ({
                                                    shipped_qty: acc.shipped_qty + row.shipped_qty,
                                                    shipped_amount: acc.shipped_amount + row.shipped_amount,
                                                    returning_to_seller_qty: acc.returning_to_seller_qty + row.returning_to_seller_qty,
                                                    returned_delivered_qty: acc.returned_delivered_qty + row.returned_delivered_qty,
                                                    delivered_qty: acc.delivered_qty + row.delivered_qty,
                                                    return_qty: acc.return_qty + row.return_qty,
                                                    customer_return_delivered_qty: acc.customer_return_delivered_qty + row.customer_return_delivered_qty
                                                }), {
                                                    shipped_qty: 0,
                                                    shipped_amount: 0,
                                                    returning_to_seller_qty: 0,
                                                    returned_delivered_qty: 0,
                                                    delivered_qty: 0,
                                                    return_qty: 0,
                                                    customer_return_delivered_qty: 0
                                                })

                                                return (
                                                    <Fragment key={date}>
                                                        {rows.map((row, index) => (
                                                            <tr key={`${row.date}-${row.seller_account}`} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                                <td className="px-2 py-1.5 text-[13px] text-gray-500">{index + 1}</td>
                                                                <td className="px-2 py-1.5 text-[13px] font-medium">{formatDate(row.date)}</td>
                                                                <td className="px-2 py-1.5 text-[13px]">{row.seller_account}</td>
                                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                                    <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                                                                        {row.shipped_qty}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-1.5 text-[13px] text-right font-mono text-blue-600 dark:text-blue-400">
                                                                    {formatAmount(row.shipped_amount)}
                                                                </td>
                                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.returning_to_seller_qty > 0
                                                                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                                                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                        }`}>
                                                                        {row.returning_to_seller_qty}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.returned_delivered_qty > 0
                                                                        ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                                                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                        }`}>
                                                                        {row.returned_delivered_qty}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                                    <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                                                                        {row.delivered_qty}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.return_qty > 0
                                                                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                                                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                        }`}>
                                                                        {row.return_qty}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.customer_return_delivered_qty > 0
                                                                        ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                                                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                        }`}>
                                                                        {row.customer_return_delivered_qty}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {/* Sub-total Row */}
                                                        <tr className="bg-gray-200 dark:bg-zinc-700 font-bold border-b-2 border-gray-300 dark:border-zinc-600">
                                                            <td colSpan={2}></td>
                                                            <td className="px-2 py-2 text-[13px] text-gray-800 dark:text-gray-200 uppercase tracking-wide">Total</td>
                                                            <td className="px-2 py-2 text-[13px] text-center text-blue-800 dark:text-blue-300">
                                                                {dateTotals.shipped_qty}
                                                            </td>
                                                            <td className="px-2 py-2 text-[13px] text-right text-blue-800 dark:text-blue-300 font-mono">
                                                                {formatAmount(dateTotals.shipped_amount)}
                                                            </td>
                                                            <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                                {dateTotals.returning_to_seller_qty}
                                                            </td>
                                                            <td className="px-2 py-2 text-[13px] text-center text-orange-900 dark:text-orange-200">
                                                                {dateTotals.returned_delivered_qty}
                                                            </td>
                                                            <td className="px-2 py-2 text-[13px] text-center text-green-800 dark:text-green-300">
                                                                {dateTotals.delivered_qty}
                                                            </td>
                                                            <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                                {dateTotals.return_qty}
                                                            </td>
                                                            <td className="px-2 py-2 text-[13px] text-center text-orange-900 dark:text-orange-200">
                                                                {dateTotals.customer_return_delivered_qty}
                                                            </td>
                                                        </tr>
                                                    </Fragment>
                                                )
                                            })
                                        })()
                                    ) : (
                                        <tr>
                                            <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                                No report data available. Orders with Shipped, Delivered, Failed Delivery, or Customer Return status will appear here.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {dailyReport && dailyReport.length > 0 && dailyTotals && (
                                    <tfoot className="bg-gray-50 dark:bg-zinc-800 border-t dark:border-zinc-800 font-bold">
                                        <tr>
                                            <td colSpan={3} className="px-2 py-2 text-center text-xs uppercase text-gray-600 dark:text-gray-400">Total</td>
                                            <td className="px-2 py-2 text-[13px] text-center text-blue-700 dark:text-blue-400">
                                                {dailyTotals.shipped_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-right text-blue-700 dark:text-blue-400 font-mono">
                                                {formatAmount(dailyTotals.shipped_amount)}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-orange-700 dark:text-orange-400">
                                                {dailyTotals.returning_to_seller_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                {dailyTotals.returned_delivered_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-green-700 dark:text-green-400">
                                                {dailyTotals.delivered_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-orange-700 dark:text-orange-400">
                                                {dailyTotals.return_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                {dailyTotals.customer_return_delivered_qty}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </Card>
                )}
                {activeTab === 'daily' && (
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            <div className="text-center py-8 text-gray-500">Loading details...</div>
                        ) : dailyReport && dailyReport.length > 0 ? (
                            (() => {
                                const groupedReport = dailyReport?.reduce((acc, row) => {
                                    if (!acc[row.date]) acc[row.date] = []
                                    acc[row.date].push(row)
                                    return acc
                                }, {} as Record<string, typeof dailyReport>)

                                return Object.entries(groupedReport || {}).map(([date, rows]) => (
                                    <div key={date} className="space-y-3">
                                        <div className="sticky top-0 z-10 bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700 shadow-sm">
                                            {formatDate(date)}
                                        </div>
                                        {rows.map((row) => (
                                            <Card key={`${row.date}-${row.seller_account}`} className="p-3 space-y-3 mx-2">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-gray-900 dark:text-white">{row.seller_account}</span>
                                                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                                        {formatAmount(row.shipped_amount)}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-xs">
                                                    <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                        <div className="text-gray-500 mb-0.5">Shipped</div>
                                                        <div className="font-bold text-blue-700 dark:text-blue-400">{row.shipped_qty}</div>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                        <div className="text-gray-500 mb-0.5">Delivered</div>
                                                        <div className="font-bold text-green-700 dark:text-green-400">{row.delivered_qty}</div>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                        <div className="text-gray-500 mb-0.5">RTS</div>
                                                        <div className="font-bold text-orange-700 dark:text-orange-400">{row.returning_to_seller_qty}</div>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                        <div className="text-gray-500 mb-0.5">Ret. Del</div>
                                                        <div className="font-bold text-orange-800 dark:text-orange-300">{row.returned_delivered_qty}</div>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                        <div className="text-gray-500 mb-0.5">C. Return</div>
                                                        <div className="font-bold text-red-700 dark:text-red-400">{row.return_qty}</div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                ))
                            })()
                        ) : (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                No report data available.
                            </div>
                        )}
                    </div>
                )}

                {
                    activeTab === 'summary' && (
                        <>
                            <Card className="overflow-hidden hidden md:block">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-zinc-800">
                                            <tr>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-10">S.N</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Seller Account</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Shipped Qty</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Shipped Amount</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Returning to Seller</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Returned Delivered</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Delivered Qty</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Customer Return</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Customer Return Delivered</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Remain Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {isSummaryLoading ? (
                                                <tr>
                                                    <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                                        Loading summary data...
                                                    </td>
                                                </tr>
                                            ) : summaryReport && summaryReport.length > 0 ? (
                                                summaryReport.map((row, index) => (
                                                    <tr key={row.seller_account} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-2 py-1.5 text-[13px] text-gray-500">{index + 1}</td>
                                                        <td className="px-2 py-1.5 text-[13px] font-medium">{row.seller_account}</td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                                                                {row.shipped_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-right font-mono text-blue-600 dark:text-blue-400">
                                                            {formatAmount(row.shipped_amount)}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.returning_to_seller_qty > 0
                                                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.returning_to_seller_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.returned_delivered_qty > 0
                                                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.returned_delivered_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                                                                {row.delivered_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.return_qty > 0
                                                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.return_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.customer_return_delivered_qty > 0
                                                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.customer_return_delivered_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.remain_qty > 0
                                                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.remain_qty}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                                        No summary data available.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {summaryReport && summaryReport.length > 0 && summaryTotals && (
                                            <tfoot className="bg-gray-50 dark:bg-zinc-800 border-t dark:border-zinc-800 font-bold">
                                                <tr>
                                                    <td colSpan={2} className="px-2 py-2 text-center text-xs uppercase text-gray-600 dark:text-gray-400">Total</td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-blue-700 dark:text-blue-400">
                                                        {summaryTotals.shipped_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-right text-blue-700 dark:text-blue-400 font-mono">
                                                        {formatAmount(summaryTotals.shipped_amount)}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-orange-700 dark:text-orange-400">
                                                        {summaryTotals.returning_to_seller_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                        {summaryTotals.returned_delivered_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-green-700 dark:text-green-400">
                                                        {summaryTotals.delivered_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-orange-700 dark:text-orange-400">
                                                        {summaryTotals.return_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                        {summaryTotals.customer_return_delivered_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-yellow-700 dark:text-yellow-400">
                                                        {summaryTotals.remain_qty}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </Card>

                            {/* Mobile Card View for Account Summary */}
                            <div className="md:hidden space-y-3">
                                {isSummaryLoading ? (
                                    <div className="text-center py-8 text-gray-500">Loading summary...</div>
                                ) : summaryReport && summaryReport.length > 0 ? (
                                    summaryReport.map((row) => (
                                        <Card key={row.seller_account} className="p-3 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-gray-900 dark:text-white">{row.seller_account}</span>
                                                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                                    {formatAmount(row.shipped_amount)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">Shipped</div>
                                                    <div className="font-bold text-blue-700 dark:text-blue-400">{row.shipped_qty}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">Delivered</div>
                                                    <div className="font-bold text-green-700 dark:text-green-400">{row.delivered_qty}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">RTS</div>
                                                    <div className="font-bold text-orange-700 dark:text-orange-400">{row.returning_to_seller_qty}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">Ret. Del</div>
                                                    <div className="font-bold text-orange-800 dark:text-orange-300">{row.returned_delivered_qty}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">C. Return</div>
                                                    <div className="font-bold text-red-700 dark:text-red-400">{row.return_qty}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center border border-yellow-200 dark:border-yellow-900/30 bg-yellow-50 dark:bg-yellow-900/10">
                                                    <div className="text-gray-500 mb-0.5">Remain</div>
                                                    <div className="font-bold text-yellow-700 dark:text-yellow-400">{row.remain_qty}</div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-gray-500">No summary data available.</div>
                                )}
                            </div>

                            {/* Double line separator */}
                            <div className="border-t-4 border-double border-gray-300 dark:border-zinc-700 my-6"></div>

                            <h2 className="text-lg font-bold mb-3">Order Status Sync Data</h2>
                            <Card className="overflow-hidden hidden md:block">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-zinc-800 dark:text-gray-400">
                                            <tr>
                                                <th className="px-2 py-3">S.N</th>
                                                <th className="px-2 py-3">Seller Account</th>
                                                <th className="px-2 py-3 text-center">Pending</th>
                                                <th className="px-2 py-3 text-center">Packed</th>
                                                <th className="px-2 py-3 text-center">Ready to Ship</th>
                                                <th className="px-2 py-3 text-center">Shipped</th>
                                                <th className="px-2 py-3 text-center">Delivered</th>
                                                <th className="px-2 py-3 text-center">Returning to Seller</th>
                                                <th className="px-2 py-3 text-center">Returned Delivered</th>
                                                <th className="px-2 py-3 text-center">Customer Return</th>
                                                <th className="px-2 py-3 text-center">Customer Return Delivered</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {isStatusSummaryLoading ? (
                                                <tr>
                                                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
                                                        Loading status data...
                                                    </td>
                                                </tr>
                                            ) : !statusSummary || statusSummary.length === 0 ? (
                                                <tr>
                                                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
                                                        No status data available.
                                                    </td>
                                                </tr>
                                            ) : (
                                                statusSummary.map((row: any, idx: number) => (
                                                    <tr key={idx} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-2 py-3 text-[13px]">{idx + 1}</td>
                                                        <td className="px-2 py-3 font-medium text-gray-900 dark:text-white">{row.seller_account}</td>
                                                        <td className="px-2 py-3 text-center text-yellow-700 dark:text-yellow-400">{row.pending}</td>
                                                        <td className="px-2 py-3 text-center text-blue-700 dark:text-blue-400">{row.packed}</td>
                                                        <td className="px-2 py-3 text-center text-green-700 dark:text-green-400">{row.ready_to_ship}</td>
                                                        <td className="px-2 py-3 text-center text-indigo-700 dark:text-indigo-400">{row.shipped}</td>
                                                        <td className="px-2 py-3 text-center text-green-800 dark:text-green-300 font-medium">{row.delivered}</td>
                                                        <td className="px-2 py-3 text-center text-orange-700 dark:text-orange-400">{row.returning_to_seller}</td>
                                                        <td className="px-2 py-3 text-center text-orange-800 dark:text-orange-300">{row.returned_delivered}</td>
                                                        <td className="px-2 py-3 text-center text-red-700 dark:text-red-400">{row.customer_return}</td>
                                                        <td className="px-2 py-3 text-center text-red-800 dark:text-red-300">{row.customer_return_delivered}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            {/* Mobile Card View for Order Status Sync */}
                            <div className="md:hidden space-y-3">
                                {isStatusSummaryLoading ? (
                                    <div className="text-center py-8 text-gray-500">Loading details...</div>
                                ) : statusSummary && statusSummary.length > 0 ? (
                                    statusSummary.map((row: any) => (
                                        <Card key={row.seller_account} className="p-3 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-gray-900 dark:text-white">{row.seller_account}</span>
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${row.pending > 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800'}`}>
                                                    Pending: {row.pending}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">RTS</div>
                                                    <div className="font-bold text-green-700 dark:text-green-400">{row.ready_to_ship}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">Shipped</div>
                                                    <div className="font-bold text-indigo-700 dark:text-indigo-400">{row.shipped}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">Delivered</div>
                                                    <div className="font-bold text-green-800 dark:text-green-300">{row.delivered}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">Ret. Sell</div>
                                                    <div className="font-bold text-orange-700 dark:text-orange-400">{row.returning_to_seller}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">Ret. Del</div>
                                                    <div className="font-bold text-orange-800 dark:text-orange-300">{row.returned_delivered}</div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center">
                                                    <div className="text-gray-500 mb-0.5">C. Return</div>
                                                    <div className="font-bold text-red-700 dark:text-red-400">{row.customer_return}</div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                        No status data available.
                                    </div>
                                )}
                            </div>


                        </>
                    )
                }

                {
                    activeTab === 'status-sync' && (
                        <OrderStatusSyncTable />
                    )
                }

                {activeTab === 'order-sync' && (
                    <OrderSyncPageContent isEmbedded={true} />
                )}

                {activeTab === 'profit-tracker' && (
                    <ProfitTrackerPage isEmbedded={true} />
                )}

                {activeTab === 'order-list' && (
                    <DarazOrderList isEmbedded={true} />
                )}

            </div >

            {/* Mobile Footer Navigation - Only visible on mobile */}
            < div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-zinc-800 border-t dark:border-zinc-700 shadow-lg" >
                <div className="grid grid-cols-3 gap-1 p-2">
                    <button
                        onClick={() => setActiveTab('order-list')}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors ${activeTab === 'order-list'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        <List size={18} />
                        <span className="text-[10px] font-medium text-center leading-tight">Order List</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors ${activeTab === 'daily'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        <BarChart2 size={18} />
                        <span className="text-[10px] font-medium text-center leading-tight">Daily Sales</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors ${activeTab === 'summary'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        <PieChart size={18} />
                        <span className="text-[10px] font-medium text-center leading-tight">Account Summary</span>
                    </button>

                </div>
            </div >
        </div >
    )
}

export default function DarazSalesDashboardPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    )
}
