'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFiscalYears, getActiveFiscalYear } from '@/features/settings/actions/settingsActions'
import { getSupplierLedger } from '@/features/suppliers/actions/supplier-ledger-actions'
import { Card } from '@/components/ui-shim'
import { Search, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface SuppliersLedgerContentProps {
    isEmbedded?: boolean
}

export default function SuppliersLedgerContent({ isEmbedded = false }: SuppliersLedgerContentProps) {
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('')
    const [search, setSearch] = useState('')

    // 1. Fetch Fiscal Years
    const { data: fiscalYearsData, isLoading: isLoadingFY } = useQuery({
        queryKey: ['fiscal-years'],
        queryFn: getFiscalYears
    })

    const { data: activeFY } = useQuery({
        queryKey: ['active-fiscal-year'],
        queryFn: getActiveFiscalYear
    })

    // Set default fiscal year to active one
    useEffect(() => {
        if (!selectedFiscalYear && activeFY?.data) {
            setSelectedFiscalYear(activeFY.data.id)
        }
    }, [activeFY, selectedFiscalYear])

    // 2. Fetch Ledger Data
    const { data: ledgerData, isLoading: isLoadingLedger } = useQuery({
        queryKey: ['supplier-ledger', selectedFiscalYear, search],
        queryFn: () => getSupplierLedger({ fiscalYearId: selectedFiscalYear, search }),
        enabled: !!selectedFiscalYear // Only fetch if FY is selected
    })

    const fiscalYears = fiscalYearsData?.data || []

    // Sort: Suppliers with running balance (pos/neg) come first
    const ledgerEntries = [...(ledgerData?.ledger || [])].sort((a: any, b: any) => {
        const aHasBalance = Math.abs(Number(a.running_balance)) > 0
        const bHasBalance = Math.abs(Number(b.running_balance)) > 0

        if (aHasBalance === bHasBalance) return 0
        return aHasBalance ? -1 : 1
    })

    return (
        <div className={`flex flex-col h-full bg-gray-50 dark:bg-zinc-900 ${!isEmbedded ? 'pt-16 md:pt-0' : 'overflow-hidden'}`}>
            {/* Header - Only show if not embedded */}
            {!isEmbedded && (
                <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Supplier Ledger</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Financial summary for all suppliers</p>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className={`sticky ${!isEmbedded ? 'top-16 md:top-[61px]' : 'top-0'} z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-sm`}>
                <div className="flex flex-row gap-2">
                    {/* Fiscal Year Filter */}
                    <div className="hidden md:block w-[140px] md:w-64 shrink-0">
                        <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Financial Year</label>
                        <select
                            value={selectedFiscalYear}
                            onChange={(e) => setSelectedFiscalYear(e.target.value)}
                            className="w-full px-2 py-2 text-sm border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-blue-500"
                            disabled={isLoadingFY}
                        >
                            <option value="">Year...</option>
                            {fiscalYears.map((fy: any) => (
                                <option key={fy.id} value={fy.id}>
                                    {fy.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Search Filter */}
                    <div className="flex-1 relative min-w-0">
                        <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Search Supplier</label>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-sm border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Ledger Table */}
            <div className="flex-1 overflow-auto p-0 md:p-4">
                <Card className="hidden md:block overflow-hidden bg-white shadow-sm dark:bg-zinc-900 border-y md:border rounded-none md:rounded-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="px-4 py-2 text-xs font-bold uppercase text-black dark:text-white w-16">S.N</th>
                                    <th className="px-4 py-2 text-xs font-bold uppercase text-black dark:text-white">Supplier Name</th>
                                    <th className="px-4 py-2 text-xs font-bold uppercase text-black dark:text-white text-right">Opening Balance</th>
                                    <th className="px-4 py-2 text-xs font-bold uppercase text-black dark:text-white text-right">Debit</th>
                                    <th className="px-4 py-2 text-xs font-bold uppercase text-black dark:text-white text-right">Credit</th>
                                    <th className="px-4 py-2 text-xs font-bold uppercase text-black dark:text-white text-right">Running Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoadingLedger ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-gray-500">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="animate-spin" size={18} />
                                                Loading financial data...
                                            </div>
                                        </td>
                                    </tr>
                                ) : ledgerEntries.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-sm text-gray-500">
                                            No matching records found.
                                        </td>
                                    </tr>
                                ) : (
                                    ledgerEntries.map((entry: any, index: number) => (
                                        <tr key={entry.supplier_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-4 py-2 text-sm text-gray-500">{index + 1}</td>
                                            <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">

                                                <Link
                                                    href={`/dashboard/suppliers/suppliers-account/${entry.supplier_id}?fiscalYearId=${selectedFiscalYear}&supplierName=${encodeURIComponent(entry.supplier_name)}`}
                                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                                >
                                                    {entry.supplier_name}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">
                                                Rs {entry.opening_balance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right text-red-600 font-medium">
                                                Rs {entry.debit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right text-green-600 font-medium">
                                                Rs {entry.credit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className={`px-4 py-2 text-sm text-right font-bold ${entry.running_balance > 1 ? 'text-red-600' :
                                                entry.running_balance < -1 ? 'text-green-600' :
                                                    'text-gray-900 dark:text-gray-100'
                                                }`}>
                                                Rs {entry.running_balance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
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
                    {isLoadingLedger ? (
                        <div className="text-center p-8 text-gray-500">Loading...</div>
                    ) : ledgerEntries.length === 0 ? (
                        <div className="text-center p-8 text-sm text-gray-500">No records found.</div>
                    ) : (
                        ledgerEntries.map((entry: any) => (
                            <Link
                                key={entry.supplier_id}
                                href={`/dashboard/suppliers/suppliers-account/${entry.supplier_id}?fiscalYearId=${selectedFiscalYear}&supplierName=${encodeURIComponent(entry.supplier_name)}`}
                                className="block bg-white dark:bg-zinc-900 p-3 rounded-lg border shadow-sm active:bg-gray-50 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-medium text-gray-900 dark:text-gray-100 text-[15px]">{entry.supplier_name}</div>
                                    <div className={`text-[15px] font-bold ${entry.running_balance > 1 ? 'text-red-600' :
                                        entry.running_balance < -1 ? 'text-green-600' :
                                            'text-gray-900 dark:text-gray-100'
                                        }`}>
                                        Rs {entry.running_balance.toLocaleString('en-NP', { minimumFractionDigits: 0 })}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs border-t pt-2 dark:border-zinc-800">
                                    <div>
                                        <div className="text-gray-500">Opening</div>
                                        <div className="font-medium">Rs {entry.opening_balance.toLocaleString('en-NP', { minimumFractionDigits: 0 })}</div>
                                    </div>
                                    <div className="text-center border-l border-r dark:border-zinc-800">
                                        <div className="text-gray-500">Debit</div>
                                        <div className="font-medium text-red-600">Rs {entry.debit.toLocaleString('en-NP', { minimumFractionDigits: 0 })}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-gray-500">Credit</div>
                                        <div className="font-medium text-green-600">Rs {entry.credit.toLocaleString('en-NP', { minimumFractionDigits: 0 })}</div>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>

            </div>
        </div>
    )
}
