'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ProductSelectionModal } from './ProductSelectionModal'
import { AddPlanModal } from '@/features/purchase/components/daily-plan/AddPlanModal'
import { toast } from 'sonner'

interface QuickPlanButtonProps {
    order: any
    stockInfo?: any
    allOrders?: any[]
    activePlanProductIds?: string[]
}

export function QuickPlanButton({ order, stockInfo, allOrders = [], activePlanProductIds = [] }: QuickPlanButtonProps) {
    const [showProductSelection, setShowProductSelection] = useState(false)
    const [showPlanModal, setShowPlanModal] = useState(false)
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
    const [selectedProductName, setSelectedProductName] = useState<string>('')
    const [selectedProductRemarks, setSelectedProductRemarks] = useState<string>('')
    const [prefilledQuantity, setPrefilledQuantity] = useState<number>(1)
    const [isChecking, setIsChecking] = useState(false)

    // Don't show button for "Shipped" orders
    const orderStatus = order.order_status?.toLowerCase()
    if (orderStatus === 'shipped') {
        return null
    }

    // Get order items from the order object
    const orderItems = order.items || []

    if (orderItems.length === 0) {
        return null // No products in order
    }

    const handleClick = () => {
        // Open selection modal immediately
        setShowProductSelection(true)
    }

    const handleProductSelect = (productId: string, remarks?: string, quantity?: number, productName?: string) => {
        setShowProductSelection(false)

        if (!productId) {
            toast.error('Product not found in inventory', {
                description: 'Please add this product to inventory first.'
            })
            return
        }

        // Fast check against activePlanProductIds in memory
        if (activePlanProductIds.includes(productId)) {
            toast.error('Product Already in Purchase List', {
                description: 'This product is already in the pending purchase list.'
            })
            return
        }

        // If a precalculated quantity is provided, use it.
        // Otherwise fallback to local calculation or 1.
        let finalQty = quantity || 0
        if (!finalQty && allOrders.length > 0) {
            const targetStatuses = ['pending', 'packed', 'ready to ship']
            const matchingOrders = allOrders.filter(o => targetStatuses.includes(o.order_status?.toLowerCase()))

            matchingOrders.forEach(o => {
                const item = o.items?.find((i: any) => i.product_id === productId)
                if (item) {
                    finalQty += (item.quantity || 0)
                }
            })
        }

        setPrefilledQuantity(finalQty > 0 ? finalQty : 1)

        setSelectedProductId(productId)
        if (productName) setSelectedProductName(productName)
        if (remarks) setSelectedProductRemarks(remarks)
        setShowPlanModal(true)
    }

    const handlePlanSuccess = () => {
        setShowPlanModal(false)
        setSelectedProductId(null)
        setSelectedProductName('')
        setSelectedProductRemarks('')
    }

    // Check if any product in this order is already in active plans
    // order.items contains { product_id }
    const isPlanActive = order.items?.some((item: any) => activePlanProductIds.includes(item.product_id))

    const buttonClass = isPlanActive
        ? "flex items-center gap-0.5 px-1 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 rounded disabled:opacity-50 transition-colors" // Active (Plan Exists) - Light Blue
        : "flex items-center gap-0.5 px-1 py-0.5 text-[11px] font-medium bg-transparent text-black dark:text-gray-200 border border-transparent hover:bg-gray-100 dark:hover:bg-zinc-800 rounded disabled:opacity-50 transition-colors" // Default - Text Only (Black)

    return (
        <>
            <button
                onClick={handleClick}
                disabled={isChecking}
                className={buttonClass}
                title={isPlanActive ? "View/Add Plan (Already in List)" : "Quick Purchase Plan"}
            >
                <Plus size={12} />
                Add
            </button>

            {/* Product Selection Modal for multi-product orders */}
            <ProductSelectionModal
                isOpen={showProductSelection}
                onClose={() => setShowProductSelection(false)}
                products={orderItems.map((item: any) => {
                    // Calculate total quantity for this product across all active orders
                    let totalItemQty = 0
                    if (allOrders.length > 0) {
                        const targetStatuses = ['pending', 'packed', 'ready to ship']
                        const matchingOrders = allOrders.filter(o => targetStatuses.includes(o.order_status?.toLowerCase()))

                        matchingOrders.forEach(o => {
                            const matchData = o.items?.find((i: any) => i.product_id === item.product_id)
                            if (matchData) {
                                totalItemQty += (matchData.quantity || 0)
                            }
                        })
                    }

                    // Get stock for this product from stockInfo
                    const productStock = stockInfo?.products?.find((p: any) => p.product_id === item.product_id)
                    return {
                        product_id: item.product_id,
                        product_name: item.product_name || 'Unknown Product',
                        image_url: productStock?.image_url || item.image_url,
                        quantity: totalItemQty > 0 ? totalItemQty : item.quantity,
                        stock: productStock?.total_stock ?? productStock?.stock ?? 0
                    }
                })}
                stockBreakdown={stockInfo?.products}
                onProductSelect={handleProductSelect}
            />

            {/* Plan Modal */}
            {selectedProductId && (
                <AddPlanModal
                    trigger={null}
                    onPlanAdded={() => { }}
                    prefilledProductId={selectedProductId}
                    prefilledProductName={selectedProductName}
                    prefilledQuantity={prefilledQuantity}
                    prefilledRemarks={selectedProductRemarks}
                    onSuccess={handlePlanSuccess}
                    isOpen={showPlanModal}
                    onClose={() => {
                        setShowPlanModal(false)
                        setSelectedProductId(null)
                        setSelectedProductName('')
                    }}
                />
            )}
        </>
    )
}
