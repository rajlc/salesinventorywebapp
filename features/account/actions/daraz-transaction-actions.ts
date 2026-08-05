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

    // 1. Get daily estimated revenue (delivered orders) from RPC get_daily_profit_stats
    const { data: deliveredStats, error: delErr } = await supabase.rpc('get_daily_profit_stats', {
        search_term_param: '',
        sync_status_param: 'all',
        start_date_param: startDate || null,
        end_date_param: endDate || null,
        seller_account_param: 'All'
    })

    if (delErr) {
        console.error('Error fetching delivered stats:', delErr)
        throw delErr
    }

    // 2. Get daily shipped stats (orders shipped on that date or in status Shipped)
    const shippedOrders: any[] = []
    let fetchPage = 0
    let hasMore = true

    while (hasMore) {
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
            .range(fetchPage * 1000, (fetchPage + 1) * 1000 - 1)

        if (shipErr) {
            console.error('Error fetching shipped orders:', shipErr)
            throw shipErr
        }

        if (!chunk || chunk.length === 0) {
            hasMore = false
            break
        }

        shippedOrders.push(...chunk)

        if (chunk.length < 1000) {
            hasMore = false
        } else {
            fetchPage++
        }
    }

    // Process and merge the two data sources:
    // map of date -> sellerAccount -> { revenue, shippedAmount }
    const result: Record<string, Record<string, { revenue: number; shippedAmount: number }>> = {}

    const getOrCreate = (date: string, seller: string) => {
        if (!result[date]) result[date] = {}
        if (!result[date][seller]) result[date][seller] = { revenue: 0, shippedAmount: 0 }
        return result[date][seller]
    };

    // Process delivered (from RPC)
    ;(deliveredStats || []).forEach((row: any) => {
        const date = row.date // YYYY-MM-DD
        const seller = row.seller
        const entry = getOrCreate(date, seller)
        entry.revenue += parseFloat(row.revenue) || 0
    });

    // Process shipped orders
    ;(shippedOrders || []).forEach((order: any) => {
        let dateStr: string | null = null
        if (order.shipped_at) {
            dateStr = new Date(order.shipped_at).toISOString().split('T')[0]
        } else if (order.order_status === 'Shipped' && order.updated_at) {
            dateStr = new Date(order.updated_at).toISOString().split('T')[0]
        }

        if (!dateStr) return
        
        // Filter by date range in JS
        if (startDate && dateStr < startDate) return
        if (endDate && dateStr > endDate) return

        const seller = order.online_stores?.seller_account || 'Unknown'
        const entry = getOrCreate(dateStr, seller)
        entry.shippedAmount += parseFloat(order.price) || 0
    });

    // Flatten into array
    const list: Array<{
        date: string
        sellerAccount: string
        revenue: number
        shippedAmount: number
    }> = []

    Object.keys(result).forEach(date => {
        Object.keys(result[date]).forEach(sellerAccount => {
            const data = result[date][sellerAccount]
            list.push({
                date,
                sellerAccount,
                revenue: data.revenue,
                shippedAmount: data.shippedAmount
            })
        })
    })

    return list
}


