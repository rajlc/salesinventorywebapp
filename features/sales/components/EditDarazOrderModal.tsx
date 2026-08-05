'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { updateDarazOrder } from '@/features/sales/actions/daraz-actions'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface EditDarazOrderModalProps {
    isOpen: boolean
    onClose: () => void
    orderId: string
    orderData: any
    onTriggerPartialReturn?: () => void
}

export function EditDarazOrderModal({ isOpen, onClose, orderId, orderData, onTriggerPartialReturn }: EditDarazOrderModalProps) {
    const queryClient = useQueryClient()
    const [isSaving, setIsSaving] = useState(false)

    // Editable fields
    const [orderNumber, setOrderNumber] = useState('')
    const [trackingNumber, setTrackingNumber] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [orderDate, setOrderDate] = useState('')
    const [orderStatus, setOrderStatus] = useState('')
    const [remarks, setRemarks] = useState('')

    const [items, setItems] = useState<any[]>([])

    // Populate form when modal opens
    useEffect(() => {
        if (isOpen && orderData) {
            setOrderNumber(orderData.order_number || '')
            setTrackingNumber(orderData.tracking_number || '')
            setCustomerName(orderData.customer_name || '')
            setOrderDate(orderData.order_date || '')
            setOrderStatus(orderData.order_status || '')
            setRemarks(orderData.remarks || '')
            // Initialize items
            setItems(orderData.items ? orderData.items.map((i: any) => ({ ...i })) : [])
        }
    }, [isOpen, orderData])

    // Handle Item Change
    const handleItemChange = (index: number, field: string, value: string | number) => {
        const newItems = [...items]
        newItems[index] = { ...newItems[index], [field]: value }
        setItems(newItems)
    }

    const hasChanges = () => {
        // Basic check for header changes
        if (orderNumber !== (orderData.order_number || '') ||
            trackingNumber !== (orderData.tracking_number || '') ||
            customerName !== (orderData.customer_name || '') ||
            orderDate !== (orderData.order_date || '') ||
            orderStatus !== (orderData.order_status || '') ||
            remarks !== (orderData.remarks || '')) return true

        // Item check (simple length or content check)
        // Deep compare is safer but JSON.stringify works for simple PoC
        return JSON.stringify(items) !== JSON.stringify(orderData.items)
    }

    const handleClose = () => {
        if (hasChanges()) {
            if (window.confirm('Are you sure to cancel?')) {
                onClose()
            }
        } else {
            onClose()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Intercept Partial Return
        if (orderStatus === 'Customer Return Delivered') {
            const currentTotalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
            if (currentTotalQty > 1 && onTriggerPartialReturn) {
                if (window.confirm('This is a multi-item order. Do you want to process a Partial Return?')) {
                    onTriggerPartialReturn()
                    return
                }
            }
        }

        try {
            setIsSaving(true)
            await updateDarazOrder(orderId, {
                order_number: orderNumber,
                tracking_number: trackingNumber,
                customer_name: customerName,
                order_date: orderDate,
                order_status: orderStatus,
                remarks: remarks,
                items: items.map(i => ({
                    seller_sku: i.seller_sku,
                    quantity: Number(i.quantity),
                    amount: Number(i.amount),
                    item_sequence: i.item_sequence || 1
                }))
            })

            toast.success('Update successfully')
            queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
            queryClient.invalidateQueries({ queryKey: ['all-daraz-orders'] })
            queryClient.invalidateQueries({ queryKey: ['daraz-order', orderId] })
            onClose()
        } catch (error: any) {
            toast.error(error.message || 'Failed to update order')
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-bold">Edit Order</h2>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <div className="space-y-6">
                        {/* Order Information Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Order Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Order Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={orderNumber}
                                        onChange={(e) => setOrderNumber(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Tracking Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={trackingNumber}
                                        onChange={(e) => setTrackingNumber(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Customer Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Order Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={orderDate}
                                        onChange={(e) => setOrderDate(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Status</label>
                                    <select
                                        value={orderStatus}
                                        onChange={(e) => setOrderStatus(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    >
                                        <option value="Unpaid">Unpaid</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Packed">Packed</option>
                                        <option value="Ready to Ship">Ready to Ship</option>
                                        <option value="Shipped">Shipped</option>
                                        <option value="Delivered">Delivered</option>
                                        <option value="Returning to Seller">Returning to Seller</option>
                                        <option value="Returned Delivered">Returned Delivered</option>
                                        <option value="Customer Return">Customer Return</option>
                                        <option value="Customer Return Delivered">Customer Return Delivered</option>
                                        <option value="Cancel">Cancel</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Remarks</label>
                                    <input
                                        type="text"
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        placeholder="Optional notes"
                                        className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Order Items Section */}
                        <div className="space-y-4 pt-4 border-t dark:border-zinc-700">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex justify-between">
                                Order Items
                                <span className="text-xs normal-case font-normal text-gray-400">(Auto-matched from SKU)</span>
                            </h3>

                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border dark:border-zinc-700">
                                        <div className="col-span-5">
                                            <label className="block text-xs text-gray-500 mb-1">Seller SKU</label>
                                            <input
                                                type="text"
                                                value={item.seller_sku}
                                                onChange={(e) => handleItemChange(index, 'seller_sku', e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs font-mono border dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                                                placeholder="Enter SKU..."
                                            />
                                            {item.product_name && <p className="text-[10px] text-gray-400 mt-1 truncate">{item.product_name}</p>}
                                        </div>
                                        <div className="col-span-3">
                                            <label className="block text-xs text-gray-500 mb-1">Price (Rs)</label>
                                            <input
                                                type="number"
                                                value={item.amount}
                                                onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs text-right border dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                                                min="0"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs text-gray-500 mb-1">Qty</label>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs text-center border dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                                                min="1"
                                            />
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <label className="block text-xs text-gray-500 mb-1">Total</label>
                                            <span className="text-xs font-medium block py-1.5">
                                                Rs. {(Number(item.quantity || 0) * Number(item.amount || 0)).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {items.length === 0 && (
                                    <p className="text-sm text-gray-500 italic text-center py-4">No items in this order.</p>
                                )}
                            </div>
                        </div>

                    </div>
                </form>

                {/* Footer */}
                <div className="border-t dark:border-zinc-700 p-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm border dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={16} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}
