'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    ShoppingBag,
    Truck,
    CheckCircle2,
    Plus,
    Trash2,
    RefreshCw,
    X,
    AlertTriangle,
    Clock,
} from 'lucide-react'
import {
    getDarazSettlementData,
    verifyDarazSettlement,
    getCourierSettlementData,
    verifyCourierSettlement,
} from '@/features/transaction/actions/settlement-actions'
import { getFinancialAccounts } from '@/features/transaction/actions/account-actions'
import type {
    CourierSettlementCard,
    CourierSettlementHistoryRow,
    DarazStoreSettlementCard,
    DarazWeeklySettlementRow,
    FinancialAccount,
} from '@/features/transaction/types'

function formatRs(n: number) {
    const sign = n < 0 ? '-' : ''
    return `${sign}Rs ${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
}

interface BankAllocRow {
    accountId: string
    amount: string
}

export default function SettlementsPage() {
    const [activeTab, setActiveTab] = useState<'daraz' | 'courier'>('daraz')
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])

    // Daraz state
    const [darazStores, setDarazStores] = useState<DarazStoreSettlementCard[]>([])
    const [darazWeeks, setDarazWeeks] = useState<DarazWeeklySettlementRow[]>([])
    const [darazShippedTotal, setDarazShippedTotal] = useState(0)
    const [darazExpectedTotal, setDarazExpectedTotal] = useState(0)

    // Courier state
    const [couriers, setCouriers] = useState<CourierSettlementCard[]>([])
    const [courierHistory, setCourierHistory] = useState<CourierSettlementHistoryRow[]>([])
    const [courierNames, setCourierNames] = useState<string[]>([])
    const [courierShippedTotal, setCourierShippedTotal] = useState(0)
    const [courierExpectedTotal, setCourierExpectedTotal] = useState(0)

    // Daraz Verify Popup state
    const [verifyingDaraz, setVerifyingDaraz] = useState<DarazWeeklySettlementRow | null>(null)
    const [darazAllocations, setDarazAllocations] = useState<BankAllocRow[]>([])
    const [darazVarianceType, setDarazVarianceType] = useState<'penalty_fee' | 'carry_forward'>('penalty_fee')
    const [darazDate, setDarazDate] = useState(new Date().toISOString().slice(0, 10))
    const [darazNotes, setDarazNotes] = useState('')
    const [savingDaraz, setSavingDaraz] = useState(false)

    // Courier Verify Popup state
    const [courierModalOpen, setCourierModalOpen] = useState(false)
    const [selectedCourierName, setSelectedCourierName] = useState('')
    const [customCourierName, setCustomCourierName] = useState('')
    const [selectedCourierCard, setSelectedCourierCard] = useState<CourierSettlementCard | null>(null)
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
    const [courierExpectedInput, setCourierExpectedInput] = useState('')
    const [courierAllocations, setCourierAllocations] = useState<BankAllocRow[]>([])
    const [courierVarianceType, setCourierVarianceType] = useState<'delivery_rto_fee' | 'carry_forward'>('delivery_rto_fee')
    const [courierDate, setCourierDate] = useState(new Date().toISOString().slice(0, 10))
    const [courierNotes, setCourierNotes] = useState('')
    const [savingCourier, setSavingCourier] = useState(false)

    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const [accList, dData, cData] = await Promise.all([
                getFinancialAccounts(),
                getDarazSettlementData(),
                getCourierSettlementData(),
            ])
            setAccounts(accList)
            setDarazStores(dData.stores)
            setDarazWeeks(dData.weeklyRows)
            setDarazShippedTotal(dData.totalShippedCost)
            setDarazExpectedTotal(dData.totalExpectedDelivered)

            setCouriers(cData.couriers)
            setCourierHistory(cData.history)
            setCourierNames(cData.courierNames)
            setCourierShippedTotal(cData.totalShippedCost)
            setCourierExpectedTotal(cData.totalExpectedCod)
        } catch (err) {
            console.error('Error loading settlements:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    // Open Daraz Split-Bank Verify Modal
    const openDarazVerify = (row: DarazWeeklySettlementRow) => {
        setVerifyingDaraz(row)
        setDarazAllocations([{ accountId: accounts[0]?.id || '', amount: String(Math.round(row.expectedAmount)) }])
        setDarazVarianceType('penalty_fee')
        setDarazDate(new Date().toISOString().slice(0, 10))
        setDarazNotes('')
    }

    const darazEnteredSum = darazAllocations.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const darazUnsettled = verifyingDaraz ? Math.round((verifyingDaraz.expectedAmount - darazEnteredSum) * 100) / 100 : 0

    const handleSaveDarazVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!verifyingDaraz) return
        setSavingDaraz(true)
        try {
            await verifyDarazSettlement({
                weekStart: verifyingDaraz.weekStart,
                weekEnd: verifyingDaraz.weekEnd,
                sellerAccount: verifyingDaraz.sellerAccount,
                storeId: verifyingDaraz.storeId,
                expectedAmount: verifyingDaraz.expectedAmount,
                allocations: darazAllocations.map((a) => ({ accountId: a.accountId, amount: Number(a.amount) || 0 })),
                varianceType: Math.abs(darazUnsettled) < 0.01 ? 'exact' : darazVarianceType,
                settlementDate: darazDate,
                notes: darazNotes,
            })
            setVerifyingDaraz(null)
            await loadAll()
        } catch (err: any) {
            alert(err?.message || 'Failed to verify Daraz settlement')
        } finally {
            setSavingDaraz(false)
        }
    }

    // Open Courier Split-Bank Verify Modal
    const openCourierVerify = (card: CourierSettlementCard | null) => {
        setSelectedCourierCard(card)
        setSelectedCourierName(card ? card.courierName : courierNames[0] || '__custom__')
        setCustomCourierName('')
        const ids = new Set(card ? card.orders.map((o) => o.id) : [])
        setSelectedOrderIds(ids)
        const exp = card ? Math.round(card.expectedCodAmount) : 0
        setCourierExpectedInput(String(exp))
        setCourierAllocations([{ accountId: accounts[0]?.id || '', amount: exp > 0 ? String(exp) : '' }])
        setCourierVarianceType('delivery_rto_fee')
        setCourierDate(new Date().toISOString().slice(0, 10))
        setCourierNotes('')
        setCourierModalOpen(true)
    }

    const toggleCourierOrder = (orderId: string) => {
        if (!selectedCourierCard) return
        const next = new Set(selectedOrderIds)
        if (next.has(orderId)) next.delete(orderId)
        else next.add(orderId)
        setSelectedOrderIds(next)
        const newExpected = selectedCourierCard.orders
            .filter((o) => next.has(o.id))
            .reduce((s, o) => s + o.net_cod, 0)
        setCourierExpectedInput(String(Math.round(newExpected)))
    }

    const courierExpectedNum = Number(courierExpectedInput) || 0
    const courierEnteredSum = courierAllocations.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const courierUnsettled = Math.round((courierExpectedNum - courierEnteredSum) * 100) / 100

    const handleSaveCourierVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        const finalCourierName =
            selectedCourierName === '__custom__' ? customCourierName.trim() : selectedCourierName
        if (!finalCourierName) return alert('Please enter a Courier Name')

        const mpIds = selectedCourierCard
            ? selectedCourierCard.orders
                  .filter((o) => o.source === 'marketplace' && selectedOrderIds.has(o.id))
                  .map((o) => o.id)
            : []
        const webIds = selectedCourierCard
            ? selectedCourierCard.orders
                  .filter((o) => o.source === 'website' && selectedOrderIds.has(o.id))
                  .map((o) => o.id)
            : []

        setSavingCourier(true)
        try {
            await verifyCourierSettlement({
                courierName: finalCourierName,
                courierId: selectedCourierCard?.courierId || null,
                expectedAmount: courierExpectedNum,
                allocations: courierAllocations.map((a) => ({ accountId: a.accountId, amount: Number(a.amount) || 0 })),
                varianceType: Math.abs(courierUnsettled) < 0.01 ? 'exact' : courierVarianceType,
                marketplaceOrderIds: mpIds,
                websiteOrderIds: webIds,
                settlementDate: courierDate,
                notes: courierNotes,
            })
            setCourierModalOpen(false)
            await loadAll()
        } catch (err: any) {
            alert(err?.message || 'Failed to verify courier settlement')
        } finally {
            setSavingCourier(false)
        }
    }

    return (
        <div className="space-y-5 w-full">
            {/* Top Combined Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 p-4 rounded-xl">
                    <p className="text-xs text-orange-700 dark:text-orange-300">Daraz Shipped (Real-Time Cost)</p>
                    <p className="text-xl font-bold text-orange-800 dark:text-orange-200 mt-1">
                        {formatRs(darazShippedTotal)}
                    </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 rounded-xl">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Daraz Expected Delivered</p>
                    <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                        {formatRs(darazExpectedTotal)}
                    </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 rounded-xl">
                    <p className="text-xs text-blue-700 dark:text-blue-300">Courier Shipped (Real-Time Cost)</p>
                    <p className="text-xl font-bold text-blue-800 dark:text-blue-200 mt-1">
                        {formatRs(courierShippedTotal)}
                    </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 p-4 rounded-xl">
                    <p className="text-xs text-purple-700 dark:text-purple-300">Courier Expected COD</p>
                    <p className="text-xl font-bold text-purple-800 dark:text-purple-200 mt-1">
                        {formatRs(courierExpectedTotal)}
                    </p>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('daraz')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                            activeTab === 'daraz'
                                ? 'bg-orange-600 text-white border-transparent'
                                : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700'
                        }`}
                    >
                        <ShoppingBag className="h-4 w-4" /> Daraz Settlement (Mon–Sun)
                    </button>
                    <button
                        onClick={() => setActiveTab('courier')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                            activeTab === 'courier'
                                ? 'bg-blue-600 text-white border-transparent'
                                : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700'
                        }`}
                    >
                        <Truck className="h-4 w-4" /> Courier / Logistics Settlement
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {activeTab === 'courier' && (
                        <button
                            onClick={() => openCourierVerify(null)}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4" /> Manual Courier Settlement
                        </button>
                    )}
                    <button
                        onClick={loadAll}
                        className="p-2 rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* TAB 1: DARAZ SETTLEMENTS */}
            {activeTab === 'daraz' && (
                <div className="space-y-5">
                    {/* 4 Daraz Store Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {darazStores.map((st) => (
                            <div
                                key={st.sellerAccount}
                                className="bg-white dark:bg-zinc-900 p-4 rounded-xl border dark:border-zinc-800 space-y-2 shadow-sm"
                            >
                                <div className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                                    {st.sellerAccount}
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Shipped ({st.shippedCount}):</span>
                                    <span className="font-semibold text-orange-600">{formatRs(st.shippedCostValue)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Expected Delivered ({st.deliveredUnsettledCount}):</span>
                                    <span className="font-bold text-emerald-600">
                                        {formatRs(st.expectedDeliveredAmount)}
                                    </span>
                                </div>
                                {st.carryForwardAmount > 0 && (
                                    <div className="flex justify-between text-xs text-amber-600">
                                        <span>Carry Forward:</span>
                                        <span className="font-semibold">{formatRs(st.carryForwardAmount)}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Weekly Mon-Sun Settlement Table */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b dark:border-zinc-800 font-bold text-sm">
                            Weekly Daraz Settlements (Monday to Sunday — Based on Delivered Date)
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left">Week (Mon – Sun)</th>
                                        <th className="px-4 py-2.5 text-left">Daraz Store</th>
                                        <th className="px-4 py-2.5 text-right">Expected Amount</th>
                                        <th className="px-4 py-2.5 text-right">Received in Banks</th>
                                        <th className="px-4 py-2.5 text-right">Unsettled / Penalty</th>
                                        <th className="px-4 py-2.5 text-center">Status / Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-zinc-800">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="py-10 text-center text-gray-400">
                                                Calculating weekly Daraz settlements...
                                            </td>
                                        </tr>
                                    ) : darazWeeks.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-10 text-center text-gray-400">
                                                No delivered Daraz orders found in the last 90 days.
                                            </td>
                                        </tr>
                                    ) : (
                                        darazWeeks.map((row) => (
                                            <tr key={`${row.weekStart}-${row.sellerAccount}`} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40">
                                                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                                    {row.weekStart} → {row.weekEnd}
                                                    <div className="text-[11px] text-gray-400">{row.orderCount} orders</div>
                                                </td>
                                                <td className="px-4 py-3 font-medium">{row.sellerAccount}</td>
                                                <td className="px-4 py-3 text-right font-bold">
                                                    {formatRs(row.expectedAmount)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {row.status === 'verified' ? (
                                                        <div>
                                                            <div className="font-bold text-emerald-600">
                                                                {formatRs(row.receivedTotal)}
                                                            </div>
                                                            <div className="text-[11px] text-gray-500">
                                                                {row.allocations.map((a) => `${a.account_name}: ${formatRs(a.amount)}`).join(' | ')}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs">
                                                    {row.status === 'verified' ? (
                                                        Math.abs(row.unsettledAmount) < 1 ? (
                                                            <span className="text-emerald-600 font-semibold">Exact Match</span>
                                                        ) : (
                                                            <span className="text-amber-600 font-semibold">
                                                                {formatRs(row.unsettledAmount)} (
                                                                {row.varianceType === 'carry_forward' ? 'Carry Fwd' : 'Penalty/Fee'})
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-gray-400">Pending</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {row.status === 'verified' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => openDarazVerify(row)}
                                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white ${
                                                                row.isWeekCompleted
                                                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                                                    : 'bg-gray-500 hover:bg-gray-600'
                                                            }`}
                                                        >
                                                            {row.isWeekCompleted ? 'Verify Payout' : 'In Progress (Verify)'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: COURIER / LOGISTICS SETTLEMENTS */}
            {activeTab === 'courier' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {couriers.length === 0 ? (
                            <div className="col-span-full bg-white dark:bg-zinc-900 p-8 rounded-xl border dark:border-zinc-800 text-center text-sm text-gray-400">
                                No pending Shipped or Delivered courier orders right now.
                            </div>
                        ) : (
                            couriers.map((c) => (
                                <div
                                    key={c.courierName}
                                    className="bg-white dark:bg-zinc-900 p-4 rounded-xl border dark:border-zinc-800 shadow-sm flex flex-col justify-between gap-3"
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-base">{c.courierName}</h3>
                                            <Truck className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div className="mt-2 space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Shipped In-Transit ({c.shippedCount}):</span>
                                                <span className="font-semibold text-blue-600">{formatRs(c.shippedCostValue)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Delivered Pending COD ({c.deliveredUnsettledCount}):</span>
                                                <span className="font-bold text-emerald-600 text-sm">
                                                    {formatRs(c.expectedCodAmount)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openCourierVerify(c)}
                                        disabled={c.deliveredUnsettledCount === 0}
                                        className="w-full py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                                    >
                                        Verify &amp; Receive Payout ({c.deliveredUnsettledCount} orders)
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Courier Verified History */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b dark:border-zinc-800 font-bold text-sm">
                            Verified Courier Settlements History
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left">Date</th>
                                        <th className="px-4 py-2.5 text-left">Courier Name</th>
                                        <th className="px-4 py-2.5 text-right">Expected COD</th>
                                        <th className="px-4 py-2.5 text-right">Received in Banks</th>
                                        <th className="px-4 py-2.5 text-right">Unsettled / Deduction</th>
                                        <th className="px-4 py-2.5 text-left">Verified By</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-zinc-800">
                                    {courierHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                                                No verified courier settlements yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        courierHistory.map((h) => (
                                            <tr key={h.id}>
                                                <td className="px-4 py-2.5 font-mono text-xs">{h.settlement_date}</td>
                                                <td className="px-4 py-2.5 font-medium">
                                                    {h.courier_name}
                                                    <div className="text-[11px] text-gray-400">{h.order_count} orders</div>
                                                </td>
                                                <td className="px-4 py-2.5 text-right">{formatRs(h.expected_amount)}</td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <div className="font-bold text-emerald-600">{formatRs(h.received_total)}</div>
                                                    <div className="text-[11px] text-gray-500">
                                                        {h.allocations.map((a) => `${a.account_name}: ${formatRs(a.amount)}`).join(' | ')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-xs text-amber-600 font-semibold">
                                                    {Math.abs(h.unsettled_amount) < 1 ? 'Exact' : formatRs(h.unsettled_amount)}
                                                </td>
                                                <td className="px-4 py-2.5 text-xs">{h.verified_by_name}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* DARAZ SPLIT-BANK VERIFY MODAL */}
            {verifyingDaraz && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Verify Daraz Payout</h3>
                                <p className="text-xs text-gray-500">
                                    {verifyingDaraz.sellerAccount} • {verifyingDaraz.weekStart} to {verifyingDaraz.weekEnd}
                                </p>
                            </div>
                            <button onClick={() => setVerifyingDaraz(null)}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Top Live Expected vs Unsettled Banner */}
                        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900 text-white text-center">
                            <div>
                                <div className="text-[11px] text-slate-300">Expected Amount</div>
                                <div className="text-base font-bold">{formatRs(verifyingDaraz.expectedAmount)}</div>
                            </div>
                            <div>
                                <div className="text-[11px] text-emerald-300">Entered in Banks</div>
                                <div className="text-base font-bold text-emerald-400">{formatRs(darazEnteredSum)}</div>
                            </div>
                            <div>
                                <div className="text-[11px] text-amber-300">Unsettled / Diff</div>
                                <div className="text-base font-bold text-amber-400">{formatRs(darazUnsettled)}</div>
                            </div>
                        </div>

                        <form onSubmit={handleSaveDarazVerify} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Payout Received Date</label>
                                <input
                                    type="date"
                                    required
                                    value={darazDate}
                                    onChange={(e) => setDarazDate(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>

                            {/* Split Bank Rows */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold">Received Across Banks (Company &amp; Personal)</label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setDarazAllocations([
                                                ...darazAllocations,
                                                { accountId: accounts[0]?.id || '', amount: '' },
                                            ])
                                        }
                                        className="text-xs font-semibold text-emerald-600 flex items-center gap-1"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Another Bank
                                    </button>
                                </div>
                                {darazAllocations.map((row, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <select
                                            required
                                            value={row.accountId}
                                            onChange={(e) => {
                                                const copy = [...darazAllocations]
                                                copy[idx].accountId = e.target.value
                                                setDarazAllocations(copy)
                                            }}
                                            className="flex-1 px-3 py-2 text-xs rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                        >
                                            <option value="">-- Select Bank --</option>
                                            {accounts.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name} ({a.owner_scope === 'business' ? 'Company' : 'Personal'})
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            required
                                            placeholder="Amount"
                                            value={row.amount}
                                            onChange={(e) => {
                                                const copy = [...darazAllocations]
                                                copy[idx].amount = e.target.value
                                                setDarazAllocations(copy)
                                            }}
                                            className="w-32 px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent font-bold"
                                        />
                                        {darazAllocations.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setDarazAllocations(darazAllocations.filter((_, i) => i !== idx))
                                                }
                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {Math.abs(darazUnsettled) >= 1 && (
                                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                                        <AlertTriangle className="h-4 w-4" />
                                        Unsettled Amount: {formatRs(darazUnsettled)} — How to handle?
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDarazVarianceType('penalty_fee')}
                                            className={`p-2 text-xs rounded-lg border text-left ${
                                                darazVarianceType === 'penalty_fee'
                                                    ? 'bg-amber-600 text-white border-transparent font-semibold'
                                                    : 'bg-white dark:bg-zinc-900 border-amber-300'
                                            }`}
                                        >
                                            Penalty / Fine / Extra Daraz Fee
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDarazVarianceType('carry_forward')}
                                            className={`p-2 text-xs rounded-lg border text-left ${
                                                darazVarianceType === 'carry_forward'
                                                    ? 'bg-amber-600 text-white border-transparent font-semibold'
                                                    : 'bg-white dark:bg-zinc-900 border-amber-300'
                                            }`}
                                        >
                                            Carry Forward to Next Week
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium mb-1">Investigation / Notes</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Rs 500 claim penalty / free shipping deduction..."
                                    value={darazNotes}
                                    onChange={(e) => setDarazNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setVerifyingDaraz(null)} className="px-4 py-2 text-xs rounded-lg border">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingDaraz}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    {savingDaraz ? 'Verifying...' : 'Verify & Update Banks'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* COURIER SPLIT-BANK VERIFY MODAL */}
            {courierModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold">Verify Courier / Logistics Payout</h3>
                            <button onClick={() => setCourierModalOpen(false)}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900 text-white text-center">
                            <div>
                                <div className="text-[11px] text-slate-300">Expected COD</div>
                                <div className="text-base font-bold">{formatRs(courierExpectedNum)}</div>
                            </div>
                            <div>
                                <div className="text-[11px] text-emerald-300">Entered in Banks</div>
                                <div className="text-base font-bold text-emerald-400">{formatRs(courierEnteredSum)}</div>
                            </div>
                            <div>
                                <div className="text-[11px] text-amber-300">Unsettled / Diff</div>
                                <div className="text-base font-bold text-amber-400">{formatRs(courierUnsettled)}</div>
                            </div>
                        </div>

                        <form onSubmit={handleSaveCourierVerify} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Courier Name</label>
                                    <select
                                        value={selectedCourierName}
                                        onChange={(e) => setSelectedCourierName(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    >
                                        {courierNames.map((n) => (
                                            <option key={n} value={n}>
                                                {n}
                                            </option>
                                        ))}
                                        <option value="__custom__">+ Add New Courier Name</option>
                                    </select>
                                    {selectedCourierName === '__custom__' && (
                                        <input
                                            type="text"
                                            required
                                            placeholder="Type Courier Name (e.g., Pathao, NCM)"
                                            value={customCourierName}
                                            onChange={(e) => setCustomCourierName(e.target.value)}
                                            className="w-full mt-2 px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Settlement Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={courierDate}
                                        onChange={(e) => setCourierDate(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                    />
                                </div>
                            </div>

                            {selectedCourierCard && selectedCourierCard.orders.length > 0 && (
                                <div className="border dark:border-zinc-800 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                                    <div className="text-xs font-semibold text-gray-500 px-1">
                                        Delivered Orders Included ({selectedOrderIds.size}/{selectedCourierCard.orders.length})
                                    </div>
                                    {selectedCourierCard.orders.map((o) => (
                                        <label
                                            key={o.id}
                                            className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                                        >
                                            <span className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOrderIds.has(o.id)}
                                                    onChange={() => toggleCourierOrder(o.id)}
                                                />
                                                <span className="font-mono">{o.sales_id}</span>
                                                <span className="text-gray-500">{o.customer_name}</span>
                                            </span>
                                            <span className="font-semibold">{formatRs(o.net_cod)}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium mb-1">Expected Amount (Rs)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={courierExpectedInput}
                                    onChange={(e) => setCourierExpectedInput(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent font-bold"
                                />
                            </div>

                            {/* Split Bank Rows */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold">Received Across Banks (Company &amp; Personal)</label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCourierAllocations([
                                                ...courierAllocations,
                                                { accountId: accounts[0]?.id || '', amount: '' },
                                            ])
                                        }
                                        className="text-xs font-semibold text-emerald-600 flex items-center gap-1"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Another Bank
                                    </button>
                                </div>
                                {courierAllocations.map((row, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <select
                                            required
                                            value={row.accountId}
                                            onChange={(e) => {
                                                const copy = [...courierAllocations]
                                                copy[idx].accountId = e.target.value
                                                setCourierAllocations(copy)
                                            }}
                                            className="flex-1 px-3 py-2 text-xs rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                        >
                                            <option value="">-- Select Bank --</option>
                                            {accounts.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name} ({a.owner_scope === 'business' ? 'Company' : 'Personal'})
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            required
                                            placeholder="Amount"
                                            value={row.amount}
                                            onChange={(e) => {
                                                const copy = [...courierAllocations]
                                                copy[idx].amount = e.target.value
                                                setCourierAllocations(copy)
                                            }}
                                            className="w-32 px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent font-bold"
                                        />
                                        {courierAllocations.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setCourierAllocations(courierAllocations.filter((_, i) => i !== idx))
                                                }
                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {Math.abs(courierUnsettled) >= 1 && (
                                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                                    <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                        Difference: {formatRs(courierUnsettled)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCourierVarianceType('delivery_rto_fee')}
                                            className={`p-2 text-xs rounded-lg border ${
                                                courierVarianceType === 'delivery_rto_fee'
                                                    ? 'bg-amber-600 text-white border-transparent font-semibold'
                                                    : 'bg-white dark:bg-zinc-900 border-amber-300'
                                            }`}
                                        >
                                            Delivery / RTO Deduction
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCourierVarianceType('carry_forward')}
                                            className={`p-2 text-xs rounded-lg border ${
                                                courierVarianceType === 'carry_forward'
                                                    ? 'bg-amber-600 text-white border-transparent font-semibold'
                                                    : 'bg-white dark:bg-zinc-900 border-amber-300'
                                            }`}
                                        >
                                            Carry Forward
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium mb-1">Notes</label>
                                <input
                                    type="text"
                                    placeholder="Settlement remarks..."
                                    value={courierNotes}
                                    onChange={(e) => setCourierNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setCourierModalOpen(false)} className="px-4 py-2 text-xs rounded-lg border">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingCourier}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    {savingCourier ? 'Saving...' : 'Verify & Update Banks'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
