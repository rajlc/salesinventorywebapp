'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react'
import { getStockValuation, StockValuationItem } from '../services/stock-valuation-service'

export default function StockValuationTable() {
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(50)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value)
        setTimeout(() => {
            setDebouncedSearch(e.target.value)
            setPage(1)
        }, 500)
    }, [])

    const { data, isLoading } = useQuery({
        queryKey: ['stock-valuation', page, limit, debouncedSearch],
        queryFn: () => getStockValuation(page, limit, debouncedSearch),
        refetchInterval: 30000,
    })

    const items = data?.data || []
    const totalPages = data?.totalPages || 1
    const totalCount = data?.totalCount || 0
    const summary = data?.summary || { missingCount: 0, totalValuation: 0 }

    return (
        <div className="space-y-4">
            {/* Header / Summary / Search */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                {/* Search */}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search product..."
                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
                        value={search}
                        onChange={onSearchChange}
                    />
                </div>

                {/* Summary Badges */}
                <div className="flex flex-wrap items-center gap-3">
                    {summary.missingCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-full text-sm font-medium border border-red-200 dark:border-red-800">
                            <AlertCircle size={14} />
                            Missing: {summary.missingCount}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-200 dark:border-blue-800">
                        Total: Rs. {summary.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
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
                                <th className="px-4 py-3 text-right whitespace-nowrap">Total Stock</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Stock Value</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap font-bold">Total Valuation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        <Loader2 className="animate-spin h-5 w-5 mx-auto mb-2" />
                                        Calculating valuation...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No products found.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors border-b dark:border-zinc-700"
                                    >
                                        <td className="px-4 py-3 text-gray-500">{((page - 1) * limit) + idx + 1}</td>
                                        <td className="px-4 py-3 font-medium">
                                            {item.product_name}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                                            {item.total_stock}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {item.stock_value === 'Missing' ? (
                                                <span className="text-red-500 font-medium">Missing</span>
                                            ) : (
                                                <span className="text-gray-700 dark:text-gray-300">
                                                    Rs. {item.stock_value.toLocaleString()}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold">
                                            {item.total_valuation === 'Error' ? (
                                                <span className="text-red-500">Error</span>
                                            ) : (
                                                <span className="text-green-600 dark:text-green-400">
                                                    Rs. {item.total_valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
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
            {totalPages > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t dark:border-zinc-800">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} products
                        </div>

                        {/* Page Size Selector */}
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value))
                                setPage(1)
                            }}
                            className="text-sm border rounded-md border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 px-2 py-1"
                        >
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                        </select>
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
