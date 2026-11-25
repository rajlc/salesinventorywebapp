'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
    AccountType,
    FinancialAccount,
    OwnerScope,
    PassbookEntry,
    PendingSmsAlert,
    SupplierChequeItem,
} from '../types'

async function getCurrentUserContext() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single()

    return {
        supabase,
        userId: user.id,
        fullName: profile?.full_name || user.email || 'Admin',
        role: profile?.role || 'admin',
    }
}

export async function getAdminUsers(): Promise<Array<{ id: string; full_name: string; role: string }>> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .order('full_name', { ascending: true })

    return (data || []).map((u: any) => ({
        id: u.id,
        full_name: u.full_name || 'User',
        role: u.role || 'user',
    }))
}

export async function getCurrentUserProfile(): Promise<{ id: string; full_name: string; role: string } | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single()
    return {
        id: user.id,
        full_name: profile?.full_name || user.email || 'Admin',
        role: profile?.role || 'admin',
    }
}

/**
 * Fetch all active financial accounts with real-time computed balances & pending supplier cheques
 */
export async function getFinancialAccounts(): Promise<FinancialAccount[]> {
    const supabase = await createClient()

    const [accountsRes, txRes, profilesRes, chequesRes] = await Promise.all([
        supabase
            .from('financial_accounts')
            .select('*')
            .eq('is_active', true)
            .order('owner_scope', { ascending: true })
            .order('account_type', { ascending: true })
            .order('name', { ascending: true }),
        supabase
            .from('cash_transactions')
            .select('account_id, transfer_to_account_id, direction, amount'),
        supabase
            .from('user_profiles')
            .select('id, full_name'),
        supabase
            .from('supplier_transactions')
            .select('account_id, amount, payment_method, transaction_mode, cheque_cleared')
            .or('transaction_mode.ilike.%cheque%,payment_method.ilike.%cheque%')
            .eq('cheque_cleared', false),
    ])

    if (accountsRes.error) {
        if (accountsRes.error.code === '42P01') return []
        throw new Error(accountsRes.error.message)
    }

    const profileMap = new Map<string, string>(
        (profilesRes.data || []).map((p: any) => [p.id, p.full_name || 'User'])
    )

    const inMap = new Map<string, number>()
    const outMap = new Map<string, number>()

    for (const tx of txRes.data || []) {
        const amt = Number(tx.amount) || 0
        if (tx.direction === 'in') {
            inMap.set(tx.account_id, (inMap.get(tx.account_id) || 0) + amt)
        } else if (tx.direction === 'out') {
            outMap.set(tx.account_id, (outMap.get(tx.account_id) || 0) + amt)
        } else if (tx.direction === 'transfer') {
            outMap.set(tx.account_id, (outMap.get(tx.account_id) || 0) + amt)
            if (tx.transfer_to_account_id) {
                inMap.set(tx.transfer_to_account_id, (inMap.get(tx.transfer_to_account_id) || 0) + amt)
            }
        }
    }

    const pendingChequeMap = new Map<string, number>()
    for (const ch of chequesRes.data || []) {
        if (ch.account_id) {
            pendingChequeMap.set(
                ch.account_id,
                (pendingChequeMap.get(ch.account_id) || 0) + (Number(ch.amount) || 0)
            )
        }
    }

    return (accountsRes.data || []).map((acc: any) => {
        const opening = Number(acc.opening_balance) || 0
        const totalIn = inMap.get(acc.id) || 0
        const totalOut = outMap.get(acc.id) || 0
        const currentBalance = opening + totalIn - totalOut
        const pendingCheques = pendingChequeMap.get(acc.id) || 0
        return {
            ...acc,
            opening_balance: opening,
            owner_name: acc.owner_user_id ? profileMap.get(acc.owner_user_id) || null : null,
            total_in: totalIn,
            total_out: totalOut,
            current_balance: currentBalance,
            pending_cheques: pendingCheques,
            available_balance: currentBalance - pendingCheques,
        }
    })
}

export async function createFinancialAccount(input: {
    name: string
    account_type: AccountType
    owner_scope: OwnerScope
    owner_user_id?: string | null
    account_last4?: string | null
    opening_balance: number
    opening_balance_date?: string
    notes?: string | null
}) {
    const { supabase, userId } = await getCurrentUserContext()

    const { data, error } = await supabase
        .from('financial_accounts')
        .insert({
            name: input.name.trim(),
            account_type: input.account_type,
            owner_scope: input.owner_scope,
            owner_user_id: input.owner_user_id || (input.owner_scope === 'personal' ? userId : null),
            account_last4: input.account_last4?.trim() || null,
            opening_balance: Number(input.opening_balance) || 0,
            opening_balance_date: input.opening_balance_date || new Date().toISOString().split('T')[0],
            notes: input.notes?.trim() || null,
            created_by: userId,
        })
        .select()
        .single()

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/account/transaction')
    return data
}

export async function updateFinancialAccount(
    id: string,
    input: {
        name?: string
        account_type?: AccountType
        owner_scope?: OwnerScope
        owner_user_id?: string | null
        account_last4?: string | null
        opening_balance?: number
        opening_balance_date?: string
        notes?: string | null
    }
) {
    const { supabase } = await getCurrentUserContext()

    const { error } = await supabase
        .from('financial_accounts')
        .update({
            ...input,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/account/transaction')
}

export async function archiveFinancialAccount(id: string) {
    const { supabase } = await getCurrentUserContext()
    const { error } = await supabase
        .from('financial_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/account/transaction')
}

/**
 * Reconcile an account to match real mobile banking balance by posting a small adjustment entry
 */
export async function reconcileFinancialAccount(input: {
    accountId: string
    actualBalance: number
    notes?: string
}) {
    const { supabase, userId } = await getCurrentUserContext()
    const accounts = await getFinancialAccounts()
    const account = accounts.find((a) => a.id === input.accountId)
    if (!account) throw new Error('Account not found')

    const diff = Number(input.actualBalance) - account.current_balance
    if (Math.abs(diff) < 0.01) {
        return { adjusted: false, diff: 0 }
    }

    const { error } = await supabase.from('cash_transactions').insert({
        transaction_date: new Date().toISOString().split('T')[0],
        account_id: account.id,
        direction: diff > 0 ? 'in' : 'out',
        scope: account.owner_scope,
        category: 'Bank Charge / Reconciliation',
        amount: Math.abs(diff),
        party_or_particular: `Balance Reconciliation (${account.name})`,
        source_type: 'reconcile',
        notes: input.notes?.trim() || `Reconciled from Rs ${account.current_balance.toFixed(2)} to Rs ${input.actualBalance.toFixed(2)}`,
        created_by: userId,
    })

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/account/transaction')
    return { adjusted: true, diff }
}

/**
 * Get passbook statement with row-by-row running balance for a specific account
 */
export async function getAccountPassbook(accountId: string): Promise<{
    account: FinancialAccount | null
    entries: PassbookEntry[]
}> {
    const accounts = await getFinancialAccounts()
    const account = accounts.find((a) => a.id === accountId) || null
    if (!account) return { account: null, entries: [] }

    const supabase = await createClient()
    const [txRes, profilesRes] = await Promise.all([
        supabase
            .from('cash_transactions')
            .select('*')
            .or(`account_id.eq.${accountId},transfer_to_account_id.eq.${accountId}`)
            .order('transaction_date', { ascending: true })
            .order('created_at', { ascending: true }),
        supabase.from('user_profiles').select('id, full_name'),
    ])

    const profileMap = new Map<string, string>(
        (profilesRes.data || []).map((p: any) => [p.id, p.full_name || 'Admin'])
    )
    const accountMap = new Map<string, string>(accounts.map((a) => [a.id, a.name]))

    let running = account.opening_balance
    const entries: PassbookEntry[] = [
        {
            id: 'opening',
            date: account.opening_balance_date,
            particular: 'Opening Balance',
            category: 'Opening',
            source_type: 'opening',
            creator_name: 'System',
            debit: 0,
            credit: account.opening_balance > 0 ? account.opening_balance : 0,
            running_balance: running,
            notes: null,
        },
    ]

    for (const tx of txRes.data || []) {
        const amt = Number(tx.amount) || 0
        let debit = 0
        let credit = 0
        let particular = tx.party_or_particular || tx.category

        if (tx.direction === 'in' && tx.account_id === accountId) {
            credit = amt
            running += amt
        } else if (tx.direction === 'out' && tx.account_id === accountId) {
            debit = amt
            running -= amt
        } else if (tx.direction === 'transfer') {
            if (tx.account_id === accountId) {
                debit = amt
                running -= amt
                particular = `Transfer to ${accountMap.get(tx.transfer_to_account_id) || 'Account'}`
            } else if (tx.transfer_to_account_id === accountId) {
                credit = amt
                running += amt
                particular = `Transfer from ${accountMap.get(tx.account_id) || 'Account'}`
            }
        }

        entries.push({
            id: tx.id,
            date: tx.transaction_date,
            particular,
            category: tx.category,
            source_type: tx.source_type,
            creator_name: tx.created_by ? profileMap.get(tx.created_by) || 'Admin' : 'System',
            debit,
            credit,
            running_balance: running,
            notes: tx.notes,
        })
    }

    return { account, entries: entries.reverse() }
}

/**
 * Fetch Supplier Cheques from supplier_transactions to display in Bank Statement
 */
export async function getSupplierCheques(): Promise<SupplierChequeItem[]> {
    const supabase = await createClient()
    const [chequesRes, accountsRes] = await Promise.all([
        supabase
            .from('supplier_transactions')
            .select(`
                id,
                transaction_date,
                cheque_date,
                cheque_type,
                cheque_name,
                supplier_id,
                amount,
                payment_method,
                account_id,
                cheque_cleared,
                cheque_cleared_at,
                remarks,
                supplier:suppliers(supplier_name)
            `)
            .or('transaction_mode.ilike.%cheque%,payment_method.ilike.%cheque%')
            .order('cheque_cleared', { ascending: true })
            .order('cheque_date', { ascending: false })
            .limit(100),
        supabase.from('financial_accounts').select('id, name').eq('is_active', true),
    ])

    if (chequesRes.error) return []

    const accountMap = new Map<string, string>(
        (accountsRes.data || []).map((a: any) => [a.id, a.name])
    )
    const accountNameToId = new Map<string, { id: string; name: string }>(
        (accountsRes.data || []).map((a: any) => [String(a.name || '').trim().toLowerCase(), { id: a.id, name: a.name }])
    )

    // Only include cheques whose bank matches an active account in Bank Statement (hides old legacy names like BTAS Global / BTAS Nbl)
    const items: SupplierChequeItem[] = []
    for (const row of chequesRes.data || []) {
        const matchedById = row.account_id && accountMap.has(row.account_id)
            ? { id: row.account_id, name: accountMap.get(row.account_id)! }
            : null
        const matchedByName = !matchedById && row.payment_method
            ? accountNameToId.get(String(row.payment_method).trim().toLowerCase()) || null
            : null
        const matched = matchedById || matchedByName
        if (!matched) continue

        items.push({
            id: row.id,
            transaction_date: row.transaction_date,
            cheque_date: row.cheque_date,
            cheque_type: row.cheque_type,
            cheque_name: row.cheque_name,
            supplier_id: row.supplier_id,
            supplier_name: (row as any).supplier?.supplier_name || 'Supplier',
            amount: Number(row.amount) || 0,
            account_id: matched.id,
            account_name: matched.name,
            cheque_cleared: Boolean(row.cheque_cleared),
            cheque_cleared_at: row.cheque_cleared_at || null,
            remarks: row.remarks || null,
        })
    }
    return items
}

/**
 * Mark a Supplier Cheque as Cleared and automatically deduct from the chosen Bank Account in real time
 */
export async function markSupplierChequeCleared(input: {
    supplierTransactionId: string
    accountId: string
    clearedDate?: string
}) {
    const { supabase, userId } = await getCurrentUserContext()

    const { data: cheque, error: fetchErr } = await supabase
        .from('supplier_transactions')
        .select('*, supplier:suppliers(supplier_name)')
        .eq('id', input.supplierTransactionId)
        .single()

    if (fetchErr || !cheque) throw new Error('Cheque record not found')
    if (cheque.cheque_cleared) throw new Error('Cheque is already cleared')

    const clearDate = input.clearedDate || new Date().toISOString().split('T')[0]

    const { error: txErr } = await supabase.from('cash_transactions').insert({
        transaction_date: clearDate,
        account_id: input.accountId,
        direction: 'out',
        scope: 'business',
        category: 'Supplier Cheque Cleared',
        amount: Number(cheque.amount),
        party_or_particular: `Cheque Cleared - ${cheque.supplier?.supplier_name || cheque.cheque_name || 'Supplier'}`,
        source_type: 'supplier_transaction',
        source_id: cheque.id,
        notes: cheque.remarks || `Cheque date: ${cheque.cheque_date || cheque.transaction_date}`,
        created_by: userId,
    })

    if (txErr) throw new Error(txErr.message)

    const { error: updErr } = await supabase
        .from('supplier_transactions')
        .update({
            account_id: input.accountId,
            cheque_cleared: true,
            cheque_cleared_at: new Date().toISOString(),
        })
        .eq('id', cheque.id)

    if (updErr) throw new Error(updErr.message)

    revalidatePath('/dashboard/account/transaction')
}

/**
 * Fetch pending Bank SMS alerts waiting for admin approval
 */
export async function getPendingSmsAlerts(): Promise<PendingSmsAlert[]> {
    const supabase = await createClient()
    const [alertsRes, accountsRes] = await Promise.all([
        supabase
            .from('pending_bank_sms_alerts')
            .select('*')
            .eq('status', 'pending')
            .order('received_at', { ascending: false })
            .limit(50),
        supabase.from('financial_accounts').select('id, name, account_last4'),
    ])

    if (alertsRes.error) return []

    const accountMap = new Map<string, string>(
        (accountsRes.data || []).map((a: any) => [a.id, a.name])
    )

    return (alertsRes.data || []).map((a: any) => ({
        ...a,
        amount: Number(a.amount) || 0,
        matched_account_name: a.matched_account_id ? accountMap.get(a.matched_account_id) || null : null,
    }))
}

/**
 * Approve a Pending Bank SMS Alert (supports Credit, Debit Expense/Payment, or Debit -> Cash in Hand transfer!)
 */
export async function approvePendingSmsAlert(input: {
    alertId: string
    accountId: string
    action: 'money_in' | 'money_out' | 'transfer_to_cash' | 'transfer_to_account'
    targetAccountId?: string | null
    category: string
    scope: OwnerScope
    particular?: string
    notes?: string
}) {
    const { supabase, userId } = await getCurrentUserContext()

    const { data: alert, error: fetchErr } = await supabase
        .from('pending_bank_sms_alerts')
        .select('*')
        .eq('id', input.alertId)
        .single()

    if (fetchErr || !alert) throw new Error('SMS alert not found')
    if (alert.status !== 'pending') throw new Error('Alert already handled')

    const isTransfer = input.action === 'transfer_to_cash' || input.action === 'transfer_to_account'
    if (isTransfer && !input.targetAccountId) {
        throw new Error('Please select the destination Cash or Bank account')
    }

    const direction = isTransfer ? 'transfer' : input.action === 'money_in' ? 'in' : 'out'
    const txDate = (alert.received_at || new Date().toISOString()).split('T')[0]

    const { data: tx, error: txErr } = await supabase
        .from('cash_transactions')
        .insert({
            transaction_date: txDate,
            account_id: input.accountId,
            transfer_to_account_id: isTransfer ? input.targetAccountId : null,
            direction,
            scope: input.scope,
            category: input.category,
            amount: Number(alert.amount),
            party_or_particular: input.particular?.trim() || `${alert.sender_id} SMS Alert`,
            source_type: 'bank_sms',
            source_id: alert.id,
            notes: input.notes?.trim() || alert.raw_message,
            created_by: userId,
        })
        .select()
        .single()

    if (txErr) throw new Error(txErr.message)

    await supabase
        .from('pending_bank_sms_alerts')
        .update({
            status: 'approved',
            cash_transaction_id: tx.id,
            handled_by: userId,
            handled_at: new Date().toISOString(),
        })
        .eq('id', alert.id)

    revalidatePath('/dashboard/account/transaction')
}

export async function ignorePendingSmsAlert(alertId: string) {
    const { supabase, userId } = await getCurrentUserContext()
    const { error } = await supabase
        .from('pending_bank_sms_alerts')
        .update({
            status: 'ignored',
            handled_by: userId,
            handled_at: new Date().toISOString(),
        })
        .eq('id', alertId)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/account/transaction')
}
