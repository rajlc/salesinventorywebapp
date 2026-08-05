'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    getAllFiscalYears,
    getActiveFiscalYear,
    getDarazSalesByFiscalYear,
    getMonthlySalesByFiscalYear,
    getSalesBySellerAccount,
    getLast30DaysSales
} from '@/features/sales/actions/daraz-actions'
import { ArrowLeft, TrendingUp, Package, DollarSign, Store, List } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

interface DarazSalesReportProps {
    isEmbedded?: boolean
}

function Last30DaysChart() {
    const { data, isLoading } = useQuery({
        queryKey: ['last-30-days-sales'],
        queryFn: () => getLast30DaysSales(),
    })

    if (isLoading) return <div className="text-center py-8 text-sm text-gray-400 animate-pulse">Loading chart data...</div>
    if (!data || data.data.length === 0) return null

    const { data: chartData, sellers } = data
    // Calculate max value for Y-axis scaling
    const maxDailyOrders = Math.max(...chartData.map(d => Object.values(d)
        .filter(v => typeof v === 'number')
        .reduce((a: number, b: number) => a + b, 0) as number), 10) // Min max of 10 to avoid flat charts

    // Premium color palette (Tailwind classes)
    const colors = [
        'bg-indigo-500 dark:bg-indigo-600',
        'bg-emerald-500 dark:bg-emerald-600',
        'bg-yellow-300 dark:bg-yellow-400', // Lighter yellow
        'bg-rose-500 dark:bg-rose-600',
        'bg-cyan-500 dark:bg-cyan-600',
        'bg-violet-500 dark:bg-violet-600',
        'bg-lime-500 dark:bg-lime-600',
        'bg-fuchsia-500 dark:bg-fuchsia-600'
    ]

    return (
        <Card className="dark:bg-zinc-900 dark:border-zinc-700 mb-4 shadow-sm overflow-visible text-left">
            <div className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />
                        Last 30 Days Order Trend
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
                        {sellers.map((seller, idx) => (
                            <div key={seller} className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity cursor-default">
                                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${colors[idx % colors.length]}`} />
                                <span className="text-gray-600 dark:text-gray-300 font-medium">{seller}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative h-64 w-full">
                    {/* Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                            <div key={ratio} className="w-full flex items-center">
                                <span className="w-8 text-[10px] text-gray-400 dark:text-gray-500 text-right pr-2">
                                    {Math.round(maxDailyOrders * ratio)}
                                </span>
                                <div className="flex-1 h-px bg-gray-100 dark:bg-zinc-800 border-t border-dashed border-gray-200 dark:border-zinc-700/50" />
                            </div>
                        ))}
                    </div>

                    {/* Chart Bars Container */}
                    <div className="absolute inset-0 ml-8 flex items-end justify-between gap-1 pt-2 pb-5 pl-1">
                        {chartData.map((day, idx) => {
                            const date = new Date(day.date)
                            const total = sellers.reduce((sum, seller) => sum + ((day[seller] as number) || 0), 0)
                            const heightPercent = maxDailyOrders > 0 ? (total / maxDailyOrders) * 100 : 0
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6

                            return (
                                <div key={idx} className="flex-1 h-full flex flex-col justify-end group relative cursor-pointer">
                                    {/* Hover Indicator Background */}
                                    <div className="absolute inset-x-0 bottom-0 top-0 bg-gray-50 dark:bg-white/5 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity pointer-events-none" />

                                    {/* Tooltip */}
                                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none transition-all duration-200 transform translate-y-2 group-hover:translate-y-0">
                                        <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm border dark:border-zinc-700 text-xs shadow-xl rounded-lg p-2.5 min-w-[140px]">
                                            <div className="font-bold text-gray-900 dark:text-gray-100 mb-1.5 pb-1.5 border-b dark:border-zinc-700">
                                                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400 pb-1">
                                                    <span>Total Orders</span>
                                                    <span className="font-bold text-gray-900 dark:text-gray-100">{total}</span>
                                                </div>
                                                {sellers.map((seller, sIdx) => {
                                                    const val = day[seller] as number
                                                    if (!val) return null
                                                    return (
                                                        <div key={seller} className="flex justify-between items-center gap-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${colors[sIdx % colors.length]}`} />
                                                                <span className="text-gray-500 dark:text-gray-400">{seller}</span>
                                                            </div>
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">{val}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                        {/* Tooltip Arrow */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white dark:border-t-zinc-800" />
                                    </div>

                                    {/* Stacked Bar */}
                                    <div
                                        className="w-full max-w-[24px] mx-auto rounded-t-sm overflow-hidden flex flex-col-reverse shadow-sm relative transition-transform duration-200 group-hover:-translate-y-0.5"
                                        style={{ height: `${heightPercent}%` }}
                                    >
                                        {sellers.map((seller, sIdx) => {
                                            const val = day[seller] as number
                                            if (!val) return null
                                            const segmentHeight = (val / total) * 100
                                            return (
                                                <div
                                                    key={seller}
                                                    className={`w-full ${colors[sIdx % colors.length]} opacity-90 hover:opacity-100 transition-opacity`}
                                                    style={{ height: `${segmentHeight}%` }}
                                                />
                                            )
                                        })}
                                    </div>

                                    {/* X-axis label */}
                                    <div className={`absolute top-full pt-2 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap transition-colors ${isWeekend ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                                        }`}>
                                        {(idx % 5 === 0 || idx === chartData.length - 1) ? date.getDate() : ''}
                                    </div>

                                    {/* Vertical alignment line for dates */}
                                    {(idx % 5 === 0 || idx === chartData.length - 1) && (
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-1 bg-gray-300 dark:bg-zinc-600" />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </Card>
    )
}

export function DarazSalesReport({ isEmbedded = false }: DarazSalesReportProps) {
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('')

    // Fetch fiscal years
    const { data: fiscalYears } = useQuery({
        queryKey: ['fiscal-years'],
        queryFn: getAllFiscalYears,
    })

    // Set active fiscal year on mount
    useEffect(() => {
        if (!selectedFiscalYear) {
            getActiveFiscalYear().then(fy => {
                if (fy) setSelectedFiscalYear(fy.id)
            })
        }
    }, [selectedFiscalYear])

    // Fetch sales summary
    const { data: salesSummary, isLoading: loadingSummary } = useQuery({
        queryKey: ['daraz-sales-summary', selectedFiscalYear],
        queryFn: () => getDarazSalesByFiscalYear(selectedFiscalYear),
        enabled: !!selectedFiscalYear
    })

    // Fetch monthly breakdown
    const { data: monthlyData, isLoading: loadingMonthly } = useQuery({
        queryKey: ['daraz-monthly-sales', selectedFiscalYear],
        queryFn: () => getMonthlySalesByFiscalYear(selectedFiscalYear),
        enabled: !!selectedFiscalYear
    })

    // Fetch seller account breakdown
    const { data: sellerData, isLoading: loadingSellers } = useQuery({
        queryKey: ['daraz-seller-sales', selectedFiscalYear],
        queryFn: () => getSalesBySellerAccount(selectedFiscalYear),
        enabled: !!selectedFiscalYear
    })

    const selectedFY = fiscalYears?.find(fy => fy.id === selectedFiscalYear)

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 overflow-hidden">
            {/* Header */}
            <div className="flex-none bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                <div>
                    {!isEmbedded && <h1 className="text-base font-bold">Daraz Sales Report</h1>}
                    {isEmbedded && <h2 className="text-base font-bold">Sales Report Details</h2>}
                    {selectedFY && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            FY: {new Date(selectedFY.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - {new Date(selectedFY.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/dashboard/sales/daraz/order-list${selectedFiscalYear ? `?fiscalYear=${selectedFiscalYear}` : ''}`}
                        className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        <List size={14} />
                        Order List
                    </Link>
                    {!isEmbedded && (
                        <Link
                            href="/dashboard/sales/daraz"
                            className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                        >
                            <ArrowLeft size={14} />
                            Back to Sales
                        </Link>
                    )}
                </div>
            </div>

            {/* Fiscal Year Selector Bar */}
            <div className="flex-none bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <select
                    value={selectedFiscalYear}
                    onChange={(e) => setSelectedFiscalYear(e.target.value)}
                    className="w-full md:w-auto px-2 py-1 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                    disabled={!fiscalYears || fiscalYears.length === 0}
                >
                    {!fiscalYears || fiscalYears.length === 0 ? (
                        <option>Loading...</option>
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
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {loadingSummary ? (
                    <div className="text-center py-8 text-sm text-gray-500">Loading...</div>
                ) : salesSummary ? (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Card className="p-3 dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                                        <Package size={18} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Orders</p>
                                        <p className="text-lg font-bold">{salesSummary.totalOrders}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-3 dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                                        <TrendingUp size={18} className="text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Quantity</p>
                                        <p className="text-lg font-bold">{salesSummary.totalQuantity}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-3 dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded">
                                        <DollarSign size={18} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Amount</p>
                                        <p className="text-lg font-bold">Rs {salesSummary.totalAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-3 dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded">
                                        <Store size={18} className="text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Active Accounts</p>
                                        <p className="text-lg font-bold">{salesSummary.activeSellerAccounts}</p>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Monthly Progress Chart */}
                        {monthlyData && monthlyData.length > 0 && (
                            <Card className="dark:bg-zinc-900 dark:border-zinc-700 mb-3">
                                <div className="p-3">
                                    <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-gray-100 mb-3">
                                        📊 Monthly Order Trends
                                    </h3>
                                    <div className="space-y-2">
                                        {monthlyData.map((month, idx) => {
                                            const monthDate = new Date(month.month + '-01')
                                            const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                            const maxOrders = Math.max(...monthlyData.map(m => m.orderCount))
                                            const percentage = maxOrders > 0 ? (month.orderCount / maxOrders) * 100 : 0

                                            return (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <div className="w-16 text-xs text-gray-600 dark:text-gray-400 shrink-0">
                                                        {monthName}
                                                    </div>
                                                    <div className="flex-1 h-5 bg-gray-100 dark:bg-zinc-800 rounded-sm overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 flex items-center justify-end pr-1"
                                                            style={{ width: `${percentage}%` }}
                                                        >
                                                            {percentage > 20 && (
                                                                <span className="text-xs font-bold text-white">
                                                                    {month.orderCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {percentage <= 20 && (
                                                        <div className="w-8 text-xs font-medium text-gray-700 dark:text-gray-300">
                                                            {month.orderCount}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Seller Account Chart */}
                        {sellerData && sellerData.length > 0 && (
                            <Card className="dark:bg-zinc-900 dark:border-zinc-700 mb-3">
                                <div className="p-3">
                                    <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-gray-100 mb-3">
                                        🏪 Sales by Seller Account
                                    </h3>
                                    <div className="space-y-2">
                                        {sellerData.map((seller, idx) => {
                                            const maxQty = Math.max(...sellerData.map(s => s.quantity))
                                            const percentage = maxQty > 0 ? (seller.quantity / maxQty) * 100 : 0

                                            return (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <div className="w-24 text-xs text-gray-600 dark:text-gray-400 shrink-0 truncate" title={seller.sellerAccount}>
                                                        {seller.sellerAccount}
                                                    </div>
                                                    <div className="flex-1 h-5 bg-gray-100 dark:bg-zinc-800 rounded-sm overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 flex items-center justify-end pr-1"
                                                            style={{ width: `${percentage}%` }}
                                                        >
                                                            {percentage > 20 && (
                                                                <span className="text-xs font-bold text-white">
                                                                    {seller.quantity} qty
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {percentage <= 20 && (
                                                        <div className="w-12 text-xs font-medium text-gray-700 dark:text-gray-300">
                                                            {seller.quantity} qty
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Last 30 Days Trend Chart */}
                        <Last30DaysChart />

                        {/* Sales by Seller Account */}
                        <Card className="dark:bg-zinc-900 dark:border-zinc-700">
                            <div className="p-3">
                                <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-gray-100 mb-2">
                                    Sales by Seller Account
                                </h3>
                                {loadingSellers ? (
                                    <div className="text-center py-4 text-sm text-gray-500">Loading sellers...</div>
                                ) : sellerData && sellerData.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full table-auto border-collapse">
                                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                                <tr>
                                                    <th className="px-2 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Seller Account</th>
                                                    <th className="px-2 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Company</th>
                                                    <th className="px-2 py-1 text-right text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Orders</th>
                                                    <th className="px-2 py-1 text-right text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Qty</th>
                                                    <th className="px-2 py-1 text-right text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Total Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                                                {sellerData.map((seller, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-2 py-1 text-sm text-gray-700 dark:text-gray-300">{seller.sellerAccount}</td>
                                                        <td className="px-2 py-1 text-sm text-gray-700 dark:text-gray-300">{seller.companyName}</td>
                                                        <td className="px-2 py-1 text-right text-sm text-gray-700 dark:text-gray-300">{seller.orders}</td>
                                                        <td className="px-2 py-1 text-right text-sm text-gray-700 dark:text-gray-300">{seller.quantity}</td>
                                                        <td className="px-2 py-1 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                                                            Rs {seller.totalAmount.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-sm text-gray-500">No seller data available</div>
                                )}
                            </div>
                        </Card>

                        {/* Monthly Breakdown */}
                        <Card className="dark:bg-zinc-900 dark:border-zinc-700">
                            <div className="p-3">
                                <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-gray-100 mb-2">
                                    Month-by-Month Progress
                                </h3>
                                {loadingMonthly ? (
                                    <div className="text-center py-4 text-sm text-gray-500">Loading monthly data...</div>
                                ) : monthlyData && monthlyData.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full table-auto border-collapse">
                                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                                <tr>
                                                    <th className="px-2 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Month</th>
                                                    <th className="px-2 py-1 text-right text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Orders</th>
                                                    <th className="px-2 py-1 text-right text-xs font-bold uppercase text-gray-900 dark:text-gray-100">Total Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                                                {monthlyData.map((month, idx) => {
                                                    const monthDate = new Date(month.month + '-01')
                                                    const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                            <td className="px-2 py-1 text-sm text-gray-700 dark:text-gray-300">{monthName}</td>
                                                            <td className="px-2 py-1 text-right text-sm text-gray-700 dark:text-gray-300">{month.orderCount}</td>
                                                            <td className="px-2 py-1 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                                                                Rs {month.totalAmount.toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-sm text-gray-500">No monthly data available</div>
                                )}
                            </div>
                        </Card>
                    </>
                ) : (
                    <div className="text-center py-8 text-sm text-gray-500">Select a fiscal year to view report</div>
                )}
            </div>
        </div>
    )
}
