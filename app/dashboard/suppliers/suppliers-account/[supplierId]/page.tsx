'use client'

import { useState, use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getSupplierStats, getSupplierDetailedTransactions, LedgerDetailType } from '@/features/suppliers/actions/supplier-ledger-actions'
import { Card } from '@/components/ui-shim'

import { useDashboard } from '@/app/dashboard/context'
import { useEffect } from 'react'

export default function SupplierDetailLedgerPage({ params }: { params: Promise<{ supplierId: string }> }) {
    const { supplierId } = use(params)
    const searchParams = useSearchParams()
    const fiscalYearId = searchParams.get('fiscalYearId') || undefined
    const paramSupplierName = searchParams.get('supplierName') ? decodeURIComponent(searchParams.get('supplierName')!) : null
    const { setHeaderTitle } = useDashboard()

    // State
    const [activeTab, setActiveTab] = useState<LedgerDetailType>('CASH_BUY')
    const [page, setPage] = useState(1)

    // Set Global Header Title Immediately if param exists
    useEffect(() => {
        if (setHeaderTitle) {
            if (paramSupplierName) {
                setHeaderTitle(paramSupplierName)
            }
        }
        // Don't clear on cleanup here to avoid flashing, we only update if/when statsData comes
    }, [setHeaderTitle, paramSupplierName])

    // 1. Fetch Stats
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['supplier-stats', supplierId, fiscalYearId],
        queryFn: () => getSupplierStats({ supplierId, fiscalYearId })
    })

    // Update Global Header with fetched name (in case param was missing or wrong)
    useEffect(() => {
        if (setHeaderTitle && statsData?.supplierName) {
            setHeaderTitle(statsData.supplierName)
        }
        // Only clear on unmount of the page component
        return () => {
            // We can clear it, but layout handles navigation change clearing automatically usually? 
            // Actually layout doesn't clear automatically unless we tell it. 
            // But if we navigate away, the next page might set it or clear it.
            // Best to clear here to be safe.
            if (setHeaderTitle) setHeaderTitle(null)
        }
    }, [setHeaderTitle, statsData?.supplierName])

    // 2. Fetch Transactions
    const { data: transData, isLoading: transLoading } = useQuery({
        queryKey: ['supplier-details', supplierId, activeTab, page, fiscalYearId],
        queryFn: () => getSupplierDetailedTransactions({ supplierId, type: activeTab, page, limit: 10, fiscalYearId })
    })

    const stats = statsData?.stats
    const supplierName = statsData?.supplierName || paramSupplierName || 'Loading...'

    // Calculate Totals
    const totalDebit = (stats?.cashBuy || 0) + (stats?.cashSell || 0) + (stats?.dueSell || 0) + (stats?.paid || 0)
    const totalCredit = (stats?.cashBuy || 0) + (stats?.cashSell || 0) + (stats?.dueBuy || 0) + (stats?.received || 0)
    const openingBalance = stats?.openingBalance || 0
    const runningBalance = openingBalance + totalCredit - totalDebit

    // Tab Configuration
    const tabs: { type: LedgerDetailType; label: string }[] = [
        { type: 'CASH_BUY', label: 'Cash Buy' },
        { type: 'CASH_SELL', label: 'Cash Sell' },
        { type: 'DUE_SELL', label: 'Due Sell' },
        { type: 'DUE_BUY', label: 'Due Buy' },
        { type: 'PAID', label: 'Paid Amount' },
        { type: 'RECEIVED', label: 'Received Amount' },
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/suppliers?fiscalYearId=${fiscalYearId || ''}`}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{supplierName}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Supplier Ledger Detail ({statsData?.timeRange ? `${new Date(statsData.timeRange.startDate).toLocaleDateString()} - ${new Date(statsData.timeRange.endDate).toLocaleDateString()}` : '...'})</p>
                    </div>
                </div>
                {/* Running Balance Display */}
                <div className="flex items-center gap-4">
                    <Link
                        href={`/dashboard/suppliers/suppliers-ledger/${supplierId}?fiscalYearId=${fiscalYearId || ''}&supplierName=${encodeURIComponent(supplierName)}`}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800 transition-colors"
                    >
                        View Full Ledger
                    </Link>
                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase font-semibold">Running Balance</div>
                        <div className={`text-xl font-bold ${runningBalance > 1 ? 'text-red-600' : runningBalance < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                            Rs {runningBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Running Balance Only (Header is global) */}
            <div className="md:hidden sticky top-0 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-2 z-10">
                <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Running Balance</div>
                    <div className={`text-lg font-bold ${runningBalance > 1 ? 'text-red-600' : runningBalance < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                        Rs {runningBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-auto">
                {/* Stats Grid */}
                {statsLoading ? (
                    <div className="h-32 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg border">
                        <Loader2 className="animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Debit Side */}
                        <Card className="p-4 bg-white dark:bg-zinc-900 border-l-4 border-l-blue-500 relative">
                            <div className="absolute top-2 right-4 text-right">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">Total Debit</div>
                                <div className="text-lg font-bold text-blue-600">Rs {totalDebit.toLocaleString()}</div>
                            </div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Debit Side</h3>
                            <div className="space-y-2 mt-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Cash Buy</span>
                                    <span className="font-medium">Rs {stats?.cashBuy.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Cash Sell</span>
                                    <span className="font-medium">Rs {stats?.cashSell.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Due Sell</span>
                                    <span className="font-medium">Rs {stats?.dueSell.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t dark:border-zinc-800">
                                    <span className="text-gray-800 dark:text-gray-200 font-medium">Paid Amount</span>
                                    <span className="font-bold text-blue-600">Rs {stats?.paid.toLocaleString()}</span>
                                </div>
                            </div>
                        </Card>

                        {/* Credit Side */}
                        <Card className="p-4 bg-white dark:bg-zinc-900 border-l-4 border-l-green-500 relative">
                            <div className="absolute top-2 right-4 text-right">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">Total Credit</div>
                                <div className="text-lg font-bold text-green-600">Rs {totalCredit.toLocaleString()}</div>
                            </div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Credit Side</h3>
                            <div className="space-y-2 mt-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Cash Buy</span>
                                    <span className="font-medium">Rs {stats?.cashBuy.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Cash Sell</span>
                                    <span className="font-medium">Rs {stats?.cashSell.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Due Buy</span>
                                    <span className="font-medium">Rs {stats?.dueBuy.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t dark:border-zinc-800">
                                    <span className="text-gray-800 dark:text-gray-200 font-medium">Received Amount</span>
                                    <span className="font-bold text-green-600">Rs {stats?.received.toLocaleString()}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2 pb-2 bg-white dark:bg-zinc-900 sticky top-0 px-2 pt-2 -mx-2 z-10">
                    {tabs.map(tab => (
                        <button
                            key={tab.type}
                            onClick={() => { setActiveTab(tab.type); setPage(1) }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${activeTab === tab.type
                                ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-black dark:border-white'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-zinc-900 dark:text-gray-400 dark:border-zinc-700 dark:hover:bg-zinc-800'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Transactions Table */}
                <Card className="overflow-hidden bg-white shadow-sm dark:bg-zinc-900 border min-h-[300px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Date</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Particular</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Payment/Method</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {transLoading ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500">
                                            <Loader2 className="animate-spin inline mr-2" size={16} /> Loading records...
                                        </td>
                                    </tr>
                                ) : (!transData?.transactions || transData.transactions.length === 0) ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-sm text-gray-500">
                                            No records found for {tabs.find(t => t.type === activeTab)?.label}.
                                        </td>
                                    </tr>
                                ) : (
                                    transData.transactions.map((t: any) => {
                                        const isZeroAmount = Number(t.amount) === 0;
                                        return (
                                            <tr key={t.id} className={`hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${isZeroAmount ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.date}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 align-top">
                                                    <div className="font-semibold">{t.description}</div>
                                                    {t.quantity !== undefined && t.quantity > 0 && (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                                                            ({t.quantity} × {t.unit_amount})
                                                        </span>
                                                    )}
                                                    {t.particular_detail && (
                                                        <div className={`text-[11px] px-1.5 py-0.5 rounded font-semibold block w-fit mt-1 ${
                                                            t.particular_detail.toLowerCase().includes('sell')
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                : t.particular_detail.toLowerCase().includes('buy')
                                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                : 'text-gray-500'
                                                        }`}>
                                                            {t.particular_detail}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.reference}</td>
                                                <td className={`px-4 py-3 text-sm text-right font-medium ${isZeroAmount ? 'text-red-600' : ''}`}>
                                                    Rs {Number(t.amount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Pagination */}
                {transData && (transData.totalPages || 0) > 1 && (
                    <div className="flex justify-center gap-2 pt-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-500">
                            Page {page} of {transData.totalPages}
                        </span>
                        <button
                            disabled={page === transData.totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
