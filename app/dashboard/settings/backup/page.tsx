'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDeletedItems, restoreProduct, restoreMissingBackups, permanentlyDeleteAllProductsBackup } from '@/features/inventory/actions/product-actions'
import { getDeletedOrders, restoreOrder, permanentlyDeleteOrder } from '@/features/sales/actions/daraz-deletion-actions'
import { Card, CardContent } from '@/components/ui-shim'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { RotateCcw, Clock, Trash2, AlertTriangle, RefreshCw } from 'lucide-react'

export default function RestoreBackupPage() {
    const [activeTab, setActiveTab] = useState('products')
    const [isSyncing, setIsSyncing] = useState(false)
    const queryClient = useQueryClient()

    // Fetch deleted items
    const { data: deletedItems, isLoading, error } = useQuery({
        queryKey: ['deleted-items', activeTab],
        queryFn: async () => {
            if (activeTab === 'sales') {
                const result = await getDeletedOrders()
                if (!result.success) throw new Error(result.error)
                return result.data?.map((deleted: any) => ({
                    id: deleted.id,
                    resource_name: `Order #${deleted.order_data.order_number}`,
                    deleted_at: deleted.deleted_at,
                    expires_at: deleted.permanent_delete_at,
                    metadata: {
                        deleted_by_name: deleted.deleter?.raw_user_meta_data?.full_name || deleted.deleter?.email,
                        deleted_by_email: deleted.deleter?.email,
                        customer_name: deleted.order_data.customer_name,
                        order_date: deleted.order_data.order_date
                    }
                })) || []
            }
            return getDeletedItems(activeTab)
        }
    })

    const handleRestore = async (deletedItemId: string, resourceName: string) => {
        if (!confirm(`Restore "${resourceName}"? This will make it active again.`)) {
            return
        }

        try {
            if (activeTab === 'sales') {
                const result = await restoreOrder(deletedItemId)
                if (!result.success) throw new Error(result.error)
            } else {
                await restoreProduct(deletedItemId)
            }
            queryClient.invalidateQueries({ queryKey: ['deleted-items'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            alert('Item restored successfully!')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const handlePermanentDelete = async (deletedItemId: string, resourceName: string) => {
        if (!confirm(`⚠️ PERMANENTLY DELETE "${resourceName}"?\n\nThis CANNOT be undone!`)) {
            return
        }

        if (!confirm('Are you absolutely sure? This will remove all data forever.')) {
            return
        }

        try {
            if (activeTab === 'sales') {
                const result = await permanentlyDeleteOrder(deletedItemId)
                if (!result.success) throw new Error(result.error)
            } else {
                alert('Permanent delete for products not yet implemented')
                return
            }
            queryClient.invalidateQueries({ queryKey: ['deleted-items'] })
            alert('Item permanently deleted')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const getTimeRemaining = (expiresAt: string) => {
        const now = new Date().getTime()
        const expiry = new Date(expiresAt).getTime()
        const diff = expiry - now

        if (diff <= 0) return 'Expired (will be auto-deleted)'

        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

        return `${days}d ${hours}h remaining`
    }

    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Restore Backup"
                subtitle="Restore deleted items within 15 days"
            />

            {/* Tabs */}
            <Card>
                <div className="border-b dark:border-zinc-700">
                    <div className="flex justify-between items-center p-4">
                        <div className="flex gap-4">
                            {['products', 'sales', 'purchases', 'suppliers'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 font-medium rounded-lg transition-colors ${activeTab === tab
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                        {activeTab === 'products' && (
                            <>
                                <button
                                    onClick={async () => {
                                        if (isSyncing) return;
                                        setIsSyncing(true)
                                        try {
                                            const res = await restoreMissingBackups()
                                            if (res.count > 0) {
                                                alert(`Success: ${res.message}`)
                                                queryClient.invalidateQueries({ queryKey: ['deleted-items'] })
                                            } else {
                                                alert(res.message)
                                            }
                                        } catch (e: any) {
                                            alert(e.message)
                                        } finally {
                                            setIsSyncing(false)
                                        }
                                    }}
                                    disabled={isSyncing}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                                >
                                    <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                                    {isSyncing ? 'Syncing...' : 'Sync Missing Backups'}
                                </button>
                                <button
                                    onClick={async () => {
                                        if (isSyncing) return;
                                        if (!confirm("WARNING: This will PERMANENTLY delete all items in the backup list! \n\nThey cannot be restored. Continue?")) return;

                                        setIsSyncing(true)
                                        try {
                                            const res = await permanentlyDeleteAllProductsBackup()
                                            if (res.success) {
                                                alert(res.message)
                                                queryClient.invalidateQueries({ queryKey: ['deleted-items'] })
                                            }
                                        } catch (e: any) {
                                            alert(e.message)
                                        } finally {
                                            setIsSyncing(false)
                                        }
                                    }}
                                    disabled={isSyncing}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-red-200 dark:border-red-800 ml-2"
                                >
                                    <Trash2 size={14} />
                                    Delete All
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Content */}
                <CardContent className="p-6">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading backup...</div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">Error: {error.message}</div>
                    ) : !deletedItems || deletedItems.length === 0 ? (
                        <div className="text-center py-12">
                            <Trash2 className="mx-auto mb-4 text-gray-400" size={48} />
                            <p className="text-lg font-medium">No deleted items</p>
                            <p className="text-sm text-gray-500 mt-2">No deleted {activeTab} in the backup</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {deletedItems.map((item: any) => {
                                const now = new Date().getTime()
                                const expiry = new Date(item.expires_at).getTime()
                                const diff = expiry - now
                                const isExpiringSoon = diff < 3 * 24 * 60 * 60 * 1000 // Less than 3 days

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4 rounded-lg border-2 ${isExpiringSoon
                                            ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10'
                                            : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            {/* Left: Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
                                                        Deleted
                                                    </span>
                                                    {isExpiringSoon && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                                                            <AlertTriangle size={12} />
                                                            Expiring Soon
                                                        </span>
                                                    )}
                                                </div>

                                                <h3 className="text-lg font-semibold mb-1">{item.resource_name}</h3>

                                                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                                    <p>
                                                        <span className="font-medium">Deleted by:</span>{' '}
                                                        {item.metadata?.deleted_by_name || 'Unknown'}
                                                    </p>
                                                    {activeTab === 'sales' && (
                                                        <>
                                                            <p>
                                                                <span className="font-medium">Customer:</span>{' '}
                                                                {item.metadata?.customer_name || 'Unknown'}
                                                            </p>
                                                            <p>
                                                                <span className="font-medium">Order Date:</span>{' '}
                                                                {item.metadata?.order_date ? new Date(item.metadata.order_date).toLocaleDateString() : 'Unknown'}
                                                            </p>
                                                        </>
                                                    )}
                                                    {item.approved_by && (
                                                        <p>
                                                            <span className="font-medium">Approved by:</span>{' '}
                                                            {item.metadata?.approved_by_name || 'Unknown'}
                                                        </p>
                                                    )}
                                                    <p>
                                                        <span className="font-medium">Deleted at:</span>{' '}
                                                        {new Date(item.deleted_at).toLocaleString()}
                                                    </p>
                                                    <p className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        <span className="font-medium">Time remaining:</span>{' '}
                                                        <span className={isExpiringSoon ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''}>
                                                            {getTimeRemaining(item.expires_at)}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleRestore(item.id, item.resource_name)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                                >
                                                    <RotateCcw size={16} />
                                                    Restore
                                                </button>

                                                {activeTab === 'sales' && (
                                                    <button
                                                        onClick={() => handlePermanentDelete(item.id, item.resource_name)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                        Delete Forever
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card >
        </div >
    )
}
