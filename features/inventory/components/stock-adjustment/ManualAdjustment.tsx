'use client'

import { useState, useEffect } from 'react'
import { Calendar, Save, Upload, Download, Search, AlertTriangle, Trash2, Edit2, X, Check, PenTool, Layers } from 'lucide-react'
import Select from 'react-select'
import { getAllProductOptions } from '@/features/inventory/actions/product-actions'
import { saveManualAdjustment, getManualAdjustments, deleteManualAdjustment, updateManualAdjustment, ManualAdjustment as ManualAdjustmentType } from '@/features/inventory/actions/stock-adjustment-actions'
import { toast } from 'sonner'
import { ComboComponentSelectModal } from '@/features/inventory/components/ComboComponentSelectModal'

export default function ManualAdjustment() {
    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [location, setLocation] = useState('Main Warehouse')
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [quantity, setQuantity] = useState<number | ''>('')
    const [reason, setReason] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // Combo Resolving State
    const [comboResolving, setComboResolving] = useState<{ id: string, name: string } | null>(null)

    // History Data State
    const [history, setHistory] = useState<ManualAdjustmentType[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<ManualAdjustmentType>>({})

    // Mobile View Details Modal State
    const [viewDetailsItem, setViewDetailsItem] = useState<ManualAdjustmentType | null>(null)

    // Products State
    const [productOptions, setProductOptions] = useState<any[]>([])
    const [isLoadingProducts, setIsLoadingProducts] = useState(false)

    // Load history and products on mount
    useEffect(() => {
        fetchHistory()
        loadProducts()
    }, [])

    const fetchHistory = async () => {
        try {
            const data = await getManualAdjustments()
            setHistory(data)
        } catch (error) {
            console.error('Failed to load history', error)
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const loadProducts = async () => {
        setIsLoadingProducts(true)
        try {
            const products = await getAllProductOptions()
            const options = products.map((p: any) => ({
                value: p.id,
                label: `${p.product_name} ${p.seller_sku1 ? `(${p.seller_sku1})` : ''}`,
                product_type: p.product_type,
                name: p.product_name
            }))
            setProductOptions(options)
        } catch (error) {
            console.error("Failed to load products", error)
            toast.error("Failed to load products")
        } finally {
            setIsLoadingProducts(false)
        }
    }

    const handleProductChange = (option: any) => {
        // Combo disabled in UI
        /*
        if (option?.product_type === 'combo') {
            setComboResolving({
                id: option.value,
                name: option.name || option.label
            })
            setSelectedProduct(null)
            return
        }
        */
        setSelectedProduct(option)
    }

    // Save Handler
    const handleSave = async () => {
        if (!selectedProduct) {
            alert('Please select a product')
            return
        }
        if (quantity === '' || isNaN(Number(quantity))) {
            alert('Please enter a valid quantity')
            return
        }
        if (!reason.trim()) {
            alert('Please enter a reason')
            return
        }

        setIsSaving(true)
        try {
            await saveManualAdjustment({
                date,
                location,
                product_id: selectedProduct.value,
                quantity: Number(quantity),
                reason
            })

            // Reset form
            setSelectedProduct(null)
            setQuantity('')
            setReason('')
            toast.success("Manual adjustment saved successfully")

            // Refresh history
            await fetchHistory()
        } catch (error: any) {
            alert(`Error saving manual adjustment: ${error.message}`)
        } finally {
            setIsSaving(false)
        }
    }

    // Delete Handler
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this manual adjustment entry?')) return

        try {
            await deleteManualAdjustment(id)
            await fetchHistory()
            toast.success("Deleted successfully")
        } catch (error: any) {
            alert(`Error deleting: ${error.message}`)
        }
    }

    // Edit Handlers
    const startEdit = (item: ManualAdjustmentType) => {
        setEditingId(item.id)
        setEditForm({
            quantity: item.quantity,
            reason: item.reason
        })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
    }

    const saveEdit = async (id: string) => {
        if (editForm.quantity === undefined || isNaN(editForm.quantity)) {
            alert('Invalid quantity')
            return
        }

        try {
            await updateManualAdjustment(id, editForm)
            setEditingId(null)
            await fetchHistory()
            toast.success("Updated successfully")
        } catch (error: any) {
            alert(`Error updating: ${error.message}`)
        }
    }

    return (
        <div className="space-y-8">
            {/* ADD MANUAL ADJUSTMENT FORM */}
            <div className="p-4 border dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-900/50 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                        <PenTool size={20} />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Add Manual Stock Adjustment</h3>
                </div>

                <div className="space-y-4">
                    {/* Row 1: Date & Location */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full pl-2 pr-1 py-2 text-xs md:text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-zinc-900"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Location</label>
                            <select
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="w-full px-2 py-2 text-xs md:text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-zinc-900"
                            >
                                <option value="Main Warehouse">Main Warehouse</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Product */}
                    <div>
                        <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Product</label>
                        <Select
                            options={productOptions}
                            isLoading={isLoadingProducts}
                            onChange={handleProductChange}
                            value={selectedProduct}
                            placeholder={isLoadingProducts ? "Loading products..." : "Search product..."}
                            className="text-sm"
                            isOptionDisabled={(option: any) => option.product_type?.toLowerCase() === 'combo'}
                            formatOptionLabel={(option: any) => (
                                <div className="flex items-center gap-2">
                                    {option.product_type?.toLowerCase() === 'combo' && <Layers size={16} className="text-purple-500" />}
                                    <span>{option.label}</span>
                                </div>
                            )}
                            styles={{
                                control: (base, state) => ({
                                    ...base,
                                    borderColor: state.isFocused ? '#9333ea' : '#e5e7eb', // purple-600 if focused
                                    minHeight: '42px',
                                    borderRadius: '0.375rem',
                                    backgroundColor: 'white'
                                }),
                                menu: (base) => ({
                                    ...base,
                                    zIndex: 9999
                                })
                            }}
                            classNames={{
                                control: (state) =>
                                    `${state.isFocused ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-300 dark:border-zinc-700'} !bg-white dark:!bg-zinc-900 !text-gray-900 dark:!text-white`,
                                menu: () => '!bg-white dark:!bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-lg',
                                option: ({ isFocused }) => `cursor-pointer px-3 py-2 ${isFocused ? '!bg-purple-100 dark:!bg-zinc-800' : ''} !text-gray-900 dark:!text-white`,
                                singleValue: () => '!text-gray-900 dark:!text-white',
                                input: () => '!text-gray-900 dark:!text-white',
                                placeholder: () => '!text-gray-500 dark:!text-gray-400'
                            }}
                        />
                    </div>

                    {/* Row 3: Quantity & Reason */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Quantity <span className="text-gray-400 font-normal">(-)</span></label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value as any)}
                                placeholder="e.g. 10 or -5"
                                className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-white dark:text-black"
                                enterKeyHint="next"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Reason</label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Why this adjustment?"
                                className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-white dark:text-black"
                            />
                        </div>
                    </div>

                    {/* Row 4: Save Button */}
                    <div className="pt-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full md:w-auto float-right px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                        >
                            {isSaving ? 'Saving...' : (
                                <>
                                    <Save size={18} />
                                    Save
                                </>
                            )}
                        </button>
                        <div className="clear-both"></div>
                    </div>
                </div>
            </div>

            {/* HISTORY SECTION */}
            <div className="space-y-4">
                <div className="pb-2 border-b dark:border-zinc-700">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">Manual Adjustment History</h3>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border dark:border-zinc-700 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-white font-medium border-b dark:border-white/20">
                            <tr>
                                <th className="hidden md:table-cell px-4 py-3">Date</th>
                                <th className="hidden md:table-cell px-4 py-3">Location</th>
                                <th className="px-4 py-3">Product</th>
                                <th className="px-4 py-3">Quantity</th>
                                <th className="hidden md:table-cell px-4 py-3">Reason</th>
                                <th className="hidden md:table-cell px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-700">
                            {isLoadingHistory ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        Loading history...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        No manual adjustment records found.
                                    </td>
                                </tr>
                            ) : (
                                history.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        {/* Date */}
                                        <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                                            {item.date}
                                        </td>

                                        {/* Location */}
                                        <td className="hidden md:table-cell px-4 py-3">
                                            {item.location}
                                        </td>

                                        {/* Product */}
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">
                                            <button
                                                onClick={() => setViewDetailsItem(item)}
                                                className="md:hidden text-left text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                            >
                                                {item.product_name}
                                                <div className="text-xs text-gray-400 font-normal no-underline mt-0.5">(Tap for details)</div>
                                            </button>
                                            <span className="hidden md:inline">{item.product_name}</span>
                                        </td>

                                        {/* Quantity (Inline Edit) */}
                                        <td className={`px-4 py-3 font-mono ${item.quantity < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                            {editingId === item.id ? (
                                                <input
                                                    type="number"
                                                    value={editForm.quantity}
                                                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value as any })}
                                                    className="w-24 px-2 py-1 text-sm border dark:border-zinc-700 rounded text-gray-900 dark:text-gray-100"
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id)}
                                                    enterKeyHint="done"
                                                />
                                            ) : (
                                                item.quantity > 0 ? `+${item.quantity}` : item.quantity
                                            )}
                                        </td>

                                        {/* Reason (Inline Edit) */}
                                        <td className="hidden md:table-cell px-4 py-3 text-gray-500 truncate max-w-[200px]">
                                            {editingId === item.id ? (
                                                <input
                                                    type="text"
                                                    value={editForm.reason || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                                                    className="w-full px-2 py-1 text-sm border dark:border-zinc-700 rounded text-gray-900 dark:text-gray-100"
                                                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id)}
                                                    enterKeyHint="done"
                                                />
                                            ) : (
                                                item.reason || '-'
                                            )}
                                        </td>

                                        {/* Action Buttons */}
                                        <td className="hidden md:table-cell px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {editingId === item.id ? (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); saveEdit(item.id); }}
                                                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                            title="Save"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                            title="Cancel"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                                                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Mobile Details Modal */}
            {viewDetailsItem && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setViewDetailsItem(null)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                            <h3 className="font-bold text-gray-900 dark:text-white">Adjustment Details</h3>
                            <button
                                onClick={() => setViewDetailsItem(null)}
                                className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Product</label>
                                <p className="text-base font-medium text-gray-900 dark:text-white">{viewDetailsItem.product_name}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                    <p className="text-sm text-gray-900 dark:text-gray-200">{viewDetailsItem.date}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Quantity</label>
                                    <p className={`text-sm font-mono font-bold ${viewDetailsItem.quantity < 0 ? 'text-red-500' : 'text-green-600'}`}>{viewDetailsItem.quantity}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Location</label>
                                <p className="text-sm text-gray-900 dark:text-gray-200">{viewDetailsItem.location}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reason</label>
                                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800/50 p-2 rounded-lg border dark:border-zinc-700">
                                    {viewDetailsItem.reason || 'No reason specified'}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        startEdit(viewDetailsItem)
                                        setViewDetailsItem(null)
                                    }}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium rounded-lg hover:bg-purple-200 transition-colors"
                                >
                                    <Edit2 size={16} />
                                    Edit Qty
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('Delete this manual adjustment?')) {
                                            handleDelete(viewDetailsItem.id)
                                            setViewDetailsItem(null)
                                        }
                                    }}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium rounded-lg hover:bg-red-200 transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Combo Resolver Modal */}
            {comboResolving && (
                <ComboComponentSelectModal
                    comboProductId={comboResolving.id}
                    comboProductName={comboResolving.name}
                    onClose={() => setComboResolving(null)}
                    onSelectComponent={(component) => {
                        setComboResolving(null)
                        setSelectedProduct({
                            value: component.id,
                            label: component.product_name,
                            name: component.product_name
                        })
                        setReason(prev => `${prev ? prev + '. ' : ''}Resolved from ${comboResolving.name}`)
                    }}
                />
            )}
        </div>
    )
}
