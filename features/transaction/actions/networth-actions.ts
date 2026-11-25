'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getStockValuation } from '@/features/inventory/services/stock-valuation-service'
import { getSupplierLedger } from '@/features/suppliers/actions/supplier-ledger-actions'
import { getFinancialAccounts } from './account-actions'
import { getCourierSettlementData, getDarazSettlementData } from './settlement-actions'
import type { LiveNetWorthData, NetWorthSnapshot, OtherLiability } from '../types'

export async function getLiveNetWorth(): Promise<LiveNetWorthData> {
    const supabase = await createClient()

    const [accounts, stockValRes, supplierLedgerRes, darazData, courierData, liabilitiesRes, damageRes] = await Promise.all([
        getFinancialAccounts(),
        getStockValuation(1, 1).catch(() => ({ summary: { totalValuation: 0, missingCount: 0 } })),
        getSupplierLedger({}).catch(() => ({ ledger: [] })),
        getDarazSettlementData().catch(() => ({ stores: [], weeklyRows: [], totalShippedCost: 0, totalExpectedDelivered: 0 })),
        getCourierSettlementData().catch(() => ({ couriers: [], history: [], courierNames: [], totalShippedCost: 0, totalExpectedCod: 0 })),
        supabase
            .from('other_liabilities')
            .select('*')
            .order('is_paid', { ascending: true })
            .order('due_date', { ascending: true }),
        supabase
            .from('damage_resolutions')
            .select('loss_amount, total_cost, amount')
            .limit(500),
    ])

    let companyBanksTotal = 0
    let personalTotal = 0
    let cashInHandTotal = 0
    let pendingChequesTotal = 0

    for (const acc of accounts) {
        pendingChequesTotal += acc.pending_cheques
        if (acc.owner_scope === 'personal') {
            personalTotal += acc.current_balance
        } else if (acc.account_type === 'cash') {
            cashInHandTotal += acc.current_balance
        } else {
            companyBanksTotal += acc.current_balance
        }
    }

    const totalLiquidCash = companyBanksTotal + personalTotal + cashInHandTotal

    // Warehouse stock valuation — exact live number from dashboard/inventory/stock-ledger (Stock Valuation tab)
    const warehouseStockValue = Number(stockValRes?.summary?.totalValuation) || 0

    // Supplier ledger: Positive (Red) = Party / Supplier Credit Due (Liability), Negative (Green) = Supplier / Party Receivable (Asset)
    let partyPayables = 0
    let partyReceivables = 0
    for (const entry of supplierLedgerRes.ledger || []) {
        const bal = Number(entry.running_balance) || 0
        if (bal > 0) partyPayables += bal
        else if (bal < 0) partyReceivables += Math.abs(bal)
    }

    const otherLiabilities: OtherLiability[] = (liabilitiesRes.data || []).map((l: any) => ({
        ...l,
        amount: Number(l.amount) || 0,
    }))
    const otherLiabilitiesTotal = otherLiabilities
        .filter((l) => !l.is_paid)
        .reduce((s, l) => s + l.amount, 0)

    // Damaged goods non-cash loss visibility
    const damagedGoodsLoss = (damageRes.data || []).reduce((s: number, d: any) => {
        return s + (Number(d.loss_amount) || Number(d.total_cost) || Number(d.amount) || 0)
    }, 0)

    const businessTotalAssets =
        companyBanksTotal +
        cashInHandTotal +
        warehouseStockValue +
        darazData.totalShippedCost +
        darazData.totalExpectedDelivered +
        courierData.totalShippedCost +
        courierData.totalExpectedCod +
        partyReceivables

    const totalAssets = businessTotalAssets + personalTotal
    const totalLiabilities = partyPayables + pendingChequesTotal + otherLiabilitiesTotal

    const result: LiveNetWorthData = {
        asOf: new Date().toISOString(),
        companyBanksTotal,
        personalTotal,
        cashInHandTotal,
        totalLiquidCash,
        warehouseStockValue,
        darazInTransitValue: darazData.totalShippedCost,
        darazPendingPayout: darazData.totalExpectedDelivered,
        courierInTransitValue: courierData.totalShippedCost,
        courierPendingCod: courierData.totalExpectedCod,
        partyReceivables,
        totalAssets,
        businessTotalAssets,
        partyPayables,
        pendingChequesTotal,
        otherLiabilitiesTotal,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
        businessNetWorth: businessTotalAssets - totalLiabilities,
        damagedGoodsLoss,
        accounts,
        otherLiabilities,
    }

    // Auto-save a 15-day report if >= 15 days since last snapshot
    await maybeAutoSave15DaySnapshot(supabase, result).catch(() => {})

    return result
}

async function maybeAutoSave15DaySnapshot(supabase: any, data: LiveNetWorthData) {
    const { data: latest } = await supabase
        .from('net_worth_snapshots')
        .select('snapshot_date')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle()

    const todayStr = new Date().toISOString().slice(0, 10)
    if (latest?.snapshot_date) {
        const lastDate = new Date(`${latest.snapshot_date}T00:00:00Z`)
        const todayDate = new Date(`${todayStr}T00:00:00Z`)
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays < 15) return
    }

    await upsertSnapshotRecord(supabase, data, `15-Day Report (${todayStr})`, null)
}

async function upsertSnapshotRecord(
    supabase: any,
    data: LiveNetWorthData,
    periodLabel: string,
    userId: string | null
) {
    const todayStr = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('net_worth_snapshots').upsert(
        {
            snapshot_date: todayStr,
            period_label: periodLabel,
            company_banks_total: data.companyBanksTotal,
            personal_total: data.personalTotal,
            cash_in_hand_total: data.cashInHandTotal,
            warehouse_stock_value: data.warehouseStockValue,
            daraz_in_transit_value: data.darazInTransitValue,
            daraz_pending_payout: data.darazPendingPayout,
            courier_in_transit_value: data.courierInTransitValue,
            courier_pending_cod: data.courierPendingCod,
            party_receivables: data.partyReceivables,
            party_payables: data.partyPayables,
            pending_cheques_total: data.pendingChequesTotal,
            other_liabilities_total: data.otherLiabilitiesTotal,
            damaged_goods_loss: data.damagedGoodsLoss,
            total_assets: data.totalAssets,
            total_liabilities: data.totalLiabilities,
            net_worth: data.netWorth,
            created_by: userId,
        },
        { onConflict: 'snapshot_date' }
    )
    if (error) throw new Error(error.message)
}

export async function saveNetWorthSnapshot(periodLabel?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const live = await getLiveNetWorth()
    const todayStr = new Date().toISOString().slice(0, 10)
    await upsertSnapshotRecord(supabase, live, periodLabel?.trim() || `15-Day Report (${todayStr})`, user.id)
    revalidatePath('/dashboard/account/transaction/net-worth')
}

export async function getNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('net_worth_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(48)

    if (error) return []
    return (data || []).map((s: any) => ({
        ...s,
        company_banks_total: Number(s.company_banks_total) || 0,
        personal_total: Number(s.personal_total) || 0,
        cash_in_hand_total: Number(s.cash_in_hand_total) || 0,
        warehouse_stock_value: Number(s.warehouse_stock_value) || 0,
        daraz_in_transit_value: Number(s.daraz_in_transit_value) || 0,
        daraz_pending_payout: Number(s.daraz_pending_payout) || 0,
        courier_in_transit_value: Number(s.courier_in_transit_value) || 0,
        courier_pending_cod: Number(s.courier_pending_cod) || 0,
        party_receivables: Number(s.party_receivables) || 0,
        party_payables: Number(s.party_payables) || 0,
        pending_cheques_total: Number(s.pending_cheques_total) || 0,
        other_liabilities_total: Number(s.other_liabilities_total) || 0,
        damaged_goods_loss: Number(s.damaged_goods_loss) || 0,
        total_assets: Number(s.total_assets) || 0,
        total_liabilities: Number(s.total_liabilities) || 0,
        net_worth: Number(s.net_worth) || 0,
    }))
}

export async function createOtherLiability(input: {
    title: string
    category: 'loan' | 'unpaid_bill' | 'other'
    amount: number
    due_date?: string | null
    notes?: string | null
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase.from('other_liabilities').insert({
        title: input.title.trim(),
        category: input.category,
        amount: Number(input.amount) || 0,
        due_date: input.due_date || null,
        notes: input.notes?.trim() || null,
        created_by: user.id,
    })

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/account/transaction/net-worth')
}

export async function toggleOtherLiabilityPaid(id: string, isPaid: boolean) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('other_liabilities')
        .update({ is_paid: isPaid, updated_at: new Date().toISOString() })
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/account/transaction/net-worth')
}

export async function deleteOtherLiability(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('other_liabilities').delete().eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/account/transaction/net-worth')
}
