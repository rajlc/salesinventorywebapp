'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, ArrowLeft, ArrowRight } from 'lucide-react'
import { StockLedgerItem, getStockLedger } from '../services/stock-ledger-service'
import Link from 'next/link'

interface Props {
    initialData: StockLedgerItem[]
    initialTotal: number
    initialPages: number
}

export default function StockLedgerTable({ initialData, initialTotal, initialPages }: Props) {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value)
        setTimeout(() => {
            setDebouncedSearch(e.target.value)
            setPage(1) // Reset to first page on search
        }, 500)
    }, [])

    const { data, isLoading } = useQuery({
        queryKey: ['stock-ledger', page, debouncedSearch],
        queryFn: () => getStockLedger(page, 100, debouncedSearch),
        placeholderData: (previousData) => previousData,
        initialData: page === 1 && !debouncedSearch ? {
            data: initialData,
            totalCount: initialTotal,
            totalPages: initialPages,
            currentPage: 1
        } : undefined,
        refetchInterval: 30000, // Auto-refresh every 30 seconds
    })

    const ledgerItems = data?.data || []
    const totalPages = data?.totalPages || 1
    const totalCount = data?.totalCount || 0

    return (
        <div className="space-y-4">
            {/* Search Box */}
            <div className="flex items-center gap-2 max-w-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Filter product name..."
                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
                        value={search}
                        onChange={onSearchChange}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 font-medium border-b dark:border-zinc-700 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 w-16 whitespace-nowrap">S.N</th>
                                <th className="px-4 py-3 min-w-[250px]">Product Name</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Store Stock</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Auto Adjust</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Damage Stock</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Purchase</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap text-green-600 dark:text-green-400">Sales</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap text-blue-600 dark:text-blue-400">Ecommerce Sales</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap text-red-600 dark:text-red-400">Sales Return</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap font-bold text-blue-700 dark:text-blue-300">Total Stock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                        <Loader2 className="animate-spin h-5 w-5 mx-auto mb-2" />
                                        Loading ledger...
                                    </td>
                                </tr>
                            ) : ledgerItems.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                        No products found.
                                    </td>
                                </tr>
                            ) : (
                                ledgerItems.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        className={`transition-colors border-b dark:border-zinc-700 ${item.total_stock < 0
                                            ? 'bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/50'
                                            : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                            }`}
                                    >
                                        <td className="px-4 py-3 text-gray-500">{((page - 1) * 100) + idx + 1}</td>
                                        <td className="px-4 py-3 font-medium">
                                            <Link
                                                href={`/dashboard/inventory/stock-ledger/${item.id}`}
                                                className="text-blue-600 hover:underline dark:text-blue-400"
                                            >
                                                {item.product_name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                            {item.store_stock}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-purple-600 dark:text-purple-400 whitespace-nowrap">
                                            {item.auto_adjust}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-orange-600 dark:text-orange-400 whitespace-nowrap">
                                            {item.damage_stock}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                            {item.purchase}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                                            {item.sales}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                            {item.ecommerce_sales || 0}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                                            {item.sales_return}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/10 whitespace-nowrap">
                                            {item.total_stock}
                                            {item.product_type === 'combo' && (
                                                <span className="ml-1 text-xs text-purple-600 dark:text-purple-400">{'{Combo}'}</span>
                                            )}
                                            {item.product_type === 'variation' && (
                                                <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">{'{Variation}'}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t dark:border-zinc-800">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Showing {((page - 1) * 100) + 1} to {Math.min(page * 100, totalCount)} of {totalCount} products
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Previous
                        </button>
                        <span className="text-sm font-medium px-3 text-gray-900 dark:text-white">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700"
                        >
                            Next
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
