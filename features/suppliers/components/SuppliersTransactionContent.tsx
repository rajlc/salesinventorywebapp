'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupplierTransactions, createSupplierTransaction, updateSupplierTransaction } from '@/features/suppliers/actions/supplier-transaction-actions'
import { getSuppliers } from '@/features/suppliers/actions/supplier-actions'
import { ArrowLeft, Search, Plus, X, Loader2, Eye } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import AsyncSelect from 'react-select/async'
import { toast } from 'sonner'

import { getPanVatCompanies } from '@/features/account/actions/pan-vat-company-actions'

interface SuppliersTransactionContentProps {
    isEmbedded?: boolean
}

export default function SuppliersTransactionContent({ isEmbedded = false }: SuppliersTransactionContentProps) {
    const [search, setSearch] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [selectedDetail, setSelectedDetail] = useState<any>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const queryClient = useQueryClient()

    // --- Data Fetching ---
    const { data, isLoading } = useQuery({
        queryKey: ['supplier-transactions', search],
        queryFn: () => getSupplierTransactions({ search })
    })

    const { data: companiesData } = useQuery({
        queryKey: ['pan-vat-companies'],
        queryFn: getPanVatCompanies
    })
    const panVatCompanies = companiesData || []

    const transactions = data?.transactions || []

    // --- Modal State & Logic ---
    const [formData, setFormData] = useState({
        transaction_date: new Date().toISOString().split('T')[0],
        supplier_id: '',
        supplier_name: '',
        transaction_mode: 'Cash',
        transaction_type: 'Paid',
        amount: '',
        payment_method: 'Cash',
        cheque_date: '',
        cheque_type: 'Personal',
        cheque_name: '',
        cheque_image_url: '',
        remarks: ''
    })

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null)

    // Reset form
    const resetForm = () => {
        setFormData({
            transaction_date: new Date().toISOString().split('T')[0],
            supplier_id: '',
            supplier_name: '',
            transaction_mode: 'Cash',
            transaction_type: 'Paid',
            amount: '',
            payment_method: 'Cash',
            cheque_date: '',
            cheque_type: 'Personal',
            cheque_name: '',
            cheque_image_url: '',
            remarks: ''
        })
        setEditingId(null)
    }

    // Handle Edit
    const handleEdit = (transaction: any) => {
        setEditingId(transaction.id)
        setFormData({
            transaction_date: new Date(transaction.transaction_date).toISOString().split('T')[0],
            supplier_id: transaction.supplier_id,
            supplier_name: transaction.supplier?.supplier_name || '',
            transaction_mode: transaction.transaction_mode,
            transaction_type: transaction.transaction_type,
            amount: transaction.amount.toString(),
            payment_method: transaction.payment_method,
            cheque_date: transaction.cheque_date || '',
            cheque_type: transaction.cheque_type || 'Personal',
            cheque_name: transaction.cheque_name || '',
            cheque_image_url: transaction.cheque_image_url || '',
            remarks: transaction.remarks || ''
        })
        setSelectedDetail(null)
        setIsAddModalOpen(true)
    }

    // Handle Payment Method Logic based on Transaction Type
    const handleTransactionModeChange = (mode: string) => {
        let defaultMethod = 'Cash'
        if (mode === 'Cheque') defaultMethod = 'BTAS Global'
        if (mode === 'Online Payment') defaultMethod = 'Bank Transfer'

        setFormData(prev => ({
            ...prev,
            transaction_mode: mode,
            payment_method: defaultMethod,
            cheque_date: mode === 'Cheque' ? prev.cheque_date : '' // Clear cheque date if not cheque
        }))
    }

    // Load Suppliers for AsyncSelect
    const loadSupplierOptions = (inputValue: string) =>
        getSuppliers({ search: inputValue, limit: 20 }).then(res =>
            res.suppliers.map((s: any) => ({ value: s.id, label: s.supplier_name }))
        )


    // Sound Logic
    const playClapSound = () => {
        try {
            const clapAudio = new Audio("https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3");
            clapAudio.volume = 0.5;
            clapAudio.play().catch(e => console.error("Audio play failed", e));
        } catch (e) {
            console.error("Sound error", e)
        }
    }

    const triggerMobileFeedback = (withSound: boolean) => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            if (navigator.vibrate) {
                navigator.vibrate(200)
            }
            if (withSound) {
                playClapSound()
            }
        }
    }

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: createSupplierTransaction,
        onSuccess: () => {
            triggerMobileFeedback(true)
            toast.success('Transaction added successfully')
            setIsAddModalOpen(false)
            resetForm()
            queryClient.invalidateQueries({ queryKey: ['supplier-transactions'] })
        },
        onError: () => {
            toast.error('Failed to add transaction')
        }
    })

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateSupplierTransaction({ id, data }),
        onSuccess: () => {
            triggerMobileFeedback(true)
            toast.success('Update Success')
            setIsAddModalOpen(false)
            resetForm()
            queryClient.invalidateQueries({ queryKey: ['supplier-transactions'] })
        },
        onError: () => {
            toast.error('Failed to update transaction')
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.supplier_id || !formData.amount) {
            toast.error('Please fill in all required fields')
            return
        }
        if (formData.transaction_mode === 'Cheque' && !formData.cheque_date) {
            toast.error('Cheque Date is required for Cheque transactions')
            return
        }

        setIsSubmitting(true)

        const payload = {
            transaction_date: formData.transaction_date,
            supplier_id: formData.supplier_id,
            transaction_mode: formData.transaction_mode,
            transaction_type: formData.transaction_type,
            amount: parseFloat(formData.amount),
            payment_method: formData.payment_method,
            cheque_date: formData.transaction_mode === 'Cheque' ? formData.cheque_date : null,
            cheque_type: formData.transaction_mode === 'Cheque' ? formData.cheque_type : null,
            cheque_name: formData.transaction_mode === 'Cheque' ? formData.cheque_name : null,
            cheque_image_url: formData.transaction_mode === 'Cheque' ? formData.cheque_image_url : null,
            remarks: formData.remarks
        }

        if (editingId) {
            updateMutation.mutate({ id: editingId, data: payload }, {
                onSettled: () => setIsSubmitting(false)
            })
        } else {
            createMutation.mutate(payload, {
                onSettled: () => setIsSubmitting(false)
            })
        }
    }

    return (
        <div className={`flex flex-col h-full bg-gray-50 dark:bg-zinc-900 ${!isEmbedded ? '' : 'overflow-hidden'}`}>
            {/* Header - Only show if not embedded */}
            {!isEmbedded && (
                <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold">Supplier Transactions</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">View supplier transactions</p>
                    </div>
                    <Link
                        href="/dashboard/suppliers"
                        className="flex items-center gap-1 px-2 py-1 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Back to Suppliers
                    </Link>
                </div>
            )}

            {/* Controls */}
            <div className={`sticky ${!isEmbedded ? 'top-0' : 'top-0'} z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 shadow-sm`}>
                <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search supplier name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
                        />
                    </div>

                    <button
                        onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                        className="hidden md:flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                    >
                        <Plus size={16} />
                        Add New Transaction
                    </button>
                </div>
            </div>

            {/* Mobile FAB with 3D Glow - Show only if we want to support mobile add in both views */}
            <div className="md:hidden fixed bottom-24 right-4 z-40 bg-transparent">
                <div className="relative group overflow-hidden rounded-xl p-[1px]">
                    <div className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#bfdbfe_0%,#3b82f6_50%,#bfdbfe_100%)]" />
                    <button
                        onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                        className="relative h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg text-white hover:bg-blue-700 active:scale-95 transition-all"
                    >
                        <Plus size={24} />
                    </button>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="flex-1 overflow-auto p-2 md:p-3">
                <Card className="hidden md:block overflow-hidden bg-white shadow-sm dark:bg-zinc-900 border-y md:border rounded-none md:rounded-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-black dark:text-white">Date</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-black dark:text-white">Supplier</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-black dark:text-white">Type</th>
                                    <th className="hidden md:table-cell px-3 py-2 text-xs font-bold uppercase text-black dark:text-white">Mode</th>
                                    <th className="hidden md:table-cell px-3 py-2 text-xs font-bold uppercase text-black dark:text-white">Method</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-black dark:text-white text-right">Amount</th>
                                    <th className="hidden md:table-cell px-3 py-2 text-xs font-bold uppercase text-black dark:text-white text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr><td colSpan={6} className="p-4 text-center text-sm text-gray-500">Loading transactions...</td></tr>
                                ) : transactions.length === 0 ? (
                                    <tr><td colSpan={6} className="p-4 text-center text-sm text-gray-500">No transactions found.</td></tr>
                                ) : (
                                    transactions.map((t: any) => (
                                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-3 py-2 text-sm whitespace-nowrap">{t.transaction_date}</td>
                                            <td
                                                className="px-3 py-2 text-sm font-medium text-gray-900"
                                            >
                                                {t.supplier?.supplier_name}
                                            </td>
                                            <td className="px-3 py-2 text-sm">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.transaction_type === 'Received' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {t.transaction_type}
                                                </span>
                                            </td>
                                            <td className="hidden md:table-cell px-3 py-2 text-sm">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.transaction_mode === 'Cash' ? 'bg-green-100 text-green-700' :
                                                    t.transaction_mode === 'Cheque' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {t.transaction_mode}
                                                </span>
                                            </td>
                                            <td className="hidden md:table-cell px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                                                {t.payment_method}
                                                {t.cheque_date && <span className="text-xs text-gray-400 ml-1">({t.cheque_date})</span>}
                                                {t.cheque_name && (
                                                    <div className="text-[11px] text-gray-500 mt-0.5">
                                                        Name: {t.cheque_name} ({t.cheque_type})
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                                                Rs {t.amount.toLocaleString()}
                                            </td>
                                            <td className="hidden md:table-cell px-3 py-2 text-sm text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    {t.cheque_image_url && (
                                                        <button
                                                            onClick={() => setActivePhotoUrl(t.cheque_image_url)}
                                                            className="text-purple-600 hover:text-purple-700 text-xs font-semibold"
                                                        >
                                                            View
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleEdit(t)} className="text-blue-600 hover:text-blue-700 text-xs font-medium">Edit</button>
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
                <div className="md:hidden space-y-3 pb-24">
                    {isLoading ? (
                        <div className="text-center p-4 text-gray-500">Loading transactions...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center p-4 text-gray-500">No transactions found.</div>
                    ) : (
                        transactions.map((t: any) => (
                            <div
                                key={t.id}
                                onClick={() => setSelectedDetail(t)}
                                className="bg-white dark:bg-zinc-900 p-3 rounded-lg border shadow-sm active:bg-gray-50 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-medium text-gray-900 dark:text-gray-100">{t.supplier?.supplier_name}</div>
                                    <div className="font-bold text-gray-900 dark:text-gray-100">Rs {t.amount.toLocaleString()}</div>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <div className="text-gray-500 text-xs">{t.transaction_date}</div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${t.transaction_mode === 'Cash' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {t.transaction_mode}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${t.transaction_type === 'Received' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {t.transaction_type}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Detail View Modal (Mobile Only) */}
            {selectedDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden flex flex-col">
                        <div className="px-4 py-3 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
                            <h3 className="font-bold text-gray-900 dark:text-gray-100">Transaction Details</h3>
                            <button onClick={() => setSelectedDetail(null)} className="text-gray-500 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <label className="text-xs text-gray-500">Date</label>
                                    <div className="font-medium">{selectedDetail.transaction_date}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Amount</label>
                                    <div className="font-bold text-gray-900 dark:text-white">Rs {selectedDetail.amount.toLocaleString()}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-gray-500">Supplier</label>
                                    <div className="font-medium text-blue-600">{selectedDetail.supplier?.supplier_name}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Type</label>
                                    <div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedDetail.transaction_type === 'Received' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {selectedDetail.transaction_type}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Mode</label>
                                    <div>{selectedDetail.transaction_mode}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-gray-500">Method</label>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1 font-medium">
                                            {selectedDetail.payment_method}
                                            {selectedDetail.cheque_date && <span className="text-xs text-gray-400">({selectedDetail.cheque_date})</span>}
                                        </div>
                                        {selectedDetail.cheque_name && (
                                            <div className="text-xs text-gray-500">
                                                Cheque for: {selectedDetail.cheque_name} ({selectedDetail.cheque_type})
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {selectedDetail.cheque_image_url && (
                                    <div className="col-span-2">
                                        <label className="text-xs text-gray-500">Cheque Photo</label>
                                        <div className="mt-1">
                                            <button
                                                onClick={() => {
                                                    setActivePhotoUrl(selectedDetail.cheque_image_url)
                                                    setSelectedDetail(null)
                                                }}
                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 rounded-md border border-purple-100 dark:border-purple-900/50 hover:bg-purple-100 transition-colors text-xs font-semibold"
                                            >
                                                <Eye size={14} />
                                                View Cheque Photo
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {selectedDetail.remarks && (
                                    <div className="col-span-2 bg-gray-50 dark:bg-zinc-800 p-2 rounded text-xs text-gray-600">
                                        <span className="font-semibold">Remarks:</span> {selectedDetail.remarks}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-3 border-t dark:border-zinc-800 flex gap-3">
                            <button
                                onClick={() => handleEdit(selectedDetail)}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-md font-medium text-sm hover:bg-blue-700"
                            >
                                Edit Transaction
                            </button>
                            <button
                                onClick={() => setSelectedDetail(null)}
                                className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Transaction Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 md:p-4">
                    <div className="w-full max-w-lg h-full md:h-auto md:max-h-[80vh] bg-white dark:bg-zinc-900 md:rounded-lg shadow-xl overflow-hidden flex flex-col">
                        <div className="px-4 py-3 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{editingId ? 'Edit Transaction' : 'Add New Transaction'}</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 max-h-[80vh] overflow-y-auto">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Date */}
                                <div>
                                    <label className="block text-xs font-medium mb-1">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.transaction_date}
                                        onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                    />
                                </div>

                                {/* Supplier */}
                                <div>
                                    <label className="block text-xs font-medium mb-1">Supplier Name <span className="text-red-500">*</span></label>
                                    <AsyncSelect
                                        cacheOptions
                                        defaultOptions
                                        loadOptions={loadSupplierOptions}
                                        value={formData.supplier_id ? { label: formData.supplier_name, value: formData.supplier_id } : null}
                                        onChange={(opt: any) => setFormData({ ...formData, supplier_id: opt?.value || '', supplier_name: opt?.label || '' })}
                                        className="text-sm"
                                        placeholder="Search supplier..."
                                        styles={{
                                            control: (base) => ({ ...base, backgroundColor: 'white', color: 'black', borderColor: 'var(--purchase-border)', borderWidth: 2 }),
                                            menu: (base) => ({ ...base, backgroundColor: 'white', zIndex: 9999, border: '2px solid var(--purchase-border)' }),
                                            option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : 'white', color: 'black' }),
                                            singleValue: (base) => ({ ...base, color: 'black' }),
                                            input: (base) => ({ ...base, color: 'black' }),
                                            placeholder: (base) => ({ ...base, color: '#6b7280' })
                                        }}
                                    />
                                </div>

                                {/* Transaction Type */}
                                <div>
                                    <label className="block text-xs font-medium mb-1">Transaction Type <span className="text-red-500">*</span></label>
                                    <select
                                        value={formData.transaction_type}
                                        onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                    >
                                        <option value="Paid">Paid</option>
                                        <option value="Received">Received</option>
                                    </select>
                                </div>

                                {/* Transaction Mode */}
                                <div>
                                    <label className="block text-xs font-medium mb-1">Transaction Mode <span className="text-red-500">*</span></label>
                                    <select
                                        value={formData.transaction_mode}
                                        onChange={(e) => handleTransactionModeChange(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Online Payment">Online Payment</option>
                                    </select>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="block text-xs font-medium mb-1">Amount <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        required
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                        placeholder="Enter amount"
                                    />
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="block text-xs font-medium mb-1">Payment Method <span className="text-red-500">*</span></label>
                                    <select
                                        value={formData.payment_method}
                                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                    >
                                        {formData.transaction_mode === 'Cash' && <option value="Cash">Cash</option>}

                                        {formData.transaction_mode === 'Cheque' && (
                                            <>
                                                <option value="BTAS Global">BTAS Global</option>
                                                <option value="BTAS NBL">BTAS NBL</option>
                                                <option value="Others">Others</option>
                                            </>
                                        )}

                                        {formData.transaction_mode === 'Online Payment' && (
                                            <>
                                                <option value="Bank Transfer">Bank Transfer</option>
                                                <option value="Esewa">Esewa</option>
                                                <option value="Khalti">Khalti</option>
                                                <option value="Others">Others</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                {/* Cheque Mode Fields */}
                                {formData.transaction_mode === 'Cheque' && (
                                    <>
                                        {/* Cheque Type */}
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Cheque Type <span className="text-red-500">*</span></label>
                                            <select
                                                value={formData.cheque_type}
                                                onChange={(e) => setFormData({ ...formData, cheque_type: e.target.value, cheque_name: '' })}
                                                className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                            >
                                                <option value="Personal">Personal</option>
                                                <option value="Company">Company</option>
                                            </select>
                                        </div>

                                        {/* Cheque Name */}
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Cheque Name <span className="text-red-500">*</span></label>
                                            {formData.cheque_type === 'Personal' ? (
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.cheque_name}
                                                    onChange={(e) => setFormData({ ...formData, cheque_name: e.target.value })}
                                                    className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                                    placeholder="Enter personal name"
                                                />
                                            ) : (
                                                <select
                                                    required
                                                    value={formData.cheque_name}
                                                    onChange={(e) => setFormData({ ...formData, cheque_name: e.target.value })}
                                                    className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                                >
                                                    <option value="">Select Company</option>
                                                    {panVatCompanies
                                                        .filter((c) => c.supplier_id === formData.supplier_id)
                                                        .map((c) => (
                                                            <option key={c.id} value={c.company_name}>
                                                                {c.company_name} (PAN: {c.pan_vat_no})
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                            )}
                                        </div>

                                        {/* Cheque Date */}
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Cheque Date <span className="text-red-500">*</span></label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.cheque_date}
                                                onChange={(e) => setFormData({ ...formData, cheque_date: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Remarks */}
                                <div>
                                    <label className="block text-xs font-medium mb-1">Remarks</label>
                                    <textarea
                                        rows={3}
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-500 dark:border-gray-400 rounded-md bg-white dark:bg-zinc-900"
                                        placeholder="Optional remarks..."
                                    />
                                </div>

                                <div className="pt-4 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 rounded-md"
                                    >
                                        Cancel
                                    </button>

                                    {/* Submit Button with 3D Glow */}
                                    <div className="relative group overflow-hidden rounded-md p-[1px]">
                                        <div className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#bfdbfe_0%,#3b82f6_50%,#bfdbfe_100%)]" />
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="relative w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                                            Save Transaction
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div >
                    </div >
                </div >
            )
            }

            {/* Lightbox Modal for Cheque Photo */}
            {activePhotoUrl && (
                <div 
                    className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm cursor-pointer"
                    onClick={() => setActivePhotoUrl(null)}
                >
                    <div className="relative max-w-4xl max-h-[95vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setActivePhotoUrl(null)}
                            className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors"
                            aria-label="Close preview"
                        >
                            <X className="h-7 w-7" />
                        </button>
                        <img
                            src={activePhotoUrl}
                            alt="Cheque image preview"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-zinc-800"
                        />
                    </div>
                </div>
            )}
        </div >
    )
}
