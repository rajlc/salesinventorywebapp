'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Building, RefreshCw, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { Card, Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button } from '@/components/ui-shim'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getSalesBills } from '@/features/sales/actions/sales-bill-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'

// Helper function to segment a date range (Monday-Sunday) for a given Fiscal Year
function getWeeksInInterval(startDateStr: string, endDateStr: string) {
    if (!startDateStr || !endDateStr) return []
    
    const start = new Date(startDateStr)
    const end = new Date(endDateStr)
    
    const weeks: Array<{
        label: string
        startDateStr: string
        endDateStr: string
    }> = []
    
    // Find the Monday of the week containing the start date
    let current = new Date(start)
    const day = current.getDay()
    const diff = current.getDate() - day + (day === 0 ? -6 : 1) // Monday is 1
    current.setDate(diff)
    
    while (current <= end) {
        const mon = new Date(current)
        const sun = new Date(current)
        sun.setDate(mon.getDate() + 6)
        
        const formatDate = (d: Date) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
        }
        
        const pad = (n: number) => n.toString().padStart(2, '0')
        const formatDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        
        weeks.push({
            label: `${formatDate(mon)} - ${formatDate(sun)}`,
            startDateStr: formatDateStr(mon),
            endDateStr: formatDateStr(sun)
        })
        
        current.setDate(current.getDate() + 7)
    }
    
    return weeks.reverse() // Latest weeks on top
}

export function SalesAnalysisPage() {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [selectedCompany, setSelectedCompany] = useState<string>('all')
    const [hideEmpty, setHideEmpty] = useState<boolean>(true)
    const [currentPage, setCurrentPage] = useState(1)
    
    const itemsPerPage = 12

    // Fetch Fiscal Years
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Default to active Fiscal Year on mount
    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    const selectedFiscalYear = useMemo(() => {
        return fiscalYears.find(fy => fy.id === fiscalYearId) || activeFiscalYear
    }, [fiscalYearId, fiscalYears, activeFiscalYear])

    // Fetch Company Details (Our seller companies)
    const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    // Fetch Sales Bills
    const { data: salesBills = [], isLoading: isLoadingBills, refetch, isRefetching } = useQuery({
        queryKey: ['sales-bills', fiscalYearId],
        queryFn: () => getSalesBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined
        }),
        enabled: !!fiscalYearId
    })

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [fiscalYearId, selectedCompany, hideEmpty])

    // Generate weeks array based on selected Fiscal Year
    const weeks = useMemo(() => {
        if (!selectedFiscalYear) return []
        const allWeeks = getWeeksInInterval(selectedFiscalYear.start_date, selectedFiscalYear.end_date)
        
        // Show all weeks for past (non-active) fiscal years
        if (!selectedFiscalYear.is_active) {
            return allWeeks
        }
        
        // Find the current week containing today's date
        const today = new Date()
        const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
        
        const currentWeekIndex = allWeeks.findIndex(week => {
            const [sy, sm, sd] = week.startDateStr.split('-').map(Number)
            const [ey, em, ed] = week.endDateStr.split('-').map(Number)
            const start = new Date(sy, sm - 1, sd).getTime()
            const end = new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime()
            return todayTime >= start && todayTime <= end
        })
        
        if (currentWeekIndex === -1) {
            return allWeeks
        }
        
        // Return current week and all past weeks in the fiscal year
        return allWeeks.slice(currentWeekIndex)
    }, [selectedFiscalYear])

    // Generate combined table rows of Weeks * Companies
    const allTableRows = useMemo(() => {
        if (weeks.length === 0 || companies.length === 0) return []
        
        const rows: any[] = []
        weeks.forEach(week => {
            companies.forEach(company => {
                // Filter bills for this company and date range
                const billsInPeriod = salesBills.filter(bill => {
                    const matchesCompany = bill.seller_company_id === company.id
                    const billDate = bill.bill_date_ad
                    const inRange = billDate >= week.startDateStr && billDate <= week.endDateStr
                    return matchesCompany && inRange
                })
                
                const billingAmount = billsInPeriod.reduce((sum, b) => sum + (b.total_amount || 0), 0)
                const billCount = billsInPeriod.length
                
                rows.push({
                    weekLabel: week.label,
                    startDateStr: week.startDateStr,
                    endDateStr: week.endDateStr,
                    companyId: company.id,
                    companyName: company.company_name,
                    billingAmount,
                    billCount
                })
            })
        })
        return rows
    }, [weeks, companies, salesBills])

    // Filtered Rows
    const filteredRows = useMemo(() => {
        let rows = allTableRows
        
        if (selectedCompany !== 'all') {
            rows = rows.filter(r => r.companyId === selectedCompany)
        }
        
        if (hideEmpty) {
            rows = rows.filter(r => r.billingAmount > 0)
        }
        
        return rows
    }, [allTableRows, selectedCompany, hideEmpty])

    // Totals calculations (across all pages)
    const footerTotals = useMemo(() => {
        const totalAmount = filteredRows.reduce((sum, r) => sum + r.billingAmount, 0)
        const totalBills = filteredRows.reduce((sum, r) => sum + r.billCount, 0)
        return { totalAmount, totalBills }
    }, [filteredRows])

    // Paginated Rows
    const paginatedRows = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        return filteredRows.slice(startIndex, startIndex + itemsPerPage)
    }, [filteredRows, currentPage])

    const totalPages = Math.ceil(filteredRows.length / itemsPerPage)

    const isLoading = isLoadingCompanies || isLoadingBills

    return (
        <Card className="overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm">
            {/* Filters Section */}
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        {/* Company Selection Dropdown */}
                        <div className="min-w-[180px]">
                            <select
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                                className="w-full px-3 py-1.5 text-[13px] font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                            >
                                <option value="all">All Companies</option>
                                {companies.map((company) => (
                                    <option key={company.id} value={company.id}>
                                        {company.company_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Fiscal Year dropdown */}
                        <div className="min-w-[160px]">
                            <select
                                value={fiscalYearId}
                                onChange={(e) => setFiscalYearId(e.target.value)}
                                className="w-full px-3 py-1.5 text-[13px] font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                            >
                                <option value="all">All Fiscal Years</option>
                                {fiscalYears.map((fy) => (
                                    <option key={fy.id} value={fy.id}>
                                        {fy.name} {fy.is_active ? '(Running)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Checkbox Toggle: Hide empty periods */}
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hideEmpty}
                                onChange={(e) => setHideEmpty(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            Hide empty periods
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedFiscalYear && (
                            <span className="text-[12px] font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                Range: {selectedFiscalYear.start_date} to {selectedFiscalYear.end_date}
                            </span>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isLoading || isRefetching}
                            className="h-8 w-8 p-0"
                            title="Refresh data"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-500">Loading sales analysis...</p>
                </div>
            ) : filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-10 w-10 text-gray-300 mb-3" />
                    <h3 className="font-bold text-gray-800 dark:text-gray-200">No Sales Data Found</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        No sales bills were recorded in the selected periods, or try unchecking the "Hide empty periods" filter.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-50 dark:bg-zinc-800/50">
                            <TableRow>
                                <TableHead className="w-16">S.N</TableHead>
                                <TableHead>Date Period</TableHead>
                                <TableHead>Company Name</TableHead>
                                <TableHead className="text-center w-32">Sales Bill Count</TableHead>
                                <TableHead className="text-right w-44 pr-6">Billing Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedRows.map((row, index) => {
                                const serialNo = (currentPage - 1) * itemsPerPage + index + 1
                                return (
                                    <TableRow key={`${row.startDateStr}-${row.companyId}`} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                                        <TableCell className="text-gray-500 font-medium text-xs">{serialNo}</TableCell>
                                        <TableCell className="py-3">
                                            <div className="font-bold text-gray-900 dark:text-gray-100 text-xs flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                {row.weekLabel}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-gray-700 dark:text-gray-300 font-semibold text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <Building className="h-3.5 w-3.5 text-gray-400" />
                                                {row.companyName}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-gray-600 dark:text-gray-400 text-xs">
                                            {row.billCount} {row.billCount === 1 ? 'bill' : 'bills'}
                                        </TableCell>
                                        <TableCell className="text-right font-extrabold text-blue-600 dark:text-blue-400 text-xs pr-6">
                                            {formatNepaliCurrency(row.billingAmount)}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}

                            {/* Total summary row */}
                            {filteredRows.length > 0 && (
                                <TableRow className="bg-gray-100/80 dark:bg-zinc-800/80 font-bold hover:bg-gray-100/80 dark:hover:bg-zinc-800/80 border-t-2 border-gray-300 dark:border-zinc-700">
                                    <TableCell colSpan={3} className="text-gray-900 dark:text-gray-100 py-3 pl-4">Total Summary (All Pages)</TableCell>
                                    <TableCell className="text-center text-gray-800 dark:text-gray-200">
                                        {footerTotals.totalBills} {footerTotals.totalBills === 1 ? 'bill' : 'bills'}
                                    </TableCell>
                                    <TableCell className="text-right text-blue-700 dark:text-blue-400 pr-6">
                                        {formatNepaliCurrency(footerTotals.totalAmount)}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Pagination Section */}
            {!isLoading && filteredRows.length > itemsPerPage && (
                <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                    <p className="text-xs text-gray-500">
                        Showing <span className="font-semibold">{Math.min(filteredRows.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                        <span className="font-semibold">{Math.min(filteredRows.length, currentPage * itemsPerPage)}</span> of{' '}
                        <span className="font-semibold">{filteredRows.length}</span> periods
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
        </Card>
    )
}
