'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDarazOrderById } from '@/features/sales/actions/daraz-actions'
import {
    X,
    Printer,
    Edit,
    Trash2,
    Calendar,
    Clock,
    Copy,
    Check,
    ExternalLink,
    Package,
    User,
    FileText,
    History,
    AlertCircle,
    Loader2
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { usePermissions } from '@/lib/permissions/PermissionContext'
import { EditDarazOrderModal } from '@/features/sales/components/EditDarazOrderModal'
import { PartialReturnModal } from '@/features/sales/components/PartialReturnModal'
import { DeletionReasonModal } from '@/features/sales/components/DeletionReasonModal'

interface DarazOrderDetailModalProps {
    orderId: string | null
    initialOrder?: any
    isOpen: boolean
    onClose: () => void
    onOrderUpdated?: () => void
}

export function DarazOrderDetailModal({
    orderId,
    initialOrder,
    isOpen,
    onClose,
    onOrderUpdated
}: DarazOrderDetailModalProps) {
    const queryClient = useQueryClient()
    const { userRole } = usePermissions()

    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isPartialReturnOpen, setIsPartialReturnOpen] = useState(false)
    const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isEditModalOpen && !isPartialReturnOpen && !isDeletionModalOpen) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose, isEditModalOpen, isPartialReturnOpen, isDeletionModalOpen])

    const { data: fetchedOrder, isLoading: isFetchingOrder } = useQuery({
        queryKey: ['daraz-order', orderId],
        queryFn: () => getDarazOrderById(orderId!),
        enabled: !!orderId && isOpen,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    })

    // Instant data: merge initialOrder immediately, then enrich with fetchedOrder
    const order = useMemo(() => {
        const raw = fetchedOrder || initialOrder
        if (!raw) return null

        let items = raw.items || []
        if (items.length === 0 && Array.isArray(raw.items_detail) && raw.items_detail.length > 0) {
            items = raw.items_detail.map((i: any) => ({
                id: String(i.order_item_id || i.id || ''),
                order_id: raw.id,
                item_status: i.status || raw.order_status,
                quantity: Number(i.quantity) || 1,
                product_id: null,
                product_name: i.name,
                seller_sku: i.sku || i.shop_sku,
                amount: Number(i.paid_price || i.item_price || 0),
                total_amount: Number(i.paid_price || i.item_price || 0),
                seller_account: i.seller_account || raw.seller_account
            }))
        }

        const total_quantity = raw.total_quantity ?? items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0)
        const grand_total = raw.grand_total ?? raw.total_amount ?? items.reduce((sum: number, it: any) => sum + (Number(it.total_amount) || (Number(it.amount || 0) * (Number(it.quantity) || 1))), 0)

        return {
            ...raw,
            items,
            total_quantity,
            grand_total
        }
    }, [fetchedOrder, initialOrder])

    // Only show loading spinner if we don't have ANY order data (neither initial nor fetched)
    const isLoading = !order && isFetchingOrder

    // Extract customer email from items_detail if present
    const customerEmail = useMemo(() => {
        if (!order) return null
        if (order.customer_email) return order.customer_email
        if (order.items_detail && Array.isArray(order.items_detail)) {
            const itemWithEmail = order.items_detail.find(
                (item: any) => item.digital_delivery_info && item.digital_delivery_info.trim()
            )
            if (itemWithEmail) return itemWithEmail.digital_delivery_info.trim()
        }
        return null
    }, [order])

    const copyToClipboard = (text: string, field: string) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        setCopiedField(field)
        toast.success(`Copied ${field}`)
        setTimeout(() => setCopiedField(null), 1800)
    }

    const handleDelete = async (reason: string) => {
        if (!orderId || !order) return
        try {
            const { createDeletionRequest } = await import('@/features/sales/actions/daraz-deletion-actions')
            await createDeletionRequest(orderId, order.order_number || '', reason)
            setIsDeletionModalOpen(false)
            toast.success('Deletion request submitted')
            queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
            queryClient.invalidateQueries({ queryKey: ['daraz-order', orderId] })
            if (onOrderUpdated) onOrderUpdated()
            onClose()
        } catch (error: any) {
            console.error('Delete failed:', error)
            toast.error(error.message || 'Failed to submit deletion request')
        }
    }

    const formatTimestamp = (timestamp: string | null, userName: string | null, userEmail: string | null) => {
        if (!timestamp) return null
        return `${new Date(timestamp).toLocaleString()} by ${userName || userEmail || 'Daraz sync'}`
    }

    if (!isOpen || !orderId) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
            {/* Modal Container */}
            <div
                className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/90 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <Package size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100 tracking-tight">
                                    Order Details
                                </h2>
                                {order?.invoice_number && (
                                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
                                        {order.invoice_number}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                                {order ? `Order #${order.order_number} • ${order.customer_name || 'Customer'}` : 'Loading order details...'}
                            </p>
                        </div>
                    </div>

                    {/* Actions & Close Button */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {order && (
                            <>
                                <button
                                    onClick={() => window.open(`/print/daraz-invoice/${orderId}`, '_blank')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer"
                                    title="Print Shipping Invoice / Label"
                                >
                                    <Printer size={13} />
                                    <span className="hidden sm:inline">Print</span>
                                </button>

                                {(userRole === 'admin' || userRole === 'editor') && (
                                    <button
                                        onClick={() => setIsEditModalOpen(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                                        title="Edit Order"
                                    >
                                        <Edit size={13} />
                                        <span className="hidden sm:inline">Edit</span>
                                    </button>
                                )}

                                {userRole === 'admin' && (
                                    <button
                                        onClick={() => setIsDeletionModalOpen(true)}
                                        disabled={order.pending_deletion}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer disabled:opacity-50"
                                        title="Delete Order"
                                    >
                                        <Trash2 size={13} />
                                        <span className="hidden sm:inline">Delete</span>
                                    </button>
                                )}

                                <Link
                                    href={`/dashboard/sales/daraz/order/${orderId}?from=sales-entry`}
                                    target="_blank"
                                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                    title="Open Full Page in New Tab"
                                >
                                    <ExternalLink size={16} />
                                </Link>
                            </>
                        )}

                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
                            title="Close (Esc)"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Body with Custom Scroll */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                            <Loader2 size={32} className="animate-spin text-orange-500" />
                            <p className="text-sm font-medium">Loading full order details...</p>
                        </div>
                    ) : !order ? (
                        <div className="flex flex-col items-center justify-center py-16 text-rose-500 gap-2">
                            <AlertCircle size={32} />
                            <p className="text-sm font-semibold">Order not found or failed to load.</p>
                        </div>
                    ) : (
                        <>
                            {/* Card 1: Order Information */}
                            <div className="bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                                    <FileText size={14} className="text-orange-500" />
                                    <span>Order Information</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Invoice Number</p>
                                        <div className="flex items-center gap-1 font-mono font-bold text-gray-900 dark:text-zinc-100 mt-0.5">
                                            <span>{order.invoice_number || '—'}</span>
                                            {order.invoice_number && (
                                                <button
                                                    onClick={() => copyToClipboard(order.invoice_number, 'Invoice Number')}
                                                    className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 cursor-pointer"
                                                >
                                                    {copiedField === 'Invoice Number' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Order Number</p>
                                        <div className="flex items-center gap-1 font-mono font-bold text-gray-900 dark:text-zinc-100 mt-0.5">
                                            <span className="truncate">{order.order_number}</span>
                                            <button
                                                onClick={() => copyToClipboard(order.order_number, 'Order Number')}
                                                className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 cursor-pointer shrink-0"
                                            >
                                                {copiedField === 'Order Number' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Tracking Number</p>
                                        <div className="flex items-center gap-1 font-mono font-semibold text-gray-900 dark:text-zinc-100 mt-0.5">
                                            <span className="truncate">{order.tracking_number || '—'}</span>
                                            {order.tracking_number && (
                                                <button
                                                    onClick={() => copyToClipboard(order.tracking_number, 'Tracking Number')}
                                                    className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 cursor-pointer shrink-0"
                                                >
                                                    {copiedField === 'Tracking Number' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Order Date</p>
                                        <p className="font-semibold text-gray-900 dark:text-zinc-100 mt-0.5">
                                            {order.order_date ? new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Customer & Status */}
                            <div className="bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                                    <User size={14} className="text-blue-500" />
                                    <span>Customer &amp; Status</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Customer Name</p>
                                        <p className="font-bold text-gray-900 dark:text-zinc-100 mt-0.5">
                                            {order.customer_name || '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Customer Phone</p>
                                        <div className="flex items-center gap-1 font-mono font-medium text-blue-600 dark:text-blue-400 mt-0.5">
                                            <span>{order.shipping_phone || '—'}</span>
                                            {order.shipping_phone && (
                                                <button
                                                    onClick={() => copyToClipboard(order.shipping_phone, 'Phone Number')}
                                                    className="p-0.5 text-gray-400 hover:text-blue-600 cursor-pointer"
                                                >
                                                    {copiedField === 'Phone Number' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Customer Email</p>
                                        <div className="flex items-center gap-1 font-mono text-xs text-gray-700 dark:text-zinc-300 mt-0.5 truncate">
                                            <span className="truncate">{customerEmail || '—'}</span>
                                            {customerEmail && (
                                                <button
                                                    onClick={() => copyToClipboard(customerEmail, 'Email')}
                                                    className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 cursor-pointer shrink-0"
                                                >
                                                    {copiedField === 'Email' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Creation Timestamp</p>
                                        <p className="text-xs text-gray-700 dark:text-zinc-300 mt-0.5">
                                            {new Date(order.daraz_created_at || order.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Current Status</p>
                                        <div className="mt-1">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-md border ${
                                                order.order_status === 'Pending' ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' :
                                                order.order_status === 'Packed' ? 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' :
                                                order.order_status === 'Ready to Ship' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' :
                                                order.order_status === 'Shipped' ? 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' :
                                                order.order_status === 'Delivered' ? 'bg-green-50 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800' :
                                                'bg-gray-100 text-gray-800 border-gray-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
                                            }`}>
                                                {order.order_status}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Remarks</p>
                                        <p className="text-xs text-gray-700 dark:text-zinc-300 mt-0.5">
                                            {order.remarks || '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Order Items Table */}
                            <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50/80 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300">
                                        <Package size={14} className="text-emerald-500" />
                                        <span>Order Items ({order.items?.length || 0})</span>
                                    </div>
                                    <span className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                                        Grand Total: Rs. {(order.grand_total ?? 0).toLocaleString()}
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50 dark:bg-zinc-900/60 text-[11px] font-bold uppercase text-gray-600 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800">
                                                <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                <th className="py-2.5 px-3">Seller SKU</th>
                                                <th className="py-2.5 px-3 min-w-[200px]">Product Name</th>
                                                <th className="py-2.5 px-3">Product ID</th>
                                                <th className="py-2.5 px-3">Seller Account</th>
                                                <th className="py-2.5 px-3 text-center">Status</th>
                                                <th className="py-2.5 px-3 text-center w-16">Qty</th>
                                                <th className="py-2.5 px-3 text-right">Amount</th>
                                                <th className="py-2.5 px-3 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-xs">
                                            {order.items?.map((item: any, idx: number) => (
                                                <tr key={item.id || idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                                                    <td className="py-2.5 px-3 text-center text-gray-400 font-medium">{idx + 1}</td>
                                                    <td className="py-2.5 px-3 font-mono font-medium text-gray-800 dark:text-zinc-200">{item.seller_sku || '—'}</td>
                                                    <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-zinc-100">{item.product_name || '—'}</td>
                                                    <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-zinc-400">
                                                        {item.product?.product_id ? `#${item.product.product_id}` : '—'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-gray-600 dark:text-zinc-400">{item.seller_account || '—'}</td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                                                            {item.item_status || order.order_status}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                                                    <td className="py-2.5 px-3 text-right text-gray-700 dark:text-zinc-300">Rs. {(Number(item.amount) || 0).toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-gray-900 dark:text-zinc-100">
                                                        Rs. {(Number(item.total_amount) || (Number(item.amount) || 0) * (Number(item.quantity) || 1)).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 dark:bg-zinc-800/70 border-t border-gray-200 dark:border-zinc-800 text-xs font-bold text-gray-900 dark:text-zinc-100">
                                            <tr>
                                                <td colSpan={6} className="py-2.5 px-3 text-right uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                                                    Total Summary:
                                                </td>
                                                <td className="py-2.5 px-3 text-center">{order.total_quantity}</td>
                                                <td></td>
                                                <td className="py-2.5 px-3 text-right">Rs. {(order.grand_total ?? 0).toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Card 4: Audit Trail */}
                            <div className="bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                                    <History size={14} className="text-purple-500" />
                                    <span>Audit Trail</span>
                                </div>
                                <div className="space-y-2 text-xs">
                                    {order.created_at && (
                                        <div className="flex items-center gap-2 text-gray-700 dark:text-zinc-300">
                                            <Calendar size={13} className="text-gray-400 shrink-0" />
                                            <span>
                                                <strong className="text-gray-900 dark:text-zinc-100">Created: </strong>
                                                {formatTimestamp(order.created_at, order.created_by_name, order.created_by_email)}
                                                {order.import_source === 'csv' && <span className="text-gray-400 ml-1">(import csv)</span>}
                                            </span>
                                        </div>
                                    )}

                                    {order.edited_at && (
                                        <div className="flex items-center gap-2 text-gray-700 dark:text-zinc-300">
                                            <Calendar size={13} className="text-gray-400 shrink-0" />
                                            <span>
                                                <strong className="text-gray-900 dark:text-zinc-100">Edited: </strong>
                                                {formatTimestamp(order.edited_at, order.edited_by_name, order.edited_by_email)}
                                            </span>
                                        </div>
                                    )}

                                    {order.shipped_at && (
                                        <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                                            <Calendar size={13} className="text-sky-500 shrink-0" />
                                            <span>
                                                <strong>Shipped: </strong>
                                                {formatTimestamp(order.shipped_at, order.shipped_by_name, order.shipped_by_email)}
                                            </span>
                                        </div>
                                    )}

                                    {order.delivered_at && (
                                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                                            <Calendar size={13} className="text-emerald-500 shrink-0" />
                                            <span>
                                                <strong>Delivered: </strong>
                                                {formatTimestamp(order.delivered_at, order.delivered_by_name, order.delivered_by_email)}
                                            </span>
                                        </div>
                                    )}

                                    {order.delivered_by_daraz && (
                                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                                            <Clock size={13} className="text-emerald-600 shrink-0" />
                                            <span>
                                                <strong>Delivered by Daraz: </strong>
                                                {formatTimestamp(order.delivered_by_daraz, null, null)}
                                            </span>
                                        </div>
                                    )}

                                    {order.cancelled_at && (
                                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                                            <Calendar size={13} className="text-rose-500 shrink-0" />
                                            <span>
                                                <strong>Cancelled: </strong>
                                                {formatTimestamp(order.cancelled_at, order.cancelled_by_name, order.cancelled_by_email)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Embedded Modals for Edit, Return, Delete */}
            {order && (
                <>
                    <EditDarazOrderModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        orderId={orderId}
                        orderData={order}
                        onTriggerPartialReturn={() => {
                            setIsEditModalOpen(false)
                            setIsPartialReturnOpen(true)
                        }}
                    />
                    <PartialReturnModal
                        order={order}
                        isOpen={isPartialReturnOpen}
                        onClose={() => setIsPartialReturnOpen(false)}
                    />
                    <DeletionReasonModal
                        isOpen={isDeletionModalOpen}
                        onClose={() => setIsDeletionModalOpen(false)}
                        orderNumber={order.order_number}
                        onSubmit={handleDelete}
                    />
                </>
            )}
        </div>
    )
}
