'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDailyPurchaseReport, getFiscalYears } from '@/features/purchase/actions/purchase-analytics-actions'
import { getPurchases, Purchase } from '@/features/purchase/actions/purchase-actions'
import { Calendar, Eye, ArrowLeft, X, Wallet, CreditCard, Banknote, HelpCircle } from 'lucide-react'
import { Card } from '@/components/ui-shim'
import DailyPurchaseDetailView from './DailyPurchaseDetailView'

export default function DailyReportTab() {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [fiscalYearId, setFiscalYearId] = useState('')
    const [selectedDate, setSelectedDate] = useState<string | null>(null)

    // Fetch Fiscal Years
    const { data: fiscalYearsData } = useQuery({
        queryKey: ['fiscal-years-filter'],
        queryFn: () => getFiscalYears()
    })

    // Fetch Daily Report Data
    const { data: dailyReportData, isLoading } = useQuery({
        queryKey: ['daily-purchase-report', startDate, endDate, fiscalYearId],
        queryFn: () => getDailyPurchaseReport({ startDate, endDate, fiscalYearId })
    })

    // Fetch Details for Selected Date
    const { data: detailData, isLoading: isLoadingDetails } = useQuery({
        queryKey: ['purchase-details', selectedDate],
        queryFn: () => selectedDate ? getPurchases({ startDate: selectedDate, endDate: selectedDate, limit: 1000 }) : null,
        enabled: !!selectedDate
    })

    // Detail View Overlay
    if (selectedDate) {
        return (
            <DailyPurchaseDetailView
                date={selectedDate}
                purchases={detailData?.purchases || []}
                isLoading={isLoadingDetails}
                onBack={() => setSelectedDate(null)}
            />
        )
    }

    // Date formatter
    const formatDate = (dateStr: string) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    // Main View
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Filters */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Fiscal Year */}
                    <select
                        value={fiscalYearId}
                        onChange={(e) => setFiscalYearId(e.target.value)}
                        className="px-3 py-1.5 text-sm border dark:border-zinc-700 rounded dark:bg-zinc-800 min-w-[150px]"
                    >
                        <option value="">All Fiscal Years</option>
                        {fiscalYearsData?.data?.map((fy: any) => (
                            <option key={fy.id} value={fy.id}>
                                {fy.name} {fy.is_active && '(Active)'}
                            </option>
                        ))}
                    </select>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 border dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-800">
                        <Calendar size={14} className="text-gray-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none p-0 text-sm focus:ring-0 w-24"
                            placeholder="Start"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none p-0 text-sm focus:ring-0 w-24"
                            placeholder="End"
                        />
                    </div>

                    {(startDate || endDate || fiscalYearId) && (
                        <button
                            onClick={() => {
                                setStartDate('')
                                setEndDate('')
                                setFiscalYearId('')
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 underline px-2"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Main Table */}
            <div className="flex-1 overflow-auto p-4">
                <Card className="overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 dark:bg-zinc-800 text-xs uppercase font-bold text-gray-600 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3 w-16 text-center">#</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-right">Sales Amount</th>
                                <th className="px-4 py-3 text-right">Purchase Amount</th>
                                <th className="px-4 py-3 text-center w-24">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-800">
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading daily reports...</td></tr>
                            ) : dailyReportData?.dailyStats.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No purchase records found.</td></tr>
                            ) : (
                                dailyReportData?.dailyStats.map((stat: any, index: number) => (
                                    <tr key={stat.date} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-4 py-3 text-center text-sm text-gray-500">{index + 1}</td>
                                        <td className="px-4 py-3 font-medium text-sm">{formatDate(stat.date)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-sm text-green-600 dark:text-green-400">
                                            Rs {(stat.salesAmount || 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-sm text-blue-600 dark:text-blue-400">
                                            Rs {(stat.purchaseAmount || 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setSelectedDate(stat.date)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-full text-xs font-medium transition-colors"
                                            >
                                                <Eye size={12} />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Card>
            </div>
        </div>
    )
}

function UsersIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-orange-500"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
