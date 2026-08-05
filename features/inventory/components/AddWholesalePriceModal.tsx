'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import Select from 'react-select'
import { getSuppliers } from '@/features/suppliers/actions/supplier-actions'
import { saveWholesalePrice } from '@/features/inventory/actions/wholesale-price-actions'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface AddWholesalePriceModalProps {
    isOpen: boolean
    onClose: () => void
    productId: string
    productName: string
    onSuccess?: () => void
}

export function AddWholesalePriceModal({ isOpen, onClose, productId, productName, onSuccess }: AddWholesalePriceModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [supplierOptions, setSupplierOptions] = useState<any[]>([])
    const [loadingSuppliers, setLoadingSuppliers] = useState(false)
    const queryClient = useQueryClient()

    const [formData, setFormData] = useState({
        wholesale_price: '',
        supplier_id: '',
        supplier_name: ''
    })

    useEffect(() => {
        if (!isOpen) return

        // Reset form data when opening
        setFormData({
            wholesale_price: '',
            supplier_id: '',
            supplier_name: ''
        })

        const fetchSuppliers = async () => {
            setLoadingSuppliers(true)
            try {
                const { suppliers } = await getSuppliers({ limit: 1000 })
                const options = suppliers.map((s: any) => ({
                    value: s.id,
                    label: s.supplier_name
                }))
                setSupplierOptions(options)
            } catch (err) {
                console.error("Failed to load suppliers", err)
                toast.error("Failed to load suppliers")
            } finally {
                setLoadingSuppliers(false)
            }
        }

        fetchSuppliers()
    }, [isOpen])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!formData.supplier_id || !formData.wholesale_price) {
            toast.warning("Please fill in all required fields")
            return
        }

        setIsSubmitting(true)
        try {
            await saveWholesalePrice({
                product_id: productId,
                supplier_id: formData.supplier_id,
                wholesale_price: parseFloat(formData.wholesale_price)
            })

            toast.success("Wholesale price saved successfully")
            
            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: ['wholesale-dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['wholesale-history', productId] })

            if (onSuccess) onSuccess()
            onClose()
        } catch (error: any) {
            toast.error(`Error: ${error.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Custom styles for react-select to match the app theme
    const customSelectStyles = {
        control: (base: any) => ({
            ...base,
            minHeight: '42px',
            borderColor: '#e5e7eb',
            borderRadius: '0.375rem',
            backgroundColor: 'white',
            boxShadow: 'none',
            '&:hover': {
                borderColor: '#3b82f6'
            }
        }),
        menu: (base: any) => ({
            ...base,
            zIndex: 9999,
            backgroundColor: 'white'
        }),
        option: (base: any, state: any) => ({
            ...base,
            backgroundColor: state.isFocused ? '#f3f4f6' : 'white',
            color: '#1f2937',
            '&:active': {
                backgroundColor: '#e5e7eb'
            }
        }),
        menuPortal: (base: any) => ({ ...base, zIndex: 99999 }),
        singleValue: (base: any) => ({
            ...base,
            color: '#1f2937'
        }),
        placeholder: (base: any) => ({
            ...base,
            color: '#9ca3af'
        })
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                onClick={onClose} 
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all border dark:border-zinc-800">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add Wholesale Price</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Record a new pricing offer from a supplier</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {/* Read-only Product Name */}
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/20">
                        <label className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Target Product</label>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {productName}
                        </div>
                    </div>

                    {/* Price Input */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                            Wholesale Price (Rs) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                value={formData.wholesale_price}
                                onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                                className="w-full pl-3 pr-10 py-2.5 text-sm bg-white dark:bg-zinc-950 border-2 border-gray-200 dark:border-zinc-800 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                placeholder="Enter price"
                                required
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">
                                NPR
                            </div>
                        </div>
                    </div>

                    {/* Supplier Dropdown */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                            Supplier <span className="text-red-500">*</span>
                        </label>
                        <Select
                            options={supplierOptions}
                            isLoading={loadingSuppliers}
                            value={formData.supplier_id ? { label: formData.supplier_name, value: formData.supplier_id } : null}
                            onChange={(opt: any) => setFormData({ 
                                ...formData, 
                                supplier_id: opt?.value || '', 
                                supplier_name: opt?.label || '' 
                            })}
                            className="text-sm"
                            placeholder={loadingSuppliers ? "Loading suppliers..." : "Search & select supplier..."}
                            styles={customSelectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                            menuPosition="fixed"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Save Record
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
