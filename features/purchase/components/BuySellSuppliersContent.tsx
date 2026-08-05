'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSuppliers } from '@/features/suppliers/actions/supplier-actions'
import { ArrowLeft, Search, Plus } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import PurchaseForm from '@/features/purchase/components/PurchaseForm'
import { getPurchases } from '@/features/purchase/actions/purchase-actions'

interface BuySellSuppliersContentProps {
    isEmbedded?: boolean
}

export default function BuySellSuppliersContent({ isEmbedded = false }: BuySellSuppliersContentProps) {
    const [search, setSearch] = useState('')
    const [viewMode, setViewMode] = useState<'all' | 'buy' | 'sell'>('all')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    // Fetch Suppliers (kept from original page logic, though mainly used for search context if extended)
    const { data, isLoading } = useQuery({
        queryKey: ['suppliers-list', search],
        queryFn: () => getSuppliers({ limit: 1000, search: search })
    })

    // Fetch Buy/Sell Transactions (Recent)
    const { data: transactionsData, isLoading: isTransactionsLoading } = useQuery({
        queryKey: ['buy-sell-transactions'],
        queryFn: () => getPurchases({ limit: 50 })
    })

    // Filter for Buy/Sell transactions (client-side for now as per instructions to show what is saved)
    // We look for purchase_name == 'Buy / Sell'
    const transactions = transactionsData?.purchases.filter((p: any) => p.purchase_name === 'Buy / Sell') || []

    // Also filter by search if needed (simple client-side check against supplier name)
    const filteredTransactions = transactions.filter((t: any) => {
        const matchesSearch = search ? t.supplier?.supplier_name.toLowerCase().includes(search.toLowerCase()) : true
        const matchesMode = viewMode === 'all'
            ? true
            : (t.purchase_type || '').toLowerCase() === viewMode
        return matchesSearch && matchesMode
    })

    return (
        <div className={`flex flex-col h-full bg-gray-50 dark:bg-zinc-900 ${isEmbedded ? '' : ''}`}>
            {/* Header - Only shown if NOT embedded */}
            {!isEmbedded && (
                <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold">Vendor Trade Report</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">View supplier reports and history</p>
                    </div>
                    <Link
                        href="/dashboard/purchase"
                        className="flex items-center gap-1 px-2 py-1 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Back to Dashboard
                    </Link>
                </div>
            )}

            {/* Controls */}
            <div className={`sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-1 py-1 shadow-sm ${isEmbedded ? 'md:top-[5px]' : ''}`}>
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search suppliers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
                        />
                    </div>

                    {/* Buy/Sell/All Toggle */}
                    <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-lg p-1 shrink-0">
                        {(['all', 'buy', 'sell'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all ${viewMode === mode
                                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="hidden md:flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                    >
                        <Plus size={16} />
                        Add New Purchase
                    </button>
                </div>
            </div>

            {/* Mobile Floating Action Button (Only if NOT embedded, or handled globally?) 
                Keeping it simple: Show on mobile regardless of embedding as tabs might not be mobile optimized yet 
                or user expects FAB. The original page had it.
            */}
            <div className="md:hidden fixed bottom-6 right-4 z-40">
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="h-12 w-12 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
                >
                    <Plus size={24} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-1 space-y-2">

                {/* Recent Transactions Table */}
                <Card className="flex flex-col flex-1 overflow-hidden">
                    <div className="hidden md:block px-4 py-3 border-b dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                        <h3 className="font-semibold text-gray-700 dark:text-gray-300">Recent Buy / Sell Transactions</h3>
                    </div>
                    <div className="overflow-auto relative flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-30 shadow-sm">
                                <tr className="bg-gray-100 dark:bg-zinc-800 border-b dark:border-zinc-700">
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-16 bg-gray-100 dark:bg-zinc-800">S.N</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">Date</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">Product</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">Supplier</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right bg-gray-100 dark:bg-zinc-800">Qty</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right bg-gray-100 dark:bg-zinc-800">Rate</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right bg-gray-100 dark:bg-zinc-800">Amount</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center bg-gray-100 dark:bg-zinc-800">Type</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isTransactionsLoading ? (
                                    <tr><td colSpan={8} className="p-8 text-center text-sm text-gray-500">Loading transactions...</td></tr>
                                ) : filteredTransactions.length === 0 ? (
                                    <tr><td colSpan={8} className="p-8 text-center text-sm text-gray-500">No recent Buy / Sell transactions.</td></tr>
                                ) : (
                                    filteredTransactions.map((t: any, index: number) => (
                                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                                            <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{t.purchase_date}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{t.product?.product_name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.supplier?.supplier_name}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono">{t.quantity}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-500">
                                                {t.unit_amount ? t.unit_amount.toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-bold font-mono text-gray-900 dark:text-gray-100">
                                                Rs {t.total_amount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${t.purchase_type === 'Sell'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                    {t.purchase_type || 'Buy'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Add Purchase Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 md:p-4">
                    <div className="w-full max-w-3xl h-full md:h-[80vh] bg-white dark:bg-zinc-900 md:rounded-lg shadow-xl overflow-hidden">
                        <PurchaseForm
                            onClose={() => setIsAddModalOpen(false)}
                            onSuccess={() => { setIsAddModalOpen(false) }}
                            showExtraFields={true}
                            fixedPurchaseName="Buy / Sell"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
