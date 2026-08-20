import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { processPendingDelayedMessagesAction } from '@/features/chat/actions/chat-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow Vercel execution up to 60s

export async function GET(request: NextRequest) {
    const startTime = Date.now()

    // --- Authorization: require CRON_SECRET to prevent public abuse ---
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = request.headers.get('x-cron-secret')
        const querySecret = request.nextUrl.searchParams.get('secret')
        if (authHeader !== cronSecret && querySecret !== cronSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    try {
        const searchParams = request.nextUrl.searchParams
        const limitParam = searchParams.get('limit')
        const limit = limitParam ? parseInt(limitParam, 10) : 10

        console.log(`[Cron] Checking for pending automated messages (limit: ${limit})...`)

        const res = await processPendingDelayedMessagesAction(limit)

        // If Supabase is unreachable, return 200 so cron-job.org doesn't
        // count it as a failure and doesn't auto-disable the job
        if (!res.success && res.error) {
            console.warn('[Cron] Processor returned error (Supabase may be recovering):', res.error)
            return NextResponse.json({
                success: false,
                skipped: true,
                reason: 'Database temporarily unavailable — will retry next run',
                elapsed_ms: Date.now() - startTime
            }, { status: 200 }) // ← 200 so cron-job.org doesn't count as failure
        }

        // Trigger retention policy cleanup function in Supabase (non-critical)
        try {
            const supabase = await createAdminClient()
            const { error: cleanError } = await supabase.rpc('clean_daraz_chat_messages')
            if (cleanError) {
                console.warn('[Cron] Cleanup function warning (non-critical):', cleanError.message)
            } else {
                console.log('[Cron] ✅ Message retention cleanup completed.')
            }
        } catch (cleanErr: any) {
            console.warn('[Cron] Cleanup skipped (non-critical):', cleanErr.message)
        }

        return NextResponse.json({
            success: true,
            processed: res.processed || 0,
            elapsed_ms: Date.now() - startTime
        })

    } catch (err: any) {
        console.error('[Cron] Critical error in delayed processor:', err.message)

        // Return 200 with error detail instead of 500 to prevent cron-job.org
        // from disabling the job during transient Supabase outages
        const isSupabaseDown = err.message?.includes('522') ||
                               err.message?.includes('ECONNREFUSED') ||
                               err.message?.includes('fetch failed') ||
                               err.message?.includes('network')

        if (isSupabaseDown) {
            return NextResponse.json({
                success: false,
                skipped: true,
                reason: 'Database temporarily unavailable',
                elapsed_ms: Date.now() - startTime
            }, { status: 200 }) // ← 200 so cron-job.org doesn't disable
        }

        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    return GET(request)
}
