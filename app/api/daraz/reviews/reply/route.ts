import { NextRequest, NextResponse } from 'next/server'
import { replyToReview } from '@/features/reviews/actions/review-actions'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { storeId, reviewId, replyContent } = body

        if (!storeId || !reviewId || !replyContent) {
            return NextResponse.json({ error: 'Store ID, Review ID, and Reply Content are required' }, { status: 400 })
        }

        const result = await replyToReview(String(storeId), String(reviewId), String(replyContent))

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: 'Reply submitted successfully'
            })
        } else {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to submit reply'
            }, { status: 500 })
        }

    } catch (error: any) {
        console.error('Review Reply API Error:', error.message)
        return NextResponse.json({
            error: 'Failed to submit reply',
            details: error.message
        }, { status: 500 })
    }
}
