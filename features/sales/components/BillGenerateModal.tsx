'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    X, Zap, Calendar, Hash, DollarSign, Building2, TrendingUp,
    AlertTriangle, CheckCircle2, Trash2, Edit3, Save, ChevronDown,
    ChevronUp, RefreshCw, Check, SkipForward, Package
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getStockAnalysisData } from '@/features/stock-analysis/actions/stock-analysis-actions'
import { getCustomerNamesForDate } from '@/features/sales/actions/bill-generate-actions'
import {
    getNextNInvoiceNumbers,
    bulkCreateSalesBills,
    type CreateSalesBillParams,
    type SalesBillItem
} from '@/features/sales/actions/sales-bill-actions'
import { adToBS } from '@/lib/utils/date-converter'
import { useDashboard } from '@/app/dashboard/context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedBillItem {
    hs_code: string
    particulars: string
    quantity: number
    rate: number          // selling rate (no decimal)
    amount: number        // qty * rate (taxable)
    unit: string
    line_order: number
}

interface GeneratedBill {
    invoice_no: string
    bill_date_ad: string
    bill_date_bs: string
    seller_company_id: string
    customer_name: string
    customer_address: string
    customer_pan_vat: string
    items: GeneratedBillItem[]
    taxable_amount: number    // sum of item amounts
    vat_amount: number        // taxable * 0.13 (with decimals)
    total_amount: number      // taxable + vat (with decimals)
    sub_total_amount: number
}

interface BillGenerateModalProps {
    onClose: () => void
    frozenProducts?: Set<string>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Distribute a totalTaxableAmount across N bills randomly so their sum ≈ totalTaxableAmount.
 * Returns array of per-bill taxable targets.
 */
function randomDistribute(total: number, count: number): number[] {
    if (count === 1) return [total]
    const parts: number[] = []
    let remaining = total
    for (let i = 0; i < count - 1; i++) {
        // random between 30% and 70% of remaining portion
        const avg = remaining / (count - i)
        const variance = avg * 0.4
        const part = Math.max(50, avg - variance + Math.random() * variance * 2)
        parts.push(Math.round(part))
        remaining -= Math.round(part)
    }
    parts.push(Math.max(50, Math.round(remaining)))
    return parts
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BillGenerateModal({ onClose, frozenProducts = new Set() }: BillGenerateModalProps) {
    const { isCollapsed } = useDashboard()
    const queryClient = useQueryClient()

    // Step 1: Form fields
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
    const [billCount, setBillCount] = useState(5)
    const [totalAmountInput, setTotalAmountInput] = useState('')
    const [sellerId, setSellerId] = useState('')
    const [increaseRate, setIncreaseRate] = useState(10)

    // Step 1: Invoice suggestions
    const [suggestedInvoices, setSuggestedInvoices] = useState<string[]>([])
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false)

    // Step 1: Customer name flow
    const [customerNames, setCustomerNames] = useState<string[]>([])
    const [noOrdersWarning, setNoOrdersWarning] = useState(false)
    const [manualCustomerMode, setManualCustomerMode] = useState(false)
    const [manualCustomerName, setManualCustomerName] = useState('')
    const [isFetchingCustomers, setIsFetchingCustomers] = useState(false)

    // Step 2: Generated bills preview
    const [generatedBills, setGeneratedBills] = useState<GeneratedBill[]>([])
    const [editingBillIndex, setEditingBillIndex] = useState<number | null>(null)
    const [expandedBillIndex, setExpandedBillIndex] = useState<number | null>(null)

    // State
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const [saveSuccess, setSaveSuccess] = useState(false)

    // ── Data Queries ──────────────────────────────────────────────────────────

    const { data: sellers = [] } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    const { data: stockData = [] } = useQuery({
        queryKey: ['stock-analysis-all'],
        queryFn: () => getStockAnalysisData({ fiscalYearId: 'all' }),
    })

    // Set default seller
    useEffect(() => {
        if (sellers.length > 0 && !sellerId) {
            setSellerId(sellers[0].id)
        }
    }, [sellers])

    // ── Invoice suggestions ───────────────────────────────────────────────────

    useEffect(() => {
        if (!formDate || billCount < 1) return
        setIsFetchingSuggestions(true)
        getNextNInvoiceNumbers(formDate, billCount)
            .then(setSuggestedInvoices)
            .catch(console.error)
            .finally(() => setIsFetchingSuggestions(false))
    }, [formDate, billCount])

    // ── Customer names ────────────────────────────────────────────────────────

    const fetchCustomerNames = useCallback(async () => {
        if (!formDate) return
        setIsFetchingCustomers(true)
        setNoOrdersWarning(false)
        setManualCustomerMode(false)
        try {
            const names = await getCustomerNamesForDate(formDate)
            setCustomerNames(names)
            if (names.length === 0) {
                setNoOrdersWarning(true)
            }
        } catch (err) {
            console.error(err)
            setNoOrdersWarning(true)
        } finally {
            setIsFetchingCustomers(false)
        }
    }, [formDate])

    // ── Generation Algorithm ──────────────────────────────────────────────────

    const handleGenerate = async () => {
        setError('')

        if (!formDate) { setError('Please select a date'); return }
        if (billCount < 1 || billCount > 50) { setError('Bill count must be 1–50'); return }
        const totalAmt = parseFloat(totalAmountInput)
        if (isNaN(totalAmt) || totalAmt <= 0) { setError('Please enter a valid Total Amount'); return }
        if (!sellerId) { setError('Please select a Seller'); return }
        if (increaseRate < 0) { setError('Increase Rate cannot be negative'); return }

        // Determine which customer names to use
        const resolvedNames: string[] = manualCustomerMode
            ? [manualCustomerName.trim() || 'Cash Customer']
            : customerNames.length > 0
                ? customerNames
                : ['Cash Customer']

        // Filter eligible stock: running_stock > 0 and not frozen
        const eligibleStock = stockData.filter(s =>
            s.running_stock > 0 && !frozenProducts.has(s.particulars)
        )

        if (eligibleStock.length === 0) {
            setError('No available stock to generate bills from. Check Running Stock or frozen products.')
            return
        }

        if (suggestedInvoices.length < billCount) {
            setError('Could not find enough available invoice numbers. Try reducing bill count.')
            return
        }

        setIsGenerating(true)
        try {
            // Track cumulative qty used per product across all bills
            const usedQty: Map<string, number> = new Map()
            eligibleStock.forEach(s => usedQty.set(s.particulars, 0))

            const totalTaxable = totalAmt / 1.13
            const perBillTaxable = randomDistribute(totalTaxable, billCount)

            const bills: GeneratedBill[] = []

            for (let i = 0; i < billCount; i++) {
                const invoiceNo = suggestedInvoices[i]
                const customerName = pickRandom(resolvedNames)
                const targetTaxable = perBillTaxable[i]
                const billItems: GeneratedBillItem[] = []

                // Shuffle eligible stock for random product selection
                const shuffled = [...eligibleStock].sort(() => Math.random() - 0.5)
                let remainingTaxable = targetTaxable

                for (const product of shuffled) {
                    if (remainingTaxable <= 0) break

                    const alreadyUsed = usedQty.get(product.particulars) || 0
                    const availableQty = product.running_stock - alreadyUsed
                    if (availableQty <= 0) continue

                    // Selling rate = round(purchaseRate * (1 + increaseRate/100))
                    const purchaseRate = product.weighted_average_rate || 0
                    if (purchaseRate <= 0) continue
                    const sellingRate = Math.round(purchaseRate * (1 + increaseRate / 100))
                    if (sellingRate <= 0) continue

                    // How many qty can we fit in remaining taxable budget?
                    const maxQtyByBudget = Math.floor(remainingTaxable / sellingRate)
                    const qty = Math.min(maxQtyByBudget, availableQty)

                    if (qty <= 0) continue

                    const itemTaxable = qty * sellingRate
                    usedQty.set(product.particulars, alreadyUsed + qty)
                    remainingTaxable -= itemTaxable

                    billItems.push({
                        hs_code: product.hs_code || '',
                        particulars: product.particulars,
                        quantity: qty,
                        rate: sellingRate,
                        amount: itemTaxable,
                        unit: product.unit || 'Pcs',
                        line_order: billItems.length,
                    })

                    // Stop adding more products once we've covered the target reasonably
                    if (billItems.length >= 3) break
                }

                if (billItems.length === 0) continue

                const subTotal = billItems.reduce((s, it) => s + it.amount, 0)
                const vat = subTotal * 0.13
                const total = subTotal + vat

                bills.push({
                    invoice_no: invoiceNo,
                    bill_date_ad: formDate,
                    bill_date_bs: adToBS(formDate),
                    seller_company_id: sellerId,
                    customer_name: customerName,
                    customer_address: '',
                    customer_pan_vat: '',
                    items: billItems,
                    sub_total_amount: subTotal,
                    taxable_amount: subTotal,
                    vat_amount: vat,
                    total_amount: total,
                })
            }

            if (bills.length === 0) {
                setError('Could not generate any bills — insufficient stock or budget too small.')
                return
            }

            setGeneratedBills(bills)
            setExpandedBillIndex(0)
        } catch (err: any) {
            setError(err.message || 'Failed to generate bills')
        } finally {
            setIsGenerating(false)
        }
    }

    // ── Delete & Re-sequence ──────────────────────────────────────────────────

    const handleDeleteBill = (index: number) => {
        const updated = generatedBills.filter((_, i) => i !== index)
        // Re-sequence invoice numbers ascending
        const resequenced = updated.map((bill, i) => ({
            ...bill,
            invoice_no: suggestedInvoices[i] || String(i + 1).padStart(3, '0'),
        }))
        setGeneratedBills(resequenced)
        if (editingBillIndex === index) setEditingBillIndex(null)
        if (expandedBillIndex === index) setExpandedBillIndex(null)
    }

    // ── Edit Handlers ─────────────────────────────────────────────────────────

    const updateBillField = (billIdx: number, field: keyof GeneratedBill, value: any) => {
        setGeneratedBills(prev => {
            const next = [...prev]
            next[billIdx] = { ...next[billIdx], [field]: value }
            return next
        })
    }

    const updateBillItem = (billIdx: number, itemIdx: number, field: keyof GeneratedBillItem, value: any) => {
        setGeneratedBills(prev => {
            const next = [...prev]
            const items = [...next[billIdx].items]
            const item = { ...items[itemIdx], [field]: value }

            if (field === 'quantity' || field === 'rate') {
                item.quantity = field === 'quantity' ? (parseInt(value) || 0) : item.quantity
                item.rate = field === 'rate' ? (Math.round(parseFloat(value) || 0)) : item.rate
                item.amount = item.quantity * item.rate
            }
            items[itemIdx] = item

            // Recalculate bill totals
            const subTotal = items.reduce((s, it) => s + it.amount, 0)
            const vat = subTotal * 0.13
            next[billIdx] = {
                ...next[billIdx],
                items,
                sub_total_amount: subTotal,
                taxable_amount: subTotal,
                vat_amount: vat,
                total_amount: subTotal + vat,
            }
            return next
        })
    }

    const addItemToBill = (billIdx: number) => {
        setGeneratedBills(prev => {
            const next = [...prev]
            const items = [...next[billIdx].items, {
                hs_code: '',
                particulars: '',
                quantity: 1,
                rate: 0,
                amount: 0,
                unit: 'Pcs',
                line_order: next[billIdx].items.length,
            }]
            next[billIdx] = { ...next[billIdx], items }
            return next
        })
    }

    const removeItemFromBill = (billIdx: number, itemIdx: number) => {
        setGeneratedBills(prev => {
            const next = [...prev]
            const items = next[billIdx].items.filter((_, i) => i !== itemIdx)
            const subTotal = items.reduce((s, it) => s + it.amount, 0)
            const vat = subTotal * 0.13
            next[billIdx] = {
                ...next[billIdx],
                items,
                sub_total_amount: subTotal,
                taxable_amount: subTotal,
                vat_amount: vat,
                total_amount: subTotal + vat,
            }
            return next
        })
    }

    // ── Verify & Complete ─────────────────────────────────────────────────────

    const handleVerifyComplete = async () => {
        setError('')
        setIsSaving(true)
        try {
            const params: CreateSalesBillParams[] = generatedBills.map(bill => ({
                bill_date_ad: bill.bill_date_ad,
                bill_date_bs: bill.bill_date_bs,
                seller_company_id: bill.seller_company_id,
                invoice_no: bill.invoice_no,
                customer_name: bill.customer_name,
                customer_address: bill.customer_address,
                customer_pan_vat: bill.customer_pan_vat,
                sub_total_amount: bill.sub_total_amount,
                taxable_amount: bill.taxable_amount,
                vat_amount: bill.vat_amount,
                total_amount: bill.total_amount,
                items: bill.items.map((it, idx) => ({ ...it, line_order: idx })),
            }))

            await bulkCreateSalesBills(params)
            queryClient.invalidateQueries({ queryKey: ['sales-bills'] })
            queryClient.invalidateQueries({ queryKey: ['stock-analysis-all'] })
            setSaveSuccess(true)
            setTimeout(() => onClose(), 1500)
        } catch (err: any) {
            setError(err.message || 'Failed to save bills')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSkip = () => {
        setGeneratedBills([])
        setError('')
    }

    // ── Grand Total Summary ───────────────────────────────────────────────────

    const grandTotal = generatedBills.reduce((s, b) => s + b.total_amount, 0)
    const grandTaxable = generatedBills.reduce((s, b) => s + b.taxable_amount, 0)

    const sellerName = sellers.find(s => s.id === sellerId)?.company_name || ''

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className={`fixed inset-0 z-[110] overflow-y-auto bg-slate-50/98 dark:bg-zinc-950/98 backdrop-blur-md transition-all duration-300 ${isCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
            <div className="min-h-screen flex flex-col">

                {/* ── Header ── */}
                <div className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-100 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                            <Zap className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Bill Generate</h2>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Auto-generate multiple sales invoices from running stock</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl transition-all duration-200 hover:rotate-90"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 p-6 space-y-6 pb-10">

                    {/* ── Error Banner ── */}
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2.5 shadow-sm">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <span className="font-medium">{error}</span>
                            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                        </div>
                    )}

                    {/* ── Success Banner ── */}
                    {saveSuccess && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2.5">
                            <CheckCircle2 className="h-5 w-5 shrink-0" />
                            <span className="font-semibold">Bills saved successfully! Closing...</span>
                        </div>
                    )}

                    {/* ══════════ STEP 1: GENERATE FORM ══════════ */}
                    <div className="bg-white dark:bg-zinc-900/90 rounded-2xl border border-slate-100 dark:border-zinc-800/80 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                        <div className="flex items-center gap-2 mb-5">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">1</span>
                            <h3 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-zinc-300 uppercase">Generation Settings</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {/* Date */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Date (AD)</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Calendar className="h-4 w-4" /></span>
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={e => {
                                            setFormDate(e.target.value)
                                            setCustomerNames([])
                                            setNoOrdersWarning(false)
                                            setManualCustomerMode(false)
                                        }}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Bill Number (count) */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Bill Number (count)</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Hash className="h-4 w-4" /></span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={billCount}
                                        onChange={e => setBillCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 block">Number of bills to generate (1–50)</span>
                            </div>

                            {/* Total Amount */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Total Amount (Incl. VAT)</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><DollarSign className="h-4 w-4" /></span>
                                    <input
                                        type="number"
                                        min={1}
                                        placeholder="e.g. 5000"
                                        value={totalAmountInput}
                                        onChange={e => setTotalAmountInput(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                {totalAmountInput && !isNaN(parseFloat(totalAmountInput)) && (
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        ≈ Taxable: Rs.{(parseFloat(totalAmountInput) / 1.13).toFixed(2)} + VAT 13%
                                    </span>
                                )}
                            </div>

                            {/* Seller */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Seller (Our Company)</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Building2 className="h-4 w-4" /></span>
                                    <select
                                        value={sellerId}
                                        onChange={e => setSellerId(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none"
                                    >
                                        <option value="">Select Seller</option>
                                        {sellers.map(s => (
                                            <option key={s.id} value={s.id}>{s.company_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Increase Rate */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Increase Rate (%)</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><TrendingUp className="h-4 w-4" /></span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={500}
                                        step={0.5}
                                        placeholder="e.g. 10"
                                        value={increaseRate}
                                        onChange={e => setIncreaseRate(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                    Rate = round(Purchase Rate × {(1 + increaseRate / 100).toFixed(2)})
                                </span>
                            </div>
                        </div>

                        {/* Suggested Invoice Numbers */}
                        <div className="mt-5 p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-100 dark:border-zinc-700">
                            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                Available Invoice Numbers (Read-Only)
                            </p>
                            {isFetchingSuggestions ? (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <RefreshCw className="h-3 w-3 animate-spin" /> Fetching...
                                </div>
                            ) : suggestedInvoices.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {suggestedInvoices.map((inv, i) => (
                                        <span key={i} className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold rounded-lg border border-emerald-200 dark:border-emerald-800">
                                            {inv}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400">Select a date and bill count above</p>
                            )}
                        </div>

                        {/* Customer Name Section */}
                        <div className="mt-4">
                            {/* Fetch button */}
                            {!noOrdersWarning && !manualCustomerMode && customerNames.length === 0 && (
                                <button
                                    type="button"
                                    onClick={fetchCustomerNames}
                                    disabled={isFetchingCustomers || !formDate}
                                    className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {isFetchingCustomers ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                                    {isFetchingCustomers ? 'Checking orders...' : 'Check Customer Names from Orders'}
                                </button>
                            )}

                            {/* Found customers */}
                            {customerNames.length > 0 && !manualCustomerMode && (
                                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1.5">
                                        ✓ {customerNames.length} customer name{customerNames.length !== 1 ? 's' : ''} found for {formDate}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {customerNames.slice(0, 8).map((name, i) => (
                                            <span key={i} className="px-2 py-0.5 bg-white dark:bg-zinc-800 text-xs rounded-md text-slate-600 dark:text-zinc-300 border border-blue-100 dark:border-zinc-700">{name}</span>
                                        ))}
                                        {customerNames.length > 8 && (
                                            <span className="px-2 py-0.5 text-xs text-blue-500">+{customerNames.length - 8} more</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* No orders warning */}
                            {noOrdersWarning && !manualCustomerMode && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <span className="text-sm font-semibold">No Orders Found for {formDate}</span>
                                    </div>
                                    <p className="text-xs text-amber-600 dark:text-amber-500">No Daraz orders were found on this date. You can skip and pick a different date, or continue by entering a custom customer name.</p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setNoOrdersWarning(false); setFormDate('') }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 rounded-lg hover:bg-amber-50 dark:hover:bg-zinc-700 transition-colors text-amber-700 dark:text-amber-300"
                                        >
                                            <SkipForward className="h-3.5 w-3.5" /> Skip
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setManualCustomerMode(true); setNoOrdersWarning(false) }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                                        >
                                            <Edit3 className="h-3.5 w-3.5" /> Continue with Custom Name
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Manual name input */}
                            {manualCustomerMode && (
                                <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 flex flex-col gap-2">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Customer Name (for all bills)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Cash Customer"
                                        value={manualCustomerName}
                                        onChange={e => setManualCustomerName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Generate Button */}
                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={isGenerating || saveSuccess}
                                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                            >
                                {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                {isGenerating ? 'Generating...' : 'Generate Bills'}
                            </button>
                        </div>
                    </div>

                    {/* ══════════ STEP 2: PREVIEW LIST ══════════ */}
                    {generatedBills.length > 0 && (
                        <div className="bg-white dark:bg-zinc-900/90 rounded-2xl border border-slate-100 dark:border-zinc-800/80 shadow-sm overflow-hidden">
                            {/* Preview Header */}
                            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">2</span>
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Preview — {generatedBills.length} Bill{generatedBills.length !== 1 ? 's' : ''} Generated</h3>
                                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Review and edit before saving. You can delete individual bills or modify their items.</p>
                                    </div>
                                </div>
                                {/* Grand totals */}
                                <div className="hidden md:flex flex-col items-end gap-0.5">
                                    <span className="text-xs text-slate-400">Combined Total</span>
                                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Rs. {grandTotal.toFixed(2)}</span>
                                    <span className="text-xs text-slate-400">Taxable: Rs. {grandTaxable.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Bill Cards */}
                            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {generatedBills.map((bill, billIdx) => {
                                    const isExpanded = expandedBillIndex === billIdx
                                    const isEditing = editingBillIndex === billIdx
                                    return (
                                        <div key={billIdx} className={`transition-colors ${isEditing ? 'bg-indigo-50/50 dark:bg-indigo-950/10' : 'hover:bg-slate-50/50 dark:hover:bg-zinc-800/30'}`}>
                                            {/* Bill Row Header */}
                                            <div className="px-5 py-3.5 flex items-center gap-4">
                                                {/* Invoice badge */}
                                                <span className="shrink-0 px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-mono font-bold text-slate-600 dark:text-zinc-300">
                                                    #{bill.invoice_no}
                                                </span>

                                                {/* Customer (editable or display) */}
                                                <div className="flex-1 min-w-0">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={bill.customer_name}
                                                            onChange={e => updateBillField(billIdx, 'customer_name', e.target.value)}
                                                            className="w-full px-2.5 py-1 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                            placeholder="Customer Name"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300 truncate block">{bill.customer_name}</span>
                                                    )}
                                                </div>

                                                {/* Date */}
                                                <span className="hidden md:block text-xs text-slate-400">{bill.bill_date_ad}</span>

                                                {/* Amounts */}
                                                <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0">
                                                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">Rs. {bill.total_amount.toFixed(2)}</span>
                                                    <span className="text-[10px] text-slate-400">VAT: Rs. {bill.vat_amount.toFixed(2)}</span>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => setExpandedBillIndex(isExpanded ? null : billIdx)}
                                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                                        title={isExpanded ? 'Collapse' : 'Expand'}
                                                    >
                                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingBillIndex(isEditing ? null : billIdx)}
                                                        className={`p-1.5 rounded-lg transition-colors ${isEditing
                                                            ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                                                            : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20'
                                                            }`}
                                                        title={isEditing ? 'Done editing' : 'Edit bill'}
                                                    >
                                                        {isEditing ? <Save className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteBill(billIdx)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                                        title="Delete this bill"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded Items */}
                                            {isExpanded && (
                                                <div className="px-5 pb-4">
                                                    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left font-semibold">H.S Code</th>
                                                                    <th className="px-3 py-2 text-left font-semibold">Particulars</th>
                                                                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                                                                    <th className="px-3 py-2 text-right font-semibold">Unit</th>
                                                                    <th className="px-3 py-2 text-right font-semibold">Rate (Rs)</th>
                                                                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                                                                    {isEditing && <th className="px-3 py-2 text-right font-semibold">Del</th>}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                                                {bill.items.map((item, itemIdx) => (
                                                                    <tr key={itemIdx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                                                        <td className="px-3 py-2">
                                                                            {isEditing ? (
                                                                                <input type="text" value={item.hs_code} onChange={e => updateBillItem(billIdx, itemIdx, 'hs_code', e.target.value)} className="w-20 px-1.5 py-1 border border-slate-200 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                                                            ) : (item.hs_code || '-')}
                                                                        </td>
                                                                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-zinc-300">
                                                                            {isEditing ? (
                                                                                <input type="text" value={item.particulars} onChange={e => updateBillItem(billIdx, itemIdx, 'particulars', e.target.value)} className="w-40 px-1.5 py-1 border border-slate-200 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                                                            ) : item.particulars}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right">
                                                                            {isEditing ? (
                                                                                <input type="number" min={1} value={item.quantity} onChange={e => updateBillItem(billIdx, itemIdx, 'quantity', e.target.value)} className="w-16 px-1.5 py-1 border border-slate-200 dark:border-zinc-700 rounded text-xs text-right bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                                                            ) : item.quantity}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right text-slate-500">
                                                                            {isEditing ? (
                                                                                <input type="text" value={item.unit} onChange={e => updateBillItem(billIdx, itemIdx, 'unit', e.target.value)} className="w-16 px-1.5 py-1 border border-slate-200 dark:border-zinc-700 rounded text-xs text-right bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                                                            ) : item.unit}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right">
                                                                            {isEditing ? (
                                                                                <input type="number" min={0} value={item.rate} onChange={e => updateBillItem(billIdx, itemIdx, 'rate', e.target.value)} className="w-20 px-1.5 py-1 border border-slate-200 dark:border-zinc-700 rounded text-xs text-right bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                                                            ) : `Rs. ${item.rate}`}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-zinc-300">
                                                                            Rs. {item.amount.toFixed(0)}
                                                                        </td>
                                                                        {isEditing && (
                                                                            <td className="px-3 py-2 text-right">
                                                                                <button
                                                                                    onClick={() => removeItemFromBill(billIdx, itemIdx)}
                                                                                    disabled={bill.items.length <= 1}
                                                                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors disabled:opacity-30"
                                                                                >
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </button>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                            <tfoot className="bg-slate-50 dark:bg-zinc-800/60 text-xs font-semibold">
                                                                <tr>
                                                                    <td colSpan={isEditing ? 5 : 4} className="px-3 py-2 text-right text-slate-500">Taxable Amount:</td>
                                                                    <td className="px-3 py-2 text-right text-slate-700 dark:text-zinc-300">Rs. {bill.taxable_amount.toFixed(2)}</td>
                                                                    {isEditing && <td />}
                                                                </tr>
                                                                <tr>
                                                                    <td colSpan={isEditing ? 5 : 4} className="px-3 py-2 text-right text-slate-500">VAT 13%:</td>
                                                                    <td className="px-3 py-2 text-right text-orange-600 dark:text-orange-400">Rs. {bill.vat_amount.toFixed(2)}</td>
                                                                    {isEditing && <td />}
                                                                </tr>
                                                                <tr className="border-t border-slate-200 dark:border-zinc-700">
                                                                    <td colSpan={isEditing ? 5 : 4} className="px-3 py-2 text-right font-bold text-slate-700 dark:text-zinc-200">Total Amount:</td>
                                                                    <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">Rs. {bill.total_amount.toFixed(2)}</td>
                                                                    {isEditing && <td />}
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>

                                                    {isEditing && (
                                                        <button
                                                            type="button"
                                                            onClick={() => addItemToBill(billIdx)}
                                                            className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                                                        >
                                                            <span className="text-base leading-none">+</span> Add Item
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Grand Total Footer */}
                            <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border-t border-slate-100 dark:border-zinc-800 flex md:hidden flex-col gap-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Combined Taxable</span>
                                    <span className="font-semibold">Rs. {grandTaxable.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                                    <span>Grand Total (incl. VAT)</span>
                                    <span>Rs. {grandTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="p-5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-white dark:bg-zinc-900/80">
                                <button
                                    onClick={handleSkip}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    <X className="h-4 w-4" /> Skip / Discard All
                                </button>

                                <button
                                    onClick={handleVerifyComplete}
                                    disabled={isSaving || saveSuccess || generatedBills.length === 0}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                >
                                    {isSaving
                                        ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
                                        : <><Check className="h-4 w-4" /> Verify &amp; Complete ({generatedBills.length} bills)</>
                                    }
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
