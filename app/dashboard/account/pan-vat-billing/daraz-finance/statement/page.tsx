'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft,
    Printer,
    Receipt,
    Layers,
    Calendar,
    Building2,
    Store,
    CheckCircle2
} from 'lucide-react'
import { Card, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, Button } from '@/components/ui-shim'
import { getStatementBreakdown } from '../../daraz-finance-card'

function StatementOverviewContent() {
    const searchParams = useSearchParams()

    const stmtNo = searchParams.get('statement_number') || 'NPDZNLUE6T-2026-030'
    const rawClosing = searchParams.get('closing_balance') || '121072.47'
    const period = searchParams.get('period') || '20 Jul 2026 - 26 Jul 2026'
    const store = searchParams.get('store') || 'Bagmati Traders'
    const company = searchParams.get('company') || 'Bagmati Traders'

    const item = {
        statement_number: stmtNo,
        closing_balance: rawClosing,
        created_at: period,
        seller_account: store,
        company_name: company
    }

    const b = getStatementBreakdown(item)

    const isReleased = true
    const statusLabel = isReleased ? 'Released' : 'Ready to Release'
    const statusStyle = isReleased
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'

    const openingBalance = 0.00
    const prodPricePaidByBuyer = b.prodPricePaidByBuyer
    const shipPaidByBuyer = b.shipPaidByBuyer
    const coFundedVoucher = b.coFundedVoucher
    const deliveredSubtotal = b.deliveredSubtotal

    const paymentFee = b.paymentFee
    const commissionFee = b.commissionFee
    const shippingFee = b.shippingFee
    const shippingFeeDiscount = b.shippingFeeDiscount
    const freeShippingMaxFee = b.freeShippingMaxFee
    const coinsFee = b.coinsFee
    const transactionFeesSubtotal = b.transactionFeesSubtotal

    const failedShippingFee = b.failedShippingFee
    const failedSubtotal = b.failedSubtotal

    const returnedProdPrice = b.returnedProdPrice
    const voucherReversal = b.voucherReversal
    const returnedOrdersSubtotal = b.returnedOrdersSubtotal

    const gstDebit = b.gstDebit
    const gstCredit = b.gstCredit
    const withholdingSubtotal = b.withholdingSubtotal

    const handlingFee = b.handlingFee
    const merchantCharge = b.merchantCharge
    const returnHandlingFee = b.returnHandlingFee
    const logisticsSubtotal = b.logisticsSubtotal

    const paymentFeeRefunded = b.paymentFeeRefunded
    const commissionRefunded = b.commissionRefunded
    const freeShipRefunded = b.freeShipRefunded
    const coinsFeeRefunded = b.coinsFeeRefunded
    const refundedFeesSubtotal = b.refundedFeesSubtotal

    const netClosingCalc = b.netClosingCalc

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-4 md:p-6 space-y-5 font-sans">
            {/* Header Navigation Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/account/pan-vat-billing/daraz-finance">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 border-gray-300 dark:border-zinc-700"
                        >
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
                        <p className="text-xs text-gray-500">
                            Detailed seller statement calculation breakdown for {company}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 text-xs font-semibold"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print Statement
                    </Button>
                </div>
            </div>

            {/* Hero Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4 border-l-4 border-l-blue-600 bg-white dark:bg-zinc-900 shadow-xs">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Statement Closing Balance</div>
                    <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
                        NPR {netClosingCalc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1.5">
                        Status:
                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${statusStyle}`}>
                            {statusLabel}
                        </span>
                    </div>
                </Card>

                <Card className="p-4 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Statement Period</div>
                    <div className="text-xs font-extrabold text-gray-900 dark:text-gray-100 mt-1.5">
                        {period}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                        Weekly Statement Cycle
                    </div>
                </Card>

                <Card className="p-4 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Seller Store Account</div>
                    <div className="text-xs font-extrabold text-gray-900 dark:text-gray-100 mt-1.5">
                        {store}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                        Seller ID: {stmtNo.split('-')[0]}
                    </div>
                </Card>

                <Card className="p-4 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Registered Company</div>
                    <div className="text-xs font-extrabold text-gray-900 dark:text-gray-100 mt-1.5">
                        {company}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                        PAN/VAT Entity Mapping
                    </div>
                </Card>
            </div>

            {/* Main 2-Column Row Layout (Left Side: Compact Statement Table | Right Side: Prepared Next Row) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* LEFT SIDE: Compact Breakdown Table with Less Spacing */}
                <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                    <div className="px-3.5 py-2.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                            <Receipt className="h-3.5 w-3.5 text-blue-600" />
                            Financial Line Items Breakdown
                        </h3>
                        <span className="text-[10px] text-gray-500 font-mono">Statement #{stmtNo}</span>
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
                            <TableBody className="text-[11px] leading-tight divide-y divide-gray-100 dark:divide-zinc-800/60">
                                {/* Opening Balance */}
                                <TableRow className="bg-gray-50/20 dark:bg-zinc-800/10">
                                    <TableCell className="py-1 px-3 font-bold text-gray-900 dark:text-gray-100">Opening Balance</TableCell>
                                    <TableCell className="py-1 px-3"></TableCell>
                                    <TableCell className="py-1 px-3 text-right font-mono font-semibold">NPR {openingBalance.toFixed(2)}</TableCell>
                                </TableRow>

                                {/* 1. Delivered Orders */}
                                <TableRow className="bg-blue-50/30 dark:bg-blue-950/20 font-bold">
                                    <TableCell className="py-1 px-3 text-gray-900 dark:text-gray-100">Delivered Orders</TableCell>
                                    <TableCell className="py-1 px-3 text-gray-700 dark:text-gray-300 font-extrabold">Subtotal</TableCell>
                                    <TableCell className="py-1 px-3 text-right font-mono font-black text-gray-900 dark:text-gray-100">NPR {deliveredSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Shipping Fee Paid by Buyer</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-gray-800 dark:text-gray-200">NPR {shipPaidByBuyer.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4 font-semibold text-emerald-700 dark:text-emerald-400">Product Price Paid by Buyer</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">NPR {prodPricePaidByBuyer.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Co-funded Voucher Max</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {coFundedVoucher.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>

                                {/* 2. Transaction Fees */}
                                <TableRow className="bg-rose-50/30 dark:bg-rose-950/20 font-bold">
                                    <TableCell className="py-1 px-3 text-gray-900 dark:text-gray-100">Transaction Fees</TableCell>
                                    <TableCell className="py-1 px-3 text-gray-700 dark:text-gray-300 font-extrabold">Subtotal</TableCell>
                                    <TableCell className="py-1 px-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">NPR {transactionFeesSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Payment Fee</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {paymentFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Commission Fee</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {commissionFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Shipping Fee</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Shipping Fee Discount</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">NPR {shippingFeeDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Free Shipping Max Fee</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {freeShippingMaxFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Daraz Coins Discount Participation Fee</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {coinsFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>

                                {/* 3. Delivered Orders Marked Delivery Failed */}
                                {failedSubtotal !== 0 && (
                                    <>
                                        <TableRow className="bg-gray-50/40 dark:bg-zinc-800/20 font-bold">
                                            <TableCell className="py-1 px-3 text-gray-900 dark:text-gray-100">Delivered Orders Marked Delivery Failed</TableCell>
                                            <TableCell className="py-1 px-3 text-gray-700 dark:text-gray-300 font-extrabold">Subtotal</TableCell>
                                            <TableCell className="py-1 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {failedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                            <TableCell className="py-0.5 px-3"></TableCell>
                                            <TableCell className="py-0.5 px-3 pl-4">Shipping Fee</TableCell>
                                            <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {failedShippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    </>
                                )}

                                {/* 4. Returned Orders */}
                                <TableRow className="bg-amber-50/30 dark:bg-amber-950/20 font-bold">
                                    <TableCell className="py-1 px-3 text-gray-900 dark:text-gray-100">Returned Orders</TableCell>
                                    <TableCell className="py-1 px-3 text-gray-700 dark:text-gray-300 font-extrabold">Subtotal</TableCell>
                                    <TableCell className="py-1 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">NPR {returnedOrdersSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Product Price Refunded to Buyer</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {returnedProdPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Co-funded Voucher Max Reversal</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">NPR {voucherReversal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>

                                {/* 5. Withholding */}
                                <TableRow className="bg-red-50/30 dark:bg-red-950/20 font-bold">
                                    <TableCell className="py-1 px-3 text-gray-900 dark:text-gray-100">Withholding</TableCell>
                                    <TableCell className="py-1 px-3 text-gray-700 dark:text-gray-300 font-extrabold">Subtotal</TableCell>
                                    <TableCell className="py-1 px-3 text-right font-mono font-black text-red-600 dark:text-red-400">NPR {withholdingSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">General Sales Tax Withholding</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {gstDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">General Sales Tax Withholding</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">NPR {gstCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>

                                {/* 6. Logistics & Fulfillment Services */}
                                <TableRow className="bg-gray-50/40 dark:bg-zinc-800/20 font-bold">
                                    <TableCell className="py-1 px-3 text-gray-900 dark:text-gray-100">Logistics & Fulfillment Services</TableCell>
                                    <TableCell className="py-1 px-3 text-gray-700 dark:text-gray-300 font-extrabold">Subtotal</TableCell>
                                    <TableCell className="py-1 px-3 text-right font-mono font-black text-red-600 dark:text-red-400">NPR {logisticsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Handling Fee</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {handlingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Merchant Managed Services Charge</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {merchantCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Handling Fee for Return</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-red-600 dark:text-red-400">NPR {returnHandlingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>

                                {/* 7. Transaction Fees Refunded */}
                                <TableRow className="bg-emerald-50/30 dark:bg-emerald-950/20 font-bold">
                                    <TableCell className="py-1 px-3 text-gray-900 dark:text-gray-100">Transaction Fees Refunded</TableCell>
                                    <TableCell className="py-1 px-3 text-gray-700 dark:text-gray-300 font-extrabold">Subtotal</TableCell>
                                    <TableCell className="py-1 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">NPR {refundedFeesSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Payment Fee Refunded</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">NPR {paymentFeeRefunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Commission Fee Refunded</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">NPR {commissionRefunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Reversal of Free Shipping Max Fee</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">NPR {freeShipRefunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-gray-600 dark:text-gray-400">
                                    <TableCell className="py-0.5 px-3"></TableCell>
                                    <TableCell className="py-0.5 px-3 pl-4">Reversal of DARAZ Coins Discount Participation Fee</TableCell>
                                    <TableCell className="py-0.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">NPR {coinsFeeRefunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>

                                {/* Closing Balance */}
                                <TableRow className="bg-blue-100/80 dark:bg-blue-950/60 font-black text-xs border-t-2 border-blue-400 dark:border-blue-600">
                                    <TableCell className="py-2 px-3 text-blue-900 dark:text-blue-100">Closing Balance (Released Amount)</TableCell>
                                    <TableCell className="py-2 px-3 text-blue-900 dark:text-blue-100"></TableCell>
                                    <TableCell className="py-2 px-3 text-right font-mono font-black text-blue-700 dark:text-blue-300 text-xs">
                                        NPR {netClosingCalc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </Card>

                {/* RIGHT SIDE: Daraz Invoice Tax Confirmation Card */}
                <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-0">
                    <div className="px-3.5 py-2.5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                            <Receipt className="h-3.5 w-3.5 text-blue-600" />
                            Daraz Invoice Tax Confirmation
                        </h3>
                        <span className="text-[10px] text-gray-500 font-mono">Tax Confirmation</span>
                    </div>

                    <div className="p-4 space-y-4 max-h-[850px] overflow-y-auto">
                        {(() => {
                            const taxInvoiceItems = [
                                {
                                    id: 'voucher',
                                    title: "Tax Invoice - Co Funded Voucher Max",
                                    feeName: "Co-funded Voucher Max",
                                    feeAmt: Math.abs(coFundedVoucher),
                                    reversalName: "Co-funded Voucher Max Reversal",
                                    reversalAmt: Math.abs(voucherReversal),
                                    isSubtract: true
                                },
                                {
                                    id: 'payment',
                                    title: "Tax Invoice - Payment Fee",
                                    feeName: "Payment Fee",
                                    feeAmt: Math.abs(paymentFee),
                                    reversalName: "Payment Fee Refunded",
                                    reversalAmt: Math.abs(paymentFeeRefunded),
                                    isSubtract: true
                                },
                                {
                                    id: 'commission',
                                    title: "Tax Invoice - Commission Fee",
                                    feeName: "Commission Fee",
                                    feeAmt: Math.abs(commissionFee),
                                    reversalName: "Commission Fee Refunded",
                                    reversalAmt: Math.abs(commissionRefunded),
                                    isSubtract: true
                                },
                                {
                                    id: 'free-ship',
                                    title: "Tax Invoice - Free Shipping Max Fee",
                                    feeName: "Free Shipping Max Fee",
                                    feeAmt: Math.abs(freeShippingMaxFee),
                                    reversalName: "Reversal of Free Shipping Max Fee",
                                    reversalAmt: Math.abs(freeShipRefunded),
                                    isSubtract: true
                                },
                                {
                                    id: 'coins',
                                    title: "Tax Invoice - Daraz Coins Discount Participation Fee",
                                    feeName: "Daraz Coins Discount Participation Fee",
                                    feeAmt: Math.abs(coinsFee),
                                    reversalName: "Reversal of DARAZ Coins Discount Participation Fee",
                                    reversalAmt: Math.abs(coinsFeeRefunded),
                                    isSubtract: true
                                },
                                {
                                    id: 'merchant',
                                    title: "Tax Invoice - Merchant Managed Services Charge",
                                    feeName: "Merchant Managed Services Charge",
                                    feeAmt: Math.abs(merchantCharge),
                                    reversalName: null,
                                    reversalAmt: 0,
                                    isSubtract: false
                                },
                                {
                                    id: 'handling',
                                    title: "Tax Invoice - Handling Fee & Return Handling Fee",
                                    feeName: "Handling Fee",
                                    feeAmt: Math.abs(handlingFee),
                                    reversalName: "Handling Fee for Return",
                                    reversalAmt: Math.abs(returnHandlingFee),
                                    isSubtract: false // Sum for handling fee + return handling fee
                                }
                            ]

                            let totalTaxableSum = 0
                            let totalVatSum = 0
                            let totalGrandSum = 0

                            return (
                                <div className="space-y-4">
                                    {taxInvoiceItems.map((item) => {
                                        const netAmt = item.isSubtract
                                            ? item.feeAmt - item.reversalAmt
                                            : item.feeAmt + item.reversalAmt

                                        const taxableAmt = Math.round((netAmt / 1.13) * 100) / 100
                                        const vatAmt = Math.round((taxableAmt * 0.13) * 100) / 100
                                        const grandTotal = Math.round((taxableAmt + vatAmt) * 100) / 100

                                        totalTaxableSum += taxableAmt
                                        totalVatSum += vatAmt
                                        totalGrandSum += grandTotal

                                        return (
                                            <div key={item.id} className="p-3 bg-gray-50/70 dark:bg-zinc-800/40 rounded-xl border border-gray-200 dark:border-zinc-800 space-y-2.5">
                                                {/* Line Items Table */}
                                                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900">
                                                    <Table>
                                                        <TableBody className="text-[11px]">
                                                            <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                                                                <TableCell className="py-1 px-2.5 font-medium text-gray-800 dark:text-gray-200">{item.feeName}</TableCell>
                                                                <TableCell className="py-1 px-2.5 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">
                                                                    NPR {item.feeAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </TableCell>
                                                            </TableRow>

                                                            {item.reversalName && (
                                                                <TableRow className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                                                                    <TableCell className="py-1 px-2.5 font-medium text-gray-800 dark:text-gray-200">{item.reversalName}</TableCell>
                                                                    <TableCell className={`py-1 px-2.5 text-right font-mono font-semibold ${item.isSubtract ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                                                        {item.isSubtract ? '-' : ''}NPR {item.reversalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>

                                                {/* Bold Title & Taxable/VAT/Grand Total Summary */}
                                                <div className="p-2.5 bg-blue-50/40 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40 space-y-1.5">
                                                    <div className="text-[11px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                                                        {item.title}
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-blue-200/50 dark:border-blue-800/40 text-[10px]">
                                                        <div>
                                                            <span className="font-semibold text-gray-500 uppercase block text-[9px]">Taxable Amount</span>
                                                            <span className="font-bold font-mono text-gray-900 dark:text-gray-100 mt-0.5 block">
                                                                NPR {taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold text-blue-600 dark:text-blue-400 uppercase block text-[9px]">Vat 13%</span>
                                                            <span className="font-bold font-mono text-blue-700 dark:text-blue-300 mt-0.5 block">
                                                                NPR {vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase block text-[9px]">Grand Total</span>
                                                            <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                                                                NPR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* Overall Grand Total Banner across all Tax Confirmation Invoices */}
                                    <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                                        <div className="text-xs font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                                            Overall Tax Confirmation Summary
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-200 dark:border-emerald-800/60">
                                            <div>
                                                <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase block">Total Taxable</span>
                                                <span className="text-xs font-extrabold font-mono text-gray-900 dark:text-gray-100 mt-0.5 block">
                                                    NPR {totalTaxableSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase block">Total VAT 13%</span>
                                                <span className="text-xs font-extrabold font-mono text-blue-700 dark:text-blue-300 mt-0.5 block">
                                                    NPR {totalVatSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block">Total Grand Amount</span>
                                                <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                                                    NPR {totalGrandSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default function StatementOverviewPage() {
    return (
        <Suspense fallback={
            <div className="p-12 text-center text-xs text-gray-500">
                Loading Statement Overview...
            </div>
        }>
            <StatementOverviewContent />
        </Suspense>
    )
}
