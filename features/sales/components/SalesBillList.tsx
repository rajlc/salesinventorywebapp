'use client'

import { useState, useEffect, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSalesBills, SalesBill } from '@/features/sales/actions/sales-bill-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { Search, X, Eye, CalendarDays, Receipt, Filter, Hash } from 'lucide-react'

import { Card } from '@/components/ui-shim'

interface SalesBillListProps {
    onViewBill: (billId: string, galleryBillIds?: string[]) => void
}

export function SalesBillList({ onViewBill }: SalesBillListProps) {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [search, setSearch] = useState('')

    // Fetch fiscal years
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFy } = useActiveFiscalYear()

    // Initialize with active FY
    useEffect(() => {
        if (activeFy && fiscalYearId === 'all') {
            setFiscalYearId(activeFy.id)
        }
    }, [activeFy])

    const { data: bills = [], isLoading } = useQuery({
        queryKey: ['sales-bills', fiscalYearId, search],
        queryFn: () => getSalesBills({ fiscalYearId, search }),
        staleTime: 1000 * 60 * 2,
    })

    // Group bills by date and calculate total amount per date
    interface DateGroup {
        date: string
        totalAmount: number
        bills: SalesBill[]
    }

    const groupedBills: DateGroup[] = []

    bills.forEach((bill) => {
        const date = bill.bill_date_ad
        let group = groupedBills.find((g) => g.date === date)
        if (!group) {
            group = { date, totalAmount: 0, bills: [] }
            groupedBills.push(group)
        }
        group.bills.push(bill)
        group.totalAmount += bill.total_amount
    })

    // Sort groups by date descending
    groupedBills.sort((a, b) => b.date.localeCompare(a.date))

    // Sort bills inside each group by latest first (created_at descending, fallback to invoice_no)
    groupedBills.forEach((group) => {
        group.bills.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime()
            const dateB = new Date(b.created_at || 0).getTime()
            if (dateA !== dateB) return dateB - dateA
            return b.invoice_no.localeCompare(a.invoice_no)
        })
    })

    const handleClearFilters = () => {
        setFiscalYearId('all')
        setSearch('')
    }

    return (
        <Card className="overflow-hidden border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-sm bg-white dark:bg-zinc-900">
            {/* Filters */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Fiscal Year Filter */}
                    <div className="w-full md:w-64 relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                            <CalendarDays className="h-4 w-4" />
                        </span>
                        <select
                            value={fiscalYearId}
                            onChange={(e) => setFiscalYearId(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 text-[13px] border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 cursor-pointer appearance-none font-medium"
                        >
                            <option value="all">All Fiscal Years</option>
                            {fiscalYears.map((fy) => (
                                <option key={fy.id} value={fy.id}>
                                    {fy.name}
                                </option>
                            ))}
                        </select>
                        <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <Filter className="h-3.5 w-3.5" />
                        </span>
                    </div>

                    {/* Search Filter */}
                    <div className="flex-1 w-full relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                            <Search className="h-4 w-4" />
                        </span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search invoice number or customer details..."
                            className="w-full pl-9 pr-9 py-2.5 text-[13px] border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 font-medium"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Clear Button */}
                    {(fiscalYearId !== 'all' || search) && (
                        <button
                            onClick={handleClearFilters}
                            className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-850 hover:text-slate-800 dark:hover:text-zinc-200 transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow"
                        >
                            <X className="h-4 w-4" />
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/60 dark:bg-zinc-900/50 text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/80 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                            <th className="px-4 py-3">Date (AD)</th>
                            <th className="px-4 py-3">Invoice No</th>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3 text-right">Sub Total</th>
                            <th className="px-4 py-3 text-right">VAT</th>
                            <th className="px-4 py-3 text-right">Total Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                    Loading sales bills...
                                </td>
                            </tr>
                        ) : bills.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                    No sales bills found for the selected criteria.
                                </td>
                            </tr>
                        ) : (
                            groupedBills.map((group) => (
                                <Fragment key={group.date}>
                                    <tr className="bg-slate-100/50 dark:bg-zinc-900/30 border-y border-slate-200/60 dark:border-zinc-800/60 transition-colors">
                                        <td colSpan={6} className="px-4 py-2.5">
                                            <div className="flex flex-wrap justify-between items-center gap-3">
                                                {/* Left side: Date and invoice counts */}
                                                <div className="flex items-center gap-2.5">
                                                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold border border-indigo-100/50 dark:border-indigo-950/80 shadow-sm">
                                                        <CalendarDays className="h-3.5 w-3.5 animate-pulse" />
                                                        {group.date}
                                                    </span>
                                                    
                                                    {/* Invoices Count Badge */}
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md text-[10px] font-extrabold border border-slate-200 dark:border-zinc-700 tracking-wide uppercase font-sans">
                                                        <Receipt className="h-3 w-3" />
                                                        {group.bills.length} {group.bills.length === 1 ? 'Bill' : 'Bills'}
                                                    </span>

                                                    <button
                                                        onClick={() => {
                                                            const sortedBills = [...group.bills].sort((a, b) => a.invoice_no.localeCompare(b.invoice_no))
                                                            const billIds = sortedBills.map(b => b.id)
                                                            if (billIds.length > 0) {
                                                                onViewBill(billIds[0], billIds)
                                                            }
                                                        }}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-white dark:bg-zinc-805 text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-950 border border-slate-200 dark:border-zinc-700 font-bold rounded-lg transition-all shadow-sm cursor-pointer active:scale-95"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        View Bill
                                                    </button>
                                                </div>

                                                {/* Right side: Daily Total Sum */}
                                                <span className="px-3 py-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-805 rounded-lg text-xs text-slate-500 dark:text-zinc-400 font-semibold shadow-sm font-sans">
                                                    Daily Total: <span className="text-slate-900 dark:text-zinc-100 font-extrabold ml-1">{formatNepaliCurrency(group.totalAmount)}</span>
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                    {group.bills.map((bill) => (
                                        <tr key={bill.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-800/30 transition-all duration-150 group border-b border-slate-100 dark:border-zinc-800/40">
                                            <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-zinc-500 font-medium">
                                                {bill.bill_date_ad}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-semibold">
                                                <button
                                                    onClick={() => {
                                                        const sortedBills = [...group.bills].sort((a, b) => a.invoice_no.localeCompare(b.invoice_no))
                                                        const billIds = sortedBills.map(b => b.id)
                                                        onViewBill(bill.id, billIds)
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-950/80 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-sm font-mono text-[11px]"
                                                >
                                                    <Hash className="h-3 w-3 shrink-0" />
                                                    {bill.invoice_no}
                                                </button>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-zinc-200">
                                                {bill.customer_name}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-right text-slate-500 dark:text-zinc-400 font-medium">
                                                {formatNepaliCurrency(bill.sub_total_amount)}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-right text-slate-500 dark:text-zinc-400 font-medium">
                                                {formatNepaliCurrency(bill.vat_amount)}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-right font-extrabold text-slate-900 dark:text-zinc-100 font-sans">
                                                {formatNepaliCurrency(bill.total_amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    )
}
