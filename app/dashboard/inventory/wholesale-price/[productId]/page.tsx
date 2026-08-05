'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { getProductById } from '@/features/inventory/actions/product-actions'
import { getWholesalePricesByProductId, getProductPurchasingDetails } from '@/features/inventory/actions/wholesale-price-actions'
import { ArrowLeft, Tag, ShoppingCart, Package, TrendingDown, Clock, Building2, Wallet, Info } from 'lucide-react'

/**
 * Product-specific Wholesale & Purchase Details Page
 */
export default function WholesalePriceDetailsPage() {
    const params = useParams()
    const productId = params.productId as string
    const router = useRouter()

    // 1. Fetch Basic Product Data
    const { data: product, isLoading: loadingProduct } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => getProductById(productId)
    })

    // 2. Fetch Manually Saved Wholesale History
    const { data: wholesaleHistory, isLoading: loadingWholesale } = useQuery({
        queryKey: ['wholesale-history', productId],
        queryFn: () => getWholesalePricesByProductId(productId)
    })

    // 3. Fetch Actual Purchase History (Deduplicated by Supplier)
    const { data: purchaseHistory, isLoading: loadingPurchase } = useQuery({
        queryKey: ['purchase-history', productId],
        queryFn: () => getProductPurchasingDetails(productId)
    })

    const isLoading = loadingProduct || loadingWholesale || loadingPurchase

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-zinc-950 gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
                <p className="text-sm font-black text-indigo-600/60 dark:text-indigo-400/60 animate-pulse tracking-widest uppercase">Fetching Market Intel...</p>
            </div>
        )
    }

    // Calculate Best Price (Lowest overall)
    const allPrices = [
        ...(wholesaleHistory?.map(h => Number(h.wholesale_price)) || []),
        ...(purchaseHistory?.map(p => Number(p.unit_amount)) || [])
    ]
    const bestPrice = allPrices.length > 0 ? Math.min(...allPrices) : null

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-zinc-950 pb-12">
            {/* Contextual Header */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-b dark:border-zinc-800 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-5">
                    <button 
                        onClick={() => router.back()} 
                        className="p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-all active:scale-90 border dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm"
                    >
                        <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase truncate max-w-[200px] md:max-w-md">
                            {product?.product_name || 'Product Details'}
                        </h1>
                        <p className="text-[11px] font-medium text-gray-400 font-mono mt-0.5 uppercase tracking-wider">
                            ID: #{product?.product_id}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
                {/* Metric Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border dark:border-zinc-800 shadow-sm flex items-center gap-3 group hover:border-blue-500/50 transition-colors">
                        <div className="p-2.5 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400">
                            <Package size={20} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">Type</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 capitalize">{product?.product_type || 'Single Item'}</p>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border dark:border-zinc-800 shadow-sm flex items-center gap-3 group hover:border-indigo-500/50 transition-colors">
                        <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                             <Tag size={20} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">SKU</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono">{product?.seller_sku1 || 'UNSET'}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border dark:border-zinc-800 shadow-sm flex items-center gap-3 group hover:border-green-500/50 transition-colors">
                        <div className="p-2.5 bg-green-500/10 dark:bg-green-500/20 rounded-lg text-green-600 dark:text-green-400">
                             <TrendingDown size={20} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">Best Price</p>
                            <p className="text-base font-bold text-green-600 dark:text-green-400">
                                {bestPrice !== null ? `Rs ${bestPrice.toLocaleString()}` : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Section 1: Saved Wholesale Prices */}
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 dark:bg-purple-500/20 rounded-xl text-purple-600 dark:text-purple-400">
                                    <Clock size={18} />
                                </div>
                                <h2 className="text-lg font-black uppercase tracking-tight">Price Monitoring History</h2>
                            </div>
                        </div>
                        
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 shadow-sm overflow-hidden min-h-[250px]">
                            {wholesaleHistory?.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-3">
                                    <Tag size={32} className="opacity-20" />
                                    <p className="text-sm font-medium opacity-50">No wholesale records</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50/80 dark:bg-zinc-800/80 border-b dark:border-zinc-800">
                                            <tr>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">Supplier</th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-black dark:text-white text-right">Price Point</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-zinc-800/50">
                                            {wholesaleHistory?.map((entry: any) => (
                                                <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{entry.supplier_name}</span>
                                                            <span className="text-[11px] text-gray-400">{new Date(entry.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                                            Rs {Number(entry.wholesale_price).toLocaleString()}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 2: Actual Purchase Rates */}
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400">
                                <ShoppingCart size={18} />
                            </div>
                            <h2 className="text-lg font-black uppercase tracking-tight">Recent Purchase Intelligence</h2>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 shadow-sm overflow-hidden min-h-[250px]">
                             {purchaseHistory?.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-3">
                                    <ShoppingCart size={32} className="opacity-20" />
                                    <p className="text-sm font-medium opacity-50">No purchase history</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50/80 dark:bg-zinc-800/80 border-b dark:border-zinc-800">
                                            <tr>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">Source Entity</th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-black dark:text-white text-right">Execution Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-zinc-800/50">
                                            {purchaseHistory?.map((entry: any) => (
                                                <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{entry.supplier_name}</span>
                                                            <span className="text-[11px] text-gray-400">Last: {new Date(entry.purchase_date).toLocaleDateString()}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                                            Rs {Number(entry.unit_amount).toLocaleString()}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info Note */}
                <div className="bg-blue-600/5 dark:bg-blue-500/5 border border-blue-600/10 dark:border-blue-500/20 p-6 rounded-3xl flex gap-4 items-start">
                    <Info className="text-blue-600 dark:text-blue-400 shrink-0 mt-1" size={20} />
                    <div>
                        <h4 className="text-sm font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest mb-1">Price Discovery Methodology</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                            The procurement intelligence system combines manually tracked wholesale offers with actual purchase execution data. Suppliers are automatically de-duplicated to show only their most recent market activity for this specific asset.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
