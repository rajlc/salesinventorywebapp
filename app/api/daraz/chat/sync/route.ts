import { NextRequest, NextResponse } from 'next/server'
import { syncDarazChatSessions, syncDarazChatMessages } from '@/features/chat/actions/chat-actions'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { storeId, sessionId } = body

        if (!storeId) {
            return NextResponse.json({ error: 'storeId is required' }, { status: 400 })
        }

        if (sessionId) {
            console.log(`[API-ChatSync] Syncing messages for store ${storeId}, session ${sessionId}`)
            const res = await syncDarazChatMessages(String(storeId), String(sessionId))
            return NextResponse.json(res)
        } else {
            console.log(`[API-ChatSync] Syncing sessions for store ${storeId}`)
            const res = await syncDarazChatSessions(String(storeId))
            return NextResponse.json(res)
        }

    } catch (error: any) {
        console.error('[API-ChatSync] Error:', error.message)
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 })
    }
}
