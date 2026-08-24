'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
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
    Layers,
    Plus,
    CheckCircle2,
    Clock,
    Trash2,
    Copy,
    Check,
    Filter,
    X,
    Lock,
    Unlock,
    Edit3,
    ShieldCheck
} from 'lucide-react'
import Link from 'next/link'
import { Card, Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui-shim'
import { useQuery } from '@tanstack/react-query'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getPanVatBills } from '@/features/account/actions/pan-vat-bill-actions'
import { getSalesBills } from '@/features/sales/actions/sales-bill-actions'
import { getDailyDarazReportData } from '@/features/account/actions/daraz-transaction-actions'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { getStatementBreakdown, extractTaxInvoicesFromBreakdown } from '@/features/sales/utils/daraz-statement-calculator'
import { fetchDarazPayoutStatus } from '@/features/sales/actions/daraz-finance-service'
import {
    getStoredDarazTaxInvoices,
    createDarazTaxInvoice,
    saveOrUpdateDarazTaxInvoice,
    updateDarazTaxInvoiceVerification,
    deleteDarazTaxInvoice,
    syncStatementTaxInvoicesToDB,
    getLiveDarazStatementTaxMap
} from '@/features/account/actions/daraz-tax-invoice-actions'

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
    const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified'>('all')

    // Modal state for "Add Invoice"
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [copiedFollowUp, setCopiedFollowUp] = useState(false)

    // Calculate weekly period Monday - Sunday for any date
    const calculateWeeklyPeriod = (dateStr: string): string => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return ''
        const currentDayOfWeek = d.getDay()
        const diffToMon = (currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek)
        const mon = new Date(d)
        mon.setDate(d.getDate() + diffToMon)
        const sun = new Date(mon)
        sun.setDate(mon.getDate() + 6)
        try {
            return `${format(mon, 'dd MMM yyyy')} - ${format(sun, 'dd MMM yyyy')}`
        } catch {
            return ''
        }
    }

    const formatStatementPeriod = (item: any): string => {
        const raw = item.created_at || item.statement || ''
        if (!raw) return 'Weekly Period'
        if (raw.includes(' - ')) return raw

        const d = new Date(raw)
        if (isNaN(d.getTime())) return raw

        const endSun = new Date(d)
        endSun.setDate(d.getDate() - 1)
        const startMon = new Date(endSun)
        startMon.setDate(endSun.getDate() - 6)

        try {
            return `${format(startMon, 'dd MMM yyyy')} - ${format(endSun, 'dd MMM yyyy')}`
        } catch {
            return raw
        }
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const [newInvoice, setNewInvoice] = useState({
        date: todayStr,
        datePeriod: calculateWeeklyPeriod(todayStr),
        storeName: 'Bagmati Traders',
        companyName: 'Bagmati Traders',
        invoiceNumber: '',
        description: 'Tax Invoice - Commission Fee',
        taxableAmount: '',
        vatAmount: 0,
        grandTotal: 0,
        isVerified: true,
        notes: ''
    })

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
        staleTime: 1000 * 60 * 5
    })

    const statementQueryParams = useMemo(() => {
        return (payoutData || []).map((item: any) => ({
            statementNumber: item.statement_number || '',
            storeId: item.store_id,
            period: formatStatementPeriod(item),
            itemRevenue: parseFloat(String(item.item_revenue || '0').replace(/[^0-9.]/g, '')) || 0,
            storeName: item.store_name || item.seller_account
        }))
    }, [payoutData])

    // Fetch Live Statement Tax Invoices from DB Transactions / API
    const { data: liveTaxMap = {} } = useQuery({
        queryKey: ['daraz-live-tax-map', statementQueryParams],
        queryFn: () => getLiveDarazStatementTaxMap(statementQueryParams),
        staleTime: 1000 * 60 * 5,
        enabled: statementQueryParams.length > 0
    })

    // Helper to get exact tax invoices for a statement
    const getTaxItemsForStatement = (item: any, storeLabel: string) => {
        const stmtNo = (item.statement_number || '').trim().toLowerCase()
        const stmtRaw = (item.statement || item.created_at || '').trim().toLowerCase()
        const storeLower = storeLabel.trim().toLowerCase()

        const match = 
            (stmtNo && liveTaxMap[`${stmtNo}_${storeLower}`]) ||
            (stmtNo && liveTaxMap[stmtNo]) ||
            (stmtRaw && liveTaxMap[`${stmtRaw}_${storeLower}`]) ||
            (stmtRaw && liveTaxMap[stmtRaw])

        const isBagmati = storeLower.includes('bagmati') || stmtNo.includes('npdznlue6t')

        if (match && match.length > 0) {
            if (!isBagmati) {
                return match.filter((t: { desc: string }) => !t.desc.toLowerCase().includes('merchant managed'))
            }
            return match
        }

        const b = getStatementBreakdown(item)
        return extractTaxInvoicesFromBreakdown(b, isBagmati)
    }

    // Fetch Stored Tax Invoices from DB
    const { data: storedInvoices = [], refetch: refetchStoredInvoices } = useQuery({
        queryKey: ['daraz-stored-tax-invoices', fiscalYearId, startDate, endDate, selectedCompanyId, selectedStoreFilter, verificationFilter],
        queryFn: () => getStoredDarazTaxInvoices({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            companyName: selectedCompanyId !== 'all' ? companyMap[selectedCompanyId] : undefined,
            storeName: selectedStoreFilter !== 'all' ? selectedStoreFilter : undefined,
            verificationStatus: verificationFilter
        })
    })

    // Background sync statement tax invoices to DB
    useEffect(() => {
        if (!payoutData || payoutData.length === 0) return

        const itemsToSync: any[] = []
        payoutData.forEach((item: any) => {
            const rawStr = (item.statement || item.created_at || '').trim()
            let pStart: Date | null = null
            let pEnd: Date | null = null
            if (rawStr.includes(' - ')) {
                const parts = rawStr.split(' - ')
                const d1 = new Date(parts[0].trim())
                const d2 = new Date(parts[1].trim())
                if (!isNaN(d1.getTime())) pStart = d1
                if (!isNaN(d2.getTime())) pEnd = d2
            } else if (rawStr) {
                const d = new Date(rawStr)
                if (!isNaN(d.getTime())) {
                    const endSun = new Date(d)
                    endSun.setDate(d.getDate() - 1)
                    const startMon = new Date(endSun)
                    startMon.setDate(endSun.getDate() - 6)
                    pStart = startMon
                    pEnd = endSun
                }
            }
            if (!pStart) pStart = new Date()
            if (!pEnd) pEnd = pStart

            const dateStr = format(pEnd, 'yyyy-MM-dd')
            const datePeriod = `${format(pStart, 'dd MMM yyyy')} - ${format(pEnd, 'dd MMM yyyy')}`
            const storeLabel = item.store_name || item.seller_account || (item.statement_number ? item.statement_number.split('-')[0] : 'Bagmati Traders')
            const companyName = item.company_name || 'Bagmati Traders'
            const taxItems = getTaxItemsForStatement(item, storeLabel)

            taxItems.forEach((t: any) => {
                if (t.net <= 0) return

                itemsToSync.push({
                    statement_number: item.statement_number,
                    date: dateStr,
                    date_period: datePeriod,
                    store_name: storeLabel,
                    company_name: companyName,
                    description: t.desc,
                    taxable_amount: t.taxableAmt,
                    vat_amount: t.vatAmt,
                    grand_total: t.grandTotal,
                    fiscal_year_id: fiscalYearId !== 'all' ? fiscalYearId : undefined
                })
            })
        })

        if (itemsToSync.length > 0) {
            syncStatementTaxInvoicesToDB(itemsToSync).catch(e => console.warn('Background sync tax invoices:', e))
        }
    }, [payoutData, fiscalYearId, liveTaxMap])

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
        const rows: Array<{
            id: string
            dbId?: string
            statementNumber?: string
            date?: string
            datePeriod: string
            storeName: string
            companyName: string
            invoiceNumber?: string
            description: string
            taxableAmt: number
            vatAmt: number
            grandTotal: number
            isVerified: boolean
            source: 'auto' | 'manual'
            notes?: string
        }> = []

        // Map DB stored records by unique key (statement_store_desc)
        const dbMap: Record<string, any> = {}
        storedInvoices.forEach((s: any) => {
            if (s.statement_number) {
                const key = `${s.statement_number}_${s.store_name}_${s.description}`
                dbMap[key] = s
            }
        })

        let idxCounter = 1

        const formatStatementPeriod = (item: any): string => {
            const raw = (item.statement || item.created_at || '').trim()
            if (!raw) return 'Weekly Period'
            if (raw.includes(' - ')) return raw

            const d = new Date(raw)
            if (isNaN(d.getTime())) return raw

            const endSun = new Date(d)
            endSun.setDate(d.getDate() - 1)
            const startMon = new Date(endSun)
            startMon.setDate(endSun.getDate() - 6)

            try {
                return `${format(startMon, 'dd MMM yyyy')} - ${format(endSun, 'dd MMM yyyy')}`
            } catch {
                return raw
            }
        }

        // 1. Process Live Statements
        (payoutData || []).forEach((item: any) => {
            const rawStr = (item.statement || item.created_at || '').trim()
            let pStart: Date | null = null
            let pEnd: Date | null = null

            if (rawStr.includes(' - ')) {
                const parts = rawStr.split(' - ')
                const d1 = new Date(parts[0].trim())
                const d2 = new Date(parts[1].trim())
                if (!isNaN(d1.getTime())) pStart = d1
                if (!isNaN(d2.getTime())) pEnd = d2
            } else if (rawStr) {
                const d = new Date(rawStr)
                if (!isNaN(d.getTime())) {
                    const endSun = new Date(d)
                    endSun.setDate(d.getDate() - 1)
                    const startMon = new Date(endSun)
                    startMon.setDate(endSun.getDate() - 6)
                    pStart = startMon
                    pEnd = endSun
                }
            }

            if (!pStart) pStart = new Date()
            if (!pEnd) pEnd = pStart

            // Strict filter by Fiscal Year Start Date & End Date
            if (startDate && endDate) {
                const fStart = new Date(startDate)
                fStart.setHours(0, 0, 0, 0)
                const fEnd = new Date(endDate)
                fEnd.setHours(23, 59, 59, 999)

                const pStartTime = pStart.getTime()
                const pEndTime = pEnd.getTime()
                const fStartTime = fStart.getTime()
                const fEndTime = fEnd.getTime()

                // Exclude any statement outside the selected Fiscal Year range [startDate, endDate]
                if (pEndTime < fStartTime || pStartTime > fEndTime) {
                    return
                }
            }

            const rawStore = item.store_name || item.seller_account
            const storeLabel = (rawStore && rawStore !== 'All')
                ? rawStore
                : (item.statement_number ? item.statement_number.split('-')[0] : 'Bagmati Traders')

            const companyName = item.company_name || 'Bagmati Traders'

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

            const taxItems = getTaxItemsForStatement(item, storeLabel)

            const displayPeriod = formatStatementPeriod(item)
            const dateStr = format(pEnd, 'yyyy-MM-dd')

            taxItems.forEach((tItem: any) => {
                if (tItem.net <= 0) return

                const key = `${item.statement_number}_${storeLabel}_${tItem.desc}`
                const dbRecord = dbMap[key]

                const isVerified = dbRecord ? !!dbRecord.is_verified : false
                const taxableAmt = dbRecord && dbRecord.taxable_amount !== undefined && dbRecord.is_verified ? Number(dbRecord.taxable_amount) : tItem.taxableAmt
                const vatAmt = dbRecord && dbRecord.vat_amount !== undefined && dbRecord.is_verified ? Number(dbRecord.vat_amount) : tItem.vatAmt
                const grandTotal = dbRecord && dbRecord.grand_total !== undefined && dbRecord.is_verified ? Number(dbRecord.grand_total) : tItem.grandTotal

                rows.push({
                    id: dbRecord?.id || `daraz-tax-${idxCounter++}`,
                    dbId: dbRecord?.id,
                    statementNumber: item.statement_number,
                    date: dbRecord?.date || dateStr,
                    datePeriod: dbRecord?.date_period || displayPeriod,
                    storeName: storeLabel,
                    companyName: dbRecord?.company_name || companyName,
                    invoiceNumber: dbRecord?.invoice_number || null,
                    description: dbRecord?.description || tItem.desc,
                    taxableAmt,
                    vatAmt,
                    grandTotal,
                    isVerified,
                    source: 'auto',
                    notes: dbRecord?.notes
                })
            })
        })

        // 2. Include Manual Invoices from DB
        storedInvoices.filter((s: any) => s.source === 'manual').forEach((s: any) => {
            // Filter by selected company
            if (selectedCompanyId !== 'all') {
                const selectedComp = companies.find((c: any) => c.id === selectedCompanyId)
                if (selectedComp && selectedComp.company_name.toLowerCase() !== s.company_name?.toLowerCase()) {
                    return
                }
            }

            // Filter by selected store
            if (selectedStoreFilter !== 'all') {
                if (s.store_name?.toLowerCase() !== selectedStoreFilter.toLowerCase()) {
                    return
                }
            }

            rows.unshift({
                id: s.id,
                dbId: s.id,
                statementNumber: s.statement_number || null,
                date: s.date,
                datePeriod: s.date_period,
                storeName: s.store_name,
                companyName: s.company_name,
                invoiceNumber: s.invoice_number,
                description: s.description,
                taxableAmt: s.taxable_amount,
                vatAmt: s.vat_amount,
                grandTotal: s.grand_total,
                isVerified: !!s.is_verified,
                source: 'manual',
                notes: s.notes
            })
        })

        // 3. Filter by Verification Status
        if (verificationFilter === 'verified') {
            return rows.filter(r => r.isVerified)
        } else if (verificationFilter === 'unverified') {
            return rows.filter(r => !r.isVerified)
        }

        return rows
    }, [payoutData, storedInvoices, selectedCompanyId, companies, startDate, endDate, selectedStoreFilter, verificationFilter, liveTaxMap])

    // State for Verify & Edit Modal
    const [isVerifyEditModalOpen, setIsVerifyEditModalOpen] = useState(false)
    const [activeVerifyRow, setActiveVerifyRow] = useState<{
        id?: string
        dbId?: string
        statementNumber?: string | null
        date: string
        datePeriod: string
        storeName: string
        companyName: string
        invoiceNumber: string
        description: string
        taxableAmount: number | string
        vatAmount: number
        grandTotal: number
        isVerified: boolean
        notes: string
    } | null>(null)
    const [isSavingVerify, setIsSavingVerify] = useState(false)

    // Open Modal for Verifying / Editing Tax Invoice
    const handleOpenVerifyModal = (row: any) => {
        setActiveVerifyRow({
            id: row.id,
            dbId: row.dbId,
            statementNumber: row.statementNumber || null,
            date: row.date || todayStr,
            datePeriod: row.datePeriod || '',
            storeName: row.storeName || 'Bagmati Traders',
            companyName: row.companyName || 'Bagmati Traders',
            invoiceNumber: row.invoiceNumber || '',
            description: row.description || '',
            taxableAmount: row.taxableAmt || 0,
            vatAmount: row.vatAmt || 0,
            grandTotal: row.grandTotal || 0,
            isVerified: row.isVerified ?? false,
            notes: row.notes || ''
        })
        setIsVerifyEditModalOpen(true)
    }

    const handleVerifyTaxableChange = (val: string) => {
        const taxable = parseFloat(val) || 0
        const vat = Math.round((taxable * 0.13) * 100) / 100
        const grand = Math.round((taxable + vat) * 100) / 100
        setActiveVerifyRow(prev => prev ? ({
            ...prev,
            taxableAmount: val,
            vatAmount: vat,
            grandTotal: grand
        }) : null)
    }

    const handleSaveVerifyModal = async (lockStatus: boolean) => {
        if (!activeVerifyRow) return
        const taxable = parseFloat(String(activeVerifyRow.taxableAmount)) || 0
        if (!activeVerifyRow.description || taxable <= 0) {
            alert('Please enter a valid description and taxable amount.')
            return
        }

        setIsSavingVerify(true)
        try {
            await saveOrUpdateDarazTaxInvoice({
                id: activeVerifyRow.dbId,
                statement_number: activeVerifyRow.statementNumber || null,
                date: activeVerifyRow.date,
                date_period: activeVerifyRow.datePeriod,
                store_name: activeVerifyRow.storeName,
                company_name: activeVerifyRow.companyName,
                invoice_number: activeVerifyRow.invoiceNumber || null,
                description: activeVerifyRow.description,
                taxable_amount: taxable,
                vat_amount: activeVerifyRow.vatAmount,
                grand_total: activeVerifyRow.grandTotal,
                is_verified: lockStatus,
                notes: activeVerifyRow.notes,
                fiscal_year_id: fiscalYearId !== 'all' ? fiscalYearId : undefined
            })
            setIsVerifyEditModalOpen(false)
            refetchStoredInvoices()
        } catch (err: any) {
            alert(`Error saving invoice: ${err.message}`)
        } finally {
            setIsSavingVerify(false)
        }
    }

    // Event Handlers for Manual Invoice Creation
    const handleDateChange = (val: string) => {
        const p = calculateWeeklyPeriod(val)
        setNewInvoice(prev => ({
            ...prev,
            date: val,
            datePeriod: p
        }))
    }

    const handleTaxableChange = (val: string) => {
        const taxable = parseFloat(val) || 0
        const vat = Math.round((taxable * 0.13) * 100) / 100
        const grand = Math.round((taxable + vat) * 100) / 100
        setNewInvoice(prev => ({
            ...prev,
            taxableAmount: val,
            vatAmount: vat,
            grandTotal: grand
        }))
    }

    const handleSaveInvoice = async (e: React.FormEvent) => {
        e.preventDefault()
        const taxable = parseFloat(String(newInvoice.taxableAmount)) || 0
        if (!newInvoice.description || taxable <= 0) {
            alert('Please enter a valid description and taxable amount.')
            return
        }

        setIsSubmitting(true)
        try {
            await createDarazTaxInvoice({
                date: newInvoice.date,
                date_period: newInvoice.datePeriod || calculateWeeklyPeriod(newInvoice.date),
                store_name: newInvoice.storeName,
                company_name: newInvoice.companyName || 'Bagmati Traders',
                invoice_number: newInvoice.invoiceNumber,
                description: newInvoice.description,
                taxable_amount: taxable,
                vat_amount: newInvoice.vatAmount,
                grand_total: newInvoice.grandTotal,
                is_verified: newInvoice.isVerified,
                notes: newInvoice.notes,
                fiscal_year_id: fiscalYearId !== 'all' ? fiscalYearId : undefined
            })
            setIsAddModalOpen(false)
            refetchStoredInvoices()
            setNewInvoice({
                date: todayStr,
                datePeriod: calculateWeeklyPeriod(todayStr),
                storeName: availableStoresList[0] || 'Bagmati Traders',
                companyName: 'Bagmati Traders',
                invoiceNumber: '',
                description: 'Tax Invoice - Commission Fee',
                taxableAmount: '',
                vatAmount: 0,
                grandTotal: 0,
                isVerified: true,
                notes: ''
            })
        } catch (err: any) {
            alert(`Error saving invoice: ${err.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteInvoice = async (dbId: string) => {
        if (!confirm('Are you sure you want to delete this manual tax invoice?')) return
        try {
            await deleteDarazTaxInvoice(dbId)
            refetchStoredInvoices()
        } catch (err: any) {
            alert(`Error deleting invoice: ${err.message}`)
        }
    }

    const handleCopyFollowUpList = () => {
        const unverifiedRows = darazTaxInvoices.filter(r => !r.isVerified)
        if (unverifiedRows.length === 0) {
            alert('No unverified or missing tax invoices found for this selection.')
            return
        }

        const lines = [
            `Dear Daraz Seller Support,`,
            ``,
            `We are missing the official Tax Invoice (PDF) for the following statement fee deductions on our stores. Please provide the corresponding Tax Invoices for our accounting records:`,
            ``
        ]

        unverifiedRows.forEach((r, idx) => {
            lines.push(`${idx + 1}. Period: ${r.datePeriod} | Store: ${r.storeName} | ${r.description} | Taxable: NPR ${r.taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })} | VAT: NPR ${r.vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })} | Grand Total: NPR ${r.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
        })

        lines.push(``)
        lines.push(`Total Missing Invoices Amount: NPR ${unverifiedRows.reduce((sum, r) => sum + r.grandTotal, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
        lines.push(`Thank you,`)
        lines.push(`Bagmati Traders Finance Team`)

        navigator.clipboard.writeText(lines.join('\n'))
        setCopiedFollowUp(true)
        setTimeout(() => setCopiedFollowUp(false), 3000)
    }

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
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 px-6 py-3 shadow-2xs sticky top-0 z-20 flex items-center justify-between gap-4 font-['Inter',sans-serif]">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/account/pan-vat-billing"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all text-slate-600 dark:text-slate-400"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>

                    {/* Primary Mode Buttons on Left Side */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-xl border border-slate-200/70 dark:border-zinc-700/70">
                        <button
                            onClick={() => setMainReportMode('all-report')}
                            className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${mainReportMode === 'all-report'
                                ? 'bg-violet-600 text-white shadow-xs font-bold'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-white/50 dark:hover:bg-zinc-700/50'
                                }`}
                        >
                            <Layers className="h-4 w-4" />
                            All Report
                        </button>
                        <button
                            onClick={() => setMainReportMode('pan-vat')}
                            className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${mainReportMode === 'pan-vat'
                                ? 'bg-violet-600 text-white shadow-xs font-bold'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-white/50 dark:hover:bg-zinc-700/50'
                                }`}
                        >
                            <FileText className="h-4 w-4" />
                            Pan/Vat Transaction Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-Header Navigation Bar when 'All Report' is selected */}
            {mainReportMode === 'all-report' && (
                <div className="px-4 md:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs font-['Inter',sans-serif]">
                        <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-zinc-800/90 p-1.5 rounded-xl border border-slate-200/60 dark:border-zinc-700/60">
                            <button
                                onClick={() => setAllReportSubTab('daraz')}
                                className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${allReportSubTab === 'daraz'
                                    ? 'bg-orange-500 text-white shadow-xs font-bold'
                                    : 'text-slate-700 dark:text-slate-300 font-medium hover:bg-white/60 dark:hover:bg-zinc-700/60'
                                    }`}
                            >
                                <Store className="h-4 w-4" />
                                Daraz
                            </button>
                            <button
                                onClick={() => setAllReportSubTab('sales')}
                                className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${allReportSubTab === 'sales'
                                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                                    : 'text-slate-700 dark:text-slate-300 font-medium hover:bg-white/60 dark:hover:bg-zinc-700/60'
                                    }`}
                            >
                                <ShoppingCart className="h-4 w-4" />
                                Sales
                            </button>
                            <button
                                onClick={() => setAllReportSubTab('purchase')}
                                className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 font-['Inter',sans-serif] ${allReportSubTab === 'purchase'
                                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                                    : 'text-slate-700 dark:text-slate-300 font-medium hover:bg-white/60 dark:hover:bg-zinc-700/60'
                                    }`}
                            >
                                <ShoppingBag className="h-4 w-4" />
                                Purchase
                            </button>
                        </div>

                        {/* Action buttons on the right side of Daraz Category bar */}
                        {allReportSubTab === 'daraz' && (
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleCopyFollowUpList}
                                    variant="outline"
                                    className="h-9 px-3.5 text-[13px] font-semibold border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl gap-1.5 shadow-2xs font-['Inter',sans-serif]"
                                    title="Copy missing invoices list for Daraz Seller Support"
                                >
                                    {copiedFollowUp ? (
                                        <>
                                            <Check className="h-4 w-4 text-emerald-600" />
                                            <span>Copied Summary!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4 text-amber-600" />
                                            <span>Copy Missing Invoices List</span>
                                        </>
                                    )}
                                </Button>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setNewInvoice({
                                            date: todayStr,
                                            datePeriod: calculateWeeklyPeriod(todayStr),
                                            storeName: availableStoresList[0] || 'Bagmati Traders',
                                            companyName: 'Bagmati Traders',
                                            invoiceNumber: '',
                                            description: 'Tax Invoice - Commission Fee',
                                            taxableAmount: '',
                                            vatAmount: 0,
                                            grandTotal: 0,
                                            isVerified: true,
                                            notes: ''
                                        })
                                        setIsAddModalOpen(true)
                                    }}
                                    className="h-9 px-4 text-[13px] font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer font-['Inter',sans-serif]"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add Invoice</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Filter Section */}
            <div className="px-4 md:px-6">
                <Card className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-2xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                        {/* Fiscal Year Filter */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">Fiscal Year</label>
                            <div className="relative">
                                <select
                                    value={fiscalYearId}
                                    onChange={(e) => handleFiscalYearChange(e.target.value)}
                                    className="w-full px-3.5 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
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
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">Start Date (AD)</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3.5 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
                            />
                        </div>

                        {/* End Date Picker */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">End Date (AD)</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3.5 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
                            />
                        </div>

                        {/* Company Filter */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">Filter by Company</label>
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                className="w-full px-3.5 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
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
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">Filter by Store</label>
                            <select
                                value={selectedStoreFilter}
                                onChange={(e) => setSelectedStoreFilter(e.target.value)}
                                className="w-full px-3.5 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
                            >
                                <option value="all">All Stores</option>
                                {availableStoresList.map((storeName) => (
                                    <option key={storeName} value={storeName}>
                                        {storeName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Verification Status Filter */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-['Inter',sans-serif]">Status</label>
                            <select
                                value={verificationFilter}
                                onChange={(e: any) => setVerificationFilter(e.target.value)}
                                className="w-full px-3.5 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 shadow-2xs font-['Inter',sans-serif] cursor-pointer"
                            >
                                <option value="all">All Invoices</option>
                                <option value="verified">Verified (PDF Received)</option>
                                <option value="unverified">Pending / Missing PDF</option>
                            </select>
                        </div>
                    </div>
                </Card>
            </div>

            {/* CONTENT AREA 1: ALL REPORT MODE -> DARAZ SUB-TAB */}
            {mainReportMode === 'all-report' && allReportSubTab === 'daraz' && (
                <div className="px-4 md:px-6 space-y-4 font-['Inter',sans-serif]">
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-3.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <h3 className="text-[13px] font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-orange-600" />
                                Daraz Tax Invoices Confirmation Report
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-gray-500">
                                    {darazTaxInvoices.length} Total Invoices ({darazTaxInvoices.filter(r => r.isVerified).length} Verified, {darazTaxInvoices.filter(r => !r.isVerified).length} Pending)
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                        <TableHead className="w-12 text-center text-xs font-bold uppercase tracking-wider">S.N</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Date & Store</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Invoice No</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Description</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Taxable Amount</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Vat 13 %</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Grand Total</TableHead>
                                        <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Status</TableHead>
                                        <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-[13px] divide-y divide-gray-100 dark:divide-zinc-800">
                                    {paginatedDarazTax.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                                                No Daraz Tax Invoices found matching the selected filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedDarazTax.map((row, idx) => {
                                            const globalIndex = (darazTaxPage - 1) * itemsPerPage + idx + 1
                                            return (
                                                <TableRow key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                                                    <TableCell className="text-center font-medium text-gray-500 py-3">{globalIndex}</TableCell>
                                                    <TableCell className="py-3">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                                                <Calendar className="h-4 w-4 text-gray-400" />
                                                                {row.datePeriod}
                                                            </span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold border ${getStoreBadgeStyle(row.storeName)}`}>
                                                                    {row.storeName}
                                                                </span>
                                                                {row.source === 'manual' && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-950/60 dark:text-violet-300">
                                                                        Manual
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-gray-600 dark:text-gray-400 py-3">
                                                        {row.invoiceNumber || <span className="text-gray-300 dark:text-zinc-600">-</span>}
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-gray-800 dark:text-gray-200 py-3">
                                                        <div>{row.description}</div>
                                                        {row.notes && <div className="text-[11px] text-gray-400 font-normal mt-0.5">{row.notes}</div>}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-semibold text-gray-900 dark:text-gray-100 py-3">
                                                        NPR {row.taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-semibold text-blue-600 dark:text-blue-400 py-3">
                                                        NPR {row.vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-3">
                                                        NPR {row.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-center py-3">
                                                        {row.isVerified ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 shadow-xs">
                                                                <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                                Verified & Locked
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 shadow-xs">
                                                                <Clock className="h-3 w-3 text-amber-600" />
                                                                Pending PDF
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center py-3">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant={row.isVerified ? "outline" : "default"}
                                                                onClick={() => handleOpenVerifyModal(row)}
                                                                className={`h-7 px-2.5 text-[11px] font-bold rounded-lg transition-all ${row.isVerified
                                                                    ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                                                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                                                    }`}
                                                                title={row.isVerified ? "Edit Locked Amounts or Unlock" : "Verify & Lock Tax Invoice"}
                                                            >
                                                                {row.isVerified ? (
                                                                    <>
                                                                        <Edit3 className="h-3 w-3 mr-1" />
                                                                        Edit / Locked
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                        Verify
                                                                    </>
                                                                )}
                                                            </Button>

                                                            {row.source === 'manual' && row.dbId && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleDeleteInvoice(row.dbId!)}
                                                                    className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                                                                    title="Delete manual invoice"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                                <TableFooter className="bg-gray-100 dark:bg-zinc-800/90 border-t-2 border-gray-300 dark:border-zinc-700 font-extrabold text-[13px]">
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center font-black text-gray-900 dark:text-gray-100 py-3">
                                            Total Summary ({darazTaxInvoices.length} Tax Invoices)
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
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </Card>

                    {/* Pagination Controls for Daraz Tax Invoices */}
                    {darazTaxInvoices.length > itemsPerPage && (
                        <div className="flex items-center justify-between py-2 bg-white dark:bg-zinc-900 px-4 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                            <p className="text-[13px] text-gray-500">
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
                                <span className="text-[13px] font-semibold">
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
                <div className="px-4 md:px-6 space-y-4 font-['Inter',sans-serif]">
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-3.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <h3 className="text-[13px] font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                                Sales Tax Invoices Report
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                        <TableHead className="w-12 text-center text-xs font-bold uppercase tracking-wider">S.N</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Date & Invoice No</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Company Name</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Taxable Amount</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Vat 13 %</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Grand Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-[13px] divide-y divide-gray-100 dark:divide-zinc-800">
                                    {salesTaxInvoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                No Sales Billing Records Found for Running Fiscal Year
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        salesTaxInvoices.map((row, idx) => (
                                            <TableRow key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                                                <TableCell className="text-center font-medium text-gray-500 py-3">{idx + 1}</TableCell>
                                                <TableCell className="py-3 font-medium text-gray-900 dark:text-gray-100">
                                                    <div>{formatDateStr(row.date)}</div>
                                                    <div className="text-[11px] text-gray-500 font-mono">{row.refNo}</div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-gray-800 dark:text-gray-200 py-3">
                                                    {row.companyName}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-gray-900 dark:text-gray-100 py-3">
                                                    NPR {row.taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-blue-600 dark:text-blue-400 py-3">
                                                    NPR {row.vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-3">
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
                <div className="px-4 md:px-6 space-y-4 font-['Inter',sans-serif]">
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-3.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <h3 className="text-[13px] font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4 text-blue-600" />
                                Purchase Tax Invoices Report
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                        <TableHead className="w-12 text-center text-xs font-bold uppercase tracking-wider">S.N</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Date & Ref No</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Company Name / Supplier</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Taxable Amount</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Vat 13 %</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Grand Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-[13px] divide-y divide-gray-100 dark:divide-zinc-800">
                                    {purchaseTaxInvoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                No Purchase Billing Records Found for Running Fiscal Year
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        purchaseTaxInvoices.map((row, idx) => (
                                            <TableRow key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                                                <TableCell className="text-center font-medium text-gray-500 py-3">{idx + 1}</TableCell>
                                                <TableCell className="py-3 font-medium text-gray-900 dark:text-gray-100">
                                                    <div>{formatDateStr(row.date)}</div>
                                                    <div className="text-[11px] text-gray-500 font-mono">{row.refNo}</div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-gray-800 dark:text-gray-200 py-3">
                                                    <div>{row.companyName}</div>
                                                    <div className="text-[11px] text-gray-500">{row.supplierName}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-gray-900 dark:text-gray-100 py-3">
                                                    NPR {row.taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-blue-600 dark:text-blue-400 py-3">
                                                    NPR {row.vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-3">
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
                <div className="px-4 md:px-6 font-['Inter',sans-serif]">
                    {isLoading ? (
                        <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                            <RefreshCw className="h-8 w-8 text-violet-500 animate-spin" />
                            <p className="text-[13px] font-semibold text-gray-500">Aggregating daily transaction records...</p>
                        </Card>
                    ) : filteredReportData.length === 0 ? (
                        <Card className="p-12 text-center flex flex-col items-center justify-center space-y-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                            <AlertCircle className="h-10 w-10 text-gray-300" />
                            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-200">No Transactions Found</h3>
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
                                                <TableHead rowSpan={2} className="w-32 font-extrabold text-gray-800 dark:text-gray-200 border-r dark:border-zinc-800 text-xs">Date</TableHead>
                                                <TableHead colSpan={4} className="text-center font-extrabold text-orange-600 dark:text-orange-500 border-r dark:border-zinc-800 bg-orange-50/10 text-xs">
                                                    Daraz Transaction
                                                </TableHead>
                                                <TableHead colSpan={2} className="text-center font-extrabold text-emerald-600 dark:text-emerald-500 border-r dark:border-zinc-800 bg-emerald-50/10 text-xs">
                                                    Sales Billing
                                                </TableHead>
                                                <TableHead colSpan={2} className="text-center font-extrabold text-blue-600 dark:text-blue-500 bg-blue-50/10 text-xs">
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
                                                        <TableCell className="font-semibold text-gray-900 dark:text-gray-100 text-[13px] py-3 border-r dark:border-zinc-800">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="h-4 w-4 text-gray-400" />
                                                                {formatDateStr(row.date)}
                                                            </div>
                                                        </TableCell>

                                                        {/* Daraz Transaction Columns */}
                                                        <TableCell className="text-[13px] text-gray-700 dark:text-gray-300 font-medium">
                                                            {hasDaraz ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Building className="h-4 w-4 text-gray-400 shrink-0" />
                                                                    <span className="line-clamp-1">{row.companyName}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-[13px] pr-6 font-extrabold ${row.darazShipped > 0 ? 'text-sky-500 dark:text-sky-300' : 'text-gray-400'}`}>
                                                            {formatNepaliCurrency(row.darazShipped)}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-[13px] pr-6 font-extrabold ${row.darazRevenue > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                            {formatNepaliCurrency(row.darazRevenue)}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-[13px] pr-6 border-r dark:border-zinc-800 font-extrabold ${row.darazCommissionFees > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
                                                            {formatNepaliCurrency(row.darazCommissionFees)}
                                                        </TableCell>

                                                        {/* Sales Billing Columns */}
                                                        <TableCell className="text-[13px] text-gray-700 dark:text-gray-300 font-medium">
                                                            {hasSales ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Building className="h-4 w-4 text-gray-400 shrink-0" />
                                                                    <span className="line-clamp-1">{row.companyName}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-[13px] pr-6 border-r dark:border-zinc-800 font-extrabold ${hasSales ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                            {formatNepaliCurrency(row.salesAmount)}
                                                        </TableCell>

                                                        {/* Purchase Billing Columns */}
                                                        <TableCell className="text-[13px] text-gray-700 dark:text-gray-300 font-medium">
                                                            {hasPurchase ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Building className="h-4 w-4 text-gray-400 shrink-0" />
                                                                    <span className="line-clamp-1">{row.companyName}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-[13px] pr-6 font-extrabold ${hasPurchase ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                                                            {formatNepaliCurrency(row.purchaseAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}

                                            {/* Footer Totals Row */}
                                            <TableRow className="bg-gray-100/90 dark:bg-zinc-800/80 font-bold border-t-2 border-gray-300 dark:border-zinc-700 hover:bg-gray-100/90">
                                                <TableCell className="text-gray-900 dark:text-gray-100 py-3.5 pl-4 border-r dark:border-zinc-800 text-[13px] font-black">Total Summary (All Pages)</TableCell>
                                                <TableCell className="text-gray-400"></TableCell>
                                                <TableCell className="text-right text-sky-600 dark:text-sky-300 pr-6 font-black text-[13px]">
                                                    {formatNepaliCurrency(overallTotals.totalDarazShipped)}
                                                </TableCell>
                                                <TableCell className="text-right text-emerald-600 dark:text-emerald-400 pr-6 font-black text-[13px]">
                                                    {formatNepaliCurrency(overallTotals.totalDarazRevenue)}
                                                </TableCell>
                                                <TableCell className="text-right text-rose-600 dark:text-rose-400 pr-6 border-r dark:border-zinc-800 font-black text-[13px]">
                                                    {formatNepaliCurrency(overallTotals.totalDarazCommissionFees)}
                                                </TableCell>
                                                <TableCell className="text-gray-400"></TableCell>
                                                <TableCell className="text-right text-emerald-700 dark:text-emerald-400 pr-6 border-r dark:border-zinc-800 font-black text-[13px]">
                                                    {formatNepaliCurrency(overallTotals.totalSales)}
                                                </TableCell>
                                                <TableCell className="text-gray-400"></TableCell>
                                                <TableCell className="text-right text-blue-700 dark:text-blue-400 pr-6 font-black text-[13px]">
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
                                    <p className="text-[13px] text-gray-500">
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
                                        <span className="text-[13px] font-semibold">
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

            {/* ADD INVOICE MODAL DIALOG */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-[560px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-0 overflow-hidden font-['Inter',sans-serif]">
                    <div className="p-5 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-orange-500 text-white shadow-xs">
                                <Receipt className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-[17px] font-extrabold text-slate-900 dark:text-slate-100">
                                    Add Daraz Tax Invoice
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Add a received PDF tax invoice from Daraz or manual adjustment
                                </DialogDescription>
                                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    Add a received PDF tax invoice from Daraz or manual adjustment
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <form onSubmit={handleSaveInvoice} className="p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Date Picker */}
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Calendar className="h-4 w-4 text-orange-500" />
                                    Invoice Date (AD) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={newInvoice.date}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                                />
                            </div>

                            {/* Auto-computed Date Period */}
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                                    Statement Period (Auto)
                                </label>
                                <div className="px-3 py-2 text-[13px] font-semibold bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-900/50 rounded-xl flex items-center gap-1.5">
                                    <Clock className="h-4 w-4 text-orange-600" />
                                    <span>{newInvoice.datePeriod || 'Auto-calculated on date pick'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Store Name Dropdown */}
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Store className="h-4 w-4 text-orange-500" />
                                    Store Name <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    required
                                    value={newInvoice.storeName}
                                    onChange={(e) => {
                                        const st = e.target.value
                                        const comp = sellerToCompanyMap[st] || 'Bagmati Traders'
                                        setNewInvoice(prev => ({ ...prev, storeName: st, companyName: comp }))
                                    }}
                                    className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 cursor-pointer"
                                >
                                    {availableStoresList.map(st => (
                                        <option key={st} value={st}>{st}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Invoice / Bill No */}
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                                    Invoice / Bill No (From Daraz PDF)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. DARAZ-INV-2026-00432"
                                    value={newInvoice.invoiceNumber}
                                    onChange={(e) => setNewInvoice(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                                    className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                                />
                            </div>
                        </div>

                        {/* Description Field & Suggestions */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                                Description / Fee Category <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Tax Invoice - Commission Fee"
                                value={newInvoice.description}
                                onChange={(e) => setNewInvoice(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                            />
                            {/* Quick click suggestions */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {[
                                    'Tax Invoice - Commission Fee',
                                    'Tax Invoice - Payment Fee',
                                    'Tax Invoice - Co Funded Voucher Max',
                                    'Tax Invoice - Free Shipping Max',
                                    'Tax Invoice - Daraz Coins Discount Participation Fee',
                                    'Tax Invoice - Handling Fee',
                                    'Tax Invoice - Merchant Managed Services Charge'
                                ].map((sug) => (
                                    <button
                                        type="button"
                                        key={sug}
                                        onClick={() => setNewInvoice(prev => ({ ...prev, description: sug }))}
                                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-950/40 text-slate-700 dark:text-slate-300 hover:text-orange-700 border border-slate-200/60 dark:border-zinc-700 transition-colors"
                                    >
                                        {sug.replace('Tax Invoice - ', '')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Financial Amounts Breakdown */}
                        <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700/80 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Taxable Amount */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                                        Taxable Amount <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="0.00"
                                        value={newInvoice.taxableAmount}
                                        onChange={(e) => handleTaxableChange(e.target.value)}
                                        className="w-full px-3 py-2 text-[13px] font-mono font-bold border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500/30"
                                    />
                                </div>

                                {/* VAT 13% (Auto) */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">
                                        Vat 13% (Auto)
                                    </label>
                                    <div className="px-3 py-2 text-[13px] font-mono font-bold bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50 rounded-lg">
                                        NPR {newInvoice.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>

                                {/* Grand Total (Auto) */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                                        Grand Total (Auto)
                                    </label>
                                    <div className="px-3 py-2 text-[13px] font-mono font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/50 rounded-lg">
                                        NPR {newInvoice.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Verification Toggle & Notes */}
                        <div className="space-y-3">
                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-zinc-700/50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={newInvoice.isVerified}
                                    onChange={(e) => setNewInvoice(prev => ({ ...prev, isVerified: e.target.checked }))}
                                    className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                />
                                <div className="flex flex-col">
                                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        Mark as Verified (PDF Received from Daraz)
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                        Check if you have received and confirmed the official Tax Invoice PDF by email
                                    </span>
                                </div>
                            </label>

                            <div className="space-y-1">
                                <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                                    Remarks / Notes (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Received via Daraz seller email on Aug 12"
                                    value={newInvoice.notes}
                                    onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100"
                                />
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 text-[13px] font-semibold rounded-xl"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 text-[13px] font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-xs"
                            >
                                {isSubmitting ? 'Saving...' : 'Save Tax Invoice'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL 2: VERIFY & LOCK DARAZ TAX INVOICE */}
            <Dialog open={isVerifyEditModalOpen} onOpenChange={setIsVerifyEditModalOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto font-['Inter',sans-serif] p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl">
                    <DialogHeader className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                Verify &amp; Lock Tax Invoice
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Edit and lock a Daraz tax invoice to protect it from automated API recalculations.
                            </DialogDescription>
                            {activeVerifyRow?.isVerified ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300">
                                    <Lock className="h-3 w-3 text-emerald-600" />
                                    Currently Locked
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300">
                                    <Clock className="h-3 w-3 text-amber-600" />
                                    Pending PDF Verification
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500">
                            Edit details to match the official Daraz Tax Invoice PDF. Locking protects your custom values from automated API recalculations.
                        </p>
                    </DialogHeader>

                    {activeVerifyRow && (
                        <div className="space-y-4 pt-2">
                            {/* Statement & Store Meta Info Header */}
                            <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div>
                                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Statement Period</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeVerifyRow.datePeriod || 'Custom Date'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Store & Company</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeVerifyRow.storeName} ({activeVerifyRow.companyName})</span>
                                </div>
                                {activeVerifyRow.statementNumber && (
                                    <div>
                                        <span className="text-slate-400 font-semibold block text-[10px] uppercase">Statement Number</span>
                                        <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{activeVerifyRow.statementNumber}</span>
                                    </div>
                                )}
                            </div>

                            {/* Invoice Number & Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                        <FileText className="h-4 w-4 text-emerald-600" />
                                        Invoice / Bill No (From Daraz PDF)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. DARAZ-INV-2026-00432"
                                        value={activeVerifyRow.invoiceNumber}
                                        onChange={(e) => setActiveVerifyRow(prev => prev ? ({ ...prev, invoiceNumber: e.target.value }) : null)}
                                        className="w-full px-3 py-2 text-[13px] font-mono font-bold border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                        <Calendar className="h-4 w-4 text-emerald-600" />
                                        Invoice Date
                                    </label>
                                    <input
                                        type="date"
                                        value={activeVerifyRow.date}
                                        onChange={(e) => setActiveVerifyRow(prev => prev ? ({ ...prev, date: e.target.value }) : null)}
                                        className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            {/* Description / Category */}
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                                    Description / Fee Category <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={activeVerifyRow.description}
                                    onChange={(e) => setActiveVerifyRow(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                                    className="w-full px-3 py-2 text-[13px] font-semibold border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/30"
                                />
                            </div>

                            {/* Financial Amounts Breakdown (Taxable, VAT 13%, Grand Total) */}
                            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700/80 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* Taxable Amount */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                                            Taxable Amount <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            placeholder="0.00"
                                            value={activeVerifyRow.taxableAmount}
                                            onChange={(e) => handleVerifyTaxableChange(e.target.value)}
                                            className="w-full px-3 py-2 text-[13px] font-mono font-bold border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/30"
                                        />
                                    </div>

                                    {/* VAT 13% (Auto) */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">
                                            Vat 13% (Auto)
                                        </label>
                                        <div className="px-3 py-2 text-[13px] font-mono font-bold bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50 rounded-lg">
                                            NPR {activeVerifyRow.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    {/* Grand Total (Auto) */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                                            Grand Total (Auto)
                                        </label>
                                        <div className="px-3 py-2 text-[13px] font-mono font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/50 rounded-lg">
                                            NPR {activeVerifyRow.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Remarks / Notes */}
                            <div className="space-y-1">
                                <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                                    Remarks / Verification Notes (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Verified with PDF received from Daraz support"
                                    value={activeVerifyRow.notes}
                                    onChange={(e) => setActiveVerifyRow(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                                    className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            {/* Lock Warning Note */}
                            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-2.5">
                                <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                                    <strong>Lock Protection:</strong> When locked as verified, this tax invoice will never be changed or overwritten by future API syncs. You can still reopen and update it manually at any time.
                                </p>
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2.5">
                                <div>
                                    {activeVerifyRow.isVerified && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={isSavingVerify}
                                            onClick={() => handleSaveVerifyModal(false)}
                                            className="px-3.5 text-xs font-bold text-amber-700 hover:bg-amber-50 border-amber-300 dark:text-amber-300 rounded-xl flex items-center gap-1.5"
                                        >
                                            <Unlock className="h-3.5 w-3.5" />
                                            Unlock / Revert
                                        </Button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsVerifyEditModalOpen(false)}
                                        className="px-4 text-[13px] font-semibold rounded-xl"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={isSavingVerify}
                                        onClick={() => handleSaveVerifyModal(true)}
                                        className="px-5 text-[13px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-1.5"
                                    >
                                        <Lock className="h-3.5 w-3.5" />
                                        {isSavingVerify ? 'Saving...' : 'Lock & Mark as Verified'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
