'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWholesaleDashboardData } from '@/features/inventory/actions/wholesale-price-actions'
import { ArrowLeft, Search, X, Plus, Tag, ExternalLink, Box, TrendingDown, Package } from 'lucide-react'
import Link from 'next/link'
import { AddWholesalePriceModal } from '@/features/inventory/components/AddWholesalePriceModal'

/**
 * Wholesale Price Management Subpage
 */
export default function WholesalePricePage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [selectedProduct, setSelectedProduct] = useState<{ id: string, name: string } | null>(null)

    // Fetch products with their aggregated price data
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['wholesale-dashboard', page, search],
        queryFn: () => getWholesaleDashboardData({ page, search, limit: 50 }),
        placeholderData: (previousData) => previousData
    })

    const handleSearch = () => {
        setSearch(searchInput)
        setPage(1)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
    }

    return (
        <div className="flex flex-col h-full bg-gray-50/50 dark:bg-zinc-950">
            {/* Header - Modern & Responsive */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-b dark:border-zinc-800 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl">
                        <Tag className="text-indigo-600 dark:text-indigo-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black tracking-tight text-gray-900 dark:text-gray-100 uppercase">
                            Wholesale Pricing
                        </h1>
                        <p className="hidden md:block text-sm text-gray-500 dark:text-gray-400 mt-0.5 font-medium italic">Track & analyze market rates from multiple suppliers</p>
                    </div>
                </div>
                <Link
                    href="/dashboard/inventory"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all shadow-sm hover:shadow active:scale-95"
                >
                    <ArrowLeft size={16} />
                    Dashboard
                </Link>
            </div>

            {/* Action Bar - Floating Effect */}
            <div className="px-4 md:px-8 py-6">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border dark:border-zinc-800 shadow-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Search Field */}
                    <div className="w-full md:max-w-md relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search by product name..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-12 pr-12 py-3 text-sm bg-gray-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-all"
                        />
                        {searchInput && (
                            <button 
                                onClick={handleClearSearch} 
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full text-gray-400 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Stats Indicator */}
                    <div className="flex items-center gap-6 pr-2">
                        <div className="hidden lg:flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Box size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Total Products</p>
                                <p className="text-sm font-black text-gray-900 dark:text-gray-100">{data?.totalCount || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto px-4 md:px-8 pb-8">
                <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-gray-50/80 dark:bg-zinc-800/80 border-b border-gray-100 dark:border-zinc-800">
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Product Info</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Type</th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Last Best Price</th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Latest Source</th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/50">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                                <p className="text-sm font-bold text-gray-500 animate-pulse">Analyzing price data...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : data?.products.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Tag className="text-gray-200 dark:text-zinc-800" size={64} />
                                                <h3 className="text-lg font-bold text-gray-400">No products found</h3>
                                                <p className="text-sm text-gray-400">Try adjusting your search criteria</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    data?.products.map((product: any) => {
                                        const isCombo = product.product_type === 'combo';
                                        const isVariation = isCombo && product.product_combos?.[0]?.count === 1;
                                        
                                        return (
                                            <tr key={product.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-2 md:px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <Link 
                                                            href={`/dashboard/inventory/wholesale-price/${product.id}`}
                                                            className="text-sm font-medium text-gray-900 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors line-clamp-1"
                                                        >
                                                            {product.product_name}
                                                        </Link>
                                                        {product.seller_sku1 && (
                                                            <span className="text-[11px] text-gray-400 font-mono mt-0.5">
                                                                SKU: {product.seller_sku1}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="hidden md:table-cell px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-full border ${isCombo
                                                        ? (isVariation
                                                            ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30'
                                                            : 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30')
                                                        : 'bg-gray-50 text-gray-700 border-gray-100 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700'
                                                        }`}>
                                                        {isCombo ? <Package size={12} /> : <Box size={12} />}
                                                        {isCombo ? (isVariation ? 'Variation' : 'Combo') : 'Single'}
                                                    </span>
                                                </td>
                                                <td className="px-2 md:px-4 py-3">
                                                    {product.last_price ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                                                Rs {Number(product.last_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">No pricing</span>
                                                    )}
                                                </td>
                                                <td className="px-2 md:px-4 py-3">
                                                    {product.last_supplier ? (
                                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 line-clamp-1">
                                                            {product.last_supplier}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">-</span>
                                                    )}
                                                </td>
                                                <td className="px-2 md:px-4 py-3 text-right">
                                                    {!isCombo && (
                                                        <button
                                                            onClick={() => setSelectedProduct({ id: product.id, name: product.product_name })}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all active:scale-[0.98]"
                                                        >
                                                            <Plus size={14} />
                                                            Add Price
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination - Sleek Footer */}
                    {data && data.totalPages > 1 && (
                        <div className="px-6 py-4 bg-gray-50/50 dark:bg-zinc-800/30 border-t dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                PAGE {page} OF {data.totalPages} <span className="mx-2">•</span> {data.totalCount} ENTRIES
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 text-xs font-bold border dark:border-zinc-700 rounded-xl disabled:opacity-30 hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                                >
                                    PREVIOUS
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                                    disabled={page === data.totalPages}
                                    className="px-4 py-2 text-xs font-bold border dark:border-zinc-700 rounded-xl disabled:opacity-30 hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                                >
                                    NEXT
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Price Input Modal */}
            <AddWholesalePriceModal
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                productId={selectedProduct?.id || ''}
                productName={selectedProduct?.name || ''}
                onSuccess={() => refetch()}
            />
        </div>
    )
}
