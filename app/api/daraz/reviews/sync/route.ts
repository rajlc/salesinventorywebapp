import { NextRequest, NextResponse } from 'next/server'
import { syncDarazReviews } from '@/features/reviews/actions/review-actions'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { storeId } = body

        if (!storeId) {
            return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
        }

        const result = await syncDarazReviews(String(storeId))

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: 'Reviews synced successfully',
                count: result.count
            })
        } else {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to sync reviews'
            }, { status: 500 })
        }

    } catch (error: any) {
        console.error('Review Sync API Error:', error.message)
        return NextResponse.json({
            error: 'Failed to sync reviews',
            details: error.message
        }, { status: 500 })
    }
}
