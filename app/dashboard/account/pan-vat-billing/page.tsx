'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, ShoppingBag, ShoppingCart, FileText, Plus, Building, Calendar, Wallet, Layers, ArrowRight, Edit, Info, RefreshCw, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { Card, Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui-shim'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getPanVatBills } from '@/features/account/actions/pan-vat-bill-actions'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { AddPanVatCompanyModal } from '@/features/account/components/AddPanVatCompanyModal'
import { AddPanVatBillModal } from '@/features/account/components/AddPanVatBillModal'
import { getDarazWeeklyTransactions, saveDarazWeeklyTransaction, getWeeklyEstimatedSales } from '@/features/account/actions/daraz-transaction-actions'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { toast } from 'sonner'

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
    const { data: onlineStores = [], isLoading: isLoadingStores } = useOnlineStores()

    // Estimates state for current week
    const [currentWeekEstimates, setCurrentWeekEstimates] = useState<Record<string, number>>({})
    const [loadingCurrentWeekEstimates, setLoadingCurrentWeekEstimates] = useState(false)

    // Last 4 weeks history expansion state
    const [showAllHistory, setShowAllHistory] = useState(false)

    // Sales Billing Section states
    const [isAddSalesBillModalOpen, setIsAddSalesBillModalOpen] = useState(false)
    const [showAllSalesHistory, setShowAllSalesHistory] = useState(false)
    const [showAllDailySales, setShowAllDailySales] = useState(false)

    // Fetch saved settlements/transactions for selected Fiscal Year
    const { data: savedTransactions = [], isLoading: isLoadingTransactions } = useQuery({
        queryKey: ['daraz-weekly-transactions', fiscalYearId],
        queryFn: () => getDarazWeeklyTransactions(fiscalYearId !== 'all' ? fiscalYearId : undefined),
        enabled: !!fiscalYearId,
        staleTime: 1000 * 60 * 2,
    })

    // Edit modal state
    const [editingRow, setEditingRow] = useState<any | null>(null)
    const [isViewMode, setIsViewMode] = useState(false)
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

    // Generate combined list of current week's transactions
    const currentWeekTransactions = useMemo(() => {
        if (!currentWeek || onlineStores.length === 0) return []
        
        return onlineStores.map(store => {
            const saved = savedTransactions.find(t => 
                t.start_date === currentWeek.startDateStr && 
                t.end_date === currentWeek.endDateStr && 
                t.seller_account === store.seller_account
            )
            
            return {
                weekLabel: currentWeek.label,
                startDateStr: currentWeek.startDateStr,
                endDateStr: currentWeek.endDateStr,
                sellerAccount: store.seller_account,
                companyName: store.company_name,
                fiscalYearId: selectedFiscalYear?.id,
                savedTransaction: saved
            }
        })
    }, [currentWeek, onlineStores, savedTransactions, selectedFiscalYear])

    // Fetch estimated sales dynamically for the current week for all stores
    useEffect(() => {
        if (!currentWeek || onlineStores.length === 0) return
        
        setLoadingCurrentWeekEstimates(true)
        const promises = onlineStores.map(store => 
            getWeeklyEstimatedSales(currentWeek.startDateStr, currentWeek.endDateStr, store.seller_account)
                .then(amount => ({ sellerAccount: store.seller_account, amount }))
                .catch(() => ({ sellerAccount: store.seller_account, amount: 0 }))
        )
        
        Promise.all(promises).then(results => {
            const map: Record<string, number> = {}
            results.forEach(r => {
                map[r.sellerAccount] = r.amount
            })
            setCurrentWeekEstimates(map)
            setLoadingCurrentWeekEstimates(false)
        })
    }, [currentWeek, onlineStores])

    // Get last 4 weeks
    const last4Weeks = useMemo(() => {
        if (!currentWeek) return []
        const idx = weeks.findIndex(w => w.startDateStr === currentWeek.startDateStr)
        if (idx === -1) return []
        return weeks.slice(idx + 1, idx + 5)
    }, [weeks, currentWeek])

    // Generate combined list of last 4 weeks' transactions
    const last4WeeksTransactions = useMemo(() => {
        if (last4Weeks.length === 0 || onlineStores.length === 0) return []
        
        const rows: any[] = []
        last4Weeks.forEach(week => {
            onlineStores.forEach(store => {
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
    }, [last4Weeks, onlineStores, savedTransactions, selectedFiscalYear])

    // Filter displayed history: if showAllHistory is false, show only the first week's rows
    const displayedHistoryTransactions = useMemo(() => {
        if (showAllHistory || last4WeeksTransactions.length === 0) {
            return last4WeeksTransactions
        }
        if (last4Weeks.length === 0) return []
        const firstWeek = last4Weeks[0]
        return last4WeeksTransactions.filter(row => row.startDateStr === firstWeek.startDateStr)
    }, [showAllHistory, last4WeeksTransactions, last4Weeks])

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
            name: 'Report',
            href: '/dashboard/account/pan-vat-billing/report',
            icon: FileText,
            color: 'bg-violet-600 dark:bg-violet-500',
            description: 'Comprehensive tax and VAT transaction reports'
        },
        {
            name: 'Daraz Transaction',
            href: '/dashboard/account/pan-vat-billing/daraz-transaction',
            icon: Wallet,
            color: 'bg-orange-600 dark:bg-orange-500',
            description: 'Weekly Daraz settlement amounts, commission fees and vouchers'
        },
    ]

    const isLoading = isLoadingCompanies || isLoadingBills

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950 space-y-5 pb-8 overflow-y-auto">
            {/* Top Bar with Fiscal Year */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-sm sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/account"
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hidden md:block"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Pan/Vat Billing</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Manage tax, purchase and sales invoices</p>
                    </div>
                </div>

                {/* Fiscal Year Filter */}
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Fiscal Year:</span>
                    <select
                        value={fiscalYearId}
                        onChange={(e) => setFiscalYearId(e.target.value)}
                        className="min-w-[150px] px-3 py-1.5 text-[13px] font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
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

            {/* Quick Navigation Modules Grid */}
            <div className="px-4 md:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {billingModules.map((module) => {
                        const Icon = module.icon
                        return (
                            <Link key={module.name} href={module.href} className="group">
                                <Card className="p-4 hover:shadow-md border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 transition-all duration-300 cursor-pointer h-full flex items-start gap-4">
                                    <div className={`${module.color} p-3 rounded-xl shadow-md text-white shrink-0 group-hover:scale-110 transition-transform`}>
                                        <Icon size={20} />
                                    </div>
                                    <div className="space-y-1 pr-6 relative w-full">
                                        <h3 className="font-bold text-[15px] text-gray-900 dark:text-gray-100">{module.name}</h3>
                                        <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-normal">{module.description}</p>
                                        <ArrowRight size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Purchase Billing Section */}
            <div className="px-4 md:px-6 space-y-4">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-zinc-800 pb-3 gap-3">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                        <h2 className="text-[17px] font-bold text-gray-800 dark:text-gray-100">Purchase Billing</h2>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {selectedFiscalYear ? selectedFiscalYear.name : 'All Years'}
                        </span>
                    </div>

                    {/* Action Shortcuts */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsAddBillModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
                        >
                            <Plus size={14} />
                            Add Bill
                        </button>
                        <button
                            onClick={() => setIsAddCompanyModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm transition-colors"
                        >
                            <Plus size={14} />
                            Add Company
                        </button>
                    </div>
                </div>

                {/* Company Cards Grid */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        <p className="text-sm text-gray-500">Loading purchase summaries...</p>
                    </div>
                ) : activeCompanies.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 border border-dashed border-gray-300 dark:border-zinc-800 rounded-2xl p-8 text-center max-w-lg mx-auto">
                        <Building className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-200">No Active Purchases</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                            No company details have recorded purchases or bills in the selected fiscal year {selectedFiscalYear ? `(${selectedFiscalYear.name})` : ''}.
                        </p>
                        <button
                            onClick={() => setIsAddBillModalOpen(true)}
                            className="mt-4 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-colors inline-flex items-center gap-1.5"
                        >
                            <Plus size={14} />
                            Create First Purchase Bill
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeCompanies.map((company) => (
                            <Card
                                key={company.id}
                                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/80 hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col justify-between overflow-hidden"
                            >
                                <div className="p-4 space-y-3">
                                    {/* Company Name Header */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 shrink-0">
                                            <Building className="h-4.5 w-4.5" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <h3 className="font-extrabold text-[15px] text-gray-900 dark:text-gray-100 line-clamp-1">
                                                {company.company_name}
                                            </h3>
                                            {company.pan_vat_details && (
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                    PAN/VAT: <span className="font-semibold">{company.pan_vat_details}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Address */}
                                    {company.address && (
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 border-t dark:border-zinc-800 pt-2">
                                            {company.address}
                                        </p>
                                    )}
                                </div>

                                {/* Financial Details Block */}
                                <div className="bg-blue-50/50 dark:bg-blue-950/20 border-t border-gray-100 dark:border-zinc-800 p-4 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                                            Total Purchases
                                        </span>
                                        <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                                            {formatNepaliCurrency(company.totalPurchaseAmount)}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                                            Total Bills
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full mt-0.5">
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

            {/* Daraz Transaction Section */}
            <div className="px-4 md:px-6 space-y-4 border-t dark:border-zinc-800 pt-6">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-zinc-800 pb-3 gap-3">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                        <h2 className="text-[17px] font-bold text-gray-800 dark:text-gray-100">Daraz Transaction</h2>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                            Current & History
                        </span>
                    </div>
                    <Link
                        href="/dashboard/account/pan-vat-billing/daraz-transaction"
                        className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 hover:underline"
                    >
                        View All Settlements
                        <ArrowRight size={14} />
                    </Link>
                </div>

                {/* Sub-section: Current Week */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Week Settlements</h3>
                    {isLoadingStores || isLoadingTransactions ? (
                        <div className="flex items-center gap-2 py-4">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                            <p className="text-xs text-gray-500">Loading current week...</p>
                        </div>
                    ) : currentWeekTransactions.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No registered online stores or current week is outside the selected fiscal year.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {currentWeekTransactions.map((row) => {
                                const t = row.savedTransaction
                                return (
                                    <Card
                                        key={row.sellerAccount}
                                        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-4 hover:shadow-md transition-all flex flex-col justify-between"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${getSellerColor(row.sellerAccount)}`}>
                                                    {row.sellerAccount}
                                                </span>
                                                {t ? (
                                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                                                        Saved
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-400">
                                                        Pending
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-sm text-gray-900 dark:text-gray-100">{row.companyName}</h4>
                                                <p className="text-[11px] text-gray-500 mt-0.5">{row.weekLabel}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 border-t dark:border-zinc-800 pt-2">
                                                <div>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Estimated</span>
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                        {t ? formatNepaliCurrency(t.estimated_sales_amount) : (
                                                            loadingCurrentWeekEstimates ? (
                                                                <span className="animate-pulse">Syncing...</span>
                                                            ) : formatNepaliCurrency(currentWeekEstimates[row.sellerAccount] || 0)
                                                        )}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Actual Sales</span>
                                                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                                                        {t ? formatNepaliCurrency(t.sales_amount) : 'Rs. 0.00'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleEdit(row, false)}
                                            className="mt-4 w-full py-1.5 text-center text-xs font-bold bg-gray-50 hover:bg-orange-50 hover:text-orange-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300 border dark:border-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Edit size={12} />
                                            Edit Settlement
                                        </button>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Sub-section: Last 4 Weeks History */}
                <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last 4 Weeks History</h3>
                    {isLoadingStores || isLoadingTransactions ? (
                        <div className="flex items-center gap-2 py-4">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                            <p className="text-xs text-gray-500">Loading history...</p>
                        </div>
                    ) : last4WeeksTransactions.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No historical records available for the last 4 weeks.</p>
                    ) : (
                        <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
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
                                        {displayedHistoryTransactions.map((row, index) => {
                                            const t = row.savedTransaction
                                            const commFees = t ? (
                                                (t.cofunded_voucher_max || 0) +
                                                (t.payment_fee || 0) +
                                                (t.daraz_coins_discount_participation_fee || 0) +
                                                (t.free_shipping_max_fee || 0) +
                                                (t.commission_fee || 0) +
                                                (t.handling_fee || 0)
                                            ) : 0
                                            return (
                                                <TableRow key={`${row.startDateStr}-${row.sellerAccount}`} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                                                    <TableCell className="text-gray-500 font-medium text-xs">{index + 1}</TableCell>
                                                    <TableCell className="py-2.5">
                                                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{row.weekLabel}</div>
                                                        <div className="mt-1">
                                                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${getSellerColor(row.sellerAccount)}`}>
                                                                {row.sellerAccount}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-gray-600 dark:text-gray-400 font-medium text-xs">{row.companyName}</TableCell>
                                                    <TableCell className="text-right font-bold text-gray-900 dark:text-gray-100 text-xs">
                                                        {t ? (
                                                            <div className="space-y-0.5 text-right">
                                                                <div>Rs. {t.sales_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                                <div className="text-[10px] font-normal text-gray-500">
                                                                    TDS = Rs. {(t.general_sales_tax_withholding || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-red-600 dark:text-red-400 text-xs">
                                                        {t ? `Rs. ${commFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {t ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Saved
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-400">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {t && (
                                                                <button
                                                                    onClick={() => handleEdit(row, true)}
                                                                    className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-md transition-colors"
                                                                    title="View Details"
                                                                >
                                                                    <Info size={14} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleEdit(row, false)}
                                                                className="p-1 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded-md transition-colors"
                                                                title="Edit Settlement"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    )}
                    {!showAllHistory && last4Weeks.length > 1 && last4WeeksTransactions.length > 0 && (
                        <div className="flex justify-center pt-2">
                            <Button
                                onClick={() => setShowAllHistory(true)}
                                variant="outline"
                                className="px-5 py-2 text-xs font-bold border-orange-200 hover:border-orange-500 text-orange-600 hover:text-orange-700 bg-white dark:bg-zinc-900 transition-all shadow-sm hover:shadow hover:scale-[1.02] flex items-center gap-1.5"
                            >
                                Show More
                                <ArrowRight size={12} />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Sales Billing Section */}
            <div className="px-4 md:px-6 space-y-4 border-t dark:border-zinc-800 pt-6">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-zinc-800 pb-3 gap-3">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                        <h2 className="text-[17px] font-bold text-gray-800 dark:text-gray-100">Sales Billing</h2>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                            Summary & History
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsAddSalesBillModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
                        >
                            <Plus size={14} />
                            Add Sales Bill
                        </button>
                        <Link
                            href="/dashboard/account/pan-vat-billing/sales-billing"
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline ml-2"
                        >
                            View Sales Analysis
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>

                {/* Stock Valuation Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-4 shadow-sm flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Total Stock Valuation</span>
                            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                                {isLoadingStock ? (
                                    <span className="animate-pulse">Loading...</span>
                                ) : formatNepaliCurrency(totalStockValuation)}
                            </span>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl">
                            <Layers className="h-5 w-5" />
                        </div>
                    </Card>
                </div>

                {/* Latest Sales Billing by Day wise Sub-section */}
                <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Latest Sales Billing by Day wise</h3>
                    {isLoadingSalesBills || isLoadingCompanies ? (
                        <div className="flex items-center gap-2 py-4">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                            <p className="text-xs text-gray-500">Loading daily sales history...</p>
                        </div>
                    ) : last7DaysSalesHistory.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No sales billing records available for the last 7 days.</p>
                    ) : (
                        <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-gray-50 dark:bg-zinc-800/50">
                                        <TableRow>
                                            <TableHead className="w-16">S.N</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Company Name</TableHead>
                                            <TableHead className="text-center w-32">Sales Bill Count</TableHead>
                                            <TableHead className="text-right w-44 pr-6">Billing Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedDailySales.map((row, index) => {
                                            const serialNo = index + 1
                                            return (
                                                <TableRow key={`${row.dateStr}-${row.companyId}`} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                                                    <TableCell className="text-gray-500 font-medium text-xs">{serialNo}</TableCell>
                                                    <TableCell className="py-2.5">
                                                        <div className="font-bold text-gray-900 dark:text-gray-100 text-xs flex items-center gap-1.5">
                                                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                            {row.formattedDate}
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
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    )}
                    {last7DaysSalesHistory.length > 0 && (
                        <div className="flex justify-center pt-2">
                            {showAllDailySales ? (
                                <Button
                                    onClick={() => setShowAllDailySales(false)}
                                    variant="outline"
                                    className="px-5 py-2 text-xs font-bold border-emerald-200 hover:border-emerald-500 text-emerald-600 hover:text-emerald-700 bg-white dark:bg-zinc-900 transition-all shadow-sm hover:shadow hover:scale-[1.02] flex items-center gap-1.5"
                                >
                                    View Less
                                    <ChevronUp size={12} />
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => setShowAllDailySales(true)}
                                    variant="outline"
                                    className="px-5 py-2 text-xs font-bold border-emerald-200 hover:border-emerald-500 text-emerald-600 hover:text-emerald-700 bg-white dark:bg-zinc-900 transition-all shadow-sm hover:shadow hover:scale-[1.02] flex items-center gap-1.5"
                                >
                                    View More
                                    <ChevronDown size={12} />
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Sales History Sub-section */}
                <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Sales Billing History</h3>
                    {isLoadingSalesBills || isLoadingCompanies ? (
                        <div className="flex items-center gap-2 py-4">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                            <p className="text-xs text-gray-500">Loading sales history...</p>
                        </div>
                    ) : last4WeeksSalesHistory.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No sales billing records available for the last 4 weeks.</p>
                    ) : (
                        <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
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
                                        {displayedSalesHistory.map((row, index) => {
                                            const serialNo = index + 1
                                            return (
                                                <TableRow key={`${row.startDateStr}-${row.companyId}`} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                                                    <TableCell className="text-gray-500 font-medium text-xs">{serialNo}</TableCell>
                                                    <TableCell className="py-2.5">
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
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    )}
                    {!showAllSalesHistory && last4Weeks.length > 2 && last4WeeksSalesHistory.length > 0 && (
                        <div className="flex justify-center pt-2">
                            <Button
                                onClick={() => setShowAllSalesHistory(true)}
                                variant="outline"
                                className="px-5 py-2 text-xs font-bold border-emerald-200 hover:border-emerald-500 text-emerald-600 hover:text-emerald-700 bg-white dark:bg-zinc-900 transition-all shadow-sm hover:shadow hover:scale-[1.02] flex items-center gap-1.5"
                            >
                                View More
                                <ArrowRight size={12} />
                            </Button>
                        </div>
                    )}
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

            {/* Edit Dialog Modal for Daraz Transactions */}
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
