'use client'

import { useState } from 'react'
import { Button, Card, CardContent } from '@/components/ui-shim'
import { useOnlineStores, useDeleteOnlineStore, useToggleOnlineStoreSyncMode } from '../hooks/useStores'
import { Edit, Trash2, Plus, ShoppingBag, MessageSquare, Package, Link2 } from 'lucide-react'
import OnlineStoreForm from './OnlineStoreForm'
import { toast } from 'sonner'

export default function OnlineStoreList() {
    const { data: stores, isLoading } = useOnlineStores()
    const deleteStore = useDeleteOnlineStore()
    const toggleSyncMode = useToggleOnlineStoreSyncMode()
    const [showForm, setShowForm] = useState(false)
    const [editingStore, setEditingStore] = useState<any>(null)
    const [linkingStoreId, setLinkingStoreId] = useState<string | null>(null)

    const handleEdit = (store: any) => {
        setEditingStore(store)
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this online store?')) {
            await deleteStore.mutateAsync(id)
        }
    }

    const handleCloseForm = () => {
        setShowForm(false)
        setEditingStore(null)
    }

    const handleToggleOrderSync = async (store: any) => {
        const nextVal = store.order_sync_enabled === false
        try {
            const res = await toggleSyncMode.mutateAsync({
                id: store.id,
                mode: { order_sync_enabled: nextVal },
            })
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(
                    nextVal
                        ? `Order & Finance Sync enabled for ${store.seller_account}`
                        : `${store.seller_account} set to Product Listing Only (Order & Finance Sync disabled)`
                )
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to update Order Sync setting')
        }
    }

    const handleToggleChatReview = async (store: any) => {
        const nextVal = store.chat_review_enabled === false
        try {
            const res = await toggleSyncMode.mutateAsync({
                id: store.id,
                mode: { chat_review_enabled: nextVal },
            })
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(
                    nextVal
                        ? `Chat AI & Reviews enabled for ${store.seller_account}`
                        : `Chat AI & Reviews disabled for ${store.seller_account}`
                )
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to update Chat AI & Reviews setting')
        }
    }

    const handleConnectDaraz = async (store: any) => {
        try {
            setLinkingStoreId(store.id)
            const originParam = typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : ''
            const response = await fetch(`/api/daraz/auth/url?storeId=${store.id}${originParam}`)
            const data = await response.json()
            if (data.url) {
                window.location.href = data.url
            } else {
                throw new Error(data.error || 'Failed to get Daraz authorization URL')
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to initiate Daraz connection')
            setLinkingStoreId(null)
        }
    }

    if (isLoading) {
        return <p className="text-muted-foreground">Loading online stores...</p>
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Online Stores</h2>
                    <p className="text-sm text-muted-foreground">Manage your online marketplace accounts and sync features</p>
                </div>
                <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus size={16} className="mr-2" />
                    Add Online Store
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-zinc-800 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">S.N</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seller Account</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seller ID</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PAN/VAT</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order &amp; Finance Sync</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chat AI &amp; Reviews</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                                {stores?.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                                            No online stores found. Click &quot;Add Online Store&quot; to create one.
                                        </td>
                                    </tr>
                                ) : (
                                    stores?.map((store: any, index: number) => {
                                        const orderSyncOn = store.order_sync_enabled !== false
                                        const chatReviewOn = store.chat_review_enabled !== false

                                        return (
                                            <tr key={store.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">{index + 1}</td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="font-medium text-gray-900 dark:text-zinc-100">{store.seller_account}</div>
                                                    {!orderSyncOn && (
                                                        <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                            <Package size={10} />
                                                            Product Listing Only
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono">{store.seller_id}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm">{store.company_name}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">{store.pan_vat_number}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleOrderSync(store)}
                                                        disabled={toggleSyncMode.isPending}
                                                        title={orderSyncOn ? 'Click to disable Order & Finance Sync (set to Product Listing Only)' : 'Click to enable Order & Finance Sync'}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                                            orderSyncOn
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                                        }`}
                                                    >
                                                        <ShoppingBag size={12} />
                                                        <span>{orderSyncOn ? 'ON (Orders + Finance)' : 'OFF (Products Only)'}</span>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleChatReview(store)}
                                                        disabled={toggleSyncMode.isPending}
                                                        title={chatReviewOn ? 'Click to disable Chat AI & Reviews for this store' : 'Click to enable Chat AI & Reviews for this store'}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                                            chatReviewOn
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                                        }`}
                                                    >
                                                        <MessageSquare size={12} />
                                                        <span>{chatReviewOn ? 'ON' : 'OFF'}</span>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConnectDaraz(store)}
                                                        disabled={linkingStoreId === store.id}
                                                        title="Connect / Re-Auth Daraz API Token"
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 transition-colors"
                                                    >
                                                        <Link2 size={13} />
                                                        {linkingStoreId === store.id ? 'Linking...' : 'Connect'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(store)}
                                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 p-1"
                                                        title="Edit Store"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(store.id)}
                                                        className="text-red-600 hover:text-red-900 dark:text-red-400 p-1"
                                                        title="Delete Store"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {showForm && (
                <OnlineStoreForm
                    store={editingStore}
                    onClose={handleCloseForm}
                />
            )}
        </div>
    )
}
