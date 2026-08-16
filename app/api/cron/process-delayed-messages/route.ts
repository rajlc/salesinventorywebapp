import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { processPendingDelayedMessagesAction } from '@/features/chat/actions/chat-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow Vercel execution up to 60s

export async function GET(request: NextRequest) {
    const startTime = Date.now()
    const supabase = await createAdminClient()

    try {
        const searchParams = request.nextUrl.searchParams
        const limitParam = searchParams.get('limit')
        const limit = limitParam ? parseInt(limitParam, 10) : 10

        console.log(`[Cron] Checking for pending automated messages (limit: ${limit})...`)

        const res = await processPendingDelayedMessagesAction(limit)

        // Trigger retention policy cleanup function in Supabase
        console.log('[Cron] Running message retention policy cleanup...')
        const { error: cleanError } = await supabase.rpc('clean_daraz_chat_messages')
        if (cleanError) {
            console.error('[Cron] Cleanup function failed:', cleanError.message)
        } else {
            console.log('[Cron] ✅ Message retention cleanup completed.')
        }

        return NextResponse.json({
            success: true,
            processed: res.processed || 0,
            elapsed_ms: Date.now() - startTime
        })

    } catch (err: any) {
        console.error('[Cron] Critical error in delayed processor:', err.message)
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    return GET(request)
}


