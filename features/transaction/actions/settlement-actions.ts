'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculateOrderProfitsForOrders } from '@/features/sales/utils/daraz-order-profit'
import type {
    CourierSettlementCard,
    CourierSettlementHistoryRow,
    DarazStoreSettlementCard,
    DarazWeeklySettlementRow,
} from '../types'

/**
 * Helper: Given any date string YYYY-MM-DD, return Monday and Sunday of that week
 */
function getMondayToSunday(dateStr: string): { weekStart: string; weekEnd: string } {
    const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`)
    if (isNaN(d.getTime())) {
        const now = new Date()
        return getMondayToSunday(now.toISOString().slice(0, 10))
    }
    const day = d.getUTCDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMon = day === 0 ? -6 : 1 - day
    const mon = new Date(d)
    mon.setUTCDate(d.getUTCDate() + diffToMon)
    const sun = new Date(mon)
    sun.setUTCDate(mon.getUTCDate() + 6)
    return {
        weekStart: mon.toISOString().slice(0, 10),
        weekEnd: sun.toISOString().slice(0, 10),
    }
}

/**
 * Fetch product cost map (latest purchase unit_amount per product_id) for accurate In-Transit cost valuation
 */
async function getProductCostMap(supabase: any): Promise<Map<string, number>> {
    const costMap = new Map<string, number>()
    const { data } = await supabase
        .from('purchases')
        .select('product_id, unit_amount, purchase_date')
        .order('purchase_date', { ascending: false })
        .limit(5000)

    for (const row of data || []) {
        if (row.product_id && !costMap.has(row.product_id)) {
            costMap.set(row.product_id, Number(row.unit_amount) || 0)
        }
    }
    return costMap
}

// ============================================================================
// DARAZ SETTLEMENTS (Monday -> Sunday per Store, Split-Bank Verify)
// ============================================================================

export async function getDarazSettlementData(): Promise<{
    stores: DarazStoreSettlementCard[]
    weeklyRows: DarazWeeklySettlementRow[]
    totalShippedCost: number
    totalExpectedDelivered: number
}> {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)
    const currentWeek = getMondayToSunday(today)
    // Auto-expiry rule: Only the current in-progress week AND the immediately previous completed week
    // can remain unverified. Any older unverified week is automatically excluded from pending & expected delivered.
    const prevWeekAnchor = new Date(`${currentWeek.weekStart}T00:00:00Z`)
    prevWeekAnchor.setUTCDate(prevWeekAnchor.getUTCDate() - 7)
    const minActiveUnverifiedWeekStart = prevWeekAnchor.toISOString().slice(0, 10)

    // Look back 90 days for unsettled delivered orders + all currently shipped orders
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const fetchAllDarazOrders = async () => {
        const all: any[] = []
        let page = 0
        const pageSize = 1000
        while (page < 4) {
            const { data, error } = await supabase
                .from('daraz_orders')
                .select(`
                    id,
                    order_number,
                    order_date,
                    order_status,
                    store_id,
                    updated_at,
                    delivered_at,
                    payout_settlement_id,
                    online_stores(seller_account),
                    daraz_order_items(id, product_id, product_name, seller_sku, quantity, amount, seller_account, item_status)
                `)
                .in('order_status', ['Shipped', 'shipped', 'Delivered', 'delivered', 'Ready to Ship', 'ready_to_ship'])
                .gte('order_date', cutoffStr)
                .order('id', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1)
            if (error || !data || data.length === 0) break
            all.push(...data)
            if (data.length < pageSize) break
            page++
        }
        return all
    }

    const [storesRes, rawOrders, settlementsRes, allocRes, profilesRes, accountsRes] = await Promise.all([
        supabase.from('online_stores').select('id, seller_account').order('seller_account', { ascending: true }),
        fetchAllDarazOrders(),
        supabase
            .from('daraz_payout_settlements')
            .select('*')
            .order('week_start', { ascending: false })
            .limit(100),
        supabase.from('daraz_payout_allocations').select('*').limit(500),
        supabase.from('user_profiles').select('id, full_name'),
        supabase.from('financial_accounts').select('id, name'),
    ])

    const profileMap = new Map<string, string>((profilesRes.data || []).map((p: any) => [p.id, p.full_name || 'Admin']))
    const accountMap = new Map<string, string>((accountsRes.data || []).map((a: any) => [a.id, a.name]))

    // Reuse existing Daraz profit & receivable calculator for accurate net payout and cost!
    const profitMap = new Map<string, any>()
    if (rawOrders.length > 0) {
        try {
            const allItems: any[] = []
            for (const o of rawOrders) {
                const items = Array.isArray((o as any).daraz_order_items) ? (o as any).daraz_order_items : []
                for (const it of items) {
                    allItems.push({ ...it, order_id: o.id })
                }
            }
            const enriched = await calculateOrderProfitsForOrders(rawOrders, allItems)
            for (const eo of enriched || []) {
                if (eo?.id && eo?.profit_info) {
                    profitMap.set(eo.id, eo.profit_info)
                }
            }
        } catch (err) {
            console.error('Error computing Daraz order profits for settlement:', err)
        }
    }

    const costMap = await getProductCostMap(supabase)

    // Initialize store cards from online_stores
    const storeCardMap = new Map<string, DarazStoreSettlementCard>()
    for (const s of storesRes.data || []) {
        const key = s.seller_account || 'Daraz Store'
        storeCardMap.set(key, {
            sellerAccount: key,
            storeId: s.id,
            shippedCount: 0,
            shippedCostValue: 0,
            deliveredUnsettledCount: 0,
            expectedDeliveredAmount: 0,
            carryForwardAmount: 0,
            lastVerifiedAt: null,
        })
    }

    // Map existing verified settlements by (weekStart + sellerAccount)
    const allocBySettlement = new Map<string, Array<{ account_id: string; account_name: string; amount: number }>>()
    for (const al of allocRes.data || []) {
        const list = allocBySettlement.get(al.settlement_id) || []
        list.push({
            account_id: al.account_id,
            account_name: accountMap.get(al.account_id) || 'Bank',
            amount: Number(al.amount) || 0,
        })
        allocBySettlement.set(al.settlement_id, list)
    }

    const verifiedMap = new Map<string, any>()
    const carryForwardByStore = new Map<string, number>()

    for (const st of settlementsRes.data || []) {
        const key = `${st.week_start}__${st.seller_account}`
        verifiedMap.set(key, st)

        const card = storeCardMap.get(st.seller_account)
        if (card) {
            if (!card.lastVerifiedAt || (st.verified_at && st.verified_at > card.lastVerifiedAt)) {
                card.lastVerifiedAt = st.verified_at
            }
        }
        if (st.variance_type === 'carry_forward' && Number(st.unsettled_amount) > 0) {
            carryForwardByStore.set(
                st.seller_account,
                (carryForwardByStore.get(st.seller_account) || 0) + Number(st.unsettled_amount)
            )
        }
    }

    // Group orders into Shipped (Real-Time) and Delivered (Mon-Sun weeks)
    const weekBuckets = new Map<
        string,
        {
            weekStart: string
            weekEnd: string
            sellerAccount: string
            storeId: string | null
            orderCount: number
            expectedAmount: number
        }
    >()

    for (const order of rawOrders) {
        const statusLower = (order.order_status || '').toLowerCase()
        const items = Array.isArray(order.daraz_order_items) ? order.daraz_order_items : []
        const storeRel: any = (order as any).online_stores
        const sellerAccount =
            (Array.isArray(storeRel) ? storeRel[0]?.seller_account : storeRel?.seller_account) ||
            items[0]?.seller_account ||
            'Daraz Store'

        if (!storeCardMap.has(sellerAccount)) {
            storeCardMap.set(sellerAccount, {
                sellerAccount,
                storeId: order.store_id || null,
                shippedCount: 0,
                shippedCostValue: 0,
                deliveredUnsettledCount: 0,
                expectedDeliveredAmount: 0,
                carryForwardAmount: 0,
                lastVerifiedAt: null,
            })
        }
        const card = storeCardMap.get(sellerAccount)!
        const profitInfo = profitMap.get(order.id)

        // Compute product cost of order
        let orderCost = 0
        if (profitInfo && Array.isArray(profitInfo.items) && profitInfo.items.length > 0) {
            orderCost = profitInfo.items.reduce((s: number, it: any) => s + (Number(it.totalCost) || 0), 0)
        } else {
            orderCost = items.reduce((s: number, it: any) => {
                const unitCost = it.product_id ? costMap.get(it.product_id) || 0 : 0
                return s + unitCost * (Number(it.quantity) || 1)
            }, 0)
        }

        // Compute expected net payout (after Daraz fees)
        let netPayout = 0
        if (profitInfo && profitInfo.receivableAmount !== null && profitInfo.receivableAmount !== undefined) {
            netPayout = Number(profitInfo.receivableAmount) || 0
        } else {
            const gross = items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0)
            netPayout = gross * 0.85 // conservative fallback if SKU not mapped
        }

        if (statusLower === 'shipped' || statusLower === 'ready to ship' || statusLower === 'ready_to_ship') {
            card.shippedCount += 1
            card.shippedCostValue += orderCost
        } else if (statusLower === 'delivered') {
            const deliveredDate = (order.delivered_at || order.updated_at || order.order_date || today).slice(0, 10)
            const { weekStart, weekEnd } = getMondayToSunday(deliveredDate)
            const bucketKey = `${weekStart}__${sellerAccount}`

            const isAlreadyVerified = Boolean(order.payout_settlement_id) || verifiedMap.has(bucketKey)
            // If week is older than immediately previous week and still NOT verified, auto-expire it
            if (!isAlreadyVerified && weekStart < minActiveUnverifiedWeekStart) {
                continue
            }

            const existingBucket = weekBuckets.get(bucketKey) || {
                weekStart,
                weekEnd,
                sellerAccount,
                storeId: order.store_id || card.storeId,
                orderCount: 0,
                expectedAmount: 0,
            }
            existingBucket.orderCount += 1
            existingBucket.expectedAmount += netPayout
            weekBuckets.set(bucketKey, existingBucket)

            // Only count toward pending receivable if not yet verified
            if (!isAlreadyVerified) {
                card.deliveredUnsettledCount += 1
                card.expectedDeliveredAmount += netPayout
            }
        }
    }

    // Add carry-forward amounts to store cards
    for (const [seller, cfAmt] of carryForwardByStore.entries()) {
        const card = storeCardMap.get(seller)
        if (card) {
            card.carryForwardAmount = cfAmt
        }
    }

    // Build combined weekly rows (both unverified buckets + verified settlements)
    const allWeekKeys = new Set<string>([...weekBuckets.keys(), ...verifiedMap.keys()])
    const weeklyRows: DarazWeeklySettlementRow[] = []

    for (const key of allWeekKeys) {
        const bucket = weekBuckets.get(key)
        const verified = verifiedMap.get(key)

        const weekStart = verified?.week_start || bucket!.weekStart
        const weekEnd = verified?.week_end || bucket!.weekEnd
        const sellerAccount = verified?.seller_account || bucket!.sellerAccount
        const storeId = verified?.store_id || bucket?.storeId || null
        const expectedAmount = verified ? Number(verified.expected_amount) : Math.round((bucket?.expectedAmount || 0) * 100) / 100
        const isWeekCompleted = weekEnd < today

        weeklyRows.push({
            weekStart,
            weekEnd,
            sellerAccount,
            storeId,
            orderCount: bucket?.orderCount || 0,
            expectedAmount,
            carryForwardIn: 0,
            totalExpected: expectedAmount,
            isWeekCompleted,
            settlementId: verified?.id || null,
            status: verified ? 'verified' : isWeekCompleted ? 'ready' : 'in_progress',
            receivedTotal: verified ? Number(verified.received_total) : 0,
            unsettledAmount: verified ? Number(verified.unsettled_amount) : expectedAmount,
            varianceType: verified?.variance_type || null,
            verifiedAt: verified?.verified_at || null,
            verifiedByName: verified?.verified_by ? profileMap.get(verified.verified_by) || 'Admin' : null,
            allocations: verified ? allocBySettlement.get(verified.id) || [] : [],
            notes: verified?.notes || null,
        })
    }

    weeklyRows.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.sellerAccount.localeCompare(b.sellerAccount))

    const stores = Array.from(storeCardMap.values())
    const totalShippedCost = stores.reduce((s, c) => s + c.shippedCostValue, 0)
    const totalExpectedDelivered = stores.reduce((s, c) => s + c.expectedDeliveredAmount + c.carryForwardAmount, 0)

    return { stores, weeklyRows, totalShippedCost, totalExpectedDelivered }
}

export async function verifyDarazSettlement(input: {
    weekStart: string
    weekEnd: string
    sellerAccount: string
    storeId?: string | null
    expectedAmount: number
    allocations: Array<{ accountId: string; amount: number }>
    varianceType: 'exact' | 'penalty_fee' | 'carry_forward'
    settlementDate?: string
    notes?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const validAllocations = input.allocations.filter((a) => a.accountId && Number(a.amount) > 0)
    if (validAllocations.length === 0) {
        throw new Error('Please add at least one Bank Account with an amount greater than 0')
    }

    const receivedTotal = validAllocations.reduce((s, a) => s + Number(a.amount), 0)
    const unsettledAmount = Math.round((Number(input.expectedAmount) - receivedTotal) * 100) / 100
    const txDate = input.settlementDate || new Date().toISOString().slice(0, 10)

    const { data: settlement, error: stErr } = await supabase
        .from('daraz_payout_settlements')
        .insert({
            week_start: input.weekStart,
            week_end: input.weekEnd,
            store_id: input.storeId || null,
            seller_account: input.sellerAccount,
            expected_amount: Number(input.expectedAmount),
            received_total: receivedTotal,
            unsettled_amount: unsettledAmount,
            variance_type: Math.abs(unsettledAmount) < 0.01 ? 'exact' : input.varianceType,
            status: 'verified',
            notes: input.notes?.trim() || null,
            verified_by: user.id,
        })
        .select()
        .single()

    if (stErr) throw new Error(stErr.message)

    // Create CashFlow Money In + Allocation row for EACH split bank so Bank Statement updates in real time!
    for (const alloc of validAllocations) {
        const { data: tx, error: txErr } = await supabase
            .from('cash_transactions')
            .insert({
                transaction_date: txDate,
                account_id: alloc.accountId,
                direction: 'in',
                scope: 'business',
                category: 'Daraz Payout',
                amount: Number(alloc.amount),
                party_or_particular: `Daraz Payout - ${input.sellerAccount} (${input.weekStart} to ${input.weekEnd})`,
                source_type: 'daraz_settlement',
                source_id: settlement.id,
                notes: input.notes?.trim() || null,
                created_by: user.id,
            })
            .select()
            .single()

        if (txErr) throw new Error(txErr.message)

        await supabase.from('daraz_payout_allocations').insert({
            settlement_id: settlement.id,
            account_id: alloc.accountId,
            amount: Number(alloc.amount),
            cash_transaction_id: tx.id,
        })
    }

    revalidatePath('/dashboard/account/transaction')
    return settlement
}

// ============================================================================
// COURIER / LOGISTICS SETTLEMENTS (Facebook message-order-web & Website COD)
// ============================================================================

export async function getCourierSettlementData(): Promise<{
    couriers: CourierSettlementCard[]
    history: CourierSettlementHistoryRow[]
    courierNames: string[]
    totalShippedCost: number
    totalExpectedCod: number
}> {
    const supabase = await createClient()

    const [mpRes, webRes, couriersRes, historyRes, allocRes, profilesRes, accountsRes, costMap] = await Promise.all([
        supabase
            .from('marketplace_orders')
            .select(`
                id,
                sales_id,
                order_date,
                customer_name,
                total_amount,
                delivery_charge,
                branch_charge,
                order_status,
                delivered_at,
                courier_id,
                logistic_name,
                courier_provider,
                cod_settlement_status,
                courier:couriers(id, courier_name),
                items:marketplace_order_items(product_id, quantity, amount)
            `)
            .in('order_status', ['Shipped', 'Delivered'])
            .limit(2000),
        supabase
            .from('website_orders')
            .select(`
                id,
                sales_id,
                order_date,
                customer_name,
                total_amount,
                delivery_charge,
                order_status,
                delivered_at,
                logistic_name,
                courier_provider,
                cod_settlement_status,
                items:website_order_items(product_id, quantity, amount)
            `)
            .in('order_status', ['Shipped', 'Delivered'])
            .limit(1000),
        supabase.from('couriers').select('id, courier_name').order('courier_name', { ascending: true }),
        supabase
            .from('courier_settlements')
            .select('*')
            .order('settlement_date', { ascending: false })
            .limit(100),
        supabase.from('courier_settlement_allocations').select('*').limit(500),
        supabase.from('user_profiles').select('id, full_name'),
        supabase.from('financial_accounts').select('id, name'),
        getProductCostMap(supabase),
    ])

    const profileMap = new Map<string, string>((profilesRes.data || []).map((p: any) => [p.id, p.full_name || 'Admin']))
    const accountMap = new Map<string, string>((accountsRes.data || []).map((a: any) => [a.id, a.name]))

    const cardMap = new Map<string, CourierSettlementCard>()
    const knownNames = new Set<string>()

    for (const c of couriersRes.data || []) {
        if (c.courier_name) {
            knownNames.add(c.courier_name)
        }
    }

    const ensureCard = (name: string, courierId: string | null = null) => {
        const clean = (name || 'Direct / Unassigned Courier').trim()
        knownNames.add(clean)
        if (!cardMap.has(clean)) {
            cardMap.set(clean, {
                courierName: clean,
                courierId,
                shippedCount: 0,
                shippedCostValue: 0,
                deliveredUnsettledCount: 0,
                expectedCodAmount: 0,
                orders: [],
            })
        }
        return cardMap.get(clean)!
    }

    const processOrder = (o: any, source: 'marketplace' | 'website') => {
        const courierName =
            o.courier?.courier_name ||
            o.logistic_name ||
            o.courier_provider ||
            'Direct / Unassigned Courier'
        const card = ensureCard(courierName, o.courier_id || o.courier?.id || null)
        const items = Array.isArray(o.items) ? o.items : []

        if (o.order_status === 'Shipped') {
            card.shippedCount += 1
            const cost = items.reduce((s: number, it: any) => {
                const unitCost = it.product_id ? costMap.get(it.product_id) || 0 : 0
                return s + unitCost * (Number(it.quantity) || 1)
            }, 0)
            card.shippedCostValue += cost
        } else if (o.order_status === 'Delivered' && o.cod_settlement_status !== 'settled') {
            // Cutoff: ignore historical delivered orders before 2026-11-24 so pending COD starts clean at 0
            const deliveredDateStr = (o.delivered_at || o.order_date || '').slice(0, 10)
            if (!deliveredDateStr || deliveredDateStr < '2026-11-24') {
                return
            }
            const totalAmt = Number(o.total_amount) || 0
            const delCharge = Number(o.delivery_charge) || Number(o.branch_charge) || 0
            const netCod = Math.max(0, totalAmt - delCharge)
            card.deliveredUnsettledCount += 1
            card.expectedCodAmount += netCod
            card.orders.push({
                id: o.id,
                source,
                sales_id: o.sales_id || o.id.slice(0, 8),
                order_date: o.order_date || '',
                delivered_at: o.delivered_at || null,
                customer_name: o.customer_name || 'Customer',
                total_amount: totalAmt,
                delivery_charge: delCharge,
                net_cod: netCod,
            })
        }
    }

    if (!mpRes.error) {
        for (const o of mpRes.data || []) processOrder(o, 'marketplace')
    }
    if (!webRes.error) {
        for (const o of webRes.data || []) processOrder(o, 'website')
    }

    const allocBySettlement = new Map<string, Array<{ account_id: string; account_name: string; amount: number }>>()
    for (const al of allocRes.data || []) {
        const list = allocBySettlement.get(al.settlement_id) || []
        list.push({
            account_id: al.account_id,
            account_name: accountMap.get(al.account_id) || 'Bank',
            amount: Number(al.amount) || 0,
        })
        allocBySettlement.set(al.settlement_id, list)
    }

    const history: CourierSettlementHistoryRow[] = (historyRes.data || []).map((h: any) => ({
        id: h.id,
        courier_name: h.courier_name,
        settlement_date: h.settlement_date,
        expected_amount: Number(h.expected_amount) || 0,
        received_total: Number(h.received_total) || 0,
        unsettled_amount: Number(h.unsettled_amount) || 0,
        variance_type: h.variance_type,
        order_count: Number(h.order_count) || 0,
        verified_at: h.verified_at,
        verified_by_name: h.verified_by ? profileMap.get(h.verified_by) || 'Admin' : 'Admin',
        notes: h.notes,
        allocations: allocBySettlement.get(h.id) || [],
    }))

    const couriers = Array.from(cardMap.values()).sort((a, b) => b.expectedCodAmount - a.expectedCodAmount)
    const totalShippedCost = couriers.reduce((s, c) => s + c.shippedCostValue, 0)
    const totalExpectedCod = couriers.reduce((s, c) => s + c.expectedCodAmount, 0)

    return {
        couriers,
        history,
        courierNames: Array.from(knownNames).sort(),
        totalShippedCost,
        totalExpectedCod,
    }
}

export async function verifyCourierSettlement(input: {
    courierName: string
    courierId?: string | null
    expectedAmount: number
    allocations: Array<{ accountId: string; amount: number }>
    varianceType: 'exact' | 'delivery_rto_fee' | 'carry_forward'
    marketplaceOrderIds?: string[]
    websiteOrderIds?: string[]
    settlementDate?: string
    notes?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const validAllocations = input.allocations.filter((a) => a.accountId && Number(a.amount) > 0)
    if (validAllocations.length === 0) {
        throw new Error('Please add at least one Bank Account with an amount greater than 0')
    }
    if (!input.courierName.trim()) {
        throw new Error('Please enter or select a Courier Name')
    }

    const receivedTotal = validAllocations.reduce((s, a) => s + Number(a.amount), 0)
    const unsettledAmount = Math.round((Number(input.expectedAmount) - receivedTotal) * 100) / 100
    const txDate = input.settlementDate || new Date().toISOString().slice(0, 10)
    const mpIds = input.marketplaceOrderIds || []
    const webIds = input.websiteOrderIds || []

    const { data: settlement, error: stErr } = await supabase
        .from('courier_settlements')
        .insert({
            courier_name: input.courierName.trim(),
            courier_id: input.courierId || null,
            settlement_date: txDate,
            expected_amount: Number(input.expectedAmount),
            received_total: receivedTotal,
            unsettled_amount: unsettledAmount,
            variance_type: Math.abs(unsettledAmount) < 0.01 ? 'exact' : input.varianceType,
            order_count: mpIds.length + webIds.length,
            status: 'verified',
            notes: input.notes?.trim() || null,
            verified_by: user.id,
        })
        .select()
        .single()

    if (stErr) throw new Error(stErr.message)

    // Create CashFlow Money In + Allocation row per split bank
    for (const alloc of validAllocations) {
        const { data: tx, error: txErr } = await supabase
            .from('cash_transactions')
            .insert({
                transaction_date: txDate,
                account_id: alloc.accountId,
                direction: 'in',
                scope: 'business',
                category: 'Courier COD Payout',
                amount: Number(alloc.amount),
                party_or_particular: `Courier COD - ${input.courierName.trim()} (${mpIds.length + webIds.length} orders)`,
                source_type: 'courier_settlement',
                source_id: settlement.id,
                notes: input.notes?.trim() || null,
                created_by: user.id,
            })
            .select()
            .single()

        if (txErr) throw new Error(txErr.message)

        await supabase.from('courier_settlement_allocations').insert({
            settlement_id: settlement.id,
            account_id: alloc.accountId,
            amount: Number(alloc.amount),
            cash_transaction_id: tx.id,
        })
    }

    // Mark selected delivered orders as settled
    if (mpIds.length > 0) {
        await supabase
            .from('marketplace_orders')
            .update({ cod_settlement_status: 'settled', cod_settlement_id: settlement.id })
            .in('id', mpIds)
    }
    if (webIds.length > 0) {
        await supabase
            .from('website_orders')
            .update({ cod_settlement_status: 'settled', cod_settlement_id: settlement.id })
            .in('id', webIds)
    }

    revalidatePath('/dashboard/account/transaction')
    return settlement
}
