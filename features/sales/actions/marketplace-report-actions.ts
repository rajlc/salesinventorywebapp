'use server'

import { createClient } from '@/lib/supabase/server'

interface DailyReportItem {
    date: string
    courier_id: string
    courier_name: string
    shipped_qty: number
    shipped_amount: number
    delivered_qty: number
    returning_to_seller_qty: number
    failed_delivered_qty: number
    customer_return_qty: number
    return_delivered_qty: number
}

export async function getDailySalesReport() {
    const supabase = await createClient()

    // Fetch all orders with their status timestamps
    // We only need orders that have at least one relevant timestamp
    // For simplicity, we'll fetch all non-cancelled orders or just all orders and filter in code
    // Optimization: filtering where at least one date is not null would be better but complex string building
    // Let's fetch all orders for now, projecting only necessary fields for speed.

    const { data: orders, error } = await supabase
        .from('marketplace_orders')
        .select(`
            id,
            total_amount,
            courier_id,
            courier:couriers(id, courier_name),
            shipped_at,
            delivered_at,
            returned_to_seller_at,
            failed_delivered_at,
            customer_return_at,
            return_delivered_at
        `)
        .not('courier_id', 'is', null) // Only orders with couriers

    if (error) {
        console.error('Error fetching report data:', error)
        return []
    }

    const reportMap = new Map<string, DailyReportItem>()

    // Helper to get map key
    const getKey = (date: string, courierId: string) => `${date}|${courierId}`

    // Helper to process a specific status date for an order
    const processStatus = (
        order: any,
        dateString: string | null,
        field: keyof DailyReportItem,
        isAmountField: boolean = false
    ) => {
        if (!dateString) return

        const date = dateString.split('T')[0]
        const courierId = order.courier_id
        const courierName = order.courier?.courier_name || 'Unknown'
        const key = getKey(date, courierId)

        if (!reportMap.has(key)) {
            reportMap.set(key, {
                date,
                courier_id: courierId,
                courier_name: courierName,
                shipped_qty: 0,
                shipped_amount: 0,
                delivered_qty: 0,
                returning_to_seller_qty: 0,
                failed_delivered_qty: 0,
                customer_return_qty: 0,
                return_delivered_qty: 0
            })
        }

        const entry = reportMap.get(key)!

        if (isAmountField) {
            (entry as any)[field] += (order.total_amount || 0)
        } else {
            (entry as any)[field] += 1 // Adding 1 for Order Count
        }
    }

    // Iterate orders and aggregates
    orders.forEach(order => {
        if (!order.courier_id) return

        processStatus(order, order.shipped_at, 'shipped_qty')
        processStatus(order, order.shipped_at, 'shipped_amount', true)

        processStatus(order, order.delivered_at, 'delivered_qty')
        processStatus(order, order.returned_to_seller_at, 'returning_to_seller_qty')
        processStatus(order, order.failed_delivered_at, 'failed_delivered_qty')
        processStatus(order, order.customer_return_at, 'customer_return_qty')
        processStatus(order, order.return_delivered_at, 'return_delivered_qty')
    })

    // Convert map to array and sort by date descending
    const report = Array.from(reportMap.values()).sort((a, b) => {
        if (a.date === b.date) {
            return a.courier_name.localeCompare(b.courier_name)
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return report
}

interface OrderSummaryItem {
    courier_id: string
    courier_name: string
    shipped_qty: number
    shipped_amount: number
    delivered_qty: number
    returning_to_seller_qty: number
    failed_delivered_qty: number
    customer_return_qty: number
    return_delivered_qty: number
}

export async function getOrderSummaryReport() {
    const supabase = await createClient()

    // Reuse the same fetch logic as daily report
    const { data: orders, error } = await supabase
        .from('marketplace_orders')
        .select(`
            id,
            total_amount,
            courier_id,
            courier:couriers(id, courier_name),
            shipped_at,
            delivered_at,
            returned_to_seller_at,
            failed_delivered_at,
            customer_return_at,
            return_delivered_at
        `)
        .not('courier_id', 'is', null)

    if (error) {
        console.error('Error fetching summary data:', error)
        return []
    }

    const reportMap = new Map<string, OrderSummaryItem>()

    const processStatus = (
        order: any,
        dateString: string | null,
        field: keyof OrderSummaryItem,
        isAmountField: boolean = false
    ) => {
        if (!dateString) return

        const courierId = order.courier_id
        const courierName = order.courier?.courier_name || 'Unknown'

        if (!reportMap.has(courierId)) {
            reportMap.set(courierId, {
                courier_id: courierId,
                courier_name: courierName,
                shipped_qty: 0,
                shipped_amount: 0,
                delivered_qty: 0,
                returning_to_seller_qty: 0,
                failed_delivered_qty: 0,
                customer_return_qty: 0,
                return_delivered_qty: 0
            })
        }

        const entry = reportMap.get(courierId)!

        if (isAmountField) {
            (entry as any)[field] += (order.total_amount || 0)
        } else {
            (entry as any)[field] += 1
        }
    }

    orders.forEach(order => {
        if (!order.courier_id) return

        processStatus(order, order.shipped_at, 'shipped_qty')
        processStatus(order, order.shipped_at, 'shipped_amount', true)
        processStatus(order, order.delivered_at, 'delivered_qty')
        processStatus(order, order.returned_to_seller_at, 'returning_to_seller_qty')
        processStatus(order, order.failed_delivered_at, 'failed_delivered_qty')
        processStatus(order, order.customer_return_at, 'customer_return_qty')
        processStatus(order, order.return_delivered_at, 'return_delivered_qty')
    })

    // Sort by name
    return Array.from(reportMap.values()).sort((a, b) =>
        a.courier_name.localeCompare(b.courier_name)
    )
}
