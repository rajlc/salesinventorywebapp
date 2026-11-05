'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Label } from '@/components/ui-shim'
import { useCreateOnlineStore, useUpdateOnlineStore } from '../hooks/useStores'
import { X, ShoppingBag, MessageSquare, Package } from 'lucide-react'

interface OnlineStoreFormProps {
    store?: any
    onClose: () => void
}

export default function OnlineStoreForm({ store, onClose }: OnlineStoreFormProps) {
    const [formData, setFormData] = useState({
        seller_account: '',
        seller_id: '',
        company_name: '',
        address: '',
        pan_vat_number: '',
        contact: '',
        logo_url: '',
        order_sync_enabled: true,
        chat_review_enabled: true,
    })
    const [error, setError] = useState('')

    const createStore = useCreateOnlineStore()
    const updateStore = useUpdateOnlineStore()

    useEffect(() => {
        if (store) {
            setFormData({
                seller_account: store.seller_account || '',
                seller_id: store.seller_id || '',
                company_name: store.company_name || '',
                address: store.address || '',
                pan_vat_number: store.pan_vat_number || '',
                contact: store.contact || '',
                logo_url: store.logo_url || '',
                order_sync_enabled: store.order_sync_enabled !== false,
                chat_review_enabled: store.chat_review_enabled !== false,
            })
        }
    }, [store])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!formData.seller_account || !formData.seller_id || !formData.company_name || !formData.address || !formData.pan_vat_number || !formData.contact) {
            setError('All required fields must be filled')
            return
        }

        try {
            if (store) {
                const result = await updateStore.mutateAsync({
                    id: store.id,
                    data: formData,
                })
                if (result.error) {
                    setError(result.error)
                    return
                }
            } else {
                const result = await createStore.mutateAsync(formData)
                if (result.error) {
                    setError(result.error)
                    return
                }
            }
            onClose()
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">
                        {store ? 'Edit Online Store' : 'Add Online Store'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="seller_account">Seller Account *</Label>
                            <Input
                                id="seller_account"
                                value={formData.seller_account}
                                onChange={(e) => setFormData({ ...formData, seller_account: e.target.value })}
                                placeholder="e.g., Daraz Official Store"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="seller_id">Seller ID *</Label>
                            <Input
                                id="seller_id"
                                value={formData.seller_id}
                                onChange={(e) => setFormData({ ...formData, seller_id: e.target.value })}
                                placeholder="Unique seller identifier"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="company_name">Company Name *</Label>
                        <Input
                            id="company_name"
                            value={formData.company_name}
                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                            placeholder="Company legal name"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="address">Address *</Label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Full business address"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="pan_vat_number">PAN/VAT Number *</Label>
                            <Input
                                id="pan_vat_number"
                                value={formData.pan_vat_number}
                                onChange={(e) => setFormData({ ...formData, pan_vat_number: e.target.value })}
                                placeholder="Tax identification number"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="contact">Contact *</Label>
                            <Input
                                id="contact"
                                value={formData.contact}
                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                placeholder="Phone number, email, or contact person"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="logo_url">Logo URL (Optional)</Label>
                        <Input
                            id="logo_url"
                            value={formData.logo_url}
                            onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>

                    {/* Store Features & Sync Mode Toggles */}
                    <div className="pt-2 border-t border-gray-200 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                                Daraz Store Features &amp; Sync Settings
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                <Package size={12} />
                                Product Listing Always Enabled
                            </span>
                        </div>

                        {/* Toggle 1: Order & Finance Sync */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                            <div className="flex items-start gap-2.5 pr-4">
                                <div className={`p-2 rounded-lg mt-0.5 ${formData.order_sync_enabled ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400' : 'bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                                    <ShoppingBag size={16} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                                        Order &amp; Finance Sync
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                                        {formData.order_sync_enabled
                                            ? 'Enabled: Syncs Daraz orders, shows in Sales Entry, Order List, and Finance / PAN-VAT reports.'
                                            : 'Disabled (Product Listing Only): Will NOT sync orders or show in Sales Entry & Finance.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={formData.order_sync_enabled}
                                onClick={() => setFormData(prev => ({ ...prev, order_sync_enabled: !prev.order_sync_enabled }))}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    formData.order_sync_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-zinc-700'
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        formData.order_sync_enabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Toggle 2: Chat AI & Reviews */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                            <div className="flex items-start gap-2.5 pr-4">
                                <div className={`p-2 rounded-lg mt-0.5 ${formData.chat_review_enabled ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                                    <MessageSquare size={16} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                                        Chat AI &amp; Customer Reviews
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                                        {formData.chat_review_enabled
                                            ? 'Enabled: Shows store in Daraz Chat AI & Customer Reviews, with AI auto-reply & review sync.'
                                            : 'Disabled: Hidden from Chat AI & Reviews; skips chat webhooks & review cron sync.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={formData.chat_review_enabled}
                                onClick={() => setFormData(prev => ({ ...prev, chat_review_enabled: !prev.chat_review_enabled }))}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    formData.chat_review_enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-zinc-700'
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        formData.chat_review_enabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button variant="outline" type="button" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={createStore.isPending || updateStore.isPending}
                        >
                            {createStore.isPending || updateStore.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
