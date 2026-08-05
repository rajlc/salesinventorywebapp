'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Calendar, BarChart3, ChevronLeft, ChevronRight, Building, RefreshCw, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Card, Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button } from '@/components/ui-shim'
import { useQuery } from '@tanstack/react-query'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getPanVatBills } from '@/features/account/actions/pan-vat-bill-actions'
import { getSalesBills } from '@/features/sales/actions/sales-bill-actions'
import { getDailyDarazReportData } from '@/features/account/actions/daraz-transaction-actions'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'

export default function PanVatReportPage() {
    const [activeSubTab, setActiveSubTab] = useState<'daily' | 'weekly'>('daily')
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [startDate, setStartDate] = useState<string>('')
    const [endDate, setEndDate] = useState<string>('')
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all')
    const [currentPage, setCurrentPage] = useState(1)

    const itemsPerPage = 12

    // Fetch Fiscal Years & Active Fiscal Year
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Default to active fiscal year on mount
    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
            setStartDate(activeFiscalYear.start_date)
            setEndDate(activeFiscalYear.end_date)
        }
    }, [activeFiscalYear])

    // Update start and end dates when fiscalYearId changes
    const handleFiscalYearChange = (id: string) => {
        setFiscalYearId(id)
        if (id === 'all') {
            setStartDate('')
            setEndDate('')
        } else {
            const fy = fiscalYears.find(f => f.id === id)
            if (fy) {
                setStartDate(fy.start_date)
                setEndDate(fy.end_date)
            }
        }
    }

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [fiscalYearId, startDate, endDate, selectedCompanyId])

    // Fetch Our Companies
    const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails
    })

    // Fetch Online Stores (Seller account to company mapping)
    const { data: onlineStores = [], isLoading: isLoadingStores } = useOnlineStores()

    // Fetch Purchase Bills (where our company is buyer)
    const { data: purchaseBills = [], isLoading: isLoadingPurchases } = useQuery({
        queryKey: ['pan-vat-bills', fiscalYearId, startDate, endDate],
        queryFn: () => getPanVatBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
        }),
    })

    // Fetch Sales Bills (where our company is seller)
    const { data: salesBills = [], isLoading: isLoadingSales } = useQuery({
        queryKey: ['sales-bills', fiscalYearId, startDate, endDate],
        queryFn: () => getSalesBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
        }),
    })

    // Fetch Daily Daraz Report Data (includes both delivered revenue & shipped stats)
    const { data: darazDailyData = [], isLoading: isLoadingDaraz } = useQuery({
        queryKey: ['daily-daraz-report-data', startDate, endDate],
        queryFn: () => {
            if (!startDate || !endDate) return []
            return getDailyDarazReportData(startDate, endDate)
        },
        enabled: !!startDate && !!endDate
    })

    // Helper mappings
    const sellerToCompanyMap = useMemo(() => {
        const map: Record<string, string> = {}
        onlineStores.forEach((store: any) => {
            if (store.seller_account && store.company_name) {
                map[store.seller_account] = store.company_name
            }
        })
        return map
    }, [onlineStores])

    const companyMap = useMemo(() => {
        const map: Record<string, string> = {}
        companies.forEach((c: any) => {
            map[c.id] = c.company_name
        })
        return map
    }, [companies])

    // Formatted date string helper
    const formatDateStr = (dateStr: string) => {
        if (!dateStr) return '-'
        const [y, m, d] = dateStr.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
    }

    // Daily Aggregation Logic
    const dailyReportData = useMemo(() => {
        const map: Record<string, Record<string, { darazRevenue: number; darazShipped: number; salesAmount: number; purchaseAmount: number }>> = {}

        // Helper to initialize entry
        const getOrCreateEntry = (date: string, company: string) => {
            if (!map[date]) {
                map[date] = {}
            }
            if (!map[date][company]) {
                map[date][company] = { darazRevenue: 0, darazShipped: 0, salesAmount: 0, purchaseAmount: 0 }
            }
            return map[date][company]
        }

        // 1. Process Daraz Daily Report Data (Delivered revenue & Shipped amount)
        darazDailyData.forEach((row: any) => {
            const date = row.date
            if (!date) return
            const company = sellerToCompanyMap[row.sellerAccount] || row.sellerAccount || 'Daraz Seller'
            const entry = getOrCreateEntry(date, company)
            entry.darazRevenue += row.revenue || 0
            entry.darazShipped += row.shippedAmount || 0
        })

        // 2. Process Sales Bills
        salesBills.forEach((bill: any) => {
            const date = bill.bill_date_ad
            if (!date) return
            const company = companyMap[bill.seller_company_id || ''] || 'Unknown Company'
            const entry = getOrCreateEntry(date, company)
            entry.salesAmount += bill.total_amount || 0
        })

        // 3. Process Purchase Bills
        purchaseBills.forEach((bill: any) => {
            const date = bill.issue_bill_date_ad
            if (!date) return
            const company = companyMap[bill.buyer_company_id || ''] || bill.buyer_company_name || 'Unknown Company'
            const entry = getOrCreateEntry(date, company)
            entry.purchaseAmount += bill.total_amount || 0
        })

        // Flatten map into list
        const rows: Array<{
            date: string
            companyName: string
            darazRevenue: number
            darazShipped: number
            salesAmount: number
            purchaseAmount: number
        }> = []

        Object.keys(map).forEach(date => {
            Object.keys(map[date]).forEach(companyName => {
                const data = map[date][companyName]
                rows.push({
                    date,
                    companyName,
                    darazRevenue: data.darazRevenue,
                    darazShipped: data.darazShipped,
                    salesAmount: data.salesAmount,
                    purchaseAmount: data.purchaseAmount
                })
            })
        })

        // Sort descending by date, then ascending by company name
        return rows.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date)
            if (dateCompare !== 0) return dateCompare
            return a.companyName.localeCompare(b.companyName)
        })
    }, [darazDailyData, salesBills, purchaseBills, sellerToCompanyMap, companyMap])

    // Filter report by Selected Company
    const filteredReportData = useMemo(() => {
        if (selectedCompanyId === 'all') return dailyReportData

        const targetCompanyName = companyMap[selectedCompanyId]
        if (!targetCompanyName) return dailyReportData

        return dailyReportData.filter(row =>
            row.companyName.toLowerCase() === targetCompanyName.toLowerCase()
        )
    }, [dailyReportData, selectedCompanyId, companyMap])

    // Aggregate overall totals for all pages
    const overallTotals = useMemo(() => {
        let totalDarazRevenue = 0
        let totalDarazShipped = 0
        let totalSales = 0
        let totalPurchase = 0

        filteredReportData.forEach(row => {
            totalDarazRevenue += row.darazRevenue
            totalDarazShipped += row.darazShipped
            totalSales += row.salesAmount
            totalPurchase += row.purchaseAmount
        })

        return { totalDarazRevenue, totalDarazShipped, totalSales, totalPurchase }
    }, [filteredReportData])

    // Paginated Rows
    const paginatedRows = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        return filteredReportData.slice(startIndex, startIndex + itemsPerPage)
    }, [filteredReportData, currentPage])

    const totalPages = Math.ceil(filteredReportData.length / itemsPerPage)

    const isLoading = isLoadingCompanies || isLoadingStores || isLoadingPurchases || isLoadingSales || isLoadingDaraz

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950 space-y-5 pb-8 overflow-y-auto">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-sm sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/account/pan-vat-billing"
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-500" />
                            PAN/VAT Transaction Report
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Aggregated daily billing statements across channels</p>
                    </div>
                </div>

                {/* Sub-tabs / Buttons */}
                <div className="flex bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-lg border dark:border-zinc-700 self-start sm:self-center">
                    <button
                        onClick={() => setActiveSubTab('daily')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeSubTab === 'daily'
                            ? 'bg-white dark:bg-zinc-900 text-violet-600 dark:text-violet-400 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Daily Report
                    </button>
                    <button
                        onClick={() => setActiveSubTab('weekly')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeSubTab === 'weekly'
                            ? 'bg-white dark:bg-zinc-900 text-violet-600 dark:text-violet-400 shadow-sm'
                            : 'text-gray-400 cursor-not-allowed'
                            }`}
                        disabled
                        title="Weekly report coming soon"
                    >
                        Weekly Report
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div className="px-4 md:px-6">
                <Card className="p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Fiscal Year Filter */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Fiscal Year</label>
                            <div className="relative">
                                <select
                                    value={fiscalYearId}
                                    onChange={(e) => handleFiscalYearChange(e.target.value)}
                                    className="w-full px-3 py-2 text-xs font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm cursor-pointer"
                                >
                                    <option value="all">All Fiscal Years</option>
                                    {fiscalYears.map((fy) => (
                                        <option key={fy.id} value={fy.id}>
                                            {fy.name} {fy.is_active ? '(Running)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Start Date Picker */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Start Date (AD)</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm cursor-pointer"
                            />
                        </div>

                        {/* End Date Picker */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">End Date (AD)</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm cursor-pointer"
                            />
                        </div>

                        {/* Company Filter */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Filter by Company</label>
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm cursor-pointer"
                            >
                                <option value="all">All Companies</option>
                                {companies.map((company) => (
                                    <option key={company.id} value={company.id}>
                                        {company.company_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Daily Report Content */}
            <div className="px-4 md:px-6">
                {isLoading ? (
                    <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <RefreshCw className="h-8 w-8 text-violet-500 animate-spin" />
                        <p className="text-sm font-semibold text-gray-500">Aggregating daily transaction records...</p>
                    </Card>
                ) : filteredReportData.length === 0 ? (
                    <Card className="p-12 text-center flex flex-col items-center justify-center space-y-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <AlertCircle className="h-10 w-10 text-gray-300" />
                        <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">No Transactions Found</h3>
                        <p className="text-xs text-gray-500 max-w-sm">No billing records or Daraz shipments/settlements occurred within the selected range or company filters.</p>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {/* Table */}
                        <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-gray-50 dark:bg-zinc-800/60 border-b dark:border-zinc-800">
                                        {/* Row 1 Headers */}
                                        <TableRow>
                                            <TableHead rowSpan={2} className="w-32 font-extrabold text-gray-800 dark:text-gray-200 border-r dark:border-zinc-800">Date</TableHead>
                                            <TableHead colSpan={3} className="text-center font-extrabold text-orange-600 dark:text-orange-500 border-r dark:border-zinc-800 bg-orange-50/10">
                                                Daraz Transaction
                                            </TableHead>
                                            <TableHead colSpan={2} className="text-center font-extrabold text-emerald-600 dark:text-emerald-500 border-r dark:border-zinc-800 bg-emerald-50/10">
                                                Sales Billing
                                            </TableHead>
                                            <TableHead colSpan={2} className="text-center font-extrabold text-blue-600 dark:text-blue-500 bg-blue-50/10">
                                                Purchase Billing
                                            </TableHead>
                                        </TableRow>
                                        {/* Row 2 Headers */}
                                        <TableRow className="border-t dark:border-zinc-800 bg-gray-50/40">
                                            <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs">Company Name</TableHead>
                                            <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs text-right pr-6">Est Shipped Amount</TableHead>
                                            <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs border-r dark:border-zinc-800 text-right pr-6">Est Revenue</TableHead>
                                            <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs">Company Name</TableHead>
                                            <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs border-r dark:border-zinc-800 text-right pr-6">Sales Amount</TableHead>
                                            <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs">Company Name</TableHead>
                                            <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs text-right pr-6">Purchase Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedRows.map((row, index) => {
                                            const hasDaraz = row.darazRevenue > 0 || row.darazShipped > 0
                                            const hasSales = row.salesAmount > 0
                                            const hasPurchase = row.purchaseAmount > 0

                                            return (
                                                <TableRow key={`${row.date}-${row.companyName}-${index}`} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                                                    {/* Date */}
                                                    <TableCell className="font-semibold text-gray-900 dark:text-gray-100 text-xs py-3 border-r dark:border-zinc-800">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                            {formatDateStr(row.date)}
                                                        </div>
                                                    </TableCell>

                                                    {/* Daraz Transaction Columns */}
                                                    <TableCell className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                                                        {hasDaraz ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Building className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                                                <span className="line-clamp-1">{row.companyName}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className={`text-right text-xs pr-6 font-extrabold ${row.darazShipped > 0 ? 'text-sky-500 dark:text-sky-300' : 'text-gray-400'}`}>
                                                        {formatNepaliCurrency(row.darazShipped)}
                                                    </TableCell>
                                                    <TableCell className={`text-right text-xs pr-6 border-r dark:border-zinc-800 font-extrabold ${row.darazRevenue > 0 ? 'text-orange-500 dark:text-orange-300' : 'text-gray-400'}`}>
                                                        {formatNepaliCurrency(row.darazRevenue)}
                                                    </TableCell>

                                                    {/* Sales Billing Columns */}
                                                    <TableCell className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                                                        {hasSales ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Building className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                                                <span className="line-clamp-1">{row.companyName}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className={`text-right text-xs pr-6 border-r dark:border-zinc-800 font-extrabold ${hasSales ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                        {formatNepaliCurrency(row.salesAmount)}
                                                    </TableCell>

                                                    {/* Purchase Billing Columns */}
                                                    <TableCell className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                                                        {hasPurchase ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Building className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                                                <span className="line-clamp-1">{row.companyName}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className={`text-right text-xs pr-6 font-extrabold ${hasPurchase ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                                                        {formatNepaliCurrency(row.purchaseAmount)}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}

                                        {/* Footer Totals Row */}
                                        <TableRow className="bg-gray-100/90 dark:bg-zinc-800/80 font-bold border-t-2 border-gray-300 dark:border-zinc-700 hover:bg-gray-100/90">
                                            <TableCell className="text-gray-900 dark:text-gray-100 py-3 pl-4 border-r dark:border-zinc-800 text-xs">Total Summary (All Pages)</TableCell>
                                            <TableCell className="text-gray-400"></TableCell>
                                            <TableCell className="text-right text-sky-600 dark:text-sky-300 pr-6 font-black text-xs">
                                                {formatNepaliCurrency(overallTotals.totalDarazShipped)}
                                            </TableCell>
                                            <TableCell className="text-right text-orange-600 dark:text-orange-300 pr-6 border-r dark:border-zinc-800 font-black text-xs">
                                                {formatNepaliCurrency(overallTotals.totalDarazRevenue)}
                                            </TableCell>
                                            <TableCell className="text-gray-400"></TableCell>
                                            <TableCell className="text-right text-emerald-700 dark:text-emerald-400 pr-6 border-r dark:border-zinc-800 font-black text-xs">
                                                {formatNepaliCurrency(overallTotals.totalSales)}
                                            </TableCell>
                                            <TableCell className="text-gray-400"></TableCell>
                                            <TableCell className="text-right text-blue-700 dark:text-blue-400 pr-6 font-black text-xs">
                                                {formatNepaliCurrency(overallTotals.totalPurchase)}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>

                        {/* Pagination Controls */}
                        {filteredReportData.length > itemsPerPage && (
                            <div className="flex items-center justify-between py-2 bg-white dark:bg-zinc-900 px-4 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                                <p className="text-xs text-gray-500">
                                    Showing <span className="font-semibold">{Math.min(filteredReportData.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                                    <span className="font-semibold">{Math.min(filteredReportData.length, currentPage * itemsPerPage)}</span> of{' '}
                                    <span className="font-semibold">{filteredReportData.length}</span> rows
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-xs font-semibold">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
