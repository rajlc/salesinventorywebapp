'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    Landmark,
    Wallet,
    Banknote,
    Plus,
    BookOpen,
    Scale,
    FileCheck2,
    BellRing,
    Check,
    X,
    RefreshCw,
    User,
    ArrowLeftRight,
} from 'lucide-react'
import { createCashTransaction } from '@/features/transaction/actions/cashflow-actions'
import {
    getFinancialAccounts,
    createFinancialAccount,
    reconcileFinancialAccount,
    getAccountPassbook,
    getSupplierCheques,
    markSupplierChequeCleared,
    getPendingSmsAlerts,
    approvePendingSmsAlert,
    ignorePendingSmsAlert,
    getAdminUsers,
} from '@/features/transaction/actions/account-actions'
import type {
    AccountType,
    FinancialAccount,
    OwnerScope,
    PassbookEntry,
    PendingSmsAlert,
    SupplierChequeItem,
} from '@/features/transaction/types'

function formatRs(n: number) {
    const sign = n < 0 ? '-' : ''
    return `${sign}Rs ${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
}

export default function BankStatementPage() {
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [cheques, setCheques] = useState<SupplierChequeItem[]>([])
    const [smsAlerts, setSmsAlerts] = useState<PendingSmsAlert[]>([])
    const [users, setUsers] = useState<Array<{ id: string; full_name: string; role: string }>>([])
    const [loading, setLoading] = useState(true)

    // Add Account modal
    const [addOpen, setAddOpen] = useState(false)
    const [accName, setAccName] = useState('')
    const [accType, setAccType] = useState<AccountType>('bank')
    const [accScope, setAccScope] = useState<OwnerScope>('business')
    const [accOwnerUserId, setAccOwnerUserId] = useState('')
    const [accLast4, setAccLast4] = useState('')
    const [accOpening, setAccOpening] = useState('')
    const [savingAcc, setSavingAcc] = useState(false)

    // Passbook modal
    const [passbookOpen, setPassbookOpen] = useState(false)
    const [passbookAccount, setPassbookAccount] = useState<FinancialAccount | null>(null)
    const [passbookEntries, setPassbookEntries] = useState<PassbookEntry[]>([])
    const [passbookLoading, setPassbookLoading] = useState(false)

    // Reconcile modal
    const [reconcileAcc, setReconcileAcc] = useState<FinancialAccount | null>(null)
    const [actualBal, setActualBal] = useState('')
    const [reconcileNotes, setReconcileNotes] = useState('')

    // Fund Transfer (Own Accounts) modal
    const [transferOpen, setTransferOpen] = useState(false)
    const [transferFromId, setTransferFromId] = useState('')
    const [transferToId, setTransferToId] = useState('')
    const [transferAmount, setTransferAmount] = useState('')
    const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10))
    const [transferNotes, setTransferNotes] = useState('')
    const [savingTransfer, setSavingTransfer] = useState(false)

    // Clear cheque modal
    const [clearingCheque, setClearingCheque] = useState<SupplierChequeItem | null>(null)
    const [chequeBankId, setChequeBankId] = useState('')

    // Approve SMS modal
    const [approvingSms, setApprovingSms] = useState<PendingSmsAlert | null>(null)
    const [smsAccountId, setSmsAccountId] = useState('')
    const [smsAction, setSmsAction] = useState<'money_in' | 'money_out' | 'transfer_to_cash' | 'transfer_to_account'>('money_in')
    const [smsTargetId, setSmsTargetId] = useState('')
    const [smsCategory, setSmsCategory] = useState('Daraz Payout')
    const [smsParticular, setSmsParticular] = useState('')

    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const [accList, chequeList, alertList, userList] = await Promise.all([
                getFinancialAccounts(),
                getSupplierCheques(),
                getPendingSmsAlerts(),
                getAdminUsers(),
            ])
            setAccounts(accList)
            setCheques(chequeList)
            setSmsAlerts(alertList)
            setUsers(userList)
        } catch (err) {
            console.error('Error loading Bank Statement:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    const companyBanks = accounts.filter((a) => a.owner_scope === 'business' && a.account_type !== 'cash')
    const businessCash = accounts.filter((a) => a.owner_scope === 'business' && a.account_type === 'cash')
    const personalAccounts = accounts.filter((a) => a.owner_scope === 'personal')

    const companyBanksTotal = companyBanks.reduce((s, a) => s + a.current_balance, 0)
    const businessCashTotal = businessCash.reduce((s, a) => s + a.current_balance, 0)
    const personalCombinedTotal = personalAccounts.reduce((s, a) => s + a.current_balance, 0)
    const grandTotalLiquid = companyBanksTotal + businessCashTotal + personalCombinedTotal

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!accName.trim()) return
        setSavingAcc(true)
        try {
            await createFinancialAccount({
                name: accName,
                account_type: accType,
                owner_scope: accScope,
                owner_user_id: accOwnerUserId || null,
                account_last4: accLast4 || null,
                opening_balance: Number(accOpening) || 0,
            })
            setAddOpen(false)
            setAccName('')
            setAccLast4('')
            setAccOpening('')
            await loadAll()
        } catch (err: any) {
            alert(err?.message || 'Failed to add account')
        } finally {
            setSavingAcc(false)
        }
    }

    const openPassbook = async (acc: FinancialAccount) => {
        setPassbookAccount(acc)
        setPassbookOpen(true)
        setPassbookLoading(true)
        try {
            const res = await getAccountPassbook(acc.id)
            setPassbookEntries(res.entries)
        } finally {
            setPassbookLoading(false)
        }
    }

    const openTransferModal = () => {
        setTransferFromId(accounts[0]?.id || '')
        setTransferToId(accounts[1]?.id || '')
        setTransferAmount('')
        setTransferDate(new Date().toISOString().slice(0, 10))
        setTransferNotes('')
        setTransferOpen(true)
    }

    const handleFundTransfer = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!transferFromId || !transferToId) return alert('Select both From and To accounts')
        if (transferFromId === transferToId) return alert('From and To accounts cannot be the same')
        const amt = Number(transferAmount)
        if (!amt || amt <= 0) return alert('Enter a valid amount')
        const fromAcc = accounts.find((a) => a.id === transferFromId)
        const maxAvailable = Math.max(0, fromAcc?.available_balance || 0)
        if (amt > maxAvailable) {
            return alert(`Cannot transfer more than available balance (${formatRs(maxAvailable)}) in ${fromAcc?.name || 'source account'}.`)
        }
        setSavingTransfer(true)
        try {
            const toAcc = accounts.find((a) => a.id === transferToId)
            await createCashTransaction({
                transaction_date: transferDate,
                account_id: transferFromId,
                transfer_to_account_id: transferToId,
                direction: 'transfer',
                scope: 'business',
                category: 'Self Transfer',
                amount: Number(transferAmount),
                party_or_particular: `Fund Transfer: ${fromAcc?.name || 'Account'} → ${toAcc?.name || 'Account'}`,
                notes: transferNotes || null,
            })
            setTransferOpen(false)
            await loadAll()
        } catch (err: any) {
            alert(err?.message || 'Fund transfer failed')
        } finally {
            setSavingTransfer(false)
        }
    }

    const handleReconcile = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reconcileAcc) return
        try {
            const res = await reconcileFinancialAccount({
                accountId: reconcileAcc.id,
                actualBalance: Number(actualBal),
                notes: reconcileNotes,
            })
            if (!res.adjusted) alert('Balance already matches!')
            setReconcileAcc(null)
            await loadAll()
        } catch (err: any) {
            alert(err?.message || 'Reconciliation failed')
        }
    }

    const handleClearCheque = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!clearingCheque || !chequeBankId) return
        try {
            await markSupplierChequeCleared({
                supplierTransactionId: clearingCheque.id,
                accountId: chequeBankId,
            })
            setClearingCheque(null)
            await loadAll()
        } catch (err: any) {
            alert(err?.message || 'Failed to clear cheque')
        }
    }

    const openSmsApproval = (alertItem: PendingSmsAlert) => {
        setApprovingSms(alertItem)
        setSmsAccountId(alertItem.matched_account_id || accounts[0]?.id || '')
        if (alertItem.direction === 'credit') {
            setSmsAction('money_in')
            setSmsCategory('Daraz Payout')
        } else {
            setSmsAction('transfer_to_cash')
            setSmsCategory('Bank to Cash in Hand')
        }
        const firstCash = accounts.find((a) => a.account_type === 'cash')
        setSmsTargetId(firstCash?.id || '')
        setSmsParticular(`${alertItem.sender_id} (${alertItem.account_last4 ? '####' + alertItem.account_last4 : 'Bank SMS'})`)
    }

    const handleApproveSms = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!approvingSms || !smsAccountId) return
        try {
            const acc = accounts.find((a) => a.id === smsAccountId)
            await approvePendingSmsAlert({
                alertId: approvingSms.id,
                accountId: smsAccountId,
                action: smsAction,
                targetAccountId: smsTargetId || null,
                category: smsCategory,
                scope: acc?.owner_scope || 'business',
                particular: smsParticular,
            })
            setApprovingSms(null)
            await loadAll()
        } catch (err: any) {
            alert(err?.message || 'Failed to approve SMS')
        }
    }

    const renderAccountCard = (acc: FinancialAccount) => {
        const Icon = acc.account_type === 'bank' ? Landmark : acc.account_type === 'cash' ? Banknote : Wallet
        return (
            <div
                key={acc.id}
                className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between gap-3"
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <div
                            className={`p-2 rounded-lg ${
                                acc.owner_scope === 'business'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                            }`}
                        >
                            <Icon className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">{acc.name}</h3>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                <span className="capitalize">{acc.account_type}</span>
                                {acc.account_last4 && <span>• ####{acc.account_last4}</span>}
                                {acc.owner_name && (
                                    <span className="inline-flex items-center gap-0.5 text-purple-600 dark:text-purple-400 font-medium">
                                        • <User className="h-2.5 w-2.5" /> {acc.owner_name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <p className="text-xs text-gray-500">Real-Time Current Balance</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {formatRs(acc.current_balance)}
                    </p>
                    {acc.pending_cheques > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Pending Cheques: {formatRs(acc.pending_cheques)} • Available:{' '}
                            <strong>{formatRs(acc.available_balance)}</strong>
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t dark:border-zinc-800">
                    <button
                        onClick={() => openPassbook(acc)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700"
                    >
                        <BookOpen className="h-3.5 w-3.5" /> Passbook
                    </button>
                    <button
                        onClick={() => {
                            setReconcileAcc(acc)
                            setActualBal(String(Math.round(acc.current_balance)))
                            setReconcileNotes('')
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        <Scale className="h-3.5 w-3.5" /> Reconcile
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 w-full">
            {/* Top Summary Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-900 text-white p-4 rounded-xl">
                    <p className="text-xs text-slate-300">Total Liquid Cash (All Accounts)</p>
                    <p className="text-2xl font-bold mt-1">{formatRs(grandTotalLiquid)}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 rounded-xl">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Company Banks ({companyBanks.length})</p>
                    <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                        {formatRs(companyBanksTotal)}
                    </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 p-4 rounded-xl">
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                        Personal Total (All Personal Banks &amp; Wallets)
                    </p>
                    <p className="text-xl font-bold text-purple-800 dark:text-purple-200 mt-1">
                        {formatRs(personalCombinedTotal)}
                    </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 rounded-xl">
                    <p className="text-xs text-blue-700 dark:text-blue-300">Business Cash in Hand</p>
                    <p className="text-xl font-bold text-blue-800 dark:text-blue-200 mt-1">
                        {formatRs(businessCashTotal)}
                    </p>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">
                    Your Banks, Cash in Hand &amp; Wallets
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadAll}
                        className="p-2 rounded-lg border dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={openTransferModal}
                        disabled={accounts.length < 2}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                        <ArrowLeftRight className="h-4 w-4" /> Fund Transfer
                    </button>
                    <button
                        onClick={() => setAddOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        <Plus className="h-4 w-4" /> Add Bank / Wallet / Cash
                    </button>
                </div>
            </div>

            {/* Pending Bank SMS Alerts Approval Queue */}
            {smsAlerts.length > 0 && (
                <div
                    id="sms-alerts"
                    className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl p-4 space-y-3"
                >
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
                        <BellRing className="h-4 w-4" />
                        Pending Bank SMS Alerts ({smsAlerts.length}) — Approve to Update Bank Statement
                    </div>
                    <div className="space-y-2">
                        {smsAlerts.map((al) => (
                            <div
                                key={al.id}
                                className="bg-white dark:bg-zinc-900 p-3 rounded-lg border dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                al.direction === 'credit'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-rose-100 text-rose-800'
                                            }`}
                                        >
                                            {al.direction === 'credit' ? 'CREDITED' : 'DEBITED'}
                                        </span>
                                        <span className="font-bold text-sm">{formatRs(al.amount)}</span>
                                        <span className="text-xs text-gray-500">
                                            {al.sender_id} {al.account_last4 ? `• ####${al.account_last4}` : ''}
                                        </span>
                                        {al.matched_account_name && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                                Matched: {al.matched_account_name}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{al.raw_message}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openSmsApproval(al)}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
                                    >
                                        <Check className="h-3.5 w-3.5" /> Approve
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await ignorePendingSmsAlert(al.id)
                                            await loadAll()
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg border dark:border-zinc-700 hover:bg-gray-100"
                                    >
                                        Ignore
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Company Banks Section */}
            <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Company Banks &amp; Business Cash
                </h3>
                {companyBanks.length === 0 && businessCash.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 p-8 text-center text-sm text-gray-400">
                        No Company Banks or Business Cash added yet. Click <strong>Add Bank / Wallet / Cash</strong> above to register your 2 Company Banks and Cash in Hand.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...companyBanks, ...businessCash].map(renderAccountCard)}
                    </div>
                )}
            </div>

            {/* Personal Banks & Wallets Section */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Personal Banks &amp; Wallets (Combined Total: {formatRs(personalCombinedTotal)})
                    </h3>
                </div>
                {personalAccounts.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 p-6 text-center text-sm text-gray-400">
                        No Personal Banks or Wallets added yet. Add your 2 Personal Banks or Personal Cash/eSewa here.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {personalAccounts.map(renderAccountCard)}
                    </div>
                )}
            </div>

            {/* Supplier Cheques Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-amber-600" />
                        <h3 className="font-bold text-sm">Supplier Cheques (Real-Time Bank Tracking)</h3>
                    </div>
                    <span className="text-xs text-gray-500">
                        Pending: {cheques.filter((c) => !c.cheque_cleared).length}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-2.5 text-left">Cheque Date</th>
                                <th className="px-4 py-2.5 text-left">Supplier / Cheque Name</th>
                                <th className="px-4 py-2.5 text-left">Bank</th>
                                <th className="px-4 py-2.5 text-right">Amount</th>
                                <th className="px-4 py-2.5 text-center">Status</th>
                                <th className="px-4 py-2.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-800">
                            {cheques.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                                        No supplier cheques found in Supplier Transactions.
                                    </td>
                                </tr>
                            ) : (
                                cheques.map((ch) => (
                                    <tr key={ch.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40">
                                        <td className="px-4 py-2.5 font-mono text-xs">
                                            {ch.cheque_date || ch.transaction_date}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="font-medium">{ch.supplier_name}</div>
                                            {ch.cheque_name && (
                                                <div className="text-xs text-gray-500">{ch.cheque_name}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs">{ch.account_name || 'Not assigned'}</td>
                                        <td className="px-4 py-2.5 text-right font-bold">{formatRs(ch.amount)}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            {ch.cheque_cleared ? (
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                                    Cleared
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            {!ch.cheque_cleared && (
                                                <button
                                                    onClick={() => {
                                                        setClearingCheque(ch)
                                                        const nameLower = (ch.account_name || '').toLowerCase()
                                                        const matchedByName = companyBanks.find(
                                                            (b) =>
                                                                (nameLower.includes('global') && b.name.toLowerCase().includes('global')) ||
                                                                ((nameLower.includes('nbl') || nameLower.includes('nepal')) &&
                                                                    (b.name.toLowerCase().includes('nbl') || b.name.toLowerCase().includes('nepal'))) ||
                                                                b.name.toLowerCase() === nameLower
                                                        )
                                                        setChequeBankId(
                                                            ch.account_id || matchedByName?.id || companyBanks[0]?.id || accounts[0]?.id || ''
                                                        )
                                                    }}
                                                    className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                                >
                                                    Mark Cleared
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

            {/* Fund Transfer (Own Accounts) Modal */}
            {transferOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-md w-full p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Fund Transfer (Own Accounts)</h3>
                                <p className="text-xs text-gray-500">
                                    Move funds between your Company Banks, Personal Banks, Cash, or Wallets
                                </p>
                            </div>
                            <button onClick={() => setTransferOpen(false)}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleFundTransfer} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">From Account</label>
                                <select
                                    required
                                    value={transferFromId}
                                    onChange={(e) => setTransferFromId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                >
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name} ({a.owner_scope === 'business' ? 'Company' : 'Personal'} • {formatRs(a.current_balance)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">To Account</label>
                                <select
                                    required
                                    value={transferToId}
                                    onChange={(e) => setTransferToId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                >
                                    <option value="">-- Select Destination Account --</option>
                                    {accounts
                                        .filter((a) => a.id !== transferFromId)
                                        .map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.name} ({a.owner_scope === 'business' ? 'Company' : 'Personal'} • {formatRs(a.current_balance)})
                                            </option>
                                        ))}
                                </select>
                            </div>
                            {(() => {
                                const src = accounts.find((a) => a.id === transferFromId)
                                const avail = Math.max(0, src?.available_balance || 0)
                                const overLimit = Number(transferAmount) > avail
                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium mb-1">
                                                    Amount (Rs) • Max: <span className="text-emerald-600 font-bold">{formatRs(avail)}</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    max={avail}
                                                    required
                                                    placeholder="0.00"
                                                    value={transferAmount}
                                                    onChange={(e) => setTransferAmount(e.target.value)}
                                                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent font-bold ${
                                                        overLimit ? 'border-rose-500 text-rose-600' : 'dark:border-zinc-700'
                                                    }`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1">Transfer Date</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={transferDate}
                                                    onChange={(e) => setTransferDate(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                                />
                                            </div>
                                        </div>
                                        {overLimit && (
                                            <p className="text-xs font-semibold text-rose-600">
                                                Insufficient funds! You cannot transfer more than {formatRs(avail)} from {src?.name}.
                                            </p>
                                        )}
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Notes (optional)</label>
                                            <input
                                                type="text"
                                                placeholder="e.g., Bank to Cash withdrawal, Company to Personal..."
                                                value={transferNotes}
                                                onChange={(e) => setTransferNotes(e.target.value)}
                                                className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button type="button" onClick={() => setTransferOpen(false)} className="px-4 py-2 text-sm rounded-lg border dark:border-zinc-700">
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={savingTransfer || overLimit || avail <= 0}
                                                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {savingTransfer ? 'Transferring...' : 'Transfer Funds'}
                                            </button>
                                        </div>
                                    </>
                                )
                            })()}
                        </form>
                    </div>
                </div>
            )}

            {/* Add Account Modal */}
            {addOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-md w-full p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold">Add Bank / Cash / Wallet</h3>
                            <button onClick={() => setAddOpen(false)}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateAccount} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Account Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Nabil Bank (Company), Personal NIC Asia, Cash - Brother"
                                    value={accName}
                                    onChange={(e) => setAccName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Scope</label>
                                    <select
                                        value={accScope}
                                        onChange={(e) => setAccScope(e.target.value as OwnerScope)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    >
                                        <option value="business">Company / Business</option>
                                        <option value="personal">Personal</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Type</label>
                                    <select
                                        value={accType}
                                        onChange={(e) => setAccType(e.target.value as AccountType)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    >
                                        <option value="bank">Bank Account</option>
                                        <option value="cash">Cash in Hand</option>
                                        <option value="wallet">Digital Wallet (eSewa/Khalti)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Last 4 Digits (for SMS)</label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="e.g., 0263"
                                        value={accLast4}
                                        onChange={(e) => setAccLast4(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Current / Opening Balance</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="0"
                                        value={accOpening}
                                        onChange={(e) => setAccOpening(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent font-bold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Assigned Admin Owner (optional)</label>
                                <select
                                    value={accOwnerUserId}
                                    onChange={(e) => setAccOwnerUserId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                >
                                    <option value="">Shared / Company</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm rounded-lg border dark:border-zinc-700">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingAcc}
                                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    {savingAcc ? 'Saving...' : 'Save Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Passbook Modal */}
            {passbookOpen && passbookAccount && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-4xl w-full max-h-[85vh] flex flex-col">
                        <div className="px-5 py-4 border-b dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">{passbookAccount.name} — Passbook Statement</h3>
                                <p className="text-xs text-gray-500">
                                    Current Balance: <strong>{formatRs(passbookAccount.current_balance)}</strong>
                                </p>
                            </div>
                            <button onClick={() => setPassbookOpen(false)}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-zinc-800/60 text-xs uppercase text-gray-500 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left">Date</th>
                                        <th className="px-4 py-2.5 text-left">Particular</th>
                                        <th className="px-4 py-2.5 text-left">By</th>
                                        <th className="px-4 py-2.5 text-right">Debit (−)</th>
                                        <th className="px-4 py-2.5 text-right">Credit (+)</th>
                                        <th className="px-4 py-2.5 text-right">Running Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-zinc-800">
                                    {passbookLoading ? (
                                        <tr>
                                            <td colSpan={6} className="py-10 text-center text-gray-400">
                                                Loading passbook...
                                            </td>
                                        </tr>
                                    ) : (
                                        passbookEntries.map((row) => (
                                            <tr key={row.id}>
                                                <td className="px-4 py-2 font-mono text-xs">{row.date}</td>
                                                <td className="px-4 py-2">
                                                    <div className="font-medium">{row.particular}</div>
                                                    <div className="text-xs text-gray-500">{row.category}</div>
                                                </td>
                                                <td className="px-4 py-2 text-xs">{row.creator_name}</td>
                                                <td className="px-4 py-2 text-right text-rose-600 font-medium">
                                                    {row.debit > 0 ? formatRs(row.debit) : '—'}
                                                </td>
                                                <td className="px-4 py-2 text-right text-emerald-600 font-medium">
                                                    {row.credit > 0 ? formatRs(row.credit) : '—'}
                                                </td>
                                                <td className="px-4 py-2 text-right font-bold">
                                                    {formatRs(row.running_balance)}
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

            {/* Reconcile Modal */}
            {reconcileAcc && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-sm w-full p-5 space-y-4">
                        <h3 className="text-base font-bold">Reconcile {reconcileAcc.name}</h3>
                        <p className="text-xs text-gray-500">
                            App Balance: <strong>{formatRs(reconcileAcc.current_balance)}</strong>. Enter your real mobile banking balance to auto-log any small difference.
                        </p>
                        <form onSubmit={handleReconcile} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Actual Bank Balance (Rs)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={actualBal}
                                    onChange={(e) => setActualBal(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Reason / Notes</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Bank SMS charge"
                                    value={reconcileNotes}
                                    onChange={(e) => setReconcileNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setReconcileAcc(null)} className="px-3 py-1.5 text-xs rounded-lg border">
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white">
                                    Reconcile Now
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Clear Cheque Modal */}
            {clearingCheque && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-sm w-full p-5 space-y-4">
                        <h3 className="text-base font-bold">Mark Supplier Cheque Cleared</h3>
                        <p className="text-xs text-gray-500">
                            Supplier: <strong>{clearingCheque.supplier_name}</strong> • Amount:{' '}
                            <strong>{formatRs(clearingCheque.amount)}</strong>
                        </p>
                        <form onSubmit={handleClearCheque} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Deduct From Bank Account</label>
                                <select
                                    required
                                    value={chequeBankId}
                                    onChange={(e) => setChequeBankId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                >
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name} ({formatRs(a.current_balance)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setClearingCheque(null)} className="px-3 py-1.5 text-xs rounded-lg border">
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white">
                                    Confirm Cleared
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Approve SMS Modal (with Debit -> Cash in Hand support!) */}
            {approvingSms && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 max-w-md w-full p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold">Approve Bank SMS Alert</h3>
                            <button onClick={() => setApprovingSms(null)}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800 text-xs space-y-1">
                            <div className="font-bold">
                                {approvingSms.direction === 'credit' ? 'CREDITED' : 'DEBITED'} {formatRs(approvingSms.amount)}
                            </div>
                            <div className="text-gray-500">{approvingSms.raw_message}</div>
                        </div>
                        <form onSubmit={handleApproveSms} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Bank Account</label>
                                <select
                                    required
                                    value={smsAccountId}
                                    onChange={(e) => setSmsAccountId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                >
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name} {a.account_last4 ? `(####${a.account_last4})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">How to Record This?</label>
                                <select
                                    value={smsAction}
                                    onChange={(e) => {
                                        const val = e.target.value as any
                                        setSmsAction(val)
                                        if (val === 'transfer_to_cash') setSmsCategory('Bank to Cash in Hand')
                                        else if (val === 'transfer_to_account') setSmsCategory('Self Transfer')
                                        else if (val === 'money_in') setSmsCategory('Daraz Payout')
                                        else setSmsCategory('Party Due Payment')
                                    }}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                >
                                    {approvingSms.direction === 'credit' ? (
                                        <option value="money_in">Money In (Credit Bank)</option>
                                    ) : (
                                        <>
                                            <option value="transfer_to_cash">Transfer to Cash in Hand (ATM / Cash Withdrawal)</option>
                                            <option value="money_out">Money Out (Expense / Purchase / Party Payment)</option>
                                            <option value="transfer_to_account">Transfer to Another Bank / Wallet</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {(smsAction === 'transfer_to_cash' || smsAction === 'transfer_to_account') && (
                                <div>
                                    <label className="block text-xs font-medium mb-1">Destination Cash / Bank Account</label>
                                    <select
                                        required
                                        value={smsTargetId}
                                        onChange={(e) => setSmsTargetId(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    >
                                        <option value="">-- Select Destination --</option>
                                        {accounts
                                            .filter((a) => a.id !== smsAccountId)
                                            .map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name} ({a.account_type})
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium mb-1">Particular</label>
                                <input
                                    type="text"
                                    value={smsParticular}
                                    onChange={(e) => setSmsParticular(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-zinc-700 bg-transparent"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setApprovingSms(null)} className="px-4 py-2 text-xs rounded-lg border">
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white">
                                    Approve &amp; Update Balance
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
