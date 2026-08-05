'use server'

import { createClient } from '@/lib/supabase/server'
import { getSupplierLedger } from '@/features/suppliers/actions/supplier-ledger-actions'

export interface DashboardMetrics {
    userName: string
    timeGreeting: string
    headerTitle: string
    headerSubtitle: string
    
    activeFiscalYear: {
        id: string
        name: string
        start_date: string
        end_date: string
    } | null

    // Priority 1: Sales & Purchasing Today
    darazToday: {
        total: number
        pending: number
        packed: number
        readyToShip: number
        shipped: number
        returnedDelivered: number
        customerReturnDelivered: number
    }
    websiteSalesToday: {
        count: number
        totalAmount: number
    }
    storeSalesToday: {
        count: number
        totalAmount: number
    }
    purchaseToday: {
        itemCount: number
        purchaseAmount: number
        salesAmount: number
        transactions: {
            online: number
            cash: number
            due: number
            others: number
        }
    }

    // Priority 2: Inventory Overview
    inventory: {
        totalProducts: number
        totalValuation: number
        damagedCount: number
    }

    // Priority 3: Financial & Accounting (Fiscal Year)
    financials: {
        pendingSupplierDue: number
        purchaseBillingTotal: number
        salesBillingTotal: number
        estShippedTotal: number
    }

    // Priority 4: Notifications & Reminders
    notifications: {
        unreadDarazChats5Days: number
        unrepliedTextReviews: number
        openReminders: Array<{
            id: string
            title: string
            date: string
            time?: string
            type?: string
            created_at?: string
        }>
    }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    const supabase = await createClient()

    // 1. Get Nepal Today Date & Time
    const now = new Date()
    const nepalTime = new Date(now.getTime() + (345 + now.getTimezoneOffset()) * 60000)
    const todayStr = nepalTime.toISOString().split('T')[0]
    const todayStartIso = `${todayStr}T00:00:00.000Z`
    const todayEndIso = `${todayStr}T23:59:59.999Z`

    // Time Greeting (Morning / Afternoon / Evening)
    const hour = nepalTime.getHours()
    let timeGreeting = 'morning'
    if (hour >= 12 && hour < 17) {
        timeGreeting = 'afternoon'
    } else if (hour >= 17 || hour < 5) {
        timeGreeting = 'evening'
    }

    // Fetch Current User for Greeting
    let userName = 'Admin User'
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        if (user.user_metadata?.full_name) {
            userName = user.user_metadata.full_name
        } else {
            const { data: prof } = await supabase.from('user_profiles').select('full_name').eq('id', user.id).maybeSingle()
            if (prof?.full_name) userName = prof.full_name
            else if (user.email) userName = user.email.split('@')[0]
        }
    }

    const headerTitle = `Good ${timeGreeting}, ${userName}.`
    const headerSubtitle = `Welcome to your dashboard. Below is a summary of today's Orders, Inventory, and Purchasing activities.`

    // 5 Days Ago ISO string
    const fiveDaysAgo = new Date(nepalTime.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()

    // 2. Fetch Active Fiscal Year
    let activeFiscalYear = null
    const { data: fyData } = await supabase
        .from('fiscal_years')
        .select('id, name, start_date, end_date, is_active')
        .eq('is_active', true)
        .maybeSingle()

    if (fyData) {
        activeFiscalYear = fyData
    } else {
        const { data: latestFy } = await supabase
            .from('fiscal_years')
            .select('id, name, start_date, end_date, is_active')
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle()
        activeFiscalYear = latestFy || null
    }

    const fyId = activeFiscalYear?.id
    const fyStart = activeFiscalYear?.start_date
    const fyEnd = activeFiscalYear?.end_date

    // Helper for Daraz order status counting from daraz_orders_with_totals view
    const getDarazCount = async (status: string, todayOnlyDateField?: string) => {
        let query = supabase
            .from('daraz_orders_with_totals')
            .select('id', { count: 'exact', head: true })
            .or('deleted.is.null,deleted.eq.false')
            .or(`order_status.eq."${status}",statuses.cs.{${status}}`)

        if (todayOnlyDateField) {
            query = query.or(`${todayOnlyDateField}.gte.${todayStartIso},order_date.eq.${todayStr}`)
        }

        const { count, error } = await query
        if (error) return 0
        return count || 0
    }

    // 3. Execute all independent data queries in parallel
    const [
        darazPending,
        darazPacked,
        darazReadyToShip,
        darazShipped,
        darazReturnedDelivered,
        darazCustomerReturnDelivered,
        websiteTodayRes,
        storeTodayRes,
        purchaseTodayRes,
        productsCountRes,
        stockValuationRes,
        damagedStocksRes,
        purchaseBillingRes,
        salesBillingRes,
        estShippedRes,
        unreadChatsRes,
        unrepliedReviewsRes,
        openRemindersRes,
        supplierLedgerRes
    ] = await Promise.all([
        // Daraz Status Counts based on exact user logic
        getDarazCount('Pending'),
        getDarazCount('Packed'),
        getDarazCount('Ready to Ship'),
        getDarazCount('Shipped', 'shipped_at'),
        getDarazCount('Returned Delivered', 'returned_delivered_at'),
        getDarazCount('Customer Return Delivered', 'customer_return_delivered_at'),

        // Website Sales Today
        supabase
            .from('website_orders')
            .select('total_amount, created_at')
            .gte('created_at', todayStartIso)
            .lte('created_at', todayEndIso),

        // Store Sales Today
        supabase
            .from('store_sales')
            .select('total_amount, sale_date')
            .or(`deleted.is.null,deleted.eq.false`)
            .eq('sale_date', todayStr),

        // Purchase Entry Today (from purchases table)
        supabase
            .from('purchases')
            .select('id, purchase_date, purchase_type, payment_type, total_amount, quantity')
            .eq('purchase_date', todayStr),

        // Total Products Count
        supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('is_deleted', false),

        // Stock Valuation
        supabase
            .from('stock_ledger_view')
            .select('total_stock, est_price'),

        // Damaged Stocks Count
        supabase
            .from('damaged_stocks')
            .select('quantity, status'),

        // Purchase Billing Total (This Fiscal Year)
        fyStart && fyEnd
            ? supabase
                .from('pan_vat_bills')
                .select('total_amount')
                .eq('is_deleted', false)
                .gte('issue_bill_date_ad', fyStart)
                .lte('issue_bill_date_ad', fyEnd)
            : Promise.resolve({ data: [] }),

        // Sales Billing Total (This Fiscal Year)
        fyStart && fyEnd
            ? supabase
                .from('sales_bills')
                .select('grand_total, total_amount')
                .eq('is_deleted', false)
                .gte('issue_date', fyStart)
                .lte('issue_date', fyEnd)
            : Promise.resolve({ data: [] }),

        // Sales Report Est Shipped Total (This Fiscal Year)
        fyStart && fyEnd
            ? supabase
                .from('daraz_orders')
                .select('price')
                .or(`deleted.is.null,deleted.eq.false`)
                .gte('order_date', fyStart)
                .lte('order_date', fyEnd)
            : Promise.resolve({ data: [] }),

        // Unread Daraz Chats (Last 5 days)
        supabase
            .from('daraz_chat_sessions')
            .select('unread_count, last_message_time')
            .gt('unread_count', 0)
            .gte('last_message_time', fiveDaysAgo),

        // Unreplied Product Reviews
        supabase
            .from('daraz_reviews')
            .select('id, reply_status, review_content')
            .neq('reply_status', 'replied')
            .not('review_content', 'is', null)
            .neq('review_content', ''),

        // Open Reminders
        supabase
            .from('reminders')
            .select('id, title, date, time, type, status, created_at')
            .ilike('status', 'open')
            .order('date', { ascending: true })
            .limit(20),

        // Supplier Ledger for Pending Due Balance
        getSupplierLedger({ fiscalYearId: fyId }).catch(() => ({ ledger: [] }))
    ])

    const darazTotal = darazPending + darazPacked + darazReadyToShip + darazShipped + darazReturnedDelivered + darazCustomerReturnDelivered

    // --- Process Website Today ---
    const websiteOrders = websiteTodayRes.data || []
    const websiteCount = websiteOrders.length
    const websiteTotalAmount = websiteOrders.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0)

    // --- Process Store Sales Today ---
    const storeSales = storeTodayRes.data || []
    const storeCount = storeSales.length
    const storeTotalAmount = storeSales.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0)

    // --- Process Purchases Today (Buy vs Sell & Transaction Breakdown) ---
    const purchases = purchaseTodayRes.data || []
    let purchaseItemCount = 0
    let purchaseBuyAmount = 0
    let purchaseSalesAmount = 0
    let onlineAmount = 0
    let cashAmount = 0
    let dueAmount = 0
    let othersAmount = 0

    purchases.forEach((p: any) => {
        const pt = (p.purchase_type || '').trim().toLowerCase()
        const pay = (p.payment_type || '').trim().toLowerCase()
        const amt = Number(p.total_amount) || 0

        if (pt === 'buy') {
            purchaseItemCount += 1 // count product entries (rows)
            purchaseBuyAmount += amt

            if (pay === 'online') {
                onlineAmount += amt
            } else if (pay === 'cash') {
                cashAmount += amt
            } else if (pay === 'due') {
                dueAmount += amt
            } else {
                othersAmount += amt
            }
        } else if (pt === 'sell' || pt === 'sales') {
            purchaseSalesAmount += amt
        }
    })

    // --- Process Stock Valuation ---
    const stockItems = stockValuationRes.data || []
    const totalValuation = stockItems.reduce((sum, item) => {
        const qty = Number(item.total_stock) || 0
        const price = Number(item.est_price) || 0
        return sum + (qty > 0 ? qty * price : 0)
    }, 0)

    // --- Process Damaged Stocks ---
    const damagedRows = damagedStocksRes.data || []
    const damagedCount = damagedRows.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)

    // --- Process Financials ---
    const purchaseBills = (purchaseBillingRes as any).data || []
    const purchaseBillingTotal = purchaseBills.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0)

    const salesBills = (salesBillingRes as any).data || []
    const salesBillingTotal = salesBills.reduce((sum: number, b: any) => sum + (Number(b.grand_total || b.total_amount) || 0), 0)

    const shippedOrders = (estShippedRes as any).data || []
    const estShippedTotal = shippedOrders.reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0)

    // Process Supplier Ledger Pending Due Balance
    const ledger = supplierLedgerRes?.ledger || []
    const pendingSupplierDue = ledger.reduce((sum, entry) => {
        const bal = Number(entry.running_balance) || 0
        return sum + (bal > 0 ? bal : 0)
    }, 0)

    // --- Process Notifications ---
    const unreadChatsCount = (unreadChatsRes.data || []).length
    const unrepliedReviewsCount = (unrepliedReviewsRes.data || []).length
    const openReminders = (openRemindersRes.data || []).map((r: any) => ({
        id: r.id,
        title: r.title || 'Untitled Reminder',
        date: r.date,
        time: r.time,
        type: r.type,
        created_at: r.created_at
    }))

    return {
        userName,
        timeGreeting,
        headerTitle,
        headerSubtitle,
        activeFiscalYear,
        darazToday: {
            total: darazTotal,
            pending: darazPending,
            packed: darazPacked,
            readyToShip: darazReadyToShip,
            shipped: darazShipped,
            returnedDelivered: darazReturnedDelivered,
            customerReturnDelivered: darazCustomerReturnDelivered
        },
        websiteSalesToday: {
            count: websiteCount,
            totalAmount: websiteTotalAmount
        },
        storeSalesToday: {
            count: storeCount,
            totalAmount: storeTotalAmount
        },
        purchaseToday: {
            itemCount: purchaseItemCount,
            purchaseAmount: purchaseBuyAmount,
            salesAmount: purchaseSalesAmount,
            transactions: {
                online: onlineAmount,
                cash: cashAmount,
                due: dueAmount,
                others: othersAmount
            }
        },
        inventory: {
            totalProducts: productsCountRes.count || 0,
            totalValuation,
            damagedCount
        },
        financials: {
            pendingSupplierDue,
            purchaseBillingTotal,
            salesBillingTotal,
            estShippedTotal
        },
        notifications: {
            unreadDarazChats5Days: unreadChatsCount,
            unrepliedTextReviews: unrepliedReviewsCount,
            openReminders
        }
    }
}
