'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    ArrowDownLeft,
    ArrowUpRight,
    ArrowLeftRight,
    Plus,
    Trash2,
    Search,
    RefreshCw,
    X,
    User,
} from 'lucide-react'
import {
    getCashTransactions,
    createCashTransaction,
    deleteCashTransaction,
} from '@/features/transaction/actions/cashflow-actions'
import {
    getFinancialAccounts,
    getAdminUsers,
    getCurrentUserProfile,
} from '@/features/transaction/actions/account-actions'
import {
    CASHFLOW_CATEGORIES,
    type CashFlowSummary,
    type CashTransaction,
    type FinancialAccount,
    type OwnerScope,
    type TransactionDirection,
} from '@/features/transaction/types'

function formatRs(n: number) {
    const sign = n < 0 ? '-' : ''
    return `${sign}Rs ${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
}

function getPresetRange(preset: 'this_week' | 'last_week' | 'this_month' | 'last_month') {
    const now = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    if (preset === 'this_week') {
        const day = now.getDay()
        const diff = day === 0 ? -6 : 1 - day
        const mon = new Date(now)
        mon.setDate(now.getDate() + diff)
        return { start: fmt(mon), end: fmt(now) }
    }
    if (preset === 'last_week') {
        const day = now.getDay()
        const diff = day === 0 ? -6 : 1 - day
        const thisMon = new Date(now)
        thisMon.setDate(now.getDate() + diff)
        const lastMon = new Date(thisMon)
        lastMon.setDate(thisMon.getDate() - 7)
        const lastSun = new Date(thisMon)
        lastSun.setDate(thisMon.getDate() - 1)
        return { start: fmt(lastMon), end: fmt(lastSun) }
    }
    if (preset === 'last_month') {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const last = new Date(now.getFullYear(), now.getMonth(), 0)
        return { start: fmt(first), end: fmt(last) }
    }
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: fmt(first), end: fmt(now) }
}

export default function CashFlowPage() {
    const initial = getPresetRange('this_month')
    const [startDate, setStartDate] = useState(initial.start)
    const [endDate, setEndDate] = useState(initial.end)
    const [accountFilter, setAccountFilter] = useState('all')
    const [directionFilter, setDirectionFilter] = useState<TransactionDirection | 'all'>('all')
    const [scopeFilter, setScopeFilter] = useState<OwnerScope | 'all'>('all')
    const [userFilter, setUserFilter] = useState('all')
    const [search, setSearch] = useState('')

    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [users, setUsers] = useState<Array<{ id: string; full_name: string; role: string }>>([])
    const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string; role: string } | null>(null)
    const [transactions, setTransactions] = useState<CashTransaction[]>([])
    const [summary, setSummary] = useState<CashFlowSummary | null>(null)
    const [loading, setLoading] = useState(true)

    // Add modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [direction, setDirection] = useState<TransactionDirection>('out')
    const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10))
    const [accountId, setAccountId] = useState('')
    const [transferToAccountId, setTransferToAccountId] = useState('')
    const [category, setCategory] = useState<string>(CASHFLOW_CATEGORIES.out[0].value)
    const [scope, setScope] = useState<OwnerScope>('business')
    const [amount, setAmount] = useState('')
    const [particular, setParticular] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [accList, userList, me, cf] = await Promise.all([
                getFinancialAccounts(),
                getAdminUsers(),
                getCurrentUserProfile(),
                getCashTransactions({
                    startDate,
                    endDate,
                    accountId,
                    direction: directionFilter,
                    scope: scopeFilter,
                    createdBy: userFilter,
                    search,
                }),
            ])
            setAccounts(accList)
            setUsers(userList)
            setCurrentUser(me)
            setTransactions(cf.transactions)
            setSummary(cf.summary)
        } catch (err) {
            console.error('Error loading CashFlow:', err)
        } finally {
            setLoading(false)
        }
    }, [startDate, endDate, accountId, directionFilter, scopeFilter, userFilter, search])

    useEffect(() => {
        loadData()
    }, [loadData])

    const openAddModal = (dir: TransactionDirection) => {
        setDirection(dir)
        const firstCat = CASHFLOW_CATEGORIES[dir][0]
        setCategory(firstCat.value)
        setScope(firstCat.scope)
        setTxDate(new Date().toISOString().slice(0, 10))
        setAmount('')
        setParticular('')
        setNotes('')

        // Auto-default to logged-in admin's own cash/personal account if available, else first company account
        const myOwnAcc = currentUser ? accounts.find((a) => a.owner_user_id === currentUser.id) : null
        const defaultAcc = myOwnAcc || accounts[0]
        setAccountId(defaultAcc?.id || '')
        const otherAcc = accounts.find((a) => a.id !== defaultAcc?.id)
        setTransferToAccountId(otherAcc?.id || '')
        setModalOpen(true)
    }

    const handleDirectionSwitch = (dir: TransactionDirection) => {
        setDirection(dir)
        const firstCat = CASHFLOW_CATEGORIES[dir][0]
        setCategory(firstCat.value)
        setScope(firstCat.scope)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!accountId) return alert('Please add a Bank or Cash account in Bank Statement first.')
        if (!Number(amount) || Number(amount) <= 0) return alert('Enter a valid amount')
        setSaving(true)
        try {
            await createCashTransaction({
                transaction_date: txDate,
                account_id: accountId,
                transfer_to_account_id: direction === 'transfer' ? transferToAccountId : null,
                direction,
                scope,
                category,
                amount: Number(amount),
                party_or_particular: particular,
                notes,
            })
            setModalOpen(false)
            await loadData()
        } catch (err: any) {
            alert(err?.message || 'Failed to save transaction')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this transaction? Bank balances will automatically recalculate.')) return
        try {
            await deleteCashTransaction(id)
            await loadData()
        } catch (err: any) {
            alert(err?.message || 'Failed to delete')
        }
    }

    return (
        <div className="space-y-5 w-full">
            {/* Top Action Bar & Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border dark:border-zinc-800 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {(
                        [
                            ['this_week', 'This Week'],
                            ['last_week', 'Last Week'],
                            ['this_month', 'This Month'],
                            ['last_month', 'Last Month'],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => {
                                const r = getPresetRange(key)
                                setStartDate(r.start)
                                setEndDate(r.end)
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                        >
                            {label}
                        </button>
                    ))}
                    <div className="flex items-center gap-1.5 ml-1">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-2.5 py-1.5 text-xs rounded-lg border dark:border-zinc-700 bg-transparent"
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-2.5 py-1.5 text-xs rounded-lg border dark:border-zinc-700 bg-transparent"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => openAddModal('in')}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        <ArrowDownLeft className="h-4 w-4" /> Money In
                    </button>
                    <button
                        onClick={() => openAddModal('out')}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                    >
                        <ArrowUpRight className="h-4 w-4" /> Money Out
                    </button>
                    <button
                        onClick={() => openAddModal('transfer')}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                        <ArrowLeftRight className="h-4 w-4" /> Transfer
                    </button>
                    <button
                        onClick={loadData}
                        className="p-2 rounded-lg border dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Summary KPI Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border dark:border-zinc-800">
                        <p className="text-xs text-gray-500">Opening Cash</p>
                        <p className="text-lg font-bold mt-1">{formatRs(summary.openingBalance)}</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900">
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">Money In</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                            +{formatRs(summary.totalMoneyIn)}
                        </p>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-950/30 p-4 rounded-xl border border-rose-200 dark:border-rose-900">
                        <p className="text-xs text-rose-700 dark:text-rose-300">Business Out</p>
                        <p className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-1">
                            -{formatRs(summary.businessMoneyOut)}
                        </p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-900">
                        <p className="text-xs text-amber-700 dark:text-amber-300">Personal Drawings</p>
                        <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-1">
                            -{formatRs(summary.personalDrawings)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border dark:border-zinc-800">
                        <p className="text-xs text-gray-500">Net Cash Flow</p>
                        <p
                            className={`text-lg font-bold mt-1 ${
                                summary.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                        >
                            {summary.netCashFlow >= 0 ? '+' : ''}
                            {formatRs(summary.netCashFlow)}
                        </p>
                    </div>
                    <div className="bg-slate-900 dark:bg-zinc-800 text-white p-4 rounded-xl">
                        <p className="text-xs text-slate-300">Closing Cash</p>
                        <p className="text-lg font-bold mt-1">{formatRs(summary.closingBalance)}</p>
                    </div>
                </div>
            )}

            {/* Category Breakdown Strip */}
            {summary && summary.byCategory.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border dark:border-zinc-800">
                    <h2 className="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">
                        Breakdown by Type ({startDate} to {endDate})
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {summary.byCategory.map((c) => (
                            <div
                                key={`${c.direction}-${c.scope}-${c.category}`}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                                    c.direction === 'in'
                                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300'
                                        : 'bg-rose-50/70 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300'
                                }`}
                            >
                                <span>{c.category}</span>
                                <span className="font-bold">{formatRs(c.total)}</span>
                                <span className="opacity-60">({c.count})</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-zinc-900 p-3 rounded-xl border dark:border-zinc-800">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search particular, category, bank, person..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                    />
                </div>
                <select
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                    <option value="all">All Accounts</option>
                    {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.name} ({a.owner_scope})
                        </option>
                    ))}
                </select>
                <select
                    value={directionFilter}
                    onChange={(e) => setDirectionFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                    <option value="all">All Types</option>
                    <option value="in">Money In</option>
                    <option value="out">Money Out</option>
                    <option value="transfer">Transfer</option>
                </select>
                <select
                    value={scopeFilter}
                    onChange={(e) => setScopeFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                    <option value="all">Business + Personal</option>
                    <option value="business">Business Only</option>
                    <option value="personal">Personal Only</option>
                </select>
                <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                    <option value="all">By: Everyone</option>
                    {users.map((u) => (
                        <option key={u.id} value={u.id}>
                            By: {u.full_name}
                        </option>
                    ))}
                </select>
            </div>

            {/* CashFlow Ledger Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Type / Category</th>
                                <th className="px-4 py-3 text-left">Particular &amp; Notes</th>
                                <th className="px-4 py-3 text-left">Account</th>
                                <th className="px-4 py-3 text-left">Entered By</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-gray-400">
                                        Loading cash flow...
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-gray-400">
                                        No transactions in this period. Click <strong>Money In</strong>,{' '}
                                        <strong>Money Out</strong>, or <strong>Transfer</strong> to record one.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40">
                                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                                            {tx.transaction_date}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                        tx.direction === 'in'
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                            : tx.direction === 'out'
                                                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                                    }`}
                                                >
                                                    {tx.direction === 'in'
                                                        ? 'IN'
                                                        : tx.direction === 'out'
                                                        ? 'OUT'
                                                        : 'TRANSFER'}
                                                </span>
                                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                                    {tx.category}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-800 dark:text-gray-200">
                                                {tx.party_or_particular || '—'}
                                            </div>
                                            {tx.notes && (
                                                <div className="text-xs text-gray-500 truncate max-w-xs">
                                                    {tx.notes}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            <div className="font-medium">{tx.account_name}</div>
                                            {tx.direction === 'transfer' && tx.transfer_to_account_name && (
                                                <div className="text-blue-600 dark:text-blue-400">
                                                    → {tx.transfer_to_account_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300">
                                                <User className="h-3 w-3" />
                                                {tx.creator_name || 'Admin'}
                                            </span>
                                        </td>
                                        <td
                                            className={`px-4 py-3 text-right font-bold whitespace-nowrap ${
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
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleDelete(tx.id)}
                                                className="p-1.5 text-gray-400 hover:text-rose-600 rounded"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Cash Transaction Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-md w-full p-5 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold">Record CashFlow Transaction</h3>
                            <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {currentUser && (
                            <div className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                Recording automatically as: <strong>{currentUser.full_name}</strong>
                            </div>
                        )}

                        {/* Direction Switcher */}
                        <div className="grid grid-cols-3 gap-2">
                            {(
                                [
                                    ['in', 'Money In', 'bg-emerald-600'],
                                    ['out', 'Money Out', 'bg-rose-600'],
                                    ['transfer', 'Transfer', 'bg-blue-600'],
                                ] as const
                            ).map(([dir, label, activeBg]) => (
                                <button
                                    key={dir}
                                    type="button"
                                    onClick={() => handleDirectionSwitch(dir)}
                                    className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                                        direction === dir
                                            ? `${activeBg} text-white border-transparent`
                                            : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={txDate}
                                        onChange={(e) => setTxDate(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Amount (Rs)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        required
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    {direction === 'transfer' ? 'From Account (Bank / Cash)' : 'Account (Bank / Cash / Wallet)'}
                                </label>
                                <select
                                    required
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                >
                                    <option value="">-- Select Account --</option>
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name} ({a.owner_scope === 'business' ? 'Company' : 'Personal'} • {formatRs(a.current_balance)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {direction === 'transfer' && (
                                <div>
                                    <label className="block text-xs font-medium mb-1">To Account (Bank / Cash / Wallet)</label>
                                    <select
                                        required
                                        value={transferToAccountId}
                                        onChange={(e) => setTransferToAccountId(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    >
                                        <option value="">-- Select Destination --</option>
                                        {accounts
                                            .filter((a) => a.id !== accountId)
                                            .map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name} ({a.owner_scope === 'business' ? 'Company' : 'Personal'})
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Type / Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setCategory(val)
                                            const found = CASHFLOW_CATEGORIES[direction].find((c) => c.value === val)
                                            if (found) setScope(found.scope)
                                        }}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    >
                                        {CASHFLOW_CATEGORIES[direction].map((c) => (
                                            <option key={c.value} value={c.value}>
                                                {c.value}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Scope</label>
                                    <select
                                        value={scope}
                                        onChange={(e) => setScope(e.target.value as OwnerScope)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    >
                                        <option value="business">Business</option>
                                        <option value="personal">Personal</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">Particular / Party Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Shop Rent, Supplier ABC, ATM Cash..."
                                    value={particular}
                                    onChange={(e) => setParticular(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">Notes (optional)</label>
                                <input
                                    type="text"
                                    placeholder="Any remarks..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 text-sm rounded-lg border dark:border-zinc-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <Plus className="h-4 w-4" />
                                    {saving ? 'Saving...' : 'Save Transaction'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
