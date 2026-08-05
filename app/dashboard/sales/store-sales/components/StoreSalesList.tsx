'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStoreSales } from '@/features/sales/actions/store-sales-actions'
import { Search, Plus, TrendingUp, ArrowLeft, X } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { format } from 'date-fns'

interface Props {
    onSwitchToPos: () => void
    onViewSale?: (id: string) => void
}

export default function StoreSalesList({ onSwitchToPos, onViewSale }: Props) {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')

    // Fetch sales
    const { data, isLoading } = useQuery({
        queryKey: ['store-sales', page, search],
        queryFn: () => getStoreSales({ page, limit: 20, search })
    })

    const sales = (data as any)?.sales || []
    const pagination = (data as any)?.pagination

    const handleSearch = () => {
        setSearch(searchInput)
        setPage(1)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
    }

    const formatCurrency = (amount: number) => {
        return `Rs. ${amount.toLocaleString('en-IN')}`
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Action Bar */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1 shadow-sm">
                <div className="flex items-center gap-1.5">
                    {/* Search */}
                    <div className="flex-1 min-w-[120px]">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={10} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-6 pr-6 py-0.5 text-xs border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                            />
                        </div>
                    </div>

                    {/* Action Buttons - Hidden or reduced in landscape */}
                    <button
                        onClick={onSwitchToPos}
                        className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors landscape:hidden md:landscape:flex"
                    >
                        <Plus size={10} />
                        <span className="hidden xs:inline">New Sale</span>
                    </button>
                    <Link
                        href="/dashboard/sales/store-sales/report"
                        className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded transition-colors"
                    >
                        <TrendingUp size={10} />
                        <span className="hidden xs:inline">Report</span>
                    </Link>
                </div>
            </div>

            {/* Sales Table */}
            <div className="flex-1 overflow-auto px-1 py-1">
                <Card className="overflow-hidden border-none shadow-none bg-transparent">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-800 dark:bg-zinc-800 text-white shadow-md">
                                <tr>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase w-10">S.N</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase">Date</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase">Customer</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase landscape:hidden md:landscape:table-cell">Product Name</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-right landscape:hidden md:landscape:table-cell">Qty</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-right">Total</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : sales.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            No sales found.
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map((sale: any, index: number) => {
                                        const items = sale.items || []
                                        const totalQty = items.reduce((sum: number, i: any) => sum + i.qty, 0)
                                        const productNames = items.map((i: any) => i.product_name).join(', ')

                                        return (
                                            <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-2 py-1.5 text-[13px] text-gray-500">
                                                    {(page - 1) * 20 + index + 1}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px]">
                                                    {format(new Date(sale.sale_date), 'MMM d')}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px]">
                                                    <div className="max-w-[100px] truncate" title={sale.customer_name}>
                                                        {sale.customer_name}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] landscape:hidden md:landscape:table-cell">
                                                    <div className="max-w-[150px] truncate" title={productNames}>
                                                        {productNames || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-right landscape:hidden md:landscape:table-cell">
                                                    {totalQty}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-right font-medium">
                                                    {formatCurrency(sale.total_amount)}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-right">
                                                    <button
                                                        onClick={() => onViewSale && onViewSale(sale.id)}
                                                        className="px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800 transition-colors"
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="border-t dark:border-zinc-800 px-3 py-2">
                            <div className="flex items-center justify-center gap-1.5">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Previous
                                </button>
                                <span className="text-xs text-gray-500">
                                    Page {page} of {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                    disabled={page === pagination.totalPages}
                                    className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    )
}
