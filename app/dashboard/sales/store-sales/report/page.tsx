'use client'

import { useQuery } from '@tanstack/react-query'
import { getStoreSalesAnalytics } from '@/features/sales/actions/store-sales-actions'
import { getFiscalYears } from '@/features/settings/actions/settingsActions'
import { ArrowLeft, TrendingUp, Calendar, AlertCircle, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { useState } from 'react'

export default function StoreSalesReportPage() {
    const [selectedFyId, setSelectedFyId] = useState<string>('')

    // Fetch Fiscal Years
    const { data: fyData } = useQuery({
        queryKey: ['fiscal-years'],
        queryFn: () => getFiscalYears()
    })

    // Fetch Analytics
    const { data: analytics, isLoading, error } = useQuery({
        queryKey: ['store-sales-analytics', selectedFyId],
        queryFn: () => getStoreSalesAnalytics(selectedFyId)
    })

    const fiscalYears = (fyData as any)?.data || []

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading sales report...</div>
            </div>
        )
    }

    if (error || (analytics as any)?.error) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="text-red-500 flex items-center gap-2">
                    <AlertCircle size={20} />
                    <span>Error loading report: {((analytics as any)?.error || (error as any)?.message)}</span>
                </div>
                <Link href="/dashboard/sales/store-sales" className="text-blue-600 hover:underline">
                    Back to Sales
                </Link>
            </div>
        )
    }

    const { fiscalYear, summary, charts } = analytics as any

    const formatCurrency = (amount: number) => {
        return `Rs. ${amount.toLocaleString('en-IN')}`
    }

    // Chart Helper: Simple CSS Bar Chart
    const BarChart = ({ data, xKey, yKey, height = 200, color = 'bg-blue-500' }: any) => {
        if (!data || data.length === 0) return <div className="text-center text-gray-400 py-10">No data available</div>

        const maxValue = Math.max(...data.map((d: any) => d[yKey])) || 1

        return (
            <div className="flex items-end justify-between gap-2 h-full w-full pt-6 pb-2">
                {data.map((item: any, i: number) => {
                    const heightPercent = (item[yKey] / maxValue) * 100
                    return (
                        <div key={i} className="flex flex-col items-center flex-1 group relative">
                            {/* Tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-black/80 text-white text-xs px-2 py-1 rounded transition-opacity whitespace-nowrap z-10">
                                {item[xKey]}: {item[yKey]}
                            </div>

                            {/* Bar */}
                            <div
                                className={`w-full max-w-[40px] rounded-t ${color} transition-all hover:opacity-80`}
                                style={{ height: `${heightPercent}%` }}
                            ></div>

                            {/* Label */}
                            <div className="mt-2 text-[10px] text-gray-500 truncate w-full text-center">
                                {item.displayDate || item.name}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 pb-10">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <TrendingUp className="text-blue-600" size={24} />
                            Store Sales Report
                        </h1>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                                <Calendar size={14} />
                                <span className="mr-1">Fiscal Year:</span>

                                <select
                                    className="bg-transparent font-medium text-gray-900 dark:text-gray-100 outline-none cursor-pointer"
                                    value={selectedFyId || ''}
                                    onChange={(e) => setSelectedFyId(e.target.value)}
                                >
                                    <option value="">{fiscalYears.find((f: any) => f.is_active)?.name} (Active)</option>
                                    {fiscalYears.map((fy: any) => (
                                        <option key={fy.id} value={fy.id}>
                                            {fy.name} ({new Date(fy.start_date).getFullYear()}-{new Date(fy.end_date).getFullYear()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <span className="text-xs text-gray-400">
                                {new Date(fiscalYear.startDate).toLocaleDateString()} - {new Date(fiscalYear.endDate).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/sales/store-sales"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Back to Sales
                    </Link>
                </div>
            </div>

            <div className="p-4 space-y-6 max-w-7xl mx-auto w-full">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 border-l-4 border-l-blue-500">
                        <p className="text-sm text-gray-500 font-medium">Total Sales (FY)</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                            {formatCurrency(summary.totalSales)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">For selected fiscal year</p>
                    </Card>

                    <Card className="p-4 border-l-4 border-l-purple-500">
                        <p className="text-sm text-gray-500 font-medium">Total Qty (FY)</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                            {summary.totalQty.toLocaleString()} <span className="text-sm font-normal text-gray-500">units</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Total items sold</p>
                    </Card>

                    <Card className="p-4 border-l-4 border-l-green-500">
                        <p className="text-sm text-gray-500 font-medium">Today's Sales</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                            {formatCurrency(summary.todaySales)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleDateString()}</p>
                    </Card>

                    <Card className="p-4 border-l-4 border-l-orange-500">
                        <p className="text-sm text-gray-500 font-medium">Today's Qty</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                            {summary.todayQty.toLocaleString()} <span className="text-sm font-normal text-gray-500">units</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Items sold today</p>
                    </Card>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Last 7 Days Trend */}
                    <Card className="p-4 flex flex-col h-[350px]">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Last 7 Days Sales</h3>
                        <div className="flex-1 w-full">
                            <BarChart
                                data={charts.last7Days}
                                xKey="displayDate"
                                yKey="sales"
                                color="bg-blue-500"
                            />
                        </div>
                    </Card>

                    {/* Monthly Breakdown */}
                    <Card className="p-4 flex flex-col h-[350px]">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Monthly Breakdown</h3>
                        <div className="flex-1 w-full overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-zinc-800 border-b dark:border-zinc-700">
                                    <tr>
                                        <th className="px-4 py-2 font-medium text-gray-500">Month</th>
                                        <th className="px-4 py-2 font-medium text-gray-500 text-right">Qty</th>
                                        <th className="px-4 py-2 font-medium text-gray-500 text-right">Sales</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {charts.monthlyBreakdown.length > 0 ? (
                                        charts.monthlyBreakdown.map((item: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-4 py-2 font-medium">{item.name}</td>
                                                <td className="px-4 py-2 text-right">{item.qty}</td>
                                                <td className="px-4 py-2 text-right">{formatCurrency(item.sales)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                                                No monthly data available yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
