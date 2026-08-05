'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DarazOrderReport {
    id: string
    report_name: string
    created_at: string
    order_count: number
}

export async function getDarazOrderReports() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('daraz_order_reports')
        .select(`
            id,
            report_name,
            created_at,
            daraz_order_report_items(count)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching reports:', error)
        throw new Error('Failed to fetch reports')
    }

    return data.map((report: any) => ({
        id: report.id,
        report_name: report.report_name,
        created_at: report.created_at,
        order_count: report.daraz_order_report_items[0]?.count || 0
    }))
}

export async function createDarazOrderReport(name: string, orderNumbers: string[]) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        // 1. Create Report
        const { data: report, error: reportError } = await supabase
            .from('daraz_order_reports')
            .insert({
                report_name: name,
                created_by: user.id
            })
            .select()
            .single()

        if (reportError) throw reportError

        // 2. Insert Items
        if (orderNumbers.length > 0) {
            const items = orderNumbers.map(orderNumber => ({
                report_id: report.id,
                order_number: orderNumber
            }))

            const { error: itemsError } = await supabase
                .from('daraz_order_report_items')
                .insert(items)

            if (itemsError) throw itemsError
        }

        revalidatePath('/dashboard/sales/daraz/order-report')
        return { success: true, reportId: report.id }
    } catch (error: any) {
        console.error('Error creating report:', error)
        throw new Error(error.message || 'Failed to create report')
    }
}

export async function getDarazOrderReportDetails(reportId: string) {
    const supabase = await createClient()

    // 1. Fetch Order Numbers for this report
    const { data: reportItems, error: itemsError } = await supabase
        .from('daraz_order_report_items')
        .select('order_number')
        .eq('report_id', reportId)

    if (itemsError) throw itemsError

    const orderNumbers = reportItems.map(item => item.order_number)
    if (orderNumbers.length === 0) return []

    // 2. Fetch Order Details for these order numbers
    // We fetch from daraz_orders and join with items and products
    const { data: orders, error: ordersError } = await supabase
        .from('daraz_orders')
        .select(`
            order_number,
            items:daraz_order_items(
                product_name,
                quantity,
                purchase_cost,
                product_id
            )
        `)
        .in('order_number', orderNumbers)

    if (ordersError) throw ordersError

    // 3. Process and format data
    const result: any[] = []
    
    // Create a map of fetched orders for easy lookup
    const orderMap: Record<string, any> = {}
    orders.forEach(o => {
        orderMap[o.order_number] = o
    })

    // We need to fetch prices for items where purchase_cost is missing
    const productIdsToFetch = orders.flatMap(o => o.items.filter(i => !i.purchase_cost || i.purchase_cost === 0).map(i => i.product_id)).filter(Boolean)
    
    let priceMap: Record<string, number> = {}
    if (productIdsToFetch.length > 0) {
        const { data: prices } = await supabase
            .from('inventory_price_reports_view')
            .select('product_id, last_price, est_price')
            .in('product_id', productIdsToFetch)
        
        prices?.forEach(p => {
            priceMap[p.product_id] = p.last_price || p.est_price || 0
        })
    }

    // Iterate through ALL order numbers from the report to ensure none are missing from the view
    orderNumbers.forEach(orderNumber => {
        const order = orderMap[orderNumber]
        
        if (order && order.items && order.items.length > 0) {
            order.items.forEach((item: any) => {
                const purchaseCost = item.purchase_cost || priceMap[item.product_id] || 0
                result.push({
                    order_number: order.order_number,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    purchase_cost: purchaseCost,
                    total_cost: purchaseCost * item.quantity
                })
            })
        } else {
            // Placeholder for orders not found in system
            result.push({
                order_number: orderNumber,
                product_name: 'Order details not found (Sync required)',
                quantity: 0,
                purchase_cost: 0,
                total_cost: 0
            })
        }
    })

    return result;
}

export async function deleteDarazOrderReport(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('daraz_order_reports')
        .update({ is_deleted: true })
        .eq('id', id)

    if (error) throw error

    revalidatePath('/dashboard/sales/daraz/order-report')
    return { success: true }
}
