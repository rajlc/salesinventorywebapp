'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    ArrowLeft,
    Calendar,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Building,
    RefreshCw,
    AlertCircle,
    ShoppingBag,
    ShoppingCart,
    Store,
    FileText,
    Receipt,
    Layers
} from 'lucide-react'
import Link from 'next/link'
import { Card, Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter, Button } from '@/components/ui-shim'
import { useQuery } from '@tanstack/react-query'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getPanVatBills } from '@/features/account/actions/pan-vat-bill-actions'
import { getSalesBills } from '@/features/sales/actions/sales-bill-actions'
import { getDailyDarazReportData } from '@/features/account/actions/daraz-transaction-actions'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { getStatementBreakdown } from '../daraz-finance-card'
import { fetchDarazPayoutStatus } from '@/features/sales/actions/daraz-finance-service'

export default function PanVatReportPage() {
    // Top Level Mode: 'all-report' or 'pan-vat'
    const [mainReportMode, setMainReportMode] = useState<'all-report' | 'pan-vat'>('all-report')

    // Sub-tabs under 'All Report': 'daraz', 'sales', 'purchase'
    const [allReportSubTab, setAllReportSubTab] = useState<'daraz' | 'sales' | 'purchase'>('daraz')

    // Sub-tabs under 'Pan/Vat Transaction Report': 'daily', 'weekly'
    const [activeSubTab, setActiveSubTab] = useState<'daily' | 'weekly'>('daily')

    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [startDate, setStartDate] = useState<string>('')
    const [endDate, setEndDate] = useState<string>('')
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all')
    const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all')

    const [currentPage, setCurrentPage] = useState(1)
    const [darazTaxPage, setDarazTaxPage] = useState(1)

    const itemsPerPage = 50

    // Fetch Fiscal Years & Active Fiscal Year
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Default to active / running fiscal year on mount
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

    // Reset pages when filters change
    useEffect(() => {
        setCurrentPage(1)
        setDarazTaxPage(1)
    }, [fiscalYearId, startDate, endDate, selectedCompanyId, selectedStoreFilter])

    // Fetch Companies
    const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails
    })

    // Fetch Online Stores
    const { data: onlineStores = [], isLoading: isLoadingStores } = useOnlineStores()

    // Fetch Purchase Bills
    const { data: purchaseBills = [], isLoading: isLoadingPurchases } = useQuery({
        queryKey: ['pan-vat-bills', fiscalYearId, startDate, endDate],
        queryFn: () => getPanVatBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
        }),
    })

    // Fetch Sales Bills
    const { data: salesBills = [], isLoading: isLoadingSales } = useQuery({
        queryKey: ['sales-bills', fiscalYearId, startDate, endDate],
        queryFn: () => getSalesBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
        }),
    })

    // Fetch Daily Daraz Report Data
    const { data: darazDailyData = [], isLoading: isLoadingDaraz } = useQuery({
        queryKey: ['daily-daraz-report-data', startDate, endDate],
        queryFn: () => {
            if (!startDate || !endDate) return []
            return getDailyDarazReportData(startDate, endDate)
        },
        enabled: !!startDate && !!endDate
    })

    // Fetch Daraz Payout Status Statements Per Store
    const { data: payoutData = [] } = useQuery({
        queryKey: ['daraz-payout-status-report-page'],
        queryFn: () => fetchDarazPayoutStatus(),
        staleTime: 0
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

    // List of available online stores for top filter
    const availableStoresList = useMemo(() => {
        const set = new Set<string>()
        onlineStores.forEach((s: any) => {
            const storeName = s.seller_account || s.name
            if (storeName && storeName !== 'All') {
                set.add(storeName)
            }
        })
        if (set.size === 0) {
            ;['BTAS', 'Bagmati Traders', 'Balaju Shop', 'Cosmetic Shop'].forEach(st => set.add(st))
        }
        return Array.from(set)
    }, [onlineStores])

    // Distinct color badge style per store
    const getStoreBadgeStyle = (storeName: string) => {
        const s = (storeName || '').toLowerCase()
        if (s.includes('btas') && !s.includes('cosmetic')) {
            return 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-700'
        }
        if (s.includes('bagmati')) {
            return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700'
        }
        if (s.includes('balaju')) {
            return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700'
        }
        if (s.includes('cosmetic')) {
            return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700'
        }
        return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-700'
    }

    // Date formatter helper
    const formatDateStr = (dateStr: string) => {
        if (!dateStr) return '-'
        const [y, m, d] = dateStr.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
    }

    // Daily Aggregation Logic for Pan/Vat Transaction Report
    const dailyReportData = useMemo(() => {
        const map: Record<string, Record<string, { darazRevenue: number; darazCommissionFees: number; darazShipped: number; salesAmount: number; purchaseAmount: number }>> = {}

        const getOrCreateEntry = (date: string, company: string) => {
            if (!map[date]) {
                map[date] = {}
            }
            if (!map[date][company]) {
                map[date][company] = { darazRevenue: 0, darazCommissionFees: 0, darazShipped: 0, salesAmount: 0, purchaseAmount: 0 }
            }
            return map[date][company]
        }

        // Process Daraz Daily Data
        darazDailyData.forEach((row: any) => {
            const date = row.date
            if (!date) return
            const company = sellerToCompanyMap[row.sellerAccount] || row.sellerAccount || 'Bagmati Traders'
            const entry = getOrCreateEntry(date, company)
            entry.darazRevenue += row.revenue || 0
            entry.darazCommissionFees += row.commissionFees || 0
            entry.darazShipped += row.shippedAmount || 0
        })

        // Process Sales Bills
        salesBills.forEach((bill: any) => {
            const date = bill.bill_date_ad
            if (!date) return
            const company = companyMap[bill.seller_company_id || ''] || 'Bagmati Traders'
            const entry = getOrCreateEntry(date, company)
            entry.salesAmount += bill.total_amount || 0
        })

        // Process Purchase Bills
        purchaseBills.forEach((bill: any) => {
            const date = bill.issue_bill_date_ad
            if (!date) return
            const company = companyMap[bill.buyer_company_id || ''] || bill.buyer_company_name || 'Bagmati Traders'
            const entry = getOrCreateEntry(date, company)
            entry.purchaseAmount += bill.total_amount || 0
        })

        const rows: Array<{
            date: string
            companyName: string
            darazRevenue: number
            darazCommissionFees: number
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
                    darazCommissionFees: data.darazCommissionFees,
                    darazShipped: data.darazShipped,
                    salesAmount: data.salesAmount,
                    purchaseAmount: data.purchaseAmount
                })
            })
        })

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

    // Aggregate overall totals for Pan/Vat report
    const overallTotals = useMemo(() => {
        let totalDarazRevenue = 0
        let totalDarazCommissionFees = 0
        let totalDarazShipped = 0
        let totalSales = 0
        let totalPurchase = 0

        filteredReportData.forEach(row => {
            totalDarazRevenue += row.darazRevenue
            totalDarazCommissionFees += row.darazCommissionFees
            totalDarazShipped += row.darazShipped
            totalSales += row.salesAmount
            totalPurchase += row.purchaseAmount
        })

        return { totalDarazRevenue, totalDarazCommissionFees, totalDarazShipped, totalSales, totalPurchase }
    }, [filteredReportData])

    // Paginated Rows for Pan/Vat report
    const paginatedRows = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        return filteredReportData.slice(startIndex, startIndex + itemsPerPage)
    }, [filteredReportData, currentPage])

    const totalPages = Math.ceil(filteredReportData.length / itemsPerPage)

    // Generate Daraz Tax Invoices list for "All Report" -> "Daraz"
    const darazTaxInvoices = useMemo(() => {
        if (!payoutData || payoutData.length === 0) return []

        const rows: Array<{
            id: string
            datePeriod: string
            storeName: string
            companyName: string
            description: string
            taxableAmt: number
            vatAmt: number
            grandTotal: number
        }> = []

        let idxCounter = 1

        payoutData.forEach((item: any) => {
            const periodStr = item.created_at || item.statement || '10 Aug 2026 - 16 Aug 2026'
            const rawStore = item.store_name || item.seller_account
            const storeLabel = (rawStore && rawStore !== 'All')
                ? rawStore
                : (item.statement_number ? item.statement_number.split('-')[0] : 'Bagmati Traders')

            const companyName = item.company_name || 'Bagmati Traders'

            // Check if periodStr falls within [startDate, endDate] of selected Fiscal Year
            if (startDate && endDate) {
                const parts = periodStr.split(' - ')
                if (parts.length === 2) {
                    const periodStart = new Date(parts[0].trim())
                    const periodEnd = new Date(parts[1].trim())
                    const fStart = new Date(startDate)
                    const fEnd = new Date(endDate)
                    fEnd.setHours(23, 59, 59, 999)

                    // Skip statement periods where period start date is before Fiscal Year start date or period end is after Fiscal Year end date
                    if (periodStart < fStart || periodEnd > fEnd) {
                        return
                    }
                }
            }

            // Filter by selected company
            if (selectedCompanyId !== 'all') {
                const selectedComp = companies.find((c: any) => c.id === selectedCompanyId)
                if (selectedComp && selectedComp.company_name.toLowerCase() !== companyName.toLowerCase()) {
                    return
                }
            }

            // Filter by selected store
            if (selectedStoreFilter !== 'all') {
                if (storeLabel.toLowerCase() !== selectedStoreFilter.toLowerCase()) {
                    return
                }
            }

            const b = getStatementBreakdown(item)

            const taxItems = [
                {
                    desc: 'Tax Invoice - Co Funded Voucher Max',
                    net: Math.abs(b.coFundedVoucher) - Math.abs(b.voucherReversal)
                },
                {
                    desc: 'Tax Invoice - Payment Fee',
                    net: Math.abs(b.paymentFee) - Math.abs(b.paymentFeeRefunded)
                },
                {
                    desc: 'Tax Invoice - Commission Fee',
                    net: Math.abs(b.commissionFee) - Math.abs(b.commissionRefunded)
                },
                {
                    desc: 'Tax Invoice - Free Shipping Max Fee',
                    net: Math.abs(b.freeShippingMaxFee) - Math.abs(b.freeShipRefunded)
                },
                {
                    desc: 'Tax Invoice - Daraz Coins Discount Participation Fee',
                    net: Math.abs(b.coinsFee) - Math.abs(b.coinsFeeRefunded)
                },
                {
                    desc: 'Tax Invoice - Merchant Managed Services Charge',
                    net: Math.abs(b.merchantCharge)
                },
                {
                    desc: 'Tax Invoice - Handling Fee & Return Handling Fee',
                    net: Math.abs(b.handlingFee) + Math.abs(b.returnHandlingFee)
                }
            ]

            taxItems.forEach((tItem) => {
                const taxableAmt = Math.round((tItem.net / 1.13) * 100) / 100
                const vatAmt = Math.round((taxableAmt * 0.13) * 100) / 100
                const grandTotal = Math.round((taxableAmt + vatAmt) * 100) / 100

                rows.push({
                    id: `daraz-tax-${idxCounter++}`,
                    datePeriod: periodStr,
                    storeName: storeLabel,
                    companyName,
                    description: tItem.desc,
                    taxableAmt,
                    vatAmt,
                    grandTotal
                })
            })
        })

        return rows
    }, [payoutData, selectedCompanyId, companies, startDate, endDate, selectedStoreFilter])

    // Paginated Daraz Tax Invoices
    const paginatedDarazTax = useMemo(() => {
        const start = (darazTaxPage - 1) * itemsPerPage
        return darazTaxInvoices.slice(start, start + itemsPerPage)
    }, [darazTaxInvoices, darazTaxPage])

    const totalDarazTaxPages = Math.ceil(darazTaxInvoices.length / itemsPerPage)

    // Totals for Daraz Tax Invoices
    const darazTaxTotals = useMemo(() => {
        let taxable = 0
        let vat = 0
        let grand = 0

        darazTaxInvoices.forEach(row => {
            taxable += row.taxableAmt
            vat += row.vatAmt
            grand += row.grandTotal
        })

        return { taxable, vat, grand }
    }, [darazTaxInvoices])

    // Sales Tax Invoices for All Report -> Sales
    const salesTaxInvoices = useMemo(() => {
        return salesBills.map((bill: any, idx: number) => {
            const total = bill.total_amount || 0
            const taxable = Math.round((total / 1.13) * 100) / 100
            const vat = Math.round((taxable * 0.13) * 100) / 100
            const company = companyMap[bill.seller_company_id || ''] || 'Bagmati Traders'

            return {
                id: bill.id || `sales-${idx}`,
                date: bill.bill_date_ad || '2026-08-14',
                refNo: bill.bill_number || `INV-${1000 + idx}`,
                companyName: company,
                taxableAmt: taxable,
                vatAmt: vat,
                grandTotal: total
            }
        })
    }, [salesBills, companyMap])

    // Purchase Tax Invoices for All Report -> Purchase
    const purchaseTaxInvoices = useMemo(() => {
        return purchaseBills.map((bill: any, idx: number) => {
            const total = bill.total_amount || 0
            const taxable = Math.round((total / 1.13) * 100) / 100
            const vat = Math.round((taxable * 0.13) * 100) / 100
            const company = companyMap[bill.buyer_company_id || ''] || bill.buyer_company_name || 'Bagmati Traders'

            return {
                id: bill.id || `pur-${idx}`,
                date: bill.issue_bill_date_ad || '2026-08-14',
                refNo: bill.bill_number || bill.invoice_number || `PUR-${2000 + idx}`,
                companyName: company,
                supplierName: bill.supplier_name || 'Supplier',
                taxableAmt: taxable,
                vatAmt: vat,
                grandTotal: total
            }
        })
    }, [purchaseBills, companyMap])

    const isLoading = isLoadingCompanies || isLoadingStores || isLoadingPurchases || isLoadingSales || isLoadingDaraz

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 space-y-5 pb-8 overflow-y-auto font-['Inter',sans-serif] antialiased">
            {/* Embed Google Font Inter */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

            {/* Header Bar */}
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 px-6 py-3.5 shadow-2xs sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/account/pan-vat-billing"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all text-slate-600 dark:text-slate-400"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5 font-['Inter',sans-serif]">
                            <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-500" />
                            PAN/VAT Transaction Report
                        </h1>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 font-['Inter',sans-serif]">Aggregated billing statements & tax invoice confirmations</p>
                    </div>
                </div>

                {/* Primary Mode Buttons: 'All Report' & 'Pan/Vat Transaction Report' */}
                <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-zinc-800/90 p-1.5 rounded-xl border border-slate-200/70 dark:border-zinc-700/70">
                    <button
                        onClick={() => setMainReportMode('all-report')}
                        className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${mainReportMode === 'all-report'
                            ? 'bg-violet-600 text-white shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-white/50 dark:hover:bg-zinc-700/50'
                            }`}
                    >
                        <Layers className="h-3.5 w-3.5" />
                        All Report
                    </button>
                    <button
                        onClick={() => setMainReportMode('pan-vat')}
                        className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${mainReportMode === 'pan-vat'
                            ? 'bg-violet-600 text-white shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-white/50 dark:hover:bg-zinc-700/50'
                            }`}
                    >
                        <FileText className="h-3.5 w-3.5" />
                        Pan/Vat Transaction Report
                    </button>
                </div>
            </div>

            {/* Sub-Header Navigation Bar when 'All Report' is selected */}
            {mainReportMode === 'all-report' && (
                <div className="px-4 md:px-6">
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 font-['Inter',sans-serif]">Report Category:</span>
                        <button
                            onClick={() => setAllReportSubTab('daraz')}
                            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${allReportSubTab === 'daraz'
                                ? 'bg-orange-500 text-white shadow-xs font-bold'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200/70 dark:hover:bg-zinc-700/70'
                                }`}
                        >
                            <Store className="h-3.5 w-3.5" />
                            Daraz
                        </button>
                        <button
                            onClick={() => setAllReportSubTab('sales')}
                            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${allReportSubTab === 'sales'
                                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200/70 dark:hover:bg-zinc-700/70'
                                }`}
                        >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Sales
                        </button>
                        <button
                            onClick={() => setAllReportSubTab('purchase')}
                            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${allReportSubTab === 'purchase'
                                ? 'bg-blue-600 text-white shadow-xs font-bold'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200/70 dark:hover:bg-zinc-700/70'
                                }`}
                        >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            Purchase
                        </button>
                    </div>
                </div>
            )}

            {/* Filter Section */}
            <div className="px-4 md:px-6">
                <Card className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-2xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Fiscal Year Filter */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">Fiscal Year</label>
                            <div className="relative">
                                <select
                                    value={fiscalYearId}
                                    onChange={(e) => handleFiscalYearChange(e.target.value)}
                                    className="w-full px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
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
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">Start Date (AD)</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
                            />
                        </div>

                        {/* End Date Picker */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">End Date (AD)</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
                            />
                        </div>

                        {/* Company Filter */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">Filter by Company</label>
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                className="w-full px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
                            >
                                <option value="all">All Companies</option>
                                {companies.map((company) => (
                                    <option key={company.id} value={company.id}>
                                        {company.company_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Store Filter */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">Filter by Store</label>
                            <select
                                value={selectedStoreFilter}
                                onChange={(e) => setSelectedStoreFilter(e.target.value)}
                                className="w-full px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
                            >
                                <option value="all">All Stores</option>
                                {availableStoresList.map((storeName) => (
                                    <option key={storeName} value={storeName}>
                                        {storeName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </Card>
            </div>

            {/* CONTENT AREA 1: ALL REPORT MODE -> DARAZ SUB-TAB */}
            {mainReportMode === 'all-report' && allReportSubTab === 'daraz' && (
                <div className="px-4 md:px-6 space-y-4">
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-3.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-orange-600" />
                                Daraz Tax Invoices Confirmation Report
                            </h3>
                            <span className="text-[11px] font-semibold text-gray-500">
                                Running Fiscal Year Data
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                        <TableHead className="w-12 text-center text-[11px] font-bold uppercase tracking-wider">S.N</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Date & Store</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Description</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Taxable Amount</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Vat 13 %</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Grand Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs divide-y divide-gray-100 dark:divide-zinc-800">
                                    {paginatedDarazTax.map((row, idx) => {
                                        const globalIndex = (darazTaxPage - 1) * itemsPerPage + idx + 1
                                        return (
                                            <TableRow key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                                                <TableCell className="text-center font-medium text-gray-500 py-2.5">{globalIndex}</TableCell>
                                                <TableCell className="py-2.5">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                            {row.datePeriod}
                                                        </span>
                                                        <div>
                                                            <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getStoreBadgeStyle(row.storeName)}`}>
                                                                {row.storeName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-gray-800 dark:text-gray-200 py-2.5">
                                                    {row.description}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-gray-900 dark:text-gray-100 py-2.5">
                                                    NPR {row.taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-blue-600 dark:text-blue-400 py-2.5">
                                                    NPR {row.vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-2.5">
                                                    NPR {row.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                                <TableFooter className="bg-gray-100 dark:bg-zinc-800/90 border-t-2 border-gray-300 dark:border-zinc-700 font-extrabold text-xs">
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center font-black text-gray-900 dark:text-gray-100 py-3">
                                            Total Summary (All Tax Invoices)
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-black text-gray-900 dark:text-gray-100">
                                            NPR {darazTaxTotals.taxable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-black text-blue-700 dark:text-blue-300">
                                            NPR {darazTaxTotals.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-black text-emerald-700 dark:text-emerald-300">
                                            NPR {darazTaxTotals.grand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </Card>

                    {/* Pagination Controls for Daraz Tax Invoices */}
                    {darazTaxInvoices.length > itemsPerPage && (
                        <div className="flex items-center justify-between py-2 bg-white dark:bg-zinc-900 px-4 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                            <p className="text-xs text-gray-500">
                                Showing <span className="font-semibold">{Math.min(darazTaxInvoices.length, (darazTaxPage - 1) * itemsPerPage + 1)}</span> to{' '}
                                <span className="font-semibold">{Math.min(darazTaxInvoices.length, darazTaxPage * itemsPerPage)}</span> of{' '}
                                <span className="font-semibold">{darazTaxInvoices.length}</span> tax invoice rows
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDarazTaxPage(p => Math.max(1, p - 1))}
                                    disabled={darazTaxPage === 1}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-xs font-semibold">
                                    Page {darazTaxPage} of {totalDarazTaxPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDarazTaxPage(p => Math.min(totalDarazTaxPages, p + 1))}
                                    disabled={darazTaxPage === totalDarazTaxPages}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CONTENT AREA 2: ALL REPORT MODE -> SALES SUB-TAB */}
            {mainReportMode === 'all-report' && allReportSubTab === 'sales' && (
                <div className="px-4 md:px-6 space-y-4">
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-3.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                                Sales Tax Invoices Report
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                        <TableHead className="w-12 text-center text-[11px] font-bold uppercase tracking-wider">S.N</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Date & Invoice No</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Company Name</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Taxable Amount</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Vat 13 %</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Grand Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs divide-y divide-gray-100 dark:divide-zinc-800">
                                    {salesTaxInvoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                No Sales Billing Records Found for Running Fiscal Year
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        salesTaxInvoices.map((row, idx) => (
                                            <TableRow key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                                                <TableCell className="text-center font-medium text-gray-500 py-2.5">{idx + 1}</TableCell>
                                                <TableCell className="py-2.5 font-medium text-gray-900 dark:text-gray-100">
                                                    <div>{formatDateStr(row.date)}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">{row.refNo}</div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-gray-800 dark:text-gray-200 py-2.5">
                                                    {row.companyName}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-gray-900 dark:text-gray-100 py-2.5">
                                                    NPR {row.taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-blue-600 dark:text-blue-400 py-2.5">
                                                    NPR {row.vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-2.5">
                                                    NPR {row.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            )}

            {/* CONTENT AREA 3: ALL REPORT MODE -> PURCHASE SUB-TAB */}
            {mainReportMode === 'all-report' && allReportSubTab === 'purchase' && (
                <div className="px-4 md:px-6 space-y-4">
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-3.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4 text-blue-600" />
                                Purchase Tax Invoices Report
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                        <TableHead className="w-12 text-center text-[11px] font-bold uppercase tracking-wider">S.N</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Date & Ref No</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Company Name / Supplier</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Taxable Amount</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Vat 13 %</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Grand Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs divide-y divide-gray-100 dark:divide-zinc-800">
                                    {purchaseTaxInvoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                No Purchase Billing Records Found for Running Fiscal Year
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        purchaseTaxInvoices.map((row, idx) => (
                                            <TableRow key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                                                <TableCell className="text-center font-medium text-gray-500 py-2.5">{idx + 1}</TableCell>
                                                <TableCell className="py-2.5 font-medium text-gray-900 dark:text-gray-100">
                                                    <div>{formatDateStr(row.date)}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">{row.refNo}</div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-gray-800 dark:text-gray-200 py-2.5">
                                                    <div>{row.companyName}</div>
                                                    <div className="text-[10px] text-gray-500">{row.supplierName}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-gray-900 dark:text-gray-100 py-2.5">
                                                    NPR {row.taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-blue-600 dark:text-blue-400 py-2.5">
                                                    NPR {row.vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-2.5">
                                                    NPR {row.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            )}

            {/* CONTENT AREA 4: PAN/VAT TRANSACTION REPORT MODE */}
            {mainReportMode === 'pan-vat' && (
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
                                                <TableHead colSpan={4} className="text-center font-extrabold text-orange-600 dark:text-orange-500 border-r dark:border-zinc-800 bg-orange-50/10">
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
                                                <TableHead className="font-bold text-emerald-600 dark:text-emerald-400 text-xs text-right pr-6">Sales Amount</TableHead>
                                                <TableHead className="font-bold text-rose-600 dark:text-rose-400 text-xs border-r dark:border-zinc-800 text-right pr-6">Commission Fees</TableHead>
                                                <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs">Company Name</TableHead>
                                                <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs border-r dark:border-zinc-800 text-right pr-6">Sales Amount</TableHead>
                                                <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs">Company Name</TableHead>
                                                <TableHead className="font-bold text-gray-600 dark:text-gray-300 text-xs text-right pr-6">Purchase Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedRows.map((row, index) => {
                                                const hasDaraz = row.darazRevenue > 0 || row.darazShipped > 0 || row.darazCommissionFees > 0
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
                                                        <TableCell className={`text-right text-xs pr-6 font-extrabold ${row.darazRevenue > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                            {formatNepaliCurrency(row.darazRevenue)}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-xs pr-6 border-r dark:border-zinc-800 font-extrabold ${row.darazCommissionFees > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
                                                            {formatNepaliCurrency(row.darazCommissionFees)}
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
                                                <TableCell className="text-right text-emerald-600 dark:text-emerald-400 pr-6 font-black text-xs">
                                                    {formatNepaliCurrency(overallTotals.totalDarazRevenue)}
                                                </TableCell>
                                                <TableCell className="text-right text-rose-600 dark:text-rose-400 pr-6 border-r dark:border-zinc-800 font-black text-xs">
                                                    {formatNepaliCurrency(overallTotals.totalDarazCommissionFees)}
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
            )}
        </div>
    )
}
