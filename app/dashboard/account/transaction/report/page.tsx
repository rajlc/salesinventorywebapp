'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    Printer,
    TrendingUp,
    Landmark,
    ArrowLeftRight,
    CheckCircle2,
    RefreshCw,
} from 'lucide-react'
import { getCashTransactions } from '@/features/transaction/actions/cashflow-actions'
import { getFinancialAccounts, getSupplierCheques } from '@/features/transaction/actions/account-actions'
import { getDarazSettlementData, getCourierSettlementData } from '@/features/transaction/actions/settlement-actions'
import { getLiveNetWorth, getNetWorthSnapshots } from '@/features/transaction/actions/networth-actions'
import type {
    CashFlowSummary,
    CashTransaction,
    CourierSettlementHistoryRow,
    DarazWeeklySettlementRow,
    FinancialAccount,
    LiveNetWorthData,
    NetWorthSnapshot,
    SupplierChequeItem,
} from '@/features/transaction/types'

function formatRs(n: number) {
    const sign = n < 0 ? '-' : ''
    return `${sign}Rs ${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
}

function minus15Days(dateStr: string) {
    const d = new Date(`${dateStr}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 14)
    return d.toISOString().slice(0, 10)
}

function FullTransactionReportContent() {
    const searchParams = useSearchParams()
    const reportDate = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const fromDate = searchParams.get('from') || minus15Days(reportDate)

    const [loading, setLoading] = useState(true)
    const [snapshot, setSnapshot] = useState<NetWorthSnapshot | null>(null)
    const [liveNetWorth, setLiveNetWorth] = useState<LiveNetWorthData | null>(null)
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [cheques, setCheques] = useState<SupplierChequeItem[]>([])
    const [cfSummary, setCfSummary] = useState<CashFlowSummary | null>(null)
    const [transactions, setTransactions] = useState<CashTransaction[]>([])
    const [darazRows, setDarazRows] = useState<DarazWeeklySettlementRow[]>([])
    const [courierHistory, setCourierHistory] = useState<CourierSettlementHistoryRow[]>([])

    useEffect(() => {
        let active = true
        async function loadReport() {
            setLoading(true)
            try {
                const [snaps, live, accs, chqs, cf, daraz, courier] = await Promise.all([
                    getNetWorthSnapshots(),
                    getLiveNetWorth(),
                    getFinancialAccounts(),
                    getSupplierCheques(),
                    getCashTransactions({ startDate: fromDate, endDate: reportDate }),
                    getDarazSettlementData(),
                    getCourierSettlementData(),
                ])
                if (!active) return
                const matchedSnap = snaps.find((s) => s.snapshot_date === reportDate) || snaps[0] || null
                setSnapshot(matchedSnap)
                setLiveNetWorth(live)
                setAccounts(accs)
                setCheques(chqs)
                setCfSummary(cf.summary)
                setTransactions(cf.transactions)
                setDarazRows(daraz.weeklyRows)
                setCourierHistory(courier.history)
            } catch (err) {
                console.error('Error loading 15-day report:', err)
            } finally {
                if (active) setLoading(false)
            }
        }
        loadReport()
        return () => {
            active = false
        }
    }, [reportDate, fromDate])

    if (loading) {
        return (
            <div className="py-20 text-center text-gray-500 flex flex-col items-center gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
                <span>Generating Full 15-Day Financial Report ({fromDate} to {reportDate})...</span>
            </div>
        )
    }

    const nw = snapshot || (liveNetWorth
        ? {
              snapshot_date: reportDate,
              period_label: `Live Report (${reportDate})`,
              company_banks_total: liveNetWorth.companyBanksTotal,
              personal_total: liveNetWorth.personalTotal,
              cash_in_hand_total: liveNetWorth.cashInHandTotal,
              warehouse_stock_value: liveNetWorth.warehouseStockValue,
              daraz_in_transit_value: liveNetWorth.darazInTransitValue,
              daraz_pending_payout: liveNetWorth.darazPendingPayout,
              courier_in_transit_value: liveNetWorth.courierInTransitValue,
              courier_pending_cod: liveNetWorth.courierPendingCod,
              party_receivables: liveNetWorth.partyReceivables,
              party_payables: liveNetWorth.partyPayables,
              pending_cheques_total: liveNetWorth.pendingChequesTotal,
              other_liabilities_total: liveNetWorth.otherLiabilitiesTotal,
              damaged_goods_loss: liveNetWorth.damagedGoodsLoss,
              total_assets: liveNetWorth.totalAssets,
              total_liabilities: liveNetWorth.totalLiabilities,
              net_worth: liveNetWorth.netWorth,
          }
        : null)

    return (
        <div className="space-y-6 w-full pb-12">
            {/* Report Header */}
            <div className="bg-slate-900 text-white p-5 rounded-xl flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
                        Bagmati Traders — Complete 15-Day Financial Report
                    </p>
                    <h1 className="text-2xl font-extrabold mt-1">
                        Period: {fromDate} → {reportDate}
                    </h1>
                    <p className="text-xs text-slate-300 mt-1">
                        Includes Net Worth, Bank Statement, CashFlow, and Daraz &amp; Courier Settlements
                    </p>
                </div>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white print:hidden"
                >
                    <Printer className="h-4 w-4" /> Print / Save PDF
                </button>
            </div>

            {/* 1. NET WORTH SECTION */}
            {nw && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="px-5 py-3.5 border-b dark:border-zinc-800 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-sm text-emerald-900 dark:text-emerald-200">
                            <TrendingUp className="h-4 w-4" /> 1. Net Worth Summary ({nw.snapshot_date})
                        </div>
                        <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                            Net Worth: {formatRs(nw.net_worth)}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x dark:divide-zinc-800 text-sm">
                        <div className="p-4 space-y-2">
                            <div className="font-bold text-xs uppercase text-emerald-700">
                                Assets ({formatRs(nw.total_assets)})
                            </div>
                            <div className="flex justify-between"><span>Company Banks</span><span className="font-semibold">{formatRs(nw.company_banks_total)}</span></div>
                            <div className="flex justify-between"><span>Business Cash in Hand</span><span className="font-semibold">{formatRs(nw.cash_in_hand_total)}</span></div>
                            <div className="flex justify-between"><span>Personal Banks &amp; Wallets</span><span className="font-semibold">{formatRs(nw.personal_total)}</span></div>
                            <div className="flex justify-between"><span>Warehouse Stock Valuation</span><span className="font-bold text-blue-600">{formatRs(nw.warehouse_stock_value)}</span></div>
                            <div className="flex justify-between"><span>Daraz Shipped (In-Transit)</span><span>{formatRs(nw.daraz_in_transit_value)}</span></div>
                            <div className="flex justify-between"><span>Daraz Pending Payout</span><span>{formatRs(nw.daraz_pending_payout)}</span></div>
                            <div className="flex justify-between"><span>Courier Shipped (In-Transit)</span><span>{formatRs(nw.courier_in_transit_value)}</span></div>
                            <div className="flex justify-between"><span>Courier Pending COD</span><span>{formatRs(nw.courier_pending_cod)}</span></div>
                            <div className="flex justify-between"><span>Supplier / Party Receivables</span><span className="text-emerald-600 font-semibold">{formatRs(nw.party_receivables)}</span></div>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="font-bold text-xs uppercase text-rose-700">
                                Liabilities ({formatRs(nw.total_liabilities)})
                            </div>
                            <div className="flex justify-between"><span>Party / Supplier Credit Due</span><span className="font-bold text-rose-600">{formatRs(nw.party_payables)}</span></div>
                            <div className="flex justify-between"><span>Pending Supplier Cheques</span><span className="font-semibold text-amber-600">{formatRs(nw.pending_cheques_total)}</span></div>
                            <div className="flex justify-between"><span>Loans &amp; Other Liabilities</span><span className="font-semibold">{formatRs(nw.other_liabilities_total)}</span></div>
                            <div className="pt-3 mt-3 border-t dark:border-zinc-800 flex justify-between text-xs text-amber-700">
                                <span>Damaged Goods Loss (Non-Cash)</span>
                                <span className="font-bold">{formatRs(nw.damaged_goods_loss)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. BANK STATEMENT SECTION */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b dark:border-zinc-800 bg-blue-50 dark:bg-blue-950/30 flex items-center gap-2 font-bold text-sm text-blue-900 dark:text-blue-200">
                    <Landmark className="h-4 w-4" /> 2. Bank Statement (All Company Banks, Personal Banks &amp; Cash)
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-2.5 text-left">Account Name</th>
                                <th className="px-4 py-2.5 text-left">Scope / Type</th>
                                <th className="px-4 py-2.5 text-right">Total In</th>
                                <th className="px-4 py-2.5 text-right">Total Out</th>
                                <th className="px-4 py-2.5 text-right">Pending Cheques</th>
                                <th className="px-4 py-2.5 text-right">Current Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-800">
                            {accounts.map((a) => (
                                <tr key={a.id}>
                                    <td className="px-4 py-2.5 font-semibold">
                                        {a.name} {a.account_last4 ? `(####${a.account_last4})` : ''}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs capitalize">
                                        {a.owner_scope === 'business' ? 'Company' : 'Personal'} • {a.account_type}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-emerald-600">{formatRs(a.total_in)}</td>
                                    <td className="px-4 py-2.5 text-right text-rose-600">{formatRs(a.total_out)}</td>
                                    <td className="px-4 py-2.5 text-right text-amber-600">{formatRs(a.pending_cheques)}</td>
                                    <td className="px-4 py-2.5 text-right font-bold">{formatRs(a.current_balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {cheques.filter((c) => !c.cheque_cleared).length > 0 && (
                    <div className="px-4 py-2.5 bg-amber-50/70 dark:bg-amber-950/20 border-t dark:border-zinc-800 text-xs text-amber-800 dark:text-amber-300">
                        Pending Uncleared Supplier Cheques: {cheques.filter((c) => !c.cheque_cleared).length}
                    </div>
                )}
            </div>

            {/* 3. CASHFLOW SECTION */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b dark:border-zinc-800 bg-purple-50 dark:bg-purple-950/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-purple-900 dark:text-purple-200">
                        <ArrowLeftRight className="h-4 w-4" /> 3. CashFlow ({fromDate} to {reportDate})
                    </div>
                    {cfSummary && (
                        <div className="text-xs font-bold">
                            In: <span className="text-emerald-600">+{formatRs(cfSummary.totalMoneyIn)}</span> • Out:{' '}
                            <span className="text-rose-600">-{formatRs(cfSummary.totalMoneyOut)}</span> • Net:{' '}
                            <span className={cfSummary.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                {formatRs(cfSummary.netCashFlow)}
                            </span>
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-2.5 text-left">Date</th>
                                <th className="px-4 py-2.5 text-left">Type / Category</th>
                                <th className="px-4 py-2.5 text-left">Particular</th>
                                <th className="px-4 py-2.5 text-left">Account</th>
                                <th className="px-4 py-2.5 text-left">By</th>
                                <th className="px-4 py-2.5 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-800">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                                        No cash flow transactions in this period.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id}>
                                        <td className="px-4 py-2 font-mono text-xs">{tx.transaction_date}</td>
                                        <td className="px-4 py-2 text-xs font-semibold">
                                            [{tx.direction.toUpperCase()}] {tx.category}
                                        </td>
                                        <td className="px-4 py-2 text-xs">{tx.party_or_particular || '—'}</td>
                                        <td className="px-4 py-2 text-xs">
                                            {tx.account_name}
                                            {tx.transfer_to_account_name ? ` → ${tx.transfer_to_account_name}` : ''}
                                        </td>
                                        <td className="px-4 py-2 text-xs">{tx.creator_name}</td>
                                        <td
                                            className={`px-4 py-2 text-right font-bold text-xs ${
                                                tx.direction === 'in'
                                                    ? 'text-emerald-600'
                                                    : tx.direction === 'out'
                                                    ? 'text-rose-600'
                                                    : 'text-blue-600'
                                            }`}
                                        >
                                            {tx.direction === 'in' ? '+' : tx.direction === 'out' ? '-' : '⇄'}{' '}
                                            {formatRs(tx.amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. DARAZ & COURIER SETTLEMENTS SECTION */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b dark:border-zinc-800 bg-orange-50 dark:bg-orange-950/30 flex items-center gap-2 font-bold text-sm text-orange-900 dark:text-orange-200">
                    <CheckCircle2 className="h-4 w-4" /> 4. Daraz &amp; Courier Settlements
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Daraz Weekly Settlements</h3>
                        <div className="overflow-x-auto border dark:border-zinc-800 rounded-lg">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 dark:bg-zinc-800/60 uppercase text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Week</th>
                                        <th className="px-3 py-2 text-left">Store</th>
                                        <th className="px-3 py-2 text-right">Expected</th>
                                        <th className="px-3 py-2 text-right">Received</th>
                                        <th className="px-3 py-2 text-right">Unsettled / Diff</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-zinc-800">
                                    {darazRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-6 text-center text-gray-400">
                                                No Daraz settlements.
                                            </td>
                                        </tr>
                                    ) : (
                                        darazRows.slice(0, 15).map((r) => (
                                            <tr key={`${r.weekStart}-${r.sellerAccount}`}>
                                                <td className="px-3 py-2 font-mono">{r.weekStart} → {r.weekEnd}</td>
                                                <td className="px-3 py-2 font-medium">{r.sellerAccount}</td>
                                                <td className="px-3 py-2 text-right font-semibold">{formatRs(r.expectedAmount)}</td>
                                                <td className="px-3 py-2 text-right text-emerald-600 font-bold">
                                                    {r.status === 'verified' ? formatRs(r.receivedTotal) : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-amber-600">
                                                    {r.status === 'verified' ? formatRs(r.unsettledAmount) : 'Pending'}
                                                </td>
                                                <td className="px-3 py-2 text-center capitalize font-semibold">{r.status}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Courier COD Settlements</h3>
                        <div className="overflow-x-auto border dark:border-zinc-800 rounded-lg">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 dark:bg-zinc-800/60 uppercase text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Date</th>
                                        <th className="px-3 py-2 text-left">Courier</th>
                                        <th className="px-3 py-2 text-right">Expected COD</th>
                                        <th className="px-3 py-2 text-right">Received</th>
                                        <th className="px-3 py-2 text-right">Diff / Deduction</th>
                                        <th className="px-3 py-2 text-left">Verified By</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-zinc-800">
                                    {courierHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-6 text-center text-gray-400">
                                                No Courier settlements yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        courierHistory.slice(0, 15).map((h) => (
                                            <tr key={h.id}>
                                                <td className="px-3 py-2 font-mono">{h.settlement_date}</td>
                                                <td className="px-3 py-2 font-medium">{h.courier_name}</td>
                                                <td className="px-3 py-2 text-right">{formatRs(h.expected_amount)}</td>
                                                <td className="px-3 py-2 text-right text-emerald-600 font-bold">{formatRs(h.received_total)}</td>
                                                <td className="px-3 py-2 text-right text-amber-600">{formatRs(h.unsettled_amount)}</td>
                                                <td className="px-3 py-2">{h.verified_by_name}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function TransactionReportPage() {
    return (
        <Suspense fallback={<div className="py-20 text-center text-gray-400">Loading report...</div>}>
            <FullTransactionReportContent />
        </Suspense>
    )
}
