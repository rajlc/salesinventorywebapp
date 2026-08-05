'use client'

import { useState, useEffect } from 'react'
import { Search, X, Eye } from 'lucide-react'
import { Card } from '@/components/ui-shim'
import { useQuery } from '@tanstack/react-query'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { getPurchaseBillingReport, type PurchaseBillingReportItem } from '@/features/account/actions/purchase-billing-report-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { PurchaseBillingDetailModal } from './PurchaseBillingDetailModal'

export function PurchaseBillingReport() {
    const [companyId, setCompanyId] = useState<string>('all')
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [selectedReportItem, setSelectedReportItem] = useState<PurchaseBillingReportItem | null>(null)

    // Fetch company details
    const { data: companies = [] } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    // Fetch fiscal years
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Set active fiscal year as default on mount
    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    // Get selected fiscal year data
    const selectedFiscalYear = fiscalYearId !== 'all' ? fiscalYears.find(fy => fy.id === fiscalYearId) : null

    // Fetch report data
    const { data: reportData = [], isLoading } = useQuery({
        queryKey: ['purchase-billing-report', companyId, fiscalYearId, search, selectedFiscalYear?.start_date, selectedFiscalYear?.end_date],
        queryFn: () => getPurchaseBillingReport({
            companyId: companyId !== 'all' ? companyId : undefined,
            startDate: selectedFiscalYear?.start_date,
            endDate: selectedFiscalYear?.end_date,
            search: search || undefined,
        }),
    })

    const clearFilters = () => {
        setCompanyId('all')
        setFiscalYearId('all')
        setSearch('')
    }

    return (
        <>
            <Card className="overflow-hidden">
                {/* Filters */}
                <div className="p-3 border-b dark:border-zinc-800">
                    <div className="flex flex-col md:flex-row gap-3">
                        {/* Company Name Dropdown */}
                        <div className="flex-1">
                            <select
                                value={companyId}
                                onChange={(e) => setCompanyId(e.target.value)}
                                className="w-full px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Companies</option>
                                {companies.map((company) => (
                                    <option key={company.id} value={company.id}>
                                        {company.company_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Fiscal Year Filter */}
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
                                placeholder="Search..."
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

                        {/* Clear Filters */}
                        {(companyId !== 'all' || fiscalYearId !== 'all' || search) && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear Filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Report Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-zinc-800">
                            <tr>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">S.N</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Billed From</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Billed To</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Bill Amount</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider bg-purple-50/50 dark:bg-purple-950/10">Transaction Amount</th>
                                <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                        Loading report...
                                    </td>
                                </tr>
                            ) : reportData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                        No records found
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((item, index) => (
                                    <tr key={`${item.supplier_company_id}-${item.buyer_company_id}`} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-3 py-2 text-[13px] text-gray-500">{index + 1}</td>
                                        <td className="px-3 py-2 text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                            {item.supplier_company_name}
                                        </td>
                                        <td className="px-3 py-2 text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                            {item.buyer_company_name}
                                        </td>
                                        <td className="px-3 py-2 text-[13px] text-right font-medium text-blue-600 dark:text-blue-400">
                                            {formatNepaliCurrency(item.total_bill_amount)}
                                        </td>
                                        <td className="px-3 py-2 text-[13px] text-right font-bold text-purple-700 dark:text-purple-400 bg-purple-50/30 dark:bg-purple-950/5">
                                            {formatNepaliCurrency(item.transaction_amount || 0)}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                onClick={() => setSelectedReportItem(item)}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-[13px] text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                title="View details"
                                            >
                                                <Eye className="h-4 w-4" />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {/* Table Footer - Total Amount */}
                        {!isLoading && reportData.length > 0 && (
                            <tfoot className="bg-blue-50 dark:bg-blue-900/20">
                                <tr>
                                    <td colSpan={3} className="px-3 py-3 text-center text-sm font-bold text-gray-900 dark:text-gray-100">
                                        Total Amount
                                    </td>
                                    <td className="px-3 py-3 text-right text-base font-bold text-blue-600 dark:text-blue-400">
                                        {formatNepaliCurrency(reportData.reduce((sum, item) => sum + item.total_bill_amount, 0))}
                                    </td>
                                    <td className="px-3 py-3 text-right text-base font-bold text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20">
                                        {formatNepaliCurrency(reportData.reduce((sum, item) => sum + (item.transaction_amount || 0), 0))}
                                    </td>
                                    <td className="px-3 py-3"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </Card>

            {/* Purchase Billing Detail Modal */}
            {
                selectedReportItem && (
                    <PurchaseBillingDetailModal
                        supplierCompanyId={selectedReportItem.supplier_company_id}
                        supplierCompanyName={selectedReportItem.supplier_company_name}
                        buyerCompanyId={selectedReportItem.buyer_company_id}
                        buyerCompanyName={selectedReportItem.buyer_company_name}
                        fiscalYearId={fiscalYearId !== 'all' ? fiscalYearId : undefined}
                        fiscalYearName={selectedFiscalYear?.name}
                        startDate={selectedFiscalYear?.start_date}
                        endDate={selectedFiscalYear?.end_date}
                        onClose={() => setSelectedReportItem(null)}
                    />
                )}
        </>
    )
}

