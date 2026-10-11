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
    onProductSelect: (productId: string, remarks?: string, quantity?: number, productName?: string) => void
}

// Module-level caches for instant 0ms retrieval across modal opens
const resolvedProductsCache = new Map<string, any>()
const componentsStockCache = new Map<string, number>()

export function ProductSelectionModal({ isOpen, onClose, products, stockBreakdown, onProductSelect }: ProductSelectionModalProps) {
    const [resolvedItems, setResolvedItems] = useState<any[]>([])
    const [zoomedImage, setZoomedImage] = useState<string | null>(null)
    const [stockMap, setStockMap] = useState<Record<string, number>>({})

    useEffect(() => {
        if (!isOpen || products.length === 0) return

        // 1. Immediately seed stockMap from caches or props so stocks appear with 0ms delay
        const initialStock: Record<string, number> = {}
        products.forEach(p => {
            if (componentsStockCache.has(p.product_id)) {
                initialStock[p.product_id] = componentsStockCache.get(p.product_id)!
            } else {
                const found = stockBreakdown?.find((s: any) => s.product_id === p.product_id)
                if (found?.total_stock !== undefined) {
                    initialStock[p.product_id] = found.total_stock
                } else if (typeof p.stock === 'number') {
                    initialStock[p.product_id] = p.stock
                }
            }
        })
        setStockMap(initialStock)

        // 2. Immediately map order items to resolved representation (from cache or immediate fallback)
        // This ensures the modal renders immediately without waiting for any server network roundtrip!
        const initialMapped = products.map(orderItem => {
            const cached = resolvedProductsCache.get(orderItem.product_id)
            if (cached) {
                return { orderItem, resolved: cached }
            }
            return {
                orderItem,
                resolved: {
                    id: orderItem.product_id,
                    product_name: orderItem.product_name,
                    image_url: orderItem.image_url,
                    product_type: 'single'
                }
            }
        })
        setResolvedItems(initialMapped)

        // 3. Resolve full combo/component breakdown in the background if not cached yet
        fetchResolvedProducts()
    }, [isOpen, products, stockBreakdown])

    const fetchResolvedProducts = async () => {
        try {
            const ids = products.map(p => p.product_id).filter(Boolean)
            if (ids.length === 0) return

            // Check if any id is not in cache yet
            const missingIds = ids.filter(id => !resolvedProductsCache.has(id))
            let resolvedData: any[] = []

            if (missingIds.length > 0) {
                const fetched = await getResolvedProductsByIds(missingIds)
                fetched.forEach((r: any) => {
                    if (r?.id) resolvedProductsCache.set(r.id, r)
                })
            }

            resolvedData = ids.map(id => resolvedProductsCache.get(id)).filter(Boolean)

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

            // Fetch stock for any component IDs not already in stock cache
            const missingStockIds = Array.from(componentIds).filter(id => !componentsStockCache.has(id))
            if (missingStockIds.length > 0) {
                try {
                    const stocks = await getProductsStock(missingStockIds)
                    Object.entries(stocks).forEach(([k, v]) => {
                        componentsStockCache.set(k, v)
                    })
                    setStockMap(prev => ({ ...prev, ...stocks }))
                } catch (err) {
                    console.error("Failed to fetch component stocks", err)
                }
            } else if (componentIds.size > 0) {
                const cachedStocks: Record<string, number> = {}
                componentIds.forEach(id => {
                    if (componentsStockCache.has(id)) {
                        cachedStocks[id] = componentsStockCache.get(id)!
                    }
                })
                setStockMap(prev => ({ ...prev, ...cachedStocks }))
            }

            // Map original order items to resolved structure
            const mapped = products.map(orderItem => {
                const resolved = resolvedProductsCache.get(orderItem.product_id)
                return {
                    orderItem,
                    resolved: resolved || {
                        id: orderItem.product_id,
                        product_name: orderItem.product_name,
                        image_url: orderItem.image_url,
                        product_type: 'single'
                    }
                }
            })
            setResolvedItems(mapped)
        } catch (error) {
            console.error('Failed to resolve products:', error)
        }
    }

    const getStock = (productId: string) => {
        if (stockMap[productId] !== undefined) {
            return stockMap[productId]
        }
        if (componentsStockCache.has(productId)) {
            return componentsStockCache.get(productId)!
        }
        const found = stockBreakdown?.find((s: any) => s.product_id === productId)
        if (found?.total_stock !== undefined) {
            return found.total_stock
        }
        const prod = products.find(p => p.product_id === productId)
        if (prod?.stock !== undefined) {
            return prod.stock
        }
        return 'N/A'
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
                                const resolvedEntry = resolvedItems.find((r: any) => r.orderItem.product_id === orderItem.product_id)
                                const resolved = resolvedEntry?.resolved

                                let rightComponents: any[] = []
                                let isCombo = false

                                if (resolved) {
                                    if (resolved.product_type === 'combo' && resolved.combo_items?.length > 0) {
                                        isCombo = true
                                        rightComponents = resolved.combo_items.map((c: any) => ({
                                            id: c.child?.id || c.child_product_id,
                                            name: c.child?.product_name || orderItem.product_name,
                                            image: c.child?.image_url,
                                            qty: c.quantity || 1,
                                            isComboChild: true
                                        }))
                                    } else {
                                        rightComponents = [{
                                            id: resolved.id || orderItem.product_id,
                                            name: resolved.product_name || orderItem.product_name,
                                            image: resolved.image_url || orderItem.image_url,
                                            qty: 1,
                                            isComboChild: false
                                        }]
                                    }
                                } else {
                                    // Immediate fallback so there's never an empty delay
                                    rightComponents = [{
                                        id: orderItem.product_id,
                                        name: orderItem.product_name,
                                        image: orderItem.image_url,
                                        qty: 1,
                                        isComboChild: false
                                    }]
                                }

                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-4 py-6 px-2 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors rounded-lg">
                                        {/* LEFT COLUMN: Order Product Name & Image */}
                                        <div className="col-span-4 flex flex-col gap-3 border-r dark:border-zinc-800 pr-4 min-w-0">
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

                                            <div className="min-w-0">
                                                <div className="font-semibold text-gray-900 dark:text-white text-[14px] leading-snug break-words">
                                                    {orderItem.product_name}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    Qty in Order: <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{orderItem.quantity}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* RIGHT COLUMN: Components List */}
                                        <div className="col-span-8 flex flex-col gap-2 pl-2 min-w-0">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                                {rightComponents.map((comp, cIdx) => {
                                                    const stock = getStock(comp.id)
                                                    return (
                                                        <div
                                                            key={cIdx}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => {
                                                                const remarks = isCombo ? orderItem.product_name : undefined
                                                                onProductSelect(comp.id, remarks, (orderItem.quantity || 1) * comp.qty, comp.name)
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault()
                                                                    const remarks = isCombo ? orderItem.product_name : undefined
                                                                    onProductSelect(comp.id, remarks, (orderItem.quantity || 1) * comp.qty, comp.name)
                                                                }
                                                            }}
                                                            className="group relative w-full min-w-0 flex flex-col justify-between p-3.5 text-left border border-gray-200 dark:border-zinc-700 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/15 transition-all cursor-pointer active:scale-[0.98] bg-white dark:bg-zinc-800 shadow-sm overflow-hidden"
                                                        >
                                                            {/* Top Row: Icon + Stock Badge */}
                                                            <div className="flex items-center justify-between w-full min-w-0 mb-2.5">
                                                                <div className="p-1.5 bg-gray-100 dark:bg-zinc-700/60 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                                                                    <Package className="w-4 h-4" />
                                                                </div>
                                                                <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full border border-gray-100 dark:border-zinc-600 bg-gray-50/80 dark:bg-zinc-800/80 ${getStockColor(stock)}`}>
                                                                    Stock: {stock}
                                                                </div>
                                                            </div>

                                                            {/* Middle: Product Title & Combo Details */}
                                                            <div className="w-full min-w-0 flex-1 flex flex-col justify-start">
                                                                <div
                                                                    className="font-semibold text-[13px] leading-snug text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 break-words line-clamp-2 transition-colors"
                                                                    title={comp.name}
                                                                >
                                                                    {comp.name}
                                                                </div>

                                                                {comp.isComboChild && (
                                                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                                                        Qty per Bundle: <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{comp.qty}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Bottom Row: In-card Action Footer */}
                                                            <div className="flex items-center justify-between w-full min-w-0 mt-3 pt-2 border-t border-gray-100 dark:border-zinc-700/60 text-[11px] text-gray-400 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                <span className="font-medium">Add to plan</span>
                                                                <ArrowRight size={13} className="transform group-hover:translate-x-1 transition-transform" />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
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
