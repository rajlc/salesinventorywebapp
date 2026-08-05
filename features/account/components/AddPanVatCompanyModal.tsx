'use client'

import { useState, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { createPanVatCompany, updatePanVatCompany, type CreatePanVatCompanyParams, type PanVatCompany } from '@/features/account/actions/pan-vat-company-actions'
import { getSuppliers } from '@/features/suppliers/actions/supplier-actions'

interface AddPanVatCompanyModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    company?: PanVatCompany | null
}

export function AddPanVatCompanyModal({ isOpen, onClose, onSuccess, company }: AddPanVatCompanyModalProps) {
    const [formData, setFormData] = useState<CreatePanVatCompanyParams>({
        company_name: '',
        pan_vat_no: '',
        supplier_id: null,
        supplier_name: null,
        remarks: null,
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    // Supplier search
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [supplierSearch, setSupplierSearch] = useState('')
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false)

    // Pre-fill form data when editing
    useEffect(() => {
        if (company) {
            setFormData({
                company_name: company.company_name,
                pan_vat_no: company.pan_vat_no,
                supplier_id: company.supplier_id,
                supplier_name: company.supplier_name,
                remarks: company.remarks,
            })
            setSupplierSearch(company.supplier_name || '')
        }
    }, [company])

    // Load suppliers when search changes
    useEffect(() => {
        const loadSuppliers = async () => {
            if (supplierSearch.length > 0) {
                setIsLoadingSuppliers(true)
                try {
                    const result = await getSuppliers({ page: 1, limit: 20, search: supplierSearch })
                    setSuppliers(result.suppliers)
                } catch (err) {
                    console.error('Error loading suppliers:', err)
                } finally {
                    setIsLoadingSuppliers(false)
                }
            } else {
                // Load initial suppliers
                setIsLoadingSuppliers(true)
                try {
                    const result = await getSuppliers({ page: 1, limit: 20 })
                    setSuppliers(result.suppliers)
                } catch (err) {
                    console.error('Error loading suppliers:', err)
                } finally {
                    setIsLoadingSuppliers(false)
                }
            }
        }
        loadSuppliers()
    }, [supplierSearch])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (!formData.company_name.trim()) {
            setError('Company Name is required')
            return
        }
        if (!formData.pan_vat_no.trim()) {
            setError('Pan/Vat No is required')
            return
        }

        setIsSubmitting(true)
        try {
            if (company) {
                // Update existing company
                await updatePanVatCompany({ ...formData, id: company.id })
            } else {
                // Create new company
                await createPanVatCompany(formData)
            }
            onSuccess()
            handleClose()
        } catch (err: any) {
            setError(err.message || (company ? 'Failed to update company' : 'Failed to create company'))
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setFormData({
            company_name: '',
            pan_vat_no: '',
            supplier_id: null,
            supplier_name: null,
            remarks: null,
        })
        setSupplierSearch('')
        setError('')
        onClose()
    }

    const selectSupplier = (supplier: any) => {
        setFormData({
            ...formData,
            supplier_id: supplier.id,
            supplier_name: supplier.supplier_name,
        })
        setSupplierSearch(supplier.supplier_name)
        setShowSupplierDropdown(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-zinc-800">
                    <h2 className="text-xl font-bold">{company ? 'Edit' : 'Add'} Pan/Vat Company</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Company Name */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Company Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.company_name}
                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter company name"
                            required
                        />
                    </div>

                    {/* Pan/Vat No */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Pan/Vat No <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.pan_vat_no}
                            onChange={(e) => setFormData({ ...formData, pan_vat_no: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter PAN/VAT number"
                            required
                        />
                    </div>

                    {/* Supplier Name - Searchable Dropdown */}
                    <div className="relative">
                        <label className="block text-sm font-medium mb-1">
                            Supplier Name
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={supplierSearch}
                                onChange={(e) => {
                                    setSupplierSearch(e.target.value)
                                    setShowSupplierDropdown(true)
                                }}
                                onFocus={() => setShowSupplierDropdown(true)}
                                className="w-full pl-10 pr-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Search supplier..."
                            />
                        </div>

                        {/* Dropdown */}
                        {showSupplierDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {isLoadingSuppliers ? (
                                    <div className="p-3 text-center text-sm text-gray-500">
                                        Loading suppliers...
                                    </div>
                                ) : suppliers.length > 0 ? (
                                    suppliers.map((supplier) => (
                                        <button
                                            key={supplier.id}
                                            type="button"
                                            onClick={() => selectSupplier(supplier)}
                                            className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                                        >
                                            <div className="font-medium">{supplier.supplier_name}</div>
                                            {supplier.contact_person && (
                                                <div className="text-xs text-gray-500">{supplier.contact_person}</div>
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-3 text-center text-sm text-gray-500">
                                        No suppliers found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Remarks
                        </label>
                        <textarea
                            value={formData.remarks || ''}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter remarks (optional)"
                            rows={3}
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-4 py-2 border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (company ? 'Updating...' : 'Adding...') : (company ? 'Update Company' : 'Add Company')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
