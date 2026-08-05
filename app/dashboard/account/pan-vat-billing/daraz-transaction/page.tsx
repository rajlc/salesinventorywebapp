'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Calendar, Wallet, Search, Edit, Plus, Info, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Card, Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Badge } from '@/components/ui-shim'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { getDarazWeeklyTransactions, saveDarazWeeklyTransaction, getWeeklyEstimatedSales, DarazWeeklyTransaction } from '@/features/account/actions/daraz-transaction-actions'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

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

const getSellerColor = (seller: string) => {
    const s = (seller || '').toLowerCase()
    if (s.includes('cosmetic')) {
        return 'bg-pink-50 text-pink-700 dark:bg-pink-950/20 dark:text-pink-400 border-pink-100 dark:border-pink-900/20'
    }
    if (s.includes('btas')) {
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/20'
    }
    if (s.includes('balaju')) {
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border-purple-100 dark:border-purple-900/20'
    }
    if (s.includes('bagmati')) {
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/20'
    }
    return 'bg-zinc-50 text-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400 border-zinc-100 dark:border-zinc-800'
}

export default function DarazTransactionPage() {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [editingRow, setEditingRow] = useState<any | null>(null)
    const [isViewMode, setIsViewMode] = useState(false)
    const [selectedSeller, setSelectedSeller] = useState<string>('all')
    const queryClient = useQueryClient()

    // Form inputs state
    const [salesAmount, setSalesAmount] = useState<string>('')
    const [cofundedVoucherMax, setCofundedVoucherMax] = useState<string>('')
    const [paymentFee, setPaymentFee] = useState<string>('')
    const [darazCoinsFee, setDarazCoinsFee] = useState<string>('')
    const [freeShippingFee, setFreeShippingFee] = useState<string>('')
    const [commissionFee, setCommissionFee] = useState<string>('')
    const [gstWithholding, setGstWithholding] = useState<string>('')
    const [handlingFee, setHandlingFee] = useState<string>('')
    const [estimatedSalesAmount, setEstimatedSalesAmount] = useState<number>(0)
    const [loadingSalesEst, setLoadingSalesEst] = useState(false)

    const itemsPerPage = 12

    // Fetch Fiscal Years
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Default to running Fiscal Year
    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    const selectedFiscalYear = useMemo(() => {
        return fiscalYears.find(fy => fy.id === fiscalYearId) || activeFiscalYear
    }, [fiscalYearId, fiscalYears, activeFiscalYear])

    // Fetch Online Stores (Seller accounts & Company mappings)
    const { data: onlineStores = [], isLoading: isLoadingStores } = useOnlineStores()

    // Fetch saved settlements/transactions for selected Fiscal Year
    const { data: savedTransactions = [], isLoading: isLoadingTransactions } = useQuery({
        queryKey: ['daraz-weekly-transactions', fiscalYearId],
        queryFn: () => getDarazWeeklyTransactions(fiscalYearId !== 'all' ? fiscalYearId : undefined),
        enabled: !!fiscalYearId
    })

    // Save/Upsert Transaction Mutation
    const saveMutation = useMutation({
        mutationFn: saveDarazWeeklyTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['daraz-weekly-transactions'] })
            toast.success('Weekly transaction saved successfully!')
            setEditingRow(null)
        },
        onError: (err: any) => {
            toast.error(`Error saving: ${err.message}`)
        }
    })

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1)
    }, [search, fiscalYearId, selectedSeller])

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

    // Generate combined list of Weeks * Seller Accounts
    const allTableRows = useMemo(() => {
        if (weeks.length === 0 || onlineStores.length === 0) return []
        
        const rows: any[] = []
        weeks.forEach(week => {
            onlineStores.forEach((store: any) => {
                // Find matching saved transaction from database
                const saved = savedTransactions.find(t => 
                    t.start_date === week.startDateStr && 
                    t.end_date === week.endDateStr && 
                    t.seller_account === store.seller_account
                )

                rows.push({
                    weekLabel: week.label,
                    startDateStr: week.startDateStr,
                    endDateStr: week.endDateStr,
                    sellerAccount: store.seller_account,
                    companyName: store.company_name,
                    fiscalYearId: selectedFiscalYear?.id,
                    savedTransaction: saved
                })
            })
        })
        return rows
    }, [weeks, onlineStores, savedTransactions, selectedFiscalYear])

    // Filtered Rows
    const filteredRows = useMemo(() => {
        let rows = allTableRows
        if (selectedSeller !== 'all') {
            rows = rows.filter(r => r.sellerAccount === selectedSeller)
        }
        if (!search.trim()) return rows
        const s = search.toLowerCase()
        return rows.filter(r => 
            r.sellerAccount.toLowerCase().includes(s) || 
            r.companyName.toLowerCase().includes(s) ||
            r.weekLabel.toLowerCase().includes(s)
        )
    }, [allTableRows, search, selectedSeller])

    const sellerAccounts = useMemo(() => {
        return Array.from(new Set(onlineStores.map((s: any) => s.seller_account))) as string[]
    }, [onlineStores])

    const footerTotals = useMemo(() => {
        let totalSales = 0
        let totalTds = 0
        let totalFees = 0

        filteredRows.forEach(row => {
            const t = row.savedTransaction
            if (t) {
                totalSales += t.sales_amount || 0
                totalTds += t.general_sales_tax_withholding || 0
                totalFees += (
                    (t.cofunded_voucher_max || 0) +
                    (t.payment_fee || 0) +
                    (t.daraz_coins_discount_participation_fee || 0) +
                    (t.free_shipping_max_fee || 0) +
                    (t.commission_fee || 0) +
                    (t.handling_fee || 0)
                )
            }
        })

        return { totalSales, totalTds, totalFees }
    }, [filteredRows])

    // Paginated Rows
    const paginatedRows = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        return filteredRows.slice(startIndex, startIndex + itemsPerPage)
    }, [filteredRows, currentPage])

    const totalPages = Math.ceil(filteredRows.length / itemsPerPage)

    // Load actual weekly Estimated Sales amount when modal is triggered
    useEffect(() => {
        if (editingRow) {
            setLoadingSalesEst(true)
            getWeeklyEstimatedSales(editingRow.startDateStr, editingRow.endDateStr, editingRow.sellerAccount)
                .then(amount => {
                    setEstimatedSalesAmount(amount)
                })
                .catch(err => {
                    console.error(err)
                    toast.error('Failed to calculate Estimated Sales Amount')
                })
                .finally(() => {
                    setLoadingSalesEst(false)
                })
        }
    }, [editingRow])

    // Handle Edit Click
    const handleEdit = (row: any, isView = false) => {
        setIsViewMode(isView)
        setEditingRow(row)
        const t = row.savedTransaction
        
        // Pre-fill inputs with saved details or default empty string
        setSalesAmount(t ? t.sales_amount.toString() : '')
        setCofundedVoucherMax(t ? t.cofunded_voucher_max.toString() : '')
        setPaymentFee(t ? t.payment_fee.toString() : '')
        setDarazCoinsFee(t ? t.daraz_coins_discount_participation_fee.toString() : '')
        setFreeShippingFee(t ? t.free_shipping_max_fee.toString() : '')
        setCommissionFee(t ? t.commission_fee.toString() : '')
        setGstWithholding(t ? t.general_sales_tax_withholding.toString() : '')
        setHandlingFee(t ? t.handling_fee.toString() : '')
        setEstimatedSalesAmount(t ? t.estimated_sales_amount : 0)
    }

    // Dynamic fee summation on-the-fly (excluding General Sales Tax withholding)
    const totalFees = useMemo(() => {
        const v1 = parseFloat(cofundedVoucherMax) || 0
        const v2 = parseFloat(paymentFee) || 0
        const v3 = parseFloat(darazCoinsFee) || 0
        const v4 = parseFloat(freeShippingFee) || 0
        const v5 = parseFloat(commissionFee) || 0
        const v7 = parseFloat(handlingFee) || 0
        return v1 + v2 + v3 + v4 + v5 + v7
    }, [cofundedVoucherMax, paymentFee, darazCoinsFee, freeShippingFee, commissionFee, handlingFee])

    const handleSave = () => {
        if (!editingRow) return
        
        const num = (val: string) => parseFloat(val) || 0

        saveMutation.mutate({
            start_date: editingRow.startDateStr,
            end_date: editingRow.endDateStr,
            seller_account: editingRow.sellerAccount,
            company_name: editingRow.companyName,
            estimated_sales_amount: estimatedSalesAmount,
            sales_amount: num(salesAmount),
            cofunded_voucher_max: num(cofundedVoucherMax),
            payment_fee: num(paymentFee),
            daraz_coins_discount_participation_fee: num(darazCoinsFee),
            free_shipping_max_fee: num(freeShippingFee),
            commission_fee: num(commissionFee),
            general_sales_tax_withholding: num(gstWithholding),
            handling_fee: num(handlingFee),
            total_commission_fees: totalFees,
            fiscal_year_id: editingRow.fiscalYearId || null
        })
    }

    const isLoading = isLoadingStores || isLoadingTransactions

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950 space-y-5 pb-8 overflow-y-auto">
            {/* Header section */}
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
                            <Wallet className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                            Daraz Transaction
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Weekly settlement settlements and commission metrics</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Seller Account Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Seller Account:</span>
                        <select
                            value={selectedSeller}
                            onChange={(e) => setSelectedSeller(e.target.value)}
                            className="min-w-[150px] px-3 py-1.5 text-[13px] font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm cursor-pointer"
                        >
                            <option value="all">All Sellers</option>
                            {sellerAccounts.map((seller) => (
                                <option key={seller} value={seller}>
                                    {seller}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Fiscal Year Filter */}
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Fiscal Year:</span>
                        <select
                            value={fiscalYearId}
                            onChange={(e) => setFiscalYearId(e.target.value)}
                            className="min-w-[150px] px-3 py-1.5 text-[13px] font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm cursor-pointer"
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
        </div>

        <div className="px-4 md:px-6 space-y-4">
                {/* Search & Statistics Card */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="w-full md:max-w-xs relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by store or date..."
                            className="w-full pl-9 pr-3 h-9 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                    {selectedFiscalYear && (
                        <div className="text-[12px] text-gray-500 font-semibold bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-400 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-900/50">
                            Active range: {selectedFiscalYear.start_date} to {selectedFiscalYear.end_date}
                        </div>
                    )}
                </div>

                {/* Main Table */}
                <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-3">
                            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-orange-600"></div>
                            <p className="text-sm text-gray-500">Loading settlements schedule...</p>
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Wallet className="h-10 w-10 text-gray-300 mb-3" />
                            <h3 className="font-bold text-gray-800 dark:text-gray-200">No Weekly Transactions Found</h3>
                            <p className="text-xs text-gray-500 mt-1 max-w-sm">No online stores are registered, or the selected fiscal year has no weeks.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/50">
                                    <TableRow>
                                        <TableHead className="w-16">S.N</TableHead>
                                        <TableHead>Date Period</TableHead>
                                        <TableHead>Company Name</TableHead>
                                        <TableHead className="text-right">Sales Amount</TableHead>
                                        <TableHead className="text-right">Total Fees</TableHead>
                                        <TableHead className="text-center w-24">Status</TableHead>
                                        <TableHead className="text-center w-24">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedRows.map((row, index) => {
                                        const t = row.savedTransaction
                                        const serialNo = (currentPage - 1) * itemsPerPage + index + 1
                                        return (
                                            <TableRow key={`${row.startDateStr}-${row.sellerAccount}`} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                                                <TableCell className="text-gray-500 font-medium">{serialNo}</TableCell>
                                                <TableCell className="py-3">
                                                    <div className="font-semibold text-gray-900 dark:text-gray-100">{row.weekLabel}</div>
                                                    <div className="mt-1">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${getSellerColor(row.sellerAccount)}`}>
                                                            {row.sellerAccount}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-gray-600 dark:text-gray-400 font-medium">{row.companyName}</TableCell>
                                                <TableCell className="text-right font-bold text-gray-900 dark:text-gray-100">
                                                    {t ? (
                                                        <div className="space-y-0.5 text-right">
                                                            <div>Rs. {t.sales_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                            <div className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                                                                TDS = Rs. {(t.general_sales_tax_withholding || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                                                    {t ? (() => {
                                                        const commFees = (
                                                            (t.cofunded_voucher_max || 0) +
                                                            (t.payment_fee || 0) +
                                                            (t.daraz_coins_discount_participation_fee || 0) +
                                                            (t.free_shipping_max_fee || 0) +
                                                            (t.commission_fee || 0) +
                                                            (t.handling_fee || 0)
                                                        )
                                                        return `Rs. ${commFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    })() : '-'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {t ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Saved
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-400">
                                                            Pending
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {t && (
                                                            <Button
                                                                onClick={() => handleEdit(row, true)}
                                                                variant="outline"
                                                                size="sm"
                                                                className="hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5"
                                                            >
                                                                <Info className="h-3.5 w-3.5" />
                                                                View
                                                            </Button>
                                                        )}
                                                        <Button
                                                            onClick={() => handleEdit(row, false)}
                                                            variant="outline"
                                                            size="sm"
                                                            className="hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1.5"
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                            Edit
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}

                                    {/* Footer Totals Row */}
                                    {filteredRows.length > 0 && (
                                        <TableRow className="bg-gray-100/80 dark:bg-zinc-800/80 font-bold hover:bg-gray-100/80 dark:hover:bg-zinc-800/80 border-t-2 border-gray-300 dark:border-zinc-700">
                                            <TableCell colSpan={2} className="text-gray-900 dark:text-gray-100 py-3 pl-4">Total Summary (All Pages)</TableCell>
                                            <TableCell className="text-gray-600 dark:text-gray-400 font-medium"></TableCell>
                                            <TableCell className="text-right text-gray-950 dark:text-white pr-4">
                                                <div className="space-y-0.5">
                                                    <div>Rs. {footerTotals.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    <div className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                                                        Total TDS = Rs. {footerTotals.totalTds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-red-700 dark:text-red-400 pr-4">
                                                Rs. {footerTotals.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell colSpan={2}></TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </Card>

                {/* Pagination Controls */}
                {filteredRows.length > itemsPerPage && (
                    <div className="flex items-center justify-between py-2">
                        <p className="text-xs text-gray-500">
                            Showing <span className="font-semibold">{Math.min(filteredRows.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                            <span className="font-semibold">{Math.min(filteredRows.length, currentPage * itemsPerPage)}</span> of{' '}
                            <span className="font-semibold">{filteredRows.length}</span> rows
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

            {/* Edit Dialog Modal */}
            <Dialog open={editingRow !== null} onOpenChange={(open) => !open && setEditingRow(null)}>
                <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh] bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-xl p-6">
                    <DialogHeader className="border-b dark:border-zinc-800 pb-3 mb-4">
                        <DialogTitle className="text-[17px] font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {isViewMode ? (
                                <Info className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                            ) : (
                                <Edit className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                            )}
                            {isViewMode ? 'View Settlement Ledger' : 'Settlement Ledger'} - {editingRow?.sellerAccount}
                        </DialogTitle>
                    </DialogHeader>

                    {editingRow && (
                        <div className="space-y-5 text-sm">
                            {/* Readonly info grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 dark:bg-zinc-800/40 p-3 rounded-lg border dark:border-zinc-800/80">
                                <div>
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Date Period</span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{editingRow.weekLabel}</span>
                                </div>
                                <div>
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Seller Account</span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{editingRow.sellerAccount}</span>
                                </div>
                                <div>
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Company Name</span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{editingRow.companyName}</span>
                                </div>
                            </div>

                            {/* Revenue Stats & Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b dark:border-zinc-800 pb-4">
                                <div className="space-y-1.5">
                                    <Label className="text-gray-700 dark:text-gray-300 font-bold block">Estimated Sales Amount</Label>
                                    <div className="relative">
                                        <Input
                                            type="text"
                                            value={loadingSalesEst ? '' : `Rs. ${estimatedSalesAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                            disabled
                                            className="bg-gray-50 dark:bg-zinc-800 border-gray-200 text-gray-600 font-bold"
                                        />
                                        {loadingSalesEst && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-gray-400">
                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                                Syncing...
                                            </div>
                                        )}
                                        {!loadingSalesEst && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                                                (delivered orders)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-gray-700 dark:text-gray-300 font-bold block">Sales Amount</Label>
                                    <Input
                                        type="number"
                                        value={salesAmount}
                                        onChange={(e) => setSalesAmount(e.target.value)}
                                        placeholder="0.00"
                                        disabled={isViewMode}
                                        className="focus:ring-orange-500 focus:border-orange-500 font-semibold"
                                    />
                                </div>
                            </div>

                            {/* Commission & Fees Section */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-gray-800 dark:text-gray-200 border-l-2 border-orange-500 pl-2">
                                    Daraz Commission & Fees
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-gray-600 dark:text-gray-400 font-semibold block text-[13px]">Co-funded Voucher max</Label>
                                        <Input
                                            type="number"
                                            value={cofundedVoucherMax}
                                            onChange={(e) => setCofundedVoucherMax(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isViewMode}
                                            className="h-9 text-[13px]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-gray-600 dark:text-gray-400 font-semibold block text-[13px]">Payment Fee</Label>
                                        <Input
                                            type="number"
                                            value={paymentFee}
                                            onChange={(e) => setPaymentFee(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isViewMode}
                                            className="h-9 text-[13px]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-gray-600 dark:text-gray-400 font-semibold block text-[13px]">Daraz Coins Discount Participation fee</Label>
                                        <Input
                                            type="number"
                                            value={darazCoinsFee}
                                            onChange={(e) => setDarazCoinsFee(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isViewMode}
                                            className="h-9 text-[13px]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-gray-600 dark:text-gray-400 font-semibold block text-[13px]">Free Shipping Max Fee</Label>
                                        <Input
                                            type="number"
                                            value={freeShippingFee}
                                            onChange={(e) => setFreeShippingFee(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isViewMode}
                                            className="h-9 text-[13px]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-gray-600 dark:text-gray-400 font-semibold block text-[13px]">Commission Fee</Label>
                                        <Input
                                            type="number"
                                            value={commissionFee}
                                            onChange={(e) => setCommissionFee(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isViewMode}
                                            className="h-9 text-[13px]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-gray-600 dark:text-gray-400 font-semibold block text-[13px]">General Sales Tax Withholding</Label>
                                        <Input
                                            type="number"
                                            value={gstWithholding}
                                            onChange={(e) => setGstWithholding(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isViewMode}
                                            className="h-9 text-[13px]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-gray-600 dark:text-gray-400 font-semibold block text-[13px]">Handling Fee</Label>
                                        <Input
                                            type="number"
                                            value={handlingFee}
                                            onChange={(e) => setHandlingFee(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isViewMode}
                                            className="h-9 text-[13px]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Calculation Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                {/* Total Commission & Fees Card */}
                                <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/50 p-4 rounded-xl flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Commission & Fees</span>
                                        <span className="text-lg font-extrabold text-orange-600 dark:text-orange-400">
                                            Rs. {totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-gray-400 max-w-[150px] text-right leading-snug">
                                        Sum of voucher, payment, coins discount, shipping, commission, and handling.
                                    </div>
                                </div>

                                {/* TDS Card */}
                                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 p-4 rounded-xl flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">TDS</span>
                                        <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                                            Rs. {(parseFloat(gstWithholding) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-gray-400 max-w-[150px] text-right leading-snug">
                                        General Sales Tax Withholding amount.
                                    </div>
                                </div>
                            </div>

                            {/* Actions footer */}
                            <DialogFooter className="border-t dark:border-zinc-800 pt-4 mt-6 flex gap-2 justify-end">
                                {isViewMode ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => setEditingRow(null)}
                                    >
                                        Close
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={() => setEditingRow(null)}
                                            disabled={saveMutation.isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saveMutation.isPending || loadingSalesEst}
                                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold transition-all shadow-md hover:shadow"
                                        >
                                            {saveMutation.isPending ? 'Saving...' : 'Save Settlement'}
                                        </Button>
                                    </>
                                )}
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
