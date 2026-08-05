import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { openSessionByOrderId, sendChatMessage } from '@/features/chat/actions/chat-actions'

export async function GET(request: NextRequest) {
    const startTime = Date.now()
    const supabase = await createAdminClient()

    try {
        console.log('[Cron] Checking for pending automated messages...')

        // 1. Fetch pending messages scheduled for now or earlier
        const { data: pending, error } = await supabase
            .from('daraz_delayed_messages')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_at', new Date().toISOString())

        if (error) {
            throw new Error(`Failed to fetch pending messages: ${error.message}`)
        }

        console.log(`[Cron] Found ${pending?.length || 0} messages to process.`)

        const results = []

        if (pending && pending.length > 0) {
            for (const task of pending) {
                try {
                    // Update status to processing
                    await supabase
                        .from('daraz_delayed_messages')
                        .update({ status: 'processing', updated_at: new Date().toISOString() })
                        .eq('id', task.id)

                    // Open session on Daraz
                    const sessionId = await openSessionByOrderId(task.store_id, task.order_id)
                    if (!sessionId) {
                        throw new Error(`Could not open conversation session for order ${task.order_id}`)
                    }

                    // A. Send confirmation text message
                    if (task.txt) {
                        const res = await sendChatMessage(task.store_id, sessionId, '1', task.txt, undefined, undefined, true)
                        if (!res.success) {
                            throw new Error(res.error || 'Failed to send confirmation text message')
                        }
                    }

                    // B. Send follow store button invitation (Template 10010)
                    const resFollow = await sendChatMessage(task.store_id, sessionId, '10010', undefined, undefined, undefined, true)
                    if (!resFollow.success) {
                        throw new Error(resFollow.error || 'Failed to send follow store invitation')
                    }

                    // Mark as sent
                    await supabase
                        .from('daraz_delayed_messages')
                        .update({
                            status: 'sent',
                            session_id: sessionId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', task.id)

                    results.push({ id: task.id, order_id: task.order_id, status: 'success' })
                    console.log(`[Cron] ✅ Successfully sent automated message for order ${task.order_id}`)
                } catch (taskError: any) {
                    console.error(`[Cron] ❌ Failed processing task ${task.id} for order ${task.order_id}:`, taskError.message)
                    
                    const isTemporaryError = taskError.message.includes('order not found') || 
                                             taskError.message.includes('too many requests') || 
                                             taskError.message.includes('timeout')
                    
                    // Parse retry count from previous error message if present
                    let retryCount = 0
                    if (task.error_message && task.error_message.includes('Retry:')) {
                        const match = task.error_message.match(/Retry:\s*(\d+)/)
                        if (match) {
                            retryCount = parseInt(match[1], 10)
                        }
                    }

                    if (isTemporaryError && retryCount < 3) {
                        const nextRun = new Date(Date.now() + 3 * 60 * 1000).toISOString()
                        await supabase
                            .from('daraz_delayed_messages')
                            .update({
                                status: 'pending',
                                error_message: `Retry: ${retryCount + 1} - ${taskError.message}`,
                                scheduled_at: nextRun,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', task.id)
                        console.log(`[Cron] Rescheduled task ${task.id} for order ${task.order_id} to ${nextRun} (Retry ${retryCount + 1}/3)`)
                        results.push({ id: task.id, order_id: task.order_id, status: 'rescheduled', error: taskError.message })
                    } else {
                        // Mark as failed permanently
                        await supabase
                            .from('daraz_delayed_messages')
                            .update({
                                status: 'failed',
                                error_message: taskError.message,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', task.id)
                        results.push({ id: task.id, order_id: task.order_id, status: 'failed', error: taskError.message })
                    }
                }
            }
        }

        // 2. Trigger retention policy cleanup function in Supabase
        console.log('[Cron] Running message retention policy cleanup...')
        const { error: cleanError } = await supabase.rpc('clean_daraz_chat_messages')
        if (cleanError) {
            console.error('[Cron] Cleanup function failed:', cleanError.message)
        } else {
            console.log('[Cron] ✅ Message retention cleanup completed.')
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results,
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
