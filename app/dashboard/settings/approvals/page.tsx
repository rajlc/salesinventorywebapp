'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getApprovalRequests, approveDeleteRequest, rejectDeleteRequest, getInactiveProducts, getDeletedProducts, restoreProduct, toggleProductStatus, deleteAllPendingApprovals, deleteAllInactiveProducts, permanentlyDeleteAllDeletedProducts } from '@/features/inventory/actions/product-actions'
import { getPendingDeletionRequests, approveDeletionRequest, rejectDeletionRequest } from '@/features/sales/actions/daraz-deletion-actions'
import { Card, CardContent } from '@/components/ui-shim'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { Clock, Check, X, AlertTriangle, RotateCcw, Trash2, Ban } from 'lucide-react'

export default function ApprovalsPage() {
    const [activeTab, setActiveTab] = useState('products')
    const [productSubTab, setProductSubTab] = useState<'pending' | 'inactive' | 'deleted'>('pending')
    const queryClient = useQueryClient()

    // Fetch approval requests
    const { data: approvals, isLoading: isLoadingApprovals, error: errorApprovals } = useQuery({
        queryKey: ['approvals', activeTab],
        queryFn: async () => {
            if (activeTab === 'sales') {
                const result = await getPendingDeletionRequests()
                if (!result.success) throw new Error(result.error)
                return result.data?.map((req: any) => ({
                    id: req.id,
                    resource_name: `Order #${req.order_number}`,
                    requested_at: req.requested_at,
                    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                    metadata: {
                        user_name: req.requester?.raw_user_meta_data?.full_name || req.requester?.email,
                        user_email: req.requester?.email,
                        reason: req.reason
                    }
                })) || []
            }
            return getApprovalRequests(activeTab)
        }
    })

    // Fetch inactive products
    const { data: inactiveProducts, isLoading: isLoadingInactive } = useQuery({
        queryKey: ['inactive-products'],
        queryFn: getInactiveProducts,
        enabled: activeTab === 'products' && productSubTab === 'inactive'
    })

    // Fetch deleted items (trash)
    const { data: deletedItems, isLoading: isLoadingDeleted } = useQuery({
        queryKey: ['deleted-items', 'products'],
        queryFn: getDeletedProducts,
        enabled: activeTab === 'products' && productSubTab === 'deleted'
    })

    const handleApprove = async (requestId: string) => {
        if (!confirm('Approve this delete request? The item will be moved to Restore Backup.')) {
            return
        }

        try {
            if (activeTab === 'sales') {
                const result = await approveDeletionRequest(requestId)
                if (!result.success) throw new Error(result.error)
            } else {
                await approveDeleteRequest(requestId)
            }
            queryClient.invalidateQueries({ queryKey: ['approvals'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            alert('Request approved successfully!')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const handleReject = async (requestId: string) => {
        const notes = prompt('Reject reason (optional):')

        if (!confirm('Reject this delete request? The item will remain active.')) {
            return
        }

        try {
            if (activeTab === 'sales') {
                const result = await rejectDeletionRequest(requestId, notes || undefined)
                if (!result.success) throw new Error(result.error)
            } else {
                await rejectDeleteRequest(requestId)
            }
            queryClient.invalidateQueries({ queryKey: ['approvals'] })
            alert('Request rejected successfully!')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const handleRestore = async (itemId: string) => {
        if (!confirm('Restore this item? It will be moved back to the main list.')) return
        try {
            await restoreProduct(itemId)
            queryClient.invalidateQueries({ queryKey: ['deleted-items'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            alert('Item restored successfully!')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const handleReactivate = async (productId: string) => {
        if (!confirm('Reactivate this product?')) return
        try {
            await toggleProductStatus(productId, 'Inactive')
            queryClient.invalidateQueries({ queryKey: ['inactive-products'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            alert('Product reactivated!')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const handleDeleteAll = async () => {
        if (activeTab !== 'products') return

        let confirmMessage = ''
        let action: () => Promise<any>

        if (productSubTab === 'pending') {
            confirmMessage = '⚠️ WARNING: Delete ALL pending approval requests?\n\nThis will:\n- Remove all pending product deletion requests\n- Cannot be undone\n\nAre you sure?'
            action = deleteAllPendingApprovals
        } else if (productSubTab === 'inactive') {
            confirmMessage = '⚠️ WARNING: Delete ALL inactive products?\n\nThis will:\n- Move all inactive products to trash\n- Products can be restored from trash\n\nAre you sure?'
            action = deleteAllInactiveProducts
        } else if (productSubTab === 'deleted') {
            confirmMessage = '🔴 DANGER: Permanently delete ALL products in trash?\n\nThis will:\n- PERMANENTLY delete all products from the database\n- This action CANNOT be undone\n- All data will be lost forever\n\nType "DELETE" to confirm'
            const userInput = prompt(confirmMessage)
            if (userInput !== 'DELETE') return
            action = permanentlyDeleteAllDeletedProducts
        } else {
            return
        }

        if (productSubTab !== 'deleted' && !confirm(confirmMessage)) return

        try {
            const result = await action()
            queryClient.invalidateQueries({ queryKey: ['approvals'] })
            queryClient.invalidateQueries({ queryKey: ['inactive-products'] })
            queryClient.invalidateQueries({ queryKey: ['deleted-items'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            alert(result.message || 'All items deleted successfully')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const getTimeRemaining = (expiresAt: string) => {
        const now = new Date().getTime()
        const expiry = new Date(expiresAt).getTime()
        const diff = expiry - now

        if (diff <= 0) return 'Expired'

        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

        return `${hours}h ${minutes}m remaining`
    }

    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Approval Center"
                subtitle="Review and approve pending delete requests"
            />

            {/* Tabs */}
            <Card>
                <div className="border-b dark:border-zinc-700">
                    <div className="flex items-center justify-between pr-4">
                        <div className="flex gap-4 p-4">
                            {['products', 'sales', 'purchases', 'suppliers'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setActiveTab(tab)
                                        setProductSubTab('pending')
                                    }}
                                    className={`px-4 py-2 font-medium rounded-lg transition-colors ${activeTab === tab
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Sub-tabs */}
                    {activeTab === 'products' && (
                        <div className="px-4 pb-0 flex items-center justify-between border-t dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                            <div className="flex gap-6">
                                {[
                                    { id: 'pending', label: 'Pending Approvals', icon: Clock },
                                    { id: 'inactive', label: 'Inactive Products', icon: Ban },
                                    { id: 'deleted', label: 'Deleted / Trash', icon: Trash2 },
                                ].map((sub) => (
                                    <button
                                        key={sub.id}
                                        onClick={() => setProductSubTab(sub.id as any)}
                                        className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${productSubTab === sub.id
                                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        <sub.icon size={14} />
                                        {sub.label}
                                    </button>
                                ))}
                            </div>

                            {/* Delete All Button */}
                            <button
                                onClick={handleDeleteAll}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${productSubTab === 'deleted'
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                                    }`}
                            >
                                <Trash2 size={14} />
                                Delete All
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <CardContent className="p-6">
                    {/* INACTIVE PRODUCTS VIEW */}
                    {activeTab === 'products' && productSubTab === 'inactive' ? (
                        isLoadingInactive ? (
                            <div className="text-center py-8 text-gray-500">Loading inactive products...</div>
                        ) : !inactiveProducts || inactiveProducts.length === 0 ? (
                            <div className="text-center py-12">
                                <Check className="mx-auto mb-4 text-green-500" size={48} />
                                <p className="text-lg font-medium">No inactive products</p>
                                <p className="text-sm text-gray-500 mt-2">All products are currently active.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {inactiveProducts.map((product: any) => (
                                    <div key={product.id} className="p-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold">{product.product_name}</h3>
                                            <p className="text-sm text-gray-500 font-mono mt-1">
                                                SKU: {product.seller_sku1 || 'N/A'} • ID: {product.product_id}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleReactivate(product.id)}
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors border border-blue-200"
                                        >
                                            <RotateCcw size={14} />
                                            Reactivate
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    )
                        /* DELETED ITEMS VIEW */
                        : activeTab === 'products' && productSubTab === 'deleted' ? (
                            isLoadingDeleted ? (
                                <div className="text-center py-8 text-gray-500">Loading deleted items...</div>
                            ) : !deletedItems || deletedItems.length === 0 ? (
                                <div className="text-center py-12">
                                    <Trash2 className="mx-auto mb-4 text-gray-400" size={48} />
                                    <p className="text-lg font-medium">Trash is empty</p>
                                    <p className="text-sm text-gray-500 mt-2">No deleted items eligible for restore.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {deletedItems.map((item: any) => (
                                        <div key={item.id} className="p-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold">{item.product_name}</h3>
                                                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Deleted</span>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    ID: {item.product_id} {item.seller_sku1 ? `• SKU: ${item.seller_sku1}` : ''}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRestore(item.id)}
                                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-600 hover:bg-green-100 rounded-md transition-colors border border-green-200"
                                            >
                                                <RotateCcw size={14} />
                                                Restore
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )
                        )
                            /* APPROVALS VIEW (Default) */
                            : (
                                isLoadingApprovals ? (
                                    <div className="text-center py-8 text-gray-500">Loading approvals...</div>
                                ) : errorApprovals ? (
                                    <div className="text-center py-8 text-red-500">Error: {(errorApprovals as any).message}</div>
                                ) : !approvals || approvals.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Check className="mx-auto mb-4 text-green-500" size={48} />
                                        <p className="text-lg font-medium">All caught up!</p>
                                        <p className="text-sm text-gray-500 mt-2">No pending delete requests for {activeTab}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {approvals.map((approval: any) => {
                                            const isExpiring = new Date(approval.expires_at).getTime() - new Date().getTime() < 6 * 60 * 60 * 1000 // Less than 6 hours

                                            return (
                                                <div
                                                    key={approval.id}
                                                    className={`p-4 rounded-lg border-2 ${isExpiring
                                                        ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10'
                                                        : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        {/* Left: Info */}
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
                                                                    Delete Request
                                                                </span>
                                                                {isExpiring && (
                                                                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                                                                        <AlertTriangle size={12} />
                                                                        Expiring Soon
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <h3 className="text-lg font-semibold mb-1">{approval.resource_name}</h3>

                                                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                                                <p>
                                                                    <span className="font-medium">Requested by:</span>{' '}
                                                                    {approval.metadata?.user_name || 'Unknown'}
                                                                </p>
                                                                <p>
                                                                    <span className="font-medium">Requested at:</span>{' '}
                                                                    {new Date(approval.requested_at).toLocaleString()}
                                                                </p>
                                                                {activeTab === 'sales' && approval.metadata?.reason && (
                                                                    <p>
                                                                        <span className="font-medium">Reason:</span>{' '}
                                                                        {approval.metadata.reason}
                                                                    </p>
                                                                )}
                                                                <p className="flex items-center gap-1">
                                                                    <Clock size={14} />
                                                                    <span className="font-medium">Expires in:</span>{' '}
                                                                    <span className={isExpiring ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''}>
                                                                        {getTimeRemaining(approval.expires_at)}
                                                                    </span>
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Right: Actions */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleApprove(approval.id)}
                                                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                                            >
                                                                <Check size={16} />
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleReject(approval.id)}
                                                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                                            >
                                                                <X size={16} />
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            )}
                </CardContent>
            </Card>
        </div>
    )
}
