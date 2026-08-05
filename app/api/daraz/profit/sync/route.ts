import { NextRequest, NextResponse } from 'next/server'
import { syncOrderPurchaseCost } from '@/features/sales/actions/report-actions'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { orderNumber } = body

        if (!orderNumber) {
            return NextResponse.json({ error: 'Order Number is required' }, { status: 400 })
        }

        console.log(`[API] Manual Profit Sync requested for Order: ${orderNumber}`)
        await syncOrderPurchaseCost(String(orderNumber))

        return NextResponse.json({
            success: true,
            message: 'Profit synced successfully'
        })

    } catch (error: any) {
        console.error('Profit Sync API Error:', error.message)
        return NextResponse.json({
            error: 'Failed to sync profit',
            details: error.message
        }, { status: 500 })
    }
}
