'use client'

import { X, Calendar, Edit, Save } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDarazOrderById, updateDarazOrder } from '@/features/sales/actions/daraz-actions'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { usePermissions } from '@/lib/permissions/PermissionContext'

interface ViewDarazOrderModalProps {
    orderId: string
    isOpen: boolean
    onClose: () => void
}

export function ViewDarazOrderModal({ orderId, isOpen, onClose }: ViewDarazOrderModalProps) {
    const queryClient = useQueryClient()
    const { userRole } = usePermissions()
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Editable fields
    const [orderNumber, setOrderNumber] = useState('')
    const [trackingNumber, setTrackingNumber] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [orderDate, setOrderDate] = useState('')
    const [orderStatus, setOrderStatus] = useState('')
    const [remarks, setRemarks] = useState('')

    const { data: order, isLoading } = useQuery({
        queryKey: ['daraz-order', orderId],
        queryFn: () => getDarazOrderById(orderId),
        enabled: !!orderId && isOpen,
        staleTime: 2 * 60 * 1000, // 2 minutes - faster loading
        gcTime: 5 * 60 * 1000 // 5 minutes
    })

    // Populate form fields when order data loads
    useEffect(() => {
        if (order) {
            setOrderNumber(order.order_number || '')
            setTrackingNumber(order.tracking_number || '')
            setCustomerName(order.customer_name || '')
            setOrderDate(order.order_date || '')
            setOrderStatus(order.order_status || '')
            setRemarks(order.remarks || '')
        }
    }, [order])

    const handleSave = async () => {
        try {
            setIsSaving(true)
            await updateDarazOrder(orderId, {
                order_number: orderNumber,
                tracking_number: trackingNumber,
                customer_name: customerName,
                order_date: orderDate,
                order_status: orderStatus,
                remarks: remarks
            })

            toast.success('Update successfully')
            queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
            queryClient.invalidateQueries({ queryKey: ['daraz-order', orderId] })
            setIsEditing(false)
            // Close modal after successful edit
            onClose()
        } catch (error: any) {
            toast.error(error.message || 'Failed to update order')
        } finally {
            setIsSaving(false)
        }
    }

    const hasEditChanges = () => {
        if (!order) return false
        return orderNumber !== (order.order_number || '') ||
            trackingNumber !== (order.tracking_number || '') ||
            customerName !== (order.customer_name || '') ||
            orderDate !== (order.order_date || '') ||
            orderStatus !== (order.order_status || '') ||
            remarks !== (order.remarks || '')
    }

    const handleCancelEdit = () => {
        // Check if user has made changes
        if (order && hasEditChanges()) {
            if (window.confirm('Are you sure to cancel?')) {
                // Reset to original values
                setOrderNumber(order.order_number || '')
                setTrackingNumber(order.tracking_number || '')
                setCustomerName(order.customer_name || '')
                setOrderDate(order.order_date || '')
                setOrderStatus(order.order_status || '')
                setRemarks(order.remarks || '')
                setIsEditing(false)
            }
        } else {
            setIsEditing(false)
        }
    }

    const handleModalClose = () => {
        if (isEditing && hasEditChanges()) {
            if (window.confirm('Are you sure to cancel?')) {
                onClose()
            }
        } else {
            onClose()
        }
    }

    if (!isOpen) return null

    const formatTimestamp = (timestamp: string | null, userName: string | null, userEmail: string | null) => {
        if (!timestamp) return null
        return `${new Date(timestamp).toLocaleString()} by ${userName || userEmail || 'Unknown'}`
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
            <div className="absolute inset-0 bg-black/50" onClick={handleModalClose} />

            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 md:p-4 border-b dark:border-zinc-700 flex-shrink-0">
                    <h2 className="text-sm md:text-lg font-bold">Order Details</h2>
                    <div className="flex items-center gap-2">
                        {/* Only Admin and Editor can see the Edit button */}
                        {!isEditing && (userRole === 'admin' || userRole === 'editor') && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                                <Edit size={12} />
                                <span className="hidden sm:inline">Edit</span>
                            </button>
                        )}
                        
                        {isEditing && (
                            <>
                                <button
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                                >
                                    <X size={12} />
                                    <span className="hidden sm:inline">Cancel</span>
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                                >
                                    <Save size={12} />
                                    <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                                </button>
                            </>
                        )}
                        <button onClick={handleModalClose} className="p-1 md:p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                            <X size={16} className="md:hidden" />
                            <X size={18} className="hidden md:block" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-3 md:p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : order ? (
                        <div className="space-y-4 md:space-y-6">
                            {/* Order Info */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                                <div>
                                    <p className="text-[9px] md:text-xs text-gray-500">Invoice Number</p>
                                    <p className="text-[11px] md:text-sm font-medium">{order.invoice_number}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] md:text-xs text-gray-500">Order Number</p>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={orderNumber}
                                            onChange={(e) => setOrderNumber(e.target.value)}
                                            className="w-full px-2 py-1 text-[11px] md:text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                        />
                                    ) : (
                                        <p className="text-[11px] md:text-sm font-medium">{order.order_number}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[9px] md:text-xs text-gray-500">Tracking Number</p>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={trackingNumber}
                                            onChange={(e) => setTrackingNumber(e.target.value)}
                                            className="w-full px-2 py-1 text-[11px] md:text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                        />
                                    ) : (
                                        <p className="text-[11px] md:text-sm font-medium">{order.tracking_number}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[9px] md:text-xs text-gray-500">Order Date</p>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={orderDate}
                                            onChange={(e) => setOrderDate(e.target.value)}
                                            className="w-full px-2 py-1 text-[11px] md:text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                        />
                                    ) : (
                                        <p className="text-[11px] md:text-sm font-medium">{new Date(order.order_date).toLocaleDateString()}</p>
                                    )}
                                </div>
                            </div>

                            {/* Customer & Status */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                                <div>
                                    <p className="text-[9px] md:text-xs text-gray-500">Customer Name</p>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            className="w-full px-2 py-1 text-[11px] md:text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                        />
                                    ) : (
                                        <p className="text-[11px] md:text-sm font-medium">{order.customer_name}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[9px] md:text-xs text-gray-500">Status</p>
                                    {isEditing ? (
                                        <select
                                            value={orderStatus}
                                            onChange={(e) => setOrderStatus(e.target.value)}
                                            className="w-full px-2 py-1 text-[11px] md:text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Shipped">Shipped</option>
                                            <option value="Delivered">Delivered</option>
                                            <option value="Returned Delivered">Returned Delivered</option>
                                            <option value="Returning to Seller">Returning to Seller</option>
                                            <option value="Failed Delivered">Failed Delivered</option>
                                            <option value="Customer Return">Customer Return</option>
                                            <option value="Cancel">Cancel</option>
                                        </select>
                                    ) : (
                                        <span className={`inline-block px-2 py-1 text-[9px] md:text-xs font-medium rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                            order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-700' :
                                                order.order_status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>
                                            {order.order_status}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[9px] md:text-xs text-gray-500">Remarks</p>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            placeholder="Optional notes"
                                            className="w-full px-2 py-1 text-[11px] md:text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                        />
                                    ) : (
                                        <p className="text-[11px] md:text-sm font-medium">{order.remarks || '-'}</p>
                                    )}
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h3 className="text-[11px] md:text-sm font-semibold mb-2 md:mb-3">Order Items</h3>
                                <div className="border dark:border-zinc-700 rounded-lg overflow-hidden">
                                    {/* Mobile view - stacked cards */}
                                    <div className="md:hidden divide-y dark:divide-zinc-700">
                                        {order.items?.map((item: any, idx: number) => (
                                            <div key={item.id} className="p-2 space-y-1">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="font-medium">#{idx + 1} {item.product_name}</span>
                                                    <span className="font-bold">Rs. {item.total_amount.toLocaleString()}</span>
                                                </div>
                                                <div className="text-[9px] text-gray-600 dark:text-gray-400">
                                                    SKU: {item.seller_sku} • {item.seller_account}
                                                </div>
                                                <div className="text-[9px] text-gray-600 dark:text-gray-400">
                                                    Qty: {item.quantity} × Rs. {item.amount.toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="p-2 bg-gray-50 dark:bg-zinc-800 font-semibold text-[10px] flex justify-between">
                                            <span>Total: {order.total_quantity} items</span>
                                            <span>Rs. {order.grand_total?.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Desktop view - table */}
                                    <table className="w-full hidden md:table">
                                        <thead className="bg-gray-50 dark:bg-zinc-800">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium">#</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium">Seller SKU</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium">Product Name</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium">Seller Account</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium">Qty</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium">Amount</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-zinc-700">
                                            {order.items?.map((item: any, idx: number) => (
                                                <tr key={item.id}>
                                                    <td className="px-4 py-2 text-sm">{idx + 1}</td>
                                                    <td className="px-4 py-2 text-sm font-mono">{item.seller_sku}</td>
                                                    <td className="px-4 py-2 text-sm">{item.product_name}</td>
                                                    <td className="px-4 py-2 text-sm">{item.seller_account}</td>
                                                    <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                                                    <td className="px-4 py-2 text-sm text-right">Rs. {item.amount.toLocaleString()}</td>
                                                    <td className="px-4 py-2 text-sm text-right font-medium">Rs. {item.total_amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 dark:bg-zinc-800">
                                            <tr>
                                                <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-right">Total:</td>
                                                <td className="px-4 py-2 text-sm font-semibold text-right">{order.total_quantity}</td>
                                                <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-right">Rs. {order.grand_total?.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Audit Trail */}
                            <div>
                                <h3 className="text-[11px] md:text-sm font-semibold mb-2 md:mb-3">Audit Trail</h3>
                                <div className="space-y-1.5 md:space-y-2 text-[10px] md:text-sm">
                                    {order.created_at && (
                                        <div className="flex items-start gap-2">
                                            <Calendar size={12} className="md:hidden mt-0.5 text-gray-400" />
                                            <Calendar size={14} className="hidden md:block mt-0.5 text-gray-400" />
                                            <div>
                                                <span className="font-medium">Created: </span>
                                                {formatTimestamp(order.created_at, order.created_by_name, order.created_by_email)}
                                            </div>
                                        </div>
                                    )}

                                    {order.edited_at && (
                                        <div className="flex items-start gap-2">
                                            <Calendar size={12} className="md:hidden mt-0.5 text-gray-400" />
                                            <Calendar size={14} className="hidden md:block mt-0.5 text-gray-400" />
                                            <div>
                                                <span className="font-medium">Edited: </span>
                                                {formatTimestamp(order.edited_at, order.edited_by_name, order.edited_by_email)}
                                            </div>
                                        </div>
                                    )}

                                    {order.shipped_at && (
                                        <div className="flex items-start gap-2">
                                            <Calendar size={12} className="md:hidden mt-0.5 text-blue-400" />
                                            <Calendar size={14} className="hidden md:block mt-0.5 text-blue-400" />
                                            <div>
                                                <span className="font-medium text-blue-600">Shipped: </span>
                                                {formatTimestamp(order.shipped_at, order.shipped_by_name, order.shipped_by_email)}
                                            </div>
                                        </div>
                                    )}

                                    {order.delivered_at && (
                                        <div className="flex items-start gap-2">
                                            <Calendar size={12} className="md:hidden mt-0.5 text-green-400" />
                                            <Calendar size={14} className="hidden md:block mt-0.5 text-green-400" />
                                            <div>
                                                <span className="font-medium text-green-600">Delivered: </span>
                                                {formatTimestamp(order.delivered_at, order.delivered_by_name, order.delivered_by_email)}
                                            </div>
                                        </div>
                                    )}

                                    {order.returning_to_seller_at && (
                                        <div className="flex items-start gap-2">
                                            <Calendar size={12} className="md:hidden mt-0.5 text-orange-400" />
                                            <Calendar size={14} className="hidden md:block mt-0.5 text-orange-400" />
                                            <div>
                                                <span className="font-medium text-orange-600">Returning to Seller: </span>
                                                {formatTimestamp(order.returning_to_seller_at, order.returning_to_seller_by_name, order.returning_to_seller_by_email)}
                                            </div>
                                        </div>
                                    )}

                                    {order.customer_returned_at && (
                                        <div className="flex items-start gap-2">
                                            <Calendar size={12} className="md:hidden mt-0.5 text-orange-400" />
                                            <Calendar size={14} className="hidden md:block mt-0.5 text-orange-400" />
                                            <div>
                                                <span className="font-medium text-orange-600">Customer Returned: </span>
                                                {formatTimestamp(order.customer_returned_at, order.customer_returned_by_name, order.customer_returned_by_email)}
                                            </div>
                                        </div>
                                    )}

                                    {order.customer_return_delivered_at && (
                                        <div className="flex items-start gap-2">
                                            <Calendar size={12} className="md:hidden mt-0.5 text-orange-600" />
                                            <Calendar size={14} className="hidden md:block mt-0.5 text-orange-600" />
                                            <div>
                                                <span className="font-medium text-orange-700">Customer Return Delivered: </span>
                                                {formatTimestamp(order.customer_return_delivered_at, order.customer_return_delivered_by_name, order.customer_return_delivered_by_email)}
                                            </div>
                                        </div>
                                    )}

                                    {order.returned_delivered_at && (
                                        <div className="flex items-start gap-2">
                                            <Calendar size={12} className="md:hidden mt-0.5 text-green-500" />
                                            <Calendar size={14} className="hidden md:block mt-0.5 text-green-500" />
                                            <div>
                                                <span className="font-medium text-green-700">Returned Delivered: </span>
                                                {formatTimestamp(order.returned_delivered_at, order.returned_delivered_by_name, order.returned_delivered_by_email)}
                                            </div>
                                        </div>
                                    )}

                                    {order.failed_delivered_at && (
                                        <div className="flex items-start gap-2">
                                            <Calendar size={12} className="md:hidden mt-0.5 text-red-400" />
                                            <Calendar size={14} className="hidden md:block mt-0.5 text-red-400" />
                                            <div>
                                                <span className="font-medium text-red-600">Failed Delivered: </span>
                                                {formatTimestamp(order.failed_delivered_at, order.failed_delivered_by_name, order.failed_delivered_by_email)}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">Order not found</div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t dark:border-zinc-700 p-2 md:p-4 flex justify-end flex-shrink-0">
                    <button
                        onClick={handleModalClose}
                        className="px-3 py-1.5 md:px-4 md:py-2 text-[11px] md:text-sm border dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
