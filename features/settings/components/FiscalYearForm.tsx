'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Label } from '@/components/ui-shim'
import { useCreateFiscalYear, useUpdateFiscalYear } from '../hooks/useFiscalYears'
import { X } from 'lucide-react'

interface FiscalYearFormProps {
    fiscalYear?: any
    onClose: () => void
}

export default function FiscalYearForm({ fiscalYear, onClose }: FiscalYearFormProps) {
    const [name, setName] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [error, setError] = useState('')

    const createFY = useCreateFiscalYear()
    const updateFY = useUpdateFiscalYear()

    useEffect(() => {
        if (fiscalYear) {
            setName(fiscalYear.name || '')
            setStartDate(fiscalYear.start_date || '')
            setEndDate(fiscalYear.end_date || '')
        }
    }, [fiscalYear])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!name || !startDate || !endDate) {
            setError('All fields are required')
            return
        }

        if (new Date(endDate) <= new Date(startDate)) {
            setError('End date must be after start date')
            return
        }

        try {
            if (fiscalYear) {
                const result = await updateFY.mutateAsync({
                    id: fiscalYear.id,
                    data: { name, start_date: startDate, end_date: endDate },
                })
                if (result.error) {
                    setError(result.error)
                    return
                }
            } else {
                const result = await createFY.mutateAsync({
                    name,
                    start_date: startDate,
                    end_date: endDate,
                })
                if (result.error) {
                    setError(result.error)
                    return
                }
            }
            onClose()
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">
                        {fiscalYear ? 'Edit Fiscal Year' : 'Add Fiscal Year'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="name">Fiscal Year Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., FY 2080-81"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="start_date">Start Date</Label>
                        <Input
                            id="start_date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="end_date">End Date</Label>
                        <Input
                            id="end_date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button variant="outline" type="button" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={createFY.isPending || updateFY.isPending}
                        >
                            {createFY.isPending || updateFY.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
