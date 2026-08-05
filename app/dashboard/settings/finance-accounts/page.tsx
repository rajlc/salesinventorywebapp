'use client'

import { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Check, Scale } from 'lucide-react'
import Link from 'next/link'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Button, Card, CardContent, Input, Badge } from '@/components/ui-shim'
import {
    getBillingUnits,
    createBillingUnit,
    deleteBillingUnit,
    setPrimaryBillingUnit,
    type BillingUnit
} from '@/features/settings/actions/billing-unit-actions'

export default function FinanceAccountsSettingsPage() {
    const queryClient = useQueryClient()
    const [newUnitName, setNewUnitName] = useState('')
    const [error, setError] = useState('')

    // Fetch units
    const { data: units = [], isLoading } = useQuery({
        queryKey: ['billing-units'],
        queryFn: getBillingUnits,
    })

    // Create unit mutation
    const createMutation = useMutation({
        mutationFn: createBillingUnit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['billing-units'] })
            setNewUnitName('')
            setError('')
        },
        onError: (err: any) => {
            setError(err.message || 'Failed to create unit')
        }
    })

    // Delete unit mutation
    const deleteMutation = useMutation({
        mutationFn: deleteBillingUnit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['billing-units'] })
        },
        onError: (err: any) => {
            setError(err.message || 'Failed to delete unit')
        }
    })

    // Set primary unit mutation
    const setPrimaryMutation = useMutation({
        mutationFn: setPrimaryBillingUnit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['billing-units'] })
        },
        onError: (err: any) => {
            setError(err.message || 'Failed to set primary unit')
        }
    })

    const handleAddUnit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newUnitName.trim()) return
        createMutation.mutate(newUnitName.trim())
    }

    const handleDeleteUnit = (id: string) => {
        if (confirm('Are you sure you want to delete this unit?')) {
            deleteMutation.mutate(id)
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Finance & Accounts Settings</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage billing units and transaction configurations</p>
                </div>
                <div>
                    <Link
                        href="/dashboard/settings"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors font-medium"
                    >
                        <ArrowLeft size={14} />
                        Back to Settings
                    </Link>
                </div>
            </div>

            {/* Sidebar & Content Layout */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-full md:w-64 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-850 p-4 space-y-1 shrink-0">
                    <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-left transition-all"
                    >
                        <Scale size={16} />
                        Billing Units
                    </button>
                </div>

                {/* Right Content Area */}
                <div className="flex-1 overflow-auto p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium animate-fade-in">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Add Unit Form */}
                        <div className="lg:col-span-1">
                            <Card className="border border-slate-200 dark:border-zinc-800/80 shadow-sm rounded-xl">
                                <CardContent className="p-5 space-y-4">
                                    <div>
                                        <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200">Add New Unit</h2>
                                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Define a new measurement unit for item billing (e.g. Box, Liter, Pack)</p>
                                    </div>
                                    <form onSubmit={handleAddUnit} className="space-y-3">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1.5">Unit Name</label>
                                            <Input
                                                type="text"
                                                value={newUnitName}
                                                onChange={(e) => setNewUnitName(e.target.value)}
                                                placeholder="e.g. Box, Liter"
                                                required
                                                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 text-slate-700 dark:text-zinc-300 font-medium"
                                            />
                                        </div>
                                        <Button
                                            type="submit"
                                            disabled={createMutation.isPending}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm h-10 transition-all shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                                        >
                                            <Plus size={16} />
                                            {createMutation.isPending ? 'Adding...' : 'Add Unit'}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Units List */}
                        <div className="lg:col-span-2">
                            <Card className="border border-slate-200 dark:border-zinc-800/80 shadow-sm rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40">
                                    <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200">Registered Billing Units</h2>
                                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Select a primary unit to be set as default on invoice line items</p>
                                </div>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50/60 dark:bg-zinc-900/50 text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800 font-bold uppercase tracking-wider text-[10px]">
                                                <tr>
                                                    <th className="px-6 py-3 w-16">S.N</th>
                                                    <th className="px-6 py-3">Unit Name</th>
                                                    <th className="px-6 py-3 w-32">Status</th>
                                                    <th className="px-6 py-3 w-48 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900">
                                                {isLoading ? (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">
                                                            Loading units...
                                                        </td>
                                                    </tr>
                                                ) : units.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">
                                                            No billing units found. Please create one on the left.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    units.map((unit, index) => (
                                                        <tr key={unit.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/40 transition-colors">
                                                            <td className="px-6 py-4 text-sm text-slate-400 font-medium">{index + 1}</td>
                                                            <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-zinc-200">{unit.name}</td>
                                                            <td className="px-6 py-4">
                                                                {unit.is_primary ? (
                                                                    <Badge className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 font-semibold px-2 py-0.5 rounded-full text-[11px]">
                                                                        Primary
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Standard</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                                                {!unit.is_primary && (
                                                                    <Button
                                                                        onClick={() => setPrimaryMutation.mutate(unit.id)}
                                                                        disabled={setPrimaryMutation.isPending}
                                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 text-xs font-semibold rounded-lg h-7 transition-all cursor-pointer shadow-sm active:scale-95"
                                                                    >
                                                                        <Check size={12} />
                                                                        Set Primary
                                                                    </Button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDeleteUnit(unit.id)}
                                                                    disabled={deleteMutation.isPending}
                                                                    className="inline-flex items-center justify-center p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-650 dark:text-red-400 dark:hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                                                                    title="Delete unit"
                                                                >
                                                                    <Trash2 size={15} />
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
