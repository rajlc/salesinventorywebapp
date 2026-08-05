'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Label } from '@/components/ui-shim'
import { useCreateRetailStore, useUpdateRetailStore } from '../hooks/useStores'
import { X } from 'lucide-react'

interface RetailStoreFormProps {
    store?: any
    onClose: () => void
}

export default function RetailStoreForm({ store, onClose }: RetailStoreFormProps) {
    const [formData, setFormData] = useState({
        store_name: '',
        location: '',
        store_id: '',
        company_name: '',
        pan_vat_number: '',
        logo_url: '',
    })
    const [error, setError] = useState('')

    const createStore = useCreateRetailStore()
    const updateStore = useUpdateRetailStore()

    useEffect(() => {
        if (store) {
            setFormData({
                store_name: store.store_name || '',
                location: store.location || '',
                store_id: store.store_id || '',
                company_name: store.company_name || '',
                pan_vat_number: store.pan_vat_number || '',
                logo_url: store.logo_url || '',
            })
        }
    }, [store])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!formData.store_name || !formData.location || !formData.store_id) {
            setError('Store Name, Location, and Store ID are required')
            return
        }

        try {
            const submitData = {
                ...formData,
                company_name: formData.company_name || undefined,
                pan_vat_number: formData.pan_vat_number || undefined,
                logo_url: formData.logo_url || undefined,
            }

            if (store) {
                const result = await updateStore.mutateAsync({
                    id: store.id,
                    data: submitData,
                })
                if (result.error) {
                    setError(result.error)
                    return
                }
            } else {
                const result = await createStore.mutateAsync(submitData)
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
                        {store ? 'Edit Retail Store' : 'Add Retail Store'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="store_name">Store Name *</Label>
                            <Input
                                id="store_name"
                                value={formData.store_name}
                                onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                                placeholder="e.g., Main Branch"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="store_id">Store ID *</Label>
                            <Input
                                id="store_id"
                                value={formData.store_id}
                                onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                                placeholder="Unique store identifier"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="location">Location *</Label>
                        <Input
                            id="location"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            placeholder="Physical address"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="company_name">Company Name (Optional)</Label>
                        <Input
                            id="company_name"
                            value={formData.company_name}
                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                            placeholder="Company legal name"
                        />
                    </div>

                    <div>
                        <Label htmlFor="pan_vat_number">PAN/VAT Number (Optional)</Label>
                        <Input
                            id="pan_vat_number"
                            value={formData.pan_vat_number}
                            onChange={(e) => setFormData({ ...formData, pan_vat_number: e.target.value })}
                            placeholder="Tax identification number"
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
