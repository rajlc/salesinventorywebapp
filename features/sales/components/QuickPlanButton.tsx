'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ProductSelectionModal } from './ProductSelectionModal'
import { AddPlanModal } from '@/features/purchase/components/daily-plan/AddPlanModal'
import { checkActiveProductPlan } from '@/features/purchase/actions/plan-actions'
import { toast } from 'sonner'

interface QuickPlanButtonProps {
    order: any
    stockInfo?: any
    allOrders?: any[]
    activePlanProductIds?: string[]
}

export function QuickPlanButton({ order, stockInfo, allOrders = [], activePlanProductIds = [] }: QuickPlanButtonProps) {
    const queryClient = useQueryClient()
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

    const handleProductSelect = async (productId: string, remarks?: string, quantity?: number, productName?: string) => {
        setShowProductSelection(false)

        if (!productId) {
            toast.error('Product not found in inventory', {
                description: 'Please add this product to inventory first.'
            })
            return
        }

        // Always verify against the database if client cache thinks it's active (or to catch expired/deleted plans)
        setIsChecking(true)
        try {
            const isActuallyActive = await checkActiveProductPlan(productId)
            if (isActuallyActive) {
                if (!activePlanProductIds.includes(productId)) {
                    queryClient.invalidateQueries({ queryKey: ['active-purchase-plans'] })
                }
                toast.error('Product Already in Purchase List', {
                    description: 'This product is already in the pending purchase list.'
                })
                return
            } else if (activePlanProductIds.includes(productId)) {
                // Stale or expired plan was in client cache — remove immediately and refresh
                queryClient.setQueryData<string[]>(['active-purchase-plans'], (old = []) =>
                    Array.isArray(old) ? old.filter(id => id !== productId) : []
                )
                queryClient.invalidateQueries({ queryKey: ['active-purchase-plans'] })
            }
        } catch (err) {
            console.error('Error verifying active product plan:', err)
        } finally {
            setIsChecking(false)
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

    // Check if any product (or its combo component) in this order is already in active plans
    const isPlanActive = order.items?.some((item: any) => {
        if (activePlanProductIds.includes(item.product_id)) return true
        const productStock = stockInfo?.products?.find((p: any) => p.product_id === item.product_id)
        const comboItems = productStock?.combo_items || item.combo_items
        if (Array.isArray(comboItems) && comboItems.length > 0) {
            return comboItems.some((c: any) => {
                const childObj = Array.isArray(c.child) ? c.child[0] : c.child
                const childId = childObj?.id || c.child_product_id
                return Boolean(childId && activePlanProductIds.includes(childId))
            })
        }
        return false
    })

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

                    // Get stock and pre-resolved combo info for this product from stockInfo or order item
                    const productStock = stockInfo?.products?.find((p: any) => p.product_id === item.product_id)
                    return {
                        product_id: item.product_id,
                        product_name: item.product_name || 'Unknown Product',
                        image_url: productStock?.image_url || item.image_url,
                        quantity: totalItemQty > 0 ? totalItemQty : item.quantity,
                        stock: productStock?.total_stock ?? productStock?.stock,
                        product_type: productStock?.product_type || item.product_type,
                        combo_items: productStock?.combo_items || item.combo_items
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
