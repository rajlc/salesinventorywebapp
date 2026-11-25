'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CashFlowSummary, CashTransaction, OwnerScope, TransactionDirection } from '../types'
import { getFinancialAccounts } from './account-actions'

export async function getCashTransactions(filters: {
    startDate?: string
    endDate?: string
    accountId?: string
    direction?: TransactionDirection | 'all'
    scope?: OwnerScope | 'all'
    createdBy?: string
    search?: string
} = {}): Promise<{ transactions: CashTransaction[]; summary: CashFlowSummary }> {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]
    const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    const startDate = filters.startDate || defaultStart
    const endDate = filters.endDate || today

    const [accounts, allTxRes, profilesRes] = await Promise.all([
        getFinancialAccounts(),
        supabase
            .from('cash_transactions')
            .select('*')
            .lte('transaction_date', endDate)
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('id, full_name'),
    ])

    const accountMap = new Map(accounts.map((a) => [a.id, a]))
    const profileMap = new Map<string, string>(
        (profilesRes.data || []).map((p: any) => [p.id, p.full_name || 'Admin'])
    )

    // Compute opening balance as of startDate across filtered accounts
    const relevantAccountIds = new Set(
        accounts
            .filter((a) => {
                if (filters.accountId && filters.accountId !== 'all' && a.id !== filters.accountId) return false
                if (filters.scope && filters.scope !== 'all' && a.owner_scope !== filters.scope) return false
                return true
            })
            .map((a) => a.id)
    )

    let openingBalance = accounts
        .filter((a) => relevantAccountIds.has(a.id))
        .reduce((sum, a) => sum + a.opening_balance, 0)

    const allTx = allTxRes.data || []

    for (const tx of allTx) {
        if (tx.transaction_date >= startDate) continue
        const amt = Number(tx.amount) || 0
        if (tx.direction === 'in' && relevantAccountIds.has(tx.account_id)) {
            openingBalance += amt
        } else if (tx.direction === 'out' && relevantAccountIds.has(tx.account_id)) {
            openingBalance -= amt
        } else if (tx.direction === 'transfer') {
            if (relevantAccountIds.has(tx.account_id)) openingBalance -= amt
            if (tx.transfer_to_account_id && relevantAccountIds.has(tx.transfer_to_account_id)) openingBalance += amt
        }
    }

    const searchLower = (filters.search || '').trim().toLowerCase()

    const periodTx: CashTransaction[] = []
    let totalMoneyIn = 0
    let businessMoneyIn = 0
    let personalMoneyIn = 0
    let totalMoneyOut = 0
    let businessMoneyOut = 0
    let personalDrawings = 0
    let totalTransfers = 0

    const categoryAgg = new Map<string, { category: string; direction: 'in' | 'out'; scope: OwnerScope; total: number; count: number }>()

    for (const tx of allTx) {
        if (tx.transaction_date < startDate || tx.transaction_date > endDate) continue

        if (filters.accountId && filters.accountId !== 'all') {
            if (tx.account_id !== filters.accountId && tx.transfer_to_account_id !== filters.accountId) continue
        }
        if (filters.direction && filters.direction !== 'all' && tx.direction !== filters.direction) continue
        if (filters.scope && filters.scope !== 'all' && tx.scope !== filters.scope) continue
        if (filters.createdBy && filters.createdBy !== 'all' && tx.created_by !== filters.createdBy) continue

        const acc = accountMap.get(tx.account_id)
        const targetAcc = tx.transfer_to_account_id ? accountMap.get(tx.transfer_to_account_id) : null
        const creatorName = tx.created_by ? profileMap.get(tx.created_by) || 'Admin' : 'System'

        if (searchLower) {
            const hay = `${tx.category} ${tx.party_or_particular || ''} ${tx.notes || ''} ${acc?.name || ''} ${creatorName}`.toLowerCase()
            if (!hay.includes(searchLower)) continue
        }

        const amt = Number(tx.amount) || 0
        periodTx.push({
            ...tx,
            amount: amt,
            account_name: acc?.name || 'Unknown Account',
            account_owner_scope: acc?.owner_scope || 'business',
            transfer_to_account_name: targetAcc?.name || null,
            creator_name: creatorName,
        })

        if (tx.direction === 'in') {
            totalMoneyIn += amt
            if (tx.scope === 'personal') personalMoneyIn += amt
            else businessMoneyIn += amt
            const key = `in:${tx.scope}:${tx.category}`
            const existing = categoryAgg.get(key) || { category: tx.category, direction: 'in' as const, scope: tx.scope, total: 0, count: 0 }
            existing.total += amt
            existing.count += 1
            categoryAgg.set(key, existing)
        } else if (tx.direction === 'out') {
            totalMoneyOut += amt
            if (tx.scope === 'personal' || tx.category === 'Personal Expense') {
                personalDrawings += amt
            } else {
                businessMoneyOut += amt
            }
            const key = `out:${tx.scope}:${tx.category}`
            const existing = categoryAgg.get(key) || { category: tx.category, direction: 'out' as const, scope: tx.scope, total: 0, count: 0 }
            existing.total += amt
            existing.count += 1
            categoryAgg.set(key, existing)
        } else if (tx.direction === 'transfer') {
            totalTransfers += amt
        }
    }

    const netCashFlow = totalMoneyIn - totalMoneyOut
    const businessNetCashFlow = businessMoneyIn - businessMoneyOut

    return {
        transactions: periodTx,
        summary: {
            startDate,
            endDate,
            openingBalance,
            totalMoneyIn,
            businessMoneyIn,
            personalMoneyIn,
            totalMoneyOut,
            businessMoneyOut,
            personalDrawings,
            totalTransfers,
            businessNetCashFlow,
            netCashFlow,
            closingBalance: openingBalance + netCashFlow,
            byCategory: Array.from(categoryAgg.values()).sort((a, b) => b.total - a.total),
        },
    }
}

export async function createCashTransaction(input: {
    transaction_date: string
    account_id: string
    transfer_to_account_id?: string | null
    direction: TransactionDirection
    scope: OwnerScope
    category: string
    amount: number
    party_or_particular?: string | null
    notes?: string | null
    source_type?: string
    source_id?: string | null
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const amount = Number(input.amount)
    if (!amount || amount <= 0) throw new Error('Amount must be greater than 0')

    if (input.direction === 'transfer') {
        if (!input.transfer_to_account_id) throw new Error('Please select destination account for transfer')
        if (input.transfer_to_account_id === input.account_id) throw new Error('Source and destination accounts cannot be the same')

        // Server-side guard: cannot transfer more than available funds in source account
        const accounts = await getFinancialAccounts()
        const sourceAcc = accounts.find((a) => a.id === input.account_id)
        if (!sourceAcc) throw new Error('Source account not found')
        const available = Math.max(0, sourceAcc.available_balance)
        if (amount > available + 0.001) {
            throw new Error(
                `Insufficient funds in ${sourceAcc.name}. Available balance is Rs ${Math.round(available).toLocaleString('en-IN')}.`
            )
        }
    }

    const { data, error } = await supabase
        .from('cash_transactions')
        .insert({
            transaction_date: input.transaction_date || new Date().toISOString().split('T')[0],
            account_id: input.account_id,
            transfer_to_account_id: input.direction === 'transfer' ? input.transfer_to_account_id : null,
            direction: input.direction,
            scope: input.scope,
            category: input.category,
            amount,
            party_or_particular: input.party_or_particular?.trim() || null,
            source_type: input.source_type || 'manual',
            source_id: input.source_id || null,
            notes: input.notes?.trim() || null,
            created_by: user.id,
        })
        .select()
        .single()

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/account/transaction')
    return data
}

export async function deleteCashTransaction(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('cash_transactions')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/account/transaction')
}
