'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Sync order statuses for manually added or CSV imported orders
export async function syncOrderStatusesFromDarazData() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        console.log('[OrderSync] Starting status sync...')

        // Get manual/CSV orders that have been matched to Daraz (have order_id)
        const { data: orders, error } = await supabase
            .from('daraz_orders')

            .select('id, order_number, order_id, order_status, import_source, statuses')
            // .in('import_source', ['manual', 'csv']) // REMOVED restriction to allow syncing for ALL orders (including api_sync)
            .not('order_id', 'is', null)
            .or('deleted.is.null,deleted.eq.false')

        if (error) throw error

        console.log(`[OrderSync] Found ${orders?.length || 0} manual/CSV orders`)

        if (!orders || orders.length === 0) {
            return {
                success: true,
                updated: 0,
                message: 'No manual/CSV orders found (sync from Order Sync page first)'
            }
        }

        let updatedCount = 0

        for (const order of orders) {
            const rawStatuses = order.statuses || (order.order_status ? [order.order_status] : [])
            const s = rawStatuses.map((x: string) => x.toLowerCase())

            let newStatus = 'Pending'

            // Priority 0: Unpaid
            if (s.includes('unpaid')) newStatus = 'Unpaid'

            // Priority 1: Failures & Returns (High Priority)
            // Priority Logic (Matches API route)
            // 1. Failures
            else if (s.includes('returned') || s.includes('customer_return_delivered')) newStatus = 'Customer Return Delivered'
            else if (s.includes('shipped_back_success') || s.includes('returned_delivered')) newStatus = 'Returned Delivered'
            else if (s.includes('customer_return') || s.includes('customer return')) newStatus = 'Customer Return'
            else if (s.includes('returning_to_seller') || s.includes('returning to seller') || s.includes('shipped_back') ||
                s.includes('failed') || s.includes('failed_delivery') || s.includes('failed_delivered') || s.includes('failed delivery') || s.includes('failed delivered') || s.includes('delivery_failed') || s.includes('delivery failed')) newStatus = 'Returning to Seller'

            // 2. Cancellation (Moved UP)
            else if (s.includes('canceled') || s.includes('cancelled')) newStatus = 'Cancel'

            // 3. Success
            else if (s.includes('delivered') || s.includes('completed')) newStatus = 'Delivered'
            else if (s.includes('shipped')) newStatus = 'Shipped' // Strict Shipped
            else if (s.includes('ready_to_ship') || s.includes('ready to ship')) newStatus = 'Ready to Ship'
            else if (s.includes('packed')) newStatus = 'Packed'

            if (newStatus && newStatus !== order.order_status) {
                console.log(`[OrderSync] ${order.order_number}: ${order.order_status} → ${newStatus}`)

                const { error: updateError } = await supabase
                    .from('daraz_orders')
                    .update({
                        order_status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id)

                if (!updateError) updatedCount++
            }
        }

        console.log(`[OrderSync] Updated ${updatedCount} orders`)

        revalidatePath('/dashboard/sales/daraz/sales-entry')
        revalidatePath('/dashboard/sales/daraz/order-list')

        return {
            success: true,
            updated: updatedCount,
            total: orders.length,
            message: updatedCount > 0
                ? `Updated ${updatedCount} order${updatedCount > 1 ? 's' : ''}`
                : `All ${orders.length} orders already up to date`
        }
    } catch (error: any) {
        console.error('[OrderSync] Error:', error)
        return {
            success: false,
            updated: 0,
            message: 'Failed to sync order statuses'
        }
    }
}
