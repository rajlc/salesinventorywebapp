'use client'

import { useState } from 'react'
import { Button, Card, CardContent } from '@/components/ui-shim'
import { useOnlineStores, useDeleteOnlineStore } from '../hooks/useStores'
import { Edit, Trash2, Plus } from 'lucide-react'
import OnlineStoreForm from './OnlineStoreForm'

export default function OnlineStoreList() {
    const { data: stores, isLoading } = useOnlineStores()
    const deleteStore = useDeleteOnlineStore()
    const [showForm, setShowForm] = useState(false)
    const [editingStore, setEditingStore] = useState<any>(null)

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

    if (isLoading) {
        return <p className="text-muted-foreground">Loading online stores...</p>
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Online Stores</h2>
                    <p className="text-sm text-muted-foreground">Manage your online marketplace accounts</p>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">S.N</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seller Account</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seller ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PAN/VAT</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                                {stores?.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                                            No online stores found. Click "Add Online Store" to create one.
                                        </td>
                                    </tr>
                                ) : (
                                    stores?.map((store: any, index: number) => (
                                        <tr key={store.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{index + 1}</td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">{store.seller_account}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{store.seller_id}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{store.company_name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{store.pan_vat_number}</td>
                                            <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">{store.address}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                <button
                                                    onClick={() => handleEdit(store)}
                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(store.id)}
                                                    className="text-red-600 hover:text-red-900 dark:text-red-400"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
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
