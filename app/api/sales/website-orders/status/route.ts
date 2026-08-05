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

        if (!order_number) {
            return NextResponse.json({ error: 'order_number is required' }, { status: 400 })
        }

        const supabase = await createAdminClient()

        // Find the order by parsing the remarks or using messaging_app_order_id if available.
        // We will match by remarks containing the order_number as a fallback, but preferably using direct order_number search.
        const { data: orders, error: searchError } = await supabase
            .from('website_orders')
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

        // Map timestamps
        const now = new Date().toISOString()
        const updateData: any = {
            order_status: status,
            updated_at: now
        }

        if (status === 'Shipped') updateData.shipped_at = now
        else if (status === 'Delivered') updateData.shipped_at = now // Can track delivered too if column exists
        
        const { error: updateError } = await supabase
            .from('website_orders')
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
