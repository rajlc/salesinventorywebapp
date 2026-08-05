'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Label } from '@/components/ui-shim'
import { useCreateOnlineStore, useUpdateOnlineStore } from '../hooks/useStores'
import { X } from 'lucide-react'

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
            })
        }
    }, [store])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
                    <div className="grid grid-cols-2 gap-4">
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

                    <div>
                        <Label htmlFor="logo_url">Logo URL (Optional)</Label>
                        <Input
                            id="logo_url"
                            value={formData.logo_url}
                            onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                            placeholder="https://..."
                        />
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
