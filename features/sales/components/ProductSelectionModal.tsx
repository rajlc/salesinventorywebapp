'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRight, Package } from 'lucide-react'
import { getResolvedProductsByIds } from '@/features/inventory/actions/product-actions'
import { getProductsStock } from '@/features/sales/actions/get-order-stock-info'

interface ProductSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    products: Array<{
        product_id: string
        product_name: string
        image_url?: string | null
        quantity?: number
        stock?: number
    }>
    stockBreakdown?: any[] // List of products with stock details from getOrdersStockInfo
    onProductSelect: (productId: string, remarks?: string, quantity?: number) => void
}

export function ProductSelectionModal({ isOpen, onClose, products, stockBreakdown, onProductSelect }: ProductSelectionModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [resolvedItems, setResolvedItems] = useState<any[]>([])
    const [zoomedImage, setZoomedImage] = useState<string | null>(null)
    const [stockMap, setStockMap] = useState<Record<string, number>>({})

    useEffect(() => {
        if (isOpen && products.length > 0) {
            setResolvedItems([])
            // Reset stock map for new selection
            // We can keep old stocks cached but better to refresh
            setStockMap({})
            fetchResolvedProducts()
        }
    }, [isOpen, products])

    const fetchResolvedProducts = async () => {
        setIsLoading(true)
        try {
            const ids = products.map(p => p.product_id).filter(Boolean)
            const resolvedData = await getResolvedProductsByIds(ids)

            // Extract all component IDs for stock fetching
            const componentIds = new Set<string>()
            resolvedData.forEach((r: any) => {
                if (r.product_type === 'combo' && r.combo_items) {
                    r.combo_items.forEach((c: any) => {
                        if (c.child?.id) componentIds.add(c.child.id)
                    })
                } else {
                    if (r.id) componentIds.add(r.id)
                }
            })

            // Fetch stock for all components
            if (componentIds.size > 0) {
                try {
                    const stocks = await getProductsStock(Array.from(componentIds))
                    setStockMap(stocks)
                } catch (err) {
                    console.error("Failed to fetch component stocks", err)
                }
            }

            // Map original order items to resolved structure
            const mapped = products.map(orderItem => {
                const resolved = resolvedData.find((r: any) => r.id === orderItem.product_id)
                return {
                    orderItem,
                    resolved
                }
            })
            setResolvedItems(mapped)
        } catch (error) {
            console.error('Failed to resolve products:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const getStock = (productId: string) => {
        // First check our fetched stock map (most accurate for components)
        if (stockMap[productId] !== undefined) {
            return stockMap[productId]
        }
        // Fallback to passed prop (rarely useful for combos, but good for simple products)
        const found = stockBreakdown?.find((s: any) => s.product_id === productId)
        return found?.total_stock ?? 'N/A'
    }

    const getStockColor = (stock: any) => {
        if (typeof stock !== 'number') return 'text-gray-500 dark:text-gray-400'
        if (stock > 10) return 'text-green-600 dark:text-green-400'
        if (stock > 0) return 'text-yellow-600 dark:text-yellow-400'
        return 'text-red-600 dark:text-red-400'
    }

    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50" onClick={onClose} />
                <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border dark:border-zinc-800 animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select Product to Plan</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Choose which component to add to the daily plan.
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-0 divide-y divide-gray-100 dark:divide-zinc-800">
                            {/* Header Row */}
                            <div className="grid grid-cols-12 gap-4 pb-3 px-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                                <div className="col-span-4">Order Details</div>
                                <div className="col-span-8">Inventory Components</div>
                            </div>

                            {products.map((orderItem, idx) => {
                                // Find resolved data corresponding to this order item
                                // We match by product_id
                                const resolvedEntry = resolvedItems.find((r: any) => r.orderItem.product_id === orderItem.product_id)
                                const resolved = resolvedEntry?.resolved

                                // Determine components to show on right side
                                let rightComponents: any[] = []
                                let isCombo = false
                                const isItemLoaded = !!resolved || (!isLoading && resolvedItems.length > 0) // If not loading and has items (or just resolved exists)

                                if (resolved) {
                                    if (resolved.product_type === 'combo' && resolved.combo_items?.length > 0) {
                                        isCombo = true
                                        rightComponents = resolved.combo_items.map((c: any) => ({
                                            id: c.child.id,
                                            name: c.child.product_name,
                                            image: c.child.image_url,
                                            qty: c.quantity,
                                            isComboChild: true
                                        }))
                                    } else {
                                        // Single product or unresolved type
                                        rightComponents = [{
                                            id: resolved.id,
                                            name: resolved.product_name,
                                            image: resolved.image_url,
                                            qty: 1,
                                            isComboChild: false
                                        }]
                                    }
                                }

                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-4 py-6 px-2 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors rounded-lg">
                                        {/* LEFT COLUMN: Order Product Name & Image */}
                                        <div className="col-span-4 flex flex-col gap-3 border-r dark:border-zinc-800 pr-4">
                                            {/* Product Image */}
                                            <div
                                                className="relative w-full aspect-square md:aspect-video bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border dark:border-zinc-700 cursor-zoom-in group"
                                                onClick={(e) => {
                                                    if (orderItem.image_url) {
                                                        e.stopPropagation()
                                                        setZoomedImage(orderItem.image_url)
                                                    }
                                                }}
                                            >
                                                {orderItem.image_url ? (
                                                    <img
                                                        src={orderItem.image_url}
                                                        alt={orderItem.product_name}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                        <Package size={24} strokeWidth={1} />
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white text-[15px] leading-snug">
                                                    {orderItem.product_name}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Qty in Order: <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{orderItem.quantity}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* RIGHT COLUMN: Components List */}
                                        <div className="col-span-8 flex flex-col gap-2 pl-2">
                                            {isLoading && !resolved ? (
                                                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Resolving components...</span>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {rightComponents.map((comp, cIdx) => {
                                                        const stock = getStock(comp.id)
                                                        return (
                                                            <button
                                                                key={cIdx}
                                                                onClick={() => {
                                                                    // Only pass remarks if it's a combo child. 
                                                                    // If single product (isCombo=false), pass undefined so remarks stay empty.
                                                                    const remarks = isCombo ? orderItem.product_name : undefined
                                                                    onProductSelect(comp.id, remarks, (orderItem.quantity || 1) * comp.qty)
                                                                }}
                                                                className="group relative flex flex-col items-start p-3 text-left border dark:border-zinc-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all active:scale-[0.98] bg-white dark:bg-zinc-800 shadow-sm"
                                                            >
                                                                <div className="flex items-start justify-between w-full mb-2">
                                                                    <div className="p-1.5 bg-gray-100 dark:bg-zinc-700/50 rounded-lg group-hover:bg-white dark:group-hover:bg-zinc-700 transition-colors">
                                                                        <Package className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                                                    </div>
                                                                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-100 dark:border-zinc-600 ${getStockColor(stock)}`}>
                                                                        Stock: {stock}
                                                                    </div>
                                                                </div>

                                                                <div className="font-medium text-[13px] text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-300 mb-1">
                                                                    {comp.name}
                                                                </div>

                                                                {comp.isComboChild && (
                                                                    <div className="text-[11px] text-gray-500">
                                                                        Qty per Bundle: <span className="font-mono">{comp.qty}</span>
                                                                    </div>
                                                                )}

                                                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">
                                                                    <ArrowRight size={14} />
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border dark:border-zinc-600 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>

            {/* Zoomed Image Overlay */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-zoom-out"
                    onClick={() => setZoomedImage(null)}
                >
                    <img
                        src={zoomedImage}
                        alt="Zoomed product"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 rounded-full p-2 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>
            )}
        </>
    )
}
