'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DarazWeeklyTransaction {
    id?: string
    start_date: string
    end_date: string
    seller_account: string
    company_name: string
    estimated_sales_amount: number
    sales_amount: number
    cofunded_voucher_max: number
    payment_fee: number
    daraz_coins_discount_participation_fee: number
    free_shipping_max_fee: number
    commission_fee: number
    general_sales_tax_withholding: number
    handling_fee: number
    total_commission_fees: number
    fiscal_year_id?: string | null
    created_at?: string
    updated_at?: string
    created_by?: string | null
}

// Fetch all saved weekly transactions for a fiscal year
export async function getDarazWeeklyTransactions(fiscalYearId?: string) {
    const supabase = await createClient()

    let query = supabase
        .from('daraz_weekly_transactions')
        .select('*')

    if (fiscalYearId && fiscalYearId !== 'all') {
        query = query.eq('fiscal_year_id', fiscalYearId)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching Daraz weekly transactions:', error)
        throw error
    }

    return data as DarazWeeklyTransaction[]
}

// Save or update weekly transaction
export async function saveDarazWeeklyTransaction(transaction: Omit<DarazWeeklyTransaction, 'id' | 'created_at' | 'updated_at' | 'created_by'>) {
    const supabase = await createClient()

    // Get current user for audit
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('daraz_weekly_transactions')
        .upsert({
            ...transaction,
            created_by: user?.id || null,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'start_date,end_date,seller_account'
        })
        .select()
        .single()

    if (error) {
        console.error('Error saving Daraz weekly transaction:', error)
        throw error
    }

    revalidatePath('/dashboard/account/pan-vat-billing/daraz-transaction')
    return data as DarazWeeklyTransaction
}

// Fetch weekly estimated sales from delivered orders for a seller and date range
export async function getWeeklyEstimatedSales(startDate: string, endDate: string, sellerAccount: string) {
    const supabase = await createClient()

    // Query get_daily_profit_stats RPC to sum up revenue for the date range
    const { data, error } = await supabase.rpc('get_daily_profit_stats', {
        search_term_param: '',
        sync_status_param: 'all',
        start_date_param: startDate,
        end_date_param: endDate,
        seller_account_param: sellerAccount
    })

    if (error) {
        console.error('Error calculating weekly estimated sales:', error)
        return 0
    }

    // Sum up the revenue field from all matching daily records
    const totalRevenue = (data || []).reduce((sum: number, row: any) => sum + (parseFloat(row.revenue) || 0), 0)
    return totalRevenue
}

// Fetch daily estimated revenue AND daily shipped amount from database
export async function getDailyDarazReportData(startDate: string, endDate: string) {
    const supabase = await createClient()

    // 1. Fetch delivered orders from database for accurate sales amount and commission fees
    const deliveredOrders: any[] = []
    let fetchDelPage = 0
    let hasMoreDel = true

    while (hasMoreDel) {
        let query = supabase
            .from('daraz_orders')
            .select(`
                price,
                daraz_fees,
                order_status,
                updated_at,
                delivered_at,
                online_stores!inner(seller_account)
            `)
            .eq('deleted', false)
            .eq('order_status', 'Delivered')

        if (startDate) {
            query = query.or(`delivered_at.gte.${startDate}T00:00:00+00:00,updated_at.gte.${startDate}T00:00:00+00:00`)
        }
        if (endDate) {
            query = query.or(`delivered_at.lte.${endDate}T23:59:59+00:00,updated_at.lte.${endDate}T23:59:59+00:00`)
        }

        const { data: chunk, error: delErr } = await query
            .range(fetchDelPage * 1000, (fetchDelPage + 1) * 1000 - 1)

        if (delErr) {
            console.error('Error fetching delivered orders:', delErr)
            break
        }

        if (!chunk || chunk.length === 0) {
            hasMoreDel = false
            break
        }

        deliveredOrders.push(...chunk)

        if (chunk.length < 1000) {
            hasMoreDel = false
        } else {
            fetchDelPage++
        }
    }

    // 2. Supplementary: Get daily profit stats from RPC get_daily_profit_stats
    const { data: deliveredStats } = await supabase.rpc('get_daily_profit_stats', {
        search_term_param: '',
        sync_status_param: 'all',
        start_date_param: startDate || null,
        end_date_param: endDate || null,
        seller_account_param: 'All'
    })

    // 3. Get daily shipped stats (orders shipped on that date or in status Shipped)
    const shippedOrders: any[] = []
    let fetchShipPage = 0
    let hasMoreShip = true

    while (hasMoreShip) {
        let query = supabase
            .from('daraz_orders')
            .select(`
                price,
                order_status,
                updated_at,
                shipped_at,
                online_stores!inner(seller_account)
            `)
            .eq('deleted', false)

        if (startDate) {
            query = query.or(`shipped_at.gte.${startDate}T00:00:00+00:00,and(order_status.eq.Shipped,updated_at.gte.${startDate}T00:00:00+00:00)`)
        }
        if (endDate) {
            query = query.or(`shipped_at.lte.${endDate}T23:59:59+00:00,and(order_status.eq.Shipped,updated_at.lte.${endDate}T23:59:59+00:00)`)
        }

        const { data: chunk, error: shipErr } = await query
            .range(fetchShipPage * 1000, (fetchShipPage + 1) * 1000 - 1)

        if (shipErr) {
            console.error('Error fetching shipped orders:', shipErr)
            break
        }

        if (!chunk || chunk.length === 0) {
            hasMoreShip = false
            break
        }

        shippedOrders.push(...chunk)

        if (chunk.length < 1000) {
            hasMoreShip = false
        } else {
            fetchShipPage++
        }
    }

    // Process and merge data sources:
    // map of date -> sellerAccount -> { revenue, commissionFees, shippedAmount }
    const result: Record<string, Record<string, { revenue: number; commissionFees: number; shippedAmount: number }>> = {}

    const getOrCreate = (date: string, seller: string) => {
        if (!result[date]) result[date] = {}
        if (!result[date][seller]) result[date][seller] = { revenue: 0, commissionFees: 0, shippedAmount: 0 }
        return result[date][seller]
    }

    // Process delivered orders from direct DB query
    deliveredOrders.forEach((order: any) => {
        let dateStr: string | null = null
        if (order.delivered_at) {
            dateStr = new Date(order.delivered_at).toISOString().split('T')[0]
        } else if (order.updated_at) {
            dateStr = new Date(order.updated_at).toISOString().split('T')[0]
        }

        if (!dateStr) return
        if (startDate && dateStr < startDate) return
        if (endDate && dateStr > endDate) return

        const seller = order.online_stores?.seller_account || 'Unknown'
        const entry = getOrCreate(dateStr, seller)

        const price = parseFloat(order.price) || 0
        entry.revenue += price

        // Calculate fee: stored daraz_fees or estimate if not yet synced
        let fee = parseFloat(order.daraz_fees)
        if (isNaN(fee) || fee <= 0) {
            fee = price > 0 ? ((price * 0.04 * 1.13) + (price * 0.03) + (price * 0.0634) + (price * 0.0282) + 11.30 + 5.65 + (price * 0.01)) : 0
        }
        entry.commissionFees += fee
    })

    // Supplementary: process RPC stats for any missing dates
    ;(deliveredStats || []).forEach((row: any) => {
        const date = row.date // YYYY-MM-DD
        const seller = row.seller
        const entry = getOrCreate(date, seller)
        
        const r = parseFloat(row.revenue) || 0
        if (entry.revenue === 0 && r > 0) {
            entry.revenue = r
        }
        
        if (entry.commissionFees === 0 && r > 0) {
            const cost = parseFloat(row.cost) || 0
            const profit = parseFloat(row.profit) || 0
            const feeFromProfit = r - cost - profit
            if (feeFromProfit > 0) {
                entry.commissionFees = feeFromProfit
            } else {
                entry.commissionFees = r * 0.2565
            }
        }
    })

    // Process shipped orders
    shippedOrders.forEach((order: any) => {
        let dateStr: string | null = null
        if (order.shipped_at) {
            dateStr = new Date(order.shipped_at).toISOString().split('T')[0]
        } else if (order.order_status === 'Shipped' && order.updated_at) {
            dateStr = new Date(order.updated_at).toISOString().split('T')[0]
        }

        if (!dateStr) return
        if (startDate && dateStr < startDate) return
        if (endDate && dateStr > endDate) return

        const seller = order.online_stores?.seller_account || 'Unknown'
        const entry = getOrCreate(dateStr, seller)
        entry.shippedAmount += parseFloat(order.price) || 0
    })

    // Flatten into array
    const list: Array<{
        date: string
        sellerAccount: string
        revenue: number
        commissionFees: number
        shippedAmount: number
    }> = []

    Object.keys(result).forEach(date => {
        Object.keys(result[date]).forEach(sellerAccount => {
            const data = result[date][sellerAccount]
            list.push({
                date,
                sellerAccount,
                revenue: Math.round(data.revenue * 100) / 100,
                commissionFees: Math.round(data.commissionFees * 100) / 100,
                shippedAmount: Math.round(data.shippedAmount * 100) / 100
            })
        })
    })

    return list
}


