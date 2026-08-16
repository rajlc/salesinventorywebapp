'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, ShoppingBag, ShoppingCart, FileText, Plus, Building, Calendar, Layers, ArrowRight, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { Card, Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button } from '@/components/ui-shim'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getPanVatBills } from '@/features/account/actions/pan-vat-bill-actions'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { AddPanVatCompanyModal } from '@/features/account/components/AddPanVatCompanyModal'
import { AddPanVatBillModal } from '@/features/account/components/AddPanVatBillModal'
import { useOnlineStores } from '@/features/settings/hooks/useStores'

import { getSalesBills } from '@/features/sales/actions/sales-bill-actions'
import { AddSalesBillModal } from '@/features/sales/components/AddSalesBillModal'
import { getStockAnalysisData } from '@/features/stock-analysis/actions/stock-analysis-actions'

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

export default function PanVatBillingPage() {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false)
    const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false)
    const queryClient = useQueryClient()

    // Fetch fiscal years
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Get selected fiscal year data
    const selectedFiscalYear = useMemo(() => {
        return fiscalYearId !== 'all' ? fiscalYears.find(fy => fy.id === fiscalYearId) : null
    }, [fiscalYearId, fiscalYears])

    // Fetch Online Stores (Seller accounts & Company mappings)
    const { data: onlineStores = [] } = useOnlineStores()

    // Sales Billing Section states
    const [isAddSalesBillModalOpen, setIsAddSalesBillModalOpen] = useState(false)
    const [showAllSalesHistory, setShowAllSalesHistory] = useState(false)
    const [showAllDailySales, setShowAllDailySales] = useState(false)

    // Weeks calculation
    const weeks = useMemo(() => {
        if (!selectedFiscalYear) return []
        return getWeeksInInterval(selectedFiscalYear.start_date, selectedFiscalYear.end_date)
    }, [selectedFiscalYear])

    // Find the current week containing today's date
    const currentWeek = useMemo(() => {
        const today = new Date()
        const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

        return weeks.find(week => {
            const [sy, sm, sd] = week.startDateStr.split('-').map(Number)
            const [ey, em, ed] = week.endDateStr.split('-').map(Number)
            const start = new Date(sy, sm - 1, sd).getTime()
            const end = new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime()
            return todayTime >= start && todayTime <= end
        })
    }, [weeks])

    // Get last 4 weeks
    const last4Weeks = useMemo(() => {
        if (!currentWeek) return []
        const idx = weeks.findIndex(w => w.startDateStr === currentWeek.startDateStr)
        if (idx === -1) return []
        return weeks.slice(idx + 1, idx + 5)
    }, [weeks, currentWeek])

    // Set active fiscal year as default on mount
    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    // Fetch company details (our own company details)
    const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
        staleTime: 1000 * 60 * 5,
    })

    // Fetch purchase bills
    const { data: bills = [], isLoading: isLoadingBills } = useQuery({
        queryKey: ['pan-vat-bills', fiscalYearId, selectedFiscalYear?.start_date, selectedFiscalYear?.end_date],
        queryFn: () => getPanVatBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            startDate: selectedFiscalYear?.start_date,
            endDate: selectedFiscalYear?.end_date,
        }),
        staleTime: 1000 * 60 * 2,
    })

    // Fetch Stock Analysis data for valuation
    const { data: stockData = [], isLoading: isLoadingStock } = useQuery({
        queryKey: ['stock-analysis', fiscalYearId, 'all', ''],
        queryFn: () => getStockAnalysisData({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            companyId: undefined,
            search: undefined
        }),
        enabled: !!fiscalYearId,
        staleTime: 1000 * 60 * 5,
    })

    const totalStockValuation = useMemo(() => {
        return stockData.reduce((sum, item) => {
            return sum + (item.running_stock * item.weighted_average_rate)
        }, 0)
    }, [stockData])

    // Fetch Sales Bills
    const { data: salesBills = [], isLoading: isLoadingSalesBills } = useQuery({
        queryKey: ['sales-bills', fiscalYearId],
        queryFn: () => getSalesBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined
        }),
        enabled: !!fiscalYearId,
        staleTime: 1000 * 60 * 2,
    })

    // Generate combined sales history list for the last 4 weeks
    const last4WeeksSalesHistory = useMemo(() => {
        if (last4Weeks.length === 0 || companies.length === 0) return []

        const rows: any[] = []
        last4Weeks.forEach(week => {
            companies.forEach(company => {
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
    }, [last4Weeks, companies, salesBills])

    // Filter displayed sales history (show only the latest 2 weeks if showAllSalesHistory is false)
    const displayedSalesHistory = useMemo(() => {
        if (showAllSalesHistory || last4WeeksSalesHistory.length === 0) {
            return last4WeeksSalesHistory
        }
        if (last4Weeks.length <= 2) return last4WeeksSalesHistory
        const firstTwoWeeks = last4Weeks.slice(0, 2).map(w => w.startDateStr)
        return last4WeeksSalesHistory.filter(row => firstTwoWeeks.includes(row.startDateStr))
    }, [showAllSalesHistory, last4WeeksSalesHistory, last4Weeks])

    // Generate dates list for the last 7 days relative to today
    const last7DaysList = useMemo(() => {
        const list: string[] = []
        const today = new Date()
        for (let i = 0; i < 7; i++) {
            const d = new Date(today)
            d.setDate(today.getDate() - i)
            const pad = (n: number) => n.toString().padStart(2, '0')
            list.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
        }
        return list
    }, [])

    const formatDateStr = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
    }

    // Generate combined daily sales history list for the last 7 days
    const last7DaysSalesHistory = useMemo(() => {
        if (companies.length === 0) return []

        const rows: any[] = []
        last7DaysList.forEach(dateStr => {
            companies.forEach(company => {
                const billsInDay = salesBills.filter(bill => {
                    return bill.seller_company_id === company.id && bill.bill_date_ad === dateStr
                })

                const billingAmount = billsInDay.reduce((sum, b) => sum + (b.total_amount || 0), 0)
                const billCount = billsInDay.length

                rows.push({
                    dateStr,
                    formattedDate: formatDateStr(dateStr),
                    companyId: company.id,
                    companyName: company.company_name,
                    billingAmount,
                    billCount
                })
            })
        })
        return rows
    }, [last7DaysList, companies, salesBills])

    // Filter displayed daily sales history (show only the latest 3 days if showAllDailySales is false)
    const displayedDailySales = useMemo(() => {
        if (showAllDailySales || last7DaysSalesHistory.length === 0) {
            return last7DaysSalesHistory
        }
        const first3Dates = last7DaysList.slice(0, 3)
        return last7DaysSalesHistory.filter(row => first3Dates.includes(row.dateStr))
    }, [showAllDailySales, last7DaysSalesHistory, last7DaysList])

    // Aggregate bill details for each company
    const activeCompanies = companies.map(company => {
        // Filter bills where buyer is this company
        const companyBills = bills.filter(bill => bill.buyer_company_id === company.id)
        const totalPurchaseAmount = companyBills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0)
        const totalBillCount = companyBills.length

        return {
            ...company,
            totalPurchaseAmount,
            totalBillCount
        }
    }).filter(company => company.totalPurchaseAmount > 0 || company.totalBillCount > 0)

    const billingModules = [
        {
            name: 'Purchase Billing',
            href: '/dashboard/account/pan-vat-billing/purchase-billing',
            icon: ShoppingBag,
            color: 'bg-blue-600 dark:bg-blue-500',
            description: 'Invoices, parties statement and billing reports'
        },
        {
            name: 'Sales Billing',
            href: '/dashboard/account/pan-vat-billing/sales-billing',
            icon: ShoppingCart,
            color: 'bg-emerald-600 dark:bg-emerald-500',
            description: 'Manage sales invoices and tax billing details'
        },
        {
            name: 'Daraz Account & Finance',
            href: '/dashboard/account/pan-vat-billing/daraz-finance',
            icon: FileText,
            color: 'bg-amber-600 dark:bg-amber-500',
            description: 'Order financial breakdown, fees, purchase cost & net profit'
        },
        {
            name: 'Report',
            href: '/dashboard/account/pan-vat-billing/report',
            icon: FileText,
            color: 'bg-violet-600 dark:bg-violet-500',
            description: 'Comprehensive tax and VAT transaction reports'
        },
    ]

    const isLoading = isLoadingCompanies || isLoadingBills

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 space-y-6 pb-10 overflow-y-auto font-['Inter',sans-serif] antialiased">
            {/* Embed Google Font Inter */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

            {/* Top Bar with Fiscal Year */}
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 px-6 py-3.5 shadow-2xs sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-['Inter',sans-serif]">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/account"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all text-slate-600 dark:text-slate-400 hidden md:block"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Pan/Vat Billing</h1>
                        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Manage tax, purchase and sales invoices</p>
                    </div>
                </div>

                {/* Fiscal Year Filter */}
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-zinc-800/80 px-3.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-700/70 shadow-2xs">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fiscal Year:</span>
                    <select
                        value={fiscalYearId}
                        onChange={(e) => setFiscalYearId(e.target.value)}
                        className="px-2.5 py-1 text-[13px] font-semibold border-none bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
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

            {/* Quick Navigation Modules Grid (4 Cards: Purchase -> Sales -> Daraz -> Report) */}
            <div className="px-4 md:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {billingModules.map((module) => {
                        const Icon = module.icon
                        return (
                            <Link key={module.name} href={module.href} className="group">
                                <Card className="p-4 hover:shadow-md border border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 rounded-2xl transition-all duration-300 cursor-pointer h-full flex items-start gap-3.5 shadow-2xs">
                                    <div className={`${module.color} p-3 rounded-xl shadow-xs text-white shrink-0 group-hover:scale-105 transition-transform`}>
                                        <Icon size={20} />
                                    </div>
                                    <div className="space-y-1 pr-5 relative w-full font-['Inter',sans-serif]">
                                        <h3 className="font-extrabold text-[14px] text-slate-900 dark:text-slate-100">{module.name}</h3>
                                        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">{module.description}</p>
                                        <ArrowRight size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* 2-Column Grid: Purchase Billing (Left) and Sales Billing (Right) in Same Row */}
            <div className="px-4 md:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    
                    {/* LEFT COLUMN: PURCHASE BILLING */}
                    <div className="space-y-4">
                        {/* Section Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                    <ShoppingBag className="h-4.5 w-4.5" />
                                </div>
                                <h2 className="text-[16px] font-extrabold text-slate-900 dark:text-slate-100">Purchase Billing</h2>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800">
                                    {selectedFiscalYear ? selectedFiscalYear.name : 'All Years'}
                                </span>
                            </div>
                        </div>

                        {/* Company Cards */}
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                                <p className="text-xs font-semibold text-slate-500">Loading purchase summaries...</p>
                            </div>
                        ) : activeCompanies.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-800 rounded-2xl p-8 text-center">
                                <Building className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                <h3 className="font-bold text-[14px] text-slate-800 dark:text-slate-200">No Active Purchases</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                                    No recorded purchases or bills in the selected fiscal year {selectedFiscalYear ? `(${selectedFiscalYear.name})` : ''}.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {activeCompanies.map((company) => (
                                    <Card
                                        key={company.id}
                                        className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden rounded-2xl shadow-2xs"
                                    >
                                        <div className="p-4 space-y-2.5">
                                            {/* Company Name Header */}
                                            <div className="flex items-start gap-2.5">
                                                <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 shrink-0">
                                                    <Building className="h-4 w-4" />
                                                </div>
                                                <div className="space-y-0.5 min-w-0">
                                                    <h3 className="font-extrabold text-[14px] text-slate-900 dark:text-slate-100 truncate">
                                                        {company.company_name}
                                                    </h3>
                                                    {company.pan_vat_details && (
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            PAN/VAT: <span className="font-semibold">{company.pan_vat_details}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Address */}
                                            {company.address && (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 border-t border-slate-100 dark:border-zinc-800/80 pt-2">
                                                    {company.address}
                                                </p>
                                            )}
                                        </div>

                                        {/* Financial Details Block */}
                                        <div className="bg-blue-50/50 dark:bg-blue-950/20 border-t border-slate-100 dark:border-zinc-800 p-3.5 flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                                    Total Purchases
                                                </span>
                                                <span className="text-[14px] font-black text-blue-600 dark:text-blue-400">
                                                    {formatNepaliCurrency(company.totalPurchaseAmount)}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                                    Total Bills
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full mt-0.5">
                                                    <Layers className="h-3 w-3" />
                                                    {company.totalBillCount} {company.totalBillCount === 1 ? 'Bill' : 'Bills'}
                                                </span>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: SALES BILLING */}
                    <div className="space-y-4">
                        {/* Section Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                    <ShoppingCart className="h-4.5 w-4.5" />
                                </div>
                                <h2 className="text-[16px] font-extrabold text-slate-900 dark:text-slate-100">Sales Billing</h2>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800">
                                    Summary & History
                                </span>
                            </div>
                        </div>

                        {/* Stock Valuation Card */}
                        <Card className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-4 shadow-2xs rounded-2xl flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Stock Valuation</span>
                                <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                                    {isLoadingStock ? (
                                        <span className="animate-pulse">Loading...</span>
                                    ) : formatNepaliCurrency(totalStockValuation)}
                                </span>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                <Layers className="h-5 w-5" />
                            </div>
                        </Card>

                        {/* Latest Sales Billing by Day wise Sub-section */}
                        <div className="space-y-2.5 pt-1">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Latest Sales Billing by Day wise</h3>
                            {isLoadingSalesBills || isLoadingCompanies ? (
                                <div className="flex items-center gap-2 py-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                                    <p className="text-xs text-slate-500 font-medium">Loading daily sales history...</p>
                                </div>
                            ) : last7DaysSalesHistory.length === 0 ? (
                                <p className="text-xs text-slate-500 italic bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800">No sales billing records available for the last 7 days.</p>
                            ) : (
                                <Card className="overflow-hidden border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs rounded-2xl">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50 dark:bg-zinc-800/60">
                                                <TableRow>
                                                    <TableHead className="w-12 text-xs font-bold">S.N</TableHead>
                                                    <TableHead className="text-xs font-bold">Date</TableHead>
                                                    <TableHead className="text-xs font-bold">Company Name</TableHead>
                                                    <TableHead className="text-center w-28 text-xs font-bold">Bills</TableHead>
                                                    <TableHead className="text-right w-36 pr-4 text-xs font-bold">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {displayedDailySales.map((row, index) => {
                                                    const serialNo = index + 1
                                                    return (
                                                        <TableRow key={`${row.dateStr}-${row.companyId}`} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40">
                                                            <TableCell className="text-slate-500 font-medium text-[12px] py-2">{serialNo}</TableCell>
                                                            <TableCell className="py-2">
                                                                <div className="font-bold text-slate-900 dark:text-slate-100 text-[12px] flex items-center gap-1.5">
                                                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                                    {row.formattedDate}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-slate-700 dark:text-slate-300 font-semibold text-[12px] py-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Building className="h-3.5 w-3.5 text-slate-400" />
                                                                    {row.companyName}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center font-medium text-slate-600 dark:text-slate-400 text-[12px] py-2">
                                                                {row.billCount} {row.billCount === 1 ? 'bill' : 'bills'}
                                                            </TableCell>
                                                            <TableCell className="text-right font-black text-blue-600 dark:text-blue-400 text-[12px] pr-4 py-2">
                                                                {formatNepaliCurrency(row.billingAmount)}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </Card>
                            )}
                            {last7DaysSalesHistory.length > 3 && (
                                <div className="flex justify-center pt-1">
                                    {showAllDailySales ? (
                                        <Button
                                            onClick={() => setShowAllDailySales(false)}
                                            variant="outline"
                                            size="sm"
                                            className="px-4 py-1.5 text-xs font-bold border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-900 rounded-xl shadow-2xs flex items-center gap-1.5"
                                        >
                                            View Less
                                            <ChevronUp size={12} />
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => setShowAllDailySales(true)}
                                            variant="outline"
                                            size="sm"
                                            className="px-4 py-1.5 text-xs font-bold border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-900 rounded-xl shadow-2xs flex items-center gap-1.5"
                                        >
                                            View More ({last7DaysSalesHistory.length - 3} more)
                                            <ChevronDown size={12} />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sales History Sub-section */}
                        <div className="space-y-2.5 pt-1">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recent Sales Billing History</h3>
                            {isLoadingSalesBills || isLoadingCompanies ? (
                                <div className="flex items-center gap-2 py-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                                    <p className="text-xs text-slate-500 font-medium">Loading sales history...</p>
                                </div>
                            ) : last4WeeksSalesHistory.length === 0 ? (
                                <p className="text-xs text-slate-500 italic bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800">No sales billing records available for the last 4 weeks.</p>
                            ) : (
                                <Card className="overflow-hidden border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs rounded-2xl">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50 dark:bg-zinc-800/60">
                                                <TableRow>
                                                    <TableHead className="w-12 text-xs font-bold">S.N</TableHead>
                                                    <TableHead className="text-xs font-bold">Date Period</TableHead>
                                                    <TableHead className="text-xs font-bold">Company Name</TableHead>
                                                    <TableHead className="text-center w-28 text-xs font-bold">Bills</TableHead>
                                                    <TableHead className="text-right w-36 pr-4 text-xs font-bold">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {displayedSalesHistory.map((row, index) => {
                                                    const serialNo = index + 1
                                                    return (
                                                        <TableRow key={`${row.startDateStr}-${row.companyId}`} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40">
                                                            <TableCell className="text-slate-500 font-medium text-[12px] py-2">{serialNo}</TableCell>
                                                            <TableCell className="py-2">
                                                                <div className="font-bold text-slate-900 dark:text-slate-100 text-[12px] flex items-center gap-1.5">
                                                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                                    {row.weekLabel}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-slate-700 dark:text-slate-300 font-semibold text-[12px] py-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Building className="h-3.5 w-3.5 text-slate-400" />
                                                                    {row.companyName}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center font-medium text-slate-600 dark:text-slate-400 text-[12px] py-2">
                                                                {row.billCount} {row.billCount === 1 ? 'bill' : 'bills'}
                                                            </TableCell>
                                                            <TableCell className="text-right font-black text-blue-600 dark:text-blue-400 text-[12px] pr-4 py-2">
                                                                {formatNepaliCurrency(row.billingAmount)}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </Card>
                            )}
                            {!showAllSalesHistory && last4Weeks.length > 2 && last4WeeksSalesHistory.length > 0 && (
                                <div className="flex justify-center pt-1">
                                    <Button
                                        onClick={() => setShowAllSalesHistory(true)}
                                        variant="outline"
                                        size="sm"
                                        className="px-4 py-1.5 text-xs font-bold border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-900 rounded-xl shadow-2xs flex items-center gap-1.5"
                                    >
                                        View More
                                        <ArrowRight size={12} />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Modals */}
            <AddPanVatCompanyModal
                isOpen={isAddCompanyModalOpen}
                onClose={() => setIsAddCompanyModalOpen(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['pan-vat-companies'] })
                    queryClient.invalidateQueries({ queryKey: ['company-details'] })
                }}
            />

            {isAddBillModalOpen && (
                <AddPanVatBillModal
                    onClose={() => {
                        setIsAddBillModalOpen(false)
                        queryClient.invalidateQueries({ queryKey: ['pan-vat-bills'] })
                    }}
                />
            )}

            {isAddSalesBillModalOpen && (
                <AddSalesBillModal
                    onClose={() => {
                        setIsAddSalesBillModalOpen(false)
                        queryClient.invalidateQueries({ queryKey: ['sales-bills'] })
                    }}
                />
            )}
        </div>
    )
}
