'use client'

import { useState } from 'react'
import { Plus, Search, X, Download } from 'lucide-react'
import { Card } from '@/components/ui-shim'
import { useQuery } from '@tanstack/react-query'
import { getPanVatBills, type PanVatBill } from '@/features/account/actions/pan-vat-bill-actions'
import { format } from 'date-fns'
import { ViewPanVatBillModal } from './ViewPanVatBillModal'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { useEffect } from 'react'

interface PanVatBillListProps {
    onAddBill: () => void
}

export function PanVatBillList({ onAddBill }: PanVatBillListProps) {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [selectedBillId, setSelectedBillId] = useState<string | null>(null)

    // Fetch fiscal years
    const { data: fiscalYearsData } = useFiscalYears()
    const fiscalYears = fiscalYearsData || []
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Set active fiscal year as default on mount
    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    // Get selected fiscal year data
    const selectedFiscalYear = fiscalYearId !== 'all' ? fiscalYears.find(fy => fy.id === fiscalYearId) : null

    const { data: bills = [], isLoading } = useQuery({
        queryKey: ['pan-vat-bills', fiscalYearId, search, selectedFiscalYear?.start_date, selectedFiscalYear?.end_date],
        queryFn: () => getPanVatBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            startDate: selectedFiscalYear?.start_date,
            endDate: selectedFiscalYear?.end_date,
            search: search || undefined,
        }),
        staleTime: 1000 * 60 * 2,
    })

    const handleClearFilters = () => {
        setFiscalYearId('all')
        setSearch('')
    }

    const handleDownloadCSV = () => {
        if (bills.length === 0) {
            alert('No data available to download')
            return
        }

        // CSV Headers
        const headers = [
            'Bill Date (B.S)',
            'Bill Date (A.D)',
            'Supplier Company',
            'Supplier PAN/VAT',
            'Invoice No',
            'Buyer Name',
            'Buyer PAN/VAT',
            'Sub Total Amount',
            'Taxable Amount',
            'VAT 13%',
            'Total Amount'
        ]

        // CSV Rows
        const rows = bills.map(bill => [
            bill.issue_bill_date_bs || '',
            bill.issue_bill_date_ad ? format(new Date(bill.issue_bill_date_ad), 'yyyy-MM-dd') : '',
            bill.supplier_company_name || '',
            bill.supplier_pan_vat || '',
            bill.invoice_no || '',
            bill.buyer_company_name || '',
            bill.buyer_pan_vat || '',
            bill.sub_total_amount || 0,
            bill.taxable_amount || 0,
            bill.vat_13_percent || 0,
            bill.total_amount || 0
        ])

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => {
                const stringVal = String(val).replace(/"/g, '""')
                return stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('"') 
                    ? `"${stringVal}"` 
                    : stringVal
            }).join(','))
        ].join('\n')

        // Create blob and download link
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        
        const fyName = selectedFiscalYear ? selectedFiscalYear.name.replace(/[^a-zA-Z0-9]/g, '_') : 'all'
        const dateStr = format(new Date(), 'yyyyMMdd_HHmmss')
        link.setAttribute('download', `purchase_book_${fyName}_${dateStr}.csv`)
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-4">
            <Card className="overflow-hidden">
                {/* Filters */}
                <div className="p-3 border-b dark:border-zinc-800">
                    <div className="flex flex-col md:flex-row gap-3">
                        {/* Fiscal Year Dropdown */}
                        <div className="flex-1">
                            <select
                                value={fiscalYearId}
                                onChange={(e) => setFiscalYearId(e.target.value)}
                                className="w-full px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Fiscal Years</option>
                                {fiscalYears.map((fy) => (
                                    <option key={fy.id} value={fy.id}>
                                        {fy.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search Box */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by supplier, buyer, or invoice..."
                                className="w-full pl-9 pr-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Action buttons (Clear & Download CSV) */}
                        <div className="flex items-center gap-2">
                            {(fiscalYearId !== 'all' || search) && (
                                <button
                                    onClick={handleClearFilters}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Clear Filters
                                </button>
                            )}
                            <button
                                onClick={handleDownloadCSV}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors whitespace-nowrap shadow-sm"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Download CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bills Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-zinc-800">
                            <tr>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">S.N</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date (B.S)</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice No</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier Pan/Vat</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Taxable Amount</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vat 13 %</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                        Loading bills...
                                    </td>
                                </tr>
                            ) : bills.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                        No bills found. Click "Add Bill" to create one.
                                    </td>
                                </tr>
                            ) : (
                                bills.map((bill, index) => (
                                    <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-3 py-2 text-[13px] text-gray-500">{index + 1}</td>
                                        <td className="px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100">{bill.issue_bill_date_bs || '-'}</td>
                                        <td className="px-3 py-2 text-[13px] font-medium">
                                            <button
                                                onClick={() => setSelectedBillId(bill.id)}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                            >
                                                {bill.invoice_no}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100">{bill.supplier_company_name || '-'}</td>
                                        <td className="px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100">{bill.supplier_pan_vat || '-'}</td>
                                        <td className="px-3 py-2 text-[13px] text-right text-gray-900 dark:text-gray-100">
                                            Rs. {(bill.taxable_amount || 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2 text-[13px] text-right text-gray-900 dark:text-gray-100">
                                            Rs. {(bill.vat_13_percent || 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2 text-[13px] text-right font-medium text-gray-900 dark:text-gray-100">
                                            Rs. {(bill.total_amount || 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-gray-100 dark:bg-zinc-800/80 font-bold border-t border-gray-200 dark:border-zinc-700">
                            <tr>
                                <td className="px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100" colSpan={5}>Total</td>
                                <td className="px-3 py-2 text-[13px] text-right text-gray-900 dark:text-gray-100">
                                    Rs. {bills.reduce((sum, bill) => sum + (bill.taxable_amount || 0), 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-[13px] text-right text-gray-900 dark:text-gray-100">
                                    Rs. {bills.reduce((sum, bill) => sum + (bill.vat_13_percent || 0), 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-[13px] text-right font-extrabold text-gray-900 dark:text-gray-100">
                                    Rs. {bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Card>

            {/* View Bill Modal */}
            {selectedBillId && (
                <ViewPanVatBillModal
                    billId={selectedBillId}
                    onClose={() => setSelectedBillId(null)}
                />
            )}
        </div>
    )
}
