'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    TrendingUp,
    TrendingDown,
    Save,
    RefreshCw,
    Plus,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Calendar,
    X,
    FileText,
    ExternalLink,
} from 'lucide-react'
import {
    getLiveNetWorth,
    getNetWorthSnapshots,
    saveNetWorthSnapshot,
    createOtherLiability,
    toggleOtherLiabilityPaid,
    deleteOtherLiability,
} from '@/features/transaction/actions/networth-actions'
import type { LiveNetWorthData, NetWorthSnapshot } from '@/features/transaction/types'

function formatRs(n: number) {
    const sign = n < 0 ? '-' : ''
    return `${sign}Rs ${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
}

export default function NetWorthPage() {
    const [data, setData] = useState<LiveNetWorthData | null>(null)
    const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([])
    const [viewMode, setViewMode] = useState<'combined' | 'business'>('combined')
    const [loading, setLoading] = useState(true)
    const [savingSnap, setSavingSnap] = useState(false)

    // Add Liability Modal
    const [liabOpen, setLiabOpen] = useState(false)
    const [liabTitle, setLiabTitle] = useState('')
    const [liabCategory, setLiabCategory] = useState<'loan' | 'unpaid_bill' | 'other'>('loan')
    const [liabAmount, setLiabAmount] = useState('')
    const [liabDue, setLiabDue] = useState('')
    const [liabNotes, setLiabNotes] = useState('')

    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const [live, snaps] = await Promise.all([getLiveNetWorth(), getNetWorthSnapshots()])
            setData(live)
            setSnapshots(snaps)
        } catch (err) {
            console.error('Error loading Net Worth:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    const handleSaveSnapshot = async () => {
        setSavingSnap(true)
        try {
            await saveNetWorthSnapshot()
            await loadAll()
        } catch (err: any) {
            alert(err?.message || 'Failed to save 15-day report')
        } finally {
            setSavingSnap(false)
        }
    }

    const handleAddLiability = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!liabTitle.trim()) return
        try {
            await createOtherLiability({
                title: liabTitle,
                category: liabCategory,
                amount: Number(liabAmount) || 0,
                due_date: liabDue || null,
                notes: liabNotes || null,
            })
            setLiabOpen(false)
            setLiabTitle('')
            setLiabAmount('')
            setLiabDue('')
            setLiabNotes('')
            await loadAll()
        } catch (err: any) {
            alert(err?.message || 'Failed to add liability')
        }
    }

    const displayedAssets = data ? (viewMode === 'combined' ? data.totalAssets : data.businessTotalAssets) : 0
    const displayedNetWorth = data ? (viewMode === 'combined' ? data.netWorth : data.businessNetWorth) : 0

    return (
        <div className="space-y-6 w-full">
            {/* Hero Real-Time Net Worth Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                            <TrendingUp className="h-4 w-4" /> Real-Time Business &amp; Personal Net Worth
                        </div>
                        <div className="text-3xl md:text-4xl font-extrabold mt-2">
                            {loading ? 'Calculating...' : formatRs(displayedNetWorth)}
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                            Total Assets ({formatRs(displayedAssets)}) − Total Liabilities (
                            {formatRs(data?.totalLiabilities || 0)})
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex rounded-lg bg-white/10 p-1 text-xs">
                            <button
                                onClick={() => setViewMode('combined')}
                                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                                    viewMode === 'combined' ? 'bg-emerald-500 text-white' : 'text-slate-200'
                                }`}
                            >
                                Combined (All)
                            </button>
                            <button
                                onClick={() => setViewMode('business')}
                                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                                    viewMode === 'business' ? 'bg-emerald-500 text-white' : 'text-slate-200'
                                }`}
                            >
                                Business Only
                            </button>
                        </div>
                        <button
                            onClick={handleSaveSnapshot}
                            disabled={savingSnap || loading}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {savingSnap ? 'Saving...' : 'Save 15-Day Report Now'}
                        </button>
                        <button
                            onClick={loadAll}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                            title="Refresh Live Net Worth"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Assets vs Liabilities Two-Column Live Breakdown */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* ASSETS */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b dark:border-zinc-800 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center justify-between">
                            <h2 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                                Assets (What You Own)
                            </h2>
                            <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                                {formatRs(displayedAssets)}
                            </span>
                        </div>
                        <div className="divide-y dark:divide-zinc-800 text-sm">
                            <div className="px-5 py-3 flex justify-between">
                                <span>Company Banks (Live Balance)</span>
                                <span className="font-bold">{formatRs(data.companyBanksTotal)}</span>
                            </div>
                            <div className="px-5 py-3 flex justify-between">
                                <span>Business Cash in Hand</span>
                                <span className="font-bold">{formatRs(data.cashInHandTotal)}</span>
                            </div>
                            {viewMode === 'combined' && (
                                <div className="px-5 py-3 flex justify-between bg-purple-50/40 dark:bg-purple-950/20">
                                    <span>Personal Total (Personal Banks &amp; Wallets)</span>
                                    <span className="font-bold text-purple-700 dark:text-purple-300">
                                        {formatRs(data.personalTotal)}
                                    </span>
                                </div>
                            )}
                            <div className="px-5 py-3 flex justify-between">
                                <span>Warehouse Stock Valuation (Qty × Avg Cost)</span>
                                <span className="font-bold text-blue-700 dark:text-blue-400">
                                    {formatRs(data.warehouseStockValue)}
                                </span>
                            </div>
                            <div className="px-5 py-3 flex justify-between">
                                <span>Daraz Shipped (In-Transit @ Cost)</span>
                                <span className="font-semibold">{formatRs(data.darazInTransitValue)}</span>
                            </div>
                            <div className="px-5 py-3 flex justify-between">
                                <span>Daraz Delivered (Pending Weekly Payout)</span>
                                <span className="font-semibold">{formatRs(data.darazPendingPayout)}</span>
                            </div>
                            <div className="px-5 py-3 flex justify-between">
                                <span>Courier Shipped (In-Transit @ Cost)</span>
                                <span className="font-semibold">{formatRs(data.courierInTransitValue)}</span>
                            </div>
                            <div className="px-5 py-3 flex justify-between">
                                <span>Courier Delivered (Pending COD)</span>
                                <span className="font-semibold">{formatRs(data.courierPendingCod)}</span>
                            </div>
                            {data.partyReceivables > 0 && (
                                <div className="px-5 py-3 flex justify-between">
                                    <span>Supplier / Party Receivables</span>
                                    <span className="font-semibold">{formatRs(data.partyReceivables)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LIABILITIES + DAMAGED GOODS */}
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b dark:border-zinc-800 bg-rose-50/70 dark:bg-rose-950/30 flex items-center justify-between">
                                <h2 className="font-bold text-sm text-rose-900 dark:text-rose-200">
                                    Liabilities (What You Owe)
                                </h2>
                                <span className="font-extrabold text-rose-700 dark:text-rose-300">
                                    {formatRs(data.totalLiabilities)}
                                </span>
                            </div>
                            <div className="divide-y dark:divide-zinc-800 text-sm">
                                <div className="px-5 py-3 flex justify-between">
                                    <span>Party / Supplier Credit Due (Live Ledger)</span>
                                    <span className="font-bold text-rose-600">{formatRs(data.partyPayables)}</span>
                                </div>
                                <div className="px-5 py-3 flex justify-between">
                                    <span>Pending Supplier Cheques (Not Yet Cleared)</span>
                                    <span className="font-semibold text-amber-600">
                                        {formatRs(data.pendingChequesTotal)}
                                    </span>
                                </div>
                                <div className="px-5 py-3 flex items-center justify-between">
                                    <span>Loans &amp; Unpaid Fixed Bills</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-rose-600">
                                            {formatRs(data.otherLiabilitiesTotal)}
                                        </span>
                                        <button
                                            onClick={() => setLiabOpen(true)}
                                            className="p-1 rounded bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200"
                                            title="Add Loan or Unpaid Bill"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {data.otherLiabilities.length > 0 && (
                                <div className="p-3 bg-gray-50 dark:bg-zinc-800/40 border-t dark:border-zinc-800 space-y-1.5">
                                    {data.otherLiabilities.map((l) => (
                                        <div
                                            key={l.id}
                                            className="flex items-center justify-between text-xs bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg border dark:border-zinc-800"
                                        >
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={async () => {
                                                        await toggleOtherLiabilityPaid(l.id, !l.is_paid)
                                                        await loadAll()
                                                    }}
                                                    className={l.is_paid ? 'text-emerald-600' : 'text-gray-400'}
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </button>
                                                <span className={l.is_paid ? 'line-through text-gray-400' : 'font-medium'}>
                                                    {l.title}
                                                </span>
                                                {l.due_date && (
                                                    <span className="text-[11px] text-gray-400">Due: {l.due_date}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{formatRs(l.amount)}</span>
                                                <button
                                                    onClick={async () => {
                                                        await deleteOtherLiability(l.id)
                                                        await loadAll()
                                                    }}
                                                    className="text-gray-400 hover:text-rose-600"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Non-Cash Damaged Goods Info */}
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs space-y-1">
                                <div className="font-bold text-amber-900 dark:text-amber-200">
                                    Damaged Goods Loss (Non-Cash): {formatRs(data.damagedGoodsLoss)}
                                </div>
                                <p className="text-amber-800/80 dark:text-amber-300/80">
                                    Tracked separately from CashFlow so you don&apos;t double-count stock you already paid for. It automatically reduces your Warehouse Stock Valuation above.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 15-Day Net Worth Reports History & Analysis */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-emerald-600" />
                        <h2 className="font-bold text-sm">15-Day Net Worth Reports &amp; Growth Analysis</h2>
                    </div>
                    <span className="text-xs text-gray-500">Auto-saved every 15 days</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-2.5 text-left">Report Date</th>
                                <th className="px-4 py-2.5 text-right">Liquid Cash</th>
                                <th className="px-4 py-2.5 text-right">Warehouse Stock</th>
                                <th className="px-4 py-2.5 text-right">In-Transit &amp; Pending</th>
                                <th className="px-4 py-2.5 text-right">Liabilities</th>
                                <th className="px-4 py-2.5 text-right">Real Net Worth</th>
                                <th className="px-4 py-2.5 text-right">15-Day Change</th>
                                <th className="px-4 py-2.5 text-center">Report</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-800">
                            {snapshots.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-10 text-center text-xs text-gray-400">
                                        No saved 15-day reports yet. Click <strong>Save 15-Day Report Now</strong> above to create your first baseline report.
                                    </td>
                                </tr>
                            ) : (
                                snapshots.map((snap, idx) => {
                                    const prev = snapshots[idx + 1]
                                    const diff = prev ? snap.net_worth - prev.net_worth : null
                                    const liquid = snap.company_banks_total + snap.personal_total + snap.cash_in_hand_total
                                    const transitPending =
                                        snap.daraz_in_transit_value +
                                        snap.daraz_pending_payout +
                                        snap.courier_in_transit_value +
                                        snap.courier_pending_cod
                                    const fromParam = prev?.snapshot_date || ''
                                    const reportUrl = `/dashboard/account/transaction/report?date=${encodeURIComponent(snap.snapshot_date)}${
                                        fromParam ? `&from=${encodeURIComponent(fromParam)}` : ''
                                    }`
                                    return (
                                        <tr key={snap.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40">
                                            <td className="px-4 py-3 font-mono text-xs">
                                                <div className="font-bold">{snap.snapshot_date}</div>
                                                {snap.period_label && (
                                                    <div className="text-[11px] text-gray-400">{snap.period_label}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">{formatRs(liquid)}</td>
                                            <td className="px-4 py-3 text-right">{formatRs(snap.warehouse_stock_value)}</td>
                                            <td className="px-4 py-3 text-right">{formatRs(transitPending)}</td>
                                            <td className="px-4 py-3 text-right text-rose-600">
                                                {formatRs(snap.total_liabilities)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-extrabold">
                                                {formatRs(snap.net_worth)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {diff === null ? (
                                                    <span className="text-xs text-gray-400">Baseline</span>
                                                ) : (
                                                    <span
                                                        className={`inline-flex items-center gap-1 font-bold text-xs ${
                                                            diff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                                        }`}
                                                    >
                                                        {diff >= 0 ? (
                                                            <TrendingUp className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <TrendingDown className="h-3.5 w-3.5" />
                                                        )}
                                                        {diff >= 0 ? '+' : ''}
                                                        {formatRs(diff)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <a
                                                    href={reportUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-700 dark:hover:bg-emerald-700"
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    Report
                                                    <ExternalLink className="h-3 w-3 opacity-80" />
                                                </a>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Liability Modal */}
            {liabOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-sm w-full p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold">Add Loan / Unpaid Bill</h3>
                            <button onClick={() => setLiabOpen(false)}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddLiability} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Bank OD Loan, Unpaid Rent"
                                    value={liabTitle}
                                    onChange={(e) => setLiabTitle(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Category</label>
                                    <select
                                        value={liabCategory}
                                        onChange={(e) => setLiabCategory(e.target.value as any)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    >
                                        <option value="loan">Loan</option>
                                        <option value="unpaid_bill">Unpaid Bill</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Amount (Rs)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={liabAmount}
                                        onChange={(e) => setLiabAmount(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent font-bold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Due Date (optional)</label>
                                <input
                                    type="date"
                                    value={liabDue}
                                    onChange={(e) => setLiabDue(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setLiabOpen(false)} className="px-3 py-1.5 text-xs rounded-lg border">
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white">
                                    Save Liability
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
