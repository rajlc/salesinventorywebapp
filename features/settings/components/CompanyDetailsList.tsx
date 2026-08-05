'use client'

import { useState } from 'react'
import { Button, Card, CardContent } from '@/components/ui-shim'
import { getCompanyDetails, deleteCompanyDetails, type CompanyDetails } from '../actions/company-details-actions'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Trash2, Plus } from 'lucide-react'
import CompanyDetailsForm from './CompanyDetailsForm'

export default function CompanyDetailsList() {
    const queryClient = useQueryClient()
    const { data: companies = [], isLoading } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    const [showForm, setShowForm] = useState(false)
    const [editingCompany, setEditingCompany] = useState<CompanyDetails | null>(null)

    const handleEdit = (company: CompanyDetails) => {
        setEditingCompany(company)
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this company?')) {
            try {
                await deleteCompanyDetails(id)
                queryClient.invalidateQueries({ queryKey: ['company-details'] })
            } catch (error) {
                console.error('Error deleting company:', error)
                alert('Failed to delete company')
            }
        }
    }

    const handleCloseForm = () => {
        setShowForm(false)
        setEditingCompany(null)
    }

    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['company-details'] })
        handleCloseForm()
    }

    if (isLoading) {
        return <p className="text-muted-foreground">Loading company details...</p>
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Company Details</h2>
                    <p className="text-sm text-muted-foreground">Manage your company information</p>
                </div>
                <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus size={16} className="mr-2" />
                    Add Company
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-zinc-800 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">S.N</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PAN/VAT Details</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remarks</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                                {companies.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                                            No company details found. Click "Add Company" to create one.
                                        </td>
                                    </tr>
                                ) : (
                                    companies.map((company, index) => (
                                        <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{index + 1}</td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">{company.company_name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{company.pan_vat_details || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">{company.address || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">{company.remarks || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                <button
                                                    onClick={() => handleEdit(company)}
                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(company.id)}
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
                <CompanyDetailsForm
                    company={editingCompany}
                    onClose={handleCloseForm}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    )
}
