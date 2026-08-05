'use client'

import { useState } from 'react'
import { X, Plus, Package, User, FileText, Trash2 } from 'lucide-react'
import { createDarazOrder } from '@/features/sales/actions/daraz-actions'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface AddDarazOrderModalProps {
    isOpen: boolean
    onClose: () => void
}

interface OrderItem {
    seller_sku: string
    seller_account: string
    product_name: string
    quantity: number
    amount: number
    total_amount: number
}

export function AddDarazOrderModal({ isOpen, onClose }: AddDarazOrderModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const queryClient = useQueryClient()

    // Order fields
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
    const [orderNumber, setOrderNumber] = useState('')
    const [trackingNumber, setTrackingNumber] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [orderStatus, setOrderStatus] = useState('Pending')
    const [remarks, setRemarks] = useState('')

    // Products
    const [products, setProducts] = useState<OrderItem[]>([{
        seller_sku: '',
        seller_account: '',
        product_name: '',
        quantity: 1,
        amount: 0,
        total_amount: 0
    }])

    // Check if user has entered any data
    const hasUnsavedChanges = () => {
        return orderNumber !== '' ||
            trackingNumber !== '' ||
            customerName !== '' ||
            remarks !== '' ||
            products.some(p => p.seller_sku !== '' || p.amount !== 0 || p.quantity !== 1)
    }

    const handleClose = () => {
        if (hasUnsavedChanges()) {
            if (window.confirm('Are you sure to cancel?')) {
                onClose()
            }
        } else {
            onClose()
        }
    }

    if (!isOpen) return null

    const handleAddProduct = () => {
        setProducts([...products, {
            seller_sku: '',
            seller_account: '',
            product_name: '',
            quantity: 1,
            amount: 0,
            total_amount: 0
        }])
    }

    const handleRemoveProduct = (index: number) => {
        if (products.length === 1) {
            toast.error('At least one product is required')
            return
        }
        setProducts(products.filter((_, i) => i !== index))
    }

    const handleProductChange = (index: number, field: string, value: any) => {
        const updated = [...products]
        updated[index] = { ...updated[index], [field]: value }

        // Auto-calculate total_amount
        if (field === 'quantity' || field === 'amount') {
            updated[index].total_amount = updated[index].quantity * updated[index].amount
        }

        setProducts(updated)
    }

    // Auto-match SKU to product
    const handleSKUBlur = async (index: number, sku: string) => {
        if (!sku.trim()) return

        // Call backend to find matching product
        try {
            const response = await fetch(`/api/products/match-sku?sku=${encodeURIComponent(sku)}`)
            const data = await response.json()

            if (data.product) {
                const updated = [...products]
                updated[index].product_name = data.product.product_name
                updated[index].seller_account = data.seller_account || 'Account Not Found'
                setProducts(updated)
            } else {
                const updated = [...products]
                updated[index].product_name = 'Product Not Found'
                updated[index].seller_account = 'Account Not Found'
                setProducts(updated)
            }
        } catch (error) {
            console.error('Error matching SKU:', error)
        }
    }

    const calculateTotals = () => {
        const totalQuantity = products.reduce((sum, p) => sum + (p.quantity || 0), 0)
        const totalAmount = products.reduce((sum, p) => sum + (p.total_amount || 0), 0)
        return { totalQuantity, totalAmount }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!orderNumber.trim()) {
            toast.error('Order number is required')
            return
        }

        if (!trackingNumber.trim()) {
            toast.error('Tracking number is required')
            return
        }

        if (!customerName.trim()) {
            toast.error('Customer name is required')
            return
        }

        // Validate all products have SKU
        const invalidProducts = products.filter(p => !p.seller_sku.trim())
        if (invalidProducts.length > 0) {
            toast.error('All products must have a seller SKU')
            return
        }

        setIsSubmitting(true)

        try {
            const orderData = {
                order_number: orderNumber.trim(),
                tracking_number: trackingNumber.trim(),
                customer_name: customerName.trim(),
                order_date: orderDate,
                order_status: orderStatus,
                remarks: remarks.trim(),
                items: products.map((p, idx) => ({
                    seller_sku: p.seller_sku.trim(),
                    quantity: p.quantity,
                    amount: p.amount,
                    item_sequence: idx + 1
                }))
            }

            await createDarazOrder(orderData)

            toast.success('Added Product Successfully')
            queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
            queryClient.invalidateQueries({ queryKey: ['all-daraz-orders'] })
            onClose()
        } catch (error: any) {
            toast.error(error.message || 'Failed to create order')
        } finally {
            setIsSubmitting(false)
        }
    }

    const { totalQuantity, totalAmount } = calculateTotals()

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b dark:border-zinc-700">
                    <h2 className="text-[18px] font-bold">Add New Sales Order</h2>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-3 overflow-y-auto max-h-[calc(90vh-100px)] space-y-3">
                    {/* 1. Order Information */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <FileText size={14} className="text-blue-600" />
                            <h3 className="text-[15px] font-bold">Order Information</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[14px] font-medium mb-0.5">Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    value={orderDate}
                                    onChange={(e) => setOrderDate(e.target.value)}
                                    required
                                    className="w-full px-2 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                />
                            </div>
                            <div>
                                <label className="block text-[14px] font-medium mb-0.5">Order Number <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={orderNumber}
                                    onChange={(e) => setOrderNumber(e.target.value)}
                                    required
                                    placeholder="Enter order number"
                                    className="w-full px-2 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Shipment Details */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <User size={14} className="text-green-600" />
                            <h3 className="text-[15px] font-bold">Shipment Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[14px] font-medium mb-0.5">Tracking Number <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={trackingNumber}
                                    onChange={(e) => setTrackingNumber(e.target.value)}
                                    required
                                    placeholder="Enter tracking number"
                                    className="w-full px-2 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                />
                            </div>
                            <div>
                                <label className="block text-[14px] font-medium mb-0.5">Customer Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required
                                    placeholder="Enter customer name"
                                    className="w-full px-2 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Products */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                                <Package size={14} className="text-purple-600" />
                                <h3 className="text-[15px] font-bold">Products</h3>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddProduct}
                                className="flex items-center gap-0.5 px-2 py-0.5 text-[14px] bg-purple-600 hover:bg-purple-700 text-white rounded"
                            >
                                <Plus size={12} />
                                Add Product
                            </button>
                        </div>

                        <div className="space-y-2">
                            {products.map((product, index) => (
                                <div key={index} className="p-2 border dark:border-zinc-700 rounded bg-gray-50 dark:bg-zinc-800/50">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[14px] font-medium">Product {index + 1}</span>
                                        {products.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveProduct(index)}
                                                className="p-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                                        <div>
                                            <label className="block text-[13px] font-medium mb-0.5">Seller SKU <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                value={product.seller_sku}
                                                onChange={(e) => handleProductChange(index, 'seller_sku', e.target.value)}
                                                onBlur={(e) => handleSKUBlur(index, e.target.value)}
                                                required
                                                placeholder="Enter SKU"
                                                className="w-full px-1.5 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[13px] font-medium mb-0.5">Seller Account</label>
                                            <input
                                                type="text"
                                                value={product.seller_account}
                                                disabled
                                                className="w-full px-1.5 py-1 text-[15px] bg-gray-100 dark:bg-zinc-700 border dark:border-zinc-700 rounded cursor-not-allowed"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[13px] font-medium mb-0.5">Product Name</label>
                                            <input
                                                type="text"
                                                value={product.product_name}
                                                disabled
                                                className="w-full px-1.5 py-1 text-[15px] bg-gray-100 dark:bg-zinc-700 border dark:border-zinc-700 rounded cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-1.5">
                                        <div>
                                            <label className="block text-[13px] font-medium mb-0.5">Quantity <span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={product.quantity}
                                                onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                                required
                                                className="w-full px-1.5 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[13px] font-medium mb-0.5">Amount <span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={product.amount}
                                                onChange={(e) => handleProductChange(index, 'amount', parseInt(e.target.value) || 0)}
                                                required
                                                className="w-full px-1.5 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[13px] font-medium mb-0.5">Total Amount</label>
                                            <input
                                                type="text"
                                                value={`Rs. ${product.total_amount.toLocaleString()}`}
                                                disabled
                                                className="w-full px-1.5 py-1 text-[15px] font-medium bg-gray-100 dark:bg-zinc-700 border dark:border-zinc-700 rounded cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Total Summary */}
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                            <div className="flex justify-between text-[15px]">
                                <span className="font-medium">Total:</span>
                                <span className="font-bold">
                                    {totalQuantity} items â€¢ Rs. {totalAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Additional Details */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <FileText size={14} className="text-orange-600" />
                            <h3 className="text-[15px] font-bold">Additional Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[14px] font-medium mb-0.5">Status</label>
                                <select
                                    value={orderStatus}
                                    onChange={(e) => setOrderStatus(e.target.value)}
                                    className="w-full px-2 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
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
                                <label className="block text-[14px] font-medium mb-0.5">Remarks</label>
                                <input
                                    type="text"
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Optional notes"
                                    className="w-full px-2 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-zinc-700">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="px-2 py-1 text-[15px] border dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                        >
                            Close
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-2 py-1 text-[15px] bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Adding...' : 'Add Order'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    )
}


