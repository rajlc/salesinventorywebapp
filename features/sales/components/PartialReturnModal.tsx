'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { processPartialReturn, PartialReturnItem } from '@/features/sales/actions/partial-return-actions'
import { getDarazOrderById } from '@/features/sales/actions/daraz-actions'

interface PartialReturnModalProps {
    order: any
    isOpen: boolean
    onClose: () => void
}

export function PartialReturnModal({ order: initialOrder, isOpen, onClose }: PartialReturnModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [order, setOrder] = useState<any>(null)
    const [returnItems, setReturnItems] = useState<Record<string, { qty: number, status: string }>>({})

    // Fetch full order details when modal opens to ensure we have items
    useEffect(() => {
        if (isOpen && initialOrder?.id) {
            setIsLoading(true)
            getDarazOrderById(initialOrder.id)
                .then(data => {
                    setOrder(data)
                })
                .catch(err => {
                    toast.error('Failed to load order details')
                    onClose()
                })
                .finally(() => setIsLoading(false))
        }
    }, [isOpen, initialOrder])

    if (!isOpen || !initialOrder) return null

    // Use fetched order if available, otherwise fallback to empty items (which will show loading)
    const currentOrder = order || initialOrder

    // Filter out items that are already fully returned or cancelled if needed
    const validItems = currentOrder.items?.filter((item: any) =>
        !['cancel', 'cancelled', 'unpaid'].includes((item.status || '').toLowerCase())
    ) || []

    const handleQtyChange = (itemId: string, qty: string) => {
        const val = parseInt(qty)
        if (isNaN(val) || val < 0) return

        setReturnItems(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                qty: val,
                status: prev[itemId]?.status || 'Customer Return Delivered'
            }
        }))
    }

    const handleStatusChange = (itemId: string, status: string) => {
        setReturnItems(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                qty: prev[itemId]?.qty || 0,
                status: status
            }
        }))
    }

    const handleSubmit = async () => {
        const itemsToProcess: PartialReturnItem[] = []

        validItems.forEach((item: any) => {
            const entry = returnItems[item.id]
            if (entry && entry.qty > 0) {
                itemsToProcess.push({
                    itemId: item.id,
                    currentQty: item.quantity,
                    returnQty: entry.qty,
                    sku: item.seller_sku,
                    status: entry.status === 'Customer Return Delivered' ? 'returned' : entry.status
                })
            }
        })

        if (itemsToProcess.length === 0) {
            toast.error('Please select at least one item to return')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await processPartialReturn(order.order_id, itemsToProcess)
            if (result.success) {
                toast.success('Partial return processed successfully')
                onClose()
            } else {
                toast.error('Failed to process return', { description: result.error })
            }
        } catch (error: any) {
            toast.error('An error occurred', { description: error.message })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-bold">Partial Return - {currentOrder.order_number}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-130px)]">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="animate-spin text-gray-400" size={32} />
                        </div>
                    ) : (
                        <div className="border dark:border-zinc-700 rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-zinc-800 border-b dark:border-zinc-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-gray-500">Item</th>
                                        <th className="px-4 py-2 text-center font-medium text-gray-500">Current Qty</th>
                                        <th className="px-4 py-2 text-center font-medium text-gray-500">Current Status</th>
                                        <th className="px-4 py-2 text-center font-medium text-gray-500">Return Qty</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-500">Return Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-zinc-700">
                                    {validItems.map((item: any) => {
                                        const entry = returnItems[item.id] || { qty: 0, status: 'Customer Return Delivered' }
                                        const maxQty = item.quantity

                                        return (
                                            <tr key={item.id} className="bg-white dark:bg-zinc-900">
                                                <td className="px-4 py-2">
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{item.product_name}</div>
                                                    <div className="text-xs text-gray-500">{item.seller_sku}</div>
                                                </td>
                                                <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${(item.item_status || currentOrder.order_status || '').toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' :
                                                        ['shipped', 'ready to ship', 'packed', 'ready_to_ship'].includes((item.item_status || currentOrder.order_status || '').toLowerCase()) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' :
                                                            ['delivered', 'completed'].includes((item.item_status || currentOrder.order_status || '').toLowerCase()) ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' :
                                                                ['cancelled', 'cancel'].includes((item.item_status || currentOrder.order_status || '').toLowerCase()) ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' :
                                                                    ['returning to seller', 'customer return', 'returned'].includes((item.item_status || currentOrder.order_status || '').toLowerCase()) ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' :
                                                                        ['returned delivered', 'customer return delivered', 'returned_delivered'].includes((item.item_status || currentOrder.order_status || '').toLowerCase()) ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200' :
                                                                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                                                        }`}>
                                                        {item.item_status || currentOrder.order_status || 'Default'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={maxQty}
                                                        value={entry.qty}
                                                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                                        className="w-20 h-8 text-center border dark:border-zinc-700 rounded dark:bg-zinc-800 mx-auto"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <select
                                                        value={entry.status}
                                                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                        className="h-8 w-48 px-2 text-xs border dark:border-zinc-700 rounded dark:bg-zinc-800"
                                                    >
                                                        <option value="Customer Return Delivered">Customer Return Delivered</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-zinc-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm border dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded disabled:opacity-50"
                    >
                        {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                        Confirm Return
                    </button>
                </div>
            </div>
        </div>
    )
}
