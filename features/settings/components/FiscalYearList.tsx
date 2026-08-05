'use client'

import { useState } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui-shim'
import { useFiscalYears, useDeleteFiscalYear } from '../hooks/useFiscalYears'
import { Edit, Trash2, Plus } from 'lucide-react'
import FiscalYearForm from './FiscalYearForm'

export default function FiscalYearList() {
    const { data: fiscalYears, isLoading } = useFiscalYears()
    const deleteFY = useDeleteFiscalYear()
    const [showForm, setShowForm] = useState(false)
    const [editingFY, setEditingFY] = useState<any>(null)

    const handleEdit = (fy: any) => {
        setEditingFY(fy)
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this fiscal year?')) {
            await deleteFY.mutateAsync(id)
        }
    }

    const handleCloseForm = () => {
        setShowForm(false)
        setEditingFY(null)
    }

    if (isLoading) {
        return <p className="text-muted-foreground">Loading fiscal years...</p>
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Fiscal Years</h2>
                    <p className="text-sm text-muted-foreground">Manage your fiscal year periods</p>
                </div>
                <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus size={16} className="mr-2" />
                    Add Fiscal Year
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-zinc-800 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Fiscal Year
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Start Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        End Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                                {fiscalYears?.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                            No fiscal years found. Click "Add Fiscal Year" to create one.
                                        </td>
                                    </tr>
                                ) : (
                                    fiscalYears?.map((fy: any) => (
                                        <tr key={fy.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">
                                                {fy.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                {new Date(fy.start_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                {new Date(fy.end_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {fy.is_active ? (
                                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                <button
                                                    onClick={() => handleEdit(fy)}
                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(fy.id)}
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
                <FiscalYearForm
                    fiscalYear={editingFY}
                    onClose={handleCloseForm}
                />
            )}
        </div>
    )
}
