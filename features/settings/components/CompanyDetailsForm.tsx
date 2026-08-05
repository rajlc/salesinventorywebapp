'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createCompanyDetails, updateCompanyDetails, type CompanyDetails, type CreateCompanyDetailsParams } from '../actions/company-details-actions'

interface CompanyDetailsFormProps {
    company: CompanyDetails | null
    onClose: () => void
    onSuccess: () => void
}

export default function CompanyDetailsForm({ company, onClose, onSuccess }: CompanyDetailsFormProps) {
    const [formData, setFormData] = useState<CreateCompanyDetailsParams>({
        company_name: '',
        pan_vat_details: '',
        address: '',
        remarks: '',
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    // Initialize form with existing company data if editing
    useEffect(() => {
        if (company) {
            setFormData({
                company_name: company.company_name,
                pan_vat_details: company.pan_vat_details || '',
                address: company.address || '',
                remarks: company.remarks || '',
            })
        }
    }, [company])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (!formData.company_name.trim()) {
            setError('Company Name is required')
            return
        }

        setIsSubmitting(true)
        try {
            if (company) {
                // Update existing company
                await updateCompanyDetails({
                    id: company.id,
                    ...formData,
                })
            } else {
                // Create new company
                await createCompanyDetails(formData)
            }
            onSuccess()
        } catch (err: any) {
            setError(err.message || 'Failed to save company details')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-zinc-800">
                    <h2 className="text-xl font-bold">
                        {company ? 'Edit Company Details' : 'Add Company'}
                    </h2>
                    <button
                        onClick={onClose}
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

                    {/* Pan/Vat Details */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Pan/Vat Details
                        </label>
                        <input
                            type="text"
                            value={formData.pan_vat_details || ''}
                            onChange={(e) => setFormData({ ...formData, pan_vat_details: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter PAN/VAT details"
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Address
                        </label>
                        <textarea
                            value={formData.address || ''}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter address"
                            rows={3}
                        />
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
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Saving...' : company ? 'Update Company' : 'Add Company'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
