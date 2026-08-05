'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProductReportData } from '@/features/sales/actions/daraz-actions'
import { getSellerAccounts } from '@/features/sales/actions/report-actions'
import type { ProductReportRow } from '@/features/sales/actions/daraz-actions'
import {
    Package,
    Store,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Calendar,
    Filter,
    AlertTriangle,
    Truck,
    Info,
} from 'lucide-react'
import { Card } from '@/components/ui-shim'

interface DarazProductReportProps {
    isEmbedded?: boolean
}

type DateRangeOption = '7' | '14' | '30' | 'custom'

function formatCurrency(amount: number) {
    return `Rs. ${amount.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatCurrencyShort(amount: number) {
    return `Rs. ${amount.toLocaleString('en-NP', { maximumFractionDigits: 0 })}`
}

function profitColor(profit: number) {
    if (profit > 0) return 'text-green-600 dark:text-green-400'
    if (profit < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-500'
}

export function DarazProductReport({ isEmbedded = false }: DarazProductReportProps) {
    const [sellerAccount, setSellerAccount] = useState<string>('All')
    const [sellerAccounts, setSellerAccounts] = useState<string[]>([])
    const [dateRange, setDateRange] = useState<DateRangeOption>('30')
    const [fromDate, setFromDate] = useState<string>('')
    const [toDate, setToDate] = useState<string>('')
    const [dateType, setDateType] = useState<'shipped' | 'delivered'>('shipped')
    const [page, setPage] = useState(1)
    const LIMIT = 50

    // Load seller accounts once
    useEffect(() => {
        getSellerAccounts().then(setSellerAccounts)
    }, [])

    // Reset page on filter change
    const handleFilterChange = useCallback((fn: () => void) => {
        fn()
        setPage(1)
    }, [])

    const queryParams = {
        sellerAccount: sellerAccount === 'All' ? undefined : sellerAccount,
        dateRange: dateRange !== 'custom' ? dateRange : ('custom' as DateRangeOption),
        fromDate: dateRange === 'custom' ? fromDate : undefined,
        toDate: dateRange === 'custom' ? toDate : undefined,
        dateType,
        page,
        limit: LIMIT,
    }

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['product-report', queryParams],
        queryFn: () => getProductReportData(queryParams),
        staleTime: 5 * 60 * 1000,
    })

    const rows: ProductReportRow[] = data?.rows || []
    const pagination = data?.pagination

    // Overall-level summary stats (across all pages)
    const overallSummary = data?.summary || {
        total_sold_qty: 0,
        total_delivered_qty: 0,
        total_shipped_qty: 0,
        total_delivered_revenue: 0,
        total_delivered_profit: 0,
        total_projected_profit: 0,
        has_profit_rows: false,
        has_projected_rows: false,
    }

    // Page-level summary stats (for current page table footer)
    const pageSoldQty = rows.reduce((s, r) => s + r.sold_qty, 0)
    const pageDeliveredQty = rows.reduce((s, r) => s + r.delivered_qty, 0)
    const pageShippedQty = rows.reduce((s, r) => s + r.shipped_qty, 0)
    const pageRevenue = rows.reduce((s, r) => s + r.delivered_revenue, 0)
    const pageProfitRows = rows.filter(r => r.has_profit_data)
    const pageProfit = pageProfitRows.reduce((s, r) => s + (r.delivered_profit || 0), 0)
    const pageProjectedRows = rows.filter(r => r.projected_profit !== null)
    const pageProjected = pageProjectedRows.reduce((s, r) => s + (r.projected_profit || 0), 0)
    const hasPageProfit = pageProfitRows.length > 0
    const hasPageProjected = pageProjectedRows.length > 0

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 overflow-hidden">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex-none bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 flex items-center justify-between shadow-sm">
                <div>
                    {isEmbedded
                        ? <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Product Report Details</h2>
                        : <h1 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Product Report Details</h1>
                    }
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Product-level sales · profit · pipeline analytics by seller account
                    </p>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* ── Filters ────────────────────────────────────────────────────── */}
            <div className="flex-none bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Seller Account */}
                    <div className="flex items-center gap-1.5">
                        <Store size={13} className="text-gray-400 shrink-0" />
                        <select
                            value={sellerAccount}
                            onChange={e => handleFilterChange(() => setSellerAccount(e.target.value))}
                            className="text-[13px] px-2 py-1 border dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="All">All Seller Accounts</option>
                            {sellerAccounts.map(acc => (
                                <option key={acc} value={acc}>{acc}</option>
                            ))}
                        </select>
                    </div>

                    <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />

                    {/* Date Type Selector */}
                    <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-gray-400 shrink-0" />
                        <select
                            value={dateType}
                            onChange={e => handleFilterChange(() => setDateType(e.target.value as 'shipped' | 'delivered'))}
                            className="text-[13px] px-2 py-1 border dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="shipped">Shipped Date</option>
                            <option value="delivered">Delivered Date</option>
                        </select>
                    </div>

                    <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />

                    {/* Quick Date Buttons */}
                    <div className="flex items-center gap-1">
                        <Calendar size={13} className="text-gray-400 shrink-0" />
                        {(['7', '14', '30'] as DateRangeOption[]).map(d => (
                            <button
                                key={d}
                                onClick={() => handleFilterChange(() => setDateRange(d))}
                                className={`px-2 py-1 text-[12px] font-medium rounded transition-colors ${
                                    dateRange === d
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {d}d
                            </button>
                        ))}
                        <button
                            onClick={() => handleFilterChange(() => setDateRange('custom'))}
                            className={`px-2 py-1 text-[12px] font-medium rounded transition-colors ${
                                dateRange === 'custom'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            Custom
                        </button>
                    </div>

                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                                type="date"
                                value={fromDate}
                                onChange={e => handleFilterChange(() => setFromDate(e.target.value))}
                                className="text-[12px] px-2 py-1 border dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                            <span className="text-[12px] text-gray-400">to</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => handleFilterChange(() => setToDate(e.target.value))}
                                className="text-[12px] px-2 py-1 border dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    )}

                    {sellerAccount !== 'All' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            <Filter size={10} />
                            {sellerAccount}
                            <button
                                onClick={() => handleFilterChange(() => setSellerAccount('All'))}
                                className="ml-0.5 hover:text-blue-900"
                            >×</button>
                        </span>
                    )}
                </div>
            </div>

            {/* ── Summary Cards ──────────────────────────────────────────────── */}
            {!isLoading && rows.length > 0 && (
                <div className="flex-none px-3 py-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {/* Sold Units */}
                    <Card className="p-2.5 flex items-center gap-2 dark:bg-zinc-900 dark:border-zinc-700">
                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded shrink-0">
                            <Package size={14} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Sold Units</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{overallSummary.total_sold_qty.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400">{overallSummary.total_delivered_qty} delivered · {overallSummary.total_shipped_qty} shipped</p>
                        </div>
                    </Card>

                    {/* Delivered Revenue */}
                    <Card className="p-2.5 flex items-center gap-2 dark:bg-zinc-900 dark:border-zinc-700">
                        <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded shrink-0">
                            <TrendingUp size={14} className="text-green-600 dark:text-green-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Delivered Revenue</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrencyShort(overallSummary.total_delivered_revenue)}</p>
                        </div>
                    </Card>

                    {/* Actual Profit */}
                    <Card className="p-2.5 flex items-center gap-2 dark:bg-zinc-900 dark:border-zinc-700">
                        <div className={`p-1.5 rounded shrink-0 ${overallSummary.total_delivered_profit >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                            <TrendingUp size={14} className={overallSummary.total_delivered_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Actual Profit</p>
                            <p className={`text-sm font-bold ${!overallSummary.has_profit_rows ? 'text-gray-400' : profitColor(overallSummary.total_delivered_profit)}`}>
                                {overallSummary.has_profit_rows ? formatCurrencyShort(overallSummary.total_delivered_profit) : 'Sync Needed'}
                            </p>
                            {overallSummary.has_profit_rows && <p className="text-[10px] text-gray-400">(Delivered orders only)</p>}
                        </div>
                    </Card>

                    {/* Projected Profit */}
                    <Card className="p-2.5 flex items-center gap-2 dark:bg-zinc-900 dark:border-zinc-700 border-dashed">
                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded shrink-0">
                            <Truck size={14} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                Pipeline Profit
                                <span title="Estimated profit from orders currently in Shipped status. Calculated as: unit_profit × shipped_qty">
                                    <Info size={9} className="text-gray-400 cursor-help" />
                                </span>
                            </p>
                            <p className={`text-sm font-bold ${!overallSummary.has_projected_rows ? 'text-gray-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {overallSummary.has_projected_rows ? `~${formatCurrencyShort(overallSummary.total_projected_profit)}` : 'N/A'}
                            </p>
                            {overallSummary.has_projected_rows && <p className="text-[10px] text-gray-400">{overallSummary.total_shipped_qty} units in-transit</p>}
                        </div>
                    </Card>
                </div>
            )}

            {/* ── Table ──────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto">
                {isError ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-600 dark:text-red-400">
                        <AlertTriangle size={32} />
                        <p className="text-sm font-medium">Failed to load product report</p>
                        <p className="text-xs text-gray-500">{(error as any)?.message || 'Unknown error'}</p>
                        <button
                            onClick={() => refetch()}
                            className="px-3 py-1.5 text-xs bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 rounded transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <p className="text-sm">Loading product data...</p>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
                        <Package size={32} className="opacity-40" />
                        <p className="text-sm font-medium">No product data found</p>
                        <p className="text-xs">Try adjusting your filters or date range</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[900px]">
                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800 border-b dark:border-zinc-700 shadow-sm">
                                <tr>
                                    <th className="px-2 py-2 text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 w-8">S.N</th>
                                    <th className="px-2 py-2 text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400">Product Name</th>
                                    <th className="px-2 py-2 text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 w-32">Seller Account</th>
                                    <th className="px-2 py-2 text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 text-center w-24">
                                        <div>Sold Qty</div>
                                        <div className="font-normal text-[9px] text-gray-400 normal-case">Delivered / Shipped</div>
                                    </th>
                                    <th className="px-2 py-2 text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 text-right w-36">
                                        <div>Revenue</div>
                                        <div className="font-normal text-[9px] text-gray-400 normal-case">Delivered only</div>
                                    </th>
                                    <th className="px-2 py-2 text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 text-right w-40">
                                        <div>Profit</div>
                                        <div className="font-normal text-[9px] text-gray-400 normal-case">Actual (Delivered)</div>
                                    </th>
                                    <th className="px-2 py-2 text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 text-right w-40">
                                        <div className="flex items-center justify-end gap-1">
                                            Pipeline Profit
                                            <span title="Estimated profit from Shipped orders. unit_profit × shipped_qty">
                                                <Info size={9} className="text-gray-400 cursor-help" />
                                            </span>
                                        </div>
                                        <div className="font-normal text-[9px] text-gray-400 normal-case text-right">In-transit estimate</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {rows.map((row, idx) => {
                                    const rowNum = (page - 1) * LIMIT + idx + 1
                                    const hasProfit = row.has_profit_data && row.delivered_profit !== null
                                    const hasPipeline = row.projected_profit !== null

                                    return (
                                        <tr
                                            key={`${row.product_name}||${row.seller_account}||${idx}`}
                                            className="hover:bg-blue-50/40 dark:hover:bg-zinc-800/50 transition-colors"
                                        >
                                            {/* S.N */}
                                            <td className="px-2 py-2 text-[12px] text-gray-400">{rowNum}</td>

                                            {/* Product Name + SKU */}
                                            <td className="px-2 py-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 leading-tight">
                                                        {row.product_name}
                                                    </span>
                                                    {row.seller_sku && (
                                                        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                                                            SKU: {row.seller_sku}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Seller Account */}
                                            <td className="px-2 py-2">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
                                                    {row.seller_account}
                                                </span>
                                            </td>

                                            {/* Sold Qty + breakdown */}
                                            <td className="px-2 py-2 text-center">
                                                <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-full text-[12px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                                    {row.sold_qty}
                                                </span>
                                                <div className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-center gap-1.5">
                                                    {row.delivered_qty > 0 && (
                                                        <span className="text-green-600 dark:text-green-500">✓{row.delivered_qty}</span>
                                                    )}
                                                    {row.shipped_qty > 0 && (
                                                        <span className="text-amber-500">🚚{row.shipped_qty}</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Revenue */}
                                            <td className="px-2 py-2 text-right">
                                                {row.delivered_revenue > 0 ? (
                                                    <span className="text-[13px] font-mono font-medium text-gray-900 dark:text-gray-100">
                                                        {formatCurrency(row.delivered_revenue)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[12px] text-gray-400">—</span>
                                                )}
                                            </td>

                                            {/* Actual Profit */}
                                            <td className="px-2 py-2 text-right">
                                                {hasProfit ? (
                                                    <div>
                                                        <span className={`text-[13px] font-mono font-medium ${profitColor(row.delivered_profit!)}`}>
                                                            {formatCurrency(row.delivered_profit!)}
                                                        </span>
                                                        {row.unit_profit !== null && (
                                                            <div className="text-[10px] text-gray-400 mt-0.5">
                                                                {formatCurrencyShort(row.unit_profit)}/unit
                                                                {row.delivered_qty_with_cost < row.delivered_qty && (
                                                                    <span 
                                                                        className="text-amber-600 dark:text-amber-500 font-medium ml-1 cursor-help"
                                                                        title={`${row.delivered_qty_with_cost} of ${row.delivered_qty} delivered units have synced purchase costs. Profit averages are based on synced items.`}
                                                                    >
                                                                        ({row.delivered_qty_with_cost}/{row.delivered_qty} synced)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <span className="text-[12px] text-gray-400">N/A</span>
                                                        <div className="text-[9px] text-amber-500 mt-0.5">Sync needed</div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Pipeline Profit */}
                                            <td className="px-2 py-2 text-right">
                                                {hasPipeline ? (
                                                    <div>
                                                        <span className="text-[13px] font-mono font-medium text-amber-600 dark:text-amber-400">
                                                            ~{formatCurrency(row.projected_profit!)}
                                                        </span>
                                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                                            {row.shipped_qty} units
                                                        </div>
                                                    </div>
                                                ) : row.shipped_qty > 0 && !row.has_profit_data ? (
                                                    <div>
                                                        <span className="text-[12px] text-gray-400">N/A</span>
                                                        <div className="text-[9px] text-amber-500 mt-0.5">Sync needed</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[12px] text-gray-300 dark:text-gray-600">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}

                                 {/* Page subtotal */}
                                {rows.length > 1 && (
                                    <tr className="bg-gray-100 dark:bg-zinc-800 font-semibold border-t-2 border-gray-300 dark:border-zinc-600">
                                        <td colSpan={3} className="px-2 py-2 text-[12px] text-gray-600 dark:text-gray-400 uppercase">
                                            Page Total
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-full text-[12px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                {pageSoldQty}
                                            </span>
                                            <div className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-center gap-1.5">
                                                <span className="text-green-600 dark:text-green-500">✓{pageDeliveredQty}</span>
                                                {pageShippedQty > 0 && <span className="text-amber-500">🚚{pageShippedQty}</span>}
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 text-right text-[13px] font-mono text-gray-900 dark:text-gray-100">
                                            {formatCurrency(pageRevenue)}
                                        </td>
                                        <td className="px-2 py-2 text-right text-[13px] font-mono">
                                            {hasPageProfit ? (
                                                <span className={profitColor(pageProfit)}>{formatCurrency(pageProfit)}</span>
                                            ) : (
                                                <span className="text-gray-400 text-[11px]">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-2 text-right text-[13px] font-mono">
                                            {hasPageProjected ? (
                                                <span className="text-amber-600 dark:text-amber-400">~{formatCurrency(pageProjected)}</span>
                                            ) : (
                                                <span className="text-gray-300 dark:text-gray-600">—</span>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Pagination ─────────────────────────────────────────────────── */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex-none bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 px-3 py-2 flex items-center justify-between shadow-sm">
                    <div className="text-[12px] text-gray-500 dark:text-gray-400">
                        Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, pagination.total)} of {pagination.total} products
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={15} />
                        </button>
                        <div className="flex items-center gap-0.5">
                            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                                const totalPages = pagination.totalPages
                                let pageNum: number
                                if (totalPages <= 7) {
                                    pageNum = i + 1
                                } else if (page <= 4) {
                                    pageNum = i + 1
                                } else if (page >= totalPages - 3) {
                                    pageNum = totalPages - 6 + i
                                } else {
                                    pageNum = page - 3 + i
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`w-7 h-7 text-[12px] rounded font-medium transition-colors ${
                                            pageNum === page
                                                ? 'bg-blue-600 text-white'
                                                : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}
                        </div>
                        <button
                            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                            disabled={page === pagination.totalPages}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Profit logic legend ────────────────────────────────────────── */}
            <div className="flex-none bg-gray-50 dark:bg-zinc-950 border-t dark:border-zinc-800 px-3 py-1.5 flex flex-wrap gap-3 text-[10px] text-gray-400">
                <span><strong className="text-gray-500">Actual Profit</strong> = Revenue − Purchase Cost − (Daraz Fees × product share)</span>
                <span>·</span>
                <span><strong className="text-amber-500">Pipeline Profit</strong> = Unit Profit × Shipped Qty (estimate only)</span>
                <span>·</span>
                <span>✓ = Delivered &nbsp; 🚚 = Shipped</span>
            </div>
        </div>
    )
}
