import { NextRequest, NextResponse } from 'next/server'
import { generateSingleReviewSuggestion } from '@/features/reviews/actions/review-actions'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { storeId, reviewId } = body

        if (!storeId || !reviewId) {
            return NextResponse.json({ error: 'Store ID and Review ID are required' }, { status: 400 })
        }

        const result = await generateSingleReviewSuggestion(String(storeId), String(reviewId))

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: 'AI Suggestion generated successfully',
                suggested_reply: result.suggested_reply
            })
        } else {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to generate AI suggestion'
            }, { status: 500 })
        }

    } catch (error: any) {
        console.error('AI Suggestion API Error:', error.message)
        return NextResponse.json({
            error: 'Failed to generate AI suggestion',
            details: error.message
        }, { status: 500 })
    }
}
