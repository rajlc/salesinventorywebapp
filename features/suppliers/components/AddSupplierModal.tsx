'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createSupplier, updateSupplier } from '@/features/suppliers/actions/supplier-actions'
import { useQueryClient } from '@tanstack/react-query'

interface AddSupplierModalProps {
    isOpen: boolean
    onClose: () => void
    editMode?: boolean
    supplierData?: any
}

export function AddSupplierModal({ isOpen, onClose, editMode = false, supplierData }: AddSupplierModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        supplier_name: '',
        contact_details: '',
        remarks: '',
        price_requirement: true
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const queryClient = useQueryClient()

    const handleClose = () => {
        if (formData.supplier_name || formData.contact_details || formData.remarks) {
            if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                resetForm()
                onClose()
            }
        } else {
            resetForm()
            onClose()
        }
    }

    const resetForm = () => {
        if (editMode && supplierData) {
            setFormData({
                supplier_name: supplierData.supplier_name || '',
                contact_details: supplierData.contact_details || '',
                remarks: supplierData.remarks || '',
                price_requirement: supplierData.price_requirement ?? true
            })
        } else {
            setFormData({
                supplier_name: '',
                contact_details: '',
                remarks: '',
                price_requirement: true
            })
        }
        setErrors({})
    }

    // Initialize form with supplier data in edit mode
    useEffect(() => {
        if (isOpen) {
            resetForm()
        }
    }, [isOpen, editMode, supplierData])

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) handleClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isOpen, formData])

    if (!isOpen) return null

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose()
        }
    }

    const validate = () => {
        const newErrors: Record<string, string> = {}

        if (!formData.supplier_name.trim()) {
            newErrors.supplier_name = 'Supplier name is required'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validate()) return

        setIsSubmitting(true)
        try {
            if (editMode && supplierData) {
                await updateSupplier(supplierData.id, formData)
                alert('Supplier updated successfully!')
            } else {
                await createSupplier(formData)
                alert('Supplier added successfully!')
            }

            // Refresh supplier list
            queryClient.invalidateQueries({ queryKey: ['suppliers'] })
            queryClient.invalidateQueries({ queryKey: ['supplier-ledger'] })

            resetForm()
            onClose()
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={handleBackdropClick}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-bold">{editMode ? 'Edit Supplier' : 'Add New Supplier'}</h2>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Supplier Name */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Supplier Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.supplier_name}
                            onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 ${errors.supplier_name ? 'border-red-500' : ''
                                }`}
                            placeholder="Enter supplier name"
                        />
                        {errors.supplier_name && (
                            <p className="text-red-500 text-sm mt-1">{errors.supplier_name}</p>
                        )}
                    </div>

                    {/* Contact Details */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Contact Details
                        </label>
                        <input
                            type="text"
                            value={formData.contact_details}
                            onChange={(e) => setFormData({ ...formData, contact_details: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
                            placeholder="Phone number, email, etc. (optional)"
                        />
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Remarks
                        </label>
                        <textarea
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
                            rows={3}
                            placeholder="Additional notes (optional)"
                        />
                    </div>

                    {/* Price Requirement */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Price Requirement <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.price_requirement ? 'true' : 'false'}
                            onChange={(e) => setFormData({ ...formData, price_requirement: e.target.value === 'true' })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 bg-white dark:text-gray-50"
                        >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                        </select>
                        <p className="text-[11px] text-gray-500 mt-1 italic">
                            If 'Yes', Unit Amount will be required in purchase entry.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 border dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Saving...' : (editMode ? 'Update' : 'Save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
