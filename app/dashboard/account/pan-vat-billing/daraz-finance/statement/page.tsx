'use client'

import React, { Suspense, useState, useEffect, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft,
    Printer,
    Receipt,
    RefreshCw,
    Loader2,
    Info,
    Wifi,
    WifiOff
} from 'lucide-react'
import { Card, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, Button } from '@/components/ui-shim'
import { fetchDarazStatementLineItems, syncDarazFinances } from '@/features/sales/actions/daraz-finance-service'
import { getStatementBreakdown } from '../../daraz-finance-card'
import { toast } from 'sonner'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Static Fallback Breakdown (formula-based) ────────────────────────────────
function StaticBreakdown({ b }: { b: ReturnType<typeof getStatementBreakdown> }) {
    const rows: Array<{
        type: string
        name: string
        amount: number
        isSubtotal?: boolean
        bg?: string
        color?: string
    }> = [
        { type: 'Opening Balance', name: '', amount: 0, isSubtotal: true, bg: 'bg-gray-50/40 dark:bg-zinc-800/20', color: '' },
        { type: 'Delivered Orders', name: 'Subtotal', amount: b.deliveredSubtotal, isSubtotal: true, bg: 'bg-blue-50/40 dark:bg-blue-950/30', color: 'text-gray-900 dark:text-gray-100' },
        { type: '', name: 'Shipping Fee Paid by Buyer', amount: b.shipPaidByBuyer, bg: '', color: 'text-gray-700 dark:text-gray-300' },
        { type: '', name: 'Product Price Paid by Buyer', amount: b.prodPricePaidByBuyer, bg: '', color: 'text-gray-800 dark:text-gray-200' },
        { type: '', name: 'Co-funded Voucher Max', amount: b.coFundedVoucher, bg: '', color: b.coFundedVoucher < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300' },
        { type: 'Transaction Fees', name: 'Subtotal', amount: b.transactionFeesSubtotal, isSubtotal: true, bg: 'bg-rose-50/40 dark:bg-rose-950/30', color: 'text-rose-700 dark:text-rose-400' },
        { type: '', name: 'Payment Fee', amount: b.paymentFee, bg: '', color: 'text-red-600 dark:text-red-400' },
        { type: '', name: 'Commission Fee', amount: b.commissionFee, bg: '', color: 'text-red-600 dark:text-red-400' },
        { type: '', name: 'Shipping Fee', amount: b.shippingFee, bg: '', color: 'text-red-600 dark:text-red-400' },
        { type: '', name: 'Shipping Fee Discount', amount: b.shippingFeeDiscount, bg: '', color: 'text-emerald-600 dark:text-emerald-400' },
        { type: '', name: 'Free Shipping Max Fee', amount: b.freeShippingMaxFee, bg: '', color: 'text-red-600 dark:text-red-400' },
        { type: '', name: 'Daraz Coins Discount Participation Fee', amount: b.coinsFee, bg: '', color: 'text-red-600 dark:text-red-400' },
        { type: 'Returned Orders', name: 'Subtotal', amount: b.returnedOrdersSubtotal, isSubtotal: true, bg: 'bg-amber-50/40 dark:bg-amber-950/30', color: 'text-amber-700 dark:text-amber-400' },
        { type: '', name: 'Product Price Refunded to Buyer', amount: b.returnedProdPrice, bg: '', color: 'text-red-600 dark:text-red-400' },
        { type: '', name: 'Co-funded Voucher Max Reversal', amount: b.voucherReversal, bg: '', color: 'text-emerald-600 dark:text-emerald-400' },
        { type: 'Withholding', name: 'Subtotal', amount: b.withholdingSubtotal, isSubtotal: true, bg: 'bg-red-50/40 dark:bg-red-950/30', color: 'text-red-700 dark:text-red-400' },
        { type: '', name: 'General Sales Tax Withholding', amount: b.gstDebit, bg: '', color: 'text-red-600 dark:text-red-400' },
        ...(b.gstCredit !== 0 ? [{ type: '', name: 'General Sales Tax Withholding (Credit)', amount: b.gstCredit, bg: '', color: 'text-emerald-600 dark:text-emerald-400' }] : []),
        { type: 'Logistics & Fulfillment Services', name: 'Subtotal', amount: b.logisticsSubtotal, isSubtotal: true, bg: 'bg-gray-50/50 dark:bg-zinc-800/30', color: 'text-red-700 dark:text-red-400' },
        { type: '', name: 'Handling Fee', amount: b.handlingFee, bg: '', color: 'text-red-600 dark:text-red-400' },
        { type: '', name: 'Merchant Managed Services Charge', amount: b.merchantCharge, bg: '', color: 'text-red-600 dark:text-red-400' },
        ...(b.returnHandlingFee !== 0 ? [{ type: '', name: 'Handling Fee for Return', amount: b.returnHandlingFee, bg: '', color: 'text-red-600 dark:text-red-400' }] : []),
        { type: 'Transaction Fees Refunded', name: 'Subtotal', amount: b.refundedFeesSubtotal, isSubtotal: true, bg: 'bg-emerald-50/40 dark:bg-emerald-950/30', color: 'text-emerald-700 dark:text-emerald-400' },
        { type: '', name: 'Payment Fee Refunded', amount: b.paymentFeeRefunded, bg: '', color: 'text-emerald-600 dark:text-emerald-400' },
        { type: '', name: 'Commission Fee Refunded', amount: b.commissionRefunded, bg: '', color: 'text-emerald-600 dark:text-emerald-400' },
        { type: '', name: 'Reversal of Free Shipping Max Fee', amount: b.freeShipRefunded, bg: '', color: 'text-emerald-600 dark:text-emerald-400' },
        ...(b.coinsFeeRefunded !== 0 ? [{ type: '', name: 'Reversal of DARAZ Coins Discount Participation Fee', amount: b.coinsFeeRefunded, bg: '', color: 'text-emerald-600 dark:text-emerald-400' }] : []),
    ]

    return (
        <TableBody className="text-xs leading-normal divide-y divide-gray-100 dark:divide-zinc-800/70">
            {rows.map((row, idx) => (
                <TableRow key={idx} className={`${row.bg || 'hover:bg-gray-50/50 dark:hover:bg-zinc-800/30'}`}>
                    <TableCell className={`py-1.5 px-3.5 ${row.isSubtotal ? 'font-semibold text-gray-900 dark:text-gray-100' : ''}`}>
                        {row.isSubtotal ? row.type : ''}
                    </TableCell>
                    <TableCell className={`py-1.5 px-3.5 ${!row.isSubtotal ? 'pl-7 text-gray-600 dark:text-gray-300 font-normal' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>
                        {row.isSubtotal ? (row.type === 'Opening Balance' ? '' : 'Subtotal') : row.name}
                    </TableCell>
                    <TableCell className={`py-1.5 px-3.5 text-right font-mono ${row.isSubtotal ? `font-semibold ${row.color}` : `font-medium ${row.color}`}`}>
                        {row.amount < 0 ? '-' : ''}NPR {fmt(Math.abs(row.amount))}
                    </TableCell>
                </TableRow>
            ))}
            {/* Closing Balance */}
            <TableRow className="bg-blue-50 dark:bg-blue-950/60 font-semibold text-xs sm:text-sm border-t-2 border-blue-300 dark:border-blue-700">
                <TableCell className="py-2.5 px-3.5 font-bold text-blue-900 dark:text-blue-100">Closing Balance (Released Amount)</TableCell>
                <TableCell className="py-2.5 px-3.5" />
                <TableCell className="py-2.5 px-3.5 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                    NPR {fmt(b.netClosingCalc)}
                </TableCell>
            </TableRow>
        </TableBody>
    )
}

// ─── Dynamic API Breakdown ────────────────────────────────────────────────────
function ApiBreakdown({ grouped, closingBalance }: { grouped: Record<string, Array<{ feeName: string; amount: number }>>; closingBalance: number }) {
    const OFFICIAL_CATEGORY_ORDER = [
        'Delivered Orders',
        'Transaction Fees',
        'Delivered Orders Marked Delivery Failed',
        'Returned Orders',
        'Withholding',
        'Logistics & Fulfillment Services',
        'Transaction Fees Refunded'
    ]

    const FIELD_ORDER: Record<string, string[]> = {
        'Delivered Orders': [
            'Shipping Fee Paid by Buyer',
            'Product Price Paid by Buyer',
            'Co-funded Voucher Max'
        ],
        'Transaction Fees': [
            'Payment Fee',
            'Commission Fee',
            'Shipping Fee',
            'Shipping Fee Discount',
            'Free Shipping Max Fee',
            'Daraz Coins Discount Participation Fee'
        ],
        'Delivered Orders Marked Delivery Failed': [
            'Shipping Fee'
        ],
        'Returned Orders': [
            'Product Price Refunded to Buyer',
            'Co-funded Voucher Max Reversal'
        ],
        'Withholding': [
            'General Sales Tax Withholding'
        ],
        'Logistics & Fulfillment Services': [
            'Handling Fee',
            'Merchant Managed Services Charge',
            'Handling Fee for Return'
        ],
        'Transaction Fees Refunded': [
            'Payment Fee Refunded',
            'Commission Fee Refunded',
            'Reversal of Free Shipping Max Fee',
            'Reversal of DARAZ Coins Discount Participation Fee'
        ]
    }

    // Sort categories: standard first in order, followed by any additional extra categories at the bottom
    const allGroupKeys = Object.keys(grouped).filter(k => (grouped[k] || []).length > 0).sort((a, b) => {
        const idxA = OFFICIAL_CATEGORY_ORDER.indexOf(a)
        const idxB = OFFICIAL_CATEGORY_ORDER.indexOf(b)
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
    })

    return (
        <TableBody className="text-xs leading-normal divide-y divide-gray-100 dark:divide-zinc-800/70">
            {/* Opening Balance */}
            <TableRow className="bg-gray-50/40 dark:bg-zinc-800/20">
                <TableCell className="py-1.5 px-3.5 font-semibold text-gray-900 dark:text-gray-100">Opening Balance</TableCell>
                <TableCell className="py-1.5 px-3.5" />
                <TableCell className="py-1.5 px-3.5 text-right font-mono font-medium text-gray-700 dark:text-gray-300">NPR 0.00</TableCell>
            </TableRow>

            {allGroupKeys.map((groupType) => {
                const rawItems = grouped[groupType] || []
                const groupTotal = rawItems.reduce((s, v) => s + v.amount, 0)
                const isPositive = groupTotal >= 0

                const rowBg =
                    groupType === 'Delivered Orders' ? 'bg-blue-50/40 dark:bg-blue-950/30' :
                    groupType === 'Transaction Fees' ? 'bg-rose-50/40 dark:bg-rose-950/30' :
                    groupType === 'Delivered Orders Marked Delivery Failed' ? 'bg-red-50/40 dark:bg-red-950/30' :
                    groupType === 'Returned Orders' ? 'bg-amber-50/40 dark:bg-amber-950/30' :
                    groupType === 'Withholding' ? 'bg-red-50/40 dark:bg-red-950/30' :
                    groupType === 'Logistics & Fulfillment Services' ? 'bg-gray-50/50 dark:bg-zinc-800/30' :
                    groupType === 'Transaction Fees Refunded' ? 'bg-emerald-50/40 dark:bg-emerald-950/30' :
                    'bg-purple-50/40 dark:bg-purple-950/30'

                const totalColor = isPositive ? 'text-gray-900 dark:text-gray-100' : 'text-rose-700 dark:text-rose-400'

                // Sort fields according to official Daraz Seller Center field sequence
                const orderList = FIELD_ORDER[groupType] || []
                const sortedItems = [...rawItems].filter(item => item.amount !== 0).sort((a, b) => {
                    const idxA = orderList.indexOf(a.feeName)
                    const idxB = orderList.indexOf(b.feeName)
                    if (idxA !== -1 && idxB !== -1) {
                        if (idxA === idxB) {
                            return a.amount - b.amount
                        }
                        return idxA - idxB
                    }
                    if (idxA !== -1) return -1
                    if (idxB !== -1) return 1
                    return 0
                })

                return (
                    <React.Fragment key={groupType}>
                        <TableRow className={`${rowBg}`}>
                            <TableCell className="py-1.5 px-3.5 font-semibold text-gray-900 dark:text-gray-100">{groupType}</TableCell>
                            <TableCell className="py-1.5 px-3.5 text-gray-700 dark:text-gray-300 font-semibold">Subtotal</TableCell>
                            <TableCell className={`py-1.5 px-3.5 text-right font-mono font-semibold ${totalColor}`}>
                                {groupTotal < 0 ? '-' : ''}NPR {fmt(Math.abs(groupTotal))}
                            </TableCell>
                        </TableRow>
                        {sortedItems.map((item, itemIdx) => (
                            <TableRow key={`${item.feeName}-${itemIdx}`} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 text-gray-600 dark:text-gray-300">
                                <TableCell className="py-1 px-3.5" />
                                <TableCell className="py-1 px-3.5 pl-7 font-normal">{item.feeName}</TableCell>
                                <TableCell className={`py-1 px-3.5 text-right font-mono font-medium ${item.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                    {item.amount < 0 ? '-' : ''}NPR {fmt(Math.abs(item.amount))}
                                </TableCell>
                            </TableRow>
                        ))}
                    </React.Fragment>
                )
            })}

            {/* Closing Balance */}
            <TableRow className="bg-blue-50 dark:bg-blue-950/60 font-semibold text-xs sm:text-sm border-t-2 border-blue-300 dark:border-blue-700">
                <TableCell className="py-2.5 px-3.5 font-bold text-blue-900 dark:text-blue-100">Closing Balance (Released Amount)</TableCell>
                <TableCell className="py-2.5 px-3.5" />
                <TableCell className="py-2.5 px-3.5 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                    NPR {fmt(closingBalance)}
                </TableCell>
            </TableRow>
        </TableBody>
    )
}

// ─── Tax Confirmation Panel ───────────────────────────────────────────────────
function TaxPanel({ b, fromApi, grouped }: {
    b: ReturnType<typeof getStatementBreakdown>
    fromApi: boolean
    grouped: Record<string, Array<{ feeName: string; amount: number }>>
}) {
    // Helper to find fee amount from API grouped structure (exact match first)
    const findFee = (searchName: string) => {
        const query = searchName.toLowerCase().trim()
        // 1. Prioritize exact feeName match
        for (const cat of Object.keys(grouped)) {
            for (const item of (grouped[cat] || [])) {
                if (item.feeName.toLowerCase().trim() === query) {
                    return Math.abs(item.amount)
                }
            }
        }
        // 2. Fallback to partial match only if no exact match found
        for (const cat of Object.keys(grouped)) {
            for (const item of (grouped[cat] || [])) {
                if (item.feeName.toLowerCase().trim().includes(query)) {
                    return Math.abs(item.amount)
                }
            }
        }
        return 0
    }

    // 1. Co Funded Voucher Max: (Co-funded Voucher max - Cofunded Voucher Max Reversal)
    const voucherCharge = fromApi ? findFee('Co-funded Voucher Max') : Math.abs(b.coFundedVoucher)
    const voucherRefund = fromApi ? findFee('Co-funded Voucher Max Reversal') : Math.abs(b.voucherReversal)
    const voucherNet = Math.round((voucherCharge - voucherRefund) * 100) / 100

    // 2. Payment Fees: (Payment Fee - Payment Fee Refunded)
    const paymentCharge = fromApi ? findFee('Payment Fee') : Math.abs(b.paymentFee)
    const paymentRefund = fromApi ? findFee('Payment Fee Refunded') : Math.abs(b.paymentFeeRefunded)
    const paymentNet = Math.round((paymentCharge - paymentRefund) * 100) / 100

    // 3. Commission Fee: (Commission Fee - Commission fee Refunded)
    const commCharge = fromApi ? findFee('Commission Fee') : Math.abs(b.commissionFee)
    const commRefund = fromApi ? findFee('Commission Fee Refunded') : Math.abs(b.commissionRefunded)
    const commNet = Math.round((commCharge - commRefund) * 100) / 100

    // 4. Daraz Coins Discount Participation Fee: (Daraz Coins Discount Participation Fee - Reversal of DARAZ Coins Discount Participation Fee)
    const coinsCharge = fromApi ? findFee('Daraz Coins Discount Participation Fee') : Math.abs(b.coinsFee)
    const coinsRefund = fromApi ? findFee('Reversal of DARAZ Coins Discount Participation Fee') : Math.abs(b.coinsFeeRefunded)
    const coinsNet = Math.round((coinsCharge - coinsRefund) * 100) / 100

    // 5. Handling Fee: (Handling Fee + Handling Fee for Return)
    const handlingCharge = fromApi ? findFee('Handling Fee') : Math.abs(b.handlingFee)
    const returnHandlingCharge = fromApi ? findFee('Handling Fee for Return') : Math.abs(b.returnHandlingFee)
    const handlingNet = Math.round((handlingCharge + returnHandlingCharge) * 100) / 100

    // 6. Merchant Managed Services Charge: (Merchant Managed Services Charge)
    const merchantCharge = fromApi ? findFee('Merchant Managed Services Charge') : Math.abs(b.merchantCharge)
    const merchantNet = Math.round(merchantCharge * 100) / 100

    // Strict list of ONLY the 6 allowed Tax Invoices
    const rawInvoices = [
        {
            title: 'Tax Invoice — Co Funded Voucher Max',
            items: [
                ['Co-funded Voucher Max', voucherCharge],
                ...(voucherRefund > 0 ? [['Co-funded Voucher Max Reversal', -voucherRefund]] : [])
            ] as [string, number][],
            netAmt: voucherNet
        },
        {
            title: 'Tax Invoice - Payment Fees',
            items: [
                ['Payment Fee', paymentCharge],
                ...(paymentRefund > 0 ? [['Payment Fee Refunded', -paymentRefund]] : [])
            ] as [string, number][],
            netAmt: paymentNet
        },
        {
            title: 'Tax Invoice - Commission Fee',
            items: [
                ['Commission Fee', commCharge],
                ...(commRefund > 0 ? [['Commission Fee Refunded', -commRefund]] : [])
            ] as [string, number][],
            netAmt: commNet
        },
        {
            title: 'Tax Invoice - Daraz Coins Discount Participation Fee',
            items: [
                ['Daraz Coins Discount Participation Fee', coinsCharge],
                ...(coinsRefund > 0 ? [['Reversal of DARAZ Coins Discount Participation Fee', -coinsRefund]] : [])
            ] as [string, number][],
            netAmt: coinsNet
        },
        {
            title: 'Tax Invoice - Handling Fee',
            items: [
                ['Handling Fee', handlingCharge],
                ...(returnHandlingCharge > 0 ? [['Handling Fee for Return', returnHandlingCharge]] : [])
            ] as [string, number][],
            netAmt: handlingNet
        },
        {
            title: 'Tax Invoice - Merchant Managed Services Charge',
            items: [
                ['Merchant Managed Services Charge', merchantCharge]
            ] as [string, number][],
            netAmt: merchantNet
        }
    ]

    // Only include tax invoices with amount > 0
    const taxItems = rawInvoices.filter(inv => inv.netAmt > 0)

    let overallTaxable = 0, overallVat = 0, overallGrand = 0

    return (
        <div className="p-4 space-y-3.5 max-h-[900px] overflow-y-auto">
            <div className="space-y-3">
                {taxItems.map((item, idx) => {
                    const taxableAmt = Math.round((item.netAmt / 1.13) * 100) / 100
                    const vatAmt = Math.round(taxableAmt * 0.13 * 100) / 100
                    const grandTotal = Math.round((taxableAmt + vatAmt) * 100) / 100
                    overallTaxable += taxableAmt
                    overallVat += vatAmt
                    overallGrand += grandTotal

                    return (
                        <div key={idx} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200/80 dark:border-zinc-800 shadow-xs space-y-2.5">
                            <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-zinc-800 bg-gray-50/40 dark:bg-zinc-900/50">
                                <Table>
                                    <TableBody className="text-xs">
                                        {item.items.map(([feeName, amount]) => (
                                            <TableRow key={feeName} className="hover:bg-gray-100/50 dark:hover:bg-zinc-800/40">
                                                <TableCell className="py-1 px-3 font-normal text-gray-700 dark:text-gray-300">{feeName}</TableCell>
                                                <TableCell className={`py-1 px-3 text-right font-mono font-medium ${amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                                    {amount < 0 ? '-' : ''}NPR {fmt(Math.abs(amount))}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-2.5 bg-blue-50/40 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/30 space-y-1.5">
                                <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{item.title}</div>
                                <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-blue-100 dark:border-blue-900/40">
                                    <div>
                                        <span className="font-medium text-gray-500 uppercase block text-[10px]">Taxable Amount</span>
                                        <span className="font-semibold font-mono text-gray-900 dark:text-gray-100 text-xs mt-0.5 block">NPR {fmt(taxableAmt)}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-blue-600 dark:text-blue-400 uppercase block text-[10px]">VAT 13%</span>
                                        <span className="font-semibold font-mono text-blue-700 dark:text-blue-300 text-xs mt-0.5 block">NPR {fmt(vatAmt)}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400 uppercase block text-[10px]">Grand Total</span>
                                        <span className="font-semibold font-mono text-emerald-700 dark:text-emerald-300 text-xs mt-0.5 block">NPR {fmt(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Overall Grand Total */}
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 space-y-2">
                    <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">Overall Tax Confirmation Summary</div>
                    <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/40">
                        <div>
                            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase block">Total Taxable</span>
                            <span className="text-xs font-semibold font-mono text-gray-900 dark:text-gray-100 mt-0.5 block">NPR {fmt(overallTaxable)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase block">Total VAT 13%</span>
                            <span className="text-xs font-semibold font-mono text-blue-700 dark:text-blue-300 mt-0.5 block">NPR {fmt(overallVat)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 uppercase block">Total Grand Amount</span>
                            <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block">NPR {fmt(overallGrand)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function StatementOverviewContent() {
    const searchParams = useSearchParams()

    const stmtNo = searchParams.get('statement_number') || ''
    const rawClosing = searchParams.get('closing_balance') || '0'
    const period = searchParams.get('period') || ''
    const store = searchParams.get('store') || ''
    const company = searchParams.get('company') || store
    const storeId = searchParams.get('store_id') || undefined
    const status = searchParams.get('status') || 'Released'
    const itemRevenue = searchParams.get('item_revenue') || '0'
    const feesTotal = searchParams.get('fees_total') || '0'
    const isReleased = status.toLowerCase().includes('releas')

    // State
    const [apiData, setApiData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const closingBalanceFromParam = parseFloat(rawClosing.replace(/[^0-9.]/g, '')) || 0

    // Build formula breakdown item (always available as fallback)
    const formulaItem = {
        statement_number: stmtNo,
        closing_balance: rawClosing,
        item_revenue: itemRevenue,
        sales_amount: itemRevenue,
        created_at: period,
        seller_account: store,
        store_name: store,
        company_name: company
    }
    const formulaBreakdown = getStatementBreakdown(formulaItem)

    const load = () => {
        setLoading(true)
        startTransition(async () => {
            try {
                const numRevenue = parseFloat(String(itemRevenue).replace(/[^0-9.]/g, '')) || 0
                const result = await fetchDarazStatementLineItems(stmtNo, storeId, period, numRevenue)
                setApiData(result)
            } catch {
                setApiData({ found: false, transactions: [], grouped: {} })
            } finally {
                setLoading(false)
            }
        })
    }

    const handleSync = async () => {
        // Parse start/end dates from period string like "13 Jul 2026 - 19 Jul 2026"
        const parts = period.split(' - ')
        if (parts.length < 2) {
            toast.error('Cannot parse statement period for sync')
            return
        }
        const sD = new Date(parts[0].trim())
        const eD = new Date(parts[1].trim())
        const pad = (n: number) => String(n).padStart(2, '0')
        const startDate = `${sD.getFullYear()}-${pad(sD.getMonth() + 1)}-${pad(sD.getDate())}`

        // Add 7 buffer days to end date to fetch all settlement records from that statement cycle
        const endBuffered = new Date(eD)
        endBuffered.setDate(endBuffered.getDate() + 7)
        const endDate = `${endBuffered.getFullYear()}-${pad(endBuffered.getMonth() + 1)}-${pad(endBuffered.getDate())}`

        const targetStore = storeId || store || stmtNo
        if (!targetStore) {
            toast.error('Store information is missing. Cannot identify store for sync.')
            return
        }

        setIsSyncing(true)
        try {
            const result = await syncDarazFinances(targetStore, startDate, endDate)
            toast.success(`Sync complete: ${result.message}`)
            // Reload statement line items after sync
            load()
        } catch (err: any) {
            toast.error(err?.message || 'Sync failed. Check your Daraz API token in Settings → Stores.')
        } finally {
            setIsSyncing(false)
        }
    }

    useEffect(() => {
        if (stmtNo) load()
        else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stmtNo])

    const statusStyle = isReleased
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'

    const fromApi = !!(apiData?.found && Object.keys(apiData?.grouped || {}).length > 0)
    const closingBalance = closingBalanceFromParam || (apiData?.summary?.closingBalance ?? formulaBreakdown.netClosingCalc)

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-4 md:p-6 space-y-5 font-sans">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/account/pan-vat-billing/daraz-finance">
                        <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 border-gray-300 dark:border-zinc-700">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Financial Report
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            Statement Overview
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {stmtNo}
                            </span>
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            {loading || isPending ? (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Checking Daraz API for live data...
                                </span>
                            ) : fromApi ? (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                                    <Wifi className="h-3 w-3" /> Live data from Daraz API ({apiData.transactions.length} transactions)
                                </span>
                            ) : (
                                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <WifiOff className="h-3 w-3" /> Estimated breakdown — sync transactions to see exact Daraz figures
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Primary: Sync from Daraz API */}
                    <Button
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing || loading || isPending}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                        title="Downloads real transaction data from Daraz API for this statement period and saves to database"
                    >
                        {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {isSyncing ? 'Syncing from Daraz...' : 'Sync from Daraz API'}
                    </Button>
                    {/* Secondary: Refresh page data */}
                    <Button variant="outline" size="sm" onClick={load} disabled={loading || isPending || isSyncing} className="flex items-center gap-1.5 text-xs font-semibold">
                        {(loading || isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-semibold">
                        <Printer className="h-3.5 w-3.5" />
                        Print
                    </Button>
                </div>
            </div>

            {/* Sync hint banner — only show when not from API and not loading */}
            {!loading && !isPending && !fromApi && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300">
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                        Showing <strong>estimated breakdown</strong> based on the statement closing balance.
                        For exact figures matching your Daraz Seller Center statement, sync this store&apos;s transactions from{' '}
                        <Link href="/dashboard/account/pan-vat-billing/daraz-finance" className="underline font-semibold">
                            Finance By API → Sync
                        </Link>
                        , then reload this page.
                    </span>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4 border-l-4 border-l-blue-600 bg-white dark:bg-zinc-900 shadow-xs">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Statement Closing Balance</div>
                    <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
                        {(loading || isPending) ? <span className="opacity-50">Loading...</span> : `NPR ${fmt(closingBalance)}`}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1.5">
                        Status:
                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${statusStyle}`}>
                            {isReleased ? 'Released' : 'Ready to Release'}
                        </span>
                    </div>
                </Card>
                <Card className="p-4 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Statement Period</div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-1.5">{period}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Weekly Statement Cycle</div>
                </Card>
                <Card className="p-4 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Seller Store Account</div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-1.5">{store}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Seller ID: {stmtNo.split('-')[0]}</div>
                </Card>
                <Card className="p-4 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Registered Company</div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-1.5">{company}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">PAN/VAT Entity Mapping</div>
                </Card>
            </div>

            {/* Loading skeleton */}
            {(loading || isPending) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {[1, 2].map(i => (
                        <Card key={i} className="p-6 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                            <div className="flex items-center gap-2 mb-4">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                <span className="text-xs text-gray-500">Loading {i === 1 ? 'line items' : 'tax confirmation'}...</span>
                            </div>
                            <div className="space-y-2">
                                {Array.from({ length: 8 }).map((_, j) => (
                                    <div key={j} className="h-6 bg-gray-100 dark:bg-zinc-800 rounded animate-pulse" style={{ opacity: 1 - j * 0.1 }} />
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Breakdown — always shown once loaded */}
            {!loading && !isPending && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

                    {/* LEFT: Financial Line Items Breakdown */}
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                        <div className="px-3.5 py-2.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                                <Receipt className="h-3.5 w-3.5 text-blue-600" />
                                Financial Line Items Breakdown
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 font-mono">Statement #{stmtNo}</span>
                                {fromApi ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">LIVE API</span>
                                ) : (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">ESTIMATED</span>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50/80 dark:bg-zinc-800/60">
                                    <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                        <TableHead className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Fee Type</TableHead>
                                        <TableHead className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Fee Name</TableHead>
                                        <TableHead className="py-1.5 px-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Fee Amount (NPR)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                {fromApi
                                    ? <ApiBreakdown grouped={apiData.grouped} closingBalance={apiData.summary?.closingBalance ?? closingBalanceFromParam} />
                                    : <StaticBreakdown b={formulaBreakdown} />
                                }
                            </Table>
                        </div>
                    </Card>

                    {/* RIGHT: Tax Confirmation */}
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                        <div className="px-3.5 py-2.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                                <Receipt className="h-3.5 w-3.5 text-blue-600" />
                                Daraz Invoice Tax Confirmation
                            </h3>
                            <span className="text-[10px] text-gray-500 font-mono">Tax Confirmation</span>
                        </div>
                        <TaxPanel b={formulaBreakdown} fromApi={fromApi} grouped={fromApi ? apiData.grouped : {}} />
                    </Card>
                </div>
            )}
        </div>
    )
}

export default function StatementOverviewPage() {
    return (
        <Suspense fallback={
            <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                <div className="text-sm text-gray-500">Loading Statement Overview...</div>
            </div>
        }>
            <StatementOverviewContent />
        </Suspense>
    )
}
