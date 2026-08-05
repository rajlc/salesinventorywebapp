'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSuppliers, deleteSupplier } from '@/features/suppliers/actions/supplier-actions'
import { ArrowLeft, Plus, Search, X, Trash2, Edit2 } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { AddSupplierModal } from '@/features/suppliers/components/AddSupplierModal'

interface SuppliersListContentProps {
    isEmbedded?: boolean
}

export default function SuppliersListContent({ isEmbedded = false }: SuppliersListContentProps) {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingSupplier, setEditingSupplier] = useState<any>(null)
    const [viewingSupplier, setViewingSupplier] = useState<any>(null)
    const queryClient = useQueryClient()

    // Fetch suppliers with pagination and search
    const { data, isLoading, error } = useQuery({
        queryKey: ['suppliers', page, search],
        queryFn: () => getSuppliers({ page, search, limit: 50 })
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: deleteSupplier,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] })
            queryClient.invalidateQueries({ queryKey: ['supplier-ledger'] })
        }
    })

    const handleSearch = () => {
        setSearch(searchInput)
        setPage(1) // Reset to first page on new search
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
    }

    const handleDelete = async (supplierId: string, supplierName: string) => {
        if (!confirm(`Are you sure you want to delete "${supplierName}"?`)) {
            return
        }

        try {
            await deleteMutation.mutateAsync(supplierId)
            alert('Supplier deleted successfully')
        } catch (error: any) {
            alert(`Delete error: ${error.message}`)
        }
    }

    return (
        <div className={`flex flex-col h-full bg-gray-50 dark:bg-zinc-900 ${!isEmbedded ? '' : 'overflow-hidden'}`}>
            {/* Compact Header - Only show if not embedded */}
            {!isEmbedded && (
                <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold">Suppliers List</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">Manage suppliers</p>
                    </div>
                    <Link
                        href="/dashboard/suppliers"
                        className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        Back to Suppliers
                    </Link>
                </div>
            )}

            {/* Compact Action Bar */}
            <div className={`sticky ${!isEmbedded ? 'top-[44px]' : 'top-0'} z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm`}>
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Compact Search */}
                    <div className="flex-1 min-w-[200px] max-w-sm">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                            <input
                                type="text"
                                placeholder="Search suppliers..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-6 pr-6 py-1 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                            />
                            {searchInput && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Add Supplier Button (Desktop) */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="hidden md:flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        <Plus size={12} />
                        Add Suppliers
                    </button>
                </div>
            </div>

            {/* Suppliers Table (Desktop) */}
            <div className="flex-1 overflow-auto px-3 py-3 pb-24 md:pb-3">
                <Card className="hidden md:block overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-10">S.N</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Supplier Name</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Contact Details</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Remarks</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Price Req.</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            Loading suppliers...
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={5} className="px-2 py-8 text-center text-[15px] text-red-500">
                                            Error loading suppliers: {(error as any).message}
                                        </td>
                                    </tr>
                                ) : !data || data.suppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            No suppliers found. {search && 'Try a different search term or '}
                                            <button className="text-blue-600 hover:underline" onClick={() => setIsModalOpen(true)}>add your first supplier</button>.
                                        </td>
                                    </tr>
                                ) : (
                                    data.suppliers.map((supplier: any, index: number) => (
                                        <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-lg hover:z-10 relative transition-all duration-200">
                                            <td className="px-2 py-1.5 text-[13px] text-gray-500">
                                                {(page - 1) * 50 + index + 1}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] font-medium">
                                                {supplier.supplier_name}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                                                {supplier.contact_details || '-'}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                                                {supplier.remarks || '-'}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px]">
                                                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${supplier.price_requirement !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-400'}`}>
                                                    {supplier.price_requirement !== false ? 'Yes' : 'No'}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setEditingSupplier(supplier)}
                                                        className="px-2 py-0.5 text-[13px] text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded flex items-center gap-1"
                                                    >
                                                        <Edit2 size={12} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(supplier.id, supplier.supplier_name)}
                                                        className="px-2 py-0.5 text-[13px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-1"
                                                    >
                                                        <Trash2 size={12} />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {isLoading ? (
                        <div className="text-center p-4 text-gray-500">Loading suppliers...</div>
                    ) : !data || data.suppliers.length === 0 ? (
                        <div className="text-center p-4 text-gray-500">No suppliers found.</div>
                    ) : (
                        data.suppliers.map((supplier: any) => (
                            <div
                                key={supplier.id}
                                onClick={() => setViewingSupplier(supplier)}
                                className="bg-white dark:bg-zinc-900 p-3 rounded-lg border shadow-sm active:bg-gray-50 transition-colors"
                            >
                                <div className="font-medium text-gray-900 dark:text-gray-100">{supplier.supplier_name}</div>
                                <div className="flex justify-between items-center mt-1">
                                    <div className="text-xs text-gray-500">{supplier.contact_details || 'No contact info'}</div>
                                    <div className={`text-[10px] px-1.5 py-0.5 rounded-full ${supplier.price_requirement !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                        Price Req: {supplier.price_requirement !== false ? 'Yes' : 'No'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination (Common) */}
                {data && data.pagination.totalPages > 1 && (
                    <div className="border-t dark:border-zinc-800 px-3 py-2 mt-2 md:mt-0 bg-white dark:bg-zinc-900 md:bg-transparent">
                        <div className="flex items-center justify-center gap-1.5">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-gray-500">
                                Page {page} of {data.pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                                disabled={page === data.pagination.totalPages}
                                className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Actions: FAB */}
            <div className="md:hidden fixed bottom-20 right-4 z-40">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="h-12 w-12 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
                >
                    <Plus size={24} />
                </button>
            </div>

            {/* View Box Modal (Mobile) */}
            {viewingSupplier && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewingSupplier(null)}>
                    <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg">{viewingSupplier.supplier_name}</h3>
                            <button onClick={() => setViewingSupplier(null)}><X size={20} className="text-gray-500" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Contact Details</label>
                                <div className="text-sm">{viewingSupplier.contact_details || '-'}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Remarks</label>
                                <div className="text-sm">{viewingSupplier.remarks || '-'}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Price Requirement</label>
                                <div className="text-sm">{viewingSupplier.price_requirement !== false ? 'Yes (Unit Amount Required)' : 'No (Unit Amount Optional)'}</div>
                            </div>
                        </div>
                        <div className="p-4 border-t dark:border-zinc-800 flex gap-2">
                            <button
                                onClick={() => {
                                    setEditingSupplier(viewingSupplier)
                                    setViewingSupplier(null)
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium"
                            >
                                <Edit2 size={16} /> Edit
                            </button>
                            <button
                                onClick={() => {
                                    handleDelete(viewingSupplier.id, viewingSupplier.supplier_name)
                                    setViewingSupplier(null)
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg font-medium"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Supplier Modal */}
            <AddSupplierModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />

            {/* Edit Supplier Modal */}
            {editingSupplier && (
                <AddSupplierModal
                    isOpen={true}
                    onClose={() => setEditingSupplier(null)}
                    editMode={true}
                    supplierData={editingSupplier}
                />
            )}
        </div>
    )
}
