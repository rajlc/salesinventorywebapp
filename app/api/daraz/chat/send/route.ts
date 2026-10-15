import { NextRequest, NextResponse } from 'next/server'
import { sendChatMessage } from '@/features/chat/actions/chat-actions'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { storeId, sessionId, message, text } = body

        const content = (message || text || '').trim()

        if (!storeId || !sessionId || !content) {
            return NextResponse.json(
                { error: 'storeId, sessionId, and message content are required' },
                { status: 400 }
            )
        }

        console.log(`[API-ChatSend] Sending message to Daraz for store ${storeId}, session ${sessionId}`)

        // Template ID '1' is standard text message
        const result = await sendChatMessage(
            String(storeId),
            String(sessionId),
            '1',
            content,
            undefined,
            undefined,
            false // manual reply
        )

        if (result.success) {
            return NextResponse.json({
                success: true,
                messageId: result.messageId,
                message: 'Message sent successfully to customer'
            })
        } else {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to send message to Daraz'
            }, { status: 500 })
        }

    } catch (error: any) {
        console.error('[API-ChatSend] Error:', error.message)
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 })
    }
}
