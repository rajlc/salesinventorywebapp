import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { syncSingleDarazOrderAction } from '@/features/sales/actions/daraz-sync-order'
import { processIncomingMessageAutoReply, generateSessionAiAnalysisAction } from '@/features/chat/actions/chat-actions'

// Signature verification using HMAC-SHA256
function verifySignature(appKey: string, body: string, appSecret: string, receivedSignature: string): boolean {
    const base = appKey + body
    const hmac = crypto.createHmac('sha256', appSecret)
    hmac.update(base)
    const expectedSignature = hmac.digest('hex').toLowerCase()

    return expectedSignature === receivedSignature.toLowerCase()
}

export const maxDuration = 60 // keep function alive for AI reply + analysis (after())

export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        const rawBody = await request.text()
        const authorization = request.headers.get('authorization')

        // Handle empty body (Verification tests from Daraz can sometimes be empty or simple pings)
        if (!rawBody || rawBody.trim() === '') {
            console.log('[Webhook] Received empty body, acknowledging with 200.')
            return NextResponse.json({ success: true, message: 'Empty body acknowledged' })
        }

        if (!authorization) {
            console.error('[Webhook] Missing authorization header')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let payload: any
        try {
            payload = JSON.parse(rawBody)
        } catch (e) {
            console.error('[Webhook] Invalid JSON parsing error:', e)
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const appKeyOrder = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()
        const appSecretOrder = process.env.DARAZ_APP_SECRET?.trim()

        const appKeyChat = process.env.NEXT_PUBLIC_DARAZ_CHAT_APP_KEY?.trim() || process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()
        const appSecretChat = process.env.DARAZ_CHAT_APP_SECRET?.trim() || process.env.DARAZ_APP_SECRET?.trim()

        let isValid = false
        let verifiedAppKey = ''

        if (appKeyOrder && appSecretOrder) {
            isValid = verifySignature(appKeyOrder, rawBody, appSecretOrder, authorization)
            if (isValid) verifiedAppKey = appKeyOrder
        }

        if (!isValid && appKeyChat && appSecretChat) {
            isValid = verifySignature(appKeyChat, rawBody, appSecretChat, authorization)
            if (isValid) verifiedAppKey = appKeyChat
        }

        if (!isValid) {
            console.error('[Webhook] Invalid signature (tried verification with both Order and Chat app credentials)')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        console.log(`[Webhook] Signature verified successfully using App Key: ${verifiedAppKey}`)

        // [RACE CONDITION FIX] Add a small random jitter delay (0-500ms)
        // This helps prevent parallel webhooks from hitting the DB at the exact same microsecond
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500))

        const { message_type, data, seller_id } = payload
        const msgType = Number(message_type)

        // Type 4: Trade Order (New/Updated Order)
        // Type 10: Reverse Order (Returns/Refunds) - needed for "Customer Return Delivered"
        // Type 14: Order Fulfillment Status Update
        const isTradeOrder = (msgType === 4 || msgType === 10 || msgType === 14) && !data?.session_id && !data?.sessionId
        if (isTradeOrder && data) {
            const tradeOrderId = data.trade_order_id || data.order_id || data.reverse_order_id

            if (!tradeOrderId) {
                console.warn('[Webhook] Message received but missing trade_order_id:', data)
                return NextResponse.json({ success: true, message: 'Missing order ID' })
            }

            console.log(`[Webhook] Processing message_type: ${message_type} for Order: ${tradeOrderId} (Seller ID: ${seller_id})`)

            const supabase = await createAdminClient()

            // 1. Map seller_id to store_id
            const { data: store, error: storeError } = await supabase
                .from('online_stores')
                .select('id, seller_account')
                .eq('seller_id', String(seller_id))
                .maybeSingle()

            if (storeError) {
                console.error('[Webhook] Database error finding store:', storeError)
                return NextResponse.json({ success: true, message: 'Database error' })
            }

            if (!store) {
                console.error(`[Webhook] ❌ Store NOT FOUND for seller_id: "${seller_id}". Please check Store Settings.`)
                return NextResponse.json({ success: true, message: 'Store mapping missing' })
            }

            console.log(`[Webhook] Matched Store: ${store.seller_account} (${store.id})`)

            // 2. Trigger shared sync logic
            try {
                const result = await syncSingleDarazOrderAction(String(tradeOrderId), store.id)
                console.log(`[Webhook] ✅ Order ${tradeOrderId} auto-synced. Status: ${result.newStatus}`)

                // Queue automated chat message if it is a new order (Pending)
                const isPendingOrder = String(result.newStatus || '').toLowerCase() === 'pending'
                if (isPendingOrder) {
                    try {
                        const { data: chatSettings } = await supabase
                            .from('daraz_chat_settings')
                            .select('*')
                            .eq('store_id', store.id)
                            .maybeSingle()

                        if (chatSettings?.auto_reply_on_new_order) {
                            const delayMinutes = chatSettings.new_order_delay_minutes ?? 1
                            const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
                            
                            // Check if already queued to prevent duplicate entries
                            const { data: existingQueue } = await supabase
                                .from('daraz_delayed_messages')
                                .select('id')
                                .eq('store_id', store.id)
                                .eq('order_id', String(tradeOrderId))
                                .limit(1)

                            if (!existingQueue || existingQueue.length === 0) {
                                const { error: insertError } = await supabase
                                    .from('daraz_delayed_messages')
                                    .insert({
                                        store_id: store.id,
                                        order_id: String(tradeOrderId),
                                        txt: chatSettings.new_order_template,
                                        scheduled_at: scheduledAt,
                                        status: 'pending'
                                    })
                                
                                if (insertError) {
                                    if (insertError.code === '23505') {
                                        console.log(`[Webhook] Duplicate ignored: message already queued/sent for Order: ${tradeOrderId} (caught constraint violation)`)
                                    } else {
                                        throw insertError
                                    }
                                } else {
                                    console.log(`[Webhook] Queued delayed message for Order: ${tradeOrderId} at ${scheduledAt} (delay: ${delayMinutes} min)`)
                                }
                            } else {
                                console.log(`[Webhook] Duplicate ignored: message already queued/sent in database for Order: ${tradeOrderId}`)
                            }
                        }
                    } catch (queueErr: any) {
                        console.error('[Webhook] Failed to queue automated chat message:', queueErr.message)
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: `Order ${tradeOrderId} auto-synced`,
                    status: result.newStatus,
                    elapsed_ms: Date.now() - startTime
                })
            } catch (syncError: any) {
                console.error(`[Webhook] ❌ Sync failed for order ${tradeOrderId}:`, syncError.message)
                return NextResponse.json({
                    success: true,
                    message: 'Sync failed but acknowledged',
                    error: syncError.message
                })
            }
        }

        // Type 2 / Type 5: New IM Message from Buyer
        // Type 6: Message Read Notification (session-level update)
        // Any payload that carries session_id is a chat event
        const isChatEvent = (msgType === 2 || msgType === 5 || msgType === 6 || Boolean(data?.session_id || data?.sessionId)) && Boolean(data)
        if (isChatEvent) {
            const sessionId = data.session_id || data.sessionId
            const msgContent = data.content || data.message || data.txt || ''
            const fromAccountType = String(data.from_account_type || data.sender_type || '1')
            const sendTime = data.send_time || data.timestamp || String(Date.now())
            const messageId = data.message_id || data.msgId || `webhook_${Date.now()}`
            const templateId = String(data.template_id || '1')

            if (!sessionId) {
                console.warn('[Webhook] Chat event missing session_id:', data)
                return NextResponse.json({ success: true, message: 'Missing session_id' })
            }

            console.log(`[Webhook] Processing chat message_type: ${message_type} (msgType: ${msgType}), session: ${sessionId}`)

            const supabase = await createAdminClient()

            // 1. Find the store matching the seller_id from the webhook payload
            let storeId = ''
            if (seller_id) {
                const { data: store } = await supabase
                    .from('online_stores')
                    .select('id')
                    .eq('seller_id', String(seller_id))
                    .maybeSingle()
                if (store) storeId = store.id
            }

            // Fallback: resolve store from existing session
            if (!storeId) {
                const { data: existingSession } = await supabase
                    .from('daraz_chat_sessions')
                    .select('store_id')
                    .eq('session_id', sessionId)
                    .maybeSingle()
                if (existingSession?.store_id) storeId = existingSession.store_id
            }

            if (!storeId) {
                console.error(`[Webhook] Store not found for seller_id: ${seller_id} and session: ${sessionId}`)
                return NextResponse.json({ success: true, message: 'Store not found' })
            }

            if (msgType === 6) {
                // Read receipt — update unread count to 0 for this session
                await supabase
                    .from('daraz_chat_sessions')
                    .update({ unread_count: 0 })
                    .eq('session_id', sessionId)
                return NextResponse.json({ success: true, message: 'Read receipt processed' })
            }

            // Guard: Ignore presence/ping events that contain no text/card content
            const hasRealContent = typeof msgContent === 'string'
                ? msgContent.trim() !== '' && msgContent.trim() !== '{}' && msgContent.trim() !== 'null'
                : Boolean(msgContent)

            if (!hasRealContent) {
                console.log(`[Webhook] Chat event for session ${sessionId} carries no message body, skipping daraz_chat_messages insert.`)
                return NextResponse.json({ success: true, message: 'Session event acknowledged' })
            }

            // 2. Parse timestamp safely
            let sendTimeISO = new Date().toISOString()
            try {
                const parsedNum = Number(sendTime)
                if (!isNaN(parsedNum) && parsedNum > 1000000000) {
                    sendTimeISO = new Date(parsedNum < 10000000000 ? parsedNum * 1000 : parsedNum).toISOString()
                } else if (sendTime) {
                    const parsedDate = new Date(sendTime).getTime()
                    if (!isNaN(parsedDate)) sendTimeISO = new Date(parsedDate).toISOString()
                }
            } catch {}

            // 3. Upsert incoming message (preserve auto_reply flag if it was already marked true)
            const { data: existingMsg } = await supabase
                .from('daraz_chat_messages')
                .select('auto_reply')
                .eq('message_id', messageId)
                .maybeSingle()

            await supabase.from('daraz_chat_messages').upsert({
                message_id: messageId,
                session_id: sessionId,
                from_account_id: String(data.from_account_id || data.sender_id || ''),
                from_account_type: fromAccountType,
                to_account_id: String(data.to_account_id || data.receiver_id || ''),
                to_account_type: String(data.to_account_type || data.receiver_type || '2'),
                content: msgContent,
                template_id: templateId,
                send_time: sendTimeISO,
                auto_reply: existingMsg?.auto_reply === true,
                tags: []
            }, { onConflict: 'message_id' })

            // 4. Update session last message summary & time
            let summaryText = msgContent.substring(0, 100)
            try {
                const p = JSON.parse(msgContent)
                if (p.txt) summaryText = p.txt.substring(0, 100)
                else if (p.cardType === 10006 || p.itemId) summaryText = 'Product Card'
                else if (p.cardType === 10007 || p.orderId) summaryText = 'Order Card'
                else if (p.cardType === 10010 || p.sellerId) summaryText = 'Follow Invitation'
            } catch {}

            await supabase
                .from('daraz_chat_sessions')
                .update({
                    last_message_id: messageId,
                    last_message_time: sendTimeISO,
                    last_message_summary: summaryText,
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', sessionId)

            // Increment unread count for buyer messages
            if (fromAccountType === '1') {
                const { error: rpcError } = await supabase.rpc('increment_unread_count', { p_session_id: sessionId })
                if (rpcError) {
                    const { data: sessionRow } = await supabase
                        .from('daraz_chat_sessions')
                        .select('unread_count')
                        .eq('session_id', sessionId)
                        .single()
                    if (sessionRow) {
                        await supabase
                            .from('daraz_chat_sessions')
                            .update({ unread_count: (sessionRow.unread_count || 0) + 1 })
                            .eq('session_id', sessionId)
                    }
                }
            }

            // 5. Trigger auto-reply and real-time AI analysis if message is from buyer
            if (fromAccountType === '1') {
                let msgTimeMs = Date.now()
                if (sendTime) {
                    const parsedNum = Number(sendTime)
                    if (!isNaN(parsedNum) && parsedNum > 1000000000) {
                        msgTimeMs = parsedNum < 10000000000 ? parsedNum * 1000 : parsedNum
                    } else {
                        const parsedDate = new Date(sendTime).getTime()
                        if (!isNaN(parsedDate)) msgTimeMs = parsedDate
                    }
                }
                const isRecent = Math.abs(Date.now() - msgTimeMs) < 15 * 60 * 1000

                // Only trigger auto-reply on text messages (template '1' or containing text)
                let isTextMsg = String(templateId) === '1'
                if (!isTextMsg) {
                    try {
                        const p = JSON.parse(msgContent)
                        if (p && typeof p.txt === 'string' && p.txt.trim()) isTextMsg = true
                    } catch {}
                }

                const shouldAutoReply = isRecent && isTextMsg
                if (!isRecent) {
                    console.log(`[Webhook] Skipping auto-reply for session ${sessionId} - message time older than 15 mins.`)
                }

                // Use after() so the work continues after the HTTP response is sent.
                // (Plain un-awaited promises are killed by serverless once the response returns.)
                after(async () => {
                    if (shouldAutoReply) {
                        try {
                            await processIncomingMessageAutoReply(storeId, sessionId, {
                                content: msgContent,
                                from_account_type: fromAccountType,
                                send_time: String(sendTime)
                            })
                        } catch (err) {
                            console.error('[Webhook] Auto-reply error:', err)
                        }
                    }
                    // Always refresh AI customer & order analysis with the new message
                    try {
                        await generateSessionAiAnalysisAction(storeId, sessionId)
                    } catch (analysisErr) {
                        console.warn('[Webhook] Real-time AI analysis error:', analysisErr)
                    }
                })
            }

            return NextResponse.json({ success: true, message: 'Chat message processed' })
        }

        console.log(`[Webhook] Received message_type: ${message_type} (no specific handler)`)
        return NextResponse.json({ success: true, message: 'Message acknowledged' })

    } catch (error: any) {
        console.error('[Webhook] Critical Error:', error)
        return NextResponse.json({
            success: true,
            message: 'Acknowledged with error',
            error: error.message
        })
    }
}
