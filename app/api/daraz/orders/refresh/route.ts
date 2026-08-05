import { NextRequest, NextResponse } from 'next/server'
import { syncSingleDarazOrderAction } from '@/features/sales/actions/daraz-sync-order'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { orderId, storeId } = body

        if (!orderId || !storeId) {
            return NextResponse.json({ error: 'Order ID and Store ID are required' }, { status: 400 })
        }

        const result = await syncSingleDarazOrderAction(String(orderId), String(storeId))

        return NextResponse.json({
            success: true,
            message: 'Order refreshed successfully',
            newStatus: result.newStatus
        })

    } catch (error: any) {
        console.error('Order Refresh API Error:', error.message)
        return NextResponse.json({
            error: 'Failed to refresh order',
            details: error.message
        }, { status: 500 })
    }
}
