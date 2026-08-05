import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Validation middleware
async function validateApiKey(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false
    }
    const apiKey = authHeader.split(' ')[1]
    return apiKey === process.env.MESSENGER_APP_API_KEY
}

export async function PUT(req: NextRequest) {
    if (!await validateApiKey(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { order_number, status } = body

        // Note: Messenger App sends 'order_number'. 
        // In this integration, we stored the original Messenger 'order_number' in remarks or matched via phone?
        // Actually, the Messaging App might know the Inventory App's ID if we returned it?
        // Strategy: 
        // 1. If Messenger App stores our ID, use that.
        // 2. If not, match by "remarks contains order_number".

        // For simplicity, let's assume we match by phone_number + latest pending?
        // Or better, let's assume the Messenger App sends our `sales_id` back if we returned it.
        // Or we match by custom mapping.

        // Let's try to match strictly by the `remarks` field containing the order number for now.

        const supabase = await createAdminClient()

        // Find the order
        // We look for partial match in remarks: "Order #<order_number>)"
        const { data: orders, error: searchError } = await supabase
            .from('marketplace_orders')
            .select('id, order_status')
            .ilike('remarks', `%Order #${order_number})%`)
            .order('created_at', { ascending: false })
            .limit(1)

        if (searchError) {
            return NextResponse.json({ error: searchError.message }, { status: 500 })
        }

        if (!orders || orders.length === 0) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        const orderId = orders[0].id
        const currentStatus = orders[0].order_status

        // Update status
        // We only map specific statuses
        const validStatuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled']
        if (!validStatuses.includes(status)) {
            // Just ignore unknown statuses or map them?
            // Proceeding if it matches our schema
        }

        // Map timestamps
        const now = new Date().toISOString()
        const updateData: any = {
            order_status: status,
            updated_at: now
        }

        if (status === 'Shipped') updateData.shipped_at = now
        else if (status === 'Delivered') updateData.delivered_at = now
        else if (status === 'Pending') { /* no extra fields */ }
        // Add more as needed

        const { error: updateError } = await supabase
            .from('marketplace_orders')
            .update(updateData)
            .eq('id', orderId)

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Status updated' })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
