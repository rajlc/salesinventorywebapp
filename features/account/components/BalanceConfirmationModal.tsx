'use client'

import { useState, useRef } from 'react'
import { X, Printer, Save, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adToBS } from '@/lib/utils/date-converter'
import {
    getBalanceConfirmationContext,
    saveBalanceConfirmation,
    setBalanceConfirmationVerified,
    type BalanceConfirmationContext,
} from '@/features/account/actions/balance-confirmation-actions'
import {
    BalanceConfirmationDocument,
    type BalanceConfirmationFormValues,
    computeBalanceTotals,
} from './BalanceConfirmationDocument'

const BS_MONTHS = [
    'Baisakh', 'Jestha', 'Ashad', 'Shrawan', 'Bhadra', 'Ashwin',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
]

function getLocalTodayAd(): string {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function deriveBsFiscalYearInfo(startDate?: string, endDate?: string, fallbackName?: string) {
    const todayAd = getLocalTodayAd()
    const todayBs = adToBS(todayAd)

    try {
        const startBs = startDate ? adToBS(startDate) : ''
        const endBs = endDate ? adToBS(endDate) : ''
        if (startBs && endBs) {
            const startYear = startBs.split('-')[0]
            const [endYear, endMonthStr] = endBs.split('-')
            const monthIdx = Math.max(0, Math.min(11, parseInt(endMonthStr, 10) - 1))
            const shortEndYear = endYear.slice(-2)
            return {
                bsFiscalYearLabel: `${startYear}/${shortEndYear}`,
                bsEndMonthYearLabel: `${BS_MONTHS[monthIdx] || 'Ashad'} ${endYear}`,
                defaultDateAd: todayAd,
                defaultDateBs: todayBs,
            }
        }
    } catch {
        // fallback below
    }
    return {
        bsFiscalYearLabel: fallbackName || '',
        bsEndMonthYearLabel: 'Ashad',
        defaultDateAd: todayAd,
        defaultDateBs: todayBs,
    }
}

interface BalanceConfirmationModalProps {
    supplierCompanyId: string | null
    supplierCompanyName: string | null
    buyerCompanyId: string | null
    buyerCompanyName: string | null
    supplierPanVat?: string | null
    buyerPanVat?: string | null
    fiscalYearId: string
    fiscalYearName?: string
    startDate?: string
    endDate?: string
    totalTaxableAmount: number
    totalVatAmount: number
    totalBillAmount: number
    totalChequeAmount: number
    onClose: () => void
}

export function BalanceConfirmationModal(props: BalanceConfirmationModalProps) {
    const {
        supplierCompanyId,
        supplierCompanyName,
        buyerCompanyId,
        buyerCompanyName,
        supplierPanVat,
        buyerPanVat,
        fiscalYearId,
        onClose,
    } = props

    const { data: context, isLoading } = useQuery({
        queryKey: ['balance-confirmation-context', supplierCompanyId, buyerCompanyId, fiscalYearId],
        queryFn: () =>
            getBalanceConfirmationContext({
                supplierCompanyId,
                buyerCompanyId,
                supplierCompanyName,
                buyerCompanyName,
                supplierPanVat,
                buyerPanVat,
                fiscalYearId,
            }),
    })

    if (isLoading || !context) {
        return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-[1320px] h-[94vh] flex flex-col overflow-hidden border dark:border-zinc-800">
                    <div className="px-5 py-3 border-b dark:border-zinc-800 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            Transaction &amp; Balance Confirmation
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            aria-label="Close modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-gray-500 gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading balance confirmation details...</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <BalanceConfirmationEditor
            key={`${supplierCompanyId}-${buyerCompanyId}-${fiscalYearId}-${context.confirmation?.id || 'new'}`}
            {...props}
            context={context}
        />
    )
}

function BalanceConfirmationEditor({
    supplierCompanyId,
    supplierCompanyName,
    buyerCompanyId,
    buyerCompanyName,
    supplierPanVat,
    buyerPanVat,
    fiscalYearId,
    fiscalYearName,
    startDate,
    endDate,
    totalTaxableAmount,
    totalVatAmount,
    totalBillAmount,
    totalChequeAmount,
    context,
    onClose,
}: BalanceConfirmationModalProps & { context: BalanceConfirmationContext }) {
    const queryClient = useQueryClient()
    const printContainerRef = useRef<HTMLDivElement | null>(null)
    const [showAdjustments, setShowAdjustments] = useState(false)

    const bsInfo = deriveBsFiscalYearInfo(startDate, endDate, fiscalYearName)
    const saved = context.confirmation
    const extra = saved?.extra_data || {}
    const isLoading = false

    const [values, setValues] = useState<BalanceConfirmationFormValues>({
        ourCompanyName: context.ourCompany.company_name || buyerCompanyName || '',
        ourCompanyAddress: context.ourCompany.address || '',
        ourCompanyPanVat: context.ourCompany.pan_vat_no || buyerPanVat || '',
        partyCompanyName: context.partyCompany.company_name || supplierCompanyName || '',
        partyAddress: saved?.party_address || context.partyCompany.address || 'KATHMANDU',
        partyPanVat: context.partyCompany.pan_vat_no || supplierPanVat || '',
        dateAd: bsInfo.defaultDateAd,
        dateBs: '',
        bsFiscalYearLabel: bsInfo.bsFiscalYearLabel,
        bsEndMonthYearLabel: bsInfo.bsEndMonthYearLabel,
        purchaseTaxable: totalTaxableAmount,
        purchaseVat: totalVatAmount,
        purchaseExempted: Number(saved?.exempted_amount ?? 0),
        purchaseReturnTaxable: Number(extra.purchaseReturnTaxable ?? 0),
        purchaseReturnVat: Number(extra.purchaseReturnVat ?? 0),
        purchaseReturnExempted: Number(extra.purchaseReturnExempted ?? 0),
        purchaseExpBrkTaxable: Number(extra.purchaseExpBrkTaxable ?? 0),
        purchaseExpBrkVat: Number(extra.purchaseExpBrkVat ?? 0),
        purchaseExpBrkExempted: Number(extra.purchaseExpBrkExempted ?? 0),
        debitNoteTaxable: Number(extra.debitNoteTaxable ?? 0),
        debitNoteVat: Number(extra.debitNoteVat ?? 0),
        debitNoteExempted: Number(extra.debitNoteExempted ?? 0),
        salesTaxable: Number(extra.salesTaxable ?? 0),
        salesVat: Number(extra.salesVat ?? 0),
        salesExempted: Number(extra.salesExempted ?? 0),
        salesReturnTaxable: Number(extra.salesReturnTaxable ?? 0),
        salesReturnVat: Number(extra.salesReturnVat ?? 0),
        salesReturnExempted: Number(extra.salesReturnExempted ?? 0),
        salesExpBrkTaxable: Number(extra.salesExpBrkTaxable ?? 0),
        salesExpBrkVat: Number(extra.salesExpBrkVat ?? 0),
        salesExpBrkExempted: Number(extra.salesExpBrkExempted ?? 0),
        creditNoteTaxable: Number(extra.creditNoteTaxable ?? 0),
        creditNoteVat: Number(extra.creditNoteVat ?? 0),
        creditNoteExempted: Number(extra.creditNoteExempted ?? 0),
        openingBalance: Number(saved?.opening_balance ?? 0),
        openingBalanceType: (saved?.opening_balance_type as 'Dr' | 'Cr') || 'Cr',
        closingBalance: Number(saved?.closing_balance ?? 0),
        closingBalanceType: (saved?.closing_balance_type as 'Dr' | 'Cr') || 'Cr',
    })

    const [isVerified, setIsVerified] = useState(Boolean(saved?.is_verified))

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['balance-confirmation-context', supplierCompanyId, buyerCompanyId, fiscalYearId] })
        queryClient.invalidateQueries({ queryKey: ['purchase-billing-detail'] })
        queryClient.invalidateQueries({ queryKey: ['purchase-billing-report'] })
    }

    const saveMutation = useMutation({
        mutationFn: async (verifiedOverride?: boolean) => {
            const totals = computeBalanceTotals(values)
            return saveBalanceConfirmation({
                supplierCompanyId,
                buyerCompanyId,
                fiscalYearId,
                supplierCompanyName: values.partyCompanyName,
                buyerCompanyName: values.ourCompanyName,
                partyAddress: values.partyAddress,
                letterDateAd: values.dateAd,
                letterDateBs: values.dateBs,
                taxableAmount: totals.purchaseTotalTaxable,
                vatAmount: totals.purchaseTotalVat,
                exemptedAmount: values.purchaseExempted,
                totalBillAmount,
                openingBalance: values.openingBalance,
                openingBalanceType: values.openingBalanceType,
                closingBalance: values.closingBalance,
                closingBalanceType: values.closingBalanceType,
                extraData: {
                    purchaseReturnTaxable: values.purchaseReturnTaxable,
                    purchaseReturnVat: values.purchaseReturnVat,
                    purchaseReturnExempted: values.purchaseReturnExempted,
                    purchaseExpBrkTaxable: values.purchaseExpBrkTaxable,
                    purchaseExpBrkVat: values.purchaseExpBrkVat,
                    purchaseExpBrkExempted: values.purchaseExpBrkExempted,
                    debitNoteTaxable: values.debitNoteTaxable,
                    debitNoteVat: values.debitNoteVat,
                    debitNoteExempted: values.debitNoteExempted,
                    salesTaxable: values.salesTaxable,
                    salesVat: values.salesVat,
                    salesExempted: values.salesExempted,
                    salesReturnTaxable: values.salesReturnTaxable,
                    salesReturnVat: values.salesReturnVat,
                    salesReturnExempted: values.salesReturnExempted,
                    salesExpBrkTaxable: values.salesExpBrkTaxable,
                    salesExpBrkVat: values.salesExpBrkVat,
                    salesExpBrkExempted: values.salesExpBrkExempted,
                    creditNoteTaxable: values.creditNoteTaxable,
                    creditNoteVat: values.creditNoteVat,
                    creditNoteExempted: values.creditNoteExempted,
                },
                isVerified: typeof verifiedOverride === 'boolean' ? verifiedOverride : undefined,
            })
        },
        onSuccess: (saved) => {
            setIsVerified(Boolean(saved.is_verified))
            invalidateAll()
            toast.success('Balance confirmation saved')
        },
        onError: () => {
            toast.error('Failed to save balance confirmation')
        },
    })

    const verifyMutation = useMutation({
        mutationFn: async (nextVerified: boolean) => {
            return setBalanceConfirmationVerified({
                supplierCompanyId,
                buyerCompanyId,
                fiscalYearId,
                supplierCompanyName: values.partyCompanyName,
                buyerCompanyName: values.ourCompanyName,
                taxableAmount: totalTaxableAmount,
                vatAmount: totalVatAmount,
                totalBillAmount,
                isVerified: nextVerified,
            })
        },
        onSuccess: (saved) => {
            setIsVerified(Boolean(saved.is_verified))
            invalidateAll()
            toast.success(
                saved.is_verified
                    ? 'Balance Confirmation marked as Verified!'
                    : 'Balance Confirmation marked as Unverified'
            )
        },
        onError: () => {
            toast.error('Failed to update verification status')
        },
    })

    const handleDateAdChange = (newAd: string) => {
        setValues((prev) => ({
            ...prev,
            dateAd: newAd,
        }))
    }

    const handleNumChange = (field: keyof BalanceConfirmationFormValues, raw: string) => {
        const parsed = parseFloat(raw)
        setValues((prev) => ({
            ...prev,
            [field]: Number.isFinite(parsed) ? parsed : 0,
        }))
    }

    const handleSuggestClosing = () => {
        const net = totalBillAmount - totalChequeAmount
        setValues((prev) => ({
            ...prev,
            closingBalance: Math.abs(Number(net.toFixed(2))),
            closingBalanceType: net >= 0 ? 'Cr' : 'Dr',
        }))
    }

    const handlePrint = async () => {
        // Save silently before printing so edits (like party address & balances) persist
        try {
            await saveMutation.mutateAsync(undefined)
        } catch {
            // Continue printing even if save fails
        }

        const contentEl = printContainerRef.current
        if (!contentEl) return

        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        document.body.appendChild(iframe)

        const doc = iframe.contentWindow?.document
        if (!doc) {
            document.body.removeChild(iframe)
            return
        }

        doc.open()
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Balance Confirmation - ${values.partyCompanyName || 'Party'} (${values.bsFiscalYearLabel})</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .print-wrapper > div {
                        border: none !important;
                        box-shadow: none !important;
                        margin: 0 auto !important;
                        min-height: 290mm !important;
                    }
                </style>
            </head>
            <body>
                <div class="print-wrapper">${contentEl.innerHTML}</div>
            </body>
            </html>
        `)
        doc.close()

        setTimeout(() => {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe)
                }
            }, 1000)
        }, 250)
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-[1320px] h-[94vh] flex flex-col overflow-hidden border dark:border-zinc-800">
                {/* Top Header */}
                <div className="px-5 py-3 border-b dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                Transaction &amp; Balance Confirmation
                            </h2>
                            {isVerified && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Verified
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Party: <span className="font-medium text-gray-700 dark:text-gray-300">{values.partyCompanyName}</span> • F/Y {values.bsFiscalYearLabel} ({fiscalYearName})
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => saveMutation.mutate(undefined)}
                            disabled={saveMutation.isPending || isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
                        >
                            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save Draft
                        </button>

                        <button
                            onClick={() => verifyMutation.mutate(!isVerified)}
                            disabled={verifyMutation.isPending || isLoading}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
                                isVerified
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                        >
                            {verifyMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            {isVerified ? 'Confirmed (Verified)' : 'Confirm from Party (Verify)'}
                        </button>

                        <button
                            onClick={handlePrint}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Print / Save PDF
                        </button>

                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            aria-label="Close modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Split Body */}
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading balance confirmation details...</span>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                        {/* Left Editor Panel */}
                        <div className="w-full lg:w-[340px] xl:w-[370px] border-b lg:border-b-0 lg:border-r dark:border-zinc-800 overflow-y-auto p-4 space-y-4 bg-gray-50/70 dark:bg-zinc-900/60">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                    Letter Details
                                </h3>
                                <div className="space-y-2.5">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Party Address
                                        </label>
                                        <input
                                            type="text"
                                            value={values.partyAddress}
                                            onChange={(e) => setValues((p) => ({ ...p, partyAddress: e.target.value }))}
                                            placeholder="e.g. KATHMANDU"
                                            className="w-full px-2.5 py-1.5 text-xs border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Date (AD)
                                        </label>
                                        <input
                                            type="date"
                                            value={values.dateAd}
                                            onChange={(e) => handleDateAdChange(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                BS Fiscal Year
                                            </label>
                                            <input
                                                type="text"
                                                value={values.bsFiscalYearLabel}
                                                onChange={(e) => setValues((p) => ({ ...p, bsFiscalYearLabel: e.target.value }))}
                                                placeholder="2082/83"
                                                className="w-full px-2 py-1.5 text-xs border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Period End Label
                                            </label>
                                            <input
                                                type="text"
                                                value={values.bsEndMonthYearLabel}
                                                onChange={(e) => setValues((p) => ({ ...p, bsEndMonthYearLabel: e.target.value }))}
                                                placeholder="Ashad 2083"
                                                className="w-full px-2 py-1.5 text-xs border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Opening & Closing Balances */}
                            <div className="pt-2 border-t dark:border-zinc-800">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        Opening &amp; Closing Balance
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleSuggestClosing}
                                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                                        title="Auto-calculate Closing Balance from Total Bills minus Linked Cheques"
                                    >
                                        Auto-fill Net
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Opening Balance
                                        </label>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={values.openingBalance}
                                                onChange={(e) => handleNumChange('openingBalance', e.target.value)}
                                                className="flex-1 px-2.5 py-1.5 text-xs border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <select
                                                value={values.openingBalanceType}
                                                onChange={(e) => setValues((p) => ({ ...p, openingBalanceType: e.target.value as 'Dr' | 'Cr' }))}
                                                className="w-16 px-2 py-1.5 text-xs border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                            >
                                                <option value="Cr">Cr</option>
                                                <option value="Dr">Dr</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Closing Balance
                                        </label>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={values.closingBalance}
                                                onChange={(e) => handleNumChange('closingBalance', e.target.value)}
                                                className="flex-1 px-2.5 py-1.5 text-xs border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <select
                                                value={values.closingBalanceType}
                                                onChange={(e) => setValues((p) => ({ ...p, closingBalanceType: e.target.value as 'Dr' | 'Cr' }))}
                                                className="w-16 px-2 py-1.5 text-xs border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                            >
                                                <option value="Cr">Cr</option>
                                                <option value="Dr">Dr</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Optional Adjustments (Returns / Notes / Sales) */}
                            <div className="pt-2 border-t dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowAdjustments((prev) => !prev)}
                                    className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 py-1"
                                >
                                    <span>Optional Table Adjustments</span>
                                    {showAdjustments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>

                                {showAdjustments && (
                                    <div className="mt-2.5 space-y-3 text-xs">
                                        <div>
                                            <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Purchase Exempted
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={values.purchaseExempted}
                                                onChange={(e) => handleNumChange('purchaseExempted', e.target.value)}
                                                className="w-full px-2.5 py-1.5 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Pur. Return Taxable
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={values.purchaseReturnTaxable}
                                                    onChange={(e) => handleNumChange('purchaseReturnTaxable', e.target.value)}
                                                    className="w-full px-2 py-1.5 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Pur. Return VAT
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={values.purchaseReturnVat}
                                                    onChange={(e) => handleNumChange('purchaseReturnVat', e.target.value)}
                                                    className="w-full px-2 py-1.5 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Debit Note Taxable
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={values.debitNoteTaxable}
                                                    onChange={(e) => handleNumChange('debitNoteTaxable', e.target.value)}
                                                    className="w-full px-2 py-1.5 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Debit Note VAT
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={values.debitNoteVat}
                                                    onChange={(e) => handleNumChange('debitNoteVat', e.target.value)}
                                                    className="w-full px-2 py-1.5 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t dark:border-zinc-800">
                                            <div>
                                                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Sales Taxable
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={values.salesTaxable}
                                                    onChange={(e) => handleNumChange('salesTaxable', e.target.value)}
                                                    className="w-full px-2 py-1.5 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Sales VAT
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={values.salesVat}
                                                    onChange={(e) => handleNumChange('salesVat', e.target.value)}
                                                    className="w-full px-2 py-1.5 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Live A4 Preview */}
                        <div className="flex-1 overflow-auto bg-gray-200/80 dark:bg-zinc-950 p-4 md:p-6">
                            <div ref={printContainerRef} className="w-fit mx-auto">
                                <BalanceConfirmationDocument values={values} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
